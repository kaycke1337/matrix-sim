import type { Agent, Job } from "./components";
import { clamp } from "./reward";
import { findInstitution, pushChat, type Institution, type World } from "./world";

/** De quanto em quanto tempo o mercado de trabalho se reorganiza. */
const LABOR_INTERVAL = 300;
/** Vagas máximas por empregador (limite de contratação dinâmica). */
const MAX_EMPLOYEES = 6;
const WAGE_MIN = 3;
const WAGE_MAX = 18;

/**
 * Mercado de trabalho dinâmico (Fase 7).
 *
 * A cada intervalo:
 *  1. SALÁRIOS ajustam à saúde do empregador — caixa folgado e poucos
 *     funcionários puxam o salário para cima (atrai mão de obra); caixa que
 *     não cobre a folha puxa para baixo.
 *  2. DEMISSÕES quando o caixa não paga nem um salário: corta o funcionário
 *     menos produtivo, que vira "desempregado".
 *  3. CONTRATAÇÃO/TROCA: desempregados aceitam a melhor vaga disponível;
 *     empregados ambiciosos trocam de emprego por salários relevantemente
 *     melhores. Empregadores só contratam se têm vaga e caixa para pagar.
 *
 * Tudo é determinístico (usa world.rng) e aditivo: mexe apenas em campos já
 * serializados (institution.wage/employees, agent.workplacePoiId/job).
 */
export function laborMarketSystem(world: World): void {
  if (world.clock.tick === 0 || world.clock.tick % LABOR_INTERVAL !== 0) return;

  const employers = world.institutions.filter((inst) => inst.kind === "trabalho");
  if (employers.length === 0) return;

  adjustWages(employers);
  layoffs(world, employers);
  hiring(world, employers);
}

/** Mapeia um local de trabalho para a profissão correspondente. */
export function jobForWorkplace(poiId: string | null): Job {
  switch (poiId) {
    case "trabalho-cafe":
      return "barista";
    case "trabalho-mercado":
      return "comerciante";
    case "atelie":
      return "artista";
    case "oficina":
      return "tecnico";
    default:
      return "desempregado";
  }
}

function adjustWages(employers: Institution[]): void {
  for (const employer of employers) {
    const headcount = Math.max(1, employer.employees.length);
    const payroll = headcount * Math.max(1, employer.wage);
    const coverage = employer.cash / payroll; // quantas folhas o caixa cobre

    let delta = 0;
    if (coverage > 3 && employer.employees.length < MAX_EMPLOYEES) {
      delta = 1; // próspero e com vaga → oferece mais para atrair
    } else if (coverage < 1) {
      delta = -1; // não cobre a folha → aperta o salário
    }

    employer.wage = clamp(employer.wage + delta, WAGE_MIN, WAGE_MAX);
  }
}

function layoffs(world: World, employers: Institution[]): void {
  for (const employer of employers) {
    if (employer.employees.length === 0) continue;
    if (employer.cash >= employer.wage) continue; // ainda paga ao menos um

    const fired = leastProductiveEmployee(world, employer);
    if (!fired) continue;

    employer.employees = employer.employees.filter((id) => id !== fired.id);
    fired.workplacePoiId = null;
    fired.job = "desempregado";
    fired.emotion.stress = clamp(fired.emotion.stress + 0.08, 0, 1);
    fired.emotion.humor = clamp(fired.emotion.humor - 0.06, -1, 1);

    pushChat(world, {
      tick: world.clock.tick,
      speakerId: fired.id,
      speakerName: employer.name,
      text: `dispensou ${fired.name} por corte de custos`,
      topic: "economia",
    });
  }
}

function hiring(world: World, employers: Institution[]): void {
  for (const agent of world.agents) {
    const current = findInstitution(world, agent.workplacePoiId);
    const currentWage = current?.wage ?? 0;
    const unemployed = agent.workplacePoiId == null || agent.job === "desempregado";

    let best: Institution | null = null;
    let bestScore = -Infinity;
    for (const employer of employers) {
      if (employer === current) continue;
      if (employer.employees.length >= MAX_EMPLOYEES) continue;
      if (employer.cash < employer.wage * 2) continue; // precisa poder pagar

      const score = employer.wage + agent.personality.ambicao * 2 + world.rng.next() * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = employer;
      }
    }
    if (!best) continue;

    // Desempregado aceita qualquer oferta; empregado só troca por ganho relevante
    // (quanto menos ambicioso, maior o salário extra exigido para se mover).
    const switchThreshold = unemployed
      ? -Infinity
      : currentWage + 2 + (1 - agent.personality.ambicao) * 3;
    if (best.wage < switchThreshold) continue;

    if (current) current.employees = current.employees.filter((id) => id !== agent.id);
    best.employees.push(agent.id);
    agent.workplacePoiId = best.poiId;
    agent.job = jobForWorkplace(best.poiId);
    if (unemployed) {
      agent.emotion.stress = clamp(agent.emotion.stress - 0.05, 0, 1);
      agent.emotion.humor = clamp(agent.emotion.humor + 0.04, -1, 1);
    }

    pushChat(world, {
      tick: world.clock.tick,
      speakerId: agent.id,
      speakerName: agent.name,
      text: unemployed
        ? `foi contratado em ${best.name} por ${best.wage}`
        : `trocou de emprego para ${best.name} por ${best.wage}`,
      topic: "economia",
    });
  }
}

function leastProductiveEmployee(world: World, employer: Institution): Agent | null {
  let worst: Agent | null = null;
  for (const id of employer.employees) {
    const agent = world.agents.find((candidate) => candidate.id === id);
    if (!agent) continue;
    if (!worst || agent.personality.diligencia < worst.personality.diligencia) {
      worst = agent;
    }
  }
  return worst;
}
