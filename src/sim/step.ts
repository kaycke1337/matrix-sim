import type { World } from "./world";
import {
  needsSystem,
  decisionSystem,
  movementSystem,
  actionSystem,
} from "./systems";
import { socialSystem, emotionDecaySystem } from "./social";
import { electionSystem, publicPolicySystem } from "./civilization";
import { trafficSystem } from "./traffic";
import { householdSystem } from "./household";
import { supplyChainSystem } from "./economy";
import { laborMarketSystem } from "./labor";

/** Avança o mundo exatamente 1 tick. */
export function step(world: World): void {
  world.clock.tick++;
  needsSystem(world);
  emotionDecaySystem(world);
  decisionSystem(world); // percepção → rede neural → ação + aprendizado
  movementSystem(world);
  trafficSystem(world); // tráfego urbano em rotas
  socialSystem(world); // interações quando próximos
  householdSystem(world); // famílias, moradia e aluguel
  electionSystem(world); // instituições cívicas emergentes
  publicPolicySystem(world); // orçamento, impostos e serviços públicos
  supplyChainSystem(world); // produção e abastecimento entre instituições
  laborMarketSystem(world); // salários, demissões e contratação dinâmicas
  actionSystem(world); // usa POI, economia
}
