import { Heart, Target, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { brand } from '@/config/brand'

const values = [
  {
    icon: Target,
    title: 'Clarity over clutter',
    body: 'We design tools that reduce noise so you can see what matters—deadlines, weak topics, and time spent learning.',
  },
  {
    icon: Users,
    title: 'Students first',
    body: 'Features are shaped around real study workflows: planning a week, revising before exams, and tracking improvement.',
  },
  {
    icon: Heart,
    title: 'Honest product',
    body: 'We do not inflate claims with fake numbers. We ship useful tools and improve them based on how students actually study.',
  },
] as const

export function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight">About {brand.name}</h1>
        <p className="mt-4 text-lg text-ink-muted">{brand.description}</p>
      </div>

      <div className="mx-auto mt-14 max-w-3xl space-y-6 text-ink-muted">
        <p>
          {brand.name} started from a simple idea: studying should feel organized, not overwhelming. Too many students
          juggle calendars, notes apps, and random quiz sites without a clear picture of progress.
        </p>
        <p>
          We are building one place to plan your work, store what you learn, practice with quizzes, and get help when
          you are stuck—so you can focus on understanding the material.
        </p>
        <p>
          Version 1 is free for core features. We are iterating in the open with students who want a calmer, more
          effective way to prepare for classes and exams.
        </p>
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {values.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardHeader>
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-ink-muted">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-16 rounded-2xl border border-border bg-surface-elevated p-8 text-center">
        <h2 className="font-display text-2xl font-semibold">Questions or feedback?</h2>
        <p className="mt-2 text-ink-muted">We read every message and use it to prioritize what we build next.</p>
        <Button className="mt-6" asChild>
          <Link to="/contact">Contact us</Link>
        </Button>
      </div>
    </div>
  )
}
