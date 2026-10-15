// =====================================================================
//  소리: 효과음(합성) · 엔진 · 사이렌 · 도시 소음 · 비
//  라디오: 5개 방송국, 음악은 전부 실시간으로 만들어 냄 (저작권 있는 곡 없음)
// =====================================================================
'use strict';
(function(){
const U = G.U;
const A = G.audio = { on:true };
let ac = null, master, sfxBus, radioBus, ambBus, noiseBuf, radioLP;
A.init = ()=>{ if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ return; }
  master = ac.createGain(); master.gain.value = G.cfg.vol; const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; master.connect(comp); comp.connect(ac.destination);
  sfxBus = ac.createGain(); sfxBus.connect(master); ambBus = ac.createGain(); ambBus.gain.value = .5; ambBus.connect(master);
  radioLP = ac.createBiquadFilter(); radioLP.type = 'lowpass'; radioLP.frequency.value = 9000; radioBus = ac.createGain(); radioBus.gain.value = 0; radioBus.connect(radioLP); radioLP.connect(master);
  const n = ac.sampleRate*2; noiseBuf = ac.createBuffer(1, n, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random()*2 - 1;
  initEngine(); initAmb(); initSiren(); A.ready = true; };
A.setVol = v=>{ if (master) master.gain.value = v; };
const T = ()=>ac.currentTime;
function noise(dur, vol, type, freq, q, dest, when, fEnd){ const t = when || T(); const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ac.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(freq || 2000, t); if (fEnd) f.frequency.exponentialRampToValueAtTime(fEnd, t + dur); f.Q.value = q || 1; const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || sfxBus); s.start(t, Math.random()*1.5); s.stop(t + dur + .05); return g; }
function tone(type, f0, f1, dur, vol, dest, when, attack){ const t = when || T(); const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); const g = ac.createGain(); g.gain.setValueAtTime(attack ? .0001 : vol, t); if (attack) g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0005, t + dur); o.connect(g); g.connect(dest || sfxBus); o.start(t); o.stop(t + dur + .05); return o; }
// 거리 · 방향 → 볼륨 · 좌우
function spatial(x, z, maxD){ const c = G.camera; const dx = x - c.position.x, dz = z - c.position.z, d = Math.hypot(dx, dz); const v = Math.max(0, 1 - d/(maxD || 120)); const fw = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion); const rt = new THREE.Vector3(-fw.z, 0, fw.x); const pan = d > .5 ? U.clamp((dx*rt.x + dz*rt.z)/d, -1, 1) : 0; return { v:v*v, pan }; }
function panned(pan, vol){ const g = ac.createGain(); g.gain.value = vol; if (ac.createStereoPanner){ const p = ac.createStereoPanner(); p.pan.value = pan*.8; g.connect(p); p.connect(sfxBus); } else g.connect(sfxBus); return g; }

// ----- 총 -----
A.shot = (k, x, z, own)=>{ if (!A.ready) return; const s = own ? { v:1, pan:0 } : spatial(x, z, 220); if (s.v < .01) return; const out = panned(s.pan, s.v); const t = T();
  const big = k === 'shotgun' || k === 'sniper' || k === 'rpg'; const auto = k === 'smg' || k === 'rifle';
  noise(big ? .5 : auto ? .16 : .25, big ? .9 : .7, 'lowpass', big ? 3500 : 5000, .7, out, t, 300);
  noise(.05, .5, 'highpass', 3000, .5, out, t);
  tone('sine', big ? 120 : 160, 40, big ? .35 : .18, big ? .9 : .6, out, t);
  if (k === 'rpg'){ noise(1.2, .4, 'bandpass', 900, .6, out, t + .02, 300); }
  // 메아리
  if (!auto) noise(.7, .12, 'lowpass', 1200, .5, out, t + .12, 200); };
