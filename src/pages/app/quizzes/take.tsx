import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/toast'
import { useActiveQuiz } from '@/contexts/active-quiz-context'
import { useAuth } from '@/contexts/auth-context'
import { logActivity } from '@/lib/activity'
import { formatSeconds } from '@/lib/utils'
import { trySupabase } from '@/lib/supabase/client'
import type { Quiz, QuizQuestion } from '@/types/database'

function gradeAnswer(q: QuizQuestion, answer: string): boolean {
  const expected = q.correct_answer.trim().toLowerCase()
  const got = answer.trim().toLowerCase()
  if (q.question_type === 'short_answer') return got === expected
  return got === expected
}

export function QuizTakePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { active, clearSession } = useActiveQuiz()
  const { toast } = useToast()
  const navigate = useNavigate()
  const supabase = trySupabase()

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [result, setResult] = useState<{
    score: number
    max: number
    percentage: number
    passed: boolean
    failedByAbandon?: boolean
  } | null>(null)

  const submittingRef = useRef(false)
  const finishedRef = useRef(false)

  const endsAt = active?.endsAt ? new Date(active.endsAt).getTime() : 0

  const load = useCallback(async () => {
    if (!supabase || !user || !id) return
    setLoading(true)
    const [{ data: q }, { data: qs }] = await Promise.all([
      supabase.from('quizzes').select('*').eq('id', id).eq('user_id', user.id).maybeSingle(),
      supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', id)
        .order('order_index'),
    ])
    setQuiz((q as Quiz | null) ?? null)
    setQuestions((qs as QuizQuestion[]) ?? [])
    setLoading(false)
  }, [supabase, user, id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!endsAt || result) return
    const tick = () => {
      const left = Math.max(0, Math.floor((endsAt - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left <= 0 && !finishedRef.current) {
        void finalize(false, false)
      }
    }
    tick()
    const t = window.setInterval(tick, 1000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, result])

  const finalize = useCallback(
    async (abandoned: boolean, fromUser: boolean) => {
      if (!supabase || !user || !id || !quiz || submittingRef.current || finishedRef.current) {
        return
      }
      submittingRef.current = true
      finishedRef.current = true
      setSubmitting(true)

      const passMark = quiz.pass_mark ?? active?.passMark ?? 50
      let score = 0
      const answerRows = questions.map((q) => {
        const ans = abandoned ? '' : answers[q.id] ?? ''
        const correct = !abandoned && ans ? gradeAnswer(q, ans) : false
        if (correct) score += 1
        return {
          question_id: q.id,
          user_id: user.id,
          answer: ans || '(unanswered)',
          is_correct: correct,
        }
      })

      const max = questions.length || 1
      const percentage = abandoned ? 0 : Math.round((score / max) * 1000) / 10
      const passed = !abandoned && percentage >= passMark

      const { data: attempt, error } = await supabase
        .from('quiz_attempts')
        .insert({
          quiz_id: id,
          user_id: user.id,
          score: abandoned ? 0 : score,
          max_score: max,
          started_at: active?.startedAt ?? new Date().toISOString(),
          submitted_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (!error && attempt) {
        await supabase.from('quiz_answers').insert(
          answerRows.map((r) => ({ ...r, attempt_id: attempt.id })),
        )
        await logActivity(supabase, {
          userId: user.id,
          eventType: abandoned ? 'quiz_abandoned_fail' : 'quiz_submitted',
          quizId: id,
          attemptId: attempt.id,
          catalogueCourseId: quiz.catalogue_course_id,
          metadata: {
            score: abandoned ? 0 : score,
            max,
            percentage,
            passed,
            abandoned,
            fromUser,
          },
        })
      }

      clearSession()
      setResult({
        score: abandoned ? 0 : score,
        max,
        percentage,
        passed,
        failedByAbandon: abandoned,
      })
      setSubmitting(false)
      submittingRef.current = false

      if (abandoned) {
        toast({
          title: 'Quiz failed',
          description: 'You left the exam. This attempt is recorded as FAIL.',
          kind: 'error',
        })
      }
    },
    [supabase, user, id, quiz, questions, answers, active, clearSession, toast],
  )

  // Block in-app navigation while quiz is active
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      Boolean(active) &&
      !result &&
      currentLocation.pathname !== nextLocation.pathname &&
      !finishedRef.current,
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const leave = window.confirm(
      'Leaving this quiz will FAIL your attempt. Are you sure?',
    )
    if (leave) {
      void finalize(true, true).then(() => blocker.proceed?.())
    } else {
      blocker.reset?.()
    }
  }, [blocker, finalize])

  // Tab close / refresh
  useEffect(() => {
    if (result || !active) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const onPageHide = () => {
      if (!finishedRef.current) {
        void finalize(true, false)
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [active, result, finalize])

  // Wrong route while active → fail
  useEffect(() => {
    if (!active || !id || result) return
    if (active.quizId !== id) {
      void finalize(true, true)
    }
  }, [active, id, result, finalize])

  const current = questions[index]

  const progressLabel = useMemo(
    () => `${index + 1} / ${questions.length}`,
    [index, questions.length],
  )

  if (loading) return <Skeleton className="h-96 rounded-2xl" />
  if (!quiz) {
    return (
      <Card className="rounded-2xl p-6">
        <p>Quiz not found.</p>
        <Button className="mt-4" onClick={() => navigate('/app/quizzes/practice')}>
          Back
        </Button>
      </Card>
    )
  }

  if (result) {
    return (
      <Card className="mx-auto max-w-lg rounded-2xl">
        <CardHeader>
          <CardTitle className="font-display text-2xl">
            {result.failedByAbandon
              ? 'FAIL — Left exam'
              : result.passed
                ? 'PASS'
                : 'FAIL'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-ink-muted">
            Score: {result.score}/{result.max} ({result.percentage}%)
          </p>
          {result.failedByAbandon ? (
            <p className="text-sm text-danger">
              Navigating away or closing the quiz records an automatic fail.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate('/app/quizzes/practice')}>New quiz</Button>
            <Button variant="outline" onClick={() => navigate('/app/activity')}>
              Activity
            </Button>
            <Button variant="outline" onClick={() => navigate(`/app/quizzes/${id}`)}>
              Review quiz
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!active || active.quizId !== id) {
    return (
      <Card className="rounded-2xl p-6">
        <p className="text-sm text-ink-muted">
          No active locked session. Start again from Practice quiz.
        </p>
        <Button className="mt-4" onClick={() => navigate('/app/quizzes/practice')}>
          Start quiz
        </Button>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-elevated px-4 py-3 shadow-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Locked exam mode
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
        Do not switch sections or close this tab. Leaving fails the attempt automatically.
      </p>

      {current ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base font-medium leading-relaxed">
              {current.prompt}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {current.question_type === 'multiple_choice' && current.options ? (
              <div className="space-y-2">
                {current.options.map((opt) => (
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
                      onChange={() =>
                        setAnswers((a) => ({ ...a, [current.id]: opt }))
                      }
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
            {current.question_type === 'short_answer' ? (
              <input
                className="flex h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-sm"
                value={answers[current.id] ?? ''}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [current.id]: e.target.value }))
                }
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
                <Button
                  type="button"
                  disabled={submitting}
                  onClick={() => void finalize(false, true)}
                >
                  {submitting ? <Spinner className="h-4 w-4" /> : 'Submit quiz'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
