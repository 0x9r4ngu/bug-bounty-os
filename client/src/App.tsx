import { Routes, Route, NavLink, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Shield, Bug, FileText, BarChart3, ListTodo, BookOpen,
  Search, Plus, Lock, Command,
} from "lucide-react";
import { get } from "./lib/api";
import { ConfirmHost } from "./lib/confirm";
import Programs from "./pages/Programs";
import ProgramDetail from "./pages/ProgramDetail";
import Findings from "./pages/Findings";
import Reports from "./pages/Reports";
import ReportEditor from "./pages/ReportEditor";
import Analytics from "./pages/Analytics";
import Unfinished from "./pages/Unfinished";
import Journal from "./pages/Journal";

const NAV = [
  { to: "/", label: "Analytics", icon: BarChart3, end: true },
  { to: "/programs", label: "Programs", icon: Shield },
  { to: "/findings", label: "Findings", icon: Bug },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/unfinished", label: "Unfinished", icon: ListTodo },
  { to: "/journal", label: "Journal", icon: BookOpen },
];

function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<any>(null);
  const nav = useNavigate();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    if (!q) { setRes(null); return; }
    const t = setTimeout(() => get(`/search?q=${encodeURIComponent(q)}`).then(setRes), 180);
    return () => clearTimeout(t);
  }, [q]);

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="flex w-80 cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-border bg-muted px-3 py-1.5 font-mono text-[12px] text-faint transition-colors hover:border-primary/40">
        <span className="font-bold text-primary">&gt;</span> search programs, findings, reports
        <span className="ml-auto flex items-center gap-0.5 rounded-[3px] border border-border px-1.5 py-0.5 text-[10px]"><Command size={10} />K</span>
      </button>
    );

  const goto = (to: string) => { setOpen(false); setQ(""); nav(to); };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[12vh]" onClick={() => setOpen(false)}>
      <div className="w-[560px] overflow-hidden rounded-[var(--radius)] border border-border-strong bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-4">
          <span className="font-mono text-[15px] font-bold text-primary">&gt;</span>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="search everything…" className="w-full bg-transparent py-3 font-mono text-[14px] text-fg outline-none" />
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {!res && <div className="p-6 text-center text-[13px] text-faint">Type to search across programs, findings and reports.</div>}
          {res && (
            <>
              <ResGroup title="Programs" items={res.programs} render={(p: any) => p.name} onGo={(p: any) => goto(`/programs/${p.id}`)} />
              <ResGroup title="Findings" items={res.findings} render={(f: any) => f.title} onGo={(f: any) => goto(`/findings`)} />
              <ResGroup title="Reports" items={res.reports} render={(r: any) => r.title} onGo={(r: any) => goto(`/reports/${r.id}`)} />
              {!res.programs.length && !res.findings.length && !res.reports.length && <div className="p-6 text-center text-[13px] text-faint">No results.</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function ResGroup({ title, items, render, onGo }: any) {
  if (!items?.length) return null;
  return (
    <div className="mb-1">
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-faint">{title}</div>
      {items.map((it: any) => (
        <button key={it.id} onClick={() => onGo(it)} className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] text-fg hover:bg-surface2">
          {render(it)}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  return (
    <div className="flex h-full">
      <ConfirmHost />
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/50">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-primary/40 bg-primary/10 text-primary"><Shield size={17} /></div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold leading-none tracking-tight">bug_bounty<span className="text-primary">_os</span></div>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" style={{ boxShadow: "0 0 6px var(--color-primary)" }} /> operational
            </div>
          </div>
        </div>
        <div className="px-4 pb-1.5 pt-4"><span className="kicker">// modules</span></div>
        <nav className="flex flex-1 flex-col gap-px px-2 py-1">
          {NAV.map((n, i) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) =>
                `group relative flex items-center gap-2.5 rounded-[3px] px-3 py-2 text-[13px] transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-subtle hover:bg-surface2 hover:text-fg"}`
              }>
              {({ isActive }: any) => (
                <>
                  <span className={`absolute left-0 top-1/2 h-4 -translate-y-1/2 rounded-r transition-all ${isActive ? "w-[3px] bg-primary" : "w-0 bg-transparent"}`} />
                  <n.icon size={16} />
                  <span className="flex-1">{n.label}</span>
                  <span className="font-mono text-[9px] text-faint/60">{String(i + 1).padStart(2, "0")}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border px-4 py-3 font-mono text-[10px] text-faint">
          <div className="flex items-center gap-1.5"><Lock size={10} className="text-primary/70" /> local · single-user</div>
          <div className="mt-1 tracking-wide">sqlite // source of truth</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-muted/30 px-5 py-2.5">
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2">
            <Link to="/programs?new=1"><span className="flex cursor-pointer items-center gap-1.5 rounded-[var(--radius)] bg-primary px-3 py-1.5 text-[13px] font-bold text-[color:var(--color-primary-fg)] transition hover:brightness-110"><Plus size={14} /> New Program</span></Link>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Analytics />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/programs" element={<Programs />} />
            <Route path="/programs/:id" element={<ProgramDetail />} />
            <Route path="/findings" element={<Findings />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/:id" element={<ReportEditor />} />
            <Route path="/unfinished" element={<Unfinished />} />
            <Route path="/journal" element={<Journal />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
