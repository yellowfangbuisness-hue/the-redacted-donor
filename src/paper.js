// Period paperwork painted onto canvases: printed forms with typewritten entries, newspaper
// clippings, book covers, shipping tags, and the enamel or brass signs fixed to furniture.
const TYPE = '"American Typewriter","Courier New",monospace';
const PRINT = 'Rockwell,"Roboto Slab",Georgia,serif';
const SERIF = '"Iowan Old Style",Baskerville,Georgia,serif';

function agedPaper(c, w, h, r, base = [233, 222, 194]) {
  const [R, G, B] = base;
  c.fillStyle = `rgb(${R},${G},${B})`;
  c.fillRect(0, 0, w, h);
  // Fibres and grain.
  for (let i = 0; i < w * h / 18; i++) {
    const v = r() * 34 - 17;
    c.fillStyle = `rgba(${R + v | 0},${G + v | 0},${B + v * .8 | 0},.35)`;
    c.fillRect(r() * w, r() * h, 1 + r() * 3, 1);
  }
  // Foxing: small rust spots.
  for (let i = 0; i < 26; i++) {
    const x = r() * w, y = r() * h, s = 1 + r() * 4;
    c.fillStyle = `rgba(150,96,46,${.05 + r() * .12})`;
    c.beginPath(); c.arc(x, y, s, 0, 7); c.fill();
  }
  // Edges age first: a soft darker band all round.
  const edge = Math.min(w, h) * .09;
  for (const [x0, y0, x1, y1, fx, fy, fw, fh] of [[0, 0, edge, 0, 0, 0, edge, h], [w, 0, w - edge, 0, w - edge, 0, edge, h], [0, 0, 0, edge, 0, 0, w, edge], [0, h, 0, h - edge, 0, h - edge, w, edge]]) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(120,84,40,.28)'); g.addColorStop(1, 'rgba(120,84,40,0)');
    c.fillStyle = g; c.fillRect(fx, fy, fw, fh);
  }
}
function crease(c, w, h, y) {
  c.fillStyle = 'rgba(255,250,235,.45)'; c.fillRect(0, y, w, 1.5);
  c.fillStyle = 'rgba(90,64,34,.22)'; c.fillRect(0, y + 1.5, w, 1.5);
}
// Typewritten text: each letter strikes with slightly different pressure and height.
function typed(c, text, x, y, size, r, ink = '24,22,30') {
  c.font = `${size}px ${TYPE}`;
  let cx = x;
  for (const ch of text) {
    if (ch === '▰') { c.fillStyle = '#111'; c.fillRect(cx, y - size * .78, size * .62, size * .95); cx += size * .62; continue; }
    c.fillStyle = `rgba(${ink},${(.72 + r() * .28).toFixed(2)})`;
    c.fillText(ch, cx, y + (r() - .5) * size * .06);
    cx += c.measureText(ch).width;
  }
  return cx;
}
function stamp(c, x, y, radius, top, bottom, r, ink = '168,52,40', angle = -.18) {
  c.save(); c.translate(x, y); c.rotate(angle);
  c.strokeStyle = `rgba(${ink},.72)`; c.fillStyle = `rgba(${ink},.72)`;
  c.lineWidth = radius * .07; c.beginPath(); c.arc(0, 0, radius, 0, 7); c.stroke();
  c.lineWidth = radius * .03; c.beginPath(); c.arc(0, 0, radius * .78, 0, 7); c.stroke();
  c.textAlign = 'center'; c.font = `bold ${radius * .3}px ${PRINT}`; c.fillText(top, 0, radius * .1);
  c.font = `${radius * .17}px ${PRINT}`; c.fillText(bottom, 0, radius * .42);
  // Uneven rubber: knock specks out of the ink.
  c.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < radius * 9; i++) { c.fillStyle = `rgba(0,0,0,${.4 + r() * .6})`; c.fillRect((r() - .5) * radius * 2.2, (r() - .5) * radius * 2.2, 1 + r() * 3, 1 + r() * 2); }
  c.restore();
  c.globalCompositeOperation = 'source-over';
}
function signature(c, x, y, w, r) {
  c.strokeStyle = 'rgba(28,34,70,.85)'; c.lineWidth = 2.2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y);
  let px = x;
  for (let i = 0; i < 7; i++) { const nx = px + w / 7; c.bezierCurveTo(px + w * .05, y - 18 - r() * 14, nx - w * .06, y + 12 + r() * 8, nx, y - r() * 6); px = nx; }
  c.stroke();
  c.beginPath(); c.moveTo(x + w * .1, y + 10); c.lineTo(x + w * .95, y + 4); c.stroke();
}
function emblem(c, x, y, s, col) {
  c.strokeStyle = col; c.lineWidth = s * .08;
  c.beginPath(); c.arc(x, y, s, 0, 7); c.stroke();
  c.fillStyle = col; c.fillRect(x - s * .14, y - s * .6, s * .28, s * 1.2); c.fillRect(x - s * .6, y - s * .14, s * 1.2, s * .28);
}

