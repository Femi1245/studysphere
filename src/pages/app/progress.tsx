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
import { trySupabase } from '@/lib/supabase/client'
import type { QuizAttempt, StudySession, StudyTask, Subject, Topic } from '@/types/database'

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

  const load = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    const since = subDays(new Date(), range).toISOString()
    const [sess, task, att, top, sub, rev] = await Promise.all([
      supabase.from('study_sessions').select('*').eq('user_id', user.id).gte('started_at', since),
      supabase.from('study_tasks').select('*').eq('user_id', user.id).eq('status', 'completed').gte('completed_at', since),
      supabase.from('quiz_attempts').select('*').eq('user_id', user.id).gte('created_at', since),
      supabase.from('topics').select('*').eq('user_id', user.id),
      supabase.from('subjects').select('*').eq('user_id', user.id),
      supabase.from('flashcard_reviews').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('reviewed_at', since),
    ])
    setSessions((sess.data as StudySession[]) ?? [])
    setTasks((task.data as StudyTask[]) ?? [])
    setAttempts((att.data as QuizAttempt[]) ?? [])
    setTopics((top.data as Topic[]) ?? [])
    setSubjects((sub.data as Subject[]) ?? [])
    setReviewCount(rev.count ?? 0)
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

      {revisionTopics.length > 0 ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Topics needing revision</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm">
              {revisionTopics.map((t) => (
                <li key={t.id}>{t.name}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
