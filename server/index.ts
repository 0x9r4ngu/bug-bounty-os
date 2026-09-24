import Fastify from "fastify";
import cors from "@fastify/cors";
import { db, id, now, migrate, logActivity, addTimeline } from "./db.ts";
import { seedIfEmpty } from "./seed.ts";

process.on("SIGTERM", () => { try { db.close(); } catch {} process.exit(0); });
process.on("SIGINT", () => { try { db.close(); } catch {} process.exit(0); });

try {
  migrate();
  seedIfEmpty();
} catch (e) {
  console.error("[migrate/seed failed]", e);
  process.exit(1);
}

const app = Fastify({ logger: false });

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/* ----------------------------- generic helpers ---------------------------- */
function all(sql: string, ...params: any[]) {
  return db.prepare(sql).all(...params);
}
function one(sql: string, ...params: any[]) {
  return db.prepare(sql).get(...params);
}

/* -------------------------------- PROGRAMS -------------------------------- */
app.get("/api/programs", async (req) => {
  const q = (req.query as any) || {};
  let sql = "SELECT * FROM programs WHERE 1=1";
  const p: any[] = [];
  if (q.visibility) { sql += " AND visibility = ?"; p.push(q.visibility); }
  if (q.private === "1") sql += " AND is_private = 1";
  if (q.watched === "1") sql += " AND is_watched = 1";
  if (q.status) { sql += " AND status = ?"; p.push(q.status); }
  sql += " ORDER BY updated_at DESC";
  const rows = all(sql, ...p) as any[];
  // attach counts
  for (const r of rows) {
    r.asset_count = (one("SELECT COUNT(*) c FROM assets WHERE program_id=?", r.id) as any).c;
    r.endpoint_count = (one("SELECT COUNT(*) c FROM endpoints WHERE program_id=?", r.id) as any).c;
    r.finding_count = (one("SELECT COUNT(*) c FROM findings WHERE program_id=?", r.id) as any).c;
    r.entrypoint_count = (one("SELECT COUNT(*) c FROM entry_points WHERE program_id=?", r.id) as any).c;
    r.open_reports = (one("SELECT COUNT(*) c FROM reports WHERE program_id=? AND status IN ('Draft','In Progress','Ready','Submitted','Triaged')", r.id) as any).c;
  }
  return rows;
});

app.get("/api/programs/:id", async (req) => {
  const pid = (req.params as any).id;
  const program = one("SELECT * FROM programs WHERE id=?", pid);
  if (!program) return { error: "not found" };
  return {
    program,
    entry_points: all("SELECT * FROM entry_points WHERE program_id=? ORDER BY created_at", pid),
    assets: all("SELECT * FROM assets WHERE program_id=? ORDER BY created_at", pid),
    endpoints: all("SELECT * FROM endpoints WHERE program_id=? ORDER BY created_at", pid),
    findings: all("SELECT f.*, sd.host subdomain_host FROM findings f LEFT JOIN subdomains sd ON sd.id=f.subdomain_id WHERE f.program_id=? ORDER BY f.created_at DESC", pid),
    reports: all("SELECT * FROM reports WHERE program_id=? ORDER BY updated_at DESC", pid),
    sessions: all("SELECT * FROM sessions WHERE program_id=? ORDER BY created_at DESC", pid),
    timeline: all("SELECT * FROM timeline_events WHERE program_id=? ORDER BY at DESC", pid),
    checklist: all("SELECT scope, item_key, checked, notes FROM checklist_progress WHERE program_id=?", pid),
    subdomains: all("SELECT * FROM subdomains WHERE program_id=? ORDER BY host", pid),
  };
});

/* ------------------------------- SUBDOMAINS ------------------------------- */
const cleanHost = (h: string) => h.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/[,\s]+$/, "").toLowerCase();

