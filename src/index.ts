import { World, PanelUI, Follower, FollowBehavior, PanelDocument, UIKitDocument, createSystem, InputComponent } from '@iwsdk/core';
import { MeshBasicMaterial, GridHelper, Fog, Color, AmbientLight, DirectionalLight, PointLight, Vector3, Mesh, SphereGeometry, MeshStandardMaterial, AdditiveBlending } from '@iwsdk/core';
import { GameState, TRACKS, HOVER_COLORS } from './types';
import { AudioManager } from './audio';
import { Track } from './track';
import { HoverVehicle } from './vehicle';

const app = document.getElementById('app') as HTMLDivElement;
const world = await World.create(app, {
  xr: { offer: 'once' },
  input: { canvasPointerEvents: true },
  features: { grabbing: true, locomotion: { browserControls: true }, physics: false, spatialUI: true },
});

world.scene.background = new Color(0x020210);
world.scene.fog = new Fog(0x020210, 20, 100);

world.scene.add(new AmbientLight(0x404080, 0.6));
const dir = new DirectionalLight(0xffffff, 0.8);
dir.position.set(10,20,10);
world.scene.add(dir);

const grid = new GridHelper(100, 50, 0x00ffff, 0x003333);
grid.position.y = 0;
world.scene.add(grid);

for (let i=0;i<4;i++) {
  const light = new PointLight(0x00ffff, 1, 30);
  const angle = i * Math.PI/2;
  light.position.set(Math.cos(angle)*25, 5, Math.sin(angle)*25);
  world.scene.add(light);
}

const audio = new AudioManager();

let gameState: GameState = 'title';
let track: Track | null = null;
let player: HoverVehicle | null = null;
let aiVehicles: HoverVehicle[] = [];
let boostPads: Mesh[] = [];
let currentTrackIdx = 0;
let lapStartTime = 0;
let bestLap = Infinity;
let raceStartTime = 0;
let ghostTrail: Vector3[] = [];
let ghostMesh: Mesh | null = null;
let collisionCooldown = 0;

const input = { throttle: 0, brake: 0, steer: 0, boost: false, drift: false };

function setText(doc: UIKitDocument | undefined, id: string, text: string) {
  const el = doc?.getElementById(id);
  if (el) (el as any).text.value = text;
}

function createUI(template: string, followHead = false) {
  const ent = world.createTransformEntity(undefined, { persistent: true });
  ent.addComponent(PanelUI, { config: `/ui/${template}.json`, maxWidth: template==='hud'?0.35:0.8, maxHeight: 0.6 });
  if (followHead) {
    ent.addComponent(Follower, { target: world.player.head, offsetPosition: [0.3, -0.2, -0.9], behavior: FollowBehavior.PivotY, speed: 6 });
  }
  return ent;
}

const ui = {
  title: createUI('title'),
  trackselect: createUI('trackselect'),
  hud: createUI('hud', true),
  pause: createUI('pause'),
  raceover: createUI('raceover'),
  leaderboard: createUI('leaderboard'),
  settings: createUI('settings'),
};

Object.values(ui).forEach(e => e.object3D.visible = false);
ui.title.object3D.visible = true;

function showUI(state: GameState) {
  Object.values(ui).forEach(e => e.object3D.visible = false);
  const ent = ui[state as keyof typeof ui];
  if (ent) ent.object3D.visible = true;
}

function initBoostPads() {
  boostPads.forEach(m => world.scene.remove(m));
  boostPads = [];
  if (!track) return;
  for (let i=0;i<4;i++) {
    const t = (i * 0.25 + 0.125) % 1;
    const pos = track.curve.getPointAt(t);
    pos.y += 0.2;
    const geo = new SphereGeometry(0.8, 16, 16);
    const mat = new MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 1, transparent:true, opacity:0.8, blending: AdditiveBlending });
    const mesh = new Mesh(geo, mat);
    mesh.position.copy(pos);
    world.scene.add(mesh);
    boostPads.push(mesh);
  }
}

function startRace() {
  const trackId = TRACKS[currentTrackIdx].id;
  if (track) world.scene.remove(track.group);
  aiVehicles.forEach(v => world.scene.remove(v.group));
  aiVehicles = [];
  if (player) world.scene.remove(player.group);
  if (ghostMesh) { world.scene.remove(ghostMesh); ghostMesh = null; }

  track = new Track(trackId);
  world.scene.add(track.group);
  initBoostPads();

  player = new HoverVehicle(HOVER_COLORS.player, true);
  const startPos = track.getStartPosition();
  const startTan = track.getStartTangent();
  player.setPosition(startPos, startTan);
  world.scene.add(player.group);

  const colors = [HOVER_COLORS.ai1, HOVER_COLORS.ai2, HOVER_COLORS.ai3];
  for (let i=0;i<3;i++) {
    const ai = new HoverVehicle(colors[i]);
    const offset = new Vector3((i+1)*2.5,0,0);
    ai.setPosition(startPos.clone().add(offset), startTan);
    ai.speed = 12 + i*2;
    world.scene.add(ai.group);
    aiVehicles.push(ai);
  }

  lapStartTime = performance.now() / 1000;
  raceStartTime = lapStartTime;
  bestLap = Infinity;
  ghostTrail = [];
  collisionCooldown = 0;
  gameState = 'racing';
  showUI('hud');
  audio.init();
  audio.raceStart();
}

