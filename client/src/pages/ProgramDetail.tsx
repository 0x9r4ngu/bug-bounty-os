import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, Lock, Eye, Plus, ExternalLink, Circle, Save, Trash2, Pencil,
  FileText, ChevronDown, ChevronRight, Bug, X, Radio,
} from "lucide-react";
import { get, post, patch, del } from "../lib/api";
import { Card, Badge, Button, Input, Select, Textarea, SeverityBadge, StatusBadge, Empty, timeAgo } from "../lib/ui";
import { confirmDialog } from "../lib/confirm";
import {
  VULN_CLASSES, SEVERITIES, FINDING_STATUSES, ASSET_TYPES, ENDPOINT_STATUSES,
  ENDPOINT_STATUS_COLOR, EP_HEALTH_COLOR, HTTP_METHODS, VISIBILITY, SUBDOMAIN_STATUS_COLOR,
} from "../lib/constants";
import { reportBodyFromFinding } from "../lib/report";
import ProgramChecklist from "../components/ProgramChecklist";
import CweSelect from "../components/CweSelect";

const TABS = ["Overview", "Assets", "Findings", "Checklist"] as const;
type Tab = (typeof TABS)[number];

export default function ProgramDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const [tab, setTab] = useState<Tab>((sp.get("tab") as Tab) || "Overview");
  const [editing, setEditing] = useState(false);
  const { data } = useQuery({ queryKey: ["program", id], queryFn: () => get(`/programs/${id}`) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["program", id] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); };

  useEffect(() => { const t = sp.get("tab") as Tab; if (t && TABS.includes(t)) setTab(t); }, [sp]);
  const changeTab = (t: Tab) => { setTab(t); const n = new URLSearchParams(sp); n.set("tab", t); n.delete("finding"); setSp(n, { replace: true }); };

  if (!data?.program) return <div className="p-6 text-faint">Loading…</div>;
  const p = data.program;

  return (
    <div className="anim-in p-6">
      <Link to="/programs" className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-faint hover:text-fg"><ArrowLeft size={14} /> Programs</Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {p.is_private ? <Lock size={16} className="text-warn" /> : null}
            <h1 className="truncate text-xl font-semibold">{p.name}</h1>
            {p.is_watched ? <Eye size={15} className="text-primary" /> : null}
            <Badge color={(VISIBILITY as any)[p.visibility]?.color}>{(VISIBILITY as any)[p.visibility]?.label ?? p.visibility}</Badge>
            <StatusBadge s={p.status} />
          </div>
          <p className="mt-0.5 text-[13px] text-faint">{p.company} · {p.platform} · {p.program_type}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={() => setEditing(true)}><Pencil size={13} /> Edit</Button>
          {p.program_url ? <a href={p.program_url} target="_blank" rel="noreferrer"><Button><ExternalLink size={13} /> Open</Button></a> : null}
        </div>
      </div>

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button key={t} onClick={() => changeTab(t)} className={`shrink-0 cursor-pointer border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-subtle hover:text-fg"}`}>
            {t}
            {t === "Assets" && ` (${data.assets.length})`}
            {t === "Findings" && ` (${data.findings.length})`}
            {t === "Checklist" && ((data.checklist ?? []).filter((r: any) => r.checked).length ? ` (${(data.checklist ?? []).filter((r: any) => r.checked).length})` : "")}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "Overview" && <Overview data={data} onTab={changeTab} />}
        {tab === "Assets" && <Assets data={data} pid={id!} onChange={invalidate} />}
        {tab === "Findings" && <FindingsTab data={data} pid={id!} onChange={invalidate} onGoAssets={() => changeTab("Assets")} />}
        {tab === "Checklist" && <ProgramChecklist pid={id!} assets={data.assets} onGoAssets={() => changeTab("Assets")} />}
      </div>

      {editing && <ProgramEditModal program={p} onClose={() => setEditing(false)} onSaved={() => { invalidate(); setEditing(false); }} />}
    </div>
  );
}

