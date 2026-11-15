// Optional webcam hand tracking. Nothing here runs unless the player turns it on.
// `Gestures` turns raw hand landmarks into game input: a pointer, a grab (a pinch or a closed hand), a fist push,
// a two-hand twist and a look direction. Walking stays on the keyboard. `Calibration` measures one player's hands
// and writes a profile.
// `createSpatial` owns the camera and the MediaPipe hand model. The model's files are packed with the game
// (hand-tracking.js); only if that file is missing are they fetched from a CDN.
// Camera frames are processed on this device and are never stored or sent anywhere.
const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Landmark indices (MediaPipe Hands): 0 wrist, 4 thumb tip, 5/9/13/17 knuckles, 8/12/16/20 fingertips.
const TIPS = [8, 12, 16, 20];
const PROFILE_KEY = 'redacted-donor.hands.v1';
const LOST = .25;                                    // seconds a hand may vanish before its grab, fist and role are dropped
// Looking down must never take the hand out of the camera's picture. It starts a short dip below the resting point
// and is at full speed while the whole hand is still in view: the dip is measured against a reach that ends no
// lower than LOOK_FLOOR of the way down the frame, however far down the player reached during setup.
const LOOK_FLOOR = .8, DOWN_DEAD = .4, DOWN_FULL = .8;
const LOOK_DEAD = .7;
// Hands that touch or overlap (a clap, laced fingers, one hand passing in front of the other) give the camera model
// nothing it can read: landmarks jump, left and right swap, and one hand vanishes into the other. While they are
// tangled nothing is trusted: the pointer holds still, grabs let go, and no knock or two-hand turn fires.
// Afterwards the hands are told apart afresh, so the pointing hand is the pointing hand again.
const TOUCH = 1;       // palm lengths between two palm centres at which the hands overlap (side by side is still readable)
const APART = 1.25;    // ...and how far apart they must come again before the overlap is over
const MERGE_GAP = 1.7; // one hand vanishing counts as the two having merged only if they were this close...
const CLOSING = 3;     // ...and coming together at least this fast (palm lengths a second): a hand that just drops out of view is not a merge
const SETTLE = .18;    // seconds the hands must be apart (or gone) before they are trusted again
const MERGED = .45;    // a single hand left over after a merge is believed after this long
const HELD_LOST = .45; // a hand that is holding something may vanish this long (a blur mid-drag) before it lets go
const LEAD = .04;      // seconds the pointer is run ahead of the filtered hand, to cancel some of the camera's delay
const REST = .12;      // screen widths a second: slower than this, the hand is at rest
const FAST = 2.4;      // picture heights a second: a hand moving faster is a blur, so no grab or knock starts on it

// One-Euro filter: heavy smoothing when the hand is still, almost none when it moves fast.
export class OneEuro {
  constructor(minCut = 1.2, beta = 12, dCut = 1) { Object.assign(this, { minCut, beta, dCut, t: null, x: 0, dx: 0 }); }
  // k scales the speed term: pass (reference size / hand size) so near and far hands are filtered alike.
  filter(x, t, k = 1) {
    if (this.t === null) { this.t = t; this.x = x; this.dx = 0; return x; }
    const dt = Math.max(1e-3, t - this.t), alpha = (cut) => { const r = 2 * Math.PI * cut * dt; return r / (r + 1); };
    this.t = t;
    this.dx += alpha(this.dCut) * ((x - this.x) / dt - this.dx);
    this.x += alpha(this.minCut + this.beta * k * Math.abs(this.dx)) * (x - this.x);
    return this.x;
  }
  reset() { this.t = null; }
}

// A two-state switch with separate engage and release conditions, each of which must hold for a moment.
class Latch {
  constructor(onHold, offHold) { Object.assign(this, { onHold, offHold, on: false, since: null }); }
  step(engage, release, t) {
    if (!(this.on ? release : engage)) { this.since = null; return this.on; }
    this.since ??= t;
    if (t - this.since >= (this.on ? this.offHold : this.onHold)) { this.on = !this.on; this.since = null; }
    return this.on;
  }
}

// One player's measurements. Every threshold is a ratio of the palm length (wrist to middle knuckle),
// so it holds at any distance from the camera. Positions are fractions of the mirrored camera picture.
export const DEFAULT_PROFILE = {
  calibrated: false,
  pointer: '',                      // handedness label of the pointing hand; '' = the first hand seen
  neutral: { x: .5, y: .5 },        // where the pointing hand rests: the centre of the screen and of the look deadzone
  palm: .16,                        // palm length at the resting distance, as a share of picture height
  pinchOn: .30, pinchOff: .46,      // thumb tip to index tip
  fistOn: .95, fistOff: 1.2,        // the most open fingertip's distance from the wrist
  gripOn: 1.25, gripOff: 1.5,       // the four fingertips' average distance from the wrist: a hand closed round something
  pushOn: 1.2, pushOff: .4,         // how fast a fist approaches (growth of the palm in the picture, per second)
  pushDepth: .07,                   // how far it must come (same measure, total)
  bounds: { x0: .14, y0: .14, x1: .86, y1: .86 },   // comfortable reach, mapped to the whole screen
};
export function cleanProfile(p = {}) {
  const d = DEFAULT_PROFILE, num = (v, fallback, lo, hi) => typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
  const q = { calibrated: p?.calibrated === true, pointer: p?.pointer === 'Left' || p?.pointer === 'Right' ? p.pointer : '' };
  const n = q.neutral = { x: num(p?.neutral?.x, .5, .1, .9), y: num(p?.neutral?.y, .5, .1, .9) }, b = p?.bounds || {};
  q.palm = num(p?.palm, d.palm, .03, .7);
  q.pinchOn = num(p?.pinchOn, d.pinchOn, .08, .7); q.pinchOff = Math.max(q.pinchOn + .06, num(p?.pinchOff, d.pinchOff, .1, 1.2));
  q.fistOn = num(p?.fistOn, d.fistOn, .5, 1.6); q.fistOff = Math.max(q.fistOn + .1, num(p?.fistOff, d.fistOff, .6, 1.9));
  q.gripOn = num(p?.gripOn, d.gripOn, .7, 1.7); q.gripOff = Math.max(q.gripOn + .1, num(p?.gripOff, d.gripOff, .8, 2));
  q.pushOn = num(p?.pushOn, d.pushOn, .4, 4); q.pushOff = Math.min(q.pushOn * .6, num(p?.pushOff, d.pushOff, .1, 2));
  q.pushDepth = num(p?.pushDepth, d.pushDepth, .03, .3);
  // The reach must leave real room on every side of the neutral point: a short reach would make the pointer
  // cross the whole screen for a small movement of the hand.
  q.bounds = { x0: Math.min(n.x - .22, num(b.x0, n.x - .36, 0, 1)), y0: Math.min(n.y - .17, num(b.y0, n.y - .36, 0, 1)), x1: Math.max(n.x + .22, num(b.x1, n.x + .36, 0, 1)), y1: Math.max(n.y + .17, num(b.y1, n.y + .36, 0, 1)) };
  return q;
}
export function loadProfile() { try { return cleanProfile(JSON.parse(localStorage.getItem(PROFILE_KEY))); } catch { return cleanProfile(); } }
export function saveProfile(p) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch { /* a private session still plays, uncalibrated next time */ } }

