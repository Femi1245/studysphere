import type { SupabaseClient } from '@supabase/supabase-js'

export type LogActivityInput = {
  userId: string
  eventType: string
  subjectId?: string | null
  catalogueCourseId?: string | null
  materialId?: string | null
  quizId?: string | null
  attemptId?: string | null
  metadata?: Record<string, unknown>
}

export async function logActivity(
  supabase: SupabaseClient,
  input: LogActivityInput,
): Promise<void> {
  try {
    const { error } = await supabase.from('activity_events').insert({
      user_id: input.userId,
      event_type: input.eventType,
      subject_id: input.subjectId ?? null,
      catalogue_course_id: input.catalogueCourseId ?? null,
      material_id: input.materialId ?? null,
      quiz_id: input.quizId ?? null,
      attempt_id: input.attemptId ?? null,
      metadata: input.metadata ?? {},
    })
    if (error) console.warn('[activity]', error.message)
  } catch (e) {
    console.warn('[activity]', e)
  }
}
