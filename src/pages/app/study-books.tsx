import { BookMarked, CheckCircle2, Circle, PlayCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/auth-context'
import {
  loadStudyCurriculumBundle,
  upsertBookProgress,
  type StudyBookWithProgress,
} from '@/lib/study-curriculum'
import { trySupabase } from '@/lib/supabase/client'
import type { StudyBookStatus } from '@/types/database'

function statusLabel(status: StudyBookStatus | undefined): string {
  if (status === 'completed') return 'Completed'
  if (status === 'in_progress') return 'In progress'
  return 'Not started'
}

function BookRow({
  book,
  onUpdate,
  busy,
}: {
  book: StudyBookWithProgress
  onUpdate: (bookId: string, status: StudyBookStatus, percent?: number) => void
  busy: boolean
}) {
  const status = book.progress?.status ?? 'not_started'
  const percent = book.progress?.progress_percent ?? 0

  return (
    <li className="rounded-xl border border-border px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{book.title}</p>
            <Badge variant={book.book_kind === 'theory' ? 'default' : 'accent'}>
              {book.book_kind === 'theory' ? 'Theory' : 'Practical'}
            </Badge>
          </div>
          <p className="text-sm text-ink-muted">
            {book.author ? `${book.author}` : 'Curriculum text'}
            {book.edition ? ` · ${book.edition}` : ''}
          </p>
          <p className="text-sm text-ink">
            Subject: <span className="font-medium">{book.subject_label}</span>
            {book.course ? ` · ${book.course.code}` : ''}
          </p>
          {book.description ? (
            <p className="text-xs text-ink-muted">{book.description}</p>
          ) : null}
          <div className="pt-1">
            <div className="mb-1 flex items-center justify-between text-xs text-ink-muted">
              <span>{statusLabel(status)}</span>
              <span>{percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary-500 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === 'not_started' ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onUpdate(book.id, 'in_progress', 10)}
            >
              <PlayCircle className="h-4 w-4" />
              Start
            </Button>
          ) : null}
          {status === 'in_progress' ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  onUpdate(book.id, 'in_progress', Math.min(90, Math.max(percent, 10) + 20))
                }
              >
                +20%
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => onUpdate(book.id, 'completed', 100)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Complete
              </Button>
            </>
          ) : null}
          {status === 'completed' ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onUpdate(book.id, 'in_progress', 80)}
            >
              <Circle className="h-4 w-4" />
              Reopen
            </Button>
          ) : null}
          {book.course ? (
            <Button asChild size="sm" variant="ghost">
              <Link to={`/app/courses/${book.course.id}`}>Course</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export function StudyBooksPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = trySupabase()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [books, setBooks] = useState<StudyBookWithProgress[]>([])
  const [subjectCount, setSubjectCount] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)

  const load = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    try {
      const bundle = await loadStudyCurriculumBundle(supabase, user.id)
      setBooks(bundle.books)
      setSubjectCount(bundle.subjects.length)
      setCompletedCount(bundle.completedCount)
    } catch (e) {
      toast({
        title: 'Could not load study list',
        description: e instanceof Error ? e.message : 'Unknown error',
        kind: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [supabase, user, toast])

  useEffect(() => {
    void load()
  }, [load])

  const theory = useMemo(() => books.filter((b) => b.book_kind === 'theory'), [books])
  const practical = useMemo(() => books.filter((b) => b.book_kind === 'practical'), [books])

  const update = async (bookId: string, status: StudyBookStatus, percent?: number) => {
    if (!supabase || !user) return
    setBusy(true)
    try {
      await upsertBookProgress(supabase, user.id, bookId, {
        status,
        progress_percent: percent,
      })
      await load()
      toast({ title: 'Progress saved', kind: 'success' })
    } catch (e) {
      toast({
        title: 'Update failed',
        description: e instanceof Error ? e.message : 'Apply the curriculum SQL migration in Supabase.',
        kind: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  if (!supabase) return <SupabaseSetupBanner />
  if (loading) return <Skeleton className="h-72 rounded-2xl" />

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Study books</h2>
        <p className="text-sm text-ink-muted">
          Theory and practical books for subjects linked to your academic profile. Track what you
          have started and completed.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-xs text-ink-muted">Subjects synced</p>
            <p className="text-2xl font-semibold">{subjectCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-xs text-ink-muted">Books listed</p>
            <p className="text-2xl font-semibold">{books.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-xs text-ink-muted">Completed</p>
            <p className="text-2xl font-semibold">{completedCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/app/subjects">My subjects</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/app/academic-profile">Academic profile</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/app/progress">Progress record</Link>
        </Button>
      </div>

      {books.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="No study books yet"
          description="Save your academic profile with a programme or course of study. StudySphere will load matching theory and practical books for that subject."
          action={
            <Button asChild size="sm">
              <Link to="/app/academic-profile">Open academic profile</Link>
            </Button>
          }
        />
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="rounded-xl">
            <TabsTrigger value="all">All ({books.length})</TabsTrigger>
            <TabsTrigger value="theory">Theory ({theory.length})</TabsTrigger>
            <TabsTrigger value="practical">Practical ({practical.length})</TabsTrigger>
          </TabsList>
          {(
            [
              ['all', books],
              ['theory', theory],
              ['practical', practical],
            ] as const
          ).map(([key, list]) => (
            <TabsContent key={key} value={key} className="space-y-3">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base">
                    {key === 'all'
                      ? 'Recommended reading list'
                      : key === 'theory'
                        ? 'Theory books'
                        : 'Practical books'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {list.map((book) => (
                      <BookRow key={book.id} book={book} onUpdate={update} busy={busy} />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
