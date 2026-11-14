const INK = '#30231a';
const DEEP_INK = '#211a16';
const FADED = '#806344';
const PAPER = '#d3ac70';
const LIGHT = '#f0d5a0';
const RED = '#8b392c';

function path(ctx, points, close = false) {
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  if (close) ctx.closePath();
}

function strokePath(ctx, points, color = INK, width = 1.5, close = false) {
  path(ctx, points, close);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function fillPath(ctx, points, color, close = true) {
  path(ctx, points, close);
  ctx.fillStyle = color;
  ctx.fill();
}

function paperSheet(ctx, x, y, w, h, angle, shade = LIGHT) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const points = [[-w * .48, -h * .47], [w * .45, -h * .5], [w * .5, -h * .42], [w * .48, h * .43], [w * .4, h * .5], [-w * .47, h * .46], [-w * .5, h * .34]];
  ctx.shadowColor = 'rgba(42, 26, 13, .42)';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;
  fillPath(ctx, points, shade);
  ctx.shadowColor = 'transparent';
  strokePath(ctx, points, '#684c2f', 1.35, true);
  strokePath(ctx, [[-w * .42, -h * .37], [w * .39, -h * .39], [w * .42, h * .39], [-w * .4, h * .36]], '#a58251', .65, true);
  ctx.restore();
}

function hatch(ctx, x, y, count, spacing, length, angle = -0.65, color = FADED) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = .6;
  for (let i = 0; i < count; i++) {
    const yy = y + i * spacing;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + Math.cos(angle) * length, yy + Math.sin(angle) * length);
    ctx.stroke();
  }
  ctx.restore();
}

function inkLines(ctx, x, y, count, step, maxWidth) {
  for (let i = 0; i < count; i++) {
    const width = maxWidth * (0.78 + ((i * 17) % 13) / 32);
    strokePath(ctx, [[x, y + i * step], [x + width * .52, y + i * step - .5], [x + width, y + i * step + .25]], '#59412e', .85);
  }
}

function drawVisa(ctx) {
  // A small folded slip and visa paper overlap to make a compact evidence stack.
  paperSheet(ctx, 178, 116, 187, 140, -.12, '#bf9358');
  ctx.save();
  ctx.translate(183, 108);
  ctx.rotate(-.12);
  fillPath(ctx, [[-84, -53], [83, -58], [80, 51], [-81, 55]], '#e5c48c');
  strokePath(ctx, [[-84, -53], [83, -58], [80, 51], [-81, 55]], INK, 1.5, true);
  ctx.font = 'bold 9px Georgia, serif';
  ctx.fillStyle = INK;
  ctx.fillText('MEDICAL ENTRY  /  A17', -69, -37);
  strokePath(ctx, [[-70, -31], [67, -33]], '#78593a', .8);
  inkLines(ctx, -67, -19, 4, 10, 75);

  // Passport ID silhouette, kept abstract and respectful.
  ctx.fillStyle = '#9a744b';
  ctx.fillRect(-66, 25, 34, 23);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.strokeRect(-66, 25, 34, 23);
  ctx.beginPath(); ctx.ellipse(-49, 33, 5, 5.5, 0, 0, Math.PI * 2); ctx.fillStyle = '#e1c18d'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-49, 46, 9, 5, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.font = '7px Georgia, serif'; ctx.fillStyle = INK; ctx.fillText('M. VALE', -25, 34); ctx.fillText('CLINIC', -25, 44);

  // Postal marks and hand-etched circular stamp.
  ctx.save(); ctx.translate(52, -2); ctx.rotate(.2);
  ctx.strokeStyle = RED; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke();
  ctx.font = 'bold 7px Georgia, serif'; ctx.fillStyle = RED; ctx.textAlign = 'center'; ctx.fillText('ENTRY', 0, -2); ctx.fillText('A17', 0, 7);
  for (let i = 0; i < 4; i++) strokePath(ctx, [[-23, 29 + i * 3], [-5, 25 + i * 3]], RED, .8);
  ctx.restore();
  hatch(ctx, -68, 55, 4, 3, 15, -.2, '#9b774b');
  ctx.restore();
  // Corner folds and a shallow handwritten clue on the exposed lower slip.
  strokePath(ctx, [[119, 175], [141, 172], [144, 194]], '#725132', 1);
  ctx.font = 'italic 9px Georgia, serif'; ctx.fillStyle = '#493326'; ctx.fillText('keep this copy', 154, 186);
}

