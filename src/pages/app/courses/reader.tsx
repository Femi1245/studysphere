import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/auth-context'
import { logActivity } from '@/lib/activity'
import { trySupabase } from '@/lib/supabase/client'
import type { LearningMaterial, ReadingProgress } from '@/types/database'

export function CourseReaderPage() {
  const { materialId } = useParams<{ materialId: string }>()
  const { user, profile, session } = useAuth()
  const { toast } = useToast()
  const supabase = trySupabase()
  const [loading, setLoading] = useState(true)
  const [material, setMaterial] = useState<LearningMaterial | null>(null)
  const [siblings, setSiblings] = useState<LearningMaterial[]>([])
  const [progress, setProgress] = useState<ReadingProgress | null>(null)
  const [bookmarked, setBookmarked] = useState(false)
  const [search, setSearch] = useState('')
  const [annotation, setAnnotation] = useState('')
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const load = useCallback(async () => {
    if (!supabase || !user || !materialId) return
    setLoading(true)
    const { data: mat } = await supabase
      .from('learning_materials')
      .select('*')
      .eq('id', materialId)
      .maybeSingle()
    const m = (mat as LearningMaterial | null) ?? null
    setMaterial(m)

    if (m) {
      const [sib, prog, bm] = await Promise.all([
        supabase
          .from('learning_materials')
          .select('*')
          .eq('catalogue_course_id', m.catalogue_course_id)
          .eq('status', 'published')
          .order('title'),
        supabase
          .from('reading_progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('material_id', materialId)
          .maybeSingle(),
        supabase
          .from('material_bookmarks')
          .select('id')
          .eq('user_id', user.id)
          .eq('material_id', materialId)
          .maybeSingle(),
      ])
      setSiblings((sib.data as LearningMaterial[]) ?? [])
      setProgress((prog.data as ReadingProgress | null) ?? null)
      setBookmarked(Boolean(bm.data))

      if (m.file_path) {
        const { data: signed } = await supabase.storage
          .from('learning-materials')
          .createSignedUrl(m.file_path, 3600)
        setFileUrl(signed?.signedUrl ?? null)
      } else {
        setFileUrl(null)
      }

      void logActivity(supabase, {
        userId: user.id,
        eventType: 'material_opened',
        materialId: m.id,
        catalogueCourseId: m.catalogue_course_id,
      })
    }
    setLoading(false)
  }, [supabase, user, materialId])

  useEffect(() => {
    void load()
  }, [load])

  const searchableText = useMemo(() => {
    if (!material) return ''
    return [material.extracted_text, material.content_html?.replace(/<[^>]+>/g, ' ')]
      .filter(Boolean)
      .join('\n')
  }, [material])

  const searchHit = useMemo(() => {
    if (!search.trim() || !searchableText) return null
    const idx = searchableText.toLowerCase().indexOf(search.trim().toLowerCase())
    if (idx < 0) return 'No matches in this material.'
    const start = Math.max(0, idx - 40)
    return searchableText.slice(start, idx + search.length + 40)
  }, [search, searchableText])

  const toggleBookmark = async () => {
    if (!supabase || !user || !materialId) return
    if (bookmarked) {
      await supabase
        .from('material_bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('material_id', materialId)
      setBookmarked(false)
    } else {
      await supabase.from('material_bookmarks').insert({ user_id: user.id, material_id: materialId })
      setBookmarked(true)
      void logActivity(supabase, {
        userId: user.id,
        eventType: 'material_bookmarked',
        materialId,
        catalogueCourseId: material?.catalogue_course_id,
      })
    }
  }

  const saveAnnotation = async () => {
    if (!supabase || !user || !materialId || !annotation.trim()) return
    await supabase.from('material_annotations').insert({
      user_id: user.id,
      material_id: materialId,
      note: annotation.trim(),
    })
    setAnnotation('')
    toast({ title: 'Note saved', kind: 'success' })
  }

  const markComplete = async () => {
    if (!supabase || !user || !materialId) return
    const payload = {
      user_id: user.id,
      material_id: materialId,
      progress_percent: 100,
      completed: true,
      last_read_at: new Date().toISOString(),
      last_position: progress?.last_position ?? null,
    }
    await supabase.from('reading_progress').upsert(payload, {
      onConflict: 'user_id,material_id',
    })
    setProgress({ ...(progress ?? ({} as ReadingProgress)), ...payload, id: progress?.id ?? '' })
    void logActivity(supabase, {
      userId: user.id,
      eventType: 'topic_completed',
      materialId,
      catalogueCourseId: material?.catalogue_course_id,
    })
    toast({ title: 'Marked complete', kind: 'success' })
  }

  const fetchAiSummary = async () => {
    if (!material || !session?.access_token) return
    setAiLoading(true)
    setAiSummary(null)
    const context = searchableText.slice(0, 4000) || material.title
    const message = `Summarize the following study material in concise bullet points for a student:\n\n${context}`
    try {
      const res = await fetch('/api/ai-tutor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message,
          education_level: profile?.education_level,
        }),
      })
      const json = (await res.json()) as { reply?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'AI unavailable')
      setAiSummary(json.reply ?? '')
    } catch (e) {
      toast({
        title: 'Summary failed',
        description: e instanceof Error ? e.message : 'Try again later',
        kind: 'error',
      })
    }
    setAiLoading(false)
  }

  if (!supabase) return <SupabaseSetupBanner />
  if (loading) return <Skeleton className="h-64 rounded-2xl" />
  if (!material) {
    return (
      <EmptyState
        title="Material not found"
        action={
          <Button asChild variant="outline">
            <Link to="/app/courses">Courses</Link>
          </Button>
        }
      />
    )
  }

  const courseLink = `/app/courses/${material.catalogue_course_id}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to={courseLink}>Back to course</Link>
        </Button>
        <h2 className="font-display text-xl font-semibold">{material.title}</h2>
        {progress?.completed ? <Badge variant="outline">Completed</Badge> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void toggleBookmark()}>
          {bookmarked ? 'Remove bookmark' : 'Bookmark'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => void markComplete()}>
          Mark complete
        </Button>
        <Button size="sm" variant="accent" disabled={aiLoading} onClick={() => void fetchAiSummary()}>
          {aiLoading ? 'Summarizing…' : 'AI summary'}
        </Button>
      </div>

      {progress?.last_position ? (
        <p className="text-sm text-ink-muted">Resume from: {progress.last_position}</p>
      ) : null}

      <div className="flex gap-2">
        <Input
          placeholder="Search in content…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {searchHit ? (
        <p className="rounded-lg border border-border bg-surface-elevated p-2 text-sm">{searchHit}</p>
      ) : null}

      {aiSummary ? (
        <Card className="rounded-2xl border-accent-200">
          <CardHeader>
            <CardTitle className="text-sm">AI-generated summary</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-ink-muted">{aiSummary}</CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl">
        <CardContent className="prose prose-sm dark:prose-invert max-w-none pt-6">
          {material.content_html ? (
            <div dangerouslySetInnerHTML={{ __html: material.content_html }} />
          ) : fileUrl ? (
            material.file_type?.includes('pdf') ? (
              <iframe title={material.title} src={fileUrl} className="h-[70vh] w-full rounded-lg border" />
            ) : (
              <a href={fileUrl} className="text-primary-600 hover:underline" target="_blank" rel="noreferrer">
                Open file
              </a>
            )
          ) : (
            <p className="text-ink-muted">No readable content yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Add a note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={annotation}
            onChange={(e) => setAnnotation(e.target.value)}
            placeholder="Your annotation…"
            rows={3}
          />
          <Button size="sm" onClick={() => void saveAnnotation()}>
            Save note
          </Button>
        </CardContent>
      </Card>

      {siblings.length > 1 ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Other materials in this course</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {siblings
                .filter((s) => s.id !== material.id)
                .map((s) => (
                  <li key={s.id}>
                    <Link to={`/app/courses/materials/${s.id}`} className="text-primary-600 hover:underline">
                      {s.title}
                    </Link>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
