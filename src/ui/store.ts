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
  money: number;
  age: number;
  fsm: FSM;
  action: ActionKind | null;
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

interface HudState {
  tick: number;
  dayPhase: number;
  agentCount: number;
  fps: number;
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
  selectedId: null,
  selected: null,
  set: (s) => set(s),
  select: (id) => set({ selectedId: id }),
}));
