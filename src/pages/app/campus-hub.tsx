import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarCheck2,
  MapPinned,
  ShoppingBasket,
  Sparkles,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const pillars: {
  icon: LucideIcon
  title: string
  description: string
  status: string
  to?: string
}[] = [
  {
    icon: Building2,
    title: 'Housing marketplace',
    description:
      'Search published rooms by school, area, type, and budget. Compare listed move-in costs, save options, and request an inspection.',
    status: 'Available · listings require admin review',
    to: '/app/housing',
  },
  {
    icon: ShoppingBasket,
    title: 'Food & groceries',
    description:
      'Campus food discovery, pickup ordering, and daily essentials so students can find affordable options nearby without messy WhatsApp chains.',
    status: 'Phase 2 · daily return loop',
  },
  {
    icon: Store,
    title: 'Campus services',
    description:
      'Laundry, repairs, print hubs, grooming, and student-to-student resale listings with moderation and privacy safeguards.',
    status: 'Phase 2 · service discovery',
  },
  {
    icon: BookOpen,
    title: 'Academic life',
    description:
      'Timetables, reminders, assignment tracking, GPA tools, and revision planning that keep the app useful even when students are not buying anything.',
    status: 'Available · study tools',
    to: '/app/planner',
  },
  {
    icon: CalendarCheck2,
    title: 'Campus life',
    description:
      'Events, notices, clubs, lost-and-found, and campus directories that help students stay informed and connected to official updates.',
    status: 'Phase 3 · community utility',
  },
  {
    icon: Users,
    title: 'Opportunities',
    description:
      'Tutoring, part-time gigs, internships, scholarships, and community roles with clear safety rules and official-source links.',
    status: 'Phase 3-4 · student growth',
  },
] as const

const guardrails = [
  'Trust over volume: small sets of verified listings outperform large stale inventories.',
  'Campus-first search: every result scopes to the student’s school and nearby area.',
  'Operations before automation: disputes, moderation, and verification stay human-led where trust matters.',
  'Low-data design: clear pricing, local search, and fast mobile flows work on patchy networks.',
] as const

export function CampusHubPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-gradient-to-br from-primary-50 via-surface to-accent-50 p-6 shadow-sm dark:from-primary-950/40 dark:via-surface dark:to-accent-950/30">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:border-primary-800 dark:bg-primary-950/50 dark:text-primary-200">
              <Sparkles className="h-3.5 w-3.5" /> CampusOS Nigeria blueprint
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
              A safer campus ecosystem built around student needs.
            </h1>
            <p className="mt-4 max-w-xl text-base text-ink-muted">
              The blueprint says the product should begin with housing, expand to food, services, study tools, and campus life, and keep trust, verification, and affordability at the center.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[360px]">
            <div className="rounded-2xl border border-border bg-white/80 p-3 shadow-sm dark:bg-surface-elevated">
              <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
                <BadgeCheck className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.14em]">Trust</span>
              </div>
              <p className="mt-2 text-sm text-ink-muted">Verification before volume.</p>
            </div>
            <div className="rounded-2xl border border-border bg-white/80 p-3 shadow-sm dark:bg-surface-elevated">
              <div className="flex items-center gap-2 text-accent-600 dark:text-accent-400">
                <MapPinned className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.14em]">Campus</span>
              </div>
              <p className="mt-2 text-sm text-ink-muted">Scoped by school and area.</p>
            </div>
            <div className="rounded-2xl border border-border bg-white/80 p-3 shadow-sm dark:bg-surface-elevated">
              <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400">
                <BookOpen className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.14em]">Study</span>
              </div>
              <p className="mt-2 text-sm text-ink-muted">Academic value even outside commerce.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pillars.map(({ icon: Icon, title, description, status, to }) => (
          <Card key={title} className="h-full border-border bg-surface-elevated">
            <CardHeader>
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-200">
                <Icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription>{status}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-ink-muted">{description}</p>
              {to ? (
                <Link to={to} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:underline">
                  Open {title.toLowerCase()} <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="rounded-3xl border border-border bg-surface-elevated p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">Product principles</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink">What the launch should optimize for</h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {guardrails.map((item) => (
            <div key={item} className="rounded-2xl border border-border bg-surface p-4 text-sm leading-6 text-ink-muted">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface-elevated p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">Launch roadmap</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink">MVP sequence suggested by the blueprint</h2>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">Phase 1</p>
            <h3 className="mt-2 text-lg font-semibold">Housing-first discovery</h3>
            <p className="mt-2 text-sm text-ink-muted">
              Verified listing search, local filters, transparent pricing, and easier inspection booking.
            </p>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">Phase 2</p>
            <h3 className="mt-2 text-lg font-semibold">Daily essentials</h3>
            <p className="mt-2 text-sm text-ink-muted">
              Vendor discovery, food ordering, and campus services that create repeat usage and transaction volume.
            </p>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">Phase 3</p>
            <h3 className="mt-2 text-lg font-semibold">Full campus life</h3>
            <p className="mt-2 text-sm text-ink-muted">
              Events, notices, clubs, opportunities, and study tools connected under one campus identity.
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-3xl border border-primary-200 bg-primary-50 p-6 dark:border-primary-900 dark:bg-primary-950/30 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">Next action</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Use this as the product foundation for a campus-first rollout.</h2>
        </div>
        <Link
          to="/app"
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
        >
          Back to dashboard <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  )
}
