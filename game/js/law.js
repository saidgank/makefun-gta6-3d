// law.js — the Solmar PD. A floating heat value drives the stars; patrol
// cars hunt with road routing, roadblocks seal intersections at three
// stars, and at four the Condor helicopter puts its searchlight on you and
// anchors the hunt. Get boxed in and the bust meter fills.
G.law = {
  heat: 0, lastCrimeAt: -99, lastSeenAt: -99, time: 0,
  police: [], officers: [], roadblock: null, roadblockCooldown: 0,
  heli: null, bustMeter: 0, escapeTimer: 0,
};
var CRIME_HEAT = {
  carTheft: 1.0, stealPolice: 2.0, hitCar: 0.55, hitPed: 1.6, hitPolice: 1.6,
  shotsFired: 0.8, killCitizen: 2.0, killCop: 2.6, missionCrime: 1.0, propertyDamage: 0.4,
};
G.law.stars = function () { return G.clamp(Math.ceil(G.law.heat - 0.001), 0, 5); };
G.law.reportCrime = function (type, x, z) {
  var v = CRIME_HEAT[type] || 0.5;
  var d = G.districtAt(x, z);
  if (G.districts.standing[d] <= 30) v *= 1.2;
  G.law.heat = G.clamp(G.law.heat + v, 0, 5.6);
  G.law.lastCrimeAt = G.law.time;
  G.districts.adjust(d, -v * 0.9, 'Heat in ' + G.districtInfo(d).name + ' burns standing.');
  G.citizens.fleeFrom(x, z, 15);
};
G.law.clearHeat = function () {
  G.law.heat = 0;
  G.law.bustMeter = 0;
  for (var i = G.law.police.length - 1; i >= 0; i--) G.vehicles.remove(G.law.police[i]);
  G.law.police = [];
  G.law.removeOfficers();
  G.law.clearRoadblock();
  if (G.law.heli) { G.scene.remove(G.law.heli.group); G.law.heli = null; }
};
G.law.removeOfficers = function () {
  for (var i = 0; i < G.law.officers.length; i++) G.scene.remove(G.law.officers[i].h.group);
  G.law.officers = [];
};

function spawnPoliceCar(px, pz) {
  var node = null, tries = 0;
  while (!node && tries < 14) {
    tries++;
    var cand = G.world.nodes[G.randInt(0, G.world.nodes.length - 1)];
    var d = G.dist2d(px, pz, cand.x, cand.z);
    if (d > 62 && d < 120) node = cand;
  }
  if (!node) return null;
  var car = G.vehicles.create(G.scene, 'police', 0x22242e, node.x, node.z, G.rand(0, Math.PI * 2));
  car.driver = 'police';
  car.ai = { path: null, pathI: 0, repath: 0, officersOut: false };
  G.law.police.push(car);
  return car;
}
function spawnOfficer(x, z) {
  var h = G.buildHumanoid(0x27355e, 0x1c2438, 0xd8a878, 0x10131c);
  h.group.position.set(x, 0, z);
  G.scene.add(h.group);
  var cop = { h: h, x: x, z: z, heading: 0, health: 55, dead: false, fireAcc: G.rand(0.8, 1.6), cop: true };
  G.law.officers.push(cop);
  return cop;
}
G.law.damageOfficer = function (cop, amount) {
  if (cop.dead) return;
  cop.health -= amount;
  if (cop.health <= 0) {
    cop.dead = true;
    cop.h.group.rotation.x = -Math.PI / 2;
    cop.h.group.position.y = 0.16;
    G.law.reportCrime('killCop', cop.x, cop.z);
  }
};

