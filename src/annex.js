import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as models from './models.js';
import { SpriteSheetAnimator, makeSheet } from './sprites.js';
import { cracks } from './paper.js';

// The records annex south of the office, plus a few extra searchable props in the office itself.
// Solid parts are modelled from rounded boxes, lathes and tubes, then merged into one mesh per colour.
export function buildAnnex(scene, factory) {
  const root = new THREE.Group();
  root.name = 'Records annex';
  scene.add(root);
  const parts = new Map(), tmp = new THREE.Object3D(), V = (x, y, z) => new THREE.Vector3(x, y, z);
  const owned = new Set();
  function add(geo, x, y, z, col, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    tmp.position.set(x, y, z); tmp.rotation.set(rx, ry, rz); tmp.scale.set(sx, sy, sz); tmp.updateMatrix();
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(tmp.matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!parts.has(col)) parts.set(col, []);
    parts.get(col).push(g);
    geo.dispose();
  }
  const rounded = (w, h, d) => new RoundedBoxGeometry(w, h, d, 2, Math.max(.002, Math.min(.028, Math.min(w, h, d) * .32)));
  const box = (x, y, z, w, h, d, col, ry = 0, rx = 0, rz = 0) => add(rounded(w, h, d), x, y, z, col, rx, ry, rz);
  const cyl = (x, y, z, r0, r1, h, col, seg = 18, rx = 0, rz = 0, open = false) =>
    add(new THREE.CylinderGeometry(r1, r0, h, seg, 1, open), x, y, z, col, rx, 0, rz);
  const ball = (x, y, z, r, col, sx = 1, sy = 1, sz = 1, seg = 12) => add(new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)), x, y, z, col, 0, 0, 0, sx, sy, sz);
  function rod(a, b, r, col, seg = 8) {
    const A = V(...a), B = V(...b), d = B.clone().sub(A), g = new THREE.CylinderGeometry(r, r, d.length(), seg);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
    const e = new THREE.Euler().setFromQuaternion(q);
    add(g, A.x + d.x / 2, A.y + d.y / 2, A.z + d.z / 2, col, e.x, e.y, e.z);
  }
  function lathe(points, x, y, z, col, seg = 24, sx = 1, sz = 1, ry = 0) {
    add(new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(r, h)), seg), x, y, z, col, 0, ry, 0, sx, 1, sz);
  }
  // Printed surfaces stay unlit so their text remains crisp.
  function printed(id, lines, w, h, base = '#d8c59b') {
    return factory.make('annex-' + id, 512, Math.round(512 * h / w), (c, cw, ch, r) => {
      c.fillStyle = base; c.fillRect(0, 0, cw, ch);
      for (let i = 0; i < cw * ch / 60; i++) { c.fillStyle = i % 3 ? 'rgba(70,45,22,.14)' : 'rgba(255,240,205,.25)'; c.fillRect(r() * cw, r() * ch, 2, 1); }
      c.strokeStyle = '#6f5636'; c.lineWidth = 3; c.strokeRect(9, 9, cw - 18, ch - 18);
      c.fillStyle = '#4c3a26'; c.textAlign = 'center'; c.font = 'bold 26px monospace'; c.fillText(lines[0], cw / 2, 52, cw - 40);
      c.fillStyle = '#211913'; c.font = 'bold 54px Georgia'; c.fillText(lines[1] || '', cw / 2, 118, cw - 40);
      c.textAlign = 'left'; c.font = '24px monospace';
      for (let i = 2; i < lines.length; i++) c.fillText(lines[i], 30, 170 + (i - 2) * 36, cw - 60);
    });
  }
  function sheet(tex, x, y, z, w, h, rx = 0, ry = 0, rz = 0, alpha = false) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: alpha, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz); root.add(m); owned.add(m.geometry); owned.add(m.material);
    return m;
  }
  const wood = '#6b4c2e', darkWood = '#3e2d1d', brass = '#b48a4e', iron = '#3b3a35', cloth = '#6e3b2c';

  // ── Coat rack with a trench coat and a fedora ──
  {
    const x = -4.05, z = 7.0;
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; rod([x, .02, z], [x + Math.cos(a) * .3, .015, z + Math.sin(a) * .3], .018, darkWood); }
    cyl(x, .95, z, .028, .022, 1.86, darkWood, 12);
    ball(x, 1.9, z, .045, brass);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4; rod([x, 1.74, z], [x + Math.cos(a) * .2, 1.84, z + Math.sin(a) * .2], .011, brass); }
    // Coat: a flared lathe, flattened front to back, with a collar and a belt.
    // Coat hung by its collar: a narrow skirted body, squared shoulders, two hanging sleeves and a belt.
    const cx = x + .13, cz = z + .02;
    lathe([[0, 0], [.21, .02], [.2, .3], [.17, .62], [.18, .82], [.2, .9], [.12, .96], [0, .97]], cx, .66, cz, '#5b4a35', 22, 1, .5);
    box(cx, 1.55, cz, .42, .09, .17, '#5b4a35');
    for (const side of [-1, 1]) { rod([cx + side * .2, 1.53, cz], [cx + side * .22, 1.0, cz + .02], .05, '#54442f', 10); ball(cx + side * .22, .98, cz + .02, .05, '#54442f'); }
    box(cx, 1.62, cz, .2, .07, .14, '#4a3b29');
    box(cx, 1.06, cz + .005, .4, .05, .2, '#3f3224');
    box(cx, 1.06, cz + .1, .07, .07, .02, brass);
    // Fedora on the opposite hook.
    cyl(x - .14, 1.83, z - .1, .1, .085, .1, '#2e2720', 20);
    cyl(x - .14, 1.79, z - .1, .19, .19, .012, '#2e2720', 28);
    cyl(x - .14, 1.8, z - .1, .101, .101, .025, '#7c5c34', 20);
  }

  // ── Waiting bench with slatted back and a worn cushion ──
  {
    const x = -4.12, z0 = 7.78, z1 = 9.42, mid = (z0 + z1) / 2, len = z1 - z0;
    box(x, .44, mid, .5, .06, len, wood);
    box(x + .02, .51, mid, .44, .08, len - .1, cloth);
    for (const z of [z0 + .08, z1 - .08]) for (const dx of [-.2, .2]) box(x + dx, .21, z, .06, .42, .06, darkWood);
    for (const z of [z0 + .08, z1 - .08]) box(x - .21, .78, z, .05, .62, .06, darkWood);
    for (let i = 0; i < 4; i++) box(x - .22, .62 + i * .14, mid, .04, .085, len - .1, wood);
    box(x + .2, .22, mid, .04, .05, len - .14, darkWood);
  }
  // Framed certificate above the bench.
  box(-4.44, 1.75, 8.6, .04, .62, .86, '#7a5a35');
  sheet(printed('certificate', ['AEGIS GLOBAL PATHWAYS', 'Licensed Charity', 'Overseas placements & care', 'Reg. no. 1147-C'], .76, .52, '#e2d2a8'), -4.415, 1.75, 8.6, .74, .52, 0, Math.PI / 2);

  // ── Records shelving along the south wall ──
  const folderCols = ['#7d6440', '#8f7a52', '#5b4b33', '#a08860', '#6c5a3c', '#4d4632', '#93754a', '#b19c72'];
  for (const [ui, cx] of [-2.3, -1.1, .1].entries()) {
    const z = 10.02, w = 1.14, d = .42, H = 2.3;
    for (const sx of [-1, 1]) box(cx + sx * (w / 2 - .02), H / 2, z, .04, H, d, darkWood);
    box(cx, H / 2, z + d / 2 - .01, w, H, .02, '#2c2219');
    for (let s = 0; s < 5; s++) {
      const y = .08 + s * .53;
      box(cx, y, z, w - .04, .035, d, wood);
      if (s === 4) continue;
      let xx = cx - w / 2 + .06;
      for (let j = 0; xx < cx + w / 2 - .12; j++) {
        const bw = .07 + ((j * 7 + s * 3 + ui * 5) % 5) * .02, bh = .3 + ((j * 3 + s + ui) % 4) * .045, lean = (j + s) % 9 === 0 ? .14 : 0;
        const col = folderCols[(j * 3 + s * 5 + ui * 2) % folderCols.length];
        box(xx + bw / 2, y + .02 + bh / 2, z - .02, bw - .01, bh, d - .1, col, 0, 0, lean);
        box(xx + bw / 2, y + .02 + bh * .72, z - d / 2 + .065, (bw - .01) * .6, .05, .01, '#d8c79f');
        xx += bw + (lean ? .05 : 0);
      }
    }
    box(cx, H + .03, z, w + .04, .05, d + .04, wood);
    sheet(printed('shelf-' + ui, ['PATIENT RECORDS', ['401 – 406', '407 – 412', '413 – 418'][ui]], .4, .14, '#e5d5ad'), cx, 2.18, z - d / 2 - .002, .38, .13, 0, Math.PI);
  }

  // ── Typist's desk, typewriter and chair ──
  {
    const x = .9, z = 8.0, top = .76;
    box(x, top, z, 1.32, .05, .72, wood);
    for (const dx of [-.6, .6]) for (const dz of [-.3, .3]) if (!(dx > 0)) box(x + dx, top / 2, z + dz, .05, top, .05, darkWood);
    box(x + .42, top / 2 - .01, z, .46, top - .04, .66, wood);
    for (let i = 0; i < 3; i++) { box(x + .42, .15 + i * .22, z - .335, .42, .19, .02, '#5c4128'); box(x + .42, .2 + i * .22, z - .35, .1, .022, .022, brass); }
    // Typewriter: sloped body, key rows, roller and return lever.
    const tx = x - .1, tz = z - .02, ty = top + .025;
    box(tx, ty + .06, tz, .44, .12, .34, '#262420');
    box(tx, ty + .11, tz + .06, .4, .06, .2, '#2f2c27', 0, -.28);
    for (let row = 0; row < 4; row++) for (let k = 0; k < 9 - (row % 2); k++) {
      const kx = tx - .16 + k * .04 + (row % 2) * .02, kz = tz - .12 + row * .045, ky = ty + .13 - row * .016;
      cyl(kx, ky, kz, .013, .013, .02, '#1b1a17', 10); cyl(kx, ky + .011, kz, .011, .011, .004, '#d9cba8', 10);
    }
    cyl(tx, ty + .17, tz + .13, .03, .03, .5, '#1e1c19', 16, 0, Math.PI / 2);
    for (const sx of [-1, 1]) cyl(tx + sx * .26, ty + .17, tz + .13, .038, .038, .03, '#3a3631', 14, 0, Math.PI / 2);
    rod([tx - .27, ty + .18, tz + .1], [tx - .36, ty + .22, tz + .02], .007, '#b9b2a2');
    sheet(printed('letter', ['DEAR FAMILY', '', 'Mateo has begun his', 'placement and is very', 'happy. Please do not', 'try to visit…'], .22, .3, '#efe4c8'), tx, ty + .32, tz + .145, .22, .3, -.18);
    // Desk lamp, inkwell and a stack of carbon forms.
    cyl(x + .5, top + .035, z - .2, .07, .08, .02, brass, 18);
    rod([x + .5, top + .04, z - .2], [x + .45, top + .38, z - .1], .01, brass);
    lathe([[.03, 0], [.09, .06], [.11, .13], [0, .13]], x + .43, top + .3, z - .05, '#2f4a3c', 18);
    box(x + .2, top + .04, z + .18, .24, .03, .3, '#d8c79f', .2);
    box(x + .2, top + .06, z + .18, .24, .01, .3, '#c2ad7f', .26);
    // Chair facing the desk.
    const cx = x, cz = z + .68;
    box(cx, .46, cz, .44, .05, .42, wood);
    for (const dx of [-.19, .19]) for (const dz of [-.17, .17]) rod([cx + dx, 0, cz + dz], [cx + dx * .92, .45, cz + dz * .92], .018, darkWood);
    for (const dx of [-.18, .18]) rod([cx + dx, .46, cz + .19], [cx + dx, .95, cz + .23], .018, darkWood);
    box(cx, .84, cz + .22, .42, .14, .03, wood, 0, -.1);
  }

  // ── Office safe ──
  {
    const x = 1.38, z = 9.97;
    box(x, .47, z, .74, .82, .6, '#3b4038');
    box(x, .47, z - .305, .62, .7, .02, '#444a41');
    for (const dx of [-.3, .3]) for (const dz of [-.24, .24]) cyl(x + dx, .03, z + dz, .035, .035, .05, iron, 10);
    cyl(x + .1, .62, z - .325, .07, .07, .03, '#24261f', 24, Math.PI / 2);
    cyl(x + .1, .62, z - .343, .055, .055, .012, brass, 24, Math.PI / 2);
    rod([x - .16, .42, z - .33], [x - .16, .55, z - .33], .014, brass);
    box(x - .1, .82, z - .318, .26, .06, .01, brass);
  }

  // ── Examination gurney with straps, behind a three-panel screen ──
  {
    const x = 3.3, z0 = 8.45, z1 = 10.1, mid = (z0 + z1) / 2;
    for (const dx of [-.3, .3]) {
      rod([x + dx, .66, z0], [x + dx, .66, z1], .016, '#a7a597');
      for (const z of [z0 + .06, z1 - .06]) { rod([x + dx, .08, z], [x + dx, .66, z], .016, '#a7a597'); add(new THREE.TorusGeometry(.055, .018, 8, 16), x + dx, .06, z, iron, 0, Math.PI / 2); }
    }
    rod([x - .3, .3, mid], [x + .3, .3, mid], .012, '#a7a597');
    box(x, .73, mid + .25, .66, .1, 1.3, '#cfc6ad');
    box(x, .83, z0 + .3, .66, .1, .62, '#cfc6ad', 0, .35);
    box(x, .88, z0 + .2, .44, .08, .22, '#e3dcc6', 0, .35);
    for (const z of [mid, mid + .55]) { box(x, .79, z, .7, .02, .07, '#3b2a1c'); box(x + .34, .79, z, .05, .04, .08, brass); }
  }
  // ── Glass-fronted medicine cabinet ──
  {
    const x = 4.24, z = 7.05;
    box(x, .93, z, .42, 1.86, .98, '#d9d2bd');
    box(x - .2, .93, z, .02, 1.7, .9, '#2c2a24');
    for (let s = 0; s < 4; s++) {
      const y = .35 + s * .4;
      box(x - .02, y, z, .36, .02, .9, '#bdb49a');
      for (let b = 0; b < 7; b++) {
        const bz = z - .38 + b * .125, h = .1 + ((b + s) % 3) * .04, col = ['#6e4a2a', '#2f4b44', '#8a8170', '#4b3a5a'][(b + s * 2) % 4];
        cyl(x - .06, y + .01 + h / 2, bz, .032, .03, h, col, 10);
        cyl(x - .06, y + .02 + h, bz, .018, .018, .03, '#e6dcc2', 8);
      }
    }
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(.88, 1.66), new THREE.MeshBasicMaterial({ color: '#b9d2cf', transparent: true, opacity: .16, depthWrite: false }));
    glass.position.set(x - .215, .93, z); glass.rotation.y = -Math.PI / 2; root.add(glass); owned.add(glass.geometry); owned.add(glass.material);
    for (const dz of [-.45, 0, .45]) box(x - .22, .93, z + dz, .025, 1.7, .03, '#bdb49a');
    box(x - .23, .95, z - .05, .03, .1, .02, brass);
    box(x - .23, .95, z + .05, .03, .1, .02, brass);
    sheet(printed('poison', ['DISPENSARY', 'STAFF ONLY'], .3, .12, '#e7dab5'), x - .222, 1.92, z, .36, .14, 0, -Math.PI / 2);
  }

  // ── Notice board on the annex side of the partition ──
  {
    const x = .98, y = 1.75, z = 6.53;
    box(x, y, z, 1.46, .96, .04, '#6b4e2f');
    const cork = factory.make('annex-cork', 512, 340, (c, w, h, r) => {
      c.fillStyle = '#9b7a4f'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { c.fillStyle = r() > .5 ? '#7d5f3a' : '#b38f5d'; c.fillRect(r() * w, r() * h, 2, 2); }
      const notes = [[30, 30, 150, 110, '#e8dcb8', 'STAFF ROTA'], [210, 22, 130, 150, '#d9cfb0', 'COURIERS'], [370, 40, 115, 160, '#efe6cc', 'MISSING'], [60, 170, 170, 120, '#e3d6ad', 'NOTICE']];
      for (const [nx, ny, nw, nh, col, title] of notes) {
        c.save(); c.translate(nx + nw / 2, ny + nh / 2); c.rotate((r() - .5) * .12);
        c.fillStyle = '#0003'; c.fillRect(-nw / 2 + 4, -nh / 2 + 5, nw, nh);
        c.fillStyle = col; c.fillRect(-nw / 2, -nh / 2, nw, nh);
        c.fillStyle = '#3a2c1d'; c.font = 'bold 18px monospace'; c.textAlign = 'center'; c.fillText(title, 0, -nh / 2 + 26);
        for (let l = 0; l < 4; l++) { c.fillStyle = '#6c5a42'; c.fillRect(-nw / 2 + 12, -nh / 2 + 42 + l * 16, nw - 24 - r() * 30, 3); }
        if (title === 'MISSING') { c.fillStyle = '#5b4a38'; c.fillRect(-28, -12, 56, 64); c.clearRect(-nw / 2, nh / 2 - 50, nw, 50); c.fillStyle = '#9b7a4f'; c.fillRect(-nw / 2, nh / 2 - 50, nw, 50); }
        c.fillStyle = '#b3402c'; c.beginPath(); c.arc(0, -nh / 2 + 7, 5, 0, 7); c.fill();
        c.restore();
      }
    });
    sheet(cork, x, y, z + .022, 1.36, .88);
  }

  // ── Pendant lamp and a rug ──
  rod([0, 4.48, 8.4], [0, 3.55, 8.4], .008, '#1c1a16');
  lathe([[.06, .22], [.14, .16], [.27, .02], [.3, 0]], 0, 3.3, 8.4, '#2f4a3c', 28);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.06, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffe3a6' }));
  bulb.position.set(0, 3.33, 8.4); root.add(bulb); owned.add(bulb.geometry); owned.add(bulb.material);
  const rug = factory.make('annex-rug', 512, 384, (c, w, h, r) => {
    c.fillStyle = '#5a2e22'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#b3884f'; c.lineWidth = 10; c.strokeRect(22, 22, w - 44, h - 44);
    c.strokeStyle = '#2f1a14'; c.lineWidth = 4; c.strokeRect(44, 44, w - 88, h - 88);
    c.fillStyle = '#8a5a34';
    for (let i = 0; i < 5; i++) { c.save(); c.translate(w / 2, h / 2); c.rotate(i * Math.PI / 5); c.fillRect(-120, -6, 240, 12); c.restore(); }
    for (let i = 0; i < 9000; i++) { c.fillStyle = r() > .5 ? '#0002' : '#fff1'; c.fillRect(r() * w, r() * h, 2, 1); }
  });
  sheet(rug, -1.3, .006, 8.25, 2.6, 1.9, -Math.PI / 2);

  // ── Wastepaper basket by the office desk ──
  {
    const x = -2.55, z = 2.0;
    cyl(x, .2, z, .13, .17, .4, '#4a4030', 20, 0, 0, true);
    add(new THREE.TorusGeometry(.17, .012, 6, 24), x, .4, z, '#2e281e', Math.PI / 2);
    for (const [dx, dz, s] of [[0, 0, .07], [.05, -.04, .06], [-.05, .05, .055]]) ball(x + dx, .38, z + dz, s, '#ddd0ad', 1, .85, 1, 7);
  }

  // ── Phlebotomy lab: centrifuge bench, blood-draw chair, shredder station, a second radiator ──
  const place = (g, x, y, z, ry = 0) => { g.position.set(x, y, z); g.rotation.y = ry; root.add(g); return g; };
  place(models.turnedTable({ w: .9, d: .5, h: .92, top: '#cfc8b4', frame: '#7d7a70' }), -3.2, 0, 6.85);
  {
    // Bench-top centrifuge: enamel drum, lid, control plate and two knobs.
    const x = -3.2, y = .92, z = 6.85;
    lathe([[0, 0], [.2, 0], [.21, .2], [.18, .24], [0, .24]], x - .1, y, z, '#d9d4c4', 28);
    cyl(x - .1, y + .25, z, .17, .17, .03, '#3b4038', 28);
    box(x + .25, y + .09, z + .12, .18, .14, .1, '#2f3530');
    for (const k of [-.04, .04]) cyl(x + .25 + k, y + .09, z + .18, .015, .015, .02, '#b9b7ae', 10, Math.PI / 2);
  }
  {
    // Blood-draw chair: padded seat and back, an arm board, chrome frame.
    const x = 2.2, z = 8.0;
    box(x, .5, z, .55, .1, .55, '#5c3a2e'); box(x, .95, z + .3, .55, .8, .1, '#5c3a2e', 0, .25);
    box(x - .38, .72, z - .1, .14, .06, .7, '#5c3a2e'); box(x - .38, .73, z - .48, .18, .05, .3, '#d9d4c4');
    for (const dx of [-.22, .22]) for (const dz of [-.22, .22]) rod([x + dx, 0, z + dz], [x + dx, .45, z + dz], .018, '#b9b7ae');
    rod([x - .38, .45, z - .1], [x - .38, .7, z - .1], .018, '#b9b7ae');
  }
  place(models.turnedTable({ w: 1.0, d: .5, h: .92 }), -.9, 0, 6.95);
  {
    // Industrial document shredder and the ethics hold stamp beside it.
    const x = -1.1, y = .92, z = 6.95;
    box(x, y + .22, z, .5, .44, .38, '#3f4a3e'); box(x, y + .46, z, .52, .04, .4, '#2c342b');
    box(x, y + .48, z - .02, .34, .01, .03, '#0e100d');
    for (let i = 0; i < 6; i++) box(x - .2 + i * .08, y + .1, z + .195, .03, .12, .01, '#2c342b');
    const sx = -.6;
    box(sx, y + .02, z, .2, .04, .16, '#2b2118'); rod([sx, y + .04, z], [sx, y + .22, z], .02, '#5d4832');
    ball(sx, y + .26, z, .055, '#7a2f22');
  }
  place(models.columnRadiator({ sections: 11, pitch: .115, height: .86, columns: 3 }), 4.3, 0, 8.95, -Math.PI / 2);

  // ── Dispatch office: desk, ham radio station, filing cabinet, emergency glass case ──
  place(models.turnedTable({ w: 1.5, d: .7, h: .78 }), 0, 0, 12.2);
  {
    const x = .55, y = .78, z = 12.1;
    cyl(x, y + .02, z, .08, .09, .03, '#b48a4e', 18); rod([x, y + .03, z], [x - .05, y + .38, z + .08], .01, '#b48a4e');
    lathe([[.03, 0], [.09, .06], [.11, .13], [0, .13]], x - .07, y + .3, z + .12, '#2f4a3c', 18);
    box(-.3, y + .02, z + .05, .42, .03, .3, '#d8c79f', .15);
  }
  place(models.turnedTable({ w: 1.4, d: .7, h: .78 }), 2.6, 0, 14.15);
  {
    // Vacuum-tube ham radio: steel cabinet, glowing tubes, two big dials and an oscilloscope.
    const x = 2.6, y = .78, z = 14.2;
    box(x, y + .27, z, 1.1, .54, .42, '#3b3a35'); box(x, y + .27, z - .215, 1.02, .46, .02, '#262521');
    for (const dx of [-.33, .33]) { cyl(x + dx, y + .2, z - .235, .09, .09, .04, '#151412', 32, Math.PI / 2); cyl(x + dx, y + .2, z - .26, .03, .03, .03, '#b48a4e', 16, Math.PI / 2); }
    cyl(x, y + .33, z - .23, .11, .11, .02, '#0d140f', 32, Math.PI / 2);
    for (let i = 0; i < 5; i++) { cyl(x - .32 + i * .16, y + .6, z + .05, .035, .03, .14, '#d9cba8', 14); }
  }
  const glow = (col, r) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color: col })); owned.add(m.geometry); owned.add(m.material); root.add(m); return m; };
  for (let i = 0; i < 5; i++) glow('#ffb35a', .028).position.set(2.28 + i * .16, 1.42, 14.25);
  glow('#58ff9a', .1).position.set(2.6, 1.11, 13.965);
  place(models.filingCabinet({ w: .9, h: 1.3, d: .8, rows: 3 }), -2.6, -.03, 13.9, Math.PI);
  // Emergency glass case on the west wall, with the dispatch key behind the glass.
  box(-4.42, 1.55, 12.0, .08, .9, .72, '#7a2f22');
  box(-4.37, 1.55, 12.0, .02, .78, .6, '#2b2118');
  box(-4.34, 1.48, 12.0, .02, .05, .14, '#b48a4e'); box(-4.34, 1.46, 12.06, .02, .08, .03, '#b48a4e');
  const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(.6, .78), new THREE.MeshBasicMaterial({ color: '#cfe3e6', transparent: true, opacity: .28, depthWrite: false }));
  glassPane.position.set(-4.33, 1.55, 12.0); glassPane.rotation.y = Math.PI / 2; root.add(glassPane); owned.add(glassPane.geometry); owned.add(glassPane.material);
  sheet(printed('break-glass', ['IN EMERGENCY', 'Break glass', 'Dispatch key'], .5, .2, '#e8dcbf'), -4.375, 2.12, 12.0, .5, .2, 0, Math.PI / 2);

  // ── Neglect and story props: the deeper you go, the less this looks like a clinic ──
  const rust = '#7a4a2a', steel = '#7c7f7a', white = '#d9d6cc', flat = -Math.PI / 2;
  { // Lab bench: a rusting instrument tray, unused instruments and a stained dressing.
    const x = 1.28, y = .835, z = 8.12;
    box(x, y + .012, z, .32, .024, .2, steel); box(x - .1, y + .026, z + .05, .1, .004, .07, rust); box(x + .11, y + .026, z - .06, .06, .004, .05, rust);
    for (let i = 0; i < 3; i++) rod([x - .09 + i * .07, y + .032, z - .07], [x - .07 + i * .07, y + .032, z + .07], .005, '#b9bcc0');
    box(x + .26, y + .012, z + .02, .1, .02, .08, white); box(x + .27, y + .024, z + .02, .05, .004, .04, '#6e2a1c');
  }
  // An employment contract clipped to a tissue-typing request (searchable: curio "contracts").
  sheet(printed('contract', ['AEGIS PLACEMENTS', 'CONTRACT', 'Lab technician', 'M. R. — signed'], .3, .21), .66, .832, 8.14, .3, .21, flat, 0, .22);
  sheet(printed('typing', ['TISSUE TYPING', '409', 'Match: confirmed', 'Same day'], .3, .21, '#cfd8d2'), .8, .834, 8.22, .3, .21, flat, 0, -.14);
  box(.7, .84, 8.06, .05, .012, .02, brass);
  { // Drip stand in the corner, bag still half full.
    const x = -4.18, z = 7.5;
    rod([x, .02, z], [x, 1.9, z], .012, steel); for (const a of [0, 2.1, 4.2]) rod([x, .03, z], [x + Math.cos(a) * .2, .03, z + Math.sin(a) * .2], .012, rust);
    rod([x - .09, 1.88, z], [x + .09, 1.88, z], .008, steel); box(x + .08, 1.68, z, .1, .2, .03, '#b9c7c2'); rod([x + .08, 1.58, z], [x + .1, 1.0, z + .03], .004, '#c9d2cf');
  }
  { // South wall of the lab: a records store padlocked from outside (searchable: curio "storage").
    const x = 2.32, z = 10.17;
    box(x, 1.05, z, .92, 2.1, .04, '#4a4338'); box(x, 1.05, z - .022, .8, 1.96, .012, '#5b5345'); box(x - .28, 1.05, z - .04, .05, .16, .03, iron);
    rod([x - .31, 1.02, z - .06], [x - .25, 1.02, z - .06], .012, brass); box(x - .28, .96, z - .06, .06, .07, .03, brass);
    sheet(printed('store', ['RECORDS', 'NO ENTRY', 'Staff only'], .44, .2, '#d9c9a3'), x, 1.72, z - .032, .44, .2, 0, Math.PI);
    box(x + .2, .06, z - .1, .22, .02, .16, rust); // a rust bloom where water has run under the door
  }
  // Failing strip lights hang over both rooms.
  for (const [x, z] of [[0, 8.4], [1.2, 13.4]]) { box(x, 2.86, z, 1.3, .05, .18, white); box(x, 2.83, z, 1.2, .02, .06, '#f4efd8'); for (const dx of [-.5, .5]) rod([x + dx, 2.88, z], [x + dx, 3.25, z], .006, iron); }
  { // Dispatch desk: three consent forms in the same hand (searchable: curio "consents"), and a bucket under a leak.
    for (let i = 0; i < 3; i++) sheet(printed('consent' + i, ['CONSENT TO DONATE', ['J. Okafor', 'L. Tran', 'M. R.'][i], 'Signed: ~~~~~~', 'Witness: A. Vance'], .26, .19, '#e3d8bb'), .22 + i * .11, .786 + i * .002, 12.08 + i * .05, .26, .19, flat, 0, -.3 + i * .25);
    cyl(4.12, .13, 10.62, .11, .14, .26, steel, 16, 0, 0, true); cyl(4.12, .012, 10.62, .11, .11, .02, rust); box(4.12, .2, 10.62, .2, .004, .2, '#3a4648');
  }
  // ── Specimen jars: cartoon organs in yellowed fluid, tagged with the same file numbers as the patient records ──
  {
    const K = 1.5, jarGeo = new THREE.CylinderGeometry(.07 * K, .07 * K, .2 * K, 20), fluid = new THREE.MeshBasicMaterial({ color: '#c3d39a', transparent: true, opacity: .13, depthWrite: false });
    owned.add(jarGeo); owned.add(fluid);
    const RED = '#e0473a', DARK = '#9c3a2c', PINK = '#f0a49b', VEIN = '#5470c0', PALE = '#f2e2c4', G = 1.3, m = .1; // organs drawn 1.3× round the jar's middle
    function jar(x, y, z, organ, ry, tag) {
      const c = Math.cos(ry), s = Math.sin(ry), at = (lx, ly, lz) => [x + (lx * c + lz * s) * K, y + ly * K, z + (-lx * s + lz * c) * K];
      const og = (lx, ly, lz) => at(lx * G, m + (ly - m) * G, lz * G);
      const orb = (lx, ly, lz, r, col, sx = 1, sy = 1, sz = 1) => add(new THREE.SphereGeometry(r * K * G, 14, 10), ...og(lx, ly, lz), col, 0, ry, 0, sx, sy, sz);
      const tube = (a, b, r, col) => rod(og(...a), og(...b), r * K * G, col, 8);
      if (organ === 'heart') {
        orb(-.017, m + .015, 0, .03, RED); orb(.017, m + .015, 0, .03, RED);
        add(new THREE.ConeGeometry(.045 * K * G, .06 * K * G, 14).rotateX(Math.PI), ...og(0, m - .027, 0), RED, 0, ry, 0);
        tube([.004, m + .035, 0], [.012, m + .075, 0], .011, '#c45a49'); tube([-.016, m + .03, .01], [-.03, m + .06, .016], .006, VEIN);
        tube([.02, m - .01, .026], [-.01, m - .03, .022], .003, VEIN);
      } else if (organ === 'kidney') {
        add(new THREE.TorusGeometry(.028 * K * G, .022 * K * G, 10, 18, Math.PI * 1.3), ...og(0, m + .005, 0), '#c0503e', 0, ry, 2.2);
        tube([-.012, m - .002, 0], [.012, m - .07, .004], .005, PALE);
      } else if (organ === 'lungs') {
        for (const k of [-1, 1]) { orb(k * .026, m - .005, 0, .03, PINK, .8, 1.45, .75); tube([0, m + .03, 0], [k * .02, m + .012, 0], .005, PALE); }
        tube([0, m + .03, 0], [0, m + .075, 0], .008, PALE);
      } else if (organ === 'liver') {
        orb(-.01, m, 0, .04, DARK, 1.1, .62, .85); orb(.026, m + .004, 0, .024, DARK, 1, .62, .85); orb(.004, m - .022, .022, .011, '#5e7a3a');
      } else if (organ === 'eye') {
        orb(0, m, 0, .034, '#efe9da'); orb(0, m, .03, .016, '#3f6f8a', 1, 1, .45); orb(0, m, .035, .007, '#111111', 1, 1, .45);
        tube([0, m, -.03], [.018, m - .06, -.04], .007, '#d49a8a'); tube([-.02, m + .02, .02], [-.008, m + .028, .027], .0025, RED);
      }
      if (organ) { orb(.03, m + .05, .025, .006, '#f4f1e4'); orb(-.028, m + .065, .02, .004, '#f4f1e4'); }   // a couple of bubbles
      // Jar: fluid-filled glass with a dark lid, a glass base ring and a paper tag on the front.
      const glass = new THREE.Mesh(jarGeo, fluid); glass.position.set(x, y + .1 * K, z); glass.renderOrder = 1; root.add(glass);
      cyl(x, y + .21 * K, z, .076 * K, .074 * K, .025 * K, '#2c2a24', 20); cyl(x, y + .227 * K, z, .05 * K, .05 * K, .012 * K, '#2c2a24', 16);
      add(new THREE.TorusGeometry(.07 * K, .006 * K, 6, 24), x, y + .006 * K, z, '#c9cfc4', Math.PI / 2);
      const label = factory.make('jar-' + tag, 160, 104, (g, w, h, r) => {
        g.fillStyle = '#e6d9b4'; g.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(90,60,30,.18)'; g.fillRect(r() * w, r() * h, 2, 1); }
        g.strokeStyle = '#6f5636'; g.lineWidth = 3; g.strokeRect(5, 5, w - 10, h - 10);
        g.fillStyle = '#2b2118'; g.textAlign = 'center'; g.font = 'bold 30px Georgia'; g.fillText(tag.split('|')[0], w / 2, 44);
        g.font = '20px monospace'; g.fillStyle = '#5a2a20'; g.fillText(tag.split('|')[1] || '', w / 2, 78);
      });
      sheet(label, ...at(0, .045, .073), .085 * K, .055 * K, 0, ry);
    }
    // Intake office: on top of and inside the narrow records shelf, and on the tall archive cabinet.
    jar(2.87, 2.81, -2.47, 'heart', 0, 'HEART|No. 402'); jar(3.22, 2.81, -2.47, 'kidney', 0, 'KIDNEY|No. 404'); jar(3.57, 2.81, -2.47, 'eye', 0, 'CORNEA|No. 407'); jar(3.92, 2.81, -2.47, 'eye', 0, 'CORNEA|No. 403');
    jar(3.86, 1.025, -2.4, 'liver', 0, 'LIVER|No. 405'); jar(4.1, 1.025, -2.4, 'kidney', 0, 'KIDNEY|No. 411');
    jar(-3.95, 1.995, -1.83, 'lungs', .3, 'LUNG|No. 401');
    // Lab: a specimen shelf over the radiator; one jar is still empty, waiting for Mateo.
    { const sx = 4.31, y = 1.45; box(sx, y - .015, 8.95, .27, .03, 1.3, wood); for (const z of [8.45, 9.45]) box(4.42, y - .1, z, .06, .16, .03, darkWood); }
    jar(4.3, 1.45, 8.48, 'heart', -Math.PI / 2, 'HEART|No. 412'); jar(4.3, 1.45, 8.8, 'lungs', -Math.PI / 2, 'LUNG|No. 413');
    jar(4.3, 1.45, 9.12, 'kidney', -Math.PI / 2, 'KIDNEY|No. 415'); jar(4.3, 1.45, 9.43, null, -Math.PI / 2, '409|RESERVED');
    jar(-2.88, .92, 6.72, 'liver', .3, 'LIVER|No. 408'); jar(.36, .785, 7.76, 'eye', .4, 'CORNEA|No. 410');
    // Dispatch office: packed for the courier on the filing cabinet and the desk.
    jar(-2.8, 1.425, 13.95, 'kidney', Math.PI, 'KIDNEY|No. 416'); jar(-2.42, 1.425, 13.86, 'heart', Math.PI, 'HEART|No. 417'); jar(-.62, .78, 12.42, 'liver', Math.PI, 'LIVER|No. 418');
  }

  // ── Holding cell: walled off in the dispatch office's north-east corner, behind the lab's padlocked "Records" door ──
  // By day it passes for a store room. The two mirrors in its south wall are one-way glass, cracked from the inside:
  // the office sees a mirror, whoever is held here sees out. `haunted` holds what is only there at night and for the
  // detective (ink, hearts, shadows burned on the wall); `tally` is what the UV lamp brings up on the glass.
  const haunted = new THREE.Group(), tally = new THREE.Group(), hearts = [];
  root.add(haunted, tally);
  {
    const X0 = 1.4, X1 = 3.2, Z0 = 10.31, Z1 = 12.0, T = .08, H = 2.6, wall = '#4f4132', tile = '#a9ab9d', xc = (X0 + X1) / 2, zc = (Z0 + Z1) / 2, zs = Z1 - T / 2;
    const flatMesh = (tex, x, y, z, w, h, ry, group, side = THREE.DoubleSide) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: side === THREE.DoubleSide, depthWrite: side !== THREE.DoubleSide, side }));
      m.position.set(x, y, z); m.rotation.y = ry; group.add(m); owned.add(m.geometry); owned.add(m.material); return m;
    };
    // West wall with the doorway (z 11.1 to 11.92), east wall, a south wall built round two window openings, a flat roof.
    box(X0 + T / 2, H / 2, (Z0 + 11.1) / 2, T, H, 11.1 - Z0, wall); box(X0 + T / 2, (2.05 + H) / 2, 11.51, T, H - 2.05, .82, wall);
    box(X1 - T / 2, H / 2, zc, T, H, Z1 - Z0, wall);
    box(xc, .5, zs, X1 - X0, 1.0, T, wall); box(xc, (1.95 + H) / 2, zs, X1 - X0, H - 1.95, T, wall);
    for (const [a, b] of [[1.4, 1.62], [2.24, 2.36], [2.98, 3.2]]) box((a + b) / 2, 1.475, zs, b - a, .95, T, wall);
    box(xc, H + .03, zc, X1 - X0 + .06, .06, Z1 - Z0 + .06, '#3e3327');
    // Tiled to waist height inside, like the lab.
    box(xc, .5, Z0 + .016, X1 - X0 - 2 * T, 1.0, .012, tile); box(xc, .5, Z1 - T - .006, X1 - X0 - 2 * T, 1.0, .012, tile);
    box(X1 - T - .006, .5, zc, .012, 1.0, Z1 - Z0 - T, tile); box(X0 + T + .006, .5, (Z0 + 11.1) / 2, .012, 1.0, 11.1 - Z0, tile);
    // The cell door stands open against the outside of the west wall, its bolt and padlock on the outside.
    box(X0 - .03, 1.02, 10.71, .04, 2.04, .78, '#4a4338'); box(X0 - .06, 1.05, 10.42, .03, .06, .2, iron); box(X0 - .065, .93, 10.36, .03, .07, .06, brass);
    sheet(printed('store', ['RECORDS', 'NO ENTRY', 'Staff only'], .44, .2, '#d9c9a3'), X0 - .052, 1.7, 10.71, .44, .2, 0, -Math.PI / 2);
    // The back of the lab's padlocked door, scratched at hand height.
    box(2.32, 1.05, Z0 + .03, .92, 2.1, .03, '#4a4338');
    sheet(factory.make('cell-scratches', 256, 256, (c, w, h, r) => {
      c.strokeStyle = 'rgba(214,204,180,.75)'; c.lineCap = 'round';
      for (let g = 0; g < 7; g++) { const x = 20 + r() * (w - 70), y = 20 + r() * (h - 110), len = 40 + r() * 60; for (let k = 0; k < 4; k++) { c.lineWidth = 1 + r() * 1.5; c.beginPath(); c.moveTo(x + k * 9, y + r() * 8); c.lineTo(x + k * 9 + 6 + r() * 6, y + len * (.7 + r() * .3)); c.stroke(); } }
    }), 2.32, 1.25, Z0 + .047, .8, .8, 0, 0, 0, true);

    // One-way glass: a mirror on the office side only, cracks that show from both sides, and the UV marks inside.
    const mirror = factory.make('cell-mirror', 128, 192, (c, w, h, r) => {
      const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#46565b'); g.addColorStop(.5, '#27343a'); g.addColorStop(1, '#161d21'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(210,228,230,.16)'; for (let i = 0; i < 5; i++) { c.lineWidth = 3 + r() * 9; c.beginPath(); c.moveTo(-20 + i * 34, h); c.lineTo(40 + i * 34, 0); c.stroke(); }
    });
    const marks = [['NOT A', 'CLINIC'], ['THEY', 'TOOK HIM', '409']];
    [[1.62, 2.24, [[100, 190], [235, 345]]], [2.36, 2.98, [[205, 165], [85, 330], [255, 420]]]].forEach(([a, b, hits], i) => {
      const x = (a + b) / 2, w = b - a;
      flatMesh(mirror, x, 1.475, Z1 + .001, w, .95, 0, root, THREE.FrontSide);
      flatMesh(factory.make('cell-cracks-' + i, 320, 490, (c, cw, ch, r) => { c.fillStyle = 'rgba(170,192,192,.1)'; c.fillRect(0, 0, cw, ch); cracks(c, hits, 170, r); }), x, 1.475, Z1 + .004, w, .95, 0, root);
      flatMesh(factory.make('cell-tally-' + i, 320, 490, (c, cw, ch) => {
        c.strokeStyle = c.fillStyle = '#8ff4ff'; c.shadowColor = '#35d6ff'; c.shadowBlur = 14; c.lineWidth = 4; c.lineCap = 'round'; c.textAlign = 'center';
        for (let k = 0; k < (i ? 9 : 14); k++) { const tx = 40 + k * 17 + Math.floor(k / 5) * 14, ty = i ? 380 : 60; c.beginPath(); if (k % 5 === 4) { c.moveTo(tx - 74, ty + 44); c.lineTo(tx - 8, ty + 6); } else { c.moveTo(tx, ty); c.lineTo(tx + 3, ty + 50); } c.stroke(); }
        c.font = 'bold 44px "Courier New", monospace'; marks[i].forEach((l, k) => { c.save(); c.translate(cw / 2, (i ? 110 : 230) + k * 70); c.rotate(k % 2 ? .05 : -.07); c.fillText(l, 0, 0); c.restore(); });
      }), x, 1.475, Z1 - .012, w, .95, Math.PI, tally);   // faces into the cell, so it reads the right way round
    });

    // Floor drain. The ink round it is only there at night.
    cyl(2.3, .005, 10.95, .09, .09, .01, '#2a2a27', 20); for (const dx of [-.04, 0, .04]) box(2.3 + dx, .012, 10.95, .012, .006, .15, steel);
    const ink = factory.make('cell-ink', 256, 256, (c, w, h, r) => {
      c.fillStyle = '#050506'; for (let i = 0; i < 26; i++) { const a = r() * 7, d = r() * 62; c.beginPath(); c.ellipse(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 26 + r() * 40, 20 + r() * 30, r() * 3, 0, 7); c.fill(); }
      for (let i = 0; i < 9; i++) { const a = r() * 7, d = 96 + r() * 26; c.beginPath(); c.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 2 + r() * 6, 0, 7); c.fill(); }   // drips
      c.strokeStyle = 'rgba(206,220,232,.4)'; c.lineCap = 'round';                                                                                                    // the lamp, reflected
      for (const [x, y, q, len] of [[96, 100, 30, .9], [150, 136, 20, .7], [116, 160, 14, .5]]) { c.lineWidth = 2 + q / 12; c.beginPath(); c.arc(x, y, q, 3.6, 3.6 + len); c.stroke(); }
    });
    for (const [x, z, w, d, rz] of [[2.3, 10.95, 1.05, .85, .3], [1.82, 11.52, .5, .42, 2.1], [2.84, 10.6, .46, .4, 4]]) haunted.add(sheet(ink, x, .004 + w * .002, z, w, d, flat, 0, rz, true));
    // Shadows of people, burned onto the east wall like the ones a flash leaves behind.
    const shades = factory.make('cell-shadows', 512, 512, (c, w, h) => {
      c.fillStyle = 'rgba(16,13,12,.5)'; c.shadowColor = 'rgba(16,13,12,.6)'; c.shadowBlur = 14;
      const body = (x, top, s, arms) => {
        c.beginPath(); c.ellipse(x, top + 30 * s, 22 * s, 27 * s, 0, 0, 7); c.fill();
        c.beginPath(); c.moveTo(x - 40 * s, top + 70 * s); c.lineTo(x + 40 * s, top + 70 * s); c.lineTo(x + 34 * s, h); c.lineTo(x - 34 * s, h); c.closePath(); c.fill();
        c.lineCap = 'round'; c.strokeStyle = c.fillStyle; c.lineWidth = 17 * s;
        for (const [side, lift] of arms) { c.beginPath(); c.moveTo(x + side * 36 * s, top + 84 * s); c.lineTo(x + side * 66 * s, top + (84 - lift * 60) * s); c.lineTo(x + side * 62 * s, top + (84 - lift * 150) * s); c.stroke(); }
      };
      body(120, 150, 1.25, [[-1, 1], [1, 1]]); body(290, 215, 1.1, [[1, .9], [-1, -.8]]); body(430, 330, .8, [[-1, .7], [1, .6]]);
    });
    haunted.add(sheet(shades, X1 - T - .02, 1.0, 11.1, 1.5, 1.85, 0, -Math.PI / 2, 0, true));

    // Left luggage: suitcases with their straps still buckled, and shoes with no owners.
    const strap = '#2b2118', cases3 = [[1.72, .11, 10.72, .42, .2, .62, '#6b4a2c', 0], [1.72, .29, 10.7, .36, .15, .5, '#3f4a44', .22], [2.96, .24, 11.58, .16, .46, .6, '#7a5b33', .06]];
    for (const [x, y, z, w, h, d, col, ry] of cases3) {
      box(x, y, z, w, h, d, col, ry); const c = Math.cos(ry), s = Math.sin(ry);
      for (const k of [-.3, .3]) box(x + k * d * s, y, z + k * d * c, w + .012, h + .012, .035, strap, ry);
      box(x + (w / 2 + .012) * c, y, z - (w / 2 + .012) * s, .02, .03, .13, brass, ry);
    }
    for (const [x, z, ry, col, k] of [[2.1, 11.62, .4, '#2a211a', 1], [2.3, 11.72, -.9, '#2a211a', 1], [2.8, 10.8, 1.2, '#5a3a26', 1], [2.52, 11.74, .1, '#3a3028', 1], [1.98, 11.06, 2, '#6a5a48', .68]]) {
      add(new THREE.SphereGeometry(.05 * k, 10, 8), x, .036 * k, z, col, 0, ry, 0, 2.3, .72, 1);
      add(new THREE.SphereGeometry(.045 * k, 10, 8), x - Math.cos(ry) * .05 * k, .06 * k, z + Math.sin(ry) * .05 * k, col, 0, ry, 0, 1.1, 1.1, .95);
    }
    // What makes it a store room by day: a shelf of box files, a mop and bucket, and a steel tray left on the floor.
    box(X1 - T - .13, 2.1, 11.0, .26, .03, 1.2, wood); for (const z of [10.5, 11.5]) box(X1 - T - .06, 2.0, z, .1, .17, .03, darkWood);
    for (let i = 0; i < 5; i++) box(X1 - T - .13, 2.26, 10.52 + i * .23, .22, .28, .09 + (i % 2) * .05, folderCols[i * 3 % folderCols.length]);
    cyl(2.96, .13, 10.46, .1, .12, .26, steel, 16, 0, 0, true); rod([3.0, .03, 10.44], [2.9, 1.5, 10.36], .013, wood); ball(3.0, .08, 10.44, .07, '#b7b09c', 1, .7, 1);
    box(2.5, .016, 10.52, .36, .022, .24, steel); box(2.5, .03, 10.52, .3, .006, .18, '#9a9d98');

    // Ink hearts, drawn like a 1930s anatomy plate: they throb and hang a little above the ink.
    const INK = '#14110f', PAPER = '#e7dcc0';
    const heartSheet = makeSheet('ink-heart', { w: 200, h: 250, res: 1, paint: (c, pose) => {
      const k = 1 + pose.legs * .07;   // the beat
      c.clearRect(0, 0, 200, 250); c.save(); c.translate(100, 150); c.scale(k, k); c.rotate(pose.lean * .6); c.translate(-100, -150);
      c.lineJoin = c.lineCap = 'round';
      const vessel = (pts, w) => { for (const [lw, col] of [[w + 7, INK], [w, PAPER]]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(...pts[0]); c.bezierCurveTo(...pts[1], ...pts[2], ...pts[3]); c.stroke(); } };
      vessel([[150, 96], [158, 80], [160, 62], [156, 44]], 15);                 // vena cava
      vessel([[104, 86], [96, 44], [128, 20], [150, 52]], 20);                  // aortic arch
      vessel([[86, 88], [80, 66], [70, 52], [56, 44]], 15);                     // pulmonary artery
      const body = () => { c.beginPath(); c.moveTo(72, 86); c.bezierCurveTo(38, 92, 24, 138, 48, 178); c.bezierCurveTo(62, 204, 92, 226, 118, 234); c.bezierCurveTo(152, 208, 178, 168, 170, 126); c.bezierCurveTo(166, 100, 146, 82, 122, 84); c.bezierCurveTo(104, 74, 88, 76, 72, 86); c.closePath(); };
      body(); c.fillStyle = PAPER; c.fill();
      c.save(); body(); c.clip(); c.strokeStyle = 'rgba(20,17,15,.5)'; c.lineWidth = 1.6;                                          // hatching on the shaded side
      for (let i = 0; i < 26; i++) { c.beginPath(); c.moveTo(10 + i * 7, 240); c.lineTo(10 + i * 7 - 70, 110 + i * 3); c.stroke(); }
      c.fillStyle = 'rgba(231,220,192,.82)'; c.beginPath(); c.ellipse(128, 136, 40, 62, .3, 0, 7); c.fill(); c.restore();
      body(); c.strokeStyle = INK; c.lineWidth = 6; c.stroke();
      c.lineWidth = 3; c.beginPath(); c.moveTo(98, 92); c.bezierCurveTo(112, 130, 104, 176, 116, 222); c.moveTo(106, 132); c.bezierCurveTo(126, 146, 140, 168, 142, 190); c.moveTo(104, 154); c.bezierCurveTo(88, 166, 76, 182, 70, 196); c.stroke();
      c.lineWidth = 4; c.beginPath(); c.ellipse(60, 104, 20, 15, -.5, 0, 7); c.fillStyle = PAPER; c.fill(); c.stroke();           // auricle
      c.restore();
    } });
    for (const [x, y, z, size] of [[2.3, .2, 10.95, .34], [1.82, .14, 11.52, .22], [2.5, .06, 10.52, .22], [2.08, .46, 10.66, .2], [2.74, .12, 11.46, .18]]) {
      const anim = new SpriteSheetAnimator(heartSheet, { height: size, fps: 6 }); anim.mesh.position.set(x, y, z); haunted.add(anim.mesh); hearts.push({ anim, x, y, z });
    }
  }

  // A medical orderly: a paper cut-out who is only there at night, and always faces you. The drawing is the original;
  // it rocks and bobs as one piece.
  const orderlyAnim = new SpriteSheetAnimator(makeSheet('character-orderly', { w: 360, h: 816, paint: (c, pose) => {
      c.clearRect(0, 0, 360, 816); c.save(); c.translate(180, 806); c.rotate(pose.lean + pose.head * .3); c.translate(-180, -806 - pose.bob);
      const P = (pts, fill) => { c.fillStyle = fill; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); };
      P([[104, 250], [150, 196], [210, 196], [256, 250], [272, 640], [222, 664], [138, 664], [88, 640]], '#b9bdb2');   // long coat
      P([[150, 196], [180, 300], [210, 196]], '#8f948b'); P([[128, 664], [168, 664], [164, 800], [116, 800]], '#23282b'); P([[192, 664], [232, 664], [244, 800], [196, 800]], '#23282b');
      P([[104, 250], [74, 470], [100, 480], [128, 300]], '#a8ada2'); P([[256, 250], [286, 470], [260, 480], [232, 300]], '#a8ada2');
      c.fillStyle = '#9c7656'; c.beginPath(); c.ellipse(180, 128, 46, 58, 0, 0, 7); c.fill();
      P([[130, 104], [140, 62], [220, 62], [230, 104]], '#c9cdc2');                                                    // cap
      P([[138, 138], [222, 138], [214, 186], [146, 186]], '#d9dcd2');                                                  // mask
      c.strokeStyle = '#14100c'; c.lineWidth = 5; c.beginPath(); c.moveTo(150, 120); c.lineTo(172, 124); c.moveTo(188, 124); c.lineTo(210, 120); c.stroke();
      P([[196, 400], [268, 392], [276, 500], [204, 508]], '#5d4832'); P([[206, 410], [260, 404], [266, 490], [212, 496]], '#e3d8bb'); // clipboard
      c.restore();
    } }), { height: 1.86, width: .82 }), orderly = orderlyAnim.mesh;
  orderly.position.set(4.2, 0, 7.9); orderly.visible = false; root.add(orderly);

  // Merge every solid part that shares a colour into one lit mesh.
  for (const [col, list] of parts) {
    const geo = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!geo) continue;
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: col }));
    root.add(mesh); owned.add(geo); owned.add(mesh.material);
  }
  return { root, glassPane,
    // Called every frame: the orderly appears on Mateo's night shifts and turns to face the player.
    face(camera, present) {
      orderly.visible = present; if (!present) return;
      const near = Math.hypot(camera.position.x - 4.2, camera.position.z - 7.9) < 3.2;
      orderlyAnim.play(near ? 'look' : 'idle'); orderlyAnim.update(null, camera, Math.atan2(camera.position.x - 4.2, camera.position.z - 7.9));
    },
    // Called every frame. shown: the ink, hearts and shadows are there (not on Mateo's day shifts); lit: the UV marks glow.
    haunt(camera, shown, lit) {
      haunted.visible = shown; tally.visible = shown && lit; if (!shown) return;
      const t = performance.now() / 1000;
      hearts.forEach((h, i) => { h.anim.play('walk'); h.anim.update(null, camera, Math.atan2(camera.position.x - h.x, camera.position.z - h.z)); h.anim.mesh.position.y = h.y + Math.sin(t * 1.3 + i * 1.7) * .025; });
    },
    dispose() { scene.remove(root); owned.forEach((o) => o.dispose()); orderlyAnim.dispose(); hearts.forEach((h) => h.anim.dispose()); } };
}
