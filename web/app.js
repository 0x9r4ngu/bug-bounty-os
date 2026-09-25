"use strict";
/* Bug Bounty OS — vanilla SPA (no framework, no build) */

/* ── tiny hyperscript ── */
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return e;
}
const $ = (s, r = document) => r.querySelector(s);

/* ── icons (lucide paths) ── */
const IP = {
  home: "M3 9.5 12 3l9 6.5V21H3z", shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
  bug: "M8 2l1.5 2.5M16 2l-1.5 2.5M9 7h6a4 4 0 0 1 4 4v3a7 7 0 0 1-14 0v-3a4 4 0 0 1 4-4ZM5 12H2m20 0h-3M6 19l-2 2m14-2 2 2M5 7 3 5m16 2 2-2",
  file: "M14 3v5h5M14 3H6v18h12V8zM9 13h6M9 17h6", chart: "M3 3v18h18M8 15v-5m4 5V7m4 8v-3",
  book: "M4 4v16h13a2 2 0 0 0 2-2V4H6a2 2 0 0 0-2 2v0M4 4h2m0 0v14", list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.3-4.3", plus: "M12 5v14M5 12h14",
  sun: "M12 3v2m0 14v2M5 5l1.5 1.5M17.5 17.5 19 19M3 12h2m14 0h2M5 19l1.5-1.5M17.5 6.5 19 5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  moon: "M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z", panel: "M9 3v18M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  ext: "M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6", trash: "M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z", chevR: "m9 18 6-6-6-6", chevD: "m6 9 6 6 6-6",
  x: "M18 6 6 18M6 6l12 12", star: "M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z",
  copy: "M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2M5 15H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1",
  check: "m20 6-11 11-5-5", lock: "M6 10V7a6 6 0 0 1 12 0v3M5 10h14v11H5z", eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  radio: "M4.9 19.1a10 10 0 0 1 0-14.2m14.2 0a10 10 0 0 1 0 14.2M7.8 16.2a6 6 0 0 1 0-8.4m8.4 0a6 6 0 0 1 0 8.4M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  arrowUR: "M7 17 17 7M7 7h10v10", download: "M12 3v12m0 0 4-4m-4 4-4-4M4 21h16", dollar: "M12 2v20M17 6a4 4 0 0 0-4-3h-2a4 4 0 0 0 0 8h2a4 4 0 0 1 0 8h-2a4 4 0 0 1-4-3",
  boxes: "M12 2 4 6v12l8 4 8-4V6zM4 6l8 4 8-4M12 10v12", clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 7v5l3 2",
  back: "m15 18-6-6 6-6", cmd: "M6 4a2 2 0 1 1-2 2h12a2 2 0 1 1-2-2v12a2 2 0 1 1 2 2H6a2 2 0 1 1 2-2z",
};
function icon(name, size) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "1.9");
  svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
  if (size) { svg.setAttribute("width", size); svg.setAttribute("height", size); }
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", IP[name] || ""); svg.append(p);
  return svg;
}

/* ── api ── */
async function api(path, opts) {
  const res = await fetch("/api" + path, opts);
  if (!res.ok) { let m = res.status; try { m = (await res.json()).error || m; } catch {} throw new Error(m); }
  return res.json();
}
const GET = (p) => api(p);
const POST = (p, b) => api(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) });
const PATCH = (p, b) => api(p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) });
const DEL = (p) => api(p, { method: "DELETE" });

/* ── format + color ── */
const money = (n) => (n >= 1000 ? "$" + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k" : "$" + (n || 0));
function ago(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now"; if (d < 3600) return Math.floor(d / 60) + "m ago";
  if (d < 86400) return Math.floor(d / 3600) + "h ago"; return Math.floor(d / 86400) + "d ago";
}
const SEV = { Critical: "--crit", High: "--high", Medium: "--med", Low: "--low", Informational: "--info" };
const STA = { Potential: "--info", Confirmed: "--blue", Submitted: "--violet", Triaged: "--warn", Accepted: "--ok", Resolved: "--ok", Draft: "--info", "In Progress": "--blue", Ready: "--warn", Rejected: "--crit", Duplicate: "--info", Archived: "--faint", Active: "--ok", Paused: "--warn", Closed: "--faint", Expired: "--faint" };
const VIS = { PUBLIC: "--blue", PRIVATE: "--warn", INVITE_ONLY: "--violet", VDP: "--info", INTERNAL: "--crit", CUSTOM: "--info" };
const SUBC = { Live: "--ok", Redirect: "--warn", Offline: "--crit", Unknown: "--faint", "Out of Scope": "--faint" };
const sevVar = (s) => "var(" + (SEV[s] || "--info") + ")";
function badge(text, cvar) {
  const c = "var(" + cvar + ")";
  return h("span", { class: "badge", style: { color: c, background: `color-mix(in srgb, ${c} 14%, transparent)`, borderColor: `color-mix(in srgb, ${c} 34%, transparent)` } }, text);
}
const sevBadge = (s) => badge(s, SEV[s] || "--info");
const staBadge = (s) => badge(s, STA[s] || "--info");

/* ── toast + confirm + modal ── */
function toast(msg, kind) {
  const t = h("div", { class: "toast" }, h("span", { class: "dot", style: { background: `var(--${kind === "error" ? "crit" : kind === "ok" ? "ok" : "accent"})` } }), msg);
  $("#toasts").append(t); setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 250); }, 2600);
}
let modalEl = null;
function openModal(node, center) {
  closeModal();
  const ov = h("div", { class: "overlay" + (center ? " center" : ""), onclick: (e) => { if (e.target === ov) closeModal(); } }, node);
  modalEl = ov; document.body.append(ov);
  document.addEventListener("keydown", escClose);
}
function escClose(e) { if (e.key === "Escape") closeModal(); }
function closeModal() { if (modalEl) { modalEl.remove(); modalEl = null; document.removeEventListener("keydown", escClose); } }
function confirmDialog(opts) {
  const o = typeof opts === "string" ? { message: opts } : opts;
  return new Promise((resolve) => {
    const done = (v) => { closeModal(); resolve(v); };
    openModal(h("div", { class: "modal", style: { maxWidth: "420px" }, onclick: (e) => e.stopPropagation() },
      h("div", { class: "modal-body" },
        h("div", { style: { fontWeight: "600", fontSize: "15px", marginBottom: "6px" } }, o.title || "Confirm"),
        h("div", { class: "muted", style: { fontSize: "13px", lineHeight: "1.55" } }, o.message)),
      h("div", { class: "modal-foot" },
        h("button", { class: "btn", onclick: () => done(false) }, o.cancel || "Cancel"),
        h("button", { class: "btn " + (o.danger === false ? "primary" : "danger"), onclick: () => done(true) }, o.confirm || "Delete"))
    ), true);
  });
}
function field(label, control) { return h("div", { class: "field" }, h("label", {}, label), control); }
function input(attrs) { return h("input", Object.assign({ class: "input" }, attrs)); }
function textarea(attrs) { return h("textarea", Object.assign({ class: "input" }, attrs)); }
function select(opts, val, attrs) {
  const s = h("select", Object.assign({ class: "select" }, attrs));
  for (const o of opts) { const [v, l] = Array.isArray(o) ? o : [o, o]; const op = h("option", { value: v }, l); if (String(v) === String(val)) op.selected = true; s.append(op); }
  return s;
}