G.law.buildHeli = function () {
  var g = new THREE.Group();
  var mat = new THREE.MeshLambertMaterial({ color: 0x2c3444 });
  var body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.9, 5.6), mat);
  body.position.y = 0; g.add(body);
  var nose = new THREE.Mesh(new THREE.SphereGeometry(1.15, 10, 8), new THREE.MeshLambertMaterial({ color: 0x3a5a78, emissive: 0x0c1a26, emissiveIntensity: 0.7 }));
  nose.position.set(0, -0.1, 2.9); nose.scale.set(1, 0.85, 1); g.add(nose);
  var tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 4.6), mat);
  tail.position.set(0, 0.35, -4.6); g.add(tail);
  var fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.5, 0.7), mat);
  fin.position.set(0, 0.7, -6.8); g.add(fin);
  var rotor = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.08, 0.7), new THREE.MeshLambertMaterial({ color: 0x14161c }));
  rotor.position.y = 1.35; g.add(rotor);
  var skidL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 3.6), mat);
  skidL.position.set(-1.1, -1.25, 0.3); g.add(skidL);
  var skidR = skidL.clone(); skidR.position.x = 1.1; g.add(skidR);
  var coneGeo = new THREE.ConeGeometry(7.5, 30, 20, 1, true);
  coneGeo.translate(0, -15, 0);
  coneGeo.rotateX(-Math.PI / 2); // length along +Z so lookAt aims the beam
  var cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
    color: 0xffe9b0, transparent: true, opacity: 0.21, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, fog: false,
  }));
  cone.position.y = -1;
  g.add(cone);
  var spot = new THREE.SpotLight(0xffe9b0, 1.6, 90, 0.42, 0.5, 0.6);
  g.add(spot); g.add(spot.target);
  G.scene.add(g);
  return { group: g, rotor: rotor, spot: spot, cone: cone, orbitA: 0 };
};

G.law.setRoadblock = function (px, pz, pvx, pvz) {
  var ahead = G.world.nearestNode(px + pvx * 4.2, pz + pvz * 4.2);
  if (!ahead) return;
  var alongX = Math.abs(pvx) > Math.abs(pvz);
  var cars = [], barriers = [];
  for (var s = -1; s <= 1; s += 2) {
    var cx = ahead.x + (alongX ? 0 : s * 3.6);
    var cz = ahead.z + (alongX ? s * 3.6 : 0);
    var car = G.vehicles.create(G.scene, 'police', 0x22242e, cx, cz, (alongX ? Math.PI / 2 : 0) + s * 0.35);
    car.driver = 'police';
    car.ai = { roadblock: true };
    cars.push(car);
    G.law.police.push(car);
    spawnOfficer(cx + (alongX ? 2.4 : 0), cz + (alongX ? 0 : 2.4));
  }
  var bmat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8, emissive: 0xd84a2e, emissiveIntensity: 0.35 });
  for (var b = -1; b <= 1; b++) {
    var bx = ahead.x + (alongX ? 0 : b * 3.4);
    var bz = ahead.z + (alongX ? b * 3.4 : 0);
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.6 : 3.2, 1.0, alongX ? 3.2 : 0.6), bmat);
    mesh.position.set(bx, 0.5, bz);
    mesh.castShadow = true;
    G.scene.add(mesh);
    barriers.push(mesh);
    var col = { minX: bx - (alongX ? 0.3 : 1.6), maxX: bx + (alongX ? 0.3 : 1.6), minZ: bz - (alongX ? 1.6 : 0.3), maxZ: bz + (alongX ? 1.6 : 0.3), temp: true };
    G.world.colliders.push(col);
    barriers.push(col);
  }
  G.law.roadblock = { x: ahead.x, z: ahead.z, cars: cars, barriers: barriers, age: 0 };
  G.law.roadblockCooldown = 24;
};
G.law.clearRoadblock = function () {
  var rb = G.law.roadblock;
  if (!rb) return;
  for (var i = 0; i < rb.barriers.length; i++) {
    var b = rb.barriers[i];
    if (b.isMesh) G.scene.remove(b);
    else {
      var ci = G.world.colliders.indexOf(b);
      if (ci !== -1) G.world.colliders.splice(ci, 1);
    }
  }
  G.law.roadblock = null;
};

