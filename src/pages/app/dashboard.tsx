import {
  addDays,
  format,
  isToday,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns'
import {
  BookOpen,
  Calendar,
  ClipboardList,
  FileText,
  Flame,
  Plus,
  Timer,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/auth-context'
import { trySupabase } from '@/lib/supabase/client'
import { cn, formatDuration } from '@/lib/utils'
import type {
  ActivityEvent,
  CatalogueCourse,
  Note,
  Quiz,
  QuizAttempt,
  StudentCourseEnrolment,
  StudentRecommendation,
  StudySession,
  StudyTask,
  Subject,
} from '@/types/database'

function computeStreak(sessions: StudySession[]): number {
  const days = new Set(
    sessions
      .filter((s) => s.duration_seconds > 0)
      .map((s) => startOfDay(parseISO(s.started_at)).getTime()),
  )
  if (days.size === 0) return 0
  let streak = 0
  let cursor = startOfDay(new Date())
  while (days.has(cursor.getTime())) {
    streak += 1
    cursor = subDays(cursor, 1)
  }
  return streak
}

export function DashboardPage() {
  const { user, profile, preferences } = useAuth()
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<StudyTask[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [dueFlashcards, setDueFlashcards] = useState(0)
  const [enrolments, setEnrolments] = useState<
    (StudentCourseEnrolment & { catalogue_courses: CatalogueCourse | null })[]
  >([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [recommendations, setRecommendations] = useState<StudentRecommendation[]>([])

  const supabase = trySupabase()

  useEffect(() => {
    if (!supabase || !user) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      const [
        tasksRes,
        subjectsRes,
        sessionsRes,
        notesRes,
        attemptsRes,
        flashRes,
        enrRes,
        actRes,
        recRes,
        quizRes,
      ] = await Promise.all([
        supabase
          .from('study_tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('due_at', { ascending: true, nullsFirst: false })
          .limit(20),
        supabase.from('subjects').select('*').eq('user_id', user.id).order('name'),
        supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', user.id)
          .gte('started_at', subDays(new Date(), 14).toISOString())
          .order('started_at', { ascending: false }),
        supabase
          .from('notes')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase
          .from('quiz_attempts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('flashcards')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .lte('next_review_at', new Date().toISOString()),
        supabase
          .from('student_course_enrolments')
          .select('*, catalogue_courses(*)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(6),
        supabase
          .from('activity_events')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('student_recommendations')
          .select('*')
          .eq('user_id', user.id)
          .eq('dismissed', false)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('quizzes').select('*').eq('user_id', user.id),
      ])

      if (cancelled) return
      setTasks((tasksRes.data as StudyTask[]) ?? [])
      setSubjects((subjectsRes.data as Subject[]) ?? [])
      setSessions((sessionsRes.data as StudySession[]) ?? [])
      setNotes((notesRes.data as Note[]) ?? [])
      setAttempts((attemptsRes.data as QuizAttempt[]) ?? [])
      setDueFlashcards(flashRes.count ?? 0)
      setEnrolments((enrRes.data as typeof enrolments) ?? [])
      setActivity((actRes.data as ActivityEvent[]) ?? [])
      setRecommendations((recRes.data as StudentRecommendation[]) ?? [])
      setQuizzes((quizRes.data as Quiz[]) ?? [])
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [supabase, user])

  const todayTasks = useMemo(
    () =>
      tasks.filter(
        (t) => t.due_at && isToday(parseISO(t.due_at)),
      ),
    [tasks],
  )

  const upcomingExams = useMemo(() => {
    const end = addDays(new Date(), 14)
    return tasks.filter(
      (t) =>
        t.is_exam &&
        t.status === 'pending' &&
        t.due_at &&
        parseISO(t.due_at) >= startOfDay(new Date()) &&
        parseISO(t.due_at) <= end,
    )
  }, [tasks])

  const overdueTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.due_at &&
          parseISO(t.due_at) < startOfDay(new Date()) &&
          t.status === 'pending',
      ),
    [tasks],
  )

  const chartData = useMemo(() => {
    const map = new Map<string, number>()
    for (let i = 6; i >= 0; i -= 1) {
      const d = subDays(new Date(), i)
      map.set(format(d, 'EEE'), 0)
    }
    for (const s of sessions) {
      const key = format(parseISO(s.started_at), 'EEE')
      if (map.has(key)) {
        map.set(key, (map.get(key) ?? 0) + s.duration_seconds / 60)
      }
    }
    return Array.from(map.entries()).map(([day, minutes]) => ({
      day,
      minutes: Math.round(minutes),
    }))
  }, [sessions])

  const streak = useMemo(() => computeStreak(sessions), [sessions])
  const completedSessions = sessions.filter((s) => s.duration_seconds > 0).length
  const focusGoal = preferences?.focus_minutes ?? profile?.preferred_study_duration ?? 25
  const weekMinutes = sessions.reduce((acc, s) => acc + s.duration_seconds / 60, 0)

  const quizStats = useMemo(() => {
    const submitted = attempts.filter((a) => a.submitted_at)
    const withQuiz = submitted.map((a) => {
      const q = quizzes.find((z) => z.id === a.quiz_id)
      const pct = a.max_score ? (a.score / a.max_score) * 100 : 0
      const pass = pct >= (q?.pass_mark ?? 50)
      return { pct, pass }
    })
    const avg =
      withQuiz.length === 0
        ? 0
        : Math.round(withQuiz.reduce((s, x) => s + x.pct, 0) / withQuiz.length)
    const highest = withQuiz.length ? Math.round(Math.max(...withQuiz.map((x) => x.pct))) : 0
    const passed = withQuiz.filter((x) => x.pass).length
    const failed = withQuiz.filter((x) => !x.pass).length
    return { total: submitted.length, avg, highest, passed, failed }
  }, [attempts, quizzes])

  const dismissRecommendation = async (id: string) => {
    if (!supabase) return
    await supabase.from('student_recommendations').update({ dismissed: true }).eq('id', id)
    setRecommendations((prev) => prev.filter((r) => r.id !== id))
  }

  if (!supabase) return <SupabaseSetupBanner />

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    )
  }

  const name = profile?.display_name ?? 'there'

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-primary-100 bg-gradient-to-br from-primary-50 to-accent-50 dark:from-primary-900/30 dark:to-accent-900/20">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Welcome back, {name}</CardTitle>
          <CardDescription>
            {weekMinutes > 0
              ? `You logged ${formatDuration(Math.round(weekMinutes))} of study time in the last two weeks.`
              : 'Start a focus session to begin tracking your progress.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild size="sm">
            <Link to="/app/timer">
              <Timer className="h-4 w-4" />
              Start focus
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/planner">
              <Plus className="h-4 w-4" />
              Add task
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/notes/new">
              <FileText className="h-4 w-4" />
              New note
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-3 pt-6">
            <Flame className="h-8 w-8 text-accent-600" />
            <div>
              <p className="text-2xl font-bold">{streak}</p>
              <p className="text-sm text-ink-muted">Day streak</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{completedSessions}</p>
            <p className="text-sm text-ink-muted">Recent sessions</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{formatDuration(focusGoal)}</p>
            <p className="text-sm text-ink-muted">Focus goal</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{dueFlashcards}</p>
            <p className="text-sm text-ink-muted">Flashcards due</p>
          </CardContent>
        </Card>
      </div>

      {enrolments.length > 0 ? (
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Enrolled courses</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/courses">Library</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {enrolments.map((e) =>
              e.catalogue_courses ? (
                <Link
                  key={e.id}
                  to={`/app/courses/${e.catalogue_course_id}`}
                  className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/30"
                >
                  {e.catalogue_courses.code}
                </Link>
              ) : null,
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{quizStats.total}</p>
            <p className="text-sm text-ink-muted">Quizzes taken</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{quizStats.avg}%</p>
            <p className="text-sm text-ink-muted">Average score</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{quizStats.highest}%</p>
            <p className="text-sm text-ink-muted">Highest score</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">
              {quizStats.passed}/{quizStats.passed + quizStats.failed || 0}
            </p>
            <p className="text-sm text-ink-muted">Pass / fail</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Today&apos;s tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {todayTasks.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Nothing due today"
                description="Add tasks in the planner or enjoy a lighter day."
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link to="/app/planner">Open planner</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-2">
                {todayTasks.slice(0, 5).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <span>{t.title}</span>
                    {t.priority === 'high' ? <Badge className="bg-danger text-white">High</Badge> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Upcoming exams</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingExams.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No exams scheduled"
                description="Mark tasks as exams in the planner to see them here."
              />
            ) : (
              <ul className="space-y-2">
                {upcomingExams.slice(0, 5).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <span>{t.title}</span>
                    <span className="text-ink-muted">
                      {t.due_at ? format(parseISO(t.due_at), 'MMM d') : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Study time (7 days)</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          {chartData.every((d) => d.minutes === 0) ? (
            <EmptyState title="No study sessions yet" description="Use the focus timer to log time." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [`${Number(v ?? 0)} min`, 'Study time']} />
                <Bar dataKey="minutes" fill="#1e3a5f" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Subjects</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/subjects">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {subjects.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No subjects yet"
                action={
                  <Button asChild size="sm">
                    <Link to="/app/subjects">Create subject</Link>
                  </Button>
                }
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {subjects.slice(0, 8).map((s) => (
                  <Link
                    key={s.id}
                    to={`/app/subjects/${s.id}`}
                    className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/30"
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.icon ? <span>{s.icon}</span> : null}
                    {s.name}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Recommended next</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.map((r) => (
              <div key={r.id} className="rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-sm dark:bg-accent-900/20">
                <p className="font-medium">{r.title}</p>
                <p className="text-ink-muted">{r.body}</p>
                <div className="mt-2 flex gap-2">
                  {r.action_href ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to={r.action_href}>Go</Link>
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="ghost" onClick={() => void dismissRecommendation(r.id)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
            {overdueTasks.length === 0 && dueFlashcards === 0 && recommendations.length === 0 ? (
              <p className="text-sm text-ink-muted">You&apos;re caught up — great work!</p>
            ) : null}
            {overdueTasks.slice(0, 3).map((t) => (
              <Link
                key={t.id}
                to="/app/planner"
                className={cn(
                  'block rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm',
                )}
              >
                Overdue: {t.title}
              </Link>
            ))}
            {dueFlashcards > 0 ? (
              <Link
                to="/app/flashcards"
                className="block rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-sm dark:bg-accent-900/20"
              >
                Review {dueFlashcards} flashcard{dueFlashcards === 1 ? '' : 's'}
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Recent notes</CardTitle>
          </CardHeader>
          <CardContent>
            {notes.length === 0 ? (
              <EmptyState title="No notes" description="Capture ideas in the notes editor." />
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li key={n.id}>
                    <Link
                      to={`/app/notes/${n.id}`}
                      className="text-sm font-medium text-primary-600 hover:underline"
                    >
                      {n.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent activity</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/activity">All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <EmptyState title="No activity yet" />
            ) : (
              <ul className="space-y-2 text-sm">
                {activity.map((e) => (
                  <li key={e.id} className="flex justify-between">
                    <span>{e.event_type.replaceAll('_', ' ')}</span>
                    <span className="text-ink-muted">
                      {format(parseISO(e.created_at), 'MMM d')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Recent quiz attempts</CardTitle>
          </CardHeader>
          <CardContent>
            {attempts.length === 0 ? (
              <EmptyState title="No quizzes taken" description="Practice with your quiz library." />
            ) : (
              <ul className="space-y-2 text-sm">
                {attempts.map((a) => (
                  <li key={a.id} className="flex justify-between">
                    <Link to={`/app/quizzes/${a.quiz_id}`} className="text-primary-600 hover:underline">
                      Quiz
                    </Link>
                    <span>
                      {a.score}/{a.max_score}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
