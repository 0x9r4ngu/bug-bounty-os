/* ============================================================================
   bounty/os v2 — single-page app
   Dark zinc + emerald console over the pure-Python API in app.py.
   ========================================================================== */
(function () {
  'use strict';

  // ── tiny DOM helpers ──────────────────────────────────────────────────────
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const app = () => $('#app');
  const overlay = () => $('#overlay');

  const esc = (s) =>
    (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const attr = (s) => esc(s).replace(/`/g, '&#96;');

  // ── custom themed dropdown ─────────────────────────────────────────────────
  // Native <select> option popups are OS-rendered and can't be themed (they show
  // up white/blue over our dark UI). We keep the real <select> for state + events
  // + tests, hide it, and drive it from a fully-styled trigger + menu.
  const _DOWN_CARET = '<svg class="sel-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  function enhanceSelects(root) {
    $$('select.inp:not([data-enh]), select.prog-switch:not([data-enh])', root || document).forEach((sel) => {
      sel.dataset.enh = '1';
      const wrap = document.createElement('div');
      wrap.className = 'sel' + (sel.classList.contains('pf-status') ? ' sel-sm' : '') + (sel.classList.contains('prog-switch') ? ' sel-bare' : '');
      sel.parentNode.insertBefore(wrap, sel);
      wrap.appendChild(sel);
      const trg = document.createElement('button');
      trg.type = 'button';
      trg.className = 'sel-trg';
      trg.disabled = !!sel.disabled;
      if (sel.id) trg.dataset.for = sel.id;
      trg.innerHTML = '<span class="sel-val"></span>' + _DOWN_CARET;
      const menu = document.createElement('div');
      menu.className = 'sel-menu';
      Array.from(sel.options).forEach((o) => {
        const it = document.createElement('button');
        it.type = 'button';
        it.className = 'sel-opt';
        it.dataset.value = o.value;
        it.textContent = o.textContent;
        it.onclick = (e) => {
          e.stopPropagation();
          if (sel.value !== o.value) { sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
          sync(); close();
        };
        menu.appendChild(it);
      });
      wrap.appendChild(trg);
      wrap.appendChild(menu); // starts inside the wrapper; portaled to <body> while open
      const valEl = $('.sel-val', trg);
      const sync = () => {
        const o = sel.options[sel.selectedIndex];
        valEl.textContent = o ? o.textContent : '';
        $$('.sel-opt', menu).forEach((c) => c.classList.toggle('on', c.dataset.value === sel.value));
      };
      const close = () => {
        wrap.classList.remove('open');
        menu.classList.remove('open');
        if (menu.parentNode !== wrap) wrap.appendChild(menu); // bring it home so it's cleaned up on re-render
      };
      const place = () => {
        const r = trg.getBoundingClientRect();
        menu.style.left = r.left + 'px';
        menu.style.right = 'auto';
        menu.style.width = wrap.classList.contains('sel-bare') ? 'auto' : r.width + 'px';
        const mh = menu.offsetHeight;
        const below = r.bottom + 6, above = r.top - 6 - mh;
        menu.style.top = (below + mh > window.innerHeight - 4 && above > 4 ? above : below) + 'px';
      };
      const open = () => {
        closeAllSels();
        // portal to <body> so no ancestor overflow/stacking context can clip or cover it
        document.body.appendChild(menu);
        wrap.classList.add('open');
        menu.classList.add('open');
        place();
        const on = $('.sel-opt.on', menu);
        if (on) on.scrollIntoView({ block: 'nearest' });
      };
      wrap._close = close;
      trg.onclick = (e) => { e.stopPropagation(); if (sel.disabled) return; menu.classList.contains('open') ? close() : open(); };
      sel.addEventListener('change', sync);
      sync();
    });
  }
  function closeAllSels() { $$('.sel.open').forEach((s) => s._close && s._close()); }
  let _enhancing = false;
  const runEnhance = () => { if (_enhancing) return; _enhancing = true; try { enhanceSelects(document); } finally { _enhancing = false; } };

  // ── API ───────────────────────────────────────────────────────────────────
  async function api(method, path, body) {
    const opt = { method, headers: {} };
    if (body !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    const res = await fetch(path, opt);
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) {
      const msg = (data && data.error) || (typeof data === 'string' && data) || ('HTTP ' + res.status);
      throw new Error(msg);
    }
    return data;
  }
  const GET = (p) => api('GET', p);
  const POST = (p, b) => api('POST', p, b || {});
  const PATCH = (p, b) => api('PATCH', p, b || {});
  const DEL = (p) => api('DELETE', p);

  // ── formatting ──────────────────────────────────────────────────────────
  function money(v, sym) {
    sym = sym || '$';
    const n = Math.round(Number(v) || 0);
    return sym + n.toLocaleString('en-US');
  }
  function kmoney(v, sym) {
    sym = sym || '$';
    const n = Number(v) || 0;
    if (n >= 1000) return sym + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k';
    return sym + Math.round(n);
  }
  function timeAgo(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    const s = Math.max(0, (Date.now() - then) / 1000);
    if (s < 60) return Math.floor(s) + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 86400 * 30) return Math.floor(s / 86400) + 'd';
    if (s < 86400 * 365) return Math.floor(s / 86400 / 30) + 'mo';
    return Math.floor(s / 86400 / 365) + 'y';
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function monthLabel(m) {
    if (!m) return '';
    const [y, mo] = m.split('-');
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return (names[parseInt(mo, 10) - 1] || m) + " '" + (y || '').slice(2);
  }
  function initials(name) {
    if (!name) return '?';
    const p = name.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/);
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[1][0]).toUpperCase();
  }
  function debounce(fn, ms) {
    let t;
    return function () { clearTimeout(t); const a = arguments, c = this; t = setTimeout(() => fn.apply(c, a), ms); };
  }
  // restart a brief fade/rise on a container after its innerHTML is swapped (in-place re-renders)
  function animateIn(el, ms) {
    if (!el) return;
    el.style.animation = 'none'; void el.offsetWidth;
    el.style.animation = 'viewin ' + (ms || 200) + 'ms cubic-bezier(.22,.61,.36,1)';
  }

  const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low', 'Info'];
  const SEV_COLOR = { Critical: '#bf616a', High: '#d08770', Medium: '#ebcb8b', Low: '#88c0d0', Info: '#6e7891' };
  const PLATFORM_COLOR = {
    HackerOne: '#a78bfa', Bugcrowd: '#88c0d0', Intigriti: '#ebcb8b', YesWeHack: '#b48ead',
    Synack: '#d3868d', Immunefi: '#c9bafd', Private: '#9aa4bb', 'VDP / Direct': '#9aa4bb'
  };
  const platColor = (p) => PLATFORM_COLOR[p] || '#9aa4bb';
  const stClass = (s) => 'st-' + String(s || 'Potential').replace(/\s+/g, '');
  const FINDING_STATUSES = ['Potential', 'Confirmed', 'Submitted', 'Triaged', 'Accepted', 'Resolved'];

  // ── icons ─────────────────────────────────────────────────────────────────
  const I = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    activity: '<path d="M2 12h4l3-8 6 16 3-8h4"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    programs: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',
    assets: '<path d="M4 7l8-4 8 4-8 4z"/><path d="M4 12l8 4 8-4"/><path d="M4 17l8 4 8-4"/>',
    checklist: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m4 6 1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
    findings: '<path d="M12 2 3 6v6c0 5 3.8 9 9 10 5.2-1 9-5 9-10V6z"/><path d="M12 8v4M12 15v.5"/>',
    reports: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    analytics: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',
    edit: '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17z"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    download: '<path d="M12 4v11M8 11l4 4 4-4M5 20h14"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
  };
  function svg(name, size, opts) {
    opts = opts || {};
    const s = size || 14;
    const fill = opts.fill || 'none';
    const sw = opts.sw || 2;
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${I[name] || ''}</svg>`;
  }

  // ── toast + confirm ─────────────────────────────────────────────────────
  function toast(msg, kind) {
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.innerHTML = (kind === 'err' ? svg('close', 15) : kind === 'info' ? svg('activity', 15) : svg('check', 15)) +
      '<span>' + esc(msg) + '</span>';
    $('#toasts').appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s, transform .3s'; t.style.opacity = '0'; t.style.transform = 'translateX(12px)'; setTimeout(() => t.remove(), 300); }, 2800);
  }

  function confirmDialog(opts) {
    return new Promise((resolve) => {
      const o = overlay();
      o.innerHTML = `
        <div class="modal" data-cd>
          <div class="modal-box" style="width:420px">
            <div class="modal-h"><h3>${esc(opts.title || 'Are you sure?')}</h3></div>
            <div class="modal-body"><p class="muted" style="font-size:13px;line-height:1.6">${esc(opts.body || '')}</p></div>
            <div class="modal-foot">
              <button class="btn" data-no>Cancel</button>
              <button class="btn ${opts.danger ? 'danger' : 'primary'}" data-yes>${esc(opts.confirm || 'Confirm')}</button>
            </div>
          </div>
        </div>`;
      const close = (v) => { o.innerHTML = ''; resolve(v); };
      $('[data-no]', o).onclick = () => close(false);
      $('[data-yes]', o).onclick = () => close(true);
      $('[data-cd]', o).onclick = (e) => { if (e.target.hasAttribute('data-cd')) close(false); };
      $('[data-yes]', o).focus();
    });
  }

  // ── minimal markdown → html ───────────────────────────────────────────────
  function md(src) {
    if (!src) return '<p class="muted">Nothing here yet.</p>';
    const lines = String(src).replace(/\r\n/g, '\n').split('\n');
    let out = '', i = 0;
    const inline = (t) => esc(t)
      .replace(/`([^`]+)`/g, (m, c) => '<code>' + c + '</code>')
      // ![alt](url) → image, or a <video> when the URL is a video file
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, href) => /\.(mp4|mkv|webm|mov|m4v|ogg)(\?|$)/i.test(href)
        ? '<video controls src="' + esc(href) + '" class="md-media"></video>'
        : '<img src="' + esc(href) + '" alt="' + esc(alt) + '" class="md-media" loading="lazy">')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, txt, href) => '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + txt + '</a>');
    while (i < lines.length) {
      let ln = lines[i];
      if (/^```/.test(ln)) {
        i++; let code = '';
        while (i < lines.length && !/^```/.test(lines[i])) { code += lines[i] + '\n'; i++; }
        i++; out += '<pre><code>' + esc(code.replace(/\n$/, '')) + '</code></pre>'; continue;
      }
      if (/^\s*\|(.+)\|\s*$/.test(ln) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        const head = ln.split('|').slice(1, -1).map((c) => c.trim());
        i += 2; let body = '';
        while (i < lines.length && /^\s*\|(.+)\|\s*$/.test(lines[i])) {
          const cells = lines[i].split('|').slice(1, -1).map((c) => c.trim());
          body += '<tr>' + cells.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>'; i++;
        }
        out += '<table><thead><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table>';
        continue;
      }
      let m;
      if ((m = ln.match(/^(#{1,4})\s+(.*)$/))) { out += '<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>'; i++; continue; }
      if (/^\s*>/.test(ln)) { out += '<blockquote>' + inline(ln.replace(/^\s*>\s?/, '')) + '</blockquote>'; i++; continue; }
      if (/^\s*[-*+]\s+/.test(ln)) {
        out += '<ul>';
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { out += '<li>' + inline(lines[i].replace(/^\s*[-*+]\s+/, '')) + '</li>'; i++; }
        out += '</ul>'; continue;
      }
      if (/^\s*\d+\.\s+/.test(ln)) {
        out += '<ol>';
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { out += '<li>' + inline(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>'; i++; }
        out += '</ol>'; continue;
      }
      if (/^\s*(---|===)\s*$/.test(ln)) { out += '<hr>'; i++; continue; }
      if (/^\s*$/.test(ln)) { i++; continue; }
      let para = ln; i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,4}\s|```|\s*[-*+]\s|\s*\d+\.\s|\s*>)/.test(lines[i])) { para += ' ' + lines[i]; i++; }
      out += '<p>' + inline(para) + '</p>';
    }
    return out;
  }

  // ── global state ────────────────────────────────────────────────────────
  const S = {
    route: null,
    programs: [],        // cached program list
    currentProgram: localStorage.getItem('bos.program') || null,
  };
  function setProgram(id) { S.currentProgram = id; try { localStorage.setItem('bos.program', id); } catch (e) {} }

  async function ensurePrograms(force) {
    if (!S.programs.length || force) {
      S.programs = await GET('/api/programs');
      if ($('#sidebar')) renderSidebar(); // keep pinned programs in sync
    }
    return S.programs;
  }
  async function pickProgram(want) {
    await ensurePrograms();
    if (want && S.programs.some((p) => p.id === want)) { setProgram(want); return want; }
    if (S.currentProgram && S.programs.some((p) => p.id === S.currentProgram)) return S.currentProgram;
    if (S.programs[0]) { setProgram(S.programs[0].id); return S.programs[0].id; }
    return null;
  }

  // ── router ────────────────────────────────────────────────────────────────
  const NAV = [
    ['dashboard', 'Dashboard', 'G D', 'dashboard', '#/dashboard'],
    ['programs', 'Programs', 'G P', 'programs', '#/programs'],
    ['reports', 'Reports', 'G R', 'reports', '#/reports'],
  ];

  function parseHash() {
    let h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const q = {};
    if (qs) qs.split('&').forEach((kv) => { const [k, v] = kv.split('='); if (k) q[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
    return { name: path || 'dashboard', q };
  }
  function go(hash) { location.hash = hash; }
  function setQuery(q) {
    const { name } = parseHash();
    const qs = Object.keys(q).filter((k) => q[k] != null && q[k] !== '').map((k) => k + '=' + encodeURIComponent(q[k])).join('&');
    location.hash = '#/' + name + (qs ? '?' + qs : '');
  }

  const VIEWS = {};

  async function route() {
    const r = parseHash();
    S.route = r;
    try {
      const fn = VIEWS[r.name] || VIEWS.dashboard;
      await fn(r.q);
    } catch (e) {
      console.error(e);
      paint(r.name, [{ cur: 'Error' }], '', `<div class="empty"><div class="big">Something went wrong</div><div class="muted">${esc(e.message)}</div><button class="btn" onclick="location.reload()">Reload</button></div>`);
      toast(e.message, 'err');
    }
  }

  // ── persistent shell: built ONCE, then only the content area swaps ──────────
  // This is what makes navigation smooth — the sidebar and topbar are never
  // re-created, so there is no full-page flash on every click.
  function crumbsHtml(crumbs) {
    return crumbs.map((c) => c.cur
      ? `<span class="cur">${esc(c.cur)}</span>`
      : (c.href ? `<a href="${c.href}">${esc(c.label)}</a>` : `<span>${esc(c.label)}</span>`)
    ).join('<span class="sep">/</span>');
  }

  function ensureShell() {
    if ($('#view')) return;
    app().innerHTML = `
      <aside class="sidebar" id="sidebar"></aside>
      <div class="main">
        <header class="topbar">
          <div class="crumb" id="crumb"></div>
          <button class="cmd-btn right" data-cmdk>
            ${svg('search', 14)}
            <span class="q">Search or run a command…</span>
            <span class="kbd">Ctrl K</span>
          </button>
          <div class="topbar-actions" id="topbar-actions"></div>
        </header>
        <div class="view" id="view"></div>
      </div>`;
    $('[data-cmdk]').onclick = openCmdk;
    renderSidebar();
  }

  function renderSidebar() {
    const el = $('#sidebar'); if (!el) return;
    const items = NAV.map(([id, label, keys, icon, href]) => `
      <a class="nav-item" data-nav="${id}" href="${href}">
        <span class="nav-dot"></span><span class="lbl">${label}</span><span class="nav-keys">${keys}</span>
      </a>`).join('');
    const pins = (S.programs || []).slice(0, 5).map((p) => {
      const pct = progPct(p);
      const col = pct >= 60 ? 'var(--em)' : pct >= 30 ? 'var(--am)' : 'var(--muted-2)';
      return `<button class="pin-row" data-openprog="${p.id}">
        <span class="pin-tag">${esc(initials(p.name))}</span>
        <span class="nm">${esc(p.name)}</span>
        <span class="pin-pct" style="color:${col}">${pct}%</span></button>`;
    }).join('') || '<div style="padding:4px 8px;font-size:12px" class="muted-2">No programs yet</div>';
    el.innerHTML = `
      <div class="side-head">
        <div class="brand-mark">$</div>
        <div class="brand-name">bounty<span>/</span>os</div>
        <div class="brand-v">v2</div>
      </div>
      <div class="side-scroll">
        <div class="nav-label nav-sec-1">Workspace</div>
        <nav class="nav">${items}</nav>
        <div class="nav-label nav-sec-2">Programs</div>
        <div class="nav" style="gap:2px">${pins}</div>
      </div>
      <div class="side-foot">
        <div class="status-line"><span class="status-dot"></span> local · sqlite · live</div>
        <div class="foot-hint"><span class="kbd">?</span> Keyboard map</div>
      </div>`;
    $$('[data-openprog]', el).forEach((b) => b.onclick = () => go('#/program?id=' + b.dataset.openprog));
    if (S.route) setActiveNav(S.route.name); // rebuilding the sidebar drops .active — restore it
  }

  function setActiveNav(name) {
    $$('#sidebar .nav-item').forEach((n) => n.classList.toggle('active', n.dataset.nav === name));
  }

  // Swap only the content, breadcrumb and per-view actions. No full-page rebuild.
  function paint(active, crumbs, right, body, opts) {
    opts = opts || {};
    ensureShell();
    $('#crumb').innerHTML = crumbsHtml(crumbs);
    $('#topbar-actions').innerHTML = right || '';
    const view = $('#view');
    view.className = 'view' + (opts.flush ? ' flush' : '');
    view.innerHTML = body;
    view.scrollTop = 0;
    animateIn(view, 240); // re-trigger the fade/rise on every navigation (persistent element)
    setActiveNav(active);
    if (opts.mount) opts.mount();
  }

  function progPct(p) {
    // "progress" = testing-checklist completion across the program's scopes (from the API)
    return p ? Math.round(p.checklist_pct || 0) : 0;
  }

  // ============================================================================
  //  Dashboard
  // ============================================================================
  VIEWS.dashboard = async function () {
    paint('dashboard', [{ label: 'Workspace' }, { cur: 'Dashboard' }], '', `<div class="loading">loading dashboard…</div>`);
    const [ov, progs, an] = await Promise.all([GET('/api/overview'), ensurePrograms(), GET('/api/analytics')]);
    const k = ov.kpis;

    // severity spectrum
    const sevMap = {}; (ov.by_severity || []).forEach((s) => sevMap[s.name] = s.value);
    const sev = SEV_ORDER.map((name) => ({ name, n: sevMap[name] || 0, color: SEV_COLOR[name] }));
    const sevTotal = sev.reduce((a, b) => a + b.n, 0) || 1;
    const spectrum = sev.map((s) => `<div style="flex-grow:${s.n || 0.04};background:${s.color}"></div>`).join('');
    const spectrumLegend = sev.map((s) => `<span class="leg"><span class="sw" style="background:${s.color}"></span>${s.name} <b>${s.n}</b></span>`).join('');

    // earnings trend
    const trend = (ov.trend || []).slice(-12);
    const bars = trendBars(trend.map((t) => ({ label: monthLabel(t.month), v: t.bounty })), 760, 200);

    // platform distribution (join analytics.by_program -> program.platform)
    const platByName = {}; progs.forEach((p) => platByName[p.name] = p.platform || 'Private');
    const platTotals = {};
    (an.by_program || []).forEach((bp) => { const pl = platByName[bp.name] || 'Private'; platTotals[pl] = (platTotals[pl] || 0) + (bp.total || 0); });
    let plats = Object.keys(platTotals).map((name) => ({ name, total: platTotals[name] }));
    const platSum = plats.reduce((a, b) => a + b.total, 0);
    if (platSum === 0) { // fall back to finding counts per platform
      const cnt = {}; (an.by_program || []).forEach((bp) => { const pl = platByName[bp.name] || 'Private'; cnt[pl] = (cnt[pl] || 0) + (bp.findings || 0); });
      plats = Object.keys(cnt).map((name) => ({ name, total: cnt[name] }));
    }
    plats.sort((a, b) => b.total - a.total);
    const donut = donutChart(plats);

    // ── analytics (merged into the dashboard) ──
    const bmap = {}; (an.bounty || []).forEach((b) => bmap[b.month] = b.bounty || 0);
    const rmap = {}; (an.reports_time || []).forEach((r) => rmap[r.month] = (rmap[r.month] || 0) + r.c);
    const months = Array.from(new Set(Object.keys(bmap).concat(Object.keys(rmap)))).sort().slice(-12);
    const combo = comboChart(months.map((m) => ({ label: monthLabel(m), bounty: bmap[m] || 0, reports: rmap[m] || 0 })));
    const fmax = Math.max(1, ...(an.funnel || []).map((f) => f.value));
    const funnel = (an.funnel || []).map((f, i, arr) => {
      const conv = i === 0 ? '100%' : Math.round(f.value / (arr[0].value || 1) * 100) + '%';
      return `<div class="funnel-row"><div class="top"><span class="lbl">${esc(f.name)}</span><span class="n">${f.value}</span><span class="conv">${conv}</span></div>
        <div class="pbar"><i style="width:${Math.round(f.value / fmax * 100)}%;background:${['#a78bfa', '#88c0d0', '#ebcb8b', '#b48ead', '#d3868d'][i % 5]}"></i></div></div>`;
    }).join('') || '<div class="muted mini">No reports yet.</div>';
    const cmax = Math.max(1, ...(an.by_class || []).map((c) => c.value));
    const classes = (an.by_class || []).slice(0, 8).map((c) => `
      <div class="bar-row"><span class="lbl">${esc(c.name || 'Unclassified')}</span>
        <div class="pbar"><i style="width:${Math.round(c.value / cmax * 100)}%;background:var(--cy)"></i></div>
        <span class="n">${c.value}</span><span class="avg">—</span></div>`).join('') || '<div class="muted mini">No data yet.</div>';
    const pmax = Math.max(1, ...(an.by_program || []).map((p) => p.total));
    const byProg = (an.by_program || []).slice(0, 8).map((p) => `
      <div class="bar-row" style="grid-template-columns:130px 1fr auto"><span class="lbl">${esc(p.name)}</span>
        <div class="pbar"><i style="width:${Math.round(p.total / pmax * 100)}%"></i></div>
        <span class="avg">${money(p.total)}</span></div>`).join('') || '<div class="muted mini">No data yet.</div>';

    // what's next
    const next = (ov.next || []).map((n) => {
      const tag = n.label.includes('validate') ? { t: 'CHK', c: '#a78bfa', bg: 'var(--em-soft)' }
        : n.label.includes('unfinished') ? { t: 'DRAFT', c: '#9aa4bb', bg: 'var(--panel-3)' }
          : n.label.includes('response') ? { t: 'WAIT', c: '#88c0d0', bg: 'var(--cy-soft)' }
            : { t: 'INV', c: '#ebcb8b', bg: 'var(--am-soft)' };
      return `<a class="feed-row" href="${esc((n.to || '#/dashboard').replace('#/', '#/'))}">
        <span class="feed-tag" style="color:${tag.c};background:${tag.bg}">${tag.t}</span>
        <span class="txt"><b class="mono" style="color:var(--ink)">${n.count}</b> ${esc(n.label)}</span>
        <span class="feed-when">→</span></a>`;
    }).join('') || '<div class="muted" style="padding:12px 0;font-size:13px">All clear — nothing urgent. Nice.</div>';

    // recent findings feed
    const recent = (ov.recent || []).slice(0, 5).map((f) => `
      <a class="feed-row" href="#/reports?open=${f.id}">
        <span class="feed-tag sev-${esc(f.severity || 'Info')}">${esc(f.severity || 'Info').slice(0, 3).toUpperCase()}</span>
        <span class="txt">${esc(f.title)} <span class="muted-2">· ${esc(f.program_name || '')}</span></span>
        <span class="feed-when">${timeAgo(f.created_at)}</span></a>`).join('') || '<div class="muted mini" style="padding:8px 0">No reports yet.</div>';

    const activeCount = k.programs || 0;
    const pubCount = progs.filter((p) => !p.is_private).length;
    const privCount = progs.filter((p) => p.is_private).length;
    const totalProg = pubCount + privCount || 1;

    const body = `
      <div class="kpi-grid">
        <section class="kpi">
          <div class="row-flex"><span class="kpi-label">Total bounties earned</span></div>
          <div class="kpi-num">${money(k.total_bounty)}</div>
          <div class="kpi-sub"><span class="up">▲ lifetime</span><span>${k.findings} findings logged</span></div>
        </section>
        <section class="kpi">
          <span class="kpi-label">Active programs</span>
          <div class="kpi-num">${activeCount}</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <div class="split-bar"><div style="width:${Math.round(pubCount / totalProg * 100)}%;background:var(--cy)"></div><div style="flex-grow:1;background:var(--am)"></div></div>
            <div class="split-legend"><span><span style="color:var(--cy)">■</span> ${pubCount} public</span><span><span style="color:var(--am)">■</span> ${privCount} private</span></div>
          </div>
        </section>
        <section class="kpi kpi-split">
          <div><span class="kpi-label">Confirmed+</span><span class="kpi-num">${k.confirmed}</span><span class="kpi-label">validated</span></div>
          <div><span class="kpi-label">Reports</span><span class="kpi-num cy">${k.reports}</span><span class="kpi-label">${k.submitted} submitted</span></div>
        </section>
        <section class="kpi">
          <span class="kpi-label">Assets tracked</span>
          <div class="kpi-num am">${k.assets}</div>
          <div class="kpi-label">across ${progs.length} programs</div>
        </section>
      </div>

      <section class="card spectrum">
        <span class="spectrum-label">Severity spectrum</span>
        <div class="spectrum-bar">${spectrum}</div>
        <div class="spectrum-legend">${spectrumLegend}</div>
      </section>

      <div class="grid-2">
        <section class="card">
          <div class="card-h"><h2 class="card-title">Earnings trend</h2><span class="card-sub">payouts received per month</span></div>
          ${trend.length ? bars : `<div class="empty" style="padding:30px"><span class="muted">No payouts recorded yet.</span></div>`}
        </section>
        <section class="card">
          <div class="card-h"><h2 class="card-title">Platform distribution</h2><span class="card-sub right">by ${platSum ? 'earnings' : 'volume'}</span></div>
          <div style="display:flex;align-items:center;gap:18px">
            ${donut.svg}
            <div style="flex-grow:1;display:flex;flex-direction:column;gap:7px">${donut.legend}</div>
          </div>
        </section>
      </div>

      <section class="card">
        <div class="card-h"><h2 class="card-title">Bounties &amp; reports over time</h2>
          <span class="card-sub right"><span class="legend-dot" style="background:var(--em-mid)"></span> bounty paid &nbsp; <span class="legend-dot" style="background:var(--cy)"></span> reports</span></div>
        ${months.length ? combo : '<div class="empty" style="padding:30px"><span class="muted">No timeline data yet.</span></div>'}
      </section>

      <div class="grid-3">
        <section class="card"><div class="card-h"><h2 class="card-title">Status funnel</h2></div>${funnel}</section>
        <section class="card"><div class="card-h"><h2 class="card-title">Severity breakdown</h2><span class="card-sub right">count</span></div>${classes}</section>
        <section class="card"><div class="card-h"><h2 class="card-title">Bounty by program</h2><span class="card-sub right">net paid</span></div>${byProg}</section>
      </div>

      <div class="grid-2">
        <section class="card">
          <div class="card-h"><h2 class="card-title">Recent reports</h2></div>
          <div>${recent}</div>
        </section>
        <section class="card">
          <div class="card-h"><h2 class="card-title">What's next</h2><span class="card-sub right">by urgency</span></div>
          ${next}
        </section>
      </div>`;

    paint('dashboard', [{ label: 'Workspace' }, { cur: 'Dashboard' }], '', body);
  };

  function trendBars(data, W, H) {
    const max = Math.max(1, ...data.map((d) => d.v)) * 1.12;
    const left = 42, top = 16, base = H, plot = W - left;
    const slot = plot / Math.max(1, data.length), bw = Math.min(40, slot * 0.56);
    const gl = [0, 0.33, 0.66, 1].map((f) => `<line x1="${left}" y1="${top + (base - top) * (1 - f)}" x2="${W}" y2="${top + (base - top) * (1 - f)}" stroke="${f === 0 ? '#4c566a' : '#333a47'}"/>`).join('');
    const axis = [1, 0.66, 0.33, 0].map((f) => `<text x="0" y="${top + (base - top) * (1 - f) + 4}" fill="#6e7891" font-size="10" font-family="JetBrains Mono, monospace">${f === 0 ? '0' : kmoney(max * f)}</text>`).join('');
    const last = data.length - 1;
    const bars = data.map((d, i) => {
      const h = Math.round((d.v / max) * (base - top));
      const x = left + i * slot + (slot - bw) / 2;
      const fill = i === last ? '#a78bfa' : '#4c4370';
      return `<rect x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h}" rx="3" fill="${fill}"/>
        <text x="${(x + bw / 2).toFixed(1)}" y="${base + 18}" fill="#6e7891" font-size="10" text-anchor="middle" font-family="JetBrains Mono, monospace">${esc(d.label)}</text>`;
    }).join('');
    const pk = data[last];
    const peak = pk ? `<text x="${(left + last * slot + slot / 2).toFixed(1)}" y="${(base - (pk.v / max) * (base - top) - 8).toFixed(1)}" fill="#c9bafd" font-size="11" text-anchor="middle" font-family="JetBrains Mono, monospace">${money(pk.v)}</text>` : '';
    return `<svg width="100%" height="${H + 26}" viewBox="0 0 ${W} ${H + 26}" role="img">${gl}${axis}${bars}${peak}</svg>`;
  }

  function donutChart(items) {
    const colors = ['#a78bfa', '#88c0d0', '#ebcb8b', '#b48ead', '#d3868d', '#9aa4bb', '#c9bafd'];
    const total = items.reduce((a, b) => a + b.total, 0) || 1;
    const C = 2 * Math.PI * 70; let acc = 0;
    const circles = items.map((it, idx) => {
      const frac = it.total / total, len = frac * C;
      const c = `<circle cx="90" cy="90" r="70" fill="none" stroke="${colors[idx % colors.length]}" stroke-width="18" stroke-dasharray="${(len - 3).toFixed(1)} ${(C - len + 3).toFixed(1)}" stroke-dashoffset="${(-acc).toFixed(1)}" transform="rotate(-90 90 90)"/>`;
      acc += len; return c;
    }).join('');
    const s = `<svg width="140" height="140" viewBox="0 0 180 180" role="img">
      <circle cx="90" cy="90" r="70" fill="none" stroke="#2a2f3a" stroke-width="18"/>${circles}
      <text x="90" y="86" fill="#eceff4" font-size="22" font-weight="600" text-anchor="middle" font-family="JetBrains Mono, monospace">${items.length}</text>
      <text x="90" y="106" fill="#9aa4bb" font-size="11" text-anchor="middle">platforms</text></svg>`;
    const legend = items.length ? items.map((it, idx) => `
      <div style="display:flex;align-items:center;gap:8px;font-size:12px">
        <span class="legend-dot" style="background:${colors[idx % colors.length]}"></span>
        <span style="flex-grow:1;color:var(--ink-3)">${esc(it.name)}</span>
        <span class="mono" style="width:40px;text-align:right">${Math.round(it.total / total * 100)}%</span>
      </div>`).join('') : '<span class="muted mini">No data yet.</span>';
    return { svg: s, legend };
  }


  // ============================================================================
  //  Programs (+ drawer)
  // ============================================================================
  VIEWS.programs = async function (q) {
    const filter = q.filter || 'all';
    const progs = await ensurePrograms(true);
    const shown = progs.filter((p) =>
      filter === 'all' ? true :
        filter === 'public' ? !p.is_private :
          filter === 'private' ? p.is_private :
            filter === 'watched' ? p.is_watched : true);

    const filters = [['all', 'All', progs.length], ['public', 'Public', progs.filter((p) => !p.is_private).length],
    ['private', 'Private', progs.filter((p) => p.is_private).length], ['watched', 'Watched', progs.filter((p) => p.is_watched).length]]
      .map(([id, label, n]) => `<button class="chip ${filter === id ? 'on' : ''}" data-filter="${id}">${label} <span class="n">${n}</span></button>`).join('');

    const cards = shown.map((p) => {
      const pct = progPct(p);
      const col = pct >= 60 ? 'var(--em)' : pct >= 30 ? 'var(--am)' : 'var(--muted-2)';
      return `<div class="prog-card" data-open="${p.id}" tabindex="0">
        <div class="prog-card-top">
          <span class="pin-tag lg">${esc(initials(p.name))}</span>
          <div class="prog-card-title">
            <div class="cell-title">${esc(p.name)}</div>
            <div class="prog-card-badges">
              <span class="badge" style="color:${platColor(p.platform)};border-color:var(--border-2)"><span class="sw" style="background:${platColor(p.platform)}"></span>${esc(p.platform || '—')}</span>
              <span class="badge" style="color:${p.is_private ? 'var(--am)' : 'var(--cy)'};border-color:var(--border-2)">${p.is_private ? svg('lock', 10) : svg('globe', 10)} ${p.is_private ? 'Private' : 'Public'}</span>
            </div>
          </div>
          <button class="icon-btn danger prog-card-del" data-delprog="${p.id}" data-prog-name="${attr(p.name)}" title="Delete program">${svg('trash', 13)}</button>
        </div>
        <div class="prog-card-stats">
          <span>${p.asset_count || 0} <b class="muted-2">scopes</b></span>
          <span>${p.finding_count || 0} <b class="muted-2">reports</b></span>
        </div>
        <div class="pwrap"><span class="pbar"><i style="width:${pct}%;background:${col}"></i></span><span class="pct" style="color:${col}">${pct}%</span></div>
        <div class="mini muted-2">checklist</div>
      </div>`;
    }).join('');

    const body = `
      <div class="chips">${filters}<span class="hint">Sort: <span class="mono" style="color:var(--ink-3)">last activity</span></span></div>
      ${cards ? `<div class="prog-grid">${cards}</div>` : `<div class="empty"><div class="big">No programs in this view</div><button class="btn primary" data-newprog>${svg('plus', 14)} New program</button></div>`}`;

    const right = `<button class="btn" data-newprog>${svg('plus', 14)} New program</button>`;
    paint('programs', [{ label: 'Workspace' }, { cur: 'Programs' }], right, body);
    $$('[data-filter]').forEach((b) => b.onclick = () => setQuery(Object.assign({}, q, { filter: b.dataset.filter })));
    // Open the program as its own full page (not a side drawer).
    $$('.prog-card[data-open]').forEach((c) => {
      c.onclick = (e) => { if (e.target.closest('[data-delprog]')) return; go('#/program?id=' + c.dataset.open); };
      c.onkeydown = (e) => { if (e.key === 'Enter') go('#/program?id=' + c.dataset.open); };
    });
    $$('[data-delprog]').forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      if (!(await confirmDialog({ title: 'Delete program?', body: esc(b.dataset.progName) + ' and all its scopes, reports and checklist progress will be permanently deleted.', confirm: 'Delete', danger: true }))) return;
      try { await DEL('/api/programs/' + b.dataset.delprog); toast('Program deleted'); await ensurePrograms(true); renderSidebar(); route(); } catch (er) { toast(er.message, 'err'); }
    });
    $$('[data-newprog]').forEach((b) => b.onclick = () => newProgramModal());
  };

  // ============================================================================
  //  Program — full-page detail (opens in place of the list, not a side drawer)
  // ============================================================================
  VIEWS.program = async function (q) {
    const pid = q.id;
    if (!pid) { go('#/programs'); return; }
    const tab = q.tab || 'scope';
    paint('programs', [{ label: 'Workspace' }, { label: 'Programs', href: '#/programs' }, { cur: '…' }], '', `<div class="loading">loading program…</div>`);
    let d;
    try { d = await GET('/api/programs/' + pid); } catch (e) { toast(e.message, 'err'); go('#/programs'); return; }
    if (!d || !d.program) { toast('Program not found', 'err'); go('#/programs'); return; }
    const p = d.program;
    setProgram(pid);
    const pct = Math.round(p.checklist_pct || 0);

    const meta = [
      ['Platform', p.platform || '—'], ['Access', p.is_private ? 'Private' : 'Public'],
      ['Status', p.status || 'Active'], ['Findings', d.findings.length],
    ];
    const subsByAsset = {}; d.subdomains.forEach((s) => { (subsByAsset[s.asset_id] = subsByAsset[s.asset_id] || []).push(s); });
    const inScope = d.assets.map((a, ai) => {
      const subs = (subsByAsset[a.id] || []).slice().sort((x, y) => x.host.localeCompare(y.host));
      const live = subs.filter((s) => s.status === 'Live').length;
      const subRows = subs.map((s) => `
        <div class="sub-row">
          <button class="linklike host" data-open-report="subdomain" data-id="${s.id}" data-label="${attr(s.host)}" title="Open report for ${attr(s.host)}">${esc(s.host)}</button>
          <span>${statusBadge(s.status, s.http_code)}</span>
          <span class="cell-mut mini">${esc(s.title || '—')}</span>
          <button class="icon-btn danger" data-delsub="${s.id}" title="Delete subdomain">${svg('trash', 13)}</button>
        </div>`).join('') || '<div class="sub-row"><span class="muted mini">No subdomains yet — use “+ Subdomain”.</span></div>';
      return `<div class="tree-asset ${ai === 0 ? 'open' : ''}" data-asset="${a.id}">
        <div class="tree-head">
          <button class="tree-caret-btn" data-toggle="${a.id}" aria-label="Expand">${svg('chevron', 14)}</button>
          <button class="linklike host" data-open-report="asset" data-id="${a.id}" data-label="${attr(a.name)}" title="Open report for ${attr(a.name)}">${esc(a.name)}</button>
          <span class="type-tag">${esc(a.type || 'Web')}</span>
          <span class="mono mini muted-2 nowrap">${subs.length} sub</span>
          <span class="tree-actions">
            <button class="btn sm" data-addsub="${a.id}">${svg('plus', 12)} Subdomain</button>
            <button class="icon-btn danger" data-delasset="${a.id}" data-asset-name="${attr(a.name)}" title="Remove scope">${svg('trash', 13)}</button>
          </span>
        </div>
        <div class="sub-list" data-sublist="${a.id}" style="${ai === 0 ? '' : 'display:none'}">${subRows}</div>
      </div>`;
    }).join('') || '<div class="muted mini" style="padding:8px 0">No scope yet — add a domain, URL or IP.</div>';

    const tabs = [['scope', 'Scope'], ['checklist', 'Checklist'], ['findings', 'Findings'], ['notes', 'Notes'], ['timeline', 'Timeline']]
      .map(([id, label]) => `<button class="tab ${tab === id ? 'on' : ''}" data-ptab="${id}">${label}</button>`).join('');

    let panel = '';
    if (tab === 'checklist') {
      panel = `<div id="prog-checklist" class="prog-checklist"><div class="loading">loading checklist…</div></div>`;
    } else if (tab === 'findings') {
      panel = `<div id="prog-findings"><div class="loading">loading findings…</div></div>`;
    } else if (tab === 'scope') {
      panel = `
        <div class="meta-grid">${meta.map(([k, v]) => `<div class="meta-cell"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join('')}</div>
        <section class="card" style="margin-top:2px">
          <div class="section-h"><h3>In scope</h3><span class="count">${d.assets.length}</span>
            <button class="btn sm right" data-addasset>${svg('plus', 12)} Add scope</button></div>
          <div class="scope-tree">${inScope}</div>
          <div class="mini muted-2">Click a domain or subdomain to open its report.</div>
        </section>
        ${p.tags ? `<div class="chips">${p.tags.split(',').filter(Boolean).map((t) => `<span class="chip" style="pointer-events:none">${esc(t.trim())}</span>`).join('')}</div>` : ''}`;
    } else if (tab === 'notes') {
      panel = `
        <div class="section-h"><h3>Research notes</h3><span class="count" id="notes-state">Markdown · autosaved</span></div>
        <textarea class="notes-editor" id="prog-notes" style="min-height:400px" placeholder="# Notes&#10;&#10;- recon findings&#10;- auth flow quirks">${esc(p.notes || '')}</textarea>`;
    } else {
      const tl = (d.timeline || []).map((e, i, arr) => `
        <div class="tl-row">
          <div class="tl-rail"><span class="tl-node"></span>${i < arr.length - 1 ? '<span class="tl-line"></span>' : ''}</div>
          <div class="tl-body"><div class="tl-head"><span class="t">${esc(e.title)}</span><span class="when">${timeAgo(e.at)}</span></div>
          <div class="tl-kind">${esc(e.detail || '')}</div></div>
        </div>`).join('') || '<div class="muted mini">No timeline events.</div>';
      panel = `<div class="timeline">${tl}</div>`;
    }

    const body = `
      <div class="prog-page">
        <section class="card prog-hero">
          <div class="avatar lg">${esc(initials(p.name))}</div>
          <div style="flex-grow:1;min-width:0">
            <h1 class="prog-title">${esc(p.name)}</h1>
            <div class="drawer-badges">
              <span class="badge" style="color:${platColor(p.platform)};border-color:var(--border-2)"><span class="sw" style="background:${platColor(p.platform)}"></span>${esc(p.platform || '—')}</span>
              <span class="badge" style="color:${p.is_private ? 'var(--am)' : 'var(--cy)'};border-color:var(--border-2)">${p.is_private ? svg('lock', 10) : svg('globe', 10)} ${p.is_private ? 'Private' : 'Public'}</span>
              <span class="muted mini">edited ${timeAgo(p.updated_at)} ago</span>
            </div>
          </div>
          <div class="prog-actions">
            <button class="btn sm ghost" data-watch style="color:${p.is_watched ? 'var(--am)' : 'var(--muted)'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${p.is_watched ? 'var(--am)' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round">${I.star}</svg>${p.is_watched ? 'Watching' : 'Watch'}</button>
            <button class="icon-btn danger" data-delprog2 title="Delete program">${svg('trash', 13)}</button>
          </div>
          <div class="drawer-prog"><div class="big">${pct}%</div><div class="lbl">checklist</div></div>
        </section>
        <div class="tabs" style="margin-top:4px">${tabs}</div>
        <div class="prog-panel">${panel}</div>
      </div>`;

    paint('programs', [{ label: 'Workspace' }, { label: 'Programs', href: '#/programs' }, { cur: p.name }], '', body);

    if (tab === 'checklist') mountChecklist($('#prog-checklist'), pid);
    if (tab === 'findings') mountProgramFindings($('#prog-findings'), pid);
    $$('[data-ptab]').forEach((b) => b.onclick = () => setQuery({ id: pid, tab: b.dataset.ptab }));
    $('[data-watch]').onclick = async () => {
      try { await PATCH('/api/programs/' + pid, { is_watched: !p.is_watched }); toast(p.is_watched ? 'Unwatched' : 'Watching'); await ensurePrograms(true); renderSidebar(); setActiveNav('programs'); route(); }
      catch (e) { toast(e.message, 'err'); }
    };
    const addA = $('[data-addasset]'); if (addA) addA.onclick = () => addAssetModal(pid);
    $$('[data-toggle]').forEach((b) => b.onclick = () => {
      const id = b.dataset.toggle, wrap = $('.tree-asset[data-asset="' + id + '"]'), list = $('[data-sublist="' + id + '"]');
      const open = wrap.classList.toggle('open'); list.style.display = open ? '' : 'none';
    });
    $$('[data-open-report]').forEach((b) => b.onclick = () => openReportForTarget(b.dataset.openReport, b.dataset.id, pid, b.dataset.label));
    $$('[data-addsub]').forEach((b) => b.onclick = () => addSubModal(b.dataset.addsub, pid));
    $$('[data-delsub]').forEach((b) => b.onclick = async () => {
      if (!(await confirmDialog({ title: 'Delete subdomain?', body: 'This removes it from the scope.', confirm: 'Delete', danger: true }))) return;
      try { await DEL('/api/subdomains/' + b.dataset.delsub); toast('Subdomain deleted'); route(); } catch (e) { toast(e.message, 'err'); }
    });
    $$('[data-delasset]').forEach((b) => b.onclick = async () => {
      const aid = b.dataset.delasset, name = b.dataset.assetName;
      if (!(await confirmDialog({ title: 'Remove scope?', body: esc(name) + ' and its subdomains/checklist progress will be deleted.', confirm: 'Remove', danger: true }))) return;
      try { await DEL('/api/assets/' + aid); toast('Scope removed'); route(); } catch (e) { toast(e.message, 'err'); }
    });
    $('[data-delprog2]').onclick = async () => {
      if (!(await confirmDialog({ title: 'Delete program?', body: esc(p.name) + ' and all its scopes, reports and checklist progress will be permanently deleted.', confirm: 'Delete', danger: true }))) return;
      try { await DEL('/api/programs/' + pid); toast('Program deleted'); await ensurePrograms(true); renderSidebar(); go('#/programs'); } catch (e) { toast(e.message, 'err'); }
    };
    const notes = $('#prog-notes');
    if (notes) {
      const save = debounce(async () => {
        try { await PATCH('/api/programs/' + pid, { notes: notes.value }); $('#notes-state').textContent = '● autosaved'; }
        catch (e) { toast(e.message, 'err'); }
      }, 700);
      notes.oninput = () => { $('#notes-state').textContent = 'saving…'; save(); };
    }
  };

  // ============================================================================
  //  Assets & subdomains
  // ============================================================================
  VIEWS.assets = async function (q) {
    const pid = await pickProgram(q.program);
    if (!pid) return renderNoProgram('assets', 'Assets & subdomains');
    if (q.program !== pid) { setQuery({ program: pid }); return; }
    const d = await GET('/api/programs/' + pid);
    const p = d.program;
    const subsByAsset = {}; d.subdomains.forEach((s) => { (subsByAsset[s.asset_id] = subsByAsset[s.asset_id] || []).push(s); });
    const findByAsset = {}; d.findings.forEach((f) => { if (f.asset_id) findByAsset[f.asset_id] = (findByAsset[f.asset_id] || 0) + 1; });

    const assetsHtml = d.assets.map((a) => {
      const subs = (subsByAsset[a.id] || []).sort((x, y) => x.host.localeCompare(y.host));
      const subRows = subs.map((s) => `
        <div class="sub-row">
          <span class="host">${esc(s.host)}</span>
          <span class="cell-mut mini">${esc(s.title || '')}</span>
          <span class="sub-actions">
            <button class="icon-btn" title="Log finding" data-subfinding="${s.id}" data-subhost="${attr(s.host)}">${svg('plus', 13)}</button>
            <button class="icon-btn danger" title="Delete" data-delsub="${s.id}">${svg('trash', 13)}</button>
          </span>
        </div>`).join('') || '<div class="sub-row"><span class="muted mini">No subdomains yet — add some below.</span></div>';
      return `<div class="tree-asset" data-asset="${a.id}">
        <button class="tree-head" data-toggle="${a.id}">
          <span class="tree-asset-name"><span class="tree-caret">${svg('chevron', 14)}</span><span class="host">${esc(a.name)}</span><span class="type-tag">${esc(a.type || 'Web')}</span></span>
          <span class="cell-mut mini">${esc(a.technology || '')}</span>
          <span class="mono mini muted-2">${subs.length} sub</span>
          <span class="row-flex" style="justify-content:flex-end">
            ${findByAsset[a.id] ? `<span class="badge sev-Medium" style="background:var(--cy-soft);color:var(--cy)">${findByAsset[a.id]} finding${findByAsset[a.id] > 1 ? 's' : ''}</span>` : ''}
            <button class="btn sm" data-addsub="${a.id}">${svg('plus', 12)} Subdomains</button>
            <button class="icon-btn danger" data-delasset="${a.id}" data-asset-name="${attr(a.name)}" title="Delete asset">${svg('trash', 13)}</button>
          </span>
        </button>
        <div class="sub-list" data-sublist="${a.id}" style="display:none">${subRows}</div>
      </div>`;
    }).join('') || `<div class="empty"><div class="big">No assets in ${esc(p.name)}</div><button class="btn primary" data-addasset>${svg('plus', 14)} Add scope</button></div>`;

    const right = `<button class="btn" data-addasset>${svg('plus', 14)} Add scope</button>`;

    const body = `
      <div class="chips">
        ${progSwitcher(pid)}
        <span class="hint">${d.assets.length} scopes · ${d.subdomains.length} subdomains</span>
      </div>
      <div>${assetsHtml}</div>`;

    paint('assets', [{ label: esc(p.name) }, { cur: 'Assets & subdomains' }], right, body);
    wireProgSwitcher('assets');
    $$('[data-toggle]').forEach((b) => b.onclick = () => {
      const id = b.dataset.toggle, wrap = $('.tree-asset[data-asset="' + id + '"]'), list = $('[data-sublist="' + id + '"]');
      const open = wrap.classList.toggle('open'); list.style.display = open ? '' : 'none';
    });
    // open first asset by default
    const first = $('.tree-asset'); if (first) { first.classList.add('open'); $('[data-sublist="' + first.dataset.asset + '"]').style.display = ''; }
    $$('[data-addasset]').forEach((b) => b.onclick = () => addAssetModal(pid));
    $$('[data-addsub]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); addSubModal(b.dataset.addsub, pid); });
    $$('[data-delsub]').forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      if (!(await confirmDialog({ title: 'Delete subdomain?', body: 'This removes it from the asset.', confirm: 'Delete', danger: true }))) return;
      try { await DEL('/api/subdomains/' + b.dataset.delsub); toast('Subdomain deleted'); route(); } catch (er) { toast(er.message, 'err'); }
    });
    $$('[data-subfinding]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); newFindingModal({ program_id: pid, subdomain_id: b.dataset.subfinding }); });
    $$('[data-delasset]').forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      const name = b.dataset.assetName;
      if (!(await confirmDialog({ title: 'Delete asset?', body: esc(name) + ' and all its subdomains + checklist progress will be deleted.', confirm: 'Delete', danger: true }))) return;
      try { await DEL('/api/assets/' + b.dataset.delasset); toast('Asset deleted'); route(); } catch (er) { toast(er.message, 'err'); }
    });
  };

  function statusBadge(status, code) {
    const map = { Live: 'var(--em)', Redirect: 'var(--am)', Offline: 'var(--faint)', Unknown: 'var(--muted-2)' };
    const c = map[status] || 'var(--muted-2)';
    return `<span class="badge" style="color:${c};border-color:transparent"><span class="dot-status" style="background:${c}"></span>${esc(status || 'Unknown')}${code ? ' <span class="muted-2">' + code + '</span>' : ''}</span>`;
  }

  // ============================================================================
  //  Checklist
  // ============================================================================
  const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII'];
  let checklistScopeCloser = null; // outside-click closer for the scope dropdown

  // Build the scope options — every asset AND every subdomain gets its own checklist.
  // Scope tree: each domain (asset) with its subdomains nested; every node is its own scope.
  function buildScopeTree(d) {
    if (!d.assets || !d.assets.length) return [{ domain: 'General', subs: [] }];
    const byAsset = {}; (d.subdomains || []).forEach((s) => { (byAsset[s.asset_id] = byAsset[s.asset_id] || []).push(s.host); });
    return d.assets.map((a) => ({ domain: a.name, subs: (byAsset[a.id] || []).slice().sort((x, y) => x.localeCompare(y)) }));
  }
  function scopeTreeValues(tree) {
    const v = []; tree.forEach((dm) => { v.push(dm.domain); dm.subs.forEach((s) => v.push(s)); }); return v;
  }

  // Shared checklist widget: ALL parts render as collapsible dropdowns in one continuous
  // scroll (part 0 → end), with a sticky progress + section-jump rail on the far right.
  function checklistBodyHTML(tpl, scopeTree, scope, progress) {
    const pmap = {}; progress.forEach((r) => { if (r.scope === scope) pmap[r.item_key] = r; });
    const roman = (n) => ROMAN[n] || n;
    const partStats = tpl.parts.map((pt) => ({ total: pt.items.length, done: pt.items.filter((it) => pmap[it.key] && pmap[it.key].checked).length }));
    const totalItems = tpl.parts.reduce((a, pt) => a + pt.items.length, 0);
    const doneItems = partStats.reduce((a, s) => a + s.done, 0);
    const scopePct = Math.round(doneItems / (totalItems || 1) * 100);

    const scPctFor = (v) => {
      const done = tpl.parts.reduce((a, pt) => a + pt.items.filter((it) => { const r = progress.find((x) => x.scope === v && x.item_key === it.key); return r && r.checked; }).length, 0);
      return Math.round(done / (totalItems || 1) * 100);
    };

    // Scope tree box (domains expandable → subdomains nested); the active node is highlighted.
    const scopeTreeHTML = scopeTree.map((dm, di) => {
      const domActive = scope === dm.domain;
      const hasActiveSub = dm.subs.includes(scope);
      const open = domActive || hasActiveSub || (di === 0 && !scope) || di === 0;
      const subRows = dm.subs.map((sub) => `
        <button class="cst-row sub ${scope === sub ? 'active' : ''}" data-cst-scope="${attr(sub)}">
          <span class="cst-name">${esc(sub)}</span><span class="cst-pct">${scPctFor(sub)}%</span>
        </button>`).join('');
      return `<div class="cst-dom ${open ? 'open' : ''}">
        <div class="cst-domrow">
          <button class="cst-caret" data-cst-toggle="${di}" aria-label="Expand">${dm.subs.length ? svg('chevron', 12) : ''}</button>
          <button class="cst-row dom ${domActive ? 'active' : ''}" data-cst-scope="${attr(dm.domain)}">
            <span class="cst-name">${esc(dm.domain)}</span><span class="cst-pct">${scPctFor(dm.domain)}%</span>
          </button>
        </div>
        ${dm.subs.length ? `<div class="cst-subs">${subRows}</div>` : ''}
      </div>`;
    }).join('');

    const cleanT = (t) => esc(t.replace(/^Part\s+[IVX0-9]+\s*[-–]\s*/i, ''));

    const partsHTML = tpl.parts.map((pt, i) => {
      const st = partStats[i];
      const introHTML = (i === 0 && tpl.intro ? `<div class="chk-body chk-intro">${md(tpl.intro)}</div>` : '') + (pt.intro ? `<div class="chk-body chk-intro">${md(pt.intro)}</div>` : '');
      const items = pt.items.map((it) => {
        const done = pmap[it.key] && pmap[it.key].checked;
        return `<div class="chk-item ${done ? 'done' : ''}" data-item="${attr(it.key)}">
          <button class="chk-box" data-check="${attr(it.key)}" aria-pressed="${done ? 'true' : 'false'}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${I.check}</svg></button>
          <span class="chk-key">${esc(it.num)}</span>
          <div class="chk-main">
            <div class="txt">${esc(it.title)}</div>
            <div class="chk-body">${md(it.body)}</div>
          </div>
        </div>`;
      }).join('');
      return `<details class="chk-part" id="chk-part-${i}" data-part-idx="${i}" ${i === 0 ? 'open' : ''}>
        <summary class="chk-part-summary">
          <span class="chk-caret">${svg('chevron', 13)}</span>
          <span class="part-roman">${roman(i)}</span>
          <span class="chk-part-title">${cleanT(pt.title)}</span>
          <span class="part-frac" data-pfrac="${i}">${st.done}/${st.total}</span>
          <button class="btn sm chk-markall" data-markpart="${i}" title="Mark all in this section">${svg('check', 11)}</button>
        </summary>
        <div class="chk-part-body">${introHTML}${items}</div>
      </details>`;
    }).join('');

    const jumpList = tpl.parts.map((pt, i) => {
      const st = partStats[i];
      return `<button class="part-btn" data-jump="${i}">
        <span class="part-roman">${roman(i)}</span>
        <span class="nm">${cleanT(pt.title)}</span>
        <span class="part-frac" data-jfrac="${i}">${st.done}/${st.total}</span>
      </button>`;
    }).join('');

    return `
      <div class="chk-scopebar">
        <span class="lbl">Scope</span>
        <div class="chk-scope-dd" id="chk-scope-dd">
          <button class="chk-scope-btn" data-scope-toggle aria-haspopup="listbox">
            <span class="cst-name mono">${esc(scope)}</span>
            <span class="cst-pct">${scopePct}%</span>
            <span class="dd-caret">${svg('chevron', 14)}</span>
          </button>
          <div class="chk-scope-menu chk-scope-tree" role="listbox">${scopeTreeHTML}</div>
        </div>
        <span class="hint muted-2 mini right">pick a domain or subdomain — progress saved per scope</span>
      </div>
      <div class="chk-wrap2">
        <div class="chk-all">${partsHTML}</div>
        <aside class="chk-side">
          <div class="chk-ring">
            <div class="ring">${ringSvg(scopePct, 64, 7)}<div class="n">${scopePct}%</div></div>
            <div class="meta"><span class="nm">${esc(scope)}</span><span class="sub"><b>${doneItems}</b> of ${totalItems} checked</span></div>
          </div>
          <details class="chk-parts-dd" open>
            <summary>Jump to section <span class="mono mini muted-2">${tpl.parts.length}</span> ${svg('chevron', 12)}</summary>
            <div class="chk-parts-scroll">${jumpList}</div>
          </details>
        </aside>
      </div>`;
  }

  // Recompute all fractions + the ring purely from the DOM (no refetch) after a toggle.
  function updateChecklistCounts(root, tpl) {
    let total = 0, totalDone = 0;
    $$('.chk-part', root).forEach((det) => {
      const i = det.dataset.partIdx;
      const boxes = $$('[data-check]', det);
      const done = boxes.filter((b) => b.getAttribute('aria-pressed') === 'true').length;
      total += boxes.length; totalDone += done;
      const pf = $('[data-pfrac="' + i + '"]', root); if (pf) pf.textContent = done + '/' + boxes.length;
      const jf = $('[data-jfrac="' + i + '"]', root); if (jf) jf.textContent = done + '/' + boxes.length;
    });
    const pct = Math.round(totalDone / (total || 1) * 100);
    const nEl = $('.chk-ring .ring .n', root); if (nEl) nEl.textContent = pct + '%';
    const sub = $('.chk-ring .meta .sub', root); if (sub) sub.innerHTML = '<b>' + totalDone + '</b> of ' + total + ' checked';
    const arc = $('.chk-ring .ring svg .arc', root); if (arc) { const C = 2 * Math.PI * 27; arc.setAttribute('stroke-dasharray', (pct / 100 * C).toFixed(1) + ' ' + C.toFixed(1)); }
  }

  function wireChecklistCore(root, pid, tpl, scope, opts) {
    const saveCheck = async (key, checked) => { await POST('/api/programs/' + pid + '/checklist', { scope, item_key: key, checked }); };
    // scope dropdown: button toggles the menu; caret expands a domain; a node selects the scope
    const dd = $('#chk-scope-dd', root);
    const toggleBtn = $('[data-scope-toggle]', root);
    if (toggleBtn && dd) toggleBtn.onclick = (e) => { e.stopPropagation(); dd.classList.toggle('open'); };
    // close the menu on outside click (one shared listener, replaced each render)
    if (checklistScopeCloser) document.removeEventListener('click', checklistScopeCloser);
    checklistScopeCloser = (e) => { const d = $('#chk-scope-dd'); if (d && d.classList.contains('open') && !d.contains(e.target)) d.classList.remove('open'); };
    document.addEventListener('click', checklistScopeCloser);
    $$('[data-cst-toggle]', root).forEach((b) => b.onclick = (e) => { e.stopPropagation(); const dm = b.closest('.cst-dom'); if (dm) dm.classList.toggle('open'); });
    $$('[data-cst-scope]', root).forEach((b) => b.onclick = () => { if (dd) dd.classList.remove('open'); if (b.dataset.cstScope !== scope) opts.onScope(b.dataset.cstScope); });
    $$('[data-check]', root).forEach((b) => b.onclick = async () => {
      const key = b.dataset.check, item = $('.chk-item[data-item="' + cssq(key) + '"]', root);
      const now = !(b.getAttribute('aria-pressed') === 'true');
      b.setAttribute('aria-pressed', now ? 'true' : 'false');
      if (item) item.classList.toggle('done', now);
      updateChecklistCounts(root, tpl);
      try { await saveCheck(key, now); } catch (e) { toast(e.message, 'err'); }
    });
    $$('[data-jump]', root).forEach((b) => b.onclick = () => {
      const det = $('#chk-part-' + b.dataset.jump, root);
      if (det) { det.open = true; det.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
    // mark-all lives inside the <summary>; stop it from toggling the dropdown
    $$('[data-markpart]', root).forEach((b) => b.onclick = async (e) => {
      e.preventDefault(); e.stopPropagation();
      const det = $('#chk-part-' + b.dataset.markpart, root);
      for (const box of $$('[data-check]', det)) {
        if (box.getAttribute('aria-pressed') !== 'true') {
          box.setAttribute('aria-pressed', 'true');
          const it = box.closest('.chk-item'); if (it) it.classList.add('done');
          try { await saveCheck(box.dataset.check, true); } catch (er) {}
        }
      }
      updateChecklistCounts(root, tpl);
      toast('Section marked done');
    });
  }

  async function mountChecklist(container, pid) {
    const tpl = window.CHECKLIST_TEMPLATE;
    if (!tpl) { container.innerHTML = '<div class="muted mini">Checklist unavailable.</div>'; return; }
    let d;
    try { d = await GET('/api/programs/' + pid); } catch (e) { container.innerHTML = '<div class="muted mini">' + esc(e.message) + '</div>'; return; }
    const scopeTree = buildScopeTree(d);
    const scopeVals = scopeTreeValues(scopeTree);
    let scope = scopeVals[0];
    async function render() {
      let progress = [];
      try { progress = await GET('/api/programs/' + pid + '/checklist'); } catch (e) {}
      if (!scopeVals.includes(scope)) scope = scopeVals[0];
      container.innerHTML = checklistBodyHTML(tpl, scopeTree, scope, progress);
      animateIn(container);
      wireChecklistCore(container, pid, tpl, scope, { onScope: (sc) => { scope = sc; render(); } });
    }
    await render();
  }

  VIEWS.checklist = async function (q) {
    const pid = await pickProgram(q.program);
    if (!pid) return renderNoProgram('checklist', 'Testing checklist');
    if (q.program !== pid) { setQuery({ program: pid }); return; }
    const tpl = window.CHECKLIST_TEMPLATE;
    if (!tpl) return renderNoProgram('checklist', 'Testing checklist');
    const p = (S.programs.find((x) => x.id === pid)) || (await GET('/api/programs/' + pid)).program;
    paint('checklist', [{ label: esc(p.name) }, { cur: 'Testing checklist' }], `${progSwitcher(pid, true)}`, '<div id="chk-root"></div>');
    wireProgSwitcher('checklist');
    await mountChecklist($('#chk-root'), pid);
  };
  function cssq(s) { return String(s).replace(/"/g, '\\"'); }

  function ringSvg(pct, size, sw) {
    const r = (size - sw) / 2, C = 2 * Math.PI * r, c = size / 2;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#333a47" stroke-width="${sw}"/>
      <circle class="arc" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#a78bfa" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${(pct / 100 * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${c} ${c})"/></svg>`;
  }

  // ============================================================================
  //  Findings (+ detail aside)
  // ============================================================================
  VIEWS.findings = async function (q) {
    const status = q.status || 'all';
    let list = await GET('/api/findings' + (status !== 'all' ? '?status=' + encodeURIComponent(status) : ''));
    const all = status !== 'all' ? await GET('/api/findings') : list;
    const counts = {}; all.forEach((f) => counts[f.status] = (counts[f.status] || 0) + 1);

    const tabs = [['all', 'All', all.length]].concat(FINDING_STATUSES.concat(['Rejected', 'Duplicate']).map((s) => [s, s, counts[s] || 0]))
      .map(([id, label, n]) => `<button class="tab ${status === id ? 'on' : ''}" data-status="${id}">${label} <span class="n">${n}</span></button>`).join('');

    const rows = list.map((f) => `
      <button class="tbl-row ${q.open === f.id ? 'sel' : ''}" data-fopen="${f.id}" style="grid-template-columns:60px 2fr 1.2fr 1fr 90px 56px 80px 90px 80px">
        <span class="num muted-2 mini">${f.id.slice(0, 5)}</span>
        <span class="cell-title">${esc(f.title)}</span>
        <span class="cell-mut mini">${esc(f.subdomain_host || f.asset_name || f.program_name || '—')}</span>
        <span class="cell-mut mini">${esc(f.vuln_class || '—')}</span>
        <span><span class="sev sev-${esc(f.severity)}">${esc(f.severity)}</span></span>
        <span class="num mini">${f.cvss != null ? f.cvss : '—'}</span>
        <span class="num muted-2 mini">${esc(f.cwe || '—')}</span>
        <span><span class="st ${stClass(f.status)}">${esc(f.status)}</span></span>
        <span class="num right">${f.bounty ? money(f.bounty) : '—'}</span>
      </button>`).join('') || `<div class="empty"><div class="big">No findings ${status !== 'all' ? 'with status ' + status : 'yet'}</div><button class="btn primary" data-newfinding2>${svg('plus', 14)} Log finding</button></div>`;

    const body = `
      <div class="tabs">${tabs}</div>
      <div style="display:flex;gap:16px;align-items:flex-start;flex-grow:1;min-height:0">
        <div class="tbl" style="flex-grow:1">
          <div class="tbl-head" style="grid-template-columns:60px 2fr 1.2fr 1fr 90px 56px 80px 90px 80px">
            <span>ID</span><span>Title</span><span>Where</span><span>Class</span><span>Severity</span><span>CVSS</span><span>CWE</span><span>Status</span><span class="right">Bounty</span>
          </div>
          ${rows}
        </div>
        <div id="finding-detail" style="width:340px;flex-shrink:0"></div>
      </div>`;

    const right = `<span class="topbar-note">${list.length} shown</span>`;
    paint('findings', [{ label: 'Workspace' }, { cur: 'Findings' }], right, body);
    $$('[data-status]').forEach((b) => b.onclick = () => setQuery({ status: b.dataset.status === 'all' ? '' : b.dataset.status }));
    $$('[data-fopen]').forEach((b) => b.onclick = () => setQuery(Object.assign({}, q, { open: b.dataset.fopen })));
    const nf2 = $('[data-newfinding2]'); if (nf2) nf2.onclick = () => newFindingModal();
    if (q.open) showFindingDetail(q.open, q);
  };

  async function showFindingDetail(fid, q) {
    const box = $('#finding-detail'); if (!box) return;
    box.innerHTML = `<div class="card"><div class="loading" style="padding:20px">loading…</div></div>`;
    let d;
    try { d = await GET('/api/findings/' + fid); } catch (e) { toast(e.message, 'err'); return; }
    if (!d || !d.finding) { box.innerHTML = ''; return; }
    const f = d.finding;
    const fields = [
      ['Program', f.program_name], ['Asset', f.asset_name || '—'], ['Where', f.subdomain_host || '—'],
      ['Class', f.vuln_class || '—'], ['CWE', f.cwe || '—'], ['CVSS', f.cvss != null ? f.cvss : '—'],
      ['Bounty', f.bounty ? money(f.bounty) : '$0'], ['Found', fmtDate(f.discovered_at)],
    ];
    const pipe = FINDING_STATUSES.map((s) => {
      const on = FINDING_STATUSES.indexOf(s) <= FINDING_STATUSES.indexOf(f.status);
      return `<button class="stage ${f.status === s ? 'on' : on ? 'on' : ''}" data-setstatus="${s}" style="${f.status === s ? 'border-color:var(--em)' : ''}"><span class="sdot" style="${on ? 'background:var(--em)' : ''}"></span><span class="slbl">${s}</span>${f.status === s ? '<span class="mono mini" style="color:var(--em)">current</span>' : ''}</button>`;
    }).join('');

    box.innerHTML = `
      <div class="card" style="gap:14px;position:sticky;top:0">
        <div class="row-flex"><span class="mono mini muted-2">${f.id.slice(0, 6)}</span><span class="sev sev-${esc(f.severity)}">${esc(f.severity)}</span><span class="right mono mini muted-2">esc</span></div>
        <h2 style="font-size:16px;font-weight:600;margin:0">${esc(f.title)}</h2>
        <div class="meta-grid">${fields.map(([k, v]) => `<div class="meta-cell"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join('')}</div>
        <div class="field"><label>Observation</label><div class="chk-body" style="margin:0;color:var(--ink-3)">${md(f.observation || '_No observation recorded._')}</div></div>
        <div class="field"><label>Status pipeline</label><div style="display:flex;flex-direction:column;gap:6px">${pipe}</div></div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${d.report
        ? `<a class="btn primary sm" href="#/reports?open=${d.report.id}">Open report →</a>`
        : `<button class="btn primary sm" data-makereport>${svg('reports', 12)} Create report from finding <span class="k">R</span></button>`}
          <div class="row-flex"><button class="btn sm" data-editfinding>${svg('edit', 12)} Edit</button><button class="btn sm danger right" data-delfinding>${svg('trash', 12)} Delete</button></div>
        </div>
      </div>`;
    animateIn(box);

    $$('[data-setstatus]', box).forEach((b) => b.onclick = async () => {
      try { await PATCH('/api/findings/' + fid, { status: b.dataset.setstatus }); toast('Status → ' + b.dataset.setstatus); route(); } catch (e) { toast(e.message, 'err'); }
    });
    const mk = $('[data-makereport]', box); if (mk) mk.onclick = () => createReportFromFinding(f);
    $('[data-editfinding]', box).onclick = () => newFindingModal(f, true);
    $('[data-delfinding]', box).onclick = async () => {
      if (!(await confirmDialog({ title: 'Delete finding?', body: esc(f.title), confirm: 'Delete', danger: true }))) return;
      try { await DEL('/api/findings/' + fid); toast('Finding deleted'); setQuery({ status: q.status || '' }); } catch (e) { toast(e.message, 'err'); }
    };
  }

  // Open the report bound to an asset/subdomain — reuse an existing one, else create it.
  async function openReportForTarget(kind, id, programId, label) {
    const key = kind === 'asset' ? 'asset_id' : 'subdomain_id';
    try {
      const existing = await GET('/api/reports?' + key + '=' + encodeURIComponent(id));
      if (existing && existing.length) { go('#/reports?open=' + existing[0].id); return; }
      const body = `# ${label}\n\n## Summary\n\n\n\n## Affected asset\n\n\`${label}\`\n\n## Steps to reproduce\n\n1. \n2. \n\n## Proof of concept\n\n\`\`\`http\nGET / HTTP/2\nHost: ${label}\n\`\`\`\n\n## Impact\n\n\n\n## Remediation\n\n`;
      const payload = { program_id: programId, title: label + ' — report', body, status: 'Draft', folder: 'Drafts' };
      payload[key] = id;
      const r = await POST('/api/reports', payload);
      toast('Report created for ' + label);
      go('#/reports?open=' + r.id);
    } catch (e) { toast(e.message, 'err'); }
  }

  async function createReportFromFinding(f) {
    const target = f.subdomain_host || f.asset_name || '';
    const body = `# ${f.title}\n\n## Summary\n\n${f.observation || 'A concise, impact-first description of the vulnerability.'}\n\n## Affected asset\n\n\`${target}\`\n\n## Severity\n\n${f.severity}\n\n## Steps to reproduce\n\n1. \n2. \n3. \n\n## Proof of concept\n\n\`\`\`http\nGET /path HTTP/2\nHost: ${target || 'example.com'}\nAuthorization: Bearer [REDACTED]\n\`\`\`\n\n## Impact\n\n\n\n## Remediation\n\n\n\n## References\n\n${f.cwe ? '- ' + f.cwe : ''}\n`;
    try {
      const r = await POST('/api/reports', { finding_id: f.id, program_id: f.program_id, title: f.title, body, severity: f.severity, cvss: f.cvss, cwe: f.cwe, bounty: f.bounty || 0, status: 'Draft', folder: 'Drafts' });
      toast('Report drafted'); go('#/reports?open=' + r.id);
    } catch (e) { toast(e.message, 'err'); }
  }

  // The report IS the finding's writeup — open the finding's report, creating it if needed.
  async function openReportForFinding(fid) {
    try {
      const d = await GET('/api/findings/' + fid);
      if (d.report) { go('#/reports?open=' + d.report.id); return; }
      if (d.finding) await createReportFromFinding(d.finding);
    } catch (e) { toast(e.message, 'err'); }
  }

  // Program "Findings" tab — findings for THIS program only, with the asset/subdomain they
  // were found on, inline status, and a bounty field once accepted. Clicking opens the report.
  // In this app a finding IS a report. The program "Findings" tab lists the program's REPORTS,
  // with inline status/severity and a bounty field once accepted; clicking opens the editor.
  const REPORT_STATUSES = ['Draft', 'Submitted', 'Triaged', 'Accepted', 'Resolved', 'Rejected'];
  async function mountProgramFindings(container, pid) {
    const ACCEPTED = ['Accepted', 'Resolved'];
    let list = [];
    async function reload() {
      try { list = await GET('/api/reports?program_id=' + encodeURIComponent(pid)); } catch (e) { container.innerHTML = '<div class="muted mini">' + esc(e.message) + '</div>'; return; }
      render();
    }
    function render() {
      const rows = list.map((r) => {
        const where = r.subdomain_host || r.asset_name || '—';
        const accepted = ACCEPTED.includes(r.status);
        const statusOpts = REPORT_STATUSES.map((s) => `<option ${r.status === s ? 'selected' : ''}>${s}</option>`).join('');
        return `<div class="pf-row">
          <button class="linklike pf-title" data-openrep="${r.id}" title="Open report">${esc(r.title)}</button>
          <span class="mono mini muted-2 pf-where">${esc(where)}</span>
          <span>${r.severity ? `<span class="sev sev-${esc(r.severity)}">${esc(r.severity)}</span>` : '<span class="muted-2 mini">—</span>'}</span>
          <select class="inp pf-status" data-rstatus="${r.id}">${statusOpts}</select>
          <span class="pf-bounty">${accepted
          ? `<input class="inp pf-bounty-in" data-rbounty="${r.id}" type="number" min="0" step="50" value="${r.bounty || 0}" placeholder="$ bounty" title="Bounty awarded" />`
          : (r.bounty ? `<span class="mono">${money(r.bounty)}</span>` : '<span class="muted-2 mini">—</span>')}</span>
          <button class="btn sm" data-openrep="${r.id}">${svg('reports', 12)} Open</button>
          <button class="icon-btn danger" data-delrep="${r.id}" title="Delete report">${svg('trash', 13)}</button>
        </div>`;
      }).join('') || '<div class="muted mini" style="padding:14px">No reports yet. Create one with “New report”.</div>';
      container.innerHTML = `
        <div class="section-h"><h3>Findings</h3><span class="count">${list.length}</span>
          <button class="btn primary sm right" data-newrep>${svg('plus', 12)} New report</button></div>
        <div class="pf-list">
          <div class="pf-head"><span>Title</span><span>Where</span><span>Severity</span><span>Status</span><span>Bounty</span><span></span><span></span></div>
          ${rows}
        </div>
        <div class="mini muted-2" style="margin-top:8px">Set status to <b>Accepted</b> to record the bounty. Clicking a report opens the editor.</div>`;
      animateIn(container);
      $('[data-newrep]', container).onclick = () => createBlankReport(pid);
      $$('[data-openrep]', container).forEach((b) => b.onclick = () => go('#/reports?open=' + b.dataset.openrep));
      $$('[data-rstatus]', container).forEach((sel) => sel.onchange = async () => {
        const st = sel.value, folder = st === 'Draft' ? 'Drafts' : st;
        try { await PATCH('/api/reports/' + sel.dataset.rstatus, { status: st, folder }); toast('Status → ' + st); reload(); } catch (e) { toast(e.message, 'err'); }
      });
      $$('[data-rbounty]', container).forEach((inp) => {
        const save = debounce(async () => { try { await PATCH('/api/reports/' + inp.dataset.rbounty, { bounty: parseFloat(inp.value) || 0 }); } catch (e) { toast(e.message, 'err'); } }, 600);
        inp.oninput = save;
      });
      $$('[data-delrep]', container).forEach((b) => b.onclick = async () => {
        if (!(await confirmDialog({ title: 'Delete report?', confirm: 'Delete', danger: true }))) return;
        try { await DEL('/api/reports/' + b.dataset.delrep); toast('Report deleted'); reload(); } catch (e) { toast(e.message, 'err'); }
      });
    }
    await reload();
  }

  // "New report" — a quick modal (title + optional scope binding + severity), then open the editor.
  // "New report" — no modal: create a blank report and drop straight into the editor.
  async function createBlankReport(pid) {
    await ensurePrograms();
    const programId = pid || S.currentProgram || (S.programs[0] && S.programs[0].id);
    if (!programId) { toast('Create a program first', 'info'); return newProgramModal(); }
    try {
      const r = await POST('/api/reports', {
        program_id: programId, title: 'Untitled report', severity: 'Medium', status: 'Draft', folder: 'Drafts',
        body: '# Untitled report\n\n## Summary\n\n\n\n## Affected asset\n\n``\n\n## Steps to reproduce\n\n1. \n2. \n\n## Proof of concept\n\n```http\nGET / HTTP/2\nHost: \n```\n\n## Impact\n\n\n\n## Remediation\n\n',
      });
      go('#/reports?open=' + r.id);
    } catch (e) { toast(e.message, 'err'); }
  }

  // ============================================================================
  //  Reports (folder list + editor + rail)
  // ============================================================================
  const FOLDERS = ['Drafts', 'Submitted', 'Accepted', 'Resolved', 'Favorites'];
  VIEWS.reports = async function (q) {
    const folder = q.folder || 'All';
    const all = await GET('/api/reports');
    const list = folder === 'All' ? all : folder === 'Favorites' ? all.filter((r) => r.is_favorite) : all.filter((r) => r.folder === folder || r.status === folder);
    const openId = q.open || (list[0] && list[0].id);

    const folderBtns = [['All', 'All reports', all.length]].concat(
      FOLDERS.map((f) => [f, f, f === 'Favorites' ? all.filter((r) => r.is_favorite).length : all.filter((r) => r.folder === f || r.status === f).length]))
      .map(([id, label, n]) => `<button class="folder ${folder === id ? 'on' : ''}" data-folder="${id}">${svg('folder', 14)} ${esc(label)} <span class="n">${n}</span></button>`).join('');

    const cards = list.map((r) => `
      <button class="rep-card ${openId === r.id ? 'on' : ''}" data-repopen="${r.id}">
        <div class="rep-card-top"><span class="id mono">${r.id.slice(0, 6)}</span>${r.is_favorite ? '<span style="color:var(--am)">' + svg('star', 11, { fill: 'var(--am)' }) + '</span>' : ''}<span class="st ${stClass(r.status)} right">${esc(r.status)}</span></div>
        <span class="ttl">${esc(r.title)}</span>
        <span class="meta">${esc(r.program_name || '—')} · ${r.word_count || 0}w · ${timeAgo(r.updated_at)}</span>
      </button>`).join('') || '<div class="muted mini" style="padding:16px;text-align:center">No reports here.</div>';

    const body = `
      <div class="rep-layout">
        <div class="rep-folders">
          <div class="rep-folders-h"><span class="t">Reports</span><span class="mono mini muted-2 right">G R</span></div>
          <div class="folder-list">${folderBtns}</div>
          <div class="rep-list">${cards}</div>
        </div>
        <div class="rep-main" id="rep-main"><div class="loading">select a report</div></div>
      </div>`;

    const right = `<button class="btn primary" data-newreport>${svg('plus', 14, { sw: 2.4 })} New report</button>`;
    paint('reports', [{ label: 'Workspace' }, { cur: 'Reports' }], right, body, { flush: true });
    $('[data-newreport]').onclick = () => createBlankReport();
    $$('[data-folder]').forEach((b) => b.onclick = () => setQuery({ folder: b.dataset.folder === 'All' ? '' : b.dataset.folder }));
    $$('[data-repopen]').forEach((b) => b.onclick = () => setQuery({ folder: q.folder || '', open: b.dataset.repopen }));
    if (openId) renderReportEditor(openId, q); else $('#rep-main').innerHTML = `<div class="empty"><div class="big">No report selected</div></div>`;
  };

  async function renderReportEditor(rid, q) {
    const main = $('#rep-main'); if (!main) return;
    let d;
    try { d = await GET('/api/reports/' + rid); } catch (e) { toast(e.message, 'err'); return; }
    const r = d.report;
    if (!r) { main.innerHTML = `<div class="empty"><div class="big">Report not found</div></div>`; return; }

    const sevs = SEV_ORDER.map((s) => `<button class="radio ${r.severity === s ? 'on' : ''}" data-sev="${s}" style="${r.severity === s ? 'border-color:' + SEV_COLOR[s] + ';color:' + SEV_COLOR[s] : ''}">${s}</button>`).join('');
    const stages = [['Draft', 'Draft'], ['Submitted', 'Submitted'], ['Triaged', 'Triaged'], ['Accepted', 'Accepted'], ['Resolved', 'Resolved']]
      .map(([id, label]) => `<button class="stage ${r.status === id ? 'on' : ''}" data-repstatus="${id}"><span class="sdot"></span><span class="slbl">${label}</span>${r.status === id ? '<span class="mono mini" style="color:var(--em)">now</span>' : ''}</button>`).join('');
    const ledger = [
      ['Program', r.program_name || '—'], ['Platform', r.submission_platform || '—'], ['Severity', r.severity || '—'],
      ['CVSS', r.cvss != null ? r.cvss : '—'], ['CWE', r.cwe || '—'], ['Bounty', r.bounty ? money(r.bounty) : '$0'],
      ['Submitted', r.submitted_at ? fmtDate(r.submitted_at) : 'not yet'],
    ];

    main.innerHTML = `
      <div class="rep-head">
        <span class="id">${r.id.slice(0, 6)}</span>
        <button class="icon-btn" data-fav style="color:${r.is_favorite ? 'var(--am)' : 'var(--muted)'}"><svg width="15" height="15" viewBox="0 0 24 24" fill="${r.is_favorite ? 'var(--am)' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round">${I.star}</svg></button>
        <input class="rep-title-input" id="rep-title" value="${attr(r.title)}" />
        <span class="rep-saved" id="rep-saved"><span id="rep-wc">${r.word_count || 0}w</span> · saved ${timeAgo(r.updated_at)} ago</span>
        <button class="btn sm" data-clone>${svg('copy', 12)} Clone</button>
        <button class="btn sm" data-export>${svg('download', 12)} Export</button>
        <button class="btn primary sm" data-submit>Mark submitted</button>
      </div>
      <div class="rep-sub">
        <span class="lbl">Bound to</span>
        ${r.subdomain_host ? `<span class="badge" style="border-color:var(--border-2);color:var(--ink-3)">${svg('assets', 10)} ${esc(r.subdomain_host)}</span>`
        : r.asset_name ? `<span class="badge" style="border-color:var(--border-2);color:var(--ink-3)">${svg('assets', 10)} ${esc(r.asset_name)}</span>`
          : r.finding_id ? `<a href="#/findings?open=${r.finding_id}">finding ${r.finding_id.slice(0, 6)}</a>`
            : '<span class="muted-2">standalone</span>'}
        ${r.program_name ? `<span class="muted-2 mini">· ${esc(r.program_name)}</span>` : ''}
        <span class="right muted-2 mini">markdown · live preview · scroll-synced</span>
      </div>
      <div class="rep-editor">
        <section class="rep-src">
          <div class="rep-pane-h">
            <span class="fn">report.md</span>
            <button class="tool" data-md="bold" title="Bold (Ctrl+B)"><b>B</b></button>
            <button class="tool" data-md="italic" title="Italic (Ctrl+I)"><i>I</i></button>
            <button class="tool" data-md="code" title="Code">{ }</button>
            <button class="tool" data-attach title="Attach image or video">${svg('plus', 12)} attach</button>
            <button class="tool" data-copy title="Copy markdown">${svg('copy', 12)} copy</button>
            <input type="file" id="rep-file" accept=".png,.jpg,.jpeg,.mp4,.mkv,image/png,image/jpeg,video/mp4,video/x-matroska" hidden />
            <span class="right" id="rep-lines">0 lines</span>
          </div>
          <textarea id="rep-body" spellcheck="false" placeholder="Write the report… (drag an image/video in, or use Attach)">${esc(r.body || '')}</textarea>
        </section>
        <section class="rep-preview">
          <div class="rep-pane-h"><span>Preview</span><span class="tool right">rendered</span></div>
          <article class="md" id="rep-prev">${md(r.body)}</article>
        </section>
        <aside class="rep-rail">
          <div class="rail-sec"><span class="rlbl">Severity</span><div class="radiogroup">${sevs}</div></div>
          <div class="rail-sec"><span class="rlbl">Report status</span>${stages}</div>
          ${['Accepted', 'Resolved'].includes(r.status) ? `<div class="rail-sec"><span class="rlbl">Bounty awarded</span>
            <div class="pwrap"><span class="mono muted">$</span><input class="inp" id="rep-bounty" type="number" min="0" step="50" value="${r.bounty || 0}" placeholder="amount" /></div></div>` : ''}
          <div class="rail-sec"><span class="rlbl">Ledger</span><div class="rail-metrics">${ledger.map(([k, v]) => `<div class="m"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join('')}</div></div>
          <div class="rail-sec"><button class="btn sm danger" data-delreport>${svg('trash', 12)} Delete report</button></div>
        </aside>
      </div>`;
    animateIn(main);

    const bodyEl = $('#rep-body'), prev = $('#rep-prev'), lines = $('#rep-lines'), saved = $('#rep-saved'), wc = $('#rep-wc');
    const updLines = () => lines.textContent = (bodyEl.value.split('\n').length) + ' lines';
    updLines();
    const saveBody = debounce(async () => {
      try {
        await PATCH('/api/reports/' + rid, { body: bodyEl.value });
        const w = bodyEl.value.trim() ? bodyEl.value.trim().split(/\s+/).length : 0;
        wc.textContent = w + 'w'; saved.innerHTML = `<span id="rep-wc">${w}w</span> · saved just now`;
      } catch (e) { toast(e.message, 'err'); }
    }, 700);
    const onBodyChange = () => { prev.innerHTML = md(bodyEl.value); updLines(); saved.innerHTML = '<span id="rep-wc">' + wc.textContent + '</span> · saving…'; saveBody(); };
    bodyEl.oninput = onBodyChange;
    // insert text at the caret (used by toolbar + attachments)
    const insertAtCaret = (text) => {
      const s = bodyEl.selectionStart, e = bodyEl.selectionEnd, v = bodyEl.value;
      bodyEl.value = v.slice(0, s) + text + v.slice(e);
      bodyEl.selectionStart = bodyEl.selectionEnd = s + text.length;
      bodyEl.focus(); onBodyChange();
    };
    const wrapSel = (before, after) => {
      const s = bodyEl.selectionStart, e = bodyEl.selectionEnd, v = bodyEl.value, sel = v.slice(s, e) || 'text';
      bodyEl.value = v.slice(0, s) + before + sel + after + v.slice(e);
      bodyEl.selectionStart = s + before.length; bodyEl.selectionEnd = s + before.length + sel.length;
      bodyEl.focus(); onBodyChange();
    };
    $$('[data-md]').forEach((b) => b.onclick = () => {
      if (b.dataset.md === 'bold') wrapSel('**', '**');
      else if (b.dataset.md === 'italic') wrapSel('*', '*');
      else if (b.dataset.md === 'code') wrapSel('`', '`');
    });
    // Ctrl+B / Ctrl+I in the textarea
    bodyEl.onkeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); wrapSel('**', '**'); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); wrapSel('*', '*'); }
    };
    // copy the markdown
    $('[data-copy]').onclick = async () => {
      try { await navigator.clipboard.writeText(bodyEl.value); toast('Report markdown copied'); }
      catch (e) { bodyEl.select(); document.execCommand('copy'); toast('Copied'); }
    };
    // attach image / video → upload → insert markdown → preview shows it
    const fileInput = $('#rep-file');
    const ALLOWED_UPLOAD = /\.(png|jpe?g|mp4|mkv)$/i;
    const uploadAndInsert = async (file) => {
      if (!file) return;
      if (!ALLOWED_UPLOAD.test(file.name || '')) return toast('Only PNG, JPG, MP4 or MKV files are allowed', 'err');
      if (file.size > 1024 * 1024 * 1024) return toast('File too large (max 1 GB)', 'err');
      toast('Uploading ' + file.name + '…', 'info');
      try {
        // send the raw file body — the browser streams it, so there is no base64
        // memory blow-up even for a 1 GB video. The server validates by magic bytes.
        const res = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file });
        const up = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(up.error || ('Upload failed (' + res.status + ')'));
        const isVideo = /^video\//.test(up.type || '') || /\.(mp4|mkv)$/i.test(up.url);
        insertAtCaret('\n\n![' + (isVideo ? 'video' : (file.name || 'image')) + '](' + up.url + ')\n\n');
        toast('Attached ' + file.name);
      } catch (e) { toast(e.message || 'Upload failed', 'err'); }
    };
    $('[data-attach]').onclick = () => fileInput.click();
    fileInput.onchange = () => { if (fileInput.files[0]) uploadAndInsert(fileInput.files[0]); fileInput.value = ''; };
    // drag & drop + paste into the editor
    bodyEl.ondragover = (e) => { e.preventDefault(); bodyEl.classList.add('drop'); };
    bodyEl.ondragleave = () => bodyEl.classList.remove('drop');
    bodyEl.ondrop = (e) => { e.preventDefault(); bodyEl.classList.remove('drop'); if (e.dataTransfer.files[0]) uploadAndInsert(e.dataTransfer.files[0]); };
    bodyEl.onpaste = (e) => { const f = [...(e.clipboardData.files || [])][0]; if (f && /^(image|video)\//.test(f.type)) { e.preventDefault(); uploadAndInsert(f); } };
    $('#rep-title').onchange = async (e) => { try { await PATCH('/api/reports/' + rid, { title: e.target.value }); toast('Title saved'); } catch (er) { toast(er.message, 'err'); } };
    $('[data-fav]').onclick = async () => { try { await PATCH('/api/reports/' + rid, { is_favorite: !r.is_favorite }); renderReportEditor(rid, q); } catch (e) { toast(e.message, 'err'); } };
    $$('[data-sev]').forEach((b) => b.onclick = async () => { try { await PATCH('/api/reports/' + rid, { severity: b.dataset.sev }); renderReportEditor(rid, q); } catch (e) { toast(e.message, 'err'); } });
    $$('[data-repstatus]').forEach((b) => b.onclick = async () => {
      const st = b.dataset.repstatus, folder = st === 'Draft' ? 'Drafts' : st;
      try { await PATCH('/api/reports/' + rid, { status: st, folder }); toast('Status → ' + st); route(); } catch (e) { toast(e.message, 'err'); }
    });
    const bountyEl = $('#rep-bounty');
    if (bountyEl) {
      const saveB = debounce(async () => {
        try { await PATCH('/api/reports/' + rid, { bounty: parseFloat(bountyEl.value) || 0 }); const led = $$('.rail-metrics .m').find((m) => m.textContent.trim().startsWith('Bounty')); if (led) $('.v', led).textContent = money(parseFloat(bountyEl.value) || 0); } catch (e) { toast(e.message, 'err'); }
      }, 500);
      bountyEl.oninput = saveB;
    }
    $('[data-submit]').onclick = async () => { try { await PATCH('/api/reports/' + rid, { status: 'Submitted', folder: 'Submitted' }); toast('Marked submitted'); route(); } catch (e) { toast(e.message, 'err'); } };
    $('[data-clone]').onclick = async () => { try { const c = await POST('/api/reports/' + rid + '/clone', {}); toast('Cloned'); setQuery({ folder: q.folder || '', open: c.id }); } catch (e) { toast(e.message, 'err'); } };
    $('[data-export]').onclick = () => {
      const blob = new Blob([bodyEl.value], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = (r.title || 'report').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.md';
      a.click(); URL.revokeObjectURL(url); toast('Exported ' + a.download);
    };
    $('[data-delreport]').onclick = async () => {
      if (!(await confirmDialog({ title: 'Delete report?', body: esc(r.title), confirm: 'Delete', danger: true }))) return;
      try { await DEL('/api/reports/' + rid); toast('Report deleted'); setQuery({ folder: q.folder || '' }); } catch (e) { toast(e.message, 'err'); }
    };
  }

  // ============================================================================
  //  Analytics
  // ============================================================================
  // Analytics is merged into the dashboard now — keep the route working as a redirect.
  VIEWS.analytics = async function () { go('#/dashboard'); };

  function comboChart(data) {
    const W = 1100, H = 200, left = 42, top = 16, base = 160;
    const bmax = Math.max(1, ...data.map((d) => d.bounty)) * 1.15;
    const rmax = Math.max(1, ...data.map((d) => d.reports));
    const slot = (W - left) / Math.max(1, data.length), bw = Math.min(46, slot * 0.5);
    const gl = [top, (top + base) / 2, base].map((y, i) => `<line x1="${left}" y1="${y}" x2="${W}" y2="${y}" stroke="${i === 2 ? '#4c566a' : '#333a47'}"/>`).join('');
    const ax = `<text x="0" y="${top + 4}" fill="#6e7891" font-size="10" font-family="JetBrains Mono, monospace">${kmoney(bmax)}</text><text x="0" y="${(top + base) / 2 + 4}" fill="#6e7891" font-size="10" font-family="JetBrains Mono, monospace">${kmoney(bmax / 2)}</text>`;
    const bars = data.map((d, i) => {
      const h = Math.round((d.bounty / bmax) * (base - top)), x = left + i * slot + (slot - bw) / 2;
      return `<rect x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h}" rx="3" fill="#4c4370"/>
        <text x="${(x + bw / 2).toFixed(1)}" y="${base + 18}" fill="#6e7891" font-size="10" text-anchor="middle" font-family="JetBrains Mono, monospace">${esc(d.label)}</text>`;
    }).join('');
    const pts = data.map((d, i) => { const cx = left + i * slot + slot / 2, cy = base - (d.reports / rmax) * (base - top); return [cx, cy]; });
    const line = `<polyline points="${pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" fill="none" stroke="#88c0d0" stroke-width="2" stroke-linejoin="round"/>`;
    const dots = pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="#1a1d24" stroke="#88c0d0" stroke-width="2"/>${data[i].reports ? `<text x="${p[0].toFixed(1)}" y="${(p[1] - 8).toFixed(1)}" fill="#a3d4e0" font-size="10" text-anchor="middle" font-family="JetBrains Mono, monospace">${data[i].reports}</text>` : ''}`).join('');
    return `<svg width="100%" height="${H + 26}" viewBox="0 0 ${W} ${H + 26}" role="img">${gl}${ax}${bars}${line}${dots}</svg>`;
  }

  // ── no-program placeholder ────────────────────────────────────────────────
  function renderNoProgram(active, title) {
    const body = `<div class="empty"><span>${svg('programs', 40)}</span><div class="big">No program selected</div>
      <div class="muted">Create a program first, then its assets and checklist live here.</div>
      <button class="btn primary" data-newprog>${svg('plus', 14)} New program</button></div>`;
    paint(active, [{ cur: title }], '', body);
    const b = $('[data-newprog]'); if (b) b.onclick = () => newProgramModal();
  }

  function progSwitcher(pid, compact) {
    const opts = S.programs.map((p) => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    return `<label class="chip" style="gap:8px"><span class="muted-2 mini">Program</span><select class="prog-switch" style="background:transparent;border:0;color:var(--ink);outline:none;font-size:12px">${opts}</select></label>`;
  }
  function wireProgSwitcher(view) {
    const sel = $('.prog-switch'); if (!sel) return;
    sel.onchange = () => { setProgram(sel.value); setQuery({ program: sel.value }); };
  }

  // ============================================================================
  //  Command palette
  // ============================================================================
  let cmdkState = null;
  function openCmdk() {
    const o = overlay();
    cmdkState = { rows: [], active: 0, query: '' };
    o.insertAdjacentHTML('beforeend', `
      <div class="cmdk-scrim" data-cmdscrim>
        <div class="cmdk" role="dialog">
          <div class="cmdk-input-row">${svg('search', 16, { sw: 2 })}
            <input id="cmdk-input" placeholder="Type a command, program, asset or finding…" autocomplete="off" />
            <span class="kbd">Esc</span></div>
          <div class="cmdk-results" id="cmdk-results"></div>
          <div class="cmdk-foot"><span><span class="kbd">↑↓</span> navigate</span><span><span class="kbd">↵</span> run</span><span><span class="kbd">&gt;</span> commands</span><span class="count" id="cmdk-count">—</span></div>
        </div>
      </div>`);
    const inp = $('#cmdk-input');
    const run = debounce(() => cmdkSearch(inp.value), 140);
    inp.oninput = () => { cmdkState.query = inp.value; run(); };
    inp.onkeydown = cmdkKeys;
    $('[data-cmdscrim]', o).onclick = (e) => { if (e.target.hasAttribute('data-cmdscrim')) closeCmdk(); };
    cmdkSearch('');
    setTimeout(() => inp.focus(), 10);
  }
  function closeCmdk() { const s = $('.cmdk-scrim'); if (s) s.remove(); cmdkState = null; }

  const COMMANDS = [
    { label: 'Go to Dashboard', sub: 'overview + analytics', keys: 'G D', run: () => go('#/dashboard'), glyph: 'dashboard' },
    { label: 'Go to Programs', sub: '', keys: 'G P', run: () => go('#/programs'), glyph: 'programs' },
    { label: 'Go to Reports', sub: '', keys: 'G R', run: () => go('#/reports'), glyph: 'reports' },
    { label: 'New program', sub: '', keys: '', run: () => { closeCmdk(); newProgramModal(); }, glyph: 'programs' },
  ];

  async function cmdkSearch(q) {
    if (!cmdkState) return;
    const commandsOnly = q.startsWith('>');
    const term = commandsOnly ? q.slice(1).trim() : q.trim();
    let groups = [];
    const cmds = COMMANDS.filter((c) => !term || c.label.toLowerCase().includes(term.toLowerCase()));
    if (cmds.length) groups.push({ name: 'Commands', rows: cmds });
    if (!commandsOnly && term) {
      try {
        const r = await GET('/api/search?q=' + encodeURIComponent(term));
        if (r.programs && r.programs.length) groups.push({ name: 'Programs', rows: r.programs.map((p) => ({ label: p.name, sub: p.company || '', keys: '', glyph: 'programs', run: () => go('#/program?id=' + p.id) })) });
        if (r.findings && r.findings.length) groups.push({ name: 'Findings', rows: r.findings.map((f) => ({ label: f.title, sub: f.severity, keys: '', glyph: 'findings', run: () => go('#/findings?open=' + f.id) })) });
        if (r.reports && r.reports.length) groups.push({ name: 'Reports', rows: r.reports.map((rep) => ({ label: rep.title, sub: rep.status, keys: '', glyph: 'reports', run: () => go('#/reports?open=' + rep.id) })) });
      } catch (e) {}
    }
    renderCmdk(groups, term);
  }
  function renderCmdk(groups, term) {
    if (!cmdkState) return;
    const flat = [];
    let html = '';
    groups.forEach((g) => {
      html += `<div class="cmdk-group-label">${esc(g.name)}</div>`;
      g.rows.forEach((row) => {
        const i = flat.length; flat.push(row);
        html += `<div class="cmdk-row" data-ci="${i}"><span class="cmdk-glyph">${svg(row.glyph || 'search', 13)}</span>
          <span class="lbl">${esc(row.label)}${row.sub ? '<span class="sub">' + esc(row.sub) + '</span>' : ''}</span>
          <span class="keys">${esc(row.keys || '')}</span></div>`;
      });
    });
    if (!flat.length) html = `<div class="cmdk-empty">No match${term ? '. <b>↵ Create finding “' + esc(term) + '”</b>' : ''}</div>`;
    cmdkState.rows = flat; cmdkState.active = 0; cmdkState.term = term;
    $('#cmdk-results').innerHTML = html;
    $('#cmdk-count').textContent = flat.length + ' results';
    highlightCmdk();
    $$('#cmdk-results .cmdk-row').forEach((el) => { el.onclick = () => { const row = cmdkState.rows[+el.dataset.ci]; closeCmdk(); row.run(); }; });
  }
  function highlightCmdk() {
    $$('#cmdk-results .cmdk-row').forEach((el, i) => el.classList.toggle('active', i === cmdkState.active));
    const act = $('#cmdk-results .cmdk-row.active'); if (act) act.scrollIntoView({ block: 'nearest' });
  }
  function cmdkKeys(e) {
    if (!cmdkState) return;
    if (e.key === 'Escape') { e.preventDefault(); closeCmdk(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); cmdkState.active = Math.min(cmdkState.rows.length - 1, cmdkState.active + 1); highlightCmdk(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cmdkState.active = Math.max(0, cmdkState.active - 1); highlightCmdk(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const row = cmdkState.rows[cmdkState.active];
      if (row) { closeCmdk(); row.run(); }
      else if (cmdkState.term) { closeCmdk(); newFindingModal({ title: cmdkState.term }); }
    }
  }

  // ============================================================================
  //  Modals: new/edit program, finding, asset, subdomains
  // ============================================================================
  function modal(html, opts) {
    opts = opts || {};
    const o = overlay();
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = `<div class="modal-box ${opts.wide ? 'wide' : ''}">${html}</div>`;
    o.appendChild(wrap);
    wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
    const x = $('.modal-h .x', wrap); if (x) x.onclick = () => wrap.remove();
    const first = $('input,select,textarea', wrap); if (first) setTimeout(() => first.focus(), 20);
    return { wrap, close: () => wrap.remove() };
  }

  async function newProgramModal() {
    const m = modal(`
      <div class="modal-h"><h3>New program</h3><button class="icon-btn x">${svg('close', 12)}</button></div>
      <div class="modal-body">
        <div class="field"><label>Name</label><input class="inp" id="np-name" placeholder="Acme Cloud" /></div>
        <div class="grid-fields">
          <div class="field"><label>Platform</label><select class="inp" id="np-plat"><option>HackerOne</option><option>Bugcrowd</option><option>Intigriti</option><option>YesWeHack</option><option>Synack</option><option>Immunefi</option><option>Private</option></select></div>
          <div class="field"><label>Visibility</label><select class="inp" id="np-vis"><option value="PUBLIC">Public</option><option value="VDP">VDP</option><option value="PRIVATE">Private</option><option value="INVITE_ONLY">Invite only</option></select></div>
        </div>
        <div class="field"><label>In-scope (domains / URLs / IPs)</label><textarea class="inp" id="np-assets" placeholder="app.acme.com&#10;api.acme.com"></textarea><span class="hint">One per line — each becomes a scope.</span></div>
        <div class="field"><label>Tags</label><input class="inp" id="np-tags" placeholder="api, oauth, fintech" /></div>
      </div>
      <div class="modal-foot"><button class="btn x">Cancel</button><button class="btn primary" id="np-save">Create program</button></div>`);
    $('.modal-foot .x', m.wrap).onclick = m.close;
    $('#np-save', m.wrap).onclick = async () => {
      const name = $('#np-name', m.wrap).value.trim();
      if (!name) return toast('Name is required', 'err');
      try {
        const r = await POST('/api/programs', {
          name, platform: $('#np-plat', m.wrap).value,
          visibility: $('#np-vis', m.wrap).value,
          assets: $('#np-assets', m.wrap).value, tags: $('#np-tags', m.wrap).value,
        });
        m.close(); toast('Program created'); await ensurePrograms(true); renderSidebar(); setProgram(r.id); go('#/program?id=' + r.id);
      } catch (e) { toast(e.message, 'err'); }
    };
  }

  function cleanHost(h) {
    return String(h).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/[\s,]+$/, '');
  }
  function guessType(h) {
    if (/graphql/i.test(h)) return 'GraphQL';
    if (/(^|\.)api\./i.test(h) || /\bapi\b/i.test(h)) return 'API';
    if (/android|apk/i.test(h)) return 'Android';
    if (/ios|apple|testflight/i.test(h)) return 'iOS';
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return 'Network';
    return 'Web';
  }

  async function addAssetModal(pid) {
    const m = modal(`
      <div class="modal-h"><h3>Add scope</h3><button class="icon-btn x">${svg('close', 12)}</button></div>
      <div class="modal-body">
        <div class="field">
          <label>Domain / URL / IP</label>
          <textarea class="inp" id="a-hosts" style="min-height:90px" placeholder="test.com&#10;api.test.com&#10;10.0.0.5"></textarea>
          <span class="hint">One per line. The type (Web / API / IP…) is detected automatically.</span>
        </div>
      </div>
      <div class="modal-foot"><button class="btn x">Cancel</button><button class="btn primary" id="a-save">Add</button></div>`);
    $('.modal-foot .x', m.wrap).onclick = m.close;
    $('#a-save', m.wrap).onclick = async () => {
      const raw = $('#a-hosts', m.wrap).value;
      const hosts = raw.split(/[\n,]+/).map(cleanHost).filter(Boolean);
      if (!hosts.length) return toast('Enter a domain, URL or IP', 'err');
      try {
        for (const host of hosts) {
          await POST('/api/assets', { program_id: pid, name: host, type: guessType(host), url: 'https://' + host });
        }
        m.close(); toast(hosts.length > 1 ? hosts.length + ' scopes added' : 'Scope added'); await ensurePrograms(true); route();
      } catch (e) { toast(e.message, 'err'); }
    };
  }

  async function addSubModal(assetId, pid) {
    const m = modal(`
      <div class="modal-h"><h3>Add subdomains</h3><button class="icon-btn x">${svg('close', 12)}</button></div>
      <div class="modal-body">
        <div class="field"><label>Hosts</label><textarea class="inp" id="s-hosts" style="min-height:160px" placeholder="www.acme.com&#10;admin.acme.com&#10;dev.acme.com"></textarea><span class="hint">One per line or comma separated.</span></div>
      </div>
      <div class="modal-foot"><button class="btn x">Cancel</button><button class="btn primary" id="s-save">Add hosts</button></div>`);
    $('.modal-foot .x', m.wrap).onclick = m.close;
    $('#s-save', m.wrap).onclick = async () => {
      const hosts = $('#s-hosts', m.wrap).value.trim();
      if (!hosts) return toast('Enter at least one host', 'err');
      try { const r = await POST('/api/assets/' + assetId + '/subdomains', { hosts }); m.close(); toast('Added ' + r.added + ' subdomains'); route(); }
      catch (e) { toast(e.message, 'err'); }
    };
  }

  async function newFindingModal(prefill, isEdit, onCreated) {
    prefill = prefill || {};
    await ensurePrograms();
    const pid = prefill.program_id || S.currentProgram || (S.programs[0] && S.programs[0].id);
    if (!S.programs.length) { toast('Create a program first', 'info'); return newProgramModal(); }
    // load assets/subdomains for the chosen program to populate selects
    let detail = null;
    try { detail = pid ? await GET('/api/programs/' + pid) : null; } catch (e) {}
    const progOpts = S.programs.map((p) => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    const assetOpts = (detail ? detail.assets : []).map((a) => `<option value="${a.id}" ${prefill.asset_id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
    const subOpts = (detail ? detail.subdomains : []).map((s) => `<option value="${s.id}" ${prefill.subdomain_id === s.id ? 'selected' : ''}>${esc(s.host)}</option>`).join('');

    const m = modal(`
      <div class="modal-h"><h3>${isEdit ? 'Edit finding' : 'Log finding'}</h3><button class="icon-btn x">${svg('close', 12)}</button></div>
      <div class="modal-body">
        <div class="field"><label>Title</label><input class="inp" id="f-title" value="${attr(prefill.title || '')}" placeholder="IDOR on /orders/{id} exposes PII" /></div>
        <div class="grid-fields">
          <div class="field"><label>Program</label><select class="inp" id="f-prog" ${isEdit ? 'disabled' : ''}>${progOpts}</select></div>
          <div class="field"><label>Vuln class</label><input class="inp" id="f-class" value="${attr(prefill.vuln_class || '')}" placeholder="IDOR/BOLA" /></div>
        </div>
        <div class="grid-fields">
          <div class="field"><label>Asset</label><select class="inp" id="f-asset"><option value="">—</option>${assetOpts}</select></div>
          <div class="field"><label>Subdomain</label><select class="inp" id="f-sub"><option value="">—</option>${subOpts}</select></div>
        </div>
        <div class="grid-fields">
          <div class="field"><label>Severity</label><select class="inp" id="f-sev">${SEV_ORDER.map((s) => `<option ${prefill.severity === s ? 'selected' : s === 'Medium' && !prefill.severity ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          <div class="field"><label>Status</label><select class="inp" id="f-status">${FINDING_STATUSES.concat(['Rejected', 'Duplicate']).map((s) => `<option ${prefill.status === s ? 'selected' : s === 'Potential' && !prefill.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        </div>
        <div class="grid-fields">
          <div class="field"><label>CVSS</label><input class="inp" id="f-cvss" type="number" step="0.1" min="0" max="10" value="${prefill.cvss != null ? prefill.cvss : ''}" placeholder="8.1" /></div>
          <div class="field"><label>CWE</label><input class="inp" id="f-cwe" value="${attr(prefill.cwe || '')}" placeholder="CWE-639" /></div>
        </div>
        <div class="field"><label>Bounty</label><input class="inp" id="f-bounty" type="number" min="0" value="${prefill.bounty || 0}" /></div>
        <div class="field"><label>Observation</label><textarea class="inp" id="f-obs" placeholder="What you observed, with two accounts / a diff / a request…">${esc(prefill.observation || '')}</textarea></div>
      </div>
      <div class="modal-foot"><button class="btn x">Cancel</button><button class="btn primary" id="f-save">${isEdit ? 'Save changes' : 'Log finding'}</button></div>`);
    $('.modal-foot .x', m.wrap).onclick = m.close;

    // reload asset/sub selects when program changes
    const progSel = $('#f-prog', m.wrap);
    if (progSel && !isEdit) progSel.onchange = async () => {
      try {
        const dd = await GET('/api/programs/' + progSel.value);
        $('#f-asset', m.wrap).innerHTML = '<option value="">—</option>' + dd.assets.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
        $('#f-sub', m.wrap).innerHTML = '<option value="">—</option>' + dd.subdomains.map((s) => `<option value="${s.id}">${esc(s.host)}</option>`).join('');
      } catch (e) {}
    };

    $('#f-save', m.wrap).onclick = async () => {
      const title = $('#f-title', m.wrap).value.trim();
      if (!title) return toast('Title is required', 'err');
      const payload = {
        title, vuln_class: $('#f-class', m.wrap).value || null,
        asset_id: $('#f-asset', m.wrap).value || null, subdomain_id: $('#f-sub', m.wrap).value || null,
        severity: $('#f-sev', m.wrap).value, status: $('#f-status', m.wrap).value,
        cvss: parseFloat($('#f-cvss', m.wrap).value) || null, cwe: $('#f-cwe', m.wrap).value || null,
        bounty: parseFloat($('#f-bounty', m.wrap).value) || 0, observation: $('#f-obs', m.wrap).value || null,
      };
      try {
        if (isEdit) { await PATCH('/api/findings/' + prefill.id, payload); toast('Finding updated'); }
        else { payload.program_id = progSel.value; const r = await POST('/api/findings', payload); toast('Finding logged'); m.close(); if (onCreated) { onCreated(r.id); } else { go('#/findings?open=' + r.id); } return; }
        m.close(); route();
      } catch (e) { toast(e.message, 'err'); }
    };
  }

  // ============================================================================
  //  Keyboard shortcuts
  // ============================================================================
  let gPending = false, gTimer = null;
  function keydown(e) {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!$('.cmdk-scrim')) openCmdk(); return; }
    if (e.key === 'Escape') { const cd = $('[data-cd]'); if (cd) return; const m = $('#overlay .modal'); if (m) { m.remove(); return; } if ($('.cmdk-scrim')) { closeCmdk(); return; } if (S.route && S.route.name === 'program') { go('#/programs'); return; } }
    if (typing) return;

    if (gPending) {
      gPending = false; clearTimeout(gTimer);
      const map = { d: '#/dashboard', p: '#/programs', a: '#/assets', c: '#/checklist', f: '#/findings', r: '#/reports', n: '#/analytics' };
      if (map[e.key.toLowerCase()]) { e.preventDefault(); go(map[e.key.toLowerCase()]); return; }
    }
    if (e.key === '?') { e.preventDefault(); helpModal(); return; }
    if ((e.key === 'r' || e.key === 'R') && nPending) { nPending = false; e.preventDefault(); createBlankReport(); return; }
    if (e.key === 'g' || e.key === 'G') { gPending = true; clearTimeout(gTimer); gTimer = setTimeout(() => gPending = false, 800); return; }
    if (e.key === 'n' || e.key === 'N') { nPending = true; clearTimeout(nTimer); nTimer = setTimeout(() => nPending = false, 700); return; }
  }
  let nPending = false, nTimer = null;

  function helpModal() {
    modal(`
      <div class="modal-h"><h3>Keyboard map</h3><button class="icon-btn x">${svg('close', 12)}</button></div>
      <div class="modal-body">
        <div class="rail-metrics">
          ${[['Ctrl K', 'Command palette'], ['G then D/P/R', 'Jump to a section'], ['N R', 'New report'], ['Esc', 'Close overlay'], ['?', 'This map']]
        .map(([k, v]) => `<div class="m"><span class="v"><span class="kbd">${k}</span></span><span class="k">${v}</span></div>`).join('')}
        </div>
      </div>
      <div class="modal-foot"><button class="btn primary x">Got it</button></div>`);
    $$('#overlay .modal .x').forEach((b) => b.onclick = () => $('#overlay .modal').remove());
  }

  // ── boot ────────────────────────────────────────────────────────────────
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', keydown);
  // upgrade every native <select> to the themed dropdown as views/modals render,
  // and close any open menu on an outside click
  document.addEventListener('click', closeAllSels);
  window.addEventListener('scroll', closeAllSels, true);
  window.addEventListener('resize', closeAllSels);
  new MutationObserver(runEnhance).observe(document.documentElement, { childList: true, subtree: true });
  (async function boot() {
    if (!location.hash) location.hash = '#/dashboard';
    try { await ensurePrograms(); } catch (e) {}
    route();
    runEnhance();
  })();
})();
