import { describe, expect, it } from "vitest";
import { createWorld } from "../src/sim/world";
import { step } from "../src/sim/step";
import { deserializeWorld, serializeWorld } from "../src/sim/serialize";
import { publicPolicySystem } from "../src/sim/civilization";

describe("Civilização", () => {
  it("realiza eleições periódicas e persiste o estado cívico", () => {
    const world = createWorld(404, 32);
    world.civics.nextCampaignTick = 1;
    world.civics.nextElectionTick = 1;

    step(world);

    expect(world.stats.eleicoes).toBe(1);
    expect(world.civics.mayorId).not.toBeNull();
    expect(world.civics.mayorName).toBeTruthy();
    expect(world.civics.lastElectionTick).toBe(1);
    expect(world.civics.nextElectionTick).toBeGreaterThan(world.clock.tick);
    expect(world.civics.lastResults.length).toBeGreaterThan(0);
    expect(world.civics.lastResults[0].proposal.taxRate).toBeGreaterThan(0);
    expect(world.civics.policy.taxRate).toBeGreaterThan(0);
    expect(world.civics.policy).toEqual(world.civics.lastResults[0].proposal);
    expect(world.civics.activeProposals).toEqual([]);
    expect(world.civics.budget).toBeGreaterThan(0);
    expect(world.chat.some((message) => message.topic === "politica")).toBe(true);

    const totalVotes = world.civics.lastResults.reduce(
      (sum, result) => sum + result.votes,
      0
    );
    expect(totalVotes).toBe(world.agents.length);

    const restored = deserializeWorld(serializeWorld(world));
    expect(restored.civics).toEqual(world.civics);
    expect(restored.chat).toEqual(world.chat);
    expect(restored.stats.eleicoes).toBe(1);
  });

  it("abre campanha com propostas antes da eleição", () => {
    const world = createWorld(808, 24);
    world.civics.nextCampaignTick = 1;
    world.civics.nextElectionTick = 50;

    step(world);

    expect(world.civics.activeProposals.length).toBeGreaterThan(0);
    expect(world.civics.activeProposals.length).toBeLessThanOrEqual(4);
    expect(
      world.civics.activeProposals.every((proposal) => proposal.policy.taxRate > 0)
    ).toBe(true);
    expect(world.chat.some((message) => message.text.includes("campanha"))).toBe(true);
  });

  it("políticas públicas afetam orçamento, moradores, lojas e transporte", () => {
    const world = createWorld(505, 20);
    world.clock.tick = 200;
    world.civics.budget = 200;
    world.civics.policy = {
      taxRate: 0.12,
      welfare: 0.9,
      transitSubsidy: 0.75,
      marketSupport: 0.75,
    };

    for (let i = 0; i < 3; i++) world.agents[i].money = 1;
    const shop = world.institutions.find((inst) => inst.kind === "loja");
    expect(shop).toBeTruthy();
    if (!shop) return;
    shop.stock = 2;
    shop.priceMultiplier = 1.1;
    const speedBefore = world.vehicles[0].speed;

    publicPolicySystem(world);

    expect(world.agents.slice(0, 3).every((agent) => agent.money > 1)).toBe(true);
    expect(shop.stock).toBeGreaterThan(2);
    expect(shop.priceMultiplier).toBeLessThan(1.1);
    expect(world.vehicles[0].speed).toBeGreaterThan(speedBefore);
    expect(world.civics.budget).toBeLessThan(200);
    expect(world.civics.approval).toBeGreaterThan(0);
    expect(world.chat.length).toBeGreaterThan(0);
  });
});
