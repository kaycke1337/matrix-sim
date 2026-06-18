import type { Agent } from "./components";
import { clamp } from "./reward";
import {
  createInitialCivics,
  pushChat,
  TICKS_PER_DAY,
  type CandidateProposal,
  type CivicPolicy,
  type ElectionResult,
  type World,
} from "./world";

const CANDIDATE_COUNT = 4;
const ELECTION_INTERVAL = TICKS_PER_DAY * 2;
const POLICY_INTERVAL = 200;

/** Sistema cívico: eleições periódicas criam uma instituição política persistente. */
export function electionSystem(world: World): void {
  if (
    world.clock.tick >= world.civics.nextCampaignTick &&
    world.civics.activeProposals.length === 0
  ) {
    runCampaign(world);
  }

  if (world.clock.tick < world.civics.nextElectionTick) return;
  if (world.agents.length === 0) {
    world.civics.nextElectionTick += ELECTION_INTERVAL;
    world.civics.nextCampaignTick =
      world.civics.nextElectionTick - Math.round(ELECTION_INTERVAL * 0.25);
    return;
  }

  if (world.civics.activeProposals.length === 0) runCampaign(world);

  const candidates = candidatesFromProposals(world);
  const votes = new Map<number, number>();
  for (const candidate of candidates) votes.set(candidate.candidate.id, 0);

  for (const voter of world.agents) {
    const choice = pickVote(world, voter, candidates);
    votes.set(choice.candidate.id, (votes.get(choice.candidate.id) ?? 0) + 1);
  }

  const results: ElectionResult[] = candidates
    .map(({ candidate, proposal }) => ({
      candidateId: candidate.id,
      name: candidate.name,
      votes: votes.get(candidate.id) ?? 0,
      proposal: { ...proposal.policy },
    }))
    .sort((a, b) => b.votes - a.votes || a.candidateId - b.candidateId);

  const winner = results[0];
  world.civics.mayorId = winner.candidateId;
  world.civics.mayorName = winner.name;
  world.civics.lastElectionTick = world.clock.tick;
  world.civics.nextElectionTick = world.clock.tick + ELECTION_INTERVAL;
  world.civics.nextCampaignTick =
    world.civics.nextElectionTick - Math.round(ELECTION_INTERVAL * 0.25);
  world.civics.lastResults = results;
  world.civics.activeProposals = [];
  world.stats.eleicoes++;

  world.civics.policy = { ...winner.proposal };

  applyMandateMood(world, winner.candidateId);
  pushChat(world, {
    tick: world.clock.tick,
    speakerId: null,
    speakerName: "Prefeitura",
    text: `${winner.name} venceu a eleicao com ${winner.votes} votos; imposto ${(world.civics.policy.taxRate * 100).toFixed(0)}%`,
    topic: "politica",
  });
}

/** Aplica políticas públicas: orçamento, bem-estar, transporte e mercado. */
export function publicPolicySystem(world: World): void {
  if (world.clock.tick === 0 || world.clock.tick % POLICY_INTERVAL !== 0) return;

  applyWelfare(world);
  supportMarkets(world);
  tuneTransit(world);
  updateApproval(world);
}

function pickCandidates(world: World): Agent[] {
  return [...world.agents]
    .sort((a, b) => candidateScore(b) - candidateScore(a) || a.id - b.id)
    .slice(0, Math.min(CANDIDATE_COUNT, world.agents.length));
}

function runCampaign(world: World): void {
  const candidates = pickCandidates(world);
  world.civics.activeProposals = candidates.map((candidate) => ({
    candidateId: candidate.id,
    name: candidate.name,
    policy: policyFromMayor(candidate),
    slogan: sloganFor(policyFromMayor(candidate)),
  }));

  for (const proposal of world.civics.activeProposals) {
    pushChat(world, {
      tick: world.clock.tick,
      speakerId: proposal.candidateId,
      speakerName: proposal.name,
      text: proposal.slogan,
      topic: "politica",
    });
  }
}

function candidatesFromProposals(world: World): Array<{
  candidate: Agent;
  proposal: CandidateProposal;
}> {
  const byId = new Map(world.agents.map((agent) => [agent.id, agent]));
  return world.civics.activeProposals
    .map((proposal) => {
      const candidate = byId.get(proposal.candidateId);
      return candidate ? { candidate, proposal } : null;
    })
    .filter((value): value is { candidate: Agent; proposal: CandidateProposal } => value !== null);
}

function candidateScore(agent: Agent): number {
  let relationCapital = 0;
  for (const relation of agent.relations.values()) {
    relationCapital += Math.max(0, relation.afinidade);
  }
  return (
    agent.personality.ambicao * 2 +
    agent.personality.extroversao +
    agent.personality.diligencia +
    relationCapital * 0.15 +
    Math.min(agent.money, 200) / 100
  );
}

