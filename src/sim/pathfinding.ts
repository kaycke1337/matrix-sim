import type { Vec2 } from "./components";
import { GRID_W, isWalkable } from "./map";

/** A* numa grade 4-direções. Retorna lista de células (exclui o start). */
export function findPath(start: Vec2, goal: Vec2): Vec2[] {
  const sx = Math.round(start.x);
  const sz = Math.round(start.z);
  const gx = Math.round(goal.x);
  const gz = Math.round(goal.z);

  if (!isWalkable(gx, gz)) return [];
  if (sx === gx && sz === gz) return [];

  const idx = (x: number, z: number) => z * GRID_W + x;
  const open: number[] = [idx(sx, sz)];
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>([[idx(sx, sz), 0]]);
  const fScore = new Map<number, number>([[idx(sx, sz), heur(sx, sz, gx, gz)]]);
  const goalId = idx(gx, gz);

  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (open.length > 0) {
    // pega nó com menor fScore (busca linear — grade pequena)
    let bestI = 0;
    let bestF = Infinity;
    for (let i = 0; i < open.length; i++) {
      const f = fScore.get(open[i]) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        bestI = i;
      }
    }
    const current = open.splice(bestI, 1)[0];

    if (current === goalId) {
      return reconstruct(cameFrom, current);
    }

    const cx = current % GRID_W;
    const cz = Math.floor(current / GRID_W);

    for (const [dx, dz] of neighbors) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (!isWalkable(nx, nz)) continue;
      const nId = idx(nx, nz);
      const tentative = (gScore.get(current) ?? Infinity) + 1;
      if (tentative < (gScore.get(nId) ?? Infinity)) {
        cameFrom.set(nId, current);
        gScore.set(nId, tentative);
        fScore.set(nId, tentative + heur(nx, nz, gx, gz));
        if (!open.includes(nId)) open.push(nId);
      }
    }
  }
  return []; // sem caminho
}

function heur(x: number, z: number, gx: number, gz: number): number {
  return Math.abs(x - gx) + Math.abs(z - gz); // Manhattan
}

function reconstruct(cameFrom: Map<number, number>, current: number): Vec2[] {
  const path: Vec2[] = [];
  let cur: number | undefined = current;
  while (cur !== undefined) {
    path.push({ x: cur % GRID_W, z: Math.floor(cur / GRID_W) });
    cur = cameFrom.get(cur);
  }
  path.reverse();
  path.shift(); // remove a célula inicial
  return path;
}
