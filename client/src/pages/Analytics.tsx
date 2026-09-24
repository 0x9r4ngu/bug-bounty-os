import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import ReactECharts from "echarts-for-react";
import { get } from "../lib/api";
import { Card, SectionTitle, Select, money, Empty } from "../lib/ui";
import { baseGrid, tooltip, axisStyle, SEV_COLOR, PALETTE } from "../lib/chart";
import { ENDPOINT_STATUS_COLOR } from "../lib/constants";

export default function Analytics() {
  const [programId, setProgramId] = useState("");
  const { data: programs } = useQuery({ queryKey: ["programs-min"], queryFn: () => get("/programs") });
  const qs = programId ? `?program_id=${programId}` : "";
  const { data: a } = useQuery({ queryKey: ["analytics", programId], queryFn: () => get(`/analytics${qs}`) });

  if (!a) return <div className="p-6 text-faint">Loading…</div>;

  const bountyTime = {
    tooltip: { ...tooltip, trigger: "axis", formatter: (p: any) => `${p[0].name}<br/>Bounty: ${money(p[0].value)}` },
    grid: baseGrid,
    xAxis: { type: "category", data: a.bountyOverTime.map((r: any) => r.month), ...axisStyle() },
    yAxis: { type: "value", ...axisStyle(), axisLabel: { color: "#94a3b8", fontSize: 11, formatter: money } },
    series: [{ type: "line", smooth: true, symbolSize: 7, data: a.bountyOverTime.map((r: any) => r.bounty), lineStyle: { width: 2.5, color: "#7c8850" }, itemStyle: { color: "#7c8850" }, areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(124,136,80,0.3)" }, { offset: 1, color: "rgba(124,136,80,0.01)" }] } } }],
  };

  // reports over time — pivot by status
  const months = [...new Set(a.reportsOverTime.map((r: any) => r.month))].sort();
  const statuses = [...new Set(a.reportsOverTime.map((r: any) => r.status))];
  const reportsTime = {
    tooltip: { ...tooltip, trigger: "axis" },
    legend: { textStyle: { color: "#94a3b8", fontSize: 11 }, top: 0, icon: "roundRect" },
    grid: { ...baseGrid, top: 34 },
    xAxis: { type: "category", data: months, ...axisStyle() },
    yAxis: { type: "value", ...axisStyle() },
    series: statuses.map((s: any, i) => ({ name: s, type: "line", smooth: true, data: months.map((m) => a.reportsOverTime.find((r: any) => r.month === m && r.status === s)?.c ?? 0), itemStyle: { color: PALETTE[i % PALETTE.length] } })),
  };

  const sevDonut = {
    tooltip: { ...tooltip, trigger: "item" },
    legend: { textStyle: { color: "#94a3b8", fontSize: 11 }, bottom: 0 },
    series: [{ type: "pie", radius: ["45%", "72%"], center: ["50%", "44%"], label: { show: false }, data: a.bySeverity.map((s: any) => ({ name: s.name, value: s.value, itemStyle: { color: SEV_COLOR[s.name] ?? "#8a8168" } })) }],
  };

  const classBar = {
    tooltip: { ...tooltip, trigger: "axis" },
    grid: { ...baseGrid, left: 90 },
    xAxis: { type: "value", ...axisStyle() },
    yAxis: { type: "category", data: a.byClass.map((c: any) => c.name).reverse(), ...axisStyle() },
    series: [{ type: "bar", data: a.byClass.map((c: any) => c.value).reverse(), itemStyle: { color: "#b99a3e", borderRadius: [0, 4, 4, 0] }, barWidth: "60%" }],
  };

  const funnel = {
    tooltip: { ...tooltip, trigger: "item" },
    series: [{ type: "funnel", left: "5%", right: "5%", top: 10, bottom: 10, minSize: "20%", label: { color: "#e6edf6", fontSize: 12, formatter: "{b}: {c}" }, data: a.funnel.map((f: any, i: number) => ({ name: f.name, value: f.value, itemStyle: { color: PALETTE[i % PALETTE.length] } })) }],
  };

  const radar = {
    tooltip: { ...tooltip },
    radar: { indicator: a.coverage.map((c: any) => ({ name: c.area, max: 100 })), axisName: { color: "#94a3b8", fontSize: 10 }, splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } }, splitArea: { areaStyle: { color: ["rgba(185,154,62,0.03)", "rgba(185,154,62,0.06)"] } } },
    series: [{ type: "radar", data: [{ value: a.coverage.map((c: any) => c.pct), name: "Coverage %", areaStyle: { color: "rgba(185,154,62,0.25)" }, lineStyle: { color: "#b99a3e" }, itemStyle: { color: "#b99a3e" } }] }],
  };

  const assetPie = {
    tooltip: { ...tooltip, trigger: "item" },
    legend: { textStyle: { color: "#94a3b8", fontSize: 10 }, bottom: 0, type: "scroll" },
    series: [{ type: "pie", radius: "68%", center: ["50%", "44%"], label: { show: false }, data: a.assetTypes.map((t: any, i: number) => ({ name: t.name, value: t.value, itemStyle: { color: PALETTE[i % PALETTE.length] } })) }],
  };

  const techBar = {
    tooltip: { ...tooltip, trigger: "axis" },
    grid: { ...baseGrid, left: 80 },
    xAxis: { type: "value", ...axisStyle() },
    yAxis: { type: "category", data: a.techDist.slice(0, 10).map((t: any) => t.name).reverse(), ...axisStyle() },
    series: [{ type: "bar", data: a.techDist.slice(0, 10).map((t: any) => t.value).reverse(), itemStyle: { color: "#b0743a", borderRadius: [0, 4, 4, 0] }, barWidth: "60%" }],
  };

  const hoursBar = {
    tooltip: { ...tooltip, trigger: "axis", formatter: (p: any) => `${p[0].name}<br/>${(p[0].value / 60).toFixed(1)}h` },
    grid: baseGrid,
    xAxis: { type: "category", data: a.hoursPerDay.map((h: any) => h.day.slice(5)), ...axisStyle(), axisLabel: { color: "#94a3b8", fontSize: 9, interval: 2 } },
    yAxis: { type: "value", ...axisStyle(), axisLabel: { color: "#94a3b8", fontSize: 11, formatter: (v: number) => `${Math.round(v / 60)}h` } },
    series: [{ type: "bar", data: a.hoursPerDay.map((h: any) => h.minutes), itemStyle: { color: "#7c8850", borderRadius: [3, 3, 0, 0] } }],
  };

  const heatmap = {
    tooltip: { ...tooltip, position: "top", formatter: (p: any) => `${a.heatmap.programs[p.value[1]]}<br/>${a.heatmap.classes[p.value[0]]}: ${p.value[2]}` },
    grid: { left: 100, right: 20, top: 10, bottom: 60 },
    xAxis: { type: "category", data: a.heatmap.classes, ...axisStyle(), axisLabel: { color: "#94a3b8", fontSize: 10, rotate: 30 }, splitArea: { show: true } },
    yAxis: { type: "category", data: a.heatmap.programs, ...axisStyle(), axisLabel: { color: "#94a3b8", fontSize: 10 }, splitArea: { show: true } },
    visualMap: { min: 0, max: Math.max(2, ...a.heatmap.data.map((d: any) => d[2])), calculable: true, orient: "horizontal", left: "center", bottom: 5, textStyle: { color: "#94a3b8" }, inRange: { color: ["#0f172a", "#1e3a5f", "#b99a3e", "#7c8850"] } },
    series: [{ type: "heatmap", data: a.heatmap.data, label: { show: true, color: "#e6edf6", fontSize: 10 }, itemStyle: { borderColor: "rgba(255,255,255,0.04)", borderWidth: 1 } }],
  };

  const testCase = {
    tooltip: { ...tooltip, trigger: "item" },
    legend: { textStyle: { color: "#94a3b8", fontSize: 10 }, bottom: 0, type: "scroll" },
    series: [{ type: "pie", radius: ["40%", "70%"], center: ["50%", "44%"], label: { show: false }, data: (a.endpointStatus ?? []).map((t: any, i: number) => ({ name: t.name, value: t.value, itemStyle: { color: ENDPOINT_STATUS_COLOR[t.name] ?? PALETTE[i % PALETTE.length] } })) }],
  };

  return (
    <div className="anim-in space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold">Analytics</h1><p className="text-[13px] text-faint">Descriptive analytics — no rankings, just your data.</p></div>
        <div className="w-56"><Select value={programId} onChange={(e) => setProgramId(e.target.value)}><option value="">All programs</option>{programs?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Chart title="Bounty Over Time" empty={!a.bountyOverTime.length} option={bountyTime} />
        <Chart title="Reports Over Time" empty={!a.reportsOverTime.length} option={reportsTime} />
        <Chart title="Findings by Severity" empty={!a.bySeverity.length} option={sevDonut} />
        <Chart title="Vulnerability Class Distribution" empty={!a.byClass.length} option={classBar} />
        <Chart title="Finding Status Funnel" empty={!a.funnel.some((f: any) => f.value)} option={funnel} />
        <Chart title="Methodology Coverage" empty={false} option={radar} />
        <Chart title="Asset Type Distribution" empty={!a.assetTypes.length} option={assetPie} />
        <Chart title="Technology Distribution" empty={!a.techDist.length} option={techBar} />
        <Chart title="Test Case Completion" empty={!a.endpointStatus?.length} option={testCase} />
        <Chart title="Research Hours per Day" empty={!a.hoursPerDay.length} option={hoursBar} height={220} />
        <Chart title="Vulnerability Heatmap (findings)" empty={!a.heatmap.data.some((d: any) => d[2])} option={heatmap} height={Math.max(220, a.heatmap.programs.length * 44 + 80)} />
      </div>

      {/* bounty by type / program tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>Bounty by Vulnerability Type</SectionTitle>
          <TableMini rows={a.bountyByClass} cols={[["name", "Type"], ["reports", "Reports", true], ["total", "Total", true, money], ["avg", "Avg", true, (v: number) => money(Math.round(v))]]} />
        </Card>
        <Card className="p-4">
          <SectionTitle>Bounty by Program</SectionTitle>
          <TableMini rows={a.bountyByProgram} cols={[["name", "Program"], ["findings", "Findings", true], ["total", "Total", true, money]]} />
        </Card>
      </div>
    </div>
  );
}

function Chart({ title, option, empty, height = 260 }: any) {
  return (
    <Card className="p-4">
      <SectionTitle>{title}</SectionTitle>
      {empty ? <Empty>No data for this selection yet.</Empty> : <ReactECharts option={option} style={{ height }} notMerge />}
    </Card>
  );
}

function TableMini({ rows, cols }: { rows: any[]; cols: any[] }) {
  if (!rows?.length) return <Empty>No data.</Empty>;
  return (
    <table className="w-full text-[13px]">
      <thead><tr className="text-left text-[11px] uppercase tracking-wide text-faint">{cols.map((c: any) => <th key={c[0]} className={`pb-2 font-medium ${c[2] ? "text-right" : ""}`}>{c[1]}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-border">
            {cols.map((c: any) => (
              <td key={c[0]} className={`py-2 ${c[2] ? "text-right tabular-nums" : "font-medium"}`}>{c[3] ? c[3](r[c[0]] ?? 0) : (r[c[0]] ?? "—")}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
