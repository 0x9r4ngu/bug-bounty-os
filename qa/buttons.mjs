import puppeteer from "puppeteer-core";
const BASE = "http://localhost:5173";
const API = "http://localhost:5177/api";
const j = (p, o) => fetch(API + p, o).then((r) => r.json());
const del = (p) => fetch(API + p, { method: "DELETE" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// baseline snapshot for cleanup
const base = {
  programs: new Set((await j("/programs")).map((x) => x.id)),
  reports: new Set((await j("/reports")).map((x) => x.id)),
  journal: new Set((await j("/journal")).map((x) => x.id)),
};
// pick a program with assets + a report
const progs = await j("/programs");
let pid = progs[0].id, aCount = 0;
for (const p of progs) { const d = await j(`/programs/${p.id}`); if (d.assets.length) { pid = p.id; aCount = d.assets.length; break; } }
const rid = (await j("/reports"))[0]?.id;

const pages = [
  ["dashboard", "/"],
  ["programs", "/programs"],
  ["programs?new", "/programs?new=1"],
  ["prog:overview", `/programs/${pid}?tab=Overview`],
  ["prog:assets", `/programs/${pid}?tab=Assets`],
  ["prog:findings", `/programs/${pid}?tab=Findings`],
  ["prog:checklist", `/programs/${pid}?tab=Checklist`],
  ["findings", "/findings"],
  ["reports", "/reports"],
  ["report-editor", rid ? `/reports/${rid}` : "/reports"],
  ["analytics", "/analytics"],
  ["unfinished", "/unfinished"],
  ["journal", "/journal"],
];

const browser = await puppeteer.launch({ executablePath: "/usr/bin/chromium", headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });

let grandErrors = 0, grandButtons = 0, grandDead = 0;
const report = [];

for (const [name, url] of pages) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle2" }).catch(() => {});
  await wait(700);
  const nButtons = await page.evaluate(() => document.querySelectorAll("button").length);
  const pageErrs = [];
  const deadButtons = [];

  for (let i = 0; i < nButtons; i++) {
    // fresh state each click
    if (i > 0) { await page.goto(`${BASE}${url}`, { waitUntil: "networkidle2" }).catch(() => {}); await wait(400); }
    const errs = [];
    const onC = (m) => { if (m.type() === "error" && !/favicon|ERR_CERT|net::ERR/.test(m.text())) errs.push(m.text()); };
    const onE = (e) => errs.push(e.message);
    page.on("console", onC); page.on("pageerror", onE);

    const info = await page.evaluate((idx) => {
      const btns = [...document.querySelectorAll("button")];
      const b = btns[idx];
      if (!b) return { label: "(gone)", hadEffect: true };
      const label = (b.getAttribute("title") || b.textContent || b.querySelector("svg")?.getAttribute("class") || "").trim().slice(0, 24) || "[icon]";
      const beforeHtml = document.body.innerHTML.length;
      const beforeUrl = location.href;
      window.__net = 0;
      b.click();
      return { label, beforeHtml, beforeUrl };
    }, i);

    await wait(350);
    const effect = await page.evaluate((beforeHtml, beforeUrl) => {
      return document.body.innerHTML.length !== beforeHtml || location.href !== beforeUrl;
    }, info.beforeHtml, info.beforeUrl);

    page.off("console", onC); page.off("pageerror", onE);
    if (errs.length) pageErrs.push(`[${info.label}] ${errs[0]}`);
    if (!effect && info.label !== "(gone)") deadButtons.push(info.label);

    // close any dialog/modal/dropdown and undo navigation
    await page.keyboard.press("Escape").catch(() => {});
  }

  grandButtons += nButtons; grandErrors += pageErrs.length; grandDead += deadButtons.length;
  report.push({ name, nButtons, pageErrs, deadButtons: [...new Set(deadButtons)] });
  console.log(`${pageErrs.length ? "✗" : "✓"} ${name.padEnd(16)} buttons=${String(nButtons).padStart(3)}  errors=${pageErrs.length}  possibly-dead=${[...new Set(deadButtons)].length}`);
  if (pageErrs.length) pageErrs.forEach((e) => console.log(`      ERROR ${e}`));
  if (deadButtons.length) console.log(`      no-visible-effect: ${[...new Set(deadButtons)].join(", ")}`);
}

await browser.close();

// cleanup anything created during the sweep
const nowReports = await j("/reports");
for (const r of nowReports) if (!base.reports.has(r.id)) { const d = await j(`/reports/${r.id}`); await del(`/reports/${r.id}`); if (d.report?.finding_id) await del(`/findings/${d.report.finding_id}`); }
const nowProgs = await j("/programs");
for (const p of nowProgs) if (!base.programs.has(p.id)) await del(`/programs/${p.id}`);
const nowJournal = await j("/journal");
for (const e of nowJournal) if (!base.journal.has(e.id)) await del(`/journal_entries/${e.id}`);
// remove QA findings created without a report
const allF = await j("/findings");
for (const f of allF) if (/Untitled finding/.test(f.title)) { const d = await j(`/findings/${f.id}`); if (!d.report) await del(`/findings/${f.id}`); }

console.log(`\n${grandErrors === 0 ? "NO BUTTON ERRORS ✓" : `${grandErrors} BUTTON ERRORS`}  ·  ${grandButtons} buttons swept  ·  ${grandDead} no-visible-effect (may be fine)`);
console.log("cleaned up sweep-created data");
