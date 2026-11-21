// traffic.js — Solmar's everyday drivers: they follow the road grid lane by
// lane, brake for trouble, and bail out screaming when their car is jacked
// or wrecked around them. Parked cars wait at the kerb to be borrowed.
G.traffic = { cars: [], parked: {}, maxLive: 15 };

G.traffic.laneTarget = function (car) {
  var t = car.ai;
  if (!t || !t.next) return null;
  var dx = t.next.x - car.x, dz = t.next.z - car.z;
  var len = Math.sqrt(dx * dx + dz * dz) || 1;
  // right-hand lane: offset the goal to the right of the direction of travel
  var rx = dz / len, rz = -dx / len;
  return { x: t.next.x + rx * 4, z: t.next.z + rz * 4 };
};
G.traffic.chooseNext = function (car) {
  var t = car.ai;
  var node = G.world.nearestNode(car.x, car.z);
  if (t.next && G.dist2d(car.x, car.z, t.next.x, t.next.z) < 30) node = t.next;
  var options = node.neighbors.filter(function (n) { return n !== t.prev; });
  if (!options.length) options = node.neighbors;
  t.prev = node;
  t.next = options[Math.floor(G.rng() * options.length) % options.length];
};
G.traffic.spawnOne = function (px, pz) {
  var node = null, tries = 0;
  while (!node && tries < 12) {
    tries++;
    var cand = G.world.nodes[G.randInt(0, G.world.nodes.length - 1)];
    var d = G.dist2d(px, pz, cand.x, cand.z);
    if (d > 55 && d < 170) node = cand;
  }
  if (!node) return;
  var type = G.pick(['sedan', 'sedan', 'sedan', 'taxi', 'van', 'sport']);
  var colors = [0xc23b2e, 0x2e5fc2, 0xd8d8d8, 0x2a2a30, 0x3fae6a, 0xe08a2e, 0x8a4a9e, 0xd8b93a];
  var car = G.vehicles.create(G.scene, type, type === 'taxi' ? 0xf2b821 : G.pick(colors),
    node.x + G.rand(-3, 3), node.z + G.rand(-3, 3), G.rand(0, Math.PI * 2));
  car.driver = 'traffic';
  car.ai = { prev: null, next: null, speed: G.rand(8.5, 12.5), panic: 0 };
  G.traffic.chooseNext(car);
  G.traffic.cars.push(car);
};
G.traffic.bail = function (car) {
  if (car.driver !== 'traffic') return;
  car.driver = null;
  var i = G.traffic.cars.indexOf(car);
  if (i !== -1) G.traffic.cars.splice(i, 1);
  if (G.citizens) G.citizens.spawnFleeing(car.x + 1.6, car.z, car.x, car.z);
};
G.traffic.update = function (dt, px, pz) {
  // keep the streets populated around the player
  if (G.traffic.cars.length < G.traffic.maxLive) G.traffic.spawnOne(px, pz);
  for (var i = G.traffic.cars.length - 1; i >= 0; i--) {
    var car = G.traffic.cars[i];
    var d = G.dist2d(px, pz, car.x, car.z);
    if (d > 260 || car.dead) {
      if (car.dead && d < 60) { /* leave wrecks near the player as set dressing */ }
      else { G.traffic.bailSilent(car); G.vehicles.remove(car); G.traffic.cars.splice(i, 1); continue; }
    }
    if (car.driver !== 'traffic') { G.traffic.cars.splice(i, 1); continue; }
    var target = G.traffic.laneTarget(car);
    if (!target) { G.traffic.chooseNext(car); continue; }
    if (G.dist2d(car.x, car.z, target.x, target.z) < 7) G.traffic.chooseNext(car);
    // steer toward the lane target
    var want = Math.atan2(target.x - car.x, target.z - car.z);
    var diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    var steer = G.clamp(diff * 1.6, -1, 1);
    // obstacle scan: anything solid ahead means brakes
    var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    var blocked = false;
    var all = G.vehicles.all;
    for (var j = 0; j < all.length; j++) {
      if (all[j] === car) continue;
      var ox = all[j].x - car.x, oz = all[j].z - car.z;
      var ahead = ox * fx + oz * fz;
      var side = Math.abs(ox * fz - oz * fx);
      if (ahead > 0 && ahead < 10 && side < 2.4) { blocked = true; break; }
    }
    if (!blocked && G.hero && !G.hero.inCar) {
      var hx = G.hero.x - car.x, hz = G.hero.z - car.z;
      if (hx * fx + hz * fz > 0 && hx * fx + hz * fz < 8 && Math.abs(hx * fz - hz * fx) < 2) blocked = true;
    }
    var speed = G.vehicles.speedOf(car);
    var throttle = blocked ? (speed > 0.5 ? -1 : 0) : (speed < car.ai.speed ? 0.75 : 0);
    if (car.ai.panic > 0) { car.ai.panic -= dt; throttle = 1; }
    G.vehicles.drive(car, { throttle: throttle, steer: steer, handbrake: false }, dt);
    if (car.health < 22 && G.rng() < dt * 0.4) G.traffic.bail(car);
  }
  G.traffic.updateParked(px, pz);
};
G.traffic.bailSilent = function (car) { car.driver = null; };
G.traffic.updateParked = function (px, pz) {
  var spots = G.world.parkedSpots;
  for (var i = 0; i < spots.length; i++) {
    var s = spots[i];
    var d = G.dist2d(px, pz, s.x, s.z);
    var existing = G.traffic.parked[i];
    if (d < 130 && !existing) {
      var type = G.pick(['sedan', 'sedan', 'sport', 'van', 'taxi']);
      var colors = [0xc23b2e, 0x2e5fc2, 0xd8d8d8, 0x2a2a30, 0x3fae6a, 0xe08a2e, 0x8a4a9e];
      var car = G.vehicles.create(G.scene, type, type === 'taxi' ? 0xf2b821 : G.pick(colors), s.x, s.z, s.heading);
      car.driver = null;
      car.parkedSpot = i;
      G.traffic.parked[i] = car;
    } else if (d >= 130 && existing && existing.driver === null && !existing.occupied) {
      G.vehicles.remove(existing);
      delete G.traffic.parked[i];
    }
  }
};
