/** Tipos de necessidade que motivam os agentes. */
export type NeedKey = "energia" | "fome" | "social" | "diversao";

export const NEED_KEYS: NeedKey[] = ["energia", "fome", "social", "diversao"];

/** Estados da máquina de estados do agente. */
export type FSM = "OCIOSO" | "INDO" | "USANDO" | "DORMINDO";

/** Vetor de posição no plano (y é altura, fixa para agentes). */
export interface Vec2 {
  x: number;
  z: number;
}

/** Um Ponto de Interesse: satisfaz uma necessidade quando usado. */
export interface POI {
  id: string;
  label: string;
  cell: Vec2; // célula da grade
  satisfies: NeedKey;
  /** quanto repõe por tick de uso (0..100) */
  rate: number;
  /** cor para o render */
  color: number;
}

/** Estado completo de um agente (entidade). */
export interface Agent {
  id: number;
  name: string;
  color: number;
  /** posição contínua no mundo (em unidades de célula) */
  pos: Vec2;
  /** posição anterior — usada para interpolar no render */
  prevPos: Vec2;
  needs: Record<NeedKey, number>;
  fsm: FSM;
  /** POI alvo atual */
  targetPoi: string | null;
  /** caminho em células a percorrer */
  path: Vec2[];
  pathIndex: number;
  /** timer de uso do POI (ticks restantes) */
  useTimer: number;
}
