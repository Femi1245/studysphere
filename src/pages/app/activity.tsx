import { format, parseISO } from 'date-fns'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Badge } from '@/components/ui/badge'
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
import { useAuth } from '@/contexts/auth-context'
import { trySupabase } from '@/lib/supabase/client'
import type { ActivityEvent, QuizAttempt } from '@/types/database'

const PAGE_SIZE = 30

export function ActivityPage() {
  const { user } = useAuth()
  const supabase = trySupabase()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [eventFilter, setEventFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const fetchPage = useCallback(
    async (pageIndex: number, replace: boolean) => {
      if (!supabase || !user) return
      if (replace) setLoading(true)
      let q = supabase
        .from('activity_events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE - 1)

      if (eventFilter) q = q.eq('event_type', eventFilter)
      if (fromDate) q = q.gte('created_at', new Date(fromDate).toISOString())
      if (toDate) {
        const end = new Date(toDate)
        end.setHours(23, 59, 59, 999)
        q = q.lte('created_at', end.toISOString())
      }

      const { data } = await q
      const rows = (data as ActivityEvent[]) ?? []
      setHasMore(rows.length === PAGE_SIZE)
      setEvents((prev) => (replace ? rows : [...prev, ...rows]))
      if (replace) setLoading(false)
    },
    [supabase, user, eventFilter, fromDate, toDate],
  )

  useEffect(() => {
    setPage(0)
    void fetchPage(0, true)
  }, [fetchPage])

  useEffect(() => {
    if (!supabase || !user) return
    void supabase
      .from('quiz_attempts')
      .select('*')
      .eq('user_id', user.id)
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setAttempts((data as QuizAttempt[]) ?? []))
  }, [supabase, user])

  const eventTypes = [...new Set(events.map((e) => e.event_type))]

  const loadMore = () => {
    const next = page + 1
    setPage(next)
    void fetchPage(next, false)
  }

  if (!supabase) return <SupabaseSetupBanner />
  if (loading && events.length === 0) return <Skeleton className="h-64 rounded-2xl" />

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Event type</Label>
            <Select value={eventFilter || 'all'} onValueChange={(v) => setEventFilter(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {eventTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <EmptyState title="No activity yet" description="Study sessions and quizzes will appear here." />
          ) : (
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                  <div>
                    <Badge variant="outline">{e.event_type}</Badge>
                    <span className="ml-2 text-ink-muted">
                      {format(parseISO(e.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  {e.quiz_id ? (
                    <Link to={`/app/quizzes/${e.quiz_id}`} className="text-primary-600 hover:underline">
                      View quiz
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {hasMore ? (
            <Button type="button" variant="outline" className="mt-4" onClick={loadMore}>
              Load more
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Quiz attempt history</CardTitle>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <p className="text-sm text-ink-muted">No submitted attempts.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {attempts.map((a) => (
                <li key={a.id} className="flex justify-between rounded-xl border border-border px-3 py-2">
                  <Link to={`/app/quizzes/${a.quiz_id}`} className="text-primary-600 hover:underline">
                    Attempt {format(parseISO(a.submitted_at!), 'MMM d')}
                  </Link>
                  <span>
                    {a.score}/{a.max_score} (
                    {a.max_score ? Math.round((a.score / a.max_score) * 100) : 0}%)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
