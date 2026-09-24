import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, BookOpen, X, Pencil, Trash2 } from "lucide-react";
import { get, post, patch, del } from "../lib/api";
import { Card, Button, Input, Textarea, Empty } from "../lib/ui";
import { confirmDialog } from "../lib/confirm";

export default function Journal() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null); // null = closed, {} = new, {..} = edit
  const { data: entries } = useQuery({ queryKey: ["journal"], queryFn: () => get("/journal") });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["journal"] }); setEditing(null); };
  const remove = async (e: any) => { if (!(await confirmDialog(`Delete journal entry for ${e.date}?`))) return; await del(`/journal_entries/${e.id}`); qc.invalidateQueries({ queryKey: ["journal"] }); };

  return (
    <div className="anim-in space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold">Research Journal</h1><p className="text-[13px] text-faint">Daily log of what you tested, found, and what's next.</p></div>
        <Button variant="primary" onClick={() => setEditing({})}><Plus size={14} /> New Entry</Button>
      </div>

      <div className="space-y-3">
        {entries?.length ? entries.map((e: any) => (
          <Card key={e.id} className="group p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><BookOpen size={15} className="text-primary" /><span className="font-semibold">{new Date(e.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span></div>
              <div className="flex items-center gap-3 text-[12px] text-faint">
                <span>{e.programs_worked}</span><span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">{e.hours}h</span>
                <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => setEditing(e)} title="Edit" className="cursor-pointer hover:text-fg"><Pencil size={14} /></button>
                  <button onClick={() => remove(e)} title="Delete" className="cursor-pointer hover:text-danger"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <JField label="What I tested" v={e.tested} />
              <JField label="What I found" v={e.found} />
              <JField label="Interesting" v={e.interesting} />
              <JField label="Tomorrow" v={e.tomorrow} />
            </div>
          </Card>
        )) : <Empty>No journal entries yet.</Empty>}
      </div>

      {editing && <EntryModal initial={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
}
const JField = ({ label, v }: any) => v ? <div><div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-faint">{label}</div><div className="whitespace-pre-wrap text-[13px] text-subtle">{v}</div></div> : null;

function EntryModal({ onClose, onSaved, initial }: any) {
  const [f, setF] = useState<any>(initial ?? { date: new Date().toISOString().slice(0, 10), programs_worked: "", hours: 2, tested: "", found: "", interesting: "", tomorrow: "" });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const save = () => {
    const body = { date: f.date, programs_worked: f.programs_worked, hours: f.hours, tested: f.tested, found: f.found, interesting: f.interesting, tomorrow: f.tomorrow };
    (initial?.id ? patch(`/journal_entries/${initial.id}`, body) : post("/journal_entries", body)).then(onSaved);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-6 pt-[8vh]" onClick={onClose}>
      <Card className="w-[560px] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{initial?.id ? "Edit Journal Entry" : "New Journal Entry"}</h2><button onClick={onClose} className="cursor-pointer text-faint hover:text-fg"><X size={18} /></button></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="mb-1 block text-[11px] text-faint">Date</label><Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></div>
          <div><label className="mb-1 block text-[11px] text-faint">Hours</label><Input type="number" step="0.5" value={f.hours} onChange={(e) => set("hours", parseFloat(e.target.value))} /></div>
          <div className="col-span-2"><label className="mb-1 block text-[11px] text-faint">Programs worked on</label><Input value={f.programs_worked} onChange={(e) => set("programs_worked", e.target.value)} /></div>
          <div className="col-span-2"><label className="mb-1 block text-[11px] text-faint">What I tested</label><Textarea rows={2} value={f.tested} onChange={(e) => set("tested", e.target.value)} /></div>
          <div><label className="mb-1 block text-[11px] text-faint">What I found</label><Textarea rows={2} value={f.found} onChange={(e) => set("found", e.target.value)} /></div>
          <div><label className="mb-1 block text-[11px] text-faint">Tomorrow</label><Textarea rows={2} value={f.tomorrow} onChange={(e) => set("tomorrow", e.target.value)} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{initial?.id ? "Save Changes" : "Save Entry"}</Button></div>
      </Card>
    </div>
  );
}