// lines[0] issuer, lines[1] form title, then "Label    value" rows or plain typed lines.
export function paintDocument(c, w, h, r, lines, kind = 'form') {
  const u = w / 1024;
  if (kind === 'clipping') return paintClipping(c, w, h, r, lines);
  if (kind === 'cover') return paintCover(c, w, h, r, lines);
  if (kind === 'tag') return paintTag(c, w, h, r, lines);
  agedPaper(c, w, h, r, kind === 'reverse' ? [214, 199, 165] : kind === 'carbon' ? [221, 214, 200] : [233, 222, 194]);
  if (kind === 'reverse') {
    // Show-through of the printed face, mirrored, and the duplicate stamp.
    c.save(); c.translate(w, 0); c.scale(-1, 1); c.globalAlpha = .1;
    c.fillStyle = '#2b2620'; c.font = `bold ${40 * u}px ${PRINT}`; c.fillText((lines[0] || '').toUpperCase(), 70 * u, 110 * u);
    for (let i = 0; i < 6; i++) c.fillRect(70 * u, (190 + i * 62) * u, (420 + r() * 380) * u, 6 * u);
    c.restore();
    stamp(c, w * .72, h * .62, 92 * u, 'DUPLICATE', 'FOR THE ARCHIVE', r, '58,66,130', .2);
    crease(c, w, h, h * .34);
    return;
  }
  // Punch holes and a fold.
  for (const y of [h * .25, h * .75]) { c.fillStyle = '#2e261d'; c.beginPath(); c.arc(30 * u, y, 13 * u, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,245,220,.5)'; c.lineWidth = 2 * u; c.stroke(); }
  crease(c, w, h, h * .34);
  // Letterhead.
  const ink = '#2b2620', faint = '#6b5d48';
  emblem(c, 92 * u, 72 * u, 30 * u, '#7a3527');
  c.fillStyle = ink; c.textBaseline = 'alphabetic';
  c.font = `bold ${38 * u}px ${PRINT}`; c.fillText(lines[0] || '', 140 * u, 76 * u);
  c.fillStyle = faint; c.font = `italic ${19 * u}px ${SERIF}`; c.fillText('Harbour Road, Pier District  —  Telephone Harbour 0147', 141 * u, 104 * u);
  c.fillStyle = ink; c.fillRect(60 * u, 124 * u, w - 120 * u, 3 * u); c.fillRect(60 * u, 131 * u, w - 120 * u, 1 * u);
  // Form title and reference number.
  c.font = `bold ${30 * u}px ${PRINT}`; c.textAlign = 'center';
  c.fillText((lines[1] || '').toUpperCase().split('').join(' '), w / 2, 184 * u);
  c.textAlign = 'right'; c.fillStyle = faint; c.font = `${18 * u}px ${SERIF}`; c.fillText('Form A-17', w - 64 * u, 162 * u);
  typed(c, 'No. 409', w - 168 * u, 192 * u, 24 * u, r, '120,30,24');
  c.textAlign = 'left';
  // Fields: printed label, rule, typed entry.
  let y = 250 * u;
  for (const raw of lines.slice(2)) {
    const parts = raw.split(/\s{2,}/);
    if (parts.length > 1) {
      c.fillStyle = faint; c.font = `${20 * u}px ${SERIF}`; c.fillText(parts[0], 70 * u, y);
      c.fillStyle = 'rgba(60,48,34,.5)'; c.fillRect(300 * u, y + 8 * u, w - 370 * u, 1.5 * u);
      typed(c, parts.slice(1).join(' '), 312 * u, y, 30 * u, r);
    } else {
      typed(c, raw, 70 * u, y, 26 * u, r);
    }
    y += 60 * u;
  }
  // Signature block.
  const sy = h - 70 * u;
  c.fillStyle = 'rgba(60,48,34,.55)'; c.fillRect(70 * u, sy, 330 * u, 1.5 * u);
  c.fillStyle = faint; c.font = `italic ${17 * u}px ${SERIF}`; c.fillText('Signature of applicant', 70 * u, sy + 26 * u);
  signature(c, 90 * u, sy - 14 * u, 260 * u, r);
  // A coffee ring on some sheets.
  if (r() > .45) { c.strokeStyle = 'rgba(110,70,30,.18)'; c.lineWidth = 9 * u; c.beginPath(); c.arc(w * (.55 + r() * .2), h * (.2 + r() * .2), 70 * u, .3, 5.6); c.stroke(); }
}

function paintClipping(c, w, h, r, lines) {
  agedPaper(c, w, h, r, [214, 208, 190]);
  const u = w / 512;
  c.fillStyle = '#26231e'; c.textAlign = 'center';
  c.font = `${13 * u}px ${SERIF}`; c.fillText('CLASSIFIED  —  SITUATIONS VACANT', w / 2, 22 * u);
  c.fillRect(14 * u, 30 * u, w - 28 * u, 2 * u);
  c.font = `bold ${30 * u}px ${PRINT}`; c.fillText(lines[1] || '', w / 2, 66 * u, w - 30 * u);
  c.font = `italic ${15 * u}px ${SERIF}`; c.fillText(lines[0] || '', w / 2, 88 * u, w - 30 * u);
  c.textAlign = 'left'; c.font = `bold ${17 * u}px ${SERIF}`;
  let y = 116 * u;
  for (const l of lines.slice(2)) { c.fillText(l, 18 * u, y, w - 36 * u); y += 24 * u; }
  // Column grey: the rest of the page.
  c.fillStyle = 'rgba(38,35,30,.42)';
  for (; y < h - 14 * u; y += 9 * u) c.fillRect(18 * u, y, (w - 36 * u) * (.7 + r() * .3), 3 * u);
  // Torn edges.
  c.globalCompositeOperation = 'destination-out';
  for (let x = 0; x < w; x += 4) { c.fillRect(x, 0, 4, r() * 5 * u); c.fillRect(x, h - r() * 5 * u, 4, 6 * u); }
  c.globalCompositeOperation = 'source-over';
}
function paintCover(c, w, h, r, lines) {
  c.fillStyle = '#5a2e24'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < w * h / 30; i++) { c.fillStyle = r() > .5 ? 'rgba(0,0,0,.12)' : 'rgba(255,220,180,.06)'; c.fillRect(r() * w, r() * h, 2, 2); }
  const u = w / 512;
  c.strokeStyle = '#c9a25c'; c.lineWidth = 3 * u; c.strokeRect(22 * u, 22 * u, w - 44 * u, h - 44 * u);
  c.lineWidth = 1 * u; c.strokeRect(30 * u, 30 * u, w - 60 * u, h - 60 * u);
  c.fillStyle = '#d8b46a'; c.textAlign = 'center';
  c.font = `bold ${44 * u}px ${PRINT}`; c.fillText(lines[1] || '', w / 2, h * .45, w - 80 * u);
  c.font = `italic ${22 * u}px ${SERIF}`; c.fillText(lines[0] || '', w / 2, h * .45 + 40 * u, w - 80 * u);
  emblem(c, w / 2, h * .72, 22 * u, '#d8b46a');
}
function paintTag(c, w, h, r, lines) {
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#c9a874';
  c.beginPath(); c.moveTo(w * .18, 4); c.lineTo(w - 4, 4); c.lineTo(w - 4, h - 4); c.lineTo(w * .18, h - 4); c.lineTo(4, h * .72); c.lineTo(4, h * .28); c.closePath(); c.fill();
  for (let i = 0; i < w * h / 25; i++) { c.fillStyle = r() > .5 ? 'rgba(90,60,30,.15)' : 'rgba(255,240,210,.15)'; c.fillRect(r() * w, r() * h, 2, 1); }
  c.fillStyle = '#7a6040'; c.beginPath(); c.arc(w * .14, h / 2, h * .1, 0, 7); c.fill();
  c.fillStyle = '#26221d'; c.textAlign = 'center';
  c.font = `${h * .16}px ${PRINT}`; c.fillText(lines[0] || '', w * .6, h * .32);
  typed(c, lines[1] || '', w * .42, h * .74, h * .42, r);
}