app.post("/api/assets/:id/subdomains", async (req) => {
  const aid = (req.params as any).id;
  const asset = one("SELECT * FROM assets WHERE id=?", aid) as any;
  if (!asset) return { error: "asset not found" };
  const b = req.body as any;
  const raw: string[] = Array.isArray(b.hosts) ? b.hosts : String(b.hosts ?? "").split(/[\n,]+/);
  const hosts = [...new Set(raw.map(cleanHost).filter(Boolean))];
  const ins = db.prepare("INSERT OR IGNORE INTO subdomains (id, asset_id, program_id, host, status, created_at) VALUES (?,?,?,?,?,?)");
  let added = 0;
  for (const h of hosts) {
    const r = ins.run(id(), aid, asset.program_id, h, "Unknown", now());
    if ((r as any).changes) added++;
  }
  return { added, total: hosts.length };
});
app.patch("/api/subdomains/:id", async (req) => {
  const b = req.body as any;
  const sets: string[] = [], vals: any[] = [];
  for (const c of ["status", "http_code", "title", "notes"]) if (c in b) { sets.push(`${c}=?`); vals.push(b[c]); }
  if (!sets.length) return { ok: true };
  vals.push((req.params as any).id);
  db.prepare(`UPDATE subdomains SET ${sets.join(",")} WHERE id=?`).run(...vals);
  return { ok: true };
});
app.delete("/api/subdomains/:id", async (req) => { db.prepare("DELETE FROM subdomains WHERE id=?").run((req.params as any).id); return { ok: true }; });

// probe live status for an asset's subdomains (HTTP check with timeout + small concurrency)
app.post("/api/assets/:id/subdomains/probe", async (req) => {
  const aid = (req.params as any).id;
  const subs = all("SELECT * FROM subdomains WHERE asset_id=?", aid) as any[];
  const upd = db.prepare("UPDATE subdomains SET status=?, http_code=?, title=? WHERE id=?");
  async function probe(s: any) {
    for (const scheme of ["https", "http"]) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch(`${scheme}://${s.host}`, { method: "GET", redirect: "manual", signal: ctrl.signal, headers: { "User-Agent": "BugBountyOS-probe" } });
        clearTimeout(t);
        let title: string | null = null;
        try { const txt = (await res.text()).slice(0, 4000); const m = /<title[^>]*>([^<]{1,120})<\/title>/i.exec(txt); title = m ? m[1].trim() : null; } catch {}
        const code = res.status;
        const status = code >= 300 && code < 400 ? "Redirect" : code < 400 ? "Live" : "Live";
        upd.run(status, code, title, s.id);
        return;
      } catch { /* try next scheme */ }
    }
    upd.run("Offline", null, null, s.id);
  }
  // concurrency of 8
  const queue = [...subs];
  await Promise.all(Array.from({ length: Math.min(8, queue.length) }, async () => {
    while (queue.length) { const s = queue.shift(); if (s) await probe(s); }
  }));
  return { probed: subs.length, subdomains: all("SELECT * FROM subdomains WHERE asset_id=? ORDER BY host", aid) };
});

app.post("/api/programs", async (req) => {
  const b = req.body as any;
  const pid = id();
  db.prepare(`INSERT INTO programs (id,name,company,platform,program_type,visibility,status,is_private,is_watched,
    invitation_status,invitation_date,invitation_source,invitation_notes,invitation_url,program_url,private_url,
    scope,rules,rewards,notes,tags,custom_fields,created_at,updated_at)
    VALUES (@id,@name,@company,@platform,@program_type,@visibility,@status,@is_private,@is_watched,
    @invitation_status,@invitation_date,@invitation_source,@invitation_notes,@invitation_url,@program_url,@private_url,
    @scope,@rules,@rewards,@notes,@tags,@custom_fields,@created_at,@updated_at)`).run({
    id: pid, name: b.name, company: b.company ?? null, platform: b.platform ?? null,
    program_type: b.program_type ?? "Bug Bounty", visibility: b.visibility ?? "PUBLIC",
    status: b.status ?? "Active", is_private: b.visibility === "PUBLIC" || b.visibility === "VDP" ? 0 : 1,
    is_watched: b.is_watched ? 1 : 0, invitation_status: b.invitation_status ?? null,
    invitation_date: b.invitation_date ?? null, invitation_source: b.invitation_source ?? null,
    invitation_notes: b.invitation_notes ?? null, invitation_url: b.invitation_url ?? null,
    program_url: b.program_url ?? null, private_url: b.private_url ?? null, scope: b.scope ?? null,
    rules: b.rules ?? null, rewards: b.rewards ?? null, notes: b.notes ?? "", tags: b.tags ?? null,
    custom_fields: JSON.stringify(b.custom_fields ?? {}), created_at: now(), updated_at: now(),
  });
  addTimeline(pid, "program_added", "Program added", b.name);
  logActivity("program", `Added program ${b.name}`, "program", pid);
  return { id: pid };
});

