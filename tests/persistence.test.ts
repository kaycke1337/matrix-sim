import { describe, it, expect } from "vitest";
import { createWorld } from "../src/sim/world";
import { step } from "../src/sim/step";
import { serializeWorld, deserializeWorld } from "../src/sim/serialize";

function snapshot(w: ReturnType<typeof createWorld>) {
  return JSON.stringify(serializeWorld(w));
}

describe("Persistência (round-trip)", () => {
  it("serializa e desserializa preservando o estado", () => {
    const w = createWorld(2024, 12);
    for (let i = 0; i < 1500; i++) step(w);

    const data = serializeWorld(w);
    const w2 = deserializeWorld(data);

    // estrutura básica
    expect(w2.clock.tick).toBe(w.clock.tick);
    expect(w2.nextId).toBe(w.nextId);
    expect(w2.rng.state).toBe(w.rng.state);
    expect(w2.agents.length).toBe(w.agents.length);

    // snapshot completo idêntico
    expect(snapshot(w2)).toBe(snapshot(w));
  });

  it("preserva os PESOS das redes neurais exatamente", () => {
    const w = createWorld(7, 8);
    for (let i = 0; i < 800; i++) step(w);
    const w2 = deserializeWorld(serializeWorld(w));

    for (let i = 0; i < w.agents.length; i++) {
      const b1 = w.agents[i].brain;
      const b2 = w2.agents[i].brain;
      expect(Array.from(b2.w1)).toEqual(Array.from(b1.w1));
      expect(Array.from(b2.w2)).toEqual(Array.from(b1.w2));
      // mesma decisão para a mesma percepção
      const input = w.agents[i].lastPercept.length
        ? w.agents[i].lastPercept
        : new Array(13).fill(0.5);
      expect(Array.from(b2.forward(input))).toEqual(Array.from(b1.forward(input)));
    }
  });

  it("preserva relações (Map) e personalidade", () => {
    const w = createWorld(2024, 12);
    for (let i = 0; i < 2000; i++) step(w);
    const w2 = deserializeWorld(serializeWorld(w));

    for (let i = 0; i < w.agents.length; i++) {
      expect(w2.agents[i].relations.size).toBe(w.agents[i].relations.size);
      expect(w2.agents[i].personality).toEqual(w.agents[i].personality);
      for (const [id, r] of w.agents[i].relations) {
        expect(w2.agents[i].relations.get(id)).toEqual(r);
      }
    }
  });

  it("continuar após carregar produz a MESMA evolução", () => {
    const w = createWorld(123, 10);
    for (let i = 0; i < 500; i++) step(w);

    // ramo A: continua direto
    const wA = deserializeWorld(serializeWorld(w));
    // ramo B: salva, carrega, continua
    const wB = deserializeWorld(serializeWorld(w));

    for (let i = 0; i < 300; i++) {
      step(wA);
      step(wB);
    }
    expect(snapshot(wB)).toBe(snapshot(wA));
  });

  it("rejeita versão de save incompatível", () => {
    const w = createWorld(1, 4);
    const data = serializeWorld(w);
    data.version = 999;
    expect(() => deserializeWorld(data)).toThrow();
  });
});
