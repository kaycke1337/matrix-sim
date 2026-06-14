import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildWorldMesh } from "./world-mesh";
import { AgentRenderer } from "./agents";
import { dayPhase, type World } from "../sim/world";

/** Encapsula a cena Three.js, câmera, luzes e o ciclo dia/noite. */
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private sun: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;
  private agentRenderer: AgentRenderer;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05080a);
    this.scene.fog = new THREE.Fog(0x05080a, 25, 55);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    this.camera.position.set(18, 18, 18);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.target.set(0, 0, 0);

    this.ambient = new THREE.AmbientLight(0x335544, 0.6);
    this.scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 80;
    const c = this.sun.shadow.camera as THREE.OrthographicCamera;
    c.left = -20; c.right = 20; c.top = 20; c.bottom = -20;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    buildWorldMesh(this.scene);
    this.agentRenderer = new AgentRenderer(this.scene);

    this.resize();
    addEventListener("resize", () => this.resize());
  }

  private resize(): void {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Atualiza luz conforme a hora e desenha. alpha = interpolação do tick. */
  render(world: World, alpha: number): void {
    const p = dayPhase(world.clock); // 0..1
    // ângulo do sol: nasce no leste, põe no oeste
    const ang = (p - 0.25) * Math.PI * 2;
    const sunY = Math.sin(ang);
    this.sun.position.set(Math.cos(ang) * 20, Math.max(sunY, -0.3) * 25, 8);
    this.sun.target.position.set(0, 0, 0);

    // intensidade e cor conforme dia/noite
    const daylight = Math.max(0, sunY);
    this.sun.intensity = 0.2 + daylight * 1.3;
    this.ambient.intensity = 0.25 + daylight * 0.5;
    const skyDay = new THREE.Color(0x0a1820);
    const skyNight = new THREE.Color(0x03060a);
    const sky = skyNight.clone().lerp(skyDay, daylight);
    this.scene.background = sky;
    (this.scene.fog as THREE.Fog).color = sky;

    this.agentRenderer.sync(world, alpha);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
