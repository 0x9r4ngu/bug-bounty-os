import puppeteer from "puppeteer-core";
const BASE = "http://localhost:5173";
const API = "http://localhost:5177/api";
const j = (p, opt) => fetch(`${API}${p}`, opt).then((r) => r.json());
const post = (p, b) => j(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });

const browser = await puppeteer.launch({ executablePath: "/usr/bin/chromium", headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
page.on("dialog", (d) => d.accept()); // auto-accept confirms
const errs = [];
page.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text())) errs.push(m.text()); });
page.on("pageerror", (e) => errs.push(e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// climb from the text node up to the nearest ancestor that contains button[title], click it — precise per-card targeting
async function clickNear(text, title) {
  return page.evaluate((text, title) => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (n.textContent.includes(text)) {
        let el = n.parentElement;
        while (el) { const b = el.querySelector(`button[title="${title}"]`); if (b) { b.click(); return true; } el = el.parentElement; }
      }
    }
    return false;
  }, text, title);
}
// click the confirm button inside the custom in-app confirm dialog (NOT a native popup)
async function confirmInDialog(text = "Delete") {
  await wait(300);
  return page.evaluate((text) => {
    const btns = [...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === text);
    const b = btns[btns.length - 1];
    if (b) { b.click(); return true; } return false;
  }, text);
}
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✓" : "✗"} ${name}${extra ? "  " + extra : ""}`); ok ? pass++ : fail++; };
// track native dialogs — there should be NONE now (we use an in-app dialog)
let nativeDialogs = 0;
page.removeAllListeners("dialog");
page.on("dialog", (d) => { nativeDialogs++; d.accept(); });

// ---- 1. PROGRAM DELETE ----
{
  const p = await post("/programs", { name: "QA-DELETE-PROG", visibility: "PUBLIC" });
  await page.goto(`${BASE}/programs`, { waitUntil: "networkidle2" }); await wait(800);
  const clicked = await clickNear("QA-DELETE-PROG", "Delete program");
  await confirmInDialog("Delete");
  await wait(1000);
  const still = await j(`/programs/${p.id}`);
  check("program delete (card)", clicked && !!still.error, clicked ? "" : "button not found");
}

// ---- 2. ASSET EDIT ----
{
  const p = await post("/programs", { name: "QA-ASSET-EDIT", visibility: "PUBLIC" });
  await post("/assets", { program_id: p.id, name: "OrigAsset", type: "Web" });
  await page.goto(`${BASE}/programs/${p.id}?tab=Assets`, { waitUntil: "networkidle2" }); await wait(800);
  await page.evaluate(() => document.querySelector('button[title="Edit"]')?.click());
  await wait(400);
  const ok = await page.evaluate(() => {
    const inp = [...document.querySelectorAll("input")].find((i) => i.value === "OrigAsset");
    if (!inp) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(inp, "EditedAsset");
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  });
  await wait(200);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Save")?.click());
  await wait(800);
  const d = await j(`/programs/${p.id}`);
  check("asset edit", ok && d.assets[0]?.name === "EditedAsset", `name=${d.assets[0]?.name}`);
  await fetch(`${API}/programs/${p.id}`, { method: "DELETE" });
}

// ---- 3. REPORT DELETE (from card) ----
{
  const r = await post("/reports", { title: "QA-DELETE-REPORT", markdown_content: "# x" });
  await page.goto(`${BASE}/reports`, { waitUntil: "networkidle2" }); await wait(800);
  const clicked = await clickNear("QA-DELETE-REPORT", "Delete");
  await confirmInDialog("Delete");
  await wait(1000);
  const reports = await j(`/reports`);
  check("report delete (card)", clicked && !reports.some((x) => x.id === r.id), clicked ? "" : "button not found");
}

// ---- 4. FINDING DELETE (in program) ----
{
  const progs = await j("/programs");
  const withF = [];
  for (const p of progs) { const d = await j(`/programs/${p.id}`); if (d.findings.length) { withF.push({ pid: p.id }); } }
  const pid = withF[0]?.pid;
  const f = await post("/findings", { program_id: pid, title: "QA-DELETE-FINDING", severity: "Low", status: "Potential" });
  await page.goto(`${BASE}/programs/${pid}?tab=Findings`, { waitUntil: "networkidle2" }); await wait(900);
  const clicked = await clickNear("QA-DELETE-FINDING", "Delete finding");
  await confirmInDialog("Delete");
  await wait(900);
  const d = await j(`/programs/${pid}`);
  check("finding delete (row)", clicked && !d.findings.some((x) => x.id === f.id), clicked ? "" : "button not found");
}

