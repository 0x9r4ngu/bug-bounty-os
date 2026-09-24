# Bug Bounty OS

A local-first personal security-research platform — programs, entry points, findings,
a full Markdown report workspace, and interactive analytics. Single-user, your data
never leaves the machine (SQLite file at `data/bugbounty.db`).

## Stack

- **Frontend** — React + Vite + TypeScript, Tailwind v4, ECharts (charts), CodeMirror 6 (editor)
- **Backend** — Fastify + Node's built-in `node:sqlite` (raw SQL, no ORM, no native addon)
- **DB** — SQLite (`data/bugbounty.db`, auto-created + seeded on first run)

## Run

```bash
npm install
npm run dev
```

- App:  http://localhost:5173
- API:  http://localhost:5177

The database is created and seeded with demo programs/findings/reports on first launch.
To start empty, delete `data/bugbounty.db*` before running — seeding only fires when the
`programs` table is empty.

> Note: the server runs on Node's built-in SQLite via
> `node --experimental-sqlite --import tsx server/index.ts` (no native addon, no build step). It runs
> without `--watch`, so restart it manually after editing server code. If server changes don't seem to
> apply, a stale process may be running cached code — kill by port (`lsof -ti:5177`) and clear the tsx
> cache (`rm -rf node_modules/.cache/tsx`).

## What's built (working today)

| Area | Features |
|------|----------|
| Dashboard | 14 KPI cards (clickable), active research, bounty trend, severity donut, coverage bars, "what should I do next?", activity feed |
| Programs | list + filters (private/watched), create modal, private-program indicators, invitation fields |
| Program workspace | tabs: Overview, Entry Points, Assets, Endpoints, Findings, **Checklist**, Notes (autosave), Timeline — all with add/edit/delete |
| Per-scope checklist | full 16-part / 76-item web pentest checklist per asset (scope), each item with an expandable "how to test" guide, checkboxes, and per-scope + overall program progress tracking |
| Findings | global list, severity/status/class filters, quick-finding modal |
| Reports | library with folders/favorites/search/clone |
| Report editor | split-pane CodeMirror + live sanitized preview, autosave + local draft recovery, outline nav, quality checklist, version history (snapshot/view/restore), metadata panel, **secret detection + redaction**, templates, snippets, Markdown/HTML export (auto-redacted) |
| Analytics | 10 interactive charts (bounty/reports over time, severity, class, funnel, coverage radar, asset types, tech, hours/day, heatmap) + bounty-by-type/program tables, program filter |
| Unfinished | untested endpoints, potential findings, unfinished reports, awaiting response, pending invitations — every row links to source |
| Journal | daily research log |
| Global | ⌘K / Ctrl+K search across programs, findings, reports |

## Roadmap (from the full spec, not yet built)

Custom drag-drop dashboards, saved filters/query builder, program cloning & custom fields,
communication log, report follow-up reminders, PDF export, request/response evidence store,
weekly summary generation, calendar heatmap, multi-program comparison, checklist/methodology
engine. See the original spec for the full 100-feature checklist.

## Project layout

```
server/
  db.ts        schema (SQL) + helpers
  seed.ts      demo data (only when empty)
  index.ts     Fastify API — all routes
client/src/
  App.tsx      shell: sidebar, ⌘K search, router
  lib/         api, ui primitives, chart theme, report helpers
  pages/       Dashboard, Programs, ProgramDetail, Findings, Reports, ReportEditor, Analytics, Unfinished, Journal
design-system/ persisted UI/UX design tokens (MASTER.md)
data/          bugbounty.db (gitignored)
```
