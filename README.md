<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=180&section=header&text=Ember&fontSize=52&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=AI%20Incident%20Response%20Engineer&descAlignY=58&descSize=16" width="100%"/>

<h1 align="center">🔥 Ember</h1>
<p align="center"><i>AI Incident Response Engineer</i></p>

<img src="https://img.shields.io/badge/Node.js-18%2B-8B5CF6.svg?style=for-the-badge&logo=node.js&logoColor=white&labelColor=1a1a2e"/>
<img src="https://img.shields.io/badge/TypeScript-5.8-7C3AED.svg?style=for-the-badge&logo=typescript&logoColor=white&labelColor=1a1a2e"/>
<img src="https://img.shields.io/badge/React-19-6D28D9.svg?style=for-the-badge&logo=react&logoColor=white&labelColor=1a1a2e"/>
<img src="https://img.shields.io/badge/Express-4-4C1D95.svg?style=for-the-badge&logo=express&logoColor=white&labelColor=1a1a2e"/>
<img src="https://img.shields.io/badge/PostgreSQL-Drizzle_ORM-A78BFA.svg?style=for-the-badge&logo=postgresql&logoColor=white&labelColor=1a1a2e"/>
<img src="https://img.shields.io/badge/Gemini_2.5_Flash-Google_GenAI-8B5CF6.svg?style=for-the-badge&logo=google&logoColor=white&labelColor=1a1a2e"/>
<img src="https://img.shields.io/badge/Auth-Firebase-7C3AED.svg?style=for-the-badge&logo=firebase&logoColor=white&labelColor=1a1a2e"/>

<br/><br/>

<p align="center">
<b>Ember aggregates incidents, drafts evidence-backed root-cause hypotheses using Gemini, and routes every proposed fix through a human approval gate before anything touches production.</b>
</p>

<p align="center">
Built and hosted via <b>Google AI Studio</b>, backed by Postgres (via Drizzle ORM), authenticated with <b>Firebase Auth</b> (Google Sign-In), and wired to <b>PagerDuty</b>, <b>Slack</b>, <b>Jira</b>, and <b>GitHub</b>.
</p>

</div>

<br/>

---

## <img src="https://img.shields.io/badge/-Overview-8B5CF6?style=flat-square"/>

When production breaks, the slowest part of incident response is usually the first 15–20 minutes: figuring out *what changed*, *what's affected*, and *where to even start looking*. Ember is built to compress that first pass.

It ingests incidents (via webhook or manual creation), triages them against configurable rules, and — on request — runs an AI investigation that produces a **cited root-cause hypothesis** with a **confidence score** and a **proposed remediation action**. Nothing is executed automatically: every remediation action sits in a `proposed` state until a logged-in engineer explicitly **approves** or **rejects** it.

