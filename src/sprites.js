import * as THREE from 'three';
import { footprints as FOOTPRINTS } from './floorplan.js';

// Animated 2D characters in the 3D rooms: the game's own painted cut-outs, moved the way paper puppets and 1930s
// rubber-hose cartoons move (they bounce, rock and lean, and each drawing is held for two film frames).
//   makeSheet(key, art)    paints a sprite sheet once from a character's existing artwork: one cell per frame.
//   SpriteSheetAnimator    one character on a camera-facing plane; picks the cell by moving the texture's UV offset.
//   Actor                  an animator with a body: it walks to waypoints and cannot pass through furniture or walls.
//   Cutscene               runs steps in order (walk here, wait, act, call), so a scene can be choreographed.
// No new artwork: `art.paint(c, pose)` is the character's original painter, which bends its drawing to the pose.

const TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const CLIPS = [['idle', 2], ['walk', 6], ['run', 6], ['interact', 4], ['look', 2]], COLS = 10;

// The pose of one frame, in the artwork's own pixels and radians: bob lifts the whole figure, lean tips it from the
// feet (positive = forward), legs (-1..1) is the place in the stride, head tilts the head and hat, nod lifts them.
export function poseOf(state, i, n) {
  const s = Math.sin(i / n * TAU), hop = Math.abs(s);
  if (state === 'walk') return { bob: hop * 8, lean: s * .03, legs: s, head: -s * .035, nod: 0 };
  if (state === 'run') return { bob: hop * 14, lean: .07 + s * .035, legs: s * 1.4, head: -.05 - s * .03, nod: 0 };
  if (state === 'interact') return { bob: [0, -3, -3, -1][i], lean: [.03, .08, .08, .05][i], legs: 0, head: [.06, .14, .14, .08][i], nod: 0 };
  if (state === 'look') return { bob: 0, lean: -.02, legs: 0, head: [-.1, -.14][i], nod: i ? 2 : 0 };
  return { bob: i ? 2 : 0, lean: 0, legs: 0, head: 0, nod: i ? 1 : 0 };
}

const sheets = new Map();
// art: { w, h, paint(c, pose) } in the artwork's own pixel size. res scales the cells down to keep the sheet small.
// A sheet: { texture, cols, rows, aspect, count(state), cell(state, i) }. Painted once per key and shared.
export function makeSheet(key, { w, h, paint, res = .75 }) {
  if (sheets.has(key)) return sheets.get(key);
  const total = CLIPS.reduce((n, [, k]) => n + k, 0), rows = Math.ceil(total / COLS), cw = Math.round(w * res), ch = Math.round(h * res);
  const cv = document.createElement('canvas'); cv.width = cw * COLS; cv.height = ch * rows;
  const c = cv.getContext('2d'), start = {}; let n = 0;
  for (const [state, count] of CLIPS) { start[state] = n; for (let i = 0; i < count; i++, n++) {
    c.save(); c.translate((n % COLS) * cw, Math.floor(n / COLS) * ch); c.beginPath(); c.rect(1, 1, cw - 2, ch - 2); c.clip(); c.scale(cw / w, ch / h);
    paint(c, poseOf(state, i, count)); c.restore();
  } }
  const texture = new THREE.CanvasTexture(cv); texture.colorSpace = THREE.SRGBColorSpace; texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter;
  const counts = Object.fromEntries(CLIPS), sheet = { texture, cols: COLS, rows, aspect: w / h, count: (st) => counts[st] || 1, cell: (st, k) => start[st] + k };
  sheets.set(key, sheet); return sheet;
}
// Mateo's hand at the contract: signs, pulls back and snaps the nib. One row of eight frames.
export function makeHandSheet() {
  if (sheets.has('hand')) return sheets.get('hand');
  const W = 256, H = 192, N = 8, cv = document.createElement('canvas'); cv.width = W * N; cv.height = H;
  const c = cv.getContext('2d');
  for (let i = 0; i < N; i++) {
    c.save(); c.translate(i * W, 0);
    const back = [0, 2, -2, 0, 16, 26, 30, 30][i], snap = i >= 5, hx = 150 + back, hy = 104 - (i === 4 ? 8 : 0);
    c.lineCap = 'round'; c.strokeStyle = '#231d17'; c.lineWidth = 46; c.beginPath(); c.moveTo(262, 196); c.lineTo(hx + 34, hy + 30); c.stroke();          // sleeve
    c.fillStyle = '#c39960'; c.beginPath(); c.ellipse(hx, hy, 30, 23, -.5, 0, TAU); c.fill();                                                                // fist
    c.strokeStyle = '#8a6a43'; c.lineWidth = 3; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(hx - 20 + k * 11, hy - 6 + k * 5); c.lineTo(hx - 12 + k * 11, hy + 12 + k * 4); c.stroke(); }
    c.strokeStyle = '#17110c'; c.lineWidth = 7;
    if (!snap) { c.beginPath(); c.moveTo(hx + 14, hy - 30); c.lineTo(hx - 54, hy + 44 + (i % 2) * 3); c.stroke(); }
    else { c.beginPath(); c.moveTo(hx + 14, hy - 30); c.lineTo(hx - 16, hy + 2); c.stroke(); c.save(); c.translate(72 - (i - 5) * 9, 150 + (i - 5) * 5); c.rotate(.5 + (i - 5) * .5); c.beginPath(); c.moveTo(-20, 0); c.lineTo(20, 0); c.stroke(); c.restore();
      c.fillStyle = '#17110c'; for (let k = 0; k < 7; k++) { c.beginPath(); c.arc(92 + Math.cos(k * 2.4) * (14 + (i - 5) * 9), 152 + Math.sin(k * 2.4) * (9 + (i - 5) * 5), 3 + (k % 3) * 2, 0, TAU); c.fill(); } }
    c.restore();
  }
  const texture = new THREE.CanvasTexture(cv); texture.colorSpace = THREE.SRGBColorSpace; texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter;
  const sheet = { texture, cols: N, rows: 1, aspect: W / H, count: () => N, cell: (state, i) => i };
  sheets.set('hand', sheet); return sheet;
}

