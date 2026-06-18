import type { Agent, NeedKey, Personality, Job, POI } from "./components";
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
    eleicoes: number;
  };
  civics: CivicState;
  institutions: Institution[];
  chat: ChatMessage[];
  vehicles: Vehicle[];
  households: Household[];
}

export interface ElectionResult {
  candidateId: number;
  name: string;
  votes: number;
  proposal: CivicPolicy;
}

export interface CivicState {
  mayorId: number | null;
  mayorName: string | null;
  lastElectionTick: number;
  nextElectionTick: number;
  nextCampaignTick: number;
  lastResults: ElectionResult[];
  budget: number;
  policy: CivicPolicy;
  approval: number;
  activeProposals: CandidateProposal[];
}

export interface CivicPolicy {
  taxRate: number;
  welfare: number;
  transitSubsidy: number;
  marketSupport: number;
}

export interface CandidateProposal {
  candidateId: number;
  name: string;
  policy: CivicPolicy;
  slogan: string;
}

export interface Institution {
  id: string;
  poiId: string;
  name: string;
  kind: POI["kind"];
  ownerId: number | null;
  cash: number;
  stock: number;
  wage: number;
  employees: number[];
  priceMultiplier: number;
  transactions: number;
}

export interface Household {
  id: number;
  homePoiId: string;
  name: string;
  members: number[];
  rent: number;
  sharedCash: number;
}

export interface ChatMessage {
  tick: number;
  speakerId: number | null;
  speakerName: string;
  text: string;
  topic: "social" | "economia" | "politica" | "sistema";
}

export interface Vehicle {
  id: number;
  label: string;
  pos: { x: number; z: number };
  prevPos: { x: number; z: number };
  route: { x: number; z: number }[];
  routeIndex: number;
  speed: number;
  color: number;
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
    stats: { nascimentos: 0, mortes: 0, eleicoes: 0 },
    civics: createInitialCivics(),
    institutions: [],
    chat: [],
    vehicles: [],
    households: [],
  };
  for (let i = 0; i < agentCount; i++) {
    world.agents.push(spawnAgent(world));
  }
  world.institutions = createInitialInstitutions(world);
  world.households = createInitialHouseholds(world);
  assignInitialWorkplaces(world);
  world.vehicles = createInitialVehicles();
  return world;
}

export function createInitialHouseholds(world: World): Household[] {
  const homes = POIS.filter((poi) => poi.kind === "residencia");
  const households = homes.map((home, index) => ({
    id: index + 1,
    homePoiId: home.id,
    name: home.label,
    members: [] as number[],
    rent: 2 + index,
    sharedCash: 20,
  }));

  for (let i = 0; i < world.agents.length; i++) {
    const household = households[i % households.length];
    const agent = world.agents[i];
    agent.homePoiId = household.homePoiId;
    agent.householdId = household.id;
    household.members.push(agent.id);
  }

  return households;
}

export function assignAgentHousehold(world: World, agent: Agent): void {
  if (world.households.length === 0) {
    agent.homePoiId = null;
    agent.householdId = null;
    return;
  }
  const household = world.households.reduce((best, current) =>
    current.members.length < best.members.length ? current : best
  );
  agent.homePoiId = household.homePoiId;
  agent.householdId = household.id;
  if (!household.members.includes(agent.id)) household.members.push(agent.id);
}

export function pushChat(world: World, message: ChatMessage): void {
  world.chat.push(message);
  if (world.chat.length > 80) {
    world.chat.splice(0, world.chat.length - 80);
  }
}

