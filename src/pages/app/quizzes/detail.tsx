import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/auth-context'
import { logActivity } from '@/lib/activity'
import { trySupabase } from '@/lib/supabase/client'
import { formatSeconds } from '@/lib/utils'
import type { QuestionType, Quiz, QuizAnswer, QuizQuestion } from '@/types/database'

function gradeAnswer(question: QuizQuestion, answer: string): boolean {
  const normalized = answer.trim().toLowerCase()
  if (question.question_type === 'short_answer') {
    return normalized === question.correct_answer.trim().toLowerCase()
  }
  return answer.trim() === question.correct_answer.trim()
}

export function QuizDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = trySupabase()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'edit' | 'take' | 'results'>('edit')
  const [qIndex, setQIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [results, setResults] = useState<{ question: QuizQuestion; answer: string; correct: boolean }[]>([])
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)

  const [newType, setNewType] = useState<QuestionType>('multiple_choice')
  const [newPrompt, setNewPrompt] = useState('')
  const [newOptions, setNewOptions] = useState('A\nB\nC\nD')
  const [newCorrect, setNewCorrect] = useState('')
  const [newExplanation, setNewExplanation] = useState('')

  const load = useCallback(async () => {
    if (!supabase || !user || !id) return
    setLoading(true)
    const [qRes, quesRes] = await Promise.all([
      supabase.from('quizzes').select('*').eq('id', id).eq('user_id', user.id).maybeSingle(),
      supabase.from('quiz_questions').select('*').eq('quiz_id', id).order('order_index'),
    ])
    setQuiz((qRes.data as Quiz | null) ?? null)
    setQuestions((quesRes.data as QuizQuestion[]) ?? [])
    setLoading(false)
  }, [supabase, user, id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (mode !== 'take' || !quiz?.duration_minutes) return
    setSecondsLeft(quiz.duration_minutes * 60)
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null || s <= 1) {
          clearInterval(t)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [mode, quiz?.duration_minutes])

  const submittedRef = useRef(submitted)
  submittedRef.current = submitted

  const addQuestion = async () => {
    if (!supabase || !user || !id || !newPrompt.trim() || !newCorrect.trim()) return
    const options =
      newType === 'multiple_choice'
        ? newOptions.split('\n').map((o) => o.trim()).filter(Boolean)
        : newType === 'true_false'
          ? ['True', 'False']
          : null
    const { error } = await supabase.from('quiz_questions').insert({
      quiz_id: id,
      user_id: user.id,
      question_type: newType,
      prompt: newPrompt.trim(),
      options,
      correct_answer: newCorrect.trim(),
      explanation: newExplanation.trim() || null,
      order_index: questions.length,
    })
    if (error) toast({ title: 'Failed', description: error.message, kind: 'error' })
    setNewPrompt('')
    setNewCorrect('')
    setNewExplanation('')
    await load()
  }

  const removeQuestion = async (qid: string) => {
    if (!supabase) return
    await supabase.from('quiz_questions').delete().eq('id', qid)
    await load()
  }

  const startTake = async () => {
    if (!supabase || !user || !id || questions.length === 0) return
    const { data } = await supabase
      .from('quiz_attempts')
      .insert({
        quiz_id: id,
        user_id: user.id,
        score: 0,
        max_score: questions.length,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    setAttemptId(data?.id ?? null)
    setAnswers({})
    setSubmitted(false)
    setResults([])
    setQIndex(0)
    setMode('take')
  }

  const submitAttempt = async () => {
    if (!supabase || !user || submitted) return
    const graded = questions.map((q) => {
      const ans = answers[q.id] ?? ''
      const correct = gradeAnswer(q, ans)
      return { question: q, answer: ans, correct }
    })
    const score = graded.filter((g) => g.correct).length
    setResults(graded)
    setSubmitted(true)
    setMode('results')

    if (attemptId) {
      await supabase
        .from('quiz_attempts')
        .update({ score, submitted_at: new Date().toISOString() })
        .eq('id', attemptId)
      const rows: Omit<QuizAnswer, 'id' | 'created_at'>[] = graded.map((g) => ({
        attempt_id: attemptId,
        question_id: g.question.id,
        user_id: user.id,
        answer: g.answer,
        is_correct: g.correct,
      }))
      await supabase.from('quiz_answers').insert(rows)
      const max = graded.length
      const pct = max ? Math.round((score / max) * 100) : 0
      const passMark = quiz?.pass_mark ?? 50
      void logActivity(supabase, {
        userId: user.id,
        eventType: 'quiz_submitted',
        quizId: id,
        attemptId,
        catalogueCourseId: quiz?.catalogue_course_id,
        metadata: {
          score,
          max_score: max,
          percentage: pct,
          passed: pct >= passMark,
          mode: quiz?.mode ?? 'practice',
        },
      })
    }
  }

  const submitRef = useRef(submitAttempt)
  submitRef.current = submitAttempt

  useEffect(() => {
    if (secondsLeft === 0 && mode === 'take' && !submittedRef.current) {
      void submitRef.current()
    }
  }, [secondsLeft, mode])

  const current = questions[qIndex]

  const mcqOptions = useMemo(() => current?.options ?? [], [current])

  if (!supabase) return <SupabaseSetupBanner />
  if (loading) return <Skeleton className="h-64 rounded-2xl" />
  if (!quiz) {
    return <EmptyState title="Quiz not found" action={<Button asChild variant="outline"><Link to="/app/quizzes">Back</Link></Button>} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/app/quizzes">Back</Link>
        </Button>
        <h2 className="font-display text-xl font-semibold">{quiz.title}</h2>
        {mode === 'take' && secondsLeft !== null ? (
          <Badge variant="warning">{formatSeconds(secondsLeft)}</Badge>
        ) : null}
      </div>

      {mode === 'edit' ? (
        <Tabs defaultValue="questions">
          <TabsList className="rounded-xl">
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="take">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="questions" className="space-y-4">
            {questions.length === 0 ? (
              <EmptyState title="Add questions to enable quiz mode" />
            ) : (
              <ul className="space-y-2">
                {questions.map((q, i) => (
                  <li key={q.id} className="rounded-xl border border-border p-3 text-sm">
                    <p className="font-medium">
                      {i + 1}. {q.prompt}
                    </p>
                    <p className="text-ink-muted">{q.question_type}</p>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void removeQuestion(q.id)}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Add question</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={newType} onValueChange={(v) => setNewType(v as QuestionType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple choice</SelectItem>
                    <SelectItem value="true_false">True / False</SelectItem>
                    <SelectItem value="short_answer">Short answer</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea placeholder="Prompt" value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} />
                {newType === 'multiple_choice' ? (
                  <Textarea placeholder="Options (one per line)" value={newOptions} onChange={(e) => setNewOptions(e.target.value)} />
                ) : null}
                <Input placeholder="Correct answer" value={newCorrect} onChange={(e) => setNewCorrect(e.target.value)} />
                <Textarea placeholder="Explanation (shown after submit)" value={newExplanation} onChange={(e) => setNewExplanation(e.target.value)} />
                <Button onClick={() => void addQuestion()}>Add question</Button>
              </CardContent>
            </Card>
            <Button variant="accent" disabled={questions.length === 0} onClick={() => void startTake()}>
              Take quiz
            </Button>
          </TabsContent>
          <TabsContent value="take">
            <p className="text-sm text-ink-muted">Switch to Take quiz to start an attempt.</p>
          </TabsContent>
        </Tabs>
      ) : null}

      {mode === 'take' && current && !submitted ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>
              Question {qIndex + 1} of {questions.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{current.prompt}</p>
            {current.question_type === 'multiple_choice' || current.question_type === 'true_false' ? (
              <div className="space-y-2">
                {mcqOptions.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <input
                      type="radio"
                      name={`q-${current.id}`}
                      checked={answers[current.id] === opt}
                      onChange={() => setAnswers((a) => ({ ...a, [current.id]: opt }))}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <Input
                value={answers[current.id] ?? ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [current.id]: e.target.value }))}
                placeholder="Your answer"
              />
            )}
            <div className="flex gap-2">
              <Button variant="outline" disabled={qIndex === 0} onClick={() => setQIndex((i) => i - 1)}>
                Previous
              </Button>
              {qIndex < questions.length - 1 ? (
                <Button onClick={() => setQIndex((i) => i + 1)}>Next</Button>
              ) : (
                <Button onClick={() => void submitAttempt()}>Submit</Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {mode === 'results' ? (
        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>
                Score: {results.filter((r) => r.correct).length} / {results.length}
                {results.length > 0 ? (
                  <span className="ml-2 text-base font-normal text-ink-muted">
                    (
                    {Math.round(
                      (results.filter((r) => r.correct).length / results.length) * 100,
                    )}
                    % —{' '}
                    {Math.round(
                      (results.filter((r) => r.correct).length / results.length) * 100,
                    ) >= (quiz.pass_mark ?? 50)
                      ? 'Pass'
                      : 'Fail'}
                    )
                  </span>
                ) : null}
              </CardTitle>
            </CardHeader>
          </Card>
          {results
            .filter((r) => !r.correct)
            .map((r) => (
              <Card key={r.question.id} className="rounded-2xl border-danger/30">
                <CardHeader>
                  <CardTitle className="text-sm">{r.question.prompt}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p>
                    Your answer: <span className="text-danger">{r.answer || '—'}</span>
                  </p>
                  <p>Correct: {r.question.correct_answer}</p>
                  {r.question.explanation ? (
                    <p className="text-ink-muted">{r.question.explanation}</p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          {results
            .filter((r) => r.correct)
            .map((r) => (
              <Card key={r.question.id} className="rounded-2xl">
                <CardContent className="pt-6 text-sm">
                  <p className="font-medium">{r.question.prompt}</p>
                  <p className="text-success">Correct</p>
                  {quiz.mode === 'assessment' && r.question.explanation ? (
                    <p className="text-ink-muted">{r.question.explanation}</p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          <Button
            onClick={() => {
              setMode('edit')
              void startTake()
            }}
          >
            Retake
          </Button>
        </div>
      ) : null}
    </div>
  )
}