/* --------------------------------- OVERVIEW -------------------------------- */
function Overview({ data, onTab }: any) {
  const p = data.program;
  const sevCounts = SEVERITIES.map((s) => ({ s, n: data.findings.filter((f: any) => f.severity === s).length })).filter((x) => x.n);
  const bounty = data.findings.reduce((a: number, f: any) => a + (f.bounty || 0), 0);
  const stats = [
    ["Assets", data.assets.length], ["Findings", data.findings.length],
    ["Reports", data.reports.length],
  ];
  const hasInfo = p.rules || p.rewards || p.tags;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card className="p-4">
          <div className="grid grid-cols-3 gap-3">
            {stats.map(([l, v]) => {
              const target: any = { Assets: "Assets", Findings: "Findings" }[l as string];
              return (
                <button key={l as string} disabled={!target} onClick={() => target && onTab(target)} className={`text-center ${target ? "cursor-pointer hover:text-primary" : ""}`}>
                  <div className="text-[20px] font-semibold tabular-nums">{v as number}</div>
                  <div className="text-[10px] text-faint">{l}</div>
                </button>
              );
            })}
          </div>
          {(sevCounts.length || bounty > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {sevCounts.map((x) => <span key={x.s} className="flex items-center gap-1"><SeverityBadge s={x.s} /><span className="text-[11px] font-medium text-subtle">{x.n}</span></span>)}
              {bounty > 0 ? <Badge color="#7c8850">${bounty} earned</Badge> : null}
            </div>
          )}
        </Card>
        {hasInfo && (
          <Card className="p-4">
            {p.rules && <><h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">Rules</h3><p className="whitespace-pre-wrap text-[13px] text-subtle">{p.rules}</p></>}
            {p.rewards && <><h3 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-faint">Rewards</h3><p className="whitespace-pre-wrap text-[13px] text-subtle">{p.rewards}</p></>}
            {p.tags && <div className="mt-4 flex flex-wrap gap-1.5">{p.tags.split(",").filter(Boolean).map((t: string) => <Badge key={t}>#{t.trim()}</Badge>)}</div>}
          </Card>
        )}
        <Notes program={p} />
      </div>
      <div className="space-y-4">
        {!!p.is_private && (
          <Card className="p-4" style={{ borderColor: "rgba(245,158,11,0.3)" }}>
            <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-warn"><Lock size={12} /> Private Invitation</h3>
            <dl className="space-y-1.5 text-[12px]">
              <Row k="Status" v={p.invitation_status ?? "—"} />
              <Row k="Date" v={p.invitation_date ? new Date(p.invitation_date).toLocaleDateString() : "—"} />
              <Row k="Source" v={p.invitation_source ?? "—"} />
            </dl>
          </Card>
        )}
        <Card className="p-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">Timeline</h3>
          <div className="max-h-[420px] space-y-2.5 overflow-y-auto">
            {data.timeline.map((t: any) => (
              <div key={t.id} className="flex items-start gap-2 text-[12px]">
                <Circle size={7} className="mt-1 shrink-0 fill-primary/60 text-primary/60" />
                <div><div className="text-subtle">{t.title}{t.detail ? <span className="text-faint"> · {t.detail}</span> : null}</div><div className="text-[10px] text-faint">{timeAgo(t.at)}</div></div>
              </div>
            ))}
            {!data.timeline.length && <Empty>No events yet.</Empty>}
          </div>
        </Card>
      </div>
    </div>
  );
}
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-2"><dt className="text-faint">{k}</dt><dd className="text-right text-fg">{v}</dd></div>
);

/* ------------------------------ shared add row ----------------------------- */
function AddRow({ label, children }: any) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen((o) => !o)}><Plus size={13} /> {label}</Button>
      {open && <Card className="mt-3 p-3">{children(() => setOpen(false))}</Card>}
    </>
  );
}

