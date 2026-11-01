// 룬 아고라 — 모험의 대지: 정착지 (agora-towns.js)
// 정착지 8곳 (농원 · 나무 위 마을 · 나루 · 말뚝 마을 · 광산촌 · 발굴 야영지 · 요새 · 수도원) · lore 주민 → WORLD.npcs · 읽을거리 · 룬 수호석 · 지도 표시 · 정착지 쪽 세상 변화
// 계약서: docs/agora-modules.md — 필드 물체는 F.FW 에 절대 y. 짓는 틀은 agora-landmarks.js 와 같아요 (Kit → 텍스처 묶음별 병합 · 가까이/멀리 두 단계).
// 데이터: WORLD.settlements (자리 · 반경 · 양식) + lore/*.js (이름 · 주민 · 읽을거리 · 수호석 · 셋피스 자리). 지역 파일이 빠져 있어도 돌아가요.
// 건물은 "원하는 자리" 근처에서 빈 곳을 찾아 앉혀요: 길 · 광장(반경 0.35) · 주민 · 읽을거리 · 셋피스 · 수호석 둘레 2.5m 는 비워 둬요.
// 읽을거리는 전부 한 메시 (셰이더로 하나씩 숨김), 반짝임도 점 하나로. 수호석만 따로 (setLit 로 룬이 밝아지고 가시 덩굴이 걷혀요).
// F 에 올리는 것: F.towns = { obj, pos, show, setChange, settlementAt, list, info } · 저장: S.towns.seen[정착지] = 처음 온 시각
import { LORE } from './lore/index.js';

export async function init(G, X, F){
const { THREE, V3, BUS, TAU } = X;
const W = F.WORLD, S = X.S, FW = F.FW, WL = W.water;

// ───────────────────────── 1. lore 주민 → WORLD.npcs (await 전에 · life 가 피규어를, rpg 가 대화를 맡아요) ─────────────────────────
const HAVE = new Set(W.npcs.map(n => n.id));
for (const L of LORE){ const st = L && L.settlement; if (!st || !Array.isArray(st.residents)) continue;
  for (const r of st.residents){ if (!r || !r.id || !Array.isArray(r.c) || HAVE.has(r.id)) continue; HAVE.add(r.id);
    W.npcs.push({ id: r.id, name: r.name || r.id, title: r.title || st.name || '', role: 'resident', resident: true, region: L.region, settlement: st.id, c: [r.c[0], r.c[1]], face: r.face || 0, look: r.look || {}, job: r.job, idle: r.idle || 'stand', lines: r.lines || {}, away: !!r.away });
    if (X.NAMES) X.NAMES[r.id] = r.name || r.id; } }

const LOW = G.gfxMode === 'low' || G.IS_TOUCH;
const T0 = performance.now();
S.towns = Object.assign({ seen: {} }, S.towns || {});
const STATS = { towns: 0, readables: 0, keystones: 0, colliders: 0, glows: 0, platforms: 0, tris: {} };
// 내가 넣은 충돌체 기록 (보이기/숨기기 · 점검용)
let COLREC = null; const MYCOL = [], _addCol = F.addCollider;
F.addCollider = c => { MYCOL.push(c); if (COLREC) COLREC.push(c); return _addCol(c); };

// ───────────────────────── 결정적 난수 ─────────────────────────
let _s = 1;
const srand = s => { _s = (s >>> 0) || 1; };
const R = () => { _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rr = (a, b) => a + (b - a) * R(), pick = a => a[(R() * a.length) | 0];
const hashS = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const easeOB = t => { const c = 1.7; t = clamp(t, 0, 1) - 1; return 1 + (c + 1) * t * t * t + c * t * t; };

// ───────────────────────── 높이 · 길 · 물 ─────────────────────────
const H = (x, z) => F.H(x, z);
function foot(x, z, hw, hd, ry = 0){
  const c = Math.cos(ry), s = Math.sin(ry); let lo = 1e9, hi = -1e9;
  for (let a = -1; a <= 1; a += 0.5) for (let b = -1; b <= 1; b += 0.5){ const lx = a * hw, lz = b * hd, h = H(x + lx * c + lz * s, z - lx * s + lz * c); if (h < lo) lo = h; if (h > hi) hi = h; }
  return [lo, hi];
}
function footC(x, z, r){ let lo = H(x, z), hi = lo; for (let i = 0; i < 12; i++){ const a = i / 12 * TAU; for (const k of [0.5, 1]){ const h = H(x + Math.cos(a) * r * k, z + Math.sin(a) * r * k); if (h < lo) lo = h; if (h > hi) hi = h; } } return [lo, hi]; }
const SEGS = [];
for (const rd of W.roads) for (let i = 0; i < rd.pts.length - 1; i++){ const [ax, az] = rd.pts[i], [bx, bz] = rd.pts[i + 1]; SEGS.push({ ax, az, ex: bx - ax, ez: bz - az, l2: (bx - ax) ** 2 + (bz - az) ** 2, w: rd.w, rd }); }
function roadD(x, z){ let best = 1e9; for (const s of SEGS){ const t = clamp(((x - s.ax) * s.ex + (z - s.az) * s.ez) / s.l2, 0, 1), d = Math.hypot(x - s.ax - s.ex * t, z - s.az - s.ez * t) - s.w / 2; if (d < best) best = d; } return best; }
function roadNear(x, z){ let best = 1e9, bp = null; for (const s of SEGS){ const t = clamp(((x - s.ax) * s.ex + (z - s.az) * s.ez) / s.l2, 0, 1), px = s.ax + s.ex * t, pz = s.az + s.ez * t, d = Math.hypot(x - px, z - pz); if (d < best){ best = d; bp = [px, pz, d, s]; } } return bp; }
const wy = (x, z) => F.waterY ? F.waterY(x, z) : WL;
const isW = (x, z) => F.isWater ? F.isWater(x, z) : H(x, z) < WL - 0.25;
const wetR = (x, z, r) => isW(x, z) || isW(x + r, z) || isW(x - r, z) || isW(x, z + r) || isW(x, z - r);

// ───────────────────────── 지오메트리 도우미 ─────────────────────────
const cyl = (rt, rb, h, s = 10, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
const cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
const sph = (r, ws = 10, hs = 8, p0, p1, t0, t1) => new THREE.SphereGeometry(r, ws, hs, p0, p1, t0, t1);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const tor = (r, t, rs = 6, ts = 16, arc = TAU) => new THREE.TorusGeometry(r, t, rs, ts, arc);
const plane = (w, h) => new THREE.PlaneGeometry(w, h);
const uvm = (g, su, sv = su) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; };
const cylM = (rt, rb, h, s = 10, open = false) => uvm(cyl(rt, rb, h, s, open), TAU * Math.max(rt, rb), h);
const lathe = (pts, seg = 16, us = 1) => G.latheG(pts, seg, us);
function triG(a, b, c){ const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([a[0] + a[2], a[1], b[0] + b[2], b[1], c[0] + c[2], c[1]], 2)); g.computeVertexNormals(); return g; }
function rockG(r, sy = 0.8, det = 1){ const g = ico(r, det), p = g.attributes.position, k = R() * 100; for (let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + 0.22 * Math.sin(x * 3.1 + k) * Math.cos(z * 2.7 + k) + 0.1 * Math.sin(y * 5 + k); p.setXYZ(i, x * n, y * n * sy, z * n); } g.computeVertexNormals(); return g; }
function tubeG(pts, r0, r1 = r0, seg = 7, div = 10){
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new V3(...p))), n = Math.max(4, pts.length * div / 2 | 0), g = new THREE.TubeGeometry(curve, n, 1, seg, false);
  const p = g.attributes.position, nrm = g.attributes.normal, cs = seg + 1;
  for (let i = 0; i <= n; i++){ const c = curve.getPointAt(i / n), r = lerp(r0, r1, i / n); for (let j = 0; j < cs; j++){ const k = i * cs + j; p.setXYZ(k, c.x + nrm.getX(k) * r, c.y + nrm.getY(k) * r, c.z + nrm.getZ(k) * r); } }
  uvm(g, pts.length * 2, r0 * 4); return g;
}
// 땅에 깔리는 판: 수평 지오메트리의 정점 y 를 지형에 맞춰요 (ox, oz = 그룹 원점)
function drape(g, ox, oz, dy = 0.06){ const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, H(ox + p.getX(i), oz + p.getZ(i)) + dy); g.computeVertexNormals(); return g; }
const meterUV = g => { const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), p.getZ(i)); return g; };
function mergeG(list){ return G.mergeGeos(list.map(g => g.index ? g.toNonIndexed() : g)); }

// ───────────────────────── 재질 ─────────────────────────
const std = o => G.std(Object.assign({ roughness: 0.85 }, o));
const T = G.T, TX = X.TX;
const MAT = Object.assign({}, G.M, X.MATS2);
const OWN = [];
const add = (k, m, emi) => { MAT[k] = m; OWN.push(m); if (emi != null) m.userData.emi = emi; return m; };
const canvasTex = (w, h, fn, rep = 1) => { const c = G.cnv(w, h), x = c.getContext('2d'); fn(x, w, h); return G.tex(c, true, rep, rep); };
const DS = THREE.DoubleSide;
add('fabricR', std({ color: 0xb02a2a, roughness: 0.9, side: DS })); add('fabricB', std({ color: 0x2a4a9a, roughness: 0.9, side: DS })); add('fabricY', std({ color: 0xe0b030, roughness: 0.9, side: DS }));
add('fabricG', std({ color: 0x2f7a46, roughness: 0.9, side: DS })); add('fabricW', std({ color: 0xf0e8d8, roughness: 0.9, side: DS })); add('fabricP', std({ color: 0x6a2a8a, roughness: 0.9, side: DS }));
add('canvas', std({ map: T.plaster, color: 0xe8dcc0, roughness: 0.95, side: DS })); add('canvasD', std({ map: T.plaster, color: 0xa89878, roughness: 0.95, side: DS }));
add('leafA', std({ color: 0x4a8a34, roughness: 0.85, flatShading: true })); add('leafB', std({ color: 0x3a7030, roughness: 0.85, flatShading: true })); add('leafC', std({ color: 0x66a040, roughness: 0.85, flatShading: true }));
add('pine', std({ color: 0x2e5a3a, roughness: 0.9, flatShading: true }));
add('bark2', std({ map: T.wood, color: 0x5a3e28, roughness: 0.95 }));
add('mossy', std({ map: T.stone, color: 0x7e9a6a, roughness: 0.95 })); add('ruin', std({ map: T.stone, color: 0xb8b0a0, roughness: 0.92 })); add('darkst', std({ map: T.stone, color: 0x5a5660, roughness: 0.9 }));
add('sandst', std({ map: T.stone, color: 0xe0a878, roughness: 0.92 })); add('redrock', std({ map: TX.redrock, roughness: 0.95 }));
add('snow', std({ color: 0xeef4fa, roughness: 0.8 })); add('ice', std({ color: 0xa8dcf4, roughness: 0.1, metalness: 0.15, emissive: 0x2a6a9a, emissiveIntensity: 0.4, flatShading: true }));
add('bone', std({ color: 0xe8dcc0, roughness: 0.7 }));
add('thorn', std({ color: 0x1e1626, roughness: 0.4, metalness: 0.25, flatShading: true })); add('thornR', std({ color: 0x3a1a3a, roughness: 0.5, flatShading: true }));
add('brass', std({ color: 0xc89a48, roughness: 0.3, metalness: 0.9 })); add('rust', std({ color: 0x6a4030, roughness: 0.8, metalness: 0.5 })); add('tin', std({ color: 0x8a9098, roughness: 0.5, metalness: 0.6 }));
add('soil', std({ map: TX.dirt, roughness: 1 })); add('water', X.water()); add('waterS', std({ color: 0x3a90b8, roughness: 0.1, metalness: 0.1 }));
add('cobble', std({ map: T.cobble, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
add('pathD', std({ map: TX.dirt, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
add('wheat', std({ color: 0xd8b24a, roughness: 0.9, side: DS })); add('wheatD', std({ color: 0xb08a30, roughness: 0.9 }));
add('reed', std({ color: 0x8a8c4a, roughness: 0.9, flatShading: true })); add('herb', std({ color: 0x5aa04a, roughness: 0.8, flatShading: true }));
add('paper', std({ color: 0xf2ead6, roughness: 0.95, side: DS })); add('parch', std({ color: 0xdcc492, roughness: 0.95, side: DS })); add('chick', std({ color: 0xf4f0e6, roughness: 0.8 }));
add('fish', std({ color: 0x9aa8b0, roughness: 0.35, metalness: 0.4 })); add('pelt', std({ color: 0x8a6a4a, roughness: 0.95, side: DS }));
// 빛나는 것: emi 1 = 늘 빛남 · 2 = 밤에 밝아짐(창문 · 등불) · 3+g = 이야기 변화 묶음 g (꺼졌다 켜짐)
add('glowC', std({ color: 0x0a2a30, emissive: 0x3fe6ff, emissiveIntensity: 2.2 }), 1); add('glowG', std({ color: 0x0a2a10, emissive: 0x6aff8a, emissiveIntensity: 2.0 }), 1);
add('glowP', std({ color: 0x200a2a, emissive: 0xb44aff, emissiveIntensity: 2.2 }), 1); add('glowO', std({ color: 0x2a1000, emissive: 0xffa040, emissiveIntensity: 2.4 }), 1);
add('glowY', std({ color: 0x2a2000, emissive: 0xffe070, emissiveIntensity: 2.4 }), 1); add('glowB', std({ color: 0x0a1a2a, emissive: 0x8ad8ff, emissiveIntensity: 2.0 }), 1);
add('crystalP', std({ color: 0xd8a8ff, emissive: 0x8a30e0, emissiveIntensity: 1.8, roughness: 0.08, flatShading: true }), 1);
add('ore', std({ color: 0xffd080, emissive: 0xff9a20, emissiveIntensity: 1.2, roughness: 0.2, flatShading: true }), 1);
add('ember', std({ color: 0x220800, emissive: 0xff5a14, emissiveIntensity: 3.0, roughness: 1 }), 1);
add('win', std({ color: 0x2a1c10, emissive: 0xffb060, emissiveIntensity: 2.0, roughness: 0.2 }), 2);
add('lampN', std({ color: 0x3a2a12, emissive: 0xffc070, emissiveIntensity: 2.2 }), 2);
add('lampS', std({ color: 0x0a2a10, emissive: 0x9aff70, emissiveIntensity: 2.2 }), 3);   // 말뚝 마을 등불 (swamp_lanterns)
add('lampD', std({ color: 0x3a2a12, emissive: 0xffb050, emissiveIntensity: 2.2 }), 4);   // 광산촌 등불 줄 (dust_lively)
add('lampF', std({ color: 0x3a2a12, emissive: 0xffd080, emissiveIntensity: 2.2 }), 5);   // 축제 등불 (festival)
add('lampFR', std({ color: 0x3a1a12, emissive: 0xff6a3a, emissiveIntensity: 2.2 }), 5); add('lampFP', std({ color: 0x3a1a2a, emissive: 0xff7ac8, emissiveIntensity: 2.2 }), 5); add('lampFB', std({ color: 0x1a2a3a, emissive: 0x7ac8ff, emissiveIntensity: 2.0 }), 5);
const FESTL = [['lampF', 0xffd080], ['lampFR', 0xff7a4a], ['lampF', 0xffd080], ['lampFP', 0xff8ad0], ['lampFB', 0x8ad0ff]];
for (const k of ['fabricR', 'fabricB', 'fabricY', 'fabricG', 'fabricW', 'fabricP', 'canvas', 'canvasD', 'pelt']) MAT[k].userData.noCast = false;
// 그물 (알파 격자)
const netTex = canvasTex(64, 64, (x, w) => { x.clearRect(0, 0, w, w); x.strokeStyle = 'rgba(120,100,70,1)'; x.lineWidth = 3; for (let i = 0; i <= w; i += 16){ x.beginPath(); x.moveTo(i, 0); x.lineTo(i, w); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } }, 1);
add('wax', std({ color: 0xf4ead0, roughness: 0.6 })); add('glowM', std({ color: 0x2a1a2a, emissive: 0xff9ae0, emissiveIntensity: 1.6 }), 1);
add('net', std({ map: netTex, alphaTest: 0.4, transparent: false, side: DS, roughness: 1 }));
const NOCAST = new Set(['win', 'lampN', 'lampS', 'lampD', 'lampF', 'ember', 'water', 'cobble', 'pathD', 'soil', 'glowC', 'glowG', 'glowP', 'glowO', 'glowY', 'glowB', 'wheat', 'wheatD', 'reed', 'herb', 'net', 'paper', 'parch']);
const SOLO = new Set(['water', 'cobble', 'pathD', 'net', 'signT', 'ice']);

// 텍스처 평균색 (먼 실루엣 · 작은 묶음 병합용)
const _avg = new Map(), TAVG = [[T.marble, 231, 227, 219], [T.stone, 163, 153, 138], [T.plaster, 225, 219, 206], [T.roof, 123, 57, 34], [T.wood, 163, 137, 104], [T.cobble, 150, 144, 134], [T.grass, 84, 109, 47],
  [G.M.slate && G.M.slate.map, 81, 88, 100], [G.M.shingle && G.M.shingle.map, 109, 76, 50], [G.M.thatch && G.M.thatch.map, 123, 98, 55], [TX.dirt, 114, 93, 68], [TX.redrock, 173, 105, 65]];
for (const [t, r, g, b] of TAVG) if (t) _avg.set(t, new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace));
const _gray = new THREE.Color().setRGB(0.62, 0.6, 0.57, THREE.SRGBColorSpace);
const texAvg = t => !t ? null : _avg.get(t) || _gray;
const _cc = {};
function colOf(key, tex = false){
  const ck = key + (tex ? '+' : ''); if (_cc[ck]) return _cc[ck];
  const m = MAT[key] || MAT.stone, c = new THREE.Color(1, 1, 1); let emi = 0;
  if (m.emissive && m.emissiveIntensity * Math.max(m.emissive.r, m.emissive.g, m.emissive.b) > 0.85){ c.copy(m.emissive).multiplyScalar(Math.min(1.2, m.emissiveIntensity * 0.55)); emi = m.userData.emi || 1; }
  else { if (m.color) c.copy(m.color); if (!tex){ const a = texAvg(m.map); if (a) c.multiply(a); } }
  return (_cc[ck] = { c, emi });
}

// ───────────────────────── 병합 빌더 ─────────────────────────
class LB {
  constructor(fm = 1.6){ this.g = {}; this.fm = fm; this.far = []; }
  add(key, geo, m){
    const g = geo.index ? geo.toNonIndexed() : geo; if (g !== geo) geo.dispose(); g.applyMatrix4(m);
    (this.g[key] = this.g[key] || []).push(g);
    if (this.fm < 1e8){ g.computeBoundingBox(); const b = g.boundingBox, d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].sort((p, q) => q - p); if (d[1] >= this.fm) this.far.push([key, g]); }
  }
}
// 정점색 + 정점 발광 재질 (밤 · 이야기 변화 묶음 반영) — 같은 텍스처 재질들을 한 메시로
const VU = { uNight: { value: 0 }, uGrp: { value: new Float32Array(8) } };
const EMI_V = 'attribute float aEmi;\nvarying float vEmi;\n', EMI_F = 'uniform float uNight;\nuniform float uGrp[8];\nvarying float vEmi;\n';
const EMI_COL = '#include <color_fragment>\n\tfloat gk = 1.0; if (vEmi > 2.5) { gk = uGrp[int(vEmi - 2.5)]; diffuseColor.rgb *= mix(0.2, 1.0, gk); }';
const EMI_ADD = '#include <emissivemap_fragment>\n\tfloat ek = vEmi < 0.5 ? 0.0 : vEmi < 1.5 ? 1.6 : vEmi < 2.5 ? mix(0.3, 1.9, uNight) : gk * mix(0.55, 2.0, uNight);\n\ttotalEmissiveRadiance += vColor.rgb * ek;';
function emiPatch(sh){ sh.uniforms.uNight = VU.uNight; sh.uniforms.uGrp = VU.uGrp;
  sh.vertexShader = EMI_V + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvEmi = aEmi;');
  sh.fragmentShader = EMI_F + sh.fragmentShader.replace('#include <color_fragment>', EMI_COL).replace('#include <emissivemap_fragment>', EMI_ADD); }
const VCM = new Map();
function vcMat(map, flat = false, metal = false){
  const k = (map ? map.uuid : '-') + (flat ? 'f' : '') + (metal ? 'm' : ''); if (VCM.has(k)) return VCM.get(k);
  const m = std({ map: map || null, vertexColors: true, flatShading: flat, roughness: metal ? 0.35 : 0.86, metalness: metal ? 0.7 : 0, side: DS });
  m.onBeforeCompile = emiPatch; m.customProgramCacheKey = () => 'twvc';
  OWN.push(m); VCM.set(k, m); return m;
}
const _jc = new THREE.Color();
function mergeVC(list, jit = 0.05, tex = false){
  if (!list.length) return null; for (const it of list) if (it[1].index) it[1] = it[1].toNonIndexed(); let n = 0; for (const [, g] of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), U = new Float32Array(n * 2), E = new Float32Array(n); let o = 0;
  for (const [k, g] of list){
    const cnt = g.attributes.position.count, ci = colOf(k, tex); P.set(g.attributes.position.array, o * 3); if (g.attributes.normal) N.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) U.set(g.attributes.uv.array, o * 2);
    _jc.copy(ci.c).multiplyScalar(1 + (R() - 0.5) * jit * 2);
    for (let i = 0; i < cnt; i++){ const j = (o + i) * 3; C[j] = _jc.r; C[j + 1] = _jc.g; C[j + 2] = _jc.b; E[o + i] = ci.emi; }
    o += cnt;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2)); out.setAttribute('aEmi', new THREE.BufferAttribute(E, 1));
  out.computeBoundingSphere(); return out;
}
const grainTex = canvasTex(128, 128, (x, w) => { x.fillStyle = '#e8e8e8'; x.fillRect(0, 0, w, w); for (let i = 0; i < 1400; i++){ const v = 170 + Math.random() * 85 | 0; x.fillStyle = `rgba(${v},${v},${v},.5)`; x.fillRect(Math.random() * w, Math.random() * w, 1 + Math.random() * 3, 1 + Math.random() * 3); } }, 1 / 1.5);
const meshOf = (geo, m, cast = false) => { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = true; o.matrixAutoUpdate = false; return o; };
let TRIS = 0;
// 재질별 지오메트리 → 묶음마다 한 메시. 작은 텍스처 묶음(정점 < 900)은 결 텍스처 정점색 묶음에 합쳐 드로콜을 줄여요
function buildMerged(g, parent, castBig = true, one = false){
  const groups = new Map(), small = [];
  if (one){ for (const key in g){ const mt = MAT[key]; if (!mt) continue; if (SOLO.has(key) || mt.transparent || mt.alphaTest > 0){ const ge = G.mergeGeos(g[key]); TRIS += ge.attributes.position.count / 3; parent.add(meshOf(ge, mt, false)); } else for (const q of g[key]) small.push([key, q]); }
    if (small.length){ const geo = mergeVC(small, 0.04, false); TRIS += geo.attributes.position.count / 3; parent.add(meshOf(geo, vcMat(grainTex), castBig)); } return; }
  for (const key in g){
    const mt = MAT[key]; if (!mt){ console.warn('[towns] 재질 없음', key); continue; }
    let nv = 0; for (const q of g[key]) nv += q.attributes.position.count;
    if (SOLO.has(key) || mt.transparent || !mt.isMeshStandardMaterial || mt.alphaTest > 0){ const ge = G.mergeGeos(g[key]); TRIS += ge.attributes.position.count / 3; parent.add(meshOf(ge, mt, false)); continue; }
    const emi = colOf(key, true).emi;
    if (!emi && mt.map && nv < 2400){ for (const q of g[key]) small.push([key, q]); continue; }
    const gk = emi ? 'emi' : (mt.map ? mt.map.uuid : 'plain') + (mt.flatShading ? 'f' : '') + (mt.metalness > 0.5 ? 'm' : '');
    let gr = groups.get(gk); if (!gr) groups.set(gk, gr = { keys: [], map: emi ? null : mt.map, flat: !emi && mt.flatShading, metal: !emi && mt.metalness > 0.5, cast: false, nv: 0 }); gr.keys.push(key); gr.nv += nv; if (!NOCAST.has(key)) gr.cast = true;
  }
  // 작은 무리(평평 · 금속 · 단색)도 정점이 적으면 결 묶음으로
  for (const [gk, gr] of groups) if (gk !== 'emi' && !gr.map && gr.nv < 1500){ for (const key of gr.keys) for (const q of g[key]) small.push([key, q]); groups.delete(gk); }
  for (const [gk, gr] of groups){
    const list = []; for (const key of gr.keys) for (const geo of g[key]) list.push([key, geo]);
    const geo = mergeVC(list, 0.03, !!gr.map); TRIS += geo.attributes.position.count / 3;
    const ms = meshOf(geo, vcMat(gr.map, gr.flat, gr.metal), castBig && gr.cast && gk !== 'emi' && gr.nv > 400); if (gk !== 'emi' && (gr.map || gr.nv > 3000)) ms.userData.big = true; parent.add(ms);
  }
  if (small.length){ const geo = mergeVC(small, 0.04, false); TRIS += geo.attributes.position.count / 3; parent.add(meshOf(geo, vcMat(grainTex), false)); }
}
// 먼 실루엣: 모든 정착지를 한 메시로 합치고, 가까이 그리는 정착지만 셰이더에서 숨겨요 (aT = 정착지 번호)
const FARH = new Float32Array(16), FARU = { value: FARH };
const FARMAT = (() => { const m = std({ vertexColors: true, roughness: 0.9, side: DS });
  m.onBeforeCompile = sh => { sh.uniforms.uHide = FARU; sh.uniforms.uNight = VU.uNight; sh.uniforms.uGrp = VU.uGrp;
    sh.vertexShader = EMI_V + 'attribute float aT;\nuniform float uHide[16];\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvEmi = aEmi;').replace('#include <project_vertex>', '#include <project_vertex>\n\tif (uHide[int(aT + 0.5)] > 0.5) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);');
    sh.fragmentShader = EMI_F + sh.fragmentShader.replace('#include <color_fragment>', EMI_COL).replace('#include <emissivemap_fragment>', EMI_ADD); };
  m.customProgramCacheKey = () => 'twfar'; OWN.push(m); return m; })();
const FARL = [];

// ───────────────────────── 빛 점 (등불 · 창문) — 밤에 밝아져요. 전부 한 드로콜. grp: 0 늘 · 1 늪 등불 · 2 광산촌 · 3 축제 ─────────────────────────
const GLOW = { p: [], c: [], s: [], d: [], g: [] }, GON = new Float32Array(8).fill(1); GON[1] = GON[2] = GON[3] = 0;
const TU = { value: 0 };
const _gc = new THREE.Color();
function glowAbs(x, y, z, col = 0xffb050, size = 2.2, day = 0.3, grp = 0){ _gc.set(col); GLOW.p.push(x, y, z); GLOW.c.push(_gc.r, _gc.g, _gc.b); GLOW.s.push(size); GLOW.d.push(day); GLOW.g.push(grp); }
let glowPts = null;
function buildGlows(){
  if (!GLOW.s.length) return;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(GLOW.p, 3)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(GLOW.c, 3)); g.setAttribute('aSize', new THREE.Float32BufferAttribute(GLOW.s, 1)); g.setAttribute('aDay', new THREE.Float32BufferAttribute(GLOW.d, 1)); g.setAttribute('aGrp', new THREE.Float32BufferAttribute(GLOW.g, 1));
  const m = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 400 }, uNight: VU.uNight, uTime: TU, uOn: { value: GON } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `attribute vec3 aCol; attribute float aSize, aDay, aGrp; uniform float uScale, uNight, uTime; uniform float uOn[8]; varying vec3 vC; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z; float on = uOn[int(aGrp + 0.5)]; float k = mix(aDay, 1.0, uNight) * on;
        vA = k * (0.85 + 0.15 * sin(uTime * 3.0 + position.x * 1.7 + position.z)) * smoothstep(800.0, 260.0, d); vC = aCol;
        gl_Position = projectionMatrix * mv; if (on < 0.01) gl_Position = vec4(0.0, 0.0, -2.0, 1.0); gl_PointSize = max(aSize * uScale / d * (0.6 + 0.6 * uNight), 1.5 * uNight * on); }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a = a * a * vA; gl_FragColor = vec4(vC * a * 1.4, a); }` });
  glowPts = new THREE.Points(g, m); glowPts.frustumCulled = false; glowPts.name = 'town_glows'; FW.add(glowPts); STATS.glows = GLOW.s.length;
}

// ───────────────────────── 걸어 올라가는 판 (판자길 · 선착장) — F.groundFn 을 감싸요 ─────────────────────────
const PLAT = [];
const platY = (x, z) => { let b = -1e9; for (const p of PLAT){ if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue; const y = p.y(x, z); if (y != null && y > b) b = y; } return b; };
function platSeg(ax, az, bx, bz, w, y0, y1 = y0){
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1, pad = w / 2 + 0.2;
  PLAT.push({ x0: Math.min(ax, bx) - pad, x1: Math.max(ax, bx) + pad, z0: Math.min(az, bz) - pad, z1: Math.max(az, bz) + pad,
    y: (x, z) => { const t = ((x - ax) * ex + (z - az) * ez) / l2; if (t < -0.02 || t > 1.02) return null; const tt = clamp(t, 0, 1); return Math.hypot(x - ax - ex * tt, z - az - ez * tt) <= w / 2 ? lerp(y0, y1, tt) : null; } });
  STATS.platforms++;
}
function platCirc(x, z, r, y){ PLAT.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r, y: (px, pz) => Math.hypot(px - x, pz - z) <= r ? y : null }); STATS.platforms++; }
// 다른 모듈이 감싸도 무한히 돌지 않게 (다시 들어오면 감싸기 전 함수로)
const prevGround = F.groundFn; let inGround = false;
const townGround = (x, z) => { if (inGround) return prevGround(x, z); inGround = true; try { const g = prevGround(x, z); if (!PLAT.length) return g; const y = platY(x, z); return y > g ? y : g; } finally { inGround = false; } };

// ───────────────────────── 정착지 기록 ─────────────────────────
// 셋피스 종류별 차지하는 반경 (비워 둘 거리 = 2.5 + 이것)
const SPR = { blight_field: 4.5, hay_field: 5, drowned_house: 5, excavation: 4.5, war_camp: 5, catapult: 2.5, wounded_tent: 3.5, bandit_camp: 5, thorn_wall: 4, corrupted_house: 4.5, ruined_street: 5, royal_tomb: 4.5,
  golem_wreck: 3.5, collapsed_tunnel: 4, water_tower: 2.5, frozen_soldiers: 4.5, dragon_bone: 5, snow_camp: 3.5, bell_tower: 3, beehives: 2, picnic: 2, wagon: 2.5, broken_cart: 2.5, spore_camp: 3.5, sunken_boat: 2.5,
  memorial: 1.5, dock: 4, fishing_racks: 2, nets: 2, shrine: 2, temple_pillar: 1.5, mine_rails: 3, titan_bone: 4, ore_pile: 1.5, dynamite_crate: 1, statue_broken: 2.5, star_dial: 2, impaled_statue: 2.5,
  thorn_crater: 4, ice_shrine: 2.5, graves: 2.5, grave: 1, campfire: 1.5, ruined_wall: 3, stone_circle: 4, well: 1.5, watchtower: 3, crates: 1, fence_run: 3, rune_stone: 1, poster_board: 1.5, barricade: 3, rope_bridge: 4, hunter_blind: 2.5 };
const LBY = {}; for (const L of LORE) if (L && L.settlement && L.settlement.id) LBY[L.settlement.id] = L;
const TOWNS = [], TBY = {};
function mkTown(s, L){
  const st = (L && L.settlement) || {}, t = { id: s.id, s, L, name: st.name || s.name, en: st.en || s.en || '', desc: st.desc || '', c: s.c, r: s.r, x: s.c[0], z: s.c[1], style: s.style, region: s.region || (L && L.region),
    existing: !!(s.existing || st.existing), near: null, farIdx: -1, anims: [], smoke: [], sparks: [], nearR: (LOW ? 165 : 205), active: false, top: 0, cols: [], hidden: false, mapbox: [], chg: {} };
  t.y = s.y != null ? s.y : H(t.x, t.z); TBY[t.id] = t; TOWNS.push(t); return t;
}
for (const s of W.settlements || []) mkTown(s, LBY[s.id] || LORE.find(l => l && l.region === s.region) || null);
// lore 에만 있는 기존 정착지 (새싹 마을): 집은 landmarks 가 지었어요 — 축제 장식 · API 만
for (const L of LORE){ const st = L && L.settlement; if (st && st.id && st.c && !TBY[st.id]) mkTown({ id: st.id, name: st.name, en: st.en, c: st.c, r: st.r || 40, region: L.region, style: st.style || 'village', existing: true }, L); }

// 비워 둘 곳 (그 정착지 로컬 좌표): lore 주민 · 읽을거리 · 셋피스 · 수호석 · 이야기 보스 + 기존 NPC · 룬 비석 · 낚시터
function keepFor(t){
  const out = [], add = (c, r) => { if (!c || !isFinite(c[0])) return; const x = c[0] - t.x, z = c[1] - t.z; if (Math.hypot(x, z) < t.r + 30) out.push([x, z, r]); };
  for (const L of LORE){ if (!L) continue;
    for (const r of (L.settlement && L.settlement.residents) || []){ add(r.c, 3.1); if (r.home) add(r.home, 3.1); }
    for (const r of L.readables || []) add(r.c, 2.6);
    for (const sp of L.setpieces || []) add(sp.c, 2.5 + (SPR[sp.kind] || 0.6) * (sp.s || 1));
    if (L.keystone) add(L.keystone.c, L.keystone.small ? 3.2 : 4.6);
    for (const b of L.bosses || []) add(b.c, 5); }
  for (const n of W.npcs) add(n.c, 3);
  for (const w of W.waypoints) add(w.c, 6.5);
  for (const f of W.fishing) add(f.c, 4);
  for (const l of W.lifts || []) add(l.from, 5);
  return out;
}

// 그 정착지 안(반경 + pad)에 이 종류 셋피스가 있나 (있으면 내 것과 겹치지 않게 빼요)
const spNear = (t, kinds, pad = 6) => LORE.some(L => L && (L.setpieces || []).some(sp => kinds.includes(sp.kind) && sp.c && Math.hypot(sp.c[0] - t.x, sp.c[1] - t.z) < t.r + pad));
const spList = (t, kinds, pad = 6) => { const out = []; for (const L of LORE) for (const sp of (L && L.setpieces) || []) if (kinds.includes(sp.kind) && sp.c && Math.hypot(sp.c[0] - t.x, sp.c[1] - t.z) < t.r + pad) out.push([sp.c[0] - t.x, sp.c[1] - t.z, 2.5 + (SPR[sp.kind] || 0.6)]); return out; };