A.punch = hit=>{ if (!A.ready) return; noise(.12, hit ? .6 : .2, 'lowpass', hit ? 900 : 2500, 1); if (hit) tone('sine', 120, 50, .12, .5); };
A.sfx = k=>{ if (!A.ready) return; const t = T();
  if (k === 'empty') tone('square', 1800, 1200, .03, .15);
  else if (k === 'reload'){ noise(.05, .3, 'highpass', 2500, 1, null, t); noise(.06, .35, 'bandpass', 1800, 2, null, t + .35); noise(.05, .4, 'highpass', 3000, 1, null, t + .8); }
  else if (k === 'cash'){ [1318, 1760, 2093].forEach((f, i)=>tone('triangle', f, 0, .15, .15, null, t + i*.06)); }
  else if (k === 'pick'){ tone('triangle', 660, 1320, .15, .2); }
  else if (k === 'mission'){ [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i)=>tone('square', f, 0, .22, .08, null, t + i*.12)); [261, 392, 523].forEach(f=>tone('triangle', f, 0, 1.4, .12, null, t + .84)); }
  else if (k === 'fail'){ [440, 415, 392, 330].forEach((f, i)=>tone('sawtooth', f, 0, .35, .07, null, t + i*.25)); }
  else if (k === 'wasted'){ tone('sawtooth', 220, 55, 2.5, .25); tone('sine', 110, 30, 3, .4); noise(2.5, .2, 'lowpass', 400, 1); }
  else if (k === 'star'){ tone('square', 880, 0, .08, .1); tone('square', 660, 0, .1, .1, null, t + .09); }
  else if (k === 'checkpoint'){ tone('triangle', 988, 0, .12, .2); tone('triangle', 1318, 0, .18, .2, null, t + .1); }
  else if (k === 'ui') tone('sine', 900, 0, .05, .12);
  else if (k === 'land') noise(.3, .5, 'lowpass', 400, 1);
  else if (k === 'splash') noise(1, .5, 'bandpass', 1200, .5, null, t, 300);
  else if (k === 'thunder'){ noise(4, .8, 'lowpass', 300, 1, null, t, 40); noise(.3, .5, 'highpass', 2000, .5, null, t); }
  else if (k === 'scream'){ const o = tone('sawtooth', 700 + Math.random()*300, 500, .7, .05, null, t, .05); }
};
G.on('explosion', (x, y, z, pw)=>{ if (!A.ready) return; const s = spatial(x, z, 400); if (s.v < .01) return; const out = panned(s.pan, Math.min(1, s.v*1.5)); noise(2.4, 1, 'lowpass', 1400, .8, out, T(), 60); tone('sine', 90, 25, 1.4, 1, out); noise(.2, .6, 'highpass', 1500, .5, out); });
G.on('carCrash', (v, imp, x, z)=>{ if (!A.ready) return; const s = spatial(x, z, 90); const out = panned(s.pan, Math.min(1, s.v*imp*.08)); noise(.5, 1, 'lowpass', 2500, .8, out, T(), 200); noise(.25, .7, 'bandpass', 3500, 3, out); tone('triangle', 2400 + Math.random()*1200, 1800, .3, .15, out); });
G.on('carHit', (a, b, imp, x, z)=>{ if (!A.ready) return; const s = spatial(x, z, 90); const out = panned(s.pan, Math.min(1, s.v*imp*.08)); noise(.4, 1, 'lowpass', 2000, .8, out, T(), 150); tone('square', 300, 80, .15, .3, out); });
G.on('scream', p=>{ if (!A.ready) return; const s = spatial(p.x, p.z, 50); if (s.v < .05) return; const out = panned(s.pan, s.v*.6); const f = p.look.sex === 'Female' ? 900 : 520; const t = T(); const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f*1.3, t + .15); o.frequency.exponentialRampToValueAtTime(f*.7, t + .9);
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f*2.2; bp.Q.value = 3; const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.25, t + .05); g.gain.exponentialRampToValueAtTime(.001, t + 1); o.connect(bp); bp.connect(g); g.connect(out); o.start(t); o.stop(t + 1.05); });
G.on('horn', (v, own)=>{ if (!A.ready) return; const s = own ? { v:1, pan:0 } : spatial(v.x, v.z, 100); if (s.v < .02) return; const out = panned(s.pan, s.v*.35); const big = v.t.bus || v.t.key === 'van'; for (const f of big ? [280, 350] : [420, 530]) tone('square', f, 0, own ? .45 : .6, .3, out); });
G.on('thunder', ()=>A.sfx('thunder'));
G.on('carLand', (v, airT, imp)=>{ if (v.driver === 'player' && imp > 3) A.sfx('land'); });

