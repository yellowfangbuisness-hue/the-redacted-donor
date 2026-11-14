import * as THREE from 'three';

// Patrolling guards with floor sight cones, plus throwable distractions.
// Units are metres, Y is up. Footprints are axis-aligned [minX, maxX, minZ, maxZ].
// Heading convention: a heading h faces the (x, z) direction (sin h, cos h).

const WALK_SPEED = .95;
// Chase: once a guard sees the player he leaves his route and closes in; he gives up after losing sight.
const CHASE_SPEED = 1.7, LOSE_TIME = 1.5, CATCH_DIST = .8;
const VETERAN_SPEED = .7;
const PAUSE_TIME = 1.2;
const PAUSE_SWEEP = .6;
const TURN_RATE = 3.6;
const HALF_ANGLE = .6;
const RANGE_DAY = 4.0;
const RANGE_NIGHT = 3.5;
const SOLES_FACTOR = .8;
const NEAR_DIST = 7;
const FILL_TIME = 2.5;
const GRACE_TIME = 2.5;
const DECAY = .6;
const DISTRACT_RADIUS = 9;
const STOP_SHORT = .6;
const GUARD_RADIUS = .22;
const GUARD_W = 1.0;
const GUARD_H = 2.05;
const CONE_COLOR = '#efbc71';
const CONE_ALERT = '#ea8a55';
const CONE_OPACITY = .2;
const GRAVITY = 9.8;
const BOUNDS = { minX: -4.4, maxX: 4.4, minZ: -2.9, maxZ: 14.5 };
const ARC_DOTS = 24;
const SHARD_POOL = 24;
const SHARDS_PER_CRASH = 8;
const SHARD_LIFE = .65;

const TAU = Math.PI * 2;
const wrap = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// 2D segment vs axis-aligned rectangle list. Rectangles containing either endpoint are skipped.
function segmentBlocked(ax, az, bx, bz, rects, pad = 0) {
  const dx = bx - ax, dz = bz - az;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    const minX = r[0] - pad, maxX = r[1] + pad, minZ = r[2] - pad, maxZ = r[3] + pad;
    if ((ax > minX && ax < maxX && az > minZ && az < maxZ) || (bx > minX && bx < maxX && bz > minZ && bz < maxZ)) continue;
    let lo = 0, hi = 1;
    if (Math.abs(dx) < 1e-9) { if (ax <= minX || ax >= maxX) continue; }
    else {
      let t1 = (minX - ax) / dx, t2 = (maxX - ax) / dx;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > lo) lo = t1; if (t2 < hi) hi = t2; if (lo >= hi) continue;
    }
    if (Math.abs(dz) < 1e-9) { if (az <= minZ || az >= maxZ) continue; }
    else {
      let t1 = (minZ - az) / dz, t2 = (maxZ - az) / dz;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > lo) lo = t1; if (t2 < hi) hi = t2; if (lo >= hi) continue;
    }
    return true;
  }
  return false;
}

function pointBlocked(x, z, rects, pad) {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x > r[0] - pad && x < r[1] + pad && z > r[2] - pad && z < r[3] + pad) return true;
  }
  return false;
}

