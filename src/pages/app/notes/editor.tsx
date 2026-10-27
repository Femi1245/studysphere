import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/react'
import { Upload } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'
import type { Subject, Topic } from '@/types/database'

const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/markdown',
]
const MAX_BYTES = 10 * 1024 * 1024

export function NoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new' || !id
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = trySupabase()
  const [title, setTitle] = useState('')
  const [pinned, setPinned] = useState(false)
  const [favorite, setFavorite] = useState(false)
  const [subjectId, setSubjectId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [noteId, setNoteId] = useState<string | null>(isNew ? null : (id ?? null))

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing your notes…' }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[240px] rounded-xl border border-border bg-surface-elevated p-4 focus:outline-none dark:prose-invert',
      },
    },
  })

  const loadMeta = useCallback(async () => {
    if (!supabase || !user) return
    const { data: subData } = await supabase.from('subjects').select('*').eq('user_id', user.id)
    setSubjects((subData as Subject[]) ?? [])
  }, [supabase, user])

  const loadNote = useCallback(async () => {
    if (!supabase || !user || isNew || !id) return
    setLoading(true)
    const { data } = await supabase.from('notes').select('*').eq('id', id).eq('user_id', user.id).maybeSingle()
    if (data) {
      setTitle(data.title)
      setPinned(data.pinned)
      setFavorite(data.favorite)
      setSubjectId(data.subject_id ?? '')
      setTopicId(data.topic_id ?? '')
      editor?.commands.setContent(data.content)
      setNoteId(data.id)
    }
    setLoading(false)
  }, [supabase, user, isNew, id, editor])

  useEffect(() => {
    void loadMeta()
  }, [loadMeta])

  useEffect(() => {
    void loadNote()
  }, [loadNote])

  useEffect(() => {
    if (!supabase || !subjectId) {
      setTopics([])
      return
    }
    void supabase
      .from('topics')
      .select('*')
      .eq('subject_id', subjectId)
      .eq('user_id', user?.id ?? '')
      .then(({ data }) => setTopics((data as Topic[]) ?? []))
  }, [supabase, subjectId, user?.id])

  const save = async () => {
    if (!supabase || !user || !editor) return
    const content = editor.getHTML()
    if (!title.trim()) {
      toast({ title: 'Title required', kind: 'error' })
      return
    }
    setSaving(true)
    const payload = {
      title: title.trim(),
      content,
      pinned,
      favorite,
      subject_id: subjectId || null,
      topic_id: topicId || null,
    }
    if (noteId) {
      const { error } = await supabase.from('notes').update(payload).eq('id', noteId)
      if (error) toast({ title: 'Save failed', description: error.message, kind: 'error' })
      else toast({ title: 'Saved', kind: 'success' })
    } else {
      const { data, error } = await supabase
        .from('notes')
        .insert({ ...payload, user_id: user.id })
        .select('id')
        .single()
      if (error) toast({ title: 'Save failed', description: error.message, kind: 'error' })
      else if (data) {
        setNoteId(data.id)
        toast({ title: 'Created', kind: 'success' })
        navigate(`/app/notes/${data.id}`, { replace: true })
      }
    }
    setSaving(false)
  }

  const onFile = async (file: File) => {
    if (!supabase || !user) return
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith('.md')) {
      toast({ title: 'Invalid file type', kind: 'error' })
      return
    }
    if (file.size > MAX_BYTES) {
      toast({ title: 'File too large', description: 'Max 10MB', kind: 'error' })
      return
    }
    let currentNoteId = noteId
    if (!currentNoteId && title.trim() && editor) {
      const content = editor.getHTML()
      const { data, error: createErr } = await supabase
        .from('notes')
        .insert({
          title: title.trim(),
          content,
          pinned,
          favorite,
          subject_id: subjectId || null,
          topic_id: topicId || null,
          user_id: user.id,
        })
        .select('id')
        .single()
      if (createErr || !data) {
        toast({ title: 'Save note before upload', description: createErr?.message, kind: 'error' })
        return
      }
      currentNoteId = data.id
      setNoteId(data.id)
      navigate(`/app/notes/${data.id}`, { replace: true })
    }
    if (!currentNoteId) return

    setUploadProgress(0)
    const path = `${user.id}/${file.name}`
    const { error: upErr } = await supabase.storage.from('learning-resources').upload(path, file, {
      upsert: true,
    })
    if (upErr) {
      toast({ title: 'Upload failed', description: upErr.message, kind: 'error' })
      setUploadProgress(null)
      return
    }
    setUploadProgress(100)
    const { error: rowErr } = await supabase.from('learning_resources').insert({
      user_id: user.id,
      note_id: currentNoteId,
      subject_id: subjectId || null,
      file_name: file.name,
      file_path: path,
      file_type: file.type || 'application/octet-stream',
      file_size: file.size,
    })
    if (rowErr) toast({ title: 'Resource record failed', description: rowErr.message, kind: 'error' })
    else toast({ title: 'File attached', kind: 'success' })
    setUploadProgress(null)
  }

  if (!supabase) return <SupabaseSetupBanner />
  if (loading) return <Skeleton className="h-96 rounded-2xl" />

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/app/notes">Back</Link>
        </Button>
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
      <Input
        className="text-lg font-semibold"
        placeholder="Note title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Subject</Label>
          <Select value={subjectId || 'none'} onValueChange={(v) => { setSubjectId(v === 'none' ? '' : v); setTopicId('') }}>
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
          <Label>Topic</Label>
          <Select value={topicId || 'none'} onValueChange={(v) => setTopicId(v === 'none' ? '' : v)} disabled={!subjectId}>
            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {topics.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
        Pin note
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
        Favorite
      </label>
      <EditorContent editor={editor} />
      <div className="rounded-2xl border border-dashed border-border p-4">
        <Label className="flex cursor-pointer items-center gap-2">
          <Upload className="h-4 w-4" />
          Attach file (pdf, images, txt, md — max 10MB)
          <input
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
            }}
          />
        </Label>
        {uploadProgress !== null ? (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary-100">
            <div
              className={cn('h-full bg-accent-600 transition-all')}
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
