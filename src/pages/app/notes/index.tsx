import { FileText, Pin, Plus, Search, Star } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/auth-context'
import { trySupabase } from '@/lib/supabase/client'
import type { Note } from '@/types/database'

type Filter = 'all' | 'pinned' | 'favorite'

export function NotesPage() {
  const { user } = useAuth()
  const supabase = trySupabase()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const load = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })
    setNotes((data as Note[]) ?? [])
    setLoading(false)
  }, [supabase, user])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    let list = notes
    if (filter === 'pinned') list = list.filter((n) => n.pinned)
    if (filter === 'favorite') list = list.filter((n) => n.favorite)
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q),
    )
  }, [notes, search, filter])

  if (!supabase) return <SupabaseSetupBanner />

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            className="pl-9"
            placeholder="Search notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button asChild>
          <Link to="/app/notes/new">
            <Plus className="h-4 w-4" />
            New note
          </Link>
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="rounded-xl">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pinned">
            <Pin className="mr-1 h-3 w-3" />
            Pinned
          </TabsTrigger>
          <TabsTrigger value="favorite">
            <Star className="mr-1 h-3 w-3" />
            Favorites
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No notes found"
          description="Create rich notes with the editor."
          action={
            <Button asChild>
              <Link to="/app/notes/new">Create note</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((n) => (
            <Link key={n.id} to={`/app/notes/${n.id}`}>
              <Card className="rounded-2xl transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    {n.pinned ? <Pin className="h-4 w-4 text-accent-600" /> : null}
                    {n.favorite ? <Star className="h-4 w-4 fill-accent-500 text-accent-500" /> : null}
                    <CardTitle className="text-base">{n.title}</CardTitle>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {n.content.replace(/<[^>]+>/g, '').slice(0, 120)}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
