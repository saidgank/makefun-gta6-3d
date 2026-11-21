// missions.js — Marisol Vega's nine jobs: the story of how a nobody with a
// borrowed car becomes the Kingpin of Solmar. A small step engine runs
// deliveries, a named street race, escapes, a shootout, a convoy ambush and
// a helicopter finale; respect ranks unlock the SMG and Dre's getaway car.
G.missions = {
  index: 0, completed: 0, active: null, stepI: 0,
  target: null, route: [], routeTimer: 0, marker: null, markerRing: null,
  race: null, hostilesLeft: 0, van: null, storyDone: false,
};
G.RANKS = [
  { name: 'ROOKIE', at: 0 }, { name: 'RUNNER', at: 2 }, { name: 'FIXER', at: 4 },
  { name: 'SHOTCALLER', at: 6 }, { name: 'KINGPIN', at: 9 },
];
G.missions.rank = function () {
  var r = G.RANKS[0];
  for (var i = 0; i < G.RANKS.length; i++) if (G.missions.completed >= G.RANKS[i].at) r = G.RANKS[i];
  return r;
};

var CLUB = { x: -105, z: 148 };
var GARAGE = { x: 175, z: 146 };
var JOBS = [
  { title: 'FIRST WHEELS', district: 'BEACHFRONT', pay: 250,
    intro: 'Marisol Vega runs the Solmar Social Club and half the favors on this coast. "You drive, you eat," she says. "There is a Comet parked by the docks with your name on it. Bring it to Kingpin Garage — clean."',
    steps: [
      { type: 'goto', x: 238, z: -32, r: 9, text: 'Find the marked Comet near the docks' },
      { type: 'steal', text: 'Steal the Comet (E)' },
      { type: 'deliver', x: GARAGE.x, z: GARAGE.z, r: 11, text: 'Deliver the Comet to Kingpin Garage' },
    ] },
  { title: 'HOT PACKAGE', district: 'DOCKS', pay: 400,
    intro: '"A package came off the night ferry and the wrong people are asking about it. Warehouse door, east docks. Get it to my club before anyone gets curious."',
    steps: [
      { type: 'pickup', x: 245, z: 30, r: 5, text: 'Pick up the package at the warehouse door' },
      { type: 'timerGoto', x: CLUB.x, z: CLUB.z, r: 9, time: 165, text: 'Bring the package to the Solmar Social Club' },
    ] },
  { title: 'THREE-STAR GOODBYE', district: 'DOWNTOWN', pay: 550,
    intro: '"Downtown drop, easy money." It was not easy money. The buyer was a cop, the bag was marked, and now the whole SPD wants a word. Lose them. All of them.',
    steps: [
      { type: 'goto', x: 0, z: -80, r: 10, text: 'Make the downtown drop (avenue & 0 street)' },
      { type: 'spring', stars: 3.1, text: 'It is a setup — the SPD is on you!' },
      { type: 'escape', text: 'Lose the heat completely (break line of sight and hide)' },
    ] },
  { title: 'SOLMAR STREET RACE: BEACHFRONT DASH', district: 'BEACHFRONT', pay: 700, winBonus: 300,
    intro: '"Every Friday the beachfront belongs to the racers. One dash, four checkpoints, a loudmouth named Pico in a yellow Comet. Take his money and his pride."',
    steps: [
      { type: 'goto', x: -262, z: 160, r: 9, text: 'Get a car and reach the street race start line' },
      { type: 'race', text: 'STREET RACE — Beachfront Dash: beat Pico through the checkpoints' },
    ] },
  { title: 'DOCKSIDE DIPLOMACY', district: 'DOCKS', pay: 850,
    intro: 'The Ferro crew fenced their yard at the docks and started taxing Marisol\'s trucks. "Diplomacy failed," she says. "Send the other kind. Dre has your back."',
    steps: [
      { type: 'goto', x: 245, z: 92, r: 9, text: 'Enter the Ferro yard at the docks' },
      { type: 'shootout', x: 245, z: 71, count: 5, text: 'Clear the Ferro crew from the yard' },
    ] },
  { title: 'CONVOY AMBUSH', district: 'DOWNTOWN', pay: 1000,
    intro: 'An armored van moves a casino cage across downtown tonight, fat and slow. "Stop it, pop it, and whatever falls out is ours. Try not to level it — the cage is the point."',
    steps: [
      { type: 'goto', x: -200, z: -20, r: 14, text: 'Intercept the armored van on the north avenue' },
      { type: 'chaseVan', text: 'Stop the armored van (ram it / shoot it below 35% health)' },
      { type: 'lootVan', text: 'Grab the cage money from the stopped van' },
      { type: 'deliver', x: GARAGE.x, z: GARAGE.z, r: 11, text: 'Shake it off and reach Kingpin Garage' },
    ] },
  { title: 'THE GARAGE JOB', district: 'DOCKS', pay: 1200,
    intro: 'A collector keeps a one-of-twenty Kestrel GT inside the dock warehouse lot, guarded by Ferro leftovers. "I do not care how loud it gets. That car sleeps in my garage tonight."',
    steps: [
      { type: 'goto', x: 245, z: 34, r: 12, text: 'Reach the warehouse lot at the docks' },
      { type: 'stealGuarded', text: 'Take the Kestrel GT — deal with the guards' },
      { type: 'deliver', x: GARAGE.x, z: GARAGE.z, r: 11, text: 'Deliver the Kestrel GT to Kingpin Garage' },
    ] },
  { title: 'NIGHT OF THE CONDOR', district: 'DOWNTOWN', pay: 1500,
    intro: 'The big one. A bank cage downtown, a buyer at the marina, and the SPD\'s Condor helicopter flying nights this week. "Four stars, baby. All the way home. Do not stop for anything."',
    steps: [
      { type: 'pickup', x: 70, z: -128, r: 6, text: 'Take the bank cage downtown' },
      { type: 'finaleRun', x: 288, z: 168, r: 11, text: 'Reach the marina buyer — the Condor is up, keep moving!' },
      { type: 'escape', text: 'Now lose the heat completely' },
    ] },
  { title: 'KEYS TO THE CITY', district: 'BEACHFRONT', pay: 2000,
    intro: '"One last ride, partner. Pick me up at the club. I want to show you what you built." Marisol is smiling like the whole coast is a gift she is about to hand over.',
    steps: [
      { type: 'pickupPerson', x: CLUB.x, z: CLUB.z, r: 8, text: 'Pick up Marisol at the Social Club (in a car)' },
      { type: 'deliver', x: 288, z: 168, r: 11, text: 'Drive Marisol to the marina overlook' },
    ] },
];
G.missions.JOBS = JOBS;

