import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { useActiveQuiz } from '@/contexts/active-quiz-context'
import { useAuth } from '@/contexts/auth-context'
import { fetchDefaultPassMark } from '@/lib/academic'
import {
  durationMinutesForCount,
  MIN_QUIZ_QUESTIONS,
  QUIZ_QUESTION_COUNTS,
  type QuizQuestionCount,
} from '@/lib/quiz-timing'
import { trySupabase } from '@/lib/supabase/client'
import type {
  BankQuestion,
  CatalogueCourse,
  QuestionBank,
  QuestionDifficulty,
  StudentCourseEnrolment,
} from '@/types/database'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

function parseOptions(raw: unknown): string[] | null {
  if (Array.isArray(raw)) return raw.map(String)
  if (raw && typeof raw === 'object') return Object.values(raw as Record<string, string>)
  return null
}

type GenQuestion = {
  question_type: 'multiple_choice' | 'true_false' | 'short_answer'
  prompt: string
  options: string[] | null
  correct_answer: string
  explanation: string | null
  topic_label?: string | null
  bank_question_id?: string | null
}

function fp(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200)
}

export function QuizPracticePage() {
  const { user, session } = useAuth()
  const { toast } = useToast()
  const { startSession } = useActiveQuiz()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const supabase = trySupabase()

  const [loading, setLoading] = useState(true)
  const [enrolments, setEnrolments] = useState<
    (StudentCourseEnrolment & { catalogue_courses: CatalogueCourse | null })[]
  >([])
  const [courseId, setCourseId] = useState(params.get('course') ?? '')
  const [banks, setBanks] = useState<QuestionBank[]>([])
  const [bankId, setBankId] = useState(params.get('bank') ?? '')
  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [difficulty, setDifficulty] = useState<QuestionDifficulty | 'all'>('all')
  const [count, setCount] = useState<QuizQuestionCount>(30)
  const [passMark, setPassMark] = useState('50')
  const [starting, setStarting] = useState(false)

  const durationMinutes = durationMinutesForCount(count)

  const loadEnrolments = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    const { data } = await supabase
      .from('student_course_enrolments')
      .select('*, catalogue_courses(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
    setEnrolments((data as typeof enrolments) ?? [])
    const def = await fetchDefaultPassMark(supabase)
    setPassMark(String(def))
    setLoading(false)
  }, [supabase, user])

  useEffect(() => {
    void loadEnrolments()
  }, [loadEnrolments])

  useEffect(() => {
    if (!supabase || !courseId) {
      setBanks([])
      return
    }
    void supabase
      .from('question_banks')
      .select('*')
      .eq('catalogue_course_id', courseId)
      .eq('is_published', true)
      .then(({ data }) => setBanks((data as QuestionBank[]) ?? []))
  }, [supabase, courseId])

  useEffect(() => {
    if (!supabase || !bankId) {
      setQuestions([])
      return
    }
    void supabase
      .from('bank_questions')
      .select('*')
      .eq('bank_id', bankId)
      .order('order_index')
      .then(({ data }) => setQuestions((data as BankQuestion[]) ?? []))
  }, [supabase, bankId])

  useEffect(() => {
    if (banks.length === 1 && !bankId) setBankId(banks[0]!.id)
  }, [banks, bankId])

  useEffect(() => {
    if (!courseId && enrolments[0]) setCourseId(enrolments[0].catalogue_course_id)
  }, [enrolments, courseId])

  const pool = useMemo(() => {
    let q = questions
    if (difficulty !== 'all') q = q.filter((x) => x.difficulty === difficulty)
    return q
  }, [questions, difficulty])

  const generateExtra = async (
    need: number,
    courseTitle: string,
  ): Promise<GenQuestion[]> => {
    const token = session?.access_token
    if (!token || need <= 0) return []
    const out: GenQuestion[] = []
    let remaining = need
    while (remaining > 0) {
      const batch = Math.min(remaining, 25)
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          count: batch,
          course: courseTitle,
          difficulty: difficulty === 'all' ? 'medium' : difficulty,
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Could not generate enough questions')
      }
      const data = (await res.json()) as { questions?: GenQuestion[] }
      const chunk = data.questions ?? []
      if (chunk.length === 0) break
      out.push(...chunk)
      remaining -= chunk.length
    }
    return out
  }

  const startQuiz = async () => {
    if (!supabase || !user || !courseId) return
    if (count < MIN_QUIZ_QUESTIONS) {
      toast({
        title: 'Minimum 30 questions',
        description: 'Choose 30, 60, 100, or 300 questions.',
        kind: 'error',
      })
      return
    }

    setStarting(true)
    try {
      const course =
        enrolments.find((e) => e.catalogue_course_id === courseId)?.catalogue_courses
      const courseLabel = course
        ? `${course.code} — ${course.title}`
        : 'Selected course'

      let picked: GenQuestion[] = shuffle(pool)
        .slice(0, count)
        .map((q) => ({
          question_type: q.question_type,
          prompt: q.prompt,
          options: parseOptions(q.options),
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          topic_label: q.topic_label,
          bank_question_id: q.id,
        }))

      if (picked.length < count) {
        const extra = await generateExtra(count - picked.length, courseLabel)
        picked = [...picked, ...extra].slice(0, count)
      }

      const seenFp = new Set<string>()
      picked = picked.filter((q) => {
        const k = fp(q.prompt)
        if (seenFp.has(k)) return false
        seenFp.add(k)
        return true
      })

      if (picked.length < MIN_QUIZ_QUESTIONS) {
        toast({
          title: 'Not enough questions',
          description: `Need at least ${MIN_QUIZ_QUESTIONS}. Bank has ${pool.length}; AI could not fill the rest. Add GROQ_API_KEY or grow the bank.`,
          kind: 'error',
        })
        setStarting(false)
        return
      }

      const pass = Number.parseFloat(passMark) || 50
      const title = `${course?.code ?? 'Course'} assessment — ${picked.length}Q / ${durationMinutes}m`

      const { data: quiz, error: quizErr } = await supabase
        .from('quizzes')
        .insert({
          user_id: user.id,
          title,
          description: `Auto-provided questions for ${courseLabel}`,
          catalogue_course_id: courseId,
          bank_id: bankId || null,
          difficulty: difficulty === 'all' ? null : difficulty,
          pass_mark: pass,
          mode: 'assessment',
          question_count: picked.length,
          is_timed: true,
          randomized: true,
          duration_minutes: durationMinutes,
        })
        .select('id')
        .single()

      if (quizErr || !quiz) {
        toast({ title: 'Could not start', description: quizErr?.message, kind: 'error' })
        setStarting(false)
        return
      }

      const rows = picked.map((q, i) => ({
        quiz_id: quiz.id,
        user_id: user.id,
        question_type: q.question_type,
        prompt: q.prompt,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        order_index: i,
        topic_label: q.topic_label ?? null,
        bank_question_id: q.bank_question_id ?? null,
        source_fingerprint: fp(q.prompt),
      }))
      const { error: qErr } = await supabase.from('quiz_questions').insert(rows)
      if (qErr) {
        toast({ title: 'Questions failed', description: qErr.message, kind: 'error' })
        setStarting(false)
        return
      }

      const startedAt = new Date()
      const endsAt = new Date(startedAt.getTime() + durationMinutes * 60_000)
      startSession({
        quizId: quiz.id,
        attemptId: '',
        userId: user.id,
        startedAt: startedAt.toISOString(),
        endsAt: endsAt.toISOString(),
        questionCount: picked.length,
        passMark: pass,
        mode: 'assessment',
      })

      navigate(`/app/quizzes/${quiz.id}/take`, { replace: true })
    } catch (e) {
      toast({
        title: 'Start failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        kind: 'error',
      })
    } finally {
      setStarting(false)
    }
  }

  if (!supabase) return <SupabaseSetupBanner />
  if (loading) return <Skeleton className="h-64 rounded-2xl" />

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/app/exams">Examination centre</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/app/quizzes">Quizzes</Link>
        </Button>
        <h2 className="font-display text-xl font-semibold">Course assessment</h2>
      </div>

      <p className="text-sm text-ink-muted">
        Questions are provided for your enrolled course. Choose how many to answer —
        time is set automatically. Leaving mid-quiz fails the attempt.
      </p>

      {enrolments.length === 0 ? (
        <EmptyState
          title="Enrol in a course first"
          description="Assessments are based on your academic courses."
          action={
            <Button asChild size="sm">
              <Link to="/app/academic-profile">Set academic profile</Link>
            </Button>
          }
        />
      ) : (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Start assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Your course</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {enrolments.map((e) => (
                    <SelectItem key={e.id} value={e.catalogue_course_id}>
                      {e.catalogue_courses?.code} — {e.catalogue_courses?.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {banks.length > 0 ? (
              <div className="space-y-2">
                <Label>Question bank (optional source)</Label>
                <Select value={bankId || 'none'} onValueChange={(v) => setBankId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Auto (bank + AI fill)</SelectItem>
                    {banks.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-xs text-ink-muted">
                No bank for this course yet — questions will be generated for your course topic
                when you start (requires Groq).
              </p>
            )}

            <div className="space-y-2">
              <Label>Difficulty preference</Label>
              <Select
                value={difficulty}
                onValueChange={(v) => setDifficulty(v as QuestionDifficulty | 'all')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Mixed</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Number of questions (minimum {MIN_QUIZ_QUESTIONS})</Label>
              <Select
                value={String(count)}
                onValueChange={(v) => setCount(Number(v) as QuizQuestionCount)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUIZ_QUESTION_COUNTS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} questions — {durationMinutesForCount(n)} minutes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-ink-muted">
                Selected: <strong>{count}</strong> questions · timer{' '}
                <strong>{durationMinutes} minutes</strong> (locked until submit)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pass">Pass mark (%)</Label>
              <Input id="pass" value={passMark} onChange={(e) => setPassMark(e.target.value)} />
            </div>

            <Button
              className="w-full"
              disabled={!courseId || starting}
              onClick={() => void startQuiz()}
            >
              {starting ? 'Preparing questions…' : 'Start assessment'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
