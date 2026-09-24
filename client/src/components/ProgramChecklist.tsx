import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { ChevronRight, ChevronDown, Check, Boxes, ListChecks } from "lucide-react";
import { get, post } from "../lib/api";
import { Card, Empty, Button } from "../lib/ui";
import { CHECKLIST_TEMPLATE } from "../lib/checklist-template";

marked.setOptions({ gfm: true, breaks: false });

export default function ProgramChecklist({ pid, assets, onGoAssets }: { pid: string; assets: any[]; onGoAssets: () => void }) {
  const qc = useQueryClient();
  const { data: rows } = useQuery({ queryKey: ["checklist", pid], queryFn: () => get(`/programs/${pid}/checklist`) });

  const scopes = assets.length
    ? assets.map((a) => ({ id: a.id, label: a.name, type: a.type }))
    : [{ id: "program", label: "Program-wide", type: "" }];

  const [scope, setScope] = useState(scopes[0].id);
  const [openParts, setOpenParts] = useState<Record<string, boolean>>({ [CHECKLIST_TEMPLATE.parts[0].id]: true });
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const activeScope = scopes.find((s) => s.id === scope) ? scope : scopes[0].id;

  const checkedSet = useMemo(() => {
    const m = new Set<string>();
    (rows ?? []).forEach((r: any) => { if (r.checked) m.add(`${r.scope}:${r.item_key}`); });
    return m;
  }, [rows]);

  const isChecked = (sc: string, key: string) => checkedSet.has(`${sc}:${key}`);
  const total = CHECKLIST_TEMPLATE.totalItems;
  const scopeDone = (sc: string) => CHECKLIST_TEMPLATE.parts.reduce((a, p) => a + p.items.filter((i) => isChecked(sc, i.key)).length, 0);
  const overallDone = scopes.reduce((a, s) => a + scopeDone(s.id), 0);
  const overallTotal = total * scopes.length;

  const toggle = async (key: string) => {
    const next = !isChecked(activeScope, key);
    qc.setQueryData(["checklist", pid], (old: any[] = []) => {
      const idx = old.findIndex((r) => r.scope === activeScope && r.item_key === key);
      if (idx >= 0) { const c = [...old]; c[idx] = { ...c[idx], checked: next ? 1 : 0 }; return c; }
      return [...old, { scope: activeScope, item_key: key, checked: next ? 1 : 0 }];
    });
    await post(`/programs/${pid}/checklist`, { scope: activeScope, item_key: key, checked: next });
    qc.invalidateQueries({ queryKey: ["program", pid] });
  };

  const done = scopeDone(activeScope);
  const pct = Math.round((done / total) * 100);

  return (
    <div className="space-y-4">
      {/* overall program progress */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint"><ListChecks size={13} /> Program Checklist Progress</h3>
          <span className="text-[12px] text-faint">{CHECKLIST_TEMPLATE.parts.length} parts · {total} test areas per scope</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${overallTotal ? (overallDone / overallTotal) * 100 : 0}%` }} />
          </div>
          <span className="text-[13px] font-semibold tabular-nums">{overallDone}/{overallTotal}</span>
          <span className="text-[12px] text-faint">({overallTotal ? Math.round((overallDone / overallTotal) * 100) : 0}%)</span>
        </div>
      </Card>

      {!assets.length && (
        <Card className="flex items-center justify-between p-3" style={{ borderColor: "rgba(185,154,62,0.3)" }}>
          <span className="text-[13px] text-subtle">Add your in-scope assets (e.g. <span className="font-mono text-primary">api.example.com</span>) to get a dedicated checklist per scope.</span>
          <Button variant="primary" onClick={onGoAssets}><Boxes size={13} /> Add Assets</Button>
        </Card>
      )}

      {/* scope selector */}
      <div className="flex flex-wrap gap-2">
        {scopes.map((s) => {
          const d = scopeDone(s.id);
          const p = Math.round((d / total) * 100);
          const active = s.id === activeScope;
          return (
            <button key={s.id} onClick={() => setScope(s.id)}
              className={`group flex min-w-[150px] cursor-pointer flex-col rounded-lg border px-3 py-2 text-left transition-colors ${active ? "border-primary/50 bg-primary/10" : "border-border bg-surface hover:border-border-strong"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`truncate font-mono text-[12px] font-medium ${active ? "text-primary" : "text-fg"}`}>{s.label}</span>
                <span className="text-[11px] tabular-nums text-faint">{d}/{total}</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${p}%`, background: p >= 80 ? "#7c8850" : p >= 40 ? "#b99a3e" : "#7c8850" }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* selected scope checklist */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="font-mono text-[14px] font-semibold text-primary">{scopes.find((s) => s.id === activeScope)?.label}</div>
            <div className="text-[12px] text-faint">{done} of {total} test areas covered</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[13px] font-semibold tabular-nums">{pct}%</span>
          </div>
        </div>

        <div className="space-y-2">
          {CHECKLIST_TEMPLATE.parts.map((part) => {
            const partDone = part.items.filter((i) => isChecked(activeScope, i.key)).length;
            const open = openParts[part.id];
            return (
              <div key={part.id} className="overflow-hidden rounded-lg border border-border">
                <button onClick={() => setOpenParts((o) => ({ ...o, [part.id]: !o[part.id] }))}
                  className="flex w-full cursor-pointer items-center gap-2 bg-muted/40 px-3 py-2.5 text-left hover:bg-surface2">
                  {open ? <ChevronDown size={15} className="text-faint" /> : <ChevronRight size={15} className="text-faint" />}
                  <span className="flex-1 text-[13px] font-semibold">{part.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${partDone === part.items.length ? "bg-accent/15 text-accent" : "bg-muted text-faint"}`}>{partDone}/{part.items.length}</span>
                </button>
                {open && (
                  <div className="divide-y divide-[color:var(--color-border)]">
                    {part.items.map((item) => {
                      const on = isChecked(activeScope, item.key);
                      const expanded = openItems[item.key];
                      return (
                        <div key={item.key}>
                          <div className="flex items-start gap-2.5 px-3 py-2.5">
                            <button onClick={() => toggle(item.key)} title={on ? "Mark not done" : "Mark done"}
                              className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded border transition-colors ${on ? "border-accent bg-accent text-white" : "border-border-strong hover:border-primary"}`}>
                              {on ? <Check size={13} strokeWidth={3} /> : null}
                            </button>
                            <button onClick={() => setOpenItems((o) => ({ ...o, [item.key]: !o[item.key] }))} className="min-w-0 flex-1 cursor-pointer text-left">
                              <div className={`text-[13px] ${on ? "text-faint line-through" : "text-fg"}`}>
                                {item.num ? <span className="mr-1.5 text-faint">{item.num}.</span> : null}{item.title}
                              </div>
                            </button>
                            <button onClick={() => setOpenItems((o) => ({ ...o, [item.key]: !o[item.key] }))}
                              className="flex shrink-0 cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-faint hover:bg-surface2 hover:text-fg">
                              How to test {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </button>
                          </div>
                          {expanded && (
                            <div className="border-t border-border bg-bg px-4 py-3">
                              <div className="md-preview text-[12.5px]" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(item.body) as string) }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
