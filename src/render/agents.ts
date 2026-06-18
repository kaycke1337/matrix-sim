import * as THREE from "three";
import type { World } from "../sim/world";
import { cellToWorld } from "../sim/map";

/**
 * Renderiza agentes como cápsulas coloridas, com interpolação.
 * Mantém um índice mesh→agentId para raycasting (clique para selecionar)
 * e desenha linhas de relação (verde=amizade, vermelho=rivalidade).
 */
export class AgentRenderer {
  private group = new THREE.Group();
  private agentsMesh: THREE.InstancedMesh | null = null;
  private instanceAgentIds: number[] = [];
  private capacity = 0;
  private ring: THREE.Mesh; // anel de seleção
  private relLines: THREE.LineSegments;
  private relGeo = new THREE.BufferGeometry();
  private tempMatrix = new THREE.Matrix4();
  private tempQuat = new THREE.Quaternion();
  private tempScale = new THREE.Vector3(1, 1, 1);
  private tempColor = new THREE.Color();
  selectedId: number | null = null;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);

    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.05, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0x7dffb0 })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);

    this.relLines = new THREE.LineSegments(
      this.relGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5 })
    );
    scene.add(this.relLines);
  }

  /** Lista de malhas para o raycaster. */
  get pickables(): THREE.Object3D[] {
    return this.agentsMesh ? [this.agentsMesh] : [];
  }

  agentIdFromHit(hit: THREE.Intersection): number | null {
    if (hit.object !== this.agentsMesh || hit.instanceId == null) return null;
    return this.instanceAgentIds[hit.instanceId] ?? null;
  }

  sync(world: World, alpha: number): void {
    const posOf = new Map<number, THREE.Vector3>();
    this.ensureCapacity(world.agents.length);
    if (!this.agentsMesh) return;

    this.agentsMesh.count = world.agents.length;
    this.instanceAgentIds = [];

    for (let i = 0; i < world.agents.length; i++) {
      const a = world.agents[i];
      this.instanceAgentIds[i] = a.id;
      const ix = a.prevPos.x + (a.pos.x - a.prevPos.x) * alpha;
      const iz = a.prevPos.z + (a.pos.z - a.prevPos.z) * alpha;
      const w = cellToWorld({ x: ix, z: iz });

      let y = 0.5;
      if (a.fsm === "DORMINDO") {
        this.tempQuat.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
        y = 0.25;
      } else {
        this.tempQuat.identity();
      }

      this.tempMatrix.compose(
        new THREE.Vector3(w.x, y, w.z),
        this.tempQuat,
        this.tempScale
      );
      this.agentsMesh.setMatrixAt(i, this.tempMatrix);
      this.agentsMesh.setColorAt(i, this.tempColor.setHex(a.color));
      posOf.set(a.id, new THREE.Vector3(w.x, y, w.z));
    }
    this.agentsMesh.instanceMatrix.needsUpdate = true;
    if (this.agentsMesh.instanceColor) this.agentsMesh.instanceColor.needsUpdate = true;

    // anel de seleção
    if (this.selectedId != null && posOf.has(this.selectedId)) {
      const p = posOf.get(this.selectedId)!;
      this.ring.position.set(p.x, 0.06, p.z);
      this.ring.visible = true;
    } else {
      this.ring.visible = false;
    }

    this.updateRelationLines(world, posOf);
  }

  private ensureCapacity(count: number): void {
    if (this.agentsMesh && count <= this.capacity) return;

    if (this.agentsMesh) {
      this.group.remove(this.agentsMesh);
      this.agentsMesh.geometry.dispose();
      (this.agentsMesh.material as THREE.Material).dispose();
    }

    this.capacity = Math.max(16, nextPowerOfTwo(count));
    this.agentsMesh = new THREE.InstancedMesh(
      new THREE.CapsuleGeometry(0.22, 0.5, 4, 8),
      new THREE.MeshStandardMaterial({ vertexColors: true }),
      this.capacity
    );
    this.agentsMesh.castShadow = true;
    this.group.add(this.agentsMesh);
  }

  /** Desenha linhas entre agentes com relação significativa. */
  private updateRelationLines(world: World, posOf: Map<number, THREE.Vector3>): void {
    const verts: number[] = [];
    const colors: number[] = [];
    const drawn = new Set<string>();

    for (const a of world.agents) {
      for (const [otherId, r] of a.relations) {
        if (Math.abs(r.afinidade) < 0.2) continue;
        const key = a.id < otherId ? `${a.id}-${otherId}` : `${otherId}-${a.id}`;
        if (drawn.has(key)) continue;
        drawn.add(key);
        const p1 = posOf.get(a.id);
        const p2 = posOf.get(otherId);
        if (!p1 || !p2) continue;
        verts.push(p1.x, 0.4, p1.z, p2.x, 0.4, p2.z);
        // verde p/ amizade, vermelho p/ rivalidade
        const g = r.afinidade > 0 ? 0.9 : 0.2;
        const rd = r.afinidade > 0 ? 0.2 : 0.9;
        colors.push(rd, g, 0.3, rd, g, 0.3);
      }
    }
    this.relGeo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    this.relGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    this.relGeo.computeBoundingSphere();
  }
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}
