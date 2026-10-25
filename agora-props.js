// 룬 아고라 — 모험의 대지: 이야기 소품 (agora-props.js)
// lore 셋피스(이야기 장면 소품) · 길가 소품 · 빈 땅을 채우는 작은 장면(모닥불 자리 · 폐허 · 돌무덤 …) · 이야기에 묶인 작은 동물 · 셋피스 쪽 세상 변화
// 계약서: docs/agora-modules.md · 셋피스 종류: docs/agora-story-bible.md §6. 필드 물체는 F.FW 에 절대 y (= F.H(x, z)) 로 넣어요.
// 그리는 법: 모든 소품을 160m 칸마다 「정점색 + 변화 속성」 메시 하나로 병합해요 (칸 = 드로콜 1, 글자판 · 얼음이 있는 칸만 +1). 거리로 켜고 꺼요.
//   세상의 변화는 셰이더 uniform 하나(uK[키])로 해요: 정점마다 키 번호 · 방식(사라짐 / 솟아남 / 시듦) · 제 바닥에서의 높이 · 두 번째 색 · 발광을 가져서
//   가시는 땅속으로 오그라들고, 새싹은 솟아나고, 검은 물은 맑아져요 (2초). 빛 점 · 떠다니는 빛(포자 · 정령 · 물줄기 · 반짝임)도 같은 키를 따라요.
// 줍는 물건(pickup: true)은 따로 작은 그룹이라 처음엔 숨겨 두고 saga 가 F.props.show(id, true) 로 켜요 (반짝임 포함).
// 작은 동물은 life 의 「플레이어 곁 무작위」 동물과 겹치지 않게 이야기 자리에 묶었어요: 꽃밭 나비 · 벌통 벌 · 숲 · 늪 반딧불 · 지역 하늘의 새 떼(침식지 까마귀 …) · 굴 토끼 · 은빛 호수 물고기.
// F 에 올리는 것: F.props = { obj(id), pos(id) → [x, y, z], show(id, on), setChange(key, on, instant) → bool, list(kind?), keys(), stats }
export async function init(G, X, F){
const { THREE, V3, BUS, TAU } = X;
const W = F.WORLD, FW = F.FW, WL = W.water, HALF = W.half;
const LOW = G.gfxMode === 'low' || G.IS_TOUCH;
const T0 = performance.now();
const STATS = { setpieces: 0, pickups: 0, roadside: 0, milestones: 0, vignettes: 0, cells: 0, tris: 0, verts: 0, glows: 0, motes: 0, butterflies: 0, burrows: 0, colliders: 0, platforms: 0, fallback: [], kinds: {} };
let LORE = [];
try { LORE = (await import('./lore/index.js')).LORE || []; } catch (e){ console.warn('[props] lore 를 못 읽었어요', e); }

// ───────────────────────── 결정적 난수 ─────────────────────────
let _s = 1;
const srand = s => { _s = (s >>> 0) || 1; };
const R = () => { _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rr = (a, b) => a + (b - a) * R(), pick = a => a[(R() * a.length) | 0];
const hashS = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const hash2 = (i, j, k = 0) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => v < a ? a : v > b ? b : v, sst = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const pickW = list => { let t = 0; for (const it of list) t += it[1]; let r = R() * t; for (const it of list){ r -= it[1]; if (r <= 0) return it[0]; } return list[list.length - 1][0]; };

// ───────────────────────── 땅 · 물 · 길 ─────────────────────────
const H = (x, z) => F.H(x, z);
const WY = (x, z) => F.waterY ? F.waterY(x, z) : WL;
const isW = (x, z) => F.isWater ? F.isWater(x, z) : H(x, z) < WL - 0.25;
const wetR = (x, z, r) => { if (isW(x, z)) return true; for (let i = 0; i < 8; i++){ const a = i / 8 * TAU; if (isW(x + Math.cos(a) * r, z + Math.sin(a) * r)) return true; } return false; };
const slope = (x, z) => F.slope ? F.slope(x, z) : 0;
const biomeAt = (x, z) => F.biomeAt ? F.biomeAt(x, z) : (F.regionAt(x, z) || {}).biome || 'meadow';
// 발자국 [최저, 최고] 지면 높이 (원 r)
function foot(x, z, r){ let lo = H(x, z), hi = lo; if (r > 0.15) for (let i = 0; i < 8; i++){ const a = i / 8 * TAU; for (const k of [0.55, 1]){ const h = H(x + Math.cos(a) * r * k, z + Math.sin(a) * r * k); if (h < lo) lo = h; if (h > hi) hi = h; } } return [lo, hi]; }
const SEGS = [];
for (const rd of W.roads) for (let i = 0; i < rd.pts.length - 1; i++){ const [ax, az] = rd.pts[i], [bx, bz] = rd.pts[i + 1]; SEGS.push({ ax, az, ex: bx - ax, ez: bz - az, l2: (bx - ax) ** 2 + (bz - az) ** 2, w: rd.w }); }
// 길 가장자리까지 거리 (중심선 - 반폭)
function roadD(x, z){ let b = 1e9; for (const s of SEGS){ const t = clamp(((x - s.ax) * s.ex + (z - s.az) * s.ez) / s.l2, 0, 1), d = Math.hypot(x - s.ax - s.ex * t, z - s.az - s.ez * t) - s.w / 2; if (d < b) b = d; } return b; }
// 물 쪽 방향 (선착장 · 배 · 그물이 물을 보게) — 없으면 ry 그대로
function waterDir(x, z, ry){ let best = null, bd = 1e9; for (let i = 0; i < 24; i++){ const a = i / 24 * TAU, dx = Math.sin(a), dz = Math.cos(a); for (let d = 2; d <= 24; d += 2){ if (isW(x + dx * d, z + dz * d)){ if (d < bd){ bd = d; best = a; } break; } } } return best == null ? ry : best; }

// ───────────────────────── 비워 둘 곳 ─────────────────────────
// 원 [x, z, r]: NPC · 룬 비석 · 낚시터 · 이정표 · 다리 · 승강 룬 · lore 주민 · 읽을거리 · 수호석 · 이야기 보스 자리
const KEEP = [...W.npcs.map(n => [n.c[0], n.c[1], 4]), ...W.waypoints.map(w => [w.c[0], w.c[1], 9]), ...W.fishing.map(f => [f.c[0], f.c[1], 6]), ...(W.signposts || []).map(s => [s.c[0], s.c[1], 4]),
  ...(W.bridges || []).map(b => [b.c[0], b.c[1], b.len / 2 + 5]), ...(W.lifts || []).map(l => [l.from[0], l.from[1], 8])];
for (const L of LORE){
  for (const r of (L.settlement && L.settlement.residents) || []) if (r.c) KEEP.push([r.c[0], r.c[1], 4]);
  for (const r of L.readables || []) if (r.c) KEEP.push([r.c[0], r.c[1], 4]);
  if (L.keystone && L.keystone.c) KEEP.push([L.keystone.c[0], L.keystone.c[1], 7]);
  for (const b of L.bosses || []) if (b.c) KEEP.push([b.c[0], b.c[1], 10]);
  for (const q of L.quests || []) for (const o of q.o || []) if (o.t === 'reach' && o.c) KEEP.push([o.c[0], o.c[1], 5]);
}
const kept = (x, z, pad = 0) => { for (const [a, b, r] of KEEP) if ((x - a) ** 2 + (z - b) ** 2 < (r + pad) ** 2) return true; return false; };
const SETTLE = W.settlements || [];
const nearSettle = (x, z, pad) => SETTLE.some(t => Math.hypot(x - t.c[0], z - t.c[1]) < t.r + pad);
const nearLm = (x, z, k, pad) => W.landmarks.some(l => Math.hypot(x - l.c[0], z - l.c[1]) < l.r * k + pad);
const nearCamp = (x, z, k) => W.camps.some(c => Math.hypot(x - c.c[0], z - c.c[1]) < c.r * k);
// 내가 놓은 것 (겹치지 않게): 24m 격자
const PG = new Map(), PGS = 24;
function placed(x, z, r){ const i0 = Math.floor((x - r - 14) / PGS), i1 = Math.floor((x + r + 14) / PGS), j0 = Math.floor((z - r - 14) / PGS), j1 = Math.floor((z + r + 14) / PGS);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++){ const L = PG.get(i * 10007 + j); if (L) for (const [a, b, q] of L) if ((x - a) ** 2 + (z - b) ** 2 < (r + q) ** 2) return true; } return false; }
function mark(x, z, r){ const k = Math.floor(x / PGS) * 10007 + Math.floor(z / PGS); let L = PG.get(k); if (!L) PG.set(k, L = []); L.push([x, z, Math.min(r, 14)]); }
// 랜드마크 모듈이 세운 것 (등불 · 울타리 · 쉼터 · 작은 장면) 의 충돌체까지 거리
const LMC = new Map();
for (const c of ((F.modules && F.modules.landmarks && F.modules.landmarks.colliders) || [])){ if (!c) continue; const k = Math.floor(c.x / PGS) * 10007 + Math.floor(c.z / PGS); let L = LMC.get(k); if (!L) LMC.set(k, L = []); L.push(c); }
function lmD(x, z){ let best = 99; const i0 = Math.floor(x / PGS), j0 = Math.floor(z / PGS);
  for (let i = i0 - 2; i <= i0 + 2; i++) for (let j = j0 - 2; j <= j0 + 2; j++){ const L = LMC.get(i * 10007 + j); if (!L) continue;
    for (const c of L){ let d; if (c.t === 'c') d = Math.hypot(x - c.x, z - c.z) - c.r; else { const dx = x - c.x, dz = z - c.z, lx = Math.abs(dx * c.c - dz * c.s) - c.hw, lz = Math.abs(dx * c.s + dz * c.c) - c.hd; d = Math.hypot(Math.max(lx, 0), Math.max(lz, 0)) + Math.min(Math.max(lx, lz), 0); } if (d < best) best = d; } }
  return best; }
// 나무 · 큰 바위 줄기까지 거리 (world 식생 자료가 있으면)
const VT = F.modules && F.modules.world && F.modules.world._dbg && F.modules.world._dbg.VT;
const TREEK = VT ? Object.values(VT).filter(T => T && T.tr && !T.small && T.n && T.bk) : [];
function treeD(x, z){ if (!TREEK.length) return 99; let best = 99; const bx = Math.floor((x + HALF) / 50), bz = Math.floor((z + HALF) / 50);
  for (const T of TREEK) for (let a = bx - 1; a <= bx + 1; a++) for (let b = bz - 1; b <= bz + 1; b++){ const L = T.bk.get(a * 64 + b); if (!L) continue; for (const i of L){ const o = i * 8, dx = T.D[o] - x, dz = T.D[o + 2] - z; if (Math.abs(dx) > 12 || Math.abs(dz) > 12) continue; const d = Math.hypot(dx, dz) - T.tr * T.D[o + 4]; if (d < best) best = d; } }
  return best; }

// ───────────────────────── 색 (sRGB) · 발광 · 깃발 ─────────────────────────
// PAL[key] = [r, g, b, 발광(0~4), 깃발] — 깃발: 1 = 밤에 더 밝게 (등불) · 2 = 반들반들 (물 · 진흙) · 4 = 바람에 흔들림 (천 · 깃발)
const PAL = {};
const pal = (k, hex, e = 0, fl = 0) => { PAL[k] = [hex >> 16 & 255, hex >> 8 & 255, hex & 255, e, fl]; };
pal('wood', 0x8a6a4a); pal('woodD', 0x4a3626); pal('woodL', 0xc8a070); pal('woodR', 0x7a4a30); pal('bark', 0x5a3e28); pal('plank', 0x9a7a54); pal('rope', 0x8a7050); pal('crate', 0xb59a74);
pal('wicker', 0xd8a868); pal('straw', 0xd8b860); pal('hay', 0xe8d088); pal('sack', 0xc4a678); pal('grain', 0xe0c870); pal('stub', 0xcdbd84); pal('coal', 0x262222); pal('ash', 0x8a8680);
pal('soil', 0x6a5236); pal('soilD', 0x3e3022); pal('soilT', 0x5e4228); pal('soilR', 0x6e4c2c); pal('mud', 0x4a3a28, 0, 2); pal('sand', 0xd8b880); pal('grassD', 0x4a7a30);
pal('stone', 0x9a948a); pal('stoneD', 0x6a6660); pal('mossy', 0x7e9a6a); pal('moss', 0x4a7a32); pal('ruin', 0xb8b0a0); pal('marble', 0xe8e4dc); pal('darkst', 0x5a5660); pal('redrock', 0xb0603a); pal('redrockD', 0x8a4a2e); pal('cobble', 0x8a8478); pal('pot', 0xb4582f);
pal('leaf', 0x4a8a34); pal('leafD', 0x2f6a2a); pal('leafL', 0x7ab848); pal('sprout', 0x6ac040); pal('grass', 0x5a9a3a); pal('dry', 0x8a7a50); pal('cactus', 0x4f8a3a); pal('reed', 0xb0a060);
pal('flower', 0xe8507e); pal('flowerY', 0xf2c43a); pal('flowerW', 0xffffff); pal('flowerB', 0x7a9aff); pal('flowerP', 0xc08aff); pal('flowerO', 0xff8a3a);
pal('shroomR', 0xd8402e); pal('shroomW', 0xf0e6d0); pal('shroomB', 0xb08a5a); pal('puff', 0xe6dccb);
pal('blight', 0x1c1620); pal('blightR', 0x2a2030); pal('blightP', 0x3a1a44, 0.15); pal('thorn', 0x1e1626); pal('thornT', 0x9a4ad8, 0.9); pal('thornB', 0x4a3424); pal('crystalP', 0xc87aff, 1.5); pal('seed', 0x120c16, 0.1, 2);
pal('ink', 0x16121e, 0, 2); pal('spore', 0xd8c8f0); pal('sporeG', 0xd8a8ff, 0.9); pal('spiritD', 0x5affd8, 0.25); pal('wet', 0x4a2a1c, 0, 2);
pal('iron', 0x3a3c44); pal('rust', 0x7a4a32); pal('steel', 0xb8bcc4); pal('gold', 0xe6b858, 0.12); pal('bronze', 0x9a6a34); pal('red', 0xc0281e); pal('dark', 0x141012);
pal('cloth', 0xc23a2a, 0, 4); pal('clothB', 0x2c5f9a, 0, 4); pal('clothW', 0xf0e8d8, 0, 4); pal('clothG', 0x2f7a46, 0, 4); pal('clothY', 0xe0b030, 0, 4); pal('clothP', 0x6a2a8a, 0, 4); pal('clothFz', 0xb8d0e0);
pal('canvas', 0xd8c8a0); pal('paper', 0xf0e6cc); pal('furG', 0x8a8a90); pal('furD', 0x2a2a30); pal('bone', 0xe8dcc0); pal('boneD', 0xbcae8c); pal('snow', 0xf2f6fb); pal('iceO', 0xbfe4f4, 0.3);
pal('waterD', 0x0c0a14, 0, 2); pal('waterB', 0x4ab0d8, 0.3, 2); pal('water', 0x3a7a9a, 0.1, 2); pal('goo', 0x6ad0ff, 0.5, 2); pal('honey', 0xf0b030, 0.25, 2); pal('fish', 0xa8b8c8, 0, 2); pal('fishD', 0x5a5a60);
pal('bread', 0xc27a36); pal('fruitR', 0xc0281e); pal('fruitG', 0x86b23a); pal('fruitO', 0xe78a1e); pal('carrot', 0xe8781a);
pal('ember', 0xff5a14, 3); pal('glowO', 0xffa040, 2.4); pal('glowY', 0xffe070, 2.2); pal('glowG', 0x9aff70, 2); pal('glowC', 0x3fe6ff, 2.2); pal('glowP', 0xb44aff, 2.2); pal('glowB', 0x8ad8ff, 2);
pal('lampN', 0xffb860, 2.4, 1); pal('lampOff', 0x3a3a30); pal('lampG', 0x9aff70, 2.6, 1);

// ───────────────────────── 세상의 변화 키 ─────────────────────────
// 0 = 안 바뀜. 지역의 「가시 기운」(검은 얼룩 · 가시 새싹) 은 그 지역 장이 끝나는 키를 따라요.
const KEYS = [''], USED = new Set(), UK = new Float32Array(32), CHS = [{ cur: 0, tgt: 0 }], LINKS = [];   // LINKS: [인스턴스 키, 부모 키] — 부모가 켜지면 같이 켜져요
const keyI = k => { if (!k) return 0; let i = KEYS.indexOf(k); if (i < 0){ if (KEYS.length >= 32) return 0; i = KEYS.push(k) - 1; CHS.push({ cur: 0, tgt: 0 }); } USED.add(k); return i; };
const HEALD = { village: 'fields_heal', greenhill: 'fields_heal', woods: 'spore_clear', lake: 'lake_clear', swamp: 'mist_thin', canyon: 'tears_stop', plateau: 'golems_calm', blight: 'thorns_recede', frost: 'north_wind_clear' };
const NOHEAL = new Set(['windmill_spin', 'lina_home', 'lake_lord', 'village_letter', 'festival', 'swamp_lanterns', 'spirit_lights', 'dust_lively']);
const LBY = {}; for (const L of LORE) LBY[L.region] = L;
const HEALK = {};
for (const rg of W.regions){ const d = HEALD[rg.id] || 'thorns_recede', ch = (LBY[rg.id] && LBY[rg.id].chapter && LBY[rg.id].chapter.change) || []; HEALK[rg.id] = !ch.length || ch.includes(d) ? d : (ch.find(k => !NOHEAL.has(k)) || d); }
const healAt = (x, z) => HEALK[(F.regionAt(x, z) || {}).id] || 'thorns_recede';
// 지금 짓는 조각의 변화 상태
const ST = { k: 0, mode: 0, c2: null, e2: null, fl: 0 };
// mo({ key, mode: 1 사라짐 · 2 솟아남 · 3 시듦(30%로), c2: 두 번째 색(키 또는 {원래키: 새키}), e2: 두 번째 발광, fl: 깃발 }, 그리기)
function mo(o, fn){ const sv = [ST.k, ST.mode, ST.c2, ST.e2, ST.fl]; if ('key' in o) ST.k = keyI(o.key); if ('mode' in o) ST.mode = o.mode; if ('c2' in o) ST.c2 = o.c2; if ('e2' in o) ST.e2 = o.e2; if (o.fl) ST.fl |= o.fl;
  try { fn(); } finally { ST.k = sv[0]; ST.mode = sv[1]; ST.c2 = sv[2]; ST.e2 = sv[3]; ST.fl = sv[4]; } }

// ───────────────────────── 병합 빌더 (정점 = 위치 · 법선 · 색 A/B + 발광 · 변화) ─────────────────────────
const _v = new V3(), _n = new V3(), _nm = new THREE.Matrix3(), I4 = new THREE.Matrix4();
const cl8 = v => v < 0 ? 0 : v > 255 ? 255 : Math.round(v), eb = e => Math.min(255, Math.round(e / 4 * 255));
class MB {
  constructor(){ this.P = []; this.N = []; this.A = []; this.B = []; this.Xa = []; this.I = []; this.n = 0; this.ice = []; this.atl = []; }
  add(key, geo, m){
    if (key === 'ice' || key === 'atlas'){ const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(m); (key === 'ice' ? this.ice : this.atl).push(g); return; }
    const pa = PAL[key] || PAL.stone, k2 = ST.c2 ? (typeof ST.c2 === 'string' ? ST.c2 : (ST.c2[key] || key)) : key, pb = PAL[k2] || pa, j = 1 + (R() - 0.5) * 0.09;
    const e1 = eb(pa[3]), e2 = eb(ST.e2 != null ? ST.e2 : pb[3]), fl = pa[4] | ST.fl, mode = ST.mode, kI = ST.k;
    const pos = geo.attributes.position; if (!geo.attributes.normal) geo.computeVertexNormals(); const nor = geo.attributes.normal;
    _nm.getNormalMatrix(m); const base = this.n, cnt = pos.count, P = this.P, o = P.length; let minY = 1e9;
    for (let i = 0; i < cnt; i++){ _v.fromBufferAttribute(pos, i).applyMatrix4(m); P.push(_v.x, _v.y, _v.z); if (_v.y < minY) minY = _v.y; _n.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize(); this.N.push(Math.round(_n.x * 127), Math.round(_n.y * 127), Math.round(_n.z * 127)); }
    const a0 = cl8(pa[0] * j), a1 = cl8(pa[1] * j), a2 = cl8(pa[2] * j), b0 = cl8(pb[0] * j), b1 = cl8(pb[1] * j), b2 = cl8(pb[2] * j);
    for (let i = 0; i < cnt; i++){ this.A.push(a0, a1, a2, e1); this.B.push(b0, b1, b2, e2); this.Xa.push(kI, mode, mode ? Math.min(255, Math.round((P[o + i * 3 + 1] - minY) * 10)) : 0, fl); }
    if (geo.index){ const ix = geo.index.array; for (let i = 0; i < ix.length; i++) this.I.push(base + ix[i]); } else for (let i = 0; i < cnt; i++) this.I.push(base + i);
    this.n += cnt;
  }
}
// 빌더 → 지오메트리 (ox, oy, oz 만큼 빼서 그룹 원점 기준으로)
function geoOf(b, ox = 0, oy = 0, oz = 0){
  if (!b.n) return null;
  const P = new Float32Array(b.P); if (ox || oy || oz) for (let i = 0; i < P.length; i += 3){ P[i] -= ox; P[i + 1] -= oy; P[i + 2] -= oz; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(b.N), 3, true));
  g.setAttribute('aC1', new THREE.BufferAttribute(new Uint8Array(b.A), 4, true)); g.setAttribute('aC2', new THREE.BufferAttribute(new Uint8Array(b.B), 4, true)); g.setAttribute('aX', new THREE.BufferAttribute(new Uint8Array(b.Xa), 4, true));
  g.setIndex(new THREE.BufferAttribute(b.n > 65535 ? new Uint32Array(b.I) : new Uint16Array(b.I), 1)); g.computeBoundingSphere();
  STATS.tris += b.I.length / 3; STATS.verts += b.n; return g;
}

// ───────────────────────── 재질 (정점색 + 변화 셰이더) ─────────────────────────
const MU = { uK: { value: UK }, uNight: { value: 0 }, uTime: { value: 0 }, uScale: { value: 400 } };
const GL_HEAD = 'attribute vec4 aC1, aC2, aX;\nuniform float uK[32];\nuniform float uNight, uTime;\n';
// 정점 변화: 사라짐(1) · 솟아남(2) 은 제 바닥으로 납작하게 오그라들며 살짝 땅속으로, 시듦(3) 은 30% 로 · 흔들림 깃발(4)
const GL_MORPH = `
  int kI = int(aX.x * 255.0 + 0.5), mI = int(aX.y * 255.0 + 0.5), fI = int(aX.w * 255.0 + 0.5);
  float kk = uK[kI], hA = aX.z * 25.5, sc = 1.0;
  if (mI == 1) sc = 1.0 - kk; else if (mI == 2) sc = kk; else if (mI == 3) sc = 1.0 - kk * 0.7;
  if (mI > 0) transformed.y -= hA * (1.0 - sc) + (mI == 3 ? 0.0 : (1.0 - sc) * 0.35);
  if ((mI == 1 || mI == 2) && sc < 0.002) transformed.y -= 9000.0;
  if ((fI & 4) != 0){ float sw = sin(uTime * 2.3 + transformed.x * 0.6 + transformed.z * 0.45); transformed.x += sw * hA * 0.045; transformed.z += sw * hA * 0.03; }`;
const MMAT = new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0, side: THREE.DoubleSide });
MMAT.onBeforeCompile = sh => {
  sh.uniforms.uK = MU.uK; sh.uniforms.uNight = MU.uNight; sh.uniforms.uTime = MU.uTime;
  sh.vertexShader = GL_HEAD + 'varying vec3 vCol;\nvarying float vEmi, vGl;\nvarying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  ${GL_MORPH}
  vCol = pow(mix(aC1.rgb, aC2.rgb, kk), vec3(2.2)); vEmi = mix(aC1.a, aC2.a, kk) * 4.0; if ((fI & 1) != 0) vEmi *= mix(0.2, 1.0, uNight); vGl = (fI & 2) != 0 ? 1.0 : 0.0;
  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
  sh.fragmentShader = 'varying vec3 vCol;\nvarying float vEmi, vGl;\nvarying vec3 vWP;\n' + sh.fragmentShader
    .replace('#include <color_fragment>', '#include <color_fragment>\n\tfloat gn = fract(sin(dot(floor(vWP * 9.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);\n\tdiffuseColor.rgb *= vCol * (0.9 + 0.14 * gn);')
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = mix(roughnessFactor, 0.12, vGl);')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += vCol * vEmi;');
};
MMAT.customProgramCacheKey = () => 'propsmorph';
// 그림자도 같은 변화 (가라앉은 가시가 그림자를 남기지 않게)
const DMAT = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
DMAT.onBeforeCompile = sh => { sh.uniforms.uK = MU.uK; sh.uniforms.uNight = MU.uNight; sh.uniforms.uTime = MU.uTime; sh.vertexShader = GL_HEAD + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + GL_MORPH); };
DMAT.customProgramCacheKey = () => 'propsdepth';
const IMAT = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.5, roughness: 0.08, metalness: 0.1, emissive: 0x2a5a8a, emissiveIntensity: 0.35, depthWrite: false, side: THREE.DoubleSide });
const meshOf = (geo, m, cast = false) => { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = true; o.matrixAutoUpdate = false; return o; };

// ───────────────────────── 글자판 아틀라스 (실종 전단 · 수배지 · 위령비 · 이정석 글씨 · 경고판) ─────────────────────────
// 1024² 한 장: 윗줄 256² 포스터 4칸 + 아래 256×96 글씨 32칸 → 재질 하나
const AC = G.cnv(1024, 1024), AX = AC.getContext('2d'), ATEX = G.tex(AC, true, 1, 1);
ATEX.wrapS = ATEX.wrapT = THREE.ClampToEdgeWrapping; ATEX.anisotropy = 4;
const AMAT = new THREE.MeshStandardMaterial({ map: ATEX, roughness: 0.9, side: THREE.DoubleSide });
const ADRAW = [], APOS = new Map(); let aPost = 0, aText = 0;
const SERIF = '"Gowun Batang", serif', SANS = '"Noto Sans KR", sans-serif';
function aslot(kind, id, draw){
  if (APOS.has(id)) return APOS.get(id);
  let px, py, w, h;
  if (kind === 'p'){ if (aPost >= 4) return null; px = aPost * 256; py = 0; w = h = 256; aPost++; }
  else { if (aText >= 32) return null; px = (aText % 4) * 256; py = 256 + ((aText / 4) | 0) * 96; w = 256; h = 96; aText++; }
  const uv = [(px + 2) / 1024, 1 - (py + h - 2) / 1024, (px + w - 2) / 1024, 1 - (py + 2) / 1024];
  const f = () => { try { AX.save(); AX.beginPath(); AX.rect(px, py, w, h); AX.clip(); draw(AX, px, py, w, h); AX.restore(); } catch (e){} };
  ADRAW.push(f); f(); APOS.set(id, uv); return uv;
}
const quadUV = (w, h, uv) => { const g = new THREE.PlaneGeometry(w, h), a = g.attributes.uv; a.setXY(0, uv[0], uv[3]); a.setXY(1, uv[2], uv[3]); a.setXY(2, uv[0], uv[1]); a.setXY(3, uv[2], uv[1]); return g; };
function paperBg(x, px, py, w, h, col = '#efe2c0'){ x.fillStyle = col; x.fillRect(px, py, w, h); for (let i = 0; i < 40; i++){ x.fillStyle = `rgba(120,90,40,${0.03 + Math.random() * 0.06})`; x.beginPath(); x.arc(px + Math.random() * w, py + Math.random() * h, 4 + Math.random() * 18, 0, TAU); x.fill(); } x.strokeStyle = 'rgba(90,60,30,.5)'; x.lineWidth = 3; x.strokeRect(px + 6, py + 6, w - 12, h - 12); }
const POSTERS = {
  missing: (x, px, py, w, h) => { paperBg(x, px, py, w, h); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#a8261e'; x.font = `900 38px ${SERIF}`; x.fillText('찾습니다', px + w / 2, py + 34);
    const cx = px + w / 2, cy = py + 112; x.fillStyle = '#b8302a'; x.beginPath(); x.moveTo(cx - 52, cy + 52); x.quadraticCurveTo(cx - 60, cy - 50, cx, cy - 58); x.quadraticCurveTo(cx + 60, cy - 50, cx + 52, cy + 52); x.fill();
    x.fillStyle = '#f3d6b4'; x.beginPath(); x.arc(cx, cy + 4, 32, 0, TAU); x.fill(); x.fillStyle = '#6a4024'; x.fillRect(cx - 30, cy - 26, 60, 14); x.fillStyle = '#2a1a10'; x.beginPath(); x.arc(cx - 11, cy + 4, 3.5, 0, TAU); x.arc(cx + 11, cy + 4, 3.5, 0, TAU); x.fill(); x.strokeStyle = '#8a4a3a'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy + 14, 8, 0.2, Math.PI - 0.2); x.stroke();
    x.fillStyle = '#3a2614'; x.font = `800 22px ${SERIF}`; x.fillText('빨간 망토의 리나', px + w / 2, py + 190); x.font = `500 15px ${SANS}`; x.fillText('보신 분은 잎새 마을 로완에게', px + w / 2, py + 220); },
  wanted: (x, px, py, w, h) => { paperBg(x, px, py, w, h, '#e9d6a8'); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#3a1a0c'; x.font = `900 44px ${SERIF}`; x.fillText('수 배', px + w / 2, py + 36);
    const cx = px + w / 2, cy = py + 116; x.fillStyle = '#8a8a90'; for (const s of [-1, 1]){ x.beginPath(); x.moveTo(cx + s * 22, cy - 30); x.lineTo(cx + s * 44, cy - 58); x.lineTo(cx + s * 50, cy - 18); x.fill(); } x.beginPath(); x.ellipse(cx, cy, 50, 42, 0, 0, TAU); x.fill();
    x.fillStyle = '#2a2a30'; x.beginPath(); x.ellipse(cx, cy - 4, 46, 13, 0, 0, TAU); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(cx - 18, cy - 4, 6, 0, TAU); x.arc(cx + 18, cy - 4, 6, 0, TAU); x.fill(); x.fillStyle = '#e8e8ec'; x.beginPath(); x.ellipse(cx, cy + 20, 20, 13, 0, 0, TAU); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(cx, cy + 12, 5, 0, TAU); x.fill();
    x.fillStyle = '#3a1a0c'; x.font = `800 22px ${SERIF}`; x.fillText('너구리 도적단', px + w / 2, py + 190); x.fillStyle = '#a8261e'; x.font = `900 20px ${SANS}`; x.fillText('현상금 500 G', px + w / 2, py + 222); },
  memorial: (x, px, py, w, h) => { const g = x.createLinearGradient(px, py, px, py + h); g.addColorStop(0, '#8a8a84'); g.addColorStop(1, '#6a6a66'); x.fillStyle = g; x.fillRect(px, py, w, h);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(30,30,34,.85)'; x.font = `900 26px ${SERIF}`; x.fillText('호수에 잠든', px + w / 2, py + 52); x.fillText('이들을 기리며', px + w / 2, py + 88);
    x.strokeStyle = 'rgba(30,30,34,.6)'; x.lineWidth = 3; for (let i = 0; i < 3; i++){ x.beginPath(); for (let k = 0; k <= 20; k++){ const xx = px + 40 + k * 8.8, yy = py + 136 + i * 18 + Math.sin(k * 0.9) * 5; k ? x.lineTo(xx, yy) : x.moveTo(xx, yy); } x.stroke(); }
    x.font = `600 15px ${SANS}`; x.fillText('물안개 나루 사람들이 세움', px + w / 2, py + 222); },
  royal: (x, px, py, w, h) => { paperBg(x, px, py, w, h, '#e6dcc4'); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#c89a38'; x.beginPath(); const cx = px + w / 2, cy = py + 70; x.moveTo(cx - 44, cy + 22); x.lineTo(cx - 44, cy - 14); x.lineTo(cx - 22, cy + 4); x.lineTo(cx, cy - 26); x.lineTo(cx + 22, cy + 4); x.lineTo(cx + 44, cy - 14); x.lineTo(cx + 44, cy + 22); x.fill();
    x.fillStyle = '#2a3a6a'; x.font = `900 24px ${SERIF}`; x.fillText('아르카디아 왕실', px + w / 2, py + 132); x.fillStyle = '#3a2a1a'; x.font = `500 15px ${SANS}`; x.fillText('룬을 새기는 손이', px + w / 2, py + 172); x.fillText('이 땅을 지키리라', px + w / 2, py + 196); },
};
const poster = k => POSTERS[k] ? aslot('p', 'p_' + k, POSTERS[k]) : null;
// 글씨 칸: style = stone (돌에 새김) · wood (나무판) · warn (노랑 경고)
function textCell(lines, style = 'wood'){
  return aslot('t', style + ':' + lines.join('|'), (x, px, py, w, h) => {
    if (style === 'stone'){ x.fillStyle = '#8c877c'; x.fillRect(px, py, w, h); for (let i = 0; i < 30; i++){ x.fillStyle = `rgba(${Math.random() < 0.5 ? '60,60,55' : '200,200,190'},.12)`; x.fillRect(px + Math.random() * w, py + Math.random() * h, 3 + Math.random() * 12, 2 + Math.random() * 6); } }
    else if (style === 'warn'){ x.fillStyle = '#e8c040'; x.fillRect(px, py, w, h); x.fillStyle = '#2a2018'; for (let i = -2; i < 14; i++){ x.beginPath(); x.moveTo(px + i * 24, py); x.lineTo(px + i * 24 + 12, py); x.lineTo(px + i * 24 - 8, py + 12); x.lineTo(px + i * 24 - 20, py + 12); x.fill(); x.beginPath(); x.moveTo(px + i * 24, py + h - 12); x.lineTo(px + i * 24 + 12, py + h - 12); x.lineTo(px + i * 24 - 8, py + h); x.lineTo(px + i * 24 - 20, py + h); x.fill(); } }
    else { const g = x.createLinearGradient(0, py, 0, py + h); g.addColorStop(0, '#7a5434'); g.addColorStop(1, '#5a3a22'); x.fillStyle = g; x.fillRect(px, py, w, h); x.fillStyle = 'rgba(0,0,0,.15)'; for (let i = 0; i < 4; i++) x.fillRect(px, py + 12 + i * 22, w, 2); }
    x.textBaseline = 'middle'; const n = lines.length, fs = n > 1 ? 26 : 34;
    lines.forEach((ln, i) => { const al = ln.startsWith('>') ? 'right' : ln.startsWith('<') ? 'left' : 'center', t = ln.replace(/^[<>]/, ''); x.textAlign = al; const xx = al === 'left' ? px + 12 : al === 'right' ? px + w - 12 : px + w / 2, yy = py + h / 2 + (i - (n - 1) / 2) * (fs + 8);
      x.font = `900 ${fs}px ${SERIF}`; if (style === 'stone'){ x.fillStyle = 'rgba(255,255,250,.35)'; x.fillText(t, xx + 1, yy + 1); x.fillStyle = '#2e2c28'; } else if (style === 'warn') x.fillStyle = '#a8201a'; else { x.fillStyle = '#f6e6be'; x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 4; }
      x.fillText(t, xx, yy, w - 20); x.shadowBlur = 0; });
  });
}
const redrawAtlas = () => { for (const f of ADRAW) f(); ATEX.needsUpdate = true; };
if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) document.fonts.ready.then(redrawAtlas).catch(() => {});

// ───────────────────────── 빛 점 (등불 · 불 · 룬) — 밤에 밝아져요. 세계 전체 한 드로콜 ─────────────────────────
const GLW = { p: [], c: [], s: [], d: [], k: [] }, _gc = new THREE.Color();
const MOT = { p: [], a: [], b: [], q: [], t: [] }, PKM = [];   // 떠다니는 빛: 위치 · 색 A · 색 B · [씨앗, 크기, 낮밤, 0] · [종류, 키, 방식, 켜짐] / 줍는 물건별 점 범위
let PKI = -1;   // 지금 짓는 줍는 물건 번호 (-1 = 아님)
// 나비 자리 (꽃밭 · 벌통 · 소풍 · 꽃 상자)
const BFL = [];
function BFLY(lx, lz, n){ const v = kw(lx, lz), x = v.x, z = v.z; for (let i = 0; i < (LOW ? Math.ceil(n / 2) : n); i++) BFL.push(x + rr(-1, 1), H(x, z), z + rr(-1, 1)); }
// 떠다니는 빛 종류: 0 포자 · 1 솟는 물 · 2 물방울 · 3 반짝임 · 4 벌 · 5 정령 빛 · 6 불티 · 7 은은한 빛 · 8 반딧불
function moteAbs(type, x, y, z, col, col2, sz, day){ _gc.set(col); MOT.a.push(_gc.r, _gc.g, _gc.b); _gc.set(col2); MOT.b.push(_gc.r, _gc.g, _gc.b); MOT.p.push(x, y, z); MOT.q.push(R(), sz, day, 0); MOT.t.push(type, ST.k, ST.mode, PKI >= 0 ? 0 : 1); if (PKI >= 0) PKM[PKI].push(MOT.t.length / 4 - 1); }
function glowAbs(x, y, z, col, size = 2, day = 0.3){ if (PKI >= 0) return moteAbs(7, x, y, z, col, col, size * 0.35, 1); _gc.set(col); GLW.p.push(x, y, z); GLW.c.push(_gc.r, _gc.g, _gc.b); GLW.s.push(size); GLW.d.push(day); GLW.k.push(ST.k, ST.mode); }

