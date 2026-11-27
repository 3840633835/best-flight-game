// The valley, the route through it and everything the plane can hit or collect:
// the winding centreline, the ground under it, the target rings, the balloons, the
// storm clouds and the runway at the end. All of it is fixed by the seed.

import { ROUTE, PLANE, SCORE } from './config.js';
import { clamp, approach, noise1 } from './random.js';

export const EVENT_RING = 1;
export const EVENT_BUMP = 2;
export const EVENT_LEG = 4;
export const EVENT_LANDED = 8;
export const EVENT_CRASHED = 16;

const LEG_ENDS = (() => {
  const ends = [];
  let total = 0;
  for (const len of ROUTE.legLengths) {
    total += len;
    ends.push(total);
  }
  return ends;
})();
export const ROUTE_END = LEG_ENDS[LEG_ENDS.length - 1];
const RUNWAY_START = ROUTE_END - ROUTE.runwayLength;

export const LEG_NAMES = ['RIDGE RUN', 'CANYON RUN', 'STORM LINE'];

/** The valley's centreline: where the river, the road and the rings all live. */
export function centreXAt(z, phases) {
  return 120 * Math.sin(z * 0.00035 + phases.a) + 60 * Math.sin(z * 0.0009 + phases.b);
}

export function createWorld(random) {
  const phases = { a: random() * 6.283, b: random() * 6.283, c: random() * 6.283, d: random() * 6.283 };
  const runwayX = centreXAt(RUNWAY_START + ROUTE.runwayLength / 2, phases);

  // Rings: spread down each leg, near the centreline, at flyable altitudes.
  const rings = [];
  for (let leg = 0; leg < 3; leg += 1) {
    const start = leg === 0 ? 0 : LEG_ENDS[leg - 1];
    const end = LEG_ENDS[leg];
    const count = ROUTE.ringsPerLeg[leg];
    for (let i = 0; i < count; i += 1) {
      // Leg 3 ends its rings 500 m before the runway threshold: the last ring
      // is a gateway to the airfield, not a trap that leaves no room to land.
      // Its rings also sit lower (55–105 m) so the approach can start early.
      const span = leg === 3 ? end - start - 500 : end - start;
      const z = start + ((i + 1) / (count + 1)) * span;
      rings.push({
        leg,
        z,
        x: centreXAt(z, phases) + (random() - 0.5) * (leg === 3 ? 50 : 80),
        alt: leg === 3 ? 55 + random() * 50 : 55 + random() * 95,
        radius: 16,
        hit: false,
        passed: false,
      });
    }
  }

  // Balloons drift over legs 2 and 3, low enough to matter, high enough to dodge.
  const balloons = [];
  const balloonHues = [12, 38, 150, 205, 280, 330];
  for (let i = 0; i < 36; i += 1) {
    const leg = i < 18 ? 1 : 2;
    const start = LEG_ENDS[leg - 1];
    const end = LEG_ENDS[leg];
    const z = start + random() * (end - start);
    balloons.push({
      z,
      x: centreXAt(z, phases) + (random() - 0.5) * 150,
      alt: 50 + random() * 110,
      radius: 7,
      hue: balloonHues[i % balloonHues.length],
      bob: random() * 6.283,
      active: true,
      scored: false,
    });
  }

  // Storm clouds hang over leg 3: flying through one hurts and shakes the plane.
  const clouds = [];
  // Storm clouds sit high (140–240 m), above the flight path: weather
  // overhead, not a wall in the plane's face. Stratified placement keeps
  // them from clustering into one grey mass.
  for (let i = 0; i < 16; i += 1) {
    const z = LEG_ENDS[1] + ((i + random()) / 16) * (LEG_ENDS[2] - LEG_ENDS[1]);
    clouds.push({
      z,
      x: centreXAt(z, phases) + (random() - 0.5) * 180,
      alt: 115 + random() * 85,
      radius: 24 + random() * 12,
    });
  }

  const state = freshState();

  function freshState() {
    return {
      plane: {
        x: centreXAt(0, phases),
        alt: 42,
        z: 0,
        heading: 0,
        pitch: 0,
        bank: 0,
        speed: 42,
        throttle: 0.55,
        vspeed: 0,
      },
      leg: 0,
      legTime: 0,
      time: 0,
      score: 0,
      ringsHit: 0,
      ringsTotal: rings.length,
      fuel: PLANE.startFuel,
      damage: PLANE.startDamage,
      status: 'flying', // flying | landed | crashed
      reason: '',
      banner: LEG_NAMES[0],
      bannerUntil: 0,
      shake: 0,
      inCloud: false,
      stalled: false,
      fuelOut: false,
      lowFuelWarned: false,
      nextRingIndex: 0,
    };
  }

  /** Ground height at a point: rolling floor, steep walls past the floor edge, and a
   *  flattened strip where the runway sits. */
  function groundY(x, z) {
    const cx = centreXAt(z, phases);
    const d = Math.abs(x - cx);
    let floor = ROUTE.groundRoll * (noise1(z * 0.0035 + phases.c) - 0.5) * 2;
    floor += 3 * (noise1(x * 0.02 + z * 0.001 + phases.d) - 0.5) * 2;
    // Flatten the runway apron.
    if (z > RUNWAY_START - 150 && z < ROUTE_END + 60) {
      const zx = clamp(1 - Math.abs(x - runwayX) / 70, 0, 1);
      const zz = clamp((z - (RUNWAY_START - 150)) / 150, 0, 1) * clamp((ROUTE_END + 60 - z) / 60, 0, 1);
      floor *= 1 - zx * zz;
    }
    if (d <= ROUTE.valleyHalfWidth) return floor;
    const t = clamp((d - ROUTE.valleyHalfWidth) / 130, 0, 1);
    const wall = t * t * (3 - 2 * t);
    return floor + wall * (ROUTE.wallRise + 70 * noise1(z * 0.005 + phases.b));
  }

  /** The river's x at a distance: it meanders across the valley floor. */
  function riverX(z) {
    return centreXAt(z, phases) + 55 * Math.sin(z * 0.0011 + 2.3);
  }

  /** The road's x at a distance: it hugs the other side of the floor. */
  function roadX(z) {
    return centreXAt(z, phases) - 42 + 18 * Math.sin(z * 0.0007 + 0.6);
  }

  function nextRing() {
    for (let i = state.nextRingIndex; i < rings.length; i += 1) {
      if (!rings[i].passed) return rings[i];
    }
    return null;
  }

  function reset() {
    for (const ring of rings) {
      ring.hit = false;
      ring.passed = false;
    }
    for (const balloon of balloons) {
      balloon.active = true;
      balloon.scored = false;
    }
    const fresh = freshState();
    for (const key of Object.keys(fresh)) state[key] = fresh[key];
  }

  /** Advance one fixed step. `control` is {turn, pitch, throttle} in -1..1. Returns
   *  an events bitmask; the caller turns rings and bumps into sound and score text. */
  function step(dt, control) {
    if (state.status !== 'flying') return 0;
    const p = state.plane;
    let events = 0;
    state.time += dt;
    state.legTime += dt;
    if (state.bannerUntil > 0) state.bannerUntil -= dt;
    state.shake = Math.max(0, state.shake - dt * 2);

    // Throttle, speed and the climb/dive trade.
    p.throttle = clamp(p.throttle + control.throttle * dt * 0.45, 0, 1);
    const targetSpeed = PLANE.minSpeed + p.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    p.speed = approach(p.speed, targetSpeed, PLANE.accel * dt);
    const climbFactor = 1 - Math.abs(Math.sin(p.pitch)) * PLANE.climbPenalty * (p.pitch > 0 ? 1 : -0.4);
    p.speed = clamp(p.speed * (1 + (climbFactor - 1) * dt * 0.4), 18, PLANE.maxSpeed + 12);

    // Bank, heading and pitch: a banked turn changes heading like a real one —
    // banking right (right wing down) turns the nose right, toward +x.
    const wantBank = control.turn * PLANE.maxBank;
    p.bank = approach(p.bank, wantBank, PLANE.bankRate * dt);
    p.heading += (9.8 * Math.tan(p.bank) / Math.max(30, p.speed)) * dt;
    const wantPitch = control.pitch * PLANE.maxPitch;
    p.pitch = approach(p.pitch, wantPitch, PLANE.pitchRate * dt);

    // Stall: too slow and the nose drops whatever the pilot asks.
    state.stalled = p.speed < PLANE.minSpeed + 4 && p.throttle < 0.9;
    if (state.stalled) p.pitch = approach(p.pitch, -0.22, dt * 1.2);

    // Motion: forward along the heading, up and down with the pitch.
    p.vspeed = p.speed * Math.sin(p.pitch);
    p.z += p.speed * Math.cos(p.heading) * dt;
    p.x += p.speed * Math.sin(p.heading) * dt;
    p.alt += p.vspeed * dt;
    // No altitude floor here: the ground check below is what ends a flight, and a
    // floor would keep the plane hovering above the runway forever.

    // Fuel: rings pay some back; empty tanks mean a glide, not a stop.
    state.fuelOut = state.fuel <= 0;
    if (!state.fuelOut) {
      state.fuel = Math.max(0, state.fuel - (PLANE.fuelDrain + PLANE.fuelDrainThrottle * p.throttle) * dt);
      if (state.fuel <= 0) p.throttle = 0;
    } else {
      p.speed = approach(p.speed, 30, 6 * dt);
    }
    if (state.fuel < 20 && !state.lowFuelWarned) state.lowFuelWarned = true;

    // Legs: crossing a boundary names the next one.
    const leg = p.z < LEG_ENDS[0] ? 0 : p.z < LEG_ENDS[1] ? 1 : 2;
    if (leg !== state.leg) {
      state.leg = leg;
      state.legTime = 0;
      state.banner = LEG_NAMES[leg];
      state.bannerUntil = 3;
      events |= EVENT_LEG;
    }

    // Rings: crossing a ring's plane scores it or lets it go.
    const prevZ = p.z - p.speed * Math.cos(p.heading) * dt;
    for (let i = state.nextRingIndex; i < rings.length; i += 1) {
      const ring = rings[i];
      if (ring.z <= prevZ) {
        state.nextRingIndex = i + 1;
        continue;
      }
      if (ring.z > p.z) break;
      ring.passed = true;
      state.nextRingIndex = i + 1;
      const dx = p.x - ring.x;
      const dy = p.alt - ring.alt;
      if (dx * dx + dy * dy < ring.radius * ring.radius) {
        ring.hit = true;
        state.ringsHit += 1;
        state.score += SCORE.ring;
        state.fuel = Math.min(PLANE.startFuel, state.fuel + PLANE.fuelPerRing);
        events |= EVENT_RING;
      }
    }

    // Balloons: a touch costs damage and pops the balloon; a close pass pays.
    for (const balloon of balloons) {
      if (!balloon.active) continue;
      if (Math.abs(balloon.z - p.z) > 30) continue;
      const bobY = balloon.alt + Math.sin(state.time * 1.3 + balloon.bob) * 2.5;
      const dx = p.x - balloon.x;
      const dy = p.alt - bobY;
      const dz = p.z - balloon.z;
      const dist2 = dx * dx + dy * dy + dz * dz;
      if (dist2 < (balloon.radius + 3) * (balloon.radius + 3)) {
        balloon.active = false;
        state.damage += PLANE.balloonDamage;
        p.alt += 6;
        p.x += dx > 0 ? 4 : -4;
        state.shake = 1;
        events |= EVENT_BUMP;
      } else if (!balloon.scored && balloon.z < p.z && dist2 < 14 * 14) {
        balloon.scored = true;
        state.score += SCORE.nearMissBalloon;
      }
    }

    // Storm clouds: inside one, damage ticks and the air shakes.
    state.inCloud = false;
    if (state.leg === 2) {
      for (const cloud of clouds) {
        const dx = p.x - cloud.x;
        const dy = p.alt - cloud.alt;
        const dz = p.z - cloud.z;
        if (dx * dx + dy * dy + dz * dz < cloud.radius * cloud.radius) {
          state.inCloud = true;
          state.damage += PLANE.cloudDamagePerSec * dt;
          state.shake = Math.max(state.shake, 0.7);
          break;
        }
      }
    }

    // Damage alone can end a flight.
    if (state.damage >= 100) {
      state.status = 'crashed';
      state.reason = 'The courier broke apart in the air.';
      return events | EVENT_CRASHED;
    }

    // The ground: a runway touchdown lands, anything else crashes.
    const ground = groundY(p.x, p.z);
    if (p.alt <= ground + 1.5) {
      const onRunway = p.z >= RUNWAY_START && p.z <= ROUTE_END + 40 && Math.abs(p.x - runwayX) <= ROUTE.runwayHalfWidth;
      if (onRunway && Math.abs(p.vspeed) <= PLANE.hardLandingSink && p.speed <= PLANE.landingMaxSpeed) {
        state.status = 'landed';
        const parTotal = SCORE.legTime[0] + SCORE.legTime[1] + SCORE.legTime[2];
        const bonus = Math.max(0, Math.floor(parTotal - state.time)) * SCORE.timeBonusPerSec;
        state.score += SCORE.landing + bonus;
        state.reason = `Delivered. Time bonus +${bonus}.`;
        return events | EVENT_LANDED;
      }
      state.status = 'crashed';
      state.reason = onRunway
        ? p.speed > PLANE.landingMaxSpeed
          ? 'Too fast for the runway — the courier ran off the end.'
          : 'Too hard a touchdown — the landing gear gave way.'
        : 'The courier hit the ground.';
      return events | EVENT_CRASHED;
    }

    // Past the airfield without landing: the route is over.
    if (p.z > ROUTE_END + 400) {
      state.status = 'crashed';
      state.reason = 'The courier flew past the airfield and ran out of valley.';
      return events | EVENT_CRASHED;
    }
    return events;
  }

  return {
    state,
    phases,
    rings,
    balloons,
    clouds,
    runwayX,
    routeEnd: ROUTE_END,
    runwayStart: RUNWAY_START,
    legEnds: LEG_ENDS,
    centreXAt: (z) => centreXAt(z, phases),
    groundY,
    riverX,
    roadX,
    nextRing,
    reset,
    step,
  };
}
