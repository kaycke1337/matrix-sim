import { create } from "zustand";

/** Estado leve do HUD, atualizado a cada frame pelo loop. */
interface HudState {
  tick: number;
  dayPhase: number; // 0..1
  agentCount: number;
  fps: number;
  set: (s: Partial<HudState>) => void;
}

export const useHud = create<HudState>((set) => ({
  tick: 0,
  dayPhase: 0,
  agentCount: 0,
  fps: 0,
  set: (s) => set(s),
}));