G.missions.buildMarker = function () {
  if (G.missions.marker) return;
  var geo = new THREE.CylinderGeometry(1.1, 1.1, 34, 12, 1, true);
  var mat = new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.33, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  G.missions.marker = new THREE.Mesh(geo, mat);
  G.missions.marker.position.y = 17;
  var ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.1, 28),
    new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, fog: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  G.missions.markerRing = ring;
  G.scene.add(G.missions.marker);
  G.scene.add(ring);
};
G.missions.setTarget = function (x, z, colorHex) {
  G.missions.buildMarker();
  G.missions.target = { x: x, z: z };
  G.missions.marker.visible = true;
  G.missions.markerRing.visible = true;
  G.missions.marker.position.x = x;
  G.missions.marker.position.z = z;
  G.missions.markerRing.position.x = x;
  G.missions.markerRing.position.z = z;
  if (colorHex) {
    G.missions.marker.material.color.setHex(colorHex);
    G.missions.markerRing.material.color.setHex(colorHex);
  }
  G.missions.routeTimer = 0;
};
G.missions.clearTarget = function () {
  G.missions.target = null;
  G.missions.route = [];
  if (G.missions.marker) { G.missions.marker.visible = false; G.missions.markerRing.visible = false; }
};

G.missions.start = function (i) {
  var job = JOBS[i];
  G.missions.active = job;
  G.missions.stepI = 0;
  G.missions.enterStep();
  if (G.save) G.save.write();
};
G.missions.enterStep = function () {
  var M = G.missions;
  var step = M.active.steps[M.stepI];
  M.stepData = {};
  if (G.hud) G.hud.setObjective(M.active.title, step.text, '');
  if (step.type === 'goto' || step.type === 'deliver' || step.type === 'pickup' || step.type === 'timerGoto' || step.type === 'finaleRun') {
    M.setTarget(step.x, step.z, step.type === 'finaleRun' ? 0xff5c39 : 0xffd76a);
    if (step.type === 'timerGoto') M.stepData.timeLeft = step.time;
    if (step.type === 'finaleRun') G.law.heat = Math.max(G.law.heat, 4.2);
  }
  if (step.type === 'steal') {
    // the marked Comet waits where the previous step pointed
    var car = G.vehicles.create(G.scene, 'sport', 0x2ee6c8, 238, -38, Math.PI / 2);
    car.driver = null;
    M.stepData.car = car;
    M.setTarget(238, -38, 0x2ee6c8);
  }
  if (step.type === 'race') M.setupRace();
  if (step.type === 'shootout') M.setupShootout(step);
  if (step.type === 'chaseVan') M.setupVan();
  if (step.type === 'stealGuarded') M.setupGuarded();
  if (step.type === 'spring') {
    G.law.heat = Math.max(G.law.heat, step.stars);
    G.law.lastCrimeAt = G.law.time;
    if (G.hud) G.hud.toast('IT IS A SETUP', 'Three stars. Run!');
    if (G.radio) G.radio.sfx('busted');
    M.advance();
  }
};
G.missions.advance = function () {
  var M = G.missions;
  M.stepI++;
  M.clearTarget();
  if (M.stepI >= M.active.steps.length) { M.complete(); return; }
  M.enterStep();
};
G.missions.complete = function () {
  var M = G.missions;
  var job = M.active;
  G.hero.cash += job.pay + (M.stepData && M.stepData.raceBonus ? M.stepData.raceBonus : 0);
  M.completed++;
  M.index++;
  M.active = null;
  M.clearTarget();
  G.districts.adjust(job.district, 10, 'Job done in ' + G.districtInfo(job.district).name + '.');
  if (G.radio) G.radio.sfx('jingle');
  var rank = M.rank();
  if (G.hud) G.hud.toast('JOB COMPLETE — ' + G.formatCash(job.pay), job.title + ' · Respect: ' + rank.name + (M.completed === 9 ? ' · THE CITY IS YOURS' : ''));
  if (M.completed === 2) {
    G.crew.callUnlocked = true;
    if (G.hud) G.hud.toast('RUNNER RESPECT', 'Dre will now bring you a getaway car — press G.');
  }
  if (M.completed === 4) {
    G.weapons.unlocked.smg = true;
    G.weapons.addAmmo('smg', 160);
    if (G.hud) G.hud.toast('FIXER RESPECT', 'SMG "Kestrel" unlocked — press 3. 160 rounds in the bag.');
  }
  if (M.completed >= 9 && !M.storyDone) {
    M.storyDone = true;
    if (G.events && G.events.onStoryComplete) G.events.onStoryComplete();
  }
  if (G.save) G.save.write();
};
G.missions.resetStep = function () {
  // after a bust or a hospital trip the current step restarts, nothing else is lost
  var M = G.missions;
  if (!M.active) return;
  if (M.race) { M.race = null; }
  if (M.van) { G.vehicles.remove(M.van); M.van = null; }
  M.enterStep();
  if (G.hud) G.hud.toast('BACK ON THE JOB', M.active.title + ' — pick it up where it broke.');
};
G.missions.onEnterCar = function (car) {
  var M = G.missions;
  if (!M.active) return;
  var step = M.active.steps[M.stepI];
  if ((step.type === 'steal' || step.type === 'stealGuarded') && M.stepData.car === car) {
    if (G.hud) G.hud.toast('WHEELS UP', 'Now get it to Kingpin Garage.');
    M.advance();
  }
};
G.onHostileDown = function (cit) {
  var M = G.missions;
  if (G.rng() < 0.55) G.weapons.spawnPickup(cit.x, cit.z, G.rng() < 0.5 ? 'cash' : (G.rng() < 0.5 ? 'health' : 'ammo'));
  if (M.active && M.stepData && M.stepData.hostiles) {
    M.hostilesLeft--;
    if (G.hud) G.hud.setObjective(M.active.title, M.active.steps[M.stepI].text, 'Hostiles left: ' + Math.max(0, M.hostilesLeft));
    if (M.hostilesLeft <= 0) M.advance();
  }
};

