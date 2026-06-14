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
    money: a.money,
    age: a.age,
    fsm: a.fsm,
    action: a.currentAction,
    needs: { ...a.needs },
    personality: { ...a.personality },
    emotion: { ...a.emotion },
    totalReward: a.totalReward,
    topRelations: rels.slice(0, 5),
  };
}
