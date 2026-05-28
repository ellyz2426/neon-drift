export type GameState = 'title' | 'track_select' | 'racing' | 'paused' | 'race_over' | 'leaderboard' | 'settings';

export interface LapTime {
  lap: number;
  time: number;
}

export interface RaceStats {
  bestLap: number;
  totalTime: number;
  lapsCompleted: number;
  position: number;
}

export const TRACKS = [
  { id: 'holodeck_loop', name: 'Holodeck Loop', laps: 3, length: 1200 },
  { id: 'neon_spiral', name: 'Neon Spiral', laps: 3, length: 1500 },
  { id: 'quantum_tube', name: 'Quantum Tube', laps: 3, length: 1350 },
];

export const HOVER_COLORS = {
  player: 0x00ffff,
  ai1: 0xff00ff,
  ai2: 0xffff00,
  ai3: 0x00ff00,
};

export const PHYSICS = {
  maxSpeed: 45,
  acceleration: 18,
  brakeDecel: 30,
  turnRate: 2.2,
  driftFactor: 0.85,
  hoverHeight: 0.8,
  gravity: -9.81,
};
