// 로켓 카트 브라우저: 화면 그리기 · 입력 보내기 · 내 차 예측 (판정은 서버가 해요)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const RK = window.RK;
const { DT, C } = RK;
const $ = id => document.getElementById(id);
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
const store = {
  get(k, d) { try { const v = localStorage.getItem('rk_' + k); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('rk_' + k, v); } catch (e) {} }
};
let quality = store.get('q', isTouch ? 'low' : 'high');
let soundOn = store.get('snd', '1') === '1';
const TRACKS = RK.TRACKS.map(() => null);
const getTrack = i => TRACKS[i] || (TRACKS[i] = RK.buildTrack(RK.TRACKS[i]));

// ── 렌더러 ─────────────────────────────────────────────────
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.3, 7000);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
let composer = null, bloom = null;
function setupPost() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.75 : 1));
  if (quality === 'high') {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 0.82);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  } else { composer = null; bloom = null; }
  resize();
}
const fxc = $('fx'), fx2 = fxc.getContext('2d');
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  if (composer) composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  fxc.width = w; fxc.height = h;
}
addEventListener('resize', resize);
setupPost();

// ── 작은 도구 ───────────────────────────────────────────────
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
const hex = c => '#' + c.toString(16).padStart(6, '0');
const lerp = (a, b, t) => a + (b - a) * t;
const lerpA = (a, b, t) => a + RK.wrapA(b - a) * t;
const _f = {}, _o = {};
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
const _m = new THREE.Matrix4();
function basis(m, px, py, pz, fx, fy, fz, ux, uy, uz) {
  _z.set(-fx, -fy, -fz).normalize(); _y.set(ux, uy, uz);
  _x.crossVectors(_y, _z).normalize(); _y.crossVectors(_z, _x);
  m.makeBasis(_x, _y, _z); m.setPosition(px, py, pz); return m;
}
function onTrack(T, s, lat, up, o) {
  const f = RK.frame(T, s, _f);
  o = o || {};
  o.x = f.px + f.rx * lat + f.ux * up; o.y = f.py + f.ry * lat + f.uy * up; o.z = f.pz + f.rz * lat + f.uz * up;
  o.fx = f.tx; o.fy = f.ty; o.fz = f.tz; o.ux = f.ux; o.uy = f.uy; o.uz = f.uz; o.rx = f.rx; o.ry = f.ry; o.rz = f.rz; o.w = f.w;
  return o;
}

// ── 빛 ──────────────────────────────────────────────────
const hemi = new THREE.HemisphereLight(0xb8a8ff, 0x201030, 0.8);
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(300, 500, 200);
scene.add(hemi, sun);

// ── 파티클 ───────────────────────────────────────────────
class Particles {
  constructor(max) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.life = new Float32Array(max); this.age = new Float32Array(max);
    this.drag = new Float32Array(max); this.grav = new Float32Array(max); this.alpha = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.base = new Float32Array(max);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
      vertexShader: `attribute float size;attribute float alpha;attribute vec3 color;varying vec3 vC;varying float vA;uniform float uScale;
        void main(){vC=color;vA=alpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*uScale/max(1.,-mv.z);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying vec3 vC;varying float vA;void main(){vec2 d=gl_PointCoord-.5;float r=dot(d,d)*4.;if(r>1.)discard;float a=(1.-r);a*=a;gl_FragColor=vec4(vC*a*vA*1.6,a*vA);}`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false;
    scene.add(this.pts);
  }
  spawn(x, y, z, vx, vy, vz, life, size, r, g, b, drag = 1.5, grav = 0) {
    let i = this.n < this.max ? this.n++ : (Math.random() * this.max) | 0;
    const k = i * 3;
    this.p[k] = x; this.p[k + 1] = y; this.p[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.col[k] = r; this.col[k + 1] = g; this.col[k + 2] = b;
    this.base[i] = size; this.size[i] = size; this.life[i] = life; this.age[i] = 0; this.drag[i] = drag; this.grav[i] = grav; this.alpha[i] = 1;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {   // 마지막 것과 바꿔요
        const j = --this.n;
        if (i !== j) {
          for (let a = 0; a < 3; a++) { this.p[i * 3 + a] = this.p[j * 3 + a]; this.vel[i * 3 + a] = this.vel[j * 3 + a]; this.col[i * 3 + a] = this.col[j * 3 + a]; }
          this.base[i] = this.base[j]; this.life[i] = this.life[j]; this.age[i] = this.age[j]; this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j];
          i--;
        }
        continue;
      }
      const k = i * 3, d = Math.exp(-this.drag[i] * dt);
      this.vel[k] *= d; this.vel[k + 1] = this.vel[k + 1] * d - this.grav[i] * dt; this.vel[k + 2] *= d;
      this.p[k] += this.vel[k] * dt; this.p[k + 1] += this.vel[k + 1] * dt; this.p[k + 2] += this.vel[k + 2] * dt;
      const t = this.age[i] / this.life[i];
      this.alpha[i] = 1 - t; this.size[i] = this.base[i] * (1 + t * 0.8);
    }
    const g = this.pts.geometry;
    g.setDrawRange(0, this.n);
    for (const a of ['position', 'color', 'size', 'alpha']) g.attributes[a].needsUpdate = true;
    this.mat.uniforms.uScale.value = innerHeight * renderer.getPixelRatio() * 0.9;
  }
}
const parts = new Particles(quality === 'high' ? 6000 : 2500);

// ── 소리 (직접 합성) ─────────────────────────────────────────
const Snd = {
  ac: null,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ac = this.ac = new AC();
    this.master = ac.createGain(); this.master.gain.value = soundOn ? 0.55 : 0; this.master.connect(ac.destination);
    // 엔진
    this.eg = ac.createGain(); this.eg.gain.value = 0;
    this.ef = ac.createBiquadFilter(); this.ef.type = 'lowpass'; this.ef.frequency.value = 900;
    this.o1 = ac.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = ac.createOscillator(); this.o2.type = 'square';
    this.o1.connect(this.ef); this.o2.connect(this.ef); this.ef.connect(this.eg); this.eg.connect(this.master);
    this.o1.start(); this.o2.start();
    // 잡음
    const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = nb;
    this.dn = ac.createBufferSource(); this.dn.buffer = nb; this.dn.loop = true;
    this.df = ac.createBiquadFilter(); this.df.type = 'bandpass'; this.df.frequency.value = 2600; this.df.Q.value = 3;
    this.dg = ac.createGain(); this.dg.gain.value = 0;
    this.dn.connect(this.df); this.df.connect(this.dg); this.dg.connect(this.master); this.dn.start();
    // 바람 (부스트)
    this.wn = ac.createBufferSource(); this.wn.buffer = nb; this.wn.loop = true;
    this.wf = ac.createBiquadFilter(); this.wf.type = 'lowpass'; this.wf.frequency.value = 700;
    this.wg = ac.createGain(); this.wg.gain.value = 0;
    this.wn.connect(this.wf); this.wf.connect(this.wg); this.wg.connect(this.master); this.wn.start();
    this.music = new Music(ac, this.master);
  },
  engine(v, boost, drift) {
    if (!this.ac) return;
    const t = this.ac.currentTime, sp = Math.abs(v) / C.MAXV;
    this.o1.frequency.setTargetAtTime(55 + sp * 150 + (boost ? 40 : 0), t, 0.05);
    this.o2.frequency.setTargetAtTime(27.5 + sp * 75 + (boost ? 20 : 0), t, 0.05);
    this.ef.frequency.setTargetAtTime(500 + sp * 1600 + (boost ? 1200 : 0), t, 0.05);
    this.eg.gain.setTargetAtTime(0.05 + sp * 0.05, t, 0.1);
    this.dg.gain.setTargetAtTime(drift ? 0.07 : 0, t, 0.05);
    this.wg.gain.setTargetAtTime(boost ? 0.22 : sp * 0.04, t, 0.08);
  },
  silence() { if (!this.ac) return; const t = this.ac.currentTime; this.eg.gain.setTargetAtTime(0, t, 0.1); this.dg.gain.setTargetAtTime(0, t, 0.05); this.wg.gain.setTargetAtTime(0, t, 0.1); },
  tone(f, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
    if (!this.ac) return;
    const ac = this.ac, t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  burst(dur, freq, vol = 0.3, type = 'lowpass', delay = 0) {
    if (!this.ac) return;
    const ac = this.ac, t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.2), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  },
  play(k) {
    switch (k) {
      case 'beep': this.tone(440, 0.25, 'square', 0.12); break;
      case 'go': this.tone(880, 0.6, 'square', 0.14); this.tone(1320, 0.6, 'sine', 0.1); break;
      case 'boost': this.burst(0.9, 3000, 0.35); this.tone(200, 0.6, 'sawtooth', 0.08, 3); break;
      case 'mini': this.tone(1200, 0.15, 'triangle', 0.12, 1.5); this.burst(0.5, 2500, 0.2); break;
      case 'box': this.tone(660, 0.08, 'square', 0.08); this.tone(990, 0.12, 'square', 0.08, 1, 0.07); break;
      case 'roll': this.tone(500 + Math.random() * 600, 0.04, 'square', 0.04); break;
      case 'get': this.tone(784, 0.12, 'triangle', 0.15); this.tone(1175, 0.2, 'triangle', 0.15, 1, 0.1); break;
      case 'fire': this.burst(0.5, 4000, 0.3, 'highpass'); this.tone(300, 0.4, 'sawtooth', 0.08, 0.3); break;
      case 'boom': this.burst(1.1, 1600, 0.6); this.tone(80, 0.7, 'sine', 0.4, 0.4); break;
      case 'hit': this.burst(0.7, 1200, 0.5); this.tone(300, 0.6, 'square', 0.12, 0.25); break;
      case 'wall': this.burst(0.15, 2500, 0.18); break;
      case 'bump': this.tone(120, 0.12, 'square', 0.1, 0.6); break;
      case 'land': this.burst(0.2, 600, 0.25); break;
      case 'shield': this.tone(400, 0.5, 'sine', 0.15, 2.5); break;
      case 'pop': this.tone(1500, 0.3, 'triangle', 0.15, 0.3); break;
      case 'emp': this.tone(60, 1.2, 'sawtooth', 0.25, 6); this.burst(1.2, 6000, 0.3, 'highpass'); break;
      case 'drop': this.tone(220, 0.15, 'square', 0.1, 0.5); break;
      case 'lap': [523, 659, 784].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.14, 1, i * 0.09)); break;
      case 'fin': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.28, 'square', 0.1, 1, i * 0.12)); break;
      case 'trick': this.tone(900, 0.18, 'triangle', 0.12, 1.6); break;
      case 'nitro': this.burst(1.6, 5000, 0.55); this.tone(90, 1.4, 'sawtooth', 0.18, 6); this.tone(180, 1.2, 'square', 0.08, 4, 0.05); break;
      case 'ready': [660, 880, 1320].forEach((f, i) => this.tone(f, 0.16, 'square', 0.1, 1, i * 0.07)); break;
      case 'near': this.burst(0.35, 6000, 0.25, 'highpass'); this.tone(1400, 0.2, 'triangle', 0.08, 0.6); break;
      case 'draft': this.tone(500, 0.5, 'sawtooth', 0.08, 2.5); this.burst(0.5, 3000, 0.2); break;
      case 'zap': this.burst(0.9, 8000, 0.6, 'highpass'); this.tone(70, 1, 'sawtooth', 0.3, 0.5); flash('#ffffff', 0.7); break;
      case 'laser': this.tone(1800, 0.25, 'sawtooth', 0.1, 0.3); break;
      case 'fall': this.tone(600, 1, 'sine', 0.15, 0.15); break;
    }
  },
  setOn(on) { if (this.master) this.master.gain.value = on ? 0.55 : 0; }
};
class Music {
  constructor(ac, out) {
    this.ac = ac; this.g = ac.createGain(); this.g.gain.value = 0.11; this.g.connect(out);
    this.step = 0; this.next = 0; this.on = false;
    this.chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    setInterval(() => this.tick(), 50);
  }
  n2f(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  note(f, t, dur, type, vol, cut) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain(), fl = ac.createBiquadFilter();
    o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = cut;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(this.g); o.start(t); o.stop(t + dur + 0.05);
  }
  tick() {
    if (!this.on || this.ac.state !== 'running') { this.next = 0; return; }
    const spb = 60 / (this.bpm || 132) / 4;
    if (!this.next || this.next < this.ac.currentTime) this.next = this.ac.currentTime + 0.05;
    while (this.next < this.ac.currentTime + 0.2) {
      const s = this.step % 16, ch = this.chords[Math.floor(this.step / 32) % 4], t = this.next;
      if (s % 4 === 0) { const o = this.ac.createOscillator(), g = this.ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g); g.connect(this.g); o.start(t); o.stop(t + 0.2); }
      if (s % 2 === 0) this.note(this.n2f(ch[0] - 24 + (s % 8 === 6 ? 12 : 0)), t, spb * 1.8, 'sawtooth', 0.35, 500);
      this.note(this.n2f(ch[s % 3] + 12 + (s >= 8 ? 12 : 0)), t, spb * 0.9, 'square', 0.12, 2400);
      if (s === 4 || s === 12) { /* 스네어 */ const b = this.ac.createBufferSource(), g = this.ac.createGain(), f = this.ac.createBiquadFilter(); b.buffer = Snd.noise; f.type = 'highpass'; f.frequency.value = 1500; g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); b.connect(f); f.connect(g); g.connect(this.g); b.start(t, Math.random()); b.stop(t + 0.16); }
      this.step++; this.next += spb;
    }
  }
}

