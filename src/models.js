import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Period furniture and fittings, modelled from reference: a column radiator, a cathedral
// radio, a panelled office door, a steel transit chest, turned-leg tables, an instrument
// trolley, a teleprinter, a slatted bench, a pocket watch and a cloth-bound book.
// Each builder returns a Group whose parts are merged into one lit mesh per colour.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const materials = new Map();
const lit = (c) => { if (!materials.has(c)) materials.set(c, new THREE.MeshLambertMaterial({ color: c })); return materials.get(c); };

function kit() {
  const parts = new Map(), tmp = new THREE.Object3D(), extras = [];
  function add(geo, x, y, z, col, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    tmp.position.set(x, y, z); tmp.rotation.set(rx, ry, rz); tmp.scale.set(sx, sy, sz); tmp.updateMatrix();
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(tmp.matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!parts.has(col)) parts.set(col, []);
    parts.get(col).push(g); geo.dispose();
  }
  const rounded = (w, h, d, rr = .3) => new RoundedBoxGeometry(w, h, d, 2, Math.max(.002, Math.min(.03, Math.min(w, h, d) * rr)));
  const k = {
    add,
    box: (x, y, z, w, h, d, col, rx = 0, ry = 0, rz = 0) => add(rounded(w, h, d), x, y, z, col, rx, ry, rz),
    cyl: (x, y, z, r0, r1, h, col, seg = 18, rx = 0, rz = 0, open = false) => add(new THREE.CylinderGeometry(r1, r0, h, seg, 1, open), x, y, z, col, rx, 0, rz),
    ball: (x, y, z, r, col, sx = 1, sy = 1, sz = 1, seg = 14) => add(new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)), x, y, z, col, 0, 0, 0, sx, sy, sz),
    torus: (x, y, z, R, r, col, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2) => add(new THREE.TorusGeometry(R, r, 8, 24, arc), x, y, z, col, rx, ry, rz),
    capsule: (a, b, r, col, seg = 10) => {
      const A = V(...a), B = V(...b), d = B.clone().sub(A), len = d.length();
      const g = new THREE.CapsuleGeometry(r, Math.max(.0001, len), 4, seg);
      const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
      add(g, A.x + (B.x - A.x) / 2, A.y + (B.y - A.y) / 2, A.z + (B.z - A.z) / 2, col, e.x, e.y, e.z);
    },
    rod: (a, b, r, col, seg = 10) => {
      const A = V(...a), B = V(...b), d = B.clone().sub(A);
      const g = new THREE.CylinderGeometry(r, r, d.length(), seg);
      const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize()));
      add(g, A.x + d.x / 2, A.y + d.y / 2, A.z + d.z / 2, col, e.x, e.y, e.z);
    },
    lathe: (pts, x, y, z, col, seg = 24, rx = 0, rz = 0, sx = 1, sz = 1) => add(new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg), x, y, z, col, rx, 0, rz, sx, 1, sz),
    extrude: (shape, depth, x, y, z, col, bevel = .01, rx = 0, ry = 0) => {
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 18 });
      add(g, x, y, z, col, rx, ry, 0);
    },
    extra: (mesh) => extras.push(mesh),
    build(name) {
      const g = new THREE.Group(); g.name = name;
      for (const [col, list] of parts) { const geo = mergeGeometries(list, false); list.forEach((x) => x.dispose()); if (geo) { geo.computeBoundingSphere(); g.add(new THREE.Mesh(geo, lit(col))); } }
      extras.forEach((m) => g.add(m));
      return g;
    },
  };
  return k;
}
// A turned leg profile, bottom to top: foot, taper, ring, bulb, square-ish block.
function turnedLeg(h, r = .035) {
  const t = (f) => h * f;
  return [[0, 0], [r * .8, 0], [r * .9, t(.04)], [r * .6, t(.08)], [r * .62, t(.45)], [r * 1.0, t(.55)], [r * 1.1, t(.6)], [r * .7, t(.66)], [r * .7, t(.72)], [r * 1.05, t(.76)], [r * 1.05, t(1)], [0, t(1)]];
}

