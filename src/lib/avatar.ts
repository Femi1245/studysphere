import type { SupabaseClient } from '@supabase/supabase-js'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES = 2 * 1024 * 1024

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED.has(file.type)) return 'Use a JPEG, PNG, WebP, or GIF image.'
  if (file.size > MAX_BYTES) return 'Avatar must be 2 MB or smaller.'
  return null
}

function extFor(file: File): string {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  return 'jpg'
}

/** Upload avatar to public avatars bucket and return public URL. */
export async function uploadAvatar(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  const invalid = validateAvatarFile(file)
  if (invalid) return { url: null, error: invalid }

  const path = `${userId}/avatar.${extFor(file)}`
  const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: '3600',
  })
  if (upErr) return { url: null, error: upErr.message }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const url = `${data.publicUrl}?t=${Date.now()}`
  return { url, error: null }
}

export async function removeAvatarFile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ error: string | null }> {
  const paths = ['jpg', 'png', 'webp', 'gif'].map((ext) => `${userId}/avatar.${ext}`)
  const { error } = await supabase.storage.from('avatars').remove(paths)
  return { error: error?.message ?? null }
}