// ----- 엔진 (내 차) -----
let eng = null;
function initEngine(){ const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain(); o1.type = 'sawtooth'; o2.type = 'square'; lp.type = 'lowpass'; lp.Q.value = 2; g.gain.value = 0;
  const ns = ac.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true; const nf = ac.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 600; const ng = ac.createGain(); ng.gain.value = 0;
  const sq = ac.createBufferSource(); sq.buffer = noiseBuf; sq.loop = true; const sf = ac.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 2200; sf.Q.value = 4; const sg = ac.createGain(); sg.gain.value = 0;
  o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(sfxBus); ns.connect(nf); nf.connect(ng); ng.connect(sfxBus); sq.connect(sf); sf.connect(sg); sg.connect(sfxBus); o1.start(); o2.start(); ns.start(); sq.start(); eng = { o1, o2, lp, g, ng, sg, gear:1, rpm:0 }; }
function updEngine(dt){ const P = G.player; const v = P.inCar ? P.car : null; const t = T();
  if (!v || v.dead){ eng.g.gain.setTargetAtTime(0, t, .1); eng.ng.gain.setTargetAtTime(0, t, .1); eng.sg.gain.setTargetAtTime(0, t, .05); return; }
  const sp = Math.abs(v.fwd), top = v.t.top; const gears = 5; const gw = top/gears; const gear = Math.min(gears - 1, Math.floor(sp/gw)); let frac = (sp - gear*gw)/gw; if (sp < 1) frac = v.thr > 0 ? .25 : 0;
  const rpm = U.clamp(.15 + frac*.8 + Math.abs(v.thr)*.1, 0, 1); eng.rpm = U.damp(eng.rpm, rpm, 10, dt);
  const big = v.t.key === 'muscle' || v.t.key === 'super' || v.t.key === 'sports'; const base = v.t.bus ? 30 : big ? 46 : 55;
  const f = base + eng.rpm*base*2.4; eng.o1.frequency.setTargetAtTime(f, t, .04); eng.o2.frequency.setTargetAtTime(f*.5, t, .04); eng.lp.frequency.setTargetAtTime(300 + eng.rpm*1600 + (v.thr > 0 ? 400 : 0), t, .05);
  eng.g.gain.setTargetAtTime(.06 + Math.abs(v.thr)*.08 + eng.rpm*.04, t, .05); eng.ng.gain.setTargetAtTime(Math.min(.12, sp*.004), t, .1);
  eng.sg.gain.setTargetAtTime(v.skidding ? .12 : 0, t, .05); }
// ----- 사이렌 -----
let sir = null;
function initSiren(){ const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain(), p = ac.createStereoPanner ? ac.createStereoPanner() : null; o.type = 'square'; lfo.frequency.value = .35; lg.gain.value = 350; o.frequency.value = 900; lfo.connect(lg); lg.connect(o.frequency); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2000; o.connect(f); f.connect(g); if (p){ g.connect(p); p.connect(sfxBus); } else g.connect(sfxBus); g.gain.value = 0; o.start(); lfo.start(); sir = { o, lfo, g, p }; }
function updSiren(){ let best = null, bd = 1e9; for (const v of G.veh.list){ if (!v.siren || v.dead) continue; const d = Math.hypot(v.x - G.camera.position.x, v.z - G.camera.position.z); if (d < bd){ bd = d; best = v; } }
  const t = T(); if (!best){ sir.g.gain.setTargetAtTime(0, t, .2); return; } const s = best.driver === 'player' ? { v:1, pan:0 } : spatial(best.x, best.z, 260); sir.g.gain.setTargetAtTime(s.v*.07, t, .1); if (sir.p) sir.p.pan.setTargetAtTime(s.pan*.7, t, .1); sir.lfo.frequency.value = G.wanted.level >= 3 ? 2.2 : .35; }
// 헬기 소리
let heliG = null; A.heli = h=>{ if (!A.ready) return; if (!heliG){ const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 250; const am = ac.createGain(); const lfo = ac.createOscillator(); lfo.frequency.value = 14; const lg = ac.createGain(); lg.gain.value = .5; lfo.connect(lg); lg.connect(am.gain); heliG = ac.createGain(); s.connect(f); f.connect(am); am.connect(heliG); heliG.connect(sfxBus); s.start(); lfo.start(); }
  const s = spatial(h.x, h.z, 300); heliG.gain.setTargetAtTime(h.dead ? 0 : s.v*.6, T(), .2); heliG._t = performance.now(); };
// ----- 도시 소음 · 비 -----
let amb = null;
function initAmb(){ const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; const g = ac.createGain(); g.gain.value = .05; s.connect(f); f.connect(g); g.connect(ambBus); s.start();
  const r = ac.createBufferSource(); r.buffer = noiseBuf; r.loop = true; const rf = ac.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1500; const rg = ac.createGain(); rg.gain.value = 0; r.connect(rf); rf.connect(rg); rg.connect(ambBus); r.start();
  const w = ac.createBufferSource(); w.buffer = noiseBuf; w.loop = true; const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = .5; const wg = ac.createGain(); wg.gain.value = 0; w.connect(wf); wf.connect(wg); wg.connect(ambBus); w.start();
  amb = { g, rg, wg, wf, birdT:3 }; }
