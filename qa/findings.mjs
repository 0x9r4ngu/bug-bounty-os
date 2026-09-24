import puppeteer from "puppeteer-core";

const BASE = "http://localhost:5173";
const OUT = "/tmp/bbos-qa";

// get a program that has findings + one finding id
const progs = await (await fetch("http://localhost:5177/api/programs")).json();
let target = null, findingId = null;
for (const p of progs) {
  const d = await (await fetch(`http://localhost:5177/api/programs/${p.id}`)).json();
  if (d.findings.length) { target = p.id; findingId = d.findings[0].id; break; }
}
console.log("program:", target, "finding:", findingId);

const browser = await puppeteer.launch({ executablePath: "/usr/bin/chromium", headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const errors = [];
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(e.message));

// 1. open Findings tab with a finding expanded
await page.goto(`${BASE}/programs/${target}?tab=Findings&finding=${findingId}`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 1500));
const hasCreateReport = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => /Create Report/.test(b.textContent)));
const hasNewFinding = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => /New Finding/.test(b.textContent)));
await page.screenshot({ path: `${OUT}/prog-findings-expanded.png` });
console.log(`${hasCreateReport && hasNewFinding ? "✓" : "✗"} findings tab  expanded-detail(Create Report)=${hasCreateReport} New-Finding-btn=${hasNewFinding}`);

// 2. click New Finding -> form appears
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /New Finding/.test(x.textContent)); b?.click(); });
await new Promise((r) => setTimeout(r, 500));
const formVisible = await page.evaluate(() => [...document.querySelectorAll("input")].some((i) => /Finding title/.test(i.placeholder || "")));
await page.screenshot({ path: `${OUT}/prog-findings-newform.png` });
console.log(`${formVisible ? "✓" : "✗"} new finding form  visible=${formVisible}`);

// 3. Endpoints tab -> per-row Finding shortcut exists
await page.goto(`${BASE}/programs/${target}?tab=Endpoints`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 1000));
const hasEpFinding = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => /Finding/.test(b.textContent)));
await page.screenshot({ path: `${OUT}/prog-endpoints.png` });
console.log(`${hasEpFinding ? "✓" : "✗"} endpoints tab  per-row Finding shortcut=${hasEpFinding}`);

// 4. Edit program modal
await page.goto(`${BASE}/programs/${target}?tab=Overview`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 800));
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Edit"); b?.click(); });
await new Promise((r) => setTimeout(r, 500));
const editModal = await page.evaluate(() => [...document.querySelectorAll("h2")].some((h) => /Edit Program/.test(h.textContent)));
await page.screenshot({ path: `${OUT}/prog-edit.png` });
console.log(`${editModal ? "✓" : "✗"} edit program modal  visible=${editModal}`);

console.log(errors.length ? `\n✗ console errors: ${errors.join(" | ")}` : "\n✓ no console errors");
await browser.close();
process.exit(errors.length ? 1 : 0);
