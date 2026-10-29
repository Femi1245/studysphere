import type { SupabaseClient } from '@supabase/supabase-js'
import { logActivity } from '@/lib/activity'
import type {
  CatalogueCourse,
  StudentAcademicProfile,
  StudentCourseEnrolment,
} from '@/types/database'

/** Select value: start quiz from saved academic profile subject (no catalogue course). */
export const ACADEMIC_SUBJECT_VALUE = '__academic_subject__'

export type AcademicQuizContext = {
  profile: StudentAcademicProfile | null
  enrolments: (StudentCourseEnrolment & { catalogue_courses: CatalogueCourse | null })[]
  /** Human label used for AI question generation — always from saved academic profile */
  subjectLabel: string
  programmeName: string | null
  courseOfStudy: string | null
  institutionName: string | null
  hasAcademicSetup: boolean
}

function sanitizeFilterTerm(raw: string): string {
  return raw.replace(/[%_,.()"'\\]/g, ' ').replace(/\s+/g, ' ').trim()
}

function scoreNameMatch(candidate: string, target: string): number {
  const a = candidate.trim().toLowerCase()
  const b = target.trim().toLowerCase()
  if (!a || !b) return 0
  if (a === b) return 100
  if (a.includes(b) || b.includes(a)) return 80
  const aTokens = a.split(/\s+/).filter((t) => t.length > 2)
  const bTokens = new Set(b.split(/\s+/).filter((t) => t.length > 2))
  if (!aTokens.length || !bTokens.size) return 0
  const hits = aTokens.filter((t) => bTokens.has(t)).length
  return Math.round((hits / Math.max(aTokens.length, bTokens.size)) * 60)
}

/**
 * Find catalogue courses that truly match the student's saved programme / course of study.
 * Never dumps unrelated shared courses.
 */
export async function resolveCoursesForProfile(
  supabase: SupabaseClient,
  profile: StudentAcademicProfile,
): Promise<CatalogueCourse[]> {
  const byId = new Map<string, CatalogueCourse>()

  const addRows = (rows: CatalogueCourse[] | null | undefined) => {
    for (const row of rows ?? []) byId.set(row.id, row)
  }

  // 1) Exact programme id
  if (profile.programme_id) {
    const { data } = await supabase
      .from('catalogue_courses')
      .select('*')
      .eq('is_published', true)
      .eq('programme_id', profile.programme_id)
      .limit(40)
    addRows(data as CatalogueCourse[])
  }

  const studyLabel = sanitizeFilterTerm(
    profile.course_of_study?.trim() || profile.custom_programme_name?.trim() || '',
  )

  // 2) Resolve programme(s) by the saved course-of-study name, then take their courses
  if (byId.size === 0 && studyLabel) {
    const { data: programmes } = await supabase
      .from('programmes')
      .select('id, name')
      .ilike('name', `%${studyLabel}%`)
      .limit(20)

    const ranked = ((programmes as { id: string; name: string }[]) ?? [])
      .map((p) => ({ ...p, score: scoreNameMatch(p.name, studyLabel) }))
      .filter((p) => p.score >= 40)
      .sort((a, b) => b.score - a.score)

    const programmeIds = ranked.slice(0, 3).map((p) => p.id)
    if (programmeIds.length) {
      const { data } = await supabase
        .from('catalogue_courses')
        .select('*')
        .eq('is_published', true)
        .in('programme_id', programmeIds)
        .limit(40)
      addRows(data as CatalogueCourse[])
    }
  }

  // 3) Full-phrase title match only (no loose single-token fishing)
  if (studyLabel.length >= 4) {
    const { data } = await supabase
      .from('catalogue_courses')
      .select('*')
      .eq('is_published', true)
      .ilike('title', `%${studyLabel}%`)
      .limit(20)
    const strong = ((data as CatalogueCourse[]) ?? []).filter(
      (c) => scoreNameMatch(c.title, studyLabel) >= 40 || scoreNameMatch(c.code, studyLabel) >= 40,
    )
    addRows(strong.length ? strong : (data as CatalogueCourse[]))
  }

  // Prefer class-level when profile has one
  let list = [...byId.values()]
  if (profile.class_level_id && list.length > 1) {
    const leveled = list.filter(
      (c) => !c.class_level_id || c.class_level_id === profile.class_level_id,
    )
    if (leveled.length) list = leveled
  }

  return list
}

/**
 * Align enrolments with the saved academic profile (replace wrong auto-matched courses).
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

  const intended = await resolveCoursesForProfile(supabase, profile as StudentAcademicProfile)
  const intendedIds = new Set(intended.map((c) => c.id))

  const { data: existing } = await supabase
    .from('student_course_enrolments')
    .select('id, catalogue_course_id')
    .eq('user_id', userId)
    .eq('status', 'active')

  const existingRows = existing ?? []

  // Drop enrolments that do not match the saved academic setup
  for (const en of existingRows) {
    const cid = en.catalogue_course_id as string
    if (!intendedIds.has(cid)) {
      await supabase.from('student_course_enrolments').delete().eq('id', en.id as string)
    }
  }

  const have = new Set(
    existingRows
      .map((e) => e.catalogue_course_id as string)
      .filter((id) => intendedIds.has(id)),
  )

  const enrolled: string[] = [...have]

  for (const c of intended.slice(0, 16)) {
    if (have.has(c.id)) continue
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
        metadata: { source: 'academic_sync_strict' },
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

  const courseOfStudy = p?.course_of_study?.trim() || null

  // Subject for questions MUST follow what the student saved — not a random enrolled course
  const subjectLabel =
    [courseOfStudy, programmeName].filter(Boolean).join(' — ') ||
    programmeName ||
    courseOfStudy ||
    'General Nigerian university studies'

  return {
    profile: p,
    enrolments:
      (enrolments as (StudentCourseEnrolment & { catalogue_courses: CatalogueCourse | null })[]) ??
      [],
    subjectLabel,
    programmeName,
    courseOfStudy,
    institutionName,
    hasAcademicSetup: Boolean(p && (courseOfStudy || programmeName || p.programme_id || p.education_level_id)),
  }
}
