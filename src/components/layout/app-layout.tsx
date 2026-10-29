import {
  Bell,
  Activity,
  BookOpen,
  Bot,
  CalendarDays,
  FileText,
  ClipboardCheck,
  GraduationCap,
  Home,
  Layers,
  LayoutDashboard,
  Library,
  Lightbulb,
  LogOut,
  Settings,
  Timer,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, type ComponentType, type MouseEvent } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { useActiveQuiz } from '@/contexts/active-quiz-context'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'

type NavItem = {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  end?: boolean
}

const desktopNav: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/subjects', label: 'My Subjects', icon: BookOpen },
  { to: '/app/courses', label: 'Courses', icon: Library },
  { to: '/app/planner', label: 'Study Planner', icon: CalendarDays },
  { to: '/app/notes', label: 'Notes', icon: FileText },
  { to: '/app/exams', label: 'Exams', icon: ClipboardCheck },
  { to: '/app/quizzes', label: 'Quizzes', icon: GraduationCap },
  { to: '/app/learning', label: 'Learning', icon: Lightbulb },
  { to: '/app/flashcards', label: 'Flashcards', icon: Layers },
  { to: '/app/ai', label: 'AI Tutor', icon: Bot },
  { to: '/app/progress', label: 'Progress', icon: TrendingUp },
  { to: '/app/activity', label: 'Activity', icon: Activity },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

const mobileNav: NavItem[] = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/courses', label: 'Courses', icon: Library },
  { to: '/app/planner', label: 'Planner', icon: CalendarDays },
  { to: '/app/ai', label: 'AI', icon: Bot },
  { to: '/app/settings', label: 'Profile', icon: Settings },
]

const pageTitles: Record<string, string> = {
  '/app': 'Dashboard',
  '/app/subjects': 'My Subjects',
  '/app/courses': 'Course Library',
  '/app/academic-profile': 'Academic Profile',
  '/app/activity': 'Activity',
  '/app/quizzes/practice': 'Practice Quiz',
  '/app/planner': 'Study Planner',
  '/app/notes': 'Notes',
  '/app/exams': 'Examination Centre',
  '/app/learning': 'Personalized Learning',
  '/app/quizzes': 'Quizzes',
  '/app/flashcards': 'Flashcards',
  '/app/ai': 'AI Tutor',
  '/app/progress': 'Progress',
  '/app/settings': 'Settings',
  '/app/notifications': 'Notifications',
  '/app/timer': 'Focus Timer',
  '/app/onboarding': 'Welcome',
  '/app/admin': 'Admin',
}

function resolveTitle(pathname: string): string {
  if (pathname.startsWith('/app/notes/') && pathname !== '/app/notes/new') {
    return 'Edit Note'
  }
  if (pathname === '/app/notes/new') return 'New Note'
  if (pathname.match(/^\/app\/subjects\/[^/]+$/)) return 'Subject'
  if (pathname.match(/^\/app\/quizzes\/[^/]+$/)) return 'Quiz'
  if (pathname.match(/^\/app\/courses\/[^/]+$/)) return 'Course'
  if (pathname.startsWith('/app/courses/materials/')) return 'Reader'
  return pageTitles[pathname] ?? 'StudySphere'
}

function NavLinkItem({
  to,
  label,
  icon: Icon,
  end,
  onClick,
}: {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  end?: boolean
  onClick?: () => void
}) {
  const location = useLocation()
  const active = end
    ? location.pathname === to
    : location.pathname === to || location.pathname.startsWith(`${to}/`)

  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-primary-600 text-white'
          : 'text-ink-muted hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-900/40',
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      {label}
    </Link>
  )
}

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const { active, isLockedPath } = useActiveQuiz()
  const title = useMemo(() => resolveTitle(location.pathname), [location.pathname])
  const quizLocked = Boolean(active) && isLockedPath(location.pathname)

  const handleSignOut = async () => {
    if (active) {
      window.alert('Finish or abandon your locked quiz before signing out (leaving fails the attempt).')
      return
    }
    await signOut()
    navigate('/login', { replace: true })
  }

  const guardNav = (e: MouseEvent, to: string) => {
    if (!active) return
    const allowed = `/app/quizzes/${active.quizId}/take`
    if (to !== allowed && !to.startsWith(allowed)) {
      e.preventDefault()
      window.alert(
        'You are in a locked quiz. Leaving this page will FAIL the attempt — use Submit on the quiz screen, or confirm leave from the quiz warning.',
      )
      navigate(allowed, { replace: true })
    }
  }

  useEffect(() => {
    if (active && isLockedPath(location.pathname)) {
      navigate(`/app/quizzes/${active.quizId}/take`, { replace: true })
    }
  }, [active, isLockedPath, location.pathname, navigate])

  return (
    <div className="flex min-h-dvh bg-surface text-ink">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface-elevated lg:flex">
        <div className="border-b border-border p-4">
          <Logo to={active ? `/app/quizzes/${active.quizId}/take` : '/app'} />
        </div>
        {quizLocked || active ? (
          <div className="m-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            Quiz locked — finish your assessment before using other sections.
          </div>
        ) : null}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="App">
          {desktopNav.map(({ to, label, icon, end }) => (
            <span key={to} onClickCapture={(e) => guardNav(e, to)}>
              <NavLinkItem to={to} label={label} icon={icon} end={end} />
            </span>
          ))}
          <div className="my-2 border-t border-border" />
          <span onClickCapture={(e) => guardNav(e, '/app/timer')}>
            <NavLinkItem to="/app/timer" label="Focus Timer" icon={Timer} />
          </span>
        </nav>
        <div className="border-t border-border p-4">
          <Link
            to="/app/notifications"
            className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-muted hover:bg-primary-50 dark:hover:bg-primary-900/40"
          >
            <Bell className="h-5 w-5" />
            Notifications
          </Link>
          <Link
            to="/app/settings"
            className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary-50 text-xs font-semibold text-primary-800 dark:bg-primary-900/50 dark:text-primary-100">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                (profile?.display_name ?? 'S').slice(0, 1).toUpperCase()
              )}
            </span>
            <span className="min-w-0 truncate text-sm font-medium">
              {profile?.display_name ?? 'Student'}
            </span>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start gap-2"
            onClick={() => void handleSignOut()}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur lg:hidden">
          <h1 className="font-display text-lg font-semibold">{title}</h1>
          <Link
            to="/app/notifications"
            className="rounded-xl p-2 text-ink-muted hover:bg-primary-50"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-24 lg:p-6 lg:pb-6">
          <div className="hidden lg:mb-6 lg:block">
            <h1 className="font-display text-2xl font-semibold">{title}</h1>
          </div>
          <Outlet />
        </main>

        <nav
          className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-border bg-surface-elevated px-2 py-2 lg:hidden"
          aria-label="Mobile"
        >
          {mobileNav.map(({ to, label, icon, end }) => {
            const Icon = icon
            const isActive = end
              ? location.pathname === to
              : location.pathname === to || location.pathname.startsWith(`${to}/`)
            return (
              <Link
                key={to}
                to={to}
                onClick={(e) => guardNav(e, to)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-[10px] font-medium',
                  isActive ? 'text-primary-600' : 'text-ink-muted',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
