// hud.js — everything the player reads: cash, stars, district standing,
// health, weapon, objectives, toasts, and the round minimap with its
// district tints, GPS route and police blips.
G.hud = { els: {}, toastUntil: 0, radioUntil: 0, cache: {} };

G.hud.init = function () {
  var ids = ['hud', 'cash', 'respect', 'stars', 'district-name', 'standing-bar', 'standing-label',
    'health-bar', 'weapon', 'crew-status', 'speedo', 'objective-tag', 'objective', 'objective-sub',
    'prompt', 'crosshair', 'big-center', 'toast', 'toast-title', 'toast-sub', 'radio-toast',
    'damage-vignette', 'minimap'];
  ids.forEach(function (id) { G.hud.els[id] = document.getElementById(id); });
  G.hud.mm = G.hud.els.minimap.getContext('2d');
};
function setText(el, txt) {
  if (el && el.__last !== txt) { el.__last = txt; el.textContent = txt; }
}
G.hud.setObjective = function (tag, text, sub) {
  setText(G.hud.els['objective-tag'], tag || '');
  setText(G.hud.els.objective, text || '');
  setText(G.hud.els['objective-sub'], sub || '');
};
G.hud.prompt = function (html) {
  var el = G.hud.els.prompt;
  if (!el) return;
  if (!html) { el.classList.add('hidden'); el.__last = null; return; }
  if (el.__last !== html) { el.__last = html; el.innerHTML = html; }
  el.classList.remove('hidden');
};
G.hud.toast = function (title, sub) {
  var t = G.hud.els.toast;
  if (!t) return;
  setText(G.hud.els['toast-title'], title || '');
  setText(G.hud.els['toast-sub'], sub || '');
  t.classList.remove('hidden');
  G.hud.toastUntil = performance.now() + 3800;
};
G.hud.radioToast = function (text) {
  setText(G.hud.els['radio-toast'], text);
  G.hud.radioUntil = performance.now() + 2800;
};
G.hud.districtFlash = function (id) {
  var info = G.districtInfo(id);
  G.hud.radioToast('— ' + info.name + ' · STANDING ' + Math.round(G.districts.standing[id]) + ' —');
};
G.hud.bigCenter = function (text) {
  var el = G.hud.els['big-center'];
  if (!el) return;
  if (!text) { el.classList.add('hidden'); return; }
  setText(el, text);
  el.classList.remove('hidden');
};
G.hud.damagePulse = function () {
  if (G.hud.els['damage-vignette']) G.hud.els['damage-vignette'].style.opacity = 0.9;
};
G.hud.weaponChanged = function () { G.hud.cache.weapon = null; };

G.hud.update = function (dt) {
  var els = G.hud.els, hero = G.hero, C = G.hud.cache;
  if (!els.cash) return;
  var cashTxt = G.formatCash(hero.cash);
  if (C.cash !== cashTxt) { C.cash = cashTxt; els.cash.innerHTML = cashTxt + ' <small>SOLMAR</small>'; }
  var rank = G.missions.rank();
  var rankTxt = '★ ' + rank.name + ' · ' + G.missions.completed + '/9 JOBS';
  if (C.rank !== rankTxt) { C.rank = rankTxt; setText(els.respect, rankTxt); }
  var stars = G.law.stars();
  if (C.stars !== stars) {
    C.stars = stars;
    var html = '';
    for (var i = 0; i < 5; i++) html += '<span class="' + (i < stars ? 'lit' : '') + '">★</span>';
    els.stars.innerHTML = html;
  }
  var dId = G.districts.current;
  var dInfo = G.districtInfo(dId);
  var dTxt = dInfo.name;
  if (C.district !== dTxt) { C.district = dTxt; setText(els['district-name'], dTxt); }
  var stand = Math.round(G.districts.standing[dId]);
  els['standing-bar'].style.width = stand + '%';
  setText(els['standing-label'], 'DISTRICT STANDING ' + stand);
  els['health-bar'].style.width = G.clamp(hero.health, 0, 100) + '%';
  var def = G.weapons.DEFS[G.weapons.current];
  var wTxt = def.name + (G.weapons.current === 'fists' ? '' : ' · <small>' + G.weapons.ammo[G.weapons.current] + ' ROUNDS</small>');
  if (C.weapon !== wTxt) { C.weapon = wTxt; els.weapon.innerHTML = wTxt; }
  var crewTxt = 'DRE · CREW';
  if (G.crew.callUnlocked) crewTxt += G.crew.callCooldown > 0 ? ' · GETAWAY ' + Math.ceil(G.crew.callCooldown) + 's' : ' · GETAWAY READY (G)';
  else crewTxt += ' · GETAWAY AT RUNNER RANK';
  if (G.law.bustMeter > 0.03) crewTxt = '⚠ BUSTED IN ' + (1.9 * (1 - G.law.bustMeter)).toFixed(1) + 's — MOVE!';
  setText(els['crew-status'], crewTxt);
  if (hero.inCar) {
    var kmh = Math.round(Math.abs(G.vehicles.speedOf(hero.inCar)) * 3.6);
    var spdTxt = kmh + ' <small>KM/H</small>';
    if (C.speedo !== spdTxt) { C.speedo = spdTxt; els.speedo.innerHTML = spdTxt; }
  } else if (C.speedo !== '') { C.speedo = ''; els.speedo.innerHTML = ''; }
  els.crosshair.classList.toggle('hidden', !!hero.inCar);
  var now = performance.now();
  if (G.hud.toastUntil && now > G.hud.toastUntil) { els.toast.classList.add('hidden'); G.hud.toastUntil = 0; }
  if (G.hud.radioUntil && now > G.hud.radioUntil) { setText(els['radio-toast'], ''); G.hud.radioUntil = 0; }
  var vig = els['damage-vignette'];
  var vo = parseFloat(vig.style.opacity || 0);
  if (vo > 0) vig.style.opacity = Math.max(0, vo - dt * 1.6);
  if (G.law.bustMeter > 0.03) G.hud.prompt('⚠ <b>BUSTED</b> — BREAK FREE!');
  G.hud.drawMinimap();
};

