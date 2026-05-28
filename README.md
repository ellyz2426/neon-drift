# 🏀 Neon Hoops

**A neon-drenched basketball game built with IWSDK (Immersive Web SDK) — playable in browser and VR.**

[![Play Now](https://img.shields.io/badge/Play%20Now-GitHub%20Pages-00ccff?style=for-the-badge)](https://ellyz2426.github.io/neon-hoops/)

Neon Hoops drops you into a holodeck-style basketball court with glowing neon lines, floating wireframe decorations, and a synthwave soundtrack. Shoot hoops from the free throw line, chase high scores in Arcade mode, battle an AI opponent in H.O.R.S.E., or master all 10 trick shots. Works in any modern browser with mouse/keyboard — and in VR with Meta Quest controllers.

---

## 🎮 Game Modes

| Mode | Description |
|------|-------------|
| **Free Throw** | Classic 10-shot challenge from the free throw line. Aim for a perfect 10/10. |
| **Three-Point Contest** | 5 racks of 5 balls around the three-point arc, 60-second timer. Chase the high score. |
| **Arcade** | Progressive difficulty — start with 30 seconds, earn +3s (or +5s on swish) per make. Rim shrinks as levels increase. Moving shot positions push further from the hoop. Level milestones at 5, 10, 15, 20, 25, 30. |
| **H.O.R.S.E.** | Classic letter-matching duel against an AI opponent. First to spell H-O-R-S-E loses. Difficulty setting controls wind strength. |
| **Trick Shots** | 10 unique challenges requiring specific shot types — swishes from half court, bank shots off the glass, corner threes, and more. |
| **Daily Challenge** | Same 10-shot sequence for everyone each day (seeded RNG). Compare your best score. |
| **Practice** | Unlimited shots, no timer, no pressure. Just shoot. |

---

## 🕹️ Controls

### Browser (Mouse + Keyboard)

| Action | Control |
|--------|---------|
| Shoot | Click and drag up to charge power, release to shoot |
| Aim | Move mouse left/right while charging |
| Pause | `Escape` |
| Restart (Game Over) | `R` |
| Return to Menu (Game Over) | `M` |
| Quick Mode Select (Title/Mode Screen) | `1`–`7` |

### VR (Meta Quest Controllers)

| Action | Control |
|--------|---------|
| Shoot | Hold right trigger to charge, release to shoot |
| Pause | `B` button (right controller) |
| Navigate Menus | Controller laser pointer + trigger click |

---

## 🎨 Court Themes

Switch between 5 neon court themes from the Settings menu:

| Theme | Palette |
|-------|---------|
| **Neon Arena** | Orange neon, dark blue court |
| **Cyberpunk** | Magenta/purple, deep violet court |
| **Arctic Court** | Cyan/ice blue, navy court |
| **Solar Blaze** | Gold/amber, warm dark court |
| **Toxic Green** | Bright green, dark emerald court |

---

## 🏆 Achievements (20 Total)

| Achievement | Requirement |
|-------------|-------------|
| First Basket | Make your first shot |
| Sharpshooter | Make 5 in a row |
| Perfect 10 | Go 10/10 in Free Throw |
| Downtown | Hit a three-pointer |
| Swish Master | 5 swishes in one game |
| Bank Artist | 3 bank shots in one game |
| On Fire | 10-shot streak |
| Century Club | Score 100+ in one game |
| Marksman | 80%+ accuracy (10+ shots) |
| Long Range | Make a half-court shot |
| Trick Master | Complete all 10 trick shots |
| Horse Tamer | Win a game of H.O.R.S.E. |
| Arcade Star | Score 50+ in Arcade |
| Arcade Legend | Score 100+ in Arcade |
| Downtown Sniper | 20+ in Three-Point Contest |
| Untouchable | Win H.O.R.S.E. with no misses |
| Regular | Play 10 games |
| Veteran | Play 50 games |
| Centurion | Make 100 total shots |
| Hall of Famer | Make 500 total shots |

---

## 🎯 Trick Shots (10 Challenges)

1. **Nothing But Net** — Swish from the free throw line
2. **Bank It** — Bank shot off the backboard
3. **Corner Three** — Make it from the corner
4. **Downtown** — Hit from half court
5. **Side Swish** — Swish from the wing
6. **Off the Glass** — Bank shot from distance
7. **Baseline Bomb** — Score from the baseline
8. **Pure Splash** — Swish from the three-point arc
9. **Glass Cleaner** — Bank from the elbow
10. **Impossible** — Swish from half court

---

## 🏀 Ball Skins

8 customizable ball appearances (Settings → Ball Select):

Classic Orange · Neon Blue · Plasma Green · Hot Pink · Gold Rush · Void Purple · Ice White · Lava Core

---

## ✨ Features

- **Arc-trajectory physics** — 4-substep integration with gravity, rim/backboard/floor collisions, ball spin
- **Procedural synthwave music** — Am-F-C-G chord progression, sawtooth bass, square wave arpeggios, hi-hat pattern, 110 BPM
- **17+ procedural SFX** — throw whoosh, swish, rim hit, backboard hit, floor bounce, net swoosh, charge hum, countdown ticks, fanfares, achievement jingle, dribble, crowd cheer, and more
- **Wind system** — dynamic N/S/E/W wind tied to difficulty selection
- **Instant replay** — ghost trail of your last successful shot
- **Ball trail** — glowing trail with additive blending follows the ball in flight
- **Shot arc preview** — dotted trajectory arc shows projected path while charging
- **Net physics animation** — net rings sway on makes with decay
- **Ball shadow** — dynamic court shadow scales with altitude
- **Rim glow indicator** — color-coded proximity feedback during flight
- **Confetti system** — colorful confetti burst on achievement unlocks
- **Score popup effects** — floating accent particles on makes
- **Idle dribble animation** — ball bounces after 3 seconds of inactivity
- **Holodeck environment** — neon grid floor/ceiling, 12 floating wireframe shapes, 40 ambient particles, fog
- **Career stats** — tracks total games, career makes, best streak, high scores per mode
- **Leaderboard** — top 20 scores with mode, accuracy, and date
- **Tutorial** — first-time player guide with controls and tips
- **All UI in PanelUI** — 17 `.uikitml` spatial panels, zero HTML DOM overlays — works in both browser and VR

---

## 🛠️ Technical Notes

- Built with **[IWSDK](https://iwsdk.dev) 0.4.1** (Immersive Web SDK)
- **Dual-runtime architecture** — `xr: { offer: 'once' }` + `canvasPointerEvents` enables both VR and browser play
- **All game UI uses IWSDK's PanelUI** (`.uikitml` compiled by `@iwsdk/vite-plugin-uikitml`) — no HTML DOM overlays, ensuring full XR compatibility
- **7 source modules**: `index.ts` (main loop + game logic), `types.ts` (interfaces + config), `audio.ts` (procedural Web Audio), `physics.ts` (arc trajectory + collisions), `particles.ts` (particle effects), `court.ts` (geometry + environment), `effects.ts` (shadow, glow, replay, confetti, wind, dribble)
- **17 PanelUI templates** in `ui/` directory — title, mode select, difficulty, HUD, power bar, toast, countdown, pause, game over, leaderboard, achievements, settings, ball select, help, daily challenge, career stats, tutorial
- **Procedural audio** — all sound generated at runtime via Web Audio API oscillators, noise buffers, and filters — no audio files loaded
- **localStorage persistence** — achievements, leaderboard, settings, career stats, daily challenge history

---

## 🚀 Development

### Prerequisites

- Node.js ≥ 20.19.0

### Setup

```bash
git clone https://github.com/ellyz2426/neon-hoops.git
cd neon-hoops
npm install
```

### Dev Server

```bash
npm run dev
```

Opens at `https://localhost:8081` with hot reload and headless Playwright Chromium for XR emulation.

### Build

```bash
npm run build
```

Outputs static files to `dist/`.

### Deploy to GitHub Pages

```bash
npm run build
PROJECT="$PWD"
cd /tmp && rm -rf gh-pages-deploy && mkdir gh-pages-deploy && cd gh-pages-deploy
git init && cp -R "$PROJECT/dist/." .
git add -A && git commit -m "Deploy"
git push --force "https://github.com/ellyz2426/neon-hoops.git" HEAD:gh-pages
```

---

## 📄 License

MIT
