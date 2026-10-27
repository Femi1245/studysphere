import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
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
  findCountryByCode,
} from '@/lib/academic'
import { logActivity } from '@/lib/activity'
import { submitCatalogueRequest } from '@/lib/catalogue-request'
import {
  institutionTypeForEducationCode,
  isSecondaryEducationCode,
  mapAcademicCodeToProfileLevel,
} from '@/lib/education-map'
import { trySupabase } from '@/lib/supabase/client'
import type {
  AcademicEducationLevelCode,
  AcademicSession,
  CatalogueCourse,
  ClassLevel,
  Country,
  EducationLevelRow,
  Institution,
  LearningStyle,
  Programme,
  SemesterTerm,
} from '@/types/database'

const STEPS = 5

export function OnboardingPage() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const supabase = trySupabase()

  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [countries, setCountries] = useState<Country[]>([])
  const [educationLevels, setEducationLevels] = useState<EducationLevelRow[]>([])
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [classLevels, setClassLevels] = useState<ClassLevel[]>([])
  const [sessions, setSessions] = useState<AcademicSession[]>([])
  const [catalogueCourses, setCatalogueCourses] = useState<CatalogueCourse[]>([])

  const [displayName, setDisplayName] = useState('')
  const [countryId, setCountryId] = useState('')
  const [educationLevelId, setEducationLevelId] = useState('')
  const [institutionId, setInstitutionId] = useState('')
  const [institutionSearch, setInstitutionSearch] = useState('')
  const [customInstitution, setCustomInstitution] = useState('')
  const [useCustomInstitution, setUseCustomInstitution] = useState(false)
  const [programmeId, setProgrammeId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [classLevelId, setClassLevelId] = useState('')
  const [academicSessionId, setAcademicSessionId] = useState('')
  const [semesterTerm, setSemesterTerm] = useState<SemesterTerm | ''>('')
  const [courseOfStudy, setCourseOfStudy] = useState('')
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([])
  const [linkSubjects, setLinkSubjects] = useState(true)
  const [preferredDuration, setPreferredDuration] = useState('25')
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  )
  const [learningStyle, setLearningStyle] = useState<LearningStyle | ''>('')
  const [examGoals, setExamGoals] = useState('')
  const [courseSearch, setCourseSearch] = useState('')

  const selectedLevel = useMemo(
    () => educationLevels.find((l) => l.id === educationLevelId) ?? null,
    [educationLevels, educationLevelId],
  )
  const isSecondary = selectedLevel
    ? isSecondaryEducationCode(selectedLevel.code)
    : false

  const loadReference = useCallback(async () => {
    if (!supabase) return
    const [c, levels, sess] = await Promise.all([
      fetchCountries(supabase),
      fetchEducationLevels(supabase),
      fetchAcademicSessions(supabase),
    ])
    setCountries(c)
    setEducationLevels(levels)
    setSessions(sess)
    if (!countryId) {
      const ng = c.find((x) => x.code === 'NG') ?? (await findCountryByCode(supabase, 'NG'))
      if (ng) setCountryId(ng.id)
      else if (c[0]) setCountryId(c[0].id)
    }
  }, [supabase, countryId])

  useEffect(() => {
    void loadReference()
  }, [loadReference])

  useEffect(() => {
    if (!supabase || !countryId || !selectedLevel || useCustomInstitution) {
      setInstitutions([])
      return
    }
    const type = institutionTypeForEducationCode(selectedLevel.code)
    void fetchInstitutions(supabase, {
      countryId,
      institutionType: type,
      search: institutionSearch,
    }).then(setInstitutions)
  }, [supabase, countryId, selectedLevel, institutionSearch, useCustomInstitution])

  useEffect(() => {
    if (!supabase || !educationLevelId) return
    void fetchClassLevels(supabase, educationLevelId).then(setClassLevels)
  }, [supabase, educationLevelId])

  useEffect(() => {
    if (!supabase || !institutionId || isSecondary) {
      setProgrammes([])
      setDepartments([])
      return
    }
    void Promise.all([
      fetchProgrammes(supabase, { institutionId, educationLevelId }),
      fetchDepartments(supabase, institutionId),
    ]).then(([p, d]) => {
      setProgrammes(p)
      setDepartments(d)
    })
  }, [supabase, institutionId, educationLevelId, isSecondary])

  useEffect(() => {
    if (!supabase || !educationLevelId) return
    void fetchCatalogueCourses(supabase, {
      educationLevelId,
      institutionId: institutionId || undefined,
      programmeId: programmeId || undefined,
      classLevelId: classLevelId || undefined,
      semesterTerm: semesterTerm || undefined,
      search: courseSearch,
    }).then(setCatalogueCourses)
  }, [
    supabase,
    educationLevelId,
    institutionId,
    programmeId,
    classLevelId,
    semesterTerm,
    courseSearch,
  ])

  useEffect(() => {
    const current = sessions.find((s) => s.is_current)
    if (current && !academicSessionId) setAcademicSessionId(current.id)
  }, [sessions, academicSessionId])

  if (!supabase) return <SupabaseSetupBanner />

  const toggleCourse = (id: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const requestInstitution = async () => {
    if (!user || !customInstitution.trim()) return
    const { error: reqErr } = await submitCatalogueRequest(supabase, {
      userId: user.id,
      requestType: 'institution',
      title: customInstitution.trim(),
      countryId,
      educationLevelId: educationLevelId || null,
    })
    if (reqErr) setError(reqErr)
    else setError(null)
  }

  const requestCourse = async () => {
    if (!user || !courseSearch.trim()) return
    const { error: reqErr } = await submitCatalogueRequest(supabase, {
      userId: user.id,
      requestType: 'course',
      title: courseSearch.trim(),
      countryId,
      educationLevelId: educationLevelId || null,
    })
    if (reqErr) setError(reqErr)
  }

  const finish = async (event: FormEvent) => {
    event.preventDefault()
    if (!user || !countryId || !educationLevelId || !selectedLevel) return
    setError(null)
    setSubmitting(true)

    const schoolName =
      useCustomInstitution
        ? customInstitution.trim()
        : (institutions.find((i) => i.id === institutionId)?.name ?? customInstitution.trim())

    const profileLevel = mapAcademicCodeToProfileLevel(
      selectedLevel.code as AcademicEducationLevelCode,
    )

    const { error: profErr } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        education_level: profileLevel,
        school: schoolName || null,
        exam_goals: examGoals.trim() || null,
        preferred_study_duration: Number.parseInt(preferredDuration, 10) || 25,
        timezone,
        learning_style: learningStyle || null,
        country_id: countryId,
        onboarding_completed: true,
        academic_profile_complete: true,
      })
      .eq('id', user.id)

    if (profErr) {
      setSubmitting(false)
      setError(profErr.message)
      return
    }

    const { error: acadErr } = await supabase.from('student_academic_profiles').upsert(
      {
        user_id: user.id,
        country_id: countryId,
        institution_id: useCustomInstitution ? null : institutionId || null,
        education_level_id: educationLevelId,
        programme_id: isSecondary ? null : programmeId || null,
        department_id: isSecondary ? null : departmentId || null,
        class_level_id: classLevelId || null,
        academic_session_id: academicSessionId || null,
        semester_term: semesterTerm || null,
        course_of_study: courseOfStudy.trim() || null,
        custom_institution_name: useCustomInstitution ? customInstitution.trim() || null : null,
        custom_programme_name: null,
      },
      { onConflict: 'user_id' },
    )

    if (acadErr) {
      setSubmitting(false)
      setError(acadErr.message)
      return
    }

    for (const courseId of selectedCourseIds) {
      let subjectId: string | null = null
      const course = catalogueCourses.find((c) => c.id === courseId)
      if (linkSubjects && course) {
        const { data: sub } = await supabase
          .from('subjects')
          .insert({
            user_id: user.id,
            name: `${course.code} — ${course.title}`,
            color: '#1e3a5f',
          })
          .select('id')
          .single()
        subjectId = sub?.id ?? null
      }
      await supabase.from('student_course_enrolments').upsert(
        {
          user_id: user.id,
          catalogue_course_id: courseId,
          subject_id: subjectId,
          status: 'active',
        },
        { onConflict: 'user_id,catalogue_course_id' },
      )
      void logActivity(supabase, {
        userId: user.id,
        eventType: 'course_enrolled',
        catalogueCourseId: courseId,
      })
    }

    void logActivity(supabase, {
      userId: user.id,
      eventType: 'profile_updated',
      metadata: { source: 'onboarding' },
    })

    setSubmitting(false)
    await refreshProfile()
    navigate('/app', { replace: true })
  }

  const canNext =
    (step === 1 && displayName.trim() && countryId && educationLevelId) ||
    (step === 2 &&
      (useCustomInstitution ? customInstitution.trim() : institutionId || customInstitution.trim())) ||
    step === 3 ||
    step === 4 ||
    step === 5

  return (
    <div className="mx-auto max-w-lg">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Academic setup</CardTitle>
          <CardDescription>
            Step {step} of {STEPS} — personalize your catalogue and study space.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display_name">Display name</Label>
                <Input
                  id="display_name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  placeholder="Alex Student"
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={countryId} onValueChange={setCountryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
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
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {educationLevels.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useCustomInstitution}
                  onChange={(e) => setUseCustomInstitution(e.target.checked)}
                />
                My school is not listed
              </label>
              {useCustomInstitution ? (
                <>
                  <Input
                    placeholder="Institution name"
                    value={customInstitution}
                    onChange={(e) => setCustomInstitution(e.target.value)}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => void requestInstitution()}>
                    Submit catalogue request
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    placeholder="Type to search any university, polytechnic, college…"
                    value={institutionSearch}
                    onChange={(e) => setInstitutionSearch(e.target.value)}
                  />
                  <p className="text-xs text-ink-muted">
                    Browse matches your education level. Searching (2+ letters) suggests across
                    universities, polytechnics, colleges, and schools.
                  </p>
                  <Select value={institutionId} onValueChange={setInstitutionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select institution" />
                    </SelectTrigger>
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
                  {institutions.length === 0 ? (
                    <p className="text-xs text-danger">
                      No institutions loaded. Apply the Nigeria seed SQL migrations, or use “My
                      school is not listed”.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              {!isSecondary ? (
                <>
                  <div className="space-y-2">
                    <Label>Programme</Label>
                    <Select value={programmeId} onValueChange={setProgrammeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        {programmes.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={departmentId} onValueChange={setDepartmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="course_of_study">Course of study</Label>
                    <Input
                      id="course_of_study"
                      value={courseOfStudy}
                      onChange={(e) => setCourseOfStudy(e.target.value)}
                    />
                  </div>
                </>
              ) : null}
              <div className="space-y-2">
                <Label>Class / level</Label>
                <Select value={classLevelId} onValueChange={setClassLevelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {classLevels.map((cl) => (
                      <SelectItem key={cl.id} value={cl.id}>
                        {cl.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Academic session</Label>
                <Select value={academicSessionId} onValueChange={setAcademicSessionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
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
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    <SelectItem value="first">First</SelectItem>
                    <SelectItem value="second">Second</SelectItem>
                    <SelectItem value="third">Third</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <Input
                placeholder="Search catalogue courses…"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={linkSubjects}
                  onChange={(e) => setLinkSubjects(e.target.checked)}
                />
                Create personal subjects for enrolled courses
              </label>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border p-2">
                {catalogueCourses.length === 0 ? (
                  <p className="text-sm text-ink-muted">No courses match. Request one below.</p>
                ) : (
                  catalogueCourses.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/30"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCourseIds.includes(c.id)}
                        onChange={() => toggleCourse(c.id)}
                      />
                      <span>
                        <span className="font-medium">{c.code}</span> — {c.title}
                      </span>
                    </label>
                  ))
                )}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void requestCourse()}>
                Request missing course
              </Button>
            </div>
          ) : null}

          {step === 5 ? (
            <form id="onboarding-finish" onSubmit={(e) => void finish(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Preferred study session (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={5}
                  max={180}
                  value={preferredDuration}
                  onChange={(e) => setPreferredDuration(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Learning style (optional)</Label>
                <Select
                  value={learningStyle || 'none'}
                  onValueChange={(v) =>
                    setLearningStyle(v === 'none' ? '' : (v as LearningStyle))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    <SelectItem value="visual">Visual</SelectItem>
                    <SelectItem value="auditory">Auditory</SelectItem>
                    <SelectItem value="reading">Reading / writing</SelectItem>
                    <SelectItem value="kinesthetic">Kinesthetic</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exam_goals">Exam goals (optional)</Label>
                <Textarea
                  id="exam_goals"
                  value={examGoals}
                  onChange={(e) => setExamGoals(e.target.value)}
                  rows={2}
                />
              </div>
            </form>
          ) : null}

          {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

          <div className="mt-6 flex gap-2">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : null}
            {step < STEPS ? (
              <Button
                type="button"
                className="flex-1"
                disabled={!canNext}
                onClick={() => setStep((s) => s + 1)}
              >
                Continue
              </Button>
            ) : (
              <Button
                type="submit"
                form="onboarding-finish"
                className="flex-1"
                disabled={submitting}
              >
                {submitting ? 'Saving…' : 'Finish'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
