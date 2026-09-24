import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Lock, Eye, Globe, Shield, Plus, X, Trash2 } from "lucide-react";
import { get, post, del } from "../lib/api";
import { Card, Badge, Button, Input, Select, Textarea, Empty, StatusBadge } from "../lib/ui";
import { confirmDialog } from "../lib/confirm";

const VIS_META: Record<string, { label: string; color: string; icon: any }> = {
  PUBLIC: { label: "Public", color: "#b99a3e", icon: Globe },
  PRIVATE: { label: "Private", color: "#7c8850", icon: Lock },
  INVITE_ONLY: { label: "Invite-only", color: "#b0743a", icon: Lock },
  VDP: { label: "VDP", color: "#8a8168", icon: Shield },
  INTERNAL: { label: "Internal", color: "#cc3a63", icon: Lock },
  CUSTOM: { label: "Custom", color: "#8a8168", icon: Shield },
};

export default function Programs() {
  const [sp, setSp] = useSearchParams();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(sp.get("new") === "1");
  const filterPrivate = sp.get("private") === "1";
  const filterWatched = sp.get("watched") === "1";

  const qs = new URLSearchParams();
  if (filterPrivate) qs.set("private", "1");
  if (filterWatched) qs.set("watched", "1");

  const { data: programs } = useQuery({ queryKey: ["programs", qs.toString()], queryFn: () => get(`/programs?${qs}`) });

  useEffect(() => { if (sp.get("new") === "1") setShowNew(true); }, [sp]);

  const filters = [
    { label: "All", active: !filterPrivate && !filterWatched, on: () => setSp({}) },
    { label: "Private", active: filterPrivate, on: () => setSp({ private: "1" }) },
    { label: "Watched", active: filterWatched, on: () => setSp({ watched: "1" }) },
  ];

  return (
    <div className="anim-in space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Programs</h1>
          <p className="text-[13px] text-faint">{programs?.length ?? 0} programs tracked</p>
        </div>
        <Button variant="primary" onClick={() => setShowNew(true)}><Plus size={14} /> New Program</Button>
      </div>

      <div className="flex gap-1">
        {filters.map((f) => (
          <button key={f.label} onClick={f.on} className={`cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${f.active ? "bg-primary/15 text-primary" : "text-subtle hover:bg-surface2"}`}>{f.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {programs?.map((p: any) => {
          const vm = VIS_META[p.visibility] ?? VIS_META.CUSTOM;
          const remove = async (e: React.MouseEvent) => {
            e.preventDefault(); e.stopPropagation();
            if (!(await confirmDialog(`Delete program "${p.name}" and all its data? This cannot be undone.`))) return;
            await del(`/programs/${p.id}`);
            qc.invalidateQueries({ queryKey: ["programs"] });
          };
          return (
            <Link key={p.id} to={`/programs/${p.id}`}>
              <Card className="group relative h-full cursor-pointer p-4 transition-colors hover:border-border-strong">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {p.is_private ? <Lock size={13} className="shrink-0 text-warn" /> : null}
                      <span className="truncate font-semibold">{p.name}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-faint">{p.company ?? "—"} · {p.platform ?? "—"}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {p.is_watched ? <Eye size={14} className="text-primary" /> : null}
                    <button onClick={remove} title="Delete program" className="cursor-pointer text-faint opacity-0 transition group-hover:opacity-100 hover:text-danger"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge color={vm.color}>{vm.label}</Badge>
                  <StatusBadge s={p.status} />
                  {p.invitation_status ? <Badge color="#b0743a">Invite: {p.invitation_status}</Badge> : null}
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3 text-center">
                  {[["Assets", p.asset_count], ["Endpts", p.endpoint_count], ["Findings", p.finding_count], ["Reports", p.open_reports]].map(([l, v]) => (
                    <div key={l as string}>
                      <div className="text-[15px] font-semibold tabular-nums">{v as number}</div>
                      <div className="text-[10px] text-faint">{l}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </Link>
          );
        })}
        {programs && !programs.length && <div className="md:col-span-2 xl:col-span-3"><Empty>No programs match this filter.</Empty></div>}
      </div>

      {showNew && <NewProgramModal onClose={() => { setShowNew(false); setSp({}); }} onCreated={() => { qc.invalidateQueries({ queryKey: ["programs"] }); setShowNew(false); setSp({}); }} />}
    </div>
  );
}

function NewProgramModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState<any>({ name: "", company: "", platform: "HackerOne", visibility: "PUBLIC", program_type: "Bug Bounty", is_watched: false, assets: "", rewards: "", invitation_status: "", invitation_source: "" });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const priv = f.visibility !== "PUBLIC" && f.visibility !== "VDP";
  const guessType = (h: string) => /graphql/i.test(h) ? "GraphQL" : /(^|\.)api\.|\/api|api\./i.test(h) ? "API" : /android|apk|play\.google/i.test(h) ? "Android" : /ios|apple|testflight/i.test(h) ? "iOS" : "Web";
  const submit = async () => {
    if (!f.name.trim()) return;
    const { assets, ...programFields } = f;
    const { id } = await post("/programs", programFields);
    const hosts = (assets ?? "").split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);
    for (const h of hosts) {
      await post("/assets", { program_id: id, name: h, type: guessType(h), url: /^https?:\/\//.test(h) ? h : `https://${h}` });
    }
    onCreated();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-6 pt-[8vh]" onClick={onClose}>
      <Card className="w-[560px] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">New Program</h2>
          <button onClick={onClose} className="cursor-pointer text-faint hover:text-fg"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name *"><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Acme Cloud" /></Field>
          <Field label="Company"><Input value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="Acme Inc." /></Field>
          <Field label="Platform">
            <Select value={f.platform} onChange={(e) => set("platform", e.target.value)}>
              {["HackerOne", "Bugcrowd", "Intigriti", "YesWeHack", "Immunefi", "Private", "Other"].map((p) => <option key={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Visibility">
            <Select value={f.visibility} onChange={(e) => set("visibility", e.target.value)}>
              {Object.keys(VIS_META).map((v) => <option key={v} value={v}>{VIS_META[v].label}</option>)}
            </Select>
          </Field>
          {priv && (
            <>
              <Field label="Invitation Status">
                <Select value={f.invitation_status} onChange={(e) => set("invitation_status", e.target.value)}>
                  {["", "Received", "Accepted", "Pending", "Expired", "Declined", "Unknown"].map((v) => <option key={v} value={v}>{v || "—"}</option>)}
                </Select>
              </Field>
              <Field label="Invitation Source"><Input value={f.invitation_source} onChange={(e) => set("invitation_source", e.target.value)} placeholder="Invite email" /></Field>
            </>
          )}
          <Field label="In-scope assets (each becomes an Asset)" full>
            <Textarea rows={3} value={f.assets} onChange={(e) => set("assets", e.target.value)} placeholder={"api.acme.com\napp.acme.com\nadmin.acme.com"} />
            <p className="mt-1 text-[10px] text-faint">One host per line (or comma-separated). Type is auto-detected; edit later in the Assets tab.</p>
          </Field>
          <Field label="Rewards" full><Input value={f.rewards} onChange={(e) => set("rewards", e.target.value)} placeholder="Critical $5000, High $2000…" /></Field>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-subtle">
          <input type="checkbox" checked={f.is_watched} onChange={(e) => set("is_watched", e.target.checked)} /> Add to watchlist
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>Create Program</Button>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: any; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="mb-1 block text-[11px] font-medium text-faint">{label}</label>
      {children}
    </div>
  );
}
