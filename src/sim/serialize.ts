import type { Agent, Relation } from "./components";
import type { World } from "./world";
import { RNG } from "./rng";
import { Brain, type BrainData } from "./brain";

/** Versão do formato de save. Incrementar se o schema mudar. */
export const SAVE_VERSION = 1;

interface RelationEntry {
  id: number;
  afinidade: number;
  encontros: number;
  ultimoTick: number;
}

interface AgentData {
  id: number;
  name: string;
  color: number;
  pos: { x: number; z: number };
  prevPos: { x: number; z: number };
  needs: Agent["needs"];
  personality: Agent["personality"];
  emotion: Agent["emotion"];
  brain: BrainData;
  job: Agent["job"];
  money: number;
  relations: RelationEntry[];
  partner: number | null;
  fsm: Agent["fsm"];
  currentAction: Agent["currentAction"];
  targetPoi: string | null;
  path: { x: number; z: number }[];
  pathIndex: number;
  useTimer: number;
  lastActionIdx: number;
  lastPercept: number[];
  lastWellbeing: number;
  totalReward: number;
  age: number;
}

export interface WorldData {
  version: number;
  savedAt: string;
  tick: number;
  rngState: number;
  nextId: number;
  stats: World["stats"];
  agents: AgentData[];
}

/** Serializa o mundo COMPLETO (inclui pesos das redes neurais). */
export function serializeWorld(world: World, savedAt = ""): WorldData {
  return {
    version: SAVE_VERSION,
    savedAt,
    tick: world.clock.tick,
    rngState: world.rng.state,
    nextId: world.nextId,
    stats: { ...world.stats },
    agents: world.agents.map(serializeAgent),
  };
}

function serializeAgent(a: Agent): AgentData {
  const relations: RelationEntry[] = [];
  for (const [id, r] of a.relations) {
    relations.push({ id, afinidade: r.afinidade, encontros: r.encontros, ultimoTick: r.ultimoTick });
  }
  return {
    id: a.id,
    name: a.name,
    color: a.color,
    pos: { ...a.pos },
    prevPos: { ...a.prevPos },
    needs: { ...a.needs },
    personality: { ...a.personality },
    emotion: { ...a.emotion },
    brain: a.brain.toJSON(),
    job: a.job,
    money: a.money,
    relations,
    partner: a.partner,
    fsm: a.fsm,
    currentAction: a.currentAction,
    targetPoi: a.targetPoi,
    path: a.path.map((p) => ({ ...p })),
    pathIndex: a.pathIndex,
    useTimer: a.useTimer,
    lastActionIdx: a.lastActionIdx,
    lastPercept: [...a.lastPercept],
    lastWellbeing: a.lastWellbeing,
    totalReward: a.totalReward,
    age: a.age,
  };
}

/** Reconstrói o mundo a partir do save (restaura redes, relações e RNG). */
export function deserializeWorld(data: WorldData): World {
  if (data.version !== SAVE_VERSION) {
    throw new Error(
      `Versão de save incompatível: ${data.version} (esperado ${SAVE_VERSION})`
    );
  }
  const rng = new RNG(1);
  rng.state = data.rngState;

  const world: World = {
    clock: { tick: data.tick },
    agents: data.agents.map(deserializeAgent),
    rng,
    nextId: data.nextId,
    stats: { ...data.stats },
  };
  return world;
}

function deserializeAgent(d: AgentData): Agent {
  const relations = new Map<number, Relation>();
  for (const r of d.relations) {
    relations.set(r.id, { afinidade: r.afinidade, encontros: r.encontros, ultimoTick: r.ultimoTick });
  }
  return {
    id: d.id,
    name: d.name,
    color: d.color,
    pos: { ...d.pos },
    prevPos: { ...d.prevPos },
    needs: { ...d.needs },
    personality: { ...d.personality },
    emotion: { ...d.emotion },
    brain: Brain.fromJSON(d.brain),
    job: d.job,
    money: d.money,
    relations,
    partner: d.partner,
    fsm: d.fsm,
    currentAction: d.currentAction,
    targetPoi: d.targetPoi,
    path: d.path.map((p) => ({ ...p })),
    pathIndex: d.pathIndex,
    useTimer: d.useTimer,
    lastActionIdx: d.lastActionIdx,
    lastPercept: [...d.lastPercept],
    lastWellbeing: d.lastWellbeing,
    totalReward: d.totalReward,
    age: d.age,
  };
}
