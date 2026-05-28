import { Track } from './track';
import { Vector3 } from '@iwsdk/core';

export class MiniMap {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  size = 200;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.canvas.style.position = 'fixed';
    this.canvas.style.bottom = '20px';
    this.canvas.style.left = '20px';
    this.canvas.style.border = '2px solid #00ffff';
    this.canvas.style.borderRadius = '50%';
    this.canvas.style.opacity = '0.9';
    this.canvas.style.zIndex = '1000';
    this.canvas.style.pointerEvents = 'none';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  update(track: Track, playerPos: Vector3, aiPositions: Vector3[]) {
    const ctx = this.ctx;
    const s = this.size;
    ctx.clearRect(0, 0, s, s);
    
    // Background
    ctx.fillStyle = 'rgba(0, 10, 20, 0.85)';
    ctx.beginPath();
    ctx.arc(s/2, s/2, s/2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Track
    ctx.strokeStyle = '#0088aa';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const points = 100;
    for (let i = 0; i <= points; i++) {
      const t = i / points;
      const p = track.curve.getPointAt(t);
      const x = s/2 + (p.x / 30) * (s/2 - 20);
      const y = s/2 + (p.z / 30) * (s/2 - 20);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // AI
    ctx.fillStyle = '#ff00ff';
    aiPositions.forEach(pos => {
      const x = s/2 + (pos.x / 30) * (s/2 - 20);
      const y = s/2 + (pos.z / 30) * (s/2 - 20);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Player
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    const px = s/2 + (playerPos.x / 30) * (s/2 - 20);
    const py = s/2 + (playerPos.z / 30) * (s/2 - 20);
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  setVisible(visible: boolean) {
    this.canvas.style.display = visible ? 'block' : 'none';
  }

  dispose() {
    this.canvas.remove();
  }
}
