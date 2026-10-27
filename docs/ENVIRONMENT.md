# Environment variables

## Frontend (Vite)

Copy `.env.example` to **`.env.local`** (not `.env.example`) and set your real keys:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |

Vite loads `.env.local` automatically. Restart `npm run dev` after changing it.

Never put service-role keys or OpenAI keys in Vite env vars — they are bundled into the client.

### Sign-in works immediately (local)

In the Supabase dashboard go to **Authentication → Providers → Email** and turn **Confirm email** **OFF** while developing. With confirmation ON, new users cannot sign in until they click the email link (and “Invalid login credentials” is shown until then).

Also add `http://localhost:5173` under **Authentication → URL Configuration** (Site URL + Redirect URLs).

## Supabase Edge Function secrets

Set these in the Supabase dashboard (Project Settings → Edge Functions → Secrets) or via CLI:

| Secret | Required for | Description |
|--------|--------------|-------------|
| `OPENAI_API_KEY` | AI Tutor | OpenAI API key |
| `OPENAI_MODEL` | Optional | Defaults to `gpt-4o-mini` |
| `SUPABASE_URL` | Auto | Usually provided by the platform |
| `SUPABASE_ANON_KEY` | Auto | Usually provided by the platform |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge functions | Used server-side only |

Without `OPENAI_API_KEY`, the AI Tutor page shows a setup message. The rest of the app remains functional.

## Local setup checklist

1. Create a Supabase project.
2. Run the migration in `supabase/migrations/20260327000000_init.sql` (SQL editor or `supabase db push`).
3. Deploy edge functions: `supabase functions deploy ai-tutor` and `supabase functions deploy extract-document`.
4. Set `OPENAI_API_KEY` if you want AI features.
5. For local sign-in without email links: disable **Confirm email** (Auth → Providers → Email).
6. Add your site URL to Supabase Auth → URL configuration (`http://localhost:5173` and your production URL).
