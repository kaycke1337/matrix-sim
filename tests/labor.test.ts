import { describe, expect, it } from "vitest";
import { createWorld, findInstitution, type Institution } from "../src/sim/world";
import { jobForWorkplace, laborMarketSystem } from "../src/sim/labor";
import { serializeWorld, deserializeWorld } from "../src/sim/serialize";
import { step } from "../src/sim/step";

function employers(world: ReturnType<typeof createWorld>): Institution[] {
  return world.institutions.filter((inst) => inst.kind === "trabalho");
}

describe("Mercado de trabalho dinâmico", () => {
  it("empregador próspero com vaga aumenta o salário para atrair", () => {
    const world = createWorld(111, 12);
    const target = employers(world).find((e) => e.employees.length <= 4)!;
    expect(target).toBeTruthy();
    target.wage = 8;
    target.cash = 8 * 30; // caixa folgado: cobre muitas folhas
    const before = target.wage;

    world.clock.tick = 300;
    laborMarketSystem(world);

    expect(target.wage).toBe(before + 1);
  });

  it("empregador sem caixa corta salário e demite o menos produtivo", () => {
    const world = createWorld(222, 12);
    // Todos os empregadores ficam sem caixa: ninguém consegue contratar.
    for (const e of employers(world)) {
      e.cash = 5;
      e.wage = 8;
    }
    const target = employers(world).find((e) => e.employees.length >= 1)!;
    expect(target).toBeTruthy();
    const before = [...target.employees];

    world.clock.tick = 300;
    laborMarketSystem(world);

    expect(target.wage).toBe(7); // coverage < 1 → corta salário
    expect(target.employees.length).toBe(before.length - 1);

    const goneId = before.find((id) => !target.employees.includes(id))!;
    const gone = world.agents.find((a) => a.id === goneId)!;
    expect(gone.workplacePoiId).toBeNull();
    expect(gone.job).toBe("desempregado");
  });

  it("desempregado é contratado por empregador com vaga e caixa", () => {
    const world = createWorld(333, 12);
    for (const e of employers(world)) e.cash = 200; // todos podem pagar

    const agent = world.agents[0];
    // Demite manualmente o agente de qualquer vínculo atual.
    for (const e of employers(world)) {
      e.employees = e.employees.filter((id) => id !== agent.id);
    }
    agent.workplacePoiId = null;
    agent.job = "desempregado";

    world.clock.tick = 300;
    laborMarketSystem(world);

    expect(agent.workplacePoiId).not.toBeNull();
    expect(agent.job).not.toBe("desempregado");
    expect(jobForWorkplace(agent.workplacePoiId)).toBe(agent.job);
    const employer = findInstitution(world, agent.workplacePoiId)!;
    expect(employer.employees).toContain(agent.id);
  });

  it("emprego sobrevive ao save após o mercado reorganizar", () => {
    const world = createWorld(444, 14);
    for (let i = 0; i < 320; i++) step(world); // passa do primeiro ciclo (tick 300)

    const restored = deserializeWorld(serializeWorld(world));
    expect(restored.agents.map((a) => a.workplacePoiId)).toEqual(
      world.agents.map((a) => a.workplacePoiId)
    );
    expect(restored.agents.map((a) => a.job)).toEqual(world.agents.map((a) => a.job));
    expect(restored.institutions).toEqual(world.institutions);
  });

  it("não roda fora do intervalo de reorganização", () => {
    const world = createWorld(555, 12);
    const snapshot = employers(world).map((e) => ({ wage: e.wage, n: e.employees.length }));

    world.clock.tick = 301; // não múltiplo de 300
    laborMarketSystem(world);

    employers(world).forEach((e, i) => {
      expect(e.wage).toBe(snapshot[i].wage);
      expect(e.employees.length).toBe(snapshot[i].n);
    });
  });
});
