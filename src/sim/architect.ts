import type { Agent, ActionKind } from "./components";
import { findPath } from "./pathfinding";
import { clamp } from "./reward";
import {
  assignAgentHousehold,
  assignAgentWorkplace,
  POIS,
  spawnAgent,
  type World,
} from "./world";

export type ArchitectEvent = "BLECAUTE" | "FESTA_PRACA";

/** Adiciona um novo agente ao mundo e retorna o agente criado. */
export function addAgent(world: World): Agent {
  const agent = spawnAgent(world);
  world.agents.push(agent);
  assignAgentHousehold(world, agent);
  assignAgentWorkplace(world, agent);
  return agent;
}

/** Adiciona vários agentes em uma única intervenção do Arquiteto. */
export function addAgents(world: World, count: number): Agent[] {
  const created: Agent[] = [];
  const safeCount = Math.max(0, Math.floor(count));
  for (let i = 0; i < safeCount; i++) {
    created.push(addAgent(world));
  }
  return created;
}

/**
 * Remove um agente. Se nenhum id for informado, remove o agente mais novo.
 * Também limpa relações e interações pendentes para evitar referências órfãs.
 */
export function removeAgent(world: World, id = newestAgentId(world)): Agent | null {
  if (id == null) return null;
  const idx = world.agents.findIndex((a) => a.id === id);
  if (idx < 0) return null;

  const [removed] = world.agents.splice(idx, 1);
  world.stats.mortes++;

  for (const agent of world.agents) {
    agent.relations.delete(id);
    if (agent.partner === id) agent.partner = null;
  }
  for (const institution of world.institutions) {
    if (institution.ownerId === id) institution.ownerId = null;
    institution.employees = institution.employees.filter((employeeId) => employeeId !== id);
  }
  for (const household of world.households) {
    household.members = household.members.filter((memberId) => memberId !== id);
  }

  return removed;
}

/** Aplica um evento imediato de Arquiteto. */
export function injectEvent(world: World, event: ArchitectEvent): void {
  switch (event) {
    case "BLECAUTE":
      applyBlackout(world);
      break;
    case "FESTA_PRACA":
      applyPlazaParty(world);
      break;
  }
}

function newestAgentId(world: World): number | null {
  const last = world.agents[world.agents.length - 1];
  return last ? last.id : null;
}

function applyBlackout(world: World): void {
  for (const agent of world.agents) {
    agent.emotion.stress = clamp(agent.emotion.stress + 0.18, 0, 1);
    agent.emotion.humor = clamp(agent.emotion.humor - 0.08, -1, 1);
    agent.needs.energia = clamp(agent.needs.energia - 4, 0, 100);

    if (agent.fsm !== "DORMINDO") {
      interrupt(agent);
    }
  }
}

function applyPlazaParty(world: World): void {
  const plaza =
    POIS.find((p) => p.id === "praca-central") ??
    POIS.find((p) => p.kind === "civico" && p.action === "SOCIALIZAR");
  if (!plaza) return;

  for (const agent of world.agents) {
    agent.emotion.humor = clamp(agent.emotion.humor + 0.12, -1, 1);
    agent.emotion.stress = clamp(agent.emotion.stress - 0.08, 0, 1);

    // Nem todos abandonam a rotina: agentes mais extrovertidos aderem mais.
    const chance = 0.35 + agent.personality.extroversao * 0.45;
    if (world.rng.next() > chance) continue;

    goToPoi(agent, plaza.id, plaza.cell, "SOCIALIZAR", 90);
  }
}

function goToPoi(
  agent: Agent,
  poiId: string,
  cell: Agent["pos"],
  action: ActionKind,
  useTimer: number
): void {
  const path = findPath(agent.pos, cell);
  agent.currentAction = action;
  agent.targetPoi = poiId;
  agent.path = path;
  agent.pathIndex = 0;
  agent.useTimer = useTimer;
  agent.travelMode = "CAMINHANDO";
  agent.partner = null;
  agent.fsm = path.length > 0 ? "INDO" : "SOCIALIZANDO";
}

function interrupt(agent: Agent): void {
  agent.fsm = "OCIOSO";
  agent.currentAction = null;
  agent.targetPoi = null;
  agent.path = [];
  agent.pathIndex = 0;
  agent.useTimer = 0;
  agent.travelMode = "CAMINHANDO";
  agent.partner = null;
}
