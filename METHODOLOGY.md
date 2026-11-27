# Methodology — Skyridge Courier

## What it is

A complete, original flight game for the make.fun bounty "Make the best flight game"
($500). The player flies a mail courier down a 9,000 m winding valley in three legs
(Ridge Run, Canyon Run, Storm Line), through 28 amber target rings, past drifting
hot-air balloons and storm clouds, and lands on a runway at the end to deliver the
mail. It is a pseudo-3D chase view drawn on a 2D canvas: no library, no build step,
no network request, every file under `game/`.

## How it was built

- `game/src/config.js` — every tuning number in one place (speeds, fuel, scoring,
  camera, route).
- `game/src/random.js` — a seeded generator (Mulberry32) plus a stable coordinate
  hash, so one seed always builds the same valley, rings and weather.
- `game/src/world.js` — the valley (centreline, rolling floor, steep walls, a
  flattened runway apron), the rings, balloons and storm clouds, and the step
  function: throttle/speed, banked turns (heading rate from bank and speed, as in
  real flight), pitch, stall, fuel, ring passes, balloon pops and near-misses,
  storm damage, leg changes, and the runway touchdown rules.
- `game/src/render.js` — the chase camera and perspective projection, the sky with
  sun and parallax ridges, the ground drawn slice by slice far-to-near (patchwork
  fields, river, road, runway, valley walls), the billboards (trees, houses, rings,
  balloons, storm clouds), the vector-drawn courier banking with the turn, and the
  HUD: airspeed/altitude tapes, compass strip, artificial horizon, fuel/hull/
  throttle bars, next-ring pointer, flashing warnings and leg banners.
- `game/src/audio.js` — every sound synthesised with WebAudio (engine drone, wind,
  ring chime, warnings, crash, landing fanfare). No audio files are shipped.
- `game/src/input.js` — keyboard (arrows/WASD, Shift/Ctrl throttle, Space/P/M/R)
  and mouse steering.
- `game/src/shots.js` — the four screenshot scenes, each played forward by an
  autopilot that steers at the next ring (or the runway), so every shot is a real
  frame of a real flight at a fixed seed.
- `game/src/main.js` — the fixed-step loop, the five screens (title, play, paused,
  landed, crashed), best-score saving and the shot mode (`?shot=…&seed=N`).
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output`,
  writes `dossier.json` with the vendored `buildDossier`, then reads the hand-in
  back and checks the dossier parses, `game/index.html` is there and 3–4
  screenshots were copied.

## How it was verified

- Played headless in Chrome for Testing with Playwright: the title, a mid-flight
  frame, a ring pass and the final approach were screenshotted at 1280×720 and
  inspected by eye; the defects found (listed below) were fixed and re-shot.
- The autopilot flies the whole route at seed 7 (the screenshots' seed): it
  completes all three legs and lands, which exercises the rings, the balloons,
  the storm and the runway rules end to end.
- `test_determinism.sh` runs `main.ts` twice into two directories and requires
  byte-identical output, and checks `dossier.json` parses.
- The entrypoint was run as user `nobody` against a 777 output directory with
  `MAKEFUN_OUTPUT_DIR`, expecting exit 0 and byte-identical output to a local run.

## Defects found by looking at the renders (and fixed)

1. **The plane flew 50° off-axis and crashed into the valley wall within 5 s.**
   The heading update had the wrong sign: banking right turned the nose
   left, so the autopilot chased every ring in the wrong direction and the
   whole valley rendered as one diagonal slab. Flipped the sign in
   `world.js`; the plane now tracks the centreline and the horizon is level.
2. **The autopilot's throttle ran away to 100%.** It returned a fixed +0.35
   delta, so after a few seconds the throttle pinned at full and the speed
   sat at the 96 m/s cap. It now steers the throttle toward a target
   (0.65 cruise, 0.30 on final).
3. **The autopilot never landed.** The step function clamped altitude to a
   2 m floor, which kept the plane above the ground+1.5 m landing trigger
   forever — it flew past the airfield and crashed out of the valley. The
   floor is gone; the flare now aims below the strip and the ground check
   stops the plane at the trigger.
4. **The last ring was a trap.** It sat at 8920 m, 80 m before the runway
   end, at up to 150 m altitude — grabbing it left no room to land. Leg 3
   rings now end 500 m before the threshold, sit lower (55–105 m) and
   nearer the centreline (±25 m).
5. **The final approach lined up too late.** The plane was still 40–55 m
   off the centreline at touchdown on one seed. The autopilot now blends
   its target toward the runway from 2500 m out.
6. **Fuel ran dry on 2 of 4 seeds.** Drain 0.85→0.70/s, ring fuel 6→8:
   a pilot who flies the rings finishes with 60–80 fuel; one who ignores
   them glides in dry around 80% of the route.
7. **The valley walls were zebra stripes.** Each 60 m slice picked rock or
   forest by hash, so the walls read as diagonal bands. They now shade by
   smooth noise, with pines speckling the rock.
8. **Storm clouds clustered into a grey wall in the plane's face** in the
   landing shot. They now sit at 115–200 m (above the flight path),
   stratified 16 across leg 3 instead of 22 random, and clouds closer
   than 120 m to the camera are skipped.
9. **The landing screenshot caught a 14 m near-ground frame** with the
   TERRAIN warning flashing. The scene now flies the whole route on the
   autopilot and catches the approach 700 m out (score 1700, 17/28 rings,
   1:53 in the dossier shot).
10. **Trees grew on the runway strip, and pines 20 m from the camera
    filled a quarter of the frame.** Both are excluded now (no trees within
    22 m of the strip; nothing closer than 80 m to the camera).
11. **The propeller blur read as a target ring.** Thinned and faded it.

Autopilot verification (headless, `autopilot-test.mjs`): **10/10 seeds
land** (1, 2, 3, 5, 7, 11, 13, 21, 42, 99), ~124 s each, 15–21 of 28
rings, scores 3664–4285, fuel 64–83 left, storm damage 11–29. A human
player with mouse steering and anticipation can beat that; the autopilot
is a floor, not a ceiling.