// ───────────────────────── 짓기 틀 ─────────────────────────
// 현재: K (G.Kit), B (LB), OX/OZ (정착지 중심 = 그룹 원점), CUR (정착지). 좌표는 그룹 로컬 x, z · 절대 y
let K = null, B = null, OX = 0, OZ = 0, CUR = null;
const kitYaw = () => { const e = K.top().elements; return Math.atan2(e[8], e[10]); };
const gy = (x, z) => H(OX + x, OZ + z);
const gyk = (x, z) => { const v = K.world(x, z); return H(OX + v.x, OZ + v.z); };
const cc = (x, z, r) => { const v = K.world(x, z); F.circle(OX + v.x, OZ + v.z, r); };
const cb = (x, z, hw, hd, ry = 0) => { const v = K.world(x, z); F.box(OX + v.x, OZ + v.z, hw, hd, kitYaw() + ry); };
const kpt = (x, y, z) => new V3(x, y, z).applyMatrix4(K.top());
const glow = (x, y, z, col, size, day, grp = 0) => { const v = kpt(x, y, z); glowAbs(OX + v.x, v.y, OZ + v.z, col, size, day, grp); };
const anim = fn => CUR.anims.push(fn);
function link(key, a, b, w = 0.1, h = w){ const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], hl = Math.hypot(dx, dz), L = Math.hypot(hl, dy); K.push((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, Math.atan2(dx, dz)); K.box(key, w, h, L, 0, 0, 0, -Math.atan2(dy, hl)); K.pop(); }
function begin(t){
  srand(hashS(t.id)); B = new LB(1.6); K = new G.Kit(B); OX = t.x; OZ = t.z; CUR = t;
  t.near = new THREE.Group(); t.near.position.set(t.x, 0, t.z); t.near.name = 'town_' + t.id; t.near.userData.town = t.id;
  t.keep = keepFor(t); t.occ = []; t.rects = []; COLREC = t.cols;
}
function finish(){
  const t = CUR, tr0 = TRIS;
  if (B.far.length && FARL.length < 16){ const fg = mergeVC(B.far, 0.04); fg.translate(t.x, 0, t.z); t.farIdx = FARL.length; fg.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(fg.attributes.position.count).fill(t.farIdx), 1)); FARL.push(fg); }
  buildMerged(B.g, t.near);
  if (t.smoke.length) smokeFx(t.near, t.smoke, t.smokeCol);
  if (t.sparks.length) sparkFx(t.near, t.sparks);
  const bb = new THREE.Box3().setFromObject(t.near); t.top = isFinite(bb.max.y) ? Math.min(bb.max.y, t.y + 40) : t.y + 8;
  t.casters = []; t.near.traverse(o => { if (o.isMesh && o.castShadow) t.casters.push(o); }); t.castOn = true;
  t.detail = t.near.children.filter(o => !o.userData.big && !Object.values(t.chg).includes(o)); t.detailOn = true;   // 멀면(120m~) 큰 덩어리만 그려요
  t.near.visible = false; FW.add(t.near); STATS.towns++; STATS.tris[t.id] = Math.round(TRIS - tr0);
  COLREC = null; B = K = null; CUR = null; return t;
}
// 따로 움직이는 메시 (그룹 로컬)
function part(geo, mt, x = 0, y = 0, z = 0, parent){ const m = new THREE.Mesh(geo, typeof mt === 'string' ? MAT[mt] : mt); m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = true; (parent || CUR.near).add(m); return m; }
// 따로 그리는 묶음: fn 안의 K 는 새 Kit (같은 로컬 좌표) → 정점색 병합 메시 하나 (pivot 기준으로 키우고 줄일 수 있어요)
function subMesh(fn, pivot = [0, 0, 0], parent){
  const pk = K, pb = B, sb = new LB(1e9); B = sb; K = new G.Kit(sb);
  try { fn(); } finally { K = pk; B = pb; }
  const g = sb.g, outer = new THREE.Group(), inner = new THREE.Group(); outer.position.set(...pivot); inner.position.set(-pivot[0], -pivot[1], -pivot[2]); outer.add(inner);
  buildMerged(g, inner, false, true); (parent || CUR.near).add(outer); return outer;
}
// 굴뚝 연기 · 불티 (그룹 로컬)
function smokeFx(parent, pts, col = '0.78, 0.77, 0.76'){
  if (LOW && pts.length > 3) pts = pts.slice(0, 3);
  G.particles(pts.length * (LOW ? 10 : 16), pts, { parent,
    vert: `float life = fract(uTime * 0.11 * (0.8 + 0.4 * fract(aSeed * 3.1)) + aSeed); vL = life;
      vec3 p = position + vec3(life * 3.0 + sin(aSeed * 30.0 + uTime * 0.6) * life, life * 7.0, life * 1.5 + cos(aSeed * 21.0) * life * 1.2); float sz = 0.8 + life * 4.5;`,
    frag: `float a = smoothstep(0.5, 0.05, d) * smoothstep(0.0, 0.12, vL) * (1.0 - vL) * 0.26; gl_FragColor = vec4(vec3(${col}), a);`, blend: THREE.NormalBlending });
}
function sparkFx(parent, pts, col = '1.0, 0.6, 0.2', n = 12, rise = 3.0){
  G.particles(pts.length * (LOW ? 7 : n), pts, { parent,
    vert: `float life = fract(uTime * (0.4 + 0.3 * fract(aSeed * 5.3)) + aSeed); vL = life; float an = aSeed * 47.0;
      vec3 p = position + vec3(sin(an + uTime * 1.3) * life * 0.8, life * ${rise.toFixed(1)}, cos(an * 1.3 + uTime) * life * 0.8); float sz = 0.12;`,
    frag: `float a = smoothstep(0.5, 0.1, d) * (1.0 - vL); gl_FragColor = vec4(vec3(${col}) * a * 2.0, a);` });
}
function motesFx(parent, c, r, n, col = '0.7, 1.0, 0.6', h = 3, sz = 0.14){
  const bases = []; for (let i = 0; i < n; i++){ const a = R() * TAU, d = Math.sqrt(R()) * r; bases.push(new V3(c[0] + Math.cos(a) * d, c[1] + rr(0.3, h), c[2] + Math.sin(a) * d)); }
  G.particles(n, bases, { parent, vert: `vec3 p = position + vec3(sin(uTime * 0.5 + aSeed * 50.0) * 1.4, sin(uTime * 0.8 + aSeed * 31.0) * 0.5, cos(uTime * 0.4 + aSeed * 70.0) * 1.4); vL = pow(0.5 + 0.5 * sin(uTime * (1.5 + fract(aSeed * 4.0) * 2.0) + aSeed * 90.0), 2.0); float sz = ${sz.toFixed(2)};`,
    frag: `float a = smoothstep(0.5, 0.0, d) * vL; gl_FragColor = vec4(vec3(${col}) * a * 1.4, a);` });
}
// 깃발 (펄럭임) — 큰 것만 (그룹 로컬)
function flag(x, y, z, ry, w, h, mt, parent){
  const geo = new THREE.PlaneGeometry(w, h, 6, 2); geo.translate(w / 2, -h / 2, 0); const pa = geo.attributes.position;
  const m = new THREE.Mesh(geo, MAT[mt] || mt); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = false; (parent || CUR.near).add(m);
  const base = Float32Array.from(pa.array), seed = R() * 10;
  anim((dt, t) => { for (let i = 0; i < pa.count; i++){ const bx = base[i * 3], k = bx / w; pa.setZ(i, Math.sin(t * 3.2 + bx * 1.6 + seed) * 0.28 * k + Math.sin(t * 5.1 + base[i * 3 + 1] * 2 + seed) * 0.06 * k); } pa.needsUpdate = true; });
  return m;
}

// ───────────────────────── 자리 찾기 ─────────────────────────
const occupy = (x, z, r) => CUR.occ.push([x, z, r]);
// (x, z) 반경 rad 가 비었나: 광장 · 정착지 밖 · 길 · 비울 곳 · 이미 지은 것 · 물 · 비탈
function free(x, z, rad, o = {}){
  const t = CUR, d = Math.hypot(x, z);
  if (!o.plaza && d < t.r * 0.35 + rad * 0.75) return false;
  if (d + rad * 0.4 > (o.maxR ?? t.r * 1.08)) return false;
  if (roadD(OX + x, OZ + z) < rad + (o.roadPad ?? 1.0)) return false;
  for (const [kx, kz, kr] of t.keep) if (Math.hypot(x - kx, z - kz) < kr + rad * (o.keepK ?? 0.9)) return false;
  for (const [ox, oz, orr] of t.occ) if (Math.hypot(x - ox, z - oz) < orr + rad) return false;
  if (!o.inRect) for (const q of t.rects) if (x + rad > q[0] && x - rad < q[2] && z + rad > q[1] && z - rad < q[3]) return false;
  if (!o.water && wetR(OX + x, OZ + z, rad * 0.8)) return false;
  if (o.wet && !isW(OX + x, OZ + z)) return false;
  if (o.maxDh != null){ const [lo, hi] = footC(OX + x, OZ + z, rad); if (hi - lo > o.maxDh) return false; }
  return true;
}
// 원하는 자리에서 가까운 빈 곳 (나선으로 찾아요) → [x, z] | null
function spot(x, z, rad, o = {}){
  const maxS = o.max ?? 9;
  for (let s = 0; s <= maxS; s += 1.25){
    const n = s === 0 ? 1 : Math.max(6, Math.round(s * 2.4));
    for (let i = 0; i < n; i++){ const a = i / n * TAU + s * 0.7, px = x + Math.cos(a) * s, pz = z + Math.sin(a) * s; if (free(px, pz, rad, o)) return [px, pz]; }
  }
  return null;
}
const faceTo = (x, z, to) => Math.atan2((to ? to[0] : 0) - x, (to ? to[1] : 0) - z);
function faceRoad(x, z){ const rn = roadNear(OX + x, OZ + z); return rn && rn[2] < 40 ? Math.atan2(rn[0] - OX - x, rn[1] - OZ - z) : faceTo(x, z); }
// 건물 자리: (w × d) 를 원 하나로 어림. o.face = 'road' | [x, z] | 숫자(ry). 정면(문) = 로컬 +z
function site(x, z, w, d, o = {}){
  const rad = Math.hypot(w, d) * 0.5 * (o.k ?? 0.84), p = spot(x, z, rad, o); if (!p){ (CUR.fails = CUR.fails || []).push([Math.round(x), Math.round(z), w]); return null; }
  const ry = typeof o.face === 'number' ? o.face : o.face === 'road' ? faceRoad(p[0], p[1]) : faceTo(p[0], p[1], o.face);
  occupy(p[0], p[1], rad + (o.gap ?? 0.6)); return { x: p[0], z: p[1], ry, rad };
}
// 후보 자리들을 차례로 시도해 n 채 지어요: fn(site)
function sites(cands, n, w, d, o, fn){ let made = 0; for (const [x, z] of cands){ if (made >= n) break; const pf = CUR.fails ? CUR.fails.length : 0, s = site(x, z, w, d, o); if (s){ fn(s); made++; } else if (CUR.fails) CUR.fails.length = pf; } if (made < n) (CUR.fails = CUR.fails || []).push(['n', made, n]); return made; }
// 나무 (X.treeGeo 인스턴스 · 그룹 로컬): list = [[x, z, s]]
function plantTrees(list, type = 'oak'){ if (!list.length || !X.treeGeo) return; const im = new THREE.InstancedMesh(X.treeGeo(type), X.TREEMAT, list.length), c = new THREE.Color();
  list.forEach(([x, z, sc], i) => { im.setMatrixAt(i, G.mat(x, gy(x, z) - 0.1, z, 0, R() * TAU, 0, sc, sc, sc)); c.setHSL(0.25 + rr(-0.04, 0.04), 0.5, rr(0.85, 1)); im.setColorAt(i, c); cc(x, z, 0.45 * sc); B.far.push(['leafB', ico(2.0 * sc, 0).translate(x, gy(x, z) + 3.9 * sc, z)]); });
  im.castShadow = true; im.receiveShadow = true; CUR.near.add(im); }
function trees(cands, n, type = 'oak', smin = 0.9, smax = 1.3){ const out = []; for (const [x, z] of cands){ if (out.length >= n) break; const p = prop(x, z, 1.6, { max: 4, plaza: false }); if (p) out.push([p[0], p[1], rr(smin, smax)]); } plantTrees(out, type); }
// 노점 (차양 · 과일 · 호박 · 밀단)
function produceStall(x, z, ry){ const [lo, hi] = foot(OX + x, OZ + z, 1.6, 1.2, ry), y = hi; K.push(x, y, z, ry);
  if (hi - lo > 0.1) K.box('stoneD', 3.0, hi - lo + 0.2, 2.0, 0, -(hi - lo) / 2, 0);
  K.box('wood', 2.8, 0.9, 1.0, 0, 0.45, 0.3); K.box('woodD', 3.0, 0.08, 1.2, 0, 0.93, 0.3);
  for (const sx of [-1.4, 1.4]) for (const sz of [-0.6, 0.85]) K.box('woodD', 0.1, sz > 0 ? 2.3 : 2.7, 0.1, sx, (sz > 0 ? 2.3 : 2.7) / 2, sz);
  for (let i = 0; i < 7; i++) K.box(i % 2 ? 'fabricW' : 'fabricG', 3.3 / 7 + 0.003, 0.06, 2.1, -1.65 + (i + 0.5) * 3.3 / 7, 2.55, 0.2, 0.22);
  for (let i = 0; i < 6; i++){ const gx = -1.1 + i * 0.44; if (i % 2){ K.geo('wicker', lathe([[0, 0], [0.16, 0.02], [0.18, 0.14], [0, 0.14]], 8, 0.3), gx, 0.97, 0.3); for (let k = 0; k < 4; k++) K.geo(pick(['fruitR', 'fruitG', 'fruitO']), sph(0.075, 6, 4), gx + rr(-0.06, 0.06), 1.12 + k * 0.03, 0.3 + rr(-0.06, 0.06)); } else K.geo('pumpkin', sph(0.17, 8, 5), gx, 1.1, 0.3, 0, 0, 0, 1.25, 0.85, 1.25); }
  for (let k = 0; k < 2; k++) K.geo('hay', cylM(0.18, 0.22, 0.9, 7), 1.0 + k * 0.45, 0.45, 1.25, 0.15, 0, 0);
  K.pop(); K.push(x, 0, z, ry); cb(0, 0, 1.55, 1.1); K.pop(); mapbox(x, z, 1.5, 1.0, ry); }
function flowerBed(x, z, ry, w = 3){ const y = gy(x, z); K.push(x, y, z, ry); K.box('stoneD', w, 0.3, 0.8, 0, 0.12, 0); K.box('soil', w - 0.15, 0.05, 0.65, 0, 0.28, 0); for (let i = 0; i < w * 5; i++) K.geo(pick(['flower', 'flowerY', 'flowerW', 'rose', 'leafC']), ico(rr(0.09, 0.15), 0), rr(-w / 2 + 0.15, w / 2 - 0.15), 0.42, rr(-0.25, 0.25)); K.pop(); K.push(x, 0, z, ry); cb(0, 0, w / 2, 0.4); K.pop(); }
// 작은 소품 자리 (반경 r) — 못 찾으면 null
const prop = (x, z, r, o = {}) => { const p = spot(x, z, r, Object.assign({ max: 4, plaza: true, roadPad: 0.6 }, o)); if (p) occupy(p[0], p[1], r + 0.2); return p; };

// ───────────────────────── 소품 (현재 K 에 그려요 · y 는 절대 높이) ─────────────────────────
const P = {
  barrel(x, y, z, s = 1){ K.geo('wood', lathe([[0, 0], [0.3 * s, 0], [0.36 * s, 0.22 * s], [0.38 * s, 0.45 * s], [0.36 * s, 0.68 * s], [0.3 * s, 0.9 * s], [0, 0.9 * s]], 10, 0.4), x, y, z); for (const h of [0.18, 0.72]) K.geo('iron', tor(0.365 * s, 0.02, 3, 12), x, y + h * s, z, Math.PI / 2); },
  crate(x, y, z, s = 0.7, ry = 0){ K.box('crate', s, s, s, x, y + s / 2, z, 0, ry); K.box('beam', s + 0.02, 0.06, s + 0.02, x, y + s * 0.5, z, 0, ry); },
  sack(x, y, z, ry = 0){ K.geo('sack', sph(0.3, 7, 5), x, y + 0.24, z, 0, ry, 0, 1, 0.85, 0.75); },
  clutter(x, z, n, r = 0.9){ for (let i = 0; i < n; i++){ const a = R() * TAU, d = R() * r, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, y = gyk(px, pz), t = R(); if (t < 0.4) P.barrel(px, y, pz); else if (t < 0.8){ const s = rr(0.5, 0.75); P.crate(px, y, pz, s, R()); if (R() < 0.4) P.crate(px, y + s, pz, s * 0.7, R()); } else P.sack(px, y, pz, R() * 3); } cc(x, z, r * 0.8 + 0.4); },
  hay(x, z, ry = 0){ const y = gyk(x, z); K.geo('hay', cylM(0.75, 0.75, 1.3, 12), x, y + 0.72, z, Math.PI / 2, ry, 0); cc(x, z, 0.9); },
  hayStack(x, z){ const y = gyk(x, z); K.geo('hay', cylM(1.0, 1.15, 1.3, 10), x, y + 0.6, z); K.geo('hay', uvm(cone(1.1, 1.0, 10), 6, 1), x, y + 1.7, z); cc(x, z, 1.2); },
  fence(x0, z0, x1, z1, o = {}){
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / (o.gap || 2.2))), key = o.key || 'wood', h = o.h || 1.0, pts = [];
    for (let i = 0; i <= n; i++){ const t = i / n, x = lerp(x0, x1, t), z = lerp(z0, z1, t); pts.push([x, gyk(x, z), z]); }
    for (const [x, y, z] of pts){ K.box(key, 0.13, h + 0.3, 0.13, x, y + (h + 0.3) / 2 - 0.25, z, 0, R() * 0.3, rr(-0.05, 0.05)); if (o.cap) K.geo(o.cap, cone(0.12, 0.2, 4), x, y + h + 0.12, z, 0, Math.PI / 4, 0); }
    for (let i = 0; i < n; i++){ const [ax, ay, az] = pts[i], [bx, by, bz] = pts[i + 1], hl = Math.hypot(bx - ax, bz - az), len = Math.hypot(hl, by - ay), yaw = Math.atan2(bx - ax, bz - az), pit = -Math.atan2(by - ay, hl);
      K.push((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, yaw); for (const hh of (o.rails || [0.4, 0.8])) K.box(key, 0.06, 0.1, len + 0.1, 0, hh * h, 0, pit); K.pop(); }
    if (o.col !== false){ const yaw = Math.atan2(x1 - x0, z1 - z0); K.push((x0 + x1) / 2, 0, (z0 + z1) / 2, yaw); cb(0, 0, 0.15, L / 2); K.pop(); }
  },
  bench(x, z, ry = 0){ const y = gyk(x, z); K.push(x, y, z, ry); K.box('wood', 1.8, 0.08, 0.45, 0, 0.45, 0); K.box('wood', 1.8, 0.4, 0.06, 0, 0.75, -0.2, -0.15); for (const s of [-1, 1]) K.box('woodD', 0.08, 0.45, 0.42, s * 0.75, 0.22, 0); K.pop(); K.push(x, 0, z, ry); cb(0, 0, 0.9, 0.3); K.pop(); },
  logSeat(x, z, ry = 0, len = 2.0){ const y = gyk(x, z); K.geo('bark2', cylM(0.26, 0.28, len, 8), x, y + 0.24, z, 0, ry, Math.PI / 2); K.push(x, 0, z, ry); cb(0, 0, len / 2, 0.3); K.pop(); },
  table(x, z, ry = 0, top = 'food'){ const y = gyk(x, z); K.push(x, y, z, ry); K.box('wood', 1.6, 0.08, 0.9, 0, 0.78, 0); for (const sx of [-0.65, 0.65]) for (const sz of [-0.35, 0.35]) K.box('woodD', 0.08, 0.78, 0.08, sx, 0.39, sz);
    if (top === 'food'){ K.geo('wood', cylM(0.08, 0.07, 0.18, 8), -0.3, 0.9, 0.1); K.geo('bread', sph(0.12, 7, 5), 0.3, 0.86, -0.1, 0, 0, 0, 1.4, 0.7, 1); }
    else if (top === 'scroll'){ for (let i = 0; i < 3; i++) K.box(i % 2 ? 'parch' : 'paper', 0.5, 0.01, 0.36, rr(-0.5, 0.5), 0.83, rr(-0.2, 0.2), 0, rr(-0.5, 0.5), 0); for (let i = 0; i < 3; i++) K.geo('parch', cyl(0.05, 0.05, 0.5, 6), rr(-0.5, 0.5), 0.87, rr(-0.25, 0.25), 0, rr(0, 3), Math.PI / 2);
      K.geo('glowO', sph(0.05, 5, 4), 0.62, 0.95, 0.3); K.geo('wax', cyl(0.04, 0.04, 0.14, 6), 0.62, 0.89, 0.3); glow(0.62, 0.98, 0.3, 0xffb050, 0.9, 0.3); }
    else if (top === 'chart'){ K.box('fabricB', 1.1, 0.012, 0.7, 0, 0.83, 0, 0, 0.12, 0); for (let i = 0; i < 14; i++) K.geo('glowY', sph(0.022, 4, 3), rr(-0.48, 0.48), 0.845, rr(-0.3, 0.3)); for (let i = 0; i < 4; i++) link('gold', [rr(-0.45, 0.45), 0.842, rr(-0.28, 0.28)], [rr(-0.45, 0.45), 0.842, rr(-0.28, 0.28)], 0.008, 0.004); K.geo('brass', tor(0.12, 0.01, 3, 12), 0.45, 0.86, 0.22, Math.PI / 2); }
    K.pop(); K.push(x, 0, z, ry); cb(0, 0, 0.85, 0.5); K.pop(); },
  // 등불 기둥: style = wood | stone | swamp | iron | snow | hang · grp/lamp 키로 이야기 변화 묶음에 넣을 수 있어요
  lamp(x, z, style = 'wood', ry = 0, o = {}){
    const y = o.y ?? gyk(x, z), lk = o.key || 'lampN', grp = o.grp || 0, gc = o.col; K.push(x, y, z, ry);
    if (style === 'stone'){ K.box('mossy', 0.7, 0.2, 0.7, 0, 0.1, 0); K.geo('mossy', cyl(0.14, 0.18, 0.9, 6), 0, 0.65, 0); K.box('stone', 0.6, 0.45, 0.6, 0, 1.32, 0); K.geo('stoneD', cone(0.55, 0.4, 4), 0, 1.75, 0, 0, Math.PI / 4, 0); K.box(lk, 0.3, 0.25, 0.62, 0, 1.32, 0); glow(0, 1.32, 0, gc || 0xffd080, 2.4, 0.3, grp); }
    else if (style === 'swamp'){ K.geo('woodD', cyl(0.07, 0.11, 2.6, 6), 0, 1.25, 0, 0.12, 0, 0.08); K.box('woodD', 0.55, 0.06, 0.06, 0.25, 2.45, 0.1, 0, 0, -0.2); K.box(o.key || 'lampS', 0.22, 0.28, 0.22, 0.48, 2.12, 0.1); K.geo('iron', cone(0.2, 0.16, 4), 0.48, 2.32, 0.1, 0, Math.PI / 4, 0); glow(0.48, 2.12, 0.1, gc || 0x9aff70, 2.6, 0.5, o.grp ?? 1); }
    else if (style === 'iron'){ K.geo('rust', cyl(0.06, 0.1, 2.4, 6), 0, 1.2, 0); K.geo('iron', lathe([[0, 0], [0.35, 0.05], [0.42, 0.3], [0, 0.3]], 8, 0.4), 0, 2.4, 0); K.geo(o.fire || 'glowO', cone(0.26, 0.5, 6), 0, 2.85, 0); glow(0, 2.85, 0, gc || 0xff8a30, 3.2, 0.55, grp); if (o.sparks !== false) CUR.sparks.push(kpt(0, 2.9, 0)); }
    else if (style === 'snow'){ K.box('stone', 0.7, 0.2, 0.7, 0, 0.1, 0); K.geo('stone', cyl(0.14, 0.18, 0.9, 6), 0, 0.65, 0); K.box('stone', 0.6, 0.45, 0.6, 0, 1.32, 0); K.geo('snow', cone(0.6, 0.45, 4), 0, 1.78, 0, 0, Math.PI / 4, 0); K.box(lk, 0.3, 0.25, 0.62, 0, 1.32, 0); glow(0, 1.32, 0, gc || 0xffd8a0, 2.4, 0.4, grp); }
    else { K.geo('woodD', cyl(0.06, 0.08, 2.6, 6), 0, 1.3, 0); K.box('woodD', 0.5, 0.06, 0.06, 0.2, 2.55, 0); K.box(lk, 0.22, 0.3, 0.22, 0.42, 2.3, 0); K.geo('iron', cone(0.2, 0.16, 4), 0.42, 2.5, 0, 0, Math.PI / 4, 0); glow(0.42, 2.3, 0, gc || 0xffa848, 2.6, 0.3, grp); }
    K.pop(); if (o.col !== false) cc(x, z, 0.3);
  },
  // 매달린 등불 (지붕 끝 · 다리 밑): (x, y, z) 가 고리 자리
  hangLamp(x, y, z, key = 'lampN', col = 0xffb860, grp = 0){ K.geo('rope', cyl(0.015, 0.015, 0.5, 3), x, y - 0.25, z); K.geo('iron', cone(0.16, 0.14, 4), x, y - 0.55, z, 0, Math.PI / 4, 0); K.box(key, 0.18, 0.24, 0.18, x, y - 0.74, z); glow(x, y - 0.74, z, col, 1.8, 0.3, grp); },
  campfire(x, z, sparks = true){
    const y = gyk(x, z); for (let i = 0; i < 8; i++){ const a = i / 8 * TAU; K.geo('rock', ico(0.22, 0), x + Math.cos(a) * 0.75, y + 0.1, z + Math.sin(a) * 0.75, R(), R(), R()); }
    for (let i = 0; i < 4; i++){ const a = i / 4 * TAU + 0.4; K.geo('woodD', cyl(0.07, 0.08, 1.0, 5), x + Math.cos(a) * 0.25, y + 0.35, z + Math.sin(a) * 0.25, Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55); }
    K.geo('ember', new THREE.CircleGeometry(0.42, 8).rotateX(-Math.PI / 2), x, y + 0.08, z); K.geo('glowO', cone(0.3, 0.7, 6), x, y + 0.45, z); glow(x, y + 0.6, z, 0xff8a30, 4, 0.75); cc(x, z, 0.95);
    if (sparks) CUR.sparks.push(kpt(x, y + 0.5, z));
  },
  coneTent(x, z, ry = 0, key = 'canvas', r = 2.2){ const y = gyk(x, z); K.push(x, y, z, ry); K.geo(key, cone(r, r * 1.25, 7, 1, true), 0, r * 0.62, 0); K.geo('woodD', cyl(0.05, 0.05, r * 1.5, 5), 0, r * 0.75, 0); K.geo('dark', plane(r * 0.45, r * 0.7), 0, r * 0.35, r * 0.72, -0.35, 0, 0); K.pop(); cc(x, z, r); },
  cart(x, z, ry = 0, load = 'hay'){
    const y = gyk(x, z); K.push(x, y, z, ry);
    K.box('wood', 1.6, 0.12, 2.6, 0, 0.75, 0); for (const s of [-1, 1]){ K.box('wood', 0.08, 0.45, 2.6, s * 0.8, 1.0, 0); K.geo('woodD', cyl(0.5, 0.5, 0.1, 10), s * 0.9, 0.5, 0.3, 0, 0, Math.PI / 2); K.geo('iron', tor(0.5, 0.03, 3, 12), s * 0.95, 0.5, 0.3, 0, Math.PI / 2, 0); }
    for (const s of [-1, 1]) K.box('woodD', 0.08, 0.08, 1.8, s * 0.35, 0.65, 2.1, 0.2);
    if (load === 'hay') K.geo('hay', sph(0.8, 8, 6), 0, 1.1, 0, 0, 0, 0, 0.9, 0.5, 1.4);
    else if (load === 'barrel'){ P.barrel(-0.35, 0.81, -0.6); P.barrel(0.35, 0.81, -0.6); P.crate(0, 0.81, 0.5, 0.65, 0.3); }
    else if (load === 'ore'){ for (let i = 0; i < 8; i++) K.geo(i < 2 ? 'ore' : 'rock', ico(0.25, 0), rr(-0.5, 0.5), 0.95, rr(-1, 1), R(), R(), R()); }
    else if (load === 'pumpkin'){ for (let i = 0; i < 6; i++) K.geo('pumpkin', sph(0.3, 8, 6), rr(-0.4, 0.4), 1.05, rr(-0.9, 0.9), 0, R() * 3, 0, 1.2, 0.85, 1.2); }
    K.pop(); K.push(x, 0, z, ry); cb(0, 0, 1.0, 1.6); K.pop();
  },
  well(x, z){ const y = gyk(x, z); K.push(x, y, z); K.geo('stone', lathe([[0.9, 0], [1.0, 0], [1.0, 0.9], [0.8, 0.9], [0.8, 0.2], [0, 0.2]], 14, 0.5)); K.geo('dark', new THREE.CircleGeometry(0.8, 12).rotateX(-Math.PI / 2), 0, 0.5, 0);
    for (const s of [-1, 1]) K.box('woodD', 0.14, 2.2, 0.14, s * 0.85, 1.4, 0); K.box('woodD', 1.9, 0.12, 0.12, 0, 2.3, 0); K.geo('rope', cyl(0.02, 0.02, 1.3, 4), 0, 1.65, 0); K.box('wood', 0.3, 0.3, 0.3, 0, 1.05, 0);
    for (const s of [-1, 1]) K.box('shingle', 2.4, 0.08, 1.15, 0, 2.6, s * 0.48, s * 0.55); K.pop(); cc(x, z, 1.15); },
  pillar(x, z, h = 4, broken = false, key = 'ruin'){ const y = gyk(x, z) - 0.2; K.box(key, 1.3, 0.4, 1.3, x, y + 0.2, z); K.geo(key, cylM(0.42, 0.48, h, 10), x, y + 0.4 + h / 2, z); if (!broken) K.box(key, 1.2, 0.35, 1.2, x, y + 0.6 + h, z); else K.geo(key, cone(0.44, 0.5, 7), x + 0.05, y + 0.4 + h + 0.1, z, rr(-0.3, 0.3), 0, rr(-0.4, 0.4)); cc(x, z, 0.75); },
  fallen(x, z, ry, key = 'ruin'){ const y = gyk(x, z); K.geo(key, cylM(0.44, 0.47, 3.8, 10), x, y + 0.35, z, 0, ry, Math.PI / 2 + 0.05); K.push(x, 0, z, ry); cb(0, 0, 1.9, 0.5); K.pop(); },
  boulder(x, z, s = 1, key = 'rock'){ const y = gyk(x, z); K.geo(key, rockG(s, 0.75), x, y + s * 0.35, z, 0, R() * TAU, 0); cc(x, z, s * 0.9); },
  log(x, z, ry, len = 2.4, r = 0.28){ const y = gyk(x, z); K.geo('bark2', cylM(r, r * 1.05, len, 8), x, y + r * 0.9, z, 0, ry, Math.PI / 2); K.push(x, 0, z, ry); cb(0, 0, len / 2, r + 0.05); K.pop(); },
  stump(x, z, r = 0.45){ const y = gyk(x, z); K.geo('bark2', cylM(r, r * 1.2, 0.6, 8), x, y + 0.25, z); K.geo('wood', new THREE.CircleGeometry(r, 8).rotateX(-Math.PI / 2), x, y + 0.56, z); cc(x, z, r + 0.1); },
  mushrooms(x, z, n = 5, key = 'glowM'){ for (let i = 0; i < n; i++){ const px = x + rr(-1.2, 1.2), pz = z + rr(-1.2, 1.2), y = gyk(px, pz), s = rr(0.6, 1.3); K.geo('fabricW', cyl(0.04 * s, 0.06 * s, 0.35 * s, 5), px, y + 0.17 * s, pz); K.geo(key, sph(0.17 * s, 7, 4, 0, TAU, 0, Math.PI / 2), px, y + 0.33 * s, pz); } },
  banner(x, z, key = 'fabricR', h = 4.5, ry = 0, trim = 'gold'){ const y = gyk(x, z); K.geo('woodD', cyl(0.07, 0.09, h, 6), x, y + h / 2, z); K.geo(trim, sph(0.11, 6, 4), x, y + h + 0.05, z); K.push(x, y, z, ry); K.box('woodD', 1.1, 0.06, 0.06, 0.5, h - 0.25, 0); K.geo(key, plane(0.9, 1.8), 0.5, h - 1.2, 0.05); K.geo(key, triG([0.05, h - 2.1, 0.05], [0.95, h - 2.1, 0.05], [0.5, h - 2.5, 0.05])); K.box(trim, 0.9, 0.08, 0.02, 0.5, h - 0.35, 0.06); K.pop(); cc(x, z, 0.25); },
  skull(x, y, z, s = 1, ry = 0){ K.push(x, y, z, ry); K.geo('bone', sph(0.32 * s, 7, 5), 0, 0.3 * s, 0, 0, 0, 0, 1, 0.9, 1.15); K.box('bone', 0.3 * s, 0.18 * s, 0.3 * s, 0, 0.1 * s, 0.18 * s); for (const sd of [-1, 1]) K.geo('dark', sph(0.07 * s, 5, 4), sd * 0.11 * s, 0.32 * s, 0.3 * s); K.pop(); },
  // 줄 + 삼각 깃발 (양 끝 [x, y, z] · 그룹 로컬)
  pennants(a, b, sag = 1.2, keys = ['pen0', 'pen1', 'pen2', 'pen3']){
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(3, Math.round(L / 0.8)), yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
    for (let i = 0; i < n; i++){ const t0 = i / n, t1 = (i + 1) / n, y0 = lerp(a[1], b[1], t0) - Math.sin(t0 * Math.PI) * sag, y1 = lerp(a[1], b[1], t1) - Math.sin(t1 * Math.PI) * sag, hl = L / n, len = Math.hypot(hl, y1 - y0);
      K.push(lerp(a[0], b[0], (t0 + t1) / 2), (y0 + y1) / 2, lerp(a[2], b[2], (t0 + t1) / 2), yaw); K.box('rope', 0.02, 0.02, len, 0, 0, 0, -Math.atan2(y1 - y0, hl)); K.geo(keys[i % keys.length], triG([0, 0, -hl * 0.4], [0, 0, hl * 0.4], [0, -0.5, 0])); K.pop(); }
  },
  // 등불 줄 (축제 · 광산촌): 처진 줄에 작은 등 여러 개
  lights(a, b, sag = 0.9, key = 'lampF', grp = 3, col = 0xffd080, step = 1.6){
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(3, Math.round(L / 0.8)), yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
    const yAt = t => lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * sag;
    for (let i = 0; i < n; i++){ const t0 = i / n, t1 = (i + 1) / n, y0 = yAt(t0), y1 = yAt(t1), hl = L / n; K.push(lerp(a[0], b[0], (t0 + t1) / 2), (y0 + y1) / 2, lerp(a[2], b[2], (t0 + t1) / 2), yaw); K.box('rope', 0.02, 0.02, Math.hypot(hl, y1 - y0), 0, 0, 0, -Math.atan2(y1 - y0, hl)); K.pop(); }
    const m = Math.max(2, Math.round(L / step)); for (let i = 1; i < m; i++){ const t = i / m, x = lerp(a[0], b[0], t), z = lerp(a[2], b[2], t), y = yAt(t), fl = key === 'lampF' ? FESTL[i % FESTL.length] : [key, col];
      if (key === 'lampF'){ K.geo(fl[0], cyl(0.16, 0.13, 0.32, 7), x, y - 0.26, z); K.geo('woodD', cyl(0.165, 0.165, 0.03, 7), x, y - 0.09, z); } else K.geo(fl[0], sph(0.13, 6, 4), x, y - 0.18, z, 0, 0, 0, 1, 1.25, 1); if (i % 2) glow(x, y - 0.22, z, fl[1], 1.4, 0.35, grp); }
  },
  pole(x, z, h = 4.4){ const y = gyk(x, z); K.geo('woodD', cyl(0.07, 0.09, h, 6), x, y + h / 2, z); cc(x, z, 0.15); return [x, y + h - 0.2, z]; },
  pickaxe(x, y, z, ry = 0, lean = 0.35){ K.push(x, y, z, ry, lean); K.geo('wood', cyl(0.035, 0.035, 1.2, 5), 0, 0.6, 0); K.geo('iron', tubeG([[-0.38, 1.12, 0], [0, 1.24, 0], [0.38, 1.12, 0]], 0.045, 0.02, 4, 3)); K.pop(); },
  ores(x, z, r = 1.2, n = 9, key = 'redrock'){ const y = gyk(x, z); for (let i = 0; i < n; i++) K.geo(i < 2 ? 'ore' : key, ico(rr(0.3, 0.7), 0), x + rr(-r, r), y + rr(0.1, 0.6), z + rr(-r, r), R(), R(), R()); cc(x, z, r * 0.9); },
};
// 갈대 · 풀 무더기 (가는 원뿔)
function reeds(x, z, n, r = 1.2, y0, key = 'reed'){ for (let i = 0; i < n; i++){ const px = x + rr(-r, r), pz = z + rr(-r, r), y = y0 ?? gyk(px, pz), h = rr(1.0, 2.0); K.geo(key, cone(0.05, h, 3), px, y + h / 2 - 0.1, pz, rr(-0.15, 0.15), 0, rr(-0.15, 0.15)); if (R() < 0.3) K.geo('woodD', cyl(0.07, 0.07, 0.3, 5), px, y + h - 0.05, pz); } }

