// Optional webcam hand tracking. Nothing here runs unless the player turns it on.
// `Gestures` turns raw hand landmarks into game input (pointer, pinch, fist push, two-hand twist);
// `createSpatial` owns the camera and the MediaPipe hand model, which are fetched from a CDN on first use.
// Camera frames are processed on this device and are never stored or sent anywhere.
const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// One-Euro filter: heavy smoothing when the hand is still, light smoothing when it moves fast.
class OneEuro {
  constructor(minCut = 1.4, beta = 2.2, dCut = 1) { Object.assign(this, { minCut, beta, dCut, t: null, x: 0, dx: 0 }); }
  filter(x, t) {
    if (this.t === null) { this.t = t; this.x = x; return x; }
    const dt = Math.max(1e-3, t - this.t), alpha = (cut) => { const r = 2 * Math.PI * cut * dt; return r / (r + 1); };
    this.t = t;
    this.dx += alpha(this.dCut) * ((x - this.x) / dt - this.dx);
    this.x += alpha(this.minCut + this.beta * Math.abs(this.dx)) * (x - this.x);
    return this.x;
  }
  reset() { this.t = null; }
}

// Landmark indices (MediaPipe Hands): 0 wrist, 4 thumb tip, 8 index tip, 9 middle knuckle; tips 8/12/16/20, middle joints 6/10/14/18.
export class Gestures {
  constructor() { this.fx = new OneEuro(); this.fy = new OneEuro(); this.hands = new Map(); this.down = false; this.two = null; this.bangAt = -9; }
  // landmarks: one array of 21 {x, y} per hand, in camera image coordinates (0..1). t in seconds.
  feed(landmarks = [], t = 0) {
    const seen = landmarks.map((lm, i) => {
      const size = Math.max(1e-4, dist(lm[0], lm[9])), prev = this.hands.get(i) || { pinch: false, size, vel: 0, t };
      const curled = [[8, 6], [12, 10], [16, 14], [20, 18]].every(([tip, mid]) => dist(lm[tip], lm[0]) < dist(lm[mid], lm[0]) * 1.05);
      const gap = dist(lm[4], lm[8]) / size;
      // Pinch has hysteresis so a wavering hand does not flicker between grab and release.
      const pinch = !curled && (prev.pinch ? gap < .42 : gap < .28);
      // A hand moving toward the camera grows in the image: the growth rate stands in for forward speed.
      const dt = Math.max(1e-3, t - prev.t), vel = prev.vel * .5 + .5 * Math.log(size / prev.size) / dt;
      // Mirror x so moving your hand right moves the pointer right.
      const at = { x: 1 - (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 };
      const h = { pinch, fist: curled, size, vel, t, at, lm: lm.map((p) => ({ x: 1 - p.x, y: p.y })) };
      this.hands.set(i, h); return h;
    });
    for (const k of [...this.hands.keys()]) if (k >= seen.length) this.hands.delete(k);
    const out = { n: seen.length, hands: seen, pointer: null, pinch: false, down: false, up: false, bang: false, two: null };
    // A fist pushed at the camera: one bang, then a short rest so one push is not counted twice.
    if (seen.some((h) => h.fist && h.vel > 1.8) && t - this.bangAt > .55) { out.bang = true; this.bangAt = t; }
    // Both hands pinching: report how the line between them turned and stretched since the last frame.
    const pinching = seen.filter((h) => h.pinch);
    if (pinching.length === 2) {
      const [a, b] = pinching.sort((p, q) => p.at.x - q.at.x), angle = Math.atan2(b.at.y - a.at.y, b.at.x - a.at.x), span = Math.max(1e-4, dist(a.at, b.at));
      if (this.two) { let d = angle - this.two.angle; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; out.two = { dAngle: d, dScale: span / this.two.span }; }
      else out.two = { dAngle: 0, dScale: 1 };
      this.two = { angle, span };
    } else this.two = null;
    // One hand drives the pointer: the pinching hand if there is one, else the first hand seen.
    const lead = pinching[0] || seen[0];
    if (lead) {
      // The middle of the camera image covers the whole screen, so nobody has to reach for the edges.
      out.pointer = { x: this.fx.filter(clamp((lead.at.x - .12) / .76, 0, 1), t), y: this.fy.filter(clamp((lead.at.y - .12) / .76, 0, 1), t) };
      out.pinch = pinching.length === 1;
    } else { this.fx.reset(); this.fy.reset(); }
    out.down = out.pinch && !this.down; out.up = !out.pinch && this.down; this.down = out.pinch;
    return out;
  }
}

const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
// The small skeleton view in the corner of the HUD.
export function drawHands(canvas, frame) {
  const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(14,18,44,.55)'; c.fillRect(0, 0, w, h);
  for (const hand of frame?.hands || []) {
    c.strokeStyle = hand.pinch ? '#f4c81f' : hand.fist ? '#ff6b5e' : '#c7cdf2'; c.lineWidth = 2; c.beginPath();
    for (const [a, b] of BONES) { c.moveTo(hand.lm[a].x * w, hand.lm[a].y * h); c.lineTo(hand.lm[b].x * w, hand.lm[b].y * h); }
    c.stroke();
    c.fillStyle = '#f4c81f'; c.beginPath(); c.arc(hand.at.x * w, hand.at.y * h, hand.pinch ? 5 : 3, 0, 7); c.fill();
  }
}

export function createSpatial() {
  const gestures = new Gestures();
  let stream = null, video = null, landmarker = null, lastTime = -1, last = null, fed = null;
  return {
    get on() { return !!landmarker || !!fed; },
    // Starts the camera and loads the hand model. Throws an Error whose message is ready to show the player.
    async start() {
      if (landmarker) return;
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This device or app can’t reach a camera. Staying with the mouse.');
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false }); }
      catch (e) { throw new Error(e?.name === 'NotAllowedError' ? 'Camera permission was refused. Staying with the mouse.' : 'No camera was found. Staying with the mouse.'); }
      try {
        video = document.createElement('video'); video.srcObject = stream; video.muted = true; video.playsInline = true; await video.play();
        const url = VISION + '/vision_bundle.mjs', vision = await import(url), files = await vision.FilesetResolver.forVisionTasks(VISION + '/wasm');
        const make = (delegate) => vision.HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numHands: 2 });
        landmarker = await make('GPU').catch(() => make('CPU'));
      } catch (e) { this.stop(); throw new Error('The hand-tracking model could not be downloaded. Check your connection. Staying with the mouse.'); }
    },
    stop() { stream?.getTracks().forEach((t) => t.stop()); landmarker?.close?.(); stream = video = landmarker = fed = last = null; lastTime = -1; },
    // Latest gesture frame, or null when tracking is off. Runs the model only when the camera has a new picture.
    update(now) {
      if (fed) { const f = fed; fed = { ...f, down: false, up: false, bang: false, two: f.two && { dAngle: 0, dScale: 1 } }; return f; }
      if (!landmarker || !video || video.readyState < 2) return last;
      if (video.currentTime === lastTime) return last && { ...last, down: false, up: false, bang: false, two: last.two && { dAngle: 0, dScale: 1 } };
      lastTime = video.currentTime;
      try { last = gestures.feed(landmarker.detectForVideo(video, now).landmarks, now / 1000); } catch { /* a dropped frame is not worth stopping for */ }
      return last;
    },
    // Scripted hands for automated tests: the same path the camera uses, without a camera.
    // Events the game has not read yet are carried forward, so a slow frame loses nothing.
    feed(landmarks, t) {
      const f = gestures.feed(landmarks, t), p = fed;
      if (p) { f.down ||= p.down; f.up ||= p.up; f.bang ||= p.bang; if (f.two && p.two) { f.two.dAngle += p.two.dAngle; f.two.dScale *= p.two.dScale; } }
      fed = f;
    },
  };
}
