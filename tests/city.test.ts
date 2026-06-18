import { describe, expect, it } from "vitest";
import { POIS, GRID_H, GRID_W, isWalkable } from "../src/sim/map";
import { createWorld, findInstitution } from "../src/sim/world";
import { actionSystem, decisionSystem } from "../src/sim/systems";
import { step } from "../src/sim/step";
import { deserializeWorld, serializeWorld } from "../src/sim/serialize";
import { householdSystem } from "../src/sim/household";
import { supplyChainSystem } from "../src/sim/economy";

describe("Cidade e instituições", () => {
  it("expande o mundo para um distrito com POIs caminháveis", () => {
    expect(GRID_W).toBeGreaterThanOrEqual(48);
    expect(GRID_H).toBeGreaterThanOrEqual(48);
    expect(POIS.length).toBeGreaterThanOrEqual(16);

    for (const poi of POIS) {
      expect(isWalkable(poi.cell.x, poi.cell.z), poi.id).toBe(true);
    }
  });

  it("cria instituições persistentes a partir dos POIs urbanos", () => {
    const world = createWorld(707, 20);
    expect(world.institutions.length).toBeGreaterThanOrEqual(10);
    expect(world.institutions.some((inst) => inst.kind === "loja")).toBe(true);
    expect(world.institutions.some((inst) => inst.kind === "civico")).toBe(true);
    expect(world.agents.every((agent) => agent.workplacePoiId)).toBe(true);
    expect(world.agents.every((agent) => agent.homePoiId && agent.householdId)).toBe(true);
    expect(world.households.every((household) => household.members.length > 0)).toBe(true);
    expect(
      world.institutions.some((inst) => inst.wage > 0 && inst.employees.length > 0)
    ).toBe(true);

    const restored = deserializeWorld(serializeWorld(world));
    expect(restored.institutions).toEqual(world.institutions);
    expect(restored.agents.map((agent) => agent.workplacePoiId)).toEqual(
      world.agents.map((agent) => agent.workplacePoiId)
    );
    expect(restored.households).toEqual(world.households);
  });

  it("compras movimentam caixa, estoque e renda do dono", () => {
    const world = createWorld(909, 12);
    const cafe = findInstitution(world, "cafe-central");
    expect(cafe).toBeTruthy();
    if (!cafe) return;

    const buyer = world.agents.find((agent) => agent.id !== cafe.ownerId)!;
    const owner = world.agents.find((agent) => agent.id === cafe.ownerId);
    buyer.money = 50;
    cafe.cash = 20;
    cafe.stock = 5;
    cafe.priceMultiplier = 1;
    world.civics.policy.taxRate = 0.1;
    world.civics.budget = 100;
    buyer.fsm = "USANDO";
    buyer.targetPoi = "cafe-central";
    buyer.currentAction = "COMER";
    buyer.useTimer = 1;

    const ownerMoney = owner?.money ?? 0;
    actionSystem(world);

    expect(buyer.money).toBe(46);
    expect(cafe.cash).toBeCloseTo(23.6);
    expect(cafe.stock).toBe(4);
    expect(cafe.transactions).toBe(1);
    expect(world.civics.budget).toBeCloseTo(100.4);
    if (owner) expect(owner.money).toBeCloseTo(ownerMoney + 0.9);
  });

  it("veículos trafegam pelo distrito e persistem", () => {
    const world = createWorld(606, 10);
    const before = world.vehicles.map((vehicle) => ({ ...vehicle.pos }));
    for (let i = 0; i < 20; i++) step(world);

    expect(world.vehicles.length).toBeGreaterThan(0);
    expect(
      world.vehicles.some(
        (vehicle, index) =>
          vehicle.pos.x !== before[index].x || vehicle.pos.z !== before[index].z
      )
    ).toBe(true);

    const restored = deserializeWorld(serializeWorld(world));
    expect(restored.vehicles).toEqual(world.vehicles);
  });

  it("agentes usam transporte subsidiado em trajetos longos", () => {
    const world = createWorld(7070, 1);
    const agent = world.agents[0];
    agent.pos = { x: 45, z: 45 };
    agent.prevPos = { ...agent.pos };
    agent.money = 20;
    agent.fsm = "OCIOSO";
    world.civics.budget = 100;
    world.civics.policy.transitSubsidy = 0.75;
    agent.brain.sample = () => 1; // COMER

    decisionSystem(world);

    expect(agent.travelMode).toBe("CAMINHANDO");
    expect(agent.transitPhase).toBe("WALK_TO_STOP");
    expect(agent.transitDestination).toBeTruthy();
    expect(agent.transitRides).toBe(1);
    expect(agent.money).toBeLessThan(20);
    expect(world.civics.budget).toBeLessThan(100);

    const restored = deserializeWorld(serializeWorld(world));
    expect(restored.agents[0].transitPhase).toBe("WALK_TO_STOP");
    expect(restored.agents[0].transitDestination).toEqual(agent.transitDestination);
    expect(restored.agents[0].transitRides).toBe(1);

    let guard = 0;
    while (agent.transitPhase === "WALK_TO_STOP" && guard < 700) {
      step(world);
      guard++;
    }
    expect(agent.transitPhase).toBe("WAITING");
    expect(agent.travelMode).toBe("CAMINHANDO");

    const vehicle = world.vehicles[0];
    vehicle.pos = { ...agent.pos };
    vehicle.prevPos = { ...agent.pos };
    step(world);

    expect(agent.transitPhase).toBe("RIDING");
    expect(agent.travelMode).toBe("TRANSITO");
    expect(agent.transitVehicleId).toBe(vehicle.id);

    const ridingSave = deserializeWorld(serializeWorld(world));
    expect(ridingSave.agents[0].transitVehicleId).toBe(vehicle.id);
    expect(ridingSave.agents[0].transitWaitTicks).toBe(0);
  });

  it("agentes trabalham no próprio vínculo e recebem salário institucional", () => {
    const world = createWorld(9090, 8);
    const agent = world.agents[0];
    const workplace = world.institutions.find(
      (inst) => inst.poiId === agent.workplacePoiId
    );
    expect(workplace).toBeTruthy();
    if (!workplace) return;

    agent.pos = { x: 0, z: 0 };
    agent.prevPos = { ...agent.pos };
    agent.money = 10;
    agent.fsm = "OCIOSO";
    agent.brain.sample = () => 4; // TRABALHAR
    workplace.cash = 100;
    workplace.wage = 11;
    world.civics.policy.taxRate = 0.1;
    world.civics.policy.transitSubsidy = 0;
    world.civics.budget = 50;

    decisionSystem(world);
    expect(agent.targetPoi).toBe(workplace.poiId);

    agent.fsm = "USANDO";
    agent.useTimer = 1;
    actionSystem(world);

    expect(agent.money).toBeCloseTo(20.615);
    expect(workplace.cash).toBe(89);
    expect(workplace.stock).toBeGreaterThan(0);
    expect(world.civics.budget).toBeCloseTo(50.385);
  });

  it("agentes dormem na própria casa", () => {
    const world = createWorld(3030, 4);
    const agent = world.agents[0];
    agent.pos = { x: 45, z: 45 };
    agent.prevPos = { ...agent.pos };
    agent.fsm = "OCIOSO";
    agent.brain.sample = () => 0; // DORMIR

    decisionSystem(world);

    expect(agent.targetPoi).toBe(agent.homePoiId);
  });

  it("moradores da mesma casa fortalecem relação familiar", () => {
    const world = createWorld(4040, 8);
    const household = world.households.find((home) => home.members.length >= 2);
    expect(household).toBeTruthy();
    if (!household) return;
    const homePoi = POIS.find((poi) => poi.id === household.homePoiId);
    expect(homePoi).toBeTruthy();
    if (!homePoi) return;

    const [aId, bId] = household.members;
    const a = world.agents.find((agent) => agent.id === aId)!;
    const b = world.agents.find((agent) => agent.id === bId)!;
    a.pos = { ...homePoi.cell };
    b.pos = { ...homePoi.cell };
    world.clock.tick = 50;

    householdSystem(world);

    expect(a.relations.get(b.id)?.afinidade).toBeGreaterThan(0);
    expect(b.relations.get(a.id)?.afinidade).toBeGreaterThan(0);
  });

  it("cadeia produtiva abastece lojas a partir de produtores", () => {
    const world = createWorld(5050, 12);
    const producer = world.institutions.find((inst) => inst.kind === "trabalho");
    const shop = world.institutions.find((inst) => inst.kind === "loja");
    expect(producer).toBeTruthy();
    expect(shop).toBeTruthy();
    if (!producer || !shop) return;

    producer.stock = 20;
    producer.cash = 10;
    shop.stock = 1;
    shop.cash = 50;
    world.clock.tick = 120;

    supplyChainSystem(world);

    expect(producer.stock).toBeLessThan(20);
    expect(producer.cash).toBeGreaterThan(10);
    expect(shop.stock).toBeGreaterThan(1);
    expect(shop.cash).toBeLessThan(50);
    expect(world.chat.some((message) => message.speakerName === "Mercado")).toBe(true);
  });
});
