import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import {
  Shield, Lock, Eye, Radar, Boxes, Network, Bug, CheckCircle2, FileText,
  Send, Award, DollarSign, Clock, ArrowRight, Activity,
} from "lucide-react";
import { get } from "../lib/api";
import { Card, SectionTitle, SeverityBadge, money, timeAgo, Empty } from "../lib/ui";
import { baseGrid, tooltip, axisStyle, SEV_COLOR, PALETTE } from "../lib/chart";

const KPI_META: Record<string, { label: string; icon: any; to: string; fmt?: (v: any) => string; accent?: string }> = {
  active_programs: { label: "Active Programs", icon: Shield, to: "/programs" },
  private_programs: { label: "Private Programs", icon: Lock, to: "/programs?private=1", accent: "#7c8850" },
  programs_watched: { label: "Watched", icon: Eye, to: "/programs?watched=1" },
  active_sessions: { label: "Active Sessions", icon: Radar, to: "/journal", accent: "#7c8850" },
  assets: { label: "Assets", icon: Boxes, to: "/programs" },
  endpoints: { label: "Endpoints", icon: Network, to: "/findings" },
  untested_endpoints: { label: "Untested", icon: Network, to: "/unfinished", accent: "#7c8850" },
  potential_findings: { label: "Potential", icon: Bug, to: "/findings?status=Potential", accent: "#7c8850" },
  confirmed_findings: { label: "Confirmed Findings", icon: CheckCircle2, to: "/findings", accent: "#7c8850" },
  reports_drafted: { label: "Reports Drafted", icon: FileText, to: "/reports?folder=Drafts" },
  reports_submitted: { label: "Submitted", icon: Send, to: "/reports?status=Submitted" },
  reports_accepted: { label: "Accepted", icon: Award, to: "/reports", accent: "#7c8850" },
  total_bounty: { label: "Total Bounty", icon: DollarSign, to: "/analytics", fmt: money, accent: "#7c8850" },
  research_hours: { label: "Research Hours", icon: Clock, to: "/analytics", fmt: (v) => `${v}h` },
};

