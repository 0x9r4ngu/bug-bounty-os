import { DatabaseSync } from "node:sqlite";
import { nanoid } from "nanoid";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Node's built-in SQLite (no native addon → no teardown crashes). API matches
// better-sqlite3 for prepare/run/get/all/exec and @name parameter binding.
export const db = new DatabaseSync(path.join(DATA_DIR, "bugbounty.db"));
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

export const id = () => nanoid(12);
export const now = () => new Date().toISOString();

const SCHEMA = `
CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  platform TEXT,
  program_type TEXT,
  visibility TEXT DEFAULT 'PUBLIC',       -- PUBLIC | PRIVATE | INVITE_ONLY | VDP | INTERNAL | CUSTOM
  status TEXT DEFAULT 'Active',           -- Active | Paused | Archived | Closed | Expired
  is_private INTEGER DEFAULT 0,
  is_watched INTEGER DEFAULT 0,
  access_status TEXT,
  invitation_status TEXT,                 -- Received | Accepted | Pending | Expired | Declined | Unknown
  invitation_date TEXT,
  invitation_expires TEXT,
  invitation_source TEXT,
  invitation_notes TEXT,
  invitation_url TEXT,
  program_url TEXT,
  private_url TEXT,
  scope TEXT,
  rules TEXT,
  rewards TEXT,
  notes TEXT,
  tags TEXT,                              -- comma separated
  custom_fields TEXT DEFAULT '{}',        -- json
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entry_points (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,                              -- Main Program | Web Application | API Documentation | ...
  url TEXT,
  environment TEXT,                       -- prod | staging | dev
  auth_type TEXT,
  scope_status TEXT DEFAULT 'Unknown',    -- In Scope | Out of Scope | Unknown
  status TEXT DEFAULT 'Needs Verification', -- Active | Offline | Redirect | Unknown | Needs Verification | Out of Scope
  last_verified_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'Web',                -- Web | API | Android | iOS | Cloud | GraphQL | WebSocket | Network | Repository | AI/LLM | Other
  url TEXT,
  technology TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS endpoints (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  method TEXT DEFAULT 'GET',
  path TEXT NOT NULL,
  url TEXT,
  status TEXT DEFAULT 'Untested',         -- Untested | In Progress | Tested | Potential Issue | N/A | Blocked
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  endpoint_id TEXT REFERENCES endpoints(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  vuln_class TEXT,                        -- XSS | IDOR/BOLA | Authentication | ...
  severity TEXT DEFAULT 'Medium',         -- Critical | High | Medium | Low | Informational
  status TEXT DEFAULT 'Potential',        -- Potential | Confirmed | Submitted | Triaged | Accepted | Resolved | Duplicate | Rejected
  cvss REAL,
  cwe TEXT,
  bounty REAL DEFAULT 0,
  observation TEXT,
  evidence TEXT DEFAULT '[]',             -- json array
  discovered_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  finding_id TEXT REFERENCES findings(id) ON DELETE SET NULL,
  program_id TEXT REFERENCES programs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  markdown_content TEXT DEFAULT '',
  status TEXT DEFAULT 'Draft',            -- Draft | In Progress | Ready | Submitted | Accepted | Resolved | Rejected | Archived
  template_id TEXT,
  version INTEGER DEFAULT 1,
  word_count INTEGER DEFAULT 0,
  folder TEXT DEFAULT 'Drafts',
  is_favorite INTEGER DEFAULT 0,
  submission_platform TEXT,
  submission_id TEXT,
  severity TEXT,
  cvss REAL,
  cwe TEXT,
  bounty REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  submitted_at TEXT
);

CREATE TABLE IF NOT EXISTS report_versions (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  markdown_content TEXT NOT NULL,
  change_summary TEXT,
  is_submitted INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  program_id TEXT REFERENCES programs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  phase TEXT DEFAULT 'Recon',
  coverage INTEGER DEFAULT 0,
  minutes INTEGER DEFAULT 0,
  started_at TEXT,
  ended_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  programs_worked TEXT,
  hours REAL DEFAULT 0,
  tested TEXT,
  found TEXT,
  interesting TEXT,
  tomorrow TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY,
  program_id TEXT REFERENCES programs(id) ON DELETE CASCADE,
  type TEXT,
  title TEXT NOT NULL,
  detail TEXT,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  type TEXT,
  title TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subdomains (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  host TEXT NOT NULL,
  status TEXT DEFAULT 'Unknown',          -- Live | Offline | Redirect | Unknown | Out of Scope
  http_code INTEGER,
  title TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(asset_id, host)
);
CREATE INDEX IF NOT EXISTS idx_subdomain_asset ON subdomains(asset_id);
CREATE INDEX IF NOT EXISTS idx_subdomain_program ON subdomains(program_id);

CREATE TABLE IF NOT EXISTS checklist_progress (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,                    -- scope target (asset id, or a scope label)
  item_key TEXT NOT NULL,                 -- key from the checklist template
  checked INTEGER DEFAULT 0,
  notes TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(program_id, scope, item_key)
);

CREATE INDEX IF NOT EXISTS idx_checklist_program ON checklist_progress(program_id);
CREATE INDEX IF NOT EXISTS idx_ep_program ON entry_points(program_id);
CREATE INDEX IF NOT EXISTS idx_asset_program ON assets(program_id);
CREATE INDEX IF NOT EXISTS idx_endpoint_program ON endpoints(program_id);
CREATE INDEX IF NOT EXISTS idx_finding_program ON findings(program_id);
CREATE INDEX IF NOT EXISTS idx_finding_sev ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_finding_class ON findings(vuln_class);
CREATE INDEX IF NOT EXISTS idx_report_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_report_finding ON reports(finding_id);
CREATE INDEX IF NOT EXISTS idx_version_report ON report_versions(report_id);
CREATE INDEX IF NOT EXISTS idx_activity_at ON activity(at);
CREATE INDEX IF NOT EXISTS idx_timeline_program ON timeline_events(program_id);
`;

export function migrate() {
  db.exec(SCHEMA);
  // add subdomain_id to findings if it doesn't exist yet (existing DBs)
  const cols = db.prepare("PRAGMA table_info(findings)").all() as any[];
  if (!cols.some((c) => c.name === "subdomain_id")) {
    db.exec("ALTER TABLE findings ADD COLUMN subdomain_id TEXT");
  }
}

export function logActivity(type: string, title: string, entityType?: string, entityId?: string) {
  db.prepare(
    `INSERT INTO activity (id, type, title, entity_type, entity_id, at) VALUES (?,?,?,?,?,?)`
  ).run(id(), type, title, entityType ?? null, entityId ?? null, now());
}

export function addTimeline(programId: string, type: string, title: string, detail?: string) {
  db.prepare(
    `INSERT INTO timeline_events (id, program_id, type, title, detail, at) VALUES (?,?,?,?,?,?)`
  ).run(id(), programId, type, title, detail ?? null, now());
}