// One hand being followed from frame to frame. It keeps its role ('point' or 'other') for as long as it stays in view.
class Track {
  constructor(role) {
    Object.assign(this, { role, label: '', seen: -1, at: null, palm: 0, base: 0, vel: 0, bang: false, pinch: false, fist: false, grab: false, w: null, wrong: 0, A: 4 / 3 });
    this.f2 = Array.from({ length: 42 }, () => new OneEuro(1.2, 12));     // picture landmarks
    this.f3 = Array.from({ length: 63 }, () => new OneEuro(1.5, 40));     // world landmarks, in metres
    this.pinchL = new Latch(.03, .12); this.fistL = new Latch(.05, .15); this.gripL = new Latch(.05, .12); this.pushL = new Latch(0, .1);
  }
  update(d, t, A, P) {
    const dt = this.seen < 0 ? 1 / 30 : Math.max(1e-3, t - this.seen);
    const d2 = (a, b) => Math.hypot((a.x - b.x) * A, a.y - b.y), k = .12 / Math.max(.02, d2(d.lm[0], d.lm[9]), 1.25 * d2(d.lm[5], d.lm[17]));
    const lm = d.lm.map((p, i) => ({ x: this.f2[2 * i].filter(1 - p.x, t, k), y: this.f2[2 * i + 1].filter(p.y, t, k) }));   // mirrored: your right is the screen's right
    let palm, ratio, opens, pitch = null, w = null;
    if (d.w) {
      // World landmarks are metric and unaffected by how the hand is turned, so finger ratios are measured in 3D.
      w = d.w.map((p, i) => ({ x: this.f3[3 * i].filter(-p.x, t), y: this.f3[3 * i + 1].filter(p.y, t), z: this.f3[3 * i + 2].filter(p.z || 0, t) }));
      const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z), true9 = Math.max(1e-4, d3(w[0], w[9]));
      ratio = d3(w[4], w[8]) / true9; opens = TIPS.map((i) => d3(w[i], w[0]) / true9);
      // How much picture one metre covers at this hand's depth (a least-squares fit of picture against world),
      // times the true palm length: the palm as it would look held flat to the camera. Depth is 1 / this.
      let cx = 0, cy = 0, wx = 0, wy = 0, num = 0, den = 0;
      for (let i = 0; i < 21; i++) { cx += lm[i].x / 21; cy += lm[i].y / 21; wx += w[i].x / 21; wy += w[i].y / 21; }
      for (let i = 0; i < 21; i++) { num += ((lm[i].x - cx) * A) ** 2 + (lm[i].y - cy) ** 2; den += (w[i].x - wx) ** 2 + (w[i].y - wy) ** 2; }
      palm = Math.max(1e-4, Math.sqrt(num / Math.max(1e-9, den)) * true9);
      pitch = Math.atan2(w[0].z - w[9].z, Math.hypot(w[9].x - w[0].x, w[9].y - w[0].y));   // fingers tipped toward the camera
    } else {
      // Picture only: the wider of palm length and palm width stands in for a palm that is turned away.
      palm = Math.max(1e-4, d2(lm[0], lm[9]), 1.25 * d2(lm[5], lm[17]));
      ratio = d2(lm[4], lm[8]) / palm; opens = TIPS.map((i) => d2(lm[i], lm[0]) / palm);
    }
    const open = Math.max(...opens), curl = (opens[0] + opens[1] + opens[2] + opens[3]) / 4, at = { x: (lm[0].x + lm[5].x + lm[17].x) / 3, y: (lm[0].y + lm[5].y + lm[17].y) / 3 };   // palm centre: it does not move when the fingers close
    // A hand coming toward the camera grows in the picture: the growth rate is its forward speed, the total growth its travel.
    this.vel = this.vel * .5 + .5 * (this.palm ? Math.log(palm / this.palm) / dt : 0);
    if (this.vel < .15 || !this.base) this.base = palm;
    const depth = Math.log(palm / this.base);
    const speed = this.at ? Math.hypot((at.x - this.at.x) * A, at.y - this.at.y) / dt : 0, calm = speed < FAST;
    this.speed = this.speed ? this.speed * .5 + speed * .5 : speed;
    this.fist = this.fistL.step(calm && open < P.fistOn && !this.pinchL.on, open > P.fistOff, t);
    this.pinch = this.pinchL.step(calm && ratio < P.pinchOn && !this.fist && opens[0] > P.fistOn, ratio > P.pinchOff, t);
    // A grab is a pinch or a hand closed round something; either one takes hold.
    this.grab = this.gripL.step(calm && curl < P.gripOn, curl > P.gripOff, t) || this.pinch;
    const pushed = this.pushL.on;
    // A strike: a fist pushed at the camera, or a flat open palm driven at it clearly harder (a hand that only reaches forward must not knock).
    const strike = this.fist ? this.vel > P.pushOn && depth > P.pushDepth : open > P.fistOff && this.vel > P.pushOn * 2 && depth > P.pushDepth * 2;
    this.bang = this.pushL.step(calm && strike, this.vel < P.pushOff, t) && !pushed;
    Object.assign(this, { label: d.label, dt, seen: t, lm, w, at, palm, ratio, open, curl, openIndex: opens[0], depth, pitch, A });
  }
  // lm: mirrored picture landmarks; w: world landmarks in metres (x mirrored), or null. Both are what the on-screen hand is drawn from.
  view(t) { const { role, label, lm, w, at, palm, ratio, open, curl, openIndex, vel, depth, pitch, pinch, fist, grab, A } = this; return { role, label, lm, w, at, palm, ratio, open, curl, openIndex, vel, depth, pitch, pinch, fist, grab, aspect: A, stale: this.seen !== t }; }
}