export function createStealth({ scene, guardTexture, footprints = [], tallFootprints = [], routes = {}, throwables = [], onCrash } = {}) {
  const root = new THREE.Group();
  root.name = 'stealth';
  scene.add(root);

  const geometries = [];
  const materials = [];
  const own = (list, item) => { list.push(item); return item; };

  // ---------- Guards ----------
  const guardGeo = own(geometries, new THREE.PlaneGeometry(GUARD_W, GUARD_H));
  guardGeo.translate(0, GUARD_H / 2, 0);
  const guardMat = own(materials, new THREE.MeshBasicMaterial({ map: guardTexture || null, transparent: true, alphaTest: .05, side: THREE.DoubleSide }));

  const coneShape = new THREE.Shape();
  coneShape.moveTo(0, 0);
  for (let i = 0; i <= 24; i++) {
    const a = -HALF_ANGLE + 2 * HALF_ANGLE * i / 24;
    coneShape.lineTo(Math.cos(a), Math.sin(a));
  }
  coneShape.closePath();
  const coneGeo = own(geometries, new THREE.ShapeGeometry(coneShape));

  const guards = [];
  for (const key of Object.keys(routes)) {
    const route = routes[key];
    if (!Array.isArray(route) || route.length < 2) continue;
    const sprite = new THREE.Mesh(guardGeo, guardMat);
    sprite.renderOrder = 2;
    const coneMat = own(materials, new THREE.MeshBasicMaterial({ color: CONE_COLOR, transparent: true, opacity: CONE_OPACITY, depthWrite: false, side: THREE.DoubleSide }));
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.rotation.order = 'YXZ';
    cone.rotation.x = -Math.PI / 2;
    cone.renderOrder = 1;
    sprite.visible = cone.visible = false;
    root.add(sprite, cone);
    const [x0, z0] = route[0], [x1, z1] = route[1];
    guards.push({
      key, route, sprite, cone, coneMat,
      x: x0, z: z0, heading: Math.atan2(x1 - x0, z1 - z0),
      wp: 1, mode: 'walk', timer: 0, base: 0,
      tx: x1, tz: z1, lookX: 0, lookZ: 0, searchFor: 0, stuck: 0, ghost: false, dir: 1, pauseFor: PAUSE_TIME,
      phase: Math.random() * TAU, moving: false, active: false, sees: false,
    });
  }

  // ---------- Throwables ----------
  const brassGeo = own(geometries, new THREE.SphereGeometry(.07, 18, 8, 0, TAU, 0, Math.PI / 2));
  const brassMat = own(materials, new THREE.MeshLambertMaterial({ color: '#b48a4e' }));
  const brassBaseGeo = own(geometries, new THREE.CircleGeometry(.07, 18));
  brassBaseGeo.rotateX(Math.PI / 2);
  const glassGeo = own(geometries, new THREE.CylinderGeometry(.038, .036, .11, 16, 1, true));
  glassGeo.translate(0, .055, 0);
  const glassMat = own(materials, new THREE.MeshBasicMaterial({ color: '#b9d2cf', transparent: true, opacity: .45, depthWrite: false, side: THREE.DoubleSide }));
  const glassBaseGeo = own(geometries, new THREE.CircleGeometry(.036, 16));
  glassBaseGeo.rotateX(-Math.PI / 2);
  glassBaseGeo.translate(0, .002, 0);
  const rimGeo = own(geometries, new THREE.TorusGeometry(.038, .0035, 6, 22));
  rimGeo.rotateX(Math.PI / 2);
  rimGeo.translate(0, .11, 0);
  const rimMat = own(materials, new THREE.MeshBasicMaterial({ color: '#eef7f4', transparent: true, opacity: .85 }));

  const items = [];
  for (const t of throwables) {
    const g = new THREE.Group();
    if (t.kind === 'beaker') {
      g.add(new THREE.Mesh(glassGeo, glassMat), new THREE.Mesh(glassBaseGeo, glassMat), new THREE.Mesh(rimGeo, rimMat));
    } else {
      const dome = new THREE.Mesh(brassGeo, brassMat);
      dome.scale.y = .75;
      g.add(dome, new THREE.Mesh(brassBaseGeo, brassMat));
    }
    const [x, y, z] = t.pos || [0, 0, 0];
    g.position.set(x, y, z);
    root.add(g);
    items.push({ id: t.id, kind: t.kind === 'beaker' ? 'beaker' : 'paperweight', mesh: g, state: 'world', p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(), centre: t.kind === 'beaker' ? .055 : .03 });
  }
  let heldItem = null;

  // ---------- Aim dots ----------
  const dotGeo = own(geometries, new THREE.SphereGeometry(.014, 6, 4));
  const dotMat = own(materials, new THREE.MeshBasicMaterial({ color: '#f6e2b6', transparent: true, opacity: .85, depthWrite: false }));
  const dots = new THREE.InstancedMesh(dotGeo, dotMat, ARC_DOTS);
  dots.frustumCulled = false;
  dots.visible = false;
  dots.renderOrder = 3;
  root.add(dots);

  // ---------- Shards ----------
  const shardGeo = own(geometries, new THREE.TetrahedronGeometry(.016));
  const shardMat = own(materials, new THREE.MeshBasicMaterial({ color: '#d4e8e4', transparent: true, opacity: .8, depthWrite: false }));
  const shards = new THREE.InstancedMesh(shardGeo, shardMat, SHARD_POOL);
  shards.frustumCulled = false;
  shards.visible = false;
  root.add(shards);
  const shardP = new Float32Array(SHARD_POOL * 3), shardV = new Float32Array(SHARD_POOL * 3), shardLife = new Float32Array(SHARD_POOL);
  let shardNext = 0;

  // ---------- Scratch objects (no per-frame allocation) ----------
  const dummy = new THREE.Object3D();
  const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vFwd = new THREE.Vector3();
  const coneCalm = new THREE.Color(CONE_COLOR), coneAlert = new THREE.Color(CONE_ALERT);
  const arcStart = new THREE.Vector3(), arcVel = new THREE.Vector3(), camPos = new THREE.Vector3();
  for (let i = 0; i < SHARD_POOL; i++) shards.setMatrixAt(i, zeroMatrix);

  let meter = 0, graceT = 0, promoted = false;
  let veteranNow = false;
  const result = { level: 'clear', amount: 0, nearestDist: Infinity };

  // ---------- Guard movement ----------
  function turnToward(g, desired, maxStep) {
    const d = wrap(desired - g.heading);
    g.heading = wrap(g.heading + clamp(d, -maxStep, maxStep));
    return d;
  }

  // Walk toward (tx, tz). Returns true on arrival.
  function walkTo(g, dt, speed, collide) {
    const dx = g.tx - g.x, dz = g.tz - g.z, dist = Math.hypot(dx, dz);
    if (dist < .03) { g.moving = false; return true; }
    const diff = turnToward(g, Math.atan2(dx, dz), TURN_RATE * dt);
    const step = speed * dt * Math.max(.25, Math.cos(diff));
    if (step >= dist) {
      if (!collide || !pointBlocked(g.tx, g.tz, footprints, GUARD_RADIUS)) { g.x = g.tx; g.z = g.tz; g.moving = true; return true; }
    }
    const sx = dx / dist * step, sz = dz / dist * step;
    let nx = g.x + sx, nz = g.z + sz;
    if (collide && pointBlocked(nx, nz, footprints, GUARD_RADIUS)) {
      // Slide along whichever axis is free.
      if (!pointBlocked(g.x + sx, g.z, footprints, GUARD_RADIUS)) { nx = g.x + sx; nz = g.z; }
      else if (!pointBlocked(g.x, g.z + sz, footprints, GUARD_RADIUS)) { nx = g.x; nz = g.z + sz; }
      else { nx = g.x; nz = g.z; }
    }
    const moved = Math.hypot(nx - g.x, nz - g.z);
    g.stuck = moved < step * .3 ? g.stuck + dt : Math.max(0, g.stuck - dt);
    g.x = nx; g.z = nz;
    g.moving = moved > 1e-4;
    return false;
  }

  function nearestWaypoint(g) {
    let best = 0, bestD = Infinity, bestClear = -1, bestClearD = Infinity;
    for (let i = 0; i < g.route.length; i++) {
      const [x, z] = g.route[i];
      const d = Math.hypot(x - g.x, z - g.z);
      if (d < bestD) { bestD = d; best = i; }
      if (d < bestClearD && !segmentBlocked(g.x, g.z, x, z, footprints, GUARD_RADIUS * .8)) { bestClearD = d; bestClear = i; }
    }
    return bestClear >= 0 ? bestClear : best;
  }

  function startReturn(g) {
    g.wp = nearestWaypoint(g);
    g.tx = g.route[g.wp][0]; g.tz = g.route[g.wp][1];
    g.mode = 'return'; g.stuck = 0; g.ghost = false;
  }

  function stepGuard(g, dt, speed) {
    g.moving = false;
    switch (g.mode) {
      case 'walk':
        if (walkTo(g, dt, speed, false)) { g.mode = 'pause'; g.timer = 0; g.base = g.heading; }
        break;
      case 'pause':
        g.timer += dt;
        g.heading = wrap(g.base + PAUSE_SWEEP * Math.sin(g.timer / PAUSE_TIME * TAU));
        if (g.timer >= g.pauseFor) {
          g.heading = g.base;
          // Patrols are not clockwork: he may linger, or turn and double back (Veteran mode keeps him regular).
          if (!veteranNow) { g.pauseFor = PAUSE_TIME * (.5 + Math.random() * 1.6); if (Math.random() < .28) g.dir = -g.dir; }
          g.wp = (g.wp + g.dir + g.route.length) % g.route.length;
          g.tx = g.route[g.wp][0]; g.tz = g.route[g.wp][1];
          g.mode = 'walk';
        }
        break;
      case 'toPoint':
        if (walkTo(g, dt, speed, true) || g.stuck > 1.2) {
          g.mode = 'search'; g.timer = 0; g.stuck = 0;
          const dx = g.lookX - g.x, dz = g.lookZ - g.z;
          g.base = Math.hypot(dx, dz) > .05 ? Math.atan2(dx, dz) : g.heading;
        }
        break;
      case 'search': {
        g.timer += dt;
        const sweep = Math.sin(g.timer * 1.7) * 1.25 + Math.sin(g.timer * .53) * .35;
        turnToward(g, g.base + sweep, TURN_RATE * 1.2 * dt);
        if (g.timer >= g.searchFor) startReturn(g);
        break;
      }
      case 'chase':
        g.tx = g.lastX; g.tz = g.lastZ;
        g.lostT += dt; // reset each frame he still sees the player
        walkTo(g, dt, speed * CHASE_SPEED, true);
        if (g.lostT > LOSE_TIME || g.stuck > 1.5) { g.mode = 'search'; g.timer = 0; g.searchFor = 4; g.base = g.heading; g.stuck = 0; }
        break;
      case 'return':
        if (walkTo(g, dt, speed, !g.ghost)) { g.mode = 'pause'; g.timer = 0; g.base = g.heading; g.ghost = false; }
        else if (g.stuck > 1.5) { g.ghost = true; g.stuck = 0; }
        break;
    }
  }

  function placeGuard(g, dt, camera, range, jammed) {
    if (g.moving) g.phase += dt * 7.5;
    const bob = g.moving ? Math.abs(Math.sin(g.phase)) * .035 : 0;
    g.sprite.position.set(g.x, bob, g.z);
    if (camera) {
      camera.getWorldPosition(camPos);
      g.sprite.rotation.set(0, Math.atan2(camPos.x - g.x, camPos.z - g.z), g.moving ? Math.sin(g.phase) * .018 : 0);
    }
    g.cone.position.set(g.x, .018, g.z);
    g.cone.rotation.y = g.heading - Math.PI / 2;
    g.cone.scale.set(range, range, 1);
    g.coneMat.opacity = jammed ? CONE_OPACITY * (.25 + .2 * Math.random()) : g.sees ? CONE_OPACITY * 1.45 : CONE_OPACITY;
    g.coneMat.color.copy(g.sees ? coneAlert : coneCalm);
  }

  function canSee(g, px, pz, range, crouched) {
    const dx = px - g.x, dz = pz - g.z, d = Math.hypot(dx, dz);
    if (d > range) return false;
    if (d > .15 && Math.abs(wrap(Math.atan2(dx, dz) - g.heading)) > HALF_ANGLE) return false;
    if (segmentBlocked(g.x, g.z, px, pz, tallFootprints)) return false;
    if (crouched && segmentBlocked(g.x, g.z, px, pz, footprints)) return false;
    return true;
  }

  // ---------- Throw physics ----------
  function computeArc(camera, power) {
    power = clamp(power || 0, 0, 1);
    camera.getWorldPosition(camPos);
    camera.getWorldDirection(vFwd);
    arcStart.copy(camPos).addScaledVector(vFwd, .35);
    arcVel.copy(vFwd).multiplyScalar(4 + 6 * power);
    arcVel.y += 1.2 + 1.5 * power;
    const y0 = Math.max(0, arcStart.y), vy = arcVel.y;
    let T = (vy + Math.sqrt(vy * vy + 2 * GRAVITY * y0)) / GRAVITY;
    if (arcVel.x > 1e-6) T = Math.min(T, (BOUNDS.maxX - arcStart.x) / arcVel.x);
    else if (arcVel.x < -1e-6) T = Math.min(T, (BOUNDS.minX - arcStart.x) / arcVel.x);
    if (arcVel.z > 1e-6) T = Math.min(T, (BOUNDS.maxZ - arcStart.z) / arcVel.z);
    else if (arcVel.z < -1e-6) T = Math.min(T, (BOUNDS.minZ - arcStart.z) / arcVel.z);
    return Math.max(T, .02);
  }

  function arcPoint(t, out) {
    return out.set(arcStart.x + arcVel.x * t, arcStart.y + arcVel.y * t - .5 * GRAVITY * t * t, arcStart.z + arcVel.z * t);
  }

  function spawnShards(p) {
    for (let k = 0; k < SHARDS_PER_CRASH; k++) {
      const i = shardNext; shardNext = (shardNext + 1) % SHARD_POOL;
      const a = Math.random() * TAU, s = .6 + Math.random() * 1.4;
      shardP[i * 3] = p.x; shardP[i * 3 + 1] = .03; shardP[i * 3 + 2] = p.z;
      shardV[i * 3] = Math.cos(a) * s; shardV[i * 3 + 1] = 1 + Math.random() * 1.6; shardV[i * 3 + 2] = Math.sin(a) * s;
      shardLife[i] = SHARD_LIFE * (.7 + Math.random() * .3);
    }
    shards.visible = true;
  }

  function stepShards(dt) {
    if (!shards.visible) return;
    let alive = 0;
    for (let i = 0; i < SHARD_POOL; i++) {
      if (shardLife[i] <= 0) { shards.setMatrixAt(i, zeroMatrix); continue; }
      shardLife[i] -= dt;
      if (shardLife[i] <= 0) { shards.setMatrixAt(i, zeroMatrix); continue; }
      alive++;
      const j = i * 3;
      shardV[j + 1] -= GRAVITY * dt;
      shardP[j] += shardV[j] * dt; shardP[j + 1] += shardV[j + 1] * dt; shardP[j + 2] += shardV[j + 2] * dt;
      if (shardP[j + 1] < .005) { shardP[j + 1] = .005; shardV[j + 1] *= -.25; shardV[j] *= .6; shardV[j + 2] *= .6; }
      const s = clamp(shardLife[i] / SHARD_LIFE * 1.6, 0, 1);
      dummy.position.set(shardP[j], shardP[j + 1], shardP[j + 2]);
      dummy.rotation.set(shardLife[i] * 17 + i, shardLife[i] * 11, i);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      shards.setMatrixAt(i, dummy.matrix);
    }
    shards.instanceMatrix.needsUpdate = true;
    if (!alive) shards.visible = false;
  }

  function land(it, x, z) {
    it.p.set(x, 0, z);
    it.v.set(0, 0, 0);
    const point = new THREE.Vector3(x, 0, z);
    if (it.kind === 'beaker') {
      it.state = 'gone';
      it.mesh.visible = false;
      spawnShards(point);
    } else {
      it.state = 'world';
      it.mesh.position.copy(it.p);
      it.mesh.rotation.set(0, Math.random() * TAU, 0);
      it.mesh.visible = true;
    }
    if (onCrash) onCrash(point, it.kind);
    api.distract(point, 6);
  }

  function stepItems(dt) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.state !== 'flying') continue;
      it.v.y -= GRAVITY * dt;
      const px = it.p.x, pz = it.p.z;
      it.p.addScaledVector(it.v, dt);
      if (it.p.x < BOUNDS.minX || it.p.x > BOUNDS.maxX || it.p.z < BOUNDS.minZ || it.p.z > BOUNDS.maxZ) {
        land(it, clamp(px, BOUNDS.minX + .05, BOUNDS.maxX - .05), clamp(pz, BOUNDS.minZ + .05, BOUNDS.maxZ - .05));
        continue;
      }
      if (it.p.y <= 0) { land(it, it.p.x, it.p.z); continue; }
      it.mesh.position.copy(it.p);
      it.mesh.rotation.x += dt * 9;
      it.mesh.rotation.z += dt * 5;
    }
  }

  // ---------- Public API ----------
  const api = {
    setActive(flags = {}) {
      for (const g of guards) {
        const on = !!flags[g.key];
        if (on === g.active) continue;
        g.active = on;
        g.sprite.visible = g.cone.visible = on;
        g.sees = false;
        if (!on && (g.mode === 'toPoint' || g.mode === 'search')) startReturn(g);
      }
    },

    update(dt, ctx = {}) {
      dt = clamp(dt || 0, 0, .1);
      const player = ctx.player;
      const crouched = !!ctx.crouched, jammed = !!ctx.jammed, veteran = !!ctx.veteran;
      if (veteran !== veteranNow) { veteranNow = veteran; graceT = 0; promoted = false; }
      const alarm = ctx.alarm || 0; // each time Mateo is caught the guards walk faster and look further
      const range = (ctx.night ? RANGE_NIGHT : RANGE_DAY) * (ctx.soles ? SOLES_FACTOR : 1) * (1 + .1 * alarm);
      const speed = WALK_SPEED * (veteran ? VETERAN_SPEED : 1) * (1 + .15 * alarm);

      let nearest = Infinity, searching = false, seen = false, close = false;
      for (const g of guards) {
        if (!g.active) continue;
        stepGuard(g, dt, speed);
        g.sees = false;
        if (player) {
          const d = Math.hypot(player.x - g.x, player.z - g.z);
          if (d < nearest) nearest = d;
          if (!jammed && canSee(g, player.x, player.z, range, crouched)) {
            g.sees = true; seen = true;
            if (!veteran || promoted) { if (g.mode !== 'chase') { g.mode = 'chase'; g.stuck = 0; } g.lastX = player.x; g.lastZ = player.z; g.lostT = 0; }
            if (g.mode === 'chase' && d < CATCH_DIST) close = true;
          }
        }
        if (g.mode === 'toPoint' || g.mode === 'search' || g.mode === 'chase') searching = true;
        placeGuard(g, dt, ctx.camera, range, jammed);
      }
      stepItems(dt);
      stepShards(dt);

      const base = searching ? 'search' : nearest <= NEAR_DIST ? 'patrol' : 'clear';
      let level = base, amount = meter;
      if (seen && veteran && !promoted) {
        graceT += dt;
        if (graceT >= GRACE_TIME) { promoted = true; graceT = GRACE_TIME; }
        else { level = 'warn'; amount = graceT / GRACE_TIME; }
      }
      if (seen && (!veteran || promoted)) {
        meter = Math.min(1, meter + dt / FILL_TIME * (close ? 3 : 1));
        level = 'watched';
        amount = meter;
        if (meter >= 1) { meter = 0; graceT = 0; promoted = false; }
      } else if (!seen) {
        graceT = 0; promoted = false;
        meter = Math.max(0, meter - DECAY * dt);
        amount = meter;
      }
      result.level = level;
      result.amount = amount;
      result.nearestDist = nearest;
      return result;
    },

    throwableInView(camera, maxDist = 1.9) {
      if (!camera) return null;
      camera.getWorldPosition(camPos);
      camera.getWorldDirection(vFwd);
      let best = .93, id = null;
      for (const it of items) {
        if (it.state !== 'world') continue;
        vA.set(it.p.x, it.p.y + it.centre, it.p.z).sub(camPos);
        const d = vA.length();
        if (d > maxDist || d < 1e-4) continue;
        const dot = vA.multiplyScalar(1 / d).dot(vFwd);
        if (dot > best) { best = dot; id = it.id; }
      }
      return id;
    },

    pickUp(id) {
      if (heldItem) return null;
      const it = items.find(i => i.id === id);
      if (!it || it.state !== 'world') return null;
      it.state = 'held';
      it.mesh.visible = false;
      heldItem = it;
      return it.kind;
    },

    held() { return heldItem ? heldItem.kind : null; },
    // Where a guard is and what he is doing (used to send the lobby guard back out through the door).
    guardAt(key) { const g = guards.find((q) => q.key === key); return g ? { x: g.x, z: g.z, mode: g.mode } : null; },

    aim(camera, power = 0) {
      if (!heldItem || !camera) { dots.visible = false; return; }
      const T = computeArc(camera, power);
      for (let i = 0; i < ARC_DOTS; i++) {
        arcPoint(T * (i + 1) / ARC_DOTS, vB);
        dummy.position.copy(vB);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1 - .45 * i / ARC_DOTS);
        dummy.updateMatrix();
        dots.setMatrixAt(i, dummy.matrix);
      }
      dots.instanceMatrix.needsUpdate = true;
      dots.visible = true;
    },

    stopAim() { dots.visible = false; },

    release(camera, power = 0) {
      if (!heldItem || !camera) return false;
      computeArc(camera, power);
      const it = heldItem;
      heldItem = null;
      it.p.copy(arcStart);
      it.v.copy(arcVel);
      it.state = 'flying';
      it.mesh.position.copy(it.p);
      it.mesh.visible = true;
      dots.visible = false;
      return true;
    },

    distract(point, seconds = 6) {
      if (!point) return false;
      let best = null, bestD = DISTRACT_RADIUS;
      for (const g of guards) {
        if (!g.active) continue;
        const d = Math.hypot(point.x - g.x, point.z - g.z);
        if (d <= bestD) { bestD = d; best = g; }
      }
      if (!best) return false;
      const g = best;
      g.lookX = point.x; g.lookZ = point.z;
      g.searchFor = seconds;
      g.stuck = 0; g.ghost = false;
      if (bestD <= STOP_SHORT) {
        g.mode = 'search'; g.timer = 0;
        g.base = bestD > .05 ? Math.atan2(point.x - g.x, point.z - g.z) : g.heading;
      } else {
        const k = STOP_SHORT / bestD;
        g.tx = point.x + (g.x - point.x) * k;
        g.tz = point.z + (g.z - point.z) * k;
        g.mode = 'toPoint';
      }
      return true;
    },

    dispose() {
      scene.remove(root);
      root.clear();
      dots.dispose();
      shards.dispose();
      for (const geo of geometries) geo.dispose();
      for (const m of materials) m.dispose();
      guards.length = 0;
      items.length = 0;
      heldItem = null;
    },
  };

  return api;
}
