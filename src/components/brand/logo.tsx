import { Link } from 'react-router-dom'
import { brand } from '@/config/brand'
import { cn } from '@/lib/utils'

export function Logo({
  className,
  to = '/',
  markOnly = false,
}: {
  className?: string
  to?: string
  markOnly?: boolean
}) {
  return (
    <Link
      to={to}
      className={cn('inline-flex items-center gap-2.5 font-semibold text-ink', className)}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-sm font-bold text-white shadow-sm">
        S
      </span>
      {!markOnly ? (
        <span className="font-display text-xl tracking-tight">{brand.name}</span>
      ) : null}
    </Link>
  )
}
