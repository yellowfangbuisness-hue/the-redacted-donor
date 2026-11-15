// Hand-tracking logic tests. No camera, no browser:  node tools/spatial.test.mjs
import assert from 'node:assert/strict';
import { OneEuro, Gestures, Glide, Calibration, cleanProfile, loadProfile, saveProfile, DEFAULT_PROFILE } from '../src/spatial.js';
import { hand, frame, at } from './fakehand.mjs';

let failed = 0;
const test = (name, fn) => { try { fn(); console.log('PASS  ' + name); } catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + e.message.split('\n')[0]); } };
const DT = 1 / 30;
// Feeds `n` frames of the given hands (or of hands(i)) and returns what the gesture engine reported for each.
function play(g, hands, n = 1, each) { const outs = []; for (let i = 0; i < n; i++) { g.t = (g.t || 0) + DT; outs.push(g.feed(frame(typeof hands === 'function' ? hands(i) : hands), g.t)); each?.(outs.at(-1), g.t); } return outs; }
const count = (outs, key) => outs.filter((o) => o[key]).length, first = (outs, key) => outs.findIndex((o) => o[key]);
const rms = (xs) => Math.sqrt(xs.reduce((s, x) => s + x * x, 0) / xs.length);
let seed = 7; const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - .5) * 2;

