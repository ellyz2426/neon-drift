import { World, PanelUI, Follower, FollowBehavior, PanelDocument, UIKitDocument, createSystem, InputComponent } from '@iwsdk/core';
import { MeshBasicMaterial, GridHelper, Fog, Color, AmbientLight, DirectionalLight, PointLight, Vector3, Mesh, SphereGeometry, MeshStandardMaterial, AdditiveBlending, CylinderGeometry, RingGeometry, DoubleSide } from '@iwsdk/core';
import { GameState, TRACKS, HOVER_COLORS } from './types';
import { AudioManager } from './audio';
import { Track } from './track';
import { HoverVehicle } from './vehicle';
import { PowerUp, PowerUpType } from './powerups';
import { EffectsManager } from './effects';
import { MiniMap } from './minimap';

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
const effects = new EffectsManager(world.scene);
const minimap = new MiniMap();

let gameState: GameState = 'title';
let gameMode: 'race' | 'timetrial' | 'championship' = 'race';
let track: Track | null = null;
let player: HoverVehicle | null = null;
let aiVehicles: HoverVehicle[] = [];
let boostPads: Mesh[] = [];
let powerUps: PowerUp[] = [];
let jumpRamps: Mesh[] = [];
let turboZones: Array<{mesh: Mesh, center: Vector3, radius: number}> = [];
let currentTrackIdx = 0;
let lapStartTime = 0;
let bestLap = Infinity;
let raceStartTime = 0;
let ghostTrail: Vector3[] = [];
let ghostMesh: Mesh | null = null;
let collisionCooldown = 0;
let shieldActive = false;
let shieldTimer = 0;
let missileCooldown = 0;
let raceCountdown = 0;
let countdownActive = false;
let driftCombo = 0;
let driftComboTimer = 0;
let hazardObstacles: Array<{mesh: Mesh, t: number, speed: number}> = [];
let championshipRaceIdx = 0;
let championshipPoints = 0;
let championshipTotalPoints = 0;
let vehicleSkinIdx = 0;
const VEHICLE_SKINS = [0x00ffff, 0xff00ff, 0xffff00, 0x00ff00];
let weatherRainActive = false;
let rainParticles: Mesh[] = [];

const input = { throttle: 0, brake: 0, steer: 0, boost: false, drift: false, missile: false };

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
  minimap.setVisible(state === 'racing');
}

function initTrackFeatures() {
  boostPads.forEach(m => world.scene.remove(m));
  powerUps.forEach(p => world.scene.remove(p.group));
  jumpRamps.forEach(m => world.scene.remove(m));
  turboZones.forEach(z => world.scene.remove(z.mesh));
  hazardObstacles.forEach(h => world.scene.remove(h.mesh));
  boostPads = [];
  powerUps = [];
  jumpRamps = [];
  turboZones = [];
  hazardObstacles = [];
  
  if (!track) return;
  
  // Boost pads
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
  
  // Power-ups
  const types: PowerUpType[] = ['shield', 'missile', 'turbo', 'shield'];
  for (let i=0;i<4;i++) {
    const t = (i * 0.25 + 0.0625) % 1;
    const pos = track.curve.getPointAt(t);
    pos.y += 0.5;
    const pu = new PowerUp(types[i], pos);
    world.scene.add(pu.group);
    powerUps.push(pu);
  }
  
  // Jump ramps
  for (let i=0;i<2;i++) {
    const t = (i * 0.5 + 0.3) % 1;
    const pos = track.curve.getPointAt(t);
    const tangent = track.curve.getTangentAt(t).normalize();
    pos.y += 0.1;
    const geo = new CylinderGeometry(2, 3, 0.3, 8, 1, false, 0, Math.PI);
    const mat = new MeshStandardMaterial({ color: 0xff6600, emissive: 0xff6600, emissiveIntensity: 0.6 });
    const ramp = new Mesh(geo, mat);
    ramp.position.copy(pos);
    ramp.lookAt(pos.clone().add(tangent));
    ramp.rotateX(Math.PI/2);
    world.scene.add(ramp);
    jumpRamps.push(ramp);
  }
  
  // Turbo zones
  for (let i=0;i<2;i++) {
    const t = (i * 0.5 + 0.15) % 1;
    const pos = track.curve.getPointAt(t);
    pos.y += 0.05;
    const geo = new RingGeometry(3, 4, 32);
    const mat = new MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.4, side: DoubleSide, blending: AdditiveBlending });
    const ring = new Mesh(geo, mat);
    ring.position.copy(pos);
    ring.rotation.x = -Math.PI/2;
    world.scene.add(ring);
    turboZones.push({ mesh: ring, center: pos.clone(), radius: 4 });
  }
  
  // Moving hazards
  for (let i=0;i<3;i++) {
    const t = (i * 0.33 + 0.1) % 1;
    const pos = track.curve.getPointAt(t);
    pos.y += 0.8;
    const geo = new BoxGeometry(1,1,1);
    const mat = new MeshStandardMaterial({ color: 0xff0033, emissive: 0xff0033, emissiveIntensity: 1 });
    const mesh = new Mesh(geo, mat);
    mesh.position.copy(pos);
    world.scene.add(mesh);
    hazardObstacles.push({ mesh, t, speed: 0.05 + i*0.01 });
  }
}