// ── Cast-iron column radiator. Front is +Z, length runs along X, sits on the floor. ──
export function columnRadiator({ sections = 11, pitch = .115, height = .86, columns = 3, paint = '#a39d90' } = {}) {
  const k = kit(), x0 = -(sections - 1) * pitch / 2, depth = .07 * (columns - 1);
  const hubTop = height - .06, hubLow = .15;
  for (let i = 0; i < sections; i++) {
    const x = x0 + i * pitch;
    for (let c = 0; c < columns; c++) {
      const z = -depth / 2 + c * .07;
      // Each column is a slightly waisted tube running between the top and bottom hubs.
      k.lathe([[0, 0], [.03, 0], [.026, .06], [.024, (hubTop - hubLow) / 2], [.026, hubTop - hubLow - .06], [.03, hubTop - hubLow], [0, hubTop - hubLow]], x, hubLow, z, paint, 12);
    }
    // Hubs join the columns front to back; the crown is a rounded cast cap.
    k.capsule([x, hubTop, -depth / 2], [x, hubTop, depth / 2], .036, paint);
    k.capsule([x, hubLow, -depth / 2], [x, hubLow, depth / 2], .036, paint);
    k.ball(x, hubTop + .03, 0, .03, paint, 1, .7, depth * 9 + 1);
    // Nipples between sections.
    if (i < sections - 1) { k.rod([x, hubTop, 0], [x + pitch, hubTop, 0], .02, '#8a8478'); k.rod([x, hubLow, 0], [x + pitch, hubLow, 0], .02, '#8a8478'); }
  }
  // Integrated feet on the end sections.
  for (const x of [x0, -x0]) for (const z of [-depth / 2, depth / 2]) {
    k.lathe([[0, 0], [.04, 0], [.04, .012], [.024, .03], [.022, hubLow - .02], [0, hubLow - .02]], x, 0, z, paint, 12);
  }
  // Supply valve with a wheel handle at one end, and a bleed screw at the other.
  const ex = -x0 + .06;
  k.rod([-x0, hubLow, 0], [ex + .06, hubLow, 0], .022, '#7c6a4c');
  k.ball(ex + .06, hubLow, 0, .04, '#8d7650');
  k.rod([ex + .06, hubLow, 0], [ex + .06, hubLow + .12, 0], .01, '#8d7650');
  k.torus(ex + .06, hubLow + .13, 0, .045, .008, '#3b2a1c', Math.PI / 2);
  for (let s = 0; s < 4; s++) k.rod([ex + .06, hubLow + .13, 0], [ex + .06 + Math.cos(s * Math.PI / 2) * .045, hubLow + .13, Math.sin(s * Math.PI / 2) * .045], .005, '#3b2a1c');
  k.rod([ex + .06, hubLow, 0], [ex + .06, -.01, 0], .022, '#7c6a4c');
  k.cyl(ex + .06, .004, 0, .045, .045, .008, '#5d5444', 18);
  k.cyl(x0 - .025, hubTop, 0, .012, .012, .03, '#8d7650', 10, 0, Math.PI / 2);
  return k.build('Column radiator');
}