// ───────────────────────── 집 짓기 (면 로컬: x 오른쪽 · y 위 · z 바깥) — landmarks 의 집과 같은 결 ─────────────────────────
const PAINT = ['pBlue', 'pGreen', 'pRed', 'pTeal'], WALLS = ['plaster', 'plaster', 'plaster2', 'plaster3'];
function win(x, y, w, h, paint, sh = true){
  K.box('win', w, h, 0.06, x, y, 0.03);
  K.box('beam', w + 0.18, 0.1, 0.14, x, y + h / 2 + 0.05, 0.07); K.box('stone', w + 0.3, 0.1, 0.24, x, y - h / 2 - 0.05, 0.1);
  K.box('beam', 0.09, h, 0.14, x - w / 2 - 0.045, y, 0.07); K.box('beam', 0.09, h, 0.14, x + w / 2 + 0.045, y, 0.07); K.box('beam', 0.05, h, 0.08, x, y, 0.07);
  if (sh) for (const s of [-1, 1]) K.box(paint, w * 0.5, h + 0.06, 0.05, x + s * (w * 0.75 + 0.1), y, 0.05, 0, s * 0.25, 0);
}
function door(x, w, h, paint, y = 0){
  K.box(paint, w, h, 0.1, x, y + h / 2, 0.04); for (let i = 0; i < 2; i++) K.box('iron', w * 0.8, 0.05, 0.03, x, y + 0.45 + i * h * 0.45, 0.1);
  K.box('beam', w + 0.5, 0.22, 0.22, x, y + h + 0.11, 0.1); for (const s of [-1, 1]) K.box('beam', 0.18, h + 0.2, 0.18, x + s * (w / 2 + 0.09), y + h / 2, 0.08);
  K.box('stone', w + 0.6, 0.16, 0.6, x, y - 0.06, 0.32);
}
function flowerBox(x, y, w){ K.box('beam', w, 0.2, 0.26, x, y, 0.16); for (let i = 0; i < Math.round(w / 0.22); i++) K.geo(R() < 0.55 ? 'flower' : R() < 0.5 ? 'flowerY' : 'leaf', ico(rr(0.07, 0.11), 0), x - w / 2 + 0.1 + i * 0.22, y + 0.14 + rr(0, 0.06), 0.16 + rr(-0.05, 0.05)); }
function wallLamp(x, y, key = 'lampN', grp = 0, col = 0xffb860){ K.box('iron', 0.04, 0.04, 0.4, x, y + 0.35, 0.2); K.box(key, 0.2, 0.28, 0.2, x, y, 0.42); K.geo('iron', cone(0.2, 0.16, 4), x, y + 0.22, 0.42, 0, Math.PI / 4, 0); glow(x, y, 0.42, col, 2.0, 0.25, grp); }
function timber(fw, y0, h, n){
  const t = 0.16, bw = fw / n; K.box('beam', fw + 0.04, t, 0.1, 0, y0 + t / 2, 0.05); K.box('beam', fw + 0.04, t, 0.1, 0, y0 + h - t / 2, 0.05);
  for (let i = 0; i <= n; i++) K.box('beam', t, h, 0.1, -fw / 2 + i * bw + (i === 0 ? t / 2 : i === n ? -t / 2 : 0), y0 + h / 2, 0.05);
}
// 한 면: o = { door, timber, lamp, flowers, wkey }
function face(fw, y0, h, paint, o = {}){
  const n = Math.max(2, Math.round(fw / 1.8)), bw = fw / n, di = o.door ? Math.floor(n / 2) : -1;
  if (o.timber) timber(fw, y0, h, n);
  for (let i = 0; i < n; i++){
    const cx = -fw / 2 + (i + 0.5) * bw;
    if (i === di){ const dw = Math.min(1.15, bw - 0.4); door(cx, dw, 2.1, paint, y0); if (o.lamp) wallLamp(cx + dw / 2 + 0.45, y0 + 2.3, o.lampKey, o.lampGrp, o.lampCol); continue; }
    if (n <= 3 || (i + (o.door ? 1 : 0)) % 2 === 0 || o.door){ const ww = Math.min(0.9, bw - 0.6), wh = Math.min(1.1, h * 0.4); win(cx, y0 + h * 0.58, ww, wh, paint, R() < 0.7); if (o.flowers && R() < 0.5) flowerBox(cx, y0 + h * 0.58 - wh / 2 - 0.22, ww + 0.25); }
  }
}
function roofG(w, d, y, pitch, oh, key, th = 0.18){
  const hd = d / 2 + oh, rise = (d / 2) * Math.tan(pitch), L = hd / Math.cos(pitch);
  for (const s of [-1, 1]) K.box(key, w + oh * 2, th, L, 0, y + rise - (hd / 2) * Math.tan(pitch) + th / 2, s * hd / 2, s * pitch, 0, 0);
  K.geo(key === 'thatch' ? 'thatch' : 'beam', cyl(th * 0.8, th * 0.8, w + oh * 2 + 0.05, 6), 0, y + rise + th * 0.75, 0, 0, 0, Math.PI / 2);
  return rise;
}
function gables(w, d, y, rise, key, tim = true){
  for (const s of [-1, 1]){
    K.geo(key, triG([s * w / 2, y, -d / 2], [s * w / 2, y, d / 2], [s * w / 2, y + rise, 0]));
    if (!tim) continue; K.push(s * w / 2, 0, 0, s * Math.PI / 2);
    K.box('beam', d, 0.16, 0.12, 0, y + 0.08, 0.05); K.box('beam', 0.16, rise - 0.15, 0.12, 0, y + (rise - 0.15) / 2, 0.05);
    K.pop();
  }
}
const faces = (w, d) => [[0, d / 2, 0, w], [0, -d / 2, Math.PI, w], [w / 2, 0, Math.PI / 2, d], [-w / 2, 0, -Math.PI / 2, d]];
// 미니맵 윤곽 + 뒤에 놓는 것들이 피할 사각형 (돌린 사각형의 AABB + 1m)
const mapbox = (x, z, hw, hd, ry) => { CUR.mapbox.push([OX + x, OZ + z, hw, hd, ry]); const ex = Math.abs(Math.cos(ry)) * hw + Math.abs(Math.sin(ry)) * hd + 1.0, ez = Math.abs(Math.sin(ry)) * hw + Math.abs(Math.cos(ry)) * hd + 1.0; if (CUR.rects) CUR.rects.push([x - ex, z - ez, x + ex, z + ez]); };
// 집: (x, z) 그룹 로컬, ry = 정면(문) 방향. o = { w, d, fl, wall, roof, paint, chimney, smoke, snow, lampKey, lampGrp }
function house(x, z, ry, o = {}){
  const w = o.w || 7, d = o.d || 6, fl = o.fl || 1, wall = o.wall || pick(WALLS), roof = o.roof || pick(['slate', 'shingle', 'thatch']), paint = o.paint || pick(PAINT);
  const [lo, hi] = foot(OX + x, OZ + z, w / 2 + 0.6, d / 2 + 0.6, ry), y0 = hi + 0.05;
  K.push(x, y0, z, ry);
  const pl = y0 - lo + 0.9; K.box(o.base || 'stone', w + 0.5, pl, d + 0.5, 0, 0.3 - pl / 2, 0);
  const fo = { lampKey: o.lampKey, lampGrp: o.lampGrp, lampCol: o.lampCol };
  let top, W2 = w, D2 = d;
  if (fl === 1){
    const h = o.h || 3.0; K.box(wall, w, h, d, 0, 0.3 + h / 2, 0);
    faces(w, d).forEach(([fx, fz, fr, fw], i) => { if (i === 1 && !o.back) return; K.push(fx, 0, fz, fr); face(fw, 0.3, h, paint, Object.assign({ timber: o.timber !== false, door: i === 0, lamp: i === 0, flowers: o.flowers !== false }, fo)); K.pop(); });
    top = 0.3 + h;
  } else {
    const h1 = 2.9, h2 = 2.6, jet = 0.35; K.box(o.base || 'stone', w, h1, d, 0, 0.3 + h1 / 2, 0);
    faces(w, d).forEach(([fx, fz, fr, fw], i) => { if (i === 1) return; K.push(fx, 0, fz, fr); face(fw, 0.3, h1, paint, Object.assign({ door: i === 0, lamp: i === 0 }, fo)); K.pop(); });
    const y2 = 0.3 + h1; W2 = w + 0.1; D2 = d + jet * 2; K.box('beam', W2 + 0.04, 0.22, D2, 0, y2 + 0.11, 0);
    const yy = y2 + 0.22; K.box(wall, W2, h2, D2, 0, yy + h2 / 2, 0);
    faces(W2, D2).forEach(([fx, fz, fr, fw], i) => { if (i === 1) return; K.push(fx, 0, fz, fr); face(fw, yy, h2, paint, { timber: o.timber !== false, flowers: o.flowers !== false }); K.pop(); });
    top = yy + h2;
  }
  const thatch = roof === 'thatch', pitch = o.pitch || (thatch ? 0.85 : 0.78);
  const rise = roofG(W2, D2, top, pitch, thatch ? 0.55 : 0.45, roof, thatch ? 0.4 : 0.18); gables(W2, D2, top, rise, wall === 'stone' || wall === 'darkst' ? wall : wall, o.timber !== false);
  if (o.snow){ const hd = D2 / 2 + 0.45, L = hd / Math.cos(pitch); for (const s of [-1, 1]) K.box('snow', W2 + 0.9, 0.12, L * 0.92, 0, top + rise - (hd / 2) * Math.tan(pitch) + 0.26, s * hd / 2, s * pitch, 0, 0); }
  if (o.chimney !== false){ const cx = W2 * (R() < 0.5 ? -0.3 : 0.3), cz = -D2 * 0.18; K.box('stone', 0.75, rise + 1.3, 0.75, cx, top + (rise + 1.3) / 2, cz); K.box('stoneD', 0.9, 0.16, 0.9, cx, top + rise + 1.3, cz); if (o.smoke !== false && R() < 0.8) CUR.smoke.push(kpt(cx, top + rise + 1.5, cz)); }
  K.pop(); cb(x, z, W2 / 2 + 0.25, D2 / 2 + 0.25, ry); mapbox(x, z, W2 / 2, D2 / 2, ry);
  return { y0, top: top + rise };
}
// 판잣집: 세로 판자 벽 · 외쪽 양철 지붕 · 앞 툇마루 (o = { w, d, h, wall, roof, paint, porch, stove })
function shack(x, z, ry, o = {}){
  const w = o.w || 5, d = o.d || 4, h = o.h || 2.8, wall = o.wall || 'wood', roof = o.roof || 'tin', paint = o.paint || 'woodD', pd = o.porch === false ? 0 : 1.6;
  const [lo, hi] = foot(OX + x, OZ + z, w / 2 + 0.5, d / 2 + pd / 2 + 0.5, ry), y0 = hi + 0.25;
  K.push(x, y0, z, ry);
  const pl = y0 - lo + 0.4; for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) K.box('stoneD', 0.35, pl, 0.35, sx * (w / 2 - 0.2), -pl / 2, sz * (d / 2 - 0.2));
  K.box('woodD', w + 0.1, 0.16, d + 0.1, 0, -0.08, 0);
  K.box(wall, w, h, d, 0, h / 2, 0);
  for (const s of [-1, 1]) for (let i = 0; i < Math.floor(w / 0.6); i++) K.box('woodD', 0.05, h, 0.04, -w / 2 + 0.35 + i * 0.6, h / 2, s * (d / 2 + 0.02));
  K.push(0, 0, d / 2); door(-w * 0.2, 0.95, 2.0, paint, 0); win(w * 0.24, h * 0.6, 0.75, 0.7, paint, false); K.pop();
  K.push(w / 2, 0, 0, Math.PI / 2); win(0, h * 0.6, 0.6, 0.6, paint, false); K.pop();
  const rise = o.rise ?? 0.9, Lr = Math.hypot(d + 0.9, rise), a = Math.atan2(rise, d + 0.9);
  K.box(roof, w + 0.6, 0.1, Lr, 0, h + rise / 2 + 0.05, 0, -a);
  for (const s of [-1, 1]) K.geo(wall, triG([s * w / 2, h, -d / 2], [s * w / 2, h, d / 2], [s * w / 2, h + rise * (d / (d + 0.9)) + 0.02, d / 2]));
  if (roof === 'tin') for (let i = 0; i < Math.floor(w / 0.5); i++) K.box('iron', 0.03, 0.04, Lr, -w / 2 + 0.25 + i * 0.5, h + rise / 2 + 0.11, 0, -a);
  if (pd){ K.box('wood', w, 0.12, pd, 0, -0.06, d / 2 + pd / 2); for (const s of [-1, 1]) K.box('woodD', 0.14, h - 0.1, 0.14, s * (w / 2 - 0.15), (h - 0.1) / 2, d / 2 + pd - 0.1); K.box(roof, w + 0.3, 0.08, pd + 0.4, 0, h - 0.05, d / 2 + pd / 2, 0.22);
    if (o.porchLamp !== false){ K.push(0, 0, d / 2); wallLamp(w * 0.05, 2.15, o.lampKey, o.lampGrp, o.lampCol); K.pop(); } }
  if (o.stove !== false){ const sx = -w * 0.3, sz = -d * 0.2; K.geo('iron', cyl(0.12, 0.12, 1.4, 6), sx, h + rise * 0.4 + 0.5, sz); K.geo('iron', cone(0.22, 0.2, 6), sx, h + rise * 0.4 + 1.25, sz); CUR.smoke.push(kpt(sx, h + rise * 0.4 + 1.4, sz)); }
  K.pop(); cb(x, z, w / 2 + 0.2, d / 2 + 0.2, ry); mapbox(x, z, w / 2, d / 2, ry);
  return { y0, top: y0 + h + rise };
}
// 맞배 천막 (o = { w, L, h, key, open })
function ridgeTent(x, z, ry, o = {}){
  const w = o.w || 3, L = o.L || 4, h = o.h || 2.4, key = o.key || 'canvas', [lo] = foot(OX + x, OZ + z, w / 2, L / 2, ry), y = lo;
  K.push(x, y, z, ry);
  const sl = Math.hypot(w / 2, h), a = Math.atan2(h, w / 2);
  for (const s of [-1, 1]) K.box(key, 0.05, sl, L, s * w / 4, h / 2, 0, 0, 0, s * (Math.PI / 2 - a));
  K.geo(key, triG([-w / 2, 0, -L / 2], [w / 2, 0, -L / 2], [0, h, -L / 2]));
  for (const s of [-1, 1]) K.geo(key, triG([s * w / 2, 0, L / 2], [s * w * 0.12, 0, L / 2 + 0.25], [0, h, L / 2]));
  K.geo('dark', triG([-w * 0.12, 0, L / 2 - 0.05], [w * 0.12, 0, L / 2 - 0.05], [0, h * 0.85, L / 2 - 0.05]));
  for (const s of [-1, 1]) K.geo('woodD', cyl(0.04, 0.05, h + 0.3, 5), 0, (h + 0.3) / 2, s * (L / 2 + 0.05));
  K.geo('woodD', cyl(0.035, 0.035, L + 0.3, 5), 0, h + 0.02, 0, Math.PI / 2, 0, 0);
  for (const s of [-1, 1]){ link('rope', [0, h + 0.2, s * (L / 2 + 0.05)], [0, 0.05, s * (L / 2 + 1.2)], 0.015); K.box('woodD', 0.05, 0.3, 0.05, 0, 0.1, s * (L / 2 + 1.2)); }
  K.pop(); cb(x, z, w / 2 + 0.1, L / 2 + 0.2, ry);
}
// 큰 천막 (막사 · 치료소 · 기록 천막): 줄무늬 벽 + 모임 지붕 (o = { w, d, h, key, stripe, roof, emblem })
function pavilion(x, z, ry, o = {}){
  const w = o.w || 6, d = o.d || 5, h = o.h || 2.2, rh = o.rh || 1.8, key = o.key || 'canvas', st = o.stripe || key, rk = o.roof || st, [lo] = foot(OX + x, OZ + z, w / 2, d / 2, ry), y = lo;
  K.push(x, y, z, ry);
  for (const [fx, fz, fr, fw] of faces(w, d)){ K.push(fx, 0, fz, fr); const n = Math.max(2, Math.round(fw / 0.9));
    for (let i = 0; i < n; i++){ const cx = -fw / 2 + (i + 0.5) * fw / n; if (fz > 0 && Math.abs(cx) < 0.8) continue; K.box(i % 2 ? st : key, fw / n + 0.01, h, 0.04, cx, h / 2, 0); }
    for (let i = 0; i < n * 2; i++){ const cx = -fw / 2 + (i + 0.5) * fw / (n * 2); K.geo(i % 2 ? key : st, triG([cx - fw / (n * 4), h, 0.05], [cx + fw / (n * 4), h, 0.05], [cx, h - 0.3, 0.05])); }
    K.pop(); }
  K.box('dark', 1.5, h - 0.05, 0.02, 0, h / 2, d / 2 - 0.3);
  const c = [0, h + rh, 0], q = [[-w / 2 - 0.2, h, -d / 2 - 0.2], [w / 2 + 0.2, h, -d / 2 - 0.2], [w / 2 + 0.2, h, d / 2 + 0.2], [-w / 2 - 0.2, h, d / 2 + 0.2]];
  for (let i = 0; i < 4; i++){ const a = q[i], b = q[(i + 1) % 4], m = 6; for (let k = 0; k < m; k++){ const t0 = k / m, t1 = (k + 1) / m; K.geo(k % 2 ? rk : key, triG([lerp(a[0], b[0], t0), h, lerp(a[2], b[2], t0)], [lerp(a[0], b[0], t1), h, lerp(a[2], b[2], t1)], c)); } }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.geo('woodD', cyl(0.05, 0.06, h + 0.1, 5), sx * w / 2, h / 2, sz * d / 2);
  K.geo('woodD', cyl(0.05, 0.05, 1.0, 5), 0, h + rh + 0.4, 0); K.geo(o.cap || 'gold', sph(0.12, 6, 4), 0, h + rh + 0.9, 0);
  if (o.emblem){ K.box('fabricW', 1.0, 1.0, 0.02, 0, h * 0.62, d / 2 + 0.04); K.box(o.emblem, 0.22, 0.7, 0.02, 0, h * 0.62, d / 2 + 0.06); K.box(o.emblem, 0.7, 0.22, 0.02, 0, h * 0.62, d / 2 + 0.06); }
  K.pop(); cb(x, z, w / 2 + 0.15, d / 2 + 0.15, ry); mapbox(x, z, w / 2, d / 2, ry);
  return { top: y + h + rh + 1 };
}
// 나무 망루 (로컬 기준 ry · 사다리는 +z 쪽)
function watchtower(x, z, ry, o = {}){
  const ht = o.h || 8.4, ty = gy(x, z) - 0.3; K.push(x, ty, z, ry);
  for (const [a, b] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]){ K.geo('woodD', tubeG([[a * 1.25, 0, b * 1.25], [a, ht, b]], 0.2, 0.15, 5, 2)); }
  for (const hh of [ht * 0.31, ht * 0.64]) for (const [ax, az, bx, bz] of [[-1.6, -1.6, 1.6, -1.6], [1.6, -1.6, 1.6, 1.6], [1.6, 1.6, -1.6, 1.6], [-1.6, 1.6, -1.6, -1.6]]){ const k = 1.2 - hh / 30; link('woodD', [ax * k, hh, az * k], [bx * k, hh + 1.6, bz * k], 0.12); }
  K.box('wood', 3.8, 0.25, 3.8, 0, ht, 0); for (const s of [-1, 1]){ K.box('wood', 3.8, 0.9, 0.12, 0, ht + 0.6, s * 1.85); K.box('wood', 0.12, 0.9, 3.8, s * 1.85, ht + 0.6, 0); }
  for (const [a, b] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) K.geo('woodD', cyl(0.08, 0.08, 2.4, 5), a, ht + 1.2, b);
  K.geo(o.roof || 'thatch', cone(3.4, 2.0, 4), 0, ht + 3.2, 0, 0, Math.PI / 4, 0);
  K.push(0, 0, 2.0); for (const s of [-1, 1]) K.box('woodD', 0.1, ht + 0.2, 0.1, s * 0.35, ht / 2, 0, -0.08); for (let i = 0; i < Math.floor(ht / 0.55); i++) K.box('wood', 0.75, 0.06, 0.1, 0, 0.4 + i * 0.55, 0.04 * (16 - i) * 0.06); K.pop();
  if (o.lamp !== false){ K.box('lampN', 0.24, 0.3, 0.24, 1.75, ht + 1.0, 1.75); glow(1.75, ht + 1.0, 1.75, 0xffa848, 2.4, 0.3); }
  K.geo('woodD', cyl(0.05, 0.05, 2.4, 5), 0, ht + 5.2, 0);
  const top = kpt(0, ht + 6.3, 0); K.pop();
  for (const [a, b] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]){ K.push(x, 0, z, ry); cc(a * 1.25, b * 1.25, 0.3); K.pop(); }
  return top;   // 깃발 자리 (그룹 로컬)
}
// 들어오는 길목 표지판 (글자판 아틀라스 한 장)
const SA = (() => { const cw = 512, ch = 128, cols = 2, rows = 12, c = G.cnv(cw * cols, ch * rows), t = G.tex(c, true, 1, 1); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; let n = 0;
  return { c, x: c.getContext('2d'), t, cw, ch, cols, rows, next(){ const i = n++, col = i % cols, row = (i / cols) | 0; return { px: col * cw, py: row * ch, uv: [col / cols, 1 - (row + 1) / rows, (col + 1) / cols, 1 - row / rows] }; } }; })();
add('signT', std({ map: SA.t, roughness: 0.85 }));
const quadUV = (w, h, uv) => { const g = plane(w, h), a = g.attributes.uv; a.setXY(0, uv[0], uv[3]); a.setXY(1, uv[2], uv[3]); a.setXY(2, uv[0], uv[1]); a.setXY(3, uv[2], uv[1]); return g; };
const SIGNC = {};
function signCell(text, sub){
  const k = text + '|' + sub; if (SIGNC[k]) return SIGNC[k];
  const s = SA.next(), x = SA.x, { px, py } = s, w = SA.cw, h = SA.ch;
  const g = x.createLinearGradient(0, py, 0, py + h); g.addColorStop(0, '#7a5434'); g.addColorStop(1, '#5a3a22'); x.fillStyle = g; x.fillRect(px, py, w, h);
  x.fillStyle = 'rgba(0,0,0,.14)'; for (let i = 0; i < 5; i++) x.fillRect(px, py + 14 + i * 24, w, 2);
  x.strokeStyle = '#c99a48'; x.lineWidth = 4; x.strokeRect(px + 6, py + 6, w - 12, h - 12);
  x.fillStyle = '#f6e6be'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 5; x.font = `900 ${text.length > 7 ? 44 : 52}px "Gowun Batang", serif`; x.fillText(text, px + w / 2, py + (sub ? 50 : h / 2 + 2), w - 40);
  if (sub){ x.shadowBlur = 0; x.fillStyle = '#e9c87e'; x.font = '700 19px "Cinzel", serif'; x.fillText(sub.toUpperCase().split('').join(' '), px + w / 2, py + 98, w - 40); } x.shadowBlur = 0;
  return (SIGNC[k] = s.uv);
}
// 길목 표지판: (x, z) 에 길을 보고 서요
function townSign(x, z, ry, t){
  const uv = signCell(t.name, t.en), y = gyk(x, z) - 0.1; K.push(x, y, z, ry);
  for (const s of [-1, 1]){ K.geo('woodD', cyl(0.09, 0.11, 3.0, 6), s * 1.3, 1.5, 0); K.geo('woodD', cone(0.12, 0.22, 6), s * 1.3, 3.1, 0); }
  K.box('wood', 2.6, 0.72, 0.1, 0, 2.35, 0); for (const s of [-1, 1]) K.geo('signT', quadUV(2.5, 0.64, uv), 0, 2.35, s * 0.055, 0, s > 0 ? 0 : Math.PI, 0);
  K.box('beam', 2.8, 0.1, 0.16, 0, 2.76, 0); K.box('lampN', 0.18, 0.24, 0.18, 1.3, 2.86, 0.2); glow(1.3, 2.86, 0.2, 0xffb860, 1.6, 0.25);
  K.pop(); K.push(x, 0, z, ry); cb(0, 0, 1.4, 0.2); K.pop();
}
// 길이 정착지 둘레를 지나는 곳마다 표지판 (길 옆 3.5m · 길을 봐요)
function entrySigns(t, maxN = 2){
  const done = []; let n = 0;
  for (let i = 0; i < 72 && n < maxN; i++){ const a = i / 72 * TAU, rx = Math.cos(a) * (t.r + 3), rz = Math.sin(a) * (t.r + 3), rn = roadNear(OX + rx, OZ + rz); if (!rn || rn[2] > rn[3].w / 2 + 0.5) continue;
    if (done.some(([x, z]) => Math.hypot(x - rx, z - rz) < 14)) continue; done.push([rx, rz]);
    const s = rn[3], ux = s.ex / Math.sqrt(s.l2), uz = s.ez / Math.sqrt(s.l2);
    for (const side of [1, -1]){ const off = s.w / 2 + 2.6, x = rx - uz * off * side, z = rz + ux * off * side; if (!free(x, z, 1.4, { plaza: true, maxR: t.r + 9, roadPad: 0.3 })) continue; townSign(x, z, Math.atan2(-x + rx, -z + rz) + 0, t); occupy(x, z, 1.6); n++; break; }
  }
}

// ───────────────────────── 움직이는 작은 것들 (정점색 병합 → 인스턴스 · 매달린 묶음) ─────────────────────────
// fn 안에서 K 로 그린 것을 정점색 지오메트리 하나로 (원점 기준 로컬)
function vcGeo(fn){ const pk = K, pb = B, sb = new LB(1e9); B = sb; K = new G.Kit(sb); try { fn(); } finally { K = pk; B = pb; } const list = []; for (const k in sb.g) for (const g of sb.g[k]) list.push([k, g]); return mergeVC(list, 0.06); }
const VCG = {};
const boatGeo = () => VCG.boat || (VCG.boat = vcGeo(() => { K.geo('wood', sph(1, 10, 5, 0, TAU, 0, Math.PI / 2), 0, 0.42, 0, Math.PI, 0, 0, 0.75, 0.42, 2.0); K.geo('woodD', tor(1, 0.06, 3, 18), 0, 0.42, 0, Math.PI / 2, 0, 0, 0.75, 2.0, 1);
  for (const z of [-0.7, 0.5]) K.box('woodD', 1.3, 0.07, 0.3, 0, 0.32, z); for (const s of [-1, 1]) K.geo('woodD', cyl(0.025, 0.025, 2.0, 4), s * 0.85, 0.42, 0.1, 1.45, 0, s * 0.3); }));
const buoyGeo = () => VCG.buoy || (VCG.buoy = vcGeo(() => { K.geo('fabricR', sph(0.28, 8, 6), 0, 0.12, 0); K.geo('fabricW', cyl(0.27, 0.27, 0.12, 8), 0, 0.12, 0); K.geo('iron', cyl(0.03, 0.03, 0.7, 4), 0, 0.5, 0); K.geo('fabricY', cone(0.08, 0.16, 4), 0, 0.88, 0); }));
const chickGeo = () => VCG.chick || (VCG.chick = vcGeo(() => { K.geo('chick', sph(0.17, 7, 5), 0, 0.2, 0, 0, 0, 0, 1, 0.85, 1.25); K.geo('chick', sph(0.1, 6, 4), 0, 0.36, 0.15); K.geo('fabricY', cone(0.03, 0.08, 4), 0, 0.35, 0.27, Math.PI / 2, 0, 0); K.geo('fabricR', sph(0.04, 4, 3), 0, 0.46, 0.15, 0, 0, 0, 0.6, 1.2, 1.4); K.geo('chick', cone(0.08, 0.16, 4), 0, 0.3, -0.18, -1.0, 0, 0); for (const s of [-1, 1]) K.geo('fabricY', cyl(0.012, 0.012, 0.14, 3), s * 0.06, 0.05, 0); }));
// 출렁이는 것 (배 · 부표): list = [[x, y, z, ry]] 그룹 로컬
function bobbers(geo, list, amp = 0.05, roll = 0.05){
  if (!list.length) return; const im = new THREE.InstancedMesh(geo, vcMat(grainTex), list.length); im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false; CUR.near.add(im);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new V3(), one = new V3(1, 1, 1), ph = list.map(() => R() * 6);
  const upd = t => { for (let i = 0; i < list.length; i++){ const it = list[i]; e.set(Math.sin(t * 0.8 + ph[i]) * roll * 0.6, it[3], Math.sin(t * 1.1 + ph[i]) * roll); q.setFromEuler(e); m4.compose(v.set(it[0], it[1] + Math.sin(t * 1.3 + ph[i]) * amp, it[2]), q, one); im.setMatrixAt(i, m4); } im.instanceMatrix.needsUpdate = true; };
  upd(0); anim((dt, t) => upd(t));
}
// 흔들리는 묶음 (빨래 · 매달린 것): pivot 에서 yaw 방향 축으로 앞뒤로 흔들려요. fn 의 K 원점 = pivot, 줄 = 로컬 z 축
function swayer(pivot, yaw, fn, amp = 0.12, sp = 1.6){
  const geo = vcGeo(fn); if (!geo) return; const outer = new THREE.Group(); outer.position.set(...pivot); outer.rotation.y = yaw; const m = meshOf(geo, vcMat(grainTex)); m.matrixAutoUpdate = true; outer.add(m); CUR.near.add(outer);
  const ph = R() * 6; anim((dt, t) => { m.rotation.x = Math.sin(t * sp + ph) * amp + Math.sin(t * sp * 2.3 + ph) * amp * 0.3; }); return m;
}
// 빨랫줄: 두 기둥 + 흔들리는 빨래
function laundry(x0, z0, x1, z1){
  const y0 = gy(x0, z0), y1 = gy(x1, z1); for (const [x, y, z] of [[x0, y0, z0], [x1, y1, z1]]){ K.geo('woodD', cyl(0.06, 0.07, 2.6, 5), x, y + 1.3, z); K.box('woodD', 0.5, 0.06, 0.06, x, y + 2.5, z); cc(x, z, 0.2); }
  const L = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0), ym = Math.max(y0, y1) + 2.5;
  link('rope', [x0, y0 + 2.5, z0], [x1, y1 + 2.5, z1], 0.02);
  if (LOW){ for (let i = 0; i < 5; i++){ const t = (i + 0.7) / 6, x = lerp(x0, x1, t), z = lerp(z0, z1, t); K.geo(pick(['fabricW', 'fabricB', 'fabricR', 'fabricY']), plane(0.7, rr(0.6, 0.9)), x, lerp(y0, y1, t) + 2.1, z, 0, yaw + Math.PI / 2, 0); } return; }
  swayer([(x0 + x1) / 2, ym, (z0 + z1) / 2], yaw, () => { for (let i = 0; i < 6; i++){ const h = rr(0.6, 1.0); K.geo(['fabricW', 'fabricB', 'fabricR', 'fabricY', 'fabricW', 'fabricG'][i], plane(0.7, h), 0, -h / 2 - 0.02, -L / 2 + 0.9 + i * (L - 1.8) / 5, 0, Math.PI / 2, 0); } }, 0.16, 1.4);
}
// 밭 (soil 바닥 + 작물): 사각형 [x0, z0, x1, z1] 그룹 로컬, crop = wheat | pumpkin | cabbage | herb
add('wheatT', std({ map: canvasTex(128, 128, (x, w) => { x.clearRect(0, 0, w, w); for (let i = 0; i < 26; i++){ const bx = 6 + Math.random() * (w - 12), lean = (Math.random() - 0.5) * 18, top = 14 + Math.random() * 30; x.strokeStyle = `rgb(${190 + Math.random() * 40 | 0},${150 + Math.random() * 40 | 0},${60 + Math.random() * 30 | 0})`; x.lineWidth = 2.2;
  x.beginPath(); x.moveTo(bx, w); x.quadraticCurveTo(bx + lean * 0.3, (w + top) / 2, bx + lean, top + 12); x.stroke(); x.fillStyle = `rgb(${215 + Math.random() * 30 | 0},${170 + Math.random() * 40 | 0},${70 + Math.random() * 30 | 0})`; x.beginPath(); x.ellipse(bx + lean, top + 6, 3.2, 9, lean * 0.02, 0, TAU); x.fill(); } }), alphaTest: 0.45, side: DS, roughness: 0.95 }));
