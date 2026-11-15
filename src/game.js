import * as THREE from 'three';
import { buildRoom, InkTextureFactory } from './room.js';
import { furnish } from './props.js';
import { buildAnnex } from './annex.js';
import { createInkRenderer } from './renderer.js';
import { actions, cases, curios, discoveries, evidence, leads, stations, stationsGuide, supplies } from './casebook.js';
import {
  addExhibits,
  buy,
  canBuy,
  loseCase,
  readyTasks,
  memoryTasks,
  verifyLead,
  fresh,
  grant,
  objective,
  readRun,
  record,
  revive,
  stageTargets,
  startCase,
  verbs,
} from './campaign.js';
import { DAY_LENGTH,SHIFT_LENGTH,clockFace,daylight,inSearchBeam,isNight,passTime,patrolAt,patrolRange,skyName,untilShift,waitForShift } from './shifts.js';
import { adjust,paintWork,setEase,solved,startWork,workBody,workTitles } from './fieldwork.js';
import {floorplan,footprints,tallFootprints,doors,roomOf,ROOM_SOUTH} from './floorplan.js';
import { createStealth } from './stealth.js';
import { createHands } from './hands.js';
import { GameAudio } from './sound.js';
import { cloud } from './cloud.js';
import { LEGAL_DATE, PRIVACY, TERMS } from './legal.js';
import { QUIZ, DEBRIEF, MESSAGE } from './debrief.js';
import { Calibration, createSpatial, drawHands } from './spatial.js';

const $ = (id) => document.getElementById(id), clamp = THREE.MathUtils.clamp;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(61, 1, .045, 40);
camera.rotation.order = 'YXZ';
const factory = new InkTextureFactory(),
  room = buildRoom(scene, factory),
  props = furnish(scene, factory, room, camera),
  annex = buildAnnex(scene, factory);
// What each throwable is called while held, and the sound it makes when it lands.
const THROWN = { beaker: { name: 'a glass beaker', sound: 'shatter' }, paperweight: { name: 'a brass paperweight', sound: 'clank' }, bottle: { name: 'a medicine bottle', sound: 'shatter' },
  mug: { name: 'an enamel mug', sound: 'clank' }, ashtray: { name: 'a glass ashtray', sound: 'clink' }, ledger: { name: 'a ledger', sound: 'thud' } };
const stealth = createStealth({ scene, guardSheet: props.guardSheet, footprints, tallFootprints,
  routes: { room1: [[3.75,.1],[2.9,2.7],[.4,3.9],[2.9,2.7]], room2: [[-3.2,7.6],[-.2,7.6],[-.2,9.45],[-3.2,9.45]], room3: [[-2.4,11.2],[1.08,11.2],[1.08,12.9],[2.6,13.2],[-1.8,13.2]] },
  throwables: [{id:'b1',kind:'beaker',pos:[-3.45,.92,6.75]},{id:'b2',kind:'beaker',pos:[-2.95,.92,6.95]},{id:'p1',kind:'paperweight',pos:[-.65,.92,7.05]},
    {id:'p2',kind:'paperweight',pos:[-.35,.78,12.15]},{id:'p3',kind:'paperweight',pos:[.3,.78,12.35]},{id:'b3',kind:'beaker',pos:[2.1,.78,14.0]},
    {id:'m1',kind:'mug',pos:[1.45,.785,8.3]},{id:'o1',kind:'bottle',pos:[3.15,.78,9.9]},{id:'l1',kind:'ledger',pos:[-.05,.78,12.42],ry:.3},{id:'m2',kind:'mug',pos:[3.2,.78,13.88]},
    {id:'a1',kind:'ashtray',pos:[1.75,1.075,1.25]},{id:'l2',kind:'ledger',pos:[-1.25,.55,-2.5],ry:-.2},{id:'o2',kind:'bottle',pos:[-4.0,1.995,-1.62]}],
  onCrash: (p, kind) => { audio.sfx(THROWN[kind].sound); notify('Crash', 'The guard goes to look.', 2.2); } });
// Lit materials (figures, props, annex furniture) share a warm sky fill and a key light from the window side.
scene.add(new THREE.HemisphereLight('#f4e0bb', '#3b2d20', 2.6));
const keyLight = new THREE.DirectionalLight('#ffe4b8', 1.4);
keyLight.position.set(-3, 6, 4);
scene.add(keyLight);
const canvas = $('world'),
  audio = new GameAudio(),
  keys = new Set(),
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const forward = new THREE.Vector3(),
  delta = new THREE.Vector3(),
  projected = new THREE.Vector3(),
  lightVector = new THREE.Vector3(),
  normal = new THREE.Vector3();
const guardWindow = new THREE.Vector3(4.28, 1.70, .05);
const locations = Object.fromEntries(
  Object.entries(stations).map(([id, v]) => [id, new THREE.Vector3(...v.at)]),
);
const curioAt = Object.fromEntries(Object.entries(curios).map(([id, v]) => [id, new THREE.Vector3(...v.at)]));
const UP = new THREE.Vector3(0, 1, 0);
const storageKey = 'redacted-donor.case.v1';
function getStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function putStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch { /* A private session stays playable. */ }
}
// The final rescue is against the clock: the surgery is at four.
const RESCUE_STAGES = ['glass', 'radio'];
function rescueTimeout(){
  closeModal();state.rescueLeft=comfort?480:240;state.stage='glass';state.score-=50;
  cutscene({at:locations.radio,kicker:'Four o’clock',title:'Too late',line:'The surgery has begun. Go back to the dispatch door and try again.',fx:'neg',shake:true,hold:3,mode:'cut',cue:'hurt',then(){spawnForStage();scoreHUD();updateHud();persist();}});}
// ── Spatial hand tracking (optional). inputMode says which device is driving; the mouse and keyboard keep working in both. ──
const spatial = createSpatial();
spatial.onlost = () => { setSpatial(false); spatialNote('The camera stopped. Hand tracking is off.'); };
const TUTORIAL_KEY = 'redacted-donor.hands.tutorial';
const HAND_HELP = 'Hand tracking is on. Close your hand on something to grab it, open it to let go. Move your hand toward a screen edge to look round; a short dip of the hand looks down. Walk with the keyboard. Press H to turn hand tracking off.';
// guide: the hand setup or hand tutorial now on screen. While one runs, the game underneath is frozen.
let inputMode = 'mouse', guide = null, navFree = false, lookReady = false, spatialHeld = false, handUse = false, domHeld = null, scrollDrag = null, hoverEl = null;
// What the hands ask of move(): turning the view only. Walking stays on the keyboard. Zero unless hand tracking is on and free to steer.
const handNav = { yaw: 0, pitch: 0 };
// How fast the hands turn the view: the player's choice in Pause.
const HAND_SPEEDS = [['Slow', .6], ['Normal', 1], ['Fast', 1.5]];
let handSpeed = HAND_SPEEDS.findIndex(([n]) => n === getStored('redacted-donor.hands.speed')); if (handSpeed < 0) handSpeed = 1;
const stillNav = () => { handNav.yaw = handNav.pitch = 0; };
const hideLimbs = () => { hands.limb(0, null); hands.limb(1, null); };
function setGuide(g) { guide = g; $('game').dataset.guide = g ? (g.cal ? 'cal' : 'tut') : ''; }
const setText = (id, text) => { const el = $(id); if (el.textContent !== text) el.textContent = text; };
async function setSpatial(on) {
  if (setSpatial.busy) return;   // a start is still loading the camera and model: a second press would open a second camera
  const label = (text, pressed) => { for (const b of document.querySelectorAll('.spatial-toggle')) { b.setAttribute('aria-pressed', String(pressed)); b.querySelector('b').textContent = text; } };
  if (!on) { endGuide(); spatial.stop(); inputMode = 'mouse'; label('Off', false); for (const id of ['spatialView', 'handPointer', 'spatialSetup']) $(id).hidden = true; hideLimbs(); handRelease(); stillNav(); if (started) notify('Hand tracking', 'Off. Mouse and keyboard play as before.', 3); return; }
  label('Starting…', false);
  setSpatial.busy = true;
  try { await spatial.start(); } catch (e) { inputMode = 'mouse'; label('Off', false); spatialNote(e.message); return; } finally { setSpatial.busy = false; }
  inputMode = 'spatial'; label('On', true); $('spatialView').hidden = false; $('spatialSetup').hidden = false;
  if (spatial.profile.calibrated) spatialNote(HAND_HELP); else startCalibration();
}
// A message that shows on the title screen as well as in the game.
// Next camera in the list (the built-in one, an iPhone through Continuity Camera, a USB webcam), remembered for next time.
async function nextCamera() {
  const list = await spatial.cameras(), now = spatial.camera;
  if (list.length < 2) { spatialNote(list.length ? 'Only one camera was found: ' + list[0].label + '.' : 'No camera was found.'); return; }
  const next = list[(list.findIndex((c) => c.id === now?.id) + 1) % list.length];
  try { await spatial.useCamera(next.id); spatialNote('Camera: ' + (spatial.camera?.label || next.label) + '. Recalibrate if the view is very different.'); }
  catch { spatialNote('That camera could not be opened. Staying with the last one.'); }
}
function spatialNote(text) { if (started) notify('Hand tracking', text, 5); const el = $('spatialNote'); el.textContent = text; el.hidden = false; clearTimeout(spatialNote.t); spatialNote.t = setTimeout(() => { el.hidden = true; }, 6000); }
const handRay = new THREE.Vector3(), tutDir = new THREE.Vector3(), handAt = { x: 0, y: 0 };
// Let go of whatever the hands were holding (the hand left the picture, or tracking stopped).
function handRelease() {
  if (spatialHeld) { hands.pointer('up', handAt.x, handAt.y, true); spatialHeld = false; }
  if (handUse) heldUse = handUse = false;
  if (aiming?.hand) { stealth.stopAim(); aiming = null; }
  domHeld = scrollDrag = null; hoverEl?.classList.remove('hand-hover'); hoverEl = null;
}
// Anything on the page a grab can press, and the events a press sends it.
const CLICKABLE = 'button, a[href], input, select, textarea, label, summary, [data-action], [role=button]';
const fire = (el, type, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 91, pointerType: 'pen', isPrimary: true, button: 0 }));
function scroller(el) { for (let p = el; p && p !== document.body; p = p.parentElement) if (p.scrollHeight > p.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(p).overflowY)) return p; return null; }
function handStatus(f) {
  const s = spatial.stats, speed = s.rate ? `${s.rate} a second, ${s.cost} ms${s.engine === 'background' ? ', background' : ''}` : '';
  if (s.dark) return 'Too dark to see your hands: add light';
  if (f?.tangled) return 'Hands are touching: move them apart';
  if (!f || !f.hands.length) return ['No hands in view', speed].filter(Boolean).join(' · ');
  const P = f.hands.find((h) => h.role === 'point'), M = f.hands.find((h) => h.role === 'other');
  return [P && 'Hand: ' + (f.two ? 'both grabbing' : P.grab ? 'grabbing' : 'open'), M && 'Other hand: ' + (M.grab ? 'grabbing' : 'open'), f.pointer && `${Math.round(f.pointer.x * 100)}, ${Math.round(f.pointer.y * 100)}`, speed].filter(Boolean).join(' · ');
}
// Runs every frame while hand tracking is on, title screen included. Order matters: two-hand turns, then anything
// on the page (menus, HUD buttons), then an open puzzle, then looking around the room.
// The view leans a little with the hand, like looking round the edge of a window: `lean` follows the pointer (-.5..5).
const lean = { x: 0, y: 0, tx: 0, ty: 0 }, leanBy = new THREE.Vector3();
const NO_HANDS = { n: 0, hands: [], pointer: null, grab: false, down: false, up: false, bang: false, two: null, look: { x: 0, y: 0 } };
function driveSpatial(now) {
  spatial.twoHands = !!inspect || hands.kind === 'read';   // elsewhere a second, curled hand must not block the first
  const f = spatial.update(now);
  lean.tx = f?.pointer && !f.tangled ? f.pointer.x - .5 : 0; lean.ty = f?.pointer && !f.tangled ? f.pointer.y - .5 : 0;
  drawHands($('spatialView').firstElementChild, f, spatial.profile, guide?.cal ? spatial.video : null);   // setup shows what the camera sees
  setText('spatialStatus', handStatus(f));
  if (guide?.cal) calibrate(f || NO_HANDS, now / 1000);   // the setup card shows at once, before the camera's first picture has been read
  pointerInput(f);
}
// A pointer that can grab, press and drag: the tracked hand, or a controller's stick with its A button (drivePad).
// f is a gesture frame ({ pointer, grab, down, up, two, bang, look, hands }) or null when there is no pointer.
function pointerInput(f) {
  const ptr = $('handPointer'), free = navFree;
  stillNav(); navFree = false;
  if (!f || !f.pointer) { ptr.hidden = true; hideLimbs(); handRelease(); return; }
  const b = $('game').getBoundingClientRect(), x = handAt.x = b.left + f.pointer.x * b.width, y = handAt.y = b.top + f.pointer.y * b.height;
  ptr.hidden = false; ptr.style.transform = `translate(${x - b.left}px,${y - b.top}px)`; ptr.classList.toggle('down', f.grab || !!f.two);
  // The player's hands, drawn in the scene where they hold them: over an open puzzle, or in front of them in the room.
  // Menus, cutscenes and setup show the flat pointer only.
  const point = f.hands.find((h) => h.role === 'point'), second = f.hands.find((h) => h.role === 'other');
  if ((modal && modal !== 'hands') || guide?.cal || cine || (!started && !guide?.tut)) hideLimbs();
  else { hands.limb(0, point, x, y); hands.limb(1, second || null, second ? b.left + second.screen.x * b.width : 0, second ? b.top + second.screen.y * b.height : 0); needsDraw = true; }
  // Two grabbing hands turn whatever is being examined, wherever the pointer happens to be.
  if (f.two && (hands.active || inspect)) {
    if (spatialHeld) { hands.pointer('up', x, y, true); spatialHeld = false; }
    if (hands.active) { hands.twist(f.two.dAngle, f.two.dScale); if (guide?.tut && guide.i === 3 && (guide.twist += Math.abs(f.two.dAngle)) > .6) tutPass(); }
    else { inspect.angle -= f.two.dAngle; inspect.tilt = clamp(inspect.tilt + f.two.dTilt + (f.two.dScale - 1) * 1.6, -.85, .85); }
    needsDraw = true; return;
  }
  // Menus, HUD buttons and anything else on the page: a grab is a click, a grab-and-drag scrolls a long page.
  const el = document.elementFromPoint(x, y), any = el?.closest(CLICKABLE), hit = guide?.cal && !any?.closest('#spatialCard') ? null : any, menu = (modal && modal !== 'hands') || (!started && !guide?.tut);
  if (hit !== hoverEl) { hoverEl?.classList.remove('hand-hover'); hoverEl = hit && !hit.disabled ? hit : null; if (hoverEl) { hoverEl.classList.add('hand-hover'); fire(hoverEl, 'pointerover', x, y); } }
  if (domHeld || scrollDrag || hoverEl || menu) {
    if (f.down) { if (hoverEl) { domHeld = hoverEl; fire(domHeld, 'pointerdown', x, y); if (/INPUT|TEXTAREA|SELECT/.test(domHeld.tagName)) domHeld.focus(); } else { const s = el && scroller(el); if (s) scrollDrag = { el: s, y }; } }
    else if (f.up) { if (domHeld) { fire(domHeld, 'pointerup', x, y); if (domHeld.isConnected && !domHeld.disabled) domHeld.click(); } domHeld = scrollDrag = null; }   // the press counts wherever the hand has drifted to: closing the fingers always moves it a little
    else if (scrollDrag) { scrollDrag.el.scrollTop -= y - scrollDrag.y; scrollDrag.y = y; }
    return;
  }
  if (guide?.cal) return;                    // setup only watches
  if (cine) { if (f.down) skipCine(); return; }
  if (!started && !guide?.tut) return;
  // A grab or a release happens where the hand was holding still (f.at), not where closing or opening the fingers left the pointer.
  const where = (q) => (q ? [b.left + q.x * b.width, b.top + q.y * b.height] : [x, y]);
  if (hands.active) {                        // a puzzle is open: closing the hand takes hold, opening it lets go; a fist push strikes glass
    if (f.bang && hands.kind === 'smash') { const cx = b.left + b.width / 2, cy = b.top + b.height / 2; hands.pointer('down', cx, cy, true); hands.pointer('up', cx, cy, true); if (guide?.tut && guide.i === 4) tutPass(); }
    else if (f.down) { hands.pointer('down', ...where(f.at), true); spatialHeld = true; }
    else if (f.up && spatialHeld) { const at = where(f.at); hands.pointer('move', ...at, true); hands.pointer('up', ...at, true); spatialHeld = false; }
    else { if (f.roll && spatialHeld) hands.turn(f.roll * 2); hands.pointer('move', x, y, true); }   // a closed hand turning at the wrist turns what it holds, one for one on the dial face
    return;                                  // no walking or turning away from a puzzle
  }
  spatialHeld = false;
  if (inspect || (!modeActive() && !guide?.tut)) return;
  // Free in the room. The hand turns the head once it passes its comfort zone; the feet stay on the keyboard.
  // A grab holds the view still, so taking hold of something never turns you away from it.
  // After a menu, a puzzle or setup, the hand must come back to rest once before it steers again,
  // so the view never lurches because the hand happened to be out at the edge.
  if (!free) lookReady = false;
  navFree = true;
  if (!f.grab) {
    if (!f.look.x && !f.look.y) lookReady = true;
    if (lookReady) { const k = HAND_SPEEDS[handSpeed][1]; handNav.yaw = -f.look.x * (comfort ? 1.0 : 1.3) * k; handNav.pitch = -f.look.y * .8 * k; }
  }
  if (guide) return;                          // the practice room has nothing to pick up
  if (f.bang && state.stage === 'street' && state.pounds < 3 && inReach('street')) interact('street');   // a fist on the glass
  else if (f.down) { if (stealth.held() && !focus) aiming = { power: 0, hand: true }; else { heldUse = handUse = true; interact(); } }   // grab = E; held grab = held E
  else if (f.up) { if (handUse) heldUse = handUse = false; if (aiming?.hand) { stealth.release(camera, Math.max(aiming.power, clamp((f.flick || 0) / 2.2, 0, 1))); stealth.stopAim();   // a flick of the hand throws as far as a long hold
    aiming = null; audio.sfx('whoosh'); showHeld(null); } }
}
// ── Controller (standard gamepad layout). ──
// Free in the room: left stick walks, right stick looks, and the buttons press the same keys the keyboard does.
// With the title screen, a menu, a cutscene or a puzzle up: the sticks move the on-screen pointer, A presses and drags
// with it (through pointerInput, like a tracked hand), B or Start goes back.
const PAD_KEYS = [[0, 'KeyE'], [1, 'KeyC'], [2, 'KeyJ'], [3, 'KeyB'], [4, 'KeyF'], [5, 'KeyG'], [7, 'KeyG'], [8, 'KeyO'], [9, 'Escape']];
const pad = { f: 0, r: 0, yaw: 0, pitch: 0, run: false, x: .5, y: .5, a: false, back: false, used: false, pointing: false, held: new Set(), last: 0 };
const padKey = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
function drivePad(now) {
  const dt = Math.min(.1, (now - (pad.last || now)) / 1000); pad.last = now;
  const g = [...(navigator.getGamepads?.() || [])].find((q) => q && q.connected);
  pad.f = pad.r = pad.yaw = pad.pitch = 0; pad.run = false;
  const axis = (i) => { const v = g?.axes[i] || 0, m = Math.abs(v); return m < .2 ? 0 : Math.sign(v) * ((m - .2) / .8) ** 1.5; }, on = (i) => !!g?.buttons[i]?.pressed;
  const lx = axis(0), ly = axis(1), rx = axis(2), ry = axis(3);
  if (g && (lx || ly || rx || ry || g.buttons.some((q) => q.pressed))) pad.used = true;
  // The pointer is for anything that is not walking about: it only appears once the controller has been touched.
  const pointing = !!g && pad.used && inputMode !== 'spatial' && (!started || !!modal || hands.active || !!cine || !!guide);
  // Buttons act as keys while roaming; in pointer mode only the ones that go back.
  const want = new Set(PAD_KEYS.filter(([i, code]) => on(i) && (!pointing || code === 'Escape')).map(([, code]) => code));
  if (pointing && on(1)) want.add('Escape');
  if (pad.pointing && !pointing) { for (const code of pad.held) padKey('keyup', code); pad.held = new Set(want); }   // B that closed a menu must not also toggle crouch
  for (const code of want) if (!pad.held.has(code)) padKey('keydown', code);
  for (const code of pad.held) if (!want.has(code)) padKey('keyup', code);
  pad.held = want;
  if (pointing) {
    const dx = lx + rx + (on(15) ? .6 : 0) - (on(14) ? .6 : 0), dy = ly + ry + (on(13) ? .6 : 0) - (on(12) ? .6 : 0), b = $('game').getBoundingClientRect();
    pad.x = clamp(pad.x + dx * dt * .62 * b.height / b.width, 0, 1); pad.y = clamp(pad.y + dy * dt * .62, 0, 1);
    const a = on(0); if (!pad.pointing) pad.a = a;   // A still held from the room does not press the moment a menu or puzzle opens
    pointerInput({ n: 0, hands: [], pointer: { x: pad.x, y: pad.y }, grab: a, down: a && !pad.a, up: !a && pad.a, bang: false, two: null, look: { x: 0, y: 0 } }); pad.a = a;
  } else {
    if (pad.pointing) { pointerInput(null); pad.a = false; }
    if (inspect) { inspect.angle -= rx * dt * 2.4; inspect.tilt = clamp(inspect.tilt + ry * dt * 1.5, -.85, .85); if (rx || ry) needsDraw = true; }
    else { pad.yaw = -rx * (comfort ? 1.6 : 2.4); pad.pitch = -ry * 1.6; }
    pad.f = -ly; pad.r = lx; pad.run = on(6) || on(10);
  }
  pad.pointing = pointing;
}
addEventListener('gamepadconnected', () => notify('Controller connected', 'Left stick walks, right stick looks, A interacts. See Controls for the rest.', 5));
// ── Hand setup (four steps) and hand tutorial (five steps). ──
const canGuide = () => !started || modal === 'pause' || modeActive();
function guideCard(step, title, text, progress, skip) {
  $('spatialCard').hidden = false; setText('spatialStep', step); setText('spatialTitle', title); setText('spatialText', text);
  $('spatialBar').style.width = Math.round(clamp(progress, 0, 1) * 100) + '%'; if ($('spatialSkip').firstChild.textContent !== skip + ' ') $('spatialSkip').firstChild.textContent = skip + ' ';
}
// A step registered: the skeleton view flashes green and the latch sounds.
function passed() { const v = $('spatialView'); v.classList.remove('ok'); void v.offsetWidth; v.classList.add('ok'); audio.cue('latch'); }
function startCalibration() {
  if (inputMode !== 'spatial') return;
  if (!canGuide()) { spatialNote('Hand tracking is on. Open Pause to set up your hands.'); return; }
  endGuide(); if (modal) closeModal(); dropKeys(); release(); handRelease();
  setGuide({ cal: new Calibration(), step: 1 }); $('spatialView').classList.add('big');
}
function calibrate(f, t) {
  const v = guide.cal.feed(f, t);
  guideCard(`Hand setup · ${v.step} of ${v.of}`, v.title, v.text, v.progress, 'Skip setup');
  if (v.done) { spatial.setProfile(v.profile); passed(); finishCalibration(); }
  else if (v.step !== guide.step) { guide.step = v.step; passed(); }
}
function finishCalibration() {
  setGuide(null); $('spatialView').classList.remove('big'); $('spatialCard').hidden = true; needsDraw = true;
  if (getStored(TUTORIAL_KEY) !== 'done') startTutorial();
  else { spatialNote('Hands calibrated and saved on this device.'); if (started && !modal) pause(); }
}
function skipGuide() {
  if (guide?.cal) { spatial.setProfile({ ...spatial.profile, calibrated: true }); finishCalibration(); }   // standard settings, and no asking again
  else endTutorial(false);
}
const TUT = [
  ['Look around', 'Move your hand toward an edge of the screen to turn your head, and bring it back to the middle to stop. Find the amber light and look at it. Walking stays on the keyboard.'],
  ['Grab and drag', 'Put your hand over the brass handle and close it, as if taking hold. Keep it closed and pull the drawer toward you. Opening your hand lets go.'],
  ['Precision turn', 'Take hold of the first brass wheel and move your hand slowly upward until it shows 3.'],
  ['Two-hand inspect', 'Close both hands, then turn them like a steering wheel to rotate the page.'],
  ['Fist push', 'Make a fist and push it at the camera to strike the glass.'],
];
const TUT_RIGS = [null, ['drawer', { label: 'Practice drawer', contents: { title: 'Well done', lines: ['Opening your hand lets go.'] } }], ['tumbler', { code: '300', label: 'Set the first wheel to 3' }], ['read', { name: 'Practice sheet', title: 'Turn this page', body: 'Close both hands and turn them like a steering wheel.' }], ['smash', {}]];
// The tutorial borrows the office as a practice room: the game's own state, save and clock are not touched.
function startTutorial() {
  if (inputMode !== 'spatial' || !renderer) return;
  if (!canGuide() || inspect) { spatialNote('Finish what you are doing, then open Pause for the hand tutorial.'); return; }
  endGuide(); if (modal) closeModal(); dropKeys(); release(); handRelease();
  setGuide({ tut: true, i: 0, hold: 0, twist: 0, wait: 0, marks: [], saved: { pos: camera.position.clone(), yaw, pitch, crouched, title: $('title').hidden, hud: $('hud').hidden } });
  crouched = false; $('title').hidden = true; $('hud').hidden = true;
  tutStep(0);
}
function tutMark(x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: .9, depthTest: false }));
  m.position.set(x, y, z); m.renderOrder = 998; scene.add(m); guide.marks.push(m); return m;
}
function tutClear() { for (const m of guide.marks) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } guide.marks = []; }
function tutStep(i) {
  const g = guide; Object.assign(g, { i, hold: 0, twist: 0, wait: 0 }); hands.close(); tutClear();
  pose(1.30, 3.70, locations.desk);
  if (!i) { g.target = new THREE.Vector3(camera.position.x - Math.sin(yaw + 1.3) * 2.2, 2.05, camera.position.z - Math.cos(yaw + 1.3) * 2.2); tutMark(g.target.x, g.target.y, g.target.z).scale.setScalar(1.6); return; }   // a light off to one side to look at
  // Steps 2 to 5 use the game's own 3D puzzle parts, hung in the air in front of the player.
  const [kind, opts] = TUT_RIGS[i], at = camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize()); at.y = 1.2;
  const p = hands.pose(kind, at, camera.position);
  pose(p.cam.x, p.cam.z, p.look, p.cam.y);
  hands.open(kind, opts, p, { done: () => { if (guide === g && g.i === i && i < 3) tutPass(); } });
}
function tutPass() { const g = guide; if (!g?.tut || g.wait) return; passed(); g.wait = 1.1; }
function tutorialFrame(dt) {
  const g = guide; time += dt;
  if (hands.active) hands.update(dt); else move(Math.min(dt, .09));
  let progress = g.wait ? 1 : 0;
  if (g.i === 0 && !g.wait) {
    const aim = camera.getWorldDirection(handRay).dot(tutDir.copy(g.target).sub(camera.position).normalize()); g.hold = aim > .97 ? g.hold + dt : 0; progress = (aim - .5) / .47; if (g.hold > .35) tutPass();
  } else if (g.i === 3 && !g.wait) progress = g.twist / .6;
  for (const m of g.marks) m.material.opacity = .65 + .3 * Math.sin(time * 5);
  if (g.wait && (g.wait -= dt) <= 0) { if (g.i < 4) tutStep(g.i + 1); else { endTutorial(true); return; } }
  guideCard(`Hand tutorial · ${g.i + 1} of 5`, TUT[g.i][0], TUT[g.i][1], progress, 'Skip tutorial');
  renderer.setFx(0, 0, 0); renderer.setDetective(0); renderer.render(time, 0, 1, .7, 0, 0, 0);
}
function endTutorial(done) {
  const g = guide; if (!g?.tut) return;
  hands.close(); tutClear(); setGuide(null); $('spatialCard').hidden = true; putStored(TUTORIAL_KEY, 'done'); handRelease(); stillNav();
  camera.position.copy(g.saved.pos); yaw = g.saved.yaw; pitch = g.saved.pitch; crouched = g.saved.crouched; camera.rotation.set(pitch, yaw, 0, 'YXZ'); camera.updateMatrixWorld();
  $('title').hidden = g.saved.title; $('hud').hidden = g.saved.hud; needsDraw = true;
  spatialNote(done ? 'Tutorial complete. Your hands grab and look; the keyboard walks.' : 'Tutorial skipped. You can replay it from the Pause menu.');
  if (started && !modal) pause();
}
function endGuide() { if (guide?.tut) endTutorial(false); else if (guide) { setGuide(null); $('spatialView').classList.remove('big'); $('spatialCard').hidden = true; } }
const DETECTIVE_STAGES = ['detective', 'lock', 'recoverKey', 'closet', 'verify', 'board', 'gate', 'glass', 'radio'];
let detectiveBlend = 0, leaveT = -1, state = fresh(),
  stored = readRun(getStored(storageKey)),
  started = false,
  modal = '',
  inspect = null,
  renderer;
