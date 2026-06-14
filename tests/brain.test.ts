import { describe, it, expect } from "vitest";
import { Brain } from "../src/sim/brain";
import { RNG } from "../src/sim/rng";
import { createWorld } from "../src/sim/world";
import { step } from "../src/sim/step";

describe("Brain (rede neural)", () => {
  it("forward produz distribuição de probabilidade válida", () => {
    const rng = new RNG(1);
    const b = new Brain(13, 16, 6, rng);
    const probs = b.forward(new Array(13).fill(0.5));
    const sum = probs.reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1, 5);
    for (const p of probs) expect(p).toBeGreaterThanOrEqual(0);
  });

  it("aprende: REINFORCE aumenta prob. de ação recompensada", () => {
    const rng = new RNG(7);
    const b = new Brain(4, 8, 3, rng);
    const input = [1, 0, 0, 1];
    const target = 2; // queremos que a rede prefira a ação 2

    const before = b.forward(input)[target];
    for (let i = 0; i < 200; i++) {
      b.forward(input);
      b.learn(target, +1); // sempre recompensa a ação 2
    }
    const after = b.forward(input)[target];
    expect(after).toBeGreaterThan(before);
  });

  it("serializa e restaura pesos identicamente", () => {
    const rng = new RNG(3);
    const b = new Brain(5, 6, 4, rng);
    const data = b.toJSON();
    const b2 = Brain.fromJSON(data);
    const input = [0.1, 0.2, 0.3, 0.4, 0.5];
    const p1 = Array.from(b.forward(input));
    const p2 = Array.from(b2.forward(input));
    expect(p2).toEqual(p1);
  });
});

describe("Universo emergente", () => {
  it("agentes acumulam recompensa e formam relações ao longo do tempo", () => {
    const w = createWorld(2024, 12);
    for (let i = 0; i < 3000; i++) step(w);
    const totalRel = w.agents.reduce((s, a) => s + a.relations.size, 0);
    expect(totalRel).toBeGreaterThan(0); // houve encontros sociais
    // pelo menos um agente teve experiência de aprendizado
    const learned = w.agents.some((a) => Math.abs(a.totalReward) > 0);
    expect(learned).toBe(true);
  });

  it("economia circula: dinheiro varia entre agentes", () => {
    const w = createWorld(99, 12);
    const initial = w.agents.map((a) => a.money);
    for (let i = 0; i < 2000; i++) step(w);
    const changed = w.agents.some((a, i) => a.money !== initial[i]);
    expect(changed).toBe(true);
  });
});