MAT.wheatT.userData.noCast = true;
function field(x0, z0, x1, z1, crop = 'wheat', o = {}){
  const gap = crop === 'wheat' ? 0.9 : crop === 'pumpkin' ? 1.5 : 1.0, sp = crop === 'wheat' ? 0.95 : 1.4, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, cosA = Math.cos(o.ry || 0), sinA = Math.sin(o.ry || 0);
  let n = 0;
  for (let a = x0 + gap / 2; a < x1; a += gap) for (let b = z0 + sp / 2; b < z1; b += sp * (LOW && crop === 'wheat' ? 1.4 : 1)){
    const lx = a - mx, lz = b - mz, px = mx + lx * cosA + lz * sinA, pz = mz - lx * sinA + lz * cosA;
    if (!free(px, pz, crop === 'wheat' ? 0.35 : 0.5, { plaza: o.plaza, maxR: CUR.r + 6, roadPad: 0.3, keepK: 0.5 })) continue;
    const y = gy(px, pz); n++;
    if (crop === 'wheat'){ const h = rr(0.85, 1.15), ry = R() * 3; K.geo('wheatT', plane(1.1, h), px, y + h / 2 - 0.05, pz, 0, ry, 0); K.geo('wheatT', plane(1.1, h), px, y + h / 2 - 0.05, pz, 0, ry + Math.PI / 2, 0); }
    else if (crop === 'pumpkin'){ const s = rr(0.28, 0.5); K.geo('pumpkin', sph(s, 8, 6), px + rr(-0.2, 0.2), y + s * 0.65, pz + rr(-0.2, 0.2), 0, R() * 3, 0, 1.25, 0.85, 1.25); K.geo('leafB', cyl(0.04, 0.05, 0.22, 4), px, y + s * 1.3, pz); for (let k = 0; k < 2; k++) K.geo('leafB', ico(rr(0.2, 0.3), 0), px + rr(-0.6, 0.6), y + 0.1, pz + rr(-0.6, 0.6), 0, 0, 0, 1, 0.35, 1); }
    else if (crop === 'cabbage') K.geo('cabbage' in MAT ? 'cabbage' : 'leafC', ico(rr(0.22, 0.3), 1), px, y + 0.2, pz);
    else { K.geo('herb', ico(rr(0.16, 0.26), 0), px, y + 0.18, pz, 0, 0, 0, 1, 1.3, 1); if (R() < 0.35) K.geo(pick(['flower', 'flowerY', 'flowerW']), ico(0.07, 0), px + 0.1, y + 0.42, pz); }
  }
  if (n && o.soil !== false){ const sg = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.max(2, (x1 - x0) / 2 | 0), Math.max(2, (z1 - z0) / 2 | 0)).rotateX(-Math.PI / 2); if (o.ry) sg.rotateY(o.ry); sg.translate(mx, 0, mz); meterUV(sg); drape(sg, OX, OZ, 0.05); K.geo('pathD', sg); }
  CUR.rects.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
  return n;
}
add('cabbage', std({ color: 0x8acb5a, roughness: 0.7, flatShading: true }));
function scarecrow(x, z, ry){ const y = gy(x, z); K.push(x, y, z, ry); K.geo('woodD', cyl(0.05, 0.06, 2.4, 5), 0, 1.2, 0); K.box('woodD', 1.6, 0.08, 0.08, 0, 1.65, 0); K.geo('hay', sph(0.25, 7, 5), 0, 2.3, 0); K.geo('hay', cone(0.42, 0.42, 7), 0, 2.56, 0); K.geo('fabricB', cylM(0.3, 0.4, 0.8, 7), 0, 1.55, 0);
  for (const s of [-1, 1]) K.geo('hay', cone(0.08, 0.3, 4), s * 0.85, 1.6, 0, 0, 0, s * Math.PI / 2); K.geo('dark', sph(0.04, 4, 3), 0.09, 2.34, 0.22); K.geo('dark', sph(0.04, 4, 3), -0.09, 2.34, 0.22); K.pop(); cc(x, z, 0.3); }
function hives(x, z, ry, n = 3){ for (let i = 0; i < n; i++){ const px = x + Math.cos(ry) * (i - (n - 1) / 2) * 1.5, pz = z - Math.sin(ry) * (i - (n - 1) / 2) * 1.5, y = gy(px, pz); K.push(px, y, pz, ry); for (const s of [-1, 1]) K.box('woodD', 0.08, 0.35, 0.6, s * 0.35, 0.17, 0); for (let k = 0; k < 3; k++) K.box(k % 2 ? 'plaster2' : 'plaster', 0.8, 0.3, 0.62, 0, 0.5 + k * 0.31, 0); K.box('roof2', 0.95, 0.07, 0.78, 0, 1.33, 0); K.box('dark', 0.3, 0.05, 0.02, 0, 0.4, 0.32); K.pop(); cc(px, pz, 0.5); } }

// ───────────────────────── 볕드는 농원 (farm) ─────────────────────────
function barn(x, z, ry){
  const w = 7.6, d = 10, [lo, hi] = foot(OX + x, OZ + z, w / 2 + 0.3, d / 2 + 0.3, ry), y = hi + 0.05;
  K.push(x, y, z, ry);
  K.box('stone', w + 0.3, y - lo + 0.6, d + 0.3, 0, 0.3 - (y - lo + 0.6) / 2, 0);
  K.box('pRed', w, 4.4, d, 0, 2.5, 0);
  K.push(0, 0, 0, Math.PI / 2); const rise = roofG(d, w, 4.7, 0.92, 0.5, 'shingle'); gables(d, w, 4.7, rise, 'pRed', false); K.pop();
  // 정면 (+z): 큰 문 · 흰 X 테 · 건초 다락문
  K.push(0, 0, d / 2); K.box('woodD', 3.2, 3.3, 0.1, 0, 1.95, 0.03); for (const s of [-1, 1]) K.box('fabricW', 0.14, 3.9, 0.05, 0, 1.95, 0.1, 0, 0, s * 0.77); K.box('fabricW', 3.4, 0.16, 0.06, 0, 3.6, 0.1); for (const s of [-1, 1]) K.box('fabricW', 0.16, 3.4, 0.06, s * 1.6, 1.95, 0.1);
  K.box('woodD', 1.3, 1.1, 0.1, 0, 5.6, 0.03); K.box('fabricW', 1.5, 0.1, 0.06, 0, 6.2, 0.1); K.box('beam', 0.12, 0.12, 1.4, 0, 6.6, 0.6); K.geo('rope', cyl(0.015, 0.015, 1.4, 3), 0, 5.9, 1.25); K.pop();
  for (const s of [-1, 1]){ K.push(s * w / 2, 0, 0, s * Math.PI / 2); for (const zz of [-2.6, 0, 2.6]) win(zz, 2.6, 0.7, 0.7, 'fabricW', false); K.pop(); }
  K.pop(); cb(x, z, w / 2 + 0.3, d / 2 + 0.3, ry); mapbox(x, z, w / 2, d / 2, ry);
  // 풍향계 (용마루 앞쪽 · 천천히 흔들려요)
  const vx = x + Math.sin(ry) * (d / 2 - 0.6), vz = z + Math.cos(ry) * (d / 2 - 0.6), vy = y + 4.7 + Math.tan(0.92) * w / 2 + 0.3;
  K.geo('iron', cyl(0.03, 0.03, 1.4, 4), vx, vy + 0.7, vz);
  const vg = new THREE.Group(); vg.position.set(vx, vy + 1.3, vz); CUR.near.add(vg);
  const vm = meshOf(vcGeo(() => { K.box('iron', 0.04, 0.04, 1.2, 0, 0, 0); K.geo('iron', cone(0.1, 0.25, 4), 0, 0, 0.66, Math.PI / 2, 0, 0); K.box('iron', 0.02, 0.32, 0.3, 0, 0.05, -0.5); K.geo('iron', sph(0.12, 6, 4), 0, 0.22, -0.05, 0, 0, 0, 0.6, 1, 1.4); K.geo('iron', cone(0.07, 0.25, 3), 0, 0.42, -0.2, 0.6, 0, 0); }), vcMat(grainTex)); vm.matrixAutoUpdate = true; vg.add(vm);
  const ph = R() * 6; anim((dt, t) => { vm.rotation.y = 0.8 + Math.sin(t * 0.23 + ph) * 0.9 + Math.sin(t * 1.3) * 0.08; });
  return { x, z, y, ry, w, d };
}
function silo(x, z){
  const [lo] = footC(OX + x, OZ + z, 2.3), y = lo - 0.2; K.push(x, y, z);
  K.geo('plaster2', cylM(2.1, 2.2, 9, 14), 0, 4.5, 0); for (const h of [1.6, 3.6, 5.6, 7.6]) K.geo('iron', tor(2.17, 0.05, 3, 20), 0, h, 0, Math.PI / 2);
  K.geo('tin', sph(2.2, 14, 6, 0, TAU, 0, Math.PI / 2), 0, 9, 0); K.geo('iron', cone(0.3, 0.6, 6), 0, 11.5, 0);
  for (const s of [-1, 1]) K.box('iron', 0.05, 8.6, 0.05, s * 0.25, 4.5, 2.25); for (let i = 0; i < 16; i++) K.box('iron', 0.5, 0.04, 0.04, 0, 0.6 + i * 0.5, 2.25);
  K.box('woodD', 1.0, 1.4, 0.08, 0, 0.9, 2.18);
  K.pop(); cc(x, z, 2.3); mapbox(x, z, 2.2, 2.2, 0);
}
function coop(x, z, ry){
  const y = gy(x, z); K.push(x, y, z, ry);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box('woodD', 0.12, 0.9, 0.12, sx * 1.05, 0.45, sz * 0.65);
  K.box('wood', 2.4, 1.3, 1.5, 0, 1.55, 0); for (let i = 0; i < 5; i++) K.box('woodD', 0.05, 1.3, 0.04, -1.0 + i * 0.5, 1.55, 0.77);
  for (const s of [-1, 1]) K.box('shingle', 2.8, 0.08, 1.15, 0, 2.45, s * 0.42, s * 0.6); K.box('dark', 0.4, 0.5, 0.02, 0.6, 1.3, 0.76);
  link('wood', [0.6, 1.0, 0.8], [0.6, 0.02, 2.2], 0.45, 0.05); for (let i = 1; i < 5; i++) K.box('woodD', 0.45, 0.04, 0.05, 0.6, lerp(1.0, 0.02, i / 5) + 0.04, lerp(0.8, 2.2, i / 5));
  K.pop(); cb(x, z, 1.35, 0.85, ry);
  // 닭 마당 (낮은 울타리) + 닭들
  K.push(x, 0, z, ry); const run = [[-2.2, 1.2], [2.2, 1.2], [2.2, 4.8], [-2.2, 4.8]].map(([a, b]) => { const v = K.world(a, b); return [v.x, v.z]; }); K.pop();
  for (let i = 0; i < 4; i++){ if (i === 3) continue; const [ax, az] = run[i], [bx, bz] = run[(i + 1) % 4]; P.fence(ax, az, bx, bz, { h: 0.7, gap: 1.2, rails: [0.3, 0.75] }); }
  const NC = LOW ? 4 : 7, cs = [];
  for (let i = 0; i < NC; i++){ const a = rr(-1.6, 1.6), b = rr(1.8, 4.4); K.push(x, 0, z, ry); const v = K.world(a, b); K.pop(); cs.push({ x: v.x, z: v.z, y: gy(v.x, v.z), ry: R() * TAU, ph: R() * 9 }); }
  const im = new THREE.InstancedMesh(chickGeo(), vcMat(grainTex), NC); im.frustumCulled = false; im.castShadow = false; CUR.near.add(im);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new V3(), one = new V3(1, 1, 1);
  const upd = t => { for (let i = 0; i < cs.length; i++){ const c = cs[i], pk = Math.pow(Math.max(0, Math.sin(t * 2.2 + c.ph)), 8); e.set(pk * 0.7, c.ry + Math.sin(t * 0.4 + c.ph) * 1.2, 0); q.setFromEuler(e); m4.compose(v.set(c.x, c.y, c.z), q, one); im.setMatrixAt(i, m4); } im.instanceMatrix.needsUpdate = true; };
  upd(0); anim((dt, t) => upd(t));
}
function trough(x, z, ry){ const y = gy(x, z); K.push(x, y, z, ry); K.box('wood', 2.2, 0.55, 0.75, 0, 0.35, 0); K.box('waterS', 2.0, 0.04, 0.55, 0, 0.6, 0); for (const s of [-1, 1]) K.box('woodD', 0.1, 0.35, 0.8, s * 0.9, 0.12, 0); K.pop(); K.push(x, 0, z, ry); cb(0, 0, 1.1, 0.4); K.pop(); }
// 꽃 아치 (길을 가로질러요): (x, z) 가운데 · ry = 길 방향 · w = 폭
function flowerArch(x, z, ry, w = 6){
  const y = Math.min(gy(x - Math.cos(ry) * w / 2, z + Math.sin(ry) * w / 2), gy(x + Math.cos(ry) * w / 2, z - Math.sin(ry) * w / 2)); K.push(x, y, z, ry + Math.PI / 2);
  for (const s of [-1, 1]){ K.geo('woodD', cyl(0.1, 0.12, 3.6, 6), s * w / 2, 1.8, 0); for (let i = 0; i < 9; i++) K.geo(i % 3 ? 'leafA' : pick(['flower', 'flowerY', 'flowerW']), ico(i % 3 ? 0.2 : 0.14, 0), s * w / 2 + rr(-0.15, 0.15), 0.3 + i * 0.38, rr(-0.15, 0.15)); }
  K.geo('woodD', tor(w / 2, 0.09, 4, 18, Math.PI), 0, 3.6, 0, 0, 0, 0, 1, 0.4, 1);
  for (let i = 0; i <= 22; i++){ const a = i / 22 * Math.PI, px = Math.cos(a) * w / 2, py = 3.6 + Math.sin(a) * w / 2 * 0.4; K.geo(i % 2 ? 'leafA' : pick(['flower', 'flowerY', 'flowerW', 'rose']), ico(i % 2 ? 0.24 : 0.17, 0), px, py, rr(-0.12, 0.12)); }
  K.geo('lampF', sph(0.16, 6, 4), 0, 3.6 + w * 0.2 - 0.3, 0); glow(0, 3.6 + w * 0.2 - 0.3, 0, 0xffd080, 2.2, 0.35, 3);
  K.pop(); K.push(x, 0, z, ry + Math.PI / 2); cc(-w / 2, 0, 0.2); cc(w / 2, 0, 0.2); K.pop();
}
function bFarm(t){
  const R0 = t.r; let s, p;
  // 농가 (2층 초가) · 헛간 · 사일로 · 닭장
  const farmhouse = site(2, -24, 9, 7.4, { maxR: R0 + 5, maxDh: 1.8, max: 11 }) || site(-4, 20, 9, 7.4, { maxR: R0 + 5, maxDh: 2.5, max: 11 }); if (farmhouse) t.home = house(farmhouse.x, farmhouse.z, farmhouse.ry, { w: 9, d: 7, fl: 2, roof: 'thatch', paint: 'pGreen', wall: 'plaster2' });
  const bs = site(-21, -3, 7.8, 10.2, { maxDh: 3, k: 0.8 }); const bn = bs ? barn(bs.x, bs.z, bs.ry) : null;
  s = site(-26, -15, 4.6, 4.6, { maxDh: 3 }); if (s) silo(s.x, s.z);
  s = site(20, 9, 4.6, 6.5, { maxDh: 2, k: 0.7 }); if (s) coop(s.x, s.z, s.ry);
  // 밭: 남쪽 밀밭 둘 · 동쪽 호박밭 · 집 앞 채소밭 (검게 썩은 밭 셋피스 자리는 비워 둬요)
  field(1, 12, 25, 23, 'wheat'); field(-29, 13, -6, 25, 'wheat'); field(11, -31, 27, -13, 'pumpkin'); field(-14, -32, -4, -24, 'cabbage');
  p = prop(9, 17, 0.6, { max: 6 }); if (p) scarecrow(p[0], p[1], faceTo(p[0], p[1]));
  // 밭 울타리 (남쪽 가장자리)
  for (const [ax, az, bx, bz] of [[0, 24, 26, 24], [-30, 26, -5, 26], [28, -32, 28, -12]]) if (free((ax + bx) / 2, (az + bz) / 2, 0.5, { maxR: R0 + 8, plaza: true, roadPad: 0.5 })) P.fence(ax, az, bx, bz, { gap: 2.4, cap: 'woodD' });
  // 우물 · 여물통 · 건초 · 벌통 (하니 할머니 곁) · 수레 · 빨랫줄
  p = prop(-9, 12, 1.3); if (p) P.well(p[0], p[1]);
  p = prop(14, -4, 1.2); if (p) trough(p[0], p[1], faceTo(p[0], p[1]) + Math.PI / 2);
  for (const [x, z] of [[-29, 8], [-27, 14], [-31, -6]]){ p = prop(x, z, 1.3); if (p) P.hayStack(p[0], p[1]); }
  for (const [x, z] of [[-16, 8], [-14, 11]]){ p = prop(x, z, 1.0); if (p) P.hay(p[0], p[1], R() * 3); }
  p = prop(-17, -11, 2.4); if (p) hives(p[0], p[1], faceTo(p[0], p[1]) + Math.PI / 2);
  p = prop(-12, -16, 1.8); if (p) P.cart(p[0], p[1], R() * TAU, 'pumpkin');
  if (farmhouse){ const a = farmhouse.ry + Math.PI / 2, cx = farmhouse.x + Math.sin(farmhouse.ry) * 7, cz = farmhouse.z + Math.cos(farmhouse.ry) * 7, ex = Math.sin(a) * 3.2, ez = Math.cos(a) * 3.2;
    if (free(cx + ex + 6, cz + ez, 0.4, { plaza: true }) && free(cx - ex + 6, cz - ez, 0.4, { plaza: true })) laundry(cx + ex + 6, cz + ez, cx - ex + 6, cz - ez);
    else { p = prop(16, -22, 3.5); if (p) laundry(p[0] - 3, p[1] + 1, p[0] + 3, p[1] - 1); } }
  for (const [x, z, n] of [[-17, 3, 3], [6, -16, 2], [24, 0, 2]]){ p = prop(x, z, 1.1); if (p) P.clutter(p[0], p[1], n); }
  p = prop(-7, -14, 1.0); if (p) P.bench(p[0], p[1], faceTo(p[0], p[1]));
  // 광장 둘레: 과일 노점 · 소풍 탁자 · 꽃밭 · 사과나무
  p = prop(12, 6, 1.9, { max: 6 }); if (p) produceStall(p[0], p[1], faceTo(p[0], p[1]));
  p = prop(-11, -3, 1.2, { max: 5 }); if (p){ P.table(p[0], p[1], faceTo(p[0], p[1]) + Math.PI / 2); for (const sd of [-1, 1]){ const a = faceTo(p[0], p[1]), q = [p[0] + Math.sin(a) * sd * 1.1, p[1] + Math.cos(a) * sd * 1.1]; if (free(q[0], q[1], 0.4, { plaza: true })) P.bench(q[0], q[1], a + (sd > 0 ? Math.PI : 0)); } }
  if (farmhouse){ const a = farmhouse.ry, fx = farmhouse.x + Math.sin(a) * 5.6, fz = farmhouse.z + Math.cos(a) * 5.6; for (const sd of [-1, 1]){ const q = [fx + Math.cos(a) * sd * 3.2, fz - Math.sin(a) * sd * 3.2]; if (free(q[0], q[1], 1.0, { plaza: true })) flowerBed(q[0], q[1], a, 2.8); } }
  trees([[-30, -22], [27, -2], [-24, 22], [16, 28], [-6, 30], [30, 14]], 4, 'oak', 1.0, 1.35);
  // 등불 · 길목 표지판
  for (const [x, z] of [[11, -3], [-9, 6], [-6, -18], [22, 3]]){ p = prop(x, z, 0.5); if (p) P.lamp(p[0], p[1], 'wood', faceRoad(p[0], p[1])); }
  entrySigns(t);
  // 축제 장식 (festival): 꽃 아치 · 깃발 줄 · 등불 줄 · 등불 호박
  const fest = [];
  fest.push(() => { const rn = roadNear(OX + R0 * 0.8, OZ + 4); if (rn){ const s2 = rn[3], ry = Math.atan2(s2.ex, s2.ez); flowerArch(rn[0] - OX, rn[1] - OZ, ry, 6.2); } });
  if (farmhouse && bn) fest.push(() => { const a = [farmhouse.x + 3, gy(farmhouse.x, farmhouse.z) + 5.4, farmhouse.z], b = [bn.x, bn.y + 5.4, bn.z]; P.pennants(a, b, 1.4, ['fabricR', 'fabricY', 'fabricB', 'fabricG', 'fabricW']); });
  fest.push(() => { const pts = []; for (const [x, z] of [[-9, -11], [10, -11], [12, 9], [-10, 9]]){ const q = spot(x, z, 0.4, { plaza: true, max: 4 }); if (q) pts.push(P.pole(q[0], q[1], 4.6)); } for (let i = 0; i < pts.length; i++) P.lights(pts[i], pts[(i + 1) % pts.length], 0.8); });
  fest.push(() => { for (let i = 0; i < 6; i++){ const a = i / 6 * TAU, x = Math.cos(a) * 6.5, z = Math.sin(a) * 6.5; if (!free(x, z, 0.5, { plaza: true })) continue; const y = gy(x, z); K.geo('pumpkin', sph(0.38, 8, 6), x, y + 0.3, z, 0, a, 0, 1.25, 0.85, 1.25); K.geo('lampF', new THREE.CircleGeometry(0.1, 3), x + Math.cos(a) * 0.01, y + 0.36, z, 0, -a + Math.PI / 2, 0); K.geo('leafB', cyl(0.04, 0.05, 0.2, 4), x, y + 0.66, z); glow(x, y + 0.35, z, 0xffa040, 1.4, 0.4, 3); } });
  t.chg.festival = subMesh(() => { for (const f of fest) f(); }, [0, t.y, 0]); skyLanterns(t.chg.festival, [0, t.y, 0], 20, LOW ? 8 : 14); t.chg.festival.visible = false;
}

// ───────────────────────── 잎새 마을 (treehouse) ─────────────────────────
// 큰 나무: 굵은 줄기 · 뿌리 · 우듬지 · 7~9m 높이 둥근 마루 + 오두막 + 사다리 + 매달린 등불
function bigTree(x, z, deckH, ry){
  const y0 = gy(x, z) - 0.3, tr = rr(1.6, 2.0), Ht = deckH + 7.5, dR = rr(4.4, 5.2), dy = y0 + deckH;
  const tg = new THREE.CylinderGeometry(tr * 0.62, tr * 1.25, Ht, 12, 5, true), tp = tg.attributes.position, k0 = R() * 9;
  for (let i = 0; i < tp.count; i++){ const px = tp.getX(i), py = tp.getY(i), pz = tp.getZ(i), a = Math.atan2(pz, px), kk = 1 + 0.1 * Math.sin(a * 5 + k0) + 0.06 * Math.sin(a * 11 + py * 0.4); tp.setXYZ(i, px * kk + Math.sin(py * 0.15 + k0) * 0.25, py, pz * kk); }
  tg.computeVertexNormals(); uvm(tg, 10, 6); K.geo('bark2', tg, x, y0 + Ht / 2, z);
  for (let i = 0; i < 6; i++){ const a = i / 6 * TAU + R() * 0.5, ca = Math.cos(a), sa = Math.sin(a); K.geo('bark2', tubeG([[x + ca * tr * 0.8, y0 + 2.2, z + sa * tr * 0.8], [x + ca * (tr + 1.0), y0 + 0.8, z + sa * (tr + 1.0)], [x + ca * (tr + 2.6), y0 + 0.1, z + sa * (tr + 2.6)]], 0.7, 0.15, 5, 3)); }
  // 가지 · 우듬지
  for (let i = 0; i < 5; i++){ const a = i / 5 * TAU + R(), ca = Math.cos(a), sa = Math.sin(a), bh = dy + rr(2.5, 5), br = rr(3.5, 5.5);
    K.geo('bark2', tubeG([[x + ca * tr * 0.5, bh, z + sa * tr * 0.5], [x + ca * br * 0.6, bh + 1.8, z + sa * br * 0.6], [x + ca * br, bh + 3.2, z + sa * br]], 0.5, 0.18, 5, 3));
    K.geo(pick(['leafA', 'leafB', 'leafC']), ico(rr(2.6, 3.6), 1), x + ca * br, bh + 4.2, z + sa * br, R(), R(), 0, 1, 0.7, 1); }
  for (let i = 0; i < 4; i++){ const a = R() * TAU, d = rr(0, 2.5); K.geo(pick(['leafA', 'leafB']), ico(rr(3.8, 4.8), 1), x + Math.cos(a) * d, y0 + Ht + rr(-0.5, 1.5), z + Math.sin(a) * d, R(), R(), 0, 1, 0.68, 1); }
  // 마루 (원판) · 받침대 · 난간
  K.geo('wood', cylM(dR, dR, 0.3, 18), x, dy, z); K.geo('woodD', tor(dR, 0.12, 3, 24), x, dy - 0.08, z, Math.PI / 2);
  for (let i = 0; i < 6; i++){ const a = i / 6 * TAU + 0.3, ca = Math.cos(a), sa = Math.sin(a); link('woodD', [x + ca * tr * 0.75, dy - 2.6, z + sa * tr * 0.75], [x + ca * (dR - 0.4), dy - 0.12, z + sa * (dR - 0.4)], 0.16); }
  const ladA = ry + Math.PI * 0.75, lca = Math.cos(ladA), lsa = Math.sin(ladA), gaps = [ladA];
  // 오두막 (마루 위 · 바깥을 봐요)
  const cx = x + Math.sin(ry) * dR * 0.42, cz = z + Math.cos(ry) * dR * 0.42; K.push(cx, dy + 0.15, cz, ry);
  K.box('wood', 3.2, 2.3, 2.8, 0, 1.15, 0); for (let i = 0; i < 6; i++) K.box('woodD', 0.05, 2.3, 0.04, -1.35 + i * 0.54, 1.15, 1.42);
  K.push(0, 0, 1.4); door(-0.6, 0.85, 1.8, 'pGreen', 0); win(0.8, 1.35, 0.6, 0.6, 'pGreen', false); K.pop(); K.push(-1.6, 0, 0, -Math.PI / 2); win(0, 1.35, 0.55, 0.55, 'pGreen', false); K.pop();
  const rise = roofG(3.2, 2.8, 2.3, 0.85, 0.45, 'thatch', 0.32); gables(3.2, 2.8, 2.3, rise, 'wood', false);
  K.geo('iron', cyl(0.08, 0.08, 1.2, 5), 1.0, 2.3 + rise * 0.6 + 0.4, -0.5); CUR.smoke.push(kpt(1.0, 2.3 + rise * 0.6 + 1.0, -0.5)); wallLampAt(0.25, 2.0, 1.45);
  K.pop();
  for (let i = 0; i < 20; i++){ const a = i / 20 * TAU; if (gaps.some(g => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.2)) continue; K.box('woodD', 0.09, 1.0, 0.09, x + Math.cos(a) * (dR - 0.1), dy + 0.6, z + Math.sin(a) * (dR - 0.1)); }
  K.geo('woodD', tor(dR - 0.1, 0.05, 3, 28), x, dy + 1.05, z, Math.PI / 2);
  // 사다리 (땅 → 마루 가장자리)
  { const ax = x + lca * (dR + 0.9), az = z + lsa * (dR + 0.9), bx = x + lca * (dR - 0.2), bz = z + lsa * (dR - 0.2), ga = gy(ax, az), pa = -lsa, pb = lca;
    for (const s of [-1, 1]) link('woodD', [ax + pa * s * 0.32, ga, az + pb * s * 0.32], [bx + pa * s * 0.32, dy + 1.0, bz + pb * s * 0.32], 0.08);
    const n = Math.floor((dy - ga) / 0.4); for (let i = 1; i < n; i++){ const tt = i / n; K.push(lerp(ax, bx, tt), lerp(ga, dy + 1.0, tt), lerp(az, bz, tt), Math.atan2(pa, pb)); K.box('wood', 0.7, 0.05, 0.08, 0, 0, 0); K.pop(); }
    cc(ax, az, 0.4); }
  // 매달린 등불 (마루 가장자리 밑)
  for (let i = 0; i < 3; i++){ const a = ry + i * 2.1 + 0.5; P.hangLamp(x + Math.cos(a) * (dR - 0.3), dy - 0.15, z + Math.sin(a) * (dR - 0.3), 'lampN', 0xffc070); }
  cc(x, z, tr * 1.25 + 0.3); for (let i = 0; i < 6; i++){ const a = i / 6 * TAU; cc(x + Math.cos(a) * (tr + 1.6), z + Math.sin(a) * (tr + 1.6), 0.5); }
  mapbox(x, z, dR * 0.7, dR * 0.7, 0);
  return { x, z, y: dy, r: dR, ry };
}
function wallLampAt(x, y, z, key = 'lampN', grp = 0, col = 0xffb860){ K.push(x, 0, z - 0.42); wallLamp(0, y, key, grp, col); K.pop(); }
// 밧줄 다리: 두 마루 가장자리 사이 (출렁이는 판자 + 밧줄 난간 + 가운데 등불)
function ropeBridge(A, B){
  const dx = B.x - A.x, dz = B.z - A.z, L0 = Math.hypot(dx, dz), ux = dx / L0, uz = dz / L0, ax = A.x + ux * (A.r - 0.4), az = A.z + uz * (A.r - 0.4), bx = B.x - ux * (B.r - 0.4), bz = B.z - uz * (B.r - 0.4), L = Math.hypot(bx - ax, bz - az), sag = Math.min(1.6, L * 0.07), yaw = Math.atan2(ux, uz), px = -uz, pz = ux;
  const yAt = t => lerp(A.y + 0.1, B.y + 0.1, t) - Math.sin(t * Math.PI) * sag, n = Math.max(6, Math.round(L / 0.45));
  for (let i = 0; i <= n; i++){ const tt = i / n; K.push(lerp(ax, bx, tt), yAt(tt), lerp(az, bz, tt), yaw); K.box(i % 4 ? 'wood' : 'woodD', 1.15, 0.06, 0.3, 0, 0, 0, 0, 0, rr(-0.04, 0.04)); K.pop(); }
  const rail = t => yAt(t) + 1.0 + Math.sin(t * Math.PI) * sag * 0.25;
  for (const s of [-1, 1]){ for (let i = 0; i < 8; i++){ const t0 = i / 8, t1 = (i + 1) / 8; link('rope', [lerp(ax, bx, t0) + px * s * 0.6, rail(t0), lerp(az, bz, t0) + pz * s * 0.6], [lerp(ax, bx, t1) + px * s * 0.6, rail(t1), lerp(az, bz, t1) + pz * s * 0.6], 0.04); }
    for (let i = 1; i < 8; i++){ const tt = i / 8, x = lerp(ax, bx, tt) + px * s * 0.6, z = lerp(az, bz, tt) + pz * s * 0.6; link('rope', [x, yAt(tt), z], [x, rail(tt), z], 0.025); } }
  P.hangLamp((ax + bx) / 2 + px * 0.6, rail(0.5), (az + bz) / 2 + pz * 0.6, 'lampN', 0xffc070);
}
function herbGarden(x, z, ry){ K.push(x, gy(x, z), z, ry); for (const [bx, bz] of [[-1.3, 0], [1.3, 0]]){ K.box('wood', 2.0, 0.4, 3.2, bx, 0.2, bz); K.box('soil', 1.8, 0.05, 3.0, bx, 0.41, bz); for (let i = 0; i < 9; i++){ const hx = bx + rr(-0.7, 0.7), hz = bz + rr(-1.3, 1.3); K.geo('herb', ico(rr(0.14, 0.24), 0), hx, 0.55, hz, 0, 0, 0, 1, 1.4, 1); if (R() < 0.4) K.geo(pick(['flower', 'flowerY', 'flowerW']), ico(0.06, 0), hx, 0.78, hz); } } K.pop(); K.push(x, 0, z, ry); cb(0, 0, 2.4, 1.7); K.pop(); }
function hunterRack(x, z, ry){
  const y = gy(x, z); K.push(x, y, z, ry);
  for (const s of [-1, 1]) for (const k of [-1, 1]) K.geo('woodD', cyl(0.06, 0.07, 2.6, 5), s * 1.5 + k * 0.25, 1.2, 0, 0, 0, k * 0.2);
  K.box('woodD', 3.6, 0.08, 0.08, 0, 2.35, 0); K.box('woodD', 3.2, 0.06, 0.06, 0, 1.2, 0);
  for (let i = 0; i < 3; i++) K.geo('pelt', plane(0.8, 1.15), -1.0 + i * 1.0, 1.75, 0.02, 0, 0, rr(-0.08, 0.08));
  K.geo('bone', tubeG([[-0.3, 2.4, 0.05], [-0.6, 2.8, 0.1], [-0.75, 3.1, 0]], 0.05, 0.02, 4, 3)); K.geo('bone', tubeG([[0.3, 2.4, 0.05], [0.6, 2.8, 0.1], [0.75, 3.1, 0]], 0.05, 0.02, 4, 3)); K.geo('bone', sph(0.16, 6, 4), 0, 2.45, 0.08);
  K.geo('woodD', tor(0.6, 0.03, 3, 10, Math.PI), 1.4, 0.9, 0.25, 0, Math.PI / 2, Math.PI / 2); K.geo('woodD', cyl(0.02, 0.02, 1.2, 3), 1.4, 0.9, 0.25);
  K.pop(); K.push(x, 0, z, ry); cb(0, 0, 1.8, 0.3); K.pop();
  P.logSeat(x + Math.sin(ry) * 1.8, z + Math.cos(ry) * 1.8, ry + Math.PI / 2, 1.8);
}
function totem(x, z, ry){ const y = gy(x, z) - 0.2; K.push(x, y, z, ry); for (let i = 0; i < 3; i++){ K.geo(['pGreen', 'wood', 'pTeal'][i], cylM(0.42, 0.48, 1.3, 8), 0, 0.65 + i * 1.3, 0); K.geo('dark', sph(0.09, 4, 3), 0.17, 0.9 + i * 1.3, 0.38); K.geo('dark', sph(0.09, 4, 3), -0.17, 0.9 + i * 1.3, 0.38); }
  for (const s of [-1, 1]) K.box('wood', 1.6, 0.14, 0.45, s * 0.9, 3.75, 0, 0, 0, s * 0.3); K.geo('leafA', cone(0.4, 0.8, 6), 0, 4.4, 0); K.pop(); cc(x, z, 0.55); }