// ── 텍스처 ───────────────────────────────────────────────
const THEME = {
  city: { road: '#16132a', line: '#ff3bd4', rail: 0xff3bd4, rail2: 0x29d3ff, fog: 0x1c0a3a, fogD: 0.0009, sun: 0xb79cff, hemiT: 0xa58bff, hemiB: 0x2a0f45 },
  space: { road: '#121a2e', line: '#29d3ff', rail: 0x29d3ff, rail2: 0x7a5cff, fog: 0x050818, fogD: 0.0006, sun: 0xffffff, hemiT: 0x9bb8ff, hemiB: 0x0a0a20 },
  lava: { road: '#221512', line: '#ffb020', rail: 0xff6a00, rail2: 0xffd23f, fog: 0x3a1206, fogD: 0.0017, sun: 0xffb27a, hemiT: 0xff9a6a, hemiB: 0x2a0800 },
  jungle: { road: '#1d2416', line: '#9cff4a', rail: 0x7dff5a, rail2: 0x2ad1ff, fog: 0x123a26, fogD: 0.0016, sun: 0xfff2c8, hemiT: 0xbfffd0, hemiB: 0x0e2a14 },
  ice: { road: '#1a2a3e', line: '#bff4ff', rail: 0x8fe8ff, rail2: 0xffffff, fog: 0x6f9cc4, fogD: 0.0012, sun: 0xeef8ff, hemiT: 0xb8d8f0, hemiB: 0x2a4060, exp: 0.82, bth: 0.95 },
  cyber: { road: '#0a0a18', line: '#00ffd5', rail: 0x00ffd5, rail2: 0xff2bd6, fog: 0x05020f, fogD: 0.0011, sun: 0xc8b8ff, hemiT: 0x9a8aff, hemiB: 0x10002a },
  desert: { road: '#3a2a1e', line: '#ffcf5a', rail: 0xff9a3a, rail2: 0xffe08a, fog: 0xd9a46a, fogD: 0.0011, sun: 0xffe2b0, hemiT: 0xffe6c0, hemiB: 0x6a4020, exp: 0.92, bth: 0.9 },
  rainbow: { road: '#000', line: '#fff', rail: 0xffffff, rail2: 0xff3bd4, fog: 0x050818, fogD: 0.0005, sun: 0xffffff, hemiT: 0xd0c8ff, hemiB: 0x101030, rainbow: 1 }
};
function roadTex(th) {
  if (th.rainbow) return canvasTex(256, 512, (g, w, h) => {
    const cs = ['#ff3b3b', '#ff9a2b', '#ffe83b', '#3dff6a', '#2bd6ff', '#5a6bff', '#c03bff'];
    cs.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * w / 7, 0, w / 7 + 1, h); });
    g.fillStyle = 'rgba(255,255,255,.35)'; for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 6);
  }, true);
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = th.road; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    // 육각 무늬
    g.strokeStyle = 'rgba(255,255,255,0.035)'; g.lineWidth = 1;
    for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 * 16; x < w; x += 32) { g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = th.line; g.fillRect(6, 0, 8, h); g.fillRect(w - 14, 0, 8, h);
    g.fillStyle = 'rgba(255,255,255,.55)';
    for (let y = 0; y < h; y += 128) { g.fillRect(w / 3 - 2, y, 4, 64); g.fillRect(2 * w / 3 - 2, y, 4, 64); }
  }, true);
}
const boostTex = canvasTex(128, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#29d3ff'); gr.addColorStop(0.5, '#a0f4ff'); gr.addColorStop(1, '#29d3ff');
  g.fillStyle = 'rgba(0,30,60,0.6)'; g.fillRect(0, 0, w, h);
  g.fillStyle = gr;
  for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(10, y + 50); g.lineTo(w / 2, y + 12); g.lineTo(w - 10, y + 50); g.lineTo(w - 10, y + 62); g.lineTo(w / 2, y + 26); g.lineTo(10, y + 62); g.fill(); }
}, true);
const jumpTex = canvasTex(128, 128, (g, w, h) => {
  for (let i = -2; i < 8; i++) { g.fillStyle = i % 2 ? '#111' : '#ffd23f'; g.beginPath(); g.moveTo(i * 24, 0); g.lineTo(i * 24 + 24, 0); g.lineTo(i * 24 + 24 + h, h); g.lineTo(i * 24 + h, h); g.fill(); }
}, true);
const boxTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h); ['#ff3b8d', '#ffd23f', '#3dff8a', '#29d3ff', '#a637ff'].forEach((c, i) => gr.addColorStop(i / 4, c));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(6, 6, w - 12, h - 12);
  g.fillStyle = '#fff'; g.font = 'bold 90px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#000'; g.shadowBlur = 8; g.fillText('?', w / 2, h / 2 + 6);
});
const glowTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const checkTex = canvasTex(64, 64, (g) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 16, y * 16, 16, 16); } }, true);

// ── 트랙 · 배경 만들기 ────────────────────────────────────────
let world = null;   // { T, idx, group, boxes:[], boostMats:[], update(dt) }
function inGap(T, s) { for (const j of T.jumps) { const d = RK.mod(s - j.gs, T.L); if (d < j.ge - j.gs) return true; } return false; }
function strip(T, edge, step, vScale, skipGap) {
  // edge(f, w) → [[x,y,z], [x,y,z]] 두 점
  const pos = [], uv = [], idx = [];
  const n = Math.ceil(T.N / step);
  let prevOk = false, vi = 0;
  for (let k = 0; k <= n; k++) {
    const s = Math.min(k * step * T.ds, T.L);
    const f = RK.frame(T, s, _f);
    const [a, b] = edge(f);
    pos.push(...a, ...b); uv.push(0, s / vScale, 1, s / vScale);
    const ok = !(skipGap && inGap(T, s));
    if (k > 0 && ok && prevOk) idx.push(vi - 2, vi, vi - 1, vi - 1, vi, vi + 1);
    prevOk = ok; vi += 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const P = (f, lat, up) => [f.px + f.rx * lat + f.ux * up, f.py + f.ry * lat + f.uy * up, f.pz + f.rz * lat + f.uz * up];

function buildWorld(idx) {
  if (world && world.idx === idx) return;
  if (world) { scene.remove(world.group); world.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map && m.map !== boxTex) m.map.dispose(); m.dispose(); }); } }); }
  const T = getTrack(idx), def = RK.TRACKS[idx], th = THEME[def.theme];
  const G = new THREE.Group();
  const W = { T, idx, group: G, boxes: [], boostMats: [], upd: [] };
  scene.fog = new THREE.FogExp2(th.fog, th.fogD);
  scene.background = new THREE.Color(th.fog);
  renderer.toneMappingExposure = th.exp || 1.05; if (bloom) bloom.threshold = th.bth || 0.82;
  hemi.color.set(th.hemiT); hemi.groundColor.set(th.hemiB); sun.color.set(th.sun);

  // 도로
  const rt = roadTex(th);
  const road = new THREE.Mesh(strip(T, f => [P(f, -f.w / 2, 0), P(f, f.w / 2, 0)], 2, 24, true),
    th.rainbow ? new THREE.MeshBasicMaterial({ map: rt, color: 0xb0b0b0, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ map: rt, roughness: def.theme === 'ice' ? 0.08 : 0.55, metalness: def.theme === 'ice' ? 0.6 : 0.25, envMapIntensity: def.theme === 'ice' ? 1.4 : 0.6 }));
  if (th.rainbow) W.upd.push((t, dt) => { rt.offset.y -= dt * 0.4; });
  G.add(road);
  const under = new THREE.MeshStandardMaterial({ color: 0x15121f, roughness: 0.6, metalness: 0.7, side: THREE.DoubleSide, envMapIntensity: 0.5 });
  G.add(new THREE.Mesh(strip(T, f => [P(f, -f.w / 2, -0.02), P(f, -f.w / 2 - 0.4, -1.8)], 2, 24, true), under));
  G.add(new THREE.Mesh(strip(T, f => [P(f, f.w / 2 + 0.4, -1.8), P(f, f.w / 2, -0.02)], 2, 24, true), under));
  G.add(new THREE.Mesh(strip(T, f => [P(f, f.w / 2 + 0.4, -1.8), P(f, -f.w / 2 - 0.4, -1.8)], 2, 24, true), under));
  // 아래 빛줄
  const glowLine = new THREE.MeshBasicMaterial({ color: new THREE.Color(th.rail2).multiplyScalar(1.6), toneMapped: false, side: THREE.DoubleSide });
  G.add(new THREE.Mesh(strip(T, f => [P(f, -f.w / 2 - 0.3, -1.1), P(f, -f.w / 2 - 0.36, -1.3)], 2, 24, true), glowLine));
  G.add(new THREE.Mesh(strip(T, f => [P(f, f.w / 2 + 0.36, -1.3), P(f, f.w / 2 + 0.3, -1.1)], 2, 24, true), glowLine));
  // 난간 (반투명 벽 + 빛나는 윗줄)
  const glass = new THREE.MeshBasicMaterial({ color: th.rail, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false });
  if (!T.nowall) {
  G.add(new THREE.Mesh(strip(T, f => [P(f, -f.w / 2, 0), P(f, -f.w / 2, 1.1)], 2, 24, true), glass));
  G.add(new THREE.Mesh(strip(T, f => [P(f, f.w / 2, 1.1), P(f, f.w / 2, 0)], 2, 24, true), glass));
  const railTop = new THREE.MeshBasicMaterial({ color: new THREE.Color(th.rail).multiplyScalar(2.2), toneMapped: false, side: THREE.DoubleSide });
  G.add(new THREE.Mesh(strip(T, f => [P(f, -f.w / 2 - 0.12, 1.1), P(f, -f.w / 2 + 0.12, 1.1)], 2, 24, true), railTop));
  G.add(new THREE.Mesh(strip(T, f => [P(f, f.w / 2 - 0.12, 1.1), P(f, f.w / 2 + 0.12, 1.1)], 2, 24, true), railTop));
  }

  // 부스트 판
  const quad = (s, lat, len, wd, up, mat) => {
    const pos = [], uv = [], ix = [], n = Math.max(2, Math.ceil(len / 1.5));
    for (let k = 0; k <= n; k++) {
      const ss = s + len * k / n, f = RK.frame(T, ss, _f);
      pos.push(...P(f, lat - wd / 2, up), ...P(f, lat + wd / 2, up)); uv.push(0, k / n, 1, k / n);
      if (k) ix.push(2 * k - 2, 2 * k, 2 * k - 1, 2 * k - 1, 2 * k, 2 * k + 1);
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(ix); gg.computeVertexNormals();
    const m = new THREE.Mesh(gg, mat); G.add(m); return m;
  };
  for (const b of T.boost) {
    const mat = new THREE.MeshBasicMaterial({ map: boostTex.clone(), transparent: true, toneMapped: false, color: 0xbff6ff, depthWrite: false });
    mat.map.needsUpdate = true; mat.map.repeat.set(1, 2);
    quad(b.s, b.lat, b.len, b.wd, 0.04, mat); W.boostMats.push(mat);
  }
  for (const j of T.jumps) {
    const w = RK.widthAt(T, j.s) - 2;
    quad(j.s - 1, 0, j.len + 1, w, 0.04, new THREE.MeshBasicMaterial({ map: jumpTex, toneMapped: false, color: 0xffffff }));
    // 구멍 앞뒤 경고등
    for (const s of [j.gs, j.ge]) for (const side of [-1, 1]) {
      const o = onTrack(T, s, side * (RK.widthAt(T, s) / 2), 1.4);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3020).multiplyScalar(3), toneMapped: false }));
      l.position.set(o.x, o.y, o.z); G.add(l); W.upd.push(t => l.visible = (t * 3 | 0) % 2 === 0);
    }
  }
  // 출발선 · 문
  quad(-1.5, 0, 3, RK.widthAt(T, 0), 0.05, new THREE.MeshBasicMaterial({ map: checkTex, color: 0xffffff }));
  {
    const o = onTrack(T, 0, 0, 0), w = RK.widthAt(T, 0);
    const gate = new THREE.Group();
    const pm = new THREE.MeshStandardMaterial({ color: 0x222233, metalness: 0.8, roughness: 0.3 });
    for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 11, 1.2), pm); p.position.set(sd * (w / 2 + 1.5), 5.5, 0); gate.add(p); }
    const ban = canvasTex(1024, 128, (g, cw, ch) => {
      const gr = g.createLinearGradient(0, 0, cw, 0); gr.addColorStop(0, '#ff3b8d'); gr.addColorStop(1, '#7a2cff');
      g.fillStyle = gr; g.fillRect(0, 0, cw, ch); g.fillStyle = '#fff'; g.font = '900 84px "Black Han Sans", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🚀 ROCKET KART 🚀', cw / 2, ch / 2 + 4);
    });
    const bm = new THREE.Mesh(new THREE.BoxGeometry(w + 4, 2.6, 0.6), [pm, pm, pm, pm, new THREE.MeshBasicMaterial({ map: ban, toneMapped: false }), new THREE.MeshBasicMaterial({ map: ban, toneMapped: false })]);
    bm.position.set(0, 10, 0); gate.add(bm);
    basis(gate.matrix, o.x, o.y, o.z, o.fx, o.fy, o.fz, o.ux, o.uy, o.uz); gate.matrixAutoUpdate = false; G.add(gate);
  }
  // 아이템 상자
  const boxMat = new THREE.MeshStandardMaterial({ map: boxTex, emissive: 0xffffff, emissiveMap: boxTex, emissiveIntensity: 0.9, transparent: true, opacity: 0.92, roughness: 0.2 });
  const boxGeo = new THREE.BoxGeometry(1.7, 1.7, 1.7);
  T.boxes.forEach((b, k) => {
    const m = new THREE.Mesh(boxGeo, boxMat); const o = onTrack(T, b.s, b.lat, 1.5);
    m.userData = { o, k }; m.position.set(o.x, o.y, o.z); G.add(m); W.boxes.push(m);
  });

  // 기둥 (도시 · 용암)
  let minY = Infinity; for (let i = 0; i < T.N; i++) minY = Math.min(minY, T.py[i]);
  const groundY = minY - 45;
  if (def.theme !== 'space' && def.theme !== 'rainbow') {
    const ps = []; for (let s = 20; s < T.L; s += 55) { if (inGap(T, s)) continue; const f = RK.frame(T, s, _f); if (f.uy < 0.85) continue; ps.push([f.px - f.ux * 1.8, f.py - f.uy * 1.8, f.pz - f.uz * 1.8]); }
    const pg = new THREE.CylinderGeometry(1, 1.4, 1, 10);
    const pil = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0x1d1a2a, metalness: 0.6, roughness: 0.5 }), ps.length);
    ps.forEach((p, i) => { const h = p[1] - groundY; _m.makeScale(1, h, 1); _m.setPosition(p[0], groundY + h / 2, p[2]); pil.setMatrixAt(i, _m); });
    G.add(pil);
  }
  // 하늘
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { cB: { value: new THREE.Color(def.sky[0]) }, cT: { value: new THREE.Color(def.sky[1]) }, cH: { value: new THREE.Color(th.rail) } },
    vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec3 vP;uniform vec3 cB,cT,cH;void main(){float y=vP.y;vec3 c=mix(cB,cT,smoothstep(-.2,.7,y));c+=cH*.35*exp(-abs(y-.02)*9.);gl_FragColor=vec4(c,1.);}'
  }));
  sky.renderOrder = -10; G.add(sky); W.sky = sky;
  // 별
  {
    const sp2 = def.theme === 'space' || def.theme === 'rainbow' || def.theme === 'cyber';
    const n = sp2 ? 5000 : 1500, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, r = 3500, q = Math.sqrt(1 - u * u); a[i * 3] = r * q * Math.cos(t); a[i * 3 + 1] = Math.abs(u) * r * (sp2 ? Math.sign(u) : 1); a[i * 3 + 2] = r * q * Math.sin(t); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    const st = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: sp2 ? 2.2 : 1.6, opacity: ['ice', 'desert', 'jungle'].includes(def.theme) ? 0 : 0.9, sizeAttenuation: false, fog: false, transparent: true }));
    G.add(st); W.stars = st;
  }
  // 영역
  let cx = 0, cz = 0, R = 0; for (let i = 0; i < T.N; i += 10) { cx += T.px[i]; cz += T.pz[i]; } cx /= T.N / 10; cz /= T.N / 10;
  for (let i = 0; i < T.N; i += 10) R = Math.max(R, Math.hypot(T.px[i] - cx, T.pz[i] - cz));
  const near = (x, z, d) => { for (let i = 0; i < T.N; i += 6) if (Math.hypot(T.px[i] - x, T.pz[i] - z) < d) return true; return false; };

  const B = { city: buildCity, lava: buildLava, jungle: buildJungle, ice: buildIce, cyber: buildCyber, desert: buildDesert };
  if (def.theme === 'space') buildSpace(W, T, cx, cz, R, near);
  else if (def.theme === 'rainbow') buildRainbow(W, T, cx, cz, R, near);
  else B[def.theme](W, T, cx, cz, R, groundY, near);
  buildHazards(W, T);

  scene.add(G); world = W;
  drawMiniBase(T);
}

