import {
  Bell,
  BookMarked,
  Bot,
  Building2,
  CalendarDays,
  ClipboardList,
  Layers,
  LineChart,
  ShoppingBag,
  Store,
  Timer,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { brand } from '@/config/brand'

const campusBlueprintSections = [
  {
    icon: Building2,
    title: 'Housing marketplace',
    description:
      'A school-aware housing discovery funnel with trusted listings, transparent cost breakdowns, and inspection requests built around student safety.',
    points: ['Campus and neighborhood filters', 'Verified listings and price clarity', 'Inspection requests and saved rooms'],
  },
  {
    icon: ShoppingBag,
    title: 'Food & daily essentials',
    description:
      'Local restaurant, grocery, and pickup discovery tuned for affordability, short prep times, and campus-first ordering flows.',
    points: ['Menu and price discovery', 'Pickup and delivery readiness', 'Student vendor visibility'],
  },
  {
    icon: Store,
    title: 'Campus services',
    description:
      'Student marketplaces for print, laundry, repair, and other campus essentials with profile checks and clear moderation.',
    points: ['Service provider profiles', 'Saved searches and enquiries', 'Moderation and report flows'],
  },
  {
    icon: CalendarDays,
    title: 'Study planning & tasks',
    description:
      'Create tasks with due dates, priorities, and links to subjects. Mark exams and revision sessions so your calendar reflects what counts.',
    points: ['Weekly and daily views', 'Exam and revision flags', 'Priority and status tracking'],
  },
  {
    icon: Bot,
    title: 'AI tutoring',
    description:
      'Start conversations to clarify concepts, walk through problems, or summarize topics. Keep context tied to your subjects where possible.',
    points: ['Subject-aware chats', 'Step-by-step explanations', 'Study-focused guardrails'],
  },
  {
    icon: BookMarked,
    title: 'Notes & resources',
    description:
      'Write rich notes, pin favorites, and attach resources. Organize by subject and topic so review sessions stay fast.',
    points: ['Structured note library', 'Pin and favorite notes', 'File attachments when enabled'],
  },
  {
    icon: ClipboardList,
    title: 'Quizzes & flashcards',
    description:
      'Author practice questions or build decks for spaced repetition. Review before tests and see which answers need work.',
    points: ['Multiple question types', 'Attempt history', 'Flashcard scheduling'],
  },
  {
    icon: LineChart,
    title: 'Progress tracking',
    description:
      'Log study sessions, complete tasks, and view quiz scores over time. Understand where your hours go and what improves.',
    points: ['Session timers', 'Task completion stats', 'Quiz performance summaries'],
  },
  {
    icon: Layers,
    title: 'Subjects & topics',
    description:
      'Model your courses as subjects with nested topics. Mark topics complete or flag them for revision.',
    points: ['Custom colors and icons', 'Topic completion', 'Revision reminders'],
  },
  {
    icon: Timer,
    title: 'Focus sessions',
    description:
      'Use built-in focus and break intervals aligned with your preferences to sustain deep work without burning out.',
    points: ['Configurable focus length', 'Break reminders', 'Session notes'],
  },
  {
    icon: Bell,
    title: 'Notifications',
    description:
      'Optional reminders for upcoming tasks, exams, revision, and goals—controlled from your preferences.',
    points: ['Task due reminders', 'Exam alerts', 'Per-channel toggles'],
  },
  {
    icon: Users,
    title: 'Student opportunities',
    description:
      'Tutoring, gigs, scholarships, and campus roles designed to help students discover safe opportunities and community roles without unfair friction.',
    points: ['Verified opportunity sources', 'Trusted student-facing listings', 'Campus-scoped discovery'],
  },
] as const

export function FeaturesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight">Features</h1>
        <p className="mt-4 text-lg text-ink-muted">
          {brand.name} brings planning, learning, and campus discovery together so students can live, study, and act with more clarity.
        </p>
      </div>

      <div className="mt-8 rounded-3xl border border-primary-200 bg-primary-50 p-6 text-left dark:border-primary-900 dark:bg-primary-950/30">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
          CampusOS product blueprint
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-ink">Built around six connected pillars</h2>
        <p className="mt-3 max-w-3xl text-base text-ink-muted">
          The platform starts with trusted housing and expands into food, services, academics, campus life, and student opportunities. The key principle is simple: a smaller, verified campus ecosystem is more valuable than a broad but stale one.
        </p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        {campusBlueprintSections.map(({ icon: Icon, title, description, points }) => (
          <Card key={title} className="h-full">
            <CardHeader>
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-200">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-ink-muted">
                {points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="text-accent-600" aria-hidden>
                      •
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-16 text-center">
        <Button size="lg" asChild>
          <Link to="/signup">Start Studying</Link>
        </Button>
      </div>
    </div>
  )
}