/* ------------------------------- ENTRY POINTS ------------------------------ */
function EntryPoints({ data, pid, onChange }: any) {
  const [editId, setEditId] = useState<string | null>(null);
  return (
    <div>
      <div className="mb-3 flex justify-end"><AddRow label="Add Entry Point">{(close: any) => <EPForm pid={pid} onDone={() => { onChange(); close(); }} />}</AddRow></div>
      {data.entry_points.length ? (
        <Card className="divide-y divide-[color:var(--color-border)]">
          {data.entry_points.map((e: any) => editId === e.id ? (
            <div key={e.id} className="p-3"><EPForm pid={pid} initial={e} onDone={() => { onChange(); setEditId(null); }} onCancel={() => setEditId(null)} /></div>
          ) : (
            <div key={e.id} className="flex items-center gap-3 p-3">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: EP_HEALTH_COLOR[e.status] ?? "#8a8168" }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-medium">{e.name}</span><Badge>{e.type}</Badge>{e.environment ? <Badge color="#8a8168">{e.environment}</Badge> : null}</div>
                {e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="block truncate font-mono text-[12px] text-primary hover:underline">{e.url}</a> : null}
              </div>
              <div className="text-right text-[11px] text-faint"><div style={{ color: EP_HEALTH_COLOR[e.status] }}>{e.status}</div><div>{e.scope_status} · {e.auth_type ?? "no auth"}</div></div>
              <button onClick={() => setEditId(e.id)} title="Edit" className="cursor-pointer text-faint hover:text-fg"><Pencil size={14} /></button>
              <button onClick={() => { confirmDialog(`Delete entry point "${e.name}"?`).then((ok) => ok && del(`/entry_points/${e.id}`).then(onChange)); }} title="Delete" className="cursor-pointer text-faint hover:text-danger"><Trash2 size={14} /></button>
            </div>
          ))}
        </Card>
      ) : <Empty>No entry points. Programs often have several — main app, API, admin, GraphQL, mobile backend.</Empty>}
    </div>
  );
}
function EPForm({ pid, onDone, onCancel, initial }: any) {
  const [f, setF] = useState<any>({ program_id: pid, name: "", type: "Web Application", url: "", environment: "prod", auth_type: "", scope_status: "In Scope", status: "Needs Verification", ...(initial ?? {}) });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const save = () => {
    const body = { name: f.name, type: f.type, url: f.url, environment: f.environment, auth_type: f.auth_type, scope_status: f.scope_status, status: f.status, program_id: pid };
    (initial?.id ? patch(`/entry_points/${initial.id}`, body) : post("/entry_points", body)).then(onDone);
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <Input placeholder="Name" value={f.name} onChange={(e) => set("name", e.target.value)} />
      <Select value={f.type} onChange={(e) => set("type", e.target.value)}>{["Main Program", "Web Application", "Private Dashboard", "API Documentation", "Mobile Application", "Staging Environment", "Repository", "Cloud Console", "Other"].map((t) => <option key={t}>{t}</option>)}</Select>
      <Input placeholder="https://…" value={f.url ?? ""} onChange={(e) => set("url", e.target.value)} />
      <Input placeholder="Auth (JWT, OAuth…)" value={f.auth_type ?? ""} onChange={(e) => set("auth_type", e.target.value)} />
      <Select value={f.scope_status} onChange={(e) => set("scope_status", e.target.value)}>{["In Scope", "Out of Scope", "Unknown"].map((t) => <option key={t}>{t}</option>)}</Select>
      <Select value={f.status} onChange={(e) => set("status", e.target.value)}>{Object.keys(EP_HEALTH_COLOR).map((t) => <option key={t}>{t}</option>)}</Select>
      <div className="col-span-2 flex justify-end gap-2">{onCancel && <Button onClick={onCancel}>Cancel</Button>}<Button variant="primary" disabled={!f.name.trim()} onClick={save}>{initial?.id ? "Save" : "Add"}</Button></div>
    </div>
  );
}

/* ---------------------------------- ASSETS --------------------------------- */
function Assets({ data, pid, onChange }: any) {
  const [editId, setEditId] = useState<string | null>(null);
  const subsByAsset: Record<string, any[]> = {};
  (data.subdomains ?? []).forEach((s: any) => { (subsByAsset[s.asset_id] ??= []).push(s); });
  return (
    <div>
      <div className="mb-3 flex justify-end"><AddRow label="Add Asset">{(close: any) => <AssetForm pid={pid} onDone={() => { onChange(); close(); }} />}</AddRow></div>
      {data.assets.length ? (
        <div className="space-y-2">
          {data.assets.map((a: any) => editId === a.id ? (
            <Card key={a.id} className="p-3"><AssetForm pid={pid} initial={a} onDone={() => { onChange(); setEditId(null); }} onCancel={() => setEditId(null)} /></Card>
          ) : (
            <AssetCard key={a.id} a={a} subs={subsByAsset[a.id] ?? []} onEdit={() => setEditId(a.id)} onChange={onChange} />
          ))}
        </div>
      ) : <Empty>No assets yet.</Empty>}
    </div>
  );
}

