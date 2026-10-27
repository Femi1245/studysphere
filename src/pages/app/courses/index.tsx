import { BookMarked, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/auth-context'
import { fetchCatalogueCourses, fetchEducationLevels } from '@/lib/academic'
import { submitCatalogueRequest } from '@/lib/catalogue-request'
import { trySupabase } from '@/lib/supabase/client'
import type { CatalogueCourse, EducationLevelRow, StudentCourseEnrolment } from '@/types/database'

type EnrolmentRow = StudentCourseEnrolment & { catalogue_courses: CatalogueCourse | null }

export function CoursesLibraryPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = trySupabase()
  const [loading, setLoading] = useState(true)
  const [enrolments, setEnrolments] = useState<EnrolmentRow[]>([])
  const [browse, setBrowse] = useState<CatalogueCourse[]>([])
  const [levels, setLevels] = useState<EducationLevelRow[]>([])
  const [levelFilter, setLevelFilter] = useState('')
  const [search, setSearch] = useState('')
  const [requestTitle, setRequestTitle] = useState('')

  const load = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    const [enr, lv] = await Promise.all([
      supabase
        .from('student_course_enrolments')
        .select('*, catalogue_courses(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('enrolled_at', { ascending: false }),
      fetchEducationLevels(supabase),
    ])
    setEnrolments((enr.data as EnrolmentRow[]) ?? [])
    setLevels(lv)
    setLoading(false)
  }, [supabase, user])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!supabase) return
    void fetchCatalogueCourses(supabase, {
      educationLevelId: levelFilter || undefined,
      search,
    }).then(setBrowse)
  }, [supabase, levelFilter, search])

  const enrolledIds = useMemo(
    () => new Set(enrolments.map((e) => e.catalogue_course_id)),
    [enrolments],
  )

  const enrollFromBrowse = async (courseId: string) => {
    if (!supabase || !user) return
    const { error } = await supabase.from('student_course_enrolments').insert({
      user_id: user.id,
      catalogue_course_id: courseId,
      status: 'active',
    })
    if (error) toast({ title: 'Enrol failed', description: error.message, kind: 'error' })
    else await load()
  }

  const submitRequest = async () => {
    if (!supabase || !user || !requestTitle.trim()) return
    const { error } = await submitCatalogueRequest(supabase, {
      userId: user.id,
      requestType: 'course',
      title: requestTitle.trim(),
      educationLevelId: levelFilter || null,
    })
    if (error) toast({ title: 'Request failed', description: error, kind: 'error' })
    else {
      toast({ title: 'Request submitted', kind: 'success' })
      setRequestTitle('')
    }
  }

  if (!supabase) return <SupabaseSetupBanner />
  if (loading) return <Skeleton className="h-64 rounded-2xl" />

  return (
    <div className="space-y-6">
      <Tabs defaultValue="enrolled">
        <TabsList className="rounded-xl">
          <TabsTrigger value="enrolled">My courses</TabsTrigger>
          <TabsTrigger value="browse">Browse catalogue</TabsTrigger>
        </TabsList>
        <TabsContent value="enrolled" className="space-y-4">
          {enrolments.length === 0 ? (
            <EmptyState
              icon={BookMarked}
              title="No enrolled courses"
              description="Complete academic profile setup or browse the catalogue to enrol."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link to="/app/academic-profile">Academic profile</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {enrolments.map((e) => {
                const c = e.catalogue_courses
                if (!c) return null
                return (
                  <Card key={e.id} className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        <Link to={`/app/courses/${c.id}`} className="hover:text-primary-600">
                          {c.code} — {c.title}
                        </Link>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="outline">{e.status}</Badge>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="browse" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-muted" />
              <Input
                className="pl-9"
                placeholder="Search courses…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={levelFilter || 'all'} onValueChange={(v) => setLevelFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="sm:w-48">
                <SelectValue placeholder="Education level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {levels.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {browse.map((c) => (
              <Card key={c.id} className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{c.code} — {c.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/app/courses/${c.id}`}>View</Link>
                  </Button>
                  {enrolledIds.has(c.id) ? (
                    <Badge>Enrolled</Badge>
                  ) : (
                    <Button size="sm" onClick={() => void enrollFromBrowse(c.id)}>
                      Enrol
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Missing a course?</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Course name or code"
                value={requestTitle}
                onChange={(e) => setRequestTitle(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={() => void submitRequest()}>
                Request course
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
