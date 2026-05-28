import { Mesh, SphereGeometry, MeshStandardMaterial, Group, Vector3, TorusGeometry, AdditiveBlending } from '@iwsdk/core';

export type PowerUpType = 'shield' | 'missile' | 'turbo';

export class PowerUp {
  group = new Group();
  type: PowerUpType;
  position: Vector3;
  active = true;
  bobOffset = Math.random() * Math.PI * 2;

  constructor(type: PowerUpType, pos: Vector3) {
    this.type = type;
    this.position = pos.clone();
    
    const geo = new SphereGeometry(0.6, 16, 16);
    const colors = { shield: 0x00ffff, missile: 0xff4444, turbo: 0xffff00 };
    const mat = new MeshStandardMaterial({ 
      color: colors[type], 
      emissive: colors[type], 
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.9
    });
    const core = new Mesh(geo, mat);
    this.group.add(core);
    
    const ringGeo = new TorusGeometry(0.9, 0.08, 8, 24);
    const ringMat = new MeshStandardMaterial({ 
      color: colors[type], 
      emissive: colors[type], 
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.6,
      blending: AdditiveBlending
    });
    const ring = new Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    this.group.add(ring);
    
    this.group.position.copy(pos);
  }

  update(dt: number, time: number) {
    if (!this.active) return;
    this.group.rotation.y += dt * 2;
    this.group.position.y = this.position.y + Math.sin(time * 2 + this.bobOffset) * 0.3;
    const ring = this.group.children[1];
    if (ring) ring.rotation.z += dt * 3;
  }

  collect() {
    this.active = false;
    this.group.visible = false;
  }
}
