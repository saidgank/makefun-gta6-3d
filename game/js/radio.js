// radio.js — every sound in Solmar is synthesized live: three radio
// stations with real step-sequenced loops, an engine that follows your
// speed, police sirens that swell as they close in, and one-shot effects.
G.radio = {
  ctx: null, muted: false, station: 0, radioPlaying: false,
  engineNodes: null, sirenNodes: null, seqTimer: 0, nextStepTime: 0, step: 0,
};
var STATIONS = [
  { name: 'SOLMAR FM · CHILLWAVE', bpm: 84, bass: [45, 0, 0, 45, 0, 0, 41, 0, 0, 41, 0, 0, 48, 0, 0, 43, 0, 0, 43, 0],
    chords: [[57, 60, 64, 67], [53, 57, 60, 65], [48, 52, 55, 59], [55, 59, 62, 65]], arp: null, drums: false },
  { name: 'BASSLINE 99.1 · CLUB', bpm: 122, bass: [38, 0, 38, 0, 41, 0, 38, 0, 36, 0, 36, 0, 43, 0, 41, 0],
    chords: null, arp: null, drums: true },
  { name: 'DRIFTWAVE · NIGHT DRIVE', bpm: 100, bass: [45, 0, 0, 0, 0, 0, 0, 0, 45, 0, 0, 0, 0, 0, 0, 0],
    chords: [[57, 60, 64], [55, 59, 62], [53, 57, 60], [52, 55, 59]],
    arp: [69, 72, 76, 79, 76, 72, 69, 72, 67, 71, 74, 79, 74, 71, 67, 71], drums: false },
];
G.radio.STATIONS = STATIONS;
function mf(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

G.radio.unlock = function () {
  if (G.radio.ctx) { if (G.radio.ctx.state === 'suspended') G.radio.ctx.resume(); return; }
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    G.radio.ctx = ctx;
    G.radio.master = ctx.createGain();
    G.radio.master.gain.value = 0.5;
    G.radio.master.connect(ctx.destination);
    G.radio.musicGain = ctx.createGain();
    G.radio.musicGain.gain.value = 0.36;
    G.radio.musicGain.connect(G.radio.master);
    G.radio.sfxGain = ctx.createGain();
    G.radio.sfxGain.gain.value = 0.8;
    G.radio.sfxGain.connect(G.radio.master);
  } catch (e) { G.radio.ctx = null; }
};
G.radio.toggleMute = function () {
  G.radio.muted = !G.radio.muted;
  if (G.radio.master) G.radio.master.gain.value = G.radio.muted ? 0 : 0.5;
  if (G.hud) G.hud.toast(G.radio.muted ? 'SOUND OFF' : 'SOUND ON', '');
};
function tone(freq, dur, type, gain, dest, when, slideTo) {
  var ctx = G.radio.ctx;
  if (!ctx) return;
  var t = when || ctx.currentTime;
  var o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest || G.radio.sfxGain);
  o.start(t); o.stop(t + dur + 0.02);
}
function noiseBurst(dur, gain, filterFreq, dest, when) {
  var ctx = G.radio.ctx;
  if (!ctx) return;
  var t = when || ctx.currentTime;
  var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  var buf = ctx.createBuffer(1, len, ctx.sampleRate);
  var data = buf.getChannelData(0);
  for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  var src = ctx.createBufferSource();
  src.buffer = buf;
  var f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = filterFreq;
  var g = ctx.createGain();
  g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(dest || G.radio.sfxGain);
  src.start(t);
}
G.radio.sfx = function (name) {
  if (!G.radio.ctx || G.radio.muted) return;
  // throttle: a multi-car pile-up must not stack hundreds of live nodes
  var now = G.radio.ctx.currentTime;
  G.radio.__sfxLast = G.radio.__sfxLast || {};
  var minGap = name === 'crash' ? 0.09 : 0.045;
  if (G.radio.__sfxLast[name] && now - G.radio.__sfxLast[name] < minGap) return;
  G.radio.__sfxLast[name] = now;
  switch (name) {
    case 'shot': noiseBurst(0.14, 0.5, 2600); tone(160, 0.1, 'square', 0.2, null, 0, 60); break;
    case 'smg': noiseBurst(0.08, 0.36, 3000); tone(190, 0.06, 'square', 0.14, null, 0, 70); break;
    case 'shotFar': noiseBurst(0.12, 0.13, 1200); break;
    case 'swing': noiseBurst(0.09, 0.1, 900); break;
    case 'punch': tone(95, 0.12, 'sine', 0.5, null, 0, 45); noiseBurst(0.06, 0.2, 700); break;
    case 'crash': noiseBurst(0.32, 0.55, 800); tone(70, 0.3, 'sine', 0.5, null, 0, 32); break;
    case 'pickup': tone(660, 0.09, 'sine', 0.3); tone(990, 0.14, 'sine', 0.3, null, G.radio.ctx.currentTime + 0.08); break;
    case 'click': tone(1200, 0.04, 'square', 0.12); break;
    case 'step': noiseBurst(0.03, 0.035, 500); break;
    case 'phone': tone(1046, 0.11, 'sine', 0.22); tone(1046, 0.11, 'sine', 0.22, null, G.radio.ctx.currentTime + 0.18); break;
    case 'jingle':
      var base = G.radio.ctx.currentTime;
      [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.22, 'triangle', 0.3, null, base + i * 0.11); });
      break;
    case 'busted': tone(392, 0.25, 'square', 0.2); tone(311, 0.4, 'square', 0.2, null, G.radio.ctx.currentTime + 0.22); break;
    case 'race': tone(880, 0.12, 'square', 0.25); break;
    case 'go': tone(1320, 0.3, 'square', 0.3); break;
  }
};
// ---- engine + siren loops ------------------------------------------------
G.radio.engineStart = function () {
  if (!G.radio.ctx || G.radio.engineNodes) return;
  var ctx = G.radio.ctx;
  var o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
  o1.type = 'sawtooth'; o2.type = 'square';
  var f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 420;
  var g = ctx.createGain();
  g.gain.value = 0.0;
  o1.connect(f); o2.connect(f); f.connect(g); g.connect(G.radio.master);
  o1.start(); o2.start();
  G.radio.engineNodes = { o1: o1, o2: o2, g: g, f: f };
};
G.radio.engineUpdate = function (speed, top) {
  var e = G.radio.engineNodes;
  if (!e) return;
  var r = G.clamp(Math.abs(speed) / (top || 34), 0, 1);
  var t = G.radio.ctx.currentTime;
  e.o1.frequency.setTargetAtTime(46 + r * 165, t, 0.06);
  e.o2.frequency.setTargetAtTime(23 + r * 84, t, 0.06);
  e.f.frequency.setTargetAtTime(320 + r * 900, t, 0.1);
  e.g.gain.setTargetAtTime(G.radio.muted ? 0 : 0.055 + r * 0.05, t, 0.1);
};
G.radio.engineStop = function () {
  var e = G.radio.engineNodes;
  if (!e) return;
  try { e.o1.stop(); e.o2.stop(); } catch (err) {}
  G.radio.engineNodes = null;
};
G.radio.sirenUpdate = function (nearestCopDist, stars) {
  if (!G.radio.ctx) return;
  var want = stars > 0 && nearestCopDist < 66;
  if (want && !G.radio.sirenNodes) {
    var ctx = G.radio.ctx;
    var o = ctx.createOscillator();
    o.type = 'triangle';
    var g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g); g.connect(G.radio.master);
    o.start();
    G.radio.sirenNodes = { o: o, g: g };
  }
  var s = G.radio.sirenNodes;
  if (!s) return;
  var t = G.radio.ctx.currentTime;
  if (!want) {
    s.g.gain.setTargetAtTime(0, t, 0.1);
    if (nearestCopDist > 90) { try { s.o.stop(); } catch (e) {} G.radio.sirenNodes = null; }
    return;
  }
  var phase = Math.floor(t * 1.6) % 2 === 0;
  s.o.frequency.setTargetAtTime(phase ? 700 : 950, t, 0.03);
  var vol = G.clamp(0.05 * (1 - nearestCopDist / 70) + 0.008, 0.008, 0.05);
  s.g.gain.setTargetAtTime(G.radio.muted ? 0 : vol, t, 0.15);
};
// ---- radio sequencer -------------------------------------------------------
G.radio.radioOn = function () {
  if (!G.radio.ctx) return;
  G.radio.radioPlaying = true;
  G.radio.nextStepTime = G.radio.ctx.currentTime + 0.06;
  G.radio.step = 0;
  G.radio.showStation();
};
G.radio.radioOff = function () { G.radio.radioPlaying = false; };
G.radio.nextStation = function () {
  G.radio.station = (G.radio.station + 1) % STATIONS.length;
  G.radio.showStation();
  if (G.radio.ctx && G.hero && G.hero.inCar) G.radio.radioOn();
};
G.radio.showStation = function () {
  if (G.hud) G.hud.radioToast('♪ ' + STATIONS[G.radio.station].name);
};
G.radio.update = function (dt) {
  var R = G.radio;
  if (!R.ctx || !R.radioPlaying || R.muted) return;
  if (!G.hero || !G.hero.inCar) return;
  var st = STATIONS[R.station];
  var stepDur = 60 / st.bpm / 2; // eighth notes
  // Resync instead of fast-forwarding: if the audio clock ran ahead while
  // frames were paused (hidden tab, long hitch), restart the bar from now
  // rather than trying to schedule every missed step in one frame.
  if (R.nextStepTime < R.ctx.currentTime - 0.25) {
    R.nextStepTime = R.ctx.currentTime + 0.06;
    R.step = 0;
  }
  var guard = 0;
  while (R.nextStepTime < R.ctx.currentTime + 0.14 && guard++ < 64) {
    var s = R.step % 16;
    var bar = Math.floor(R.step / 16);
    var when = R.nextStepTime;
    var bassNote = st.bass[s % st.bass.length];
    if (bassNote) tone(mf(bassNote), stepDur * 1.7, 'triangle', 0.5, R.musicGain, when);
    if (st.chords && s === 0) {
      var chord = st.chords[bar % st.chords.length];
      for (var i = 0; i < chord.length; i++) tone(mf(chord[i]), stepDur * 15, 'sine', 0.07, R.musicGain, when);
    }
    if (st.arp) {
      var a = st.arp[s % st.arp.length];
      var shift = st.chords ? (st.chords[bar % st.chords.length][0] - 57) : 0;
      tone(mf(a + shift), stepDur * 1.1, 'square', 0.055, R.musicGain, when);
    }
    if (st.drums) {
      if (s % 4 === 0) tone(120, 0.16, 'sine', 0.65, R.musicGain, when, 40);
      if (s % 4 === 2) noiseBurst(0.05, 0.16, 6000, R.musicGain, when);
      if (s % 2 === 1) noiseBurst(0.03, 0.07, 9000, R.musicGain, when);
    }
    R.nextStepTime += stepDur;
    R.step++;
  }
};