// ───────────────────────── 지오메트리 도우미 (모양은 캐시해서 다시 써요) ─────────────────────────
const GC = new Map(), gk = (k, f) => { let g = GC.get(k); if (!g){ g = f(); GC.set(k, g); } return g; };
const cyl = (rt, rb, h, s = 7) => gk(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1));
const cylB = (rt, rb, h, s = 6) => gk(`cb${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1).translate(0, h / 2, 0));
const cone = (r, h, s = 6) => gk(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const coneB = (r, h, s = 5) => gk(`kb${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s).translate(0, h / 2, 0));
const sph = (r, w = 7, h = 5) => gk(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
const hemi = (r, w = 8, h = 3) => gk(`h${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h, 0, TAU, 0, Math.PI / 2));
const ico = (r, d = 0) => gk(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));
const oct = r => gk(`o${r}`, () => new THREE.OctahedronGeometry(r, 0));
const tor = (r, t, rs = 4, ts = 10, arc = TAU) => gk(`t${r},${t},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
const plane = (w, h) => gk(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h));
const circ = (r, s = 10) => gk(`r${r},${s}`, () => new THREE.CircleGeometry(r, s).rotateX(-Math.PI / 2));
const lathe = (key, pts, seg = 9) => gk('L' + key, () => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg));
const UB = new THREE.BoxGeometry(1, 1, 1);
const BARREL = () => lathe('barrel', [[0, 0], [0.3, 0], [0.36, 0.22], [0.38, 0.45], [0.36, 0.68], [0.3, 0.9], [0, 0.9]], 9);
const SKEP = () => lathe('skep', [[0, 0], [0.42, 0], [0.45, 0.2], [0.42, 0.45], [0.32, 0.65], [0.16, 0.78], [0, 0.82]], 9);
const POT = () => lathe('pot', [[0, 0], [0.16, 0], [0.22, 0.1], [0.24, 0.24], [0.17, 0.36], [0.19, 0.42], [0, 0.4]], 8);
const BOWL = () => lathe('bowl', [[0, 0], [0.18, 0.01], [0.28, 0.1], [0.3, 0.15], [0.26, 0.15], [0.17, 0.06], [0, 0.05]], 9);
const BELL = () => lathe('bell', [[0, 0.95], [0.14, 0.92], [0.22, 0.75], [0.28, 0.4], [0.42, 0.08], [0.45, 0], [0.38, 0.02], [0, 0.12]], 10);
const ROBE = () => lathe('robe', [[0, 0], [0.42, 0], [0.36, 0.8], [0.26, 1.35], [0.3, 1.55], [0, 1.6]], 8);
const FEMUR = () => lathe('femur', [[0, 0], [0.34, 0.03], [0.42, 0.35], [0.24, 0.75], [0.17, 1.4], [0.16, 4.4], [0.24, 5.1], [0.44, 5.55], [0.36, 6.0], [0, 6.1]], 8);
const HULL = () => gk('hull', () => new THREE.SphereGeometry(1, 9, 4, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI));
// 울퉁불퉁한 바위 (면마다 각진 그림자)
function rockG(r, sy = 0.75, det = 0){ const g = new THREE.IcosahedronGeometry(r, det), p = g.attributes.position, k = R() * 100; for (let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + 0.2 * Math.sin(x * 3.1 / r + k) * Math.cos(z * 2.7 / r + k) + 0.08 * Math.sin(y * 5 / r + k); p.setXYZ(i, x * n, y * n * sy, z * n); } g.computeVertexNormals(); return g; }
// 휘어진 관 (덩굴 · 뿌리 · 밧줄): pts [[x,y,z]…], 반지름 r0 → r1
function tubeG(pts, r0, r1 = r0 * 0.4, seg = 5){
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new V3(p[0], p[1], p[2]))), n = Math.max(4, pts.length * 3), g = new THREE.TubeGeometry(curve, n, 1, seg, false), p = g.attributes.position, nr = g.attributes.normal, cs = seg + 1;
  for (let i = 0; i <= n; i++){ const c = curve.getPointAt(i / n), r = lerp(r0, r1, i / n); for (let j = 0; j < cs; j++){ const k = i * cs + j; p.setXYZ(k, c.x + nr.getX(k) * r, c.y + nr.getY(k) * r, c.z + nr.getZ(k) * r); } }
  return g;
}
// 천 조각 (찢긴 망토 · 깃발): 흔들리고 아래가 들쭉날쭉
function clothG(w, h, rag = 0.25){ const g = new THREE.PlaneGeometry(w, h, 4, 3), p = g.attributes.position; for (let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(x * 5 + y * 3) * 0.06 + (R() - 0.5) * 0.05); if (y < -h * 0.4) p.setY(i, y + R() * h * rag); } g.computeVertexNormals(); return g; }

// ───────────────────────── 칸 (160m) · 지금 그리는 Kit ─────────────────────────
const CS = 160, CELLS = new Map(), CL = [];
let K = null, CB = null, FS = 1;
function cellAt(x, z){ const i = Math.floor(x / CS), j = Math.floor(z / CS), k = (i + 50) * 1000 + (j + 50); let c = CELLS.get(k); if (!c){ c = { x: (i + 0.5) * CS, z: (j + 0.5) * CS, b: new MB(), g: new THREE.Group(), n: 0 }; c.K = new G.Kit(c.b); c.g.name = `props_${i}_${j}`; CELLS.set(k, c); CL.push(c); } return c; }
// fn() 안에서 K = 그 칸의 Kit (절대 좌표). 실패해도 다른 소품은 살아요.
function inCell(x, z, fn, what){ const c = cellAt(x, z), pk = K, pb = CB, pf = FS; K = c.K; CB = c.b; FS = 1;
  try { fn(); c.n++; return true; } catch (e){ console.warn('[props] 소품 실패', what || '', x | 0, z | 0, e); return false; } finally { c.K.st.length = 1; K = pk; CB = pb; FS = pf; } }
const kp = (x, y, z, ry = 0, s = 1, rx = 0, rz = 0) => { K.st.push(K.top().clone().multiply(G.mat(x, y, z, rx, ry, rz, s, s, s))); };
const kq = () => { K.st.pop(); };
const bx = (key, w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => K.geo(key, UB, x, y, z, rx, ry, rz, w, h, d);
const gm = (key, g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => K.geo(key, g, x, y, z, rx, ry, rz, sx, sy, sz);
const _w = new V3();
const kw = (lx, lz, ly = 0) => _w.set(lx, ly, lz).applyMatrix4(K.top());
// 지금 틀(frame) 의 로컬 (lx, lz) 땅 높이 (로컬 단위)
const gl = (lx, lz) => { const v = kw(lx, lz); return (H(v.x, v.z) - v.y) / FS; };
// 틀 시작: 발자국 최저 높이에 앉혀요 (위쪽은 살짝 묻히고 아래쪽은 뜨지 않게)
function fr(x, z, ry = 0, s = 1, r = 1.5, sink = 0.06){ const [lo] = foot(x, z, r * s); kp(x, lo - sink, z, ry, s); FS = s; return lo - sink; }
const kYaw = () => { const e = K.top().elements; return Math.atan2(e[8], e[10]); };
// 충돌체 (로컬 좌표) — 「사라짐」 조각에 붙은 건 변화가 끝나면 빠지고, 「솟아남」 조각은 끝나야 생겨요. 숨은 줍는 물건의 것은 보일 때만.
const COLS = [], PKC = [];
function addCol(c){ if (!c) return c; STATS.colliders++;
  if (PKI >= 0){ PKC[PKI].push(c); F.removeCollider(c); return c; }
  if (ST.k && (ST.mode === 1 || ST.mode === 2)) COLS.push({ c, k: ST.k, mode: ST.mode, on: true }); return c; }
const cc = (lx, lz, r) => { const v = kw(lx, lz); addCol(F.circle(v.x, v.z, r * FS)); };
const cb = (lx, lz, hw, hd, ry = 0) => { const v = kw(lx, lz); addCol(F.box(v.x, v.z, hw * FS, hd * FS, kYaw() + ry)); };
const glw = (lx, ly, lz, col, size = 2, day = 0.3) => { const v = kw(lx, lz, ly); glowAbs(v.x, v.y, v.z, col, size * FS, day); };
// 떠다니는 빛 n 개 (로컬 중심 · 반경 r · 높이 h 안에)
function mot(type, lx, ly, lz, n, r, col, col2 = col, sz = 0.14, day = 1, h = 0){ if (LOW) n = Math.ceil(n * 0.55); for (let i = 0; i < n; i++){ const a = R() * TAU, d = Math.sqrt(R()) * r, v = kw(lx + Math.cos(a) * d, lz + Math.sin(a) * d, ly + R() * h); moteAbs(type, v.x, v.y, v.z, col, col2, sz, day); } }
// 두 로컬 점을 잇는 막대
function link(key, a, b, w = 0.08, h = w){ const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], hl = Math.hypot(dx, dz), L = Math.hypot(hl, dy); kp((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, Math.atan2(dx, dz)); bx(key, w, h, L, 0, 0, 0, -Math.atan2(dy, hl)); kq(); }
// 땅에 깔리는 불규칙한 판 (흙 · 얼룩 · 웅덩이) — 절대 좌표, 지형을 따라요
function patch(key, x, z, rx, rz, ry = 0, dy = 0.08, seg = 12, jag = 0.22){
  const c = Math.cos(ry), s = Math.sin(ry), P = [x, H(x, z) + dy, z], idx = [], rings = [0.45, 0.8, 1], J = [];
  for (let i = 0; i < seg; i++) J.push(1 + (R() - 0.5) * jag * 2);
  for (const f of rings) for (let i = 0; i < seg; i++){ const a = i / seg * TAU, lx = Math.cos(a) * rx * J[i] * f, lz = Math.sin(a) * rz * J[i] * f, px = x + lx * c + lz * s, pz = z - lx * s + lz * c; P.push(px, H(px, pz) + dy, pz); }
  for (let i = 0; i < seg; i++) idx.push(0, 1 + (i + 1) % seg, 1 + i);
  for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < seg; i++){ const a = 1 + r * seg + i, b = 1 + r * seg + (i + 1) % seg; idx.push(a, b, a + seg, b, b + seg, a + seg); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(idx); g.computeVertexNormals(); CB.add(key, g, I4);
}
// 로컬 좌표로 판 깔기
const patchL = (key, lx, lz, rx, rz, ry = 0, dy = 0.08, seg = 12, jag = 0.22) => { const v = kw(lx, lz); patch(key, v.x, v.z, rx * FS, rz * FS, kYaw() + ry, dy, seg, jag); };

// ───────────────────────── 걸을 수 있는 판 (선착장 · 밧줄 다리) ─────────────────────────
const PLAT = [];
const platY = (x, z) => { let b = -1e9; for (const p of PLAT){ if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue; const y = p.y(x, z); if (y != null && y > b) b = y; } return b; };
function platSeg(ax, az, bx2, bz, w, y0, y1 = y0){ const ex = bx2 - ax, ez = bz - az, l2 = ex * ex + ez * ez, pad = w / 2 + 0.2;
  PLAT.push({ x0: Math.min(ax, bx2) - pad, x1: Math.max(ax, bx2) + pad, z0: Math.min(az, bz) - pad, z1: Math.max(az, bz) + pad,
    y: (x, z) => { const t = ((x - ax) * ex + (z - az) * ez) / l2; if (t < -0.02 || t > 1.02) return null; const tt = clamp(t, 0, 1); return Math.hypot(x - ax - ex * tt, z - az - ez * tt) <= w / 2 ? lerp(y0, y1, tt) : null; } }); STATS.platforms++; }

// ───────────────────────── 작은 부품 (현재 K · 로컬 좌표) ─────────────────────────
const P = {
  barrel(x, y, z, s = 1){ gm('wood', BARREL(), x, y, z, 0, R() * 3, 0, s, s, s); for (const h of [0.18, 0.72]) gm('iron', tor(0.37, 0.02, 3, 12), x, y + h * s, z, Math.PI / 2, 0, 0, s, s, s); },
  crate(x, y, z, s = 0.7, ry = 0, key = 'crate'){ bx(key, s, s, s, x, y + s / 2, z, 0, ry); bx('woodD', s + 0.03, 0.07, s + 0.03, x, y + s * 0.5, z, 0, ry); },
  sack(x, y, z, ry = 0, key = 'sack'){ gm(key, sph(0.3, 7, 5), x, y + 0.24, z, 0, ry, 0, 1, 0.85, 0.75); gm('rope', cyl(0.06, 0.08, 0.1, 5), x, y + 0.48, z); },
  post(x, y, z, h, r = 0.08, key = 'woodD', rx = 0, rz = 0){ gm(key, cylB(r * 0.8, r, h, 6), x, y, z, rx, 0, rz); },
  rock(x, y, z, r, key = 'stone', sy = 0.7){ gm(key, rockG(r, sy), x, y + r * sy * 0.3, z, 0, R() * TAU, 0); },
  // 불 (불꽃 + 빛 + 불티)
  flame(x, y, z, s = 1){ gm('glowO', cone(0.28 * s, 0.75 * s, 6), x, y + 0.36 * s, z); gm('glowY', cone(0.15 * s, 0.42 * s, 5), x, y + 0.26 * s, z); glw(x, y + 0.6 * s, z, 0xff8a30, 3.8 * s, 0.75); mot(6, x, y + 0.4 * s, z, 5, 0.12, 0xffa040, 0xffa040, 0.12, 1); },
  // 돌 고리 (모닥불 · 우물 둘레)
  ring(x, z, r = 0.75, n = 9, key = 'stone'){ for (let i = 0; i < n; i++){ const a = i / n * TAU + R() * 0.3, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; gm(key, ico(rr(0.17, 0.24), 0), px, gl(px, pz) + 0.07, pz, R(), R(), R(), 1, 0.75, 1); } },
  firepit(x, z, lit = false){ const y = gl(x, z); P.ring(x, z, 0.72); patchL('ash', x, z, 0.6, 0.6, 0, 0.06, 8, 0.15); for (let i = 0; i < 3; i++){ const a = i / 3 * TAU + R(); gm(lit ? 'woodD' : 'coal', cyl(0.06, 0.07, 0.8, 5), x + Math.cos(a) * 0.15, y + 0.12, z + Math.sin(a) * 0.15, Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3); } if (lit) P.flame(x, y + 0.05, z); },
  tent(x, z, ry = 0, key = 'canvas', r = 1.8, sag = 0){ const y = gl(x, z); kp(x, y, z, ry, 1, sag * 0.2, sag * 0.15); gm(key, cone(r, r * 1.2, 6), 0, r * 0.6 - sag * 0.5, 0, 0, Math.PI / 6, 0, 1, 1 - sag * 0.45, 1); gm('dark', plane(r * 0.5, r * 0.7), 0, r * 0.32, r * 0.74, -0.32, 0, 0); P.post(0, 0, 0, r * 1.3 - sag, 0.04); kq(); },
  wheel(x, y, z, r = 0.5, ry = 0, flat = false){ kp(x, y, z, ry); if (flat){ gm('woodD', cyl(r, r, 0.09, 12), 0, 0.05, 0); gm('iron', tor(r, 0.03, 3, 12), 0, 0.06, 0, Math.PI / 2); for (let i = 0; i < 3; i++) bx('woodD', r * 1.9, 0.05, 0.06, 0, 0.1, 0, 0, i * Math.PI / 3, 0); }
    else { gm('iron', tor(r, 0.035, 3, 12), 0, 0, 0, 0, Math.PI / 2, 0); for (let i = 0; i < 3; i++) bx('woodD', 0.06, r * 1.9, 0.06, 0, 0, 0, i * Math.PI / 3, 0, 0); gm('woodD', cyl(0.1, 0.1, 0.16, 7), 0, 0, 0, 0, 0, Math.PI / 2); } kq(); },
  // 큰 가시 (밑동에서 기울어요) · 보라 끝
  thorn(x, y, z, h, r, ry = 0, lean = 0.3, tip = true){ kp(x, y, z, ry); kp(0, 0, 0, 0, 1, lean); gm('thorn', coneB(r, h, 5)); if (tip) gm('thornT', coneB(r * 0.34, h * 0.26, 4), 0, h * 0.72, 0); kq(); kq(); },
  tsprout(x, y, z, h = 0.5){ for (let i = 0; i < 3; i++){ const a = i / 3 * TAU + R(); P.thorn(x + Math.cos(a) * 0.07, y, z + Math.sin(a) * 0.07, h * rr(0.6, 1.1), h * 0.12, a, rr(0.25, 0.6)); } },
  // 가시 덩굴 (관 + 가시)
  vine(pts, r0 = 0.08, key = 'thorn', spikes = 3){ gm(key, tubeG(pts, r0, r0 * 0.35)); for (let i = 0; i < spikes; i++){ const p = pts[1 + ((R() * (pts.length - 1)) | 0)]; gm(key === 'thorn' ? 'thornT' : key, cone(r0 * 0.6, r0 * 3.5, 4), p[0] + rr(-0.05, 0.05), p[1], p[2] + rr(-0.05, 0.05), rr(-1.6, 1.6), 0, rr(-1.6, 1.6)); } },
  // 시든 줄기 · 초록 새싹 · 꽃 · 버섯
  stalk(x, y, z, h){ kp(x, y, z, R() * TAU); kp(0, 0, 0, 0, 1, rr(0.1, 0.4)); gm('dry', cylB(0.012, 0.025, h, 4)); gm('dry', sph(0.055, 4, 3), 0, h, 0.04, 0, 0, 0, 1, 0.6, 1.5); gm('dry', coneB(0.05, 0.28, 3), 0, h * 0.55, 0, 1.7, 0, 0); kq(); kq(); },
  sprout(x, y, z, s = 1){ const a = R() * TAU; gm('sprout', cylB(0.012 * s, 0.018 * s, 0.24 * s, 4), x, y, z); for (const sd of [-1, 1]) gm('leaf', oct(0.07 * s), x + Math.cos(a) * sd * 0.07 * s, y + 0.22 * s, z - Math.sin(a) * sd * 0.07 * s, 0, a, sd * 0.45, 1.6, 0.3, 0.8); },
  flower(x, y, z, key = 'flower', s = 1){ gm('grass', cylB(0.01 * s, 0.012 * s, 0.3 * s, 3), x, y, z); gm(key, oct(0.075 * s), x, y + 0.31 * s, z, R(), R(), 0, 1, 0.55, 1); },
  flowers(x, z, r, n, keys = ['flower', 'flowerY', 'flowerW', 'flowerB', 'flowerP']){ for (let i = 0; i < n; i++){ const a = R() * TAU, d = Math.sqrt(R()) * r, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; P.flower(px, gl(px, pz), pz, pick(keys), rr(0.8, 1.3)); } },
  shroom(x, y, z, s = 1, cap = 'shroomR'){ gm('shroomW', cylB(0.035 * s, 0.05 * s, 0.3 * s, 5), x, y, z); gm(cap, hemi(0.15 * s, 7, 3), x, y + 0.28 * s, z, 0, 0, 0, 1, 0.75, 1); },
  shrooms(x, z, n, cap = 'shroomR', r = 0.8){ for (let i = 0; i < n; i++){ const px = x + rr(-r, r), pz = z + rr(-r, r); P.shroom(px, gl(px, pz), pz, rr(0.6, 1.3), cap); } },
  grass(x, y, z, s = 1){ for (let i = 0; i < 4; i++) gm(pick(['grass', 'leafL', 'leaf']), coneB(0.05 * s, rr(0.35, 0.6) * s, 3), x + rr(-0.15, 0.15), y, z + rr(-0.15, 0.15), rr(-0.4, 0.4), 0, rr(-0.4, 0.4)); },
  candle(x, y, z){ gm('clothW', cylB(0.035, 0.04, 0.18, 6), x, y, z); gm('glowY', cone(0.03, 0.08, 4), x, y + 0.23, z); glw(x, y + 0.24, z, 0xffc070, 0.9, 0.5); },
  // 매달린 등불 (key: lampN 밤에 켜짐 · lampOff 꺼짐)
  lantern(x, y, z, key = 'lampN', s = 1){ bx('iron', 0.06, 0.25 * s, 0.06, x, y + 0.12 * s, z); bx(key, 0.22 * s, 0.3 * s, 0.22 * s, x, y - 0.15 * s, z); gm('iron', cone(0.2 * s, 0.14 * s, 4), x, y + 0.04 * s, z, 0, Math.PI / 4, 0); bx('iron', 0.26 * s, 0.04, 0.26 * s, x, y - 0.32 * s, z); },
  skull(x, y, z, s = 1, ry = 0, horns = false){ kp(x, y, z, ry); gm('bone', sph(0.3 * s, 7, 5), 0, 0.28 * s, 0, 0, 0, 0, 1, 0.9, 1.15); bx('bone', 0.28 * s, 0.16 * s, 0.3 * s, 0, 0.1 * s, 0.2 * s); for (const sd of [-1, 1]){ gm('dark', sph(0.07 * s, 5, 4), sd * 0.11 * s, 0.3 * s, 0.28 * s); if (horns) gm('bone', cone(0.07 * s, 0.6 * s, 5), sd * 0.32 * s, 0.4 * s, 0.05 * s, 0, 0, -sd * 1.1); } kq(); },
  bone(x, y, z, len = 0.7, ry = 0){ kp(x, y, z, ry); gm('bone', cyl(0.035, 0.035, len, 5), 0, 0.05, 0, 0, 0, Math.PI / 2); for (const sd of [-1, 1]) gm('bone', sph(0.06, 5, 4), sd * len / 2, 0.05, 0, 0, 0, 0, 1, 0.8, 1.3); kq(); },
  // 갈비뼈 아치 (반쯤 묻힘)
  ribs(x, y, z, r = 1.2, n = 5, ry = 0, gap = 0.55, key = 'bone'){ kp(x, y, z, ry); for (let i = 0; i < n; i++){ const s = 1 - Math.abs(i - (n - 1) / 2) / n * 0.6; gm(key, tor(r * s, 0.07 * (r / 1.2), 4, 9, Math.PI * 0.95), (i - (n - 1) / 2) * gap, -0.1, 0, 0, Math.PI / 2, 0); } bx(key, n * gap, 0.12 * r, 0.16 * r, 0, r * 0.98 - 0.1, 0); kq(); },
  // 사람 모양 석상 (병사 · 기사)
  figure(x, y, z, ry = 0, key = 'steel', o = {}){ kp(x, y, z, ry); for (const sd of [-1, 1]) gm(key, cylB(0.08, 0.1, 0.82, 6), sd * 0.12, 0, 0, o.walk ? sd * 0.25 : 0, 0, 0); gm(key, cyl(0.25, 0.2, 0.72, 7), 0, 1.15, 0);
    if (o.cloak) gm(o.cloak, cylB(0.27, 0.36, 0.95, 7), 0, 0.55, -0.06); for (const sd of [-1, 1]) gm(key, cyl(0.06, 0.07, 0.66, 5), sd * 0.31, 1.13, o.raise && sd > 0 ? 0.2 : 0, o.raise && sd > 0 ? -1.2 : 0, 0, sd * 0.22);
    gm(o.skin || key, sph(0.16, 7, 5), 0, 1.68, 0); gm(o.helm || key, hemi(0.19, 7, 3), 0, 1.71, 0); bx(o.helm || key, 0.04, 0.13, 0.32, 0, 1.92, 0);
    if (o.spear){ gm('woodD', cyl(0.025, 0.025, 2.5, 4), 0.36, 1.3, 0.08); gm('steel', cone(0.05, 0.26, 4), 0.36, 2.65, 0.08); }
    if (o.shield) gm(o.shield, cyl(0.3, 0.3, 0.05, 9), -0.36, 1.05, 0.12, Math.PI / 2, 0, 0.3); kq(); },
  // 깃대 + 천 (torn: 찢긴 아래)
  banner(x, y, z, h = 4, key = 'clothB', ry = 0, w = 0.9, emblem = null){ gm('woodD', cylB(0.06, 0.08, h, 6), x, y, z); gm('gold', sph(0.1, 6, 4), x, y + h + 0.05, z); kp(x, y, z, ry); bx('woodD', w + 0.2, 0.06, 0.06, w / 2, h - 0.2, 0); gm(key, clothG(w, h * 0.42, 0.3), w / 2, h - 0.25 - h * 0.21, 0.04); if (emblem) gm(emblem, oct(0.13), w / 2, h - 0.25 - h * 0.17, 0.08, 0, 0, Math.PI / 4, 1, 1, 0.3); kq(); },
  // 글자판 (나무 틀 + 아틀라스 글씨) — 앞면 +z
  board(x, y, z, ry, uv, w = 1.1, h = 0.42, key = 'wood', both = false){ kp(x, y, z, ry); bx(key, w + 0.08, h + 0.08, 0.06, 0, 0, 0); if (uv){ gm('atlas', quadUV(w, h, uv), 0, 0, 0.035); if (both) gm('atlas', quadUV(w, h, uv), 0, 0, -0.035, 0, Math.PI, 0); } kq(); },
  // 울타리 (로컬 두 점, 땅 따라)
  fence(x0, z0, x1, z1, o = {}){ const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / (o.gap || 2.2))), key = o.key || 'wood', h = o.h || 1.0, pts = [];
    for (let i = 0; i <= n; i++){ const t = i / n, x = lerp(x0, x1, t), z = lerp(z0, z1, t); if (o.broken && i > 0 && i < n && R() < 0.25){ pts.push(null); continue; } pts.push([x, gl(x, z), z]); }
    for (const p of pts) if (p) gm(o.post || key, cylB(0.07, 0.08, h + 0.25, 5), p[0], p[1] - 0.2, p[2], rr(-0.05, 0.05), 0, rr(-0.05, 0.05));
    for (let i = 0; i < n; i++){ const a = pts[i], b = pts[i + 1]; if (!a || !b) continue; for (const hh of (o.rails || [0.4, 0.8])) link(key, [a[0], a[1] + hh * h, a[2]], [b[0], b[1] + hh * h, b[2]], 0.06, 0.1); }
    if (o.col !== false){ kp((x0 + x1) / 2, 0, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0)); cb(0, 0, 0.15, L / 2); kq(); } },
  // 덤불 (가시덤불 thorny)
  bush(x, y, z, s = 1, key = 'leafD', thorny = false){ for (let i = 0; i < 4; i++) gm(i % 2 ? key : 'leaf', ico(rr(0.35, 0.55) * s, 0), x + rr(-0.4, 0.4) * s, y + rr(0.25, 0.5) * s, z + rr(-0.4, 0.4) * s, R(), R(), R(), 1, 0.8, 1);
    if (thorny) for (let i = 0; i < 4; i++){ const a = R() * TAU; P.vine([[x, y, z], [x + Math.cos(a) * 0.5 * s, y + 0.6 * s, z + Math.sin(a) * 0.5 * s], [x + Math.cos(a) * 0.9 * s, y + rr(0.3, 0.9) * s, z + Math.sin(a) * 0.9 * s]], 0.03 * s, 'thornB', 3); } },
  crow(x, y, z, ry = 0){ kp(x, y, z, ry); gm('furD', sph(0.11, 6, 4), 0, 0.1, 0, 0, 0, 0, 1, 0.9, 1.5); gm('furD', sph(0.07, 6, 4), 0, 0.2, 0.13); gm('flowerY', cone(0.025, 0.1, 4), 0, 0.2, 0.22, Math.PI / 2); bx('furD', 0.12, 0.02, 0.18, 0, 0.12, -0.2, 0.3); kq(); },
  wall(x, z, len, h, ry, key = 'ruin', broken = true){ kp(x, gl(x, z) - 0.3, z, ry); const n = Math.max(2, Math.round(len / 0.8)); for (let i = 0; i < n; i++){ const hh = broken ? h * rr(0.35, 1) : h; bx(key, len / n + 0.02, hh, 0.55, -len / 2 + (i + 0.5) * len / n, hh / 2, rr(-0.03, 0.03)); } kq(); kp(x, 0, z, ry); cb(0, 0, len / 2, 0.3); kq(); },
  column(x, z, h = 3, broken = true, key = 'ruin'){ const y = gl(x, z) - 0.2; bx(key, 1.1, 0.35, 1.1, x, y + 0.17, z); gm(key, cylB(0.36, 0.42, h, 9), x, y + 0.35, z); if (!broken) bx(key, 1.0, 0.3, 1.0, x, y + 0.5 + h, z); else gm(key, cone(0.38, 0.4, 7), x, y + 0.35 + h + 0.1, z, rr(-0.4, 0.4), 0, rr(-0.4, 0.4)); cc(x, z, 0.6); },
  fallenCol(x, z, ry, len = 3.2, key = 'ruin'){ kp(x, gl(x, z) + 0.34, z, ry); gm(key, cyl(0.38, 0.4, len, 9), 0, 0, 0, 0, 0, Math.PI / 2); kq(); kp(x, 0, z, ry); cb(0, 0, len / 2, 0.45); kq(); },
  logPile(x, z, ry){ const y = gl(x, z); kp(x, y, z, ry); for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) gm('bark', cyl(0.18, 0.18, 1.8, 7), (i - (2 - r) / 2) * 0.38, 0.18 + r * 0.32, 0, 0, 0, Math.PI / 2); kq(); },
  cart(x, z, ry, load = 'hay'){ const y = gl(x, z); kp(x, y, z, ry); bx('wood', 1.5, 0.1, 2.4, 0, 0.7, 0); for (const sd of [-1, 1]){ bx('wood', 0.08, 0.4, 2.4, sd * 0.75, 0.92, 0); P.wheel(sd * 0.85, 0.5, 0.2, 0.5, Math.PI / 2); } for (const sd of [-1, 1]) bx('woodD', 0.07, 0.07, 1.7, sd * 0.32, 0.6, 1.9, 0.18);
    if (load === 'hay') gm('hay', sph(0.75, 8, 5), 0, 1.0, 0, 0, 0, 0, 0.95, 0.5, 1.4); else if (load === 'crates'){ P.crate(-0.3, 0.75, -0.5, 0.6); P.crate(0.3, 0.75, 0.4, 0.6, 0.3); P.sack(0.2, 0.75, -0.5); } else if (load === 'ore'){ for (let i = 0; i < 7; i++) gm(i < 2 ? 'gold' : 'redrock', ico(0.22, 0), rr(-0.5, 0.5), 0.9, rr(-0.9, 0.9), R(), R(), R()); }
    kq(); kp(x, 0, z, ry); cb(0, 0, 0.9, 1.4); kq(); },
  grave(x, z, ry, cross = true, key = 'woodD'){ const y = gl(x, z); kp(x, y, z, ry); gm('soil', sph(0.6, 7, 4, 0), 0, -0.12, 0.1, 0, 0, 0, 0.9, 0.3, 1.6); if (cross){ bx(key, 0.08, 0.9, 0.08, 0, 0.45, -0.9); bx(key, 0.45, 0.08, 0.08, 0, 0.66, -0.9); } else { bx('stone', 0.5, 0.75, 0.14, 0, 0.36, -0.9, 0.05); gm('stone', cyl(0.25, 0.25, 0.14, 8), 0, 0.74, -0.9 + 0.04, Math.PI / 2 + 0.05, 0, 0); } kq(); cc(x, z, 0.5); },
};

// ═════════════════════════ 셋피스 (lore setpieces) ═════════════════════════
// SP[kind](x, z, ry, s, o) — o = { hk: 그 지역 「가시 기운」 키, item(fn): 줍는 물건 부분, note, id, region }
const SP = {};
// ── 들판 · 농사 ──
SP.blight_field = (x, z, ry, s, o) => {
  mo({ key: o.hk, c2: 'soilT' }, () => patch('blight', x, z, 4.6 * s, 3.6 * s, ry, 0.08, 14, 0.25));
  mo({ key: o.hk, mode: 1 }, () => patch('blightP', x + rr(-0.8, 0.8), z + rr(-0.8, 0.8), 2.2 * s, 1.6 * s, ry + 1, 0.11, 10, 0.4));
  fr(x, z, ry, s, 3.5, 0);
  for (let r = -1.5; r <= 1.5; r += 1) for (let c = -3.3; c <= 3.31; c += 1.1){ const lx = c + rr(-0.12, 0.12), lz = r * 1.05 + rr(-0.08, 0.08), y = gl(lx, lz);
    mo({ key: o.hk, c2: 'soilR' }, () => bx('blightR', 1.12, 0.2, 0.46, lx, y + 0.06, lz));
    mo({ key: o.hk, mode: 1 }, () => { if (R() < 0.7) P.stalk(lx + rr(-0.3, 0.3), y + 0.12, lz, rr(0.45, 0.85)); if (R() < 0.24) P.tsprout(lx + rr(-0.3, 0.3), y + 0.1, lz, rr(0.35, 0.65)); if (R() < 0.2) gm('seed', sph(0.06, 4, 3), lx, y + 0.18, lz + 0.15, 0, 0, 0, 1, 1.4, 1); });
    mo({ key: o.hk, mode: 2 }, () => { P.sprout(lx - 0.25, y + 0.12, lz, rr(0.9, 1.25)); P.sprout(lx + 0.25, y + 0.12, lz, rr(0.9, 1.25)); });
  }
  link('woodD', [3.9, gl(3.9, 2.2) + 1.1, 2.2], [3.6, gl(3.6, 2.2) - 0.1, 2.0], 0.05); bx('iron', 0.3, 0.05, 0.12, 3.58, gl(3.6, 2) + 0.02, 2.0, 0, 0.4, 0.1);   // 꽂힌 괭이
  mo({ key: o.hk, mode: 1 }, () => { glw(0, 0.5, 0, 0xa040ff, 3.0, 0.3); mot(0, 0, 0.4, 0, 6, 3, 0xb070ff, 0xb070ff, 0.12, 0); });
  kq();
};
SP.thorn_scarecrow = (x, z, ry, s, o) => { fr(x, z, ry, s, 0.8);
  P.post(0, -0.3, 0, 2.7, 0.06); bx('woodD', 1.8, 0.08, 0.08, 0, 1.75, 0); gm('sack', sph(0.27, 8, 6), 0, 2.32, 0); for (const sd of [-1, 1]) bx('dark', 0.07, 0.07, 0.03, sd * 0.1, 2.36, 0.25); bx('dark', 0.18, 0.025, 0.03, 0, 2.22, 0.26);
  gm('straw', cone(0.42, 0.42, 8), 0, 2.62, 0); gm('straw', cyl(0.52, 0.52, 0.03, 10), 0, 2.45, 0); gm('cloth', cyl(0.28, 0.42, 0.9, 7), 0, 1.45, 0); bx('cloth', 1.3, 0.24, 0.2, 0, 1.72, 0); for (const sd of [-1, 1]) gm('straw', cone(0.1, 0.25, 5), sd * 0.78, 1.72, 0, 0, 0, sd * Math.PI / 2);
  P.crow(0.72, 1.8, 0, 1.2);
  mo({ key: o.hk, mode: 1 }, () => { const pts = []; for (let i = 0; i < 8; i++) pts.push([Math.cos(i * 1.4) * 0.12, 0.05 + i * 0.3, Math.sin(i * 1.4) * 0.12]); P.vine(pts, 0.05, 'thorn', 5);
    for (const sd of [-1, 1]) P.vine([[0, 1.6, 0.1], [sd * 0.35, 1.82, -0.1], [sd * 0.7, 1.68, 0.1], [sd * 0.95, 1.8, 0]], 0.035, 'thorn', 3);
    for (let i = 0; i < 4; i++) P.tsprout(rr(-1, 1), 0.05, rr(-1, 1), rr(0.3, 0.6)); glw(0, 0.6, 0, 0xa040ff, 2.2, 0.35); });
  cc(0, 0, 0.3); kq(); };
SP.broken_cart = (x, z, ry, s, o) => { fr(x, z, ry, s, 2);
  kp(0.35, 0.8, 0, 0, 1, 0, 1.3); bx('wood', 1.6, 0.12, 2.6, 0, -0.3, 0); for (const sd of [-1, 1]){ bx('wood', 0.1, 0.5, 2.6, sd * 0.8, 0, 0); bx('wood', 1.6, 0.5, 0.1, 0, 0, sd * 1.3); } P.wheel(0.95, -0.35, 0.3, 0.5, Math.PI / 2); kq();
  P.wheel(1.5, gl(1.5, -1.6), -1.6, 0.5, 0.4, true); bx('woodD', 0.07, 0.07, 1.8, 0.5, gl(0.5, 2.2) + 0.1, 2.2, 0.05, 0.2);
  const nt = o.note || '';
  if (/광석|ore/.test(nt) || o.region === 'canyon') for (let i = 0; i < 14; i++){ const lx = rr(-2.6, -0.8), lz = rr(-1.4, 1.4); gm(i < 3 ? 'gold' : pick(['redrock', 'redrockD']), ico(rr(0.15, 0.3), 0), lx, gl(lx, lz) + 0.1, lz, R(), R(), R()); }
  else if (/털|도둑|robbed/.test(nt)) for (let i = 0; i < 3; i++){ const lx = rr(-2, -0.9), lz = rr(-1, 1); kp(lx, gl(lx, lz), lz, R() * 3, 1, 0.3, 0.5); P.crate(0, 0, 0, 0.55); kq(); bx('woodL', 0.6, 0.04, 0.12, lx + 0.5, gl(lx, lz) + 0.04, lz, 0, R() * 3, 0); }
  else { for (let i = 0; i < 3; i++){ const lx = rr(-1.8, -0.8), lz = rr(-1, 1); kp(lx, gl(lx, lz), lz, R() * 3, 1, 0, 1.1); P.sack(0, 0, 0, 0); kq(); gm('grain', sph(0.45, 7, 3), lx - 0.4, gl(lx - 0.4, lz) - 0.05, lz, 0, R(), 0, 1.3, 0.22, 1); }
    if (/씨앗|seed/.test(nt) || o.region === 'greenhill') mo({ key: o.hk, mode: 1 }, () => { for (let i = 0; i < 10; i++){ const lx = rr(-2.4, -0.9), lz = rr(-1.3, 1.3); gm('seed', sph(0.06, 4, 3), lx, gl(lx, lz) + 0.05, lz, 0, 0, 0, 1, 1.4, 1); } }); }
  P.crate(-0.6, gl(-0.6, 1.6), 1.6, 0.6, 0.7); cb(0.2, 0, 1.0, 1.4); kq(); };
