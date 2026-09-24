import puppeteer from "puppeteer-core";
import fs from "node:fs";

const BASE = "http://localhost:5173";
const OUT = "/tmp/bbos-qa";
fs.mkdirSync(OUT, { recursive: true });

const routes = [
  ["dashboard", "/"],
  ["programs", "/programs"],
  ["findings", "/findings"],
  ["reports", "/reports"],
  ["analytics", "/analytics"],
  ["unfinished", "/unfinished"],
  ["journal", "/journal"],
];

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

let totalErrors = 0;
const results = [];

async function visit(name, url, extraWait = 1200) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console.error: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (u.includes("/api/")) errors.push(`api requestfailed: ${u} ${r.failure()?.errorText}`);
  });
  try {
    await page.goto(`${BASE}${url}`, { waitUntil: "networkidle2", timeout: 20000 });
    await new Promise((r) => setTimeout(r, extraWait));
  } catch (e) {
    errors.push(`navigation: ${e.message}`);
  }
  // basic sanity: root has content
  const bodyLen = await page.evaluate(() => document.getElementById("root")?.innerText?.length ?? 0);
  if (bodyLen < 20) errors.push(`empty render (root text length=${bodyLen})`);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  totalErrors += errors.length;
  results.push({ name, url, bodyLen, errors });
  await page.close();
  return errors;
}

for (const [name, url] of routes) {
  const errs = await visit(name, url, name === "analytics" ? 2500 : 1200);
  console.log(`${errs.length ? "✗" : "✓"} ${name.padEnd(12)} textlen=${String(results.at(-1).bodyLen).padStart(5)}  ${errs.length ? errs.join(" | ") : "ok"}`);
}

// deep: open first program workspace
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/programs`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 800));
  await page.evaluate(() => { const a = document.querySelector('a[href^="/programs/"]'); if (a) a.click(); });
  await new Promise((r) => setTimeout(r, 1500));
  const tabs = await page.$$eval("button", (bs) => bs.map((b) => b.textContent).filter(Boolean));
  await page.screenshot({ path: `${OUT}/program-detail.png` });
  console.log(`${errors.length ? "✗" : "✓"} program-detail  tabs=${tabs.filter((t) => /Overview|Entry|Assets|Endpoints|Findings|Notes|Timeline/.test(t)).length}  ${errors.join(" | ") || "ok"}`);
  totalErrors += errors.length;
  await page.close();
} catch (e) { console.log("✗ program-detail navigation:", e.message); totalErrors++; }

// deep: open first report editor
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/reports`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 800));
  await page.evaluate(() => { const a = document.querySelector('a[href^="/reports/"]'); if (a) a.click(); });
  await new Promise((r) => setTimeout(r, 1800));
  const hasEditor = await page.$(".cm-editor");
  await page.screenshot({ path: `${OUT}/report-editor.png` });
  console.log(`${errors.length || !hasEditor ? "✗" : "✓"} report-editor   cm=${!!hasEditor}  ${errors.join(" | ") || "ok"}`);
  totalErrors += errors.length + (hasEditor ? 0 : 1);
  await page.close();
} catch (e) { console.log("✗ report-editor navigation:", e.message); totalErrors++; }

await browser.close();
console.log(`\n${totalErrors === 0 ? "ALL CLEAN ✓" : `TOTAL ISSUES: ${totalErrors}`}  (screenshots in ${OUT})`);
process.exit(totalErrors === 0 ? 0 : 1);