export class Gestures {
  constructor(profile) { this.profile = cleanProfile(profile); this.aspect = 4 / 3; this.side = 0; this.lead = LEAD; this.reset(); }
  // fx, fy filter the pointer: steady when the hand is nearly still, quick once it really moves (the speed estimate
  // itself reacts within a tenth of a second, so the pointer does not drag behind a hand that speeds up).
  // hist: where the pointer has been over the last half second. off: the shift that keeps a grab where the hand was
  // before its fingers closed. side (kept across resets): which side of the picture the pointing hand works on.
  reset() {
    this.tracks = []; this.auto = ''; this.fx = new OneEuro(.9, 9, 3); this.fy = new OneEuro(.9, 9, 3);
    this.down = false; this.two = null; this.knot = null; this.pair = null; this.last = null; this.rollAt = null; this.rollAcc = 0; this.fling = 0;
    this.hist = []; this.off = { x: 0, y: 0 }; this.lastP = null;
  }
  // Where the pointer was `back` seconds ago, if the hand was at rest then and has only shifted a little since.
  // Closing or opening the fingers moves the palm a little, so a grab or a release belongs where the hand was holding
  // still just before, not where that shift left it. null: the hand was really moving, so where it is now is right.
  rest(t, back, now) {
    const past = (T) => { let hit = null; for (const h of this.hist) { if (h.t > T) break; hit = h; } return hit; };
    const b = past(t - back), a = past(t - back - .16);
    if (!a || !b || b.t - a.t < .05) return null;
    return Math.hypot(b.x - a.x, b.y - a.y) / (b.t - a.t) < REST && Math.hypot(now.x - b.x, now.y - b.y) < .07 ? { x: b.x, y: b.y } : null;
  }
  // input: MediaPipe's result ({ landmarks, worldLandmarks, handedness }) or just an array of landmark arrays. t in seconds.
  feed(input = [], t = 0) {
    const src = Array.isArray(input) ? { landmarks: input } : input || {}, P = this.profile, A = this.aspect;
    const det = (src.landmarks || []).map((lm, i) => ({ lm, w: src.worldLandmarks?.[i] || null, track: null, label: src.handedness?.[i]?.[0]?.categoryName || (i ? 'Left' : 'Right'), c: { x: 1 - (lm[0].x + lm[5].x + lm[17].x) / 3, y: (lm[0].y + lm[5].y + lm[17].y) / 3 } }));
    this.tracks = this.tracks.filter((k) => t - k.seen <= (k.grab ? HELD_LOST : LOST));
    for (const k of this.tracks) k.bang = false;
    // Tangled hands: see TOUCH above. `pair` remembers how close two hands last were and how fast they were closing.
    const palmOf = (d) => Math.max(.02, Math.hypot((d.lm[0].x - d.lm[9].x) * A, d.lm[0].y - d.lm[9].y));
    let gap = det.length >= 2 ? Math.hypot((det[0].c.x - det[1].c.x) * A, det[0].c.y - det[1].c.y) / Math.max(palmOf(det[0]), palmOf(det[1])) : null;
    const prev = this.pair && t - this.pair.t < .15 ? this.pair : null;
    // The model sometimes reports ONE hand twice, on the same spot. Two real hands cannot arrive there without having
    // been seen closing in, so unless they were, it is one hand: keep the report that carries on the hand being followed.
    if (gap !== null && gap < .6 && !(prev && prev.gap <= 3)) {
      const keep = det.find((d) => this.tracks.some((k) => k.label === d.label && t - k.seen < .2)) || det[0];
      det.splice(0, det.length, keep); gap = null;
    }
    const merged = det.length === 1 && !!prev && prev.gap < MERGE_GAP && prev.closing > CLOSING;
    if (gap !== null) this.pair = { gap, t, closing: prev ? .6 * prev.closing + .4 * (prev.gap - gap) / Math.max(1e-3, t - prev.t) : 0 };
    if (gap !== null && gap < (this.knot ? APART : TOUCH) || merged) this.knot = { clear: null, single: null };
    else if (this.knot) {
      const k = this.knot;
      if (det.length === 1) { k.single ??= t; k.clear = null; } else { k.clear ??= t; k.single = null; }
      if (k.clear !== null && t - k.clear >= SETTLE || k.single !== null && t - k.single >= MERGED) { this.knot = null; this.tracks = []; this.two = null; this.fx.reset(); this.fy.reset(); }
    }
    if (this.knot) {
      const out = { n: det.length, hands: [], pointer: this.last, grab: false, down: false, up: this.down, bang: false, two: null, look: { x: 0, y: 0 }, tangled: true };
      this.down = false; this.two = null; this.hist = []; this.off = { x: 0, y: 0 }; return out;
    }
    // Each detection continues the nearest hand already being followed, so a hand keeps its role
    // even when the model's left/right label flickers or the hands cross.
    const pairs = [], used = new Set();
    // Cheapest pairing wins. A hand with the same label costs its distance; one with the other label costs more,
    // so a flickering label on a hand that has not moved is forgiven, but a hand is not mistaken for the other one
    // just because it turned up nearby. When a new hand has just come in, the labels alone say who is who.
    const cross = det.length > this.tracks.length ? 3 : .3;
    for (const k of this.tracks) for (const d of det) { const far = Math.hypot((k.at.x - d.c.x) * A, k.at.y - d.c.y), same = k.label === d.label; if (same || far < .4) pairs.push([far + (same ? 0 : cross), k, d]); }
    for (const [, k, d] of pairs.sort((a, b) => a[0] - b[0])) if (!used.has(k) && !d.track) { d.track = k; used.add(k); }
    if (!P.pointer && !this.auto && det.length) this.auto = det.reduce((a, b) => (b.c.x > a.c.x ? b : a)).label;
    const pointLabel = P.pointer || this.auto, other = (r) => (r === 'point' ? 'other' : 'point'), taken = (r) => this.tracks.some((k) => k.role === r);
    // New hands take their roles by label. When the model gives two hands the same label, the pointing hand is the one
    // on the side of the picture it has been seen working on (learned below; the labels themselves say nothing reliable
    // about sides, because the model names hands as if the picture were mirrored).
    const bySide = Math.abs(this.side) > .3 ? Math.sign(this.side) : 0;
    for (const d of [...det].sort((a, b) => (a.label === pointLabel ? 0 : 1) - (b.label === pointLabel ? 0 : 1) || bySide * (b.c.x - a.c.x))) if (!d.track) {
      // A hand that jumped, or was lost and found somewhere else, carries on as the same hand (grab and all) if its label fits.
      const want = d.label === pointLabel ? 'point' : 'other', same = this.tracks.find((k) => !used.has(k) && k.role === want);
      const role = same ? '' : !taken(want) ? want : !taken(other(want)) ? other(want) : '';
      if (same) d.track = same; else if (role) this.tracks.push(d.track = new Track(role));
      if (d.track) used.add(d.track);
    }
    for (const d of det) d.track?.update(d, t, A, P);
    // A hand that goes on reporting the other side's label while idle was mislabelled when it appeared: put the roles right.
    for (const k of this.tracks) if (k.seen === t) k.wrong = (k.label === pointLabel ? 'point' : 'other') !== k.role && !k.grab ? k.wrong + k.dt : 0;
    if (this.tracks.length && this.tracks.every((k) => k.wrong > .6)) for (const k of this.tracks) { k.role = other(k.role); k.wrong = 0; }

    const point = this.tracks.find((k) => k.role === 'point'), second = this.tracks.find((k) => k.role === 'other');
    // Both hands in clear view under their own labels: remember which side the pointing hand is on.
    if (point && second && point.seen === t && second.seen === t && point.label !== second.label && point.label === pointLabel) this.side += (Math.sign(point.at.x - second.at.x) - this.side) * .05;
    // The neutral point lands on the centre of the screen and the calibrated reach covers the rest.
    const b = P.bounds, n = P.neutral, ax = (v, lo, mid, hi) => clamp(v < mid ? .5 * (v - lo) / (mid - lo) : .5 + .5 * (v - mid) / (hi - mid), 0, 1);
    // Each hand also reports where it is on the screen, so both can be drawn where the player holds them.
    const out = { n: det.length, hands: this.tracks.map((k) => ({ ...k.view(t), screen: { x: ax(k.at.x, b.x0, n.x, b.x1), y: ax(k.at.y, b.y0, n.y, b.y1) } })), pointer: null, grab: false, down: false, up: false, bang: false, two: null, look: { x: 0, y: 0 } };
    // Both hands grabbing: how the line from the pointing hand to the other hand turned and stretched, and how the hands tipped.
    if (this.allowTwo !== false && point?.grab && second?.grab && Math.hypot((second.at.x - point.at.x) * A, second.at.y - point.at.y) > 1.6 * Math.max(point.palm, second.palm)) {
      const angle = Math.atan2(second.at.y - point.at.y, (second.at.x - point.at.x) * A), span = Math.max(1e-4, Math.hypot((second.at.x - point.at.x) * A, second.at.y - point.at.y));
      const tip = point.pitch === null || second.pitch === null ? null : (point.pitch + second.pitch) / 2;
      if (this.two) {
        let d = angle - this.two.angle; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
        const s = span / this.two.span, wild = Math.abs(d) > .6 || s < .6 || s > 1.6;   // a jump that size in one frame is a misread, not a turn
        out.two = wild ? { dAngle: 0, dScale: 1, dTilt: 0 } : { dAngle: d, dScale: s, dTilt: tip === null || this.two.tip === null ? 0 : tip - this.two.tip };
      } else out.two = { dAngle: 0, dScale: 1, dTilt: 0 };
      this.two = { angle, span, tip };
    } else this.two = null;
    out.grab = !!point?.grab && !out.two;
    out.down = out.grab && !this.down; out.up = !out.grab && this.down; this.down = out.grab;
    if (point) {
      // rx, ry: where the hand is; fx, fy: the steadied pointer, which runs a little behind a moving hand.
      const rx = ax(point.at.x, b.x0, n.x, b.x1), ry = ax(point.at.y, b.y0, n.y, b.y1), fx = this.fx.filter(rx, t), fy = this.fy.filter(ry, t), gx = rx - fx, gy = ry - fy;
      // The camera, the model and the filters all run behind the real hand, so the pointer is run ahead at its present
      // speed for `lead` seconds, but never by more than twice what the hand is already seen to be ahead of it. A hand
      // that has stopped is no longer ahead, so the pointer cannot overshoot it.
      const ahead = (v, g) => (v * g > 0 ? Math.sign(v) * Math.min(Math.abs(v) * this.lead, Math.abs(g) * 2) : 0);
      const px = fx + ahead(this.fx.dx, gx), py = fy + ahead(this.fy.dx, gy), bare = { x: px + this.off.x, y: py + this.off.y };
      // Taking hold: if the hand was at rest before the fingers closed, the grab lands where it was then, and stays
      // shifted by that much for as long as it holds. Letting go at rest: the release lands where it was holding still.
      if (out.down) { const a = this.rest(t, .2, bare); this.off = a ? { x: a.x - px, y: a.y - py } : { x: 0, y: 0 }; }
      else if (!out.grab && !out.up) { this.off.x *= .7; this.off.y *= .7; }
      out.pointer = { x: clamp(px + this.off.x, 0, 1), y: clamp(py + this.off.y, 0, 1) };
      if (out.down) out.at = { ...out.pointer };
      if (out.up) out.at = this.rest(t, .24, out.pointer) || { ...out.pointer };
      // For gliding between camera pictures (see Glide): how fast the pointer itself moved since the last picture.
      // A hand that is slowing is taken to go on slowing, so the glide eases into a stop instead of running through it.
      // A grab or a release shifts the pointer (see above); that shift is not motion.
      const lp = this.lastP, moved = lp && t > lp.t && !out.down && !out.up, vx = moved ? (out.pointer.x - lp.x) / (t - lp.t) : 0, vy = moved ? (out.pointer.y - lp.y) / (t - lp.t) : 0;
      const ease = (v, was) => clamp(v * was > 0 && Math.abs(v) < Math.abs(was) ? v * Math.abs(v / was) : v, -3, 3);
      out.motion = { vx: ease(vx, lp?.vx || 0), vy: ease(vy, lp?.vy || 0) };
      this.lastP = { x: out.pointer.x, y: out.pointer.y, t, vx, vy };
      this.hist.push({ t, x: out.pointer.x, y: out.pointer.y }); while (t - this.hist[0].t > .6) this.hist.shift();
      out.bang = point.bang; this.last = out.pointer;
      // Past the comfort zone the view turns, faster the further out. A grab holds it still.
      const edge = (v) => (Math.abs(v) <= LOOK_DEAD ? 0 : Math.sign(v) * ((Math.abs(v) - LOOK_DEAD) / (1 - LOOK_DEAD)) ** 2);
      const v = out.pointer.y * 2 - 1, reach = Math.min(b.y1 - n.y, Math.max(.12, LOOK_FLOOR - n.y)), dip = v * (b.y1 - n.y) / reach;
      const down = dip <= DOWN_DEAD ? 0 : Math.min(1, (dip - DOWN_DEAD) / (DOWN_FULL - DOWN_DEAD)) ** 1.5;
      if (!point.grab) out.look = { x: edge(out.pointer.x * 2 - 1), y: v > 0 ? down : edge(v) };
    } else { this.fx.reset(); this.fy.reset(); this.last = null; this.hist = []; this.off = { x: 0, y: 0 }; this.lastP = null; }
    // A closed hand turning at the wrist (a dial, a lock wheel): how far it has rolled, in radians, clockwise as the
    // player sees it. Small tremors are collected until they add up to a real turn.
    if (out.grab && point.seen === t) {
      const a = Math.atan2(point.lm[9].y - point.lm[0].y, (point.lm[9].x - point.lm[0].x) * A);
      if (this.rollAt !== null) { let d = a - this.rollAt; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; if (Math.abs(d) < .5) this.rollAcc += d; }
      this.rollAt = a;
      if (Math.abs(this.rollAcc) > .03) { out.roll = this.rollAcc; this.rollAcc = 0; }
    } else if (!out.grab) { this.rollAt = null; this.rollAcc = 0; }
    // How fast the hand was moving when it let go (picture heights a second): a flick throws further.
    this.fling = point ? Math.max(this.fling * .7, point.speed || 0) : 0;
    if (out.up) out.flick = this.fling;
    return out;
  }
}

