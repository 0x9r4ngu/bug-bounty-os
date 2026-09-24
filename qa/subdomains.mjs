import puppeteer from "puppeteer-core";
const BASE = "http://localhost:5173", API = "http://localhost:5177/api";
const j = (p, o) => fetch(API + p, o).then((r) => r.json());
const post = (p, b) => j(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (n, c, x = "") => console.log(`${c ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`);

const b = await puppeteer.launch({ executablePath: "/usr/bin/chromium", headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
const page = await b.newPage(); await page.setViewport({ width: 1440, height: 900 });
const errs = []; page.on("console", (m) => { if (m.type() === "error" && !/favicon|ERR_CERT/.test(m.text())) errs.push(m.text()); }); page.on("pageerror", (e) => errs.push(e.message));

// program with a wildcard asset
const p = await post("/programs", { name: "QA-Subs", visibility: "PUBLIC" });
const a = await post("/assets", { program_id: p.id, name: "*.example.com", type: "Web" });
await page.goto(`${BASE}/programs/${p.id}?tab=Assets`, { waitUntil: "networkidle2" }); await wait(800);

// expand the asset (chevron)
await page.evaluate(() => document.querySelector("button svg.lucide-chevron-right")?.closest("button")?.click());
await wait(400);
// bulk add subdomains via textarea
await page.click("textarea");
await page.type("textarea", "www.example.com\nexample.com\nnope.invalidtld.example");
await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => /Add subdomains/.test(x.textContent))?.click());
await wait(900);
let subs = (await j(`/programs/${p.id}`)).subdomains;
ok("bulk add created subdomains", subs.length === 3, `count=${subs.length}`);

// probe
await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => /Probe live status/.test(x.textContent))?.click());
await wait(9000);
subs = (await j(`/programs/${p.id}`)).subdomains;
const live = subs.filter((s) => s.status === "Live").length;
await page.screenshot({ path: "/tmp/bbos-qa/subdomains.png" });
ok("probe set live status", live >= 1, subs.map((s) => `${s.host}:${s.status}${s.http_code ? "/" + s.http_code : ""}`).join(", "));

// New Finding picker should list subdomains; bind to one
await page.goto(`${BASE}/programs/${p.id}?tab=Findings`, { waitUntil: "networkidle2" }); await wait(700);
await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => /New Finding/.test(x.textContent))?.click());
await wait(400);
const pickerHosts = await page.evaluate(() => [...document.querySelectorAll("button")].filter((x) => /example\.com$/.test(x.textContent.trim())).map((x) => x.textContent.trim()));
await page.screenshot({ path: "/tmp/bbos-qa/subpicker.png" });
ok("finding picker lists subdomains", pickerHosts.some((h) => /www\.example\.com/.test(h)), pickerHosts.join(" | "));
// click www.example.com in picker
await page.evaluate(() => { const btn = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "www.example.com"); btn?.click(); });
await wait(1500);
const findings = (await j(`/programs/${p.id}`)).findings;
const bound = findings[0];
const sub = subs.find((s) => s.host === "www.example.com");
ok("finding bound to chosen subdomain", bound && bound.asset_id === a.id && bound.subdomain_id === sub.id, `subdomain_host=${bound?.subdomain_host}`);

console.log(errs.length ? `\n✗ console: ${errs.slice(0, 3).join(" | ")}` : "\n✓ no console errors");
await fetch(`${API}/programs/${p.id}`, { method: "DELETE" });
// cleanup the report created
const reps = await j("/reports"); for (const r of reps) if (r.title === "Untitled finding" && !r.program_name) await fetch(`${API}/reports/${r.id}`, { method: "DELETE" });
await b.close();
