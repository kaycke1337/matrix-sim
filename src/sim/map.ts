import type { POI, Vec2 } from "./components";

/**
 * Distrito urbano em grade.
 * 0 = caminhável (rua/calçada/praça), 1 = bloqueado (prédio).
 * POIs ficam em células caminháveis adjacentes aos prédios.
 */
export const GRID_W = 48;
export const GRID_H = 48;

// Layout: quadras bloqueadas com avenidas regulares para suportar escala.
function buildGrid(): Uint8Array {
  const g = new Uint8Array(GRID_W * GRID_H); // tudo caminhável por padrão
  const blocks: [number, number, number, number][] = [
    // [x, z, largura, altura]
    [3, 3, 5, 5],
    [11, 3, 6, 5],
    [22, 3, 6, 5],
    [35, 3, 7, 5],
    [3, 12, 6, 6],
    [14, 13, 5, 5],
    [28, 12, 6, 7],
    [38, 13, 6, 5],
    [3, 25, 7, 6],
    [15, 24, 6, 7],
    [27, 25, 7, 6],
    [39, 24, 5, 7],
    [6, 37, 7, 6],
    [20, 37, 6, 6],
    [32, 36, 8, 7],
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

/** Pontos de interesse do distrito. */
export const POIS: POI[] = [
  { id: "casa-norte", label: "Residencial Norte", kind: "residencia", cell: { x: 9, z: 5 }, action: "DORMIR", satisfies: "energia", rate: 6, cost: 0, color: 0x3a6ea5 },
  { id: "casa-leste", label: "Residencial Leste", kind: "residencia", cell: { x: 34, z: 9 }, action: "DORMIR", satisfies: "energia", rate: 6, cost: 0, color: 0x3a6ea5 },
  { id: "casa-sul", label: "Residencial Sul", kind: "residencia", cell: { x: 18, z: 36 }, action: "DORMIR", satisfies: "energia", rate: 6, cost: 0, color: 0x3a6ea5 },
  { id: "cafe-central", label: "Café Central", kind: "loja", cell: { x: 23, z: 16 }, action: "COMER", satisfies: "fome", rate: 8, cost: 4, color: 0xc77d3a },
  { id: "mercado-oeste", label: "Mercado Oeste", kind: "loja", cell: { x: 10, z: 22 }, action: "COMER", satisfies: "fome", rate: 7, cost: 3, color: 0xc77d3a },
  { id: "padaria-leste", label: "Padaria Leste", kind: "loja", cell: { x: 38, z: 20 }, action: "COMER", satisfies: "fome", rate: 7, cost: 4, color: 0xc77d3a },
  { id: "praca-central", label: "Praça Central", kind: "civico", cell: { x: 24, z: 24 }, action: "SOCIALIZAR", satisfies: "social", rate: 7, cost: 0, color: 0x4caf6a },
  { id: "parque-sul", label: "Parque Sul", kind: "lazer", cell: { x: 31, z: 41 }, action: "SOCIALIZAR", satisfies: "social", rate: 6, cost: 0, color: 0x4caf6a },
  { id: "arcade", label: "Arcade", kind: "lazer", cell: { x: 5, z: 20 }, action: "DIVERTIR", satisfies: "diversao", rate: 9, cost: 5, color: 0x9b59b6 },
  { id: "cinema", label: "Cinema", kind: "lazer", cell: { x: 43, z: 34 }, action: "DIVERTIR", satisfies: "diversao", rate: 8, cost: 6, color: 0x9b59b6 },
  { id: "prefeitura", label: "Prefeitura", kind: "civico", cell: { x: 24, z: 27 }, action: "SOCIALIZAR", satisfies: "social", rate: 5, cost: 0, color: 0x6ee7b7 },
  // locais de trabalho (pagam: cost negativo)
  { id: "trabalho-cafe", label: "Balcão Café", kind: "trabalho", cell: { x: 24, z: 16 }, action: "TRABALHAR", satisfies: null, rate: 0, cost: -8, color: 0xd4af37 },
  { id: "trabalho-mercado", label: "Caixa Mercado", kind: "trabalho", cell: { x: 11, z: 22 }, action: "TRABALHAR", satisfies: null, rate: 0, cost: -7, color: 0xd4af37 },
  { id: "atelie", label: "Ateliê", kind: "trabalho", cell: { x: 14, z: 42 }, action: "TRABALHAR", satisfies: null, rate: 0, cost: -6, color: 0xd4af37 },
  { id: "oficina", label: "Oficina", kind: "trabalho", cell: { x: 40, z: 42 }, action: "TRABALHAR", satisfies: null, rate: 0, cost: -9, color: 0xd4af37 },
  { id: "terminal", label: "Terminal", kind: "transporte", cell: { x: 45, z: 6 }, action: "VAGUEAR", satisfies: null, rate: 0, cost: 0, color: 0x93c5fd },
];

/** Converte célula da grade para coordenada de mundo (centro da célula). */
export function cellToWorld(c: Vec2): Vec2 {
  return { x: c.x - GRID_W / 2 + 0.5, z: c.z - GRID_H / 2 + 0.5 };
}
