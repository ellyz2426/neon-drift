import { World, PanelUI, Follower, FollowBehavior, PanelDocument, UIKitDocument, createSystem, InputComponent } from '@iwsdk/core';
import { MeshBasicMaterial, GridHelper, Fog, Color, AmbientLight, DirectionalLight, PointLight } from '@iwsdk/core';
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

const ambient = new AmbientLight(0x404080, 0.6);
world.scene.add(ambient);
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
let currentTrackId = TRACKS[0].id;
let lapStartTime = 0;
let bestLap = Infinity;

const input = { throttle: 0, brake: 0, steer: 0, boost: false };

function setText(doc: UIKitDocument | undefined, id: string, text: string) {
  const el = doc?.getElementById(id);
  if (el) (el as any).text.value = text;
}

function createUI(template: string, followHead = false) {
  const ent = world.createTransformEntity(undefined, { persistent: true });
  ent.addComponent(PanelUI, { config: `/ui/${template}.json`, maxWidth: 0.8, maxHeight: 0.6 });
  if (followHead) {
    ent.addComponent(Follower, { target: world.player.head, offsetPosition: [0, -0.2, -1.2], behavior: FollowBehavior.PivotY, speed: 5 });
  }
  return ent;
}

const uiEntities = {
  title: createUI('title'),
  trackselect: createUI('trackselect'),
  hud: createUI('hud', true),
  pause: createUI('pause'),
  raceover: createUI('raceover'),
  leaderboard: createUI('leaderboard'),
  settings: createUI('settings'),
};

Object.values(uiEntities).forEach(e => e.object3D.visible = false);
uiEntities.title.object3D.visible = true;

function showUI(state: GameState) {
  Object.values(uiEntities).forEach(e => e.object3D.visible = false);
  uiEntities[state as keyof typeof uiEntities]?.object3D && (uiEntities[state as keyof typeof uiEntities].object3D.visible = true);
}

function startRace(trackId: string) {
  if (track) world.scene.remove(track.group);
  aiVehicles.forEach(v => world.scene.remove(v.group));
  aiVehicles = [];
  if (player) world.scene.remove(player.group);

  track = new Track(trackId);
  world.scene.add(track.group);

  player = new HoverVehicle(HOVER_COLORS.player, true);
  const startPos = track.getStartPosition();
  const startTan = track.getStartTangent();
  player.setPosition(startPos, startTan);
  world.scene.add(player.group);

  // AI
  const colors = [HOVER_COLORS.ai1, HOVER_COLORS.ai2, HOVER_COLORS.ai3];
  for (let i=0;i<3;i++) {
    const ai = new HoverVehicle(colors[i]);
    const offset = new Vector3((i+1)*2,0,0);
    ai.setPosition(startPos.clone().add(offset), startTan);
    ai.speed = 10;
    world.scene.add(ai.group);
    aiVehicles.push(ai);
  }

  lapStartTime = performance.now() / 1000;
  bestLap = Infinity;
  gameState = 'racing';
  showUI('hud');
  audio.init();
  audio.raceStart();
}

function updateHUD(doc: UIKitDocument | undefined) {
  if (!player) return;
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
    return { v, t: closest.t + v.lap };
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
  const doc = uiEntities.raceover.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
  setText(doc, 'final_position', `P${getPosition()}`);
  setText(doc, 'best_lap', `${bestLap.toFixed(2)}s`);
}

function updateAI(dt: number) {
  if (!track) return;
  aiVehicles.forEach((ai, idx) => {
    const closest = track!.getClosestPoint(ai.group.position);
    const targetT = (closest.t + 0.01) % 1;
    const targetPos = track!.curve.getPointAt(targetT);
    const dir = targetPos.clone().sub(ai.group.position).normalize();
    const forward = ai.getForward();
    const steer = Math.sign(dir.x * forward.z - dir.z * forward.x) * 0.5;
    ai.update(dt, { throttle: 0.8, brake: 0, steer, boost: false }, track!.getStartTangent());
  });
}

const system = createSystem((world, dt) => {
  // Input
  input.throttle = 0;
  input.brake = 0;
  input.steer = 0;
  input.boost = false;

  if (gameState === 'racing' && player) {
    const kb = world.input.keyboard;
    if (kb.getKeyPressed('KeyW') || kb.getKeyPressed('ArrowUp')) input.throttle = 1;
    if (kb.getKeyPressed('KeyS') || kb.getKeyPressed('ArrowDown')) input.brake = 1;
    if (kb.getKeyPressed('KeyA') || kb.getKeyPressed('ArrowLeft')) input.steer = 1;
    if (kb.getKeyPressed('KeyD') || kb.getKeyPressed('ArrowRight')) input.steer = -1;
    if (kb.getKeyPressed('Space')) input.boost = true;

    const gp = world.input.xr.gamepads.right;
    if (gp) {
      const trig = gp.getButtonPressed(InputComponent.Trigger);
      if (trig) input.throttle = trig;
      const stick = gp.getAxesValues(InputComponent.Thumbstick);
      if (stick) input.steer = -stick.x;
      if (gp.getButtonPressed(InputComponent.A_Button)) input.boost = true;
    }

    const tangent = track?.getStartTangent() ?? new Vector3(0,0,-1);
    player.update(dt, input, tangent);
    updateAI(dt);
    checkCheckpoints();

    const hudDoc = uiEntities.hud.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    updateHUD(hudDoc);

    // Engine sound
    if (Math.random() < 0.1) audio.engineSound(Math.abs(player.speed)/45);
  }

  // UI interactions
  const titleDoc = uiEntities.title.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
  titleDoc?.getElementById('btn-play')?.addEventListener('click', () => {
    gameState = 'track_select';
    showUI('trackselect');
    const tsDoc = uiEntities.trackselect.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    setText(tsDoc, 'track_name', TRACKS[0].name);
  });

  const tsDoc = uiEntities.trackselect.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
  tsDoc?.getElementById('btn_start')?.addEventListener('click', () => startRace(currentTrackId));
  tsDoc?.getElementById('btn_back')?.addEventListener('click', () => { gameState='title'; showUI('title'); });

  // Pause
  if (world.input.keyboard.getKeyDown('Escape')) {
    if (gameState === 'racing') { gameState='paused'; showUI('pause'); }
    else if (gameState === 'paused') { gameState='racing'; showUI('hud'); }
  }
});

world.registerSystem(system);

// Initial UI
showUI('title');
