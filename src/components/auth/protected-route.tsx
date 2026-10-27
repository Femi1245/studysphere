import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/auth-context'

export function ProtectedRoute() {
  const { loading, user, profile } = useAuth()
  const location = useLocation()
  const isOnboarding = location.pathname === '/app/onboarding'

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-primary-600" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (profile && !profile.onboarding_completed && !isOnboarding) {
    return <Navigate to="/app/onboarding" replace />
  }

  return <Outlet />
}
