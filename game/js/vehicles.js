// vehicles.js — every car in Solmar: low-poly models built from primitives,
// an arcade driving model with real drift, damage, smoke and fire.
G.vehicles = { all: [], smokePool: [], smokeTex: null };

var CAR_TYPES = {
  sedan: { w: 1.8, l: 4.3, h: 0.62, cabinL: 2.1, cabinH: 0.52, accel: 13, top: 35, grip: 9.5, health: 100 },
  taxi: { w: 1.8, l: 4.3, h: 0.62, cabinL: 2.1, cabinH: 0.52, accel: 13, top: 34, grip: 9.5, health: 100 },
  sport: { w: 1.86, l: 4.5, h: 0.5, cabinL: 1.8, cabinH: 0.42, accel: 18, top: 46, grip: 11, health: 90 },
  van: { w: 2.0, l: 4.9, h: 1.15, cabinL: 3.4, cabinH: 0.75, accel: 10.5, top: 29, grip: 8.5, health: 150 },
  police: { w: 1.84, l: 4.5, h: 0.6, cabinL: 2.1, cabinH: 0.52, accel: 16.5, top: 42, grip: 10.5, health: 130 },
  armored: { w: 2.1, l: 5.4, h: 1.3, cabinL: 3.6, cabinH: 0.8, accel: 9, top: 27, grip: 8, health: 340 },
};
G.vehicles.TYPES = CAR_TYPES;

function smokeTexture() {
  if (G.vehicles.smokeTex) return G.vehicles.smokeTex;
  var c = document.createElement('canvas');
  c.width = c.height = 64;
  var ctx = c.getContext('2d');
  var gr = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,0.85)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 64, 64);
  G.vehicles.smokeTex = new THREE.CanvasTexture(c);
  return G.vehicles.smokeTex;
}

G.vehicles.buildMesh = function (type, colorHex) {
  var spec = CAR_TYPES[type];
  var g = new THREE.Group();
  var paint = new THREE.MeshLambertMaterial({ color: colorHex });
  var dark = new THREE.MeshLambertMaterial({ color: 0x181c26 });
  var glass = new THREE.MeshLambertMaterial({ color: 0x2c3e55, emissive: 0x0c1626, emissiveIntensity: 0.6 });
  var body = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.l), paint);
  body.position.y = 0.38 + spec.h / 2;
  body.castShadow = true;
  g.add(body);
  var cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.w - 0.24, spec.cabinH, spec.cabinL), type === 'van' || type === 'armored' ? paint : glass);
  cabin.position.set(0, 0.38 + spec.h + spec.cabinH / 2 - 0.04, -0.18);
  // only the body shell casts a shadow: one caster per car keeps the
  // shadow pass cheap even with fifty cars on screen
  g.add(cabin);
  if (type === 'sport') {
    var spoiler = new THREE.Mesh(new THREE.BoxGeometry(spec.w - 0.1, 0.09, 0.42), dark);
    spoiler.position.set(0, 1.06, -spec.l / 2 + 0.3);
    g.add(spoiler);
  }
  if (type === 'taxi') {
    var sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.24, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xffe27a }));
    sign.position.set(0, 0.38 + spec.h + spec.cabinH + 0.1, -0.18);
    g.add(sign);
  }
  var lightbar = null;
  if (type === 'police') {
    var bar = new THREE.Group();
    var red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    red.position.x = -0.3;
    var blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: 0x2a5cff }));
    blue.position.x = 0.3;
    bar.add(red); bar.add(blue);
    bar.position.set(0, 0.38 + spec.h + spec.cabinH + 0.08, -0.18);
    g.add(bar);
    lightbar = { group: bar, red: red, blue: blue };
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.02, 0.3, spec.l - 0.4),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    stripe.position.y = 0.62;
    g.add(stripe);
  }
  var hl = new THREE.Mesh(new THREE.BoxGeometry(spec.w - 0.3, 0.16, 0.06), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  hl.position.set(0, 0.62, spec.l / 2 + 0.02);
  g.add(hl);
  var tl = new THREE.Mesh(new THREE.BoxGeometry(spec.w - 0.3, 0.14, 0.06), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  tl.position.set(0, 0.66, -spec.l / 2 - 0.02);
  g.add(tl);
  var wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  var wheelMat = new THREE.MeshLambertMaterial({ color: 0x14141a });
  var wheels = [];
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (s) {
    var w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(s[0] * (spec.w / 2 - 0.05), 0.36, s[1] * (spec.l / 2 - 0.85));
    g.add(w);
    wheels.push(w);
  });
  g.userData.wheels = wheels;
  g.userData.lightbar = lightbar;
  g.userData.spec = spec;
  return g;
};

