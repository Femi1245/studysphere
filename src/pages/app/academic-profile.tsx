import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
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
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/auth-context'
import {
  fetchAcademicSessions,
  fetchCatalogueCourses,
  fetchClassLevels,
  fetchCountries,
  fetchDepartments,
  fetchEducationLevels,
  fetchInstitutions,
  fetchProgrammes,
} from '@/lib/academic'
import { logActivity } from '@/lib/activity'
import {
  institutionTypeForEducationCode,
  isSecondaryEducationCode,
  mapAcademicCodeToProfileLevel,
} from '@/lib/education-map'
import { trySupabase } from '@/lib/supabase/client'
import type {
  AcademicEducationLevelCode,
  CatalogueCourse,
  Country,
  EducationLevelRow,
  SemesterTerm,
  StudentAcademicProfile,
  StudentCourseEnrolment,
} from '@/types/database'

export function AcademicProfilePage() {
  const { user, refreshProfile } = useAuth()
  const { toast } = useToast()
  const supabase = trySupabase()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [countries, setCountries] = useState<Country[]>([])
  const [levels, setLevels] = useState<EducationLevelRow[]>([])
  const [institutions, setInstitutions] = useState<
    { id: string; name: string; institution_type: string; state_region: string | null }[]
  >([])
  const [programmes, setProgrammes] = useState<{ id: string; name: string }[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [classLevels, setClassLevels] = useState<{ id: string; label: string }[]>([])
  const [sessions, setSessions] = useState<{ id: string; label: string }[]>([])
  const [catalogue, setCatalogue] = useState<CatalogueCourse[]>([])
  const [enrolments, setEnrolments] = useState<StudentCourseEnrolment[]>([])
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])

  const [countryId, setCountryId] = useState('')
  const [educationLevelId, setEducationLevelId] = useState('')
  const [institutionId, setInstitutionId] = useState('')
  const [useCustomInstitution, setUseCustomInstitution] = useState(false)
  const [customInstitution, setCustomInstitution] = useState('')
  const [programmeId, setProgrammeId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [classLevelId, setClassLevelId] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [semesterTerm, setSemesterTerm] = useState<SemesterTerm | ''>('')
  const [courseOfStudy, setCourseOfStudy] = useState('')
  const [institutionSearch, setInstitutionSearch] = useState('')

  const selectedLevel = useMemo(
    () => levels.find((l) => l.id === educationLevelId) ?? null,
    [levels, educationLevelId],
  )
  const isSecondary = selectedLevel ? isSecondaryEducationCode(selectedLevel.code) : false

  const load = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    const [c, lv, sess, acad, enr] = await Promise.all([
      fetchCountries(supabase),
      fetchEducationLevels(supabase),
      fetchAcademicSessions(supabase),
      supabase.from('student_academic_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('student_course_enrolments').select('*').eq('user_id', user.id).eq('status', 'active'),
    ])
    setCountries(c)
    setLevels(lv)
    setSessions(sess.map((s) => ({ id: s.id, label: s.label })))
    const profile = acad.data as StudentAcademicProfile | null
    if (profile) {
      setCountryId(profile.country_id)
      setEducationLevelId(profile.education_level_id)
      setInstitutionId(profile.institution_id ?? '')
      setUseCustomInstitution(Boolean(profile.custom_institution_name && !profile.institution_id))
      setCustomInstitution(profile.custom_institution_name ?? '')
      setProgrammeId(profile.programme_id ?? '')
      setDepartmentId(profile.department_id ?? '')
      setClassLevelId(profile.class_level_id ?? '')
      setSessionId(profile.academic_session_id ?? '')
      setSemesterTerm(profile.semester_term ?? '')
      setCourseOfStudy(profile.course_of_study ?? '')
    }
    setEnrolments((enr.data as StudentCourseEnrolment[]) ?? [])
    setSelectedCourses((enr.data as StudentCourseEnrolment[])?.map((e) => e.catalogue_course_id) ?? [])
    setLoading(false)
  }, [supabase, user])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!supabase || !countryId || !selectedLevel || useCustomInstitution) return
    const type = institutionTypeForEducationCode(selectedLevel.code)
    void fetchInstitutions(supabase, {
      countryId,
      institutionType: type,
      search: institutionSearch,
      limit: 150,
    }).then((rows) =>
      setInstitutions(
        rows.map((i) => ({
          id: i.id,
          name: i.name,
          institution_type: i.institution_type,
          state_region: i.state_region,
        })),
      ),
    )
  }, [supabase, countryId, selectedLevel, institutionSearch, useCustomInstitution])

  useEffect(() => {
    if (!supabase || !educationLevelId) return
    void fetchClassLevels(supabase, educationLevelId).then((rows) =>
      setClassLevels(rows.map((c) => ({ id: c.id, label: c.label }))),
    )
  }, [supabase, educationLevelId])

  useEffect(() => {
    if (!supabase || !institutionId || isSecondary) return
    void Promise.all([
      fetchProgrammes(supabase, { institutionId, educationLevelId }),
      fetchDepartments(supabase, institutionId),
    ]).then(([p, d]) => {
      setProgrammes(p.map((x) => ({ id: x.id, name: x.name })))
      setDepartments(d.map((x) => ({ id: x.id, name: x.name })))
    })
  }, [supabase, institutionId, educationLevelId, isSecondary])

  useEffect(() => {
    if (!supabase || !educationLevelId) return
    void fetchCatalogueCourses(supabase, {
      educationLevelId,
      institutionId: institutionId || undefined,
      programmeId: programmeId || undefined,
      classLevelId: classLevelId || undefined,
    }).then(setCatalogue)
  }, [supabase, educationLevelId, institutionId, programmeId, classLevelId])

  const toggleCourse = (id: string) => {
    setSelectedCourses((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase || !user || !countryId || !educationLevelId || !selectedLevel) return
    setSaving(true)
    const schoolName = useCustomInstitution
      ? customInstitution.trim()
      : (institutions.find((i) => i.id === institutionId)?.name ?? '')

    await supabase.from('student_academic_profiles').upsert(
      {
        user_id: user.id,
        country_id: countryId,
        institution_id: useCustomInstitution ? null : institutionId || null,
        education_level_id: educationLevelId,
        programme_id: isSecondary ? null : programmeId || null,
        department_id: isSecondary ? null : departmentId || null,
        class_level_id: classLevelId || null,
        academic_session_id: sessionId || null,
        semester_term: semesterTerm || null,
        course_of_study: courseOfStudy.trim() || null,
        custom_institution_name: useCustomInstitution ? customInstitution.trim() || null : null,
      },
      { onConflict: 'user_id' },
    )

    await supabase
      .from('profiles')
      .update({
        school: schoolName || null,
        education_level: mapAcademicCodeToProfileLevel(selectedLevel.code as AcademicEducationLevelCode),
        country_id: countryId,
        academic_profile_complete: true,
      })
      .eq('id', user.id)

    const existing = new Set(enrolments.map((e) => e.catalogue_course_id))
    for (const cid of selectedCourses) {
      if (!existing.has(cid)) {
        await supabase.from('student_course_enrolments').insert({
          user_id: user.id,
          catalogue_course_id: cid,
          status: 'active',
        })
        void logActivity(supabase, { userId: user.id, eventType: 'course_enrolled', catalogueCourseId: cid })
      }
    }
    for (const e of enrolments) {
      if (!selectedCourses.includes(e.catalogue_course_id)) {
        await supabase.from('student_course_enrolments').delete().eq('id', e.id)
      }
    }

    void logActivity(supabase, { userId: user.id, eventType: 'profile_updated', metadata: { source: 'academic-profile' } })
    await refreshProfile()
    setSaving(false)
    toast({ title: 'Academic profile saved', kind: 'success' })
    await load()
  }

  if (!supabase) return <SupabaseSetupBanner />
  if (loading) return <Skeleton className="h-64 rounded-2xl" />

  return (
    <form onSubmit={(e) => void save(e)} className="mx-auto max-w-lg space-y-6">
      <Button asChild variant="outline" size="sm">
        <Link to="/app/settings">Back to settings</Link>
      </Button>
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Academic profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Country</Label>
            <Select value={countryId} onValueChange={setCountryId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Education level</Label>
            <Select value={educationLevelId} onValueChange={setEducationLevelId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {levels.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useCustomInstitution} onChange={(ev) => setUseCustomInstitution(ev.target.checked)} />
            Custom institution
          </label>
          {useCustomInstitution ? (
            <Input value={customInstitution} onChange={(ev) => setCustomInstitution(ev.target.value)} placeholder="Institution name" />
          ) : (
            <>
              <Input
                placeholder="Search any university, polytechnic, college…"
                value={institutionSearch}
                onChange={(ev) => setInstitutionSearch(ev.target.value)}
              />
              <p className="text-xs text-ink-muted">
                Search across all institution types. Without search, results match your education level.
              </p>
              <Select value={institutionId} onValueChange={setInstitutionId}>
                <SelectTrigger><SelectValue placeholder="Institution" /></SelectTrigger>
                <SelectContent>
                  {institutions.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                      {i.state_region ? ` · ${i.state_region}` : ''} ·{' '}
                      {i.institution_type.replaceAll('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          {!isSecondary ? (
            <>
              <Select value={programmeId} onValueChange={setProgrammeId}>
                <SelectTrigger><SelectValue placeholder="Programme" /></SelectTrigger>
                <SelectContent>
                  {programmes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={courseOfStudy} onChange={(ev) => setCourseOfStudy(ev.target.value)} placeholder="Course of study" />
            </>
          ) : null}
          <Select value={classLevelId} onValueChange={setClassLevelId}>
            <SelectTrigger><SelectValue placeholder="Class level" /></SelectTrigger>
            <SelectContent>
              {classLevels.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger><SelectValue placeholder="Session" /></SelectTrigger>
            <SelectContent>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={semesterTerm || 'none'} onValueChange={(v) => setSemesterTerm(v === 'none' ? '' : (v as SemesterTerm))}>
            <SelectTrigger><SelectValue placeholder="Term" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              <SelectItem value="first">First</SelectItem>
              <SelectItem value="second">Second</SelectItem>
              <SelectItem value="third">Third</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Course enrolments</CardTitle>
        </CardHeader>
        <CardContent className="max-h-64 space-y-2 overflow-y-auto">
          {catalogue.map((c) => (
            <label key={c.id} className="flex gap-2 text-sm">
              <input type="checkbox" checked={selectedCourses.includes(c.id)} onChange={() => toggleCourse(c.id)} />
              {c.code} — {c.title}
            </label>
          ))}
        </CardContent>
      </Card>
      <Button type="submit" disabled={saving} className="w-full">
        {saving ? 'Saving…' : 'Save academic profile'}
      </Button>
    </form>
  )
}
