import { BookOpen, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { subjectColors } from '@/config/brand'
import { useAuth } from '@/contexts/auth-context'
import { syncSubjectsFromAcademicProfile } from '@/lib/study-curriculum'
import { trySupabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Subject } from '@/types/database'

type SubjectForm = {
  name: string
  color: string
  icon: string
  goal: string
}

const emptyForm: SubjectForm = {
  name: '',
  color: subjectColors[0],
  icon: '',
  goal: '',
}

export function SubjectsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = trySupabase()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [form, setForm] = useState<SubjectForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    try {
      const synced = await syncSubjectsFromAcademicProfile(supabase, user.id)
      if (synced.length) {
        setSubjects(synced)
        setLoading(false)
        return
      }
    } catch {
      // fall through to plain load
    }
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
    if (error) toast({ title: 'Failed to load subjects', description: error.message, kind: 'error' })
    setSubjects((data as Subject[]) ?? [])
    setLoading(false)
  }, [supabase, user, toast])

  const syncFromProfile = async () => {
    if (!supabase || !user) return
    setSyncing(true)
    try {
      const synced = await syncSubjectsFromAcademicProfile(supabase, user.id)
      setSubjects(synced)
      toast({
        title: 'Subjects updated from academic profile',
        description: `${synced.length} subject(s) available.`,
        kind: 'success',
      })
    } catch (e) {
      toast({
        title: 'Sync failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        kind: 'error',
      })
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return subjects
    return subjects.filter((s) => s.name.toLowerCase().includes(q))
  }, [subjects, search])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (s: Subject) => {
    setEditing(s)
    setForm({
      name: s.name,
      color: s.color,
      icon: s.icon ?? '',
      goal: s.goal ?? '',
    })
    setDialogOpen(true)
  }

  const save = async () => {
    if (!supabase || !user || !form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      color: form.color,
      icon: form.icon.trim() || null,
      goal: form.goal.trim() || null,
    }
    if (editing) {
      const { error } = await supabase.from('subjects').update(payload).eq('id', editing.id)
      if (error) toast({ title: 'Update failed', description: error.message, kind: 'error' })
      else toast({ title: 'Subject updated', kind: 'success' })
    } else {
      const { error } = await supabase.from('subjects').insert({ ...payload, user_id: user.id })
      if (error) toast({ title: 'Create failed', description: error.message, kind: 'error' })
      else toast({ title: 'Subject created', kind: 'success' })
    }
    setSaving(false)
    setDialogOpen(false)
    await load()
  }

  const remove = async (id: string) => {
    if (!supabase || !confirm('Delete this subject? Related data may be affected.')) return
    const { error } = await supabase.from('subjects').delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, kind: 'error' })
    else await load()
  }

  if (!supabase) return <SupabaseSetupBanner />

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            className="pl-9"
            placeholder="Search subjects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/app/study-books">Theory & practical books</Link>
          </Button>
          <Button variant="outline" disabled={syncing} onClick={() => void syncFromProfile()}>
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync from profile
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New subject
          </Button>
        </div>
      </div>

      <p className="text-sm text-ink-muted">
        Subjects related to your academic programme / course of study are added automatically when
        you save your academic profile or tap Sync.
      </p>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={search ? 'No matches' : 'No subjects yet'}
          description="Save your academic profile to load related subjects, or create one manually."
          action={
            !search ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild variant="outline">
                  <Link to="/app/academic-profile">Academic profile</Link>
                </Button>
                <Button onClick={openCreate}>Create subject</Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Card key={s.id} className="rounded-2xl">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/app/subjects/${s.id}`} className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.icon ? <span className="text-lg">{s.icon}</span> : null}
                    <CardTitle className="text-base">{s.name}</CardTitle>
                  </Link>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => void remove(s.id)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
                {s.goal ? <CardDescription className="line-clamp-2">{s.goal}</CardDescription> : null}
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to={`/app/subjects/${s.id}`}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit subject' : 'New subject'}</DialogTitle>
            <DialogDescription>Name, color, and optional emoji icon.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sub-name">Name</Label>
              <Input
                id="sub-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {subjectColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      'h-8 w-8 rounded-full ring-2 ring-offset-2',
                      form.color === c ? 'ring-accent-500' : 'ring-transparent',
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-icon">Icon emoji (optional)</Label>
              <Input
                id="sub-icon"
                value={form.icon}
                maxLength={4}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-goal">Goal (optional)</Label>
              <Input
                id="sub-goal"
                value={form.goal}
                onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
              />
            </div>
            <Button className="w-full" disabled={saving || !form.name.trim()} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
