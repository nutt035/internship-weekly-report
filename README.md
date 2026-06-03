# Internship Weekly Report

A Next.js 14 (App Router) + Tailwind CSS app for filing internship weekly reports —
dynamic daily tasks, image evidence uploads, and an on-screen supervisor signature.

## Stack
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- `react-signature-canvas` (digital signature)
- `@supabase/supabase-js` (image + signature storage — backend route)

## Setup on a new device

1. **Install dependencies** (Node 18.18+ required; built on Node 22):
   ```bash
   npm install
   ```

2. **Environment variables** — copy the template and fill in real values:
   ```bash
   cp .env.local.example .env.local
   ```
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)

   > The frontend form works WITHOUT these — it only `console.log`s on submit.
   > Supabase is only needed once the API route is wired up.

3. **Supabase (only for the backend route)**: create a **public** storage bucket
   named `report-images`.

4. **Run the dev server**:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 (redirects to `/weekly-report`).

## Scripts
| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint |

## Structure
```
app/
  layout.tsx                  Root layout + globals
  page.tsx                    Redirects "/" -> "/weekly-report"
  globals.css                 Tailwind directives
  weekly-report/page.tsx      The form (client component)
  api/weekly-report/route.ts  POST endpoint (FormData -> Supabase)
```

## Notes
- The form (`/weekly-report`) is fully standalone and does NOT call the API yet;
  submitting logs a structured JSON payload to the browser console.
- The API route (`app/api/weekly-report/route.ts`) has a clearly marked
  `// TODO` placeholder for Google Drive / Google Docs generation.
