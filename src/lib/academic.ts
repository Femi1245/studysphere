import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AcademicSession,
  CatalogueCourse,
  ClassLevel,
  Country,
  Department,
  EducationLevelRow,
  Institution,
  InstitutionType,
  Programme,
} from '@/types/database'

export async function fetchCountries(supabase: SupabaseClient): Promise<Country[]> {
  const { data, error } = await supabase.from('countries').select('*').order('name')
  if (error) throw error
  return (data as Country[]) ?? []
}

export async function fetchEducationLevels(
  supabase: SupabaseClient,
): Promise<EducationLevelRow[]> {
  const { data, error } = await supabase
    .from('education_levels')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return (data as EducationLevelRow[]) ?? []
}

export async function fetchInstitutions(
  supabase: SupabaseClient,
  filters: {
    countryId: string
    institutionType?: InstitutionType
    /** When search has 1+ characters, type filter is ignored so universities, polys, etc. all appear. */
    search?: string
    limit?: number
  },
): Promise<Institution[]> {
  const search = filters.search?.trim() ?? ''
  const crossTypeSearch = search.length >= 1

  let q = supabase
    .from('institutions')
    .select('*')
    .eq('country_id', filters.countryId)
    .eq('is_active', true)
    .order('name')

  // Prefer matching education type when browsing; when searching, suggest all types.
  if (filters.institutionType && !crossTypeSearch) {
    q = q.eq('institution_type', filters.institutionType)
  }
  if (search) {
    q = q.ilike('name', `%${search}%`)
  }

  const { data, error } = await q.limit(
    filters.limit ?? (crossTypeSearch ? 100 : 400),
  )
  if (error) throw error
  return (data as Institution[]) ?? []
}

/**
 * Institution-specific departments, falling back to shared (institution_id IS NULL).
 */
export async function fetchDepartments(
  supabase: SupabaseClient,
  institutionId: string,
): Promise<Department[]> {
  const { data: specific, error } = await supabase
    .from('departments')
    .select('*')
    .eq('institution_id', institutionId)
    .order('name')
  if (error) throw error
  if (specific?.length) return specific as Department[]

  const { data: shared, error: sharedErr } = await supabase
    .from('departments')
    .select('*')
    .is('institution_id', null)
    .order('name')
    .limit(100)
  if (sharedErr) throw sharedErr
  return (shared as Department[]) ?? []
}

/**
 * Institution programmes for the education level, plus shared national programmes.
 */
export async function fetchProgrammes(
  supabase: SupabaseClient,
  filters: { institutionId?: string; educationLevelId?: string },
): Promise<Programme[]> {
  const byId = new Map<string, Programme>()

  if (filters.institutionId) {
    let q = supabase
      .from('programmes')
      .select('*')
      .eq('is_active', true)
      .eq('institution_id', filters.institutionId)
      .order('name')
    if (filters.educationLevelId) q = q.eq('education_level_id', filters.educationLevelId)
    const { data, error } = await q.limit(200)
    if (error) throw error
    for (const row of (data as Programme[]) ?? []) byId.set(row.id, row)
  }

  // Always include shared programmes for the education level so campuses without seed still work
  {
    let q = supabase
      .from('programmes')
      .select('*')
      .eq('is_active', true)
      .is('institution_id', null)
      .order('name')
    if (filters.educationLevelId) q = q.eq('education_level_id', filters.educationLevelId)
    const { data, error } = await q.limit(200)
    if (error) throw error
    for (const row of (data as Programme[]) ?? []) {
      if (!byId.has(row.id)) byId.set(row.id, row)
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export async function fetchClassLevels(
  supabase: SupabaseClient,
  educationLevelId: string,
): Promise<ClassLevel[]> {
  const { data, error } = await supabase
    .from('class_levels')
    .select('*')
    .eq('education_level_id', educationLevelId)
    .order('sort_order')
  if (error) throw error
  return (data as ClassLevel[]) ?? []
}

export type CatalogueCourseFilters = {
  educationLevelId?: string
  institutionId?: string
  programmeId?: string
  classLevelId?: string
  semesterTerm?: string
  search?: string
}

/**
 * Published courses for the education level.
 * Includes institution-specific rows plus shared (institution_id IS NULL) national courses.
 */
export async function fetchCatalogueCourses(
  supabase: SupabaseClient,
  filters: CatalogueCourseFilters,
): Promise<CatalogueCourse[]> {
  const byId = new Map<string, CatalogueCourse>()

  if (filters.institutionId) {
    let q = supabase
      .from('catalogue_courses')
      .select('*')
      .eq('is_published', true)
      .eq('institution_id', filters.institutionId)
      .order('title')
    if (filters.educationLevelId) q = q.eq('education_level_id', filters.educationLevelId)
    if (filters.programmeId) q = q.eq('programme_id', filters.programmeId)
    if (filters.classLevelId) q = q.eq('class_level_id', filters.classLevelId)
    if (filters.semesterTerm) q = q.eq('semester_term', filters.semesterTerm)
    if (filters.search?.trim()) {
      const term = filters.search.trim()
      q = q.or(`title.ilike.%${term}%,code.ilike.%${term}%`)
    }
    const { data, error } = await q.limit(200)
    if (error) throw error
    for (const row of (data as CatalogueCourse[]) ?? []) byId.set(row.id, row)
  }

  {
    let q = supabase
      .from('catalogue_courses')
      .select('*')
      .eq('is_published', true)
      .is('institution_id', null)
      .order('title')
    if (filters.educationLevelId) q = q.eq('education_level_id', filters.educationLevelId)
    if (filters.programmeId) q = q.eq('programme_id', filters.programmeId)
    if (filters.classLevelId) q = q.eq('class_level_id', filters.classLevelId)
    if (filters.semesterTerm) q = q.eq('semester_term', filters.semesterTerm)
    if (filters.search?.trim()) {
      const term = filters.search.trim()
      q = q.or(`title.ilike.%${term}%,code.ilike.%${term}%`)
    }
    const { data, error } = await q.limit(200)
    if (error) throw error
    for (const row of (data as CatalogueCourse[]) ?? []) {
      if (!byId.has(row.id)) byId.set(row.id, row)
    }
  }

  // If programme filter emptied the list, show shared level courses without programme filter
  if (byId.size === 0 && filters.programmeId && filters.educationLevelId) {
    let q = supabase
      .from('catalogue_courses')
      .select('*')
      .eq('is_published', true)
      .eq('education_level_id', filters.educationLevelId)
      .is('institution_id', null)
      .order('title')
    if (filters.classLevelId) q = q.eq('class_level_id', filters.classLevelId)
    const { data, error } = await q.limit(200)
    if (error) throw error
    for (const row of (data as CatalogueCourse[]) ?? []) byId.set(row.id, row)
  }

  return [...byId.values()].sort((a, b) => a.code.localeCompare(b.code))
}

export async function fetchAcademicSessions(
  supabase: SupabaseClient,
): Promise<AcademicSession[]> {
  const { data, error } = await supabase
    .from('academic_sessions')
    .select('*')
    .order('starts_on', { ascending: false, nullsFirst: false })
  if (error) throw error
  return (data as AcademicSession[]) ?? []
}

export async function fetchDefaultPassMark(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'default_pass_mark')
    .maybeSingle()
  const raw = data?.value
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') return Number.parseFloat(raw) || 50
  return 50
}

export async function findCountryByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<Country | null> {
  const { data } = await supabase.from('countries').select('*').eq('code', code).maybeSingle()
  return (data as Country | null) ?? null
}
