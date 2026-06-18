import { pushChat, type Institution, type World } from "./world";

const SUPPLY_INTERVAL = 120;
const UNIT_PRICE = 2;

/** Cadeia produtiva simples: produtores abastecem lojas/lazer com estoque baixo. */
export function supplyChainSystem(world: World): void {
  if (world.clock.tick === 0 || world.clock.tick % SUPPLY_INTERVAL !== 0) return;

  const producers = world.institutions.filter(
    (institution) => institution.kind === "trabalho" && institution.stock > 0
  );
  const buyers = world.institutions.filter(
    (institution) =>
      (institution.kind === "loja" || institution.kind === "lazer") &&
      institution.stock < 35 &&
      institution.cash >= UNIT_PRICE
  );

  let transfers = 0;
  for (const buyer of buyers) {
    const producer = richestProducer(producers);
    if (!producer) break;

    const units = Math.min(8, producer.stock, Math.floor(buyer.cash / UNIT_PRICE));
    if (units <= 0) continue;

    producer.stock -= units;
    producer.cash += units * UNIT_PRICE;
    buyer.stock += units;
    buyer.cash -= units * UNIT_PRICE;
    producer.transactions++;
    buyer.transactions++;
    transfers++;
  }

  if (transfers > 0) {
    pushChat(world, {
      tick: world.clock.tick,
      speakerId: null,
      speakerName: "Mercado",
      text: `cadeia produtiva abasteceu ${transfers} lojas`,
      topic: "economia",
    });
  }
}

function richestProducer(producers: Institution[]): Institution | null {
  let best: Institution | null = null;
  for (const producer of producers) {
    if (producer.stock <= 0) continue;
    if (!best || producer.stock > best.stock) best = producer;
  }
  return best;
}
