# Testing checklist

Use a dedicated development Supabase project. Do not use real student data.

## Auth

- [ ] Register with email/password
- [ ] Receive / complete email verification (if enabled)
- [ ] Log in and persist session across refresh
- [ ] Log out
- [ ] Password recovery email + reset password page
- [ ] Unauthenticated users redirected from `/app` to `/login`
- [ ] New users redirected to `/app/onboarding`

## Core study loop

- [ ] Create, edit, delete a subject (color/icon)
- [ ] Add topics; toggle complete; mark needs revision
- [ ] Create study tasks; reschedule; mark complete; see overdue
- [ ] Create and edit a note with rich text; pin/favorite; search
- [ ] Upload an allowed file; reject oversized/invalid types
- [ ] Attach note to a subject/topic

## Practice & focus

- [ ] Create quiz with MCQ, true/false, short answer
- [ ] Take quiz without seeing answers before submit
- [ ] Auto-grading for objective questions; review incorrect
- [ ] Retake quiz; attempts stored
- [ ] Create flashcard deck; study with shuffle; SM-2 next review updates
- [ ] Focus timer start/pause/resume/stop; session survives reload while running; completed session appears in history

## Progress & AI

- [ ] Progress charts use real DB data; empty states when none
- [ ] AI Tutor shows setup message if OpenAI secret missing
- [ ] With OpenAI configured: ask a question, follow-up, error/retry UI
- [ ] Notifications list and mark as read
- [ ] Settings update profile, theme, notification prefs

## Security

- [ ] User A cannot read User B subjects/notes (RLS)
- [ ] Admin route blocked for students
- [ ] No API keys in browser network payloads beyond anon key

## Responsive / PWA

- [ ] Desktop sidebar and mobile bottom nav work
- [ ] Touch targets usable on phone width
- [ ] Install prompt / Add to Home Screen on supported browsers (HTTPS)
