import { Group, Mesh, BoxGeometry, MeshStandardMaterial, Vector3, Quaternion, Euler, Object3D } from '@iwsdk/core';
import { PHYSICS } from './types';

export class HoverVehicle {
  group = new Group();
  mesh: Mesh;
  velocity = new Vector3();
  speed = 0;
  lap = 0;
  checkpointIdx = 0;
  raceTime = 0;
  finished = false;
  isPlayer = false;
  color: number;
  boostCharge = 1;

  constructor(color: number, isPlayer = false) {
    this.color = color;
    this.isPlayer = isPlayer;
    const geo = new BoxGeometry(1.2, 0.3, 2);
    const mat = new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.2 });
    this.mesh = new Mesh(geo, mat);
    this.group.add(this.mesh);

    // Wings
    const wingGeo = new BoxGeometry(2, 0.05, 0.6);
    const wingMat = new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 });
    const wing = new Mesh(wingGeo, wingMat);
    wing.position.z = -0.3;
    this.group.add(wing);
  }

  update(dt: number, input: { throttle: number; brake: number; steer: number; boost: boolean }, trackTangent: Vector3) {
    if (this.finished) return;

    // Acceleration
    const accel = input.throttle * PHYSICS.acceleration;
    const decel = input.brake * PHYSICS.brakeDecel;
    this.speed += (accel - decel) * dt;
    this.speed *= 0.99; // drag
    this.speed = Math.max(-PHYSICS.maxSpeed * 0.5, Math.min(PHYSICS.maxSpeed, this.speed));

    // Boost
    if (input.boost && this.boostCharge >= 1) {
      this.speed = Math.min(PHYSICS.maxSpeed * 1.3, this.speed + 20 * dt);
      this.boostCharge -= dt * 0.5;
      if (this.boostCharge < 0) this.boostCharge = 0;
    } else {
      this.boostCharge = Math.min(1, this.boostCharge + dt * 0.3);
    }

    // Steering
    const steerAmount = input.steer * PHYSICS.turnRate * dt * Math.min(1, Math.abs(this.speed) / 10);
    const quat = new Quaternion().setFromAxisAngle(new Vector3(0,1,0), steerAmount);
    this.group.quaternion.multiply(quat);

    // Move forward
    const forward = new Vector3(0,0,-1).applyQuaternion(this.group.quaternion);
    this.velocity.copy(forward).multiplyScalar(this.speed);
    this.group.position.add(this.velocity.clone().multiplyScalar(dt));

    // Hover height
    this.group.position.y = PHYSICS.hoverHeight + Math.sin(this.raceTime * 10) * 0.05;

    // Bank into turns
    const targetRoll = -input.steer * Math.min(0.5, Math.abs(this.speed) / PHYSICS.maxSpeed);
    this.mesh.rotation.z += (targetRoll - this.mesh.rotation.z) * dt * 5;

    this.raceTime += dt;
  }

  setPosition(pos: Vector3, tangent: Vector3) {
    this.group.position.copy(pos);
    const lookAt = pos.clone().add(tangent);
    this.group.lookAt(lookAt);
  }

  getForward(): Vector3 {
    return new Vector3(0,0,-1).applyQuaternion(this.group.quaternion);
  }
}
