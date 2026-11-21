// citizens.js — Solmar's people. One humanoid factory (used by the hero,
// the crew and every pedestrian), sidewalk strollers who flee from danger,
// and the armed hostiles the story sends at you.
G.citizens = { all: [], maxLive: 24 };

G.buildHumanoid = function (shirt, pants, skin, hair) {
  var g = new THREE.Group();
  var mat = function (c) { return new THREE.MeshLambertMaterial({ color: c }); };
  function limb(w, h, d, c, x, y, z) {
    var pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.y = -h / 2;
    pivot.add(m);
    g.add(pivot);
    return pivot;
  }
  var legL = limb(0.17, 0.92, 0.19, pants, -0.12, 0.92, 0);
  var legR = limb(0.17, 0.92, 0.19, pants, 0.12, 0.92, 0);
  var torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.64, 0.25), mat(shirt));
  torso.position.y = 1.24;
  torso.castShadow = true;
  g.add(torso);
  var armL = limb(0.13, 0.78, 0.15, shirt, -0.31, 1.52, 0);
  var armR = limb(0.13, 0.78, 0.15, shirt, 0.31, 1.52, 0);
  var head = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.3, 0.27), mat(skin));
  head.position.y = 1.74;
  g.add(head);
  var cap = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.09, 0.29), mat(hair));
  cap.position.y = 1.92;
  g.add(cap);
  return { group: g, legL: legL, legR: legR, armL: armL, armR: armR, head: head, torso: torso, phase: 0 };
};
G.animateHumanoid = function (h, speed, dt, aiming) {
  h.phase += dt * (2.2 + Math.abs(speed) * 1.55);
  var swing = G.clamp(Math.abs(speed) * 0.16, 0, 0.85);
  h.legL.rotation.x = Math.sin(h.phase) * swing;
  h.legR.rotation.x = -Math.sin(h.phase) * swing;
  if (aiming) {
    h.armR.rotation.x = -1.45;
    h.armL.rotation.x = -1.1;
  } else {
    h.armL.rotation.x = Math.sin(h.phase) * swing * 0.8;
    h.armR.rotation.x = -Math.sin(h.phase) * swing * 0.8;
  }
};

var SHIRTS = [0xd84a5c, 0x3a7ad8, 0xe8c85a, 0x4ad87a, 0xe8e8e8, 0x9a5ad8, 0x2a2a30, 0xe87a2e];
var PANTS = [0x2c3550, 0x4a3a2c, 0x22242c, 0x5c6a7a, 0x7a2c3a];
var SKINS = [0xe8b98a, 0xc98a5e, 0x8a5a34, 0xf0c8a0, 0x6e4525];

G.citizens.spawn = function (x, z, kind) {
  var h = G.buildHumanoid(G.pick(SHIRTS), G.pick(PANTS), G.pick(SKINS), 0x2c2018);
  h.group.position.set(x, 0, z);
  G.scene.add(h.group);
  var cit = {
    h: h, x: x, z: z, heading: G.rand(0, Math.PI * 2),
    speed: 0, walkSpeed: G.rand(1.1, 1.9), state: kind || 'stroll',
    health: 60, dead: false, fireAcc: G.rand(0.5, 1.5), strafeDir: G.rng() < 0.5 ? 1 : -1,
    hostile: kind === 'hostile', panicT: 0, vx: 0, vz: 0,
  };
  if (cit.hostile) {
    h.torso.material = new THREE.MeshLambertMaterial({ color: 0x30303a });
    cit.health = 70;
    cit.walkSpeed = 3.2;
  }
  G.citizens.all.push(cit);
  return cit;
};
G.citizens.spawnFleeing = function (x, z, fromX, fromZ) {
  var c = G.citizens.spawn(x, z, 'flee');
  c.heading = Math.atan2(x - fromX, z - fromZ);
  c.panicT = 4;
  return c;
};
G.citizens.fleeFrom = function (x, z, radius) {
  for (var i = 0; i < G.citizens.all.length; i++) {
    var c = G.citizens.all[i];
    if (c.dead || c.hostile) continue;
    if (G.dist2d(x, z, c.x, c.z) < radius) {
      c.state = 'flee';
      c.panicT = G.rand(2.5, 4.5);
      c.heading = Math.atan2(c.x - x, c.z - z) + G.rand(-0.4, 0.4);
    }
  }
};
G.citizens.damage = function (cit, amount, fromX, fromZ) {
  if (cit.dead) return;
  cit.health -= amount;
  if (cit.health <= 0) {
    cit.dead = true;
    cit.h.group.rotation.x = -Math.PI / 2;
    cit.h.group.position.y = 0.16;
    if (cit.hostile && G.onHostileDown) G.onHostileDown(cit);
    G.citizens.fleeFrom(cit.x, cit.z, 16);
  } else if (!cit.hostile) {
    cit.state = 'flee';
    cit.panicT = 3.5;
    cit.heading = Math.atan2(cit.x - fromX, cit.z - fromZ);
  }
};
G.citizens.remove = function (cit) {
  var i = G.citizens.all.indexOf(cit);
  if (i !== -1) G.citizens.all.splice(i, 1);
  if (cit.h.group.parent) cit.h.group.parent.remove(cit.h.group);
};