function groundShader(color1, color2, y, fog, kind) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, c1: { value: new THREE.Color(color1) }, c2: { value: new THREE.Color(color2) }, cam: { value: new THREE.Vector3() }, fogC: { value: new THREE.Color(fog) } },
    vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `varying vec3 vW;uniform float uT;uniform vec3 c1,c2,cam,fogC;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
      void main(){vec3 c;
      ${kind === 'grid' ? `vec2 g=abs(fract(vW.xz/24.)-.5);float l=smoothstep(.47,.5,max(g.x,g.y));vec2 g2=abs(fract(vW.xz/120.)-.5);float l2=smoothstep(.485,.5,max(g2.x,g2.y));c=c1*.25+c2*l*1.4+c2*l2*2.;`
        : `vec2 p=vW.xz/40.;float t=uT*.06;float f=fbm(p+vec2(t,t*.7)+fbm(p*.5-t)*2.);c=mix(c1*.06,c1*1.4,smoothstep(.42,.72,f));c+=c2*2.2*pow(smoothstep(.6,.88,f),3.);`}
      float d=length(vW.xz-cam.xz);c=mix(c,fogC,1.-exp(-d*.0011));gl_FragColor=vec4(c,1.);}`
  });
  const g = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), m); g.rotation.x = -Math.PI / 2; g.position.y = y;
  return g;
}

function buildCity(W, T, cx, cz, R, groundY, near) {
  const G = W.group;
  const gnd = groundShader(0x120828, 0x7a2cff, groundY, 0x1c0a3a, 'grid'); G.add(gnd);
  W.upd.push((t) => { gnd.material.uniforms.cam.value.copy(camera.position); });
  const win = canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#0b0a14'; g.fillRect(0, 0, w, h);
    for (let y = 4; y < h; y += 10) for (let x = 4; x < w; x += 10) { const r = Math.random(); g.fillStyle = r < 0.45 ? `rgba(255,${180 + Math.random() * 60 | 0},${120 + Math.random() * 100 | 0},${0.5 + Math.random() * 0.5})` : r < 0.55 ? 'rgba(80,200,255,.8)' : 'rgba(30,30,50,1)'; g.fillRect(x, y, 6, 6); }
  }, true);
  const mat = new THREE.MeshStandardMaterial({ map: win, emissiveMap: win, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.5, metalness: 0.4 });
  const N = quality === 'high' ? 520 : 260, mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, N);
  const col = new THREE.Color(); let k = 0, tries = 0;
  while (k < N && tries++ < N * 20) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (R + 500);
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    const w = 14 + Math.random() * 26;
    if (near(x, z, w + 22)) continue;
    const h = 30 + Math.pow(Math.random(), 2) * (d > R ? 260 : 120);
    _m.makeScale(w, h, w * (0.7 + Math.random() * 0.6)); _m.setPosition(x, groundY + h / 2, z);
    mesh.setMatrixAt(k, _m);
    col.setHSL(0.7 + Math.random() * 0.25, 0.4, 0.55 + Math.random() * 0.3); mesh.setColorAt(k, col);
    k++;
  }
  mesh.count = k; G.add(mesh);
  // 네온 지붕 띠
  const neon = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), k);
  for (let i = 0; i < k; i++) {
    mesh.getMatrixAt(i, _m); _v.setFromMatrixPosition(_m); _w.setFromMatrixScale(_m);
    _m.makeScale(_w.x + 0.6, 1.2, _w.z + 0.6); _m.setPosition(_v.x, _v.y + _w.y / 2, _v.z); neon.setMatrixAt(i, _m);
    col.set([0xff3bd4, 0x29d3ff, 0xffd23f, 0x7a5cff][i % 4]).multiplyScalar(2); neon.setColorAt(i, col);
  }
  G.add(neon);
  // 달
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc8f0, fog: false, depthWrite: false, toneMapped: false }));
  moon.scale.set(900, 900, 1); moon.position.set(cx - 2200, 900, cz - 2600); G.add(moon);
  const moon2 = new THREE.Mesh(new THREE.CircleGeometry(150, 48), new THREE.MeshBasicMaterial({ color: 0xffe6f6, fog: false }));
  moon2.position.copy(moon.position); moon2.lookAt(cx, 0, cz); G.add(moon2);
}

function buildSpace(W, T, cx, cz, R, near) {
  const G = W.group;
  // 행성 + 고리
  const pt = canvasTex(512, 256, (g, w, h) => {
    for (let y = 0; y < h; y++) { const t = y / h; const c = 160 + 60 * Math.sin(t * 40 + Math.sin(t * 9) * 3); g.fillStyle = `rgb(${c + 40 | 0},${c * 0.8 | 0},${c * 0.55 | 0})`; g.fillRect(0, y, w, 1); }
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(700, 64, 32), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.9, emissive: 0x331a0a, fog: false }));
  planet.position.set(cx + 1700, -500, cz - 2100); planet.rotation.z = 0.3; G.add(planet);
  const rtex = canvasTex(512, 8, (g, w) => { for (let x = 0; x < w; x++) { const a = (0.25 + 0.6 * Math.abs(Math.sin(x * 0.09) * Math.sin(x * 0.023))) * (x > w * 0.08 ? 1 : 0); g.fillStyle = `rgba(255,${210 + Math.random() * 30 | 0},${170},${a})`; g.fillRect(x, 0, 1, 8); } });
  const rg = new THREE.RingGeometry(900, 1600, 128, 1);
  const pa = rg.attributes.position, uv = rg.attributes.uv;
  for (let i = 0; i < pa.count; i++) { const l = Math.hypot(pa.getX(i), pa.getY(i)); uv.setXY(i, (l - 900) / 700, 0.5); }
  const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: rtex, transparent: true, side: THREE.DoubleSide, fog: false, depthWrite: false }));
  ring.position.copy(planet.position); ring.rotation.x = -Math.PI / 2 + 0.35; ring.rotation.y = 0.2; G.add(ring);
  // 성운
  const neb = [[0x7a2cff, -2500, 600, 1800], [0xff3b8d, 2600, 900, 2200], [0x29d3ff, 500, 1500, -2800]];
  for (const [c, x, y, z] of neb) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, opacity: 0.35, blending: THREE.AdditiveBlending, fog: false, depthWrite: false })); s.scale.set(2600, 2000, 1); s.position.set(cx + x, y, cz + z); G.add(s); }
  // 소행성
  const N = quality === 'high' ? 420 : 200;
  const ast = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x6a6070, roughness: 0.95, flatShading: true }), N);
  let k = 0, tries = 0; const q = new THREE.Quaternion(), e = new THREE.Euler();
  while (k < N && tries++ < N * 20) {
    const x = cx + (Math.random() - 0.5) * (R * 2 + 900), z = cz + (Math.random() - 0.5) * (R * 2 + 900), y = (Math.random() - 0.5) * 400;
    const s = 3 + Math.pow(Math.random(), 3) * 40;
    if (near(x, z, s + 30) && Math.abs(y) < 80) continue;
    e.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); q.setFromEuler(e);
    _m.compose(_v.set(x, y, z), q, _w.set(s, s * (0.6 + Math.random() * 0.5), s)); ast.setMatrixAt(k++, _m);
  }
  ast.count = k; G.add(ast);
  W.upd.push((t, dt) => { ring.rotation.z += dt * 0.01; planet.rotation.y += dt * 0.01; });
}

function buildLava(W, T, cx, cz, R, groundY, near) {
  const G = W.group;
  const lava = groundShader(0xff4a00, 0xffc040, groundY, 0x3a1206, 'lava'); G.add(lava);
  W.upd.push((t) => { lava.material.uniforms.uT.value = t; lava.material.uniforms.cam.value.copy(camera.position); });
  const N = quality === 'high' ? 300 : 150;
  const rock = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7, 3), new THREE.MeshStandardMaterial({ color: 0x2a1c18, roughness: 0.95, flatShading: true }), N);
  let k = 0, tries = 0;
  while (k < N && tries++ < N * 20) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (R + 600);
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, w = 12 + Math.random() * 40;
    if (near(x, z, w + 18)) continue;
    const h = 40 + Math.random() * (d > R ? 260 : 90);
    _m.makeScale(w, h, w); _m.setPosition(x, groundY + h / 2 - 5, z); rock.setMatrixAt(k++, _m);
  }
  rock.count = k; G.add(rock);
  // 화산
  const vol = new THREE.Mesh(new THREE.ConeGeometry(700, 900, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x1e120e, roughness: 1, flatShading: true }));
  vol.position.set(cx - 600, groundY + 400, cz - 2400); G.add(vol);
  const top = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff6a10, blending: THREE.AdditiveBlending, fog: false, depthWrite: false, toneMapped: false }));
  top.scale.set(900, 700, 1); top.position.set(vol.position.x, groundY + 860, vol.position.z); G.add(top);
  W.upd.push((t, dt) => {
    for (let i = 0; i < (quality === 'high' ? 6 : 3); i++) {
      const x = camera.position.x + (Math.random() - 0.5) * 300, z = camera.position.z + (Math.random() - 0.5) * 300;
      parts.spawn(x, camera.position.y - 40 - Math.random() * 30, z, (Math.random() - 0.5) * 3, 8 + Math.random() * 10, (Math.random() - 0.5) * 3, 4, 0.5 + Math.random() * 0.7, 1, 0.35, 0.05, 0.2, -1);
    }
    top.material.opacity = 0.75 + Math.sin(t * 2) * 0.2;
  });
}

