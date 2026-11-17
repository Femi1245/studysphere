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
- Campus housing MVP: listing filters, saved listings, inspection requests, provider submissions, and admin review
- AI Tutor PDF study: client-side text extraction, PDF page previews, summaries, explanations, examples, and practice questions

## Limitations (intentional)

- No Stripe / paid plans (Pricing page documents free access)
- No study groups, collaborative notes, or peer messaging
- No background / push notifications — in-app only
- Scanned/image-only PDF OCR and AI interpretation of embedded image pixels are not implemented. The tutor analyzes selectable PDF text; page previews let students inspect the original pages.
- Housing listings require the `20261112170000_campus_housing.sql` migration and manual admin review. Provider identity documents, automated verification, maps, listing photo uploads, and payment/escrow are not implemented.
- Short-answer grading is automated exact/normalized match, not semantic AI grading
- Native App Store / Play Store builds require Capacitor steps in `docs/NATIVE.md`
- Admin does not access private notes or AI transcripts
- Aggregate platform analytics for admin are limited by RLS; support inbox is primary admin tool

## Honesty constraints

- No fabricated testimonials or student counts on marketing pages
- No mock AI responses
- No hardcoded dashboard statistics
