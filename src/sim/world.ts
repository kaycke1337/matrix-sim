import type { Agent, NeedKey } from "./components";
import { NEED_KEYS } from "./components";
import { RNG } from "./rng";
import { POIS, cellToWorld, isWalkable, GRID_W, GRID_H } from "./map";

/** Tamanho de um tick simulado, em ms simulados. */
export const TICK_MS = 100;
/** Quantos ticks formam um "dia" completo. */
export const TICKS_PER_DAY = 2400; // ~4 min reais em 1x

export interface WorldClock {
  tick: number; // total de ticks desde o início
}

export interface World {
  clock: WorldClock;
  agents: Agent[];
  rng: RNG;
  nextId: number;
}

const NAMES = [
  "Neo", "Trinity", "Morpheus", "Cypher", "Tank", "Dozer", "Switch",
  "Apoc", "Mouse", "Niobe", "Link", "Ghost", "Seraph", "Sati", "Oracle",
];

const COLORS = [0x6ee7b7, 0x93c5fd, 0xfca5a5, 0xfcd34d, 0xc4b5fd, 0xf9a8d4];

export function createWorld(seed = 1337, agentCount = 12): World {
  const rng = new RNG(seed);
  const world: World = {
    clock: { tick: 0 },
    agents: [],
    rng,
    nextId: 1,
  };
  for (let i = 0; i < agentCount; i++) {
    world.agents.push(spawnAgent(world));
  }
  return world;
}

/** Cria um agente em uma célula caminhável aleatória. */
export function spawnAgent(world: World): Agent {
  const { rng } = world;
  let x = 0;
  let z = 0;
  do {
    x = rng.int(0, GRID_W - 1);
    z = rng.int(0, GRID_H - 1);
  } while (!isWalkable(x, z));

  const needs = {} as Record<NeedKey, number>;
  for (const k of NEED_KEYS) needs[k] = rng.int(40, 90);

  return {
    id: world.nextId++,
    name: rng.pick(NAMES) + "-" + world.nextId,
    color: rng.pick(COLORS),
    pos: { x, z },
    prevPos: { x, z },
    needs,
    fsm: "OCIOSO",
    targetPoi: null,
    path: [],
    pathIndex: 0,
    useTimer: 0,
  };
}

export { POIS, cellToWorld };

/** Hora do dia em [0,1): 0 = meia-noite, 0.5 = meio-dia. */
export function dayPhase(clock: WorldClock): number {
  return (clock.tick % TICKS_PER_DAY) / TICKS_PER_DAY;
}

/** É noite? (entre ~19h e ~6h) */
export function isNight(clock: WorldClock): boolean {
  const p = dayPhase(clock);
  return p < 0.25 || p > 0.8;
}