function updAmb(dt){ const t = T(); const d = G.world.district(G.player.x, G.player.z); const city = d === 'down' || d === 'mid' ? 1 : d === 'hills' || d === 'park' ? .3 : .6;
  amb.g.gain.setTargetAtTime(.04*city*(1 - G.env.night*.5), t, 1); amb.rg.gain.setTargetAtTime(G.env.w.rain*.18, t, 1);
  const sp = G.player.inCar && G.player.car ? G.player.car.speed : 0; amb.wg.gain.setTargetAtTime(Math.min(.25, sp*sp*.00012), t, .3); amb.wf.frequency.setTargetAtTime(400 + sp*12, t, .3);
  // 새 · 먼 경적 · 먼 사이렌
  amb.birdT -= dt; if (amb.birdT <= 0){ amb.birdT = 3 + Math.random()*8; if (G.env.night < .5 && (d === 'park' || d === 'res' || d === 'rich' || d === 'hills')){ const f = 2500 + Math.random()*1500; for (let i = 0; i < 3; i++) tone('sine', f, f*1.3, .08, .03, ambBus, t + i*.12); }
    else if (city > .5 && Math.random() < .5){ const g = ac.createGain(); g.gain.value = .5; g.connect(ambBus); for (const f of [400, 500]) tone('square', f, 0, .35, .015, g); } } }
A.update = dt=>{ if (!A.ready) return; updEngine(dt); updSiren(); updAmb(dt); updRadio(dt); if (heliG && performance.now() - (heliG._t || 0) > 500) heliG.gain.setTargetAtTime(0, T(), .3); };

// =====================================================================
//  라디오
// =====================================================================
const STATIONS = [
  { name:'LUNA FM', genre:'팝', bpm:[116, 124], scale:'major', kit:'four', bass:'pump', lead:'square', pad:'saw', swing:0 },
  { name:'WEST COAST 99', genre:'힙합', bpm:[86, 94], scale:'minor', kit:'boombap', bass:'sub', lead:'keys', pad:'none', swing:.18 },
  { name:'NIGHT DRIVE', genre:'신스웨이브', bpm:[96, 106], scale:'minor', kit:'gated', bass:'octave', lead:'arp', pad:'saw', swing:0 },
  { name:'LO-FI CAFE', genre:'로파이', bpm:[72, 80], scale:'dorian', kit:'lofi', bass:'soft', lead:'keys', pad:'keys', swing:.22, vinyl:true },
  { name:'ROCK 101', genre:'록', bpm:[136, 148], scale:'minor', kit:'rock', bass:'pick', lead:'guitar', pad:'none', swing:0 },
];
A.STATIONS = STATIONS;
const SCALES = { major:[0, 2, 4, 5, 7, 9, 11], minor:[0, 2, 3, 5, 7, 8, 10], dorian:[0, 2, 3, 5, 7, 9, 10] };
const PROG = { major:[[0, 4, 5, 3], [0, 5, 3, 4], [5, 3, 0, 4], [0, 3, 4, 4]], minor:[[0, 5, 2, 6], [0, 3, 4, 4], [0, 6, 5, 6], [0, 5, 3, 4]], dorian:[[0, 3, 0, 3], [1, 4, 0, 6], [0, 3, 6, 4]] };
const R = { st:-1, song:null, next:0, step:0, out:null, songT:0, djT:0 };
A.radioStation = ()=>R.st;
A.setStation = i=>{ if (!A.ready) return; R.st = i; if (R.out){ R.out.gain.setTargetAtTime(0, T(), .05); const o = R.out; setTimeout(()=>o.disconnect(), 500); R.out = null; } if (i < 0) return;
  R.out = ac.createGain(); R.out.gain.value = .9; R.out.connect(radioBus); newSong(); R.next = T() + .1; R.step = 0; G.emit('radio', i); A.sfx('ui'); };