G.vehicles.create = function (scene, type, colorHex, x, z, heading) {
  var mesh = G.vehicles.buildMesh(type, colorHex);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading || 0;
  scene.add(mesh);
  var car = {
    mesh: mesh, type: type, spec: CAR_TYPES[type],
    x: x, z: z, heading: heading || 0,
    vx: 0, vz: 0, steerVis: 0,
    health: CAR_TYPES[type].health, maxHealth: CAR_TYPES[type].health,
    driver: null, dead: false, smokeAcc: 0, flashers: mesh.userData.lightbar,
    color: colorHex, wreck: false,
  };
  mesh.userData.car = car;
  G.vehicles.all.push(car);
  return car;
};
G.vehicles.remove = function (car) {
  var i = G.vehicles.all.indexOf(car);
  if (i !== -1) G.vehicles.all.splice(i, 1);
  if (car.mesh.parent) car.mesh.parent.remove(car.mesh);
};
G.vehicles.speedOf = function (car) {
  var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  return car.vx * fx + car.vz * fz;
};
G.vehicles.damage = function (car, amount, cause) {
  if (car.dead) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.dead = true;
    car.mesh.traverse(function (o) {
      if (o.material && o.material.color && o !== car.mesh) { /* keep lights */ }
    });
    if (G.radio) G.radio.sfx('crash');
  }
};

// Arcade drive model: velocity vector, strong lateral grip that the
// handbrake melts away for drifts. input = {throttle, steer, handbrake}.
G.vehicles.drive = function (car, input, dt) {
  var spec = car.spec;
  var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  var fwdSpeed = car.vx * fx + car.vz * fz;
  if (!car.dead) {
    if (input.throttle > 0) {
      var room = G.clamp(1 - fwdSpeed / spec.top, 0, 1);
      car.vx += fx * spec.accel * room * input.throttle * dt;
      car.vz += fz * spec.accel * room * input.throttle * dt;
    } else if (input.throttle < 0) {
      if (fwdSpeed > 0.6) {
        car.vx -= fx * 26 * dt; car.vz -= fz * 26 * dt;
      } else {
        var rroom = G.clamp(1 + fwdSpeed / 11, 0, 1);
        car.vx += fx * spec.accel * 0.7 * rroom * input.throttle * dt;
        car.vz += fz * spec.accel * 0.7 * rroom * input.throttle * dt;
      }
    }
    var steerAuthority = G.clamp(Math.abs(fwdSpeed) / 5, 0, 1) * (fwdSpeed < 0 ? -1 : 1);
    car.heading += input.steer * 1.85 * steerAuthority * dt * (input.handbrake ? 1.35 : 1);
    car.steerVis = G.lerp(car.steerVis, input.steer, 1 - Math.pow(0.0001, dt));
  }
  // split velocity into forward/lateral and grip the lateral part away
  fx = Math.sin(car.heading); fz = Math.cos(car.heading);
  var rx = fz, rz = -fx;
  var vf = car.vx * fx + car.vz * fz;
  var vl = car.vx * rx + car.vz * rz;
  var grip = input.handbrake ? 1.9 : spec.grip;
  vl *= Math.exp(-grip * dt);
  vf *= Math.exp(-(input.handbrake ? 0.55 : 0.28) * dt);
  if (!input.throttle && Math.abs(vf) < 0.12) vf = 0;
  car.vx = fx * vf + rx * vl;
  car.vz = fz * vf + rz * vl;
  car.x += car.vx * dt;
  car.z += car.vz * dt;
  // world collisions
  var before = Math.abs(vf);
  var pushed = G.pushOutOfBoxes(car.x, car.z, 1.75, G.world.colliders);
  if (pushed.x !== car.x || pushed.z !== car.z) {
    car.x = pushed.x; car.z = pushed.z;
    var impact = Math.abs(G.vehicles.speedOf(car));
    car.vx *= 0.45; car.vz *= 0.45;
    if (before > 7) {
      G.vehicles.damage(car, (before - 6) * 1.6, 'crash');
      if (G.radio) G.radio.sfx('crash');
      if (car.driver === 'player' && G.hero) G.hero.hurt((before - 6) * 0.55, 'crash');
    }
  }
  car.x = G.clamp(car.x, G.WORLD.minX - 20, G.WORLD.maxX + 20);
  car.z = G.clamp(car.z, G.WORLD.minZ - 20, G.WORLD.waterZ - 2);
  // sync mesh + wheels
  car.mesh.position.set(car.x, car.dead ? -0.06 : 0, car.z);
  car.mesh.rotation.y = car.heading;
  var wheels = car.mesh.userData.wheels;
  var roll = vf * dt / 0.36;
  for (var i = 0; i < wheels.length; i++) {
    wheels[i].rotation.x += roll;
    if (i < 2) wheels[i].rotation.y = car.steerVis * 0.42;
  }
  // damage smoke / fire
  if (car.health < 45 && !car.dead) {
    car.smokeAcc += dt * (car.health < 18 ? 26 : 9);
    while (car.smokeAcc > 1) { car.smokeAcc -= 1; G.vehicles.spawnSmoke(car.x, 1.15, car.z, car.health < 18); }
  } else if (car.dead) {
    car.smokeAcc += dt * 16;
    while (car.smokeAcc > 1) { car.smokeAcc -= 1; G.vehicles.spawnSmoke(car.x, 1.2, car.z, true); }
  }
};