function natureGround(c1, c2, y, fog, kind) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, c1: { value: new THREE.Color(c1) }, c2: { value: new THREE.Color(c2) }, cam: { value: new THREE.Vector3() }, fogC: { value: new THREE.Color(fog) } },
    vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `varying vec3 vW;uniform float uT;uniform vec3 c1,c2,cam,fogC;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
      void main(){vec2 p=vW.xz;vec3 c;
      ${kind === 'dune' ? `float d=sin(p.x*.02+fbm(p*.004)*6.)*.5+.5;float f=fbm(p*.01);c=mix(c1,c2,d*.6+f*.4);c*=.85+.3*fbm(p*.2);`
        : kind === 'snow' ? `float f=fbm(p*.006);c=mix(c1,c2,smoothstep(.3,.8,f));c+=vec3(.9,.95,1.)*pow(h(floor(p*1.5)),40.)*.6;`
        : kind === 'water' ? `vec2 q=p*.02;float f=fbm(q+vec2(uT*.05,uT*.03))+fbm(q*2.-uT*.04)*.5;c=mix(c1,c2,smoothstep(.5,1.1,f));`
        : `float f=fbm(p*.008);c=mix(c1,c2,f);`}
      float dd=length(vW.xz-cam.xz);c=mix(c,fogC,1.-exp(-dd*.0012));gl_FragColor=vec4(c,1.);}`
  });
  const g = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), m); g.rotation.x = -Math.PI / 2; g.position.y = y;
  return g;
}
// 트랙 근처에 놓기
function scatter(N, cx, cz, R, near, minGap, fn) {
  let k = 0, tries = 0;
  while (k < N && tries++ < N * 25) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (R + 600), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    const s = fn.size ? fn.size(d > R) : 1; if (near(x, z, minGap + s)) continue;
    fn(k++, x, z, d > R, s);
  }
  return k;
}
function buildJungle(W, T, cx, cz, R, groundY, near) {
  const G = W.group;
  const river = natureGround(0x0a3a3a, 0x3ad1c8, groundY - 2, 0x123a26, 'water'); G.add(river);
  const land = natureGround(0x0e2a12, 0x3a6a1e, groundY + 6, 0x123a26, 'grass');
  land.geometry = new THREE.RingGeometry(R * 0.2, 4500, 64, 1); land.position.set(cx, groundY + 6, cz); G.add(land);
  W.upd.push(t => { for (const g of [river, land]) { g.material.uniforms.uT.value = t; g.material.uniforms.cam.value.copy(camera.position); } });
  const N = quality === 'high' ? 380 : 180;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.8, 1, 8), new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 }), N);
  const leaf = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x2f7a2a, roughness: 0.9, flatShading: true }), N * 2);
  const col = new THREE.Color(); let li = 0;
  const fn = (k, x, z, far, s) => {
    const h = 40 + Math.random() * (far ? 120 : 70), w = 3 + Math.random() * 3;
    _m.makeScale(w, h, w); _m.setPosition(x, groundY + h / 2, z); trunk.setMatrixAt(k, _m);
    for (let j = 0; j < 2; j++) { const r = 14 + Math.random() * 16; _m.makeScale(r, r * 0.55, r); _m.setPosition(x + (Math.random() - 0.5) * 8, groundY + h - j * 10, z + (Math.random() - 0.5) * 8); leaf.setMatrixAt(li, _m); col.setHSL(0.27 + Math.random() * 0.08, 0.6, 0.25 + Math.random() * 0.15); leaf.setColorAt(li++, col); }
  };
  fn.size = () => 18;
  trunk.count = scatter(N, cx, cz, R, near, 14, fn); leaf.count = li; G.add(trunk, leaf);
  // 유적 기둥
  const ru = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x7a7a62, roughness: 0.95 }), 120);
  ru.count = scatter(120, cx, cz, R * 0.8, near, 10, (k, x, z) => { const h = 10 + Math.random() * 30; _m.makeScale(5, h, 5); _m.setPosition(x, groundY + h / 2, z); ru.setMatrixAt(k, _m); col.setHSL(0.18, 0.15, 0.35 + Math.random() * 0.15); ru.setColorAt(k, col); }); G.add(ru);
  // 폭포 (점프 구간 옆)
  const wf = canvasTex(64, 256, (g, w, h) => { for (let x = 0; x < w; x++) { g.fillStyle = `rgba(200,240,255,${0.35 + Math.random() * 0.5})`; g.fillRect(x, 0, 1, h); } }, true);
  for (const j of T.jumps) {
    const o = onTrack(T, j.gs + 6, 0, 0), f = RK.frame(T, j.gs + 6, _f);
    const fallH = o.y - groundY + 60;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(70, fallH), new THREE.MeshBasicMaterial({ map: wf, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(o.x + f.tx * 60, groundY + fallH / 2, o.z + f.tz * 60); m.lookAt(o.x, m.position.y, o.z); G.add(m);
    W.upd.push((t, dt) => { wf.offset.y += dt * 1.6; if (Math.random() < 0.6) parts.spawn(m.position.x + (Math.random() - 0.5) * 60, groundY + 2, m.position.z + (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6, 6 + Math.random() * 6, (Math.random() - 0.5) * 6, 2, 3 + Math.random() * 3, 0.85, 0.95, 1, 0.3, -1); });
  }
  // 반딧불
  W.upd.push(() => { for (let i = 0; i < 2; i++) parts.spawn(camera.position.x + (Math.random() - 0.5) * 120, camera.position.y + (Math.random() - 0.5) * 30, camera.position.z + (Math.random() - 0.5) * 120, (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5), 3, 0.35, 0.8, 1, 0.3, 2, 0); });
}
function buildIce(W, T, cx, cz, R, groundY, near) {
  const G = W.group;
  const gnd = natureGround(0xdfefff, 0x9fc4e8, groundY, 0x9fc8e8, 'snow'); G.add(gnd);
  W.upd.push(t => gnd.material.uniforms.cam.value.copy(camera.position));
  const N = quality === 'high' ? 260 : 120;
  const ice = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, roughness: 0.15, metalness: 0, transmission: 0.2, clearcoat: 1, flatShading: true }), N);
  const fn = (k, x, z, far) => { const s = 15 + Math.pow(Math.random(), 2) * (far ? 160 : 60); _m.makeScale(s, s * (1 + Math.random() * 1.6), s); _m.setPosition(x, groundY + s * 0.4, z); ice.setMatrixAt(k, _m); };
  fn.size = () => 30; ice.count = scatter(N, cx, cz, R, near, 20, fn); G.add(ice);
  // 오로라
  const aur = new THREE.Mesh(new THREE.PlaneGeometry(6000, 900, 64, 1), new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'uniform float uT;varying vec2 vU;void main(){vU=uv;vec3 p=position;p.z+=sin(p.x*.002+uT*.3)*300.;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
    fragmentShader: 'uniform float uT;varying vec2 vU;void main(){float w=sin(vU.x*30.+uT)*.5+.5;float a=smoothstep(0.,.3,vU.y)*smoothstep(1.,.4,vU.y)*(.4+.6*w);vec3 c=mix(vec3(.1,1.,.6),vec3(.6,.2,1.),vU.y);gl_FragColor=vec4(c*a*.8,a);}'
  }));
  aur.position.set(cx, 900, cz - 2600); G.add(aur);
  W.upd.push((t) => {
    aur.material.uniforms.uT.value = t;
    for (let i = 0; i < (quality === 'high' ? 8 : 4); i++) parts.spawn(camera.position.x + (Math.random() - 0.5) * 160, camera.position.y + 30, camera.position.z + (Math.random() - 0.5) * 160, (Math.random() - 0.5) * 2, -6 - Math.random() * 4, (Math.random() - 0.5) * 2, 5, 0.35, 1, 1, 1, 0.5, 0);
  });
}
function buildCyber(W, T, cx, cz, R, groundY, near) {
  const G = W.group;
  const gnd = groundShader(0x04020c, 0x00ffd5, groundY, 0x05020f, 'grid'); G.add(gnd);
  W.upd.push(() => gnd.material.uniforms.cam.value.copy(camera.position));
  // 튜브 고리
  const rings = [], step = 26;
  for (let s = 0; s < T.L; s += step) if (!inGap(T, s)) rings.push(s);
  const rm = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.045, 6, 40), new THREE.MeshBasicMaterial({ toneMapped: false }), rings.length);
  const col = new THREE.Color();
  rings.forEach((s, i) => {
    const o = onTrack(T, s, 0, 4), r = RK.widthAt(T, s) / 2 + 3;
    const m4 = new THREE.Matrix4(); basis(m4, o.x, o.y, o.z, o.fx, o.fy, o.fz, o.ux, o.uy, o.uz);
    _m.makeScale(r, r * 0.8, r); m4.multiply(_m); rm.setMatrixAt(i, m4);
    col.set(i % 2 ? 0x00ffd5 : 0xff2bd6).multiplyScalar(2.2); rm.setColorAt(i, col);
  });
  G.add(rm);
  W.upd.push(t => { const c = new THREE.Color(); for (let i = 0; i < rings.length; i++) { const k = 0.6 + 0.4 * Math.sin(t * 6 - i * 0.6); c.set(i % 2 ? 0x00ffd5 : 0xff2bd6).multiplyScalar(2.4 * k); rm.setColorAt(i, c); } rm.instanceColor.needsUpdate = true; });
  // 데이터 빛기둥
  const N = 160, beam = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), N);
  beam.count = scatter(N, cx, cz, R, near, 30, (k, x, z) => { const h = 200 + Math.random() * 600; _m.makeScale(3, h, 3); _m.setPosition(x, groundY + h / 2, z); beam.setMatrixAt(k, _m); col.set([0x00ffd5, 0xff2bd6, 0x7a5cff][k % 3]).multiplyScalar(1.5); beam.setColorAt(k, col); }); G.add(beam);
  // 건물
  const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x0c0a1c, metalness: 0.9, roughness: 0.3 }), 220);
  bm.count = scatter(220, cx, cz, R, near, 30, (k, x, z, far) => { const w = 20 + Math.random() * 40, h = 60 + Math.random() * (far ? 400 : 160); _m.makeScale(w, h, w); _m.setPosition(x, groundY + h / 2, z); bm.setMatrixAt(k, _m); }); G.add(bm);
}
function buildDesert(W, T, cx, cz, R, groundY, near) {
  const G = W.group;
  const gnd = natureGround(0xc98a4a, 0xf2c27a, groundY, 0xd9a46a, 'dune'); G.add(gnd);
  W.upd.push(() => gnd.material.uniforms.cam.value.copy(camera.position));
  const N = quality === 'high' ? 140 : 70;
  const st = canvasTex(64, 256, (g, w, h) => { for (let y = 0; y < h; y++) { const t = y / h; g.fillStyle = `hsl(${18 + Math.sin(t * 40) * 6},${50 + Math.sin(t * 13) * 15}%,${38 + Math.sin(t * 27) * 10}%)`; g.fillRect(0, y, w, 1); } });
  const mesa = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.8, 1, 1, 9), new THREE.MeshStandardMaterial({ map: st, roughness: 1, flatShading: true }), N);
  const fn = (k, x, z, far) => { const w = 30 + Math.random() * 80, h = 40 + Math.random() * (far ? 220 : 90); _m.makeScale(w, h, w * (0.6 + Math.random() * 0.6)); _m.setPosition(x, groundY + h / 2, z); mesa.setMatrixAt(k, _m); };
  fn.size = () => 50; mesa.count = scatter(N, cx, cz, R, near, 30, fn); G.add(mesa);
  const cac = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 0.7, 1, 8), new THREE.MeshStandardMaterial({ color: 0x3a7a2a, roughness: 0.8 }), 200);
  cac.count = scatter(200, cx, cz, R * 0.9, near, 8, (k, x, z) => { const h = 6 + Math.random() * 8; _m.makeScale(1.4, h, 1.4); _m.setPosition(x, groundY + h / 2, z); cac.setMatrixAt(k, _m); }); G.add(cac);
  const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd28a, fog: false, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  sunS.scale.set(1600, 1600, 1); sunS.position.set(cx + 2400, 700, cz - 2600); G.add(sunS);
  W.upd.push(() => { if (Math.random() < 0.7) parts.spawn(camera.position.x + (Math.random() - 0.5) * 200, camera.position.y - 6, camera.position.z + (Math.random() - 0.5) * 200, 8 + Math.random() * 6, 0.5, 3, 3, 1.2, 0.95, 0.75, 0.5, 0.25, 0); });
}
function buildRainbow(W, T, cx, cz, R, near) {
  buildSpace(W, T, cx, cz, R, near);
  const G = W.group;
  const neb = [[0xff3b8d, -1500, 300, -1200], [0x3dff8a, 1800, 500, 900], [0xffd23f, 0, 900, 2400]];
  for (const [c, x, y, z] of neb) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, opacity: 0.3, blending: THREE.AdditiveBlending, fog: false, depthWrite: false })); s.scale.set(2400, 1800, 1); s.position.set(cx + x, y, cz + z); G.add(s); }
  W.upd.push(() => { if (Math.random() < 0.5) { const c = new THREE.Color().setHSL(Math.random(), 1, 0.6); parts.spawn(camera.position.x + (Math.random() - 0.5) * 140, camera.position.y + (Math.random() - 0.5) * 60, camera.position.z + (Math.random() - 0.5) * 140, 0, 0, 0, 2, 0.4, c.r, c.g, c.b, 2, 0); } });
}
// 함정 모양
function buildHazards(W, T) {
  const G = W.group; W.hz = [];
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 1, flatShading: true });
  T.hazards.forEach((h, k) => {
    if (h.k === 'roll') {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), RK.TRACKS[W.idx].theme === 'cyber' ? new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2bd6).multiplyScalar(2), toneMapped: false, wireframe: true }) : rockMat);
      G.add(m); W.hz.push({ k, m, type: 'roll' });
    } else if (h.k === 'laser') {
      const w = RK.widthAt(T, h.s), o = onTrack(T, h.s, 0, 0);
      const g = new THREE.Group(); g.matrixAutoUpdate = false; basis(g.matrix, o.x, o.y, o.z, o.fx, o.fy, o.fz, o.ux, o.uy, o.uz);
      const post = new THREE.MeshStandardMaterial({ color: 0x222233, metalness: 0.9, roughness: 0.3 });
      for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4, 0.8), post); p.position.set(sd * (w / 2 + 0.6), 2, 0); g.add(p); }
      const beams = [];
      for (const y of [0.7, 1.5]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff1030).multiplyScalar(4), toneMapped: false, transparent: true })); b.position.y = y; g.add(b); beams.push(b); }
      G.add(g); W.hz.push({ k, beams, type: 'laser' });
    } else if (h.k === 'meteor') {
      const ring = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.5, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2020).multiplyScalar(3), toneMapped: false, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      ring.matrixAutoUpdate = false; G.add(ring);
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 0), new THREE.MeshStandardMaterial({ color: 0x3a2018, emissive: 0xff5010, emissiveIntensity: 1.5, flatShading: true })); G.add(rock);
      W.hz.push({ k, ring, rock, type: 'meteor' });
    }
  });
}
const _hzo = {};
function updateHazards(W, t, dt) {
  if (!W.hz) return; const T = W.T;
  for (const h of W.hz) {
    const o = RK.hazardState(T, h.k, t, _hzo);
    if (h.type === 'roll') { const p = onTrack(T, o.s, o.lat, 2.3); h.m.position.set(p.x, p.y, p.z); h.m.rotation.z = -o.lat * 0.4; h.m.rotation.x += dt * 2; }
    else if (h.type === 'laser') { for (const b of h.beams) { b.visible = o.on || (o.warn > 0 && (t * 12 | 0) % 2 === 0); b.material.opacity = o.on ? 1 : 0.35; b.scale.y = o.on ? 1.6 : 0.6; } }
    else if (h.type === 'meteor') {
      const vis = o.warn > 0 || o.on; h.ring.visible = vis; h.rock.visible = o.warn > 0;
      if (vis) {
        const p = onTrack(T, o.s, o.lat, 0.08); basis(h.ring.matrix, p.x, p.y, p.z, -p.ux, -p.uy, -p.uz, p.fx, p.fy, p.fz);
        const sc = 0.4 + o.warn * 0.6; _m.makeScale(sc, sc, sc); h.ring.matrix.multiply(_m); h.ring.matrixWorldNeedsUpdate = true;
        h.ring.material.opacity = 0.5 + 0.5 * Math.sin(t * 20);
        const fallH = (1 - o.warn) * 120; h.rock.position.set(p.x + p.ux * fallH + 30 * (1 - o.warn), p.y + p.uy * fallH, p.z + p.uz * fallH); h.rock.rotation.x += dt * 4;
        if (o.warn > 0) parts.spawn(h.rock.position.x, h.rock.position.y, h.rock.position.z, (Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3, 0.6, 2.5, 1, 0.45, 0.1, 2, -1);
      }
    }
  }
}

// ── 차 모델 ───────────────────────────────────────────────
const flameMat = (c) => new THREE.ShaderMaterial({
  uniforms: { uC: { value: new THREE.Color(c) }, uT: { value: 0 }, uI: { value: 1 } },
  vertexShader: 'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: 'varying vec2 vU;uniform vec3 uC;uniform float uT,uI;void main(){float t=vU.y;float fl=.85+.15*sin(uT*60.+vU.x*20.);float a=pow(t,1.6)*fl*uI;vec3 c=mix(uC*1.5,vec3(1.,.97,.9)*3.,pow(t,4.));gl_FragColor=vec4(c*a,a);}',
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false
});
const shieldMat = () => new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 } },
  vertexShader: 'varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
  fragmentShader: 'varying vec3 vN;varying vec3 vV;uniform float uT;void main(){float f=pow(1.-abs(dot(vN,vV)),2.5);float h=.5+.5*sin(uT*4.+vN.y*10.);vec3 c=mix(vec3(.2,.8,1.),vec3(.8,.4,1.),h);gl_FragColor=vec4(c*(f*1.8+.08),f*.9+.05);}',
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
});
function nameSprite(name, color) {
  const t = canvasTex(256, 64, (g, w, h) => {
    g.font = '800 30px "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(name, w / 2, h / 2); g.fillStyle = hex(color); g.fillText(name, w / 2, h / 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(4.4, 1.1, 1); s.position.y = 2.6; s.renderOrder = 10; return s;
}
function makeCar(color, name, isMe) {
  const root = new THREE.Group(); root.matrixAutoUpdate = false;
  const g = new THREE.Group(); root.add(g);
  const body = new THREE.MeshPhysicalMaterial({ color, metalness: 0.6, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15151f, metalness: 0.85, roughness: 0.3 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe8ecff, metalness: 1, roughness: 0.12 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a1a33, metalness: 0.3, roughness: 0.05, clearcoat: 1, emissive: 0x081a40, emissiveIntensity: 0.6 });
  const glowC = new THREE.Color(color).multiplyScalar(2.2);
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); g.add(m); return m; };
  add(new THREE.CapsuleGeometry(0.5, 2.1, 8, 20), body, 0, 0.05, 0.05, Math.PI / 2, 0, 0, 1.3, 1, 0.72);
  add(new THREE.ConeGeometry(0.5, 1.3, 20), body, 0, 0.0, -1.75, -Math.PI / 2, 0, 0, 1.25, 1, 0.6);
  add(new THREE.SphereGeometry(0.45, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 0.28, -0.25, 0, 0, 0, 0.95, 0.85, 1.7);
  add(new THREE.BoxGeometry(0.55, 0.38, 2.0), body, -0.98, -0.12, 0.35, 0, 0.05, 0);
  add(new THREE.BoxGeometry(0.55, 0.38, 2.0), body, 0.98, -0.12, 0.35, 0, -0.05, 0);
  add(new THREE.BoxGeometry(2.9, 0.08, 0.5), dark, 0, -0.25, -1.45);
  add(new THREE.BoxGeometry(0.1, 0.3, 0.55), body, -1.42, -0.15, -1.45);
  add(new THREE.BoxGeometry(0.1, 0.3, 0.55), body, 1.42, -0.15, -1.45);
  add(new THREE.BoxGeometry(2.4, 0.08, 0.5), dark, 0, 0.78, 1.25);
  add(new THREE.BoxGeometry(0.08, 0.7, 0.65), body, -0.85, 0.42, 1.2, 0.25, 0, 0);
  add(new THREE.BoxGeometry(0.08, 0.7, 0.65), body, 0.85, 0.42, 1.2, 0.25, 0, 0);
  // 줄무늬
  add(new THREE.BoxGeometry(0.18, 0.02, 2.2), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.42, 0.3).scale.set(1, 1, 1);
  // 로켓 엔진
  const thr = new THREE.CylinderGeometry(0.27, 0.34, 0.8, 18);
  const flames = [], cores = [];
  for (const sx of [-0.5, 0.5]) {
    add(thr, dark, sx, 0.08, 1.38, Math.PI / 2);
    add(new THREE.TorusGeometry(0.31, 0.05, 8, 20), chrome, sx, 0.08, 1.78);
    const core = add(new THREE.CircleGeometry(0.25, 18), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8a30).multiplyScalar(3), toneMapped: false }), sx, 0.08, 1.77);
    cores.push(core);
    const fm = flameMat(0xff7a20);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1, 14, 1, true), fm);
    // 넓은 쪽이 엔진, 꼭짓점이 뒤로 (uv.y 1 = 엔진 쪽)
    fl.geometry.translate(0, 0.5, 0); fl.rotation.x = Math.PI / 2; fl.position.set(sx, 0.08, 1.8);
    const uv = fl.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    g.add(fl); flames.push(fl);
  }
  // 전조등
  for (const sx of [-0.35, 0.35]) add(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xcff6ff).multiplyScalar(3), toneMapped: false }), sx, 0.02, -2.25);
  // 꼬리등
  for (const sx of [-0.98, 0.98]) add(new THREE.BoxGeometry(0.5, 0.1, 0.06), new THREE.MeshBasicMaterial({ color: glowC, toneMapped: false }), sx, -0.02, 1.36);
  // 바닥 빛
  const hov = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5), new THREE.MeshBasicMaterial({ map: glowTex, color: glowC, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  hov.rotation.x = -Math.PI / 2; hov.position.y = -0.5; g.add(hov);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(2.4, 24, 16), shieldMat()); shield.visible = false; root.add(shield);
  let tag = null; if (!isMe && name) { tag = nameSprite(name, color); root.add(tag); }
  return { root, g, flames, cores, hov, shield, tag, color, glowC };
}

