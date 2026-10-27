# Completed features & limitations (v1)

## Completed

- Public marketing site (Home, About, Features, Pricing, Contact, Privacy, Terms)
- Auth: signup, login, logout, password reset, session persistence, protected routes
- Onboarding and account settings
- Student dashboard with live empty states and real aggregates
- Subjects, topics, planner (list/day/week/calendar), notes (TipTap), file uploads
- Quizzes (MCQ / T/F / short answer), attempts, grading, review
- Flashcards with SM-2 spaced repetition
- Study timer with persisted active session
- Progress analytics from database records
- AI Tutor via Edge Function (when configured)
- Document text extraction for plain text / Markdown only
- In-app notification center + preference toggles
- Admin area for support requests (role-gated)
- PWA install support
- Light / dark theme

## Limitations (intentional)

- No Stripe / paid plans (Pricing page documents free access)
- No study groups, collaborative notes, or peer messaging
- No background / push notifications — in-app only
- PDF OCR / full document AI reading is not implemented; unsupported types explain the limitation
- Short-answer grading is automated exact/normalized match, not semantic AI grading
- Native App Store / Play Store builds require Capacitor steps in `docs/NATIVE.md`
- Admin does not access private notes or AI transcripts
- Aggregate platform analytics for admin are limited by RLS; support inbox is primary admin tool

## Honesty constraints

- No fabricated testimonials or student counts on marketing pages
- No mock AI responses
- No hardcoded dashboard statistics
