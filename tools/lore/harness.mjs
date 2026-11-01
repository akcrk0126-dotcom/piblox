// 지형 계산만 node 에서 돌리는 하네스 (tools/lore/terrain.mjs 가 써요). agora-world.js 를 가짜 엔진 위에서 init 해요.
// Node harness: runs agora-world.js init with stubbed engine/story/core, then simulates frames.
import fs from 'fs';
const ROOT = '/home/user/piblox/';
const THREE = await import(ROOT + 'lib/three.module.0.160.0.js');
const { WORLD, byId } = await import(ROOT + 'agora-worlddata.js');
const V3 = THREE.Vector3, TAU = Math.PI * 2;

// ---- DOM / canvas stubs ----
const ctxStub = () => {
  const target = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData() {}, measureText: t => ({ width: String(t).length * 7 }),
    createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }),
  };
  return new Proxy(target, { get(t, k) { if (k in t) return t[k]; return () => {}; }, set(t, k, v) { t[k] = v; return true; } });
};
const elStub = (name = 'el') => {
  const cls = new Set(); const kids = [];
  const t = {
    style: {}, dataset: {}, classList: { add: c => cls.add(c), remove: c => cls.delete(c), toggle: (c, v) => { const on = v === undefined ? !cls.has(c) : v; on ? cls.add(c) : cls.delete(c); return on; }, contains: c => cls.has(c) },
    children: kids, appendChild(c) { kids.push(c); return c; }, insertBefore(c) { kids.unshift(c); return c; }, remove() {},
    addEventListener() {}, setPointerCapture() {}, querySelector: () => elStub('q'), querySelectorAll: () => [], getContext: () => ctxStub(), closest: () => null,
    width: 2048, height: 2048, innerHTML: '', textContent: '',
  };
  return t;
};
globalThis.document = { createElement: () => elStub(), head: elStub(), body: elStub(), getElementById: () => elStub() };
globalThis.innerWidth = 1280; globalThis.innerHeight = 720; globalThis.devicePixelRatio = 1; globalThis.addEventListener = () => {};
globalThis.location = { search: '' };

// ---- G ----
const _v = new V3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3();
function mat(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { return new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)); }
function mergeGeos(list) {
  let n = 0; const arr = list.map(g => { const ng = g.index ? g.toNonIndexed() : g; n += ng.attributes.position.count; return ng; });
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
  for (const g of arr) { const c = g.attributes.position.count; P.set(g.attributes.position.array, o * 3); if (g.attributes.normal) N.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) U.set(g.attributes.uv.array, o * 2); o += c; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2)); out.computeBoundingSphere(); return out;
}
class Builder { constructor() { this.g = {}; } add(key, geo, m) { const g = geo.index ? geo.toNonIndexed() : geo; g.applyMatrix4(m); (this.g[key] = this.g[key] || []).push(g); } build(mats, parent) { for (const key in this.g) { const mesh = new THREE.Mesh(mergeGeos(this.g[key]), mats[key]); parent.add(mesh); } this.g = {}; } }
class Kit { constructor(B) { this.B = B; this.st = [new THREE.Matrix4()]; } top() { return this.st[this.st.length - 1]; } push(x, y, z, ry = 0, rx = 0, rz = 0) { this.st.push(this.top().clone().multiply(mat(x, y, z, rx, ry, rz))); return this; } pop() { this.st.pop(); return this; }
  box(key, w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { this.B.add(key, new THREE.BoxGeometry(w, h, d), this.top().clone().multiply(mat(x, y, z, rx, ry, rz))); }
  geo(key, g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { this.B.add(key, g, this.top().clone().multiply(mat(x, y, z, rx, ry, rz, sx, sy, sz))); } }
const cnv = (w, h) => { const c = elStub('canvas'); c.width = w; c.height = h || w; return c; };
const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0xffffff, 0.0026);
const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 2500); camera.position.set(0, 20, 600);
const keys = {};
let moodCalls = 0, lastMood = null;
const G = {
  gfxMode: process.env.LOW ? 'low' : 'high', IS_TOUCH: false, cnv, tex: (c) => new THREE.Texture(), std: o => new THREE.MeshStandardMaterial(o), mat, mergeGeos, Builder, Kit,
  T: { stone: new THREE.Texture() }, runeColumn: (w, h) => cnv(w, h), runeStrip: (w, h) => cnv(w, h), drawRune() {},
  particles: (n, b, o) => { const p = new THREE.Points(new THREE.BufferGeometry(), new THREE.ShaderMaterial()); (o.parent || scene).add(p); return p; },
  SUN: new V3(0.4, 0.8, 0.3).normalize(), pose: o => Object.assign({}, o), keys, scene, camera, renderer: { getPixelRatio: () => 1 }, hooks: [], camFn: null,
  setMood: m => { moodCalls++; lastMood = m; }, setCam() {}, mapMarkers: [], time: 0, camYaw: 0, area: 'field', lock: false, shake: 0, moveMul: 1, noJump: false, poseMod: null, poseK: 0,
  collide: (p) => { for (const f of collideHooks) f(p); },
};
const collideHooks = [];