// Between camera pictures the pointer carries on at the speed it was last seen moving, for at most 45 ms (a little
// more than one picture). On a 120 or 240 Hz display it then glides instead of stepping at the camera's 30 or 60 a
// second. A new picture is blended in over a few frames, so there is never a jump, and a hand seen to slow or stop
// has little or no speed, so the pointer eases to rest with it. The most it can run past a hand that stops dead is
// one picture's worth of travel, and it is drawn back at once.
export class Glide {
  constructor() { this.reset(); }
  reset() { this.p = null; this.m = null; this.err = { x: 0, y: 0 }; this.since = 0; }
  // Where the last picture's pointer has run to by `now`.
  run(now) {
    const dt = Math.min(Math.max(0, now - this.since), 45) / 1000, m = this.m;
    return { x: this.p.x + (m ? m.vx * dt : 0), y: this.p.y + (m ? m.vy * dt : 0) };
  }
  // A new result: f.pointer, with f.motion = { vx, vy } (its speed in screen widths a second). now in milliseconds.
  set(f, now) {
    if (!f?.pointer) { this.reset(); return; }
    const was = this.p ? this.at(now) : null;                                  // where the pointer is drawn right now
    this.p = f.pointer; this.m = f.tangled ? null : f.motion || null; this.since = now;
    const e = was ? { x: was.x - this.p.x, y: was.y - this.p.y } : { x: 0, y: 0 };
    this.err = Math.hypot(e.x, e.y) < .08 ? e : { x: 0, y: 0 };                // a real jump (a new hand, a lost one found) is shown as one
  }
  // The pointer to draw at time `now`, or null when there is none.
  at(now) {
    if (!this.p) return null;
    const r = this.run(now), k = Math.exp(-Math.max(0, now - this.since) / 35);
    return { x: clamp(r.x + this.err.x * k, 0, 1), y: clamp(r.y + this.err.y * k, 0, 1) };
  }
}