/* ── markdown (small, safe) ── */
function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function inlineMd(s) {
  s = s.replace(/`([^`]+)`/g, (_, c) => "<code>" + c + "</code>");
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  return s;
}
function mdToHtml(src) {
  const lines = esc(src || "").split("\n"); let out = []; let i = 0;
  while (i < lines.length) {
    let l = lines[i];
    if (/^```/.test(l)) { const lang = l.slice(3).trim(); let buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push('<pre><code>' + buf.join("\n") + "</code></pre>"); continue; }
    if (/^#{1,3}\s/.test(l)) { const n = l.match(/^#+/)[0].length; out.push(`<h${n}>` + inlineMd(l.replace(/^#+\s/, "")) + `</h${n}>`); i++; continue; }
    if (/^\s*[-*]\s/.test(l)) { let buf = []; while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) buf.push("<li>" + inlineMd(lines[i++].replace(/^\s*[-*]\s/, "")) + "</li>"); out.push("<ul>" + buf.join("") + "</ul>"); continue; }
    if (/^\s*\d+\.\s/.test(l)) { let buf = []; while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) buf.push("<li>" + inlineMd(lines[i++].replace(/^\s*\d+\.\s/, "")) + "</li>"); out.push("<ol>" + buf.join("") + "</ol>"); continue; }
    if (/^\s*>/.test(l)) { out.push("<blockquote>" + inlineMd(l.replace(/^\s*>\s?/, "")) + "</blockquote>"); i++; continue; }
    if (/^\s*(-{3,}|_{3,})\s*$/.test(l)) { out.push("<hr>"); i++; continue; }
    if (l.includes("|") && lines[i + 1] && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(l); i += 2; let body = [];
      while (i < lines.length && lines[i].includes("|")) body.push(cells(lines[i++]));
      out.push("<table><thead><tr>" + head.map((c) => "<th>" + inlineMd(c) + "</th>").join("") + "</tr></thead><tbody>" +
        body.map((r) => "<tr>" + r.map((c) => "<td>" + inlineMd(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table>"); continue;
    }
    if (l.trim() === "") { i++; continue; }
    let buf = [l]; i++; while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,3}\s|```|\s*[-*]\s|\s*\d+\.\s|\s*>)/.test(lines[i])) buf.push(lines[i++]);
    out.push("<p>" + inlineMd(buf.join(" ")) + "</p>");
  }
  return out.join("\n");
}

/* ── charts (svg) ── */
function svg(w, h_, kids, attrs) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", `0 0 ${w} ${h_}`); s.setAttribute("width", "100%"); s.setAttribute("preserveAspectRatio", "none");
  if (attrs) for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  for (const k of kids.flat(Infinity)) if (k) s.append(k);
  return s;
}
function sline(tag, attrs) { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; }
function sparkline(values, color) {
  const w = 260, ht = 60, max = Math.max(1, ...values), min = Math.min(0, ...values);
  const pts = values.map((v, i) => [values.length === 1 ? w : (i / (values.length - 1)) * w, ht - 6 - ((v - min) / (max - min || 1)) * (ht - 12)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L${w} ${ht} L0 ${ht} Z`;
  const c = color || "var(--accent)";
  return svg(w, ht, [
    sline("path", { d: area, fill: c, opacity: ".1" }),
    sline("path", { d: line, fill: "none", stroke: c, "stroke-width": "2" }),
    pts.length ? sline("circle", { cx: pts[pts.length - 1][0], cy: pts[pts.length - 1][1], r: "3", fill: c }) : null,
  ], { style: "height:60px" });
}
function donut(segs) {
  const total = segs.reduce((a, s) => a + s.value, 0) || 1; const R = 42, r = 27, cx = 50, cy = 50; let ang = -Math.PI / 2;
  const arcs = segs.filter((s) => s.value).map((s) => {
    const frac = s.value / total, a2 = ang + frac * 2 * Math.PI;
    const x1 = cx + R * Math.cos(ang), y1 = cy + R * Math.sin(ang), x2 = cx + R * Math.cos(a2), y2 = cy + R * Math.sin(a2);
    const xi1 = cx + r * Math.cos(a2), yi1 = cy + r * Math.sin(a2), xi2 = cx + r * Math.cos(ang), yi2 = cy + r * Math.sin(ang);
    const large = frac > 0.5 ? 1 : 0; ang = a2;
    return sline("path", { d: `M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${xi1} ${yi1} A${r} ${r} 0 ${large} 0 ${xi2} ${yi2} Z`, fill: s.color });
  });
  return svg(100, 100, arcs, { width: "150", height: "150", style: "width:150px;height:150px" });
}
function hbars(items, color) {
  const max = Math.max(1, ...items.map((i) => i.value)); const rows = items.map((it, i) =>
    h("div", { class: "row", style: { gap: "10px", margin: "7px 0" } },
      h("div", { class: "mono", style: { width: "120px", fontSize: "12px", color: "var(--muted)", textAlign: "right", flexShrink: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, it.name),
      h("div", { style: { flex: "1", height: "16px", background: "var(--panel-2)", borderRadius: "4px", overflow: "hidden" } },
        h("div", { style: { width: (it.value / max * 100) + "%", height: "100%", background: color || "var(--accent)", borderRadius: "4px" } })),
      h("div", { class: "tnum", style: { width: "28px", fontSize: "12px", color: "var(--muted)" } }, it.value)));
  return h("div", {}, rows);
}
function lineMulti(months, series) {
  const w = 520, ht = 190, pad = 26; const max = Math.max(1, ...series.flatMap((s) => s.data));
  const xs = (i) => months.length <= 1 ? w / 2 : pad + (i / (months.length - 1)) * (w - pad * 2);
  const ys = (v) => ht - pad - (v / max) * (ht - pad * 2);
  const grid = [0, 0.5, 1].map((f) => sline("line", { x1: pad, x2: w - pad, y1: ys(max * f), y2: ys(max * f), stroke: "var(--border)", "stroke-width": "1" }));
  const paths = series.map((s) => sline("path", { d: s.data.map((v, i) => (i ? "L" : "M") + xs(i) + " " + ys(v)).join(" "), fill: "none", stroke: s.color, "stroke-width": "2" }));
  return svg(w, ht, [...grid, ...paths], { style: "height:190px" });
}

/* ── shell ── */
const NAV = [
  ["", "home", "Overview"], ["programs", "shield", "Programs"], ["findings", "bug", "Findings"],
  ["reports", "file", "Reports"], ["analytics", "chart", "Analytics"],
];
let collapsed = false;
function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme")
    || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("theme", next); } catch {}
  $("#theme-ic").replaceWith(themeIcon());
}
function themeIcon() {
  const isLight = (document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")) === "light";
  const el = icon(isLight ? "moon" : "sun"); el.id = "theme-ic"; return el;
}
function buildShell() {
  const app = $("#app"); app.innerHTML = "";
  const side = h("aside", { class: "sidebar" + (collapsed ? " collapsed" : ""), id: "sidebar" },
    h("div", { class: "brand" },
      h("div", { class: "brand-logo" }, icon("shield", 16)),
      h("div", { class: "brand-text" }, "bounty", h("b", {}, "OS"))),
    h("div", { class: "nav-label lbl" }, "Workspace"),
    h("nav", { class: "nav" }, NAV.map(([r, ic, label]) =>
      h("a", { href: "#/" + r, class: "nav-item", "data-route": r }, icon(ic), h("span", { class: "lbl" }, label)))),
    h("div", { class: "side-foot" }, icon("lock", 12), h("span", {}, "Local · SQLite")));
  const view = h("div", { id: "view", style: { flex: "1", display: "flex", flexDirection: "column", minHeight: "0", overflow: "hidden" } });
  const main = h("div", { class: "main" },
    h("header", { class: "topbar" },
      h("button", { class: "icon-btn", title: "Toggle sidebar", onclick: () => { collapsed = !collapsed; $("#sidebar").classList.toggle("collapsed"); } }, icon("panel")),
      h("button", { class: "searchbar", onclick: openSearch },
        icon("search", 15), h("span", {}, "Search…"), h("kbd", {}, "⌘K")),
      h("div", { style: { marginLeft: "auto" }, class: "row" },
        h("button", { class: "icon-btn", title: "Toggle theme", onclick: toggleTheme }, themeIcon()))),
    view);
  app.append(h("div", { class: "app" }, side, main));
}

/* ── router ── */
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, ""); const [path, qs] = raw.split("?");
  const query = {}; new URLSearchParams(qs || "").forEach((v, k) => (query[k] = v));
  return { path: path || "", query };
}
const ROUTES = {
  "": viewOverview, "programs": viewPrograms, "findings": viewFindings, "reports": viewReports,
  "analytics": viewAnalytics,
};
async function navigate() {
  const { path, query } = parseHash();
  const seg = path.split("/");
  let fn, arg;
  if (seg[0] === "programs" && seg[1]) { fn = viewProgram; arg = seg[1]; }
  else if (seg[0] === "reports" && seg[1]) { fn = viewReportEditor; arg = seg[1]; }
  else fn = ROUTES[seg[0]] || viewOverview;
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.getAttribute("data-route") === seg[0]));
  const view = $("#view"); view.innerHTML = "";
  const spin = h("div", { style: { padding: "40px", color: "var(--faint)" } }, "Loading…"); view.append(spin);
  try {
    const node = await fn(arg, query);
    view.innerHTML = ""; view.append(node);
  } catch (e) { view.innerHTML = ""; view.append(h("div", { class: "page" }, h("div", { class: "empty" }, "Error: " + e.message))); }
}
function page(...kids) { return h("div", { class: "scroll" }, h("div", { class: "page" }, kids.flat(Infinity))); }
function go(hash) { location.hash = hash; }

