# 🔥 Ember — AI Incident Response Engineer

### A First-Pass Investigation Workspace for On-Call Engineers

[![Node](https://img.shields.io/badge/Node.js-18%2B-339933.svg?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Express-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Frontend-Vite-646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel-000000.svg?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

**Ember aggregates incidents, drafts evidence-backed root-cause hypotheses, and never executes a production change without human approval.**

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Core Principle](#-core-principle)
- [System Architecture](#️-system-architecture)
- [Feature Breakdown](#-feature-breakdown)
- [Project Directory Structure](#-project-directory-structure)
- [Quickstart Guide](#-quickstart-guide)
  - [Prerequisites & Installation](#1-installation)
  - [Run the Demo Workspace](#2-run-the-demo-workspace)
  - [Environment Variables](#3-environment-variables)
  - [Scripts](#4-scripts)
- [Deployment](#-deployment)
- [Contributing & License](#-contributing--license)

---

## 🔬 Overview

When production breaks at 2 a.m., the slowest part of incident response usually isn't fixing the bug — it's the first 20 minutes of *"what changed, what's the blast radius, and where do I even look?"*

**Ember** is built to compress that first pass. It watches for incoming incidents, pulls in the surrounding evidence (logs, deploys, alerts, related tickets), and drafts a **cited root-cause hypothesis** along with a **remediation plan** — so the on-call engineer starts from an informed baseline instead of a blank terminal.

Ember is explicitly an **investigation assistant, not an autonomous operator**. It never pushes a fix, rolls back a deploy, or touches production on its own — every remediation step requires an explicit human approval before execution.

---

## 🛡️ Core Principle

> **Ember investigates. Humans decide.**

| Ember does | Ember never does |
|---|---|
| Aggregates incident signals across sources | Executes a production change |
| Drafts evidence-backed root-cause hypotheses | Auto-approves its own remediation plan |
| Cites the evidence behind every claim | Fabricates root causes without support |
| Proposes a remediation plan for review | Applies that plan without sign-off |

---

## ⚙️ System Architecture

```
                     Incident Signal (alert, page, ticket)
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   Ember Investigation Engine    │
                    └───────────────────────────────┘
                                    │
        ┌───────────────┬──────────┼──────────┬───────────────┐
        ▼               ▼                     ▼               ▼
   PagerDuty         Slack                Jira /          GitHub
   (incidents)     (context)            issue history      (deploys/PRs)
        │               │                     │               │
        └───────────────┴──────────┬──────────┴───────────────┘
                                    ▼
                    ┌───────────────────────────────┐
                    │  Evidence-Backed Root-Cause      │
                    │  Hypothesis (Gemini / LLM)       │
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   Draft Remediation Plan         │
                    └───────────────────────────────┘
                                    │
                                    ▼
                       🔒 Human Approval Gate 🔒
                                    │
                                    ▼
                        Change executed by human
```

### Data Layer

- **Demo mode (default):** an in-memory store, so anyone can explore the product without provisioning a database.
- **Persistent mode:** attach `DATABASE_URL` to run against PostgreSQL for durable incident history.

### Reasoning Layer

- **Live mode:** attach `GEMINI_API_KEY` for real-time investigation and summarization.
- **Fallback mode:** without a key, Ember still produces a structured, cited response using its fallback summarizer — no silent degradation into unsupported guesses.

---

## 🧩 Feature Breakdown

| Capability | Description |
|---|---|
| **Incident aggregation** | Pulls incidents in from PagerDuty and related integrations into one workspace. |
| **Root-cause drafting** | Generates a hypothesis grounded in cited evidence rather than speculation. |
| **Remediation planning** | Proposes concrete next steps for the on-call engineer to review. |
| **Human-in-the-loop safety** | No production action is ever taken without explicit approval. |
| **Integrations** | PagerDuty, Slack, Jira, and GitHub, configurable via environment variables. |

---

## 📁 Project Directory Structure

```
ember/
├── api/
│   └── index.ts              # Express serverless entry point (Vercel)
├── src/                       # Frontend application (Vite)
├── .env.example                # Template for all supported environment variables
├── package.json
└── README.md
```

*(Adjust this tree to match your actual folder layout.)*

---

## 🚀 Quickstart Guide

### 1. Installation

Clone this repository and install dependencies:

```bash
git clone https://github.com/raahuldatta/Ember.git
cd Ember
npm install
```

### 2. Run the Demo Workspace

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and choose **Enter demo workspace**. This runs entirely on the in-memory store — no database or API key required.

### 3. Environment Variables

Copy `.env.example` and fill in what you need. All are optional — Ember degrades gracefully without them.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string for persistence (otherwise uses the demo memory store) |
| `GEMINI_API_KEY` | Enables live investigation/summarization (otherwise uses a cited fallback) |
| `PAGERDUTY_*` | PagerDuty integration (routing key, etc.) |
| `SLACK_WEBHOOK_URL` | Slack notifications |
| `JIRA_*` | Jira issue integration |
| `GITHUB_*` | GitHub deploy/PR context |

### 4. Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Express + Vite in one process |
| `npm run build` | Production frontend build |
| `npm start` | Serve the built app |
| `npm run lint` | Typecheck |

---

## ☁️ Deployment

Ember is configured for **Vercel**. The Express app (`api/index.ts`) is the serverless entry point and serves both the `/api` routes and the SPA frontend.

```bash
vercel deploy
```

---

## 📄 Contributing & License

Contributions, issues, and feature requests are welcome — feel free to open a PR or an issue.

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
