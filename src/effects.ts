import { Mesh, SphereGeometry, MeshBasicMaterial, Group, Vector3, AdditiveBlending } from '@iwsdk/core';

export class EffectsManager {
  speedLines: Mesh[] = [];
  driftSparks: Array<{ mesh: Mesh, vel: Vector3, life: number }> = [];
  shieldMesh: Mesh | null = null;

  constructor(private scene: any) {
    // Speed lines
    for (let i = 0; i < 30; i++) {
      const geo = new SphereGeometry(0.02, 4, 4);
      const mat = new MeshBasicMaterial({ 
        color: 0x00ffff, 
        transparent: true, 
        opacity: 0,
        blending: AdditiveBlending
      });
      const mesh = new Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.speedLines.push(mesh);
    }

    // Shield bubble
    const shieldGeo = new SphereGeometry(1.8, 16, 16);
    const shieldMat = new MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      wireframe: true
    });
    this.shieldMesh = new Mesh(shieldGeo, shieldMat);
    this.shieldMesh.visible = false;
    scene.add(this.shieldMesh);
  }

  updateSpeedLines(playerPos: Vector3, speed: number, dt: number) {
    const intensity = Math.min(1, Math.abs(speed) / 40);
    this.speedLines.forEach((mesh, i) => {
      if (intensity < 0.3) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      const angle = (i / this.speedLines.length) * Math.PI * 2;
      const radius = 2 + Math.random() * 1;
      mesh.position.set(
        playerPos.x + Math.cos(angle) * radius,
        playerPos.y + (Math.random() - 0.5) * 1,
        playerPos.z + Math.sin(angle) * radius
      );
      const mat = mesh.material as MeshBasicMaterial;
      mat.opacity = intensity * 0.6 * Math.random();
    });
  }

  spawnDriftSparks(pos: Vector3, count = 8) {
    for (let i = 0; i < count; i++) {
      const geo = new SphereGeometry(0.05, 4, 4);
      const mat = new MeshBasicMaterial({ 
        color: 0xffaa00, 
        transparent: true, 
        opacity: 1,
        blending: AdditiveBlending
      });
      const mesh = new Mesh(geo, mat);
      mesh.position.copy(pos);
      this.scene.add(mesh);
      const vel = new Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 2,
        (Math.random() - 0.5) * 4
      );
      this.driftSparks.push({ mesh, vel, life: 0.5 });
    }
  }

  updateDriftSparks(dt: number) {
    this.driftSparks = this.driftSparks.filter(spark => {
      spark.life -= dt;
      if (spark.life <= 0) {
        this.scene.remove(spark.mesh);
        return false;
      }
      spark.mesh.position.add(spark.vel.clone().multiplyScalar(dt));
      spark.vel.y -= 9.8 * dt;
      const mat = spark.mesh.material as MeshBasicMaterial;
      mat.opacity = spark.life * 2;
      return true;
    });
  }

  setShieldActive(pos: Vector3, active: boolean) {
    if (!this.shieldMesh) return;
    this.shieldMesh.visible = active;
    if (active) {
      this.shieldMesh.position.copy(pos);
      const mat = this.shieldMesh.material as MeshBasicMaterial;
      mat.opacity = 0.15 + Math.sin(Date.now() * 0.01) * 0.05;
    }
  }

  update(dt: number) {
    this.updateDriftSparks(dt);
  }
}
