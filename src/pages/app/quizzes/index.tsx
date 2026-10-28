import { GraduationCap, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useAuth } from '@/contexts/auth-context'
import { trySupabase } from '@/lib/supabase/client'
import type { Quiz, Subject } from '@/types/database'

export function QuizzesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = trySupabase()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [duration, setDuration] = useState('')

  const load = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    const [qRes, sRes] = await Promise.all([
      supabase.from('quizzes').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('subjects').select('*').eq('user_id', user.id),
    ])
    setQuizzes((qRes.data as Quiz[]) ?? [])
    setSubjects((sRes.data as Subject[]) ?? [])
    setLoading(false)
  }, [supabase, user])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    if (!supabase || !user || !title.trim()) return
    const { data, error } = await supabase
      .from('quizzes')
      .insert({
        user_id: user.id,
        title: title.trim(),
        subject_id: subjectId || null,
        duration_minutes: duration ? Number.parseInt(duration, 10) : null,
      })
      .select('id')
      .single()
    if (error) {
      toast({ title: 'Create failed', description: error.message, kind: 'error' })
      return
    }
    setOpen(false)
    setTitle('')
    setSubjectId('')
    setDuration('')
    await load()
    if (data) window.location.href = `/app/quizzes/${data.id}`
  }

  if (!supabase) return <SupabaseSetupBanner />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="outline">
          <Link to="/app/exams">Examination centre</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/app/learning">Learning insights</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/app/quizzes/practice">Course assessment</Link>
        </Button>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Create quiz
        </Button>
      </div>
      {loading ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : quizzes.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No quizzes yet" action={<Button onClick={() => setOpen(true)}>Create quiz</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {quizzes.map((q) => (
            <Link key={q.id} to={`/app/quizzes/${q.id}`}>
              <Card className="rounded-2xl hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-base">{q.title}</CardTitle>
                  {q.duration_minutes ? (
                    <p className="text-sm text-ink-muted">{q.duration_minutes} min</p>
                  ) : null}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>New quiz</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={subjectId || 'none'} onValueChange={(v) => setSubjectId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duration (minutes, optional)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => void create()} disabled={!title.trim()}>
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