function AssetCard({ a, subs, onEdit, onChange }: any) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [probing, setProbing] = useState(false);
  const live = subs.filter((s: any) => s.status === "Live" || s.status === "Redirect").length;
  const addSubs = async () => { if (!text.trim()) return; await post(`/assets/${a.id}/subdomains`, { hosts: text }); setText(""); onChange(); };
  const probe = async () => { setProbing(true); await post(`/assets/${a.id}/subdomains/probe`); setProbing(false); onChange(); };
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <button onClick={() => setOpen((o) => !o)} className="cursor-pointer text-faint hover:text-fg">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
        <button onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 cursor-pointer text-left">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono font-medium">{a.name}</span>
            <Badge color="#b99a3e">{a.type}</Badge>
            {subs.length ? <Badge color="#8a8168">{subs.length} subs{live ? ` · ${live} live` : ""}</Badge> : null}
          </div>
          {a.url ? <div className="mt-0.5 truncate font-mono text-[11px] text-faint">{a.url}</div> : null}
        </button>
        <button onClick={onEdit} title="Edit" className="shrink-0 cursor-pointer text-faint hover:text-fg"><Pencil size={14} /></button>
        <button onClick={() => confirmDialog(`Delete asset "${a.name}" and its ${subs.length} subdomain(s)?`).then((ok) => ok && del(`/assets/${a.id}`).then(onChange))} title="Delete" className="shrink-0 cursor-pointer text-faint hover:text-danger"><Trash2 size={14} /></button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-border bg-muted/20 p-3">
          <div className="flex items-start gap-2">
            <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Paste subdomains — one per line or comma-separated…\napp.acme.com, api.acme.com"} className="font-mono text-[12px]" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" disabled={!text.trim()} onClick={addSubs}><Plus size={13} /> Add subdomains</Button>
            {subs.length ? <Button onClick={probe} disabled={probing}><Radio size={13} className={probing ? "animate-pulse" : ""} /> {probing ? "Probing…" : "Probe live status"}</Button> : null}
            {a.technology ? <div className="ml-auto flex flex-wrap gap-1">{a.technology.split(",").map((t: string) => <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-subtle">{t.trim()}</span>)}</div> : null}
          </div>
          {subs.length ? (
            <div className="divide-y divide-[color:var(--color-border)] rounded-md border border-border">
              {subs.map((s: any) => (
                <div key={s.id} className="flex items-center gap-2.5 px-3 py-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SUBDOMAIN_STATUS_COLOR[s.status] ?? "#8a8168" }} />
                  <span className="truncate font-mono text-[12px]">{s.host}</span>
                  {s.http_code ? <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium" style={{ color: SUBDOMAIN_STATUS_COLOR[s.status] }}>{s.http_code}</span> : null}
                  {s.title ? <span className="min-w-0 flex-1 truncate text-[11px] text-faint">{s.title}</span> : <span className="flex-1" />}
                  <span className="shrink-0 text-[11px]" style={{ color: SUBDOMAIN_STATUS_COLOR[s.status] }}>{s.status}</span>
                  <a href={`https://${s.host}`} target="_blank" rel="noreferrer" className="shrink-0 text-faint hover:text-primary" title="Open"><ExternalLink size={13} /></a>
                  <button onClick={() => del(`/subdomains/${s.id}`).then(onChange)} title="Remove" className="shrink-0 cursor-pointer text-faint hover:text-danger"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          ) : <div className="text-[12px] text-faint">No subdomains yet — paste some above to enumerate under this asset.</div>}
        </div>
      )}
    </Card>
  );
}
const guessAssetType = (h: string) => /graphql/i.test(h) ? "GraphQL" : /(^|\.)api\.|\/api|api\./i.test(h) ? "API" : /android|apk|play\.google/i.test(h) ? "Android" : /ios|apple|testflight/i.test(h) ? "iOS" : "Web";
const hostName = (h: string) => h.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
const hostUrl = (h: string) => (/^https?:\/\//.test(h.trim()) ? h.trim() : `https://${hostName(h)}`);

function AssetForm({ pid, onDone, onCancel, initial }: any) {
  const edit = !!initial?.id;
  const [f, setF] = useState<any>(edit
    ? { host: initial.url || initial.name || "", type: initial.type ?? "Web", technology: initial.technology ?? "" }
    : { hosts: "", type: "Auto", technology: "" });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    if (edit) {
      const host = f.host.trim();
      if (!host) return;
      await patch(`/assets/${initial.id}`, { name: hostName(host), url: hostUrl(host), type: f.type, technology: f.technology });
      onDone();
      return;
    }
    const hosts = (f.hosts ?? "").split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);
    for (const h of hosts) {
      await post("/assets", { program_id: pid, name: hostName(h), url: hostUrl(h), type: f.type === "Auto" ? guessAssetType(h) : f.type, technology: f.technology });
    }
    onDone();
  };

  if (edit) return (
    <div className="grid grid-cols-3 gap-2">
      <Input className="col-span-3" placeholder="host (app.acme.com)" value={f.host} onChange={(e) => set("host", e.target.value)} />
      <Select value={f.type} onChange={(e) => set("type", e.target.value)}>{ASSET_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
      <Input className="col-span-2" placeholder="Tech (React, Nginx…)" value={f.technology ?? ""} onChange={(e) => set("technology", e.target.value)} />
      <div className="col-span-3 flex justify-end gap-2">{onCancel && <Button onClick={onCancel}>Cancel</Button>}<Button variant="primary" disabled={!f.host.trim()} onClick={save}>Save</Button></div>
    </div>
  );

  const count = (f.hosts ?? "").split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean).length;
  return (
    <div className="space-y-2">
      <Textarea rows={4} placeholder={"Add multiple assets — one host per line (or comma-separated):\n\napp.acme.com\napi.acme.com\nadmin.acme.com"} value={f.hosts} onChange={(e) => set("hosts", e.target.value)} className="font-mono" />
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-faint">Type</label>
        <div className="w-40"><Select value={f.type} onChange={(e) => set("type", e.target.value)}><option value="Auto">Auto-detect</option>{ASSET_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></div>
        <Button variant="primary" className="ml-auto" disabled={!count} onClick={save}>Add {count > 1 ? `${count} Assets` : "Asset"}</Button>
      </div>
    </div>
  );
}

/* -------------------------------- ENDPOINTS -------------------------------- */
function Endpoints({ data, pid, onChange }: any) {
  const [findingFor, setFindingFor] = useState<any>(null);
  const [editId, setEditId] = useState<string | null>(null);
  return (
    <div>
      <div className="mb-3 flex justify-end"><AddRow label="Add Endpoint">{(close: any) => <EndpointForm pid={pid} assets={data.assets} onDone={() => { onChange(); close(); }} />}</AddRow></div>
      {data.endpoints.length ? (
        <Card>
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint"><th className="p-2.5 font-medium">Method</th><th className="p-2.5 font-medium">Path</th><th className="p-2.5 font-medium">Test Status</th><th className="p-2.5 font-medium text-right">Actions</th></tr></thead>
            <tbody>
              {data.endpoints.map((e: any) => editId === e.id ? (
                <tr key={e.id} className="border-b border-border last:border-0"><td colSpan={4} className="p-3"><EndpointForm pid={pid} assets={data.assets} initial={e} onDone={() => { onChange(); setEditId(null); }} onCancel={() => setEditId(null)} /></td></tr>
              ) : (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-surface2/30">
                  <td className="p-2.5"><span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-primary">{e.method}</span></td>
                  <td className="p-2.5 font-mono text-[12px]">{e.path}</td>
                  <td className="p-2.5">
                    <div className="w-44">
                      <Select value={e.status} onChange={(ev) => patch(`/endpoints/${e.id}`, { status: ev.target.value }).then(onChange)} style={{ color: ENDPOINT_STATUS_COLOR[e.status] }}>
                        {ENDPOINT_STATUSES.map((s) => <option key={s} className="text-fg">{s}</option>)}
                      </Select>
                    </div>
                  </td>
                  <td className="p-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setFindingFor(e)} title="Log finding for this endpoint" className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] text-subtle hover:bg-surface2 hover:text-fg"><Bug size={12} /> Finding</button>
                      <button onClick={() => setEditId(e.id)} title="Edit" className="cursor-pointer text-faint hover:text-fg"><Pencil size={14} /></button>
                      <button onClick={() => { confirmDialog(`Delete endpoint "${e.method} ${e.path}"?`).then((ok) => ok && del(`/endpoints/${e.id}`).then(onChange)); }} title="Delete" className="cursor-pointer text-faint hover:text-danger"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : <Empty>No endpoints recorded.</Empty>}
      {findingFor && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-6 pt-[7vh]" onClick={() => setFindingFor(null)}>
          <Card className="w-[620px] p-5" onClick={(ev) => ev.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">New Finding · {findingFor.method} {findingFor.path}</h2><button onClick={() => setFindingFor(null)} className="cursor-pointer text-faint hover:text-fg"><X size={18} /></button></div>
            <FindingForm pid={pid} assets={data.assets} endpoints={data.endpoints} initial={{ endpoint_id: findingFor.id, asset_id: findingFor.asset_id, title: `Issue on ${findingFor.method} ${findingFor.path}` }} onDone={() => { onChange(); setFindingFor(null); }} />
          </Card>
        </div>
      )}
    </div>
  );
}
function EndpointForm({ pid, assets, onDone, onCancel, initial }: any) {
  const [f, setF] = useState<any>({ program_id: pid, method: "GET", path: "", asset_id: assets[0]?.id ?? "", status: "Untested", ...(initial ?? {}) });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const save = () => {
    const body = { method: f.method, path: f.path, asset_id: f.asset_id || null, status: f.status, program_id: pid };
    (initial?.id ? patch(`/endpoints/${initial.id}`, body) : post("/endpoints", body)).then(onDone);
  };
  return (
    <div className="grid grid-cols-4 gap-2">
      <Select value={f.method} onChange={(e) => set("method", e.target.value)}>{HTTP_METHODS.map((m) => <option key={m}>{m}</option>)}</Select>
      <Input className="col-span-2" placeholder="/api/v2/users/{id}" value={f.path} onChange={(e) => set("path", e.target.value)} />
      <Select value={f.asset_id ?? ""} onChange={(e) => set("asset_id", e.target.value)}><option value="">No asset</option>{assets.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
      <div className="col-span-4 flex justify-end gap-2">{onCancel && <Button onClick={onCancel}>Cancel</Button>}<Button variant="primary" disabled={!f.path.trim()} onClick={save}>{initial?.id ? "Save" : "Add"}</Button></div>
    </div>
  );
}

/* --------------------------------- FINDINGS -------------------------------- */
function FindingsTab({ data, pid, onChange, onGoAssets }: any) {
  const nav = useNavigate();
  const assets = data.assets;
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const subsByAsset: Record<string, any[]> = {};
  (data.subdomains ?? []).forEach((s: any) => { (subsByAsset[s.asset_id] ??= []).push(s); });
  const multi = assets.length > 1 || (data.subdomains ?? []).length > 0;

  // A finding is always bound to an asset (and optionally a specific subdomain).
  const createFor = async (asset: any, sub?: any) => {
    setBusy(true); setPickerOpen(false);
    const target = sub?.host ?? asset.name;
    const title = "Untitled finding";
    const { id: fid } = await post("/findings", { program_id: pid, title, severity: "Medium", status: "Potential", asset_id: asset.id, subdomain_id: sub?.id ?? null });
    const body = reportBodyFromFinding({ title, severity: "Medium" }, target);
    const { id: rid } = await post("/reports", { title, program_id: pid, finding_id: fid, severity: "Medium", markdown_content: body, folder: "Drafts" });
    nav(`/reports/${rid}`);
  };
  const onNew = async () => {
    if (!assets.length) {
      if (await confirmDialog({ title: "Add an asset first", message: "Findings are bound to an asset (your scope target). Add at least one asset before creating a finding.", confirmText: "Go to Assets", danger: false })) onGoAssets();
      return;
    }
    if (!multi) { createFor(assets[0]); return; }
    setPickerOpen((o) => !o);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] text-faint">{data.findings.length} findings in this program</p>
        <div className="relative">
          <Button variant="primary" disabled={busy} onClick={onNew}><Plus size={13} /> New Finding{multi ? <ChevronDown size={13} /> : null}</Button>
          {pickerOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 max-h-[60vh] w-72 overflow-y-auto rounded-md border border-border-strong bg-surface p-1 shadow-xl" onMouseLeave={() => setPickerOpen(false)}>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-faint">Bind finding to asset / subdomain</div>
              {assets.map((a: any) => (
                <div key={a.id}>
                  <button onClick={() => createFor(a)} className="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-[13px] hover:bg-surface2">
                    <Badge color="#b99a3e">{a.type}</Badge><span className="truncate font-mono">{a.name}</span>
                  </button>
                  {(subsByAsset[a.id] ?? []).map((s: any) => (
                    <button key={s.id} onClick={() => createFor(a, s)} className="flex w-full cursor-pointer items-center gap-2 rounded py-1.5 pl-8 pr-3 text-left text-[12px] text-subtle hover:bg-surface2 hover:text-fg">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SUBDOMAIN_STATUS_COLOR[s.status] ?? "#8a8168" }} /><span className="truncate font-mono">{s.host}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {data.findings.length ? (
        <div className="space-y-2">
          {data.findings.map((f: any) => (
            <FindingRow key={f.id} f={f} assets={data.assets} onChange={onChange} />
          ))}
        </div>
      ) : <Empty>{assets.length ? "No findings yet. Click “New Finding” to start one — it binds to an asset/subdomain and opens the report editor." : "Add an asset first — findings are bound to your scope assets."}</Empty>}
    </div>
  );
}

function FindingRow({ f, assets, onChange }: any) {
  const nav = useNavigate();
  const asset = assets.find((a: any) => a.id === f.asset_id);
  const [busy, setBusy] = useState(false);
  // Edit opens the finding's linked report directly (creating one if it somehow has none).
  const openReport = async () => {
    setBusy(true);
    const detail = await get(`/findings/${f.id}`);
    if (detail?.report) { nav(`/reports/${detail.report.id}`); return; }
    const body = reportBodyFromFinding({ ...f }, asset?.name);
    const { id } = await post("/reports", { title: f.title, program_id: f.program_id, finding_id: f.id, severity: f.severity, cvss: f.cvss, cwe: f.cwe, markdown_content: body, folder: "Drafts" });
    nav(`/reports/${id}`);
  };
  return (
    <Card>
      <div className="flex items-center gap-3 p-3">
        <SeverityBadge s={f.severity} />
        <button onClick={openReport} className="min-w-0 flex-1 cursor-pointer text-left">
          <span className="truncate font-medium hover:text-primary">{f.title}</span>
          {(() => { const target = f.subdomain_host ?? asset?.name; return (f.vuln_class || target) ? <span className="ml-2 text-[11px] text-faint">{f.vuln_class}{f.vuln_class && target ? " · " : ""}{target ?? ""}</span> : null; })()}
        </button>
        <div className="w-36 shrink-0">
          <Select value={f.status} onChange={(e) => patch(`/findings/${f.id}`, { status: e.target.value }).then(onChange)}>
            {FINDING_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </div>
        <button onClick={openReport} disabled={busy} title="Edit report" className="shrink-0 cursor-pointer text-faint hover:text-fg disabled:opacity-40"><Pencil size={15} /></button>
        <button onClick={() => confirmDialog(`Delete finding "${f.title}"?`).then((ok) => ok && del(`/findings/${f.id}`).then(onChange))} title="Delete finding" className="shrink-0 cursor-pointer text-faint hover:text-danger"><Trash2 size={15} /></button>
      </div>
    </Card>
  );
}

function FindingForm({ pid, assets, endpoints, initial, onDone, onCancel }: any) {
  const [f, setF] = useState<any>({
    program_id: pid, title: "", vuln_class: "IDOR/BOLA", severity: "Medium", status: "Potential",
    asset_id: "", endpoint_id: "", cvss: "", cwe: "", bounty: 0, observation: "", ...(initial ?? {}),
  });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.title.trim()) return;
    const body = { ...f, cvss: f.cvss === "" ? null : parseFloat(f.cvss), bounty: parseFloat(f.bounty) || 0, asset_id: f.asset_id || null, endpoint_id: f.endpoint_id || null };
    if (initial?.id) await patch(`/findings/${initial.id}`, body);
    else await post("/findings", body);
    onDone();
  };
  return (
    <div className="space-y-3">
      <Input placeholder="Finding title" value={f.title} onChange={(e) => set("title", e.target.value)} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Labeled l="Class"><Select value={f.vuln_class} onChange={(e) => set("vuln_class", e.target.value)}>{VULN_CLASSES.map((v) => <option key={v}>{v}</option>)}</Select></Labeled>
        <Labeled l="Severity"><Select value={f.severity} onChange={(e) => set("severity", e.target.value)}>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</Select></Labeled>
        <Labeled l="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{FINDING_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Labeled>
        <Labeled l="Bounty ($)"><Input type="number" value={f.bounty} onChange={(e) => set("bounty", e.target.value)} /></Labeled>
        <Labeled l="Asset"><Select value={f.asset_id ?? ""} onChange={(e) => set("asset_id", e.target.value)}><option value="">— none —</option>{assets.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Labeled>
        <Labeled l="CVSS"><Input value={f.cvss ?? ""} onChange={(e) => set("cvss", e.target.value)} placeholder="7.5" /></Labeled>
        <Labeled l="CWE"><CweSelect value={f.cwe} onChange={(v) => set("cwe", v)} /></Labeled>
      </div>
      <Labeled l="Observation"><Textarea rows={3} value={f.observation ?? ""} onChange={(e) => set("observation", e.target.value)} placeholder="What you observed, with which accounts…" /></Labeled>
      <div className="flex justify-end gap-2">
        {onCancel && <Button onClick={onCancel}>Cancel</Button>}
        <Button variant="primary" disabled={!f.title.trim()} onClick={save}>{initial?.id ? "Save Changes" : "Add Finding"}</Button>
      </div>
    </div>
  );
}
const Labeled = ({ l, children, full }: any) => (<div className={full ? "col-span-2" : ""}><label className="mb-1 block text-[11px] text-faint">{l}</label>{children}</div>);

/* ---------------------------------- NOTES ---------------------------------- */
function Notes({ program }: any) {
  const [val, setVal] = useState(program.notes ?? "");
  const [state, setState] = useState<"saved" | "saving" | "dirty">("saved");
  const t = useRef<any>(null);
  useEffect(() => {
    if (val === (program.notes ?? "")) return;
    setState("dirty");
    clearTimeout(t.current);
    t.current = setTimeout(async () => { setState("saving"); await patch(`/programs/${program.id}`, { notes: val }); setState("saved"); }, 700);
    return () => clearTimeout(t.current);
  }, [val]);
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-faint">Research Notes (Markdown · autosave)</h3>
        <span className="flex items-center gap-1 text-[11px] text-faint"><Save size={11} /> {state === "saved" ? "Saved" : state === "saving" ? "Saving…" : "Unsaved changes"}</span>
      </div>
      <Textarea value={val} onChange={(e) => setVal(e.target.value)} rows={22} className="font-mono text-[13px]" />
    </Card>
  );
}

/* --------------------------------- TIMELINE -------------------------------- */
function Timeline({ data }: any) {
  return data.timeline.length ? (
    <div className="relative ml-2 border-l border-border pl-6">
      {data.timeline.map((t: any) => (
        <div key={t.id} className="relative mb-5">
          <span className="absolute -left-[31px] top-0.5 h-3 w-3 rounded-full border-2 border-bg bg-primary" />
          <div className="text-[11px] text-faint">{new Date(t.at).toLocaleString()}</div>
          <div className="text-[14px] font-medium">{t.title}</div>
          {t.detail ? <div className="text-[13px] text-subtle">{t.detail}</div> : null}
        </div>
      ))}
    </div>
  ) : <Empty>No timeline events.</Empty>;
}

/* ------------------------------ PROGRAM EDIT ------------------------------- */
function ProgramEditModal({ program, onClose, onSaved }: any) {
  const [f, setF] = useState<any>({ ...program });
  const nav = useNavigate();
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const remove = async () => {
    if (!(await confirmDialog(`Delete program "${program.name}" and ALL its entry points, assets, endpoints, findings and reports? This cannot be undone.`))) return;
    await del(`/programs/${program.id}`);
    nav("/programs");
  };
  const save = async () => {
    await patch(`/programs/${program.id}`, {
      name: f.name, company: f.company, platform: f.platform, program_type: f.program_type,
      visibility: f.visibility, status: f.status, is_watched: !!f.is_watched, is_private: f.visibility !== "PUBLIC" && f.visibility !== "VDP",
      program_url: f.program_url, private_url: f.private_url, rules: f.rules, rewards: f.rewards, tags: f.tags,
      invitation_status: f.invitation_status, invitation_date: f.invitation_date, invitation_source: f.invitation_source,
    });
    onSaved();
  };
  const priv = f.visibility !== "PUBLIC" && f.visibility !== "VDP";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-6 pt-[6vh]" onClick={onClose}>
      <Card className="w-[640px] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Edit Program</h2><button onClick={onClose} className="cursor-pointer text-faint hover:text-fg"><X size={18} /></button></div>
        <div className="grid grid-cols-2 gap-3">
          <Labeled l="Name"><Input value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Labeled>
          <Labeled l="Company"><Input value={f.company ?? ""} onChange={(e) => set("company", e.target.value)} /></Labeled>
          <Labeled l="Platform"><Select value={f.platform ?? ""} onChange={(e) => set("platform", e.target.value)}>{["HackerOne", "Bugcrowd", "Intigriti", "YesWeHack", "Immunefi", "Private", "Other"].map((p) => <option key={p}>{p}</option>)}</Select></Labeled>
          <Labeled l="Type"><Select value={f.program_type ?? ""} onChange={(e) => set("program_type", e.target.value)}>{["Bug Bounty", "VDP", "Pentest", "Other"].map((p) => <option key={p}>{p}</option>)}</Select></Labeled>
          <Labeled l="Visibility"><Select value={f.visibility} onChange={(e) => set("visibility", e.target.value)}>{Object.keys(VISIBILITY).map((v) => <option key={v} value={v}>{(VISIBILITY as any)[v].label}</option>)}</Select></Labeled>
          <Labeled l="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{["Active", "Paused", "Archived", "Closed", "Expired"].map((s) => <option key={s}>{s}</option>)}</Select></Labeled>
          <Labeled l="Program URL"><Input value={f.program_url ?? ""} onChange={(e) => set("program_url", e.target.value)} /></Labeled>
          <Labeled l="Tags (comma)"><Input value={f.tags ?? ""} onChange={(e) => set("tags", e.target.value)} /></Labeled>
          {priv && <>
            <Labeled l="Invitation status"><Select value={f.invitation_status ?? ""} onChange={(e) => set("invitation_status", e.target.value)}>{["", "Received", "Accepted", "Pending", "Expired", "Declined", "Unknown"].map((v) => <option key={v} value={v}>{v || "—"}</option>)}</Select></Labeled>
            <Labeled l="Invitation source"><Input value={f.invitation_source ?? ""} onChange={(e) => set("invitation_source", e.target.value)} /></Labeled>
          </>}
          <Labeled l="Rules" full><Textarea rows={2} value={f.rules ?? ""} onChange={(e) => set("rules", e.target.value)} /></Labeled>
          <Labeled l="Rewards" full><Input value={f.rewards ?? ""} onChange={(e) => set("rewards", e.target.value)} /></Labeled>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-subtle"><input type="checkbox" checked={!!f.is_watched} onChange={(e) => set("is_watched", e.target.checked)} /> Watch this program</label>
        <div className="mt-5 flex items-center justify-between gap-2">
          <Button variant="danger" onClick={remove}><Trash2 size={13} /> Delete Program</Button>
          <div className="flex gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save Changes</Button></div>
        </div>
      </Card>
    </div>
  );
}