// The four-step setup. Feed it gesture frames; it returns what to show and, at the end, the player's profile.
const CAL_TEXT = [
  [['Frame your hand', 'Hold up the hand you want to point with, open and relaxed, where it is comfortable. Keep it still.']],
  [['Pinch', 'Start with your hand open, then touch your thumb and index finger together and hold.'], ['Pinch', 'Now let go.']],
  [['Fist', 'Make a fist and hold it.'], ['Push', 'Push your fist toward the camera once, like knocking on glass.']],
  [['Reach', 'Reach up and to the left as far as is comfortable. Hold still.'], ['Reach', 'Now down and to the right. Hold still.']],
];
export class Calibration {
  constructor() { Object.assign(this, { step: 0, sub: 0, p: {}, ref: null, since: 0, sum: [], n: 0, note: '', done: false, peak: 0, grow: 0 }); }
  // Progress (0..1) of holding the hand in one place for `need` seconds, averaging `vals` meanwhile.
  _hold(h, t, need, vals) {
    if (!this.ref || Math.hypot(h.at.x - this.ref.x, h.at.y - this.ref.y) > h.palm * .35) { this.ref = { ...h.at }; this.since = t; this.sum = vals.map(() => 0); this.n = 0; }
    vals.forEach((v, i) => { this.sum[i] += v; }); this.n++;
    return clamp((t - this.since) / need, 0, 1);
  }
  _mean() { return this.sum.map((s) => s / this.n); }
  _next(sub) { this.ref = null; if (sub) this.sub++; else { this.step++; this.sub = 0; } }
  feed(frame, t) {
    const seen = (frame?.hands || []).filter((h) => !h.stale), p = this.p;
    const h = p.pointer ? seen.find((x) => x.label === p.pointer) || (seen.length === 1 ? seen[0] : null) : seen.length === 1 ? seen[0] : null;
    let progress = 0; this.note = '';
    if (this.done) progress = 1;
    else if (!h) { this.ref = null; this.note = seen.length > 1 ? 'Show one hand only for now.' : 'Hold your pointing hand up to the camera.'; }
    else if (this.step === 0) {
      if (h.at.x < .15 || h.at.x > .85 || h.at.y < .18 || h.at.y > .85) { this.ref = null; this.note = 'Bring your hand toward the middle of the picture.'; }
      else if (h.open < 1.3) { this.ref = null; this.note = 'Open your hand.'; }
      else if ((progress = this._hold(h, t, 1, [h.at.x, h.at.y, h.palm, h.ratio, h.open, h.curl])) >= 1) {
        const [x, y, palm, ratio, open, curl] = this._mean(); this.curl = curl;
        Object.assign(p, { pointer: h.label === 'Left' || h.label === 'Right' ? h.label : '', neutral: { x, y }, palm }); this.openRatio = ratio; this.open = open; this._next();
      }
    } else if (this.step === 1) {
      if (this.sub === 0) {
        if (h.ratio > this.openRatio * .5) this.ref = null;
        else if ((progress = this._hold(h, t, .6, [h.ratio, h.openIndex])) >= 1) {
          const [ratio, index] = this._mean(), span = Math.max(.15, this.openRatio - ratio);
          p.pinchOn = ratio + .35 * span; p.pinchOff = ratio + .6 * span; this.pinchIndex = index; this._next(true);
        }
      } else if ((progress = h.ratio > p.pinchOff ? 1 : .5) >= 1) this._next();
    } else if (this.step === 2) {
      if (this.sub === 0) {
        if (h.open > this.open * .7) this.ref = null;
        else if ((progress = this._hold(h, t, .5, [h.open, h.curl])) >= 1) {
          // The fist threshold sits above this player's fist, below their open hand and below their index finger while pinching.
          // A grip is looser: the hand only has to be about half closed.
          const [fist, closed] = this._mean(), span = this.open - fist, give = Math.max(.3, this.curl - closed);
          p.gripOn = closed + .45 * give; p.gripOff = closed + .7 * give;
          p.fistOn = Math.min(fist + .35 * span, fist + .6 * (Math.max(this.pinchIndex, fist + .2) - fist)); p.fistOff = p.fistOn + .25 * span;
          this.peak = this.grow = 0; this._next(true);
        }
      } else {
        if (h.open < p.fistOff) { this.peak = Math.max(this.peak, h.vel); this.grow = Math.max(this.grow, h.depth); }
        progress = clamp(this.peak / .8, 0, .9);
        if (this.peak > .6 && h.vel < this.peak * .3) { p.pushOn = clamp(this.peak * .55, .5, 3); p.pushOff = p.pushOn * .35; p.pushDepth = clamp(this.grow * .5, .04, .2); this._next(); }
      }
    } else {
      const n = p.neutral, far = this.sub === 0 ? h.at.x < n.x - .06 && h.at.y < n.y - .04 : h.at.x > n.x + .06 && h.at.y > n.y + .04;
      if (!far) this.ref = null;
      else if ((progress = this._hold(h, t, .6, [h.at.x, h.at.y])) >= 1) {
        const [x, y] = this._mean();
        if (this.sub === 0) { this.corner = { x, y }; this._next(true); }
        else { p.bounds = { x0: this.corner.x, y0: this.corner.y, x1: x, y1: y }; p.calibrated = true; this.done = true; }
      }
    }
    const [title, text] = this.done ? ['Hands calibrated', 'Saved on this device.'] : CAL_TEXT[this.step][this.sub];
    return { step: Math.min(4, this.step + 1), of: 4, title, text: this.note || text, progress, done: this.done, profile: this.done ? cleanProfile(p) : null };
  }
}

