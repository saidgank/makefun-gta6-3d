// weapons.js — fists, pistol and the Fixer-tier SMG. Hitscan with tracer
// fire, real damage on people and cars, NPC shooting for police, thugs and
// your own crew, and the pickups a firefight leaves behind.
G.weapons = {
  current: 'fists',
  ammo: { pistol: 90, smg: 0 },
  unlocked: { pistol: true, smg: false },
  fireAcc: 0, lastShotCrimeAt: -9, tracers: [], pickups: [],
};
var WEAPON_DEFS = {
  fists: { name: 'FISTS', rate: 0.38, damage: 26, range: 2.4, spread: 0, auto: false },
  pistol: { name: 'PISTOL', rate: 0.27, damage: 34, range: 95, spread: 0.006, auto: false },
  smg: { name: 'SMG "KESTREL"', rate: 0.095, damage: 15, range: 80, spread: 0.03, auto: true },
};
G.weapons.DEFS = WEAPON_DEFS;
G.weapons.select = function (name) {
  if (name !== 'fists' && !G.weapons.unlocked[name]) {
    if (G.hud) G.hud.toast('LOCKED', name === 'smg' ? 'Reach FIXER respect to unlock the SMG.' : '');
    return;
  }
  G.weapons.current = name;
  if (G.hud) G.hud.weaponChanged();
};
G.weapons.addAmmo = function (kind, n) {
  G.weapons.ammo[kind] = Math.min(999, (G.weapons.ammo[kind] || 0) + n);
  if (G.hud) G.hud.weaponChanged();
};

function tracer(x1, y1, z1, x2, y2, z2, colorHex) {
  var geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)]);
  var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: colorHex || 0xffe27a, transparent: true, opacity: 0.9 }));
  G.scene.add(line);
  G.weapons.tracers.push({ line: line, life: 0.07 });
}
// distance from a point to the ray (origin + dir*t), and the t of closest approach
function rayPoint(origin, dir, p) {
  var ox = p.x - origin.x, oy = p.y - origin.y, oz = p.z - origin.z;
  var t = ox * dir.x + oy * dir.y + oz * dir.z;
  if (t < 0) return { t: t, d: 1e9 };
  var cx = origin.x + dir.x * t, cy = origin.y + dir.y * t, cz = origin.z + dir.z * t;
  var dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
  return { t: t, d: Math.sqrt(dx * dx + dy * dy + dz * dz) };
}
function hitTarget(hero, target, def, fromPlayer) {
  if (target.kind === 'citizen') G.citizens.damage(target.ref, def.damage, hero.x, hero.z);
  else if (target.kind === 'officer') G.law.damageOfficer(target.ref, def.damage);
  else if (target.kind === 'car') {
    G.vehicles.damage(target.ref, def.damage * 0.8, 'shot');
    if (target.ref.driver === 'traffic' && G.traffic) G.traffic.bail(target.ref);
  }
}

G.weapons.playerShoot = function (dt, firing) {
  var W = G.weapons;
  W.fireAcc -= dt;
  if (!firing || W.fireAcc > 0 || G.hero.inCar || G.hero.dead) return;
  var def = WEAPON_DEFS[W.current];
  if (W.current !== 'fists' && W.ammo[W.current] <= 0) {
    W.fireAcc = 0.3;
    if (G.radio) G.radio.sfx('click');
    if (G.hud) G.hud.toast('OUT OF AMMO', 'Police and thugs drop more. Loot the arrows on the map.');
    return;
  }
  W.fireAcc = def.rate;
  var hero = G.hero;
  if (W.current === 'fists') {
    if (G.radio) G.radio.sfx('swing');
    // swing at whoever is in front
    var fx = Math.sin(hero.heading), fz = Math.cos(hero.heading);
    var hitAny = false;
    function fist(list, kind) {
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (e.dead) continue;
        var dx = e.x - hero.x, dz = e.z - hero.z;
        if (dx * dx + dz * dz < def.range * def.range && dx * fx + dz * fz > 0.2) {
          hitTarget(hero, { kind: kind, ref: e }, def, true);
          hitAny = true;
        }
      }
    }
    fist(G.citizens.all, 'citizen');
    fist(G.law.officers, 'officer');
    if (hitAny && G.radio) G.radio.sfx('punch');
    return;
  }
  W.ammo[W.current]--;
  if (G.hud) G.hud.weaponChanged();
  if (G.radio) G.radio.sfx(W.current === 'smg' ? 'smg' : 'shot');
  if (G.law && G.law.time - W.lastShotCrimeAt > 1.1) {
    W.lastShotCrimeAt = G.law.time;
    G.law.reportCrime('shotsFired', hero.x, hero.z);
  }
  // ray from the camera through the crosshair
  var cam = G.camera;
  var dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  dir.x += (G.rng() - 0.5) * def.spread * 2;
  dir.y += (G.rng() - 0.5) * def.spread * 2;
  dir.z += (G.rng() - 0.5) * def.spread * 2;
  dir.normalize();
  var origin = { x: hero.x, y: 1.5, z: hero.z };
  var best = null;
  function scan(list, kind, ry, radius) {
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.dead) continue;
      var r = rayPoint(origin, dir, { x: e.x, y: ry, z: e.z });
      if (r.t > 0 && r.t < def.range && r.d < radius && (!best || r.t < best.t)) best = { t: r.t, kind: kind, ref: e };
    }
  }
  scan(G.citizens.all, 'citizen', 1.1, 0.85);
  scan(G.law.officers, 'officer', 1.1, 0.85);
  var cars = G.vehicles.all;
  for (var i = 0; i < cars.length; i++) {
    var r2 = rayPoint(origin, dir, { x: cars[i].x, y: 0.8, z: cars[i].z });
    if (r2.t > 0 && r2.t < def.range && r2.d < 2.1 && (!best || r2.t < best.t)) best = { t: r2.t, kind: 'car', ref: cars[i] };
  }
  // buildings stop the bullet
  var wallT = def.range;
  for (var s = 2; s < def.range; s += 2) {
    var px = origin.x + dir.x * s, pz = origin.z + dir.z * s;
    var py = origin.y + dir.y * s;
    if (py < 2.2 && G.circleVsAabbList(px, pz, 0.2)) { wallT = s; break; }
  }
  var endT = best ? Math.min(best.t, wallT) : wallT;
  var ex = origin.x + dir.x * endT, ey = origin.y + dir.y * endT, ez = origin.z + dir.z * endT;
  var mx = hero.x + Math.sin(hero.heading) * 0.55, mz = hero.z + Math.cos(hero.heading) * 0.55;
  tracer(mx, 1.42, mz, ex, ey, ez, 0xffe27a);
  if (best && best.t <= wallT) {
    hitTarget(hero, best, def, true);
    if (best.kind !== 'car' && best.ref.dead && best.kind === 'citizen' && !best.ref.hostile) {
      G.law.reportCrime('killCitizen', best.ref.x, best.ref.z);
    }
    if (best.kind === 'car' && best.ref.type === 'police') G.law.reportCrime('hitPolice', best.ref.x, best.ref.z);
  }
};
G.circleVsAabbList = function (x, z, r) {
  var boxes = G.world.colliders;
  for (var i = 0; i < boxes.length; i++) if (G.circleVsAabb(x, z, r, boxes[i])) return true;
  return false;
};

