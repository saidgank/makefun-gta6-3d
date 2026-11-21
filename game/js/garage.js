// garage.js — Kingpin Garage on the beachfront strip: drive in with a
// wreck, drive out with a respray. Prices bend for a friendly Beachfront.
G.garage = { promptShown: false };

G.garage.update = function (dt) {
  if (!G.world.landmarks.garage || !G.world.landmarks.garage.zone) return;
  var zone = G.world.landmarks.garage.zone;
  var hero = G.hero;
  var inZone = hero.inCar && G.dist2d(hero.x, hero.z, zone.x, zone.z) < zone.r;
  if (!inZone) { G.garage.promptShown = false; return; }
  var car = hero.inCar;
  var price = G.districts.garagePrice(110);
  var hurt = car.health < car.maxHealth - 1;
  if (G.hud && !G.missions.active) {
    G.hud.prompt(hurt
      ? '<b>F</b> — Kingpin Garage: full repair + respray, ' + G.formatCash(price)
      : '<b>F</b> — Kingpin Garage: respray, ' + G.formatCash(price) + ' (car is clean)');
  }
  G.garage.promptShown = true;
  if (G.input.fPressed) {
    if (hero.cash < price) {
      if (G.hud) G.hud.toast('NOT ENOUGH CASH', 'The garage does not run tabs. Come back with ' + G.formatCash(price) + '.');
      return;
    }
    hero.cash -= price;
    car.health = car.maxHealth;
    car.dead = false;
    var colors = [0xc23b2e, 0x2e5fc2, 0x3fae6a, 0xe08a2e, 0x8a1a6e, 0xd8d8d8, 0x14151c, 0x2ee6c8];
    var nc = G.pick(colors);
    car.mesh.traverse(function (o) {
      if (o.material && o.material.color && o.geometry && o.geometry.type === 'BoxGeometry' && o.position.y > 0.9 && o.position.y < 1.05) {
        o.material = new THREE.MeshLambertMaterial({ color: nc });
      }
    });
    // repaint the main body shell: the biggest box in the group
    var biggest = null, bv = 0;
    car.mesh.traverse(function (o) {
      if (o.isMesh && o.geometry && o.geometry.parameters) {
        var v = (o.geometry.parameters.width || 0) * (o.geometry.parameters.height || 0) * (o.geometry.parameters.depth || 0);
        if (v > bv) { bv = v; biggest = o; }
      }
    });
    if (biggest) biggest.material = new THREE.MeshLambertMaterial({ color: nc });
    car.color = nc;
    if (G.radio) G.radio.sfx('jingle');
    if (G.hud) G.hud.toast('GARAGE: DONE', 'Repaired and resprayed. She looks illegal again.');
    if (G.save) G.save.write();
  }
};
