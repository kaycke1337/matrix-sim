import type { Agent, Relation } from "./components";
import type { World } from "./world";
import { clamp } from "./reward";

const INTERACT_RADIUS = 2.2;

function getRelation(a: Agent, otherId: number): Relation {
  let r = a.relations.get(otherId);
  if (!r) {
    r = { afinidade: 0, encontros: 0, ultimoTick: 0 };
    a.relations.set(otherId, r);
  }
  return r;
}

/**
 * Sistema social: quando dois agentes que estão SOCIALIZANDO ficam próximos,
 * interagem. A afinidade muda conforme compatibilidade de personalidade e humor.
 * Emoções (humor/stress) reagem ao encontro. É aqui que nascem amizades e rivalidades.
 */
export function socialSystem(world: World): void {
  const agents = world.agents;
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    for (let j = i + 1; j < agents.length; j++) {
      const b = agents[j];
      const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
      if (d > INTERACT_RADIUS) continue;

      // só interagem de fato se ao menos um quer socializar
      const querem =
        a.currentAction === "SOCIALIZAR" || b.currentAction === "SOCIALIZAR";
      if (!querem) continue;

      interact(world, a, b);
    }
  }
}

function interact(world: World, a: Agent, b: Agent): void {
  const tick = world.clock.tick;
  const ra = getRelation(a, b.id);
  const rb = getRelation(b, a.id);

  // compatibilidade: personalidades parecidas se atraem, opostas atritam.
  const comp =
    1 -
    (Math.abs(a.personality.extroversao - b.personality.extroversao) +
      Math.abs(a.personality.diligencia - b.personality.diligencia) +
      Math.abs(a.personality.neuroticismo - b.personality.neuroticismo)) /
      3;
  // comp em [0,1]; centro 0.6 vira neutro → incompatíveis ficam negativos
  const base = (comp - 0.6) * 0.06;

  // humor influencia: dois felizes se dão melhor; estressados atritam
  const moodBonus = ((a.emotion.humor + b.emotion.humor) / 2) * 0.015;
  const stressMalus = ((a.emotion.stress + b.emotion.stress) / 2) * 0.02;

  const deltaA = (base + moodBonus - stressMalus) * (0.5 + a.personality.sociabilidade);
  const deltaB = (base + moodBonus - stressMalus) * (0.5 + b.personality.sociabilidade);

  ra.afinidade = clamp(ra.afinidade + deltaA, -1, 1);
  rb.afinidade = clamp(rb.afinidade + deltaB, -1, 1);
  ra.encontros++;
  rb.encontros++;
  ra.ultimoTick = tick;
  rb.ultimoTick = tick;

  a.partner = b.id;
  b.partner = a.id;

  // efeito emocional: interação positiva melhora humor e baixa stress
  applyMood(a, ra.afinidade);
  applyMood(b, rb.afinidade);

  // repõe necessidade social
  a.needs.social = clamp(a.needs.social + 1.2, 0, 100);
  b.needs.social = clamp(b.needs.social + 1.2, 0, 100);
}

function applyMood(a: Agent, afinidade: number): void {
  const sign = afinidade >= 0 ? 1 : -1;
  a.emotion.humor = clamp(a.emotion.humor + sign * 0.02, -1, 1);
  a.emotion.stress = clamp(
    a.emotion.stress - 0.01 * (afinidade >= 0 ? 1 : -1),
    0,
    1
  );
}

/** Decai emoções suavemente em direção ao repouso, modulado por neuroticismo. */
export function emotionDecaySystem(world: World): void {
  for (const a of world.agents) {
    // humor volta a 0 devagar
    a.emotion.humor *= 0.999;
    // stress sobe se necessidades estão baixas, cai caso contrário
    let lacks = 0;
    for (const k of ["energia", "fome", "social", "diversao"] as const) {
      if (a.needs[k] < 30) lacks++;
    }
    const stressUp = lacks * 0.004 * (0.5 + a.personality.neuroticismo);
    a.emotion.stress = clamp(a.emotion.stress + stressUp - 0.003, 0, 1);
  }
}
