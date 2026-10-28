import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type IncomingAnswer = { question_id: string; answer: string }

export type GradeQuizBody = {
  quiz_id?: string
  answers?: IncomingAnswer[]
  abandoned?: boolean
  started_at?: string
}

export type GradeQuizSuccess = {
  attempt_id: string
  score: number
  max_score: number
  percentage: number
  pass_mark: number
  passed: boolean
  abandoned: boolean
  review: Array<{
    question_id: string
    prompt: string
    your_answer: string
    correct_answer: string
    is_correct: boolean
    explanation: string | null
    topic_label: string | null
  }>
  weak_topics: string[]
  revision_href: string
}

function normalize(s: string): string {
  return s.trim().toLowerCase()
}

function isCorrect(questionType: string, correctAnswer: string, given: string): boolean {
  const a = normalize(given)
  const b = normalize(correctAnswer)
  if (!a) return false
  if (questionType === 'short_answer') return a === b
  return a === b
}

export function createUserClient(url: string, anon: string, authHeader: string): SupabaseClient {
  return createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  })
}

/**
 * Authoritative quiz grading. Never trust client-sent scores.
 */
export async function runGradeQuiz(
  supabase: SupabaseClient,
  userId: string,
  body: GradeQuizBody,
): Promise<{ status: number; json: GradeQuizSuccess | { error: string } }> {
  if (!body.quiz_id) return { status: 400, json: { error: 'quiz_id required' } }

  const { data: quiz, error: quizErr } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', body.quiz_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (quizErr || !quiz) return { status: 404, json: { error: 'Quiz not found' } }

  const { data: questions, error: qErr } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('quiz_id', body.quiz_id)
    .eq('user_id', userId)
    .order('order_index')

  if (qErr || !questions?.length) {
    return { status: 400, json: { error: 'No questions for quiz' } }
  }

  const answerMap = new Map((body.answers ?? []).map((a) => [a.question_id, a.answer ?? '']))

  const abandoned = Boolean(body.abandoned)
  let score = 0
  const graded = questions.map((q) => {
    const given = abandoned ? '' : answerMap.get(q.id as string) ?? ''
    const correct =
      !abandoned &&
      isCorrect(String(q.question_type), String(q.correct_answer), given)
    if (correct) score += 1
    return {
      question_id: q.id as string,
      user_id: userId,
      answer: given || '(unanswered)',
      is_correct: correct,
      bank_question_id: (q as { bank_question_id?: string | null }).bank_question_id ?? null,
      source_fingerprint:
        (q as { source_fingerprint?: string | null }).source_fingerprint ??
        String(q.prompt).slice(0, 200),
      topic_label: (q as { topic_label?: string | null }).topic_label ?? null,
    }
  })

  const max = questions.length
  const percentage = abandoned ? 0 : Math.round((score / max) * 1000) / 10
  const passMark = Number(quiz.pass_mark ?? 50)
  const passed = !abandoned && percentage >= passMark

  const { data: attempt, error: attErr } = await supabase
    .from('quiz_attempts')
    .insert({
      quiz_id: body.quiz_id,
      user_id: userId,
      score: abandoned ? 0 : score,
      max_score: max,
      started_at: body.started_at || new Date().toISOString(),
      submitted_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (attErr || !attempt) {
    return { status: 500, json: { error: attErr?.message || 'Could not save attempt' } }
  }

  const { error: ansErr } = await supabase.from('quiz_answers').insert(
    graded.map((g) => ({
      attempt_id: attempt.id,
      question_id: g.question_id,
      user_id: userId,
      answer: g.answer,
      is_correct: g.is_correct,
    })),
  )
  if (ansErr) {
    return { status: 500, json: { error: ansErr.message } }
  }

  await supabase.from('quiz_question_usage').insert(
    graded.map((g) => ({
      user_id: userId,
      catalogue_course_id: quiz.catalogue_course_id ?? null,
      bank_question_id: g.bank_question_id,
      source_fingerprint: g.source_fingerprint,
      attempt_id: attempt.id,
    })),
  )

  await supabase.from('activity_events').insert({
    user_id: userId,
    event_type: abandoned ? 'quiz_abandoned_fail' : 'quiz_submitted',
    quiz_id: body.quiz_id,
    attempt_id: attempt.id,
    catalogue_course_id: quiz.catalogue_course_id ?? null,
    metadata: {
      score: abandoned ? 0 : score,
      max,
      percentage,
      passed,
      abandoned,
      graded_server: true,
    },
  })

  const review = questions.map((q) => {
    const g = graded.find((x) => x.question_id === q.id)
    return {
      question_id: q.id as string,
      prompt: String(q.prompt),
      your_answer: g?.answer ?? '',
      correct_answer: String(q.correct_answer),
      is_correct: g?.is_correct ?? false,
      explanation: (q.explanation as string | null) ?? null,
      topic_label: (q as { topic_label?: string | null }).topic_label ?? null,
    }
  })

  const weakTopics = [
    ...new Set(
      review
        .filter((r) => !r.is_correct && r.topic_label)
        .map((r) => r.topic_label as string),
    ),
  ]

  return {
    status: 200,
    json: {
      attempt_id: attempt.id,
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
    },
  }
}