let yaw = 0,
  pitch = 0,
  crouched = false,
  moving = false,
  walkTime = 0, bobAmount = 0,
  footTime = 0,
  lookDrag = null,
  heldUse = false,
  stickX = 0,
  stickY = 0;
let focus = null,
  shownTargets = [],
  time = 0,
  previous = 0,
  captionTime = 0,
  chapterTime = 0,
  hitTime = 0,
  invulnerable = 0,
  guardMeter = 0,
  patrol = patrolAt(0,0),
  guardBeat = -1;
let memoryBlend = 0, streetDelay = 0, exposure = 0, stripShot = false;
let lockDigits = [0, 0, 0],
  lockCursor = 0,
  selectedPin = null,
  dossierTab = 0,
  modalMessage = '',
  saveTimer = 0,
  pausedOrigin = '';
let cine=null, shakeTime=0, arrowShown=false, doorGrace=0, aiming=null, jamTime=0, jamCool=0, heartbeatAt=0, tenseT=0, pulse=0;
const JAM_COOLDOWN=45; // seconds before the watch overdrive can jam the guards again
// Veteran Investigator Mode: larger text, a loupe, click alternatives to drags, a guard grace window. Off by default.
let comfort=false;
function setComfort(on){comfort=!!on;putStored('redacted-donor.comfort',comfort?'on':'off');document.getElementById('game').dataset.comfort=comfort?'on':'off';setEase(comfort?3:1);
  for(const b of document.querySelectorAll('.veteran-toggle')){b.setAttribute('aria-pressed',String(comfort));b.querySelector('b').textContent=comfort?'On':'Off';}renderer?.setLift?.(comfort?1:0);}
let work=null, workDrag=null, journalOrigin='', tracked='', alertState='', lastClock='';
const nativeMouse = window.webkit?.messageHandlers?.gameMouse;
const htmlButton = (action, title, cls = 'plain-btn', attrs = '') =>
  `<button class="${cls}" data-action="${action}" ${attrs}>${title}</button>`;
const message = () => `<p class="message" role="status">${modalMessage}</p>`;
const caseNo = () => String(state.caseIndex + 1).padStart(2, '0');
const character = () => ['contract', 'street', 'memory'].includes(state.stage) ? 'Mateo' : 'Detective';
const modeActive = () => started && !modal && !document.hidden && !cine && !guide;
function persist(now = false) {
  if (!started) return;
  const base = cine?.start || parked?.start || camera.position, by = cine ? cine.yaw : parked ? parked.yaw : yaw, bp = cine ? cine.pitch : parked ? parked.pitch : pitch;
  const snapshot = { ...state, position: [base.x, base.z, by, bp], crouched };
  if (inspect) snapshot.position = inspect.origin.slice(0, 4);
  delete snapshot.dt;
  delete snapshot.reaction;
  snapshot.savedAt = Date.now();
  putStored(storageKey, JSON.stringify(snapshot));
  stored = readRun(JSON.stringify(snapshot));
  cloud.pushSave(snapshot, now);
}
function dropKeys() {
  keys.clear();
  heldUse = false;
  moving = false;
  lookDrag = null;
  stickX = stickY = 0;
  $('stick').firstElementChild.style.transform = '';
}
function release() {
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  nativeMouse?.postMessage('release');
}
function capture() {
  if (!modeActive() || inspect || matchMedia('(pointer:coarse)').matches) return;
  if (nativeMouse) {
    nativeMouse.postMessage('capture');
    return;
  }
  if (document.pointerLockElement !== canvas) {
    try {
      canvas.requestPointerLock?.()?.catch?.(() => {});
    } catch { /* Drag and keyboard look stay active. */ }
  }
}
function pose(x, z, point, height = 1.65) {
  camera.position.set(x, height, z);
  camera.lookAt(point.isVector3 ? point : new THREE.Vector3(...point));
  yaw = camera.rotation.y;
  pitch = camera.rotation.x;
  camera.rotation.z = 0;
  camera.updateMatrixWorld();
}
// Voice lines. Whatever text the game shows (a caption, a cutscene line, a remark in a puzzle) is matched against the
// recorded lines by a distinctive phrase, so the voice always says what the subtitle shows. Ids are in VOICELINES.md.
const VOICE = [['only way out is the window', 'mateo-05'], ['six inches of tinted glass', 'mateo-06'], ['let them find the time', 'mateo-07'], ['people stop and look in', 'mateo-08'],
  ['now hide it', 'mateo-09'], ['proof they took', 'mateo-10'], ['street only sees its reflection', 'mateo-11'], ['out of reach of a broom', 'mateo-12'], ['a number worth keeping', 'mateo-13'],
  ['wedged in the printer frame', 'mateo-14'], ['i do not consent', 'mateo-15'], ['the hours slip by', 'mateo-16'], ['not the first', 'mateo-18'],
  ['read what mateo left behind', 'det-01'], ['a nib scratch', 'det-02'], ['a sedative stain', 'det-03'], ['a ribbon impression', 'det-04'], ['fits the copying board', 'det-05'], ['same agency stamp', 'det-06'],
  ['same account buys kidneys', 'det-07'], ['pressed into the pad', 'det-08'], ['same file number as the receipt', 'det-09'], ['ties the job offer to the passport', 'det-10'], ['still looped round', 'det-11'],
  ['out at 00 40', 'det-12'], ['pier 9 cold storage', 'det-13'], ['closet key under the radiator', 'det-14'], ['right where mateo hid it', 'det-15'], ['a courier manifest', 'det-16'],
  ['matches the pier 9 gate ticket', 'det-17'], ['640 khz harbour service', 'det-18'], ['st jude maritime suite b', 'det-19'], ['wired to the recruitment terminal', 'det-20'], ['the records are safe', 'det-21'],
  ['still marked for surgery', 'det-22'], ['the dispatch key now the ham radio', 'det-23'], ['advocate confirms suite b', 'det-24'], ['reopened at the desk', 'det-25'], ['there it is', 'det-26'],
  ['take the key', 'det-27'], ["it's open", 'det-28'], ["we're moving", 'dispatch-01'], ["suite b four o'clock", 'advocate-01'], ['we have him', 'dispatch-02']];