SP.windmill_gear = (x, z, ry, s, o) => {
  patch('mud', x, z, 2.6 * s, 2.0 * s, ry, 0.08, 12, 0.3); fr(x, z, ry, s, 1.6, 0);
  for (const sd of [-1, 1]) patchL('mud', sd * 0.7, -3.4, 0.28, 2.4, 0, 0.07, 8, 0.15);   // 끌려간 자국
  for (let i = 0; i < 3; i++) gm('goo', sph(0.3, 7, 4), rr(-2, 2), gl(0, 0) + 0.02, rr(1.8, 2.6), 0, 0, 0, rr(0.8, 1.4), 0.25, rr(0.8, 1.2));   // 슬라임 자국
  o.item(() => { kp(0, 0.3, 0, R() * 3, 1, 0.42, 0.12);
    gm('wood', cyl(1.45, 1.45, 0.32, 14)); gm('woodD', cyl(0.32, 0.32, 0.5, 8)); for (let i = 0; i < 4; i++) bx('woodD', 2.5, 0.1, 0.22, 0, 0.17, 0, 0, i * Math.PI / 4, 0);
    for (let i = 0; i < 14; i++){ const a = i / 14 * TAU; bx('wood', 0.38, 0.3, 0.3, Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6, 0, -a, 0); } gm('iron', tor(1.2, 0.04, 3, 18), 0, 0.17, 0, Math.PI / 2); kq();
    mot(3, 0, 0.6, 0, 10, 1.5, 0xfff0b0, 0xfff0b0, 0.16, 1); });
  kq(); };
SP.black_seeds = (x, z, ry, s, o) => { if (!o.pickup && /도토리|다람쥐/.test(o.note)){ s *= 1.6; fr(x, z, ry, 1, 1); for (let i = 0; i < 10; i++) gm('acorn' in PAL ? 'acorn' : 'woodR', sph(0.07, 5, 4), rr(-0.9, 0.9), gl(0, 0) + 0.05, rr(-0.9, 0.9), 0, 0, 0, 1, 1.3, 1); kq(); }
  mo({ key: o.hk, mode: 1 }, () => patch('blight', x, z, 1.3 * s, 1.1 * s, ry, 0.08, 10, 0.35)); fr(x, z, ry, s, 0.8, 0);
  mo({ key: o.hk, mode: 1 }, () => { for (let i = 0; i < 3; i++) P.tsprout(rr(-0.9, 0.9), gl(0, 0), rr(-0.9, 0.9), rr(0.25, 0.45)); });
  o.item(() => { for (let i = 0; i < 16; i++){ const a = R() * TAU, d = Math.sqrt(R()) * 0.42; gm('seed', sph(0.075, 5, 4), Math.cos(a) * d, gl(0, 0) + 0.08 + (0.42 - d) * 0.35, Math.sin(a) * d, R(), R(), R(), 1, 1.5, 1); }
    glw(0, 0.4, 0, 0xb44aff, 2.0, 0.5); mot(3, 0, 0.3, 0, 7, 0.6, 0xd8a8ff, 0xd8a8ff, 0.14, 1); });
  kq(); };
SP.beehives = (x, z, ry, s) => { fr(x, z, ry, s, 2);
  bx('woodD', 3.4, 0.1, 0.7, 0, 0.55, 0); for (const sx of [-1.5, 1.5]) for (const sz of [-0.25, 0.25]) bx('woodD', 0.08, 0.55, 0.08, sx, 0.27, sz);
  for (let i = -1; i <= 1; i++){ gm('straw', SKEP(), i * 1.1, 0.6, 0); bx('dark', 0.16, 0.1, 0.05, i * 1.1, 0.66, 0.42); gm('honey', sph(0.05, 4, 3), i * 1.1 + 0.08, 0.64, 0.43, 0, 0, 0, 1, 1.8, 1); mot(4, i * 1.1, 0.95, 0, 4, 0.1, 0xffd040, 0xffd040, 0.08, 2); }
  for (let i = 0; i < 3; i++){ const lx = -2.2 + i * 0.35; gm('pot', POT(), lx, gl(lx, 0.6), 0.6); }
  P.flowers(0, 2.2, 2.0, 16, ['flower', 'flowerY', 'flowerW', 'flowerO']); BFLY(0, 2.2, 3); cc(0, 0, 1.7); kq(); };
SP.hay_field = (x, z, ry, s) => { patch('stub', x, z, 6.2 * s, 4.6 * s, ry, 0.07, 12, 0.2); fr(x, z, ry, s, 5, 0);
  for (let i = 0; i < 6; i++){ const lx = rr(-4.4, 4.4), lz = rr(-3, 3); kp(lx, gl(lx, lz) + 0.66, lz, R() * 3); gm('hay', cyl(0.7, 0.7, 1.2, 10), 0, 0, 0, 0, 0, Math.PI / 2); gm('stub', circ(0.6, 8), 0.61, 0, 0, 0, 0, Math.PI / 2); kq(); cc(lx, lz, 0.8); }
  { const lx = 3.6, lz = -2.6, y = gl(lx, lz); gm('hay', cylB(1.0, 1.15, 1.3, 10), lx, y, lz); gm('hay', cone(1.1, 1.0, 10), lx, y + 1.8, lz); cc(lx, lz, 1.2); link('woodD', [lx - 1.2, y + 1.6, lz], [lx - 1.7, y - 0.1, lz + 0.3], 0.05); for (let t = -1; t <= 1; t++) bx('iron', 0.025, 0.35, 0.025, lx - 1.12 + t * 0.06, y + 1.75, lz - 0.03, 0.3); }
  kq(); };
SP.picnic = (x, z, ry, s) => { fr(x, z, ry, s, 1.5);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++){ const lx = -1.1 + i * 0.44, lz = -0.66 + j * 0.44; bx((i + j) % 2 ? 'cloth' : 'clothW', 0.45, 0.03, 0.45, lx, gl(lx, lz) + 0.04, lz); }
  const y = gl(0, 0) + 0.05; gm('wicker', lathe('basket', [[0, 0], [0.3, 0.02], [0.34, 0.28], [0, 0.28]], 9), 0.6, y, 0.25); gm('wicker', tor(0.24, 0.025, 3, 10, Math.PI), 0.6, y + 0.3, 0.25);
  gm('bread', sph(0.14, 7, 4), -0.4, y + 0.08, -0.2, 0, 0.4, 0, 1.6, 0.7, 0.9); for (let i = 0; i < 4; i++) gm(pick(['fruitR', 'fruitG', 'fruitO']), sph(0.08, 6, 4), -0.1 + i * 0.13, y + 0.07, 0.36);
  gm('marble', lathe('teapot', [[0, 0], [0.13, 0], [0.16, 0.1], [0.12, 0.2], [0.04, 0.24], [0, 0.26]], 8), 0.1, y, -0.35); for (let i = 0; i < 2; i++) gm('marble', cylB(0.05, 0.04, 0.08, 7), -0.2 + i * 0.22, y, -0.5); gm('marble', cylB(0.05, 0.04, 0.08, 7), 0.9, y + 0.04, -0.3, 0, 0, Math.PI / 2 - 0.2);   // 쓰러진 컵
  bx('clothB', 0.32, 0.06, 0.24, -0.8, y + 0.03, 0.4, 0, 0.5, 0); BFLY(0, 0, 2); kq(); };
SP.lost_toy = (x, z, ry, s, o) => { fr(x, z, ry, s, 0.6, 0);
  for (let i = 0; i < 4; i++) P.grass(rr(-0.6, 0.6), gl(0, 0), rr(-0.6, 0.6), 0.8);
  o.item(() => { const nt = (o.note || '') + (o.id || ''), y = gl(0, 0);
    if (/당근|carrot/i.test(nt)){ kp(0, y + 0.13, 0, R() * 3, 1, 0, Math.PI / 2 - 0.15); gm('carrot', cone(0.13, 0.6, 7)); for (let i = 0; i < 3; i++) gm('leafL', cone(0.05, 0.32, 4), rr(-0.04, 0.04), -0.42, rr(-0.04, 0.04), Math.PI + rr(-0.4, 0.4), 0, rr(-0.4, 0.4)); for (const sd of [-1, 1]) gm('dark', sph(0.025, 4, 3), sd * 0.05, -0.08, 0.1); kq(); }
    else if (/눈 인형|snow/i.test(nt)){ kp(0, y, 0, R() * 3); gm('snow', sph(0.16, 8, 6), 0, 0.14, 0); gm('snow', sph(0.11, 8, 6), 0, 0.36, 0); gm('bark', cone(0.03, 0.09, 5), 0, 0.37, 0.12, Math.PI / 2); for (const sd of [-1, 1]){ gm('dark', sph(0.018, 4, 3), sd * 0.04, 0.41, 0.095); gm('woodD', cyl(0.01, 0.012, 0.2, 3), sd * 0.18, 0.24, 0, 0, 0, sd * 1.1); } gm('cloth', tor(0.1, 0.025, 3, 8), 0, 0.28, 0, Math.PI / 2); kq(); }
    else if (/방울|bell/i.test(nt)){ kp(0, y + 0.02, 0, R() * 3, 1, 0.5); gm('flowerY', BELL(), 0, 0, 0, 0, 0, 0, 0.32, 0.32, 0.32); gm('cloth', tor(0.12, 0.02, 3, 10), 0, 0.32, 0, 0.5); kq(); }
    else if (/인형|doll/i.test(nt)){ kp(0, y + 0.1, 0, R() * 3, 1, Math.PI / 2 - 0.3); gm('clothW', cyl(0.1, 0.13, 0.3, 7)); gm('marble', sph(0.11, 7, 5), 0, 0.24, 0); gm('cloth', hemi(0.12, 7, 3), 0, 0.27, 0); kq(); }
    else { kp(0, y, 0, R() * 3); bx('woodR', 0.4, 0.16, 0.14, 0, 0.32, 0); bx('woodR', 0.12, 0.22, 0.12, 0.18, 0.46, 0, 0, 0, -0.3); for (const a of [-0.13, 0.13]) for (const b of [-0.04, 0.04]) bx('woodD', 0.04, 0.24, 0.04, a, 0.12, b); gm('woodD', tor(0.14, 0.015, 3, 10, Math.PI), 0, 0.02, 0, 0, Math.PI / 2, 0); kq(); }
    mot(3, 0, 0.25, 0, 6, 0.5, 0xfff0b0, 0xfff0b0, 0.13, 1); });
  kq(); };
// ── 숲 ──
SP.barricade = (x, z, ry, s) => { fr(x, z, ry, s, 2.6);
  gm('bark', cyl(0.17, 0.17, 5.4, 7), 0, 0.62, 0, 0, 0, Math.PI / 2);
  for (let i = -2; i <= 2; i++) for (const sd of [-1, 1]){ kp(i * 1.1, 0.62, 0, 0, 1, sd * 0.85); gm('woodL', coneB(0.07, 1.25, 5)); gm('woodL', coneB(0.07, 1.25, 5), 0, 0, 0, Math.PI); kq(); }
  link('rope', [-2.6, 0.85, 0.05], [2.6, 0.85, 0.05], 0.03); P.board(0, 1.25, 0.25, 0, textCell(['출입 금지'], 'warn'), 1.0, 0.38); P.post(-0.4, gl(-0.4, 0.3), 0.3, 1.1, 0.04); P.post(0.4, gl(0.4, 0.3), 0.3, 1.1, 0.04);
  cb(0, 0, 2.8, 0.9); kq(); };
SP.poster_board = SP.wanted_board = (x, z, ry, s, o) => { fr(x, z, ry, s, 1.3);
  const nt = (o.kind || '') + (o.note || ''), pk = /wanted|수배|도적|현상/.test(nt) ? 'wanted' : /실종|missing|찾|리나/.test(nt) ? 'missing' : /왕|royal/.test(nt) ? 'royal' : o.region === 'canyon' ? 'wanted' : 'missing';
  for (const sd of [-1, 1]) P.post(sd * 1.05, -0.25, 0, 2.7, 0.07); bx('wood', 2.3, 1.35, 0.08, 0, 1.55, 0); bx('woodD', 2.6, 0.06, 0.6, 0, 2.38, 0, 0.22); bx('woodD', 2.4, 0.08, 0.1, 0, 0.86, 0.02);
  const uv = poster(pk); gm('atlas', quadUV(0.66, 0.66, uv), -0.55, 1.6, 0.05, 0, 0, 0.04); gm('atlas', quadUV(0.58, 0.58, uv), 0.25, 1.52, 0.05, 0, 0, -0.06);
  for (let i = 0; i < 3; i++) bx('paper', rr(0.22, 0.32), rr(0.3, 0.4), 0.01, 0.75 + rr(-0.1, 0.12), 1.4 + i * 0.22, 0.05, 0, 0, rr(-0.15, 0.15));
  cb(0, 0, 1.15, 0.18); kq(); };
SP.claw_tree = (x, z, ry, s, o) => { fr(x, z, ry, s, 1.2);
  gm('bark', cylB(0.45, 0.66, 4.3, 9), 0, -0.2, 0); for (let i = 0; i < 5; i++){ const a = i / 5 * TAU + 0.3; gm('woodL', coneB(0.16, rr(0.5, 1.1), 4), Math.cos(a) * 0.3, 4.05, Math.sin(a) * 0.3, Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); }
  for (let i = 0; i < 4; i++){ const a = i / 4 * TAU + 0.5; P.vine([[Math.cos(a) * 0.5, 0.3, Math.sin(a) * 0.5], [Math.cos(a) * 1.0, 0.1, Math.sin(a) * 1.0], [Math.cos(a) * 1.5, gl(Math.cos(a) * 1.5, Math.sin(a) * 1.5) - 0.05, Math.sin(a) * 1.5]], 0.14, 'bark', 0); }
  for (const [yy, rr0] of [[1.7, 0.56], [2.6, 0.52]]) for (let i = 0; i < 3; i++){ const a = -0.32 + i * 0.32; bx('woodL', 0.08, 0.95, 0.09, Math.sin(a) * rr0, yy + i * 0.07, Math.cos(a) * rr0, 0.08, a, -0.28); }
  for (let i = 0; i < 4; i++) gm('furG', sph(0.06, 4, 3), rr(-0.3, 0.3), rr(1.4, 2.6), 0.6, 0, 0, 0, 1.5, 0.6, 0.5);
  mo({ key: o.hk, mode: 1 }, () => { for (let i = 0; i < 3; i++) gm('thorn', cone(0.07, 0.6, 4), rr(-0.4, 0.4), rr(1.2, 3), 0.62, 1.3, 0, rr(-0.3, 0.3)); });
  for (let i = 0; i < 6; i++){ const lx = rr(-1.6, 1.6), lz = rr(0.8, 2); bx('woodL', 0.06, 0.04, rr(0.3, 0.7), lx, gl(lx, lz) + 0.03, lz, 0, R() * 3, 0); }
  cc(0, 0, 0.75); kq(); };
SP.spore_camp = (x, z, ry, s, o) => { const KEY = 'spore_clear'; fr(x, z, ry, s, 3);
  P.tent(-1.3, -0.8, 0.4, 'canvas', 1.7, 0.6); P.firepit(0.9, 0.4, false); gm('clothB', cyl(0.24, 0.24, 1.7, 7), 0.4, gl(0.4, -1.8) + 0.22, -1.8, 0, 0.3, Math.PI / 2);
  { const y = gl(1.6, -0.6); gm('iron', lathe('cpot', [[0, 0], [0.2, 0.02], [0.27, 0.18], [0.24, 0.32], [0, 0.3]], 8), 1.6, y, -0.6); for (let i = 0; i < 3; i++){ const a = i / 3 * TAU; link('woodD', [1.6 + Math.cos(a) * 0.45, y, -0.6 + Math.sin(a) * 0.45], [1.6, y + 1.0, -0.6], 0.04); } }
  P.barrel(-2.6, gl(-2.6, 0.9), 0.9, 0.9); P.crate(2.4, gl(2.4, 1.2), 1.2, 0.6, 0.4);
  mo({ key: KEY, mode: 1 }, () => {   // 포자 솜털 · 버섯 · 안개
    for (const [lx, lz, r] of [[-1.3, -0.8, 1.2], [0.4, -1.8, 0.6], [-2.6, 0.9, 0.5], [2.4, 1.2, 0.45], [1.6, -0.6, 0.35]]) gm('spore', sph(r, 7, 4), lx, gl(lx, lz) + r * 0.45, lz, 0, R(), 0, 1.1, 0.75, 1.1);
    for (let i = 0; i < 7; i++){ const lx = rr(-3, 3), lz = rr(-2.6, 2.6); P.shrooms(lx, lz, 3, 'sporeG', 0.4); }
    mot(0, 0, 0.6, 0, 34, 3.6, 0xc8a8ff, 0xc8a8ff, 0.22, 1, 2.2); glw(0, 1.0, 0, 0xc070ff, 3.4, 0.6); });
  mo({ key: KEY, mode: 2 }, () => { for (let i = 0; i < 5; i++) patchL('moss', rr(-2.5, 2.5), rr(-2, 2), rr(0.4, 0.8), rr(0.3, 0.6), R() * 3, 0.08, 8, 0.3); P.shrooms(2.6, -1.6, 4, 'shroomR', 0.5); });
  cc(-1.3, -0.8, 1.5); kq(); };
SP.torn_cloak = (x, z, ry, s, o) => { fr(x, z, ry, s, 1.2);
  const nt = o.note || '', ck = /초록|녹색|green/.test(nt) ? 'clothG' : /파란|푸른|blue/.test(nt) ? 'clothB' : /보라/.test(nt) ? 'clothP' : 'cloth';
  P.bush(0, gl(0, 0), 0, 1.1, /검은 가시|가시덤불/.test(nt) ? 'thorn' : 'leafD', true);
  for (let i = 0; i < 6; i++){ const lz = 1.1 + i * 0.55, lx = (i % 2 ? 0.12 : -0.12) + i * 0.06; patchL('mud', lx, lz, 0.07, 0.13, 0.1, 0.05, 7, 0.1); }
  o.item(() => { gm(ck, clothG(0.9, 0.6, 0.35), 0.35, gl(0, 0) + 0.85, 0.45, 0.35, 0.5, 0.25); gm(ck, clothG(0.35, 0.25, 0.4), -0.4, gl(0, 0) + 0.55, 0.5, 0.2, -0.4, -0.2); mot(3, 0.3, 0.8, 0.4, 7, 0.5, 0xffd0c0, 0xffd0c0, 0.13, 1);
    if (/망원경/.test(nt)){ kp(0.5, gl(0.5, 0.9) + 0.06, 0.9, 0.7, 1, 0, Math.PI / 2); gm('bronze', cyl(0.035, 0.05, 0.42, 7)); gm('gold', tor(0.05, 0.012, 3, 8), 0, 0.12, 0, Math.PI / 2); kq(); } });
  cc(0, 0, 0.95); kq(); };
SP.footprints = (x, z, ry, s, o) => { fr(x, z, ry, s, 0.6, 0);
  for (let i = 0; i < 14; i++){ const lz = (i - 7) * 0.6, lx = (i % 2 ? 0.14 : -0.14) + Math.sin(i * 0.5) * 0.3; patchL('mud', lx, lz, 0.075, 0.15, 0.08 * (i % 2 ? 1 : -1), 0.06, 7, 0.08); patchL('mud', lx, lz + 0.2, 0.06, 0.05, 0, 0.06, 6, 0.08); }
  { const y = gl(0.6, 4.8); gm('cloth', clothG(0.36, 0.08, 0), 0.6, y + 0.05, 4.8, -Math.PI / 2, 0.6, 0); }   // 떨어진 머리끈
  for (let i = 0; i < 5; i++){ const lx = rr(-0.6, 0.6), lz = rr(-4, 4); bx('woodD', 0.03, 0.03, rr(0.2, 0.4), lx, gl(lx, lz) + 0.03, lz, 0, R() * 3, 0); }   // 부러진 잔가지
  kq(); };
SP.spirit_lights = (x, z, ry, s, o) => { const KEY = 'spirit_lights'; fr(x, z, ry, s, 2.6);
  for (let i = 0; i < 3; i++){ const a = i / 3 * TAU + 0.4, lx = Math.cos(a) * 1.8, lz = Math.sin(a) * 1.8, y = gl(lx, lz); P.rock(lx, y - 0.1, lz, rr(0.45, 0.65), 'mossy', 1.0); mo({ key: KEY, e2: 2.6 }, () => gm('spiritD', tor(0.2, 0.025, 3, 10), lx, y + 0.42, lz + 0.01, 0, a, 0)); }
  { const y = gl(0, 0); gm('bark', cylB(0.3, 0.36, 0.95, 8), 0, y - 0.05, 0); gm('moss', hemi(0.33, 8, 3), 0, y + 0.88, 0, 0, 0, 0, 1, 0.4, 1); mo({ key: KEY, e2: 2.4 }, () => { for (const sd of [-1, 1]) gm('spiritD', sph(0.06, 5, 4), sd * 0.1, y + 0.6, 0.3); }); }
  P.shrooms(0.9, -1.1, 4, 'shroomW', 0.4);
  mo({ key: KEY }, () => mot(5, 0, 0.5, 0, 32, 3.2, 0x7affd0, 0xc8fff0, 0.2, 1, 1.6));
  mo({ key: KEY, mode: 1 }, () => glw(0, 1.0, 0, 0x5affd8, 2.0, 0.35)); mo({ key: KEY, mode: 2 }, () => glw(0, 1.4, 0, 0x8affe0, 5.0, 0.7));
  kq(); };
SP.rope_bridge = (x, z, ry, s) => { const L = 10 * s, dx = Math.sin(ry), dz = Math.cos(ry), ax = x - dx * L / 2, az = z - dz * L / 2, bx2 = x + dx * L / 2, bz = z + dz * L / 2, ya = H(ax, az) + 0.4, yb = H(bx2, bz) + 0.4;
  const yAt = t => { const px = lerp(ax, bx2, t), pz = lerp(az, bz, t); return Math.max(lerp(ya, yb, t) - Math.sin(t * Math.PI) * 0.6, H(px, pz) + 0.25); };
  kp(0, 0, 0); const n = Math.round(L / 0.42);
  for (let i = 0; i <= n; i++){ const t = i / n, px = lerp(ax, bx2, t), pz = lerp(az, bz, t); bx('plank', 1.3, 0.06, 0.3, px, yAt(t), pz, 0, ry, rr(-0.04, 0.04)); }
  for (const [px, pz, yy] of [[ax, az, ya], [bx2, bz, yb]]) for (const sd of [-1, 1]){ const qx = px + dz * sd * 0.75, qz = pz - dx * sd * 0.75; P.post(qx, H(qx, qz) - 0.3, qz, yy - H(qx, qz) + 1.5, 0.08); cc(qx, qz, 0.15); }
  for (const sd of [-1, 1]) for (const hh of [0, 1.0]){ for (let i = 0; i < 8; i++){ const t0 = i / 8, t1 = (i + 1) / 8; link('rope', [lerp(ax, bx2, t0) + dz * sd * 0.72, yAt(t0) + hh + (hh ? 0.05 : 0.02), lerp(az, bz, t0) - dx * sd * 0.72], [lerp(ax, bx2, t1) + dz * sd * 0.72, yAt(t1) + hh + (hh ? 0.05 : 0.02), lerp(az, bz, t1) - dx * sd * 0.72], 0.035); } }
  for (let i = 0; i < 8; i++){ const t0 = i / 8, t1 = (i + 1) / 8; platSeg(lerp(ax, bx2, t0), lerp(az, bz, t0), lerp(ax, bx2, t1), lerp(az, bz, t1), 1.3, yAt(t0) + 0.04, yAt(t1) + 0.04); }
  kq(); };
SP.hunter_blind = (x, z, ry, s) => { fr(x, z, ry, s, 1.6);
  for (const sx of [-0.95, 0.95]) for (const sz of [-0.95, 0.95]){ P.post(sx, gl(sx, sz) - 0.2, sz, 3.0 - gl(sx, sz), 0.09, 'bark'); }
  bx('plank', 2.3, 0.1, 2.3, 0, 2.7, 0); for (const sd of [-1, 1]){ bx('wood', 2.3, 0.65, 0.06, 0, 3.05, sd * 1.12); bx('wood', 0.06, 0.65, 2.3, sd * 1.12, 3.05, 0); }
  for (let i = 0; i < 12; i++){ const a = i / 12 * TAU; gm(pick(['leafD', 'leaf']), ico(0.32, 0), Math.cos(a) * 1.15, 3.35, Math.sin(a) * 1.15, R(), R(), R(), 1, 0.7, 1); }
  for (const sd of [-1, 1]) bx('leafD', 2.6, 0.08, 1.4, 0, 4.0, sd * 0.6, sd * 0.45);
  for (const sd of [-1, 1]) link('wood', [sd * 0.3, gl(sd * 0.3, 2.2), 2.2], [sd * 0.3, 2.75, 1.15], 0.06); for (let i = 1; i < 7; i++){ const t = i / 7; bx('wood', 0.62, 0.05, 0.05, 0, lerp(gl(0, 2.2), 2.75, t), lerp(2.2, 1.15, t)); }
  cb(0, 0, 1.15, 1.15); kq(); };
// ── 물가 ──
SP.sunken_boat = (x, z, ry, s, o) => { const wl = WY(x, z), g = H(x, z), wet = g < wl - 0.2, yc = wet ? Math.max(g + 0.25, wl - 0.25) : g + 0.3, dir = waterDir(x, z, ry);
  const flip = /뒤집|엎어/.test(o.note || ''); kp(x, flip ? (wet ? wl + 0.12 : g + 0.4) : yc, z, dir + 0.4, s, flip ? 0.08 : 0.22, flip ? Math.PI - 0.12 : 0.35); gm('wood', HULL(), 0, 0, 0, 0, 0, 0, 0.85, 0.48, 2.0); for (const sd of [-1, 1]) bx('woodD', 1.5, 0.06, 0.24, 0, -0.06, sd * 0.6); bx('woodD', 0.1, 0.1, 3.9, 0, -0.44, 0); P.post(0, -0.3, 0.3, 1.2, 0.06); kq();
  kp(x, 0, z, dir, s); { const ox = 1.6, oz = 1.0, wy2 = Math.max(wl, H(x + ox, z + oz)) + 0.03; bx('wood', 0.1, 0.04, 1.8, ox, wy2, oz, 0, 0.6); bx('wood', 0.22, 0.03, 0.5, ox + 0.45, wy2, oz + 0.7, 0, 0.6); }
  for (let i = 0; i < 3; i++) bx('plank', 0.25, 0.04, rr(0.6, 1.1), rr(-2.5, 2.5), Math.max(wl, H(x, z)) + 0.02, rr(-2.5, 2.5), 0, R() * 3, 0); kq();
  if (!wet) cc(x, z, 1.1 * s); };
SP.memorial = (x, z, ry, s) => { fr(x, z, ry, s, 1.2);
  bx('stoneD', 1.9, 0.3, 1.1, 0, 0.15, 0); bx('stone', 1.25, 1.75, 0.32, 0, 1.15, 0); gm('stone', cyl(0.625, 0.625, 0.32, 12), 0, 2.0, 0, Math.PI / 2, 0, 0);
  gm('atlas', quadUV(0.95, 0.95, poster('memorial')), 0, 1.25, 0.17);
  kp(0, 0.55, 0.42, 0, 1, -0.35); gm('leafD', tor(0.28, 0.06, 4, 12)); for (let i = 0; i < 8; i++){ const a = i / 8 * TAU; gm(i % 2 ? 'flowerW' : 'flowerB', oct(0.06), Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0.05); } kq();
  for (const sd of [-1, 1]){ P.candle(sd * 0.68, 0.3, 0.38); P.candle(sd * 0.5, 0.3, 0.42); } for (let i = 0; i < 5; i++) P.flower(rr(-0.9, 0.9), gl(0, 0.8), rr(0.7, 1.0), pick(['flowerW', 'flowerB', 'flowerY']));
  cb(0, 0, 0.95, 0.55); kq(); };
// 선착장: 정착지 안이면 짧게 (towns 판자길이 셋피스 둘레 ~7m 를 비켜 가요)
SP.dock = (x, z, ry, s, o) => { const dir = waterDir(x, z, ry), dx = Math.sin(dir), dz = Math.cos(dir), L = (nearSettle(x, z, 0) ? 6.2 : 9) * s, dy = Math.max(WY(x, z) + 0.55, H(x, z) + 0.35);
  kp(x, 0, z, dir); const n = Math.round(L / 0.36);
  for (let i = 0; i <= n; i++){ const lz = i * L / n; bx('plank', 1.9, 0.07, 0.32, rr(-0.03, 0.03), dy, lz, 0, rr(-0.03, 0.03), 0); }
  for (let i = 0; i <= Math.floor(L / 1.8); i++){ const lz = i * 1.8 + 0.2; for (const sd of [-1, 1]){ const v = kw(sd * 0.9, lz), gy = H(v.x, v.z); P.post(sd * 0.9, gy - 0.3, lz, dy - gy + 0.35 + (i === 0 || i === Math.floor(L / 1.8) ? 0.5 : 0), 0.1); } }
  for (const sd of [-1, 1]) bx('woodD', 0.12, 0.12, L, sd * 0.9, dy - 0.12, L / 2);
  { const v = kw(0.6, L - 0.3), gy = H(v.x, v.z); P.post(0.6, gy - 0.3, L - 0.3, dy - gy + 2.5, 0.06); bx('woodD', 0.5, 0.05, 0.05, 0.85, dy + 2.1, L - 0.3); P.lantern(1.05, dy + 2.0, L - 0.3); glw(1.05, dy + 1.8, L - 0.3, 0xffb860, 2.6, 0.3); }
  gm('rope', tor(0.22, 0.05, 3, 10), -0.5, dy + 0.06, L * 0.6, Math.PI / 2); P.barrel(0.45, dy + 0.04, 1.2, 0.8);
  if (!/배가 없|텅/.test(o.note || '')){ const wy2 = WY(x + dx * L * 0.7, z + dz * L * 0.7); kp(1.8, wy2 - 0.05, L * 0.7, 0.1); gm('wood', HULL(), 0, 0, 0, 0, 0, 0, 0.7, 0.4, 1.7); bx('woodD', 1.2, 0.05, 0.22, 0, -0.05, 0.3); kq(); link('rope', [0.9, dy, L * 0.62], [1.7, wy2 + 0.1, L * 0.7 - 1.3], 0.025); }
  kq(); platSeg(x - dx * 0.2, z - dz * 0.2, x + dx * L, z + dz * L, 1.9, dy + 0.04); };
SP.fishing_racks = (x, z, ry, s, o) => { fr(x, z, ry, s, 2.2); const fk = /텅 빈|비었|empty/.test(o.note) ? (noteKey(o) || 'lake_clear') : null, fish = f => fk ? mo({ key: fk, mode: 2 }, f) : f();
  for (const lz of [-0.9, 0.9]){ for (const sd of [-1, 1]){ link('woodD', [sd * 1.6 - 0.35, gl(sd * 1.6 - 0.35, lz), lz], [sd * 1.6, 1.9, lz], 0.06); link('woodD', [sd * 1.6 + 0.35, gl(sd * 1.6 + 0.35, lz), lz], [sd * 1.6, 1.9, lz], 0.06); }
    bx('woodD', 3.5, 0.06, 0.06, 0, 1.85, lz); for (let i = 0; i < 7; i++){ const lx = -1.35 + i * 0.45; link('rope', [lx, 1.85, lz], [lx, 1.6, lz], 0.015); fish(() => { kp(lx, 1.32, lz, 0, 1, 0, 0); gm(i % 3 ? 'fish' : 'fishD', sph(0.12, 6, 4), 0, 0, 0, 0, 0, 0, 0.45, 1.9, 0.9); gm('fishD', cone(0.09, 0.14, 4), 0, -0.27, 0, Math.PI); kq(); }); } }
  gm('wicker', lathe('fbask', [[0, 0], [0.32, 0], [0.38, 0.4], [0, 0.4]], 9), 2.3, gl(2.3, 0.3), 0.3); fish(() => gm('fish', sph(0.12, 6, 4), 2.3, gl(2.3, 0.3) + 0.42, 0.3, 0, 0.5, Math.PI / 2, 0.45, 1.6, 0.9));
  cb(0, 0, 1.9, 1.2); kq(); };
SP.dark_spring = (x, z, ry, s, o) => { const RK = o.region === 'lake' ? 'lake_clear' : (noteKey(o) || o.hk), KEY = o.ik ? (o.link = RK, o.ik) : RK, wl = WY(x, z), wet = isW(x, z);
  if (!wet){ mo({ key: KEY, mode: 1 }, () => { patch('ink', x, z, 4.4 * s, 3.4 * s, ry, 0.07, 14, 0.4); for (let i = 0; i < 5; i++){ const a = R() * TAU; patch('ink', x + Math.cos(a) * 3.6 * s, z + Math.sin(a) * 3.6 * s, 0.35 * s, 1.6 * s, -a + Math.PI / 2, 0.07, 6, 0.3); } }); }
  fr(x, z, ry, s, 1.8, 0); const y0 = wet ? (wl - H(x, z)) / FS + 0.1 : gl(0, 0);
  for (let i = 0; i < 9; i++){ const a = i / 9 * TAU + R() * 0.3, r = rr(1.3, 1.6), lx = Math.cos(a) * r, lz = Math.sin(a) * r; P.rock(lx, Math.max(gl(lx, lz), wet ? y0 - 0.5 : -9), lz, rr(0.35, 0.6), 'mossy', 0.9); }
  P.rock(-0.3, y0 - 0.2, -0.5, 0.75, 'darkst', 1.3); P.rock(0.5, y0 - 0.2, -0.7, 0.55, 'darkst', 1.4);
  if (!wet) mo({ key: KEY, c2: 'waterB' }, () => gm('waterD', circ(1.25, 14), 0, y0 + 0.04, 0));
  else mo({ key: KEY, mode: 1 }, () => patch('ink', x, z, 3.2 * s, 2.6 * s, ry, wl - H(x, z) + 0.03, 12, 0.35));
  mo({ key: KEY, mode: 1 }, () => { for (let i = 0; i < 4; i++){ const a = R() * TAU; P.vine([[Math.cos(a) * 0.3, y0 - 0.2, Math.sin(a) * 0.3 - 0.4], [Math.cos(a) * 0.7, y0 + 0.5, Math.sin(a) * 0.7 - 0.3], [Math.cos(a) * 1.2, y0 + 0.2, Math.sin(a) * 1.2]], 0.07, 'thorn', 2); }
    for (let i = 0; i < 2; i++){ const a = R() * TAU; kp(Math.cos(a) * 1.9, Math.max(gl(Math.cos(a) * 1.9, Math.sin(a) * 1.9), y0) + 0.06, Math.sin(a) * 1.9, R() * 3); gm('fishD', sph(0.13, 6, 4), 0, 0, 0, 0, 0, Math.PI / 2, 0.45, 1, 1.8); gm('fishD', cone(0.1, 0.16, 4), 0, 0, -0.3, -Math.PI / 2); kq(); }
    mot(1, 0, y0 + 0.1, -0.2, 26, 0.35, 0x2a1838, 0x2a1838, 0.24, 1); glw(0, y0 + 0.6, 0, 0x8a40ff, 3.2, 0.4); });
  mo({ key: KEY, mode: 2 }, () => { mot(1, 0, y0 + 0.1, -0.2, 26, 0.35, 0xc8f0ff, 0xc8f0ff, 0.2, 1); glw(0, y0 + 0.6, 0, 0x6ad8ff, 3.0, 0.45);
    for (let i = 0; i < 16; i++){ const a = i / 16 * TAU, lx = Math.cos(a) * 2.2, lz = Math.sin(a) * 2.2; if (wet) gm('leaf', circ(0.3, 7), lx, y0 - 0.05, lz, 0, R() * 3, 0); else P.flower(lx, gl(lx, lz), lz, pick(['flowerW', 'flowerB', 'flowerY', 'flower']), 1.2); } });
  o.mark(0, y0 + 0.9, 0); if (!wet) cc(0, 0, 1.3); kq(); };
SP.lighthouse_log = (x, z, ry, s) => { fr(x, z, ry, s, 1.2);
  bx('wood', 1.3, 0.07, 0.75, 0, 0.78, 0); for (const sx of [-0.55, 0.55]) for (const sz of [-0.3, 0.3]) bx('woodD', 0.07, 0.78, 0.07, sx, 0.39, sz);
  kp(0, 0.83, 0.05, 0.2); for (const sd of [-1, 1]) bx('paper', 0.34, 0.025, 0.46, sd * 0.18, 0.02, 0, 0, 0, sd * -0.06); bx('woodR', 0.74, 0.02, 0.5, 0, 0, 0); kq();
  gm('glass' in PAL ? 'glass' : 'lampN', cylB(0.08, 0.1, 0.22, 7), -0.45, 0.82, -0.15); gm('iron', cone(0.1, 0.1, 7), -0.45, 1.1, -0.15); glw(-0.45, 0.95, -0.15, 0xffc070, 1.8, 0.4);
  gm('dark', cylB(0.04, 0.05, 0.08, 6), 0.45, 0.82, -0.2); link('clothW', [0.44, 0.9, -0.2], [0.5, 1.15, -0.1], 0.015);
  gm('wood', cylB(0.2, 0.22, 0.45, 7), 0, gl(0, -0.9), -0.9); P.crate(-1.1, gl(-1.1, 0.2), 0.2, 0.55, 0.4); P.barrel(1.05, gl(1.05, 0.3), 0.3, 0.75);
  cb(0, 0, 0.7, 0.45); kq(); };
SP.nets = (x, z, ry, s) => { const wet = isW(x, z), dir = waterDir(x, z, ry); fr(x, z, dir + Math.PI / 2, s, 2);
  const yb = wet ? 0 : 0, top = (wet ? WY(x, z) - H(x, z) : 0) / FS + 2.0;
  for (const sd of [-1, 1]) P.post(sd * 1.7, gl(sd * 1.7, 0) - 0.3, 0, top - gl(sd * 1.7, 0) + 0.3, 0.07);
  bx('rope', 3.5, 0.03, 0.03, 0, top - 0.05, 0); for (let i = 0; i < 8; i++){ const lx = -1.5 + i * 0.43; link('rope', [lx, top - 0.05, 0], [lx + 0.1, top - 1.35 - Math.sin(i * 0.4) * 0.15, 0.05], 0.015); } for (let j = 1; j < 5; j++) link('rope', [-1.5, top - 0.05 - j * 0.3, 0.02], [1.6, top - 0.1 - j * 0.3, 0.02], 0.015);
  for (let i = 0; i < 6; i++) gm('flowerO', sph(0.08, 5, 4), -1.5 + i * 0.62, top - 1.4, 0.06);
  if (!wet){ gm('rope', ico(0.6, 0), -0.6, gl(-0.6, 1.2) + 0.1, 1.2, 0, 0, 0, 1.3, 0.3, 1); P.barrel(1.2, gl(1.2, 1.1), 1.1, 0.85); gm('wicker', lathe('fbask', [[0, 0], [0.32, 0], [0.38, 0.4], [0, 0.4]], 9), 0.2, gl(0.2, 1.5), 1.5); }
  else for (let i = 0; i < 7; i++) gm('flowerO', sph(0.1, 5, 4), rr(-3, 3), (WY(x, z) - H(x, z)) / FS + 0.04, rr(1, 3));
  if (!wet) cb(0, 0, 1.8, 0.2); kq(); };
