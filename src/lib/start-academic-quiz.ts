import type { SupabaseClient } from '@supabase/supabase-js'
import type { QuizMode, QuestionDifficulty } from '@/types/database'

export type GenQuestion = {
  question_type: 'multiple_choice' | 'true_false' | 'short_answer'
  prompt: string
  options: string[] | null
  correct_answer: string
  explanation: string | null
  topic_label?: string | null
  bank_question_id?: string | null
}

export function fingerprintPrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200)
}

export function parseQuestionOptions(raw: unknown): string[] | null {
  if (Array.isArray(raw)) return raw.map(String)
  if (raw && typeof raw === 'object') return Object.values(raw as Record<string, string>)
  return null
}

export function shuffleItems<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/**
 * Generate quiz questions from the academic subject label via /api/generate-quiz.
 */
export async function generateQuestionsForSubject(input: {
  accessToken: string
  subject: string
  need: number
  difficulty: QuestionDifficulty | 'all'
  topicFilter?: string
}): Promise<{ questions: GenQuestion[]; error?: string }> {
  const { accessToken, subject, need, difficulty, topicFilter } = input
  if (need <= 0) return { questions: [] }

  const out: GenQuestion[] = []
  let remaining = need
  let lastError = ''

  while (remaining > 0) {
    const batch = Math.min(remaining, 15)
    const courseLabel = [subject, topicFilter].filter(Boolean).join(' — ')
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          count: batch,
          course: courseLabel,
          difficulty: difficulty === 'all' ? 'medium' : difficulty,
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string }
        lastError = err.error || err.detail || `Generate failed (${res.status})`
        // Retry once with a smaller batch if provider choked on size
        if (batch > 5) {
          remaining = Math.min(remaining, 5)
          continue
        }
        break
      }
      const data = (await res.json()) as { questions?: GenQuestion[] }
      const chunk = (data.questions ?? []).map((q) => ({
        ...q,
        topic_label: topicFilter || q.topic_label || subject,
        bank_question_id: null as string | null,
      }))
      if (!chunk.length) {
        lastError = 'AI returned no questions'
        break
      }
      out.push(...chunk)
      remaining -= chunk.length
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Network error while generating questions'
      break
    }
  }

  // Deduplicate
  const seen = new Set<string>()
  const unique = out.filter((q) => {
    const k = fingerprintPrompt(q.prompt || '')
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })

  return {
    questions: unique.slice(0, need),
    error: unique.length < need ? lastError || undefined : undefined,
  }
}

export async function createQuizAttempt(input: {
  supabase: SupabaseClient
  userId: string
  title: string
  description: string
  catalogueCourseId: string | null
  bankId: string | null
  difficulty: QuestionDifficulty | 'all'
  passMark: number
  mode: QuizMode
  durationMinutes: number
  questions: GenQuestion[]
  topicFilter?: string
}): Promise<{ quizId: string } | { error: string }> {
  const {
    supabase,
    userId,
    title,
    description,
    catalogueCourseId,
    bankId,
    difficulty,
    passMark,
    mode,
    durationMinutes,
    questions,
    topicFilter,
  } = input

  const { data: quiz, error: quizErr } = await supabase
    .from('quizzes')
    .insert({
      user_id: userId,
      title,
      description,
      catalogue_course_id: catalogueCourseId,
      bank_id: bankId || null,
      difficulty: difficulty === 'all' ? null : difficulty,
      pass_mark: passMark,
      mode,
      question_count: questions.length,
      is_timed: mode === 'assessment',
      randomized: true,
      duration_minutes: durationMinutes,
    })
    .select('id')
    .single()

  if (quizErr || !quiz) {
    return { error: quizErr?.message || 'Could not create quiz' }
  }

  const rows = questions.map((q, i) => ({
    quiz_id: quiz.id,
    user_id: userId,
    question_type: q.question_type || 'multiple_choice',
    prompt: q.prompt,
    options: q.options,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    order_index: i,
    topic_label: q.topic_label ?? (topicFilter || null),
    bank_question_id: q.bank_question_id ?? null,
    source_fingerprint: fingerprintPrompt(q.prompt),
  }))

  const { error: qErr } = await supabase.from('quiz_questions').insert(rows)
  if (qErr) {
    await supabase.from('quizzes').delete().eq('id', quiz.id)
    return { error: qErr.message }
  }

  return { quizId: quiz.id as string }
}