let spoke = '', spokeAt = -9;
function speak(text) {
  const t = String(text).toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' '), hit = VOICE.find(([k]) => t.includes(k));
  if (!hit || (hit[1] === spoke && time - spokeAt < 8)) return;   // the same line shown twice in a row (a remark, then its cutscene) is said once
  spoke = hit[1]; spokeAt = time; audio.say(hit[1]);
}
function notify(speaker, text, duration = 5.2) {
  speak(text);
  if (comfort) duration *= 1.7;
  $('caption').firstElementChild.textContent = speaker;
  $('caption').lastElementChild.textContent = text;
  $('caption').hidden = false;
  restartAnim($('caption'));
  captionTime = duration;
  $('sr').textContent = speaker + '. ' + text;
}
function chapter(kicker, title) {
  const el = $('chapterCard');
  el.querySelector('small').textContent = kicker;
  el.querySelector('strong').textContent = title;
  el.hidden = true;
  void el.offsetWidth;
  el.hidden = false;
  chapterTime = reduced ? .85 : 2.3;
}
function flash(kind) {
  $('flash').className = kind;
  hitTime = kind === 'hit' ? .32 : .14;
}
let shownScore = null;
function scoreHUD() {
  if (shownScore !== null && state.score > shownScore) audio.sfx('points');
  shownScore = state.score;
  const val = (state.score < 0 ? '−' : '') + Math.abs(state.score).toLocaleString('en-US');
  if ($('counter').dataset.value !== val) {
    $('counter').dataset.value = val;
    $('counter').textContent = val;
    $('counter').setAttribute('aria-label', state.score + ' points');
  }
  const bulbs = Math.ceil(state.hp / 34);
  [...$('bulbs').children].forEach((b, i) => b.classList.toggle('off', i >= bulbs));
  $('bulbs').setAttribute('aria-label', `${bulbs} of 3 composure bulbs left`);
  $('vignette').classList.toggle('low', started && state.hp <= 32);
}
function mainTarget(){const ids=stageTargets(state);return ids.includes(tracked)?tracked:ids[0];}
// Standard game: the objective is the case's question, not the next step. Veteran mode names the step.
function mission(){const id=mainTarget();if(state.stage==='memory'&&id==='rest'&&state.benchWatched)return `Wait for ${isNight(state.solarTime)?'daylight':'nightfall'}. The bench is watched now.`;return state.stage==='memory'&&id&&id!=='rest'?(comfort?verbs[id]:cases[state.caseIndex].question):objective(state);}
function placeName(id){return leads[id]?.place||stationsGuide[id]||'';}
function worldTime(){if(state.stage==='memory')return state.solarTime;if(state.stage==='contract'||state.stage==='street')return 42;if(state.stage==='strip'||state.stage==='end')return 2+state.strip*5;return 87.6+state.caseIndex*1.35;}
function updateClock(){const t=worldTime(),night=isNight(t),face=clockFace(t),phase=skyName(t);$('game').dataset.mode=night?'night':'day';$('game').dataset.sky=phase.toLowerCase();
  const rescue=RESCUE_STAGES.includes(state.stage)&&state.rescueLeft>0,left=Math.ceil(state.rescueLeft||0);const remaining=Math.ceil(untilShift(t)),key=[face,phase,state.stage,remaining,rescue?left:''].join('/');if(key===lastClock)return;lastClock=key;
  $('timepiece').classList.toggle('night',night);$('timeGlyph').textContent=night?'☾':'☀';$('phaseName').textContent=phase;$('clock').textContent=face;{const arc=document.getElementById('shiftArc');if(arc)arc.style.strokeDashoffset=String(state.stage==='memory'?Math.round(untilShift(t)/SHIFT_LENGTH*100):100);}$('nextShift').textContent=state.stage==='memory'?`${night?'Daybreak':'Nightfall'} in ${remaining} s`:rescue?`Surgery in ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`:'Clinic time';$('timepiece').classList.toggle('urgent',rescue&&left<=60);
  $('hand').setAttribute('transform',`rotate(${(t/DAY_LENGTH*360+90)%360} 28 28)`);
}
function updateHud() {
  refreshBarriers();$('game').dataset.stage=started?state.stage:'title';$('game').dataset.file=String(state.caseIndex+1);
  $('hud').hidden=!started||!!inspect||['end','gameOver'].includes(state.stage);
  const mateo=character()==='Mateo';$('game').dataset.role=mateo?'mateo':'detective';$('whoName').textContent=mateo?'Mateo':'The detective';$('role').textContent=mateo?(state.stage==='memory'?'Memory, the night before':'Locked in the clinic'):(state.stage==='strip'?'Dawn':'Present day');{const m=mission();if($('objective').textContent!==m){$('objective').textContent=m;if(started)restartAnim(document.querySelector('.objective'));}}
  $('chapter').textContent=state.stage==='contract'?'Prologue: the intake office':state.stage==='street'?'Prologue: the blind street':state.stage==='strip'?'Epilogue: breaking the glass':`Case ${state.caseIndex+1}: ${cases[state.caseIndex].name}`;
  const id=mainTarget();$('place').textContent=placeName(id);$('leadCount').textContent=state.stage==='memory'?`${state.found.length} of ${cases[state.caseIndex].tasks.length}`:'';
  $('hudKit').hidden=!state.hasWatch;$('hudJournal').hidden=state.stage==='contract';$('timepiece').hidden=!state.hasWatch;updateClock();
  scoreHUD();
  const targets = stageTargets(state);
  if (targets.join(',') !== shownTargets.join(',')) {
    shownTargets = targets;
    $('markerLayer').replaceChildren();
    for (const id of targets) {
      const m = document.createElement('div');
      m.className = 'world-mark';
      m.dataset.station = id;
      m.innerHTML = '<i></i><span></span>';
      m.querySelector('span').textContent = id === 'desk'
        ? cases[state.caseIndex].document
        : stations[id].name;
      $('markerLayer').appendChild(m);
    }
  }
  audio.setMemory(state.stage === 'memory');
  if(state.stage!=='memory')clearAlert();
}
function updateSoundButton() {
  const b = $('titleSound');
  b.lastElementChild.textContent = audio.muted ? 'Sound off' : 'Sound on';
  b.firstElementChild.classList.toggle('muted', audio.muted);
  b.setAttribute('aria-pressed', String(!audio.muted));
}
audio.setMuted(getStored('redacted-donor.muted') === 'true');
setComfort(getStored('redacted-donor.comfort') === 'on');
$('comfortToggle').onclick = () => setComfort(!comfort);
$('veteranHud').onclick = () => { setComfort(!comfort); updateHud(); };
updateSoundButton();
function toggleSound() {
  audio.setMuted(!audio.muted);
  putStored('redacted-donor.muted', String(audio.muted));
  updateSoundButton();
  if (!audio.muted) audio.gesture();
}
function closeModal() {
  closeTactile();
  unpark();
  modal = '';
  work=null;workDrag=null;
  modalMessage = '';
  $('overlay').hidden = true;
  $('overlay').className = '';
  $('game').dataset.modal = '';
  dropKeys();
  if (started) canvas.focus({ preventScroll: true });
}
function panel(name, kicker, title, body, { wide = false, close = true, talk = false } = {}) {
  if (modal !== name) {
    release();
    dropKeys();
  }
  const fresh = $('overlay').dataset.screen !== name || $('overlay').hidden;
  modal = name;
  $('pointer').hidden = true; arrowShown = false;
  $('game').dataset.modal = name;
  $('overlay').hidden = false; needsDraw=true;
  $('overlay').className = talk ? 'talking' : '';
  $('overlay').dataset.screen=name;
  $('panel').className = talk ? 'dialogue' : wide ? 'wide' : '';
  $('panelBody').innerHTML = (close ? htmlButton('back', '×', 'panel-close', 'aria-label="Close"') : '') +
    (kicker?`<div class="sheet-kicker">${kicker}</div>`:'')+`<h2 id="panelTitle">${title}</h2>` + body;
  if (fresh) restartAnim($('panel'));
  if (!matchMedia('(pointer:coarse)').matches) {
    $('panel').querySelector('button:not(.panel-close):not(:disabled)')?.focus({ preventScroll: true });
  }
}
// One table, one row per action, so the keyboard and the controller line up side by side.
function controls() {
  const rows = [
    ['Walk', 'W A S D', 'Left stick'],
    ['Look', 'Mouse / arrow keys', 'Right stick'],
    ['Crouch / stand', 'C', 'B'],
    ['Interact / hold', 'E', 'A'],
    ['Run', 'Shift', 'LT / click left stick'],
    ['Throw (hold to aim)', 'G', 'RT / RB'],
    ['Lab coat kit', 'B / Tab', 'Y'],
    ['Field journal', 'J', 'X'],
    ['Watch overdrive', 'O', 'Back / View'],
    ['Pause', 'Esc', 'Start / Menu'],
    ['Hand tracking on / off', 'H, anywhere', 'Pause menu'],
    ['Turn over document', 'F', 'LB'],
    ['Menus and puzzles: pointer', 'Mouse', 'Sticks / D-pad'],
    ['Menus and puzzles: press and drag', 'Click', 'A'],
    ['Menus and puzzles: back', 'Esc', 'B'],
  ];
  panel(
    'controls',
    '',
    'Controls',
    `<div class="control-table"><div class="control-head"><span>Action</span><span>Keyboard and mouse</span><span>Controller</span></div>${
      rows.map(([n, k, c]) => `<div><span>${n}</span><span><kbd>${k}</kbd></span><span><kbd>${c}</kbd></span></div>`).join('')
    }</div><div class="panel-actions">${
      htmlButton('back', 'Back', 'gold-btn')
    }</div>`,
  );
}
const unsearched=()=>Object.entries(curios).filter(([id])=>!state.awards.includes('curio:'+id)).map(([,c])=>[c.at[0],c.at[2]]);
function mapDrawing(){return floorplan(camera.position.x,camera.position.z,yaw,comfort?mainTarget():null,state.hasWatch?unsearched():[],{lab:doorOpen('lab'),dispatch:doorOpen('dispatch')});}
function pause(){if(!started||modal||cine||guide||['end','gameOver'].includes(state.stage))return;persist();
  const id=mainTarget();panel('pause','','Paused',`<div class="folio-grid"><div><div class="folio-file">Case ${state.caseIndex+1}: ${cases[state.caseIndex].name}</div><h3>${character()}’s next move</h3><p class="big-note">${inspect?'Rotate the exhibit into the lamplight.':mission()}</p><p class="location-note">${comfort?placeName(id):''}</p><div class="pause-tools">${htmlButton('back','Resume game','gold-btn')}${htmlButton('pause-journal','Open field journal','plain-btn')}${htmlButton('controls','Controls','plain-btn')}${htmlButton('sound',audio.muted?'Sound off':'Sound on','plain-btn')}${htmlButton('comfort',comfort?'Veteran Investigator Mode: on':'Veteran Investigator Mode: off','plain-btn')}${htmlButton('hand-toggle',inputMode==='spatial'?'Hand tracking: on':'Hand tracking: off','plain-btn')}${inputMode==='spatial'?htmlButton('hand-speed','Hand look speed: '+HAND_SPEEDS[handSpeed][0].toLowerCase(),'plain-btn')+htmlButton('hand-camera','Camera: '+esc(spatial.camera?.label||'default'),'plain-btn')+htmlButton('hand-engine','Hand engine: '+(spatial.engine==='main'?'classic':'smooth'),'plain-btn')+htmlButton('hand-setup','Recalibrate hands','plain-btn')+(inspect?'':htmlButton('hand-tutorial','Hand tutorial','plain-btn')):''}${htmlButton('auto-codes',autoCodes?'Auto-save codes to journal: on':'Auto-save codes to journal: off','plain-btn')}${htmlButton('cloud-sync',cloud.syncOn()?'Cloud save: on':'Cloud save: off','plain-btn')}${cloud.syncOn()&&cloud.code()?`<p class="transfer-code"><small>Transfer code</small><b>${esc(cloud.code())}</b></p>`:''}${htmlButton('title','Save and quit to title','text-btn')}</div></div>${mapDrawing()}</div>`,{wide:true,close:false});}
// pause() refuses to open over another menu, so a switch inside Pause clears the flag to redraw it.
function repause(action){modal='';pause();$('panelBody').querySelector(`[data-action="${action}"]`)?.focus({preventScroll:true});}
function journal(){if(!started||inspect)return;const file=cases[state.caseIndex],active=stageTargets(state),id=mainTarget();
  const records=state.exhibits.map(i=>`<div class="log-row"><b>${evidence[i][0]}</b><small>${evidence[i][1]}</small></div>`).join('');
  const list=file.tasks.map((key,i)=>{const done=state.found.includes(key),available=active.includes(key),l=leads[key];return `<li class="journal-step ${done?'done':available?'ready':''}"><span>${done?'✓':available?'●':'○'}</span><div><b>${l.action}</b><small>${done?discoveries[key][0]:l.place}</small>${done||l.shift==='any'?'':`<em class="shift-${l.shift}">${l.shift==='day'?'Day':'Night'}</em>`}</div>${available&&comfort?htmlButton('track',key===id?'Tracked':'Track','tab',`data-lead="${key}"`):''}</li>`;}).join('');
  const unlocked=[...new Set(state.links.flatMap(i=>cases[i].actions))];
  panel('journal','','Field journal',`<div class="folio-grid"><div><div class="folio-file">${state.hasWatch?`Case ${state.caseIndex+1}: ${file.name}`:'The blind street'}</div><h3>${state.hasWatch?file.question:'Can anyone outside hear Mateo?'}</h3><div class="next-note"><small>${comfort?'Next':'The question'}</small><b>${mission()}</b><span>${comfort?placeName(id):'Your leads are listed below. Find them yourself.'}</span></div>${(state.codes||[]).length?`<details class="journal-details codes" open><summary>Codes and numbers (${state.codes.length})</summary><div class="log-list">${state.codes.map(k=>`<div class="log-row code-row"><b>${CODES[k][1]}</b><small>${CODES[k][0]}</small></div>`).join('')}</div></details>`:''}${state.hasWatch?`<details class="journal-details" ${state.stage==='memory'?'open':''}><summary>Mateo’s leads (${state.found.length} of ${file.tasks.length})</summary><ol class="journal-steps">${list}</ol></details>`:''}${searchedList()}${records?`<details class="journal-details"><summary>Evidence (${state.exhibits.length} of ${evidence.length})</summary><div class="log-list">${records}</div></details>`:''}</div>${mapDrawing()}</div>${unlocked.length?`<div class="tabs">${unlocked.map(i=>htmlButton('action-card',actions[i].title,'tab',`data-id="${i}"`)).join('')}</div>`:''}<div class="panel-actions">${htmlButton('back',journalOrigin==='pause'?'Back to pause':'Back to the room','gold-btn')}</div>`,{wide:true});}
function searchedList(){const ids=Object.keys(curios),seen=ids.filter(id=>state.awards.includes('curio:'+id));
  return `<details class="journal-details"><summary>Searched (${seen.length} of ${ids.length})</summary><div class="log-list">${ids.map(id=>seen.includes(id)?`<div class="log-row"><b>${curios[id].title}</b><small>${curios[id].journal||curios[id].name}</small></div>`:`<div class="log-row unsearched"><b>${curios[id].name}</b><small>Not searched yet. Marked with a dot on the map.</small></div>`).join('')}</div></details>`;}
function kit() {
  if (!started || !state.hasWatch || inspect) return;
  panel(
    'kit',
    '',
    'Lab coat kit',
    `<p>You have <b>${state.score.toLocaleString('en-US')}</b> points to spend.</p><div class="supply-grid">${
      supplies.map((it) =>
        htmlButton(
          'buy',
          `<strong>${it.name}</strong><b>${
            it.id === 'soles' && state.soles ? 'Fitted' : it.cost + ' points'
          }</b><small>${it.description}</small>`,
          'supply',
          `data-id="${it.id}" ${canBuy(state, it.id) ? '' : 'disabled'}`,
        )
      ).join('')
    }</div>${message()}<div class="panel-actions">${
      htmlButton('back', 'Return to room', 'gold-btn')
    }</div>`,
  );
}
function contract() {
  const choice = (id, text, n) => htmlButton(id, `${text}<kbd>${n}</kbd>`, 'choice');
  let body = '';
  if (state.beat === 0) {
    body =
      '<p class="setup">A month ago Mateo answered an ad from Aegis Global Pathways: a lab-technician job overseas, three times his pay at home, flights and housing covered. Aegis kept his passport “for safekeeping” and sent him for a “routine medical”: a blood test and tissue typing. Tonight they called him in to sign the final papers.</p>' +
      '<p>“Your overseas lab placement was canceled, Mateo. Which leaves the $14,500 processing and medical screening bond you owe Aegis.”</p><div class="choices">' +
      choice('demand', 'Demand your passport', 1) + choice('work', 'Offer to work it off', 2) + '</div>';
  } else if (state.beat === 1) {
    body = `<p>${
      state.confiscated
        ? 'He locks your passport in the desk drawer. “Walk out with what papers?” He pushes a medical affidavit across the blotter.'
        : 'He slides a medical affidavit across the blotter. “One voluntary kidney donation clears your debt tonight.”'
    }</p><div class="choices">${choice('refuse', 'Push the paper away', 1)}${
      choice('nib', 'Sign and snap the fountain-pen nib', 2)
    }</div>`;
  } else {body = `<p>${
      state.coercion === 'refused'
        ? 'The guard takes your wrist. Your thumb leaves a print on the affidavit as the recruiter drags the nib across the blotter.'
        : 'The nib breaks under your hand. It cuts a groove through the paper into the desk blotter. A mark someone might find.'
    } The two men leave. The lock clicks.</p><div class="panel-actions">${
      htmlButton('stand', 'Get to your feet', 'gold-btn')
    }</div>`;}
  panel('contract', 'Intake office', 'The rigged contract', body, { talk: true, close: false });
  // Spoken in order: Mateo's answer to the last choice, then the recruiter and the narrator.
  if (state.beat === 0) audio.say('recruiter-01');
  else if (state.beat === 1) state.confiscated ? audio.say('mateo-01', 'recruiter-02', 'narr-01') : audio.say('mateo-02', 'narr-02', 'recruiter-03');
  else state.coercion === 'refused' ? audio.say('mateo-03', 'narr-03', 'narr-05') : audio.say('mateo-04', 'narr-04', 'narr-05');
}
function spawnForStage() {
  crouched = false;
  guardMeter=0;clearAlert();
  invulnerable = 1.5;
  switch (state.stage) {
    case 'contract':
      pose(.18, 2.36, [.03, 1.57, -.88], 1.46);
      break;
    case 'street':
      pose(-.23, 2.40, locations.street);
      break;
    case 'detective':
    case 'lock':
    case 'recoverKey':
    case 'board':
    case 'verify':
      pose(.25, 2.88, locations.desk);
      break;
    case 'memory':
      if (state.caseIndex === 0) pose(-2.77, 1.52, locations.dispatch);
      else if (state.caseIndex === 1) pose(-2.73, 2.78, locations.prints);
      else pose(-.6, 12.9, locations.ribbon);
      break;
    case 'radio':
    case 'glass':
      pose(-3.0, 11.0, locations.glassCase);
      break;
    case 'gate':
      if (state.gateStep === 'shredder') pose(-2.1, 8.0, locations.shredder);
      else pose(-.4, 4.4, locations.terminal);
      break;
    case 'strip':
      pose(-2.45, 3.30, locations.street);
      break;
    default:
      pose(1.30, 3.70, locations.desk);
  }
}
function enterGame(resume) {
  if (!renderer) return;
  audio.gesture();
  audio.warmClip('daynight');
  audio.warmRecorded();
  cine = null; parked = null; $('fade').classList.remove('dark');
  state = resume && stored ? readRun(JSON.stringify(stored)) : fresh();
  calmGuards();
  shownScore = null; // a loaded score is not a gain
  started = true;
  closeModal();
  $('title').hidden = true;
  props.setCase(state.caseIndex);
  spawnForStage();
  if (
    resume && state.position?.length === 4 && state.position.every(Number.isFinite) &&
    state.stage !== 'contract'
  ) {
    const [x, z, y, p] = state.position;
    camera.position.set(x, state.crouched ? .88 : 1.65, z);
    yaw = y;
    pitch = p;
    crouched = !!state.crouched;
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    camera.updateMatrixWorld();
  }
  state.reaction = 0;
  tracked='';journalOrigin='';guardBeat=-1;patrol=patrolAt(state.guardTime,state.caseIndex);work=null;clearAlert();
  memoryBlend = state.stage === 'memory' ? 1 : 0;
  stripShot = false;
  focus = null;
  captionTime = 0;
  $('caption').hidden = true;
  updateHud();
  if (state.stage === 'contract') { if (state.beat === 0 && !state.quiz) quizPage('pre'); else contract(); }
  else if (state.stage === 'end') ending();
  else if(state.stage==='gameOver')gameOver();
  else {
    capture();
  }
  persist();
}
function title() {
  audio.jazz(false);audio.tension(false);
  if(inspect)leaveInspection();
  if(cine)endCine();
  persist(true);
  parked=null;
  started = false;
  closeModal();
  release();
  $('title').hidden = false;
  $('hud').hidden = true;
  $('chapterCard').hidden = true;
  $('inspectHud').hidden = true;
  $('caption').hidden = true;
  audio.setMemory(false);
  $('beginText').textContent = stored?.stage === 'end'
    ? 'Review the rescue'
    : stored
    ? 'Continue the investigation'
    : 'Begin the investigation';
  $('newGame').hidden = !stored;
  accountLabel();
  $('game').dataset.stage = 'title';
  $('begin').focus();
}
function beginMemory(){const eye=camera.position.clone();leaveInspection(false);const doc=props.casePaper.position.clone();state.stage='memory';state.solarTime=[12,51,54][state.caseIndex];state.guardTime=0;state.powder=0;tracked='';patrol=patrolAt(0,state.caseIndex);guardBeat=-1;persist();
  cutscene({at:doc,from:eye,push:.42,kicker:cases[state.caseIndex].document,title:'The mark remembers',line:cases[state.caseIndex].mark,fx:'neg',hold:2,mode:'ink',cue:'shift',then(){spawnForStage();chapter('Mateo / '+cases[state.caseIndex].time,cases[state.caseIndex].name);updateHud();persist();briefing();}});}
// A plain-language card before each reconstruction: the question, the rules and the leads in order.
function briefing(){const file=cases[state.caseIndex],glyph={day:'Day',night:'Night',any:'Any time'};
  const steps=file.tasks.map((k,i)=>`<li><span>${String(i+1).padStart(2,'0')}</span><b>${leads[k].action}</b><em class="shift-${leads[k].shift}">${glyph[leads[k].shift]}</em></li>`).join('');
  panel('briefing',`Case ${state.caseIndex+1}`,file.name,`<p class="brief-question">${file.question}</p>${state.caseIndex?'':`<div class="brief-keys"><span><i>◆</i>${comfort?'Follow the diamond':'Leads are in your journal (J)'}</span><span><i>☾</i>Some leads need night</span><span><i>C</i>Hide from the guard</span><span><i>J</i>Map</span></div>`}<div class="brief-rules" hidden><div><i>◆</i><b>Follow the gold diamond</b><small>It marks the next lead. When it’s off screen, an arrow on the edge points the way.</small></div><div><i>☾</i><b>Day and night show different things</b><small>The clock turns every ${SHIFT_LENGTH}s. If the next lead needs the other shift, wait on the staff bench.</small></div><div><i>C</i><b>Hide from the guard</b><small>Footsteps and the eye banner mean he is coming. Crouch with C, or get behind furniture, before the red stare fills.</small></div><div><i>J</i><b>Open the journal (J)</b><small>It has a map, your next step and every lead in this case.</small></div></div><h3 class="brief-head">Leads</h3><ol class="brief-steps">${steps}</ol><div class="panel-actions">${htmlButton('back','Begin the reconstruction','gold-btn')}</div>`,{wide:true,close:false});}
