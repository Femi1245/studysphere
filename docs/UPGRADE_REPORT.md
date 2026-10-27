# StudySphere major upgrade report

## Inspection summary (before upgrade)

| Area | Status |
|------|--------|
| Auth, profiles, personal subjects/notes/quizzes/timer/AI | Implemented |
| Personal quiz create/take/grade | Implemented |
| Dashboard / progress from personal data | Implemented |
| Institutions, programmes, course catalogue | Missing → **added** |
| Learning materials CMS + reader | Missing → **added** |
| Question banks + configurable quizzes | Missing → **added** |
| Activity event stream | Missing → **added** |
| Recommendations + pass/fail analytics | Partial → **extended** |

## What was implemented

### Stage 1 — Academic profile & course selection
- Multi-step onboarding: country, education level, institution, programme/class/session/semester, multi-course enrolment, preferences
- Academic profile editor (`/app/academic-profile`)
- Catalogue request flow for missing schools/courses
- Nigeria-first seed data (secondary JSS/SS subjects, sample universities/polytechnic/COE)

### Stage 2–3 — Course library & reader
- Course library browse/enrol (`/app/courses`)
- Course detail with materials, bookmarks, empty-state requests
- Material reader with search, annotations, reading progress, AI summary (Groq), topic completion logging

### Stage 4–5 — Question banks & grading
- Practice quiz builder from banks (`/app/quizzes/practice`): difficulty, count, timed, pass mark, practice/assessment
- Pass/fail on results; attempts stored permanently (existing `quiz_attempts`)
- Personal quizzes retained

### Stage 6–7 — Activity, performance, recommendations
- Central `logActivity` → `activity_events`
- Activity timeline page (`/app/activity`)
- Progress/dashboard quiz aggregates + dismissible recommendations
- Admin: Support | Materials | Catalogue requests

## Database added/modified

**Migrations**
- `supabase/migrations/20260327120000_academic_upgrade.sql`
- `supabase/migrations/20260327121000_nigeria_seed.sql`

**New tables:** countries, institutions, education_levels, class_levels, departments, programmes, academic_sessions, catalogue_courses, student_academic_profiles, student_course_enrolments, catalogue_requests, learning_materials, material_bookmarks, material_annotations, reading_progress, question_banks, bank_questions, activity_events, student_recommendations, platform_settings

**Altered:** profiles (+country_id, academic_profile_complete), quizzes (+bank/config fields), learning_resources (+material_id)

**RLS:** authenticated read of published catalogue; owner CRUD on private student data; admin CMS via `is_admin()`

## External integrations

| Integration | Status |
|-------------|--------|
| Supabase Auth/DB/Storage | Configured (local `.env.local`) |
| Groq AI (`GROQ_API_KEY`) | Local via `/api/ai-tutor`; set same on Vercel for production |
| External curriculum APIs | Not configured — content-provider layer uses DB + admin uploads only |

## Required manual step (critical)

Apply both new SQL migrations in the Supabase SQL Editor (in order), or run `supabase db push` if the CLI is linked:

1. `20260327120000_academic_upgrade.sql`
2. `20260327121000_nigeria_seed.sql`

Without this, onboarding/courses will error because tables do not exist yet.

## Testing status

| Test | Status |
|------|--------|
| A Onboarding (UI) | Implemented — needs migration applied |
| B Course library | Implemented — needs seed |
| C–D Quiz customize/grade | Implemented |
| E–G Activity / analytics / retakes | Implemented |
| H Missing content messages | Implemented |
| I RLS owner isolation | Policies in migration — verify after apply |
| J Persistence | Uses Supabase — verify after apply |

## Still needs content / config

- Richer institution-specific curricula (seed is a starter set, not every Nigerian school)
- Admin role: set `profiles.role = 'admin'` for your user in SQL to use Materials CMS
- More verified question banks and published notes (add via Admin → Materials)
- Optional licensed content APIs when credentials exist
- Production: set `GROQ_API_KEY` on Vercel and re-run migrations on the linked Supabase project
