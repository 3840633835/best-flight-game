// The screenshot scenes behind ?shot=title|flight|ring|landing. Each one plays the
// real rules forward from a fresh world, steered by a simple autopilot (point the nose
// at the next ring, climb or dive toward its height, ease off near the runway), so the
// frame is what a real flight looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';
import { clamp } from './random.js';

const TITLE_SECONDS = 5;
const FLIGHT_SECONDS = 16;

/** The autopilot's control for this step: steer at the next ring, or at the runway
 *  once the rings are done. */
export function autopilot(world) {
  const s = world.state;
  const p = s.plane;
  const ring = world.nextRing();
  // Chase a ring only while it leaves room to land afterwards: rings inside
  // the final 450 m are skipped and the plane follows the glide path instead.
  const chase = ring && ring.z < world.routeEnd - 450;
  let targetX;
  let targetAlt;
  let targetThrottle = 0.65; // cruise: the autopilot holds the throttle near here
  if (chase) {
    targetX = ring.x;
    targetAlt = ring.alt;
    // In the last 2500 m, drift the target toward the runway centreline, so
    // the plane is already lined up when the final approach starts — chasing
    // a ring 40 m off the centreline at the last moment leaves no time to
    // swing back before the strip.
    const blend = clamp((p.z - (world.routeEnd - 2500)) / 2500, 0, 1);
    targetX = targetX + (world.runwayX - targetX) * blend;
  } else {
    // No rings left: line up on the runway and come down. Inside 400 m the
    // target is the strip itself, so the plane flares onto it instead of
    // levelling off above it and flying past the airfield.
    targetX = world.runwayX;
    const toGo = world.routeEnd - p.z;
    if (toGo < 400) {
      // Aim BELOW the strip: the ground check stops the plane at ground + 1.5,
      // and a proportional controller aimed at the strip itself would float
      // just above it forever, never crossing the landing trigger.
      targetAlt = world.groundY(p.x, p.z) - 2;
      targetThrottle = 0.3;
    } else {
      targetAlt = Math.max(world.groundY(p.x, p.z) + 8, 18 + toGo * 0.045);
      targetThrottle = toGo < 500 ? 0.35 : 0.55;
    }
  }
  const wantHeading = Math.atan2(targetX - p.x, Math.max(40, (chase ? ring.z : world.routeEnd) - p.z));
  let turn = clamp((wantHeading - p.heading) * 3.0, -1, 1);
  // Ease the bank off when nearly lined up, so the shot is level.
  if (Math.abs(wantHeading - p.heading) < 0.03) turn = 0;
  const pitch = clamp((targetAlt - p.alt) * 0.025, -1, 1);
  // Throttle is a delta in world.step, so steer it toward the target setting.
  const throttle = clamp((targetThrottle - p.throttle) * 3, -1, 1);
  return { turn, pitch, throttle };
}

/**
 * Set `world` to the named scene (title, flight, ring or landing; any other name is
 * the title) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'flight' && name !== 'ring' && name !== 'landing') {
    for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) world.step(STEP, autopilot(world));
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'flight') {
    for (let i = 0; i < FLIGHT_SECONDS / STEP; i += 1) {
      world.step(STEP, autopilot(world));
      if (world.state.status !== 'flying') break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'ring') {
    // Fly until the sixth ring is about a second ahead: the frame catches the ring
    // around the plane, the valley behind it, the HUD lit.
    for (let i = 0; i < 300 / STEP; i += 1) {
      const ring = world.nextRing();
      if (!ring) break;
      if (world.rings.indexOf(ring) >= 5 && ring.z - world.state.plane.z < world.state.plane.speed * 1.2) break;
      world.step(STEP, autopilot(world));
      if (world.state.status !== 'flying') break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  // Landing: fly the whole route on the autopilot and catch the final
  // approach 700 m out — the real score and ring count, the plane on the
  // glide path, the strip ahead and the storm behind it. (A teleported
  // approach climbed straight into a storm cloud and read as a crash.)
  for (let i = 0; i < 300 / STEP; i += 1) {
    world.step(STEP, autopilot(world));
    if (world.state.status !== 'flying') break;
    if (world.routeEnd - world.state.plane.z <= 700) break;
  }
  return { screen: SCREEN_PLAY, best: world.state.score };
}