export default function Dashboard() {
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => get("/dashboard") });
  const { data: next } = useQuery({ queryKey: ["next"], queryFn: () => get("/next-actions") });
  const { data: analytics } = useQuery({ queryKey: ["analytics-dash"], queryFn: () => get("/analytics") });

  if (!data) return <div className="p-6 text-faint">Loading…</div>;
  const k = data.kpis;

  const bountyTrend = {
    tooltip: { ...tooltip, trigger: "axis" },
    grid: baseGrid,
    xAxis: { type: "category", data: analytics?.bountyOverTime?.map((r: any) => r.month) ?? [], ...axisStyle() },
    yAxis: { type: "value", ...axisStyle(), axisLabel: { color: "#94a3b8", fontSize: 11, formatter: (v: number) => money(v) } },
    series: [{
      type: "line", smooth: true, symbol: "circle", symbolSize: 7,
      data: analytics?.bountyOverTime?.map((r: any) => r.bounty) ?? [],
      lineStyle: { width: 2.5, color: "#7c8850" }, itemStyle: { color: "#7c8850" },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(124,136,80,0.35)" }, { offset: 1, color: "rgba(124,136,80,0.02)" }] } },
    }],
  };

  const sevDonut = {
    tooltip: { ...tooltip, trigger: "item" },
    series: [{
      type: "pie", radius: ["55%", "78%"], center: ["50%", "50%"], avoidLabelOverlap: false,
      label: { show: false }, labelLine: { show: false },
      data: (analytics?.bySeverity ?? []).map((s: any) => ({ name: s.name, value: s.value, itemStyle: { color: SEV_COLOR[s.name] ?? "#8a8168" } })),
    }],
  };

  return (
    <div className="anim-in space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Research Command Center</h1>
        <p className="text-[13px] text-faint">Your persistent source of truth — everything stays connected.</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {Object.entries(KPI_META).map(([key, meta]) => {
          const val = k[key] ?? 0;
          return (
            <Link key={key} to={meta.to}>
              <Card className="group cursor-pointer p-3 transition-colors hover:border-border-strong">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-faint">{meta.label}</span>
                  <meta.icon size={14} style={{ color: meta.accent ?? "#8a8168" }} />
                </div>
                <div className="mt-1.5 text-[22px] font-semibold tabular-nums" style={{ color: meta.accent }}>
                  {meta.fmt ? meta.fmt(val) : val}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: active research + charts */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-4">
            <SectionTitle right={<Link to="/journal" className="text-[11px] text-primary hover:underline">All sessions</Link>}>Active Research</SectionTitle>
            {data.active_research?.length ? (
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="pb-2 font-medium">Program</th><th className="pb-2 font-medium">Phase</th>
                  <th className="pb-2 font-medium">Coverage</th><th className="pb-2 font-medium text-right">Time</th>
                </tr></thead>
                <tbody>
                  {data.active_research.map((s: any) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="py-2 font-medium">{s.program_name ?? "—"}</td>
                      <td className="py-2 text-subtle">{s.phase}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${s.coverage}%` }} />
                          </div>
                          <span className="text-[11px] text-faint">{s.coverage}%</span>
                        </div>
                      </td>
                      <td className="py-2 text-right tabular-nums text-subtle">{Math.floor(s.minutes / 60)}h{s.minutes % 60}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty>No active sessions.</Empty>}
          </Card>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card className="p-4">
              <SectionTitle right={<Link to="/analytics" className="text-[11px] text-primary hover:underline">Analytics</Link>}>Bounty Trend</SectionTitle>
              {analytics?.bountyOverTime?.length ? <ReactECharts option={bountyTrend} style={{ height: 200 }} /> : <Empty>No bounty data yet.</Empty>}
            </Card>
            <Card className="p-4">
              <SectionTitle>Findings by Severity</SectionTitle>
              {analytics?.bySeverity?.length ? (
                <div className="flex items-center gap-4">
                  <ReactECharts option={sevDonut} style={{ height: 200, width: 200 }} />
                  <div className="space-y-1.5">
                    {analytics.bySeverity.map((s: any) => (
                      <div key={s.name} className="flex items-center gap-2 text-[12px]">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SEV_COLOR[s.name] ?? "#8a8168" }} />
                        <span className="text-subtle">{s.name}</span>
                        <span className="ml-auto font-medium tabular-nums">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <Empty>No findings yet.</Empty>}
            </Card>
          </div>

          <Card className="p-4">
            <SectionTitle>Testing Coverage</SectionTitle>
            <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
              {(analytics?.coverage ?? []).map((c: any) => (
                <div key={c.area} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-[12px] text-subtle">{c.area}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: c.pct >= 80 ? "#7c8850" : c.pct >= 50 ? "#b99a3e" : "#7c8850" }} />
                  </div>
                  <span className="w-9 text-right text-[11px] tabular-nums text-faint">{c.pct}%</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right: next actions + activity */}
        <div className="space-y-6">
          <Card className="p-4">
            <SectionTitle>What should I do next?</SectionTitle>
            <div className="space-y-1.5">
              {next?.length ? next.map((n: any, i: number) => (
                <Link key={i} to={n.to} className="group flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-[13px] transition-colors hover:border-primary/40 hover:bg-surface2">
                  <span className="flex h-5 min-w-5 items-center justify-center rounded bg-primary/15 px-1 text-[11px] font-semibold text-primary">{n.count}</span>
                  <span className="text-subtle group-hover:text-fg">{n.label.replace(/^\d+\s/, "")}</span>
                  <ArrowRight size={13} className="ml-auto text-faint opacity-0 transition group-hover:opacity-100" />
                </Link>
              )) : <Empty>All caught up.</Empty>}
            </div>
          </Card>

          <Card className="p-4">
            <SectionTitle right={<Activity size={13} className="text-faint" />}>Activity Feed</SectionTitle>
            <div className="space-y-2.5">
              {data.recent_activity?.map((a: any) => (
                <div key={a.id} className="flex items-start gap-2.5 text-[12px]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-subtle">{a.title}</div>
                    <div className="text-[10px] text-faint">{timeAgo(a.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
