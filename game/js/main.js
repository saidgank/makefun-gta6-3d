// main.js — boot, input, the state machine (title / story / playing /
// paused / busted / wasted), the frame loop that wires every system
// together, and the ?shot= director that stages the four screenshots.
G.input = {
  up: false, down: false, left: false, right: false, sprint: false,
  handbrake: false, aiming: false, fireHeld: false, fPressed: false,
  ePressed: false, gPressed: false,
};
G.state = 'title';
G.events = {};
G.errors = [];
window.addEventListener('error', function (e) { G.errors.push(String(e.message || e.error)); });

var params = new URLSearchParams(location.search);
G.shotMode = params.get('shot');
G.playtest = params.get('playtest');

G.init = function () {
  var canvas = document.getElementById('game-canvas');
  G.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  G.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  G.renderer.setSize(window.innerWidth, window.innerHeight);
  G.renderer.shadowMap.enabled = true;
  G.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2600);
  G.camera.position.set(-60, 26, 190);
  G.camera.lookAt(0, 0, 120);
  G.scene.add(G.camera);
  window.addEventListener('resize', function () {
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(window.innerWidth, window.innerHeight);
  });
  G.world.build(G.scene);
  G.hero.init(G.scene);
  G.crew.init(G.scene);
  G.hud.init();
  G.focus = G.hero;
  window.SMH = G;
  bindInput(canvas);
  bindMenus();
  if (G.shotMode) {
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    G.state = 'playing';
    G.director.setup(G.shotMode);
  } else if (G.playtest) {
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    G.state = 'playing';
  } else {
    var save = G.save.read();
    document.getElementById('btn-continue').style.display = save ? 'block' : 'none';
  }
  G.lastT = performance.now();
  requestAnimationFrame(G.frame);
};

