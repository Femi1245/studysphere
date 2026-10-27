# Free AI with Groq

StudySphere’s AI Tutor uses **Groq** by default (OpenAI-compatible, generous free tier).

## Setup (local)

1. Create a free key: https://console.groq.com/keys  
2. Put it in `.env.local` (no `VITE_` prefix):

```env
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-20b
```

Other free chat models on Groq right now include `openai/gpt-oss-120b` and `qwen/qwen3.8-27b`.

3. Restart `npm run dev`.  
4. Open **AI Tutor** in the app and ask a question.

The Vite dev server exposes `POST /api/ai-tutor` and keeps the key on the server.

## Setup (Vercel production)

Add the same `GROQ_API_KEY` (and optional `GROQ_MODEL`) in the Vercel project **Environment Variables**, then redeploy. The serverless function lives at `api/ai-tutor.ts`.

## Optional: Supabase Edge Function

You can also set `GROQ_API_KEY` as a Supabase Edge Function secret and deploy `supabase/functions/ai-tutor`. The app prefers `/api/ai-tutor` first.

## Dashboard sections

Dashboard cards (tasks, streak, notes, quizzes, charts) do **not** need Groq. They fill automatically when you:

| Section | How to populate |
|---------|-----------------|
| Today’s tasks / exams | Study Planner → create tasks |
| Subjects | My Subjects → add subjects |
| Study streak / chart | Focus Timer → complete sessions |
| Notes | Notes → create notes |
| Quizzes | Quizzes → create & take quizzes |
| Flashcards due | Flashcards → create decks & review |

AI is only required for the **AI Tutor** page (and AI-generated flashcards/questions when you use those actions).
