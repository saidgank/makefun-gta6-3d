// hero.js — you. A low-poly runner with a proper third-person chase camera,
// on-foot movement, car entry, health, and the two ways a run ends:
// busted at the station, wasted at the hospital.
G.hero = {
  x: -35, z: 146, heading: Math.PI, speed: 0,
  health: 100, maxHealth: 100,
  inCar: null, dead: false, h: null,
  camYaw: Math.PI, camPitch: 0.32, camDist: 7.5,
  cash: 250, hurtFlash: 0, stepAcc: 0,
};

G.hero.init = function (scene) {
  var h = G.buildHumanoid(0xff5c39, 0x27324a, 0xc98a5e, 0x14100c);
  G.hero.h = h;
  scene.add(h.group);
  G.hero.placeAt(-35, 146, Math.PI);
};
G.hero.placeAt = function (x, z, heading) {
  G.hero.x = x; G.hero.z = z;
  if (heading !== undefined) G.hero.heading = heading;
  G.hero.h.group.position.set(x, 0, z);
  G.hero.h.group.rotation.y = G.hero.heading;
};
G.hero.seatInCar = function (car, seatX) {
  var h = G.hero.h;
  var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  var rx = fz, rz = -fx;
  h.group.position.set(car.x + rx * seatX + fx * 0.1, 0.62, car.z + rz * seatX + fz * 0.1);
  h.group.rotation.y = car.heading;
  h.legL.rotation.x = -1.35; h.legR.rotation.x = -1.35;
  h.armL.rotation.x = -0.7; h.armR.rotation.x = -0.7;
};
G.hero.enterExit = function () {
  var hero = G.hero;
  if (hero.inCar) {
    var car = hero.inCar;
    var rx = Math.cos(car.heading), rz = -Math.sin(car.heading);
    var ex = car.x - rx * 2.4, ez = car.z - rz * 2.4;
    var p = G.pushOutOfBoxes(ex, ez, 0.6, G.world.colliders);
    hero.inCar = null;
    car.driver = null;
    car.occupied = false;
    hero.placeAt(p.x, p.z, car.heading);
    hero.h.group.visible = true;
    if (G.radio) G.radio.engineStop();
    return;
  }
  // find the nearest usable car
  var best = null, bd = 3.6;
  for (var i = 0; i < G.vehicles.all.length; i++) {
    var c = G.vehicles.all[i];
    if (c.dead) continue;
    var d = G.dist2d(hero.x, hero.z, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) return;
  // taking a traffic car makes its driver bail and flee on foot, and the
  // theft is reported — a police car reports the heavier stealPolice crime
  if (best.driver === 'traffic' && G.traffic) G.traffic.bail(best);
  if (best.type === 'police') { if (G.law) G.law.reportCrime('stealPolice', best.x, best.z); }
  else if (G.law) G.law.reportCrime('carTheft', best.x, best.z);
  best.driver = 'player';
  best.occupied = true;
  hero.inCar = best;
  hero.camYaw = best.heading;
  if (G.radio) { G.radio.engineStart(); G.radio.radioOn(); }
  if (G.missions) G.missions.onEnterCar(best);
};
G.hero.hurt = function (amount, cause) {
  var hero = G.hero;
  if (hero.dead || amount <= 0) return;
  hero.health -= amount;
  hero.hurtFlash = 1;
  if (G.hud) G.hud.damagePulse();
  if (hero.health <= 0) {
    hero.health = 0;
    hero.dead = true;
    if (G.events && G.events.onWasted) G.events.onWasted(cause);
  }
};
G.hero.heal = function (amount) {
  G.hero.health = G.clamp(G.hero.health + amount, 0, G.hero.maxHealth);
};
G.hero.respawn = function (kind) {
  var hero = G.hero;
  var spot = kind === 'busted' ? G.world.landmarks.police : G.world.landmarks.hospital;
  if (hero.inCar) { hero.inCar.driver = null; hero.inCar.occupied = false; hero.inCar = null; }
  hero.dead = false;
  hero.health = hero.maxHealth;
  hero.h.group.visible = true;
  hero.h.group.rotation.x = 0;
  hero.placeAt(spot.doorX, spot.doorZ + 4, 0);
  hero.camYaw = 0;
  if (G.law) G.law.clearHeat();
  if (G.radio) G.radio.engineStop();
};

G.hero.update = function (dt, input) {
  var hero = G.hero;
  if (hero.dead) return;
  hero.hurtFlash = Math.max(0, hero.hurtFlash - dt * 2.2);
  if (hero.inCar) {
    var car = hero.inCar;
    var driveInput = {
      throttle: (input.up ? 1 : 0) + (input.down ? -1 : 0),
      steer: (input.left ? 1 : 0) + (input.right ? -1 : 0),
      handbrake: !!input.handbrake,
    };
    G.vehicles.drive(car, driveInput, dt);
    hero.x = car.x; hero.z = car.z;
    hero.heading = car.heading;
    hero.speed = Math.abs(G.vehicles.speedOf(car));
    hero.seatInCar(car, -0.42);
    if (G.crew) G.crew.rideAlong(car);
    if (G.radio) G.radio.engineUpdate(hero.speed, car.spec.top);
    // camera chases the car, stretching back and widening with speed
    var targetDist = 10.5 + hero.speed * 0.16;
    hero.camDist = G.lerp(hero.camDist, targetDist, 1 - Math.pow(0.01, dt));
    hero.updateCamera(dt, car.x, car.z, 1.4);
    return;
  }
  // ---- on foot ----
  var fwdX = Math.sin(hero.camYaw), fwdZ = Math.cos(hero.camYaw);
  var rightX = fwdZ, rightZ = -fwdX;
  var mx = 0, mz = 0;
  if (input.up) { mx += fwdX; mz += fwdZ; }
  if (input.down) { mx -= fwdX; mz -= fwdZ; }
  if (input.right) { mx += rightX; mz += rightZ; }
  if (input.left) { mx -= rightX; mz -= rightZ; }
  var moving = (mx !== 0 || mz !== 0);
  var sprint = input.sprint && !input.aiming;
  var speed = input.aiming ? 1.9 : (sprint ? 6.6 : 3.5);
  if (moving) {
    var len = Math.sqrt(mx * mx + mz * mz);
    mx /= len; mz /= len;
    var want = Math.atan2(mx, mz);
    hero.heading = G.angleLerp(hero.heading, want, 1 - Math.pow(0.000001, dt));
    hero.x += mx * speed * dt;
    hero.z += mz * speed * dt;
    hero.speed = speed;
    hero.stepAcc += dt * speed;
    if (hero.stepAcc > 2.4) { hero.stepAcc = 0; if (G.radio) G.radio.sfx('step'); }
  } else {
    hero.speed = 0;
  }
  var p = G.pushOutOfBoxes(hero.x, hero.z, 0.55, G.world.colliders);
  hero.x = G.clamp(p.x, G.WORLD.minX, G.WORLD.maxX);
  hero.z = G.clamp(p.z, G.WORLD.minZ, G.WORLD.beachZ + 16);
  hero.h.group.position.set(hero.x, 0, hero.z);
  hero.h.group.rotation.y = hero.heading;
  if (input.aiming) hero.heading = hero.camYaw;
  G.animateHumanoid(hero.h, moving ? speed : 0, dt, input.aiming || (G.weapons && G.weapons.current !== 'fists'));
  hero.camDist = G.lerp(hero.camDist, 7.5, 1 - Math.pow(0.01, dt));
  hero.updateCamera(dt, hero.x, hero.z, 1.7);
};

G.hero.updateCamera = function (dt, tx, tz, ty) {
  var hero = G.hero;
  var cam = G.camera;
  if (!cam) return;
  // in shot mode the scene director owns the camera
  if (G.shotMode) return;
  var fx = Math.sin(hero.camYaw), fz = Math.cos(hero.camYaw);
  var dist = hero.camDist;
  var cx = tx - fx * dist * Math.cos(hero.camPitch);
  var cz = tz - fz * dist * Math.cos(hero.camPitch);
  var cy = ty + Math.sin(hero.camPitch) * dist + 1.2;
  // keep the camera out of buildings and above the ground
  var p = G.pushOutOfBoxes(cx, cz, 1.1, G.world.colliders);
  cx = p.x; cz = p.z;
  cy = Math.max(cy, 1.1);
  if (!G.cameraInit) {
    cam.position.set(cx, cy, cz);
    G.cameraInit = true;
  } else {
    var k = 1 - Math.pow(0.0000001, dt);
    cam.position.x = G.lerp(cam.position.x, cx, k);
    cam.position.y = G.lerp(cam.position.y, cy, k);
    cam.position.z = G.lerp(cam.position.z, cz, k);
  }
  cam.lookAt(tx + fx * 6, ty + 0.4, tz + fz * 6);
  var speedFov = hero.inCar ? G.clamp(Math.abs(G.vehicles.speedOf(hero.inCar)) / hero.inCar.spec.top, 0, 1) * 11 : 0;
  var wantFov = 62 + speedFov;
  if (Math.abs(cam.fov - wantFov) > 0.15) {
    cam.fov = G.lerp(cam.fov, wantFov, 0.4);
    cam.updateProjectionMatrix();
  }
};
G.hero.addCam = function (dx, dy) {
  G.hero.camYaw -= dx * 0.0031;
  G.hero.camPitch = G.clamp(G.hero.camPitch + dy * 0.0026, -0.12, 1.05);
};
