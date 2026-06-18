import type { Agent, Relation } from "./components";
import type {
  ChatMessage,
  CivicState,
  Household,
  Institution,
  Vehicle,
  World,
} from "./world";
import {
  assignAgentHousehold,
  assignInitialWorkplaces,
  createInitialCivics,
  createInitialHouseholds,
  createInitialInstitutions,
  createInitialVehicles,
} from "./world";
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
  homePoiId?: string | null;
  householdId?: number | null;
  workplacePoiId?: string | null;
  relations: RelationEntry[];
  partner: number | null;
  fsm: Agent["fsm"];
  currentAction: Agent["currentAction"];
  targetPoi: string | null;
  path: { x: number; z: number }[];
  pathIndex: number;
  useTimer: number;
  travelMode?: Agent["travelMode"];
  transitRides?: number;
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
  civics?: CivicState;
  institutions?: Institution[];
  chat?: ChatMessage[];
  vehicles?: Vehicle[];
  households?: Household[];
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
    civics: {
      ...world.civics,
      lastResults: world.civics.lastResults.map((r) => ({ ...r })),
    },
    institutions: world.institutions.map((institution) => ({
      ...institution,
      employees: [...institution.employees],
    })),
    households: world.households.map((household) => ({
      ...household,
      members: [...household.members],
    })),
    chat: world.chat.map((message) => ({ ...message })),
    vehicles: world.vehicles.map((vehicle) => ({
      ...vehicle,
      pos: { ...vehicle.pos },
      prevPos: { ...vehicle.prevPos },
      route: vehicle.route.map((point) => ({ ...point })),
    })),
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
    homePoiId: a.homePoiId,
    householdId: a.householdId,
    workplacePoiId: a.workplacePoiId,
    relations,
    partner: a.partner,
    fsm: a.fsm,
    currentAction: a.currentAction,
    targetPoi: a.targetPoi,
    path: a.path.map((p) => ({ ...p })),
    pathIndex: a.pathIndex,
    useTimer: a.useTimer,
    travelMode: a.travelMode,
    transitRides: a.transitRides,
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
  const defaultCivics = createInitialCivics();

  const world: World = {
    clock: { tick: data.tick },
    agents: data.agents.map(deserializeAgent),
    rng,
    nextId: data.nextId,
    stats: {
      nascimentos: data.stats.nascimentos,
      mortes: data.stats.mortes,
      eleicoes: data.stats.eleicoes ?? 0,
    },
    civics: data.civics
      ? {
          ...defaultCivics,
          ...data.civics,
          policy: {
            ...defaultCivics.policy,
            ...data.civics.policy,
          },
          lastResults: data.civics.lastResults.map((r) => ({
            ...r,
            proposal: {
              ...defaultCivics.policy,
              ...(r.proposal ?? data.civics?.policy),
            },
          })),
          activeProposals: (data.civics.activeProposals ?? []).map((proposal) => ({
            ...proposal,
            policy: {
              ...defaultCivics.policy,
              ...proposal.policy,
            },
          })),
        }
      : createInitialCivics(),
    institutions: [],
    households: [],
    chat: data.chat ? data.chat.map((message) => ({ ...message })) : [],
    vehicles: data.vehicles
      ? data.vehicles.map((vehicle) => ({
          ...vehicle,
          pos: { ...vehicle.pos },
          prevPos: { ...vehicle.prevPos },
          route: vehicle.route.map((point) => ({ ...point })),
        }))
      : createInitialVehicles(),
  };
  world.institutions = data.institutions
    ? data.institutions.map((institution) => ({
        ...institution,
        wage: institution.wage ?? 0,
        employees: [...(institution.employees ?? [])],
      }))
    : createInitialInstitutions(world);
  world.households = data.households
    ? data.households.map((household) => ({
        ...household,
        members: [...household.members],
      }))
    : createInitialHouseholds(world);
  for (const agent of world.agents) {
    if (agent.homePoiId == null || agent.householdId == null) {
      assignAgentHousehold(world, agent);
    }
  }
  // Saves a partir da Fase 7 carregam `institutions`, e nesse caso o estado de
  // emprego é autoritativo — inclusive o desemprego (workplacePoiId == null).
  // Só re-atribuímos para migrar saves legados que não traziam instituições.
  if (!data.institutions && world.agents.some((agent) => agent.workplacePoiId == null)) {
    assignInitialWorkplaces(world);
  }
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
    homePoiId: d.homePoiId ?? null,
    householdId: d.householdId ?? null,
    workplacePoiId: d.workplacePoiId ?? null,
    relations,
    partner: d.partner,
    fsm: d.fsm,
    currentAction: d.currentAction,
    targetPoi: d.targetPoi,
    path: d.path.map((p) => ({ ...p })),
    pathIndex: d.pathIndex,
    useTimer: d.useTimer,
    travelMode: d.travelMode ?? "CAMINHANDO",
    transitRides: d.transitRides ?? 0,
    lastActionIdx: d.lastActionIdx,
    lastPercept: [...d.lastPercept],
    lastWellbeing: d.lastWellbeing,
    totalReward: d.totalReward,
    age: d.age,
  };
}
