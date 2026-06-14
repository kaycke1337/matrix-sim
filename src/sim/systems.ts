import type { NeedKey, POI } from "./components";
import { NEED_KEYS } from "./components";
import { findPath } from "./pathfinding";
import { POIS, isNight, type World } from "./world";

/** Velocidade de movimento em células por tick. */
const MOVE_SPEED = 0.12;
/** Distância (em células) para considerar que chegou na próxima waypoint. */
const ARRIVE_EPS = 0.05;

// Taxas de decaimento por tick para cada necessidade.
const DECAY: Record<NeedKey, number> = {
  energia: 0.05,
  fome: 0.08,
  social: 0.04,
  diversao: 0.06,
};

/** Sistema 1: decai necessidades. */
export function needsSystem(world: World): void {
  for (const a of world.agents) {
    for (const k of NEED_KEYS) {
      // de noite a energia decai menos (descanso passivo)
      let d = DECAY[k];
      if (k === "energia" && isNight(world.clock) && a.fsm !== "DORMINDO") d *= 0.5;
      a.needs[k] = clamp(a.needs[k] - d, 0, 100);
    }
  }
}

/** Sistema 2: IA por utilidade + FSM. Decide alvo quando ocioso. */
export function aiSystem(world: World): void {
  for (const a of world.agents) {
    if (a.fsm !== "OCIOSO") continue;

    // escolhe a necessidade mais urgente (menor valor)
    let urgentKey: NeedKey = "fome";
    let urgentVal = Infinity;
    for (const k of NEED_KEYS) {
      if (a.needs[k] < urgentVal) {
        urgentVal = a.needs[k];
        urgentKey = k;
      }
    }
    // se ninguém está urgente o bastante, vagueia? Mantemos ocioso curto.
    if (urgentVal > 75) {
      // descansa um pouco; pequena chance de socializar na praça
      continue;
    }

    const poi = pickPoiFor(world, urgentKey);
    if (!poi) continue;

    const path = findPath(a.pos, poi.cell);
    if (path.length === 0) {
      // já está na célula do POI ou inalcançável → usa direto se adjacente
      a.targetPoi = poi.id;
      a.fsm = "USANDO";
      a.useTimer = useTicksFor(urgentVal);
    } else {
      a.targetPoi = poi.id;
      a.path = path;
      a.pathIndex = 0;
      a.fsm = "INDO";
    }
  }
}

/** Sistema 3: movimento ao longo do caminho. */
export function movementSystem(world: World): void {
  for (const a of world.agents) {
    if (a.fsm !== "INDO") continue;
    a.prevPos = { ...a.pos };

    const wp = a.path[a.pathIndex];
    if (!wp) {
      // chegou ao fim do caminho → começa a usar o POI
      a.fsm = "USANDO";
      const poi = POIS.find((p) => p.id === a.targetPoi);
      a.useTimer = useTicksFor(poi ? a.needs[poi.satisfies] : 50);
      continue;
    }

    const dx = wp.x - a.pos.x;
    const dz = wp.z - a.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < ARRIVE_EPS) {
      a.pos.x = wp.x;
      a.pos.z = wp.z;
      a.pathIndex++;
    } else {
      a.pos.x += (dx / dist) * MOVE_SPEED;
      a.pos.z += (dz / dist) * MOVE_SPEED;
    }
  }
}

/** Sistema 4: usa o POI, repõe a necessidade, volta a ocioso. */
export function actionSystem(world: World): void {
  for (const a of world.agents) {
    if (a.fsm !== "USANDO") continue;
    a.prevPos = { ...a.pos };
    const poi = POIS.find((p) => p.id === a.targetPoi);
    if (!poi) {
      a.fsm = "OCIOSO";
      continue;
    }
    a.fsm = poi.satisfies === "energia" ? "DORMINDO" : "USANDO";
    a.needs[poi.satisfies] = clamp(a.needs[poi.satisfies] + poi.rate, 0, 100);
    a.useTimer--;
    if (a.useTimer <= 0 || a.needs[poi.satisfies] >= 100) {
      a.fsm = "OCIOSO";
      a.targetPoi = null;
      a.path = [];
      a.pathIndex = 0;
    }
  }
}

// ---- helpers ----

function pickPoiFor(world: World, need: NeedKey): POI | null {
  const candidates = POIS.filter((p) => p.satisfies === need);
  if (candidates.length === 0) return null;
  return world.rng.pick(candidates);
}

function useTicksFor(currentVal: number): number {
  // quanto mais baixa a necessidade, mais tempo usa o POI
  return Math.round(20 + (100 - currentVal) * 0.6);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
