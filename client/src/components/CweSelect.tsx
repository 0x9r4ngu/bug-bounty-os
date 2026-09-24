import { useState, useMemo, useRef, useEffect } from "react";
import { Search, ChevronDown, X } from "lucide-react";
import { CWE_LIST } from "../lib/cwe-list";

export default function CweSelect({ value, onChange, compact }: { value?: string | null; onChange: (v: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return CWE_LIST.slice(0, 60);
    const num = s.replace(/cwe[-\s]?/g, "");
    return CWE_LIST.filter((c) =>
      c.id.toLowerCase().includes(s) || c.name.toLowerCase().includes(s) || c.id.replace("CWE-", "") === num
    ).slice(0, 60);
  }, [q]);

  const current = value ? CWE_LIST.find((c) => c.id === value) : undefined;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-left text-[13px] text-fg transition-colors hover:border-border-strong focus:border-primary">
        {value ? (
          <span className="truncate"><span className="font-mono text-primary">{value}</span>{current && !compact ? <span className="text-subtle"> · {current.name}</span> : null}</span>
        ) : (
          <span className="text-faint">Select CWE…</span>
        )}
        <ChevronDown size={14} className="ml-auto shrink-0 text-faint" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-[360px] max-w-[85vw] overflow-hidden rounded-md border border-border-strong bg-surface shadow-2xl">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search size={14} className="text-faint" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 900+ CWEs by id or name…" className="w-full bg-transparent py-2.5 text-[13px] outline-none" />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {value ? (
              <button onClick={() => { onChange(""); setOpen(false); setQ(""); }} className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-[12px] text-danger hover:bg-surface2">
                <X size={12} /> Clear
              </button>
            ) : null}
            {results.map((c) => (
              <button key={c.id} onClick={() => { onChange(c.id); setOpen(false); setQ(""); }}
                className={`flex w-full cursor-pointer items-baseline gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-surface2 ${c.id === value ? "bg-primary/10" : ""}`}>
                <span className="shrink-0 font-mono text-[11px] text-primary">{c.id}</span>
                <span className="truncate text-subtle">{c.name}</span>
              </button>
            ))}
            {!results.length && <div className="px-3 py-4 text-center text-[12px] text-faint">No CWE matches “{q}”.</div>}
          </div>
          <div className="border-t border-border px-3 py-1.5 text-[10px] text-faint">{CWE_LIST.length} CWEs · MITRE comprehensive list</div>
        </div>
      )}
    </div>
  );
}
