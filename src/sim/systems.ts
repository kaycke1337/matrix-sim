import type { Agent, NeedKey, POI, ActionKind } from "./components";
import { NEED_KEYS, ACTIONS } from "./components";
import { findPath } from "./pathfinding";
import { GRID_H, GRID_W } from "./map";
import {
  findInstitution,
  POIS,
  isNight,
  pushChat,
  type World,
} from "./world";
import { perceive } from "./perception";
import { wellbeing, clamp } from "./reward";

const MOVE_SPEED = 0.12;
const ARRIVE_EPS = 0.05;
const TRANSIT_BOARD_RADIUS = 3.5;
const TRANSIT_MAX_WAIT_TICKS = 220;

const DECAY: Record<NeedKey, number> = {
  energia: 0.05,
  fome: 0.08,
  social: 0.04,
  diversao: 0.06,
};

/** Sistema 1: decai necessidades; fome zerada custa dinheiro/saúde (stress). */
export function needsSystem(world: World): void {
  for (const a of world.agents) {
    for (const k of NEED_KEYS) {
      let d = DECAY[k];
      if (k === "energia" && isNight(world.clock) && a.fsm !== "DORMINDO") d *= 0.5;
      a.needs[k] = clamp(a.needs[k] - d, 0, 100);
    }
    a.age++;
  }
}

/**
 * Sistema 2: DECISÃO NEURAL.
 * Quando ocioso, o agente:
 *  1. percebe o mundo (vetor),
 *  2. a rede produz uma política sobre as 6 ações,
 *  3. amostra uma ação (explora via softmax),
 *  4. APRENDE com o resultado da decisão ANTERIOR (recompensa = Δ bem-estar),
 *  5. escolhe um POI compatível e traça o caminho.
 */
export function decisionSystem(world: World): void {
  for (const a of world.agents) {
    if (a.fsm !== "OCIOSO") continue;

    // --- aprende com a decisão anterior ---
    learnFromLastDecision(a);

    // --- nova decisão ---
    const percept = perceive(world, a);
    const probs = a.brain.forward(percept);
    const actionIdx = a.brain.sample(probs, world.rng);
    const action = ACTIONS[actionIdx];

    a.lastPercept = percept;
    a.lastActionIdx = actionIdx;
    a.lastWellbeing = wellbeing(a);
    a.currentAction = action;

    if (action === "VAGUEAR") {
      // anda para uma célula aleatória próxima (exploração física)
      wander(world, a);
      continue;
    }

    const poi = pickPoiForAction(world, a, action);
    if (!poi) {
      a.fsm = "OCIOSO";
      continue;
    }
    const path = findPath(a.pos, poi.cell);
    a.targetPoi = poi.id;
    if (path.length === 0) {
      startUsing(a, poi);
    } else {
      const transitPath = maybeUseTransit(world, a, poi, path);
      a.path = transitPath ?? path;
      a.pathIndex = 0;
      a.fsm = "INDO";
    }
  }
}

/** REINFORCE: vantagem = (bem-estar agora - bem-estar na decisão) - baseline. */
function learnFromLastDecision(a: Agent): void {
  if (a.lastActionIdx < 0 || a.lastPercept.length === 0) return;
  const now = wellbeing(a);
  let reward = now - a.lastWellbeing;

  // shaping leve guiado por personalidade (dá "gosto" pessoal às ações)
  reward += personalityBias(a, ACTIONS[a.lastActionIdx]) * 0.01;

  const baseline = 0; // bem-estar já é diferencial; baseline 0 funciona
  const advantage = clamp(reward - baseline, -1, 1);

  // re-roda forward com a MESMA percepção para preencher o cache, então treina
  a.brain.forward(a.lastPercept);
  a.brain.learn(a.lastActionIdx, advantage);
  a.totalReward += reward;
}

function personalityBias(a: Agent, action: ActionKind): number {
  switch (action) {
    case "SOCIALIZAR":
      return a.personality.extroversao - 0.5;
    case "TRABALHAR":
      return a.personality.diligencia + a.personality.ambicao - 1;
    case "DIVERTIR":
      return 0.3 - a.personality.diligencia * 0.3;
    default:
      return 0;
  }
}

/** Sistema 3: movimento ao longo do caminho. */
export function movementSystem(world: World): void {
  for (const a of world.agents) {
    if (a.fsm !== "INDO") continue;
    a.prevPos = { ...a.pos };

    const wp = a.path[a.pathIndex];
    if (!wp) {
      if (a.transitPhase === "WALK_TO_STOP" && a.transitDestination) {
        a.transitPhase = "WAITING";
        a.path = [];
        a.pathIndex = 0;
      }
      if (a.transitPhase === "WAITING" && a.transitDestination) {
        tryBoardTransit(world, a);
        continue;
      }
      const poi = POIS.find((p) => p.id === a.targetPoi);
      if (poi) startUsing(a, poi);
      else a.fsm = "OCIOSO";
      continue;
    }
    const dx = wp.x - a.pos.x;
    const dz = wp.z - a.pos.z;
    const dist = Math.hypot(dx, dz);
    const speed = a.travelMode === "TRANSITO" ? MOVE_SPEED * 2.3 : MOVE_SPEED;
    if (dist < ARRIVE_EPS) {
      a.pos.x = wp.x;
      a.pos.z = wp.z;
      a.pathIndex++;
    } else {
      a.pos.x += (dx / dist) * speed;
      a.pos.z += (dz / dist) * speed;
    }
  }
}