function woodpile(x, z, ry){ const y = gy(x, z); K.push(x, y, z, ry); for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) K.geo('bark2', cylM(0.2, 0.2, 1.6, 7), (i - (3 - r) / 2) * 0.42, 0.2 + r * 0.36, 0, 0, 0, Math.PI / 2); K.pop(); K.push(x, 0, z, ry); cb(0, 0, 0.9, 0.9); K.pop(); }
function bLeaf(t){
  const R0 = t.r; let p;
  const trees = [];
  for (const [x, z, h] of [[-17, -5, 7.5], [-12, 17, 8.5], [17, -9, 8.2], [18, 15, 7.2]]){ const s = site(x, z, 5.4, 5.4, { maxR: R0 + 3, max: 8, roadPad: 1.6, face: 'road' }); if (s){ trees.push(bigTree(s.x, s.z, h + rr(-0.4, 0.4), s.ry)); occupy(s.x, s.z, 5.2); } }
  // 밧줄 다리: 가까운 나무끼리 (8~30m)
  const done = new Set();
  for (let i = 0; i < trees.length; i++){ let best = -1, bd = 1e9; for (let j = 0; j < trees.length; j++){ if (i === j || done.has(Math.min(i, j) + ',' + Math.max(i, j))) continue; const d = Math.hypot(trees[i].x - trees[j].x, trees[i].z - trees[j].z); if (d < bd && d > 8 && d < 34){ bd = d; best = j; } }
    if (best >= 0){ done.add(Math.min(i, best) + ',' + Math.max(i, best)); ropeBridge(trees[i], trees[best]); } }
  if (trees.length >= 4 && !done.has('0,2')) ropeBridge(trees[0], trees[2]);   // 길 위를 건너는 다리
  // 땅 위: 작은 오두막 둘 · 약초 텃밭 · 사냥꾼 건조대 · 화덕 · 장작 · 토템
  for (const [x, z] of [[2, 22], [-24, 4]]){ const s = site(x, z, 5.6, 5.0, { maxDh: 2 }); if (s) house(s.x, s.z, s.ry, { w: 5, d: 4.4, roof: 'thatch', wall: 'plaster2', paint: 'pGreen', back: false }); }
  p = prop(-6, 20, 2.6); if (p) herbGarden(p[0], p[1], faceTo(p[0], p[1]));
  p = prop(-22, -14, 2.4); if (p) hunterRack(p[0], p[1], faceTo(p[0], p[1]));
  p = prop(9, 10, 1.6); if (p){ P.campfire(p[0], p[1]); for (let i = 0; i < 3; i++){ const a = i * 2.1 + 0.4, q = [p[0] + Math.cos(a) * 2.2, p[1] + Math.sin(a) * 2.2]; if (free(q[0], q[1], 0.6, { plaza: true })) P.logSeat(q[0], q[1], a + Math.PI / 2, 1.7); } }
  p = prop(24, 2, 1.2); if (p) woodpile(p[0], p[1], R() * 3);
  p = prop(-9, -11, 0.8); if (p) totem(p[0], p[1], faceTo(p[0], p[1]));
  for (const [x, z] of [[-26, 12], [12, -22], [23, 22], [-4, -24]]){ p = prop(x, z, 1.2); if (p) P.mushrooms(p[0], p[1], 5, 'glowM'); }
  for (const [x, z] of [[14, 20], [-20, 20]]){ p = prop(x, z, 1.0); if (p) P.clutter(p[0], p[1], 2); }
  // 돌 등불 (길가)
  for (let i = 0; i < 6; i++){ const a = i / 6 * TAU + 0.4, x = Math.cos(a) * R0 * 0.62, z = Math.sin(a) * R0 * 0.62, q = roadNear(OX + x, OZ + z); if (!q) continue; const lx = q[0] - OX, lz = q[1] - OZ, d = Math.hypot(x - lx, z - lz) || 1, wx = lx + (x - lx) / d * (q[3].w / 2 + 1.4), wz = lz + (z - lz) / d * (q[3].w / 2 + 1.4); if (free(wx, wz, 0.5, { plaza: true, roadPad: 0.2 })){ P.lamp(wx, wz, 'stone'); occupy(wx, wz, 0.8); } }
  motesFx(t.near, [0, t.y + 3, 0], R0 * 0.9, LOW ? 18 : 40, '0.75, 1.0, 0.5', 9, 0.13);
  entrySigns(t);
}

// ───────────────────────── 물안개 나루 (fishing) ─────────────────────────
// 선착장: a(물가 땅) → b(물 끝) · 폭 w · 바닥 높이 dk · 끝은 T 자. 걸을 수 있어요 (F.groundFn)
function dock(ax, az, bx, bz, w, dk){
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, px = -uz, pz = ux, yaw = Math.atan2(ux, uz), ya = gy(ax, az) + 0.12, rl = Math.min(4, L * 0.25);
  const yAt = s => s < rl ? lerp(ya, dk, s / rl) : dk;
  for (let s = 0.2; s < L; s += 0.42){ K.push(ax + ux * s, yAt(s), az + uz * s, yaw); K.box(R() < 0.22 ? 'woodD' : 'wood', w, 0.08, 0.38, rr(-0.03, 0.03), 0, 0, 0, rr(-0.02, 0.02), 0); K.pop(); }
  for (const s of [-1, 1]){ link('woodD', [ax + px * s * (w / 2 - 0.2), ya - 0.1, az + pz * s * (w / 2 - 0.2)], [ax + ux * rl + px * s * (w / 2 - 0.2), dk - 0.12, az + uz * rl + pz * s * (w / 2 - 0.2)], 0.16, 0.16); link('woodD', [ax + ux * rl + px * s * (w / 2 - 0.2), dk - 0.12, az + uz * rl + pz * s * (w / 2 - 0.2)], [bx + px * s * (w / 2 - 0.2), dk - 0.12, bz + pz * s * (w / 2 - 0.2)], 0.16, 0.16); }
  for (let s = rl; s <= L + 0.01; s += 2.3) for (const sd of [-1, 1]){ const x = ax + ux * s + px * sd * (w / 2 + 0.1), z = az + uz * s + pz * sd * (w / 2 + 0.1), bed = Math.min(gy(x, z), WL) - 0.6, top = dk + (Math.round(s / 2.3) % 2 ? 0.05 : 0.45); K.geo('woodD', cyl(0.13, 0.15, top - bed, 6), x, (top + bed) / 2, z); }
  // T 자 끝
  const ex = bx - ux * 1.5, ez = bz - uz * 1.5, tw = 6.4; for (let s = -tw / 2 + 0.2; s < tw / 2; s += 0.42){ K.push(ex + px * s, dk + 0.01, ez + pz * s, yaw + Math.PI / 2); K.box(R() < 0.22 ? 'woodD' : 'wood', 3.0, 0.08, 0.38, 0, 0, 0); K.pop(); }
  for (const sd of [-1, 1]) for (const k of [-1, 1]){ const x = ex + px * sd * (tw / 2 - 0.1) + ux * k * 1.4, z = ez + pz * sd * (tw / 2 - 0.1) + uz * k * 1.4, bed = Math.min(gy(x, z), WL) - 0.6; K.geo('woodD', cyl(0.14, 0.16, dk + 0.5 - bed, 6), x, (dk + 0.5 + bed) / 2, z); }
  for (const sd of [-1, 1]) P.lamp(ex + px * sd * (tw / 2 - 0.25) - ux * 1.2, ez + pz * sd * (tw / 2 - 0.25) - uz * 1.2, 'wood', yaw + (sd > 0 ? -Math.PI / 2 : Math.PI / 2), { y: dk, col: false });
  for (let i = 0; i < 2; i++){ const s = rl + 3 + i * 5; if (s > L - 3) break; K.geo('iron', cyl(0.08, 0.1, 0.3, 6), ax + ux * s + px * (w / 2 - 0.25), dk + 0.15, az + uz * s + pz * (w / 2 - 0.25)); }
  P.crate(ex - px * 2.2, dk, ez - pz * 2.2, 0.6, yaw); P.barrel(ex - px * 1.4, dk, ez - pz * 1.4 + 0.3);
  platSeg(OX + ax, OZ + az, OX + ax + ux * rl, OZ + az + uz * rl, w, ya + 0.05, dk + 0.05); platSeg(OX + ax + ux * rl, OZ + az + uz * rl, OX + bx, OZ + bz, w, dk + 0.05, dk + 0.05);
  platSeg(OX + ex - px * tw / 2, OZ + ez - pz * tw / 2, OX + ex + px * tw / 2, OZ + ez + pz * tw / 2, 3.0, dk + 0.05, dk + 0.05);
  return { ex, ez, ux, uz, px, pz, L, tw };
}
function netRack(x, z, ry){ const y = gy(x, z); K.push(x, y, z, ry); for (const s of [-1, 1]) K.geo('woodD', cyl(0.07, 0.08, 2.5, 5), s * 1.7, 1.25, 0); K.box('woodD', 3.8, 0.08, 0.08, 0, 2.4, 0); K.geo('net', plane(3.3, 1.7), 0, 1.5, 0.02, 0, 0, 0); K.geo('net', plane(1.4, 1.2), 0.8, 1.7, 0.06, 0, 0.3, 0.2);
  for (let i = 0; i < 6; i++) K.geo('fabricY', sph(0.07, 5, 4), -1.4 + i * 0.56, 2.3, 0.05); P.barrel(1.2, 0, 0.8, 0.9); K.pop(); K.push(x, 0, z, ry); cb(0, 0, 1.9, 0.3); K.pop(); }
function fishRack(x, z, ry){ const y = gy(x, z); K.push(x, y, z, ry); for (const s of [-1, 1]) for (const k of [-1, 1]) K.geo('woodD', cyl(0.05, 0.06, 2.5, 5), s * 1.6, 1.15, k * 0.45, k * 0.38, 0, 0);
  for (const yy of [1.7, 2.25]) K.box('woodD', 3.6, 0.06, 0.06, 0, yy, 0);
  for (const yy of [1.7, 2.25]) for (let i = 0; i < 9; i++){ const fx = -1.4 + i * 0.35; K.geo('rope', cyl(0.008, 0.008, 0.2, 3), fx, yy - 0.1, 0); K.geo('fish', sph(0.07, 6, 4), fx, yy - 0.38, 0, 0, rr(-0.3, 0.3), 0, 0.5, 2.4, 1); K.geo('fish', cone(0.07, 0.12, 3), fx, yy - 0.58, 0, Math.PI, 0, 0, 1, 1, 0.3); }
  K.pop(); K.push(x, 0, z, ry); cb(0, 0, 1.8, 0.5); K.pop(); }
function smokehouse(x, z, ry){ const [lo, hi] = foot(OX + x, OZ + z, 1.9, 1.7, ry), y = hi; K.push(x, y, z, ry);
  K.box('stone', 3.6, y - lo + 0.5, 3.2, 0, 0.25 - (y - lo + 0.5) / 2, 0); K.box('woodD', 3.2, 2.4, 2.8, 0, 1.45, 0); for (let i = 0; i < 6; i++) K.box('bark2', 0.06, 2.4, 0.05, -1.35 + i * 0.54, 1.45, 1.42);
  K.box('dark', 0.8, 1.6, 0.04, 0.6, 1.05, 1.43); const rise = roofG(3.2, 2.8, 2.65, 0.95, 0.4, 'shingle'); gables(3.2, 2.8, 2.65, rise, 'woodD', false);
  K.box('stone', 0.8, 2.6, 0.8, -1.0, 3.6, -0.4); K.box('stoneD', 0.95, 0.15, 0.95, -1.0, 4.95, -0.4); CUR.smoke.push(kpt(-1.0, 5.1, -0.4), kpt(-0.9, 5.1, -0.3));
  K.pop(); cb(x, z, 1.8, 1.6, ry); mapbox(x, z, 1.6, 1.4, ry); woodpile(x + Math.cos(ry) * 2.6, z - Math.sin(ry) * 2.6, ry); }
function upturnedBoat(x, z, ry){ const y = gy(x, z); K.push(x, y, z, ry); for (const s of [-1, 1]){ K.box('woodD', 0.12, 0.6, 1.4, 0, 0.3, s * 1.0); } K.geo('wood', sph(1, 10, 5, 0, TAU, 0, Math.PI / 2), 0, 0.62, 0, 0, 0, 0, 0.8, 0.5, 2.1); K.geo('woodD', tor(1, 0.06, 3, 18), 0, 0.62, 0, Math.PI / 2, 0, 0, 0.8, 2.1, 1);
  for (const s of [-1, 1]) K.geo('woodD', cyl(0.03, 0.03, 2.2, 4), 0.9, 0.05, s * 0.3, Math.PI / 2, 0.2, 0); K.pop(); K.push(x, 0, z, ry); cb(0, 0, 0.9, 2.1); K.pop(); }
function trap(x, z){ const y = gy(x, z); K.box('net', 0.7, 0.45, 0.5, x, y + 0.23, z, 0, R() * 3, 0); K.box('woodD', 0.72, 0.04, 0.52, x, y + 0.46, z); }
// 흙길 띠 (그룹 로컬 a → b, 폭 w)
function path(ax, az, bx, bz, w = 2.2){ const L = Math.hypot(bx - ax, bz - az), g = new THREE.PlaneGeometry(w, L, 1, Math.max(2, L / 2 | 0)).rotateX(-Math.PI / 2); g.rotateY(Math.atan2(bx - ax, bz - az)); g.translate((ax + bx) / 2, 0, (az + bz) / 2); meterUV(g); drape(g, OX, OZ, 0.06); K.geo('pathD', g); }
function bMist(t){
  const R0 = t.r; let p, s;
  const dkp = t.s.dock ? [t.s.dock[0] - t.x, t.s.dock[1] - t.z] : [0, -R0 - 8], L0 = Math.hypot(dkp[0], dkp[1]), ux = dkp[0] / L0, uz = dkp[1] / L0;
  let sd = 3; while (sd < L0 + 10 && !isW(OX + ux * sd, OZ + uz * sd)) sd += 0.5;
  const da = [ux * (sd - 5), uz * (sd - 5)], dbL = Math.max(L0 + 4, sd + 8), db = [ux * dbL, uz * dbL];
  for (let k = 6; k < sd + 2; k += 2.5) occupy(ux * k, uz * k, 2.2);
  path(ux * 6, uz * 6, da[0], da[1], 2.4);
  const D = dock(da[0], da[1], db[0], db[1], 2.6, WL + 0.8);
  // 배 (선착장 양옆 · 끝) · 부표
  const boats = []; for (const [k, sd2] of [[0.55, 1], [0.8, -1]]){ const bx = da[0] + (db[0] - da[0]) * k + D.px * sd2 * 2.6, bz = da[1] + (db[1] - da[1]) * k + D.pz * sd2 * 2.6; if (isW(OX + bx, OZ + bz)) boats.push([bx, wy(OX + bx, OZ + bz) - 0.18, bz, Math.atan2(D.ux, D.uz) + rr(-0.15, 0.15)]); }
  { const bx = D.ex + D.ux * 3.6, bz = D.ez + D.uz * 3.6; if (isW(OX + bx, OZ + bz)) boats.push([bx, wy(OX + bx, OZ + bz) - 0.18, bz, Math.atan2(D.px, D.pz) + 0.2]); }
  bobbers(boatGeo(), boats, 0.05, 0.06);
  const buoys = []; for (let i = 0; i < 7; i++){ const a = i / 7 * Math.PI - Math.PI / 2 + rr(-0.15, 0.15), r = rr(9, 13), bx = D.ex + (D.ux * Math.cos(a) + D.px * Math.sin(a)) * r, bz = D.ez + (D.uz * Math.cos(a) + D.pz * Math.sin(a)) * r; if (isW(OX + bx, OZ + bz)) buoys.push([bx, wy(OX + bx, OZ + bz) - 0.1, bz, R() * 3]); }
  bobbers(buoyGeo(), buoys, 0.07, 0.12);
  // 오두막 넷 · 훈제막
  const ry0 = Math.atan2(ux, uz);
  sites([[-13, -5], [13, -9], [12, 6], [-7, 9], [-18, 6], [20, 4], [-4, 18], [16, -18]], 4, 7, 6.2, { maxDh: 2.5, max: 8 }, s => house(s.x, s.z, s.ry, { w: 6.4, d: 5.4, roof: pick(['slate', 'shingle']), paint: pick(['pBlue', 'pTeal', 'pBlue']), wall: pick(['plaster', 'plaster3']), back: false }));
  s = site(16, -16, 4, 3.6, { maxDh: 2.5, max: 8 }); if (s) smokehouse(s.x, s.z, s.ry);
  // 그물 · 생선 건조대 · 뒤집힌 배 · 통발 · 짐
  for (const [x, z] of [[-11, -15], [9, -19]]){ p = prop(x, z, 2.0, { max: 6 }); if (p) netRack(p[0], p[1], ry0 + Math.PI / 2 + rr(-0.3, 0.3)); }
  for (const [x, z] of [[-16, 3], [5, -15]]){ p = prop(x, z, 2.0, { max: 6 }); if (p) fishRack(p[0], p[1], faceTo(p[0], p[1]) + Math.PI / 2); }
  p = prop(-18, -11, 2.2, { max: 6 }); if (p) upturnedBoat(p[0], p[1], ry0 + 0.6);
  p = prop(da[0] + D.px * 3.4, da[1] + D.pz * 3.4, 1.0, { max: 4 }); if (p) P.clutter(p[0], p[1], 3);
  p = prop(da[0] - D.px * 3.2, da[1] - D.pz * 3.2, 1.0, { max: 4 }); if (p){ for (let i = 0; i < 4; i++) trap(p[0] + rr(-0.8, 0.8), p[1] + rr(-0.8, 0.8)); cc(p[0], p[1], 0.9); }
  for (const [x, z] of [[17, 2], [-15, 12]]){ p = prop(x, z, 1.0); if (p) P.clutter(p[0], p[1], 2); }
  p = prop(-4, -9, 1.0); if (p) P.bench(p[0], p[1], ry0 + Math.PI);
  for (const [x, z] of [[-9, -12], [8, -13], [-14, 7]]){ p = prop(x, z, 0.7); if (p){ P.barrel(p[0] - 0.3, gy(p[0], p[1]), p[1]); P.crate(p[0] + 0.4, gy(p[0], p[1]), p[1] + 0.2, 0.6, R()); cc(p[0], p[1], 0.7); } }
  trees([[-22, 12], [22, 12], [-24, -2], [4, 24], [24, -10]], 3, 'birch', 0.9, 1.2);
  // 등불 (물가 길 · 광장)
  for (const k of [0.45, 0.85]){ const x = ux * sd * k - uz * 2.0, z = uz * sd * k + ux * 2.0; if (free(x, z, 0.4, { plaza: true, roadPad: 0.2 })) P.lamp(x, z, 'wood', ry0); }
  for (const [x, z] of [[8, 1], [-8, -1]]){ p = prop(x, z, 0.5); if (p) P.lamp(p[0], p[1], 'wood', faceRoad(p[0], p[1])); }
  entrySigns(t);
}

// ───────────────────────── 갈대 말뚝 마을 (stilt) ─────────────────────────
// 판자길 (그룹 로컬 a → b, 높이 ya → yb). 걸을 수 있어요. 한쪽에 밧줄 난간
function walk(ax, az, ya, bx, bz, yb, w = 1.9, rail = 1){
  const L = Math.hypot(bx - ax, bz - az); if (L < 0.5) return; const ux = (bx - ax) / L, uz = (bz - az) / L, px = -uz, pz = ux, yaw = Math.atan2(ux, uz);
  for (let s = 0.2; s < L; s += 0.44){ const tt = s / L, broken = R() < 0.05; K.push(ax + ux * s, lerp(ya, yb, tt) - (broken ? 0.08 : 0), az + uz * s, yaw); K.box(R() < 0.3 ? 'woodD' : 'wood', broken ? w * 0.55 : w, 0.08, 0.38, broken ? rr(-0.4, 0.4) : rr(-0.05, 0.05), 0, 0, 0, rr(-0.04, 0.04), broken ? 0.15 : 0); K.pop(); }
  for (const s of [-1, 1]) link('woodD', [ax + px * s * (w / 2 - 0.15), ya - 0.14, az + pz * s * (w / 2 - 0.15)], [bx + px * s * (w / 2 - 0.15), yb - 0.14, bz + pz * s * (w / 2 - 0.15)], 0.13, 0.15);
  const n = Math.max(1, Math.round(L / 2.4));
  for (let k = 0; k <= n; k++){ const tt = k / n, x0 = ax + (bx - ax) * tt, z0 = az + (bz - az) * tt, yy = lerp(ya, yb, tt); for (const s of [-1, 1]){ const x = x0 + px * s * (w / 2 + 0.05), z = z0 + pz * s * (w / 2 + 0.05), bed = Math.min(gy(x, z), WL) - 0.5, top = yy + (s === rail ? 1.0 : 0.02); if (top - bed > 0.2) K.geo('woodD', cyl(0.09, 0.11, top - bed, 5), x, (top + bed) / 2, z, rr(-0.04, 0.04), 0, rr(-0.04, 0.04)); } }
  if (rail) for (let k = 0; k < n; k++){ const t0 = k / n, t1 = (k + 1) / n; link('rope', [ax + (bx - ax) * t0 + px * rail * (w / 2 + 0.05), lerp(ya, yb, t0) + 0.95, az + (bz - az) * t0 + pz * rail * (w / 2 + 0.05)], [ax + (bx - ax) * t1 + px * rail * (w / 2 + 0.05), lerp(ya, yb, t1) + 0.95, az + (bz - az) * t1 + pz * rail * (w / 2 + 0.05)], 0.035); }
  platSeg(OX + ax, OZ + az, OX + bx, OZ + bz, w, ya + 0.04, yb + 0.04);
}
// 땅이 판자길보다 높은 곳(둑)은 땅을 따라 잘라 놓아요
function walkFollow(A, Bn, w, rail){
  const L = Math.hypot(Bn[0] - A[0], Bn[1] - A[1]), n = Math.max(1, Math.round(L / 3)), pts = [];
  for (let i = 0; i <= n; i++){ const tt = i / n, x = lerp(A[0], Bn[0], tt), z = lerp(A[1], Bn[1], tt); pts.push([x, z, Math.max(lerp(A[2], Bn[2], tt), isW(OX + x, OZ + z) ? -1e9 : gy(x, z) + 0.18)]); }
  for (let i = 0; i < n; i++) walk(pts[i][0], pts[i][1], pts[i][2], pts[i + 1][0], pts[i + 1][1], pts[i + 1][2], w, rail);
}
// 판자길 갈림목 마루
function walkPad(x, z, y, r = 1.5){ K.push(x, y, z, R() * 0.4); K.box('wood', r * 2, 0.1, r * 2, 0, -0.02, 0); K.pop(); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){ const px = x + a * r * 0.8, pz = z + b * r * 0.8, bed = Math.min(gy(px, pz), WL) - 0.5; if (y - bed > 0.2) K.geo('woodD', cyl(0.1, 0.12, y - bed, 5), px, (y + bed) / 2, pz); } platCirc(OX + x, OZ + z, r + 0.15, y + 0.04); }
// 말뚝집: 바닥 fy · 앞 툇마루 (걸을 수 있어요) · 갈대 지붕 · 문 옆 등불 (swamp_lanterns 로 켜져요). 돌려줘요: 툇마루 앞 점
function stiltHouse(x, z, ry, o = {}){
  const w = o.w || 4.8, d = o.d || 4.2, h = 2.5, [lo] = foot(OX + x, OZ + z, w / 2 + 0.3, d / 2 + 1.8, ry), fy = o.floor ?? Math.max(WL + 1.0, H(OX + x, OZ + z) + 0.9), bed = Math.min(lo, WL) - 0.5;
  K.push(x, 0, z, ry);
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 1, 2]){ const pz = sz === 2 ? d / 2 + 1.55 : sz * (d / 2 - 0.25), px = sx * (w / 2 - 0.25); K.geo('woodD', cyl(0.12, 0.15, fy - bed, 5), px, (fy + bed) / 2, pz, rr(-0.05, 0.05), 0, rr(-0.05, 0.05)); }
  K.box('woodD', w + 0.4, 0.2, d + 0.3, 0, fy - 0.1, 0); K.box('wood', w + 0.2, 0.12, 1.7, 0, fy - 0.06, d / 2 + 0.95);
  for (const s of [-1, 1]) K.box('woodD', 0.1, 1.0, 0.1, s * (w / 2 + 0.05), fy + 0.5, d / 2 + 1.75); K.box('woodD', w + 0.2, 0.07, 0.07, 0, fy + 1.0, d / 2 + 1.75);
  K.box('wood', w, h, d, 0, fy + h / 2, 0); for (let i = 0; i < Math.floor(w / 0.55); i++) K.box('woodD', 0.05, h, 0.04, -w / 2 + 0.3 + i * 0.55, fy + h / 2, d / 2 + 0.02);
  K.push(0, fy, d / 2); door(-w * 0.18, 0.95, 1.95, 'pTeal', 0); win(w * 0.26, 1.45, 0.65, 0.6, 'pTeal', false); wallLamp(w * 0.05 + 0.4, 2.0, 'lampS', 1, 0x9aff70); K.pop();
  K.push(w / 2, fy, 0, Math.PI / 2); win(0, 1.45, 0.6, 0.55, 'pTeal', false); K.pop();
  const rise = roofG(w, d, fy + h, 0.98, 0.6, 'thatch', 0.42); gables(w, d, fy + h, rise, 'wood', false);
  K.geo('iron', cyl(0.09, 0.09, 1.3, 5), -w * 0.28, fy + h + rise * 0.55 + 0.4, -d * 0.2); CUR.smoke.push(kpt(-w * 0.28, fy + h + rise * 0.55 + 1.05, -d * 0.2));
  if (o.nets){ K.geo('net', plane(1.6, 1.2), -w / 2 - 0.05, fy + 1.3, 0, 0, Math.PI / 2, 0); }
  K.pop(); cb(x, z, w / 2 + 0.3, d / 2 + 0.25, ry); mapbox(x, z, w / 2, d / 2, ry);
  const fx = x + Math.sin(ry) * (d / 2 + 1.0), fz = z + Math.cos(ry) * (d / 2 + 1.0); platSeg(OX + fx - Math.cos(ry) * w / 2, OZ + fz + Math.sin(ry) * w / 2, OX + fx + Math.cos(ry) * w / 2, OZ + fz - Math.sin(ry) * w / 2, 1.7, fy + 0.02, fy + 0.02);
  return { x, z, y: fy, front: [x + Math.sin(ry) * (d / 2 + 1.75), z + Math.cos(ry) * (d / 2 + 1.75)] };
}
function sunkenHouse(x, z, ry){
  const w = 5, d = 4.4, h = 2.5, fy = WL - 0.9; K.push(x, fy, z, ry, 0.12, -0.2);
  K.box('woodD', w, h, d, 0, h / 2, 0); for (let i = 0; i < 8; i++) K.box('wood', 0.05, h, 0.04, -w / 2 + 0.3 + i * 0.6, h / 2, d / 2 + 0.02);
  K.box('dark', 0.9, 1.6, 0.05, -0.8, 1.2, d / 2 + 0.03); K.box('dark', 0.6, 0.5, 0.05, 1.2, 1.6, d / 2 + 0.03);
  const rise = roofG(w, d, h, 0.98, 0.5, 'thatch', 0.4); gables(w, d, h, rise, 'woodD', false); K.box('dark', 1.2, 0.5, 1.4, 1.0, h + rise * 0.6, 0.4, 0.8, 0, 0);
  K.pop(); cb(x, z, w / 2 + 0.2, d / 2 + 0.2, ry); mapbox(x, z, w / 2, d / 2, ry);
}
function frogTotem(x, z, ry){ const y = gy(x, z) - 0.1; K.push(x, y, z, ry); K.geo('mossy', cylM(0.5, 0.6, 1.4, 8), 0, 0.7, 0); K.geo('mossy', sph(0.75, 10, 7), 0, 1.75, 0, 0, 0, 0, 1.2, 0.75, 1); for (const s of [-1, 1]){ K.geo('mossy', sph(0.24, 7, 5), s * 0.45, 2.2, 0.35); K.geo('glowG', sph(0.12, 6, 4), s * 0.45, 2.24, 0.52); } K.box('dark', 0.9, 0.05, 0.1, 0, 1.6, 0.72); K.pop(); cc(x, z, 0.7); glow(x, y + 2.2, z, 0x9aff70, 1.2, 0.5); }
function bStilt(t){
  const R0 = t.r, DY = WL + 0.95; let p;
  const pool = W.lakes.find(l => l.id === 'stiltpool'), pc = pool ? [pool.c[0] - t.x, pool.c[1] - t.z] : [14, 15], prx = pool ? pool.rx : 22, prz = pool ? pool.rz : 16;
  // 판자길 뼈대: 말뚝 판자길(길) 끝 → 물가 → 웅덩이 가운데 → 서쪽 · 남쪽 둑
  const rd = W.roads.find(r => r.id === 'stilt'), re = rd ? [rd.pts[rd.pts.length - 1][0] - t.x, rd.pts[rd.pts.length - 1][1] - t.z] : [-6, -11];
  const tw = (x, z) => [pc[0] + x * prx, pc[1] + z * prz];   // 웅덩이 기준 비율 좌표
  const NODES = { e: [re[0], re[1], gy(re[0], re[1])], a: [...tw(-0.62, -0.62), DY], b: [...tw(-0.3, -0.18), DY], c: [...tw(0.12, 0.22), DY], d: [...tw(0.35, 1.1), DY], f: [...tw(0.6, -0.05), DY], g: [...tw(-0.78, 0.25), DY], h: [...tw(-1.12, 0.3), 0] };
  for (const k in NODES){ const n = NODES[k]; if (!isW(OX + n[0], OZ + n[1]) && k !== 'e') n[2] = Math.max(n[2], gy(n[0], n[1]) + 0.25); }
  const EDGES = [['e', 'a'], ['a', 'b'], ['b', 'c'], ['c', 'd'], ['c', 'f'], ['b', 'g'], ['g', 'h']];
  const segs = [], big = spList(t, ['dock', 'drowned_house', 'nets', 'sunken_boat', 'shrine', 'offering'], 8);
  const blocked = (A, Bn) => big.some(([x, z, kr]) => { const ex = Bn[0] - A[0], ez = Bn[1] - A[1], l2 = ex * ex + ez * ez || 1, tt = clamp(((x - A[0]) * ex + (z - A[1]) * ez) / l2, 0, 1); return Math.hypot(x - A[0] - ex * tt, z - A[1] - ez * tt) < kr - 1.2; });
  const used = new Set(['e']);
  for (const [i, j] of EDGES){ const A = NODES[i], Bn = NODES[j]; if (!used.has(i) || blocked(A, Bn)) continue; used.add(j); walkFollow(A, Bn, 1.9, (segs.length % 2) ? 1 : -1); segs.push([A, Bn]); for (let k = 0.2; k < 1; k += 0.2) occupy(lerp(A[0], Bn[0], k), lerp(A[1], Bn[1], k), 1.4); }
  for (const k of ['a', 'b', 'c', 'f', 'g']){ if (!used.has(k)) continue; const n = NODES[k]; walkPad(n[0], n[1], n[2], 1.4); occupy(n[0], n[1], 2.0); }
  // 말뚝집: 물 위 넷 + 둑 위 둘 — 툇마루에서 가까운 갈림목까지 판자길
  const nearNode = (x, z) => { let b = null, bd = 1e9; for (const k of ['a', 'b', 'c', 'd', 'f', 'g']){ if (!used.has(k)) continue; const n = NODES[k], d = Math.hypot(n[0] - x, n[1] - z); if (d < bd){ bd = d; b = n; } } return b; };
  const want = [[...tw(-0.05, -0.55), 1], [...tw(0.25, 0.62), 1], [...tw(0.95, -0.2), 1], [...tw(-0.62, 0.72), 1], [...tw(-1.15, -0.3), 0], [...tw(0.55, -1.25), 0], [...tw(-0.5, -1.35), 0], [...tw(-1.3, 0.6), 0], [...tw(1.1, 0.9), 0]];
  let nets = 0;
  for (const [x, z, wet] of want){ const nn = nearNode(x, z), s = site(x, z, 5.2, 6.4, { water: true, max: 7, face: [nn[0], nn[1]], maxR: R0 + 6, k: 0.78 }); if (!s) continue;
    const hs = stiltHouse(s.x, s.z, s.ry, { floor: wet ? DY + 0.15 : undefined, nets: nets++ % 2 === 0 }), n2 = nearNode(...hs.front), d = Math.hypot(n2[0] - hs.front[0], n2[1] - hs.front[1]);
    if (d > 1.2 && d < 16) walkFollow([hs.front[0], hs.front[1], hs.y], n2, 1.5, 0);
    P.lamp(hs.front[0] + Math.cos(s.ry) * 1.5, hs.front[1] - Math.sin(s.ry) * 1.5, 'swamp', s.ry, { y: hs.y, col: false }); }
  // 반쯤 잠긴 집
  if (!spNear(t, ['drowned_house'])){ const s = site(...tw(0.75, 0.55), 5, 4.4, { water: true, wet: true, max: 8, plaza: true, maxR: R0 + 8 }); if (s) sunkenHouse(s.x, s.z, s.ry + 0.7); }
  // 판자길 등불 (늪 등불 — 이야기가 진행되면 켜져요)
  for (let i = 0; i < segs.length; i++){ const [A, Bn] = segs[i], L = Math.hypot(Bn[0] - A[0], Bn[1] - A[1]); if (L < 4) continue; const ux = (Bn[0] - A[0]) / L, uz = (Bn[1] - A[1]) / L, x = (A[0] + Bn[0]) / 2 - uz * 1.05, z = (A[1] + Bn[1]) / 2 + ux * 1.05; P.lamp(x, z, 'swamp', Math.atan2(-uz, ux), { y: (A[2] + Bn[2]) / 2, col: false }); }
  for (const [x, z] of [[re[0] - 2.5, re[1] + 1], [-14, -6], [10, -12]]){ p = prop(x, z, 0.5, { roadPad: 0.2 }); if (p) P.lamp(p[0], p[1], 'swamp', faceTo(p[0], p[1])); }
  // 갈대 · 연잎 · 배 · 개구리 토템 · 짐
  for (let i = 0; i < (LOW ? 22 : 40); i++){ const a = R() * TAU, k = rr(0.85, 1.12), x = pc[0] + Math.cos(a) * prx * k, z = pc[1] + Math.sin(a) * prz * k; if (segs.some(([A, Bn]) => { const ex = Bn[0] - A[0], ez = Bn[1] - A[1], l2 = ex * ex + ez * ez, tt = clamp(((x - A[0]) * ex + (z - A[1]) * ez) / l2, 0, 1); return Math.hypot(x - A[0] - ex * tt, z - A[1] - ez * tt) < 2.6; })) continue; if (!free(x, z, 0.8, { water: true, plaza: true, maxR: R0 + 12, keepK: 0.6 })) continue; reeds(x, z, LOW ? 5 : 8, 1.1, Math.max(gy(x, z), WL - 0.3)); }
  for (let i = 0; i < 26; i++){ const a = R() * TAU, k = Math.sqrt(R()) * 0.8, x = pc[0] + Math.cos(a) * prx * k, z = pc[1] + Math.sin(a) * prz * k; if (!isW(OX + x, OZ + z) || !free(x, z, 0.6, { water: true, plaza: true, maxR: R0 + 12, keepK: 0.4 })) continue; K.geo('leafA', new THREE.CircleGeometry(rr(0.35, 0.6), 9, 0.3, TAU - 0.6).rotateX(-Math.PI / 2), x, WL + 0.03, z, 0, R() * TAU, 0); if (R() < 0.3) K.geo('fabricW', cone(0.14, 0.2, 5), x + 0.12, WL + 0.12, z); }
  if (used.has('c')){ const b = NODES.c, bx = b[0] + 2.4, bz = b[1] + 0.8; if (isW(OX + bx, OZ + bz)) bobbers(boatGeo(), [[bx, WL - 0.18, bz, 0.4]], 0.04, 0.05); }
  p = prop(-18, -2, 0.9); if (p) frogTotem(p[0], p[1], faceTo(p[0], p[1]));
  for (const [x, z] of [[-10, -18], [16, -6]]){ p = prop(x, z, 1.0); if (p) P.clutter(p[0], p[1], 2); }
  p = prop(-20, 14, 2.0, { water: true }); if (p) netRack(p[0], p[1], faceTo(p[0], p[1]) + Math.PI / 2);
  motesFx(t.near, [pc[0], WL + 0.5, pc[1]], Math.max(prx, prz), LOW ? 20 : 40, '0.75, 1.0, 0.45', 3, 0.13);
  entrySigns(t, 1);
}

