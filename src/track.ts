import { Mesh, TorusGeometry, MeshStandardMaterial, Group, CatmullRomCurve3, Vector3, TubeGeometry, MeshBasicMaterial, RingGeometry, DoubleSide, AdditiveBlending } from '@iwsdk/core';
import { TRACKS } from './types';

export class Track {
  group = new Group();
  curve: CatmullRomCurve3;
  checkpoints: Vector3[] = [];
  trackId: string;

  constructor(trackId: string) {
    this.trackId = trackId;
    const points = this.generatePoints(trackId);
    this.curve = new CatmullRomCurve3(points, true);
    this.buildMesh();
    this.buildCheckpoints();
  }

  generatePoints(id: string): Vector3[] {
    const pts: Vector3[] = [];
    const count = 60;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const angle = t * Math.PI * 2;
      let radius = 20;
      let y = 1.5;
      if (id === 'neon_spiral') {
        radius = 18 + Math.sin(angle * 3) * 4;
        y = 1.5 + Math.sin(angle * 2) * 2;
      } else if (id === 'quantum_tube') {
        radius = 22 + Math.cos(angle * 4) * 3;
        y = 1.5 + Math.sin(angle * 3) * 1.5;
      } else {
        radius = 20 + Math.sin(angle * 2) * 5;
        y = 1.5 + Math.cos(angle * 2) * 1;
      }
      pts.push(new Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
    }
    return pts;
  }

  buildMesh() {
    const tubeGeo = new TubeGeometry(this.curve, 200, 4, 12, true);
    const mat = new MeshStandardMaterial({ color: 0x111133, emissive: 0x001133, metalness: 0.8, roughness: 0.2 });
    const tube = new Mesh(tubeGeo, mat);
    this.group.add(tube);

    // Inner glow
    const innerGeo = new TubeGeometry(this.curve, 200, 3.8, 12, true);
    const innerMat = new MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.1, blending: AdditiveBlending, side: DoubleSide });
    const inner = new Mesh(innerGeo, innerMat);
    this.group.add(inner);

    // Rings
    for (let i = 0; i < 24; i++) {
      const t = i / 24;
      const pos = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const ringGeo = new TorusGeometry(4.2, 0.1, 8, 32);
      const ringMat = new MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 });
      const ring = new Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.lookAt(pos.clone().add(tangent));
      this.group.add(ring);
    }
  }

  buildCheckpoints() {
    for (let i = 0; i < 8; i++) {
      const t = i / 8;
      const pos = this.curve.getPointAt(t);
      this.checkpoints.push(pos.clone());
      const geo = new RingGeometry(3.5, 4, 32);
      const mat = new MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.4, side: DoubleSide });
      const ring = new Mesh(geo, mat);
      ring.position.copy(pos);
      ring.position.y += 0.1;
      ring.rotation.x = -Math.PI / 2;
      this.group.add(ring);
    }
  }

  getStartPosition(): Vector3 {
    const pos = this.curve.getPointAt(0);
    pos.y += 1;
    return pos;
  }

  getStartTangent(): Vector3 {
    return this.curve.getTangentAt(0).normalize();
  }

  getClosestPoint(pos: Vector3): { point: Vector3; t: number; distance: number } {
    let bestT = 0;
    let bestDist = Infinity;
    let bestPoint = pos.clone();
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const p = this.curve.getPointAt(t);
      const d = p.distanceTo(pos);
      if (d < bestDist) {
        bestDist = d;
        bestT = t;
        bestPoint = p;
      }
    }
    return { point: bestPoint, t: bestT, distance: bestDist };
  }
}
