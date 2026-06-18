import { useHud, type AgentView } from "./store";

const panel: React.CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  width: 270,
  padding: "12px 16px",
  background: "rgba(5, 16, 12, 0.82)",
  border: "1px solid #1f5f3f",
  borderRadius: 8,
  color: "#7dffb0",
  fontSize: 12.5,
  lineHeight: 1.6,
  letterSpacing: 0.3,
  pointerEvents: "auto",
  userSelect: "none",
};

function Bar({ label, v, max = 100, color = "#4caf6a" }: { label: string; v: number; max?: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "1px 0" }}>
      <span style={{ width: 66, opacity: 0.8, fontSize: 11 }}>{label}</span>
      <div style={{ flex: 1, height: 7, background: "#0c1f16", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

export function AgentInspector(): React.JSX.Element | null {
  const { selected, select } = useHud();
  if (!selected) return null;
  const a: AgentView = selected;
  const moodColor = a.emotion.humor >= 0 ? "#6ee7b7" : "#fca5a5";

  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <strong style={{ fontSize: 14 }}>☻ {a.name}</strong>
        <span onClick={() => select(null)} style={{ cursor: "pointer", opacity: 0.6 }}>✕</span>
      </div>
      <div style={{ opacity: 0.75, marginBottom: 6, fontSize: 11 }}>
        {a.job} · 💰 {a.money.toFixed(0)} · idade {Math.floor(a.age / 100)} · {a.action ?? a.fsm}
      </div>
      <div style={{ opacity: 0.65, marginBottom: 4, fontSize: 11 }}>
        trabalho: {a.workplace ?? "sem vínculo"}
      </div>
      <div style={{ opacity: 0.65, marginBottom: 4, fontSize: 11 }}>
        casa: {a.home ?? "sem moradia"} · família {a.householdSize}
      </div>
      <div style={{ opacity: 0.65, marginBottom: 6, fontSize: 11 }}>
        deslocamento: {a.travelMode === "TRANSITO" ? "transporte" : "a pé"} · {a.transitPhase} · viagens {a.transitRides}
        {a.transitVehicleId ? ` · veic. ${a.transitVehicleId}` : ""}
        {a.transitPhase === "WAITING" ? ` · espera ${a.transitWaitTicks}` : ""}
      </div>

      <div style={{ opacity: 0.6, fontSize: 10, marginBottom: 2 }}>NECESSIDADES</div>
      <Bar label="energia" v={a.needs.energia} color="#3a9ea5" />
      <Bar label="fome" v={a.needs.fome} color="#c77d3a" />
      <Bar label="social" v={a.needs.social} color="#4caf6a" />
      <Bar label="diversão" v={a.needs.diversao} color="#9b59b6" />

      <div style={{ opacity: 0.6, fontSize: 10, margin: "6px 0 2px" }}>PERSONALIDADE</div>
      <Bar label="extrov." v={a.personality.extroversao} max={1} color="#93c5fd" />
      <Bar label="diligên." v={a.personality.diligencia} max={1} color="#fcd34d" />
      <Bar label="neurot." v={a.personality.neuroticismo} max={1} color="#fca5a5" />
      <Bar label="ambição" v={a.personality.ambicao} max={1} color="#c4b5fd" />

      <div style={{ opacity: 0.6, fontSize: 10, margin: "6px 0 2px" }}>ESTADO</div>
      <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
        <span style={{ color: moodColor }}>humor {a.emotion.humor.toFixed(2)}</span>
        <span style={{ color: "#fca5a5" }}>stress {a.emotion.stress.toFixed(2)}</span>
      </div>
      <div style={{ fontSize: 11, marginTop: 2 }}>
        🧠 recompensa total: {a.totalReward.toFixed(2)}
      </div>

      {a.topRelations.length > 0 && (
        <>
          <div style={{ opacity: 0.6, fontSize: 10, margin: "6px 0 2px" }}>RELAÇÕES</div>
          {a.topRelations.map((r) => (
            <div key={r.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span>{r.afinidade >= 0.15 ? "🤝" : r.afinidade <= -0.15 ? "⚔" : "•"} {r.name}</span>
              <span style={{ color: r.afinidade >= 0 ? "#6ee7b7" : "#fca5a5" }}>
                {r.afinidade.toFixed(2)}
              </span>
            </div>
          ))}
        </>
      )}
      <div style={{ opacity: 0.4, fontSize: 10, marginTop: 6 }}>clique em outro agente p/ inspecionar</div>
    </div>
  );
}