// ───────────────────────── 붉은 먼지 광산촌 (mining) ─────────────────────────
function waterTower(x, z){
  const y = gy(x, z) - 0.2, h1 = 6.5; K.push(x, y, z);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.geo('woodD', tubeG([[a * 1.8, 0, b * 1.8], [a * 1.3, h1, b * 1.3]], 0.16, 0.13, 5, 2));
  for (const hh of [1.6, 4.2]) for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]){ const k = 1.8 - hh / h1 * 0.5, k2 = 1.8 - (hh + 2.2) / h1 * 0.5; link('woodD', [ax * k, hh, az * k], [bx * k2, hh + 2.2, bz * k2], 0.1); }
  K.box('woodD', 3.4, 0.2, 3.4, 0, h1, 0); K.geo('wood', cylM(1.6, 1.6, 2.6, 12), 0, h1 + 1.4, 0); for (const hh of [0.5, 1.4, 2.3]) K.geo('iron', tor(1.62, 0.04, 3, 18), 0, h1 + hh, 0, Math.PI / 2);
  K.geo('tin', cone(1.85, 1.0, 12), 0, h1 + 3.2, 0); K.geo('iron', tubeG([[1.5, h1 + 0.6, 0], [2.3, h1 + 0.3, 0], [2.5, h1 - 1.2, 0]], 0.1, 0.1, 5, 3)); K.box('iron', 0.5, 0.06, 0.06, 2.5, h1 - 1.3, 0);
  for (const s of [-1, 1]) K.box('woodD', 0.06, h1, 0.06, s * 0.3, h1 / 2, 1.75); for (let i = 0; i < 12; i++) K.box('wood', 0.6, 0.05, 0.06, 0, 0.5 + i * 0.5, 1.75);
  K.pop(); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cc(x + a * 1.75, z + b * 1.75, 0.3); mapbox(x, z, 1.8, 1.8, 0);
}
function saloon(x, z, ry, t){
  const w = 7, d = 6, h1 = 3, h2 = 2.6, [lo, hi] = foot(OX + x, OZ + z, w / 2 + 0.5, d / 2 + 1.5, ry), y = hi + 0.2; K.push(x, y, z, ry);
  K.box('stoneD', w + 0.3, y - lo + 0.4, d + 0.3, 0, -(y - lo + 0.4) / 2 + 0.1, 0); K.box('wood', w, h1 + h2, d, 0, (h1 + h2) / 2, 0);
  for (let i = 0; i < 9; i++) K.box('woodD', w + 0.02, 0.05, 0.04, 0, 0.4 + i * 0.6, d / 2 + 0.02);
  K.push(0, 0, d / 2); door(0, 1.3, 2.2, 'pRed', 0); for (const s of [-1, 1]) K.box('pRed', 0.6, 0.9, 0.05, s * 0.33, 1.3, 0.25, 0, s * 0.4, 0); win(-2.3, 1.6, 1.0, 1.0, 'pRed', false); win(2.3, 1.6, 1.0, 1.0, 'pRed', false);
  for (const xx of [-2.2, 0, 2.2]) win(xx, h1 + 1.3, 0.8, 0.9, 'pRed', false); K.pop();
  // 가짜 정면 (높은 간판벽) · 간판
  K.box('wood', w + 0.4, 2.4, 0.16, 0, h1 + h2 + 1.0, d / 2 + 0.06); K.box('woodD', w + 0.6, 0.18, 0.3, 0, h1 + h2 + 2.25, d / 2 + 0.06); K.box('wood', 2.6, 0.7, 0.16, 0, h1 + h2 + 2.6, d / 2 + 0.06);
  const uv = signCell('먼지 술집', 'Saloon'); K.box('woodD', 4.6, 1.2, 0.08, 0, h1 + h2 + 0.95, d / 2 + 0.18); K.geo('signT', quadUV(4.4, 1.08, uv), 0, h1 + h2 + 0.95, d / 2 + 0.23);
  // 2층 발코니 · 1층 차양
  K.box('wood', w + 0.4, 0.14, 1.6, 0, h1, d / 2 + 0.8); for (const s of [-1, 0.33, -0.33, 1]) K.box('woodD', 0.14, h1, 0.14, s * (w / 2), h1 / 2, d / 2 + 1.5);
  K.box('woodD', w + 0.4, 0.07, 0.07, 0, h1 + 0.95, d / 2 + 1.55); for (let i = 0; i < 15; i++) K.box('woodD', 0.05, 0.9, 0.05, -w / 2 + i * w / 14, h1 + 0.5, d / 2 + 1.55);
  K.box('tin', w + 0.6, 0.1, d + 0.4, 0, h1 + h2 + 0.15, 0, 0.12); wallLampAt(-1.1, 2.4, d / 2); wallLampAt(1.1, 2.4, d / 2);
  K.geo('iron', cyl(0.1, 0.1, 1.6, 5), -2.4, h1 + h2 + 0.9, -1.8); CUR.smoke.push(kpt(-2.4, h1 + h2 + 1.8, -1.8));
  K.box('woodD', 3.0, 0.1, 0.1, 0, 0.95, d / 2 + 3.2); for (const s of [-1, 1]) K.box('woodD', 0.12, 1.0, 0.12, s * 1.4, 0.5, d / 2 + 3.2);
  K.pop(); cb(x, z, w / 2 + 0.25, d / 2 + 0.25, ry); mapbox(x, z, w / 2, d / 2, ry);
}
// 광차 레일 (그룹 로컬 점 목록 · 땅을 따라)
function rails(pts){
  for (let i = 0; i < pts.length - 1; i++){ const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az), n = Math.max(1, Math.round(L / 0.8));
    for (let k = 0; k < n; k++){ const tt = (k + 0.5) / n, x = lerp(ax, bx, tt), z = lerp(az, bz, tt); K.push(x, gy(x, z) + 0.04, z, yaw); K.box('woodD', 1.8, 0.12, 0.26, 0, 0, 0, 0, rr(-0.05, 0.05), 0); K.pop(); }
    const ya = gy(ax, az) + 0.16, yb = gy(bx, bz) + 0.16, px = Math.cos(yaw), pz = -Math.sin(yaw); for (const s of [-1, 1]) link('iron', [ax + px * s * 0.56, ya, az + pz * s * 0.56], [bx + px * s * 0.56, yb, bz + pz * s * 0.56], 0.08, 0.1); }
}
const cartGeo = () => VCG.cart || (VCG.cart = vcGeo(() => { K.geo('rust', lathe([[0, 0], [0.75, 0], [0.95, 0.85], [0, 0.85]], 4, 0.5), 0, 0.32, 0, 0, Math.PI / 4, 0, 1, 1, 1.3); for (let i = 0; i < 7; i++) K.geo(i < 2 ? 'ore' : 'redrock', ico(rr(0.22, 0.34), 0), rr(-0.35, 0.35), 1.25, rr(-0.55, 0.55), R(), R(), R()); for (const s of [-1, 1]) for (const zz of [-0.6, 0.6]) K.geo('iron', cyl(0.22, 0.22, 0.1, 10), s * 0.62, 0.22, zz, 0, 0, Math.PI / 2); }));
function oreCartAt(x, z, ry){ const m = meshOf(cartGeo(), vcMat(grainTex)); m.matrixAutoUpdate = true; m.position.set(x, gy(x, z) + 0.16, z); m.rotation.y = ry; CUR.near.add(m); cc(x, z, 1.0); return m; }
function tipple(x, z, ry){ const y = gy(x, z) - 0.2; K.push(x, y, z, ry); for (const [a, b] of [[-1.3, -1.1], [1.3, -1.1], [-1.3, 1.1], [1.3, 1.1]]) K.geo('woodD', cyl(0.14, 0.16, 4.6, 5), a, 2.3, b);
  K.box('wood', 3.0, 1.6, 2.6, 0, 4.0, 0); for (let i = 0; i < 6; i++) K.geo(i < 2 ? 'ore' : 'redrock', ico(rr(0.3, 0.5), 0), rr(-1, 1), 4.9, rr(-0.9, 0.9), R(), R(), R());
  link('wood', [0, 3.3, 1.2], [0, 1.6, 3.4], 1.0, 0.08); for (const s of [-1, 1]) link('woodD', [s * 0.5, 3.5, 1.2], [s * 0.5, 1.8, 3.4], 0.06, 0.3); for (const s of [-1, 1]) link('woodD', [s * 1.3, 0.3, -1.1], [-s * 1.3, 3.2, -1.1], 0.1);
  K.pop(); K.push(x, 0, z, ry); for (const [a, b] of [[-1.3, -1.1], [1.3, -1.1], [-1.3, 1.1], [1.3, 1.1]]) cc(a, b, 0.25); K.pop(); mapbox(x, z, 1.5, 1.3, ry); }
function dynamite(x, z, ry){ const y = gy(x, z); P.crate(x, y, z, 0.7, ry); K.push(x, y + 0.7, z, ry); for (let i = 0; i < 6; i++) K.geo('fabricR', cyl(0.05, 0.05, 0.42, 6), -0.2 + (i % 3) * 0.2, 0.06 + ((i / 3) | 0) * 0.1, 0, Math.PI / 2, 0, 0); K.geo('rope', cyl(0.01, 0.01, 0.3, 3), 0.2, 0.3, 0.2, 0.5, 0, 0); K.pop(); cc(x, z, 0.5); }
function wheelbarrow(x, z, ry, load = 'soil'){ const y = gy(x, z); K.push(x, y, z, ry); K.box('wood', 0.8, 0.35, 1.0, 0, 0.55, 0, 0.1); K.geo(load, sph(0.38, 7, 4), 0, 0.72, 0, 0, 0, 0, 1, 0.45, 1.2); K.geo('woodD', cyl(0.25, 0.25, 0.08, 10), 0, 0.25, 0.65, 0, 0, Math.PI / 2); for (const s of [-1, 1]){ link('woodD', [s * 0.3, 0.5, 0.6], [s * 0.35, 0.6, -1.0], 0.05); K.box('woodD', 0.05, 0.4, 0.05, s * 0.3, 0.2, -0.3); } K.pop(); cc(x, z, 0.6); }
function bDust(t){
  const R0 = t.r; let p, s;
  const mine = W.landmarks.find(l => l.id === 'mine'), mx = mine ? mine.c[0] - t.x : 46, mz = mine ? mine.c[1] - t.z : 32;
  // 광차 레일: 정착지 동쪽에서 길 옆을 따라 광산 쪽으로 (오른쪽 5.5m)
  const rd = W.roads.find(r => r.id === 'dust'), rp = rd ? rd.pts.map(q => [q[0] - t.x, q[1] - t.z]) : [[-28, -16], [0, 0], [28, 26], [42, 36]];
  const rpts = [], ang = Math.atan2(mz, mx);
  { let acc = 0; for (let i = 0; i < rp.length - 1; i++){ const [ax, az] = rp[i], [bx, bz] = rp[i + 1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
      for (let d = 0; d < L; d += 3){ const x = ax + ux * d, z = az + uz * d; if (Math.hypot(x, z) < 5 || Math.cos(Math.atan2(z, x) - ang) < 0.2 || Math.hypot(x, z) > R0 + 16) continue; rpts.push([x + uz * 5.6, z - ux * 5.6]); } acc += L; } }
  const rkeep = rpts.filter(([x, z]) => !t.keep.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr - 0.6));
  if (rkeep.length >= 3){ rails(rkeep); for (const [x, z] of rkeep) occupy(x, z, 1.2);
    const st = rkeep[0], st2 = rkeep[1], ry = Math.atan2(st2[0] - st[0], st2[1] - st[1]); p = [st[0] - Math.sin(ry) * 2.6, st[1] - Math.cos(ry) * 2.6]; if (free(p[0], p[1], 1.6, { plaza: true, roadPad: 0.3 })) tipple(p[0], p[1], ry + Math.PI);
    oreCartAt(rkeep[2][0], rkeep[2][1], ry);
    // 레일 위를 오가는 광차 하나
    if (rkeep.length >= 5){ const cm = meshOf(cartGeo(), vcMat(grainTex)); cm.matrixAutoUpdate = true; CUR.near.add(cm); const path = rkeep.slice(2), segL = []; let tot = 0; for (let i = 0; i < path.length - 1; i++){ const l = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]); segL.push(l); tot += l; }
      anim((dt, tt) => { let dd = (Math.sin(tt * 0.12) * 0.5 + 0.5) * tot, i = 0; while (i < segL.length - 1 && dd > segL[i]){ dd -= segL[i]; i++; } const a = path[i], b = path[i + 1], k = clamp(dd / segL[i], 0, 1), x = lerp(a[0], b[0], k), z = lerp(a[1], b[1], k); cm.position.set(x, gy(x, z) + 0.16, z); cm.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); }); } }
  // 술집 · 판잣집 · 물탱크
  s = site(-12, 12, 8, 8.5, { maxDh: 3, face: 'road', max: 10 }); if (s) saloon(s.x, s.z, s.ry, t);
  for (const [x, z, w] of [[8, -14, 5], [-16, -8, 4.6], [-2, 17, 5], [18, -4, 4.4], [12, 16, 4.6]]){ s = site(x, z, w + 0.6, 6, { maxDh: 2.6, face: 'road', max: 9 }); if (s) shack(s.x, s.z, s.ry, { w, d: 4, roof: R() < 0.6 ? 'tin' : 'rust', paint: pick(['woodD', 'pRed', 'pTeal']) }); }
  if (!spNear(t, ['water_tower'])){ s = site(-14, -16, 4.2, 4.2, { maxDh: 2.5, max: 9 }); if (s) waterTower(s.x, s.z); }
  // 광석 · 곡괭이 · 짐 · 다이너마이트 · 손수레 · 쇠 화로
  for (const [x, z] of [[12, -2], [-6, -14], [20, 10]]){ p = prop(x, z, 1.4); if (p){ P.ores(p[0], p[1], 1.2, 10); P.pickaxe(p[0] + 1.3, gy(p[0] + 1.3, p[1]), p[1], R() * 3); } }
  for (const [x, z] of [[-20, 4], [4, 12], [-8, -20]]){ p = prop(x, z, 1.1); if (p) P.clutter(p[0], p[1], 3); }
  p = prop(16, -12, 0.7); if (p) dynamite(p[0], p[1], R() * 3);
  p = prop(-4, 10, 0.7); if (p) wheelbarrow(p[0], p[1], R() * 3, 'redrock');
  p = prop(-22, -2, 1.8); if (p) P.cart(p[0], p[1], faceRoad(p[0], p[1]) + Math.PI / 2, 'ore');
  for (const [x, z] of [[9, 4], [-9, -4], [4, -9], [-5, 8]]){ p = prop(x, z, 0.6, { roadPad: 0.4 }); if (p) P.lamp(p[0], p[1], 'iron', 0); }
  // 활기 (dust_lively): 길 위 깃발 줄 · 등불 줄 · 지붕 깃발 · 화로 둘 더
  t.chg.dust = subMesh(() => {
    const pairs = [], used = []; const po = { plaza: true, roadPad: 0.1, keepK: 0.4 };
    for (const k of [-0.45, 0.4, -0.25, 0.2, 0.62, -0.68, 0]){ if (pairs.length >= 2) break; const rn = roadNear(OX + Math.cos(ang) * R0 * k, OZ + Math.sin(ang) * R0 * k); if (!rn) continue; const sg = rn[3], ux = sg.ex / Math.sqrt(sg.l2), uz = sg.ez / Math.sqrt(sg.l2), lx = rn[0] - OX, lz = rn[1] - OZ;
      if (used.some(([x, z]) => Math.hypot(x - lx, z - lz) < 8)) continue;
      for (const extra of [0.8, 1.4, 2.2]){ const off = sg.w / 2 + extra, a = [lx - uz * off, lz + ux * off], b = [lx + uz * off, lz - ux * off]; if (free(a[0], a[1], 0.3, po) && free(b[0], b[1], 0.3, po)){ const pa = P.pole(a[0], a[1], 5.2), pb = P.pole(b[0], b[1], 5.2); occupy(a[0], a[1], 0.5); occupy(b[0], b[1], 0.5); pairs.push([pa, pb]); used.push([lx, lz]); break; } } }
    for (const [pa, pb] of pairs){ P.pennants(pa, pb, 0.9, ['fabricR', 'fabricY', 'fabricB', 'fabricW']); P.lights([pa[0], pa[1] - 0.6, pa[2]], [pb[0], pb[1] - 0.6, pb[2]], 0.7, 'lampD', 2, 0xffb050); }
    if (pairs.length === 2) for (const i of [0, 1]) P.lights(pairs[0][i], pairs[1][i], 1.2, 'lampD', 2, 0xffb050, 1.8);
    for (const [x, z] of [[0, -11], [-11, 3], [11, 8]]){ const q = spot(x, z, 0.6, { plaza: true, max: 5 }); if (q){ P.lamp(q[0], q[1], 'iron', 0, { grp: 2, sparks: false }); occupy(q[0], q[1], 0.6); } }
    for (const [x, z, c] of [[-14, 6, 'fabricR'], [14, -10, 'fabricY'], [6, 16, 'fabricB'], [-16, -12, 'fabricG']]){ const q = spot(x, z, 0.4, { plaza: true, max: 6 }); if (!q) continue; const top = P.pole(q[0], q[1], 6.0); K.geo(c, triG([top[0], top[1], top[2]], [top[0], top[1] - 0.8, top[2]], [top[0] + 1.3, top[1] - 0.4, top[2]])); K.geo('gold', sph(0.1, 5, 4), top[0], top[1] + 0.25, top[2]); occupy(q[0], q[1], 0.5); }
  }, [0, t.y, 0]);
  t.chg.dust.visible = false;
  entrySigns(t);
}

// ───────────────────────── 별지기 야영지 (dig) ─────────────────────────
function pit(x, z, w, d, ry){
  const y = gy(x, z); K.push(x, y, z, ry);
  K.box('dark', w - 0.5, 0.02, d - 0.5, 0, 0.04, 0); K.geo('soil', plane(w + 1.2, d + 1.2).rotateX(-Math.PI / 2), 0, 0.03, 0);
  for (const [fx, fz, fr, fw] of faces(w, d)){ K.push(fx, 0, fz, fr); K.box('wood', fw, 0.32, 0.12, 0, 0.12, -0.06); for (let i = 0; i < Math.floor(fw / 1.2); i++) K.box('woodD', 0.1, 0.5, 0.1, -fw / 2 + 0.3 + i * 1.2, 0.2, 0.02); K.pop(); }
  for (let i = 0; i < 6; i++){ const a = R() * TAU, r = Math.max(w, d) * 0.5 + rr(0.8, 1.8); K.geo('soil', sph(rr(0.5, 0.9), 7, 4, 0, TAU, 0, Math.PI / 2), Math.cos(a) * r, 0.02, Math.sin(a) * r, 0, 0, 0, 1.4, 0.55, 1); }
  for (let i = 1; i < 3; i++) K.box('rope', 0.02, 0.02, d, -w / 2 + i * w / 3, 0.45, 0); for (let i = 1; i < 3; i++) K.box('rope', w, 0.02, 0.02, 0, 0.45, -d / 2 + i * d / 3);
  K.geo('ruin', cylM(0.45, 0.5, 0.5, 8), w * 0.2, 0.25, -d * 0.15); K.box('ruin', 1.2, 0.3, 0.6, -w * 0.22, 0.17, d * 0.2, 0, 0.4, 0); K.geo('terra', lathe([[0, 0], [0.16, 0.02], [0.22, 0.2], [0.1, 0.36], [0.12, 0.42], [0, 0.42]], 8, 0.3), -w * 0.1, 0.05, -d * 0.25);
  link('wood', [w / 2 - 0.4, 0.05, 0.2], [w / 2 + 0.2, 1.6, 0.2], 0.08); link('wood', [w / 2 - 0.4, 0.05, -0.3], [w / 2 + 0.2, 1.6, -0.3], 0.08); for (let i = 1; i < 5; i++){ const tt = i / 5; K.box('wood', 0.06, 0.05, 0.5, lerp(w / 2 - 0.4, w / 2 + 0.2, tt), lerp(0.05, 1.6, tt), -0.05); }
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){ K.geo('iron', cyl(0.01, 0.01, 0.8, 3), a * (w / 2 + 0.3), 0.4, b * (d / 2 + 0.3)); K.geo('fabricY', triG([0, 0.8, 0], [0, 0.6, 0], [0.25, 0.7, 0]), a * (w / 2 + 0.3), 0, b * (d / 2 + 0.3)); }
  K.pop(); K.push(x, 0, z, ry); cb(0, 0, w / 2, d / 2); K.pop(); mapbox(x, z, w / 2, d / 2, ry);
}
function scaffold(x, z, ry, h = 5){ const y = gy(x, z) - 0.1; K.push(x, y, z, ry); for (const [a, b] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) K.geo('woodD', cyl(0.08, 0.09, h, 5), a, h / 2, b);
  for (const hh of [h * 0.5, h]){ for (let i = 0; i < 6; i++) K.box('wood', 3.0, 0.06, 0.45, 0, hh, -1.2 + i * 0.48); for (const s of [-1, 1]) K.box('woodD', 3.0, 0.06, 0.06, 0, hh + 0.9, s * 1.4); }
  for (const s of [-1, 1]) link('woodD', [-1.4, 0.2, s * 1.4], [1.4, h * 0.5, s * 1.4], 0.07); K.geo('woodD', cyl(0.18, 0.18, 0.12, 8), 0, h + 0.6, 0, 0, 0, Math.PI / 2); K.geo('rope', cyl(0.015, 0.015, h * 0.8, 3), 0.2, h * 0.6 + 0.2, 0);
  K.pop(); K.push(x, 0, z, ry); for (const [a, b] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) cc(a, b, 0.2); K.pop(); }
function crane(x, z, ry){
  const y = gy(x, z) - 0.1; K.push(x, y, z, ry);
  for (const s of [-1, 1]) link('woodD', [s * 1.4, 0, -0.6], [0, 6.2, 0], 0.18); link('woodD', [0, 0, -2.6], [0, 6.2, 0], 0.18);
  link('woodD', [0, 5.6, -0.3], [0, 6.8, 4.6], 0.16); K.geo('woodD', cyl(0.16, 0.16, 0.1, 8), 0, 6.75, 4.6, 0, 0, Math.PI / 2); link('rope', [0, 6.2, 0], [0, 6.8, 4.6], 0.025);
  K.geo('wood', cylM(0.32, 0.32, 1.4, 10), 0, 0.7, -1.6, 0, 0, Math.PI / 2); for (const s of [-1, 1]) K.box('woodD', 0.1, 1.1, 0.5, s * 0.75, 0.55, -1.6); K.box('iron', 0.05, 0.6, 0.05, 0.85, 0.9, -1.6, 0.6); link('rope', [0, 0.95, -1.6], [0, 6.2, 0], 0.02);
  const top = kpt(0, 6.6, 4.6); K.pop();
  swayer([top.x, top.y, top.z], ry, () => { K.geo('rope', cyl(0.015, 0.015, 4.0, 3), 0, -2.0, 0); K.geo('wood', lathe([[0, 0], [0.32, 0], [0.38, 0.45], [0, 0.45]], 8, 0.4), 0, -4.5, 0); K.geo('iron', tor(0.38, 0.02, 3, 10), 0, -4.05, 0, Math.PI / 2); K.geo('soil', sph(0.3, 6, 4), 0, -4.05, 0, 0, 0, 0, 1, 0.4, 1); }, 0.06, 0.9);
  K.push(x, 0, z, ry); cc(0, -0.6, 0.6); cc(0, -2.6, 0.3); K.pop();
}
function telescope(x, z, ry){ const y = gy(x, z); K.push(x, y, z, ry); for (let i = 0; i < 3; i++){ const a = i / 3 * TAU; link('woodD', [Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6], [0, 1.4, 0], 0.05); } K.push(0, 1.45, 0, 0, -0.7); K.geo('brass', cyl(0.09, 0.13, 1.6, 8), 0, 0.3, 0); K.geo('brass', tor(0.13, 0.02, 3, 10), 0, -0.45, 0, Math.PI / 2); K.pop(); K.pop(); cc(x, z, 0.6); }
function starBoard(x, z, ry){ const y = gy(x, z); K.push(x, y, z, ry); for (const s of [-1, 1]) K.geo('woodD', cyl(0.04, 0.05, 2.0, 4), s * 0.75, 1.0, -0.15, 0.15, 0, 0); K.geo('woodD', cyl(0.04, 0.04, 2.0, 4), 0, 0.95, -0.55, -0.35, 0, 0);
  K.box('woodD', 1.7, 1.2, 0.06, 0, 1.35, 0.05, -0.18); K.geo('fabricB', plane(1.55, 1.05), 0, 1.35, 0.09, -0.18, 0, 0); for (let i = 0; i < 18; i++) K.geo('glowY', sph(0.026, 4, 3), rr(-0.7, 0.7), 1.35 + rr(-0.45, 0.45), 0.11 + 0.02, -0.18);
  for (let i = 0; i < 5; i++){ const a = [rr(-0.65, 0.65), 1.35 + rr(-0.4, 0.4), 0.115], b = [rr(-0.65, 0.65), 1.35 + rr(-0.4, 0.4), 0.115]; link('gold', a, b, 0.01, 0.006); }
  K.geo('gold', tor(0.25, 0.01, 3, 16), 0.35, 1.5, 0.12, -0.18, 0, 0); K.pop(); K.push(x, 0, z, ry); cb(0, 0, 0.9, 0.4); K.pop(); }
// 무너진 왕도 거리: 포석 띠 + 양옆 기둥 (일부 부러짐) + 쓰러진 기둥 + 아치 조각
function ruinedStreet(x, z, ry, len = 14){
  K.push(x, 0, z, ry);
  for (let a = -len / 2; a < len / 2; a += 1.15) for (let b = -2; b <= 2; b += 1.15){ if (R() < 0.12) continue; const v = K.world(b, a), yy = H(OX + v.x, OZ + v.z); K.box(R() < 0.5 ? 'ruin' : 'stoneD', 1.08, 0.2, 1.08, b + rr(-0.05, 0.05), yy + 0.04 + rr(-0.03, 0.05), a, rr(-0.04, 0.04), rr(-0.08, 0.08), rr(-0.04, 0.04)); }
  for (let a = -len / 2 + 1.5, i = 0; a < len / 2; a += 4.2, i++) for (const s of [-1, 1]){ const v = K.world(s * 3.2, a); K.pop(); P.pillar(v.x, v.z, rr(3.5, 4.6), (i + (s > 0 ? 1 : 0)) % 2 === 0 && R() < 0.8, 'ruin'); K.push(x, 0, z, ry); }
  const v = K.world(4.6, 0.5); K.pop(); P.fallen(v.x, v.z, ry + 0.3, 'ruin');
  K.push(x, 0, z, ry); const e = K.world(0, len / 2 + 0.8), ye = H(OX + e.x, OZ + e.z) - 0.2;
  K.box('ruin', 1.2, 4.2, 1.2, -2.6, ye + 2.1, len / 2 + 0.8); K.box('ruin', 1.2, 2.2, 1.2, 2.6, ye + 1.1, len / 2 + 0.8); K.geo('ruin', new THREE.TorusGeometry(2.6, 0.55, 6, 12, Math.PI * 0.55), 0, ye + 4.2, len / 2 + 0.8, 0, 0, Math.PI * 0.45, 1, 1, 1.6);
  for (let i = 0; i < 6; i++) K.geo('ruin', rockG(rr(0.25, 0.5), 0.6, 0), rr(-3, 3), ye + 0.25, len / 2 + rr(-1, 2.5));
  K.pop(); K.push(x, 0, z, ry); cc(-2.6, len / 2 + 0.8, 0.8); cc(2.6, len / 2 + 0.8, 0.8); K.pop();
  K.push(x, 0, z, ry); const w0 = K.world(0, 0); K.pop(); mapbox(w0.x, w0.z, 3.6, len / 2, ry);
}
function bStar(t){
  const R0 = t.r; let p, s;
  // 기록 천막 (큰 천막) · 학자 천막 셋
  s = site(12, -14, 7, 6, { maxDh: 2, max: 10 }); if (s){ pavilion(s.x, s.z, s.ry, { w: 6.4, d: 5.2, key: 'canvas', stripe: 'fabricB', roof: 'fabricB', cap: 'gold' }); const fx = s.x + Math.sin(s.ry) * 4.2, fz = s.z + Math.cos(s.ry) * 4.2; for (const k of [-1.4, 1.4]){ const q = prop(fx + Math.cos(s.ry) * k, fz - Math.sin(s.ry) * k, 1.0, { max: 3 }); if (q) P.table(q[0], q[1], s.ry + Math.PI / 2, k < 0 ? 'scroll' : 'chart'); } }
  for (const [x, z] of [[-15, -11], [-17, 8], [3, -19]]){ s = site(x, z, 3.6, 5.2, { maxDh: 1.5, max: 9 }); if (s) ridgeTent(s.x, s.z, s.ry, { w: 3.0, L: 4.0, h: 2.3, key: pick(['canvas', 'canvasD']) }); }
  // 발굴 구덩이 둘 (비계 · 기중기)
  const p1 = site(7, 14, 6.5, 5.5, { maxDh: 1.2, max: 10 }); if (p1){ pit(p1.x, p1.z, 5.6, 4.6, p1.ry); const sx = p1.x - Math.sin(p1.ry) * 0.2, sz = p1.z - Math.cos(p1.ry) * 0.2; scaffold(sx + Math.cos(p1.ry) * 3.2, sz - Math.sin(p1.ry) * 3.2, p1.ry, 5); }
  const p2 = spNear(t, ['excavation']) ? null : site(-9, 16, 5.5, 4.8, { maxDh: 1.2, max: 10 }); if (p2){ pit(p2.x, p2.z, 4.6, 3.8, p2.ry); const cx = p2.x - Math.sin(p2.ry) * 6.4, cz = p2.z - Math.cos(p2.ry) * 6.4; if (free(cx, cz, 2.2, { plaza: true })){ crane(cx, cz, p2.ry); occupy(cx, cz, 3); } }
  // 무너진 왕도 거리 조각
  if (!spNear(t, ['ruined_street'])) sites([[17, 6], [16, 14], [-16, -15], [-18, 12], [12, 20]], 1, 7.5, 12, { maxDh: 2, max: 6, k: 0.68, roadPad: 1.2 }, s => ruinedStreet(s.x, s.z, s.ry + Math.PI / 2, 10.5));
  trees([[-22, -12], [24, -14], [-24, 16], [22, 20], [6, -26]], 3, 'pine', 0.9, 1.3);
  // 별 지도 · 망원경 · 화톳불 · 짐 · 손수레 · 깃발 · 쇠 화로
  p = prop(-6, -12, 1.0); if (p){ starBoard(p[0], p[1], faceTo(p[0], p[1])); const q = prop(p[0] + 1.8, p[1] + 0.6, 0.7, { max: 3 }); if (q) telescope(q[0], q[1], faceTo(q[0], q[1]) + Math.PI); }
  p = prop(-10, 4, 1.4); if (p){ P.campfire(p[0], p[1]); for (let i = 0; i < 2; i++){ const a = i * 2.6 + 0.6, q = [p[0] + Math.cos(a) * 2.1, p[1] + Math.sin(a) * 2.1]; if (free(q[0], q[1], 0.5, { plaza: true })) P.logSeat(q[0], q[1], a + Math.PI / 2, 1.6); } }
  for (const [x, z] of [[20, -6], [-20, -2], [-2, 22]]){ p = prop(x, z, 1.1); if (p) P.clutter(p[0], p[1], 3); }
  p = prop(14, 18, 0.7); if (p) wheelbarrow(p[0], p[1], R() * 3);
  for (const [x, z] of [[-4, 11], [10, -6]]){ p = prop(x, z, 0.5); if (p) P.banner(p[0], p[1], 'fabricB', 4.2, faceTo(p[0], p[1]) - Math.PI / 2); }
  for (const [x, z] of [[8, 4], [-8, -5], [3, 9]]){ p = prop(x, z, 0.6, { roadPad: 0.4 }); if (p) P.lamp(p[0], p[1], 'iron', 0); }
  entrySigns(t);
}

