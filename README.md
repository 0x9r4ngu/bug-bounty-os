# Bug Bounty OS

A **local-first, single-user security-research platform** — your persistent source of truth for bug
bounty work. Track programs and scope, enumerate assets and subdomains, run a per-scope pentest
methodology checklist, log findings bound to their assets, and write submission-ready Markdown
reports — all in one connected workspace. Everything lives in a local SQLite file; nothing leaves
your machine.

---

## Quick start

```bash
git clone https://github.com/0x9r4ngu/bug-bounty-os.git
cd bug-bounty-os
./install.sh      # checks Node and installs dependencies
./run.sh          # starts the app
```

Then open **http://localhost:5173**.

> The database (`data/bugbounty.db`) is created and seeded with demo data on first launch. Delete
> `data/*.db*` any time to start empty.

### Requirements
- **Node.js ≥ 22.5** (Node 22 LTS or 24 recommended). The backend uses Node's built-in `node:sqlite`
  — no native modules, no build step.

---

## Features

- **Programs & scope** — public / private / invite-only / VDP, invitation tracking, watchlist,
  Markdown research notes, and a full activity timeline (all inside the program's **Overview**).
- **Assets & subdomains** — add in-scope hosts as assets; wildcard assets hold **nested subdomains**
  with **bulk paste** and a one-click **live HTTP probe** (status, code, page title).
- **Findings** — always **bound to an asset (or a specific subdomain)**. "New Finding" creates the
  finding + a linked report and drops you straight into the editor.
- **Markdown report editor** — split-pane CodeMirror + live sanitized preview, **autosave** with
  local draft recovery, section **outline**, **secret detection & redaction**, reusable **snippets**
  and **templates**, and export to **Markdown / HTML** (auto-redacted).
- **Per-scope checklist** — a 16-part / 76-item web pentest methodology checklist per asset, each
  item with an expandable *"how to test"* guide and live **progress tracking**.
- **Analytics** (home page) — bounty & reports over time, findings by severity, vulnerability-class
  distribution, status funnel, methodology coverage, and more, with a program filter.
- **Unfinished business** — untested endpoints, potential findings, unfinished reports, submissions
  awaiting response, and pending invitations, each linking back to its source.
- **Research journal** — a daily log of what you tested, found, and what's next.
- **⌘K global search** across programs, findings, and reports.

---

## Stack

| Layer     | Tech |
|-----------|------|
| Frontend  | React + Vite + TypeScript, Tailwind CSS v4, ECharts, CodeMirror 6 |
| Backend   | Fastify + **`node:sqlite`** (raw SQL, no ORM, no native addon) |
| Database  | SQLite file at `data/bugbounty.db` (auto-created + seeded) |
| Design    | Monospace "mono" terminal aesthetic; theme is token-driven in `client/src/index.css` (`@theme`) — recolor the whole app by editing those CSS variables |

The dev server runs both processes via `concurrently`: Vite (`:5173`) proxies `/api` to Fastify
(`:5177`).

---

## Scripts

```bash
npm run dev     # start API + client (what run.sh calls)
npm run build   # production build of the client
npm run start   # start the API server only
npm run qa      # headless QA: render check + click-through interaction tests (needs the app running)
```

Regenerate the checklist template from its source Markdown:

```bash
node scripts/build-checklist.mjs
```

---

## Project structure

```
server/
  db.ts        # SQLite schema (DDL) + migrations + helpers
  seed.ts      # demo data (only when the DB is empty)
  index.ts     # Fastify API — all routes
client/src/
  App.tsx      # shell: sidebar, ⌘K search, router
  lib/         # api client, UI primitives, chart theme, report/checklist/cwe helpers
  components/  # ProgramChecklist, CweSelect
  pages/       # Analytics (home), Programs, ProgramDetail, Findings, Reports, ReportEditor, Unfinished, Journal
scripts/       # build-checklist.mjs (+ cached source), maintenance
qa/            # headless Chromium QA scripts (puppeteer-core)
data/          # bugbounty.db (git-ignored, created at runtime)
```

---

## Privacy

This is a **local, single-user** tool. All data is stored in a local SQLite file that is **git-ignored**
and never leaves your machine. Report exports run an automatic **secret-redaction** pass (JWTs, API
keys, bearer tokens, private IPs, etc.) as a safety net before anything leaves the app.

> Only test systems you are authorized to test. Stay in scope.
