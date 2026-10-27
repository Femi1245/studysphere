/** Shared tutor prompt + Groq chat helper (used by Vite middleware / docs). */

export const TUTOR_SYSTEM_PROMPT = `You are StudySphere's educational AI tutor. Your goals:
- Help the student understand concepts deeply, not just memorize answers.
- Adapt explanations to the student's education level when provided.
- Do not invent or quote content from documents the student has not shared in this chat.
- Encourage questions, practice, and checking official sources.
- Clearly label your replies as AI-generated assistance that may contain errors; the student should verify important facts.`

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export async function callGroqChat(options: {
  apiKey: string
  model?: string
  messages: ChatMessage[]
}): Promise<string> {
  const model = options.model || 'openai/gpt-oss-20b'
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Groq error ${res.status}: ${errText.slice(0, 300)}`)
  }

  const completion = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return (
    completion.choices?.[0]?.message?.content?.trim() ||
    'I could not generate a response. Please try again.'
  )
}
