import type { Vehicle, World } from "./world";

const ARRIVE_EPS = 0.08;

/** Move veículos em rotas urbanas fechadas. */
export function trafficSystem(world: World): void {
  for (const vehicle of world.vehicles) {
    moveVehicle(vehicle);
  }
}

function moveVehicle(vehicle: Vehicle): void {
  if (vehicle.route.length === 0) return;
  vehicle.prevPos = { ...vehicle.pos };

  const target = vehicle.route[(vehicle.routeIndex + 1) % vehicle.route.length];
  const dx = target.x - vehicle.pos.x;
  const dz = target.z - vehicle.pos.z;
  const dist = Math.hypot(dx, dz);

  if (dist < ARRIVE_EPS) {
    vehicle.pos = { ...target };
    vehicle.routeIndex = (vehicle.routeIndex + 1) % vehicle.route.length;
    return;
  }

  vehicle.pos.x += (dx / dist) * vehicle.speed;
  vehicle.pos.z += (dz / dist) * vehicle.speed;
}