/* ═══ VIEWS ═══ */

async function viewOverview() {
  const d = await GET("/overview");
  const k = d.kpis;
  const kpi = (label, val, ic, to, color) => h("div", { class: "kpi" + (to ? " link" : ""), onclick: to ? () => go(to) : null },
    h("div", { class: "kpi-label" }, label, icon(ic)),
    h("div", { class: "kpi-val", style: color ? { color } : null }, val));
  const trendVals = d.trend.length ? d.trend.map((t) => t.bounty) : [0, 0];
  return page(
    h("div", { class: "page-head" }, h("div", {}, h("div", { class: "h1" }, "Overview"), h("div", { class: "sub" }, "Your research at a glance."))),
    h("div", { class: "kpi-grid" },
      kpi("Total bounty", money(k.total_bounty), "dollar", "#/analytics", "var(--ok)"),
      kpi("Findings", k.findings, "bug", "#/findings"),
      kpi("Reports", k.reports, "file", "#/reports"),
      kpi("Programs", k.programs, "shield", "#/programs")),
    h("div", { class: "grid2", style: { marginTop: "16px" } },
      h("div", { class: "card" },
        h("div", { class: "card-head" }, h("div", { class: "card-title" }, "Bounty trend"), h("a", { href: "#/analytics", class: "link-accent" }, "Analytics")),
        h("div", { class: "pad" }, sparkline(trendVals, "var(--ok)"),
          h("div", { class: "row", style: { marginTop: "10px", gap: "16px" } },
            d.trend.map((t) => h("div", {}, h("div", { class: "faint", style: { fontSize: "11px" } }, t.month), h("div", { style: { fontWeight: "600" } }, money(t.bounty))))))),
      h("div", { class: "card" },
        h("div", { class: "card-head" }, h("div", { class: "card-title" }, "Findings by severity")),
        h("div", { class: "pad row", style: { gap: "20px" } },
          donut(d.by_severity.map((s) => ({ value: s.value, color: sevVar(s.name) }))),
          h("div", { class: "stack", style: { gap: "6px", flex: "1" } },
            d.by_severity.map((s) => h("div", { class: "row" },
              h("span", { class: "dot", style: { background: sevVar(s.name) } }), h("span", { class: "muted", style: { fontSize: "12.5px" } }, s.name),
              h("span", { class: "tnum", style: { marginLeft: "auto", fontWeight: "600" } }, s.value))))))),
    h("div", { class: "grid2", style: { marginTop: "16px" } },
      h("div", { class: "card" },
        h("div", { class: "card-head" }, h("div", { class: "card-title" }, "Recent findings"), h("a", { href: "#/findings", class: "link-accent" }, "All")),
        d.recent.length ? h("table", { class: "table" }, h("tbody", {}, d.recent.map((f) =>
          h("tr", { class: "clickable", onclick: () => go("#/programs/" + f.program_id + "?tab=findings") },
            h("td", { style: { width: "1%" } }, sevBadge(f.severity)),
            h("td", {}, h("div", { style: { fontWeight: "500" } }, f.title), h("div", { class: "faint mono", style: { fontSize: "11px" } }, f.program_name)),
            h("td", { style: { textAlign: "right" } }, f.bounty > 0 ? h("span", { style: { color: "var(--ok)", fontWeight: "600" } }, money(f.bounty)) : h("span", { class: "faint" }, "—")))))) : h("div", { class: "pad" }, h("div", { class: "empty" }, "No findings yet."))),
      h("div", { class: "card" },
        h("div", { class: "card-head" }, h("div", { class: "card-title" }, "What's next")),
        h("div", { class: "pad stack", style: { gap: "8px" } },
          d.next.length ? d.next.map((n) => h("a", { href: n.to, class: "row hover-card", style: { padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "8px" } },
            h("span", { style: { minWidth: "22px", height: "22px", padding: "0 6px", borderRadius: "6px", background: "var(--accent-soft)", color: "var(--accent)", fontWeight: "700", fontSize: "12px", display: "grid", placeItems: "center" } }, n.count),
            h("span", { class: "muted", style: { fontSize: "13px" } }, n.label))) : h("div", { class: "empty" }, "All caught up.")))),
  );
}

