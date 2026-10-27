import {
  Bell,
  BookMarked,
  Bot,
  CalendarDays,
  ClipboardList,
  Layers,
  LineChart,
  Timer,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { brand } from '@/config/brand'

const featureSections = [
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
] as const

export function FeaturesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight">Features</h1>
        <p className="mt-4 text-lg text-ink-muted">
          {brand.name} brings planning, learning, and practice together so you can prepare with confidence.
        </p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        {featureSections.map(({ icon: Icon, title, description, points }) => (
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