G.citizens.update = function (dt, px, pz) {
  // keep sidewalks alive near the player
  if (G.citizens.all.filter(function (c) { return !c.hostile; }).length < G.citizens.maxLive) {
    var ang = G.rand(0, Math.PI * 2), dist = G.rand(35, 95);
    var sx = px + Math.sin(ang) * dist, sz = pz + Math.cos(ang) * dist;
    if (!G.world.isWater(sx, sz) && sz < G.WORLD.beachZ) {
      // nudge onto a sidewalk: snap to the nearest road edge + 10m offset
      if (G.world.isRoad(sx, sz)) { sx += 11; }
      var p = G.pushOutOfBoxes(sx, sz, 1.2, G.world.colliders);
      G.citizens.spawn(p.x, p.z, 'stroll');
    }
  }
  for (var i = G.citizens.all.length - 1; i >= 0; i--) {
    var c = G.citizens.all[i];
    var dPlayer = G.dist2d(px, pz, c.x, c.z);
    if (dPlayer > 240 && !c.hostile) { G.citizens.remove(c); continue; }
    if (c.dead) continue;
    var moveSpeed = 0, wantHeading = c.heading;
    if (c.hostile) {
      // close to mid-range, strafe, and shoot the player on a ragged cadence
      var want = dPlayer > 20 ? 14 : (dPlayer < 8 ? 22 : dPlayer);
      if (dPlayer > want + 1) { wantHeading = Math.atan2(px - c.x, pz - c.z); moveSpeed = c.walkSpeed; }
      else if (dPlayer < want - 1) { wantHeading = Math.atan2(c.x - px, c.z - pz); moveSpeed = c.walkSpeed * 0.7; }
      else {
        wantHeading = Math.atan2(px - c.x, pz - c.z);
        c.x += Math.cos(wantHeading) * c.strafeDir * dt * 1.1;
        c.z -= Math.sin(wantHeading) * c.strafeDir * dt * 1.1;
        if (G.rng() < dt * 0.25) c.strafeDir *= -1;
      }
      c.fireAcc -= dt;
      if (c.fireAcc <= 0 && dPlayer < 34) {
        c.fireAcc = G.rand(0.9, 1.7);
        if (G.weapons) G.weapons.npcShoot(c, px, pz);
      }
    } else if (c.state === 'flee') {
      c.panicT -= dt;
      moveSpeed = 4.4;
      if (c.panicT <= 0) c.state = 'stroll';
    } else {
      moveSpeed = c.walkSpeed;
      if (G.rng() < dt * 0.14) c.heading += G.rand(-1.2, 1.2);
      // pedestrians prefer pavements: if they wander onto a road, angle back off it
      if (G.world.isRoad(c.x, c.z) && G.rng() < dt * 2) c.heading += Math.PI / 2;
    }
    c.heading = G.angleLerp(c.heading, wantHeading, 1 - Math.pow(0.001, dt));
    c.x += Math.sin(c.heading) * moveSpeed * dt;
    c.z += Math.cos(c.heading) * moveSpeed * dt;
    var pushed = G.pushOutOfBoxes(c.x, c.z, 0.55, G.world.colliders);
    if (pushed.x !== c.x || pushed.z !== c.z) { c.heading += 1.7 * dt * 8; }
    c.x = pushed.x; c.z = pushed.z;
    c.x = G.clamp(c.x, G.WORLD.minX, G.WORLD.maxX);
    c.z = G.clamp(c.z, G.WORLD.minZ, G.WORLD.beachZ + 14);
    c.speed = moveSpeed;
    c.h.group.position.set(c.x, 0, c.z);
    c.h.group.rotation.y = c.heading;
    G.animateHumanoid(c.h, moveSpeed, dt, c.hostile);
    // traffic is lethal: a fast car through a crowd is a crime scene
    var cars = G.vehicles.all;
    for (var j = 0; j < cars.length; j++) {
      var car = cars[j];
      if (Math.abs(G.vehicles.speedOf(car)) > 4 && G.dist2d(car.x, car.z, c.x, c.z) < 1.9) {
        G.citizens.damage(c, 200, car.x, car.z);
        if (car.driver === 'player' && G.law) G.law.reportCrime('hitPed', c.x, c.z);
        break;
      }
    }
  }
};
