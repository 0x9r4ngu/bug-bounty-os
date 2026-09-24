import puppeteer from "puppeteer-core";
const BASE = "http://localhost:5173";
const j = (p) => fetch(`http://localhost:5177/api${p}`).then((r) => r.json());
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const progs = await j("/programs");
let pid = progs[0].id;
for (const p of progs) { const d = await j(`/programs/${p.id}`); if (d.assets.length && d.findings.length) { pid = p.id; break; } }
const rid = (await j("/reports"))[0]?.id;

const shots = [
  ["01-dashboard", "/"],
  ["02-programs", "/programs"],
  ["03-prog-overview", `/programs/${pid}?tab=Overview`],
  ["04-prog-assets", `/programs/${pid}?tab=Assets`],
  ["05-prog-findings", `/programs/${pid}?tab=Findings`],
  ["06-prog-checklist", `/programs/${pid}?tab=Checklist`],
  ["07-findings", "/findings"],
  ["08-reports", "/reports"],
  ["09-report-editor", `/reports/${rid}`],
  ["10-analytics", "/analytics"],
  ["11-unfinished", "/unfinished"],
  ["12-journal", "/journal"],
];
const browser = await puppeteer.launch({ executablePath: "/usr/bin/chromium", headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
for (const [name, url] of shots) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle2" }).catch(() => {});
  await wait(url.includes("analytics") ? 2200 : 1000);
  await page.screenshot({ path: `/tmp/bbos-shots/${name}.png` });
  console.log("shot", name);
}
await browser.close();
