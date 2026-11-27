// Skyridge Courier — tuning and world constants. One place for every number the
// flight model, the world and the renderer agree on, so a balance change is one edit.

// The canvas the game draws into (the page scales it to the window).
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const BEST_KEY = 'skyridge-courier-best';

// Flight model: speeds in metres per second, altitudes in metres, angles in radians.
export const PLANE = {
  minSpeed: 34, // below this the wing stalls and the nose drops
  cruiseSpeed: 62, // speed at throttle 0.55
  maxSpeed: 96, // speed at full throttle, level flight
  accel: 9, // how fast speed chases its throttle target
  maxBank: 0.85, // hardest bank, about 49 degrees
  bankRate: 2.4, // radians per second toward the wanted bank
  maxPitch: 0.38, // hardest climb / dive
  pitchRate: 1.9,
  climbPenalty: 0.55, // climbing bleeds speed; diving gains it
  fuelDrain: 0.7, // fuel per second at idle, before throttle
  fuelDrainThrottle: 0.8, // extra fuel per second at full throttle
  fuelPerRing: 8, // fuel a ring gives back
  startFuel: 100,
  startDamage: 0,
  balloonDamage: 25, // hitting a balloon
  cloudDamagePerSec: 9, // flying inside a storm cloud
  hardLandingSink: 7, // vertical speed (m/s) above which a touchdown is a crash
  landingMaxSpeed: 72, // above this the runway cannot hold the plane
};

// The route: three legs down one winding valley, 9000 m from the ridge to the airfield.
export const ROUTE = {
  legLengths: [2600, 3000, 3400],
  ringsPerLeg: [8, 10, 10],
  valleyHalfWidth: 95, // the flat valley floor, each side of the centreline
  wallRise: 150, // how high the valley walls climb past the floor edge
  groundBase: 0, // the valley floor's mean height
  groundRoll: 14, // rolling hills on the floor, metres
  runwayLength: 420, // the landing strip at the end of leg 3
  runwayHalfWidth: 14,
};

// Scoring.
export const SCORE = {
  ring: 100,
  nearMissBalloon: 25, // passing a balloon closer than 14 m without touching it
  landing: 500,
  timeBonusPerSec: 4, // left on the clock at landing, per second
  legTime: [150, 180, 210], // par time per leg, seconds; beating it pays the bonus
};

// How far ahead the renderer draws, and how the perspective is scaled.
export const CAMERA = {
  focal: 560, // pixels per unit of lateral/depth at the projection plane
  behind: 14, // metres behind the plane
  above: 3.5, // metres above the plane
  horizonY: 0.40, // horizon as a fraction of the canvas height
  drawDistance: 1150, // metres of terrain drawn ahead
};

// The four screenshot scenes the maker stages with ?shot=.
export const SHOTS = ['title', 'flight', 'ring', 'landing'];