export function createInitialVehicles(): Vehicle[] {
  const routes = [
    [
      { x: 2, z: 10 },
      { x: 45, z: 10 },
      { x: 45, z: 34 },
      { x: 2, z: 34 },
    ],
    [
      { x: 2, z: 22 },
      { x: 45, z: 22 },
      { x: 45, z: 44 },
      { x: 2, z: 44 },
    ],
  ];
  const colors = [0x93c5fd, 0xfca5a5, 0xfcd34d, 0x6ee7b7, 0xc4b5fd, 0xf9a8d4];
  const vehicles: Vehicle[] = [];
  for (let i = 0; i < 6; i++) {
    const route = routes[i % routes.length].map((p) => ({ ...p }));
    const routeIndex = i % route.length;
    vehicles.push({
      id: i + 1,
      label: `carro-${i + 1}`,
      pos: { ...route[routeIndex] },
      prevPos: { ...route[routeIndex] },
      route,
      routeIndex,
      speed: 0.16 + (i % 3) * 0.02,
      color: colors[i % colors.length],
    });
  }
  return vehicles;
}

export function createInitialCivics(): CivicState {
  return {
    mayorId: null,
    mayorName: null,
    lastElectionTick: 0,
    nextElectionTick: TICKS_PER_DAY,
    nextCampaignTick: Math.round(TICKS_PER_DAY * 0.75),
    lastResults: [],
    budget: 240,
    policy: {
      taxRate: 0.08,
      welfare: 0.35,
      transitSubsidy: 0.3,
      marketSupport: 0.35,
    },
    approval: 0.5,
    activeProposals: [],
  };
}

export function createInitialInstitutions(world: World): Institution[] {
  return POIS.filter((poi) => poi.kind !== "residencia").map((poi, index) => {
    const canHaveOwner =
      poi.kind === "loja" || poi.kind === "lazer" || poi.kind === "trabalho";
    const owner = canHaveOwner ? pickOwner(world, index) : null;
    return {
      id: `inst-${poi.id}`,
      poiId: poi.id,
      name: poi.label,
      kind: poi.kind,
      ownerId: owner?.id ?? null,
      cash: poi.kind === "civico" ? 120 : 80 + index * 7,
      stock: poi.cost > 0 ? 80 + index * 5 : 0,
      wage: poi.cost < 0 ? Math.abs(poi.cost) : 0,
      employees: [],
      priceMultiplier: 1,
      transactions: 0,
    };
  });
}

export function assignInitialWorkplaces(world: World): void {
  for (const agent of world.agents) {
    assignAgentWorkplace(world, agent);
  }
}

export function assignAgentWorkplace(world: World, agent: Agent): void {
  const workplaces = world.institutions.filter((institution) => institution.wage > 0);
  if (workplaces.length === 0) {
    agent.workplacePoiId = null;
    return;
  }
  const preferred = workplaceForJob(agent.job, workplaces) ?? workplaces[agent.id % workplaces.length];
  agent.workplacePoiId = preferred.poiId;
  if (!preferred.employees.includes(agent.id)) preferred.employees.push(agent.id);
}

export function findInstitution(world: World, poiId: string | null): Institution | null {
  if (!poiId) return null;
  return world.institutions.find((inst) => inst.poiId === poiId) ?? null;
}

function workplaceForJob(job: Job, workplaces: Institution[]): Institution | null {
  const wanted =
    job === "barista"
      ? "trabalho-cafe"
      : job === "comerciante"
        ? "trabalho-mercado"
        : job === "artista"
          ? "atelie"
          : job === "tecnico"
            ? "oficina"
            : null;
  return wanted ? workplaces.find((institution) => institution.poiId === wanted) ?? null : null;
}

function pickOwner(world: World, index: number): Agent | null {
  if (world.agents.length === 0) return null;
  return [...world.agents].sort(
    (a, b) =>
      b.personality.ambicao + b.personality.diligencia + b.money / 100 -
        (a.personality.ambicao + a.personality.diligencia + a.money / 100) ||
      a.id - b.id
  )[index % world.agents.length];
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
    homePoiId: null,
    householdId: null,
    workplacePoiId: null,
    relations: new Map(),
    partner: null,
    fsm: "OCIOSO",
    currentAction: null,
    targetPoi: null,
    path: [],
    pathIndex: 0,
    useTimer: 0,
    travelMode: "CAMINHANDO",
    transitPhase: "NONE",
    transitDestination: null,
    transitRides: 0,
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