async function viewPrograms(_, query) {
  const priv = query.private === "1", pub = query.public === "1";
  const list = await GET("/programs?" + new URLSearchParams(priv ? { private: "1" } : pub ? { public: "1" } : {}));
  if (query.new === "1") setTimeout(programModal, 30);
  const filt = (label, active, to) => h("button", { class: active ? "active" : "", onclick: () => go(to) }, label);
  return page(
    h("div", { class: "page-head" },
      h("div", {}, h("div", { class: "h1" }, "Programs"), h("div", { class: "sub" }, list.length + " tracked")),
      h("button", { class: "btn primary", onclick: programModal }, icon("plus", 15), "New Program")),
    h("div", { class: "pill-tabs", style: { marginBottom: "18px" } },
      filt("All", !priv && !pub, "#/programs"), filt("Private", priv, "#/programs?private=1"), filt("Public", pub, "#/programs?public=1")),
    list.length ? h("div", { class: "grid3" }, list.map((p) => programCard(p))) : h("div", { class: "empty" }, "No programs."));
}
function programCard(p) {
  const stats = [["Assets", p.asset_count], ["Findings", p.finding_count], ["Reports", p.report_count]];
  return h("a", { href: "#/programs/" + p.id, class: "card hover-card", style: { padding: "16px", display: "block" } },
    h("div", { class: "spread" },
      h("div", { class: "row", style: { gap: "7px", minWidth: "0" } }, p.is_private ? icon("lock", 13) : null, h("span", { style: { fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name)),
      p.is_watched ? icon("eye", 15) : null),
    h("div", { class: "faint", style: { fontSize: "12px", marginTop: "2px" } }, (p.company || "—") + " · " + (p.platform || "—")),
    h("div", { class: "row", style: { gap: "6px", marginTop: "11px" } }, badge(VIS[p.visibility] ? p.visibility.replace("_", " ") : p.visibility, VIS[p.visibility] || "--info"), staBadge(p.status)),
    h("div", { class: "row", style: { marginTop: "13px", paddingTop: "12px", borderTop: "1px solid var(--border)", justifyContent: "space-around" } },
      stats.map(([l, v]) => h("div", { style: { textAlign: "center" } }, h("div", { style: { fontWeight: "700", fontSize: "16px" } }, v), h("div", { class: "faint", style: { fontSize: "10.5px" } }, l)))));
}
function programModal() {
  const f = { visibility: "PUBLIC", platform: "HackerOne" };
  const set = (k) => (e) => (f[k] = e.target.value);
  const priv = h("div");
  const visSel = select(Object.keys(VIS).map((v) => [v, v.replace("_", " ")]), "PUBLIC", { onchange: (e) => { f.visibility = e.target.value; renderPriv(); } });
  function renderPriv() {
    priv.innerHTML = "";
    if (!["PUBLIC", "VDP"].includes(f.visibility))
      priv.append(field("Invitation status", select(["", "Received", "Accepted", "Pending", "Expired", "Declined"], f.invitation_status || "", { onchange: set("invitation_status") })));
  }
  renderPriv();
  const m = h("div", { class: "modal", onclick: (e) => e.stopPropagation() },
    h("div", { class: "modal-head" }, h("div", { style: { fontWeight: "600" } }, "New Program"), h("button", { class: "icon-btn", onclick: closeModal }, icon("x"))),
    h("div", { class: "modal-body" },
      h("div", { class: "grid2" },
        field("Name", input({ oninput: set("name"), placeholder: "Acme Cloud" })),
        field("Company", input({ oninput: set("company"), placeholder: "Acme Inc." })),
        field("Platform", select(["HackerOne", "Bugcrowd", "Intigriti", "YesWeHack", "Immunefi", "Private", "Other"], "HackerOne", { onchange: set("platform") })),
        field("Visibility", visSel)),
      priv,
      field("In-scope assets (one host per line)", textarea({ rows: 3, class: "input mono", oninput: set("assets"), placeholder: "app.acme.com\napi.acme.com" })),
      field("Rewards", input({ oninput: set("rewards"), placeholder: "Critical $5000 / High $2000" }))),
    h("div", { class: "modal-foot" },
      h("label", { class: "row", style: { marginRight: "auto", fontSize: "13px", color: "var(--muted)", cursor: "pointer" } }, h("input", { type: "checkbox", onchange: (e) => (f.is_watched = e.target.checked) }), "Watch"),
      h("button", { class: "btn", onclick: closeModal }, "Cancel"),
      h("button", { class: "btn primary", onclick: async () => { if (!f.name) return toast("Name required", "error"); const { id } = await POST("/programs", f); closeModal(); toast("Program created", "ok"); go("#/programs/" + id); } }, "Create")));
  openModal(m);
}

window.__bbos = { page, GET, POST, PATCH, DEL, h, icon, badge, sevBadge, staBadge, money, ago, field, input, textarea, select, toast, confirmDialog, openModal, closeModal, go, mdToHtml, donut, hbars, lineMulti, sevVar, SEV, STA, VIS, SUBC };

/* ── search palette ── */
let searchTimer;
function openSearch() {
  const inp = h("input", { placeholder: "Search programs, findings, reports…", autofocus: true });
  const results = h("div", { class: "cmdk-results" });
  inp.addEventListener("input", () => {
    clearTimeout(searchTimer); const q = inp.value.trim();
    if (!q) { results.innerHTML = ""; return; }
    searchTimer = setTimeout(async () => {
      const r = await GET("/search?q=" + encodeURIComponent(q)); results.innerHTML = "";
      const grp = (title, items, render) => { if (!items.length) return; results.append(h("div", { class: "cmdk-group" }, title)); items.forEach((it) => results.append(render(it))); };
      grp("Programs", r.programs, (p) => h("div", { class: "cmdk-item", onclick: () => { closeModal(); go("#/programs/" + p.id); } }, icon("shield", 15), p.name));
      grp("Findings", r.findings, (f) => h("div", { class: "cmdk-item", onclick: () => { closeModal(); go("#/programs/" + f.program_id + "?tab=findings"); } }, icon("bug", 15), f.title));
      grp("Reports", r.reports, (rp) => h("div", { class: "cmdk-item", onclick: () => { closeModal(); go("#/reports/" + rp.id); } }, icon("file", 15), rp.title));
      if (!r.programs.length && !r.findings.length && !r.reports.length) results.append(h("div", { style: { padding: "16px", textAlign: "center", color: "var(--faint)" } }, "No results"));
    }, 160);
  });
  openModal(h("div", { class: "modal cmdk", onclick: (e) => e.stopPropagation() },
    h("div", { class: "cmdk-input" }, icon("search", 18), inp), results));
  setTimeout(() => inp.focus(), 20);
}

/* ═══ PROGRAM DETAIL ═══ */
async function viewProgram(id, query) {
  const d = await GET("/programs/" + id);
  if (d.error) return h("div", { class: "page" }, h("div", { class: "empty" }, "Program not found."));
  const p = d.program;
  const tab = query.tab || "overview";
  const setTab = (t) => go("#/programs/" + id + "?tab=" + t);
  const tabs = [["overview", "Overview"], ["assets", "Assets (" + d.assets.length + ")"], ["findings", "Findings (" + d.findings.length + ")"], ["reports", "Reports (" + d.reports.length + ")"]];
  const body = h("div");
  const render = () => {
    body.innerHTML = "";
    if (tab === "overview") body.append(progOverview(d));
    else if (tab === "assets") body.append(progAssets(d, id));
    else if (tab === "findings") body.append(progFindings(d, id));
    else body.append(progReports(d, id));
  };
  render();
  return page(
    h("a", { href: "#/programs", class: "row link-accent", style: { marginBottom: "14px" } }, icon("back", 14), "Programs"),
    h("div", { class: "page-head" },
      h("div", {},
        h("div", { class: "row", style: { gap: "9px" } }, p.is_private ? icon("lock", 15) : null, h("span", { class: "h1" }, p.name), p.is_watched ? icon("eye", 15) : null,
          badge(VIS[p.visibility] ? p.visibility.replace("_", " ") : p.visibility, VIS[p.visibility] || "--info"), staBadge(p.status)),
        h("div", { class: "sub" }, [p.company, p.platform].filter(Boolean).join(" · "))),
      h("div", { class: "row" },
        h("button", { class: "btn", onclick: () => programEditModal(p) }, icon("edit", 14), "Edit"),
        p.program_url ? h("a", { href: p.program_url, target: "_blank", class: "btn" }, icon("ext", 14), "Open") : null)),
    h("div", { class: "tabs" }, tabs.map(([t, l]) => h("button", { class: "tab" + (tab === t ? " active" : ""), onclick: () => setTab(t) }, l))),
    body);
}
function progOverview(d) {
  const p = d.program;
  const bounty = d.findings.reduce((a, f) => a + (f.bounty || 0), 0);
  const stat = (l, v) => h("div", { style: { textAlign: "center" } }, h("div", { style: { fontWeight: "700", fontSize: "20px" } }, v), h("div", { class: "faint", style: { fontSize: "11px" } }, l));
  return h("div", { class: "grid2" },
    h("div", { class: "stack", style: { gap: "16px" } },
      h("div", { class: "card pad" },
        h("div", { class: "row", style: { justifyContent: "space-around" } },
          stat("Assets", d.assets.length), stat("Subdomains", d.subdomains.length), stat("Findings", d.findings.length), stat("Reports", d.reports.length)),
        bounty > 0 ? h("div", { style: { marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)", textAlign: "center", color: "var(--ok)", fontWeight: "600" } }, money(bounty) + " earned") : null),
      (p.rules || p.rewards || p.tags) ? h("div", { class: "card pad" },
        p.rewards ? [h("div", { class: "kicker", style: { marginBottom: "5px" } }, "Rewards"), h("div", { class: "muted", style: { fontSize: "13px", marginBottom: "12px" } }, p.rewards)] : null,
        p.rules ? [h("div", { class: "kicker", style: { marginBottom: "5px" } }, "Rules"), h("div", { class: "muted", style: { fontSize: "13px", marginBottom: "12px", whiteSpace: "pre-wrap" } }, p.rules)] : null,
        p.tags ? h("div", { class: "chips" }, p.tags.split(",").filter(Boolean).map((t) => h("span", { class: "chip" }, "#" + t.trim()))) : null) : null,
      progNotes(p)),
    h("div", { class: "stack", style: { gap: "16px" } },
      p.is_private ? h("div", { class: "card pad", style: { borderColor: "color-mix(in srgb, var(--warn) 30%, var(--border))" } },
        h("div", { class: "kicker row", style: { gap: "5px", color: "var(--warn)", marginBottom: "8px" } }, icon("lock", 11), "Private invitation"),
        h("div", { class: "stack", style: { gap: "5px", fontSize: "12.5px" } },
          ["Status:" + (p.invitation_status || "—"), "Source:" + (p.invitation_source || "—")].map((s) => { const [k, v] = s.split(":"); return h("div", { class: "spread" }, h("span", { class: "faint" }, k), h("span", {}, v)); }))) : null,
      h("div", { class: "card" }, h("div", { class: "card-head" }, h("div", { class: "card-title" }, "Timeline")),
        h("div", { class: "pad stack", style: { gap: "12px", maxHeight: "400px", overflowY: "auto" } },
          d.timeline.length ? d.timeline.map((t) => h("div", { class: "row", style: { alignItems: "flex-start", gap: "9px" } },
            h("span", { class: "dot", style: { background: "var(--accent)", marginTop: "6px" } }),
            h("div", {}, h("div", { style: { fontSize: "13px" } }, t.title, t.detail ? h("span", { class: "faint" }, " · " + t.detail) : null), h("div", { class: "faint", style: { fontSize: "11px" } }, ago(t.at))))) : h("div", { class: "empty" }, "No events.")))));
}
function progNotes(p) {
  const st = h("span", { class: "save-state" }, "Saved");
  let t;
  const ta = textarea({ class: "input mono", rows: 10, value: p.notes || "", placeholder: "# Research notes\n\n- interesting areas\n- accounts\n", oninput: (e) => {
    st.textContent = "Unsaved…"; clearTimeout(t); t = setTimeout(async () => { st.textContent = "Saving…"; await PATCH("/programs/" + p.id, { notes: e.target.value }); st.textContent = "Saved"; }, 700);
  } });
  return h("div", { class: "card" }, h("div", { class: "card-head" }, h("div", { class: "card-title" }, "Research notes"), st), h("div", { class: "pad" }, ta));
}
function progAssets(d, pid) {
  const wrap = h("div", { class: "stack", style: { gap: "10px" } });
  const reload = () => go("#/programs/" + pid + "?tab=assets");
  const head = h("div", { class: "spread", style: { marginBottom: "6px" } }, h("div", { class: "muted", style: { fontSize: "13px" } }, d.assets.length + " assets"), h("button", { class: "btn primary sm", onclick: () => assetModal(pid, reload) }, icon("plus", 14), "Add Asset"));
  const cards = d.assets.length ? d.assets.map((a) => assetCard(a, d.subdomains.filter((s) => s.asset_id === a.id), pid, reload)) : [h("div", { class: "empty" }, "No assets yet.")];
  wrap.append(head, ...cards);
  return wrap;
}
function assetCard(a, subs, pid, reload) {
  const live = subs.filter((s) => s.status === "Live" || s.status === "Redirect").length;
  const detail = h("div", { style: { display: "none" } });
  let open = false, built = false;
  const chev = icon("chevR", 15);
  const toggle = () => { open = !open; detail.style.display = open ? "block" : "none"; chev.style.transform = open ? "rotate(90deg)" : ""; if (open && !built) { buildDetail(); built = true; } };
  function buildDetail() {
    const ta = textarea({ class: "input mono", rows: 2, placeholder: "paste subdomains — one per line…" });
    const list = h("div", { class: "stack", style: { gap: "0" } });
    const renderSubs = (arr) => { list.innerHTML = ""; if (!arr.length) { list.append(h("div", { class: "faint", style: { fontSize: "12px", padding: "8px 0" } }, "No subdomains yet.")); return; } arr.forEach((s) => list.append(subRow(s, reload))); };
    renderSubs(subs);
    detail.append(h("div", { style: { padding: "12px", borderTop: "1px solid var(--border)", background: "var(--panel-2)" } },
      ta,
      h("div", { class: "row", style: { marginTop: "8px" } },
        h("button", { class: "btn primary sm", onclick: async () => { if (!ta.value.trim()) return; await POST("/assets/" + a.id + "/subdomains", { hosts: ta.value }); toast("Subdomains added", "ok"); reload(); } }, icon("plus", 14), "Add"),
        subs.length ? h("button", { class: "btn sm", id: "probe" + a.id, onclick: async (e) => { e.target.closest("button").textContent = "Probing…"; const r = await POST("/assets/" + a.id + "/subdomains/probe", {}); toast("Probed " + r.probed, "ok"); reload(); } }, icon("radio", 14), "Probe live status") : null),
      h("div", { style: { marginTop: "10px" } }, list)));
  }
  return h("div", { class: "card" },
    h("div", { class: "row", style: { padding: "13px 15px", gap: "11px" } },
      h("button", { class: "icon-btn", style: { width: "24px", height: "24px" }, onclick: toggle }, chev),
      h("div", { style: { flex: "1", minWidth: "0" } },
        h("div", { class: "row", style: { gap: "8px" } }, h("span", { class: "mono", style: { fontWeight: "600", fontSize: "13px" } }, a.name), badge(a.type, "--blue"), subs.length ? badge(subs.length + " subs" + (live ? " · " + live + " live" : ""), "--info") : null),
        a.url ? h("div", { class: "faint mono", style: { fontSize: "11px", marginTop: "2px" } }, a.url) : null),
      h("button", { class: "icon-btn", onclick: () => assetModal(pid, reload, a) }, icon("edit", 14)),
      h("button", { class: "icon-btn", onclick: async () => { if (await confirmDialog("Delete asset “" + a.name + "” and its subdomains?")) { await DEL("/assets/" + a.id); reload(); } } }, icon("trash", 14))),
    detail);
}
function subRow(s, reload) {
  return h("div", { class: "row", style: { padding: "7px 2px", borderTop: "1px solid var(--border)", gap: "9px" } },
    h("span", { class: "dot", style: { background: "var(" + (SUBC[s.status] || "--faint") + ")" } }),
    h("span", { class: "mono", style: { fontSize: "12px" } }, s.host),
    s.http_code ? h("span", { class: "chip mono", style: { padding: "1px 6px" } }, s.http_code) : null,
    s.title ? h("span", { class: "faint", style: { fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "1" } }, s.title) : h("span", { style: { flex: "1" } }),
    h("span", { style: { fontSize: "11px", color: "var(" + (SUBC[s.status] || "--faint") + ")" } }, s.status),
    h("a", { href: "https://" + s.host, target: "_blank", class: "icon-btn", style: { width: "22px", height: "22px" } }, icon("ext", 12)),
    h("button", { class: "icon-btn", style: { width: "22px", height: "22px" }, onclick: async () => { if (await confirmDialog("Delete subdomain “" + s.host + "”?")) { await DEL("/subdomains/" + s.id); reload(); } } }, icon("trash", 12)));
}
function assetModal(pid, reload, existing) {
  const f = existing ? { host: existing.url || existing.name, type: existing.type, technology: existing.technology || "" } : { hosts: "", type: "Auto", technology: "" };
  const cleanName = (hh) => hh.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const cleanUrl = (hh) => (/^https?:\/\//.test(hh.trim()) ? hh.trim() : "https://" + cleanName(hh));
  const guess = (hh) => /graphql/i.test(hh) ? "GraphQL" : /(^|\.)api\./i.test(hh) ? "API" : "Web";
  const body = existing
    ? h("div", {}, field("Host", input({ value: f.host, oninput: (e) => (f.host = e.target.value) })),
      h("div", { class: "grid2" }, field("Type", select(["Web", "API", "Android", "iOS", "Cloud", "GraphQL", "WebSocket", "Network", "Repository", "Other"], f.type, { onchange: (e) => (f.type = e.target.value) })), field("Technology", input({ value: f.technology, oninput: (e) => (f.technology = e.target.value) }))))
    : h("div", {}, field("Hosts (one per line)", textarea({ rows: 4, class: "input mono", oninput: (e) => (f.hosts = e.target.value), placeholder: "app.acme.com\napi.acme.com" })),
      field("Type", select(["Auto", "Web", "API", "Android", "iOS", "Cloud", "GraphQL", "Other"], "Auto", { onchange: (e) => (f.type = e.target.value) })));
  openModal(h("div", { class: "modal", onclick: (e) => e.stopPropagation() },
    h("div", { class: "modal-head" }, h("div", { style: { fontWeight: "600" } }, existing ? "Edit Asset" : "Add Assets"), h("button", { class: "icon-btn", onclick: closeModal }, icon("x"))),
    h("div", { class: "modal-body" }, body),
    h("div", { class: "modal-foot" }, h("button", { class: "btn", onclick: closeModal }, "Cancel"),
      h("button", { class: "btn primary", onclick: async () => {
        if (existing) { await PATCH("/assets/" + existing.id, { name: cleanName(f.host), url: cleanUrl(f.host), type: f.type, technology: f.technology }); }
        else { const hosts = (f.hosts || "").split(/[\n,]+/).map((x) => x.trim()).filter(Boolean); for (const hh of hosts) await POST("/assets", { program_id: pid, name: cleanName(hh), url: cleanUrl(hh), type: f.type === "Auto" ? guess(hh) : f.type }); }
        closeModal(); toast("Saved", "ok"); reload();
      } }, "Save"))));
}
async function openReportFor(f, pid, target) {
  const det = await GET("/findings/" + f.id);
  if (det.report) return go("#/reports/" + det.report.id);
  const { id } = await POST("/reports", { title: f.title, program_id: pid || f.program_id, finding_id: f.id, severity: f.severity, body: window.__bbos.reportTemplate(f.title, f.severity, target || "`[asset]`"), folder: "Drafts" });
  go("#/reports/" + id);
}
function findingEditModal(f, reload) {
  const g = { title: f.title || "", severity: f.severity || "Medium", status: f.status || "Potential", vuln_class: f.vuln_class || "", cvss: f.cvss || "", cwe: f.cwe || "", bounty: f.bounty || 0, observation: f.observation || "" };
  openModal(h("div", { class: "modal", onclick: (e) => e.stopPropagation() },
    h("div", { class: "modal-head" }, h("div", { style: { fontWeight: "600" } }, "Edit Finding"), h("button", { class: "icon-btn", onclick: closeModal }, icon("x"))),
    h("div", { class: "modal-body" },
      field("Title", input({ value: g.title, oninput: (e) => (g.title = e.target.value), placeholder: "IDOR on /api/orders/:id" })),
      h("div", { class: "grid2" },
        field("Severity", select(["Critical", "High", "Medium", "Low", "Informational"], g.severity, { onchange: (e) => (g.severity = e.target.value) })),
        field("Status", select(["Potential", "Confirmed", "Submitted", "Triaged", "Accepted", "Resolved", "Duplicate", "Rejected"], g.status, { onchange: (e) => (g.status = e.target.value) }))),
      h("div", { class: "grid2" },
        field("Vulnerability class", input({ value: g.vuln_class, oninput: (e) => (g.vuln_class = e.target.value), placeholder: "IDOR / SSRF / XSS…" })),
        field("Bounty (USD)", input({ type: "number", min: "0", value: g.bounty, oninput: (e) => (g.bounty = e.target.value) }))),
      h("div", { class: "grid2" },
        field("CVSS", input({ value: g.cvss, oninput: (e) => (g.cvss = e.target.value), placeholder: "7.5" })),
        field("CWE", input({ value: g.cwe, oninput: (e) => (g.cwe = e.target.value), placeholder: "CWE-639" }))),
      field("Observation / notes", textarea({ rows: 4, value: g.observation, oninput: (e) => (g.observation = e.target.value), placeholder: "What you saw, where, and why it matters." }))),
    h("div", { class: "modal-foot" },
      h("button", { class: "btn", onclick: closeModal }, "Cancel"),
      h("button", { class: "btn primary", onclick: async () => {
        if (!g.title.trim()) return toast("Title required", "error");
        await PATCH("/findings/" + f.id, { title: g.title.trim(), severity: g.severity, status: g.status, vuln_class: g.vuln_class || null, cvss: g.cvss || null, cwe: g.cwe || null, bounty: Number(g.bounty) || 0, observation: g.observation || null });
        closeModal(); toast("Saved", "ok"); reload();
      } }, "Save"))));
}
function newFindingModal(d, pid, reload) {
  if (!d.assets.length) return confirmDialog({ title: "Add an asset first", message: "Findings bind to an asset. Add at least one asset before creating a finding.", confirm: "Go to Assets", danger: false }).then((ok) => ok && go("#/programs/" + pid + "?tab=assets"));
  const targets = [];
  d.assets.forEach((a) => { targets.push(["a:" + a.id, a.name]); d.subdomains.filter((s) => s.asset_id === a.id).forEach((s) => targets.push(["s:" + s.id, "  ↳ " + s.host])); });
  const g = { title: "", severity: "Medium", vuln_class: "", target: targets[0][0] };
  openModal(h("div", { class: "modal", onclick: (e) => e.stopPropagation() },
    h("div", { class: "modal-head" }, h("div", { style: { fontWeight: "600" } }, "New Finding"), h("button", { class: "icon-btn", onclick: closeModal }, icon("x"))),
    h("div", { class: "modal-body" },
      field("Title", input({ oninput: (e) => (g.title = e.target.value), placeholder: "IDOR on /api/orders/:id", autofocus: true })),
      field("Asset / subdomain", select(targets, g.target, { onchange: (e) => (g.target = e.target.value) })),
      h("div", { class: "grid2" },
        field("Severity", select(["Critical", "High", "Medium", "Low", "Informational"], "Medium", { onchange: (e) => (g.severity = e.target.value) })),
        field("Vulnerability class", input({ oninput: (e) => (g.vuln_class = e.target.value), placeholder: "IDOR" })))),
    h("div", { class: "modal-foot" },
      h("button", { class: "btn", onclick: closeModal }, "Cancel"),
      h("button", { class: "btn primary", onclick: async () => {
        if (!g.title.trim()) return toast("Title required", "error");
        const [kind, tid] = g.target.split(":");
        const aid = kind === "a" ? tid : (d.subdomains.find((s) => s.id === tid) || {}).asset_id;
        await POST("/findings", { program_id: pid, title: g.title.trim(), severity: g.severity, status: "Potential", vuln_class: g.vuln_class || null, asset_id: aid || null, subdomain_id: kind === "s" ? tid : null });
        closeModal(); toast("Finding added", "ok"); reload();
      } }, "Create"))));
}
function progFindings(d, pid) {
  const reload = () => go("#/programs/" + pid + "?tab=findings");
  const rows = d.findings.map((f) => {
    const asset = d.assets.find((a) => a.id === f.asset_id);
    const target = f.subdomain_host || (asset && asset.name);
    return h("div", { class: "card row", style: { padding: "11px 14px", gap: "12px" } },
      sevBadge(f.severity),
      h("div", { class: "row", style: { flex: "1", minWidth: "0", cursor: "pointer", gap: "8px" }, title: "Edit finding", onclick: () => findingEditModal(f, reload) }, h("span", { style: { fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, f.title), target ? h("span", { class: "faint mono", style: { fontSize: "11px" } }, target) : null),
      f.bounty > 0 ? h("span", { style: { color: "var(--ok)", fontWeight: "600", fontSize: "13px" } }, money(f.bounty)) : null,
      select(["Potential", "Confirmed", "Submitted", "Triaged", "Accepted", "Resolved", "Duplicate", "Rejected"], f.status, { style: { width: "140px" }, onchange: (e) => PATCH("/findings/" + f.id, { status: e.target.value }) }),
      h("button", { class: "icon-btn", title: "Edit finding", onclick: () => findingEditModal(f, reload) }, icon("edit", 15)),
      h("button", { class: "icon-btn", title: "Open report", onclick: () => openReportFor(f, pid, target) }, icon("file", 15)),
      h("button", { class: "icon-btn", title: "Delete finding", onclick: async () => { if (await confirmDialog("Delete finding “" + f.title + "”?")) { await DEL("/findings/" + f.id); reload(); } } }, icon("trash", 15)));
  });
  return h("div", { class: "stack", style: { gap: "10px" } },
    h("div", { class: "spread", style: { marginBottom: "6px" } }, h("div", { class: "muted", style: { fontSize: "13px" } }, d.findings.length + " findings"), h("button", { class: "btn primary sm", onclick: () => newFindingModal(d, pid, reload) }, icon("plus", 14), "New Finding")),
    d.findings.length ? rows : [h("div", { class: "empty" }, "No findings yet. New Finding binds to an asset — set its title, severity and bounty inline.")]);
}
function progReports(d, pid) {
  const reload = () => go("#/programs/" + pid + "?tab=reports");
  return d.reports.length ? h("div", { class: "grid3" }, d.reports.map((r) => reportCard(r, reload))) : h("div", { class: "empty" }, "No reports.");
}
function programEditModal(p) {
  const f = Object.assign({}, p);
  const body = h("div", {},
    h("div", { class: "grid2" },
      field("Name", input({ value: f.name, oninput: (e) => (f.name = e.target.value) })),
      field("Company", input({ value: f.company || "", oninput: (e) => (f.company = e.target.value) })),
      field("Platform", select(["HackerOne", "Bugcrowd", "Intigriti", "YesWeHack", "Immunefi", "Private", "Other"], f.platform, { onchange: (e) => (f.platform = e.target.value) })),
      field("Visibility", select(Object.keys(VIS).map((v) => [v, v.replace("_", " ")]), f.visibility, { onchange: (e) => (f.visibility = e.target.value) })),
      field("Status", select(["Active", "Paused", "Archived", "Closed", "Expired"], f.status, { onchange: (e) => (f.status = e.target.value) })),
      field("Program URL", input({ value: f.program_url || "", oninput: (e) => (f.program_url = e.target.value) }))),
    field("Rewards", input({ value: f.rewards || "", oninput: (e) => (f.rewards = e.target.value) })),
    field("Rules", textarea({ rows: 2, value: f.rules || "", oninput: (e) => (f.rules = e.target.value) })),
    field("Tags (comma)", input({ value: f.tags || "", oninput: (e) => (f.tags = e.target.value) })));
  openModal(h("div", { class: "modal", onclick: (e) => e.stopPropagation() },
    h("div", { class: "modal-head" }, h("div", { style: { fontWeight: "600" } }, "Edit Program"), h("button", { class: "icon-btn", onclick: closeModal }, icon("x"))),
    h("div", { class: "modal-body" }, body,
      h("label", { class: "row", style: { fontSize: "13px", color: "var(--muted)", cursor: "pointer" } }, h("input", { type: "checkbox", checked: f.is_watched ? true : null, onchange: (e) => (f.is_watched = e.target.checked) }), "Watch this program")),
    h("div", { class: "modal-foot" },
      h("button", { class: "btn danger", style: { marginRight: "auto" }, onclick: async () => { if (await confirmDialog("Delete program “" + p.name + "” and ALL its data?")) { await DEL("/programs/" + p.id); closeModal(); go("#/programs"); } } }, icon("trash", 14), "Delete"),
      h("button", { class: "btn", onclick: closeModal }, "Cancel"),
      h("button", { class: "btn primary", onclick: async () => { await PATCH("/programs/" + p.id, f); closeModal(); toast("Saved", "ok"); go("#/programs/" + p.id); } }, "Save"))));
}

/* ═══ FINDINGS ═══ */
async function viewFindings(_, query) {
  const qs = new URLSearchParams(); for (const k of ["severity", "status", "vuln_class"]) if (query[k]) qs.set(k, query[k]);
  const list = await GET("/findings?" + qs);
  const setF = (k, v) => { const q = Object.assign({}, query); v ? (q[k] = v) : delete q[k]; go("#/findings?" + new URLSearchParams(q)); };
  return page(
    h("div", { class: "page-head" }, h("div", {}, h("div", { class: "h1" }, "Findings"), h("div", { class: "sub" }, list.length + " findings"))),
    h("div", { class: "row", style: { gap: "8px", marginBottom: "16px" } },
      select([["", "All severities"], "Critical", "High", "Medium", "Low", "Informational"], query.severity || "", { style: { width: "160px" }, onchange: (e) => setF("severity", e.target.value) }),
      select([["", "All statuses"], "Potential", "Confirmed", "Submitted", "Triaged", "Accepted", "Resolved", "Duplicate", "Rejected"], query.status || "", { style: { width: "160px" }, onchange: (e) => setF("status", e.target.value) })),
    list.length ? h("div", { class: "card" }, h("table", { class: "table" },
      h("thead", {}, h("tr", {}, ["Severity", "Title", "Class", "Program", "Status", "Bounty", ""].map((t) => h("th", {}, t)))),
      h("tbody", {}, list.map((f) => h("tr", { class: "clickable", title: "Edit finding", onclick: () => findingEditModal(f, navigate) },
        h("td", {}, sevBadge(f.severity)),
        h("td", { style: { fontWeight: "500" } }, f.title),
        h("td", { class: "muted" }, f.vuln_class || "—"),
        h("td", { class: "muted" }, f.is_private ? [icon("lock", 11), " "] : null, f.program_name),
        h("td", {}, staBadge(f.status)),
        h("td", { style: { textAlign: "right" } }, f.bounty > 0 ? h("span", { style: { color: "var(--ok)", fontWeight: "600" } }, money(f.bounty)) : h("span", { class: "faint" }, "—")),
        h("td", { style: { textAlign: "right", width: "1%", whiteSpace: "nowrap" } },
          h("button", { class: "icon-btn", title: "Open report", onclick: (e) => { e.stopPropagation(); openReportFor(f, f.program_id, f.subdomain_host || f.asset_name); } }, icon("file", 15)),
          h("button", { class: "icon-btn", title: "Delete finding", onclick: async (e) => { e.stopPropagation(); if (await confirmDialog("Delete finding “" + f.title + "”?")) { await DEL("/findings/" + f.id); navigate(); } } }, icon("trash", 15)))))))) : h("div", { class: "empty" }, "No findings match."));
}

/* ═══ REPORTS ═══ */
async function viewReports(_, query) {
  const folder = query.folder || (query.favorite === "1" ? "Favorites" : "All");
  const qs = new URLSearchParams(); if (folder !== "All" && folder !== "Favorites") qs.set("folder", folder);
  if (folder === "Favorites") qs.set("favorite", "1"); if (query.status) qs.set("status", query.status);
  const list = await GET("/reports?" + qs);
  const newReport = async () => { const { id } = await POST("/reports", { title: "Untitled Report", body: "# Untitled Report\n\n## Summary\n\n" }); go("#/reports/" + id); };
  const FOLDERS = ["All", "Drafts", "Submitted", "Accepted", "Resolved", "Archived", "Favorites"];
  return page(
    h("div", { class: "page-head" }, h("div", {}, h("div", { class: "h1" }, "Reports"), h("div", { class: "sub" }, list.length + " reports")), h("button", { class: "btn primary", onclick: newReport }, icon("plus", 15), "New Report")),
    h("div", { class: "pill-tabs", style: { marginBottom: "18px", flexWrap: "wrap" } }, FOLDERS.map((f) => h("button", { class: folder === f ? "active" : "", onclick: () => go(f === "All" ? "#/reports" : f === "Favorites" ? "#/reports?favorite=1" : "#/reports?folder=" + f) }, f))),
    list.length ? h("div", { class: "grid3" }, list.map((r) => reportCard(r, navigate))) : h("div", { class: "empty" }, "No reports here yet."));
}
function reportCard(r, reload) {
  return h("div", { class: "card hover-card", style: { padding: "15px" } },
    h("div", { class: "spread" },
      h("a", { href: "#/reports/" + r.id, class: "row", style: { gap: "6px", minWidth: "0", fontWeight: "600" } }, r.is_favorite ? h("span", { style: { color: "var(--warn)" } }, icon("star", 13)) : null, h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.title)),
      h("div", { class: "row", style: { gap: "2px" } },
        h("button", { class: "icon-btn", title: "Clone", onclick: async () => { const c = await POST("/reports/" + r.id + "/clone"); go("#/reports/" + c.id); } }, icon("copy", 14)),
        h("button", { class: "icon-btn", onclick: async () => { if (await confirmDialog("Delete report “" + r.title + "”?")) { await DEL("/reports/" + r.id); reload(); } } }, icon("trash", 14)))),
    h("div", { class: "faint", style: { fontSize: "11.5px", marginTop: "3px" } }, r.program_name || "No program"),
    h("div", { class: "row", style: { marginTop: "11px", gap: "8px" } }, staBadge(r.status), r.severity ? h("span", { class: "faint", style: { fontSize: "11.5px" } }, r.severity) : null, h("span", { class: "faint", style: { marginLeft: "auto", fontSize: "11px" } }, r.word_count + "w · " + ago(r.updated_at))));
}

/* ═══ REPORT EDITOR ═══ */
function redact(s) {
  return (s || "").replace(/eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g, "[REDACTED-JWT]")
    .replace(/Bearer\s+(?!\[REDACTED)[\w.\-]{16,}/g, "Bearer [REDACTED]")
    .replace(/AKIA[0-9A-Z]{16}/g, "[REDACTED-AWS-KEY]");
}
window.__bbos.reportTemplate = function (title, sev, target) {
  return "# " + title + "\n\n## Summary\n\nA concise, impact-first description of the vulnerability.\n\n## Affected Asset\n\n" + target +
    "\n\n## Severity\n\n" + sev + "\n\n## Steps to Reproduce\n\n1. \n2. \n3. \n\n## Proof of Concept\n\n```http\nGET /path HTTP/2\nHost: example.com\nAuthorization: Bearer [REDACTED]\n```\n\n## Impact\n\n\n\n## Remediation\n\n\n\n## References\n";
};
async function viewReportEditor(id) {
  const { report: r } = await GET("/reports/" + id);
  if (!r) return h("div", { class: "page" }, h("div", { class: "empty" }, "Report not found."));
  const programs = await GET("/programs");
  const st = h("span", { class: "save-state" }, icon("check", 12), "Saved");
  let content = r.body || "", title = r.title || "";
  const preview = h("div", { class: "md" });
  const renderPrev = () => (preview.innerHTML = mdToHtml(content));
  renderPrev();
  let timer;
  const save = () => { st.innerHTML = ""; st.append(document.createTextNode("Saving…")); clearTimeout(timer); timer = setTimeout(async () => { await PATCH("/reports/" + id, { body: content, title }); st.innerHTML = ""; st.append(icon("check", 12), document.createTextNode("Saved")); }, 700); };
  const ta = h("textarea", { class: "editor-ta", spellcheck: "false" }); ta.value = content;
  ta.addEventListener("input", () => { content = ta.value; renderPrev(); save(); });
  const titleInp = h("input", { class: "editor-title", value: title }); titleInp.addEventListener("input", () => { title = titleInp.value; save(); });
  const exportAs = (fmt) => {
    const clean = redact(content);
    const data = fmt === "md" ? clean : "<!doctype html><meta charset=utf-8><title>" + title + "</title><style>body{font-family:system-ui;max-width:820px;margin:2rem auto;padding:0 1.5rem;line-height:1.6}pre{background:#f5f5f5;padding:1rem;border-radius:8px}code{font-family:monospace}</style>" + mdToHtml(clean);
    const blob = new Blob([data], { type: fmt === "md" ? "text/markdown" : "text/html" });
    const a = h("a", { href: URL.createObjectURL(blob), download: title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + "." + fmt }); a.click();
  };
  return h("div", { class: "editor" },
    h("div", { class: "editor-bar" },
      h("a", { href: "#/reports", class: "icon-btn" }, icon("back")),
      titleInp, st,
      h("div", { style: { width: "1px", height: "20px", background: "var(--border)" } }),
      h("span", { class: "faint", style: { fontSize: "12px" } }, "Status"),
      select(["Draft", "In Progress", "Ready", "Submitted", "Accepted", "Resolved", "Rejected", "Archived"], r.status, { style: { width: "130px" }, onchange: (e) => PATCH("/reports/" + id, { status: e.target.value }) }),
      h("span", { class: "faint", style: { fontSize: "12px" } }, "Severity"),
      select(["Critical", "High", "Medium", "Low", "Informational"], r.severity || "Medium", { style: { width: "120px" }, onchange: (e) => PATCH("/reports/" + id, { severity: e.target.value }) }),
      h("span", { class: "faint", style: { fontSize: "12px" } }, "Program"),
      select([["", "No program"], ...programs.map((p) => [p.id, p.name])], r.program_id || "", { style: { width: "150px" }, onchange: (e) => PATCH("/reports/" + id, { program_id: e.target.value || null }) }),
      h("div", { style: { marginLeft: "auto" }, class: "row" },
        h("button", { class: "btn danger sm", onclick: async () => { if (await confirmDialog("Delete report “" + title + "”?")) { await DEL("/reports/" + id); go("#/reports"); } } }, icon("trash", 14), "Delete"),
        h("button", { class: "btn sm", onclick: () => exportAs("md") }, icon("download", 14), "MD"),
        h("button", { class: "btn primary sm", onclick: () => exportAs("html") }, icon("download", 14), "HTML"))),
    h("div", { class: "editor-split" },
      h("div", { class: "editor-pane write" }, ta),
      h("div", { class: "editor-pane" }, h("div", { class: "editor-preview" }, preview))));
}

/* ═══ ANALYTICS ═══ */
async function viewAnalytics(_, query) {
  const programs = await GET("/programs");
  const a = await GET("/analytics" + (query.program_id ? "?program_id=" + query.program_id : ""));
  const months = [...new Set(a.reports_time.map((r) => r.month))].sort();
  const statuses = [...new Set(a.reports_time.map((r) => r.status))];
  const PAL = ["--accent", "--ok", "--warn", "--blue", "--crit", "--violet"];
  const chartCard = (title, node) => h("div", { class: "card" }, h("div", { class: "card-head" }, h("div", { class: "card-title" }, title)), h("div", { class: "pad" }, node));
  return page(
    h("div", { class: "page-head" },
      h("div", {}, h("div", { class: "h1" }, "Analytics"), h("div", { class: "sub" }, "Descriptive — no rankings, just your data.")),
      select([["", "All programs"], ...programs.map((p) => [p.id, p.name])], query.program_id || "", { style: { width: "200px" }, onchange: (e) => go("#/analytics" + (e.target.value ? "?program_id=" + e.target.value : "")) })),
    h("div", { class: "grid2" },
      chartCard("Bounty over time", a.bounty.length ? h("div", {},
        lineMulti(a.bounty.map((b) => b.month), [{ name: "Bounty", color: "var(--ok)", data: a.bounty.map((b) => b.bounty) }]),
        h("div", { class: "row", style: { marginTop: "10px", gap: "16px", flexWrap: "wrap" } }, a.bounty.map((b) => h("div", {}, h("div", { class: "faint", style: { fontSize: "11px" } }, b.month), h("div", { style: { fontWeight: "600", color: "var(--ok)" } }, money(b.bounty)))))) : h("div", { class: "empty" }, "No data")),
      chartCard("Reports over time", months.length ? h("div", {}, lineMulti(months, statuses.map((s, i) => ({ name: s, color: "var(" + PAL[i % PAL.length] + ")", data: months.map((m) => { const r = a.reports_time.find((x) => x.month === m && x.status === s); return r ? r.c : 0; }) }))),
        h("div", { class: "chips", style: { marginTop: "10px" } }, statuses.map((s, i) => h("span", { class: "row", style: { gap: "5px", fontSize: "11.5px" } }, h("span", { class: "dot", style: { background: "var(" + PAL[i % PAL.length] + ")" } }), s)))) : h("div", { class: "empty" }, "No data"))),
    h("div", { class: "grid2", style: { marginTop: "16px" } },
      chartCard("Findings by severity", a.by_severity.length ? h("div", { class: "row", style: { gap: "18px" } }, donut(a.by_severity.map((s) => ({ value: s.value, color: sevVar(s.name) }))),
        h("div", { class: "stack", style: { gap: "5px", flex: "1" } }, a.by_severity.map((s) => h("div", { class: "row" }, h("span", { class: "dot", style: { background: sevVar(s.name) } }), h("span", { class: "muted", style: { fontSize: "12.5px" } }, s.name), h("span", { style: { marginLeft: "auto", fontWeight: "600" } }, s.value))))) : h("div", { class: "empty" }, "No data")),
      chartCard("Vulnerability class", a.by_class.length ? hbars(a.by_class, "var(--accent)") : h("div", { class: "empty" }, "No data"))),
    h("div", { class: "grid2", style: { marginTop: "16px" } },
      chartCard("Status funnel", hbars(a.funnel, "var(--violet)")),
      chartCard("Bounty by program", h("table", { class: "table" }, h("tbody", {}, a.by_program.map((p) => h("tr", {}, h("td", { style: { fontWeight: "500" } }, p.name), h("td", { class: "tnum muted", style: { textAlign: "right" } }, p.findings + " findings"), h("td", { class: "tnum", style: { textAlign: "right", color: "var(--ok)", fontWeight: "600" } }, money(p.total)))))))));
}

/* ── boot ── */
window.addEventListener("hashchange", navigate);
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
});
buildShell();
if (!location.hash) location.hash = "#/";
navigate();