const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
// The hand panel: a wireframe of each tracked hand on a see-through panel (the page blurs what is behind it), with the
// calibrated reach as a dashed box. The thumb and index tips glow amber while a pinch or a grab is registered.
export function drawHands(canvas, frame, profile, video = null) {
  const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  c.clearRect(0, 0, w, h);
  // During setup the camera's own picture is shown behind the wireframe, mirrored and dimmed, so the player can see
  // what the camera sees: how they are framed, and whether there is enough light. It is drawn here and nowhere else.
  if (video && video.readyState >= 2) { c.save(); c.globalAlpha = .55; c.scale(-1, 1); c.drawImage(video, -w, 0, w, h); c.restore(); }
  c.fillStyle = video ? 'rgba(8,10,18,.2)' : 'rgba(8,10,18,.28)'; c.fillRect(0, 0, w, h);
  if (profile) { const b = profile.bounds; c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 1; c.setLineDash([4, 5]); c.strokeRect(b.x0 * w, b.y0 * h, (b.x1 - b.x0) * w, (b.y1 - b.y0) * h); c.setLineDash([]); }
  for (const hand of frame?.hands || []) {
    c.globalAlpha = hand.stale ? .4 : 1; c.lineCap = c.lineJoin = 'round';
    c.strokeStyle = hand.role === 'other' ? '#9fe6da' : '#ffffff'; c.lineWidth = 2.2; c.beginPath();
    for (const [a, b] of BONES) { c.moveTo(hand.lm[a].x * w, hand.lm[a].y * h); c.lineTo(hand.lm[b].x * w, hand.lm[b].y * h); }
    c.stroke();
    c.fillStyle = c.strokeStyle; for (const p of hand.lm) { c.beginPath(); c.arc(p.x * w, p.y * h, 2, 0, 7); c.fill(); }
    if (hand.grab) {
      c.shadowColor = '#ffb020'; c.shadowBlur = 16; c.fillStyle = '#ffc247';
      for (const i of [4, 8]) { c.beginPath(); c.arc(hand.lm[i].x * w, hand.lm[i].y * h, 5.5, 0, 7); c.fill(); }
      c.shadowBlur = 0;
    }
    c.globalAlpha = 1;
  }
}