G.missions.setupRace = function () {
  var M = G.missions;
  var cps = [
    { x: -140, z: 160 }, { x: 0, z: 160 }, { x: 140, z: 160 }, { x: 262, z: 160 },
  ];
  var rival = G.vehicles.create(G.scene, 'sport', 0xf2b821, -262, 155.4, Math.PI / 2);
  rival.driver = 'rival';
  var playerCar = G.hero.inCar;
  M.race = { cps: cps, i: 0, rival: rival, rivalI: 0, started: false, count: 3.99, playerDone: false, rivalDone: false, time: 0 };
  M.setTarget(cps[0].x, cps[0].z, 0x2ee6c8);
  if (G.hud) {
    G.hud.setObjective('SOLMAR STREET RACE: BEACHFRONT DASH', 'STREET RACE — hit every checkpoint, beat Pico to the last one', 'Get ready…');
    G.hud.bigCenter('3');
  }
};
G.missions.setupShootout = function (step) {
  var M = G.missions;
  M.stepData.hostiles = true;
  M.hostilesLeft = step.count;
  for (var i = 0; i < step.count; i++) {
    G.citizens.spawn(step.x + G.rand(-14, 14), step.z + G.rand(-12, 12), 'hostile');
  }
  M.setTarget(step.x, step.z, 0xff5c39);
  if (G.hud) G.hud.setObjective(M.active.title, step.text, 'Hostiles left: ' + step.count);
};
G.missions.setupVan = function () {
  var M = G.missions;
  var van = G.vehicles.create(G.scene, 'armored', 0x5a6068, -266, -20, Math.PI / 2);
  van.driver = 'convoy';
  van.ai = { wp: [{ x: 266, z: -20 }, { x: 266, z: -186 }, { x: -266, z: -186 }, { x: -266, z: -20 }], wpi: 0 };
  M.van = van;
  M.stepData.vanStopped = false;
};
G.missions.setupGuarded = function () {
  var M = G.missions;
  var car = G.vehicles.create(G.scene, 'sport', 0xd84a2e, 245, 16, 0);
  car.driver = null;
  M.stepData.car = car;
  M.stepData.hostiles = false;
  for (var i = 0; i < 3; i++) G.citizens.spawn(245 + G.rand(-13, 13), 22 + G.rand(-6, 10), 'hostile');
  M.setTarget(245, 16, 0xd84a2e);
};

