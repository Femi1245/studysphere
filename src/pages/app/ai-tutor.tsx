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
  const { user, profile, session } = useAuth()
  const supabase = trySupabase()
  const [conversations, setConversations] = useState<AiConversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)

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

  const askTutor = async (userContent: string, convId: string, history: AiMessage[]) => {
    const token = session?.access_token
    if (!token) throw new Error('Not signed in')

    const payload = {
      message: userContent,
      conversation_id: convId,
      education_level: profile?.education_level ?? null,
      history: history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content })),
    }

    // Prefer local/Vercel /api/ai-tutor (Groq). Fall back to Supabase Edge Function.
    const res = await fetch('/api/ai-tutor', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (res.status !== 404) {
      const data = (await res.json()) as {
        reply?: string
        configured?: boolean
        error?: string
        detail?: string
      }
      if (res.status === 503 || data.configured === false) {
        setSetupRequired(true)
        throw new Error(
          data.error ||
            'Add GROQ_API_KEY to .env.local (free key at console.groq.com), then restart npm run dev.',
        )
      }
      if (!res.ok) {
        throw new Error(
          [data.error, data.detail].filter(Boolean).join(': ') ||
            `AI request failed (${res.status})`,
        )
      }
      return data.reply || 'No response'
    }

    if (!supabase) throw new Error('Supabase not configured')
    const { data: fnData, error: fnError } = await supabase.functions.invoke('ai-tutor', {
      body: payload,
    })
    if (fnError) {
      const ctx = fnData as { configured?: boolean; error?: string } | null
      if (ctx?.configured === false) {
        setSetupRequired(true)
        throw new Error(ctx.error || 'AI not configured')
      }
      throw new Error(fnError.message)
    }
    const reply =
      typeof fnData === 'object' && fnData && 'reply' in fnData
        ? String((fnData as { reply: string }).reply)
        : null
    if (!reply) throw new Error('No response from AI')
    return reply
  }

  const send = async (overrideMessage?: string) => {
    if (!supabase || !user || sending) return
    const userContent = (overrideMessage ?? input).trim()
    if (!userContent) return

    setSending(true)
    setError(null)
    setSetupRequired(false)
    setLastFailedMessage(null)
    if (!overrideMessage) setInput('')

    let convId = activeId
    if (!convId) {
      const { data } = await supabase
        .from('ai_conversations')
        .insert({ user_id: user.id, title: userContent.slice(0, 40) })
        .select('id')
        .single()
      convId = data?.id ?? null
      setActiveId(convId)
    }
    if (!convId) {
      setSending(false)
      return
    }

    await supabase.from('ai_messages').insert({
      conversation_id: convId,
      user_id: user.id,
      role: 'user',
      content: userContent,
    })

    const optimisticUser: AiMessage = {
      id: crypto.randomUUID(),
      conversation_id: convId,
      user_id: user.id,
      role: 'user',
      content: userContent,
      created_at: new Date().toISOString(),
    }
    const historyForAi = [...messages, optimisticUser]
    setMessages(historyForAi)

    try {
      const reply = await askTutor(userContent, convId, historyForAi)
      await supabase.from('ai_messages').insert({
        conversation_id: convId,
        user_id: user.id,
        role: 'assistant',
        content: reply,
      })
      await supabase
        .from('ai_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', convId)
      await loadMessages(convId)
      await loadConversations()
    } catch (e) {
      setLastFailedMessage(userContent)
      setError(e instanceof Error ? e.message : 'AI request failed')
    } finally {
      setSending(false)
    }
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
              description="Powered by Groq when GROQ_API_KEY is set. Responses are AI-generated and not guaranteed accurate."
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
            <CardContent className="space-y-2 py-3 text-sm">
              <p className="font-medium">Connect free Groq AI</p>
              <ol className="list-decimal space-y-1 pl-4 text-ink-muted">
                <li>
                  Get a key at{' '}
                  <a
                    className="text-accent-600 underline"
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                  >
                    console.groq.com/keys
                  </a>
                </li>
                <li>
                  Add <code className="text-xs">GROQ_API_KEY=gsk_...</code> to{' '}
                  <code className="text-xs">.env.local</code>
                </li>
                <li>Restart the dev server, then try again</li>
              </ol>
            </CardContent>
          </Card>
        ) : null}

        {error && !setupRequired ? (
          <div className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            <span>{error}</span>
            {lastFailedMessage ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void send(lastFailedMessage)}
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            ) : null}
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