function drawPhone(ctx) {
  // Oversized compact handset, with hand-worn edges and clear etched controls.
  ctx.save();
  ctx.translate(181, 113);
  ctx.rotate(-.16);
  const body = [[-47, -89], [39, -88], [48, -78], [46, 79], [37, 89], [-42, 87], [-49, 78], [-50, -78]];
  ctx.shadowColor = 'rgba(26, 16, 10, .48)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 5;
  fillPath(ctx, body, '#262321');
  ctx.shadowColor = 'transparent';
  strokePath(ctx, body, '#171614', 2, true);
  strokePath(ctx, [[-43, -81], [37, -80], [40, 75], [-41, 78], [-43, -81]], '#6c5a43', 1, true);
  // Screen has a warm glass sheen and etched message strokes.
  fillPath(ctx, [[-36, -65], [34, -65], [35, -20], [-35, -19]], '#b39d70');
  strokePath(ctx, [[-36, -65], [34, -65], [35, -20], [-35, -19]], '#b79e6c', 1.2, true);
  strokePath(ctx, [[-29, -55], [15, -55], [25, -53]], '#eee0ba', 1.1);
  strokePath(ctx, [[-29, -47], [26, -47]], '#e8d5a8', 1.1);
  strokePath(ctx, [[-29, -39], [7, -39]], '#e8d5a8', 1.1);
  ctx.font = 'bold 6px Georgia, serif'; ctx.fillStyle = '#33271c'; ctx.fillText('CALLBACK 04', -29, -27);
  // Speaker slit and old tactile keypad.
  strokePath(ctx, [[-10, -75], [11, -75]], '#8a7759', 2);
  const labels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  labels.forEach((label, index) => {
    const col = index % 3, row = Math.floor(index / 3);
    const x = -22 + col * 22, y = -4 + row * 19;
    ctx.beginPath(); ctx.ellipse(x, y, 7, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#5a5143'; ctx.fill(); ctx.strokeStyle = '#b59a68'; ctx.lineWidth = .7; ctx.stroke();
    ctx.font = '6px Georgia, serif'; ctx.fillStyle = '#e0c790'; ctx.textAlign = 'center'; ctx.fillText(label, x, y + 2);
  });
  ctx.beginPath(); ctx.ellipse(0, 70, 11, 5, 0, 0, Math.PI * 2); ctx.strokeStyle = '#a98d5e'; ctx.stroke();
  hatch(ctx, -43, -13, 5, 3, 7, .8, '#75644a');
  ctx.restore();
  // Small surrounding desk notes anchor the phone in the evidence tray.
  paperSheet(ctx, 77, 106, 92, 70, .13, '#ddbd84');
  ctx.font = 'bold 8px Georgia, serif'; ctx.fillStyle = INK; ctx.fillText('M. VALE', 48, 105);
  inkLines(ctx, 48, 116, 3, 7, 49);
  ctx.save(); ctx.translate(274, 167); ctx.rotate(-.12);
  strokePath(ctx, [[-36, -13], [34, -13], [33, 15], [-35, 16]], RED, 1.2, true);
  ctx.font = 'bold 8px Georgia, serif'; ctx.fillStyle = RED; ctx.fillText('04 / HOLD', -28, 3);
  ctx.restore();
}

function drawManifest(ctx) {
  // Board, clipped clinic sheet, and the visible redacted consent area.
  paperSheet(ctx, 178, 120, 214, 158, -.07, '#a47a4b');
  ctx.save(); ctx.translate(183, 111); ctx.rotate(-.07);
  fillPath(ctx, [[-88, -58], [88, -60], [85, 57], [-86, 59]], '#e3c48d');
  strokePath(ctx, [[-88, -58], [88, -60], [85, 57], [-86, 59]], INK, 1.5, true);
  // Clip plate and pin.
  fillPath(ctx, [[-31, -69], [31, -69], [29, -50], [-29, -49]], '#55483a');
  strokePath(ctx, [[-31, -69], [31, -69], [29, -50], [-29, -49]], '#211e1a', 1.2, true);
  ctx.beginPath(); ctx.arc(0, -59, 3.2, 0, Math.PI * 2); ctx.fillStyle = '#bd9b64'; ctx.fill(); ctx.strokeStyle = INK; ctx.stroke();
  ctx.font = 'bold 9px Georgia, serif'; ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.fillText('CLINIC / MANIFEST', -70, -38);
  strokePath(ctx, [[-70, -32], [69, -34]], '#78593a', .8);
  inkLines(ctx, -67, -21, 3, 9, 125);
  ctx.font = '8px Georgia, serif'; ctx.fillStyle = INK; ctx.fillText('M. VALE   /   A17', -67, 13);
  strokePath(ctx, [[-70, 19], [68, 18]], '#9a744b', .7);
  ctx.fillText('CONSENT:', -67, 33);
  strokePath(ctx, [[-25, 35], [65, 34]], '#7f6648', .8);
  // Redaction as rough repeated strokes rather than a clean digital rectangle.
  for (let i = 0; i < 4; i++) strokePath(ctx, [[-65, 42 + i * 3], [8 + (i % 2) * 4, 41 + i * 3]], DEEP_INK, 2.5);
  ctx.fillStyle = '#f2d8a7'; ctx.font = 'italic 7px Georgia, serif'; ctx.fillText('signature field blank', 12, 47);
  // Muted red ink seal, crosshatched like a pressed stamp.
  ctx.save(); ctx.translate(48, -6); ctx.rotate(.13);
  ctx.strokeStyle = RED; ctx.lineWidth = 1.35;
  ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
  ctx.font = 'bold 6px Georgia, serif'; ctx.fillStyle = RED; ctx.textAlign = 'center'; ctx.fillText('REVIEW', 0, -1); ctx.fillText('RECORD', 0, 6);
  hatch(ctx, -11, 21, 5, 3, 15, -.4, RED);
  ctx.restore();
  ctx.restore();
  ctx.font = 'italic 9px Georgia, serif'; ctx.fillStyle = '#493326'; ctx.fillText('donor allocation?', 117, 190);
  strokePath(ctx, [[113, 194], [203, 190]], '#755638', .7);
}

function drawPaper(ctx, key) {
  // Aged contact sheet with gentle vignette and fine printed fibers.
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, 360, 220);
  const vignette = ctx.createRadialGradient(180, 105, 45, 180, 110, 245);
  vignette.addColorStop(0, 'rgba(255, 230, 173, .22)');
  vignette.addColorStop(.68, 'rgba(116, 72, 34, .08)');
  vignette.addColorStop(1, 'rgba(63, 39, 25, .55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 360, 220);
  // Deterministic grain keeps redraws stable and avoids external image assets.
  let seed = key.length * 811 + key.charCodeAt(0) * 71;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 700; i++) {
    const x = random() * 360, y = random() * 220;
    ctx.fillStyle = random() > .5 ? 'rgba(72, 46, 25, .13)' : 'rgba(255, 232, 186, .2)';
    ctx.fillRect(x, y, .5 + random() * 1.2, .45);
  }
  for (let i = 0; i < 26; i++) {
    const x = 20 + random() * 320, y = 14 + random() * 192, w = 3 + random() * 18;
    strokePath(ctx, [[x, y], [x + w, y + (random() - .5) * 1.5]], 'rgba(83, 53, 30, .18)', .45);
  }
  // Hand-ruled border with slightly uneven doubled edges.
  strokePath(ctx, [[13, 15], [347, 13], [346, 206], [14, 204], [13, 15]], '#573d27', 1.35);
  strokePath(ctx, [[17, 19], [343, 18], [342, 201], [18, 200], [17, 19]], 'rgba(82, 57, 37, .58)', .55);
}

/** Draws a hand-inked landscape evidence thumbnail directly into a canvas. */
export function drawThumbnail(canvas, key) {
  if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('drawThumbnail requires a canvas element.');
  if (!['visa', 'phone', 'manifest'].includes(key)) throw new RangeError(`Unknown evidence thumbnail: ${key}`);
  if (!canvas.width) canvas.width = 360;
  if (!canvas.height) canvas.height = 220;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('A 2D canvas context is unavailable.');
  ctx.save();
  ctx.setTransform(canvas.width / 360, 0, 0, canvas.height / 220, 0, 0);
  ctx.clearRect(0, 0, 360, 220);
  drawPaper(ctx, key);
  if (key === 'visa') drawVisa(ctx);
  else if (key === 'phone') drawPhone(ctx);
  else drawManifest(ctx);
  ctx.restore();
  return canvas;
}
