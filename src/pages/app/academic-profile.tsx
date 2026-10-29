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
import { Typeahead } from '@/components/ui/typeahead'
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
import { resolveCoursesForProfile } from '@/lib/academic-sync'
import { syncSubjectsFromAcademicProfile } from '@/lib/study-curriculum'
import {
  institutionTypeForEducationCode,
  isSecondaryEducationCode,
  mapAcademicCodeToProfileLevel,
} from '@/lib/education-map'
import { NIGERIA_COURSES_OF_STUDY } from '@/lib/nigeria-courses-of-study'
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

type InstRow = {
  id: string
  name: string
  institution_type: string
  state_region: string | null
}

export function AcademicProfilePage() {
  const { user, refreshProfile } = useAuth()
  const { toast } = useToast()
  const supabase = trySupabase()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [countries, setCountries] = useState<Country[]>([])
  const [levels, setLevels] = useState<EducationLevelRow[]>([])
  const [institutions, setInstitutions] = useState<InstRow[]>([])
  const [programmes, setProgrammes] = useState<{ id: string; name: string; department_id: string | null }[]>(
    [],
  )
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [classLevels, setClassLevels] = useState<{ id: string; label: string }[]>([])
  const [sessions, setSessions] = useState<{ id: string; label: string }[]>([])
  const [catalogue, setCatalogue] = useState<CatalogueCourse[]>([])
  const [enrolments, setEnrolments] = useState<StudentCourseEnrolment[]>([])
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [catalogueSearch, setCatalogueSearch] = useState('')

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

  const selectedInstitution = useMemo(
    () => institutions.find((i) => i.id === institutionId) ?? null,
    [institutions, institutionId],
  )

  const institutionOptions = useMemo(
    () =>
      institutions.map((i) => ({
        value: i.id,
        label: i.name,
        description: `${i.state_region ? `${i.state_region} · ` : ''}${i.institution_type.replaceAll('_', ' ')}`,
      })),
    [institutions],
  )

  const programmeOptions = useMemo(() => {
    if (programmes.length > 0) {
      return programmes.map((p) => ({ value: p.id, label: p.name }))
    }
    // Offline/local fallback until SQL seed is applied — stores as course of study
    return NIGERIA_COURSES_OF_STUDY.map((name) => ({
      value: `local:${name}`,
      label: name,
      description: 'Suggested Nigeria course (seed SQL for full programmes)',
    }))
  }, [programmes])

  const departmentOptions = useMemo(
    () => departments.map((d) => ({ value: d.id, label: d.name })),
    [departments],
  )

  const courseOfStudyOptions = useMemo(() => {
    const fromProgrammes = programmes.map((p) =>
      p.name
        .replace(/^B\.(Sc|Eng|A|Ed|Agric|NSc|MLS)\.?\s*/i, '')
        .replace(/^LL\.B\.?\s*/i, '')
        .replace(/^MBBS\s*/i, '')
        .replace(/^Doctor of\s+/i, '')
        .replace(/\s*\(.*\)$/, '')
        .trim(),
    )
    const set = new Set<string>([...NIGERIA_COURSES_OF_STUDY, ...fromProgrammes, courseOfStudy].filter(Boolean))
    return [...set]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }))
  }, [programmes, courseOfStudy])

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
      if (profile.institution_id) {
        // Prefill search so selected campus stays visible in typeahead options
        void fetchInstitutions(supabase, {
          countryId: profile.country_id,
          search: '',
          limit: 400,
        }).then((rows) => {
          const match = rows.find((r) => r.id === profile.institution_id)
          if (match) setInstitutionSearch(match.name)
          setInstitutions(
            rows.map((i) => ({
              id: i.id,
              name: i.name,
              institution_type: i.institution_type,
              state_region: i.state_region,
            })),
          )
        })
      }
    } else {
      const ng = c.find((x) => x.code === 'NG')
      if (ng) setCountryId(ng.id)
      const uni = lv.find((x) => x.code === 'university')
      if (uni) setEducationLevelId(uni.id)
    }
    setEnrolments((enr.data as StudentCourseEnrolment[]) ?? [])
    setSelectedCourses((enr.data as StudentCourseEnrolment[])?.map((e) => e.catalogue_course_id) ?? [])
    setLoading(false)
  }, [supabase, user])

  useEffect(() => {
    void load()
  }, [load])

  // Live institution search as the student types
  useEffect(() => {
    if (!supabase || !countryId || !selectedLevel || useCustomInstitution) return
    const type = institutionTypeForEducationCode(selectedLevel.code)
    const handle = window.setTimeout(() => {
      void fetchInstitutions(supabase, {
        countryId,
        institutionType: type,
        search: institutionSearch,
        limit: institutionSearch.trim() ? 120 : 250,
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
    }, 180)
    return () => window.clearTimeout(handle)
  }, [supabase, countryId, selectedLevel, institutionSearch, useCustomInstitution])

  useEffect(() => {
    if (!supabase || !educationLevelId) return
    void fetchClassLevels(supabase, educationLevelId).then((rows) =>
      setClassLevels(rows.map((c) => ({ id: c.id, label: c.label }))),
    )
  }, [supabase, educationLevelId])

  // Load ALL Nigeria programmes/departments for the education level (shared + campus)
  useEffect(() => {
    if (!supabase || isSecondary || !educationLevelId) return
    void Promise.all([
      fetchProgrammes(supabase, {
        institutionId: institutionId || undefined,
        educationLevelId,
      }),
      fetchDepartments(supabase, institutionId || undefined),
    ]).then(([p, d]) => {
      setProgrammes(
        p.map((x) => ({
          id: x.id,
          name: x.name,
          department_id: x.department_id ?? null,
        })),
      )
      setDepartments(d.map((x) => ({ id: x.id, name: x.name })))
    })
  }, [supabase, institutionId, educationLevelId, isSecondary])

  useEffect(() => {
    if (!supabase || !educationLevelId) return
    const handle = window.setTimeout(() => {
      void fetchCatalogueCourses(supabase, {
        educationLevelId,
        institutionId: institutionId || undefined,
        programmeId: programmeId || undefined,
        classLevelId: classLevelId || undefined,
        search: catalogueSearch || undefined,
      }).then(setCatalogue)
    }, 200)
    return () => window.clearTimeout(handle)
  }, [
    supabase,
    educationLevelId,
    institutionId,
    programmeId,
    classLevelId,
    catalogueSearch,
  ])

  const pickInstitution = (id: string) => {
    setInstitutionId(id)
    setProgrammeId('')
    setDepartmentId('')
    const row = institutions.find((i) => i.id === id)
    if (row) setInstitutionSearch(row.name)
  }

  const pickProgramme = (id: string) => {
    if (id.startsWith('local:')) {
      const name = id.slice('local:'.length)
      setProgrammeId('')
      setCourseOfStudy(name)
      return
    }
    setProgrammeId(id)
    const prog = programmes.find((p) => p.id === id)
    if (prog?.department_id) setDepartmentId(prog.department_id)
    if (prog) {
      const cleaned = prog.name
        .replace(/^B\.(Sc|Eng|A|Ed|Agric|NSc|MLS)\.?\s*/i, '')
        .replace(/^LL\.B\.?\s*/i, '')
        .replace(/^MBBS\s*/i, '')
        .replace(/^Doctor of\s+/i, '')
        .replace(/\s*\(.*\)$/, '')
        .trim()
      if (cleaned) setCourseOfStudy(cleaned)
    }
  }

  const toggleCourse = (id: string) => {
    setSelectedCourses((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase || !user || !countryId || !educationLevelId || !selectedLevel) return
    setSaving(true)
    const schoolName = useCustomInstitution
      ? customInstitution.trim()
      : (selectedInstitution?.name ??
        institutions.find((i) => i.id === institutionId)?.name ??
        institutionSearch.trim())

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
        education_level: mapAcademicCodeToProfileLevel(
          selectedLevel.code as AcademicEducationLevelCode,
        ),
        country_id: countryId,
        academic_profile_complete: true,
      })
      .eq('id', user.id)

    // Prefer manually checked courses; otherwise auto-match from programme / course of study
    let courseIds = [...selectedCourses]
    if (courseIds.length === 0) {
      const matched = await resolveCoursesForProfile(supabase, {
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
        custom_programme_name: null,
        created_at: '',
        updated_at: '',
      })
      courseIds = matched.slice(0, 12).map((c) => c.id)
      setSelectedCourses(courseIds)
    }

    const existing = new Set(enrolments.map((e) => e.catalogue_course_id))
    for (const cid of courseIds) {
      if (!existing.has(cid)) {
        await supabase.from('student_course_enrolments').upsert(
          {
            user_id: user.id,
            catalogue_course_id: cid,
            status: 'active',
          },
          { onConflict: 'user_id,catalogue_course_id' },
        )
        void logActivity(supabase, {
          userId: user.id,
          eventType: 'course_enrolled',
          catalogueCourseId: cid,
          metadata: { source: 'academic-profile-auto' },
        })
      }
    }
    for (const en of enrolments) {
      if (!courseIds.includes(en.catalogue_course_id)) {
        await supabase.from('student_course_enrolments').delete().eq('id', en.id)
      }
    }

    void logActivity(supabase, {
      userId: user.id,
      eventType: 'profile_updated',
      metadata: { source: 'academic-profile', enrolled: courseIds.length },
    })

    const syncedSubjects = await syncSubjectsFromAcademicProfile(supabase, user.id)

    await refreshProfile()
    setSaving(false)
    toast({
      title: 'Academic profile saved',
      description:
        courseIds.length > 0
          ? `${courseIds.length} course(s) and ${syncedSubjects.length} subject(s) linked. Open Study books for theory & practical texts.`
          : 'Profile saved. Add courses or re-save after catalogue courses load.',
      kind: 'success',
    })
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Education level</Label>
            <Select value={educationLevelId} onValueChange={setEducationLevelId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {levels.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useCustomInstitution}
              onChange={(ev) => setUseCustomInstitution(ev.target.checked)}
            />
            Custom institution (not in list)
          </label>
          {useCustomInstitution ? (
            <Input
              value={customInstitution}
              onChange={(ev) => setCustomInstitution(ev.target.value)}
              placeholder="Institution name"
            />
          ) : (
            <Typeahead
              label="Institution"
              placeholder="Start typing school name — suggestions appear as you type"
              options={institutionOptions}
              value={institutionId}
              selectedLabel={selectedInstitution?.name}
              onChange={pickInstitution}
              onQueryChange={setInstitutionSearch}
              remote
              emptyText="No institutions match — keep typing or enable Custom institution"
            />
          )}
          {!isSecondary ? (
            <>
              <Typeahead
                label="Programme"
                placeholder="Start typing programme e.g. Computer Science…"
                options={programmeOptions}
                value={programmeId}
                onChange={pickProgramme}
                emptyText="Type to filter programmes"
              />
              <Typeahead
                label="Department"
                placeholder="Start typing department…"
                options={departmentOptions}
                value={departmentId}
                onChange={setDepartmentId}
                emptyText="No departments loaded — run shared catalogue SQL seed"
              />
              <Typeahead
                label="Course of study"
                placeholder="Start typing course of study…"
                options={courseOfStudyOptions}
                value={courseOfStudy}
                selectedLabel={courseOfStudy}
                onChange={setCourseOfStudy}
                allowFreeText
                emptyText="No matches — keep typing your course name"
              />
            </>
          ) : null}
          <div className="space-y-2">
            <Label>Class level</Label>
            <Select value={classLevelId} onValueChange={setClassLevelId}>
              <SelectTrigger>
                <SelectValue placeholder="Select class level" />
              </SelectTrigger>
              <SelectContent>
                {classLevels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Session</Label>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select session year" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Semester / term</Label>
            <Select
              value={semesterTerm || 'none'}
              onValueChange={(v) => setSemesterTerm(v === 'none' ? '' : (v as SemesterTerm))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="first">First</SelectItem>
                <SelectItem value="second">Second</SelectItem>
                <SelectItem value="third">Third</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Course enrolments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Filter catalogue courses…"
            value={catalogueSearch}
            onChange={(e) => setCatalogueSearch(e.target.value)}
          />
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {catalogue.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No catalogue courses for this filter. Clear filters or run the shared catalogue SQL
                seed.
              </p>
            ) : (
              catalogue.map((c) => (
                <label key={c.id} className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedCourses.includes(c.id)}
                    onChange={() => toggleCourse(c.id)}
                  />
                  {c.code} — {c.title}
                </label>
              ))
            )}
          </div>
        </CardContent>
      </Card>
      <Button type="submit" disabled={saving} className="w-full">
        {saving ? 'Saving…' : 'Save academic profile'}
      </Button>
    </form>
  )
}
