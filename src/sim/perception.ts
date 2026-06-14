import type { Agent } from "./components";
import { NEED_KEYS } from "./components";
import { dayPhase, isNight, type World } from "./world";
import { clamp01 } from "./reward";

/**
 * Constrói o vetor de percepção (entrada da rede neural), tamanho PERCEPT_SIZE=13.
 * Tudo normalizado ~[0,1] ou [-1,1]. Esta é a "visão de mundo" do agente.
 */
export function perceive(world: World, a: Agent): number[] {
  const p: number[] = [];

  // 4 necessidades (0..1)
  for (const k of NEED_KEYS) p.push(a.needs[k] / 100);

  // dinheiro (saturado)
  p.push(clamp01(a.money / 80));

  // emoção
  p.push((a.emotion.humor + 1) / 2);
  p.push(a.emotion.stress);

  // tempo: seno/cosseno do dia (contínuo, sem descontinuidade)
  const ph = dayPhase(world.clock) * Math.PI * 2;
  p.push((Math.sin(ph) + 1) / 2);
  p.push((Math.cos(ph) + 1) / 2);
  p.push(isNight(world.clock) ? 1 : 0);

  // personalidade-chave (dá "viés" estável à rede)
  p.push(a.personality.extroversao);
  p.push(a.personality.diligencia);

  // densidade social: quantos agentes por perto (0..1)
  let perto = 0;
  for (const o of world.agents) {
    if (o.id === a.id) continue;
    const d = Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z);
    if (d < 4) perto++;
  }
  p.push(clamp01(perto / 5));

  return p; // length 13
}