// ── Where the hand model's files come from ──
// They are packed beside the game in hand-tracking.js (see build.mjs) and loaded with a plain script tag, which works
// from a file as well as from a server: tracking then starts at once and needs no internet. If that file is missing,
// the same files are downloaded from the CDN instead.
let packed = null;
function loadAssets() {
  return packed ||= new Promise((resolve) => {
    const unpack = () => {
      try {
        const a = globalThis.__HAND_ASSETS__;
        if (!a) { resolve(null); return; }
        const bytes = (s) => { if (Uint8Array.fromBase64) return Uint8Array.fromBase64(s); const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
        // Kept as bytes: each thread that runs the model makes its own blob addresses from them (see addresses()), because
        // a page opened from a file cannot hand its blob addresses to a worker.
        resolve({ bundle: bytes(a.bundle), loader: bytes(a.loader), wasm: bytes(a.wasm), model: bytes(a.model) });
        globalThis.__HAND_ASSETS__ = null;   // the text copy has done its job
      } catch { resolve(null); }
    };
    if (globalThis.__HAND_ASSETS__) { unpack(); return; }
    const s = document.createElement('script'); s.src = 'hand-tracking.js'; s.onload = unpack; s.onerror = () => resolve(null); document.head.append(s);
  });
}
const MODEL_OPTIONS = { runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: .6 };
// Blob addresses for the packed files, made on the thread that will use them.
const addresses = (a) => { const url = (u8, type) => URL.createObjectURL(new Blob([u8], { type })); return { bundle: url(a.bundle, 'text/javascript'), loader: url(a.loader, 'text/javascript'), wasm: url(a.wasm, 'application/wasm'), model: a.model }; };
// The hand model on the game's own thread. a: the packed files, or null to download them. The graphics card first, then the processor.
async function makeModel(packedFiles) {
  const a = packedFiles && (packedFiles.urls ||= addresses(packedFiles));
  const vision = await import(a ? a.bundle : VISION + '/vision_bundle.mjs');
  const files = a ? { wasmLoaderPath: a.loader, wasmBinaryPath: a.wasm } : await vision.FilesetResolver.forVisionTasks(VISION + '/wasm');
  const make = (delegate) => vision.HandLandmarker.createFromOptions(files, { baseOptions: { ...(a ? { modelAssetBuffer: a.model } : { modelAssetPath: MODEL }), delegate }, ...MODEL_OPTIONS });
  return make('GPU').catch(() => make('CPU'));
}
// The same model in a worker, so reading the camera never holds up the game's own frames (on a 240 Hz screen a single
// read on the game's thread would cost two or three of them). The page hands it one picture at a time, the next only
// once the last has come back. A classic worker, because MediaPipe loads its WebAssembly with importScripts.
// It builds the model exactly as makeModel does.
const WORKER = `let model = null;
self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.init) {
      const a = m.assets && (${addresses.toString()})(m.assets), vision = await import(a ? a.bundle : m.vision + '/vision_bundle.mjs');
      const files = a ? { wasmLoaderPath: a.loader, wasmBinaryPath: a.wasm } : await vision.FilesetResolver.forVisionTasks(m.vision + '/wasm');
      const make = (delegate) => vision.HandLandmarker.createFromOptions(files, Object.assign({ baseOptions: Object.assign(a ? { modelAssetBuffer: a.model } : { modelAssetPath: m.model }, { delegate }) }, m.options));
      model = await make('GPU').catch(() => make('CPU'));
      self.postMessage({ ready: true });
    } else if (m.frame) {
      const t0 = performance.now(), r = model.detectForVideo(m.frame, m.t); m.frame.close();
      self.postMessage({ t: m.t, cost: performance.now() - t0, landmarks: r.landmarks, worldLandmarks: r.worldLandmarks, handedness: r.handedness || r.handednesses });
    }
  } catch (err) { if (m.frame) try { m.frame.close(); } catch {} self.postMessage({ error: String(err && err.message || err), init: !!m.init }); }
};`;
function startWorker(assets) {
  return new Promise((resolve, reject) => {
    let w; try { w = new Worker(URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' }))); } catch (e) { reject(e); return; }
    const fail = (e) => { clearTimeout(timer); w.terminate(); reject(e); }, timer = setTimeout(() => fail(new Error('timeout')), 25000);
    w.onerror = (e) => fail(new Error(e.message || 'worker error'));
    w.onmessage = (e) => { if (e.data.ready) { clearTimeout(timer); w.onerror = null; resolve(w); } else if (e.data.error) fail(new Error(e.data.error)); };
    w.postMessage({ init: true, assets: assets && { bundle: assets.bundle, loader: assets.loader, wasm: assets.wasm, model: assets.model }, vision: VISION, model: MODEL, options: MODEL_OPTIONS });
  });
}

// The camera, the hand model and the gesture engine together. Two engines read the pictures:
//   background  the model in a worker; the game never waits for it. Used whenever it runs well.
//   main        the model on the game's own thread, as it was at first. Used when there is no worker, when the worker
//               turns out slower (it could not reach the graphics card), or when the player picks it in Pause.
export function createSpatial() {
  const gestures = new Gestures(loadProfile()), glide = new Glide();
  let stream = null, video = null, assets = null, model = null, worker = null, busy = false, sentAt = 0, trial = null, checked = false, results = 0, starting = false;
  let why = '';   // why the background engine could not be used (for testing)
  let lastTime = -1, last = null, fresh = false, lastAt = 0, fed = null, cost = 0, rate = 0, n = 0, tick = 0, dark = false, lightCanvas = null;
  const CAMERA_KEY = 'redacted-donor.hands.camera', ENGINE_KEY = 'redacted-donor.hands.engine';
  const stored = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, store = (k, v) => { try { localStorage.setItem(k, v); } catch { /* this session only */ } };
  const classic = () => stored(ENGINE_KEY) === 'main';
  // The chosen camera if it is still plugged in, otherwise whichever the system offers. The background engine can use
  // every picture a fast camera gives (60 a second halves the blur and the delay); the main one keeps to the usual rate.
  async function openCamera() {
    const want = { width: { ideal: 640 }, height: { ideal: 480 }, ...(classic() ? {} : { frameRate: { ideal: 60 } }) }, id = stored(CAMERA_KEY);
    if (id) try { return await navigator.mediaDevices.getUserMedia({ video: { ...want, deviceId: { exact: id } }, audio: false }); } catch { /* unplugged: fall through */ }
    return navigator.mediaDevices.getUserMedia({ video: { ...want, facingMode: 'user' }, audio: false });
  }
  const idle = (f) => ({ ...f, down: false, up: false, bang: false, roll: 0, flick: 0, at: null, two: f.two && { dAngle: 0, dScale: 1, dTilt: 0 } });
  // A result the game has not read yet: its one-off events are carried into the next.
  const carry = (f, p) => { f.down ||= p.down; f.up ||= p.up; f.bang ||= p.bang; f.at ||= p.at; f.roll = (f.roll || 0) + (p.roll || 0); f.flick = Math.max(f.flick || 0, p.flick || 0); if (f.two && p.two) { f.two.dAngle += p.two.dAngle; f.two.dScale *= p.two.dScale; f.two.dTilt += p.two.dTilt; } };
  // One result from the model, whichever thread ran it. t: when its picture was taken; ms: what reading it cost.
  function apply(r, t, ms) {
    if (video?.videoWidth && video.videoHeight) gestures.aspect = video.videoWidth / video.videoHeight;
    const f = gestures.feed(r, t / 1000);
    if (fresh && last) carry(f, last);
    last = f; fresh = true; lastAt = performance.now(); cost += (ms - cost) * .15; n++; results++;
  }
  const onResult = (e) => { busy = false; const r = e.data; if (!r.error && worker) apply(r, r.t, r.cost); };
  function runMain(m, now) {
    const t0 = performance.now(), r = m.detectForVideo(video, now), ms = performance.now() - t0;
    apply({ landmarks: r.landmarks, worldLandmarks: r.worldLandmarks, handedness: r.handedness || r.handednesses }, now, ms);
    return ms;
  }
  // The background engine is reading slowly (most likely it could not reach the graphics card): try this thread on the
  // same pictures for a moment and keep whichever is clearly quicker.
  async function compare() { try { const m = await makeModel(assets); if (worker && !trial) trial = { model: m, n: 0, sum: 0, was: cost }; else m.close?.(); } catch { /* the background engine stays */ } }
  function settle() {
    const mine = trial.sum / trial.n;
    if (mine < trial.was * .75) { worker.terminate(); worker = null; busy = false; model = trial.model; cost = mine; }
    else { trial.model.close?.(); cost = trial.was; }
    trial = null;
  }
  // Once a second: is the picture too dark to read hands from?
  function light() {
    try {
      lightCanvas ||= Object.assign(document.createElement('canvas'), { width: 32, height: 24 });
      const c = lightCanvas.getContext('2d', { willReadFrequently: true }); c.drawImage(video, 0, 0, 32, 24);
      const d = c.getImageData(0, 0, 32, 24).data; let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11;
      dark = sum / (d.length / 4) < 40;
    } catch { dark = false; }
  }
  const api = {
    get on() { return !!model || !!worker || !!fed; },
    get profile() { return gestures.profile; },
    // Whether two closed hands mean "turn this" (a page held up, an exhibit) or are just two hands.
    set twoHands(on) { gestures.allowTwo = on; },
    // Use and keep a profile (from calibration, or the defaults when setup is skipped).
    setProfile(p) { gestures.profile = cleanProfile(p); saveProfile(gestures.profile); },
    // 'auto' (the background engine when it runs well) or 'main' (always the game's own thread). Takes effect at the next start().
    get engine() { return classic() ? 'main' : 'auto'; },
    set engine(v) { store(ENGINE_KEY, v === 'main' ? 'main' : 'auto'); },
    // Called when the camera is unplugged or taken away while tracking.
    onlost: null,
    // Starts the camera and loads the hand model. Throws an Error whose message is ready to show the player.
    async start() {
      if (model || worker || starting) return;
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This device or app can’t reach a camera. Staying with the mouse.');
      starting = true;
      try {
        try { stream = await openCamera(); }
        catch (e) { throw new Error(e?.name === 'NotAllowedError' ? 'Camera permission was refused. Staying with the mouse.' : 'No camera was found. Staying with the mouse.'); }
        try {
          video = document.createElement('video'); video.srcObject = stream; video.muted = true; video.playsInline = true; await video.play();
          assets = await loadAssets();
          if (!classic()) try { worker = await startWorker(assets); worker.onmessage = onResult; } catch (e) { worker = null; why = String(e?.message || e); }
          if (!worker) model = await makeModel(assets);
          checked = false; results = 0; cost = 0; rate = 0; n = 0; tick = lastAt = performance.now(); busy = false; trial = null; watch();
        } catch (e) { this.stop(); throw new Error(assets ? 'The hand-tracking model could not start on this device. Staying with the mouse.' : 'The hand-tracking model could not be downloaded. Check your connection. Staying with the mouse.'); }
      } finally { starting = false; }
    },
    // Cameras this device offers: [{ id, label }]. Labels are only filled in once the player has allowed the camera.
    async cameras() { try { return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput').map((d, i) => ({ id: d.deviceId, label: d.label || 'Camera ' + (i + 1) })); } catch { return []; } },
    // The camera in use now: { id, label }.
    get camera() { const t = stream?.getVideoTracks()[0]; return t ? { id: t.getSettings().deviceId || '', label: t.label || 'Camera' } : null; },
    // The camera's picture, for the setup screen (it is drawn on this device only).
    get video() { return video; },
    // Switch to another camera and remember it. The hand model keeps running.
    async useCamera(id) {
      store(CAMERA_KEY, id);
      if (!model && !worker) return;
      stream?.getTracks().forEach((t) => t.stop()); stream = await openCamera(); video.srcObject = stream; await video.play(); lastTime = -1; lastAt = performance.now(); gestures.reset(); glide.reset(); watch();
    },
    // How the tracking is running: pictures read a second, milliseconds spent on each, which engine, whether its files
    // were packed with the game, the camera's own rate, and whether the picture is too dark.
    get stats() { return { rate, cost: Math.round(cost), engine: worker && !trial ? 'background' : model || trial ? 'main' : '', packed: !!assets, fps: Math.round(stream?.getVideoTracks()[0]?.getSettings().frameRate || 0), dark, why }; },
    stop() {
      stream?.getTracks().forEach((t) => t.stop()); model?.close?.(); trial?.model.close?.(); worker?.terminate();
      stream = video = model = worker = trial = fed = last = null; busy = fresh = false; lastTime = -1; gestures.reset(); glide.reset();
    },
    // Latest gesture frame, or null when there is none. Reads a picture only when the camera has a new one.
    update(now) {
      if (fed) { const f = fed; fed = idle(f); return f; }
      if ((!model && !worker) || !video || video.readyState < 2) return last;
      if (now - tick >= 1000) { rate = Math.round(n * 1000 / (now - tick)); n = 0; tick = now; light(); }
      const isNew = video.currentTime !== lastTime;
      if (trial) {
        if (isNew) { lastTime = video.currentTime; try { trial.sum += runMain(trial.model, now); } catch { trial.sum += 99; } if (++trial.n >= 30) settle(); }
      } else if (worker) {
        if (busy && now - sentAt > 1500) busy = false;                       // a lost reply must not stop the camera for good
        if (isNew && !busy) {
          lastTime = video.currentTime; busy = true; sentAt = now; const w = worker;
          createImageBitmap(video).then((bmp) => { if (worker === w) w.postMessage({ frame: bmp, t: now }, [bmp]); else bmp.close(); }).catch(() => { busy = false; });
        }
        if (!checked && results >= 45) { checked = true; if (cost > 32) compare(); }   // a graphics card reads a picture in 5 to 25 ms; slower than that, it is probably running on the processor
      } else if (isNew && now - sentAt >= 28) {                               // on the game's own thread: at most about 30 pictures a second
        lastTime = video.currentTime; sentAt = now;
        try { runMain(model, now); } catch { /* a dropped frame is not worth stopping for */ }
      }
      // The camera has stalled (unplugged, covered by another app): no hands, rather than one frozen in the air.
      if (last && performance.now() - lastAt > 700) { last = null; fresh = false; gestures.reset(); glide.reset(); }
      if (!last) return null;
      const f = fresh ? last : idle(last);
      if (fresh) { fresh = false; glide.set(f, now); }
      const p = glide.at(now);
      return p ? { ...f, pointer: p } : f;
    },
    // Scripted hands for automated tests: the same path the camera uses, without a camera.
    // Events the game has not read yet are carried forward, so a slow frame loses nothing.
    feed(input, t) {
      const f = gestures.feed(input, t), p = fed;
      if (p) carry(f, p);
      fed = f;
    },
  };
  // The camera being unplugged, or taken by the system, ends its video track.
  function watch() { const s = stream; s?.getVideoTracks()[0]?.addEventListener('ended', () => { if (stream === s) api.onlost?.(); }); }
  return api;
}
