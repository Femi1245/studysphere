# StudySphere V2 — Learning engine & examination centre

## 1. Features completed

### Personalized learning engine
- Multi-attempt topic performance aggregation (`topic_performance`)
- Weak-topic detection only after enough incorrect answers **and** distinct attempts (defaults: 2 / 2)
- Recommendations for revision, practice quizzes, related notes, and improvement signals
- Personalized revision tasks on the planner (`study_tasks` with `is_revision`)
- Dismissible recommendations with stored **why** explanations and evidence JSON
- Learning page at `/app/learning`; dashboard shows reason text + link to insights
- Refresh after server-graded quiz submit

### Advanced examination centre
- Central page at `/app/exams` with course, bank, topic, difficulty, mode, count, pass mark, timer
- Random selection with in-attempt dedupe and preference for unused bank questions on retries
- Practice vs locked assessment modes; assessment leave/abandon = fail
- Server-side grading via `POST /api/grade-quiz` (scores never trusted from the client)
- Persistent attempts, answer review with explanations, revision deep-links
- Attempt history on the examination centre page

## 2. Database changes

Migration: `supabase/migrations/20260328100000_v2_learning_exam.sql`

- `quiz_questions`: `topic_label`, `bank_question_id`, `source_fingerprint`
- `student_recommendations`: `kind`, `topic_key`, `evidence_json`, `updated_at`
- New `topic_performance` (RLS own-row)
- New `quiz_question_usage` (RLS own-row)
- Platform settings: `learning_min_incorrect`, `learning_min_attempts`

**Apply this migration in the Supabase SQL editor (or CLI) before using the new columns/tables.**

## 3. Integrations requiring credentials

| Credential | Used for |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Client + grade-quiz auth |
| `GROQ_API_KEY` (optional) | Fill remaining exam questions when banks are short |
| `GROQ_MODEL` (optional) | Defaults to `openai/gpt-oss-20b` |

No new paid services required for grading or recommendations.

## 4. Tests performed and results

| Check | Result |
|---|---|
| `npm run build` (tsc + vite) | Passed (exit 0) |
| Routes `/app/exams`, `/app/learning` registered | Wired in `App.tsx` + nav |
| Grade API shared core used by Vercel handler + Vite middleware | `api/lib/run-grade-quiz.ts` |
| Take flow posts answers to `/api/grade-quiz` | `take.tsx` |

Manual runtime checks (after migration): start practice exam → submit → confirm attempt row + review; refresh Learning → dismiss a recommendation.

## 5. Remaining limitations (groups 1–2)

- Groups 3–8 (documents OCR, revision scheduler SR, full reports, admin imports, offline sync hardening) not started yet
- Note matching for weak topics is simple `ilike` title/content search
- Double-submit protection is client-side (`finishedRef`); no server idempotency key yet
- `quiz_question_usage` insert ignores null `bank_question_id` FK failures silently if migration not applied
- AI-filled questions are labeled via explanations / `is_ai_generated` on bank seed path; generated exam fillers should be treated as practice aids
