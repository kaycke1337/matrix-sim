import type { Engine } from "../engine/engine";
import { useHud } from "../ui/store";
import {
  downloadWorld,
  uploadWorld,
  saveLocal,
  loadLocal,
  hasLocal,
} from "../persistence/storage";

/**
 * Ponte entre a UI React e o Engine (que vive fora do React).
 * A UI chama estas funções; elas operam no engine e atualizam o toast.
 */
let engine: Engine | null = null;
let autosaveTimer: ReturnType<typeof setInterval> | null = null;

export function bindEngine(e: Engine): void {
  engine = e;
}

function toast(msg: string): void {
  useHud.getState().set({ toast: msg });
  setTimeout(() => {
    if (useHud.getState().toast === msg) useHud.getState().set({ toast: null });
  }, 2200);
}

export const SPEEDS = [0, 1, 2, 4, 8] as const;

export function setSpeed(speed: number): void {
  if (!engine) return;
  engine.speed = speed;
  useHud.getState().set({ speed });
}

export function togglePause(): void {
  if (!engine) return;
  if (engine.speed === 0) setSpeed(1);
  else setSpeed(0);
}

export function cycleSpeed(dir: 1 | -1): void {
  if (!engine) return;
  const idx = SPEEDS.indexOf(engine.speed as (typeof SPEEDS)[number]);
  const next = Math.max(0, Math.min(SPEEDS.length - 1, (idx < 0 ? 1 : idx) + dir));
  setSpeed(SPEEDS[next]);
}

export function saveToFile(): void {
  if (!engine) return;
  downloadWorld(engine.world);
  toast("💾 mundo salvo em arquivo");
}

export async function loadFromFile(): Promise<void> {
  if (!engine) return;
  try {
    const w = await uploadWorld();
    engine.setWorld(w);
    useHud.getState().select(null);
    toast(`📂 mundo carregado (tick ${w.clock.tick})`);
  } catch (e) {
    toast("⚠ falha ao carregar: " + (e as Error).message);
  }
}

export function quickSave(): void {
  if (!engine) return;
  toast(saveLocal(engine.world) ? "💾 salvo (local)" : "⚠ falha ao salvar");
}

export function quickLoad(): void {
  if (!engine) return;
  const w = loadLocal();
  if (w) {
    engine.setWorld(w);
    useHud.getState().select(null);
    toast(`📂 autosave carregado (tick ${w.clock.tick})`);
  } else {
    toast("⚠ nenhum autosave");
  }
}

export function resetWorld(): void {
  if (!engine) return;
  const seed = Math.floor(Math.random() * 1e9);
  engine.reset(seed);
  useHud.getState().select(null);
  toast("✨ novo mundo gerado");
}

export function hasAutosave(): boolean {
  return hasLocal();
}

/** Liga autosave periódico (ms). */
export function startAutosave(everyMs = 30000): void {
  if (autosaveTimer) clearInterval(autosaveTimer);
  autosaveTimer = setInterval(() => {
    if (engine) saveLocal(engine.world);
  }, everyMs);
}
