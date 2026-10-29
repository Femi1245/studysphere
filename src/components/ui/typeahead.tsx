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
  /** Prefer showing selected label in the input when closed. */
  selectedLabel?: string
  /** Allow committing typed text that is not in the options list (e.g. course of study). */
  allowFreeText?: boolean
}

/**
 * Search-as-you-type dropdown. Filters local options; optional onQueryChange for remote search.
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
}: TypeaheadProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  )

  useEffect(() => {
    if (!open) {
      setQuery(selectedLabel || selected?.label || (allowFreeText ? value : '') || '')
    }
  }, [selected, selectedLabel, open, value, allowFreeText])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        if (allowFreeText && open && query.trim()) {
          onChange(query.trim())
        }
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [allowFreeText, open, query, onChange])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options.slice(0, 80)
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.description?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 80)
  }, [options, query])

  return (
    <div ref={rootRef} className={cn('relative space-y-2', className)}>
      {label ? <p className="text-sm font-medium leading-none">{label}</p> : null}
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        placeholder={placeholder}
        value={open ? query : selectedLabel || selected?.label || query}
        onFocus={() => {
          setOpen(true)
          setQuery(selectedLabel || selected?.label || '')
        }}
        onChange={(e) => {
          const next = e.target.value
          setQuery(next)
          setOpen(true)
          onQueryChange?.(next)
          if (allowFreeText) {
            onChange(next)
          } else if (value && next !== (selectedLabel || selected?.label)) {
            // Typing away from selection clears it until a new pick
            onChange('')
          }
        }}
        onKeyDown={(e) => {
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
          className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-surface-elevated py-1 shadow-lg"
        >
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