// ── 상태 ──────────────────────────────────────────────────
let ws = null, myId = 0, room = null, mode = 'menu';
let snaps = [], tickOff = null, lastSnap = null, lastMe = null;
const players = new Map();   // id → {name,color,bot}
const cars = new Map();      // id → 모델
const projMesh = new Map();
const pc = RK.newCar(0, 0), pcPrev = RK.newCar(0, 0);
let hist = [], seq = 0, outBatch = [], acc = 0, predicting = false, raceRecv = 0;
const err = { p: 0, lat: 0, h: 0, yaw: 0 };
let myItem = 0, myUses = 0, myRoul = 0, myFin = 0, lastTier = 0, lastCountShown = -1, results = null;
let camShake = 0, rearView = false, prevMine = new Map();

// ── 입력 ──────────────────────────────────────────────────
const keys = new Set();
const touch = { l: 0, r: 0, d: 0, i: 0, b: 0, n: 0 };
let steerSm = 0, gp = null;
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  Snd.init();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
function bindTouch(id, k) {
  const el = $(id);
  const on = e => { e.preventDefault(); touch[k] = 1; el.classList.add('on'); Snd.init(); };
  const off = e => { e.preventDefault(); touch[k] = 0; el.classList.remove('on'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
}
bindTouch('tl', 'l'); bindTouch('tr', 'r'); bindTouch('tdrift', 'd'); bindTouch('titem', 'i'); bindTouch('tbrake', 'b'); bindTouch('tnitro', 'n');
function sampleInput() {
  const K = c => keys.has(c);
  let target = (K('KeyD') || K('ArrowRight') ? 1 : 0) - (K('KeyA') || K('ArrowLeft') ? 1 : 0) + touch.r - touch.l;
  let a = K('KeyW') || K('ArrowUp') || (isTouch && !touch.b) ? 1 : 0;
  let b = K('KeyS') || K('ArrowDown') || touch.b ? 1 : 0;
  let d = K('Space') || K('ShiftLeft') || K('ShiftRight') || touch.d ? 1 : 0;
  let i = K('KeyE') || K('ControlLeft') || K('ControlRight') || K('KeyX') || touch.i ? 1 : 0;
  let n = K('KeyQ') || K('KeyR') || K('KeyF') || K('KeyN') || touch.n ? 1 : 0;
  rearView = K('KeyC');
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p) continue;
    const ax = p.axes[0] || 0; if (Math.abs(ax) > 0.15) target = ax;
    const bt = n => p.buttons[n] && (p.buttons[n].pressed || p.buttons[n].value > 0.4);
    if (bt(7) || bt(0)) a = 1; if (bt(6) || bt(2)) b = 1; if (bt(5) || bt(1)) d = 1; if (bt(4)) i = 1; if (bt(3)) n = 1;
    if (bt(14)) target = -1; if (bt(15)) target = 1;
  }
  target = Math.max(-1, Math.min(1, target));
  const rate = Math.abs(target) > Math.abs(steerSm) ? 7 : 12;
  steerSm += Math.max(-rate * DT, Math.min(rate * DT, target - steerSm));
  if (Math.abs(target) > 0.15 && Math.abs(target) < 1) steerSm = target;   // 아날로그는 바로
  const s = Math.round(steerSm * 100) / 100;
  return { s, a, b, d, i, n };
}

