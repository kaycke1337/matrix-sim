import { create } from "zustand";
import type { ActionKind, FSM, Job } from "../sim/components";

/** Resumo de um relacionamento para o inspetor. */
export interface RelationView {
  name: string;
  afinidade: number;
}

/** Snapshot do agente selecionado (atualizado pelo loop). */
export interface AgentView {
  id: number;
  name: string;
  job: Job;
  workplace: string | null;
  home: string | null;
  householdSize: number;
  money: number;
  age: number;
  fsm: FSM;
  action: ActionKind | null;
  travelMode: string;
  transitPhase: string;
  transitRides: number;
  needs: { energia: number; fome: number; social: number; diversao: number };
  personality: {
    extroversao: number;
    diligencia: number;
    neuroticismo: number;
    sociabilidade: number;
    ambicao: number;
  };
  emotion: { humor: number; stress: number };
  totalReward: number;
  topRelations: RelationView[];
}

export interface ChatView {
  tick: number;
  speakerName: string;
  text: string;
}

interface HudState {
  tick: number;
  dayPhase: number;
  agentCount: number;
  fps: number;
  speed: number;
  toast: string | null;
  glitchUntil: number;
  mayorName: string | null;
  nextElectionIn: number;
  publicBudget: number;
  taxRate: number;
  approval: number;
  campaignCount: number;
  institutionCount: number;
  institutionCash: number;
  vehicleCount: number;
  householdCount: number;
  chat: ChatView[];
  selectedId: number | null;
  selected: AgentView | null;
  set: (s: Partial<HudState>) => void;
  select: (id: number | null) => void;
}

export const useHud = create<HudState>((set) => ({
  tick: 0,
  dayPhase: 0,
  agentCount: 0,
  fps: 0,
  speed: 1,
  toast: null,
  glitchUntil: 0,
  mayorName: null,
  nextElectionIn: 0,
  publicBudget: 0,
  taxRate: 0,
  approval: 0,
  campaignCount: 0,
  institutionCount: 0,
  institutionCash: 0,
  vehicleCount: 0,
  householdCount: 0,
  chat: [],
  selectedId: null,
  selected: null,
  set: (s) => set(s),
  select: (id) => set({ selectedId: id }),
}));