// ── 늪 ──
SP.drowned_house = (x, z, ry, s, o) => { const wl = WY(x, z), g = H(x, z), base = isW(x, z) ? Math.min(g + 0.3, wl - 1.1) : g - 0.6;
  kp(x, base, z, ry, s, 0.16, -0.12);
  bx('plank', 4.2, 3.2, 3.4, 0, 1.6, 0); for (const sd of [-1, 1]) bx('roof2' in PAL ? 'roof2' : 'woodR', 4.6, 0.12, 2.25, 0, 3.75, sd * 0.95, sd * 0.68); bx('plank', 4.0, 1.5, 0.12, 0, 3.4, 0);
  bx('woodD', 0.25, 0.12, 0.25, 0, 3.2, 0); bx('stoneD', 0.5, 1.6, 0.5, 1.4, 4.0, -0.6); for (const sd of [-1, 1]) bx('dark', 0.7, 0.6, 0.08, sd * 1.1, 2.1, 1.72); bx('woodD', 0.9, 1.7, 0.08, 0, 1.45, 1.74, 0, 0.5, 0);
  for (const sd of [-1, 1]) for (const sz of [-1, 1]) bx('woodD', 0.2, 3.4, 0.2, sd * 2.05, 1.6, sz * 1.65);
  if (isW(x, z)) mo({ key: noteKey(o) || o.hk, mode: 2 }, () => bx('wet', 4.26, 0.22, 3.46, 0, (wl - base) / s - 0.05, 0)); kq();
  kp(x, 0, z, ry, s); for (let i = 0; i < 4; i++) bx('plank', 0.3, 0.05, rr(0.8, 1.4), rr(-4, 4), Math.max(wl, g) + 0.02, rr(2.4, 4.5), 0, R() * 3, 0); for (let i = 0; i < 6; i++){ const a = R() * TAU, d = rr(3, 5); gm('leaf', circ(0.35, 7), Math.cos(a) * d, Math.max(wl, H(x + Math.cos(a) * d, z + Math.sin(a) * d)) + 0.03, Math.sin(a) * d, 0, R() * 3, 0); } kq();
  kp(x, 0, z, ry); cb(0, 0, 2.1 * s, 1.7 * s); kq(); };
SP.shrine = (x, z, ry, s, o) => { fr(x, z, ry, s, 1.3);
  bx('mossy', 1.8, 0.35, 1.4, 0, 0.17, 0); bx('stone', 1.2, 1.3, 1.0, 0, 0.95, -0.1); bx('dark', 0.75, 0.95, 0.1, 0, 0.98, 0.42); for (const sd of [-1, 1]) bx('stoneD', 1.6, 0.12, 0.9, 0, 1.75, sd * 0.3 - 0.1, sd * 0.5);
  gm('marble', ROBE(), 0, 0.62, 0.25, 0, 0, 0, 0.32, 0.4, 0.32); gm('marble', sph(0.07, 6, 4), 0, 1.3, 0.25); gm('glowC', oct(0.07), 0, 1.0, 0.36, 0, 0, 0, 0.8, 1.3, 0.5); glw(0, 1.05, 0.4, 0x6ad8ff, 1.8, 0.45);
  for (const sd of [-1, 1]){ gm('marble', BOWL(), sd * 0.55, 0.35, 0.55); gm(sd > 0 ? 'fruitR' : 'flowerW', sph(0.07, 5, 4), sd * 0.55, 0.45, 0.55); P.candle(sd * 0.3, 0.35, 0.62); }
  for (let i = 0; i < 6; i++) P.flower(rr(-1.1, 1.1), gl(0, 1.1), rr(0.9, 1.3), pick(['flowerW', 'flowerB', 'flowerP']));
  cb(0, 0, 0.95, 0.75); kq(); };
SP.offering = (x, z, ry, s, o) => { const wet = isW(x, z), nt = o.note || '';
  const item = (lx, ly, lz) => {   // 봉헌물 하나 (로컬)
    if (/추|clapper/.test(nt)){ kp(lx, ly + 0.12, lz, R() * 3, 1, 0, Math.PI / 2 - 0.2); gm('iron', lathe('clap', [[0, 0], [0.05, 0], [0.05, 0.5], [0.13, 0.6], [0.14, 0.72], [0.08, 0.82], [0, 0.84]], 8), 0, -0.4, 0); gm('iron', tor(0.06, 0.02, 3, 8), 0, -0.45, 0); kq(); }
    else if (/등잔|lamp|shell|조개/.test(nt)){ kp(lx, ly, lz, R() * 3); gm('flowerW', hemi(0.16, 9, 2), 0, 0.02, 0, 0, 0, 0, 1, 0.5, 0.9); for (let i = 0; i < 5; i++) bx('boneD', 0.02, 0.03, 0.15, Math.sin(-0.8 + i * 0.4) * 0.08, 0.07, Math.cos(-0.8 + i * 0.4) * 0.08, 0, -0.8 + i * 0.4, 0); gm('glowY', cone(0.03, 0.09, 4), 0, 0.13, 0); glw(0, 0.15, 0, 0xffc070, 1.2, 0.6); kq(); }
    else if (/꿀|honey/.test(nt)){ gm('leaf', circ(0.3, 9), lx, ly + 0.01, lz); gm('honey', POT(), lx, ly + 0.02, lz, 0, 0, 0, 0.8, 0.8, 0.8); gm('leafL', cone(0.1, 0.12, 6), lx, ly + 0.38, lz); }
    else if (/컵|cup/.test(nt)){ for (let i = 0; i < 5; i++) gm(pick(['clothW', 'pot', 'stone']), cylB(0.06, 0.045, 0.1, 7), lx - 0.4 + i * 0.2, ly, lz + rr(-0.08, 0.08)); }
    else { gm('marble', BOWL(), lx, ly, lz); gm(pick(['fruitR', 'fruitO', 'bread']), sph(0.08, 5, 4), lx, ly + 0.1, lz); }
    if (/초승달|crescent/.test(nt)) gm('gold', tor(0.08, 0.018, 3, 8, Math.PI * 1.3), lx, ly + 0.12, lz + 0.31, 0, 0, 0.6);
  };
  if (wet){ const wl = WY(x, z); kp(x, wl + 0.03, z, ry, s); FS = s;
    if (o.pickup){ gm('leaf', circ(0.45, 10), 0, 0, 0); gm('leafD', circ(0.38, 8), 0.5, -0.005, 0.3); item(0, 0.03, 0); gm('flowerP', oct(0.08), -0.25, 0.06, -0.2); }
    else { for (let i = 0; i < 5; i++) bx('plank', 0.24, 0.07, 1.1, -0.5 + i * 0.25, 0, 0); bx('woodD', 1.3, 0.06, 0.08, 0, 0.06, 0.4); bx('woodD', 1.3, 0.06, 0.08, 0, 0.06, -0.4); for (let i = 0; i < 4; i++) P.candle(rr(-0.45, 0.45), 0.06, rr(-0.4, 0.4)); for (let i = 0; i < 6; i++) gm(pick(['flowerW', 'flowerP', 'flowerY']), oct(0.07), rr(-0.5, 0.5), 0.1, rr(-0.45, 0.45)); item(0, 0.06, 0); }
    kq(); return; }
  fr(x, z, ry, s, 1);
  if (o.pickup){ bx('mossy', 0.7, 0.18, 0.55, 0, 0.09, 0); item(0, 0.18, 0); P.candle(0.28, 0.18, 0.18); for (let i = 0; i < 3; i++) P.flower(rr(-0.5, 0.5), gl(0, 0.5), rr(0.4, 0.6), pick(['flowerW', 'flowerP'])); kq(); return; }
  bx('mossy', 1.4, 0.45, 0.9, 0, 0.22, 0); if (/컵|cup/.test(nt)) item(0, 0.45, 0); else for (let i = 0; i < 3; i++){ gm('marble', BOWL(), -0.45 + i * 0.45, 0.45, 0); gm(pick(['fruitR', 'fruitO', 'bread']), sph(0.08, 5, 4), -0.45 + i * 0.45, 0.55, 0); }
  for (let i = 0; i < 4; i++) P.candle(rr(-0.6, 0.6), 0.45, rr(0.25, 0.4)); kp(0, 0.47, -0.3, 0, 1, Math.PI / 2 - 0.2); gm('leafD', tor(0.32, 0.04, 3, 12)); kq();
  for (let i = 0; i < 5; i++) P.flower(rr(-0.9, 0.9), gl(0, 0.8), rr(0.6, 0.9), pick(['flowerW', 'flowerP']));
  cb(0, 0, 0.75, 0.5); kq(); };
SP.temple_pillar = (x, z, ry, s) => { fr(x, z, ry, s, 2);
  for (const [lx, lz, h, br] of [[-1.3, 0, 4.4, false], [1.3, 0.2, 2.8, true]]){ const y = gl(lx, lz) - 0.3; bx('mossy', 1.2, 0.4, 1.2, lx, y + 0.2, lz); gm('stone', cylB(0.4, 0.46, h, 10), lx, y + 0.4, lz); for (let k = 1; k < 4; k++) gm('glowC' in PAL && k === 2 ? 'mossy' : 'stoneD', tor(0.43, 0.04, 3, 12), lx, y + 0.4 + h * k / 4, lz, Math.PI / 2);
    if (!br){ bx('stone', 1.1, 0.35, 1.1, lx, y + 0.55 + h, lz); gm('stone', tor(0.3, 0.08, 3, 10, Math.PI), lx, y + 0.95 + h, lz, 0, 0, 0); } else gm('stone', cone(0.42, 0.5, 8), lx, y + 0.4 + h + 0.15, lz, 0.4, 0, 0.3); cc(lx, lz, 0.6); }
  P.fallenCol(0.4, 2.0, 0.3, 3.4, 'stone'); for (let i = 0; i < 5; i++) P.rock(rr(-2, 2), gl(0, 0), rr(-1.5, 2.5), rr(0.2, 0.4), 'mossy');
  for (let i = 0; i < 3; i++) P.vine([[-1.3 + rr(-0.4, 0.4), 0, rr(-0.4, 0.4)], [-1.3 + rr(-0.5, 0.5), 1.6, 0.45], [-1.3 + rr(-0.4, 0.4), 3.2, 0.4]], 0.04, 'leafD', 0);
  kq(); };
SP.lantern_post = (x, z, ry, s) => { const KEY = 'swamp_lanterns', g = H(x, z), top = Math.max(g, WY(x, z)) + 2.7;
  kp(x, g - 0.3, z, ry, s); const h = (top - g + 0.3) / s; gm('woodD', cylB(0.07, 0.11, h, 6), 0, 0, 0, 0.06, 0, 0.05); bx('woodD', 0.7, 0.07, 0.07, 0.3, h - 0.15, 0.06, 0, 0, -0.15); link('rope', [0.6, h - 0.1, 0.06], [0.6, h - 0.45, 0.06], 0.02);
  mo({ key: KEY, c2: 'lampG' }, () => P.lantern(0.6, h - 0.45, 0.06, 'lampOff')); mo({ key: KEY, mode: 2 }, () => glw(0.6, h - 0.62, 0.06, 0x9aff70, 3.0, 0.5)); mo({ key: KEY, mode: 1 }, () => glw(0.6, h - 0.62, 0.06, 0x9aff70, 0.8, 0.15));
  for (let i = 0; i < 3; i++) gm('rope', tor(0.09, 0.02, 3, 8), 0, h * 0.3 + i * 0.12, 0, Math.PI / 2); gm('cloth', clothG(0.2, 0.5, 0.5), 0.1, h - 0.6, 0.1, 0, 0.3, 0);
  kq(); if (!isW(x, z)) cc(x, z, 0.2); };
SP.bog_bones = (x, z, ry, s) => { patch('mud', x, z, 3.6 * s, 2.6 * s, ry, 0.08, 12, 0.3); fr(x, z, ry, s, 2.5, 0);
  P.ribs(0, gl(0, 0) - 0.5, 0, 1.3, 6, 0, 0.5, 'boneD'); kp(2.2, gl(2.2, 0.3) + 0.1, 0.3, -0.3); P.skull(0, 0, 0, 1.6, 0, true); kq();
  for (let i = 0; i < 4; i++) P.bone(rr(-2.5, 2.5), gl(0, 0) + 0.02, rr(-2, 2), rr(0.6, 1), R() * 3); for (let i = 0; i < 3; i++) P.grass(rr(-3, 3), gl(0, 0), rr(-2.4, 2.4), 1.2);
  cb(0, 0, 1.6, 1.3); kq(); };
// ── 협곡 ──
SP.mine_rails = (x, z, ry, s, o) => { fr(x, z, ry, s, 1.5, 0); const mk = noteKey(o), cart = (lz, full) => { const y = gl(0, lz); kp(0, y + 0.25, lz, 0); gm('rust', lathe('mcart', [[0, 0], [0.75, 0], [0.95, 0.85], [0, 0.85]], 4), 0, 0.15, 0, 0, Math.PI / 4, 0, 1, 1, 1.3); for (const sd of [-1, 1]) for (const sz of [-0.5, 0.5]) gm('iron', cyl(0.18, 0.18, 0.08, 8), sd * 0.62, 0.05, sz, 0, 0, Math.PI / 2); if (full) for (let i = 0; i < 6; i++) gm(i < 1 ? 'gold' : 'redrock', ico(0.22, 0), rr(-0.3, 0.3), 1.05, rr(-0.5, 0.5), R(), R(), R()); kq(); };
  for (let i = 0; i < 12; i++){ const lz = -4.4 + i * 0.8, y = gl(0, lz); bx('woodD', 1.7, 0.1, 0.24, 0, y + 0.05, lz); } for (let i = 0; i < 11; i++){ const z0 = -4.4 + i * 0.8, z1 = z0 + 0.8; for (const sd of [-1, 1]) link('iron', [sd * 0.55, gl(0, z0) + 0.16, z0], [sd * 0.55, gl(0, z1) + 0.16, z1], 0.07, 0.1); }
  if (mk){ mo({ key: mk, mode: 1 }, () => cart(1.2, /빈|텅/.test(o.note) ? false : true)); mo({ key: mk, mode: 2 }, () => cart(-3.4, true)); } else cart(1.2, true);
  { const y = gl(0, 4.6); bx('woodD', 1.6, 0.5, 0.25, 0, y + 0.3, 4.6); for (const sd of [-1, 1]) bx('woodD', 0.2, 0.7, 0.2, sd * 0.7, y + 0.3, 4.75); }
  P.post(1.3, gl(1.3, -2), -2, 2.4, 0.06); bx('woodD', 0.5, 0.05, 0.05, 1.1, gl(1.3, -2) + 2.25, -2); P.lantern(0.9, gl(1.3, -2) + 2.2, -2); glw(0.9, gl(1.3, -2) + 2.0, -2, 0xffb860, 2.4, 0.3);
  cb(0, 1.2, 0.8, 1.1); kq(); };
SP.collapsed_tunnel = (x, z, ry, s, o) => { fr(x, z, ry, s, 2.6);
  bx('dark', 2.8, 3.0, 1.6, 0, 1.3, -1.2); for (const [lx, lz, r] of [[-2.2, -1.4, 1.6], [2.3, -1.2, 1.5], [0, -2.2, 2.0]]) P.rock(lx, gl(lx, lz) - 0.3, lz, r, 'redrock', 1.1);
  P.post(-1.4, gl(-1.4, -0.3) - 0.2, -0.3, 3.1, 0.13, 'wood'); kp(1.25, gl(1.25, -0.3), -0.3, 0, 1, 0.1, -0.5); gm('wood', cylB(0.11, 0.13, 3.0, 6)); kq(); link('wood', [-1.6, 2.9, -0.3], [1.8, 2.1, -0.4], 0.24);
  for (let i = 0; i < 10; i++){ const lx = rr(-1.4, 1.4), lz = rr(-0.8, 0.6); P.rock(lx, gl(lx, lz) + rr(0, 0.9), lz, rr(0.3, 0.6), pick(['redrock', 'redrockD'])); }
  P.board(-2.1, gl(-2.1, 1.0) + 1.1, 1.0, 0.3, textCell(['붕괴 위험'], 'warn'), 0.95, 0.36); P.post(-2.1, gl(-2.1, 1.0), 0.95, 1.0, 0.04);
  link('woodD', [1.6, gl(1.6, 1.2) + 0.05, 1.2], [2.4, gl(2.4, 1.0) + 0.6, 1.0], 0.04); bx('iron', 0.5, 0.06, 0.08, 2.45, gl(2.4, 1.0) + 0.62, 1.0, 0, 0.2, 0.4);
  P.wheel(0.9, gl(0.9, 1.6), 1.6, 0.45, 0.6, true); if (/따뜻|바람/.test(o.note || '')) mot(0, 0, 1.0, 0.3, 12, 1.4, 0xffa060, 0xffa060, 0.12, 1, 1.5); cb(0, -1.2, 2.6, 1.4); kq(); };
SP.bandit_camp = (x, z, ry, s, o) => { fr(x, z, ry, s, 3.4);
  for (const [lx, lz, a] of [[-2.2, -1.4, 0.6], [2.0, -1.8, -0.5]]){ const y = gl(lx, lz); kp(lx, y, lz, a); for (let i = 0; i < 6; i++) gm(i % 2 ? 'furD' : 'furG', cone(1.7, 2.0, 6), 0, 1.0, 0, 0, 0, 0, 1 - i * 0.002, 1, 1 - i * 0.002); gm('dark', plane(0.8, 1.2), 0, 0.6, 1.05, -0.4, 0, 0); kq(); cc(lx, lz, 1.6); }
  P.firepit(0, 0.6, true); for (let i = 0; i < 2; i++) P.fallenCol(-1.6 + i * 3.2, 1.2, 1.4, 1.4, 'bark');
  for (let i = 0; i < 5; i++){ const lx = rr(1.6, 3), lz = rr(0.6, 2); P.crate(lx, gl(lx, lz), lz, rr(0.5, 0.7), R()); } for (let i = 0; i < 3; i++) P.sack(rr(1.5, 2.6), gl(2, 2.4), rr(2.2, 2.8), R() * 3);
  if (/도시락/.test(o.note)) for (let i = 0; i < 9; i++){ const lx = 2.6 + rr(-0.6, 0.6), lz = 1.4 + rr(-0.6, 0.6), y = gl(lx, lz) + (i > 5 ? 0.22 : 0); bx(pick(['cloth', 'clothB', 'clothY', 'clothG']), 0.34, 0.2, 0.26, lx, y + 0.1, lz, 0, R() * 3, 0); gm('cloth', oct(0.06), lx, y + 0.22, lz); }
  else { for (let i = 0; i < 8; i++) gm(i < 3 ? 'gold' : 'redrock', ico(0.16, 0), 2.6 + rr(-0.5, 0.5), gl(2.6, 1.4) + 0.08, 1.4 + rr(-0.5, 0.5), R(), R(), R()); for (let i = 0; i < 10; i++) gm('gold', cyl(0.06, 0.06, 0.02, 7), rr(1.8, 3.2), gl(2.4, 1.6) + 0.02, rr(1, 2.2)); }
  { const y = gl(-3.2, 1.0); gm('woodD', cylB(0.05, 0.07, 3.6, 5), -3.2, y, 1.0); for (let i = 0; i < 5; i++) bx(i % 2 ? 'furD' : 'furG', 0.24, 0.26, 0.24, -3.2, y + 3.0 - i * 0.26, 1.24, 0, 0, 0); }   // 너구리 꼬리 깃발
  kq(); };
SP.titan_bone = (x, z, ry, s, o) => { fr(x, z, ry, s, 2.2); const nt = o.note || '';
  if (/투구|helm/.test(nt)){ kp(0, gl(0, 0) - 0.3, 0, 0.4, 1, 0.5, 0.3); gm('rust', hemi(1.6, 12, 5), 0, 0, 0, 0, 0, 0, 1, 1.1, 1.15); gm('bronze', tor(1.6, 0.12, 4, 14), 0, 0.02, 0, Math.PI / 2, 0, 0, 1, 1.15, 1); bx('rust', 0.35, 0.9, 2.8, 0, 1.75, 0); bx('dark', 1.6, 0.25, 0.1, 0, 0.75, 1.72); kq();
    for (let i = 0; i < 12; i++) gm('woodR', sph(0.14, 5, 3), rr(-2.4, 2.4), gl(0, 0) + 0.06, rr(-2.4, 2.4), 0, R() * 3, 0, 1.6, 0.35, 0.8); }
  else if (/창|spear|손가락/.test(nt)){ kp(0, gl(0, 0) - 0.5, 0, 0, 1, 0.45, -0.2); gm('woodD', cylB(0.32, 0.36, 7.5, 9)); gm('iron', tor(0.36, 0.06, 3, 10), 0, 6.8, 0, Math.PI / 2); gm('woodL', coneB(0.34, 0.6, 7), 0, 7.4, 0, 0.3, 0, 0.2); kq();
    for (let i = 0; i < 3; i++){ kp(1.4 + i * 0.7, gl(1.4 + i * 0.7, 1.2), 1.2, 0.3 + i * 0.2); for (let k = 0; k < 3; k++) link('bone', [0, 0.25 + Math.sin(k * 0.9) * 0.4, k * 0.75], [0, 0.25 + Math.sin((k + 1) * 0.9) * 0.4, (k + 1) * 0.75], 0.28, 0.28); kq(); } }
  else { kp(0, gl(0, 0) - 0.8, 0, 0, 1, 0.55, 0.15); gm('bone', FEMUR(), 0, 0, 0, 0, 0, 0, 1.4, 1.2, 1.4); kq(); }
  patchL('redrockD', 0, 0, 2.4, 2.0, 0, 0.07, 12, 0.35);
  for (let i = 0; i < 5; i++){ const a = R() * TAU; P.rock(Math.cos(a) * rr(1.6, 2.6), gl(0, 0), Math.sin(a) * rr(1.6, 2.6), rr(0.3, 0.6), 'redrock'); } for (let i = 0; i < 3; i++) P.bone(rr(-2.5, 2.5), gl(0, 0) + 0.02, rr(-2.5, 2.5), rr(0.8, 1.4), R() * 3);
  cc(0, 0.6, 0.8); kq(); };
SP.ore_pile = (x, z, ry, s, o) => { fr(x, z, ry, s, 2);
  P.rock(0, gl(0, 0) - 0.4, 0, 1.6, 'redrock', 0.65); o.gone(() => { for (let i = 0; i < 9; i++){ const a = R() * TAU, d = rr(0.4, 1.3); gm(i % 3 ? 'gold' : 'crystalP', oct(rr(0.14, 0.26)), Math.cos(a) * d, gl(0, 0) + rr(0.3, 0.8), Math.sin(a) * d, R(), R(), R(), 0.8, 1.5, 0.8); }
  glw(0, 1.1, 0, 0xffb040, 2.6, 0.3); }); o.mark(0, gl(0, 0) + 1.3, 0);
  { const y = gl(1.9, 1.0); kp(1.9, y, 1.0, 0.6); bx('rust', 0.7, 0.35, 0.9, 0, 0.45, 0, 0.12); P.wheel(0, 0.2, 0.55, 0.2, Math.PI / 2); for (const sd of [-1, 1]) link('woodD', [sd * 0.25, 0.4, -0.4], [sd * 0.3, 0.55, -1.2], 0.04); kq(); }
  for (let i = 0; i < 2; i++){ const lx = -1.5 - i * 0.3, lz = 1.2; link('woodD', [lx, gl(lx, lz) + 0.02, lz], [lx + 0.3, gl(lx, lz) + 0.05, lz - 0.9], 0.04); bx('iron', 0.6, 0.05, 0.08, lx + 0.32, gl(lx, lz) + 0.06, lz - 0.95, 0, 0.4, 0); }
  cc(0, 0, 1.5); kq(); };
SP.water_tower = (x, z, ry, s) => { fr(x, z, ry, s, 1.8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]){ P.post(sx * 1.1, gl(sx * 1.1, sz * 1.1) - 0.3, sz * 1.1, 5.6 - gl(sx * 1.1, sz * 1.1), 0.1); }
  for (const sd of [-1, 1]){ link('woodD', [-1.1, 1, sd * 1.1], [1.1, 4, sd * 1.1], 0.06); link('woodD', [sd * 1.1, 1, -1.1], [sd * 1.1, 4, 1.1], 0.06); }
  bx('plank', 2.8, 0.12, 2.8, 0, 5.2, 0); gm('wood', cylB(1.3, 1.3, 2.2, 12), 0, 5.26, 0); for (const h of [5.6, 6.5, 7.2]) gm('iron', tor(1.32, 0.03, 3, 14), 0, h, 0, Math.PI / 2); gm('woodD', cone(1.5, 0.9, 12), 0, 7.9, 0);
  gm('iron', cylB(0.07, 0.07, 1.3, 6), 1.3, 4.0, 0.5); gm('iron', cyl(0.07, 0.07, 0.6, 6), 1.3, 5.3, 0.25, Math.PI / 2); mot(2, 1.3, 3.9, 0.5, 6, 0.05, 0x9ad8ff, 0x9ad8ff, 0.08, 1); patchL('wet', 1.3, 0.5, 0.6, 0.5, 0, 0.07, 8, 0.3);
  for (let i = 0; i < 8; i++) bx('wood', 0.5, 0.05, 0.05, -0.95, 0.4 + i * 0.6, 1.25); for (const sd of [-1, 1]) bx('wood', 0.05, 5.2, 0.05, -0.95 + sd * 0.25, 2.6, 1.25);
  cb(0, 0, 1.25, 1.25); kq(); };
SP.dynamite_crate = (x, z, ry, s, o) => { fr(x, z, ry, s, 1.3);
  P.crate(-0.5, 0, 0, 0.75, 0.2); P.crate(0.4, 0, 0.3, 0.7, -0.3); P.crate(-0.4, 0.75, 0.05, 0.6, 0.5);
  { const y = gl(0.6, -0.8); bx('crate', 0.8, 0.4, 0.55, 0.6, y + 0.2, -0.8); for (let i = 0; i < 6; i++) gm('red', cyl(0.05, 0.05, 0.5, 6), 0.4 + (i % 3) * 0.13, y + 0.42 + ((i / 3) | 0) * 0.08, -0.8, 0, 0.2, Math.PI / 2); }
  { const y = gl(1.5, 0.6); bx('woodR', 0.35, 0.3, 0.3, 1.5, y + 0.15, 0.6); bx('iron', 0.04, 0.4, 0.04, 1.5, y + 0.5, 0.6); bx('iron', 0.25, 0.05, 0.05, 1.5, y + 0.7, 0.6); P.vine([[1.5, y + 0.1, 0.6], [1.1, gl(1, 1) + 0.03, 1.2], [0, gl(0, 1.3) + 0.03, 1.3], [-0.5, 0.2, 0.4]], 0.015, 'red', 0); }
  P.board(-1.3, gl(-1.3, 0.7) + 1.05, 0.7, 0.4, textCell(['위험! 폭약'], 'warn'), 0.95, 0.36); P.post(-1.3, gl(-1.3, 0.7), 0.65, 0.95, 0.04);
  if (/쪽지|note/.test(o.note || '')) bx('paper', 0.28, 0.2, 0.01, -0.5, 0.45, 0.39, 0, 0.2, 0.08);
  cb(0, 0, 0.95, 0.65); kq(); };
// ── 고원 ──
SP.excavation = (x, z, ry, s, o) => { patch('soilD', x, z, 3.0 * s, 2.2 * s, ry, 0.06, 10, 0.12); fr(x, z, ry, s, 3, 0);
  for (const [lx, lz] of [[-3, -2.3], [3, -2.3], [3, 2.3], [-3, 2.3]]) P.post(lx, gl(lx, lz) - 0.2, lz, 0.9, 0.035, 'woodL');
  for (let i = 0; i < 4; i++){ const a = [[-3, -2.3], [3, -2.3], [3, 2.3], [-3, 2.3]][i], b = [[3, -2.3], [3, 2.3], [-3, 2.3], [-3, -2.3]][i]; link('red', [a[0], gl(a[0], a[1]) + 0.6, a[1]], [b[0], gl(b[0], b[1]) + 0.6, b[1]], 0.012); }
  for (let i = 1; i < 3; i++) link('red', [-3 + i * 2, gl(0, -2.3) + 0.58, -2.3], [-3 + i * 2, gl(0, 2.3) + 0.58, 2.3], 0.01);
  for (const [lx, lz, r] of [[4.2, 0.5, 1.0], [-4.1, -0.6, 0.8], [0.5, 3.6, 0.9]]) gm('soil', sph(r, 8, 4, 0), lx, gl(lx, lz) - r * 0.4, lz, 0, 0, 0, 1.3, 0.55, 1);
  kp(-0.6, gl(-0.6, 0.2) - 0.25, 0.2, 0.8, 1, 0, Math.PI / 2 - 0.3); gm('ruin', sph(0.5, 8, 6)); bx('ruin', 0.36, 0.1, 0.1, 0, 0.2, 0.42); kq(); gm('gold', oct(0.1), 0.9, gl(0.9, -0.6) + 0.06, -0.6, 0.4, 0, 0.3, 1, 0.6, 1); glw(0.9, gl(0.9, -0.6) + 0.2, -0.6, 0xffe070, 1.2, 0.5);
  gm('rust', lathe('bucket', [[0, 0], [0.2, 0], [0.24, 0.35], [0, 0.35]], 8), 2.2, gl(2.2, -1.2), -1.2); link('woodD', [3.6, gl(3.6, -1.4) + 1.2, -1.4], [3.4, gl(3.4, -1.4) - 0.2, -1.3], 0.04); bx('iron', 0.25, 0.32, 0.03, 3.38, gl(3.4, -1.4) - 0.1, -1.3);
  for (const sd of [-1, 1]) link('wood', [sd * 0.25 - 1.8, gl(-1.8, 1.6) - 0.3, 1.6], [sd * 0.25 - 1.8, gl(-1.8, 2.6) + 1.6, 2.6], 0.05);
  if (/기중기|crane/.test(o.note || '')){ const y = gl(-4.6, 2.6) + 0.2; for (const sd of [-1, 1]) link('woodD', [-6.8, y, 2.6 + sd * 0.9], [-3.2, y + 0.4, 2.6], 0.14); link('woodD', [-3.4, y + 0.3, 2.6], [-1.0, gl(-1, 4) + 0.2, 4.0], 0.12); link('rope', [-1.0, gl(-1, 4) + 0.2, 4.0], [0.2, gl(0.2, 4.6) + 0.05, 4.6], 0.03); P.wheel(-3.6, y + 0.1, 2.0, 0.55, 0.2, true); }
  kq(); };
SP.royal_banner = (x, z, ry, s) => { fr(x, z, ry, s, 0.9);
  bx('ruin', 1.0, 0.5, 1.0, 0, 0.25, 0); bx('ruin', 0.7, 0.3, 0.7, 0, 0.65, 0); P.banner(0, 0.75, 0, 5.6, 'clothB', 0, 1.3, 'gold'); kp(0, 0, 0); bx('clothY', 0.08, 2.0, 0.02, 0.06, 4.2, 0.07); kq();
  for (let i = 0; i < 4; i++) P.rock(rr(-1.3, 1.3), gl(0, 0), rr(-1.3, 1.3), rr(0.15, 0.3), 'ruin'); cc(0, 0, 0.6); kq(); };
SP.fallen_armor = (x, z, ry, s, o) => { fr(x, z, ry, s, 1.4, 0); const y = gl(0, 0);
  kp(-0.6, y + 0.18, 0.2, 0.4, 1, 0, 1.4); gm('rust', hemi(0.22, 8, 3)); bx('rust', 0.05, 0.1, 0.42, 0, 0.18, 0); kq();
  kp(0.5, y + 0.12, -0.2, -0.3, 1, -Math.PI / 2 + 0.15); gm('steel', lathe('cuirass', [[0, 0], [0.3, 0], [0.34, 0.3], [0.28, 0.55], [0, 0.6]], 8), 0, 0, 0, 0, 0, 0, 1, 1, 0.55); kq();
  kp(0.3, y + 0.05, 0.8, 0, 1, -Math.PI / 2 + 0.1); gm('clothB', cyl(0.4, 0.4, 0.05, 10)); gm('gold', oct(0.12), 0, 0.04, 0, 0, 0, Math.PI / 4, 1, 0.3, 1); kq();
  kp(-0.9, y, -0.7, 0.4, 1, 0.25); bx('steel', 0.06, 1.1, 0.02, 0, 0.55, 0); bx('bronze', 0.32, 0.06, 0.06, 0, 0.75, 0); bx('bronze', 0.06, 0.25, 0.06, 0, 0.9, 0); kq();
  gm('clothB', clothG(1.0, 0.7, 0.3), 0.9, y + 0.04, 0.5, -Math.PI / 2, 0.7, 0);
  if (o.pickup || /인장|함|seal/.test(o.note)){ o.gone(() => { kp(0.95, y, -0.55, 0.5); bx('woodR', 0.34, 0.2, 0.24, 0, 0.1, 0); bx('gold', 0.36, 0.04, 0.26, 0, 0.18, 0); bx('gold', 0.06, 0.08, 0.02, 0, 0.12, 0.125); kq(); }); o.mark(0.95, y + 0.3, -0.55); }
  kq(); };
SP.statue_broken = (x, z, ry, s) => { fr(x, z, ry, s, 1.5);
  bx('ruin', 1.6, 0.9, 1.6, 0, 0.45, 0); bx('ruin', 1.8, 0.15, 1.8, 0, 0.92, 0); for (const sd of [-1, 1]) gm('marble', cylB(0.16, 0.2, 1.0, 7), sd * 0.2, 1.0, 0); gm('marble', cyl(0.3, 0.33, 0.25, 8), 0, 2.0, 0, 0.1, 0, 0.12);
  kp(1.8, gl(1.8, 0.4) + 0.32, 0.4, 0.5, 1, 0, Math.PI / 2 - 0.05); gm('marble', ROBE(), 0, -0.8, 0, 0, 0, 0, 0.7, 1.0, 0.7); kq();
  kp(-1.6, gl(-1.6, 1.0) + 0.3, 1.0, 1.2, 1, 0.3, 0.9); gm('marble', sph(0.32, 8, 6)); gm('gold', cyl(0.24, 0.3, 0.2, 8, 1), 0, 0.3, 0); kq();
  link('marble', [-0.6, gl(-0.6, -1.3) + 0.12, -1.3], [0.4, gl(0.4, -1.6) + 0.12, -1.6], 0.14); for (let i = 0; i < 5; i++) P.rock(rr(-1.8, 1.8), gl(0, 0), rr(-1.8, 1.8), rr(0.12, 0.25), 'marble');
  cb(0, 0, 0.85, 0.85); kq(); };
SP.royal_tomb = (x, z, ry, s) => { fr(x, z, ry, s, 2.8);
  for (let i = 0; i < 3; i++) bx('ruin', 4.6 - i * 0.4, 0.25, 1.0 - i * 0.25, 0, 0.12 + i * 0.25, 2.1 - i * 0.2); bx('ruin', 4.2, 0.4, 3.0, 0, 0.7, 0);
  bx('stone', 3.4, 3.2, 2.6, 0, 2.5, -0.3); for (const sd of [-1, 1]) gm('marble', cylB(0.26, 0.3, 3.1, 9), sd * 1.5, 0.9, 1.2); bx('marble', 4.0, 0.35, 0.7, 0, 4.15, 1.1);
  gm('stone', new THREE.CylinderGeometry(0.01, 2.3, 1.0, 3, 1).rotateX(Math.PI / 2).rotateZ(Math.PI), 0, 4.75, 0.6, 0, 0, Math.PI, 1, 0.9, 2.3);
  bx('stoneD', 1.5, 2.2, 0.15, 0, 2.0, 1.02); bx('gold', 0.5, 0.25, 0.04, 0, 2.55, 1.1); for (let i = -1; i <= 1; i++) gm('gold', cone(0.06, 0.18, 4), i * 0.17, 2.75, 1.1);
  gm('atlas', quadUV(0.9, 0.9, poster('royal')), 1.5, 2.1, 1.48); for (const sd of [-1, 1]) P.candle(sd * 0.9, 1.0, 1.4);
  cb(0, -0.3, 2.1, 1.6); kq(); };
SP.golem_wreck = (x, z, ry, s, o) => { fr(x, z, ry, s, 2);
  kp(0, gl(0, 0) + 0.5, 0, 0.3, 1, 0.4, 0.2); bx('mossy', 1.8, 1.4, 1.2); bx('darkst', 0.6, 0.6, 0.2, 0, 0.1, 0.62);
  if (o.pickup){ o.gone(() => { gm('glowC', oct(0.24), 0, 0.12, 0.74, 0, 0.4, 0, 0.9, 1.2, 0.6); glw(0, 0.15, 0.9, 0x6ae6ff, 2.2, 0.6); }); o.mark(0, 0.2, 1.0); } kq();
  kp(1.6, gl(1.6, 1.1) + 0.35, 1.1, -0.5, 1, 0, 1.4); bx('mossy', 0.8, 0.75, 0.75); mo({ key: o.hk, c2: 'stoneD', e2: 0 }, () => { for (const sd of [-1, 1]) bx('glowC', 0.12, 0.1, 0.05, sd * 0.18, 0.1, 0.39); }); kq();
  for (const [lx, lz, a] of [[-1.7, 0.6, 0.6], [0.6, -1.9, 2.0]]){ kp(lx, gl(lx, lz) + 0.3, lz, a, 1, 0, Math.PI / 2); gm('mossy', cyl(0.3, 0.36, 1.6, 7)); kq(); }
  for (let i = 0; i < 7; i++) P.rock(rr(-2.5, 2.5), gl(0, 0), rr(-2.5, 2.5), rr(0.2, 0.45), pick(['mossy', 'darkst']));
  for (let i = 0; i < 3; i++) gm('glowC', bx ? oct(0.06) : oct(0.06), rr(-1.5, 1.5), gl(0, 0) + 0.1, rr(-1.5, 1.5)); cb(0, 0, 1.1, 0.8); kq(); };
