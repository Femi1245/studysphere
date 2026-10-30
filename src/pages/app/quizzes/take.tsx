import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/toast'
import { useActiveQuiz } from '@/contexts/active-quiz-context'
import { useAuth } from '@/contexts/auth-context'
import { regenerateRecommendations } from '@/lib/learning-engine'
import { parseQuestionOptions } from '@/lib/start-academic-quiz'
import { formatSeconds } from '@/lib/utils'
import { trySupabase } from '@/lib/supabase/client'
import type { Quiz, QuizQuestion } from '@/types/database'

type GradeResult = {
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

function normalizeQuestion(row: QuizQuestion): QuizQuestion {
  return {
    ...row,
    options: parseQuestionOptions(row.options),
  }
}

export function QuizTakePage() {
  const { id } = useParams<{ id: string }>()
  const { user, session } = useAuth()
  const { active, clearSession } = useActiveQuiz()
  const { toast } = useToast()
  const navigate = useNavigate()
  const supabase = trySupabase()

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [result, setResult] = useState<GradeResult | null>(null)

  const submittingRef = useRef(false)
  const finishedRef = useRef(false)
  const answersRef = useRef(answers)
  answersRef.current = answers

  const endsAt = active?.endsAt ? new Date(active.endsAt).getTime() : 0
  const sessionActive = Boolean(active && active.quizId === id)

  const load = useCallback(async () => {
    if (!supabase || !user || !id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    const [quizRes, questionsRes] = await Promise.all([
      supabase.from('quizzes').select('*').eq('id', id).eq('user_id', user.id).maybeSingle(),
      supabase
        .from('quiz_questions')
        .select('id, quiz_id, user_id, question_type, prompt, options, correct_answer, explanation, order_index')
        .eq('quiz_id', id)
        .order('order_index'),
    ])

    if (quizRes.error) {
      setLoadError(quizRes.error.message)
      setQuiz(null)
      setQuestions([])
      setLoading(false)
      return
    }
    if (questionsRes.error) {
      setLoadError(questionsRes.error.message)
      setQuiz((quizRes.data as Quiz | null) ?? null)
      setQuestions([])
      setLoading(false)
      return
    }

    setQuiz((quizRes.data as Quiz | null) ?? null)
    setQuestions(((questionsRes.data as QuizQuestion[]) ?? []).map(normalizeQuestion))
    setLoading(false)
  }, [supabase, user, id])

  useEffect(() => {
    void load()
  }, [load])

  const finalize = useCallback(
    async (abandoned: boolean) => {
      if (!user || !id || !session?.access_token || submittingRef.current || finishedRef.current) {
        return
      }
      submittingRef.current = true
      finishedRef.current = true
      setSubmitting(true)

      try {
        const currentAnswers = answersRef.current
        const res = await fetch('/api/grade-quiz', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quiz_id: id,
            abandoned,
            started_at: active?.startedAt,
            answers: Object.entries(currentAnswers).map(([question_id, answer]) => ({
              question_id,
              answer,
            })),
          }),
        })
        const data = (await res.json()) as GradeResult & { error?: string }
        if (!res.ok) {
          throw new Error(data.error || 'Grading failed')
        }
        clearSession()
        setResult(data)
        if (supabase) {
          void regenerateRecommendations(supabase, user.id)
        }
        if (abandoned) {
          toast({
            title: 'Quiz failed',
            description: 'Leaving the exam recorded this attempt as FAIL.',
            kind: 'error',
          })
        }
      } catch (e) {
        finishedRef.current = false
        toast({
          title: 'Submit failed',
          description: e instanceof Error ? e.message : 'Unknown error',
          kind: 'error',
        })
      } finally {
        setSubmitting(false)
        submittingRef.current = false
      }
    },
    [user, id, session, active, clearSession, supabase, toast],
  )

  useEffect(() => {
    if (!endsAt || result || !sessionActive) return
    const tick = () => {
      const left = Math.max(0, Math.floor((endsAt - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left <= 0 && !finishedRef.current) {
        void finalize(false)
      }
    }
    tick()
    const t = window.setInterval(tick, 1000)
    return () => window.clearInterval(t)
  }, [endsAt, result, sessionActive, finalize])

  // BrowserRouter does not support useBlocker — guard leave with history + unload instead
  useEffect(() => {
    if (result || !sessionActive) return

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const onPageHide = () => {
      if (!finishedRef.current) void finalize(true)
    }
    const onPopState = () => {
      if (finishedRef.current) return
      const leave = window.confirm('Leaving this quiz will FAIL your attempt. Continue?')
      if (leave) {
        void finalize(true)
      } else {
        window.history.pushState(null, '', window.location.href)
      }
    }

    window.history.pushState(null, '', window.location.href)
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('popstate', onPopState)
    }
  }, [sessionActive, result, finalize])

  const current = questions[index]
  const options = current ? parseQuestionOptions(current.options) : null
  const progressLabel = useMemo(
    () => `${Math.min(index + 1, Math.max(questions.length, 1))} / ${questions.length}`,
    [index, questions.length],
  )

  if (loading) return <Skeleton className="h-96 rounded-2xl" />

  if (loadError) {
    return (
      <Card className="rounded-2xl p-6">
        <p className="font-medium">Could not load exam</p>
        <p className="mt-2 text-sm text-ink-muted">{loadError}</p>
        <Button className="mt-4" onClick={() => void load()}>
          Retry
        </Button>
      </Card>
    )
  }

  if (!quiz) {
    return (
      <Card className="rounded-2xl p-6">
        <p>Quiz not found.</p>
        <Button className="mt-4" onClick={() => navigate('/app/exams')}>
          Examination centre
        </Button>
      </Card>
    )
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display text-2xl">
              {result.abandoned ? 'FAIL — Left exam' : result.passed ? 'PASS' : 'FAIL'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              Score: {result.score}/{result.max_score} ({result.percentage}%) · Pass mark{' '}
              {result.pass_mark}%
            </p>
            <p className="text-xs text-ink-muted">Graded on the server. This attempt is saved permanently.</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to={result.revision_href || '/app/learning'}>Revision recommendations</Link>
              </Button>
              <Button variant="outline" onClick={() => navigate('/app/exams')}>
                New exam
              </Button>
              <Button variant="outline" onClick={() => navigate('/app/activity')}>
                Activity
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Answer review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.review.map((r, i) => (
              <div key={r.question_id} className="rounded-xl border border-border p-3 text-sm">
                <p className="font-medium">
                  {i + 1}. {r.prompt}
                </p>
                <p className="mt-1 text-ink-muted">Your answer: {r.your_answer}</p>
                <p className={r.is_correct ? 'text-success' : 'text-danger'}>
                  {r.is_correct ? 'Correct' : `Correct answer: ${r.correct_answer}`}
                </p>
                {r.explanation ? (
                  <p className="mt-1 text-xs text-ink-muted">{r.explanation}</p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!sessionActive) {
    return (
      <Card className="rounded-2xl p-6">
        <p className="text-sm text-ink-muted">No active session. Start from the Examination centre.</p>
        <Button className="mt-4" onClick={() => navigate('/app/exams')}>
          Examination centre
        </Button>
      </Card>
    )
  }

  if (!questions.length) {
    return (
      <Card className="rounded-2xl p-6">
        <p className="font-medium">This exam has no questions yet.</p>
        <p className="mt-2 text-sm text-ink-muted">
          Start again from the Examination centre so questions can be generated and saved.
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            clearSession()
            navigate('/app/exams')
          }}
        >
          Back to exams
        </Button>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-elevated px-4 py-3 shadow-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Locked exam · answers hidden until submit
          </p>
          <p className="text-sm font-semibold">{quiz.title}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-bold text-primary-700 dark:text-primary-300">
            {formatSeconds(secondsLeft)}
          </p>
          <p className="text-xs text-ink-muted">{progressLabel}</p>
        </div>
      </div>

      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
        Do not switch sections or close this tab — leaving fails the attempt. Scores are calculated
        on the server.
      </p>

      {current ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base font-medium leading-relaxed">
              {current.prompt}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {current.question_type === 'multiple_choice' && options?.length ? (
              <div className="space-y-2">
                {options.map((opt) => (
                  <label
                    key={opt}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm ${
                      answers[current.id] === opt
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30'
                        : 'border-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name={current.id}
                      checked={answers[current.id] === opt}
                      onChange={() => setAnswers((a) => ({ ...a, [current.id]: opt }))}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : null}
            {current.question_type === 'true_false' ? (
              <div className="flex gap-2">
                {['True', 'False'].map((opt) => (
                  <Button
                    key={opt}
                    type="button"
                    variant={answers[current.id] === opt ? 'default' : 'outline'}
                    onClick={() => setAnswers((a) => ({ ...a, [current.id]: opt }))}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            ) : null}
            {current.question_type === 'short_answer' ||
            (current.question_type === 'multiple_choice' && !options?.length) ? (
              <input
                className="flex h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-sm"
                value={answers[current.id] ?? ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [current.id]: e.target.value }))}
                placeholder="Your answer"
              />
            ) : null}

            <div className="flex justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                Previous
              </Button>
              {index < questions.length - 1 ? (
                <Button type="button" onClick={() => setIndex((i) => i + 1)}>
                  Next
                </Button>
              ) : (
                <Button type="button" disabled={submitting} onClick={() => void finalize(false)}>
                  {submitting ? <Spinner className="h-4 w-4" /> : 'Submit for grading'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