/** Sistema 4: usa o POI — repõe necessidade, paga/recebe dinheiro. */
export function actionSystem(world: World): void {
  for (const a of world.agents) {
    if (a.fsm !== "USANDO" && a.fsm !== "DORMINDO" && a.fsm !== "SOCIALIZANDO")
      continue;
    a.prevPos = { ...a.pos };
    const poi = POIS.find((p) => p.id === a.targetPoi);
    if (!poi) {
      a.fsm = "OCIOSO";
      continue;
    }

    // efeito do POI (reposição de necessidade é gradual por tick)
    if (poi.satisfies) {
      a.needs[poi.satisfies] = clamp(a.needs[poi.satisfies] + poi.rate, 0, 100);
    }

    a.useTimer--;
    const done =
      a.useTimer <= 0 ||
      (poi.satisfies !== null && a.needs[poi.satisfies] >= 100);
    if (done) {
      settleEconomy(world, a, poi);
      a.fsm = "OCIOSO";
      a.partner = null;
      a.targetPoi = null;
      a.path = [];
      a.pathIndex = 0;
      resetTransit(a);
    }
  }
}

function settleEconomy(world: World, a: Agent, poi: POI): void {
  if (poi.cost === 0) return;

  const inst = findInstitution(world, poi.id);
  if (poi.cost > 0) {
    const price = Math.max(1, Math.round(poi.cost * (inst?.priceMultiplier ?? 1)));
    if (a.money < price || (inst && inst.stock <= 0)) {
      a.emotion.stress = clamp(a.emotion.stress + 0.05, 0, 1);
      return;
    }

    a.money = Math.max(0, a.money - price);
    if (inst) {
      const tax = price * world.civics.policy.taxRate;
      world.civics.budget += tax;
      inst.cash += price - tax;
      inst.stock = Math.max(0, inst.stock - 1);
      inst.transactions++;
      payOwnerDividend(world, inst.ownerId, a.id, (price - tax) * 0.25);
    }
    return;
  }

  const wage = inst?.wage ?? Math.abs(poi.cost);
  const available = inst ? Math.max(0, inst.cash) : wage;
  const paid = inst ? Math.min(wage, available) : wage;
  if (paid <= 0) {
    a.emotion.stress = clamp(a.emotion.stress + 0.04, 0, 1);
    return;
  }

  const payrollTax = paid * world.civics.policy.taxRate * 0.35;
  a.money += paid - payrollTax;
  world.civics.budget += payrollTax;
  if (inst) {
    inst.cash -= paid;
    inst.stock += productivityFor(a, inst.wage);
    inst.transactions++;
    if (paid < wage) a.emotion.stress = clamp(a.emotion.stress + 0.03, 0, 1);
  }
}

function productivityFor(a: Agent, wage: number): number {
  return Math.max(1, Math.round(1 + a.personality.diligencia * 3 + wage * 0.08));
}

function payOwnerDividend(
  world: World,
  ownerId: number | null,
  customerId: number,
  amount: number
): void {
  if (ownerId == null || ownerId === customerId || amount <= 0) return;
  const owner = world.agents.find((agent) => agent.id === ownerId);
  if (owner) owner.money += amount;
}

// ---- helpers ----

function startUsing(a: Agent, poi: POI): void {
  resetTransit(a);
  if (poi.action === "DORMIR") a.fsm = "DORMINDO";
  else if (poi.action === "SOCIALIZAR") a.fsm = "SOCIALIZANDO";
  else a.fsm = "USANDO";
  const baseline = poi.satisfies ? a.needs[poi.satisfies] : 50;
  a.useTimer = useTicksFor(baseline);
}

