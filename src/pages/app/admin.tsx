import { useCallback, useEffect, useState } from 'react'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { trySupabase } from '@/lib/supabase/client'
import type { SupportRequest } from '@/types/database'

export function AdminPage() {
  const { toast } = useToast()
  const supabase = trySupabase()
  const [loading, setLoading] = useState(true)
  const [subjectCount, setSubjectCount] = useState<number | null>(null)
  const [userCount, setUserCount] = useState<number | null>(null)
  const [requests, setRequests] = useState<SupportRequest[]>([])

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const [subRes, profRes, reqRes] = await Promise.all([
      supabase.from('subjects').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('support_requests').select('*').order('created_at', { ascending: false }),
    ])
    setSubjectCount(subRes.error ? null : subRes.count)
    setUserCount(profRes.error ? null : profRes.count)
    setRequests((reqRes.data as SupportRequest[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  const updateStatus = async (id: string, status: SupportRequest['status']) => {
    if (!supabase) return
    const { error } = await supabase.from('support_requests').update({ status }).eq('id', id)
    if (error) toast({ title: 'Update failed', description: error.message, kind: 'error' })
    else await load()
  }

  if (!supabase) return <SupabaseSetupBanner />
  if (loading) return <Skeleton className="h-64 rounded-2xl" />

  const aggregatesAvailable = subjectCount !== null || userCount !== null

  return (
    <div className="space-y-6">
      {aggregatesAvailable ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {subjectCount !== null ? (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Total subjects</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{subjectCount}</p>
              </CardContent>
            </Card>
          ) : null}
          {userCount !== null ? (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Registered users</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{userCount}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-ink-muted">
          Aggregate counts are hidden by row-level security. Use the support inbox below.
        </p>
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Support inbox</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.length === 0 ? (
            <p className="text-sm text-ink-muted">No support requests.</p>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{r.subject}</p>
                  <Badge variant={r.status === 'open' ? 'warning' : 'outline'}>{r.status}</Badge>
                </div>
                <p className="text-ink-muted">{r.email}</p>
                <p className="mt-2 whitespace-pre-wrap">{r.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Select
                    value={r.status}
                    onValueChange={(v) => void updateStatus(r.id, v as SupportRequest['status'])}
                  >
                    <SelectTrigger className="h-9 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" onClick={() => void updateStatus(r.id, 'closed')}>
                    Close
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
