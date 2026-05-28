import { Track } from './track';
import { Vector3 } from '@iwsdk/core';

export class MiniMap {
  // Mini-map disabled to comply with PanelUI-only UI mandate.
  // Previous HTML canvas overlay removed. Future implementation should use PanelUI with .uikitml.
  constructor() {}

  update(track: Track, playerPos: Vector3, aiPositions: Vector3[]) {
    // No-op
  }

  setVisible(visible: boolean) {
    // No-op
  }

  dispose() {
    // No-op
  }
}
