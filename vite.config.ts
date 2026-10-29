import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { generateQuizQuestionsCore } from './api/lib/generate-quiz-core.ts'
import { buildFallbackQuizQuestions } from './api/lib/parse-quiz-questions.ts'
import { createUserClient, runGradeQuiz } from './api/lib/run-grade-quiz.ts'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

const SYSTEM = `You are StudySphere's educational AI tutor. Help students understand concepts, adapt to their education level, do not invent document content, and note that answers are AI-generated and may be wrong.`

function aiTutorDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'ai-tutor-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/ai-tutor', (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
          res.end()
          return
        }
        if (req.method !== 'POST') {
          next()
          return
        }

        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          void (async () => {
            try {
              const apiKey = env.GROQ_API_KEY || env.OPENAI_API_KEY
              if (!apiKey) {
                res.statusCode = 503
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    configured: false,
                    error:
                      'AI not configured. Add GROQ_API_KEY to .env.local (free at console.groq.com).',
                  }),
                )
                return
              }

              const auth = req.headers.authorization
              if (!auth?.startsWith('Bearer ')) {
                res.statusCode = 401
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Sign in required' }))
                return
              }

              const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
                message?: string
                education_level?: string | null
                history?: Array<{ role: string; content: string }>
              }

              if (!body.message?.trim()) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'message is required' }))
                return
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

              const useGroq = Boolean(env.GROQ_API_KEY)
              const endpoint = useGroq
                ? 'https://api.groq.com/openai/v1/chat/completions'
                : 'https://api.openai.com/v1/chat/completions'
              const model =
                env.GROQ_MODEL ||
                env.OPENAI_MODEL ||
                (useGroq ? 'openai/gpt-oss-20b' : 'gpt-4o-mini')

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
                res.statusCode = 502
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    error: 'AI provider error',
                    detail: errText.slice(0, 200),
                  }),
                )
                return
              }

              const completion = (await aiRes.json()) as {
                choices?: Array<{ message?: { content?: string } }>
              }
              const reply =
                completion.choices?.[0]?.message?.content?.trim() ||
                'I could not generate a response. Please try again.'

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  configured: true,
                  reply,
                  provider: useGroq ? 'groq' : 'openai',
                }),
              )
            } catch (e) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  error: e instanceof Error ? e.message : 'AI request failed',
                }),
              )
            }
          })()
        })
      })

      server.middlewares.use('/api/generate-quiz', (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
          res.end()
          return
        }
        if (req.method !== 'POST') {
          next()
          return
        }
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          void (async () => {
            const respond = (status: number, payload: unknown) => {
              res.statusCode = status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(payload))
            }
            let count = 10
            let course = 'General studies'
            let difficulty = 'medium'
            try {
              const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
                count?: number
                course?: string
                difficulty?: string
              }
              count = Math.min(Math.max(Number(body.count) || 0, 1), 40)
              course = String(body.course || 'General studies').slice(0, 200)
              difficulty = body.difficulty || 'medium'

              if (!req.headers.authorization?.startsWith('Bearer ')) {
                respond(401, { error: 'Sign in required' })
                return
              }

              const apiKey = env.GROQ_API_KEY
              if (!apiKey) {
                respond(200, {
                  questions: buildFallbackQuizQuestions(course, count, difficulty),
                  ai_generated: false,
                  fallback: true,
                  warning:
                    'GROQ_API_KEY missing in .env.local — using practice fallback questions',
                })
                return
              }

              const result = await generateQuizQuestionsCore({
                apiKey,
                model: env.GROQ_MODEL || 'llama-3.1-8b-instant',
                count,
                course,
                difficulty,
              })
              respond(200, result)
            } catch (e) {
              // Never block exam start — always return usable questions
              respond(200, {
                questions: buildFallbackQuizQuestions(course, count, difficulty),
                ai_generated: false,
                fallback: true,
                warning: e instanceof Error ? e.message : 'Generate failed',
              })
            }
          })()
        })
      })

      server.middlewares.use('/api/grade-quiz', (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
          res.end()
          return
        }
        if (req.method !== 'POST') {
          next()
          return
        }
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          void (async () => {
            try {
              const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
              const anon = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY
              if (!url || !anon) {
                res.statusCode = 503
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Supabase not configured on server' }))
                return
              }
              const auth = req.headers.authorization
              if (!auth?.startsWith('Bearer ')) {
                res.statusCode = 401
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Sign in required' }))
                return
              }
              const supabase = createUserClient(url, anon, auth)
              const {
                data: { user },
                error: userErr,
              } = await supabase.auth.getUser()
              if (userErr || !user) {
                res.statusCode = 401
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Unauthorized' }))
                return
              }
              const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
                quiz_id?: string
                answers?: Array<{ question_id: string; answer: string }>
                abandoned?: boolean
                started_at?: string
              }
              const result = await runGradeQuiz(supabase, user.id, body)
              res.statusCode = result.status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(result.json))
            } catch (e) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  error: e instanceof Error ? e.message : 'Grading failed',
                }),
              )
            }
          })()
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '')
  return {
    plugins: [
      react(),
      tailwindcss(),
      aiTutorDevPlugin(env),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/*.png'],
        manifest: {
          name: 'StudySphere',
          short_name: 'StudySphere',
          description: 'Study smarter. Learn better. Achieve more.',
          theme_color: '#1e3a5f',
          background_color: '#f8fafc',
          display: 'standalone',
          start_url: '/app',
          icons: [
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2}'],
          navigateFallback: '/index.html',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, './src'),
      },
    },
  }
})
