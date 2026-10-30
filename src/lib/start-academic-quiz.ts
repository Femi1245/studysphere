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
 * Always tries to return enough questions (API fallback, then local fallback).
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
  const diff = difficulty === 'all' ? 'medium' : difficulty

  const seen = new Set<string>()
  let unique: GenQuestion[] = []
  let rounds = 0

  while (unique.length < need && rounds < 6) {
    rounds += 1
    const batch = Math.min(need - unique.length, 10)
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
          difficulty: diff,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        questions?: GenQuestion[]
        error?: string
        detail?: string
        warning?: string
        fallback?: boolean
      }
      if (!res.ok) {
        lastError = data.error || data.detail || `Generate failed (${res.status})`
        break
      }
      const chunk = (data.questions ?? []).map((q) => ({
        ...q,
        topic_label: topicFilter || q.topic_label || subject,
        bank_question_id: null as string | null,
      }))
      if (!chunk.length) {
        lastError = data.warning || data.error || 'AI returned no questions'
        break
      }
      // Ignore AI warnings once we have usable questions; never block exam start
      if (data.warning && !data.fallback) lastError = data.warning
      let added = 0
      for (const q of chunk) {
        const k = fingerprintPrompt(q.prompt || '')
        if (!k || seen.has(k)) continue
        seen.add(k)
        unique.push(q)
        added += 1
        if (unique.length >= need) break
      }
      if (added === 0) {
        // Same questions repeated — stop calling API and use local fill
        break
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Network error while generating questions'
      break
    }
  }

  if (unique.length < need) {
    // Force unique local items with index in fingerprint
    for (let i = unique.length; i < need; i += 1) {
      const options = [
        `Key idea ${i + 1}A about ${subject}`,
        `Key idea ${i + 1}B about ${subject}`,
        `Key idea ${i + 1}C about ${subject}`,
        `Key idea ${i + 1}D about ${subject}`,
      ]
      const prompt = `#${i + 1} (${diff}) ${subject}${topicFilter ? ` / ${topicFilter}` : ''}: pick the best foundational revision point.`
      const k = fingerprintPrompt(prompt)
      if (seen.has(k)) continue
      seen.add(k)
      unique.push({
        question_type: 'multiple_choice',
        prompt,
        options,
        correct_answer: options[i % 4]!,
        explanation:
          'Local practice fallback — AI model unavailable or returned duplicates. Retry later for richer questions.',
        topic_label: topicFilter || subject,
        bank_question_id: null,
      })
    }
  }

  return {
    questions: unique.slice(0, need),
    // Only surface error if we still could not reach the requested count
    error: unique.length < need ? lastError || 'Could not build enough questions' : undefined,
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
