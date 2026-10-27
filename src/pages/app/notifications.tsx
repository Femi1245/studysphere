import { formatDistanceToNow, parseISO } from 'date-fns'
import { Bell } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/auth-context'
import { trySupabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types/database'

export function NotificationsPage() {
  const { user } = useAuth()
  const supabase = trySupabase()
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setItems((data as Notification[]) ?? [])
    setLoading(false)
  }, [supabase, user])

  useEffect(() => {
    void load()
  }, [load])

  const markRead = async (id: string) => {
    if (!supabase) return
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setItems((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const markAllRead = async () => {
    if (!supabase || !user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id)
    setItems((list) => list.map((n) => ({ ...n, read: true })))
  }

  if (!supabase) return <SupabaseSetupBanner />
  if (loading) return <Skeleton className="h-64 rounded-2xl" />

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
          Mark all read
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="Updates about tasks and goals appear here." />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const inner = (
              <Card
                className={cn(
                  'rounded-2xl transition-colors',
                  !n.read && 'border-accent-200 bg-accent-50/50 dark:bg-accent-900/10',
                )}
              >
                <CardContent className="flex items-start justify-between gap-3 py-4">
                  <div>
                    <p className="font-medium">{n.title}</p>
                    <p className="text-sm text-ink-muted">{n.body}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.read ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => void markRead(n.id)}>
                      Mark read
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            )
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link
                    to={n.link}
                    onClick={() => void markRead(n.id)}
                    className="block"
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
