// The picture: a pseudo-3D chase view over the valley. The camera rides behind the
// courier, the ground is drawn slice by slice from far to near, and the plane, the
// rings, the balloons and the clouds are billboards projected onto the same view.
// The HUD is drawn on top: tapes, compass, artificial horizon, fuel and damage.

import { VIEW, CAMERA, ROUTE } from './config.js';
import { clamp, hash2, noise1 } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LANDED = 'landed';
export const SCREEN_CRASHED = 'crashed';

const W = VIEW.width;
const H = VIEW.height;
const FOCAL = CAMERA.focal;
const HORIZON = H * CAMERA.horizonY;

// Field colours for the valley floor's patchwork, picked by a hash of (slice, lane).
const FIELDS = ['#79a854', '#a3b25c', '#c0a05a', '#6d9a4c', '#8fb45e', '#b3924f', '#5f9448'];
const WALL_ROCK = '#8d7d6b';
const WALL_FOREST = '#3e6a33';
const RIDGE_FAR = '#7d94b5';
const RIDGE_NEAR = '#5d7391';

function smoothstep(t) {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

export function createRenderer(canvas) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  /** Project a world point into screen space from the chase camera. Returns null
   *  when the point is behind the camera. */
  function project(cam, x, y, z) {
    const dx = x - cam.x;
    const dy = y - cam.y;
    const dz = z - cam.z;
    const sinH = Math.sin(cam.heading);
    const cosH = Math.cos(cam.heading);
    let depth = dx * sinH + dz * cosH;
    const lateral = dx * cosH - dz * sinH;
    // The camera pitches with the plane, half as much, so climbs show more sky.
    const vp = cam.pitch * 0.5;
    const sinP = Math.sin(vp);
    const cosP = Math.cos(vp);
    const vert = dy * cosP - depth * sinP;
    depth = dy * sinP + depth * cosP;
    if (depth < 2) return null;
    const scale = FOCAL / depth;
    return { x: W / 2 + lateral * scale, y: HORIZON - vert * scale, scale, depth };
  }

  function quad(points, fill) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawSky(cam, time) {
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 40);
    sky.addColorStop(0, '#4f8fd0');
    sky.addColorStop(0.55, '#8fbfe8');
    sky.addColorStop(1, '#f4cf96');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, HORIZON + 40);
    // The sun, low and warm, drifting with the heading.
    const sunX = W * 0.72 - cam.heading * 900;
    const sunY = HORIZON - 150;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
    glow.addColorStop(0, 'rgba(255, 236, 180, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 214, 130, 0.55)');
    glow.addColorStop(1, 'rgba(255, 214, 130, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
    // Two ridges of far mountains, parallaxed by the heading.
    for (let layer = 0; layer < 2; layer += 1) {
      const base = HORIZON + (layer === 0 ? 2 : 10);
      const amp = layer === 0 ? 46 : 70;
      const parallax = cam.heading * (layer === 0 ? 260 : 420);
      ctx.fillStyle = layer === 0 ? RIDGE_FAR : RIDGE_NEAR;
      ctx.beginPath();
      ctx.moveTo(0, base + 30);
      for (let sx = 0; sx <= W; sx += 16) {
        const n = noise1(sx * 0.006 + parallax * 0.01 + layer * 13.7);
        ctx.lineTo(sx, base - n * amp);
      }
      ctx.lineTo(W, base + 30);
      ctx.closePath();
      ctx.fill();
    }
    // High clouds, slow and white.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 7; i += 1) {
      const cx = ((i * 197 + time * 6 - cam.heading * 500) % (W + 320) + W + 320) % (W + 320) - 160;
      const cy = 40 + (i % 3) * 46;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 70 + (i % 3) * 26, 13 + (i % 2) * 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** The valley floor and walls, drawn slice by slice from far to near. */
  function drawGround(world, cam) {
    const slices = [];
    let d = 14;
    while (d < CAMERA.drawDistance) {
      slices.push(d);
      d *= 1.13;
    }
    const sinH = Math.sin(cam.heading);
    const cosH = Math.cos(cam.heading);
    // Far to near, so nearer ground paints over farther ground.
    for (let s = slices.length - 1; s >= 0; s -= 1) {
      const d0 = slices[s];
      const d1 = s + 1 < slices.length ? slices[s + 1] : d0 * 1.13;
      const z0 = cam.z + d0 * cosH;
      const z1 = cam.z + d1 * cosH;
      const cx0 = world.centreXAt(z0);
      const cx1 = world.centreXAt(z1);
      const half = ROUTE.valleyHalfWidth;
      // The floor, in five patchwork lanes.
      for (let lane = 0; lane < 5; lane += 1) {
        const a0 = cx0 - half + (lane / 5) * half * 2;
        const b0 = cx0 - half + ((lane + 1) / 5) * half * 2;
        const a1 = cx1 - half + (lane / 5) * half * 2;
        const b1 = cx1 - half + ((lane + 1) / 5) * half * 2;
        const p1 = project(cam, a0, world.groundY(a0, z0), z0);
        const p2 = project(cam, b0, world.groundY(b0, z0), z0);
        const p3 = project(cam, b1, world.groundY(b1, z1), z1);
        const p4 = project(cam, a1, world.groundY(a1, z1), z1);
        if (!p1 || !p2 || !p3 || !p4) continue;
        const shade = hash2(Math.floor(z0 / 40), lane);
        quad([p1, p2, p3, p4], FIELDS[Math.floor(shade * FIELDS.length)]);
      }
      // The river, a blue ribbon across the floor.
      const r0 = world.riverX(z0);
      const r1 = world.riverX(z1);
      const rp = [
        project(cam, r0 - 6, world.groundY(r0 - 6, z0) + 0.4, z0),
        project(cam, r0 + 6, world.groundY(r0 + 6, z0) + 0.4, z0),
        project(cam, r1 + 6, world.groundY(r1 + 6, z1) + 0.4, z1),
        project(cam, r1 - 6, world.groundY(r1 - 6, z1) + 0.4, z1),
      ];
      if (rp.every(Boolean)) quad(rp, '#5aa3c7');
      // The road, a grey ribbon on the other side.
      const d0x = world.roadX(z0);
      const d1x = world.roadX(z1);
      const dp = [
        project(cam, d0x - 3.5, world.groundY(d0x - 3.5, z0) + 0.4, z0),
        project(cam, d0x + 3.5, world.groundY(d0x + 3.5, z0) + 0.4, z0),
        project(cam, d1x + 3.5, world.groundY(d1x + 3.5, z1) + 0.4, z1),
        project(cam, d1x - 3.5, world.groundY(d1x - 3.5, z1) + 0.4, z1),
      ];
      if (dp.every(Boolean)) quad(dp, '#6f6a63');
      // The runway, when the slices reach the airfield.
      if (z1 > world.runwayStart - 10 && z0 < world.routeEnd + 40) {
        const rx = world.runwayX;
        const hw = ROUTE.runwayHalfWidth;
        const gp = [
          project(cam, rx - hw, world.groundY(rx - hw, z0) + 0.5, z0),
          project(cam, rx + hw, world.groundY(rx + hw, z0) + 0.5, z0),
          project(cam, rx + hw, world.groundY(rx + hw, z1) + 0.5, z1),
          project(cam, rx - hw, world.groundY(rx - hw, z1) + 0.5, z1),
        ];
        if (gp.every(Boolean)) {
          quad(gp, '#45454a');
          // Centreline dashes, one per 40 m of strip.
          const dash = Math.floor(z0 / 40) % 2 === 0;
          if (dash) {
            const cp = [
              project(cam, rx - 1, world.groundY(rx - 1, z0) + 0.7, z0),
              project(cam, rx + 1, world.groundY(rx + 1, z0) + 0.7, z0),
              project(cam, rx + 1, world.groundY(rx + 1, z1) + 0.7, z1),
              project(cam, rx - 1, world.groundY(rx - 1, z1) + 0.7, z1),
            ];
            if (cp.every(Boolean)) quad(cp, '#f2f2ee');
          }
        }
      }
      // The valley walls, left and right, rising past the floor edge.
      for (const side of [-1, 1]) {
        const e0 = cx0 + side * half;
        const e1 = cx1 + side * half;
        const t0 = cx0 + side * (half + 190);
        const t1 = cx1 + side * (half + 190);
        const wp = [
          project(cam, e0, world.groundY(e0, z0), z0),
          project(cam, t0, world.groundY(t0, z0), z0),
          project(cam, t1, world.groundY(t1, z1), z1),
          project(cam, e1, world.groundY(e1, z1), z1),
        ];
        if (!wp.every(Boolean)) continue;
        const wallShade = noise1(z0 * 0.004 + (side + 2) * 7.3);
        quad(wp, wallShade > 0.52 ? WALL_FOREST : WALL_ROCK);
      }
    }
  }

  /** Trees, houses, balloons, clouds and rings, far to near. */
  function drawFeatures(world, cam, time) {
    const items = [];
    const p = world.state.plane;
    // Trees and houses: placed by hash along the slices ahead.
    for (let z = Math.floor((cam.z + 80) / 40) * 40; z < cam.z + 900; z += 40) {
      const cx = world.centreXAt(z);
      for (let lane = 0; lane < 4; lane += 1) {
        const h = hash2(Math.floor(z / 40), lane * 7 + 1);
        if (h < 0.45) continue;
        const x = cx - ROUTE.valleyHalfWidth + 12 + h * (ROUTE.valleyHalfWidth * 2 - 24);
        // Nothing grows on the runway strip.
        if (Math.abs(x - world.runwayX) < 22 && z > world.runwayStart - 60 && z < world.routeEnd + 60) continue;
        const kind = hash2(Math.floor(z / 40), lane * 7 + 2) > 0.9 ? 'house' : 'tree';
        items.push({ z, x, y: world.groundY(x, z), kind, size: kind === 'house' ? 9 : 7 + h * 7 });
      }
    }
    for (const ring of world.rings) {
      if (ring.z > cam.z + 20 && ring.z < cam.z + CAMERA.drawDistance) {
        items.push({ z: ring.z, x: ring.x, y: ring.alt, kind: 'ring', ring });
      }
    }
    // Pines speckle the valley walls too, so the rock is never a bare slab.
    // Like the floor trees, none closer than 80 m to the camera.
    for (let z = Math.floor((cam.z + 80) / 40) * 40; z < cam.z + 900; z += 40) {
      for (const side of [-1, 1]) {
        const h = hash2(Math.floor(z / 40), side * 31 + 5);
        if (h < 0.55) continue;
        const x = world.centreXAt(z) + side * (ROUTE.valleyHalfWidth + 25 + h * 130);
        items.push({ z, x, y: world.groundY(x, z), kind: 'tree', size: 7 + h * 8 });
      }
    }
    for (const balloon of world.balloons) {
      // A balloon 15 m ahead would fill the frame; skip anything closer than 60 m.
      if (!balloon.active || balloon.z < cam.z + 60 || balloon.z > cam.z + CAMERA.drawDistance) continue;
      items.push({ z: balloon.z, x: balloon.x, y: balloon.alt + Math.sin(time * 1.3 + balloon.bob) * 2.5, kind: 'balloon', balloon });
    }
    for (const cloud of world.clouds) {
      // Same for clouds: one 20 m ahead is a wall of grey, not a cloud.
      if (cloud.z > cam.z + 120 && cloud.z < cam.z + CAMERA.drawDistance) {
        items.push({ z: cloud.z, x: cloud.x, y: cloud.alt, kind: 'storm', cloud });
      }
    }
    items.sort((a, b) => b.z - a.z);
    for (const item of items) {
      const pr = project(cam, item.x, item.y, item.z);
      if (!pr) continue;
      if (item.kind === 'tree') {
        const h = item.size * pr.scale;
        if (h < 1) continue;
        ctx.fillStyle = '#2f5c2a';
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y - h);
        ctx.lineTo(pr.x - h * 0.55, pr.y);
        ctx.lineTo(pr.x + h * 0.55, pr.y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#5d4326';
        ctx.fillRect(pr.x - h * 0.08, pr.y, h * 0.16, h * 0.3);
      } else if (item.kind === 'house') {
        const w = item.size * pr.scale;
        if (w < 1) continue;
        ctx.fillStyle = '#e8ddc4';
        ctx.fillRect(pr.x - w / 2, pr.y - w * 0.7, w, w * 0.7);
        ctx.fillStyle = '#a34d33';
        ctx.beginPath();
        ctx.moveTo(pr.x - w * 0.62, pr.y - w * 0.7);
        ctx.lineTo(pr.x, pr.y - w * 1.15);
        ctx.lineTo(pr.x + w * 0.62, pr.y - w * 0.7);
        ctx.closePath();
        ctx.fill();
      } else if (item.kind === 'ring') {
        const ring = item.ring;
        const r = ring.radius * pr.scale;
        if (r < 2) continue;
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.lineWidth = Math.max(2, r * 0.14);
        ctx.strokeStyle = ring.hit ? 'rgba(120, 220, 120, 0.9)' : 'rgba(255, 176, 66, 0.95)';
        ctx.shadowColor = ring.hit ? '#78dc78' : '#ffb042';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.92, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        if (!ring.hit && !ring.passed) {
          ctx.fillStyle = '#fff';
          ctx.font = `bold ${Math.max(11, Math.floor(r * 0.3))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('◉', pr.x, pr.y);
        }
      } else if (item.kind === 'balloon') {
        const b = item.balloon;
        const r = b.radius * pr.scale;
        if (r < 2) continue;
        ctx.fillStyle = `hsl(${b.hue}, 75%, 55%)`;
        ctx.beginPath();
        ctx.ellipse(pr.x, pr.y - r, r, r * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.ellipse(pr.x - r * 0.35, pr.y - r * 1.35, r * 0.22, r * 0.5, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#5d4326';
        ctx.lineWidth = Math.max(1, r * 0.08);
        ctx.beginPath();
        ctx.moveTo(pr.x - r * 0.5, pr.y - r * 0.2);
        ctx.lineTo(pr.x - r * 0.3, pr.y + r * 0.5);
        ctx.moveTo(pr.x + r * 0.5, pr.y - r * 0.2);
        ctx.lineTo(pr.x + r * 0.3, pr.y + r * 0.5);
        ctx.stroke();
        ctx.fillStyle = '#6b4a2f';
        ctx.fillRect(pr.x - r * 0.32, pr.y + r * 0.45, r * 0.64, r * 0.5);
      } else if (item.kind === 'storm') {
        const c = item.cloud;
        const r = c.radius * pr.scale;
        if (r < 2) continue;
        ctx.fillStyle = 'rgba(58, 58, 74, 0.85)';
        ctx.beginPath();
        ctx.ellipse(pr.x, pr.y, r * 1.4, r * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(90, 90, 110, 0.8)';
        ctx.beginPath();
        ctx.ellipse(pr.x - r * 0.5, pr.y - r * 0.25, r * 0.7, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(pr.x + r * 0.55, pr.y - r * 0.2, r * 0.6, r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // The plane's shadow on the ground below it.
    const ground = world.groundY(p.x, p.z);
    const sh = project(cam, p.x, ground + 0.6, p.z);
    if (sh) {
      const r = clamp(26 * sh.scale, 2, 90);
      ctx.fillStyle = 'rgba(20, 20, 20, 0.28)';
      ctx.beginPath();
      ctx.ellipse(sh.x, sh.y, r, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** The courier itself, seen from behind and above, banking with the turn. */
  function drawPlane(world, time) {
    const p = world.state.plane;
    const cx = W / 2;
    const cy = H * 0.66 - p.pitch * 260;
    const shakeX = world.state.shake > 0 ? (Math.random() - 0.5) * world.state.shake * 8 : 0;
    const shakeY = world.state.shake > 0 ? (Math.random() - 0.5) * world.state.shake * 8 : 0;
    ctx.save();
    ctx.translate(cx + shakeX, cy + shakeY);
    ctx.rotate(p.bank * 0.85);
    // Wings, wide and cream, with red tips.
    ctx.fillStyle = '#f3e6c8';
    ctx.beginPath();
    ctx.moveTo(-118, 6);
    ctx.quadraticCurveTo(-70, -14, -8, -4);
    ctx.lineTo(8, -4);
    ctx.quadraticCurveTo(70, -14, 118, 6);
    ctx.lineTo(104, 16);
    ctx.quadraticCurveTo(50, 10, 0, 12);
    ctx.quadraticCurveTo(-50, 10, -104, 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c8442e';
    ctx.beginPath();
    ctx.moveTo(-118, 6);
    ctx.lineTo(-96, 2);
    ctx.lineTo(-98, 14);
    ctx.lineTo(-104, 16);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(118, 6);
    ctx.lineTo(96, 2);
    ctx.lineTo(98, 14);
    ctx.lineTo(104, 16);
    ctx.closePath();
    ctx.fill();
    // Fuselage, tapering away from the camera, red with a cream stripe.
    ctx.fillStyle = '#c8442e';
    ctx.beginPath();
    ctx.moveTo(-16, 10);
    ctx.quadraticCurveTo(-13, -58, 0, -84);
    ctx.quadraticCurveTo(13, -58, 16, 10);
    ctx.quadraticCurveTo(0, 22, -16, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f3e6c8';
    ctx.fillRect(-13, -46, 26, 7);
    // Tailplane and fin.
    ctx.fillStyle = '#a83624';
    ctx.beginPath();
    ctx.moveTo(-34, 4);
    ctx.lineTo(0, -6);
    ctx.lineTo(34, 4);
    ctx.lineTo(26, 12);
    ctx.lineTo(-26, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c8442e';
    ctx.beginPath();
    ctx.moveTo(-4, 8);
    ctx.lineTo(0, -22);
    ctx.lineTo(5, 8);
    ctx.closePath();
    ctx.fill();
    // The propeller, a spinning blur ahead of the nose — thin and faint, so it
    // never reads as one of the target rings.
    const prop = Math.sin(time * 40) > 0 ? 0.4 : 0.8;
    ctx.strokeStyle = `rgba(60, 60, 60, ${0.22 * prop + 0.08})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -80, 20, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Navigation lights: red left, green right.
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-116, 8, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#34d17b';
    ctx.beginPath();
    ctx.arc(116, 8, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function bar(x, y, w, h, frac, good, bad, label) {
    ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
    ctx.fillRect(x, y, w, h);
    const f = clamp(frac, 0, 1);
    ctx.fillStyle = f > 0.5 ? good : f > 0.25 ? '#e8a13a' : bad;
    ctx.fillRect(x + 2, y + 2, (w - 4) * f, h - 4);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 6, y + h / 2);
  }

  function drawHud(world, time) {
    const s = world.state;
    const p = s.plane;
    ctx.textBaseline = 'alphabetic';
    // Top strip.
    ctx.fillStyle = 'rgba(10, 16, 24, 0.55)';
    ctx.fillRect(0, 0, W, 46);
    ctx.fillStyle = '#ffe9b0';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`SKYRIDGE COURIER  •  LEG ${s.leg + 1} — ${['RIDGE RUN', 'CANYON RUN', 'STORM LINE'][s.leg]}`, 16, 29);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText(`SCORE ${s.score}   RINGS ${s.ringsHit}/${s.ringsTotal}   ${fmtTime(s.time)}`, W - 16, 29);
    // Compass strip under the top bar.
    const headingDeg = ((p.heading * 180 / Math.PI) % 360 + 360) % 360;
    ctx.fillStyle = 'rgba(10, 16, 24, 0.4)';
    ctx.fillRect(W / 2 - 170, 52, 340, 30);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    for (let off = -40; off <= 40; off += 10) {
      const deg = Math.round((headingDeg + off) / 10) * 10;
      const norm = ((deg % 360) + 360) % 360;
      const x = W / 2 + off * 4;
      const label = norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W' : String(norm).padStart(3, '0');
      ctx.fillText(label, x, 72);
      ctx.fillRect(x - 0.5, 60, 1, off % 30 === 0 ? 8 : 5);
    }
    ctx.fillStyle = '#ffb042';
    ctx.beginPath();
    ctx.moveTo(W / 2 - 7, 52);
    ctx.lineTo(W / 2 + 7, 52);
    ctx.lineTo(W / 2, 62);
    ctx.closePath();
    ctx.fill();
    // Airspeed tape, left; altitude tape, right.
    tape(16, 130, 54, 300, p.speed * 1.944, 'KT', 20, 200);
    tape(W - 70, 130, 54, 300, p.alt * 3.281, 'FT', 100, 1000);
    // Artificial horizon, bottom left.
    const hx = 86;
    const hy = H - 92;
    const hr = 52;
    ctx.save();
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(hx, hy);
    ctx.rotate(-p.bank);
    ctx.translate(0, p.pitch * 120);
    ctx.fillStyle = '#6fb3e8';
    ctx.fillRect(-hr, -hr * 2, hr * 2, hr * 2);
    ctx.fillStyle = '#8a6b48';
    ctx.fillRect(-hr, 0, hr * 2, hr * 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-hr, -1.5, hr * 2, 3);
    ctx.restore();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffb042';
    ctx.beginPath();
    ctx.moveTo(hx - 16, hy);
    ctx.lineTo(hx + 16, hy);
    ctx.lineTo(hx, hy + 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', hx, hy + hr + 15);
    // Fuel, damage and throttle, bottom right.
    const bx = W - 236;
    const by = H - 116;
    bar(bx, by, 220, 20, s.fuel / 100, '#4ecb71', '#e5484d', `FUEL ${Math.ceil(s.fuel)}%`);
    bar(bx, by + 26, 220, 20, 1 - s.damage / 100, '#4ecb71', '#e5484d', `HULL ${Math.max(0, 100 - Math.ceil(s.damage))}%`);
    bar(bx, by + 52, 220, 20, p.throttle, '#6fb3e8', '#6fb3e8', `THR ${Math.round(p.throttle * 100)}%`);
    // Centre crosshair.
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(W / 2, H * 0.42, 9, 0, Math.PI * 2);
    ctx.moveTo(W / 2 - 15, H * 0.42);
    ctx.lineTo(W / 2 - 5, H * 0.42);
    ctx.moveTo(W / 2 + 5, H * 0.42);
    ctx.lineTo(W / 2 + 15, H * 0.42);
    ctx.stroke();
    // Next-ring pointer when the ring is off to a side.
    const ring = world.nextRing();
    if (ring && s.status === 'flying') {
      const dx = ring.x - p.x;
      const ahead = ring.z - p.z;
      if (ahead > 0 && ahead < 700) {
        const side = Math.sign(dx - Math.tan(p.heading) * ahead);
        if (Math.abs(dx) > 60) {
          ctx.fillStyle = '#ffb042';
          ctx.font = 'bold 15px sans-serif';
          ctx.textAlign = side > 0 ? 'right' : 'left';
          ctx.fillText(side > 0 ? 'NEXT RING  ▶' : '◀  NEXT RING', side > 0 ? W - 90 : 90, 110);
        }
      }
    }
    // Warnings.
    const warnings = [];
    if (s.stalled) warnings.push('STALL — NOSE DOWN, THROTTLE UP');
    if (s.fuel < 20) warnings.push(s.fuelOut ? 'FUEL EMPTY — GLIDING' : 'LOW FUEL');
    if (s.inCloud) warnings.push('IN THE STORM — GET OUT');
    const ground = world.groundY(p.x, p.z);
    if (p.alt - ground < 18 && s.status === 'flying') warnings.push('TERRAIN — PULL UP');
    if (warnings.length > 0 && Math.floor(time * 2.4) % 2 === 0) {
      ctx.fillStyle = '#ff5347';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(warnings[0], W / 2, 150);
    }
    // Leg banner.
    if (s.bannerUntil > 0) {
      ctx.globalAlpha = clamp(s.bannerUntil, 0, 1);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.banner, W / 2, H * 0.34);
      ctx.font = '16px sans-serif';
      ctx.fillText(s.leg === 0 ? 'Fly the rings down the valley' : s.leg === 1 ? 'Mind the balloons — they pop hard' : 'Storm ahead — rings first, clouds never', W / 2, H * 0.34 + 30);
      ctx.globalAlpha = 1;
    }
  }

  function tape(x, y, w, h, value, unit, stepSize, range) {
    ctx.fillStyle = 'rgba(10, 16, 24, 0.5)';
    ctx.fillRect(x, y, w, h);
    const centre = y + h / 2;
    const pxPerUnit = h / range;
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    const first = Math.floor((value - range / 2) / stepSize) * stepSize;
    for (let v = first; v <= value + range / 2; v += stepSize) {
      const yy = centre - (v - value) * pxPerUnit;
      if (yy < y + 8 || yy > y + h - 8) continue;
      ctx.fillRect(x + w - 14, yy - 0.5, 10, 1);
      ctx.fillText(String(Math.round(v)), x + 4, yy + 4);
    }
    ctx.fillStyle = '#ffb042';
    ctx.fillRect(x, centre - 11, w, 22);
    ctx.fillStyle = '#141414';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(value)}`, x + w / 2, centre + 5);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(unit, x + w / 2, y + h + 14);
  }

  function fmtTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function panel(title, lines, accent) {
    ctx.fillStyle = 'rgba(8, 14, 22, 0.72)';
    const pw = 620;
    const ph = 150 + lines.length * 30;
    ctx.fillRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph);
    ctx.fillStyle = accent;
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, H / 2 - ph / 2 + 58);
    ctx.fillStyle = '#fff';
    ctx.font = '17px sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, H / 2 - ph / 2 + 104 + i * 30);
    });
  }

  function drawScreen(world, screen, best) {
    const s = world.state;
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(8, 14, 22, 0.35)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffe9b0';
      ctx.font = 'bold 74px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('SKYRIDGE', W / 2, 168);
      ctx.fillText('COURIER', W / 2, 244);
      ctx.fillStyle = '#fff';
      ctx.font = '20px sans-serif';
      ctx.fillText('Airmail over the valley — three legs, twenty-eight rings, one runway.', W / 2, 288);
      ctx.font = '16px sans-serif';
      const lines = [
        '← → or A / D — bank and turn      ↑ ↓ or W / S — climb and dive',
        'SHIFT — throttle up      CTRL — throttle down      Mouse — steer',
        'Fly through the amber rings for points and fuel. Dodge the balloons.',
        'Land on the runway at the end of leg 3 to deliver the mail.',
      ];
      lines.forEach((line, i) => ctx.fillText(line, W / 2, 340 + i * 28));
      ctx.fillStyle = '#ffb042';
      ctx.font = 'bold 24px sans-serif';
      if (Math.floor(s.time * 1.6) % 2 === 0) ctx.fillText('PRESS SPACE OR CLICK TO FLY', W / 2, 500);
      ctx.fillStyle = '#fff';
      ctx.font = '15px sans-serif';
      if (best > 0) ctx.fillText(`Best delivery: ${best} points`, W / 2, 540);
    } else if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(8, 14, 22, 0.55)';
      ctx.fillRect(0, 0, W, H);
      panel('PAUSED', ['Space — keep flying', 'R — restart the sortie', 'M — sound on / off'], '#ffb042');
    } else if (screen === SCREEN_LANDED) {
      panel('DELIVERED', [
        `Rings flown: ${s.ringsHit} of ${s.ringsTotal}  •  Score ${s.score}`,
        s.reason,
        `Best delivery: ${Math.max(best, s.score)} points`,
        'Space — fly the route again',
      ], '#4ecb71');
    } else if (screen === SCREEN_CRASHED) {
      panel('COURIER DOWN', [
        s.reason,
        `Score ${s.score}  •  Rings ${s.ringsHit} of ${s.ringsTotal}`,
        `Best delivery: ${best} points`,
        'Space — fly the route again',
      ], '#e5484d');
    }
  }

  /** Paint one frame. `world` carries the whole simulation; `screen` is one of the
   *  SCREEN_* constants; `best` is the saved best score. */
  function draw(world, screen, best) {
    const s = world.state;
    const p = s.plane;
    const cam = {
      x: p.x - Math.sin(p.heading) * CAMERA.behind,
      z: p.z - Math.cos(p.heading) * CAMERA.behind,
      y: p.alt + CAMERA.above,
      heading: p.heading,
      pitch: p.pitch,
    };
    const time = s.time;
    ctx.clearRect(0, 0, W, H);
    drawSky(cam, time);
    drawGround(world, cam);
    drawFeatures(world, cam, time);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_TITLE) drawPlane(world, time);
    drawHud(world, time);
    if (screen !== SCREEN_PLAY) drawScreen(world, screen, best);
    // First-seconds hint while flying.
    if (screen === SCREEN_PLAY && s.time < 9) {
      ctx.fillStyle = 'rgba(10, 16, 24, 0.6)';
      ctx.fillRect(W / 2 - 260, H - 52, 520, 30);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Steer with ← → and ↑ ↓ — fly through the amber rings', W / 2, H - 32);
    }
  }

  return { draw };
}
