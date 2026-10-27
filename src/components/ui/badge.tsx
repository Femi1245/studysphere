import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-100',
        accent: 'bg-accent-100 text-accent-700 dark:bg-accent-900/50 dark:text-accent-300',
        success: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
        warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
        danger: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
        outline: 'border border-border text-ink-muted',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
