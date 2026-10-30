import type { SupabaseClient } from '@supabase/supabase-js'
import type { QuizQuestion } from '@/types/database'

export type GradeReviewItem = {
  question_id: string
  prompt: string
  your_answer: string
  correct_answer: string
  is_correct: boolean
  explanation: string | null
  topic_label: string | null
}

export type GradeResultPayload = {
  attempt_id: string
  score: number
  max_score: number
  percentage: number
  pass_mark: number
  passed: boolean
  abandoned: boolean
  review: GradeReviewItem[]
  weak_topics: string[]
  revision_href: string
}

function normalize(s: string): string {
  return s.trim().toLowerCase()
}

function isCorrect(correctAnswer: string, given: string): boolean {
  const a = normalize(given)
  const b = normalize(correctAnswer)
  if (!a) return false
  return a === b
}

/** Grade against loaded questions and persist attempt locally when /api/grade-quiz is down. */
export async function gradeQuizClientSide(input: {
  supabase: SupabaseClient
  userId: string
  quizId: string
  questions: QuizQuestion[]
  answers: Record<string, string>
  abandoned: boolean
  startedAt?: string
  passMark?: number
}): Promise<GradeResultPayload> {
  const {
    supabase,
    userId,
    quizId,
    questions,
    answers,
    abandoned,
    startedAt,
    passMark = 50,
  } = input

  let score = 0
  const review: GradeReviewItem[] = questions.map((q) => {
    const given = abandoned ? '' : answers[q.id] ?? ''
    const correct = !abandoned && isCorrect(q.correct_answer ?? '', given)
    if (correct) score += 1
    return {
      question_id: q.id,
      prompt: q.prompt,
      your_answer: given || '(unanswered)',
      correct_answer: q.correct_answer ?? '',
      is_correct: correct,
      explanation: q.explanation,
      topic_label: q.topic_label ?? null,
    }
  })

  const max = questions.length
  const percentage = abandoned || max === 0 ? 0 : Math.round((score / max) * 1000) / 10
  const passed = !abandoned && percentage >= passMark

  let attemptId = `local-${Date.now()}`
  const { data: attempt, error: attErr } = await supabase
    .from('quiz_attempts')
    .insert({
      quiz_id: quizId,
      user_id: userId,
      score: abandoned ? 0 : score,
      max_score: max,
      started_at: startedAt || new Date().toISOString(),
      submitted_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (!attErr && attempt?.id) {
    attemptId = attempt.id as string
    await supabase.from('quiz_answers').insert(
      review.map((r) => ({
        attempt_id: attemptId,
        question_id: r.question_id,
        user_id: userId,
        answer: r.your_answer,
        is_correct: r.is_correct,
      })),
    )
    try {
      await supabase.from('activity_events').insert({
        user_id: userId,
        event_type: abandoned ? 'quiz_abandoned_fail' : 'quiz_submitted',
        quiz_id: quizId,
        attempt_id: attemptId,
        metadata: {
          score: abandoned ? 0 : score,
          max,
          percentage,
          passed,
          abandoned,
          graded_client: true,
        },
      })
    } catch {
      /* optional */
    }
  }

  const weakTopics = [
    ...new Set(
      review.filter((r) => !r.is_correct && r.topic_label).map((r) => r.topic_label as string),
    ),
  ]

  return {
    attempt_id: attemptId,
    score: abandoned ? 0 : score,
    max_score: max,
    percentage,
    pass_mark: passMark,
    passed,
    abandoned,
    review,
    weak_topics: weakTopics,
    revision_href: weakTopics[0]
      ? `/app/exams?topic=${encodeURIComponent(weakTopics[0])}&mode=practice&difficulty=easy`
      : '/app/learning',
  }
}
