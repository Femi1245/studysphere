import type { SupabaseClient } from '@supabase/supabase-js'
import { logActivity } from '@/lib/activity'
import type {
  CatalogueCourse,
  StudentAcademicProfile,
  StudentCourseEnrolment,
} from '@/types/database'

export type AcademicQuizContext = {
  profile: StudentAcademicProfile | null
  enrolments: (StudentCourseEnrolment & { catalogue_courses: CatalogueCourse | null })[]
  /** Human label used for AI question generation */
  subjectLabel: string
  programmeName: string | null
  courseOfStudy: string | null
  institutionName: string | null
}

/**
 * Find catalogue courses that match the student's programme / course of study / level.
 */
export async function resolveCoursesForProfile(
  supabase: SupabaseClient,
  profile: StudentAcademicProfile,
): Promise<CatalogueCourse[]> {
  const byId = new Map<string, CatalogueCourse>()

  if (profile.programme_id) {
    const { data } = await supabase
      .from('catalogue_courses')
      .select('*')
      .eq('is_published', true)
      .eq('programme_id', profile.programme_id)
      .limit(40)
    for (const row of (data as CatalogueCourse[]) ?? []) byId.set(row.id, row)
  }

  if (profile.course_of_study?.trim()) {
    const raw = profile.course_of_study.trim()
    const safe = raw.replace(/[%_,.()]/g, ' ').replace(/\s+/g, ' ').trim()
    const tokens = safe.split(' ').filter((t) => t.length >= 3).slice(0, 4)
    const searchTerms = tokens.length ? tokens : [safe.slice(0, 40)]
    for (const term of searchTerms) {
      if (!term) continue
      const { data } = await supabase
        .from('catalogue_courses')
        .select('*')
        .eq('is_published', true)
        .or(`title.ilike.%${term}%,code.ilike.%${term}%`)
        .limit(40)
      for (const row of (data as CatalogueCourse[]) ?? []) byId.set(row.id, row)
      if (byId.size >= 8) break
    }
  }

  if (byId.size === 0 && profile.education_level_id) {
    const { data } = await supabase
      .from('catalogue_courses')
      .select('*')
      .eq('is_published', true)
      .eq('education_level_id', profile.education_level_id)
      .is('institution_id', null)
      .limit(24)
    for (const row of (data as CatalogueCourse[]) ?? []) byId.set(row.id, row)
  }

  // Last resort: any published shared courses so quizzes can still start
  if (byId.size === 0) {
    const { data } = await supabase
      .from('catalogue_courses')
      .select('*')
      .eq('is_published', true)
      .is('institution_id', null)
      .limit(12)
    for (const row of (data as CatalogueCourse[]) ?? []) byId.set(row.id, row)
  }

  // Prefer class-level match when available
  if (profile.class_level_id && byId.size > 4) {
    const leveled = [...byId.values()].filter(
      (c) => !c.class_level_id || c.class_level_id === profile.class_level_id,
    )
    if (leveled.length) return leveled
  }

  return [...byId.values()]
}

/**
 * Ensure the student has active enrolments derived from their academic profile.
 * Safe to call on exam/dashboard load and after profile save.
 */
export async function syncEnrolmentsFromAcademicProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data: profile } = await supabase
    .from('student_academic_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (!profile) return []

  const { data: existing } = await supabase
    .from('student_course_enrolments')
    .select('catalogue_course_id')
    .eq('user_id', userId)
    .eq('status', 'active')

  const have = new Set((existing ?? []).map((e) => e.catalogue_course_id as string))
  if (have.size > 0) return [...have]

  const courses = await resolveCoursesForProfile(supabase, profile as StudentAcademicProfile)
  const enrolled: string[] = []

  for (const c of courses.slice(0, 12)) {
    const { error } = await supabase.from('student_course_enrolments').upsert(
      {
        user_id: userId,
        catalogue_course_id: c.id,
        status: 'active',
      },
      { onConflict: 'user_id,catalogue_course_id' },
    )
    if (!error) {
      enrolled.push(c.id)
      void logActivity(supabase, {
        userId,
        eventType: 'course_enrolled',
        catalogueCourseId: c.id,
        metadata: { source: 'academic_sync' },
      })
    }
  }

  return enrolled
}

export async function loadAcademicQuizContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<AcademicQuizContext> {
  await syncEnrolmentsFromAcademicProfile(supabase, userId)

  const [{ data: profile }, { data: enrolments }] = await Promise.all([
    supabase.from('student_academic_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('student_course_enrolments')
      .select('*, catalogue_courses(*)')
      .eq('user_id', userId)
      .eq('status', 'active'),
  ])

  const p = profile as StudentAcademicProfile | null
  let programmeName: string | null = null
  let institutionName: string | null = null

  if (p?.programme_id) {
    const { data } = await supabase.from('programmes').select('name').eq('id', p.programme_id).maybeSingle()
    programmeName = (data?.name as string | undefined) ?? null
  }
  if (p?.institution_id) {
    const { data } = await supabase.from('institutions').select('name').eq('id', p.institution_id).maybeSingle()
    institutionName = (data?.name as string | undefined) ?? null
  } else if (p?.custom_institution_name) {
    institutionName = p.custom_institution_name
  }

  const courseOfStudy = p?.course_of_study ?? null
  const firstCourse = (
    enrolments as (StudentCourseEnrolment & { catalogue_courses: CatalogueCourse | null })[] | null
  )?.[0]?.catalogue_courses

  const subjectLabel = [
    courseOfStudy,
    programmeName,
    firstCourse ? `${firstCourse.code} ${firstCourse.title}` : null,
    institutionName,
  ]
    .filter(Boolean)
    .slice(0, 2)
    .join(' — ') || 'General Nigerian university studies'

  return {
    profile: p,
    enrolments:
      (enrolments as (StudentCourseEnrolment & { catalogue_courses: CatalogueCourse | null })[]) ??
      [],
    subjectLabel,
    programmeName,
    courseOfStudy,
    institutionName,
  }
}
