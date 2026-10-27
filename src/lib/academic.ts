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
    /** When search has 2+ characters, type filter is ignored so universities, polys, etc. all appear. */
    search?: string
    limit?: number
  },
): Promise<Institution[]> {
  const search = filters.search?.trim() ?? ''
  const crossTypeSearch = search.length >= 2

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
    filters.limit ?? (crossTypeSearch ? 80 : 400),
  )
  if (error) throw error
  return (data as Institution[]) ?? []
}

export async function fetchDepartments(
  supabase: SupabaseClient,
  institutionId: string,
): Promise<Department[]> {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('institution_id', institutionId)
    .order('name')
  if (error) throw error
  return (data as Department[]) ?? []
}

export async function fetchProgrammes(
  supabase: SupabaseClient,
  filters: { institutionId?: string; educationLevelId?: string },
): Promise<Programme[]> {
  let q = supabase.from('programmes').select('*').eq('is_active', true).order('name')
  if (filters.institutionId) q = q.eq('institution_id', filters.institutionId)
  if (filters.educationLevelId) q = q.eq('education_level_id', filters.educationLevelId)
  const { data, error } = await q.limit(200)
  if (error) throw error
  return (data as Programme[]) ?? []
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

export async function fetchCatalogueCourses(
  supabase: SupabaseClient,
  filters: CatalogueCourseFilters,
): Promise<CatalogueCourse[]> {
  let q = supabase
    .from('catalogue_courses')
    .select('*')
    .eq('is_published', true)
    .order('title')
  if (filters.educationLevelId) q = q.eq('education_level_id', filters.educationLevelId)
  if (filters.institutionId) q = q.eq('institution_id', filters.institutionId)
  if (filters.programmeId) q = q.eq('programme_id', filters.programmeId)
  if (filters.classLevelId) q = q.eq('class_level_id', filters.classLevelId)
  if (filters.semesterTerm) q = q.eq('semester_term', filters.semesterTerm)
  if (filters.search?.trim()) {
    const term = filters.search.trim()
    q = q.or(`title.ilike.%${term}%,code.ilike.%${term}%`)
  }
  const { data, error } = await q.limit(200)
  if (error) throw error
  return (data as CatalogueCourse[]) ?? []
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
