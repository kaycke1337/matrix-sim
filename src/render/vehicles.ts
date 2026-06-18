import * as THREE from "three";
import type { World } from "../sim/world";
import { cellToWorld } from "../sim/map";

export class VehicleRenderer {
  private mesh: THREE.InstancedMesh;
  private matrix = new THREE.Matrix4();
  private quat = new THREE.Quaternion();
  private scale = new THREE.Vector3(1, 1, 1);
  private color = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.7, 0.28, 0.42),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }),
      64
    );
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }

  sync(world: World, alpha: number): void {
    this.mesh.count = Math.min(world.vehicles.length, 64);

    for (let i = 0; i < this.mesh.count; i++) {
      const vehicle = world.vehicles[i];
      const ix = vehicle.prevPos.x + (vehicle.pos.x - vehicle.prevPos.x) * alpha;
      const iz = vehicle.prevPos.z + (vehicle.pos.z - vehicle.prevPos.z) * alpha;
      const w = cellToWorld({ x: ix, z: iz });
      const dx = vehicle.pos.x - vehicle.prevPos.x;
      const dz = vehicle.pos.z - vehicle.prevPos.z;
      const yaw = Math.atan2(dx, dz);

      this.quat.setFromEuler(new THREE.Euler(0, yaw, 0));
      this.matrix.compose(new THREE.Vector3(w.x, 0.22, w.z), this.quat, this.scale);
      this.mesh.setMatrixAt(i, this.matrix);
      this.mesh.setColorAt(i, this.color.setHex(vehicle.color));
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
