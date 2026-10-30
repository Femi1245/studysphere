import type { SupabaseClient } from '@supabase/supabase-js'
import { logActivity } from '@/lib/activity'
import { subjectColors } from '@/config/brand'
import { syncEnrolmentsFromAcademicProfile } from '@/lib/academic-sync'
import {
  buildFallbackStudyBooks,
  isFallbackBookId,
  readLocalBookProgress,
  scoreBookRelevance,
  writeLocalBookProgress,
} from '@/lib/study-book-packs'
import type {
  CatalogueCourse,
  CurriculumSubject,
  RecommendedStudyBook,
  StudentAcademicProfile,
  StudentBookProgress,
  StudyBookStatus,
  Subject,
} from '@/types/database'

/** Fallback subject packs when curriculum_subjects table is empty / not migrated yet */
const FALLBACK_PACKS: { match: RegExp; subjects: { name: string; code?: string; goal?: string }[] }[] =
  [
    {
      match: /computer|software|informat/i,
      subjects: [
        { name: 'Introduction to Computer Science', code: 'CSC101' },
        { name: 'Programming Fundamentals', code: 'CSC102' },
        { name: 'Data Structures', code: 'CSC201' },
        { name: 'Discrete Mathematics', code: 'CSC202' },
        { name: 'Computer Architecture', code: 'CSC203' },
        { name: 'Database Systems', code: 'CSC301' },
      ],
    },
    {
      match: /account/i,
      subjects: [
        { name: 'Principles of Accounting I', code: 'ACC101' },
        { name: 'Principles of Accounting II', code: 'ACC102' },
        { name: 'Cost Accounting', code: 'ACC201' },
        { name: 'Financial Accounting', code: 'ACC202' },
      ],
    },
    {
      match: /econom/i,
      subjects: [
        { name: 'Principles of Economics I', code: 'ECO101' },
        { name: 'Principles of Economics II', code: 'ECO102' },
        { name: 'Mathematics for Economists', code: 'ECO201' },
      ],
    },
    {
      match: /business|management|admin/i,
      subjects: [
        { name: 'Introduction to Business', code: 'BUS101' },
        { name: 'Principles of Management', code: 'BUS102' },
        { name: 'Business Communication', code: 'BUS201' },
      ],
    },
    {
      match: /electr|engineer/i,
      subjects: [
        { name: 'Engineering Mathematics I', code: 'EEE101' },
        { name: 'Basic Electrical Engineering', code: 'EEE102' },
        { name: 'Engineering Drawing', code: 'EEE103' },
      ],
    },
    {
      match: /mass\s*comm|media|journal/i,
      subjects: [
        { name: 'Introduction to Mass Communication', code: 'MAC101' },
        { name: 'Writing for the Mass Media', code: 'MAC102' },
      ],
    },
    {
      match: /\blaw\b|legal/i,
      subjects: [
        { name: 'Legal Method', code: 'LAW101' },
        { name: 'Nigerian Legal System', code: 'LAW102' },
      ],
    },
    {
      match: /english|literary|literature/i,
      subjects: [
        { name: 'Introduction to Literary Studies', code: 'ENG101' },
        { name: 'English Language Skills', code: 'ENG102' },
        { name: 'African Literature', code: 'ENG201' },
        { name: 'Drama and Poetry', code: 'ENG202' },
        { name: 'Prose Fiction', code: 'ENG203' },
      ],
    },
  ]

export type StudyBookWithProgress = RecommendedStudyBook & {
  progress: StudentBookProgress | null
  course: CatalogueCourse | null
}

