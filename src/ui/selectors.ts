import type { Agent } from "../sim/components";
import type { World } from "../sim/world";
import type { AgentView, RelationView } from "./store";

/** Constrói o snapshot do agente para o inspetor React. */
export function toAgentView(world: World, a: Agent): AgentView {
  const rels: RelationView[] = [];
  for (const [otherId, r] of a.relations) {
    const other = world.agents.find((x) => x.id === otherId);
    if (other) rels.push({ name: other.name, afinidade: r.afinidade });
  }
  rels.sort((x, y) => Math.abs(y.afinidade) - Math.abs(x.afinidade));

  return {
    id: a.id,
    name: a.name,
    job: a.job,
    workplace:
      world.institutions.find((institution) => institution.poiId === a.workplacePoiId)
        ?.name ?? null,
    home:
      world.households.find((household) => household.id === a.householdId)?.name ??
      null,
    householdSize:
      world.households.find((household) => household.id === a.householdId)?.members
        .length ?? 0,
    money: a.money,
    age: a.age,
    fsm: a.fsm,
    action: a.currentAction,
    travelMode: a.travelMode,
    transitRides: a.transitRides,
    needs: { ...a.needs },
    personality: { ...a.personality },
    emotion: { ...a.emotion },
    totalReward: a.totalReward,
    topRelations: rels.slice(0, 5),
  };
}
