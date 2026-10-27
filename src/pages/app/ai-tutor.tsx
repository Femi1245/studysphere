import { Bot, Plus, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/auth-context'
import { trySupabase } from '@/lib/supabase/client'
import type { AiConversation, AiMessage } from '@/types/database'

export function AiTutorPage() {
  const { user, profile } = useAuth()
  const supabase = trySupabase()
  const [conversations, setConversations] = useState<AiConversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)

  const loadConversations = useCallback(async () => {
    if (!supabase || !user) return
    const { data } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    setConversations((data as AiConversation[]) ?? [])
    setLoading(false)
  }, [supabase, user])

  const loadMessages = useCallback(
    async (conversationId: string) => {
      if (!supabase) return
      const { data } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at')
      setMessages((data as AiMessage[]) ?? [])
    },
    [supabase],
  )

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (activeId) void loadMessages(activeId)
  }, [activeId, loadMessages])

  const newConversation = async () => {
    if (!supabase || !user) return
    const { data } = await supabase
      .from('ai_conversations')
      .insert({ user_id: user.id, title: 'New chat' })
      .select('*')
      .single()
    if (data) {
      setConversations((c) => [data as AiConversation, ...c])
      setActiveId(data.id)
      setMessages([])
    }
  }

  const send = async () => {
    if (!supabase || !user || !input.trim() || sending) return
    setSending(true)
    setError(null)
    setSetupRequired(false)

    let convId = activeId
    if (!convId) {
      const { data } = await supabase
        .from('ai_conversations')
        .insert({ user_id: user.id, title: input.trim().slice(0, 40) })
        .select('id')
        .single()
      convId = data?.id ?? null
      setActiveId(convId)
    }
    if (!convId) {
      setSending(false)
      return
    }

    const userContent = input.trim()
    setInput('')
    await supabase.from('ai_messages').insert({
      conversation_id: convId,
      user_id: user.id,
      role: 'user',
      content: userContent,
    })
    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        conversation_id: convId!,
        user_id: user.id,
        role: 'user',
        content: userContent,
        created_at: new Date().toISOString(),
      },
    ])

    const { data: fnData, error: fnError } = await supabase.functions.invoke('ai-tutor', {
      body: {
        message: userContent,
        conversation_id: convId,
        education_level: profile?.education_level ?? null,
      },
    })

    if (fnError) {
      const status = (fnError as { status?: number }).status
      const ctx = fnData as { configured?: boolean; error?: string } | null
      if (status === 503 || ctx?.configured === false) {
        setSetupRequired(true)
        setError('AI Tutor is not configured on the server. Deploy the ai-tutor edge function and API keys.')
      } else {
        setError(fnError.message)
      }
      setSending(false)
      return
    }

    const reply =
      typeof fnData === 'object' && fnData && 'reply' in fnData
        ? String((fnData as { reply: string }).reply)
        : typeof fnData === 'string'
          ? fnData
          : 'No response'

    await supabase.from('ai_messages').insert({
      conversation_id: convId,
      user_id: user.id,
      role: 'assistant',
      content: reply,
    })
    await loadMessages(convId)
    await loadConversations()
    setSending(false)
  }

  if (!supabase) return <SupabaseSetupBanner />
  if (loading) return <Skeleton className="h-96 rounded-2xl" />

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 space-y-2 lg:w-56">
        <Button className="w-full" size="sm" onClick={() => void newConversation()}>
          <Plus className="h-4 w-4" />
          New chat
        </Button>
        <div className="max-h-48 overflow-y-auto lg:max-h-none">
          {conversations.length === 0 ? (
            <p className="text-xs text-ink-muted">No conversations yet</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`mb-1 w-full rounded-lg px-2 py-2 text-left text-sm ${
                  activeId === c.id ? 'bg-primary-100 dark:bg-primary-900/40' : 'hover:bg-primary-50'
                }`}
                onClick={() => setActiveId(c.id)}
              >
                {c.title}
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-surface-elevated">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="Ask your AI tutor"
              description="Responses are AI-generated and not guaranteed to be accurate. Verify important facts with your materials."
            />
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                  m.role === 'user'
                    ? 'ml-auto bg-primary-600 text-white'
                    : 'bg-primary-50 dark:bg-primary-900/30'
                }`}
              >
                {m.content}
              </div>
            ))
          )}
          {sending ? (
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <Spinner className="h-4 w-4" />
              Thinking…
            </div>
          ) : null}
        </div>

        {setupRequired ? (
          <Card className="m-4 rounded-xl border-accent-200 bg-accent-50 dark:bg-accent-900/20">
            <CardContent className="py-3 text-sm">
              AI Tutor setup required. Configure the Supabase edge function — responses are not simulated.
            </CardContent>
          </Card>
        ) : null}

        {error && !setupRequired ? (
          <div className="mx-4 mb-2 flex items-center justify-between rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            <span>{error}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => void send()}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : null}

        <p className="px-4 text-xs text-ink-muted">
          AI-generated content may be incorrect. Not a substitute for professional instruction.
        </p>

        <form
          className="flex gap-2 border-t border-border p-4"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a study question…"
            disabled={sending}
          />
          <Button type="submit" disabled={sending || !input.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  )
}
