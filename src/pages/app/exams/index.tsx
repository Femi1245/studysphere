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
import { ACADEMIC_SUBJECT_VALUE, loadAcademicQuizContext } from '@/lib/academic-sync'
import {
  durationMinutesForCount,
  MIN_QUIZ_QUESTIONS,
  QUIZ_QUESTION_COUNTS,
} from '@/lib/quiz-timing'
import {
  createQuizAttempt,
  fingerprintPrompt,
  generateQuestionsForSubject,
  parseQuestionOptions,
  shuffleItems,
  type GenQuestion,
} from '@/lib/start-academic-quiz'
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
  const [academicLabel, setAcademicLabel] = useState('')
  const [hasAcademicSetup, setHasAcademicSetup] = useState(false)
  const [history, setHistory] = useState<(QuizAttempt & { quizzes?: { title: string } | null })[]>(
    [],
  )
  const [courseId, setCourseId] = useState(params.get('course') ?? ACADEMIC_SUBJECT_VALUE)
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
    const [ctx, att] = await Promise.all([
      loadAcademicQuizContext(supabase, user.id),
      supabase
        .from('quiz_attempts')
        .select('*, quizzes(title)')
        .eq('user_id', user.id)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false })
        .limit(15),
    ])
    setEnrolments(ctx.enrolments)
    setAcademicLabel(ctx.subjectLabel)
    setHasAcademicSetup(ctx.hasAcademicSetup)
    if (!params.get('course')) {
      setCourseId(ACADEMIC_SUBJECT_VALUE)
    }
    setHistory((att.data as typeof history) ?? [])
    setPassMark(String(await fetchDefaultPassMark(supabase)))
    setLoading(false)
  }, [supabase, user, params])

  useEffect(() => {
    void load()
  }, [load])

  const usingAcademicSubject = courseId === ACADEMIC_SUBJECT_VALUE || !courseId
  const activeCatalogueCourseId = usingAcademicSubject ? '' : courseId

  useEffect(() => {
    if (!supabase || !activeCatalogueCourseId) {
      setBanks([])
      setQuestions([])
      setBankId('')
      return
    }
    void supabase
      .from('question_banks')
      .select('*')
      .eq('catalogue_course_id', activeCatalogueCourseId)
      .eq('is_published', true)
      .then(({ data }) => {
        const list = (data as QuestionBank[]) ?? []
        setBanks(list)
        setBankId((prev) => (prev && list.some((b) => b.id === prev) ? prev : ''))
      })
  }, [supabase, activeCatalogueCourseId])

  useEffect(() => {
    if (!supabase || !activeCatalogueCourseId) {
      setQuestions([])
      return
    }
    if (bankId) {
      void supabase
        .from('bank_questions')
        .select('*')
        .eq('bank_id', bankId)
        .then(({ data }) => setQuestions((data as BankQuestion[]) ?? []))
      return
    }
    void supabase
      .from('question_banks')
      .select('id')
      .eq('catalogue_course_id', activeCatalogueCourseId)
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
  }, [supabase, bankId, activeCatalogueCourseId])

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
      const key = x.id || fingerprintPrompt(x.prompt)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [questions, difficulty, topicFilter])

  const allowedCounts = isAssessment ? QUIZ_QUESTION_COUNTS : PRACTICE_COUNTS

  useEffect(() => {
    if (isAssessment && count < MIN_QUIZ_QUESTIONS) setCount(30)
  }, [isAssessment, count])

  const startExam = async () => {
    if (!supabase || !user) return
    if (!hasAcademicSetup && !activeCatalogueCourseId) {
      toast({
        title: 'Set academic profile first',
        description: 'Save your programme / course of study so questions match what you study.',
        kind: 'error',
      })
      return
    }
    if (isAssessment && count < MIN_QUIZ_QUESTIONS) {
      toast({ title: 'Assessment minimum is 30 questions', kind: 'error' })
      return
    }

    const token = session?.access_token
    if (!token) {
      toast({ title: 'Sign in required', kind: 'error' })
      return
    }

    setStarting(true)
    try {
      const course = enrolments.find(
        (e) => e.catalogue_course_id === activeCatalogueCourseId,
      )?.catalogue_courses
      const subjectForQuestions = academicLabel ||
        (course ? `${course.code} — ${course.title}` : 'Your academic subject')

      let picked: GenQuestion[] = []

      if (activeCatalogueCourseId) {
        const { data: used } = await supabase
          .from('quiz_question_usage')
          .select('bank_question_id, source_fingerprint')
          .eq('user_id', user.id)
          .eq('catalogue_course_id', activeCatalogueCourseId)
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

        let fresh = pool.filter((q) => !usedIds.has(q.id) && !usedFp.has(fingerprintPrompt(q.prompt)))
        if (fresh.length < count) fresh = pool

        picked = shuffleItems(fresh)
          .slice(0, count)
          .map((q) => ({
            question_type: q.question_type,
            prompt: q.prompt,
            options: parseQuestionOptions(q.options),
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            topic_label: q.topic_label,
            bank_question_id: q.id,
          }))
      }

      const seenFp = new Set(picked.map((q) => fingerprintPrompt(q.prompt)))
      picked = picked.filter((q) => {
        const k = fingerprintPrompt(q.prompt)
        return Boolean(k)
      })

      if (picked.length < count) {
        const { questions: extra, error: genErr } = await generateQuestionsForSubject({
          accessToken: token,
          subject: subjectForQuestions,
          need: count - picked.length,
          difficulty,
          topicFilter: topicFilter.trim() || undefined,
        })
        for (const q of extra) {
          const k = fingerprintPrompt(q.prompt)
          if (!k || seenFp.has(k)) continue
          seenFp.add(k)
          picked.push(q)
          if (picked.length >= count) break
        }
        if (picked.length < count && genErr) {
          toast({
            title: 'Could not fill all questions',
            description: genErr,
            kind: 'error',
          })
        }
      }

      const minNeeded = isAssessment ? MIN_QUIZ_QUESTIONS : 1
      if (picked.length < minNeeded) {
        toast({
          title: 'Not enough questions to start',
          description: isAssessment
            ? `Need at least ${MIN_QUIZ_QUESTIONS}. Check GROQ_API_KEY / network, or edit academic profile and retry.`
            : 'No questions available for your academic subject yet.',
          kind: 'error',
        })
        setStarting(false)
        return
      }

      picked = picked.slice(0, count)
      const pass = Number.parseFloat(passMark) || 50
      const title = `${usingAcademicSubject ? 'Academic' : course?.code ?? 'Exam'} · ${mode} · ${picked.length}Q`

      const created = await createQuizAttempt({
        supabase,
        userId: user.id,
        title,
        description: topicFilter
          ? `Topic focus: ${topicFilter}`
          : `Based on academic profile: ${subjectForQuestions}`,
        catalogueCourseId: activeCatalogueCourseId || null,
        bankId: usingAcademicSubject ? null : bankId || null,
        difficulty,
        passMark: pass,
        mode,
        durationMinutes,
        questions: picked,
        topicFilter: topicFilter.trim() || undefined,
      })

      if ('error' in created) {
        toast({ title: 'Could not start', description: created.error, kind: 'error' })
        setStarting(false)
        return
      }

      const startedAt = new Date()
      const endsAt = new Date(startedAt.getTime() + durationMinutes * 60_000)
      startSession({
        quizId: created.quizId,
        attemptId: '',
        userId: user.id,
        startedAt: startedAt.toISOString(),
        endsAt: endsAt.toISOString(),
        questionCount: picked.length,
        passMark: pass,
        mode: isAssessment ? 'assessment' : 'practice',
      })
      navigate(`/app/quizzes/${created.quizId}/take`, { replace: isAssessment })
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
        {academicLabel ? (
          <p className="mt-2 text-sm text-ink">
            Questions follow your academic setup: <span className="font-medium">{academicLabel}</span>
          </p>
        ) : null}
      </div>

      {!hasAcademicSetup ? (
        <EmptyState
          title="Set your academic profile first"
          description="Quizzes and exams use the programme / course of study you save. You can edit it anytime."
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
              <Label>Subject / course</Label>
              <Select value={courseId || ACADEMIC_SUBJECT_VALUE} onValueChange={setCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Your academic subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ACADEMIC_SUBJECT_VALUE}>
                    My academic profile — {academicLabel}
                  </SelectItem>
                  {enrolments.map((e) => (
                    <SelectItem key={e.id} value={e.catalogue_course_id}>
                      {e.catalogue_courses?.code} — {e.catalogue_courses?.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-ink-muted">
                Default is your saved academic profile. Matched catalogue courses only appear when they
                fit that setup — not random shared courses.
              </p>
            </div>

            {!usingAcademicSubject ? (
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
            ) : (
              <div className="space-y-2">
                <Label>Question source</Label>
                <p className="rounded-xl border border-border px-3 py-2 text-sm text-ink-muted">
                  Generated for <span className="font-medium text-ink">{academicLabel}</span>
                </p>
              </div>
            )}

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
                disabled={starting || (!hasAcademicSetup && !activeCatalogueCourseId)}
                onClick={() => void startExam()}
              >
                {starting ? 'Preparing questions for your academic subject…' : 'Start exam'}
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
