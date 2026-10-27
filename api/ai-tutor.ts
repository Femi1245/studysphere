import type { VercelRequest, VercelResponse } from '@vercel/node'

const SYSTEM = `You are StudySphere's educational AI tutor. Help students understand concepts, adapt to their education level, do not invent document content, and note that answers are AI-generated and may be wrong.`

/**
 * Vercel serverless AI tutor using Groq (free tier).
 * Set GROQ_API_KEY in Vercel project env (never expose in VITE_* vars).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(503).json({
      configured: false,
      error: 'AI not configured. Set GROQ_API_KEY in server environment.',
    })
  }

  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sign in required' })
  }

  const body = req.body as {
    message?: string
    education_level?: string | null
    history?: Array<{ role: string; content: string }>
  }

  if (!body?.message?.trim()) {
    return res.status(400).json({ error: 'message is required' })
  }

  let system = SYSTEM
  if (body.education_level) {
    system += `\n\nStudent education level: ${body.education_level}`
  }

  const messages = [
    { role: 'system', content: system },
    ...(body.history ?? [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: body.message.trim() },
  ]

  const useGroq = Boolean(process.env.GROQ_API_KEY)
  const endpoint = useGroq
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions'
  const model =
    process.env.GROQ_MODEL ||
    process.env.OPENAI_MODEL ||
    (useGroq ? 'openai/gpt-oss-20b' : 'gpt-4o-mini')

  try {
    const aiRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature: 0.7 }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error('AI provider error', aiRes.status, errText)
      return res.status(502).json({ error: 'AI provider error', detail: errText.slice(0, 200) })
    }

    const completion = (await aiRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      'I could not generate a response. Please try again.'

    return res.status(200).json({ configured: true, reply, provider: useGroq ? 'groq' : 'openai' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'AI request failed' })
  }
}