function updateHUD() {
  if (!player) return;
  const doc = ui.hud.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
  if (!doc) return;
  setText(doc, 'speed', `${Math.round(Math.abs(player.speed))} km/h`);
  setText(doc, 'lap', `${player.lap + 1} / 3`);
  setText(doc, 'position', `P${getPosition()}`);
  setText(doc, 'boost', `${Math.round(player.boostCharge * 100)}%`);
  const lapTime = (performance.now()/1000 - lapStartTime).toFixed(1);
  setText(doc, 'laptime', `${lapTime}s`);
}

function getPosition(): number {
  if (!player || !track) return 1;
  const vehicles = [player, ...aiVehicles];
  const sorted = vehicles.map(v => {
    const closest = track!.getClosestPoint(v.group.position);
    return { v, t: closest.t + v.lap * 1.0 };
  }).sort((a,b) => b.t - a.t);
  return sorted.findIndex(s => s.v === player) + 1;
}

function checkCheckpoints() {
  if (!player || !track) return;
  const cp = track.checkpoints[player.checkpointIdx];
  if (player.group.position.distanceTo(cp) < 6) {
    player.checkpointIdx = (player.checkpointIdx + 1) % track.checkpoints.length;
    audio.checkpoint();
    if (player.checkpointIdx === 0) {
      player.lap++;
      const lapTime = performance.now()/1000 - lapStartTime;
      if (lapTime < bestLap) bestLap = lapTime;
      audio.lapComplete();
      if (player.lap >= 3) {
        finishRace();
      } else {
        lapStartTime = performance.now()/1000;
      }
    }
  }
}

function finishRace() {
  gameState = 'race_over';
  showUI('raceover');
  audio.raceEnd();
  const doc = ui.raceover.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
  setText(doc, 'final_position', `P${getPosition()}`);
  setText(doc, 'best_lap', `${bestLap.toFixed(2)}s`);
  // Save best time
  const key = `neon_drift_best_${TRACKS[currentTrackIdx].id}`;
  const prev = parseFloat(localStorage.getItem(key) || '9999');
  if (bestLap < prev) localStorage.setItem(key, bestLap.toFixed(2));
  // Create ghost
  createGhost();
}

function createGhost() {
  if (ghostTrail.length < 10) return;
  const geo = new SphereGeometry(0.3, 8,8);
  const mat = new MeshStandardMaterial({ color: 0x00ffff, emissive:0x00ffff, emissiveIntensity:0.3, transparent:true, opacity:0.3 });
  ghostMesh = new Mesh(geo, mat);
  world.scene.add(ghostMesh);
}

function updateGhost(dt: number) {
  if (!ghostMesh || ghostTrail.length===0) return;
  const idx = Math.floor(performance.now()/100) % ghostTrail.length;
  ghostMesh.position.copy(ghostTrail[idx]);
}

function updateBoostPads() {
  if (!player) return;
  boostPads.forEach(pad => {
    pad.rotation.y += 0.02;
    if (player.group.position.distanceTo(pad.position) < 1.5 && player.boostCharge < 0.95) {
      player.boostCharge = 1;
      audio.boost();
      pad.scale.setScalar(1.5);
      setTimeout(()=>pad.scale.setScalar(1), 200);
    }
  });
}

function updateAI(dt: number) {
  if (!track) return;
  aiVehicles.forEach((ai, idx) => {
    const closest = track!.getClosestPoint(ai.group.position);
    const targetT = (closest.t + 0.012 + idx*0.002) % 1;
    const targetPos = track!.curve.getPointAt(targetT);
    const dir = targetPos.clone().sub(ai.group.position).normalize();
    const forward = ai.getForward();
    const steer = Math.sign(dir.x * forward.z - dir.z * forward.x) * 0.6;
    const throttle = 0.85 + Math.sin(performance.now()*0.001 + idx)*0.1;
    ai.update(dt, { throttle, brake:0, steer, boost:false }, track!.getStartTangent());
  });
}

function handleCollisions(dt: number) {
  if (!player) return;
  collisionCooldown -= dt;
  for (const ai of aiVehicles) {
    const dist = player.group.position.distanceTo(ai.group.position);
    if (dist < 2.0 && collisionCooldown <= 0) {
      // Simple bounce
      const dir = player.group.position.clone().sub(ai.group.position).normalize();
      player.group.position.add(dir.multiplyScalar(0.5));
      player.speed *= 0.8;
      collisionCooldown = 0.5;
      audio.playTone(150, 0.1, 'square', 0.2);
    }
  }
}

