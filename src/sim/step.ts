import type { World } from "./world";
import { needsSystem, aiSystem, movementSystem, actionSystem } from "./systems";

/** Avança o mundo exatamente 1 tick (determinístico). */
export function step(world: World): void {
  world.clock.tick++;
  needsSystem(world);
  aiSystem(world);
  movementSystem(world);
  actionSystem(world);
}
