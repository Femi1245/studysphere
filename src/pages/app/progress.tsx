import { format, parseISO, subDays } from 'date-fns'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/auth-context'
import { loadStudyBooksForUser, type StudyBookWithProgress } from '@/lib/study-curriculum'
import { trySupabase } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type {
  Quiz,
  QuizAnswer,
  QuizAttempt,
  StudentRecommendation,
  StudySession,
  StudyTask,
  Subject,
  Topic,
} from '@/types/database'

export function ProgressPage() {
  const { user } = useAuth()
  const supabase = trySupabase()
  const [range, setRange] = useState<7 | 14>(7)
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [tasks, setTasks] = useState<StudyTask[]>([])
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [reviewCount, setReviewCount] = useState(0)
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [allAttempts, setAllAttempts] = useState<QuizAttempt[]>([])
  const [wrongTopics, setWrongTopics] = useState<string[]>([])
  const [recommendations, setRecommendations] = useState<StudentRecommendation[]>([])
  const [studyBooks, setStudyBooks] = useState<StudyBookWithProgress[]>([])

  const load = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    const since = subDays(new Date(), range).toISOString()
    const [sess, task, att, top, sub, rev, qz, allAtt, rec, books] = await Promise.all([
      supabase.from('study_sessions').select('*').eq('user_id', user.id).gte('started_at', since),
      supabase.from('study_tasks').select('*').eq('user_id', user.id).eq('status', 'completed').gte('completed_at', since),
      supabase.from('quiz_attempts').select('*').eq('user_id', user.id).gte('created_at', since),
      supabase.from('topics').select('*').eq('user_id', user.id),
      supabase.from('subjects').select('*').eq('user_id', user.id),
      supabase.from('flashcard_reviews').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('reviewed_at', since),
      supabase.from('quizzes').select('*').eq('user_id', user.id),
      supabase.from('quiz_attempts').select('*').eq('user_id', user.id).not('submitted_at', 'is', null),
      supabase.from('student_recommendations').select('*').eq('user_id', user.id).eq('dismissed', false).order('created_at', { ascending: false }),
      loadStudyBooksForUser(supabase, user.id).catch(() => [] as StudyBookWithProgress[]),
    ])
    setSessions((sess.data as StudySession[]) ?? [])
    setTasks((task.data as StudyTask[]) ?? [])
    setAttempts((att.data as QuizAttempt[]) ?? [])
    setTopics((top.data as Topic[]) ?? [])
    setSubjects((sub.data as Subject[]) ?? [])
    setReviewCount(rev.count ?? 0)
    setQuizzes((qz.data as Quiz[]) ?? [])
    setAllAttempts((allAtt.data as QuizAttempt[]) ?? [])
    setStudyBooks(books)
    let recs = (rec.data as StudentRecommendation[]) ?? []

    const recentFails = (allAtt.data as QuizAttempt[] ?? []).filter((a) => {
      const q = (qz.data as Quiz[] | null)?.find((z) => z.id === a.quiz_id)
      const pct = a.max_score ? (a.score / a.max_score) * 100 : 0
      return pct < (q?.pass_mark ?? 50)
    })
    if (recs.length === 0 && recentFails.length > 0) {
      await supabase.from('student_recommendations').insert({
        user_id: user.id,
        title: 'Review after quiz misses',
        body: 'You had recent quiz attempts below the pass mark. Try practice mode or course materials.',
        action_href: '/app/quizzes/practice',
        reason: 'auto_fail_streak',
      })
      const { data: again } = await supabase
        .from('student_recommendations')
        .select('*')
        .eq('user_id', user.id)
        .eq('dismissed', false)
      recs = (again as StudentRecommendation[]) ?? recs
    }

    const failAttemptIds = recentFails.slice(0, 5).map((a) => a.id)
    if (failAttemptIds.length > 0) {
      const { data: ans } = await supabase
        .from('quiz_answers')
        .select('*, quiz_questions(prompt)')
        .eq('user_id', user.id)
        .eq('is_correct', false)
        .in('attempt_id', failAttemptIds)
      const labels = (ans ?? [])
        .map((row) => {
          const q = row as QuizAnswer & { quiz_questions?: { prompt: string } | null }
          return q.quiz_questions?.prompt?.slice(0, 80) ?? null
        })
        .filter(Boolean) as string[]
      setWrongTopics([...new Set(labels)].slice(0, 8))
    } else {
      setWrongTopics([])
    }

    setRecommendations(recs)
    setLoading(false)
  }, [supabase, user, range])

  useEffect(() => {
    void load()
  }, [load])

  const studyByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (let i = range - 1; i >= 0; i -= 1) {
      map.set(format(subDays(new Date(), i), 'MMM d'), 0)
    }
    for (const s of sessions) {
      const key = format(parseISO(s.started_at), 'MMM d')
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + s.duration_seconds / 60)
    }
    return Array.from(map.entries()).map(([day, minutes]) => ({
      day,
      minutes: Math.round(minutes),
    }))
  }, [sessions, range])

  const quizTrend = useMemo(
    () =>
      attempts
        .filter((a) => a.submitted_at)
        .map((a) => ({
          date: format(parseISO(a.submitted_at!), 'MMM d'),
          pct: a.max_score ? Math.round((a.score / a.max_score) * 100) : 0,
        })),
    [attempts],
  )

  const subjectProgress = useMemo(() => {
    return subjects.map((s) => {
      const subTopics = topics.filter((t) => t.subject_id === s.id)
      const pct =
        subTopics.length === 0
          ? 0
          : Math.round((subTopics.filter((t) => t.completed).length / subTopics.length) * 100)
      return { name: s.name, pct }
    })
  }, [subjects, topics])

  const revisionTopics = topics.filter((t) => t.needs_revision)

  const quizSummary = useMemo(() => {
    const rows = allAttempts.map((a) => {
      const q = quizzes.find((z) => z.id === a.quiz_id)
      const pct = a.max_score ? (a.score / a.max_score) * 100 : 0
      return { pct, pass: pct >= (q?.pass_mark ?? 50) }
    })
    const total = rows.length
    const avg = total ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / total) : 0
    const highest = total ? Math.round(Math.max(...rows.map((r) => r.pct))) : 0
    const passed = rows.filter((r) => r.pass).length
    const failed = rows.filter((r) => !r.pass).length
    const passRate = total ? Math.round((passed / total) * 100) : 0
    return { total, avg, highest, passed, failed, passRate }
  }, [allAttempts, quizzes])

  const bookTrack = useMemo(() => {
    const total = studyBooks.length
    const completed = studyBooks.filter((b) => b.progress?.status === 'completed').length
    const inProgress = studyBooks.filter((b) => b.progress?.status === 'in_progress').length
    const theoryDone = studyBooks.filter(
      (b) => b.book_kind === 'theory' && b.progress?.status === 'completed',
    ).length
    const practicalDone = studyBooks.filter(
      (b) => b.book_kind === 'practical' && b.progress?.status === 'completed',
    ).length
    return { total, completed, inProgress, theoryDone, practicalDone }
  }, [studyBooks])

  if (!supabase) return <SupabaseSetupBanner />
  if (loading) return <Skeleton className="h-96 rounded-2xl" />

  return (
    <div className="space-y-6">
      <p className="rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm text-ink-muted">
        Study time and quiz scores help you track habits, but they alone do not prove academic
        improvement. Combine metrics with understanding, feedback, and real-world results.
      </p>

      <Tabs value={String(range)} onValueChange={(v) => setRange(Number(v) as 7 | 14)}>
        <TabsList className="rounded-xl">
          <TabsTrigger value="7">Last 7 days</TabsTrigger>
          <TabsTrigger value="14">Last 14 days</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">Study books track record</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link to="/app/study-books">Open study books</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {bookTrack.total === 0 ? (
            <EmptyState
              title="No books linked yet"
              description="Save your academic profile and apply the curriculum migration to load theory and practical books."
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-ink-muted">Listed</p>
                  <p className="text-xl font-semibold">{bookTrack.total}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted">In progress</p>
                  <p className="text-xl font-semibold">{bookTrack.inProgress}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted">Completed</p>
                  <p className="text-xl font-semibold">{bookTrack.completed}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted">Theory / practical done</p>
                  <p className="text-xl font-semibold">
                    {bookTrack.theoryDone}/{bookTrack.practicalDone}
                  </p>
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                {studyBooks.slice(0, 8).map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
                  >
                    <span>
                      <span className="font-medium">{b.title}</span>
                      <span className="text-ink-muted">
                        {' '}
                        · {b.book_kind} · {b.progress?.status?.replace('_', ' ') ?? 'not started'} ·{' '}
                        {b.progress?.progress_percent ?? 0}%
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Study time by day</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {studyByDay.every((d) => d.minutes === 0) ? (
            <EmptyState title="No study sessions in this period" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={studyByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="minutes" fill="#7c3aed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Quiz performance (all time)</CardTitle>
        </CardHeader>
        <CardContent>
          {quizSummary.total === 0 ? (
            <EmptyState
              title="No quiz attempts yet"
              action={
                <Button asChild size="sm" variant="outline">
                  <Link to="/app/quizzes/practice">Start practice</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <p className="text-2xl font-bold">{quizSummary.total}</p>
                <p className="text-sm text-ink-muted">Attempts</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{quizSummary.avg}%</p>
                <p className="text-sm text-ink-muted">Average</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{quizSummary.highest}%</p>
                <p className="text-sm text-ink-muted">Highest</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{quizSummary.passed} / {quizSummary.failed}</p>
                <p className="text-sm text-ink-muted">Pass / fail</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{quizSummary.passRate}%</p>
                <p className="text-sm text-ink-muted">Pass rate</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {recommendations.length > 0 ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.map((r) => (
              <div key={r.id} className="rounded-xl border border-border px-3 py-2 text-sm">
                <p className="font-medium">{r.title}</p>
                <p className="text-ink-muted">{r.body}</p>
                {r.action_href ? (
                  <Link to={r.action_href} className="text-primary-600 hover:underline">
                    Take action
                  </Link>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Tasks completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{tasks.length}</p>
            <p className="text-sm text-ink-muted">In selected range</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Flashcard reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{reviewCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Quiz score trend</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          {quizTrend.length === 0 ? (
            <EmptyState title="No submitted quizzes yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={quizTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="pct" stroke="#1e3a5f" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Subject progress (topics)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {subjectProgress.length === 0 ? (
            <EmptyState title="Add subjects and topics" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectProgress} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="pct" fill="#1e3a5f" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {revisionTopics.length > 0 || wrongTopics.length > 0 ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Topics needing revision</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm">
              {revisionTopics.map((t) => (
                <li key={t.id}>{t.name}</li>
              ))}
              {wrongTopics.map((t) => (
                <li key={t}>Quiz: {t}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
