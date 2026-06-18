import { useHud } from "./store";
import {
  SPEEDS,
  setSpeed,
  saveToFile,
  loadFromFile,
  quickSave,
  quickLoad,
  resetWorld,
  architectAddAgent,
  architectAddAgents,
  architectRemoveAgent,
  architectInjectEvent,
} from "../engine/controls";

const bar: React.CSSProperties = {
  position: "absolute",
  bottom: 16,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: 6,
  maxWidth: "calc(100vw - 32px)",
  padding: "8px 10px",
  background: "rgba(5, 16, 12, 0.82)",
  border: "1px solid #1f5f3f",
  borderRadius: 8,
  pointerEvents: "auto",
  userSelect: "none",
};

const btn = (active = false): React.CSSProperties => ({
  background: active ? "#1f7f4f" : "#0c1f16",
  color: active ? "#dfffe9" : "#7dffb0",
  border: "1px solid #1f5f3f",
  borderRadius: 6,
  padding: "5px 10px",
  fontSize: 12.5,
  cursor: "pointer",
  fontFamily: "monospace",
  minWidth: 34,
});

const sep: React.CSSProperties = { width: 1, background: "#1f5f3f", margin: "2px 4px" };

const glitchOverlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(180deg, rgba(125,255,176,0.10), transparent 28%, rgba(252,165,165,0.10) 54%, transparent)",
  boxShadow: "inset 0 0 70px rgba(125,255,176,0.20)",
  mixBlendMode: "screen",
  opacity: 0.85,
  pointerEvents: "none",
};

function speedLabel(s: number): string {
  return s === 0 ? "⏸" : `${s}×`;
}

export function ControlPanel(): React.JSX.Element {
  const speed = useHud((s) => s.speed);
  const toast = useHud((s) => s.toast);
  const glitchUntil = useHud((s) => s.glitchUntil);
  const glitch = glitchUntil > Date.now();
  return (
    <>
      {glitch && (
        <div style={glitchOverlay}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(0deg, transparent 0 5px, rgba(125,255,176,0.16) 6px)",
            }}
          />
        </div>
      )}
      <div style={bar}>
        {SPEEDS.map((s) => (
          <button key={s} style={btn(speed === s)} onClick={() => setSpeed(s)} title={s === 0 ? "Pausar (espaço)" : `${s}× velocidade`}>
            {speedLabel(s)}
          </button>
        ))}
        <div style={sep} />
        <button style={btn()} onClick={quickSave} title="Salvar rápido (S)">💾</button>
        <button style={btn()} onClick={quickLoad} title="Carregar rápido (L)">📂</button>
        <div style={sep} />
        <button style={btn()} onClick={saveToFile} title="Exportar arquivo">⬇ arq</button>
        <button style={btn()} onClick={loadFromFile} title="Importar arquivo">⬆ arq</button>
        <div style={sep} />
        <button style={btn()} onClick={resetWorld} title="Novo mundo">✨</button>
        <div style={sep} />
        <button style={btn()} onClick={architectAddAgent} title="Criar agente (A)">+ag</button>
        <button style={btn()} onClick={() => architectAddAgents(25)} title="Criar 25 agentes">+25</button>
        <button style={btn()} onClick={architectRemoveAgent} title="Remover selecionado, ou o mais novo (Del)">-ag</button>
        <button style={btn()} onClick={() => architectInjectEvent("BLECAUTE")} title="Injetar blecaute (B)">blk</button>
        <button style={btn()} onClick={() => architectInjectEvent("FESTA_PRACA")} title="Injetar festa na praça (P)">prç</button>
      </div>
      {toast && (
        <div
          style={{
            position: "absolute",
            bottom: 70,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "6px 14px",
            background: "rgba(5,16,12,0.92)",
            border: "1px solid #1f7f4f",
            borderRadius: 8,
            color: "#7dffb0",
            fontSize: 13,
            pointerEvents: "none",
            textShadow: "0 0 6px rgba(80,255,160,0.4)",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