G.hud.drawMinimap = function () {
  var ctx = G.hud.mm;
  if (!ctx) return;
  var S = 218, C = S / 2;
  var scale = S / 700;
  function mx(x) { return C + x * scale; }
  function mz(z) { return C + (z + 25) * scale; }
  ctx.clearRect(0, 0, S, S);
  // district tints + water
  for (var i = 0; i < G.districts.list.length; i++) {
    var d = G.districts.list[i];
    var r = G.districtRect(d.id);
    ctx.fillStyle = d.tint;
    ctx.fillRect(mx(r.minX), mz(r.minZ), (r.maxX - r.minX) * scale, (r.maxZ - r.minZ) * scale);
  }
  ctx.fillStyle = 'rgba(40,110,150,0.85)';
  ctx.fillRect(0, mz(G.WORLD.waterZ), S, S - mz(G.WORLD.waterZ));
  ctx.fillStyle = 'rgba(230,201,143,0.9)';
  ctx.fillRect(0, mz(G.WORLD.beachZ), S, mz(G.WORLD.waterZ) - mz(G.WORLD.beachZ));
  // district names
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '700 8.5px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('DOWNTOWN', mx(0), mz(-150));
  ctx.fillText('SUBURBS', mx(-232), mz(-60));
  ctx.fillText('THE DOCKS', mx(232), mz(-60));
  ctx.fillText('BEACHFRONT', mx(0), mz(120));
  // roads
  ctx.strokeStyle = 'rgba(230,230,235,0.5)';
  ctx.lineWidth = 2.4;
  var W = G.WORLD, i;
  for (i = 0; i < W.streetsX.length; i++) {
    ctx.beginPath(); ctx.moveTo(mx(W.streetsX[i]), mz(W.minZ)); ctx.lineTo(mx(W.streetsX[i]), mz(W.maxZ)); ctx.stroke();
  }
  for (i = 0; i < W.avenuesZ.length; i++) {
    ctx.beginPath(); ctx.moveTo(mx(W.minX), mz(W.avenuesZ[i])); ctx.lineTo(mx(W.maxX), mz(W.avenuesZ[i])); ctx.stroke();
  }
  // landmarks
  function landmarkDot(x, z, color, label) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(mx(x), mz(z), 3, 0, 6.29); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 7.5px Arial';
    ctx.fillText(label, mx(x), mz(z) - 5);
  }
  landmarkDot(G.world.landmarks.club.x, 148, '#ff7ab0', 'CLUB');
  landmarkDot(G.world.landmarks.garage.x, 148, '#7ad1ff', 'GARAGE');
  landmarkDot(G.world.landmarks.police.x, -92, '#5c7aff', 'SPD');
  landmarkDot(G.world.landmarks.hospital.x, 28, '#ff5c5c', 'HOSP');
  // GPS route + objective
  var M = G.missions;
  if (M.target) {
    if (M.route && M.route.length) {
      ctx.strokeStyle = '#ffd76a';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(mx(G.hero.x), mz(G.hero.z));
      for (i = 0; i < M.route.length; i++) ctx.lineTo(mx(M.route[i].x), mz(M.route[i].z));
      ctx.stroke();
    }
    var pulse = 4.6 + Math.sin(performance.now() * 0.006) * 1.4;
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.arc(mx(M.target.x), mz(M.target.z), pulse, 0, 6.29); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(mx(M.target.x), mz(M.target.z), pulse, 0, 6.29); ctx.stroke();
  }
  // police blips (flashing) + helicopter
  var flash = Math.floor(performance.now() / 320) % 2 === 0;
  for (i = 0; i < G.law.police.length; i++) {
    var p = G.law.police[i];
    ctx.fillStyle = flash ? '#ff3b30' : '#2a5cff';
    ctx.beginPath(); ctx.arc(mx(p.x), mz(p.z), 3.1, 0, 6.29); ctx.fill();
  }
  for (i = 0; i < G.law.officers.length; i++) {
    var o = G.law.officers[i];
    if (o.dead) continue;
    ctx.fillStyle = '#2a5cff';
    ctx.beginPath(); ctx.arc(mx(o.x), mz(o.z), 2.2, 0, 6.29); ctx.fill();
  }
  if (G.law.heli) {
    var hp = G.law.heli.group.position;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 9px Arial';
    ctx.fillText('H', mx(hp.x), mz(hp.z) + 3);
  }
  // crew + getaway
  ctx.fillStyle = '#2ee6c8';
  ctx.beginPath(); ctx.arc(mx(G.crew.x), mz(G.crew.z), 2.6, 0, 6.29); ctx.fill();
  if (G.crew.getaway) {
    ctx.fillStyle = '#ff4ad8';
    ctx.beginPath(); ctx.arc(mx(G.crew.getaway.x), mz(G.crew.getaway.z), 3.4, 0, 6.29); ctx.fill();
  }
  // player arrow
  var px = mx(G.hero.x), pz = mz(G.hero.z);
  var ang = Math.atan2(Math.sin(G.hero.camYaw), -Math.cos(G.hero.camYaw));
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(-G.hero.camYaw + Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(4.6, 5.4); ctx.lineTo(0, 2.6); ctx.lineTo(-4.6, 5.4);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
};
