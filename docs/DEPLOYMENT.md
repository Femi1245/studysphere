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
2. Deploy functions:
   ```bash
   supabase functions deploy ai-tutor
   supabase functions deploy extract-document
   ```
3. Set Edge Function secrets (`OPENAI_API_KEY`, etc.).
4. In Auth → URL configuration, add your production origin and redirect URLs (`/reset-password`).

## PWA

Production builds register a service worker via `vite-plugin-pwa`. Users can install StudySphere from supported browsers (Chrome/Edge/Safari) after HTTPS deployment.

## Post-deploy smoke test

1. Open the site homepage.
2. Sign up with a new email.
3. Complete onboarding.
4. Create a subject, note, task, quiz, and flashcard deck.
5. Run a focus timer session.
6. Open Progress and confirm charts reflect stored data.
7. Open AI Tutor — expect setup message unless OpenAI is configured.