G.missions.update = function (dt) {
  var M = G.missions;
  var hero = G.hero;
  // free-roam pointer back to Marisol
  if (!M.active) {
    if (M.index < JOBS.length) {
      var nearClub = G.dist2d(hero.x, hero.z, CLUB.x, CLUB.z) < 7 && !hero.inCar;
      if (G.hud) {
        G.hud.setObjective(nearClub ? 'MARISOL VEGA' : 'FREE ROAM',
          nearClub ? 'Press F to take the next job' : 'See Marisol at the Solmar Social Club for work',
          M.completed + ' / 9 jobs · ' + M.rank().name);
        G.hud.prompt(nearClub ? '<b>F</b> — Talk to Marisol: ' + JOBS[M.index].title : null);
      }
      if (nearClub && G.input.fPressed) {
        var job = JOBS[M.index];
        if (G.events && G.events.showStory) G.events.showStory(job.title, job.intro, function () { M.start(M.index); });
        else M.start(M.index);
      }
    } else if (G.hud) {
      G.hud.setObjective('FREE ROAM', 'The city of Solmar is yours, Kingpin. The club, the garage and the beach are open.', '');
      G.hud.prompt(null);
    }
    M.clearTargetSoft();
    return;
  }
  var step = M.active.steps[M.stepI];
  var sub = '';
  // GPS route refresh
  M.routeTimer -= dt;
  if (M.target && M.routeTimer <= 0) {
    M.routeTimer = 1.6;
    M.route = G.world.findPath(hero.x, hero.z, M.target.x, M.target.z);
  }
  if (M.marker) {
    M.marker.material.opacity = 0.26 + Math.sin(performance.now() * 0.004) * 0.1;
    M.markerRing.rotation.z += dt * 0.8;
  }
  switch (step.type) {
    case 'goto': case 'pickup':
      if (G.dist2d(hero.x, hero.z, step.x, step.z) < step.r) M.advance();
      break;
    case 'pickupPerson':
      if (hero.inCar && G.dist2d(hero.x, hero.z, step.x, step.z) < step.r) {
        if (G.hud) G.hud.toast('MARISOL IS IN', 'She slides into the passenger seat. "Drive like you own it."');
        M.advance();
      } else sub = 'You need a car for this';
      break;
    case 'deliver':
      if (hero.inCar && G.dist2d(hero.x, hero.z, step.x, step.z) < step.r) M.advance();
      else if (!hero.inCar) sub = 'You need to be in a car';
      break;
    case 'timerGoto':
      M.stepData.timeLeft -= dt;
      sub = 'Time left: ' + Math.max(0, Math.ceil(M.stepData.timeLeft)) + 's';
      if (G.dist2d(hero.x, hero.z, step.x, step.z) < step.r) M.advance();
      else if (M.stepData.timeLeft <= 0) {
        M.stepData.timeLeft = step.time;
        if (G.hud) G.hud.toast('TOO SLOW', 'The package window reset — go again.');
      }
      break;
    case 'finaleRun':
      if (G.law.heat < 3.5) G.law.heat = 3.5; // the Condor does not lose you mid-run
      if (hero.inCar && G.dist2d(hero.x, hero.z, step.x, step.z) < step.r) M.advance();
      else sub = 'Stars ride with you — reach the marina';
      break;
    case 'escape':
      sub = 'Heat: ' + G.law.stars() + ' stars — break line of sight and stay hidden';
      if (G.law.stars() === 0) M.advance();
      break;
    case 'steal': case 'stealGuarded':
      sub = 'The marked car is on your minimap';
      break;
    case 'race': M.updateRace(dt); return;
    case 'shootout':
      sub = 'Hostiles left: ' + Math.max(0, M.hostilesLeft);
      break;
    case 'chaseVan': {
      var van = M.van;
      if (van) {
        M.setTargetSoft(van.x, van.z, 0xff5c39);
        if (!van.dead && van.health > van.maxHealth * 0.35) M.driveVan(dt, van);
        else if (!M.stepData.vanStopped) {
          M.stepData.vanStopped = true;
          van.driver = null;
          if (G.hud) G.hud.toast('VAN STOPPED', 'Grab the cage money from the van — on foot!');
          M.advance();
          return;
        }
      }
      break;
    }
    case 'lootVan':
      if (M.van && G.dist2d(hero.x, hero.z, M.van.x, M.van.z) < 5 && !hero.inCar) {
        G.hero.cash += 300;
        if (G.hud) G.hud.toast('+$300 CAGE MONEY', 'Half now — the rest on delivery.');
        M.advance();
      } else sub = 'On foot, at the van';
      break;
  }
  if (G.hud) G.hud.setObjective(M.active.title, step.text, sub);
};
G.missions.setTargetSoft = function (x, z, colorHex) {
  // like setTarget but for moving targets: no route recompute churn
  G.missions.buildMarker();
  G.missions.target = { x: x, z: z };
  G.missions.marker.visible = true;
  G.missions.markerRing.visible = true;
  G.missions.marker.position.x = x; G.missions.marker.position.z = z;
  G.missions.markerRing.position.x = x; G.missions.markerRing.position.z = z;
  if (colorHex) { G.missions.marker.material.color.setHex(colorHex); G.missions.markerRing.material.color.setHex(colorHex); }
};
G.missions.clearTargetSoft = function () {
  if (!G.missions.active && G.missions.marker) {
    G.missions.marker.visible = false;
    G.missions.markerRing.visible = false;
    G.missions.target = null;
    G.missions.route = [];
  }
};
G.missions.driveVan = function (dt, van) {
  var wp = van.ai.wp[van.ai.wpi];
  if (G.dist2d(van.x, van.z, wp.x, wp.z) < 12) van.ai.wpi = (van.ai.wpi + 1) % van.ai.wp.length;
  var want = Math.atan2(wp.x - van.x, wp.z - van.z);
  var diff = want - van.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  var spd = G.vehicles.speedOf(van);
  G.vehicles.drive(van, { throttle: spd < 11.5 ? 0.85 : 0, steer: G.clamp(diff * 1.7, -1, 1), handbrake: false }, dt);
};
G.missions.updateRace = function (dt) {
  var M = G.missions;
  var R = M.race;
  var hero = G.hero;
  if (!R) return;
  if (!R.started) {
    R.count -= dt;
    var n = Math.ceil(R.count);
    if (G.hud) G.hud.bigCenter(R.count > 0.99 ? String(n) : 'GO!');
    if (R.count <= 0) {
      R.started = true;
      if (G.radio) G.radio.sfx('go');
      setTimeout(function () { if (G.hud) G.hud.bigCenter(null); }, 650);
    } else if (G.radio && Math.abs(R.count - Math.round(R.count)) < dt) G.radio.sfx('race');
    // hold the rival until GO
    G.vehicles.drive(R.rival, { throttle: 0, steer: 0, handbrake: true }, dt);
    if (G.hud) G.hud.setObjective('SOLMAR STREET RACE: BEACHFRONT DASH', 'STREET RACE — hit every checkpoint, beat Pico', 'Starting…');
    return;
  }
  R.time += dt;
  // rival drives checkpoint to checkpoint
  if (!R.rivalDone) {
    var cp = R.cps[R.rivalI];
    if (G.dist2d(R.rival.x, R.rival.z, cp.x, cp.z) < 10) {
      R.rivalI++;
      if (R.rivalI >= R.cps.length) { R.rivalDone = true; }
    }
    if (!R.rivalDone) {
      var wp = R.cps[R.rivalI];
      var want = Math.atan2(wp.x - R.rival.x, wp.z - R.rival.z);
      var diff = want - R.rival.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      var spd = G.vehicles.speedOf(R.rival);
      G.vehicles.drive(R.rival, { throttle: spd < 23.5 ? 0.95 : 0.1, steer: G.clamp(diff * 1.8, -1, 1), handbrake: Math.abs(diff) > 2.4 }, dt);
    }
  }
  // player progress
  var mine = R.cps[R.i];
  var pos = R.rivalI > R.i || (R.rivalI === R.i && R.rivalDone) ? 2 : 1;
  if (hero.inCar && mine && G.dist2d(hero.x, hero.z, mine.x, mine.z) < 10) {
    R.i++;
    if (G.radio) G.radio.sfx('pickup');
    if (R.i >= R.cps.length) {
      R.playerDone = true;
      var won = !R.rivalDone;
      M.stepData.raceBonus = won ? (M.active.winBonus || 0) : 0;
      if (G.hud) G.hud.toast(won ? 'YOU WIN THE DASH!' : 'PICO TAKES THIS ONE', won ? 'Street race won — bonus ' + G.formatCash(M.stepData.raceBonus) + ' on top of the purse.' : 'The purse is still yours. His pride survives another week.');
      M.race = null;
      M.advance();
      return;
    }
    M.setTarget(R.cps[R.i].x, R.cps[R.i].z, 0x2ee6c8);
  }
  if (G.hud) G.hud.setObjective('SOLMAR STREET RACE: BEACHFRONT DASH',
    'STREET RACE — checkpoint ' + Math.min(R.i + 1, R.cps.length) + ' of ' + R.cps.length,
    'POS ' + pos + '/2 · ' + R.time.toFixed(1) + 's' + (hero.inCar ? '' : ' · GET IN A CAR'));
};