export class SpriteSheetAnimator {
  // height (and optionally width) in metres. The plane turns about the vertical axis only, so it faces the camera
  // without ever leaning back.
  constructor(sheet, { height = 2, width = height * sheet.aspect, fps = 12 } = {}) {
    Object.assign(this, { sheet, fps, state: 'idle', flip: 1, clock: 0, once: false, shown: -1, last: null });
    this.texture = sheet.texture.clone(); this.texture.needsUpdate = true;      // own copy: the UV offset belongs to one character
    this.texture.repeat.set(1 / sheet.cols, 1 / sheet.rows);
    const geo = new THREE.PlaneGeometry(width, height); geo.translate(0, height / 2, 0);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, alphaTest: .05, side: THREE.DoubleSide }));
    this.show(0);
  }
  show(cell) { if (cell === this.shown) return; this.shown = cell; const s = this.sheet; this.texture.offset.set((cell % s.cols) / s.cols, 1 - (Math.floor(cell / s.cols) + 1) / s.rows); }
  // Switch animation. The clock restarts only when the state really changes, so calling this every frame is fine.
  play(state, { once = false } = {}) { if (state === this.state && once === this.once) return; this.state = state; this.once = once; this.clock = 0; }
  // heading: the way the character is going in the world (x = sin, z = cos). The artwork faces screen-right, so it is
  // mirrored when the character heads to the camera's left. dt may be omitted: the animator then keeps its own clock.
  update(dt, camera = null, heading = null) {
    if (dt == null) { const now = performance.now() / 1000; dt = this.last === null ? 0 : Math.min(.1, now - this.last); this.last = now; }
    this.clock += dt;
    if (camera) {
      const p = this.mesh.getWorldPosition(SpriteSheetAnimator.v), to = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
      this.mesh.rotation.y = to - (this.mesh.parent ? SpriteSheetAnimator.yaw(this.mesh.parent) : 0);
      if (heading !== null) { const rel = wrap(heading - to), away = Math.abs(rel); if (away < .5) this.flip = 1; else if (away < 2.64) this.flip = rel >= 0 ? 1 : -1; }
    }
    this.mesh.scale.x = this.flip;
    // The drawing changes 12 times a second, like hand-drawn animation, however fast the game itself is running.
    const n = this.sheet.count(this.state), f = Math.floor(this.clock * this.fps);
    this.show(this.sheet.cell(this.state, this.once ? Math.min(n - 1, f) : f % n));
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.texture.dispose(); }
}
SpriteSheetAnimator.v = new THREE.Vector3();
SpriteSheetAnimator.q = new THREE.Quaternion();
SpriteSheetAnimator.e = new THREE.Euler();
SpriteSheetAnimator.yaw = (obj) => SpriteSheetAnimator.e.setFromQuaternion(obj.getWorldQuaternion(SpriteSheetAnimator.q), 'YXZ').y;