G.law.update = function (dt, hero) {
  var L = G.law;
  L.time += dt;
  L.roadblockCooldown = Math.max(0, L.roadblockCooldown - dt);
  var stars = L.stars();
  var px = hero.x, pz = hero.z;
  // ---- who can see the player? ----
  var seen = false;
  function sees(x, z) {
    if (G.dist2d(x, z, px, pz) > 58) return false;
    return !G.segmentBlocked(x, z, px, pz, G.world.colliders);
  }
  var i, car;
  for (i = 0; i < L.police.length; i++) if (sees(L.police[i].x, L.police[i].z)) seen = true;
  for (i = 0; i < L.officers.length; i++) if (!L.officers[i].dead && sees(L.officers[i].x, L.officers[i].z)) seen = true;
  if (L.heli && G.dist2d(L.heli.group.position.x, L.heli.group.position.z, px, pz) < 34) seen = true;
  if (seen) L.lastSeenAt = L.time;
  // ---- heat decay while hidden ----
  if (L.heat > 0 && L.time - L.lastSeenAt > 5.5 && L.time - L.lastCrimeAt > 4) {
    var hide = G.districts.hideFactor(G.districtAt(px, pz));
    L.heat = Math.max(0, L.heat - dt * 0.055 * hide);
    if (L.heat === 0) L.lastSeenAt = -99;
  }
  stars = L.stars();
  // ---- force levels ----
  var wantCars = stars === 0 ? 0 : Math.min(2 + stars, 6);
  for (i = L.police.length - 1; i >= 0; i--) {
    car = L.police[i];
    var dp = G.dist2d(px, pz, car.x, car.z);
    if (dp > 250 || (stars === 0 && dp > 60)) {
      G.vehicles.remove(car);
      L.police.splice(i, 1);
    }
  }
  var activeCars = L.police.filter(function (c) { return !c.ai || !c.ai.roadblock; }).length;
  if (activeCars < wantCars && L.time - L.lastCrimeAt < 90) spawnPoliceCar(px, pz);
  // helicopter at four stars
  if (stars >= 4 && !L.heli) L.heli = L.buildHeli();
  if (stars < 3 && L.heli) {
    L.heli.group.position.y += dt * 14;
    L.heli.group.position.x += dt * 30;
    if (L.heli.group.position.y > 130) { G.scene.remove(L.heli.group); L.heli = null; }
  }
  if (L.heli && stars >= 3) {
    var heli = L.heli;
    heli.orbitA += dt * 0.35;
    var hx = px + Math.sin(heli.orbitA) * 13, hz = pz + Math.cos(heli.orbitA) * 13;
    heli.group.position.x = G.lerp(heli.group.position.x, hx, 1 - Math.pow(0.02, dt));
    heli.group.position.z = G.lerp(heli.group.position.z, hz, 1 - Math.pow(0.02, dt));
    heli.group.position.y = G.lerp(heli.group.position.y, 30, 1 - Math.pow(0.02, dt));
    heli.group.lookAt(px, 26, pz);
    heli.rotor.rotation.y += dt * 28;
    heli.spot.position.set(0, -1, 0);
    heli.spot.target.position.set(px - heli.group.position.x, -30, pz - heli.group.position.z);
    heli.cone.lookAt(px, 0, pz);
  }
  // ---- roadblocks ----
  if (L.roadblock) {
    L.roadblock.age += dt;
    if (G.dist2d(px, pz, L.roadblock.x, L.roadblock.z) > 110 || L.roadblock.age > 50) L.clearRoadblock();
  } else if (stars >= 3 && hero.inCar && L.roadblockCooldown <= 0 && Math.abs(G.vehicles.speedOf(hero.inCar)) > 7) {
    L.setRoadblock(px, pz, hero.inCar.vx, hero.inCar.vz);
  }
  // ---- pursuit driving ----
  for (i = 0; i < L.police.length; i++) {
    car = L.police[i];
    if (car.ai && car.ai.roadblock) continue;
    if (car.dead) continue;
    var ai = car.ai;
    ai.repath -= dt;
    var direct = !G.segmentBlocked(car.x, car.z, px, pz, G.world.colliders);
    var target = null;
    if (direct && G.dist2d(car.x, car.z, px, pz) < 65) {
      var lead = hero.inCar ? 0.55 : 0.15;
      target = { x: px + (hero.inCar ? hero.inCar.vx * lead : 0), z: pz + (hero.inCar ? hero.inCar.vz * lead : 0) };
    } else {
      if (!ai.path || ai.repath <= 0) {
        ai.path = G.world.findPath(car.x, car.z, px, pz);
        ai.pathI = 0;
        ai.repath = 2.2;
      }
      while (ai.path && ai.pathI < ai.path.length && G.dist2d(car.x, car.z, ai.path[ai.pathI].x, ai.path[ai.pathI].z) < 9) ai.pathI++;
      target = ai.path && ai.path[ai.pathI] ? ai.path[ai.pathI] : { x: px, z: pz };
    }
    var want = Math.atan2(target.x - car.x, target.z - car.z);
    var diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    var steer = G.clamp(diff * 1.7, -1, 1);
    var distP = G.dist2d(car.x, car.z, px, pz);
    var throttle = 1;
    if (!hero.inCar && distP < 8) throttle = G.vehicles.speedOf(car) > 2 ? -1 : 0; // pull up, officers work
    if (!hero.inCar && distP < 11 && !ai.officersOut) {
      ai.officersOut = true;
      spawnOfficer(car.x + 1.8, car.z);
      spawnOfficer(car.x - 1.8, car.z + 1);
    }
    G.vehicles.drive(car, { throttle: throttle, steer: steer, handbrake: Math.abs(diff) > 2.2 }, dt);
    // lightbar strobe
    if (car.flashers) {
      var phase = Math.floor(L.time * 6 + i) % 2 === 0;
      car.flashers.red.material.color.setHex(phase ? 0xff2a2a : 0x551111);
      car.flashers.blue.material.color.setHex(phase ? 0x111155 : 0x2a5cff);
    }
  }
  // ---- foot officers ----
  for (i = L.officers.length - 1; i >= 0; i--) {
    var cop = L.officers[i];
    if (cop.dead) continue;
    var dc = G.dist2d(cop.x, cop.z, px, pz);
    if (dc > 130 || stars === 0) { G.scene.remove(cop.h.group); L.officers.splice(i, 1); continue; }
    var spd = 0, aim = false;
    if (dc > 3) { spd = 4.7; cop.heading = G.angleLerp(cop.heading, Math.atan2(px - cop.x, pz - cop.z), 0.2); }
    else cop.heading = Math.atan2(px - cop.x, pz - cop.z);
    cop.x += Math.sin(cop.heading) * spd * dt;
    cop.z += Math.cos(cop.heading) * spd * dt;
    var pp = G.pushOutOfBoxes(cop.x, cop.z, 0.55, G.world.colliders);
    cop.x = pp.x; cop.z = pp.z;
    cop.h.group.position.set(cop.x, 0, cop.z);
    cop.h.group.rotation.y = cop.heading;
    cop.fireAcc -= dt;
    if (stars >= 3 && dc < 30 && cop.fireAcc <= 0) {
      cop.fireAcc = G.rand(1.1, 1.9);
      aim = true;
      if (G.weapons) G.weapons.npcShoot(cop, px, pz);
    }
    G.animateHumanoid(cop.h, spd, dt, aim || stars >= 3);
  }
  // ---- the bust meter ----
  var boxed = false;
  if (!hero.inCar) {
    for (i = 0; i < L.officers.length; i++) {
      if (!L.officers[i].dead && G.dist2d(L.officers[i].x, L.officers[i].z, px, pz) < 2.7) boxed = true;
    }
  } else if (Math.abs(G.vehicles.speedOf(hero.inCar)) < 1.3) {
    for (i = 0; i < L.police.length; i++) {
      if (G.dist2d(L.police[i].x, L.police[i].z, px, pz) < 7.5) boxed = true;
    }
  }
  if (boxed && stars > 0) L.bustMeter = Math.min(1, L.bustMeter + dt / 1.9);
  else L.bustMeter = Math.max(0, L.bustMeter - dt * 0.7);
  if (L.bustMeter >= 1 && G.events && G.events.onBusted) G.events.onBusted();
};
