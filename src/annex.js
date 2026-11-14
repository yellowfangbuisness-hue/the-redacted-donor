import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as models from './models.js';

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
  // A medical orderly: a paper cut-out who is only there at night, and always faces you.
  const orderly = new THREE.Mesh(new THREE.PlaneGeometry(.82, 1.86), new THREE.MeshBasicMaterial({ transparent: true, alphaTest: .04, side: THREE.DoubleSide,
    map: factory.make('character-orderly', 360, 816, (c) => {
      const P = (pts, fill) => { c.fillStyle = fill; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); };
      P([[104, 250], [150, 196], [210, 196], [256, 250], [272, 640], [222, 664], [138, 664], [88, 640]], '#b9bdb2');   // long coat
      P([[150, 196], [180, 300], [210, 196]], '#8f948b'); P([[128, 664], [168, 664], [164, 800], [116, 800]], '#23282b'); P([[192, 664], [232, 664], [244, 800], [196, 800]], '#23282b');
      P([[104, 250], [74, 470], [100, 480], [128, 300]], '#a8ada2'); P([[256, 250], [286, 470], [260, 480], [232, 300]], '#a8ada2');
      c.fillStyle = '#9c7656'; c.beginPath(); c.ellipse(180, 128, 46, 58, 0, 0, 7); c.fill();
      P([[130, 104], [140, 62], [220, 62], [230, 104]], '#c9cdc2');                                                    // cap
      P([[138, 138], [222, 138], [214, 186], [146, 186]], '#d9dcd2');                                                  // mask
      c.strokeStyle = '#14100c'; c.lineWidth = 5; c.beginPath(); c.moveTo(150, 120); c.lineTo(172, 124); c.moveTo(188, 124); c.lineTo(210, 120); c.stroke();
      P([[196, 400], [268, 392], [276, 500], [204, 508]], '#5d4832'); P([[206, 410], [260, 404], [266, 490], [212, 496]], '#e3d8bb'); // clipboard
    }) }));
  orderly.position.set(4.2, .93, 7.9); orderly.visible = false; root.add(orderly); owned.add(orderly.geometry); owned.add(orderly.material);

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
    face(camera, present) { orderly.visible = present; if (present) orderly.rotation.y = Math.atan2(camera.position.x - 4.2, camera.position.z - 7.9); },
    dispose() { scene.remove(root); owned.forEach((o) => o.dispose()); } };
}