SP.star_dial = (x, z, ry, s, o) => { fr(x, z, ry, s, 1.4);
  bx('ruin', 1.6, 0.3, 1.6, 0, 0.15, 0); gm('ruin', cylB(0.32, 0.42, 0.9, 8), 0, 0.3, 0); gm('stoneD', cyl(0.9, 0.9, 0.14, 16), 0, 1.25, 0, 0.18, 0, 0);
  for (let i = 0; i < (/일곱/.test(o.note || '') ? 7 : 9); i++){ const a = R() * TAU, d = rr(0.15, 0.8); gm('glowY', oct(0.045), Math.cos(a) * d, 1.33 + Math.sin(a) * d * 0.18, Math.sin(a) * d * 0.98); }
  kp(0, 1.95, 0, 0.3); gm('bronze', tor(0.6, 0.025, 3, 18)); gm('bronze', tor(0.6, 0.025, 3, 18), 0, 0, 0, Math.PI / 2); gm('bronze', tor(0.55, 0.02, 3, 18), 0, 0, 0, 0.4, 0, Math.PI / 2); gm('gold', sph(0.08, 6, 4)); kq();
  gm('bronze', cyl(0.02, 0.02, 1.0, 4), 0, 1.75, 0, 0.5, 0, 0); glw(0, 1.4, 0, 0xffe070, 1.6, 0.6); cc(0, 0, 0.9); kq(); };
SP.ruined_street = (x, z, ry, s, o) => { fr(x, z, ry, s, 3, 0);
  for (let i = 0; i < 7; i++) for (let j = 0; j < 3; j++){ if (R() < 0.18) continue; const lx = -1.2 + j * 1.2 + rr(-0.05, 0.05), lz = -4.8 + i * 1.6; bx(pick(['cobble', 'stone', 'ruin']), 1.1, 0.12, 1.5, lx, gl(lx, lz) + 0.03, lz, rr(-0.04, 0.04), rr(-0.08, 0.08), rr(-0.04, 0.04)); }
  for (const sd of [-1, 1]){ P.wall(sd * 3.2, -2.5, 3.5, 2.4, Math.PI / 2, 'ruin'); P.wall(sd * 3.2, 2.6, 3.0, 1.6, Math.PI / 2, 'plaster' in PAL ? 'plaster' : 'ruin'); }
  kp(-2.2, gl(-2.2, 0.6) + 0.12, 0.6, 0.3, 1, 0, Math.PI / 2); gm('iron', cyl(0.06, 0.08, 2.8, 6)); kq(); P.wheel(2.0, gl(2.0, -0.4), -0.4, 0.45, 0.5, true);
  for (let i = 0; i < 6; i++) P.rock(rr(-2.6, 2.6), gl(0, 0), rr(-4.5, 4.5), rr(0.15, 0.35), 'ruin');
  if (/포고/.test(o.note || '')){ const y = gl(2.2, 3.8); kp(2.2, y, 3.8, -Math.PI / 2 + 0.2); bx('ruin', 1.1, 1.5, 0.22, 0, 0.75, 0); gm('ruin', cyl(0.55, 0.55, 0.22, 10), 0, 1.5, 0, Math.PI / 2); gm('atlas', quadUV(0.8, 0.8, poster('royal')), 0, 0.95, 0.115); kq(); cc(2.2, 3.8, 0.6); }
  kq(); };
// ── 침식지 ──
SP.corrupted_house = (x, z, ry, s, o) => { fr(x, z, ry, s, 2.6);
  bx('darkst', 4.0, 2.6, 3.2, 0, 1.3, 0); bx('dark', 0.9, 1.6, 0.06, -0.8, 0.8, 1.62); for (const sd of [-1, 1]) bx('dark', 0.6, 0.5, 0.06, sd * 1.2 + 0.4, 1.7, 1.62);
  kp(0, 2.6, 0, 0, 1, 0, 0.1); for (const sd of [-1, 1]) bx('woodD', 4.4, 0.1, 2.0, sd * 0.2, 0.7, sd * 0.9, sd * 0.6); kq(); bx('dark', 1.4, 0.3, 1.2, 0.8, 3.2, 0.2);
  mo({ key: o.hk, mode: 1 }, () => { for (let i = 0; i < 6; i++){ const a = i / 6 * TAU + R() * 0.4, r0 = 2.6; P.vine([[Math.cos(a) * r0, 0, Math.sin(a) * r0], [Math.cos(a) * 2.2, 1.6, Math.sin(a) * 1.9], [Math.cos(a) * 1.4, 3.0, Math.sin(a) * 1.2], [Math.cos(a + 0.6) * 0.5, 3.6, Math.sin(a + 0.6) * 0.5]], 0.14, 'thorn', 4); }
    for (let i = 0; i < 5; i++){ const a = R() * TAU; gm('crystalP', oct(rr(0.3, 0.55)), Math.cos(a) * 2.6, gl(Math.cos(a) * 2.6, Math.sin(a) * 2.6) + 0.4, Math.sin(a) * 2.6, rr(-0.3, 0.3), R(), rr(-0.3, 0.3), 0.7, 2.0, 0.7); } glw(0, 1.5, 1.8, 0xc070ff, 3, 0.5); });
  if (/그네|swing/.test(o.note || '')){ const lx = 3.6, lz = 1.2, y = gl(lx, lz); gm('bark', cylB(0.18, 0.26, 3.6, 6), lx, y - 0.1, lz, 0.05, 0, -0.1); link('bark', [lx - 0.1, y + 3.0, lz], [lx - 1.9, y + 3.4, lz + 0.2], 0.1); link('rope', [lx - 1.3, y + 3.2, lz + 0.1], [lx - 1.3, y + 0.9, lz + 0.1], 0.025); link('rope', [lx - 1.8, y + 3.35, lz + 0.15], [lx - 1.75, y + 2.3, lz + 0.3], 0.025); kp(lx - 1.4, y + 0.85, lz + 0.15, 0.2, 1, 0, 0.5); bx('plank', 0.6, 0.05, 0.22, 0, 0, 0); kq(); cc(lx, lz, 0.3); }
  cb(0, 0, 2.05, 1.65); kq(); };
SP.impaled_statue = (x, z, ry, s, o) => { fr(x, z, ry, s, 1.4);
  bx('ruin', 1.5, 1.0, 1.5, 0, 0.5, 0); P.figure(0, 1.0, 0, 0, 'marble', { spear: true, cloak: 'marble', raise: true }); for (let i = 0; i < 4; i++) P.rock(rr(-1.4, 1.4), gl(0, 0), rr(-1.4, 1.4), rr(0.15, 0.3), 'marble');
  mo({ key: o.hk, mode: 1 }, () => { for (let k = 0; k < 3; k++){ const pts = []; for (let i = 0; i < 8; i++) pts.push([Math.cos(i * 1.3 + k * 2.1) * (0.32 - i * 0.015), 0.95 + i * 0.27, Math.sin(i * 1.3 + k * 2.1) * (0.3 - i * 0.015)]); P.vine(pts, 0.06, 'thorn', 4); }
    for (let i = 0; i < 4; i++){ const a = i / 4 * TAU + 0.4; P.vine([[Math.cos(a) * 1.4, gl(Math.cos(a) * 1.4, Math.sin(a) * 1.4), Math.sin(a) * 1.4], [Math.cos(a) * 0.9, 0.7, Math.sin(a) * 0.9], [Math.cos(a) * 0.5, 1.1, Math.sin(a) * 0.5]], 0.09, 'thorn', 3); }
    kp(-1.6, gl(-1.6, -1.2) - 0.4, -1.2, 0.9, 1, 0, -0.95); gm('thorn', coneB(0.4, 4.8, 6)); gm('thornT', coneB(0.12, 1.2, 4), 0, 3.6, 0); kq(); glw(0.3, 1.9, 0.2, 0xc070ff, 2.6, 0.5); P.tsprout(0.9, gl(0.9, 0.9), 0.9, 0.6); });
  cb(0, 0, 0.8, 0.8); kq(); };
SP.thorn_wall = (x, z, ry, s, o) => { fr(x, z, ry, s, 2.5, 0); const L = 14;
  mo({ key: o.hk, mode: 1 }, () => {
    for (let i = 0; i < 16; i++){ const lx = -L / 2 + (i + 0.5) * L / 16 + rr(-0.3, 0.3), lz = rr(-0.7, 0.7); P.thorn(lx, gl(lx, lz) - 0.3, lz, rr(2.6, 5.2), rr(0.25, 0.42), rr(-0.6, 0.6) + (R() < 0.5 ? 0 : Math.PI), rr(0.1, 0.45)); }
    for (let i = 0; i < 6; i++){ const x0 = rr(-L / 2, L / 2 - 4); P.vine([[x0, gl(x0, 0), rr(-0.5, 0.5)], [x0 + 1.4, rr(1.2, 2.4), rr(-0.6, 0.6)], [x0 + 2.8, rr(2, 3.4), rr(-0.6, 0.6)], [x0 + 4, gl(x0 + 4, 0) + rr(0.3, 1.5), rr(-0.5, 0.5)]], 0.13, 'thorn', 4); }
    glw(-3, 1.6, 0, 0xc070ff, 3, 0.45); glw(3.5, 1.4, 0, 0xc070ff, 3, 0.45); mot(0, 0, 1.0, 0, 18, 6, 0xb070ff, 0xb070ff, 0.14, 0, 2.5); kp(0, 0, 0); cb(0, 0, L / 2, 0.9); kq(); });
  for (let i = 0; i < 9; i++){ const lx = -L / 2 + (i + 0.5) * L / 9; gm('thornB', coneB(0.12, 0.35, 4), lx, gl(lx, 0) - 0.05, rr(-0.4, 0.4)); }   // 물러난 뒤 남는 그루터기
  kq(); };
SP.war_camp = (x, z, ry, s) => { fr(x, z, ry, s, 3.5);
  for (const [lx, lz, a] of [[-2.4, -1.2, 0.3], [2.3, -1.5, -0.4]]){ P.tent(lx, lz, a, 'canvas', 1.9); kp(lx, gl(lx, lz), lz, a); gm('clothB', cone(0.5, 0.5, 6), 0, 2.45, 0); kq(); cc(lx, lz, 1.7); }
  P.firepit(0, 1.0, true); P.banner(0, gl(0, -2.6), -2.6, 4.6, 'clothB', 0.2, 1.0, 'gold'); cc(0, -2.6, 0.2);
  { const y = gl(-3.2, 1.6); kp(-3.2, y, 1.6, 1.2); for (const sd of [-1, 1]) bx('woodD', 0.08, 1.2, 0.08, sd * 0.7, 0.6, 0); bx('woodD', 1.6, 0.08, 0.08, 0, 1.1, 0); for (let i = 0; i < 5; i++){ link('woodD', [-0.6 + i * 0.3, 0, 0.25], [-0.6 + i * 0.3, 1.9, -0.1], 0.03); gm('steel', cone(0.04, 0.2, 4), -0.6 + i * 0.3, 2.0, -0.12); } kq(); cc(-3.2, 1.6, 0.8); }
  for (let i = 0; i < 3; i++){ const lx = 2.6 + i * 0.1, lz = 1.4 + i * 0.25; kp(lx, gl(lx, lz) + 0.4, lz, -0.8, 1, -0.3); gm('clothB', cyl(0.35, 0.35, 0.05, 9), 0, 0, 0, Math.PI / 2); gm('gold', oct(0.1), 0, 0, 0.04, 0, 0, 0, 1, 1, 0.3); kq(); }
  for (let i = 0; i < 3; i++) P.crate(rr(-1.2, 1.2), gl(0, 2.6), rr(2.3, 2.9), 0.6, R()); kq(); };
SP.catapult = (x, z, ry, s, o) => { fr(x, z, ry, s, 2.2);
  for (const sd of [-1, 1]){ bx('wood', 0.22, 0.22, 3.4, sd * 0.8, 0.55, 0); P.wheel(sd * 1.0, 0.5, -1.1, 0.5, Math.PI / 2); P.wheel(sd * 1.0, 0.5, 1.1, 0.5, Math.PI / 2); link('wood', [sd * 0.8, 0.6, -1.0], [sd * 0.6, 2.2, 0.2], 0.18); link('wood', [sd * 0.8, 0.6, 1.2], [sd * 0.6, 2.2, 0.2], 0.18); }
  bx('wood', 1.7, 0.2, 0.2, 0, 2.25, 0.2); for (const sd of [-1, 1]) bx('wood', 1.8, 0.18, 0.2, 0, 0.6, sd * 1.4);
  link('woodL', [0, 2.3, 0.2], [0, 4.2, -1.6], 0.16); gm('woodD', BOWL(), 0, 4.1, -1.75, 0.8, 0, 0, 1.5, 1.5, 1.5); bx('iron', 0.9, 0.8, 0.9, 0, 1.3, 1.0); link('rope', [0, 1.7, 1.0], [0, 2.3, 0.4], 0.04);
  for (let i = 0; i < 6; i++) gm('stone', ico(0.28, 1), 1.8 + rr(-0.4, 0.4), gl(1.8, 1.6) + 0.25 + (i > 3 ? 0.4 : 0), 1.6 + rr(-0.4, 0.4));
  if (/가시/.test(o.note || '')) mo({ key: o.hk, mode: 1 }, () => { for (let i = 0; i < 5; i++){ const sd = i % 2 ? 1 : -1; P.vine([[sd * rr(0.8, 1.6), gl(sd, 0), rr(-1.6, 1.6)], [sd * 0.8, rr(0.8, 1.6), rr(-1.2, 1.2)], [rr(-0.4, 0.4), rr(1.8, 3.2), rr(-1.4, 0.4)], [rr(-0.3, 0.3), rr(2.5, 4), rr(-1.8, -0.8)]], 0.1, 'thorn', 4); } glw(0, 1.5, 0, 0xc070ff, 2.6, 0.45); });
  cb(0, 0, 1.15, 1.8); kq(); };
SP.wounded_tent = (x, z, ry, s) => { fr(x, z, ry, s, 2.6);
  for (const sx of [-1.7, 1.7]) for (const sz of [-1.3, 1.3]) P.post(sx, gl(sx, sz) - 0.2, sz, 2.6 - gl(sx, sz), 0.06);
  for (const sd of [-1, 1]) bx('canvas', 3.8, 0.05, 1.6, 0, 2.6, sd * 0.68, sd * 0.32); gm('clothW', plane(0.7, 0.7), 0, 2.2, 1.35); gm('clothG', oct(0.2), 0, 2.2, 1.37, 0, 0, Math.PI / 4, 1, 1, 0.2);
  for (const lx of [-0.9, 0.9]){ const y = gl(lx, 0); bx('wood', 0.8, 0.06, 2.0, lx, y + 0.45, 0); for (const a of [-0.35, 0.35]) for (const b of [-0.9, 0.9]) bx('woodD', 0.05, 0.45, 0.05, lx + a, y + 0.22, b); bx('clothW', 0.75, 0.08, 1.4, lx, y + 0.52, 0.2); gm('clothW', sph(0.15, 6, 4), lx, y + 0.58, -0.75, 0, 0, 0, 1.4, 0.6, 1); }
  for (let i = 0; i < 4; i++) gm('clothW', cyl(0.07, 0.07, 0.14, 7), 1.7 + rr(-0.2, 0.2), gl(1.7, 1.6) + 0.07, 1.6 + rr(-0.2, 0.2), 0, 0, Math.PI / 2);
  gm('iron', BOWL(), -1.5, gl(-1.5, 1.7), 1.7); gm('water', circ(0.26, 9), -1.5, gl(-1.5, 1.7) + 0.13, 1.7); for (let i = 0; i < 3; i++){ gm('pot', POT(), 1.9 + i * 0.3, gl(2, -1.6), -1.6, 0, 0, 0, 0.7, 0.7, 0.7); P.grass(1.9 + i * 0.3, gl(2, -1.6) + 0.27, -1.6, 0.4); }
  kq(); };
SP.thorn_crater = (x, z, ry, s, o) => { mo({ key: o.hk, c2: 'soilD' }, () => patch('blight', x, z, 3.6 * s, 3.4 * s, ry, 0.08, 14, 0.3)); fr(x, z, ry, s, 3, 0);
  for (let i = 0; i < 14; i++){ const a = i / 14 * TAU, lx = Math.cos(a) * 4.2, lz = Math.sin(a) * 4.0; gm('soilD', rockG(rr(0.7, 1.1), 0.45), lx, gl(lx, lz) - 0.2, lz, 0, a, 0); }
  mo({ key: o.hk, mode: 1 }, () => { for (let i = 0; i < 8; i++){ const a = i / 8 * TAU + R() * 0.4; P.thorn(Math.cos(a) * 0.6, gl(0, 0) - 0.3, Math.sin(a) * 0.6, rr(2.2, 4.5), rr(0.22, 0.38), -a + Math.PI / 2, rr(0.35, 0.75)); }
    gm('glowP', sph(0.5, 8, 5), 0, gl(0, 0) - 0.1, 0, 0, 0, 0, 1, 0.4, 1); glw(0, gl(0, 0) + 1.2, 0, 0xb44aff, 5, 0.6); mot(0, 0, 0.8, 0, 22, 3, 0xc070ff, 0xc070ff, 0.18, 1, 2.5); cc(0, 0, 1.2); });
  mo({ key: o.hk, mode: 2 }, () => P.flowers(0, 0, 2.6, 18, ['flowerW', 'flowerY', 'flowerB']));
  kq(); };
// ── 서리 ──
SP.frozen_soldiers = (x, z, ry, s) => { fr(x, z, ry, s, 2.4);
  const SPOTS = [[-1.6, 0, 0.3], [0, 0.6, -0.1], [1.6, -0.2, -0.4], [0.7, -1.7, 0.2]];
  for (const [lx, lz, a] of SPOTS){ const y = gl(lx, lz); P.figure(lx, y, lz, a, 'steel', { spear: R() < 0.6, cloak: 'clothB', walk: true, shield: R() < 0.5 ? 'clothB' : null }); kp(lx, y, lz, a, 1, rr(-0.06, 0.06), rr(-0.06, 0.06)); bx('ice', 1.0, 2.3, 0.95, 0, 1.12, 0); kq(); gm('snow', sph(0.6, 7, 3, 0), lx, y - 0.1, lz, 0, 0, 0, 1.3, 0.35, 1.2); cc(lx, lz, 0.6); }
  for (let i = 0; i < 5; i++) gm('iceO', cone(0.07, rr(0.3, 0.6), 4), rr(-2, 2), gl(0, 0) + 0.1, rr(-2, 2), Math.PI);
  kq(); };
SP.dragon_bone = (x, z, ry, s, o) => { fr(x, z, ry, s, 4, 0);
  for (let i = 0; i < 10; i++){ const t = i / 9, lx = -5 + t * 10, ly = gl(lx, 0) - 0.8 + Math.sin(t * Math.PI) * 1.6; kp(lx, ly, 0, 0); bx('bone', 0.6, 0.7, 0.75); gm('bone', coneB(0.12, 0.9, 4), 0, 0.3, 0); kq(); }
  for (let i = 0; i < 6; i++){ const lx = -2.8 + i * 1.1; for (const sd of [-1, 1]){ kp(lx, gl(lx, 0) - 0.5, sd * 0.3, sd > 0 ? 0 : Math.PI); gm('bone', tor(1.6 - Math.abs(i - 2.5) * 0.15, 0.09, 4, 9, Math.PI * 0.55), 0, 0, 0, 0, Math.PI / 2, 0); kq(); } }
  kp(6.2, gl(6.2, 0.5) + 0.3, 0.5, -Math.PI / 2 + 0.3, 1, 0.1, 0.2); bx('bone', 1.1, 0.9, 2.2); bx('bone', 0.8, 0.35, 1.4, 0, -0.45, 1.0); for (const sd of [-1, 1]){ gm('dark', sph(0.17, 5, 4), sd * 0.45, 0.2, 0.6); gm('bone', coneB(0.18, 1.8, 5), sd * 0.4, 0.4, -0.9, -1.2, 0, sd * 0.2); } kq();
  for (let i = 0; i < 6; i++){ const lx = rr(-5, 6), lz = rr(-2, 2); gm('snow', sph(rr(0.6, 1.1), 7, 3, 0), lx, gl(lx, lz) - 0.2, lz, 0, 0, 0, 1.4, 0.4, 1.1); }
  if (/가시/.test(o.note || '')) mo({ key: o.hk, mode: 1 }, () => { for (let i = 0; i < 7; i++){ const lx = rr(-4, 4); P.thorn(lx, gl(lx, 0) + rr(0, 0.6), rr(-0.6, 0.6), rr(0.9, 2.2), rr(0.08, 0.16), R() * TAU, rr(0.1, 0.6)); } glw(0, 1.4, 0, 0xb44aff, 2.4, 0.5); });
  kp(0, 0, 0); cb(0, 0, 5, 1.0); kq(); kq(); };
SP.ice_shrine = (x, z, ry, s) => { fr(x, z, ry, s, 1.8);
  bx('stone', 1.4, 0.6, 1.0, 0, 0.3, 0); bx('stoneD', 1.6, 0.12, 1.2, 0, 0.64, 0); gm('iron', BOWL(), 0, 0.7, 0, 0, 0, 0, 1.2, 1.2, 1.2); gm('glowB', cone(0.22, 0.6, 6), 0, 1.05, 0); glw(0, 1.1, 0, 0x8ad8ff, 3.6, 0.6); mot(6, 0, 0.9, 0, 4, 0.1, 0x9ae0ff, 0x9ae0ff, 0.1, 1);
  for (let i = 0; i < 7; i++){ const a = i / 7 * TAU, d = rr(1.5, 2.1), lx = Math.cos(a) * d, lz = Math.sin(a) * d; gm('iceO', oct(rr(0.35, 0.6)), lx, gl(lx, lz) + 0.6, lz, rr(-0.3, 0.3), R(), rr(-0.3, 0.3), 0.6, rr(2.4, 3.6), 0.6); cc(lx, lz, 0.4); }
  for (let i = 0; i < 4; i++) gm('snow', sph(0.5, 7, 3, 0), rr(-1.6, 1.6), gl(0, 0) - 0.1, rr(-1.6, 1.6), 0, 0, 0, 1.2, 0.35, 1); cb(0, 0, 0.75, 0.55); kq(); };
SP.bell_tower = (x, z, ry, s) => { fr(x, z, ry, s, 1.6);
  bx('stone', 2.4, 1.3, 2.4, 0, 0.65, 0); for (const sx of [-0.95, 0.95]) for (const sz of [-0.95, 0.95]) bx('woodD', 0.22, 3.6, 0.22, sx, 3.1, sz);
  for (const sd of [-1, 1]){ bx('woodD', 2.2, 0.16, 0.16, 0, 4.7, sd * 0.95); bx('woodD', 0.16, 0.16, 2.2, sd * 0.95, 4.7, 0); } gm('woodD', cone(1.9, 1.5, 4), 0, 5.6, 0, 0, Math.PI / 4, 0); gm('snow', cone(1.6, 0.9, 4), 0, 5.95, 0, 0, Math.PI / 4, 0);
  gm('bronze', BELL(), 0, 3.4, 0, 0, 0, 0, 1.3, 1.3, 1.3); gm('iron', sph(0.12, 5, 4), 0, 3.45, 0); link('rope', [0, 3.45, 0.1], [0.3, 1.4, 0.9], 0.03);
  cb(0, 0, 1.2, 1.2); kq(); };
SP.snow_camp = (x, z, ry, s) => { fr(x, z, ry, s, 3);
  for (const [lx, lz, a] of [[-2.1, -1.2, 0.4], [2.0, -1.0, -0.3]]){ P.tent(lx, lz, a, 'canvas', 1.8); gm('snow', cone(1.3, 0.7, 6), lx, gl(lx, lz) + 1.85, lz, 0, a + Math.PI / 6, 0); cc(lx, lz, 1.6); }
  { const y = gl(0, 0.9); gm('iron', lathe('brazier', [[0, 0], [0.3, 0.9], [0.55, 1.0], [0.6, 1.2], [0, 1.1]], 8), 0, y, 0.9); P.flame(0, y + 1.1, 0.9, 0.9); cc(0, 0.9, 0.5); }
  { const y = gl(-1.0, 2.4); kp(-1.0, y, 2.4, 0.4); for (const sd of [-1, 1]) bx('wood', 0.06, 0.08, 2.2, sd * 0.45, 0.06, 0, 0, 0, 0); bx('wood', 1.0, 0.05, 1.6, 0, 0.3, 0); P.crate(-0.1, 0.33, -0.2, 0.5, 0.2); P.sack(0.2, 0.33, 0.4); kq(); }
  P.logPile(2.4, 1.6, 1.2); for (let i = 0; i < 5; i++) gm('snow', sph(rr(0.5, 0.8), 7, 3, 0), rr(-3, 3), gl(0, 0) - 0.15, rr(-2.5, 2.5), 0, 0, 0, 1.3, 0.35, 1.1);
  kp(-2.9, gl(-2.9, 0.4) + 0.3, 0.4, 0.8, 1, -0.5); gm('clothB', cyl(0.42, 0.42, 0.06, 10), 0, 0, 0, Math.PI / 2); gm('gold', oct(0.14), 0, 0, 0.05, 0, 0, Math.PI / 4, 1, 1, 0.3); gm('snow', sph(0.35, 6, 3, 0), 0, 0.3, 0, 0, 0, 0, 1.2, 0.4, 0.6); kq(); kq(); };
SP.frozen_banner = (x, z, ry, s, o) => { fr(x, z, ry, s, 0.8);
  P.rock(0, -0.1, 0, 0.6, 'stone', 0.8); gm('snow', sph(0.6, 7, 3, 0), 0, 0.25, 0, 0, 0, 0, 1.1, 0.4, 1.1);
  mo({ key: o.hk, c2: { clothFz: 'clothB' } }, () => P.banner(0, 0.2, 0, 4.4, 'clothFz', 0, 1.0, 'gold'));
  mo({ key: o.hk, mode: 1 }, () => { for (let i = 0; i < 7; i++) gm('iceO', cone(0.035, rr(0.25, 0.5), 4), 0.12 + i * 0.13, 4.6 - 0.25 - 4.4 * 0.42 - 0.1 - rr(0, 0.1), 0.04, Math.PI); for (let i = 0; i < 3; i++) gm('iceO', cone(0.03, 0.3, 4), 0.2 + i * 0.35, 4.3, 0.05, Math.PI); });
  cc(0, 0, 0.4); kq(); };
// ── 공용 ──
SP.grave = (x, z, ry, s) => { fr(x, z, ry, s, 1.2, 0); P.grave(0, 0, 0, R() < 0.6, 'woodD'); P.flowers(0, 0.2, 0.7, 6, ['flowerW', 'flowerY', 'flowerB']); P.candle(0.35, gl(0.35, -0.6), -0.6); kq(); };
SP.graves = (x, z, ry, s, o) => { fr(x, z, ry, s, 3.5, 0);
  const st = /비석|stone/.test(o.note), hm = /투구|helm/.test(o.note);
  for (let i = 0; i < 6; i++){ const lx = -2.4 + (i % 3) * 2.4, lz = -1.4 + ((i / 3) | 0) * 2.8; P.grave(lx, lz, rr(-0.1, 0.1), st ? false : R() < 0.5, pick(['woodD', 'stone'])); if (hm) gm('rust', hemi(0.2, 7, 3), lx, gl(lx, lz) + 0.22, lz + 0.1, rr(-0.2, 0.2), R() * 3, 0); if (R() < 0.5) P.flowers(lx, lz + 0.2, 0.5, 4, ['flowerW', 'flowerB']); }
  P.fence(-4, -3.3, 4, -3.3, { broken: true, h: 0.8, rails: [0.6] }); P.fence(-4, 3.3, -0.8, 3.3, { broken: true, h: 0.8, rails: [0.6] }); P.fence(0.8, 3.3, 4, 3.3, { broken: true, h: 0.8, rails: [0.6] });
  P.lantern(0, gl(0, 3.3) + 1.6, 3.4); P.post(0, gl(0, 3.6) - 0.1, 3.6, 1.8, 0.05); glw(0, gl(0, 3.4) + 1.35, 3.4, 0xffb860, 2, 0.25); kq(); };
SP.campfire = (x, z, ry, s, o) => { fr(x, z, ry, s, 2); P.firepit(0, 0, !/꺼진|떠난|흔적|자국/.test(o.note)); P.fallenCol(0, 1.7, Math.PI / 2, 1.8, 'bark'); P.fallenCol(-1.6, -0.4, 0.4, 1.6, 'bark');
  { const y = gl(1.3, -0.9); gm('iron', lathe('cpot', [[0, 0], [0.2, 0.02], [0.27, 0.18], [0.24, 0.32], [0, 0.3]], 8), 1.3, y, -0.9); } P.sack(1.6, gl(1.6, 0.6), 0.6, 0.5); kq(); };
SP.ruined_wall = (x, z, ry, s) => { fr(x, z, ry, s, 2.5, 0); const k = biomeAt(x, z) === 'blight' ? 'darkst' : biomeAt(x, z) === 'canyon' ? 'redrock' : 'ruin';
  P.wall(0, -1.4, 4.4, 2.6, 0, k); P.wall(-2.1, 0.4, 3.2, 2.0, Math.PI / 2, k);
  for (let i = 0; i < 10; i++) gm(pick(['leafD', 'leaf']), ico(rr(0.2, 0.35), 0), rr(-2, 1.5), gl(0, -1.4) + rr(0.4, 2.2), -1.05, R(), R(), R(), 1, 1, 0.5);
  for (let i = 0; i < 6; i++) P.rock(rr(-1.5, 2), gl(0, 0), rr(-0.8, 1.6), rr(0.15, 0.35), k); kq(); };
SP.stone_circle = (x, z, ry, s) => { fr(x, z, ry, s, 4.5, 0);
  for (let i = 0; i < 7; i++){ const a = i / 7 * TAU + 0.3, lx = Math.cos(a) * 4.2, lz = Math.sin(a) * 4.2, h = rr(1.8, 2.8); kp(lx, gl(lx, lz) - 0.3, lz, -a, 1, rr(-0.06, 0.06), rr(-0.06, 0.06)); gm('mossy', cylB(0.32, 0.5, h, 5)); if (i % 2 === 0) bx('glowC', 0.1, h * 0.45, 0.05, 0, h * 0.5, 0.38); kq(); cc(lx, lz, 0.5); }
  bx('stone', 1.6, 0.3, 1.0, 0, gl(0, 0) + 0.12, 0, 0, 0.4, 0); glw(0, gl(0, 0) + 1, 0, 0x6ae6ff, 2, 0.35); kq(); };
SP.well = (x, z, ry, s) => { fr(x, z, ry, s, 1.2);
  gm('stone', lathe('well', [[0.9, 0], [1.0, 0], [1.0, 0.9], [0.8, 0.9], [0.8, 0.2], [0, 0.2]], 14)); gm('water', circ(0.8, 12), 0, 0.5, 0);
  for (const sd of [-1, 1]) bx('woodD', 0.14, 2.2, 0.14, sd * 0.85, 1.4, 0); bx('woodD', 1.9, 0.12, 0.12, 0, 2.3, 0); link('rope', [0, 2.3, 0], [0, 1.2, 0], 0.03); gm('wood', lathe('bucket', [[0, 0], [0.2, 0], [0.24, 0.35], [0, 0.35]], 8), 0, 0.95, 0);
  for (const sd of [-1, 1]) bx('woodR', 2.4, 0.08, 1.15, 0, 2.6, sd * 0.48, sd * 0.55); cc(0, 0, 1.15); kq(); };
SP.watchtower = (x, z, ry, s, o) => { fr(x, z, ry, s, 1.8);
  for (const sx of [-1.1, 1.1]) for (const sz of [-1.1, 1.1]) P.post(sx, gl(sx, sz) - 0.3, sz, 6.4 - gl(sx, sz), 0.12, 'bark');
  for (const sd of [-1, 1]){ link('woodD', [-1.1, 1.2, sd * 1.1], [1.1, 4.6, sd * 1.1], 0.07); link('woodD', [sd * 1.1, 1.2, -1.1], [sd * 1.1, 4.6, 1.1], 0.07); }
  bx('plank', 3.0, 0.12, 3.0, 0, 5.0, 0); for (const sd of [-1, 1]){ bx('wood', 3.0, 0.08, 0.08, 0, 6.0, sd * 1.45); bx('wood', 0.08, 0.08, 3.0, sd * 1.45, 6.0, 0); bx('wood', 3.0, 0.6, 0.05, 0, 5.4, sd * 1.45); }
  gm('woodR', cone(2.4, 1.4, 4), 0, 7.7, 0, 0, Math.PI / 4, 0); for (const sx of [-1.3, 1.3]) for (const sz of [-1.3, 1.3]) bx('woodD', 0.1, 1.9, 0.1, sx, 6.0, sz);
  for (const sd of [-1, 1]) link('wood', [sd * 0.3, gl(sd * 0.3, 2.6), 2.6], [sd * 0.3, 5.05, 1.5], 0.06); for (let i = 1; i < 11; i++){ const t = i / 11; bx('wood', 0.62, 0.05, 0.05, 0, lerp(gl(0, 2.6), 5.05, t), lerp(2.6, 1.5, t)); }
  if (/봉화|beacon/.test(o.note)){ gm('iron', lathe('brazier', [[0, 0], [0.3, 0.9], [0.55, 1.0], [0.6, 1.2], [0, 1.1]], 8), 0, 5.06, 0, 0, 0, 0, 0.8, 0.6, 0.8); gm('coal', ico(0.35, 0), 0, 5.75, 0); }
  else P.banner(1.45, 5.0, 1.45, 3.4, pick(['clothB', 'cloth']), 0.8, 0.7); cb(0, 0, 1.25, 1.25); kq(); };
SP.wagon = (x, z, ry, s) => { fr(x, z, ry, s, 2);
  bx('wood', 1.6, 0.12, 3.0, 0, 0.8, 0); for (const sd of [-1, 1]){ bx('wood', 0.08, 0.5, 3.0, sd * 0.8, 1.05, 0); P.wheel(sd * 0.9, 0.55, -0.9, 0.55, Math.PI / 2); P.wheel(sd * 0.9, 0.55, 0.9, 0.55, Math.PI / 2); }
  for (let i = 0; i < 4; i++) gm('woodD', tor(0.82, 0.03, 3, 10, Math.PI), 0, 1.25, -1.2 + i * 0.8, 0, 0, 0); gm('canvas', new THREE.CylinderGeometry(0.85, 0.85, 3.0, 10, 1, true, -Math.PI / 2, Math.PI), 0, 1.25, 0, Math.PI / 2, 0, 0);
  for (const sd of [-1, 1]) bx('woodD', 0.07, 0.07, 1.9, sd * 0.35, 0.65, 2.3, 0.15); P.barrel(0.4, gl(0.4, -2.2), -2.2, 0.8); P.crate(-0.4, gl(-0.4, -2.3), -2.3, 0.6); cb(0, 0, 1.0, 1.7); kq(); };
SP.crates = (x, z, ry, s, o) => { const nt = o.note || '';
  if (o.pickup || /연장/.test(nt)){ fr(x, z, ry, s, 0.6);   // 연장 상자 (망치 · 톱 · 끌)
    const wl = isW(x, z) ? (WY(x, z) - H(x, z)) / FS + 0.02 : 0; kp(0, Math.max(wl, gl(0, 0)), 0, 0, 1, 0, wl ? 0.12 : 0); bx('woodR', 0.8, 0.32, 0.42, 0, 0.16, 0); bx('woodD', 0.84, 0.05, 0.46, 0, 0.32, 0); for (const sd of [-1, 1]) bx('woodD', 0.05, 0.3, 0.05, sd * 0.3, 0.46, 0); bx('woodD', 0.64, 0.05, 0.05, 0, 0.6, 0);
      link('wood', [-0.1, 0.3, 0.05], [0.35, 0.62, -0.05], 0.035); bx('iron', 0.18, 0.08, 0.07, 0.38, 0.64, -0.06, 0, 0.4, 0); bx('steel', 0.04, 0.16, 0.5, -0.25, 0.42, 0, 0.3, 0, 0); bx('woodD', 0.06, 0.12, 0.14, -0.25, 0.42, 0.3, 0.3, 0, 0); kq();
    if (!isW(x, z)) cc(0, 0, 0.45); kq(); return; }
  fr(x, z, ry, s, 1.2);
  if (/씨앗/.test(nt)){ P.crate(0, 0, 0, 0.8, 0.1); for (let i = 0; i < 4; i++) gm('seed', sph(0.06, 4, 3), rr(-0.25, 0.25), 0.82, rr(-0.25, 0.25), 0, 0, 0, 1, 1.4, 1); mot(0, 0, 0.9, 0, 4, 0.2, 0xb070ff, 0xb070ff, 0.1, 0); P.barrel(0.8, gl(0.8, 0.5), 0.5, 0.8); cb(0, 0.2, 0.7, 0.6); kq(); return; }
  P.crate(-0.4, 0, 0, 0.75, 0.1); P.crate(0.4, 0, 0.1, 0.7, -0.2); P.crate(0, 0.72, 0.05, 0.6, 0.4); P.barrel(-0.9, gl(-0.9, 0.8), 0.8, 0.85); P.barrel(0.9, gl(0.9, 0.9), 0.9, 0.8); P.sack(0.2, gl(0.2, 1.0), 1.0, 0.6);
  if (/광석|ore/.test(nt)) for (let i = 0; i < 7; i++) gm(i < 2 ? 'gold' : 'redrock', ico(0.16, 0), rr(-1.4, 1.4), gl(0, 0) + 0.08, rr(0.8, 1.8), R(), R(), R());
  cb(0, 0.3, 1.0, 0.8); kq(); };
