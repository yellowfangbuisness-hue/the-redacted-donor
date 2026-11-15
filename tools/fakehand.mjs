// Synthetic hands for the hand-tracking tests: 21 landmarks in camera-picture coordinates (the game mirrors x).
// Offsets are in palm lengths: wrist at (0, 1), middle knuckle at (0, 0), fingers pointing up the picture.
const FINGERS = [[5, 6, 7, 8, -.3], [9, 10, 11, 12, -.1], [13, 14, 15, 16, .1], [17, 18, 19, 20, .3]];
// pose: 'open' | 'pinch' | 'fist' | 'cup' (half closed, as if round a cup). gap: thumb-to-index distance for a pinch, in palm lengths.
// world: also give metric world landmarks. squash < 1: the hand is turned away, so it looks narrower in the picture.
export function hand(cx, cy, size = .12, pose = 'open', { label = 'Right', aspect = 4 / 3, gap = .054, world = false, squash = 1 } = {}) {
  const o = Array.from({ length: 21 }, () => [0, 0]);
  o[0] = [0, 1];
  for (const [mcp, pip, dip, tip, dx] of FINGERS) { o[mcp] = [dx, 0]; o[pip] = [dx, -.45]; o[dip] = [dx, -.7]; o[tip] = pose === 'fist' ? [dx, .45] : pose === 'cup' ? [dx, -.15] : [dx, -.9]; }
  o[1] = [-.4, .6]; o[2] = [-.6, .3]; o[3] = [-.7, 0]; o[4] = [-.8, -.2];
  if (pose === 'pinch') { o[8] = [-.5, -.55]; o[4] = [-.5 - gap, -.55]; }
  if (pose === 'fist') o[4] = [-.3, .1];
  const lm = o.map(([x, y]) => ({ x: cx + x * size * squash / aspect, y: cy + y * size }));
  const w = world ? o.map(([x, y]) => ({ x: x * .09 * squash, y: y * .09, z: x * .09 * Math.sqrt(1 - squash * squash) })) : null;
  return { lm, w, label };
}
// The result object MediaPipe would give for these hands.
export const frame = (hands) => ({ landmarks: hands.map((h) => h.lm), handedness: hands.map((h) => [{ categoryName: h.label }]), worldLandmarks: hands.length && hands.every((h) => h.w) ? hands.map((h) => h.w) : undefined });
// Camera-picture centre for a hand whose pointer should land on screen fraction (u, v): the inverse of the game's
// reach mapping, for the standard profile or for a calibrated one.
export function at(u, v, size = .12, { neutral: n = { x: .5, y: .5 }, bounds: b = { x0: .14, y0: .14, x1: .86, y1: .86 } } = {}) {
  const un = (t, lo, mid, hi) => (t < .5 ? lo + (mid - lo) * t / .5 : mid + (hi - mid) * (t - .5) / .5);
  return [1 - un(u, b.x0, n.x, b.x1), un(v, b.y0, n.y, b.y1) - size / 3];
}