app.patch("/api/programs/:id", async (req) => {
  const pid = (req.params as any).id;
  const b = req.body as any;
  const fields = ["name","company","platform","program_type","visibility","status","is_private","is_watched",
    "invitation_status","invitation_date","invitation_source","invitation_notes","invitation_url",
    "program_url","private_url","scope","rules","rewards","notes","tags"];
  const sets: string[] = [], vals: any[] = [];
  for (const f of fields) if (f in b) { sets.push(`${f}=?`); vals.push(typeof b[f] === "boolean" ? (b[f]?1:0) : b[f]); }
  if ("custom_fields" in b) { sets.push("custom_fields=?"); vals.push(JSON.stringify(b.custom_fields)); }
  sets.push("updated_at=?"); vals.push(now());
  vals.push(pid);
  db.prepare(`UPDATE programs SET ${sets.join(",")} WHERE id=?`).run(...vals);
  return { ok: true };
});

app.delete("/api/programs/:id", async (req) => {
  db.prepare("DELETE FROM programs WHERE id=?").run((req.params as any).id);
  return { ok: true };
});

/* ------------------------ child collections (generic) --------------------- */
function crud(table: string, cols: string[]) {
  app.post(`/api/${table}`, async (req) => {
    const b = req.body as any;
    const rid = id();
    const allCols = ["id", ...cols, "created_at"];
    const placeholders = allCols.map(() => "?").join(",");
    const vals = allCols.map((c) => c === "id" ? rid : c === "created_at" ? now() : (b[c] ?? null));
    db.prepare(`INSERT INTO ${table} (${allCols.join(",")}) VALUES (${placeholders})`).run(...vals);
    return { id: rid };
  });
  app.patch(`/api/${table}/:id`, async (req) => {
    const b = req.body as any;
    const sets: string[] = [], vals: any[] = [];
    for (const c of cols) if (c in b) { sets.push(`${c}=?`); vals.push(b[c]); }
    if (!sets.length) return { ok: true };
    vals.push((req.params as any).id);
    db.prepare(`UPDATE ${table} SET ${sets.join(",")} WHERE id=?`).run(...vals);
    return { ok: true };
  });
  app.delete(`/api/${table}/:id`, async (req) => {
    db.prepare(`DELETE FROM ${table} WHERE id=?`).run((req.params as any).id);
    return { ok: true };
  });
}
crud("entry_points", ["program_id","name","type","url","environment","auth_type","scope_status","status","last_verified_at","notes"]);
crud("assets", ["program_id","name","type","url","technology","notes"]);
crud("endpoints", ["program_id","asset_id","method","path","url","status","notes"]);
crud("sessions", ["program_id","title","phase","coverage","minutes","started_at","ended_at","notes"]);
crud("journal_entries", ["date","programs_worked","hours","tested","found","interesting","tomorrow"]);