SP.fence_run = (x, z, ry, s) => { kp(x, 0, z, ry); FS = 1; P.fence(-6 * s, 0, 6 * s, 0, { broken: R() < 0.4 }); kq(); };
SP.signpost = (x, z, ry, s) => { fr(x, z, ry, s, 0.5);
  gm('woodD', cylB(0.1, 0.12, 3.0, 7), 0, -0.2, 0); gm('woodD', cone(0.13, 0.25, 7), 0, 2.92, 0);
  for (let i = 0; i < 3; i++){ kp(0, 2.5 - i * 0.45, 0, i * 1.9 + 0.3, 1, 0, i === 2 ? 0.5 : 0); bx('wood', 1.4, 0.3, 0.06, 0.75, 0, 0); bx('wood', 0.22, 0.22, 0.06, 1.48, 0, 0, 0, 0, Math.PI / 4); for (let k = 0; k < 3; k++) bx('woodD', rr(0.2, 0.35), 0.03, 0.065, 0.35 + k * 0.33, 0, 0); kq(); }
  P.rock(0.4, gl(0.4, 0.3), 0.3, 0.3, 'stone'); cc(0, 0, 0.25); kq(); };
SP.rune_stone = (x, z, ry, s) => { fr(x, z, ry, s, 0.8);
  gm('mossy', rockG(0.5, 1, 0), 0, 0.1, 0, 0, 0, 0, 1.3, 0.5, 1.1); kp(0, 0.2, 0, 0, 1, 0.06); bx('stone', 0.7, 1.5, 0.3, 0, 0.75, 0); gm('stone', cyl(0.35, 0.35, 0.3, 9), 0, 1.5, 0, Math.PI / 2);
  for (let i = 0; i < 4; i++) bx('glowC', rr(0.08, 0.3), 0.05, 0.03, rr(-0.15, 0.15), 0.5 + i * 0.25, 0.16, 0, 0, rr(-0.8, 0.8)); gm('glowC', tor(0.13, 0.02, 3, 10), 0, 1.4, 0.16); kq();
  glw(0, 1.0, 0.3, 0x6ae6ff, 1.6, 0.35); P.flowers(0, 0.7, 0.6, 5, ['flowerW', 'flowerB']); cc(0, 0, 0.45); kq(); };
// ── 이름으로 짐작 (새 종류) · 기본 ──
SP.weeping_rock = (x, z, ry, s) => VG.seep(x, z, ry, { s });
SP._fallback = (x, z, ry, s) => { fr(x, z, ry, s, 1.2); P.crate(-0.3, 0, 0, 0.7, 0.3); P.crate(0.45, 0, 0.3, 0.55, -0.2); P.barrel(0.3, gl(0.3, -0.7), -0.7, 0.8); for (let i = 0; i < 5; i++) P.rock(rr(-1.2, 1.2), gl(0, 0), rr(-1.2, 1.2), rr(0.15, 0.35), 'ruin'); bx('plank', 0.25, 0.05, 1.4, -0.9, gl(-0.9, 0.7) + 0.05, 0.7, 0, 0.6, 0.1); cc(0, 0, 0.9); kq(); };
// ── 메모 따라 (세상의 변화가 적힌 셋피스) ──
// 바리케이드: 「…뒤 치움」 이면 그 변화 때 통째로 사라져요
{ const base = SP.barricade; SP.barricade = (x, z, ry, s, o) => { const k = /치움|치워|철거/.test(o.note || '') ? (noteKey(o) || o.hk) : null; k ? mo({ key: k, mode: 1 }, () => base(x, z, ry, s, o)) : base(x, z, ry, s, o); }; }
// 마차: 「dust_lively 뒤 광산촌으로 들어감」 이면 여기서 사라지고 그 지역 정착지 어귀에 나타나요 · 「가시 … 감겨」 면 바퀴에 가시
{ const base = SP.wagon; SP.wagon = (x, z, ry, s, o) => { const nt = o.note || '', mk = /들어|이동|움직/.test(nt) ? noteKey(o) : null;
  if (!mk){ base(x, z, ry, s, o); if (/가시/.test(nt)) mo({ key: o.hk, mode: 1 }, () => { fr(x, z, ry, s, 2); for (const sd of [-1, 1]) for (const lz of [-0.9, 0.9]) P.vine([[sd * 1.3, gl(sd * 1.3, lz), lz + 0.4], [sd * 0.95, 0.6, lz], [sd * 0.95, 1.0, lz - 0.3], [sd * 1.2, gl(sd * 1.2, lz - 0.6) + 0.1, lz - 0.7]], 0.05, 'thorn', 3); for (let i = 0; i < 6; i++) P.flower(rr(-1.6, 1.6), gl(0, 0), rr(-2, 2), 'flowerP', 1.2); kq(); }); return; }
  mo({ key: mk, mode: 1 }, () => base(x, z, ry, s, o));
  const t = SETTLE.find(q => q.region === o.region); if (!t) return;
  const dx = x - t.c[0], dz = z - t.c[1], dl = Math.hypot(dx, dz) || 1;
  for (let k = 0; k < 12; k++){ const a = Math.atan2(dx, dz) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.18, r = t.r + 5, px = t.c[0] + Math.sin(a) * r, pz = t.c[1] + Math.cos(a) * r;
    if (wetR(px, pz, 2) || slope(px, pz) > 0.35 || roadD(px, pz) < 2.5 || lmD(px, pz) < 3 || kept(px, pz, 2) || placed(px, pz, 3)) continue;
    mo({ key: mk, mode: 2 }, () => base(px, pz, a + Math.PI / 2, s, o)); mark(px, pz, 3); break; } }; }
const GUESS = [[/weep|tear|seep|cry|눈물/, 'weeping_rock'], [/thorn|가시/, 'thorn_crater'], [/graves|cemetery/, 'graves'], [/grave|tomb|묘/, 'grave'], [/camp|야영/, 'campfire'], [/boat|배/, 'sunken_boat'], [/tent/, 'snow_camp'], [/bone|skull|뼈/, 'bog_bones'],
  [/statue|석상/, 'statue_broken'], [/fence|울타리/, 'fence_run'], [/sign|post_?board|board|표지/, 'signpost'], [/crate|box|supply|cargo/, 'crates'], [/lantern|lamp|torch|등불/, 'lantern_post'], [/banner|flag|깃발/, 'royal_banner'],
  [/well|우물/, 'well'], [/tower|탑/, 'watchtower'], [/shrine|altar|제단|사당/, 'shrine'], [/tree|나무/, 'claw_tree'], [/spring|pool|샘/, 'dark_spring'], [/rune|룬/, 'rune_stone'], [/ruin|wall|폐허/, 'ruined_wall'], [/cart|wagon|수레/, 'broken_cart'], [/ice|frozen|얼음/, 'ice_shrine'], [/rail|mine|광/, 'mine_rails']];

// ═════════════════════════ 셋피스 짓기 ═════════════════════════
// 길가 · 작은 장면에서 셋피스 모양을 빌려 쓸 때 (o 없이 부르면 기본값)
for (const k in SP){ const f = SP[k]; SP[k] = (x, z, ry, s = 1, o) => f(x, z, ry, s, o || { note: '', kind: k, region: (F.regionAt(x, z) || {}).id, hk: healAt(x, z), pickup: false, item: g => g(), gone: g => g(), mark: () => {}, ik: null }); }
const SPX = new Map(), PKS = [];   // id → { id, kind, region, x, y, z, obj, pk, portable, ik } · 줍는 물건들
// 들고 갈 수 있는 줍는 물건 (처음엔 통째로 숨겨요) — 나머지 줍는 셋피스는 붙박이: 늘 보이고, 반짝이는 표시만 켜고 꺼요
const PORTABLE = new Set(['black_seeds', 'windmill_gear', 'torn_cloak', 'lost_toy', 'nets', 'royal_banner', 'frozen_banner', 'crates', 'offering', 'footprints', 'picnic', 'signpost', 'fence_run', '_fallback']);
const KNOWNK = ['fields_heal', 'spore_clear', 'spirit_lights', 'lake_clear', 'mist_thin', 'swamp_lanterns', 'dust_lively', 'tears_stop', 'golems_calm', 'thorns_recede', 'north_wind_clear', 'granok_rest'];
// 메모에 적힌 변화 키 (예: 「spore_clear 뒤 치움」)
const noteKey = o => KNOWNK.find(k => (o.note || '').includes(k)) || null;
function buildSetpiece(L, sp, fnOverride){
  if (!sp || !sp.id || !sp.c) return null;
  const [x, z] = sp.c, ry = sp.ry || 0, s = sp.s || 1, kind = sp.kind || '';
  let fn = fnOverride || SP[kind], used = kind;
  if (!fn){ const g = GUESS.find(([re]) => re.test(kind)); used = g ? g[1] : '_fallback'; fn = SP[used]; STATS.fallback.push(kind + '→' + used); }
  srand(hashS(sp.id));
  const portable = !!sp.pickup && PORTABLE.has(used), fixture = !!sp.pickup && !portable;
  const o = { id: sp.id, kind, note: sp.note || '', region: L.region, pickup: !!sp.pickup, hk: HEALK[L.region] || healAt(x, z), item: f => f(), gone: f => f(), mark: () => {}, ik: null };
  const rec = { id: sp.id, kind, region: L.region, note: sp.note || '', x, z, y: Math.max(H(x, z), isW(x, z) ? WY(x, z) : -1e9), pickup: !!sp.pickup, portable, obj: null, pk: null, ik: null, got: false };
  let enter = null;
  if (sp.pickup){
    // 줍는 물건: 따로 빌더 · 그룹 (반짝이는 표시 · 숨은 충돌체 포함)
    const b = new MB(), pkK = new G.Kit(b), idx = PKM.length; PKM.push([]); PKC.push([]);
    enter = f => { const pk = K, pb = CB, pi = PKI; pkK.st = [K.top().clone()]; K = pkK; CB = b; PKI = idx; try { f(); } finally { K = pk; CB = pb; PKI = pi; } };
    rec.pk = { b, i: idx, on: false, g: portable ? new THREE.Group() : null, x, z, cols: PKC[idx], colOn: false };
    if (fixture){
      // 붙박이: o.gone(그리기) = 주우면 사라지는 부분 · o.mark(로컬 위치) = 반짝이는 표시 자리
      rec.ik = o.ik = 'pk:' + sp.id; o.gone = f => mo({ key: o.ik, mode: 1 }, f);
      o.mark = (lx, ly, lz) => { if (rec.marked) return; rec.marked = true; enter(() => { mot(3, lx, ly, lz, 10, 0.55, 0xfff0b0, 0xfff0b0, 0.15, 1, 0.3); glw(lx, ly + 0.2, lz, 0xffe8a0, 2.6, 1); }); };
    }
  }
  const ok = inCell(x, z, () => { portable ? enter(() => fn(x, z, ry, s, o)) : fn(x, z, ry, s, o); if (fixture && !rec.marked){ kp(x, rec.y, z); o.mark(0, 1.1, 0); kq(); } }, sp.id);
  if (rec.ik && KEYS.includes(rec.ik) && o.link) LINKS.push([KEYS.indexOf(rec.ik), keyI(o.link)]);
  if (portable){ const g = geoOf(rec.pk.b, x, rec.y, z); if (g){ const m = meshOf(g, MMAT, !LOW); m.customDepthMaterial = DMAT; rec.pk.g.add(m); } rec.pk.g.position.set(x, rec.y, z); rec.pk.g.visible = false; rec.pk.g.name = 'pickup_' + sp.id; rec.pk.g.userData.sp = sp; FW.add(rec.pk.g); rec.obj = rec.pk.g; }
  if (rec.pk){ rec.pk.b = null; PKS.push(rec.pk); STATS.pickups++; }
  if (!rec.obj){ const a = new THREE.Object3D(); a.position.set(x, rec.y, z); a.name = 'sp_' + sp.id; a.userData.sp = sp; a.matrixAutoUpdate = false; a.updateMatrix(); FW.add(a); rec.obj = a; }
  SPX.set(sp.id, rec); mark(x, z, 7 * s); STATS.setpieces++; STATS.kinds[used] = (STATS.kinds[used] || 0) + 1;
  if (!ok) STATS.fallback.push(sp.id + ':실패');
  return rec;
}
for (const L of LORE) for (const sp of L.setpieces || []) buildSetpiece(L, sp);
// ── 쉬는 그라녹 (5장 끝: 바위 거인이 다시 아비 곁의 돌이 되고, 엄니왕이 그 발치에서 잠들어요) ──
SP.granok_rest = (x, z, ry, s, o) => { const K2 = 'granok_rest'; fr(x, z, ry, s, 4.5, 0.3);
  mo({ key: K2, mode: 2 }, () => {
    gm('stoneD', rockG(2.6, 0.85, 1), 0, 1.6, -0.6, 0, 0.3, 0, 1.25, 1, 1.1);   // 웅크린 등
    gm('stone', rockG(1.25, 0.95, 1), 0.2, 2.1, 1.9, 0, 0.6, 0);                 // 숙인 머리
    for (const sd of [-1, 1]){ kp(sd * 1.9, 1.2, 0.8, 0, 1, -0.3, sd * 0.5); gm('stoneD', cylB(0.55, 0.75, 2.6, 7), 0, 0, 0); kq(); gm('stone', rockG(0.7, 0.8), sd * 1.3, 0.55, 2.6, 0, R() * 3, 0); }   // 무릎을 감싼 팔 · 주먹
    for (const sd of [-1, 1]){ kp(sd * 1.2, 0.6, 1.4, sd * 0.3, 1, 0, Math.PI / 2); gm('stoneD', cyl(0.7, 0.8, 2.6, 7)); kq(); }   // 접은 다리
    for (let i = 0; i < 8; i++) gm(pick(['moss', 'mossy']), sph(rr(0.3, 0.6), 6, 3), rr(-2, 2), rr(2.6, 3.6), rr(-2, 1), 0, R() * 3, 0, 1.4, 0.35, 1.2);   // 등에 이끼
    for (let i = 0; i < 3; i++) gm('glowC', oct(0.12), rr(-1.2, 1.2), rr(1.6, 2.8), rr(-1.8, -1.4), 0, R(), 0, 0.5, 2, 0.3);   // 흐릿한 룬
    P.flowers(0, 2.4, 2.4, 10, ['flowerW', 'flowerY', 'flowerP']);
    // 발치에 잠든 엄니왕 (붉은 털 · 큰 엄니)
    kp(2.6, gl(2.6, 3.4) + 0.1, 3.4, -0.9); gm('woodR', sph(1.1, 9, 6), 0, 0.85, 0, 0, 0, 0, 1.05, 0.78, 1.6); gm('redrockD', sph(0.75, 8, 6), 0, 0.75, 1.55, 0, 0, 0, 0.9, 0.8, 1.0); gm('rust', cyl(0.3, 0.32, 0.25, 8), 0, 0.62, 2.25, Math.PI / 2, 0, 0);
    for (const sd of [-1, 1]){ kp(sd * 0.32, 0.55, 2.15, 0, 1, -1.0, sd * 0.4); gm('bone', coneB(0.09, 0.7, 6)); kq(); gm('woodR', cone(0.18, 0.4, 5), sd * 0.45, 1.35, 1.25, -0.3, 0, sd * 0.5); bx('dark', 0.16, 0.025, 0.04, sd * 0.3, 0.98, 2.15); for (const lz of [-0.6, 0.7]) gm('woodR', cylB(0.14, 0.16, 0.5, 6), sd * 0.6, 0, lz); }
    for (let i = 0; i < 6; i++) gm('rust', cone(0.08, 0.35, 4), 0, 1.6, -0.6 + i * 0.3, -0.3, 0, 0); kq();
    mot(0, 2.6, 1.8, 3.4, 3, 0.2, 0xfff0d0, 0xfff0d0, 0.1, 1);   // 잠든 숨
    cc(0, 0, 3.0); cc(2.6, 3.4, 1.4);
  });
  kq(); };
{ const rem = W.landmarks.find(l => l.id === 'remains'), L = LBY.canyon || { region: 'canyon' };
  if (rem && (!LBY.canyon || (LBY.canyon.chapter && (LBY.canyon.chapter.change || []).includes('granok_rest')) || true)){ let best = null, bs = -1e9;
    for (let r = 14; r <= 34; r += 4) for (let i = 0; i < 24; i++){ const a = i / 24 * TAU, px = rem.c[0] + Math.cos(a) * r, pz = rem.c[1] + Math.sin(a) * r; if (wetR(px, pz, 4) || roadD(px, pz) < 6 || kept(px, pz, 4)) continue;
      const [lo, hi] = foot(px, pz, 4.5); if (hi - lo > 2.2) continue; const sc = Math.min(8, lmD(px, pz)) * 2 - (hi - lo) * 3 - r * 0.15 - (placed(px, pz, 5) ? 50 : 0); if (sc > bs){ bs = sc; best = [px, pz, Math.atan2(rem.c[0] - px, rem.c[1] - pz)]; } }
    if (best){ const rec = buildSetpiece(L, { id: 'granok_rest', kind: 'granok_rest', c: [best[0], best[1]], ry: best[2], note: '쉬는 그라녹 — 거인의 유해 곁에 웅크려 잠든 바위 거인과 발치의 엄니왕 (granok_rest)' }); if (rec) rec.hidden = 'granok_rest'; } } }


// ═════════════════════════ 길가 소품 (길을 따라 18~35m 마다 · 양쪽 번갈아) ═════════════════════════
// RS[kind](x, z, ry, o) — ry: 로컬 +z 가 길 쪽 · o = { ux, uz (길 방향), bm }
const RS = {
  fence(x, z, ry, o){ const L = rr(5, 9); fr(x, z, ry, 1, 0.3, 0.02); P.fence(-L / 2, 0, L / 2, 0, { gap: 2.2, broken: R() < 0.25 }); if (R() < 0.35) P.flowers(rr(-L / 2, L / 2), -0.5, 0.5, 5); kq(); },
  bench(x, z, ry){ fr(x, z, ry, 1, 1); bx('wood', 1.8, 0.08, 0.45, 0, 0.45, 0); bx('wood', 1.8, 0.4, 0.06, 0, 0.75, -0.2, -0.15); for (const sd of [-1, 1]) bx('woodD', 0.08, 0.45, 0.42, sd * 0.75, 0.22, 0); if (R() < 0.4) P.sack(1.25, gl(1.25, 0), 0, 0.4); cb(0, 0, 0.95, 0.3); kq(); },
  flowerbox(x, z, ry){ fr(x, z, ry, 1, 0.6); bx('wood', 1.2, 0.45, 0.55, 0, 0.22, 0); bx('soil', 1.1, 0.05, 0.45, 0, 0.45, 0); for (let i = 0; i < 9; i++) P.flower(-0.48 + (i % 5) * 0.24, 0.45, -0.12 + ((i / 5) | 0) * 0.24, pick(['flower', 'flowerY', 'flowerW', 'flowerP', 'flowerO']), 1.1); cb(0, 0, 0.62, 0.3); BFLY(0, -1, 1); kq(); },
  hay(x, z, ry){ fr(x, z, ry, 1, 1.2); const n = 1 + ((R() * 3) | 0); for (let i = 0; i < n; i++){ const lx = (i - (n - 1) / 2) * 1.5 + rr(-0.2, 0.2), lz = rr(-0.5, 0.2); kp(lx, gl(lx, lz) + 0.66, lz, R() * 3); gm('hay', cyl(0.7, 0.7, 1.2, 10), 0, 0, 0, 0, 0, Math.PI / 2); gm('stub', circ(0.6, 8), 0.61, 0, 0, 0, 0, Math.PI / 2); kq(); cc(lx, lz, 0.8); } kq(); },
  mailbox(x, z, ry){ fr(x, z, ry, 1, 0.3); P.post(0, 0, 0, 1.15, 0.05, 'wood'); bx(pick(['pRed' in PAL ? 'pRed' : 'red', 'clothB', 'clothG']), 0.32, 0.3, 0.5, 0, 1.25, 0); gm('red', cyl(0.16, 0.16, 0.5, 8, 1), 0, 1.4, 0, Math.PI / 2, 0, 0, 1, 1, 1); bx('red', 0.03, 0.18, 0.1, 0.18, 1.45, -0.1); cc(0, 0, 0.25); kq(); },
  woodpile(x, z, ry){ fr(x, z, ry, 1, 1.0); P.logPile(0, 0, Math.PI / 2); P.post(1.2, gl(1.2, 0), 0, 0.5, 0.25, 'bark'); link('woodD', [1.2, gl(1.2, 0) + 0.5, 0], [1.4, gl(1.2, 0) + 0.95, 0.15], 0.04); bx('iron', 0.05, 0.22, 0.28, 1.25, gl(1.2, 0) + 0.55, 0.05); cb(0, 0, 0.6, 1.0); kq(); },
  logfence(x, z, ry){ const L = rr(5, 8); fr(x, z, ry, 1, 0.3, 0.02); P.fence(-L / 2, 0, L / 2, 0, { gap: 2.4, key: 'bark', h: 0.9, rails: [0.35, 0.75] }); kq(); },
  mossy(x, z, ry){ fr(x, z, ry, 1, 1.0); for (let i = 0; i < 3; i++){ const lx = rr(-1.2, 1.2), lz = rr(-0.8, 0.5); P.rock(lx, gl(lx, lz) - 0.1, lz, rr(0.35, 0.65), 'mossy', 0.8); } P.grass(0, gl(0, 0), 0.3, 1.2); P.shrooms(0.5, -0.4, 2, 'shroomB', 0.3); cc(0, 0, 1.0); kq(); },
  mush(x, z, ry){ fr(x, z, ry, 1, 0.8); P.post(0, -0.1, 0, 0.55, 0.3, 'bark'); gm('stub', circ(0.3, 8), 0, 0.46, 0); P.shrooms(0.4, 0.2, 5, pick(['shroomR', 'shroomB']), 0.5); P.shrooms(-0.5, -0.1, 3, 'shroomW', 0.3); cc(0, 0, 0.4); kq(); },
  marker(x, z, ry){ fr(x, z, ry, 1, 0.3); P.post(0, -0.1, 0, 2.2, 0.05, 'woodD', 0.05, 0.04); P.skull(0, 2.05, 0, 0.55, R() * 3, true); for (let i = 0; i < 3; i++) gm(pick(['cloth', 'clothY', 'clothB']), clothG(0.08, 0.5, 0), 0.06, 1.6 - i * 0.12, 0.02, 0, i * 2, 0.15); gm('feather' in PAL ? 'feather' : 'woodR', cone(0.03, 0.3, 3), -0.05, 1.8, 0.04, 0.3); cc(0, 0, 0.12); kq(); },
  lantern(x, z, ry){ fr(x, z, ry, 1, 0.3); P.post(0, -0.1, 0, 2.3, 0.06, 'bark'); link('woodD', [0, 2.1, 0], [0.55, 2.35, 0.15], 0.05); P.lantern(0.55, 2.2, 0.15); glw(0.55, 2.0, 0.15, 0xffb860, 2.4, 0.25); cc(0, 0, 0.15); kq(); },
  ropeposts(x, z, ry){ fr(x, z, ry, 1, 0.3, 0.02); const n = 3, pts = []; for (let i = 0; i < n; i++){ const lx = (i - 1) * 2.4; pts.push([lx, gl(lx, 0)]); P.post(lx, gl(lx, 0) - 0.2, 0, 1.1, 0.07, 'woodD'); cc(lx, 0, 0.12); }
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < 4; k++){ const t0 = k / 4, t1 = (k + 1) / 4, a = pts[i], b = pts[i + 1]; link('rope', [lerp(a[0], b[0], t0), lerp(a[1], b[1], t0) + 0.75 - Math.sin(t0 * Math.PI) * 0.18, 0], [lerp(a[0], b[0], t1), lerp(a[1], b[1], t1) + 0.75 - Math.sin(t1 * Math.PI) * 0.18, 0], 0.03); } kq(); },
  reeds(x, z, ry){ fr(x, z, ry, 1, 0.8); for (let k = 0; k < 2; k++){ const lx = k * 1.1 - 0.5; for (let i = 0; i < 9; i++) gm('reed', cylB(0.012, 0.02, 1.5, 3), lx + rr(-0.12, 0.12), gl(lx, 0) - 0.05, rr(-0.12, 0.12), rr(-0.25, 0.25), 0, rr(-0.25, 0.25)); gm('rope', tor(0.13, 0.025, 3, 8), lx, gl(lx, 0) + 0.7, 0, Math.PI / 2); } cc(0, 0, 0.6); kq(); },
  boat(x, z, ry){ const d = waterDir(x, z, ry); fr(x, z, d, 1, 1.4); kp(0, 0.38, 0, 0, 1, 0.08, 0.15); gm('wood', HULL(), 0, 0, 0, 0, 0, 0, 0.75, 0.4, 1.8); bx('woodD', 1.3, 0.06, 0.22, 0, -0.06, 0.4); bx('woodD', 1.3, 0.06, 0.22, 0, -0.06, -0.6); kq(); for (const sd of [-1, 1]) bx('wood', 0.08, 0.04, 1.9, sd * 1.0, gl(sd, 0) + 0.04, 0.2, 0, sd * 0.2, 0); cc(0, 0, 1.0); kq(); },
  basket(x, z, ry){ fr(x, z, ry, 1, 0.6); gm('wicker', lathe('trap', [[0, 0], [0.3, 0], [0.38, 0.3], [0.3, 0.6], [0.12, 0.7], [0, 0.7]], 9), 0, 0, 0, Math.PI / 2 - 0.1, 0, 0, 1, 1, 1); gm('wicker', lathe('fbask', [[0, 0], [0.32, 0], [0.38, 0.4], [0, 0.4]], 9), 0.9, gl(0.9, 0.2), 0.2); cc(0, 0, 0.45); kq(); },
  swamplamp(x, z, ry){ SP.lantern_post(x, z, ry, 1); },
  planks(x, z, ry){ fr(x, z, ry, 1, 1.5, 0); patchL('mud', 0, 0, 1.4, 2.2, 0, 0.07, 10, 0.3); for (let i = 0; i < 6; i++){ const lz = -1.8 + i * 0.7; bx('plank', 1.5, 0.06, 0.4, rr(-0.1, 0.1), gl(0, lz) + 0.08, lz, rr(-0.04, 0.04), rr(-0.15, 0.15), rr(-0.04, 0.04)); } P.post(0.8, gl(0.8, -2.2) - 0.1, -2.2, 0.8, 0.06); kq(); },
  warn(x, z, ry){ fr(x, z, ry, 1, 0.3); P.post(0, -0.2, 0, 1.6, 0.05, 'woodD', 0.08); P.board(0, 1.25, 0.06, 0, textCell(['늪 조심'], 'wood'), 0.85, 0.34, 'woodD', true); gm('cloth', clothG(0.12, 0.4, 0.3), 0.08, 0.9, 0.06, 0, 0.2, 0); cc(0, 0, 0.12); kq(); },
  stakes(x, z, ry){ fr(x, z, ry, 1, 0.8); for (let i = 0; i < 3; i++){ const lx = rr(-0.8, 0.8), lz = rr(-0.4, 0.4); P.post(lx, gl(lx, lz) - 0.2, lz, rr(1.0, 1.7), 0.05, 'woodD', rr(-0.2, 0.2), rr(-0.2, 0.2)); } gm('furD', clothG(0.3, 0.5, 0.4), 0, 1.0, 0.1, 0, 0.3, 0.1); P.skull(0, gl(0, 0.5), 0.5, 0.45, 1); kq(); },
  barrier(x, z, ry){ fr(x, z, ry, 1, 1.0); for (const sd of [-1, 1]){ link('woodD', [sd * 0.9, gl(sd * 0.9, -0.3), -0.3], [sd * 0.9, 1.0, 0], 0.07); link('woodD', [sd * 0.9, gl(sd * 0.9, 0.3), 0.3], [sd * 0.9, 1.0, 0], 0.07); }
    for (let i = 0; i < 4; i++) bx(i % 2 ? 'red' : 'clothW', 0.5, 0.22, 0.05, -0.75 + i * 0.5, 0.95, 0.04); bx('woodD', 2.1, 0.06, 0.06, 0, 0.95, 0); cb(0, 0, 1.05, 0.3); kq(); },
  rails(x, z, ry, o){ fr(x, z, Math.atan2(o.ux, o.uz), 1, 0.8, 0); for (let i = 0; i < 5; i++){ const lz = -1.6 + i * 0.8; bx('woodD', 1.5, 0.1, 0.24, 0, gl(0, lz) + 0.05, lz); } for (const sd of [-1, 1]) link('iron', [sd * 0.5, gl(0, -1.7) + 0.16, -1.7], [sd * 0.5, gl(0, 1.7) + 0.16, 1.7], 0.07, 0.1); for (let i = 0; i < 3; i++) bx('woodD', 1.5, 0.1, 0.22, 1.2 + rr(-0.1, 0.1), gl(1.2, 0) + 0.05 + i * 0.11, rr(-0.3, 0.3), 0, 1.4 + rr(-0.2, 0.2), 0); kq(); },
  cactuspot(x, z, ry){ fr(x, z, ry, 1, 0.6); gm('pot', POT(), 0, 0, 0, 0, 0, 0, 1.6, 1.4, 1.6); gm('cactus', cylB(0.14, 0.16, 0.9, 7), 0, 0.5, 0); gm('cactus', cylB(0.07, 0.08, 0.35, 6), 0.12, 0.85, 0, 0, 0, -0.9); gm('flowerP', oct(0.06), 0, 1.42, 0); cc(0, 0, 0.35); kq(); },
  skullpost(x, z, ry){ fr(x, z, ry, 1, 0.3); P.post(0, -0.2, 0, 1.8, 0.06, 'woodD'); P.skull(0, 1.55, 0.05, 0.75, 0, true); for (let i = 0; i < 3; i++) P.rock(rr(-0.4, 0.4), gl(0, 0), rr(-0.4, 0.4), rr(0.15, 0.25), 'redrock'); cc(0, 0, 0.15); kq(); },
  column(x, z, ry){ fr(x, z, ry, 1, 0.8, 0); P.column(0, 0, rr(1.2, 2.8), true, 'ruin'); if (R() < 0.6) P.fallenCol(1.6, 0.4, rr(0, 3), 1.6, 'ruin'); kq(); },
  head(x, z, ry){ fr(x, z, ry, 1, 1.0); kp(0, 0.55, 0, R() * 3, 1, 0, 1.3); gm('ruin', sph(0.8, 9, 7), 0, 0, 0, 0, 0, 0, 1, 1.15, 0.95); bx('ruin', 0.18, 0.4, 0.2, 0, 0, 0.8); for (const sd of [-1, 1]) gm('stoneD', sph(0.1, 5, 4), sd * 0.28, 0.2, 0.74); gm('gold', cyl(0.5, 0.7, 0.4, 8), 0, 0.8, 0); kq(); cc(0, 0, 0.9); kq(); },
  royalstone(x, z, ry){ const c = W.landmarks.find(l => l.id === 'citadel'), d = c ? Math.hypot(x - c.c[0], z - c.c[1]) : 0, li = Math.max(1, Math.round(d / 400 * 10) / 10);
    fr(x, z, ry, 1, 0.5); bx('ruin', 0.7, 0.25, 0.5, 0, 0.12, 0); bx('ruin', 0.55, 1.0, 0.35, 0, 0.7, 0); gm('ruin', cyl(0.275, 0.275, 0.35, 8), 0, 1.2, 0, Math.PI / 2); gm('gold', oct(0.08), 0, 1.32, 0.18, 0, 0, Math.PI / 4, 1, 1, 0.3);
    const uv = textCell(['왕도', li + ' 리'], 'stone'); if (uv) gm('atlas', quadUV(0.5, 0.3, uv), 0, 0.82, 0.18); STATS.milestones++; cc(0, 0, 0.35); kq(); },
  palisade(x, z, ry){ fr(x, z, ry, 1, 0.3, 0); const n = 6 + ((R() * 4) | 0); for (let i = 0; i < n; i++){ const lx = (i - n / 2) * 0.32; if (R() < 0.3){ kp(lx, gl(lx, 0.6) + 0.12, 0.6, rr(-0.5, 0.5), 1, 0, Math.PI / 2); gm('woodD', cyl(0.12, 0.12, 1.8, 6)); kq(); continue; } const h = rr(1.0, 2.0); gm('woodD', cylB(0.12, 0.13, h, 6), lx, gl(lx, 0) - 0.2, 0, rr(-0.1, 0.1), 0, rr(-0.12, 0.12)); gm('woodL', cone(0.12, 0.3, 6), lx, gl(lx, 0) - 0.2 + h + 0.13, 0); } kp(0, 0, 0); cb(0, 0, n * 0.16, 0.2); kq(); kq(); },
  totem(x, z, ry){ fr(x, z, ry, 1, 0.4); gm('woodD', cylB(0.14, 0.18, 2.4, 7), 0, -0.2, 0); for (let i = 0; i < 3; i++) gm('clothP', cyl(0.2, 0.2, 0.1, 7), 0, 0.6 + i * 0.6, 0); P.skull(0, 2.15, 0, 0.6, 0, true); for (let i = 0; i < 4; i++) gm(pick(['clothP', 'dark', 'cloth']), clothG(0.08, 0.6, 0), Math.cos(i * 1.6) * 0.2, 1.7, Math.sin(i * 1.6) * 0.2, 0, i * 1.6, 0.1); glw(0, 2.3, 0.2, 0xc070ff, 1.2, 0.4); cc(0, 0, 0.2); kq(); },
  thornpost(x, z, ry, o){ fr(x, z, ry, 1, 0.3); P.post(0, -0.2, 0, 1.6, 0.08, 'woodD'); mo({ key: o.hk, mode: 1 }, () => { const pts = []; for (let i = 0; i < 7; i++) pts.push([Math.cos(i * 1.5) * 0.13, i * 0.25, Math.sin(i * 1.5) * 0.13]); P.vine(pts, 0.04, 'thorn', 4); P.tsprout(0.3, gl(0.3, 0.2), 0.2, 0.5); }); cc(0, 0, 0.15); kq(); },
  cairn(x, z, ry){ fr(x, z, ry, 1, 0.6); let y = 0; for (let i = 0; i < 5; i++){ const r = (1 - i / 6) * 0.42; gm('stone', rockG(r, 0.55), rr(-0.04, 0.04), y + r * 0.35, rr(-0.04, 0.04), 0, R() * 3, 0); y += r * 0.7; } gm('snow', sph(0.38, 7, 3, 0), 0, y - 0.05, 0, 0, 0, 0, 1, 0.45, 1); gm('snow', sph(0.6, 7, 3, 0), 0, -0.05, 0, 0, 0, 0, 1.3, 0.35, 1.3); cc(0, 0, 0.45); kq(); },
  torch(x, z, ry){ fr(x, z, ry, 1, 0.3); P.post(0, -0.2, 0, 2.0, 0.06, 'woodD'); gm('iron', lathe('brazier', [[0, 0], [0.3, 0.9], [0.55, 1.0], [0.6, 1.2], [0, 1.1]], 8), 0, 1.65, 0, 0, 0, 0, 0.45, 0.4, 0.45); P.flame(0, 2.1, 0, 0.6); gm('snow', sph(0.4, 6, 3, 0), 0, -0.05, 0, 0, 0, 0, 1, 0.35, 1); cc(0, 0, 0.15); kq(); },
  fbanner(x, z, ry, o){ SP.frozen_banner(x, z, ry, 0.75, o); },
};
// 이정석: 양쪽 목적지와 남은 거리 (길에서 보면 왼쪽 ◀ · 오른쪽 ▶)
RS.milestone = (x, z, ry, o) => { fr(x, z, ry, 1, 0.5);
  bx('mossy', 0.75, 0.2, 0.5, 0, 0.1, 0); bx('stone', 0.62, 0.95, 0.32, 0, 0.62, 0); gm('stone', cyl(0.31, 0.31, 0.32, 9), 0, 1.1, 0, Math.PI / 2);
  if (o.uv) gm('atlas', quadUV(0.56, 0.42, o.uv), 0, 0.8, 0.165); else for (let i = 0; i < 2; i++) bx('stoneD', 0.4, 0.04, 0.02, 0, 0.7 + i * 0.18, 0.165);
  P.grass(0.4, gl(0.4, 0.1), 0.1, 0.8); cc(0, 0, 0.35); STATS.milestones++; kq(); };
const RSW = {
  village: [['fence', 2], ['flowerbox', 1.6], ['bench', 1], ['mailbox', 1], ['hay', 0.6], ['woodpile', 0.6]],
  meadow: [['fence', 3], ['hay', 1.4], ['flowerbox', 1], ['bench', 1], ['mailbox', 0.4], ['woodpile', 0.7]],
  forest: [['logfence', 2], ['mossy', 2], ['mush', 1.6], ['marker', 1.2], ['lantern', 0.8]],
  lake: [['ropeposts', 2], ['reeds', 1.6], ['boat', 1], ['basket', 0.8], ['bench', 0.5]],
  swamp: [['swamplamp', 1.4], ['planks', 1.5], ['warn', 0.9], ['stakes', 1]],
  canyon: [['barrier', 1.5], ['rails', 1.2], ['cactuspot', 1.2], ['skullpost', 1]],
  plateau: [['column', 1.6], ['head', 0.9], ['royalstone', 0.8]],
  blight: [['palisade', 1.5], ['totem', 1], ['thornpost', 1.6]],
  snow: [['cairn', 1.6], ['torch', 1], ['fbanner', 0.9]],
};
// 길 끝 이름 (정착지 · 랜드마크 · 룬 비석 중 가까운 것)
function placeName(x, z){ let best = null, bd = 90; for (const L of [SETTLE, W.landmarks, W.waypoints]) for (const o of L){ const d = Math.hypot(x - o.c[0], z - o.c[1]); if (d < bd){ bd = d; best = o.name; } } return best || (F.regionAt(x, z) || {}).name || '갈림길'; }
const RSWHY = STATS.rsSkip = {};
const okRoadside = (x, z) => { const why = Math.abs(x) > 690 || Math.abs(z) > 690 ? 'edge' : wetR(x, z, 1.5) ? 'water' : slope(x, z) > 0.42 ? 'slope' : kept(x, z, 1) ? 'keep' : nearSettle(x, z, 4) ? 'town' : nearLm(x, z, 0.7, 0) ? 'landmark' : nearCamp(x, z, 0.5) ? 'camp' : roadD(x, z) < 1.0 ? 'road' : lmD(x, z) < 2.6 ? 'lmprop' : treeD(x, z) < 1.2 ? 'tree' : placed(x, z, 1.5) ? 'placed' : null;
  if (why) RSWHY[why] = (RSWHY[why] || 0) + 1; return !why; };