// ---- X ----
const handlers = {};
const BUS = { on: (e, f) => (handlers[e] = handlers[e] || []).push(f), emit: (e, d) => (handlers[e] || []).forEach(f => f(d)), off() {} };
const storySrc = fs.readFileSync(ROOT + 'agora-story.js', 'utf8').split('\n');
const moodSrc = storySrc.slice(686, 699).join('\n');
const MOOD = new Function(moodSrc + '\nreturn MOOD;')();
const tgSrc = storySrc.slice(508, 541).join('\n');
const treeGeo = new Function('THREE', 'G', 'TAU', tgSrc + '\nreturn treeGeo;')(THREE, G, TAU);
const player = { pos: new V3(0, 8, 592), vy: 0, ground: true, speed: 0 };
const fig = { root: new THREE.Group() };
const S = { lv: 10, field: { disc: {}, wps: ['wp_village'], lastWp: 'wp_village', pos: null, glider: true, visits: 0 } };
let hurt = [];
const X = {
  THREE, V3, BUS, TAU, S, save() {}, treeGeo, polarRing: (a, b, s) => new THREE.RingGeometry(a, b, s), glowSprite: () => new THREE.Sprite(new THREE.SpriteMaterial()),
  MOOD, fig, player, ENEMIES: [], liveE: () => true, KEYH: [], mk: () => elStub(), emit() {}, burst() {}, shockwave() {}, banner() {}, hint() {}, toast() {}, sfx() {},
  say: async () => 0, NAMES: {}, dead: false, tpBusy: false, dialogOpen: false, hurtPlayer: (d) => hurt.push(d), D: () => ({ maxHp: 100 }),
};
// ---- F (core) ----
const INTS = []; const FW = new THREE.Group();
const F = { WORLD, byId, G, X, FW, region: null, inField: false, roleTalkers: {}, talkers: {},
  label: o => ({ set() {}, remove() {} }), addInteract: it => (INTS.push(it), it), removeInteract() {}, circle() {}, box() {}, menu: { add: () => elStub() }, note() {},
  mapCanvas: cnv(2048), area: {}, teleportTo: (x, z) => { player.pos.set(x, F.groundFn(x, z) + 0.05, z); BUS.emit('enterField', { x, z, warp: true }); },
  regionAt: (x, z) => { let best = null, bk = 1e9; for (const r of WORLD.regions) { const k = Math.hypot(x - r.c[0], z - r.c[1]) / r.r; if (k < bk) { bk = k; best = r; } } return best; },
};
F.regionById = id => byId('regions', id);

const t0 = Date.now();
const mod = await import(process.env.WMOD ? process.env.WMOD : ROOT + 'agora-world.js');
const api = await mod.init(G, X, F);
console.log('init ok', (Date.now() - t0) + 'ms', 'hooks', G.hooks.length);
// fieldBound mimic
collideHooks.push(p => { const lim = 800 - 30; p.x = Math.max(-lim, Math.min(lim, p.x)); p.z = Math.max(-lim, Math.min(lim, p.z)); if (F.bound) F.bound(p); });
export { G, X, F, api, player, BUS, keys, hurt, THREE, S, scene, camera, handlers };
globalThis.__h = { G, X, F, api, player, BUS, keys, hurt, THREE, S, scene, camera, handlers, INTS, lastMood: () => lastMood, moodCalls: () => moodCalls };
