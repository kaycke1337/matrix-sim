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
  private meshes = new Map<number, THREE.Mesh>();
  private ring: THREE.Mesh; // anel de seleção
  private relLines: THREE.LineSegments;
  private relGeo = new THREE.BufferGeometry();
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
    return [...this.meshes.values()];
  }

  sync(world: World, alpha: number): void {
    const seen = new Set<number>();
    const posOf = new Map<number, THREE.Vector3>();

    for (const a of world.agents) {
      seen.add(a.id);
      let mesh = this.meshes.get(a.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.22, 0.5, 4, 8),
          new THREE.MeshStandardMaterial({ color: a.color })
        );
        mesh.castShadow = true;
        mesh.userData.agentId = a.id;
        this.group.add(mesh);
        this.meshes.set(a.id, mesh);
      }
      const ix = a.prevPos.x + (a.pos.x - a.prevPos.x) * alpha;
      const iz = a.prevPos.z + (a.pos.z - a.prevPos.z) * alpha;
      const w = cellToWorld({ x: ix, z: iz });
      mesh.position.set(w.x, 0.5, w.z);
      posOf.set(a.id, new THREE.Vector3(w.x, 0.5, w.z));

      if (a.fsm === "DORMINDO") {
        mesh.rotation.z = Math.PI / 2;
        mesh.position.y = 0.25;
      } else {
        mesh.rotation.z = 0;
      }
    }

    for (const [id, mesh] of this.meshes) {
      if (!seen.has(id)) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.meshes.delete(id);
      }
    }

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
