import type { SupabaseClient } from '@supabase/supabase-js'
import type { CatalogueRequestType } from '@/types/database'

export async function submitCatalogueRequest(
  supabase: SupabaseClient,
  input: {
    userId: string
    requestType: CatalogueRequestType
    title: string
    details?: string
    countryId?: string | null
    educationLevelId?: string | null
  },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('catalogue_requests').insert({
    user_id: input.userId,
    request_type: input.requestType,
    title: input.title.trim(),
    details: input.details?.trim() || null,
    country_id: input.countryId ?? null,
    education_level_id: input.educationLevelId ?? null,
  })
  return { error: error?.message ?? null }
}
