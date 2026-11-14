// Hands-on puzzles as real 3D objects in the room. The camera moves in on the object, and the player
// grabs, drags, turns and strikes meshes with the mouse. Each puzzle is authored on a "board":
// x 0..560 right, y 0..320 down (millimetres), z = metres toward the viewer. Table puzzles lie flat
// (board normal up); wall puzzles stand upright facing the camera.
import * as THREE from 'three';
const W = 560, H = 320, S = .001, TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TABLE = new Set(['pile', 'rubbing', 'torn', 'torch', 'watch', 'align', 'tickets']), HIGH = new Set(['drawer', 'press', 'slot', 'shred']);
const mats = new Map();
const lit = (c) => { if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c })); return mats.get(c); };
const canvasOf = (w, h, k = 2) => { const c = document.createElement('canvas'); c.width = w * k; c.height = h * k; const x = c.getContext('2d'); x.scale(k, k); return [c, x]; };
function wrap(x, text, maxW) { const out = []; let line = ''; for (const word of String(text).split(/\s+/)) { const t = line ? line + ' ' + word : word; if (x.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t; } if (line) out.push(line); return out; }
// A typed paper: title, rule and lines.
function docCanvas(doc, w, h, bg = '#ece1c4') {
  const [c, x] = canvasOf(w, h, 3);
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = '#a99168'; x.lineWidth = 1.5; x.strokeRect(1, 1, w - 2, h - 2);
  x.fillStyle = '#2b2620'; x.font = '700 17px Rockwell, Georgia, serif'; x.fillText(doc.title || '', 16, 30);
  x.fillRect(14, 40, w - 28, 1.5);
  x.fillStyle = '#23305f'; x.font = '16px "American Typewriter", "Courier New", monospace';
  let y = 62; for (const l of doc.lines || []) for (const part of wrap(x, l, w - 32)) { x.fillText(part, 16, y); y += 24; }
  return c;
}
function labelCanvas(text, w, h, { bg = '#e9dfc5', fg = '#2b2620', font = '700 15px Rockwell, Georgia, serif' } = {}) {
  const [c, x] = canvasOf(w, h, 3); x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  String(text).split('\n').forEach((l, i, a) => x.fillText(l, w / 2, h / 2 + (i - (a.length - 1) / 2) * parseInt(font.match(/(\d+)px/)[1]) * 1.2)); return c;
}

export function createHands({ scene, camera, canvas, sfx = () => {} }) {
  let cur = null, drag = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();

  // Where the rig and the camera go for a puzzle at world point `at`, approached from `eye`.
  function pose(kind, at, eye, close = 1) {
    const n = new THREE.Vector3(eye.x - at.x, 0, eye.z - at.z); if (n.lengthSq() < 1e-4) n.set(0, 0, 1); n.normalize();
    const table = TABLE.has(kind), pos = at.clone().addScaledVector(n, table ? .05 : .14);
    if (table) pos.y = at.y + .06; else if (HIGH.has(kind)) pos.y = at.y + .12; // lifts the shelf under the puzzle clear of the real furniture
    const cam = pos.clone().addScaledVector(n, (table ? .2 : HIGH.has(kind) ? .42 : .44) * close); cam.y += (table ? .4 : HIGH.has(kind) ? .22 : .02) * close;
    cam.y = Math.max(.3, cam.y);
    const look = pos.clone(); if (table) look.addScaledVector(n, .05); else look.y -= .045;
    return { pos, n, cam, look, table };
  }

  function open(kind, opts, p, hooks = {}) {
    close();
    const g = new THREE.Group(), up = new THREE.Vector3(0, 1, 0);
    const z = p.table ? up : p.n, y = p.table ? p.n.clone().negate() : up, x = new THREE.Vector3().crossVectors(y, z);
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); g.position.copy(p.pos); scene.add(g);
    const ticks = [], timers = [], owned = [];
    const r = {
      kind, opts: opts || {}, g, vet: !!hooks.veteran, finished: false, hover: null, holdSpec: null, held: false, holdP: 0, holdDone: false,
      sfx, say: (t) => hooks.say?.(t),
      add(m, bx, by, bz = 0, parent) { if (parent) m.position.set(bx * S, -by * S, bz); else m.position.set((bx - W / 2) * S, (H / 2 - by) * S, bz); (parent || g).add(m); return m; },
      node(bx, by, bz = 0, parent) { return r.add(new THREE.Group(), bx, by, bz, parent); },
      box(bx, by, w, h, t, col, bz = 0, parent) { return r.add(new THREE.Mesh(new THREE.BoxGeometry(w * S, h * S, t), lit(col)), bx, by, bz + t / 2, parent); },
      cyl(bx, by, rad, t, col, bz = 0, parent, seg = 28) { return r.add(new THREE.Mesh(new THREE.CylinderGeometry(rad * S, rad * S, t, seg).rotateX(Math.PI / 2), lit(col)), bx, by, bz + t / 2, parent); },
      rod(bx, by, len, rad, col, bz = 0, parent) { return r.add(new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len * S, 12).rotateZ(Math.PI / 2), lit(col)), bx, by, bz, parent); },
      post(bx, by, len, rad, col, bz = 0, parent) { return r.add(new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len * S, 14), lit(col)), bx, by, bz, parent); },
      ring(bx, by, R, tube, col, bz = 0, parent, arc = TAU) { return r.add(new THREE.Mesh(new THREE.TorusGeometry(R * S, tube, 8, 28, arc), lit(col)), bx, by, bz, parent); },
      // A flat picture: a canvas on a plane. Call .redraw() after painting the canvas again.
      sheet(bx, by, w, h, cv, bz = 0, parent, alpha = false) {
        const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: alpha }); owned.push(tex, mat);
        const m = r.add(new THREE.Mesh(new THREE.PlaneGeometry(w * S, h * S), mat), bx, by, bz, parent); m.redraw = () => { tex.needsUpdate = true; }; return m;
      },
      paper(doc, bx, by, w, h, bz, parent) { return r.sheet(bx, by, w, h, docCanvas(doc, w, h), bz, parent); },
      label(text, bx, by, w, h, bz, parent, style) { return r.sheet(bx, by, w, h, labelCanvas(text, w, h, style), bz, parent); },
      glow(col, opacity = 1) { const m = new THREE.MeshBasicMaterial({ color: col, transparent: opacity < 1, opacity }); owned.push(m); return m; },
      // A sagging wire or thread between two board points (not added to the rig until you add it).
      tube(x1, y1, x2, y2, sag, col, rad = .0045) { return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3((x1 - W / 2) * S, (H / 2 - y1) * S, .012), new THREE.Vector3(((x1 + x2) / 2 - W / 2) * S, (H / 2 - (y1 + y2) / 2) * S, sag), new THREE.Vector3((x2 - W / 2) * S, (H / 2 - y2) * S, .014)]), 18, rad, 6), lit(col)); },
      grab(obj, h) { obj.userData.grab = h; return obj; },
      // Drag handlers that call fn along the whole stroke, so a fast mouse leaves no gaps.
      stroke(fn) { let last = null; return { down: (p) => { last = p; fn(p.x, p.y); }, move: (p) => { const n = Math.max(1, Math.ceil(Math.hypot(p.x - last.x, p.y - last.y) / 18)); for (let i = 1; i <= n; i++) fn(last.x + (p.x - last.x) * i / n, last.y + (p.y - last.y) * i / n); last = p; } }; },
      tick(fn) { ticks.push(fn); },
      later(fn, s) { timers.push({ t: s, fn }); },
      // Eased 0→1 over `dur` seconds.
      anim(dur, fn, then) { let t = 0; const step = (dt) => { t += dt; const k = clamp(t / dur, 0, 1); fn(1 - Math.pow(1 - k, 3)); if (k >= 1) { ticks.splice(ticks.indexOf(step), 1); then?.(); } }; ticks.push(step); },
      // A tool (spray can, pencil, torch) that floats above the board under the pointer.
      tool(obj, bz) { r.hover = (pt) => obj.position.set((pt.x - W / 2) * S, (H / 2 - pt.y) * S, bz); return obj; },
      finish(result, wait = .9) { if (r.finished) return; r.finished = true; r.later(() => hooks.done?.(result), wait); },
    };
    const spec = KINDS[kind](r) || {};
    cur = Object.assign(r, { ticks, timers, owned, spec });
    addEventListener('pointerdown', onDown, true); addEventListener('pointermove', onMove, true); addEventListener('pointerup', onUp, true); addEventListener('pointercancel', onUp, true);
    return { hint: spec.hint || '', buttons: r.vet ? spec.vet || [] : [], hold: r.vet && spec.hold ? spec.hold.label : '' };
  }

  function close() {
    if (!cur) return;
    removeEventListener('pointerdown', onDown, true); removeEventListener('pointermove', onMove, true); removeEventListener('pointerup', onUp, true); removeEventListener('pointercancel', onUp, true);
    scene.remove(cur.g);
    cur.g.traverse((o) => { o.geometry?.dispose(); });
    cur.owned.forEach((o) => o.dispose());
    cur.spec.destroy?.(); cur = null; drag = null;
  }

  // Pointer → point on the board plane at height z (board units for x and y).
  function boardPoint(e, z = 0) {
    const b = canvas.getBoundingClientRect();
    ndc.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height * 2 - 1));
    ray.setFromCamera(ndc, camera);
    cur.g.updateMatrixWorld();
    plane.setFromNormalAndCoplanarPoint(v1.set(0, 0, 1).transformDirection(cur.g.matrixWorld), v2.set(0, 0, z).applyMatrix4(cur.g.matrixWorld));
    if (!ray.ray.intersectPlane(plane, v1)) return { x: -999, y: -999 };
    cur.g.worldToLocal(v1);
    return { x: v1.x / S + W / 2, y: H / 2 - v1.y / S };
  }
  function onDown(e) {
    if (!cur || e.target !== canvas || e.button > 0) return;
    e.preventDefault(); e.stopPropagation();
    boardPoint(e);
    for (const hit of ray.intersectObject(cur.g, true)) {
      let o = hit.object; while (o && !o.userData.grab) o = o.parent;
      if (!o || o.visible === false) continue;
      const z = cur.g.worldToLocal(hit.point.clone()).z;
      drag = { h: o.userData.grab, z, id: e.pointerId };
      drag.h.down?.(boardPoint(e, z), o); return;
    }
  }
  function onMove(e) {
    if (!cur) return;
    if (cur.hover && (drag || e.target === canvas)) cur.hover(boardPoint(e, 0));
    if (drag && e.pointerId === drag.id) drag.h.move?.(boardPoint(e, drag.z));
  }
  function onUp(e) { if (!cur || !drag || e.pointerId !== drag.id) return; const d = drag; drag = null; d.h.up?.(boardPoint(e, d.z)); }

  function update(dt) {
    if (!cur) return;
    dt = Math.min(dt, .1);
    for (const f of cur.ticks.slice()) f(dt);
    for (const t of cur.timers.slice()) if ((t.t -= dt) <= 0) { cur?.timers.splice(cur.timers.indexOf(t), 1); t.fn(); if (!cur) return; }
    const hs = cur.spec.hold;
    if (hs && !cur.holdDone) {
      cur.holdP = cur.held ? Math.min(1, cur.holdP + dt / 2) : Math.max(0, cur.holdP - dt);
      if (cur.held) hs.tick?.(cur.holdP, dt);
      if (cur.holdP >= 1) { cur.holdDone = true; hs.done(); }
    }
  }
  // Input layer shared by the mouse and by hand tracking: type is 'down', 'move' or 'up' at a screen point.
  function pointer(type, x, y, spatial = false) {
    if (!cur) return;
    cur.spatial = spatial;
    const e = { clientX: x, clientY: y, pointerId: spatial ? 'hand' : 'mouse', target: canvas, button: 0, preventDefault() {}, stopPropagation() {} };
    (type === 'down' ? onDown : type === 'up' ? onUp : onMove)(e);
  }
  // World position under a screen point on the puzzle's working plane (for the hand cursor).
  function worldAt(x, y) { if (!cur) return null; const b = boardPoint({ clientX: x, clientY: y }); return cur.g.localToWorld(new THREE.Vector3((b.x - W / 2) * S, (H / 2 - b.y) * S, .02)); }
  // Two-hand twist and stretch, for puzzles that accept it (reading a paper).
  function twist(dAngle, dScale) { cur?.spec.twist?.(dAngle, dScale); }
  return { pose, open, close, update, pointer, worldAt, twist, get active() { return !!cur; }, get group() { return cur?.g; }, get holdProgress() { return cur ? cur.holdP : 0; }, setHeld(v) { if (cur) cur.held = v; } };
}

