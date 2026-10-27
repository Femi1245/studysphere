import { CheckCircle2, Circle, Flag, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/auth-context'
import { trySupabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Note, Quiz, StudyTask, Subject, Topic } from '@/types/database'

export function SubjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = trySupabase()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [tasks, setTasks] = useState<StudyTask[]>([])
  const [newTopic, setNewTopic] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!supabase || !user || !id) return
    setLoading(true)
    const [subRes, topRes, noteRes, quizRes, taskRes] = await Promise.all([
      supabase.from('subjects').select('*').eq('id', id).eq('user_id', user.id).maybeSingle(),
      supabase.from('topics').select('*').eq('subject_id', id).eq('user_id', user.id).order('name'),
      supabase.from('notes').select('*').eq('subject_id', id).eq('user_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('quizzes').select('*').eq('subject_id', id).eq('user_id', user.id).order('title'),
      supabase.from('study_tasks').select('*').eq('subject_id', id).eq('user_id', user.id).order('due_at'),
    ])
    setSubject((subRes.data as Subject | null) ?? null)
    setTopics((topRes.data as Topic[]) ?? [])
    setNotes((noteRes.data as Note[]) ?? [])
    setQuizzes((quizRes.data as Quiz[]) ?? [])
    setTasks((taskRes.data as StudyTask[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user?.id, id])

  const progress = useMemo(() => {
    if (topics.length === 0) return 0
    const done = topics.filter((t) => t.completed).length
    return Math.round((done / topics.length) * 100)
  }, [topics])

  const addTopic = async () => {
    if (!supabase || !user || !id || !newTopic.trim()) return
    const { error } = await supabase.from('topics').insert({
      user_id: user.id,
      subject_id: id,
      name: newTopic.trim(),
      completed: false,
      needs_revision: false,
    })
    if (error) toast({ title: 'Could not add topic', description: error.message, kind: 'error' })
    else setNewTopic('')
    await load()
  }

  const toggleComplete = async (topic: Topic) => {
    if (!supabase) return
    await supabase
      .from('topics')
      .update({ completed: !topic.completed })
      .eq('id', topic.id)
    await load()
  }

  const toggleRevision = async (topic: Topic) => {
    if (!supabase) return
    await supabase
      .from('topics')
      .update({ needs_revision: !topic.needs_revision })
      .eq('id', topic.id)
    await load()
  }

  if (!supabase) return <SupabaseSetupBanner />
  if (loading) return <Skeleton className="h-64 rounded-2xl" />
  if (!subject) {
    return (
      <EmptyState
        title="Subject not found"
        action={
          <Button asChild variant="outline">
            <Link to="/app/subjects">Back to subjects</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="h-5 w-5 rounded-full" style={{ backgroundColor: subject.color }} />
        {subject.icon ? <span className="text-2xl">{subject.icon}</span> : null}
        <h2 className="font-display text-2xl font-semibold">{subject.name}</h2>
        <Badge variant="accent">{progress}% complete</Badge>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-primary-100">
        <div
          className="h-full bg-primary-600 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <Tabs defaultValue="topics">
        <TabsList className="rounded-xl">
          <TabsTrigger value="topics">Topics</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="topics" className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="New topic name"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void addTopic()
              }}
            />
            <Button onClick={() => void addTopic()}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          {topics.length === 0 ? (
            <EmptyState title="No topics" description="Break this subject into topics to track progress." />
          ) : (
            <ul className="space-y-2">
              {topics.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2"
                >
                  <button type="button" onClick={() => void toggleComplete(t)} aria-label="Toggle complete">
                    {t.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Circle className="h-5 w-5 text-ink-muted" />
                    )}
                  </button>
                  <span className={cn('flex-1 text-sm', t.completed && 'text-ink-muted line-through')}>
                    {t.name}
                  </span>
                  {t.needs_revision ? <Badge variant="warning">Revision</Badge> : null}
                  <Button type="button" variant="ghost" size="sm" onClick={() => void toggleRevision(t)}>
                    <Flag className="h-4 w-4" />
                    {t.needs_revision ? 'Clear revision' : 'Needs revision'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="notes">
          {notes.length === 0 ? (
            <EmptyState
              title="No notes for this subject"
              action={
                <Button asChild size="sm">
                  <Link to="/app/notes/new">Create note</Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id}>
                  <Link to={`/app/notes/${n.id}`} className="text-primary-600 hover:underline">
                    {n.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="quizzes">
          {quizzes.length === 0 ? (
            <EmptyState title="No quizzes" action={<Button asChild size="sm"><Link to="/app/quizzes">Create quiz</Link></Button>} />
          ) : (
            <ul className="space-y-2">
              {quizzes.map((q) => (
                <li key={q.id}>
                  <Link to={`/app/quizzes/${q.id}`} className="text-primary-600 hover:underline">
                    {q.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="tasks">
          {tasks.length === 0 ? (
            <EmptyState title="No tasks" action={<Button asChild size="sm"><Link to="/app/planner">Add in planner</Link></Button>} />
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <Card key={t.id} className="rounded-xl">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">{t.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-3 pt-0 text-xs text-ink-muted">
                    {t.status} · {t.priority} priority
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
