import { describe, expect, it } from "vitest";
import {
  addAgent,
  addAgents,
  injectEvent,
  removeAgent,
} from "../src/sim/architect";
import { createWorld } from "../src/sim/world";
import { POIS } from "../src/sim/map";

describe("Modo Arquiteto", () => {
  it("cria agentes mantendo ids e estatísticas consistentes", () => {
    const world = createWorld(10, 2);
    const beforeNextId = world.nextId;
    const beforeCount = world.agents.length;
    const beforeBirths = world.stats.nascimentos;

    const agent = addAgent(world);

    expect(world.agents.length).toBe(beforeCount + 1);
    expect(agent.id).toBe(beforeNextId);
    expect(world.nextId).toBe(beforeNextId + 1);
    expect(world.stats.nascimentos).toBe(beforeBirths + 1);
    expect(world.agents.at(-1)).toBe(agent);
  });

  it("cria agentes em lote", () => {
    const world = createWorld(10, 2);
    const created = addAgents(world, 25);

    expect(created).toHaveLength(25);
    expect(world.agents).toHaveLength(27);
    expect(world.nextId).toBe(28);
    expect(world.stats.nascimentos).toBe(27);
    expect(new Set(created.map((agent) => agent.id)).size).toBe(25);
  });

  it("remove agentes e limpa relações órfãs", () => {
    const world = createWorld(11, 3);
    const [a, b, c] = world.agents;
    a.relations.set(b.id, { afinidade: 0.8, encontros: 3, ultimoTick: 20 });
    c.relations.set(b.id, { afinidade: -0.4, encontros: 1, ultimoTick: 21 });
    a.partner = b.id;
    c.partner = b.id;

    const removed = removeAgent(world, b.id);

    expect(removed?.id).toBe(b.id);
    expect(world.agents.map((agent) => agent.id)).not.toContain(b.id);
    expect(world.stats.mortes).toBe(1);
    expect(a.relations.has(b.id)).toBe(false);
    expect(c.relations.has(b.id)).toBe(false);
    expect(a.partner).toBeNull();
    expect(c.partner).toBeNull();
  });

  it("injeta blecaute interrompendo rotinas e afetando emoções", () => {
    const world = createWorld(12, 1);
    const agent = world.agents[0];
    agent.fsm = "USANDO";
    agent.currentAction = "DIVERTIR";
    agent.targetPoi = "arcade";
    agent.path = [{ x: 1, z: 1 }];
    agent.pathIndex = 0;
    agent.useTimer = 10;
    agent.emotion.stress = 0.2;
    agent.emotion.humor = 0.1;
    agent.needs.energia = 50;

    injectEvent(world, "BLECAUTE");

    expect(agent.fsm).toBe("OCIOSO");
    expect(agent.currentAction).toBeNull();
    expect(agent.targetPoi).toBeNull();
    expect(agent.path).toEqual([]);
    expect(agent.emotion.stress).toBeCloseTo(0.38);
    expect(agent.emotion.humor).toBeCloseTo(0.02);
    expect(agent.needs.energia).toBe(46);
  });

  it("injeta festa na praça enviando agentes dispostos para socializar", () => {
    const world = createWorld(13, 2);
    const originalNext = world.rng.next;
    world.rng.next = () => 0;

    injectEvent(world, "FESTA_PRACA");

    world.rng.next = originalNext;
    const plaza = POIS.find((poi) => poi.id === "praca-central");
    for (const agent of world.agents) {
      expect(agent.currentAction).toBe("SOCIALIZAR");
      expect(agent.targetPoi).toBe(plaza?.id);
      expect(agent.fsm === "INDO" || agent.fsm === "SOCIALIZANDO").toBe(true);
      expect(agent.emotion.humor).toBeGreaterThan(0);
      expect(agent.emotion.stress).toBeLessThanOrEqual(0.2);
    }
  });
});