// ── Cathedral tabletop radio (after the early-1930s arched sets). Front is +Z. ──
export function cathedralRadio({ w = .5, h = .62, d = .3 } = {}) {
  const k = kit(), walnut = '#5a3a22', dark = '#33200f', cloth = '#b99d6d', brassC = '#b48a4e';
  const arch = (hw, shoulder, top) => {
    const s = new THREE.Shape(); s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, shoulder);
    s.absellipse(0, shoulder, hw, top - shoulder, 0, Math.PI, false); s.lineTo(-hw, 0); return s;
  };
  // Cabinet: an arched slab extruded front to back on a plinth.
  k.extrude(arch(w / 2, h * .6, h), d, 0, .03, -d / 2, walnut, .012);
  k.box(0, .015, 0, w + .05, .03, d + .04, dark);
  // Arched grille: cloth behind gothic fretwork.
  const gb = h * .3, gs = h * .25, gt = h * .55, gw = w * .34;
  k.extrude(arch(gw, gs, gt), .01, 0, gb, d / 2 + .004, cloth, 0);
  for (let i = -2; i <= 2; i++) {
    const x = i * gw * .36, top = gb + gs + Math.sqrt(Math.max(0, 1 - (x / gw) ** 2)) * (gt - gs) - .03;
    k.box(x, gb + (top - gb) / 2, d / 2 + .016, .016, top - gb, .016, dark);
    k.ball(x, top + .012, d / 2 + .016, .013, dark, 1, 1.6, .7);
  }
  k.add(new THREE.TorusGeometry(1, .01 / gw, 8, 32, Math.PI), 0, gb + gs, d / 2 + .02, dark, 0, 0, 0, gw, gt - gs, 1);
  k.box(0, gb - .006, d / 2 + .018, gw * 2 + .02, .012, .016, dark);
  // Fluted columns at the front edges.
  for (const s of [-1, 1]) k.lathe([[0, 0], [.024, 0], [.02, .03], [.02, h * .55], [.026, h * .58], [0, h * .6]], s * (w / 2 - .02), .03, d / 2 + .01, '#6e4a2c', 14);
  // Dial escutcheon and knobs below the grille.
  k.torus(0, h * .18, d / 2 + .018, .045, .007, brassC);
  k.cyl(0, h * .18, d / 2 + .014, .042, .042, .008, '#e2d3a8', 24, Math.PI / 2);
  for (const x of [-w * .3, w * .3]) {
    k.cyl(x, h * .14, d / 2 + .03, .03, .028, .03, '#2a1a0e', 20, Math.PI / 2);
    k.cyl(x, h * .14, d / 2 + .047, .018, .018, .006, brassC, 16, Math.PI / 2);
  }
  return k.build('Cathedral radio');
}

// ── Panelled office door with architrave, glazed upper half and brass furniture. Front is +Z. ──
export function panelDoor({ w = 1.55, h = 2.66, glassY = .47, glassW = 1.13, glassH = 1.01, frame = true } = {}) {
  const k = kit(), paint = '#55412d', trim = '#967548', trimDark = '#6e5332', brassC = '#b68c51';
  // Architrave: a stepped moulding around the opening.
  if (frame) for (const s of [-1, 1]) { k.box(s * (w / 2 + .05), 0, .03, .11, h + .14, .07, trim); k.box(s * (w / 2 + .085), 0, .07, .04, h + .14, .03, trimDark); }
  if (frame) { k.box(0, h / 2 + .06, .03, w + .22, .12, .07, trim); k.box(0, h / 2 + .11, .07, w + .24, .04, .04, trimDark); }
  // Slab, then stiles and rails proud of it.
  k.box(0, 0, .025, w, h, .06, paint);
  const st = .16, gy0 = glassY - glassH / 2, gy1 = glassY + glassH / 2;
  for (const s of [-1, 1]) k.box(s * (w / 2 - st / 2), 0, .06, st, h, .02, '#5d4832');
  k.box(0, h / 2 - .08, .06, w, .16, .02, '#5d4832');
  k.box(0, gy0 - .07, .06, w, .14, .02, '#5d4832');
  k.box(0, -h / 2 + .15, .06, w, .3, .02, '#5d4832');
  // Glazing bead around the glass.
  for (const [x, y, bw, bh] of [[0, gy1 + .015, glassW + .06, .03], [0, gy0 - .015, glassW + .06, .03], [-glassW / 2 - .015, glassY, .03, glassH], [glassW / 2 + .015, glassY, .03, glassH]]) k.box(x, y, .08, bw, bh, .025, trim);
  // Two raised lower panels with a bevelled field.
  const py0 = -h / 2 + .3, py1 = gy0 - .14, ph = py1 - py0 - .08;
  for (const s of [-1, 1]) {
    k.box(s * .3, (py0 + py1) / 2, .07, .5, ph, .02, '#5d4832');
    k.box(s * .3, (py0 + py1) / 2, .085, .4, ph - .1, .015, '#634c34');
  }
  // Kick plate, hinges, knob with rosette and a keyhole escutcheon.
  k.box(0, -h / 2 + .07, .08, w - .1, .12, .006, '#9c7a45');
  for (const y of [h * .38, 0, -h * .38]) k.cyl(w / 2 - .01, y, .06, .016, .016, .12, brassC, 12);
  k.cyl(-w / 2 + .12, -.13, .09, .04, .04, .012, brassC, 20, Math.PI / 2);
  k.rod([-w / 2 + .12, -.13, .09], [-w / 2 + .12, -.13, .14], .012, brassC);
  k.ball(-w / 2 + .12, -.13, .15, .035, brassC, 1, 1, .8);
  k.box(-w / 2 + .12, -.24, .085, .04, .09, .008, brassC);
  k.box(-w / 2 + .12, -.245, .09, .008, .03, .004, '#1a140e');
  return k.build('Panel door');
}

