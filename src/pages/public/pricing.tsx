import { Check } from 'lucide-react'
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

const included = [
  'Unlimited subjects and topics',
  'Study tasks and calendar planning',
  'Notes and organization',
  'Quizzes and flashcards',
  'Progress and session tracking',
  'AI tutoring (fair-use limits may apply)',
] as const

export function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight">Pricing</h1>
        <p className="mt-4 text-lg text-ink-muted">
          Simple pricing for version 1—focus on studying, not subscriptions.
        </p>
      </div>

      <div className="mx-auto mt-14 max-w-lg">
        <Card className="border-primary-200 shadow-md dark:border-primary-800">
          <CardHeader className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-600">Free forever</p>
            <CardTitle className="font-display text-3xl">$0</CardTitle>
            <CardDescription>Full access to core {brand.name} features in v1</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="space-y-3">
              {included.map((item) => (
                <li key={item} className="flex gap-3 text-sm">
                  <Check className="h-5 w-5 shrink-0 text-primary-600" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3 border-t border-border pt-6">
              <Button className="w-full" size="lg" asChild>
                <Link to="/signup">Get started free</Link>
              </Button>
              <p className="text-center text-xs text-ink-muted">
                No Stripe checkout in v1. Paid tiers may be introduced later with clear notice.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-ink-muted">
        Need help choosing or have billing questions for the future?{' '}
        <Link to="/contact" className="font-medium text-accent-600 hover:underline">
          Contact us
        </Link>
        .
      </p>
    </div>
  )
}
