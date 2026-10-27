# StudySphere

Student learning platform — organize studies, take notes, practice quizzes, review flashcards, focus with a study timer, track progress, and get help from an AI tutor.

**Stack:** React · TypeScript · Tailwind CSS · Supabase · Vite PWA

## Quick start

```bash
npm install
cp .env.example .env
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

Apply the SQL migration in `supabase/migrations/` to your Supabase project before using auth and data features.

## Documentation

- [Environment variables](docs/ENVIRONMENT.md)
- [Free AI with Groq](docs/AI_GROQ.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Native apps (Capacitor)](docs/NATIVE.md)
- [Testing checklist](docs/TESTING.md)
- [Features & limitations](docs/LIMITATIONS.md)

## Branding

Edit `src/config/brand.ts` and CSS tokens in `src/index.css` to rename or retheme the product.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
