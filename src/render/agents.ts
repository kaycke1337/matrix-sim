import * as THREE from "three";
import type { World } from "../sim/world";
import { cellToWorld } from "../sim/map";

/**
 * Renderiza os agentes como cápsulas coloridas.
 * Usa interpolação entre prevPos e pos para suavidade (alpha em [0,1]).
 */
export class AgentRenderer {
  private group = new THREE.Group();
  private meshes = new Map<number, THREE.Mesh>();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  sync(world: World, alpha: number): void {
    const seen = new Set<number>();
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
      // interpola posição (em coords de célula) e converte p/ mundo
      const ix = a.prevPos.x + (a.pos.x - a.prevPos.x) * alpha;
      const iz = a.prevPos.z + (a.pos.z - a.prevPos.z) * alpha;
      const w = cellToWorld({ x: ix, z: iz });
      mesh.position.set(w.x, 0.5, w.z);

      // pequeno "bob" quando dormindo (deita)
      if (a.fsm === "DORMINDO") {
        mesh.rotation.z = Math.PI / 2;
        mesh.position.y = 0.25;
      } else {
        mesh.rotation.z = 0;
      }
    }
    // remove agentes que sumiram
    for (const [id, mesh] of this.meshes) {
      if (!seen.has(id)) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.meshes.delete(id);
      }
    }
  }
}
