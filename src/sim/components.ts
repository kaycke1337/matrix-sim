import type { Brain } from "./brain";

/** Tipos de necessidade que motivam os agentes. */
export type NeedKey = "energia" | "fome" | "social" | "diversao";

export const NEED_KEYS: NeedKey[] = ["energia", "fome", "social", "diversao"];

/** Estados da máquina de estados do agente. */
export type FSM = "OCIOSO" | "INDO" | "USANDO" | "DORMINDO" | "SOCIALIZANDO";

export type TravelMode = "CAMINHANDO" | "TRANSITO";

export type TransitPhase = "NONE" | "WALK_TO_STOP" | "RIDING";

/** Vetor de posição no plano. */
export interface Vec2 {
  x: number;
  z: number;
}

/**
 * Personalidade — traços estáveis (estilo Big Five), em [0,1].
 * Modulam decisões, recompensas e interações sociais.
 */
export interface Personality {
  extroversao: number; // gosta de socializar
  diligencia: number; // valoriza trabalho/dinheiro
  neuroticismo: number; // sobe stress mais fácil
  sociabilidade: number; // afinidade cresce mais rápido
  ambicao: number; // busca riqueza
}

/** Estado emocional dinâmico, em [0,1] (exceto humor em [-1,1]). */
export interface Emotion {
  humor: number; // -1 (triste) .. 1 (feliz)
  stress: number; // 0..1
}

/**
 * Memória de relacionamento com outro agente.
 * afinidade: -1 (rival) .. 1 (melhor amigo)
 */
export interface Relation {
  afinidade: number;
  encontros: number;
  ultimoTick: number;
}

/** Profissões disponíveis (definem onde se trabalha e quanto paga). */
export type Job = "barista" | "comerciante" | "artista" | "tecnico" | "desempregado";

/** Tipos de ação que a rede neural pode escolher (índice = saída da rede). */
export type ActionKind =
  | "DORMIR"
  | "COMER"
  | "SOCIALIZAR"
  | "DIVERTIR"
  | "TRABALHAR"
  | "VAGUEAR";

export const ACTIONS: ActionKind[] = [
  "DORMIR",
  "COMER",
  "SOCIALIZAR",
  "DIVERTIR",
  "TRABALHAR",
  "VAGUEAR",
];

export type PoiKind =
  | "residencia"
  | "loja"
  | "trabalho"
  | "lazer"
  | "civico"
  | "transporte";

/** Um Ponto de Interesse. */
export interface POI {
  id: string;
  label: string;
  cell: Vec2;
  kind: PoiKind;
  /** que ação esse POI atende */
  action: ActionKind;
  /** necessidade que repõe (se houver) */
  satisfies: NeedKey | null;
  rate: number;
  /** custo monetário por uso (negativo = paga, ex.: trabalho) */
  cost: number;
  color: number;
}

/** Estado completo de um agente. */
export interface Agent {
  id: number;
  name: string;
  color: number;

  pos: Vec2;
  prevPos: Vec2;

  needs: Record<NeedKey, number>;

  // --- novos: cognição e vida interior ---
  personality: Personality;
  emotion: Emotion;
  brain: Brain;
  job: Job;
  money: number;
  homePoiId: string | null;
  householdId: number | null;
  workplacePoiId: string | null;

  // social
  relations: Map<number, Relation>;
  /** com quem está interagindo agora (id) */
  partner: number | null;

  // FSM / navegação
  fsm: FSM;
  currentAction: ActionKind | null;
  targetPoi: string | null;
  path: Vec2[];
  pathIndex: number;
  useTimer: number;
  travelMode: TravelMode;
  transitPhase: TransitPhase;
  transitDestination: Vec2 | null;
  transitRides: number;

  // --- aprendizado: rastros para a recompensa ---
  /** ação escolhida na última decisão (índice) */
  lastActionIdx: number;
  /** percepção usada na última decisão */
  lastPercept: number[];
  /** bem-estar no momento da decisão (para calcular vantagem) */
  lastWellbeing: number;
  /** recompensa acumulada (telemetria) */
  totalReward: number;
  /** idade em ticks */
  age: number;
}
