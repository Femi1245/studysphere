# Deployment

## Web (recommended: Vercel)

1. Push this repository to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Framework preset: Vite.
4. Build command: `npm run build`
5. Output directory: `dist`
6. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Deploy.

### SPA routing

Ensure all routes rewrite to `index.html`. A `vercel.json` is included for this.

### Netlify alternative

- Build: `npm run build`
- Publish: `dist`
- Redirects: `/* /index.html 200`

## Supabase backend

1. Apply migrations from `supabase/migrations/`.
   - In particular, apply `20261112170000_campus_housing.sql` to enable housing discovery, inspection requests, provider submissions, and admin review.
2. Deploy functions:
   ```bash
   supabase functions deploy ai-tutor
   supabase functions deploy extract-document
   ```
3. Set Edge Function secrets (`OPENAI_API_KEY`, etc.).
4. In Auth → URL configuration, add your production origin and redirect URLs (`/reset-password`).

## PWA

Production builds register a service worker via `vite-plugin-pwa`. The public site and signed-in app show an **Install app** button. On supported Android/desktop browsers it opens the native install prompt; on iPhone/iPad it explains how to use Safari's **Share → Add to Home Screen** flow.

Deploy over HTTPS for installation. The installed PWA opens in a standalone app window and caches the application shell. An internet connection is still required for sign-in, Supabase data, and AI features. This does not publish an APK or an App Store / Play Store listing; use the Capacitor steps in [NATIVE.md](./NATIVE.md) for native packages.

## Post-deploy smoke test

1. Open the site homepage.
2. Sign up with a new email.
3. Complete onboarding.
4. Create a subject, note, task, quiz, and flashcard deck.
5. Run a focus timer session.
6. Open Progress and confirm charts reflect stored data.
7. Open AI Tutor — expect setup message unless OpenAI is configured.
