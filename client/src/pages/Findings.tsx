import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Plus, Lock, X, ArrowUpRight, Trash2 } from "lucide-react";
import { get, post, del } from "../lib/api";
import { Card, Button, Input, Select, Textarea, SeverityBadge, StatusBadge, Empty, timeAgo } from "../lib/ui";
import { confirmDialog } from "../lib/confirm";
import { VULN_CLASSES, SEVERITIES, FINDING_STATUSES as STATUSES } from "../lib/constants";

export default function Findings() {
  const [sp, setSp] = useSearchParams();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const severity = sp.get("severity") ?? "";
  const status = sp.get("status") ?? "";
  const vuln = sp.get("vuln_class") ?? "";

  const qs = new URLSearchParams();
  if (severity) qs.set("severity", severity);
  if (status) qs.set("status", status);
  if (vuln) qs.set("vuln_class", vuln);

  const nav = useNavigate();
  const { data: findings } = useQuery({ queryKey: ["findings", qs.toString()], queryFn: () => get(`/findings?${qs}`) });
  const { data: programs } = useQuery({ queryKey: ["programs-min"], queryFn: () => get("/programs") });

  const setFilter = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n); };
  const openInProgram = (f: any) => nav(`/programs/${f.program_id}?tab=Findings&finding=${f.id}`);
  const remove = async (e: React.MouseEvent, f: any) => { e.stopPropagation(); if (!(await confirmDialog(`Delete finding "${f.title}"?`))) return; await del(`/findings/${f.id}`); qc.invalidateQueries({ queryKey: ["findings"] }); };

  return (
    <div className="anim-in space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold">Findings</h1><p className="text-[13px] text-faint">{findings?.length ?? 0} findings</p></div>
        <Button variant="primary" onClick={() => setShowNew(true)}><Plus size={14} /> Quick Finding</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-44"><Select value={severity} onChange={(e) => setFilter("severity", e.target.value)}><option value="">All severities</option>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</Select></div>
        <div className="w-44"><Select value={status} onChange={(e) => setFilter("status", e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></div>
        <div className="w-44"><Select value={vuln} onChange={(e) => setFilter("vuln_class", e.target.value)}><option value="">All classes</option>{VULN_CLASSES.map((s) => <option key={s}>{s}</option>)}</Select></div>
        {(severity || status || vuln) && <Button variant="ghost" onClick={() => setSp({})}>Clear</Button>}
      </div>

      {findings?.length ? (
        <Card>
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
              <th className="p-3 font-medium">Severity</th><th className="p-3 font-medium">Title</th><th className="p-3 font-medium">Class</th><th className="p-3 font-medium">Program</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium text-right">Bounty</th><th className="p-3 font-medium text-right">Found</th><th className="p-3"></th>
            </tr></thead>
            <tbody>
              {findings.map((f: any) => (
                <tr key={f.id} onClick={() => openInProgram(f)} className="group cursor-pointer border-b border-border last:border-0 hover:bg-surface2/40">
                  <td className="p-3"><SeverityBadge s={f.severity} /></td>
                  <td className="p-3 font-medium"><span className="inline-flex items-center gap-1">{f.title}<ArrowUpRight size={12} className="text-faint opacity-0 transition group-hover:opacity-100" /></span></td>
                  <td className="p-3 text-subtle">{f.vuln_class}</td>
                  <td className="p-3 text-subtle">{f.is_private ? <Lock size={11} className="mr-1 inline text-warn" /> : null}{f.program_name}</td>
                  <td className="p-3"><StatusBadge s={f.status} /></td>
                  <td className="p-3 text-right font-medium text-accent">{f.bounty > 0 ? `$${f.bounty}` : <span className="text-faint">—</span>}</td>
                  <td className="p-3 text-right text-[11px] text-faint">{timeAgo(f.created_at)}</td>
                  <td className="p-3 text-right"><button onClick={(e) => remove(e, f)} title="Delete finding" className="cursor-pointer text-faint opacity-0 transition group-hover:opacity-100 hover:text-danger"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : <Empty>No findings match these filters.</Empty>}

      {showNew && <QuickFinding programs={programs ?? []} onClose={() => setShowNew(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ["findings"] }); setShowNew(false); }} />}
    </div>
  );
}

function QuickFinding({ programs, onClose, onCreated }: any) {
  const [f, setF] = useState<any>({ program_id: programs[0]?.id ?? "", title: "", vuln_class: "IDOR/BOLA", severity: "Medium", status: "Potential", observation: "" });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-6 pt-[10vh]" onClick={onClose}>
      <Card className="w-[520px] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Quick Finding</h2><button onClick={onClose} className="cursor-pointer text-faint hover:text-fg"><X size={18} /></button></div>
        <div className="space-y-3">
          <Input placeholder="Title" value={f.title} onChange={(e) => set("title", e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Select value={f.program_id} onChange={(e) => set("program_id", e.target.value)}>{programs.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
            <Select value={f.vuln_class} onChange={(e) => set("vuln_class", e.target.value)}>{VULN_CLASSES.map((v) => <option key={v}>{v}</option>)}</Select>
            <Select value={f.severity} onChange={(e) => set("severity", e.target.value)}>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</Select>
            <Select value={f.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select>
          </div>
          <Textarea rows={3} placeholder="Observation…" value={f.observation} onChange={(e) => set("observation", e.target.value)} />
        </div>
        <div className="mt-5 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!f.title.trim() || !f.program_id} onClick={() => post("/findings", f).then(onCreated)}>Save Finding</Button></div>
      </Card>
    </div>
  );
}
