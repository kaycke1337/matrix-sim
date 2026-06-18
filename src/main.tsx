import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SceneManager } from "./render/scene";
import { Engine } from "./engine/engine";
import { Hud } from "./ui/Hud";
import { AgentInspector } from "./ui/AgentInspector";
import { ControlPanel } from "./ui/ControlPanel";
import { useHud } from "./ui/store";
import { toAgentView } from "./ui/selectors";
import { dayPhase } from "./sim/world";
import {
  bindEngine,
  startAutosave,
  cycleSpeed,
  togglePause,
  quickSave,
  quickLoad,
  architectAddAgent,
  architectAddAgents,
  architectRemoveAgent,
  architectInjectEvent,
} from "./engine/controls";
import { loadPersistent } from "./persistence/storage";

// --- Canvas 3D ---
const canvas = document.createElement("canvas");
canvas.style.position = "fixed";
canvas.style.inset = "0";
document.getElementById("root")!.appendChild(canvas);

const sceneMgr = new SceneManager(canvas);

// clique → seleciona agente no store
sceneMgr.onPick = (id) => useHud.getState().select(id);

// --- FPS counter ---
let frames = 0;
let fpsLast = performance.now();

const engine = new Engine((world, alpha) => {
  const sel = useHud.getState().selectedId;
  sceneMgr.setSelected(sel);
  sceneMgr.render(world, alpha);

  frames++;
  const now = performance.now();
  if (now - fpsLast >= 250) {
    const fps = Math.round((frames * 1000) / (now - fpsLast));
    frames = 0;
    fpsLast = now;

    const selAgent =
      sel != null ? world.agents.find((a) => a.id === sel) : undefined;

    useHud.getState().set({
      tick: world.clock.tick,
      dayPhase: dayPhase(world.clock),
      agentCount: world.agents.length,
      fps,
      mayorName: world.civics.mayorName,
      nextElectionIn: Math.max(0, world.civics.nextElectionTick - world.clock.tick),
      publicBudget: world.civics.budget,
      taxRate: world.civics.policy.taxRate,
      approval: world.civics.approval,
      campaignCount: world.civics.activeProposals.length,
      institutionCount: world.institutions.length,
      institutionCash: world.institutions.reduce(
        (sum, institution) => sum + institution.cash,
        0
      ),
      vehicleCount: world.vehicles.length,
      householdCount: world.households.length,
      chat: world.chat.slice(-4).map((message) => ({
        tick: message.tick,
        speakerName: message.speakerName,
        text: message.text,
      })),
      selected: selAgent ? toAgentView(world, selAgent) : null,
    });
  }
});

engine.start();

bindEngine(engine);

// retoma o último autosave automaticamente, se houver
void loadPersistent().then((resumed) => {
  if (resumed) engine.setWorld(resumed);
});

// autosave a cada 30s
startAutosave(30000);

// atalhos de teclado
addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  switch (e.code) {
    case "Space":
      e.preventDefault();
      togglePause();
      break;
    case "Equal":
    case "ArrowUp":
      cycleSpeed(1);
      break;
    case "Minus":
    case "ArrowDown":
      cycleSpeed(-1);
      break;
    case "KeyS":
      quickSave();
      break;
    case "KeyL":
      quickLoad();
      break;
    case "KeyA":
      if (e.shiftKey) architectAddAgents(25);
      else architectAddAgent();
      break;
    case "Delete":
    case "Backspace":
      architectRemoveAgent();
      break;
    case "KeyB":
      architectInjectEvent("BLECAUTE");
      break;
    case "KeyP":
      architectInjectEvent("FESTA_PRACA");
      break;
    case "Escape":
      useHud.getState().select(null);
      break;
  }
});

(window as unknown as { engine: Engine }).engine = engine;

// --- HUD React (overlay) ---
const hudRoot = document.createElement("div");
hudRoot.style.position = "fixed";
hudRoot.style.inset = "0";
hudRoot.style.pointerEvents = "none";
document.getElementById("root")!.appendChild(hudRoot);

createRoot(hudRoot).render(
  <StrictMode>
    <Hud />
    <AgentInspector />
    <ControlPanel />
  </StrictMode>
);
