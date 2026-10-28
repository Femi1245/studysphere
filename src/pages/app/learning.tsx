import { Lightbulb, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/auth-context'
import {
  dismissRecommendation,
  loadWeakTopics,
  regenerateRecommendations,
  type WeakTopic,
} from '@/lib/learning-engine'
import { trySupabase } from '@/lib/supabase/client'
import type { StudentRecommendation } from '@/types/database'

export function LearningPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = trySupabase()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [recs, setRecs] = useState<StudentRecommendation[]>([])
  const [weak, setWeak] = useState<WeakTopic[]>([])

  const load = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    const [{ data }, topics] = await Promise.all([
      supabase
        .from('student_recommendations')
        .select('*')
        .eq('user_id', user.id)
        .eq('dismissed', false)
        .order('created_at', { ascending: false }),
      loadWeakTopics(supabase, user.id),
    ])
    setRecs((data as StudentRecommendation[]) ?? [])
    setWeak(topics)
    setLoading(false)
  }, [supabase, user])

  useEffect(() => {
    void load()
  }, [load])

  const refresh = async () => {
    if (!supabase || !user) return
    setRefreshing(true)
    try {
      await regenerateRecommendations(supabase, user.id)
      await load()
      toast({ title: 'Recommendations updated', kind: 'success' })
    } catch (e) {
      toast({
        title: 'Refresh failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        kind: 'error',
      })
    } finally {
      setRefreshing(false)
    }
  }

  const dismiss = async (id: string) => {
    if (!supabase || !user) return
    await dismissRecommendation(supabase, user.id, id)
    setRecs((r) => r.filter((x) => x.id !== id))
  }

  if (!supabase) return <SupabaseSetupBanner />
  if (loading) return <Skeleton className="h-64 rounded-2xl" />

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Personalized learning</h2>
          <p className="text-sm text-ink-muted">
            Recommendations use multiple quiz attempts — not a single score. You can dismiss any
            item that feels inaccurate.
          </p>
        </div>
        <Button type="button" onClick={() => void refresh()} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh insights
        </Button>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Topics needing revision</CardTitle>
        </CardHeader>
        <CardContent>
          {weak.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Not enough multi-attempt data yet. Complete at least two quizzes with repeated misses
              on a topic to unlock revision signals.
            </p>
          ) : (
            <ul className="space-y-2">
              {weak.map((w) => (
                <li
                  key={w.topicKey}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{w.topicKey}</p>
                    <p className="text-xs text-ink-muted">
                      {w.incorrectCount} incorrect · {w.correctCount} correct · {w.distinctAttempts}{' '}
                      attempts · {Math.round(w.accuracy * 100)}% accuracy
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to={`/app/exams?topic=${encodeURIComponent(w.topicKey)}&mode=practice&difficulty=easy&count=10`}
                    >
                      Practice
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {recs.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No open recommendations"
          description="Take exams on your enrolled courses, then refresh insights."
          action={
            <Button asChild size="sm">
              <Link to="/app/exams">Open examination centre</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {recs.map((r) => (
            <Card key={r.id} className="rounded-2xl">
              <CardContent className="space-y-2 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.title}</p>
                    <p className="mt-1 text-sm text-ink-muted">{r.body}</p>
                    {r.reason ? (
                      <p className="mt-2 text-xs text-primary-700 dark:text-primary-300">
                        Why: {r.reason}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Dismiss"
                    onClick={() => void dismiss(r.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {r.action_href ? (
                  <Button asChild size="sm">
                    <Link to={r.action_href}>Open</Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
