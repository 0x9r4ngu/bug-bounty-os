import puppeteer from "puppeteer-core";

const BASE = "http://localhost:5173";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/chromium", headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });

// discover a program + report id
const progs = await (await fetch("http://localhost:5177/api/programs")).json();
const pid = progs[0].id;
const reports = await (await fetch("http://localhost:5177/api/reports")).json();
const rid = reports[0]?.id;

const routes = [
  ["/", "dashboard"],
  ["/programs", "programs"],
  [`/programs/${pid}?tab=Overview`, "program-overview"],
  [`/programs/${pid}?tab=Entry Points`, "program-entrypoints"],
  [`/programs/${pid}?tab=Assets`, "program-assets"],
  [`/programs/${pid}?tab=Endpoints`, "program-endpoints"],
  [`/programs/${pid}?tab=Findings`, "program-findings"],
  ["/findings", "findings"],
  ["/reports", "reports"],
  [rid ? `/reports/${rid}` : "/reports", "report-editor"],
  ["/analytics", "analytics"],
  ["/unfinished", "unfinished"],
  ["/journal", "journal"],
];

async function auditRoute(url, name) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 1200));

  // list interactive elements: buttons + anchors with visible text/icon
  const inv = await page.evaluate(() => {
    const out = [];
    const els = [...document.querySelectorAll("button, a")];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const label = (el.getAttribute("aria-label") || el.textContent || el.querySelector("svg")?.getAttribute("class") || "").trim().slice(0, 30) || "[icon]";
      const isLink = el.tagName === "A" && el.getAttribute("href");
      // heuristic: a <button> with no onclick attribute AND not obviously wired — we can't see React handlers,
      // so instead we detect delete/edit affordances present per entity below.
      out.push({ tag: el.tagName, label, href: isLink || null });
    }
    return out;
  });
  await page.close();
  return inv;
}

// what we specifically look for: presence of Delete + Edit affordances per entity page
const wants = {
  "programs": ["delete affordance on a program"],
  "program-overview": ["Edit", "Delete program"],
  "program-entrypoints": ["Edit entry point", "Delete entry point"],
  "program-assets": ["Edit asset", "Delete asset"],
  "program-endpoints": ["Edit endpoint", "Delete endpoint"],
  "reports": ["Delete report"],
  "report-editor": ["Delete report"],
  "journal": ["Edit entry", "Delete entry"],
};

for (const [url, name] of routes) {
  const inv = await auditRoute(url, name);
  const labels = inv.map((x) => x.label.toLowerCase());
  const hasDelete = inv.some((x) => /delete|trash|remove/i.test(x.label));
  const hasEdit = inv.some((x) => /edit|pencil/i.test(x.label));
  const buttons = inv.filter((x) => x.tag === "BUTTON").length;
  const links = inv.filter((x) => x.tag === "A").length;
  console.log(`${name.padEnd(22)} buttons=${String(buttons).padStart(3)} links=${String(links).padStart(3)}  delete=${hasDelete ? "yes" : "NO "}  edit=${hasEdit ? "yes" : "NO "}`);
}

await browser.close();
