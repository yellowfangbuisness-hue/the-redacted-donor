import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { paintDocument, paintPlaque } from './paper.js';
import * as models from './models.js';
import { Actor, Cutscene, SpriteSheetAnimator, makeSheet, makeHandSheet, walk, wait, act, turn, call, together } from './sprites.js';
import { cases, evidence } from './casebook.js';
import {isNight, DAY_LENGTH, SEARCH_HALF_ANGLE} from './shifts.js';

const ink = '#211a14', brass = '#b68c51', pale = '#d9bf8a', metal = '#5d5848', tau = Math.PI * 2;
function stroke(c, points, color, width = 2) {
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
function oval(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, w, h, 0, 0, tau);
  c.fill();
}
function shape(c, path, color) {
  c.fillStyle = color;
  c.fill(new Path2D(path));
}

// One frame of a character cut-out. The artwork is the original illustration; `pose` moves it the way a paper puppet
// moves: the whole figure bounces and rocks from the feet, the two halves of the coat below the split lift in turn like
// legs, and the head and hat tilt on the neck. With no pose it is the drawing exactly as it always was.
const REST = { bob: 0, lean: 0, legs: 0, head: 0, nod: 0 };
const COAT = 'M55 630 L72 417 87 283 103 238 143 210 153 186 194 183 204 213 250 231 277 260 305 422 289 450 269 431 247 340 243 474 263 635 197 639 175 496 162 636 Z';
function portrait(c, variant, pose = REST) {
  // Illustrator's cutouts are drawn on transparent stock, with the street behind the negative space.
  const guard = variant === 'guard',
    man = variant === 'recruiter',
    light = man ? '#c39960' : guard ? '#64523a' : '#76654e';
  c.clearRect(0, 0, 360, 640);
  c.save();
  c.translate(180, 638); c.rotate(pose.lean); c.translate(-180, -638 - pose.bob);
  // Below the split in the coat: each half lifts in turn, so the figure steps from foot to foot.
  for (const side of [-1, 1]) {
    c.save(); c.translate(0, -Math.max(0, side * -pose.legs) * 14);
    c.beginPath(); c.rect(side < 0 ? 0 : 176, 490, side < 0 ? 176 : 184, 170); c.clip();
    shape(c, COAT, '#231d17'); c.restore();
  }
  // The coat, shirt and arms.
  c.save(); c.beginPath(); c.rect(0, 178, 360, 314); c.clip();
  shape(c, COAT, '#231d17');
  shape(c, 'M143 209 L159 190 177 210 190 194 203 209 186 285 167 319 Z', light);
  shape(c, 'M167 209 L183 209 177 222 184 263 172 288 165 268 173 221 Z', '#2a2119');
  shape(
    c,
    'M146 203 L129 215 120 258 138 258 129 273 170 330 Z M201 204 L225 218 241 256 217 255 224 267 175 325 Z',
    '#55422e',
  );
  stroke(c, [[148, 206], [133, 220], [123, 255], [141, 255], [132, 270], [165, 315]], light, 2);
  stroke(c, [[204, 208], [232, 245], [214, 254], [222, 264], [186, 300]], light, 2);
  stroke(c, [[107, 239], [95, 266], [78, 354]], light, 4);
  stroke(c, [[253, 242], [270, 263], [294, 396]], light, 3);
  for (let i = 0; i < 24; i++) {
    const x = 95 + i * 2.6;
    stroke(c, [[x, 250 + (i % 4) * 3], [x - 13, 297 + i % 10]], '#57442f', 1);
  }
  stroke(c, [[175, 330], [172, 393], [175, 450]], light, 2);
  for (const y of [338, 369, 405]) oval(c, 179, y, 2.4, 3.0, light);
  c.restore();
  // The head and hat, tilting on the neck.
  c.translate(178, 186); c.rotate(pose.head); c.translate(-178, -186 - pose.nod);
  shape(
    c,
    'M125 87 Q126 58 157 49 Q188 38 207 60 L222 85 214 121 221 140 207 149 202 176 185 188 162 181 153 159 139 149 137 125 131 121 Z',
    '#31271e',
  );
  shape(
    c,
    'M157 95 L207 83 202 104 190 111 193 121 204 128 201 135 192 136 191 151 202 151 197 165 184 177 169 168 162 150 151 140 148 122 Z',
    light,
  );
  shape(c, 'M157 104 L176 100 180 107 163 117 143 115 Z M184 102 L202 96 204 101 192 110 Z', '#30231a');
  stroke(c, [[186, 112], [181, 132], [190, 135]], '#483425', 3);
  stroke(c, [[177, 149], [197, 145]], '#483425', 3);
  shape(
    c,
    guard
      ? 'M100 91 L144 64 154 40 194 38 214 52 224 72 245 78 210 90 158 99 Z'
      : 'M91 93 L126 79 136 48 140 30 165 34 194 22 205 31 221 69 249 75 246 81 194 92 130 101 Z',
    '#211b15',
  );
  stroke(c, [[95, 94], [146, 84], [191, 79], [242, 76]], light, 3);
  stroke(c, [[139, 54], [143, 35], [164, 40]], light, 2);
  for (let i = 0; i < 14; i++) {
    stroke(c, [[172 + i * 1.5, 145 + i % 3], [166 + i * 1.5, 156 + i % 4]], '#523925', 1);
  }
  c.restore();
}

