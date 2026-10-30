import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Self-contained quiz grading for Vercel (no relative ./lib imports — those break ESM).
 * Never trust client-sent scores; grade from quiz_questions.correct_answer.
 */

type IncomingAnswer = { question_id: string; answer: string }

type GradeQuizBody = {
  quiz_id?: string
  answers?: IncomingAnswer[]
  abandoned?: boolean
  started_at?: string
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

function createUserClient(url: string, anon: string, authHeader: string): SupabaseClient {
  return createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  })
}

async function runGradeQuiz(
  supabase: SupabaseClient,
  userId: string,
  body: GradeQuizBody,
): Promise<{ status: number; json: Record<string, unknown> }> {
  if (!body.quiz_id) return { status: 400, json: { error: 'quiz_id required' } }

  let quizRow: {
    id: string
    pass_mark?: number | null
    catalogue_course_id?: string | null
  } | null = null

  {
    const full = await supabase
      .from('quizzes')
      .select('id, user_id, pass_mark, catalogue_course_id, title')
      .eq('id', body.quiz_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (!full.error && full.data) {
      quizRow = full.data as {
        id: string
        pass_mark?: number | null
        catalogue_course_id?: string | null
      }
    } else {
      const basic = await supabase
        .from('quizzes')
        .select('id, user_id, pass_mark, title')
        .eq('id', body.quiz_id)
        .eq('user_id', userId)
        .maybeSingle()
      if (basic.error || !basic.data) {
        return {
          status: 404,
          json: { error: full.error?.message || basic.error?.message || 'Quiz not found' },
        }
      }
      quizRow = { ...(basic.data as { id: string; pass_mark?: number | null }), catalogue_course_id: null }
    }
  }

  if (!quizRow) return { status: 404, json: { error: 'Quiz not found' } }

  const { data: questions, error: qErr } = await supabase
    .from('quiz_questions')
    .select(
      'id, quiz_id, user_id, question_type, prompt, options, correct_answer, explanation, order_index',
    )
    .eq('quiz_id', body.quiz_id)
    .eq('user_id', userId)
    .order('order_index')

  if (qErr || !questions?.length) {
    return { status: 400, json: { error: qErr?.message || 'No questions for quiz' } }
  }

  const answerMap = new Map((body.answers ?? []).map((a) => [a.question_id, a.answer ?? '']))
  const abandoned = Boolean(body.abandoned)
  let score = 0

  const graded = questions.map((q) => {
    const given = abandoned ? '' : answerMap.get(q.id as string) ?? ''
    const correct = !abandoned && isCorrect(String(q.correct_answer ?? ''), given)
    if (correct) score += 1
    return {
      question_id: q.id as string,
      answer: given || '(unanswered)',
      is_correct: correct,
      prompt: String(q.prompt),
      correct_answer: String(q.correct_answer ?? ''),
      explanation: (q.explanation as string | null) ?? null,
      topic_label: null as string | null,
      source_fingerprint: String(q.prompt).slice(0, 200),
    }
  })

  // Optional topic_label if column exists
  const withTopics = await supabase
    .from('quiz_questions')
    .select('id, topic_label')
    .eq('quiz_id', body.quiz_id)
    .eq('user_id', userId)
  if (!withTopics.error && withTopics.data) {
    const topicById = new Map(
      withTopics.data.map((r) => [r.id as string, (r as { topic_label?: string | null }).topic_label ?? null]),
    )
    for (const g of graded) {
      g.topic_label = topicById.get(g.question_id) ?? null
    }
  }

  const max = questions.length
  const percentage = abandoned ? 0 : Math.round((score / max) * 1000) / 10
  const passMark = Number(quizRow.pass_mark ?? 50)
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

  // Best-effort side tables — never fail the graded response
  try {
    await supabase.from('quiz_question_usage').insert(
      graded.map((g) => ({
        user_id: userId,
        catalogue_course_id: quizRow.catalogue_course_id ?? null,
        bank_question_id: null,
        source_fingerprint: g.source_fingerprint,
        attempt_id: attempt.id,
      })),
    )
  } catch {
    /* optional */
  }

  try {
    await supabase.from('activity_events').insert({
      user_id: userId,
      event_type: abandoned ? 'quiz_abandoned_fail' : 'quiz_submitted',
      quiz_id: body.quiz_id,
      attempt_id: attempt.id,
      catalogue_course_id: quizRow.catalogue_course_id ?? null,
      metadata: {
        score: abandoned ? 0 : score,
        max,
        percentage,
        passed,
        abandoned,
        graded_server: true,
      },
    })
  } catch {
    /* optional */
  }

  const review = graded.map((g) => ({
    question_id: g.question_id,
    prompt: g.prompt,
    your_answer: g.answer,
    correct_answer: g.correct_answer,
    is_correct: g.is_correct,
    explanation: g.explanation,
    topic_label: g.topic_label,
  }))

  const weakTopics = [
    ...new Set(
      review.filter((r) => !r.is_correct && r.topic_label).map((r) => r.topic_label as string),
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    if (!url || !anon) {
      return res.status(503).json({ error: 'Supabase not configured on server' })
    }

    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Sign in required' })
    }

    const supabase = createUserClient(url, anon, auth)
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) return res.status(401).json({ error: 'Unauthorized' })

    const body = (req.body ?? {}) as GradeQuizBody
    const result = await runGradeQuiz(supabase, user.id, body)
    return res.status(result.status).json(result.json)
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'Grading failed',
    })
  }
}
