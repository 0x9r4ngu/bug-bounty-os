export const AXIS = "#8a8168";
export const GRID = "rgba(70,58,34,0.08)";
// warm light palette: raspberry + sage + warm earth tones
export const PALETTE = ["#cc3a63", "#7c8850", "#c96b2e", "#b99a3e", "#a2ab73", "#b0743a", "#d98aa2", "#8a8168", "#6f7a45", "#c0a24e"];

export const baseGrid = { left: 44, right: 18, top: 24, bottom: 30, containLabel: true };

export const tooltip = {
  backgroundColor: "#fff7eb",
  borderColor: "rgba(70,58,34,0.22)",
  borderWidth: 1,
  textStyle: { color: "#2c2519", fontSize: 12, fontFamily: "JetBrains Mono, monospace" },
  padding: [8, 12],
};

export function axisStyle() {
  return {
    axisLine: { lineStyle: { color: "rgba(70,58,34,0.2)" } },
    axisLabel: { color: AXIS, fontSize: 11, fontFamily: "JetBrains Mono, monospace" },
    splitLine: { lineStyle: { color: GRID } },
  };
}

export const SEV_COLOR: Record<string, string> = {
  Critical: "#cc3a63", High: "#c96b2e", Medium: "#b99a3e", Low: "#7c8850", Informational: "#8a8168",
};
