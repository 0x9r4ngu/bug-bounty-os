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

// 1. Overview of an existing program: tabs reduced, Notes + Timeline present, no Scope
const progs = await j("/programs");
const pid = progs[0].id;
await page.goto(`${BASE}/programs/${pid}?tab=Overview`, { waitUntil: "networkidle2" }); await wait(1000);
const tabs = await page.evaluate(() => [...document.querySelectorAll("button")].map((b) => b.textContent.trim()).filter((t) => /^(Overview|Entry Points|Assets|Endpoints|Findings|Checklist|Notes|Timeline)/.test(t)));
const hasScopeStat = await page.evaluate(() => [...document.querySelectorAll("*")].some((e) => e.children.length === 0 && e.textContent.trim() === "Scope"));
const hasNotes = await page.evaluate(() => [...document.querySelectorAll("h3")].some((h) => /Research Notes/.test(h.textContent)));
const hasTimeline = await page.evaluate(() => [...document.querySelectorAll("h3")].some((h) => h.textContent.trim() === "Timeline"));
await page.screenshot({ path: "/tmp/bbos-qa/overview.png" });
console.log(`tabs: ${tabs.join(" | ")}`);
console.log(`${!tabs.some((t) => /^Notes|^Timeline/.test(t)) ? "✓" : "✗"} Notes/Timeline tabs removed`);
console.log(`${!hasScopeStat ? "✓" : "✗"} no Scope stat/section`);
console.log(`${hasNotes ? "✓" : "✗"} Notes inside Overview`);
console.log(`${hasTimeline ? "✓" : "✗"} Timeline inside Overview`);

// 2. New program: scope field gone, assets field creates assets
await page.goto(`${BASE}/programs`, { waitUntil: "networkidle2" }); await wait(600);
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /New Program/.test(b.textContent))?.click());
await wait(500);
const noScopeField = await page.evaluate(() => ![...document.querySelectorAll("label")].some((l) => l.textContent.trim() === "Scope"));
const hasAssetsField = await page.evaluate(() => [...document.querySelectorAll("label")].some((l) => /In-scope assets/.test(l.textContent)));
console.log(`${noScopeField ? "✓" : "✗"} New Program has no Scope field`);
console.log(`${hasAssetsField ? "✓" : "✗"} New Program has In-scope assets field`);
// fill + submit
await page.evaluate(() => {
  const set = (el, v) => { const s = Object.getOwnPropertyDescriptor(el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype, "value").set; s.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); };
  const name = [...document.querySelectorAll("input")].find((i) => i.placeholder === "Acme Cloud"); set(name, "QA Scope Test");
  const ta = document.querySelector("textarea"); set(ta, "api.qatest.com\napp.qatest.com, graphql.qatest.com");
});
await wait(300);
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Create Program/.test(b.textContent))?.click());
await wait(1200);
const created = (await j("/programs")).find((p) => p.name === "QA Scope Test");
const createdAssets = created ? (await j(`/programs/${created.id}`)).assets : [];
console.log(`${created && createdAssets.length === 3 ? "✓" : "✗"} New program created 3 assets from scope input  (${createdAssets.map((a) => `${a.name}[${a.type}]`).join(", ")})`);
// cleanup
if (created) await fetch(`http://localhost:5177/api/programs/${created.id}`, { method: "DELETE" });

console.log(errs.length ? `\n✗ console errors: ${errs.join(" | ")}` : "\n✓ no console errors");
await browser.close();