export function furnish(scene, factory, room, camera) {
  const unit = new THREE.BoxGeometry(1, 1, 1),
    plane = new THREE.PlaneGeometry(1, 1),
    circle = new THREE.CylinderGeometry(1, 1, 1, 18);
  const root = new THREE.Group();
  scene.add(root);
  const materialCache = new Map();
  // Solid props are lit so their bevels and curved parts read as volume under the grade.
  function mat(color) {
    if (!materialCache.has(color)) materialCache.set(color, new THREE.MeshLambertMaterial({ color }));
    return materialCache.get(color);
  }
  const roundCache = new Map();
  function roundedGeo(w, h, d) {
    const m = Math.min(Math.abs(w), Math.abs(h), Math.abs(d));
    if (m < .02) return null;
    const key = [w, h, d].map((v) => v.toFixed(3)).join('|');
    if (!roundCache.has(key)) roundCache.set(key, new RoundedBoxGeometry(w, h, d, 2, Math.min(.022, m * .28)));
    return roundCache.get(key);
  }
  function print(tex, alpha = false) {
    return new THREE.MeshBasicMaterial({
      map: tex,
      transparent: alpha,
      alphaTest: alpha ? .035 : 0,
      side: THREE.DoubleSide,
      depthWrite: !alpha,
    });
  }
  function group(x = 0, y = 0, z = 0, angle = 0, parent = root) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = angle;
    parent.add(g);
    return g;
  }
  function mesh(parent, geo, material, x, y, z, w, h, d = 1) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    parent.add(m);
    return m;
  }
  function block(parent, x, y, z, w, h, d, color) {
    const g = roundedGeo(w, h, d);
    return g ? mesh(parent, g, mat(color), x, y, z, 1, 1, 1) : mesh(parent, unit, mat(color), x, y, z, w, h, d);
  }
  const disk = (p, x, y, z, r, h, col) => mesh(p, circle, mat(col), x, y, z, r, h, r);
  function sheet(p, tex, x, y, z, w, h, alpha = false) {
    return mesh(p, plane, print(tex, alpha), x, y, z, w, h);
  }
  function etched(id, lines, base = '#cdb182', width = 480, height = 298) {
    return factory.make('donor-' + id, width, height, (c, w, h, r) => {
      c.fillStyle = base;
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < w * h / 44; i++) {
        c.fillStyle = i % 3 ? 'rgba(62,39,21,.18)' : 'rgba(255,237,196,.32)';
        c.fillRect(r() * w, r() * h, r() * 2 + 1, 1);
      }
      c.strokeStyle = '#71583a';
      c.lineWidth = 2;
      c.strokeRect(10, 10, w - 20, h - 20);
      c.strokeRect(14, 14, w - 28, h - 28);
      c.textAlign = 'center';
      c.fillStyle = '#59452e';
      c.font = 'bold 15px monospace';
      c.fillText(lines[0], w / 2, 39, w - 36);
      c.fillStyle = '#2b231b';
      c.font = 'bold 36px Georgia';
      c.fillText(lines[1], w / 2, 92, w - 46);
      stroke(c, [[25, 107], [w - 25, 107]], '#6c5437', 2);
      c.textAlign = 'left';
      c.font = '19px monospace';
      for (let i = 2; i < lines.length; i++) {
        const y = 132 + (i - 2) * 30;
        c.fillText(lines[i], 27, y, w - 54);
      }
      for (let k = 0; k < 4; k++) {
        const y = h - 53 + k * 5;
        stroke(c, [[28, y], [w * .50 + r() * w * .2, y]], '#8f7854', 1);
      }
      c.save();
      c.translate(w - 67, h - 56);
      c.rotate(-.17);
      c.strokeStyle = '#80503a';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0, 35, 0, tau);
      c.stroke();
      c.beginPath();
      c.arc(0, 0, 29, 0, tau);
      c.stroke();
      c.textAlign = 'center';
      c.fillStyle = '#80503a';
      c.font = 'bold 14px Georgia';
      c.fillText('AEGIS', 0, 5);
      c.restore();
    });
  }
  // Signs are enamel, brass or stencil; paperwork is painted as real period documents.
  const plaqueKind = { 'rest-area': 'enamel', 'carbon-stock': 'card', dial: 'brass', corridor: 'enamel', cooler: 'stencil', 'cupboard--1': 'enamel', 'cupboard-1': 'enamel', telegraph: 'brass', radio: 'brass' };
  const docKind = { passport: 'cover', dispatch: 'clipping', brochure: 'clipping', seal: 'tag', ribbon: 'carbon', textbook: 'cover', reverse: 'reverse' };
  function docTex(id, lines, w, h, size = 768) {
    const kind = docKind[id] || 'form';
    return factory.make('doc-' + id, size, Math.max(64, Math.round(size * h / w)), (c, cw, ch, r) => paintDocument(c, cw, ch, r, lines, kind));
  }
  function label(p, id, lines, x, y, z, w, h) {
    const kind = plaqueKind[id];
    if (!kind) return sheet(p, docTex(id, lines, w, h, 640), x, y, z, w, h);
    const H = 180, W = Math.round(H * w / h);
    return sheet(p, factory.make('plaque-' + id, W, H, (c, cw, ch, r) => paintPlaque(c, cw, ch, r, lines, kind)), x, y, z, w, h);
  }
  function paper(p, id, lines, x, y, z, w, h, angle = 0) {
    const kind = docKind[id] || 'form';
    const m = sheet(p, docTex(id, lines, w, h), x, y, z, w, h, kind === 'tag' || kind === 'clipping');
    m.rotation.set(-Math.PI / 2, 0, angle);
    return m;
  }
  function table(p, x, z, w, d, h) {
    const t = models.turnedTable({ w, d, h });
    t.position.set(x, 0, z);
    p.add(t);
    return t;
  }
  function frame(p, w, h, d, col) {
    for (const sign of [-1, 1]) {
      block(p, sign * w / 2, 0, 0, .075, h + .09, d, col);
      block(p, 0, sign * h / 2, 0, w + .075, .075, d, col);
    }
  }
  function cylinderBetween(parent, a, b, r, col) {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), delta = bv.sub(av);
    const s = mesh(parent, circle, mat(col), 0, 0, 0, r, delta.length(), r);
    s.position.copy(av).addScaledVector(delta, .5);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return s;
  }
  const silhouette = (name) => factory.make('character-' + name, 360, 640, (c) => portrait(c, name));
  // The recruiter and his enforcer: animated cut-outs with bodies, so they walk round the desk, never through it.
  // Their sheets are painted from the same illustrations as before, one frame per pose.
  const cutout = (name) => makeSheet('character-' + name, { w: 360, h: 640, paint: (c, pose) => portrait(c, name, pose) });
  const recruiter = new Actor(cutout('recruiter'), { height: 2.93, width: 1.80, speed: 1.15 }), enforcer = new Actor(cutout('guard'), { height: 2.78, width: 1.4, speed: 1.5 });
  root.add(recruiter.root, enforcer.root); recruiter.place(.05, -.89, 0); enforcer.place(3.9, .1, -1.2); enforcer.root.visible = false;
  // The affidavit he slides across the desk, and Mateo's hand, which signs and snaps the nib.
  const affidavit = paper(root, 'affidavit', ['AEGIS GLOBAL PATHWAYS', 'MEDICAL AFFIDAVIT', 'Voluntary donation', 'Sign here: ________'], .1, 1.15, -.2, .5, .36, .05);
  affidavit.visible = false;
  const penHand = new SpriteSheetAnimator(makeHandSheet(), { height: .5, fps: 9 }); penHand.mesh.position.set(.42, 1.1, .78); penHand.mesh.visible = false; root.add(penHand.mesh);
  // Opening exit: 0..1 while both men walk to the staff door; null when not playing.
  let exitT = null, scene0 = null, beat0 = -1, slide = 0, left = false, sceneClock = null;
  const DOOR = [4.05, .1], PACE = [[-1.25, -.89], [.95, -.89]];
  // He paces behind the desk, back and forth, until something stops him.
  const pacing = () => new Cutscene([walk(recruiter, [PACE[0]], { pace: .8 }), wait(.9), walk(recruiter, [PACE[1]], { pace: .8 }), wait(.9)], { loop: true });
  const papers = cases.map((c, i) => docTex('case-' + i, c.face, 1.04, .67, 1024));
  const reverse = docTex('reverse', [
    'AEGIS ARCHIVE',
    'DUPLICATE',
    'For the records office',
    'Examined under lamplight',
  ], 1.04, .67, 1024);
  const casePaper = group(.18, 1.12, .98);
  casePaper.rotation.set(-Math.PI / 2, 0, -.06);
  block(casePaper, 0, 0, 0, 1.04, .67, .015, '#725736');
  const paperFront = sheet(casePaper, papers[0], 0, 0, .009, 1.04, .67);
  const back = sheet(casePaper, reverse, 0, 0, -.009, 1.04, .67);
  back.rotation.y = Math.PI;
  const reverseStain = factory.make('dried-stain', 120, 120, (c) => {
    oval(c, 57, 61, 24, 30, '#5e4432');
    oval(c, 84, 36, 7, 5, '#6d5039');
    oval(c, 45, 91, 11, 7, '#6a4d38');
  });
  const stain = sheet(casePaper, reverseStain, -.21, .07, -.012, .26, .26, true);
  stain.rotation.y = Math.PI;
  const scratchTex = factory.make('nib-scratch', 230, 80, (c) => {
    stroke(c, [[9, 61], [67, 47], [101, 49], [210, 17]], '#463626', 4);
    stroke(c, [[9, 64], [65, 51], [100, 51], [215, 18]], '#e5c78a', 2);
  });
  const scratch = sheet(casePaper, scratchTex, .12, -.14, .012, .43, .14, true);
  const passport = group(.80, 1.10, .75);
  block(passport, 0, .018, 0, .31, .039, .45, '#423326');
  const pc = paper(
    passport,
    'passport',
    ['TRAVEL DOCUMENT', 'PASSPORT', 'MATEO'],
    0,
    .041,
    0,
    .29,
    .43,
    -.09,
  );
  pc.material.color.set('#bb9670');
  const window = group(-4.38, 1.94, 3.33, Math.PI / 2);
  frame(window, 2.88, 1.82, .14, '#926b43');
  const skyline = factory.make('docks-at-dusk', 960, 600, (c, w, h, r) => {
    let g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#b3905c');
    g.addColorStop(.65, '#f4d48e');
    g.addColorStop(1, '#9f7950');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    for (let row = 0; row < 2; row++) {
      let x = -8;
      while (x < w) {
        const ww = 34 + r() * 88, yy = 48 + row * 109 + r() * 155;
        c.fillStyle = row ? '#806644' : '#a4875c';
        c.fillRect(x, yy, ww, 430 - yy);
        c.fillRect(x - 3, yy - 5, ww + 6, 6);
        for (let j = yy + 13; j < 419; j += 23) {
          for (let k = x + 7; k < x + ww - 6; k += 15) {
            c.fillStyle = r() > .55 ? '#dabb7b' : '#645137';
            c.fillRect(k, j, 7, 12);
          }
        }
        x += ww + 3;
      }
    }
    c.fillStyle = '#a38863';
    c.fillRect(0, 427, w, 173);
    for (let i = 0; i < 10; i++) stroke(c, [[0, 458 + i * i], [w, 449 + i * i]], '#6f5a40', 1);
    for (const x of [167, 705]) {
      c.fillStyle = '#433a29';
      c.fillRect(x, 208, 6, 240);
      c.fillRect(x - 5, 437, 17, 12);
      shape(c, `M${x - 13} 199 L${x + 18} 199 L${x + 10} 224 L${x - 4} 224 Z`, '#4e422f');
      oval(c, x + 3, 207, 9, 12, '#ffe5a1');
    }
    for (let i = 0; i < 130; i++) {
      const xx = r() * w, yy = r() * h;
      stroke(c, [[xx, yy], [xx - 6, yy + 18 + r() * 22]], '#dac49166', 1);
    }
  });
  sheet(window, skyline, 0, 0, .009, 2.87, 1.81);
  const nightSky=factory.make('harbour-after-hours',960,600,(c,w,h,r)=>{
    const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#28354a');sky.addColorStop(.72,'#77858b');sky.addColorStop(1,'#37424e');c.fillStyle=sky;c.fillRect(0,0,w,h);
    for(let i=0;i<55;i++)oval(c,r()*w,r()*215,1.2,1.2,'#d9dccd');
    for(let row=0;row<2;row++){let x=-8;while(x<w){const ww=34+r()*88,yy=50+row*109+r()*155;c.fillStyle=row?'#354151':'#526073';c.fillRect(x,yy,ww,431-yy);c.fillRect(x-3,yy-5,ww+6,6);for(let j=yy+13;j<419;j+=23)for(let k=x+7;k<x+ww-6;k+=15){c.fillStyle=r()>.65?'#faca70':'#44505c';c.fillRect(k,j,7,12);}x+=ww+3;}}
    c.fillStyle='#4c5660';c.fillRect(0,427,w,173);
    for(const x of [167,705]){const halo=c.createRadialGradient(x,208,2,x,208,63);halo.addColorStop(0,'#f5b960b0');halo.addColorStop(1,'#e6ac5700');c.fillStyle=halo;c.fillRect(x-63,145,126,126);c.fillStyle='#3c3833';c.fillRect(x,208,6,240);oval(c,x+3,207,9,12,'#ffe5a1');}
  });
  const cityNight=sheet(window,nightSky,0,0,.012,2.87,1.81,true);
  const celestialTexture=factory.make('sky-orbs',160,160,c=>{const g=c.createRadialGradient(80,80,10,80,80,78);g.addColorStop(0,'#ffeab4');g.addColorStop(.33,'#ffdeb0');g.addColorStop(.36,'#f9df935a');g.addColorStop(1,'#ffae5700');c.fillStyle=g;c.fillRect(0,0,160,160);});
  const orb=sheet(window,celestialTexture,0,.60,.017,.36,.36,true);
  const walkers = [];
  for (let i = 0; i < 4; i++) {
    const p = group(0, -.43, .024 + i * .002, 0, window);
    const body = sheet(p, silhouette('walker'), 0, .30, 0, .36, .70, true);
    body.material.color.setScalar(.52 + i * .08);
    const legs = [-1, 1].map((sign) => {
      const leg = group(sign * .045, .09, 0, 0, p);
      block(leg, 0, -.10, 0, .055, .23, .012, '#392e24');
      return leg;
    });
    walkers.push({ p, legs });
  }
  const film = mesh(
    window,
    plane,
    new THREE.MeshBasicMaterial({ color: '#342c23', transparent: true, opacity: .22, depthWrite: false }),
    0,
    0,
    .060,
    2.86,
    1.80,
  );
  block(window, 0, 0, .087, .044, 1.78, .04, '#4a3828');
  block(window, 0, -.90, .105, 3.13, .11, .31, '#a27b4b');
  const hand = factory.make('palm-print', 180, 200, (c) => {
    oval(c, 85, 127, 33, 43, '#5a4734');
    [[38, 91, -.45, 9, 29], [51, 53, -.23, 8, 39], [77, 44, -.09, 8, 39], [100, 46, .09, 8, 35], [
      123,
      62,
      .24,
      7,
      29,
    ]].forEach(([x, y, a, w, h]) => {
      c.save();
      c.translate(x, y);
      c.rotate(a);
      oval(c, 0, 0, w, h, '#5a4734');
      c.restore();
    });
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 26; i++) {
      stroke(c, [[24, 39 + i * 6], [73, 42 + i * 6], [133, 40 + i * 6]], '#000', 1.4);
    }
  });
  const palms = [[-.6, -.12, -.10], [.12, .05, .15], [.61, -.09, .22]].map(([x, y, a]) => {
    const h = sheet(window, hand, x, y, .104, .34, .39, true);
    h.rotation.z = a;
    h.material.opacity = .48;
    return h;
  });
  paper(
    window,
    'brochure',
    ['AEGIS CHARITY CLINIC', 'COMMUNITY', 'Proudly serving our community'],
    .83,
    -.837,
    .13,
    .64,
    .24,
  );
  // Easter egg: a wanted poster pinned beside the street window. The photo loads asynchronously
  // and is printed onto the poster in sepia halftone so it sits in the period.
  {
    const W = 600, H = 820;
    const tex = factory.make('wanted-poster', W, H, (c, w, h, r) => {
      c.fillStyle = '#e4d6b2'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < w * h / 16; i++) { const v = r() * 30 - 15; c.fillStyle = `rgba(${200 + v | 0},${180 + v | 0},${140 + v | 0},.35)`; c.fillRect(r() * w, r() * h, 2, 1); }
      for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(140,90,40,${.05 + r() * .1})`; c.beginPath(); c.arc(r() * w, r() * h, 1 + r() * 5, 0, 7); c.fill(); }
      c.strokeStyle = '#2b2218'; c.lineWidth = 6; c.strokeRect(18, 18, w - 36, h - 36); c.lineWidth = 2; c.strokeRect(28, 28, w - 56, h - 56);
      c.fillStyle = '#231b12'; c.textAlign = 'center';
      c.font = 'bold 118px Rockwell, Georgia, serif'; c.fillText('WANTED', w / 2, 140);
      c.font = 'italic 30px "Iowan Old Style", Georgia, serif'; c.fillText('for questioning', w / 2, 182);
      c.fillStyle = '#c9b892'; c.fillRect(90, 205, 420, 440);
      c.font = 'bold 34px Rockwell, Georgia, serif'; c.fillStyle = '#231b12'; c.fillText('LAST SEEN AT THE', w / 2, 700);
      c.fillText('OAK HACKATHON', w / 2, 742);
      c.font = 'italic 26px "Iowan Old Style", Georgia, serif'; c.fillText('Reward: one working build', w / 2, 784);
    });
    const art = new Image();
    art.onload = () => {
      const c = tex.image.getContext('2d'), x = 100, y = 215, w = 400, h = 420;
      c.drawImage(art, 0, (art.height - art.width * h / w) / 2, art.width, art.width * h / w, x, y, w, h);
      const px = c.getImageData(x, y, w, h), d = px.data;
      for (let i = 0; i < d.length; i += 4) {
        // Sepia, lifted contrast, then a coarse print grain.
        let l = (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11) / 255;
        l = Math.min(1, Math.max(0, (l - .5) * 1.35 + .5)) * (.9 + Math.random() * .12);
        d[i] = 255 * Math.min(1, l * 1.02 + .04); d[i + 1] = 255 * Math.min(1, l * .9 + .03); d[i + 2] = 255 * Math.min(1, l * .7 + .02);
      }
      c.putImageData(px, x, y);
      c.strokeStyle = '#2b2218'; c.lineWidth = 3; c.strokeRect(x, y, w, h);
      tex.needsUpdate = true;
    };
    art.src = __WANTED_ART__;
    const poster = group(-4.452, 2.02, 1.18, Math.PI / 2);
    const sheetMesh = sheet(poster, tex, 0, 0, 0, .74, 1.01);
    sheetMesh.rotation.z = .025;
    for (const [px, py] of [[-.33, .46], [.33, .46], [-.33, -.46], [.33, -.46]]) disk(poster, px, py, .012, .014, .012, '#8a2f22').rotation.x = Math.PI / 2;
  }
  // Shelf on the west wall, with a clipboard, unmarked pad and brass binocular-style relay.
  const bench = group(-4.02, 0, .44, Math.PI / 2);
  table(bench, 0, 0, 3.35, .67, 1.07);
  paper(bench, 'ledger', ['INTAKE REGISTER', 'BLANK PAD', ''], -.17, 1.078, 0, .49, .34, .10);
  paper(
    bench,
    'dispatch',
    ['AEGIS PLACEMENTS', 'DISPATCH', 'Overseas lab tech   $4,000/mo', 'No visa needed'],
    1.08,
    1.082,
    .04,
    .52,
    .36,
    -.08,
  );
  const watch=group(-3.96,1.09,1.57);watch.add(models.pocketWatchCase({r:.16}));
  const clockPrint=factory.make('pocket-clock',180,180,c=>{
    oval(c,90,90,83,83,'#e0cea2');for(let i=0;i<12;i++){const v=i*Math.PI/6;stroke(c,[[90+59*Math.sin(v),90-59*Math.cos(v)],[90+75*Math.sin(v),90-75*Math.cos(v)]],ink,4);}stroke(c,[[59,68],[90,90],[125,49]],ink,6);
  });
  const face=sheet(watch,clockPrint,0,.057,0,.30,.30,true);face.rotation.x=-Math.PI/2;
  const chain=new THREE.TorusGeometry(.044,.008,8,18);const loop=mesh(watch,chain,mat(brass),0,.033,-.185,1,1,1);loop.rotation.x=-Math.PI/2;
  for (const [x, z, w, h, d, rows] of [[-3.68, -1.83, .87, 1.93, .82, 4], [-2.77, -1.92, .84, 1.41, .72, 3]]) {
    const cab = models.filingCabinet({ w, h: h - .06, d, rows }); cab.position.set(x, -.03, z); root.add(cab);
  }
  // The staff bench sits against the north wall, under the window.
  const rest=models.slattedBench({w:1.1,seat:.5});rest.position.set(-1.55,0,-2.52);root.add(rest);
  label(root,'rest-area',['STAFF ONLY','REST BENCH'],-1.55,1.42,-2.93,.62,.24);
  label(root,'carbon-stock',['OFFICE SUPPLIES','CARBON PAPER'],3.19,1.08,-2.04,.69,.24);
  paper(root,'register',['REGISTRATION BOARD','AGENCY COPY','Align the corner crosses'],1.34,1.232,-.14,.60,.40,.05);
  const seal=group(2.33,.80,9.0);block(seal,0,.016,0,.25,.03,.14,brass);paper(seal,'seal',['FREIGHT SEAL','K7'],0,.036,0,.22,.13);
  const roster=group(4.42,1.6,13.4,-Math.PI/2);label(roster,'duty',['NIGHT DUTY','ADVOCATE','Harbour service    640 kHz'],0,0,.04,.55,.46);
  const rad = group(-4.11, 0, 5.0, Math.PI / 2); // lobby radiator (case 1); the lab has its own
  rad.add(models.columnRadiator({ sections: 11, pitch: .115, height: .86, columns: 3 }));
  const key = group(4.12, .112, 8.7);
  const ring = new THREE.TorusGeometry(.057, .011, 8, 16);
  const bow = mesh(key, ring, mat(brass), 0, 0, 0, 1, 1, 1);
  bow.rotation.x = -Math.PI / 2;
  block(key, .09, 0, 0, .15, .017, .028, brass);
  block(key, .15, 0, .023, .028, .017, .05, brass);
  const lock = group(-1.60, .77, 1.592);
  block(lock, 0, 0, 0, .40, .19, .042, '#423224');
  for (let i = 0; i < 3; i++) {
    const wheel = disk(lock, (i - 1) * .103, 0, .025, .058, .067, brass);
    wheel.rotation.z = Math.PI / 2;
  }
  label(lock, 'dial', ['AEGIS', '0   0   0'], 0, 0, .084, .34, .092);
  const deskDrawer = group(-1.60, .77, 1.45);
  block(deskDrawer, 0, 0, .137, .86, .22, .028, '#826444');
  block(deskDrawer, 0, -.095, -.16, .82, .035, .64, '#413325');
  for (const x of [-.406, .406]) block(deskDrawer, x, -.01, -.16, .04, .20, .64, '#58422c');
  paper(deskDrawer, 'drawer-report', cases[1].face, 0, -.067, -.12, .62, .37);
  const door = group(4.39, 1.36, .05, -Math.PI / 2);
  door.add(models.panelDoor({ w: 1.55, h: 2.66, glassY: .47, glassW: 1.13, glassH: 1.01 }));
  const glass = factory.make('frosted-wire', 420, 430, (c, w, h, r) => {
    c.fillStyle = '#c6ad7b';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6500; i++) {
      c.fillStyle = r() > .5 ? '#9d855d' : '#dbc395';
      c.fillRect(r() * w, r() * h, 2, 2);
    }
    for (let x = -h; x < w + h; x += 22) {
      stroke(c, [[x, 0], [x + h, h]], '#77684c', 1);
      stroke(c, [[x, 0], [x - h, h]], '#77684c', 1);
    }
  });
  sheet(door, glass, 0, .47, .074, 1.13, 1.01);
  label(door, 'corridor', ['STAFF ENTRANCE', 'CORRIDOR'], 0, -.39, .1, .62, .2);
  const guard = sheet(door, silhouette('guard'), 0, .45, .091, .67, 1.05, true);
  guard.material.opacity = .78;
  guard.visible = false;
  const beamShape=new THREE.Shape();beamShape.moveTo(0,0);
  for(let i=0;i<=24;i++){const a=-SEARCH_HALF_ANGLE+2*SEARCH_HALF_ANGLE*i/24;beamShape.lineTo(-Math.cos(a),-Math.sin(a));}beamShape.closePath();
  const beamMaterial=new THREE.MeshBasicMaterial({color:'#efbc71',transparent:true,opacity:.21,depthWrite:false,side:THREE.DoubleSide});
  const searchBeam=new THREE.Mesh(new THREE.ShapeGeometry(beamShape),beamMaterial);root.add(searchBeam);searchBeam.position.set(4.28,.018,.05);searchBeam.rotation.order='YXZ';searchBeam.rotation.x=-Math.PI/2;
  const doorLamp=block(door,0,1.15,.082,.24,.075,.065,'#e8c384');
  const cooler = group(2.33, 0, 9.0, Math.PI);
  cooler.add(models.transitChest({ w: .96, h: .62, d: .66 }));
  label(cooler, 'cooler', ['MEDICAL TRANSIT', 'COLD STORAGE'], 0, .4, .336, .44, .24);
  const closet = group(2.6, 0, 6.87, 0);
  block(closet, 0, 1.20, -.30, 1.70, 2.40, .08, '#504a3b');
  for (const x of [-.82, .82]) block(closet, x, 1.20, 0, .07, 2.40, .68, '#68614e');
  for (const y of [.06, .78, 1.30, 1.89, 2.36]) block(closet, 0, y, 0, 1.62, .055, .64, '#807158');
  for (const x of [-.49, -.16, .27, .48]) {
    disk(closet, x, .95, -.04, .088, .29, '#b19c76');
    disk(closet, x, 1.111, -.04, .059, .037, '#514b3b');
  }
  paper(closet, 'shelved-manifest', cases[2].face, .14, 1.334, .03, .63, .37, -.12);
  const hinges = [-1, 1].map((sign) => {
    const hinge = group(sign * .814, 0, .352, 0, closet), inner = -sign * .397;
    block(hinge, inner, 1.22, 0, .78, 2.18, .045, '#7c785f');
    for (let i = 0; i < 6; i++) block(hinge, inner, 1.86 + i * .049, .026, .52, .017, .012, '#4d4838');
    label(
      hinge,
      'cupboard-' + sign,
      ['AEGIS · STAFF ONLY', sign < 0 ? 'MEDICAL' : 'SUPPLY'],
      inner,
      1.47,
      .033,
      .60,
      .25,
    );
    block(hinge, inner - sign * .25, 1.05, .052, .079, .19, .076, brass);
    return hinge;
  });
  const printer = group(-.6, 0, 14.21, Math.PI);
  table(printer, 0, 0, 1.66, .66, .98);
  printer.add(models.teleprinter());
  label(printer, 'telegraph', ['RECORDING APPARATUS', 'TELEPRINTER'], 0, 1.18, .262, .56, .16);
  { const rib = sheet(printer, factory.make('doc-ribbon', 640, 400, (c, cw, ch, r) => paintDocument(c, cw, ch, r, ['CARBON COPY', 'DISPATCH', 'Routing copy    archive'], 'carbon')), 0, 1.6, -.1, .5, .3); rib.rotation.x = -.35; }
  const tray = group(3.99, 0, 11.92, -Math.PI / 2);
  tray.add(models.instrumentTrolley({ w: 1.95, d: .69, h: 1.055 }));
  paper(
    tray,
    'waiver',
    ['AEGIS MEDICAL', 'CONSENT WAIVER', 'Voluntary donor declaration', 'Notarised   •   Duplicate'],
    -.45,
    1.07,
    .05,
    .52,
    .40,
    .05,
  );
  { const book = models.clothBook({ w: .49, d: .4, h: .07 }); book.position.set(.45, 1.065, 0); tray.add(book); }
  paper(
    tray,
    'textbook',
    ['A practical handbook', 'Medical Ethics'],
    .45,
    1.137,
    0,
    .47,
    .38,
  );
  // The negative lens reveals ink on the objects themselves. The marks are separate from the HUD.
  function traceInk(name, lines, x, y, z, w, h, turn = 0, onTop = false) {
    const texture = factory.make('latent-' + name, 600, 210, (c) => {
      c.textAlign = 'center';
      c.fillStyle = '#67ffff';
      c.strokeStyle = '#66ffff';
      c.lineWidth = 3;
      c.strokeRect(10, 10, 580, 188);
      c.font = 'bold 27px monospace';
      c.fillText(lines[0], 300, 56, 545);
      c.font = 'bold 55px monospace';
      c.fillText(lines[1], 300, 134, 545);
      for (let k = 0; k < 5; k++) stroke(c, [[29 + k * 8, 167], [52 + k * 8, 146]], '#67ffff', 2);
    });
    const mark = sheet(root, texture, x, y, z, w, h, true);
    mark.rotation.set(onTop ? -Math.PI / 2 : 0, onTop ? 0 : turn, onTop ? turn : 0);
    return mark;
  }
  const latent = [
    [0, traceInk('ledger', ['INTAKE FILE', '4  0  9'], -4.02, 1.087, .61, .51, .29, -Math.PI / 2, true)],
    [1, traceInk('cooler', ['OLD STENCIL', 'PIER 9'], 2.33, .80, 9.0, .69, .44, Math.PI, true)],
    [1, traceInk('tint', ['STREET FACE', 'ONE-WAY FILM'], -4.272, 1.36, 3.70, .50, .18, Math.PI / 2)],
    [
      2,
      traceInk(
        'ribbon',
        ['ST. JUDE MARITIME CLINIC', 'SUITE B  /  04:00'],
        -.59,
        1.49,
        13.94,
        .76,
        .23,
        Math.PI,
      ),
    ],
    [
      2,
      traceInk(
        'waiver',
        ['ORIGINAL SIGNATURE', 'I DO NOT CONSENT'],
        3.94,
        1.083,
        11.47,
        .44,
        .30,
        -Math.PI / 2,
        true,
      ),
    ],
  ];
  const dawn = sheet(
    window,
    factory.make('dawn-light', 320, 200, (c, w, h) => {
      const wash = c.createLinearGradient(0, 0, 0, h);
      wash.addColorStop(0, '#ffedba');
      wash.addColorStop(1, '#c39a62');
      c.fillStyle = wash;
      c.fillRect(0, 0, w, h);
    }),
    0,
    0,
    .052,
    2.85,
    1.80,
    true,
  );
  function pavementFigure(style) {
    return factory.make('pedestrian-' + style, 200, 320, (c) => {
      const co = style === 'student' ? '#544936' : '#3b3228';
      if (style === 'student') {
        shape(
          c,
          'M56 300 L63 208 61 137 79 118 107 116 126 133 135 211 145 299 119 302 97 214 86 304 Z',
          co,
        );
        shape(c, 'M76 130 Q43 131 44 180 L45 210 62 212 73 166 Z', '#6b5740');
        oval(c, 94, 89, 24, 32, '#725a41');
        shape(c, 'M68 88 Q62 55 94 51 Q121 52 121 78 L107 73 95 81 77 84 Z', co);
        stroke(c, [[80, 124], [69, 162], [82, 188]], '#a18b68', 4);
      } else {
        shape(c, 'M38 298 L59 223 70 158 64 133 82 121 110 115 131 137 128 169 147 225 162 298 Z', co);
        oval(c, 94, 89, 23, 29, '#705940');
        shape(c, 'M62 102 Q61 54 88 51 Q121 47 125 82 L118 102 113 81 93 77 81 114 Z', co);
        stroke(c, [[67, 142], [60, 184], [80, 203]], '#9d845c', 4);
        shape(c, 'M88 210 L113 198 132 224 104 236 Z', '#796047');
      }
    });
  }
  walkers.forEach(({ p }, i) => {
    if (i === 1 || i === 3) {
      p.children[0].material = print(pavementFigure(i === 1 ? 'student' : 'commuter'), true);
    }
  });
  const radio = group(1.40, 1.09, 1.10, -.08);
  radio.add(models.cathedralRadio({ w: .5, h: .62, d: .3 }));
  // ── Doors between the rooms. Each leaf swings from its hinge into the next room. ──
  function doorLeaf(hx, hz, w, h) {
    const pivot = group(hx, 0, hz, 0);
    const leaf = models.panelDoor({ w, h, glassY: h * .22, glassW: w * .6, glassH: h * .25, frame: false });
    leaf.position.set(-w / 2, h / 2, -.03); pivot.add(leaf);
    return pivot;
  }
  const labDoor = doorLeaf(-1.57, 6.45, 1.04, 2.45), dispatchDoor = doorLeaf(-2.9, 10.25, .9, 2.28);
  // ── Recruitment terminal by the lab door, and the door keypad. ──
  table(root, .5, 6.02, 1.2, .6, .78);
  const term = group(.5, .78, 6.1, Math.PI);
  block(term, 0, .26, 0, .7, .5, .45, '#3f3a30'); block(term, 0, .02, -.12, .74, .06, .3, '#2b2620');
  const adScreen = factory.make('terminal-ads', 512, 360, (c, w, h) => {
    c.fillStyle = '#071a0e'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#5cff9b'; c.font = 'bold 30px "American Typewriter", monospace';
    ['LAB TECH  $4,000/MO', 'NO VISA NEEDED', 'FREE FLIGHTS', '> proxy 10.4.0.9'].forEach((t, i) => c.fillText(t, 26, 70 + i * 74));
    for (let y = 0; y < h; y += 4) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, y, w, 2); }
  });
  const screen = sheet(term, adScreen, 0, .3, -.226, .56, .38);
  screen.rotation.y = Math.PI;
  const keypad = group(-1.25, 1.35, 6.37, Math.PI);
  block(keypad, 0, 0, 0, .2, .28, .03, '#b48a4e');
  const keyGlow = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) keyGlow.push(block(keypad, (c - 1) * .055, .08 - r * .055, .02, .04, .04, .015, '#3a2c1a'));
  for (const obj of Object.values(room.artifacts)) obj.visible = false;
  room.setBoardLabels('intake', 'INTAKE RECEIPT', 'COURIER COPY');
  // The evidence board grows with the investigation: one pinned card per exhibit, Mateo's portrait, the
  // file number in highlighter yellow, and a red thread through each case once it is closed.
  const boardCards = [], boardThreads = [], BW = 2.88, BH = 1.72;
  const slot = (n) => [(-1.5 + n % 4) * .68, (1 - Math.floor(n / 4)) * .53];
  const wrapText = (c, text, x, y, maxW, lh) => { let line = ''; for (const word of text.split(' ')) { const t = line ? line + ' ' + word : word; if (c.measureText(t).width > maxW && line) { c.fillText(line, x, y); y += lh; line = word; } else line = t; } c.fillText(line, x, y); };
  const cardTex = (id, title, note, bg = '#ece1c4') => factory.make('board-card-' + id, 300, 196, (c, w, h, r) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h); c.strokeStyle = '#8f7650'; c.lineWidth = 3; c.strokeRect(3, 3, w - 6, h - 6);
    for (let i = 0; i < 500; i++) { c.fillStyle = i % 3 ? 'rgba(70,45,22,.10)' : 'rgba(255,240,205,.22)'; c.fillRect(r() * w, r() * h, 2, 1); }
    c.fillStyle = '#a3271c'; c.beginPath(); c.arc(w / 2, 16, 8, 0, 7); c.fill();
    c.fillStyle = '#2b2620'; c.font = '700 25px Rockwell, Georgia, serif'; wrapText(c, title, 16, 58, w - 32, 27);
    c.fillStyle = '#23305f'; c.font = '19px "American Typewriter", "Courier New", monospace'; wrapText(c, note, 16, 118, w - 32, 23);
  }, 2);
  evidence.forEach(([title, note], i) => {
    const n = i < 1 ? i : i + 1, [x, y] = slot(n); // slot 1 is kept for Mateo's portrait
    const m = sheet(room.board, cardTex(i, title, note), x + (i % 3 - 1) * .02, y + (i % 2 ? .015 : -.015), .058 + i * .0007, .56, .366);
    m.rotation.z = ((i * 37) % 9 - 4) * .012; m.visible = false; boardCards.push(m);
  });
  { const [x, y] = slot(1);
    const face = sheet(room.board, factory.make('board-mateo', 300, 196, (c, w, h) => {
      c.fillStyle = '#efe8d8'; c.fillRect(0, 0, w, h); c.fillStyle = '#5d5a52'; c.fillRect(14, 14, 120, 150);
      c.fillStyle = '#b88d69'; c.beginPath(); c.ellipse(74, 82, 30, 38, 0, 0, 7); c.fill(); c.fillStyle = '#1d1712'; c.beginPath(); c.ellipse(74, 54, 33, 20, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#d9d3c4'; c.beginPath(); c.moveTo(24, 164); c.quadraticCurveTo(74, 108, 124, 164); c.fill();
      c.fillStyle = '#2b2620'; c.font = '700 26px Rockwell, Georgia, serif'; c.fillText('MATEO R.', 148, 50); c.font = '18px "American Typewriter", "Courier New", monospace'; c.fillStyle = '#a3271c'; c.fillText('MISSING', 148, 82);
      c.fillStyle = '#23305f'; c.fillText('Last seen:', 148, 122); c.fillText('Aegis intake', 148, 146);
    }, 2), x, y, .06, .56, .366); face.rotation.z = -.03; boardCards.portrait = face;
    const tag = sheet(room.board, factory.make('board-409', 200, 70, (c, w, h) => { c.fillStyle = '#f4c81f'; c.fillRect(0, 0, w, h); c.fillStyle = '#1e2557'; c.font = '800 44px Rockwell, Georgia, serif'; c.textAlign = 'center'; c.fillText('FILE 409', w / 2, 50); }, 2), x + .12, y - .26, .066, .3, .105); tag.rotation.z = .05; tag.visible = false; boardCards.tag = tag; }
  // Threads join the cards of a closed case, card to card.
  [[0, 1, 8], [2, 3, 4, 5, 9], [6, 7, 10]].forEach((ids, ci) => {
    const g = new THREE.Group(); g.visible = false; room.board.add(g); boardThreads.push(g);
    for (let k = 0; k < ids.length - 1; k++) {
      const a = boardCards[ids[k]].position, b = boardCards[ids[k + 1]].position, dx = b.x - a.x, dy = b.y - a.y;
      const t = mesh(g, unit, mat('#a3271c'), (a.x + b.x) / 2, (a.y + b.y) / 2 + .16, .075, Math.hypot(dx, dy), .008, .004); t.rotation.z = Math.atan2(dy, dx);
    }
  });
  let currentCase = -1;
  function setCase(index) {
    if (currentCase === index) return;
    currentCase = index;
    paperFront.material.map = papers[index];
    paperFront.material.needsUpdate = true;
    scratch.visible = index === 0;
    stain.visible = index === 1;
  }
  let doorEase = 0;
  function animate(t,state,patrol,sky,solar,range,strip) {
    {
      const k = 1 - Math.exp(-4 * (state.dt || 0));
      const labOpen = (state.gates && state.gates[0]) || state.caseIndex >= 1, dispOpen = (state.gates && state.gates[1]) || state.caseIndex >= 2;
      labDoor.rotation.y += ((labOpen ? 1.45 : 0) - labDoor.rotation.y) * (k || 1);
      dispatchDoor.rotation.y += ((dispOpen ? 1.45 : 0) - dispatchDoor.rotation.y) * (k || 1);
      const cut = (state.gates && state.gates[0]) || state.gateStep === 'keypad' || state.caseIndex >= 1;
      screen.visible = !cut;
      const lit = (state.gates && state.gates[0]) || state.caseIndex >= 1;
      keyGlow.forEach((m, i) => { m.material = mat(lit && [3, 8, 10].includes(i) ? '#7fd3ff' : '#3a2c1a'); });
      doorEase = k;
    }
    const drawerOpen = state.exhibits.includes(2) && state.stage !== 'memory';
    const targetZ = 1.45 + (drawerOpen ? .49 : 0), ease = 1 - Math.exp(-8 * (state.dt || 0));
    deskDrawer.position.z += (targetZ - deskDrawer.position.z) * ease;
    lock.position.z = deskDrawer.position.z + .157;
    const closetOpen = state.exhibits.includes(5) && state.stage !== 'memory';
    hinges.forEach((hinge, i) => {
      const target = closetOpen ? (i === 0 ? -1.20 : 1.36) : 0;
      hinge.rotation.y += (target - hinge.rotation.y) * ease;
    });
    const leaving = exitT !== null && exitT < 1;
    // ── The opening scene, choreographed. Each beat of the contract starts a short sequence of steps. ──
    // The scene plays in real time: the game's own clock stands still while the contract panel is up.
    const nowS = performance.now() / 1000, dt = Math.min(.1, nowS - (sceneClock ?? nowS)); sceneClock = nowS;
    const inScene = state.stage === 'contract', refused = state.coercion === 'refused';
    if (!inScene && !leaving) { recruiter.root.visible = enforcer.root.visible = affidavit.visible = penHand.mesh.visible = false; beat0 = -1; scene0 = null; left = false; }
    else {
      if (inScene && state.beat !== beat0) {
        beat0 = state.beat; left = false;
        if (beat0 === 0) { recruiter.place(.05, -.89, 0); slide = 0; scene0 = pacing(); }
        // Beat 1: he comes to the middle of the desk, leans in and slides the affidavit across, then goes back to pacing.
        else if (beat0 === 1) scene0 = new Cutscene([walk(recruiter, [[.1, -.89]]), turn(recruiter, 0), call(() => { slide = Math.max(slide, .001); }), act(recruiter, 'interact', 1.3), wait(1.6), call(() => { scene0 = pacing(); })]);
        // Beat 2: if Mateo refuses, the enforcer comes in through the staff door, round the end of the desk, and reaches across it.
        else { slide = Math.max(slide, .001); enforcer.place(3.9, .1, -1.2);
          scene0 = new Cutscene([walk(recruiter, [[.1, -.89]]), turn(recruiter, 0), together(act(recruiter, 'interact', 1.6), refused ? walk(enforcer, [[2.65, -.7], [1.45, -.95]]) : wait(.1)), refused ? turn(enforcer, 0) : wait(.1), refused ? act(enforcer, 'interact', 1.6) : wait(.1)]);
          if (!refused) { penHand.play('idle'); penHand.play('snap', { once: true }); } }
      }
      // Leaving: both men walk out by the staff door, each along his own side of the desk.
      if (leaving && !left) { left = true; scene0 = new Cutscene([together(walk(recruiter, [[2.6, -.89], [3.5, -.35], DOOR], { pace: 1.75 }), walk(enforcer, [[2.65, -.7], DOOR], { pace: 1.6 }))]); }
      scene0?.update(dt);
      recruiter.root.visible = (inScene || leaving) && !(leaving && !recruiter.busy);
      enforcer.root.visible = (inScene || leaving) && refused && state.beat >= 2 && !(leaving && !enforcer.busy);
      if (!recruiter.busy && !leaving && recruiter.heldFor <= 0) recruiter.heading = 0;                          // at rest he faces Mateo
      if (!enforcer.busy && !leaving) enforcer.heading = 0;
      recruiter.update(dt, camera); enforcer.update(dt, camera);
      if (slide > 0) slide = Math.min(1, slide + dt / .9);
      const ease = slide * slide * (3 - 2 * slide);
      affidavit.visible = slide > 0; affidavit.position.z = -.2 + ease * .78; affidavit.rotation.z = .05 + ease * .12;
      penHand.mesh.visible = inScene && state.beat === 2 && !refused;
      if (penHand.mesh.visible) penHand.update(dt, camera);
    }
    passport.visible = state.stage === 'contract' && !state.confiscated;
    watch.visible = ['contract', 'street'].includes(state.stage);
    for (const [index, mark] of latent) {
      mark.visible = state.stage === 'memory' && state.caseIndex === index && isNight(state.solarTime);
    }
    dawn.material.opacity = strip * .65;
    dawn.visible = strip > 0;
    cityNight.material.opacity=1-sky.sun;cityNight.visible=sky.sun<.999;
    const angle=solar/DAY_LENGTH*Math.PI*2;orb.position.x=-Math.cos(angle)*.98;orb.position.y=.25+Math.abs(Math.sin(angle))*.49;orb.material.opacity=.65+.35*Math.abs(Math.sin(angle));orb.material.color.set(sky.sun>.54?'#ffdfa2':'#c9d7ec');
    { const det = !['memory', 'contract', 'street'].includes(state.stage); // the detective's board, not Mateo's night
      boardCards.forEach((m, i) => { m.visible = det && state.exhibits.includes(i); });
      boardCards.portrait.visible = det; boardCards.tag.visible = det && state.exhibits.includes(1);
      boardThreads.forEach((g, i) => { g.visible = det && state.links.includes(i); }); }
    room.setSunlight(sky.sun);const active=state.stage==='memory'&&patrol.phase!=='away';
    guard.visible=active;guard.position.x=patrol.offset*.48;guard.material.opacity=.8+ (1-sky.sun)*.18;
    doorLamp.material=mat(active?'#ffc770':'#7d735a');
    searchBeam.visible=active&&patrol.phase==='search';searchBeam.rotation.y=patrol.sweep;searchBeam.scale.set(range,range,1);
    beamMaterial.opacity=.16+(1-sky.sun)*.13;

    palms.forEach((h, i) => {
      h.visible = i < state.pounds;
      h.material.opacity = state.stage === 'memory' && isNight(state.solarTime) ? .83 : .40;
    });
    for (let i = 0; i < walkers.length; i++) {
      const { p, legs } = walkers[i], speed = .15 + i * .023, sign = i % 2 ? 1 : -1;
      const react = state.reaction > 0 && (state.pounds === 1 ? i === 0 : state.pounds === 2 && i < 2);
      // The finale: as the tint comes off the glass, each passer-by in turn stops walking, turns to the window and looks in.
      const looking = !react && (state.stage === 'end' || (state.stage === 'strip' && strip > .25 + i * .13));
      if (!react && !looking) p.userData.walk = (p.userData.walk || 0) + (state.dt || 0) * speed;
      const progress = (p.userData.walk || 0) + i * .71, pos = (progress % 2.8) - 1.40;
      p.position.x = react ? -.36 + i * .45 : sign * pos;
      p.scale.x = (looking ? 1 : sign) * (state.pounds === 2 && react ? .90 : 1);
      p.visible = Math.abs(p.position.x) < 1.27 && (i<2 || sky.sun>.30 || state.stage==='street' || looking);
      p.children[0].rotation.z = react && state.pounds === 1 ? .06 : looking ? -.045 : 0;                        // head back, looking up at the window
      p.rotation.z = react ? (i % 2 ? .035 : -.036) : looking ? 0 : Math.sin(t * 4.3 + i) * .018;
      legs.forEach((l, j) => l.rotation.z = react || looking ? 0 : Math.sin(t * 5 + i + j * Math.PI) * .35);
    }
    film.scale.x = 2.86 * (1 - strip);
    film.position.x = -1.43 * strip;
    film.visible = strip < .995;
    key.visible = state.caseIndex >= 1 &&
      ((state.stage === 'memory' && state.caseIndex === 1 && isNight(state.solarTime)) || state.stage === 'recoverKey');
    if (key.visible) {
      key.children.forEach((m) => m.material = mat(state.stage === 'memory' ? '#63ffff' : brass));
    }
  }
  return { casePaper, setCase, animate, leave: (v) => { exitT = v; }, lamp: room.lampTarget, window, guardSheet: cutout('guard') };
}
