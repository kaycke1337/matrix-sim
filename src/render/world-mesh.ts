import * as THREE from "three";
import { GRID, GRID_W, GRID_H, POIS, cellToWorld } from "../sim/map";

/** Constrói as malhas estáticas do quarteirão: chão, prédios, POIs. */
export function buildWorldMesh(scene: THREE.Scene): void {
  // Chão
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GRID_W, GRID_H),
    new THREE.MeshStandardMaterial({ color: 0x12181c })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Grade sutil (estética leve)
  const grid = new THREE.GridHelper(GRID_W, GRID_W, 0x1f3a2e, 0x14241c);
  (grid.material as THREE.Material).opacity = 0.35;
  (grid.material as THREE.Material).transparent = true;
  scene.add(grid);

  // Prédios (células bloqueadas) — agrupados como caixas por célula
  const buildingGeo = new THREE.BoxGeometry(0.95, 1, 0.95);
  const buildingMat = new THREE.MeshStandardMaterial({ color: 0x223038 });
  let count = 0;
  for (let z = 0; z < GRID_H; z++) {
    for (let x = 0; x < GRID_W; x++) {
      if (GRID[z * GRID_W + x] === 1) count++;
    }
  }
  const buildings = new THREE.InstancedMesh(buildingGeo, buildingMat, count);
  buildings.castShadow = true;
  const m = new THREE.Matrix4();
  let i = 0;
  for (let z = 0; z < GRID_H; z++) {
    for (let x = 0; x < GRID_W; x++) {
      if (GRID[z * GRID_W + x] === 1) {
        const w = cellToWorld({ x, z });
        // altura variável determinística (sem random) p/ silhueta
        const h = 1 + ((x * 7 + z * 13) % 5) * 0.6;
        m.makeScale(1, h, 1);
        m.setPosition(w.x, h / 2, w.z);
        buildings.setMatrixAt(i++, m);
      }
    }
  }
  buildings.instanceMatrix.needsUpdate = true;
  scene.add(buildings);

  // POIs: discos coloridos no chão + pino
  for (const poi of POIS) {
    const w = cellToWorld(poi.cell);
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.05, 24),
      new THREE.MeshStandardMaterial({
        color: poi.color,
        emissive: poi.color,
        emissiveIntensity: 0.4,
      })
    );
    disc.position.set(w.x, 0.03, w.z);
    scene.add(disc);
  }
}