export type StudyCurriculumBundle = {
  subjects: Subject[]
  curriculumSubjects: CurriculumSubject[]
  books: StudyBookWithProgress[]
  theoryCount: number
  practicalCount: number
  completedCount: number
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

async function resolveProgrammeName(
  supabase: SupabaseClient,
  profile: StudentAcademicProfile | null,
): Promise<string> {
  if (!profile) return ''
  if (profile.course_of_study?.trim()) return profile.course_of_study.trim()
  if (profile.custom_programme_name?.trim()) return profile.custom_programme_name.trim()
  if (profile.programme_id) {
    const { data } = await supabase
      .from('programmes')
      .select('name')
      .eq('id', profile.programme_id)
      .maybeSingle()
    return (data?.name as string | undefined) ?? ''
  }
  return ''
}

/**
 * Create / refresh user subjects from curriculum for the academic profile.
 */
export async function syncSubjectsFromAcademicProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Subject[]> {
  await syncEnrolmentsFromAcademicProfile(supabase, userId)

  const [{ data: profile }, { data: existingSubjects }, { data: enrolments }] = await Promise.all([
    supabase.from('student_academic_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('subjects').select('*').eq('user_id', userId),
    supabase
      .from('student_course_enrolments')
      .select('catalogue_course_id, catalogue_courses(id, code, title, programme_id)')
      .eq('user_id', userId)
      .eq('status', 'active'),
  ])

  const p = profile as StudentAcademicProfile | null
  const have = new Map(
    ((existingSubjects as Subject[]) ?? []).map((s) => [normalizeName(s.name), s]),
  )

  const toCreate: { name: string; goal: string | null; color: string }[] = []
  const pushSubject = (name: string, goal?: string | null) => {
    const key = normalizeName(name)
    if (!key || have.has(key)) return
    if (toCreate.some((c) => normalizeName(c.name) === key)) return
    toCreate.push({
      name,
      goal: goal ?? null,
      color: subjectColors[toCreate.length % subjectColors.length]!,
    })
  }

  let curriculum: CurriculumSubject[] = []
  if (p?.programme_id) {
    const { data } = await supabase
      .from('curriculum_subjects')
      .select('*')
      .eq('is_published', true)
      .eq('programme_id', p.programme_id)
      .order('order_index')
    curriculum = (data as CurriculumSubject[]) ?? []
  }

  if (curriculum.length === 0) {
    const courseIds = (enrolments ?? [])
      .map((e) => e.catalogue_course_id as string)
      .filter(Boolean)
    if (courseIds.length) {
      const { data } = await supabase
        .from('curriculum_subjects')
        .select('*')
        .eq('is_published', true)
        .in('catalogue_course_id', courseIds)
        .order('order_index')
      curriculum = (data as CurriculumSubject[]) ?? []
    }
  }

  for (const c of curriculum) {
    pushSubject(c.code ? `${c.code} — ${c.name}` : c.name, c.description)
  }

  // Also mirror enrolled catalogue courses as subjects
  for (const row of enrolments ?? []) {
    const course = (
      row as {
        catalogue_courses?: { code?: string; title?: string } | { code?: string; title?: string }[] | null
      }
    ).catalogue_courses
    const c = Array.isArray(course) ? course[0] : course
    if (!c?.title) continue
    pushSubject(c.code ? `${c.code} — ${c.title}` : c.title, 'From your academic course enrolment')
  }

  // Fallback packs by course of study / programme name
  if (toCreate.length === 0) {
    const label = await resolveProgrammeName(supabase, p)
    for (const pack of FALLBACK_PACKS) {
      if (!pack.match.test(label)) continue
      for (const s of pack.subjects) {
        pushSubject(s.code ? `${s.code} — ${s.name}` : s.name, s.goal ?? `Related to ${label}`)
      }
      break
    }
  }

  for (const row of toCreate) {
    const { data, error } = await supabase
      .from('subjects')
      .insert({
        user_id: userId,
        name: row.name,
        color: row.color,
        goal: row.goal,
        icon: null,
      })
      .select('*')
      .single()
    if (!error && data) {
      have.set(normalizeName(row.name), data as Subject)
      void logActivity(supabase, {
        userId,
        eventType: 'subject_synced',
        subjectId: (data as Subject).id,
        metadata: { source: 'academic_curriculum' },
      })
    }
  }

  return [...have.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export async function loadStudyBooksForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<StudyBookWithProgress[]> {
  await syncEnrolmentsFromAcademicProfile(supabase, userId)

  const [{ data: profile }, { data: enrolments }] = await Promise.all([
    supabase.from('student_academic_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('student_course_enrolments')
      .select('catalogue_course_id, catalogue_courses(id, code, title)')
      .eq('user_id', userId)
      .eq('status', 'active'),
  ])

  const p = profile as StudentAcademicProfile | null
  const courseIds = [...new Set((enrolments ?? []).map((e) => e.catalogue_course_id as string))]
  const programmeId = p?.programme_id ?? null
  const programmeLabel = await resolveProgrammeName(supabase, p)

  const courseTitles = (enrolments ?? [])
    .map((row) => {
      const c = (
        row as {
          catalogue_courses?: { title?: string; code?: string } | { title?: string; code?: string }[] | null
        }
      ).catalogue_courses
      const course = Array.isArray(c) ? c[0] : c
      return [course?.title, course?.code].filter(Boolean).join(' ')
    })
    .filter(Boolean)

  const needles = [programmeLabel, p?.course_of_study ?? '', ...courseTitles].filter(
    (s) => s && s.trim().length >= 3,
  ) as string[]

  let books: RecommendedStudyBook[] = []
  const seen = new Set<string>()
  const pushBooks = (rows: RecommendedStudyBook[] | null | undefined) => {
    for (const b of rows ?? []) {
      if (seen.has(b.id)) continue
      seen.add(b.id)
      books.push(b)
    }
  }

  if (courseIds.length) {
    const { data } = await supabase
      .from('recommended_study_books')
      .select('*')
      .eq('is_published', true)
      .in('catalogue_course_id', courseIds)
      .order('order_index')
    pushBooks(data as RecommendedStudyBook[])
  }

  if (programmeId) {
    const { data } = await supabase
      .from('recommended_study_books')
      .select('*')
      .eq('is_published', true)
      .eq('programme_id', programmeId)
      .order('order_index')
    pushBooks(data as RecommendedStudyBook[])
  }

  // Name-based match: catalogue UUIDs often differ from seeded curriculum programmes
  if (books.length === 0 && needles.length) {
    const { data, error } = await supabase
      .from('recommended_study_books')
      .select('*')
      .eq('is_published', true)
      .order('order_index')
      .limit(400)

    if (!error && data?.length) {
      const ranked = (data as RecommendedStudyBook[])
        .map((b) => ({ b, score: scoreBookRelevance(b, needles) }))
        .filter((x) => x.score >= 40)
        .sort((a, b) => b.score - a.score || a.b.order_index - b.b.order_index)
      pushBooks(ranked.map((x) => x.b))
    }
  }

  // Always ensure a reading list when academic profile is set
  if (books.length === 0 && programmeLabel) {
    pushBooks(buildFallbackStudyBooks(programmeLabel))
  }

  if (books.length === 0) return []

  const dbBookIds = books.filter((b) => !isFallbackBookId(b.id)).map((b) => b.id)
  const courseIdSet = [
    ...new Set(books.map((b) => b.catalogue_course_id).filter(Boolean) as string[]),
  ]
  const localProgress = readLocalBookProgress(userId)

  const [{ data: progressRows }, { data: courses }] = await Promise.all([
    dbBookIds.length
      ? supabase.from('student_book_progress').select('*').eq('user_id', userId).in('book_id', dbBookIds)
      : Promise.resolve({ data: [] as StudentBookProgress[] }),
    courseIdSet.length
      ? supabase.from('catalogue_courses').select('*').in('id', courseIdSet)
      : Promise.resolve({ data: [] as CatalogueCourse[] }),
  ])

  const progressByBook = new Map(
    ((progressRows as StudentBookProgress[]) ?? []).map((row) => [row.book_id, row]),
  )
  const courseById = new Map(((courses as CatalogueCourse[]) ?? []).map((c) => [c.id, c]))

  return books.map((b) => {
    let progress: StudentBookProgress | null = progressByBook.get(b.id) ?? null
    if (!progress && isFallbackBookId(b.id)) {
      const local = localProgress.get(b.id)
      if (local) {
        progress = {
          id: `local-${b.id}`,
          user_id: userId,
          book_id: b.id,
          status: local.status,
          progress_percent: local.progress_percent,
          notes: local.notes,
          started_at: local.started_at,
          completed_at: local.completed_at,
          last_studied_at: local.last_studied_at,
          created_at: local.last_studied_at,
          updated_at: local.last_studied_at,
        }
      }
    }
    return {
      ...b,
      progress,
      course: b.catalogue_course_id ? courseById.get(b.catalogue_course_id) ?? null : null,
    }
  })
}

export async function loadStudyCurriculumBundle(
  supabase: SupabaseClient,
  userId: string,
): Promise<StudyCurriculumBundle> {
  const subjects = await syncSubjectsFromAcademicProfile(supabase, userId)
  const books = await loadStudyBooksForUser(supabase, userId)

  const { data: profile } = await supabase
    .from('student_academic_profiles')
    .select('programme_id')
    .eq('user_id', userId)
    .maybeSingle()

  let curriculumSubjects: CurriculumSubject[] = []
  if (profile?.programme_id) {
    const { data } = await supabase
      .from('curriculum_subjects')
      .select('*')
      .eq('is_published', true)
      .eq('programme_id', profile.programme_id as string)
      .order('order_index')
    curriculumSubjects = (data as CurriculumSubject[]) ?? []
  }

  return {
    subjects,
    curriculumSubjects,
    books,
    theoryCount: books.filter((b) => b.book_kind === 'theory').length,
    practicalCount: books.filter((b) => b.book_kind === 'practical').length,
    completedCount: books.filter((b) => b.progress?.status === 'completed').length,
  }
}

export async function upsertBookProgress(
  supabase: SupabaseClient,
  userId: string,
  bookId: string,
  patch: {
    status?: StudyBookStatus
    progress_percent?: number
    notes?: string | null
  },
): Promise<StudentBookProgress | null> {
  const now = new Date().toISOString()
  const status = patch.status
  const progress =
    patch.progress_percent ??
    (status === 'completed' ? 100 : status === 'not_started' ? 0 : undefined)

  // Curriculum fallback books are client-side — persist progress locally
  if (isFallbackBookId(bookId)) {
    const existing = readLocalBookProgress(userId).get(bookId)
    const nextStatus = status ?? existing?.status ?? 'not_started'
    const nextPercent =
      progress ??
      existing?.progress_percent ??
      (nextStatus === 'completed' ? 100 : nextStatus === 'not_started' ? 0 : 10)
    const local = writeLocalBookProgress(userId, {
      book_id: bookId,
      status: nextStatus,
      progress_percent: nextPercent,
      notes: patch.notes !== undefined ? patch.notes : (existing?.notes ?? null),
      started_at:
        nextStatus === 'in_progress'
          ? existing?.started_at ?? now
          : nextStatus === 'not_started'
            ? null
            : existing?.started_at ?? null,
      completed_at: nextStatus === 'completed' ? now : null,
      last_studied_at: now,
    })
    void logActivity(supabase, {
      userId,
      eventType: 'book_progress_updated',
      metadata: { bookId, status: nextStatus, progress_percent: nextPercent, fallback: true },
    })
    return {
      id: `local-${bookId}`,
      user_id: userId,
      book_id: bookId,
      status: local.status,
      progress_percent: local.progress_percent,
      notes: local.notes,
      started_at: local.started_at,
      completed_at: local.completed_at,
      last_studied_at: local.last_studied_at,
      created_at: local.last_studied_at,
      updated_at: local.last_studied_at,
    }
  }

  const payload: Record<string, unknown> = {
    user_id: userId,
    book_id: bookId,
    last_studied_at: now,
  }
  if (status) payload.status = status
  if (progress !== undefined) payload.progress_percent = progress
  if (patch.notes !== undefined) payload.notes = patch.notes
  if (status === 'in_progress') payload.started_at = now
  if (status === 'completed') {
    payload.completed_at = now
    payload.progress_percent = 100
  }
  if (status === 'not_started') {
    payload.completed_at = null
    payload.progress_percent = 0
  }

  const { data, error } = await supabase
    .from('student_book_progress')
    .upsert(payload, { onConflict: 'user_id,book_id' })
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  void logActivity(supabase, {
    userId,
    eventType: 'book_progress_updated',
    metadata: { bookId, status: status ?? null, progress_percent: progress ?? null },
  })

  return data as StudentBookProgress
}
