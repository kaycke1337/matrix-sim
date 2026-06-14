import type { Agent } from "./components";
import { NEED_KEYS } from "./components";

/**
 * Bem-estar global do agente em [0,1]: média das necessidades + dinheiro +
 * humor - stress, ponderado pela personalidade. É a base da RECOMPENSA:
 * a recompensa de uma decisão é a variação do bem-estar desde a decisão anterior.
 */
export function wellbeing(a: Agent): number {
  let needAvg = 0;
  for (const k of NEED_KEYS) needAvg += a.needs[k];
  needAvg /= NEED_KEYS.length * 100; // 0..1

  const moneyTerm = clamp01(a.money / 80); // saturação ~80
  const emoTerm = (a.emotion.humor + 1) / 2; // -1..1 -> 0..1
  const stressPenalty = a.emotion.stress;

  // pesos modulados pela personalidade
  const wMoney = 0.15 + a.personality.ambicao * 0.25;
  const wNeed = 0.55;
  const wEmo = 0.2;

  const raw =
    wNeed * needAvg +
    wMoney * moneyTerm +
    wEmo * emoTerm -
    0.15 * stressPenalty;

  return clamp01(raw);
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
