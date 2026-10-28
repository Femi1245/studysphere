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
} from '@/lib/quiz-timing'
import { trySupabase } from '@/lib/supabase/client'
import type {
  BankQuestion,
  CatalogueCourse,
  QuestionBank,
  QuestionDifficulty,
  QuizAttempt,
  QuizMode,
  StudentCourseEnrolment,
} from '@/types/database'

const PRACTICE_COUNTS = [5, 10, 20, 30, 50] as const

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

function fp(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200)
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

/**
 * Advanced examination centre — configure and start bank-backed assessments.
 */
export function ExaminationCentrePage() {
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
  const [history, setHistory] = useState<(QuizAttempt & { quizzes?: { title: string } | null })[]>(
    [],
  )
  const [courseId, setCourseId] = useState(params.get('course') ?? '')
  const [topicFilter, setTopicFilter] = useState(params.get('topic') ?? '')
  const [banks, setBanks] = useState<QuestionBank[]>([])
  const [bankId, setBankId] = useState<string>('')
  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [difficulty, setDifficulty] = useState<QuestionDifficulty | 'all'>(
    (params.get('difficulty') as QuestionDifficulty) || 'all',
  )
  const [mode, setMode] = useState<QuizMode>(
    params.get('mode') === 'practice' ? 'practice' : 'assessment',
  )
  const [count, setCount] = useState(Number(params.get('count')) || 30)
  const [passMark, setPassMark] = useState('50')
  const [starting, setStarting] = useState(false)

  const isAssessment = mode === 'assessment'
  const durationMinutes = isAssessment
    ? durationMinutesForCount(Math.max(count, MIN_QUIZ_QUESTIONS))
    : Math.max(5, count)

  const load = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    const [enr, att] = await Promise.all([
      supabase
        .from('student_course_enrolments')
        .select('*, catalogue_courses(*)')
        .eq('user_id', user.id)
        .eq('status', 'active'),
      supabase
        .from('quiz_attempts')
        .select('*, quizzes(title)')
        .eq('user_id', user.id)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false })
        .limit(15),
    ])
    setEnrolments((enr.data as typeof enrolments) ?? [])
    setHistory((att.data as typeof history) ?? [])
    setPassMark(String(await fetchDefaultPassMark(supabase)))
    setLoading(false)
  }, [supabase, user])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!courseId && enrolments[0]) setCourseId(enrolments[0].catalogue_course_id)
  }, [enrolments, courseId])

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
      .then(({ data }) => {
        const list = (data as QuestionBank[]) ?? []
        setBanks(list)
        if (list[0] && !bankId) setBankId(list[0].id)
      })
  }, [supabase, courseId, bankId])

  useEffect(() => {
    if (!supabase) return
    if (bankId) {
      void supabase
        .from('bank_questions')
        .select('*')
        .eq('bank_id', bankId)
        .then(({ data }) => setQuestions((data as BankQuestion[]) ?? []))
      return
    }
    if (!courseId) {
      setQuestions([])
      return
    }
    void supabase
      .from('question_banks')
      .select('id')
      .eq('catalogue_course_id', courseId)
      .eq('is_published', true)
      .then(async ({ data }) => {
        const ids = (data ?? []).map((b) => b.id as string)
        if (!ids.length) {
          setQuestions([])
          return
        }
        const { data: qs } = await supabase.from('bank_questions').select('*').in('bank_id', ids)
        setQuestions((qs as BankQuestion[]) ?? [])
      })
  }, [supabase, bankId, courseId])

  const topics = useMemo(() => {
    const set = new Set<string>()
    for (const q of questions) {
      if (q.topic_label) set.add(q.topic_label)
    }
    return [...set].sort()
  }, [questions])

  const pool = useMemo(() => {
    let q = questions
    if (difficulty !== 'all') q = q.filter((x) => x.difficulty === difficulty)
    if (topicFilter.trim()) {
      const t = topicFilter.trim().toLowerCase()
      q = q.filter(
        (x) =>
          x.topic_label?.toLowerCase().includes(t) ||
          x.prompt.toLowerCase().includes(t),
      )
    }
    // Deduplicate within pool by fingerprint
    const seen = new Set<string>()
    return q.filter((x) => {
      const key = x.id || fp(x.prompt)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [questions, difficulty, topicFilter])

  const allowedCounts = isAssessment ? QUIZ_QUESTION_COUNTS : PRACTICE_COUNTS

  useEffect(() => {
    if (isAssessment && count < MIN_QUIZ_QUESTIONS) setCount(30)
  }, [isAssessment, count])

  const generateExtra = async (need: number, courseTitle: string): Promise<GenQuestion[]> => {
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
          course: `${courseTitle}${topicFilter ? ` — ${topicFilter}` : ''}`,
          difficulty: difficulty === 'all' ? 'medium' : difficulty,
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Could not generate questions')
      }
      const data = (await res.json()) as { questions?: GenQuestion[] }
      const chunk = (data.questions ?? []).map((q) => ({
        ...q,
        topic_label: topicFilter || q.topic_label || null,
        bank_question_id: null,
      }))
      if (!chunk.length) break
      out.push(...chunk)
      remaining -= chunk.length
    }
    return out
  }

  const startExam = async () => {
    if (!supabase || !user || !courseId) return
    if (isAssessment && count < MIN_QUIZ_QUESTIONS) {
      toast({ title: 'Assessment minimum is 30 questions', kind: 'error' })
      return
    }

    setStarting(true)
    try {
      // Prefer unused bank questions for retries
      const { data: used } = await supabase
        .from('quiz_question_usage')
        .select('bank_question_id, source_fingerprint')
        .eq('user_id', user.id)
        .eq('catalogue_course_id', courseId)
        .order('created_at', { ascending: false })
        .limit(500)

      const usedIds = new Set(
        (used ?? [])
          .map((u) => u.bank_question_id as string | null)
          .filter(Boolean) as string[],
      )
      const usedFp = new Set(
        (used ?? [])
          .map((u) => u.source_fingerprint as string | null)
          .filter(Boolean) as string[],
      )

      let fresh = pool.filter((q) => !usedIds.has(q.id) && !usedFp.has(fp(q.prompt)))
      if (fresh.length < count) fresh = pool

      let picked: GenQuestion[] = shuffle(fresh)
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

      // Ensure unique prompts within attempt
      const seenFp = new Set<string>()
      picked = picked.filter((q) => {
        const k = fp(q.prompt)
        if (seenFp.has(k)) return false
        seenFp.add(k)
        return true
      })

      const course =
        enrolments.find((e) => e.catalogue_course_id === courseId)?.catalogue_courses
      const courseLabel = course ? `${course.code} — ${course.title}` : 'Course'

      if (picked.length < count) {
        const extra = await generateExtra(count - picked.length, courseLabel)
        for (const q of extra) {
          const k = fp(q.prompt)
          if (seenFp.has(k)) continue
          seenFp.add(k)
          picked.push(q)
          if (picked.length >= count) break
        }
      }

      if (isAssessment && picked.length < MIN_QUIZ_QUESTIONS) {
        toast({
          title: 'Not enough eligible questions',
          description: `Need ${MIN_QUIZ_QUESTIONS}+ unique questions. Bank has ${pool.length} matching. Add GROQ_API_KEY or grow the bank.`,
          kind: 'error',
        })
        setStarting(false)
        return
      }
      if (!isAssessment && picked.length < 1) {
        toast({ title: 'No questions available', kind: 'error' })
        setStarting(false)
        return
      }

      picked = picked.slice(0, count)
      const pass = Number.parseFloat(passMark) || 50
      const title = `${course?.code ?? 'Exam'} · ${mode} · ${picked.length}Q`

      const { data: quiz, error: quizErr } = await supabase
        .from('quizzes')
        .insert({
          user_id: user.id,
          title,
          description: topicFilter ? `Topic focus: ${topicFilter}` : 'Examination centre',
          catalogue_course_id: courseId,
          bank_id: bankId || null,
          difficulty: difficulty === 'all' ? null : difficulty,
          pass_mark: pass,
          mode,
          question_count: picked.length,
          is_timed: isAssessment,
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
        topic_label: q.topic_label ?? (topicFilter || null),
        bank_question_id: q.bank_question_id ?? null,
        source_fingerprint: fp(q.prompt),
      }))

      const { error: qErr } = await supabase.from('quiz_questions').insert(rows)
      if (qErr) {
        toast({ title: 'Question insert failed', description: qErr.message, kind: 'error' })
        setStarting(false)
        return
      }

      const startedAt = new Date()
      const endsAt = new Date(startedAt.getTime() + durationMinutes * 60_000)
      if (isAssessment) {
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
      } else {
        navigate(`/app/quizzes/${quiz.id}/take`)
        startSession({
          quizId: quiz.id,
          attemptId: '',
          userId: user.id,
          startedAt: startedAt.toISOString(),
          endsAt: endsAt.toISOString(),
          questionCount: picked.length,
          passMark: pass,
          mode: 'practice',
        })
      }
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
  if (loading) return <Skeleton className="h-72 rounded-2xl" />

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Examination centre</h2>
        <p className="text-sm text-ink-muted">
          Configure subject/course practice or timed assessment. Answers are graded on the server.
          Completed attempts are kept forever.
        </p>
      </div>

      {enrolments.length === 0 ? (
        <EmptyState
          title="Enrol in a course first"
          action={
            <Button asChild size="sm">
              <Link to="/app/academic-profile">Academic profile</Link>
            </Button>
          }
        />
      ) : (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Exam configuration</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Course</Label>
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

            <div className="space-y-2">
              <Label>Question bank</Label>
              <Select
                value={bankId || 'all'}
                onValueChange={(v) => setBankId(v === 'all' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All banks for course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All published banks</SelectItem>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Topic (optional filter)</Label>
              <Input
                list="exam-topics"
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                placeholder="e.g. Algebra"
              />
              <datalist id="exam-topics">
                {topics.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label>Difficulty</Label>
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
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as QuizMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="practice">Practice</SelectItem>
                  <SelectItem value="assessment">Assessment (locked + timed)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Questions ({pool.length} eligible in bank)</Label>
              <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedCounts.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                      {isAssessment ? ` · ${durationMinutesForCount(n)} min` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAssessment && pool.length < count ? (
                <p className="text-xs text-ink-muted">
                  Bank has {pool.length}; remaining questions can be AI-filled when Groq is
                  configured.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Pass mark (%)</Label>
              <Input value={passMark} onChange={(e) => setPassMark(e.target.value)} />
            </div>

            <div className="sm:col-span-2">
              <p className="mb-3 text-xs text-ink-muted">
                Timer: <strong>{durationMinutes} minutes</strong>
                {isAssessment
                  ? ' · Leaving the exam fails the attempt · Correct answers hidden until submit'
                  : ' · Practice still saves a permanent attempt'}
              </p>
              <Button
                className="w-full"
                disabled={!courseId || starting}
                onClick={() => void startExam()}
              >
                {starting ? 'Preparing unique questions…' : 'Start exam'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Recent attempt history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 ? (
            <p className="text-sm text-ink-muted">No submitted attempts yet.</p>
          ) : (
            history.map((h) => {
              const pct = h.max_score ? Math.round((h.score / h.max_score) * 1000) / 10 : 0
              return (
                <div
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{h.quizzes?.title ?? 'Quiz'}</p>
                    <p className="text-xs text-ink-muted">
                      {h.score}/{h.max_score} ({pct}%) · {h.submitted_at}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/app/quizzes/${h.quiz_id}`}>Open</Link>
                  </Button>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
