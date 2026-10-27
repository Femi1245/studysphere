import { useCallback, useEffect, useState } from 'react'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { trySupabase } from '@/lib/supabase/client'
import type {
  CatalogueCourse,
  CatalogueRequest,
  LearningMaterial,
  LearningMaterialStatus,
  MaterialType,
  SupportRequest,
} from '@/types/database'

export function AdminPage() {
  const { toast } = useToast()
  const supabase = trySupabase()
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [catalogueRequests, setCatalogueRequests] = useState<CatalogueRequest[]>([])
  const [materials, setMaterials] = useState<LearningMaterial[]>([])
  const [courses, setCourses] = useState<CatalogueCourse[]>([])
  const [editing, setEditing] = useState<LearningMaterial | null>(null)
  const [matTitle, setMatTitle] = useState('')
  const [matType, setMatType] = useState<MaterialType>('lecture_notes')
  const [matCourse, setMatCourse] = useState('')
  const [matStatus, setMatStatus] = useState<LearningMaterialStatus>('draft')
  const [matHtml, setMatHtml] = useState('')

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const [reqRes, catReq, mat, crs] = await Promise.all([
      supabase.from('support_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('catalogue_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('learning_materials').select('*').order('updated_at', { ascending: false }).limit(100),
      supabase.from('catalogue_courses').select('*').order('title').limit(200),
    ])
    setRequests((reqRes.data as SupportRequest[]) ?? [])
    setCatalogueRequests((catReq.data as CatalogueRequest[]) ?? [])
    setMaterials((mat.data as LearningMaterial[]) ?? [])
    setCourses((crs.data as CatalogueCourse[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  const updateSupportStatus = async (id: string, status: SupportRequest['status']) => {
    if (!supabase) return
    const { error } = await supabase.from('support_requests').update({ status }).eq('id', id)
    if (error) toast({ title: 'Update failed', description: error.message, kind: 'error' })
    else await load()
  }

  const updateCatalogueRequest = async (id: string, status: CatalogueRequest['status']) => {
    if (!supabase) return
    const { error } = await supabase.from('catalogue_requests').update({ status }).eq('id', id)
    if (error) toast({ title: 'Update failed', description: error.message, kind: 'error' })
    else await load()
  }

  const openEdit = (m: LearningMaterial) => {
    setEditing(m)
    setMatTitle(m.title)
    setMatType(m.material_type)
    setMatCourse(m.catalogue_course_id)
    setMatStatus(m.status)
    setMatHtml(m.content_html ?? '')
  }

  const saveMaterial = async () => {
    if (!supabase || !matTitle.trim() || !matCourse) return
    const payload = {
      title: matTitle.trim(),
      material_type: matType,
      catalogue_course_id: matCourse,
      status: matStatus,
      content_html: matHtml.trim() || null,
      published_at: matStatus === 'published' ? new Date().toISOString() : null,
    }
    if (editing) {
      const { error } = await supabase.from('learning_materials').update(payload).eq('id', editing.id)
      if (error) toast({ title: 'Save failed', description: error.message, kind: 'error' })
      else {
        setEditing(null)
        await load()
      }
    } else {
      const { error } = await supabase.from('learning_materials').insert(payload)
      if (error) toast({ title: 'Create failed', description: error.message, kind: 'error' })
      else {
        setMatTitle('')
        setMatHtml('')
        await load()
      }
    }
  }

  if (!supabase) return <SupabaseSetupBanner />
  if (loading) return <Skeleton className="h-64 rounded-2xl" />

  return (
    <div className="space-y-6">
      <Tabs defaultValue="support">
        <TabsList className="rounded-xl">
          <TabsTrigger value="support">Support</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="support" className="space-y-3">
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
                    <Select
                      value={r.status}
                      onValueChange={(v) => void updateSupportStatus(r.id, v as SupportRequest['status'])}
                    >
                      <SelectTrigger className="mt-3 h-9 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In progress</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>{editing ? 'Edit material' : 'Create material'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={matTitle} onChange={(e) => setMatTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={matCourse} onValueChange={setMatCourse}>
                  <SelectTrigger><SelectValue placeholder="Catalogue course" /></SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} — {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={matType} onValueChange={(v) => setMatType(v as MaterialType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lecture_notes">Lecture notes</SelectItem>
                    <SelectItem value="study_guide">Study guide</SelectItem>
                    <SelectItem value="definitions">Definitions</SelectItem>
                    <SelectItem value="worked_examples">Worked examples</SelectItem>
                    <SelectItem value="practice">Practice</SelectItem>
                    <SelectItem value="revision_summary">Revision summary</SelectItem>
                    <SelectItem value="past_questions">Past questions</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={matStatus} onValueChange={(v) => setMatStatus(v as LearningMaterialStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="unpublished">Unpublished</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Content (HTML)</Label>
                <Textarea rows={6} value={matHtml} onChange={(e) => setMatHtml(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={() => void saveMaterial()}>
                  {editing ? 'Update' : 'Create'}
                </Button>
                {editing ? (
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>All materials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {materials.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{m.title}</p>
                    <p className="text-ink-muted">{m.material_type} · {m.status}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => openEdit(m)}>
                    Edit
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Catalogue requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {catalogueRequests.length === 0 ? (
                <p className="text-sm text-ink-muted">No catalogue requests.</p>
              ) : (
                catalogueRequests.map((r) => (
                  <div key={r.id} className="rounded-xl border border-border p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="font-medium">{r.title}</p>
                      <Badge>{r.request_type}</Badge>
                    </div>
                    {r.details ? <p className="text-ink-muted">{r.details}</p> : null}
                    <Select
                      value={r.status}
                      onValueChange={(v) => void updateCatalogueRequest(r.id, v as CatalogueRequest['status'])}
                    >
                      <SelectTrigger className="mt-2 h-9 w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_review">In review</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
