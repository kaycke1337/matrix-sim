import type { Agent, Relation } from "./components";
import { POIS, pushChat, TICKS_PER_DAY, type Household, type World } from "./world";
import { clamp } from "./reward";

const FAMILY_TICK_INTERVAL = 50;

/** Relações e custos domésticos: famílias convivem e mantêm a moradia. */
export function householdSystem(world: World): void {
  if (world.clock.tick % FAMILY_TICK_INTERVAL === 0) {
    strengthenHouseholds(world);
  }
  if (world.clock.tick > 0 && world.clock.tick % TICKS_PER_DAY === 0) {
    collectRent(world);
  }
}

function strengthenHouseholds(world: World): void {
  for (const household of world.households) {
    const membersAtHome = agentsAtHome(world, household);
    for (let i = 0; i < membersAtHome.length; i++) {
      for (let j = i + 1; j < membersAtHome.length; j++) {
        const a = membersAtHome[i];
        const b = membersAtHome[j];
        updateFamilyRelation(world, a, b);
        updateFamilyRelation(world, b, a);
        a.needs.social = clamp(a.needs.social + 0.4, 0, 100);
        b.needs.social = clamp(b.needs.social + 0.4, 0, 100);
      }
    }
  }
}

function collectRent(world: World): void {
  for (const household of world.households) {
    const members = household.members
      .map((id) => world.agents.find((agent) => agent.id === id))
      .filter((agent): agent is Agent => Boolean(agent));
    if (members.length === 0) continue;

    const rentShare = household.rent / members.length;
    let paid = 0;
    for (const member of members) {
      const amount = Math.min(member.money, rentShare);
      member.money -= amount;
      paid += amount;
      if (amount < rentShare) member.emotion.stress = clamp(member.emotion.stress + 0.03, 0, 1);
    }
    household.sharedCash += paid;
  }
}

function agentsAtHome(world: World, household: Household): Agent[] {
  const home = POIS.find((poi) => poi.id === household.homePoiId);
  if (!home) return [];
  return household.members
    .map((id) => world.agents.find((agent) => agent.id === id))
    .filter((agent): agent is Agent => {
      if (!agent) return false;
      const dist = Math.hypot(agent.pos.x - home.cell.x, agent.pos.z - home.cell.z);
      return dist <= 2.5;
    });
}

function updateFamilyRelation(world: World, a: Agent, b: Agent): void {
  const relation = getRelation(a, b.id);
  relation.afinidade = clamp(relation.afinidade + 0.015, -1, 1);
  relation.encontros++;
  relation.ultimoTick = world.clock.tick;
  if ((relation.encontros + a.id + b.id) % 19 === 0) {
    pushChat(world, {
      tick: world.clock.tick,
      speakerId: a.id,
      speakerName: a.name,
      text: `conversou em casa com ${b.name}`,
      topic: "social",
    });
  }
}

function getRelation(a: Agent, otherId: number): Relation {
  let relation = a.relations.get(otherId);
  if (!relation) {
    relation = { afinidade: 0, encontros: 0, ultimoTick: 0 };
    a.relations.set(otherId, relation);
  }
  return relation;
}
