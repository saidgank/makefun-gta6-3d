// save.js — the run persists in localStorage: cash, respect progress,
// district standings, ammo and where you left the story.
G.save = { key: 'solmar-heat-3d-save-v1' };

G.save.write = function () {
  try {
    var data = {
      cash: G.hero.cash,
      missionIndex: G.missions.index,
      completed: G.missions.completed,
      storyDone: G.missions.storyDone,
      standing: G.districts.standing,
      ammo: G.weapons.ammo,
      smg: G.weapons.unlocked.smg,
      callUnlocked: G.crew.callUnlocked,
      x: G.hero.x, z: G.hero.z,
    };
    localStorage.setItem(G.save.key, JSON.stringify(data));
  } catch (e) { /* storage unavailable: the run simply does not persist */ }
};
G.save.read = function () {
  try {
    var raw = localStorage.getItem(G.save.key);
    // a corrupt or hand-edited save throws in JSON.parse and lands in the
    // catch above as null, so Continue simply hides — never half-applied
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
};
G.save.apply = function (data) {
  if (!data) return false;
  G.hero.cash = data.cash || 0;
  G.missions.index = data.missionIndex || 0;
  G.missions.completed = data.completed || 0;
  G.missions.storyDone = !!data.storyDone;
  if (data.standing) G.districts.standing = data.standing;
  if (data.ammo) G.weapons.ammo = data.ammo;
  G.weapons.unlocked.smg = !!data.smg;
  G.crew.callUnlocked = !!data.callUnlocked;
  if (typeof data.x === 'number' && typeof data.z === 'number') G.hero.placeAt(data.x, data.z, Math.PI);
  return true;
};
G.save.clear = function () {
  try { localStorage.removeItem(G.save.key); } catch (e) {}
};
