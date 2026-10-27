import { Database } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export function SupabaseSetupBanner() {
  return (
    <EmptyState
      icon={Database}
      title="Supabase is not configured"
      description="Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file, then restart the dev server to connect your study data."
    />
  )
}