// ── Insulated steel transit chest with straps, latches and handles. Front is +Z. ──
export function transitChest({ w = .96, h = .62, d = .66 } = {}) {
  const k = kit(), steel = '#7d8a7a', band = '#5c6858', lid = '#8e9a89', leather = '#4a3424', brassC = '#b68c51';
  k.box(0, .05 + h / 2, 0, w, h, d, steel);
  k.box(0, .05 + h + .06, 0, w + .04, .12, d + .04, lid);
  // Edge bands with rivets.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.box(sx * (w / 2 - .005), .05 + h / 2, sz * (d / 2 - .005), .05, h + .02, .05, band);
    for (let i = 0; i < 5; i++) k.ball(sx * (w / 2 + .02), .12 + i * (h - .1) / 4, sz * (d / 2 - .02), .009, '#3f463c');
  }
  // Leather straps round the chest, clear of the stencilled label.
  for (const x of [-w * .36, w * .36]) {
    k.box(x, .05 + h / 2 + .03, d / 2 + .012, .06, h + .1, .01, leather);
    k.box(x, .05 + h + .125, 0, .06, .01, d + .06, leather);
    k.box(x, .05 + h * .55, d / 2 + .02, .075, .055, .012, brassC);
  }
  // Latches, side handles and runners.
  for (const x of [-w * .18, w * .18]) { k.box(x, .05 + h + .005, d / 2 + .02, .07, .05, .015, brassC); k.ball(x, .05 + h - .015, d / 2 + .028, .012, brassC); }
  for (const sx of [-1, 1]) { k.torus(sx * (w / 2 + .03), .05 + h * .7, 0, .07, .012, '#2c2f2a', 0, Math.PI / 2, Math.PI, Math.PI); k.box(sx * (w / 2 + .01), .05 + h * .7, 0, .02, .05, .2, band); }
  for (const z of [-d * .32, d * .32]) k.box(0, .025, z, w - .06, .05, .07, '#3a3f37');
  return k.build('Transit chest');
}