function startRace() {
  if (gameMode === 'championship') {
    currentTrackIdx = championshipRaceIdx % TRACKS.length;
  }
  const trackId = TRACKS[currentTrackIdx].id;
  if (track) world.scene.remove(track.group);
  aiVehicles.forEach(v => world.scene.remove(v.group));
  aiVehicles = [];
  if (player) world.scene.remove(player.group);
  if (ghostMesh) { world.scene.remove(ghostMesh); ghostMesh = null; }

  track = new Track(trackId);
  world.scene.add(track.group);
  initTrackFeatures();

  player = new HoverVehicle(VEHICLE_SKINS[vehicleSkinIdx], true);
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
  shieldActive = false;
  shieldTimer = 0;
  missileCooldown = 0;
  gameState = 'racing';
  showUI('hud');
  audio.init();
  audio.raceStart();
  
  // Countdown
  countdownActive = true;
  raceCountdown = 3;
}

function updateHUD() {
  if (!player) return;
  const doc = ui.hud.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
  if (!doc) return;
  setText(doc, 'speed', `${Math.round(Math.abs(player.speed))} km/h`);
  if (gameMode === 'championship') {
    setText(doc, 'lap', `Race ${championshipRaceIdx+1}/3`);
    setText(doc, 'position', `P${getPosition()} ${championshipTotalPoints}pts`);
  } else {
    setText(doc, 'lap', gameMode === 'timetrial' ? `BEST: ${bestLap===Infinity?'--':bestLap.toFixed(2)}s` : `${player.lap + 1} / 3`);
    setText(doc, 'position', gameMode === 'timetrial' ? 'TIME TRIAL' : `P${getPosition()}`);
  }
  setText(doc, 'boost', `${Math.round(player.boostCharge * 100)}%`);
  setText(doc, 'drift', driftCombo > 0 ? `${driftCombo.toFixed(1)}x` : '0x');
  const lapTime = (performance.now()/1000 - lapStartTime).toFixed(1);
  setText(doc, 'laptime', countdownActive ? `GO! ${Math.ceil(raceCountdown)}` : `${lapTime}s`);
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
      if (gameMode === 'race' && player.lap >= 3) {
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
  const pos = getPosition();
  if (gameMode === 'championship') {
    const pointsTable = [25,18,15,12];
    const pts = pointsTable[pos-1] || 10;
    championshipPoints += pts;
    championshipTotalPoints += pts;
    setText(doc, 'final_position', `P${pos} +${pts}pts`);
    setText(doc, 'best_lap', `Total: ${championshipTotalPoints}pts`);
    championshipRaceIdx++;
    if (championshipRaceIdx >= 3) {
      setText(doc, 'final_position', `CHAMPIONSHIP FINISH P${pos}`);
    }
  } else {
    setText(doc, 'final_position', gameMode === 'timetrial' ? `BEST: ${bestLap.toFixed(2)}s` : `P${pos}`);
    setText(doc, 'best_lap', `${bestLap.toFixed(2)}s`);
  }
  const key = `neon_drift_best_${TRACKS[currentTrackIdx].id}`;
  const prev = parseFloat(localStorage.getItem(key) || '9999');
  if (bestLap < prev) localStorage.setItem(key, bestLap.toFixed(2));
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

function updatePowerUps(dt: number, time: number) {
  if (!player) return;
  powerUps.forEach(pu => {
    pu.update(dt, time);
    if (pu.active && player.group.position.distanceTo(pu.group.position) < 1.8) {
      pu.collect();
      audio.playTone(1200, 0.2, 'square', 0.4);
      if (pu.type === 'shield') {
        shieldActive = true;
        shieldTimer = 8;
      } else if (pu.type === 'missile') {
        missileCooldown = 0;
        input.missile = true;
      } else if (pu.type === 'turbo') {
        player.boostCharge = 1;
        player.speed *= 1.3;
      }
    }
  });
  if (shieldActive) {
    shieldTimer -= dt;
    if (shieldTimer <= 0) shieldActive = false;
  }
  if (missileCooldown > 0) missileCooldown -= dt;
}

function updateTurboZones() {
  if (!player) return;
  turboZones.forEach(z => {
    z.mesh.rotation.z += 0.01;
    if (player.group.position.distanceTo(z.center) < z.radius) {
      player.speed *= 1.02;
      player.boostCharge = Math.min(1, player.boostCharge + 0.01);
    }
  });
}

function updateJumpRamps() {
  if (!player) return;
  jumpRamps.forEach(ramp => {
    if (player.group.position.distanceTo(ramp.position) < 3 && player.speed > 20) {
      player.group.position.y += 0.5;
      player.speed *= 1.1;
    }
  });
}

function fireMissile() {
  if (!player || missileCooldown > 0) return;
  missileCooldown = 5;
  // Find closest AI
  let closest = null;
  let minDist = Infinity;
  aiVehicles.forEach(ai => {
    const d = player!.group.position.distanceTo(ai.group.position);
    if (d < minDist && d < 20) {
      minDist = d;
      closest = ai;
    }
  });
  if (closest) {
    (closest as HoverVehicle).speed *= 0.5;
    audio.playTone(200, 0.5, 'sawtooth', 0.5);
  }
}

function updateAI(dt: number) {
  if (!track) return;
  aiVehicles.forEach((ai, idx) => {
    const closest = track!.getClosestPoint(ai.group.position);
    // Rubberbanding
    const playerT = player ? track!.getClosestPoint(player!.group.position).t + player!.lap : 0;
    const aiT = closest.t + ai.lap;
    const diff = playerT - aiT;
    const speedBoost = Math.max(0, diff * 5);
    
    const targetT = (closest.t + 0.012 + idx*0.002) % 1;
    const targetPos = track!.curve.getPointAt(targetT);
    const dir = targetPos.clone().sub(ai.group.position).normalize();
    const forward = ai.getForward();
    const steer = Math.sign(dir.x * forward.z - dir.z * forward.x) * 0.6;
    const throttle = 0.85 + Math.sin(performance.now()*0.001 + idx)*0.1 + speedBoost*0.01;
    ai.update(dt, { throttle, brake:0, steer, boost:false }, track!.getStartTangent());
  });
}

function handleCollisions(dt: number) {
  if (!player) return;
  collisionCooldown -= dt;
  if (shieldActive) return;
  for (const ai of aiVehicles) {
    const dist = player.group.position.distanceTo(ai.group.position);
    if (dist < 2.0 && collisionCooldown <= 0) {
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
  titleDoc?.getElementById('btn-play')?.addEventListener('click', () => { gameMode='race'; gameState='track_select'; showUI('trackselect'); updateTrackSelectUI(); });
  titleDoc?.getElementById('btn-timetrial')?.addEventListener('click', () => { gameMode='timetrial'; gameState='track_select'; showUI('trackselect'); updateTrackSelectUI(); });
  titleDoc?.getElementById('btn-championship')?.addEventListener('click', () => { gameMode='championship'; championshipRaceIdx=0; championshipPoints=0; championshipTotalPoints=0; gameState='track_select'; currentTrackIdx=0; showUI('trackselect'); updateTrackSelectUI(); });
  titleDoc?.getElementById('btn-leaderboard')?.addEventListener('click', () => { gameState='leaderboard'; showUI('leaderboard'); });
  titleDoc?.getElementById('btn-settings')?.addEventListener('click', () => { gameState='settings'; showUI('settings'); updateSettingsUI(); });

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
  setDoc?.getElementById('btn_skin_prev')?.addEventListener('click', () => { vehicleSkinIdx = (vehicleSkinIdx + VEHICLE_SKINS.length -1) % VEHICLE_SKINS.length; updateSettingsUI(); });
  setDoc?.getElementById('btn_skin_next')?.addEventListener('click', () => { vehicleSkinIdx = (vehicleSkinIdx +1) % VEHICLE_SKINS.length; updateSettingsUI(); });
  setDoc?.getElementById('btn_weather')?.addEventListener('click', () => { weatherRainActive = !weatherRainActive; if (weatherRainActive) initRain(); else clearRain(); updateSettingsUI(); });
}

function updateTrackSelectUI() {
  const doc = ui.trackselect.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
  setText(doc, 'track_name', TRACKS[currentTrackIdx].name);
}

function updateSettingsUI() {
  const doc = ui.settings.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
  const skinNames = ['Cyan', 'Magenta', 'Yellow', 'Green'];
  setText(doc, 'skin_name', skinNames[vehicleSkinIdx]);
  setText(doc, 'weather_val', weatherRainActive ? 'ON' : 'OFF');
}

function initRain() {
  clearRain();
  const count = 200;
  for (let i=0;i<count;i++) {
    const geo = new SphereGeometry(0.02, 4,4);
    const mat = new MeshBasicMaterial({ color: 0x88ccff, transparent:true, opacity:0.6 });
    const mesh = new Mesh(geo, mat);
    mesh.position.set((Math.random()-0.5)*80, 10+Math.random()*10, (Math.random()-0.5)*80);
    world.scene.add(mesh);
    rainParticles.push(mesh);
  }
}

function clearRain() {
  rainParticles.forEach(m => world.scene.remove(m));
  rainParticles = [];
}

function updateRain(dt: number) {
  if (!weatherRainActive) return;
  rainParticles.forEach(m => {
    m.position.y -= dt * 20;
    if (m.position.y < 0) {
      m.position.y = 10 + Math.random()*10;
      m.position.x = (Math.random()-0.5)*80;
      m.position.z = (Math.random()-0.5)*80;
    }
  });
}

setTimeout(setupUIHandlers, 1000);

const system = createSystem((world, dt) => {
  const time = performance.now() / 1000;
  
  if (countdownActive) {
    raceCountdown -= dt;
    if (raceCountdown <= 0) countdownActive = false;
    else return;
  }

  if (world.input.keyboard.getKeyDown('Escape')) {
    if (gameState === 'racing') { gameState='paused'; showUI('pause'); }
    else if (gameState === 'paused') { gameState='racing'; showUI('hud'); }
  }

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

  input.throttle = 0; input.brake=0; input.steer=0; input.boost=false; input.drift=false; input.missile=false;
  const kb = world.input.keyboard;
  if (kb.getKeyPressed('KeyW') || kb.getKeyPressed('ArrowUp')) input.throttle = 1;
  if (kb.getKeyPressed('KeyS') || kb.getKeyPressed('ArrowDown')) input.brake = 1;
  if (kb.getKeyPressed('KeyA') || kb.getKeyPressed('ArrowLeft')) input.steer = 1;
  if (kb.getKeyPressed('KeyD') || kb.getKeyPressed('ArrowRight')) input.steer = -1;
  if (kb.getKeyPressed('Space')) input.boost = true;
  if (kb.getKeyPressed('ShiftLeft') || kb.getKeyPressed('ShiftRight')) input.drift = true;
  if (kb.getKeyDown('KeyM')) input.missile = true;

  const gp = world.input.xr.gamepads.right;
  if (gp) {
    const trig = gp.getButtonPressed(InputComponent.Trigger);
    if (trig) input.throttle = trig;
    const stick = gp.getAxesValues(InputComponent.Thumbstick);
    if (stick) input.steer = -stick.x;
    if (gp.getButtonPressed(InputComponent.A_Button)) input.boost = true;
    if (gp.getButtonPressed(InputComponent.Squeeze)) input.drift = true;
    if (gp.getButtonDown(InputComponent.B_Button)) input.missile = true;
  }

  if (input.missile) fireMissile();

  const tangent = track.getStartTangent();
  if (input.boost && player.boostCharge > 0.1) {
    player.mesh.material.emissiveIntensity = 1.2;
  } else {
    player.mesh.material.emissiveIntensity = 0.6;
  }

  if (input.drift && Math.abs(player.speed) > 5) {
    input.steer *= 1.5;
    player.speed *= 0.995;
    if (Math.random() < 0.3) effects.spawnDriftSparks(player.group.position.clone());
    driftComboTimer = 1.5;
    driftCombo = Math.min(10, driftCombo + dt * 2);
  } else {
    driftComboTimer -= dt;
    if (driftComboTimer <= 0) driftCombo = 0;
  }

  player.update(dt, input, tangent);
  updateAI(dt);
  checkCheckpoints();
  updateBoostPads();
  updatePowerUps(dt, time);
  updateTurboZones();
  updateJumpRamps();
  handleCollisions(dt);
  
  // Update moving hazards
  hazardObstacles.forEach(h => {
    h.t = (h.t + h.speed * dt * 0.05) % 1;
    const pos = track!.curve.getPointAt(h.t);
    pos.y += 0.8 + Math.sin(time * 2 + h.t * 10) * 0.3;
    h.mesh.position.copy(pos);
    h.mesh.rotation.y += dt * 2;
    h.mesh.rotation.x += dt * 1.5;
    // Collision with player
    if (!shieldActive && player!.group.position.distanceTo(pos) < 1.5) {
      player!.speed *= 0.5;
      audio.playTone(100, 0.2, 'sawtooth', 0.3);
      const dir = player!.group.position.clone().sub(pos).normalize();
      player!.group.position.add(dir.multiplyScalar(0.8));
    }
  });
  
  updateHUD();
  
  effects.updateSpeedLines(player.group.position, player.speed, dt);
  effects.setShieldActive(player.group.position, shieldActive);
  effects.update(dt);
  updateRain(dt);

  if (track) {
    const aiPos = aiVehicles.map(v => v.group.position);
    minimap.update(track, player.group.position, aiPos);
  }

  if (ghostTrail.length < 1000) ghostTrail.push(player.group.position.clone());
  else {
    ghostTrail.shift();
    ghostTrail.push(player.group.position.clone());
  }

  if (Math.random() < 0.05) audio.engineSound(Math.abs(player.speed)/50);
});

world.registerSystem(system);
showUI('title');
