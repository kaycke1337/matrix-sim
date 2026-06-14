import type { RNG } from "./rng";

/**
 * MLP pequena (uma camada oculta) treinável por REINFORCE (policy gradient).
 * TS puro, sem dependências. Determinística dado o RNG (pesos e amostragem).
 *
 * Arquitetura: input -> hidden (tanh) -> output (softmax = política sobre ações)
 *
 * Treino: o agente AGE amostrando uma ação da política, recebe uma RECOMPENSA,
 * e ajustamos os pesos para tornar ações boas mais prováveis (gradiente de
 * log-prob escalado pela recompensa/vantagem). É RL online, leve, por agente.
 */
export class Brain {
  readonly nIn: number;
  readonly nHid: number;
  readonly nOut: number;

  // pesos achatados
  w1: Float64Array; // [nHid * nIn]
  b1: Float64Array; // [nHid]
  w2: Float64Array; // [nOut * nHid]
  b2: Float64Array; // [nOut]

  // cache do último forward (para backprop)
  private lastIn: Float64Array;
  private lastHid: Float64Array;
  private lastOut: Float64Array;

  lr = 0.02; // taxa de aprendizado

  constructor(nIn: number, nHid: number, nOut: number, rng: RNG) {
    this.nIn = nIn;
    this.nHid = nHid;
    this.nOut = nOut;
    this.w1 = randn(nHid * nIn, rng, Math.sqrt(2 / nIn));
    this.b1 = new Float64Array(nHid);
    this.w2 = randn(nOut * nHid, rng, Math.sqrt(2 / nHid));
    this.b2 = new Float64Array(nOut);
    this.lastIn = new Float64Array(nIn);
    this.lastHid = new Float64Array(nHid);
    this.lastOut = new Float64Array(nOut);
  }

  /** Forward: retorna distribuição de probabilidade sobre as ações (softmax). */
  forward(input: number[] | Float64Array): Float64Array {
    const x = this.lastIn;
    for (let i = 0; i < this.nIn; i++) x[i] = input[i] ?? 0;

    const h = this.lastHid;
    for (let j = 0; j < this.nHid; j++) {
      let s = this.b1[j];
      const base = j * this.nIn;
      for (let i = 0; i < this.nIn; i++) s += this.w1[base + i] * x[i];
      h[j] = Math.tanh(s);
    }

    const o = this.lastOut;
    let max = -Infinity;
    for (let k = 0; k < this.nOut; k++) {
      let s = this.b2[k];
      const base = k * this.nHid;
      for (let j = 0; j < this.nHid; j++) s += this.w2[base + j] * h[j];
      o[k] = s;
      if (s > max) max = s;
    }
    // softmax estável
    let sum = 0;
    for (let k = 0; k < this.nOut; k++) {
      o[k] = Math.exp(o[k] - max);
      sum += o[k];
    }
    for (let k = 0; k < this.nOut; k++) o[k] /= sum;
    return o;
  }

  /** Amostra uma ação da política atual (usa o RNG semeado). */
  sample(probs: Float64Array, rng: RNG): number {
    let r = rng.next();
    for (let k = 0; k < this.nOut; k++) {
      r -= probs[k];
      if (r <= 0) return k;
    }
    return this.nOut - 1;
  }

  /**
   * Passo de REINFORCE para UMA decisão.
   * Ajusta pesos para aumentar/diminuir a prob. da ação tomada conforme
   * a vantagem (recompensa - baseline). Usa o cache do último forward,
   * então deve ser chamado logo após forward() da MESMA decisão.
   */
  learn(action: number, advantage: number): void {
    const x = this.lastIn;
    const h = this.lastHid;
    const p = this.lastOut;

    // dL/do_k = (prob_k - 1{k==action}) * (-advantage)
    // (subir log-prob da ação tomada quando advantage > 0)
    const dOut = new Float64Array(this.nOut);
    for (let k = 0; k < this.nOut; k++) {
      const indicator = k === action ? 1 : 0;
      dOut[k] = (p[k] - indicator) * advantage;
    }

    // grad camada de saída + propaga para hidden
    const dHid = new Float64Array(this.nHid);
    for (let k = 0; k < this.nOut; k++) {
      const g = dOut[k];
      const base = k * this.nHid;
      for (let j = 0; j < this.nHid; j++) {
        dHid[j] += g * this.w2[base + j];
        this.w2[base + j] -= this.lr * g * h[j];
      }
      this.b2[k] -= this.lr * g;
    }

    // através do tanh: dtanh = 1 - h^2
    for (let j = 0; j < this.nHid; j++) {
      const g = dHid[j] * (1 - h[j] * h[j]);
      const base = j * this.nIn;
      for (let i = 0; i < this.nIn; i++) {
        this.w1[base + i] -= this.lr * g * x[i];
      }
      this.b1[j] -= this.lr * g;
    }
  }

  /** Serializa pesos para save/load. */
  toJSON(): BrainData {
    return {
      nIn: this.nIn,
      nHid: this.nHid,
      nOut: this.nOut,
      lr: this.lr,
      w1: Array.from(this.w1),
      b1: Array.from(this.b1),
      w2: Array.from(this.w2),
      b2: Array.from(this.b2),
    };
  }

  static fromJSON(d: BrainData): Brain {
    const b = Object.create(Brain.prototype) as Brain;
    Object.assign(b, {
      nIn: d.nIn,
      nHid: d.nHid,
      nOut: d.nOut,
      lr: d.lr,
      w1: Float64Array.from(d.w1),
      b1: Float64Array.from(d.b1),
      w2: Float64Array.from(d.w2),
      b2: Float64Array.from(d.b2),
      lastIn: new Float64Array(d.nIn),
      lastHid: new Float64Array(d.nHid),
      lastOut: new Float64Array(d.nOut),
    });
    return b;
  }
}

export interface BrainData {
  nIn: number;
  nHid: number;
  nOut: number;
  lr: number;
  w1: number[];
  b1: number[];
  w2: number[];
  b2: number[];
}

/** Vetor de pesos com inicialização normal (Box-Muller via RNG semeado). */
function randn(n: number, rng: RNG, scale: number): Float64Array {
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const u1 = Math.max(rng.next(), 1e-9);
    const u2 = rng.next();
    a[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * scale;
  }
  return a;
}
