// Hand tracking in the real game, driven by scripted hands in headless Chrome with a fake camera.
// Needs the built index.html served on localhost (npm start) and playwright-core:
//   INK_TOOLCHAIN=/path/with/node_modules node tools/spatial-browser.test.mjs [shots-dir]
// Covers: mouse/keyboard untouched when tracking is off or has no camera; saved profile reloads;
// hands look but never walk (the keyboard does); grabbing by closing the hand; the drawn 3D hands;
// view locks while grabbing, behind a menu or in a puzzle; the torn-paper puzzle; the four-step setup;
// the five-step tutorial; hand presses on the title, the opening questions and the contract; voice lines bundled;
// a scripted controller walking, looking, pausing and pressing menu buttons; the holding cell (section 7); turning hand tracking on and off mid-game (section 8).
// GPU=1 runs on the Mac's own graphics instead of the software renderer (steadier on a busy machine).
import { createRequire } from 'node:module';
import { hand, frame, at } from './fakehand.mjs';
const { chromium } = createRequire(import.meta.url)((process.env.INK_TOOLCHAIN || '/private/tmp/ink-ecc-toolchain') + '/node_modules/playwright-core');
const URL0 = process.env.GAME_URL || 'http://localhost:4173', SHOTS = process.argv[2] || '';
const exe = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Software rendering by default (works anywhere); GPU=1 uses the Mac's own graphics, which keeps real-time checks steady on a busy machine.
const gl = process.env.GPU ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const base = { version: 2, caseIndex: 0, beat: 0, coercion: 'refused', confiscated: true, pounds: 0, hp: 100, score: 1250, soles: false, hasWatch: false, solarTime: 20, powder: 0, found: [], awards: [], exhibits: [0], links: [], guardTime: 0, strip: 0, loss: null, checkpoint: { exhibits: [0], links: [] }, stage: 'street', gates: [true, false], quiz: { pre: null }, luminol: true, uv: true };
const PROFILE = 'redacted-donor.hands.v1', TUTORIAL = 'redacted-donor.hands.tutorial';
let failed = 0;
const only = (process.env.ONLY || '').split(',').filter(Boolean), run = (n) => !only.length || only.includes(String(n));
const check = (ok, name, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); };
const ready = (p) => p.waitForFunction(() => document.getElementById('game')?.dataset.ready === 'true', null, { timeout: 120000 });
const shot = (p, name) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png` });
const text = (p, id) => p.evaluate((i) => { const el = document.getElementById(i); return el.hidden ? '' : el.textContent; }, id);
const moved = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// Opens the game with a save, the hand profile and the tutorial flag already in storage (or absent).
async function open(p, save, { comfort = false, profile = null, tutorial = false } = {}) {
  await p.goto(URL0 + '/package.json', { timeout: 60000 });
  await p.evaluate(([s, c, pr, tu, keys]) => {
    localStorage.clear(); if (s) localStorage.setItem('redacted-donor.case.v1', JSON.stringify(s));
    localStorage.setItem('redacted-donor.comfort', c ? 'on' : 'off'); localStorage.setItem('redacted-donor.cloud.sync', 'off');
    if (pr) localStorage.setItem(keys[0], JSON.stringify(pr)); if (tu) localStorage.setItem(keys[1], 'done');
  }, [save, comfort, profile, tutorial, [PROFILE, TUTORIAL]]);
  await p.goto(URL0 + '/index.html?spatialtest', { waitUntil: 'commit', timeout: 120000 }); await ready(p); await p.waitForTimeout(500);
}
async function begin(p) {
  await p.evaluate(() => document.getElementById('begin').click()); await p.waitForTimeout(700);
  await p.evaluate(() => document.querySelector('#panelBody [data-action=back]')?.click()); await p.waitForTimeout(900);
}
const toggle = async (p) => { await p.click('#spatialToggle'); await p.waitForFunction(() => /^(On|Off)$/.test(document.querySelector('#spatialToggle b').textContent), null, { timeout: 120000 }); return p.evaluate(() => document.querySelector('#spatialToggle b').textContent); };
let t = 100;
// Feeds n camera frames of scripted hands, 30 a second on the gesture clock.
async function feed(p, hands, n = 1) { for (let i = 0; i < n; i++) { t += 1 / 30; await p.evaluate(([f, t]) => window.__spatial.feed(f, t), [frame(typeof hands === 'function' ? hands(i) : hands), t]); await p.waitForTimeout(40); } }
const cam = (p) => p.evaluate(() => window.__cam()), guide = (p) => p.evaluate(() => window.__guide());
const rect = (p, sel) => p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [(r.left + r.width / 2) / innerWidth, (r.top + r.height / 2) / innerHeight]; }, sel);
const SIZE = .1, R = (u, v, pose = 'open', prof) => hand(...at(u, v, SIZE, prof), SIZE, pose), L = (dx = 0, dy = 0, pose = 'open') => hand(.82 + dx * SIZE / (4 / 3), .55 + dy * SIZE, SIZE, pose, { label: 'Left' });
// Moves the pointing hand onto a page element and pinches it (a pinch is one way to grab).
async function press(p, sel, prof) { const [u, v] = await rect(p, sel); if (process.env.DEBUG) { await feed(p, [R(u, v, 'open', prof)], 14); console.log('  under pointer:', await p.evaluate(([u, v]) => { const e = document.elementFromPoint(u * innerWidth, v * innerHeight), g = document.getElementById('game'), h = document.getElementById('handPointer'); return [e?.tagName, e?.id, e?.className, 'modal=' + g.dataset.modal, 'cine=' + g.dataset.cine, 'ptr=' + h.style.transform, 'hover=' + document.querySelector('.hand-hover')?.id].join(' '); }, [u, v])); await shot(p, 'debug-press'); } await feed(p, [R(u, v, 'open', prof)], 14); await feed(p, [R(u, v, 'pinch', prof)], 8); await feed(p, [R(u, v, 'open', prof)], 8); await p.waitForTimeout(500); }

// ── 1. No camera: the toggle falls back, and mouse and keyboard play exactly as before. ──
if (run(1)) {
  const b = await chromium.launch({ executablePath: exe, headless: true, args: gl }), p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await open(p, { ...base, position: [-2.2, 3.3, -Math.PI / 2, 0] });
  await p.click('#spatialToggle'); await p.waitForTimeout(2500);
  check(await p.evaluate(() => document.querySelector('#spatialToggle b').textContent) === 'Off' && /Staying with the mouse/.test(await text(p, 'spatialNote')), 'no camera: falls back to the mouse with a message');
  await begin(p);
  const c0 = await cam(p); await p.keyboard.down('KeyW'); await p.waitForTimeout(700); await p.keyboard.up('KeyW');
  const c1 = await cam(p); await p.keyboard.down('ArrowLeft'); await p.waitForTimeout(500); await p.keyboard.up('ArrowLeft');
  const c2 = await cam(p); await p.mouse.move(640, 400); await p.mouse.down(); await p.mouse.move(760, 400, { steps: 6 }); await p.mouse.up();
  const c3 = await cam(p);
  check(moved(c0, c1) > .3, 'tracking off: W walks', moved(c0, c1).toFixed(2) + ' m');
  check(c2[2] - c1[2] > .2, 'tracking off: arrow key turns', (c2[2] - c1[2]).toFixed(2) + ' rad');
  check(Math.abs(c3[2] - c2[2]) > .1, 'tracking off: mouse drag turns', (c3[2] - c2[2]).toFixed(2) + ' rad');
  check(await p.evaluate(() => document.getElementById('handPointer').hidden && document.getElementById('spatialView').hidden && document.getElementById('spatialCard').hidden), 'tracking off: no hand UI on screen');
  await b.close();
}

const b = await chromium.launch({ executablePath: exe, headless: true, args: [...gl, '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['camera'] }), p = await ctx.newPage();
let a, c, g; const problems = []; p.on('pageerror', (e) => problems.push(e.message)); p.on('console', (m) => { if (/Content Security|Refused to/i.test(m.text())) problems.push(m.text().slice(0, 160)); });

// ── 2. A saved profile: no setup; hands turn the view but never walk; the view locks. ──
if (run(2)) {
await open(p, { ...base, position: [-2.2, 3.3, -Math.PI / 2, 0] }, { profile: { calibrated: true, pointer: 'Right' }, tutorial: true });
check(await toggle(p) === 'On' && !(await guide(p)) && await p.evaluate(() => document.getElementById('spatialCard').hidden), 'saved profile: tracking starts without setup');
await begin(p);
await feed(p, [R(.5, .5), L()], 16);
a = await cam(p); await feed(p, (i) => [R(.5, .5), L(0, -Math.min(1.3, (i + 1) * .2))], 30); c = await cam(p);
check(moved(a, c) < .02, 'hands never walk: raising or moving a hand leaves the feet still', moved(a, c).toFixed(3) + ' m');
a = await cam(p); await p.keyboard.down('KeyW'); await feed(p, [R(.5, .5), L()], 16); await p.keyboard.up('KeyW'); c = await cam(p);
check(moved(a, c) > .3, 'tracking on: W still walks', moved(a, c).toFixed(2) + ' m');
check((await p.evaluate(() => window.__limbs())).join() === 'true,true', 'both hands are drawn in the room');
a = await cam(p); await feed(p, [R(.97, .5), L()], 26); c = await cam(p);
check(a[2] - c[2] > .2 && moved(a, c) < .05, 'hand at the right edge turns the view right, feet still', (a[2] - c[2]).toFixed(2) + ' rad');
await feed(p, [R(.5, .5), L()], 10); await feed(p, [R(.5, .5, 'cup'), L()], 8);
a = await cam(p); await feed(p, [R(.97, .5, 'cup'), L()], 26); c = await cam(p);
check(Math.abs(a[2] - c[2]) < .01, 'lock: no turning while the hand is closed on something', (a[2] - c[2]).toFixed(3) + ' rad');
await feed(p, [R(.5, .5), L()], 12);
await press(p, '#hudPause');
check(await p.evaluate(() => !!document.querySelector('#panelBody [data-action=hand-setup]') && !!document.querySelector('#panelBody [data-action=hand-tutorial]')), 'a pinch on Pause opens the menu, with hand setup and tutorial');
await shot(p, 'hands-pause');
a = await cam(p); await feed(p, [R(.97, .5), L()], 20); c = await cam(p);
check(Math.abs(a[2] - c[2]) < .01 && (await p.evaluate(() => window.__limbs())).join() === 'false,false', 'lock: no turning behind a menu, and no 3D hands over it');
await feed(p, [R(.5, .5), L()], 8); await press(p, '#panelBody [data-action=back]');
check(await p.evaluate(() => document.getElementById('overlay').hidden), 'a pinch on Resume closes the menu');
// The torn-paper puzzle (here in the prologue, where no guard can interrupt): each piece is carried in one closed-hand drag
// past all four places and pulls itself into its own.
await p.evaluate(() => window.__open('torn', { doc: { title: 'Call card', lines: ['Patient advocate', '640 kHz'] } })); await p.waitForFunction(() => !document.getElementById('hands').hidden, null, { timeout: 20000 }); await p.waitForTimeout(400);
const at2 = (x, y) => p.evaluate(([x, y]) => window.__board(x, y), [x, y]), said = () => p.evaluate(() => document.getElementById('handsSay').textContent);
// Every screen position is looked up before the first move: the puzzle closes by itself once the page is whole.
const homes = [], starts = []; for (const h of [[225, 115], [335, 115], [225, 205], [335, 205]]) homes.push(await at2(...h)); for (const c of [[75, 75], [485, 75], [75, 245], [485, 245]]) starts.push(await at2(...c));
await feed(p, [R(...await at2(280, 160))], 10); await shot(p, 'torn-start');
const before = await said(); let whole = '';
await feed(p, (i) => [R(...[[.2, .2], [.8, .2]][i > 9 ? 1 : 0])], 20);   // an open hand sweeping across the pieces moves nothing
for (let [u, v] of starts) {
  await feed(p, [R(u, v)], 10); await feed(p, [R(u, v, 'cup')], 8);
  for (const [tu, tv] of homes) { const [fu, fv] = [u, v]; await feed(p, (i) => [R(fu + (tu - fu) * Math.min(1, (i + 1) / 8), fv + (tv - fv) * Math.min(1, (i + 1) / 8), 'cup')], 16); [u, v] = [tu, tv]; }   // pause at each place so a slow frame still sees the hand there
  await feed(p, [R(u, v)], 8); whole ||= /It reads/.test(await said()) ? await said() : '';
}
await shot(p, 'torn-done');
check(!before && !!whole, 'torn paper: grabbed pieces snap into place near their outline; the page is whole', whole);

}
// ── 3. Inside a puzzle the view is locked, the hands are drawn over it, and grabbing moves things. ──
if (run(3)) {
await open(p, { ...base, stage: 'memory', hasWatch: true, pounds: 3, caseIndex: 1, links: [0], found: ['prints', 'cooler', 'seal', 'keyTrace'], position: [.4, 8.75, 0, -.7] }, { comfort: true, profile: { calibrated: true, pointer: 'Right' }, tutorial: true });
await toggle(p); await begin(p);
await feed(p, [R(.5, .5), L()], 16); await feed(p, [R(.5, .5, 'cup'), L()], 8); await feed(p, [R(.5, .5), L()], 6);
check(await p.waitForFunction(() => !document.getElementById('hands').hidden, null, { timeout: 15000 }).then(() => true, () => false), 'closing the hand in the room opens the puzzle in front of you'); await p.waitForTimeout(600);
a = await cam(p); await feed(p, [R(.97, .5), L()], 26); c = await cam(p);
check(moved(a, c) < .02 && Math.abs(a[2] - c[2]) < .01, 'lock: no turning while a puzzle is open', (a[2] - c[2]).toFixed(3) + ' rad');
check((await p.evaluate(() => window.__limbs())).join() === 'true,true', 'both hands are drawn over the puzzle');
await shot(p, 'hands-puzzle');
await feed(p, [R(.5, .5), L()], 8); await press(p, '#handsBack'); await p.waitForTimeout(1500);
check(await p.evaluate(() => document.getElementById('hands').hidden), 'a pinch on Step back closes the puzzle');

}
// ── 4. First time: the four-step setup, then the five-step tutorial. ──
if (run(4)) {
await open(p, null);
{ const on = await toggle(p), gd = await guide(p), card = await text(p, 'spatialCard');
  check(on === 'On' && gd?.cal && /Hand setup · 1 of 4/.test(card), 'no profile: setup starts as soon as tracking is on', `${on} / ${JSON.stringify(gd)?.slice(0, 80)} / ${card.slice(0, 40)}`); }
const H = (x, y, s, pose) => [hand(x, y, s, pose)], step = async () => (await text(p, 'spatialStep')).replace(/\s+/g, ' ');
await feed(p, H(.45, .5, .1, 'open'), 12); await shot(p, 'setup-1');
await feed(p, H(.45, .5, .1, 'open'), 26); check(/2 of 4/.test(await step()), 'setup 1: framing and neutral point', await step());
await feed(p, H(.45, .5, .1, 'pinch'), 24); await feed(p, H(.45, .5, .1, 'open'), 8); check(/3 of 4/.test(await step()), 'setup 2: open hand and pinch', await step());
await feed(p, H(.45, .5, .1, 'fist'), 22); await shot(p, 'setup-3');
await feed(p, (i) => H(.45, .5, .1 + i * .013, 'fist'), 6); await feed(p, H(.45, .5, .178, 'fist'), 10); check(/4 of 4/.test(await step()), 'setup 3: fist and push', await step());
await feed(p, H(.45, .5, .1, 'open'), 6); await feed(p, H(.78, .2, .1, 'open'), 26); await feed(p, H(.2, .78, .1, 'open'), 26); await p.waitForTimeout(400);
const prof = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)), PROFILE);
check(prof?.calibrated && prof.pointer === 'Right' && prof.pinchOn < prof.pinchOff && prof.gripOn < prof.gripOff && Math.abs(prof.neutral.x - .55) < .02 && Math.abs(prof.bounds.x1 - .8) < .02, 'setup 4: reach bounds; profile saved to localStorage', prof ? `pinch ${prof.pinchOn.toFixed(2)}/${prof.pinchOff.toFixed(2)}, fist ${prof.fistOn.toFixed(2)}, push ${prof.pushOn.toFixed(2)}` : 'nothing saved');
g = await guide(p);
check(g?.tut && g.i === 0 && /Hand tutorial · 1 of 5/.test(await text(p, 'spatialCard')), 'the tutorial starts straight after setup');
const P = (u, v, pose) => R(u, v, pose, prof), wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
const until = async (fn, ms = 6000) => { for (let i = 0; i < ms / 200; i++) { if (await fn()) return true; await p.waitForTimeout(200); } return false; };
// Step 1: look at the light, steering from where the game says the view is.
await feed(p, [P(.5, .5), L(0, 3.2)], 16); await shot(p, 'tutorial-1');   // the other hand rests low in the corner: two real hands cannot share a place in the picture
for (let i = 0; i < 90 && (g = await guide(p)).i === 0 && !g.wait; i++) {
  const [x, z, yaw, pitch] = await cam(p), dx = g.target[0] - x, dz = g.target[2] - z, ey = wrap(Math.atan2(-dx, -dz) - yaw), ep = Math.atan2(g.target[1] - 1.65, Math.hypot(dx, dz)) - pitch;
  const push = (e) => (Math.abs(e) < .04 ? 0 : Math.sign(e) * (.4 + Math.min(.08, Math.abs(e) * .5)));   // past the comfort zone (70% of the reach)
  await feed(p, [P(.5 - push(ey), .5 - push(ep)), L(0, 3.2)], 3);
}
check(await until(async () => (await guide(p))?.i === 1), 'tutorial 1: looked at the light by moving the hand');
// Step 2: close the hand on the drawer handle and pull.
const drag = async (from, to, n = 18) => { await feed(p, [P(...from)], 12); await feed(p, [P(...from, 'cup')], 14); await feed(p, (i) => [P(from[0] + (to[0] - from[0]) * (i + 1) / n, from[1] + (to[1] - from[1]) * (i + 1) / n, 'cup')], n); await feed(p, [P(...to, 'cup')], 12); await feed(p, [P(...to)], 8); };   // hold at the end, so a slow frame still sees the closed hand there before it opens
const board = (x, y) => p.evaluate(([x, y]) => window.__board(x, y), [x, y]);
await p.waitForTimeout(600); await feed(p, [P(.5, .5)], 6); await shot(p, 'tutorial-2');
await drag(await board(280, 187), await board(280, 325));
check(await until(async () => (await guide(p))?.i === 2), 'tutorial 2: closed the hand on the handle and pulled the drawer open');
// Step 3: turn the first wheel to 3.
await p.waitForTimeout(600); await feed(p, [P(.5, .5)], 6); await shot(p, 'tutorial-3');
await drag(await board(190, 170), await board(190, 66), 24);   // the wheel face is nearer than the board, so the same reach covers less of it
check(await until(async () => (await guide(p))?.i === 3), 'tutorial 3: turned the wheel to the mark');
// Step 4: two closed hands turn the page.
await p.waitForTimeout(600); const two = (a, pose) => [hand(.45 - Math.cos(a) * .15, .5 + Math.sin(a) * .2, .1, pose), hand(.45 + Math.cos(a) * .15, .5 - Math.sin(a) * .2, .1, pose, { label: 'Left' })];   // a circle in the 4:3 picture
await feed(p, two(0, 'open'), 8); await feed(p, two(0, 'cup'), 8); await shot(p, 'tutorial-4'); await feed(p, (i) => two((i + 1) * .04, 'cup'), 24); await feed(p, two(.96, 'open'), 8);
check(await until(async () => (await guide(p))?.i === 4), 'tutorial 4: two closed hands turned the page');
// Step 5: a fist pushed at the camera.
await p.waitForTimeout(600); await feed(p, [hand(.45, .5, .1, 'fist')], 12); await feed(p, (i) => [hand(.45, .5, .1 + i * .013, 'fist')], 6); await shot(p, 'tutorial-5'); await feed(p, [hand(.45, .5, .178, 'fist')], 8);
check(await until(async () => !(await guide(p))), 'tutorial 5: fist push struck the glass; tutorial finished');
check(await p.evaluate((k) => localStorage.getItem(k) === 'done' && !document.getElementById('title').hidden && document.getElementById('spatialCard').hidden, TUTORIAL), 'after the tutorial: back on the title screen, tutorial remembered as done');
// Returning player: tracking on again goes straight in, and Skip leaves a running tutorial.
await p.click('#spatialToggle'); await p.waitForTimeout(400); check(await toggle(p) === 'On' && !(await guide(p)), 'returning player: no setup, no tutorial');
await p.click('#spatialTut'); await p.waitForTimeout(500); const running = (await guide(p))?.tut; await p.click('#spatialSkip'); await p.waitForTimeout(400);
check(running && !(await guide(p)) && !(await p.evaluate(() => document.getElementById('title').hidden)), 'Skip tutorial returns to where you were');
}
// ── 5. From the title screen: the hand presses Begin, answers a question and makes the contract choices. ──
if (run(5)) {
await open(p, null, { profile: { calibrated: true, pointer: 'Right' }, tutorial: true });
await toggle(p); await feed(p, [R(.5, .5)], 10);
const body = () => text(p, 'panelBody');
await press(p, '#begin'); await p.waitForTimeout(600);
check(/Question 1 of 3/.test(await body()), 'hand on the title: Begin opens the opening questions');
await press(p, '#panelBody [data-action=quiz-pick]');
check(/Question 2 of 3/.test(await body()), 'hand: an answer is picked');
await press(p, '#panelBody [data-action=quiz-skip]'); await p.waitForTimeout(900);
check(/placement was canceled/.test(await body()), 'hand: Skip the questions reaches the recruiter');
// The second press drifts off the button while the hand is closed, as a real pinch does; it still counts.
const [u, v] = await rect(p, '#panelBody .choice'); await feed(p, [R(u, v)], 14); await feed(p, [R(u, v, 'pinch')], 5); await feed(p, [R(u + .09, v + .12, 'pinch')], 5); await feed(p, [R(u + .09, v + .12)], 8); await p.waitForTimeout(500);
check(/medical affidavit/.test(await body()), 'hand: a contract choice is made even when the hand drifts off the button mid-press');
const voice = await p.evaluate(() => [Object.keys(window.__audio.recorded || {}).filter((k) => k.startsWith('vo/')).length, window.__audio.sayToken || 0]);
check(voice[0] === 54 && voice[1] >= 2, 'voice lines: all 54 are bundled and decoded, and the opening scene started speaking', `${voice[0]} decoded, ${voice[1]} lines started`);
}
// ── 6. A controller (a scripted one): sticks walk and look, Start pauses, the stick pointer and A press a menu button. ──
if (run(6)) {
await open(p, { ...base, position: [-2.2, 3.3, -Math.PI / 2, 0] });
await p.evaluate(() => { window.__pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }; navigator.getGamepads = () => [window.__pad]; });
const stick = (i, v) => p.evaluate(([i, v]) => { window.__pad.axes[i] = v; }, [i, v]), btn = async (i, ms = 150) => { await p.evaluate((i) => { window.__pad.buttons[i].pressed = true; }, i); await p.waitForTimeout(ms); await p.evaluate((i) => { window.__pad.buttons[i].pressed = false; }, i); await p.waitForTimeout(250); };
// Steers the on-screen pointer onto an element with the left stick, the way a player would.
const point = async (sel) => { for (let i = 0; i < 120; i++) {
  const [dx, dy] = await p.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(), g = document.getElementById('game').getBoundingClientRect(), m = /translate\(([-\d.]+)px, ?([-\d.]+)px\)/.exec(document.getElementById('handPointer').style.transform) || [0, g.width / 2, g.height / 2]; return [r.left + r.width / 2 - g.left - m[1], r.top + r.height / 2 - g.top - m[2]]; }, sel);
  if (Math.hypot(dx, dy) < 12) break; await stick(0, Math.max(-1, Math.min(1, dx / 80))); await stick(1, Math.max(-1, Math.min(1, dy / 80))); await p.waitForTimeout(40); }
  await stick(0, 0); await stick(1, 0); await p.waitForTimeout(120); };
await stick(0, .6); await p.waitForTimeout(200); await stick(0, 0);                    // touching the controller brings up the pointer on the title
await point('#controls'); await btn(0);
check(/Left stick/.test(await text(p, 'panelBody')) && /Keyboard and mouse/.test(await text(p, 'panelBody')), 'controller on the title: the pointer and A open Controls, which lists the controller');
await btn(1); check(await p.evaluate(() => document.getElementById('overlay').hidden), 'controller: B goes back');
await begin(p);
a = await cam(p); await stick(1, -1); await p.waitForTimeout(700); await stick(1, 0); c = await cam(p);
check(moved(a, c) > .3, 'controller: left stick walks', moved(a, c).toFixed(2) + ' m');
a = await cam(p); await stick(2, 1); await p.waitForTimeout(500); await stick(2, 0); c = await cam(p);
check(a[2] - c[2] > .3 && moved(a, c) < .05, 'controller: right stick turns', (a[2] - c[2]).toFixed(2) + ' rad');
await btn(9);
check(await p.evaluate(() => !!document.querySelector('#panelBody [data-action=back]')), 'controller: Start pauses');
await point('#panelBody [data-action=back]'); await btn(0);
check(await p.evaluate(() => document.getElementById('overlay').hidden), 'controller: the stick pointer and A press Resume');
}
// ── 7. The holding cell: solid walls, the ink hearts (night and detective only), the cracked glass for Mateo and under UV. ──
if (run(7)) {
  const aim = (x, z, tx, ty, tz) => [x, z, Math.atan2(-(tx - x), -(tz - z)), Math.atan2(ty - 1.6, Math.hypot(tx - x, tz - z))];
  const det = { ...base, stage: 'detective', caseIndex: 2, hasWatch: true, pounds: 3, solarTime: 60, gates: [true, true], links: [0, 1], exhibits: [0, 1, 2, 8], checkpoint: { exhibits: [0, 1, 2, 8], links: [0, 1] } };
  const prompt = () => p.evaluate(() => { const e = document.getElementById('prompt'); return e.hidden ? '' : e.dataset.target + ' ' + e.lastElementChild.textContent; });
  const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('redacted-donor.case.v1')));
  const handsUp = () => p.evaluate(() => !document.getElementById('hands').hidden);
  await open(p, { ...det, position: aim(2.7, 11.6, 2.3, .3, 10.98) }); await begin(p);
  check(/curio:hearts .*\(\+50\)/.test(await prompt()), 'cell: the detective is offered the ink hearts for 50 points', await prompt());
  await p.keyboard.press('KeyE'); await p.waitForTimeout(1500); let s = await saved();
  check(s.score === 1300 && s.awards.includes('curio:hearts'), 'cell: inspecting the hearts adds 50 points once', s.score + ' ' + s.awards);
  await open(p, { ...det, position: [2.3, 11.3, Math.PI, 0] }); await begin(p);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1200); await p.keyboard.up('KeyW'); const c7 = await cam(p);
  check(c7[1] < 11.8 && c7[1] > 11.5, 'cell: the mirror wall is solid from the inside', 'z ' + c7[1].toFixed(2));
  await open(p, { ...det, uv: false, position: aim(2.3, 11.25, 2.3, 1.5, 11.8) }); await begin(p);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(1200); s = await saved();
  check(!(await handsUp()) && !s.awards.length, 'cell: without the UV flashbulb the detective cannot read the glass');
  const night = { ...det, stage: 'memory', caseIndex: 1, links: [0] };   // case 2: no guard in the dispatch office yet
  await open(p, { ...night, position: aim(2.3, 11.25, 2.3, 1.5, 11.8) }); await begin(p);
  await p.keyboard.press('KeyE'); await p.waitForFunction(() => !document.getElementById('hands').hidden, null, { timeout: 15000 }).catch(() => {}); s = await saved();
  check((await handsUp()) && s.awards.includes('curio:cellGlass') && !s.awards.includes('uv:cellGlass'), 'cell: Mateo inspects the cracked glass and gets his card', String(s.awards));
  await open(p, { ...night, solarTime: 14, position: aim(2.7, 11.6, 2.3, .3, 10.98) }); await begin(p);
  check(!/hearts/.test(await prompt()), 'cell: on a day shift the hearts are not there', await prompt());
}
// ── 8. Mid-game: H and the Pause menu turn hand tracking on and off, and Pause changes the look speed. ──
if (run(8)) {
  const label = () => p.evaluate(() => document.querySelector('#spatialToggle b').textContent), waitLabel = (v) => p.waitForFunction((v) => document.querySelector('#spatialToggle b').textContent === v, v, { timeout: 120000 });
  const pauseBtn = (a) => p.evaluate((a) => document.querySelector(`#panelBody [data-action="${a}"]`)?.textContent || '', a);
  await open(p, { ...base, position: [-.6, 2.9, 0, -.5] }, { profile: { calibrated: true, pointer: 'Right' }, tutorial: true });
  await p.keyboard.press('KeyH'); await waitLabel('On'); await p.keyboard.press('KeyH'); await waitLabel('Off');
  check(await label() === 'Off', 'title: H turns hand tracking on and off before the game starts');
  await begin(p);
  await p.keyboard.press('KeyH'); await waitLabel('On');
  check(await label() === 'On', 'mid-game: H turns hand tracking on');
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  check(/on$/.test(await pauseBtn('hand-toggle')) && /normal$/.test(await pauseBtn('hand-speed')), 'pause: shows hand tracking on and the look speed', await pauseBtn('hand-toggle') + ' / ' + await pauseBtn('hand-speed'));
  await p.click('#panelBody [data-action="hand-speed"]'); await p.waitForTimeout(300);
  check(/fast$/.test(await pauseBtn('hand-speed')) && await p.evaluate(() => localStorage.getItem('redacted-donor.hands.speed')) === 'Fast', 'pause: the look speed changes and is remembered', await pauseBtn('hand-speed'));
  await p.click('#panelBody [data-action="hand-toggle"]'); await waitLabel('Off'); await p.waitForTimeout(300);
  check(/off$/.test(await pauseBtn('hand-toggle')) && !(await pauseBtn('hand-speed')), 'pause: hand tracking turns off and the game stays paused', await pauseBtn('hand-toggle'));
  await p.click('#panelBody [data-action="hand-toggle"]'); await waitLabel('On'); await p.waitForTimeout(300);
  check(/on$/.test(await pauseBtn('hand-toggle')), 'pause: hand tracking turns back on', await pauseBtn('hand-toggle'));
  await p.keyboard.press('KeyH'); await waitLabel('Off'); await p.waitForTimeout(300);
  check(/off$/.test(await pauseBtn('hand-toggle')), 'pause: H works inside the menu, and the menu shows it', await pauseBtn('hand-toggle'));
  await p.keyboard.press('KeyH'); await waitLabel('On'); await p.waitForTimeout(300);
  // The two engines: the camera read in the background (the default, with its files packed beside the game), or on the game's own thread.
  const engine = async (want) => { for (let i = 0; i < 100; i++) { const st = await p.evaluate(() => window.__spatial.stats); if (st.engine === want && st.rate >= 10) return st; await p.waitForTimeout(200); } return p.evaluate(() => window.__spatial.stats); };
  let st = await engine('background');
  check(st.engine === 'background' && st.packed && st.rate >= 10, 'engine: the camera is read in the background, from files packed with the game', JSON.stringify(st));
  await p.click('#panelBody [data-action="hand-engine"]'); st = await engine('main');
  check(st.engine === 'main' && /classic$/.test(await pauseBtn('hand-engine')) && st.rate >= 10, 'engine: Pause switches to the classic engine and it reads pictures', JSON.stringify(st) + ' / ' + await pauseBtn('hand-engine'));
  await p.click('#panelBody [data-action="hand-engine"]'); st = await engine('background');
  check(st.engine === 'background' && /smooth$/.test(await pauseBtn('hand-engine')), 'engine: and back to the smooth one', JSON.stringify(st));
  await p.click('#panelBody [data-action="back"]'); await p.waitForTimeout(400); await p.keyboard.press('KeyH'); await waitLabel('Off');
  check(await label() === 'Off', 'mid-game: H turns hand tracking off');
  // With a puzzle open, H switches between hands and mouse and the puzzle stays where it is.
  const inPuzzle = () => p.evaluate(() => !document.getElementById('hands').hidden && document.getElementById('game').dataset.modal === 'hands');
  await p.evaluate(() => window.__open('drawer', { label: 'Test drawer', contents: { title: 'Test', lines: ['One line'] } })); await p.waitForFunction(() => !document.getElementById('hands').hidden, null, { timeout: 20000 }); await p.waitForTimeout(400);
  await p.keyboard.press('KeyH'); await waitLabel('On');
  check(await inPuzzle(), 'puzzle: H turns hand tracking on and the puzzle stays open');
  await p.keyboard.press('KeyH'); await waitLabel('Off');
  check(await inPuzzle(), 'puzzle: H turns it off again and the puzzle stays open');
}
check(!problems.length, 'no page errors or security-policy violations', problems.join(' | '));
await b.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nAll browser hand-tracking checks passed');
process.exit(failed ? 1 : 0);
