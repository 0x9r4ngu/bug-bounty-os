#!/usr/bin/env python3
"""
Bug Bounty OS — local, single-user security-research tracker.
Pure Python standard library (http.server + sqlite3). No external deps, no build step.
"""
import json, sqlite3, os, re, secrets, time, urllib.request, ssl
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, "web")
DATA_DIR = os.path.join(ROOT, "data")
DB_PATH = os.path.join(DATA_DIR, "bugbounty.db")
PORT = int(os.environ.get("PORT", "8787"))

os.makedirs(DATA_DIR, exist_ok=True)


# ─── db ────────────────────────────────────────────────────────────────────
def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA foreign_keys=ON")
    return con


def nid():
    return secrets.token_hex(6)


def now():
    return datetime.now(timezone.utc).isoformat()


SCHEMA = """
CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, company TEXT, platform TEXT,
  visibility TEXT DEFAULT 'PUBLIC', status TEXT DEFAULT 'Active', is_private INTEGER DEFAULT 0,
  is_watched INTEGER DEFAULT 0, invitation_status TEXT, invitation_source TEXT, invitation_date TEXT,
  program_url TEXT, rules TEXT, rewards TEXT, tags TEXT, notes TEXT DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL, type TEXT DEFAULT 'Web', url TEXT, technology TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS subdomains (
  id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  host TEXT NOT NULL, status TEXT DEFAULT 'Unknown', http_code INTEGER, title TEXT,
  created_at TEXT NOT NULL, UNIQUE(asset_id, host));
CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  subdomain_id TEXT REFERENCES subdomains(id) ON DELETE SET NULL,
  title TEXT NOT NULL, vuln_class TEXT, severity TEXT DEFAULT 'Medium', status TEXT DEFAULT 'Potential',
  cvss REAL, cwe TEXT, bounty REAL DEFAULT 0, observation TEXT,
  discovered_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, finding_id TEXT REFERENCES findings(id) ON DELETE SET NULL,
  program_id TEXT REFERENCES programs(id) ON DELETE SET NULL,
  title TEXT NOT NULL, body TEXT DEFAULT '', status TEXT DEFAULT 'Draft', folder TEXT DEFAULT 'Drafts',
  severity TEXT, cvss REAL, cwe TEXT, bounty REAL DEFAULT 0, is_favorite INTEGER DEFAULT 0,
  submission_platform TEXT, word_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, submitted_at TEXT);
CREATE TABLE IF NOT EXISTS checklist_progress (
  id TEXT PRIMARY KEY, program_id TEXT REFERENCES programs(id) ON DELETE CASCADE,
  scope TEXT NOT NULL, item_key TEXT NOT NULL, checked INTEGER DEFAULT 0, notes TEXT,
  updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS i_check_uniq ON checklist_progress(program_id, scope, item_key);
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY, type TEXT, title TEXT NOT NULL, entity_type TEXT, entity_id TEXT, at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS timeline (
  id TEXT PRIMARY KEY, program_id TEXT REFERENCES programs(id) ON DELETE CASCADE,
  title TEXT NOT NULL, detail TEXT, at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS i_asset_prog ON assets(program_id);
CREATE INDEX IF NOT EXISTS i_sub_prog ON subdomains(program_id);
CREATE INDEX IF NOT EXISTS i_find_prog ON findings(program_id);
CREATE INDEX IF NOT EXISTS i_rep_prog ON reports(program_id);
"""


def migrate():
    con = db()
    con.executescript(SCHEMA)
    con.commit()
    con.close()


def log(con, typ, title, etype=None, eid=None):
    con.execute("INSERT INTO activity (id,type,title,entity_type,entity_id,at) VALUES (?,?,?,?,?,?)",
                (nid(), typ, title, etype, eid, now()))


def tl(con, pid, title, detail=None):
    con.execute("INSERT INTO timeline (id,program_id,title,detail,at) VALUES (?,?,?,?,?)",
                (nid(), pid, title, detail, now()))


def days_ago(n):
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


