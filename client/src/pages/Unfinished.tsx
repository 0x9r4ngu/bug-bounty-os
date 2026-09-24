import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Network, Bug, FileText, Clock, Lock, ArrowRight } from "lucide-react";
import { get } from "../lib/api";
import { Card, SectionTitle, SeverityBadge, StatusBadge, Empty, timeAgo } from "../lib/ui";

export default function Unfinished() {
  const { data } = useQuery({ queryKey: ["unfinished"], queryFn: () => get("/unfinished") });
  if (!data) return <div className="p-6 text-faint">Loading…</div>;

  const total = data.untested_endpoints.length + data.potential_findings.length + data.unfinished_reports.length + data.awaiting_response.length + data.pending_invitations.length;

  return (
    <div className="anim-in space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Unfinished Business</h1>
        <p className="text-[13px] text-faint">{total} open items across your research — every row links to its source.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Group icon={Network} title="Untested Endpoints" count={data.untested_endpoints.length}>
          {data.untested_endpoints.map((e: any) => (
            <Row key={e.id} to={`/programs/${e.program_id}`}>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-primary">{e.method}</span>
              <span className="font-mono text-[12px]">{e.path}</span>
              <span className="ml-auto text-[11px] text-faint">{e.program_name}</span>
            </Row>
          ))}
        </Group>

        <Group icon={Bug} title="Potential Findings" count={data.potential_findings.length}>
          {data.potential_findings.map((f: any) => (
            <Row key={f.id} to="/findings?status=Potential">
              <SeverityBadge s={f.severity} />
              <span className="truncate text-[13px]">{f.title}</span>
              <span className="ml-auto text-[11px] text-faint">{f.program_name}</span>
            </Row>
          ))}
        </Group>

        <Group icon={FileText} title="Unfinished Reports" count={data.unfinished_reports.length}>
          {data.unfinished_reports.map((r: any) => (
            <Row key={r.id} to={`/reports/${r.id}`}>
              <StatusBadge s={r.status} />
              <span className="truncate text-[13px]">{r.title}</span>
              <span className="ml-auto text-[11px] text-faint">{r.word_count}w</span>
            </Row>
          ))}
        </Group>

        <Group icon={Clock} title="Awaiting Program Response" count={data.awaiting_response.length}>
          {data.awaiting_response.map((r: any) => (
            <Row key={r.id} to={`/reports/${r.id}`}>
              <span className="truncate text-[13px]">{r.title}</span>
              <span className="ml-auto text-[11px] text-faint">submitted {r.submitted_at ? timeAgo(r.submitted_at) : "—"}</span>
            </Row>
          ))}
        </Group>

        <Group icon={Lock} title="Pending Private Invitations" count={data.pending_invitations.length}>
          {data.pending_invitations.map((p: any) => (
            <Row key={p.id} to={`/programs/${p.id}`}>
              <Lock size={12} className="text-warn" />
              <span className="text-[13px]">{p.name}</span>
              <span className="ml-auto text-[11px] text-faint">{p.invitation_status}</span>
            </Row>
          ))}
        </Group>
      </div>
    </div>
  );
}

function Group({ icon: Icon, title, count, children }: any) {
  const arr = Array.isArray(children) ? children : [children];
  const has = arr.some(Boolean) && (children?.length ?? 0) !== 0;
  return (
    <Card className="p-4">
      <SectionTitle right={<span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">{count}</span>}>
        <span className="flex items-center gap-1.5"><Icon size={13} /> {title}</span>
      </SectionTitle>
      <div className="space-y-1">{count ? children : <Empty>Nothing pending.</Empty>}</div>
    </Card>
  );
}
function Row({ to, children }: any) {
  return (
    <Link to={to} className="group flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 transition-colors hover:border-primary/40 hover:bg-surface2">
      {children}
      <ArrowRight size={13} className="text-faint opacity-0 transition group-hover:opacity-100" />
    </Link>
  );
}