The current build is a functional prototype generated in Google AI Studio: the UI is a full incident-management dashboard styled after Jira/Atlassian, the backend is a real Express + Postgres API, and the AI investigation step calls Gemini directly. Log/trace/deployment evidence fed into the investigation prompt is currently **simulated** (hardcoded sample strings) rather than pulled live from real observability tools — see [Known Limitations](#-known-limitations--roadmap).

<br/>

---

## <img src="https://img.shields.io/badge/-Core%20Principle-8B5CF6?style=flat-square"/>

<div align="center">

> **Ember investigates. Humans decide.**

| Ember does | Ember never does |
|:--|:--|
| Aggregates incidents from webhooks and manual entry | Executes a production change |
| Applies triage rules to auto-set severity/team | Auto-approves its own remediation plan |
| Runs a Gemini-powered root-cause investigation | Applies a remediation action without a human clicking "Approve" |
| Proposes a remediation action with a description and payload | Silently modifies infrastructure, deployments, or services |
| Logs every state change to an audit trail | Deletes or hides audit history |

</div>

Every approval/rejection is written to the `audit_logs` table with the acting user's ID, so there's a permanent record of who signed off on what.

<br/>

---

## <img src="https://img.shields.io/badge/-Feature%20Breakdown-8B5CF6?style=flat-square"/>

<details>
<summary><b>🔐 Authentication & Access</b></summary>
<br/>

- **Google Sign-In via Firebase Auth** on the frontend; the backend verifies the Firebase ID token on every request (`requireAuth` middleware) and syncs the user into the Postgres `users` table on login.
- **GitHub OAuth** (separate, optional) lets a user connect their GitHub account for deploy/PR context — the flow opens a popup, exchanges the OAuth code server-side, and stores the resulting access token on the user's row.

</details>

<details>
<summary><b>📋 Incident Management</b></summary>
<br/>

- **Dashboard** ("Issues" view) listing all incidents with filters for **status**, **severity**, and a free-text **service search**, plus a recent-searches dropdown (persisted to `localStorage`).
- **Manual incident creation** via a modal (title, description, severity).
- **Bulk actions** — select multiple incidents and bulk-**investigate** or bulk-**resolve** them at once; bulk-resolve also resolves the linked PagerDuty incident and posts a Slack notification.
- **Live polling** — the dashboard/app polls `/api/incidents` every 10 seconds; new **Sev1** incidents trigger a browser desktop notification.
- **Assignment** — assign an incident to a specific user from the team; assignment changes are audit-logged.
- **Tagging** — add/remove free-form tags on an incident.
- **Comments** — a threaded comment feed per incident, tied to the commenting user.
- **Presence indicators** — "who's viewing this incident" avatars, computed from a short-lived in-memory (non-persistent) viewer map on the server.

</details>

<details>
<summary><b>🚨 Alert Ingestion & Auto-Triage</b></summary>
<br/>

- **`/api/webhooks/alerts`** — an unauthenticated webhook endpoint for external monitoring tools (e.g. Datadog) to push alerts into Ember.
- **Triage rules engine** — each incoming alert is matched against active rules in the `triage_rules` table (`source`, `title`, or arbitrary `payload.<field>`, with `equals`/`contains` operators). The first matching rule sets the incident's `severity` and `assignedTeam`.
- On ingestion, **Sev1** incidents automatically trigger a **PagerDuty** event, and every new incident posts a **Slack** notification.

</details>

<details>
<summary><b>🤖 AI Investigation (Gemini)</b></summary>
<br/>

- **"Investigate" action** on an incident calls `runInvestigation()`, which prompts **Gemini 2.5 Flash** with the incident context plus (currently simulated) logs, traces, and recent-deployment data, and asks for a structured JSON response:
  - `hypothesis` — the root-cause explanation
  - `evidence` — an array of supporting evidence strings
  - `confidence` — 0–100
  - `remediationDescription`, `actionType`, `actionPayload` — the proposed fix
- The result is stored as a `root_causes` row and a linked `remediation_actions` row (status `proposed`), and the incident status moves to `pending_approval`.
- **"Summarize" action** generates a separate, human-readable **executive summary** (under 150 words) of the incident for stakeholders, using the incident's alerts and audit log as context, and logs the generated summary to the audit trail.

</details>

<details>
<summary><b>✅ Remediation Approval Workflow</b></summary>
<br/>

- Every proposed remediation action must be explicitly **approved** or **rejected** by a signed-in user.
- Approving/rejecting records the acting user, timestamp, and reason in `audit_logs`.
- No code path in Ember executes the `actionPayload` automatically — approval only flips the action's status.

</details>

<details>
<summary><b>📄 Reporting & Export</b></summary>
<br/>

- **RCA Templates** — a reusable root-cause-analysis template (auto-seeded with a "Standard Microservice Outage" template) engineers can reference when writing up an incident.
- **PDF export** — renders the incident detail page to canvas and exports it as a PDF (`Incident_INC-<id>_Report.pdf`) via `html2canvas` + `jsPDF`.
- **Jira ticket creation** — creates a Jira issue directly from an incident (title prefixed `[Ember]`, description includes severity), then notifies Slack with the resulting ticket key.

</details>

<details>
<summary><b>🕓 Activity & History</b></summary>
<br/>

Each incident has three tabs — **Comments**, **History** (timeline), and **Work log** (activity/audit trail) — so the full lifecycle of an incident is reviewable after the fact.

</details>

<br/>

---

## <img src="https://img.shields.io/badge/-System%20Architecture-8B5CF6?style=flat-square"/>

```
                     Incident Signal (webhook, manual entry)
                                    │
                                    ▼
                    ┌────────────────────────────────┐
                    │   Triage Rules Engine             │
                    │  (severity + team auto-assignment)│
                    └────────────────────────────────┘
                                    │
        ┌───────────────┬──────────┼──────────┬───────────────┐
        ▼               ▼                     ▼               ▼
   PagerDuty         Slack                  Jira            GitHub
 (Sev1 trigger/    (notifications)      (ticket creation)  (OAuth, deploy
   resolve)                                                  context)
        │               │                     │               │
        └───────────────┴──────────┬──────────┴───────────────┘
                                    ▼
                    ┌────────────────────────────────┐
                    │   Express API (server.ts)          │
                    │   + Firebase Auth verification      │
                    └────────────────────────────────┘
                                    │
                                    ▼
                    ┌────────────────────────────────┐
                    │  Gemini 2.5 Flash Investigation     │
                    │  (src/agent/investigation.ts)       │
                    │  → hypothesis + evidence + confidence│
                    └────────────────────────────────┘
                                    │
                                    ▼
                    ┌────────────────────────────────┐
                    │   Draft Remediation Action          │
                    │   (status: proposed)                │
                    └────────────────────────────────┘
                                    │
                                    ▼
                       🔒 Human Approval Gate 🔒
                         (Approve / Reject in UI)
                                    │
                                    ▼
                    Action status: approved / rejected
                     (execution is manual — Ember does
                        not apply the change itself)
```

<div align="center">

| Layer | Technology | Notes |
|:--|:--|:--|
| Frontend | React 19 + Vite + Tailwind CSS v4 | Single-page app served by the same Express process |
| Backend / API | Express 4 (TypeScript, via `tsx`) | One process serves both the API and the SPA |
| Auth | Firebase Auth (client) + Firebase Admin (server) | Google Sign-In only in the current UI; ID tokens verified per-request |
| Database | PostgreSQL via Drizzle ORM | Schema in `src/db/schema.ts`; migrations via `drizzle-kit` |
| AI reasoning | `@google/genai` → Gemini 2.5 Flash | Structured JSON output mode |
| Integrations | PagerDuty Events API v2, Slack Incoming Webhooks, Jira REST API v3, GitHub OAuth | All optional — each degrades gracefully (logs a warning) if not configured |

</div>

> **Note:** `@langchain/core` and `@langchain/langgraph` are present in `package.json` but the current investigation logic (`src/agent/investigation.ts`) calls Gemini directly with a single prompt rather than a LangGraph state graph — see [Known Limitations](#-known-limitations--roadmap).

<br/>

---

## <img src="https://img.shields.io/badge/-Data%20Model-8B5CF6?style=flat-square"/>

<details>
<summary><b>View all tables (src/db/schema.ts, Drizzle ORM)</b></summary>
<br/>

| Table | Purpose | Key Columns |
|:--|:--|:--|
| `users` | App users, synced from Firebase on login | `uid` (Firebase UID), `email`, `name`, `role`, `githubToken` |
| `incidents` | Core incident record | `title`, `description`, `status`, `severity`, `affectedServices[]`, `tags[]`, `assignedTeam`, `assigneeId`, `pagerdutyId`, `rootCauseId`, `report` |
| `triage_rules` | Auto-triage conditions for incoming alerts | `conditionField`, `conditionOperator`, `conditionValue`, `actionSeverity`, `actionTeam`, `isActive` |
| `rca_templates` | Reusable RCA write-up templates | `name`, `content` |
| `alerts` | Raw alerts linked to an incident | `incidentId`, `source`, `externalId`, `title`, `payload` |
| `root_causes` | AI-generated root-cause hypotheses | `incidentId`, `hypothesis`, `evidence` (jsonb), `confidence` (0–100) |
| `remediation_actions` | Proposed/approved/rejected fixes | `incidentId`, `description`, `actionType`, `actionPayload`, `status`, `approvedBy`, `approvedAt` |
| `audit_logs` | Full audit trail of system + user actions | `incidentId`, `userId`, `action`, `details` (jsonb) |
| `comments` | Per-incident comment thread | `incidentId`, `userId`, `content` |

**Enums:**
- `incident_status`: `triggered` → `investigating` → `pending_approval` → `resolved` (or `aborted`)
- `incident_severity`: `sev1`, `sev2`, `sev3`

</details>

<br/>

---

## <img src="https://img.shields.io/badge/-API%20Reference-8B5CF6?style=flat-square"/>

<details>
<summary><b>View all routes (prefixed with /api unless marked public)</b></summary>
<br/>

| Method | Route | Purpose |
|:--|:--|:--|
| `GET` | `/api/health` | Health check — **public** |
| `POST` | `/api/auth/sync` | Upsert the authenticated Firebase user into Postgres |
| `GET` | `/api/auth/github/url` | Get the GitHub OAuth authorization URL |
| `GET` | `/auth/github/callback` | GitHub OAuth callback — **public** (validated via `state`) |
| `GET` | `/api/user/github-status` | Whether the current user has connected GitHub |
| `GET` | `/api/incidents` | List all incidents, newest first |
| `POST` | `/api/incidents` | Manually create an incident |
| `GET` | `/api/incidents/:id` | Full incident detail (alerts, root causes, actions, comments, audit log, assignee) |
| `POST` | `/api/incidents/:id/investigate` | Run the Gemini investigation and propose a remediation action |
| `POST` | `/api/incidents/:id/summarize` | Generate an executive summary via Gemini |
| `POST` | `/api/incidents/:id/jira` | Create a Jira ticket for this incident |
| `POST` | `/api/incidents/:id/assign` | Assign the incident to a user |
| `POST` | `/api/incidents/:id/tags` | Replace the incident's tag list |
| `POST` | `/api/incidents/:id/comments` | Add a comment |
| `POST` | `/api/incidents/:id/view` | Heartbeat for "currently viewing" presence |
| `POST` | `/api/incidents/bulk` | Bulk investigate/resolve a list of incident IDs |
| `POST` | `/api/actions/:id/approve` | Approve a proposed remediation action |
| `POST` | `/api/actions/:id/reject` | Reject a proposed remediation action |
| `GET` | `/api/rca-templates` | List RCA templates (auto-seeds a default on first call) |
| `GET` | `/api/users` | List users (for the assignee picker) |
| `POST` | `/api/seed` | Seed one demo incident if the table is empty |
| `POST` | `/api/webhooks/alerts` | Ingest an external alert, auto-triage it, and open an incident — **public** |

</details>

<br/>

---

## <img src="https://img.shields.io/badge/-Project%20Directory%20Structure-8B5CF6?style=flat-square"/>

<details>
<summary><b>View full directory tree</b></summary>
<br/>

```
ember/
├── server.ts                        # Express entry point — all API routes + Vite middleware
├── index.html                       # SPA HTML shell
├── vite.config.ts                   # Vite + Tailwind + React plugin config
├── drizzle.config.ts                # Drizzle Kit config (Postgres connection, migrations)
├── tsconfig.json
├── firebase-applet-config.json      # Firebase client config (project ID, etc.)
├── metadata.json                    # AI Studio applet metadata
├── .env.example                     # Template for all environment variables
├── package.json
│
├── src/
│   ├── main.tsx                     # React root render
│   ├── App.tsx                      # Top-level app shell, header, sidebar, auth gate
│   ├── index.css                    # Tailwind entry
│   │
│   ├── components/
│   │   ├── AuthProvider.tsx         # Firebase Auth context (sign-in/out, token access)
│   │   ├── Dashboard.tsx            # Incident list, filters, search, bulk actions, create modal
│   │   └── IncidentDetails.tsx      # Incident detail view, investigate/summarize/approve UI, PDF export
│   │
│   ├── agent/
│   │   └── investigation.ts         # Gemini-powered root-cause investigation logic
│   │
│   ├── lib/
│   │   ├── firebase.ts              # Firebase client SDK init (auth + Google provider)
│   │   ├── firebase-admin.ts        # Firebase Admin SDK init (server-side token verification)
│   │   ├── pagerduty.ts             # PagerDuty Events API v2 trigger/resolve
│   │   ├── slack.ts                 # Slack incoming webhook notifier
│   │   └── jira.ts                  # Jira REST API v3 issue creation
│   │
│   ├── middleware/
│   │   └── auth.ts                  # requireAuth Express middleware (verifies Firebase ID token)
│   │
│   └── db/
│       ├── index.ts                 # Drizzle + pg connection
│       └── schema.ts                # All table + enum definitions
│
└── public/
    └── assets/aistudio/             # AI Studio static assets
```

</details>

<br/>

---

## <img src="https://img.shields.io/badge/-Tech%20Stack-8B5CF6?style=flat-square"/>

<div align="center">

| Category | Technology |
|:--|:--|
| Frontend framework | React 19, Vite 6 |
| Styling | Tailwind CSS v4 |
| Icons / animation | lucide-react, motion |
| Charts | recharts |
| PDF export | jsPDF + html2canvas |
| Backend framework | Express 4 (TypeScript via `tsx`, bundled with `esbuild` for production) |
| Database | PostgreSQL, Drizzle ORM, `drizzle-kit` for migrations |
| Auth | Firebase Auth (client) + firebase-admin (server) |
| AI | `@google/genai` (Gemini 2.5 Flash), `@langchain/core` / `@langchain/langgraph` (installed, not yet wired into the investigation flow) |
| Validation | zod |
| Integrations | PagerDuty Events API v2, Slack Incoming Webhooks, Jira REST API v3, GitHub OAuth |
| Package manager | supports both `npm` and Bun (`bun.lock` present) |

</div>

<br/>

---

## <img src="https://img.shields.io/badge/-Quickstart%20Guide-8B5CF6?style=flat-square"/>

**1. Prerequisites** — Node.js 18+, a PostgreSQL database, a Firebase project with Google Sign-In enabled, and a Gemini API key.

**2. Installation**

```bash
git clone https://github.com/raahuldatta/Ember.git
cd Ember
npm install
```

**3. Firebase Setup**

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Authentication → Sign-in method → Google**.
3. Register a Web App and copy its config into `firebase-applet-config.json` at the project root (used by both `src/lib/firebase.ts` and `src/lib/firebase-admin.ts`).
4. For the Admin SDK to verify ID tokens server-side, make sure Application Default Credentials are available in your environment (e.g. `GOOGLE_APPLICATION_CREDENTIALS` pointing at a service account key), or run this inside a Google Cloud environment that provides them automatically.

**4. Database Setup**

```bash
# drizzle.config.ts reads SQL_HOST, SQL_DB_NAME, SQL_ADMIN_USER, SQL_ADMIN_PASSWORD
export SQL_HOST=localhost
export SQL_DB_NAME=ember
export SQL_ADMIN_USER=postgres
export SQL_ADMIN_PASSWORD=yourpassword

npm run db:push
```

> The running app itself connects using `DATABASE_URL` (see below) — the two configs are separate because `drizzle-kit` (migrations) and the app's runtime `pg` client are wired independently in this project.

**5. Environment Variables**

Copy `.env.example` to `.env` and fill in what you need:

<details>
<summary><b>View all environment variables</b></summary>
<br/>

| Variable | Required | Purpose |
|:--|:--:|:--|
| `GEMINI_API_KEY` | Yes | Powers the investigation and executive-summary AI calls |
| `APP_URL` | Yes (for GitHub OAuth) | Base URL used to build the GitHub OAuth redirect URI |
| `DATABASE_URL` | Yes | Postgres connection string used by the running app |
| `PAGERDUTY_ROUTING_KEY` | Optional | Enables triggering/resolving PagerDuty incidents |
| `PAGERDUTY_API_KEY` | Optional | Reserved for further PagerDuty API calls |
| `SLACK_WEBHOOK_URL` | Optional | Enables Slack notifications |
| `JIRA_DOMAIN` | Optional | Your Jira Cloud domain, e.g. `yourteam.atlassian.net` |
| `JIRA_EMAIL` | Optional | Jira account email for API auth |
| `JIRA_API_TOKEN` | Optional | Jira API token |
| `JIRA_PROJECT_KEY` | Optional | Jira project to create issues in |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Optional | Enables the "Connect GitHub" OAuth flow |

Every integration is optional and fails gracefully — if a variable is missing, that integration logs a warning and is skipped rather than crashing the request.

</details>

**6. Run the App**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google, and you'll land on the Issues dashboard. Use **Seed Demo Data** (or `POST /api/seed`) to populate one example incident if your database is empty.

**7. Scripts**

| Command | Purpose |
|:--|:--|
| `npm run dev` | Runs `server.ts` directly via `tsx`, with Vite in middleware mode for HMR |
| `npm run build` | Builds the frontend with Vite, then bundles `server.ts` into `dist/server.cjs` with esbuild |
| `npm start` | Runs the production build (`node dist/server.cjs`) |
| `npm run preview` | Vite's built-in production preview server (frontend only) |
| `npm run clean` | Removes `dist/` and any stray `server.js` |
| `npm run lint` | Type-checks the project (`tsc --noEmit`) |
| `npm run db:push` | Pushes the Drizzle schema to Postgres |

<br/>

---

## <img src="https://img.shields.io/badge/-Integrations%20Setup-8B5CF6?style=flat-square"/>

| Integration | What it's used for | How to configure |
|:--|:--|:--|
| **PagerDuty** | Auto-triggers a Sev1 incident on alert ingestion; resolves it on bulk-resolve | Create an Events API v2 integration on a PagerDuty service and set `PAGERDUTY_ROUTING_KEY` |
| **Slack** | Posts a notification on every new incident and every bulk action | Create an Incoming Webhook in your Slack workspace and set `SLACK_WEBHOOK_URL` |
| **Jira** | Creates a ticket from an incident via the "Create Jira Ticket" button | Generate an API token from your Atlassian account and set `JIRA_DOMAIN`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY` |
| **GitHub** | Lets a user connect their GitHub account (OAuth) for future deploy/PR context | Register an OAuth App in GitHub settings, set the callback to `${APP_URL}/auth/github/callback`, and set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` |

<br/>

---

## <img src="https://img.shields.io/badge/-Deployment-8B5CF6?style=flat-square"/>

Ember was built and is hosted via **Google AI Studio**, which provisions a Cloud Run service and injects `GEMINI_API_KEY` and `APP_URL` automatically from the Secrets panel.

To self-host elsewhere (e.g. any Node-compatible platform):

```bash
npm run build
npm start
```

This produces a single Node process (`dist/server.cjs`) that serves both the API and the built SPA (`dist/`) — no separate frontend/backend deploy needed. Make sure `DATABASE_URL` and your Firebase Admin credentials are available in the deployment environment.

<br/>

---

## <img src="https://img.shields.io/badge/-Known%20Limitations%20%2F%20Roadmap-8B5CF6?style=flat-square"/>

- **Simulated evidence collection** — `runInvestigation()` currently feeds Gemini hardcoded sample log/trace/deployment strings rather than pulling live data from an observability stack. Wiring this to real log/metrics/APM sources is the next step toward genuine root-cause analysis.
- **LangGraph not yet used** — `@langchain/core` and `@langchain/langgraph` are dependencies but the investigation flow is a single direct Gemini call rather than a multi-step graph — useful context if you're extending the agent into a proper investigation pipeline.
- **In-memory presence** — "who's viewing this incident" is tracked in a server-side `Map`, so it resets on server restart and won't scale across multiple server instances.
- **No automatic remediation execution** — this is by design (see Core Principle above), but note that `remediation_actions.actionPayload` is not currently wired to any executor even after approval — applying the fix is a manual, out-of-band step for the on-call engineer.

<br/>

---

## <img src="https://img.shields.io/badge/-License-8B5CF6?style=flat-square"/>

No license file is currently included in this repository. Add a `LICENSE` file (e.g. MIT) if you intend for this project to be reused by others.

<br/>

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=20,11,6&height=120&section=footer" width="100%"/>

</div>
