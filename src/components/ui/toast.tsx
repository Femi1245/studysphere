import * as ToastPrimitive from '@radix-ui/react-toast'
import { X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

type ToastKind = 'default' | 'success' | 'error'

interface ToastItem {
  id: string
  title: string
  description?: string
  kind?: ToastKind
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = crypto.randomUUID()
    setItems((prev) => [...prev, { ...item, id }])
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            duration={4000}
            onOpenChange={(open) => {
              if (!open) setItems((prev) => prev.filter((t) => t.id !== item.id))
            }}
            className={cn(
              'pointer-events-auto relative flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-surface-elevated p-4 shadow-lg',
              item.kind === 'success' && 'border-green-200',
              item.kind === 'error' && 'border-rose-200',
            )}
          >
            <div className="flex-1">
              <ToastPrimitive.Title className="text-sm font-semibold">
                {item.title}
              </ToastPrimitive.Title>
              {item.description ? (
                <ToastPrimitive.Description className="mt-1 text-sm text-ink-muted">
                  {item.description}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            <ToastPrimitive.Close className="rounded-lg p-1 text-ink-muted hover:bg-primary-50">
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-20 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 outline-none md:bottom-4" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