G.vehicles.spawnSmoke = function (x, y, z, fire) {
  var pool = G.vehicles.smokePool;
  var s = null;
  for (var i = 0; i < pool.length; i++) if (!pool[i].visible) { s = pool[i]; break; }
  if (!s) {
    if (pool.length > 90) return;
    s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), transparent: true, depthWrite: false }));
    pool.push(s);
    G.scene.add(s);
  }
  s.visible = true;
  s.position.set(x + G.rand(-0.3, 0.3), y, z + G.rand(-0.3, 0.3));
  s.userData.life = 0;
  s.userData.maxLife = G.rand(0.7, 1.3);
  s.userData.fire = fire;
  s.scale.set(0.8, 0.8, 1);
};
G.vehicles.updateSmoke = function (dt) {
  var pool = G.vehicles.smokePool;
  for (var i = 0; i < pool.length; i++) {
    var s = pool[i];
    if (!s.visible) continue;
    s.userData.life += dt;
    var t = s.userData.life / s.userData.maxLife;
    if (t >= 1) { s.visible = false; continue; }
    s.position.y += dt * 2.2;
    var sc = 0.8 + t * 2.6;
    s.scale.set(sc, sc, 1);
    s.material.color.setRGB(1, 1, 1);
    if (s.userData.fire) s.material.color.setRGB(1.0, 0.45 + 0.3 * (1 - t), 0.15);
    else s.material.color.setRGB(0.32, 0.32, 0.34);
    s.material.opacity = 0.55 * (1 - t);
  }
};

// Circle-vs-circle between every pair of live cars; returns nothing but
// shoves them apart and trades a little damage on hard hits.
G.vehicles.collideCars = function () {
  var all = G.vehicles.all;
  for (var i = 0; i < all.length; i++) {
    var a = all[i];
    for (var j = i + 1; j < all.length; j++) {
      var b = all[j];
      var dx = b.x - a.x, dz = b.z - a.z;
      var d2 = dx * dx + dz * dz;
      if (d2 > 16.8 || d2 < 0.0001) continue;
      var d = Math.sqrt(d2), push = (4.1 - d) / 2;
      var nx = dx / d, nz = dz / d;
      a.x -= nx * push; a.z -= nz * push;
      b.x += nx * push; b.z += nz * push;
      var rel = Math.abs((a.vx - b.vx) * nx + (a.vz - b.vz) * nz);
      a.vx -= nx * rel * 0.4; a.vz -= nz * rel * 0.4;
      b.vx += nx * rel * 0.4; b.vz += nz * rel * 0.4;
      if (rel > 6.5) {
        G.vehicles.damage(a, rel * 0.9, 'ram');
        G.vehicles.damage(b, rel * 0.9, 'ram');
        if (G.radio) G.radio.sfx('crash');
        if (a.driver === 'player' && G.hero) G.hero.hurt(rel * 0.4, 'crash');
        if (b.driver === 'player' && G.hero) G.hero.hurt(rel * 0.4, 'crash');
        if (G.law) {
          if (a.driver === 'police' || b.driver === 'police') G.law.reportCrime('hitPolice', b.x, b.z);
          else if (a.driver === 'player' || b.driver === 'player') G.law.reportCrime('hitCar', a.x, a.z);
        }
      }
    }
  }
};