// ───────────────────────── 가시 파수대 (fort) ─────────────────────────
// 목책 (그룹 로컬 타원 cx, cz, rx, rz) — 길이 지나는 곳은 문 (문기둥 · 상인방 · 깃발 · 화로)
function palisade(cx, cz, rx, rz){
  const per = TAU * Math.sqrt((rx * rx + rz * rz) / 2), n = Math.round(per / 0.56), pts = [];
  for (let i = 0; i < n; i++){ const a = i / n * TAU, x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz, gate = roadD(OX + x, OZ + z) < 3.2, kept = CUR.keep.some(([kx, kz]) => Math.hypot(x - kx, z - kz) < 1.6); pts.push({ x, z, a, gate, skip: gate || kept }); }
  let run = [];
  const flush = () => { if (run.length >= 2){ const A = run[0], Bp = run[run.length - 1], mx = (A.x + Bp.x) / 2, mz = (A.z + Bp.z) / 2, L = Math.hypot(Bp.x - A.x, Bp.z - A.z); K.push(mx, 0, mz, Math.atan2(Bp.x - A.x, Bp.z - A.z)); cb(0, 0, 0.3, L / 2 + 0.3); K.pop(); } run = []; };
  pts.forEach((q, i) => { if (q.skip){ flush(); return; } const h = rr(3.0, 3.7), y = gy(q.x, q.z) - 0.4; K.geo('bark2', cylM(0.22, 0.25, h, 6), q.x, y + h / 2, q.z, rr(-0.04, 0.04), 0, rr(-0.04, 0.04)); K.geo('woodD', cone(0.23, 0.55, 6), q.x, y + h + 0.26, q.z); run.push(q); if (run.length >= 7){ const last = run[run.length - 1]; flush(); run.push(last); } });
  flush();
  for (let i = 0; i < n; i += 5){ const A = pts[i], Bp = pts[(i + 5) % n]; if (pts.slice(i, i + 6).some(q => q.skip)) continue; const ka = 0.94, kb = 0.94; for (const hh of [1.1, 2.3]) link('woodD', [cx + (A.x - cx) * ka, gy(A.x, A.z) + hh, cz + (A.z - cz) * ka], [cx + (Bp.x - cx) * kb, gy(Bp.x, Bp.z) + hh, cz + (Bp.z - cz) * kb], 0.12); }
  // 문
  const gates = []; for (let i = 0; i < n; i++){ const q = pts[i], pq = pts[(i - 1 + n) % n]; if (q.gate && !pq.gate){ let j = i; while (pts[(j + 1) % n].gate && j - i < n) j++; gates.push([pq, pts[(j + 1) % n]]); } }
  for (const [A, Bp] of gates){ const ry = Math.atan2(Bp.x - A.x, Bp.z - A.z), ya = gy(A.x, A.z) - 0.4, yb = gy(Bp.x, Bp.z) - 0.4, top = Math.max(ya, yb) + 5.4;
    for (const [q, y] of [[A, ya], [Bp, yb]]){ K.geo('bark2', cylM(0.38, 0.42, top - y + 0.6, 7), q.x, (top + y + 0.6) / 2, q.z); K.geo('woodD', cone(0.4, 0.7, 7), q.x, top + 0.95, q.z); cc(q.x, q.z, 0.5); }
    link('bark2', [A.x, top - 0.4, A.z], [Bp.x, top - 0.4, Bp.z], 0.42, 0.42); link('woodD', [A.x, top - 1.1, A.z], [Bp.x, top - 1.1, Bp.z], 0.2, 0.2);
    const mx = (A.x + Bp.x) / 2, mz = (A.z + Bp.z) / 2; K.push(mx, top - 0.65, mz, ry + Math.PI / 2); K.geo('fabricB', plane(1.6, 2.4), 0, -1.4, 0.25); K.geo('fabricB', plane(1.6, 2.4), 0, -1.4, -0.25, 0, Math.PI, 0); K.box('gold', 0.5, 0.5, 0.03, 0, -1.0, 0.27, 0, 0, Math.PI / 4); K.box('gold', 0.5, 0.5, 0.03, 0, -1.0, -0.27, 0, 0, Math.PI / 4); K.pop();
    for (const q of [A, Bp]){ const ox = q.x + (q.x - cx) * 0.12, oz = q.z + (q.z - cz) * 0.12, d = Math.hypot(ox - mx, oz - mz) || 1, bx = ox + (ox - mx) / d * 1.2, bz = oz + (oz - mz) / d * 1.2; if (free(bx, bz, 0.4, { plaza: true, maxR: CUR.r + 10, roadPad: 0.2 })) P.lamp(bx, bz, 'iron', 0); }
  }
  return gates;
}
function catapult(x, z, ry){
  const y = gy(x, z); K.push(x, y, z, ry);
  for (const s of [-1, 1]){ K.box('woodD', 0.3, 0.3, 4.4, s * 0.9, 0.6, 0); for (const zz of [-1.6, 1.6]){ K.geo('woodD', cyl(0.5, 0.5, 0.18, 10), s * 1.12, 0.5, zz, 0, 0, Math.PI / 2); K.geo('iron', tor(0.5, 0.03, 3, 12), s * 1.18, 0.5, zz, 0, Math.PI / 2, 0); } }
  for (const zz of [-1.8, 0, 1.8]) K.box('woodD', 2.1, 0.25, 0.25, 0, 0.7, zz);
  for (const s of [-1, 1]){ link('woodD', [s * 0.9, 0.7, -1.2], [s * 0.7, 2.6, 0.2], 0.2); link('woodD', [s * 0.9, 0.7, 1.2], [s * 0.7, 2.6, 0.2], 0.2); }
  K.box('woodD', 1.7, 0.22, 0.22, 0, 2.6, 0.2); link('wood', [0, 2.6, 0.4], [0, 4.6, -2.4], 0.22, 0.22); K.geo('wood', sph(0.45, 8, 5, 0, TAU, 0, Math.PI / 2), 0, 4.75, -2.55, Math.PI + 0.6, 0, 0); K.box('iron', 0.9, 0.9, 0.9, 0, 2.1, 1.2);
  K.geo('wood', cylM(0.22, 0.22, 1.4, 8), 0, 0.95, 1.9, 0, 0, Math.PI / 2); link('rope', [0, 1.0, 1.9], [0, 2.4, 0.9], 0.03);
  K.pop(); K.push(x, 0, z, ry); cb(0, 0, 1.3, 2.3); K.pop();
  for (let i = 0; i < 5; i++){ const a = R() * TAU, px = x + Math.cos(ry) * 2.2 + Math.cos(a) * 0.5, pz = z - Math.sin(ry) * 2.2 + Math.sin(a) * 0.5; K.geo('rock', ico(rr(0.3, 0.42), 1), px, gy(px, pz) + 0.32 + (i > 3 ? 0.5 : 0), pz); }
  mapbox(x, z, 1.2, 2.2, ry);
}
function weaponRack(x, z, ry){ const y = gy(x, z); K.push(x, y, z, ry); for (const s of [-1, 1]) K.box('woodD', 0.1, 1.6, 0.1, s * 1.0, 0.8, 0); K.box('woodD', 2.2, 0.08, 0.12, 0, 1.45, 0); K.box('woodD', 2.2, 0.08, 0.3, 0, 0.3, 0);
  for (let i = 0; i < 5; i++){ const xx = -0.8 + i * 0.4; K.geo('wood', cyl(0.025, 0.025, 2.0, 4), xx, 1.1, 0.05, 0.12, 0, 0); K.geo('steel', cone(0.05, 0.22, 4), xx, 2.15, 0.17); }
  for (const s of [-1, 1]){ K.geo('fabricB', cyl(0.38, 0.38, 0.06, 10), s * 1.4, 0.55, 0.15, Math.PI / 2 - 0.2, 0, 0); K.geo('gold', sph(0.08, 6, 4), s * 1.4, 0.55, 0.2); }
  K.pop(); K.push(x, 0, z, ry); cb(0, 0, 1.4, 0.3); K.pop(); }
function dummy(x, z, ry){ const y = gy(x, z); K.push(x, y, z, ry); K.geo('woodD', cyl(0.06, 0.07, 1.8, 5), 0, 0.9, 0); K.box('woodD', 1.1, 0.07, 0.07, 0, 1.4, 0); K.geo('hay', cylM(0.26, 0.3, 0.8, 8), 0, 1.25, 0); K.geo('sack', sph(0.2, 7, 5), 0, 1.85, 0); for (const [r, k] of [[0.18, 'fabricW'], [0.1, 'fabricR']]) K.geo(k, new THREE.CircleGeometry(r, 10), 0, 1.3, 0.31 + (r < 0.15 ? 0.005 : 0)); K.pop(); cc(x, z, 0.4); }
function chevaux(x, z, ry){ const y = gy(x, z); K.push(x, y + 0.5, z, ry); K.geo('bark2', cylM(0.16, 0.16, 3.2, 6), 0, 0, 0, 0, 0, Math.PI / 2); for (let i = 0; i < 5; i++){ const xx = -1.3 + i * 0.65; for (const s of [-1, 1]){ K.geo('woodD', cyl(0.05, 0.07, 1.6, 5), xx, 0.25, s * 0.3, s * 0.7, 0, 0); K.geo('thorn', cone(0.06, 0.25, 4), xx, 0.25 + 0.74, s * (0.3 + 0.52), s * 0.7, 0, 0); } } K.pop(); K.push(x, 0, z, ry); cb(0, 0, 1.7, 0.7); K.pop(); }
function bFort(t){
  const R0 = t.r; let p, s;
  // 목책 타원: 평평한 판에 맞춰요 (가운데 조금 북쪽)
  const gates = palisade(1, -4, R0 * 0.92, R0 * 0.68);
  // 망루 셋 (안쪽 가장자리)
  const tops = [];
  for (const [x, z] of [[16, -15], [17, 6], [-18, -9]]){ s = site(x, z, 4.4, 4.4, { maxR: R0, max: 6, face: [0, 0], maxDh: 2 }); if (s) tops.push(watchtower(s.x, s.z, s.ry)); }
  tops.slice(0, 2).forEach((tp, i) => flag(tp.x, tp.y + 1.1, tp.z, i * 1.3 + 0.4, 2.0, 1.2, i ? 'fabricY' : 'fabricB'));
  // 막사 둘 · 치료소 · 지휘 천막
  for (const [x, z, ky] of [[10, -7, 'fabricR'], [-13, 4, 'fabricR']]){ s = site(x, z, 7.2, 4.8, { maxDh: 1.6, max: 8 }); if (s) pavilion(s.x, s.z, s.ry, { w: 6.8, d: 4.4, key: 'canvasD', stripe: ky, roof: ky, cap: 'iron' }); }
  s = site(12, 8, 6.2, 5.2, { maxDh: 1.6, max: 8 }); if (s){ pavilion(s.x, s.z, s.ry, { w: 5.8, d: 4.8, key: 'canvas', stripe: 'fabricW', roof: 'fabricW', emblem: 'fabricG', cap: 'gold' }); const q = prop(s.x + Math.cos(s.ry) * 3.8, s.z - Math.sin(s.ry) * 3.8, 1.0, { max: 3 }); if (q) P.clutter(q[0], q[1], 2, 0.7); }
  sites([[-11, -12], [-4, -14], [-15, -4], [4, -14]], 1, 6, 5, { maxDh: 1.8, max: 6 }, s => pavilion(s.x, s.z, s.ry, { w: 5.4, d: 4.4, key: 'fabricB', stripe: 'fabricY', roof: 'fabricB', cap: 'gold' }));
  // 투석기 (북쪽을 봐요)
  if (!spNear(t, ['catapult'])){ s = site(2, 9, 3.4, 5.2, { maxDh: 1.2, max: 8, face: Math.PI }); if (s) catapult(s.x, s.z, Math.PI); }
  // 깃발 · 화로 · 무기 걸이 · 허수아비 · 짐 · 모닥불
  for (const [x, z] of [[-7, -9], [8, 3], [-6, 8], [9, -10]]){ p = prop(x, z, 0.5); if (p) P.banner(p[0], p[1], 'fabricB', 4.8, faceTo(p[0], p[1]) - Math.PI / 2); }
  for (const [x, z] of [[4, -10], [-9, 1], [5, 4]]){ p = prop(x, z, 0.6); if (p) P.lamp(p[0], p[1], 'iron', 0); }
  for (const [x, z] of [[-16, -2], [19, -1]]){ p = prop(x, z, 1.5); if (p) weaponRack(p[0], p[1], faceTo(p[0], p[1])); }
  for (const [x, z] of [[-4, 14], [-1, -16]]){ p = prop(x, z, 0.5); if (p) dummy(p[0], p[1], faceTo(p[0], p[1]) + Math.PI); }
  for (const [x, z] of [[-18, 6], [14, -2], [20, 12]]){ p = prop(x, z, 1.0); if (p) P.clutter(p[0], p[1], 3); }
  p = prop(-3, 4, 1.3); if (p) P.campfire(p[0], p[1]);
  // 북문 밖 가시 막이
  for (const [A, Bp] of gates){ const mx = (A.x + Bp.x) / 2, mz = (A.z + Bp.z) / 2; if (mz > -4) continue; for (const s2 of [-1, 1]){ const ux = (Bp.x - A.x), uz = (Bp.z - A.z), L = Math.hypot(ux, uz) || 1, ox = mx + ux / L * s2 * 5.5 + (mx - 1) * 0.0, oz = mz - 3.5; if (free(ox, oz, 1.6, { plaza: true, maxR: R0 + 14, roadPad: 0.4 })) chevaux(ox, oz, Math.atan2(ux, uz)); } }
  entrySigns(t);
}

// ───────────────────────── 서리 수도원 (monastery) ─────────────────────────
function abbey(x, z, ry){
  const w = 12, d = 8, h = 5, [lo, hi] = foot(OX + x, OZ + z, w / 2 + 0.6, d / 2 + 0.6, ry), y = hi + 0.1; K.push(x, y, z, ry);
  K.box('stoneD', w + 0.8, y - lo + 0.8, d + 0.8, 0, -(y - lo + 0.8) / 2 + 0.3, 0); K.box('stone', w, h, d, 0, 0.3 + h / 2, 0);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++){ const xx = -w / 2 + 1.5 + i * (w - 3) / 3; K.box('stoneD', 0.7, h * 0.85, 0.9, xx, 0.3 + h * 0.42, s * (d / 2 + 0.35), s * 0.06); if (i < 3){ K.push(xx + (w - 3) / 6, 0, s * d / 2, s > 0 ? 0 : Math.PI); win(0, 0.3 + h * 0.55, 0.7, 1.9, 'stone', false); K.geo('stone', cone(0.5, 0.6, 4), 0, 0.3 + h * 0.55 + 1.25, 0.05, 0, Math.PI / 4, 0); K.pop(); } }
  // 정면 (+z 아닌 +x 쪽 박공 · 큰 문 · 둥근 창)
  K.push(w / 2, 0, 0, Math.PI / 2); K.box('woodD', 1.8, 2.8, 0.1, 0, 1.7, 0.05); K.geo('woodD', cyl(0.9, 0.9, 0.1, 10, false, 0, Math.PI), 0, 3.1, 0.05, Math.PI / 2, 0, 0); K.geo('stoneD', tor(0.95, 0.14, 4, 12, Math.PI), 0, 3.1, 0.1); K.box('stoneD', 2.6, 0.2, 1.0, 0, 0.35, 0.5);
  K.geo('win', new THREE.CircleGeometry(0.8, 12), 0, h + 1.4, 0.06); K.geo('stoneD', tor(0.85, 0.12, 4, 16), 0, h + 1.4, 0.08); wallLamp(1.4, 2.6); wallLamp(-1.4, 2.6); K.pop();
  K.push(0, 0, 0, Math.PI / 2); const rise = roofG(d, w, 0.3 + h, 1.0, 0.5, 'slate'); gables(d, w, 0.3 + h, rise, 'stone', false);
  { const hd = w / 2 + 0.5, L = hd / Math.cos(1.0); for (const s of [-1, 1]) K.box('snow', d + 1.0, 0.14, L * 0.9, 0, 0.3 + h + rise - (hd / 2) * Math.tan(1.0) + 0.28, s * hd / 2, s * 1.0, 0, 0); } K.pop();
  K.box('stone', 0.8, 2.4, 0.8, -w * 0.3, 0.3 + h + rise * 0.6, d * 0.2); CUR.smoke.push(kpt(-w * 0.3, 0.3 + h + rise * 0.6 + 1.3, d * 0.2));
  K.geo('gold', cyl(0.05, 0.05, 1.4, 4), w / 2 - 0.3, 0.3 + h + rise + 0.6, 0); K.box('gold', 0.06, 0.06, 0.7, w / 2 - 0.3, 0.3 + h + rise + 1.0, 0);
  K.pop(); cb(x, z, w / 2 + 0.4, d / 2 + 0.8, ry); mapbox(x, z, w / 2, d / 2, ry);
}
function bellTower(x, z){
  const [lo] = footC(OX + x, OZ + z, 2.4), y = lo - 0.3, h = 9; K.push(x, y, z);
  K.box('stone', 3.8, h, 3.8, 0, h / 2, 0); K.box('stoneD', 4.2, 0.4, 4.2, 0, h, 0); for (let i = 0; i < 3; i++) K.push(0, 0, 1.9), win(0, 3 + i * 2.2, 0.4, 0.9, 'stone', false), K.pop();
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.box('stone', 0.7, 2.8, 0.7, a * 1.6, h + 1.6, b * 1.6);
  K.box('stoneD', 4.2, 0.4, 4.2, 0, h + 3.1, 0); K.geo('slate', cone(3.2, 3.2, 4), 0, h + 4.9, 0, 0, Math.PI / 4, 0); K.geo('snow', cone(3.25, 1.4, 4), 0, h + 5.85, 0, 0, Math.PI / 4, 0); K.geo('gold', sph(0.18, 6, 4), 0, h + 6.6, 0);
  K.box('woodD', 3.4, 0.18, 0.18, 0, h + 2.7, 0); K.pop(); cc(x, z, 2.2); mapbox(x, z, 1.9, 1.9, 0);
  // 종 (가끔 흔들려요)
  const bg = new THREE.Group(); bg.position.set(x, y + h + 2.65, z); CUR.near.add(bg);
  const bm = meshOf(vcGeo(() => { K.geo('bronze', lathe([[0, 0], [0.7, 0], [0.62, 0.2], [0.48, 0.75], [0.4, 1.15], [0, 1.2]], 12, 0.4), 0, -1.25, 0); K.geo('iron', sph(0.12, 6, 4), 0, -1.25, 0); }), vcMat(grainTex)); bm.matrixAutoUpdate = true; bg.add(bm);
  glowAbs(x, y + h + 1.5, z, 0xffd090, 2.2, 0.2);
  anim((dt, tt) => { const c = tt % 14, k = c < 3 ? Math.sin(c * 3.2) * (1 - c / 3) : 0; bm.rotation.x = k * 0.45; });
}
function lowWall(cx, cz, rx, rz){
  const per = TAU * Math.sqrt((rx * rx + rz * rz) / 2), n = Math.round(per / 2.2), pts = [];
  for (let i = 0; i <= n; i++){ const a = i / n * TAU, x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz; pts.push([x, z, roadD(OX + x, OZ + z) < 2.6 || CUR.keep.some(([kx, kz]) => Math.hypot(x - kx, z - kz) < 1.8)]); }
  for (let i = 0; i < n; i++){ const [ax, az, ga] = pts[i], [bx, bz, gb] = pts[i + 1]; if (ga || gb) continue; const ya = gy(ax, az), yb = gy(bx, bz), L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az), my = Math.min(ya, yb) - 0.3, hh = 1.2 + Math.abs(ya - yb);
    K.push((ax + bx) / 2, my, (az + bz) / 2, yaw); K.box('stone', 0.7, hh, L + 0.1, 0, hh / 2, 0); K.box('snow', 0.8, 0.14, L + 0.15, 0, hh + 0.05, 0); K.pop(); K.push((ax + bx) / 2, 0, (az + bz) / 2, yaw); cb(0, 0, 0.4, L / 2 + 0.05); K.pop(); }
  for (let i = 0; i < n; i++){ const ga = pts[i][2], gb = pts[i + 1][2]; if (ga === gb) continue; const [x, z] = ga ? pts[i + 1] : pts[i], y = gy(x, z) - 0.2; K.box('stone', 1.0, 2.4, 1.0, x, y + 1.2, z); K.box('snow', 1.1, 0.16, 1.1, x, y + 2.45, z); K.box('lampN', 0.3, 0.3, 0.3, x, y + 2.7, z); K.geo('stoneD', cone(0.45, 0.4, 4), x, y + 3.05, z, 0, Math.PI / 4, 0); glow(x, y + 2.7, z, 0xffd8a0, 2.2, 0.35); cc(x, z, 0.6); }
}
function pineTree(x, z, s = 1){ const y = gy(x, z); K.geo('bark2', cyl(0.1 * s, 0.14 * s, 1.2 * s, 5), x, y + 0.6 * s, z); for (let i = 0; i < 3; i++){ const r = (1.1 - i * 0.3) * s, yy = y + (1.0 + i * 0.85) * s; K.geo('pine', cone(r, 1.3 * s, 7), x, yy + 0.65 * s, z); K.geo('snow', cone(r * 0.75, 0.5 * s, 7), x, yy + 1.15 * s, z); } cc(x, z, 0.35 * s); }
function snowPile(x, z, s = 1){ K.geo('snow', sph(s, 8, 5, 0, TAU, 0, Math.PI / 2), x, gy(x, z) - 0.15, z, 0, R() * 3, 0, 1.4, 0.45, 1); }
function bFrost(t){
  const R0 = t.r; let p, s;
  lowWall(0, 0, R0 * 0.9, R0 * 0.72);
  s = site(5, -12, 13, 9, { maxDh: 3, max: 10, k: 0.78 }); if (s) abbey(s.x, s.z, s.ry - Math.PI / 2);
  if (!spNear(t, ['bell_tower'])){ s = site(14, 5, 4.6, 4.6, { maxDh: 2.5, max: 8 }); if (s) bellTower(s.x, s.z); }
  sites([[-10, 10], [-1, 13], [9, 12], [-16, 2], [16, -2], [-14, -12]], 3, 4, 3.8, { maxDh: 2.2, max: 6 }, s => house(s.x, s.z, s.ry, { w: 3.6, d: 3.2, h: 2.5, wall: 'stone', base: 'stoneD', roof: 'slate', paint: 'woodD', timber: false, flowers: false, snow: true, back: false, pitch: 0.9 }));
  // 눈 덮인 정원: 작은 전나무 · 얼어붙은 연못 · 돌 등불 · 석상
  p = prop(-11, -7, 3.2); if (p){ K.geo('ice', new THREE.CircleGeometry(2.4, 18).rotateX(-Math.PI / 2), p[0], gy(p[0], p[1]) + 0.07, p[1]); for (let i = 0; i < 12; i++){ const a = i / 12 * TAU; K.geo('stone', rockG(rr(0.25, 0.4), 0.6, 0), p[0] + Math.cos(a) * 2.6, gy(p[0], p[1]) + 0.1, p[1] + Math.sin(a) * 2.6); snowPile(p[0] + Math.cos(a + 0.2) * 3.0, p[1] + Math.sin(a + 0.2) * 3.0, 0.35); } }
  for (const [x, z] of [[-17, -3], [-15, -13], [-5, -15], [-19, 6], [18, -8]]){ p = prop(x, z, 0.8); if (p) pineTree(p[0], p[1], rr(0.9, 1.3)); }
  for (const [x, z] of [[-7, -2], [3, 5]]){ p = prop(x, z, 0.5); if (p) P.lamp(p[0], p[1], 'snow'); }
  for (const [x, z] of [[-4, -8], [6, 0], [-8, 4], [9, -6]]){ p = prop(x, z, 0.6); if (p) P.lamp(p[0], p[1], 'iron', 0); }
  // 기도 깃발 (마당을 가로질러요)
  const PF = ['fabricB', 'fabricW', 'fabricR', 'fabricG', 'fabricY'], poles = [];
  for (const [x, z] of [[-12, 0], [12, -2], [-8, 9], [8, 10]]){ const q = prop(x, z, 0.4, { max: 4 }); if (q) poles.push(P.pole(q[0], q[1], 5.2)); }
  if (poles.length >= 2) P.pennants(poles[0], poles[1], 1.4, PF); if (poles.length >= 4){ P.pennants(poles[2], poles[3], 1.2, PF); P.pennants(poles[0], poles[2], 0.8, PF); }
  for (let i = 0; i < 14; i++){ const a = R() * TAU, d = rr(R0 * 0.4, R0 * 1.1), x = Math.cos(a) * d, z = Math.sin(a) * d; if (free(x, z, 0.8, { plaza: true, maxR: R0 + 8, keepK: 0.5 })) snowPile(x, z, rr(0.6, 1.4)); }
  for (const [x, z] of [[-14, 3], [14, 8]]){ p = prop(x, z, 1.0); if (p) P.clutter(p[0], p[1], 2); }
  entrySigns(t);
}

