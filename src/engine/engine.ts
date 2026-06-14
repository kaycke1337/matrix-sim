import { createWorld, TICK_MS, type World } from "../sim/world";
import { step } from "../sim/step";

/**
 * Loop com timestep fixo (determinístico) + acumulador.
 * O render recebe um `alpha` de interpolação entre ticks.
 */
export class Engine {
  world: World;
  speed = 1; // multiplicador de velocidade (0 = pausado)
  private acc = 0;
  private last = 0;
  private onRender: (world: World, alpha: number) => void;
  private running = false;

  constructor(onRender: (world: World, alpha: number) => void, seed = 1337) {
    this.world = createWorld(seed);
    this.onRender = onRender;
  }

  start(): void {
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
  }

  /** Substitui o mundo atual (load / reset). Zera o acumulador. */
  setWorld(world: World): void {
    this.world = world;
    this.acc = 0;
  }

  /** Cria um mundo novo do zero (reset) com a seed dada. */
  reset(seed = 1337): void {
    this.setWorld(createWorld(seed));
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    let dt = now - this.last;
    this.last = now;
    if (dt > 250) dt = 250; // evita "espiral da morte" após aba inativa

    this.acc += dt * this.speed;
    let guard = 0;
    while (this.acc >= TICK_MS && guard < 10000) {
      step(this.world);
      this.acc -= TICK_MS;
      guard++;
    }
    const alpha = this.speed > 0 ? this.acc / TICK_MS : 1;
    this.onRender(this.world, alpha);
    requestAnimationFrame(this.frame);
  };
}
