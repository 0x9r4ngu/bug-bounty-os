# Bug Bounty OS

A **local, single-user security-research tracker** — programs, scope assets and subdomains, findings,
and submission-ready Markdown reports, all in one place. Everything lives in a local SQLite file;
nothing leaves your machine.

Built to be dead simple to run: **pure Python standard library** (no `pip install`, no Node, no build
step) serving a plain HTML/CSS/JS frontend.

---

## Quick start

```bash
git clone https://github.com/0x9r4ngu/bug-bounty-os.git
cd bug-bounty-os
./run.sh
```

Then open **http://localhost:8787**.

That's it — no dependencies to install. (`./install.sh` just verifies your Python version.) The
database `data/bugbounty.db` is created and seeded with demo data on first launch; delete
`data/*.db*` any time to start empty.

### Requirements
- **Python 3.8+** (already present on most systems). Nothing else.

---

## Features

- **Overview dashboard** — headline numbers, bounty trend, findings by severity, recent findings,
  and a "what's next" queue.
- **Programs & scope** — public / private / invite-only / VDP, invitation tracking, watchlist,
  Markdown research notes (autosave), and a program activity timeline.
- **Assets & subdomains** — in-scope hosts as assets; each asset expands to hold **subdomains** with
  **bulk paste** and a one-click **live HTTP probe** (status, code, page title).
- **Findings** — bound to an asset (or a specific subdomain). "New Finding" creates the finding + a
  linked report and opens the editor.
- **Report editor** — split-pane Markdown **write + live preview**, autosave, status/severity, and
  export to **Markdown / HTML** with automatic **secret redaction**.
- **Analytics** — bounty & reports over time, severity breakdown, vulnerability classes, status
  funnel, and bounty by program, with a program filter.
- **Unfinished** — potential findings, unfinished reports, submissions awaiting response, unprobed
  subdomains, and pending invitations — each links back to its source.
- **Research journal** — a daily log of what you tested and found.
- **Light + dark themes** (toggle in the header) and **⌘K global search**.

---

## Stack

| Part      | Tech |
|-----------|------|
| Backend   | **Python 3 standard library** — `http.server` + `sqlite3` (no external packages) |
| Frontend  | Plain **HTML / CSS / JavaScript** — no framework, no build step |
| Database  | SQLite file at `data/bugbounty.db` (auto-created + seeded) |
| Design    | Dark-pro (Vercel/GitHub) aesthetic, violet accent, Inter + JetBrains Mono; light + dark |

One process serves both the API and the web app on port `8787` (override with `PORT=…`).

---

## Project structure

```
app.py            # the whole backend: HTTP server + SQLite schema + seed + API routes + subdomain probe
web/
  index.html      # shell
  styles.css      # design system (light + dark tokens)
  app.js          # single-page app: router, all views, SVG charts, markdown, editor
data/             # bugbounty.db (git-ignored, created at runtime)
install.sh        # checks Python version
run.sh            # starts the app
```

---

## Privacy

A **local, single-user** tool. All data is stored in a local SQLite file that is **git-ignored** and
never leaves your machine. Report exports run an automatic **secret-redaction** pass (JWTs, bearer
tokens, AWS keys) before anything leaves the app.

> Only test systems you are authorized to test. Stay in scope.