// ── 네트워크 ──────────────────────────────────────────────
// 혼자 달리기: 서버 없이 브라우저 안에서 같은 방 코드(room.js)를 돌려요
const localLb = {
  d: (() => { try { return JSON.parse(store.get('lb', '{}')) || {}; } catch (e) { return {}; } })(),
  add(track, name, time, best) {
    const t = this.d[track] || (this.d[track] = { race: [], lap: [] });
    const put = (arr, v) => { if (!v || v < 5) return; arr.push({ n: name, v }); arr.sort((a, b) => a.v - b.v); arr.length = Math.min(arr.length, 10); };
    put(t.race, time); put(t.lap, best); store.set('lb', JSON.stringify(this.d));
  },
  get(track) { return this.d[track] || { race: [], lap: [] }; }
};
function localWS(join) {
  const G = window.RKGame;
  const r = new G.Room('', true, join.track | 0, localLb);
  const L = { readyState: 1, onmessage: null, onclose: null, timer: 0 };
  const conn = { sendRaw: s => { if (L.readyState === 1) queueMicrotask(() => { if (ws === L) onMsg(JSON.parse(s)); }); } };
  const me = r.addHuman(conn, join.name || '나');
  conn.sendRaw(JSON.stringify({ t: 'hi', id: me.id, code: '' }));
  let acc = 0, lastT = performance.now();
  L.timer = setInterval(() => {
    const now = performance.now(); acc += (now - lastT) / 1000; lastT = now;
    if (acc > 0.25) acc = 0.25;
    while (acc >= RK.DT) { acc -= RK.DT; r.step(); }
  }, 5);
  L.send = str => {
    const m = JSON.parse(str);
    if (m.t === 'i') r.pushInputs(me, m.l);
    else if (m.t === 'start' && r.state === 'lobby') r.startCountdown();
    else if (m.t === 'track') r.setTrack(m.v);
    else if (m.t === 'ping') conn.sendRaw(JSON.stringify({ t: 'pong', c: m.c, k: r.tick }));
  };
  L.close = () => { L.readyState = 3; clearInterval(L.timer); };
  r.startCountdown();
  return L;
}
let online = false;
function connect(join) {
  if (ws) try { ws.close(); } catch (e) {}
  if (join.mode === 'solo') { ws = localWS(join); return; }
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  ws.onopen = () => ws.send(JSON.stringify(join));
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } onMsg(m); };
  ws.onclose = () => { if (mode !== 'menu') { showErr('서버와 연결이 끊겼어요'); toMenu(); } };
}
const send = m => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
setInterval(() => send({ t: 'ping', c: performance.now() }), 2000);
let rtt = 0;

function onMsg(m) {
  if (m.t === 'hi') { myId = m.id; return; }
  if (m.t === 'err') { showErr(m.msg); toMenu(); return; }
  if (m.t === 'pong') { rtt = performance.now() - m.c; return; }
  if (m.t === 'room') return onRoom(m);
  if (m.t === 's') return onSnap(m);
  if (m.t === 'res') { results = m; setTimeout(showResults, 1800); return; }
}

function onRoom(m) {
  const prevSt = room && room.st;
  room = m;
  players.clear(); for (const p of m.players) players.set(p.id, p);
  buildWorld(m.track);
  for (const [id, c] of cars) if (!players.has(id)) { scene.remove(c.root); cars.delete(id); }
  if (m.st === 'lobby') {
    mode = 'lobby'; showScreen('lobby'); $('hud').classList.remove('on'); $('touch').classList.remove('on');
    for (const [id, c] of cars) { scene.remove(c.root); } cars.clear();
    snaps = []; results = null; predicting = false; Snd.silence();
    renderLobby();
  } else if (m.st === 'count' || m.st === 'race') {
    if (mode !== 'race') {
      mode = 'race'; showScreen(null); $('hud').classList.add('on'); if (isTouch) $('touch').classList.add('on');
      hist = []; predicting = false; myFin = 0; lastCountShown = -1; snaps = []; tickOff = null;
    }
    const me = players.get(myId);
    $('spect').style.display = me && me.spect ? 'block' : 'none';
  }
  if (Snd.music) Snd.music.on = soundOn;
}

function onSnap(m) {
  const now = performance.now();
  const est = m.k - now * 0.06;
  if (tickOff === null || est > tickOff) tickOff = est; else tickOff += (est - tickOff) * 0.02;
  const map = new Map(); for (const c of m.c) map.set(c[0], c);
  const sn = { k: m.k, cars: map, pr: m.pr, bx: m.bx, st: m.st, tm: m.tm, t: now };
  snaps.push(sn); if (snaps.length > 40) snaps.shift();
  if (room) room.st = m.st;
  lastSnap = sn; raceRecv = now;
  // 내 차 맞추기
  if (m.me) {
    lastMe = m.me; myItem = m.me.i; myUses = m.me.u; myRoul = m.me.r;
    if (m.me.f && !myFin) { myFin = 1; }
    const mine = map.get(myId);
    if (mine && m.st === 'race' && !myFin) reconcile(m.me);
    else predicting = false;
  }
  for (const e of m.ev) onEvent(e);
  if (m.st === 'count') {
    const n = Math.ceil(m.tm);
    if (n !== lastCountShown && n <= 3 && n >= 1) { lastCountShown = n; bigText(String(n), 900); Snd.play('beep'); finalLap = false; if (Snd.music) Snd.music.bpm = 132; }
  } else if (m.st === 'race' && lastCountShown > 0) { lastCountShown = 0; bigText('출발!', 900); Snd.play('go'); }
}

function reconcile(me) {
  const T = world.T;
  const before = { p: pc.p, lat: pc.lat, h: pc.h, yaw: pc.yaw };
  RK.STATE_KEYS.forEach((k, i) => pc[k] = me.s[i]);
  hist = hist.filter(h => h.q > me.a);
  for (const h of hist) RK.stepCar(pc, h, T, DT);
  if (predicting) {
    const dp = before.p - pc.p, dl = before.lat - pc.lat;
    if (Math.abs(dp) < 20 && Math.abs(dl) < 8) {
      err.p += dp; err.lat += dl; err.h += before.h - pc.h; err.yaw += RK.wrapA(before.yaw - pc.yaw);
      pcPrev.p -= dp; pcPrev.lat -= dl; pcPrev.h -= before.h - pc.h; pcPrev.yaw -= RK.wrapA(before.yaw - pc.yaw);
    } else { err.p = err.lat = err.h = err.yaw = 0; RK.copyCar(pc, pcPrev); }
  } else { RK.copyCar(pc, pcPrev); err.p = err.lat = err.h = err.yaw = 0; }
  predicting = true;
}

function onEvent(e) {
  const [k, id] = e, mine = id === myId;
  const near = (id) => { const c = cars.get(id); if (!c) return 0; const d = c.root.position.distanceTo(camera.position); return d < 120 ? 1 - d / 120 : 0; };
  const c = cars.get(id);
  switch (k) {
    case 'box': if (mine) Snd.play('box'); break;
    case 'boost': if (mine || near(id) > 0.3) Snd.play('boost'); if (mine) camShake = 0.3; break;
    case 'shield': if (mine) Snd.play('shield'); break;
    case 'pop': if (mine || near(id) > 0.3) Snd.play('pop'); break;
    case 'drop': if (mine) Snd.play('drop'); break;
    case 'fire': if (mine || near(id) > 0.3) Snd.play('fire'); break;
    case 'emp': Snd.play('emp'); flash('#8fd6ff', 0.5); if (!mine) toast('⚡ EMP 쇼크!'); break;
    case 'hit': if (mine) { Snd.play('hit'); camShake = 1; flash('#ff2040', 0.35); } else if (near(id) > 0.2) Snd.play('bump');
      if (c) burst(c.root.position, 0xffa040, 40, 14); break;
    case 'boom': { const T = world.T, o = onTrack(T, e[2], e[3], 1); _v.set(o.x, o.y, o.z); burst(_v, 0xff7020, 70, 22); if (_v.distanceTo(camera.position) < 150) Snd.play('boom'); break; }
    case 'wall': if (mine) { Snd.play('wall'); camShake = Math.max(camShake, 0.25); } if (c) sparks(c, 12); break;
    case 'bump': if (mine) Snd.play('bump'); break;
    case 'land': if (mine) { Snd.play('land'); camShake = Math.max(camShake, 0.3); } break;
    case 'lap': if (mine) { Snd.play('lap'); if (e[2] >= C.LAPS) { bigText('FINAL LAP', 1400); finalLap = true; if (Snd.music) Snd.music.bpm = 152; } else toast(`${e[2]}바퀴째`); } break;
    case 'fin': if (mine) { Snd.play('fin'); const p = players.get(myId); bigText('완주!', 1600); } break;
    case 'start': if (mine) { toast('로켓 스타트! 🚀'); Snd.play('boost'); } break;
    case 'near': if (mine) { combo('아슬아슬! +니트로', '#7af'); Snd.play('near'); } break;
    case 'draft': if (mine) { combo('슬립스트림!', '#6ff'); Snd.play('draft'); } break;
    case 'perfect': if (mine) { combo('퍼펙트 드리프트!', '#f7f'); } break;
    case 'trick': if (mine) combo('트릭 성공!', '#ff6'); break;
    case 'nitrofull': if (mine) { combo(isTouch ? '니트로 준비! ⚡ 버튼' : '니트로 준비! Q 키', '#0ff'); Snd.play('ready'); } break;
    case 'nitro': if (mine) { bigText('NITRO!', 900); Snd.play('nitro'); camShake = 1.4; flash('#40e0ff', 0.45); nitroT = 2.8; } else if (near(id) > 0.2) Snd.play('boost'); if (c) burst(c.root.position, 0x40e0ff, 60, 18); break;
    case 'falloff': if (mine) { combo('추락!', '#f55'); Snd.play('fall'); } break;
    case 'hz': if (mine) { combo({ laser: '레이저에 맞았어요!', rock: '바위에 깔렸어요!', meteor: '운석 직격!' }[e[2]] || '앗!', '#f84'); if (e[2] === 'laser') Snd.play('laser'); } break;
    case 'zap': Snd.play('zap'); if (!mine) combo('🌩️ 번개!', '#fff'); break;
    case 'meteor': { const o = RK.hazardState(world.T, id, raceNow, {}); const p = onTrack(world.T, o.s, o.lat, 1); _v.set(p.x, p.y, p.z); burst(_v, 0xff6a10, 90, 26); if (_v.distanceTo(camera.position) < 160) { Snd.play('boom'); camShake = Math.max(camShake, 0.8 * (1 - _v.distanceTo(camera.position) / 160)); } break; }
  }
}

// ── 화면 그리기 ───────────────────────────────────────────
const pose = {}, tmpCar = RK.newCar(0, 0);
function interpCar(id, rt) {
  let a = null, b = null;
  for (let i = snaps.length - 1; i >= 0; i--) { if (snaps[i].k <= rt) { a = snaps[i]; b = snaps[i + 1] || null; break; } }
  if (!a) a = snaps[0];
  const ca = a && a.cars.get(id); if (!ca) return null;
  const cb = b && b.cars.get(id);
  let t = 0; if (cb) t = Math.max(0, Math.min(1, (rt - a.k) / (b.k - a.k)));
  const out = tmpCar;
  if (cb) {
    out.p = lerp(ca[1], cb[1], t); out.lat = lerp(ca[2], cb[2], t); out.h = lerp(ca[3], cb[3], t); out.v = lerp(ca[4], cb[4], t); out.yaw = lerpA(ca[5], cb[5], t);
  } else {
    const ex = Math.min(10, Math.max(0, rt - a.k)) / 60;
    out.p = ca[1] + ca[4] * Math.cos(ca[5]) * ex; out.lat = ca[2]; out.h = ca[3]; out.v = ca[4]; out.yaw = ca[5];
  }
  const src = cb || ca;
  out.dr = src[6]; out.tier = src[7]; out.boost = src[8]; out.spin = src[9]; out.shield = src[10]; out.fall = src[11];
  return out;
}

