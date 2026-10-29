import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type TypeaheadOption = {
  value: string
  label: string
  description?: string
}

type TypeaheadProps = {
  label?: string
  placeholder?: string
  options: TypeaheadOption[]
  value: string
  onChange: (value: string) => void
  /** Called whenever the query text changes (for server-side filtering). */
  onQueryChange?: (query: string) => void
  emptyText?: string
  disabled?: boolean
  className?: string
  selectedLabel?: string
  allowFreeText?: boolean
  /**
   * When true, options are already filtered by the server — show them as-is while open.
   * Still applies a light local filter if the user typed something.
   */
  remote?: boolean
}

/**
 * Search-as-you-type dropdown with live suggestion list.
 */
export function Typeahead({
  label,
  placeholder = 'Type to search…',
  options,
  value,
  onChange,
  onQueryChange,
  emptyText = 'No matches',
  disabled,
  className,
  selectedLabel,
  allowFreeText = false,
  remote = false,
}: TypeaheadProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  )

  const displayClosed = selectedLabel || selected?.label || (allowFreeText ? value : '') || ''

  useEffect(() => {
    if (!open) setQuery(displayClosed)
  }, [displayClosed, open])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        if (allowFreeText && open && query.trim() && !value) {
          onChange(query.trim())
        }
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [allowFreeText, open, query, onChange, value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    // Remote mode: trust parent list; still soft-filter if helpful
    if (remote) {
      if (!q || q === displayClosed.toLowerCase()) return options.slice(0, 100)
      const soft = options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.description?.toLowerCase().includes(q) ?? false),
      )
      return (soft.length ? soft : options).slice(0, 100)
    }
    if (!q) return options.slice(0, 80)
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.description?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 80)
  }, [options, query, remote, displayClosed])

  return (
    <div ref={rootRef} className={cn('relative space-y-2', className)}>
      {label ? <p className="text-sm font-medium leading-none">{label}</p> : null}
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        placeholder={placeholder}
        value={open ? query : displayClosed}
        onFocus={() => {
          setOpen(true)
          setQuery(displayClosed)
          // Kick remote search with current text so suggestions load immediately
          onQueryChange?.(displayClosed)
        }}
        onChange={(e) => {
          const next = e.target.value
          setQuery(next)
          setOpen(true)
          onQueryChange?.(next)
          if (allowFreeText) {
            onChange(next)
          } else if (value && next !== displayClosed) {
            onChange('')
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false)
            return
          }
          if (e.key === 'ArrowDown') {
            setOpen(true)
            return
          }
          if (e.key === 'Enter' && allowFreeText && query.trim()) {
            e.preventDefault()
            onChange(query.trim())
            setOpen(false)
          }
        }}
        autoComplete="off"
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-surface-elevated py-1 shadow-lg"
        >
          <li className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-ink-muted">
            Suggestions · {filtered.length}
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-muted">{emptyText}</li>
          ) : (
            filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={cn(
                    'flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-primary-50 dark:hover:bg-primary-900/30',
                    o.value === value && 'bg-primary-50 dark:bg-primary-900/20',
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(o.value)
                    setQuery(o.label)
                    setOpen(false)
                  }}
                >
                  <span className="font-medium">{o.label}</span>
                  {o.description ? (
                    <span className="text-xs text-ink-muted">{o.description}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