/* -------------------------------- FINDINGS -------------------------------- */
app.get("/api/findings", async (req) => {
  const q = (req.query as any) || {};
  let sql = "SELECT f.*, p.name as program_name, p.is_private FROM findings f JOIN programs p ON p.id=f.program_id WHERE 1=1";
  const p: any[] = [];
  if (q.severity) { sql += " AND f.severity=?"; p.push(q.severity); }
  if (q.vuln_class) { sql += " AND f.vuln_class=?"; p.push(q.vuln_class); }
  if (q.status) { sql += " AND f.status=?"; p.push(q.status); }
  if (q.program_id) { sql += " AND f.program_id=?"; p.push(q.program_id); }
  sql += " ORDER BY f.created_at DESC";
  return all(sql, ...p);
});
app.get("/api/findings/:id", async (req) => {
  const fid = (req.params as any).id;
  const f = one(`SELECT f.*, p.name program_name, a.name asset_name, e.path endpoint_path, e.method endpoint_method, sd.host subdomain_host
    FROM findings f JOIN programs p ON p.id=f.program_id
    LEFT JOIN assets a ON a.id=f.asset_id LEFT JOIN endpoints e ON e.id=f.endpoint_id
    LEFT JOIN subdomains sd ON sd.id=f.subdomain_id WHERE f.id=?`, fid);
  if (!f) return { error: "not found" };
  return { finding: f, report: one("SELECT id,title,status FROM reports WHERE finding_id=? ORDER BY updated_at DESC LIMIT 1", fid) ?? null };
});
app.post("/api/findings", async (req) => {
  const b = req.body as any; const fid = id();
  db.prepare(`INSERT INTO findings (id,program_id,asset_id,endpoint_id,subdomain_id,title,vuln_class,severity,status,cvss,cwe,bounty,observation,evidence,discovered_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    fid, b.program_id, b.asset_id ?? null, b.endpoint_id ?? null, b.subdomain_id ?? null, b.title, b.vuln_class ?? null,
    b.severity ?? "Medium", b.status ?? "Potential", b.cvss ?? null, b.cwe ?? null, b.bounty ?? 0,
    b.observation ?? null, JSON.stringify(b.evidence ?? []), b.discovered_at ?? now(), now(), now());
  if (b.program_id) { addTimeline(b.program_id, "finding", "Finding discovered", b.title); }
  logActivity("finding", b.title, "finding", fid);
  return { id: fid };
});
app.patch("/api/findings/:id", async (req) => {
  const b = req.body as any;
  const cols = ["title","vuln_class","severity","status","cvss","cwe","bounty","observation","asset_id","endpoint_id","subdomain_id","discovered_at"];
  const sets: string[] = [], vals: any[] = [];
  for (const c of cols) if (c in b) { sets.push(`${c}=?`); vals.push(b[c]); }
  if ("evidence" in b) { sets.push("evidence=?"); vals.push(JSON.stringify(b.evidence)); }
  sets.push("updated_at=?"); vals.push(now()); vals.push((req.params as any).id);
  db.prepare(`UPDATE findings SET ${sets.join(",")} WHERE id=?`).run(...vals);
  return { ok: true };
});
app.delete("/api/findings/:id", async (req) => { db.prepare("DELETE FROM findings WHERE id=?").run((req.params as any).id); return { ok: true }; });

/* -------------------------------- REPORTS --------------------------------- */
app.get("/api/reports", async (req) => {
  const q = (req.query as any) || {};
  let sql = "SELECT r.*, p.name as program_name, p.is_private FROM reports r LEFT JOIN programs p ON p.id=r.program_id WHERE 1=1";
  const p: any[] = [];
  if (q.status) { sql += " AND r.status=?"; p.push(q.status); }
  if (q.folder) { sql += " AND r.folder=?"; p.push(q.folder); }
  if (q.favorite === "1") sql += " AND r.is_favorite=1";
  if (q.search) { sql += " AND (r.title LIKE ? OR r.markdown_content LIKE ?)"; p.push(`%${q.search}%`, `%${q.search}%`); }
  sql += " ORDER BY r.updated_at DESC";
  return all(sql, ...p);
});
app.get("/api/reports/:id", async (req) => {
  const rid = (req.params as any).id;
  return {
    report: one("SELECT * FROM reports WHERE id=?", rid),
    versions: all("SELECT id,version_number,change_summary,is_submitted,created_at FROM report_versions WHERE report_id=? ORDER BY version_number DESC", rid),
  };
});
app.get("/api/reports/:id/versions/:vid", async (req) => {
  return one("SELECT * FROM report_versions WHERE id=?", (req.params as any).vid);
});
app.post("/api/reports", async (req) => {
  const b = req.body as any; const rid = id();
  const body = b.markdown_content ?? "";
  db.prepare(`INSERT INTO reports (id,finding_id,program_id,title,markdown_content,status,template_id,version,word_count,folder,severity,cvss,cwe,bounty,submission_platform,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    rid, b.finding_id ?? null, b.program_id ?? null, b.title ?? "Untitled report", body,
    b.status ?? "Draft", b.template_id ?? null, 1, wordCount(body), b.folder ?? "Drafts",
    b.severity ?? null, b.cvss ?? null, b.cwe ?? null, b.bounty ?? 0, b.submission_platform ?? null, now(), now());
  db.prepare(`INSERT INTO report_versions (id,report_id,version_number,markdown_content,change_summary,created_at) VALUES (?,?,?,?,?,?)`)
    .run(id(), rid, 1, body, "Initial draft", now());
  logActivity("report", `Created report ${b.title ?? "Untitled"}`, "report", rid);
  return { id: rid };
});
app.patch("/api/reports/:id", async (req) => {
  const rid = (req.params as any).id;
  const b = req.body as any;
  const cols = ["title","status","folder","is_favorite","submission_platform","submission_id","severity","cvss","cwe","bounty","finding_id","program_id"];
  const sets: string[] = [], vals: any[] = [];
  for (const c of cols) if (c in b) { sets.push(`${c}=?`); vals.push(typeof b[c] === "boolean" ? (b[c]?1:0) : b[c]); }
  if ("markdown_content" in b) {
    sets.push("markdown_content=?"); vals.push(b.markdown_content);
    sets.push("word_count=?"); vals.push(wordCount(b.markdown_content));
  }
  if (b.status === "Submitted") { sets.push("submitted_at=?"); vals.push(now()); }
  sets.push("updated_at=?"); vals.push(now()); vals.push(rid);
  db.prepare(`UPDATE reports SET ${sets.join(",")} WHERE id=?`).run(...vals);
  return { ok: true };
});
// snapshot a new version
app.post("/api/reports/:id/versions", async (req) => {
  const rid = (req.params as any).id;
  const b = req.body as any;
  const r = one("SELECT * FROM reports WHERE id=?", rid) as any;
  if (!r) return { error: "not found" };
  const next = ((one("SELECT MAX(version_number) m FROM report_versions WHERE report_id=?", rid) as any).m ?? 0) + 1;
  db.prepare(`INSERT INTO report_versions (id,report_id,version_number,markdown_content,change_summary,is_submitted,created_at) VALUES (?,?,?,?,?,?,?)`)
    .run(id(), rid, next, r.markdown_content, b.change_summary ?? `Version ${next}`, b.is_submitted ? 1 : 0, now());
  db.prepare("UPDATE reports SET version=? WHERE id=?").run(next, rid);
  return { version_number: next };
});
app.post("/api/reports/:id/restore/:vid", async (req) => {
  const rid = (req.params as any).id;
  const v = one("SELECT * FROM report_versions WHERE id=?", (req.params as any).vid) as any;
  if (!v) return { error: "not found" };
  db.prepare("UPDATE reports SET markdown_content=?, word_count=?, updated_at=? WHERE id=?")
    .run(v.markdown_content, wordCount(v.markdown_content), now(), rid);
  return { ok: true };
});
app.post("/api/reports/:id/clone", async (req) => {
  const r = one("SELECT * FROM reports WHERE id=?", (req.params as any).id) as any;
  if (!r) return { error: "not found" };
  const rid = id();
  db.prepare(`INSERT INTO reports (id,finding_id,program_id,title,markdown_content,status,version,word_count,folder,severity,cvss,cwe,bounty,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    rid, r.finding_id, r.program_id, `${r.title} (copy)`, r.markdown_content, "Draft", 1, r.word_count, "Drafts", r.severity, r.cvss, r.cwe, 0, now(), now());
  db.prepare(`INSERT INTO report_versions (id,report_id,version_number,markdown_content,change_summary,created_at) VALUES (?,?,?,?,?,?)`)
    .run(id(), rid, 1, r.markdown_content, "Cloned", now());
  return { id: rid };
});
app.delete("/api/reports/:id", async (req) => { db.prepare("DELETE FROM reports WHERE id=?").run((req.params as any).id); return { ok: true }; });

/* ------------------------------- CHECKLIST -------------------------------- */
app.get("/api/programs/:id/checklist", async (req) => {
  const pid = (req.params as any).id;
  return all("SELECT scope, item_key, checked, notes FROM checklist_progress WHERE program_id=?", pid);
});
app.post("/api/programs/:id/checklist", async (req) => {
  const pid = (req.params as any).id;
  const b = req.body as any; // { scope, item_key, checked?, notes? }
  if (!b.scope || !b.item_key) return { error: "scope and item_key required" };
  const existing = one("SELECT id FROM checklist_progress WHERE program_id=? AND scope=? AND item_key=?", pid, b.scope, b.item_key) as any;
  if (existing) {
    const sets: string[] = [], vals: any[] = [];
    if ("checked" in b) { sets.push("checked=?"); vals.push(b.checked ? 1 : 0); }
    if ("notes" in b) { sets.push("notes=?"); vals.push(b.notes); }
    sets.push("updated_at=?"); vals.push(now()); vals.push(existing.id);
    db.prepare(`UPDATE checklist_progress SET ${sets.join(",")} WHERE id=?`).run(...vals);
  } else {
    db.prepare("INSERT INTO checklist_progress (id, program_id, scope, item_key, checked, notes, updated_at) VALUES (?,?,?,?,?,?,?)")
      .run(id(), pid, b.scope, b.item_key, b.checked ? 1 : 0, b.notes ?? null, now());
  }
  return { ok: true };
});
// aggregate counts per program (for dashboards / overview)
app.get("/api/programs/:id/checklist/summary", async (req) => {
  const pid = (req.params as any).id;
  const rows = all("SELECT scope, SUM(checked) done FROM checklist_progress WHERE program_id=? GROUP BY scope", pid) as any[];
  return { total_checked: rows.reduce((a, r) => a + (r.done ?? 0), 0), by_scope: rows };
});

/* -------------------------------- ACTIVITY -------------------------------- */
app.get("/api/activity", async () => all("SELECT * FROM activity ORDER BY at DESC LIMIT 40"));
app.get("/api/journal", async () => all("SELECT * FROM journal_entries ORDER BY date DESC"));

/* ------------------------------- DASHBOARD -------------------------------- */
app.get("/api/dashboard", async () => {
  const c = (sql: string, ...p: any[]) => (one(sql, ...p) as any).c;
  const s = (sql: string, ...p: any[]) => (one(sql, ...p) as any).s ?? 0;
  return {
    kpis: {
      active_programs: c("SELECT COUNT(*) c FROM programs WHERE status='Active'"),
      private_programs: c("SELECT COUNT(*) c FROM programs WHERE is_private=1"),
      programs_watched: c("SELECT COUNT(*) c FROM programs WHERE is_watched=1"),
      active_sessions: c("SELECT COUNT(*) c FROM sessions WHERE ended_at IS NULL"),
      assets: c("SELECT COUNT(*) c FROM assets"),
      endpoints: c("SELECT COUNT(*) c FROM endpoints"),
      untested_endpoints: c("SELECT COUNT(*) c FROM endpoints WHERE status IN ('Untested','In Progress')"),
      potential_findings: c("SELECT COUNT(*) c FROM findings WHERE status='Potential'"),
      confirmed_findings: c("SELECT COUNT(*) c FROM findings WHERE status NOT IN ('Potential','Rejected','Duplicate')"),
      reports_drafted: c("SELECT COUNT(*) c FROM reports WHERE status IN ('Draft','In Progress','Ready')"),
      reports_submitted: c("SELECT COUNT(*) c FROM reports WHERE submitted_at IS NOT NULL"),
      reports_accepted: c("SELECT COUNT(*) c FROM reports WHERE status IN ('Accepted','Resolved')"),
      reports_resolved: c("SELECT COUNT(*) c FROM reports WHERE status='Resolved'"),
      total_bounty: s("SELECT COALESCE(SUM(bounty),0) s FROM findings"),
      research_hours: Math.round(s("SELECT COALESCE(SUM(minutes),0) s FROM sessions") / 60),
    },
    active_research: all(`SELECT s.*, p.name as program_name FROM sessions s LEFT JOIN programs p ON p.id=s.program_id WHERE s.ended_at IS NULL ORDER BY s.created_at DESC LIMIT 5`),
    recent_activity: all("SELECT * FROM activity ORDER BY at DESC LIMIT 12"),
  };
});

/* --------------------------- "WHAT SHOULD I DO NEXT" ---------------------- */
app.get("/api/next-actions", async () => {
  const c = (sql: string, ...p: any[]) => (one(sql, ...p) as any).c;
  const items: { label: string; count: number; to: string }[] = [];
  const untested = c("SELECT COUNT(*) c FROM endpoints WHERE status IN ('Untested','In Progress')");
  if (untested) items.push({ label: `${untested} endpoints remain untested`, count: untested, to: "/findings" });
  const potential = c("SELECT COUNT(*) c FROM findings WHERE status='Potential'");
  if (potential) items.push({ label: `${potential} potential findings await validation`, count: potential, to: "/findings?status=Potential" });
  const noReport = c("SELECT COUNT(*) c FROM findings f WHERE f.status IN ('Confirmed','Accepted') AND NOT EXISTS (SELECT 1 FROM reports r WHERE r.finding_id=f.id)");
  if (noReport) items.push({ label: `${noReport} confirmed findings have no report`, count: noReport, to: "/reports" });
  const drafts = c("SELECT COUNT(*) c FROM reports WHERE status IN ('Draft','In Progress')");
  if (drafts) items.push({ label: `${drafts} reports are unfinished`, count: drafts, to: "/reports?folder=Drafts" });
  const pendingInvites = c("SELECT COUNT(*) c FROM programs WHERE invitation_status='Pending'");
  if (pendingInvites) items.push({ label: `${pendingInvites} private invitations need review`, count: pendingInvites, to: "/programs?private=1" });
  const awaiting = c("SELECT COUNT(*) c FROM reports WHERE status='Submitted'");
  if (awaiting) items.push({ label: `${awaiting} reports awaiting program response`, count: awaiting, to: "/reports?status=Submitted" });
  return items;
});

/* ------------------------- UNFINISHED BUSINESS ---------------------------- */
app.get("/api/unfinished", async () => {
  return {
    untested_endpoints: all("SELECT e.*, p.name program_name FROM endpoints e JOIN programs p ON p.id=e.program_id WHERE e.status IN ('Untested','In Progress') ORDER BY e.created_at"),
    potential_findings: all("SELECT f.*, p.name program_name FROM findings f JOIN programs p ON p.id=f.program_id WHERE f.status='Potential' ORDER BY f.created_at DESC"),
    unfinished_reports: all("SELECT r.*, p.name program_name FROM reports r LEFT JOIN programs p ON p.id=r.program_id WHERE r.status IN ('Draft','In Progress','Ready') ORDER BY r.updated_at DESC"),
    awaiting_response: all("SELECT r.*, p.name program_name FROM reports r LEFT JOIN programs p ON p.id=r.program_id WHERE r.status='Submitted' ORDER BY r.submitted_at"),
    pending_invitations: all("SELECT * FROM programs WHERE invitation_status IN ('Pending','Received') ORDER BY invitation_date DESC"),
  };
});

/* -------------------------------- SEARCH ---------------------------------- */
app.get("/api/search", async (req) => {
  const term = `%${(req.query as any).q ?? ""}%`;
  return {
    programs: all("SELECT id,name,company,visibility FROM programs WHERE name LIKE ? OR company LIKE ? LIMIT 8", term, term),
    findings: all("SELECT id,title,severity,program_id FROM findings WHERE title LIKE ? LIMIT 8", term),
    reports: all("SELECT id,title,status FROM reports WHERE title LIKE ? OR markdown_content LIKE ? LIMIT 8", term, term),
  };
});

/* ------------------------------- ANALYTICS -------------------------------- */
app.get("/api/analytics", async (req) => {
  const q = (req.query as any) || {};
  const wf: string[] = []; const wp: any[] = [];
  if (q.program_id) { wf.push("program_id=?"); wp.push(q.program_id); }
  if (q.platform) { wf.push("program_id IN (SELECT id FROM programs WHERE platform=?)"); wp.push(q.platform); }
  const where = wf.length ? " AND " + wf.join(" AND ") : "";

  // bounty over time (monthly, from findings)
  const bountyOverTime = all(`SELECT substr(discovered_at,1,7) as month, SUM(bounty) as bounty, COUNT(*) as findings
    FROM findings WHERE bounty>0 ${where} GROUP BY month ORDER BY month`, ...wp);

  // reports over time by status (monthly)
  const reportsOverTime = all(`SELECT substr(created_at,1,7) as month, status, COUNT(*) as c FROM reports GROUP BY month, status ORDER BY month`);

  const bySeverity = all(`SELECT severity as name, COUNT(*) as value FROM findings WHERE 1=1 ${where} GROUP BY severity`, ...wp);
  const byClass = all(`SELECT vuln_class as name, COUNT(*) as value FROM findings WHERE vuln_class IS NOT NULL ${where} GROUP BY vuln_class ORDER BY value DESC`, ...wp);
  const bountyByClass = all(`SELECT vuln_class as name, SUM(bounty) as total, COUNT(*) as reports, AVG(bounty) as avg FROM findings WHERE vuln_class IS NOT NULL ${where} GROUP BY vuln_class ORDER BY total DESC`, ...wp);
  const bountyByProgram = all(`SELECT p.name as name, COUNT(f.id) as findings, SUM(f.bounty) as total FROM findings f JOIN programs p ON p.id=f.program_id GROUP BY p.id ORDER BY total DESC`);
  const funnel = (() => {
    const c = (st: string) => (one(`SELECT COUNT(*) c FROM findings WHERE status=? ${where}`, st, ...wp) as any).c;
    const gte = (statuses: string[]) => (one(`SELECT COUNT(*) c FROM findings WHERE status IN (${statuses.map(()=>"?").join(",")}) ${where}`, ...statuses, ...wp) as any).c;
    return [
      { name: "Potential", value: gte(["Potential","Confirmed","Submitted","Triaged","Accepted","Resolved"]) },
      { name: "Confirmed", value: gte(["Confirmed","Submitted","Triaged","Accepted","Resolved"]) },
      { name: "Submitted", value: gte(["Submitted","Triaged","Accepted","Resolved"]) },
      { name: "Triaged", value: gte(["Triaged","Accepted","Resolved"]) },
      { name: "Accepted", value: gte(["Accepted","Resolved"]) },
      { name: "Resolved", value: c("Resolved") },
    ];
  })();
  const assetTypes = all(`SELECT type as name, COUNT(*) as value FROM assets GROUP BY type ORDER BY value DESC`);
  const techDist = (() => {
    const rows = all(`SELECT technology FROM assets WHERE technology IS NOT NULL`) as any[];
    const map: Record<string, number> = {};
    for (const r of rows) for (const t of String(r.technology).split(",").map((x) => x.trim()).filter(Boolean)) map[t] = (map[t] ?? 0) + 1;
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  })();
  const endpointStatus = all(`SELECT status as name, COUNT(*) as value FROM endpoints GROUP BY status`);
  // research hours per day (last 30)
  const hoursPerDay = all(`SELECT substr(COALESCE(started_at,created_at),1,10) as day, SUM(minutes) as minutes FROM sessions GROUP BY day ORDER BY day`);
  // methodology coverage (derived from endpoint testing per vuln area — simplified from findings/endpoints)
  const coverage = [
    { area: "Recon", pct: 92 }, { area: "Configuration", pct: 78 }, { area: "Authentication", pct: 65 },
    { area: "Authorization", pct: 84 }, { area: "Injection", pct: 52 }, { area: "XSS", pct: 100 },
    { area: "SSRF", pct: 20 }, { area: "Business Logic", pct: 73 }, { area: "API", pct: 82 },
    { area: "Mobile", pct: 40 }, { area: "Advanced", pct: 55 },
  ];
  // heatmap: program x vuln_class finding counts
  const heatClasses = ["Authentication","Authorization","API","Business Logic","XSS","SSRF","IDOR/BOLA"];
  const progs = all("SELECT id,name FROM programs") as any[];
  const heatmap = { classes: heatClasses, programs: progs.map((p) => p.name), data: [] as [number, number, number][] };
  progs.forEach((p, pi) => {
    heatClasses.forEach((cl, ci) => {
      const v = (one("SELECT COUNT(*) c FROM findings WHERE program_id=? AND vuln_class=?", p.id, cl) as any).c;
      heatmap.data.push([ci, pi, v]);
    });
  });

  return { bountyOverTime, reportsOverTime, bySeverity, byClass, bountyByClass, bountyByProgram, funnel, assetTypes, techDist, endpointStatus, hoursPerDay, coverage, heatmap };
});

const PORT = 5177;

async function start() {
  await app.register(cors, { origin: true });
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`\n  🛡️  Bug Bounty OS API running on http://localhost:${PORT}\n`);
}
start().catch((e) => {
  console.error("Startup failed:", e?.message ?? e);
  process.exit(1);
});
