import { useHud } from "./store";

/** Formata a fase do dia (0..1) como relógio HH:MM. */
function phaseToClock(p: number): string {
  const totalMin = Math.floor(p * 24 * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const panel: React.CSSProperties = {
  position: "absolute",
  top: 16,
  left: 16,
  padding: "12px 16px",
  background: "rgba(5, 16, 12, 0.72)",
  border: "1px solid #1f5f3f",
  borderRadius: 8,
  color: "#7dffb0",
  fontSize: 13,
  lineHeight: 1.7,
  letterSpacing: 0.5,
  textShadow: "0 0 6px rgba(80,255,160,0.4)",
  pointerEvents: "none",
  userSelect: "none",
};

export function Hud(): React.JSX.Element {
  const { tick, dayPhase, agentCount, fps } = useHud();
  const night = dayPhase < 0.25 || dayPhase > 0.8;
  return (
    <div style={panel}>
      <div style={{ fontWeight: "bold", fontSize: 15, marginBottom: 4 }}>
        ▣ MATRIX-SIM <span style={{ opacity: 0.5 }}>v0.1</span>
      </div>
      <div>⏱ {phaseToClock(dayPhase)} {night ? "🌙 noite" : "☀ dia"}</div>
      <div>◷ tick {tick.toLocaleString("pt-BR")}</div>
      <div>☻ agentes: {agentCount}</div>
      <div style={{ opacity: 0.6 }}>▸ {fps} fps</div>
    </div>
  );
}
