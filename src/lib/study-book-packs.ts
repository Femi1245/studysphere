import type { RecommendedStudyBook, StudyBookKind } from '@/types/database'

type PackBook = {
  subject: string
  title: string
  author?: string
  edition?: string
  kind: StudyBookKind
  description?: string
}

type Pack = { match: RegExp; books: PackBook[] }

/** Name-based reading lists when DB rows don't match the student's programme UUID. */
export const STUDY_BOOK_PACKS: Pack[] = [
  {
    match: /english|literary|literature/i,
    books: [
      {
        subject: 'Introduction to Literary Studies',
        title: 'The Norton Introduction to Literature',
        author: 'Mays / Norton',
        edition: 'Latest',
        kind: 'theory',
        description: 'Core genres, close reading, and literary terms for BA English.',
      },
      {
        subject: 'Introduction to Literary Studies',
        title: 'Literary Analysis Practice Workbook',
        author: 'StudySphere Curriculum',
        edition: '2024',
        kind: 'practical',
        description: 'Passage analysis, thesis drills, and short critical responses.',
      },
      {
        subject: 'English Language / Grammar',
        title: 'A University Grammar of English',
        author: 'Quirk & Greenbaum',
        edition: 'Latest',
        kind: 'theory',
        description: 'Grammar and usage for tertiary English students.',
      },
      {
        subject: 'English Language / Grammar',
        title: 'Use of English Practice Pack',
        author: 'StudySphere Curriculum',
        edition: '2024',
        kind: 'practical',
        description: 'Essay, summary, comprehension, and lexis exercises.',
      },
      {
        subject: 'African / Nigerian Literature',
        title: 'African Literature: An Anthology of Criticism and Theory',
        author: 'Olaniyan & Quayson (eds.)',
        edition: 'Latest',
        kind: 'theory',
        description: 'Criticism and contexts for African literary study.',
      },
      {
        subject: 'African / Nigerian Literature',
        title: 'Text Seminar & Character Study Pack',
        author: 'StudySphere Curriculum',
        edition: '2024',
        kind: 'practical',
        description: 'Discussion questions and character/theme worksheets.',
      },
      {
        subject: 'Drama & Poetry',
        title: 'An Introduction to Drama and Poetry',
        author: 'Standard tertiary reader',
        edition: 'Latest',
        kind: 'theory',
        description: 'Forms, devices, and major movements in drama and poetry.',
      },
      {
        subject: 'Drama & Poetry',
        title: 'Scansion & Scene Performance Workbook',
        author: 'StudySphere Curriculum',
        edition: '2024',
        kind: 'practical',
        description: 'Prosody practice and scene annotation tasks.',
      },
    ],
  },
  {
    match: /computer|software|informat/i,
    books: [
      {
        subject: 'Introduction to Computer Science',
        title: 'Computer Science: An Overview',
        author: 'J. Glenn Brookshear',
        kind: 'theory',
      },
      {
        subject: 'Introduction to Computer Science',
        title: 'CSC Lab Workbook — Computing Basics',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
      {
        subject: 'Programming Fundamentals',
        title: 'C How to Program',
        author: 'Deitel & Deitel',
        kind: 'theory',
      },
      {
        subject: 'Programming Fundamentals',
        title: 'Programming Practical Manual',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
      {
        subject: 'Data Structures',
        title: 'Data Structures Using C',
        author: 'Reema Thareja',
        kind: 'theory',
      },
      {
        subject: 'Data Structures',
        title: 'Data Structures Lab Manual',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
    ],
  },
  {
    match: /account/i,
    books: [
      {
        subject: 'Principles of Accounting I',
        title: 'Financial Accounting',
        author: 'Wood & Sangster',
        kind: 'theory',
      },
      {
        subject: 'Principles of Accounting I',
        title: 'Accounting Practical Workbook I',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
      {
        subject: 'Principles of Accounting II',
        title: 'Advanced Financial Accounting',
        author: 'Lewis & Pendrill',
        kind: 'theory',
      },
      {
        subject: 'Principles of Accounting II',
        title: 'Accounting Practical Workbook II',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
    ],
  },
  {
    match: /econom/i,
    books: [
      {
        subject: 'Principles of Economics',
        title: 'Principles of Economics',
        author: 'N. Gregory Mankiw',
        kind: 'theory',
      },
      {
        subject: 'Principles of Economics',
        title: 'Economics Tutorial & Graph Practice',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
    ],
  },
  {
    match: /business|management|admin/i,
    books: [
      {
        subject: 'Introduction to Business',
        title: 'Business: A Changing World',
        author: 'Ferrell et al.',
        kind: 'theory',
      },
      {
        subject: 'Introduction to Business',
        title: 'Business Case Study Workbook',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
    ],
  },
  {
    match: /electr|engineer/i,
    books: [
      {
        subject: 'Engineering Mathematics',
        title: 'Engineering Mathematics',
        author: 'K.A. Stroud',
        kind: 'theory',
      },
      {
        subject: 'Engineering Mathematics',
        title: 'Engineering Maths Practice Book',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
    ],
  },
  {
    match: /mass\s*comm|media|journal/i,
    books: [
      {
        subject: 'Mass Communication',
        title: 'Mass Communication: An Introduction',
        author: 'John Vivian',
        kind: 'theory',
      },
      {
        subject: 'Mass Communication',
        title: 'Media Writing Practice Pack',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
    ],
  },
  {
    match: /\blaw\b|legal/i,
    books: [
      {
        subject: 'Legal Method',
        title: 'Introduction to Nigerian Legal Method',
        author: 'Obilade / standard text',
        kind: 'theory',
      },
      {
        subject: 'Legal Method',
        title: 'Legal Method Case Brief Workbook',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
    ],
  },
  {
    match: /nurs|medicine|medical|health\s*sci/i,
    books: [
      {
        subject: 'Anatomy & Physiology',
        title: 'Ross and Wilson Anatomy and Physiology',
        author: 'Waugh & Grant',
        kind: 'theory',
      },
      {
        subject: 'Anatomy & Physiology',
        title: 'A&P Practical Lab Guide',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
    ],
  },
  {
    match: /education|pedagog/i,
    books: [
      {
        subject: 'Foundations of Education',
        title: 'Philosophy and Sociology of Education',
        author: 'Standard tertiary text',
        kind: 'theory',
      },
      {
        subject: 'Foundations of Education',
        title: 'Micro-Teaching Practice Pack',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
    ],
  },
  {
    match: /chemistr/i,
    books: [
      {
        subject: 'General Chemistry',
        title: 'Chemistry: The Central Science',
        author: 'Brown et al.',
        kind: 'theory',
      },
      {
        subject: 'General Chemistry',
        title: 'Chemistry Practical Manual',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
    ],
  },
  {
    match: /biolog/i,
    books: [
      {
        subject: 'General Biology',
        title: 'Campbell Biology',
        author: 'Urry et al.',
        kind: 'theory',
      },
      {
        subject: 'General Biology',
        title: 'Biology Lab Workbook',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
    ],
  },
  {
    match: /mathemat|statist/i,
    books: [
      {
        subject: 'Foundation Mathematics',
        title: 'Engineering / Pure Mathematics (foundation)',
        author: 'Stroud / standard text',
        kind: 'theory',
      },
      {
        subject: 'Foundation Mathematics',
        title: 'Mathematics Problem Drill Book',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
    ],
  },
  {
    match: /politic|govern/i,
    books: [
      {
        subject: 'Introduction to Political Science',
        title: 'Introduction to Political Science',
        author: 'Standard tertiary text',
        kind: 'theory',
      },
      {
        subject: 'Introduction to Political Science',
        title: 'Politics Case & Debate Pack',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
    ],
  },
  {
    match: /sociolog/i,
    books: [
      {
        subject: 'Introduction to Sociology',
        title: 'Sociology',
        author: 'Giddens / standard text',
        kind: 'theory',
      },
      {
        subject: 'Introduction to Sociology',
        title: 'Sociology Field Observation Pack',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
    ],
  },
  {
    match: /psycholog/i,
    books: [
      {
        subject: 'Introduction to Psychology',
        title: 'Psychology',
        author: 'Ciccarelli / standard text',
        kind: 'theory',
      },
      {
        subject: 'Introduction to Psychology',
        title: 'Psychology Lab & Quiz Pack',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
    ],
  },
  {
    match: /history/i,
    books: [
      {
        subject: 'Introduction to History',
        title: 'The Practice of History',
        author: 'Standard tertiary text',
        kind: 'theory',
      },
      {
        subject: 'Introduction to History',
        title: 'Source Criticism Workbook',
        author: 'StudySphere Curriculum',
        kind: 'practical',
      },
    ],
  },
]

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

export function buildFallbackStudyBooks(programmeLabel: string): RecommendedStudyBook[] {
  const label = programmeLabel.trim()
  if (!label) return []

  const pack = STUDY_BOOK_PACKS.find((p) => p.match.test(label))
  const books = pack?.books
  if (!books?.length) {
    // Generic tertiary pack so the page is never empty when profile is set
    return buildGenericPack(label)
  }

  const now = new Date().toISOString()
  return books.map((b, i) => ({
    id: `fallback-${slug(label)}-${slug(b.title)}-${i}`,
    catalogue_course_id: null,
    programme_id: null,
    curriculum_subject_id: null,
    subject_label: b.subject,
    title: b.title,
    author: b.author ?? null,
    edition: b.edition ?? null,
    book_kind: b.kind,
    description: b.description ?? `Recommended for ${label}`,
    is_published: true,
    order_index: i + 1,
    created_at: now,
    updated_at: now,
  }))
}

function buildGenericPack(label: string): RecommendedStudyBook[] {
  const now = new Date().toISOString()
  const subjects = [
    { subject: `${label} — Core theory`, title: `${label}: Core Textbook`, kind: 'theory' as const },
    {
      subject: `${label} — Core theory`,
      title: `${label} Tutorial & Practice Workbook`,
      kind: 'practical' as const,
    },
    {
      subject: `${label} — Research skills`,
      title: 'Academic Writing & Research Methods',
      kind: 'theory' as const,
    },
    {
      subject: `${label} — Research skills`,
      title: 'Seminar Presentation Practice Pack',
      kind: 'practical' as const,
    },
  ]
  return subjects.map((b, i) => ({
    id: `fallback-${slug(label)}-generic-${i}`,
    catalogue_course_id: null,
    programme_id: null,
    curriculum_subject_id: null,
    subject_label: b.subject,
    title: b.title,
    author: 'StudySphere Curriculum',
    edition: '2024',
    book_kind: b.kind,
    description: `Starter reading list generated from your academic profile: ${label}`,
    is_published: true,
    order_index: i + 1,
    created_at: now,
    updated_at: now,
  }))
}

export function isFallbackBookId(bookId: string): boolean {
  return bookId.startsWith('fallback-')
}

const PROGRESS_KEY = 'ss_fallback_book_progress'

export type LocalBookProgress = {
  book_id: string
  status: 'not_started' | 'in_progress' | 'completed'
  progress_percent: number
  notes: string | null
  started_at: string | null
  completed_at: string | null
  last_studied_at: string
}

export function readLocalBookProgress(
  userId: string,
): Map<string, LocalBookProgress> {
  try {
    const raw = localStorage.getItem(`${PROGRESS_KEY}:${userId}`)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as LocalBookProgress[]
    return new Map(parsed.map((p) => [p.book_id, p]))
  } catch {
    return new Map()
  }
}

export function writeLocalBookProgress(userId: string, row: LocalBookProgress): LocalBookProgress {
  const map = readLocalBookProgress(userId)
  map.set(row.book_id, row)
  localStorage.setItem(`${PROGRESS_KEY}:${userId}`, JSON.stringify([...map.values()]))
  return row
}

export function scoreBookRelevance(
  book: { subject_label?: string | null; title?: string | null },
  needles: string[],
): number {
  const hay = `${book.subject_label ?? ''} ${book.title ?? ''}`.toLowerCase()
  if (!hay.trim()) return 0
  let best = 0
  for (const n of needles) {
    const t = n.trim().toLowerCase()
    if (!t || t.length < 3) continue
    if (hay === t) best = Math.max(best, 100)
    else if (hay.includes(t) || t.includes(hay)) best = Math.max(best, 80)
    else {
      const tokens = t.split(/\s+/).filter((x) => x.length > 3)
      const hits = tokens.filter((tok) => hay.includes(tok)).length
      if (tokens.length) best = Math.max(best, Math.round((hits / tokens.length) * 70))
    }
  }
  return best
}