function bindInput(canvas) {
  var keyMap = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', KeyD: 'right' };
  window.addEventListener('keydown', function (e) {
    if (keyMap[e.code]) { G.input[keyMap[e.code]] = true; e.preventDefault(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.input.sprint = true;
    if (e.code === 'Space') { G.input.handbrake = true; e.preventDefault(); }
    if (e.code === 'KeyE' && !e.repeat) G.input.ePressed = true;
    if (e.code === 'KeyF' && !e.repeat) G.input.fPressed = true;
    if (e.code === 'KeyG' && !e.repeat) G.input.gPressed = true;
    if (e.code === 'ArrowLeft') G.hero.camYaw += 0.14;
    if (e.code === 'ArrowRight') G.hero.camYaw -= 0.14;
    if (e.code === 'Digit1') G.weapons.select('fists');
    if (e.code === 'Digit2') G.weapons.select('pistol');
    if (e.code === 'Digit3') G.weapons.select('smg');
    if (e.code === 'KeyR' && !e.repeat) { G.radio.unlock(); G.radio.nextStation(); }
    if (e.code === 'KeyM' && !e.repeat) { G.radio.unlock(); G.radio.toggleMute(); }
    if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) {
      if (G.state === 'playing') pauseGame();
      else if (G.state === 'paused') resumeGame();
    }
    G.radio.unlock();
  });
  window.addEventListener('keyup', function (e) {
    if (keyMap[e.code]) G.input[keyMap[e.code]] = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.input.sprint = false;
    if (e.code === 'Space') G.input.handbrake = false;
  });
  canvas.addEventListener('click', function () {
    G.radio.unlock();
    if (G.state === 'playing' && !G.shotMode && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
  });
  document.addEventListener('mousemove', function (e) {
    if (document.pointerLockElement === canvas && G.state === 'playing') {
      G.hero.addCam(e.movementX, e.movementY);
      G.input.aiming = true;
    }
  });
  document.addEventListener('mousedown', function (e) {
    if (e.button === 0 && G.state === 'playing') G.input.fireHeld = true;
    if (e.button === 2 && G.state === 'playing') G.input.aiming = true;
  });
  document.addEventListener('mouseup', function (e) {
    if (e.button === 0) G.input.fireHeld = false;
    if (e.button === 2) G.input.aiming = false;
  });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
}

function bindMenus() {
  document.getElementById('btn-newgame').addEventListener('click', function () {
    G.radio.unlock();
    var had = !!G.save.read();
    G.save.clear();
    if (had) location.reload(); // wipe the old run's world state too
    else startPlaying();
  });
  document.getElementById('btn-continue').addEventListener('click', function () {
    G.radio.unlock();
    var save = G.save.read();
    if (save) G.save.apply(save);
    startPlaying();
  });
  document.getElementById('btn-resume').addEventListener('click', resumeGame);
  document.getElementById('btn-quit-title').addEventListener('click', function () { location.reload(); });
  document.getElementById('btn-story-ok').addEventListener('click', function () {
    document.getElementById('story-screen').classList.add('hidden');
    if (G.storyCallback) { var cb = G.storyCallback; G.storyCallback = null; cb(); }
    if (G.state === 'story') G.state = 'playing';
  });
  // a fresh run with no save starts as soon as the title is clicked through
  document.getElementById('title-screen').addEventListener('click', function (e) {
    if (e.target.id === 'title-screen' && !G.save.read()) startPlaying();
  });
}
function startPlaying() {
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  G.state = 'playing';
}
function pauseGame() {
  if (G.state !== 'playing') return;
  G.state = 'paused';
  var el = document.getElementById('pause-stats');
  el.innerHTML = 'Cash ' + G.formatCash(G.hero.cash) + ' · Respect ' + G.missions.rank().name +
    ' · Jobs ' + G.missions.completed + '/9<br>District standing — Downtown ' + Math.round(G.districts.standing.DOWNTOWN) +
    ' · Beachfront ' + Math.round(G.districts.standing.BEACHFRONT) +
    ' · Docks ' + Math.round(G.districts.standing.DOCKS) +
    ' · Suburbs ' + Math.round(G.districts.standing.SUBURBS);
  document.getElementById('pause-screen').classList.remove('hidden');
  if (document.exitPointerLock) document.exitPointerLock();
  G.save.write();
}
function resumeGame() {
  document.getElementById('pause-screen').classList.add('hidden');
  G.state = 'playing';
}

// ---- bust / wasted / story events -----------------------------------------
G.events.onBusted = function () {
  if (G.state !== 'playing') return;
  G.state = 'busted';
  G.hud.bigCenter('BUSTED');
  G.radio.sfx('busted');
  var fine = Math.min(G.hero.cash, 100 + 120 * G.law.stars());
  setTimeout(function () {
    G.hero.cash -= fine;
    G.hud.bigCenter(null);
    G.hero.respawn('busted');
    G.missions.resetStep();
    G.hud.toast('BUSTED — FINED ' + G.formatCash(fine), 'The SPD keeps the car, the cash and the dignity.');
    G.state = 'playing';
  }, 1300);
};
G.events.onWasted = function () {
  if (G.state !== 'playing') return;
  G.state = 'wasted';
  G.hud.bigCenter('WASTED');
  setTimeout(function () {
    G.hero.cash = Math.max(0, G.hero.cash - 150);
    G.hud.bigCenter(null);
    G.hero.respawn('wasted');
    G.missions.resetStep();
    G.hud.toast('WASTED — HOSPITAL BILL $150', 'Solmar General patched you up. Again.');
    G.state = 'playing';
  }, 1500);
};
G.events.showStory = function (title, text, cb) {
  G.state = 'story';
  document.getElementById('story-title').textContent = title;
  document.getElementById('story-text').textContent = text;
  document.getElementById('story-screen').classList.remove('hidden');
  G.storyCallback = cb;
};
G.events.onStoryComplete = function () {
  G.events.showStory('KINGPIN OF SOLMAR',
    'Marisol steps out at the marina and looks over the whole glittering coast. "Nine jobs," she says. "Every district knows your name now — some love it, some check their mirrors for it. The city is yours, Kingpin. Try not to spend it all in one chase." Free roam unlocked: the club, the garage, the races of the street and the whole city stay open.',
    function () { G.hud.toast('STORY COMPLETE', 'Free roam — Solmar is yours.'); });
};

// ---- the frame -------------------------------------------------------------
G.frame = function (now) {
  requestAnimationFrame(G.frame);
  var dt = Math.min((now - G.lastT) / 1000, 0.05);
  G.lastT = now;
  var t = now / 1000;
  if (G.state === 'playing') {
    var input = G.input;
    if (input.ePressed) G.hero.enterExit();
    if (input.gPressed) G.crew.callIn();
    G.hero.update(dt, input);
    G.traffic.update(dt, G.hero.x, G.hero.z);
    G.citizens.update(dt, G.hero.x, G.hero.z);
    G.crew.update(dt);
    G.law.update(dt, G.hero);
    G.weapons.playerShoot(dt, input.fireHeld);
    G.weapons.update(dt);
    if (!G.shotMode) { G.missions.update(dt); G.garage.update(dt); }
    G.districts.update(G.hero.x, G.hero.z);
    G.vehicles.collideCars();
    G.vehicles.updateSmoke(dt);
    // sirens follow the nearest unit
    var nd = 999;
    for (var i = 0; i < G.law.police.length; i++) nd = Math.min(nd, G.dist2d(G.law.police[i].x, G.law.police[i].z, G.hero.x, G.hero.z));
    G.radio.sirenUpdate(nd, G.law.stars());
    G.radio.update(dt);
    G.hud.update(dt);
    if (G.shotMode && G.director) G.director.frame(dt, t);
    input.fPressed = false;
    input.ePressed = false;
    input.gPressed = false;
  } else if (G.state === 'title') {
    // slow orbital vista behind the title
    var a = t * 0.03;
    G.camera.position.set(Math.sin(a) * 150, 42, 120 + Math.cos(a) * 60);
    G.camera.lookAt(0, 6, 40);
    G.citizens.update(dt, -35, 146);
    G.traffic.update(dt, -35, 146);
    G.vehicles.collideCars();
    G.vehicles.updateSmoke(dt);
  }
  G.world.update(dt, t);
  G.renderer.render(G.scene, G.camera);
};

// ---- screenshot director -----------------------------------------------------
G.director = {
  frames: 0,
  setup: function (name) {
    var hero = G.hero;
    hero.cash = 1875;
    G.missions.completed = 2; // HUD shows RUNNER
    if (name === 'downtown') {
      hero.placeAt(6, -44, 2.6);
      hero.camYaw = 2.6;
      spawnShotCar('taxi', 0xf2b821, -8, -20, Math.PI / 2, 'traffic');
      spawnShotCar('sedan', 0x2e5fc2, 30, -20.5, Math.PI / 2, 'traffic');
      spawnShotCar('sport', 0xc23b2e, -34, 3, 0, null);
      G.missions.setTarget(238, -38, 0x2ee6c8);
      G.hud.setObjective('FIRST WHEELS', 'Find the marked Comet near the docks', 'Downtown standing is watching');
      this.cam = { x: 15, y: 4.6, z: -33, lx: 2, ly: 1.4, lz: -48 };
    } else if (name === 'race') {
      var car = G.vehicles.create(G.scene, 'sport', 0x2ee6c8, -262, 164.6, Math.PI / 2);
      car.driver = 'player'; car.occupied = true;
      hero.inCar = car; hero.x = car.x; hero.z = car.z; hero.heading = Math.PI / 2;
      hero.seatInCar(car, -0.42);
      var rival = G.vehicles.create(G.scene, 'sport', 0xf2b821, -262, 155.4, Math.PI / 2);
      rival.driver = 'rival';
      var dre = G.crew;
      dre.x = car.x; dre.z = car.z;
      G.crew.rideAlong(car);
      spawnShotCar('sedan', 0xd8d8d8, -286, 155.6, Math.PI / 2, 'traffic');
      spawnShotCar('van', 0x3fae6a, -240, 164.4, Math.PI / 2, 'traffic');
      G.missions.setTarget(-140, 160, 0x2ee6c8);
      G.hud.setObjective('SOLMAR STREET RACE: BEACHFRONT DASH', 'STREET RACE — checkpoint 1 of 4 · POS 1/2', 'Pico in the yellow Comet wants your money');
      this.cam = { x: -276, y: 4.4, z: 173, lx: -252, ly: 1.2, lz: 158 };
    } else if (name === 'chase') {
      var car2 = G.vehicles.create(G.scene, 'sport', 0xc23b2e, 20, 104.4, Math.PI / 2);
      car2.driver = 'player'; car2.occupied = true;
      car2.vx = 13;
      hero.inCar = car2; hero.x = car2.x; hero.z = car2.z; hero.heading = Math.PI / 2;
      hero.seatInCar(car2, -0.42);
      G.crew.rideAlong(car2);
      G.law.heat = 4.3;
      G.law.lastCrimeAt = 0;
      var spots = [[2, 96], [4, 112], [-16, 100]];
      for (var i = 0; i < spots.length; i++) {
        var pc = G.vehicles.create(G.scene, 'police', 0x22242e, spots[i][0], spots[i][1], Math.PI / 2 + (i - 1) * 0.22);
        pc.driver = 'police';
        pc.ai = { path: null, pathI: 0, repath: 0, officersOut: false };
        pc.vx = 11;
        G.law.police.push(pc);
      }
      G.law.setRoadblock(20, 104, 13, 0); // ahead-point lands on node (70,100)...
      // ...then shift the whole roadblock 16 m closer so it reads in frame
      if (G.law.roadblock) {
        var rb = G.law.roadblock;
        rb.x -= 16;
        rb.cars.forEach(function (c) { c.x -= 16; c.mesh.position.x -= 16; });
        rb.barriers.forEach(function (b) {
          if (b.isMesh) b.position.x -= 16;
          else { b.minX -= 16; b.maxX -= 16; }
        });
        G.law.officers.forEach(function (o) { o.x -= 16; o.h.group.position.x -= 16; });
      }
      G.law.heli = G.law.buildHeli();
      G.law.heli.group.position.set(38, 23, 84);
      G.missions.setTarget(288, 168, 0xff5c39);
      G.weapons.select('pistol');
      G.hud.setObjective('NIGHT OF THE CONDOR', 'Reach the marina buyer — the Condor is up, keep moving!', '5 stars · roadblock ahead');
      this.cam = { x: 2, y: 5.4, z: 116, lx: 28, ly: 1.2, lz: 100 };
    } else if (name === 'docks') {
      hero.placeAt(238, 76, 2.2);
      hero.camYaw = 2.2;
      G.weapons.select('pistol');
      G.crew.x = 236; G.crew.z = 78.5;
      G.crew.h.group.position.set(236, 0, 78.5);
      G.crew.h.group.rotation.y = 2.4;
      G.citizens.spawn(247, 66, 'hostile');
      G.citizens.spawn(254, 73, 'hostile');
      G.citizens.spawn(243, 63, 'hostile');
      G.missions.setTarget(245, 71, 0xff5c39);
      G.hud.setObjective('DOCKSIDE DIPLOMACY', 'Clear the Ferro crew from the yard', 'Hostiles left: 3 · Dre has your back');
      this.cam = { x: 231, y: 3.6, z: 79, lx: 246, ly: 1.2, lz: 67 };
    }
    this.name = name;
  },
  frame: function (dt, t) {
    this.frames++;
    if (this.cam) {
      G.camera.position.set(this.cam.x, this.cam.y, this.cam.z);
      G.camera.lookAt(this.cam.lx, this.cam.ly, this.cam.lz);
      if (Math.abs(G.camera.fov - 58) > 0.1) { G.camera.fov = 58; G.camera.updateProjectionMatrix(); }
    }
    if (this.name === 'chase' && G.hero.inCar) {
      // hold the staged chase in place: the world moves, the shot does not drift away
      var car = G.hero.inCar;
      car.x = 20; car.z = 104.4; car.vx = 13; car.vz = 0; car.heading = Math.PI / 2;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      G.hero.x = car.x; G.hero.z = car.z;
      G.hero.seatInCar(car, -0.42);
      G.crew.rideAlong(car);
      // keep the frame frozen at its peak: no bust, no heat decay, and the
      // Condor hangs in shot with its searchlight cone on the player car
      G.law.heat = 4.3;
      G.law.bustMeter = 0;
      G.law.lastCrimeAt = G.law.time;
      if (G.law.heli) {
        var heli = G.law.heli;
        heli.group.position.set(36, 18, 90);
        heli.group.lookAt(G.hero.x, 18, G.hero.z);
        heli.spot.target.position.set(G.hero.x - 36, -18, G.hero.z - 90);
        heli.cone.lookAt(G.hero.x, 0, G.hero.z);
      }
    }
    if (G.hud) G.hud.prompt(null); // no live prompts exist in staged shots
    if (this.frames === 150) window.__shotReady = true;
  },
};
function spawnShotCar(type, color, x, z, heading, driver) {
  var car = G.vehicles.create(G.scene, type, color, x, z, heading);
  car.driver = driver;
  if (driver === 'traffic') {
    car.ai = { prev: null, next: null, speed: 10, panic: 0 };
    G.traffic.cars.push(car);
    G.traffic.chooseNext(car);
  }
  return car;
}

window.addEventListener('DOMContentLoaded', G.init);
