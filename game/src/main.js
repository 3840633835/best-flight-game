// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, landed and crashed.
//
// ?seed=N fixes the valley, the rings and the weather. ?shot=title|flight|ring|landing
// (with &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_RING, EVENT_BUMP, EVENT_LEG, EVENT_LANDED, EVENT_CRASHED } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_LANDED, SCREEN_CRASHED } from './render.js';
import { stageShot, autopilot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let warnedLowFuel = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.ensure();
    world.reset();
    warnedLowFuel = false;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Flying. Leg 1, Ridge Run. Fly through the amber rings.');
  }

  function endFlight(landed) {
    screen = landed ? SCREEN_LANDED : SCREEN_CRASHED;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(landed ? `Delivered. Score ${world.state.score}. Best ${best}.` : `Courier down. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_LANDED || screen === SCREEN_CRASHED)) {
      audio.ensure();
      audio.click();
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Flying.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The title flies itself: the valley drifts past behind the menu.
      world.step(STEP, autopilot(world));
      if (world.state.status !== 'flying') world.reset();
      return;
    }
    const events = world.step(STEP, input.control());
    if (events & EVENT_RING) audio.ring();
    if (events & EVENT_BUMP) audio.bump();
    if (events & EVENT_LEG) audio.click();
    if (!warnedLowFuel && world.state.lowFuelWarned) {
      warnedLowFuel = true;
      audio.warn();
    }
    if (events & EVENT_LANDED) {
      audio.land();
      endFlight(true);
    } else if (events & EVENT_CRASHED) {
      audio.bump();
      endFlight(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const p = world.state.plane;
    audio.update(p.throttle, p.speed, screen === SCREEN_PLAY);
    renderer.draw(world, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the courier fly unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Skyridge Courier. Press Space or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
