import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildWorldMesh } from "./world-mesh";
import { AgentRenderer } from "./agents";
import { VehicleRenderer } from "./vehicles";
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
  private vehicleRenderer: VehicleRenderer;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  /** callback quando um agente é clicado (id) ou o vazio (null) */
  onPick: (id: number | null) => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05080a);
    this.scene.fog = new THREE.Fog(0x05080a, 45, 95);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    this.camera.position.set(34, 32, 34);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.target.set(0, 0, 0);
    this.controls.maxDistance = 85;

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
    this.vehicleRenderer = new VehicleRenderer(this.scene);

    this.resize();
    addEventListener("resize", () => this.resize());

    // clique para selecionar agente (distingue clique de arrasto da câmera)
    let downX = 0;
    let downY = 0;
    canvas.addEventListener("pointerdown", (e) => {
      downX = e.clientX;
      downY = e.clientY;
    });
    canvas.addEventListener("pointerup", (e) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return; // foi arrasto
      this.pointer.x = (e.clientX / innerWidth) * 2 - 1;
      this.pointer.y = -(e.clientY / innerHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.agentRenderer.pickables, false);
      if (hits.length > 0) {
        this.onPick(this.agentRenderer.agentIdFromHit(hits[0]));
      } else {
        this.onPick(null);
      }
    });
  }

  setSelected(id: number | null): void {
    this.agentRenderer.selectedId = id;
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
    this.vehicleRenderer.sync(world, alpha);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
