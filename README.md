# Skyridge Courier

[![bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=makefun&ref=brisk-lark-63-4025)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/3840633835/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=makefun&ref=brisk-lark-63-4025)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/3840633835/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=makefun&ref=brisk-lark-63-4025)

Airmail over the valley — a complete, original flight game that plays offline in a desktop browser from its own files. Fly the courier down three legs of a winding valley, through twenty-eight amber rings, past the balloons, through the storm line, and land on the runway to deliver the mail.

## The game

- **Chase view over recognisable terrain** — a pseudo-3D valley with patchwork fields, a river, a road, farmhouses, pine trees and ridge walls, flown from behind the aircraft with the instruments lit.
- **Real flying** — bank to turn (a banked turn changes heading like a real one), pitch to climb and dive, throttle to work the speed, and a stall if you get too slow. Fuel drains and the rings pay some back, so a sortie is a set of decisions.
- **Three legs, three moods** — Ridge Run (learn the rings), Canyon Run (balloons drift across the valley — a touch costs a quarter of the hull), Storm Line (storm clouds hurt and shake the plane).
- **A landing that matters** — the runway at the end of leg 3 only holds a gentle, slow touchdown; too fast or too hard and the gear gives way.
- **HUD** — airspeed and altitude tapes, compass strip, artificial horizon, fuel / hull / throttle bars, next-ring pointer, and flashing STALL, LOW FUEL, TERRAIN and storm warnings.
- **Sound** — everything synthesised with WebAudio: an engine drone that follows the throttle, wind that follows the speed, ring chimes, warnings, a crash and a landing fanfare. M mutes.
- **Controls** — ← → or A/D bank and turn, ↑ ↓ or W/S climb and dive, Shift throttle up, Ctrl throttle down, mouse steers too, Space starts, P pauses, R restarts.

## Run it

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

Open http://localhost:8080 in a desktop browser. No build step, no network request: every file the game loads is under `game/`.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library, then reads the hand-in back and checks it. See `METHODOLOGY.md` for how the game was built and verified.

Built for the [make.fun](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=makefun&ref=brisk-lark-63-4025) bounty "Make the best flight game".