// ─────────────── The puzzles ───────────────
const WOOD = '#4e3622', DARK = '#2c221a', PAPER = '#ece1c4', BRASS = '#b48a4e', STEEL = '#5b5f5c', BLACK = '#1d1d22';
const slab = (r) => r.box(280, 160, 860, 520, .03, WOOD, -.03);            // desk under table puzzles
const ledge = (r, col = WOOD) => r.box(280, 316, 700, 22, .5, col, -.3);   // shelf under upright puzzles
const backWall = (r, col = '#2c3237') => r.box(280, 160, 700, 420, .02, col, -.34);

const KINDS = {
  // 1 ── Clear the desk: drag the clutter off the paper, then pick the paper up.
  pile(r) {
    slab(r);
    const paper = r.paper(r.opts.doc || { title: 'A document', lines: [] }, 280, 165, 260, 210, .0015);
    const B = (n, x, y, w, h, t, col, z = 0) => r.box(x, y, w, h, t, col, z, n), ITEMS = {
      folder: [(n) => { B(n, 0, 0, 190, 120, .004, '#c9a96c'); B(n, -60, -66, 70, 14, .004, '#c9a96c'); }, 95, 73, 'slide'],
      news: [(n) => { B(n, 0, 0, 160, 110, .003, '#cfcabb'); B(n, -30, -40, 72, 14, .0006, '#6f6a5e', .003); for (let i = 0; i < 5; i++) B(n, -8 + (i % 3) * 5, -18 + i * 15, 116 + (i % 3) * 10, 3.5, .0006, '#6f6a5e', .003); }, 80, 55, 'slide'],
      telegram: [(n) => { B(n, 0, 0, 156, 92, .0025, '#d9c9a3'); B(n, -25, 22, 70, 8, .0006, '#c9a24a', .0025); B(n, 0, -20, 150, 2, .0006, '#9c8659', .0025).rotation.z = .5; }, 78, 46, 'slide'],
      mug: [(n) => { r.cyl(0, 0, 34, .085, '#e3dccb', 0, n); r.cyl(0, 0, 27, .002, '#3b2516', .085, n); B(n, 42, 0, 20, 12, .05, '#e3dccb', .018); }, 50, 34, 'clink'],
      ashtray: [(n) => { r.cyl(0, 0, 32, .016, '#6b7a7a', 0, n); r.cyl(0, 0, 22, .002, '#3d4747', .016, n); r.rod(-8, 0, 30, .004, '#e9e0c8', .022, n); }, 32, 32, 'clink'],
      pen: [(n) => { r.rod(0, 0, 160, .006, BLACK, .006, n); r.rod(70, 0, 22, .0068, BRASS, .006, n); }, 80, 8, 'slide'],
      ink: [(n) => { B(n, 0, 0, 40, 44, .05, '#1d2440'); r.cyl(0, 0, 11, .014, BLACK, .05, n); B(n, 0, 23, 28, 1, .03, '#e9dfc5', .008); }, 22, 24, 'clink'],
      keys: [(n) => { r.ring(0, 0, 15, .002, '#9a9a92', .003, n); B(n, 28, 12, 40, 8, .003, BRASS).rotation.z = -.35; B(n, -8, 32, 8, 40, .003, BRASS).rotation.z = .2; }, 46, 46, 'clink'],
      glasses: [(n) => { r.ring(-24, 0, 20, .0022, '#2a2420', .004, n); r.ring(24, 0, 20, .0022, '#2a2420', .004, n); B(n, 0, -2, 10, 3, .003, '#2a2420', .003); }, 46, 22, 'clink'],
      matches: [(n) => { B(n, 0, 0, 52, 36, .008, '#2e3a63'); B(n, 0, -13, 52, 10, .0085, '#8a6d3e'); }, 28, 20, 'slide'],
      photo: [(n) => { B(n, 0, 0, 76, 60, .0015, '#efe8d8'); B(n, 0, -3, 62, 40, .0018, '#5d5a52'); }, 38, 30, 'slide'],
    };
    const pick = (ids, n) => ids.sort(() => Math.random() - .5).slice(0, n);
    const ids = [...pick(['folder', 'news', 'telegram'], 2), ...pick(['mug', 'ashtray', 'pen', 'ink', 'keys', 'glasses', 'matches', 'photo'], 3 + (Math.random() < .5 ? 1 : 0))];
    const junk = [], cleared = new Set();
    let ready = false, taken = false;
    const clear = (j) => { const c = Math.abs(Math.cos(j.n.rotation.z)), s = Math.abs(Math.sin(j.n.rotation.z)), ex = c * j.hx + s * j.hy, ey = s * j.hx + c * j.hy; return j.x + ex < 160 || j.x - ex > 400 || j.y + ey < 70 || j.y - ey > 260; };
    const check = () => { const now = cleared.size === junk.length; if (now && !ready) r.say('There it is. Pick it up.'); ready = now; };
    const place = (j, z) => { j.n.position.set((j.x - W / 2) * S, (H / 2 - j.y) * S, z); };
    ids.forEach((id, i) => {
      const [build, hx, hy, snd] = ITEMS[id], big = i < 2;
      const j = { id, hx, hy, snd, x: big ? 250 + Math.random() * 60 : 180 + Math.random() * 200, y: big ? 130 + Math.random() * 60 : 90 + Math.random() * 150, zr: .003 + i * .006, n: r.node(0, 0) };
      build(j.n); j.n.rotation.z = (Math.random() * 50 - 25) * Math.PI / 180; place(j, j.zr); junk.push(j);
      let off;
      r.grab(j.n, {
        down: (p) => { off = { x: p.x - j.x, y: p.y - j.y }; place(j, .05); r.sfx('slide'); },
        move: (p) => { j.x = clamp(p.x - off.x, -80, W + 80); j.y = clamp(p.y - off.y, -50, H + 50); place(j, .05); },
        up: () => { const c = clear(j); c ? cleared.add(id) : cleared.delete(id); place(j, c ? .001 : j.zr); r.sfx(j.snd); check(); },
      });
    });
    const take = () => { if (!ready || taken) return; taken = true; r.sfx('slide'); r.anim(.8, (k) => { paper.position.z = .0015 + k * .3; paper.position.y = (H / 2 - 165) * S - k * .1; paper.rotation.x = k * .95; }); r.finish(); };
    r.grab(paper, { down: take });
    return { hint: 'Drag the clutter off the paper, then pick the paper up.', vet: [['Clear clutter', () => { const j = junk.find((q) => !cleared.has(q.id)); if (!j) return; const i = cleared.size; j.x = i % 2 ? 540 : 20; j.y = 40 + Math.floor(i / 2) * 110; j.n.rotation.z = 0; place(j, .001); cleared.add(j.id); r.sfx('slide'); check(); }], ['Pick up the paper', take]] };
  },

  // 2 ── Pull a drawer open and lift out what is inside.
  drawer(r) {
    const c = r.opts.contents || { title: '', lines: [] };
    r.box(280, 165, 340, 300, .34, '#4d4a3f', -.36);
    const d = r.node(280, 165);
    r.box(0, 0, 300, 130, .02, '#6c6450', 0, d); r.box(0, 60, 280, 6, .3, '#3b382f', -.3, d);
    r.box(-142, 20, 6, 80, .3, '#57523f', -.3, d); r.box(142, 20, 6, 80, .3, '#57523f', -.3, d);
    r.label(r.opts.label || 'Drawer', 0, -30, 130, 26, .021, d);
    const handle = r.box(0, 22, 110, 16, .028, BRASS, .02, d);
    const doc = r.paper(c, 0, 54, 240, 150, -.15, d); doc.rotation.x = -Math.PI / 2;
    let open = 0, y0 = 0, o0 = 0;
    const apply = () => { d.position.z = open * .27; };
    const done = () => { if (r.finished) return; r.sfx('thud'); r.say('It’s open.'); r.anim(.35, (k) => { open = Math.max(open, k); apply(); }, () => r.anim(.8, (k) => { doc.position.y = -54 * S + k * .2; doc.position.z = -.15 + k * .1; doc.rotation.x = -Math.PI / 2 + k * (Math.PI / 2 - .5); })); r.finish(); };
    const letGo = () => { if (open >= .75) done(); else if (r.spatial) { const from = open; r.anim(.3, (k) => { open = from * (1 - k); apply(); }); } };
    r.grab(handle, { down: (p) => { y0 = p.y; o0 = open; }, move: (p) => { if (r.finished) return; open = clamp(o0 + (p.y - y0) / 150, 0, 1); apply(); r.sfx('screech', open); }, up: letGo });
    r.grab(d, { down: (p) => { y0 = p.y; o0 = open; }, move: (p) => { if (r.finished) return; open = clamp(o0 + (p.y - y0) / 150, 0, 1); apply(); r.sfx('screech', open); }, up: letGo });
    return { hint: 'Grab the brass handle and pull the drawer toward you.', vet: [['Pull drawer', done]] };
  },

  // 3 ── Pull an embosser down onto a receipt.
  press(r) {
    ledge(r);
    const paper = r.paper({ title: 'Passport receipt', lines: ['Held “for processing”', 'Aegis, file 409'] }, 280, 304, 240, 190, -.02); paper.rotation.x = -Math.PI / 2;
    const seal = r.ring(280, 303, 30, .002, '#9c8458', -.02); seal.rotation.x = -Math.PI / 2; seal.visible = false;
    r.box(280, 205, 46, 200, .05, '#2d302e', -.2); r.box(280, 96, 70, 22, .22, '#2d302e', -.2);
    const p = r.node(280, 96);
    r.post(0, 44, 88, .012, STEEL, -.02, p);
    const head = r.box(0, 82, 84, 14, .09, BRASS, -.065, p);
    const handle = r.box(0, -22, 150, 16, .03, '#7a2f22', -.035, p); r.post(0, -8, 20, .014, STEEL, -.02, p);
    let v = 0, y0 = 0;
    const apply = () => { p.position.y = (H / 2 - 96) * S - v * 115 * S; };
    const done = () => { if (r.finished) return; v = 1; apply(); seal.visible = true; r.sfx('kachunk'); r.say('Ka-chunk.'); r.finish(); r.later(() => r.anim(.5, (k) => { v = 1 - k; apply(); }), .35); };
    for (const o of [handle, head]) r.grab(o, { down: (pt) => { y0 = pt.y - v * 115; }, move: (pt) => { if (r.finished) return; v = clamp((pt.y - y0) / 115, 0, 1); apply(); if (v >= 1) done(); }, up: () => { if (!r.finished) r.anim(.2, (k) => { v *= 1 - k; apply(); }); } });
    return { hint: 'Pull the red handle down until it bites the paper.', vet: [['Press down', () => r.anim(.3, (k) => { v = Math.max(v, k * .99); apply(); }, done)]] };
  },

  // 4 ── Drag an item into a hiding place.
  slot(r) {
    const item = r.opts.item || 'receipt', printer = r.opts.place === 'printer';
    backWall(r); ledge(r, '#3b2a1b');
    let gy;
    if (printer) { r.box(280, 150, 340, 190, .28, STEEL, -.3); r.box(280, 186, 230, 22, .02, '#070809', -.019); r.label('TELEPRINTER', 280, 100, 150, 24, -.019, null, { bg: '#2d302e', fg: '#d9d2c0' }); gy = 186; }
    else { for (let i = 0; i < 8; i++) { r.box(143 + i * 38, 118, 26, 150, .09, '#a39d90', -.12); r.cyl(143 + i * 38, 43, 13, .09, '#a39d90', -.12); } r.box(280, 208, 330, 30, .12, '#070809', -.14); r.rod(280, 200, 340, .012, '#8a857a', -.07); gy = 212; }
    const n = r.node(110, 262, .06);
    if (item === 'key') { r.ring(0, 0, 16, .004, BRASS, 0, n); r.box(40, 0, 56, 9, .005, BRASS, -.0025, n); r.box(60, 9, 8, 12, .005, BRASS, -.0025, n); }
    else if (item === 'card') r.sheet(0, 0, 120, 68, labelCanvas('Patient advocate\n640 kHz', 120, 68), 0, n);
    else { r.sheet(0, 0, 128, 80, labelCanvas('RECEIPT\nAegis · file 409', 128, 80), 0, n); r.ring(34, 14, 14, .0015, '#9c8458', .001, n); }
    let x = 110, y = 262, off;
    const done = () => { if (r.finished) return; const x0 = x, y0 = y; r.sfx('slide'); r.say('Out of sight.'); r.anim(.6, (k) => { n.position.set((x0 + (280 - x0) * k - W / 2) * S, (H / 2 - (y0 + (gy - y0) * k)) * S, .06 - k * .16); n.scale.setScalar(1 - k * .35); }); r.finish(); };
    r.grab(n, { down: (p) => { off = { x: p.x - x, y: p.y - y }; }, move: (p) => { if (r.finished) return; x = p.x - off.x; y = p.y - off.y; n.position.set((x - W / 2) * S, (H / 2 - y) * S, .06); }, up: () => { if (x > 140 && x < 420 && Math.abs(y - gy) < 46) done(); } });
    return { hint: 'Drag it into the dark gap to hide it.', vet: [['Hide it', done]] };
  },

  // 5 ── Three brass combination wheels and a shackle.
  tumbler(r) {
    const code = String(r.opts.code || '409').slice(0, 3).split('').map(Number), d = [0, 0, 0];
    r.box(280, 170, 310, 180, .07, STEEL, -.07);
    const shackle = r.ring(280, 84, 82, .014, '#8f938f', -.035, null, Math.PI);
    r.post(198, 100, 40, .014, '#8f938f', -.035); r.post(362, 100, 40, .014, '#8f938f', -.035);
    if (r.opts.label) r.label(r.opts.label, 280, 292, 420, 30, .002, null, { bg: '#2d302e', fg: '#e9dfc5', font: '600 13px Georgia, serif' });
    // Digits run round each wheel; one turn of the wheel is ten digits.
    const [cv, x] = canvasOf(640, 64, 2); x.fillStyle = '#c9a15c'; x.fillRect(0, 0, 640, 64); x.fillStyle = '#2b1d0c'; x.font = '700 44px Rockwell, Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < 10; i++) { x.save(); x.translate(i * 64 + 32, 32); x.rotate(Math.PI / 2); x.fillText(String(i), 0, 2); x.restore(); x.fillStyle = '#8a6d3e'; x.fillRect(i * 64, 0, 1.5, 64); x.fillStyle = '#2b1d0c'; }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const side = new THREE.MeshBasicMaterial({ map: tex });
    const wheels = [0, 1, 2].map((i) => { const n = r.node(190 + i * 90, 170, .012); const m = new THREE.Mesh(new THREE.CylinderGeometry(.052, .052, .07, 40).rotateZ(Math.PI / 2), [side, lit(BRASS), lit(BRASS)]); n.add(m); return n; });
    r.box(280, 143, 280, 5, .004, '#1d1d22', .058); r.box(280, 197, 280, 5, .004, '#1d1d22', .058);
    const turn = (i) => { wheels[i].rotation.x = (d[i] + .5) / 10 * TAU; };
    [0, 1, 2].forEach(turn);
    const step = (i, s) => { if (r.finished) return; d[i] = (d[i] + s + 10) % 10; turn(i); r.sfx('thud'); if (d.every((v, k) => v === code[k])) { r.sfx('kachunk'); r.say('The shackle springs.'); r.anim(.5, (k) => { shackle.position.y = (H / 2 - 84) * S + k * .04; shackle.rotation.y = k * .5; }); r.finish({ ok: true }); } };
    wheels.forEach((n, i) => { let y0 = 0; r.grab(n, { down: (p) => { y0 = p.y; }, move: (p) => { while (p.y - y0 > 26) { y0 += 26; step(i, -1); } while (y0 - p.y > 26) { y0 -= 26; step(i, 1); } } }); });
    return { hint: 'Drag each brass wheel up or down to set the number.', vet: [0, 1, 2].flatMap((i) => [[`Wheel ${i + 1} ▲`, () => step(i, 1)], [`Wheel ${i + 1} ▼`, () => step(i, -1)]]), destroy() { tex.dispose(); side.dispose(); } };
  },

  // 6 ── Smash the emergency glass and take the key.
  smash(r) {
    r.box(280, 160, 280, 280, .14, '#7a2f22', -.14); r.box(280, 160, 236, 236, .002, '#2a0f0b', 0);
    r.label('IN EMERGENCY\nBREAK GLASS', 280, 60, 190, 44, .003, null, { bg: '#2a0f0b', fg: '#e9dfc5', font: '700 14px Georgia, serif' });
    const key = r.node(262, 176, .012); r.ring(0, 0, 22, .005, BRASS, 0, key); r.box(52, 0, 70, 11, .006, BRASS, -.003, key); r.box(78, 12, 10, 16, .006, BRASS, -.003, key);
    const glass = r.add(new THREE.Mesh(new THREE.PlaneGeometry(236 * S, 236 * S), r.glow('#cfe3e6', .22)), 280, 160, .05);
    const crackMat = new THREE.LineBasicMaterial({ color: '#ffffff' }), shards = [];
    let hits = 0;
    const hit = (x, y) => {
      if (hits >= 6) return; hits++; r.sfx('crack');
      const pts = []; for (let i = 0; i < 7; i++) { const a = Math.random() * TAU, len = 40 + Math.random() * 90, mx = x + Math.cos(a) * len * .5 + Math.random() * 12, my = y + Math.sin(a) * len * .5; pts.push(x, y, mx, my, mx, my, x + Math.cos(a) * len, y + Math.sin(a) * len); }
      const geo = new THREE.BufferGeometry(), arr = []; for (let i = 0; i < pts.length; i += 2) arr.push((clamp(pts[i], 164, 396) - W / 2) * S, (H / 2 - clamp(pts[i + 1], 44, 276)) * S, .051);
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); const l = new THREE.LineSegments(geo, crackMat); l.userData.crack = true; r.g.add(l);
      if (hits >= 6) {
        glass.visible = false; r.g.children.filter((o) => o.userData.crack).forEach((o) => { o.visible = false; });
        for (let i = 0; i < 14; i++) { const s = r.add(new THREE.Mesh(new THREE.CircleGeometry(.012 + Math.random() * .02, 3), glass.material), 180 + Math.random() * 200, 60 + Math.random() * 200, .05); s.userData.v = [(Math.random() - .5) * .5, Math.random() * .6, .3 + Math.random() * .8]; shards.push(s); }
        r.sfx('shatter'); r.say('Take the key.');
      }
    };
    r.tick((dt) => { for (const s of shards) { const v = s.userData.v; v[1] -= 3.2 * dt; s.position.x += v[0] * dt; s.position.y += v[1] * dt; s.position.z += v[2] * dt * .3; s.rotation.z += dt * 6; s.rotation.x += dt * 4; if (s.position.y < -.5) s.visible = false; } });
    const take = () => { if (hits < 6 || r.finished) return; r.sfx('clink'); r.anim(.7, (k) => { key.position.z = .012 + k * .3; key.rotation.z = k * .6; }); r.finish(); };
    r.grab(glass, { down: (p) => hit(p.x, p.y) }); r.grab(key, { down: take });
    let next = 0;
    return { hint: 'Strike the glass until it breaks, then take the key.', hold: { label: 'Hold to smash', tick: (p) => { if (p >= next) { next += 1 / 6; hit(200 + Math.random() * 160, 80 + Math.random() * 160); } }, done: () => { while (hits < 6) hit(280, 160); r.later(take, .5); } }, destroy() { crackMat.dispose(); } };
  },

  // 7 ── Spray luminol or sweep a UV lamp over a surface to bring up hidden marks.
  spray(r) {
    const agent = r.opts.agent || 'luminol', surface = r.opts.surface || 'keypad', reveal = r.opts.reveal || {};
    r.box(280, 160, 620, 380, .04, surface === 'waiver' ? '#4e3622' : '#2a2622', -.041);
    const [cv, c] = canvasOf(W, H, 2), mk = () => canvasOf(W, H, 1);
    const [base, b] = mk(), [hid, h] = mk(), [mask, m] = mk(), [tmp, t] = mk();
    if (surface === 'keypad') {
      b.fillStyle = '#2a2622'; b.fillRect(0, 0, W, H); b.fillStyle = '#b48a4e'; b.fillRect(190, 20, 180, 280);
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
      keys.forEach((k, i) => { const x = 210 + (i % 3) * 52, y = 40 + Math.floor(i / 3) * 62; b.fillStyle = '#3a2c1a'; b.fillRect(x, y, 40, 46); b.fillStyle = '#d9b46c'; b.font = 'bold 22px Rockwell, Georgia, serif'; b.fillText(k, x + 13, y + 31); });
      h.shadowColor = '#7fd3ff'; h.shadowBlur = 18; h.strokeStyle = '#9fe4ff'; h.fillStyle = '#9fe4ff'; h.lineWidth = 1.6;
      for (const k of ['4', '0', '9']) { const i = keys.indexOf(k), x = 210 + (i % 3) * 52 + 20, y = 40 + Math.floor(i / 3) * 62 + 23; for (let q = 18; q > 4; q -= 4) { h.beginPath(); h.ellipse(x, y, q, q * 1.25, 0, 0, 7); h.stroke(); } }
      h.font = 'bold 40px Rockwell, Georgia, serif'; h.fillText(reveal.code ? reveal.code.split('').join(' ') : '4 0 9', 400, 170);
    } else if (surface === 'waiver') {
      b.fillStyle = '#e9dfc5'; b.fillRect(0, 0, W, H); b.fillStyle = '#2b2620'; b.font = 'bold 24px Rockwell, Georgia, serif'; b.fillText('Consent waiver', 40, 50);
      b.font = '17px Georgia, serif'; ['I agree to donate one kidney', 'voluntarily and without payment.', '', 'Signed:'].forEach((l, i) => b.fillText(l, 40, 100 + i * 32));
      b.strokeStyle = '#1c2246'; b.lineWidth = 2; b.beginPath(); b.moveTo(130, 196); b.bezierCurveTo(170, 170, 200, 220, 260, 190); b.stroke();
      h.fillStyle = '#c99bff'; h.shadowColor = '#b46bff'; h.shadowBlur = 16; h.font = 'italic bold 34px Georgia, serif'; (reveal.lines || ['I do not consent']).forEach((l, i) => h.fillText(l, 60, 260 + i * 40));
    } else {
      const g = b.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#6f7c6c'); g.addColorStop(1, '#55604f'); b.fillStyle = g; b.fillRect(0, 0, W, H);
      for (let i = 0; i < 160; i++) { b.strokeStyle = `rgba(255,255,255,${Math.random() * .05})`; b.beginPath(); const y = Math.random() * H; b.moveTo(0, y); b.lineTo(W, y + Math.random() * 20 - 10); b.stroke(); }
      h.fillStyle = '#c99bff'; h.shadowColor = '#b46bff'; h.shadowBlur = 18; h.font = 'bold 40px Rockwell, Georgia, serif'; h.textAlign = 'center';
      (reveal.lines || ['SEAL K7']).forEach((l, i, a) => h.fillText(l, W / 2, H / 2 - (a.length - 1) * 26 + i * 52));
    }
    const face = r.sheet(280, 160, W, H, cv, .001);
    const hd = h.getImageData(0, 0, W, H).data, cells = [], CS = 16;
    for (let y = 0; y < H; y += CS) for (let x = 0; x < W; x += CS) { let any = false; for (let yy = y; yy < y + CS && !any; yy += 4) for (let xx = x; xx < x + CS; xx += 4) if (hd[(yy * W + xx) * 4 + 3] > 40) { any = true; break; } if (any) cells.push({ x: x + CS / 2, y: y + CS / 2, on: false }); }
    const draw = () => { c.drawImage(base, 0, 0); t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, W, H); t.drawImage(hid, 0, 0); t.globalCompositeOperation = 'destination-in'; t.drawImage(mask, 0, 0); c.drawImage(tmp, 0, 0); face.redraw(); };
    const spray = (x, y) => {
      if (r.finished) return;
      m.fillStyle = 'rgba(255,255,255,.9)';
      for (let i = 0; i < 14; i++) { const a = Math.random() * TAU, q = Math.random() * 34; m.beginPath(); m.arc(x + Math.cos(a) * q, y + Math.sin(a) * q, 5 + Math.random() * 9, 0, 7); m.fill(); }
      for (const cell of cells) if (!cell.on && Math.hypot(cell.x - x, cell.y - y) < 34) cell.on = true;
      r.sfx('spray'); draw();
      if (cells.filter((q) => q.on).length / Math.max(1, cells.length) >= .6) { m.fillRect(0, 0, W, H); draw(); r.say(surface === 'keypad' ? 'The code glows: 4 0 9.' : 'There it is.'); r.finish(); }
    };
    draw();
    // The can or lamp hovers over the surface under the pointer.
    const tool = r.node(280, 160, .09); r.cyl(0, 0, 16, .11, agent === 'uv' ? '#2d2a3d' : '#7d8f93', 0, tool); r.cyl(0, 0, agent === 'uv' ? 20 : 6, .012, agent === 'uv' ? '#b46bff' : BLACK, -.012, tool); r.tool(tool, .09);
    r.grab(face, r.stroke(spray));
    let k = 0;
    return { hint: agent === 'uv' ? 'Hold the mouse button and sweep the UV lamp across it.' : 'Hold the mouse button and spray across the surface.', hold: { label: agent === 'uv' ? 'Hold to light it' : 'Hold to spray', tick: () => { const cell = cells[k++ % Math.max(1, cells.length)]; if (cell) spray(cell.x, cell.y); }, done: () => cells.forEach((q) => spray(q.x, q.y)) } };
  },

  // 8 ── Wind the pocket watch forward one full turn.
  watch(r) {
    slab(r);
    r.cyl(280, 160, 132, .03, BRASS); r.cyl(280, 14, 18, .03, BRASS); r.ring(280, -8, 16, .004, BRASS, .015);
    const [cv, c] = canvasOf(256, 256, 3), ftex = new THREE.CanvasTexture(cv), fmat = new THREE.MeshBasicMaterial({ map: ftex }); ftex.colorSpace = THREE.SRGBColorSpace;
    r.add(new THREE.Mesh(new THREE.CircleGeometry(.118, 48), fmat), 280, 160, .031);
    r.box(280, 160, 6, 70, .003, '#2b2118', .033).rotation.z = -1.1;
    const hand = r.node(280, 160, .036); r.box(52, 0, 104, 4, .003, '#2b2118', 0, hand); const grip = r.cyl(104, 0, 13, .012, '#7a2f22', 0, hand); r.cyl(280, 160, 6, .008, '#2b2118', .034);
    let angle = -Math.PI / 2, turned = 0, lastTick = 0, prev = 0;
    const paint = () => {
      c.fillStyle = '#e9ddbd'; c.fillRect(0, 0, 256, 256); c.strokeStyle = '#2b2118'; c.lineWidth = 3;
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.beginPath(); c.moveTo(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104); c.lineTo(128 + Math.cos(a) * 120, 128 + Math.sin(a) * 120); c.stroke(); }
      if (turned > .02) { c.fillStyle = 'rgba(26,18,10,.25)'; c.beginPath(); c.moveTo(128, 128); c.arc(128, 128, 120, -Math.PI / 2, -Math.PI / 2 + turned); c.closePath(); c.fill(); }
      ftex.needsUpdate = true; hand.rotation.z = -angle;
    };
    const add = (da) => { if (r.finished || da <= 0) return; turned += da; angle += da; while (turned - lastTick > Math.PI / 30) { lastTick += Math.PI / 30; r.sfx('tick'); } paint(); if (turned >= TAU) { r.say('The hours slip by.'); r.sfx('kachunk'); r.finish(); } };
    paint();
    r.grab(grip, { down: (p) => { prev = Math.atan2(p.y - 160, p.x - 280); }, move: (p) => { const a = Math.atan2(p.y - 160, p.x - 280); let d = a - prev; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; prev = a; add(d); } });
    return { hint: 'Drag the red tip of the minute hand clockwise, once round the dial.', hold: { label: 'Hold to wind', tick: (p, dt) => add(dt * Math.PI), done: () => add(TAU - turned + .01) }, destroy() { ftex.dispose(); fmat.dispose(); } };
  },

  // 9 ── Ham radio: frequency and squelch dials with an oscilloscope.
  dials(r) {
    const target = r.opts.freq || 640, min = r.opts.min || 520, max = r.opts.max || 760, sqT = 62;
    let f = min + 30, sq = 15, good = 0, time = 0;
    r.box(280, 160, 600, 340, .22, '#2a2925', -.22); r.box(280, 93, 270, 160, .012, '#121310');
    const [scv, c] = canvasOf(240, 130, 2), scope = r.sheet(280, 93, 240, 130, scv, .013);
    const [rcv, rc] = canvasOf(160, 30, 3), read = r.sheet(280, 196, 160, 30, rcv, .002);
    const tubes = [0, 1, 2].map((i) => { const m = r.add(new THREE.Mesh(new THREE.SphereGeometry(.014, 12, 8), r.glow('#4a3a28')), 462 + i * 30, 44, .012); return m; });
    const knob = (cx, label) => { const n = r.node(cx, 242, 0); r.cyl(0, 0, 46, .04, '#1a1915', 0, n); r.ring(0, 0, 46, .003, BRASS, .04, n); r.box(0, -26, 7, 30, .004, '#f3d38a', .04, n); r.label(label, cx, 304, 110, 20, .046, null, { bg: '#2a2925', fg: '#d9d2c0', font: '600 12px Georgia, serif' }); return n; };
    const kf = knob(120, 'FREQUENCY'), ks = knob(440, 'SQUELCH');
    const paint = () => { kf.rotation.z = -(-135 + (f - min) / (max - min) * 270) * Math.PI / 180; ks.rotation.z = -(-135 + sq / 100 * 270) * Math.PI / 180; rc.fillStyle = '#121310'; rc.fillRect(0, 0, 160, 30); rc.fillStyle = '#f3d38a'; rc.font = '700 20px Rockwell, Georgia, serif'; rc.textAlign = 'center'; rc.fillText(`${f.toFixed(0)} kHz · ${sq.toFixed(0)}%`, 80, 22); read.redraw(); };
    const mis = () => clamp(Math.abs(f - target) / 40, 0, 1) * .65 + clamp(Math.abs(sq - sqT) / 40, 0, 1) * .35;
    paint();
    [[kf, 120, 'f'], [ks, 440, 's']].forEach(([n, cx, id]) => { let prev = 0; r.grab(n, { down: (p) => { prev = Math.atan2(p.y - 242, p.x - cx); }, move: (p) => { const a = Math.atan2(p.y - 242, p.x - cx); let d = a - prev; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; prev = a; const deg = d * 180 / Math.PI; if (id === 'f') f = clamp(f + deg * .45, min, max); else sq = clamp(sq + deg * .3, 0, 100); paint(); r.sfx('click'); } }); });
    r.tick((dt) => {
      time += dt; const m = r.finished ? 0 : mis();
      c.fillStyle = '#04120a'; c.fillRect(0, 0, 240, 130); c.strokeStyle = '#123d22'; c.lineWidth = 1;
      for (let x = 0; x < 240; x += 30) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 130); c.stroke(); }
      c.strokeStyle = '#58ff9a'; c.lineWidth = 2; c.beginPath();
      for (let x = 0; x <= 240; x += 2) { const y = 65 + Math.sin(x / 14 + time * 6) * 26 * (1 - m * .6) + (Math.random() - .5) * 110 * m * m; x ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke(); scope.redraw();
      tubes.forEach((tb) => tb.material.color.set(m < .5 ? '#ffb35a' : '#4a3a28'));
      if (!r.finished) { r.sfx('static', m); good = Math.abs(f - target) <= 4 && Math.abs(sq - sqT) <= 8 ? good + dt : 0; if (good >= 1.2) { r.sfx('static', 0); r.sfx('voice'); r.say('“Harbour dispatch. Suite B, St. Jude. We’re moving.”'); r.finish(); } }
    });
    const nudge = (df, ds) => () => { f = clamp(f + df, min, max); sq = clamp(sq + ds, 0, 100); paint(); };
    return { hint: 'Turn both dials until the trace runs clean and the voice comes through.', vet: [['◀ Frequency', nudge(-4, 0)], ['Frequency ▶', nudge(4, 0)], ['◀ Squelch', nudge(0, -4)], ['Squelch ▶', nudge(0, 4)]], destroy() { r.sfx('static', 0); } };
  },

  // 10 ── Report each lure ad to a moderator line, then unplug the record drives so nothing can be wiped.
  wires(r) {
    const ads = [['Lab tech $4,000/mo', '10.4.0.9'], ['No visa needed', '172.16.9.4'], ['Free flights', '192.168.4.9']], cables = [232, 264, 296];
    const back = r.box(280, 160, 600, 340, .06, '#0b2414', -.06);
    const linked = new Set(), used = new Set(), cut = new Set(), plates = [];
    const tube = (x1, y1, x2, y2, sag) => r.tube(x1, y1, x2, y2, sag, '#ff6a3d');
    let temp = null;
    const setTemp = (m) => { if (temp) { r.g.remove(temp); temp.geometry.dispose(); } temp = m; if (m) r.g.add(m); };
    const addLink = (i, p) => { linked.add(i); used.add(p); r.g.add(tube(214, 46 + i * 62, 400, 46 + p * 62, .06)); r.sfx('wire'); if (linked.size === 3) r.say('Reported. Now pull the three record drives so nothing can be wiped.'); };
    ads.forEach(([a, ip], i) => {
      const [cv, x] = canvasOf(190, 48, 3); x.fillStyle = '#0d2a17'; x.fillRect(0, 0, 190, 48); x.strokeStyle = '#3fae6c'; x.strokeRect(1, 1, 188, 46); x.fillStyle = '#7dffb0'; x.font = '15px "American Typewriter", "Courier New", monospace'; x.fillText(a, 10, 21); x.fillStyle = '#3fae6c'; x.font = '12px "Courier New", monospace'; x.fillText(ip, 10, 38);
      const plate = r.sheet(115, 46 + i * 62, 190, 48, cv, .004); plates.push(plate); r.cyl(214, 46 + i * 62, 7, .01, BRASS);
      r.grab(plate, { move: (p) => { if (!linked.has(i)) setTemp(tube(214, 46 + i * 62, p.x, p.y, .05)); }, up: (p) => { setTemp(null); if (linked.has(i)) return; for (let k = 0; k < 3; k++) if (!used.has(k) && Math.hypot(p.x - 400, p.y - (46 + k * 62)) < 38) { addLink(i, k); break; } } });
      r.cyl(400, 46 + i * 62, 16, .012, BRASS); r.cyl(400, 46 + i * 62, 8, .013, '#1a120a'); r.label('MODERATOR ' + (i + 1), 480, 46 + i * 62, 110, 20, .002, null, { bg: '#0b2414', fg: '#3fae6c', font: '600 11px "Courier New", monospace' });
    });
    const rods = cables.map((y) => [r.rod(170, y, 220, .007, '#222', .02), r.rod(390, y, 220, .007, '#222', .02)]);
    const doCut = (i, x) => {
      if (cut.has(i) || linked.size < 3) return; cut.add(i); x = clamp(x, 90, 470);
      const [a, b] = rods[i], la = x - 60 - 8, lb = 500 - x - 8; a.scale.x = la / 220; a.position.x = (60 + la / 2 - W / 2) * S; b.scale.x = lb / 220; b.position.x = (500 - lb / 2 - W / 2) * S; a.rotation.z = -.05; b.rotation.z = .05;
      r.sfx('click'); r.sfx('thud');
      if (cut.size === 3) { back.material = lit('#050605'); plates.forEach((p) => p.material.color.set('#3a3a3a')); r.sfx('kachunk'); r.say('Records secured. The terminal is locked.'); r.finish(); }
    };
    let last = null;
    const slice = { down: (p) => { last = p; }, move: (p) => { if (!last) return; cables.forEach((y, i) => { if ((last.y - y) * (p.y - y) <= 0 && Math.abs(p.y - last.y) > 1) doCut(i, p.x); }); last = p; }, up: () => { last = null; } };
    r.grab(back, slice); rods.flat().forEach((m) => r.grab(m, slice));
    return { hint: 'Drag a wire from each ad to a moderator port to report it. Then drag across the black drive leads to unplug them.', vet: [['Report next', () => { const i = [0, 1, 2].find((k) => !linked.has(k)), p = [0, 1, 2].find((k) => !used.has(k)); if (i !== undefined) addLink(i, p); }], ['Unplug next drive', () => { const i = [0, 1, 2].find((k) => !cut.has(k)); if (i !== undefined) doCut(i, 280); }]] };
  },

  // 11 ── Copy the forged consent form for the authorities, then stamp the ethics hold on Mateo's file.
  shred(r) {
    const doctor = r.opts.doctor || 'Dr. A. Vance';
    backWall(r); ledge(r);
    r.box(425, 222, 200, 166, .24, '#3f4a3e', -.26); r.box(425, 137, 160, 6, .12, '#070809', -.2); r.label('PHOTOSTAT', 425, 172, 110, 22, -.019, null, { bg: '#2d352c', fg: '#d9d2c0', font: '700 12px Georgia, serif' });
    const lic = r.node(140, 95, .05); r.sheet(0, 0, 150, 92, labelCanvas(`CONSENT FORM\nMateo R. · “voluntary”\nSurgeon: ${doctor}`, 150, 92, { font: '700 12px Georgia, serif' }), 0, lic);
    const file = r.sheet(150, 303, 220, 170, labelCanvas('PATIENT FILE 409\nMateo R.\nScheduled: surgery, 4:00 a.m.', 220, 170, { font: '700 14px Georgia, serif' }), -.03); file.rotation.x = -Math.PI / 2; file.visible = false;
    const held = r.sheet(150, 302, 220, 170, (() => { const cv = labelCanvas('PATIENT FILE 409\nMateo R.\n\n\n', 220, 170, { font: '700 14px Georgia, serif' }), x = cv.getContext('2d'); x.save(); x.translate(110, 112); x.rotate(-.12); x.strokeStyle = '#7a2f22'; x.lineWidth = 3; x.strokeRect(-92, -24, 184, 48); x.fillStyle = '#7a2f22'; x.font = '700 17px Georgia, serif'; x.textAlign = 'center'; x.fillText('ETHICS HOLD', 0, -2); x.font = '600 10px Georgia, serif'; x.fillText('Istanbul Declaration', 0, 15); x.restore(); for (let i = 0; i < 26; i++) { x.fillStyle = '#111'; x.fillRect(40 + i * 5.4, 148, i % 3 ? 2 : 3.6, 16); } return cv; })(), -.03); held.rotation.x = -Math.PI / 2; held.visible = false;
    const stamp = r.node(150, 150, -.03); r.post(0, 0, 70, .014, '#3b2a1b', 0, stamp); r.box(0, -44, 60, 18, .05, '#3b2a1b', -.025, stamp); const head = r.box(0, 44, 96, 18, .07, '#7a2f22', -.035, stamp); stamp.visible = false;
    const strips = []; let shredded = false, x = 140, y = 95, off, v = 0, y0 = 0;
    const doShred = () => {
      if (shredded) return; shredded = true; r.sfx('grind'); const x0 = x, y1 = y;
      r.anim(.8, (k) => { lic.position.set((x0 + (425 - x0) * k - W / 2) * S, (H / 2 - (y1 + (150 - y1) * k)) * S, .05 - k * .2); lic.scale.y = 1 - k * .6; });
      // One clean copy slides out of the front for the authorities.
      const copy = r.sheet(425, 250, 130, 80, labelCanvas('COPY\nfor the authorities', 130, 80, { font: '700 12px Georgia, serif' }), -.018); copy.scale.y = .01; strips.push(copy);
      r.later(() => r.anim(.6, (k) => { copy.scale.y = .01 + k * .99; copy.position.y = (H / 2 - 250) * S - k * .03; }), .3);
      r.later(() => { r.sfx('kachunk'); lic.visible = false; file.visible = true; stamp.visible = true; r.say('Copied for the authorities. Now pull the stamp down onto Mateo’s file.'); }, .9);
    };
    r.grab(lic, { down: (p) => { off = { x: p.x - x, y: p.y - y }; }, move: (p) => { if (shredded) return; x = p.x - off.x; y = p.y - off.y; lic.position.set((x - W / 2) * S, (H / 2 - y) * S, .05); }, up: () => { if (!shredded && x > 330 && x < 520 && y < 200) doShred(); } });
    const applyStamp = () => { stamp.position.y = (H / 2 - 150) * S - v * 98 * S; };
    const doStamp = () => { if (r.finished || !shredded) return; v = 1; applyStamp(); file.visible = false; held.visible = true; r.sfx('stamp'); r.sfx('kachunk'); r.say('Ethics hold stamped. The surgery cannot go ahead.'); r.finish(); r.later(() => r.anim(.4, (k) => { v = 1 - k; applyStamp(); }), .3); };
    r.grab(stamp, { down: (p) => { y0 = p.y - v * 98; }, move: (p) => { if (r.finished || !shredded) return; v = clamp((p.y - y0) / 98, 0, 1); applyStamp(); if (v >= 1) doStamp(); }, up: () => { if (!r.finished) r.anim(.2, (k) => { v *= 1 - k; applyStamp(); }); } });
    return { hint: 'Drag the consent form into the slot on top of the copier.', vet: [['Copy it', doShred], ['Stamp the file', () => { if (shredded && stamp.visible) r.anim(.3, (k) => { v = Math.max(v, k * .99); applyStamp(); }, doStamp); }]] };
  },

  // 12 ── Peel the black tint off the street window at dawn.
  peel(r) {
    const [cv, c] = canvasOf(W, H, 2), [scene, s] = canvasOf(W, H, 1);
    for (const [x, y, w, h] of [[280, -12, 620, 26], [280, 332, 620, 26], [-14, 160, 30, 372], [574, 160, 30, 372]]) r.box(x, y, w, h, .06, '#2c241b', -.03);
    const pane = r.sheet(280, 160, W, H, cv, .001);
    const g = s.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f6c66d'); g.addColorStop(.6, '#ffe3a3'); g.addColorStop(1, '#a8743c'); s.fillStyle = g; s.fillRect(0, 0, W, H);
    s.fillStyle = '#ffeec0'; s.beginPath(); s.arc(420, 150, 40, 0, 7); s.fill();
    s.fillStyle = '#5b4126'; for (let x = 0; x < W; x += 70) { const hh = 80 + (x * 37 % 90); s.fillRect(x, 220 - hh, 60, hh); }
    s.fillStyle = '#3a2a1a'; s.fillRect(0, 220, W, 100);
    for (const x of [120, 260, 360]) { s.fillStyle = '#20160e'; s.fillRect(x, 190, 22, 70); s.beginPath(); s.arc(x + 11, 182, 12, 0, 7); s.fill(); }
    const COLS = 112, cw = W / COLS, depth = new Float32Array(COLS);
    const draw = () => { c.drawImage(scene, 0, 0); c.fillStyle = '#0A0A0C'; for (let i = 0; i < COLS; i++) { const y = depth[i]; if (y < H) c.fillRect(i * cw, y + (i % 3) * 2, cw + .6, H - y); } pane.redraw(); };
    const tear = (x, y, speed) => {
      if (r.finished) return; const i0 = Math.floor(x / cw), half = 6;
      for (let i = Math.max(0, i0 - half); i <= Math.min(COLS - 1, i0 + half); i++) depth[i] = Math.max(depth[i], y - (Math.abs(i - i0) / half) * 24 + Math.random() * 6);
      r.sfx('tear', clamp(speed, .1, 1)); draw();
      if (depth.reduce((a, d) => a + Math.min(d, H), 0) / (COLS * H) >= .85) { depth.fill(H + 10); draw(); r.say('Across the road, people stop and look in.'); r.finish(); }
    };
    draw();
    let grab = null, col = 0;
    r.grab(pane, { down: (p) => { const i = clamp(Math.floor(p.x / cw), 0, COLS - 1); grab = p.y < 50 || p.y < depth[i] + 30 ? p : null; }, move: (p) => { if (!grab) return; const sp = Math.hypot(p.x - grab.x, p.y - grab.y) / 30; if (p.y > grab.y) tear(p.x, p.y, sp); grab = p; }, up: () => { grab = null; } });
    return { hint: 'Grab the film near the top and drag down to tear it away.', hold: { label: 'Hold to peel', tick: (pr) => { const target = pr * COLS; while (col < target && col < COLS) { tear(col * cw + cw / 2, H + 10, .6); col += 1; } }, done: () => { depth.fill(H + 10); tear(W / 2, H + 10, 1); } } };
  },

  // 13 ── Pencil rubbing: shade the blank sheet and the pressed-in writing shows as white lines.
  rubbing(r) {
    const title = r.opts.title || 'Blank pad', lines = r.opts.lines || ['4  0  9'];
    slab(r); r.box(280, 160, 580, 340, .014, '#d8cdb4'); r.box(280, -2, 580, 16, .017, '#5a2e24');
    const [cv, c] = canvasOf(W, H, 2), [lead, g] = canvasOf(W, H, 1), [dent, d] = canvasOf(W, H, 1), [tmp, tc] = canvasOf(W, H, 1);
    const page = r.sheet(280, 160, W, H, cv, .0145);
    d.fillStyle = '#000'; d.textAlign = 'center'; d.font = 'bold 54px "American Typewriter", "Courier New", monospace';
    lines.forEach((l, i, a) => d.fillText(l, W / 2, H / 2 + 18 - (a.length - 1) * 30 + i * 60));
    const dd = d.getImageData(0, 0, W, H).data, cells = [], CS = 16;
    for (let y = 0; y < H; y += CS) for (let x = 0; x < W; x += CS) { let on = false; for (let yy = y; yy < y + CS && !on; yy += 4) for (let xx = x; xx < x + CS; xx += 4) if (dd[(yy * W + xx) * 4 + 3] > 40) { on = true; break; } if (on) cells.push({ x: x + CS / 2, y: y + CS / 2, on: false }); }
    const draw = () => {
      c.fillStyle = '#efe6cf'; c.fillRect(0, 0, W, H); c.fillStyle = '#d9cdb0'; for (let y = 34; y < H; y += 26) c.fillRect(24, y, W - 48, 1);
      c.fillStyle = '#3b2f22'; c.font = 'bold 18px Rockwell, Georgia, serif'; c.textAlign = 'left'; c.fillText(title, 24, 26);
      tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, W, H); tc.drawImage(lead, 0, 0); tc.globalCompositeOperation = 'destination-out'; tc.drawImage(dent, 0, 0); c.drawImage(tmp, 0, 0); page.redraw();
    };
    let last = null;
    const shade = (x, y) => {
      if (r.finished) return;
      g.strokeStyle = 'rgba(52,50,56,.32)'; g.lineWidth = 3; g.lineCap = 'round';
      for (let i = 0; i < 9; i++) { const ox = x + (Math.random() - .5) * 34, oy = y + (Math.random() - .5) * 34; g.beginPath(); g.moveTo(ox - 12, oy + 7); g.lineTo(ox + 12, oy - 7); g.stroke(); }
      if (last) { g.lineWidth = 22; g.strokeStyle = 'rgba(52,50,56,.08)'; g.beginPath(); g.moveTo(last.x, last.y); g.lineTo(x, y); g.stroke(); }
      last = { x, y };
      for (const q of cells) if (!q.on && Math.hypot(q.x - x, q.y - y) < 30) q.on = true;
      r.sfx('grind', .3); draw();
      if (cells.filter((q) => q.on).length / cells.length >= .7) { g.fillStyle = 'rgba(52,50,56,.55)'; g.fillRect(0, 34, W, H - 34); draw(); r.say(`Pressed into the paper: ${lines.join(' ')}`); r.finish(); }
    };
    draw();
    // The pencil leans over the page under the pointer.
    const pencil = r.node(280, 160, .02); const body = r.rod(46, -46, 150, .005, '#c9a24a', .05, pencil); body.rotation.set(0, -.6, .78); const tip = r.rod(3, -3, 16, .003, '#3b3b40', .006, pencil); tip.rotation.set(0, -.6, .78); r.tool(pencil, .016);
    const st = r.stroke(shade); r.grab(page, { down: (p) => { last = null; st.down(p); }, move: st.move });
    let k = 0;
    return { hint: 'Hold the mouse button and scribble across the paper with the pencil.', hold: { label: 'Hold to shade it', tick: () => { const q = cells[k++ % cells.length]; if (q) shade(q.x, q.y); }, done: () => cells.forEach((q) => shade(q.x, q.y)) } };
  },

  // 14 ── Torn pieces: slide the scraps back into place; each snaps when it is close.
  torn(r) {
    const doc = r.opts.doc || { title: 'A torn note', lines: [] };
    slab(r);
    const X = 170, Y = 70, DW = 220, DH = 180, mx = X + DW / 2 + 8, my = Y + DH / 2 - 6;
    r.box(X + DW / 2, Y + DH / 2, DW + 8, DH + 8, .0006, '#2f2014');
    const rag = (x0, y0, x1, y1) => Array.from({ length: 5 }, (_, i) => { const t = i / 4, j = i % 4 ? (i % 2 ? 7 : -6) : 0; return x0 === x1 ? [x0 + j, y0 + (y1 - y0) * t] : [x0 + (x1 - x0) * t, y0 + j]; });
    const vT = rag(mx, Y - 4, mx, my), vB = rag(mx, my, mx, Y + DH + 4), hL = rag(X - 4, my, mx, my), hR = rag(mx, my, X + DW + 4, my), rev = (a) => a.slice().reverse();
    const polys = [[[X - 4, Y - 4], ...vT, ...rev(hL)], [...vT, ...hR, [X + DW + 4, Y - 4]], [...hL, ...vB, [X - 4, Y + DH + 4]], [...hR, [X + DW + 4, Y + DH + 4], ...rev(vB)]];
    const tex = new THREE.CanvasTexture(docCanvas(doc, DW, DH)); tex.colorSpace = THREE.SRGBColorSpace; const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    const home = [[X + DW / 4, Y + DH / 4], [X + DW * .75, Y + DH / 4], [X + DW / 4, Y + DH * .75], [X + DW * .75, Y + DH * .75]];
    const start = [[40, 50], [520, 40], [30, 270], [530, 265]].sort(() => Math.random() - .5), placed = new Set(), scraps = [];
    polys.forEach((pts, i) => {
      const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([px, py]) => new THREE.Vector2((px - X) * S, -(py - Y) * S))));
      const uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / (DW * S), 1 + uv.getY(k) / (DH * S));
      geo.translate(-(home[i][0] - X) * S, (home[i][1] - Y) * S, 0);
      const sc = { x: start[i][0], y: start[i][1], rot: (Math.random() * 60 - 30) * Math.PI / 180, n: r.node(0, 0) }; sc.n.add(new THREE.Mesh(geo, mat)); scraps.push(sc);
      const put = (z = .002 + i * .0006) => { sc.n.position.set((sc.x - W / 2) * S, (H / 2 - sc.y) * S, z); sc.n.rotation.z = sc.rot; };
      sc.put = put; put();
      sc.snap = () => { if (placed.has(i)) return; placed.add(i); const x0 = sc.x, y0 = sc.y, r0 = sc.rot; r.sfx('thud'); r.anim(.25, (k) => { sc.x = x0 + (home[i][0] - x0) * k; sc.y = y0 + (home[i][1] - y0) * k; sc.rot = r0 * (1 - k); put(.0012); }); if (placed.size === 4) { r.say(doc.lines?.length ? `It reads: ${doc.lines.join(', ')}.` : 'Whole again.'); r.finish(); } };
      let off = null;
      r.grab(sc.n, { down: (p) => { if (placed.has(i)) return; off = { x: p.x - sc.x, y: p.y - sc.y }; r.sfx('slide'); }, move: (p) => { if (!off) return; sc.x = p.x - off.x; sc.y = p.y - off.y; sc.rot *= .9; put(.03); }, up: () => { if (!off) return; off = null; put(); if (Math.hypot(sc.x - home[i][0], sc.y - home[i][1]) < 32) sc.snap(); } });
    });
    return { hint: 'Slide the torn pieces back together. Each one clicks into place when it’s close.', vet: [['Fit the next piece', () => scraps.find((s, i) => !placed.has(i))?.snap()]], destroy() { tex.dispose(); mat.dispose(); } };
  },

  // 15 ── Torch search: sweep the beam through the dark until something glints, then pick it up.
  torch(r) {
    slab(r);
    const [fcv, s] = canvasOf(W, H, 2);
    s.fillStyle = '#3a2a1c'; s.fillRect(0, 0, W, H); for (let y = 0; y < H; y += 34) { s.fillStyle = y % 68 ? '#33251a' : '#3e2d1f'; s.fillRect(0, y, W, 32); }
    for (let i = 0; i < 70; i++) { s.fillStyle = `rgba(200,190,170,${Math.random() * .25})`; s.beginPath(); s.arc(Math.random() * W, 60 + Math.random() * (H - 70), Math.random() * 3 + .5, 0, 7); s.fill(); }
    r.sheet(280, 160, W, H, fcv, .0005);
    for (let i = 0; i < 4; i++) r.box(60 + Math.random() * 440, 100 + Math.random() * 190, 36, 22, .001, '#b9ac8c', .001).rotation.z = Math.random() * 2 - 1;
    const tx = 90 + Math.random() * 380, ty = 130 + Math.random() * 150;
    const key = r.node(tx, ty, .004); key.rotation.z = .5; r.ring(-14, 0, 9, .003, '#d4aa5c', 0, key); r.box(10, 0, 32, 6, .004, '#d4aa5c', -.002, key); r.box(22, 6, 5, 8, .004, '#d4aa5c', -.002, key);
    const glint = r.node(tx, ty, .03); const gm = r.glow('#fff0be'); for (const a of [0, Math.PI / 2]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.03, .003), gm); m.rotation.z = a; glint.add(m); } glint.visible = false;
    const [dcv, dc] = canvasOf(W, H, 1), dark = r.sheet(280, 160, W + 300, H + 200, dcv, .012, null, true);
    let bx = W / 2, by = H / 2, t = 0, got = false;
    r.tick((dt) => {
      t += dt; if (got) return;
      const ux = (bx + 150) / (W + 300) * W, uy = (by + 100) / (H + 200) * H, rad = 95 * W / (W + 300);
      dc.globalCompositeOperation = 'source-over'; dc.clearRect(0, 0, W, H); dc.fillStyle = 'rgba(4,3,2,.97)'; dc.fillRect(0, 0, W, H);
      dc.globalCompositeOperation = 'destination-out'; const gr = dc.createRadialGradient(ux, uy, 6, ux, uy, rad); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.6, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); dc.fillStyle = gr; dc.fillRect(0, 0, W, H); dark.redraw();
      glint.visible = Math.hypot(bx - tx, by - ty) < 70; glint.scale.setScalar(1 + Math.sin(t * 9) * .35);
    });
    const lamp = r.node(280, 160, .1); r.cyl(0, 0, 14, .1, BLACK, 0, lamp); r.cyl(0, 0, 19, .02, '#3b3b40', -.02, lamp);
    r.hover = (p) => { bx = p.x; by = p.y; lamp.position.set((p.x - W / 2) * S + .05, (H / 2 - p.y) * S - .05, .1); };
    const grab = () => { if (got) return; got = true; r.sfx('clink'); r.say('The closet key.'); glint.visible = false; r.anim(.5, (k) => { dark.material.opacity = 1 - k; }); r.anim(.8, (k) => { key.position.z = .004 + k * .3; key.rotation.z = .5 + k; }); r.finish(); };
    r.grab(dark, { down: (p) => { bx = p.x; by = p.y; if (Math.hypot(p.x - tx, p.y - ty) < 36) grab(); else r.sfx('click'); }, move: (p) => r.hover(p) });
    return { hint: 'Move the torch through the dark. Pick up whatever glints.', hold: { label: 'Hold to search', tick: () => { bx += (tx - bx) * .08; by += (ty - by) * .08; }, done: grab } };
  },

  // 17 ── Registration: slide the carbon sheet until its red crosses sit on the black ones.
  align(r) {
    slab(r);
    const k = 1.6, bw = 270 * k, bh = 134 * k, tol = 5 * (r.opts.ease || 1), marks = [[32, 26], [238, 108]];
    const cross = (x, col) => { x.strokeStyle = col; x.lineWidth = 4; for (const [mx, my] of marks) { x.beginPath(); x.moveTo((mx - 9) * k, my * k); x.lineTo((mx + 9) * k, my * k); x.moveTo(mx * k, (my - 9) * k); x.lineTo(mx * k, (my + 9) * k); x.stroke(); } };
    const [bcv, b] = canvasOf(bw, bh, 2); b.fillStyle = '#d6bf91'; b.fillRect(0, 0, bw, bh); b.strokeStyle = '#614e39'; b.strokeRect(1, 1, bw - 2, bh - 2); cross(b, '#211c18');
    b.fillStyle = '#3b2f22'; b.font = '700 20px Rockwell, Georgia, serif'; b.fillText('AEGIS  /  AGENCY COPY', 88, 96); b.fillStyle = '#8c7859'; b.fillRect(88, 118, 260, 2); b.fillRect(88, 134, 196, 2);
    r.sheet(280, 160, bw, bh, bcv, .001);
    const [ccv, c] = canvasOf(bw, bh, 2); c.fillStyle = 'rgba(68,84,97,.32)'; c.fillRect(0, 0, bw, bh); c.setLineDash([10, 6]); c.strokeStyle = '#894b34'; c.lineWidth = 2; c.strokeRect(2, 2, bw - 4, bh - 4); c.setLineDash([]); cross(c, '#c0392b');
    const sheet = r.sheet(280, 160, bw, bh, ccv, .005, null, true);
    let x = -24 * k, y = 18 * k, off;
    const put = (z = .005) => sheet.position.set(x * S, -y * S, z); put();
    const press = () => { if (r.finished) return; x = y = 0; put(.002); r.sfx('kachunk'); r.say('Both registration marks line up.'); r.finish(); };
    const check = () => { if (Math.abs(x) <= tol && Math.abs(y) <= tol) press(); else r.say('The crosses still have two centres.'); };
    r.grab(sheet, { down: (p) => { off = { x: p.x - x, y: p.y - y }; r.sfx('slide'); }, move: (p) => { if (r.finished) return; x = clamp(p.x - off.x, -80, 80); y = clamp(p.y - off.y, -60, 60); put(.02); }, up: () => { put(); check(); } });
    const nudge = (dx, dy) => () => { if (r.finished) return; x += dx; y += dy; put(); if (Math.abs(x) <= tol && Math.abs(y) <= tol) press(); };
    return { hint: 'Slide the carbon sheet until the red crosses sit on the black ones.', vet: [['◀', nudge(-6, 0)], ['▶', nudge(6, 0)], ['▲', nudge(0, -6)], ['▼', nudge(0, 6)]] };
  },

  // 18 ── Freight tickets: pick up the one that matches both marks on the rubbing.
  tickets(r) {
    slab(r);
    r.label('Your pencil rubbing\nK7  /  PIER 9', 280, 46, 250, 64, .002, null, { bg: '#efe6cf', font: '700 18px Rockwell, Georgia, serif' });
    [['north', 'K4', 'Pier 9', '23:15'], ['maritime', 'K7', 'Pier 9', '00:40'], ['east', 'K7', 'Pier 3', '00:10']].forEach(([id, seal, pier, time], i) => {
      const [cv, x] = canvasOf(150, 160, 3); x.fillStyle = '#e3d6b4'; x.fillRect(0, 0, 150, 160); x.strokeStyle = '#8f7650'; x.lineWidth = 2; x.strokeRect(3, 3, 144, 154); x.textAlign = 'center';
      x.fillStyle = '#6b5a3c'; x.font = '700 11px Georgia, serif'; x.fillText('PORT AUTHORITY', 75, 26); x.fillStyle = '#2b2620'; x.font = '700 44px Rockwell, Georgia, serif'; x.fillText(seal, 75, 78); x.font = '600 19px Georgia, serif'; x.fillText(pier, 75, 108); x.font = '700 17px "American Typewriter", "Courier New", monospace'; x.fillStyle = '#23305f'; x.fillText('out ' + time, 75, 138);
      const tilt = (i - 1) * -.06, m = r.sheet(110 + i * 170, 205, 150, 160, cv, .002 + i * .0005); m.rotation.z = tilt;
      r.grab(m, { down: () => { if (r.finished) return;
        if (id === 'maritime') { r.sfx('slide'); r.say('K7, Pier 9, out at 00:40. That’s the one.'); r.anim(.6, (q) => { m.position.z = .003 + q * .18; m.rotation.z = tilt * (1 - q); }); r.finish(); }
        else { r.sfx('thud'); r.say('That ticket doesn’t match both marks.'); r.anim(.35, (q) => { m.rotation.z = tilt + Math.sin(q * Math.PI * 3) * .08 * (1 - q); }); } } });
    });
    return { hint: 'Pick up the ticket that matches both marks on your rubbing.' };
  },

  // 19 ── Corkboard: tie a red thread from the open case file to the lead that answers it.
  thread(r) {
    const { cards = [], current = 0, linked = [] } = r.opts, order = [2, 0, 1], LX = 130, RX = 430, yOf = (i) => 68 + i * 92;
    r.box(280, 160, 640, 380, .03, '#8a6a45', -.03); for (const [x, y, w, h] of [[280, -36, 664, 14], [280, 356, 664, 14], [-46, 160, 14, 392], [606, 160, 14, 392]]) r.box(x, y, w, h, .045, '#3b2a1b', -.03);
    const card = (kicker, text, x, y, dim, pad = 12) => { const [cv, c] = canvasOf(200, 72, 3); c.fillStyle = dim ? '#b9ad92' : '#ece1c4'; c.fillRect(0, 0, 200, 72); c.fillStyle = '#7a6a4c'; c.font = '700 10px Georgia, serif'; c.fillText(kicker.toUpperCase(), pad, 18); c.fillStyle = '#2b2620'; c.font = '700 15px Rockwell, Georgia, serif'; wrap(c, text, 190 - pad).slice(0, 2).forEach((l, i) => c.fillText(l, pad, 40 + i * 18)); return r.sheet(x, y, 200, 72, cv, .002); };
    const pin = (x, y) => r.cyl(x, y, 6, .012, '#a3271c', .002);
    const tie = (i) => r.g.add(r.tube(LX + 86, yOf(i), RX - 86, yOf(order.indexOf(i)), .03, '#a3271c', .003));
    const lefts = cards.map((c, i) => { const m = card('Case ' + (i + 1), i <= current ? c.pillar : 'Sealed file', LX, yOf(i), i > current); pin(LX + 86, yOf(i)); return m; });
    order.forEach((id, k) => { card('Recovered lead', cards[id]?.answer || '', RX, yOf(k), false, 30); pin(RX - 86, yOf(k)); });
    linked.forEach(tie);
    let temp = null; const setTemp = (m) => { if (temp) { r.g.remove(temp); temp.geometry.dispose(); } temp = m; if (m) r.g.add(m); };
    const choose = (k) => { if (r.finished) return; if (order[k] === current) { tie(current); r.sfx('wire'); r.say('The thread holds. File pinned.'); r.finish({ ok: true }); } else { r.sfx('thud'); r.say('That thread doesn’t hold. Try another lead.'); r.opts.onWrong?.(); } };
    if (lefts[current]) r.grab(lefts[current], { move: (p) => { if (!r.finished) setTemp(r.tube(LX + 86, yOf(current), p.x, p.y, .04, '#a3271c', .003)); }, up: (p) => { setTemp(null); const k = order.findIndex((_, q) => Math.abs(p.x - RX) < 110 && Math.abs(p.y - yOf(q)) < 44); if (k >= 0) choose(k); } });
    return { hint: `Drag a red thread from Case ${current + 1} to the lead that answers it.`, vet: order.map((id, k) => [cards[id]?.answer || 'Lead ' + (k + 1), () => choose(k)]) };
  },

  // 16 ── Pick something up and read it: the paper comes up off the prop toward you.
  read(r) {
    const w = 340, h = 250, [cv, x] = canvasOf(w, h, 4);
    x.fillStyle = '#ece1c4'; x.fillRect(0, 0, w, h); x.strokeStyle = '#a99168'; x.lineWidth = 1.5; x.strokeRect(1, 1, w - 2, h - 2);
    x.fillStyle = '#7a6a4c'; x.font = '600 10px Georgia, serif'; x.fillText(String(r.opts.name || '').toUpperCase(), 18, 24);
    x.fillStyle = '#2b2620'; x.font = '700 19px Rockwell, Georgia, serif'; let y = 50; for (const l of wrap(x, r.opts.title || '', w - 36)) { x.fillText(l, 18, y); y += 23; }
    x.fillRect(18, y - 12, w - 36, 1.5); y += 14;
    x.fillStyle = '#23305f'; x.font = '15px "American Typewriter", "Courier New", monospace'; for (const l of wrap(x, r.opts.body || '', w - 36)) { x.fillText(l, 18, y); y += 21; }
    const page = r.sheet(280, 160, w, h, cv, 0); let put = false;
    r.anim(.55, (k) => { page.position.z = -.25 + k * .25; page.position.y = -.12 * (1 - k); page.scale.setScalar(.35 + k * .65); page.rotation.x = -(1 - k) * 1.1; });
    const back = () => { if (put) return; put = true; r.sfx('slide'); r.anim(.35, (k) => { page.position.z = -k * .25; page.position.y = -.12 * k; page.scale.setScalar(1 - k * .65); page.rotation.x = -k * 1.1; }, () => r.finish(null, 0)); };
    r.grab(page, { down: back });
    return { hint: 'Click the paper to put it back.', vet: [['Put it back', back]], twist(dAngle, dScale) { if (put) return; page.rotation.z -= dAngle; page.scale.setScalar(clamp(page.scale.x * dScale, .6, 1.8)); } };
  },
};