function mtof(m){ return 440*Math.pow(2, (m - 69)/12); }
function newSong(){ const S = STATIONS[R.st]; const rng = Math.random; const key = 45 + Math.floor(rng()*12); const sc = SCALES[S.scale];
  const progs = PROG[S.scale]; const prog = progs[Math.floor(rng()*progs.length)];
  // 멜로디: 2마디 모티프 반복 + 변형
  const motif = []; for (let i = 0; i < 16; i++){ motif.push(rng() < (S.lead === 'arp' ? 1 : .55) ? Math.floor(rng()*7) + (rng() < .2 ? 7 : 0) : null); }
  const bpm = S.bpm[0] + rng()*(S.bpm[1] - S.bpm[0]);
  R.song = { S, key, sc, prog, motif, bpm, bars:0, len:48 + Math.floor(rng()*24), fill:false }; R.songT = 0; }
function deg(song, d, oct){ const sc = song.sc; const o = Math.floor(d/7); const i = ((d%7) + 7)%7; return song.key + (oct || 0)*12 + o*12 + sc[i]; }
// 악기
function kick(t, v){ const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .4); o.connect(g); g.connect(R.out); o.start(t); o.stop(t + .45); }
function snare(t, v){ noise(.18, v*.6, 'bandpass', 1900, .8, R.out, t); tone('triangle', 220, 140, .1, v*.4, R.out, t); }
function hat(t, v, open){ noise(open ? .25 : .05, v*.25, 'highpass', 7500, .8, R.out, t); }
function clap(t, v){ for (let i = 0; i < 3; i++) noise(.06 + (i === 2 ? .12 : 0), v*.4, 'bandpass', 1500, 1.2, R.out, t + i*.012); }
function synth(t, f, dur, type, vol, cut, det, att){ const g = ac.createGain(); const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(cut*2, t); lp.frequency.exponentialRampToValueAtTime(cut, t + dur*.6); lp.Q.value = 2;
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (att || .01)); g.gain.setValueAtTime(vol, t + Math.max(att || .01, dur*.7)); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  for (const d of det ? [-det, det] : [0]){ const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + .05); }
  lp.connect(g); g.connect(R.out); }
let dist = null; function guitar(t, f, dur, vol){ if (!dist){ dist = ac.createWaveShaper(); const c = new Float32Array(1024); for (let i = 0; i < 1024; i++){ const x = i/512 - 1; c[i] = Math.tanh(x*6); } dist.curve = c; }
  const ws = ac.createWaveShaper(); ws.curve = dist.curve; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  for (const m of [1, 1.5, 2]){ const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f*m; o.detune.value = (Math.random() - .5)*10; o.connect(ws); o.start(t); o.stop(t + dur + .05); } ws.connect(lp); lp.connect(g); g.connect(R.out); }
