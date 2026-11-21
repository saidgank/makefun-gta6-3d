// crew.js — Dre, your crew of one. He follows on foot, rides shotgun,
// shoots at whoever is shooting at you, and — once you have Runner
// respect — answers the G key by bringing a getaway car to your corner.
G.crew = {
  x: -33, z: 148, heading: 0, h: null, health: 120,
  callCooldown: 0, callUnlocked: false, fireAcc: 1, getaway: null, name: 'DRE',
};

G.crew.init = function (scene) {
  var h = G.buildHumanoid(0x2e8ad8, 0x22242c, 0x8a5a34, 0x0c0c10);
  G.crew.h = h;
  h.group.position.set(G.crew.x, 0, G.crew.z);
  scene.add(h.group);
};
G.crew.rideAlong = function (car) {
  var c = G.crew;
  var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  var rx = fz, rz = -fx;
  c.x = car.x + rx * 0.42; c.z = car.z + rz * 0.42;
  c.h.group.position.set(car.x + rx * 0.42 + fx * 0.1, 0.62, car.z + rz * 0.42 + fz * 0.1);
  c.h.group.rotation.y = car.heading;
  c.h.legL.rotation.x = -1.35; c.h.legR.rotation.x = -1.35;
  c.h.armL.rotation.x = -0.4;
  c.h.armR.rotation.x = G.law && G.law.stars() > 0 ? -1.45 : -0.4;
  c.heading = car.heading;
};
G.crew.callIn = function () {
  var c = G.crew;
  if (!c.callUnlocked) {
    if (G.hud) G.hud.toast('DRE NEEDS RESPECT', 'Reach RUNNER rank and Dre will bring you a car on G.');
    return;
  }
  if (c.callCooldown > 0) {
    if (G.hud) G.hud.toast('DRE IS ROLLING', 'Getaway car already on its way — ' + Math.ceil(c.callCooldown) + 's.');
    return;
  }
  var hero = G.hero;
  var node = G.world.nearestNode(hero.x + G.rand(-40, 40), hero.z + G.rand(-40, 40));
  var car = G.vehicles.create(G.scene, 'sport', 0x8a1a6e, node.x, node.z, 0);
  car.driver = 'crew';
  c.getaway = car;
  c.callCooldown = 60;
  if (G.hud) G.hud.toast('DRE IS ROLLING', 'A magenta Comet is coming to you. Watch the minimap.');
  if (G.radio) G.radio.sfx('phone');
};
G.crew.update = function (dt) {
  var c = G.crew;
  var hero = G.hero;
  c.callCooldown = Math.max(0, c.callCooldown - dt);
  // the getaway car drives itself to the player, then gives up the wheel
  if (c.getaway) {
    var g = c.getaway;
    if (g.dead || g.driver === 'player') c.getaway = null;
    else {
      var d = G.dist2d(g.x, g.z, hero.x, hero.z);
      if (d < 7) { g.driver = null; c.getaway = null; if (G.hud) G.hud.toast('GETAWAY IS HERE', 'Dre sent a Comet. It is yours — press E.'); }
      else {
        var want = Math.atan2(hero.x - g.x, hero.z - g.z);
        var diff = want - g.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        var spd = G.vehicles.speedOf(g);
        G.vehicles.drive(g, { throttle: spd < 15 ? 0.9 : 0, steer: G.clamp(diff * 1.7, -1, 1), handbrake: false }, dt);
      }
    }
  }
  if (hero.inCar || hero.dead) return;
  // follow at a loose heel
  var tx = hero.x - Math.sin(hero.heading) * 1.6 + Math.cos(hero.heading) * 1.1;
  var tz = hero.z - Math.cos(hero.heading) * 1.6 - Math.sin(hero.heading) * 1.1;
  var d = G.dist2d(c.x, c.z, tx, tz);
  if (d > 60) { c.x = tx; c.z = tz; }
  var spd = 0;
  if (d > 2.2) {
    spd = d > 9 ? 6.3 : 3.6;
    c.heading = G.angleLerp(c.heading, Math.atan2(tx - c.x, tz - c.z), 1 - Math.pow(0.0001, dt));
    c.x += Math.sin(c.heading) * spd * dt;
    c.z += Math.cos(c.heading) * spd * dt;
    var p = G.pushOutOfBoxes(c.x, c.z, 0.55, G.world.colliders);
    c.x = p.x; c.z = p.z;
  }
  c.h.group.position.set(c.x, 0, c.z);
  c.h.group.rotation.y = c.heading;
  // Dre shoots at hostiles and police who are in the fight
  c.fireAcc -= dt;
  var target = null, td = 30;
  for (var i = 0; i < G.citizens.all.length; i++) {
    var e = G.citizens.all[i];
    if (e.hostile && !e.dead) { var dd = G.dist2d(c.x, c.z, e.x, e.z); if (dd < td) { td = dd; target = e; } }
  }
  if (!target && G.law && G.law.stars() >= 2) {
    for (var j = 0; j < G.law.officers.length; j++) {
      var o = G.law.officers[j];
      if (!o.dead) { var do2 = G.dist2d(c.x, c.z, o.x, o.z); if (do2 < td) { td = do2; target = o; } }
    }
  }
  if (!target && G.law && G.law.stars() >= 3 && hero.inCar) target = null; // cars are hero's problem at speed
  var aiming = !!target;
  if (target && c.fireAcc <= 0) {
    c.fireAcc = G.rand(0.9, 1.3);
    c.heading = Math.atan2(target.x - c.x, target.z - c.z);
    if (G.weapons) G.weapons.crewShoot(c, target);
  }
  G.animateHumanoid(c.h, spd, dt, aiming);
};
