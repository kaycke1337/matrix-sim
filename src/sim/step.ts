import type { World } from "./world";
import {
  needsSystem,
  decisionSystem,
  movementSystem,
  actionSystem,
} from "./systems";
import { socialSystem, emotionDecaySystem } from "./social";

/** Avança o mundo exatamente 1 tick. */
export function step(world: World): void {
  world.clock.tick++;
  needsSystem(world);
  emotionDecaySystem(world);
  decisionSystem(world); // percepção → rede neural → ação + aprendizado
  movementSystem(world);
  socialSystem(world); // interações quando próximos
  actionSystem(world); // usa POI, economia
}