for (const rd of W.roads){
  srand(hashS('rs_' + rd.id)); let C = 0, n = 0, next = rr(10, 22), mile = rd.w >= 5 ? rr(60, 120) : 1e9;
  let total = 0; for (let i = 0; i < rd.pts.length - 1; i++) total += Math.hypot(rd.pts[i + 1][0] - rd.pts[i][0], rd.pts[i + 1][1] - rd.pts[i][1]);
  const nA = placeName(...rd.pts[0]), nB = placeName(...rd.pts[rd.pts.length - 1]);
  for (let i = 0; i < rd.pts.length - 1; i++){
    const [ax, az] = rd.pts[i], [bx2, bz] = rd.pts[i + 1], L = Math.hypot(bx2 - ax, bz - az), ux = (bx2 - ax) / L, uz = (bz - az) / L;
    while (next < C + L){
      const d = next - C, side = n % 2 ? 1 : -1, off = rd.w / 2 + rr(1.6, 3.8), px = ax + ux * d - uz * off * side, pz = az + uz * d + ux * off * side;
      n++; next += LOW ? rr(30, 50) : rr(18, 31);
      if (d < 4 || d > L - 4 || !okRoadside(px, pz)) continue;
      const ry = Math.atan2(uz * side, -ux * side), bm = biomeAt(px, pz), o = { ux, uz, bm, hk: healAt(px, pz) };
      let kind;
      if (C + d >= mile && bm !== 'plateau'){
        // 이정석 글씨: 길에서 바라보면 오른쪽이 길 진행 방향인지
        const fx = Math.sin(ry), fz = Math.cos(ry), rightX = fz, rightZ = -fx, fwdRight = ux * rightX + uz * rightZ > 0, dA = ((C + d) / 1000).toFixed(1), dB = ((total - C - d) / 1000).toFixed(1);
        const L1 = `◀ ${fwdRight ? nA : nB} ${fwdRight ? dA : dB}km`, L2 = `${fwdRight ? nB : nA} ${fwdRight ? dB : dA}km ▶`;
        o.uv = textCell(['<' + L1, '>' + L2], 'stone'); kind = 'milestone'; mile = C + d + rr(240, 320);
      } else kind = pickW(RSW[bm] || RSW.meadow);
      if (kind === 'boat' && !wetR(px, pz, 14)) kind = 'reeds';
      if (inCell(px, pz, () => RS[kind](px, pz, ry, o), 'road:' + kind)){ mark(px, pz, 2.5); STATS.roadside++; }
    }
    C += L;
  }
}

// ═════════════════════════ 빈 땅의 작은 장면 (≈66m 격자 · 한 칸에 하나) ═════════════════════════
// VG[kind](x, z, ry, o) — o = { hk, bm, reg }
const VG = {
  camp(x, z, ry){ fr(x, z, ry, 1, 2); P.firepit(0, 0, false); gm(pick(['clothB', 'clothG', 'cloth']), cyl(0.25, 0.25, 1.8, 7), 1.5, gl(1.5, 0.2) + 0.22, 0.2, 0, 0.3, Math.PI / 2);
    { const y = gl(-0.2, -1.2); gm('iron', lathe('cpot', [[0, 0], [0.2, 0.02], [0.27, 0.18], [0.24, 0.32], [0, 0.3]], 8), -0.2, y, -1.2, 0.5, 0, 0.4); } P.sack(-1.4, gl(-1.4, 0.5), 0.5, 1); P.fallenCol(0.2, 1.6, 0.2, 1.6, 'bark'); kq(); },
  ruinwall(x, z, ry){ SP.ruined_wall(x, z, ry, 0.8); },
  cairn(x, z, ry, o){ fr(x, z, ry, 1, 1); const k = o.bm === 'canyon' ? 'redrock' : o.bm === 'snow' ? 'stone' : 'stone'; for (const [lx, lz, h] of [[0, 0, 1.9], [1.6, 0.5, 1.0], [-1.3, 0.9, 0.7]]){ let y = gl(lx, lz); for (let i = 0; i < 5; i++){ const r = (1 - i / 6) * h * 0.3; gm(k, rockG(r, 0.55), lx + rr(-0.04, 0.04), y + r * 0.35, lz + rr(-0.04, 0.04), 0, R() * 3, 0); y += r * 0.72; } if (h > 1) P.flower(lx, y - 0.05, lz, 'flowerW'); cc(lx, lz, h * 0.28); } kq(); },
  hollowlog(x, z, ry){ fr(x, z, ry, 1, 1.8); kp(0, 0.5, 0, 0, 1, 0, Math.PI / 2); gm('bark', new THREE.CylinderGeometry(0.55, 0.6, 3.6, 10, 1, true)); gm('bark', new THREE.CylinderGeometry(0.42, 0.45, 3.6, 10, 1, true)); gm('dark', circ(0.42, 9), 0, 1.6, 0, 0, 0, 0); kq();
    gm('moss', sph(0.5, 7, 3, 0), -0.6, 0.95, 0, 0, 0, 0, 1.6, 0.25, 0.8); P.shrooms(0.5, 0.6, 4, 'shroomR', 0.3); for (let i = 0; i < 4; i++) gm('shroomB', hemi(0.13, 6, 2), rr(-1.4, 1.2), 0.75, 0.5, Math.PI / 2, 0, 0, 1, 0.35, 1); P.grass(-1.8, gl(-1.8, 0.4), 0.4); cb(0, 0, 1.8, 0.6); kq(); },
  flowerring(x, z, ry, o){ fr(x, z, ry, 1, 2.6, 0); for (let i = 0; i < 26; i++){ const a = i / 26 * TAU + rr(-0.08, 0.08), r = rr(2.0, 2.6), lx = Math.cos(a) * r, lz = Math.sin(a) * r; P.flower(lx, gl(lx, lz), lz, ['flower', 'flowerY', 'flowerW', 'flowerP', 'flowerB'][i % 5], rr(1, 1.4)); }
    P.rock(0, gl(0, 0) - 0.1, 0, 0.45, 'mossy', 0.6); BFLY(0, 0, 4); kq(); },
  shrine(x, z, ry, o){ fr(x, z, ry, 1, 1); bx('stone', 1.0, 0.25, 0.8, 0, 0.12, 0); bx('stone', 0.6, 0.7, 0.5, 0, 0.6, -0.05); bx('dark', 0.35, 0.4, 0.05, 0, 0.62, 0.21); for (const sd of [-1, 1]) bx('woodR', 0.9, 0.06, 0.5, 0, 1.08, sd * 0.2 - 0.05, sd * 0.55);
    gm('marble', ROBE(), 0, 0.4, 0.05, 0, 0, 0, 0.17, 0.22, 0.17); gm('marble', BOWL(), 0, 0.25, 0.42, 0, 0, 0, 0.8, 0.8, 0.8); gm(pick(['fruitR', 'flowerW', 'bread']), sph(0.06, 5, 4), 0, 0.33, 0.42); P.candle(0.3, 0.25, 0.35); P.flowers(0, 0.8, 0.7, 5, ['flowerW', 'flowerY']); cc(0, 0, 0.6); kq(); },
  cartover(x, z, ry, o){ fr(x, z, ry, 1, 2); kp(0.3, 0.8, 0, 0, 1, 0, 1.3); bx('wood', 1.5, 0.1, 2.4, 0, -0.3, 0); for (const sd of [-1, 1]){ bx('wood', 0.1, 0.45, 2.4, sd * 0.75, 0, 0); bx('wood', 1.5, 0.45, 0.1, 0, 0, sd * 1.2); } P.wheel(0.9, -0.35, 0.3, 0.5, Math.PI / 2); kq();
    P.wheel(1.4, gl(1.4, -1.5), -1.5, 0.5, 0.4, true); for (let i = 0; i < 3; i++){ const lx = rr(-2, -0.9), lz = rr(-1, 1); P.crate(lx, gl(lx, lz), lz, rr(0.5, 0.7), R()); } for (let i = 0; i < 8; i++){ const lx = rr(-2.4, -0.8), lz = rr(-1.5, 1.5); gm(pick(['fruitR', 'fruitG', 'fruitO']), sph(0.09, 5, 4), lx, gl(lx, lz) + 0.08, lz); } cb(0.2, 0, 1.0, 1.3); kq(); },
  lonesign(x, z, ry){ SP.signpost(x, z, ry, 0.85); },
  statue(x, z, ry){ SP.statue_broken(x, z, ry, 0.75); },
  burrow(x, z, ry){ fr(x, z, ry, 1, 1.4, 0); const y = gl(0, 0); gm('soil', sph(1.2, 9, 4, 0), 0, y - 0.25, 0, 0, 0, 0, 1, 0.45, 0.9); kp(0, y + 0.08, 0.95, 0, 1, -0.5); gm('dark', circ(0.26, 9), 0, 0, 0, Math.PI / 2 - 0.3); kq(); for (let i = 0; i < 6; i++) gm('soil', ico(0.1, 0), rr(-0.5, 0.5), y + 0.05, rr(1.1, 1.6));
    P.grass(-0.8, gl(-0.8, -0.5), -0.5); P.grass(0.9, gl(0.9, -0.2), -0.2); for (let i = 0; i < 3; i++) gm('carrot', cone(0.03, 0.14, 5), rr(-0.4, 0.4), y + 0.04, rr(1.2, 1.5), Math.PI / 2, R() * 3, 0); const v = kw(0, 1.3); BUR.push({ x: v.x, z: v.z, ry: kYaw() }); kq(); },
  picnic(x, z, ry){ SP.picnic(x, z, ry, 0.85); },
  beestump(x, z, ry){ fr(x, z, ry, 1, 0.8); gm('bark', cylB(0.5, 0.62, 0.7, 9), 0, -0.1, 0); gm('stub', circ(0.5, 9), 0, 0.61, 0); gm('straw', SKEP(), 0, 0.6, 0, 0, 0, 0, 0.85, 0.85, 0.85); bx('dark', 0.14, 0.08, 0.04, 0, 0.66, 0.36); gm('honey', sph(0.06, 4, 3), 0.1, 0.62, 0.38, 0, 0, 0, 1, 2.2, 1);
    mot(4, 0, 0.9, 0, 5, 0.15, 0xffd040, 0xffd040, 0.08, 2); P.flowers(0, 1.5, 1.2, 10, ['flowerY', 'flowerW', 'flowerO']); BFLY(0, 1.5, 2); cc(0, 0, 0.6); kq(); },
  well(x, z, ry){ SP.well(x, z, ry, 0.9); },
  grave(x, z, ry){ SP.grave(x, z, ry, 1); },
  // 검은 씨앗이 떨어진 자리 (초록 언덕 · 장이 끝나면 꽃이 돼요)
  scorch(x, z, ry, o){ mo({ key: o.hk, mode: 1 }, () => patch('blight', x, z, 1.8, 1.5, ry, 0.08, 10, 0.4)); fr(x, z, ry, 1, 1.2, 0);
    mo({ key: o.hk, mode: 1 }, () => { for (let i = 0; i < 6; i++) gm('seed', sph(0.06, 4, 3), rr(-0.6, 0.6), gl(0, 0) + 0.06, rr(-0.6, 0.6), 0, 0, 0, 1, 1.4, 1); for (let i = 0; i < 4; i++) P.tsprout(rr(-1.1, 1.1), gl(0, 0) + 0.03, rr(-1, 1), rr(0.35, 0.6)); for (let i = 0; i < 5; i++) P.stalk(rr(-1.4, 1.4), gl(0, 0), rr(-1.2, 1.2), rr(0.3, 0.5)); glw(0, 0.4, 0, 0xa040ff, 1.8, 0.3); });
    mo({ key: o.hk, mode: 2 }, () => P.flowers(0, 0, 1.5, 12, ['flowerW', 'flowerY', 'flower'])); kq(); },
  hunterblind(x, z, ry){ fr(x, z, ry, 1, 1.4); for (let i = 0; i < 9; i++){ const a = -1.2 + i * 0.3; link('bark', [Math.sin(a) * 1.2, gl(Math.sin(a) * 1.2, Math.cos(a) * 1.2), Math.cos(a) * 1.2], [0, 1.9, -0.2], 0.06); }
    for (let i = 0; i < 10; i++) gm(pick(['leafD', 'leaf']), ico(0.3, 0), rr(-1, 1), rr(0.5, 1.6), rr(0.2, 1.0), R(), R(), R(), 1, 0.7, 1); P.firepit(1.6, -1.4, false); P.skull(-1.4, gl(-1.4, -1), -1, 0.6, 1, true); cc(0, 0.3, 1.1); kq(); },
  bones(x, z, ry, o){ fr(x, z, ry, 1, 1.6, 0); const k = o.bm === 'snow' ? 'bone' : 'boneD'; P.ribs(0, gl(0, 0) - 0.35, 0, 0.8, 5, 0.3, 0.38, k); kp(1.4, gl(1.4, 0.6) + 0.02, 0.6, -0.6); P.skull(0, 0, 0, 0.9, 0, true); kq(); for (let i = 0; i < 4; i++) P.bone(rr(-1.6, 1.6), gl(0, 0) + 0.02, rr(-1.4, 1.4), rr(0.4, 0.8), R() * 3); if (o.bm === 'snow') gm('snow', sph(1, 8, 3, 0), 0, gl(0, 0) - 0.3, 0, 0, 0, 0, 1.4, 0.35, 1); cb(0, 0, 0.9, 0.6); kq(); },
  // 정령 바위 (숲 · 정령 빛이 돌아오면 밝아져요)
  spiritstone(x, z, ry){ const KEY = 'spirit_lights'; fr(x, z, ry, 1, 1); P.rock(0, gl(0, 0) - 0.15, 0, 0.8, 'mossy', 0.9); mo({ key: KEY, e2: 2.4 }, () => { gm('spiritD', tor(0.22, 0.03, 3, 10), 0, gl(0, 0) + 0.45, 0.65, 0.2); gm('spiritD', tor(0.1, 0.025, 3, 8), 0, gl(0, 0) + 0.45, 0.66, 0.2); });
    P.shrooms(0.9, 0.3, 3, 'shroomW', 0.3); mo({ key: KEY }, () => mot(5, 0, 0.6, 0, 10, 1.6, 0x7affd0, 0xc8fff0, 0.16, 1, 1)); mot(8, 0, 0.5, 0, 6, 3, 0xd8ff70, 0xd8ff70, 0.12, 0, 1.6); kq(); },
  // 포자 버섯 (숲 · 포자 안개가 걷히면 사라져요)
  sporepuff(x, z, ry){ const KEY = 'spore_clear'; fr(x, z, ry, 1, 1.4); mo({ key: KEY, mode: 1 }, () => { for (let i = 0; i < 5; i++){ const lx = rr(-1.2, 1.2), lz = rr(-1.2, 1.2), r = rr(0.25, 0.5); gm('puff', sph(r, 8, 5), lx, gl(lx, lz) + r * 0.6, lz, 0, 0, 0, 1, 0.85, 1); gm('sporeG', sph(r * 0.3, 5, 3), lx, gl(lx, lz) + r * 1.3, lz); }
      mot(0, 0, 0.5, 0, 14, 2.2, 0xc8a8ff, 0xc8a8ff, 0.2, 1, 1.5); glw(0, 0.8, 0, 0xc070ff, 2, 0.4); }); mo({ key: KEY, mode: 2 }, () => P.shrooms(0, 0, 5, 'shroomR', 0.9)); kq(); },
  stumpaxe(x, z, ry){ fr(x, z, ry, 1, 1.4); gm('bark', cylB(0.55, 0.68, 0.6, 9), 0, -0.1, 0); gm('stub', circ(0.55, 9), 0, 0.51, 0); link('woodD', [0.05, 0.55, 0], [0.3, 1.1, 0.4], 0.05); bx('iron', 0.05, 0.25, 0.3, 0.02, 0.6, -0.08, 0, 0, 0); P.logPile(1.4, 0.4, 0.4); for (let i = 0; i < 8; i++) bx('woodL', 0.08, 0.03, 0.12, rr(-1, 1), gl(0, 0) + 0.03, rr(-1, 1), 0, R() * 3, 0); cc(0, 0, 0.65); kq(); },
  fairyring(x, z, ry){ fr(x, z, ry, 1, 2, 0); for (let i = 0; i < 14; i++){ const a = i / 14 * TAU, lx = Math.cos(a) * 1.8, lz = Math.sin(a) * 1.8; P.shroom(lx, gl(lx, lz), lz, rr(0.6, 1.0), i % 3 ? 'shroomW' : 'glowC'); } mot(8, 0, 0.4, 0, 8, 2, 0xd8ff90, 0xd8ff90, 0.12, 0, 1.2); glw(0, 0.4, 0, 0x8affe0, 1.6, 0.3); kq(); },
  // 실종 전단이 붙은 기둥 (숲 · 리나 이야기)
  poster(x, z, ry){ fr(x, z, ry, 1, 0.4); P.post(0, -0.2, 0, 2.2, 0.09, 'bark'); gm('atlas', quadUV(0.5, 0.5, poster('missing')), 0, 1.45, 0.095, 0, 0, 0.05); gm('cloth', clothG(0.1, 0.45, 0), 0.08, 1.95, 0.05, 0, 0.3, 0); P.grass(0.3, gl(0.3, 0.2), 0.2); cc(0, 0, 0.15); kq(); },
  boatover(x, z, ry){ const d = waterDir(x, z, ry); fr(x, z, d, 1, 1.6); kp(0, 0.42, 0, 0.2, 1, Math.PI, 0); gm('wood', HULL(), 0, 0, 0, 0, 0, 0, 0.85, 0.45, 2.0); kq(); for (const sd of [-1, 1]) bx('wood', 0.09, 0.04, 2.0, sd * 1.2, gl(sd * 1.2, 0.4) + 0.05, 0.4, 0, sd * 0.15, 0); P.barrel(1.5, gl(1.5, -1), -1, 0.8); cc(0, 0, 1.1); kq(); },
  fishspot(x, z, ry){ const d = waterDir(x, z, ry); fr(x, z, d, 1, 1); gm('wood', cylB(0.2, 0.2, 0.45, 7), 0, 0, 0); link('woodD', [0.3, gl(0.3, 0.2), 0.2], [0.3, 1.8, 2.4], 0.025); link('rope', [0.3, 1.8, 2.4], [0.3, gl(0.3, 3) - 0.2, 3.2], 0.008);
    gm('wood', lathe('bucket', [[0, 0], [0.18, 0], [0.22, 0.32], [0, 0.32]], 8), -0.5, gl(-0.5, 0.2), 0.2); gm('water', circ(0.19, 8), -0.5, gl(-0.5, 0.2) + 0.28, 0.2); gm('fish', sph(0.1, 6, 4), -0.9, gl(-0.9, 0.5) + 0.05, 0.5, 0, 0.5, Math.PI / 2, 0.45, 1.6, 0.9); cc(0, 0, 0.3); kq(); },
  // 호숫가 검은 물 얼룩 (호수 · 물이 맑아지면 꽃)
  stain(x, z, ry, o){ const KEY = 'lake_clear'; mo({ key: KEY, mode: 1 }, () => { patch('ink', x, z, 2.4, 1.6, ry, 0.08, 12, 0.45); patch('ink', x + rr(-2, 2), z + rr(-2, 2), 0.8, 0.5, ry, 0.08, 8, 0.4); }); fr(x, z, ry, 1, 1.2, 0);
    mo({ key: KEY, mode: 1 }, () => { for (let i = 0; i < 2; i++){ kp(rr(-1, 1), gl(0, 0) + 0.06, rr(-0.8, 0.8), R() * 3); gm('fishD', sph(0.12, 6, 4), 0, 0, 0, 0, 0, Math.PI / 2, 0.45, 1, 1.7); gm('fishD', cone(0.09, 0.14, 4), 0, 0, -0.27, -Math.PI / 2); kq(); } });
    mo({ key: KEY, mode: 2 }, () => P.flowers(0, 0, 1.6, 10, ['flowerW', 'flowerB'])); kq(); },
  driftwood(x, z, ry){ fr(x, z, ry, 1, 1.6, 0); for (let i = 0; i < 4; i++){ const lx = rr(-1, 1), lz = rr(-0.6, 0.6); kp(lx, gl(lx, lz) + 0.15, lz, R() * 3); gm('ash', cyl(0.12, 0.16, rr(1.4, 2.4), 6), 0, 0, 0, 0, 0, Math.PI / 2); kq(); } P.vine([[-1.2, gl(-1.2, 0) + 0.2, 0], [-0.3, gl(0, 0) + 0.5, 0.3], [0.8, gl(0.8, 0) + 0.3, -0.2]], 0.1, 'ash', 0); cb(0, 0, 1.2, 0.6); kq(); },
  sunkcart(x, z, ry){ patch('mud', x, z, 2.4, 1.9, ry, 0.08, 10, 0.3); fr(x, z, ry, 1, 1.5, 0); kp(0, gl(0, 0) - 0.35, 0, 0, 1, 0.25, 0.15); bx('wood', 1.5, 0.1, 2.4, 0, 0.6, 0); for (const sd of [-1, 1]){ bx('wood', 0.08, 0.4, 2.4, sd * 0.75, 0.82, 0); P.wheel(sd * 0.85, 0.4, 0.2, 0.5, Math.PI / 2); } P.sack(0, 0.7, -0.4); kq(); for (let i = 0; i < 3; i++) P.grass(rr(-1.5, 1.5), gl(0, 0), rr(-1.5, 1.5), 1.2); cb(0, 0, 0.9, 1.3); kq(); },
  bogbones(x, z, ry, o){ SP.bog_bones(x, z, ry, 0.6); },
  stake(x, z, ry){ SP.lantern_post(x, z, ry, 0.85); },
  hutruin(x, z, ry){ fr(x, z, ry, 1, 2); for (const sx of [-1.2, 1.2]) for (const sz of [-1, 1]) P.post(sx, gl(sx, sz) - 0.3, sz, rr(1.2, 2.0) - gl(sx, sz), 0.1, 'woodD', rr(-0.15, 0.15), rr(-0.15, 0.15));
    kp(0, 1.1, 0, 0, 1, 0.25, -0.2); for (let i = 0; i < 6; i++) bx('plank', 2.6, 0.06, 0.36, 0, 0, -1 + i * 0.4, 0, rr(-0.05, 0.05), 0); kq(); kp(-1.6, gl(-1.6, 1.2) + 0.5, 1.2, 0.6, 1, 0.7, 0.3); bx('straw', 2.6, 0.12, 1.6); kq(); P.grass(0.6, gl(0.6, -1.5), -1.5, 1.3); cb(0, 0, 1.4, 1.1); kq(); },
  mossshrine(x, z, ry){ fr(x, z, ry, 1, 0.9); bx('mossy', 0.9, 0.3, 0.7, 0, 0.15, 0); gm('mossy', ROBE(), 0, 0.3, 0, 0, 0, 0, 0.35, 0.5, 0.35); gm('mossy', sph(0.09, 6, 4), 0, 1.13, 0); gm('glowC', oct(0.05), 0, 0.8, 0.13, 0, 0, 0, 0.8, 1.3, 0.5); glw(0, 0.82, 0.18, 0x6ad8ff, 1.2, 0.4); P.candle(0.3, 0.3, 0.25); P.candle(-0.3, 0.3, 0.25); P.vine([[-0.4, 0, 0.35], [-0.2, 0.7, 0.2], [0.15, 1.1, 0.05]], 0.03, 'leafD', 0); mot(8, 0, 0.6, 0, 6, 2.5, 0xd8ff70, 0xd8ff70, 0.12, 0, 1.2); cc(0, 0, 0.5); kq(); },
  warnsign(x, z, ry){ RS.warn(x, z, ry); },
  offerstone(x, z, ry){ SP.offering(x, z, ry, 0.8); },
  wheel(x, z, ry){ fr(x, z, ry, 1, 1.4, 0); P.wheel(0, gl(0, 0), 0, 0.6, 0.3, true); kp(0.9, gl(0.9, 0.6) + 0.55, 0.6, 1.0, 1, 0, -0.3); P.wheel(0, 0, 0, 0.55, 0); kq(); for (let i = 0; i < 3; i++) bx('wood', 0.2, 0.05, rr(0.8, 1.5), rr(-1.2, 1.2), gl(0, 0) + 0.04, rr(-1.2, 1.2), 0, R() * 3, 0); P.skull(-1.2, gl(-1.2, 0.8), 0.8, 0.8, 1, true); kq(); },
  prospector(x, z, ry){ fr(x, z, ry, 1, 2); P.tent(0, -0.6, 0, pick(['canvas', 'tentA' in PAL ? 'tentA' : 'canvas']), 1.5); P.firepit(1.7, 0.8, false); P.sack(-1.3, gl(-1.3, 0.8), 0.8, 0.3); for (let i = 0; i < 3; i++) gm(i ? 'redrock' : 'gold', ico(0.14, 0), -1.2 + i * 0.2, gl(-1.2, 1.2) + 0.08, 1.2, R(), R(), R());
    gm('iron', cyl(0.3, 0.22, 0.08, 10), 0.6, gl(0.6, 1.4) + 0.05, 1.4); link('woodD', [-1.6, gl(-1.6, -0.6), -0.6], [-1.3, gl(-1.6, -0.6) + 1.1, -0.3], 0.04); cc(0, -0.6, 1.4); kq(); },
  // 눈물 스미는 바위 (협곡 · 울음바위의 눈물이 멈추면 말라요)
  seep(x, z, ry, o){ const KEY = 'tears_stop', s = (o && o.s) || 1; fr(x, z, ry, s, 1.6); P.rock(0, gl(0, 0) - 0.4, 0, 1.6, 'redrock', 1.1);
    mo({ key: KEY, c2: 'redrock' }, () => { for (let i = 0; i < 3; i++) bx('wet', 0.18, 1.3, 0.05, -0.5 + i * 0.5, gl(0, 0) + 0.8, 1.02 + Math.abs(i - 1) * -0.1, -0.25, (i - 1) * 0.3, 0); });
    mo({ key: KEY, mode: 1 }, () => { patchL('water', 0, 1.8, 0.9, 0.6, 0, 0.07, 10, 0.3); mot(2, 0, 1.6, 1.15, 8, 0.5, 0x9ad8ff, 0x9ad8ff, 0.09, 1); });
    for (let i = 0; i < 2; i++) P.grass(rr(-1, 1), gl(0, 2), 2.2, 0.9); cc(0, 0, 1.4); kq(); },
  cactusgarden(x, z, ry){ fr(x, z, ry, 1, 1.2); for (let i = 0; i < 3; i++){ const lx = -0.9 + i * 0.9; gm('pot', POT(), lx, gl(lx, 0), 0, 0, 0, 0, 1.4, 1.2, 1.4); gm('cactus', cylB(0.12, 0.14, rr(0.5, 1.0), 7), lx, gl(lx, 0) + 0.4, 0); gm('flowerP', oct(0.05), lx, gl(lx, 0) + 1.0, 0); } P.skull(0.6, gl(0.6, 0.8), 0.8, 0.8, 0.5, true); cb(0, 0, 1.3, 0.35); kq(); },
  dynamite(x, z, ry){ SP.dynamite_crate(x, z, ry, 0.85); },
  // 도적단이 흘린 장물 (협곡 · 너구리 발자국)
  loot(x, z, ry){ fr(x, z, ry, 1, 1.2, 0); kp(0, gl(0, 0) + 0.1, 0, 0.4, 1, 0, 1.2); P.sack(0, -0.2, 0, 0); kq(); for (let i = 0; i < 6; i++) gm(i < 3 ? 'gold' : 'redrock', ico(0.12, 0), rr(0.2, 1.0), gl(0.5, 0) + 0.07, rr(-0.4, 0.4), R(), R(), R()); for (let i = 0; i < 8; i++) gm('gold', cyl(0.05, 0.05, 0.02, 6), rr(0.2, 1.2), gl(0.6, 0) + 0.02, rr(-0.5, 0.5));
    for (let i = 0; i < 10; i++){ const lz = -1 - i * 0.5, lx = (i % 2 ? 0.15 : -0.15); patchL('soilD', lx, lz, 0.06, 0.08, 0, 0.06, 6, 0.1); for (let k = 0; k < 3; k++) patchL('soilD', lx + (k - 1) * 0.05, lz + 0.09, 0.02, 0.025, 0, 0.06, 5, 0); } kq(); },
  royalstone(x, z, ry){ RS.royalstone(x, z, ry); },
  column(x, z, ry){ fr(x, z, ry, 1, 2, 0); P.column(-0.9, 0, rr(2, 3.2), true); P.fallenCol(1.0, 0.4, rr(0, 3), 2.8); for (let i = 0; i < 4; i++) P.rock(rr(-1.6, 1.6), gl(0, 0), rr(-1.4, 1.4), rr(0.2, 0.4), 'ruin'); kq(); },
  golemchunk(x, z, ry, o){ fr(x, z, ry, 1, 1.4); kp(0, gl(0, 0) + 0.45, 0, R() * 3, 1, 0.3, 0.2); bx('mossy', 1.2, 0.9, 0.9); mo({ key: o.hk, c2: 'stoneD', e2: 0 }, () => bx('glowC', 0.16, 0.1, 0.05, 0.2, 0.15, 0.46)); kq(); for (let i = 0; i < 4; i++) P.rock(rr(-1.3, 1.3), gl(0, 0), rr(-1.3, 1.3), rr(0.2, 0.4), 'mossy'); cc(0, 0, 0.8); kq(); },
  starstone(x, z, ry){ fr(x, z, ry, 1, 1.2); gm('ruin', cyl(1.0, 1.1, 0.4, 12), 0, 0.2, 0); for (let i = 0; i < 8; i++){ const a = R() * TAU, d = rr(0.1, 0.85); gm('glowY', oct(0.04), Math.cos(a) * d, 0.42, Math.sin(a) * d); } for (let i = 0; i < 5; i++) link('stoneD', [rr(-0.7, 0.7), 0.41, rr(-0.7, 0.7)], [rr(-0.7, 0.7), 0.41, rr(-0.7, 0.7)], 0.02, 0.01); glw(0, 0.6, 0, 0xffe070, 1.4, 0.5); cc(0, 0, 1.0); kq(); },
  stakes(x, z, ry){ fr(x, z, ry, 1, 2, 0); patchL('soilD', 0, 0, 1.5, 1.1, 0, 0.06, 8, 0.1); for (const [lx, lz] of [[-1.6, -1.2], [1.6, -1.2], [1.6, 1.2], [-1.6, 1.2]]) P.post(lx, gl(lx, lz) - 0.1, lz, 0.7, 0.03, 'woodL'); for (let i = 0; i < 4; i++){ const a = [[-1.6, -1.2], [1.6, -1.2], [1.6, 1.2], [-1.6, 1.2]][i], b = [[1.6, -1.2], [1.6, 1.2], [-1.6, 1.2], [-1.6, -1.2]][i]; link('red', [a[0], gl(a[0], a[1]) + 0.5, a[1]], [b[0], gl(b[0], b[1]) + 0.5, b[1]], 0.01); }
    gm('soil', sph(0.6, 7, 3, 0), 2.4, gl(2.4, 0) - 0.15, 0, 0, 0, 0, 1.2, 0.5, 1); gm('rust', lathe('bucket', [[0, 0], [0.2, 0], [0.24, 0.35], [0, 0.35]], 8), -2.3, gl(-2.3, 0.4), 0.4); gm('ruin', BOWL(), 0.3, gl(0.3, 0.2) - 0.05, 0.2, 0.4, 0, 0.3); kq(); },
  head(x, z, ry){ RS.head(x, z, ry); },
  // 가시 새싹 무리 (침식지 · 가시가 물러나면 풀꽃)
  thornsprouts(x, z, ry, o){ mo({ key: o.hk, mode: 1 }, () => patch('blight', x, z, 2.6, 2.2, ry, 0.08, 10, 0.4)); fr(x, z, ry, 1, 2, 0);
    mo({ key: o.hk, mode: 1 }, () => { for (let i = 0; i < 6; i++){ const lx = rr(-2, 2), lz = rr(-1.8, 1.8); P.thorn(lx, gl(lx, lz) - 0.2, lz, rr(1.0, 2.6), rr(0.12, 0.22), R() * TAU, rr(0.1, 0.5)); } for (let i = 0; i < 5; i++) P.tsprout(rr(-2, 2), gl(0, 0), rr(-2, 2), rr(0.3, 0.6)); glw(0, 0.8, 0, 0xb44aff, 2.4, 0.5); });
    mo({ key: o.hk, mode: 2 }, () => { for (let i = 0; i < 6; i++) P.grass(rr(-2, 2), gl(0, 0), rr(-2, 2), 1.1); P.flowers(0, 0, 2, 9, ['flowerW', 'flowerY']); }); kq(); },
  palisade(x, z, ry){ RS.palisade(x, z, ry); },
  // 쓰러진 병사의 무덤 (칼 · 투구 · 망토)
  soldiergrave(x, z, ry){ fr(x, z, ry, 1, 1); gm('soil', sph(0.6, 7, 3, 0), 0, -0.1, 0.4, 0, 0, 0, 0.9, 0.3, 1.5); kp(0, 0, -0.6, 0, 1, 0.08); bx('steel', 0.07, 1.2, 0.03, 0, 0.6, 0); bx('bronze', 0.4, 0.06, 0.07, 0, 0.95, 0); bx('bronze', 0.07, 0.25, 0.07, 0, 1.12, 0); kq(); gm('steel', hemi(0.2, 7, 3), 0, 1.2, -0.6, 0.2); gm('clothB', clothG(0.5, 0.7, 0.3), 0.05, 0.75, -0.55, 0.1, 0.2, 0); P.flowers(0, 0.4, 0.6, 5, ['flowerW']); cc(0, -0.2, 0.6); kq(); },
  deadcart(x, z, ry, o){ fr(x, z, ry, 1, 1.8); kp(0, 0, 0, 0, 1, 0.12, 0.2); bx('coal', 1.5, 0.1, 2.4, 0, 0.6, 0); bx('coal', 0.08, 0.4, 1.6, 0.75, 0.82, 0.4); P.wheel(-0.85, 0.45, 0.2, 0.5, Math.PI / 2); kq(); P.wheel(1.3, gl(1.3, -1.3), -1.3, 0.5, 0.2, true); mo({ key: o.hk, mode: 1 }, () => { for (let i = 0; i < 3; i++) P.vine([[rr(-1, 1), 0, rr(-1.5, 1.5)], [rr(-0.5, 0.5), 1.2, rr(-1, 1)], [rr(-1, 1), 0.7, rr(-1.2, 1.2)]], 0.07, 'thorn', 3); }); cb(0, 0, 0.9, 1.3); kq(); },
  crystals(x, z, ry, o){ fr(x, z, ry, 1, 1.6, 0); mo({ key: o.hk, mode: 1 }, () => { for (let i = 0; i < 6; i++){ const lx = rr(-1.4, 1.4), lz = rr(-1.4, 1.4); gm(R() < 0.65 ? 'crystalP' : 'darkst', oct(rr(0.3, 0.7)), lx, gl(lx, lz) + 0.4, lz, rr(-0.3, 0.3), R(), rr(-0.3, 0.3), 0.7, rr(1.6, 2.8), 0.7); } glw(0, 1.2, 0, 0xc070ff, 2.6, 0.55); cc(0, 0, 1.3); }); P.rock(1.6, gl(1.6, 1), 1, 0.4, 'darkst'); kq(); },
  burnt(x, z, ry){ fr(x, z, ry, 1, 2.4, 0); for (const [lx, lz, len, a] of [[0, -1.6, 3.6, 0], [-1.8, 0, 3.2, Math.PI / 2], [1.8, 0.4, 2.4, Math.PI / 2]]) P.wall(lx, lz, len, rr(1.0, 2.0), a, 'coal'); for (let i = 0; i < 5; i++){ const lx = rr(-1.4, 1.4), lz = rr(-1.2, 1.2); kp(lx, gl(lx, lz) + 0.1, lz, R() * 3); bx('coal', 0.14, 0.14, rr(1, 2.2), 0, 0, 0, rr(-0.2, 0.2)); kq(); } patchL('ash', 0, 0, 1.8, 1.6, 0, 0.07, 10, 0.3); kq(); },
  totem(x, z, ry){ RS.totem(x, z, ry); },
  frozentent(x, z, ry){ fr(x, z, ry, 1, 2); P.tent(0, -0.5, 0, 'canvas', 1.6, 0.4); gm('snow', cone(1.3, 0.7, 6), 0, gl(0, -0.5) + 1.45, -0.5, 0.15, Math.PI / 6, 0); for (let i = 0; i < 6; i++){ const a = i / 6 * TAU; gm('iceO', cone(0.04, 0.35, 4), Math.cos(a) * 1.35, gl(0, 0) + 0.7, -0.5 + Math.sin(a) * 1.35, Math.PI); } VG.frozenfire(x + Math.sin(ry) * 1.8, z + Math.cos(ry) * 1.8, ry); cc(0, -0.5, 1.4); kq(); },
  sled(x, z, ry){ fr(x, z, ry, 1, 1.4); for (const sd of [-1, 1]){ bx('wood', 0.06, 0.08, 2.2, sd * 0.45, 0.06, 0); gm('wood', tor(0.2, 0.03, 3, 6, Math.PI / 2), sd * 0.45, 0.25, 1.1, 0, Math.PI / 2, 0); } bx('wood', 1.0, 0.05, 1.6, 0, 0.3, 0, 0, 0, 0.1); P.crate(0, 0.33, -0.3, 0.5, 0.2); P.sack(0.1, 0.33, 0.4, 0.5); gm('snow', sph(0.5, 7, 3, 0), 0, 0.5, 0, 0, 0, 0, 1.3, 0.35, 2); cb(0, 0, 0.6, 1.1); kq(); },
  frozenfire(x, z, ry){ fr(x, z, ry, 1, 1); P.firepit(0, 0, false); gm('snow', sph(0.7, 7, 3, 0), 0, gl(0, 0) - 0.1, 0, 0, 0, 0, 1.1, 0.3, 1.1); gm('iron', lathe('cpot', [[0, 0], [0.2, 0.02], [0.27, 0.18], [0.24, 0.32], [0, 0.3]], 8), 0.9, gl(0.9, 0.5), 0.5, 0.4, 0, 0.6); gm('iceO', sph(0.2, 6, 3, 0), 0.9, gl(0.9, 0.5) + 0.3, 0.5, 0, 0, 0, 1, 0.3, 1); kq(); },
  icemarker(x, z, ry){ fr(x, z, ry, 1, 0.7); bx('stone', 0.6, 1.6, 0.35, 0, 0.8, 0, 0.05); gm('snow', sph(0.35, 7, 3, 0), 0, 1.6, 0, 0, 0, 0, 1, 0.4, 0.7); for (let i = 0; i < 5; i++) gm('iceO', cone(0.04, rr(0.2, 0.45), 4), -0.25 + i * 0.12, 1.45, 0.18, Math.PI); for (let i = 0; i < 3; i++) bx('stoneD', 0.35, 0.04, 0.02, 0, 0.7 + i * 0.2, 0.18); gm('snow', sph(0.7, 7, 3, 0), 0, -0.05, 0, 0, 0, 0, 1.2, 0.3, 1.2); cc(0, 0, 0.4); kq(); },
  banner(x, z, ry, o){ SP.frozen_banner(x, z, ry, 0.85, o); },
  icecrystal(x, z, ry){ fr(x, z, ry, 1, 1.6, 0); for (let i = 0; i < 6; i++){ const lx = rr(-1.5, 1.5), lz = rr(-1.5, 1.5); gm('iceO', oct(rr(0.35, 0.8)), lx, gl(lx, lz) + 0.5, lz, rr(-0.3, 0.3), R(), rr(-0.3, 0.3), 0.6, rr(1.8, 3.2), 0.6); } glw(0, 1.2, 0, 0x9fdcff, 2.4, 0.4); cc(0, 0, 1.4); kq(); },
};
const VGW = {
  meadow: ['camp', 'ruinwall', 'cairn', 'hollowlog', 'flowerring', 'shrine', 'scorch', 'cartover', 'lonesign', 'statue', 'burrow', 'picnic', 'beestump', 'scorch', 'well', 'grave', 'flowerring', 'burrow'],
  village: ['flowerring', 'beestump', 'burrow', 'well'],
  forest: ['camp', 'hollowlog', 'spiritstone', 'hunterblind', 'sporepuff', 'burrow', 'bones', 'poster', 'cairn', 'stumpaxe', 'ruinwall', 'fairyring', 'grave', 'sporepuff', 'spiritstone', 'shrine'],
  lake: ['boatover', 'fishspot', 'stain', 'ruinwall', 'cairn', 'picnic', 'driftwood', 'stain', 'shrine', 'flowerring', 'grave', 'burrow'],
  swamp: ['sunkcart', 'bogbones', 'stake', 'hutruin', 'mossshrine', 'hollowlog', 'warnsign', 'offerstone', 'stake'],
  canyon: ['bones', 'cartover', 'cairn', 'seep', 'camp', 'wheel', 'prospector', 'cactusgarden', 'loot', 'dynamite', 'lonesign', 'seep'],
  plateau: ['statue', 'ruinwall', 'royalstone', 'column', 'golemchunk', 'grave', 'starstone', 'stakes', 'head', 'cairn'],
  blight: ['thornsprouts', 'palisade', 'soldiergrave', 'deadcart', 'crystals', 'burnt', 'thornsprouts', 'totem', 'soldiergrave'],
  snow: ['frozentent', 'cairn', 'sled', 'frozenfire', 'bones', 'icemarker', 'banner', 'icecrystal'],
};
const BUR = [];   // 토끼 굴 [x, z, ry]
const VR = { camp: 2.5, ruinwall: 3, cairn: 2, hollowlog: 2.2, flowerring: 3, shrine: 1.5, scorch: 2, cartover: 2.6, lonesign: 1, statue: 2, burrow: 1.6, picnic: 2, beestump: 1.8, well: 1.4, grave: 1.2, hunterblind: 1.8, bones: 2, spiritstone: 1.6, sporepuff: 1.8, stumpaxe: 2, fairyring: 2.2, poster: 0.6,
  boatover: 2, fishspot: 1.2, stain: 2.5, driftwood: 1.6, sunkcart: 2, bogbones: 2.4, stake: 0.6, hutruin: 2, mossshrine: 1, warnsign: 0.6, offerstone: 1.2, wheel: 1.6, prospector: 2.2, seep: 2, cactusgarden: 1.4, dynamite: 1.4, loot: 1.5,
  royalstone: 0.6, column: 2, golemchunk: 1.6, starstone: 1.2, stakes: 2.6, head: 1.2, thornsprouts: 2.6, palisade: 1.8, soldiergrave: 1, deadcart: 2, crystals: 1.8, burnt: 2.6, totem: 0.6, frozentent: 2.2, sled: 1.4, frozenfire: 1, icemarker: 0.8, banner: 0.8, icecrystal: 1.8 };
{ const GS = 70, n = Math.ceil(690 / GS), deck = {}, last = {};
  for (let j = -n; j < n; j++) for (let i = -n; i < n; i++){
    if (hash2(i, j, 7) < (LOW ? 0.55 : 0.16)) continue;   // 낮은 그래픽은 절반쯤
    let spot = null;
    for (let t = 0; t < 7 && !spot; t++){
      const x = (i + 0.15 + 0.7 * hash2(i, j, 11 + t)) * GS, z = (j + 0.15 + 0.7 * hash2(i, j, 31 + t)) * GS;
      if (Math.abs(x) > 670 || Math.abs(z) > 670) continue;
      const rg = F.regionAt(x, z); if (!rg || rg.id === 'village') continue;
      if (wetR(x, z, 4) || slope(x, z) > 0.32 || roadD(x, z) < 8 || kept(x, z, 6) || nearSettle(x, z, 10) || nearLm(x, z, 1, 15) || nearCamp(x, z, 0.8)) continue;
      const [lo, hi] = foot(x, z, 3.2); if (hi - lo > 1.4) continue;
      if (lmD(x, z) < 7 || treeD(x, z) < 3.4 || placed(x, z, 10)) continue;
      spot = [x, z, rg];
    }
    if (!spot) continue;
    const [x, z, rg] = spot, bm = biomeAt(x, z), list = VGW[bm] || VGW.meadow;
    srand(hashS(`vig_${i}_${j}`));
    if (deck[bm] == null) deck[bm] = (hash2(i, j, 3) * list.length) | 0;
    let kind = list[deck[bm]++ % list.length]; if (kind === last[bm]) kind = list[deck[bm]++ % list.length]; last[bm] = kind;
    if ((kind === 'boatover' || kind === 'fishspot') && !wetR(x, z, 16)) kind = bm === 'lake' ? 'ruinwall' : 'cairn';
    if (kind === 'stain' && !wetR(x, z, 22)) kind = 'flowerring';
    const o = { hk: HEALK[rg.id] || 'thorns_recede', bm, reg: rg.id };
    if (inCell(x, z, () => VG[kind](x, z, R() * TAU, o), 'vig:' + kind)){ mark(x, z, VR[kind] || 2); STATS.vignettes++; STATS.kinds['v_' + kind] = (STATS.kinds['v_' + kind] || 0) + 1; }
  } }


