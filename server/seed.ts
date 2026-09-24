import { db, id, now, migrate, logActivity, addTimeline } from "./db.ts";

migrate();

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export function seedIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) as c FROM programs").get() as { c: number };
  if (count.c > 0) return;

  const insProgram = db.prepare(`INSERT INTO programs
    (id,name,company,platform,program_type,visibility,status,is_private,is_watched,
     invitation_status,invitation_date,invitation_source,program_url,scope,rules,rewards,notes,tags,custom_fields,created_at,updated_at)
    VALUES (@id,@name,@company,@platform,@program_type,@visibility,@status,@is_private,@is_watched,
     @invitation_status,@invitation_date,@invitation_source,@program_url,@scope,@rules,@rewards,@notes,@tags,@custom_fields,@created_at,@updated_at)`);

  const programs = [
    {
      name: "Acme Cloud", company: "Acme Inc.", platform: "HackerOne", program_type: "Bug Bounty",
      visibility: "PUBLIC", is_private: 0, is_watched: 1, invitation_status: null, invitation_date: null,
      invitation_source: null, program_url: "https://hackerone.com/acme",
      scope: "*.acme.com, api.acme.com, Acme Android app",
      rules: "No DoS. No social engineering. Test accounts only.",
      rewards: "Critical $5000, High $2000, Medium $600, Low $150",
      notes: "# Research Notes\n\n## Interesting Areas\n- OAuth flow on login.acme.com\n- API authorization on /api/v2\n- Mobile API backend\n\n## Things to revisit\n- GraphQL introspection",
      tags: "cloud,api,oauth",
    },
    {
      name: "Nimbus Pay", company: "Nimbus Financial", platform: "Bugcrowd", program_type: "Bug Bounty",
      visibility: "PRIVATE", is_private: 1, is_watched: 1, invitation_status: "Accepted",
      invitation_date: daysAgo(40), invitation_source: "Bugcrowd invite email",
      program_url: "https://bugcrowd.com/nimbuspay",
      scope: "app.nimbuspay.com, api.nimbuspay.com", rules: "PCI scope excluded. Rate limit 5 rps.",
      rewards: "Critical $8000, High $3000, Medium $800",
      notes: "# Research Notes\n\nPrivate program — invitation received via Bugcrowd.\n\n## Accounts\n- tester+1@example.com (role: merchant)\n- tester+2@example.com (role: admin)",
      tags: "fintech,private,api",
    },
    {
      name: "Orbit Social", company: "Orbit Labs", platform: "Intigriti", program_type: "VDP",
      visibility: "VDP", is_private: 0, is_watched: 0, invitation_status: null,
      program_url: "https://app.intigriti.com/orbit",
      scope: "orbit.social, *.orbit.social", rules: "Report within 90 days.",
      rewards: "Swag / points only", notes: "# Research Notes\n\nVDP — no monetary bounty.",
      tags: "social,web",
    },
    {
      name: "Vertex API", company: "Vertex Systems", platform: "Private", program_type: "Bug Bounty",
      visibility: "INVITE_ONLY", is_private: 1, is_watched: 1, invitation_status: "Pending",
      invitation_date: daysAgo(8), invitation_source: "Direct email from security team",
      program_url: "", scope: "TBD — awaiting scope confirmation", rules: "Under NDA.",
      rewards: "Up to $10000", notes: "# Research Notes\n\nInvitation pending — do NOT assume scope.",
      tags: "private,invite,api",
    },
  ];

  const pids: string[] = [];
  for (const p of programs) {
    const pid = id();
    pids.push(pid);
    insProgram.run({
      id: pid, custom_fields: "{}", status: "Active", created_at: daysAgo(45), updated_at: now(),
      invitation_status: null, invitation_date: null, invitation_source: null, ...p,
    });
    addTimeline(pid, "program_added", "Program added", p.name);
    logActivity("program", `Added program ${p.name}`, "program", pid);
  }

  // Entry points
  const insEP = db.prepare(`INSERT INTO entry_points
    (id,program_id,name,type,url,environment,auth_type,scope_status,status,last_verified_at,notes,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const eps: [number, string, string, string, string, string, string, string][] = [
    [0, "Main Web App", "Web Application", "https://app.acme.com", "prod", "Password + OAuth", "In Scope", "Active"],
    [0, "API", "API Documentation", "https://api.acme.com", "prod", "Bearer JWT", "In Scope", "Active"],
    [0, "Admin Panel", "Web Application", "https://admin.acme.com", "prod", "SSO SAML", "In Scope", "Needs Verification"],
    [0, "GraphQL", "Web Application", "https://api.acme.com/graphql", "prod", "Bearer JWT", "In Scope", "Active"],
    [1, "Merchant Dashboard", "Private Dashboard", "https://app.nimbuspay.com", "prod", "OAuth + MFA", "In Scope", "Active"],
    [1, "Payments API", "API Documentation", "https://api.nimbuspay.com", "prod", "Bearer JWT", "In Scope", "Active"],
    [2, "Web", "Web Application", "https://orbit.social", "prod", "Password", "In Scope", "Active"],
  ];
  for (const [pi, name, type, url, env, auth, scope, status] of eps) {
    insEP.run(id(), pids[pi], name, type, url, env, auth, scope, status, now(), null, daysAgo(30));
  }

  // Assets
  const insAsset = db.prepare(`INSERT INTO assets (id,program_id,name,type,url,technology,notes,created_at) VALUES (?,?,?,?,?,?,?,?)`);
  const assetIds: Record<string, string> = {};
  const assets: [number, string, string, string, string][] = [
    [0, "app.acme.com", "Web", "https://app.acme.com", "React, Next.js, Node.js, Cloudflare"],
    [0, "api.acme.com", "API", "https://api.acme.com", "Node.js, Nginx, AWS"],
    [0, "Acme Android", "Android", "", "Kotlin, Retrofit"],
    [1, "app.nimbuspay.com", "Web", "https://app.nimbuspay.com", "React, Spring, AWS"],
    [1, "api.nimbuspay.com", "API", "https://api.nimbuspay.com", "Java, Spring, GraphQL"],
    [2, "orbit.social", "Web", "https://orbit.social", "Laravel, Vue, Nginx"],
  ];
  assets.forEach(([pi, name, type, url, tech], idx) => {
    const aid = id();
    assetIds[`${pi}:${name}`] = aid;
    if (idx === 0) assetIds["acme-web"] = aid;
    if (idx === 1) assetIds["acme-api"] = aid;
    if (idx === 4) assetIds["nimbus-api"] = aid;
    insAsset.run(aid, pids[pi], name, type, url, tech, null, daysAgo(28));
  });

  // Endpoints
  const insEndpoint = db.prepare(`INSERT INTO endpoints (id,program_id,asset_id,method,path,url,status,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?)`);
  const endpoints: [number, string, string, string, string][] = [
    [0, "acme-api", "GET", "/api/v2/users/{id}", "Tested"],
    [0, "acme-api", "GET", "/api/v2/orders/{id}", "Potential Issue"],
    [0, "acme-api", "POST", "/api/v2/oauth/token", "Untested"],
    [0, "acme-api", "GET", "/api/v2/admin/reports", "Untested"],
    [0, "acme-api", "PUT", "/api/v2/users/{id}/role", "In Progress"],
    [1, "nimbus-api", "GET", "/v1/merchants/{id}/payouts", "Potential Issue"],
    [1, "nimbus-api", "POST", "/v1/transfers", "Untested"],
    [1, "nimbus-api", "GET", "/v1/graphql", "Untested"],
  ];
  const endpointIds: Record<string, string> = {};
  endpoints.forEach(([pi, akey, method, path, status], idx) => {
    const eid = id();
    endpointIds[`${idx}`] = eid;
    insEndpoint.run(eid, pids[pi], assetIds[akey] ?? null, method, path, "", status, null, daysAgo(20));
  });

  // Findings
  const insFinding = db.prepare(`INSERT INTO findings
    (id,program_id,asset_id,endpoint_id,title,vuln_class,severity,status,cvss,cwe,bounty,observation,evidence,discovered_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const findings: [number, string | null, string | null, string, string, string, string, number, string, number, number][] = [
    // pi, assetKey, endpointIdx, title, vuln_class, severity, status, cvss, cwe, bounty, daysAgo
    [0, "acme-api", "1", "IDOR on /orders/{id} exposes other users' orders", "IDOR/BOLA", "High", "Resolved", 8.1, "CWE-639", 2000, 35],
    [0, "acme-api", "4", "Privilege escalation via role PUT", "Authorization", "Critical", "Accepted", 9.1, "CWE-269", 5000, 22],
    [0, "acme-web", null, "Reflected XSS in search parameter", "XSS", "Medium", "Submitted", 6.1, "CWE-79", 0, 12],
    [0, "acme-api", "2", "OAuth token leak via open redirect", "OAuth", "High", "Triaged", 7.4, "CWE-601", 0, 6],
    [1, "nimbus-api", "5", "BOLA on payouts endpoint", "IDOR/BOLA", "Critical", "Confirmed", 9.0, "CWE-639", 0, 4],
    [1, "nimbus-api", null, "Race condition on /transfers double-spend", "Race Condition", "High", "Potential", 7.5, "CWE-362", 0, 2],
    [2, null, null, "CSRF on profile update", "CSRF", "Low", "Resolved", 4.3, "CWE-352", 0, 30],
    [0, "acme-api", "3", "SSRF via webhook URL", "SSRF", "High", "Potential", 8.2, "CWE-918", 0, 1],
  ];
  const findingIds: string[] = [];
  findings.forEach(([pi, akey, eidx, title, vc, sev, status, cvss, cwe, bounty, dago]) => {
    const fid = id();
    findingIds.push(fid);
    insFinding.run(
      fid, pids[pi], akey ? assetIds[akey] ?? null : null, eidx ? endpointIds[eidx] ?? null : null,
      title, vc, sev, status, cvss, cwe, bounty,
      "Observed during authenticated testing with two accounts.", "[]",
      daysAgo(dago as number), daysAgo(dago as number), now()
    );
    addTimeline(pids[pi], "finding", "Finding discovered", title);
    logActivity("finding", title, "finding", fid);
  });

  // Reports
  const insReport = db.prepare(`INSERT INTO reports
    (id,finding_id,program_id,title,markdown_content,status,version,word_count,folder,is_favorite,severity,cvss,cwe,bounty,submission_platform,created_at,updated_at,submitted_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insVersion = db.prepare(`INSERT INTO report_versions (id,report_id,version_number,markdown_content,change_summary,is_submitted,created_at) VALUES (?,?,?,?,?,?,?)`);

  const reportBody = (title: string, sev: string) => `# ${title}

## Summary

An authorization flaw allows an attacker to access resources belonging to other users.

## Affected Asset

\`api.acme.com\`

## Severity

${sev}

## Steps to Reproduce

1. Authenticate as User A.
2. Capture the request to the target endpoint.
3. Replace the object ID with User B's identifier.

## Proof of Concept

\`\`\`http
GET /api/v2/orders/1042 HTTP/2
Host: api.acme.com
Authorization: Bearer [REDACTED]
\`\`\`

## Impact

Any authenticated user can enumerate and read other users' records, exposing PII.

## Remediation

Enforce object-level authorization on every request; validate ownership server-side.

## References

- OWASP API1:2023 Broken Object Level Authorization
`;

  const reportSeeds: [number, string, string, string, number][] = [
    // findingIdx, title, status, folder, daysAgoSubmitted(-1 = not submitted)
    [0, "IDOR on Orders Endpoint Exposes PII", "Resolved", "Resolved", 34],
    [1, "Privilege Escalation via Role Update", "Accepted", "Accepted", 21],
    [2, "Reflected XSS in Search", "Submitted", "Submitted", 11],
    [4, "BOLA on Nimbus Payouts", "Draft", "Drafts", -1],
  ];
  reportSeeds.forEach(([fi, title, status, folder, subDago]) => {
    const rid = id();
    const f = findings[fi];
    const body = reportBody(title, f[5] as string);
    const wc = body.split(/\s+/).length;
    insReport.run(
      rid, findingIds[fi], pids[f[0] as number], title, body, status, 3, wc, folder,
      fi === 1 ? 1 : 0, f[5], f[7], f[8], f[9],
      "HackerOne", daysAgo(subDago === -1 ? 5 : subDago + 3), now(),
      subDago === -1 ? null : daysAgo(subDago as number)
    );
    for (let v = 1; v <= 3; v++) {
      insVersion.run(id(), rid, v, body, v === 1 ? "Initial draft" : v === 2 ? "Added PoC + impact" : "Final polish", v === 3 && status !== "Draft" ? 1 : 0, daysAgo((subDago === -1 ? 5 : subDago) + (4 - v)));
    }
    logActivity("report", `Report: ${title}`, "report", rid);
  });

  // Research sessions
  const insSession = db.prepare(`INSERT INTO sessions (id,program_id,title,phase,coverage,minutes,started_at,ended_at,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  insSession.run(id(), pids[0], "Acme API authorization sweep", "Authorization", 72, 134, daysAgo(0), null, "Testing BOLA across /api/v2", now());
  insSession.run(id(), pids[1], "Nimbus payouts deep-dive", "Business Logic", 48, 95, daysAgo(1), daysAgo(1), "Race conditions on transfers", daysAgo(1));
  for (let d = 0; d < 30; d++) {
    if (Math.random() > 0.45) {
      const mins = Math.floor(Math.random() * 210) + 20;
      insSession.run(id(), pids[Math.floor(Math.random() * 3)], `Session ${d}`, "Recon", Math.floor(Math.random() * 100), mins, daysAgo(d), daysAgo(d), null, daysAgo(d));
    }
  }

  // Journal
  const insJournal = db.prepare(`INSERT INTO journal_entries (id,date,programs_worked,hours,tested,found,interesting,tomorrow,created_at) VALUES (?,?,?,?,?,?,?,?,?)`);
  insJournal.run(id(), new Date().toISOString().slice(0, 10), "Acme Cloud", 2.5, "API authorization on /api/v2", "Potential SSRF via webhook", "GraphQL introspection is enabled", "Test admin reports endpoint", now());

  logActivity("system", "Seed data loaded", "system", "seed");
}
