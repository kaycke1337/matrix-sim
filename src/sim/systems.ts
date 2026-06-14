import type { Agent, NeedKey, POI, ActionKind } from "./components";
import { NEED_KEYS, ACTIONS } from "./components";
import { findPath } from "./pathfinding";
import { POIS, isNight, type World } from "./world";
import { perceive } from "./perception";
import { wellbeing, clamp } from "./reward";

const MOVE_SPEED = 0.12;
const ARRIVE_EPS = 0.05;

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
      a.path = path;
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
      const poi = POIS.find((p) => p.id === a.targetPoi);
      if (poi) startUsing(a, poi);
      else a.fsm = "OCIOSO";
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
      // economia: liquida UMA vez ao concluir a atividade (evita inflação)
      if (poi.cost !== 0) {
        if (poi.cost > 0 && a.money < poi.cost) {
          a.emotion.stress = clamp(a.emotion.stress + 0.05, 0, 1);
        } else {
          a.money = Math.max(0, a.money - poi.cost);
        }
      }
      a.fsm = "OCIOSO";
      a.partner = null;
      a.targetPoi = null;
      a.path = [];
      a.pathIndex = 0;
    }
  }
}

// ---- helpers ----

function startUsing(a: Agent, poi: POI): void {
  if (poi.action === "DORMIR") a.fsm = "DORMINDO";
  else if (poi.action === "SOCIALIZAR") a.fsm = "SOCIALIZANDO";
  else a.fsm = "USANDO";
  const baseline = poi.satisfies ? a.needs[poi.satisfies] : 50;
  a.useTimer = useTicksFor(baseline);
}

function pickPoiForAction(world: World, a: Agent, action: ActionKind): POI | null {
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
  const tx = clamp(Math.round(a.pos.x + world.rng.int(-4, 4)), 0, 23);
  const tz = clamp(Math.round(a.pos.z + world.rng.int(-4, 4)), 0, 23);
  const path = findPath(a.pos, { x: tx, z: tz });
  if (path.length > 0) {
    a.path = path;
    a.pathIndex = 0;
    a.targetPoi = null;
    a.fsm = "INDO";
  } else {
    a.fsm = "OCIOSO";
  }
}

function useTicksFor(currentVal: number): number {
  return Math.round(20 + (100 - currentVal) * 0.6);
}