// Signs and plates fixed to furniture and doors.
export function paintPlaque(c, w, h, r, lines, kind = 'enamel') {
  const u = h / 180;
  if (kind === 'brass') {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d9b46c'); g.addColorStop(.5, '#a87d3c'); g.addColorStop(1, '#7c5a2a');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 2) { c.fillStyle = `rgba(255,240,200,${r() * .08})`; c.fillRect(i, 0, 1, h); }
    c.strokeStyle = '#5b3f1c'; c.lineWidth = 6 * u; c.strokeRect(8 * u, 8 * u, w - 16 * u, h - 16 * u);
    for (const [x, y] of [[22, 22], [w / u - 22, 22], [22, 158], [w / u - 22, 158]]) { c.fillStyle = '#6b4c22'; c.beginPath(); c.arc(x * u, y * u, 7 * u, 0, 7); c.fill(); }
    c.fillStyle = '#3a2810'; c.textAlign = 'center';
    c.font = `${26 * u}px ${PRINT}`; c.fillText(lines[0] || '', w / 2, 70 * u, w - 70 * u);
    c.font = `bold ${46 * u}px ${PRINT}`; c.fillText(lines[1] || '', w / 2, 132 * u, w - 70 * u);
    return;
  }
  if (kind === 'stencil') {
    c.fillStyle = '#7d8a7a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < w * h / 30; i++) { c.fillStyle = r() > .5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.05)'; c.fillRect(r() * w, r() * h, 2, 2); }
    c.fillStyle = 'rgba(236,230,214,.88)'; c.textAlign = 'center';
    c.font = `bold ${34 * u}px ${PRINT}`; c.fillText((lines[0] || '').toUpperCase(), w / 2, 64 * u, w - 40 * u);
    c.font = `bold ${52 * u}px ${PRINT}`; c.fillText((lines[1] || '').toUpperCase(), w / 2, 136 * u, w - 40 * u);
    // Stencil bridges.
    c.fillStyle = '#7d8a7a';
    for (let x = 30 * u; x < w; x += 46 * u) c.fillRect(x, 20 * u, 3 * u, 140 * u);
    return;
  }
  if (kind === 'card') {
    c.fillStyle = '#e3d7b8'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < w * h / 25; i++) { c.fillStyle = 'rgba(120,90,50,.1)'; c.fillRect(r() * w, r() * h, 2, 1); }
    c.fillStyle = '#2b2620'; c.textAlign = 'left';
    c.font = `${22 * u}px ${SERIF}`; c.fillText(lines[0] || '', 24 * u, 58 * u, w - 48 * u);
    typed(c, lines[1] || '', 24 * u, 128 * u, 48 * u, r);
    return;
  }
  // Enamel: deep green with a cream border and lettering, chipped at the corners.
  c.fillStyle = '#e8e0c8'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#244a40'; c.fillRect(10 * u, 10 * u, w - 20 * u, h - 20 * u);
  c.strokeStyle = '#e8e0c8'; c.lineWidth = 4 * u; c.strokeRect(22 * u, 22 * u, w - 44 * u, h - 44 * u);
  c.fillStyle = '#efe6cc'; c.textAlign = 'center';
  c.font = `${24 * u}px ${PRINT}`; c.fillText((lines[0] || '').toUpperCase(), w / 2, 72 * u, w - 80 * u);
  c.font = `bold ${44 * u}px ${PRINT}`; c.fillText((lines[1] || '').toUpperCase(), w / 2, 130 * u, w - 80 * u);
  for (let i = 0; i < 6; i++) { c.fillStyle = '#2a2520'; const x = r() > .5 ? r() * 30 * u : w - r() * 30 * u, y = r() > .5 ? r() * 30 * u : h - r() * 30 * u; c.beginPath(); c.arc(x, y, (2 + r() * 6) * u, 0, 7); c.fill(); }
}