const sparkCols = [[0, 0, 0], [0.3, 0.7, 1], [1, 0.55, 0.1], [0.75, 0.3, 1]];
function sparks(c, n) { const p = c.root.position; for (let i = 0; i < n; i++) parts.spawn(p.x, p.y, p.z, (Math.random() - 0.5) * 16, Math.random() * 8, (Math.random() - 0.5) * 16, 0.4, 0.25, 1, 0.8, 0.4, 2, 20); }
function burst(p, col, n, sp) {
  const c = new THREE.Color(col);
  for (let i = 0; i < n; i++) { _w.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(sp * (0.3 + Math.random())); parts.spawn(p.x, p.y, p.z, _w.x, _w.y, _w.z, 0.6 + Math.random() * 0.6, 1 + Math.random() * 1.6, c.r, c.g * (0.6 + Math.random() * 0.6), c.b, 2.5, 4); }
  for (let i = 0; i < n / 2; i++) parts.spawn(p.x, p.y, p.z, (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6, 1.4, 2.5 + Math.random() * 2, 0.25, 0.22, 0.25, 1, -2);
}

function drawCar(id, st, dt, t, isMe) {
  const p = players.get(id); if (!p) return;
  let c = cars.get(id);
  if (!c) { c = makeCar(p.color, p.name, isMe); cars.set(id, c); scene.add(c.root); }
  const T = world.T;
  RK.carPose(T, st, pose);
  // 회전 (스핀)
  let fx = pose.fx, fy = pose.fy, fz = pose.fz;
  if (st.spin > 0) {
    const a = st.spin * 13; _v.set(fx, fy, fz).applyAxisAngle(_w.set(pose.ux, pose.uy, pose.uz), a); fx = _v.x; fy = _v.y; fz = _v.z;
  }
  let px = pose.x, py = pose.y, pz = pose.z;
  if (st.fall > 0) { const o = st.fall * st.fall * 30; px += pose.ux * o; py += pose.uy * o; pz += pose.uz * o; }
  basis(c.root.matrix, px, py, pz, fx, fy, fz, pose.ux, pose.uy, pose.uz);
  c.root.matrixWorldNeedsUpdate = true;
  c.root.visible = !(st.fall > 0 && (t * 12 | 0) % 2);
  // 몸 기울기 · 흔들림
  const steerVis = isMe ? steerSm : 0;
  c.g.rotation.z = lerp(c.g.rotation.z, -(st.dr ? st.dr * 0.18 : steerVis * 0.12), 1 - Math.exp(-dt * 10));
  c.g.position.y = Math.sin(t * 5 + id) * 0.06;
  c.g.rotation.x = st.h > 0 ? -0.15 : 0;
  // 불꽃
  const boosting = st.boost > 0, sp = Math.abs(st.v) / C.MAXV;
  const len = 0.5 + sp * 1.4 + (boosting ? 2.6 : 0) + Math.random() * 0.3;
  const col = boosting ? 0x40c8ff : st.dr && st.tier ? [0, 0x3aa8ff, 0xff8a10, 0xc050ff][st.tier] : 0xff6a10;
  for (const f of c.flames) { f.scale.set(boosting ? 1.35 : 1, len, boosting ? 1.35 : 1); f.material.uniforms.uC.value.set(col); f.material.uniforms.uT.value = t; f.material.uniforms.uI.value = 0.6 + sp * 0.6 + (boosting ? 0.8 : 0); }
  for (const cr of c.cores) cr.material.color.set(col).multiplyScalar(3);
  c.shield.visible = !!st.shield; c.shield.material.uniforms.uT.value = t;
  // 파티클: 배기 · 드리프트 불꽃
  if (c.root.visible && world) {
    const m = c.root.matrix.elements;   // x축 0..2, y축 4..6, z축 8..10
    const back = (sx, off) => [px + m[0] * sx + m[8] * off + m[4] * 0.08, py + m[1] * sx + m[9] * off + m[5] * 0.08, pz + m[2] * sx + m[10] * off + m[6] * 0.08];
    const cc = new THREE.Color(col);
    const n = (quality === 'high' ? 2 : 1) * (boosting ? 2 : 1);
    for (const sx of [-0.5, 0.5]) for (let i = 0; i < n; i++) {
      const [x, y, z] = back(sx, 1.9 + len * 0.6);
      parts.spawn(x, y, z, m[8] * 6 + (Math.random() - 0.5) * 2, m[9] * 6 + Math.random(), m[10] * 6 + (Math.random() - 0.5) * 2, 0.25 + Math.random() * 0.2, boosting ? 0.9 : 0.55, cc.r, cc.g, cc.b, 3, 0);
    }
    if (st.dr && st.tier) {
      const sc = sparkCols[st.tier];
      for (const sx of [-1.1, 1.1]) for (let i = 0; i < 2; i++) {
        const [x, y, z] = back(sx, 1.2);
        parts.spawn(x - m[4] * 0.5, y - m[5] * 0.5, z - m[6] * 0.5, (Math.random() - 0.5) * 8 + m[0] * sx * 4, Math.random() * 6, (Math.random() - 0.5) * 8 + m[2] * sx * 4, 0.3, 0.35, sc[0], sc[1], sc[2], 2, 15);
      }
    }
    if (st.shield) c.shield.rotation.y += dt;
  }
  c.hov.material.opacity = st.h > 0 ? 0.3 : 0.8;
  return c;
}

function drawProj(sn, t) {
  const seen = new Set();
  for (const pr of (sn ? sn.pr : [])) {
    seen.add(pr[0]);
    let m = projMesh.get(pr[0]);
    if (!m) {
      m = new THREE.Group(); m.matrixAutoUpdate = false;
      if (pr[1] === 8) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.4, 12), new THREE.MeshStandardMaterial({ color: 0x5a1a9a, metalness: 0.8, roughness: 0.3, emissive: 0x6a20ff, emissiveIntensity: 1 })); b.rotation.x = Math.PI / 2; m.add(b);
        const n = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd23f).multiplyScalar(3), toneMapped: false })); n.rotation.x = -Math.PI / 2; n.position.z = -1.6; m.add(n);
      } else if (pr[1] === 2) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.4, 12), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.8, roughness: 0.3 })); b.rotation.x = Math.PI / 2; m.add(b);
        const n = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3030).multiplyScalar(2), toneMapped: false })); n.rotation.x = -Math.PI / 2; n.position.z = -0.95; m.add(n);
      } else {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.4, flatShading: true })); m.add(b);
        for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 6), b.material); const d = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]][i]; s.position.set(d[0] * 0.6, d[1] * 0.6, d[2] * 0.6); s.lookAt(d[0] * 2, d[1] * 2, d[2] * 2); s.rotateX(Math.PI / 2); m.add(s); }
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2020).multiplyScalar(3), toneMapped: false })); l.position.y = 0.6; m.add(l); m.userData.light = l;
      }
      m.userData.k = pr[1]; scene.add(m); projMesh.set(pr[0], m);
    }
    let p = pr[2];
    if ((pr[1] === 2 || pr[1] === 8) && sn) p += (pr[1] === 8 ? 110 : 80) * Math.min(0.15, (performance.now() - sn.t) / 1000);
    const o = onTrack(world.T, p, pr[3], pr[1] === 8 ? pr[4] + 0.6 : pr[1] === 2 ? 1.0 : 0.5);
    basis(m.matrix, o.x, o.y, o.z, o.fx, o.fy, o.fz, o.ux, o.uy, o.uz); m.matrixWorldNeedsUpdate = true;
    if (pr[1] === 8) for (let i = 0; i < 5; i++) parts.spawn(o.x - o.fx * 2, o.y - o.fy * 2, o.z - o.fz * 2, (Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3, 0.8, 1.3, 0.7, 0.3, 1, 1.5, -1);
    if (pr[1] === 2) for (let i = 0; i < 3; i++) parts.spawn(o.x - o.fx * 1.2, o.y - o.fy * 1.2, o.z - o.fz * 1.2, (Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2, 0.6, 0.8, 1, 0.5, 0.2, 1.5, -1);
    else if (m.userData.light) m.userData.light.visible = (t * 4 | 0) % 2 === 0;
  }
  for (const [id, m] of projMesh) if (!seen.has(id)) { scene.remove(m); projMesh.delete(id); }
}

// ── 카메라 ───────────────────────────────────────────────
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camUp = new THREE.Vector3(0, 1, 0);
let camInit = false, fov = 72, flyS = 0;
function followCam(st, dt, isRace) {
  const T = world.T; RK.carPose(T, st, pose);
  const sp = Math.abs(st.v) / C.MAXV, dir = rearView ? -1 : 1;
  const ca = st.yaw * 0.8 - (st.dr || 0) * 0.2;    // 드리프트 땐 미끄러지는 쪽을 조금 봐요
  const f = RK.frame(T, st.p, _f);
  const cy = Math.cos(ca), sy = Math.sin(ca);
  const fx = f.tx * cy + f.rx * sy, fy = f.ty * cy + f.ry * sy, fz = f.tz * cy + f.rz * sy;
  const dist = 7.2 + sp * 2.2;
  const tx = pose.x - fx * dist * dir + f.ux * (2.6 + sp * 0.4), ty = pose.y - fy * dist * dir + f.uy * (2.6 + sp * 0.4), tz = pose.z - fz * dist * dir + f.uz * (2.6 + sp * 0.4);
  const k = camInit ? 1 - Math.exp(-dt * 9) : 1;
  camPos.x = lerp(camPos.x, tx, k); camPos.y = lerp(camPos.y, ty, k); camPos.z = lerp(camPos.z, tz, k);
  camLook.set(pose.x + pose.fx * 5 * dir + f.ux * 1.2, pose.y + pose.fy * 5 * dir + f.uy * 1.2, pose.z + pose.fz * 5 * dir + f.uz * 1.2);
  // 커브 기울기는 반만 따라가고, 뒤집히는 구간은 다 따라가요
  const wu = Math.max(0, f.uy) * 0.9;
  _v.set(f.ux, f.uy + wu, f.uz).normalize();
  camUp.lerp(_v, camInit ? 1 - Math.exp(-dt * 5) : 1).normalize();
  camInit = true;
  camera.position.copy(camPos);
  if (camShake > 0) { camera.position.x += (Math.random() - 0.5) * camShake * 0.8; camera.position.y += (Math.random() - 0.5) * camShake * 0.8; camShake = Math.max(0, camShake - dt * 2.5); }
  camera.up.copy(camUp); camera.lookAt(camLook);
  const tf = 72 + sp * 14 + (st.boost > 0 ? 10 : 0) + (nitroT > 0 ? 12 : 0);
  fov = lerp(fov, tf, 1 - Math.exp(-dt * 4)); camera.fov = fov; camera.updateProjectionMatrix();
}
function flyCam(dt) {
  const T = world.T; flyS += dt * 38;
  const o = onTrack(T, flyS, 0, 0), o2 = onTrack(T, flyS + 60, 0, 0);
  camera.position.set(o.x - o.fx * 20 + o.rx * 14, o.y + 16, o.z - o.fz * 20 + o.rz * 14);
  camera.up.set(0, 1, 0); camera.lookAt(o2.x, o2.y + 2, o2.z);
  camera.fov = 70; camera.updateProjectionMatrix(); camInit = false;
}

// ── HUD ──────────────────────────────────────────────────
let miniPts = null, miniBox = null;
function drawMiniBase(T) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < T.N; i++) { x0 = Math.min(x0, T.px[i]); x1 = Math.max(x1, T.px[i]); z0 = Math.min(z0, T.pz[i]); z1 = Math.max(z1, T.pz[i]); }
  const sc = 300 / Math.max(x1 - x0, z1 - z0);
  miniBox = { x0, z0, sc, ox: (340 - (x1 - x0) * sc) / 2, oz: (340 - (z1 - z0) * sc) / 2 };
  miniPts = [];
  for (let i = 0; i < T.N; i += 4) miniPts.push(mm(T.px[i], T.pz[i]));
}
const mm = (x, z) => [miniBox.ox + (x - miniBox.x0) * miniBox.sc, miniBox.oz + (z - miniBox.z0) * miniBox.sc];
const miniCtx = $('mini').getContext('2d');
function drawMini(list) {
  const g = miniCtx; g.clearRect(0, 0, 340, 340);
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 16; g.beginPath(); miniPts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 7; g.stroke();
  const T = world.T;
  for (const [id, st] of list) {
    const o = onTrack(T, st.p, st.lat, 0), [x, y] = mm(o.x, o.z), p = players.get(id);
    g.fillStyle = p ? hex(p.color) : '#fff';
    g.beginPath(); g.arc(x, y, id === myId ? 11 : 7.5, 0, 7); g.fill();
    if (id === myId) { g.strokeStyle = '#fff'; g.lineWidth = 3.5; g.stroke(); }
  }
}
let centerT = 0, toastT = 0, nitroT = 0, finalLap = false, raceNow = 0;
function combo(s, c) { const box = $('combo'); const d = document.createElement('div'); d.textContent = s; d.style.color = c; box.appendChild(d); setTimeout(() => d.remove(), 1300); while (box.children.length > 3) box.firstChild.remove(); }
function bigText(s, ms) { const el = $('center'); el.textContent = s; el.style.opacity = 1; clearTimeout(centerT); centerT = setTimeout(() => el.style.opacity = 0, ms); }
function toast(s) { const el = $('toast'); el.textContent = s; el.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => el.style.opacity = 0, 1400); }
let flashA = 0, flashC = '#fff';
function flash(c, a) { flashC = c; flashA = a; }
const fmt = t => { t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };
let rollT = 0, rollIcon = 1;
function updateHud(dt, mineSt, sn) {
  if (!sn) return;
  const mine = sn.cars.get(myId);
  if (mine) {
    $('place').innerHTML = mine[12] + '<small>/' + sn.cars.size + '</small>';
    $('lap').textContent = `바퀴 ${Math.min(C.LAPS, mine[14])}/${C.LAPS}`;
  }
  const rt = sn.st === 'race' ? sn.tm + (performance.now() - sn.t) / 1000 : 0;
  raceNow = sn.st === 'race' ? rt : sn.st === 'done' ? raceNow + dt : 0;
  $('time').innerHTML = fmt(myFin && lastMe ? lastMe.ft : rt) + (lastMe && lastMe.b ? `<div class="best">최고 바퀴 ${fmt(lastMe.b)}</div>` : '');
  const v = mineSt ? Math.abs(mineSt.v) * 3.6 : 0;
  $('speed').innerHTML = Math.round(v) + '<small>km/h</small>';
  $('boostbar').firstChild.style.width = mineSt ? Math.min(100, (mineSt.dr ? mineSt.dc / RK.TIER[3] : 0) * 100) + '%' : '0';
  // 아이템
  const ib = $('itembox');
  if (myRoul) {
    rollT -= dt; if (rollT <= 0) { rollT = 0.07; rollIcon = rollIcon % 6 + 1; Snd.play('roll'); }
    ib.innerHTML = RK.ITEMS[rollIcon].icon;
  } else if (myItem) {
    if (ib.dataset.k !== String(myItem)) Snd.play('get');
    ib.innerHTML = RK.ITEMS[myItem].icon + (myUses > 1 ? `<span class="n">×${myUses}</span>` : '');
  } else ib.innerHTML = '';
  ib.dataset.k = myRoul ? 'r' : String(myItem);
  const nv = lastMe ? lastMe.n || 0 : 0, nb = $('nitro');
  nb.firstChild.style.width = nv + '%'; nb.classList.toggle('full', nv >= 100); $('tnitro').classList.toggle('ready', nv >= 100);
  $('wrong').style.display = mineSt && Math.abs(mineSt.yaw) > 2.0 && Math.abs(mineSt.v) > 4 && !myFin ? 'block' : 'none';
  $('net').textContent = rtt ? `${Math.round(rtt)}ms` : '';
  // 순위표
  const rows = [...sn.cars.values()].sort((a, b) => a[12] - b[12]);
  $('board').innerHTML = rows.map(r => { const p = players.get(r[0]) || {}; return `<div class="${r[0] === myId ? 'me' : ''}"><b>${r[12]}</b><span class="dot" style="color:${hex(p.color || 0xffffff)};background:currentColor"></span>${esc(p.name || '?')}${r[13] ? ' 🏁' : ''}</div>`; }).join('');
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function drawFx(dt, st) {
  const w = fxc.width, h = fxc.height; fx2.clearRect(0, 0, w, h);
  if (st && mode === 'race') {
    const sp = Math.abs(st.v) / C.MAXV, boosting = st.boost > 0, nit = nitroT > 0;
    if (nitroT > 0) nitroT -= dt;
    const n = nit ? 110 : boosting ? 46 : sp > 0.85 ? 16 : 0;
    fx2.strokeStyle = nit ? 'rgba(120,255,255,.7)' : boosting ? 'rgba(180,240,255,.45)' : 'rgba(255,255,255,.18)';
    fx2.lineWidth = nit ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r0 = (0.35 + Math.random() * 0.3) * Math.max(w, h), r1 = r0 + 40 + Math.random() * 120;
      fx2.beginPath(); fx2.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0); fx2.lineTo(w / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1); fx2.stroke();
    }
  }
  if (st && mode === 'race' && (finalLap || nitroT > 0)) {
    const g = fx2.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    const a = nitroT > 0 ? 0.35 : 0.12 + 0.08 * Math.sin(performance.now() / 180);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, nitroT > 0 ? `rgba(0,220,255,${a})` : `rgba(255,30,60,${a})`);
    fx2.fillStyle = g; fx2.fillRect(0, 0, w, h);
  }
  if (flashA > 0) { fx2.fillStyle = flashC; fx2.globalAlpha = flashA; fx2.fillRect(0, 0, w, h); fx2.globalAlpha = 1; flashA = Math.max(0, flashA - dt * 1.5); }
}