function pickVote(
  world: World,
  voter: Agent,
  candidates: Array<{ candidate: Agent; proposal: CandidateProposal }>
): { candidate: Agent; proposal: CandidateProposal } {
  let best = candidates[0];
  let bestScore = -Infinity;

  for (const entry of candidates) {
    const { candidate, proposal } = entry;
    const relation = voter.relations.get(candidate.id)?.afinidade ?? 0;
    const incumbentBonus = world.civics.mayorId === candidate.id ? 0.08 : 0;
    const approvalEffect =
      world.civics.mayorId === candidate.id ? (world.civics.approval - 0.5) * 0.7 : 0;
    const policyFit = proposalFit(voter, proposal.policy);
    const score =
      relation * 0.9 +
      candidate.personality.ambicao * 0.18 +
      candidate.personality.extroversao * 0.12 +
      policyFit +
      incumbentBonus +
      approvalEffect +
      world.rng.next() * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return best;
}

function applyMandateMood(world: World, winnerId: number): void {
  for (const agent of world.agents) {
    const affinity = agent.relations.get(winnerId)?.afinidade ?? 0;
    const direction = winnerId === agent.id ? 1 : affinity;
    agent.emotion.humor = clamp(agent.emotion.humor + direction * 0.04, -1, 1);
    if (direction > 0) {
      agent.emotion.stress = clamp(agent.emotion.stress - 0.02, 0, 1);
    } else if (direction < -0.2) {
      agent.emotion.stress = clamp(agent.emotion.stress + 0.02, 0, 1);
    }
  }
}

function policyFromMayor(mayor: Agent): CivicPolicy {
  return {
    taxRate: clamp(0.06 + mayor.personality.diligencia * 0.1, 0.04, 0.18),
    welfare: clamp(0.15 + mayor.personality.sociabilidade * 0.7, 0.1, 0.9),
    transitSubsidy: clamp(0.1 + mayor.personality.extroversao * 0.6, 0.05, 0.75),
    marketSupport: clamp(0.15 + mayor.personality.ambicao * 0.55, 0.1, 0.75),
  };
}

function proposalFit(voter: Agent, policy: CivicPolicy): number {
  const preferredTax = 0.16 - voter.personality.ambicao * 0.1;
  const preferredWelfare = voter.money < 15 ? 0.8 : 0.25 + voter.personality.sociabilidade * 0.35;
  const preferredTransit = 0.2 + voter.personality.extroversao * 0.45;
  const preferredMarket = 0.2 + voter.personality.ambicao * 0.5;

  return (
    (1 - Math.abs(preferredTax - policy.taxRate) / 0.18) * 0.25 +
    (1 - Math.abs(preferredWelfare - policy.welfare)) * 0.3 +
    (1 - Math.abs(preferredTransit - policy.transitSubsidy)) * 0.2 +
    (1 - Math.abs(preferredMarket - policy.marketSupport)) * 0.25
  );
}

function sloganFor(policy: CivicPolicy): string {
  const priorities = [
    { label: "mercado forte", value: policy.marketSupport },
    { label: "assistencia social", value: policy.welfare },
    { label: "transporte acessivel", value: policy.transitSubsidy },
    { label: "gestao enxuta", value: 1 - policy.taxRate },
  ].sort((a, b) => b.value - a.value);
  return `campanha por ${priorities[0].label} e imposto ${(policy.taxRate * 100).toFixed(0)}%`;
}

function applyWelfare(world: World): void {
  const policy = world.civics.policy;
  const payout = Math.max(1, Math.round(2 + policy.welfare * 4));
  let helped = 0;

  for (const agent of world.agents) {
    if (agent.money >= 8 || world.civics.budget < payout) continue;
    agent.money += payout;
    world.civics.budget -= payout;
    agent.emotion.stress = clamp(agent.emotion.stress - 0.03, 0, 1);
    helped++;
  }

  if (helped > 0) {
    pushChat(world, {
      tick: world.clock.tick,
      speakerId: null,
      speakerName: "Prefeitura",
      text: `assistencia ajudou ${helped} moradores`,
      topic: "politica",
    });
  }
}

function supportMarkets(world: World): void {
  const policy = world.civics.policy;
  const restock = Math.max(1, Math.round(policy.marketSupport * 8));
  let supported = 0;

  for (const institution of world.institutions) {
    if (institution.kind !== "loja" && institution.kind !== "lazer") continue;
    const cost = restock * 0.7;
    if (world.civics.budget < cost) break;
    if (institution.stock > 40) continue;
    institution.stock += restock;
    institution.priceMultiplier = clamp(
      institution.priceMultiplier - policy.marketSupport * 0.01,
      0.85,
      1.25
    );
    world.civics.budget -= cost;
    supported++;
  }

  if (supported > 0) {
    pushChat(world, {
      tick: world.clock.tick,
      speakerId: null,
      speakerName: "Prefeitura",
      text: `reabasteceu ${supported} instituicoes`,
      topic: "economia",
    });
  }
}

function tuneTransit(world: World): void {
  const multiplier = 1 + world.civics.policy.transitSubsidy * 0.35;
  for (const vehicle of world.vehicles) {
    vehicle.speed = clamp(vehicle.speed * 0.94 + 0.16 * multiplier * 0.06, 0.12, 0.28);
  }
}

function updateApproval(world: World): void {
  if (world.agents.length === 0) {
    world.civics.approval = createInitialCivics().approval;
    return;
  }

  const avgStress =
    world.agents.reduce((sum, agent) => sum + agent.emotion.stress, 0) /
    world.agents.length;
  const poverty =
    world.agents.filter((agent) => agent.money < 8).length / world.agents.length;
  const emptyStores =
    world.institutions.filter(
      (institution) =>
        (institution.kind === "loja" || institution.kind === "lazer") &&
        institution.stock <= 0
    ).length / Math.max(1, world.institutions.length);
  const budgetHealth = clamp(world.civics.budget / 500, 0, 1);

  const target = clamp(
    0.65 -
      avgStress * 0.35 -
      poverty * 0.25 -
      emptyStores * 0.2 +
      budgetHealth * 0.15,
    0.05,
    0.95
  );
  world.civics.approval = clamp(world.civics.approval * 0.85 + target * 0.15, 0, 1);
}
