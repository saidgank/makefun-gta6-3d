// districts.js — Solmar's four districts and the standing system the
// leaderboard's top entries made famous: every district remembers what you
// did there. Jobs completed in a district raise its standing; heat raised
// there burns it. Standing shows on the HUD and tints the minimap.
G.districts = {
  list: [
    { id: 'DOWNTOWN', name: 'DOWNTOWN', color: '#7a86b8', tint: 'rgba(90,105,170,0.30)' },
    { id: 'BEACHFRONT', name: 'BEACHFRONT', color: '#e8a85c', tint: 'rgba(232,168,92,0.30)' },
    { id: 'DOCKS', name: 'THE DOCKS', color: '#8a7a9a', tint: 'rgba(138,122,154,0.32)' },
    { id: 'SUBURBS', name: 'SUBURBS', color: '#7aa85e', tint: 'rgba(110,160,90,0.30)' },
  ],
  standing: { DOWNTOWN: 50, BEACHFRONT: 55, DOCKS: 45, SUBURBS: 50 },
  current: 'BEACHFRONT',
};

G.districtAt = function (x, z) {
  if (z >= 92) return 'BEACHFRONT';
  if (x < -150) return 'SUBURBS';
  if (x > 150) return 'DOCKS';
  return 'DOWNTOWN';
};
G.districtInfo = function (id) {
  for (var i = 0; i < G.districts.list.length; i++) if (G.districts.list[i].id === id) return G.districts.list[i];
  return G.districts.list[0];
};
// The rectangle each district owns, for minimap tinting and labels.
G.districtRect = function (id) {
  var W = G.WORLD;
  if (id === 'BEACHFRONT') return { minX: W.minX, maxX: W.maxX, minZ: 92, maxZ: W.maxZ };
  if (id === 'SUBURBS') return { minX: W.minX, maxX: -150, minZ: W.minZ, maxZ: 92 };
  if (id === 'DOCKS') return { minX: 150, maxX: W.maxX, minZ: W.minZ, maxZ: 92 };
  return { minX: -150, maxX: 150, minZ: W.minZ, maxZ: 92 };
};
G.districts.adjust = function (id, delta, reason) {
  var before = G.districts.standing[id];
  G.districts.standing[id] = G.clamp(before + delta, 0, 100);
  if (Math.abs(delta) >= 3 && G.hud) {
    G.hud.toast((delta > 0 ? '▲ ' : '▼ ') + G.districtInfo(id).name + ' STANDING ' +
      Math.round(G.districts.standing[id]), reason || (delta > 0 ? 'The district respects the work.' : 'The district felt that one.'));
  }
};
// Effects read by other systems: friendly districts hide you faster and the
// garage gives its home district a discount; hostile districts call it in.
G.districts.hideFactor = function (id) {
  var s = G.districts.standing[id];
  return s >= 65 ? 1.6 : (s <= 30 ? 0.65 : 1);
};
G.districts.garagePrice = function (base) {
  var s = G.districts.standing.BEACHFRONT;
  return s >= 65 ? Math.round(base * 0.6) : base;
};
G.districts.update = function (px, pz) {
  var d = G.districtAt(px, pz);
  if (d !== G.districts.current) {
    G.districts.current = d;
    if (G.hud) G.hud.districtFlash(d);
  }
};
