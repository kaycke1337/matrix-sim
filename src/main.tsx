import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SceneManager } from "./render/scene";
import { Engine } from "./engine/engine";
import { Hud } from "./ui/Hud";
import { useHud } from "./ui/store";
import { dayPhase } from "./sim/world";

// --- Canvas 3D ---
const canvas = document.createElement("canvas");
canvas.style.position = "fixed";
canvas.style.inset = "0";
document.getElementById("root")!.appendChild(canvas);

const sceneMgr = new SceneManager(canvas);

// --- FPS counter ---
let frames = 0;
let fpsLast = performance.now();

const engine = new Engine((world, alpha) => {
  sceneMgr.render(world, alpha);

  // atualiza HUD ~4x/seg
  frames++;
  const now = performance.now();
  if (now - fpsLast >= 250) {
    const fps = Math.round((frames * 1000) / (now - fpsLast));
    frames = 0;
    fpsLast = now;
    useHud.getState().set({
      tick: world.clock.tick,
      dayPhase: dayPhase(world.clock),
      agentCount: world.agents.length,
      fps,
    });
  }
});

engine.start();

// expõe no console para depuração / fases futuras
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
  </StrictMode>
);
