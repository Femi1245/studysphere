import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
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
import { logActivity } from '@/lib/activity'
import { submitCatalogueRequest } from '@/lib/catalogue-request'
import {
  loadStudyBooksForUser,
  upsertBookProgress,
  type StudyBookWithProgress,
} from '@/lib/study-curriculum'
import { trySupabase } from '@/lib/supabase/client'
import type {
  CatalogueCourse,
  LearningMaterial,
  MaterialType,
  QuestionBank,
  ReadingProgress,
} from '@/types/database'

const MATERIAL_LABELS: Record<MaterialType, string> = {
  lecture_notes: 'Lecture notes',
  study_guide: 'Study guide',
  definitions: 'Definitions',
  worked_examples: 'Worked examples',
  practice: 'Practice',
  revision_summary: 'Revision summary',
  past_questions: 'Past questions',
  other: 'Other',
}

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = trySupabase()
  const [loading, setLoading] = useState(true)
  const [course, setCourse] = useState<CatalogueCourse | null>(null)
  const [materials, setMaterials] = useState<LearningMaterial[]>([])
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<ReadingProgress[]>([])
  const [banks, setBanks] = useState<QuestionBank[]>([])
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [studyBooks, setStudyBooks] = useState<StudyBookWithProgress[]>([])

  const load = useCallback(async () => {
    if (!supabase || !user || !id) return
    setLoading(true)
    const [cRes, mRes, bRes, bmRes, progRes, allBooks] = await Promise.all([
      supabase.from('catalogue_courses').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('learning_materials')
        .select('*')
        .eq('catalogue_course_id', id)
        .eq('status', 'published')
        .order('title'),
      supabase
        .from('question_banks')
        .select('*')
        .eq('catalogue_course_id', id)
        .eq('is_published', true),
      supabase.from('material_bookmarks').select('material_id').eq('user_id', user.id),
      supabase.from('reading_progress').select('*').eq('user_id', user.id),
      loadStudyBooksForUser(supabase, user.id).catch(() => [] as StudyBookWithProgress[]),
    ])
    setCourse((cRes.data as CatalogueCourse | null) ?? null)
    setMaterials((mRes.data as LearningMaterial[]) ?? [])
    setBanks((bRes.data as QuestionBank[]) ?? [])
    setBookmarks(new Set((bmRes.data ?? []).map((r: { material_id: string }) => r.material_id)))
    setProgress((progRes.data as ReadingProgress[]) ?? [])
    setStudyBooks(allBooks.filter((b) => b.catalogue_course_id === id))
    setLoading(false)
  }, [supabase, user, id])

  useEffect(() => {
    void load()
  }, [load])

  const filteredMaterials = useMemo(() => {
    if (typeFilter === 'all') return materials
    return materials.filter((m) => m.material_type === typeFilter)
  }, [materials, typeFilter])

  const nextTopic = useMemo(() => {
    const incomplete = materials.filter((m) => {
      const p = progress.find((x) => x.material_id === m.id)
      return !p?.completed
    })
    return incomplete[0] ?? materials[0] ?? null
  }, [materials, progress])

  const toggleBookmark = async (materialId: string) => {
    if (!supabase || !user) return
    if (bookmarks.has(materialId)) {
      await supabase
        .from('material_bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('material_id', materialId)
      setBookmarks((prev) => {
        const n = new Set(prev)
        n.delete(materialId)
        return n
      })
    } else {
      await supabase.from('material_bookmarks').insert({ user_id: user.id, material_id: materialId })
      setBookmarks((prev) => new Set(prev).add(materialId))
      void logActivity(supabase, {
        userId: user.id,
        eventType: 'material_bookmarked',
        materialId,
        catalogueCourseId: id,
      })
    }
  }

  const requestMaterial = async () => {
    if (!supabase || !user || !course) return
    const { error } = await submitCatalogueRequest(supabase, {
      userId: user.id,
      requestType: 'material',
      title: `Materials for ${course.code}`,
      details: course.title,
    })
    if (error) toast({ title: 'Request failed', description: error, kind: 'error' })
    else toast({ title: 'Request submitted', kind: 'success' })
  }

  if (!supabase) return <SupabaseSetupBanner />
  if (loading) return <Skeleton className="h-64 rounded-2xl" />
  if (!course) {
    return (
      <EmptyState
        title="Course not found"
        action={
          <Button asChild variant="outline">
            <Link to="/app/courses">Back to library</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/app/courses">Library</Link>
        </Button>
        <h2 className="font-display text-xl font-semibold">
          {course.code} — {course.title}
        </h2>
      </div>
      {course.description ? <p className="text-sm text-ink-muted">{course.description}</p> : null}

      {studyBooks.length > 0 ? (
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">Theory & practical books</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link to="/app/study-books">Track all books</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {studyBooks.map((b) => {
                const status = b.progress?.status ?? 'not_started'
                const percent = b.progress?.progress_percent ?? 0
                return (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{b.title}</p>
                      <p className="text-ink-muted">
                        {b.book_kind === 'theory' ? 'Theory' : 'Practical'}
                        {b.author ? ` · ${b.author}` : ''} · {status.replace('_', ' ')} · {percent}%
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!supabase || !user) return
                        const next =
                          status === 'not_started'
                            ? ('in_progress' as const)
                            : status === 'in_progress'
                              ? ('completed' as const)
                              : ('not_started' as const)
                        void upsertBookProgress(supabase, user.id, b.id, {
                          status: next,
                          progress_percent:
                            next === 'completed' ? 100 : next === 'in_progress' ? 25 : 0,
                        })
                          .then(() => load())
                          .catch((e) =>
                            toast({
                              title: 'Progress update failed',
                              description: e instanceof Error ? e.message : 'Unknown error',
                              kind: 'error',
                            }),
                          )
                      }}
                    >
                      {status === 'not_started'
                        ? 'Start'
                        : status === 'in_progress'
                          ? 'Mark complete'
                          : 'Reset'}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {nextTopic ? (
        <Card className="rounded-2xl border-primary-100 bg-primary-50/50 dark:bg-primary-900/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-6">
            <p className="text-sm">
              Recommended next: <span className="font-medium">{nextTopic.title}</span>
            </p>
            <Button asChild size="sm">
              <Link to={`/app/courses/materials/${nextTopic.id}`}>Continue reading</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">Learning materials</CardTitle>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(Object.keys(MATERIAL_LABELS) as MaterialType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {MATERIAL_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {filteredMaterials.length === 0 ? (
            <EmptyState
              title="Notes for this course are not available yet"
              description="Check back later or request content from the team."
              action={
                <Button variant="outline" size="sm" onClick={() => void requestMaterial()}>
                  Request materials
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {filteredMaterials.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <Link
                      to={`/app/courses/materials/${m.id}`}
                      className="font-medium text-primary-600 hover:underline"
                    >
                      {m.title}
                    </Link>
                    <p className="text-ink-muted">{MATERIAL_LABELS[m.material_type]}</p>
                  </div>
                  <div className="flex gap-2">
                    {bookmarks.has(m.id) ? <Badge>Bookmarked</Badge> : null}
                    <Button size="sm" variant="outline" onClick={() => void toggleBookmark(m.id)}>
                      {bookmarks.has(m.id) ? 'Unbookmark' : 'Bookmark'}
                    </Button>
                    <Button asChild size="sm">
                      <Link to={`/app/courses/materials/${m.id}`}>Read</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {banks.length > 0 ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Practice quizzes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {banks.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
                <span>{b.title}</span>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/app/quizzes/practice?course=${id}&bank=${b.id}`}>Practice</Link>
                </Button>
              </div>
            ))}
            <Button asChild variant="accent" size="sm">
              <Link to={`/app/quizzes/practice?course=${id}`}>Configure practice</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Button asChild variant="outline">
          <Link to={`/app/quizzes/practice?course=${id}`}>Practice from question banks</Link>
        </Button>
      )}
    </div>
  )
}
