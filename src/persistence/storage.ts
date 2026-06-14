import type { World } from "../sim/world";
import { serializeWorld, deserializeWorld, type WorldData } from "../sim/serialize";

const LS_KEY = "matrix-sim:autosave";

/** Baixa o mundo como arquivo JSON (matrix-sim-<tick>.json). */
export function downloadWorld(world: World): void {
  const data = serializeWorld(world, new Date().toISOString());
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `matrix-sim-${world.clock.tick}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Abre seletor de arquivo e carrega um mundo de um .json. */
export function uploadWorld(): Promise<World> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error("nenhum arquivo"));
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string) as WorldData;
          resolve(deserializeWorld(data));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    };
    input.click();
  });
}

/** Salva no localStorage (autosave). Silencioso em caso de erro de quota. */
export function saveLocal(world: World): boolean {
  try {
    const data = serializeWorld(world, new Date().toISOString());
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Carrega o autosave do localStorage, se houver. */
export function loadLocal(): World | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return deserializeWorld(JSON.parse(raw) as WorldData);
  } catch {
    return null;
  }
}

/** Existe um autosave salvo? */
export function hasLocal(): boolean {
  return localStorage.getItem(LS_KEY) !== null;
}

/** Remove o autosave. */
export function clearLocal(): void {
  localStorage.removeItem(LS_KEY);
}