// ── Table with turned legs, apron and stretchers. ──
export function turnedTable({ w, d, h, top = '#765637', frame = '#4c3b29' }) {
  const k = kit(), inset = .07;
  k.box(0, h - .03, 0, w, .06, d, top);
  k.box(0, h - .065, 0, w - .02, .015, d - .02, '#5f452c');
  for (const sx of [-1, 1]) { k.box(sx * (w / 2 - inset), h - .14, 0, .03, .12, d - inset * 2, frame); }
  for (const sz of [-1, 1]) { k.box(0, h - .14, sz * (d / 2 - inset), w - inset * 2, .12, .03, frame); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.lathe(turnedLeg(h - .06, .04), sx * (w / 2 - inset), 0, sz * (d / 2 - inset), frame, 16);
  for (const sx of [-1, 1]) k.rod([sx * (w / 2 - inset), .16, -(d / 2 - inset)], [sx * (w / 2 - inset), .16, d / 2 - inset], .016, frame);
  k.rod([-(w / 2 - inset), .16, 0], [w / 2 - inset, .16, 0], .016, frame);
  return k.build('Turned table');
}

// ── Two-shelf instrument trolley on castors. ──
export function instrumentTrolley({ w, d, h }) {
  const k = kit(), chrome = '#b9b7ae', enamel = '#d9d4c4';
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.rod([sx * (w / 2 - .04), .08, sz * (d / 2 - .04)], [sx * (w / 2 - .04), h, sz * (d / 2 - .04)], .016, chrome);
    k.torus(sx * (w / 2 - .04), .045, sz * (d / 2 - .04), .035, .012, '#2d2b27', 0, Math.PI / 2);
    k.box(sx * (w / 2 - .04), .075, sz * (d / 2 - .04), .02, .04, .05, chrome);
  }
  for (const y of [h - .02, .32]) {
    k.box(0, y, 0, w, .02, d, enamel);
    for (const s of [-1, 1]) { k.box(0, y + .025, s * (d / 2 - .01), w, .05, .015, enamel); k.box(s * (w / 2 - .01), y + .025, 0, .015, .05, d, enamel); }
  }
  // Kidney dish and bottles on the lower shelf.
  k.lathe([[0, 0], [.1, 0], [.12, .03], [.13, .04], [0, .04]], -w * .25, .335, 0, '#c9c6bc', 24, 0, 0, 1.4, .7);
  for (const [i, col] of ['#6e4a2a', '#2f4b44', '#8a8170'].entries()) {
    k.cyl(w * .1 + i * .1, .33 + .08, -.05, .035, .03, .16, col, 12);
    k.cyl(w * .1 + i * .1, .33 + .175, -.05, .016, .016, .03, '#e6dcc2', 10);
  }
  return k.build('Instrument trolley');
}

// ── Teleprinter: pedestal housing, sloped keyboard, platen, paper roll and ribbon spools. Front is +Z. ──
export function teleprinter() {
  const k = kit(), body = '#4b483b', hood = '#6f684f', keyC = '#1e1c19';
  k.box(0, 1.12, 0, 1.2, .3, .52, body);
  k.box(0, 1.03, .3, 1.1, .1, .18, body, -.35);
  for (let row = 0; row < 4; row++) for (let i = 0; i < 12; i++) {
    const x = -.42 + i * .075 + (row % 2) * .035, z = .23 + row * .04, y = 1.1 - row * .015;
    k.cyl(x, y, z, .015, .015, .02, keyC, 10); k.cyl(x, y + .012, z, .013, .013, .004, '#d9cba8', 10);
  }
  // Curved hood over the type mechanism.
  k.add(new THREE.CylinderGeometry(.19, .19, 1.06, 24, 1, false, 0, Math.PI), 0, 1.27, -.03, hood, 0, 0, Math.PI / 2);
  k.box(0, 1.27, -.03, 1.06, .02, .38, hood);
  k.cyl(0, 1.42, .1, .045, .045, .9, '#1b1a17', 18, 0, Math.PI / 2);
  for (const s of [-1, 1]) k.cyl(s * .47, 1.42, .1, .06, .06, .04, '#3a3631', 18, 0, Math.PI / 2);
  k.cyl(0, 1.5, -.13, .07, .07, .7, '#ece4cd', 20, 0, Math.PI / 2);
  for (const s of [-1, 1]) k.rod([s * .37, 1.36, -.13], [s * .37, 1.5, -.13], .012, '#2c2a25');
  return k.build('Teleprinter');
}

