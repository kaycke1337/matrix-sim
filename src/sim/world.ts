import type { Agent, NeedKey, Personality, Job } from "./components";
import { NEED_KEYS, ACTIONS } from "./components";
import { Brain } from "./brain";
import { RNG } from "./rng";
import { POIS, cellToWorld, isWalkable, GRID_W, GRID_H } from "./map";

/** Tamanho de um tick simulado, em ms simulados. */
export const TICK_MS = 100;
/** Quantos ticks formam um "dia" completo. */
export const TICKS_PER_DAY = 2400;

/** Tamanho do vetor de percepção que alimenta a rede. */
export const PERCEPT_SIZE = 13;
/** Neurônios na camada oculta de cada cérebro. */
export const HIDDEN = 16;

export interface WorldClock {
  tick: number;
}

export interface World {
  clock: WorldClock;
  agents: Agent[];
  rng: RNG;
  nextId: number;
  /** estatísticas globais para telemetria/economia */
  stats: {
    nascimentos: number;
    mortes: number;
  };
}

const NAMES = [
  "Neo", "Trinity", "Morpheus", "Cypher", "Tank", "Dozer", "Switch",
  "Apoc", "Mouse", "Niobe", "Link", "Ghost", "Seraph", "Sati", "Oracle",
];

const COLORS = [0x6ee7b7, 0x93c5fd, 0xfca5a5, 0xfcd34d, 0xc4b5fd, 0xf9a8d4];
const JOBS: Job[] = ["barista", "comerciante", "artista", "tecnico"];

export function createWorld(seed = 1337, agentCount = 12): World {
  const rng = new RNG(seed);
  const world: World = {
    clock: { tick: 0 },
    agents: [],
    rng,
    nextId: 1,
    stats: { nascimentos: 0, mortes: 0 },
  };
  for (let i = 0; i < agentCount; i++) {
    world.agents.push(spawnAgent(world));
  }
  return world;
}

function randTrait(rng: RNG): number {
  // distribuição levemente central (média de 2 uniformes)
  return (rng.next() + rng.next()) / 2;
}

function makePersonality(rng: RNG): Personality {
  return {
    extroversao: randTrait(rng),
    diligencia: randTrait(rng),
    neuroticismo: randTrait(rng),
    sociabilidade: randTrait(rng),
    ambicao: randTrait(rng),
  };
}

/** Cria um agente novo, com cérebro neural e personalidade própria. */
export function spawnAgent(world: World): Agent {
  const { rng } = world;
  let x = 0;
  let z = 0;
  do {
    x = rng.int(0, GRID_W - 1);
    z = rng.int(0, GRID_H - 1);
  } while (!isWalkable(x, z));

  const needs = {} as Record<NeedKey, number>;
  for (const k of NEED_KEYS) needs[k] = rng.int(45, 90);

  const id = world.nextId++;
  world.stats.nascimentos++;

  return {
    id,
    name: rng.pick(NAMES) + "-" + id,
    color: rng.pick(COLORS),
    pos: { x, z },
    prevPos: { x, z },
    needs,
    personality: makePersonality(rng),
    emotion: { humor: 0, stress: 0.2 },
    brain: new Brain(PERCEPT_SIZE, HIDDEN, ACTIONS.length, rng),
    job: rng.pick(JOBS),
    money: rng.int(10, 40),
    relations: new Map(),
    partner: null,
    fsm: "OCIOSO",
    currentAction: null,
    targetPoi: null,
    path: [],
    pathIndex: 0,
    useTimer: 0,
    lastActionIdx: -1,
    lastPercept: [],
    lastWellbeing: 0,
    totalReward: 0,
    age: 0,
  };
}

export { POIS, cellToWorld };

export function dayPhase(clock: WorldClock): number {
  return (clock.tick % TICKS_PER_DAY) / TICKS_PER_DAY;
}

export function isNight(clock: WorldClock): boolean {
  const p = dayPhase(clock);
  return p < 0.25 || p > 0.8;
}
