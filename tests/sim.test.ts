import { describe, it, expect } from "vitest";
import { createWorld } from "../src/sim/world";
import { step } from "../src/sim/step";
import { RNG } from "../src/sim/rng";

function runN(seed: number, n: number) {
  const w = createWorld(seed);
  for (let i = 0; i < n; i++) step(w);
  return w;
}

describe("RNG", () => {
  it("é determinístico para a mesma seed", () => {
    const a = new RNG(42);
    const b = new RNG(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("salva/restaura estado", () => {
    const a = new RNG(7);
    a.next();
    a.next();
    const snap = a.state;
    const x = a.next();
    a.state = snap;
    expect(a.next()).toBe(x);
  });
});

describe("Simulação determinística", () => {
  it("mesma seed → mesmo estado após N ticks", () => {
    const w1 = runN(1337, 500);
    const w2 = runN(1337, 500);
    expect(w1.clock.tick).toBe(500);
    expect(JSON.stringify(serialize(w1))).toBe(JSON.stringify(serialize(w2)));
  });

  it("seeds diferentes → estados diferentes", () => {
    const w1 = runN(1, 300);
    const w2 = runN(2, 300);
    expect(JSON.stringify(serialize(w1))).not.toBe(JSON.stringify(serialize(w2)));
  });

  it("necessidades permanecem em [0,100]", () => {
    const w = runN(99, 1000);
    for (const a of w.agents) {
      for (const k of Object.keys(a.needs) as (keyof typeof a.needs)[]) {
        expect(a.needs[k]).toBeGreaterThanOrEqual(0);
        expect(a.needs[k]).toBeLessThanOrEqual(100);
      }
    }
  });

  it("agentes se movem ao longo do tempo", () => {
    const w = createWorld(555);
    const before = w.agents.map((a) => ({ ...a.pos }));
    for (let i = 0; i < 400; i++) step(w);
    const moved = w.agents.some(
      (a, i) => a.pos.x !== before[i].x || a.pos.z !== before[i].z
    );
    expect(moved).toBe(true);
  });

  it("suporta uma população maior sem quebrar invariantes básicos", () => {
    const w = createWorld(8080, 150);
    for (let i = 0; i < 250; i++) step(w);

    expect(w.agents).toHaveLength(150);
    for (const a of w.agents) {
      expect(Number.isFinite(a.pos.x)).toBe(true);
      expect(Number.isFinite(a.pos.z)).toBe(true);
      expect(a.needs.energia).toBeGreaterThanOrEqual(0);
      expect(a.needs.fome).toBeGreaterThanOrEqual(0);
      expect(a.needs.social).toBeGreaterThanOrEqual(0);
      expect(a.needs.diversao).toBeGreaterThanOrEqual(0);
    }
  });
});

function serialize(w: ReturnType<typeof createWorld>) {
  return {
    tick: w.clock.tick,
    rng: w.rng.state,
    agents: w.agents.map((a) => ({
      id: a.id,
      pos: a.pos,
      needs: a.needs,
      fsm: a.fsm,
    })),
  };
}
