import {
  BookOpen,
  Bot,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  LineChart,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { brand } from '@/config/brand'
import { cn } from '@/lib/utils'

const features = [
  {
    icon: CalendarDays,
    title: 'Study planning',
    description:
      'Schedule tasks, exams, and revision sessions so you always know what to work on next.',
  },
  {
    icon: Bot,
    title: 'AI tutoring',
    description:
      'Ask questions and get guided explanations tailored to the subjects you are studying.',
  },
  {
    icon: BookOpen,
    title: 'Notes',
    description:
      'Capture and organize notes by subject and topic, linked to your study plan.',
  },
  {
    icon: ClipboardCheck,
    title: 'Practice quizzes',
    description:
      'Build quizzes and flashcards to test yourself before exams and track weak areas.',
  },
  {
    icon: LineChart,
    title: 'Progress tracking',
    description:
      'See study time, completed tasks, and quiz results in one clear view.',
  },
] as const

const steps = [
  {
    step: '1',
    title: 'Create your account',
    description: 'Sign up free and set your subjects, goals, and study preferences.',
  },
  {
    step: '2',
    title: 'Plan your week',
    description: 'Add tasks, due dates, and revision blocks so your schedule stays realistic.',
  },
  {
    step: '3',
    title: 'Learn and review',
    description: 'Use notes, AI help, and quizzes—then watch your progress build over time.',
  },
] as const

const benefits = [
  'One workspace for planning, notes, and practice',
  'Designed for students at school, college, and beyond',
  'Works in your browser—pick up where you left off',
  'Free to use in v1—no credit card required',
] as const

const faqs = [
  {
    question: 'Is StudySphere free?',
    answer:
      'Yes. The first version is free forever for core study features. See our Pricing page for details.',
  },
  {
    question: 'Do I need to install anything?',
    answer:
      'No. StudySphere runs in your web browser. You can add it to your home screen as a progressive web app if you like.',
  },
  {
    question: 'What subjects can I study?',
    answer:
      'You create your own subjects and topics—math, sciences, languages, professional exams, or anything else on your schedule.',
  },
  {
    question: 'How does AI tutoring work?',
    answer:
      'You can ask questions in context of your studies. Responses are meant to explain concepts and guide practice—not replace your coursework or instructors.',
  },
  {
    question: 'Is my data private?',
    answer:
      'We store your account data securely and use it only to provide the service. Read our Privacy Policy for full details.',
  },
] as const

function FaqItem({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string
  answer: string
  open: boolean
  onToggle: () => void
}) {
  const panelId = question.replace(/\s+/g, '-').toLowerCase()
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`faq-${panelId}`}
      >
        <span className="font-medium text-ink">{question}</span>
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 text-ink-muted transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      <div
        id={`faq-${panelId}`}
        role="region"
        hidden={!open}
        className={cn('pb-4 text-sm text-ink-muted', !open && 'hidden')}
      >
        {answer}
      </div>
    </div>
  )
}

export function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <div>
      <section className="border-b border-border bg-gradient-to-b from-primary-50/80 to-surface dark:from-primary-950/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs font-medium text-accent-600">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {brand.name}
            </p>
            <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Study Smarter. Learn Better. Achieve More.
            </h1>
            <p className="mt-6 text-lg text-ink-muted sm:text-xl">{brand.description}</p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link to="/signup">Start Studying</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/features">Explore Features</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight">Everything you need to study well</h2>
          <p className="mt-3 text-ink-muted">
            Plan your time, understand hard material, and measure progress without switching between apps.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="h-full">
              <CardHeader>
                <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-200">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface-elevated">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-center font-display text-3xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map(({ step, title, description }) => (
              <li key={step} className="relative text-center md:text-left">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 font-display text-lg font-bold text-white">
                  {step}
                </span>
                <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-ink-muted">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight">Built for focused learning</h2>
            <p className="mt-4 text-ink-muted">
              {brand.name} keeps planning, content, and practice connected so you spend less time organizing and more time learning.
            </p>
          </div>
          <ul className="space-y-4">
            {benefits.map((item) => (
              <li key={item} className="flex gap-3 text-ink">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-600" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-border bg-primary-50/50 dark:bg-primary-950/20">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-center font-display text-3xl font-bold tracking-tight">Frequently asked questions</h2>
          <Card className="mt-10">
            <CardContent className="px-5 pt-2">
              {faqs.map((faq, index) => (
                <FaqItem
                  key={faq.question}
                  question={faq.question}
                  answer={faq.answer}
                  open={openFaq === index}
                  onToggle={() => setOpenFaq((current) => (current === index ? null : index))}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
        <h2 className="font-display text-3xl font-bold tracking-tight">Ready to organize your studies?</h2>
        <p className="mx-auto mt-3 max-w-xl text-ink-muted">
          Create a free account and start planning your next study session in minutes.
        </p>
        <Button size="lg" className="mt-8" asChild>
          <Link to="/signup">Start Studying</Link>
        </Button>
      </section>
    </div>
  )
}