// ═════════════════════════ 칸 메시 · 빛 점 · 떠다니는 빛 만들기 ═════════════════════════
for (let i = 1; i < KEYS.length; i++) colSync(i);   // 「솟아남」 충돌체는 처음엔 빼 둬요
for (const c of CL){
  const g = geoOf(c.b); if (g){ const m = meshOf(g, MMAT, !LOW); m.customDepthMaterial = DMAT; c.g.add(m); }
  if (c.b.atl.length) c.g.add(meshOf(G.mergeGeos(c.b.atl), AMAT));
  if (c.b.ice.length){ const m = meshOf(G.mergeGeos(c.b.ice), IMAT); m.renderOrder = 2; c.g.add(m); }
  c.g.visible = false; c.b = null; c.K = null; FW.add(c.g); STATS.cells++;
}
ATEX.needsUpdate = true;
const GU = MU.uScale;
let glowPts = null;
if (GLW.s.length){
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(GLW.p, 3)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(GLW.c, 3)); g.setAttribute('aSize', new THREE.Float32BufferAttribute(GLW.s, 1)); g.setAttribute('aDay', new THREE.Float32BufferAttribute(GLW.d, 1)); g.setAttribute('aKM', new THREE.Float32BufferAttribute(GLW.k, 2));
  const m = new THREE.ShaderMaterial({ uniforms: { uScale: GU, uNight: MU.uNight, uTime: MU.uTime, uK: MU.uK }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `attribute vec3 aCol; attribute float aSize, aDay; attribute vec2 aKM; uniform float uScale, uNight, uTime; uniform float uK[32]; varying vec3 vC; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z; int kI = int(aKM.x + 0.5), mI = int(aKM.y + 0.5); float kk = uK[kI], vis = mI == 1 ? 1.0 - kk : mI == 2 ? kk : 1.0;
        vA = mix(aDay, 1.0, uNight) * vis * (0.85 + 0.15 * sin(uTime * 3.0 + position.x * 1.7 + position.z)) * smoothstep(520.0, 220.0, d); vC = aCol;
        gl_Position = projectionMatrix * mv; gl_PointSize = vA > 0.003 ? max(aSize * uScale / d * (0.6 + 0.6 * uNight), 1.5 * uNight) : 0.0; }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a = a * a * vA; gl_FragColor = vec4(vC * a * 1.4, a); }` });
  glowPts = new THREE.Points(g, m); glowPts.frustumCulled = false; glowPts.name = 'props_glow'; FW.add(glowPts); STATS.glows = GLW.s.length;
}
let motePts = null, moteOn = null;
if (MOT.q.length){
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(MOT.p, 3)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(MOT.a, 3)); g.setAttribute('aCol2', new THREE.Float32BufferAttribute(MOT.b, 3)); g.setAttribute('aQ', new THREE.Float32BufferAttribute(MOT.q, 4));
  moteOn = new THREE.Float32BufferAttribute(MOT.t, 4); g.setAttribute('aT', moteOn); g.boundingSphere = new THREE.Sphere(new V3(), 3000);
  const m = new THREE.ShaderMaterial({ uniforms: { uScale: GU, uNight: MU.uNight, uTime: MU.uTime, uK: MU.uK }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `attribute vec3 aCol, aCol2; attribute vec4 aQ, aT; uniform float uScale, uNight, uTime; uniform float uK[32]; varying vec3 vC; varying float vA;
      void main(){ int ty = int(aT.x + 0.5), kI = int(aT.y + 0.5), mI = int(aT.z + 0.5); float kk = uK[kI], s = aQ.x, sz = aQ.y, t = uTime, a = 1.0; vec3 p = position;
        if (ty == 0){ p += vec3(sin(t * 0.5 + s * 50.0) * 1.2, sin(t * 0.8 + s * 31.0) * 0.5, cos(t * 0.4 + s * 70.0) * 1.2); a = pow(0.5 + 0.5 * sin(t * (1.5 + fract(s * 4.0) * 2.0) + s * 90.0), 2.0); }
        else if (ty == 1){ float l = fract(t * (0.7 + fract(s * 7.0) * 0.5) + s), an = s * 80.0, r = l * 0.7 * (0.3 + fract(s * 3.0)); p += vec3(cos(an) * r, 4.0 * 1.1 * l * (1.0 - l), sin(an) * r); a = 1.0 - l * l; }
        else if (ty == 2){ float l = fract(t * (0.5 + fract(s * 5.0) * 0.6) + s); p.y -= l * l * 1.6; a = (1.0 - l) * step(0.12, l); }
        else if (ty == 3){ float l = fract(t * 0.45 + s); p += vec3(cos(s * 40.0) * 0.4, l * 1.1, sin(s * 40.0) * 0.4); a = sin(l * 3.14159); a *= a; }
        else if (ty == 4){ float w = t * (3.0 + fract(s * 3.0) * 3.0) + s * 60.0; p += vec3(cos(w) * 0.9 * (0.6 + 0.4 * sin(t * 1.3 + s * 9.0)), 0.35 * sin(w * 1.7), sin(w * 1.3) * 0.9); a = 0.9; }
        else if (ty == 5){ float am = mix(0.4, 1.8, kk); p += vec3(sin(t * 0.3 + s * 50.0) * am * 1.5, sin(t * 0.5 + s * 31.0) * am * 0.6 + kk * 0.8, cos(t * 0.25 + s * 70.0) * am * 1.5); a = mix(0.3, 1.0, kk) * (0.6 + 0.4 * sin(t * 2.0 + s * 40.0)); sz *= mix(0.8, 1.6, kk); }
        else if (ty == 6){ float l = fract(t * (0.5 + fract(s * 5.3) * 0.4) + s); p += vec3(sin(s * 47.0 + t * 1.3) * l * 0.6, l * 2.4, cos(s * 61.0 + t) * l * 0.6); a = 1.0 - l; }
        else if (ty == 7){ a = 0.75 + 0.25 * sin(t * 2.0 + s * 20.0); }
        else { p += vec3(sin(t * 0.35 + s * 50.0) * 2.0, sin(t * 0.6 + s * 31.0) * 0.5, cos(t * 0.3 + s * 70.0) * 2.0); a = pow(max(0.0, sin(t * (1.2 + fract(s * 4.0)) + s * 90.0)), 3.0); }
        float vis = mI == 1 ? 1.0 - kk : mI == 2 ? kk : 1.0, day = aQ.z > 1.5 ? 1.0 - uNight : mix(aQ.z, 1.0, uNight);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = -mv.z; vA = a * vis * day * aT.w * smoothstep(150.0, 90.0, d); vC = mix(aCol, aCol2, kk);
        gl_Position = projectionMatrix * mv; gl_PointSize = vA > 0.003 ? max(sz * uScale / d, 1.0) : 0.0; }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d) * vA; gl_FragColor = vec4(vC * a * 1.6, a); }` });
  motePts = new THREE.Points(g, m); motePts.frustumCulled = false; motePts.name = 'props_motes'; FW.add(motePts); STATS.motes = MOT.q.length / 4;
}
function showMotes(i, on){ if (!moteOn) return; for (const k of PKM[i] || []) moteOn.array[k * 4 + 3] = on ? 1 : 0; moteOn.needsUpdate = true; }

// ═════════════════════════ 작은 동물 (이야기 자리에 묶임 · 가까운 것만 움직여요) ═════════════════════════
// 나비: 점 하나에 날개 두 장을 그려요 (낮에만) — 한 드로콜
let bfPts = null;
if (BFL.length){
  const n = BFL.length / 3, C = new Float32Array(n * 3), Sd = new Float32Array(n), c = new THREE.Color();
  for (let i = 0; i < n; i++){ c.setHex(pick([0xff8ab8, 0xffd84a, 0x8ac8ff, 0xffffff, 0xff9a4a, 0xc08aff]), THREE.LinearSRGBColorSpace); C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b; Sd[i] = R(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(BFL, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(C, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(Sd, 1)); g.boundingSphere = new THREE.Sphere(new V3(), 3000);
  const m = new THREE.ShaderMaterial({ uniforms: { uScale: GU, uNight: MU.uNight, uTime: MU.uTime }, transparent: true, depthWrite: false,
    vertexShader: `attribute vec3 aCol; attribute float aSeed; uniform float uScale, uNight, uTime; varying vec3 vC; varying float vF, vA;
      void main(){ float s = aSeed, t = uTime * (0.5 + fract(s * 3.1) * 0.4) + s * 40.0;
        vec3 p = position + vec3(sin(t * 0.7) * 1.8 + sin(t * 1.9) * 0.5, 0.5 + sin(t * 1.3) * 0.3 + fract(s * 7.0) * 0.7, cos(t * 0.6) * 1.8 + cos(t * 1.7) * 0.4);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = -mv.z; vF = 0.2 + 0.8 * abs(cos(uTime * 13.0 + s * 30.0)); vC = aCol;
        vA = (1.0 - uNight) * smoothstep(90.0, 55.0, d); gl_Position = projectionMatrix * mv; gl_PointSize = vA > 0.01 ? 0.55 * uScale / d : 0.0; }`,
    fragmentShader: `varying vec3 vC; varying float vF, vA; void main(){ vec2 q = gl_PointCoord - 0.5; q.y = -q.y; float ax = abs(q.x) / max(vF, 0.14);
        float w1 = length(vec2(ax - 0.17, (q.y - 0.07) * 1.1)) - 0.17, w2 = length(vec2(ax - 0.12, (q.y + 0.13) * 1.3)) - 0.11, bd = max(abs(q.x) - 0.025, abs(q.y) - 0.19);
        float dd = min(min(w1, w2), bd); if (dd > 0.0) discard; vec3 c = bd < 0.0 ? vec3(0.1, 0.08, 0.06) : vC * (0.7 + 0.45 * smoothstep(-0.14, 0.0, dd)); gl_FragColor = vec4(c, vA); }` });
  bfPts = new THREE.Points(g, m); bfPts.frustumCulled = false; bfPts.name = 'props_butterflies'; FW.add(bfPts); STATS.butterflies = n;
}
// 하늘의 새 떼 (지역마다 이야기 색): 침식지 · 성채 까마귀(가시가 물러나면 떠나요) · 협곡 독수리 · 호수 갈매기 · 언덕 제비 · 신전 위 까마귀
const FLOCKS = [
  { c: [-40, 470], r: 26, h: 30, n: 7, col: 0x2a2c34, sp: 0.42, s: 0.75 }, { c: [10, 120], r: 70, h: 24, n: 6, col: 0xf2f2ec, sp: 0.16, s: 1.1 }, { c: [436, -410], r: 32, h: 48, n: 4, col: 0x2a2018, sp: 0.14, s: 2.0 },
  { c: [0, -392], r: 44, h: 42, n: 8, col: 0x16121a, sp: 0.22, s: 1.0, key: 'thorns_recede' }, { c: [-62, -322], r: 30, h: 30, n: 6, col: 0x16121a, sp: -0.26, s: 0.9, key: 'thorns_recede' },
  { c: [-445, -312], r: 38, h: 54, n: 5, col: 0x2a2a30, sp: 0.2, s: 1.0 }, { c: [442, 120], r: 30, h: 26, n: 5, col: 0x22201a, sp: -0.2, s: 1.0, key: 'mist_thin' }, { c: [-420, 262], r: 34, h: 40, n: 6, col: 0x2a2c26, sp: 0.25, s: 0.85 },
].filter(f => !LOW || f.n >= 6);
const BIRDG = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.32, -1, 0.18, -0.1, 0, 0, -0.18, 0, 0, 0.32, 0, 0, -0.18, 1, 0.18, -0.1, 0, 0.05, 0.42, -0.09, 0, -0.32, 0.09, 0, -0.32, 0, 0.02, -0.25, -0.18, 0, -0.55, 0.18, 0, -0.55], 3)); g.computeVertexNormals(); return g; })();
const NB = FLOCKS.reduce((a, f) => a + f.n, 0);
const birdIM = new THREE.InstancedMesh(BIRDG, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), Math.max(1, NB)); birdIM.frustumCulled = false; birdIM.name = 'props_birds'; FW.add(birdIM);
{ let i = 0; const c = new THREE.Color(); for (const f of FLOCKS){ f.i0 = i; f.ph = R() * 10; if (f.key) keyI(f.key); f.y = Math.max(H(f.c[0], f.c[1]), WL) + f.h; for (let k = 0; k < f.n; k++) birdIM.setColorAt(i++, c.setHex(f.col)); } if (birdIM.instanceColor) birdIM.instanceColor.needsUpdate = true; }
// 굴 토끼 (굴 둘레에서 놀다 플레이어가 오면 굴로 쏙)
const RBN = Math.min(BUR.length * 2, LOW ? 4 : 8);
const rbGeo = (() => { const parts = [[new THREE.SphereGeometry(0.16, 8, 6), 0, 0.15, 0, 1, 0.9, 1.25], [new THREE.SphereGeometry(0.11, 8, 6), 0, 0.3, 0.16, 1, 1, 1], [new THREE.CapsuleGeometry(0.03, 0.16, 2, 5), -0.045, 0.45, 0.13, 1, 1, 1], [new THREE.CapsuleGeometry(0.03, 0.16, 2, 5), 0.045, 0.45, 0.13, 1, 1, 1], [new THREE.SphereGeometry(0.06, 6, 4), 0, 0.18, -0.2, 1, 1, 1]];
  return G.mergeGeos(parts.map(([g, x, y, z, sx, sy, sz]) => g.applyMatrix4(G.mat(x, y, z, 0, 0, 0, sx, sy, sz)))); })();
const rbIM = new THREE.InstancedMesh(rbGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), Math.max(1, RBN)); rbIM.frustumCulled = false; rbIM.castShadow = !LOW; rbIM.name = 'props_rabbits'; rbIM.visible = false; FW.add(rbIM);
const RB = Array.from({ length: RBN }, (_, i) => { rbIM.setColorAt(i, new THREE.Color(pick([0xf4f0ea, 0xd8c0a0, 0xb08a6a]))); return { b: null, x: 0, z: 0, ry: 0, st: 0, t: rr(0, 3), hop: { fx: 0, fz: 0, tx: 0, tz: 0, k: 1, T: 0.35 }, sink: 0, cool: 0 }; });
STATS.burrows = BUR.length;
// 은빛 호수 물고기 (호수가 맑아지면 자주 뛰어요) + 물결 고리
const LAKE = (W.lakes || []).find(l => l.id === 'silvermere');
const fishGeo = G.mergeGeos([new THREE.SphereGeometry(0.16, 8, 6).applyMatrix4(G.mat(0, 0, 0, 0, 0, 0, 0.55, 0.7, 1.4)), new THREE.ConeGeometry(0.12, 0.2, 4).applyMatrix4(G.mat(0, 0, -0.28, -Math.PI / 2, 0, 0, 1, 1, 0.4))]);
const fishIM = new THREE.InstancedMesh(fishGeo, new THREE.MeshStandardMaterial({ color: 0xd0dce8, metalness: 0.6, roughness: 0.25 }), 2); fishIM.frustumCulled = false; fishIM.visible = false; fishIM.name = 'props_fish'; FW.add(fishIM);
const ripIM = new THREE.InstancedMesh(new THREE.RingGeometry(0.85, 1, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 4); ripIM.frustumCulled = false; ripIM.visible = false; ripIM.name = 'props_ripples'; FW.add(ripIM);
const FJ = [{ on: false, t: 0, x: 0, z: 0, ry: 0, wy: 0 }, { on: false, t: 0, x: 0, z: 0, ry: 0, wy: 0 }], RP = Array.from({ length: 4 }, () => ({ on: false, t: 0, x: 0, z: 0, y: 0, s: 1 }));
let fishT = 4;
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _sv = new V3(), _pv = new V3(), _col = new THREE.Color();
const setI = (im, i, x, y, z, rx, ry, rz, sx, sy, sz) => { _q.setFromEuler(_e.set(rx, ry, rz)); _m4.compose(_pv.set(x, y, z), _q, _sv.set(sx, sy, sz)); im.setMatrixAt(i, _m4); };
const hideI = (im, i) => setI(im, i, 0, -999, 0, 0, 0, 0, 0.001, 0.001, 0.001);
for (let i = 0; i < NB; i++) hideI(birdIM, i); for (let i = 0; i < RBN; i++) hideI(rbIM, i); for (let i = 0; i < 2; i++) hideI(fishIM, i); for (let i = 0; i < 4; i++) hideI(ripIM, i);
function ripple(x, y, z, s){ const o = RP.find(r => !r.on); if (!o) return; o.on = true; o.t = 0; o.x = x; o.y = y + 0.04; o.z = z; o.s = s; }
function critters(dt, px, pz){
  const t = MU.uTime.value;
  // 새 떼
  let any = false;
  for (const f of FLOCKS){ const d = Math.hypot(px - f.c[0], pz - f.c[1]), gone = f.key ? UK[keyI(f.key)] : 0;
    if (d > 460 || gone > 0.98){ for (let k = 0; k < f.n; k++) hideI(birdIM, f.i0 + k); continue; } any = true;
    for (let k = 0; k < f.n; k++){ const a = t * f.sp + k * 0.5 + f.ph, r = f.r + Math.sin(k * 1.7 + t * 0.3) * 4 + gone * 60, x = f.c[0] + Math.cos(a) * r, z = f.c[1] + Math.sin(a) * r, y = f.y + Math.sin(t * 0.5 + k) * 2.5 + k * 0.5 + gone * 40;
      const glide = Math.sin(t * 0.7 + k * 1.3 + f.ph) > 0.2, fl = glide ? 0.3 : Math.sin(t * 10 + k * 1.3), sg = Math.sign(f.sp) || 1, sc = f.s * (1 - gone * 0.6);
      setI(birdIM, f.i0 + k, x, y, z, 0, Math.atan2(-Math.sin(a) * sg, Math.cos(a) * sg), -0.3 * sg, sc, fl * sc, sc); } }
  birdIM.instanceMatrix.needsUpdate = true; birdIM.visible = any;
  // 토끼
  if (RBN){ let on = 0;
    for (let i = 0; i < RBN; i++){ const o = RB[i];
      if (!o.b){ o.cool -= dt; if (o.cool > 0){ hideI(rbIM, i); continue; } let best = null, bd = 70; for (const b of BUR){ const d = Math.hypot(px - b.x, pz - b.z); if (d < bd && d > 14 && RB.filter(q => q.b === b).length < 2){ bd = d; best = b; } }
        if (!best){ hideI(rbIM, i); o.cool = 1; continue; } o.b = best; o.x = best.x; o.z = best.z; o.st = 1; o.sink = 1; o.t = rr(0.5, 2); o.ry = R() * TAU; o.hop.k = 1; }
      const b = o.b, pd = Math.hypot(o.x - px, o.z - pz), bd = Math.hypot(b.x - px, b.z - pz);
      if (bd > 90){ o.b = null; hideI(rbIM, i); continue; }
      if (o.st === 1){ o.sink = Math.max(0, o.sink - dt * 2); if (!o.sink) o.st = 2; }   // 굴에서 나와요
      else if (o.st === 2){ o.t -= dt;
        if (pd < 9 && o.hop.k >= 1){ o.st = 3; o.hop.fx = o.x; o.hop.fz = o.z; o.hop.tx = b.x; o.hop.tz = b.z; o.hop.k = 0; o.hop.T = Math.max(0.15, Math.hypot(b.x - o.x, b.z - o.z) / 7); o.ry = Math.atan2(b.x - o.x, b.z - o.z); }
        else if (o.t <= 0 && o.hop.k >= 1){ const a = Math.hypot(o.x - b.x, o.z - b.z) > 4 ? Math.atan2(b.x - o.x, b.z - o.z) + rr(-0.6, 0.6) : o.ry + rr(-1.2, 1.2), L = rr(0.4, 0.9); o.hop.fx = o.x; o.hop.fz = o.z; o.hop.tx = o.x + Math.sin(a) * L; o.hop.tz = o.z + Math.cos(a) * L; o.hop.k = 0; o.hop.T = 0.35; o.ry = a; o.t = rr(0.8, 3.2); } }
      else if (o.st === 3 && o.hop.k >= 1){ o.sink = Math.min(1, o.sink + dt * 3); if (o.sink >= 1){ o.st = 4; o.t = rr(5, 9); } }   // 굴로 쏙
      else if (o.st === 4){ o.t -= dt; if (o.t <= 0 && bd > 16){ o.st = 1; o.sink = 1; } }
      let y = 0, nib = 0;
      if (o.hop.k < 1){ o.hop.k = Math.min(1, o.hop.k + dt / o.hop.T); const k = o.hop.k; o.x = lerp(o.hop.fx, o.hop.tx, k); o.z = lerp(o.hop.fz, o.hop.tz, k); y = Math.sin(k * Math.PI) * (o.st === 3 ? 0.4 : 0.3); }
      else nib = Math.max(0, Math.sin(t * 7 + i)) * 0.15;
      if (o.st === 4){ hideI(rbIM, i); continue; } on++;
      setI(rbIM, i, o.x, H(o.x, o.z) + y - o.sink * 0.55, o.z, nib, o.ry, 0, 1, 1, 1); }
    rbIM.instanceMatrix.needsUpdate = true; rbIM.visible = on > 0; }
  // 물고기 (은빛 호수)
  if (LAKE){ const dl = Math.hypot((px - LAKE.c[0]) / (LAKE.rx + 90), (pz - LAKE.c[1]) / (LAKE.rz + 90)), clear = UK[keyI('lake_clear')];
    if (dl < 1){ fishT -= dt; if (fishT <= 0){ fishT = clear > 0.5 ? rr(2.5, 6) : rr(9, 18);
        for (let tr = 0; tr < 8; tr++){ const a = R() * TAU, r = rr(20, 85), x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r; if (Math.hypot((x - LAKE.c[0]) / LAKE.rx, (z - LAKE.c[1]) / LAKE.rz) > 0.85 || !(F.waterDepth && F.waterDepth(x, z) > 1.2)) continue;
          const o = FJ.find(f => !f.on); if (!o) break; o.on = true; o.t = 0; o.x = x; o.z = z; o.ry = R() * TAU; o.wy = WY(x, z); ripple(x, o.wy, z, 0.7); break; } } }
    let on = false;
    FJ.forEach((o, i) => { if (!o.on){ hideI(fishIM, i); return; } on = true; o.t += dt; const k = o.t / 0.9; if (k >= 1){ o.on = false; hideI(fishIM, i); ripple(o.x + Math.sin(o.ry) * 1.6, o.wy, o.z + Math.cos(o.ry) * 1.6, 1.0); return; }
      setI(fishIM, i, o.x + Math.sin(o.ry) * k * 1.6, o.wy + Math.sin(k * Math.PI) * 1.1 - 0.15, o.z + Math.cos(o.ry) * k * 1.6, -Math.cos(k * Math.PI) * 1.1, o.ry, Math.sin(o.t * 20) * 0.2, 1.4, 1.4, 1.4); });
    fishIM.instanceMatrix.needsUpdate = true; fishIM.visible = on;
    let ron = false; RP.forEach((o, i) => { if (!o.on){ hideI(ripIM, i); return; } ron = true; o.t += dt; const k = o.t / 1.4; if (k >= 1){ o.on = false; hideI(ripIM, i); return; } const sc = o.s * (0.3 + k * 1.6); setI(ripIM, i, o.x, o.y, o.z, 0, 0, 0, sc, 1, sc); ripIM.setColorAt(i, _col.setScalar(0.5 * (1 - k))); });
    ripIM.instanceMatrix.needsUpdate = true; if (ripIM.instanceColor) ripIM.instanceColor.needsUpdate = true; ripIM.visible = ron; }
}

// ═════════════════════════ 세상의 변화 · API ═════════════════════════
function colSync(i){ const v = UK[i]; for (const e of COLS){ if (e.k !== i) continue; const want = e.mode === 2 ? v >= 0.5 : v < 0.5; if (e.on === want) continue; e.on = want; if (want) F.addCollider(e.c); else F.removeCollider(e.c); } }
// 인스턴스 키(줍는 물건 하나 · 검은 웅덩이 하나)는 부모 키(lake_clear …)가 켜져도 같이 켜져요
function linkSync(){ for (const [a, b] of LINKS){ const v = Math.max(sst(CHS[a].cur), UK[b]); if (v !== UK[a]){ UK[a] = v; colSync(a); } } }
function setKey(key, on, instant){ const i = KEYS.indexOf(key); if (i <= 0) return false; const c = CHS[i]; c.tgt = on ? 1 : 0; if (instant){ c.cur = c.tgt; UK[i] = c.tgt; colSync(i); linkSync(); } return true; }
function setChange(key, on = true, instant = false){ if (!key || !USED.has(key) || key.startsWith('pk:')) return false; return setKey(key, on, instant || !F.inField); }
const pkCols = (pk, on) => { if (pk.colOn === on) return; pk.colOn = on; for (const c of pk.cols) on ? F.addCollider(c) : F.removeCollider(c); };
const nearP = r => Math.hypot(X.player.pos.x - r.x, X.player.pos.z - r.z) < 170;
// 줍는 물건 켜기/끄기: 들고 갈 수 있는 것은 통째로, 붙박이(골렘 잔해 · 검은 웅덩이 …)는 반짝이는 표시만
function show(id, on = true){ const r = SPX.get(id); if (!r || !r.pk) return false; on = !!on; if (on && r.got) return false;
  r.pk.on = on; showMotes(r.pk.i, on); if (r.portable){ r.pk.g.visible = on && nearP(r); pkCols(r.pk, on); } return true; }
// 주웠어요: 들고 갈 수 있는 것은 사라지고, 붙박이는 표시가 꺼지며 그 물건 부분만 (검은 웅덩이는 맑은 물로) 바뀌어요
function collected(id, instant = false){ const r = SPX.get(id); if (!r || !r.pk) return false; r.got = true; r.pk.on = false; showMotes(r.pk.i, false);
  if (r.portable){ r.pk.g.visible = false; pkCols(r.pk, false); } else if (r.ik) setKey(r.ik, true, instant || !F.inField); return true; }
const noteName = n => { n = String(n || ''); const i = n.indexOf(' — '); return (i > 0 ? n.slice(0, i) : n.replace(/\s*\(.*$/, '')).trim(); };
const API = {
  obj: id => (SPX.get(id) || {}).obj || null,
  pos: id => { const r = SPX.get(id); return r ? [r.x, r.y, r.z] : null; },
  show, setChange, collected,
  isFixture: id => { const r = SPX.get(id); return !!r && !r.portable; },
  name: id => { const r = SPX.get(id); return r ? noteName(r.note) || r.kind : null; },
  list: kind => [...SPX.values()].filter(r => !kind || r.kind === kind).map(r => ({ id: r.id, kind: r.kind, region: r.region, c: [r.x, r.z], pickup: r.pickup, fixture: !r.portable, shown: r.pk ? r.pk.on : true, collected: !!r.got })),
  keys: () => [...USED].filter(k => !k.startsWith('pk:')), state: key => { const i = KEYS.indexOf(key); return i > 0 ? CHS[i].tgt : 0; },
  stats: STATS,
};
F.props = API;

// ═════════════════════════ 거리로 켜고 끄기 · 매 프레임 ═════════════════════════
const VIEW = LOW ? 175 : 245;
function cull(px, pz){
  for (const c of CL) c.g.visible = Math.hypot(px - c.x, pz - c.z) < VIEW;
  for (const p of PKS) if (p.g) p.g.visible = p.on && Math.hypot(px - p.x, pz - p.z) < 170;
}
const nightTarget = () => { if (typeof F.timeOfDay === 'number'){ const k = Math.abs(F.timeOfDay - 0.5) * 2; return clamp((k - 0.4) / 0.2, 0, 1); } if (typeof F.isNight === 'function') return F.isNight() ? 1 : 0; return 0; };
let cullT = 0, nightK = 0;
G.hooks.push((dt, rdt) => {
  // 변화는 필드 밖에서도 흘러가요 (돌아왔을 때 끝나 있게)
  let moved = false;
  for (let i = 1; i < KEYS.length; i++){ const c = CHS[i]; if (c.cur === c.tgt) continue; moved = true; c.cur = c.tgt > c.cur ? Math.min(c.tgt, c.cur + rdt / 2) : Math.max(c.tgt, c.cur - rdt / 2); UK[i] = sst(c.cur); if (c.cur === c.tgt) colSync(i); }
  if (moved && LINKS.length) linkSync();
  if (!F.inField) return;
  MU.uTime.value += dt;
  const px = X.player.pos.x, pz = X.player.pos.z;
  cullT -= rdt; if (cullT <= 0){ cullT = 0.25; cull(px, pz); }
  nightK += (nightTarget() - nightK) * Math.min(1, rdt * 1.5); MU.uNight.value = nightK;
  GU.value = innerHeight * G.renderer.getPixelRatio() * 0.5 / Math.tan(G.camera.fov * Math.PI / 360);
  critters(Math.min(dt, 0.1), px, pz);
});
// 걸을 수 있는 판: F.groundFn 을 한 번 감싸요 (다른 모듈이 다시 감싸도 무한히 돌지 않게 — 다시 들어오면 감싸기 전 함수로)
if (PLAT.length){ const prevGround = F.groundFn; let inG = false;
  F.groundFn = (x, z) => { if (inG) return prevGround(x, z); inG = true; try { const g = prevGround(x, z), y = platY(x, z); return y > g ? y : g; } finally { inG = false; } }; }
// 처음 필드에 들어올 때 (순간이동 화면 뒤에서) 셰이더를 미리 컴파일 — 가까이 가서 끊기지 않게
let compiled = false;
BUS.on('enterField', () => { cullT = 0; if (compiled) return; compiled = true;
  try { for (const c of CL) c.g.visible = true; for (const p of PKS) if (p.g) p.g.visible = true; G.renderer.compile(FW, G.camera, G.scene); } catch (e){ console.warn('[props] 미리 컴파일 실패', e); }
  cull(X.player.pos.x, X.player.pos.z); });

const ms = Math.round(performance.now() - T0);
console.log(`[props] 셋피스 ${STATS.setpieces} (줍기 ${STATS.pickups}) · 길가 ${STATS.roadside} (이정석 ${STATS.milestones}) · 작은 장면 ${STATS.vignettes} · 칸 ${STATS.cells} · ${Math.round(STATS.tris / 1000)}k 삼각형 · 빛 ${STATS.glows} · 떠다니는 빛 ${STATS.motes} · 나비 ${STATS.butterflies} · 굴 ${STATS.burrows} · 새 ${NB} · 충돌체 ${STATS.colliders} · 변화 키 ${[...USED].join(',')} · ${ms}ms` + (STATS.fallback.length ? ` · 짐작: ${STATS.fallback.join(', ')}` : ''));
STATS.ms = ms;
return API;
}