// NPC fire: citizens (hostiles), officers and crew all shoot through here.
// target is {x, z, isHero} or a damageable entity reference.
G.weapons.npcShoot = function (shooter, tx, tz) {
  var sx = shooter.x, sz = shooter.z;
  var d = G.dist2d(sx, sz, tx, tz);
  var hitChance = G.clamp(0.52 - d * 0.008, 0.12, 0.5);
  var ex = tx + G.rand(-1.4, 1.4), ez = tz + G.rand(-1.4, 1.4);
  var hit = G.rng() < hitChance;
  if (hit) { ex = tx; ez = tz; }
  tracer(sx, 1.45, sz, ex, 1.2, ez, 0xff9a5c);
  if (G.radio) G.radio.sfx('shotFar');
  if (hit && G.hero && !G.hero.dead) {
    var dmg = G.rand(3.5, 8);
    if (G.hero.inCar) dmg *= 0.45;
    G.hero.hurt(dmg, 'shot');
  }
};
G.weapons.crewShoot = function (shooter, target) {
  var sx = shooter.x, sz = shooter.z;
  var tx = target.x, tz = target.z;
  tracer(sx, 1.45, sz, tx, 0.9, tz, 0x9ad1ff);
  if (G.radio) G.radio.sfx('shot');
  if (target.maxHealth !== undefined && target.spec) G.vehicles.damage(target, 13, 'shot');
  else if (target.cop) G.law.damageOfficer(target, 15);
  else G.citizens.damage(target, 15, sx, sz);
};

G.weapons.spawnPickup = function (x, z, kind) {
  var colors = { health: 0x2ee66b, cash: 0xffd76a, ammo: 0x9ad1ff };
  var mesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55),
    new THREE.MeshBasicMaterial({ color: colors[kind] || 0xffffff }));
  mesh.position.set(x, 0.8, z);
  G.scene.add(mesh);
  G.weapons.pickups.push({ mesh: mesh, x: x, z: z, kind: kind, age: 0 });
};
G.weapons.update = function (dt) {
  var W = G.weapons;
  for (var i = W.tracers.length - 1; i >= 0; i--) {
    var t = W.tracers[i];
    t.life -= dt;
    if (t.life <= 0) {
      G.scene.remove(t.line);
      t.line.geometry.dispose();
      W.tracers.splice(i, 1);
    }
  }
  for (var j = W.pickups.length - 1; j >= 0; j--) {
    var p = W.pickups[j];
    p.age += dt;
    p.mesh.rotation.y += dt * 2.4;
    p.mesh.position.y = 0.8 + Math.sin(p.age * 3) * 0.16;
    if (p.age > 45) { G.scene.remove(p.mesh); W.pickups.splice(j, 1); continue; }
    if (G.hero && !G.hero.inCar && G.dist2d(G.hero.x, G.hero.z, p.x, p.z) < 1.7) {
      if (p.kind === 'health') { G.hero.heal(38); if (G.hud) G.hud.toast('+ HEALTH', 'Patched up. Keep moving.'); }
      if (p.kind === 'cash') { var n = G.randInt(25, 70); G.hero.cash += n; if (G.hud) G.hud.toast('+ ' + G.formatCash(n), 'Dropped cash, now yours.'); }
      if (p.kind === 'ammo') { G.weapons.addAmmo('pistol', 24); G.weapons.addAmmo('smg', 40); if (G.hud) G.hud.toast('+ AMMO', 'Pistol and SMG rounds.'); }
      if (G.radio) G.radio.sfx('pickup');
      G.scene.remove(p.mesh);
      W.pickups.splice(j, 1);
    }
  }
};