function setupUIHandlers() {
  const titleDoc = ui.title.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
  titleDoc?.getElementById('btn-play')?.addEventListener('click', () => { gameState='track_select'; showUI('trackselect'); updateTrackSelectUI(); });
  titleDoc?.getElementById('btn-leaderboard')?.addEventListener('click', () => { gameState='leaderboard'; showUI('leaderboard'); });
  titleDoc?.getElementById('btn-settings')?.addEventListener('click', () => { gameState='settings'; showUI('settings'); });

  const tsDoc = ui.trackselect.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
  tsDoc?.getElementById('btn_start')?.addEventListener('click', startRace);
  tsDoc?.getElementById('btn_back')?.addEventListener('click', () => { gameState='title'; showUI('title'); });

  const pauseDoc = ui.pause.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
  pauseDoc?.getElementById('btn_resume')?.addEventListener('click', () => { gameState='racing'; showUI('hud'); });
  pauseDoc?.getElementById('btn_quit')?.addEventListener('click', () => { gameState='title'; showUI('title'); });

  const overDoc = ui.raceover.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
  overDoc?.getElementById('btn_rematch')?.addEventListener('click', startRace);
  overDoc?.getElementById('btn_menu')?.addEventListener('click', () => { gameState='title'; showUI('title'); });

  const lbDoc = ui.leaderboard.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
  lbDoc?.getElementById('btn_back')?.addEventListener('click', () => { gameState='title'; showUI('title'); });

  const setDoc = ui.settings.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
  setDoc?.getElementById('btn_back')?.addEventListener('click', () => { gameState='title'; showUI('title'); });
}

function updateTrackSelectUI() {
  const doc = ui.trackselect.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
  setText(doc, 'track_name', TRACKS[currentTrackIdx].name);
}

// Delay UI handler setup to ensure documents loaded
setTimeout(setupUIHandlers, 1000);

const system = createSystem((world, dt) => {
  // Global pause toggle
  if (world.input.keyboard.getKeyDown('Escape')) {
    if (gameState === 'racing') { gameState='paused'; showUI('pause'); }
    else if (gameState === 'paused') { gameState='racing'; showUI('hud'); }
  }

  // Track selection navigation
  if (gameState === 'track_select') {
    if (world.input.keyboard.getKeyDown('ArrowLeft') || world.input.keyboard.getKeyDown('KeyA')) {
      currentTrackIdx = (currentTrackIdx + TRACKS.length -1) % TRACKS.length;
      updateTrackSelectUI();
    }
    if (world.input.keyboard.getKeyDown('ArrowRight') || world.input.keyboard.getKeyDown('KeyD')) {
      currentTrackIdx = (currentTrackIdx +1) % TRACKS.length;
      updateTrackSelectUI();
    }
  }

  if (gameState !== 'racing' || !player || !track) {
    updateGhost(dt);
    return;
  }

  // Input
  input.throttle = 0; input.brake=0; input.steer=0; input.boost=false; input.drift=false;
  const kb = world.input.keyboard;
  if (kb.getKeyPressed('KeyW') || kb.getKeyPressed('ArrowUp')) input.throttle = 1;
  if (kb.getKeyPressed('KeyS') || kb.getKeyPressed('ArrowDown')) input.brake = 1;
  if (kb.getKeyPressed('KeyA') || kb.getKeyPressed('ArrowLeft')) input.steer = 1;
  if (kb.getKeyPressed('KeyD') || kb.getKeyPressed('ArrowRight')) input.steer = -1;
  if (kb.getKeyPressed('Space')) input.boost = true;
  if (kb.getKeyPressed('ShiftLeft') || kb.getKeyPressed('ShiftRight')) input.drift = true;

  const gp = world.input.xr.gamepads.right;
  if (gp) {
    const trig = gp.getButtonPressed(InputComponent.Trigger);
    if (trig) input.throttle = trig;
    const stick = gp.getAxesValues(InputComponent.Thumbstick);
    if (stick) input.steer = -stick.x;
    if (gp.getButtonPressed(InputComponent.A_Button)) input.boost = true;
    if (gp.getButtonPressed(InputComponent.Squeeze)) input.drift = true;
  }

  const tangent = track.getStartTangent();
  // Boost visual
  if (input.boost && player.boostCharge > 0.1) {
    player.mesh.material.emissiveIntensity = 1.2;
  } else {
    player.mesh.material.emissiveIntensity = 0.6;
  }

  // Drift modifies turn
  if (input.drift) {
    input.steer *= 1.5;
    player.speed *= 0.995;
  }

  player.update(dt, input, tangent);
  updateAI(dt);
  checkCheckpoints();
  updateBoostPads();
  handleCollisions(dt);
  updateHUD();

  // Record ghost
  if (ghostTrail.length < 1000) ghostTrail.push(player.group.position.clone());
  else {
    ghostTrail.shift();
    ghostTrail.push(player.group.position.clone());
  }

  // Engine sound occasional
  if (Math.random() < 0.05) audio.engineSound(Math.abs(player.speed)/50);
});

world.registerSystem(system);
showUI('title');