const losses={guard:{reason:'A guard saw you.',tip:'When you hear footsteps, crouch or get behind something.'},lock:{reason:'The drawer jammed on the wrong number.',tip:'The number is in your journal.'},board:{reason:'The evidence trail broke at the corkboard.',tip:'Pick this case on the left, then its lead on the right.'}};
// Online records: a run report on every win or loss; the leaderboard needs a name once.
const runRow=(outcome)=>({p_outcome:outcome,p_case:Math.min(3,state.caseIndex),p_cause:outcome==='caught'?String(state.loss?.cause||''):'',p_score:state.score,p_caught:state.stats?.caught||0,p_spent:state.stats?.spent||0,p_items:state.stats?.items||[],p_seconds:Math.round(state.stats?.seconds||0),p_veteran:comfort});
const esc=(t)=>String(t).replace(/[&<>"']/g,(c)=>`&#${c.charCodeAt(0)};`);
const rankOf=(score)=>score>=2400?'Chief investigator':score>=1550?'Senior investigator':'Field investigator';
function recordBox(){
  if(state.filed)return `<div class="record-box filed"><small>On the record</small><b>${esc(cloud.name())}</b><span id="recordStatus">${cloud.pending()?'Waiting for a connection to file it.':cloud.lastPlace?`Filed. You are number ${Number(cloud.lastPlace)} on the ${comfort?'veteran':'standard'} board.`:'Filed. See Records on the title screen.'}</span></div>`;
  return `<div class="record-box"><small>File your result on the public record</small><label class="record-field"><span>Investigator name</span><input id="recordName" maxlength="16" autocomplete="nickname" spellcheck="false" value="${esc(cloud.name())}" placeholder="2–16 letters or numbers"></label>${htmlButton('file-score','Submit to the record','gold-btn')}<span id="recordStatus" role="status"></span></div>`;}
async function fileScore(){
  const input=document.getElementById('recordName'),status=document.getElementById('recordStatus'),name=(input?.value||'').trim();
  if(!cloud.validName(name)){status.textContent='Use 2–16 letters or numbers.';input?.focus();return;}
  status.textContent='Filing…';
  try{await cloud.setName(name);}catch(e){if(e.status){status.textContent=e.status===400||e.code==='23514'?'Pick a different name.':'The records office refused it. Try again shortly.';return;}cloud.rememberName(name);}
  cloud.queue('submit_score',{p_score:state.score,p_cases:state.links.length,p_rank:rankOf(state.score),p_seconds:Math.max(120,Math.round(state.stats?.seconds||0)),p_veteran:comfort});
  state.filed=true;persist();await cloud.flush();
  const box=document.querySelector('.record-box');if(box)box.outerHTML=recordBox();}
// Accounts: email or investigator ID + password. Guests play without one; signing in keeps progress and
// best scores on every device (a brand-new account takes over this device's guest progress).
let acctKind='email';
function accountLabel(){const a=cloud.account();$('account').textContent=a?`Account · ${cloud.name()||a.investigator||a.email.split('@')[0]}`:'Sign in';}
async function accountPage(){
  const a=cloud.account();
  if(!a){const email=acctKind==='email';
    panel('account','','Account',`<p>Sign in to keep your progress and best scores on every device. You can still play as a guest.</p><div class="tabs board-tabs">${htmlButton('acct-tab','Email',email?'tab active':'tab','data-k="email"')}${htmlButton('acct-tab','Investigator ID',email?'tab':'tab active','data-k="id"')}</div><div class="account-form"><label class="record-field"><span>${email?'Email':'Investigator ID'}</span><input id="acctLogin" ${email?'type="email" autocomplete="email" placeholder="you@example.com"':'type="text" autocomplete="username" maxlength="16" placeholder="2–16 letters or numbers"'} spellcheck="false"></label><label class="record-field"><span>Password</span><input id="acctPass" type="password" autocomplete="current-password" placeholder="At least 6 characters"></label><span id="acctStatus" role="status"></span></div><div class="panel-actions">${htmlButton('acct-in','Sign in','gold-btn')}${htmlButton('acct-up','Create account','plain-btn')}${htmlButton('back','Play as guest','text-btn')}</div>${legalLine('By creating an account you agree to the')}`,{wide:true});
    document.getElementById('acctLogin')?.focus();return;}
  const cell=(label,v)=>`<span><small>${label}</small><b>${v}</b></span>`;
  panel('account','','Account',`<div class="account-head"><small>Signed in as</small><b>${esc(cloud.name()||a.investigator||a.email.split('@')[0])}</b><span>${esc(a.investigator?'Investigator ID: '+a.investigator:a.email)}</span></div><div class="press-stats account-stats" id="acctStats">${cell('Best score','…')}${cell('Veteran best','…')}${cell('Cases won','…')}${cell('Cloud save','…')}</div><span id="acctStatus" role="status"></span><div class="panel-actions">${htmlButton('back','Back to title','gold-btn')}${htmlButton('acct-out','Sign out','text-btn')}</div>${legalLine('Read the')}`,{wide:true});
  try{const s=await cloud.stats(),box=document.getElementById('acctStats'),n=(v)=>v==null?'—':Number(v).toLocaleString('en-US');if(!box)return;
    box.innerHTML=cell('Best score',n(s?.best))+cell('Veteran best',n(s?.best_veteran))+cell('Cases won',`${n(s?.wins)} of ${n(s?.runs)}`)+cell('Cloud save',s?.saved_at?new Date(s.saved_at).toLocaleDateString():'None yet');}
  catch{const st=document.getElementById('acctStatus');if(st)st.textContent='Can’t reach the records office right now.';}}
const legalLine=(lead)=>`<p class="legal-line">${lead} ${htmlButton('legal','Terms of service','text-btn','data-doc="terms"')} and ${htmlButton('legal','Privacy policy','text-btn','data-doc="privacy"')}.</p>`;
function legalPage(doc){
  const privacy=doc==='privacy',rows=privacy?PRIVACY:TERMS;
  panel('legal','',privacy?'Privacy policy':'Terms of service',`<div class="tabs board-tabs">${htmlButton('legal','Privacy policy',privacy?'tab active':'tab','data-doc="privacy"')}${htmlButton('legal','Terms of service',privacy?'tab':'tab active','data-doc="terms"')}</div><div class="legal-text"><small>Last updated ${LEGAL_DATE}</small>${rows.map(([h,t])=>`<h3>${h}</h3><p>${t}</p>`).join('')}</div>${privacy?`<span id="acctStatus" role="status"></span>`:''}<div class="panel-actions">${htmlButton('legal-back','Back','gold-btn')}${privacy?htmlButton('delete-ask','Delete my account and online data','plain-btn danger'):''}</div>`,{wide:true});}
function deleteAsk(){
  const a=cloud.account();
  panel('legalDelete','','Delete everything online?',`<p>This permanently deletes ${a?`the account <b>${esc(a.investigator||a.email)}</b>, its`:'this device’s'} leaderboard name, scores, attempt reports and cloud save. It cannot be undone.</p><p>The save on this device is not touched.</p><span id="acctStatus" role="status"></span><div class="panel-actions">${htmlButton('legal','Keep my data','gold-btn','data-doc="privacy"')}${htmlButton('delete-go','Delete permanently','plain-btn danger')}</div>`,{wide:true});}
async function deleteGo(){
  const status=document.getElementById('acctStatus');status.className='';status.textContent='Deleting…';
  try{await cloud.deleteAccount();}catch{status.className='error';status.textContent='Could not reach the records office. Nothing was deleted.';return;}
  accountLabel();legalPage('privacy');const st=document.getElementById('acctStatus');if(st)st.textContent='Your online data has been deleted.';}
async function accountSubmit(create){
  const status=document.getElementById('acctStatus');if(!status)return;
  const fields=[document.getElementById('acctLogin'),document.getElementById('acctPass')];
  status.className='';fields.forEach(f=>f?.classList.remove('bad'));
  status.textContent=create?'Opening a new file…':'Checking the files…';
  try{await cloud.logIn(acctKind,fields[0]?.value,fields[1]?.value,create);}
  catch(e){status.textContent=e.message;status.className='error';fields.forEach(f=>{if(f){f.classList.add('bad');restartAnim(f);}});audio.sfx('thud');fields[1]?.select();return;}
  accountLabel();
  const data=await cloud.pullSave().catch(()=>null),run=data&&readRun(JSON.stringify(data));
  if(!stored){if(run){putStored(storageKey,JSON.stringify(data));stored=run;title();}accountPage();return;}
  // This device already has a save: the player decides what happens to it.
  const same=run&&(data.savedAt||0)===(stored.savedAt||0),line=(r)=>`Case ${r.caseIndex+1}: ${cases[r.caseIndex].name}, ${Number(r.score).toLocaleString('en-US')} points`;
  accountCloud=run&&!same?data:null;
  panel('accountSave','','Your progress',`<p>This device has a saved investigation: <b>${line(stored)}</b>.</p>${accountCloud?`<p>The account already has one too: <b>${line(run)}</b>.</p>`:'<p>The account has no other save.</p>'}<div class="panel-actions">${htmlButton('save-transfer',accountCloud?'Transfer this device’s save (replaces the account’s)':'Transfer it to this account','gold-btn')}${htmlButton('save-delete',accountCloud?'Delete it and use the account’s save':'Delete it and start fresh','plain-btn danger')}</div>`,{wide:true,close:false});}
let accountCloud=null;
function resolveSave(transfer){
  if(transfer){const snap={...stored,savedAt:Date.now()};putStored(storageKey,JSON.stringify(snap));stored=readRun(JSON.stringify(snap));cloud.pushSave(snap,true);}
  else if(accountCloud){putStored(storageKey,JSON.stringify(accountCloud));stored=readRun(JSON.stringify(accountCloud));}
  else{try{localStorage.removeItem(storageKey);}catch{}stored=null;cloud.ignoreSavesUntilNow();}
  accountCloud=null;title();accountPage();}
let boardVeteran=false;
async function records(){
  panel('records','','Records',`<div class="tabs board-tabs">${htmlButton('board-tab','Standard',boardVeteran?'tab':'tab active','data-v="0"')}${htmlButton('board-tab','Veteran mode',boardVeteran?'tab active':'tab','data-v="1"')}</div><ol class="board-list" id="boardList"><li class="board-empty">Opening the records…</li></ol><details class="journal-details transfer"><summary>Continue a save from another device</summary><label class="record-field"><span>Transfer code</span><input id="transferCode" maxlength="12" spellcheck="false" autocomplete="off" placeholder="12 characters"></label>${htmlButton('load-code','Load that save','plain-btn')}<span id="transferStatus" role="status"></span></details><div class="panel-actions">${htmlButton('back','Back to title','gold-btn')}</div>`,{wide:true});
  const list=document.getElementById('boardList');
  try{const rows=await cloud.leaderboard(boardVeteran);if(!document.getElementById('boardList'))return;
    list.innerHTML=rows.length?rows.map((r,i)=>`<li class="${r.name===cloud.name()?'me':''}"><i>${i+1}</i><b>${esc(r.name)}</b><small>${rankOf(Number(r.score))} · ${Number(r.cases_closed)} of 3 · ${Math.floor(Number(r.seconds)/60)}m ${String(Number(r.seconds)%60).padStart(2,'0')}s</small><strong>${Number(r.score).toLocaleString('en-US')}</strong></li>`).join(''):'<li class="board-empty">No one is on this board yet. Close all three cases to be first.</li>';}
  catch{list.innerHTML='<li class="board-empty">The records office is out of reach. Check your connection.</li>';}}
async function loadCode(){
  const code=(document.getElementById('transferCode')?.value||'').trim(),status=document.getElementById('transferStatus');
  if(!/^[0-9a-fA-F]{12}$/.test(code)){status.textContent='Codes are 12 characters, 0–9 and A–F.';return;}
  // Loading a code replaces the save on this device: ask once before throwing a game away.
  if(stored&&loadCode.asked!==code){loadCode.asked=code;status.textContent='This replaces the game saved on this device. Press Load again to go ahead.';return;}
  status.textContent='Looking it up…';
  try{const data=await cloud.loadCode(code);const run=readRun(JSON.stringify(data));if(!run)throw new Error('That save could not be read.');
    data.savedAt=Date.now();   // the code's own timestamp is not trusted: a future one would block this device's cloud save
    putStored(storageKey,JSON.stringify(data));stored=run;loadCode.asked='';status.textContent='Loaded. Continue the investigation from the title screen.';title();}
  catch(e){status.textContent=/No save|could not/.test(e.message)?e.message:'Online records are unavailable right now.';}}
function gameOver(){const loss=state.loss||{cause:'guard',steps:0};const report=losses[loss.cause]||losses.guard;panel('gameOver',`Case ${state.caseIndex+1}`,'The trail went cold.',`<div class="outcome-grid"><div class="loss-art" role="img" aria-label="A pocket watch lies on the clinic floor beneath the corridor light"></div><div class="outcome-copy"><h3>${report.reason}</h3><p>${report.tip}</p><div class="loss-ledger"><span>Retrying costs <b>50 points</b></span><span>Cases already closed <b>${state.checkpoint.links.length}</b></span></div><div class="panel-actions">${htmlButton('revive','Retry this case','gold-btn')}${htmlButton('title','Return to title','text-btn')}</div></div></div>`,{wide:true,close:false});}
function damage(cause){if(state.stage==='gameOver'||invulnerable>0&&state.stage==='memory')return;
  state.hp=Math.max(0,state.hp-34);invulnerable=3.5;guardMeter=0;flash('hit');shakeTime=.5;playFx(FX.hit);audio.cue('hurt');scoreHUD();const report=losses[cause];modalMessage=report.reason+' One composure bulb lost.';notify('Spotted',modalMessage,3.4);
  if(modal==='hands')closeModal(); // you drop what you were doing
  if(state.hp===0&&cause==='guard'&&state.stage==='memory'){caughtByGuard();return;}
  if(state.hp===0){loseCase(state,cause);cloud.logRun(runRow('caught'));clearAlert();closeModal();updateHud();persist();gameOver();return;}persist();}
// Mateo's last bulb: no restart. The guard takes back the last thing he hid, hours are lost, and the guards stay on alert for the rest of the case.
// A new game, a retry or a capture: guards back on their routes, throwables back in place, nothing in hand.
function calmGuards(){stealth.reset();aiming=null;showHeld(null);}
function caughtByGuard(){
  const lost=state.found.pop();
  state.hp=34;state.alarm=(state.alarm||0)+1;state.benchWatched=true;state.score-=50;(state.stats||={seconds:0,caught:0,spent:0,items:[]}).caught++;
  waitForShift(state);state.guardTime=0;patrol=patrolAt(0,state.caseIndex);guardBeat=-1;clearAlert();closeModal();tracked='';
  cutscene({at:guardWindow,kicker:'Caught',title:'He drags you back to the bench',line:(lost?`You lose your last lead: ${discoveries[lost][0]}. `:'')+'Hours pass. The guards are on alert, and the staff bench is watched.',fx:'neg',shake:true,hold:3,mode:'cut',cue:'hurt',then(){calmGuards();spawnForStage();scoreHUD();updateHud();persist();}});}
function inputLock() {
  panel(
    'lock',
    'Desk drawer',
    'The brass combination',
    `<p>Match the three wheels to Mateo’s file number.${comfort?' It is 4 0 9.':''}</p><div class="digits">${
      lockDigits.map((n, i) =>
        `<div class="wheel">${
          htmlButton(
            'wheel',
            '▴',
            '',
            `data-wheel="${i}" data-delta="1" aria-label="Increase digit ${i + 1}"`,
          )
        }<output aria-label="Digit ${i + 1}">${n}</output>${
          htmlButton(
            'wheel',
            '▾',
            '',
            `data-wheel="${i}" data-delta="-1" aria-label="Decrease digit ${i + 1}"`,
          )
        }</div>`
      ).join('')
    }</div>${message()}<div class="panel-actions">${htmlButton('unlock', 'Try the latch', 'gold-btn')}${
      htmlButton('back', 'Set down')
    }</div>`,
  );
}
function doUnlock() {
  if (lockDigits.join('') !== '409') {
    damage('lock');
    if (modal === 'lock') inputLock();
    return;
  }
  const earned = grant(state, 'drawer', 150);
  addExhibits(state, 2);
  state.stage = 'verify';
  closeModal();
  cutscene({at:locations.lock,id:'lock',dist:1.15,lift:.55,kicker:earned?'Drawer unlocked, +150 points':'Drawer unlocked',title:'4 · 0 · 9',line:'Same file number as the receipt.',fx:'flash',hold:2.6,cue:'latch'});
  updateHud();
  persist();
}
function board() {
  const order = [2, 0, 1];
  const card = (id, side) => {
    const c = cases[id], linked = state.links.includes(id);
    const open = side === 'lead' ? id <= state.caseIndex : true;
    const selected = selectedPin?.id === id && selectedPin?.side === side;
    return htmlButton(
      'pin',
      `<b>${side === 'lead' ? 'Case ' + (id + 1) : 'Recovered lead'}</b><strong>${
        side === 'lead' ? (open ? c.pillar : 'Sealed file') : c.answer
      }</strong>`,
      'pin-card' + (selected ? ' selected' : '') + (linked ? ' linked' : ''),
      `data-id="${id}" data-side="${side}" ${linked || !open ? 'disabled' : ''}`,
    );
  };
  const rows = cases.map((v, i) => card(i, 'lead') + card(order[i], 'answer')).join('');
  const unlocked = [...new Set(state.links.flatMap((i) => cases[i].actions))];
  panel(
    'board',
    '',
    'Connect the evidence',
    `<p>Select the current file on the left, then its matching lead on the right. ${cases[state.caseIndex].result}</p><div class="board-surface"><svg class="board-lines" aria-hidden="true"></svg><div class="pin-grid">${rows}</div></div><div class="evidence-tags">${
      state.exhibits.map((i) => `<span>${evidence[i][0]}</span>`).join('')
    }</div>${
      unlocked.length
        ? `<div class="tabs">${
          unlocked.map((i) => htmlButton('board-card', actions[i].title, 'tab', `data-id="${i}"`)).join('')
        }</div>`
        : ''
    }${message()}<div class="panel-actions">${
      state.links.includes(state.caseIndex)
        ? htmlButton(
          'next-file',
          state.caseIndex === 2 ? 'Find the desk radio' : 'Open the next file',
          'gold-btn',
        )
        : htmlButton('back', 'Return to room')
    }</div>`,
    { wide: true },
  );
  drawThread();
}
function drawThread() {
  if (modal !== 'board') return;
  const svg = document.querySelector('.board-lines'), r = svg.getBoundingClientRect();
  svg.innerHTML = state.links.map((i) => {
    const a = document.querySelector(`[data-side="lead"][data-id="${i}"]`).getBoundingClientRect(),
      b = document.querySelector(`[data-side="answer"][data-id="${i}"]`).getBoundingClientRect();
    return `<line x1="${a.right - r.left - 1}" y1="${a.top + a.height * .50 - r.top}" x2="${
      b.left - r.left + 1
    }" y2="${b.top + b.height * .50 - r.top}"/>`;
  }).join('');
}
function selectPin(id, side) {
  if (state.links.includes(id) || side === 'lead' && id > state.caseIndex) return;
  if (!selectedPin || selectedPin.side === side) {
    selectedPin = { id, side };
    modalMessage = side === 'lead' ? 'Now choose its lead.' : 'Now choose the matching case file.';
    board();
    return;
  }
  const match = selectedPin.id === id && id === state.caseIndex;
  selectedPin = null;
  if (!match) {
    damage('board');
    if (modal === 'board') board();
    return;
  }
  state.links.push(id);
  const pts = grant(state, 'board' + id, 200);
  audio.cue('clue');
  modalMessage = `File pinned${pts ? ' · +200 points' : ''}. Action card${
    cases[id].actions.length > 1 ? 's' : ''
  } filed.`;
  scoreHUD();
  persist();
  board();
}
function nextFile() {
  if (!state.links.includes(state.caseIndex)) return;
  closeModal();
  const done=state.caseIndex;
  cutscene({at:locations.board,id:'board',dist:2.0,lift:.0,swing:0,kicker:`Case ${done+1}: ${cases[done].name}`,title:'Case file closed',line:cases[done].result,fx:'neg',hold:2.4,mode:'ink',cue:'clue',then:advanceFile});
}
function advanceFile(){
  if(state.caseIndex===0&&!state.gates[0]){state.stage='gate';state.gateStep='terminal';spawnForStage();chapter('Detective / The intake lobby','The lure ads');notify('Detective','The lab door is wired to the recruitment terminal.',4);updateHud();persist();return;}
  if(state.caseIndex===1&&!state.gates[1]){state.stage='gate';state.gateStep='shredder';spawnForStage();chapter('Detective / The phlebotomy lab','The ethics hold');notify('Detective','Mateo’s file is still marked for surgery.',4);updateHud();persist();return;}
  if (state.caseIndex === 2) {
    state.stage = 'glass';delete state.rescueLeft;spawnForStage();
  } else {
    startCase(state, state.caseIndex + 1);
    props.setCase(state.caseIndex);
    chapter('Detective / Case file ' + caseNo(), cases[state.caseIndex].name);
  }
  updateHud();
  persist();
}
function actionCard(i, from) {
  const a = actions[i];
  panel(
    from === 'board' ? 'boardCard' : 'journalCard',
    'Prevention action card',
    a.heading,
    `<p>${a.body}</p><div class="rule"></div><p>${a.action}</p>${sourceLink(a)}<div class="panel-actions">${
      htmlButton('back', from === 'board' ? 'Back to board' : 'Back to journal', 'gold-btn')
    }</div>`,
  );
}
function sourceLink(a) {
  return a.url ? `<a href="${a.url}" target="_blank" rel="noopener noreferrer">${a.source} ↗</a>` : '';
}
// ── Knowledge check (before and after) and the three-part debrief ──
let quizRun=null,debriefTab=0;const debriefSeen=new Set();
function quizPage(phase){
  if(!quizRun||quizRun.phase!==phase)quizRun={phase,picks:[]};
  const i=quizRun.picks.length,item=QUIZ[i];
  panel('quiz','',phase==='pre'?'Before you begin':'What do you know now?',`<p>${phase==='pre'?'Three quick questions. There is no score to pass; the game asks them again at the end.':'The same three questions as at the start.'}</p><div class="folio-file">Question ${i+1} of ${QUIZ.length}</div><p class="brief-question">${item.q}</p><div class="quiz-options">${item.options.map((o,k)=>htmlButton('quiz-pick',o,'plain-btn',`data-k="${k}"`)).join('')}</div>${phase==='pre'?`<div class="panel-actions">${htmlButton('quiz-skip','Skip the questions','text-btn')}</div>`:''}`,{wide:true,close:false});document.activeElement?.blur();}
function quizPick(k){
  if(!quizRun)return;quizRun.picks.push(k);
  if(quizRun.picks.length<QUIZ.length){quizPage(quizRun.phase);return;}
  const {phase,picks}=quizRun;quizRun=null;state.quiz={...(state.quiz||{}),[phase]:picks};persist();
  if(phase==='pre'){closeModal();contract();}else resultsPage();}
const quizScore=(picks)=>picks?picks.filter((k,i)=>k===QUIZ[i].answer).length:null;
function debriefPage(just=-1){
  const d=DEBRIEF[debriefTab],seen=d.cards.filter((_,i)=>debriefSeen.has(debriefTab+':'+i)).length,all=DEBRIEF.every((t,ti)=>t.cards.every((_,i)=>debriefSeen.has(ti+':'+i)));
  panel('debrief','','Debrief',`<div class="tabs board-tabs">${DEBRIEF.map((t,i)=>htmlButton('debrief-tab',t.tab,i===debriefTab?'tab active':'tab',`data-id="${i}"`)).join('')}</div><p>${d.lead} <b>${seen} of ${d.cards.length} turned.</b></p><div class="debrief-cards">${d.cards.map(([front,back],i)=>{const open=debriefSeen.has(debriefTab+':'+i);return `<button class="debrief-card${open?' open':''}${i===just?' turn':''}" data-action="debrief-card" data-id="${i}" aria-expanded="${open}"><b>${front}</b><span>${open?back:'Turn the card'}</span></button>`;}).join('')}</div>${d.links?`<div class="debrief-links">${d.links.map(([label,url])=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`).join('')}</div>`:''}<div class="panel-actions">${htmlButton('quiz-post',all?'Check what you learned':'Check what you learned (turn every card first)','gold-btn',all?'':'disabled')}${htmlButton('back','Back to the rescue','text-btn')}</div>`,{wide:true});}
function resultsPage(){
  const pre=state.quiz?.pre,post=state.quiz?.post,a=quizScore(pre),b=quizScore(post),mark=(picks,i)=>picks?(picks[i]===QUIZ[i].answer?'<i class="yes">✓</i>':'<i class="no">✗</i>'):'<i>–</i>';
  panel('results','','What you learned',`<div class="press-stats results-stats"><span><small>Before the story</small><b>${a===null?'Skipped':a+' of '+QUIZ.length}</b></span><span><small>After the story</small><b>${b} of ${QUIZ.length}</b></span></div><table class="results-table"><tr><th></th><th>Before</th><th>After</th></tr>${QUIZ.map((qz,i)=>`<tr><td><b>${qz.topic}</b><small>${qz.options[qz.answer]}</small></td><td>${mark(pre,i)}</td><td>${mark(post,i)}</td></tr>`).join('')}</table><p class="brief-question">“${MESSAGE}”</p><div class="panel-actions">${htmlButton('back','Back to the rescue','gold-btn')}${htmlButton('debrief','Read the debrief again','text-btn')}</div>`,{wide:true});}
function ending(){const first=state.stage!=='end';state.stage='end';updateHud();persist();if(first)cloud.logRun(runRow('won'));const rank=rankOf(state.score);panel('end','The Harbour Gazette','Mateo walks free.',`<div class="news-deck">Morning edition. Harbour district, 3:54 a.m.</div><div class="press-grid"><figure class="rescue-shot"><div role="img" aria-label="Mateo and his advocate walking into the morning light"></div><figcaption>Mateo leaves the clinic beside his patient advocate.</figcaption></figure><div class="press-copy"><span class="verdict">Rescue confirmed</span><p>The team reached Suite B six minutes before four. The pocket watch stops.</p><div class="press-stats"><span><small>Investigation score</small><b>${state.score.toLocaleString('en-US')}</b></span><span><small>Cases closed</small><b>${state.links.length} of 3</b></span></div><div class="rank-line">${rank}</div>${recordBox()}<div class="panel-actions">${htmlButton('debrief','Start the debrief','gold-btn')}${htmlButton('open-dossier','Action cards','plain-btn')}${htmlButton('title','Return to title','text-btn')}</div></div></div>`,{wide:true,close:false});}
function endDossier(){const a=actions[dossierTab];panel('dossier','Case closed','The action dossier',`<div class="tabs">${actions.map((v,i)=>htmlButton('dossier',v.title,'tab'+(i===dossierTab?' active':''),`data-id="${i}" aria-pressed="${dossierTab===i}"`)).join('')}</div><h3>${a.heading}</h3><p>${a.body}</p><p>${a.action}</p>${sourceLink(a)}<div class="panel-actions">${htmlButton('back','Back to the rescue','gold-btn')}</div>`,{wide:true});}
const toward = new THREE.Vector3(),
  localFront = new THREE.Vector3(0, 0, 1),
  lampAlign = new THREE.Quaternion(),
  paperTurn = new THREE.Quaternion();
function openInspection() {
  release();
  dropKeys();
  const obj = props.casePaper;
  const origin = [camera.position.x, camera.position.z, yaw, pitch, camera.position.y];
  inspect = {
    origin,
    position: obj.position.clone(),
    quaternion: obj.quaternion.clone(),
    scale: obj.scale.clone(),
    angle: state.caseIndex === 1 ? .70 : state.caseIndex === 2 ? 1.38 : 1.24,
    tilt: 0,
    hold: 0,
  };
  const center = new THREE.Vector3(.18, 1.57, .96);
  pose(.34, 2.32, center, 1.83);
  obj.position.copy(center);
  obj.scale.setScalar(.98);
  lightVector.copy(props.lamp).sub(center).normalize();
  if (state.caseIndex === 1) lightVector.negate();
  lampAlign.setFromUnitVectors(localFront, lightVector);
  $('inspectHud').hidden = false;
  $('inspectHud').querySelector('h2').textContent = cases[state.caseIndex].document;
  $('inspectHud').querySelector('p').textContent = [
    'Turn it toward the lamp.',
    'Turn it over, into the light.',
    'Hold it up against the bulb.',
  ][state.caseIndex];
  $('game').dataset.inspect = 'true';
  updateHud();
  updateInspection(0);
}
function updateInspection(dt) {
  if (!inspect) return;
  const turn = (Number(keys.has('ArrowRight') || keys.has('KeyD')) -
    Number(keys.has('ArrowLeft') || keys.has('KeyA'))) * dt * 1.9;
  inspect.angle += turn;
  inspect.tilt = clamp(
    inspect.tilt + (Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'))) * dt * 1.1,
    -.85,
    .85,
  );
  paperTurn.setFromEuler(new THREE.Euler(inspect.tilt, inspect.angle, 0, 'YXZ'));
  const obj = props.casePaper;
  obj.quaternion.copy(lampAlign).multiply(paperTurn);
  obj.updateMatrixWorld();
  normal.copy(localFront).applyQuaternion(obj.quaternion);
  if (state.caseIndex === 1) normal.negate();
  lightVector.copy(props.lamp).sub(obj.position).normalize();
  const dot = normal.dot(lightVector),
    level = state.caseIndex === 2 ? -dot : dot,
    aligned = level > (state.caseIndex === 2 ? .85 : .90);
  inspect.hold = aligned ? Math.min(.68, inspect.hold + dt) : 0;
  $('inspectHud').querySelector('.exposure i').style.width =
    Math.round(clamp((level + 1) / 2, 0, 1) * 100) + '%';
  $('inspectHud').querySelector('b').textContent = aligned
    ? 'Mark visible. Hold steady.'
    : `Lamp alignment ${Math.round(clamp((level+1)/2,0,1)*100)}%. ${Math.sin(inspect.angle)*(state.caseIndex===2?-1:1)>0?'Turn it left':'Turn it right'}.`;
  if (inspect.hold >= .66) beginMemory();
}
function leaveInspection(restore = true) {
  if (!inspect) return;
  const o = inspect, doc = props.casePaper;
  doc.position.copy(o.position);
  doc.quaternion.copy(o.quaternion);
  doc.scale.copy(o.scale);
  inspect = null;
  $('game').dataset.inspect = 'false';
  $('inspectHud').hidden = true;
  dropKeys();
  if (restore) {
    const [x, z, y, p, h] = o.origin;
    camera.position.set(x, h, z);
    yaw = y;
    pitch = p;
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    camera.updateMatrixWorld();
    updateHud();
  }
}
function interact(id = focus) {
  if(!id&&comfort&&modeActive()&&!inspect){const m=mainTarget();if(m&&inReach(m))id=m;}
  if(id&&id.startsWith('curio:')){if(modeActive()&&!inspect)searchCurio(id.slice(6));return;}
  if(id&&id.startsWith('throw:')){if(modeActive()&&!inspect){const kind=stealth.pickUp(id.slice(6));if(kind){audio.sfx('select');showHeld(kind);}}return;}
  if (!modeActive() || inspect || !id || !stageTargets(state).includes(id)) return;
  if(id==='rest'&&state.benchWatched){notify('Staff bench','A guard watches the bench now. You will have to wait it out.',3.5);return;}
  {const t=tactileFor(id);
    if(t&&!tactileBypass){
      if(t.needs&&!state[t.needs]){const it=supplies.find(v=>v.id===t.needs);notify('Lab coat',`You need the ${it.name.toLowerCase()} (${it.cost} points). Press Tab to order it.`,4);return;}
      openTactile(id,t,()=>{const after=tactileAfter(id);tactileBypass=true;try{after?after():interact(id);}finally{tactileBypass=false;}});return;}}
  if (id === 'desk') {
    openInspection();
    return;
  }
  if (id === 'street' && state.stage === 'street') {
    if (streetDelay > 0) return;
    state.pounds++;
    state.reaction = 2.1;
    streetDelay = .77;
    audio.cue('glass');
    flash('flip');
    const captions = [['Outside', 'A man stops inches away. He checks his watch and walks on.'], [
      'Outside',
      'Two people turn toward you. They straighten their collars in their own reflection.',
    ], ['Mateo', '“Six inches of tinted glass. Nobody knows. I have to leave a trail they can’t ignore.”']];
    notify(...captions[state.pounds - 1], 5.5);
    updateHud();
    persist();
    return;
  }
  if (id === 'watch') {
    cutscene({at:locations.watch,id:'watch',kicker:'Mateo, at the west bench',title:'The pocket watch',line:'“Let them find the time it happened.”',fx:'neg',hold:2.2,mode:'ink',cue:'select-major',then(){
    state.hasWatch = true;
    state.solarTime = 12;
    addExhibits(state, 0);
    startCase(state, 0);
    spawnForStage();
    chapter('Detective / Twelve hours later', 'The Golden Ticket');
    notify('Detective', 'Twelve hours later. Read what Mateo left behind.', 4);
    updateHud();
    persist();}});
    return;
  }
  if(state.stage==='memory'&&id==='rest'){audio.clip('daynight');waitForShift(state);state.guardTime=0;patrol=patrolAt(0,state.caseIndex);clearAlert();audio.cue('shift');updateHud();notify('Staff bench',isNight(state.solarTime)?'Night falls.':'Morning comes.',2.5);persist();return;}
  if(state.stage==='memory'&&workTitles[id]){openWork(id);return;}
  if (state.stage === 'memory') {
    finishLead(id);return;
  }
  if(state.stage==='verify'&&verifyLead(state,id)){cutscene({at:locations[id],id,kicker:'Lead corroborated',title:evidence[cases[state.caseIndex].exhibitId][0],line:cases[state.caseIndex].result,fx:'stamp',hold:2.6,cue:'clue',});updateHud();persist();return;}
  if (id === 'lock') {
    lockDigits = [0, 0, 0];
    lockCursor = 0;
    modalMessage = '';
    inputLock();
  }
  if (id === 'key') {
    if (!isLow()) {
      notify('Detective', 'Crouch (C) to reach it.', 2.5);
      return;
    }
    state.stage = 'closet';
    cutscene({at:locations.key,id:'key',dist:.9,lift:.35,kicker:'Behind the radiator',title:'Closet key recovered',line:'Right where Mateo hid it.',fx:'flash',hold:2.2,cue:'latch'});
  }
  if (id === 'closet') {
    state.stage = 'verify';
    addExhibits(state, 5);
    const earned = grant(state, 'closet', 150);
    cutscene({at:locations.closet,id:'closet',dist:2.1,lift:.1,swing:.1,kicker:earned?'Supply closet, +150 points':'Supply closet',title:'The closet swings open',line:'A courier manifest: Pier 9.',fx:'flash',hold:2.6,cue:'latch'});
  }
  if (id === 'board') {
    selectedPin = null;
    modalMessage = '';
    board();
  }
  if (id === 'radio') {
    state.stage = 'strip';delete state.rescueLeft;
    cutscene({at:locations.radio,id:'radio',dist:1.0,lift:.25,kicker:'Dispatch, 3:54 a.m.',title:'Suite B confirmed',line:'“Suite B. We have him.”',fx:'static',hold:3.8,cue:'radio',then(){
      toward.copy(locations.street).sub(camera.position);yaw=Math.atan2(-toward.x,-toward.z);pitch=Math.atan2(toward.y-camera.position.y+camera.position.y,Math.hypot(toward.x,toward.z))*.6;camera.rotation.set(pitch,yaw,0,'YXZ');
      chapter('Dawn / Aegis office', 'Breaking the Glass');notify('Detective','Hold E on the window to peel the tint.',4);}});
  }
  if (id === 'street' && state.stage === 'strip') {
    heldUse = true;
    notify('Detective', 'Keep holding.', 1.5);
  }
  updateHud();
  persist();
}

// ───────────── Cutscenes ─────────────
// A cutscene flies the camera along a curved path to a framed shot, slowly orbits and pushes in
// with a little handheld sway and a zoom punch, then returns control ('return'), engulfs the frame
// in negative-energy ink for a scene change ('ink'), dips to black ('cut'), or parks while a panel
// is open ('stay').
let parked=null, cineBlend=0, fxAnim=null, fxGuard=0, fxGuardTarget=0;
const cineM=new THREE.Matrix4(), easeIO=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2, easeOut=t=>1-Math.pow(1-t,3);
const BASE_FOV=61, cineV=new THREE.Vector3(), cineLook=new THREE.Vector3();
function lookQuat(from,to){cineM.lookAt(from,to,UP);return new THREE.Quaternion().setFromRotationMatrix(cineM);}
function shotFrom(at,{dist=1.2,lift=.42,swing=.35}={}){
  const dir=new THREE.Vector3(camera.position.x-at.x,0,camera.position.z-at.z);
  if(dir.lengthSq()<1e-4)dir.set(0,0,1);dir.normalize().applyAxisAngle(UP,swing);
  const p=at.clone().addScaledVector(dir,dist);p.y=clamp(at.y+lift,.45,3.4);
  p.x=clamp(p.x,-4.2,4.2);p.z=clamp(p.z,-2.65,ROOM_SOUTH-.3);return p;}
// Hand-placed camera positions for objects that have a clear front.
const shots={radio:[1.15,1.85,2.35],channel:[1.15,1.85,2.35],lock:[-1.2,1.5,2.75],key:[-2.85,.8,4.2],secureKey:[-2.85,.95,4.2],cache:[-2.85,1.2,4.35],
  closet:[2.55,1.8,3.55],board:[1.0,2.25,-.25],watch:[-3.0,1.62,2.15],street:[-2.15,1.75,3.3],verifyOffer:[-2.85,1.75,-.25],verifyFreight:[3.15,1.55,3.25],
  verifySignal:[.6,1.85,4.35],weighbill:[.6,1.85,4.35],plant:[.6,1.85,4.35],ribbon:[.6,1.85,4.35],registration:[1.3,2.05,1.0]};
function restartAnim(el){el.classList.remove('run');void el.offsetWidth;el.classList.add('run');}
// Negative-energy timelines: keyframes of {t, neg, ink, warp}. The last key holds until replaced.
function playFx(keys){fxAnim={t:0,keys};}
const FX={
  enter:(d)=>[{t:0,neg:0,ink:0,warp:0},{t:d*.3,neg:.25,ink:.1,warp:.45},{t:d*.75,neg:.85,ink:.8,warp:1},{t:d,neg:1,ink:1.8,warp:1.2}],
  exit:[{t:0,neg:1,ink:1.8,warp:1.2},{t:.2,neg:1,ink:1.7,warp:1},{t:.8,neg:.5,ink:.3,warp:.45},{t:1.3,neg:0,ink:0,warp:0}],
  hit:[{t:0,neg:0,ink:0,warp:0},{t:.05,neg:1,ink:.55,warp:1.4},{t:.2,neg:.25,ink:.3,warp:.6},{t:.6,neg:0,ink:0,warp:0}],
  clue:[{t:0,neg:0,ink:0,warp:0},{t:.08,neg:.4,ink:0,warp:.45},{t:.45,neg:0,ink:0,warp:0}],
  burst:[{t:0,neg:0,ink:0,warp:0},{t:.12,neg:.65,ink:.18,warp:.8},{t:.7,neg:0,ink:0,warp:0}],
};
function sampleFx(dt){
  if(comfort){fxAnim=null;fxGuard=0;return {neg:0,ink:0,warp:0};}
  const v={neg:0,ink:0,warp:0};
  if(fxAnim){
    const k=fxAnim.keys,last=k[k.length-1];fxAnim.t+=dt;
    if(fxAnim.t>=last.t){Object.assign(v,{neg:last.neg,ink:last.ink,warp:last.warp});if(last.neg+last.ink+last.warp<.01)fxAnim=null;}
    else{let i=0;while(i<k.length-2&&fxAnim.t>k[i+1].t)i++;const A=k[i],B=k[i+1],s=easeIO(clamp((fxAnim.t-A.t)/Math.max(1e-4,B.t-A.t),0,1));
      for(const key of ['neg','ink','warp'])v[key]=A[key]+(B[key]-A[key])*s;}
  }
  // The guard's stare bleeds the same energy in from the edges of the frame.
  fxGuard+=(fxGuardTarget-fxGuard)*(1-Math.exp(-dt*6));
  v.ink=Math.max(v.ink,fxGuard*.55);v.neg=Math.max(v.neg,fxGuard*.25);v.warp=Math.max(v.warp,fxGuard*.4);
  if(reduced)v.warp=0;
  return v;
}
function cutscene(o){
  if(comfort){o={...o,mode:o.mode==='ink'?'cut':o.mode,hold:(o.hold??2.4)*1.25,shake:false,orbit:.08,zoom:3,inT:1.3};}
  if(cine)endCine();
  speak((o.line||'')+' '+(o.title||''));
  release();dropKeys();heldUse=false;
  $('caption').hidden=true;$('prompt').hidden=true;$('pointer').hidden=true;arrowShown=false;$('danger').hidden=true;$('gaze').style.opacity='0';
  const at=o.at.isVector3?o.at.clone():new THREE.Vector3(...o.at);
  const from=o.from||(o.id&&shots[o.id]);
  const shot=from?(from.isVector3?from.clone():new THREE.Vector3(...from)):shotFrom(at,o);
  const mode=o.mode||'return',start=camera.position.clone(),span=start.distanceTo(shot);
  // The approach arcs up and to the side through a control point instead of sliding straight.
  const side=new THREE.Vector3().subVectors(shot,start).cross(UP);if(side.lengthSq()<1e-6)side.set(1,0,0);side.normalize();
  const ctrl=start.clone().lerp(shot,.5).addScaledVector(UP,span<.05?0:.2+span*.12).addScaledVector(side,(o.arc??.22)*Math.min(1.6,span));
  cine={o,t:0,at,shot,ctrl,start,startQ:camera.quaternion.clone(),yaw,pitch,mode,inT:o.inT??(reduced?.35:1.0),hold:o.hold??2.4,
    outT:mode==='stay'||mode==='ink'?0:mode==='cut'?.55:.8,orbit:reduced?0:(o.orbit??.2),push:o.push??.18,zoom:o.zoom??7,seed:Math.random()*10};
  if(mode==='ink')playFx(FX.enter(cine.inT+cine.hold));
  else if(o.fx==='flash'||o.fx==='stamp')playFx(FX.burst);
  const g=$('game');g.dataset.cine=o.bars===false?'soft':'on';g.dataset.fx=o.fx||'';
  $('cineKicker').textContent=o.kicker||'';$('cineTitle').textContent=o.title||'';$('cineLine').textContent=o.line||'';
  restartAnim($('cinema'));if(o.cue)audio.cue(o.cue);
}
function bezier(a,c,b,t,out){const u=1-t;return out.set(u*u*a.x+2*u*t*c.x+t*t*b.x,u*u*a.y+2*u*t*c.y+t*t*b.y,u*u*a.z+2*u*t*c.z+t*t*b.z);}
function holdPose(c,t,out){
  // Slow orbit around the subject while pushing in.
  out.subVectors(c.shot,c.at).applyAxisAngle(UP,c.orbit*t).multiplyScalar(1-c.push*t);
  return out.add(c.at);
}
function updateCine(dt){
  const c=cine,a=c.inT,b=a+c.hold,e=b+c.outT;c.t+=dt;
  const sway=reduced?0:1;
  cineLook.copy(c.at).add(cineV.set(Math.sin(c.t*1.3+c.seed)*.014,Math.sin(c.t*1.7+c.seed*2)*.01,Math.sin(c.t*.9+c.seed)*.008).multiplyScalar(sway));
  let zoom=0;
  if(c.t<a){
    const k=easeIO(c.t/a);bezier(c.start,c.ctrl,c.shot,k,camera.position);
    camera.quaternion.copy(c.startQ).slerp(lookQuat(camera.position,cineLook),easeOut(Math.min(1,c.t/a*1.4)));zoom=k;
  }else if(c.t<b){
    holdPose(c,easeOut((c.t-a)/c.hold),camera.position);camera.quaternion.copy(lookQuat(camera.position,cineLook));zoom=1;
  }else if(c.mode==='stay'){
    parked={pos:camera.position.clone(),quat:camera.quaternion.clone(),start:c.start,startQ:c.startQ,yaw:c.yaw,pitch:c.pitch};
    cine=null;$('game').dataset.cine='';$('game').dataset.fx='';c.o.then?.();return;
  }else if(c.mode==='ink'){endCine();return;}
  else if(c.mode==='cut'){if(!c.dark){c.dark=true;$('fade').classList.add('dark');}zoom=1;if(c.t>=e){endCine();return;}}
  else{
    if(!c.endQ){c.endQ=camera.quaternion.clone();c.endP=camera.position.clone();}
    if(!c.ctrl2)c.ctrl2=c.endP.clone().lerp(c.start,.5).addScaledVector(UP,.15+c.endP.distanceTo(c.start)*.08);
    const k=easeIO(Math.min(1,(c.t-b)/Math.max(1e-4,c.outT)));bezier(c.endP,c.ctrl2,c.start,k,camera.position);
    camera.quaternion.slerpQuaternions(c.endQ,c.startQ,k);zoom=1-k;if(c.t>=e){endCine();return;}
  }
  // Zoom punch: the lens tightens as the shot lands.
  camera.fov=BASE_FOV-c.zoom*zoom;camera.updateProjectionMatrix();
  if((c.o.shake||c.o.fx==='static')&&!reduced&&c.t<a+.7){const k=.012*(1-(c.t/(a+.7)));camera.rotateZ((Math.random()-.5)*k*2);camera.position.y+=(Math.random()-.5)*k;}
  camera.updateMatrixWorld();
}
function endCine(){const c=cine;if(!c)return;cine=null;
  camera.position.copy(c.start);yaw=c.yaw;pitch=c.pitch;camera.rotation.set(pitch,yaw,0,'YXZ');camera.fov=BASE_FOV;camera.updateProjectionMatrix();camera.updateMatrixWorld();
  const g=$('game');g.dataset.cine='';g.dataset.fx='';
  c.o.then?.();
  if(c.mode==='ink')playFx(FX.exit);
  if(c.dark)setTimeout(()=>$('fade').classList.remove('dark'),80);
  if(started){updateHud();if(!modal&&!inspect)capture();}}
function skipCine(){const c=cine;if(!c)return;const end=c.inT+c.hold;if(c.t<end)c.t=end;}
function unpark(){if(!parked)return;const p=parked;parked=null;
  cine={o:{},t:0,at:p.pos,start:p.start,startQ:p.startQ,yaw:p.yaw,pitch:p.pitch,mode:'return',inT:0,hold:0,outT:reduced?.2:.5,endP:p.pos,endQ:p.quat,zoom:5,orbit:0,push:0,seed:0};}
// Some searchable things are not there on Mateo's day shifts: by day the holding cell is only a store room.
const dayShift=()=>state.stage==='memory'&&!isNight(state.solarTime);
function searchCurio(id){const c=curios[id],key='curio:'+id,at=curioAt[id].clone();
  const award=(k,n)=>{const pts=grant(state,k,n);audio.cue(pts?'clue':'latch');scoreHUD();persist();if(pts)notify(c.points?'Secondary clue: '+c.title:c.name,`+${pts} points`,2.5);};
  // The detective reads the cracked glass under the UV lamp; Mateo only has his eyes.
  if(c.uv&&character()==='Detective'){
    if(!state.uv){const it=supplies.find(v=>v.id==='uv');notify(c.name,`Something is scratched into the glass, too faint to read. You need the ${it.name.toLowerCase()} (${it.cost} points). Press Tab to order it.`,6);return;}
    openHands('spray',{agent:'uv',surface:'glass',reveal:{lines:c.uv}},c.name,at,()=>{grant(state,key,25);award('uv:'+id,25);notify(c.title,c.found,7);});return;}
  award(key,c.points||25);if(c.uv)speak(c.body);   // Mateo's thought at the glass (take mateo-18, once it is recorded)
  openHands('read',{name:c.name,title:c.title,body:c.body},c.name,at,()=>{});}
// ───────────── Hands-on interactions ─────────────
// Every interaction opens a tactile view (drag, pull, spray, turn) instead of a key press.
// When the view reports done, the original game effect runs exactly as before.
let tactileBypass=false;
const hands=createHands({scene,camera,canvas,sfx:puzzleSound});
function caseFace(){return cases[state.caseIndex].face.slice(2).map(l=>l.replace(/\s{2,}/g,'  '));}
function tactileFor(id){
  const T={
    dispatch:['pile',{doc:{title:'Overseas lab tech wanted',lines:['$4,000 a month. Start at once.','No experience. No visa needed.','Free medical: blood and tissue test.','Agency fee settled on arrival.']}},'Clear the clipboard'],
    carbon:['drawer',{label:'Archive drawer',contents:{title:'Carbon paper',lines:['One blank sheet, unused']}},'Open the archive drawer'],
    ledger:['rubbing',{title:'Blank intake pad',lines:['4  0  9']},'Shade the blank pad'],
    stamp:['press',{label:'Brass embosser'},'Emboss the receipt'],
    cache:['slot',{item:'receipt',place:'radiator'},'Hide the receipt'],
    prints:['spray',{agent:'uv',surface:'stencil',reveal:{lines:['THREE HANDPRINTS','ONE-WAY FILM']}},'Light up the glass','uv'],
    cooler:['spray',{agent:'uv',surface:'stencil',reveal:{lines:['SEAL K7','PIER 9 COLD STORAGE']}},'Read the painted-over stencil','uv'],
    seal:['rubbing',{title:'Rubbing of the freight seal',lines:['K 7','PIER 9']},'Take a pencil rubbing of the seal'],
    keyTrace:['torch',{label:'the radiator',find:'key'},'Search under the radiator'],
    secureKey:['slot',{item:'key',place:'radiator'},'Hide the key'],
    ribbon:['drawer',{label:'Ribbon spool',contents:{title:'Carbon ribbon, read backwards',lines:['St. Jude Maritime Clinic','Suite B, 4:00 a.m.','Kidney transplant: Dr. A. Vance']}},'Pull out the ribbon'],
    waiver:['spray',{agent:'uv',surface:'waiver',reveal:{lines:['I do not consent']}},'Find the bleached signature','uv'],
    roster:['pile',{doc:{title:'Night duty roster',lines:['Patient advocate','Harbour service, 640 kHz']}},'Clear the roster'],
    flyer:['torn',{doc:{title:'Call card',lines:['Patient advocate','Harbour service','640 kHz']}},'Piece the torn card together'],
    channel:['dials',{freq:640,min:520,max:760},'Tune the ham radio'],
    plant:['slot',{item:'card',place:'printer'},'Hide the call card'],
    rest:['watch',{},'Turn the watch to the next shift'],
    registration:['align',{ease:comfort?3:1},'Register the carbon copy'],
    weighbill:['tickets',{},'Trace the cooler’s transfer'],
    board:['thread',{cards:cases.map(c=>({pillar:c.pillar,answer:c.answer})),current:state.caseIndex,linked:[...state.links],onWrong:()=>damage('board')},'Connect the evidence'],
    desk:['pile',{doc:{title:cases[state.caseIndex].document,lines:caseFace()}},'Clear the desk'],
    lock:['tumbler',{code:'409',label:'Desk drawer combination'},'Work the brass dials'],
    closet:['tumbler',{code:'040',label:'Padlock. Try the departure time on the gate ticket.'},'Open the padlock'],
    verifyOffer:['drawer',{label:'Recruitment archive',contents:{title:'Agency copy',lines:['Stamp AG–17','Same as the receipt']}},'Open the archive'],
    verifyFreight:['torn',{doc:{title:'Freight tag',lines:['Seal K7','Pier 9, out 00:40','Declared: medical records']}},'Piece the freight tag together'],
    verifySignal:['drawer',{label:'Telephone log',contents:{title:'Call log',lines:['640 kHz advocate','Suite B, 4:00 a.m.']}},'Open the call log'],
    terminal:['wires',{},'Report the lure ads, secure the records'],
    keypad:['spray',{agent:'luminol',surface:'keypad',reveal:{code:'409',lines:['4  0  9']}},'Spray the keypad','luminol'],
    shredder:['shred',{doctor:'Dr. A. Vance'},'Copy the evidence, hold the surgery'],
    glassCase:['smash',{},'Break the emergency glass'],
    radio:['dials',{freq:640,min:520,max:760},'Raise the rescue dispatcher'],
  };
  if(id==='street'&&state.stage==='strip')return {kind:'peel',opts:{},title:'Peel the tint off the window'};
  const t=T[id];return t?{kind:t[0],opts:t[1],title:t[2],needs:t[3]}:null;
}
function tactileAfter(id){
  return ({
    desk:()=>openInspection(),
    lock:()=>{lockDigits=[4,0,9];doUnlock();},
    channel:()=>finishLead('channel'),
    registration:()=>finishLead('registration'),
    weighbill:()=>finishLead('weighbill'),
    board:()=>{const i=state.caseIndex,[title,body]=cases[i].lesson;if(!state.links.includes(i)){state.links.push(i);grant(state,'board'+i,200);scoreHUD();persist();}
      const [source,fact]=cases[i].fact;   // the notebook page, then one sourced fact about the real crime
      openHands('read',{name:'Detective’s notebook',title,body},'What the trail shows',locations.board.clone(),()=>openHands('read',{name:source,title:'In the real world',body:fact},'In the real world',locations.board.clone(),()=>nextFile()));},
    terminal:()=>{state.gateStep='keypad';audio.cue('latch');notify('Detective','The records are safe. The keypad still needs the code.',3.5);updateHud();persist();},
    keypad:()=>openGate(1),
    shredder:()=>openGate(2),
    glassCase:()=>{state.stage='radio';audio.cue('latch');notify('Detective','The dispatch key. Now the ham radio.',3);updateHud();persist();},
    street:()=>{if(state.stage==='strip'){state.strip=1;finishStrip();}},
  })[id];
}
// The camera moves in on the object and the puzzle is built there as real 3D parts (src/hands.js).
// A slim bar at the bottom carries the hint, what was found, the Veteran buttons and Step back.
function openHands(kind,opts,title,at,onDone){
  closeTactile();
  const p=hands.pose(kind,at,camera.position,comfort?.9:1);
  cutscene({at:p.look,from:p.cam,mode:'stay',bars:false,inT:reduced?.3:.7,hold:.05,push:0,orbit:0,zoom:0,arc:.08,cue:'step',then(){
    modal='hands';$('game').dataset.modal='hands';$('pointer').hidden=true;arrowShown=false;
    let finished=false;
    const ui=hands.open(kind,opts,p,{veteran:comfort,say:(text)=>{$('handsSay').textContent=text;speak(text);},
      done:(r)=>{if(finished)return;finished=true;closeModal();if(cine)endCine();onDone(r);capture();}});
    $('handsTitle').textContent=title;$('handsHint').textContent=ui.hint;$('handsSay').textContent='';
    handsButtons=ui.buttons;
    $('handsVet').innerHTML=ui.buttons.map(([label],i)=>`<button type="button" class="tx-btn" data-hands="${i}">${label}</button>`).join('')+(ui.hold?`<button type="button" class="tx-btn tx-hold-btn" data-hands="hold">${ui.hold}<i id="handsRing"></i></button>`:'');
    $('hands').hidden=false;needsDraw=true;}});
}
let handsButtons=[];
function openTactile(id,t,onDone){openHands(t.kind,t.opts,t.title,(locations[id]||camera.position).clone(),onDone);}
function closeTactile(){if(hands.active){hands.close();$('hands').hidden=true;audio.sfx('static',0);}}
function openGate(n){
  state.gates[n-1]=true;state.gateStep='';startCase(state,n);persist();   // saved already in the next case, so closing the game during the door cutscene cannot strand the save
  const at=n===1?new THREE.Vector3(-2.1,1.3,6.45):new THREE.Vector3(-3.35,1.2,10.25);
  cutscene({at,from:n===1?[-1.2,1.7,4.6]:[-1.8,1.6,8.8],kicker:n===1?'Ads reported, records secured':'Evidence copied, surgery on hold',title:n===1?'The lab door opens':'The dispatch door opens',line:n===1?'Beyond it: the phlebotomy lab.':'Beyond it: the dispatch office.',fx:'flash',hold:2.2,cue:'latch',then(){
    props.setCase(state.caseIndex);chapter('Detective / Case file '+caseNo(),cases[state.caseIndex].name);updateHud();persist();}});
}
function finishStrip(){
  heldUse=false;
  cutscene({at:locations.street,id:'street',dist:2.2,lift:.05,swing:0,kicker:'Dawn, 5:12 a.m.',title:'The street can see in',line:'Across the road, people stop and look in.',fx:'dawn',hold:3.2,mode:'cut',cue:'clue',then:ending});
}
// Doors block movement and line of sight until they open.
const doorOpen=k=>k==='lab'?(state.gates[0]||state.caseIndex>=1):(state.gates[1]||state.caseIndex>=2);
function refreshBarriers(){barriers=[...footprints,...(doorOpen('lab')?[]:[doors.lab]),...(doorOpen('dispatch')?[]:[doors.dispatch])];}
const majorLeads=['registration','weighbill','channel','cache','secureKey','plant'];
// Codes and numbers the player can keep in the journal. Saved automatically unless turned off in Pause.
const CODES={ledger:['Intake file number','4 0 9'],weighbill:['Padlock: the gate departure time','0 4 0'],roster:['Advocate’s radio frequency','640 kHz']};
let autoCodes=getStored('redacted-donor.autocodes')!=='off',pendingCode='';
function saveCode(id){state.codes=[...new Set([...(state.codes||[]),id])];pendingCode='';persist();}
// Called when a lead is solved: returns the line to show about its code, if it has one.
function codeNote(id){if(!CODES[id]||(state.codes||[]).includes(id))return '';const [label,code]=CODES[id];
  if(autoCodes){saveCode(id);return ` Saved to your journal: ${label}, ${code}.`;}pendingCode=id;return ` ${label}: ${code}. Press N to save it to your journal.`;}
function finishLead(id){
  const r=record(state,id,true);if(!r)return;const code=codeNote(id);
  let tag=discoveries[id][0]+(r.points?` (+${r.points})`:'');if(r.bonus)tag+=', early-shift bonus';
  const at=locations[id];persist();
  if(r.complete){cutscene({at,id,kicker:'Memory secured. '+tag,title:discoveries[id][0],line:discoveries[id][1],fx:'neg',hold:2.6,mode:'ink',cue:'clue',then(){
      spawnForStage();chapter('Detective / Present day','Back in the office');guardMeter=0;clearAlert();updateHud();persist();if(code)notify('Field journal',code.trim(),5);}});return;}
  if(majorLeads.includes(id)){cutscene({at,id,kicker:tag,title:discoveries[id][0],line:discoveries[id][1],fx:'flash',hold:2.2,cue:'clue',then(){updateHud();persist();if(code)notify('Field journal',code.trim(),5);}});return;}
  audio.cue('clue');playFx(FX.clue);notify(tag,discoveries[id][1]+code,code?6:4);updateHud();
}
function openWork(id){work=startWork(id);panel('fieldwork',`Case ${state.caseIndex+1}`,workTitles[id],workBody(work),{wide:id==='weighbill'});paintWork(work);}
function checkWork(){if(!work)return;if(!solved(work)){const tip={registration:'The crosses still have two centres. Slide the red marks over the black ones.',weighbill:'Compare both fields. One ticket repeats K7 and Pier 9.',channel:'The voice is still breaking up. Move the dial closer to 640 kHz.'};paintWork(work,tip[work.id]);return;}const id=work.id;closeModal();finishLead(id);capture();}
// Each rectangle is a solid footprint in metres. Movements resolve along each axis so the player can slide along furniture.
let barriers=footprints;
function solid(x, z) {
  const r = .18;
  return x < -4.41 + r || x > 4.41 - r || z < -2.9 + r || z > ROOM_SOUTH - .06 - r ||
    barriers.some(([a, b, c, d]) => x > a - r && x < b + r && z > c - r && z < d + r);
}
const eyeAt = () => parked ? parked.start : camera.position;
function hasClearPath(point) {
  const x = eyeAt().x, z = eyeAt().z, dist = Math.hypot(point.x - x, point.z - z);
  if (dist < .01) return true;
  let lo = 0, hi = 1;
  for (const [a, b, c, d] of barriers) {
    if (point.x >= a - .10 && point.x <= b + .10 && point.z >= c - .10 && point.z <= d + .10) continue;
    lo = 0;
    hi = 1;
    for (const [from, dir, min, max] of [[x, point.x - x, a, b], [z, point.z - z, c, d]]) {
      if (Math.abs(dir) < 1e-6) {
        if (from < min || from > max) {
          hi = -1;
          break;
        }
      } else {
        const one = (min - from) / dir, two = (max - from) / dir;
        lo = Math.max(lo, Math.min(one, two));
        hi = Math.min(hi, Math.max(one, two));
      }
    }
    if (hi > lo && lo < .94 && hi > .03) return false;
  }
  return true;
}
function isLow(){return crouched;}
function move(dt) {
  // handNav is zero unless hand tracking is turning the view, so the keys and the touch stick behave exactly as before.
  let f = (+keys.has('KeyW') - Number(keys.has('KeyS'))) - stickY + pad.f,
    r = (+keys.has('KeyD') - Number(keys.has('KeyA'))) + stickX + pad.r;
  yaw += (+keys.has('ArrowLeft') - Number(keys.has('ArrowRight'))) * dt * (comfort ? 1.15 : 1.8) + (handNav.yaw + pad.yaw) * dt;
  pitch = clamp(pitch + (+keys.has('ArrowUp') - Number(keys.has('ArrowDown'))) * dt * 1.30 + (handNav.pitch + pad.pitch) * dt, -1.30, 1.35);
  const length = Math.hypot(f, r);
  moving = length > .035;
  if (length > 1) {
    f /= length;
    r /= length;
  }
  const low=isLow();
  const speed = (low ? 1.15 : keys.has('ShiftLeft') || keys.has('ShiftRight') || pad.run ? 3.40 : 2.23) *
    (state.soles ? 1.25 : 1);
  const dx = (-Math.sin(yaw) * f + Math.cos(yaw) * r) * dt * speed,
    dz = (-Math.cos(yaw) * f - Math.sin(yaw) * r) * dt * speed;
  if (!solid(camera.position.x + dx, camera.position.z)) camera.position.x += dx;
  if (!solid(camera.position.x, camera.position.z + dz)) camera.position.z += dz;
  if (moving) {
    walkTime += dt * speed * 6.68;   // one bob per footstep
    footTime += dt * speed;
    if (footTime > .94) {
      footTime = 0;
      audio.cue('step');
    }
  }
  // View bobbing: the head dips with each footstep and rolls a little from foot to foot, more when running.
  // It eases in and out, is gentler in Veteran mode and off under reduced motion.
  bobAmount += ((moving && !reduced ? (comfort ? .4 : 1) * (low ? .5 : speed > 3 ? 1.35 : 1) : 0) - bobAmount) * (1 - Math.exp(-dt * 9));
  const eye = (low ? .86 : 1.65) - Math.cos(walkTime) * .042 * bobAmount;   // lowest as the foot lands
  camera.position.y += (eye - camera.position.y) * (1 - Math.exp(-dt * 16));
  camera.rotation.set(pitch + Math.cos(walkTime) * .004 * bobAmount, yaw, Math.sin(walkTime / 2) * .011 * bobAmount, 'YXZ');
  camera.updateMatrixWorld();
}
function inReach(id) {
  const p = locations[id];
  return Math.hypot(camera.position.x - p.x, camera.position.z - p.z) < (id === 'board' ? 2.35 : 1.78) * (comfort ? 1.45 : 1) &&
    Math.abs(camera.position.y - p.y) < 1.85 && hasClearPath(p);
}
function updateTargets(){focus=null;let best=comfort?.82:.917;camera.getWorldDirection(forward);const current=mainTarget();const ml=$('markerLayer');
  const extras=state.stage==='memory'&&state.powder>0?cases[state.caseIndex].tasks.filter(id=>leads[id].shift==='night'&&!state.found.includes(id)&&!shownTargets.includes(id)):[];
  for(const el of ml.querySelectorAll('.extra'))if(!extras.includes(el.dataset.station))el.remove();
  for(const id of extras)if(!ml.querySelector(`[data-station="${id}"]`)){const el=document.createElement('div');el.className='world-mark extra trace beacon';el.dataset.station=id;el.innerHTML='<i></i><span>Chalk trace</span>';ml.append(el);}
  for(const m of ml.children){const id=m.dataset.station,point=locations[id];const aim=forward.dot(delta.copy(point).sub(camera.position).normalize());const available=shownTargets.includes(id);if(available&&aim>best&&inReach(id)){best=aim;focus=id;}projected.copy(point).project(camera);m.hidden=aim<=0||projected.z>1||Math.abs(projected.x)>.96||Math.abs(projected.y)>.88;m.classList.toggle('primary',id===current);m.classList.toggle('beacon',!!state.powder&&leads[id]?.shift==='night');if(!m.hidden){m.style.left=(50+projected.x*50)+'%';m.style.top=(50-projected.y*50)+'%';m.querySelector('span').hidden=id!==current&&!m.classList.contains('extra')&&aim<.97;}}
  // Searchable props: the nearest one under the reticle can be focused when no lead is.
  if(!focus&&state.stage!=='contract'){let bestC=.93;for(const [id,p] of Object.entries(curioAt)){if(curios[id].night&&dayShift())continue;if(Math.hypot(camera.position.x-p.x,camera.position.z-p.z)>1.7||Math.abs(camera.position.y-p.y)>1.85)continue;const aim=forward.dot(delta.copy(p).sub(camera.position).normalize());if(aim>bestC&&hasClearPath(p)){bestC=aim;focus='curio:'+id;}}}
  if(!focus&&!stealth.held()){const tid=stealth.throwableInView(camera,1.9);if(tid)focus='throw:'+tid;}
  pointTo(current);
  $('reticle').classList.toggle('over',!!focus);$('prompt').hidden=!focus||!!modal||!!inspect;$('prompt').dataset.target=focus||'';if(focus)$('prompt').lastElementChild.textContent=state.stage==='strip'?`Hold to peel the tint (${Math.round(state.strip*100)}%)`:focus==='street'?`Hold to pound on the glass (${state.pounds} of 3)`:focus==='rest'?`Wait until ${isNight(state.solarTime)?'daylight':'nightfall'}`:focus.startsWith('curio:')?curios[focus.slice(6)].verb+(state.awards.includes(focus)?'':` (+${curios[focus.slice(6)].points||25})`):focus.startsWith('throw:')?'Pick it up':verbs[focus];$('prompt').classList.toggle('curio',!!focus&&focus.startsWith('curio:'));}
// A screen-edge arrow points at the current lead whenever it is off screen or behind the player.
const camSpace=new THREE.Vector3();
function pointTo(id){const el=$('pointer');const p=id&&locations[id];if(!p||modal||inspect||cine){if(arrowShown){el.hidden=true;arrowShown=false;}return;}
  projected.copy(p).project(camera);camSpace.copy(p).applyMatrix4(camera.matrixWorldInverse);
  const onScreen=camSpace.z<0&&Math.abs(projected.x)<.94&&Math.abs(projected.y)<.86;const dist=Math.hypot(p.x-camera.position.x,p.z-camera.position.z);
  if(onScreen){if(arrowShown){el.hidden=true;arrowShown=false;}return;}
  let dx=camSpace.x,dy=camSpace.y;
  // Behind the camera the useful cue is which way to turn, so the arrow rides the lower corners.
  if(camSpace.z>0){dx=Math.abs(dx)<.05?(dx<0?-1:1):dx;dy=-Math.abs(dx)*.55;}
  const len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;
  const top=Math.min(170,innerHeight*.24),bottom=Math.min(205,innerHeight*.27),cy=(top+innerHeight-bottom)/2;
  const w=innerWidth/2-48,h=(innerHeight-top-bottom)/2,k=Math.min(w/Math.max(1e-4,Math.abs(dx)),h/Math.max(1e-4,Math.abs(dy)));
  el.style.transform=`translate(${innerWidth/2+dx*k}px,${cy-dy*k}px)`;el.querySelector('.arrow').style.transform=`rotate(${Math.atan2(-dy,dx)}rad)`;
  el.querySelector('b').textContent=dist.toFixed(1)+' m';el.classList.toggle('behind',camSpace.z>0);
  if(!arrowShown){el.hidden=false;arrowShown=true;}}

function clearAlert(){tenseT=0;pulse=0;audio.tension(false);guardMeter=0;alertState='';fxGuardTarget=0;$('danger').hidden=true;$('gaze').style.opacity='0';$('game').dataset.threat='clear';}
function showAlert(level,amount){const visible=level!=='away';$('danger').hidden=!visible;$('game').dataset.threat=level==='away'?'clear':level;const text={approach:['Footsteps','Get below the glass.'],search:['He’s looking in',''],watched:['He can see you','Crouch!'],warn:['He’s turning your way','Step back behind cover.'],patrol:['A guard is patrolling','Stay behind cover. Throw something to distract him.'],evading:['Out of sight',''],depart:['He’s leaving','']};
  if(level!==alertState){if(visible&&(alertState===''||alertState==='away'))restartAnim($('danger'));if(visible){$('dangerText').textContent=text[level][0];$('dangerHint').textContent=text[level][1];if(level==='watched'){if(tenseT<=0)audio.cue('gaze');$('sr').textContent='The guard can see you. Crouch or break sight.';}else if(level==='approach')audio.cue('keys');}alertState=level;}
  if(level==='watched')tenseT=7;
  pulse=Math.max(pulse,level==='watched'?.6+.4*amount:level==='warn'?.35+.4*amount:level==='evading'?.3+.3*amount:level==='search'?.32:level==='approach'?.2:0);
  $('danger').dataset.level=level;$('danger').querySelector('em').style.width=Math.round(amount*100)+'%';$('gaze').style.opacity=String(level==='watched'?.18+amount*.5:level==='evading'?amount*.3:0);fxGuardTarget=level==='watched'?.35+amount*.65:level==='evading'?amount*.4:0;}
function driveMemory(dt){const before=isNight(state.solarTime),lead=untilShift(state.solarTime);passTime(state,dt);
  // The day/night sting starts 2.5 s before the light changes.
  if(lead>2.5&&untilShift(state.solarTime)<=2.5)audio.clip('daynight');if(isNight(state.solarTime)!==before){updateHud();audio.cue('shift');persist();}updateClock();state.powder=Math.max(0,state.powder-dt);state.guardTime+=dt;patrol=patrolAt(state.guardTime,state.caseIndex);const range=patrolRange(isNight(state.solarTime),state.soles),dx=guardWindow.x-eyeAt().x,dz=eyeAt().z-guardWindow.z;
  const exposed=roomOf(eyeAt().z)===1&&!isLow()&&inSearchBeam(dx,dz,patrol,range)&&hasClearPath(guardWindow)&&invulnerable<=0;
  // Veteran mode: a 2.5 s grace window (yellow edge, heartbeat) before the door guard's meter starts to fill.
  doorGrace=exposed?(comfort?doorGrace+dt:2.5):0;
  if(patrol.phase!=='away'){const beat=Math.floor(state.guardTime/(patrol.phase==='search'?1.2:.78));if(beat!==guardBeat){guardBeat=beat;audio.cue('guard');}}
  guardMeter=clamp(guardMeter+(exposed&&doorGrace>=2.5?dt/2.5*(1+.3*(state.alarm||0)):-dt*.58),0,1);
  if(roomOf(eyeAt().z)!==1)return;
  const level=exposed?(doorGrace<2.5?'warn':'watched'):guardMeter>.02?'evading':patrol.phase;if(!roamerHot)showAlert(level,level==='warn'?doorGrace/2.5:guardMeter);   // a roaming guard who has noticed you owns the banner (driveStealth)
  if(guardMeter>=1){damage('guard');if(state.stage==='memory')showAlert('evading',0);}}
// Roaming guards in the lab and dispatch office: active once their room is part of the story.
const stealthStages=['memory','gate','glass','radio','verify','recoverKey','closet','board','lock'];
let stealthKey='';
function driveStealth(dt){
  const active=stealthStages.includes(state.stage)&&!inspect,room2=active&&state.caseIndex>=1,room3=active&&state.caseIndex>=2,eye=eyeAt();
  // Standard game, Mateo's nights and days: now and then the corridor door opens and a guard walks the lobby,
  // then leaves the way he came. No room stays safe.
  if(state.stage==='memory'&&!comfort&&!inspect){
    if(!lobbyOn&&(lobbyClock-=dt)<=0){lobbyOn=true;lobbyFor=0;audio.cue('latch');audio.cue('keys');if(roomOf(eye.z)===1)notify('Corridor door','A guard is coming in.',2.6);}
    else if(lobbyOn){lobbyFor+=dt;const g=stealth.guardAt('room1');if(lobbyFor>14&&g&&g.mode!=='chase'&&g.mode!=='search'&&Math.hypot(g.x-3.75,g.z-.1)<.5){lobbyOn=false;lobbyClock=45+Math.random()*40;audio.cue('latch');}}
  }else if(lobbyOn){lobbyOn=false;lobbyClock=30+Math.random()*30;}
  const key=lobbyOn+'/'+room2+'/'+room3;
  if(key!==stealthKey){stealthKey=key;stealth.setActive({room1:lobbyOn,room2,room3});}
  jamTime=Math.max(0,jamTime-dt);jamCool=Math.max(0,jamCool-dt);
  // Spotted: the chase music starts at once, loud, and runs until the guard has not seen you for seven seconds.
  tenseT=Math.max(0,tenseT-dt);audio.tension(tenseT>0);
  // The detective works to jazz; it drops out for Mateo's memories and while a guard is after you.
  audio.jazz(character()==='Detective'&&state.stage!=='end'&&tenseT<=0);
  // Heartbeat: `pulse` (0..1) is how much danger you are in. It beats faster and louder as a guard nears, notices and closes in.
  if(tenseT>0)pulse=Math.max(pulse,.55);
  if(pulse>.06&&time>heartbeatAt){heartbeatAt=time+1.05-.68*pulse;if(!audio.play('heartbeat',.45+2.3*pulse))audio.sfx('heartbeat');}
  pulse=Math.max(0,pulse-dt*1.2);
  // How far your footsteps carry: nothing while still or crouched, a little when walking, a lot when running (crepe soles halve it).
  const stepped=Math.hypot(eye.x-lastEye.x,eye.z-lastEye.z),pace=dt>0&&stepped<.5?stepped/dt:0;lastEye.x=eye.x;lastEye.z=eye.z;   // a jump (loading, a cutscene) is not a footstep
  const noise=isLow()||pace<.6?0:(pace>2.8?4.5:1.7)*(state.soles?.5:1);
  const r=stealth.update(dt,{player:eye,crouched:isLow(),night:isNight(worldTime()),soles:state.soles,jammed:jamTime>0,veteran:comfort,camera,alarm:state.alarm||0,noise});
  // Footsteps carry through the walls: louder as he nears, quicker when he is hunting.
  if(active||lobbyOn)pulse=Math.max(pulse,clamp(1-r.nearestDist/6,0,1)*.45);   // a guard close by, even one who has not noticed you
  if((active||lobbyOn)&&r.nearestDist<7&&(stepClock-=dt)<=0){stepClock=r.level==='search'||r.level==='watched'?.32:.55;audio.footstep(clamp(1-r.nearestDist/7,0,1));}
  if(roomOf(eye.z)===1){ // in the lobby the corridor guard owns the warning, unless the lobby guard is on to you
    roamerHot=(lobbyOn||active)&&(r.level==='watched'||r.level==='warn');
    if(roamerHot){showAlert(r.level,r.amount);if(r.level==='watched'&&r.amount>=1&&invulnerable<=0)damage('guard');}
    return;}
  roamerHot=false;
  if(!active)return;
  showAlert(r.level==='clear'?'away':r.level,r.amount);
  if(r.level==='watched'&&r.amount>=1&&invulnerable<=0)damage('guard');
}
let lobbyOn=false,lobbyClock=35,lobbyFor=0,roamerHot=false;
let stepClock=0,noiseAt=0;const lastEye={x:0,z:0};
// A loud puzzle (breaking glass, a stamp, a scraping drawer) brings the nearest guard to where you stand.
const LOUD=new Set(['shatter','crack','kachunk','crunch','screech','thud','stamp']);
function puzzleSound(name,amount){audio.sfx(name,amount);if(comfort||!LOUD.has(name)||!stealth.distract(eyeAt(),5))return;if(time>noiseAt){noiseAt=time+6;$('handsSay').textContent='The noise carries. Someone is coming.';}}
function showHeld(kind){const el=$('held');if(!kind){el.hidden=true;return;}el.hidden=false;el.querySelector('b').textContent=THROWN[kind].name;}
function back() {
  if (['contract', 'end', 'gameOver', 'accountSave', 'quiz'].includes(modal)) return;
  if(modal==='dossier'||modal==='debrief'||modal==='results'){ending();return;}
  if(modal==='legal'){accountPage();return;}
  if(modal==='legalDelete'){legalPage('privacy');return;}
  if(modal==='journal'&&journalOrigin==='pause'){journalOrigin='';closeModal();pause();return;}
  if (modal === 'controls' && pausedOrigin === 'pause') {
    pausedOrigin = '';
    closeModal();
    pause();
    return;
  }
  if (modal === 'boardCard') {
    board();
    return;
  }
  if (modal === 'journalCard') {
    journal();
    return;
  }
  closeModal();
  if (started) capture();
  else $('begin').focus();
}
function dialogAction(action, button) {
  audio.gesture();
  const id = Number(button.dataset.id);
  switch (action) {
    case 'back':
      back();
      break;
    case 'hand-toggle':setSpatial(inputMode!=='spatial').then(()=>{if(modal==='pause'&&!guide)repause(action);});break;
    case 'hand-speed':handSpeed=(handSpeed+1)%HAND_SPEEDS.length;putStored('redacted-donor.hands.speed',HAND_SPEEDS[handSpeed][0]);repause(action);break;
    // Smooth: the camera is read in the background (it falls back by itself where that is slower). Classic: on the game's own thread, as at first.
    case 'hand-engine':spatial.engine=spatial.engine==='main'?'auto':'main';spatial.stop();spatial.start().then(()=>{if(modal==='pause')repause(action);},(e)=>{setSpatial(false);spatialNote(e.message);if(modal==='pause')repause(action);});break;
    case 'hand-camera':nextCamera().then(()=>{if(modal==='pause')repause(action);});break;
    case 'hand-setup':startCalibration();break;
    case 'hand-tutorial':startTutorial();break;
    case 'file-score':fileScore();break;
    case 'acct-tab':acctKind=button.dataset.k;accountPage();break;
    case 'quiz-pick':quizPick(Number(button.dataset.k));break;
    case 'quiz-skip':quizRun=null;state.quiz={pre:null};persist();closeModal();contract();break;
    case 'debrief':debriefPage();break;
    case 'debrief-tab':debriefTab=id;debriefPage();break;
    case 'debrief-card':if(debriefSeen.has(debriefTab+':'+id))break;debriefSeen.add(debriefTab+':'+id);debriefPage(id);$('panelBody').querySelector(`.debrief-card[data-id="${id}"]`)?.focus({preventScroll:true});break;
    case 'quiz-post':quizRun=null;quizPage('post');break;
    case 'legal':legalPage(button.dataset.doc);break;
    case 'legal-back':accountPage();break;
    case 'delete-ask':deleteAsk();break;
    case 'delete-go':deleteGo();break;
    case 'save-transfer':resolveSave(true);break;
    case 'save-delete':resolveSave(false);break;
    case 'acct-in':accountSubmit(false);break;
    case 'acct-up':accountSubmit(true);break;
    case 'acct-out':cloud.logOut().then(()=>{accountLabel();accountPage();});break;
    case 'board-tab':boardVeteran=button.dataset.v==='1';records();break;
    case 'load-code':loadCode();break;
    case 'cloud-sync':cloud.setSync(!cloud.syncOn());if(cloud.syncOn())persist();repause(action);break;
    case 'pause-journal':journalOrigin='pause';journal();break;
    case 'comfort':setComfort(!comfort);updateHud();repause(action);break;
    case 'auto-codes':autoCodes=!autoCodes;putStored('redacted-donor.autocodes',autoCodes?'on':'off');repause(action);break;
    case 'track':tracked=button.dataset.lead;journalOrigin='';closeModal();updateHud();capture();break;
    case 'work-submit':checkWork();break;
    case 'work-ticket':if(work){adjust(work,'ticket',button.dataset.ticket);paintWork(work);}break;
    case 'work-adjust':if(work){const axis=button.dataset.axis,v=Number(button.dataset.step);adjust(work,axis,axis==='dial'?work.frequency+v:v);paintWork(work);if(axis==='dial')audio.cue('tune');}break;
    case 'open-dossier':dossierTab=0;endDossier();break;
    case 'controls':
      pausedOrigin = modal === 'pause' ? 'pause' : '';
      controls();
      break;
    case 'sound':
      toggleSound();
      repause(action);
      break;
    case 'title':
      title();
      break;
    case 'restart':
      enterGame(false);
      break;
    case 'demand':
    case 'work':
      state.confiscated = action === 'demand';
      state.beat = 1;
      audio.cue('latch');
      persist();
      contract();
      break;
    case 'nib':
    case 'refuse':
      state.coercion = action === 'nib' ? 'nib' : 'refused';
      if (action === 'nib') grant(state, 'nib', 25);
      state.beat = 2;
      scoreHUD();
      audio.cue('latch');
      persist();
      contract();
      break;
    case 'stand':
      closeModal();
      state.stage = 'street';persist();
      // The two men walk out through the staff door, then the lock clicks.
      leaveT=0;props.leave(0);
      cutscene({at:new THREE.Vector3(2.4,1.35,-.1),from:[-.9,2.15,2.5],push:.04,kicker:'The intake office',title:'They leave you there',line:'Two sets of footsteps. Then the lock.',hold:2.9,mode:'cut',cue:'step',then(){leaveT=-1;props.leave(null);
      cutscene({at:guardWindow,from:[.4,1.5,2.2],push:.1,kicker:'The intake office',title:'The lock clicks',line:'The only way out is the window.',fx:'neg',shake:true,hold:2.2,mode:'ink',cue:'latch',then(){
        spawnForStage();chapter('Mateo / Aegis intake', 'The Blind Street');notify('Mateo', 'Walk with WASD. Hold E at the window.', 4);updateHud();persist();}});}});
      break;
    case 'buy':
      if (buy(state, button.dataset.id)) {
        audio.sfx('select');
        modalMessage = `${supplies.find((v) => v.id === button.dataset.id).name} used.`;
        updateHud();
        persist();
      }
      kit();
      break;
    case 'wheel': {
      const i = Number(button.dataset.wheel);
      lockDigits[i] = (lockDigits[i] + Number(button.dataset.delta) + 10) % 10;
      lockCursor = i;
      audio.cue('latch');
      inputLock();
      break;
    }
    case 'unlock':
      doUnlock();
      break;
    case 'pin':
      selectPin(id, button.dataset.side);
      break;
    case 'next-file':
      nextFile();
      break;
    case 'board-card':
      actionCard(id, 'board');
      break;
    case 'action-card':
      actionCard(id, 'journal');
      break;
    case 'dossier':
      dossierTab = id;
      endDossier();
      break;
    case 'revive':
      revive(state);calmGuards();spawnForStage();props.setCase(state.caseIndex);tracked='';updateHud();persist();closeModal();
      notify('Detective', 'The current file has been reopened at the desk.');
      capture();
      break;
  }
}
// Menu buttons answer with a tick on hover and a click on press.
{let hovered=null;const menuBtn=(t)=>t.closest?.('#overlay button, #title button, #title a');
document.addEventListener('pointerover',(e)=>{const b=menuBtn(e.target);if(b&&b!==hovered&&!b.disabled)audio.sfx('ui-hover');hovered=b;});
document.addEventListener('pointerdown',(e)=>{const b=menuBtn(e.target);if(b&&!b.disabled)audio.sfx('ui-press');});}
$('panelBody').addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]');
  if (b && !b.disabled) dialogAction(b.dataset.action, b);
});
// Field-work inputs: the receiver dial and the draggable carbon sheet.
$('panelBody').addEventListener('input',(e)=>{if(e.target.id!=='tuner'||!work)return;adjust(work,'dial',Number(e.target.value));paintWork(work);if(solved(work))audio.cue('clue');});
$('panelBody').addEventListener('pointerdown',(e)=>{const svg=e.target.closest('#carbonTable');if(!svg||!work||work.id!=='registration')return;e.preventDefault();svg.setPointerCapture?.(e.pointerId);const box=svg.getBoundingClientRect(),scale=364/box.width;workDrag={id:e.pointerId,x:e.clientX,y:e.clientY,scale};svg.classList.add('dragging');});
$('panelBody').addEventListener('pointermove',(e)=>{if(!workDrag||e.pointerId!==workDrag.id||!work)return;const dx=(e.clientX-workDrag.x)*workDrag.scale,dy=(e.clientY-workDrag.y)*workDrag.scale;workDrag.x=e.clientX;workDrag.y=e.clientY;adjust(work,'x',dx);adjust(work,'y',dy);paintWork(work);});
const endWorkDrag=(e)=>{if(!workDrag||e.pointerId!==workDrag.id)return;workDrag=null;document.getElementById('carbonTable')?.classList.remove('dragging');if(work?.id==='registration'&&solved(work))audio.cue('latch');};
$('panelBody').addEventListener('pointerup',endWorkDrag);$('panelBody').addEventListener('pointercancel',endWorkDrag);
$('begin').onclick = () => enterGame(!!stored);
$('handsBack').onclick = () => back();
for (const b of document.querySelectorAll('.spatial-toggle')) b.onclick = () => setSpatial(inputMode !== 'spatial');
$('spatialCam').onclick = nextCamera; $('spatialCal').onclick = startCalibration; $('spatialTut').onclick = startTutorial; $('spatialSkip').onclick = skipGuide;
// Scripted hands for automated tests (tools/spatial-browser.test.mjs): feed landmarks, read where the player and the guide are.
if (new URLSearchParams(location.search).has('spatialtest')) Object.assign(window, { __spatial: spatial, __cam: () => [camera.position.x, camera.position.z, yaw, pitch], __board: (x, y) => hands.screenAt(x, y), __limbs: () => hands.limbs, __audio: audio, __info: () => ({ ...renderer.info, scale: pace.scale }), __guards: () => ['room1', 'room2', 'room3'].map((k) => stealth.guardAt(k)), __open: (kind, opts) => openHands(kind, opts, 'Test', camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize()).setY(1.1), () => {}),
  __guide: () => guide && { cal: !!guide.cal, tut: !!guide.tut, i: guide.i, wait: guide.wait, target: guide.target?.toArray() } });
$('panelBody').addEventListener('input', (e) => { if (e.target.classList?.contains('bad')) for (const f of $('panelBody').querySelectorAll('.bad')) f.classList.remove('bad', 'run'); });
$('handsVet').addEventListener('click', (e) => { const b = e.target.closest('[data-hands]'); if (b && b.dataset.hands !== 'hold') handsButtons[+b.dataset.hands]?.[1](); });
for (const [type, on] of [['pointerdown', true], ['pointerup', false], ['pointerleave', false], ['pointercancel', false]]) $('handsVet').addEventListener(type, (e) => { if (e.target.closest('[data-hands=hold]')) hands.setHeld(on); });
$('handsVet').addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && e.target.closest('[data-hands=hold]')) { e.preventDefault(); hands.setHeld(true); } });
$('handsVet').addEventListener('keyup', (e) => { if (e.target.closest('[data-hands=hold]')) hands.setHeld(false); });
$('records').onclick = () => records();
$('account').onclick = () => accountPage();
$('newGame').onclick = () =>
  panel(
    'restart',
    '',
    'Start a new investigation?',
    `<p>Your saved progress on this device will be replaced.</p><div class="panel-actions">${
      htmlButton('restart', 'Start over', 'gold-btn')
    }${htmlButton('back', 'Keep current case')}</div>`,
  );
$('titleSound').onclick = toggleSound;
$('controls').onclick = () => {
  pausedOrigin = '';
  controls();
};
$('hudKit').onclick = kit;
$('hudJournal').onclick=()=>{journalOrigin='';journal();};
$('hudPause').onclick = pause;
$('turnLeft').onclick = () => {
  if (inspect) inspect.angle -= .26;
};
$('turnRight').onclick = () => {
  if (inspect) inspect.angle += .26;
};
$('turnOver').onclick = () => {
  if (inspect) inspect.angle += Math.PI;
};
$('leaveInspect').onclick = () => leaveInspection();
function look(dx, dy) {
  if (!modeActive()) return;
  if (inspect) {
    inspect.angle += dx * .012;
    inspect.tilt = clamp(inspect.tilt + dy * .009, -.85, .85);
  } else {
    const sens = comfort ? .6 : 1;
    yaw -= dx * .0029 * sens; dy *= sens;
    pitch = clamp(pitch - dy * .0025, -1.30, 1.35);
  }
}
window.gameMouseDelta = (dx, dy) => look(dx, dy);
canvas.addEventListener('pointerdown', (e) => {
  if (!modeActive() || e.button !== 0) return;
  audio.gesture();
  canvas.focus();
  lookDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, dist: 0 };
  if (document.pointerLockElement !== canvas) {
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
  }
  if (state.stage === 'street' && focus === 'street') heldUse = true;
  // Holding a throwable and not aiming at anything: hold to aim, release to throw.
  if (stealth.held() && !focus) { aiming = { power: 0 }; }
});
window.addEventListener('pointermove', (e) => {
  if (document.pointerLockElement === canvas) {
    look(e.movementX, e.movementY);
    return;
  }
  if (!lookDrag || e.pointerId !== lookDrag.id) return;
  const dx = e.clientX - lookDrag.lastX, dy = e.clientY - lookDrag.lastY;
  lookDrag.dist += Math.abs(dx) + Math.abs(dy);
  lookDrag.lastX = e.clientX;
  lookDrag.lastY = e.clientY;
  look(dx, dy);
});
window.addEventListener('pointerup', (e) => {
  const d = lookDrag;
  lookDrag = null;
  heldUse = false;
  if (aiming) { stealth.release(camera, aiming.power); stealth.stopAim(); aiming = null; audio.sfx('whoosh'); showHeld(null); return; }
  if (!d || d.id !== e.pointerId || !modeActive() || inspect) return;
  if (d.dist < 7) {
    interact();
    if (!modal && !inspect) capture();
  }
});
window.addEventListener('pointercancel', () => {
  lookDrag = null;
  heldUse = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
const stick = $('stick');
let stickId = null;
function steer(e) {
  const r = stick.getBoundingClientRect();
  let x = (e.clientX - r.left - r.width / 2) / 30, y = (e.clientY - r.top - r.height / 2) / 30;
  const l = Math.max(1, Math.hypot(x, y));
  stickX = x / l;
  stickY = y / l;
  stick.firstElementChild.style.transform = `translate(${stickX * 21}px,${stickY * 21}px)`;
}
stick.onpointerdown = (e) => {
  stickId = e.pointerId;
  stick.setPointerCapture(e.pointerId);
  steer(e);
};
stick.onpointermove = (e) => {
  if (stickId === e.pointerId) steer(e);
};
stick.onlostpointercapture = () => {
  stickId = null;
  stickX = stickY = 0;
  stick.firstElementChild.style.transform = '';
};
$('touchCrouch').onclick = () => crouched = !crouched;
$('touchUse').onpointerdown = (e) => {
  e.currentTarget.setPointerCapture(e.pointerId);
  heldUse = true;
  interact();
};
$('touchUse').onlostpointercapture = () => heldUse = false;
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.altKey || e.ctrlKey && e.code !== 'ControlLeft' && e.code !== 'ControlRight') return;
  const k = e.code;
  // Typing in a field: Enter submits that form, every other key stays in the box.
  if (e.target?.tagName === 'INPUT') {
    if (k === 'Enter' || k === 'NumpadEnter') { e.preventDefault(); const id = e.target.id; if (id === 'recordName') fileScore(); else if (id === 'transferCode') loadCode(); else if (id === 'acctLogin' || id === 'acctPass') accountSubmit(false); }
    else if (k === 'Escape') e.target.blur();
    return;
  }
  // H turns hand tracking on or off wherever you are: the title screen, a menu, a puzzle, a cutscene or the room.
  if (k === 'KeyH') { e.preventDefault(); if (!e.repeat) setSpatial(inputMode !== 'spatial').then(() => { if (modal === 'pause' && !guide) repause('hand-toggle'); }); return; }
  if (guide) { if (k === 'Escape' && !e.repeat) { e.preventDefault(); skipGuide(); } return; }   // hand setup or tutorial: Esc skips, nothing else leaks into the game
  if (cine) {
    if (['Escape', 'Space', 'Enter', 'KeyE'].includes(k) && !e.repeat) { e.preventDefault(); skipCine(); }
    return;
  }
  if (modal) {
    if (
      k === 'Escape' || (modal === 'kit' && ['KeyB', 'Tab'].includes(k)) ||
      (modal === 'journal' && k === 'KeyJ')
    ) {
      e.preventDefault();
      if (!e.repeat) back();
      return;
    }
    if (modal === 'lock' && !e.repeat) {
      if (/^Digit[0-9]$/.test(k) || /^Numpad[0-9]$/.test(k)) {
        e.preventDefault();
        lockDigits[lockCursor] = Number(k.at(-1));
        lockCursor = (lockCursor + 1) % 3;
        audio.cue('latch');
        inputLock();
      } else if (k === 'Enter' || k === 'NumpadEnter') {
        e.preventDefault();
        doUnlock();
      }
      return;
    }
    if (modal === 'contract' && ['Digit1', 'Digit2'].includes(k) && !e.repeat) {
      e.preventDefault();
      $('panel').querySelectorAll('.choice')[k === 'Digit1' ? 0 : 1]?.click();
    }
    return;
  }
  if (!started) {
    if (k === 'Enter' && !e.repeat && document.activeElement?.tagName !== 'BUTTON') {
      e.preventDefault();
      enterGame(!!stored);
    }
    return;
  }
  // Every key in play is the game's. A key the page leaves unhandled goes back to macOS, which answers with the alert
  // sound on each repeat of a held W. Function keys and Enter (a focused button) keep their normal job.
  if (!/^F\d+$/.test(k) && k !== 'Enter' && k !== 'NumpadEnter') e.preventDefault();
  if (e.repeat) return;
  keys.add(k);
  if (inspect) {
    if(k==='KeyP'){pause();return;}
    if (k === 'Escape') leaveInspection();
    if (k === 'KeyF') inspect.angle += Math.PI;
    return;
  }
  if (k === 'Escape' || k === 'KeyP') {
    pause();
    return;
  }
  if ((k === 'KeyB' || k === 'Tab') && state.hasWatch) {
    modalMessage = '';
    kit();
    return;
  }
  if (k === 'KeyJ') {
    journalOrigin='';journal();
    return;
  }
  if (k === 'KeyC') crouched = !crouched;
  if (k === 'KeyE' || k === 'Space') {
    heldUse = true;
    interact();
  }
  if (k === 'KeyG' && stealth.held()) aiming = { power: 0 };
  // Watch overdrive: jams the guards' radios for 8 seconds, then recharges. It works for Mateo and for the detective;
  // in Mateo's memories it also flips day and night.
  if (k === 'KeyO' && !e.repeat && state.overdrive && stealthStages.includes(state.stage)) {
    if (jamCool > 0) { audio.cue('latch'); notify('Watch overdrive', `Still recharging: ${Math.ceil(jamCool)} seconds.`, 2.2); }
    else {
      const memory = state.stage === 'memory'; jamTime = 8; jamCool = JAM_COOLDOWN;
      if (memory) { audio.clip('daynight'); waitForShift(state); state.guardTime = 0; }
      audio.cue('shift'); notify('Watch overdrive', (memory ? (isNight(state.solarTime) ? 'Night falls. ' : 'Morning. ') : '') + `Guard radios jammed for 8 seconds. Recharges in ${JAM_COOLDOWN}.`, 3.5); updateHud(); persist();
    }
  }
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'KeyN' && pendingCode && !e.repeat) { const [label, code] = CODES[pendingCode]; saveCode(pendingCode); notify('Field journal', `Saved: ${label}, ${code}.`, 3); return; }
  if (e.code === 'KeyG' && aiming) { stealth.release(camera, aiming.power); stealth.stopAim(); aiming = null; audio.sfx('whoosh'); showHeld(null); }
  if (e.code === 'KeyE' || e.code === 'Space') heldUse = false;
});
function interrupted() {
  dropKeys();
  if (started && !modal && !inspect && state.stage !== 'end') pause();
  else persist();
}
window.addEventListener('blur', interrupted);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    interrupted();
    audio.setActive(false);
  } else {
    previous = 0;
    audio.setActive(true);
  }
});
window.addEventListener('pagehide', persist);
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) return;
  const real = previous ? Math.min(.20, (now - previous) / 1000) : 0;
  if (started) keepPace(real);
  previous = now;
  if (inputMode === 'spatial' && renderer) driveSpatial(now);
  drivePad(now);
  if (guide?.tut) { tutorialFrame(real); return; }
  // In the standard game the clinic keeps running while a puzzle is open: guards patrol, the clock turns.
  const handsLive = modal === 'hands' && !comfort && started && !cine;
  const dt = modeActive() || handsLive ? real : 0;
  state.dt = cine ? real : dt;
  time += dt;
  if (dt && state.stats) state.stats.seconds += dt;
  if (!started || !renderer) return;
  if (cine) updateCine(real);
  if (dt && RESCUE_STAGES.includes(state.stage)) { state.rescueLeft = (state.rescueLeft ?? (comfort ? 480 : 240)) - dt; updateClock(); if (state.rescueLeft <= 0) rescueTimeout(); }
  if (hands.active) { hands.update(real); needsDraw = true; const ring = document.getElementById('handsRing'); if (ring) ring.style.width = Math.round(hands.holdProgress * 100) + '%'; }
  if (leaveT >= 0) { const before = leaveT; leaveT += real; props.leave(Math.min(1, leaveT / 2.7)); if (Math.floor(leaveT / .42) !== Math.floor(before / .42) && leaveT < 2.6) audio.cue('guard'); }
  const fxNow = sampleFx(real);
  renderer.setFx(fxNow.neg, fxNow.ink, fxNow.warp); renderer.setOverlay(hands.active);
  // The detective's present-day scenes are lit by the spotlight on the evidence board.
  detectiveBlend += ((DETECTIVE_STAGES.includes(state.stage) ? 1 : 0) - detectiveBlend) * (1 - Math.exp(-real * 2.5));
  renderer.setDetective(detectiveBlend);
  cineBlend += ((cine && $('game').dataset.cine === 'on' ? 1 : 0) - cineBlend) * (1 - Math.exp(-real * 4));
  const live = modeActive();
  if (live || handsLive) {
    if (captionTime > 0 && (captionTime -= dt) <= 0) $('caption').hidden = true;
    if (chapterTime > 0 && (chapterTime -= dt) <= 0) $('chapterCard').hidden = true;
    streetDelay = Math.max(0, streetDelay - dt);
    state.reaction = Math.max(0, (state.reaction || 0) - dt);
    invulnerable = Math.max(0, invulnerable - dt);
    if (hitTime > 0 && (hitTime -= dt) <= 0) $('flash').className = '';
    if (inspect) updateInspection(dt);
    else if (!['contract','end','gameOver'].includes(state.stage)) {
      if (live && stripShot) {
        exposure += dt;
        const p = locations.street;
        toward.copy(p).sub(camera.position);
        const a = Math.atan2(-toward.x, -toward.z);
        yaw += Math.atan2(Math.sin(a - yaw), Math.cos(a - yaw)) * (1 - Math.exp(-3 * dt));
        pitch += (Math.atan2(toward.y, Math.hypot(toward.x, toward.z)) - pitch) * (1 - Math.exp(-3 * dt));
        if (exposure > 1.3) stripShot = false;
      }
      if (live) move(Math.min(dt, .09));
      if(live&&shakeTime>0&&!reduced&&!comfort){shakeTime=Math.max(0,shakeTime-dt);const k=shakeTime*.05;camera.rotateZ((Math.random()-.5)*k);camera.position.y+=(Math.random()-.5)*k*.4;camera.updateMatrixWorld();}
      if (state.stage === 'memory') driveMemory(dt);
      else $('danger').hidden = true;
      driveStealth(dt);
      if (live && aiming) { aiming.power = Math.min(1, aiming.power + dt / 1.2); stealth.aim(camera, aiming.power); }
      if(!modal)updateTargets();
      if (heldUse && focus === 'street') {
        if (state.stage === 'street' && streetDelay <= 0) interact('street');
        else if (state.stage === 'strip') {
          state.strip = Math.min(1, state.strip + dt * .69);
          if (state.strip >= 1 && false) {
            heldUse = false;
            cutscene({at:locations.street,id:'street',dist:2.2,lift:.05,swing:0,kicker:'Dawn, 5:12 a.m.',title:'The street can see in',line:'Across the road, people stop and look in.',fx:'dawn',hold:3.2,mode:'cut',cue:'clue',then:ending});
          }
        }
      }
    }
    if ((saveTimer += dt) > 4) {
      persist();
      saveTimer = 0;
    }
  }
  const ease=1-Math.exp(-real*7);memoryBlend+=((state.stage==='memory'?1:0)-memoryBlend)*ease;const solar=worldTime(), sky=daylight(solar);props.setCase(state.caseIndex);props.animate(time,state,patrol,sky,solar,patrolRange(isNight(solar),state.soles),state.strip);annex.face(camera,state.stage==='memory'&&isNight(state.solarTime)&&state.caseIndex>=1);annex.haunt(camera,!dayShift(),state.awards.includes('uv:cellGlass'));
  if(live||cine||cineBlend>.002||fxAnim||fxGuard>.002||state.stage==='contract'||needsDraw){
    // Hand tracking, walking the rooms: shift the eye up to 1.6 cm sideways and 1 cm up or down for this frame's picture only,
    // so near things slide against far ones. Not in puzzles (the hand must land where it points), cutscenes, menus or Veteran mode.
    const sway=inputMode==='spatial'&&live&&!hands.active&&!cine&&!modal&&!inspect&&!comfort&&!reduced,k=1-Math.exp(-real*5);
    lean.x+=((sway?lean.tx:0)-lean.x)*k;lean.y+=((sway?lean.ty:0)-lean.y)*k;
    leanBy.set(lean.x*.032,-lean.y*.02,0).applyQuaternion(camera.quaternion);camera.position.add(leanBy);camera.updateMatrixWorld();
    renderer.render(time,memoryBlend,sky.sun,sky.altitude,solar/DAY_LENGTH*Math.PI*2,state.strip,cineBlend);needsDraw=false;
    camera.position.sub(leanBy);camera.updateMatrixWorld();}
}
let needsDraw = true;
// Adaptive resolution: full detail wherever the machine keeps up. If frames average slower than 26 ms for two seconds
// the picture is drawn a step smaller (down to 60%); if they are comfortably fast again it steps back up.
const pace = { scale: 1, avg: 16, t: 0 };
function keepPace(real) {
  if (real <= 0 || real > .15 || document.hidden || inputMode === 'spatial') return;   // a stall, a hidden tab or the camera model's own cost says nothing about drawing
  pace.avg += (real * 1000 - pace.avg) * .05; pace.t += real;
  if (pace.t < 2) return;
  pace.t = 0;
  const next = pace.avg > 26 ? Math.max(.6, pace.scale - .1) : pace.avg < 12.5 ? Math.min(1, pace.scale + .1) : pace.scale;
  if (next !== pace.scale) { pace.scale = next; resize(); }
}
function resize() {
  renderer?.resize(Math.max(1, innerWidth), Math.max(1, innerHeight), pace.scale);
  needsDraw = true;
  drawThread();
}
window.addEventListener('resize', resize);
try {
  renderer = createInkRenderer(canvas, scene, camera);
  renderer.setLift(comfort ? 1 : 0);
  resize();
  props.setCase(0);
  spawnForStage();
  props.animate(0,state,patrol,daylight(42),42,4,0);
  renderer.render(0,0,1,.7,0);
  $('game').dataset.ready = 'true';
  title();
  // A newer cloud copy of this player's save replaces the local one, then the outbox is retried.
  cloud.pullSave().then((data)=>{const run=data&&readRun(JSON.stringify(data));if(run&&!started&&(data.savedAt||0)>(stored?.savedAt||0)){putStored(storageKey,JSON.stringify(data));stored=run;title();}}).catch(()=>{}).finally(()=>cloud.flush());
  requestAnimationFrame(frame);
} catch (e) {
  console.error(e);
  $('bootError').hidden = false;
  $('bootError').textContent =
    'The 3D renderer could not start. Enable hardware acceleration or open the Mac game on a WebGL 2-capable Mac.';
  $('begin').disabled = true;
}
