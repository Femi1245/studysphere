import { Navigate, Outlet } from 'react-router-dom'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/auth-context'

export function AdminRoute() {
  const { loading, profile } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-primary-600" />
      </div>
    )
  }

  if (profile?.role !== 'admin') {
    return <Navigate to="/app" replace />
  }

  return <Outlet />
}