function keys(t, f, dur, vol){ const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f; const o2 = ac.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f*2; const g2 = ac.createGain(); g2.gain.value = .25; o.connect(g); o2.connect(g2); g2.connect(g); g.connect(R.out); o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur); }
// 16분음표 하나 연주
function playStep(t, sp){ const song = R.song, S = song.S, step = R.step%16, bar = Math.floor(R.step/16); const beat = step/4; const chord = song.prog[bar%4];
  const sw = (step%2 === 1 ? S.swing*sp : 0); t += sw;
  const sec = song.bars < 4 ? 'intro' : (Math.floor(song.bars/8)%2 === 1 ? 'chorus' : 'verse'); const intro = sec === 'intro';
  // 드럼
  const k = S.kit;
  if (k === 'four'){ if (step%4 === 0) kick(t, .9); if (step === 4 || step === 12) clap(t, .7); if (step%4 === 2) hat(t, .7, true); else if (!intro) hat(t, .4); }
  else if (k === 'boombap'){ if (step === 0 || step === 7 || step === 10) kick(t, 1); if (step === 4 || step === 12) snare(t, .9); if (step%2 === 0) hat(t, step%4 === 0 ? .5 : .35); }
  else if (k === 'gated'){ if (step%8 === 0) kick(t, .9); if (step === 4 || step === 12){ snare(t, 1); noise(.35, .2, 'lowpass', 3000, .5, R.out, t); } if (step%2 === 0) hat(t, .35); }
  else if (k === 'lofi'){ if (step === 0 || step === 9) kick(t, .7); if (step === 4 || step === 12) snare(t, .5); if (step%2 === 0) hat(t, .25); }
  else if (k === 'rock'){ if (step === 0 || step === 8 || step === 10) kick(t, 1); if (step === 4 || step === 12) snare(t, 1); hat(t, step%2 ? .25 : .45); }
  if (intro && step === 0 && song.bars === 0) noise(1.2, .2, 'highpass', 4000, .5, R.out, t);
  // 베이스
  const root = deg(song, chord, -1); const bf = mtof(root);
  if (S.bass === 'pump' && step%2 === 0) synth(t, bf, sp*1.8, 'sawtooth', .16, 500, 6);
  if (S.bass === 'sub' && (step === 0 || step === 7 || step === 10)) synth(t, bf/2, sp*3.5, 'sine', .4, 300);
  if (S.bass === 'octave') synth(t, step%2 ? bf*2 : bf, sp*.9, 'sawtooth', .13, 900, 4);
  if (S.bass === 'soft' && (step === 0 || step === 8)) synth(t, bf, sp*6, 'triangle', .3, 600);
  if (S.bass === 'pick' && step%2 === 0) synth(t, bf, sp*1.6, 'sawtooth', .14, 700);
  // 코드 · 패드
  if (step === 0){ const ch = [0, 2, 4].map(i=>mtof(deg(song, chord + i, 0)));
    if (S.pad === 'saw') for (const f of ch) synth(t, f, sp*16, 'sawtooth', .035, 1400, 9, .3);
    if (S.pad === 'keys') for (const f of ch) keys(t, f, sp*14, .07);
    if (S.lead === 'guitar' && !intro) for (const f of ch.slice(0, 1)) guitar(t, f/2, sp*7, .08); }
  if (S.lead === 'guitar' && !intro && step === 8){ guitar(t, mtof(deg(song, chord, -1)), sp*7, .08); }
  if (S.lead === 'keys' && S.pad === 'none' && (step === 0 || step === 6 || step === 10)){ for (const i of [0, 2, 4]) keys(t, mtof(deg(song, chord + i, 0)), sp*4, .05); }
  // 멜로디
  if (!intro){ const m = song.motif[(step + (bar%2)*8)%16]; const play = sec === 'chorus' ? m !== null : (m !== null && step%2 === 0);
    if (play){ const d = chord + m + (sec === 'chorus' ? 7 : 0); const f = mtof(deg(song, d, 1));
      if (S.lead === 'square') synth(t, f, sp*1.8, 'square', .05, 2600, 5);
      if (S.lead === 'arp') synth(t, mtof(deg(song, chord + [0, 2, 4, 7][step%4], 1)), sp*.9, 'sawtooth', .045, 3000, 7);
      if (S.lead === 'keys' && S.pad !== 'none' && step%4 === 0) keys(t, f, sp*3, .06);
      if (S.lead === 'guitar' && sec === 'chorus' && step%4 === 2) synth(t, f, sp*3, 'sawtooth', .04, 1800, 12); } }
  if (S.vinyl && Math.random() < .3) noise(.01, .08, 'highpass', 3000, 1, R.out, t);
}
function updRadio(dt){
  const P = G.player; const inCar = P.inCar && P.car && !P.car.dead;
  radioBus.gain.setTargetAtTime(inCar && R.st >= 0 ? G.cfg.radioVol*.55 : 0, T(), .15);
  radioLP.frequency.setTargetAtTime(inCar ? 9000 : 600, T(), .2);
  if (!R.out || !R.song) return;
  // 스케줄러: 0.15초 앞까지
  const sp = 60/R.song.bpm/4;
  while (R.next < T() + .15){ playStep(R.next, sp); R.next += sp; R.step++; if (R.step%16 === 0){ R.song.bars++; if (R.song.bars >= R.song.len){ newSong(); R.step = 0; R.next += sp*4; djLine(); } } }
}
// 디제이 멘트 (브라우저 음성이 있으면)
const DJ = ['산 루나에서 제일 신나는 방송, {N}!', '지금 시각 {T}. 운전 조심하세요!', '교통 정보: 다운타운은 지금 꽉 막혔네요.', '{N}, 계속 들어 주세요!', '오늘도 경찰차 조심하시고요, 하하.', '신청곡은 안 받습니다. 그냥 들어요!'];
function djLine(){ if (!('speechSynthesis' in window) || R.st < 0 || Math.random() < .4) return; try { const u = new SpeechSynthesisUtterance(U.pick(DJ).replace('{N}', STATIONS[R.st].name).replace('{T}', G.env.clock())); u.lang = 'ko-KR'; u.rate = 1.15; u.pitch = 1.1; u.volume = G.cfg.radioVol*.8; speechSynthesis.speak(u); } catch(e){} }
A.horn = v=>{};
})();