// ───────────────────────── 새싹 마을 축제 장식 (festival) — 집은 landmarks 것, 장식만 ─────────────────────────
function bVillageFest(t){
  const lampTop = (x, z) => [x - t.x, gy(x - t.x, z - t.z) + 3.4, z - t.z];
  t.chg.festival = subMesh(() => {
    for (const z of [512, 528, 571, 588, 612]){ const a = lampTop(-5.6, z + 1.5), b = lampTop(5.6, z); if (a[2] > -t.r - 30 && a[2] < t.r + 30) P.lights(a, b, 0.5, 'lampF', 3, 0xffd080, 1.4); }
    const mp = [26 - t.x, gy(26 - t.x, 559 - t.z) + 8.4, 559 - t.z];
    for (const [x, z] of [[30, 542], [40, 560], [17, 562]]) P.lights(mp, lampTop(x, z), 1.0, 'lampF', 3, 0xffd080, 1.6);
    P.lights(lampTop(-30, 540), lampTop(-12, 562), 0.9); P.lights(lampTop(-38, 562), lampTop(-12, 562), 0.8);
    const PF = ['fabricR', 'fabricY', 'fabricB', 'fabricG', 'fabricW', 'fabricP'];
    P.pennants(lampTop(-30, 540), lampTop(-38, 562), 0.8, PF); P.pennants(lampTop(30, 542), lampTop(40, 560), 0.8, PF); P.pennants(lampTop(-12, 562), lampTop(17, 562), 1.0, PF);
    // 큰길 위 깃발 줄 (가로등 사이 X 자로)
    for (const [z0, z1] of [[512, 528], [571, 588], [588, 612]]){ P.pennants(lampTop(-5.6, z0 + 1.5), lampTop(5.6, z1), 0.7, PF); P.pennants(lampTop(5.6, z0), lampTop(-5.6, z1 + 1.5), 0.7, PF); }
    // 광장 둘레 꽃 아치 (큰길 위)
    flowerArch(0 - t.x, 538 - t.z, 0, 6.4); flowerArch(0 - t.x, 569 - t.z, 0, 6.4);
    // 꽃 아치: 서문(농원길) · 동문
    const rn = roadNear(-66, 553); if (rn && rn[2] < 4){ const s = rn[3]; flowerArch(rn[0] - t.x, rn[1] - t.z, Math.atan2(s.ex, s.ez), 6.4); }
    flowerArch(66 - t.x, 559 - t.z, Math.PI / 2, 6.4);
    // 큰길 위 축제 현수막
    { const a = lampTop(-5.6, 529.5), b = lampTop(5.6, 528), uv = signCell('새싹 축제', 'Harvest Festival'), mx = (a[0] + b[0]) / 2, my = Math.max(a[1], b[1]) + 0.2, mz = (a[2] + b[2]) / 2; link('rope', a, [mx, my, mz], 0.02); link('rope', [mx, my, mz], b, 0.02);
      K.push(mx, my - 0.75, mz, Math.atan2(b[0] - a[0], b[2] - a[2]) + Math.PI / 2); K.box('fabricR', 3.4, 1.0, 0.04, 0, 0, 0); K.geo('signT', quadUV(3.0, 0.75, uv), 0, 0, 0.03); K.geo('signT', quadUV(3.0, 0.75, uv), 0, 0, -0.03, 0, Math.PI, 0); K.pop(); }
  }, [0, t.y, 0]);
  skyLanterns(t.chg.festival, [0 - t.x, t.y, 556 - t.z], 46, LOW ? 16 : 30);
  t.chg.festival.visible = false;
}
// 하늘로 떠오르는 종이 등불 (축제): 인스턴스 + 같은 식으로 움직이는 빛 점 (그룹 안 · 그룹이 보일 때만)
function skyLanterns(parent, c, r, n){
  const geo = vcGeo(() => { K.geo('lampF', cyl(0.26, 0.2, 0.5, 7), 0, 0, 0); K.geo('woodD', cyl(0.27, 0.27, 0.04, 7), 0, 0.26, 0); K.geo('woodD', tor(0.2, 0.02, 3, 8), 0, -0.25, 0, Math.PI / 2); });
  const im = new THREE.InstancedMesh(geo, vcMat(grainTex), n); im.frustumCulled = false; im.castShadow = false; const inner = parent.children[0]; inner.add(im);
  const B0 = [], seeds = new Float32Array(n), base = new Float32Array(n * 3);
  for (let i = 0; i < n; i++){ const a = R() * TAU, d = Math.sqrt(R()) * r, o = [c[0] + Math.cos(a) * d, c[1] + rr(3, 6), c[2] + Math.sin(a) * d * 0.6]; B0.push(o); seeds[i] = R(); base.set(o, i * 3); }
  const pos = (i, t, v) => { const sd = seeds[i], b = B0[i], life = (t * (0.018 + sd * 0.012) + sd) % 1; return v.set(b[0] + Math.sin(t * 0.3 + sd * 40) * 1.6 + life * 6, b[1] + life * 34, b[2] + Math.cos(t * 0.25 + sd * 30) * 1.6); };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new V3(), sc = new V3();
  const upd = t => { for (let i = 0; i < n; i++){ pos(i, t, v); const life = (t * (0.018 + seeds[i] * 0.012) + seeds[i]) % 1, k = Math.min(1, life * 8, (1 - life) * 4); e.set(Math.sin(t + i) * 0.12, i, Math.cos(t * 0.8 + i) * 0.12); q.setFromEuler(e); m4.compose(v, q, sc.set(k, k, k)); im.setMatrixAt(i, m4); } im.instanceMatrix.needsUpdate = true; };
  upd(0); anim((dt, t) => { if (parent.visible) upd(t); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(base, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const pm = new THREE.ShaderMaterial({ uniforms: { uTime: TU, uScale: { value: 500 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `attribute float aSeed; uniform float uTime, uScale; varying float vA; void main(){ float life = mod(uTime * (0.018 + aSeed * 0.012) + aSeed, 1.0); vec3 p = position + vec3(sin(uTime * 0.3 + aSeed * 40.0) * 1.6 + life * 6.0, life * 34.0, cos(uTime * 0.25 + aSeed * 30.0) * 1.6);
      vA = min(1.0, min(life * 8.0, (1.0 - life) * 4.0)); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 2.4 * uScale / -mv.z; }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a = a * a * vA * 0.8; gl_FragColor = vec4(vec3(1.0, 0.72, 0.36) * a, a); }` });
  const pts = new THREE.Points(g, pm); pts.frustumCulled = false; inner.add(pts); RGU.push(pm);
}
const RGU = [];

// ───────────────────────── 조립: 정착지 ─────────────────────────
const BUILD = { farm: bFarm, treehouse: bLeaf, fishing: bMist, stilt: bStilt, mining: bDust, dig: bStar, fort: bFort, monastery: bFrost };
const FAILED = [], TIMES = [];
for (const t of TOWNS){
  const t0 = performance.now();
  try { begin(t); if (t.existing){ if (t.id === 'village' || t.style === 'village') bVillageFest(t); } else { const fn = BUILD[t.style]; if (fn) fn(t); else FAILED.push(t.id + ':no-style'); } finish(); }
  catch (e){ console.error('[towns] 빌드 실패', t.id, e); FAILED.push(t.id); try { if (CUR) finish(); } catch (e2){} CUR = null; B = K = null; COLREC = null; }
  TIMES.push([t.id, Math.round(performance.now() - t0)]);
}

// ───────────────────────── 읽을거리 (한 메시 · 하나씩 숨기기는 셰이더로) ─────────────────────────
const RDMAX = 96, RHIDE = new Float32Array(RDMAX), RHU = { value: RHIDE };
const RDMAT = (() => { const m = std({ map: grainTex, vertexColors: true, side: DS, roughness: 0.85 });
  m.onBeforeCompile = sh => { emiPatch(sh); sh.uniforms.uRH = RHU;
    sh.vertexShader = 'attribute float aRd;\nuniform float uRH[96];\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tif (uRH[int(aRd + 0.5)] > 0.5 || distance(cameraPosition, transformed) > 330.0) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);'); };
  m.customProgramCacheKey = () => 'twrd'; OWN.push(m); return m; })();
const RDS = [], RBY = {};
// 걸을 수 있는 면 (그루터기 윗면 · 봉우리 돔 같은 발판 포함) — 발판은 땅보다 높을 때만 이겨요
const baseY = (o, x, z) => Math.max(F.groundFn(x, z), H(x, z));
const onTop = (o, x, z) => !!o.top || F.groundFn(x, z) > H(x, z) + 0.3;
function rdFace(x, z){
  for (const t of TOWNS) if (Math.hypot(x - t.x, z - t.z) < t.r + 4) return Math.atan2(t.x - x, t.z - z);
  const rn = roadNear(x, z); if (rn && rn[2] < 45) return Math.atan2(rn[0] - x, rn[1] - z);
  return (hashS('f' + x + ',' + z) % 628) / 100;
}
function buildReadable(r){
  const [x, z] = r.c, y = baseY(r, x, z), ry = rdFace(x, z), kind = r.kind || 'note'; let top = 1.6, cr = 0.4;
  K.push(x, y, z, ry);
  if (kind === 'stone'){ K.box('stoneD', 1.4, 0.3, 0.7, 0, 0.1, 0); K.box('stone', 1.0, 1.4, 0.22, 0, 0.95, 0, -0.04); K.geo('stone', cyl(0.5, 0.5, 0.22, 10), 0, 1.65, -0.03, Math.PI / 2 - 0.04, 0, 0);
    for (let i = 0; i < 5; i++) K.box('dark', rr(0.4, 0.7), 0.035, 0.02, rr(-0.05, 0.05), 0.55 + i * 0.2, 0.12 - (0.55 + i * 0.2) * 0.04); K.geo('glowC', new THREE.RingGeometry(0.1, 0.15, 10), 0, 1.68, 0.14 - 0.07); K.geo('mossy', rockG(0.28, 0.6, 0), 0.55, 0.15, 0.25); top = 2.2; cr = 0.75; }
  else if (kind === 'diary'){ P.crate(0, 0, 0, 0.72, 0); K.box('pRed', 0.36, 0.05, 0.27, -0.08, 0.745, 0.02, 0, 0.3, 0); for (const s of [-1, 1]) K.box('paper', 0.16, 0.012, 0.25, -0.08 + s * 0.08, 0.78, 0.02, 0, 0.3, s * 0.12); K.geo('wax', cyl(0.035, 0.035, 0.14, 6), 0.22, 0.79, -0.16); K.geo('glowO', sph(0.03, 4, 3), 0.22, 0.88, -0.16); glow(0.22, 0.89, -0.16, 0xffb050, 0.9, 0.3); top = 1.2; cr = 0.5; }
  else if (kind === 'book'){ K.geo('woodD', cyl(0.06, 0.09, 1.0, 6), 0, 0.5, 0); K.box('woodD', 0.5, 0.06, 0.4, 0, 0.02, 0); K.push(0, 1.05, 0, 0, -0.45); K.box('wood', 0.62, 0.05, 0.46, 0, 0, 0); K.box('pRed', 0.56, 0.03, 0.4, 0, 0.04, 0); for (const s of [-1, 1]) K.box('paper', 0.25, 0.02, 0.36, s * 0.13, 0.065, 0, 0, 0, s * 0.08); K.pop(); top = 1.5; }
  else if (kind === 'letter'){ for (const s of [-1, 1]) K.geo('woodD', cyl(0.04, 0.05, 1.3, 5), s * 0.42, 0.65, 0); K.box('wood', 0.95, 0.6, 0.06, 0, 1.0, 0); K.box('parch', 0.4, 0.27, 0.01, 0, 1.0, 0.04, 0, 0, rr(-0.1, 0.1)); K.geo('fabricR', cyl(0.035, 0.035, 0.01, 8), 0, 0.98, 0.05, Math.PI / 2, 0, 0); top = 1.5; }
  else if (kind === 'poster'){ for (const s of [-1, 1]) K.geo('woodD', cyl(0.07, 0.08, 2.3, 6), s * 0.85, 1.15, 0); K.box('wood', 1.75, 1.15, 0.08, 0, 1.45, 0); for (const s of [-1, 1]) K.box('shingle', 2.1, 0.06, 0.45, 0, 2.2, s * 0.17, s * 0.5); K.geo('beam', cyl(0.04, 0.04, 2.1, 4), 0, 2.32, 0, 0, 0, Math.PI / 2);
    K.box('paper', 0.6, 0.75, 0.01, 0, 1.45, 0.05, 0, 0, rr(-0.06, 0.06)); K.box('parch', 0.42, 0.5, 0.01, -0.58, 1.5, 0.05, 0, 0, rr(-0.1, 0.1)); K.box('paper', 0.36, 0.42, 0.01, 0.58, 1.38, 0.05, 0, 0, rr(-0.1, 0.1)); for (const xx of [0, -0.58, 0.58]) K.geo('fabricR', sph(0.025, 4, 3), xx, 1.78, 0.07); top = 2.5; cr = 0.9; }
  else if (kind === 'grave'){ K.geo('soil', sph(0.8, 8, 5, 0, TAU, 0, Math.PI / 2), 0, -0.05, 0.75, 0, 0, 0, 0.8, 0.3, 1.3); K.box('stone', 0.7, 0.8, 0.16, 0, 0.45, 0, -0.06); K.geo('stone', cyl(0.35, 0.35, 0.16, 10), 0, 0.85, -0.02, Math.PI / 2 - 0.06, 0, 0); K.box('dark', 0.3, 0.03, 0.02, 0, 0.7, 0.09); K.box('dark', 0.04, 0.3, 0.02, 0, 0.65, 0.09);
    for (let i = 0; i < 5; i++) K.geo(pick(['flower', 'flowerY', 'flowerW']), ico(0.08, 0), rr(-0.3, 0.3), 0.15, rr(0.4, 1.0)); top = 1.3; cr = 0.5; }
  else if (kind === 'song'){ K.geo('mossy', sph(0.55, 9, 6), 0, 0.4, 0, 0, 0, 0, 1, 1.25, 0.6); K.push(0, 0.55, 0.32); K.geo('glowY', cyl(0.07, 0.07, 0.03, 8), -0.06, -0.12, 0, Math.PI / 2, 0, 0, 1.3, 1, 1); K.box('glowY', 0.03, 0.3, 0.03, 0.03, 0.03, 0); K.box('glowY', 0.12, 0.03, 0.03, 0.08, 0.17, 0, 0, 0, -0.4);
    K.geo('glowY', cyl(0.05, 0.05, 0.03, 8), 0.2, -0.04, 0, Math.PI / 2, 0, 0, 1.3, 1, 1); K.box('glowY', 0.025, 0.22, 0.03, 0.25, 0.07, 0); K.pop(); top = 1.2; cr = 0.55; }
  else { K.geo('woodD', cyl(0.06, 0.07, 1.6, 5), 0, 0.8, 0); K.box('paper', 0.42, 0.55, 0.01, 0, 1.25, 0.075, 0, 0, rr(-0.08, 0.08)); K.geo('fabricR', sph(0.03, 4, 3), 0, 1.48, 0.085); }
  K.pop();
  return { y, top: y + top, cr, ry };
}
{
  OX = 0; OZ = 0; CUR = { anims: [], smoke: [], sparks: [], occ: [], keep: [], rects: [], r: 5, near: null, mapbox: [] };
  const parts = [];
  for (const L of LORE) for (const r of (L && L.readables) || []){
    if (!r || !r.id || !Array.isArray(r.c) || RBY[r.id] || RDS.length >= RDMAX) continue;
    srand(hashS(r.id)); const sb = new LB(1e9); B = sb; K = new G.Kit(sb); const cols = []; COLREC = cols;
    let info; try { info = buildReadable(r); } catch (e){ console.warn('[towns] 읽을거리 실패', r.id, e); continue; }
    const list = []; for (const k in sb.g) for (const g of sb.g[k]) list.push([k, g]); const geo = mergeVC(list, 0.04); if (!geo) continue;
    const idx = RDS.length; geo.setAttribute('aRd', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(idx), 1)); parts.push(geo);
    if (r.kind === 'poster'){ K.push(r.c[0], 0, r.c[1], info.ry); cb(0, 0, 0.95, 0.25); K.pop(); } else F.circle(r.c[0], r.c[1], info.cr);
    const obj = new THREE.Object3D(); obj.position.set(r.c[0], info.top, r.c[1]); obj.name = 'rd_' + r.id; FW.add(obj);
    const rd = { id: r.id, L, r, kind: r.kind, x: r.c[0], z: r.c[1], y: info.y, top: info.top, idx, cols, obj, glow: false, hidden: false };
    Object.assign(obj, { kind: r.kind, title: r.title, region: L.region, top: info.top, setGlow: on => rdGlow(rd, on), get glowing(){ return rd.glow; } });
    obj.userData.readable = r.id; RDS.push(rd); RBY[r.id] = rd;
  }
  COLREC = null; B = K = null; CUR = null;
  if (parts.length){
    const out = new THREE.BufferGeometry(); let n = 0; for (const g of parts) n += g.attributes.position.count;
    for (const [name, sz] of [['position', 3], ['normal', 3], ['color', 3], ['uv', 2], ['aEmi', 1], ['aRd', 1]]){ const arr = new Float32Array(n * sz); let o = 0; for (const g of parts){ arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; } out.setAttribute(name, new THREE.BufferAttribute(arr, sz)); }
    out.computeBoundingSphere(); const m = meshOf(out, RDMAT, false); m.frustumCulled = false; m.name = 'town_readables'; FW.add(m); TRIS += n / 3;
  }
  STATS.readables = RDS.length;
}
// 반짝임 (읽지 않은 · 퀘스트 읽을거리): 점 하나로 전부
const RGP = new Float32Array(RDS.length * 3), RGON = new Float32Array(RDS.length);
RDS.forEach((rd, i) => { RGP[i * 3] = rd.x; RGP[i * 3 + 1] = rd.top + 0.35; RGP[i * 3 + 2] = rd.z; });
const rgGeo = new THREE.BufferGeometry(); rgGeo.setAttribute('position', new THREE.BufferAttribute(RGP, 3)); rgGeo.setAttribute('aOn', new THREE.BufferAttribute(RGON, 1));
const RGMAT = new THREE.ShaderMaterial({ uniforms: { uTime: TU, uScale: { value: 400 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  vertexShader: `attribute float aOn; uniform float uTime, uScale; varying float vA; varying float vT;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z; vT = uTime * 2.2 + position.x * 0.7; vA = aOn * smoothstep(170.0, 120.0, d) * (0.7 + 0.3 * sin(vT));
      gl_Position = projectionMatrix * mv; if (vA < 0.01) gl_Position = vec4(0.0, 0.0, -2.0, 1.0); gl_PointSize = max(1.6 * uScale / d * (0.9 + 0.2 * sin(vT * 1.3)), 6.0); }`,
  fragmentShader: `varying float vA; varying float vT; void main(){ vec2 p = gl_PointCoord - 0.5; float r = length(p), a = atan(p.y, p.x) + vT * 0.25;
    float star = smoothstep(0.5, 0.0, r) * (0.35 + 0.65 * pow(abs(cos(a * 2.0)), 18.0)) + smoothstep(0.18, 0.0, r);
    float al = star * vA; gl_FragColor = vec4(vec3(1.0, 0.86, 0.45) * al * 1.5, al); }` });
const rgPts = new THREE.Points(rgGeo, RGMAT); rgPts.frustumCulled = false; rgPts.name = 'town_readable_glow'; if (RDS.length) FW.add(rgPts);
function rdGlow(rd, on){ rd.glow = !!on; RGON[rd.idx] = rd.glow && !rd.hidden ? 1 : 0; rgGeo.attributes.aOn.needsUpdate = true; }

// ───────────────────────── 룬 수호석 (빛 잃은 비석 · 가시 덩굴 · setLit 로 정화) ─────────────────────────
function thornVine(pts, r0, r1, spikes = 10){
  K.geo('thorn', tubeG(pts, r0, r1, 5, 6));
  const c = new THREE.CatmullRomCurve3(pts.map(p => new V3(...p))); for (let i = 0; i < spikes; i++){ const tt = rr(0.05, 0.95), p = c.getPointAt(tt), tg = c.getTangentAt(tt), r = lerp(r0, r1, tt), a = R() * TAU, n = new V3(Math.cos(a), rr(-0.3, 0.6), Math.sin(a)).cross(tg).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), n), e = new THREE.Euler().setFromQuaternion(q); K.geo(R() < 0.85 ? 'thornR' : 'crystalP', cone(r * 0.45, r * 2.4, 4), p.x + n.x * r, p.y + n.y * r, p.z + n.z * r, e.x, e.y, e.z); }
}
const KSS = [], KBY = {};
const PILLARS = [];
function bKeystone(L){
  const k = L.keystone, s = k.small ? 0.55 : 1, rec = !!k.record, x = k.c[0], z = k.c[1];
  srand(hashS(k.id)); OX = x; OZ = z;
  const top = onTop(k, x, z), [lo, hi] = footC(x, z, 2.4 * s), y0 = top ? baseY(k, x, z) : (hi - lo > 1.2 ? (lo + hi) / 2 + 0.3 : hi), yb = top ? y0 - 0.1 : lo - 0.25;
  const g = new THREE.Group(); g.position.set(x, 0, z); g.name = 'ks_' + k.id;
  const o = { id: k.id, L, x, z, y: y0, s, g, k: 0, cols: [], hidden: false, active: false };
  COLREC = o.cols; CUR = { anims: [], smoke: [], sparks: [], occ: [], keep: [], rects: [], r: 5, near: g, mapbox: [] };
  const mw = (rec ? 1.55 : 0.9) * s, mh = (rec ? 3.0 : 4.4) * s, dz = rec ? 0.32 : 0.55, ph = y0 + 0.75 * s, hwB = mw * 0.7071, hwT = mw * 0.62 * 0.7071, tilt = Math.atan((hwB - hwT) * dz / mh);
  // 받침 · 비석 · 고리 돌
  let sb = new LB(1e9); B = sb; K = new G.Kit(sb);
  K.geo('stoneD', cylM(2.4 * s, 2.6 * s, y0 + 0.4 * s - yb, 8), 0, (y0 + 0.4 * s + yb) / 2, 0); K.geo('stone', cylM(1.6 * s, 1.8 * s, 0.4 * s, 8), 0, y0 + 0.55 * s, 0);
  K.geo('darkst', cyl(mw * 0.62, mw, mh, 4).rotateY(Math.PI / 4), 0, ph + mh / 2, 0, 0, 0, 0, 1, 1, dz); K.geo('darkst', cone(mw * 0.62 * 1.02, 0.8 * s, 4).rotateY(Math.PI / 4), 0, ph + mh + 0.4 * s, 0, 0, 0, 0, 1, 1, dz);
  const RS = []; const nRing = rec ? 6 : 8; for (let i = 0; i < nRing; i++){ const a = i / nRing * TAU + 0.2, rx = Math.cos(a) * 3.5 * s, rz = Math.sin(a) * 3.5 * s, h = rr(0.9, 1.5) * s, gb = baseY(k, x + rx, z + rz), yy = (top ? gb : H(x + rx, z + rz)) - 0.15; if (top && Math.abs(gb - y0) > 1.0) continue;   // 그루터기 · 봉우리 가장자리 밖은 빼요
    K.push(rx, yy, rz, -a - Math.PI / 2, rr(-0.06, 0.06)); K.geo('stone', cyl(0.2 * s, 0.32 * s, h, 5), 0, h / 2, 0); K.pop(); RS.push([rx, yy + h * 0.6, rz, a]); cc(rx, rz, 0.35 * s); }
  for (let i = 0; i < 5; i++){ const a = R() * TAU, d = rr(2.7, 3.2) * s; K.geo('mossy', rockG(rr(0.2, 0.35) * s, 0.6, 0), Math.cos(a) * d, y0 + 0.4 * s, Math.sin(a) * d); }
  buildMerged(sb.g, g, true, true);
  // 룬 홈 (자기 재질 · 빛 세기 = k)
  sb = new LB(1e9); B = sb; K = new G.Kit(sb);
  const zAt = yy => (hwB + (hwT - hwB) * (yy - ph) / mh) * dz;
  for (const f of [1, -1]){ const rows = rec ? 7 : 4, rh = mh * 0.78 / rows;
    for (let j = 0; j < rows; j++){ const yc = ph + mh * 0.12 + (j + 0.5) * rh; K.push(0, yc, f * zAt(yc), f > 0 ? 0 : Math.PI, -tilt);
      if (rec){ for (let q = 0; q < 3; q++) K.box('glowC', rr(0.15, 0.35) * s, 0.04 * s, 0.03, (q - 1) * 0.42 * s, rr(-0.05, 0.05) * s, 0.015); }
      else { const gw = rh * 0.75; if (R() < 0.8) K.box('glowC', 0.06 * s, gw, 0.03, 0, 0, 0.015); for (let q = 0; q < 2 + (R() * 2 | 0); q++){ const ang = pick([0, 0.75, -0.75, Math.PI / 2]), len = rr(0.22, 0.4) * s; K.box('glowC', 0.055 * s, len, 0.03, rr(-0.14, 0.14) * s, rr(-0.18, 0.18) * gw, 0.015, 0, 0, ang); } }
      K.pop(); }
    K.push(0, ph + mh * 0.92, f * zAt(ph + mh * 0.92), f > 0 ? 0 : Math.PI, -tilt); K.geo('glowC', tor(0.16 * s, 0.025 * s, 3, 14), 0, 0, 0.02); K.pop(); }
  for (const [rx, yy, rz, a] of RS){ K.push(rx, yy, rz, -a - Math.PI / 2); K.box('glowC', 0.05 * s, 0.3 * s, 0.03, 0, 0, 0.22 * s); K.pop(); }
  K.geo('glowC', tor(2.85 * s, 0.05, 3, 40), 0, y0 + 0.42 * s, 0, Math.PI / 2);
  const runeMat = std({ color: 0x1a2028, emissive: 0x3fe6ff, emissiveIntensity: 0.05, roughness: 0.4 }); OWN.push(runeMat);
  { const list = []; for (const kk in sb.g) for (const gg of sb.g[kk]) list.push(gg); const m = meshOf(mergeG(list), runeMat, false); g.add(m); }
  // 가시 덩굴 (빛이 들면 줄어들어 사라져요) — 받침 높이를 축으로 키를 줄여요
  sb = new LB(1e9); B = sb; K = new G.Kit(sb);
  for (let v = 0; v < 3; v++){ const pts = [], a0 = v * 2.1 + R(); for (let i = 0; i <= 7; i++){ const yy = ph - 0.2 + i / 7 * mh * 0.85, a = a0 + i * 1.05, r = (hwB + (hwT - hwB) * (yy - ph) / mh) * 1.15 + 0.12 * s; pts.push([Math.cos(a) * r, yy, Math.sin(a) * r * Math.max(dz * 1.6, 0.7)]); } thornVine(pts, 0.16 * s, 0.05 * s, 10); }
  for (let v = 0; v < 4; v++){ const a = v / 4 * TAU + R(), r0 = 0.6 * s, r1 = 2.4 * s; thornVine([[Math.cos(a) * r0, ph - 0.1, Math.sin(a) * r0], [Math.cos(a + 0.4) * (r0 + r1) / 2, y0 + 0.7 * s, Math.sin(a + 0.4) * (r0 + r1) / 2], [Math.cos(a + 0.7) * r1, y0 + 0.3 * s, Math.sin(a + 0.7) * r1]], 0.12 * s, 0.04 * s, 5); }
  for (let i = 0; i < 5; i++){ const a = R() * TAU, d = rr(1.0, 2.0) * s; K.geo('crystalP', new THREE.OctahedronGeometry(rr(0.15, 0.3) * s, 0), Math.cos(a) * d, y0 + 0.6 * s, Math.sin(a) * d, R(), R(), R(), 0.7, 1.8, 0.7); }
  const vg = new THREE.Group(); vg.position.y = y0; const vin = new THREE.Group(); vin.position.y = -y0; vg.add(vin); buildMerged(sb.g, vin, false, true); g.add(vg);
  // 빛 · 빛기둥 · 떠오르는 빛가루
  const spr = X.glowSprite(0x6af0ff, 7 * s, 0); spr.position.set(0, ph + mh * 0.62, 0); g.add(spr);
  const pm = new THREE.MeshBasicMaterial({ color: 0x8af4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: DS, fog: false });
  const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.7 * s, 1.5 * s, 150, 12, 1, true).translate(0, 75 + ph + mh, 0), pm); pil.position.set(x, 0, z); pil.visible = false; pil.renderOrder = 4; pil.frustumCulled = false; FW.add(pil);
  CUR.near = g; const mo = G.particles(LOW ? 14 : 28, [new V3(0, y0 + 0.5 * s, 0)], { parent: g, vert: `float life = fract(uTime * 0.25 + aSeed); vL = life; float an = aSeed * 40.0; vec3 p = position + vec3(cos(an) * (1.2 + life) * ${(2.2 * s).toFixed(2)}, life * ${(6 * s).toFixed(1)}, sin(an) * (1.2 + life) * ${(2.2 * s).toFixed(2)}); float sz = 0.16;`,
    frag: `float a = smoothstep(0.5, 0.0, d) * (1.0 - vL) * smoothstep(0.0, 0.15, vL); gl_FragColor = vec4(vec3(0.5, 0.95, 1.0) * a * 1.5, a);` }); mo.visible = false;
  F.circle(x, z, 2.5 * s);
  Object.assign(o, { runeMat, vg, spr, pil, pm, mo });
  g.setLit = kk => ksApply(o, kk); g.userData.keystone = k.id; Object.defineProperty(g, 'lit', { get: () => o.k });
  g.visible = false; FW.add(g); KSS.push(o); KBY[k.id] = o; PILLARS.push(o);
  COLREC = null; B = K = null; CUR = null; STATS.keystones++;
  ksApply(o, 0);
}
function ksApply(o, k){
  o.k = k = clamp(+k || 0, 0, 1);
  o.runeMat.emissiveIntensity = 0.05 + 2.6 * k; o.runeMat.color.setRGB(lerp(0.1, 0.05, k), lerp(0.12, 0.2, k), lerp(0.15, 0.24, k));
  const sh = Math.max(0.001, 1 - k); o.vg.scale.set(lerp(1, 0.6, k), sh, lerp(1, 0.6, k)); o.vg.visible = k < 0.995;
  o.spr.material.opacity = k * 0.6; o.pil.visible = k > 0.5 && !o.hidden; o.pm.opacity = (k - 0.5) * 2 * 0.16; o.mo.visible = k > 0.25;
}
for (const L of LORE){ if (!L || !L.keystone || !Array.isArray(L.keystone.c) || KBY[L.keystone.id]) continue; try { bKeystone(L); } catch (e){ console.warn('[towns] 수호석 실패', L.keystone.id, e); COLREC = null; B = K = null; CUR = null; } }

// ───────────────────────── 먼 실루엣 · 빛 점 · 발판 ─────────────────────────
if (FARL.length){ const g = G.mergeGeos(FARL.map(x => x)); for (const name of ['color', 'aEmi', 'aT']){ let n = 0; for (const q of FARL) n += q.attributes[name].array.length; const arr = new Float32Array(n); let o = 0; for (const q of FARL){ arr.set(q.attributes[name].array, o); o += q.attributes[name].array.length; } g.setAttribute(name, new THREE.BufferAttribute(arr, name === 'color' ? 3 : 1)); }
  const m = meshOf(g, FARMAT); m.name = 'town_far'; m.frustumCulled = false; FW.add(m); }
buildGlows();
if (PLAT.length) F.groundFn = townGround;
SA.t.needsUpdate = true;
F.addCollider = _addCol; STATS.colliders = MYCOL.length;

// ───────────────────────── 이야기 변화 (정착지 쪽) ─────────────────────────
// e = 정점 발광 묶음 번호 (uGrp) · g = 빛 점 묶음 (uOn) · groups = 켜고 끄는 장식 묶음
const CHG = {
  swamp_lanterns: { e: 0, g: 1, k: 0, tgt: 0, groups: () => [], at: () => ['t_stilt'] },
  dust_lively: { e: 1, g: 2, k: 0, tgt: 0, groups: () => [TBY.t_dust && TBY.t_dust.chg.dust], at: () => ['t_dust'] },
  festival: { e: 2, g: 3, k: 0, tgt: 0, groups: () => [TBY.village && TBY.village.chg.festival, TBY.t_farm && TBY.t_farm.chg.festival], at: () => ['village', 't_farm'] },
};
function applyChg(c){
  VU.uGrp.value[c.e] = c.k; GON[c.g] = c.k;
  const sc = c.k >= 0.999 ? 1 : c.tgt > 0.5 ? easeOB(c.k) : c.k;
  for (const g of c.groups()) if (g){ g.visible = c.k > 0.002; g.scale.setScalar(Math.max(0.002, sc)); }
}
function setChange(key, on, instant){
  const c = CHG[key]; if (!c) return false;
  c.tgt = on ? 1 : 0;
  if (instant){ c.k = c.tgt; c.anim = false; applyChg(c); return true; }
  c.anim = true;
  if (on && F.inField) for (const id of c.at()){ const t = TBY[id]; if (!t || Math.hypot(X.player.pos.x - t.x, X.player.pos.z - t.z) > 160) continue; try { for (let i = 0; i < 5; i++) X.burst(new V3(t.x + rr(-t.r, t.r) * 0.5, rr(2, 5), t.z + rr(-t.r, t.r) * 0.5), key === 'swamp_lanterns' ? 0x9aff70 : 0xffd080, 14, 2.2, 0.2, 1.2, -1, 2); } catch (e){} }
  return true;
}
for (const k in CHG) applyChg(CHG[k]);

// ───────────────────────── 지도 · 이름표 · 처음 오면 알림 ─────────────────────────
const TINFO = {};
for (const t of TOWNS) TINFO[t.id] = { id: t.id, name: t.name, en: t.en, desc: t.desc, c: [t.x, t.z], r: t.r, region: t.region, style: t.style, existing: t.existing, lore: t.L, get seen(){ return !!S.towns.seen[t.id]; } };
const LIST = TOWNS.filter(t => !t.existing).map(t => TINFO[t.id]);
const LABELS = {};
for (const t of TOWNS){ if (t.existing || !F.label) continue; LABELS[t.id] = F.label({ pos: new V3(t.x, Math.max(t.top, t.y + 10) + 2.5, t.z), text: `🏘 ${t.name}`, cls: 'place', max: 320 }); LABELS[t.id].hidden = true; }
function drawTowns(ctx, k){
  const pp = X.player.pos;
  ctx.save(); ctx.fillStyle = 'rgba(120,96,70,.95)'; ctx.strokeStyle = 'rgba(30,20,10,.6)'; ctx.lineWidth = 0.4;
  for (const t of TOWNS){ if (t.hidden || Math.abs(t.x - pp.x) > 260 || Math.abs(t.z - pp.z) > 260) continue; for (const [x, z, hw, hd, ry] of t.mapbox){ ctx.save(); ctx.translate(x * k, z * k); ctx.rotate(-ry); ctx.fillRect(-hw * k, -hd * k, hw * 2 * k, hd * 2 * k); ctx.strokeRect(-hw * k, -hd * k, hw * 2 * k, hd * 2 * k); ctx.restore(); } }
  ctx.restore();
  const ms = 1.3 / ((F.area && F.area.mapZoom) || 5);
  for (const t of TOWNS){ if (t.existing || t.hidden) continue; const d = Math.hypot(t.x - pp.x, t.z - pp.z); if (d > 420) continue;
    ctx.save(); ctx.translate(t.x * k, t.z * k); ctx.rotate(-G.camYaw); ctx.scale(ms, ms); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '13px sans-serif'; ctx.fillText('🏘', 0, -8); ctx.font = "700 10px 'Gowun Batang'"; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,14,8,.85)'; ctx.strokeText(t.name, 0, 8); ctx.fillStyle = '#fff3d6'; ctx.fillText(t.name, 0, 8); ctx.restore(); }
}
if (F.area){ const prevDraw = F.area.mapDraw || null; F.area.mapDraw = (ctx, k) => { if (prevDraw) prevDraw(ctx, k); drawTowns(ctx, k); }; }
function enterTown(t){
  const first = !S.towns.seen[t.id], now = performance.now();
  if (first){ S.towns.seen[t.id] = Date.now(); X.save(); }
  if (first || now - (t.lastNote || -1e9) > 120000){ t.lastNote = now;
    F.note(`🏘 <b>${t.name}</b>${t.en ? ` <span style="opacity:.75;font:700 10px 'Cinzel';letter-spacing:.2em">${t.en.toUpperCase()}</span>` : ''}`, first ? 4.6 : 2.8);
    if (first && t.desc) F.note(`<span style="font-weight:500">${t.desc}</span>`, 5.5); }
  BUS.emit('town', { id: t.id, first });
}

// ───────────────────────── 매 프레임 ─────────────────────────
let cullT = 0, visT = 0, envT = 0, nightK = 0;
const ACTIVE = [];
function cull(px, pz){
  ACTIVE.length = 0;
  for (const t of TOWNS){ if (!t.near) continue; const d = Math.hypot(px - t.x, pz - t.z), near = !t.hidden && d < t.nearR; t.near.visible = near; if (t.farIdx >= 0) FARH[t.farIdx] = near || t.hidden ? 1 : 0; t.active = near && d < 175; t.d = d; if (t.active) ACTIVE.push(t);
    const cast = near && d < (LOW ? 70 : 110); if (cast !== t.castOn){ t.castOn = cast; for (const m of t.casters) m.castShadow = cast; }
    const det = d < (LOW ? 95 : 125); if (det !== t.detailOn){ t.detailOn = det; for (const o of t.detail) o.visible = det; } }
  for (const o of KSS){ const d = Math.hypot(px - o.x, pz - o.z); o.g.visible = !o.hidden && d < 290; o.active = o.g.visible && d < 170; o.d = d; }
  const ls = []; for (const id in LABELS){ const t = TBY[id]; LABELS[id].hidden = true; if (!t.hidden && t.d > t.r * 0.9 && t.d < 300) ls.push(t); }
  ls.sort((a, b) => a.d - b.d); for (let i = 0; i < Math.min(2, ls.length); i++){ const t = ls[i]; LABELS[t.id].hidden = false; LABELS[t.id].set(`🏘 ${t.name}`, `${Math.round(t.d)}m`); }
}
function visits(px, pz){ if (X.tpBusy || X.dead) return; for (const t of TOWNS){ if (t.existing || t.hidden) continue; const d = Math.hypot(px - t.x, pz - t.z); if (d < t.r && !t.inside){ t.inside = true; enterTown(t); } else if (d > t.r + 10) t.inside = false; } }
const nightTarget = () => { if (typeof F.timeOfDay === 'number'){ const k = Math.abs(F.timeOfDay - 0.5) * 2; return clamp((k - 0.4) / 0.2, 0, 1); } if (typeof F.isNight === 'function') return F.isNight() ? 1 : 0; return 0; };
G.hooks.push((dt, rdt) => {
  if (!F.inField) return;
  TU.value += dt;
  const px = X.player.pos.x, pz = X.player.pos.z;
  cullT -= rdt; if (cullT <= 0){ cullT = 0.25; cull(px, pz); }
  visT -= rdt; if (visT <= 0){ visT = 0.4; visits(px, pz); }
  for (const t of ACTIVE) for (const f of t.anims) f(dt, TU.value);
  for (const o of KSS){ if (!o.active || o.k <= 0) continue; o.runeMat.emissiveIntensity = (0.05 + 2.6 * o.k) * (0.85 + 0.15 * Math.sin(TU.value * 2.1 + o.x)); }
  for (const key in CHG){ const c = CHG[key]; if (!c.anim) continue; const sp = c.tgt > c.k ? 0.45 : 0.8; c.k = c.tgt > c.k ? Math.min(c.tgt, c.k + rdt * sp) : Math.max(c.tgt, c.k - rdt * sp); applyChg(c); if (c.k === c.tgt) c.anim = false; }
  nightK += (nightTarget() - nightK) * Math.min(1, rdt * 1.5); VU.uNight.value = nightK;
  const us = innerHeight * G.renderer.getPixelRatio() * 0.5 / Math.tan(G.camera.fov * Math.PI / 360);
  if (glowPts) glowPts.material.uniforms.uScale.value = us; RGMAT.uniforms.uScale.value = us; for (const m of RGU) m.uniforms.uScale.value = us;
  for (const o of PILLARS){ if (!o.pil.visible) continue; const d = Math.hypot(px - o.x, pz - o.z); o.pm.opacity = (o.k - 0.5) * 2 * (0.08 + 0.12 * nightK) * clamp((d - 20) / 70, 0.2, 1); }
  envT -= rdt; if (envT <= 0){ envT = 1; const e = G.M.stone.envMapIntensity ?? 1; for (const m of OWN) m.envMapIntensity = e; }
});
// 처음 필드에 들어올 때 내 셰이더를 미리 컴파일 (가까이 갈 때 끊기지 않게)
let compiled = false;
function precompile(){
  if (compiled) return; compiled = true;
  try { for (const t of TOWNS) if (t.near) t.near.visible = true; for (const o of KSS) o.g.visible = true; for (const k in CHG) for (const g of CHG[k].groups()) if (g){ g.userData.v = g.visible; g.visible = true; }
    G.renderer.compile(FW, G.camera, G.scene); }
  catch (e){ console.warn('[towns] 미리 컴파일 실패', e); }
  for (const k in CHG) for (const g of CHG[k].groups()) if (g) g.visible = !!g.userData.v;
  cull(X.player.pos.x, X.player.pos.z);
}
BUS.on('enterField', () => { cullT = 0; precompile(); });
BUS.on('leaveField', () => { for (const id in LABELS) LABELS[id].hidden = true; });

// ───────────────────────── API ─────────────────────────
function setCols(list, on){ for (const c of list){ if (on){ if (!c._cells) F.addCollider(c); } else if (c._cells) F.removeCollider(c); } }
F.towns = {
  obj(id){ const t = TBY[id]; if (t) return t.near; const r = RBY[id]; if (r) return r.obj; const k = KBY[id]; if (k) return k.g; return null; },
  pos(id){ const t = TBY[id]; if (t) return [t.x, t.y, t.z]; const r = RBY[id]; if (r) return [r.x, r.y, r.z]; const k = KBY[id]; if (k) return [k.x, k.y, k.z]; return null; },
  show(id, on = true){
    const t = TBY[id]; if (t){ t.hidden = !on; setCols(t.cols, on); cullT = 0; return true; }
    const r = RBY[id]; if (r){ r.hidden = !on; RHIDE[r.idx] = on ? 0 : 1; setCols(r.cols, on); rdGlow(r, r.glow); r.obj.visible = on; return true; }
    const k = KBY[id]; if (k){ k.hidden = !on; setCols(k.cols, on); ksApply(k, k.k); cullT = 0; return true; }
    return false;
  },
  setChange,
  settlementAt(x, z){ let best = null, bk = 1e9; for (const t of TOWNS){ const k = Math.hypot(x - t.x, z - t.z) / t.r; if (k < 1 && k < bk){ bk = k; best = t; } } return best ? TINFO[best.id] : null; },
  info: id => TINFO[id] || null,
  list: LIST,
  changes: () => Object.fromEntries(Object.entries(CHG).map(([k, c]) => [k, c.tgt > 0.5])),
  readables: () => RDS.map(r => r.id), keystones: () => KSS.map(o => o.id),
  platformY: platY,
  __fails: () => Object.fromEntries(TOWNS.filter(t => t.fails).map(t => [t.id, t.fails])),
};
const ms = Math.round(performance.now() - T0); TIMES.sort((a, b) => b[1] - a[1]);
STATS.tris.total = Math.round(TRIS); STATS.ms = ms; STATS.failed = FAILED; STATS.slow = TIMES.slice(0, 4).map(t => t.join(':')).join(' ');
console.log(`[towns] 정착지 ${STATS.towns} · 읽을거리 ${STATS.readables} · 수호석 ${STATS.keystones} · 충돌체 ${STATS.colliders} · 빛 ${STATS.glows} · 발판 ${STATS.platforms} · 삼각형 ${STATS.tris.total} · ${ms}ms (${STATS.slow})` + (FAILED.length ? ` · 빠짐: ${FAILED.join(', ')}` : ''));
F.townStats = STATS; F.towns.stats = STATS;
return F.towns;
}
