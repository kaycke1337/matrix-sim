import type { POI, Vec2 } from "./components";

/**
 * Mapa do quarteirão: uma grade WxH.
 * 0 = caminhável (rua/calçada), 1 = bloqueado (prédio).
 * POIs ficam em células caminháveis adjacentes aos prédios.
 */
export const GRID_W = 24;
export const GRID_H = 24;

// Layout: alguns "prédios" (blocos bloqueados) com ruas entre eles.
function buildGrid(): Uint8Array {
  const g = new Uint8Array(GRID_W * GRID_H); // tudo caminhável por padrão
  const blocks: [number, number, number, number][] = [
    // [x, z, largura, altura]
    [3, 3, 4, 4],
    [16, 3, 5, 4],
    [3, 16, 4, 5],
    [15, 15, 6, 6],
    [10, 9, 3, 3],
  ];
  for (const [bx, bz, w, h] of blocks) {
    for (let z = bz; z < bz + h; z++) {
      for (let x = bx; x < bx + w; x++) {
        if (x >= 0 && x < GRID_W && z >= 0 && z < GRID_H) {
          g[z * GRID_W + x] = 1;
        }
      }
    }
  }
  return g;
}

export const GRID = buildGrid();

export function isWalkable(x: number, z: number): boolean {
  if (x < 0 || x >= GRID_W || z < 0 || z >= GRID_H) return false;
  return GRID[z * GRID_W + x] === 0;
}

/** Pontos de interesse do quarteirão. */
export const POIS: POI[] = [
  { id: "cama-a", label: "Casa A", cell: { x: 8, z: 5 }, action: "DORMIR", satisfies: "energia", rate: 6, cost: 0, color: 0x3a6ea5 },
  { id: "cama-b", label: "Casa B", cell: { x: 15, z: 8 }, action: "DORMIR", satisfies: "energia", rate: 6, cost: 0, color: 0x3a6ea5 },
  { id: "cafe", label: "Café", cell: { x: 9, z: 13 }, action: "COMER", satisfies: "fome", rate: 8, cost: 4, color: 0xc77d3a },
  { id: "mercado", label: "Mercado", cell: { x: 21, z: 9 }, action: "COMER", satisfies: "fome", rate: 7, cost: 3, color: 0xc77d3a },
  { id: "praca", label: "Praça", cell: { x: 12, z: 20 }, action: "SOCIALIZAR", satisfies: "social", rate: 7, cost: 0, color: 0x4caf6a },
  { id: "arcade", label: "Arcade", cell: { x: 2, z: 12 }, action: "DIVERTIR", satisfies: "diversao", rate: 9, cost: 5, color: 0x9b59b6 },
  // locais de trabalho (pagam: cost negativo)
  { id: "trabalho-cafe", label: "Balcão Café", cell: { x: 10, z: 13 }, action: "TRABALHAR", satisfies: null, rate: 0, cost: -8, color: 0xd4af37 },
  { id: "trabalho-mercado", label: "Caixa Mercado", cell: { x: 20, z: 9 }, action: "TRABALHAR", satisfies: null, rate: 0, cost: -7, color: 0xd4af37 },
  { id: "atelie", label: "Ateliê", cell: { x: 3, z: 21 }, action: "TRABALHAR", satisfies: null, rate: 0, cost: -6, color: 0xd4af37 },
  { id: "oficina", label: "Oficina", cell: { x: 22, z: 21 }, action: "TRABALHAR", satisfies: null, rate: 0, cost: -9, color: 0xd4af37 },
];

/** Converte célula da grade para coordenada de mundo (centro da célula). */
export function cellToWorld(c: Vec2): Vec2 {
  return { x: c.x - GRID_W / 2 + 0.5, z: c.z - GRID_H / 2 + 0.5 };
}