// ---- 5. JOURNAL EDIT + DELETE ----
{
  const marker = `QA-JOURNAL-${Date.now()}`;
  const e = await post("/journal_entries", { date: "2026-01-01", programs_worked: "QA", hours: 1, tested: marker });
  await page.goto(`${BASE}/journal`, { waitUntil: "networkidle2" }); await wait(800);
  // edit: open modal, change hours to 9, save
  const editClicked = await clickNear(marker, "Edit");
  await wait(500);
  const modalOpen = await page.evaluate(() => [...document.querySelectorAll("h2")].some((h) => /Journal Entry/.test(h.textContent)));
  const numInputs = await page.evaluate(() => document.querySelectorAll('input[type="number"]').length);
  console.log(`   [debug] editClicked=${editClicked} modalOpen=${modalOpen} numberInputs=${numInputs}`);
  await page.screenshot({ path: "/tmp/bbos-qa/journal-edit.png" });
  const edited = await page.evaluate(() => {
    const inp = [...document.querySelectorAll('input[type="number"]')][0];
    if (!inp) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(inp, "9"); inp.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  });
  await wait(300);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Save Changes/.test(b.textContent))?.click());
  await wait(900);
  const afterEdit = await j("/journal");
  const editOk = editClicked && edited && afterEdit.find((x) => x.id === e.id)?.hours === 9;
  check("journal edit", editOk, `hours=${afterEdit.find((x) => x.id === e.id)?.hours}`);
  // delete
  await page.goto(`${BASE}/journal`, { waitUntil: "networkidle2" }); await wait(600);
  const clicked = await clickNear(marker, "Delete");
  await confirmInDialog("Delete");
  await wait(900);
  const list = await j("/journal");
  check("journal delete", clicked && !list.some((x) => x.id === e.id), `clicked=${clicked}`);
}

// ---- 6. CONFIRM DIALOG IS IN-APP (no native popups) ----
check("no native confirm() popups used", nativeDialogs === 0, `nativeDialogs=${nativeDialogs}`);

// ---- 7. CHECKLIST: tick a box, verify progress + persistence ----
{
  const progs = await j("/programs");
  let pid = null, aname = null;
  for (const p of progs) { const d = await j(`/programs/${p.id}`); if (d.assets.length) { pid = p.id; aname = d.assets[0].name; break; } }
  await page.goto(`${BASE}/programs/${pid}?tab=Checklist`, { waitUntil: "networkidle2" }); await wait(1200);
  // expand first part (open by default) and tick the first checkbox
  const beforeRows = (await j(`/programs/${pid}/checklist`)).filter((r) => r.checked).length;
  const ticked = await page.evaluate(() => {
    const box = document.querySelector('button[title="Mark done"]');
    if (box) { box.click(); return true; } return false;
  });
  await wait(900);
  const afterRows = (await j(`/programs/${pid}/checklist`)).filter((r) => r.checked).length;
  await page.screenshot({ path: "/tmp/bbos-qa/checklist.png" });
  check("checklist tick persists", ticked && afterRows === beforeRows + 1, `before=${beforeRows} after=${afterRows}`);
  // expand a "how to test" dropdown
  const guidance = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /How to test/.test(b.textContent));
    if (btn) { btn.click(); return true; } return false;
  });
  await wait(500);
  const hasGuidance = await page.evaluate(() => !!document.querySelector(".md-preview"));
  check("checklist 'how to test' expands", guidance && hasGuidance);
  // untick to restore
  await page.evaluate(() => document.querySelector('button[title="Mark not done"]')?.click());
  await wait(500);
}

console.log(`\n${fail === 0 ? "ALL INTERACTIONS PASS ✓" : `${fail} FAILED`}  (${pass} passed)  console-errors=${errs.length}`);
if (errs.length) console.log("errors:", errs.slice(0, 5).join(" | "));
await browser.close();
process.exit(fail || errs.length ? 1 : 0);
