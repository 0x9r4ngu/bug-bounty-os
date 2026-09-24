import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  ArrowLeft, Save, Eye, Code2, ListTree, CheckSquare, History, Settings2,
  ShieldAlert, Download, Star, FileCode, Copy, RotateCcw, GitBranch, X, Plus, Trash2,
} from "lucide-react";
import { get, patch, post, del } from "../lib/api";
import { Card, Button, Select, Badge, StatusBadge, timeAgo, SEVERITY_COLORS } from "../lib/ui";
import { confirmDialog } from "../lib/confirm";
import { TEMPLATES, SNIPPETS, QUALITY_SECTIONS, scanSecrets, redactAll, outline } from "../lib/report";
import CweSelect from "../components/CweSelect";

marked.setOptions({ gfm: true, breaks: false });

type Panel = "outline" | "snippets";

export default function ReportEditor() {
  const { id } = useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data } = useQuery({ queryKey: ["report", id], queryFn: () => get(`/reports/${id}`) });

  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  const [showPreview, setShowPreview] = useState(true);
  const [panel, setPanel] = useState<Panel>("outline");
  const [loaded, setLoaded] = useState(false);
  const editorRef = useRef<EditorView | null>(null);
  const saveTimer = useRef<any>(null);

  // load
  useEffect(() => {
    if (data?.report && !loaded) {
      setContent(data.report.markdown_content ?? "");
      setTitle(data.report.title ?? "");
      setLoaded(true);
      // local draft recovery
      const draft = localStorage.getItem(`report-draft-${id}`);
      if (draft && draft !== data.report.markdown_content) {
        confirmDialog({ title: "Recover draft", message: "An unsaved local draft was recovered. Restore it?", confirmText: "Restore", cancelText: "Discard", danger: false })
          .then((ok) => { if (ok) setContent(draft); else localStorage.removeItem(`report-draft-${id}`); });
      }
    }
  }, [data, loaded, id]);

  // autosave
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(`report-draft-${id}`, content);
    setSaveState("dirty");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveState("saving");
      await patch(`/reports/${id}`, { markdown_content: content, title });
      localStorage.removeItem(`report-draft-${id}`);
      setSaveState("saved");
      qc.invalidateQueries({ queryKey: ["report", id] });
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [content, title, loaded, id]);

  const html = useMemo(() => DOMPurify.sanitize(marked.parse(content) as string), [content]);
  const secrets = useMemo(() => scanSecrets(content), [content]);
  const heads = useMemo(() => outline(content), [content]);
  const stats = useMemo(() => ({
    words: content.trim() ? content.trim().split(/\s+/).length : 0,
    chars: content.length,
    sections: heads.length,
    code: (content.match(/```/g)?.length ?? 0) / 2,
    images: (content.match(/!\[/g)?.length ?? 0),
  }), [content, heads]);

  if (!data?.report) return <div className="p-6 text-faint">Loading…</div>;
  const report = data.report;

  const insert = (text: string) => {
    const view = editorRef.current;
    if (!view) { setContent((c) => c + "\n" + text); return; }
    const pos = view.state.selection.main.to;
    view.dispatch({ changes: { from: pos, insert: "\n" + text }, selection: { anchor: pos + text.length + 1 } });
    view.focus();
  };
  const jumpToLine = (line: number) => {
    const view = editorRef.current;
    if (!view) return;
    const l = view.state.doc.line(line + 1);
    view.dispatch({ selection: { anchor: l.from }, effects: EditorView.scrollIntoView(l.from, { y: "start" }) });
    view.focus();
  };

  const snapshot = async () => {
    const summary = prompt("Version note:", `Version ${(report.version ?? 1) + 1}`);
    await post(`/reports/${id}/versions`, { change_summary: summary ?? "" });
    qc.invalidateQueries({ queryKey: ["report", id] });
  };
  const exportAs = (fmt: "md" | "html") => {
    const clean = redactAll(content);
    const payload = fmt === "md" ? clean : `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Inter,system-ui;max-width:820px;margin:2rem auto;padding:0 1.5rem;color:#111;line-height:1.6}pre{background:#f5f5f5;padding:1rem;border-radius:8px;overflow-x:auto}code{font-family:monospace}table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px}</style></head><body>${DOMPurify.sanitize(marked.parse(clean) as string)}</body></html>`;
    const blob = new Blob([payload], { type: fmt === "md" ? "text/markdown" : "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${fmt}`;
    a.click();
  };

  const updMeta = (body: any) => patch(`/reports/${id}`, body).then(() => qc.invalidateQueries({ queryKey: ["report", id] }));

  const PANELS: { key: Panel; icon: any; label: string; badge?: number }[] = [
    { key: "outline", icon: ListTree, label: "Outline" },
    { key: "snippets", icon: FileCode, label: "Snippets" },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* toolbar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <Link to="/reports" className="text-faint hover:text-fg"><ArrowLeft size={16} /></Link>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none" />
        <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-faint">
          <Save size={11} className={saveState === "saving" ? "animate-pulse" : ""} />
          {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : "Unsaved"}
        </span>
        <div className="h-4 w-px bg-border" />
        <label className="flex items-center gap-1.5 text-[11px] text-faint">Status
          <select value={report.status} onChange={(e) => updMeta({ status: e.target.value })} className="cursor-pointer rounded-md border border-border bg-muted px-2 py-1 text-[12px] text-fg outline-none focus:border-primary">
            {["Draft", "In Progress", "Ready", "Submitted", "Accepted", "Resolved", "Rejected", "Archived"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-faint">Severity
          <select value={report.severity ?? "Medium"} onChange={(e) => updMeta({ severity: e.target.value })} className="cursor-pointer rounded-md border border-border bg-muted px-2 py-1 text-[12px] outline-none focus:border-primary" style={{ color: SEVERITY_COLORS[report.severity ?? "Medium"] ?? "var(--color-fg)" }}>
            {["Critical", "High", "Medium", "Low", "Informational"].map((s) => <option key={s} className="text-fg">{s}</option>)}
          </select>
        </label>
        <div className="h-4 w-px bg-border" />
        <TemplateMenu onPick={(b) => confirmDialog({ title: "Apply template", message: "Replace editor content with this template?", confirmText: "Replace", danger: false }).then((ok) => ok && setContent(b))} />
        <Button variant="ghost" onClick={() => setShowPreview((p) => !p)}>{showPreview ? <Code2 size={14} /> : <Eye size={14} />}{showPreview ? "Editor" : "Preview"}</Button>
        <Button variant="danger" onClick={async () => { if (await confirmDialog({ message: `Delete report "${title}"? This cannot be undone.`, confirmText: "Delete report" })) { await del(`/reports/${id}`); nav("/reports"); } }}><Trash2 size={14} /> Delete</Button>
        <ExportMenu onExport={exportAs} onCopy={() => navigator.clipboard.writeText(content)} />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* editor + preview */}
        <div className="flex min-w-0 flex-1">
          <div className={`min-w-0 ${showPreview ? "w-1/2 border-r border-border" : "w-full"}`}>
            <CodeMirror
              value={content}
              height="100%"
              theme="light"
              extensions={[markdown(), EditorView.lineWrapping]}
              onChange={setContent}
              onCreateEditor={(view) => (editorRef.current = view)}
              style={{ height: "100%" }}
              basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
            />
          </div>
          {showPreview && (
            <div className="w-1/2 overflow-y-auto bg-bg px-8 py-6">
              <div className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          )}
        </div>

        {/* right rail */}
        <div className="flex w-72 shrink-0 flex-col border-l border-border">
          <div className="flex border-b border-border">
            {PANELS.map((p) => (
              <button key={p.key} onClick={() => setPanel(p.key)} title={p.label} className={`relative flex flex-1 cursor-pointer items-center justify-center py-2.5 transition-colors ${panel === p.key ? "bg-surface2 text-primary" : "text-faint hover:text-fg"}`}>
                <p.icon size={15} />
                {p.badge ? <span className="absolute right-1.5 top-1 rounded-full bg-primary px-1 text-[9px] font-semibold text-white">{p.badge}</span> : null}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {panel === "outline" && <OutlinePanel heads={heads} onJump={jumpToLine} stats={stats} />}
            {panel === "snippets" && <SnippetsPanel onInsert={insert} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function OutlinePanel({ heads, onJump, stats }: any) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">Outline</h3>
      {heads.length ? heads.map((h: any, i: number) => (
        <button key={i} onClick={() => onJump(h.line)} className="block w-full cursor-pointer truncate rounded px-2 py-1 text-left text-[12px] text-subtle hover:bg-surface2 hover:text-fg" style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}>{h.text}</button>
      )) : <p className="px-2 text-[12px] text-faint">Add headings to build an outline.</p>}
      <div className="mt-4 border-t border-border pt-3">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">Stats</h3>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          {[["Words", stats.words], ["Chars", stats.chars], ["Sections", stats.sections], ["Code blocks", stats.code], ["Images", stats.images]].map(([l, v]) => (
            <div key={l as string} className="flex justify-between rounded bg-muted px-2 py-1"><span className="text-faint">{l}</span><span className="font-medium tabular-nums">{v as number}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QualityPanel({ content, done }: any) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-faint">Report Quality</h3>
        <span className="text-[12px] font-semibold text-primary">{done}/{QUALITY_SECTIONS.length}</span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(done / QUALITY_SECTIONS.length) * 100}%` }} /></div>
      <div className="space-y-1">
        {QUALITY_SECTIONS.map((q) => {
          const ok = q.test(content);
          return (
            <div key={q.key} className="flex items-center gap-2 rounded px-2 py-1.5 text-[12px]">
              <span className={`flex h-4 w-4 items-center justify-center rounded ${ok ? "bg-accent/20 text-accent" : "border border-border text-transparent"}`}>{ok ? "✓" : ""}</span>
              <span className={ok ? "text-subtle" : "text-faint"}>{q.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetadataPanel({ report, id, onSaved }: any) {
  const upd = (patchBody: any) => patch(`/reports/${id}`, patchBody).then(onSaved);
  const Field = ({ label, children }: any) => (<div className="mb-2"><label className="mb-1 block text-[11px] text-faint">{label}</label>{children}</div>);
  return (
    <div>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-faint">Metadata</h3>
      <Field label="Status"><Select defaultValue={report.status} onChange={(e) => upd({ status: e.target.value })}>{["Draft", "In Progress", "Ready", "Submitted", "Accepted", "Resolved", "Rejected", "Archived"].map((s) => <option key={s}>{s}</option>)}</Select></Field>
      <Field label="Folder"><Select defaultValue={report.folder} onChange={(e) => upd({ folder: e.target.value })}>{["Drafts", "Submitted", "Accepted", "Resolved", "Archived"].map((s) => <option key={s}>{s}</option>)}</Select></Field>
      <Field label="Severity"><Select defaultValue={report.severity ?? "Medium"} onChange={(e) => upd({ severity: e.target.value })}>{["Critical", "High", "Medium", "Low", "Informational"].map((s) => <option key={s}>{s}</option>)}</Select></Field>
      <Field label="CVSS"><input defaultValue={report.cvss ?? ""} onBlur={(e) => upd({ cvss: parseFloat(e.target.value) || null })} className="w-full rounded-md border border-border bg-muted px-2 py-1.5 text-[13px] outline-none focus:border-primary" placeholder="7.5" /></Field>
      <Field label="CWE"><CweSelect value={report.cwe} onChange={(v) => upd({ cwe: v || null })} /></Field>
      <Field label="Bounty ($)"><input defaultValue={report.bounty ?? 0} onBlur={(e) => upd({ bounty: parseFloat(e.target.value) || 0 })} className="w-full rounded-md border border-border bg-muted px-2 py-1.5 text-[13px] outline-none focus:border-primary" /></Field>
      <Field label="Submission platform"><input defaultValue={report.submission_platform ?? ""} onBlur={(e) => upd({ submission_platform: e.target.value })} className="w-full rounded-md border border-border bg-muted px-2 py-1.5 text-[13px] outline-none focus:border-primary" placeholder="HackerOne" /></Field>
      <button onClick={() => upd({ is_favorite: !report.is_favorite })} className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border py-2 text-[12px] hover:bg-surface2"><Star size={13} className={report.is_favorite ? "fill-warn text-warn" : ""} /> {report.is_favorite ? "Favorited" : "Add to favorites"}</button>
    </div>
  );
}

function VersionsPanel({ versions, id, onChange, onRestore }: any) {
  const view = async (vid: string) => { const v = await get(`/reports/${id}/versions/${vid}`); onRestore(v.markdown_content); };
  const restore = async (vid: string) => { if (await confirmDialog({ title: "Restore version", message: "Restore this version into the editor?", confirmText: "Restore", danger: false })) { await post(`/reports/${id}/restore/${vid}`); const v = await get(`/reports/${id}/versions/${vid}`); onRestore(v.markdown_content); onChange(); } };
  return (
    <div>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-faint">Version History</h3>
      {versions?.length ? versions.map((v: any) => (
        <Card key={v.id} className="mb-2 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium">Version {v.version_number}</span>
            {v.is_submitted ? <Badge color="#b0743a">Submitted</Badge> : null}
          </div>
          <div className="text-[11px] text-faint">{v.change_summary} · {timeAgo(v.created_at)}</div>
          <div className="mt-2 flex gap-1">
            <button onClick={() => view(v.id)} className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] text-subtle hover:bg-surface2"><Eye size={11} /> View</button>
            <button onClick={() => restore(v.id)} className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] text-subtle hover:bg-surface2"><RotateCcw size={11} /> Restore</button>
          </div>
        </Card>
      )) : <p className="text-[12px] text-faint">No versions yet. Use Snapshot to save one.</p>}
    </div>
  );
}

function SnippetsPanel({ onInsert }: any) {
  return (
    <div>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-faint">Insert Snippet</h3>
      {Object.entries(SNIPPETS).map(([name, body]) => (
        <button key={name} onClick={() => onInsert(body)} className="mb-1.5 flex w-full cursor-pointer items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-left text-[12px] text-subtle hover:border-primary/40 hover:text-fg"><Plus size={12} /> {name}</button>
      ))}
    </div>
  );
}

function SecretsPanel({ secrets, onRedact }: any) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-faint">Secret Detection</h3>
        {secrets.length ? <span className="text-[12px] font-semibold text-danger">{secrets.length}</span> : null}
      </div>
      {secrets.length ? (
        <>
          <p className="mb-3 text-[11px] text-faint">Potential secrets found. Redaction edits the draft — it never modifies silently.</p>
          <div className="space-y-1.5">
            {secrets.map((s: any, i: number) => (
              <div key={i} className="rounded-md border border-danger/30 bg-danger/5 p-2">
                <div className="text-[11px] font-medium text-danger">{s.name}</div>
                <div className="truncate font-mono text-[11px] text-subtle">{s.value.slice(0, 40)}{s.value.length > 40 ? "…" : ""}</div>
              </div>
            ))}
          </div>
          <Button variant="danger" className="mt-3 w-full justify-center" onClick={onRedact}><ShieldAlert size={13} /> Redact all</Button>
        </>
      ) : <p className="text-[12px] text-faint">No secrets detected. Exports are also auto-redacted as a safety net.</p>}
    </div>
  );
}

function TemplateMenu({ onPick }: any) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="ghost" onClick={() => setOpen((o) => !o)}><FileCode size={14} /> Template</Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-md border border-border-strong bg-surface p-1 shadow-xl" onMouseLeave={() => setOpen(false)}>
          {Object.entries(TEMPLATES).map(([k, t]) => (
            <button key={k} onClick={() => { onPick(t.body); setOpen(false); }} className="block w-full cursor-pointer rounded px-3 py-2 text-left text-[13px] hover:bg-surface2">{t.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
function ExportMenu({ onExport, onCopy }: any) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="primary" onClick={() => setOpen((o) => !o)}><Download size={14} /> Export</Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border border-border-strong bg-surface p-1 shadow-xl" onMouseLeave={() => setOpen(false)}>
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-faint">Auto-redacted</div>
          <button onClick={() => { onExport("md"); setOpen(false); }} className="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-[13px] hover:bg-surface2"><Download size={13} /> Markdown (.md)</button>
          <button onClick={() => { onExport("html"); setOpen(false); }} className="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-[13px] hover:bg-surface2"><Download size={13} /> HTML (.html)</button>
          <button onClick={() => { onCopy(); setOpen(false); }} className="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-[13px] hover:bg-surface2"><Copy size={13} /> Copy markdown</button>
        </div>
      )}
    </div>
  );
}