// ── 화면 전환 ─────────────────────────────────────────────
function showScreen(id) { for (const s of ['menu', 'lobby', 'results']) $(s).classList.toggle('on', s === id); }
function showErr(m) { const e = $('err'); e.textContent = m; e.style.display = 'block'; setTimeout(() => e.style.display = 'none', 3000); }
function toMenu() {
  mode = 'menu'; room = null; myId = 0; showScreen('menu'); $('hud').classList.remove('on'); $('touch').classList.remove('on');
  for (const [, c] of cars) scene.remove(c.root); cars.clear();
  for (const [, m] of projMesh) scene.remove(m); projMesh.clear();
  snaps = []; predicting = false; Snd.silence(); if (Snd.music) Snd.music.on = false;
  if (ws) { const w = ws; ws = null; try { w.close(); } catch (e) {} }
}
function renderLobby() {
  if (!room) return;
  const def = RK.TRACKS[room.track];
  $('lTrack').textContent = def.name;
  $('lCode').textContent = room.priv ? room.code : '';
  $('lCodeHelp').textContent = !room.code && room.priv ? '혼자 달리기 · 봇 7대와 함께 달려요' : room.priv ? '친구에게 이 코드를 알려 주세요' : '빠른 시작 · 사람이 모자라면 봇이 함께 달려요';
  $('lPlayers').innerHTML = room.players.map(p => `<li><span class="dot" style="color:${hex(p.color)};background:currentColor"></span>${esc(p.name)}${p.id === room.host && room.priv ? ' 👑' : ''}${p.id === myId ? ' (나)' : ''}</li>`).join('');
  const host = room.priv && room.host === myId;
  $('hostBox').style.display = host ? 'block' : 'none';
  if (host) $('lTrackSel').value = room.track;
}
setInterval(() => {
  if (mode === 'lobby' && room) $('lTimer').textContent = room.priv ? (room.host === myId ? '준비되면 출발을 누르세요' : '방장이 출발을 누르면 시작해요') : `${Math.max(0, Math.ceil(room.tm))}초 뒤 출발`;
  if (room && mode === 'lobby') room.tm -= 0.25;
  if (results && $('results').classList.contains('on') && room) { $('rTimer').textContent = '잠시 뒤 다음 레이스 대기실로 가요'; }
}, 250);
function showResults() {
  if (!results || mode !== 'race') return;
  showScreen('results');
  $('rTable').innerHTML = results.list.map(r => `<tr class="${r.id === myId ? 'me' : ''}"><td>${r.place}</td><td><span class="dot" style="display:inline-block;color:${hex(r.color)};background:currentColor;margin-right:6px"></span>${esc(r.name)}${r.bot ? ' 🤖' : ''}</td><td class="t">${r.time ? fmt(r.time) : '-'}</td></tr>`).join('');
  renderLb('race');
}
function renderLb(k) {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  const arr = (results && results.lb && results.lb[k]) || [];
  $('lbTable').innerHTML = arr.length ? arr.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.n)}</td><td class="t">${fmt(e.v)}</td></tr>`).join('') : '<tr><td></td><td style="color:var(--mute)">아직 기록이 없어요</td><td></td></tr>';
}
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => renderLb(b.dataset.k));

// 메뉴
RK.TRACKS.forEach((t, i) => { for (const s of ['trackSel', 'lTrackSel']) { const o = document.createElement('option'); o.value = i; o.textContent = t.name; $(s).appendChild(o); } });
$('name').value = store.get('name', '');
const joinWith = (extra) => {
  Snd.init();
  const name = $('name').value.trim(); store.set('name', name);
  connect(Object.assign({ t: 'join', name }, extra));
};
$('bSolo').onclick = () => joinWith({ mode: 'solo', track: +$('trackSel').value });
$('bQuick').onclick = () => joinWith({ mode: 'quick' });
fetch('health', { cache: 'no-store' }).then(r => r.ok ? r.text() : '').catch(() => '').then(t => {
  online = t.trim() === 'ok';
  document.querySelectorAll('.onl').forEach(e => e.style.display = online ? '' : 'none');
});
$('bCreate').onclick = () => joinWith({ mode: 'create', track: +$('trackSel').value });
$('bJoin').onclick = () => { const c = $('code').value.trim().toUpperCase(); if (c.length !== 5) return showErr('방 코드 5글자를 넣어 주세요'); joinWith({ mode: 'code', code: c }); };
$('bStart').onclick = () => send({ t: 'start' });
$('lTrackSel').onchange = () => send({ t: 'track', v: +$('lTrackSel').value });
$('bLeave').onclick = $('bLeave2').onclick = () => { send({ t: 'leave' }); toMenu(); };
$('bQual').textContent = quality === 'high' ? '높음' : '낮음';
$('bQual').onclick = () => { quality = quality === 'high' ? 'low' : 'high'; store.set('q', quality); location.reload(); };
$('bSnd').textContent = soundOn ? '켜짐' : '꺼짐';
$('bSnd').onclick = () => { soundOn = !soundOn; store.set('snd', soundOn ? '1' : '0'); $('bSnd').textContent = soundOn ? '켜짐' : '꺼짐'; Snd.init(); Snd.setOn(soundOn); };
addEventListener('pointerdown', () => Snd.init(), { once: true });

// ── 메인 루프 ─────────────────────────────────────────────
let last = performance.now(), clock = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const rdt = Math.min(0.25, Math.max(0, (now - last) / 1000)), dt = Math.min(0.1, rdt); last = now; clock += dt;
  if (!world) return;
  let mineSt = null;
  if (mode === 'race' && lastSnap) {
    // 고정 60틱: 입력 만들기 + 내 차 미리 움직이기
    acc += rdt;
    const st = lastSnap.st;
    while (acc >= DT) {
      acc -= DT;
      if (st !== 'count' && st !== 'race') continue;
      const inp = sampleInput();
      const e = { q: ++seq, s: inp.s, a: inp.a, b: inp.b, d: inp.d, i: inp.i, n: inp.n };
      outBatch.push([e.q, e.s, e.a, e.b, e.d, e.i, e.n]);
      if (st === 'race' && predicting) {
        hist.push(e); if (hist.length > 240) hist.shift();
        RK.copyCar(pc, pcPrev);
        const hadDr = pc.dr, hadTr = pc.tr, hadBoost = pc.boost;
        RK.stepCar(pc, e, world.T, DT);
        if (hadDr && !pc.dr && pc.boost > hadBoost + 0.3) { Snd.play('mini'); toast(['', '미니 터보!', '슈퍼 터보!', '울트라 터보!'][hadDr && pc.boost >= RK.TIER_T[3] - 0.05 ? 3 : pc.boost >= RK.TIER_T[2] - 0.05 ? 2 : 1]); }
        if (!hadTr && pc.tr) Snd.play('trick');
      }
    }
    if (outBatch.length) { send({ t: 'i', l: outBatch }); outBatch = []; }
    const rt = now * 0.06 + (tickOff || 0) - 6;
    const shown = [];
    for (const id of (lastSnap ? lastSnap.cars.keys() : [])) {
      let st;
      if (id === myId && predicting) {
        const a = acc / DT; st = tmpCar;
        st.p = lerp(pcPrev.p, pc.p, a) + err.p; st.lat = lerp(pcPrev.lat, pc.lat, a) + err.lat; st.h = Math.max(0, lerp(pcPrev.h, pc.h, a) + err.h);
        st.yaw = lerpA(pcPrev.yaw, pc.yaw, a) + err.yaw; st.v = pc.v; st.dr = pc.dr; st.boost = pc.boost; st.spin = pc.spin; st.fall = pc.fall; st.dc = pc.dc;
        st.tier = pc.dr ? (pc.dc >= RK.TIER[3] ? 3 : pc.dc >= RK.TIER[2] ? 2 : pc.dc >= RK.TIER[1] ? 1 : 0) : 0;
        const sc = lastSnap.cars.get(myId); st.shield = sc ? sc[10] : 0;
      } else {
        st = interpCar(id, rt); if (!st) continue;
        if (id === myId && lastSnap.st === 'count') { const sc = lastSnap.cars.get(id); st.p = sc[1]; st.lat = sc[2]; st.yaw = sc[5]; }
      }
      const snapSt = Object.assign({}, st);
      drawCar(id, snapSt, dt, clock, id === myId);
      shown.push([id, snapSt]);
      if (id === myId) mineSt = snapSt;
    }
    const k = 1 - Math.exp(-dt * 7); err.p -= err.p * k; err.lat -= err.lat * k; err.h -= err.h * k; err.yaw -= err.yaw * k;
    drawProj(lastSnap, clock);
    // 카메라: 나 → 없으면 1등
    let follow = mineSt;
    if (!follow && shown.length) { const lead = [...lastSnap.cars.values()].sort((a, b) => a[12] - b[12])[0]; const f = shown.find(s => s[0] === lead[0]); follow = f && f[1]; }
    if (follow) followCam(follow, rdt, true);
    if (mineSt) Snd.engine(mineSt.v, mineSt.boost > 0, !!mineSt.dr); else Snd.silence();
    updateHud(dt, mineSt, lastSnap);
    drawMini(shown);
    // 상자
    for (const b of world.boxes) { b.visible = lastSnap.bx[b.userData.k] !== '0'; }
  } else {
    flyCam(dt);
    for (const b of world.boxes) b.visible = true;
  }
  // 공통 움직임
  for (const b of world.boxes) { b.rotation.x += dt * 0.9; b.rotation.y += dt * 1.3; b.position.y = b.userData.o.y + Math.sin(clock * 2 + b.userData.k) * 0.25; }
  for (const m of world.boostMats) m.map.offset.y -= dt * 2.2;
  for (const f of world.upd) f(clock, dt);
  updateHazards(world, mode === 'race' ? raceNow : clock, dt);
  if (world.sky) { world.sky.position.copy(camera.position); world.stars.position.copy(camera.position); }
  parts.update(dt);
  drawFx(dt, mineSt);
  if (window.__camHook) window.__camHook(camera);
  if (composer) composer.render(); else renderer.render(scene, camera);
}

// 시작
buildWorld(0);
showScreen('menu');
setTimeout(() => { $('load').style.opacity = 0; setTimeout(() => $('load').remove(), 400); }, 300);
requestAnimationFrame(loop);
if (location.search.includes('debug')) window.__rk = { scene, camera, cars, THREE, makeCar, renderer, get me() { return myId; }, get pc() { return pc; }, get pred() { return predicting; } };