def seed():
    con = db()
    if con.execute("SELECT COUNT(*) c FROM programs").fetchone()["c"] > 0:
        con.close(); return
    P = [
        ("Acme Cloud", "Acme Inc.", "HackerOne", "PUBLIC", 0, 1, None, "*.acme.com, api.acme.com",
         "Critical $5000 / High $2000 / Medium $600", "cloud,api,oauth"),
        ("Nimbus Pay", "Nimbus Financial", "Bugcrowd", "PRIVATE", 1, 1, "Accepted", "app.nimbuspay.com",
         "Critical $8000 / High $3000", "fintech,private,api"),
        ("Orbit Social", "Orbit Labs", "Intigriti", "VDP", 0, 0, None, "orbit.social",
         "Swag / points", "social,web"),
        ("Vertex API", "Vertex Systems", "Private", "INVITE_ONLY", 1, 1, "Pending", "TBD",
         "Up to $10000", "private,invite,api"),
    ]
    pids = []
    for name, comp, plat, vis, priv, watch, inv, scope, rew, tags in P:
        pid = nid(); pids.append(pid)
        con.execute("""INSERT INTO programs (id,name,company,platform,visibility,status,is_private,is_watched,
            invitation_status,rewards,tags,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (pid, name, comp, plat, vis, "Active", priv, watch, inv, rew, tags,
             "# Notes\n\n- OAuth flow\n- API authorization\n", days_ago(40), now()))
        tl(con, pid, "Program added", name)
        log(con, "program", f"Added program {name}", "program", pid)
    # assets
    A = [(0, "app.acme.com", "Web", "React, Next.js, Cloudflare"), (0, "api.acme.com", "API", "Node.js, Nginx, AWS"),
         (1, "app.nimbuspay.com", "Web", "React, Spring, AWS"), (1, "api.nimbuspay.com", "API", "Java, GraphQL"),
         (2, "orbit.social", "Web", "Laravel, Vue")]
    aids = {}
    for i, (pi, nm, ty, tech) in enumerate(A):
        aid = nid(); aids[i] = aid
        con.execute("INSERT INTO assets (id,program_id,name,type,url,technology,created_at) VALUES (?,?,?,?,?,?,?)",
                    (aid, pids[pi], nm, ty, "https://" + nm, tech, days_ago(30)))
    for h, st, code in [("www.acme.com", "Live", 200), ("admin.acme.com", "Redirect", 302), ("dev.acme.com", "Offline", None)]:
        con.execute("INSERT INTO subdomains (id,asset_id,program_id,host,status,http_code,created_at) VALUES (?,?,?,?,?,?,?)",
                    (nid(), aids[0], pids[0], h, st, code, days_ago(20)))
    # findings
    F = [(0, 1, "IDOR on /orders/{id} exposes PII", "IDOR/BOLA", "High", "Resolved", 8.1, "CWE-639", 2000, 35),
         (0, 1, "Privilege escalation via role PUT", "Authorization", "Critical", "Accepted", 9.1, "CWE-269", 5000, 22),
         (0, 0, "Reflected XSS in search", "XSS", "Medium", "Submitted", 6.1, "CWE-79", 0, 12),
         (0, 1, "OAuth token leak via open redirect", "OAuth", "High", "Triaged", 7.4, "CWE-601", 0, 6),
         (1, 3, "BOLA on payouts endpoint", "IDOR/BOLA", "Critical", "Confirmed", 9.0, "CWE-639", 0, 4),
         (1, 3, "Race condition on /transfers", "Race Condition", "High", "Potential", 7.5, "CWE-362", 0, 2),
         (2, 4, "CSRF on profile update", "CSRF", "Low", "Resolved", 4.3, "CWE-352", 0, 30),
         (0, 1, "SSRF via webhook URL", "SSRF", "High", "Potential", 8.2, "CWE-918", 0, 1)]
    fids = []
    for pi, ai, title, vc, sev, stt, cvss, cwe, bounty, d in F:
        fid = nid(); fids.append(fid)
        con.execute("""INSERT INTO findings (id,program_id,asset_id,title,vuln_class,severity,status,cvss,cwe,bounty,
            observation,discovered_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (fid, pids[pi], aids[ai], title, vc, sev, stt, cvss, cwe, bounty,
             "Observed during authenticated testing with two accounts.", days_ago(d), days_ago(d), now()))
        tl(con, pids[pi], "Finding discovered", title)
        log(con, "finding", title, "finding", fid)
    # reports
    body = ("# {t}\n\n## Summary\n\nAn authorization flaw allows access to other users' resources.\n\n"
            "## Affected Asset\n\n`api.acme.com`\n\n## Severity\n\n{s}\n\n## Steps to Reproduce\n\n"
            "1. Authenticate as User A\n2. Capture the request\n3. Swap the object id for User B's\n\n"
            "## Proof of Concept\n\n```http\nGET /api/v2/orders/1042 HTTP/2\nHost: api.acme.com\n"
            "Authorization: Bearer [REDACTED]\n```\n\n## Impact\n\nAny authenticated user can read other users' PII.\n\n"
            "## Remediation\n\nEnforce object-level authorization on every request.\n")
    R = [(0, "IDOR on Orders Endpoint", "Resolved", "Resolved", "High", 2000, 34),
         (1, "Privilege Escalation via Role", "Accepted", "Accepted", "Critical", 5000, 21),
         (2, "Reflected XSS in Search", "Submitted", "Submitted", "Medium", 0, 11),
         (4, "BOLA on Nimbus Payouts", "Draft", "Drafts", "Critical", 0, -1)]
    for fi, title, stt, folder, sev, bounty, sub in R:
        rid = nid(); f = F[fi]; b = body.format(t=title, s=sev)
        con.execute("""INSERT INTO reports (id,finding_id,program_id,title,body,status,folder,severity,bounty,
            submission_platform,word_count,created_at,updated_at,submitted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (rid, fids[fi], pids[f[0]], title, b, stt, folder, sev, bounty, "HackerOne",
             len(b.split()), days_ago(sub + 3 if sub >= 0 else 5), now(), days_ago(sub) if sub >= 0 else None))
        log(con, "report", f"Report: {title}", "report", rid)
    con.execute("""INSERT INTO journal (id,date,programs_worked,hours,tested,found,interesting,tomorrow,created_at)
        VALUES (?,?,?,?,?,?,?,?,?)""", (nid(), datetime.now().strftime("%Y-%m-%d"), "Acme Cloud", 2.5,
        "API authorization on /api/v2", "Potential SSRF via webhook", "GraphQL introspection enabled",
        "Test admin reports endpoint", now()))
    con.commit(); con.close()


# ─── helpers ───────────────────────────────────────────────────────────────
def rows(cur):
    return [dict(r) for r in cur.fetchall()]


def one(cur):
    r = cur.fetchone()
    return dict(r) if r else None


def word_count(s):
    return len(s.split()) if s and s.strip() else 0


def clean_host(h):
    h = h.strip().lower()
    h = re.sub(r"^https?://", "", h)
    h = re.sub(r"/.*$", "", h)
    return h.strip(" ,")


def guess_type(h):
    if re.search(r"graphql", h, re.I): return "GraphQL"
    if re.search(r"(^|\.)api\.|api\.", h, re.I): return "API"
    if re.search(r"android|apk", h, re.I): return "Android"
    if re.search(r"ios|apple|testflight", h, re.I): return "iOS"
    return "Web"


def probe_host(host):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    for scheme in ("https", "http"):
        try:
            req = urllib.request.Request(f"{scheme}://{host}", headers={"User-Agent": "BugBountyOS-probe"},
                                         method="GET")
            with urllib.request.urlopen(req, timeout=4, context=ctx) as r:
                code = r.status
                title = None
                try:
                    html = r.read(4000).decode("utf-8", "replace")
                    m = re.search(r"<title[^>]*>([^<]{1,120})</title>", html, re.I)
                    title = m.group(1).strip() if m else None
                except Exception:
                    pass
                status = "Redirect" if 300 <= code < 400 else "Live"
                return status, code, title
        except urllib.error.HTTPError as e:
            return "Live", e.code, None
        except Exception:
            continue
    return "Offline", None, None


PROBE_POOL = ThreadPoolExecutor(max_workers=8)


# ─── API ───────────────────────────────────────────────────────────────────
class API:
    routes = []

    @classmethod
    def route(cls, method, pattern):
        rx = re.compile("^" + re.sub(r":(\w+)", r"(?P<\1>[^/]+)", pattern) + "$")
        def deco(fn):
            cls.routes.append((method, rx, fn))
            return fn
        return deco


R = API.route


class BadRequest(Exception):
    """Raised for invalid client input; surfaced as HTTP 400."""


def require(b, *keys):
    missing = [k for k in keys if not b.get(k)]
    if missing:
        raise BadRequest("Missing required field: " + ", ".join(missing))


def _report_body_from_finding(f, target):
    return (f"# {f['title']}\n\n## Summary\n\n{f.get('observation') or 'A concise, impact-first description.'}\n\n"
            f"## Affected Asset\n\n{target}\n\n## Severity\n\n{f['severity']}\n\n## Steps to Reproduce\n\n1. \n2. \n3. \n\n"
            f"## Proof of Concept\n\n```http\nGET /path HTTP/2\nHost: example.com\nAuthorization: Bearer [REDACTED]\n```\n\n"
            f"## Impact\n\n\n\n## Remediation\n\n\n\n## References\n\n{('- ' + f['cwe']) if f.get('cwe') else ''}\n")


@R("GET", "/api/overview")
def overview(h, m):
    con = db()
    c = lambda q, *a: con.execute(q, a).fetchone()["c"]
    s = lambda q, *a: con.execute(q, a).fetchone()["s"] or 0
    kpis = {
        "total_bounty": s("SELECT COALESCE(SUM(bounty),0) s FROM findings"),
        "findings": c("SELECT COUNT(*) c FROM findings"),
        "confirmed": c("SELECT COUNT(*) c FROM findings WHERE status NOT IN ('Potential','Rejected','Duplicate')"),
        "programs": c("SELECT COUNT(*) c FROM programs WHERE status='Active'"),
        "private": c("SELECT COUNT(*) c FROM programs WHERE is_private=1"),
        "reports": c("SELECT COUNT(*) c FROM reports"),
        "submitted": c("SELECT COUNT(*) c FROM reports WHERE submitted_at IS NOT NULL"),
        "assets": c("SELECT COUNT(*) c FROM assets"),
    }
    trend = rows(con.execute("""SELECT substr(discovered_at,1,7) month, SUM(bounty) bounty FROM findings
        WHERE bounty>0 GROUP BY month ORDER BY month"""))
    by_sev = rows(con.execute("SELECT severity name, COUNT(*) value FROM findings GROUP BY severity"))
    recent = rows(con.execute("""SELECT f.*, p.name program_name FROM findings f JOIN programs p ON p.id=f.program_id
        ORDER BY f.created_at DESC LIMIT 6"""))
    activity = rows(con.execute("SELECT * FROM activity ORDER BY at DESC LIMIT 8"))
    nxt = []
    def add(n, label, to):
        if n: nxt.append({"count": n, "label": label, "to": to})
    add(c("SELECT COUNT(*) c FROM findings WHERE status='Potential'"), "potential findings to validate", "#/findings?status=Potential")
    add(c("SELECT COUNT(*) c FROM reports WHERE status IN ('Draft','In Progress')"), "reports unfinished", "#/reports?folder=Drafts")
    add(c("SELECT COUNT(*) c FROM reports WHERE status='Submitted'"), "reports awaiting response", "#/reports?status=Submitted")
    add(c("SELECT COUNT(*) c FROM programs WHERE invitation_status='Pending'"), "private invitations to review", "#/programs?private=1")
    con.close()
    return {"kpis": kpis, "trend": trend, "by_severity": by_sev, "recent": recent, "activity": activity, "next": nxt}


@R("GET", "/api/programs")
def list_programs(h, m):
    con = db(); q = h.query
    sql = "SELECT * FROM programs WHERE 1=1"; args = []
    if q.get("private") == ["1"]: sql += " AND is_private=1"
    if q.get("public") == ["1"]: sql += " AND is_private=0"
    if q.get("watched") == ["1"]: sql += " AND is_watched=1"
    sql += " ORDER BY updated_at DESC"
    res = rows(con.execute(sql, args))
    for r in res:
        r["asset_count"] = con.execute("SELECT COUNT(*) c FROM assets WHERE program_id=?", (r["id"],)).fetchone()["c"]
        r["finding_count"] = con.execute("SELECT COUNT(*) c FROM findings WHERE program_id=?", (r["id"],)).fetchone()["c"]
        r["report_count"] = con.execute("SELECT COUNT(*) c FROM reports WHERE program_id=?", (r["id"],)).fetchone()["c"]
    con.close(); return res


@R("GET", "/api/programs/:id")
def get_program(h, m):
    con = db(); pid = m["id"]
    p = one(con.execute("SELECT * FROM programs WHERE id=?", (pid,)))
    if not p: con.close(); return {"error": "not found"}
    out = {
        "program": p,
        "assets": rows(con.execute("SELECT * FROM assets WHERE program_id=? ORDER BY created_at", (pid,))),
        "subdomains": rows(con.execute("SELECT * FROM subdomains WHERE program_id=? ORDER BY host", (pid,))),
        "findings": rows(con.execute("""SELECT f.*, sd.host subdomain_host FROM findings f
            LEFT JOIN subdomains sd ON sd.id=f.subdomain_id WHERE f.program_id=? ORDER BY f.created_at DESC""", (pid,))),
        "reports": rows(con.execute("SELECT * FROM reports WHERE program_id=? ORDER BY updated_at DESC", (pid,))),
        "timeline": rows(con.execute("SELECT * FROM timeline WHERE program_id=? ORDER BY at DESC", (pid,))),
    }
    con.close(); return out


@R("POST", "/api/programs")
def create_program(h, m):
    b = h.body; con = db(); pid = nid()
    priv = 1 if b.get("visibility") not in ("PUBLIC", "VDP") else 0
    con.execute("""INSERT INTO programs (id,name,company,platform,visibility,status,is_private,is_watched,
        invitation_status,invitation_source,program_url,rules,rewards,tags,notes,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (pid, b.get("name") or "Untitled", b.get("company"), b.get("platform"), b.get("visibility", "PUBLIC"),
         "Active", priv, 1 if b.get("is_watched") else 0, b.get("invitation_status"), b.get("invitation_source"),
         b.get("program_url"), b.get("rules"), b.get("rewards"), b.get("tags"), b.get("notes", ""), now(), now()))
    tl(con, pid, "Program added", b.get("name")); log(con, "program", f"Added program {b.get('name')}", "program", pid)
    # scope hosts -> assets
    for hraw in re.split(r"[\n,]+", b.get("assets", "") or ""):
        host = clean_host(hraw)
        if host:
            con.execute("INSERT INTO assets (id,program_id,name,type,url,created_at) VALUES (?,?,?,?,?,?)",
                        (nid(), pid, host, guess_type(host), "https://" + host, now()))
    con.commit(); con.close(); return {"id": pid}


@R("PATCH", "/api/programs/:id")
def patch_program(h, m):
    b = h.body; con = db()
    cols = ["name", "company", "platform", "visibility", "status", "is_watched", "invitation_status",
            "invitation_source", "program_url", "rules", "rewards", "tags", "notes"]
    sets, args = [], []
    for c in cols:
        if c in b:
            sets.append(f"{c}=?"); args.append(int(b[c]) if isinstance(b[c], bool) else b[c])
    if "visibility" in b:
        sets.append("is_private=?"); args.append(0 if b["visibility"] in ("PUBLIC", "VDP") else 1)
    sets.append("updated_at=?"); args.append(now()); args.append(m["id"])
    con.execute(f"UPDATE programs SET {','.join(sets)} WHERE id=?", args)
    con.commit(); con.close(); return {"ok": True}


@R("DELETE", "/api/programs/:id")
def del_program(h, m):
    con = db(); con.execute("DELETE FROM programs WHERE id=?", (m["id"],)); con.commit(); con.close(); return {"ok": True}


# assets
@R("POST", "/api/assets")
def create_asset(h, m):
    b = h.body; require(b, "program_id", "name"); con = db(); aid = nid()
    con.execute("INSERT INTO assets (id,program_id,name,type,url,technology,created_at) VALUES (?,?,?,?,?,?,?)",
                (aid, b["program_id"], b["name"], b.get("type", "Web"), b.get("url"), b.get("technology"), now()))
    con.commit(); con.close(); return {"id": aid}


@R("PATCH", "/api/assets/:id")
def patch_asset(h, m):
    b = h.body; con = db(); sets, args = [], []
    for c in ["name", "type", "url", "technology"]:
        if c in b: sets.append(f"{c}=?"); args.append(b[c])
    if sets:
        args.append(m["id"]); con.execute(f"UPDATE assets SET {','.join(sets)} WHERE id=?", args); con.commit()
    con.close(); return {"ok": True}


@R("DELETE", "/api/assets/:id")
def del_asset(h, m):
    con = db(); con.execute("DELETE FROM assets WHERE id=?", (m["id"],)); con.commit(); con.close(); return {"ok": True}


# subdomains
@R("POST", "/api/assets/:id/subdomains")
def add_subs(h, m):
    b = h.body; con = db()
    a = one(con.execute("SELECT * FROM assets WHERE id=?", (m["id"],)))
    if not a: con.close(); return {"error": "asset not found"}
    hosts = b["hosts"] if isinstance(b.get("hosts"), list) else re.split(r"[\n,]+", b.get("hosts", "") or "")
    seen = set(); added = 0
    for raw in hosts:
        host = clean_host(raw)
        if host and host not in seen:
            seen.add(host)
            try:
                con.execute("INSERT INTO subdomains (id,asset_id,program_id,host,status,created_at) VALUES (?,?,?,?,?,?)",
                            (nid(), a["id"], a["program_id"], host, "Unknown", now())); added += 1
            except sqlite3.IntegrityError:
                pass
    con.commit(); con.close(); return {"added": added}


@R("POST", "/api/assets/:id/subdomains/probe")
def probe_subs(h, m):
    con = db(); subs = rows(con.execute("SELECT * FROM subdomains WHERE asset_id=?", (m["id"],)))
    results = list(PROBE_POOL.map(lambda s: (s["id"],) + probe_host(s["host"]), subs))
    for sid, status, code, title in results:
        con.execute("UPDATE subdomains SET status=?,http_code=?,title=? WHERE id=?", (status, code, title, sid))
    con.commit()
    out = rows(con.execute("SELECT * FROM subdomains WHERE asset_id=? ORDER BY host", (m["id"],)))
    con.close(); return {"probed": len(subs), "subdomains": out}


@R("PATCH", "/api/subdomains/:id")
def patch_sub(h, m):
    b = h.body; con = db(); sets, args = [], []
    for c in ["status", "http_code", "title"]:
        if c in b: sets.append(f"{c}=?"); args.append(b[c])
    if sets:
        args.append(m["id"]); con.execute(f"UPDATE subdomains SET {','.join(sets)} WHERE id=?", args); con.commit()
    con.close(); return {"ok": True}


@R("DELETE", "/api/subdomains/:id")
def del_sub(h, m):
    con = db(); con.execute("DELETE FROM subdomains WHERE id=?", (m["id"],)); con.commit(); con.close(); return {"ok": True}


# findings
@R("GET", "/api/findings")
def list_findings(h, m):
    con = db(); q = h.query
    sql = """SELECT f.*, p.name program_name, p.is_private, a.name asset_name, sd.host subdomain_host
             FROM findings f JOIN programs p ON p.id=f.program_id
             LEFT JOIN assets a ON a.id=f.asset_id LEFT JOIN subdomains sd ON sd.id=f.subdomain_id WHERE 1=1"""
    args = []
    for k in ("severity", "status", "vuln_class", "program_id"):
        if q.get(k): sql += f" AND f.{k}=?"; args.append(q[k][0])
    sql += " ORDER BY f.created_at DESC"
    res = rows(con.execute(sql, args)); con.close(); return res


@R("GET", "/api/findings/:id")
def get_finding(h, m):
    con = db()
    f = one(con.execute("""SELECT f.*, p.name program_name, a.name asset_name, sd.host subdomain_host
        FROM findings f JOIN programs p ON p.id=f.program_id LEFT JOIN assets a ON a.id=f.asset_id
        LEFT JOIN subdomains sd ON sd.id=f.subdomain_id WHERE f.id=?""", (m["id"],)))
    rep = one(con.execute("SELECT id,title,status FROM reports WHERE finding_id=? ORDER BY updated_at DESC LIMIT 1", (m["id"],)))
    con.close(); return {"finding": f, "report": rep}


@R("POST", "/api/findings")
def create_finding(h, m):
    b = h.body; require(b, "program_id", "title"); con = db(); fid = nid()
    con.execute("""INSERT INTO findings (id,program_id,asset_id,subdomain_id,title,vuln_class,severity,status,cvss,cwe,
        bounty,observation,discovered_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (fid, b["program_id"], b.get("asset_id"), b.get("subdomain_id"), b["title"], b.get("vuln_class"),
         b.get("severity", "Medium"), b.get("status", "Potential"), b.get("cvss"), b.get("cwe"),
         b.get("bounty", 0), b.get("observation"), b.get("discovered_at") or now(), now(), now()))
    tl(con, b["program_id"], "Finding discovered", b["title"]); log(con, "finding", b["title"], "finding", fid)
    con.commit(); con.close(); return {"id": fid}


@R("PATCH", "/api/findings/:id")
def patch_finding(h, m):
    b = h.body; con = db(); sets, args = [], []
    for c in ["title", "vuln_class", "severity", "status", "cvss", "cwe", "bounty", "observation", "asset_id", "subdomain_id"]:
        if c in b: sets.append(f"{c}=?"); args.append(b[c])
    sets.append("updated_at=?"); args.append(now()); args.append(m["id"])
    con.execute(f"UPDATE findings SET {','.join(sets)} WHERE id=?", args); con.commit(); con.close(); return {"ok": True}


@R("DELETE", "/api/findings/:id")
def del_finding(h, m):
    con = db(); con.execute("DELETE FROM findings WHERE id=?", (m["id"],)); con.commit(); con.close(); return {"ok": True}


# reports
@R("GET", "/api/reports")
def list_reports(h, m):
    con = db(); q = h.query
    sql = """SELECT r.*, p.name program_name, p.is_private FROM reports r LEFT JOIN programs p ON p.id=r.program_id WHERE 1=1"""
    args = []
    if q.get("status"): sql += " AND r.status=?"; args.append(q["status"][0])
    if q.get("folder"): sql += " AND r.folder=?"; args.append(q["folder"][0])
    if q.get("favorite") == ["1"]: sql += " AND r.is_favorite=1"
    if q.get("search"):
        sql += " AND (r.title LIKE ? OR r.body LIKE ?)"; args += ["%" + q["search"][0] + "%"] * 2
    sql += " ORDER BY r.updated_at DESC"
    res = rows(con.execute(sql, args)); con.close(); return res


@R("GET", "/api/reports/:id")
def get_report(h, m):
    con = db(); r = one(con.execute("SELECT * FROM reports WHERE id=?", (m["id"],))); con.close(); return {"report": r}


@R("POST", "/api/reports")
def create_report(h, m):
    b = h.body; con = db(); rid = nid(); body = b.get("body", "")
    con.execute("""INSERT INTO reports (id,finding_id,program_id,title,body,status,folder,severity,cvss,cwe,bounty,
        submission_platform,word_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (rid, b.get("finding_id"), b.get("program_id"), b.get("title", "Untitled report"), body,
         b.get("status", "Draft"), b.get("folder", "Drafts"), b.get("severity"), b.get("cvss"), b.get("cwe"),
         b.get("bounty", 0), b.get("submission_platform"), word_count(body), now(), now()))
    log(con, "report", f"Created report {b.get('title','Untitled')}", "report", rid)
    con.commit(); con.close(); return {"id": rid}


@R("PATCH", "/api/reports/:id")
def patch_report(h, m):
    b = h.body; con = db(); sets, args = [], []
    for c in ["title", "status", "folder", "is_favorite", "submission_platform", "severity", "cvss", "cwe", "bounty", "finding_id", "program_id"]:
        if c in b: sets.append(f"{c}=?"); args.append(int(b[c]) if isinstance(b[c], bool) else b[c])
    if "body" in b:
        sets.append("body=?"); args.append(b["body"]); sets.append("word_count=?"); args.append(word_count(b["body"]))
    if b.get("status") == "Submitted":
        sets.append("submitted_at=?"); args.append(now())
    sets.append("updated_at=?"); args.append(now()); args.append(m["id"])
    con.execute(f"UPDATE reports SET {','.join(sets)} WHERE id=?", args); con.commit(); con.close(); return {"ok": True}


@R("POST", "/api/reports/:id/clone")
def clone_report(h, m):
    con = db(); r = one(con.execute("SELECT * FROM reports WHERE id=?", (m["id"],)))
    if not r: con.close(); return {"error": "not found"}
    rid = nid()
    con.execute("""INSERT INTO reports (id,finding_id,program_id,title,body,status,folder,severity,cvss,cwe,bounty,word_count,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (rid, r["finding_id"], r["program_id"], r["title"] + " (copy)",
        r["body"], "Draft", "Drafts", r["severity"], r["cvss"], r["cwe"], 0, r["word_count"], now(), now()))
    con.commit(); con.close(); return {"id": rid}


@R("DELETE", "/api/reports/:id")
def del_report(h, m):
    con = db(); con.execute("DELETE FROM reports WHERE id=?", (m["id"],)); con.commit(); con.close(); return {"ok": True}


# checklist (per-program, per-scope pentest progress)
@R("GET", "/api/programs/:id/checklist")
def get_checklist(h, m):
    con = db()
    res = rows(con.execute("SELECT scope, item_key, checked, notes FROM checklist_progress WHERE program_id=?", (m["id"],)))
    con.close(); return res


@R("POST", "/api/programs/:id/checklist")
def set_checklist(h, m):
    b = h.body; require(b, "scope", "item_key"); con = db()
    row = one(con.execute("SELECT id FROM checklist_progress WHERE program_id=? AND scope=? AND item_key=?",
                          (m["id"], b["scope"], b["item_key"])))
    checked = 1 if b.get("checked") else 0
    if row:
        sets, args = ["checked=?", "updated_at=?"], [checked, now()]
        if "notes" in b: sets.append("notes=?"); args.append(b["notes"])
        args.append(row["id"])
        con.execute(f"UPDATE checklist_progress SET {','.join(sets)} WHERE id=?", args)
    else:
        con.execute("INSERT INTO checklist_progress (id,program_id,scope,item_key,checked,notes,updated_at) VALUES (?,?,?,?,?,?,?)",
                    (nid(), m["id"], b["scope"], b["item_key"], checked, b.get("notes"), now()))
    con.commit(); con.close(); return {"ok": True}


# analytics
@R("GET", "/api/analytics")
def analytics(h, m):
    con = db(); q = h.query; where = ""; args = []
    if q.get("program_id"):
        where = " AND program_id=?"; args = [q["program_id"][0]]
    bounty = rows(con.execute(f"SELECT substr(discovered_at,1,7) month, SUM(bounty) bounty, COUNT(*) findings FROM findings WHERE bounty>0{where} GROUP BY month ORDER BY month", args))
    by_sev = rows(con.execute(f"SELECT severity name, COUNT(*) value FROM findings WHERE 1=1{where} GROUP BY severity", args))
    by_class = rows(con.execute(f"SELECT vuln_class name, COUNT(*) value FROM findings WHERE vuln_class IS NOT NULL{where} GROUP BY vuln_class ORDER BY value DESC", args))
    reports_time = rows(con.execute("SELECT substr(created_at,1,7) month, status, COUNT(*) c FROM reports GROUP BY month,status ORDER BY month"))
    by_program = rows(con.execute("SELECT p.name name, COUNT(f.id) findings, COALESCE(SUM(f.bounty),0) total FROM findings f JOIN programs p ON p.id=f.program_id GROUP BY p.id ORDER BY total DESC"))
    def gte(states):
        ph = ",".join("?" * len(states))
        return con.execute(f"SELECT COUNT(*) c FROM findings WHERE status IN ({ph}){where}", states + args).fetchone()["c"]
    funnel = [{"name": n, "value": gte(s)} for n, s in [
        ("Potential", ["Potential", "Confirmed", "Submitted", "Triaged", "Accepted", "Resolved"]),
        ("Confirmed", ["Confirmed", "Submitted", "Triaged", "Accepted", "Resolved"]),
        ("Submitted", ["Submitted", "Triaged", "Accepted", "Resolved"]),
        ("Accepted", ["Accepted", "Resolved"]), ("Resolved", ["Resolved"])]]
    con.close()
    return {"bounty": bounty, "by_severity": by_sev, "by_class": by_class, "reports_time": reports_time,
            "by_program": by_program, "funnel": funnel}


@R("GET", "/api/search")
def search(h, m):
    q = (h.query.get("q") or [""])[0]; con = db(); like = "%" + q + "%"
    out = {
        "programs": rows(con.execute("SELECT id,name,company FROM programs WHERE name LIKE ? OR company LIKE ? LIMIT 6", (like, like))),
        "findings": rows(con.execute("SELECT id,title,severity,program_id FROM findings WHERE title LIKE ? LIMIT 6", (like,))),
        "reports": rows(con.execute("SELECT id,title,status FROM reports WHERE title LIKE ? OR body LIKE ? LIMIT 6", (like, like))),
    }
    con.close(); return out


# ─── http handler ──────────────────────────────────────────────────────────
MIME = {".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml",
        ".json": "application/json", ".ico": "image/x-icon", ".woff2": "font/woff2"}


class Handler(BaseHTTPRequestHandler):
    server_version = "BugBountyOS"

    def log_message(self, *a):
        pass

    def _json(self, obj, code=200):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if not length:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def _dispatch(self, method):
        from urllib.parse import urlparse, parse_qs
        u = urlparse(self.path)
        path = u.path
        if path.startswith("/api/"):
            self.query = parse_qs(u.query)
            self.body = self._read_body() if method in ("POST", "PATCH", "PUT", "DELETE") else {}
            for mth, rx, fn in API.routes:
                if mth != method:
                    continue
                mo = rx.match(path)
                if mo:
                    try:
                        result = fn(self, mo.groupdict())
                        code = 404 if isinstance(result, dict) and result.get("error") == "not found" else 200
                        return self._json(result, code)
                    except BadRequest as e:
                        return self._json({"error": str(e)}, 400)
                    except Exception as e:
                        import traceback; traceback.print_exc()
                        return self._json({"error": str(e)}, 500)
            return self._json({"error": "route not found", "path": path}, 404)
        # static
        return self._static(path)

    def _static(self, path):
        if path == "/" or path == "":
            path = "/index.html"
        # SPA: unknown non-file routes -> index.html
        fp = os.path.normpath(os.path.join(WEB, path.lstrip("/")))
        if not fp.startswith(WEB):
            self.send_error(403); return
        if not os.path.isfile(fp):
            fp = os.path.join(WEB, "index.html")
        ext = os.path.splitext(fp)[1]
        try:
            with open(fp, "rb") as f:
                data = f.read()
        except FileNotFoundError:
            self.send_error(404); return
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self): self._dispatch("GET")
    def do_POST(self): self._dispatch("POST")
    def do_PATCH(self): self._dispatch("PATCH")
    def do_PUT(self): self._dispatch("PUT")
    def do_DELETE(self): self._dispatch("DELETE")


def main():
    migrate(); seed()
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"\n  ●  Bug Bounty OS  →  http://localhost:{PORT}\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  stopped.")
        httpd.shutdown()


if __name__ == "__main__":
    main()