function pickPoiForAction(world: World, a: Agent, action: ActionKind): POI | null {
  if (action === "DORMIR" && a.homePoiId) {
    const home = POIS.find((p) => p.id === a.homePoiId);
    if (home) return home;
  }

  if (action === "TRABALHAR" && a.workplacePoiId) {
    const workplace = POIS.find((p) => p.id === a.workplacePoiId);
    if (workplace) return workplace;
  }

  const candidates = POIS.filter((p) => p.action === action);
  if (candidates.length === 0) return null;
  // escolhe o mais próximo (com leve ruído p/ não ficar rígido)
  let best: POI | null = null;
  let bestScore = Infinity;
  for (const p of candidates) {
    const d = Math.hypot(p.cell.x - a.pos.x, p.cell.z - a.pos.z);
    const score = d + world.rng.next() * 3;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

function wander(world: World, a: Agent): void {
  const tx = clamp(Math.round(a.pos.x + world.rng.int(-4, 4)), 0, GRID_W - 1);
  const tz = clamp(Math.round(a.pos.z + world.rng.int(-4, 4)), 0, GRID_H - 1);
  const path = findPath(a.pos, { x: tx, z: tz });
  if (path.length > 0) {
    a.path = path;
    a.pathIndex = 0;
    a.targetPoi = null;
    resetTransit(a);
    a.fsm = "INDO";
  } else {
    a.fsm = "OCIOSO";
  }
}

function maybeUseTransit(
  world: World,
  a: Agent,
  destinationPoi: POI,
  path: Agent["path"]
): Agent["path"] | null {
  if (path.length < 24 || world.vehicles.length === 0) {
    resetTransit(a);
    return null;
  }
  const subsidy = world.civics.policy.transitSubsidy;
  if (subsidy < 0.2) {
    resetTransit(a);
    return null;
  }

  const baseFare = 4;
  const fare = Math.max(1, Math.round(baseFare * (1 - subsidy * 0.7)));
  if (a.money < fare) {
    resetTransit(a);
    return null;
  }

  const publicCost = Math.max(0, baseFare - fare);
  if (world.civics.budget < publicCost) {
    resetTransit(a);
    return null;
  }

  const stop = nearestTransitStop(a.pos);
  if (!stop) {
    resetTransit(a);
    return null;
  }
  const stopPath = findPath(a.pos, stop.cell);
  if (stopPath.length === 0) {
    resetTransit(a);
    return null;
  }

  a.money -= fare;
  world.civics.budget -= publicCost;
  a.travelMode = "CAMINHANDO";
  a.transitPhase = "WALK_TO_STOP";
  a.transitDestination = { ...destinationPoi.cell };
  a.transitVehicleId = null;
  a.transitWaitTicks = 0;
  a.transitRides++;
  a.emotion.stress = clamp(a.emotion.stress - 0.02, 0, 1);

  if ((a.transitRides + world.clock.tick) % 17 === 0) {
    pushChat(world, {
      tick: world.clock.tick,
      speakerId: a.id,
      speakerName: a.name,
      text: `pegou transporte publico por ${fare}`,
      topic: "sistema",
    });
  }
  return stopPath;
}

function tryBoardTransit(world: World, a: Agent): void {
  const vehicle = nearestTransitVehicle(world, a.pos);
  a.transitWaitTicks++;
  if (!vehicle && a.transitWaitTicks < TRANSIT_MAX_WAIT_TICKS) {
    a.prevPos = { ...a.pos };
    return;
  }
  boardTransit(a, vehicle?.id ?? nearestVehicleId(world, a.pos));
}

function boardTransit(a: Agent, vehicleId: number | null): void {
  if (!a.transitDestination) {
    resetTransit(a);
    return;
  }
  const ridePath = findPath(a.pos, a.transitDestination);
  if (ridePath.length === 0) {
    resetTransit(a);
    return;
  }
  a.travelMode = "TRANSITO";
  a.transitPhase = "RIDING";
  a.transitVehicleId = vehicleId;
  a.transitWaitTicks = 0;
  a.path = ridePath;
  a.pathIndex = 0;
}

function resetTransit(a: Agent): void {
  a.travelMode = "CAMINHANDO";
  a.transitPhase = "NONE";
  a.transitDestination = null;
  a.transitVehicleId = null;
  a.transitWaitTicks = 0;
}

function nearestTransitVehicle(world: World, pos: Agent["pos"]): World["vehicles"][number] | null {
  let best: World["vehicles"][number] | null = null;
  let bestDist = Infinity;
  for (const vehicle of world.vehicles) {
    const dist = Math.hypot(vehicle.pos.x - pos.x, vehicle.pos.z - pos.z);
    if (dist <= TRANSIT_BOARD_RADIUS && dist < bestDist) {
      best = vehicle;
      bestDist = dist;
    }
  }
  return best;
}

function nearestVehicleId(world: World, pos: Agent["pos"]): number | null {
  let bestId: number | null = null;
  let bestDist = Infinity;
  for (const vehicle of world.vehicles) {
    const dist = Math.hypot(vehicle.pos.x - pos.x, vehicle.pos.z - pos.z);
    if (dist < bestDist) {
      bestId = vehicle.id;
      bestDist = dist;
    }
  }
  return bestId;
}

function nearestTransitStop(pos: Agent["pos"]): POI | null {
  let best: POI | null = null;
  let bestDist = Infinity;
  for (const poi of POIS) {
    if (poi.kind !== "transporte") continue;
    const dist = Math.hypot(poi.cell.x - pos.x, poi.cell.z - pos.z);
    if (dist < bestDist) {
      bestDist = dist;
      best = poi;
    }
  }
  return best;
}

function useTicksFor(currentVal: number): number {
  return Math.round(20 + (100 - currentVal) * 0.6);
}
