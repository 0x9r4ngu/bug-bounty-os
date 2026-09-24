import puppeteer from "puppeteer-core";
const BASE = "http://localhost:5173";
const j = (p) => fetch(`http://localhost:5177/api${p}`).then((r) => r.json());
const browser = await puppeteer.launch({ executablePath: "/usr/bin/chromium", headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const progs = await j("/programs");
let pid = null;
for (const p of progs) { const d = await j(`/programs/${p.id}`); if (d.assets.length) { pid = p.id; break; } }

// expand a vuln part + a "how to test"
await page.goto(`${BASE}/programs/${pid}?tab=Checklist`, { waitUntil: "networkidle2" }); await wait(1000);
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Part IV - Injection/.test(x.textContent)); b?.click(); });
await wait(400);
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /How to test/.test(x.textContent) && x.closest("div")); const all=[...document.querySelectorAll("button")].filter(x=>/How to test/.test(x.textContent)); all[all.length-1]?.click(); });
await wait(500);
await page.screenshot({ path: "/tmp/bbos-qa/checklist-guidance.png" });

// confirm dialog: trigger a report delete confirm (don't confirm)
await page.goto(`${BASE}/reports`, { waitUntil: "networkidle2" }); await wait(800);
await page.evaluate(() => {
  const card = [...document.querySelectorAll("a[href^='/reports/']")][0]?.closest("div")?.parentElement;
  const btn = document.querySelector('button[title="Delete"]');
  btn?.click();
});
await wait(500);
await page.screenshot({ path: "/tmp/bbos-qa/confirm-dialog.png" });
console.log("shots saved");
await browser.close();