// ── Slatted park-style bench with cast-iron ends. Length along X, seat faces +Z. ──
export function slattedBench({ w = 1.05, seat = .5 } = {}) {
  const k = kit(), iron = '#2c2b27', slat = '#8a6a43';
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - .06);
    k.capsule([x, 0, .18], [x, seat, .16], .018, iron);
    k.capsule([x, 0, -.2], [x, seat, -.16], .018, iron);
    k.capsule([x, seat, .2], [x, seat, -.2], .018, iron);
    k.capsule([x, seat, -.18], [x, seat + .42, -.27], .018, iron);
    k.torus(x, seat * .5, 0, .08, .012, iron, 0, Math.PI / 2);
  }
  for (let i = 0; i < 4; i++) k.box(0, seat + .025, -.15 + i * .1, w, .035, .075, slat);
  for (let i = 0; i < 3; i++) k.box(0, seat + .12 + i * .1, -.2 - i * .022, w, .07, .03, slat, -.22);
  return k.build('Slatted bench');
}

// ── Pocket watch case (the face is a separate textured sheet). Lies flat, crown toward −Z. ──
export function pocketWatchCase({ r = .16 } = {}) {
  const k = kit(), brassC = '#b68c51';
  k.lathe([[0, 0], [r * .92, 0], [r, .012], [r * 1.02, .028], [r * .97, .046], [r * .9, .052], [0, .052]], 0, 0, 0, brassC, 40);
  k.torus(0, .05, 0, r * .9, .006, '#d9b46c', Math.PI / 2);
  k.cyl(0, .027, -r - .018, .012, .012, .04, brassC, 12, Math.PI / 2);
  k.cyl(0, .027, -r - .045, .02, .02, .022, '#9c7438', 16, Math.PI / 2);
  return k.build('Pocket watch');
}

// ── Cloth-bound book lying flat; the cover texture is applied by the caller. ──
export function clothBook({ w = .49, d = .4, h = .07, cloth = '#5a2e24' } = {}) {
  const k = kit();
  k.box(0, .006, 0, w, .012, d, cloth);
  k.box(.006, h / 2, 0, w - .02, h - .02, d - .02, '#e9dfc5');
  k.box(0, h - .006, 0, w, .012, d, cloth);
  k.add(new THREE.CylinderGeometry(h / 2, h / 2, d, 16, 1, false, Math.PI, Math.PI), -w / 2, h / 2, 0, cloth, Math.PI / 2, 0, 0);
  return k.build('Book');
}

// ── Steel filing cabinet: plinth, drawer fronts with card holders and cup pulls. Front is +Z. ──
export function filingCabinet({ w = .87, h = 1.93, d = .82, rows = 4, body = '#56503f', front = '#6c6450' } = {}) {
  const k = kit(), brassC = '#b48a4e';
  k.box(0, .05, 0, w - .04, .1, d - .04, '#2c2a23');
  k.box(0, .1 + h / 2, 0, w, h, d, body);
  k.box(0, h + .13, 0, w + .03, .05, d + .03, '#625a46');
  const dh = (h - .06) / rows;
  for (let i = 0; i < rows; i++) {
    const y = .13 + h - dh * (i + .5);
    k.box(0, y, d / 2 + .012, w - .06, dh - .03, .03, front);
    k.box(0, y + dh * .22, d / 2 + .03, w * .3, dh * .14, .008, brassC);
    k.box(0, y + dh * .22, d / 2 + .034, w * .25, dh * .1, .004, '#e3d7b8');
    k.add(new THREE.CylinderGeometry(.03, .03, w * .28, 16, 1, false, 0, Math.PI), 0, y - dh * .12, d / 2 + .03, brassC, 0, 0, Math.PI / 2);
    k.box(0, y - dh * .1, d / 2 + .028, w * .3, .012, .012, '#7c6034');
  }
  return k.build('Filing cabinet');
}
