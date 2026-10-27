import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { CalendarDays, Check, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/auth-context'
import { trySupabase } from '@/lib/supabase/client'
import { cn, formatDuration } from '@/lib/utils'
import type { StudyTask, Subject, TaskPriority } from '@/types/database'

type TaskForm = {
  title: string
  description: string
  subject_id: string
  due_at: string
  priority: TaskPriority
  estimated_minutes: string
  is_exam: boolean
  is_revision: boolean
}

const defaultForm: TaskForm = {
  title: '',
  description: '',
  subject_id: '',
  due_at: '',
  priority: 'medium',
  estimated_minutes: '',
  is_exam: false,
  is_revision: false,
}

export function PlannerPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = trySupabase()
  const [tasks, setTasks] = useState<StudyTask[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [courseHints, setCourseHints] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StudyTask | null>(null)
  const [form, setForm] = useState<TaskForm>(defaultForm)
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()))

  const load = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    const [tRes, sRes, eRes] = await Promise.all([
      supabase.from('study_tasks').select('*').eq('user_id', user.id).order('due_at'),
      supabase.from('subjects').select('*').eq('user_id', user.id).order('name'),
      supabase
        .from('student_course_enrolments')
        .select('catalogue_courses(code, title)')
        .eq('user_id', user.id)
        .eq('status', 'active'),
    ])
    setTasks((tRes.data as StudyTask[]) ?? [])
    setSubjects((sRes.data as Subject[]) ?? [])
    const hints: string[] = []
    for (const row of eRes.data ?? []) {
      const raw = (row as { catalogue_courses?: unknown }).catalogue_courses
      const course = Array.isArray(raw) ? raw[0] : raw
      if (course && typeof course === 'object' && 'code' in course && 'title' in course) {
        const c = course as { code: string; title: string }
        hints.push(`Study ${c.code}: ${c.title}`)
      }
    }
    setCourseHints(hints.slice(0, 6))
    setLoading(false)
  }, [supabase, user])

  useEffect(() => {
    void load()
  }, [load])

  const pending = useMemo(() => tasks.filter((t) => t.status === 'pending'), [tasks])

  const isOverdue = (t: StudyTask) =>
    t.status === 'pending' && t.due_at && isBefore(parseISO(t.due_at), startOfDay(new Date()))

  const openCreate = () => {
    setEditing(null)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  const openEdit = (t: StudyTask) => {
    setEditing(t)
    setForm({
      title: t.title,
      description: t.description ?? '',
      subject_id: t.subject_id ?? '',
      due_at: t.due_at ? format(parseISO(t.due_at), "yyyy-MM-dd'T'HH:mm") : '',
      priority: t.priority,
      estimated_minutes: t.estimated_minutes?.toString() ?? '',
      is_exam: t.is_exam,
      is_revision: t.is_revision,
    })
    setDialogOpen(true)
  }

  const save = async () => {
    if (!supabase || !user || !form.title.trim()) return
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      subject_id: form.subject_id || null,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      priority: form.priority,
      estimated_minutes: form.estimated_minutes
        ? Number.parseInt(form.estimated_minutes, 10)
        : null,
      is_exam: form.is_exam,
      is_revision: form.is_revision,
      status: 'pending' as const,
    }
    if (editing) {
      const { error } = await supabase.from('study_tasks').update(payload).eq('id', editing.id)
      if (error) toast({ title: 'Update failed', description: error.message, kind: 'error' })
    } else {
      const { error } = await supabase.from('study_tasks').insert({ ...payload, user_id: user.id })
      if (error) toast({ title: 'Create failed', description: error.message, kind: 'error' })
    }
    setDialogOpen(false)
    await load()
  }

  const complete = async (id: string) => {
    if (!supabase) return
    await supabase
      .from('study_tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id)
    await load()
  }

  const remove = async (id: string) => {
    if (!supabase || !confirm('Delete task?')) return
    await supabase.from('study_tasks').delete().eq('id', id)
    await load()
  }

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth))
    const end = endOfWeek(endOfMonth(calendarMonth))
    return eachDayOfInterval({ start, end })
  }, [calendarMonth])

  const tasksForDay = (day: Date) =>
    pending.filter((t) => t.due_at && isSameDay(parseISO(t.due_at), day))

  const TaskRow = ({ t }: { t: StudyTask }) => (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
      <button
        type="button"
        className="rounded-lg p-1 hover:bg-primary-50"
        onClick={() => void complete(t.id)}
        aria-label="Mark complete"
      >
        <Check className="h-4 w-4" />
      </button>
      <button type="button" className="flex-1 text-left" onClick={() => openEdit(t)}>
        {t.title}
      </button>
      {isOverdue(t) ? <Badge variant="danger">Overdue</Badge> : null}
      {t.is_exam ? <Badge variant="warning">Exam</Badge> : null}
      {t.due_at ? (
        <span className="text-xs text-ink-muted">{format(parseISO(t.due_at), 'MMM d, h:mm a')}</span>
      ) : null}
      {t.estimated_minutes ? (
        <span className="text-xs text-ink-muted">{formatDuration(t.estimated_minutes)}</span>
      ) : null}
      <Button type="button" variant="ghost" size="sm" onClick={() => void remove(t.id)}>
        Delete
      </Button>
    </div>
  )

  if (!supabase) return <SupabaseSetupBanner />

  if (loading) return <Skeleton className="h-96 rounded-2xl" />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New task
        </Button>
      </div>

      {courseHints.length > 0 ? (
        <Card className="rounded-2xl border-primary-100 bg-primary-50/50 dark:bg-primary-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Suggested from your courses</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {courseHints.map((hint) => (
              <Button
                key={hint}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(null)
                  setForm({ ...defaultForm, title: hint })
                  setDialogOpen(true)
                }}
              >
                {hint}
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="list">
        <TabsList className="rounded-xl">
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-2">
          {pending.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No pending tasks" action={<Button onClick={openCreate}>Add task</Button>} />
          ) : (
            pending.map((t) => <TaskRow key={t.id} t={t} />)
          )}
        </TabsContent>

        <TabsContent value="day" className="space-y-2">
          <p className="text-sm font-medium">{format(new Date(), 'EEEE, MMM d')}</p>
          {tasksForDay(new Date()).length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing scheduled for today.</p>
          ) : (
            tasksForDay(new Date()).map((t) => <TaskRow key={t.id} t={t} />)
          )}
        </TabsContent>

        <TabsContent value="week" className="space-y-4">
          {eachDayOfInterval({
            start: startOfWeek(new Date()),
            end: endOfWeek(new Date()),
          }).map((day) => (
            <div key={day.toISOString()}>
              <p className="mb-2 text-sm font-medium">{format(day, 'EEE MMM d')}</p>
              <div className="space-y-2">
                {tasksForDay(day).map((t) => (
                  <TaskRow key={t.id} t={t} />
                ))}
                {tasksForDay(day).length === 0 ? (
                  <p className="text-xs text-ink-muted">—</p>
                ) : null}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="calendar">
          <div className="mb-4 flex items-center justify-between">
            <Button type="button" variant="outline" size="sm" onClick={() => setCalendarMonth((m) => addMonths(m, -1))}>
              Prev
            </Button>
            <span className="font-medium">{format(calendarMonth, 'MMMM yyyy')}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setCalendarMonth((m) => addMonths(m, 1))}>
              Next
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink-muted">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthDays.map((day) => {
              const count = tasksForDay(day).length
              return (
                <Card
                  key={day.toISOString()}
                  className={cn(
                    'min-h-16 rounded-lg p-1',
                    !isSameMonth(day, calendarMonth) && 'opacity-40',
                  )}
                >
                  <CardHeader className="p-1">
                    <CardTitle className="text-xs">{format(day, 'd')}</CardTitle>
                  </CardHeader>
                  {count > 0 ? (
                    <CardContent className="p-1 pt-0">
                      <span className="text-[10px] text-accent-600">{count} task{count > 1 ? 's' : ''}</span>
                    </CardContent>
                  ) : null}
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit task' : 'New task'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={form.subject_id || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, subject_id: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input type="datetime-local" value={form.due_at} onChange={(e) => setForm((f) => ({ ...f, due_at: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as TaskPriority }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estimated minutes</Label>
              <Input type="number" value={form.estimated_minutes} onChange={(e) => setForm((f) => ({ ...f, estimated_minutes: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_exam} onChange={(e) => setForm((f) => ({ ...f, is_exam: e.target.checked }))} />
              Exam
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_revision} onChange={(e) => setForm((f) => ({ ...f, is_revision: e.target.checked }))} />
              Revision
            </label>
            <Button className="w-full" onClick={() => void save()} disabled={!form.title.trim()}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
