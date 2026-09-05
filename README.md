# Ember — AI Incident Response Engineer

Ember is a first-pass investigation workspace for on-call engineers. It aggregates incidents, drafts evidence-backed root-cause hypotheses, and **never executes a production change without a human approval**.

The public demo runs on an in-memory store so you can explore the product without Firebase or Postgres. Attach a database and LLM key when you want persistence and live model output.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and choose **Enter demo workspace**.

Optional environment variables (see `.env.example`):

- `DATABASE_URL` — PostgreSQL (otherwise Ember uses the demo memory store)
- `GEMINI_API_KEY` — live investigation/summaries (otherwise Ember uses a cited fallback)
- `PAGERDUTY_*`, `SLACK_WEBHOOK_URL`, `JIRA_*`, `GITHUB_*` — integrations

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Express + Vite in one process |
| `npm run build` | Production frontend |
| `npm start` | Serve the built app |
| `npm run lint` | Typecheck |

## Deploy

Configured for Vercel. The Express app is the serverless entry (`api/index.ts`) and serves both `/api` and the SPA.
