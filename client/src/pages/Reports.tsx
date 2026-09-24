import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { Plus, Star, Copy, FileText, Search, Folder, Trash2 } from "lucide-react";
import { get, post, del } from "../lib/api";
import { Card, Button, Input, Select, StatusBadge, Empty, timeAgo } from "../lib/ui";
import { confirmDialog } from "../lib/confirm";

const FOLDERS = ["All", "Drafts", "Submitted", "Accepted", "Resolved", "Archived", "Favorites"];

export default function Reports() {
  const [sp, setSp] = useSearchParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const folder = sp.get("folder") ?? (sp.get("favorite") === "1" ? "Favorites" : "All");

  const qs = new URLSearchParams();
  if (folder !== "All" && folder !== "Favorites") qs.set("folder", folder);
  if (folder === "Favorites") qs.set("favorite", "1");
  if (sp.get("status")) qs.set("status", sp.get("status")!);
  if (search) qs.set("search", search);

  const { data: reports } = useQuery({ queryKey: ["reports", qs.toString()], queryFn: () => get(`/reports?${qs}`) });
  const { data: programs } = useQuery({ queryKey: ["programs-min"], queryFn: () => get("/programs") });

  const newReport = async () => {
    const { id } = await post("/reports", { title: "Untitled Report", markdown_content: "# Untitled Report\n\n## Summary\n\n", program_id: programs?.[0]?.id });
    nav(`/reports/${id}`);
  };
  const clone = async (id: string) => { const r = await post(`/reports/${id}/clone`); qc.invalidateQueries({ queryKey: ["reports"] }); nav(`/reports/${r.id}`); };
  const remove = async (id: string, title: string) => { if (!(await confirmDialog(`Delete report "${title}"? This cannot be undone.`))) return; await del(`/reports/${id}`); qc.invalidateQueries({ queryKey: ["reports"] }); };

  return (
    <div className="anim-in space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold">Reports</h1><p className="text-[13px] text-faint">{reports?.length ?? 0} reports · your personal library</p></div>
        <Button variant="primary" onClick={newReport}><Plus size={14} /> New Report</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {FOLDERS.map((fo) => (
            <button key={fo} onClick={() => setSp(fo === "All" ? {} : fo === "Favorites" ? { favorite: "1" } : { folder: fo })} className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${folder === fo ? "bg-primary/15 text-primary" : "text-subtle hover:bg-surface2"}`}>
              {fo === "Favorites" ? <Star size={12} /> : <Folder size={12} />}{fo}
            </button>
          ))}
        </div>
        <div className="ml-auto flex w-64 items-center gap-2 rounded-md border border-border bg-muted px-3">
          <Search size={14} className="text-faint" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search all reports…" className="w-full bg-transparent py-2 text-[13px] outline-none" />
        </div>
      </div>

      {reports?.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reports.map((r: any) => (
            <Card key={r.id} className="group flex flex-col p-4 transition-colors hover:border-border-strong">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/reports/${r.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {r.is_favorite ? <Star size={13} className="shrink-0 fill-warn text-warn" /> : null}
                    <span className="truncate font-medium hover:text-primary">{r.title}</span>
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-2 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => clone(r.id)} title="Clone" className="cursor-pointer text-faint hover:text-fg"><Copy size={14} /></button>
                  <button onClick={() => remove(r.id, r.title)} title="Delete" className="cursor-pointer text-faint hover:text-danger"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mt-1 text-[11px] text-faint">{r.program_name ?? "No program"}</div>
              <div className="mt-3 flex items-center gap-2">
                <StatusBadge s={r.status} />
                {r.severity ? <span className="text-[11px] text-subtle">{r.severity}</span> : null}
                <span className="ml-auto text-[11px] text-faint">v{r.version} · {r.word_count}w</span>
              </div>
              <div className="mt-2 text-[10px] text-faint">Updated {timeAgo(r.updated_at)}</div>
            </Card>
          ))}
        </div>
      ) : <Empty>No reports here yet. Create one to open the Markdown editor.</Empty>}
    </div>
  );
}