// Is a body of this radius blocked at (x, z)? Furniture and walls come from the same floor plan the player walks on.
export const blocked = (x, z, radius = .22, rects = FOOTPRINTS) => rects.some(([x0, x1, z0, z1]) => x > x0 - radius && x < x1 + radius && z > z0 - radius && z < z1 + radius);

export class Actor {
  constructor(sheet, { height = 2, width, speed = 1.3, radius = .22 } = {}) {
    this.sprite = new SpriteSheetAnimator(sheet, { height, width });
    Object.assign(this, { root: this.sprite.mesh, x: 0, z: 0, heading: 0, speed, radius, path: [], pace: 1, held: null, heldFor: 0, stuck: 0, rest: 'idle' });
  }
  place(x, z, heading = this.heading) { this.x = x; this.z = z; this.heading = heading; this.path = []; this.root.position.set(x, 0, z); }
  // Walk through these [x, z] points in order. pace multiplies the walking speed; run switches to the run cycle.
  goTo(points, { pace = 1, run = false } = {}) { this.path = points.map(([x, z]) => [x, z]); this.pace = pace; this.run = run; this.stuck = 0; }
  hold(state, seconds) { this.held = state; this.heldFor = seconds; }
  get busy() { return this.path.length > 0; }
  update(dt, camera) {
    let moving = false;
    if (this.path.length) {
      const [tx, tz] = this.path[0], dx = tx - this.x, dz = tz - this.z, dist = Math.hypot(dx, dz), step = this.speed * this.pace * (this.run ? 1.9 : 1) * dt;
      if (dist <= Math.max(.04, step)) { this.x = tx; this.z = tz; this.path.shift(); moving = this.path.length > 0; }
      else {
        // Each axis moves on its own, and stops on its own when something is in the way: the body slides along a
        // desk or a wall instead of passing through it.
        let vx = dx / dist * step, vz = dz / dist * step;
        if (blocked(this.x + vx, this.z, this.radius)) vx = 0;
        if (blocked(this.x + vx, this.z + vz, this.radius)) vz = 0;
        this.x += vx; this.z += vz; moving = Math.hypot(vx, vz) > step * .2;
        if (moving) { this.heading += wrap(Math.atan2(vx, vz) - this.heading) * Math.min(1, dt * 10); this.stuck = 0; }
        else if ((this.stuck += dt) > .6) { this.path.shift(); this.stuck = 0; }      // a point that cannot be reached is given up, not walked into for ever
      }
    }
    this.heldFor = Math.max(0, this.heldFor - dt);
    this.sprite.play(moving ? (this.run ? 'run' : 'walk') : this.heldFor > 0 ? this.held : this.rest);
    this.root.position.set(this.x, 0, this.z);
    this.sprite.update(dt, camera, this.heading);
  }
}

// A scene as a list of steps, run one after another. Build steps with the helpers below.
export class Cutscene {
  constructor(steps, { loop = false } = {}) { Object.assign(this, { steps, loop, i: 0, t: 0, begun: false }); }
  get done() { return this.i >= this.steps.length; }
  update(dt) {
    for (let guard = 0; guard < 8 && !this.done; guard++) {
      const s = this.steps[this.i];
      if (!this.begun) { this.begun = true; this.t = 0; s.begin?.(); }
      this.t += dt;
      if (!s.done(this.t)) return;
      this.i++; this.begun = false; dt = 0;
      if (this.done && this.loop) this.i = 0;
    }
  }
}
export const walk = (actor, points, opts) => ({ begin: () => actor.goTo(points, opts), done: () => !actor.busy });
export const wait = (seconds) => ({ done: (t) => t >= seconds });
export const act = (actor, state, seconds) => ({ begin: () => actor.hold(state, seconds), done: (t) => t >= seconds });
export const turn = (actor, heading) => ({ begin: () => { actor.heading = heading; }, done: () => true });
export const call = (fn) => ({ begin: fn, done: () => true });
export const together = (...steps) => ({ begin: () => steps.forEach((s) => s.begin?.()), done: (t) => steps.every((s) => s.done(t)) });
