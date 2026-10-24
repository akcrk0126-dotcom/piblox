// 룬 아고라 — 모험의 대지: 랜드마크 (agora-landmarks.js)
// 새싹 마을 · 37개 랜드마크 구조물 · 이정표 · 사냥터 표지판 · 길가 소품 · 발견(discover) 처리
// 계약서: docs/agora-modules.md — 필드 물체는 F.FW 에 절대 y (= F.H(x, z)) 로 넣어요.
// 랜드마크마다 두 단계로 그려요: 가까이(near) = 텍스처 묶음별 병합 + 그림자 / 멀리(far) = 큰 조각만 정점색 실루엣 (지역마다 한 메시, 셰이더로 숨김).
// 길가 소품은 200m 칸으로 묶어 정점색 한 덩어리로 병합하고, 거리로 켜고 꺼요.
// F 에 올리는 것: F.landmarkAt(x, z) · F.discovered(id) · F.raidPortalPos[raidId] = [x, z] · F.lmStats / BUS 'discover' { id, name, kind:'landmark' }
// 걸을 수 있는 판(판자길 · 그루터기 윗면 · 전망대 · 다리 · 밧줄 다리)은 F.groundFn 을 감싸서 올려요. 저장: S.lm.disc[id] = 발견 시각
export async function init(G, X, F){
const { THREE, V3, BUS, TAU } = X;
const W = F.WORLD, S = X.S, FW = F.FW, WL = W.water, byId = F.byId;
const LOW = G.gfxMode === 'low' || G.IS_TOUCH;
const T0 = performance.now();
S.lm = Object.assign({ disc: {} }, S.lm || {});
const STATS = { landmarks: 0, props: 0, colliders: 0, glows: 0, platforms: 0 };
// 이 모듈이 넣은 충돌체 기록 (점검용) — init 이 끝나면 원래대로 돌려놔요
const MYCOL = [], _addCol = F.addCollider; F.addCollider = c => { MYCOL.push(c); return _addCol(c); };

// ───────────────────────── 결정적 난수 (불러올 때마다 같은 모양) ─────────────────────────
let _s = 1;
const srand = s => { _s = (s >>> 0) || 1; };
const R = () => { _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rr = (a, b) => a + (b - a) * R(), pick = a => a[(R() * a.length) | 0];
const hashS = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// ───────────────────────── 높이 · 길 · 물 ─────────────────────────
const H = (x, z) => F.H(x, z);
// 회전된 사각형 발자국의 [최저, 최고] 지면 높이
function foot(x, z, hw, hd, ry = 0){
  const c = Math.cos(ry), s = Math.sin(ry); let lo = 1e9, hi = -1e9;
  for (let a = -1; a <= 1; a += 0.5) for (let b = -1; b <= 1; b += 0.5){ const lx = a * hw, lz = b * hd, h = H(x + lx * c + lz * s, z - lx * s + lz * c); if (h < lo) lo = h; if (h > hi) hi = h; }
  return [lo, hi];
}
function footC(x, z, r){ let lo = H(x, z), hi = lo; for (let i = 0; i < 12; i++){ const a = i / 12 * TAU; for (const k of [0.5, 1]){ const h = H(x + Math.cos(a) * r * k, z + Math.sin(a) * r * k); if (h < lo) lo = h; if (h > hi) hi = h; } } return [lo, hi]; }
// 길까지 거리 (중심선 - 반폭)
const SEGS = [];
for (const rd of W.roads) for (let i = 0; i < rd.pts.length - 1; i++){ const [ax, az] = rd.pts[i], [bx, bz] = rd.pts[i + 1]; SEGS.push({ ax, az, ex: bx - ax, ez: bz - az, l2: (bx - ax) ** 2 + (bz - az) ** 2, w: rd.w, rd }); }
function roadD(x, z){ let best = 1e9; for (const s of SEGS){ const t = clamp(((x - s.ax) * s.ex + (z - s.az) * s.ez) / s.l2, 0, 1), d = Math.hypot(x - s.ax - s.ex * t, z - s.az - s.ez * t) - s.w / 2; if (d < best) best = d; } return best; }
const wy = (x, z) => F.waterY ? F.waterY(x, z) : WL;   // 그 자리 수면 (world: 산속 호수는 더 높아요)
const wet = (x, z) => F.isWater ? (F.isWater(x, z) || F.isWater(x + 2.5, z) || F.isWater(x - 2.5, z) || F.isWater(x, z + 2.5) || F.isWater(x, z - 2.5)) : H(x, z) < WL + 0.15;
const slope = (x, z) => F.slope ? F.slope(x, z) : 0;
// 비워 둘 곳: NPC · 룬 비석 · 낚시터
const KEEP = [...W.npcs.map(n => [n.c[0], n.c[1], 3.2]), ...W.waypoints.map(w => [w.c[0], w.c[1], 5]), ...W.fishing.map(f => [f.c[0], f.c[1], 3.5])];
const kept = (x, z, r = 0) => KEEP.some(([a, b, k]) => Math.hypot(x - a, z - b) < k + r);
const nearLm = (x, z, pad = 0) => W.landmarks.some(l => Math.hypot(x - l.c[0], z - l.c[1]) < l.r + pad);

// ───────────────────────── 지오메트리 도우미 ─────────────────────────
const cyl = (rt, rb, h, s = 10, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
const cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
const sph = (r, ws = 10, hs = 8) => new THREE.SphereGeometry(r, ws, hs);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const tor = (r, t, rs = 6, ts = 16, arc = TAU) => new THREE.TorusGeometry(r, t, rs, ts, arc);
const plane = (w, h) => new THREE.PlaneGeometry(w, h);
const uvm = (g, su, sv = su) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; };
const cylM = (rt, rb, h, s = 10, open = false) => uvm(cyl(rt, rb, h, s, open), TAU * Math.max(rt, rb), h);
const lathe = (pts, seg = 24, us = 1) => G.latheG(pts, seg, us);
function triG(a, b, c){ const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([a[0] + a[2], a[1], b[0] + b[2], b[1], c[0] + c[2], c[1]], 2)); g.computeVertexNormals(); return g; }
// 울퉁불퉁한 바위 (정점 흔들기)
function rockG(r, sy = 0.8, det = 1){ const g = ico(r, det), p = g.attributes.position, k = R() * 100; for (let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + 0.22 * Math.sin(x * 3.1 + k) * Math.cos(z * 2.7 + k) + 0.1 * Math.sin(y * 5 + k); p.setXYZ(i, x * n, y * n * sy, z * n); } g.computeVertexNormals(); return g; }
// 휘어진 관 (뿌리 · 덩굴 · 갈비뼈): pts [[x,y,z]…], 반지름 r0 → r1
function tubeG(pts, r0, r1 = r0, seg = 7, div = 10){
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new V3(...p))), g = new THREE.TubeGeometry(curve, Math.max(4, pts.length * div / 2 | 0), 1, seg, false);
  const p = g.attributes.position, nrm = g.attributes.normal, n = Math.max(4, pts.length * div / 2 | 0), cs = seg + 1;
  for (let i = 0; i <= n; i++){ const c = curve.getPointAt(i / n), r = lerp(r0, r1, i / n); for (let j = 0; j < cs; j++){ const k = i * cs + j; p.setXYZ(k, c.x + nrm.getX(k) * r, c.y + nrm.getY(k) * r, c.z + nrm.getZ(k) * r); } }
  uvm(g, (pts.length) * 2, r0 * 4); return g;
}
// 땅에 깔리는 판 (광장 · 웅덩이): 수평 지오메트리의 정점 y 를 지형에 맞춰요 (ox, oz = 그룹 원점)
function drape(g, ox, oz, dy = 0.06){ const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, H(ox + p.getX(i), oz + p.getZ(i)) + dy); g.computeVertexNormals(); return g; }
const meterUV = g => { const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), p.getZ(i)); return g; };

// ───────────────────────── 재질 ─────────────────────────
const std = o => G.std(Object.assign({ roughness: 0.85 }, o));
const T = G.T, TX = X.TX;
const MAT = Object.assign({}, G.M, X.MATS2);
const OWN = [];   // 내가 만든 재질 (환경광 세기 맞춤)
const add = (k, m) => { MAT[k] = m; OWN.push(m); return m; };
const canvasTex = (w, h, fn, rep = 1) => { const c = G.cnv(w, h), x = c.getContext('2d'); fn(x, w, h); return G.tex(c, true, rep, rep); };
// 나무 나이테 (그루터기 윗면)
const ringTex = canvasTex(512, 512, (x, w) => { x.fillStyle = '#c8a070'; x.fillRect(0, 0, w, w); for (let r = 250; r > 4; r -= 5 + Math.random() * 7){ x.strokeStyle = `rgba(${90 + (r % 3) * 10},${60 + (r % 5) * 4},30,${0.35 + Math.random() * 0.3})`; x.lineWidth = 1.5 + Math.random() * 2.5; x.beginPath(); x.ellipse(256, 256, r, r * (0.96 + Math.random() * 0.06), Math.random(), 0, TAU); x.stroke(); } x.fillStyle = 'rgba(60,35,15,.5)'; for (let i = 0; i < 9; i++){ x.save(); x.translate(256, 256); x.rotate(Math.random() * TAU); x.fillRect(10, -1.5, 240, 3); x.restore(); } });
ringTex.wrapS = ringTex.wrapT = THREE.ClampToEdgeWrapping; ringTex.repeat.set(1, 1);
// 줄무늬 바위 (협곡 지층)
const strataTex = canvasTex(256, 256, (x, w) => { for (let y = 0; y < w; y += 4){ const k = 0.75 + 0.25 * Math.sin(y * 0.11) + Math.random() * 0.08; x.fillStyle = `rgb(${180 * k | 0},${96 * k | 0},${60 * k | 0})`; x.fillRect(0, y, w, 4); } for (let i = 0; i < 900; i++){ x.fillStyle = `rgba(${Math.random() < 0.5 ? '60,30,20' : '230,170,120'},.18)`; x.fillRect(Math.random() * w, Math.random() * w, 2 + Math.random() * 6, 1 + Math.random() * 2); } }, 1 / 6);
add('redrock', std({ map: TX.redrock, roughness: 0.95 }));
add('strata', std({ map: strataTex, roughness: 0.92 }));
add('sandst', std({ map: T.stone, color: 0xe0a878, roughness: 0.92 }));
add('mossy', std({ map: T.stone, color: 0x7e9a6a, roughness: 0.95 }));
add('ruin', std({ map: T.stone, color: 0xb8b0a0, roughness: 0.92 }));
add('darkst', std({ map: T.stone, color: 0x5a5660, roughness: 0.9 }));
add('snow', std({ color: 0xeef4fa, roughness: 0.8 }));
add('ice', std({ color: 0xa8dcf4, roughness: 0.1, metalness: 0.15, emissive: 0x2a6a9a, emissiveIntensity: 0.4, flatShading: true }));
add('bone', std({ color: 0xe8dcc0, roughness: 0.7 }));
add('boneD', std({ color: 0xbcae8c, roughness: 0.8 }));
add('thorn', std({ color: 0x1e1626, roughness: 0.4, metalness: 0.25, flatShading: true }));
add('thornR', std({ color: 0x3a1a3a, roughness: 0.5, flatShading: true }));
add('fabricR', std({ color: 0xb02a2a, roughness: 0.9, side: THREE.DoubleSide }));
add('fabricB', std({ color: 0x2a4a9a, roughness: 0.9, side: THREE.DoubleSide }));
add('fabricY', std({ color: 0xe0b030, roughness: 0.9, side: THREE.DoubleSide }));
add('fabricG', std({ color: 0x2f7a46, roughness: 0.9, side: THREE.DoubleSide }));
add('fabricW', std({ color: 0xf0e8d8, roughness: 0.9, side: THREE.DoubleSide }));
add('fabricP', std({ color: 0x6a2a8a, roughness: 0.9, side: THREE.DoubleSide }));
add('leafA', std({ color: 0x4a8a34, roughness: 0.85, flatShading: true }));
add('leafB', std({ color: 0x3a7030, roughness: 0.85, flatShading: true }));
add('leafC', std({ color: 0x66a040, roughness: 0.85, flatShading: true }));
add('pink', std({ color: 0xf4a8c0, roughness: 0.8, flatShading: true }));
add('bark2', std({ map: T.wood, color: 0x5a3e28, roughness: 0.95 }));
add('stumpTop', std({ map: ringTex, roughness: 0.9 }));
add('water', X.water());
add('jelly', std({ color: 0x6ad0ff, roughness: 0.15, transparent: true, opacity: 0.78, emissive: 0x1a5a8a, emissiveIntensity: 0.5 }));
add('jellyG', std({ color: 0x7af090, roughness: 0.15, transparent: true, opacity: 0.8, emissive: 0x1a7a3a, emissiveIntensity: 0.5 }));
add('brass', std({ color: 0xc89a48, roughness: 0.3, metalness: 0.9 }));
add('rust', std({ color: 0x6a4030, roughness: 0.8, metalness: 0.5 }));
add('feather', std({ color: 0x8a6a4a, roughness: 0.9, side: THREE.DoubleSide }));
add('egg', std({ color: 0xf2eadc, roughness: 0.5 }));
add('cabbage', std({ color: 0x8acb5a, roughness: 0.7, flatShading: true }));
add('carrot', std({ color: 0xe8781a, roughness: 0.7 }));
add('soil', std({ map: TX.dirt, roughness: 1 }));
add('cobble', std({ map: T.cobble, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
add('pathD', std({ map: TX.dirt, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
add('sandD', std({ map: TX.sand, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
// 빛나는 것 (emissive) — 먼 실루엣에서도 빛나요
add('glowC', std({ color: 0x0a2a30, emissive: 0x3fe6ff, emissiveIntensity: 2.2 }));        // 룬 (청록)
add('glowG', std({ color: 0x0a2a10, emissive: 0x6aff8a, emissiveIntensity: 2.0 }));        // 늪 · 요정
add('glowP', std({ color: 0x200a2a, emissive: 0xb44aff, emissiveIntensity: 2.2 }));        // 가시
add('glowB', std({ color: 0x0a1a2a, emissive: 0x8ad8ff, emissiveIntensity: 2.0 }));        // 얼음
add('glowO', std({ color: 0x2a1000, emissive: 0xffa040, emissiveIntensity: 2.4 }));        // 등불 · 용광로
add('glowY', std({ color: 0x2a2000, emissive: 0xffe070, emissiveIntensity: 2.4 }));        // 등대 · 별
add('glowM', std({ color: 0x2a1a2a, emissive: 0xff9ae0, emissiveIntensity: 1.6 }));        // 요정 버섯
add('crystal', std({ color: 0xb8f4ff, emissive: 0x30c8e0, emissiveIntensity: 1.6, roughness: 0.08, flatShading: true }));
add('crystalP', std({ color: 0xd8a8ff, emissive: 0x8a30e0, emissiveIntensity: 1.8, roughness: 0.08, flatShading: true }));
add('ore', std({ color: 0xffd080, emissive: 0xff9a20, emissiveIntensity: 1.2, roughness: 0.2, flatShading: true }));
for (const k of ['fabricR', 'fabricB', 'fabricY', 'fabricG', 'fabricW', 'fabricP', 'feather']) MAT[k].userData.noCast = false;
const NOCAST = new Set(['glass', 'lamp', 'ember', 'water', 'jelly', 'jellyG', 'cobble', 'pathD', 'sandD', 'glowC', 'glowG', 'glowP', 'glowB', 'glowO', 'glowY', 'glowM', 'stumpTop', 'soil']);

// 텍스처 평균색 (먼 실루엣 정점색) — 캔버스를 읽으면 느려서 미리 재 둔 값을 써요
const _avg = new Map(), TAVG = [[T.marble, 231, 227, 219], [T.stone, 163, 153, 138], [T.plaster, 225, 219, 206], [T.roof, 123, 57, 34], [T.wood, 163, 137, 104], [T.cobble, 150, 144, 134], [T.grass, 84, 109, 47],
  [G.M.slate && G.M.slate.map, 81, 88, 100], [G.M.shingle && G.M.shingle.map, 109, 76, 50], [G.M.thatch && G.M.thatch.map, 123, 98, 55], [G.M.frieze && G.M.frieze.map, 180, 175, 166], [G.M.hill && G.M.hill.map, 84, 109, 47],
  [G.M.awnR && G.M.awnR.map, 203, 132, 118], [G.M.awnB && G.M.awnB.map, 134, 147, 164], [G.M.awnG && G.M.awnG.map, 134, 155, 110], [G.M.awnY && G.M.awnY.map, 147, 86, 29],
  [TX.dirt, 114, 93, 68], [TX.sand, 199, 172, 124], [TX.mud, 79, 62, 45], [TX.leaves, 170, 91, 40], [TX.petals, 192, 164, 153], [TX.moss, 73, 101, 60], [TX.heather, 126, 101, 118], [TX.redrock, 173, 105, 65], [TX.darksoil, 55, 44, 33], [TX.meadow, 144, 187, 104],
  [ringTex, 196, 156, 104], [strataTex, 160, 88, 55]];
for (const [t, r, g, b] of TAVG) if (t) _avg.set(t, new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace));
for (let i = 0; i < 6; i++) if (G.M['sign' + i] && G.M['sign' + i].map) _avg.set(G.M['sign' + i].map, new THREE.Color().setRGB(0.43, 0.32, 0.19, THREE.SRGBColorSpace));
const _gray = new THREE.Color().setRGB(0.62, 0.6, 0.57, THREE.SRGBColorSpace);
const texAvg = t => !t ? null : _avg.get(t) || _gray;
// 재질 → 정점색. tex = 텍스처를 쓰는 병합 재질이면 재질 색만 (텍스처가 무늬를 줘요), 아니면 텍스처 평균색까지 곱해요
const _cc = {};
function colOf(key, tex = false){
  const ck = key + (tex ? '+' : ''); if (_cc[ck]) return _cc[ck];
  const m = MAT[key] || MAT.stone, c = new THREE.Color(1, 1, 1); let emi = 0;
  if (m.emissive && m.emissiveIntensity * Math.max(m.emissive.r, m.emissive.g, m.emissive.b) > 0.85){ c.copy(m.emissive).multiplyScalar(Math.min(1.2, m.emissiveIntensity * 0.55)); emi = 1; }
  else { if (m.color) c.copy(m.color); if (!tex){ const a = texAvg(m.map); if (a) c.multiply(a); } }
  return (_cc[ck] = { c, emi });
}

// ───────────────────────── 병합 빌더 ─────────────────────────
// G.Kit 이 부르는 add(key, geo, m) 를 받아요. fm 보다 큰 조각은 먼 실루엣 목록에도 넣어요.
class LB {
  constructor(fm = 1.1){ this.g = {}; this.fm = fm; this.far = []; }
  add(key, geo, m){
    const g = geo.index ? geo.toNonIndexed() : geo; if (g !== geo) geo.dispose(); g.applyMatrix4(m);
    (this.g[key] = this.g[key] || []).push(g);
    if (this.fm < 1e8){ g.computeBoundingBox(); const b = g.boundingBox, d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].sort((p, q) => q - p); if (d[1] >= this.fm) this.far.push([key, g]); }
  }
}
// 정점색 + 정점 발광(aEmi) 재질: 같은 텍스처를 쓰는 재질들을 한 메시로 합쳐 드로콜을 줄여요
const VCM = new Map();
function vcMat(map, flat = false, metal = false){
  const k = (map ? map.uuid : '-') + (flat ? 'f' : '') + (metal ? 'm' : ''); if (VCM.has(k)) return VCM.get(k);
  const m = std({ map: map || null, vertexColors: true, flatShading: flat, roughness: metal ? 0.35 : 0.86, metalness: metal ? 0.7 : 0, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute float aEmi;\nvarying float vEmi;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvEmi = aEmi;');
    sh.fragmentShader = 'varying float vEmi;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += vColor.rgb * vEmi * 1.6;');
  };
  m.customProgramCacheKey = () => 'lmvc';
  OWN.push(m); VCM.set(k, m); return m;
}
// [[key, geo]] → 하나의 지오메트리 (color + aEmi). tex: 텍스처 병합용 색 (colOf 참고)
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
const PROPMAT = vcMat(grainTex);
// 먼 실루엣: 지역마다 한 메시로 합치고, 가까이 그리는 랜드마크 부분만 셰이더에서 숨겨요 (aLm = 랜드마크 번호)
const FARH = new Float32Array(48), FARU = { value: FARH };
const FARMAT = (() => { const m = std({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => { sh.uniforms.uHide = FARU;
    sh.vertexShader = 'attribute float aEmi;\nattribute float aLm;\nuniform float uHide[48];\nvarying float vEmi;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvEmi = aEmi;').replace('#include <project_vertex>', '#include <project_vertex>\n\tif (uHide[int(aLm + 0.5)] > 0.5) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);');
    sh.fragmentShader = 'varying float vEmi;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += vColor.rgb * vEmi * 1.6;'); };
  m.customProgramCacheKey = () => 'lmfar'; OWN.push(m); return m; })();
const FARB = new Map();   // 지역 → [지오메트리]
// 따로 그려야 하는 재질 (투명 · 애니메이션 · 바닥 판 · 글자판)
const SOLO = new Set(['capP', 'capC', 'capV', 'water', 'jelly', 'jellyG', 'goo', 'gooG', 'gooP', 'blightD', 'cobble', 'pathD', 'sandD', 'signA', 'campA', 'boards', 'ice']);
const meshOf = (geo, m, cast = false) => { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = true; o.matrixAutoUpdate = false; return o; };

// ───────────────────────── 공용 셰이더 (포털 · 물줄기 · 룬 바닥) ─────────────────────────
const TU = { value: 0 };   // 내 시간 (가까운 것만 움직여요)
function portalMat(c1, c2){
  return new THREE.ShaderMaterial({ uniforms: { uTime: TU, uA: { value: new THREE.Color(c1) }, uB: { value: new THREE.Color(c2) } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uA, uB; varying vec2 vU;
      void main(){ vec2 p = vU * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
        float sw = sin(a * 3.0 + r * 9.0 - uTime * 2.6) * 0.5 + 0.5, sw2 = sin(a * 5.0 - r * 14.0 + uTime * 1.7) * 0.5 + 0.5;
        float edge = smoothstep(1.0, 0.82, r), core = smoothstep(0.7, 0.0, r);
        vec3 c = mix(uA, uB, sw * 0.7 + sw2 * 0.3) * (0.55 + 0.6 * sw) + vec3(1.0) * core * 0.35;
        float al = edge * (0.45 + 0.4 * sw + core * 0.5); gl_FragColor = vec4(c * al, al); }` });
}
// 아치형 포털 (아래 사각 + 위 반원): uv 원을 위쪽으로 늘린 모양
function portalGeo(w, h, ah = w / 2){ const s = new THREE.Shape(), r = w / 2; s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - ah); s.absellipse(0, h - ah, r, ah, 0, Math.PI, false); s.lineTo(-r, 0); const g = new THREE.ShapeGeometry(s, 24), uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h); return g; }
const streakMat = new THREE.ShaderMaterial({ uniforms: { uTime: TU }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uTime; varying vec2 vU; float h(float x){ return fract(sin(x * 91.7) * 43758.5); }
    void main(){ float id = floor(vU.x * 6.0), s = 0.5 + 0.5 * fract(vU.y * 2.0 + uTime * (0.8 + h(id) * 0.8) + h(id) * 5.0);
      float e = smoothstep(0.0, 0.25, vU.x) * smoothstep(1.0, 0.75, vU.x) * smoothstep(0.0, 0.08, vU.y) * smoothstep(1.0, 0.9, vU.y);
      gl_FragColor = vec4(mix(vec3(0.6, 0.85, 1.0), vec3(1.0), s * 0.5), (0.25 + 0.4 * s) * e); }` });
const runeRingMat = (col, seed = 3, n = 16) => { const m = X.ADDM(G.tex(G.runeStrip(1024, 128, n, col, 0, seed), true, 1, 1), 0.85); m.toneMapped = false; return m; };
const runeColMat = (col, seed = 3) => { const m = X.ADDM(G.tex(G.runeColumn(128, 1024, 8, col, seed), true, 1, 1), 0.95); m.toneMapped = false; return m; };

// ───────────────────────── 빛 점 (등불 · 룬 · 창문) — 밤에 밝아져요. 전부 한 드로콜 ─────────────────────────
const GLOW = { p: [], c: [], s: [], d: [] };
const _gc = new THREE.Color();
function glowAbs(x, y, z, col = 0xffb050, size = 2.2, day = 0.35){ _gc.set(col); GLOW.p.push(x, y, z); GLOW.c.push(_gc.r, _gc.g, _gc.b); GLOW.s.push(size); GLOW.d.push(day); }
let glowPts = null;
function buildGlows(){
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(GLOW.p, 3)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(GLOW.c, 3)); g.setAttribute('aSize', new THREE.Float32BufferAttribute(GLOW.s, 1)); g.setAttribute('aDay', new THREE.Float32BufferAttribute(GLOW.d, 1));
  const m = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 400 }, uNight: { value: 0 }, uTime: TU }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `attribute vec3 aCol; attribute float aSize, aDay; uniform float uScale, uNight, uTime; varying vec3 vC; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z; float k = mix(aDay, 1.0, uNight);
        vA = k * (0.85 + 0.15 * sin(uTime * 3.0 + position.x * 1.7 + position.z)) * smoothstep(900.0, 300.0, d); vC = aCol;
        gl_Position = projectionMatrix * mv; gl_PointSize = max(aSize * uScale / d * (0.6 + 0.6 * uNight), 1.5 * uNight); }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a = a * a * vA; gl_FragColor = vec4(vC * a * 1.4, a); }` });
  glowPts = new THREE.Points(g, m); glowPts.frustumCulled = false; FW.add(glowPts); STATS.glows = GLOW.s.length;
}

// ───────────────────────── 걸어 올라가는 판 (판자길 · 그루터기 · 전망대 …) ─────────────────────────
// { x0, z0, x1, z1 } AABB + y(x, z) → 높이 | null. F.groundFn 을 감싸서 땅보다 높으면 그 위를 걸어요.
const PLAT = [];
const platY = (x, z) => { let b = -1e9; for (const p of PLAT){ if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue; const y = p.y(x, z); if (y != null && y > b) b = y; } return b; };
// 다른 모듈이 나중에 F.groundFn 을 다시 감싸도 무한히 돌지 않게 (다시 들어오면 원래 땅을 돌려줘요)
const origGround = F.groundFn; let baseGround = origGround, inGround = false;
const myGround = (x, z) => { if (inGround) return origGround(x, z); inGround = true; try { const g = baseGround(x, z), y = platY(x, z); return y > g ? y : g; } finally { inGround = false; } };
function wrapGround(){ if (F.groundFn !== myGround){ baseGround = F.groundFn; F.groundFn = myGround; } }
// 선분 판 (폭 w, 높이 y0→y1)
function platSeg(ax, az, bx, bz, w, y0, y1 = y0){
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez, pad = w / 2 + 0.2;
  PLAT.push({ x0: Math.min(ax, bx) - pad, x1: Math.max(ax, bx) + pad, z0: Math.min(az, bz) - pad, z1: Math.max(az, bz) + pad,
    y: (x, z) => { const t = ((x - ax) * ex + (z - az) * ez) / l2; if (t < -0.02 || t > 1.02) return null; const tt = clamp(t, 0, 1); return Math.hypot(x - ax - ex * tt, z - az - ez * tt) <= w / 2 ? lerp(y0, y1, tt) : null; } });
  STATS.platforms++;
}
function platCirc(x, z, r, y){ PLAT.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r, y: (px, pz) => Math.hypot(px - x, pz - z) <= r ? y : null }); STATS.platforms++; }

// ───────────────────────── 랜드마크 빌드 틀 ─────────────────────────
// 현재 빌드 대상: K (G.Kit), B (LB), OX/OZ (그룹 원점 = 랜드마크 중심), CUR (랜드마크 기록)
let K = null, B = null, OX = 0, OZ = 0, CUR = null, WLL = WL;   // WLL = 지금 짓는 랜드마크 자리의 수면
const LMS = [];
const kitYaw = () => { const e = K.top().elements; return Math.atan2(e[8], e[10]); };
const gy = (x, z) => H(OX + x, OZ + z);                       // 그룹 로컬 (x, z) 의 지면
const gyk = (x, z) => { const v = K.world(x, z); return H(OX + v.x, OZ + v.z); };   // Kit 로컬
const cc = (x, z, r) => { const v = K.world(x, z); F.circle(OX + v.x, OZ + v.z, r); STATS.colliders++; };
const cb = (x, z, hw, hd, ry = 0) => { const v = K.world(x, z); F.box(OX + v.x, OZ + v.z, hw, hd, kitYaw() + ry); STATS.colliders++; };
const glow = (x, y, z, col, size, day) => { const v = new V3(x, y, z).applyMatrix4(K.top()); glowAbs(OX + v.x, v.y, OZ + v.z, col, size, day); };
const kpt = (x, y, z) => new V3(x, y, z).applyMatrix4(K.top());   // Kit 로컬 → 그룹 로컬
// 두 점을 잇는 막대 (리본 · 밧줄 · 뼈대)
function link(key, a, b, w = 0.1, h = w){ const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], hl = Math.hypot(dx, dz), L = Math.hypot(hl, dy); K.push((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, Math.atan2(dx, dz)); K.box(key, w, h, L, 0, 0, 0, -Math.atan2(dy, hl)); K.pop(); }
function begin(id, x, z, o = {}){
  srand(hashS(id)); B = new LB(o.fm ?? 1.1); K = new G.Kit(B); OX = x; OZ = z; WLL = wy(x, z);
  const near = new THREE.Group(); near.position.set(x, 0, z); near.name = 'lm_' + id;
  CUR = { id, x, z, near, far: null, anims: [], smoke: [], nearR: o.nearR || 175, animR: o.animR || 220, top: 0, active: false, lm: o.lm || null };
  return CUR;
}
// 재질별 지오메트리 → 텍스처 묶음마다 한 메시 (재질이 하나뿐인 묶음은 원래 재질 그대로)
function buildMerged(g, parent){
  const groups = new Map();
  for (const key in g){
    const mt = MAT[key]; if (!mt){ console.warn('[landmarks] 재질 없음', key); continue; }
    if (SOLO.has(key) || mt.transparent || !mt.isMeshStandardMaterial){ parent.add(meshOf(G.mergeGeos(g[key]), mt, !NOCAST.has(key) && !mt.transparent)); continue; }
    const emi = colOf(key, true).emi, gk = emi ? 'emi' : (mt.map ? mt.map.uuid : 'plain') + (mt.flatShading ? 'f' : '') + (mt.metalness > 0.5 ? 'm' : '');
    let gr = groups.get(gk); if (!gr) groups.set(gk, gr = { keys: [], map: emi ? null : mt.map, flat: !emi && mt.flatShading, metal: !emi && mt.metalness > 0.5, cast: false }); gr.keys.push(key); if (!NOCAST.has(key)) gr.cast = true;
  }
  for (const [gk, gr] of groups){
    if (gr.keys.length === 1 && gk !== 'emi'){ const key = gr.keys[0]; parent.add(meshOf(G.mergeGeos(g[key]), MAT[key], gr.cast)); continue; }
    const list = []; for (const key of gr.keys) for (const geo of g[key]) list.push([key, geo]);
    parent.add(meshOf(mergeVC(list, 0.03, !!gr.map), vcMat(gr.map, gr.flat, gr.metal), gr.cast && gk !== 'emi'));
  }
}
function finish(){
  const L = CUR;
  L.idx = LMS.length;
  if (B.far.length && L.idx < 48){ const fg = mergeVC(B.far, 0.04); fg.translate(L.near.position.x, 0, L.near.position.z); fg.setAttribute('aLm', new THREE.BufferAttribute(new Float32Array(fg.attributes.position.count).fill(L.idx), 1));
    const rk = (L.lm && L.lm.region) || 'misc'; if (!FARB.has(rk)) FARB.set(rk, []); FARB.get(rk).push(fg); L.far = true; FARH[L.idx] = 1; }
  buildMerged(B.g, L.near);
  if (L.smoke.length) smokeFx(L.near, L.smoke);
  const bb = new THREE.Box3().setFromObject(L.near); L.top = isFinite(bb.max.y) ? bb.max.y : H(L.x, L.z) + 5;
  L.near.visible = false; FW.add(L.near); LMS.push(L); STATS.landmarks++;
  B = K = null; CUR = null; return L;
}
const anim = fn => CUR.anims.push(fn);
// 따로 움직이는 메시 (그룹 로컬 좌표)
function part(geo, mt, x = 0, y = 0, z = 0, parent){ const m = new THREE.Mesh(geo, typeof mt === 'string' ? MAT[mt] : mt); m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = true; (parent || CUR.near).add(m); return m; }
// 굴뚝 연기 · 불티 (그룹 로컬)
function smokeFx(parent, pts, col = '0.78, 0.77, 0.76'){
  if (LOW && pts.length > 2) pts = pts.slice(0, 2);
  G.particles(pts.length * (LOW ? 10 : 18), pts, { parent,
    vert: `float life = fract(uTime * 0.11 * (0.8 + 0.4 * fract(aSeed * 3.1)) + aSeed); vL = life;
      vec3 p = position + vec3(life * 3.0 + sin(aSeed * 30.0 + uTime * 0.6) * life, life * 7.0, life * 1.5 + cos(aSeed * 21.0) * life * 1.2); float sz = 0.8 + life * 4.5;`,
    frag: `float a = smoothstep(0.5, 0.05, d) * smoothstep(0.0, 0.12, vL) * (1.0 - vL) * 0.26; gl_FragColor = vec4(vec3(${col}), a);`, blend: THREE.NormalBlending });
}
function sparkFx(parent, pts, col = '1.0, 0.6, 0.2', n = 14, rise = 3.0){
  G.particles(pts.length * n, pts, { parent,
    vert: `float life = fract(uTime * (0.4 + 0.3 * fract(aSeed * 5.3)) + aSeed); vL = life; float an = aSeed * 47.0;
      vec3 p = position + vec3(sin(an + uTime * 1.3) * life * 0.8, life * ${rise.toFixed(1)}, cos(an * 1.3 + uTime) * life * 0.8); float sz = 0.12;`,
    frag: `float a = smoothstep(0.5, 0.1, d) * (1.0 - vL); gl_FragColor = vec4(vec3(${col}) * a * 2.0, a);` });
}
// 떠다니는 빛 (반딧불 · 요정 · 포자): 중심 c, 반경 r
function motesFx(parent, c, r, n, col = '0.7, 1.0, 0.6', h = 3, sz = 0.14){
  const bases = []; for (let i = 0; i < n; i++){ const a = R() * TAU, d = Math.sqrt(R()) * r; bases.push(new V3(c[0] + Math.cos(a) * d, c[1] + rr(0.3, h), c[2] + Math.sin(a) * d)); }
  G.particles(n, bases, { parent, vert: `vec3 p = position + vec3(sin(uTime * 0.5 + aSeed * 50.0) * 1.4, sin(uTime * 0.8 + aSeed * 31.0) * 0.5, cos(uTime * 0.4 + aSeed * 70.0) * 1.4); vL = pow(0.5 + 0.5 * sin(uTime * (1.5 + fract(aSeed * 4.0) * 2.0) + aSeed * 90.0), 2.0); float sz = ${sz.toFixed(2)};`,
    frag: `float a = smoothstep(0.5, 0.0, d) * vL; gl_FragColor = vec4(vec3(${col}) * a * 1.4, a);` });
}
// 깃발 (펄럭임) — 큰 깃발만 (그룹 로컬)
const FLAGS = [];
function flag(x, y, z, ry, w, h, mt, parent){
  const geo = new THREE.PlaneGeometry(w, h, 8, 2); geo.translate(w / 2, -h / 2, 0); const pa = geo.attributes.position;
  const m = new THREE.Mesh(geo, MAT[mt] || mt); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; (parent || CUR.near).add(m);
  const base = Float32Array.from(pa.array), seed = R() * 10;
  CUR.anims.push((dt, t) => { for (let i = 0; i < pa.count; i++){ const bx = base[i * 3], k = bx / w; pa.setZ(i, Math.sin(t * 3.2 + bx * 1.6 + seed) * 0.28 * k + Math.sin(t * 5.1 + base[i * 3 + 1] * 2 + seed) * 0.06 * k); } pa.needsUpdate = true; });
  return m;
}
// ───────────────────────── 소품 (현재 K 에 그려요 · y 는 절대 높이) ─────────────────────────
const PAINT = ['pBlue', 'pGreen', 'pRed', 'pTeal'], WALL = ['plaster', 'plaster', 'plaster2', 'plaster3'];
const P = {
  barrel(x, y, z, s = 1){ K.geo('wood', lathe([[0, 0], [0.3 * s, 0], [0.36 * s, 0.22 * s], [0.38 * s, 0.45 * s], [0.36 * s, 0.68 * s], [0.3 * s, 0.9 * s], [0, 0.9 * s]], 12, 0.4), x, y, z); for (const h of [0.18, 0.72]) K.geo('iron', tor(0.365 * s, 0.02, 4, 14), x, y + h * s, z, Math.PI / 2); },
  crate(x, y, z, s = 0.7, ry = 0){ K.box('crate', s, s, s, x, y + s / 2, z, 0, ry); K.box('beam', s + 0.02, 0.06, s + 0.02, x, y + s * 0.5, z, 0, ry); },
  sack(x, y, z, ry = 0){ K.geo('sack', sph(0.3, 8, 6), x, y + 0.24, z, 0, ry, 0, 1, 0.85, 0.75); },
  clutter(x, z, n, r = 0.9){ for (let i = 0; i < n; i++){ const a = R() * TAU, d = R() * r, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, y = gyk(px, pz), t = R(); if (t < 0.4) P.barrel(px, y, pz); else if (t < 0.8){ const s = rr(0.5, 0.75); P.crate(px, y, pz, s, R()); if (R() < 0.4) P.crate(px, y + s, pz, s * 0.7, R()); } else P.sack(px, y, pz, R() * 3); } cc(x, z, r * 0.8 + 0.4); },
  hay(x, z, ry = 0){ const y = gyk(x, z); K.geo('hay', cylM(0.75, 0.75, 1.3, 14), x, y + 0.72, z, Math.PI / 2, ry, 0); cc(x, z, 0.9); },
  hayStack(x, z){ const y = gyk(x, z); K.geo('hay', cylM(1.0, 1.15, 1.3, 12), x, y + 0.6, z); K.geo('hay', uvm(cone(1.1, 1.0, 12), 6, 1), x, y + 1.7, z); cc(x, z, 1.2); },
  // 울타리 (지형 따라)
  fence(x0, z0, x1, z1, o = {}){
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / (o.gap || 2.2))), key = o.key || 'wood', h = o.h || 1.0, pts = [];
    for (let i = 0; i <= n; i++){ const t = i / n, x = lerp(x0, x1, t), z = lerp(z0, z1, t); pts.push([x, gyk(x, z), z]); }
    for (const [x, y, z] of pts){ K.box(key, 0.13, h + 0.3, 0.13, x, y + (h + 0.3) / 2 - 0.25, z, 0, R() * 0.3, rr(-0.06, 0.06)); if (o.cap) K.geo(o.cap, cone(0.12, 0.2, 4), x, y + h + 0.12, z, 0, Math.PI / 4, 0); }
    for (let i = 0; i < n; i++){ const [ax, ay, az] = pts[i], [bx, by, bz] = pts[i + 1], hl = Math.hypot(bx - ax, bz - az), len = Math.hypot(hl, by - ay), yaw = Math.atan2(bx - ax, bz - az), pit = -Math.atan2(by - ay, hl);
      K.push((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, yaw); for (const hh of (o.rails || [0.4, 0.8])) K.box(key, 0.06, 0.1, len + 0.1, 0, hh * h, 0, pit); K.pop(); }
    if (o.col !== false){ const yaw = Math.atan2(x1 - x0, z1 - z0); K.push((x0 + x1) / 2, 0, (z0 + z1) / 2, yaw); cb(0, 0, 0.15, L / 2); K.pop(); }
  },
  bench(x, z, ry = 0){ const y = gyk(x, z); K.push(x, y, z, ry); K.box('wood', 1.8, 0.08, 0.45, 0, 0.45, 0); K.box('wood', 1.8, 0.4, 0.06, 0, 0.75, -0.2, -0.15); for (const s of [-1, 1]) K.box('iron', 0.06, 0.45, 0.42, s * 0.75, 0.22, 0); K.pop(); },
  table(x, z, ry = 0){ const y = gyk(x, z); K.push(x, y, z, ry); K.box('wood', 1.6, 0.08, 0.9, 0, 0.78, 0); for (const sx of [-0.65, 0.65]) for (const sz of [-0.35, 0.35]) K.box('woodD', 0.08, 0.78, 0.08, sx, 0.39, sz); for (const s of [-1, 1]) K.box('wood', 1.6, 0.06, 0.3, 0, 0.45, s * 0.75);
    K.geo('wood', cylM(0.08, 0.07, 0.18, 8), -0.3, 0.9, 0.1); K.geo('glass', cyl(0.06, 0.06, 0.04, 8), -0.3, 0.97, 0.1); K.geo('bread', sph(0.12, 8, 6), 0.3, 0.86, -0.1, 0, 0, 0, 1.4, 0.7, 1); K.pop(); cc(x, z, 1.0); },
  // 등불 기둥: style = village | wood | stone | swamp | iron | crystal | snow
  lamp(x, z, style = 'wood', ry = 0){
    const y = gyk(x, z); K.push(x, y, z, ry);
    if (style === 'village'){ K.geo('stone', cylM(0.22, 0.28, 0.5, 8), 0, 0.25, 0); K.geo('iron', cyl(0.07, 0.09, 3.2, 8), 0, 1.9, 0); K.box('iron', 0.7, 0.06, 0.06, 0.28, 3.3, 0); K.geo('iron', cone(0.24, 0.22, 4), 0.55, 3.25, 0, 0, Math.PI / 4, 0); K.box('lamp', 0.26, 0.34, 0.26, 0.55, 2.98, 0); K.box('iron', 0.3, 0.04, 0.3, 0.55, 2.8, 0); glow(0.55, 3.0, 0, 0xffb860, 3.4, 0.3); }
    else if (style === 'stone'){ K.box('mossy', 0.7, 0.2, 0.7, 0, 0.1, 0); K.geo('mossy', cyl(0.14, 0.18, 0.9, 6), 0, 0.65, 0); K.box('stone', 0.6, 0.45, 0.6, 0, 1.32, 0); K.geo('stoneD', cone(0.55, 0.4, 4), 0, 1.75, 0, 0, Math.PI / 4, 0); K.box('lamp', 0.3, 0.25, 0.62, 0, 1.32, 0); glow(0, 1.32, 0, 0xffd080, 2.4, 0.3); }
    else if (style === 'swamp'){ K.geo('woodD', cyl(0.07, 0.11, 2.6, 6), 0, 1.25, 0, 0.12, 0, 0.08); K.box('woodD', 0.55, 0.06, 0.06, 0.25, 2.45, 0.1, 0, 0, -0.2); K.box('glowG', 0.22, 0.28, 0.22, 0.48, 2.12, 0.1); K.geo('iron', cone(0.2, 0.16, 4), 0.48, 2.32, 0.1, 0, Math.PI / 4, 0); glow(0.48, 2.12, 0.1, 0x9aff70, 2.6, 0.5); }
    else if (style === 'iron'){ K.geo('rust', cyl(0.06, 0.1, 2.4, 6), 0, 1.2, 0); K.geo('iron', lathe([[0, 0], [0.35, 0.05], [0.42, 0.3], [0, 0.3]], 10, 0.4), 0, 2.4, 0); K.geo('glowO', cone(0.26, 0.5, 6), 0, 2.85, 0); glow(0, 2.85, 0, 0xff8a30, 3.2, 0.55); }
    else if (style === 'crystal'){ K.box('darkst', 0.5, 0.3, 0.5, 0, 0.15, 0); K.geo('darkst', cyl(0.12, 0.16, 1.4, 5), 0, 1.0, 0); K.geo('crystalP', new THREE.OctahedronGeometry(0.3, 0), 0, 2.0, 0, 0, 0, 0, 0.8, 1.5, 0.8); glow(0, 2.0, 0, 0xc070ff, 2.6, 0.6); }
    else if (style === 'snow'){ K.box('stone', 0.7, 0.2, 0.7, 0, 0.1, 0); K.geo('stone', cyl(0.14, 0.18, 0.9, 6), 0, 0.65, 0); K.box('stone', 0.6, 0.45, 0.6, 0, 1.32, 0); K.geo('snow', cone(0.6, 0.45, 4), 0, 1.78, 0, 0, Math.PI / 4, 0); K.box('glowB', 0.3, 0.25, 0.62, 0, 1.32, 0); glow(0, 1.32, 0, 0x9fdcff, 2.4, 0.4); }
    else { K.geo('woodD', cyl(0.06, 0.08, 2.6, 6), 0, 1.3, 0); K.box('woodD', 0.5, 0.06, 0.06, 0.2, 2.55, 0); K.box('lamp', 0.22, 0.3, 0.22, 0.42, 2.3, 0); K.geo('iron', cone(0.2, 0.16, 4), 0.42, 2.5, 0, 0, Math.PI / 4, 0); glow(0.42, 2.3, 0, 0xffa848, 2.6, 0.3); }
    K.pop(); cc(x, z, 0.3);
  },
  campfire(x, z, sparks = true){
    const y = gyk(x, z); for (let i = 0; i < 9; i++){ const a = i / 9 * TAU; K.geo('rock', ico(0.22, 0), x + Math.cos(a) * 0.75, y + 0.1, z + Math.sin(a) * 0.75, R(), R(), R()); }
    for (let i = 0; i < 4; i++){ const a = i / 4 * TAU + 0.4; K.geo('woodD', cyl(0.07, 0.08, 1.0, 6), x + Math.cos(a) * 0.25, y + 0.35, z + Math.sin(a) * 0.25, Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55); }
    K.geo('ember', new THREE.CircleGeometry(0.42, 10).rotateX(-Math.PI / 2), x, y + 0.08, z); K.geo('glowO', cone(0.3, 0.7, 6), x, y + 0.45, z); glow(x, y + 0.6, z, 0xff8a30, 4, 0.75); cc(x, z, 0.95);
    if (sparks && CUR) CUR.sparks = (CUR.sparks || []).concat([kpt(x, y + 0.5, z)]);
  },
  tent(x, z, ry = 0, key = 'tentA', r = 2.2){ const y = gyk(x, z); K.push(x, y, z, ry); K.geo(key, cone(r, r * 1.25, 6, 1, true), 0, r * 0.62, 0); K.geo('woodD', cyl(0.05, 0.05, r * 1.5, 5), 0, r * 0.75, 0); K.geo('dark', plane(r * 0.45, r * 0.7), 0, r * 0.35, r * 0.72, -0.35, 0, 0); K.pop(); cc(x, z, r); },
  cart(x, z, ry = 0, load = 'hay'){
    const y = gyk(x, z); K.push(x, y, z, ry);
    K.box('wood', 1.6, 0.12, 2.6, 0, 0.75, 0); for (const s of [-1, 1]){ K.box('wood', 0.08, 0.45, 2.6, s * 0.8, 1.0, 0); K.geo('woodD', cyl(0.5, 0.5, 0.1, 12), s * 0.9, 0.5, 0.3, 0, 0, Math.PI / 2); K.geo('iron', tor(0.5, 0.03, 4, 14), s * 0.95, 0.5, 0.3, 0, Math.PI / 2, 0); }
    for (const s of [-1, 1]) K.box('woodD', 0.08, 0.08, 1.8, s * 0.35, 0.65, 2.1, 0.2);
    if (load === 'hay') K.geo('hay', sph(0.8, 10, 6), 0, 1.1, 0, 0, 0, 0, 0.9, 0.5, 1.4);
    else if (load === 'barrel'){ P.barrel(-0.35, 0.81, -0.6); P.barrel(0.35, 0.81, -0.6); P.crate(0, 0.81, 0.5, 0.65, 0.3); }
    else if (load === 'ore'){ for (let i = 0; i < 8; i++) K.geo(i < 2 ? 'ore' : 'rock', ico(0.25, 0), rr(-0.5, 0.5), 0.95, rr(-1, 1), R(), R(), R()); }
    else if (load === 'apples'){ K.box('crate', 1.4, 0.3, 2.3, 0, 0.95, 0); for (let i = 0; i < 18; i++) K.geo(R() < 0.7 ? 'fruitR' : 'fruitG', sph(0.11, 6, 4), rr(-0.6, 0.6), 1.15, rr(-1.0, 1.0)); }
    K.pop(); cb(x, z, 1.0, 1.6, ry);
  },
  well(x, z){ const y = gyk(x, z); K.push(x, y, z); K.geo('stone', lathe([[0.9, 0], [1.0, 0], [1.0, 0.9], [0.8, 0.9], [0.8, 0.2], [0, 0.2]], 18, 0.5)); K.geo('water', new THREE.CircleGeometry(0.8, 16).rotateX(-Math.PI / 2), 0, 0.5, 0);
    for (const s of [-1, 1]) K.box('woodD', 0.14, 2.2, 0.14, s * 0.85, 1.4, 0); K.box('woodD', 1.9, 0.12, 0.12, 0, 2.3, 0); K.geo('rope', cyl(0.02, 0.02, 1.3, 4), 0, 1.65, 0); K.box('wood', 0.3, 0.3, 0.3, 0, 1.05, 0);
    for (const s of [-1, 1]) K.box('shingle', 2.4, 0.08, 1.15, 0, 2.6, s * 0.48, s * 0.55); K.pop(); cc(x, z, 1.15); },
  pillar(x, z, h = 4, broken = false, key = 'ruin'){ const y = gyk(x, z) - 0.2; K.box(key, 1.3, 0.4, 1.3, x, y + 0.2, z); K.geo(key, cylM(0.42, 0.48, h, 12), x, y + 0.4 + h / 2, z); if (!broken) K.box(key, 1.2, 0.35, 1.2, x, y + 0.6 + h, z); else K.geo(key, cone(0.44, 0.5, 7), x + 0.05, y + 0.4 + h + 0.1, z, rr(-0.3, 0.3), 0, rr(-0.4, 0.4)); cc(x, z, 0.75); },
  fallen(x, z, ry, key = 'ruin'){ const y = gyk(x, z); K.geo(key, cylM(0.44, 0.47, 3.8, 12), x, y + 0.35, z, 0, ry, Math.PI / 2 + 0.05); K.push(x, 0, z, ry); cb(0, 0, 1.9, 0.5); K.pop(); },
  boulder(x, z, s = 1, key = 'rock'){ const y = gyk(x, z); K.geo(key, rockG(s, 0.75), x, y + s * 0.35, z, 0, R() * TAU, 0); cc(x, z, s * 0.9); },
  cairn(x, z, h = 1.6, key = 'stone'){ const y = gyk(x, z); let yy = y; for (let i = 0; i < 5; i++){ const s = (1 - i / 6) * h * 0.32; K.geo(key, rockG(s, 0.55, 0), x + rr(-0.05, 0.05), yy + s * 0.4, z + rr(-0.05, 0.05), 0, R() * 3, 0); yy += s * 0.75; } cc(x, z, h * 0.3); },
  shrine(x, z, ry = 0, glowCol = 0xffd080){ const y = gyk(x, z); K.push(x, y, z, ry); K.box('stone', 1.4, 0.3, 1.2, 0, 0.15, 0); K.box('stone', 0.9, 0.9, 0.8, 0, 0.75, 0); K.box('dark', 0.5, 0.5, 0.05, 0, 0.8, 0.41);
    for (const s of [-1, 1]) K.box('roof2', 1.3, 0.08, 0.75, 0, 1.38, s * 0.3, s * 0.55); K.geo('glowO', sph(0.08, 6, 4), 0, 0.72, 0.36); K.geo('flower', ico(0.08, 0), 0.25, 0.32, 0.5); K.geo('fruitR', sph(0.08, 6, 4), -0.25, 0.36, 0.48); K.pop(); glow(x, y + 0.8, z, glowCol, 1.6, 0.4); cc(x, z, 0.8); },
  statue(x, z, ry = 0, key = 'marble', h = 2.6){ const y = gyk(x, z); K.push(x, y, z, ry); K.box('stone', 1.4, 0.9, 1.4, 0, 0.45, 0); K.box('stone', 1.6, 0.15, 1.6, 0, 0.92, 0);
    const s = h / 2.6; K.geo(key, lathe([[0, 0], [0.5, 0], [0.42, 0.9], [0.3, 1.5], [0.34, 1.75], [0, 1.8]], 10, 0.4), 0, 1.0, 0, 0, 0, 0, s, s, s); K.geo(key, sph(0.26, 10, 8), 0, 1.0 + 2.05 * s, 0); for (const sd of [-1, 1]) K.geo(key, cyl(0.09, 0.1, 0.9 * s, 6), sd * 0.38 * s, 1.0 + 1.35 * s, 0.05, 0.3, 0, sd * 0.3); K.pop(); cc(x, z, 0.85); },
  stoneCircle(x, z, r = 4, n = 7, key = 'mossy', glowCol = null){ for (let i = 0; i < n; i++){ const a = i / n * TAU + 0.3, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, y = gyk(px, pz) - 0.3, h = rr(1.6, 2.8); K.push(px, y, pz, -a, rr(-0.08, 0.08), rr(-0.06, 0.06)); K.geo(key, cyl(0.32, 0.5, h, 5), 0, h / 2, 0); if (glowCol && i % 2 === 0) K.box(glowCol, 0.12, h * 0.5, 0.05, 0, h * 0.5, 0.38); K.pop(); cc(px, pz, 0.5); } },
  log(x, z, ry, len = 2.4, r = 0.28){ const y = gyk(x, z); K.geo('bark2', cylM(r, r * 1.05, len, 9), x, y + r * 0.9, z, 0, ry, Math.PI / 2); K.push(x, 0, z, ry); cb(0, 0, len / 2, r + 0.05); K.pop(); },
  stump(x, z, r = 0.45){ const y = gyk(x, z); K.geo('bark2', cylM(r, r * 1.2, 0.6, 9), x, y + 0.25, z); K.geo('stumpTop', new THREE.CircleGeometry(r, 9).rotateX(-Math.PI / 2), x, y + 0.56, z); cc(x, z, r + 0.1); },
  mushrooms(x, z, n = 5, key = 'glowM'){ for (let i = 0; i < n; i++){ const px = x + rr(-1.2, 1.2), pz = z + rr(-1.2, 1.2), y = gyk(px, pz), s = rr(0.6, 1.3); K.geo('fabricW', cyl(0.04 * s, 0.06 * s, 0.35 * s, 6), px, y + 0.17 * s, pz); K.geo(key, sph(0.17 * s, 8, 5, 0, TAU, 0, Math.PI / 2), px, y + 0.33 * s, pz); } },
  banner(x, z, key = 'fabricR', h = 4.5, ry = 0){ const y = gyk(x, z); K.geo('woodD', cyl(0.07, 0.09, h, 6), x, y + h / 2, z); K.geo('gold', sph(0.11, 6, 4), x, y + h + 0.05, z); K.push(x, y, z, ry); K.box('woodD', 1.1, 0.06, 0.06, 0.5, h - 0.25, 0); K.geo(key, plane(0.9, 1.8), 0.5, h - 1.2, 0.05); K.geo(key, triG([0.05, h - 2.1, 0.05], [0.95, h - 2.1, 0.05], [0.5, h - 2.5, 0.05])); K.pop(); cc(x, z, 0.25); },
  skull(x, y, z, s = 1, ry = 0){ K.push(x, y, z, ry); K.geo('bone', sph(0.32 * s, 8, 6), 0, 0.3 * s, 0, 0, 0, 0, 1, 0.9, 1.15); K.box('bone', 0.3 * s, 0.18 * s, 0.3 * s, 0, 0.1 * s, 0.18 * s); for (const sd of [-1, 1]){ K.geo('dark', sph(0.07 * s, 6, 4), sd * 0.11 * s, 0.32 * s, 0.3 * s); K.geo('bone', cone(0.07 * s, 0.6 * s, 5), sd * 0.34 * s, 0.4 * s, 0.05 * s, 0, 0, -sd * 1.1); } K.pop(); },
  pennants(pts, sag = 1.2, keys = ['pen0', 'pen1', 'pen2', 'pen3']){ // 줄 + 삼각 깃발 (pts: [[x,y,z], [x,y,z]] 양 끝, 그룹 로컬)
    const [a, b] = pts, L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(3, Math.round(L / 0.75)), yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
    for (let i = 0; i < n; i++){ const t0 = i / n, t1 = (i + 1) / n, y0 = lerp(a[1], b[1], t0) - Math.sin(t0 * Math.PI) * sag, y1 = lerp(a[1], b[1], t1) - Math.sin(t1 * Math.PI) * sag, hl = L / n, len = Math.hypot(hl, y1 - y0);
      const mx = lerp(a[0], b[0], (t0 + t1) / 2), mz = lerp(a[2], b[2], (t0 + t1) / 2), my = (y0 + y1) / 2;
      K.push(mx, my, mz, yaw); K.box('rope', 0.02, 0.02, len, 0, 0, 0, -Math.atan2(y1 - y0, hl)); K.geo(keys[i % keys.length], triG([0, 0, -hl * 0.4], [0, 0, hl * 0.4], [0, -0.55, 0])); K.pop(); }
  },
};

// ───────────────────────── 글자판 아틀라스 (이정표 · 사냥터 표지판 · 마을 간판) ─────────────────────────
// 한 장의 캔버스에 칸을 나눠 그리고, 판마다 UV 만 바꿔요 → 재질 하나 = 드로콜 하나
function atlas(cw, ch, cols, rows){ const c = G.cnv(cw * cols, ch * rows), t = G.tex(c, true, 1, 1); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; let n = 0;
  return { c, x: c.getContext('2d'), t, cw, ch, cols, rows, next(){ const i = n++, col = i % cols, row = (i / cols) | 0; return { px: col * cw, py: row * ch, uv: [col / cols, 1 - (row + 1) / rows, (col + 1) / cols, 1 - row / rows] }; } }; }
const SA = atlas(512, 112, 4, 18), CA = atlas(512, 288, 4, 8);
add('signA', std({ map: SA.t, roughness: 0.85 })); add('campA', std({ map: CA.t, roughness: 0.85, emissive: 0xffffff, emissiveMap: CA.t, emissiveIntensity: 0.12 }));
const quadUV = (w, h, uv) => { const g = plane(w, h), a = g.attributes.uv; a.setXY(0, uv[0], uv[3]); a.setXY(1, uv[2], uv[3]); a.setXY(2, uv[0], uv[1]); a.setXY(3, uv[2], uv[1]); return g; };
const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0], NE: [0.707, -0.707], NW: [-0.707, -0.707], SE: [0.707, 0.707], SW: [-0.707, 0.707] };
const DIRK = { N: '북', S: '남', E: '동', W: '서', NE: '북동', NW: '북서', SE: '남동', SW: '남서' };
// 이정표 판 글자 (나무 바탕 · 화살표 쪽 오른쪽)
function signCell(text, dir, sub, flip = false){
  const s = SA.next(), x = SA.x, { px, py } = s, w = SA.cw, h = SA.ch;
  const g = x.createLinearGradient(0, py, 0, py + h); g.addColorStop(0, '#7a5434'); g.addColorStop(1, '#5a3a22'); x.fillStyle = g; x.fillRect(px, py, w, h);
  x.fillStyle = 'rgba(0,0,0,.14)'; for (let i = 0; i < 5; i++) x.fillRect(px, py + 14 + i * 22, w, 2);
  x.strokeStyle = '#c99a48'; x.lineWidth = 4; x.strokeRect(px + 6, py + 6, w - 12, h - 12);
  if (!dir){ x.fillStyle = '#f6e6be'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 5; x.font = '900 52px "Gowun Batang", serif'; x.fillText(text, px + w / 2, py + (sub ? 44 : h / 2 + 2), w - 40);
    if (sub){ x.shadowBlur = 0; x.fillStyle = '#e9c87e'; x.font = '700 20px "Cinzel", serif'; x.fillText(sub.split('').join(' '), px + w / 2, py + 88, w - 40); } x.shadowBlur = 0; return s.uv; }
  // flip: 뒷면용 — 화살표가 왼쪽을 가리켜요
  const L = flip ? px + w - 24 : px + 24, A = flip ? px + 58 : px + w - 58, Tip = flip ? px + 22 : px + w - 22, D = flip ? px + 72 : px + w - 72;
  x.fillStyle = '#f6e6be'; x.font = `900 ${text.length > 7 ? 40 : 48}px "Gowun Batang", serif`; x.textAlign = flip ? 'right' : 'left'; x.textBaseline = 'middle'; x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 5; x.fillText(text, L, py + h / 2 + 2, w - 130);
  x.shadowBlur = 0; x.fillStyle = '#e9c87e'; x.font = '700 22px "Noto Sans KR", sans-serif'; x.textAlign = flip ? 'left' : 'right'; x.fillText(DIRK[dir] || '', D, py + h / 2 + 2);
  x.beginPath(); x.moveTo(A, py + h / 2 - 20); x.lineTo(Tip, py + h / 2); x.lineTo(A, py + h / 2 + 20); x.closePath(); x.fill();
  return s.uv;
}
// 사냥터 표지판 (레벨대 색)
const BAND = lv => lv <= 6 ? ['#5ec85a', '#1e4a1e'] : lv <= 12 ? ['#4ac0d8', '#14404a'] : lv <= 18 ? ['#e8c040', '#4a3a10'] : lv <= 24 ? ['#f08a3a', '#4a2410'] : ['#e84a4a', '#4a1014'];
function campCell(c){
  const s = CA.next(), x = CA.x, { px, py } = s, w = CA.cw, h = CA.ch, [col, dk] = BAND(c.lv[1]);
  x.fillStyle = '#ece0c4'; x.fillRect(px, py, w, h); x.fillStyle = 'rgba(120,90,50,.12)'; for (let i = 0; i < 9; i++) x.fillRect(px, py + i * 32 + 8, w, 2);
  x.fillStyle = dk; x.fillRect(px, py, w, 78); x.fillStyle = col; x.fillRect(px, py + 72, w, 8);
  x.strokeStyle = '#3a2614'; x.lineWidth = 8; x.strokeRect(px + 4, py + 4, w - 8, h - 8);
  // 칼 두 자루 (사냥터 표시)
  x.save(); x.translate(px + 52, py + 40); x.strokeStyle = col; x.lineWidth = 6; x.lineCap = 'round'; for (const s2 of [-1, 1]){ x.save(); x.rotate(s2 * 0.75); x.beginPath(); x.moveTo(0, -24); x.lineTo(0, 20); x.moveTo(-9, 10); x.lineTo(9, 10); x.stroke(); x.restore(); } x.restore();
  x.fillStyle = '#fff3d6'; x.font = '700 30px "Gowun Batang", serif'; x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillText('사냥터', px + 92, py + 41);
  x.fillStyle = col; x.font = '900 34px "Noto Sans KR", sans-serif'; x.textAlign = 'right'; x.fillText(`Lv ${c.lv[0]}~${c.lv[1]}`, px + w - 22, py + 42);
  x.fillStyle = '#2a1a0c'; x.textAlign = 'center'; x.font = `900 ${c.name.length > 7 ? 46 : 54}px "Gowun Batang", serif`; x.fillText(c.name, px + w / 2, py + 150, w - 40);
  const mobs = c.mobs.map(m => MOBN[m[0]] || m[0]).join(' · '); x.fillStyle = '#6a4a2a'; x.font = '700 24px "Noto Sans KR", sans-serif'; x.fillText(mobs, px + w / 2, py + 214, w - 40);
  if (c.elite){ x.fillStyle = '#b02a2a'; x.font = '900 20px "Noto Sans KR", sans-serif'; x.fillText('⚠ 정예 출현 주의', px + w / 2, py + 254); }
  return s.uv;
}
const MOBN = { slime: '슬라임', sprout: '새싹이', bee: '꿀벌', ladybug: '무당벌레', flower: '꽃요정', shroom: '버섯', squirrel: '다람쥐', boar: '멧돼지', raccoon: '너구리', frog: '개구리', snail: '달팽이', mole: '두더지', golem: '골렘', owl: '부엉이', hedgehog: '고슴도치', wraith: '망령', wolf: '얼음 늑대', frostgolem: '서리 골렘', yeti: '설인' };

// ───────────────────────── 발견 (Discover) ─────────────────────────
const css = document.createElement('style');
css.textContent = `
  #lmfound { position:fixed; left:50%; top:24%; transform:translateX(-50%) translateY(10px); z-index:9; text-align:center; pointer-events:none; opacity:0; transition:opacity .9s, transform .9s; width:min(640px, 92vw); }
  #lmfound.on { opacity:1; transform:translateX(-50%) translateY(0); }
  #lmfound.low { top:6%; } #lmfound { transition:opacity .9s, transform .9s, top .6s; }
  #lmfound .k { font:700 12px 'Noto Sans KR'; letter-spacing:.42em; color:#8af4ff; text-shadow:0 0 10px rgba(80,230,255,.7), 0 1px 3px #000; }
  #lmfound .n { position:relative; display:inline-block; font:900 clamp(28px, 5.4vw, 48px) 'Gowun Batang'; color:#fff8e6; letter-spacing:.12em; margin:2px 0; text-shadow:0 2px 16px rgba(0,0,0,.8), 0 0 30px rgba(233,200,126,.35); }
  #lmfound .n::after { content:''; position:absolute; inset:0; background:linear-gradient(100deg, transparent 30%, rgba(255,250,220,.75) 50%, transparent 70%); background-size:250% 100%; -webkit-background-clip:text; background-clip:text; color:transparent; animation:lmshine 2.2s .3s ease-out; }
  @keyframes lmshine { from { background-position:120% 0; } to { background-position:-120% 0; } }
  #lmfound .orn { display:flex; align-items:center; justify-content:center; gap:10px; margin:2px auto; width:min(460px, 80vw); }
  #lmfound .orn i { flex:1; height:1px; background:linear-gradient(90deg, transparent, #e9c87e); } #lmfound .orn i:last-child { background:linear-gradient(90deg, #e9c87e, transparent); }
  #lmfound .orn b { width:8px; height:8px; transform:rotate(45deg); border:1px solid #e9c87e; box-shadow:0 0 8px rgba(233,200,126,.8); }
  #lmfound .e { font:700 11px 'Cinzel'; letter-spacing:.55em; color:#e9c87e; text-shadow:0 1px 3px #000; }
  #lmfound .d { font:500 13.5px 'Noto Sans KR'; color:#e4ecee; margin-top:8px; text-shadow:0 1px 4px #000, 0 0 8px rgba(0,0,0,.6); }
  #lmfound .x { display:inline-block; margin-top:10px; font:800 12px 'Noto Sans KR'; color:#ffe9a8; padding:4px 14px; border-radius:14px; background:rgba(10,14,24,.66); border:1px solid rgba(233,200,126,.5); }
  body.cine #lmfound { opacity:0; }
  body.touch #lmfound .d { font-size:12px; }
`;
document.head.appendChild(css);
const foundEl = X.mk('div', 'lmfound', '<div class="k">📍 새로운 장소 발견</div><div class="n"></div><div class="orn"><i></i><b></b><i></i></div><div class="e"></div><div class="d"></div><div class="x"></div>');
const QUEUE = []; let foundT = 0;
function showFound(l, exp){ QUEUE.push([l, exp, Object.keys(S.lm.disc).length]); }
let waitT = 0;
function pumpFound(rdt){
  const rb = document.getElementById('fregion'), sb = document.getElementById('banner'), busy = (rb && rb.classList.contains('on')) || (sb && sb.classList.contains('on'));   // 지역 · 레벨업 배너
  if (foundT > 0){ foundEl.classList.toggle('low', !!busy); foundT -= rdt; if (foundT <= 0) foundEl.classList.remove('on'); return; }
  if (!QUEUE.length) return;
  if (busy && (waitT += rdt) < 5) return;   // 다른 배너가 끝나길 기다렸다가, 그래도 떠 있으면 위쪽에 보여요
  waitT = 0; foundEl.classList.toggle('low', !!busy);
  const [l, exp, cnt] = QUEUE.shift(), n = foundEl.querySelector('.n');
  n.textContent = l.name; n.setAttribute('data-t', l.name); foundEl.querySelector('.e').textContent = (l.en || '').toUpperCase(); foundEl.querySelector('.d').textContent = l.desc || '';
  foundEl.querySelector('.x').textContent = `탐험 경험치 +${X.fmt ? X.fmt(exp) : exp}  ·  발견 ${cnt} / ${W.landmarks.length}`;
  const nn = n.cloneNode(true); n.replaceWith(nn);   // 반짝임 애니메이션 다시
  foundEl.classList.add('on'); foundT = 4.6;
}
const LABELS = {};
function placeLabel(l){
  if (LABELS[l.id] || !F.label) return; const L = LMS.find(o => o.id === l.id); const big = l.r >= 22 || BIGL.has(l.id);
  if (!big) return;
  const top = L ? Math.min(L.top, H(l.c[0], l.c[1]) + 60) : H(l.c[0], l.c[1]) + 10;
  LABELS[l.id] = F.label({ pos: new V3(l.c[0], top + 4, l.c[1]), text: `📍 ${l.name}`, cls: 'place', max: 300 }); LABELS[l.id].hidden = true;
}
const BIGL = new Set(['runegate', 'lamprock', 'pavilion', 'moonbridge', 'reedbridge']);
function discover(l){
  if (S.lm.disc[l.id]) return;
  S.lm.disc[l.id] = Date.now();
  const reg = F.regionById(l.region), lv = reg ? Math.round((reg.lv[0] + reg.lv[1]) / 2) : 1, exp = Math.round(X.need(Math.max(1, lv)) * 0.08 + 6);
  X.gainExp(exp); X.save(); X.sfx('shard'); setTimeout(() => X.sfx('rune'), 260);
  showFound(l, exp); placeLabel(l);
  try { X.burst(new V3(X.player.pos.x, 1.2, X.player.pos.z), 0x8af4ff, 26, 2.4, 0.22, 1.2, -1, 2.5); } catch (e){}
  BUS.emit('discover', { id: l.id, name: l.name, kind: 'landmark' });
}
F.discovered = id => !!S.lm.disc[id];
F.landmarkAt = (x, z) => { let best = null, bk = 1e9; for (const l of W.landmarks){ const k = Math.hypot(x - l.c[0], z - l.c[1]) / l.r; if (k < 1 && k < bk){ bk = k; best = l; } } return best; };
F.raidPortalPos = F.raidPortalPos || {};

// ───────────────────────── 집 짓기 (면 로컬: x 오른쪽 · y 위 · z 바깥) ─────────────────────────
function win(x, y, w, h, paint, sh = true){
  K.box('glass', w, h, 0.06, x, y, 0.03);
  K.box('beam', w + 0.18, 0.1, 0.14, x, y + h / 2 + 0.05, 0.07); K.box('stone', w + 0.3, 0.1, 0.24, x, y - h / 2 - 0.05, 0.1);
  K.box('beam', 0.09, h, 0.14, x - w / 2 - 0.045, y, 0.07); K.box('beam', 0.09, h, 0.14, x + w / 2 + 0.045, y, 0.07); K.box('beam', 0.05, h, 0.08, x, y, 0.07); K.box('beam', w, 0.05, 0.08, x, y + h * 0.12, 0.07);
  if (sh) for (const s of [-1, 1]) K.box(paint, w * 0.5, h + 0.06, 0.05, x + s * (w * 0.75 + 0.1), y, 0.05, 0, s * 0.25, 0);
}
function door(x, w, h, paint, y = 0){
  K.box(paint, w, h, 0.1, x, y + h / 2, 0.04); for (let i = 0; i < 3; i++) K.box('iron', w * 0.8, 0.05, 0.03, x, y + 0.35 + i * h * 0.33, 0.1);
  K.box('beam', w + 0.5, 0.22, 0.22, x, y + h + 0.11, 0.1); for (const s of [-1, 1]) K.box('beam', 0.18, h + 0.2, 0.18, x + s * (w / 2 + 0.09), y + h / 2, 0.08);
  K.geo('iron', tor(0.07, 0.015, 4, 10), x + w * 0.3, y + h * 0.5, 0.1); K.box('stone', w + 0.6, 0.16, 0.6, x, y - 0.06, 0.32);
}
function flowerBox(x, y, w){ K.box('beam', w, 0.2, 0.26, x, y, 0.16); for (let i = 0; i < Math.round(w / 0.17); i++) K.geo(R() < 0.55 ? 'flower' : R() < 0.5 ? 'flowerY' : 'leaf', ico(rr(0.07, 0.11), 0), x - w / 2 + 0.1 + i * 0.17, y + 0.14 + rr(0, 0.06), 0.16 + rr(-0.05, 0.05)); }
function wallLamp(x, y){ K.box('iron', 0.04, 0.04, 0.4, x, y + 0.35, 0.2); K.box('lamp', 0.2, 0.28, 0.2, x, y, 0.42); K.geo('iron', cone(0.2, 0.16, 4), x, y + 0.22, 0.42, 0, Math.PI / 4, 0); glow(x, y, 0.42, 0xffb860, 2.0, 0.25); }
// 걸린 간판: 광장 간판 그림(G.M.sign*)을 글자판 아틀라스에 옮겨 한 재질로 그려요
const SIGNUV = {};
function signUV(key){ if (SIGNUV[key]) return SIGNUV[key]; const img = G.M[key] && G.M[key].map && G.M[key].map.image, s = SA.next(); if (!img) return (SIGNUV[key] = s.uv); const w = Math.round(SA.ch * img.width / img.height); SA.x.drawImage(img, s.px, s.py, w, SA.ch); return (SIGNUV[key] = [s.uv[0], s.uv[1], s.uv[0] + w / SA.c.width, s.uv[3]]); }
function hangSign(x, y, key){
  K.box('iron', 0.05, 0.05, 1.2, x, y, 0.6); K.box('iron', 0.04, 0.04, 0.8, x, y - 0.27, 0.3, -0.76);
  const uv = signUV(key); K.box('beam', 0.06, 0.62, 0.84, x, y - 0.46, 0.61); K.geo('signA', quadUV(0.78, 0.56, uv), x + 0.032, y - 0.46, 0.61, 0, Math.PI / 2, 0); K.geo('signA', quadUV(0.78, 0.56, uv), x - 0.032, y - 0.46, 0.61, 0, -Math.PI / 2, 0);
}
// 줄무늬 차양 (흰 줄과 번갈아) · 줄무늬 원뿔 지붕
const AWN = { awnR: 'fabricR', awnB: 'fabricB', awnG: 'fabricG', awnY: 'fabricY' };
function awning(key, w, h, d, x, y, z, rx = 0, n = 7){ const c = AWN[key] || key; for (let i = 0; i < n; i++) K.box(i % 2 ? 'fabricW' : c, w / n + 0.003, h, d, x - w / 2 + (i + 0.5) * w / n, y, z, rx); }
function stripedCone(key, r, h, n, x, y, z){ const c = AWN[key] || key; for (let i = 0; i < n; i++){ const a0 = i / n * TAU, a1 = (i + 1) / n * TAU; K.geo(i % 2 ? 'fabricW' : c, triG([0, h, 0], [Math.cos(a0) * r, 0, Math.sin(a0) * r], [Math.cos(a1) * r, 0, Math.sin(a1) * r]), x, y, z); } }
function timber(fw, y0, h, n){
  const t = 0.16, bw = fw / n; K.box('beam', fw + 0.04, t, 0.1, 0, y0 + t / 2, 0.05); K.box('beam', fw + 0.04, t, 0.1, 0, y0 + h - t / 2, 0.05);
  for (let i = 0; i <= n; i++) K.box('beam', t, h, 0.1, -fw / 2 + i * bw + (i === 0 ? t / 2 : i === n ? -t / 2 : 0), y0 + h / 2, 0.05);
  if (n >= 4) for (const i of [0, n - 1]){ const cx = -fw / 2 + (i + 0.5) * bw, iw = bw - t, ih = h - 2 * t, L = Math.hypot(iw, ih), a = Math.atan2(ih, iw); K.box('beam', L, t * 0.8, 0.08, cx, y0 + h / 2, 0.05, 0, 0, i === 0 ? a : -a); }
}
// 한 면: o = { door, timber, sign, lamp, flowers }
function face(fw, y0, h, paint, o = {}){
  const n = Math.max(2, Math.round(fw / 1.7)), bw = fw / n, di = o.door ? Math.floor(n / 2) : -1;
  if (o.timber) timber(fw, y0, h, n);
  for (let i = 0; i < n; i++){
    const cx = -fw / 2 + (i + 0.5) * bw;
    if (i === di){ door(cx, Math.min(1.15, bw - 0.4), 2.1, paint, y0); if (o.lamp) wallLamp(cx + Math.min(1.15, bw - 0.4) / 2 + 0.45, y0 + 2.3); if (o.sign) hangSign(fw / 2 - 0.5, y0 + 2.9, o.sign); continue; }
    if (o.timber && n >= 4 && (i === 0 || i === n - 1)) continue;
    if (n <= 3 || (i + (o.door ? 1 : 0)) % 2 === 0 || o.door){ const ww = Math.min(0.9, bw - 0.6), wh = Math.min(1.1, h * 0.4); win(cx, y0 + h * 0.58, ww, wh, paint, R() < 0.75); if (o.flowers && R() < 0.6) flowerBox(cx, y0 + h * 0.58 - wh / 2 - 0.22, ww + 0.25); }
  }
}
// 박공지붕 (용마루 = x 축) → 지붕 높이
function roofG(w, d, y, pitch, oh, key, th = 0.18){
  const hd = d / 2 + oh, rise = (d / 2) * Math.tan(pitch), L = hd / Math.cos(pitch);
  for (const s of [-1, 1]) K.box(key, w + oh * 2, th, L, 0, y + rise - (hd / 2) * Math.tan(pitch) + th / 2, s * hd / 2, s * pitch, 0, 0);
  K.geo(key === 'thatch' ? 'thatch' : 'beam', cyl(th * 0.8, th * 0.8, w + oh * 2 + 0.05, 8), 0, y + rise + th * 0.75, 0, 0, 0, Math.PI / 2);
  return rise;
}
function gables(w, d, y, rise, key, tim = true){
  for (const s of [-1, 1]){
    K.geo(key, triG([s * w / 2, y, -d / 2], [s * w / 2, y, d / 2], [s * w / 2, y + rise, 0]));
    if (!tim) continue; K.push(s * w / 2, 0, 0, s * Math.PI / 2);
    K.box('beam', d, 0.16, 0.12, 0, y + 0.08, 0.05); K.box('beam', 0.16, rise - 0.15, 0.12, 0, y + (rise - 0.15) / 2, 0.05);
    const L = Math.hypot(d * 0.22, rise * 0.4), a = Math.atan2(rise * 0.4, d * 0.22); K.box('beam', L, 0.12, 0.1, -d * 0.12, y + rise * 0.22, 0.05, 0, 0, a); K.box('beam', L, 0.12, 0.1, d * 0.12, y + rise * 0.22, 0.05, 0, 0, -a);
    K.pop();
  }
}
const faces = (w, d) => [[0, d / 2, 0, w], [0, -d / 2, Math.PI, w], [w / 2, 0, Math.PI / 2, d], [-w / 2, 0, -Math.PI / 2, d]];
const OCC = [];   // 마을 안 건물 자리 (나무 · 소품 피하기): [x, z, r]
const MAPBOX = [];   // 미니맵 건물 윤곽: [x, z, hw, hd, ry] (절대 좌표)
// 집: (x, z) 그룹 로컬, ry = 정면(문) 방향. o = { w, d, fl, wall, roof, paint, sign, fg(앞 박공), chimney, flag }
function house(x, z, ry, o = {}){
  const w = o.w || 8, d = o.d || 7, fl = o.fl || 1, wall = o.wall || pick(WALL), roof = o.roof || pick(['slate', 'slate', 'shingle', 'roof2', 'thatch']), paint = o.paint || pick(PAINT);
  const [lo, hi] = foot(OX + x, OZ + z, w / 2 + 0.6, d / 2 + 0.6, ry), y0 = hi + 0.05;
  K.push(x, y0, z, ry);
  const pl = y0 - lo + 0.9; K.box('stone', w + 0.5, pl, d + 0.5, 0, 0.3 - pl / 2, 0);
  let top, W2 = w, D2 = d;
  if (fl === 1){
    const h = 3.0; K.box(wall, w, h, d, 0, 0.3 + h / 2, 0);
    faces(w, d).forEach(([fx, fz, fr, fw], i) => { K.push(fx, 0, fz, fr); face(fw, 0.3, h, paint, { timber: true, door: i === 0, sign: i === 0 && o.sign, lamp: i === 0, flowers: true }); K.pop(); });
    top = 0.3 + h;
  } else {
    const h1 = 2.9, h2 = 2.6, jet = 0.35; K.box('stone', w, h1, d, 0, 0.3 + h1 / 2, 0);
    faces(w, d).forEach(([fx, fz, fr, fw], i) => { K.push(fx, 0, fz, fr); face(fw, 0.3, h1, paint, { door: i === 0, sign: i === 0 && o.sign, lamp: i === 0 }); K.pop(); });
    const y2 = 0.3 + h1; W2 = w + 0.1; D2 = d + jet * 2; K.box('beam', W2 + 0.04, 0.22, D2, 0, y2 + 0.11, 0);
    for (let i = 0; i < Math.floor(w / 0.6); i++) for (const s of [-1, 1]) K.box('beam', 0.14, 0.14, 0.42, -w / 2 + 0.35 + i * 0.6, y2 - 0.07, s * (d / 2 + 0.18));
    const yy = y2 + 0.22; K.box(wall, W2, h2, D2, 0, yy + h2 / 2, 0);
    faces(W2, D2).forEach(([fx, fz, fr, fw]) => { K.push(fx, 0, fz, fr); face(fw, yy, h2, paint, { timber: true, flowers: true }); K.pop(); });
    top = yy + h2;
  }
  const thatch = roof === 'thatch', pitch = thatch ? 0.85 : 0.78;
  let rise;
  if (o.fg){ K.push(0, 0, 0, Math.PI / 2); rise = roofG(D2, W2, top, pitch, thatch ? 0.55 : 0.45, roof, thatch ? 0.4 : 0.18); gables(D2, W2, top, rise, wall); K.pop(); }
  else { rise = roofG(W2, D2, top, pitch, thatch ? 0.55 : 0.45, roof, thatch ? 0.4 : 0.18); gables(W2, D2, top, rise, wall); }
  if (o.chimney !== false){ const cx = W2 * (R() < 0.5 ? -0.3 : 0.3), cz = -D2 * 0.18; K.box('stone', 0.75, rise + 1.3, 0.75, cx, top + (rise + 1.3) / 2, cz); K.box('stoneD', 0.9, 0.16, 0.9, cx, top + rise + 1.3, cz); if (o.smoke !== false && R() < 0.75) CUR.smoke.push(kpt(cx, top + rise + 1.5, cz)); }
  K.pop(); cb(x, z, W2 / 2 + 0.25, D2 / 2 + 0.25, ry); OCC.push([x, z, Math.max(W2, D2) * 0.62]); MAPBOX.push([OX + x, OZ + z, W2 / 2, D2 / 2, ry]);
  return { y0, top: top + rise };
}

// ───────────────────────── 새싹 마을 ─────────────────────────
// 큰길(새싹길)이 x = 0 을 따라 남북으로 지나가요. 광장은 z ≈ 550 에 동서로 넓게 펼쳐져요.
let VB = null;   // 마을 게시판 두 장 (레이드 모집 · 의뢰) 을 한 캔버스에
function bVillage(l){
  VB = G.cnv(1024, 1152); { const t = G.tex(VB, true, 1, 1); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; add('boards', std({ map: t, roughness: 0.85 })); }
  begin('village', l.c[0], l.c[1], { nearR: 260, lm: l }); OX = 0; OZ = 0; CUR.near.position.set(0, 0, 0);
  // 광장 · 큰길 돌바닥
  const sq = new THREE.RingGeometry(0.001, 1, 72, 10).rotateX(-Math.PI / 2); sq.scale(50, 1, 16); sq.translate(0, 0, 551); meterUV(sq); drape(sq, 0, 0, 0.07); K.geo('cobble', sq);
  const st = new THREE.PlaneGeometry(8, 128, 4, 64).rotateX(-Math.PI / 2); st.translate(0, 0, 562); meterUV(st); drape(st, 0, 0, 0.065); K.geo('cobble', st);
  const fr = new THREE.RingGeometry(0.001, 6.5, 40, 4).rotateX(-Math.PI / 2); fr.translate(-24, 0, 553); meterUV(fr); drape(fr, 0, 0, 0.08); K.geo('cobble', fr);
  // 집들
  house(-14, 529, 0, { w: 11, d: 8, fl: 2, roof: 'slate', paint: 'pGreen', wall: 'plaster2' });                // 촌장 댁
  house(14, 524, 0.08, { w: 9, d: 7, roof: 'thatch' });
  house(35, 527, -0.3, { w: 8, d: 7, fl: 2, fg: true });
  house(-35, 523, 0.25, { w: 8, d: 7, roof: 'shingle' });
  house(-60, 556, Math.PI / 2, { w: 8, d: 7.5, fl: 2 });
  house(61, 562, -Math.PI / 2, { w: 8, d: 7, roof: 'thatch', fg: true });
  house(-41, 574, Math.PI / 2, { w: 9, d: 8, roof: 'thatch', sign: 'sign3', paint: 'pGreen' });             // 약초상
  house(-22, 583, 0, { w: 12, d: 8.5, fl: 2, sign: 'sign0', roof: 'roof2', paint: 'pRed' });              // 여관
  house(48, 597, -Math.PI / 2 - 0.2, { w: 8, d: 7, fg: true });
  house(-48, 601, Math.PI / 2 + 0.2, { w: 8.5, d: 7, fl: 2 });
  // 촌장 댁 지붕 깃발
  { const y = gy(-14, 529); K.geo('woodD', cyl(0.06, 0.07, 4.5, 6), -18, y + 11.4, 529); flag(-18, y + 13.4, 529, 0.3, 2.0, 1.2, 'fabricG'); }
  smithy(); inn(); herbStall(); tailorTent(); raidCorner(); questBoard(); fountain(-24, 553); maypole(26, 559);
  // 시장 노점 (큰길 양쪽)
  stall(8.6, 566, -Math.PI / 2, 'awnR', 'fruit'); stall(8.6, 583, -Math.PI / 2, 'awnB', 'fish'); stall(-8.6, 567, Math.PI / 2, 'awnY', 'bread'); stall(-9.4, 604, Math.PI / 2, 'awnG', 'veg');
  // 가로등 (큰길 · 광장)
  for (const z of [512, 528, 571, 588, 612]) for (const s of [-1, 1]) P.lamp(s * 5.6, z + (s > 0 ? 0 : 1.5), 'village', s > 0 ? Math.PI : 0);
  for (const [x, z] of [[-30, 540], [30, 542], [-38, 562], [40, 560], [-12, 562], [17, 562]]) P.lamp(x, z, 'village', R() * TAU);
  // 줄 깃발 (큰길 위 · 오월 기둥에서 사방으로)
  for (const z of [575, 594]){ const ya = gy(-6.4, z), yb = gy(6.4, z); for (const s of [-1, 1]) K.geo('woodD', cyl(0.08, 0.1, 5.6, 6), s * 6.4, (s < 0 ? ya : yb) + 2.8, z); P.pennants([[-6.4, ya + 5.4, z], [6.4, yb + 5.4, z]], 0.8); cc(-6.4, z, 0.2); cc(6.4, z, 0.2); }
  // 환영 아치 (북문)
  welcomeArch(0, 506);
  // 물레방앗간 (마을 연못 동쪽)
  { const pd = W.lakes.find(o => o.id === 'villagepond'); if (pd) watermill(pd.c[0] + pd.rx + 1.2, pd.c[1] + 2); }
  // 정원 · 밭
  garden(-28, 508, 12, 7, 'cabbage'); garden(28, 507, 11, 7, 'carrot'); garden(-60, 584, 7, 9, 'flower');
  // 우물 · 마차 · 짐더미 · 빨래줄 · 벤치
  P.well(24, 589); P.cart(-10, 612, 0.4, 'barrel'); P.cart(15, 506, -0.3, 'hay'); P.hayStack(40, 510); P.hayStack(43, 506); P.hay(-46, 512, 0.7);
  P.clutter(-14, 572, 3); P.clutter(28, 546, 2); P.clutter(56, 590, 3); P.clutter(-56, 568, 2); P.clutter(-29, 597, 2);
  laundry(-27, 516, -18, 514);
  for (const [x, z, ry] of [[-20, 547, 0.3], [-28, 547, -0.3], [-31, 556, -1.5], [-17, 558, 1.4], [20, 547, -0.2]]) P.bench(x, z, ry);
  for (const [x, z, ry] of [[-11, 597, 0.2], [-30, 594, -0.4]]) P.table(x, z, ry);
  // 마을 울타리 (동서남북 출입구만 열려요)
  const RC = [0, 559], RR = 66;
  for (let i = 0; i < 48; i++){ const a0 = i / 48 * TAU, a1 = (i + 1) / 48 * TAU, am = (a0 + a1) / 2, gap = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].some(g => Math.abs(Math.atan2(Math.sin(am - g), Math.cos(am - g))) < 0.13); if (gap) continue;
    const x0 = RC[0] + Math.cos(a0) * RR, z0 = RC[1] + Math.sin(a0) * RR * 0.98, x1 = RC[0] + Math.cos(a1) * RR, z1 = RC[1] + Math.sin(a1) * RR * 0.98;
    if (wet(x0, z0) || wet(x1, z1)) continue; P.fence(x0, z0, x1, z1, { gap: 2.2, cap: i % 2 ? null : 'woodD' }); }
  // 나무 · 덤불 (건물 · 길 피해서)
  const trees = { oak: [], bush: [] };
  for (let t = 0; t < 400 && trees.oak.length < 14; t++){ const a = R() * TAU, d = rr(22, 46), x = Math.cos(a) * d, z = 559 + Math.sin(a) * d;
    if (Math.abs(x) < 9 || OCC.some(([ox, oz, r]) => Math.hypot(x - ox, z - oz) < r + 3) || kept(x, z, 3) || wet(x, z) || Math.hypot(x - 22, z - 604) < 15 || (z > 535 && z < 568 && Math.abs(x) < 52)) continue;
    trees.oak.push([x, z, rr(0.9, 1.35)]); OCC.push([x, z, 2]); }
  for (let t = 0; t < 300 && trees.bush.length < 18; t++){ const a = R() * TAU, d = rr(14, 46), x = Math.cos(a) * d, z = 559 + Math.sin(a) * d;
    if (Math.abs(x) < 6 || OCC.some(([ox, oz, r]) => Math.hypot(x - ox, z - oz) < r + 1) || kept(x, z, 2) || wet(x, z) || (z > 537 && z < 566 && Math.abs(x) < 50)) continue; trees.bush.push([x, z, rr(0.7, 1.2)]); }
  for (const k in trees) plantI(trees[k], k);
  for (const [x, z, s] of trees.oak) cc(x - OX, z - OZ, 0.45 * s);
  CUR.sparks && sparkFx(CUR.near, CUR.sparks);
  return finish();
}
// 나무 인스턴스 (X.treeGeo · 정점색) — 그룹 로컬
function plantI(list, type){
  if (!list.length) return; const im = new THREE.InstancedMesh(X.treeGeo(type), X.TREEMAT, list.length), c = new THREE.Color();
  list.forEach((t, i) => { im.setMatrixAt(i, G.mat(t[0], gy(t[0], t[1]) - 0.1, t[1], 0, R() * TAU, 0, t[2], t[2], t[2])); c.setHSL(0.25 + rr(-0.04, 0.04), 0.5, rr(0.85, 1)); im.setColorAt(i, c); });
  im.castShadow = true; im.receiveShadow = true; CUR.near.add(im);
  // 먼 실루엣엔 둥근 덩어리로
  for (const t of list) if (type === 'oak' || type === 'birch') B.far.push(['leafB', ico(2.0 * t[2], 0).translate(t[0], gy(t[0], t[1]) + 3.9 * t[2], t[1])]);
}
// 대장간 (도른): 대장장이 (34, 574) 뒤 동쪽 건물 + 앞쪽 작업장 (화덕 · 모루)
function smithy(){
  const x = 47, z = 576, ry = -Math.PI / 2, w = 10, d = 8;
  const [lo, hi] = foot(x, z, d / 2 + 0.6, w / 2 + 0.6, 0), y0 = hi + 0.05;
  K.push(x, y0, z, ry);
  const pl = y0 - lo + 0.9; K.box('stone', w + 0.5, pl, d + 0.5, 0, 0.3 - pl / 2, 0);
  K.box('stone', w, 4.0, d, 0, 2.3, 0);
  faces(w, d).forEach(([fx, fz, fr, fw], i) => { K.push(fx, 0, fz, fr); if (i === 0){ K.box('dark', 2.6, 2.8, 0.08, -1.8, 1.7, 0.02); K.box('woodD', 3.0, 0.3, 0.3, -1.8, 3.25, 0.12); for (const s of [-1, 1]) K.box('woodD', 0.25, 2.95, 0.25, -1.8 + s * 1.4, 1.7, 0.12); win(2.4, 2.3, 1.1, 1.0, 'pRed', false); hangSign(fw / 2 - 0.3, 3.6, 'sign4'); } else win(0, 2.4, 0.9, 0.9, 'pRed', false); K.pop(); });
  const rise = roofG(w, d, 4.3, 0.55, 0.5, 'shingle'); gables(w, d, 4.3, rise, 'stone', false);
  // 앞 차양 작업장
  const zf = d / 2;
  for (const xx of [-4.6, 0, 4.6]){ K.box('woodD', 0.3, 3.3, 0.3, xx, 1.65 + 0.3, zf + 5.0); cc(xx, zf + 5.0, 0.25); }
  K.box('woodD', 9.6, 0.3, 0.32, 0, 3.3, zf + 5.0); K.box('shingle', 10.2, 0.16, 5.6, 0, 3.75, zf + 2.6, 0.18, 0, 0);
  // 화덕
  K.push(3.6, 0, zf + 2.0);
  K.box('stone', 2.4, 1.0, 1.8, 0, 0.6, 0); K.box('ember', 1.7, 0.08, 1.2, 0, 1.12, 0); K.box('stoneD', 2.6, 0.16, 2.0, 0, 1.14, 0);
  K.box('stone', 2.2, 0.9, 1.6, 0, 2.6, 0); K.box('stoneD', 1.6, 0.6, 1.2, 0, 3.3, 0); K.box('stone', 0.95, 3.6, 0.95, 0, 5.2, -0.2); K.box('stoneD', 1.15, 0.2, 1.15, 0, 7.05, -0.2); K.box('ember', 1.2, 0.5, 0.06, 0, 0.62, 0.92);
  glow(0, 1.4, 0.4, 0xff6a20, 5.5, 0.9); CUR.smoke.push(kpt(0, 7.3, -0.2), kpt(0.1, 7.3, -0.2)); CUR.sparks = [kpt(0, 1.3, 0.2)]; cb(0, 0, 1.3, 1.0);
  K.pop();
  // 모루 · 담금 통 · 무기 걸이 · 숫돌
  K.push(-1.6, 0, zf + 3.4, 0.3); K.box('woodD', 0.7, 0.6, 0.7, 0, 0.6, 0); K.box('iron', 0.42, 0.3, 0.9, 0, 1.05, 0); K.box('iron', 0.6, 0.18, 1.1, 0, 1.27, 0); K.geo('iron', cone(0.12, 0.45, 6), 0, 1.27, 0.72, Math.PI / 2, 0, 0); cb(0, 0, 0.4, 0.6); K.pop();
  K.geo('wood', lathe([[0, 0], [0.5, 0], [0.55, 0.6], [0, 0.6]], 12, 0.4), 1.2, 0.3, zf + 4.2); K.geo('water', new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2), 1.2, 0.86, zf + 4.2);
  K.push(-4.0, 0, zf + 1.0); K.box('woodD', 2.4, 0.12, 0.3, 0, 1.6, 0); K.box('woodD', 2.4, 0.12, 0.3, 0, 0.5, 0); for (const s of [-1, 1]) K.box('woodD', 0.12, 1.9, 0.12, s * 1.15, 0.95, 0);
  for (let i = 0; i < 5; i++){ K.box('steel', 0.08, 1.5, 0.03, -0.8 + i * 0.4, 1.15, 0.12, 0, 0, rr(-0.08, 0.08)); K.box('gold', 0.3, 0.06, 0.06, -0.8 + i * 0.4, 1.95, 0.12); } K.pop();
  K.geo('stone', cyl(0.5, 0.5, 0.16, 16), -4.2, 0.95, zf + 3.6, 0, 0, Math.PI / 2); K.box('woodD', 0.5, 0.7, 0.9, -4.2, 0.65, zf + 3.6);
  K.pop();
  cb(x, z, d / 2 + 0.25, w / 2 + 0.25); OCC.push([x, z, 7], [x - 7, z, 4]); MAPBOX.push([x, z, d / 2, w / 2, 0], [x - 6.6, z, 2.4, 4.8, 0]);
}
// 여관 앞마당 장식 (술통 · 간판 등)
function inn(){ P.clutter(-13, 586, 3, 1.0); P.barrel(-28.6, gy(-28.6, 589), 589); P.barrel(-29.4, gy(-29.4, 588.6), 588.6); P.lamp(-15, 590, 'village', 0.4); }
// 약초상 노점 (미라 옆)
function herbStall(){
  const x = -35.5, z = 579.5, y = gy(x, z); K.push(x, y, z, Math.PI / 2);
  K.box('wood', 2.2, 0.85, 0.8, 0, 0.42, 0); for (let i = 0; i < 8; i++) K.geo(i % 2 ? 'potionP' : 'potionG', lathe([[0, 0], [0.09, 0], [0.11, 0.12], [0.04, 0.2], [0.04, 0.28], [0, 0.28]], 8, 0.3), -0.85 + i * 0.24, 0.85, rr(-0.15, 0.15));
  for (const s of [-1, 1]) K.box('woodD', 0.1, 2.2, 0.1, s * 1.1, 1.1, -0.35); awning('awnG', 2.6, 0.06, 1.3, 0, 2.2, 0.1, 0.25, 6);
  for (let i = 0; i < 6; i++) K.geo('leaf', cone(0.1, 0.45, 5), -0.9 + i * 0.36, 1.85, -0.3, Math.PI, 0, 0);
  K.pop(); cc(x, z, 1.3);
  for (const [px, pz] of [[-36.5, 568.5], [-37.4, 569.6]]) { K.geo('terra', lathe([[0, 0], [0.25, 0], [0.32, 0.4], [0, 0.4]], 10, 0.4), px, gy(px, pz), pz); K.geo('leafC', ico(0.35, 0), px, gy(px, pz) + 0.62, pz); }
}
// 재봉사 루나의 천막 (육각 정자 + 마네킹)
function tailorTent(){
  const x = -52, z = 536, [lo, hi] = footC(x, z, 4.5), y = hi;
  K.push(x, y, z, 0.6);
  K.geo('stoneD', cylM(4.4, 4.6, Math.max(0.3, hi - lo + 0.3), 6), 0, 0.15 - (hi - lo) / 2, 0);
  for (let i = 0; i < 6; i++){ const a = i / 6 * TAU; K.geo('woodD', cyl(0.1, 0.12, 3.0, 6), Math.cos(a) * 4, 1.6, Math.sin(a) * 4); }
  stripedCone('awnB', 5.0, 2.6, 12, 0, 3.0, 0); K.geo('gold', sph(0.22, 8, 6), 0, 5.7, 0);
  for (let i = 0; i < 6; i++){ const a0 = i / 6 * TAU, a1 = (i + 1) / 6 * TAU; if (i === 1 || i === 2) continue; K.geo('fabricW', triG([Math.cos(a0) * 4, 0.1, Math.sin(a0) * 4], [Math.cos(a1) * 4, 0.1, Math.sin(a1) * 4], [Math.cos(a0) * 4, 3.0, Math.sin(a0) * 4])); K.geo('fabricW', triG([Math.cos(a1) * 4, 0.1, Math.sin(a1) * 4], [Math.cos(a1) * 4, 3.0, Math.sin(a1) * 4], [Math.cos(a0) * 4, 3.0, Math.sin(a0) * 4])); }
  for (let i = 0; i < 6; i++){ const a = (i + 0.5) / 6 * TAU; K.geo(['fabricR', 'fabricY', 'fabricB'][i % 3], triG([Math.cos(a - 0.4) * 4.6, 3.05, Math.sin(a - 0.4) * 4.6], [Math.cos(a + 0.4) * 4.6, 3.05, Math.sin(a + 0.4) * 4.6], [Math.cos(a) * 4.8, 2.4, Math.sin(a) * 4.8])); }
  // 천 두루마리 · 거울 · 재봉틀 탁자
  for (let i = 0; i < 5; i++) K.geo(['fabricR', 'fabricB', 'fabricY', 'fabricG', 'fabricP'][i], cylM(0.18, 0.18, 1.4, 10), -1.2 + i * 0.4, 0.75, -2.6, 0.15, 0, 0);
  K.box('wood', 1.6, 0.8, 0.8, 1.6, 0.4, -1.6); K.box('gold', 0.9, 1.6, 0.06, -2.6, 1.0, -1.2, 0, 0.8, 0); K.box('glass', 0.75, 1.4, 0.03, -2.58, 1.0, -1.17, 0, 0.8, 0);
  K.pop(); cc(x, z, 4.3); OCC.push([x, z, 5.5]);
  // 마네킹 (드레스)
  for (const [mx, mz, key] of [[-46.2, 539.5, 'fabricR'], [-45.2, 535.4, 'fabricP'], [-47.8, 542.6, 'fabricY']]){ const my = gy(mx, mz); K.push(mx, my, mz, 0.9); K.geo('woodD', cyl(0.03, 0.03, 0.9, 5), 0, 0.45, 0); K.box('woodD', 0.5, 0.05, 0.5, 0, 0.03, 0);
    K.geo(key, lathe([[0, 0.8], [0.45, 0.82], [0.32, 1.25], [0.2, 1.45], [0.24, 1.6], [0.12, 1.75], [0, 1.78]], 12, 0.4)); K.geo('woodD', sph(0.08, 6, 4), 0, 1.86, 0); K.pop(); cc(mx, mz, 0.45); }
}
// 레이드 대장 카엘의 모집 구역: 게시판 · 전쟁 천막 · 깃발 · 허수아비
function raidCorner(){
  // 모집 게시판 (포스터 캔버스)
  const x = VB.getContext('2d');
  x.fillStyle = '#3a2616'; x.fillRect(0, 0, 1024, 640); x.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 12; i++) x.fillRect(0, i * 54 + 20, 1024, 3);
  x.fillStyle = '#e9c87e'; x.font = '900 72px "Gowun Batang", serif'; x.textAlign = 'center'; x.shadowColor = '#000'; x.shadowBlur = 8; x.fillText('⚔ 레이드 모집 ⚔', 512, 92); x.shadowBlur = 0;
  W.raids.forEach((r, i) => { const px = 40 + i * 328, py = 130, col = ['#5a8a3a', '#9a5a2a', '#3a7ab8'][i];
    x.save(); x.translate(px + 150, py + 230); x.rotate((i - 1) * 0.04); x.translate(-150, -230);
    x.fillStyle = '#efe2c0'; x.fillRect(0, 0, 300, 460); x.fillStyle = col; x.fillRect(0, 0, 300, 70); x.fillStyle = '#fff'; x.font = '900 34px "Noto Sans KR", sans-serif'; x.fillText(`Lv.${r.lv}+`, 150, 48);
    x.fillStyle = col; x.beginPath(); x.arc(150, 180, 78, 0, TAU); x.fill(); x.fillStyle = '#efe2c0'; x.font = '900 90px serif'; x.fillText(['🐸', '🗿', '🐉'][i], 150, 212);
    x.fillStyle = '#2a1a0c'; x.font = `900 ${r.name.length > 7 ? 30 : 36}px "Gowun Batang", serif`; x.fillText(r.name, 150, 310, 280);
    x.fillStyle = '#6a4a2a'; x.font = '700 22px "Noto Sans KR", sans-serif'; x.fillText(`${r.party}인 파티 · 권장 Lv.${r.rec}`, 150, 350);
    x.font = '500 18px "Noto Sans KR", sans-serif'; const words = r.desc.split(' '); let line = '', ly = 390; for (const wd of words){ if (x.measureText(line + wd).width > 260){ x.fillText(line, 150, ly); ly += 26; line = ''; } line += wd + ' '; } x.fillText(line, 150, ly);
    x.fillStyle = '#b02a2a'; x.beginPath(); x.arc(150, 14, 9, 0, TAU); x.fill(); x.restore(); });
  const bx = 47.5, bz = 541, by = gy(bx, bz), bry = -0.75; K.push(bx, by, bz, bry);
  for (const s of [-1, 1]) K.box('woodD', 0.3, 4.2, 0.3, s * 2.4, 2.1, 0); K.box('woodD', 5.4, 0.3, 0.4, 0, 4.2, 0); K.box('wood', 5.0, 3.0, 0.16, 0, 2.6, -0.05);
  K.geo('boards', quadUV(4.7, 2.9, [0, 1 - 640 / 1152, 1, 1]), 0, 2.6, 0.04); for (const s of [-1, 1]) K.box('roof2', 5.8, 0.1, 1.1, 0, 4.65, s * 0.42, s * 0.5);
  K.pop(); cb(bx, bz, 2.7, 0.4, bry); glow(bx, by + 4.0, bz, 0xffb860, 1.6, 0.3); OCC.push([bx, bz, 3]);
  // 전쟁 천막 (빨강) · 무기 걸이 · 깃발
  const tx = 55, tz = 533; P.tent(tx, tz, -2.4, 'fabricR', 3.2); K.geo('gold', sph(0.2, 8, 6), tx, gy(tx, tz) + 4.1, tz); OCC.push([tx, tz, 4]);
  for (const [px, pz, key] of [[50.5, 536, 'fabricR'], [53, 542.5, 'fabricY'], [44, 537.5, 'fabricR']]) P.banner(px, pz, key, 5.2, -0.75);
  const ry0 = gy(51, 554); K.push(51, ry0, 554, -2.6); K.box('woodD', 2.2, 0.12, 0.25, 0, 1.4, 0); K.box('woodD', 2.2, 0.12, 0.25, 0, 0.4, 0); for (const s of [-1, 1]) K.box('woodD', 0.12, 1.7, 0.12, s * 1.05, 0.85, 0);
  for (let i = 0; i < 4; i++) K.box(i % 2 ? 'steel' : 'woodD', 0.07, 1.9, 0.07, -0.75 + i * 0.5, 1.0, 0.1, 0, 0, 0.12); K.geo('steel', cyl(0.5, 0.5, 0.08, 14), 0.9, 1.0, 0.2, Math.PI / 2, 0, 0); K.pop(); cc(51, 554, 1.2);
  // 훈련용 허수아비
  const dx = 58, dz = 554, dy = gy(dx, dz); K.push(dx, dy, dz, -2.0); K.geo('woodD', cyl(0.08, 0.1, 2.0, 6), 0, 1.0, 0); K.box('woodD', 1.5, 0.1, 0.1, 0, 1.45, 0); K.geo('hay', cylM(0.35, 0.4, 0.9, 8), 0, 1.3, 0); K.geo('sack', sph(0.3, 8, 6), 0, 2.05, 0); K.geo('fabricR', cyl(0.36, 0.36, 0.1, 8), 0, 1.6, 0); K.pop(); cc(dx, dz, 0.5);
}
// 의뢰 게시판 (모양만 — 상호작용은 rpg)
function questBoard(){
  const n = byId('npcs', 'board'), [bx, bz] = n ? n.c : [12, 554];
  const x = VB.getContext('2d'); x.save(); x.translate(0, 640); x.fillStyle = '#5a3e26'; x.fillRect(0, 0, 768, 512); x.fillStyle = 'rgba(0,0,0,.15)'; for (let i = 0; i < 10; i++) x.fillRect(0, i * 52 + 14, 768, 3);
  x.fillStyle = '#e9c87e'; x.font = '900 56px "Gowun Batang", serif'; x.textAlign = 'center'; x.shadowColor = '#000'; x.shadowBlur = 6; x.fillText('의뢰 게시판', 384, 70); x.shadowBlur = 0;
  const notes = [['급구! 슬라임 젤리', '#f4ecd6'], ['멧돼지 사냥꾼 모집', '#f2e2c8'], ['잃어버린 고양이', '#efe6d0'], ['꿀 배달 부탁', '#f6efd8'], ['약초 10개 삽니다', '#ece0c6'], ['밤길 조심!', '#f0e4ce']];
  notes.forEach(([t, bg], i) => { const px = 40 + (i % 3) * 240, py = 110 + ((i / 3) | 0) * 190; x.save(); x.translate(px + 100, py + 80); x.rotate(rr(-0.08, 0.08)); x.fillStyle = bg; x.fillRect(-100, -80, 200, 165); x.fillStyle = '#2a1a0c'; x.font = '800 24px "Noto Sans KR", sans-serif'; x.fillText(t, 0, -30, 180); x.fillStyle = 'rgba(60,40,20,.5)'; for (let k = 0; k < 4; k++) x.fillRect(-75, -5 + k * 20, 150 - k * 22, 4); x.fillStyle = '#c03030'; x.beginPath(); x.arc(0, -70, 8, 0, TAU); x.fill(); x.restore(); });
  x.restore();
  const by = gy(bx, bz), ry = -0.5; K.push(bx, by, bz, ry);
  for (const s of [-1, 1]) K.box('woodD', 0.22, 3.0, 0.22, s * 1.55, 1.5, 0); K.box('wood', 3.3, 2.1, 0.12, 0, 1.75, -0.04); K.geo('boards', quadUV(3.1, 2.06, [0, 0, 0.75, 1 - 640 / 1152]), 0, 1.75, 0.03);
  for (const s of [-1, 1]) K.box('shingle', 3.9, 0.08, 0.9, 0, 3.15, s * 0.33, s * 0.6); K.geo('beam', cyl(0.07, 0.07, 3.9, 6), 0, 3.4, 0, 0, 0, Math.PI / 2);
  K.pop(); cb(bx, bz, 1.7, 0.3, ry); glow(bx, by + 3.0, bz + 0.3, 0xffb860, 1.4, 0.25);
}
// 새싹 분수
function fountain(x, z){
  const [lo, hi] = footC(x, z, 3.6), y = hi - 0.1; K.push(x, y, z);
  K.geo('stone', lathe([[3.45, -(hi - lo) - 0.4], [3.55, 0.15], [3.55, 0.7], [3.15, 0.75], [3.1, 0.3], [0, 0.3]], 36, 0.5)); K.geo('water', new THREE.CircleGeometry(3.12, 36).rotateX(-Math.PI / 2), 0, 0.55, 0);
  K.geo('marbleW', lathe([[0.6, 0.3], [0.42, 0.9], [0.36, 1.6], [0.52, 1.78], [1.55, 1.98], [1.6, 2.2], [1.4, 2.24], [0, 2.14]], 28, 0.5)); K.geo('water', new THREE.CircleGeometry(1.42, 24).rotateX(-Math.PI / 2), 0, 2.17, 0);
  K.geo('marbleW', cyl(0.12, 0.2, 1.4, 8), 0, 2.85, 0);
  for (const s of [-1, 1]) K.geo('leafA', sph(0.6, 10, 6), s * 0.55, 3.55, 0, 0, 0, s * 0.5, 1, 0.22, 0.55);   // 새싹 잎 두 장
  K.geo('gold', tor(3.32, 0.05, 4, 40), 0, 0.74, 0, Math.PI / 2);
  K.pop(); cc(x, z, 3.6); OCC.push([x, z, 5]);
  G.particles(LOW ? 60 : 110, [new V3(x, y + 3.3, z)], { parent: CUR.near,
    vert: `float life = fract(uTime * 0.55 + aSeed); vL = life; float an = aSeed * 43.98; vec3 dir = vec3(cos(an), 0.0, sin(an)); float ring = step(0.5, fract(aSeed * 7.3));
      vec3 p = position + dir * life * mix(1.3, 2.6, ring) + vec3(0.0, life * 1.2 - life * life * mix(2.1, 3.9, ring), 0.0); float sz = 0.15;`,
    frag: `float a = smoothstep(0.5, 0.0, d) * (1.0 - vL * 0.8) * 0.75; gl_FragColor = vec4(vec3(0.75, 0.92, 1.0) * a, a);` });
}
// 오월 기둥 (리본 · 화관)
function maypole(x, z){
  const y = gy(x, z); K.box('stone', 1.2, 0.4, 1.2, x, y + 0.1, z); K.geo('pRed', cylM(0.14, 0.18, 9, 10), x, y + 4.7, z); K.geo('leafA', tor(0.6, 0.18, 6, 16), x, y + 8.6, z, Math.PI / 2); K.geo('gold', sph(0.3, 10, 8), x, y + 9.4, z);
  for (let i = 0; i < 8; i++){ const a = i / 8 * TAU, ex = x + Math.cos(a) * 4.5, ez = z + Math.sin(a) * 4.5, ey = gy(ex, ez) + 0.15; link(['pen0', 'pen1', 'pen2', 'pen3'][i % 4], [x, y + 8.9, z], [ex, ey, ez], 0.14, 0.02); K.geo('woodD', cyl(0.04, 0.04, 0.4, 4), ex, ey, ez); }
  for (let i = 0; i < 4; i++){ const a = i / 4 * TAU + 0.4, ex = x + Math.cos(a) * 12, ez = z + Math.sin(a) * 9, ey = gy(ex, ez); if (OCC.some(([ox, oz, r]) => Math.hypot(ex - ox, ez - oz) < r) || kept(ex, ez, 1)) continue; K.geo('woodD', cyl(0.08, 0.1, 4.4, 6), ex, ey + 2.2, ez); cc(ex, ez, 0.2); P.pennants([[x, y + 8.4, z], [ex, ey + 4.3, ez]], 0.6); }
  cc(x, z, 0.4); OCC.push([x, z, 2]);
}
// 시장 노점: goods = fruit | fish | bread | veg
function stall(x, z, ry, awn, goods){
  const [lo, hi] = foot(x, z, 1.6, 1.2, ry), y = hi; K.push(x, y, z, ry);
  if (hi - lo > 0.1) K.box('stoneD', 3.0, hi - lo + 0.2, 2.0, 0, -(hi - lo) / 2, 0);
  K.box('wood', 2.8, 0.9, 1.0, 0, 0.45, 0.3); K.box('woodD', 3.0, 0.08, 1.2, 0, 0.93, 0.3);
  for (const sx of [-1.4, 1.4]) for (const sz of [-0.6, 0.85]) K.box('woodD', 0.1, sz > 0 ? 2.3 : 2.7, 0.1, sx, (sz > 0 ? 2.3 : 2.7) / 2, sz);
  awning(awn, 3.3, 0.06, 2.1, 0, 2.55, 0.2, 0.22); awning(awn, 3.3, 0.35, 0.03, 0, 2.2, 1.27);
  for (let i = 0; i < 7; i++){ const gx = -1.15 + i * 0.38;
    if (goods === 'fruit'){ K.geo('wicker', lathe([[0, 0], [0.16, 0.02], [0.18, 0.14], [0, 0.14]], 8, 0.3), gx, 0.97, 0.3); for (let k = 0; k < 4; k++) K.geo(['fruitR', 'fruitG', 'fruitO'][i % 3], sph(0.075, 6, 4), gx + rr(-0.06, 0.06), 1.12 + k * 0.03, 0.3 + rr(-0.06, 0.06)); }
    else if (goods === 'fish'){ K.geo('steel', sph(0.12, 6, 4), gx, 1.0, 0.3, 0, rr(-0.3, 0.3), 0, 2.2, 0.45, 0.7); }
    else if (goods === 'bread'){ K.geo('bread', sph(0.13, 8, 5), gx, 1.02, 0.3, 0, rr(-0.4, 0.4), 0, 1.6, 0.7, 0.9); }
    else { K.geo(i % 2 ? 'cabbage' : 'carrot', i % 2 ? ico(0.14, 1) : cone(0.06, 0.3, 6), gx, 1.08, 0.3, i % 2 ? 0 : Math.PI / 2, 0, 0); }
  }
  for (let k = 0; k < 2; k++) P.crate(rr(-1.2, 1.2), 0, -0.9, 0.55, R());
  K.pop(); cb(x, z, 1.55, 1.1, ry); OCC.push([x, z, 2.5]);
}
function welcomeArch(x, z){
  const y = gy(x, z), uv = signCell('새싹 마을', '', 'SPROUT VILLAGE'); K.push(x, y, z);
  for (const s of [-1, 1]){ K.box('stone', 1.2, 0.8, 1.2, s * 5.4, 0.2, 0); K.geo('woodD', cylM(0.28, 0.32, 6.0, 8), s * 5.4, 3.2, 0); K.geo('leafA', ico(0.55, 1), s * 5.4, 6.3, 0); }
  K.box('woodD', 12, 0.4, 0.5, 0, 5.6, 0); K.geo('woodD', tor(5.4, 0.16, 6, 24, Math.PI), 0, 5.8, 0, 0, 0, 0, 1, 0.26, 1);
  K.box('wood', 5.2, 1.25, 0.18, 0, 6.3, 0); for (const s of [-1, 1]) K.geo('signA', quadUV(5.0, 1.1, uv), 0, 6.3, s * 0.1, 0, s > 0 ? 0 : Math.PI, 0);
  for (let i = 0; i < 26; i++){ const t = i / 25, px = -5.4 + t * 10.8, py = 5.35 - Math.sin(t * Math.PI) * 0.6; K.geo(i % 3 ? 'leafA' : (i % 2 ? 'flower' : 'flowerY'), ico(i % 3 ? 0.22 : 0.15, 0), px, py, 0.28); }
  K.pop(); cc(x - 5.4, z, 0.45); cc(x + 5.4, z, 0.45); glow(x - 5.4, y + 6.6, z, 0xffb860, 2.0, 0.25); glow(x + 5.4, y + 6.6, z, 0xffb860, 2.0, 0.25);
}
function garden(x, z, w, d, crop){
  const y = gy(x, z), sg = new THREE.PlaneGeometry(w, d, 6, 4).rotateX(-Math.PI / 2); sg.translate(x, 0, z); meterUV(sg); drape(sg, 0, 0, 0.08); K.geo('soil', sg);
  for (let r = 0; r < Math.floor(d / 1.1); r++) for (let c = 0; c < Math.floor(w / 0.8); c++){ const px = x - w / 2 + 0.5 + c * 0.8, pz = z - d / 2 + 0.6 + r * 1.1, py = gy(px, pz);
    if (crop === 'cabbage') K.geo('cabbage', ico(rr(0.22, 0.3), 1), px, py + 0.2, pz); else if (crop === 'carrot'){ K.geo('leafC', cone(0.14, 0.5, 5), px, py + 0.3, pz); if (c % 4 === 0) K.geo('pumpkin', sph(0.32, 10, 6), px + 0.3, py + 0.22, pz + 0.3, 0, 0, 0, 1.2, 0.8, 1.2); }
    else K.geo(R() < 0.5 ? 'flower' : R() < 0.5 ? 'flowerY' : 'rose', ico(rr(0.12, 0.18), 0), px + rr(-0.2, 0.2), py + rr(0.25, 0.45), pz + rr(-0.2, 0.2)); }
  const hw = w / 2 + 0.5, hd = d / 2 + 0.5;
  P.fence(x - hw, z - hd, x + hw, z - hd, { h: 0.8, rails: [0.5], col: false }); P.fence(x + hw, z - hd, x + hw, z + hd, { h: 0.8, rails: [0.5], col: false }); P.fence(x - hw, z + hd, x - hw, z - hd, { h: 0.8, rails: [0.5], col: false });
  P.fence(x - hw, z + hd, x - 0.8, z + hd, { h: 0.8, rails: [0.5], col: false }); P.fence(x + 0.8, z + hd, x + hw, z + hd, { h: 0.8, rails: [0.5], col: false });
  if (crop === 'carrot'){ const sx = x + w / 2 - 1.5, sz = z - d / 2 + 1.5, sy = gy(sx, sz); K.push(sx, sy, sz, 0.4); K.geo('woodD', cyl(0.05, 0.06, 2.2, 5), 0, 1.1, 0); K.box('woodD', 1.6, 0.08, 0.08, 0, 1.55, 0); K.geo('hay', sph(0.25, 8, 6), 0, 2.2, 0); K.geo('hay', cone(0.38, 0.4, 8), 0, 2.45, 0); K.geo('fabricR', cylM(0.3, 0.4, 0.8, 8), 0, 1.45, 0); K.pop(); }
  OCC.push([x, z, Math.max(w, d) * 0.6]); cb(x, z, w / 2, d / 2);
}
// 물레방아: 연못가 오두막 + 물길 홈통 + 도는 바퀴
function watermill(x, z){
  const wl = wy(OX + x, OZ + z), sx = x + 4.2, sz = z, [lo, hi] = foot(OX + sx, OZ + sz, 2.8, 2.4, 0), y = hi;
  K.push(sx, y, sz, -Math.PI / 2);
  K.box('stone', 5.8, y - lo + 0.6, 5.0, 0, 0.3 - (y - lo + 0.6) / 2, 0); K.box('wood', 5.2, 3.0, 4.4, 0, 1.8, 0);
  const rise = roofG(5.2, 4.4, 3.3, 0.8, 0.4, 'thatch', 0.35); gables(5.2, 4.4, 3.3, rise, 'wood', false);
  K.push(0, 0, 2.2); door(0.9, 1.0, 1.9, 'pBlue', 0.3); K.pop(); K.push(-2.6, 0, 0, -Math.PI / 2); win(0, 1.9, 0.7, 0.8, 'pBlue'); K.pop();
  K.pop(); cb(sx, sz, 2.6, 2.2); OCC.push([sx, sz, 4]); MAPBOX.push([OX + sx, OZ + sz, 2.6, 2.2, 0]);
  // 홈통 (오두막 위에서 바퀴 위로)
  const wx = x + 0.6, wz = z, wyc = Math.max(wl, gy(wx, wz)) + 1.4;
  K.box('woodD', 0.9, 0.12, 6.0, wx, wyc + 2.4, wz + 1.0, 0, 0, 0); for (const s of [-1, 1]) K.box('woodD', 0.08, 0.35, 6.0, wx + s * 0.45, wyc + 2.55, wz + 1.0);
  for (const zz of [wz + 3.4]) K.geo('woodD', cyl(0.1, 0.12, 3.0, 6), wx, wyc + 0.9, zz);
  K.geo('water', plane(0.75, 5.8).rotateX(-Math.PI / 2), wx, wyc + 2.5, wz + 1.0);
  for (const s of [-1, 1]) K.box('woodD', 0.25, 2.6, 0.25, wx + s * 0.95, wyc - 0.1, wz); K.geo('iron', cyl(0.1, 0.1, 2.2, 6), wx, wyc, wz, 0, 0, Math.PI / 2);
  const wheel = new THREE.Group(); wheel.position.set(wx, wyc, wz); CUR.near.add(wheel);
  { const WB = new LB(1e9), WK = new G.Kit(WB), pk = K, pb = B; K = WK; B = WB;
    for (const s of [-0.38, 0.38]){ K.geo('woodD', tor(2.1, 0.09, 4, 20), s, 0, 0, 0, Math.PI / 2, 0); for (let i = 0; i < 4; i++) K.box('woodD', 0.08, 4.2, 0.14, s, 0, 0, i * Math.PI / 4); }
    for (let i = 0; i < 12; i++){ const a = i / 12 * TAU; K.box('wood', 0.85, 0.06, 0.55, 0, Math.cos(a) * 2.05, Math.sin(a) * 2.05, -a); }
    K = pk; B = pb; for (const k in WB.g) wheel.add(meshOf(G.mergeGeos(WB.g[k]), MAT[k], true)); }
  anim(dt => { wheel.rotation.x -= dt * 0.9; });
  G.particles(LOW ? 14 : 26, [new V3(wx, Math.max(wl, gy(wx, wz)) + 0.1, wz + 1.6)], { parent: CUR.near, vert: `float life = fract(uTime * 0.8 + aSeed); vL = life; float an = aSeed * 30.0; vec3 p = position + vec3(cos(an) * 0.5, life * 0.7 - life * life * 0.9, sin(an) * 0.3 + life * 0.8); float sz = 0.16;`,
    frag: `float a = smoothstep(0.5, 0.0, d) * (1.0 - vL) * 0.8; gl_FragColor = vec4(vec3(0.85, 0.95, 1.0) * a, a);` });
}
function laundry(x0, z0, x1, z1){
  const y0 = gy(x0, z0), y1 = gy(x1, z1); K.geo('woodD', cyl(0.06, 0.07, 2.6, 5), x0, y0 + 1.3, z0); K.geo('woodD', cyl(0.06, 0.07, 2.6, 5), x1, y1 + 1.3, z1); cc(x0, z0, 0.2); cc(x1, z1, 0.2);
  const L = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0); K.push((x0 + x1) / 2, (y0 + y1) / 2 + 2.5, (z0 + z1) / 2, yaw); K.box('rope', 0.02, 0.02, L, 0, 0, 0);
  for (let i = 0; i < 6; i++) K.geo(['fabricW', 'fabricB', 'fabricR', 'fabricY', 'fabricW', 'fabricG'][i], plane(0.7, rr(0.6, 1.0)), 0, -0.4, -L / 2 + 0.9 + i * (L - 1.8) / 5, 0, Math.PI / 2, 0); K.pop();
}

// ───────────────────────── 룬의 관문 (광장 귀환) ─────────────────────────
function bRunegate(l){
  const [x, z] = l.c; begin(l.id, x, z, { lm: l });
  const [lo, hi] = footC(x, z, 6.5), y = hi;
  K.push(0, y, 0);
  K.geo('stone', cylM(6.4, 6.8, hi - lo + 0.6, 24), 0, 0.3 - (hi - lo + 0.6) / 2, 0);   // 둥근 단
  K.geo('marbleW', cylM(5.4, 5.6, 0.3, 24), 0, 0.42, 0);
  for (let i = 0; i < 3; i++) K.box('stone', 7 - i * 0.6, 0.22, 0.9, 0, 0.12 + i * 0.2 - 0.25, -6.6 + i * 0.6);   // 계단 (북쪽)
  for (const s of [-1, 1]){
    K.push(s * 4.3, 0.55, 0);
    K.box('marbleW', 2.0, 0.8, 2.0, 0, 0.4, 0); K.box('marble', 1.5, 8.4, 1.5, 0, 5.0, 0); K.box('marbleW', 1.9, 0.6, 1.9, 0, 9.3, 0);
    K.box('glowC', 0.1, 6.4, 0.5, -s * 0.76, 5.0, 0); K.box('gold', 1.6, 0.14, 1.6, 0, 1.0, 0); K.box('gold', 1.6, 0.14, 1.6, 0, 8.9, 0);
    K.pop();
  }
  // 아치
  const ag = new THREE.TorusGeometry(4.3, 0.75, 8, 28, Math.PI); K.geo('marble', ag, 0, 9.85, 0, 0, 0, 0, 1, 0.75, 1.4);
  K.geo('gold', new THREE.TorusGeometry(4.3, 0.12, 6, 28, Math.PI), 0, 9.85, 0.95, 0, 0, 0, 1, 0.75, 1);
  K.geo('gold', new THREE.TorusGeometry(4.3, 0.12, 6, 28, Math.PI), 0, 9.85, -0.95, 0, 0, 0, 1, 0.75, 1);
  K.box('marbleW', 1.2, 1.5, 1.6, 0, 13.3, 0); K.geo('glowC', new THREE.OctahedronGeometry(0.4, 0), 0, 13.4, 0.82, 0, 0, 0, 1, 1.5, 0.3);
  K.pop();
  // 포털 막 · 룬 고리 · 떠 있는 결정
  const pm = part(portalGeo(6.9, 12.3), portalMat(0x3fe6ff, 0x9a6aff), 0, y + 0.55, 0); pm.renderOrder = 2;
  const rg = part(X.polarRing(5.6, 6.3, 96), runeRingMat('#57ecff', 2, 24), 0, y + 0.6, 0); rg.rotation.x = 0;
  const cg = new THREE.Group(); cg.position.set(0, y + 16.2, 0); CUR.near.add(cg);
  const cr = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0).scale(0.7, 1.5, 0.7), MAT.crystal); cg.add(cr);
  const rings = [0, 1].map(i => { const r = new THREE.Mesh(new THREE.TorusGeometry(1.8 + i * 0.6, 0.05, 6, 48), MAT.glowC); r.rotation.x = Math.PI / 2 + (i ? 0.5 : -0.4); cg.add(r); return r; });
  const hs = X.glowSprite(0x6af0ff, 7, 0.55); cg.add(hs);
  anim((dt, t) => { cr.rotation.y += dt * 0.8; cg.position.y = y + 16.2 + Math.sin(t * 1.2) * 0.3; rings[0].rotation.z += dt * 0.7; rings[1].rotation.z -= dt * 0.5; rg.rotation.y += dt * 0.15; hs.material.opacity = 0.45 + Math.sin(t * 2.3) * 0.12; });
  motesFx(CUR.near, [0, y, 0], 5, LOW ? 24 : 44, '0.5, 0.95, 1.0', 11, 0.16);
  glowAbs(x - 4.3, y + 10, z, 0x6af0ff, 3.5, 0.6); glowAbs(x + 4.3, y + 10, z, 0x6af0ff, 3.5, 0.6);
  F.box(x - 4.3, z, 1.05, 1.05); F.box(x + 4.3, z, 1.05, 1.05); STATS.colliders += 2;
  for (const s of [-1, 1]) P.lamp(s * 8, -7.5, 'stone');
  F.addInteract({ x, z: z - 0.5, r: 4.2, title: '룬의 관문 · 광장으로', action: () => { if (!X.tpBusy && !X.dialogOpen) F.leave(); } });
  return finish();
}

// ───────────────────────── 공용 큰 조각 ─────────────────────────
// 바람개비 (인스턴스 · 정점색 날개 4장) — 축은 로컬 z
const PINW = (() => { const P2 = [], C = [], col = [0xff5a5a, 0xffd23a, 0x4aa8ff, 0x6ad06a].map(h => new THREE.Color(h));
  for (let i = 0; i < 4; i++){ const a = i * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), rot = (x, y) => [x * ca - y * sa, x * sa + y * ca, 0];
    for (const v of [rot(0, 0), rot(0.42, 0.06), rot(0.36, 0.34)]) P2.push(...v); for (let k = 0; k < 3; k++) C.push(col[i].r, col[i].g, col[i].b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals(); return g; })();
const PINM = std({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 });
function pinwheels(list){   // list: [[x, z, h, ry]] 그룹 로컬
  const im = new THREE.InstancedMesh(PINW, PINM, list.length); CUR.near.add(im); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new V3(), s = new V3(2.2, 2.2, 2.2);
  const data = list.map(([x, z, h, ry]) => { const y = gy(x, z); K.geo('woodD', cyl(0.03, 0.035, h, 5), x, y + h / 2, z); return [x, y + h, z, ry, R() * 6]; });
  const upd = t => { data.forEach(([x, y, z, ry, ph], i) => { e.set(0, ry, t * 5 + ph, 'YXZ'); q.setFromEuler(e); m4.compose(p.set(x, y, z), q, s); im.setMatrixAt(i, m4); }); im.instanceMatrix.needsUpdate = true; };
  upd(0); anim((dt, t) => upd(t));
}
// 큰 바위 더미 (메시 그룹 로컬)
function rockPile(x, z, r, n, key = 'rock', hmul = 1){ for (let i = 0; i < n; i++){ const a = R() * TAU, d = Math.sqrt(R()) * r, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, s = rr(0.8, 1.6) * (1.6 - d / r * 0.6); K.geo(key, rockG(s, rr(0.6, 1.0) * hmul), px, gy(px, pz) + s * 0.25, pz, 0, R() * TAU, 0); } }
// 가장자리 찾기: c 에서 dir 쪽으로 걸으며 가장 가파르게 떨어지는 곳 → [거리, 위 높이, 아래 높이]
function findEdge(cx, cz, dx, dz, maxD = 60){
  let bd = maxD * 0.5, bg = 0;
  for (let d = 2; d < maxD; d += 1){ const g = H(cx + dx * (d - 1.5), cz + dz * (d - 1.5)) - H(cx + dx * (d + 1.5), cz + dz * (d + 1.5)); if (g > bg){ bg = g; bd = d; } }
  let top = -1e9, bot = 1e9; for (let k = -10; k <= -1; k++) top = Math.max(top, H(cx + dx * (bd + k), cz + dz * (bd + k))); for (let k = 1; k <= 22; k++) bot = Math.min(bot, H(cx + dx * (bd + k), cz + dz * (bd + k)));
  return [bd, top, bot];
}

// ───────────────────────── 초록 언덕 ─────────────────────────
// 바람개비 언덕: 거대한 풍차 + 알록달록 바람개비 + 연 + 제피의 글라이더 노점
function bWindmill(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l });
  const mx = -3, mz = -5, [lo, hi] = footC(cx + mx, cz + mz, 4.6), y = hi; K.push(mx, y, mz);
  K.geo('stone', cylM(4.3, 4.7, 5.2 + (hi - lo), 8), 0, 2.6 - (hi - lo) / 2, 0, 0, Math.PI / 8, 0);
  K.geo('plaster', cylM(2.6, 3.6, 9.2, 8), 0, 9.7, 0, 0, Math.PI / 8, 0);
  for (let i = 0; i < 8; i++){ const a = i / 8 * TAU; K.push(Math.cos(a) * 3.1, 9.7, Math.sin(a) * 3.1, -a + Math.PI / 2); K.box('woodD', 0.22, 9.3, 0.22, 0, 0, 0.0, -0.11, 0, 0); K.pop(); }
  K.geo('woodD', cylM(4.9, 4.9, 0.25, 16), 0, 5.3, 0); for (let i = 0; i < 24; i++){ const a = i / 24 * TAU; K.box('woodD', 0.08, 1.0, 0.08, Math.cos(a) * 4.75, 5.9, Math.sin(a) * 4.75); } K.geo('woodD', tor(4.75, 0.05, 4, 32), 0, 6.4, 0, Math.PI / 2);
  K.geo('thatch', cone(3.3, 3.6, 10), 0, 16.1, 0); K.geo('woodD', cylM(3.0, 3.0, 0.5, 10), 0, 14.4, 0); K.geo('gold', sph(0.3, 8, 6), 0, 18.0, 0);
  K.box('pBlue', 1.3, 2.2, 0.15, 0, 1.6, 4.3); K.box('beam', 1.7, 0.25, 0.25, 0, 2.8, 4.35); for (const [a, h] of [[0.4, 9], [2.4, 11.5], [4.0, 8]]){ const wr = (3.6 - (h - 5.1) / 9.2) * 0.93; K.push(Math.cos(a) * wr, h, Math.sin(a) * wr, -a + Math.PI / 2, -0.1); win(0, 0, 0.7, 0.9, 'pBlue', false); K.pop(); }
  K.pop(); cc(mx, mz, 4.8); MAPBOX.push([cx + mx, cz + mz, 4.5, 4.5, 0]);
  // 날개 (남동쪽을 봐요)
  const face = 1.25, hub = new THREE.Group(); hub.position.set(mx + Math.sin(face) * 5.7, y + 14.2, mz + Math.cos(face) * 5.7);
  K.push(mx, y + 14.2, mz, face); K.geo('woodD', cyl(0.3, 0.38, 5.6, 8), 0, 0, 3.0, Math.PI / 2, 0, 0); K.pop(); hub.rotation.y = face; CUR.near.add(hub);
  const rot = new THREE.Group(); hub.add(rot); const SB = new LB(1e9), SK = new G.Kit(SB), pk = K, pb = B; K = SK; B = SB;
  K.geo('woodD', cyl(0.45, 0.45, 1.2, 10), 0, 0, 0, Math.PI / 2, 0, 0); K.geo('iron', cone(0.4, 0.6, 10), 0, 0, 0.8, Math.PI / 2, 0, 0);
  for (let i = 0; i < 4; i++){ K.push(0, 0, 0.3, 0, 0, i * Math.PI / 2); K.box('woodD', 0.32, 10.5, 0.22, 0, 5.4, 0); for (let j = 0; j < 9; j++) K.box('woodD', 1.9, 0.07, 0.07, 0.75, 1.6 + j * 1.05, 0.05); K.box('fabricW', 1.7, 8.6, 0.03, 0.85, 6.0, -0.02); for (const s of [0, 1.7]) K.box('woodD', 0.07, 8.8, 0.07, s, 6.0, 0.05); K.pop(); }
  for (const key in SB.g){ rot.add(meshOf(G.mergeGeos(SB.g[key]), MAT[key], true)); } K = pk; B = pb;
  B.far.push(['fabricW', new THREE.BoxGeometry(1.8, 21, 0.1).applyMatrix4(new THREE.Matrix4().makeRotationZ(0.6)).applyMatrix4(new THREE.Matrix4().makeRotationY(face)).translate(hub.position.x, hub.position.y, hub.position.z)]);
  B.far.push(['fabricW', new THREE.BoxGeometry(1.8, 21, 0.1).applyMatrix4(new THREE.Matrix4().makeRotationZ(0.6 + Math.PI / 2)).applyMatrix4(new THREE.Matrix4().makeRotationY(face)).translate(hub.position.x, hub.position.y, hub.position.z)]);
  anim(dt => { rot.rotation.z -= dt * 0.55; });
  // 바람개비 · 연
  const pw = []; for (let i = 0; i < 22; i++){ const a = R() * TAU, d = rr(8, 26), x = Math.cos(a) * d, z = Math.sin(a) * d; if (kept(cx + x, cz + z, 1.5) || roadD(cx + x, cz + z) < 1) continue; pw.push([x, z, rr(1.4, 2.2), rr(0, TAU)]); }
  pinwheels(pw);
  // 제피의 글라이더 노점 (제피 뒤 남서쪽)
  const zx = -138 - cx, zz = 480 - cz, sx = zx - 3.2, sz = zz + 3.6, sy = gy(sx, sz); K.push(sx, sy, sz, 2.4);
  K.box('wood', 3.2, 0.9, 1.0, 0, 0.45, 0); for (const px of [-1.5, 1.5]) for (const pz of [-0.7, 0.6]) K.box('woodD', 0.1, 2.6, 0.1, px, 1.3, pz); awning('awnB', 3.6, 0.06, 2.0, 0, 2.7, 0, 0.18);
  for (let i = 0; i < 2; i++){ K.push(-0.8 + i * 1.6, 2.2, -0.3); K.geo(i ? 'fabricY' : 'fabricR', triG([-0.9, 0, 0], [0.9, 0, 0], [0, 0, 0.8])); K.geo('woodD', cyl(0.02, 0.02, 1.8, 4), 0, 0, 0.1, 0, 0, Math.PI / 2); K.pop(); }
  K.pop(); cb(sx, sz, 1.7, 0.8, 2.4);
  // 연 (줄에 매달려 흔들려요)
  const kites = [0, 1, 2].map(i => { const g = new THREE.Group(), k = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0).scale(1, 1.3, 0.12), MAT[['fabricR', 'fabricY', 'fabricB'][i]]); g.add(k); const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.4, 0.02).translate(0, -1.6, 0), MAT.fabricW); g.add(tl); CUR.near.add(g); return { g, a: rr(0, TAU), r: rr(6, 10), h: rr(16, 24), ph: R() * 6 }; });
  anim((dt, t) => { for (const k of kites){ k.g.position.set(sx + Math.cos(k.a + Math.sin(t * 0.3 + k.ph) * 0.3) * k.r, sy + k.h + Math.sin(t * 0.9 + k.ph) * 1.2, sz + Math.sin(k.a) * k.r); k.g.rotation.z = Math.sin(t * 1.3 + k.ph) * 0.35; k.g.rotation.y = k.a; } });
  // 바람 자루 · 밀가루 자루 · 수레 · 꽃
  { const wx = 6, wz = -12, wy = gy(wx, wz); K.geo('woodD', cyl(0.07, 0.09, 6, 6), wx, wy + 3, wz); K.push(wx, wy + 5.8, wz, 2.0); for (let i = 0; i < 4; i++) K.geo(i % 2 ? 'fabricW' : 'fabricR', cyl(0.35 - i * 0.06, 0.3 - i * 0.06, 0.5, 8, true), 0, 0, 0.3 + i * 0.5, Math.PI / 2, 0, 0); K.pop(); cc(wx, wz, 0.2); }
  P.cart(-9, 3, 0.8, 'hay'); for (let i = 0; i < 5; i++) P.sack(-5 + rr(-1, 1), gy(-5, 1), 1 + rr(-1, 1), R() * 3); P.clutter(4, -1, 2, 0.8);
  P.fence(-14, -16, -4, -19, { col: true }); P.fence(-4, -19, 8, -18); P.bench(9, -6, -0.6);
  for (let i = 0; i < 60; i++){ const a = R() * TAU, d = rr(6, 27), x = Math.cos(a) * d, z = Math.sin(a) * d; if (roadD(cx + x, cz + z) < 1) continue; K.geo(pick(['flower', 'flowerY', 'flowerW', 'rose']), ico(rr(0.12, 0.2), 0), x, gy(x, z) + 0.15, z); }
  return finish();
}
// 늙은 떡갈나무: 천 년 나무 + 나무 위 오두막 + 그네
function bOak(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 220 });
  const y = gy(0, 0) - 0.5;
  K.geo('bark', tubeG([[0, -1, 0], [0.4, 4, 0.3], [-0.3, 8, -0.2], [0.2, 12, 0.3], [0, 14.5, 0]], 3.4, 2.1, 10, 6), 0, y, 0);
  for (let i = 0; i < 7; i++){ const a = i / 7 * TAU + 0.3, r1 = rr(7, 11); K.geo('bark', tubeG([[Math.cos(a) * 1.8, 3.2, Math.sin(a) * 1.8], [Math.cos(a) * 4.5, 1.2, Math.sin(a) * 4.5], [Math.cos(a) * r1, gy(Math.cos(a) * r1, Math.sin(a) * r1) - y - 0.4, Math.sin(a) * r1]], 1.3, 0.35, 7, 5), 0, y, 0); }
  const tips = [];
  for (let i = 0; i < 7; i++){ const a = i / 7 * TAU + 0.8, r1 = rr(8, 12.5), h1 = rr(17, 21); K.geo('bark', tubeG([[0, 11 + (i % 3), 0], [Math.cos(a) * r1 * 0.45, 14 + (i % 2), Math.sin(a) * r1 * 0.45], [Math.cos(a) * r1, h1, Math.sin(a) * r1]], 1.2, 0.35, 7, 5), 0, y, 0); tips.push([Math.cos(a) * r1, h1, Math.sin(a) * r1]); }
  const LK = ['leafA', 'leafB', 'leafC'];
  for (const [tx, ty, tz] of tips) for (let k = 0; k < 3; k++) K.geo(pick(LK), ico(rr(3.2, 4.6), 1), tx + rr(-2.5, 2.5), y + ty + rr(-0.5, 2.5), tz + rr(-2.5, 2.5), R(), R(), R(), 1, 0.8, 1);
  for (let k = 0; k < 9; k++){ const a = R() * TAU, d = rr(0, 7); K.geo(pick(LK), ico(rr(4, 5.5), 1), Math.cos(a) * d, y + rr(21, 26), Math.sin(a) * d, R(), R(), R(), 1, 0.8, 1); }
  for (let k = 0; k < 40; k++){ const a = R() * TAU, d = rr(5, 13); K.geo('acorn', sph(0.35, 6, 5), Math.cos(a) * d, y + rr(15, 22), Math.sin(a) * d); }
  cc(0, 0, 3.4);
  // 나무 위 오두막 (남쪽 가지 위)
  const ha = 1.9, hr = 5.5, hx = Math.cos(ha) * hr, hz = Math.sin(ha) * hr, hy = y + 11.5; K.push(hx, hy, hz, -ha + Math.PI / 2);
  K.geo('wood', cylM(3.4, 3.4, 0.3, 8), 0, 0, 0); for (let i = 0; i < 16; i++){ const a = i / 16 * TAU; K.box('woodD', 0.08, 1.0, 0.08, Math.cos(a) * 3.3, 0.6, Math.sin(a) * 3.3); } K.geo('woodD', tor(3.3, 0.05, 4, 24), 0, 1.1, 0, Math.PI / 2);
  K.box('wood', 3.2, 2.4, 2.6, 0.4, 1.35, -0.5); for (const s of [-1, 1]) K.box('thatch', 4.0, 0.3, 2.0, 0.4, 3.0, -0.5 + s * 0.85, s * 0.75); K.box('pRed', 0.9, 1.6, 0.06, 0.4, 0.95, 0.83); win(-0.9, 1.6, 0.6, 0.6, 'pGreen');
  for (let i = 0; i < 3; i++) K.geo('woodD', cyl(0.1, 0.12, 11.5, 6), Math.cos(i * 2.1) * 2.6, -5.75, Math.sin(i * 2.1) * 2.6);
  // 밧줄 사다리
  K.push(2.8, 0, 2.2); for (const s of [-1, 1]) K.geo('rope', cyl(0.035, 0.035, 11.5, 4), s * 0.35, -5.75, 0); for (let i = 0; i < 22; i++) K.box('wood', 0.8, 0.06, 0.12, 0, -0.5 - i * 0.5, 0); K.pop();
  K.geo('woodD', cyl(0.05, 0.05, 2.5, 5), -2.4, 2.2, -1.6); K.pop();
  flag(hx - 1.6, hy + 3.4, hz - 1.0, 0.4, 1.2, 0.7, 'fabricR');
  cc(hx, hz, 0.6);
  // 그네 (서쪽 가지)
  const tw = tips.slice().sort((a, b) => a[0] - b[0])[0], swx = tw[0] * 0.72, swz = tw[2] * 0.72, swy = (14 + tw[1]) / 2 - 0.6, rl = y + swy - gy(swx, swz) - 0.8;
  const sw = new THREE.Group(); sw.position.set(swx, y + swy, swz); CUR.near.add(sw);
  for (const s of [-1, 1]){ const r = new THREE.Mesh(cyl(0.03, 0.03, rl, 4), MAT.rope); r.position.set(s * 0.6, -rl / 2, 0); sw.add(r); } const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.5), MAT.wood); seat.position.y = -rl; sw.add(seat);
  anim((dt, t) => { sw.rotation.x = Math.sin(t * 1.3) * 0.12; });
  // 발치: 도토리 · 버섯 · 표석 · 벤치
  for (let i = 0; i < 6; i++){ const a = R() * TAU, d = rr(5, 12), x = Math.cos(a) * d, z = Math.sin(a) * d; K.geo('acorn', sph(0.55, 8, 6), x, gy(x, z) + 0.45, z, 0, 0, 0, 1, 1.2, 1); K.geo('woodD', sph(0.6, 8, 4, 0, TAU, 0, Math.PI / 2), x, gy(x, z) + 0.75, z); }
  P.mushrooms(4, -6, 6, 'glowM'); P.bench(-6, 9, 2.6); P.bench(7, 8, -2.4); P.statue(0, 13, Math.PI, 'mossy', 1.6);
  motesFx(CUR.near, [0, y + 12, 0], 14, LOW ? 20 : 40, '1.0, 0.95, 0.6', 12, 0.14);
  return finish();
}
// 양치기 오두막: 젤리 슬라임 목장
function bFarm(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l });
  house(-9, -7, 0.5, { w: 6.5, d: 5.5, roof: 'thatch', paint: 'pGreen' });
  // 빨간 헛간
  { const bx = 8, bz = -10, [lo, hi] = foot(cx + bx, cz + bz, 4.5, 3.5, -0.2), y = hi; K.push(bx, y, bz, -0.2); K.box('stone', 9.2, hi - lo + 0.6, 7.2, 0, 0.3 - (hi - lo + 0.6) / 2, 0); K.box('pRed', 9, 4.2, 7, 0, 2.4, 0);
    const rise = roofG(9, 7, 4.5, 0.9, 0.5, 'shingle'); gables(9, 7, 4.5, rise, 'pRed', false); K.box('woodD', 3, 3.2, 0.1, 0, 1.9, 3.52); for (const s of [-1, 1]) K.box('fabricW', 0.15, 3.4, 0.05, s * 0.75, 1.9, 3.58, 0, 0, s * 0.75); K.box('fabricW', 3.1, 0.15, 0.05, 0, 3.5, 3.58);
    K.pop(); cb(bx, bz, 4.7, 3.7, -0.2); MAPBOX.push([cx + bx, cz + bz, 4.6, 3.6, -0.2]);
    pinwheels([[bx + 3, bz - 1, 9.5, -0.2]]); }
  // 원형 울타리 목장
  const px = 4, pz = 6, pr = 11, n = 20;
  for (let i = 0; i < n; i++){ if (i === 14 || i === 15) continue; const a0 = i / n * TAU, a1 = (i + 1) / n * TAU; P.fence(px + Math.cos(a0) * pr, pz + Math.sin(a0) * pr, px + Math.cos(a1) * pr, pz + Math.sin(a1) * pr, { gap: 1.8, cap: 'woodD' }); }
  // 젤리 양 (인스턴스 몸 + 눈) — 통통 튀어요
  const NS = 8, body = new THREE.InstancedMesh(sph(0.9, 14, 10), MAT.jellyG, NS), eye = new THREE.InstancedMesh(sph(0.11, 6, 4), MAT.dark, NS * 2), wool = new THREE.InstancedMesh(ico(0.5, 1), MAT.fabricW, NS);
  CUR.near.add(body, eye, wool); body.castShadow = true;
  const sl = []; for (let i = 0; i < NS; i++){ const a = R() * TAU, d = Math.sqrt(R()) * (pr - 2.5), x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d; sl.push({ x, z, y: gy(x, z), ry: R() * TAU, ph: R() * 6, s: rr(0.75, 1.15) }); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new V3(), sc = new V3(), off = new V3();
  const upd = t => { sl.forEach((o, i) => { const b = Math.abs(Math.sin(t * 2.4 + o.ph)), sq = 1 - b * 0.18, h = b * 0.5;
    e.set(0, o.ry + Math.sin(t * 0.3 + o.ph) * 0.6, 0); q.setFromEuler(e); m4.compose(v.set(o.x, o.y + 0.75 * o.s * sq + h, o.z), q, sc.set(o.s * (2 - sq), o.s * sq * 0.85, o.s * (2 - sq))); body.setMatrixAt(i, m4);
    m4.compose(v.set(o.x, o.y + 1.45 * o.s * sq + h, o.z), q, sc.set(o.s, o.s * 0.5, o.s)); wool.setMatrixAt(i, m4);
    for (const s of [-1, 1]){ off.set(s * 0.32 * o.s, 0.95 * o.s * sq + h, 0.78 * o.s).applyQuaternion(q); m4.compose(v.set(o.x + off.x, o.y + off.y, o.z + off.z), q, sc.set(1, 1.4, 1)); eye.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), m4); } });
    body.instanceMatrix.needsUpdate = eye.instanceMatrix.needsUpdate = wool.instanceMatrix.needsUpdate = true; };
  upd(0); anim((dt, t) => upd(t));
  // 물통 · 건초 · 허수아비 · 팻말
  { const tx = px + 3, tz = pz - 5, ty = gy(tx, tz); K.push(tx, ty, tz, 0.4); K.box('wood', 2.4, 0.6, 0.8, 0, 0.4, 0); K.box('water', 2.2, 0.05, 0.6, 0, 0.66, 0); K.pop(); }
  P.hay(px - 5, pz + 2, 0.3); P.hay(px - 4, pz + 4.5, 1.2); P.hayStack(-14, 4); P.hayStack(-12, 8);
  { const uv = signCell('말랑 목장', '', 'NO FEEDING'), sx = px - 3, sz = pz + pr + 1.2, sy = gy(sx, sz); K.push(sx, sy, sz, 0.1); K.geo('woodD', cyl(0.08, 0.1, 2.2, 6), 0, 1.1, 0); K.box('wood', 2.4, 0.6, 0.08, 0, 1.9, 0); for (const s of [-1, 1]) K.geo('signA', quadUV(2.3, 0.5, uv), 0, 1.9, s * 0.045, 0, s > 0 ? 0 : Math.PI, 0); K.pop(); cc(sx, sz, 0.2); }
  P.clutter(-4, -12, 2); P.lamp(-3, -2, 'wood');
  return finish();
}
// 말랑 웅덩이: 젤리 웅덩이 · 알 · 거품
function bPonds(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l });
  add('goo', std({ color: 0x3ac8ff, roughness: 0.1, transparent: true, opacity: 0.85, emissive: 0x1a6ad0, emissiveIntensity: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  add('gooG', std({ color: 0x5aea70, roughness: 0.1, transparent: true, opacity: 0.85, emissive: 0x1aa03a, emissiveIntensity: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  add('gooP', std({ color: 0xff6ac8, roughness: 0.1, transparent: true, opacity: 0.85, emissive: 0xa02a7a, emissiveIntensity: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  const pools = [[-10, -6, 4.5, 'goo'], [9, -9, 3.2, 'gooG'], [12, 8, 4.0, 'goo'], [-6, 12, 3.0, 'gooP'], [-17, 6, 2.6, 'gooG'], [2, 1, 2.2, 'gooP']], bub = [];
  for (const [x, z, r, key] of pools){
    const g = new THREE.RingGeometry(0.001, r, 28, 4).rotateX(-Math.PI / 2); g.translate(x, 0, z); drape(g, cx, cz, 0.09); K.geo(key, g);
    for (let i = 0; i < Math.round(r * 4); i++){ const a = i / Math.round(r * 4) * TAU + rr(-0.1, 0.1), px = x + Math.cos(a) * (r + 0.3), pz = z + Math.sin(a) * (r + 0.3); K.geo(i % 4 ? 'rock' : 'mossy', rockG(rr(0.25, 0.5), 0.6, 0), px, gy(px, pz) + 0.1, pz); }
    for (let i = 0; i < 3; i++){ const a = R() * TAU, d = rr(0.3, r * 0.7), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; K.geo(key === 'goo' ? 'jelly' : 'jellyG', sph(rr(0.25, 0.45), 10, 8), px, gy(px, pz) + 0.25, pz, 0, 0, 0, 1, 0.8, 1); }
    bub.push(new V3(x, gy(x, z) + 0.1, z));
  }
  // 슬라임 알 무더기 · 이끼 바위 아치 · 경고 팻말
  for (const [x, z] of [[-1, -13], [17, -2], [-19, -4]]) for (let i = 0; i < 5; i++){ const px = x + rr(-1, 1), pz = z + rr(-1, 1); K.geo(pick(['jelly', 'jellyG']), sph(rr(0.35, 0.6), 10, 8), px, gy(px, pz) + 0.35, pz, 0, 0, 0, 1, 1.25, 1); }
  { const ax = 20, az = -14, ay = gy(ax, az); K.push(ax, ay, az, 0.5); K.geo('mossy', tubeG([[-3, -0.5, 0], [-2.6, 3, 0], [0, 5, 0], [2.6, 3, 0], [3, -0.5, 0]], 1.1, 0.9, 7, 5)); K.pop(); cc(ax - 2.6, az, 1.2); cc(ax + 2.6, az, 1.2); }
  { const uv = signCell('말랑 웅덩이', '', 'SLIME POOLS'), sx = 22, sz = 12, sy = gy(sx, sz); K.push(sx, sy, sz, -0.9); K.geo('woodD', cyl(0.08, 0.1, 2.2, 6), 0, 1.1, 0); K.box('wood', 2.4, 0.6, 0.08, 0, 1.9, 0); for (const s of [-1, 1]) K.geo('signA', quadUV(2.3, 0.5, uv), 0, 1.9, s * 0.045, 0, s > 0 ? 0 : Math.PI, 0); K.pop(); cc(sx, sz, 0.2); }
  G.particles(LOW ? 30 : 60, bub, { parent: CUR.near, vert: `float life = fract(uTime * 0.35 + aSeed); vL = life; vec3 p = position + vec3(sin(aSeed * 40.0) * 1.6 * fract(aSeed * 3.3), life * 1.6, cos(aSeed * 30.0) * 1.6 * fract(aSeed * 5.1)); float sz = 0.25 * (0.4 + life);`,
    frag: `float r = smoothstep(0.5, 0.38, d) * smoothstep(0.2, 0.42, d); float a = (r * 0.9 + smoothstep(0.5, 0.0, d) * 0.15) * (1.0 - vL); gl_FragColor = vec4(vec3(0.7, 0.95, 1.0) * a, a);` });
  return finish();
}
// 벌꿀 언덕: 거대한 벌집 탑 · 벌통 줄 · 양봉가 오두막
function bApiary(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l });
  const y = gy(0, 0) - 0.4;
  K.push(0, y, 0);
  const cells = [[0, 0, 7], [1, 0, 5], [0, 1, 6], [-1, 1, 4], [-1, 0, 5], [0, -1, 6], [1, -1, 3], [2, -1, 2], [-2, 1, 2], [1, 1, 3], [-1, -1, 2]];
  for (const [q, r, n] of cells){ const hx = 1.62 * r * 0.866, hz = 1.62 * (q + r / 2); for (let k = 0; k < n; k++){ K.geo(k % 2 ? 'honey' : 'honey2', cyl(0.94, 0.94, 1.6, 6), hx, 0.8 + k * 1.62, hz, 0, Math.PI / 6, 0); if (k === n - 1) K.geo('honey', cone(0.35, 1.2, 6), hx, 0.8 + k * 1.62 - 1.3, hz + 0.75, Math.PI, 0, 0); } }
  K.geo('honey', sph(1.2, 10, 8), 0, 12.4, 0, 0, 0, 0, 1, 0.7, 1); K.geo('woodD', cyl(0.06, 0.06, 2.5, 5), 0, 13.6, 0); flag(0, y + 14.8, 0, 0.5, 1.4, 0.8, 'fabricY');
  K.pop(); cc(0, 0, 3.2);
  // 벌통 줄 (상자 · 짚 벌통)
  for (let row = 0; row < 3; row++) for (let i = 0; i < 5; i++){ const x = -12 + i * 3.2, z = 8 + row * 3.4; if (kept(cx + x, cz + z, 1)) continue; const hy = gy(x, z); K.push(x, hy, z, 0.1);
    if ((i + row) % 2){ K.box('woodD', 1.0, 0.4, 0.8, 0, 0.2, 0); for (let k = 0; k < 3; k++) K.box(k % 2 ? 'plaster2' : 'plaster', 0.9, 0.32, 0.7, 0, 0.56 + k * 0.33, 0); K.box('roof2', 1.05, 0.08, 0.85, 0, 1.55, 0); K.box('dark', 0.4, 0.05, 0.02, 0, 0.45, 0.36); }
    else { K.geo('woodD', cyl(0.06, 0.06, 1.0, 5), 0, 0.5, 0); K.box('wood', 0.9, 0.06, 0.9, 0, 1.0, 0); K.geo('hay', lathe([[0, 0], [0.42, 0], [0.45, 0.25], [0.38, 0.55], [0.22, 0.75], [0, 0.82]], 12, 0.4), 0, 1.03, 0); K.geo('dark', new THREE.CircleGeometry(0.09, 8), 0, 1.15, 0.43); }
    K.pop(); cc(x, z, 0.6); }
  // 양봉가 오두막 · 꿀단지 탁자
  house(13, -8, -2.2, { w: 6, d: 5, roof: 'thatch', paint: 'pTeal' });
  { const tx = 9, tz = 0, ty = gy(tx, tz); K.push(tx, ty, tz, -0.6); K.box('wood', 1.8, 0.08, 0.9, 0, 0.85, 0); for (const sx of [-0.8, 0.8]) for (const sz of [-0.35, 0.35]) K.box('woodD', 0.08, 0.85, 0.08, sx, 0.42, sz);
    for (let i = 0; i < 6; i++){ K.geo('glass', cyl(0.12, 0.12, 0.26, 8), -0.6 + i * 0.24, 1.02, rr(-0.2, 0.2)); K.geo('honey', cyl(0.11, 0.11, 0.2, 8), -0.6 + i * 0.24, 1.0, rr(-0.2, 0.2)); } K.pop(); cc(tx, tz, 1); }
  // 해바라기 · 꽃
  const sun = []; for (let i = 0; i < 26; i++){ const a = R() * TAU, d = rr(6, 22), x = Math.cos(a) * d, z = Math.sin(a) * d; if (kept(cx + x, cz + z, 1) || roadD(cx + x, cz + z) < 1.5 || Math.hypot(x - 13, z + 8) < 5 || (z > 6 && z < 17 && x > -14 && x < 3)) continue; sun.push([cx + x, cz + z, rr(0.8, 1.2)]); }
  { const im = new THREE.InstancedMesh(X.treeGeo('sunflower'), X.TREEMAT, sun.length); sun.forEach((t, i) => im.setMatrixAt(i, G.mat(t[0] - cx, H(t[0], t[1]), t[1] - cz, 0, rr(-0.5, 0.5) + 2.6, 0, t[2], t[2], t[2]))); im.castShadow = true; CUR.near.add(im); }
  motesFx(CUR.near, [0, y + 2, 0], 16, LOW ? 30 : 60, '1.0, 0.85, 0.2', 4, 0.12);
  return finish();
}
// 매의 절벽: 절벽 끝 전망대 · 매 토템 · 망원경
function bOverlook(l){
  const [cx, cz] = l.c, bl = (W.bluffs || []).find(b => Math.hypot(b.c[0] - cx, b.c[1] - cz) < 60), dir = bl ? bl.dir : Math.PI;
  begin(l.id, cx, cz, { lm: l, nearR: 260 });
  const dx = Math.cos(dir), dz = Math.sin(dir), [ed, top, bot] = findEdge(cx, cz, dx, dz, 40), ry = Math.atan2(dx, dz);
  const ex = dx * (ed - 2), ez = dz * (ed - 2), yTop = Math.max(top, gy(ex, ez)) + 0.35, len = 9;
  // 전망대 데크 (절벽 밖으로)
  K.push(ex, yTop, ez, ry);
  K.box('wood', 4.2, 0.25, len + 3, 0, 0, len / 2 - 1.5);
  for (let i = 0; i < 6; i++){ const zz = -1 + i * (len + 1) / 5; for (const s of [-1, 1]){ const g = gyk(s * 1.9, zz), hgt = yTop - g + 1; K.geo('woodD', cyl(0.14, 0.16, hgt, 6), s * 1.9, -hgt / 2 + 0.1, zz); if (hgt > 3) K.box('woodD', 0.08, 0.08, 2.6, s * 1.9, -hgt * 0.45, zz + 0.9, 0.9); } }
  for (const s of [-1, 1]){ for (let i = 0; i <= 8; i++) K.box('woodD', 0.1, 1.1, 0.1, s * 2.0, 0.65, -1.5 + i * (len + 1.5) / 8); K.box('wood', 0.1, 0.1, len + 1.6, s * 2.0, 1.2, len / 2 - 0.75); }
  K.box('fabricR', 1.2, 0.04, 2.0, 0, 0.16, len); K.box('wood', 0.9, 0.06, 1.6, 0, 0.35, len + 0.6, -0.25);   // 점프대
  K.pop();
  { const a = [ex, ez], b = [ex + dx * len, ez + dz * len]; platSeg(cx + a[0] - dx * 3, cz + a[1] - dz * 3, cx + b[0] + dx * 1.2, cz + b[1] + dz * 1.2, 4.0, yTop + 0.13);
    for (const s of [-1, 1]){ const px = -dz * s * 2.05, pz = dx * s * 2.05; K.push(ex + px + dx * len / 2, 0, ez + pz + dz * len / 2, ry); cb(0, 0, 0.12, len / 2 + 1.2); K.pop(); } }
  // 매 토템 (돌기둥 위 날개 편 매)
  const tx = -dx * 6 - dz * 5, tz = -dz * 6 + dx * 5, ty = gy(tx, tz) - 0.3; K.push(tx, ty, tz, ry);
  K.box('stone', 2.4, 1.0, 2.4, 0, 0.5, 0); K.geo('stone', cylM(0.8, 1.0, 10, 6), 0, 6, 0); K.geo('mossy', cylM(1.05, 1.05, 0.6, 6), 0, 3, 0); K.geo('mossy', cylM(0.95, 0.95, 0.5, 6), 0, 7.5, 0);
  K.push(0, 11.2, 0); K.geo('stoneD', sph(1.0, 10, 8), 0, 0, 0, 0, 0, 0, 0.9, 1.3, 1.0); K.geo('stoneD', sph(0.6, 8, 6), 0, 1.5, 0.3); K.geo('gold', cone(0.25, 0.7, 6), 0, 1.4, 1.0, Math.PI / 2, 0, 0);
  for (const s of [-1, 1]){ K.push(s * 0.6, 0.4, 0, 0, 0, s * -0.35); for (let f = 0; f < 6; f++) K.box('stoneD', 1.0, 0.18, 3.2 - f * 0.3, s * (1.0 + f * 0.85), f * 0.08, -0.2 - f * 0.15, 0, s * 0.08 * f, 0); K.pop(); }
  K.geo('glowC', new THREE.OctahedronGeometry(0.22, 0), 0, 1.65, 0.75); K.pop(); K.pop(); cc(tx, tz, 1.3); glow(tx, ty + 12.8, tz, 0x6af0ff, 1.6, 0.5);
  // 망원경 · 벤치 · 바람 깃발
  { const sx = ex - dx * 1.5 + dz * 3.2, sz = ez - dz * 1.5 - dx * 3.2, sy = gy(sx, sz); K.push(sx, sy, sz, ry); for (let i = 0; i < 3; i++) K.geo('woodD', cyl(0.04, 0.05, 1.3, 5), Math.cos(i * 2.1) * 0.3, 0.6, Math.sin(i * 2.1) * 0.3, Math.sin(i * 2.1) * 0.25, 0, -Math.cos(i * 2.1) * 0.25); K.geo('brass', cyl(0.09, 0.14, 1.3, 10), 0, 1.35, 0.2, 1.3, 0, 0); K.pop(); cc(sx, sz, 0.4); }
  P.bench(-dx * 4 + dz * 2, -dz * 4 - dx * 2, ry + Math.PI);
  { const p1 = [tx, gy(tx, tz) + 9, tz], p2 = [ex + dz * 3, yTop + 3.5, ez - dx * 3]; K.geo('woodD', cyl(0.06, 0.08, 3.6, 5), p2[0], yTop + 1.7, p2[2]); P.pennants([p1, p2], 0.8, ['fabricR', 'fabricY', 'fabricB', 'fabricG', 'fabricW']); }
  return finish();
}

// ───────────────────────── 은빛 호수 ─────────────────────────
// 등불 바위: 호숫가 바위 위의 빨강-하양 등대 · 밤에 도는 빛줄기
function bLighthouse(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 300 });
  const base = Math.max(gy(0, 0), WLL) + 2.2;
  for (let i = 0; i < 16; i++){ const a = i / 16 * TAU + rr(-0.1, 0.1), d = rr(4.5, 8), x = Math.cos(a) * d, z = Math.sin(a) * d, g = Math.min(gy(x, z), WLL - 0.5), s = rr(1.8, 3.0); K.geo('rock', rockG(s, 1.1), x, g + (base - g) * 0.55, z, 0, R() * TAU, 0, 1, (base - g + 1) / (s * 1.6), 1); }
  K.geo('rock', rockG(5.2, 0.7), 0, base - 2.4, 0); K.geo('mossy', cylM(3.4, 3.8, 1.2, 12), 0, base + 0.2, 0);
  K.push(0, base + 0.8, 0);
  const tH = 13, bands = 5; for (let i = 0; i < bands; i++){ const r0 = 2.5 - i / bands * 0.7, r1 = 2.5 - (i + 1) / bands * 0.7; K.geo(i % 2 ? 'pRed' : 'plaster', cylM(r1, r0, tH / bands, 16), 0, (i + 0.5) * tH / bands, 0); }
  for (const h of [3.5, 7.2, 10.4]) { K.push(0, h, 0, 0.4 + h); K.push(0, 0, 2.5 - h / tH * 0.7); win(0, 0, 0.5, 0.8, 'pBlue', false); K.pop(); K.pop(); }
  K.box('pBlue', 1.0, 2.0, 0.2, 0, 1.0, 2.45);
  K.geo('iron', cylM(2.6, 2.6, 0.25, 16), 0, tH + 0.1, 0); for (let i = 0; i < 20; i++){ const a = i / 20 * TAU; K.box('iron', 0.06, 1.0, 0.06, Math.cos(a) * 2.5, tH + 0.7, Math.sin(a) * 2.5); } K.geo('iron', tor(2.5, 0.04, 4, 28), 0, tH + 1.2, 0, Math.PI / 2);
  K.geo('glowY', cylM(1.35, 1.35, 2.0, 12), 0, tH + 1.3, 0); for (let i = 0; i < 6; i++){ const a = i / 6 * TAU; K.box('iron', 0.1, 2.1, 0.1, Math.cos(a) * 1.4, tH + 1.3, Math.sin(a) * 1.4); }
  K.geo('pRed', cone(1.8, 1.7, 16), 0, tH + 3.1, 0); K.geo('iron', cyl(0.05, 0.05, 1.4, 5), 0, tH + 4.4, 0); K.geo('gold', sph(0.2, 8, 6), 0, tH + 5.1, 0);
  K.pop();
  // 관리인 오두막 · 돌계단
  { const hx = -6, hz = 4, hy = Math.max(gy(hx, hz), base - 0.5); K.push(hx, hy, hz, -1.2); K.box('stone', 4.2, 2.6, 3.4, 0, 1.3, 0); const rise = roofG(4.2, 3.4, 2.6, 0.7, 0.3, 'slate'); gables(4.2, 3.4, 2.6, rise, 'stone', false); K.box('pBlue', 0.9, 1.7, 0.08, 0, 0.85, 1.72); K.pop(); cb(hx, hz, 2.2, 1.8, -1.2); }
  for (let i = 0; i < 8; i++){ const t = i / 7, x = lerp(-12, -3.2, t), z = lerp(-6, -1.5, t), yy = lerp(gy(-12, -6), base + 0.6, t); K.box('stone', 1.6, 0.35, 1.0, x, yy, z, 0, 0.47, 0); }
  cc(0, 0, 3.6);
  // 회전 빛줄기
  const bm = new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const beam = new THREE.Group(); beam.position.set(0, base + 0.8 + tH + 1.3, 0); CUR.near.add(beam);
  for (const s of [-1, 1]){ const c = new THREE.Mesh(new THREE.ConeGeometry(3.2, 46, 16, 1, true).translate(0, -23, 0).rotateZ(s * Math.PI / 2), bm); beam.add(c); }
  const gs = X.glowSprite(0xffe890, 9, 0.6); beam.add(gs);
  anim((dt, t) => { beam.rotation.y += dt * 0.7; bm.opacity = 0.05 + 0.3 * nightK; gs.material.opacity = 0.35 + 0.5 * nightK; });
  glowAbs(cx, base + 0.8 + tH + 1.3, cz, 0xffe070, 7, 0.5);
  return finish();
}
// 호수의 정자: 팔각 대리석 정자 폐허 · 떠 있는 룬 결정 · 벚나무
function bPavilion(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 280 });
  const [lo, hi] = footC(cx, cz, 7.5), y = hi + 0.1;
  K.push(0, y, 0);
  K.geo('marbleW', cylM(7.6, 8.0, 0.5 + hi - lo, 8), 0, 0.25 - (hi - lo) / 2, 0, 0, Math.PI / 8, 0); K.geo('marble', cylM(6.6, 6.8, 0.35, 8), 0, 0.65, 0, 0, Math.PI / 8, 0);
  const tall = [1, 1, 1, 1, 1, 0.3, 0.55, 0.7];
  for (let i = 0; i < 8; i++){ const a = i / 8 * TAU, x = Math.cos(a) * 6, z = Math.sin(a) * 6, h = 5.6 * tall[i]; K.box('marbleW', 1.0, 0.4, 1.0, x, 1.0, z); K.geo('marble', cylM(0.36, 0.42, h, 12), x, 1.2 + h / 2, z); if (tall[i] === 1) K.box('marbleW', 0.95, 0.3, 0.95, x, 1.35 + h, z); else K.geo('marble', cone(0.38, 0.4, 7), x, 1.2 + h + 0.15, z, rr(-0.4, 0.4), 0, rr(-0.4, 0.4)); cc(x, z, 0.5); }
  // 남은 지붕 (반쪽 돔 + 처마)
  K.geo('marbleW', ringBandG(5.6, 6.6, 0, 0.8, -0.3, 3.4), 0, 6.95, 0);
  K.geo('marble', new THREE.SphereGeometry(6.3, 24, 10, -0.3, 3.6, 0, Math.PI / 2), 0, 7.7, 0, 0, 0, 0, 1, 0.55, 1);
  K.geo('gold', sph(0.35, 10, 8), Math.cos(1.5) * 0.5, 11.2, Math.sin(1.5) * 0.5);
  for (let i = 0; i < 5; i++){ const a = rr(3.5, 6.0), d = rr(7.5, 10); K.geo('marble', rockG(rr(0.4, 0.8), 0.6, 0), Math.cos(a) * d, gy(Math.cos(a) * d, Math.sin(a) * d) - y + 0.2, Math.sin(a) * d); }
  // 룬 받침대
  K.geo('marbleW', lathe([[0.9, 0.8], [0.7, 0.95], [0.45, 1.1], [0.38, 1.9], [0.7, 2.1], [0.75, 2.25], [0, 2.25]], 20, 0.4));
  K.pop(); cc(0, 0, 1.0);
  const rg = part(X.polarRing(2.6, 3.2, 64), runeRingMat('#57ecff', 7, 14), 0, y + 1.05, 0);
  const cg = new THREE.Group(); cg.position.set(0, y + 3.6, 0); CUR.near.add(cg); const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0).scale(1, 1.6, 1), MAT.crystal); cg.add(cr); cg.add(X.glowSprite(0x6af0ff, 4, 0.5));
  anim((dt, t) => { cr.rotation.y += dt; cg.position.y = y + 3.6 + Math.sin(t * 1.4) * 0.25; rg.rotation.y -= dt * 0.2; });
  glowAbs(cx, y + 3.6, cz, 0x6af0ff, 3, 0.6);
  // 벚나무 (분홍 덩어리)
  { const tx = -9, tz = 6, ty = gy(tx, tz) - 0.3; K.geo('bark', tubeG([[0, 0, 0], [0.5, 2.5, 0.2], [-0.2, 4.5, 0.4]], 0.5, 0.25, 7, 5), tx, ty, tz); for (let i = 0; i < 7; i++) K.geo('pink', ico(rr(1.3, 2.0), 1), tx + rr(-2, 2), ty + rr(4.5, 6.5), tz + rr(-2, 2)); cc(tx, tz, 0.6);
    G.particles(LOW ? 20 : 40, [new V3(tx, ty + 6, tz)], { parent: CUR.near, vert: `float f = fract(uTime * 0.07 + aSeed); vec3 p = position + vec3(sin(uTime + aSeed * 30.0) * 2.0 + f * 3.0, -f * 6.5, cos(uTime * 0.7 + aSeed * 20.0) * 2.0); vL = 1.0 - smoothstep(0.8, 1.0, f); float sz = 0.15;`,
      frag: `float a = smoothstep(0.5, 0.0, d) * vL; gl_FragColor = vec4(vec3(1.0, 0.72, 0.84) * a, a);`, blend: THREE.NormalBlending }); }
  return finish();
}
// 링 띠 (부분 각도) — 정자 처마
function ringBandG(r0, r1, y0, y1, a0, a1){ return G.ringBand(r0, r1, y0, y1, 24, { o: 1, i: 1, t: 1, b: 1 }, a0, a1); }
// 다리: WORLD.bridges 중 가장 가까운 것. 축은 (1) 세계가 높여 둔 땅이 평평한 쪽 (2) 없으면 강에 수직인 쪽
function bBridge(l){
  const br = W.bridges.slice().sort((a, b) => Math.hypot(a.c[0] - l.c[0], a.c[1] - l.c[1]) - Math.hypot(b.c[0] - l.c[0], b.c[1] - l.c[1]))[0]; if (!br) return;
  const [cx, cz] = br.c; begin(l.id, cx, cz, { lm: l });
  const axes = [[Math.sin(br.ry), Math.cos(br.ry)], [Math.cos(br.ry), -Math.sin(br.ry)]], hc = H(cx, cz);
  const flat = ax => { let e = 0; for (let t = -0.4; t <= 0.4; t += 0.1) e += Math.abs(H(cx + ax[0] * t * br.len, cz + ax[1] * t * br.len) - hc); return e; };
  let rv = null, rb = 1e9; for (const r of W.rivers) for (let i = 0; i < r.pts.length - 1; i++){ const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], t = clamp(((cx - ax) * (bx - ax) + (cz - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2), 0, 1), d = Math.hypot(cx - ax - (bx - ax) * t, cz - az - (bz - az) * t); if (d < rb){ rb = d; const L = Math.hypot(bx - ax, bz - az); rv = [(bx - ax) / L, (bz - az) / L]; } }
  const wb = F.bridges && F.bridges.find(b => b.id === br.id && b.ux != null && b.yAt);
  const f0 = flat(axes[0]), f1 = flat(axes[1]), perp = ax => rv ? 1 - Math.abs(ax[0] * rv[0] + ax[1] * rv[1]) : 0;
  const ax = wb ? [wb.ux, wb.uz] : Math.abs(f0 - f1) > 1.0 ? (f0 < f1 ? axes[0] : axes[1]) : (perp(axes[0]) >= perp(axes[1]) ? axes[0] : axes[1]);
  const ry = Math.atan2(ax[0], ax[1]), L = wb ? wb.len : br.len, w = br.w, n = 14, stone = l.id === 'moonbridge';
  const ys = []; for (let i = 0; i <= n; i++){ const t = i / n - 0.5; ys.push(wb ? wb.yAt(i / n) + 0.02 : Math.max(H(cx + ax[0] * t * L, cz + ax[1] * t * L), WLL + 0.7, hc) + 0.12); }
  K.push(0, 0, 0, ry);
  for (let i = 0; i < n; i++){ const z0 = (i / n - 0.5) * L, z1 = ((i + 1) / n - 0.5) * L, y0 = ys[i], y1 = ys[i + 1], seg = Math.hypot(z1 - z0, y1 - y0), pit = -Math.atan2(y1 - y0, z1 - z0);
    K.push(0, (y0 + y1) / 2, (z0 + z1) / 2); if (stone){ K.box('marbleW', w, 0.5, seg + 0.05, 0, -0.2, 0, pit); for (const s of [-1, 1]){ K.box('marble', 0.4, 0.9, seg + 0.05, s * (w / 2 - 0.2), 0.45, 0, pit); K.box('marbleW', 0.5, 1.5, seg + 0.05, s * (w / 2 - 0.25), -0.95, 0, pit); } }
    else { for (let k = 0; k < 4; k++) K.box(k % 3 ? 'wood' : 'woodD', w, 0.12, seg / 4 - 0.04, 0, -0.06, -seg / 2 + (k + 0.5) * seg / 4, pit); for (const s of [-1, 1]) K.box('woodD', 0.12, 0.2, seg, s * (w / 2 - 0.05), -0.18, 0, pit); }
    K.pop(); platSeg(cx + ax[0] * z0, cz + ax[1] * z0, cx + ax[0] * z1, cz + ax[1] * z1, w - 0.6, y0, y1); }
  // 기둥 · 아치 · 난간
  const bed = Math.min(...ys) - 4.5;
  if (stone){
    for (const t of [-0.5, -0.17, 0.17, 0.5]){ const i = Math.round((t + 0.5) * n), yy = ys[i]; K.box('marbleW', w + 0.4, yy - bed, 1.6, 0, (yy + bed) / 2 - 0.3, t * L); }
    for (const t of [-0.335, 0, 0.335]){ const i = Math.round((t + 0.5) * n), yy = ys[i]; const ar = L * 0.13; for (const s of [-1, 1]) K.geo('marbleW', new THREE.TorusGeometry(ar, 0.5, 6, 16, Math.PI), s * (w / 2 - 0.25), yy - 1.2 - (ar + 0.5) * 0.9, t * L, 0, Math.PI / 2, 0, 1, 0.9, 1); }
    for (const s of [-1, 1]) for (const t of [-0.5, 0.5]){ const i = Math.round((t + 0.5) * n), yy = ys[i]; K.box('marbleW', 0.9, 2.2, 0.9, s * (w / 2 - 0.1), yy + 1.0, t * L); K.geo('glowY', sph(0.32, 10, 8), s * (w / 2 - 0.1), yy + 2.45, t * L); K.geo('gold', new THREE.TorusGeometry(0.42, 0.06, 6, 16, Math.PI * 1.3), s * (w / 2 - 0.1), yy + 2.45, t * L, 0, Math.PI / 2, 0.6); glow(s * (w / 2 - 0.1), yy + 2.45, t * L, 0xfff0c0, 2.4, 0.4); }
  } else {
    for (let k = 0; k <= 6; k++){ const t = k / 6 - 0.5, i = Math.round((t + 0.5) * n), yy = ys[i]; for (const s of [-1, 1]){ const hh = yy - bed + 1.3; K.geo('woodD', cyl(0.13, 0.15, hh, 6), s * (w / 2 - 0.05), yy + 1.25 - hh / 2, t * L); } }
    for (const s of [-1, 1]) for (let k = 0; k < 6; k++){ const t0 = k / 6 - 0.5, t1 = (k + 1) / 6 - 0.5, i0 = Math.round((t0 + 0.5) * n), i1 = Math.round((t1 + 0.5) * n); link('rope', [s * (w / 2 - 0.05), ys[i0] + 1.15, t0 * L], [s * (w / 2 - 0.05), ys[i1] + 1.15, t1 * L], 0.05); link('rope', [s * (w / 2 - 0.05), ys[i0] + 0.6, t0 * L], [s * (w / 2 - 0.05), ys[i1] + 0.6, t1 * L], 0.04); }
    for (const t of [-0.5, 0.5]){ const i = Math.round((t + 0.5) * n); K.box('lamp', 0.24, 0.3, 0.24, w / 2 + 0.05, ys[i] + 1.6, t * L); glow(w / 2 + 0.05, ys[i] + 1.6, t * L, 0xffb050, 2.2, 0.3); }
  }
  K.pop();
  if (!stone){ const rd = []; for (let i = 0; i < 26; i++){ const a = R() * TAU, d = rr(5, 14), x = Math.cos(a) * d, z = Math.sin(a) * d; if (H(cx + x, cz + z) < WLL + 0.6 && H(cx + x, cz + z) > WLL - 1.4 && Math.abs(x * ax[1] - z * ax[0]) > w) rd.push([cx + x, cz + z, rr(0.8, 1.3)]); } const im = new THREE.InstancedMesh(X.treeGeo('reed'), X.TREEMAT, Math.max(1, rd.length)); rd.forEach((t, i) => im.setMatrixAt(i, G.mat(t[0] - cx, H(t[0], t[1]), t[1] - cz, 0, R() * 6, 0, t[2], t[2], t[2]))); im.count = rd.length; CUR.near.add(im); }
  MAPBOX.push([cx, cz, w / 2, L / 2, ry]);
  return finish();
}

// ───────────────────────── 속삭이는 숲 ─────────────────────────
// 거인의 그루터기: 올라갈 수 있는 거대한 그루터기 + 박힌 거인의 도끼
function bStump(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 280 });
  const R0 = 12.5, [lo, hi] = footC(cx, cz, R0 + 2), y0 = lo - 0.6, top = hi + 8.5, hh = top - y0;
  const g = new THREE.CylinderGeometry(R0, R0 + 2.6, hh, 56, 6, true), p = g.attributes.position;
  for (let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), t = (y + hh / 2) / hh, k = 1 + 0.06 * Math.sin(a * 14) + 0.035 * Math.sin(a * 31 + 1.3) + (1 - t) * 0.07 * Math.sin(a * 5) + (t > 0.96 ? Math.sin(a * 9) * 0.03 : 0); p.setXYZ(i, x * k, y, z * k); }
  g.computeVertexNormals(); uvm(g, TAU * R0 / 1.2, hh / 1.6); K.geo('bark', g, 0, y0 + hh / 2, 0);
  K.geo('bark2', tor(R0 - 0.1, 0.55, 6, 56), 0, top, 0, Math.PI / 2); K.geo('stumpTop', new THREE.CircleGeometry(R0 - 0.2, 56).rotateX(-Math.PI / 2), 0, top + 0.05, 0);
  // 뿌리
  for (let i = 0; i < 10; i++){ const a = i / 10 * TAU + 0.2, r1 = R0 + rr(9, 14), ex = Math.cos(a) * r1, ez = Math.sin(a) * r1; K.geo('bark', tubeG([[Math.cos(a) * (R0 - 0.5), top - rr(4, 6), Math.sin(a) * (R0 - 0.5)], [Math.cos(a) * (R0 + 3), gy(Math.cos(a) * (R0 + 3), Math.sin(a) * (R0 + 3)) + 1.6, Math.sin(a) * (R0 + 3)], [ex, gy(ex, ez) - 0.4, ez]], 2.0, 0.4, 8, 5)); }
  // 올라가는 뿌리 경사로 (길 쪽 = 남쪽)
  const ra = 1.25, dx = Math.cos(ra), dz = Math.sin(ra), A = [dx * (R0 + 17), dz * (R0 + 17)], Bp = [dx * (R0 - 1.2), dz * (R0 - 1.2)], yA = gy(A[0], A[1]) + 0.25;
  K.geo('bark2', tubeG([[A[0], yA - 1.45, A[1]], [lerp(A[0], Bp[0], 0.5), lerp(yA, top, 0.5) - 1.35, lerp(A[1], Bp[1], 0.5)], [Bp[0], top - 1.3, Bp[1]]], 1.5, 1.5, 10, 6));
  for (let i = 0; i < 9; i++){ const t = (i + 0.5) / 9; K.box('wood', 2.4, 0.08, 0.35, lerp(A[0], Bp[0], t), lerp(yA, top, t) + 0.08, lerp(A[1], Bp[1], t), Math.atan2(top - yA, Math.hypot(Bp[0] - A[0], Bp[1] - A[1])) * 0, Math.atan2(Bp[0] - A[0], Bp[1] - A[1]), 0); }
  platSeg(cx + A[0], cz + A[1], cx + Bp[0], cz + Bp[1], 2.6, yA, top + 0.05); platCirc(cx, cz, R0 - 0.3, top + 0.05);
  // 충돌: 둘레 고리 (경사로 자리만 열림) + 경사로 양옆
  for (let i = 0; i < 28; i++){ const a = (i + 0.5) / 28 * TAU; if (Math.abs(Math.atan2(Math.sin(a - ra), Math.cos(a - ra))) < 0.16) continue; K.push(Math.cos(a) * (R0 + 0.2), 0, Math.sin(a) * (R0 + 0.2), -a + Math.PI / 2); cb(0, 0, (TAU * R0 / 28) / 2 + 0.2, 0.5); K.pop(); }
  { const L = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]), yaw = Math.atan2(Bp[0] - A[0], Bp[1] - A[1]); for (const s of [-1, 1]){ K.push((A[0] + Bp[0]) / 2 + dz * s * 1.5 + dx * 1.5, 0, (A[1] + Bp[1]) / 2 - dx * s * 1.5 + dz * 1.5, yaw); cb(0, 0, 0.2, L / 2 - 2); K.pop(); } }
  // 거인의 도끼 (윗면에 박힘)
  K.push(-3, top, -2.5, 0.6); K.geo('wood', cylM(0.55, 0.6, 15, 10), 0, 6.2, -3.2, -0.5, 0, 0); K.box('iron', 0.6, 4.2, 5.2, 0, 0.6, 0.2, -0.5); K.box('steel', 0.3, 0.6, 5.4, 0, -1.4, 0.0, -0.5); K.geo('iron', cylM(0.75, 0.75, 1.0, 10), 0, 1.2, -1.2, -0.5, 0, 0); K.pop(); cc(-3, -2.5, 1.6);
  // 윗면: 어린 나무 · 버섯 · 작은 제단
  for (const [x, z] of [[5, 4], [-6, 5], [3, -7]]){ K.geo('bark2', cyl(0.08, 0.14, 2.6, 6), x, top + 1.3, z); for (let k = 0; k < 3; k++) K.geo('leafC', ico(rr(0.6, 0.9), 0), x + rr(-0.4, 0.4), top + 2.6 + k * 0.4, z + rr(-0.4, 0.4)); cc(x, z, 0.3); }
  P.mushrooms(-7, -3, 5); K.push(0, 0, 0); P.shrine(6, -3, -0.6, 0x9aff80); K.pop();
  // 옆면 선반 버섯
  for (let i = 0; i < 16; i++){ const a = R() * TAU, yy = rr(y0 + 1.5, top - 1), rad = R0 + 2.6 * (1 - (yy - y0) / hh) + 0.2; K.geo(i % 3 ? 'fabricW' : 'pink', sph(rr(0.5, 0.9), 10, 4, 0, TAU, 0, Math.PI / 2), Math.cos(a) * rad, yy, Math.sin(a) * rad, 0, 0, 0, 1, 0.35, 1); }
  motesFx(CUR.near, [0, top, 0], 12, LOW ? 16 : 30, '0.8, 1.0, 0.5', 4, 0.13);
  MAPBOX.push([cx, cz, R0, R0, 0]);
  return finish();
}
// 요정의 버섯 고리: 빛나는 버섯 원 · 땅의 빛 고리 · 요정 빛
function bFairy(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l });
  add('capP', std({ color: 0xff9ad8, emissive: 0xff40b0, emissiveIntensity: 0.7, roughness: 0.5 })); add('capC', std({ color: 0x9af0ff, emissive: 0x30c8ff, emissiveIntensity: 0.7, roughness: 0.5 })); add('capV', std({ color: 0xc8a0ff, emissive: 0x8a40ff, emissiveIntensity: 0.7, roughness: 0.5 }));
  const caps = ['capP', 'capC', 'capV'], n = 13, rad = 9;
  for (let i = 0; i < n; i++){ const a = i / n * TAU, x = Math.cos(a) * rad, z = Math.sin(a) * rad, y = gy(x, z) - 0.1, s = rr(0.8, 1.35), key = caps[i % 3];
    K.geo('fabricW', lathe([[0, 0], [0.3 * s, 0], [0.22 * s, 0.8 * s], [0.18 * s, 1.6 * s], [0, 1.6 * s]], 10, 0.4), x, y, z);
    K.geo(key, new THREE.SphereGeometry(0.95 * s, 14, 7, 0, TAU, 0, Math.PI / 2), x, y + 1.5 * s, z, rr(-0.15, 0.15), 0, rr(-0.15, 0.15), 1, 0.6, 1); K.geo('fabricW', new THREE.CircleGeometry(0.9 * s, 14).rotateX(Math.PI / 2), x, y + 1.5 * s, z);
    for (let k = 0; k < 4; k++){ const b = R() * TAU, d = rr(0.2, 0.7) * s; K.geo('fabricW', sph(0.1 * s, 6, 4), x + Math.cos(b) * d, y + 1.5 * s + 0.5 * s * Math.sqrt(1 - (d / (0.95 * s)) ** 2), z + Math.sin(b) * d); }
    cc(x, z, 0.4 * s); glow(x, y + 1.7 * s, z, [0xff7ad0, 0x7ae0ff, 0xb07aff][i % 3], 2.4, 0.35);
    for (let k = 0; k < 3; k++){ const b = a + rr(-0.2, 0.2), d = rad + rr(-1.8, 1.8); K.geo(key, sph(0.18, 8, 4, 0, TAU, 0, Math.PI / 2), Math.cos(b) * d, gy(Math.cos(b) * d, Math.sin(b) * d) + 0.18, Math.sin(b) * d); }
  }
  const rc = G.cnv(256, 32), rx = rc.getContext('2d'), gr = rx.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, 'rgba(255,120,220,0)'); gr.addColorStop(0.5, 'rgba(255,200,255,1)'); gr.addColorStop(1, 'rgba(120,220,255,0)'); rx.fillStyle = gr; rx.fillRect(0, 0, 256, 32);
  const rm = X.ADDM(G.tex(rc, true, 1, 1), 0.55); rm.polygonOffset = true; rm.polygonOffsetFactor = -4; rm.toneMapped = false;
  const rg = X.polarRing(rad - 1.4, rad + 1.4, 80), pp = rg.attributes.position; for (let i = 0; i < pp.count; i++) pp.setY(i, gy(pp.getX(i), pp.getZ(i)) + 0.12); const rgm = part(rg, rm); rgm.renderOrder = 3;
  anim((dt, t) => { const k = 0.55 + 0.25 * Math.sin(t * 1.5); for (const c of caps) MAT[c].emissiveIntensity = k + nightK * 0.4; rm.opacity = 0.35 + 0.3 * Math.sin(t * 1.2) + nightK * 0.3; });
  // 가운데 이끼 돌 · 바깥 큰 버섯 나무
  { const y = gy(0, 0); K.geo('mossy', rockG(1.4, 0.7), 0, y + 0.4, 0); K.box('glowM', 0.1, 0.8, 0.1, 0, y + 1.2, 0.95, 0, 0, 0.3); cc(0, 0, 1.3); }
  const big = []; for (let i = 0; i < 7; i++){ const a = i / 7 * TAU + 0.4, d = rr(14, 19); big.push([Math.cos(a) * d, Math.sin(a) * d, rr(1.0, 1.6)]); }
  { const im = new THREE.InstancedMesh(X.treeGeo('shroomT'), X.TREEMAT, big.length), c = new THREE.Color(); big.forEach((t, i) => { im.setMatrixAt(i, G.mat(t[0], gy(t[0], t[1]) - 0.1, t[1], 0, R() * 6, 0, t[2], t[2], t[2])); c.setHSL(rr(0.75, 0.95), 0.6, 0.85); im.setColorAt(i, c); cc(t[0], t[1], 0.5 * t[2]); }); im.castShadow = true; CUR.near.add(im); for (const t of big) B.far.push(['fabricW', sph(2 * t[2], 8, 4, 0, TAU, 0, Math.PI / 2).scale(1, 0.65, 1).translate(t[0], gy(t[0], t[1]) + 3 * t[2], t[1])]); }
  motesFx(CUR.near, [0, gy(0, 0), 0], 11, LOW ? 30 : 60, '1.0, 0.6, 0.95', 3.5, 0.16); motesFx(CUR.near, [0, gy(0, 0), 0], 14, LOW ? 14 : 30, '0.5, 0.9, 1.0', 5, 0.12);
  return finish();
}
// 사냥꾼 야영지: 천막 · 모닥불 · 망루 · 건조대 · 과녁
function bCamp(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l });
  P.campfire(-4, -6); { const y = gy(-4, -6); K.push(-4, y, -6); for (let i = 0; i < 3; i++) K.geo('woodD', cyl(0.04, 0.05, 2.2, 5), Math.cos(i * 2.1) * 0.7, 1.0, Math.sin(i * 2.1) * 0.7, Math.sin(i * 2.1) * 0.32, 0, -Math.cos(i * 2.1) * 0.32); K.geo('iron', lathe([[0, 0], [0.32, 0.02], [0.38, 0.3], [0.32, 0.45], [0, 0.45]], 10, 0.4), 0, 0.85, 0); K.geo('rope', cyl(0.01, 0.01, 0.9, 3), 0, 1.6, 0); K.pop(); }
  for (const [x, z, ry] of [[-7.2, -4.4, 1.2], [-1.4, -8.6, 0.3], [-1.2, -3.2, -0.4]]) P.log(x, z, ry, 2.2, 0.26);
  P.tent(-14, -10, 0.9, 'tentA', 2.6); P.tent(-6, -16, 0.1, 'tentB', 2.4); P.tent(6, -14, -0.7, 'tentA', 2.2);
  // 망루
  { const tx = -18, tz = -2, ty = gy(tx, tz) - 0.3; K.push(tx, ty, tz, 0.3);
    for (const [a, b] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]){ K.geo('woodD', tubeG([[a * 1.25, 0, b * 1.25], [a, 8.4, b]], 0.2, 0.15, 6, 2)); cc(a * 1.25, b * 1.25, 0.3); }
    for (const h of [2.6, 5.4]) for (const [ax, az, bx, bz] of [[-1.6, -1.6, 1.6, -1.6], [1.6, -1.6, 1.6, 1.6], [1.6, 1.6, -1.6, 1.6], [-1.6, 1.6, -1.6, -1.6]]) link('woodD', [ax * (1.2 - h / 30), h, az * (1.2 - h / 30)], [bx * (1.2 - h / 30), h + 1.6, bz * (1.2 - h / 30)], 0.12);
    K.box('wood', 3.8, 0.25, 3.8, 0, 8.4, 0); for (const s of [-1, 1]){ K.box('wood', 3.8, 0.9, 0.12, 0, 9.0, s * 1.85); K.box('wood', 0.12, 0.9, 3.8, s * 1.85, 9.0, 0); }
    for (const [a, b] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) K.geo('woodD', cyl(0.08, 0.08, 2.4, 5), a, 9.6, b); K.geo('thatch', cone(3.4, 2.0, 4), 0, 11.6, 0, 0, Math.PI / 4, 0);
    K.push(0, 0, 2.0); for (const s of [-1, 1]) K.box('woodD', 0.1, 8.6, 0.1, s * 0.35, 4.2, 0, -0.08); for (let i = 0; i < 16; i++) K.box('wood', 0.75, 0.06, 0.1, 0, 0.4 + i * 0.5, 0.04 * (16 - i) * 0.06); K.pop();
    K.geo('woodD', cyl(0.05, 0.05, 2.2, 5), 0, 13.6, 0); K.pop(); flag(tx, ty + 14.5, tz, 0.3, 1.4, 0.8, 'fabricG'); }
  // 가죽 건조대 · 과녁 · 무기 걸이
  { const x = 10, z = -4, y = gy(x, z); K.push(x, y, z, -0.3); for (const s of [-1, 1]) K.geo('woodD', cyl(0.07, 0.08, 2.4, 5), s * 1.6, 1.2, 0); K.box('woodD', 3.4, 0.08, 0.08, 0, 2.3, 0); for (let i = 0; i < 3; i++) K.geo('feather', plane(0.8, 1.2), -1 + i * 1.0, 1.65, 0, 0, rr(-0.2, 0.2), 0); K.pop(); cb(x, z, 1.7, 0.2, -0.3); }
  for (const [x, z] of [[14, -20], [19, -16]]){ const y = gy(x, z); K.push(x, y, z, -2.3); K.geo('woodD', cyl(0.05, 0.06, 1.7, 5), -0.5, 0.8, -0.3, 0.2, 0, 0.1); K.geo('woodD', cyl(0.05, 0.06, 1.7, 5), 0.5, 0.8, -0.3, 0.2, 0, -0.1); K.geo('hay', cyl(0.85, 0.85, 0.35, 16), 0, 1.4, 0, Math.PI / 2 - 0.15, 0, 0);
    for (const [r, k] of [[0.62, 'fabricW'], [0.42, 'fabricR'], [0.2, 'fabricY']]) K.geo(k, new THREE.CircleGeometry(r, 16), 0, 1.4 + 0.03 * Math.sin(0.15), 0.19, -0.15, 0, 0); K.pop(); cc(x, z, 0.6); }
  { const x = 3, z = -2, y = gy(x, z); K.push(x, y, z, 0.5); K.box('woodD', 2.2, 0.1, 0.25, 0, 1.4, 0); K.box('woodD', 2.2, 0.1, 0.25, 0, 0.45, 0); for (const s of [-1, 1]) K.box('woodD', 0.1, 1.7, 0.1, s * 1.05, 0.85, 0);
    for (let i = 0; i < 3; i++) K.geo('woodD', tor(0.7, 0.03, 4, 12, Math.PI), -0.6 + i * 0.6, 1.0, 0.12, 0, Math.PI / 2, Math.PI / 2); K.pop(); cb(x, z, 1.1, 0.2, 0.5); }
  P.clutter(-10, -18, 3); P.clutter(10, -10, 2);
  for (const [x, z] of [[-10, 3], [8, 4], [-20, -14]]) P.lamp(x, z, 'wood', R() * 6);
  return finish();
}
// 속삭이는 샘: 룬 선돌 원 · 물 붓는 처녀상 · 연잎
function bSpring(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l });
  const lake = W.lakes.find(o => o.id === 'springpool') || { rx: 14, rz: 12 }, fa = Math.atan2(12, 12);
  for (let i = 0; i < 9; i++){ const a = i / 9 * TAU + 0.35; if (Math.abs(Math.atan2(Math.sin(a - fa), Math.cos(a - fa))) < 0.35) continue; const x = Math.cos(a) * (lake.rx + 4), z = Math.sin(a) * (lake.rz + 4), y = gy(x, z) - 0.3, h = rr(2.6, 3.6);
    K.push(x, y, z, -a + Math.PI / 2, rr(-0.06, 0.06)); K.geo('mossy', cyl(0.4, 0.62, h, 5), 0, h / 2, 0); K.box('glowC', 0.1, h * 0.55, 0.05, 0, h * 0.55, -0.5); K.pop(); cc(x, z, 0.6); glow(x - Math.cos(a) * 0.5, y + h * 0.55, z - Math.sin(a) * 0.5, 0x6af0ff, 1.6, 0.45); }
  // 처녀상 (북쪽 바위 위)
  { const x = 0, z = -lake.rz + 1.5, y = Math.max(gy(x, z), WLL) + 0.3; rockPile(x, z - 0.5, 3, 7, 'mossy'); K.push(x, y + 1.2, z, 0);
    K.geo('marbleW', lathe([[0, 0], [0.75, 0], [0.55, 0.9], [0.32, 1.7], [0.36, 2.0], [0.2, 2.2], [0, 2.2]], 14, 0.4)); K.geo('marbleW', sph(0.3, 10, 8), 0, 2.45, 0); K.geo('marbleW', sph(0.32, 10, 6, 0, TAU, 0, Math.PI / 2), 0, 2.5, -0.05, -0.3, 0, 0, 1, 1.3, 1);
    for (const s of [-1, 1]) K.geo('marbleW', cyl(0.08, 0.09, 0.9, 6), s * 0.3, 1.85, 0.3, -1.0, 0, s * 0.3); K.geo('terra', lathe([[0, 0], [0.22, 0.05], [0.3, 0.3], [0.14, 0.52], [0.12, 0.62], [0, 0.62]], 10, 0.4), 0, 1.7, 0.75, 1.9, 0, 0);
    K.pop(); cc(x, z, 2.2);
    const sm = part(plane(0.35, y + 1.9 - WLL), streakMat, x, (y + 1.9 + WLL) / 2, z + 1.15); sm.renderOrder = 2;
    G.particles(LOW ? 14 : 28, [new V3(x, WLL + 0.05, z + 1.2)], { parent: CUR.near, vert: `float life = fract(uTime * 0.9 + aSeed); vL = life; float an = aSeed * 30.0; vec3 p = position + vec3(cos(an) * life * 0.8, life * 0.6 - life * life * 0.8, sin(an) * life * 0.8); float sz = 0.14;`, frag: `float a = smoothstep(0.5, 0.0, d) * (1.0 - vL) * 0.8; gl_FragColor = vec4(vec3(0.85, 0.95, 1.0) * a, a);` }); }
  // 연잎 · 연꽃
  for (let i = 0; i < 16; i++){ const a = R() * TAU, d = Math.sqrt(R()) * 0.75, x = Math.cos(a) * lake.rx * d, z = Math.sin(a) * lake.rz * d; if (Math.hypot(x, z + lake.rz - 1.5) < 3) continue; K.geo('leafA', new THREE.CircleGeometry(rr(0.35, 0.6), 12, 0.3, TAU - 0.6).rotateX(-Math.PI / 2), x, WLL + 0.04, z, 0, R() * TAU, 0); if (R() < 0.35) K.geo('pink', new THREE.ConeGeometry(0.16, 0.25, 6, 1, true), x + 0.15, WLL + 0.15, z, Math.PI, 0, 0); }
  for (const [x, z] of [[-lake.rx - 2, 2], [lake.rx + 1, -4], [-6, lake.rz + 2.5]]) P.lamp(x, z, 'stone');
  motesFx(CUR.near, [0, WLL, 0], 10, LOW ? 20 : 44, '0.6, 1.0, 0.95', 3, 0.15);
  return finish();
}
// 고목 뿌리 터널: 거대한 죽은 고목 + 길 위로 휘어진 뿌리 아치
function bRootArch(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 260 });
  const tx = 15, tz = -3, ty = gy(tx, tz) - 1;
  const tg = new THREE.CylinderGeometry(4.6, 7.5, 20, 20, 8, true), tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++){ const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i), a = Math.atan2(z, x), k = 1 + 0.08 * Math.sin(a * 9) + 0.05 * Math.sin(a * 23); tp.setXYZ(i, x * k, y > 9.9 ? y + Math.sin(a * 5) * 3 + Math.sin(a * 11) * 1.5 : y, z * k); }
  tg.computeVertexNormals(); uvm(tg, 24, 12); K.geo('bark', tg, tx, ty + 10, tz); K.geo('dark', new THREE.CircleGeometry(4.4, 20).rotateX(-Math.PI / 2), tx, ty + 15, tz);
  for (const [a, h, r1] of [[2.4, 16, 9], [3.6, 14, 7], [1.2, 18, 6]]) K.geo('bark2', tubeG([[tx + Math.cos(a) * 4, ty + h, tz + Math.sin(a) * 4], [tx + Math.cos(a) * r1, ty + h + 4, tz + Math.sin(a) * r1], [tx + Math.cos(a) * (r1 + 3), ty + h + 5, tz + Math.sin(a) * (r1 + 3)]], 0.9, 0.2, 6, 5));
  cc(tx, tz, 7);
  // 뿌리 아치 (길 = z 축)
  for (let i = 0; i < 6; i++){ const z = -13 + i * 5.2 + rr(-0.8, 0.8), w = rr(5.5, 7), h = rr(8, 12.5), xa = -w + rr(-1, 1), xb = w * 0.8 + 4, ya = gy(xa, z) - 0.6, yb = gy(xb, z) - 0.4, r0 = rr(1.1, 1.5);
    K.geo('bark', tubeG([[tx - 4, ty + rr(5, 9), tz + rr(-2, 2)], [xb + 2, yb + h * 0.7, z], [lerp(xa, xb, 0.5), ya + h, z + rr(-1, 1)], [xa - 1.5, ya + h * 0.5, z], [xa, ya, z]], r0 * 1.3, r0 * 0.6, 8, 4));
    for (let k = 0; k < 4; k++){ const vx = lerp(xa, xb, rr(0.25, 0.75)); K.geo('leafB', cone(0.12, rr(1.5, 3.5), 4), vx, ya + h - rr(1.2, 2.2) - 0.9, z + rr(-0.6, 0.6), Math.PI, 0, 0); }
    cc(xa, z, 1.2); }
  P.mushrooms(-3, -6, 7, 'glowG'); P.mushrooms(2, 8, 6, 'glowM'); P.mushrooms(9, -10, 5, 'glowG');
  for (let i = 0; i < 12; i++){ const a = R() * TAU, d = rr(2, 16), x = Math.cos(a) * d, z = Math.sin(a) * d; K.geo('mossy', rockG(rr(0.4, 1.0), 0.6, 0), x, gy(x, z) + 0.1, z); }
  motesFx(CUR.near, [0, gy(0, 0), 0], 14, LOW ? 24 : 50, '0.75, 1.0, 0.45', 7, 0.13);
  return finish();
}

// ───────────────────────── 안개 늪 ─────────────────────────
// 가라앉은 신전 (레이드: 그롬) — 기운 계단식 신전 · 두꺼비 머리 입구 · 초록 소용돌이 포털
function bSunken(l){
  const cx = l.c[0] + 13, cz = l.c[1] - 3; begin(l.id, cx, cz, { lm: l, nearR: 300 });   // 늪지 샛길에서 비켜 서요
  const ry = -1.25, base = Math.min(gy(0, 0), WLL) - 1.5, fx = Math.sin(ry), fz = Math.cos(ry);
  K.push(0, base, 0, ry, 0.03, -0.035);
  K.box('mossy', 22, 5, 22, 0, 2.5, -1); K.box('mossy', 16, 4.2, 16, 0, 7.1, -2.5); K.box('mossy', 10.5, 4, 10.5, 0, 11.2, -3.5); K.box('mossy', 6.5, 3.4, 6.5, 0, 14.9, -3.5);
  K.geo('mossy', cone(5.2, 4.2, 4), 0, 18.7, -3.5, 0, Math.PI / 4, 0); K.geo('iron', lathe([[0, 0], [0.8, 0.1], [1.0, 0.7], [0, 0.7]], 10, 0.4), 0, 20.6, -3.5); K.geo('glowG', cone(0.8, 1.6, 7), 0, 21.9, -3.5);
  for (const s of [-1, 1]) for (let t = 0; t < 3; t++){ K.box('mossy', 1.6, 3.5 - t, 1.6, s * (10.2 - t * 3), 5.2 + t * 4.2 + (3.5 - t) / 2, 9.4 - t * 3); }
  // 두꺼비 머리 (정면)
  K.push(0, 4.6, 10.2);
  K.geo('mossy', sph(5.2, 18, 12), 0, 0, 0, 0, 0, 0, 1.3, 0.72, 0.9); K.box('dark', 8.2, 2.6, 4, 0, -1.6, 2.4);
  K.geo('mossy', tor(4.2, 0.45, 6, 24, Math.PI), 0, -1.0, 4.0, Math.PI, 0, 0, 1, 0.35, 1);
  for (const s of [-1, 1]){ K.geo('mossy', sph(1.7, 12, 10), s * 3.4, 3.2, 1.4); K.geo('glowY', sph(1.0, 10, 8), s * 3.4, 3.5, 2.6, 0, 0, 0, 1, 1, 0.5); K.geo('dark', sph(0.45, 8, 6), s * 3.4, 3.5, 3.05, 0, 0, 0, 0.5, 1.3, 0.4); }
  K.geo('gold', cone(0.6, 1.4, 6), 0, 3.6, 0, 0, 0, 0); for (const s of [-1, 1]) K.geo('gold', cone(0.4, 1.0, 6), s * 1.4, 3.2, 0.4, 0, 0, s * 0.4);
  K.pop();
  // 계단 (물에서 입까지)
  for (let i = 0; i < 7; i++) K.box('mossy', 6, 0.5, 1.2, 0, 2.0 - i * 0.5 + 0.0, 13.6 + i * 1.1);
  K.pop();
  const mouthW = new V3(0, base + 3.0, 14.6).applyAxisAngle(new V3(0, 1, 0), ry);
  const pg = new THREE.CircleGeometry(1, 40).scale(3.6, 1.3, 1), pm = part(pg, portalMat(0x4aff7a, 0x2a8a6a), mouthW.x, mouthW.y, mouthW.z); pm.rotation.y = ry; pm.renderOrder = 2;
  const ps = X.glowSprite(0x6aff8a, 9, 0.55); ps.position.copy(mouthW); CUR.near.add(ps);
  anim((dt, t) => { ps.material.opacity = 0.4 + Math.sin(t * 2.1) * 0.15; });
  glowAbs(cx + mouthW.x, mouthW.y, cz + mouthW.z, 0x6aff8a, 6, 0.7);
  // 계단 발판 · 충돌 (정면 계단만 열림)
  const sA = [fx * 21.5, fz * 21.5], sB = [fx * 14.2, fz * 14.2]; platSeg(cx + sA[0], cz + sA[1], cx + sB[0], cz + sB[1], 5.6, Math.max(WLL + 0.1, base + 2.0 - 6.5 * 0.5 + 0.25), base + 2.3);
  K.push(0, 0, 0, ry); cb(0, -4, 11.2, 7.2); for (const s of [-1, 1]) cb(s * 7.2, 7.5, 4.0, 3.8); cb(0, 12.6, 4.6, 0.6); K.pop();
  F.raidPortalPos.grom = [cx + fx * 17, cz + fz * 17];
  // 반쯤 잠긴 기둥 · 초록 등불 · 덩굴
  for (let i = 0; i < 9; i++){ const a = ry + rr(-1.4, 1.4) + (i % 2 ? Math.PI * 0.85 : 0), d = rr(15, 24), x = Math.sin(a) * d, z = Math.cos(a) * d, y = Math.min(gy(x, z), WLL) - 0.6, h = rr(2.5, 7); if (roadD(cx + x, cz + z) < 3) continue; K.geo('mossy', cylM(0.55, 0.65, h, 10), x, y + h / 2, z, rr(-0.25, 0.25), 0, rr(-0.25, 0.25)); if (R() < 0.5) K.box('mossy', 1.5, 0.4, 1.5, x, y + h, z, rr(-0.2, 0.2), R(), 0); cc(x, z, 0.7); }
  for (const s of [-1, 1]) for (const d of [15, 21]){ const x = fx * d + fz * s * 3.8, z = fz * d - fx * s * 3.8; K.push(0, 0, 0); P.lamp(x, z, 'swamp', ry); K.pop(); }
  K.push(0, base, 0, ry, 0.03, -0.035); for (let i = 0; i < 30; i++){ const side = pick([[11, rr(-11, 9)], [-11, rr(-11, 9)], [rr(-11, 11), -12]]), tier = R() < 0.5 ? 0 : 1, xx = side[0] * (tier ? 0.73 : 1), zz = side[1]; K.geo('leafB', cone(0.12, rr(1.5, 4), 4), xx, 5 + tier * 4.2 - 1.2, zz, Math.PI, 0, 0); } K.pop();
  G.particles(LOW ? 30 : 60, [new V3(0, WLL + 0.5, 0)], { parent: CUR.near, vert: `vec3 p = position + vec3(sin(aSeed * 50.0 + uTime * 0.05) * 26.0, sin(uTime * 0.3 + aSeed * 31.0) * 0.4 + fract(aSeed * 3.7) * 2.0, cos(aSeed * 70.0 + uTime * 0.04) * 26.0); vL = 0.5 + 0.5 * sin(uTime * 0.5 + aSeed * 40.0); float sz = 7.0;`,
    frag: `float a = smoothstep(0.5, 0.0, d) * 0.07 * vL; gl_FragColor = vec4(vec3(0.75, 0.85, 0.8), a);`, blend: THREE.NormalBlending });
  motesFx(CUR.near, [mouthW.x, mouthW.y - 2, mouthW.z], 8, LOW ? 14 : 30, '0.5, 1.0, 0.6', 5, 0.14);
  return finish();
}
// 마녀의 오두막: 닭다리 기둥 위 비뚤어진 오두막 · 끓는 가마솥
function bWitch(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l });
  add('claw', std({ color: 0xd8a040, roughness: 0.6 }));
  const hx = 2, hz = 7, gy0 = gy(hx, hz), fy = gy0 + 4.6;
  // 닭다리 두 개
  for (const s of [-1, 1]){ const kx = hx + s * 1.5, k1 = [kx, fy - 0.2, hz], k2 = [kx + s * 0.5, gy0 + 2.6, hz + 1.2], k3 = [kx + s * 0.3, gy0 + 0.4, hz + 0.2];
    K.geo('fabricW', tubeG([k1, [kx + s * 0.4, fy - 1.2, hz + 0.8], k2], 0.7, 0.35, 8, 4)); K.geo('claw', tubeG([k2, [kx + s * 0.4, gy0 + 1.4, hz + 0.6], k3], 0.24, 0.18, 6, 4));
    for (const a of [-0.6, 0, 0.6, Math.PI]) K.geo('claw', tubeG([k3, [k3[0] + Math.sin(a) * 0.9, gy0 + 0.15, k3[2] + Math.cos(a) * 0.9], [k3[0] + Math.sin(a) * 1.4, gy0 + 0.05, k3[2] + Math.cos(a) * 1.4]], 0.12, 0.05, 5, 3));
    cc(k3[0], k3[2], 0.6); }
  // 오두막
  K.push(hx, fy, hz, 0.15, 0.04, -0.07);
  K.box('woodD', 5.2, 0.35, 4.8, 0, 0, 0); K.box('woodD', 4.6, 3.2, 4.2, 0, 1.75, 0); for (let i = 0; i < 9; i++) K.box('wood', 4.7, 0.06, 0.1, 0, 0.3 + i * 0.36, 2.12, 0, 0, rr(-0.03, 0.03));
  const rise = roofG(4.6, 4.2, 3.35, 1.05, 0.6, 'shingle'); gables(4.6, 4.2, 3.35, rise, 'woodD', false);
  K.box('fabricP', 1.0, 1.8, 0.1, -0.8, 1.15, 2.15); K.geo('glowG', new THREE.CircleGeometry(0.42, 12), 1.1, 2.1, 2.16); K.geo('woodD', tor(0.44, 0.06, 4, 12), 1.1, 2.1, 2.16);
  K.box('stone', 0.8, 3.4, 0.8, 1.3, 4.6, -0.9, 0, 0, 0.18); K.box('stone', 0.9, 0.2, 0.9, 1.6, 6.2, -0.9, 0, 0, 0.18);
  for (let i = 0; i < 5; i++) K.geo(i % 2 ? 'potionP' : 'potionG', lathe([[0, 0], [0.08, 0], [0.1, 0.12], [0.04, 0.2], [0, 0.2]], 6, 0.3), -2.0 + i * 0.25, 2.6, 2.35);
  K.pop(); CUR.smoke.push(kpt(hx + 1.7, fy + 6.4, hz - 0.9)); glow(hx + 1.1, fy + 2.1, hz + 2.3, 0x9aff70, 1.8, 0.5);
  // 사다리
  { const a = [hx - 0.8, gy0, hz + 4.6], b = [hx - 0.8, fy, hz + 2.4]; for (const s of [-1, 1]) link('woodD', [a[0] + s * 0.35, a[1], a[2]], [b[0] + s * 0.35, b[1], b[2]], 0.08); for (let i = 1; i < 9; i++){ const t = i / 9; K.box('wood', 0.7, 0.06, 0.1, a[0], lerp(a[1], b[1], t), lerp(a[2], b[2], t)); } }
  // 가마솥
  { const x = 7, z = -3, y = gy(x, z); K.push(x, y, z); P.campfire(0, 0, false); K.geo('iron', lathe([[0, 0.2], [0.75, 0.3], [0.95, 0.75], [0.85, 1.25], [0.75, 1.3], [0, 1.3]], 14, 0.4), 0, 0.3, 0); K.geo('glowG', new THREE.CircleGeometry(0.74, 14).rotateX(-Math.PI / 2), 0, 1.5, 0); for (let i = 0; i < 3; i++) K.geo('iron', cyl(0.05, 0.05, 0.6, 4), Math.cos(i * 2.1) * 0.7, 0.3, Math.sin(i * 2.1) * 0.7); K.pop(); cc(x, z, 1.1); glow(x, y + 1.7, z, 0x9aff70, 3.2, 0.6);
    G.particles(LOW ? 16 : 30, [new V3(x, y + 1.6, z)], { parent: CUR.near, vert: `float life = fract(uTime * 0.6 + aSeed); vL = life; float an = aSeed * 40.0; vec3 p = position + vec3(cos(an) * 0.5 * fract(aSeed * 3.1), life * 1.6, sin(an) * 0.5 * fract(aSeed * 7.3)); float sz = 0.22 * (1.0 - life * 0.5);`, frag: `float r = smoothstep(0.5, 0.35, d) * smoothstep(0.15, 0.4, d); float a = (r + smoothstep(0.5, 0.0, d) * 0.3) * (1.0 - vL); gl_FragColor = vec4(vec3(0.55, 1.0, 0.4) * a, a);` }); }
  // 해골 울타리 · 호박 · 빗자루
  for (let i = 0; i < 8; i++){ const a0 = i / 11 * TAU + 2.0, a1 = (i + 1) / 11 * TAU + 2.0, r = 12; P.fence(Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * r, Math.sin(a1) * r, { key: 'woodD', gap: 1.6 }); if (i % 2 === 0) P.skull(Math.cos(a0) * r, gy(Math.cos(a0) * r, Math.sin(a0) * r) + 1.2, Math.sin(a0) * r, 0.8, -a0); }
  for (let i = 0; i < 6; i++){ const x = rr(-7, 9), z = rr(-2, 12); if (Math.hypot(x - hx, z - hz) < 4 || kept(cx + x, cz + z, 1)) continue; const y = gy(x, z), s = rr(0.4, 0.7); K.geo('pumpkin', sph(s, 10, 6), x, y + s * 0.7, z, 0, R() * 3, 0, 1.2, 0.85, 1.2); K.geo('leafB', cyl(0.05, 0.06, 0.25, 5), x, y + s * 1.35, z); if (i % 2 === 0){ K.geo('glowO', new THREE.CircleGeometry(s * 0.25, 3), x, y + s * 0.8, z + s * 1.15); glow(x, y + s * 0.8, z + s * 1.2, 0xff9a30, 1.2, 0.4); } }
  { const x = -3, z = 2, y = gy(x, z); K.geo('woodD', cyl(0.04, 0.05, 2.0, 5), x, y + 1.0, z, 0.35, 0, 0.1); K.geo('hay', cone(0.3, 0.7, 8), x, y + 0.2, z + 0.4, Math.PI + 0.35, 0, 0); }
  smokeFx(CUR.near, CUR.smoke, '0.45, 0.85, 0.4'); CUR.smoke = [];
  MAPBOX.push([cx + hx, cz + hz, 2.6, 2.4, 0.15]);
  return finish();
}
// 썩은 판자길: 늪 위를 지그재그로 가로지르는 판자길 (걸을 수 있어요)
function bBoardwalk(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l });
  const pts = [[328, 197], [343, 189], [352, 178], [366, 182], [379, 172], [397, 169]].map(([x, z]) => [x - cx, z - cz]), dy = WLL + 0.55;
  for (let i = 0; i < pts.length - 1; i++){
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az), ya = Math.max(dy, gy(ax, az) + 0.3), yb = Math.max(dy, gy(bx, bz) + 0.3);
    K.push(ax, 0, az, yaw);
    const n = Math.floor(L / 0.45); for (let k = 0; k < n; k++){ const t = (k + 0.5) / n, broken = R() < 0.07; K.box(R() < 0.3 ? 'woodD' : 'wood', broken ? 1.1 : 2.2, 0.1, 0.38, broken ? rr(-0.5, 0.5) : rr(-0.06, 0.06), lerp(ya, yb, t) - (broken ? 0.12 : 0), t * L, broken ? 0.2 : 0, rr(-0.05, 0.05), broken ? 0.25 : 0); }
    for (const s of [-1, 1]) K.box('woodD', 0.14, 0.18, L + 0.4, s * 0.85, (ya + yb) / 2 - 0.15, L / 2, -Math.atan2(yb - ya, L));
    for (let k = 0; k <= Math.floor(L / 2.6); k++){ const t = k / Math.max(1, Math.floor(L / 2.6)), z = t * L, yy = lerp(ya, yb, t); for (const s of [-1, 1]){ const g = gyk(s * 1.05, z) - 1, hh = yy - g + (s > 0 ? 1.1 : 0); K.geo('woodD', cyl(0.1, 0.12, hh, 6), s * 1.05, g + hh / 2, z, rr(-0.06, 0.06), 0, rr(-0.06, 0.06)); }
      if (k % 3 === 1){ K.box('woodD', 0.5, 0.06, 0.06, 1.25, yy + 1.0, z); K.box('glowG', 0.2, 0.26, 0.2, 1.45, yy + 0.8, z); glow(1.45, yy + 0.8, z, 0x9aff70, 2.2, 0.45); } }
    for (let k = 0; k < Math.floor(L / 2.6); k++){ const t0 = k / Math.floor(L / 2.6), t1 = (k + 1) / Math.floor(L / 2.6); link('rope', [1.05, lerp(ya, yb, t0) + 1.0, t0 * L], [1.05, lerp(ya, yb, t1) + 1.0, t1 * L], 0.04); }
    K.pop();
    platSeg(cx + ax, cz + az, cx + bx, cz + bz, 2.1, ya + 0.05, yb + 0.05);
  }
  // 가운데 쉼터 (낚시 의자 · 양동이)
  { const [x, z] = pts[2], y = Math.max(dy, gy(x, z) + 0.3); K.push(x, 0, z, 0.3); K.box('wood', 4.2, 0.12, 4.2, 0, y, 0); for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) K.geo('woodD', cyl(0.12, 0.14, 3, 6), a, y - 1.4, b);
    K.box('wood', 0.5, 0.45, 0.5, 1.2, y + 0.28, 1.0); K.geo('wood', lathe([[0, 0], [0.22, 0], [0.26, 0.35], [0, 0.35]], 10, 0.4), 0.4, y + 0.06, 1.4); K.geo('woodD', cyl(0.02, 0.02, 2.6, 4), 1.6, y + 1.2, 1.6, 0.5, 0, -0.4); K.pop(); platCirc(cx + x, cz + z, 2.6, y + 0.07); }
  // 썩은 기둥 · 이끼 바위
  for (let i = 0; i < 10; i++){ const a = R() * TAU, d = rr(6, 20), x = Math.cos(a) * d, z = Math.sin(a) * d, y = Math.min(gy(x, z), WLL) - 0.4, h = rr(1, 2.6); K.geo('woodD', cyl(0.12, 0.16, h, 5), x, y + h / 2, z, rr(-0.3, 0.3), 0, rr(-0.3, 0.3)); }
  motesFx(CUR.near, [0, WLL, 0], 22, LOW ? 20 : 44, '0.75, 1.0, 0.45', 3, 0.13);
  return finish();
}

// ───────────────────────── 하얀 갈기 폭포 · 붉은 협곡 ─────────────────────────
// 하얀 갈기 폭포 (물줄기는 world): 폭포 양옆 백마 머리 석상 · 바위 · 물보라 · 무지개 · 전망 쉼터
function bFalls(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 280 });
  const [ed, top, bot] = findEdge(cx, cz - 16, 0, 1, 32), yBot = Math.min(bot, gy(0, 8));   // 위 = 북쪽
  // 백마 머리 석상 (절벽 위 양쪽)
  for (const s of [-1, 1]){ const x = s * 10, z = -8, y = gy(x, z) - 0.4; K.push(x, y, z, Math.PI + s * 0.25);
    K.box('marbleW', 3.2, 1.6, 3.2, 0, 0.8, 0); K.geo('marbleW', cylM(1.2, 1.5, 5, 10), 0, 3.8, 0, -0.25, 0, 0);
    K.push(0, 6.6, 0.9, 0, -0.5); K.geo('marbleW', sph(1.3, 12, 10), 0, 0, 0, 0, 0, 0, 1, 1.05, 1.0); K.geo('marbleW', cylM(0.75, 1.0, 2.6, 10), 0, -0.35, 1.5, 1.35, 0, 0); K.geo('dark', sph(0.12, 6, 4), s * 0.75, 0.35, 0.75);
    for (const e of [-1, 1]) K.geo('marbleW', cone(0.28, 0.9, 6), e * 0.55, 1.45, -0.2, -0.2, 0, -e * 0.2);
    for (let m = 0; m < 7; m++) K.geo('fabricW', cone(0.32, 2.4 - m * 0.18, 5), 0, 1.0 - m * 0.55, -0.9 - m * 0.12, -2.4 + m * 0.12, 0, rr(-0.2, 0.2));
    K.pop(); K.pop(); cc(x, z, 1.8); }
  // 바위 (위 · 아래)
  rockPile(-9, -14, 5, 7, 'rock'); rockPile(9, -14, 5, 7, 'rock'); rockPile(-10, 7, 6, 9, 'mossy'); rockPile(10, 7, 6, 9, 'mossy');
  for (const s of [-1, 1]) cc(s * 10, 7, 4.5);
  // 무지개 (물보라 위)
  const rbc = G.cnv(16, 256), rbx = rbc.getContext('2d'), rgd = rbx.createLinearGradient(0, 0, 0, 256); ['rgba(255,60,60,0)', '#ff4040', '#ffa030', '#fff050', '#50e060', '#40a0ff', '#8050ff', 'rgba(128,80,255,0)'].forEach((c, i, a) => rgd.addColorStop(i / (a.length - 1), c)); rbx.fillStyle = rgd; rbx.fillRect(0, 0, 16, 256);
  const rbm = X.ADDM(G.tex(rbc, true, 1, 1), 0.22); rbm.toneMapped = false; const rbg = X.polarRing(9, 11.5, 48); rbg.rotateX(Math.PI / 2);
  const rb = part(rbg, rbm, 0, yBot + 1, 6); rb.scale.set(1, 1, 1); rb.renderOrder = 3; rb.rotation.y = 0;
  anim((dt, t) => { rbm.opacity = (0.16 + 0.06 * Math.sin(t * 0.7)) * (1 - nightK); });
  // 물보라
  G.particles(LOW ? 50 : 100, [new V3(0, yBot + 0.4, 2)], { parent: CUR.near, vert: `float life = fract(uTime * 0.35 + aSeed); vL = life; float an = aSeed * 40.0; vec3 p = position + vec3(sin(an) * (3.0 + life * 3.0), life * 4.5, cos(an) * 1.5 + life * 4.0); float sz = 1.2 + life * 3.0;`,
    frag: `float a = smoothstep(0.5, 0.0, d) * (1.0 - vL) * 0.22; gl_FragColor = vec4(vec3(0.92, 0.97, 1.0), a);`, blend: THREE.NormalBlending });
  // 전망 쉼터 (아래 하류 쪽)
  { const x = -13, z = 16, y = gy(x, z); K.push(x, y, z, 2.6); K.box('wood', 4, 0.2, 3, 0, 0.3, 0); for (const [a, b] of [[-1.8, -1.3], [1.8, -1.3], [-1.8, 1.3], [1.8, 1.3]]) K.geo('woodD', cyl(0.1, 0.1, 2.8, 6), a, 1.6, b); for (const s of [-1, 1]) K.box('shingle', 4.8, 0.1, 2.0, 0, 3.2, s * 0.85, s * 0.5); K.pop(); P.bench(x, z + 0.3, 2.6); cb(x, z, 2.1, 1.6, 2.6); }
  P.lamp(-6, 13, 'stone'); P.lamp(7, 14, 'stone');
  return finish();
}
// 울음바위 절벽: 절벽에 새겨진 우는 얼굴 · 눈물 줄기 (가는 물줄기들은 world 가 만들어요)
function bWeep(l){
  const [cx, cz] = l.c, pl = (W.plateaus || []).find(p => p.id === 'weepbench'), pc = pl ? pl.c : [cx, cz + 48], pr = pl ? pl.r : 48;
  begin(l.id, cx, cz, { lm: l, nearR: 290 });
  const ol = Math.hypot(cx - pc[0], cz - pc[1]) || 1, ox = (cx - pc[0]) / ol, oz = (cz - pc[1]) / ol, ry = Math.atan2(ox, oz);
  const at = s => H(pc[0] + ox * s, pc[1] + oz * s);
  let top = -1e9, bot = 1e9; for (let s = pr - 16; s < pr - 2; s += 1) top = Math.max(top, at(s)); for (let s = pr; s < pr + 26; s += 1) bot = Math.min(bot, at(s));
  if (top - bot < 6) top = bot + 14;   // 절벽이 없으면 (대체 지형) 그냥 세워요
  // 절벽이 기울어 있으면 얼굴판도 같은 각도로 눕혀요 (윗입술 s0 ~ 발치 s1)
  let s0 = pr - 4, s1 = pr + 4; for (let s = pr - 16; s < pr + 26; s += 0.5){ if (at(s) >= top - 1.5) s0 = s; } for (let s = pr + 26; s > s0; s -= 0.5){ if (at(s) <= bot + 1.5) s1 = s; }
  const hgt = top - bot, tilt = Math.atan2(Math.max(0, s1 - s0), hgt), Ls = Math.hypot(s1 - s0, hgt), fh = Ls * 0.78, sm = (s0 + s1) / 2, ym = (top + bot) / 2;
  const fx = pc[0] + ox * (sm + 0.5) - cx, fz = pc[1] + oz * (sm + 0.5) - cz;
  // 얼굴 (돌판 + 이목구비) — 로컬 +z 가 절벽 밖, y 는 경사를 따라 위
  K.push(fx, ym, fz, ry); K.push(0, 0, 0, 0, -tilt);
  { const yt = fh / 2, yb = -Ls / 2 - 2; K.box('darkst', 13, yt - yb, 7, 0, (yt + yb) / 2, -3.2); }
  K.box('ruin', 11, fh * 0.12, 1.4, 0, fh * 0.36, 0.6, 0.12);   // 이마
  for (const s of [-1, 1]){ K.box('ruin', 3.4, 0.8, 1.6, s * 2.7, fh * 0.2, 0.9, 0, 0, s * -0.18); K.geo('dark', sph(1.25, 12, 8), s * 2.7, fh * 0.1, 0.35, 0, 0, 0, 1, 0.8, 0.55); K.geo('glowC', sph(0.28, 8, 6), s * 2.7, fh * 0.08, 0.9); }
  K.box('ruin', 1.7, fh * 0.24, 1.8, 0, -fh * 0.05, 0.9, 0.12); K.box('dark', 4.6, 1.0, 1.2, 0, -fh * 0.27, 0.5); K.box('ruin', 5.4, 0.55, 1.7, 0, -fh * 0.33, 0.9); K.box('ruin', 5.0, 0.5, 1.5, 0, -fh * 0.2, 0.9);
  for (const s of [-1, 1]) K.box('ruin', 1.2, fh * 0.55, 1.4, s * 6.0, -fh * 0.05, 0.4);
  K.pop(); K.pop(); K.push(fx, 0, fz, ry); cb(0, -3.2, 6.5, 3.5); K.pop();
  // 눈물 (같은 기울기)
  const tg = new THREE.Group(); tg.position.set(fx, ym, fz); tg.rotation.set(-tilt, ry, 0, 'YXZ'); CUR.near.add(tg);
  for (const s of [-1, 1]){ const tl = fh * 0.08 + Ls * 0.5 + 1, m = new THREE.Mesh(plane(0.8, tl), streakMat); m.position.set(s * 2.7, fh * 0.08 - tl / 2, 1.1); m.renderOrder = 2; tg.add(m); const v = new V3(s * 2.7, fh * 0.08, 1.0).applyEuler(tg.rotation); glow(fx + v.x, ym + v.y, fz + v.z, 0x8adfff, 1.6, 0.6); }
  // 절벽 발치: 이끼 바위 · 등불
  for (let i = 0; i < 9; i++){ const a = Math.atan2(oz, ox) + (i - 4) * 0.13, s0 = pr + 2; let ss = s0; for (let s = pr + 26; s > pr - 10; s -= 0.5) if (H(pc[0] + Math.cos(a) * s, pc[1] + Math.sin(a) * s) > bot + 2){ ss = s + 1.5; break; }
    const x = pc[0] + Math.cos(a) * ss - cx, z = pc[1] + Math.sin(a) * ss - cz; K.geo(i % 2 ? 'mossy' : 'rock', rockG(rr(0.7, 1.5), 0.6), x, gy(x, z) + 0.2, z); }
  const lx = fx + ox * 9, lz = fz + oz * 9; P.lamp(lx + oz * 7, lz - ox * 7, 'iron'); P.lamp(lx - oz * 7, lz + ox * 7, 'iron');
  motesFx(CUR.near, [fx + ox * 4, bot, fz + oz * 4], 10, LOW ? 12 : 26, '0.7, 0.9, 1.0', 6, 0.12);
  return finish();
}
// 독수리 둥지 바위: 꼭대기의 거대한 둥지 · 황금 알 · 맴도는 독수리 / 아래 승강 룬 옆 독수리 토템
function bEagle(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 260 });
  const ms = (W.mesas || []).find(m => m.id === 'eagle'), ty = gy(0, 0);
  // 둥지 (나뭇가지 고리)
  K.push(0, ty, 0, 0, 0, 0); K.push(0, 0, 0); K.st[K.st.length - 1].scale(new V3(1.6, 1.6, 1.6));
  for (let i = 0; i < (LOW ? 60 : 110); i++){ const a = R() * TAU, r = rr(3.2, 5.6), h = rr(0, 2.4), L = rr(3, 5.5); K.geo(R() < 0.5 ? 'woodD' : 'bark2', cyl(0.07, 0.1, L, 4), Math.cos(a) * r, h + 0.3, Math.sin(a) * r, rr(-0.5, 0.5) + Math.PI / 2, a + rr(-0.6, 0.6), rr(-0.3, 0.3)); }
  K.geo('hay', cylM(4.0, 3.6, 1.2, 16), 0, 0.6, 0); K.geo('feather', cyl(3.4, 3.4, 0.1, 16), 0, 1.25, 0);
  for (const [x, z, k] of [[0.8, 0.4, 'egg'], [-0.9, 0.6, 'egg'], [0, -0.9, 'gold']]) K.geo(k, sph(0.75, 12, 10), x, 1.9, z, 0, 0, 0, 1, 1.3, 1);
  for (let i = 0; i < 9; i++){ const a = R() * TAU, r = rr(1, 6); K.geo('fabricW', plane(0.25, rr(1, 1.8)), Math.cos(a) * r, rr(1.4, 2.6), Math.sin(a) * r, rr(-1, 1), R() * 6, rr(-1, 1)); }
  K.geo('woodD', cyl(0.1, 0.12, 7, 6), 4, 3.5, -3); K.pop(); K.pop(); flag(6.4, ty + 10.9, -4.8, 0.5, 4, 2.2, 'fabricR'); glowAbs(cx, ty + 3.8, cz, 0xffe070, 4, 0.4);
  // 맴도는 독수리 두 마리
  const eagles = [0, 1].map(i => { const g = new THREE.Group(), body = new THREE.Mesh(sph(0.6, 8, 6).scale(0.8, 0.7, 2.0), MAT.feather), head = new THREE.Mesh(sph(0.35, 8, 6), MAT.fabricW); head.position.set(0, 0.25, 1.2); g.add(body, head);
    const wings = [-1, 1].map(s => { const w = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 1.2).translate(s * 1.8, 0, 0), MAT.feather); w.add(m); g.add(w); return w; }); CUR.near.add(g); return { g, wings, r: 22 + i * 9, h: ty + 14 + i * 6, sp: 0.35 - i * 0.08, ph: i * 2.4 }; });
  anim((dt, t) => { for (const e of eagles){ const a = t * e.sp + e.ph; e.g.position.set(Math.cos(a) * e.r, e.h + Math.sin(t * 0.5 + e.ph) * 2, Math.sin(a) * e.r); e.g.rotation.set(0, -a, 0.35); const f = Math.sin(t * 3 + e.ph) * 0.35; e.wings[0].rotation.z = -f; e.wings[1].rotation.z = f; } });
  // 승강 룬 옆 독수리 토템 (아래)
  const lf = (W.lifts || [])[0], lx0 = lf ? lf.from[0] - cx : 20, lz0 = lf ? lf.from[1] - cz : 14, ll = Math.hypot(lx0, lz0) || 1, bx = lx0 + lx0 / ll * 5 - lz0 / ll * 6, bz = lz0 + lz0 / ll * 5 + lx0 / ll * 6, by = gy(bx, bz) - 0.3;
  K.push(bx, by, bz, Math.atan2(-bx, -bz) + Math.PI);
  K.box('redrock', 2.2, 1.0, 2.2, 0, 0.5, 0); for (let i = 0; i < 4; i++){ K.geo(['pRed', 'wood', 'pTeal', 'woodD'][i], cylM(0.75, 0.8, 2.2, 8), 0, 2.1 + i * 2.2, 0); K.geo('dark', sph(0.2, 6, 4), 0.32, 2.5 + i * 2.2, 0.65); K.geo('dark', sph(0.2, 6, 4), -0.32, 2.5 + i * 2.2, 0.65); K.geo('fabricW', cone(0.2, 0.6, 5), 0, 2.0 + i * 2.2, 0.85, Math.PI / 2, 0, 0); }
  for (const s of [-1, 1]) K.box('wood', 4.2, 0.25, 1.2, s * 2.6, 9.2, 0, 0, 0, s * 0.25); K.geo('gold', cone(0.3, 0.8, 6), 0, 10.6, 0.6, Math.PI / 2, 0, 0); K.geo('pRed', sph(0.8, 10, 8), 0, 10.6, 0);
  K.pop(); cc(bx, bz, 1.2);
  return finish();
}
// 버려진 광산 (레이드: 그라녹) — 갱도 입구 · 권양탑과 큰 바퀴 · 레일 · 광차 · 주황 소용돌이 포털
function bMine(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 300 });
  const ry = -0.93, fx = Math.sin(ry), fz = Math.cos(ry), y0 = gy(0, 0);
  // 뒤쪽 바위 언덕 (입구가 박혀 있어요)
  for (let i = 0; i < 16; i++){ const a = ry + Math.PI + rr(-1.4, 1.4), d = rr(4, 14), x = Math.sin(a) * d, z = Math.cos(a) * d, s = rr(3, 6) * (1.2 - d / 18); K.geo('redrock', rockG(s, rr(0.8, 1.2)), x, gy(x, z) + s * 0.3, z, 0, R() * TAU, 0); }
  K.geo('redrock', rockG(8.5, 0.75), -fx * 7, y0 + 2, -fz * 7); cc(-fx * 7, -fz * 7, 8);
  // 갱도 입구 (나무 틀)
  K.push(0, y0, 0, ry);
  K.box('dark', 5.6, 5.2, 4.4, 0, 2.6, -2.0);
  for (let k = 0; k < 3; k++){ const z = 1.6 - k * 1.6; for (const s of [-1, 1]) K.box('woodD', 0.45, 5.0, 0.45, s * 2.6, 2.5, z); K.box('woodD', 6.0, 0.5, 0.55, 0, 5.2, z); for (const s of [-1, 1]) K.box('woodD', 1.3, 0.3, 0.3, s * 2.1, 4.6, z, 0, 0, s * -0.7); }
  K.box('redrock', 8.5, 2.2, 3.2, 0, 6.6, 0.2); K.geo('lamp', sph(0.18, 8, 6), 2.2, 4.2, 2.0); K.geo('lamp', sph(0.18, 8, 6), -2.2, 4.2, 2.0);
  // 위험 팻말
  { const uv = signCell('⚠ 출입 금지', ''); K.box('wood', 2.6, 0.62, 0.08, 0, 5.85, 2.0); K.geo('signA', quadUV(2.5, 0.54, uv), 0, 5.85, 2.05); }
  // 레일 (입구에서 밖으로)
  for (let i = 0; i < 22; i++){ const z = 1.6 + i * 0.8, g = gyk(0, z) + 0.06; K.box('woodD', 2.0, 0.12, 0.3, 0, g - y0, z); for (const s of [-1, 1]) K.box('iron', 0.1, 0.12, 0.84, s * 0.62, g - y0 + 0.12, z); }
  K.pop();
  glow(fx * 2 + fz * 2.2, y0 + 4.2, fz * 2 - fx * 2.2, 0xffb050, 2, 0.4); glow(fx * 2 - fz * 2.2, y0 + 4.2, fz * 2 + fx * 2.2, 0xffb050, 2, 0.4);
  const pp = new V3(fx * 0.6, y0, fz * 0.6), pg = portalGeo(4.6, 4.8), pm = part(pg, portalMat(0xff8a2a, 0xb03a10), pp.x, pp.y + 0.05, pp.z); pm.rotation.y = ry; pm.renderOrder = 2;
  const ps = X.glowSprite(0xff9a40, 8, 0.5); ps.position.set(pp.x, y0 + 2.6, pp.z); CUR.near.add(ps); anim((dt, t) => { ps.material.opacity = 0.38 + Math.sin(t * 1.9) * 0.14; });
  glowAbs(cx + pp.x, y0 + 2.6, cz + pp.z, 0xff9a40, 6, 0.7); F.raidPortalPos.granok = [cx + fx * 4.5, cz + fz * 4.5];
  K.push(0, 0, 0, ry); for (const s of [-1, 1]) cb(s * 3.4, 0, 0.6, 1.5); cb(0, -2.4, 3.0, 1.0); K.pop();
  // 권양탑 (큰 바퀴가 돌아요)
  const hx = -fz * 10 - fx * 2, hz = fx * 10 - fz * 2, hy = gy(hx, hz) - 0.3; K.push(hx, hy, hz, ry);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){ K.geo('woodD', tubeG([[a * 2.6, 0, b * 2.6], [a * 0.8, 15, b * 0.8]], 0.25, 0.18, 6, 2)); cc(a * 2.6, b * 2.6, 0.35); }
  for (const h of [3.5, 7, 10.5]){ const w = 2.6 - h / 15 * 1.8; for (const [ax, az, bx2, bz2] of [[-w, -w, w, -w], [w, -w, w, w], [w, w, -w, w], [-w, w, -w, -w]]) link('woodD', [ax, h, az], [bx2, h, bz2], 0.15); }
  K.box('woodD', 2.4, 0.3, 2.4, 0, 15, 0); K.geo('woodD', cyl(0.12, 0.12, 2.6, 6), 0, 15.6, 0, Math.PI / 2, 0, 0); K.pop();
  const wheel = new THREE.Group(); wheel.position.set(hx, hy + 15.9, hz); wheel.rotation.y = ry; CUR.near.add(wheel);
  { const WB = new LB(1e9), WK = new G.Kit(WB), pk = K, pb = B; K = WK; B = WB; K.geo('iron', tor(2.4, 0.14, 6, 28), 0, 0, 0); K.geo('iron', tor(1.9, 0.08, 4, 24), 0, 0, 0); for (let i = 0; i < 8; i++) K.box('rust', 0.1, 4.6, 0.1, 0, 0, 0, 0, 0, i * Math.PI / 8); K.geo('iron', cyl(0.3, 0.3, 0.5, 10), 0, 0, 0, Math.PI / 2, 0, 0); K = pk; B = pb; for (const k in WB.g) wheel.add(meshOf(G.mergeGeos(WB.g[k]), MAT[k], true)); }
  B.far.push(['rust', tor(2.4, 0.3, 4, 16).rotateY(ry).translate(hx, hy + 15.9, hz)]);
  anim(dt => { wheel.children.forEach(m => { m.rotation.z += dt * 0.8; }); });
  link('rope', [hx, hy + 18.2, hz], [fx * 3, y0 + 0.5, fz * 3], 0.05);
  // 광차 · 광석 더미 · 등불
  for (const [d, o] of [[9, 0], [13.5, 0.15]]){ const x = fx * d, z = fz * d, y = gy(x, z) + 0.2; K.push(x, y, z, ry + o); K.geo('rust', lathe([[0, 0], [0.9, 0], [1.1, 1.0], [0, 1.0]], 4, 0.5), 0, 0.35, 0, 0, Math.PI / 4, 0, 1, 1, 1.3); for (let i = 0; i < 7; i++) K.geo(i < 2 ? 'ore' : 'redrock', ico(rr(0.25, 0.4), 0), rr(-0.4, 0.4), 1.45, rr(-0.6, 0.6)); for (const s of [-1, 1]) for (const zz of [-0.7, 0.7]) K.geo('iron', cyl(0.25, 0.25, 0.12, 10), s * 0.75, 0.25, zz, 0, 0, Math.PI / 2); K.pop(); cc(x, z, 1.2); }
  for (const [x, z] of [[fx * 6 + fz * 6, fz * 6 - fx * 6], [fx * 4 - fz * 7, fz * 4 + fx * 7]]){ const y = gy(x, z); for (let i = 0; i < 9; i++) K.geo(i < 2 ? 'ore' : 'redrock', ico(rr(0.4, 0.9), 0), x + rr(-1.2, 1.2), y + rr(0.2, 0.9), z + rr(-1.2, 1.2), R(), R(), R()); cc(x, z, 1.6); }
  P.lamp(fx * 7 + fz * 3.5, fz * 7 - fx * 3.5, 'iron'); P.lamp(fx * 7 - fz * 3.5, fz * 7 + fx * 3.5, 'iron'); P.clutter(fx * 3 - fz * 5.5, fz * 3 + fx * 5.5, 3);
  sparkFx(CUR.near, [new V3(pp.x, y0 + 0.5, pp.z)], '1.0, 0.55, 0.15', 18, 3.2);
  return finish();
}
// 거인의 유해: 누운 거인 해골 — 갈비뼈 아치 터널 · 해골 · 박힌 거대한 녹슨 검
function bSkeleton(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 300 });
  const ry = 0.6, ax = Math.sin(ry), az = Math.cos(ry), px = Math.cos(ry), pz = -Math.sin(ry);
  // 등뼈
  for (let i = 0; i < 16; i++){ const t = i - 8, x = ax * t * 2.2, z = az * t * 2.2, y = gy(x, z) + 0.6; K.push(x, y, z, ry); K.geo('bone', cyl(0.9, 1.0, 1.6, 8), 0, 0, 0, Math.PI / 2, 0, 0); K.geo('boneD', cone(0.45, 1.6, 5), 0, 1.3, 0, 0, 0, 0); K.pop(); }
  // 갈비뼈 아치
  for (let i = 0; i < 8; i++){ const t = -6 + i * 1.8, sx = ax * t * 2.2, sz = az * t * 2.2, sy = gy(sx, sz) + 0.8, hh = 11 - Math.abs(i - 3) * 0.9, wd = 7 - Math.abs(i - 3) * 0.5;
    for (const s of [-1, 1]){ const ex = sx + px * s * wd, ez = sz + pz * s * wd, ey = gy(ex, ez) - 0.3; K.geo('bone', tubeG([[sx, sy, sz], [sx + px * s * wd * 0.35, sy + hh, sz + pz * s * wd * 0.35], [sx + px * s * wd * 0.9, sy + hh * 0.75, sz + pz * s * wd * 0.9], [ex, ey, ez]], 0.55, 0.32, 7, 5)); cc(ex, ez, 0.6); } }
  // 해골 (머리 쪽 = +축)
  { const hx = ax * 22, hz = az * 22, hy = gy(hx, hz) + 2.6; K.push(hx, hy, hz, ry, -0.25, 0.3);
    K.geo('bone', sph(4.4, 16, 12), 0, 0, 0, 0, 0, 0, 1, 0.85, 1.15); K.box('bone', 4.2, 1.6, 3.4, 0, -2.6, 3.4); K.box('boneD', 4.0, 1.0, 3.6, 0, -3.8, 2.6, 0.35);
    for (const s of [-1, 1]){ K.geo('dark', sph(1.1, 10, 8), s * 1.7, 0.4, 3.9, 0, 0, 0, 1, 1.1, 0.5); K.geo('boneD', tubeG([[s * 3, 2, 0], [s * 6, 4.5, -1.5], [s * 7, 8, -4]], 0.9, 0.15, 7, 5)); }
    K.geo('dark', cone(0.6, 1.2, 3), 0, -1.0, 4.6, Math.PI / 2, 0, 0); for (let k = 0; k < 6; k++) K.geo('fabricW', cone(0.18, 0.6, 4), -1.5 + k * 0.6, -2.0, 5.0, Math.PI, 0, 0); K.pop(); cc(hx, hz, 4.4); }
  // 팔뼈 · 손 · 검
  { const sx = ax * 8 + px * 9, sz = az * 8 + pz * 9, hx = ax * 14 + px * 15, hz = az * 14 + pz * 15; K.geo('bone', tubeG([[sx, gy(sx, sz) + 0.8, sz], [lerp(sx, hx, 0.5), gy(lerp(sx, hx, 0.5), lerp(sz, hz, 0.5)) + 1.2, lerp(sz, hz, 0.5)], [hx, gy(hx, hz) + 0.6, hz]], 0.8, 0.6, 7, 5));
    for (let f = 0; f < 4; f++){ const a = ry + Math.PI / 2 + (f - 1.5) * 0.35; K.geo('bone', tubeG([[hx, gy(hx, hz) + 0.6, hz], [hx + Math.sin(a) * 2, gy(hx, hz) + 1.8, hz + Math.cos(a) * 2], [hx + Math.sin(a) * 3.2, gy(hx, hz) + 0.2, hz + Math.cos(a) * 3.2]], 0.32, 0.18, 6, 4)); }
    const wx = hx + px * 6, wz = hz + pz * 6, wy = gy(wx, wz) - 3; K.push(wx, wy, wz, ry + 0.4, 0.18, 0.12); K.box('rust', 0.5, 16, 2.4, 0, 8, 0); K.box('iron', 0.3, 16, 0.4, 0, 8, 1.3); K.box('bronze', 1.0, 0.8, 6.0, 0, 16.4, 0); K.geo('woodD', cylM(0.55, 0.55, 3.6, 8), 0, 18.6, 0); K.geo('bronze', sph(0.9, 10, 8), 0, 20.8, 0); K.pop(); cc(wx, wz, 1.4); }
  // 다리뼈 · 골반
  { const bx = -ax * 18, bz = -az * 18; K.geo('boneD', sph(3, 12, 8), bx, gy(bx, bz) + 0.8, bz, 0, ry, 0, 1.6, 0.5, 1); cc(bx, bz, 3.5);
    for (const s of [-1, 1]){ const ex = bx - ax * 16 + px * s * 5, ez = bz - az * 16 + pz * s * 5; K.geo('bone', tubeG([[bx + px * s * 3, gy(bx, bz) + 1, bz + pz * s * 3], [lerp(bx, ex, 0.5), gy(lerp(bx, ex, 0.5), lerp(bz, ez, 0.5)) + 2.5, lerp(bz, ez, 0.5)], [ex, gy(ex, ez) + 0.5, ez]], 1.0, 0.8, 7, 5)); } }
  for (let i = 0; i < 10; i++){ const a = R() * TAU, d = rr(8, 26), x = Math.cos(a) * d, z = Math.sin(a) * d; K.geo('boneD', cyl(0.2, 0.25, rr(1.2, 2.6), 6), x, gy(x, z) + 0.2, z, Math.PI / 2, R() * 3, 0.1); }
  P.lamp(ax * 6 + px * 12, az * 6 + pz * 12, 'iron'); P.lamp(-ax * 6 - px * 12, -az * 6 - pz * 12, 'iron');
  motesFx(CUR.near, [0, gy(0, 0), 0], 20, LOW ? 12 : 26, '1.0, 0.75, 0.45', 6, 0.12);
  return finish();
}
// 메사 표식: 붉은 탁자 바위 (꼭대기 망루 · 큰 깃발 · 줄사다리) / 쌍둥이 바위 (꼭대기 사이 밧줄 다리 · 오두막)
function bMesa(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 280 });
  if (l.id === 'twins'){
    const A = (W.mesas || []).find(m => m.id === 'twinA') || { c: [cx - 10, cz - 9], r: 11 }, Bm = (W.mesas || []).find(m => m.id === 'twinB') || { c: [cx + 11, cz + 9], r: 9 };
    const ax = A.c[0] - cx, az = A.c[1] - cz, bx = Bm.c[0] - cx, bz = Bm.c[1] - cz, d = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / d, uz = (bz - az) / d;
    const ya = gy(ax, az), yb = gy(bx, bz), pa = [ax + ux * A.r * 0.75, ya, az + uz * A.r * 0.75], pb = [bx - ux * Bm.r * 0.75, yb, bz - uz * Bm.r * 0.75];
    for (const [p, s] of [[pa, 1], [pb, -1]]) for (const o of [-1, 1]){ K.geo('woodD', cyl(0.12, 0.14, 2.6, 6), p[0] - uz * o * 1.1, p[1] + 1.1, p[2] + ux * o * 1.1); }
    const n = 16; for (let i = 0; i < n; i++){ const t = (i + 0.5) / n, x = lerp(pa[0], pb[0], t), z = lerp(pa[2], pb[2], t), y = lerp(pa[1], pb[1], t) - Math.sin(t * Math.PI) * 2.2; K.box('wood', 1.9, 0.1, 0.4, x, y, z, 0, Math.atan2(ux, uz), 0); }
    for (const o of [-1, 1]) for (let i = 0; i < n; i++){ const t0 = i / n, t1 = (i + 1) / n, f = t => [lerp(pa[0], pb[0], t) - uz * o * 1.1, lerp(pa[1], pb[1], t) - Math.sin(t * Math.PI) * 2.2 + 1.0, lerp(pa[2], pb[2], t) + ux * o * 1.1]; link('rope', f(t0), f(t1), 0.05); }
    P.pennants([[pa[0], pa[1] + 4.5, pa[2]], [pb[0], pb[1] + 4.0, pb[2]]], 2.6, ['fabricR', 'fabricY', 'fabricB', 'fabricG', 'fabricW']); K.geo('woodD', cyl(0.08, 0.1, 4.6, 6), pa[0], pa[1] + 2.3, pa[2]); K.geo('woodD', cyl(0.08, 0.1, 4.2, 6), pb[0], pb[1] + 2.1, pb[2]);
    // 쌍둥이 A 위 은둔 오두막 · B 위 돌무더기
    { const hx = ax - ux * 2, hz = az - uz * 2, hy = gy(hx, hz); K.push(hx, hy, hz, Math.atan2(ux, uz)); K.box('wood', 3.6, 2.6, 3.0, 0, 1.3, 0); const rs = roofG(3.6, 3.0, 2.6, 0.8, 0.3, 'thatch', 0.35); gables(3.6, 3.0, 2.6, rs, 'wood', false); K.box('pRed', 0.8, 1.6, 0.06, 0, 0.8, 1.52); K.pop(); cb(hx, hz, 1.9, 1.6); flag(hx, hy + 6, hz, 0, 1.6, 0.9, 'fabricY'); }
    P.cairn(bx, bz, 2.4, 'redrock');
    platSeg(cx + pa[0] - ux, cz + pa[2] - uz, cx + (pa[0] + pb[0]) / 2, cz + (pa[2] + pb[2]) / 2, 1.8, pa[1] + 0.06, (pa[1] + pb[1]) / 2 - 2.2 + 0.06); platSeg(cx + (pa[0] + pb[0]) / 2, cz + (pa[2] + pb[2]) / 2, cx + pb[0] + ux, cz + pb[2] + uz, 1.8, (pa[1] + pb[1]) / 2 - 2.2 + 0.06, pb[1] + 0.06);
    return finish();
  }
  const ms = (W.mesas || []).find(m => m.id === l.id) || { r: 46 }, ty = gy(0, 0);
  // 꼭대기: 무너진 망루 + 큰 붉은 깃발
  K.push(4, ty - 0.5, -3); K.geo('redrock', cylM(3.2, 3.6, 6, 8), 0, 3, 0); K.geo('redrock', cylM(3.0, 3.2, 3.2, 8, true), 0, 7.6, 0); for (let i = 0; i < 8; i++){ const a = i / 8 * TAU; if (i % 3) K.box('redrock', 1.2, 1.2, 0.8, Math.cos(a) * 3.0, 9.8, Math.sin(a) * 3.0, 0, -a, 0); } K.pop(); cc(4, -3, 3.6);
  K.geo('woodD', cyl(0.18, 0.24, 18, 8), -5, ty + 9, 4); K.geo('gold', sph(0.4, 8, 6), -5, ty + 18.2, 4); flag(-5, ty + 17.6, 4, 0.8, 6, 3.4, 'fabricR'); cc(-5, 4, 0.4);
  P.cairn(10, 8, 2.6, 'redrock'); P.cairn(-12, -8, 2.0, 'redrock'); for (let i = 0; i < 5; i++){ const x = rr(-14, 14), z = rr(-14, 14); P.skull(x, gy(x, z), z, rr(1.2, 2), R() * 6); }
  // 가장자리 줄사다리 (남서쪽 면)
  const la = 2.4, [ed, top, bot] = findEdge(0 + cx, cz, Math.cos(la), Math.sin(la), (ms.r || 46) + 20), lx = Math.cos(la) * (ed + 0.4), lz = Math.sin(la) * (ed + 0.4), hl = Math.max(4, top - bot);
  K.push(lx, bot, lz, Math.atan2(Math.cos(la), Math.sin(la))); for (const s of [-1, 1]) K.geo('rope', cyl(0.04, 0.04, hl, 4), s * 0.4, hl / 2, 0); for (let i = 0; i < hl / 0.45; i++) K.box('wood', 0.9, 0.06, 0.12, 0, 0.3 + i * 0.45, 0.02); K.pop();
  // 발치: 붉은 선돌 고리
  for (let i = 0; i < 10; i++){ const a = i / 10 * TAU + 0.15, r = (ms.r || 46) + 8, x = Math.cos(a) * r, z = Math.sin(a) * r; if (roadD(cx + x, cz + z) < 3 || kept(cx + x, cz + z, 2)) continue; const y = gy(x, z) - 0.4, h = rr(3, 5.5); K.push(x, y, z, -a, rr(-0.1, 0.1)); K.geo('redrock', cyl(0.6, 1.0, h, 5), 0, h / 2, 0); K.pop(); cc(x, z, 0.9); }
  return finish();
}

// ───────────────────────── 거인의 고원 ─────────────────────────
// 무릎 꿇은 거인 기사 석상 (검을 앞에 꽂음) — 로컬 +z 가 앞
function titan(x, z, ry, s = 1, key = 'ruin'){
  const y = gy(x, z) - 0.6; K.push(x, y, z, ry);
  K.box('stone', 8 * s, 1.6, 8 * s, 0, 0.8, 0); K.box('mossy', 7 * s, 0.5, 7 * s, 0, 1.85, 0);
  K.push(0, 2.1, 0, 0, 0, 0);
  K.box(key, 1.8 * s, 4.2 * s, 2.0 * s, -1.4 * s, 2.1 * s, -1.6 * s, 0.35); K.box(key, 1.8 * s, 2.0 * s, 4.4 * s, -1.4 * s, 0.9 * s, 0.6 * s);   // 꿇은 다리
  K.box(key, 1.8 * s, 4.4 * s, 1.8 * s, 1.4 * s, 2.2 * s, 1.2 * s); K.box(key, 1.8 * s, 1.6 * s, 4.0 * s, 1.4 * s, 4.2 * s, -0.4 * s);           // 세운 다리
  K.box(key, 4.6 * s, 2.0 * s, 3.0 * s, 0, 5.2 * s, -1.2 * s); K.geo(key, lathe([[2.1 * s, 0], [2.6 * s, 2.2 * s], [3.0 * s, 4.6 * s], [2.2 * s, 5.4 * s], [0, 5.6 * s]], 8, 0.4), 0, 6.0 * s, -1.2 * s, 0, Math.PI / 8, 0, 1, 1, 0.7);
  for (const sd of [-1, 1]){ K.geo(key, sph(1.5 * s, 10, 8), sd * 3.0 * s, 10.6 * s, -1.2 * s, 0, 0, 0, 1, 0.8, 1); K.geo(key, tubeG([[sd * 3.2 * s, 10.2 * s, -1.0 * s], [sd * 2.6 * s, 7.6 * s, 1.4 * s], [sd * 0.6 * s, 9.0 * s, 3.0 * s]], 0.9 * s, 0.75 * s, 7, 4)); }
  K.geo(key, sph(1.4 * s, 12, 10), 0, 12.6 * s, -1.0 * s, 0, 0, 0, 1, 1.15, 1); K.box('dark', 1.8 * s, 0.25 * s, 0.3 * s, 0, 12.7 * s, 0.35 * s); K.geo('bronze', cone(0.5 * s, 2.6 * s, 4), 0, 14.4 * s, -1.2 * s, -0.4, 0, 0);
  // 검 (땅에 꽂힘)
  K.box('steel', 0.5 * s, 12 * s, 1.5 * s, 0, 3.0 * s, 3.4 * s); K.box('bronze', 4.4 * s, 0.6 * s, 0.9 * s, 0, 9.2 * s, 3.4 * s); K.geo('bronze', cylM(0.35 * s, 0.35 * s, 2.0 * s, 8), 0, 10.4 * s, 3.4 * s); K.geo('glowC', sph(0.5 * s, 10, 8), 0, 11.6 * s, 3.4 * s);
  K.pop(); K.pop(); cb(x, z, 4 * s, 4 * s, ry);
  const v = new V3(0, 2.1 + 11.6 * s, 3.4 * s).applyAxisAngle(new V3(0, 1, 0), ry); glowAbs(OX + x + v.x, y + v.y, OZ + z + v.z, 0x6af0ff, 3, 0.6);
}
// 거인의 계단 (계단은 world): 위쪽 거인 기사 둘 · 아래 횃불 오벨리스크 · 옆 난간 잔해
function bStairs(l){
  const [cx, cz] = l.c, rp = (W.ramps || []).find(r => r.id === 'titanstairs') || { from: [cx + 26, cz + 26], to: [cx - 28, cz - 28], w: 16 };
  begin(l.id, cx, cz, { lm: l, nearR: 260 });
  const A = [rp.from[0] - cx, rp.from[1] - cz], Bp = [rp.to[0] - cx, rp.to[1] - cz], L = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]), ux = (Bp[0] - A[0]) / L, uz = (Bp[1] - A[1]) / L, px = -uz, pz = ux, down = Math.atan2(-ux, -uz), hw = rp.w / 2;
  for (const s of [-1, 1]) titan(Bp[0] + px * s * (hw + 6) + ux * 3, Bp[1] + pz * s * (hw + 6) + uz * 3, down, 1);
  for (const s of [-1, 1]){ const x = A[0] + px * s * (hw + 3), z = A[1] + pz * s * (hw + 3), y = gy(x, z) - 0.3; K.push(x, y, z, down); K.box('ruin', 2.4, 1.0, 2.4, 0, 0.5, 0); K.geo('ruin', cylM(0.8, 1.1, 7, 4), 0, 4.5, 0, 0, Math.PI / 4, 0); K.geo('iron', lathe([[0, 0], [1.0, 0.1], [1.2, 0.7], [0, 0.7]], 10, 0.4), 0, 8.0, 0); K.geo('glowO', cone(0.8, 1.6, 7), 0, 9.4, 0); K.pop(); cc(x, z, 1.4); glowAbs(cx + x, y + 9.2, cz + z, 0xff8a30, 5, 0.7); CUR.sparks = (CUR.sparks || []).concat([new V3(x, y + 9, z)]); }
  for (const s of [-1, 1]) for (let i = 0; i <= 8; i++){ const t = i / 8, x = lerp(A[0], Bp[0], t) + px * s * (hw + 0.8), z = lerp(A[1], Bp[1], t) + pz * s * (hw + 0.8), y = gy(x, z) - 0.2; if (i % 3 === 1) continue; const h = rr(1.2, 2.6); K.box('ruin', 1.4, h, 1.4, x, y + h / 2, z, 0, down, rr(-0.06, 0.06)); if (R() < 0.5) K.box('ruin', 1.6, 0.4, 1.6, x, y + h + 0.2, z, 0, down, 0); cc(x, z, 0.8); }
  sparkFx(CUR.near, CUR.sparks, '1.0, 0.6, 0.2', 16, 3); CUR.sparks = null;
  return finish();
}
// 잊힌 왕의 성채: 무너진 성벽 · 탑 · 성문 · 지붕 없는 본성의 왕좌
function bCitadel(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 280 });
  const hx = 21, hz = 18, th = 2.4, base = (x, z) => gy(x, z) - 0.6;
  const wall = (x0, z0, x1, z1, h) => { const Lw = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, [lo] = foot(cx + mx, cz + mz, th / 2, Lw / 2, yaw), y = lo - 0.6;
    K.push(mx, y, mz, yaw); K.box('ruin', th, h + 0.6, Lw, 0, (h + 0.6) / 2, 0); const n = Math.floor(Lw / 1.6); for (let i = 0; i < n; i++) if (i % 2 === 0) K.box('ruin', th + 0.2, 0.9, 0.9, 0, h + 1.05, -Lw / 2 + (i + 0.5) * Lw / n); K.box('stoneD', th + 0.3, 0.3, Lw + 0.2, 0, h + 0.5, 0); K.pop(); K.push(mx, 0, mz, yaw); cb(0, 0, th / 2 + 0.1, Lw / 2); K.pop(); };
  const side = (ax, az, bx, bz, segs) => { for (let i = 0; i < segs.length; i++){ const t0 = i / segs.length, t1 = (i + 1) / segs.length, h = segs[i]; if (h <= 0) continue; wall(lerp(ax, bx, t0), lerp(az, bz, t0), lerp(ax, bx, t1), lerp(az, bz, t1), h); } };
  side(-hx, -hz, hx, -hz, [8, 7.5, 3, 0, 8]); side(-hx, hz, hx, hz, [7, 2.5, 7.5, 8, 6]); side(-hx, -hz, -hx, hz, [8, 8, 0, 4, 7.5]); side(hx, -hz, hx, -4.2, [8, 6]); side(hx, 4.2, hx, hz, [6.5, 8]);
  const tower = (x, z, r, h, roof) => { const [lo] = footC(cx + x, cz + z, r), y = lo - 0.6; K.geo('ruin', cylM(r, r + 0.4, h, 14), x, y + h / 2, z); for (let i = 0; i < 10; i++){ const a = i / 10 * TAU; if (i % 2 === 0) K.box('ruin', 1.0, 1.0, 0.8, x + Math.cos(a) * r, y + h + 0.5, z + Math.sin(a) * r, 0, -a + Math.PI / 2, 0); }
    K.geo('stoneD', tor(r + 0.1, 0.25, 4, 18), x, y + h, z, Math.PI / 2); for (let i = 0; i < 4; i++){ const a = i / 4 * TAU + 0.4; K.box('dark', 0.35, 1.4, 0.2, x + Math.cos(a) * (r + 0.05), y + h * 0.6, z + Math.sin(a) * (r + 0.05), 0, -a + Math.PI / 2, 0); }
    if (roof){ K.geo('slate', cone(r + 0.8, r * 2.2, 14), x, y + h + r * 1.1 + 0.4, z); K.geo('woodD', cyl(0.08, 0.1, 3, 6), x, y + h + r * 2.2 + 1.6, z); flag(x, y + h + r * 2.2 + 2.9, z, 0.4, 2.4, 1.3, 'fabricP'); } cc(x, z, r + 0.3); return y + h; };
  tower(-hx, -hz, 3.6, 19, true); tower(hx, -hz, 3.6, 9, false); tower(hx, hz, 3.8, 23, true); tower(-hx, hz, 3.4, 6, false);
  // 성문 (동쪽)
  for (const s of [-1, 1]) tower(hx + 0.5, s * 5.2, 2.6, 12, s > 0);
  { const y = base(hx, 0); K.push(hx + 0.5, y, 0, Math.PI / 2); K.geo('ruin', new THREE.TorusGeometry(3.0, 0.9, 6, 16, Math.PI), 0, 8.0, 0, 0, 0, 0, 1, 0.8, 1); K.box('ruin', 8, 2.4, 2.6, 0, 11, 0); for (let i = 0; i < 6; i++) K.box('iron', 0.12, 3.2, 0.12, -2.5 + i, 9.6, 0.4); for (let i = 0; i < 3; i++) K.box('iron', 5.4, 0.12, 0.12, 0, 8.4 + i, 0.4); K.pop(); }
  // 본성 (지붕 없음) + 왕좌
  const kx = -5, kz = -2, kw = 8, kd = 7, ky = base(kx, kz);
  for (const [x0, z0, x1, z1, h] of [[-kw, -kd, kw, -kd, 12], [-kw, -kd, -kw, kd, 12], [-kw, kd, 1, kd, 11], [3, kd, kw, kd, 5], [kw, -kd, kw, -2.2, 11], [kw, 2.2, kw, kd, 9]]) wall(kx + x0, kz + z0, kx + x1, kz + z1, h);
  K.push(kx, ky, kz, Math.PI / 2);
  for (let i = 0; i < 3; i++) K.box('marble', 6 - i * 1.2, 0.4, 3.4 - i * 0.6, 0, 0.6 + i * 0.4, -kw + 3.2 + i * 0.3);
  K.box('gold', 2.4, 0.5, 1.6, 0, 2.15, -kw + 3.5); K.box('gold', 2.4, 3.4, 0.4, 0, 3.6, -kw + 2.9); K.box('fabricR', 1.9, 0.2, 1.3, 0, 2.45, -kw + 3.55); for (const s of [-1, 1]){ K.box('gold', 0.4, 1.1, 1.5, s * 1.2, 2.7, -kw + 3.5); K.geo('gold', sph(0.3, 8, 6), s * 1.2, 5.4, -kw + 2.9); }
  K.geo('glowY', new THREE.OctahedronGeometry(0.35, 0), 0, 5.6, -kw + 2.9); K.geo('fabricR', plane(2.4, 9), 0, 0.42, -1.5, -Math.PI / 2, 0, 0);
  for (const s of [-1, 1]){ K.geo('woodD', cyl(0.1, 0.12, 7, 6), s * 3.4, 3.5, -kw + 3); K.geo('fabricP', plane(1.6, 3.6), s * 3.4, 4.8, -kw + 3.1); K.geo('fabricP', triG([-0.8, 3.0, 0.02], [0.8, 3.0, 0.02], [0, 2.2, 0.02]), s * 3.4, 0, -kw + 3.1); }
  K.pop(); glowAbs(cx + kx - kw + 2.9, ky + 5.6, cz + kz, 0xffe070, 2.4, 0.5);
  F.box(cx + kx - kw + 3.5, cz + kz, 1.7, 3.0); STATS.colliders++;
  // 잔해 · 쓰러진 기둥 · 정원 (남서쪽 바깥)
  for (let i = 0; i < 14; i++){ const x = rr(-hx + 3, hx - 3), z = rr(-hz + 3, hz - 3); if (Math.hypot(x - kx, z - kz) < 10) continue; K.geo('ruin', rockG(rr(0.5, 1.2), 0.6, 0), x, gy(x, z), z); }
  P.fallen(10, -10, 0.7); P.fallen(-14, 8, 2.1); P.pillar(12, 9, 5, true); P.pillar(-15, -10, 3.2, true);
  const gx = -30, gz = -24; for (const [ax, az, bx, bz] of [[gx - 9, gz - 7, gx + 9, gz - 7], [gx - 9, gz + 7, gx + 2, gz + 7], [gx - 9, gz - 7, gx - 9, gz + 7]]){ const Lh = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az), y = gy((ax + bx) / 2, (az + bz) / 2); K.box('hedge', 1.0, 1.4, Lh, (ax + bx) / 2, y + 0.6, (az + bz) / 2, 0, yaw, 0); K.push((ax + bx) / 2, 0, (az + bz) / 2, yaw); cb(0, 0, 0.6, Lh / 2); K.pop(); }
  { const y = gy(gx, gz); K.push(gx, y, gz); K.geo('ruin', lathe([[2.6, 0], [2.7, 0.7], [2.3, 0.75], [2.25, 0.25], [0, 0.25]], 20, 0.4)); K.geo('ruin', cyl(0.3, 0.4, 1.8, 8), 0, 1.0, 0); K.geo('mossy', sph(0.7, 8, 6), 0, 2.0, 0); K.pop(); cc(gx, gz, 2.7); P.statue(gx + 5, gz - 4, -0.8, 'ruin', 2.4); }
  MAPBOX.push([cx, cz, hx, hz, 0]);
  return finish();
}
// 부서진 거상: 하늘을 가리키는 오른팔 · 땅에 박힌 왼팔
function bColossus(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 280 });
  const ry = 0.18, [lo, hi] = footC(cx, cz, 7), y = lo - 0.5;
  K.push(0, y, 0, ry);
  K.box('stone', 12, hi - lo + 3.2, 12, 0, (hi - lo + 3.2) / 2, 0); K.box('ruin', 10, 1.2, 10, 0, hi - lo + 3.8, 0);
  const b = hi - lo + 4.4;
  for (const s of [-1, 1]){ K.geo('ruin', cylM(1.5, 1.9, 11, 12), s * 2.0, b + 5.5, 0, 0, 0, -s * 0.06); K.box('ruin', 2.6, 1.2, 3.6, s * 2.1, b + 0.6, 0.5); }
  K.box('bronze', 6.8, 1.2, 4.2, 0, b + 11.4, 0); K.geo('ruin', lathe([[3.0, 0], [3.5, 3], [4.4, 7], [4.6, 9.5], [2.2, 11], [0, 11]], 10, 0.4), 0, b + 11.8, 0, 0, 0, 0, 1, 1, 0.65);
  for (const s of [-1, 1]) K.geo('ruin', sph(2.2, 12, 10), s * 4.6, b + 21.2, 0, 0, 0, 0, 1, 0.85, 1);
  K.geo('ruin', cylM(1.1, 1.3, 1.6, 10), 0, b + 23.2, 0); K.geo('ruin', sph(2.4, 14, 12), 0, b + 25.6, 0, 0, 0, 0, 1, 1.15, 1); K.geo('bronze', cylM(2.5, 2.5, 1.0, 14), 0, b + 26.6, 0); K.geo('bronze', tor(1.6, 0.35, 6, 16, Math.PI), 0, b + 27.2, 0, 0, Math.PI / 2, 0, 1, 1.4, 1); K.box('dark', 2.6, 0.4, 0.4, 0, b + 25.8, 2.25);
  // 오른팔 (하늘로)
  K.geo('ruin', tubeG([[4.8, b + 21, 0], [6.2, b + 26, 0.8], [7.2, b + 31, 1.2], [7.8, b + 35, 1.4]], 1.4, 1.0, 9, 5)); K.geo('ruin', sph(1.3, 10, 8), 7.9, b + 36, 1.4, 0, 0, 0, 1, 1.2, 1); K.geo('ruin', tubeG([[7.9, b + 36.6, 1.4], [8.1, b + 38.5, 1.5], [8.2, b + 40.4, 1.6]], 0.4, 0.28, 6, 4));
  // 왼쪽 어깨 (부러진 자리)
  K.geo('mossy', cylM(1.4, 1.6, 2.4, 10), -6.4, b + 20.4, 0, 0, 0, 1.2);
  for (const s of [-1, 1]) K.geo('mossy', sph(1.2, 8, 6), s * 3.2, b + 22.6, 0.6, 0, 0, 0, 1, 0.4, 1);
  K.pop(); cb(0, 0, 6.2, 6.2, ry);
  // 땅에 박힌 왼팔
  { const ax = 13, az = 9, ay = gy(ax, az); K.geo('ruin', tubeG([[ax - 6, ay - 3, az - 4], [ax - 2, ay + 3, az - 1.2], [ax + 1.5, ay + 8, az + 1]], 1.4, 1.1, 9, 5)); K.geo('ruin', sph(1.3, 10, 8), ax + 1.8, ay + 9, az + 1.2);
    for (let f = 0; f < 4; f++) K.geo('ruin', tubeG([[ax + 1.8, ay + 9.5, az + 1.2], [ax + 1.8 + (f - 1.5) * 0.7, ay + 11.5, az + 1.6], [ax + 1.8 + (f - 1.5) * 0.9, ay + 12.8, az + 2.6]], 0.35, 0.25, 6, 4));
    rockPile(ax - 5, az - 3.5, 3, 7, 'ruin'); cc(ax - 3, az - 2.5, 2.2); cc(ax, az, 1.4); }
  // 떨어진 조각 · 이끼
  for (let i = 0; i < 10; i++){ const a = R() * TAU, d = rr(9, 22), x = Math.cos(a) * d, z = Math.sin(a) * d; K.geo(R() < 0.6 ? 'ruin' : 'mossy', rockG(rr(0.6, 1.6), 0.7), x, gy(x, z) + 0.2, z); }
  P.pillar(-12, -8, 4, true); P.fallen(-16, 4, 1.2);
  return finish();
}
// 별의 관측소: 돔과 망원경이 달린 석탑 · 돌아가는 혼천의
function bTower(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 280 });
  const [lo, hi] = footC(cx, cz, 5.5), y = lo - 0.5, Ht = 22 + (hi - lo);
  K.push(0, y, 0);
  K.geo('stone', cylM(4.0, 5.0, Ht, 16), 0, Ht / 2, 0); K.geo('stoneD', cylM(5.4, 5.6, 1.2, 16), 0, 0.6, 0);
  for (let i = 0; i < 4; i++){ const a = i / 4 * TAU + 0.4; K.push(Math.cos(a) * 4.9, 0, Math.sin(a) * 4.9, -a + Math.PI / 2); K.box('stoneD', 1.2, Ht * 0.45, 1.6, 0, Ht * 0.22, 0, -0.08); K.pop(); }
  for (const h of [6, 11, 16]) for (let i = 0; i < 3; i++){ const a = i / 3 * TAU + h, r = 5 - h / Ht; K.push(Math.cos(a) * r, h, Math.sin(a) * r, -a + Math.PI / 2, -0.05); win(0, 0, 0.5, 1.2, 'pBlue', false); K.pop(); }
  K.geo('stoneD', cylM(5.6, 5.0, 0.6, 16), 0, Ht - 2.4, 0); for (let i = 0; i < 28; i++){ const a = i / 28 * TAU; K.box('iron', 0.07, 1.0, 0.07, Math.cos(a) * 5.45, Ht - 1.6, Math.sin(a) * 5.45); } K.geo('iron', tor(5.45, 0.05, 4, 40), 0, Ht - 1.1, 0, Math.PI / 2);
  K.geo('pBlue', new THREE.SphereGeometry(4.4, 20, 10, 0, TAU, 0, Math.PI / 2), 0, Ht, 0); K.geo('gold', tor(4.4, 0.12, 6, 32), 0, Ht, 0, Math.PI / 2); for (let i = 0; i < 9; i++){ const a = i / 9 * TAU; K.geo('glowY', new THREE.OctahedronGeometry(0.22, 0), Math.cos(a) * 3.6, Ht + 2.3, Math.sin(a) * 3.6); }
  K.push(0, Ht + 1.6, 0, 0.8, -0.75); K.geo('brass', cyl(0.55, 0.8, 8, 14), 0, 3.4, 0); K.geo('brass', tor(0.6, 0.1, 6, 14), 0, 7.3, 0, Math.PI / 2); K.geo('glass', new THREE.CircleGeometry(0.5, 12), 0, 7.42, 0, -Math.PI / 2, 0, 0); K.pop();
  K.box('pRed', 1.4, 2.6, 0.2, 4.9, 1.3, 0, 0, Math.PI / 2, 0); K.box('stoneD', 2.0, 0.3, 0.6, 5.0, 2.75, 0, 0, Math.PI / 2, 0);
  K.pop(); cc(0, 0, 5.4); glowAbs(cx, y + Ht + 2.3, cz, 0xffe070, 5, 0.5);
  // 혼천의 (기둥 위 금빛 고리 셋이 돌아요)
  const ax = 9, az = -7, ay = gy(ax, az); K.geo('stone', cylM(0.8, 1.1, 5, 8), ax, ay + 2.5, az); K.geo('stoneD', cylM(1.4, 1.4, 0.4, 8), ax, ay + 0.2, az); cc(ax, az, 1.2);
  const arm = new THREE.Group(); arm.position.set(ax, ay + 7.6, az); CUR.near.add(arm); const rings = [2.4, 2.0, 1.6].map((r, i) => { const m = new THREE.Mesh(tor(r, 0.09, 6, 40), MAT.gold); m.rotation.set(i * 0.9, i * 0.6, 0); arm.add(m); return m; });
  const core = new THREE.Mesh(sph(0.6, 14, 10), MAT.glowY); arm.add(core); arm.add(X.glowSprite(0xffe890, 4, 0.45));
  anim(dt => { rings[0].rotation.y += dt * 0.5; rings[1].rotation.x += dt * 0.7; rings[2].rotation.z += dt * 0.9; });
  B.far.push(['gold', tor(2.4, 0.2, 4, 16).translate(ax, ay + 7.6, az)]);
  // 연구실 · 해시계 · 별 지도 받침
  house(-10, 7, Math.PI / 2 + 0.3, { w: 6, d: 5, roof: 'slate', paint: 'pBlue', wall: 'plaster3' });
  { const x = 6, z = 9, yy = gy(x, z); K.geo('stone', cylM(1.2, 1.4, 0.8, 16), x, yy + 0.4, z); K.geo('brass', triG([0, 0, 0], [0, 1.0, 0], [0, 0, 0.9]), x, yy + 0.8, z); cc(x, z, 1.3); }
  { const x = 10, z = 4, yy = gy(x, z); K.push(x, yy, z, -2.0); for (const s of [-1, 1]) K.geo('woodD', cyl(0.04, 0.05, 1.5, 4), s * 0.5, 0.75, 0, 0.2); K.box('wood', 1.3, 0.9, 0.06, 0, 1.45, 0.15, -0.35); K.geo('fabricB', plane(1.2, 0.8), 0, 1.45, 0.19, -0.35, 0, 0); for (let i = 0; i < 8; i++) K.geo('glowY', sph(0.03, 4, 3), rr(-0.5, 0.5), 1.45 + rr(-0.3, 0.3), 0.22 - 0.1, -0.35); K.pop(); }
  motesFx(CUR.near, [0, y + Ht, 0], 12, LOW ? 12 : 24, '1.0, 0.95, 0.6', 8, 0.1);
  return finish();
}

// ───────────────────────── 검은 가시 침식지 ─────────────────────────
// 가시 덩굴 (휘어진 관 + 가시)
function thornVine(pts, r0, r1, spikes = 10){
  K.geo('thorn', tubeG(pts, r0, r1, 6, 6));
  const c = new THREE.CatmullRomCurve3(pts.map(p => new V3(...p))); for (let i = 0; i < spikes; i++){ const t = rr(0.05, 0.95), p = c.getPointAt(t), tg = c.getTangentAt(t), r = lerp(r0, r1, t), a = R() * TAU, n = new V3(Math.cos(a), rr(-0.3, 0.6), Math.sin(a)).cross(tg).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), n), e = new THREE.Euler().setFromQuaternion(q); K.geo(R() < 0.85 ? 'thornR' : 'crystalP', cone(r * 0.45, r * 2.4, 4), p.x + n.x * r, p.y + n.y * r, p.z + n.z * r, e.x, e.y, e.z); }
}
// 침식의 문: 검은 가시에 먹힌 옛 관문 (길은 열려 있어요)
function bThornGate(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 300 });
  for (const s of [-1, 1]){ const x = s * 8, [lo, hi] = foot(cx + x, cz, 3.2, 3.2), y = lo - 0.5, h = s < 0 ? 13 : 10.5; K.box('darkst', 6, h + hi - lo, 6, x, y + (h + hi - lo) / 2, 0); for (let i = 0; i < 4; i++) if ((i + (s > 0 ? 1 : 0)) % 2 === 0) K.box('darkst', 1.4, 1.2, 1.4, x + (i % 2 ? 2.3 : -2.3), y + h + hi - lo + 0.6, i < 2 ? 2.3 : -2.3); K.box('dark', 0.5, 2.0, 0.2, x - s * 0.5, y + h * 0.6, 3.05); F.box(cx + x, cz, 3.1, 3.1); STATS.colliders++;
    const wx0 = s * 11, wx1 = s * 22, wy = gy(s * 16, 0) - 0.5; K.box('darkst', 11, s < 0 ? 4.5 : 2.6, 2.2, s * 16.5, wy + (s < 0 ? 2.25 : 1.3), 0, 0, 0, s * 0.03); F.box(cx + s * 16.5, cz, 5.5, 1.2); STATS.colliders++; }
  { const y = Math.max(gy(-5, 0), gy(5, 0)); K.geo('darkst', new THREE.TorusGeometry(5.0, 1.0, 6, 18, Math.PI), 0, y + 7.5, 0, 0, 0, 0, 1, 0.75, 1.6); K.box('darkst', 12, 2.0, 3.2, 0, y + 12.0, 0); for (let i = 0; i < 9; i++) K.box('iron', 0.14, 2.8, 0.14, -4 + i, y + 10.0, 1.2); for (let i = 0; i < 3; i++) K.box('iron', 8.6, 0.14, 0.14, 0, y + 8.8 + i, 1.2); K.box('glowP', 2.2, 2.2, 0.15, 0, y + 12.1, 1.65, 0, 0, Math.PI / 4); glowAbs(cx, y + 12.1, cz + 1.8, 0xc070ff, 4, 0.7); }
  // 가시 덩굴 (탑을 감고 아치 위로)
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++){ const x = s * 8, y = gy(x, 0), a0 = k * 2.1 + s; const pts = []; for (let i = 0; i <= 6; i++){ const a = a0 + i * 1.1, r = 3.6 + Math.sin(i) * 0.4; pts.push([x + Math.cos(a) * r, y + i * 2.0, Math.sin(a) * r]); } thornVine(pts, 0.55, 0.2, 12); }
  for (let k = 0; k < 3; k++){ const y = gy(0, 0); thornVine([[-11, y, rr(-3, 3)], [-6, y + 9 + k * 2, rr(-2, 2)], [0, y + 14 + k * 1.5, rr(-1.5, 1.5)], [6, y + 10 + k * 2, rr(-2, 2)], [11, y, rr(-3, 3)]], 0.7, 0.35, 16); }
  for (let i = 0; i < 10; i++){ const s = R() < 0.5 ? -1 : 1, x = s * rr(10, 24), z = rr(-5, 5), y = gy(x, z); thornVine([[x, y - 0.5, z], [x + rr(-2, 2), y + rr(2, 4), z + rr(-2, 2)], [x + rr(-3, 3), y + rr(4, 7), z + rr(-3, 3)]], 0.45, 0.1, 6); }
  for (let i = 0; i < 12; i++){ const s = R() < 0.5 ? -1 : 1, x = s * rr(5.5, 11), z = rr(-3.5, 3.5), y = gy(x, z) + rr(1, 10); K.geo('crystalP', new THREE.OctahedronGeometry(rr(0.4, 0.9), 0), x, y, z, R(), R(), R(), 0.7, 1.6, 0.7); }
  motesFx(CUR.near, [0, gy(0, 0), 0], 16, LOW ? 24 : 50, '0.8, 0.4, 1.0', 9, 0.15);
  return finish();
}
// 가시 심장: 가시 첨탑 원 · 덩굴에 매달려 고동치는 심장 (가운데는 보스 싸움터로 비워 둬요)
function bThornHeart(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 300 });
  const y0 = gy(0, 0), hy = y0 + 18, tips = [];
  for (let i = 0; i < 9; i++){ const a0 = i / 9 * TAU + 0.2, r = rr(18, 24); let a = a0; for (let t = 1; t < 9 && roadD(cx + Math.cos(a) * r, cz + Math.sin(a) * r) < 5.5; t++) a = a0 + (t % 2 ? 1 : -1) * Math.ceil(t / 2) * 0.09; if (roadD(cx + Math.cos(a) * r, cz + Math.sin(a) * r) < 5.5) continue; /* 길 위는 비워요 */ const x = Math.cos(a) * r, z = Math.sin(a) * r, y = gy(x, z) - 1.5, h = rr(16, 28), lean = rr(-0.35, 0.15);
    const pts = [[x, y, z], [x + Math.cos(a) * lean * 4, y + h * 0.45, z + Math.sin(a) * lean * 4], [x + Math.cos(a) * lean * 9, y + h * 0.8, z + Math.sin(a) * lean * 9], [x + Math.cos(a) * lean * 12 + rr(-2, 2), y + h, z + Math.sin(a) * lean * 12 + rr(-2, 2)]];
    thornVine(pts, rr(2.2, 3.0), 0.12, 22); cc(x, z, 2.4); tips.push([pts[1], pts[2]]);
    for (let k = 0; k < 2; k++){ const b = a + rr(-0.25, 0.25), rd = r + rr(3, 7), px = Math.cos(b) * rd, pz = Math.sin(b) * rd, py = gy(px, pz) - 0.5; if (roadD(cx + px, cz + pz) < 4) continue; thornVine([[px, py, pz], [px + rr(-1, 1), py + rr(4, 8), pz + rr(-1, 1)], [px + rr(-2, 2), py + rr(8, 12), pz + rr(-2, 2)]], 1.0, 0.1, 8); } }
  // 심장을 붙잡은 덩굴
  for (let i = 0; i < tips.length; i += 1.5){ const [p1, p2] = tips[i | 0], from = i % 3 < 1.5 ? p2 : p1; thornVine([from, [from[0] * 0.5, hy + 5, from[2] * 0.5], [from[0] * 0.15, hy + 1, from[2] * 0.15]], 0.7, 0.35, 10); }
  // 땅: 썩은 고리 · 보라 금
  { const g = new THREE.RingGeometry(10, 30, 48, 6).rotateX(-Math.PI / 2); drape(g, cx, cz, 0.08); add('blightD', std({ color: 0x2a1a30, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, transparent: true, opacity: 0.85 })); K.geo('blightD', g);
    for (let i = 0; i < 14; i++){ const a = R() * TAU, r0 = rr(4, 12), r1 = r0 + rr(6, 14), pts = []; for (let k = 0; k <= 5; k++){ const rr2 = lerp(r0, r1, k / 5), aa = a + Math.sin(k * 1.7) * 0.12; pts.push([Math.cos(aa) * rr2, 0, Math.sin(aa) * rr2]); } for (let k = 0; k < 5; k++){ const [ax2, , az2] = pts[k], [bx2, , bz2] = pts[k + 1]; link('glowP', [ax2, gy(ax2, az2) + 0.1, az2], [bx2, gy(bx2, bz2) + 0.1, bz2], 0.16, 0.04); } } }
  // 심장 (따로 움직여요)
  const hg = new THREE.Group(); hg.position.set(0, hy, 0); CUR.near.add(hg);
  const hm = new THREE.Mesh(mergeG([sph(2.6, 16, 12).translate(-1.3, 0.8, 0), sph(2.6, 16, 12).translate(1.3, 0.8, 0), cone(3.4, 4.6, 16).rotateX(Math.PI).translate(0, -2.0, 0)]), MAT.crystalP); hm.scale.set(1, 1, 0.8); hg.add(hm);
  const cage = new THREE.Mesh(mergeG([0, 1, 2].map(i => tor(3.8, 0.18, 6, 24).rotateX(Math.PI / 2 + i * 0.7).rotateY(i * 1.1))), MAT.thorn); hg.add(cage);
  const hs = X.glowSprite(0xc060ff, 18, 0.6); hg.add(hs);
  anim((dt, t) => { const b = Math.pow(Math.max(0, Math.sin(t * 2.4)), 6) + Math.pow(Math.max(0, Math.sin(t * 2.4 - 0.6)), 8) * 0.6, k = 1 + b * 0.09; hm.scale.set(k, k, k * 0.8); MAT.crystalP.emissiveIntensity = 1.6 + b * 1.8; hs.material.opacity = 0.45 + b * 0.35; cage.rotation.y += dt * 0.2; hg.position.y = hy + Math.sin(t * 0.6) * 0.4; });
  B.far.push(['crystalP', sph(3.6, 10, 8).translate(0, hy, 0)]); glowAbs(cx, hy, cz, 0xc060ff, 12, 0.9);
  G.particles(LOW ? 40 : 90, [new V3(0, hy, 0)], { parent: CUR.near, vert: `float life = fract(uTime * 0.12 + aSeed); vL = life; float an = aSeed * 50.0; vec3 p = position + vec3(cos(an) * (3.0 + life * 14.0), -life * 16.0 + sin(uTime + aSeed * 9.0), sin(an) * (3.0 + life * 14.0)); float sz = 0.3;`,
    frag: `float a = smoothstep(0.5, 0.0, d) * (1.0 - vL) * smoothstep(0.0, 0.1, vL); gl_FragColor = vec4(vec3(0.8, 0.4, 1.0) * a * 1.4, a);` });
  return finish();
}
function mergeG(list){ return G.mergeGeos(list.map(g => g.index ? g.toNonIndexed() : g)); }

// ───────────────────────── 서리 봉우리 ─────────────────────────
// 얼음 고개: 돌 도리이 두 개 · 오색 기도 깃발 · 종 사당 · 돌무더기
function bPass(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 300 });
  for (const gz of [10, -10]){ const y = Math.min(gy(-5.5, gz), gy(5.5, gz)) - 0.4; K.push(0, y, gz);
    for (const s of [-1, 1]){ K.geo('stone', cylM(0.55, 0.7, 7.4, 10), s * 5.5, 3.7, 0); K.box('stoneD', 1.6, 0.6, 1.6, s * 5.5, 0.3, 0); }
    K.box('stone', 13.4, 0.7, 1.0, 0, 7.6, 0); K.box('stoneD', 12.4, 0.5, 0.8, 0, 6.3, 0); for (const s of [-1, 1]) K.box('stone', 1.4, 0.5, 1.1, s * 6.9, 8.0, 0, 0, 0, s * 0.18); K.box('snow', 13.6, 0.25, 1.15, 0, 8.05, 0);
    K.box('wood', 2.6, 1.0, 0.14, 0, 6.95, 0.42); K.pop(); cc(-5.5, gz, 0.7); cc(5.5, gz, 0.7); }
  { const uv = signCell('얼음 고개', '', 'FROST PASS'); const y = Math.min(gy(-5.5, 10), gy(5.5, 10)) - 0.4; K.geo('signA', quadUV(2.5, 0.55, uv), 0, y + 6.95, 10.5); K.geo('signA', quadUV(2.5, 0.55, uv), 0, y + 6.95, 9.5, 0, Math.PI, 0); }
  // 기도 깃발 (고개 위를 가로질러요)
  const poles = [[-15, -4], [15, -2], [-14, 8], [14, 12], [-16, -16], [16, -18]].map(([x, z]) => { const y = gy(x, z); K.geo('woodD', cyl(0.08, 0.1, 6.5, 6), x, y + 3.2, z); K.geo('gold', sph(0.15, 6, 4), x, y + 6.5, z); cc(x, z, 0.2); return [x, y + 6.2, z]; });
  const PF = ['fabricB', 'fabricW', 'fabricR', 'fabricG', 'fabricY'];
  P.pennants([poles[0], poles[1]], 1.6, PF); P.pennants([poles[2], poles[3]], 1.6, PF); P.pennants([poles[4], poles[5]], 1.6, PF); P.pennants([poles[0], poles[2]], 0.8, PF); P.pennants([poles[1], poles[3]], 0.8, PF);
  // 종 사당
  { const x = 11, z = 2, y = gy(x, z); K.push(x, y, z, -Math.PI / 2); K.box('stone', 3.4, 0.5, 3.0, 0, 0.25, 0); for (const [a, b] of [[-1.3, -1.1], [1.3, -1.1], [-1.3, 1.1], [1.3, 1.1]]) K.geo('woodD', cyl(0.13, 0.15, 3.0, 6), a, 2.0, b); for (const s of [-1, 1]){ K.box('shingle', 3.8, 0.12, 1.9, 0, 3.75, s * 0.75, s * 0.6); K.box('snow', 3.8, 0.12, 1.7, 0, 3.86, s * 0.75, s * 0.6); }
    K.geo('bronze', lathe([[0, 0], [0.55, 0], [0.5, 0.15], [0.38, 0.6], [0.3, 0.95], [0, 1.0]], 14, 0.4), 0, 2.0, 0); K.geo('rope', cyl(0.03, 0.03, 1.8, 4), 0.3, 1.2, 0.3); K.box('wood', 1.0, 0.7, 0.6, 0, 0.85, -0.9); K.geo('glowO', sph(0.1, 6, 4), 0.3, 1.25, -0.9); K.pop(); cb(x, z, 1.7, 1.5, -Math.PI / 2); glow(x, y + 1.3, z, 0xffb050, 1.6, 0.4); }
  for (const [x, z, h] of [[-9, 0, 2.2], [-11, 14, 1.6], [10, -12, 2.6], [8, 15, 1.8]]) P.cairn(x, z, h, 'stone');
  for (let i = 0; i < 14; i++){ const x = rr(-20, 20), z = rr(-18, 18); if (Math.abs(x) < 5) continue; K.geo('snow', sph(rr(0.8, 1.8), 10, 6), x, gy(x, z) - 0.2, z, 0, 0, 0, 1.4, 0.4, 1); }
  P.lamp(-6.5, 0, 'snow'); P.lamp(6.5, -4, 'snow');
  return finish();
}
// 얼어붙은 제단 (레이드: 크라이오스) — 얼음 기둥 원 · 언 용 해골 · 얼음 아치 포털
function bAltar(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 360 });
  const rd = (W.roads.find(r => r.id === 'altar') || { pts: [[cx - 4, cz + 8]] }).pts, end = rd[rd.length - 1], ax = end[0] - cx, az = end[1] - cz, face = Math.atan2(ax, az);
  const [lo, hi0] = footC(cx, cz, 12), hi = hi0 - lo > 3 ? (lo + hi0) / 2 + 0.6 : hi0, y = hi;
  K.geo('darkst', cylM(12.5, 13.2, y - lo + 1.0, 24), 0, (y + lo) / 2 - 0.5 + 0.5, 0); K.geo('ice', cylM(10.5, 10.8, 0.3, 24), 0, y + 0.65, 0); for (let i = 0; i < 3; i++) K.geo('darkst', cylM(13.4 + i * 0.9, 13.8 + i * 0.9, 0.35, 24), 0, y + 0.3 - i * 0.35, 0);
  const rg = part(X.polarRing(7, 8.2, 96), runeRingMat('#8adfff', 5, 26), 0, y + 0.85, 0);
  // 얼음 기둥
  for (let i = 0; i < 8; i++){ const a = i / 8 * TAU + face + Math.PI / 8, x = Math.cos(a) * 11.5, z = Math.sin(a) * 11.5, h = rr(7, 12); K.geo('ice', new THREE.OctahedronGeometry(1, 0), x, y + h * 0.45, z, rr(-0.1, 0.1), R(), rr(-0.1, 0.1), 1.3, h * 0.55, 1.3); K.geo('glowB', new THREE.OctahedronGeometry(1, 0), x, y + h * 0.45, z, 0, R(), 0, 0.5, h * 0.4, 0.5); cc(x, z, 1.3); glowAbs(cx + x, y + h * 0.5, cz + z, 0x9fdcff, 3, 0.55); }
  // 얼음 아치 포털 (뒤쪽 · 길을 봐요)
  const bx = -Math.sin(face) * 6, bz = -Math.cos(face) * 6; K.push(bx, y + 0.8, bz, face);
  K.geo('ice', new THREE.TorusGeometry(4.2, 0.85, 7, 22, Math.PI), 0, 1.5, 0, 0, 0, 0, 1, 1.35, 1); for (const s of [-1, 1]){ K.box('ice', 1.6, 1.6, 1.5, s * 4.2, 0.75, 0); K.geo('ice', new THREE.OctahedronGeometry(1, 0), s * 4.9, 1.5, 0, 0, 0, s * 0.2, 0.9, 3.0, 0.9); }
  for (let i = 0; i < 7; i++){ const a = i / 6 * Math.PI; K.geo('ice', cone(0.35, rr(1.2, 2.2), 5), Math.cos(a) * 5.2, Math.sin(a) * 5.6 + 1.9, 0, 0, 0, a - Math.PI / 2); }
  K.pop();
  const pm = part(portalGeo(6.5, 5.9, 4.4), portalMat(0x8adfff, 0x3a6aff), bx, y + 0.8, bz); pm.rotation.y = face; pm.renderOrder = 2;
  const ps = X.glowSprite(0x9fdcff, 10, 0.5); ps.position.set(bx, y + 4, bz); CUR.near.add(ps); glowAbs(cx + bx, y + 4, cz + bz, 0x9fdcff, 8, 0.7);
  anim((dt, t) => { rg.rotation.y += dt * 0.12; ps.material.opacity = 0.38 + Math.sin(t * 1.7) * 0.14; });
  F.raidPortalPos.cryos = [cx + Math.sin(face) * 1.5, cz + Math.cos(face) * 1.5];
  K.push(bx, 0, bz, face); for (const s of [-1, 1]) cb(s * 4.4, 0, 1.0, 1.0); cb(0, -1.2, 4.6, 0.6); K.pop();
  // 언 용 해골 (뒤에 반쯤 묻힘) · 날개뼈
  const sx = -Math.sin(face) * 17, sz = -Math.cos(face) * 17, sy = gy(sx, sz); K.push(sx, sy + 1, sz, face, -0.35);
  K.geo('bone', sph(4.2, 14, 10), 0, 2, 0, 0, 0, 0, 1, 0.8, 1.5); K.box('bone', 4.6, 1.6, 6, 0, 0.2, 5.4); K.box('boneD', 4.2, 1.0, 5.6, 0, -1.2, 5.0, 0.2);
  for (const s of [-1, 1]){ K.geo('dark', sph(1.0, 8, 6), s * 1.9, 2.6, 3.6, 0, 0, 0, 1, 1, 0.5); K.geo('ice', tubeG([[s * 2.6, 4.2, -1], [s * 4.6, 7.5, -4], [s * 4.4, 10.5, -8]], 0.9, 0.12, 7, 5)); for (let k = 0; k < 5; k++) K.geo('fabricW', cone(0.2, 0.9, 4), s * (0.4 + k * 0.4), -0.5, 8.2 - k * 0.3, Math.PI, 0, 0); }
  K.pop(); cc(sx, sz, 5);
  for (const s of [-1, 1]){ const wx = sx + Math.cos(face) * s * 6, wz = sz - Math.sin(face) * s * 6, wy = gy(wx, wz); K.geo('bone', tubeG([[wx, wy - 1, wz], [wx + Math.cos(face) * s * 4, wy + 14, wz - Math.sin(face) * s * 4], [lerp(wx, 0, 0.55), wy + 18, lerp(wz, 0, 0.55)], [lerp(wx, 0, 0.75), wy + 13, lerp(wz, 0, 0.75)]], 0.9, 0.25, 7, 6)); cc(wx, wz, 1.0); }
  for (let i = 0; i < 16; i++){ const a = R() * TAU, d = rr(14, 26), x = Math.cos(a) * d, z = Math.sin(a) * d; K.geo('ice', new THREE.OctahedronGeometry(rr(0.5, 1.4), 0), x, gy(x, z) + 0.4, z, R(), R(), R(), 1, rr(1.5, 3), 1); }
  motesFx(CUR.near, [0, y, 0], 16, LOW ? 30 : 60, '0.75, 0.92, 1.0', 8, 0.14);
  return finish();
}
// 하늘 끝 봉우리: 돌무더기 · 룬 오벨리스크 · 하늘로 솟는 빛기둥 (대륙 어디서나 보여요)
function bSummit(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 300 });
  const [lo, hi] = footC(cx, cz, 3), y = lo - 0.4;
  K.push(0, y, 0); K.box('stone', 3.2, 1.0, 3.2, 0, 0.5, 0); K.geo('basalt', cyl(0.55, 0.9, 9, 4), 0, 5.5, 0, 0, Math.PI / 4, 0); K.geo('gold', cone(0.65, 1.4, 4), 0, 10.7, 0, 0, Math.PI / 4, 0);
  for (const s of [-1, 1]) K.box('glowC', 0.1, 6, 0.3, s * 0.62, 5.2, 0, 0, 0, s * -0.03); K.pop(); cc(0, 0, 1.8);
  const cr = part(new THREE.OctahedronGeometry(0.8, 0).scale(0.8, 1.5, 0.8), MAT.crystal, 0, y + 13, 0); const cs = X.glowSprite(0x7ff3ff, 8, 0.6); cs.position.set(0, y + 13, 0); CUR.near.add(cs);
  P.cairn(5, 3, 3.4, 'stone'); P.cairn(-4, 4, 2.2, 'stone'); K.geo('woodD', cyl(0.08, 0.1, 5, 6), -5, gy(-5, -3) + 2.5, -3); flag(-5, gy(-5, -3) + 4.8, -3, 0.3, 2.4, 1.3, 'fabricB');
  P.bench(3, -5, Math.PI); { const x = 0, z = 4.5, yy = gy(x, z); K.box('stone', 1.6, 0.9, 0.4, x, yy + 0.45, z, -0.3); K.box('bronze', 1.3, 0.7, 0.05, x, yy + 0.6, z + 0.23, -0.3); }
  // 빛기둥 (멀리서도 보여요)
  const bm = new THREE.MeshBasicMaterial({ color: 0x8af4ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, fog: false });
  const fb = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 160, 12, 1, true).translate(0, 80 + y + 12, 0), bm); fb.position.set(cx, 0, cz); fb.renderOrder = 4; FW.add(fb);
  anim((dt, t) => { cr.rotation.y += dt * 0.7; cr.position.y = y + 13 + Math.sin(t) * 0.3; cs.material.opacity = 0.45 + 0.15 * Math.sin(t * 2); });
  glowAbs(cx, y + 13, cz, 0x7ff3ff, 10, 0.8);
  BEAMS.push({ m: bm, x: cx, z: cz });
  return finish();
}
const BEAMS = [];
// 용의 등뼈 능선: 능선 마루를 따라 솟은 거대한 뼈 가시들 · 전망 돌무더기
function bSpine(l){
  const [cx, cz] = l.c; begin(l.id, cx, cz, { lm: l, nearR: 280, fm: 2 });
  const rg = (W.ridges || [])[0], pts = rg ? rg.pts : [[cx - 130, cz - 30], [cx + 140, cz - 18]];
  const along = []; for (let i = 0; i < pts.length - 1; i++){ const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 4); for (let k = 0; k < n; k++) along.push([lerp(ax, bx, k / n), lerp(az, bz, k / n)]); }
  const near = along.filter(([x]) => x > cx - 120 && x < cx + 130);
  for (let i = 0; i < near.length; i += Math.max(1, Math.floor(near.length / 11))){ let [x, z] = near[i], best = -1e9, bz = z; for (let d = -24; d <= 24; d += 3){ const h = H(x, z + d); if (h > best){ best = h; bz = z + d; } } z = bz;
    const lx = x - cx, lz = z - cz, y = H(x, z) - 2, h = rr(14, 24), back = rr(3, 7);
    K.geo(i % 3 ? 'bone' : 'boneD', tubeG([[lx, y, lz], [lx + back * 0.3, y + h * 0.5, lz - back * 0.2], [lx + back, y + h, lz - back * 0.6]], rr(2.4, 3.4), 0.15, 7, 5)); cc(lx, lz, 2.6); }
  P.cairn(0, 0, 3.0, 'stone'); K.geo('woodD', cyl(0.08, 0.1, 5, 6), 2, gy(2, 1) + 2.5, 1); flag(2, gy(2, 1) + 4.8, 1, 0.2, 2.2, 1.2, 'fabricR'); P.lamp(-3, 2, 'snow');
  return finish();
}

// ───────────────────────── 조립 ─────────────────────────
const BUILD = {
  village: bVillage, runegate: bRunegate, windmill_hill: bWindmill, giant_tree: bOak, farm: bFarm, ponds: bPonds, apiary: bApiary, overlook: bOverlook,
  lighthouse: bLighthouse, island_ruin: bPavilion, bridge: bBridge, giant_stump: bStump, fairy_ring: bFairy, camp: bCamp, spring: bSpring, root_arch: bRootArch,
  sunken_temple: bSunken, witch_hut: bWitch, boardwalk: bBoardwalk, waterfall: bFalls, seep_cliff: bWeep, spire_nest: bEagle, mine: bMine, skeleton: bSkeleton,
  mesa_mark: bMesa, stairs: bStairs, citadel_ruin: bCitadel, colossus: bColossus, tower: bTower, thorn_gate: bThornGate, thorn_heart: bThornHeart,
  pass_shrine: bPass, frozen_altar: bAltar, summit: bSummit, ridge_mark: bSpine,
};
const FAILED = [], TIMES = [];
for (const l of W.landmarks){
  const fn = BUILD[l.type]; if (!fn){ FAILED.push(l.id + ':no-builder'); continue; }
  const t0 = performance.now();
  try { fn(l); } catch (e){ console.error('[landmarks] 빌드 실패', l.id, e); FAILED.push(l.id); CUR = null; B = K = null; }
  TIMES.push([l.id, Math.round(performance.now() - t0)]);
}
const T1 = performance.now();
// ───────────────────────── 길가 소품 칸 (160m 격자 · 정점색 병합) ─────────────────────────
const CELLS = [], CMAP = new Map(), CS = 200;
function cellOf(x, z){ const cx = Math.floor(x / CS), cz = Math.floor(z / CS), key = cx * 1000 + cz; let c = CMAP.get(key); if (!c){ c = { x: (cx + 0.5) * CS, z: (cz + 0.5) * CS, B: new LB(1e9), g: new THREE.Group() }; c.K = new G.Kit(c.B); CMAP.set(key, c); CELLS.push(c); } return c; }
// fn() 안에서 K 는 그 칸의 Kit (절대 좌표)
function inCell(x, z, fn){ const c = cellOf(x, z), pk = K, pb = B, ox = OX, oz = OZ; K = c.K; B = c.B; OX = 0; OZ = 0; try { fn(); STATS.props++; } catch (e){ console.warn('[landmarks] 소품 실패', x, z, e); } finally { K = pk; B = pb; OX = ox; OZ = oz; } }
const TEXKEYS = new Set(['signA', 'campA', 'water', 'jelly', 'jellyG']);
function buildCells(){
  for (const c of CELLS){
    const vc = [], keep = {}; for (const key in c.B.g){ if (TEXKEYS.has(key)) keep[key] = c.B.g[key]; else for (const g of c.B.g[key]) vc.push([key, g]); }
    if (vc.length) c.g.add(meshOf(mergeVC(vc), PROPMAT, true));
    for (const key in keep) c.g.add(meshOf(G.mergeGeos(keep[key]), MAT[key], false));
    c.g.visible = false; FW.add(c.g); c.B = c.K = null;
  }
}
// 가장 가까운 길 위의 점
function roadNear(x, z){ let best = 1e9, bp = null; for (const s of SEGS){ const t = clamp(((x - s.ax) * s.ex + (z - s.az) * s.ez) / s.l2, 0, 1), px = s.ax + s.ex * t, pz = s.az + s.ez * t, d = Math.hypot(x - px, z - pz); if (d < best){ best = d; bp = [px, pz, d]; } } return bp; }

// ── 이정표 (갈림길) ──
function signpost(sp){
  const [x, z] = sp.c;
  inCell(x, z, () => {
    const y = gyk(x, z) - 0.2;
    K.box('stone', 0.8, 0.4, 0.8, x, y + 0.2, z); K.geo('woodD', cylM(0.12, 0.15, 4.0, 8), x, y + 2.2, z); K.geo('woodD', cone(0.17, 0.35, 8), x, y + 4.37, z);
    sp.to.forEach(([name, dir], i) => {
      const [dx, dz] = DIRS[dir] || [0, -1], ry = Math.atan2(-dz, dx), by = y + 3.65 - i * 0.55, uvF = signCell(name, dir), uvB = signCell(name, dir, null, true);
      K.push(x, by, z, ry); K.box('wood', 2.05, 0.44, 0.08, 1.15, 0, (i % 2 ? 1 : -1) * 0.02); K.box('wood', 0.31, 0.31, 0.08, 2.17, 0, (i % 2 ? 1 : -1) * 0.02, 0, 0, Math.PI / 4);
      K.geo('signA', quadUV(1.96, 0.4, uvF), 1.15, 0, 0.045 + (i % 2 ? 1 : -1) * 0.02); K.geo('signA', quadUV(1.96, 0.4, uvB), 1.15, 0, -0.045 + (i % 2 ? 1 : -1) * 0.02, 0, Math.PI, 0); K.pop();
    });
    K.geo('lamp', sph(0.12, 6, 4), x + 0.25, y + 2.6, z); glow(x + 0.25, y + 2.6, z, 0xffb860, 1.6, 0.25); cc(x, z, 0.35);
  });
}
// ── 사냥터 표지판 (가장자리 · 길 쪽) ──
function campSign(c){
  let best = null, bs = 1e9;
  for (let i = 0; i < 36; i++){ const a = i / 36 * TAU, r = c.r + 2.5, x = c.c[0] + Math.cos(a) * r, z = c.c[1] + Math.sin(a) * r, rd = roadD(x, z);
    if (rd < 2.2 || wet(x, z) || slope(x, z) > 0.7 || kept(x, z, 1.5)) continue; const sc = rd + (nearLm(x, z, -6) ? 30 : 0); if (sc < bs){ bs = sc; best = [x, z]; } }
  if (!best) best = [c.c[0] + c.r, c.c[1]];
  const [x, z] = best, rn = roadNear(x, z), ry = rn && rn[2] < 45 ? Math.atan2(rn[0] - x, rn[1] - z) : Math.atan2(x - c.c[0], z - c.c[1]), uv = campCell(c), [col] = BAND(c.lv[1]);
  inCell(x, z, () => {
    const y = gyk(x, z) - 0.15; K.push(x, y, z, ry);
    for (const s of [-1, 1]){ K.geo('woodD', cyl(0.1, 0.12, 2.9, 6), s * 1.35, 1.45, 0); K.geo('woodD', cone(0.13, 0.25, 6), s * 1.35, 3.0, 0); }
    K.box('wood', 2.8, 1.6, 0.1, 0, 1.95, -0.02); K.geo('campA', quadUV(2.66, 1.5, uv), 0, 1.95, 0.04); K.box('beam', 3.0, 0.12, 0.16, 0, 2.8, 0); K.box('beam', 3.0, 0.12, 0.16, 0, 1.1, 0);
    if (c.lv[0] >= 16) P.skull(0, 2.86, 0, 0.7);
    K.pop(); glow(x, y + 3.1, z, new THREE.Color(col).getHex(), 1.3, 0.5); K.push(x, 0, z, ry); cb(0, 0, 1.5, 0.2); K.pop();
  });
}
for (const sp of W.signposts){ try { signpost(sp); } catch (e){ console.warn('[landmarks] 이정표', e); } }
for (const c of W.camps){ try { campSign(c); } catch (e){ console.warn('[landmarks] 사냥터 표지판', c.id, e); } }
// ───────────────────────── 길가 생활 (데이터로 흩뿌려요) ─────────────────────────
const VILLAGE = byId('regions', 'village');
const inVillage = (x, z) => VILLAGE && Math.hypot(x - VILLAGE.c[0], z - VILLAGE.c[1]) < VILLAGE.r + 9;
const BIOME_LAMP = { meadow: 'wood', forest: 'stone', lake: 'wood', swamp: 'swamp', canyon: 'iron', plateau: 'iron', blight: 'crystal', snow: 'snow' };
const biomeAt = (x, z) => (F.regionAt(x, z) || {}).biome || 'meadow';
const okSpot = (x, z, pad = 1) => Math.abs(x) < W.half - 110 && Math.abs(z) < W.half - 110 && !wet(x, z) && slope(x, z) < 0.55 && !kept(x, z, pad) && !inVillage(x, z) && !nearLm(x, z, pad - 4);
// 등불: 모든 길을 따라 일정 간격, 양쪽 번갈아 (길 쪽으로 팔을 뻗어요)
srand(hashS('roadlamps'));
for (const rd of W.roads){
  const step = rd.w >= 6 ? 30 : 38; let C = 0;
  for (let i = 0; i < rd.pts.length - 1; i++){
    const [ax, az] = rd.pts[i], [bx, bz] = rd.pts[i + 1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
    for (let n = Math.max(0, Math.ceil(C / step - 0.4)); (n + 0.4) * step < C + L; n++){
      const d = (n + 0.4) * step - C, side = n % 2 ? 1 : -1, off = rd.w / 2 + 1.7, x = ax + ux * d - uz * off * side, z = az + uz * d + ux * off * side;
      if (!okSpot(x, z, 1.5) || roadD(x, z) < 0.9) continue;
      const st = BIOME_LAMP[biomeAt(x, z)] || 'wood'; inCell(x, z, () => P.lamp(x, z, st, Math.atan2(ux * side, uz * side)));
    }
    C += L;
  }
}
// 울타리: 초원 · 호숫가 길 옆 듬성듬성
srand(hashS('roadfence'));
for (const rd of W.roads){ if (rd.w < 5) continue; let C = 0;
  for (let i = 0; i < rd.pts.length - 1; i++){ const [ax, az] = rd.pts[i], [bx, bz] = rd.pts[i + 1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
    for (let d = 20 + ((C * 7) % 40); d < L - 16; d += rr(60, 110)){ const side = R() < 0.5 ? 1 : -1, off = rd.w / 2 + 3.6, len = rr(10, 18), x0 = ax + ux * d - uz * off * side, z0 = az + uz * d + ux * off * side, x1 = x0 + ux * len, z1 = z0 + uz * len, bm = biomeAt(x0, z0);
      if ((bm !== 'meadow' && bm !== 'lake' && bm !== 'plateau') || !okSpot(x0, z0, 2) || !okSpot(x1, z1, 2) || roadD((x0 + x1) / 2, (z0 + z1) / 2) < 2) continue;
      inCell(x0, z0, () => { P.fence(x0, z0, x1, z1, { gap: 2.4, key: bm === 'plateau' ? 'ruin' : 'wood', h: bm === 'plateau' ? 0.8 : 1.0, rails: bm === 'plateau' ? [0.6] : [0.4, 0.8] }); if (R() < 0.35) P.hay(x1 + ux * 2 - uz * side * 2, z1 + uz * 2 + ux * side * 2, R() * 3); }); }
    C += L; } }
// 쉼터: 큰길을 따라 ~140m 마다 (벤치 · 짐 · 지역 소품)
function restStop(x, z, ry, bm){
  P.bench(x, z, ry);
  const ox = x + Math.cos(ry) * 1.9, oz = z - Math.sin(ry) * 1.9, bx = x - Math.cos(ry) * 1.9, bz = z + Math.sin(ry) * 1.9;
  if (bm === 'meadow' || bm === 'lake'){ P.barrel(ox, gyk(ox, oz), oz); const fy = gyk(bx, bz); K.box('wood', 1.0, 0.5, 0.6, bx, fy + 0.25, bz, 0, ry, 0); for (let i = 0; i < 7; i++) K.geo(pick(['flower', 'flowerY', 'rose', 'flowerW']), ico(0.11, 0), bx + rr(-0.4, 0.4), fy + 0.6, bz + rr(-0.2, 0.2)); cc(bx, bz, 0.5); }
  else if (bm === 'forest'){ P.stump(ox, oz, 0.42); P.mushrooms(bx, bz, 4, 'glowM'); }
  else if (bm === 'swamp'){ const y = gyk(ox, oz); K.geo('woodD', cyl(0.05, 0.07, 2.0, 5), ox, y + 1.0, oz); P.skull(ox, y + 1.95, oz, 0.8, ry); cc(ox, oz, 0.15); P.lamp(bx, bz, 'swamp', ry); }
  else if (bm === 'canyon'){ P.barrel(ox, gyk(ox, oz), oz); P.crate(bx, gyk(bx, bz), bz, 0.7, ry); P.skull(bx + 1, gyk(bx + 1, bz), bz + 0.6, 1.4, ry); cc(bx, bz, 0.6); }
  else if (bm === 'plateau'){ P.fallen(bx, bz, ry + 0.3); P.lamp(ox, oz, 'iron', ry); }
  else if (bm === 'blight'){ VIG.crystals(bx - Math.sin(ry) * 1.5, bz - Math.cos(ry) * 1.5); }
  else if (bm === 'snow'){ P.cairn(ox, oz, 1.6, 'stone'); K.geo('snow', sph(0.9, 8, 5), bx, gyk(bx, bz) - 0.2, bz, 0, 0, 0, 1.4, 0.4, 1); }
}
// 작은 이야기 장면 (지역마다 결이 달라요) — 절대 좌표, 현재 K = 칸의 Kit
const VIG = {
  picnic(x, z, ry){ const y = gyk(x, z); K.push(x, y, z, ry); K.box('fabricR', 2.4, 0.04, 1.8, 0, 0.03, 0); for (let i = 0; i < 4; i++) K.box('fabricW', 0.14, 0.045, 1.8, -0.9 + i * 0.6, 0.035, 0); K.geo('wicker', lathe([[0, 0], [0.32, 0.02], [0.36, 0.3], [0, 0.3]], 10, 0.4), 0.6, 0.05, 0.3); K.geo('wicker', tor(0.25, 0.03, 4, 10, Math.PI), 0.6, 0.35, 0.3);
    K.geo('bread', sph(0.14, 8, 5), -0.4, 0.12, -0.2, 0, 0.4, 0, 1.6, 0.7, 0.9); for (let i = 0; i < 4; i++) K.geo(pick(['fruitR', 'fruitG', 'fruitO']), sph(0.08, 6, 4), -0.1 + i * 0.12, 0.1, 0.35); K.geo('fabricB', sph(0.35, 8, 5), -1.4, 0.15, 0.6, 0, 0, 0, 1, 0.4, 1); K.pop(); },
  cart(x, z, ry){ P.cart(x, z, ry, pick(['hay', 'apples', 'barrel'])); P.clutter(x + Math.cos(ry) * 2.4, z - Math.sin(ry) * 2.4, 2, 0.7); },
  wreck(x, z, ry){ const y = gyk(x, z); K.push(x, y, z, ry, 0.12, 0.35); K.box('wood', 1.6, 0.12, 2.6, 0, 0.55, 0); K.box('wood', 0.08, 0.45, 2.6, 0.8, 0.8, 0); K.pop(); K.geo('woodD', cyl(0.5, 0.5, 0.1, 12), x + 1.6, y + 0.1, z + 0.4, Math.PI / 2 + 0.1, 0, 0); K.geo('woodD', cyl(0.5, 0.5, 0.1, 12), x - 0.9, y + 0.5, z - 0.6, 0, 0, Math.PI / 2 + 0.4);
    for (let i = 0; i < 4; i++) P.crate(x + rr(-2, 2), gyk(x, z), z + rr(-2, 2), rr(0.5, 0.7), R()); for (let i = 0; i < 6; i++) K.geo('fruitR', sph(0.1, 6, 4), x + rr(-2, 2), y + 0.1, z + rr(-2, 2)); cc(x, z, 1.6); },
  shrine(x, z, ry){ P.shrine(x, z, ry); P.lamp(x + Math.cos(ry) * 1.6, z - Math.sin(ry) * 1.6, 'stone', ry); for (let i = 0; i < 6; i++) K.geo(pick(['flower', 'flowerY', 'flowerW']), ico(0.12, 0), x + rr(-1.4, 1.4), gyk(x, z) + 0.15, z + rr(-1.4, 1.4)); },
  statue(x, z, ry){ P.statue(x, z, ry, pick(['marble', 'ruin', 'mossy']), rr(2.2, 3.2)); for (let i = 0; i < 8; i++){ const a = i / 8 * TAU; K.geo(pick(['flower', 'flowerY', 'rose']), ico(0.13, 0), x + Math.cos(a) * 1.3, gyk(x, z) + 0.2, z + Math.sin(a) * 1.3); } },
  hay(x, z, ry){ for (let i = 0; i < 4; i++) P.hay(x + rr(-4, 4), z + rr(-4, 4), R() * 3); P.hayStack(x + rr(-2, 2), z + rr(-2, 2)); },
  well(x, z){ P.well(x, z); P.barrel(x + 1.6, gyk(x + 1.6, z), z); },
  scarecrow(x, z, ry){ const y = gyk(x, z); K.push(x, y, z, ry); K.geo('woodD', cyl(0.05, 0.06, 2.2, 5), 0, 1.1, 0); K.box('woodD', 1.6, 0.08, 0.08, 0, 1.55, 0); K.geo('hay', sph(0.25, 8, 6), 0, 2.2, 0); K.geo('hay', cone(0.4, 0.42, 8), 0, 2.45, 0); K.geo(pick(['fabricR', 'fabricB']), cylM(0.3, 0.4, 0.8, 8), 0, 1.45, 0); K.pop(); cc(x, z, 0.3);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++){ const px = x - 3 + c * 1.2, pz = z + 2 + r * 1.1; K.geo('cabbage', ico(0.22, 1), px, gyk(px, pz) + 0.18, pz); } },
  hives(x, z, ry){ for (let i = 0; i < 3; i++){ const px = x + Math.cos(ry) * (i - 1) * 1.6, pz = z - Math.sin(ry) * (i - 1) * 1.6, y = gyk(px, pz); K.push(px, y, pz, ry); for (let k = 0; k < 3; k++) K.box(k % 2 ? 'plaster2' : 'plaster', 0.9, 0.32, 0.7, 0, 0.2 + k * 0.33, 0); K.box('roof2', 1.05, 0.08, 0.85, 0, 1.2, 0); K.pop(); cc(px, pz, 0.6); } },
  circle(x, z){ P.stoneCircle(x, z, rr(3.5, 5), pick([6, 7, 8]), biomeAt(x, z) === 'plateau' ? 'ruin' : 'mossy', biomeAt(x, z) === 'forest' ? 'glowC' : null); K.geo('mossy', rockG(0.8, 0.5, 0), x, gyk(x, z) + 0.2, z); },
  flowers(x, z){ for (let i = 0; i < 70; i++){ const a = R() * TAU, d = Math.sqrt(R()) * 6, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; K.geo(pick(['flower', 'flowerY', 'flowerW', 'rose', 'pink']), ico(rr(0.1, 0.18), 0), px, gyk(px, pz) + rr(0.12, 0.3), pz); } P.bench(x + 6.5, z, R() * 6); },
  rest(x, z, ry){ P.campfire(x, z); P.log(x + Math.cos(ry) * 1.8, z - Math.sin(ry) * 1.8, ry + Math.PI / 2, 1.8, 0.24); const bx = x - Math.sin(ry) * 1.8, bz = z - Math.cos(ry) * 1.8, by = gyk(bx, bz); K.geo(pick(['fabricB', 'fabricG', 'fabricR']), cylM(0.25, 0.25, 1.8, 8), bx, by + 0.22, bz, 0, ry, Math.PI / 2); K.geo('sack', sph(0.35, 8, 6), x + 1.6, by + 0.35, z + 1.0, 0, 0, 0, 1, 1.3, 0.8); },
  grave(x, z, ry){ const y = gyk(x, z); K.geo('soil', sph(1.0, 10, 6, 0, TAU, 0, Math.PI / 2), x, y - 0.1, z, 0, ry, 0, 1, 0.35, 1.7); K.push(x, y, z, ry); K.box('steel', 0.12, 1.5, 0.35, 0, 1.0, -1.2, 0.1); K.box('bronze', 0.8, 0.12, 0.15, 0, 1.6, -1.2, 0.1); K.geo('iron', sph(0.3, 8, 6, 0, TAU, 0, Math.PI / 2), 0.5, 0.05, 1.1); K.pop(); for (let i = 0; i < 5; i++) K.geo(pick(['flower', 'flowerW']), ico(0.1, 0), x + rr(-0.6, 0.6), y + 0.3, z + rr(-0.8, 0.8)); cc(x, z, 0.9); },
  logs(x, z, ry){ const y = gyk(x, z); K.push(x, y, z, ry); for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) K.geo('bark2', cylM(0.24, 0.24, 2.6, 8), (i - (3 - r) / 2) * 0.5, 0.24 + r * 0.42, 0, 0, 0, Math.PI / 2); K.pop(); P.stump(x + Math.cos(ry) * 2.6, z - Math.sin(ry) * 2.6, 0.5); K.geo('iron', new THREE.BoxGeometry(0.06, 0.3, 0.4), x + Math.cos(ry) * 2.6, y + 0.75, z - Math.sin(ry) * 2.6); K.geo('woodD', cyl(0.03, 0.03, 0.8, 4), x + Math.cos(ry) * 2.6, y + 1.05, z - Math.sin(ry) * 2.6 + 0.2, 0.5, 0, 0); K.push(x, 0, z, ry); cb(0, 0, 1.3, 0.8); K.pop(); },
  totem(x, z, ry){ const y = gyk(x, z) - 0.2; K.push(x, y, z, ry); for (let i = 0; i < 3; i++){ K.geo(['pRed', 'wood', 'pTeal'][i], cylM(0.45, 0.5, 1.4, 8), 0, 0.7 + i * 1.4, 0); K.geo('dark', sph(0.1, 5, 4), 0.18, 0.95 + i * 1.4, 0.4); K.geo('dark', sph(0.1, 5, 4), -0.18, 0.95 + i * 1.4, 0.4); } for (const s of [-1, 1]) K.box('wood', 1.8, 0.15, 0.5, s * 1.0, 4.0, 0, 0, 0, s * 0.3); K.geo('fabricW', cone(0.3, 0.6, 6), 0, 4.6, 0); K.pop(); cc(x, z, 0.6); },
  mush(x, z){ P.mushrooms(x, z, 7, pick(['glowM', 'glowG'])); P.mushrooms(x + 2, z - 1.5, 5, 'glowM'); P.log(x - 1.5, z + 1.5, R() * 3, 2.6, 0.3); },
  hunter(x, z, ry){ P.tent(x, z, ry, 'tentA', 2.0); P.campfire(x + Math.sin(ry) * 3, z + Math.cos(ry) * 3); P.clutter(x - 2.5, z + 1, 2, 0.6); },
  boat(x, z, ry){ const y = gyk(x, z); K.push(x, y + 0.45, z, ry); K.geo('wood', sph(1, 10, 6, 0, TAU, 0, Math.PI / 2), 0, 0, 0, Math.PI, 0, 0, 0.8, 0.45, 2.0); K.box('woodD', 1.5, 0.08, 0.2, 0, -0.06, 0.6); K.pop(); for (const s of [-1, 1]) K.geo('woodD', cyl(0.03, 0.03, 2.2, 4), x + s * 1.1, y + 0.08, z + 0.5, Math.PI / 2, ry, 0); cc(x, z, 1.3); },
  nets(x, z, ry){ const y = gyk(x, z); K.push(x, y, z, ry); for (const s of [-1, 1]) K.geo('woodD', cyl(0.06, 0.07, 2.2, 5), s * 1.6, 1.1, 0); K.box('rope', 3.4, 0.03, 0.03, 0, 2.0, 0); K.geo('rope', plane(3.0, 1.4), 0, 1.3, 0.02); P.barrel(0.8, 0, 0.9); K.pop(); K.push(x, 0, z, ry); cb(0, 0, 1.7, 0.2); K.pop(); VIG.boat(x + Math.sin(ry) * 3.5, z + Math.cos(ry) * 3.5, ry + 1.2); },
  ruin(x, z, ry){ const key = biomeAt(x, z) === 'blight' ? 'darkst' : 'ruin'; for (let i = 0; i < 4; i++){ const a = ry + i * Math.PI / 2, px = x + Math.cos(a) * 3.2, pz = z + Math.sin(a) * 3.2; P.pillar(px, pz, rr(1.5, 4.2), R() < 0.7, key); } P.fallen(x + rr(-1, 1), z + rr(-1, 1), R() * 3, key); for (let i = 0; i < 5; i++) K.geo(key, rockG(rr(0.3, 0.6), 0.6, 0), x + rr(-4, 4), gyk(x, z) + 0.1, z + rr(-4, 4)); },
  minecart(x, z, ry){ const y = gyk(x, z); K.push(x, y, z, ry); for (let i = 0; i < 8; i++){ K.box('woodD', 1.8, 0.1, 0.26, 0, 0.05, -3 + i * 0.8); } for (const s of [-1, 1]) K.box('iron', 0.08, 0.1, 6.4, s * 0.56, 0.15, 0); K.geo('rust', lathe([[0, 0], [0.8, 0], [1.0, 0.9], [0, 0.9]], 4, 0.5), 0, 0.45, 0.5, 0, Math.PI / 4, 0, 1, 1, 1.3); for (let i = 0; i < 5; i++) K.geo(i < 1 ? 'ore' : 'redrock', ico(0.25, 0), rr(-0.3, 0.3), 1.45, 0.5 + rr(-0.5, 0.5)); K.pop(); cc(x, z, 1.1); P.lamp(x + Math.cos(ry) * 1.8, z - Math.sin(ry) * 1.8, 'iron'); },
  skulls(x, z){ for (let i = 0; i < 4; i++){ const a = i / 4 * TAU + R(), px = x + Math.cos(a) * 2, pz = z + Math.sin(a) * 2, y = gyk(px, pz); K.geo('woodD', cyl(0.05, 0.07, 2.0, 5), px, y + 1.0, pz, rr(-0.15, 0.15), 0, rr(-0.15, 0.15)); P.skull(px, y + 1.95, pz, rr(0.7, 1.1), R() * 6); cc(px, pz, 0.15); } P.skull(x, gyk(x, z), z, 2.2, R() * 6); },
  cauldron(x, z){ const y = gyk(x, z); P.campfire(x, z, false); K.geo('iron', lathe([[0, 0.2], [0.55, 0.25], [0.7, 0.6], [0.6, 0.95], [0, 0.95]], 12, 0.4), x, y + 0.2, z); K.geo('glowG', new THREE.CircleGeometry(0.55, 12).rotateX(-Math.PI / 2), x, y + 1.1, z); glow(x, y + 1.3, z, 0x9aff70, 2.4, 0.6); P.lamp(x + 2.2, z + 1, 'swamp'); },
  tent(x, z, ry){ P.tent(x, z, ry, pick(['tentA', 'tentB', 'fabricR']), rr(2, 2.6)); P.clutter(x + Math.cos(ry) * 3, z - Math.sin(ry) * 3, 3, 0.8); P.banner(x - Math.cos(ry) * 3, z + Math.sin(ry) * 3, pick(['fabricR', 'fabricY']), 4.2, ry); },
  cairn(x, z){ P.cairn(x, z, rr(1.6, 2.6), biomeAt(x, z) === 'canyon' ? 'redrock' : 'stone'); P.cairn(x + rr(1.5, 3), z + rr(-2, 2), rr(0.8, 1.4), biomeAt(x, z) === 'canyon' ? 'redrock' : 'stone'); },
  brazier(x, z){ for (const s of [-1, 1]) P.lamp(x + s * 2.5, z, 'iron'); P.statue(x, z - 1, 0, 'ruin', 2.8); },
  thorns(x, z){ for (let i = 0; i < 5; i++){ const px = x + rr(-3, 3), pz = z + rr(-3, 3), y = gyk(px, pz); thornVine([[px, y - 0.3, pz], [px + rr(-1.5, 1.5), y + rr(1.5, 3), pz + rr(-1.5, 1.5)], [px + rr(-2.5, 2.5), y + rr(3, 5.5), pz + rr(-2.5, 2.5)]], rr(0.3, 0.5), 0.08, 6); cc(px, pz, 0.5); } for (let i = 0; i < 4; i++) K.geo('crystalP', new THREE.OctahedronGeometry(rr(0.3, 0.6), 0), x + rr(-3, 3), gyk(x, z) + 0.4, z + rr(-3, 3), R(), R(), R(), 0.7, 1.8, 0.7); glow(x, gyk(x, z) + 1, z, 0xc070ff, 2.5, 0.6); },
  corrupt(x, z, ry){ P.shrine(x, z, ry, 0xc070ff); K.geo('crystalP', new THREE.OctahedronGeometry(0.6, 0), x, gyk(x, z) + 2.0, z, 0, R(), 0, 0.7, 1.6, 0.7); VIG.thorns(x + 3, z + 2); },
  crystals(x, z){ for (let i = 0; i < 7; i++){ const px = x + rr(-2.5, 2.5), pz = z + rr(-2.5, 2.5); K.geo(R() < 0.6 ? 'crystalP' : 'darkst', new THREE.OctahedronGeometry(rr(0.4, 1.0), 0), px, gyk(px, pz) + 0.6, pz, rr(-0.3, 0.3), R(), rr(-0.3, 0.3), 0.7, rr(1.6, 3), 0.7); } cc(x, z, 2.2); glow(x, gyk(x, z) + 1.5, z, 0xc070ff, 3, 0.6); },
  snowman(x, z, ry){ const y = gyk(x, z); K.push(x, y, z, ry); K.geo('snow', sph(0.75, 12, 8), 0, 0.6, 0); K.geo('snow', sph(0.55, 12, 8), 0, 1.55, 0); K.geo('snow', sph(0.4, 10, 8), 0, 2.3, 0); K.geo('carrot', cone(0.08, 0.45, 6), 0, 2.32, 0.55, Math.PI / 2, 0, 0); for (const s of [-1, 1]){ K.geo('dark', sph(0.06, 5, 4), s * 0.14, 2.42, 0.34); K.geo('woodD', cyl(0.025, 0.03, 1.0, 4), s * 0.75, 1.75, 0, 0, 0, s * 1.1); }
    K.geo('fabricR', tor(0.4, 0.1, 6, 12), 0, 1.98, 0, Math.PI / 2); K.box('fabricR', 0.18, 0.6, 0.05, 0.2, 1.7, 0.38, 0.1); K.geo('dark', cylM(0.32, 0.32, 0.45, 10), 0, 2.78, 0); K.geo('dark', cylM(0.45, 0.45, 0.05, 10), 0, 2.56, 0); K.pop(); cc(x, z, 0.7); },
  ice(x, z){ for (let i = 0; i < 6; i++){ const px = x + rr(-3, 3), pz = z + rr(-3, 3); K.geo('ice', new THREE.OctahedronGeometry(rr(0.5, 1.2), 0), px, gyk(px, pz) + 0.5, pz, rr(-0.3, 0.3), R(), rr(-0.3, 0.3), 0.8, rr(1.8, 3.2), 0.8); } cc(x, z, 2.2); glow(x, gyk(x, z) + 1.2, z, 0x9fdcff, 2.4, 0.4); },
  flags(x, z, ry){ const a = [x - Math.cos(ry) * 5, z + Math.sin(ry) * 5], b = [x + Math.cos(ry) * 5, z - Math.sin(ry) * 5], ya = gyk(a[0], a[1]), yb = gyk(b[0], b[1]); K.geo('woodD', cyl(0.07, 0.09, 4.4, 5), a[0], ya + 2.2, a[1]); K.geo('woodD', cyl(0.07, 0.09, 4.4, 5), b[0], yb + 2.2, b[1]); cc(a[0], a[1], 0.15); cc(b[0], b[1], 0.15); P.pennants([[a[0], ya + 4.2, a[1]], [b[0], yb + 4.2, b[1]]], 1.0, ['fabricB', 'fabricW', 'fabricR', 'fabricG', 'fabricY']); P.cairn(x, z, 1.4, 'stone'); },
};
const VIGS = { meadow: ['picnic', 'cart', 'shrine', 'statue', 'hay', 'well', 'scarecrow', 'hives', 'circle', 'flowers'], forest: ['rest', 'circle', 'grave', 'logs', 'totem', 'shrine', 'mush', 'hunter'],
  lake: ['nets', 'ruin', 'picnic', 'shrine', 'boat', 'flowers'], swamp: ['skulls', 'cauldron', 'mush', 'ruin', 'boat', 'totem'], canyon: ['wreck', 'minecart', 'skulls', 'rest', 'tent', 'cairn', 'totem', 'grave'],
  plateau: ['ruin', 'statue', 'circle', 'grave', 'tent', 'brazier'], blight: ['thorns', 'corrupt', 'ruin', 'skulls', 'crystals'], snow: ['snowman', 'cairn', 'ice', 'rest', 'flags', 'shrine'] };
srand(hashS('reststop'));
for (const rd of W.roads){ if (rd.w < 6) continue; let C = 0;
  for (let i = 0; i < rd.pts.length - 1; i++){ const [ax, az] = rd.pts[i], [bx, bz] = rd.pts[i + 1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
    for (let n = Math.max(0, Math.ceil(C / 140 - 0.7)); (n + 0.7) * 140 < C + L; n++){ const d = (n + 0.7) * 140 - C, side = n % 2 ? -1 : 1, off = rd.w / 2 + 4.2, x = ax + ux * d - uz * off * side, z = az + uz * d + ux * off * side;
      if (!okSpot(x, z, 2) || roadD(x, z) < 2.5) continue; const bm = biomeAt(x, z); inCell(x, z, () => restStop(x, z, Math.atan2(uz * side, -ux * side), bm)); }
    C += L; } }
const NVIG = { greenhill: 26, woods: 22, lake: 13, swamp: 15, canyon: 22, plateau: 18, blight: 15, frost: 18 };
const VPTS = [];
for (const rg of W.regions){
  const n = Math.round((NVIG[rg.id] || 0) * (LOW ? 0.75 : 1)); if (!n) continue; srand(hashS('vig_' + rg.id));
  const list = (VIGS[rg.biome] || VIGS.meadow).slice(); for (let i = list.length - 1; i > 0; i--){ const j = (R() * (i + 1)) | 0; [list[i], list[j]] = [list[j], list[i]]; }
  let made = 0;
  for (let t = 0; t < 900 && made < n; t++){
    const a = R() * TAU, d = Math.sqrt(R()) * rg.r * 0.95, x = rg.c[0] + Math.cos(a) * d, z = rg.c[1] + Math.sin(a) * d;
    if (F.regionAt(x, z) !== rg || !okSpot(x, z, 5) || roadD(x, z) < 5 || VPTS.some(([px, pz]) => Math.hypot(x - px, z - pz) < 24) || W.camps.some(c => Math.hypot(x - c.c[0], z - c.c[1]) < c.r * 0.55)) continue;
    let kind = list[made % list.length]; if ((kind === 'boat' || kind === 'nets') && !W.lakes.some(L => Math.hypot((x - L.c[0]) / (L.rx + 14), (z - L.c[1]) / (L.rz + 14)) < 1) && !W.rivers.some(rv => rv.pts.some(p => Math.hypot(x - p[0], z - p[1]) < 30))) kind = 'shrine';
    const ry = R() * TAU; inCell(x, z, () => VIG[kind](x, z, ry)); VPTS.push([x, z, kind]); made++;
  }
}
buildCells();
for (const [rk, list] of FARB){ const g = G.mergeGeos(list.map(x => x)); for (const name of ['color', 'aEmi', 'aLm']){ let n = 0; for (const q of list) n += q.attributes[name].array.length; const arr = new Float32Array(n); let o = 0; for (const q of list){ arr.set(q.attributes[name].array, o); o += q.attributes[name].array.length; } g.setAttribute(name, new THREE.BufferAttribute(arr, name === 'color' ? 3 : 1)); }
  const m = meshOf(g, FARMAT); m.name = 'lmfar_' + rk; FW.add(m); }
buildGlows();
wrapGround();
SA.t.needsUpdate = true; CA.t.needsUpdate = true;

// 미니맵: 발견한 랜드마크 · 마을 건물 윤곽
function drawMine(ctx, k){
  const pp = X.player.pos;
  ctx.save(); ctx.fillStyle = 'rgba(120,96,70,.95)'; ctx.strokeStyle = 'rgba(30,20,10,.6)'; ctx.lineWidth = 0.4;
  for (const [x, z, hw, hd, ry] of MAPBOX){ if (Math.abs(x - pp.x) > 220 || Math.abs(z - pp.z) > 220) continue; ctx.save(); ctx.translate(x * k, z * k); ctx.rotate(-ry); ctx.fillRect(-hw * k, -hd * k, hw * 2 * k, hd * 2 * k); ctx.strokeRect(-hw * k, -hd * k, hw * 2 * k, hd * 2 * k); ctx.restore(); }
  ctx.restore();
  const ms = 1.3 / ((F.area && F.area.mapZoom) || 5);
  for (const l of W.landmarks){ if (!S.lm.disc[l.id] || Math.abs(l.c[0] - pp.x) > 400 || Math.abs(l.c[1] - pp.z) > 400) continue; ctx.save(); ctx.translate(l.c[0] * k, l.c[1] * k); ctx.rotate(Math.PI / 4 - G.camYaw); ctx.scale(ms, ms); ctx.fillStyle = l.raid ? '#ff7a5a' : '#ffe08a'; ctx.strokeStyle = 'rgba(20,14,6,.85)'; ctx.lineWidth = 1.5; ctx.fillRect(-3.5, -3.5, 7, 7); ctx.strokeRect(-3.5, -3.5, 7, 7); ctx.restore(); }
}
// 한 번만 이어 붙여요 (다른 모듈이 나중에 감싸면 그쪽이 이걸 불러요)
if (F.area){ const prevDraw = F.area.mapDraw || null; F.area.mapDraw = (ctx, k) => { if (prevDraw) prevDraw(ctx, k); drawMine(ctx, k); }; }

// ───────────────────────── 매 프레임 ─────────────────────────
for (const l of W.landmarks) if (S.lm.disc[l.id]) placeLabel(l);
let cullT = 0, discT = 0, envT = 0, nightK = 0;
const ACTIVE = [];
function cull(px, pz){
  ACTIVE.length = 0; const lowK = LOW ? 0.8 : 1;
  for (const L of LMS){ const d = Math.hypot(px - L.x, pz - L.z), near = d < L.nearR * lowK; L.near.visible = near; if (L.far) FARH[L.idx] = near ? 1 : 0; L.active = near && d < L.animR; if (L.active) ACTIVE.push(L); }
  for (const c of CELLS){ const d = Math.hypot(px - c.x, pz - c.z); c.g.visible = d < (LOW ? 210 : 260); }
  // 발견한 곳 이름표: 가까운 4곳만 (안에 들어가 있으면 숨겨요)
  const ls = []; for (const id in LABELS){ const l = byId('landmarks', id), d = Math.hypot(px - l.c[0], pz - l.c[1]); LABELS[id].hidden = true; if (d > l.r * 0.9 && d < 300) ls.push([d, id, l]); }
  ls.sort((a, b) => a[0] - b[0]); for (let i = 0; i < Math.min(4, ls.length); i++){ const [d, id, l] = ls[i]; LABELS[id].hidden = false; LABELS[id].set(`📍 ${l.name}`, `${Math.round(d)}m`); }
}
function checkDisc(px, pz){ if (X.tpBusy || X.dialogOpen || X.dead) return; for (const l of W.landmarks){ if (!S.lm.disc[l.id] && Math.hypot(px - l.c[0], pz - l.c[1]) < l.r) discover(l); } }
const nightTarget = () => { if (typeof F.timeOfDay === 'number'){ const k = Math.abs(F.timeOfDay - 0.5) * 2; return clamp((k - 0.4) / 0.2, 0, 1); } if (typeof F.isNight === 'function') return F.isNight() ? 1 : 0; return 0; };
G.hooks.push((dt, rdt) => {
  pumpFound(rdt);
  if (!F.inField) return;
  TU.value += dt;
  const px = X.player.pos.x, pz = X.player.pos.z;
  cullT -= rdt; if (cullT <= 0){ cullT = 0.25; cull(px, pz); }
  for (const L of ACTIVE) for (const f of L.anims) f(dt, TU.value);
  discT -= rdt; if (discT <= 0){ discT = 0.3; checkDisc(px, pz); }
  nightK += (nightTarget() - nightK) * Math.min(1, rdt * 1.5);
  if (glowPts){ const u = glowPts.material.uniforms; u.uNight.value = nightK; u.uScale.value = innerHeight * G.renderer.getPixelRatio() * 0.5 / Math.tan(G.camera.fov * Math.PI / 360); }
  for (const b of BEAMS){ const d = Math.hypot(px - b.x, pz - b.z); b.m.opacity = (0.07 + 0.13 * nightK) * clamp((d - 25) / 80, 0.15, 1); }
  envT -= rdt; if (envT <= 0){ envT = 1; wrapGround(); const e = G.M.stone.envMapIntensity ?? 1; for (const m of OWN) m.envMapIntensity = e; }
});
// 처음 필드에 들어올 때 (순간이동 화면 뒤에서) 모든 랜드마크 셰이더를 미리 컴파일해 둬요 — 가까이 갈 때 끊기지 않게
let compiled = false;
function precompile(){
  if (compiled) return; compiled = true;
  try { for (const L of LMS) L.near.visible = true; for (const c of CELLS) c.g.visible = true; G.renderer.compile(FW, G.camera, G.scene); }
  catch (e){ console.warn('[landmarks] 미리 컴파일 실패', e); }
  cull(X.player.pos.x, X.player.pos.z);
}
BUS.on('enterField', () => { cullT = 0; wrapGround(); precompile(); });

F.addCollider = _addCol; STATS.colliders = MYCOL.length;
const ms = Math.round(performance.now() - T0); TIMES.sort((a, b) => b[1] - a[1]); STATS.slow = TIMES.slice(0, 6).map(t => t.join(':')).join(' '); STATS.scatterMs = Math.round(performance.now() - T1);
console.log(`[landmarks] ${STATS.landmarks}개 랜드마크 · 소품 ${STATS.props} · 충돌체 ${STATS.colliders} · 빛 ${STATS.glows} · 발판 ${STATS.platforms} · ${ms}ms (소품 ${STATS.scatterMs}ms · 느린 것 ${STATS.slow})` + (FAILED.length ? ` · 빠짐: ${FAILED.join(', ')}` : ''));
F.lmStats = Object.assign({ ms, failed: FAILED }, STATS);
return { landmarkAt: F.landmarkAt, discovered: F.discovered, raidPortalPos: F.raidPortalPos, stats: F.lmStats, platformY: platY, colliders: MYCOL,
  top: id => { const L = LMS.find(o => o.id === id); return L ? L.top : null; }, discover: id => { const l = byId('landmarks', id); if (l) discover(l); } };
}
