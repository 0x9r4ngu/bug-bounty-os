import puppeteer from "puppeteer-core";
const BASE = "http://localhost:5173";
const j = (p) => fetch(`http://localhost:5177/api${p}`).then((r) => r.json());
const browser = await puppeteer.launch({ executablePath: "/usr/bin/chromium", headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const errs = [];
page.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text())) errs.push(m.text()); });
page.on("pageerror", (e) => errs.push(e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (n, c, x = "") => console.log(`${c ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`);

const progs = await j("/programs");
let pid = null, aname = null;
for (const p of progs) { const d = await j(`/programs/${p.id}`); if (d.assets.length) { pid = p.id; aname = d.assets[0].name; break; } }
pid = pid || progs[0].id;

// ---- 1. CHECKLIST markdown fidelity: bullets, numbering, code ----
await page.goto(`${BASE}/programs/${pid}?tab=Checklist`, { waitUntil: "networkidle2" }); await wait(1000);
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Part IV - Injection/.test(b.textContent))?.click());
await wait(300);
await page.evaluate(() => { const a = [...document.querySelectorAll("button")].filter((b) => /How to test/.test(b.textContent)); a[0]?.click(); });
await wait(500);
const md = await page.evaluate(() => {
  const el = document.querySelector(".md-preview");
  if (!el) return null;
  const uls = el.querySelectorAll("ul").length, ols = el.querySelectorAll("ol").length, codes = el.querySelectorAll("code").length;
  const firstLi = el.querySelector("li");
  const marker = firstLi ? getComputedStyle(firstLi).listStyleType : "none";
  const olLi = el.querySelector("ol > li");
  const olMarker = olLi ? getComputedStyle(olLi.parentElement).listStyleType : "none";
  return { uls, ols, codes, marker, olMarker };
});
await page.screenshot({ path: "/tmp/bbos-qa/checklist-md.png" });
ok("checklist has bullet lists (disc)", md && md.uls > 0 && /disc|circle/.test(md.marker), JSON.stringify(md));
ok("checklist has numbered lists (decimal)", md && md.ols > 0 && md.olMarker === "decimal");
ok("checklist has inline code (backticks)", md && md.codes > 0, `code spans=${md?.codes}`);

// ---- 2. NEW FINDING -> opens report editor ----
const reportsBefore = (await j("/reports")).length;
await page.goto(`${BASE}/programs/${pid}?tab=Findings`, { waitUntil: "networkidle2" }); await wait(700);
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /New Finding/.test(b.textContent))?.click());
await wait(1500);
const url = page.url();
const onEditor = /\/reports\/[A-Za-z0-9_-]+$/.test(url);
const hasEditor = !!(await page.$(".cm-editor"));
ok("New Finding navigates to report editor", onEditor && hasEditor, url.replace(BASE, ""));
// cleanup the created finding+report
const rid = url.split("/reports/")[1];
if (rid) { const rep = await j(`/reports/${rid}`); const fid = rep.report?.finding_id; await fetch(`http://localhost:5177/api/reports/${rid}`, { method: "DELETE" }); if (fid) await fetch(`http://localhost:5177/api/findings/${fid}`, { method: "DELETE" }); }

// ---- 3. CWE searchable dropdown ----
const reports = await j("/reports");
const anyReport = reports[0]?.id;
await page.goto(`${BASE}/reports/${anyReport}`, { waitUntil: "networkidle2" }); await wait(1200);
// open metadata panel (Settings2 icon) then CWE select
await page.evaluate(() => { const b = [...document.querySelectorAll("button[title]")].find((x) => x.title === "Meta"); b?.click(); });
await wait(400);
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Select CWE|CWE-/.test(x.textContent) && x.querySelector("svg")); b?.click(); });
await wait(400);
await page.evaluate(() => { const i = document.querySelector('input[placeholder*="CWE"]'); if (i) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; s.call(i, "sql inj"); i.dispatchEvent(new Event("input", { bubbles: true })); } });
await wait(400);
const cweResults = await page.evaluate(() => [...document.querySelectorAll("button")].filter((b) => /^CWE-\d+/.test(b.textContent.trim())).map((b) => b.textContent.trim().slice(0, 40)));
await page.screenshot({ path: "/tmp/bbos-qa/cwe.png" });
ok("CWE search returns results", cweResults.length > 0, `${cweResults.length} results, e.g. ${cweResults[0] ?? ""}`);

console.log(errs.length ? `\n✗ console errors: ${errs.slice(0, 4).join(" | ")}` : "\n✓ no console errors");
await browser.close();