test('1-Euro filter steadies a resting hand', () => {
  const f = new OneEuro(), raw = [], out = [];
  for (let i = 0; i < 150; i++) { const x = .5 + noise() * .004; raw.push(x - .5); out.push(f.filter(x, i * DT) - .5); }
  assert.ok(rms(out.slice(20)) < rms(raw.slice(20)) * .5, `jitter only fell to ${(rms(out.slice(20)) / rms(raw.slice(20)) * 100).toFixed(0)}%`);
});
test('1-Euro filter keeps up with a fast hand', () => {
  const f = new OneEuro(); let x = .2, y = 0;
  for (let i = 0; i < 30; i++) y = f.filter(x, i * DT);
  for (let i = 30; i < 42; i++) { x += 1.5 * DT; y = f.filter(x, i * DT); }
  assert.ok(x - y < 1.5 * DT, `lagging by ${((x - y) / (1.5 * DT)).toFixed(2)} frames at 1.5 screens per second`);
});
test('pointer follows the palm, jitter-free, across the calibrated reach', () => {
  const g = new Gestures({ calibrated: true, pointer: 'Right' });
  let o = play(g, () => [hand(...at(.25, .7), .12, 'open')], 40).at(-1);
  assert.ok(Math.abs(o.pointer.x - .25) < .01 && Math.abs(o.pointer.y - .7) < .01, `pointer at ${o.pointer.x.toFixed(3)}, ${o.pointer.y.toFixed(3)}`);
  const [cx, cy] = at(.25, .7), xs = play(g, () => [hand(cx + noise() * .003, cy + noise() * .003, .12, 'open')], 90).map((f) => f.pointer.x - .25);
  assert.ok(rms(xs.slice(20)) < .0025, `pointer still shakes by ${(rms(xs.slice(20)) * 100).toFixed(2)}% of the screen`);
  const before = play(g, [hand(cx, cy, .12, 'open')], 20).at(-1).pointer, during = play(g, [hand(cx, cy, .12, 'pinch')], 10).at(-1).pointer;
  assert.ok(Math.hypot(before.x - during.x, before.y - during.y) < .004, 'closing the fingers moved the pointer');
});
test('pinch is the same at any distance from the camera', () => {
  const marks = [.05, .12, .26].map((size) => {
    const g = new Gestures(), outs = [...play(g, [hand(.5, .5, size, 'open')], 10), ...play(g, [hand(.5, .5, size, 'pinch')], 10), ...play(g, [hand(.5, .5, size, 'open')], 10)];
    assert.equal(count(outs, 'down'), 1); assert.equal(count(outs, 'up'), 1);
    return [first(outs, 'down'), first(outs, 'up')].join();
  });
  assert.equal(new Set(marks).size, 1, 'engaged or released on different frames: ' + marks.join(' | '));
});
test('pinch hysteresis and hold buffer ignore tremor and dropped frames', () => {
  const g = new Gestures(), pinch = (gap) => [hand(.5, .5, .12, 'pinch', { gap })];
  play(g, [hand(.5, .5, .12, 'open')], 8);
  assert.equal(count(play(g, pinch(.4), 20), 'down'), 0, 'engaged above the engage threshold');
  assert.equal(count(play(g, pinch(.05), 6), 'down'), 1);
  assert.equal(count(play(g, (i) => pinch(i % 2 ? .33 : .44), 40), 'up'), 0, 'released between the two thresholds');
  assert.equal(count(play(g, (i) => (i % 5 === 2 ? [hand(.5, .5, .12, 'open')] : pinch(.05)), 40), 'up'), 0, 'a one-frame twitch released the pinch');
  assert.equal(count(play(g, (i) => (i > 9 && i < 14 ? [] : pinch(.05)), 30), 'up'), 0, 'four lost frames released the pinch');
  assert.equal(count(play(g, (i) => (i > 4 && i < 16 ? [] : pinch(.05)), 30), 'up'), 0, 'a holding hand lost for a third of a second (a blur mid-drag) let go');
  assert.equal(count(play(g, [], 18), 'up'), 1, 'a hand that left the picture kept its pinch');
});
test('a fist push or a hard open-palm strike bangs once, with hysteresis; drift and a reaching hand do not', () => {
  const push = (g, pose) => [...play(g, (i) => [hand(.5, .5, .1 + i * .013, pose)], 6), ...play(g, [hand(.5, .5, .178, pose)], 8), ...play(g, (i) => [hand(.5, .5, .178 - i * .0065, pose)], 12)];
  let g = new Gestures(); play(g, [hand(.5, .5, .1, 'fist')], 10);
  assert.equal(count(push(g, 'fist'), 'bang'), 1); assert.equal(count(push(g, 'fist'), 'bang'), 1, 'a second push did not register');
  g = new Gestures(); play(g, [hand(.5, .5, .1, 'fist')], 10);
  assert.equal(count(play(g, (i) => [hand(.5, .5, .1 + i * .013, 'fist')], 14), 'bang'), 1, 'one long push counted twice');
  g = new Gestures(); play(g, [hand(.5, .5, .1, 'fist')], 10);
  assert.equal(count(play(g, (i) => [hand(.5, .5, .1 + i * .0006, 'fist')], 90), 'bang'), 0, 'slow drift banged');
  g = new Gestures(); play(g, [hand(.5, .5, .1, 'open')], 10);
  // An open palm strikes too, but only driven hard at the camera: reaching forward at an ordinary pace must not knock.
  assert.equal(count(push(g, 'open'), 'bang'), 1, 'a hard open-palm strike did not register');
  const reach = (g, pose) => [...play(g, (i) => [hand(.5, .5, .1 + i * .006, pose)], 9), ...play(g, [hand(.5, .5, .154, pose)], 8)];
  g = new Gestures(); play(g, [hand(.5, .5, .1, 'open')], 10); assert.equal(count(reach(g, 'open'), 'bang'), 0, 'an open hand reaching forward banged');
  g = new Gestures(); play(g, [hand(.5, .5, .1, 'fist')], 10); assert.equal(count(reach(g, 'fist'), 'bang'), 1, 'a fist at the same pace did not');
  for (const size of [.05, .2]) { g = new Gestures(); play(g, [hand(.5, .5, size, 'fist')], 10); assert.equal(count(play(g, (i) => [hand(.5, .5, size * (1 + i * .13), 'fist')], 6), 'bang'), 1, 'push missed at palm size ' + size); }
});
test('world landmarks keep gestures right when the hand is turned away', () => {
  for (const squash of [1, .45]) {
    const g = new Gestures(), o = { world: true, squash };
    const outs = [...play(g, [hand(.5, .5, .12, 'open', o)], 10), ...play(g, [hand(.5, .5, .12, 'pinch', o)], 10), ...play(g, [hand(.5, .5, .12, 'open', o)], 10)];
    assert.equal(count(outs, 'down'), 1, 'pinch missed at squash ' + squash); assert.equal(count(outs, 'up'), 1);
    const h = play(g, [hand(.5, .5, .12, 'fist', o)], 10).at(-1).hands[0]; assert.ok(h.fist && !h.pinch && h.grab, 'fist missed at squash ' + squash);
    assert.ok(Math.abs(h.palm - .12) < .004, `depth scale off: palm reads ${h.palm.toFixed(3)} at squash ${squash}`);
  }
  const g = new Gestures(); play(g, [hand(.5, .5, .1, 'fist', { world: true })], 10);
  assert.equal(count(play(g, (i) => [hand(.5, .5, .1 + i * .013, 'fist', { world: true, squash: .6 })], 8), 'bang'), 1, 'push missed with world landmarks');
});
test('hand roles stay locked through label flicker and crossed hands', () => {
  const g = new Gestures({ calibrated: true, pointer: 'Right' }), R = (x, y, pose, label = 'Right') => hand(x, y, .1, pose, { label }), L = (x, y, pose, label = 'Left') => hand(x, y, .1, pose, { label });
  const roles = (o) => o.hands.map((h) => h.role).join();
  assert.equal(roles(play(g, [R(.3, .5, 'open'), L(.7, .5, 'open')], 10).at(-1)), 'point,other');
  assert.equal(roles(play(g, [R(.3, .5, 'open', 'Left'), L(.7, .5, 'open', 'Right')], 6).at(-1)), 'point,other', 'a label flicker swapped the hands');
  play(g, [R(.3, .5, 'pinch'), L(.7, .5, 'pinch')], 6);
  let total = 0, worst = 0;
  for (const o of play(g, (i) => { const a = (i + 1) * .05; return [R(.5 - Math.cos(a) * .2, .5 + Math.sin(a) * .15, 'pinch'), L(.5 + Math.cos(a) * .2, .5 - Math.sin(a) * .15, 'pinch')]; }, 70)) { assert.ok(o.two, 'two-hand pinch dropped'); total += o.two.dAngle; worst = Math.max(worst, Math.abs(o.two.dAngle)); }
  assert.ok(Math.abs(Math.abs(total) - 3.5) < .25 && worst < .2, `turned ${total.toFixed(2)} rad in steps of up to ${worst.toFixed(2)}`);
  assert.equal(count(play(g, [R(.3, .5, 'pinch'), L(.7, .5, 'pinch')], 5), 'down'), 0, 'a two-hand pinch also clicked');
  // A hand that was mislabelled when it appeared is put right once it has been idle for a moment.
  const h = new Gestures({ calibrated: true, pointer: 'Right' }); play(h, [R(.3, .5, 'open', 'Left')], 3);
  assert.equal(roles(play(h, [R(.3, .5, 'open')], 30).at(-1)), 'point', 'a wrong first label was never corrected');
});
test('a hand that jumps across the picture keeps its role and its pinch', () => {
  const g = new Gestures({ calibrated: true, pointer: 'Right' });
  play(g, [hand(.3, .5, .1, 'open'), hand(.75, .5, .1, 'open', { label: 'Left' })], 10); play(g, [hand(.3, .5, .1, 'pinch'), hand(.75, .5, .1, 'open', { label: 'Left' })], 6);
  const outs = play(g, [hand(.6, .15, .1, 'pinch'), hand(.75, .6, .1, 'open', { label: 'Left' })], 10), o = outs.at(-1);
  assert.equal(o.hands.map((h) => h.role).join(), 'point,other'); assert.equal(count(outs, 'up') + count(outs, 'down'), 0, 'the jump dropped or repeated the pinch');
  assert.ok(o.grab && o.pointer.y < .2, 'the pointer did not follow the hand');
});
test('a second hand appearing where the pointing hand just was does not take its role', () => {
  const g = new Gestures({ calibrated: true, pointer: 'Right' });
  play(g, [hand(.6, .5, .1, 'open')], 10);
  const o = play(g, [hand(.3, .5, .1, 'open'), hand(.62, .5, .1, 'open', { label: 'Left' })], 4).at(-1);
  assert.equal(o.hands.find((h) => h.label === 'Right').role, 'point'); assert.equal(o.hands.find((h) => h.label === 'Left').role, 'other');
});
test('the pointing hand moving to where the other hand just was stays the pointing hand', () => {
  const g = new Gestures({ calibrated: true, pointer: 'Right' });
  play(g, [hand(.5, .5, .1, 'open'), hand(.82, .55, .1, 'open', { label: 'Left' })], 12);
  const o = play(g, [hand(.75, .78, .1, 'open')], 3).at(-1), h = o.hands.find((k) => !k.stale);
  assert.ok(h.role === 'point' && o.pointer.x < .25 && o.pointer.y > .8, `it became the ${h.role} hand`);
});
test('grab: a closing hand takes hold, a pinch does too, an open or relaxed hand does not', () => {
  const g = new Gestures({ calibrated: true, pointer: 'Right' }), H = (pose) => [hand(.5, .5, .12, pose)];
  assert.equal(count(play(g, H('open'), 12), 'down'), 0, 'an open hand grabbed');
  const closing = play(g, H('cup'), 10); assert.equal(count(closing, 'down'), 1, 'a half-closed hand did not grab');
  assert.ok(closing.at(-1).grab && !closing.at(-1).hands[0].fist && !closing.at(-1).hands[0].pinch, 'the grip was read as a fist or a pinch');
  assert.equal(count(play(g, (i) => (i % 5 === 2 ? H('open') : H('cup')), 40), 'up'), 0, 'a one-frame twitch let go');
  assert.equal(count(play(g, H('fist'), 10), 'up') + count(play(g, H('cup'), 10), 'up'), 0, 'tightening or loosening the grip let go');
  assert.equal(count(play(g, H('open'), 10), 'up'), 1, 'opening the hand did not let go');
  assert.equal(count(play(g, H('pinch'), 10), 'down'), 1, 'a pinch did not grab');
  for (const size of [.05, .26]) { const gs = new Gestures(); play(gs, [hand(.5, .5, size, 'open')], 8); assert.equal(count(play(gs, [hand(.5, .5, size, 'cup')], 10), 'down'), 1, 'grab missed at palm size ' + size); }
  const o = play(g, [hand(.5, .5, .12, 'cup', { world: true }), hand(.8, .5, .12, 'open', { label: 'Left', world: true })], 6).at(-1);
  assert.ok(o.hands.every((h) => h.lm.length === 21 && h.w?.length === 21 && h.screen.x >= 0 && h.screen.x <= 1), 'hands do not carry the landmarks and screen position they are drawn from');
  assert.equal(o.move, undefined, 'hands still report a walking direction');
});
test('look: still in the comfort zone, turns at the edges, held by any grab', () => {
  const g = new Gestures({ calibrated: true, pointer: 'Right' }), look = (u, v, pose = 'open') => play(g, [hand(...at(u, v), .12, pose)], 25).at(-1).look;
  assert.deepEqual(look(.5, .5), { x: 0, y: 0 }); assert.deepEqual(look(.7, .3), { x: 0, y: 0 });
  const right = look(.97, .5), up = look(.5, .04);
  assert.ok(right.x > .5 && right.y === 0, 'no turn at the right edge'); assert.ok(up.y < -.45 && up.x === 0, 'no turn at the top edge');
  assert.deepEqual(look(.82, .2), { x: 0, y: 0 }, 'the view turned inside the wider comfort zone');
  // Looking down: a short dip is enough, with the hand still well inside the camera's picture (here 70% of the way down it).
  const dip = at(.5, .78), down = look(.5, .78);
  assert.ok(dip[1] + .12 / 3 < .72 && down.y > .5 && down.x === 0, `looking down needs the hand lower than the picture allows: ${down.y.toFixed(2)}`);
  assert.deepEqual(look(.5, .62), { x: 0, y: 0 }, 'the view dropped while the hand rested just below centre');
  assert.deepEqual(look(.97, .5, 'pinch'), { x: 0, y: 0 }); assert.deepEqual(look(.97, .5, 'fist'), { x: 0, y: 0 }); assert.deepEqual(look(.97, .5, 'cup'), { x: 0, y: 0 });
});
// A clap: the hands fly together, the model reports closed, mislabelled, jumping hands and then only one of them.
test('clap: nothing fires while the hands touch, and the pointing hand is the pointing hand again afterwards', () => {
  const g = new Gestures({ calibrated: true, pointer: 'Right' }), S = .12, rx = at(.68, .5)[0], lx = .8, y = .5;
  const two = (a, b, poseA = 'open', poseB = 'open', la = 'Right', lb = 'Left') => [hand(a, y, S, poseA, { label: la }), hand(b, y, S, poseB, { label: lb })];
  const before = play(g, two(rx, lx), 12).at(-1);
  assert.ok(Math.abs(before.pointer.x - .68) < .03 && !before.tangled, 'pointer is not on the right hand before the clap');
  const mid = (rx + lx) / 2, outs = [];
  outs.push(...play(g, (i) => two(rx + (mid - .01 - rx) * (i + 1) / 4, lx + (mid + .01 - lx) * (i + 1) / 4), 4));                 // flying together
  outs.push(...play(g, (i) => two(mid + noise() * .03, mid + noise() * .03, 'fist', 'cup', i % 2 ? 'Left' : 'Right', 'Right'), 8));   // overlapping: closed, jumping, labels swapping
  outs.push(...play(g, (i) => [hand(mid + noise() * .02, y, S * (1 + .25 * (i % 2)), 'fist', { label: 'Left' })], 6));                // merged into one, growing and shrinking
  outs.push(...play(g, (i) => two(mid + (rx - mid) * (i + 1) / 4, mid + (lx - mid) * (i + 1) / 4, 'cup', 'cup'), 4));                 // flying apart, still blurred shut
  assert.equal(count(outs, 'down'), 0, 'a clap grabbed something'); assert.equal(count(outs, 'bang'), 0, 'a clap knocked'); assert.equal(count(outs, 'two'), 0, 'a clap turned something');
  assert.ok(outs.every((o) => !o.look.x && !o.look.y), 'a clap turned the view'); assert.ok(count(outs, 'tangled') >= 14, `only ${count(outs, 'tangled')} frames were held as tangled`);
  const after = play(g, two(rx, lx), 14).at(-1);
  assert.ok(!after.tangled && Math.abs(after.pointer.x - .68) < .03, `after the clap the pointer is at ${after.pointer?.x.toFixed(2)}, not on the right hand`);
  assert.equal(after.hands.find((h) => h.role === 'point').label, 'Right');
  // The model sometimes gives both hands the same label for a while after they part. The pointing hand is then the one
  // on the side it was seen working on before, whatever the labels are called (the model names hands as if mirrored,
  // so a real right hand is often labelled "Left").
  for (const [mine, theirs] of [['Right', 'Left'], ['Left', 'Right']]) {
    const g2 = new Gestures({ calibrated: true, pointer: mine }), pair = (a, b, la = mine, lb = theirs) => [hand(a, y, S, 'open', { label: la }), hand(b, y, S, 'open', { label: lb })];
    play(g2, pair(rx, lx), 40);                                                                                        // working apart: the side is learned
    play(g2, (i) => pair(rx + (mid - .01 - rx) * (i + 1) / 4, lx + (mid + .01 - lx) * (i + 1) / 4), 4); play(g2, pair(mid - .01, mid + .01), 6);   // a clap
    for (const order of [0, 1]) {
      const g3 = Object.assign(new Gestures({ calibrated: true, pointer: mine }), { side: g2.side });
      const apart = play(g3, order ? [hand(lx, y, S, 'open', { label: mine }), hand(rx, y, S, 'open', { label: mine })] : [hand(rx, y, S, 'open', { label: mine }), hand(lx, y, S, 'open', { label: mine })], 14).at(-1);
      assert.ok(Math.abs(apart.pointer.x - .68) < .03, `two "${mine}" hands (listed ${order ? 'far' : 'near'} one first): the pointer went to ${apart.pointer?.x.toFixed(2)}`);
    }
  }
});
test('one hand reported twice by the model is one hand: no freeze, the grab is kept', () => {
  const g = new Gestures({ calibrated: true, pointer: 'Right' }), S = .12, [x, y] = at(.6, .5);
  play(g, [hand(x, y, S, 'open')], 8); assert.equal(count(play(g, [hand(x, y, S, 'cup')], 10), 'down'), 1);
  const twice = play(g, (i) => [hand(x + i * .004, y, S, 'cup'), hand(x + i * .004 + .003, y + .002, S, 'cup', { label: 'Left' })], 20);
  assert.equal(count(twice, 'tangled'), 0, 'a doubled detection froze the hand'); assert.equal(count(twice, 'up'), 0, 'a doubled detection dropped the grab');
  assert.ok(twice.at(-1).pointer.x < .6 - .05 && twice.at(-1).hands.length === 1, 'the pointer stopped following, or a second hand was invented');
});
test('a second hand that just drops out of view beside the first is not a clap: nothing freezes', () => {
  const g = new Gestures({ calibrated: true, pointer: 'Right' }), S = .12, [x, y] = at(.6, .5);
  // 1.55 palm lengths apart, side by side, not closing in; then the second hand is simply no longer reported.
  const outs = [...play(g, [hand(x, y, S, 'open'), hand(x + .14, y, S, 'open', { label: 'Left' })], 15), ...play(g, [hand(x, y, S, 'open')], 15)];
  assert.equal(count(outs, 'tangled'), 0, 'the pointer froze'); assert.ok(outs.every((o) => o.pointer), 'the pointer was lost');
});
const far = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
test('a grab and a release land where the hand was holding still, not where closing or opening the fingers shifted it', () => {
  const g = new Gestures({ calibrated: true, pointer: 'Right' }), S = .12, [x, y] = at(.6, .5), [x2, y2] = at(.4, .62);
  const still = play(g, [hand(x, y, S, 'open')], 20).at(-1).pointer;
  // The fingers close, and the palm slides 1.5% of the picture as they do.
  const closing = [...play(g, (i) => [hand(x + .005 * (i + 1), y + .005 * (i + 1), S, 'cup')], 3), ...play(g, [hand(x + .015, y + .015, S, 'cup')], 8)], down = closing.find((o) => o.down);
  assert.ok(down && far(down.at, still) < .008, `the grab landed ${down ? far(down.at, still).toFixed(3) : '?'} away from where the hand was resting`);
  assert.ok(far(closing.at(-1).pointer, still) < .012, 'the held thing jumped after the grab');
  // Carried somewhere else, held still, then the fingers open and the palm slides back.
  play(g, (i) => [hand(x + .015 + (x2 - x) * (i + 1) / 10, y + .015 + (y2 - y) * (i + 1) / 10, S, 'cup')], 10);
  const held = play(g, [hand(x2 + .015, y2 + .015, S, 'cup')], 20).at(-1).pointer;
  const opening = [...play(g, (i) => [hand(x2 + .015 - .005 * (i + 1), y2 + .015 - .005 * (i + 1), S, 'open')], 3), ...play(g, [hand(x2, y2, S, 'open')], 10)], up = opening.find((o) => o.up);
  assert.ok(up && far(up.at, held) < .008, `the release landed ${up ? far(up.at, held).toFixed(3) : '?'} away from where the hand was holding`);
});
test('a release while the hand is moving lands where the hand is, not where it was', () => {
  const g = new Gestures({ calibrated: true, pointer: 'Right' }), S = .12, [x, y] = at(.3, .5);
  play(g, [hand(x, y, S, 'open')], 10); play(g, [hand(x, y, S, 'cup')], 12);
  const outs = play(g, (i) => [hand(x - (i + 1) * .014, y, S, i < 12 ? 'cup' : 'open')], 24), up = outs.find((o) => o.up);   // a steady pull across the screen, let go on the move
  assert.ok(up && far(up.at, up.pointer) < .004, `a moving release was pulled back by ${up ? far(up.at, up.pointer).toFixed(3) : '?'}`);
});
test('the pointer runs ahead of a moving hand but never past one that has stopped', () => {
  const run = (lead) => { const g = Object.assign(new Gestures({ calibrated: true, pointer: 'Right' }), { lead }); play(g, [hand(.7, .5, .12, 'open')], 15);
    return [play(g, (i) => [hand(.7 - (i + 1) * .02, .5, .12, 'open')], 12), play(g, [hand(.46, .5, .12, 'open')], 30)]; };
  const [moving, stopped] = run(.06), [plain] = run(0), end = stopped.at(-1).pointer.x;
  assert.ok(moving.at(-1).pointer.x > plain.at(-1).pointer.x + .005, 'the pointer was not run ahead of the bare filter');
  assert.ok(Math.max(...stopped.map((o) => o.pointer.x)) - end < .003, `the pointer overshot a stopped hand by ${(Math.max(...stopped.map((o) => o.pointer.x)) - end).toFixed(3)}`);
});
test('glide: between pictures the pointer carries on at its own speed and meets the next picture without a jump or a stall', () => {
  const gl = new Glide(), near = (a, b) => Math.abs(a - b) < 1e-9;
  assert.equal(gl.at(0), null);
  gl.set({ pointer: { x: .5, y: .5 }, motion: { vx: 1, vy: -.5 } }, 1000);
  const a = gl.at(1004), b = gl.at(1016), c = gl.at(1200);
  assert.ok(near(a.x, .504) && near(b.x, .516) && near(c.x, .545), `x ran ${a.x}, ${b.x}, ${c.x}`);          // speed times time, for 45 ms at most
  assert.ok(near(a.y, .498) && near(c.y, .4775), `y ran ${a.y}, ${c.y}`);
  gl.set({ pointer: { x: .53, y: .49 }, motion: { vx: 0, vy: 0 } }, 1200);                                    // a hand seen to stop: the pointer settles on it
  assert.ok(near(gl.at(1200).x, .545), 'the next picture made the pointer jump');
  assert.ok(Math.abs(gl.at(1500).x - .53) < 1e-3 && Math.abs(gl.at(1500).y - .49) < 1e-3, 'the pointer never settled on the new picture');
  gl.set({ pointer: { x: .9, y: .2 } }, 1600); assert.ok(near(gl.at(1600).x, .9), 'a real jump was smeared');
  gl.set({ pointer: null }, 1700); assert.equal(gl.at(1700), null);
});
// The gesture engine and the glide together, drawn every 4.17 ms (a 240 Hz display) from a picture every 33 ms that
// takes 25 ms to read. handAt(i) is where the hand is in picture i. Returns the drawn pointer as [time, x].
function drawn(handAt, n = 70) {
  const g = new Gestures({ calibrated: true, pointer: 'Right' }), gl = new Glide(), shown = [], pictures = [];
  for (let i = 0; i < n; i++) pictures.push({ taken: i * 33.333, f: g.feed(frame([hand(handAt(i), .5, .12, 'open')]), i / 30) });
  let k = 0;
  for (let now = 0; now < n * 33.333; now += 4.1667) {
    while (k < pictures.length && now >= pictures[k].taken + 25) gl.set(pictures[k++].f, now);
    const p = gl.at(now); if (p) shown.push([now, p.x]);
  }
  return shown;
}
test('drawn at 240 Hz: the pointer moves on every frame of a steady sweep, with no jumps', () => {
  const shown = drawn((i) => (i < 15 ? .7 : i < 27 ? .7 - (i - 14) * .02 : .46)), sweep = shown.filter(([t]) => t > 640 && t < 880), steps = sweep.slice(1).map(([, x], i) => x - sweep[i][1]);
  assert.ok(steps.every((d) => d > 0), `the pointer stalled or went backwards ${steps.filter((d) => d <= 0).length} times in ${steps.length} drawn frames`);
  assert.ok(Math.max(...steps) < .0075, `the pointer jumped ${Math.max(...steps).toFixed(4)} of the screen in one drawn frame (0.0035 is the hand's own pace)`);
});
test('drawn at 240 Hz: the pointer eases into a stop, and runs past a dead stop by no more than one picture of travel', () => {
  const over = (shown) => Math.max(...shown.map(([, x]) => x)) - shown.at(-1)[1];
  // A hand slowing to rest over a third of a second, the way a hand arrives at a target.
  const pos = []; let x = .7, v = .02; for (let i = 0; i < 70; i++) { if (i >= 15 && i < 27) x -= v; else if (i >= 27 && v > 0) { v = Math.max(0, v - .002); x -= v; } pos.push(x); }
  const gentle = over(drawn((i) => pos[i])), dead = over(drawn((i) => (i < 15 ? .7 : i < 27 ? .7 - (i - 14) * .02 : .46)));
  assert.ok(gentle < .006, `arriving at a target, the drawn pointer ran ${gentle.toFixed(4)} of the screen past it`);
  assert.ok(dead < .032, `after a dead stop from full speed the drawn pointer ran ${dead.toFixed(4)} of the screen past it`);
});
test('clap: a held grab lets go once, and one hand left after a merge is trusted again', () => {
  const g = new Gestures({ calibrated: true, pointer: 'Right' }), S = .12, rx = at(.6, .5)[0], y = .5;
  play(g, [hand(rx, y, S, 'open')], 8); const held = play(g, [hand(rx, y, S, 'cup')], 10);
  assert.equal(count(held, 'down'), 1);
  const outs = [...play(g, (i) => [hand(rx, y, S, 'cup'), hand(rx + .27 - i * .08, y, S, 'open', { label: 'Left' })], 4), ...play(g, [hand(rx, y, S, 'cup'), hand(rx + .02, y, S, 'open', { label: 'Left' })], 5)];   // the other hand comes across and lands on it
  assert.equal(count(outs, 'up'), 1, 'the grab was not released when the hands touched'); assert.ok(outs.slice(-5).every((o) => !o.grab));
  const alone = play(g, [hand(rx, y, S, 'open')], 30);                                                    // the other hand is gone; this one stays
  assert.ok(alone.at(-1).pointer && !alone.at(-1).tangled, 'a single hand was never trusted again after the merge');
  assert.ok(first(alone, 'pointer') >= 0 && alone.slice(0, 5).every((o) => o.tangled), 'it was trusted at once, before the model could have settled');
});
// A hand turned about the wrist: the fake hand's landmarks are rotated in the camera picture.
const rolled = (cx, cy, size, pose, a) => { const h = hand(cx, cy, size, pose), c = Math.cos(a), s = Math.sin(a), A = 4 / 3; h.lm = h.lm.map((p) => { const x = (p.x - cx) * A, y = p.y - cy; return { x: cx + (x * c - y * s) / A, y: cy + x * s + y * c }; }); return h; };
test('wrist turn: a closed hand reports how far it rolled, clockwise as the player sees it; an open hand reports nothing', () => {
  const g = new Gestures({ calibrated: true, pointer: 'Right' }), sum = (outs) => outs.reduce((s, o) => s + (o.roll || 0), 0);
  play(g, [hand(.5, .5, .12, 'open')], 8); play(g, [hand(.5, .5, .12, 'cup')], 10);
  // The camera sees the hand from the front, so the player's clockwise is anticlockwise in the raw picture (negative angle here).
  const cw = sum(play(g, (i) => [rolled(.5, .5, .12, 'cup', -(i + 1) * .05)], 16));
  assert.ok(Math.abs(cw - .8) < .12, `a 0.8 rad clockwise turn was reported as ${cw.toFixed(2)}`);
  const back = sum(play(g, (i) => [rolled(.5, .5, .12, 'cup', -.8 + (i + 1) * .05)], 16));
  assert.ok(Math.abs(back + .8) < .12, `turning back was reported as ${back.toFixed(2)}`);
  play(g, [rolled(.5, .5, .12, 'cup', 0)], 20);                                                       // let the smoothing settle
  assert.equal(sum(play(g, (i) => [rolled(.5, .5, .12, 'cup', noise() * .004)], 30)), 0, 'a still hand turned the dial');
  const g2 = new Gestures({ calibrated: true, pointer: 'Right' }); play(g2, [hand(.5, .5, .12, 'open')], 8);
  assert.equal(sum(play(g2, (i) => [rolled(.5, .5, .12, 'open', -(i + 1) * .05)], 16)), 0, 'an open hand turned something');
});
test('a second, curled hand does not block a grab unless something can be turned with two hands', () => {
  const g = new Gestures({ calibrated: true, pointer: 'Right' }), S = .12, [x, y] = at(.6, .5), left = (pose) => hand(.82, .6, S, pose, { label: 'Left' });
  g.allowTwo = false; play(g, [hand(x, y, S, 'open'), left('fist')], 10);
  const outs = play(g, [hand(x, y, S, 'cup'), left('fist')], 10);
  assert.equal(count(outs, 'down'), 1, 'the grab was swallowed by the other hand'); assert.equal(count(outs, 'two'), 0);
  g.allowTwo = true; assert.ok(count(play(g, [hand(x, y, S, 'cup'), left('fist')], 6), 'two') > 0, 'the two-hand turn no longer forms where it is allowed');
});
test('flick: letting go while the hand is moving reports its speed; letting go at rest reports none', () => {
  const g = new Gestures({ calibrated: true, pointer: 'Right' });
  play(g, [hand(.6, .5, .12, 'open')], 8); play(g, [hand(.6, .5, .12, 'cup')], 10);
  const fl = [...play(g, (i) => [hand(.6 - (i + 1) * .04, .5, .12, 'cup')], 4), ...play(g, (i) => [hand(.44 - (i + 1) * .04, .5, .12, 'open')], 6)].find((o) => o.up);
  assert.ok(fl && fl.flick > 1, `a flick was reported as ${fl?.flick?.toFixed(2)}`);
  play(g, [hand(.2, .5, .12, 'open')], 8); play(g, [hand(.2, .5, .12, 'cup')], 10);
  const still = play(g, [hand(.2, .5, .12, 'open')], 10).find((o) => o.up);
  assert.ok(still && still.flick < .3, `letting go at rest reported a flick of ${still?.flick?.toFixed(2)}`);
});
test('a hand moving too fast to read does not grab until it slows', () => {
  const g = new Gestures({ calibrated: true, pointer: 'Right' }), S = .12;
  play(g, [hand(.75, .5, S, 'open')], 8);
  const fly = play(g, (i) => [hand(.75 - (i + 1) * .09, .5, S, 'cup')], 5);                                // about 3.6 picture heights a second, shut
  assert.equal(count(fly, 'down'), 0, 'a blurred hand grabbed');
  assert.equal(count(play(g, [hand(.3, .5, S, 'cup')], 10), 'down'), 1, 'the hand did not grab once it was still');
});
// A scripted player goes through setup: hand size .1, resting right of centre, pinch that only closes to `gap`.
function calibrate(gap = .1) {
  const g = new Gestures(), cal = new Calibration(), H = (x, y, s, pose) => [hand(x, y, s, pose, { gap })];
  const feed = (hands, n) => { let v; play(g, hands, n, (o, t) => { v = cal.feed(o, t); }); return v; };
  const seen = [feed(H(.45, .5, .1, 'open'), 40).step];
  seen.push(feed(H(.45, .5, .1, 'pinch'), 24).step, feed(H(.45, .5, .1, 'open'), 8).step);
  feed(H(.45, .5, .1, 'fist'), 22);
  feed((i) => H(.45, .5, .1 + i * .013, 'fist'), 6); seen.push(feed(H(.45, .5, .178, 'fist'), 10).step);
  feed(H(.45, .5, .1, 'open'), 6); feed(H(.78, .2, .1, 'open'), 26);
  return { view: feed(H(.2, .78, .1, 'open'), 26), seen };
}
test('calibration: four steps produce a personal profile', () => {
  const { view, seen } = calibrate(), p = view.profile;
  assert.deepEqual(seen, [2, 2, 3, 4], 'steps advanced as ' + seen);
  assert.ok(view.done && p.calibrated && p.pointer === 'Right');
  assert.ok(Math.abs(p.neutral.x - .55) < .01 && Math.abs(p.neutral.y - .533) < .01 && Math.abs(p.palm - .1) < .005, 'neutral point or palm size wrong');
  assert.ok(p.pinchOn > .1 && p.pinchOn < p.pinchOff && p.pinchOff < .86, `pinch thresholds ${p.pinchOn.toFixed(2)} / ${p.pinchOff.toFixed(2)}`);
  assert.ok(p.fistOn > .63 && p.fistOn < p.fistOff && p.fistOff < 1.9, `fist thresholds ${p.fistOn.toFixed(2)} / ${p.fistOff.toFixed(2)}`);
  assert.ok(p.gripOn > .8 && p.gripOn < p.gripOff && p.gripOff < 1.8, `grip thresholds ${p.gripOn.toFixed(2)} / ${p.gripOff.toFixed(2)}`);
  assert.ok(p.pushOn >= .5 && p.pushOn <= 3 && p.pushOff < p.pushOn && p.pushDepth >= .04, 'push thresholds out of range');
  assert.ok(Math.abs(p.bounds.x0 - .22) < .01 && Math.abs(p.bounds.x1 - .8) < .01 && p.bounds.y0 < p.neutral.y && p.bounds.y1 > p.neutral.y, 'reach bounds wrong');
  const g = new Gestures(p), rest = play(g, [hand(.45, .5, .1, 'open')], 20).at(-1), far = play(g, [hand(.2, .78, .1, 'open')], 30).at(-1);
  assert.ok(Math.abs(rest.pointer.x - .5) < .01 && Math.abs(rest.pointer.y - .5) < .01, 'the resting hand is not at the centre of the screen');
  assert.ok(far.pointer.x > .98 && far.pointer.y > .98, 'full reach does not reach the corner');
});
test('calibration waits for a still hand and for one hand only', () => {
  const g = new Gestures(), cal = new Calibration();
  let v; const see = (o, t) => { v = cal.feed(o, t); }; play(g, (i) => [hand(.3 + i * .008, .5, .1, 'open')], 45, see);
  assert.equal(v.step, 1, 'a moving hand was accepted');
  play(g, [hand(.3, .5, .1, 'open'), hand(.7, .5, .1, 'open', { label: 'Left' })], 45, see);
  assert.ok(v.step === 1 && /one hand/.test(v.text), 'two hands were accepted');
});
test('a personal profile catches a pinch the standard thresholds miss', () => {
  const weak = (g) => count([...play(g, [hand(.45, .5, .1, 'open')], 10), ...play(g, [hand(.45, .5, .1, 'pinch', { gap: .34 })], 10)], 'down');
  assert.equal(weak(new Gestures()), 0); assert.equal(weak(new Gestures(calibrate(.34).view.profile)), 1);
});
test('a short calibrated reach is widened, so a small hand movement cannot cross the screen', () => {
  const p = cleanProfile({ calibrated: true, neutral: { x: .5, y: .5 }, bounds: { x0: .45, y0: .46, x1: .55, y1: .54 } });
  assert.ok(p.bounds.x1 - p.bounds.x0 >= .44 - 1e-9 && p.bounds.y1 - p.bounds.y0 >= .34 - 1e-9, `reach is only ${(p.bounds.x1 - p.bounds.x0).toFixed(2)} by ${(p.bounds.y1 - p.bounds.y0).toFixed(2)}`);
  const g = new Gestures(p), a = play(g, [hand(.5, .5, .1, 'open')], 30).at(-1).pointer, b = play(g, [hand(.48, .5, .1, 'open')], 30).at(-1).pointer;
  assert.ok(Math.abs(b.x - a.x) < .06, `a 2% hand movement moved the pointer ${(Math.abs(b.x - a.x) * 100).toFixed(0)}% of the screen`);
});
test('profiles are sanitised and survive storage', () => {
  const junk = cleanProfile({ pinchOn: 'x', pinchOff: .1, fistOn: 9, gripOn: 5, gripOff: 0, pushOff: 99, neutral: { x: 4 }, bounds: { x0: .95, y1: 0 }, pointer: 'Up' });
  assert.ok(junk.pinchOn < junk.pinchOff && junk.fistOn < junk.fistOff && junk.gripOn < junk.gripOff && junk.pushOff < junk.pushOn && junk.bounds.x0 < junk.neutral.x && junk.bounds.y1 > junk.neutral.y && junk.pointer === '' && !junk.calibrated);
  assert.ok(Math.abs(cleanProfile().bounds.x0 - DEFAULT_PROFILE.bounds.x0) < 1e-9 && cleanProfile().pinchOn === DEFAULT_PROFILE.pinchOn);
  assert.deepEqual(loadProfile(), cleanProfile(), 'no storage should mean the standard profile');
  const store = new Map(); globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const mine = calibrate().view.profile; saveProfile(mine);
  assert.deepEqual(loadProfile(), mine);
  store.set([...store.keys()][0], '{broken'); assert.deepEqual(loadProfile(), cleanProfile());
  delete globalThis.localStorage;
});

console.log(failed ? `\n${failed} test(s) failed` : '\nAll hand-tracking tests passed');
process.exit(failed ? 1 : 0);
