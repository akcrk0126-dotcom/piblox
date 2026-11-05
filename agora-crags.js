// 룬 아고라 — 모험의 대지: 바위 지형 (agora-crags.js)
// 젤다 BotW 처럼 땅이 「요란하게」 이야기를 하도록 — 언덕 · 능선 꼭대기의 바위 왕관 · 협곡 후두(줄무늬 붉은 기둥) · 균형 바위 · 고원 돌기둥 · 쓰러진 거석
//   · 호숫가 바다 기둥 · 서리 얼음 첨탑 · 침식지 흑요석 파편(보라 빛 틈) · 바위 아치 · 절벽 층리 턱 · 절벽 바위 면 · 절벽 아래 너덜 · 떠돌이 바위(빙하 표석)
// 계약서: docs/agora-modules.md — 필드 물체는 F.FW 에 절대 y (= F.H(x, z)). 결정적(시드 해시)이라 언제 들어와도 같은 자리에 같은 바위.
// 자리는 데이터로 골라요: 바이옴(F.biomeAt) · 언덕(F.hills 중간 · 큰 것, 탑 언덕 빼고) · 국소 최고점(F.H 능선 마루) · 경사(F.slope = 절벽).
// 비켜 가는 곳: 랜드마크 r+6 · 정착지 r+6 · 사냥터 r×0.6 · 룬 비석 10m · NPC 6m · 길 가장자리 5m · 물(바다 기둥만 예외) · 룬 탑 15m(+3) · 다리 · 승강 룬
//   · 상승 기류 · 경사로 · 하늘길 · 협곡 바닥 · 낚시터 · 이정표 · lore 주민 · 읽을거리 · 셋피스(8m) · 수호석 · 이야기 보스 · 'reach' 목표
//   · rpg 의 고정 숨김 자리 (황금 상자 · 룬 정령 — 'top' 은 12m, 나머지 7m · 판석 4m) · world 나무 · 큰 바위 줄기.
// 무리(양보 단위): 바위 하나 · 후두 하나 · 판석 하나 … = 조각들 + 충돌체. 무리마다 정점의 XZ 볼록 껍질(발자국)을 들고 있어서
//   ① 다 만들고 나면 발자국으로 비켜 갈 곳 · 길을 다시 봐요 (기운 이빨 끝 · 긴 판석 끝까지) ② world 나무 줄기가 발자국 안이면 그 무리를 지워요
//   ③ fieldReady 때 나중 모듈(landmarks · towns · props · life · rpg · saga · raid …)이 놓은 충돌체 · 상호작용 · rpg 상자/채집물/정령이
//     발자국 안에 있으면 그 무리를 지워요 (충돌체도 함께) — 그래서 메시는 fieldReady 뒤에 만들어요.
// 그리는 법: 바위 조각마다 정점을 비틀고(지터) 평면으로 깎아(넓은 면) 각진 돌을 만들어요 → 200m 칸마다 재질별로 병합 (칸 = 드로콜 1~2).
//   그림자: 큰 것(왕관 · 첨탑 · 표석 · 아치 …)만 100m 조각 메시로 따로 모아 castShadow — 경계 구가 작아서 ±64m 그림자 카메라 밖은 그림자 패스에서 빠져요.
//   판석 · 너덜 · 잔돌은 그림자를 드리우지 않아요 (받기만).
//   가까운 칸(플레이어에서 칸 사각형까지 ≤ NEAR)은 자세한 모양. 그 밖의 큰 실루엣(첨탑 · 아치 · 왕관 · 표석)은 세상 전체 「먼 메시」 한 장이 맡아요.
//   먼 메시는 정점마다 제 칸 중심(aCell)을 들고 있어서 셰이더가 「가까운 칸」 것을 지워요 — JS 와 같은 기준이라 두 번 그려지거나 구멍이 나지 않아요.
//   색은 정점색 (sRGB → 셰이더에서 선형): 바이옴 색 · 협곡 줄무늬(높이 띠) · 위를 보는 면의 이끼/눈/먼지 · 바닥 쪽 어둡게(가림) · 지의류 점 · 흑요석 틈의 보라 빛 · 얼음 속 빛.
//   절벽 판석은 지형 바위색(world PAL 의 바위색)에 맞춰요 — 층리(협곡 · 고원)는 몇 개의 고정 높이 띠를 따라 등고선으로 길게 이어진 거의 수평인 턱, 설원 · 침식지는 가파른 곳 몇 군데에 모인 바위 면.
// 충돌: 지름 ~1m 넘는 것은 F.circle / F.box. 절벽 판석은 비탈에 붙은 「껍질」이라 충돌체가 없어요 (절벽에서 뛰어내려 글라이더 타는 길을 막지 않게).
// 땅에 붙이기: 조각마다 아래쪽 점들을 F.H 와 견줘서 떠 있으면 내려요 (settle). 얹힌 것(덮개돌 · 균형 바위 · 아치 위 돌)만 공중. ?cragcheck 로 뜬 조각을 세요 (STATS.floating).
// 이름 있는 봉우리 · 능선 (namedTerrain) · rpg 'top' 자리 꼭대기는 비우고 둘레만 이빨 바위로 둘러요 (rpg 상자 · 룬 정령이 올라가는 자리).
// F 에 올리는 것: F.crags = { list: [{ kind, x, z, r, biome, name? … }], stats, at(x, z, pad) → 그 자리 바위 무리 { kind, x, z, r, y0, y1 } | null, names: 이름 붙은 아치 }
//   (at 은 무리 발자국(볼록 껍질)으로 재요 — crags init 이 끝나면 바로 쓸 수 있어요. landmarks · props · rpg 가 빈 땅에 물건을 놓을 때 F.crags.at(x, z, 1.5) 로 바위 속을 피하면 좋아요.
//    아치 다리는 양보하지 않으니 특히 — fieldReady 양보는 그 밖의 바위를 지워서 맞춰 줘요)
export async function init(G, X, F){
const { THREE, V3, BUS, TAU } = X;
const W = F.WORLD, FW = F.FW, HALF = W.half, WL = W.water;
const LOW = G.gfxMode === 'low' || G.IS_TOUCH;
const T0 = performance.now();
const idle = () => new Promise(r => setTimeout(r, 0));
const CHECK = typeof location !== 'undefined' && /cragcheck/.test(location.search);   // ?cragcheck: 조각마다 뜬 것(가장 낮은 점이 땅 위)을 세요 (테스트용)
const STATS = { crowns: 0, ridges: 0, hoodoos: 0, balanced: 0, pillars: 0, monoliths: 0, stacks: 0, ice: 0, obsidian: 0, spires: 0, arches: 0, plates: 0, strata: 0, talus: 0, erratics: 0,
  colliders: 0, pieces: 0, groups: 0, tris: 0, casterTris: 0, casters: 0, farTris: 0, cells: 0, byBiome: {}, killed: {}, rej: {}, ms: 0, phase: {} };
let LORE = [];
try { LORE = (await import('./lore/index.js')).LORE || []; } catch (e){ console.warn('[crags] lore 를 못 읽었어요', e); }

// ───────────────────────── 결정적 난수 · 수학 ─────────────────────────
const hash = (i, j, s = 0) => { let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const hashS = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
let _s = 1;
const srand = s => { _s = (s >>> 0) || 1; };
const R = () => { _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rr = (a, b) => a + (b - a) * R();
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sst = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
let SEED = 1;   // 조각마다 다른 씨앗
const nseed = () => (SEED = (SEED + 7919) | 0);
// 값 노이즈 (40m 격자) — 판석이 고르게 흩어지지 않고 몇 곳에 모이게
const vnoise = (x, z, s, cs = 40) => { const fx = x / cs, fz = z / cs, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  return lerp(lerp(hash(i, j, s), hash(i + 1, j, s), su), lerp(hash(i, j + 1, s), hash(i + 1, j + 1, s), su), sv); };

// ───────────────────────── 땅 · 물 · 길 ─────────────────────────
const H = (x, z) => F.H(x, z);
const WY = (x, z) => F.waterY ? F.waterY(x, z) : WL;
const isW = (x, z) => F.isWater(x, z);
const slope = (x, z) => F.slope(x, z);
const BIOME = (x, z) => F.biomeAt ? F.biomeAt(x, z) : ((F.regionAt(x, z) || {}).biome || 'meadow');
const SEGS = [];
for (const rd of W.roads) for (let i = 0; i < rd.pts.length - 1; i++){ const [ax, az] = rd.pts[i], [bx, bz] = rd.pts[i + 1]; SEGS.push({ ax, az, ex: bx - ax, ez: bz - az, l2: (bx - ax) ** 2 + (bz - az) ** 2 || 1, w: rd.w }); }
const roadD = F.roadDist ? (x, z) => F.roadDist(x, z) : (x, z) => { let b = 1e9; for (const s of SEGS){ const t = clamp(((x - s.ax) * s.ex + (z - s.az) * s.ez) / s.l2, 0, 1), d = Math.hypot(x - s.ax - s.ex * t, z - s.az - s.ez * t) - s.w / 2; if (d < b) b = d; } return b; };
// 발자국 [최저, 최고] 지면 높이 (원 r, 8방향 × 2겹)
function foot(x, z, r){ let lo = H(x, z), hi = lo; if (r > 0.2) for (let i = 0; i < 8; i++){ const a = i * 0.785398, c = Math.cos(a) * r, s = Math.sin(a) * r; for (const k of [0.55, 1]){ const h = H(x + c * k, z + s * k); if (h < lo) lo = h; if (h > hi) hi = h; } } return [lo, hi]; }
const wetR = (x, z, r) => { if (isW(x, z)) return true; for (let i = 0; i < 8; i++){ const a = i * 0.785398; if (isW(x + Math.cos(a) * r, z + Math.sin(a) * r)) return true; } return false; };
const safeAt = (x, z) => { const g = F.regionAt(x, z); return !g || g.safe; };
// 지형 법선 (정규화)
const _nv = [0, 1, 0];
function tnorm(x, z, e = 1.5){ const gx = (H(x + e, z) - H(x - e, z)) / (2 * e), gz = (H(x, z + e) - H(x, z - e)) / (2 * e), l = Math.hypot(gx, 1, gz); _nv[0] = -gx / l; _nv[1] = 1 / l; _nv[2] = -gz / l; return _nv; }

// ───────────────────────── world 식생 줄기 (나무 · 큰 바위 · 그루터기 · 통나무) ─────────────────────────
// world 가 F.circle(x, z, tr·s + 0.12) 로 막아 둔 것들 — 8m 격자. vegD = 가장 가까운 줄기 가장자리까지 거리.
const VTAB = F.modules && F.modules.world && F.modules.world._dbg && F.modules.world._dbg.VT;
const VG = new Map(), VGS = 8; let vgN = 0;
const vgAdd = (x, z, r, y) => { const k = Math.floor(x / VGS) * 4099 + Math.floor(z / VGS); let L = VG.get(k); if (!L) VG.set(k, L = []); L.push(x, z, r, y); vgN++; };
if (VTAB) for (const T of Object.values(VTAB)){ if (!T || !T.n || !T.D || !(T.tr || T.log)) continue;
  for (let i = 0; i < T.n; i++){ const o = i * 8, x = T.D[o], z = T.D[o + 2], s = T.D[o + 4];
    if (T.tr) vgAdd(x, z, T.tr * s + 0.12, T.D[o + 1]);
    else { const c = Math.cos(T.D[o + 3]), sn = Math.sin(T.D[o + 3]); for (const k of [-0.75, 0, 0.75]) vgAdd(x + c * 2.2 * s * k, z - sn * 2.2 * s * k, 0.4 * s + 0.1, T.D[o + 1]); } } }
function vegD(x, z){ if (!vgN) return 99; let best = 99; const i0 = Math.floor((x - 14) / VGS), i1 = Math.floor((x + 14) / VGS), j0 = Math.floor((z - 14) / VGS), j1 = Math.floor((z + 14) / VGS);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++){ const L = VG.get(i * 4099 + j); if (!L) continue; for (let q = 0; q < L.length; q += 4){ const d = Math.hypot(L[q] - x, L[q + 1] - z) - L[q + 2]; if (d < best) best = d; } }
  return best; }

// ───────────────────────── 비워 둘 곳 (40m 격자) ─────────────────────────
// [x, z, r(바위), rp(절벽 판석 · 너덜: -1 = 막지 않음)]
const KG = new Map(), KGS = 40;
function keepAdd(x, z, r, rp = r){ const m = Math.max(r, rp), i0 = Math.floor((x - m) / KGS), i1 = Math.floor((x + m) / KGS), j0 = Math.floor((z - m) / KGS), j1 = Math.floor((z + m) / KGS), e = [x, z, r, rp];
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++){ const k = i * 4099 + j; let L = KG.get(k); if (!L) KG.set(k, L = []); L.push(e); } }
function kept(x, z, r, plate = false){ const i0 = Math.floor((x - r) / KGS), i1 = Math.floor((x + r) / KGS), j0 = Math.floor((z - r) / KGS), j1 = Math.floor((z + r) / KGS);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++){ const L = KG.get(i * 4099 + j); if (!L) continue;
    for (const e of L){ const q = plate ? e[3] : e[2]; if (q < 0) continue; const m = q + r; if ((x - e[0]) ** 2 + (z - e[1]) ** 2 < m * m) return true; } }
  return false; }
const capsule = (a, b, r, rp = r, step = 6) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / step)); for (let i = 0; i <= n; i++) keepAdd(lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n), r, rp); };
for (const l of W.landmarks) keepAdd(l.c[0], l.c[1], l.r + 6);   // 판석도 r+6 (메사 벽 예외는 없앴어요 — 붉은 탁자 바위 밧줄 사다리를 가렸거든요)
// 용의 등뼈 능선 랜드마크는 능선을 따라 뼈가 늘어서 있어요 (중심 ±130m)
for (const l of W.landmarks) if (l.type === 'ridge_mark') for (const rg of W.ridges || []) for (let i = 0; i < rg.pts.length - 1; i++){ const a = rg.pts[i], b = rg.pts[i + 1];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 10); for (let k = 0; k <= n; k++){ const x = lerp(a[0], b[0], k / n), z = lerp(a[1], b[1], k / n); if (Math.abs(x - l.c[0]) < 135) keepAdd(x, z, 30); } }
for (const t of W.settlements || []){ keepAdd(t.c[0], t.c[1], t.r + 6); if (t.dock) keepAdd(t.dock[0], t.dock[1], 14); }
for (const c of W.camps) keepAdd(c.c[0], c.c[1], c.r * 0.6);
for (const w of W.waypoints) keepAdd(w.c[0], w.c[1], 10);
for (const n of W.npcs) keepAdd(n.c[0], n.c[1], 6);
for (const f of W.fishing || []) keepAdd(f.c[0], f.c[1], 6);
for (const s of W.signposts || []) keepAdd(s.c[0], s.c[1], 4);
for (const b of W.bridges || []) keepAdd(b.c[0], b.c[1], b.len / 2 + 6);
for (const l of W.lifts || []){ keepAdd(l.from[0], l.from[1], 10); keepAdd(l.to[0], l.to[1], 10); }
for (const m of W.mesas || []) keepAdd(m.c[0], m.c[1], m.r * 1.25 + 4, -1);   // 세계의 메사 · 첨탑 위엔 안 올려요 (랜드마크가 아닌 메사의 벽 판석은 좋아요)
for (const sp of W.spirals || []) keepAdd(sp.c[0], sp.c[1], sp.r0 + 8);          // 하늘길 (나선 산길) 전체
for (const r0 of W.ramps || []) capsule(r0.from, r0.to, r0.w / 2 + 6);
for (const g of W.gorges || []) for (let i = 0; i < g.pts.length - 1; i++) capsule(g.pts[i], g.pts[i + 1], g.w / 2 + 3, -1, 8);   // 협곡 바닥은 길이에요 (벽 판석은 좋아요)
for (const n of W.namedTerrain || []) if (n.kind !== 'river') keepAdd(n.c[0], n.c[1], 6, -1);   // 이름 있는 지형 한가운데 (rpg 상자 · 정령이 올라가요)
for (const L of W.lakes) if (L.frozen) keepAdd(L.c[0], L.c[1], Math.max(L.rx, L.rz) + 4);
for (const s of W.islands || []) keepAdd(s.c[0], s.c[1], s.r * 1.4);
for (const t of F.towers || []) keepAdd(t.x, t.z, 18, 15);
for (const u of F.updrafts || []) keepAdd(u.x, u.z, u.r + 4);
for (const L of LORE){
  for (const r of (L.settlement && L.settlement.residents) || []){ if (r.c) keepAdd(r.c[0], r.c[1], 4); if (r.home) keepAdd(r.home[0], r.home[1], 4); }
  for (const o of [...(L.readables || []), ...(L.bosses || []), ...(L.keystone ? [L.keystone] : [])]) if (o && o.c) keepAdd(o.c[0], o.c[1], 4);
  for (const o of L.setpieces || []) if (o && o.c) keepAdd(o.c[0], o.c[1], 8);   // 셋피스는 발자국이 4.5~7.5m (towns SPR) — 그 밖으로 4m 더
  for (const q of L.quests || []) for (const o of q.o || []) if (o.t === 'reach' && o.c) keepAdd(o.c[0], o.c[1], Math.max(4, o.r || 6));
}
// rpg 의 고정 숨김 자리 — 황금 상자 (agora-rpg.js SPECIAL) · 룬 정령 (SPIRIT_SPOTS). [x, z, mode] — mode 'top' 은 rpg 가 둘레 ±6m 에서 가장 높은 곳으로 옮겨요.
// (복사본이에요: rpg 가 바꾸면 여기도 — WORLD.rpgSpots 로 옮겨지면 그걸 읽어요. 놓친 것은 fieldReady 양보가 한 번 더 잡아요)
const RPG_SPOTS = W.rpgSpots || [
  [360, -320, 'top'], [560, -400, 'top'], [482, -134, 'top'], [336, -116, 'g'], [-248, 404, 'g'], [110, -206, 'g'], [250, -672, 'top'], [-200, -528, 'top'], [26, 84, 'g'], [-640, 640, 'g'], [20, -612, 'g'],
  [22, 604, 'w'], [0, 644, 'g'], [-164, 460, 'g'], [126, 408, 'g'], [102, 532, 'g'], [-50, 350, 'g'], [184, 332, 'g'], [-250, 396, 'h'], [-212, 410, 'g'], [-40, 150, 'w'], [6, 92, 'g'], [-98, 62, 'g'],
  [-39, -57.5, 'w'], [185, 150.5, 'w'], [-60, -160, 'w'], [-420, 262, 'g'], [-300, 400, 'g'], [-545, 362, 'h'], [-482, 160, 'w'], [-560, 450, 'g'], [300, 302, 'h'], [352, 188, 'g'], [458, 104, 'g'], [440, 232, 'w'],
  [326, -126, 'g'], [360, -320, 'top'], [492, -125, 'g'], [532, -332, 'top'], [560, -400, 'top'], [436, -410, 'h'], [-445, -298, 'g'], [-300, -370, 'g'], [200, -528, 'top'], [250, -672, 'top'], [-200, -662, 'top'], [20, -612, 'g'],
];
for (const [x, z, m] of RPG_SPOTS) if (m === 'top') keepAdd(x, z, 12, 9); else keepAdd(x, z, 7, 4);
// 꼭대기를 비워 두고 둘레만 이빨 바위로 두르는 곳: [x, z, 고리 반지름]
const TOPS = [...(W.namedTerrain || []).filter(o => o.kind === 'peak' || o.kind === 'ridge').map(o => [o.c[0], o.c[1], 9]), ...RPG_SPOTS.filter(s => s[2] === 'top').map(s => [s[0], s[1], 15])];
// 내가 놓은 것 (겹치지 않게): 24m 격자
const PG = new Map(), PGS = 24;
function placed(x, z, r){ const m = r + 30, i0 = Math.floor((x - m) / PGS), i1 = Math.floor((x + m) / PGS), j0 = Math.floor((z - m) / PGS), j1 = Math.floor((z + m) / PGS);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++){ const L = PG.get(i * 4099 + j); if (L) for (const [a, b, q] of L) if ((x - a) ** 2 + (z - b) ** 2 < (r + q) ** 2) return true; } return false; }
function mark(x, z, r){ const k = Math.floor(x / PGS) * 4099 + Math.floor(z / PGS); let L = PG.get(k); if (!L) PG.set(k, L = []); L.push([x, z, Math.min(r, 30)]); }
// 바위 하나가 설 수 있는 자리인가 (r = 발자국 반지름)
let WHY = '';   // clearAt 이 마지막으로 거절한 까닭 (STATS.rej 에 세요)
function clearAt(x, z, r, o = {}){
  const lim = (o.edge || 700) - r; if (Math.abs(x) > lim || Math.abs(z) > lim){ WHY = 'edge'; return false; }
  if (safeAt(x, z)){ WHY = 'safe'; return false; }
  if (!o.wet && wetR(x, z, r * 0.85 + 0.5)){ WHY = 'wet'; return false; }
  if (!o.road && roadD(x, z) < 5 + r){ WHY = 'road'; return false; }
  if (kept(x, z, r)){ WHY = 'keep'; return false; }
  if (!o.nopg && placed(x, z, r)){ WHY = 'placed'; return false; }
  if (vegD(x, z) < Math.min(r, 4) * 0.7){ WHY = 'veg'; return false; }   // 나무 · 큰 바위 줄기 위에 세우지 않아요
  return true;
}
const rej = (k, why) => { const o = STATS.rej[k] || (STATS.rej[k] = {}); o[why] = (o[why] || 0) + 1; };

// ───────────────────────── 색 (sRGB 0~1) ─────────────────────────
const hx = h => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
// base: 바위색 3가지 · top: 위를 보는 면 (이끼 · 눈 · 먼지) · topMin: 그 면의 기울기 문턱 (법선 y) · lichen: 지의류 점 · dark: 바닥 가림 · band: 협곡 줄무늬
const BP = {
  meadow:  { base: [0xa39d90, 0x948e82, 0xb3ad9d], top: 0x6f9a46, topMin: 0.5, topK: 0.85, lichen: 0xc8c47a, dark: 0.56 },
  forest:  { base: [0x878b7f, 0x777c70, 0x94978b], top: 0x4e7c34, topMin: 0.4, topK: 0.95, lichen: 0x9ab06a, dark: 0.5 },
  lake:    { base: [0xaeb0aa, 0x9d9f98, 0xbebdb2], top: 0x74a04e, topMin: 0.52, topK: 0.8, lichen: 0xd0d8a0, dark: 0.58 },
  swamp:   { base: [0x686c5a, 0x5c604f, 0x74765f], top: 0x4a6c2c, topMin: 0.32, topK: 1, lichen: 0x8a9a5a, dark: 0.5 },
  canyon:  { base: [0xb4633c, 0xc27448, 0xa25838], band: [0xd8a06a, 0xb85e3a, 0xecc898, 0x94482c, 0xc8784a, 0xe2b482, 0xa8502f], top: 0xdcae7c, topMin: 0.7, topK: 0.45, dark: 0.62 },
  plateau: { base: [0xaba495, 0x9c9586, 0xbab4a4], top: 0xeef2f4, topMin: 0.64, topK: 0.72, lichen: 0xd4a440, dark: 0.58 },
  blight:  { base: [0x241c2c, 0x1b1520, 0x2c2236], top: 0x3e3048, topMin: 0.62, topK: 0.35, glow: 0xa448e8, dark: 0.75 },
  snow:    { base: [0x6e7886, 0x626c78, 0x7e8896], top: 0xf4f8fc, topMin: 0.5, topK: 0.92, lichen: 0xa8b4c0, dark: 0.62 },
};
// 절벽 판석 · 너덜: 지형의 바위색 (world PAL[바이옴][3]) 에 맞춰요 — 둘레 비탈과 한 덩어리로 읽히게. top 은 정말 평평한 턱에만.
const TROCK = { meadow: 0x8c8a80, forest: 0x6e6b5e, lake: 0x8c8a80, swamp: 0x5e5947, canyon: 0xab5936, plateau: 0x948c7d, blight: 0x40364a, snow: 0x788292 };
const PP = {
  meadow:  { top: 0x5f8040, topMin: 0.8, topK: 0.45, lichen: 0xb8b47a, dark: 0.55 },
  forest:  { top: 0x45662c, topMin: 0.75, topK: 0.55, lichen: 0x8aa060, dark: 0.5 },
  lake:    { top: 0x648a44, topMin: 0.8, topK: 0.45, lichen: 0xc0c890, dark: 0.55 },
  swamp:   { top: 0x44602a, topMin: 0.72, topK: 0.6, lichen: 0x7a8a50, dark: 0.5 },
  canyon:  { top: 0xc8905e, topMin: 0.8, topK: 0.35, dark: 0.68, bandM: [1.12, 0.86, 1.03, 0.8, 0.96, 1.18, 0.92] },
  plateau: { top: 0xb0aa98, topMin: 0.8, topK: 0.35, lichen: 0xc09a48, dark: 0.68, bandM: [1.08, 0.9, 1.0, 0.84, 1.12, 0.95] },
  blight:  { top: 0x3e3048, topMin: 0.8, topK: 0.2, glow: 0xa448e8, dark: 0.7 },
  snow:    { top: 0xf0f4f8, topMin: 0.62, topK: 0.95, lichen: 0xa8b4c0, dark: 0.6 },
};
for (const k in BP){ const p = BP[k]; p.base = p.base.map(hx); p.top = hx(p.top); if (p.lichen) p.lichen = hx(p.lichen); if (p.band) p.band = p.band.map(hx); if (p.glow) p.glow = hx(p.glow); }
for (const k in PP){ const p = PP[k], c = hx(TROCK[k]); p.c = c; p.base = [c, [c[0] * 0.93, c[1] * 0.93, c[2] * 0.95], [c[0] * 1.06, c[1] * 1.05, c[2] * 1.04]]; p.top = hx(p.top); if (p.lichen) p.lichen = hx(p.lichen); if (p.glow) p.glow = hx(p.glow); }
BP.village = BP.meadow; PP.village = PP.meadow;   // (변환한 뒤에 같은 것을 가리켜요 — 두 번 바꾸면 NaN)
// 층리 띠마다 한 가지 색 (같은 턱은 끝까지 같은 색 → 지층처럼 읽혀요)
const PPB = new Map();
function bandPal(b, bi){ const P = PP[b]; if (!P.bandM) return P; const key = b + bi; let Q = PPB.get(key); if (Q) return Q;
  const m = P.bandM[((bi % P.bandM.length) + P.bandM.length) % P.bandM.length], c = [P.c[0] * m, P.c[1] * m * (m > 1 ? 1.03 : 1), P.c[2] * m * (m > 1 ? 1.04 : 1)];
  Q = Object.assign({}, P, { base: [c, [c[0] * 0.94, c[1] * 0.94, c[2] * 0.95], [c[0] * 1.05, c[1] * 1.04, c[2] * 1.03]] }); PPB.set(key, Q); return Q; }
const STACKB = [0xb8b6ae, 0x9a978e, 0xc8c4b8, 0x8a877e, 0xaaa69c].map(hx);   // 바다 기둥 퇴적 줄무늬
const ICE_D = hx(0x3f7fc0), ICE_L = hx(0xcff0ff), ICE_W = hx(0xf6fbff);
const _col = [0, 0, 0];
function mix3(c, t, k){ c[0] += (t[0] - c[0]) * k; c[1] += (t[1] - c[1]) * k; c[2] += (t[2] - c[2]) * k; }
// 바위: 낮은 주파수 얼룩 + 정점 지터 + 줄무늬 + 바닥 가림 + 지의류 + 위 면 (이끼 · 눈)
function paintRock(o, x, y, z, nx, ny, nz, i, c){
  const P = o.pal, b = P.base[o.bi | 0], lf = Math.sin(x * 0.19 + z * 0.13 + y * 0.07) * 0.5 + Math.sin(x * 0.05 - z * 0.08 + y * 0.21) * 0.5;
  const k = (1 + lf * 0.08 + (hash(o.seed, i, 5) - 0.5) * 0.13) * (o.tone || 1);
  c[0] = b[0] * k; c[1] = b[1] * k; c[2] = b[2] * k;
  const BA = o.band || P.band; if (BA && !o.noband){ const q = y * 0.42 + Math.sin(x * 0.045 + z * 0.037) * 1.3 + (hash(o.seed, i, 6) - 0.5) * 0.3, L = BA.length; mix3(c, BA[((Math.floor(q) % L) + L) % L], o.bandK ?? 0.62); }
  const ao = lerp(P.dark, 1, sst(o.y0 - 0.4, o.y0 + Math.min(o.h * 0.42, 4.5), y)); c[0] *= ao; c[1] *= ao; c[2] *= ao;
  if (P.lichen && hash(o.seed, i, 8) < 0.06) mix3(c, P.lichen, 0.55);
  if (ny > P.topMin - 0.2){ const t = sst(P.topMin, P.topMin + 0.2, ny + (hash(o.seed, i, 7) - 0.5) * 0.3) * P.topK * (o.topK ?? 1); if (t > 0) mix3(c, P.top, t); }
}
// 얼음: 밑은 짙은 파랑 → 끝은 밝은 하늘색, 위 면에 서리
function paintIce(o, x, y, z, nx, ny, nz, i, c){
  const t = clamp((y - o.y0) / o.h, 0, 1), j = 1 + (hash(o.seed, i, 5) - 0.5) * 0.1;
  c[0] = lerp(ICE_D[0], ICE_L[0], Math.pow(t, 0.8)) * j; c[1] = lerp(ICE_D[1], ICE_L[1], Math.pow(t, 0.8)) * j; c[2] = Math.min(1, lerp(ICE_D[2], ICE_L[2], Math.pow(t, 0.8)) * j);
  if (ny > 0.6) mix3(c, ICE_W, sst(0.6, 0.9, ny) * 0.6);
}
// 흑요석: 거의 검은 몸 + 틈(무작위 정점) · 끝이 보라로 빛나요 (재질이 이 색을 발광으로 써요)
function paintObs(o, x, y, z, nx, ny, nz, i, c){
  const P = BP.blight, b = P.base[o.bi | 0], k = 1 + (hash(o.seed, i, 5) - 0.5) * 0.25, t = clamp((y - o.y0) / Math.max(1, o.h), 0, 1);
  c[0] = b[0] * k; c[1] = b[1] * k; c[2] = b[2] * k;
  const g = Math.min(1, (hash(o.seed, i, 9) < (o.seam ?? 0.13) ? 0.85 : 0) + sst(0.82, 1, t) * (o.tipGlow ?? 0.8));
  if (g > 0) mix3(c, P.glow, g * 0.85);
}

// ───────────────────────── 병합 빌더 (위치 · 법선 Int8 · 색 Uint8 · [먼 메시: 칸 중심]) ─────────────────────────
// drop = [시작 인덱스, 개수, …] — 지운 무리의 삼각형은 geo() 때 빼요
class GB {
  constructor(far){ this.nv = 0; this.ni = 0; this.vc = 2048; this.ic = 6144; this.P = new Float32Array(this.vc * 3); this.N = new Int8Array(this.vc * 3); this.C = new Uint8Array(this.vc * 3); this.A = far ? new Int16Array(this.vc * 2) : null; this.I = new Uint32Array(this.ic); this.drop = null; }
  need(v, i){
    if (this.nv + v > this.vc){ let c = this.vc; while (this.nv + v > c) c *= 2; const g = (a, k) => { const b = new a.constructor(c * k); b.set(a); return b; }; this.P = g(this.P, 3); this.N = g(this.N, 3); this.C = g(this.C, 3); if (this.A) this.A = g(this.A, 2); this.vc = c; }
    if (this.ni + i > this.ic){ let c = this.ic; while (this.ni + i > c) c *= 2; const b = new Uint32Array(c); b.set(this.I); this.I = b; this.ic = c; }
  }
  geo(){
    if (!this.nv) return null; let I = this.I.subarray(0, this.ni);
    if (this.drop && this.drop.length){ const D = []; for (let k = 0; k < this.drop.length; k += 2) D.push([this.drop[k], this.drop[k + 1]]); D.sort((a, b) => a[0] - b[0]);
      const out = new Uint32Array(this.ni); let o = 0, p = 0; for (const [s, n] of D){ if (s > p){ out.set(I.subarray(p, s), o); o += s - p; } p = Math.max(p, s + n); } if (p < this.ni){ out.set(I.subarray(p), o); o += this.ni - p; } I = out.subarray(0, o); }
    if (!I.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.P.slice(0, this.nv * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(this.N.slice(0, this.nv * 3), 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(this.C.slice(0, this.nv * 3), 3, true)); if (this.A) g.setAttribute('aCell', new THREE.BufferAttribute(this.A.slice(0, this.nv * 2), 2));
    g.setIndex(new THREE.BufferAttribute(this.nv > 65535 ? I.slice() : Uint16Array.from(I), 1)); g.computeBoundingSphere(); return g;
  }
}
// 칸 (200m × 64): 재질별 빌더 B (그림자 안 드리움) + 100m 조각 T (그림자 드리우는 큰 것)
const CSZ = 200, CHF = CSZ / 2, CN = Math.round(HALF * 2 / CSZ), CELLS = new Array(CN * CN), FB = new GB(true), TSZ = 100, TN = CSZ / TSZ;
function cellOf(x, z){ const i = clamp(Math.floor((x + HALF) / CSZ), 0, CN - 1), j = clamp(Math.floor((z + HALF) / CSZ), 0, CN - 1), k = j * CN + i;
  return CELLS[k] || (CELLS[k] = { i, j, cx: -HALF + (i + 0.5) * CSZ, cz: -HALF + (j + 0.5) * CSZ, B: {}, T: {}, plates: 0 }); }

// ───────────────────────── 무리 (함께 지우는 단위) ─────────────────────────
// gBegin → (stone · shard · tube+emit · circleCol …) → gEnd. 발자국 = 자세한 조각 정점의 XZ 볼록 껍질 · 높이 범위.
// o.cast: 그림자 조각(50m)에 넣어요 · o.keep: 지우지 않아요 (아치 몸통) · o.plate: 비켜 갈 곳을 판석 반지름으로 봐요
const GRP = [], GG = new Map(), GGS = 16; let GC = null, QID = 0;
const _hx = [], _hz = [];
function gBegin(kind, x, z, o = {}){ GC = { kind, x, z, cast: !LOW && !!o.cast, keep: !!o.keep, plate: !!o.plate, parts: [], cols: [], y0: 1e9, y1: -1e9, dead: false, q: 0 }; _hx.length = 0; _hz.length = 0; return GC; }
function hull2(xs, zs){
  const n = xs.length; if (!n) return new Float32Array(0);
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => xs[a] - xs[b] || zs[a] - zs[b]), cr = (o, a, b) => (xs[a] - xs[o]) * (zs[b] - zs[o]) - (zs[a] - zs[o]) * (xs[b] - xs[o]), Lo = [], Up = [];
  for (const i of idx){ while (Lo.length >= 2 && cr(Lo[Lo.length - 2], Lo[Lo.length - 1], i) <= 0) Lo.pop(); Lo.push(i); }
  for (let k = n - 1; k >= 0; k--){ const i = idx[k]; while (Up.length >= 2 && cr(Up[Up.length - 2], Up[Up.length - 1], i) <= 0) Up.pop(); Up.push(i); }
  Lo.pop(); Up.pop(); const h = Lo.concat(Up); if (!h.length) h.push(idx[0]); const out = new Float32Array(h.length * 2); h.forEach((i, k) => { out[k * 2] = xs[i]; out[k * 2 + 1] = zs[i]; }); return out;
}
// 볼록 껍질까지 거리 (안이면 음수)
function hullDist(h, x, z){ const n = h.length / 2; if (!n) return 1e9; if (n < 3){ let b = 1e9; for (let k = 0; k < n; k++) b = Math.min(b, Math.hypot(x - h[k * 2], z - h[k * 2 + 1])); return b; }
  let inside = true, best = 1e9;
  for (let k = 0; k < n; k++){ const k2 = (k + 1) % n, ax = h[k * 2], az = h[k * 2 + 1], ex = h[k2 * 2] - ax, ez = h[k2 * 2 + 1] - az, px = x - ax, pz = z - az;
    if (ex * pz - ez * px < 0) inside = false; const t = clamp((px * ex + pz * ez) / (ex * ex + ez * ez || 1), 0, 1), d = Math.hypot(px - ex * t, pz - ez * t); if (d < best) best = d; }
  return inside ? -best : best; }
function gEach(x, z, pad, fn){ const q = ++QID, i0 = Math.floor((x - pad) / GGS), i1 = Math.floor((x + pad) / GGS), j0 = Math.floor((z - pad) / GGS), j1 = Math.floor((z + pad) / GGS);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++){ const L = GG.get(i * 4099 + j); if (L) for (const g of L){ if (g.q === q) continue; g.q = q; fn(g); } } }
function kill(g, why){ if (g.dead || !g.parts) return; g.dead = true;
  for (let k = 0; k < g.parts.length; k += 3){ const B = g.parts[k]; (B.drop || (B.drop = [])).push(g.parts[k + 1], g.parts[k + 2]); }
  for (const c of g.cols){ F.removeCollider(c); STATS.colliders--; } g.cols.length = 0; STATS.killed[why] = (STATS.killed[why] || 0) + 1; }
// 발자국 정하기 + 격자에 올리기 (다시 정하면 새 칸에 더 올려요 — gEach 가 겹친 것을 걸러요)
function gHull(g, h){
  g.hull = h; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; const n = h.length / 2;
  for (let k = 0; k < n; k++){ const x = h[k * 2], z = h[k * 2 + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  g.cx = (x0 + x1) / 2; g.cz = (z0 + z1) / 2; g.r = Math.hypot(x1 - x0, z1 - z0) / 2;
  const i0 = Math.floor((g.cx - g.r) / GGS), i1 = Math.floor((g.cx + g.r) / GGS), j0 = Math.floor((g.cz - g.r) / GGS), j1 = Math.floor((g.cz + g.r) / GGS);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++){ const k = i * 4099 + j; let L = GG.get(k); if (!L) GG.set(k, L = []); L.push(g); }
}
function gEnd(){
  const g = GC; GC = null; if (!g || !g.parts.length) return null;
  gHull(g, hull2(_hx, _hz)); const h = g.hull, n = h.length / 2;
  GRP.push(g); STATS.groups++;
  // 발자국으로 다시 보기: 기운 이빨 끝 · 긴 판석 끝이 비켜 갈 곳 · 길에 들어가면 무리째 빼요
  if (!g.keep && n){ for (let k = 0; k < n; k++){ const k2 = (k + 1) % n; for (const t of [0, 0.5]){ const x = lerp(h[k * 2], h[k2 * 2], t), z = lerp(h[k * 2 + 1], h[k2 * 2 + 1], t);
      if (kept(x, z, 0.3, g.plate)){ kill(g, 'keep'); return g; } if (roadD(x, z) < (g.plate ? 1.5 : 2.5)){ kill(g, 'road'); return g; } } } }
  return g;
}
const bOf = (cell, k) => {
  if (GC && GC.cast && k !== 'ice'){ const ti = clamp(Math.floor((GC.x - (cell.cx - CHF)) / TSZ), 0, TN - 1), tj = clamp(Math.floor((GC.z - (cell.cz - CHF)) / TSZ), 0, TN - 1), key = k + ':' + (tj * TN + ti); return cell.T[key] || (cell.T[key] = new GB(false)); }
  return cell.B[k] || (cell.B[k] = new GB(false)); };

// ───────────────────────── 조각 작업대 ─────────────────────────
const MAXV = 6000, TP = new Float32Array(MAXV * 3), TNM = new Float32Array(MAXV * 3), TI = new Uint32Array(MAXV * 6), CD = new Float32Array(16);
let tv = 0, ti = 0;
const M3 = new Float32Array(9), _m4 = new THREE.Matrix4(), _eu = new THREE.Euler();
// 회전: 방위(ry) 먼저, 그다음 기울기 (rz → rx) — 'XZY'
function rot3(rx, ry, rz){ _eu.set(rx, ry, rz, 'XZY'); _m4.makeRotationFromEuler(_eu); const e = _m4.elements; M3[0] = e[0]; M3[1] = e[1]; M3[2] = e[2]; M3[3] = e[4]; M3[4] = e[5]; M3[5] = e[6]; M3[6] = e[8]; M3[7] = e[9]; M3[8] = e[10]; }
function basis3(X0, Y0, Z0){ M3[0] = X0[0]; M3[1] = X0[1]; M3[2] = X0[2]; M3[3] = Y0[0]; M3[4] = Y0[1]; M3[5] = Y0[2]; M3[6] = Z0[0]; M3[7] = Z0[1]; M3[8] = Z0[2]; }
// 단위 다면체 틀 (공유 정점으로 합쳐서 인덱스 메시)
function dedupe(g0){ const p = g0.attributes.position, map = new Map(), P = [], I = [];
  for (let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i), key = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4); let id = map.get(key); if (id === undefined){ id = P.length / 3; P.push(x, y, z); map.set(key, id); } I.push(id); }
  g0.dispose(); const r = Math.max(...P.map(Math.abs)); return { P: new Float32Array(P.map(v => v / r)), I: new Uint16Array(I), nv: P.length / 3, ni: I.length }; }
const TPL = { ico0: dedupe(new THREE.IcosahedronGeometry(1, 0)), ico1: dedupe(new THREE.IcosahedronGeometry(1, 1)), ico2: dedupe(new THREE.IcosahedronGeometry(1, 2)), dod: dedupe(new THREE.DodecahedronGeometry(1, 0)) };
// 틀 → 작업대: 지터 · 깎기(평면) · 크기 · 회전(M3) · 이동
function rock(T, o){
  const P = T.P, n = T.nv, s = o.seed, nc = Math.min(4, o.cuts | 0), jit = o.jit ?? 0.16;
  for (let k = 0; k < nc; k++){ const dx = hash(s, k, 31) - 0.5, dy = (hash(s, k, 32) - 0.5) * (o.cutY ?? 1), dz = hash(s, k, 33) - 0.5, l = Math.hypot(dx, dy, dz) || 1; CD[k * 4] = dx / l; CD[k * 4 + 1] = dy / l; CD[k * 4 + 2] = dz / l; CD[k * 4 + 3] = 0.5 + hash(s, k, 34) * 0.32; }
  for (let i = 0; i < n; i++){
    const f = 1 + (hash(s, i, 7) - 0.5) * 2 * jit; let x = P[i * 3] * f, y = P[i * 3 + 1] * f, z = P[i * 3 + 2] * f;
    for (let k = 0; k < nc; k++){ const d = x * CD[k * 4] + y * CD[k * 4 + 1] + z * CD[k * 4 + 2] - CD[k * 4 + 3]; if (d > 0){ x -= CD[k * 4] * d; y -= CD[k * 4 + 1] * d; z -= CD[k * 4 + 2] * d; } }
    x *= o.sx; y *= o.sy; z *= o.sz;
    TP[i * 3] = o.x + M3[0] * x + M3[3] * y + M3[6] * z; TP[i * 3 + 1] = o.y + M3[1] * x + M3[4] * y + M3[7] * z; TP[i * 3 + 2] = o.z + M3[2] * x + M3[5] * y + M3[8] * z;
  }
  TI.set(T.I); tv = n; ti = T.ni;
}
// 관(고리 → 고리): 기둥 · 후두 · 아치 · 거석 · 얼음 · 흑요석 모두 이걸로. ring = [cx, cy, cz, e1(3), e2(3), r1, r2, 비틀림] (e1 × e2 = -진행 방향)
function tube(RG, S, o){
  tv = 0; ti = 0; const K = RG.length, s = o.seed, jit = o.jit ?? 0.12, aj = o.aj ?? 0.35;
  for (let k = 0; k < K; k++){ const g = RG[k];
    for (let q = 0; q < S; q++){ const h = k * 131 + q, a = (q + (hash(s, h, 3) - 0.5) * aj) / S * TAU + (g[11] || 0), j = 1 + (hash(s, h, 4) - 0.5) * 2 * jit, ca = Math.cos(a) * g[9] * j, sa = Math.sin(a) * g[10] * j;
      TP[tv * 3] = g[0] + g[3] * ca + g[6] * sa; TP[tv * 3 + 1] = g[1] + g[4] * ca + g[7] * sa; TP[tv * 3 + 2] = g[2] + g[5] * ca + g[8] * sa; tv++; } }
  for (let k = 0; k < K - 1; k++) for (let q = 0; q < S; q++){ const a = k * S + q, b = k * S + (q + 1) % S, c = a + S, d = b + S; TI[ti++] = a; TI[ti++] = c; TI[ti++] = b; TI[ti++] = b; TI[ti++] = c; TI[ti++] = d; }
  // 끝 (뾰족 · 둥근 · 평평): 진행 방향으로 o.tip 만큼 나온 가운데 점
  if (o.tip != null){ const g = RG[K - 1], p = RG[K - 2], dx = g[0] - p[0], dy = g[1] - p[1], dz = g[2] - p[2], l = Math.hypot(dx, dy, dz) || 1, c = tv, top = (K - 1) * S;
    TP[c * 3] = g[0] + dx / l * o.tip + (o.tipOff ? o.tipOff[0] : 0); TP[c * 3 + 1] = g[1] + dy / l * o.tip; TP[c * 3 + 2] = g[2] + dz / l * o.tip + (o.tipOff ? o.tipOff[1] : 0); tv++;
    for (let q = 0; q < S; q++){ TI[ti++] = top + q; TI[ti++] = c; TI[ti++] = top + (q + 1) % S; } }
  if (o.tip0 != null){ const g = RG[0], p = RG[1], dx = g[0] - p[0], dy = g[1] - p[1], dz = g[2] - p[2], l = Math.hypot(dx, dy, dz) || 1, c = tv;
    TP[c * 3] = g[0] + dx / l * o.tip0; TP[c * 3 + 1] = g[1] + dy / l * o.tip0; TP[c * 3 + 2] = g[2] + dz / l * o.tip0; tv++;
    for (let q = 0; q < S; q++){ TI[ti++] = q; TI[ti++] = (q + 1) % S; TI[ti++] = c; } }
}
// 축 방향 A 에 맞는 고리 틀 (e1 ⟂ A, e2 = e1 × A → e1 × e2 = -A)
const _e1 = [1, 0, 0], _e2 = [0, 0, 1];
function frame(ax, ay, az){ let x = ay * 1 - az * 0, y = az * 0 - ax * 1, z = ax * 0 - ay * 0;   // A × (0,0,1)
  let l = Math.hypot(x, y, z); if (l < 1e-3){ x = 1; y = 0; z = 0; l = 1; } x /= l; y /= l; z /= l; _e1[0] = x; _e1[1] = y; _e1[2] = z;
  _e2[0] = y * az - z * ay; _e2[1] = z * ax - x * az; _e2[2] = x * ay - y * ax; }
// 세로 기둥 고리들: prof(t) → 반지름 배수, 기울기(lx, lz: 높이 1m 당 옆으로)
function columnRings(x, z, y0, h, r, K, prof, lx = 0, lz = 0, sq = 1, twist = 0){
  const RG = [], l = Math.hypot(lx, 1, lz), ax = lx / l, ay = 1 / l, az = lz / l; frame(ax, ay, az);
  for (let k = 0; k < K; k++){ const t = k / (K - 1), rad = r * prof(t, k); RG.push([x + lx * t * h, y0 + t * h, z + lz * t * h, _e1[0], _e1[1], _e1[2], _e2[0], _e2[1], _e2[2], rad, rad * sq, twist * t]); }
  return RG;
}
// 땅에 붙이기: 작업대 조각의 아래쪽(높이 아래 frac 부분) 어느 점도 땅 밑에 있지 않으면 (= 떠 있음) 땅에 pad 만큼 묻히게 내려요
function settle(frac = 0.35, pad = 0.15){
  let y0 = 1e9, y1 = -1e9; for (let i = 0; i < tv; i++){ const y = TP[i * 3 + 1]; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const lim = y0 + (y1 - y0) * frac; let mn = 1e9;
  for (let i = 0; i < tv; i++){ const y = TP[i * 3 + 1]; if (y > lim) continue; const d = y - H(TP[i * 3], TP[i * 3 + 2]); if (d < mn) mn = d; }
  if (mn > -pad){ const k = mn + pad; for (let i = 0; i < tv; i++) TP[i * 3 + 1] -= k; return k; } return 0;
}
// 작업대 → 빌더: 법선(면 법선 모음) · 색 · (먼 메시면 칸 중심) — 무리 안이면 범위 · 발자국 점을 모아요
function emit(B, o, paint){
  TNM.fill(0, 0, tv * 3);
  for (let t = 0; t < ti; t += 3){ const a = TI[t] * 3, b = TI[t + 1] * 3, c = TI[t + 2] * 3, ux = TP[b] - TP[a], uy = TP[b + 1] - TP[a + 1], uz = TP[b + 2] - TP[a + 2], vx = TP[c] - TP[a], vy = TP[c + 1] - TP[a + 1], vz = TP[c + 2] - TP[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; TNM[a] += nx; TNM[a + 1] += ny; TNM[a + 2] += nz; TNM[b] += nx; TNM[b + 1] += ny; TNM[b + 2] += nz; TNM[c] += nx; TNM[c + 1] += ny; TNM[c + 2] += nz; }
  B.need(tv, ti); const base = B.nv;
  if (GC){ GC.parts.push(B, B.ni, ti); if (!B.A) for (let i = 0; i < tv; i++){ const y = TP[i * 3 + 1]; _hx.push(TP[i * 3]); _hz.push(TP[i * 3 + 2]); if (y < GC.y0) GC.y0 = y; if (y > GC.y1) GC.y1 = y; } }
  for (let i = 0; i < tv; i++){ const o3 = (base + i) * 3, i3 = i * 3; let nx = TNM[i3], ny = TNM[i3 + 1], nz = TNM[i3 + 2]; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const x = TP[i3], y = TP[i3 + 1], z = TP[i3 + 2]; B.P[o3] = x; B.P[o3 + 1] = y; B.P[o3 + 2] = z; B.N[o3] = Math.round(nx * 127); B.N[o3 + 1] = Math.round(ny * 127); B.N[o3 + 2] = Math.round(nz * 127);
    paint(o, x, y, z, nx, ny, nz, i, _col); B.C[o3] = clamp(_col[0] * 255, 0, 255); B.C[o3 + 1] = clamp(_col[1] * 255, 0, 255); B.C[o3 + 2] = clamp(_col[2] * 255, 0, 255);
    if (B.A){ B.A[(base + i) * 2] = o.cx; B.A[(base + i) * 2 + 1] = o.cz; } }
  for (let t = 0; t < ti; t++) B.I[B.ni + t] = base + TI[t];
  B.nv += tv; B.ni += ti; STATS.pieces++;
  if (CHECK && !B.A){ let mn = 1e9, mx = 0, mz = 0; for (let i = 0; i < tv; i++){ const d = TP[i * 3 + 1] - H(TP[i * 3], TP[i * 3 + 2]); if (d < mn){ mn = d; mx = TP[i * 3]; mz = TP[i * 3 + 2]; } }
    if (mn > 0.05 && !o.air){ STATS.floating = (STATS.floating || 0) + 1; (STATS.floatSample || (STATS.floatSample = [])).length < 30 && STATS.floatSample.push([Math.round(mx), Math.round(mz), +mn.toFixed(2), o.kind || '']); } }
}
const PAINT = { rock: paintRock, ice: paintIce, obs: paintObs };
// 바위 조각 하나: o = { x, z, gy(바닥), r(반지름), h(높이), sink(0~1), lean, dir, tpl, far, mat, pal, cut, jit, seed … }
function stone(cell, o){
  const tpl = TPL[o.tpl || 'ico1'], sy = o.h / 2, sink = o.sink ?? 0.25;   // 틀의 y ∈ [-1, 1] → 바닥 = gy - sink·h, 꼭대기 = gy + (1 - sink)·h
  const lean = o.lean || 0, d = o.dir || 0;
  rot3(lean * Math.sin(d), o.ry ?? 0, -lean * Math.cos(d));
  const p = { x: o.x, y: o.gy + sy - sink * o.h, z: o.z, sx: o.r * (o.ax ?? 1), sy, sz: o.r * (o.az ?? 1), jit: o.jit ?? 0.17, cuts: o.cuts ?? 2, cutY: o.cutY ?? 1, seed: o.seed || nseed() };
  rock(tpl, p); const dn = o.air ? 0 : settle(); p.y -= dn;
  const po = { pal: o.pal, bi: o.bi ?? (p.seed % 3 + 3) % 3, seed: p.seed, y0: o.gy, h: o.h * (1 - sink), topK: o.topK, tone: o.tone, noband: o.noband, seam: o.seam, tipGlow: o.tipGlow, air: o.air, kind: o.kind };
  const mat = o.mat || 'rock'; emit(bOf(cell, mat), po, PAINT[mat]);
  if (o.far){ const pf = Object.assign({}, p, { y: p.y - 0.6, sy: p.sy * 1.08, jit: p.jit * 0.6, cuts: Math.min(1, p.cuts) }); rock(TPL[o.farTpl || 'ico0'], pf);
    po.cx = cell.cx; po.cz = cell.cz; emit(FB, po, PAINT[mat]); }
  return p.seed;
}
function circleCol(x, z, r){ if (r < 0.75) return null; const c = F.circle(x, z, r); STATS.colliders++; if (GC) GC.cols.push(c); return c; }
function boxCol(x, z, hw, hd, ry){ const c = F.box(x, z, hw, hd, ry); STATS.colliders++; if (GC) GC.cols.push(c); return c; }
// 기록
const LIST = [];
function cnt(kind, b, n = 1){ const B = STATS.byBiome[b] || (STATS.byBiome[b] = {}); B[kind] = (B[kind] || 0) + n; }
function rec(kind, x, z, r, b, extra){ const o = Object.assign({ kind, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, r: Math.round(r * 10) / 10, biome: b }, extra || {}); LIST.push(o); mark(x, z, r); return o; }

// ═════════════════════════ 1) 바위 아치 (6~10개, 큰 셋은 이름) ═════════════════════════
// 다리는 거의 수직으로 솟아 둥글게 넘어가요: y(s) = 두 다리 바닥 보간 + 높이 × sin(πs)^0.55. 아래로 걸어서 · 글라이더로 지나갈 수 있게 4m+ 틈을 검사해요.
const ARCH_SLOTS = [
  { reg: 'canyon', bio: 'canyon', span: [34, 44], h: [24, 31], w: [5.2, 6.8], name: '말발굽 아치', gap: 9 },
  { reg: 'plateau', bio: 'plateau', span: [30, 40], h: [24, 32], w: [5, 6.4], name: '하늘 문', gap: 9 },
  { reg: 'greenhill', bio: 'meadow', span: [20, 28], h: [13, 18], w: [3.6, 4.8], name: '여우 다리', gap: 5 },
  { reg: 'canyon', bio: 'canyon', span: [20, 28], h: [14, 20], w: [3.8, 5.2], gap: 5 },
  { reg: 'canyon', bio: 'canyon', span: [13, 19], h: [10, 14], w: [3, 4.2], gap: 4.5 },
  { reg: 'plateau', bio: 'plateau', span: [16, 24], h: [12, 17], w: [3.4, 4.8], gap: 4.5 },
  { reg: 'woods', bio: 'forest', span: [15, 21], h: [10, 14], w: [3, 4.2], gap: 4.5 },
  { reg: 'frost', bio: 'snow', span: [18, 26], h: [14, 20], w: [3.8, 5.2], gap: 5 },
  { reg: 'greenhill', bio: 'meadow', span: [12, 17], h: [8, 11], w: [2.6, 3.6], gap: 4 },
];
function archP(a, s){ const sc = clamp(s, 0, 1), y = lerp(a.yA, a.yB, sc) + a.h * Math.pow(Math.sin(Math.PI * sc), 0.55) + (s < 0 ? s * 40 : s > 1 ? (1 - s) * 40 : 0); return [lerp(a.A[0], a.B[0], sc), y, lerp(a.A[1], a.B[1], sc)]; }
const archT = (a, s) => { const f = Math.abs(2 * clamp(s, 0, 1) - 1); return lerp(a.t0, a.t1, f * f); };
const archW = (a, s) => { const f = Math.abs(2 * clamp(s, 0, 1) - 1); return lerp(a.w0, a.w1, f * f) * (1 + 0.12 * Math.sin(s * 9 + a.seed % 7)); };
function archRings(a, K){
  const RG = [], ex = -a.uz, ez = a.ux;   // 가로축 (아치 평면에 수직, 수평)
  for (let k = 0; k < K; k++){ const u = k / (K - 1), s = -0.07 + 1.14 * (0.5 - 0.5 * Math.cos(Math.PI * u)), p = archP(a, s), p1 = archP(a, s - 0.004), p2 = archP(a, s + 0.004);
    let tx = p2[0] - p1[0], ty = p2[1] - p1[1], tz = p2[2] - p1[2]; const l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
    const e2x = 0 * tz - ez * ty, e2y = ez * tx - ex * tz, e2z = ex * ty - 0 * tx;   // e2 = e1 × T
    RG.push([p[0], p[1], p[2], ex, 0, ez, e2x, e2y, e2z, archW(a, s) / 2, archT(a, s) / 2, 0]); }
  return RG;
}
const ARCHES = [];
{ const tA = performance.now();
  ARCH_SLOTS.forEach((sl, si) => {
    const reg = F.regionById(sl.reg); if (!reg) return; srand(hashS('arch:' + si + ':' + sl.reg));
    for (let t = 0; t < 700; t++){
      const an = R() * TAU, d = Math.sqrt(R()) * reg.r * 0.92, cx = reg.c[0] + Math.cos(an) * d, cz = reg.c[1] + Math.sin(an) * d;
      if (BIOME(cx, cz) !== sl.bio) continue;
      const span = rr(...sl.span), h = rr(...sl.h), w = rr(...sl.w), ax = R() * Math.PI, ux = Math.cos(ax), uz = Math.sin(ax);
      const A = [cx - ux * span / 2, cz - uz * span / 2], B = [cx + ux * span / 2, cz + uz * span / 2], legR = w * 0.95;
      if (!clearAt(A[0], A[1], legR + 1) || !clearAt(B[0], B[1], legR + 1)) continue;
      if (vegD(A[0], A[1]) < legR || vegD(B[0], B[1]) < legR) continue;   // 다리 몸통 (≈ legR) 안에 나무 · 큰 바위 줄기가 없게
      if (kept(cx, cz, span / 2 + 2) || placed(cx, cz, span / 2) || wetR(cx, cz, span * 0.35)) continue;
      if (ARCHES.some(o => Math.hypot(o.cx - cx, o.cz - cz) < 140)) continue;   // 아치끼리는 멀리
      if (slope(A[0], A[1]) > 0.75 || slope(B[0], B[1]) > 0.75) continue;
      const fa = foot(A[0], A[1], legR), fb = foot(B[0], B[1], legR); if (fa[1] - fa[0] > legR * 1.4 || fb[1] - fb[0] > legR * 1.4) continue;
      const yA = fa[0] - 1.6, yB = fb[0] - 1.6; if (Math.abs(yA - yB) > span * 0.4) continue;
      const a = { A, B, yA, yB, h, span, ux, uz, t0: w * rr(0.95, 1.2), w0: w * rr(1.05, 1.3), seed: hashS(sl.reg + si) % 9973 }; a.t1 = a.t0 * 1.85; a.w1 = a.w0 * 1.5;
      // 아래 틈: 가운데 절반 아래가 넉넉히 비어 있어야 (길이 지나가면 8m)
      let ok = true, minGap = 1e9, road = false;
      for (let q = 0.22; q <= 0.781; q += 0.07){ const p = archP(a, q), g = H(p[0], p[2]), gap = p[1] - archT(a, q) / 2 - g; if (gap < minGap) minGap = gap; if (roadD(p[0], p[2]) < 3) road = true; }
      if (minGap < sl.gap || (road && minGap < 8)) ok = false;
      if (!ok) continue;
      a.cx = cx; a.cz = cz; a.gap = minGap; a.road = road; a.slot = sl; a.top = Math.max(yA, yB) + h; a.legR = legR; ARCHES.push(a); break;
    }
  });
  for (const a of ARCHES){
    const b = a.slot.bio, cell = cellOf(a.cx, a.cz), pal = BP[b], seed = nseed();
    gBegin('arch', a.cx, a.cz, { cast: true, keep: true });   // 아치 몸통은 지우지 않아요 (아래는 틈)
    tube(archRings(a, LOW ? 16 : 26), LOW ? 6 : 8, { seed, jit: 0.1, aj: 0.3 });
    emit(bOf(cell, 'rock'), { pal, bi: 0, seed, y0: Math.min(a.yA, a.yB) + 1.6, h: a.h, topK: 1, kind: 'arch' }, paintRock);
    tube(archRings(a, 9), 5, { seed, jit: 0.06, aj: 0.2 }); emit(FB, { pal, bi: 0, seed, y0: Math.min(a.yA, a.yB) + 1.6, h: a.h, cx: cell.cx, cz: cell.cz }, paintRock);
    const ga = gEnd();
    // 발자국은 두 다리만 (아래 틈은 빈 땅 — 걸어 지나가는 곳). 다리 B 는 조각 없는 무리로 따로.
    if (ga){ const leg = s => { const p = archP(a, s), r = Math.max(archW(a, s), archT(a, s)) / 2 + 0.6, h = new Float32Array(24); for (let k = 0; k < 12; k++){ h[k * 2] = p[0] + Math.cos(k / 12 * TAU) * r; h[k * 2 + 1] = p[2] + Math.sin(k / 12 * TAU) * r; } return h; };
      gHull(ga, leg(0.035)); const gb = { kind: 'archLeg', x: a.B[0], z: a.B[1], keep: true, parts: [], cols: [], y0: ga.y0, y1: ga.y1, dead: false, q: 0 }; gHull(gb, leg(0.965)); GRP.push(gb); }
    // 다리 충돌 · 발치 돌무더기 · 꼭대기 바위 몇 개 (실루엣)
    for (const s of [0.035, 0.965]){ const p = archP(a, s), r = Math.max(archW(a, s), archT(a, s)) / 2 * 0.82; circleCol(p[0], p[2], r);
      const n = LOW ? 2 : 4; for (let i = 0; i < n; i++){ const an = R() * TAU, dd = r + rr(0.8, 2.6), x = p[0] + Math.cos(an) * dd, z = p[2] + Math.sin(an) * dd; if (isW(x, z) || roadD(x, z) < 5 + 1.5 || kept(x, z, 1.5)) continue;
        const rs = rr(0.5, 1.5); if (vegD(x, z) < rs) continue;
        gBegin('rubble', x, z); stone(cell, { x, z, gy: foot(x, z, rs)[0], r: rs, h: rs * rr(1.2, 1.8), tpl: 'dod', pal, ry: R() * TAU, lean: rr(0, 0.4), dir: an, cuts: 1 }); circleCol(x, z, rs * 0.8); gEnd(); } }
    for (let i = 0; i < (LOW ? 1 : 3); i++){ const s = rr(0.3, 0.7), p = archP(a, s), rs = archW(a, s) * rr(0.18, 0.3);
      gBegin('archTop', p[0], p[2], { cast: true, keep: true }); stone(cell, { x: p[0] + rr(-1, 1), z: p[2] + rr(-1, 1), gy: p[1] + archT(a, s) * 0.3, r: rs, h: rs * rr(1.4, 2.4), pal, tpl: 'ico1', air: true, ry: R() * TAU, sink: 0.35, lean: rr(0, 0.3), dir: R() * TAU }); gEnd(); }
    const o = rec('arch', a.cx, a.cz, a.span / 2 + a.legR, b, { span: Math.round(a.span), h: Math.round(a.h), gap: Math.round(a.gap * 10) / 10, overRoad: a.road });
    if (a.slot.name){ o.name = a.slot.name; a.label = F.label({ pos: new V3(a.cx, a.top + 4, a.cz), text: a.slot.name, sub: '바위 아치', cls: 'place', max: 320 }); }
    mark(a.A[0], a.A[1], a.legR + 3); mark(a.B[0], a.B[1], a.legR + 3);
    STATS.arches++; cnt('arches', b);
  }
  STATS.phase.arch = Math.round(performance.now() - tA);
}
await idle();

// ═════════════════════════ 2) 바위 왕관 (언덕 꼭대기 · 능선 마루) ═════════════════════════
// 큰 바위 하나(가운데) + 둘레로 바깥을 향해 기운 바위들. 능선이면 마루를 따라 이빨처럼 늘어서요 (방향 = 높이가 가장 덜 떨어지는 쪽).
// 바이옴별 날카로움 jag: 협곡 · 침식지 · 설원은 길쭉하고 날카롭게, 풀밭 · 숲은 둥글고 이끼 낀 머리.
const JAG = { meadow: 0.25, forest: 0.3, lake: 0.25, swamp: 0.2, canyon: 0.62, plateau: 0.5, blight: 0.95, snow: 0.8, village: 0.2 };
function ridgeDir(x, z){ let best = -1e9, worst = 1e9, ba = 0; for (let i = 0; i < 12; i++){ const a = i / 12 * Math.PI, c = Math.cos(a) * 18, s = Math.sin(a) * 18, v = H(x + c, z + s) + H(x - c, z - s); if (v > best){ best = v; ba = a; } if (v < worst) worst = v; } return [ba, (best - worst) / 2]; }
// 이빨 바위: 5~6각 관, 위로 갈수록 가늘어지다 뾰족한 끝 (끝은 살짝 비껴서) — 날카로운 바이옴의 왕관 · 능선 이빨
function shard(cell, o){
  const seed = nseed(), lx = Math.cos(o.dir) * Math.tan(o.lean), lz = Math.sin(o.dir) * Math.tan(o.lean), g = o.gy - 0.9, ph = (seed & 255) / 40, sq = rr(0.62, 1), tw = rr(-0.6, 0.6);
  const prof = t => (1 - 0.58 * t) * (1 + 0.1 * Math.sin(t * 6.5 + ph)) * (t < 0.1 ? 1.15 : 1);
  const tipOff = [rr(-0.35, 0.35) * o.r, rr(-0.35, 0.35) * o.r], mat = o.mat || 'rock', po = { pal: o.pal, bi: (seed % 3 + 3) % 3, seed, y0: o.gy, h: o.h, seam: 0.1, tipGlow: 0.5, kind: 'shard' };
  tube(columnRings(o.x, o.z, g, o.h * 0.78 + 0.9, o.r, LOW ? 3 : 4, prof, lx, lz, sq, tw), o.sides || 5, { seed, jit: 0.14, aj: 0.35, tip: o.h * 0.22 + o.r * 0.2, tipOff }); settle(0.25);
  emit(bOf(cell, mat), po, PAINT[mat]);
  if (o.far){ tube(columnRings(o.x, o.z, g - 1.2, o.h * 0.78 + 2.1, o.r * 1.04, 2, t => 1 - 0.5 * t, lx, lz, sq, tw), 4, { seed, jit: 0.05, aj: 0.1, tip: o.h * 0.22 + o.r * 0.2, tipOff }); po.cx = cell.cx; po.cz = cell.cz; emit(FB, po, PAINT[mat]); }
}
function crown(x, z, sc, b, kind, ring = 0){   // ring > 0: 가운데는 비우고 둘레만 (이름 있는 봉우리 · rpg 'top' 꼭대기 — 상자 · 정령 자리)
  const jag = JAG[b] ?? 0.4, pal = BP[b] || BP.meadow, mat = b === 'blight' ? 'obs' : 'rock', cell = cellOf(x, z);
  const [rdA, aniso] = ridgeDir(x, z), ridge = kind === 'ridge' && aniso > 3.5 && !ring;
  const hm = (3.6 + 7.5 * sc) * (1 + jag * 0.7) * rr(0.85, 1.2), rm = hm * lerp(0.44, 0.24, jag);
  let n = Math.round(3 + sc * 5 + R() * 2) + (ring ? 3 : 0); if (LOW) n = Math.max(3, Math.round(n * 0.62));
  const gy0 = foot(x, z, rm * 0.7)[0], pieces = [];
  // 가운데
  const teeth = jag >= 0.45;   // 날카로운 바이옴은 이빨 바위, 둥근 바이옴은 이끼 낀 둥근 바위
  if (!ring){
    gBegin('crownMain', x, z, { cast: true });
    if (teeth) shard(cell, { x, z, gy: gy0, r: rm * 1.15, h: hm * 1.15, lean: rr(0, 0.1), dir: R() * TAU, pal, mat, far: true, sides: R() < 0.5 ? 5 : 6 });
    else stone(cell, { kind: 'crownMain', x, z, gy: gy0, r: rm, h: hm, tpl: LOW ? 'dod' : 'ico1', pal, mat, ry: R() * TAU, lean: rr(0, 0.12), dir: R() * TAU, cuts: 2, cutY: 0.6, jit: 0.15 + jag * 0.08, sink: 0.2, far: true, farTpl: 'ico0', az: rr(0.75, 1), seam: 0.1 });
    circleCol(x, z, rm * 0.8); gEnd(); pieces.push([x, z, rm]);
  }
  let farN = 0; const span = rm * (2.2 + n * 0.45);
  for (let i = 0; i < n; i++){
    let px, pz, an;
    if (ridge){ const side = i % 2 ? 1 : -1, u = side * (rm * 1.1 + (Math.floor(i / 2) + 0.5) * rm * rr(1.1, 1.6)), lat = rr(-0.25, 0.25) * rm; px = x + Math.cos(rdA) * u - Math.sin(rdA) * lat; pz = z + Math.sin(rdA) * u + Math.cos(rdA) * lat; an = Math.atan2(pz - z, px - x); }
    else { an = i / n * TAU + rr(-0.4, 0.4); const dd = ring ? ring + rr(0, rm) : rm * rr(1.05, 2.0); px = x + Math.cos(an) * dd; pz = z + Math.sin(an) * dd; }
    const dc = Math.hypot(px - x, pz - z), fall = ridge ? 1 - clamp(dc / span, 0, 0.6) : 1;
    const f = rr(0.38, 0.78) * (1 - i / (n + 3) * 0.35) * fall, h = hm * f * (ridge ? rr(0.8, 1.1) : 1), pr = h * lerp(0.46, 0.27, jag) * rr(0.85, 1.15);
    if (isW(px, pz) || roadD(px, pz) < 5 + pr || kept(px, pz, pr)) continue;
    if (vegD(px, pz) < pr * 0.7) continue;   // 나무 줄기가 바위를 뚫지 않게 (모든 바이옴)
    const ft = foot(px, pz, pr * 0.7); if (ft[1] - ft[0] > h * (ring ? 2 : 0.9)) continue;
    if (pieces.some(([qx, qz, qr]) => Math.hypot(px - qx, pz - qz) < (qr + pr) * 0.55)) continue;
    const big = h > 5 && farN < 3;
    gBegin('crownSat', px, pz, { cast: h > 2.2 });
    if (teeth && R() < 0.72) shard(cell, { x: px, z: pz, gy: ft[0], r: pr * 0.95, h: h * 1.1, lean: rr(0.1, 0.38) + jag * 0.08, dir: an, pal, mat, far: big, sides: R() < 0.5 ? 4 : 5 });
    else stone(cell, { kind: 'crownSat', x: px, z: pz, gy: ft[0], r: pr, h, tpl: jag > 0.45 || h > 4 ? 'ico1' : 'dod', pal, mat, ry: R() * TAU, lean: rr(0.08, 0.32) + jag * 0.1, dir: an, cuts: 2, cutY: 0.7, jit: 0.15 + jag * 0.06, sink: 0.22, far: big, az: rr(0.7, 1) });
    circleCol(px, pz, pr * 0.78); const gg = gEnd();
    if (gg && !gg.dead){ if (big) farN++; pieces.push([px, pz, pr]); }
  }
  // 발치 잔돌 (충돌 없음 · 그림자 없음)
  const m = LOW ? 2 : 5; for (let i = 0; i < m; i++){ const an = R() * TAU, dd = rr(rm * 1.2, span * 0.9), px = x + Math.cos(an) * dd, pz = z + Math.sin(an) * dd, rs = rr(0.3, 0.75); if (isW(px, pz) || roadD(px, pz) < 5 + rs || kept(px, pz, 1) || vegD(px, pz) < rs) continue;
    gBegin('rubble', px, pz); stone(cell, { kind: 'rubble', x: px, z: pz, gy: H(px, pz), r: rs, h: rs * rr(0.9, 1.5), tpl: 'dod', pal, mat, ry: R() * TAU, cuts: 1, sink: 0.3, seam: 0.05 }); gEnd(); }
  const o = rec(kind, x, z, span * 0.6, b, { h: Math.round(hm), n: pieces.length });
  if (kind === 'crown') STATS.crowns++; else STATS.ridges++; cnt(kind, b);
  return o;
}
{ const tC = performance.now(), CROWN_P = { meadow: 0.75, forest: 0.6, lake: 0.8, swamp: 0.35, canyon: 1, plateau: 1, blight: 1, snow: 1 };
  // 언덕 (중간 · 큰 것, 탑 언덕 빼고): 진짜 꼭대기를 찾아서
  const HL = (F.hills || []).filter(h => h.sc >= 1 && !h.tower).sort((a, b) => b.sc - a.sc || b.r - a.r);
  for (const hl of HL){
    const rs = Math.min(hl.ax || hl.r, hl.az || hl.r) * 0.4; let bx = hl.x, bz = hl.z, bh = -1e9;
    for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++){ const x = hl.x + i * rs / 4, z = hl.z + j * rs / 4, h = H(x, z); if (h > bh){ bh = h; bx = x; bz = z; } }
    const b = BIOME(bx, bz); if (b === 'village') continue;
    srand(hashS('crown:' + Math.round(hl.x) + ',' + Math.round(hl.z)));
    if (hl.sc < 2 && R() > (CROWN_P[b] ?? 0.6)) continue;
    const sc = hl.sc === 2 ? rr(0.85, 1.1) : rr(0.45, 0.72), rad = 3 + 7 * sc;
    if (!clearAt(bx, bz, rad, { edge: 760 })){ if (!clearAt(bx, bz, 3.5, { edge: 760 })) continue; crown(bx, bz, 0.35, b, 'crown'); continue; }
    crown(bx, bz, sc, b, 'crown');
  }
  // 능선 마루: 10m 격자의 국소 최고점 (반경 30m 안에서 가장 높고, 36m 고리 평균보다 6m+ 높은 곳)
  const S = 10, N = Math.floor(1540 / S) + 1, O = -770, HG = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) HG[j * N + i] = H(O + i * S, O + j * S);
  const MX = [];
  for (let j = 3; j < N - 3; j++) for (let i = 3; i < N - 3; i++){ const h = HG[j * N + i]; let mx = true;
    for (let b = -3; b <= 3 && mx; b++) for (let a = -3; a <= 3; a++){ if ((!a && !b) || a * a + b * b > 10) continue; const v = HG[(j + b) * N + i + a]; if (v > h || (v === h && (b < 0 || (b === 0 && a < 0)))){ mx = false; break; } }
    if (!mx) continue; const x = O + i * S, z = O + j * S; let s = 0; for (let k = 0; k < 12; k++){ const an = k / 12 * TAU; s += H(x + Math.cos(an) * 36, z + Math.sin(an) * 36); }
    const pr = h - s / 12, edge = Math.max(Math.abs(x), Math.abs(z)) > 690; if (pr > (edge ? 16 : 6)) MX.push([x, z, pr, edge]); }
  MX.sort((a, b) => b[2] - a[2]); STATS.phase.maxima = Math.round(performance.now() - tC);
  const MAXC = LOW ? 150 : 210, MAXE = LOW ? 14 : 24; let ne = 0;
  for (const [x0, z0, pr, edge] of MX){
    if (STATS.crowns + STATS.ridges >= MAXC) break; if (edge && ne >= MAXE) continue;
    // 10m 격자 → 진짜 꼭대기로 다듬기
    let bx = x0, bz = z0, bh = H(x0, z0); for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++){ const x = x0 + i * 2.5, z = z0 + j * 2.5, h = H(x, z); if (h > bh){ bh = h; bx = x; bz = z; } }
    const b = BIOME(bx, bz); if (b === 'village') continue;
    srand(hashS('ridge:' + x0 + ',' + z0));
    const sc = clamp(pr / 20, 0.45, 1.45), rad = 3 + 7 * Math.min(1.1, sc);
    if (placed(bx, bz, rad + 22)) continue;
    // 이름 있는 봉우리 · 능선 마루 (namedTerrain) · rpg 'top' 자리는 꼭대기를 비워 둔 둘레 왕관 — 조각마다 비켜 갈 곳을 따로 봐요
    let ringR = 0; for (const [tx, tz, rg] of TOPS) if (Math.hypot(tx - bx, tz - bz) < 18) ringR = Math.max(ringR, rg);
    if (ringR){ if (safeAt(bx, bz) || Math.max(Math.abs(bx), Math.abs(bz)) > 760) continue; crown(bx, bz, sc, b, 'ridge', ringR); if (edge) ne++; continue; }
    if (!clearAt(bx, bz, rad, { edge: 770 })) continue;
    crown(bx, bz, sc, b, 'ridge'); if (edge) ne++;
  }
  STATS.phase.crown = Math.round(performance.now() - tC); STATS.maxima = MX.length;
}
await idle();

// ═════════════════════════ 3) 첨탑 · 기둥 (바이옴별 무리) ═════════════════════════
// 협곡: 줄무늬 붉은 후두(허리가 잘록, 머리에 단단한 덮개돌) · 균형 바위 / 고원: 풍화된 회색 돌기둥 · 쓰러진 거석
// 설원: 육각 얼음 첨탑 무리 (속에서 빛) / 침식지: 기울어진 흑요석 파편 (틈 · 끝이 보라로) / 호수: 물가 얕은 물의 바다 기둥 (이끼 머리)
function hoodoo(cell, x, z, h, r, far){
  const pal = BP.canyon, seed = nseed(), gy = foot(x, z, r)[0] - 0.8, waist = rr(0.62, 0.82), K = LOW ? 7 : 11, S = LOW ? 6 : 7, ph = R() * 6;
  const prof = t => (1 - 0.32 * t) * (1 + 0.18 * Math.sin(t * 7.5 + ph)) * (t > 0.72 && t < 0.9 ? waist : 1) * (t < 0.08 ? 1.25 : 1);
  const lx = rr(-0.04, 0.04), lz = rr(-0.04, 0.04);
  gBegin('hoodoo', x, z, { cast: true });
  tube(columnRings(x, z, gy, h, r, K, prof, lx, lz, rr(0.8, 1), rr(-0.4, 0.4)), S, { seed, jit: 0.1, tip: r * 0.25 });
  emit(bOf(cell, 'rock'), { pal, bi: 0, seed, y0: gy + 0.8, h, kind: 'hoodoo' }, paintRock);
  if (far){ tube(columnRings(x, z, gy - 1, h + 1, r * 1.05, 4, t => 1 - 0.3 * t, lx, lz), 5, { seed, jit: 0.05, tip: r * 0.3 }); emit(FB, { pal, bi: 0, seed, y0: gy + 0.8, h, cx: cell.cx, cz: cell.cz }, paintRock); }
  // 덮개돌 (더 단단하고 어두운 층)
  const tx = x + lx * h, tz = z + lz * h, cr = r * rr(1.1, 1.4);
  stone(cell, { x: tx, z: tz, gy: gy + h - cr * 0.3, r: cr, h: cr * rr(0.95, 1.35), pal, tpl: LOW ? 'dod' : 'ico1', ry: R() * TAU, lean: rr(0, 0.15), dir: R() * TAU, cuts: 2, cutY: 2.5, sink: 0, bi: 2, tone: 0.82, noband: true, far, farTpl: 'ico0', air: true });
  circleCol(x, z, r * 1.05); const g = gEnd();
  if (g && !g.dead){ STATS.hoodoos++; STATS.spires++; cnt('hoodoo', 'canyon'); return true; } return false;
}
function balanced(cell, x, z, b){
  const pal = BP[b], seed = nseed(), ph = rr(3.5, 7), pr = rr(0.9, 1.5), gy = foot(x, z, pr * 1.6)[0] - 0.6;
  gBegin('balanced', x, z, { cast: true });
  tube(columnRings(x, z, gy, ph, pr * 1.6, LOW ? 4 : 6, t => lerp(1, 0.5, Math.pow(t, 0.7)) * (1 + 0.1 * Math.sin(t * 9))), LOW ? 5 : 7, { seed, jit: 0.12, tip: 0.2 });
  emit(bOf(cell, 'rock'), { pal, bi: 0, seed, y0: gy + 0.6, h: ph, kind: 'pedestal' }, paintRock);
  const br = rr(2.6, 4.2); stone(cell, { x: x + rr(-0.5, 0.5), z: z + rr(-0.5, 0.5), gy: gy + ph - br * 0.12, r: br, h: br * rr(1.3, 1.7), ax: rr(1, 1.3), pal, tpl: LOW ? 'ico1' : 'ico2', ry: R() * TAU, lean: rr(0.05, 0.25), dir: R() * TAU, cuts: 2, sink: 0, bi: 1, far: true, farTpl: 'ico0', air: true });
  circleCol(x, z, pr * 1.5); const g = gEnd();
  if (g && !g.dead){ STATS.balanced++; STATS.spires++; cnt('balanced', b); return true; } return false;
}
function pillar(cell, x, z, h, r, far){
  const pal = BP.plateau, seed = nseed(), gy = foot(x, z, r)[0] - 0.9, sides = R() < 0.5 ? 4 : 5, lx = rr(-0.06, 0.06), lz = rr(-0.06, 0.06), K = LOW ? 5 : 8, ph = R() * 6;
  const prof = t => (1 - 0.18 * t) * (1 + 0.1 * Math.sin(t * 11 + ph)) * (t < 0.06 ? 1.2 : 1);
  const broken = R() < 0.45;
  gBegin('pillar', x, z, { cast: true });
  tube(columnRings(x, z, gy, h, r, K, prof, lx, lz, rr(0.75, 1), rr(-0.5, 0.5)), sides, { seed, jit: 0.13, aj: 0.25, tip: broken ? r * rr(0.6, 1.1) : r * 0.08, tipOff: broken ? [rr(-0.6, 0.6) * r, rr(-0.6, 0.6) * r] : null });
  emit(bOf(cell, 'rock'), { pal, bi: (seed % 3 + 3) % 3, seed, y0: gy + 0.9, h, kind: 'pillar' }, paintRock);
  if (far){ tube(columnRings(x, z, gy - 1, h + 1, r, 3, t => 1 - 0.15 * t, lx, lz), sides, { seed, jit: 0.05, tip: r * 0.2 }); emit(FB, { pal, bi: 1, seed, y0: gy + 0.9, h, cx: cell.cx, cz: cell.cz }, paintRock); }
  // 2단 (가끔 위에 어긋난 덩어리)
  if (!broken && R() < 0.35){ const tr = r * rr(0.7, 0.95); stone(cell, { x: x + lx * h + rr(-0.3, 0.3) * r, z: z + lz * h + rr(-0.3, 0.3) * r, gy: gy + h, r: tr, h: tr * rr(1.2, 1.8), pal, tpl: 'dod', ry: R() * TAU, lean: rr(0, 0.12), dir: R() * TAU, cuts: 2, cutY: 2, sink: 0.05, air: true }); }
  circleCol(x, z, r * 1.0); const g = gEnd();
  if (g && !g.dead){ STATS.pillars++; STATS.spires++; cnt('pillar', 'plateau'); return true; } return false;
}
function monolith(cell, x, z, b){
  // 쓰러진 거석: 가로로 누운 네모 관, 한쪽 끝은 땅에 박혀 있어요
  const pal = BP[b], seed = nseed(), L = rr(10, 17), w = rr(1.6, 2.6), ry = R() * Math.PI, ux = Math.cos(ry), uz = Math.sin(ry);
  const x0 = x - ux * L * 0.5, z0 = z - uz * L * 0.5, x1 = x + ux * L * 0.5, z1 = z + uz * L * 0.5, y0 = foot(x0, z0, w)[0] - w * 0.55, y1 = foot(x1, z1, w)[0] + w * rr(0.45, 0.75);
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, dl = Math.hypot(dx, dy, dz); frame(dx / dl, dy / dl, dz / dl); const RG = [], K = LOW ? 3 : 5;
  for (let k = 0; k < K; k++){ const t = k / (K - 1); RG.push([x0 + dx * t, y0 + dy * t, z0 + dz * t, _e1[0], _e1[1], _e1[2], _e2[0], _e2[1], _e2[2], w * (1 - 0.08 * t), w * rr(0.75, 0.95), Math.PI / 4]); }
  gBegin('monolith', x, z, { cast: true });
  tube(RG, 4, { seed, jit: 0.1, aj: 0.12, tip: w * 0.3, tip0: w * 0.2 });
  emit(bOf(cell, 'rock'), { pal, bi: 2, seed, y0: Math.min(y0, y1) + w * 0.4, h: w * 2, kind: 'monolith' }, paintRock);
  boxCol(x, z, L * 0.5, w * 0.9, -ry); const g = gEnd();
  if (g && !g.dead){ STATS.monoliths++; cnt('monolith', b); return true; } return false;
}
function iceCluster(cell, x, z){
  const n = LOW ? rr(3, 5) | 0 : rr(4, 8) | 0, gy = foot(x, z, 3)[0], hm = rr(6, 13);
  // 눈 덮인 받침 바위 (+ 무리 충돌체)
  gBegin('iceBase', x, z, { cast: true });
  stone(cell, { x, z, gy, r: rr(2.4, 3.6), h: rr(1.6, 2.6), pal: BP.snow, tpl: 'ico1', ry: R() * TAU, cuts: 2, cutY: 3, sink: 0.4, topK: 1.2 });
  circleCol(x, z, 2.6); gEnd();
  for (let i = 0; i < n; i++){
    const an = R() * TAU, dd = i ? rr(0.6, 2.4) : 0, px = x + Math.cos(an) * dd, pz = z + Math.sin(an) * dd, h = i ? hm * rr(0.35, 0.75) : hm, r = h * rr(0.1, 0.15), lean = i ? rr(0.18, 0.55) : rr(0, 0.1);
    const lx = Math.cos(an) * Math.tan(lean), lz = Math.sin(an) * Math.tan(lean), seed = nseed(), g = H(px, pz) - 0.8;
    if (i && (isW(px, pz) || roadD(px, pz) < 5 + r || kept(px, pz, r) || vegD(px, pz) < r + 0.2)) continue;
    gBegin('ice', px, pz);
    tube(columnRings(px, pz, g, h * 0.78, r, 3, t => 1 - 0.08 * t, lx, lz, 1, rr(0, 1)), 6, { seed, jit: 0.04, aj: 0.05, tip: h * 0.22 });
    emit(bOf(cell, 'ice'), { seed, y0: g + 0.8, h, kind: 'ice' }, paintIce);
    if (i < 3 && h > 5){ tube(columnRings(px, pz, g - 1, h * 0.78 + 1, r, 2, () => 1, lx, lz), 4, { seed, jit: 0, aj: 0, tip: h * 0.22 }); emit(FB, { seed, y0: g + 0.8, h, cx: cell.cx, cz: cell.cz }, paintIce); }
    const gg = gEnd(); if (gg && !gg.dead){ STATS.ice++; STATS.spires++; cnt('ice', 'snow'); }
  }
}
function obsCluster(cell, x, z){
  const n = LOW ? rr(3, 5) | 0 : rr(3, 7) | 0, hm = rr(5, 10);
  for (let i = 0; i < n; i++){
    const an = R() * TAU, dd = i ? rr(1, 3.4) : 0, px = x + Math.cos(an) * dd, pz = z + Math.sin(an) * dd, h = i ? hm * rr(0.35, 0.8) : hm, r = h * rr(0.12, 0.18), lean = i ? rr(0.25, 0.6) : rr(0.05, 0.3), dir = i ? an : R() * TAU;
    if (i && (isW(px, pz) || roadD(px, pz) < 5 + r || kept(px, pz, r))) continue;
    if (vegD(px, pz) < r + 0.2) continue;
    const lx = Math.cos(dir) * Math.tan(lean), lz = Math.sin(dir) * Math.tan(lean), seed = nseed(), g = H(px, pz) - 0.6, sides = R() < 0.5 ? 3 : 4;
    gBegin('obs', px, pz, { cast: h > 3 });
    tube(columnRings(px, pz, g, h * 0.7, r, 3, t => 1 - 0.35 * t, lx, lz, rr(0.6, 1), rr(-0.4, 0.4)), sides, { seed, jit: 0.15, aj: 0.2, tip: h * 0.3 });
    emit(bOf(cell, 'obs'), { bi: (seed % 3 + 3) % 3, seed, y0: g + 0.6, h, seam: 0.1, tipGlow: 0.55, kind: 'obs' }, paintObs);
    if (i < 2 && h > 4.5){ tube(columnRings(px, pz, g - 1, h * 0.7 + 1, r, 2, () => 1, lx, lz), sides, { seed, jit: 0, aj: 0, tip: h * 0.3 }); emit(FB, { bi: 0, seed, y0: g + 0.6, h, seam: 0, tipGlow: 0.5, cx: cell.cx, cz: cell.cz }, paintObs); }
    circleCol(px + lx * h * 0.2, pz + lz * h * 0.2, r * 1.1); const gg = gEnd(); if (gg && !gg.dead){ STATS.obsidian++; STATS.spires++; cnt('obsidian', 'blight'); }
  }
  // 발치 검은 잔돌
  for (let i = 0; i < (LOW ? 2 : 4); i++){ const an = R() * TAU, dd = rr(1.5, 4.5), px = x + Math.cos(an) * dd, pz = z + Math.sin(an) * dd, rs = rr(0.3, 0.8); if (isW(px, pz) || roadD(px, pz) < 5 + rs || kept(px, pz, rs) || vegD(px, pz) < rs) continue;
    gBegin('rubble', px, pz); stone(cell, { x: px, z: pz, gy: H(px, pz), r: rs, h: rs * rr(0.8, 1.4), mat: 'obs', pal: BP.blight, tpl: 'dod', ry: R() * TAU, cuts: 1, sink: 0.3, seam: 0.08, tipGlow: 0 }); gEnd(); }
}
{ const tS = performance.now(), Q = LOW ? 0.55 : 1;
  const SPB = { canyon: { max: 34, r: 9 }, plateau: { max: 24, r: 8 }, snow: { max: 18, r: 6 }, blight: { max: 20, r: 7 } }, got = {};
  const C = []; for (let j = -21; j <= 21; j++) for (let i = -21; i <= 21; i++) for (const o of [0, 16.5]){ const x = i * 33 + o + (hash(i, j, 41 + o) - 0.5) * 22, z = j * 33 + o + (hash(i, j, 42 + o) - 0.5) * 22, b = BIOME(x, z); if (SPB[b]) C.push([x, z, b, hash(i, j, 43 + o)]); }
  C.sort((a, b) => a[3] - b[3]);
  for (const [x, z, b] of C){
    const S0 = SPB[b]; if ((got[b] || 0) >= Math.round(S0.max * Q)) continue;
    if (slope(x, z) > 0.85){ rej(b, 'slope'); continue; } const ft = foot(x, z, 3.5); if (ft[1] - ft[0] > 3.6){ rej(b, 'foot'); continue; }   // (기둥 밑동은 낮은 쪽에 맞춰 묻혀요 — 거친 협곡 비탈에도 서요)
    if (!clearAt(x, z, S0.r)){ rej(b, WHY); continue; }
    const cell = cellOf(x, z); srand(hashS('sp:' + Math.round(x) + ',' + Math.round(z)));
    if (b === 'canyon'){
      if (R() < 0.28){ balanced(cell, x, z, 'canyon'); rec('balanced', x, z, 4, b); }
      else { const n = 1 + Math.floor(R() * 3.3); let k = 0;
        for (let i = 0; i < n; i++){ const an = R() * TAU, dd = i ? rr(4, 9) : 0, px = x + Math.cos(an) * dd, pz = z + Math.sin(an) * dd, h = rr(9, 21) * (i ? 0.78 : 1.12), r = h * rr(0.12, 0.17);
          if (i && (wetR(px, pz, r) || roadD(px, pz) < 5 + r || kept(px, pz, r) || slope(px, pz) > 0.8 || vegD(px, pz) < r + 0.3)) continue; if (hoodoo(cell, px, pz, h, r, h > 9)) k++; }
        rec('hoodoos', x, z, 9, b, { n: k }); }
    } else if (b === 'plateau'){
      if (R() < 0.3){ monolith(cell, x, z, 'plateau'); rec('monolith', x, z, 8, b); }
      else { const n = 1 + Math.floor(R() * 2.6); let k = 0;
        for (let i = 0; i < n; i++){ const an = R() * TAU, dd = i ? rr(4, 8) : 0, px = x + Math.cos(an) * dd, pz = z + Math.sin(an) * dd, h = rr(6, 16) * (i ? 0.75 : 1.1), r = rr(1.5, 3);
          if (i && (wetR(px, pz, r) || roadD(px, pz) < 5 + r || kept(px, pz, r) || slope(px, pz) > 0.6 || vegD(px, pz) < r + 0.3)) continue; if (pillar(cell, px, pz, h, r, h > 7)) k++; }
        if (R() < 0.18){ const an = R() * TAU, px = x + Math.cos(an) * 9, pz = z + Math.sin(an) * 9; if (clearAt(px, pz, 6, { nopg: true })) monolith(cell, px, pz, 'plateau'); }
        rec('pillars', x, z, 8, b, { n: k }); }
    } else if (b === 'snow'){ iceCluster(cell, x, z); rec('ice', x, z, 5, b); }
    else if (b === 'blight'){ obsCluster(cell, x, z); rec('obsidian', x, z, 6, b); }
    got[b] = (got[b] || 0) + 1;
  }
  // 호수 바다 기둥: 물가에서 4~20m, 얕은 물 (0.5~2.8m)
  const LK = W.lakes.filter(L => !L.frozen && L.rx >= 50); let ns = 0; const SC = [];
  for (const L of LK) for (let z = L.c[1] - L.rz - 20; z <= L.c[1] + L.rz + 20; z += 6) for (let x = L.c[0] - L.rx - 20; x <= L.c[0] + L.rx + 20; x += 6){
    const jx = x + (hash(x, z, 51) - 0.5) * 4, jz = z + (hash(x, z, 52) - 0.5) * 4; if (!isW(jx, jz)) continue; const dep = WY(jx, jz) - H(jx, jz); if (dep < 0.5 || dep > 2.8) continue;
    let land = false; for (let k = 0; k < 8 && !land; k++){ const a = k * 0.785398; if (!isW(jx + Math.cos(a) * 16, jz + Math.sin(a) * 16)) land = true; } if (!land) continue;
    SC.push([jx, jz, hash(x, z, 53)]); }
  SC.sort((a, b) => a[2] - b[2]);
  for (const [x, z] of SC){
    if (ns >= (LOW ? 9 : 15)) break; if (kept(x, z, 6) || placed(x, z, 16) || roadD(x, z) < 8) continue;
    const cell = cellOf(x, z), pal = BP.lake; srand(hashS('stack:' + Math.round(x) + ',' + Math.round(z)));
    const n = R() < 0.35 ? 2 : 1;
    for (let i = 0; i < n; i++){ const an = R() * TAU, px = x + (i ? Math.cos(an) * rr(6, 9) : 0), pz = z + (i ? Math.sin(an) * rr(6, 9) : 0); if (i && (!isW(px, pz) || kept(px, pz, 4))) continue;
      const bed = H(px, pz) - 1, top = WY(px, pz) + rr(5, 12) * (i ? 0.65 : 1), h = top - bed, r = rr(2.4, 4.4) * (i ? 0.7 : 1), seed = nseed(), ph = R() * 6;
      gBegin('stack', px, pz, { cast: true });
      tube(columnRings(px, pz, bed, h, r, LOW ? 5 : 8, t => (1 - 0.2 * t) * (1 + 0.14 * Math.sin(t * 8 + ph)) * (t > 0.9 ? 1.08 : 1), rr(-0.03, 0.03), rr(-0.03, 0.03), rr(0.75, 1), rr(-0.5, 0.5)), LOW ? 6 : 7, { seed, jit: 0.12, tip: r * 0.18 });
      emit(bOf(cell, 'rock'), { pal, bi: 0, seed, y0: WY(px, pz) - 0.3, h: top - WY(px, pz), topK: 1.1, band: STACKB, bandK: 0.5 }, paintRock);
      tube(columnRings(px, pz, bed, h, r, 3, t => 1 - 0.18 * t), 5, { seed, jit: 0.05, tip: r * 0.2 }); emit(FB, { pal, bi: 0, seed, y0: WY(px, pz) - 0.3, h: top - WY(px, pz), topK: 1.1, band: STACKB, bandK: 0.5, cx: cell.cx, cz: cell.cz }, paintRock);
      // 물가 잔돌
      for (let k = 0; k < 2; k++){ const a2 = R() * TAU, qx = px + Math.cos(a2) * (r + rr(0.5, 2)), qz = pz + Math.sin(a2) * (r + rr(0.5, 2)), rs = rr(0.6, 1.3), bd = H(qx, qz); stone(cell, { kind: 'stackRubble', x: qx, z: qz, gy: bd, r: rs, h: Math.max(0, WY(qx, qz) - bd) + rs * rr(0.5, 1.1) + 0.4, tpl: 'dod', pal, ry: R() * TAU, cuts: 1, sink: 0.15 }); }
      circleCol(px, pz, r * 0.92); const gg = gEnd(); if (gg && !gg.dead){ STATS.stacks++; STATS.spires++; cnt('stack', 'lake'); } }
    rec('stack', x, z, 6, 'lake'); ns++;
  }
  STATS.phase.spire = Math.round(performance.now() - tS);
}
await idle();

// ═════════════════════════ 4) 떠돌이 바위 (빙하 표석) ═════════════════════════
// 들판 · 숲 빈터 · 호숫가 · 고원에 홀로 선 5~9m 바위 — 멀리서 강한 실루엣. 가끔 두 쪽으로 갈라진 바위 · 작은 돌 위에 얹힌 바위.
{ const tE = performance.now(), EM = { meadow: 18, forest: 14, lake: 10, plateau: 12, snow: 6, swamp: 4 }, got = {}, Q = LOW ? 0.65 : 1, ER = [];
  const C = []; for (let j = -34; j <= 34; j++) for (let i = -34; i <= 34; i++){ const x = i * 21 + (hash(i, j, 61) - 0.5) * 16, z = j * 21 + (hash(i, j, 62) - 0.5) * 16, b = BIOME(x, z); if (EM[b]) C.push([x, z, b, hash(i, j, 63)]); }
  C.sort((a, b) => a[3] - b[3]);
  for (const [x, z, b] of C){
    if ((got[b] || 0) >= Math.round(EM[b] * Q)) continue;
    srand(hashS('err:' + Math.round(x) + ',' + Math.round(z))); const r = rr(2.9, 4.8);
    if (slope(x, z) > 0.32) continue; const ft = foot(x, z, r); if (ft[1] - ft[0] > 1.4) continue;
    if (!clearAt(x, z, r + 2) || wetR(x, z, r + 3) || roadD(x, z) < 8 + r) continue;
    if (ER.some(([a, c]) => Math.hypot(x - a, z - c) < 55)) continue;
    if (vegD(x, z) < r * 1.05 + 0.4) continue;
    const cell = cellOf(x, z), pal = BP[b], v = R(), h = r * rr(1.35, 1.9), gy = ft[0];
    if (v < 0.22){
      // 갈라진 바위: 두 반쪽이 0.7~1.2m 틈을 두고 서로 기대요
      const an = R() * Math.PI, gx = Math.cos(an), gz = Math.sin(an), gap = rr(0.35, 0.6);
      for (const sd of [-1, 1]){ const seed = nseed(), px = x + gx * sd * (r * 0.5 + gap), pz = z + gz * sd * (r * 0.5 + gap);
        gBegin('split', px, pz, { cast: true });
        const ld = sd > 0 ? an : an + Math.PI; rot3(0.08 * Math.sin(ld), -an, -0.08 * Math.cos(ld));   // 틈 반대쪽으로 살짝 기울어요
        rock(TPL[LOW ? 'ico1' : 'ico2'], { x: px, y: gy + h * 0.38, z: pz, sx: r * 0.55, sy: h / 2, sz: r, jit: 0.1, cuts: 2, cutY: 0.8, seed });
        for (let i = 0; i < tv; i++){ const dx = TP[i * 3] - x, dz = TP[i * 3 + 2] - z, dd = dx * gx + dz * gz; if (dd * sd < gap){ TP[i * 3] += gx * (gap * sd - dd); TP[i * 3 + 2] += gz * (gap * sd - dd); } }   // 갈라진 면은 평평하게
        emit(bOf(cell, 'rock'), { pal, bi: 1, seed, y0: gy, h, kind: 'split' }, paintRock);
        rot3(0, -an, 0); rock(TPL.ico0, { x: px, y: gy + h * 0.36, z: pz, sx: r * 0.5, sy: h / 2, sz: r * 0.95, jit: 0.06, cuts: 0, seed }); emit(FB, { pal, bi: 1, seed, y0: gy, h, cx: cell.cx, cz: cell.cz }, paintRock);
        circleCol(px, pz, r * 0.62); gEnd(); }
      rec('erratic', x, z, r + 1, b, { v: 'split' });
    } else if (v < 0.4 && b !== 'forest'){
      // 얹힌 바위: 작은 돌 셋 위에
      const lift = rr(0.9, 1.6);
      gBegin('perched', x, z, { cast: true });
      for (let i = 0; i < 3; i++){ const a2 = i / 3 * TAU + R(), px = x + Math.cos(a2) * r * 0.45, pz = z + Math.sin(a2) * r * 0.45, rs = rr(0.6, 0.9); stone(cell, { x: px, z: pz, gy: H(px, pz), r: rs, h: lift + rs, tpl: 'dod', pal, ry: R() * TAU, cuts: 1, sink: 0.3, bi: 2 }); }
      stone(cell, { x, z, gy: gy + lift, r, h, tpl: LOW ? 'ico1' : 'ico2', pal, ry: R() * TAU, cuts: 3, cutY: 0.8, jit: 0.1, sink: 0.08, air: true, lean: rr(0, 0.15), dir: R() * TAU, far: true, farTpl: 'ico0', ax: rr(1, 1.25) });
      circleCol(x, z, r * 0.85); gEnd(); rec('erratic', x, z, r + 1, b, { v: 'perched' });
    } else {
      gBegin('lone', x, z, { cast: true });
      stone(cell, { x, z, gy, r, h, tpl: LOW ? 'ico1' : 'ico2', pal, ry: R() * TAU, cuts: 3, cutY: 0.8, jit: 0.1, sink: 0.22, lean: rr(0, 0.2), dir: R() * TAU, far: true, farTpl: 'ico0', ax: rr(1, 1.3) });
      circleCol(x, z, r * 0.88); gEnd(); rec('erratic', x, z, r + 1, b, { v: 'lone' });
      // 동무 돌
      for (let i = 0; i < (LOW ? 1 : 3); i++){ const a2 = R() * TAU, dd = r + rr(1.5, 4), px = x + Math.cos(a2) * dd, pz = z + Math.sin(a2) * dd, rs = rr(0.5, 1.3); if (isW(px, pz) || roadD(px, pz) < 5 + rs || kept(px, pz, rs) || vegD(px, pz) < rs) continue;
        gBegin('rubble', px, pz); stone(cell, { x: px, z: pz, gy: H(px, pz), r: rs, h: rs * rr(1, 1.6), tpl: 'dod', pal, ry: R() * TAU, cuts: 1, sink: 0.3 }); circleCol(px, pz, rs * 0.8); gEnd(); }
    }
    ER.push([x, z]); got[b] = (got[b] || 0) + 1; STATS.erratics++; cnt('erratic', b);
  }
  STATS.phase.erratic = Math.round(performance.now() - tE);
}
await idle();

// ═════════════════════════ 5) 절벽 층리 턱 · 바위 비늘 · 너덜 ═════════════════════════
// 색은 지형 바위색에 맞춰요 (PP). 바닥 가림은 판의 진짜 높이 범위로 → 턱 아래쪽이 그늘져요.
// 협곡 · 고원: 층리 — 바이옴마다 고정된 높이 띠(5.5m · 7.5m 간격)에 맞춰 등고선을 따라 4~10장 겹쳐 이어 붙인 거의 수평인 턱. 띠마다 한 가지 색.
//   (70m 둘레마다 띠 절반쯤은 비워서 모든 띠가 다 차지는 않아요)
// 설원 · 침식지: 가파른 곳(경사 1+) 중 노이즈 얼룩 안에서만 — 몇 군데 절벽에 모인, 반쯤 묻힌 바위 면 (위로 한 장 더 쌓아 높은 면). 풀밭 · 숲 · 호수 · 늪 언덕엔 없어요.
// 절벽 아래 (위쪽 5m 안에 가파른 벽) 에는 굴러떨어진 돌무더기.
{ const tP = performance.now(), ST = LOW ? 6 : 4.6, n = Math.floor(1400 / ST), MAXP = LOW ? 1700 : 4200, PCELL = LOW ? 360 : 900, MAXT = LOW ? 600 : 1500;
  // s: 가파름 문턱 · m: 얼룩 문턱 (높을수록 드물게) · band/off: 층리 띠 간격 · 기준 · k: 판을 수평 쪽으로 눕히는 정도 · pres: 띠가 있을 확률
  // (풀밭 · 숲 · 호수 · 늪 언덕엔 판석을 두지 않아요 — 지형의 바위색 비탈과 왕관이 맡아요. 고르게 박힌 비늘은 타일처럼 보였어요)
  const PB = { canyon: { s: 0.88, m: 0.22, band: 5.5, off: 1.3, k: 0.82, pres: 0.52 }, plateau: { s: 0.92, m: 0.3, band: 7.5, off: 2.4, k: 0.76, pres: 0.5 },
    snow: { s: 1.05, m: 0.5 }, blight: { s: 1.0, m: 0.5 } };
  const PC = [], TC = [];
  for (let j = 0; j <= n; j++){ for (let i = 0; i <= n; i++){
    const x = -700 + (i + hash(i, j, 71)) * ST, z = -700 + (j + hash(i, j, 72)) * ST, s = slope(x, z);
    if (s > 0.88){
      const b = BIOME(x, z), P = PB[b]; if (!P || s < P.s || vnoise(x, z, 91) < P.m) continue;
      if (safeAt(x, z) || wetR(x, z, 2.5) || roadD(x, z) < 5 || kept(x, z, 2, true)) continue;
      PC.push(x, z, i, j, hash(i, j, 73));
    } else if (s > 0.22 && s < 0.75 && hash(i, j, 75) < 0.26){
      // 너덜: 4방향 5m 안에 가파르고 더 높은 벽이 있으면
      const h0 = H(x, z); let cliff = false;
      for (let q = 0; q < 4 && !cliff; q++){ const ax = q === 0 ? 5 : q === 1 ? -5 : 0, az = q === 2 ? 5 : q === 3 ? -5 : 0; if (slope(x + ax, z + az) > 1.15 && H(x + ax, z + az) > h0 + 2.2) cliff = true; }
      if (cliff) TC.push(x, z, i, j);
    }
  } if (j % 80 === 79) await idle(); }
  STATS.phase.plateScan = Math.round(performance.now() - tP);
  STATS.plateCand = PC.length / 5; STATS.talusCand = TC.length / 4;
  // 후보를 해시 순서로 (북쪽부터 차서 남쪽이 비지 않게)
  const ORD = Array.from({ length: PC.length / 5 }, (_, k) => k).sort((a, b) => PC[a * 5 + 4] - PC[b * 5 + 4]);
  const Xa = [0, 0, 0], Ya = [0, 0, 0], Za = [0, 0, 0], _cc = [0, 0, 0];
  // 판끼리 너무 붙지 않게: [띠, 5m 칸] → 줄 번호 (같은 줄은 이어 붙어도 돼요)
  const VISIT = new Map(), vk = (bi, x, z) => ((bi + 64) * 512 + Math.floor(x / 5) + 256) * 512 + Math.floor(z / 5) + 256;
  const visited = (bi, x, z, run) => { for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++){ const v = VISIT.get(vk(bi, x + a * 5, z + c * 5)); if (v !== undefined && v !== run) return true; } return false; };
  const visit = (bi, x, z, run) => VISIT.set(vk(bi, x, z), run);
  // 판 하나: (x, z) 의 비탈에 붙여요. 비켜 갈 곳 · 길 · 물 · 나무는 판 반 길이(L/2)로 봐요. 반환: 성공 여부 (_cc = 등고선 방향 · 길이)
  function plate(x, z, b, P, bi, big){
    const strata = bi !== null, pal = strata ? bandPal(b, bi) : PP[b] || PP.meadow, nv = tnorm(x, z), seed = nseed();
    // 층리: 거의 수평인 두꺼운 턱 (앞면 2~3.4m) · 바위 비늘: 비탈에 반쯤 묻힌 큰 바위 면
    const g = big ? 1.3 : 1, L = (strata ? rr(6, 11) : rr(4, 8)) * g, T = (strata ? rr(2, 3.4) : rr(1.2, 2.2)) * g, Wd = (strata ? rr(3, 5) : rr(3.5, 6.5)) * g, tw = strata ? rr(-0.12, 0.12) : rr(-0.9, 0.9), tpl = R() < (strata ? 0.3 : 0.65) ? TPL.ico0 : TPL.dod;
    let cx = -nv[2], cz = nv[0]; const cl = Math.hypot(cx, cz) || 1; cx /= cl; cz /= cl; _cc[0] = cx; _cc[1] = cz; _cc[2] = L;
    const rad = L / 2;
    if (safeAt(x, z) || wetR(x, z, rad * 0.8) || roadD(x, z) < 5 + rad || kept(x, z, rad, true) || vegD(x, z) < rad * 0.6) return false;
    const cell = cellOf(x, z); if (cell.plates >= PCELL || STATS.plates >= MAXP) return false;
    // 두께 축 Y = 법선 (층리면 위쪽으로 기울여요), 긴 축 X = 등고선 방향
    const k = strata ? P.k : 0.12; let yx = nv[0] * (1 - k), yy = nv[1] * (1 - k) + k, yz = nv[2] * (1 - k); const yl = Math.hypot(yx, yy, yz); Ya[0] = yx / yl; Ya[1] = yy / yl; Ya[2] = yz / yl;
    const ct = Math.cos(tw), st = Math.sin(tw);
    // X = 등고선을 법선 둘레로 조금 돌린 것 → Y 에 직교화
    let xx = cx * ct, xy = st * 0.5, xz = cz * ct; const dt = xx * Ya[0] + xy * Ya[1] + xz * Ya[2]; xx -= Ya[0] * dt; xy -= Ya[1] * dt; xz -= Ya[2] * dt; const xl = Math.hypot(xx, xy, xz) || 1; Xa[0] = xx / xl; Xa[1] = xy / xl; Xa[2] = xz / xl;
    Za[0] = Xa[1] * Ya[2] - Xa[2] * Ya[1]; Za[1] = Xa[2] * Ya[0] - Xa[0] * Ya[2]; Za[2] = Xa[0] * Ya[1] - Xa[1] * Ya[0];
    basis3(Xa, Ya, Za);
    const out = strata ? 0 : -0.08, y = H(x, z);
    gBegin('plate', x, z, { plate: true });
    rock(tpl, { x: x + nv[0] * T * out, y: y + nv[1] * T * out, z: z + nv[2] * T * out, sx: L / 2, sy: T / 2, sz: Wd / 2, jit: 0.14, cuts: 1, cutY: 0.3, seed }); settle(1, 0.2);
    let y0 = 1e9, y1 = -1e9; for (let i = 0; i < tv; i++){ const v = TP[i * 3 + 1]; if (v < y0) y0 = v; if (v > y1) y1 = v; }
    const bl = b === 'blight';
    emit(bOf(cell, bl ? 'obs' : 'rock'), { pal, bi: (seed % 3 + 3) % 3, seed, y0, h: y1 - y0, tone: strata ? 1.1 : 1, seam: 0.03, tipGlow: 0, kind: 'plate' }, bl ? paintObs : paintRock);
    const gg = gEnd(); if (!gg || gg.dead) return false;
    cell.plates++; STATS.plates++; if (strata) STATS.strata++; cnt('plate', b); return true;
  }
  // 띠 높이 by 로 옮기기: 기울기 방향으로 뉴턴 3번 (한 번에 3m 까지)
  function snapBand(x, z, by){
    for (let k = 0; k < 3; k++){ const h = H(x, z), nv = tnorm(x, z), gx = -nv[0] / nv[1], gz = -nv[2] / nv[1], g2 = gx * gx + gz * gz; if (g2 < 0.3) return null;
      let t = (by - h) / g2; const step = Math.abs(t) * Math.sqrt(g2); if (step > 3) t *= 3 / step; x += gx * t; z += gz * t; }
    return Math.abs(H(x, z) - by) < 0.8 ? [x, z] : null; }
  let RUN = 0;
  for (const q of ORD){
    if (STATS.plates >= MAXP) break;
    const x = PC[q * 5], z = PC[q * 5 + 1], i = PC[q * 5 + 2], j = PC[q * 5 + 3], b = BIOME(x, z), P = PB[b];
    if (P.band){
      // ── 층리 턱 한 줄 ──
      const bi = Math.round((H(x, z) - P.off) / P.band), by = bi * P.band + P.off;
      if (hash(bi + 50, Math.floor(x / 70), Math.floor(z / 70) + 311) > P.pres) continue;
      const p = snapBand(x, z, by), run = ++RUN; if (!p || visited(bi, p[0], p[1], run)) continue;
      srand(hashS('strata:' + i + ',' + j)); const big = hash(i, j, 80) < 0.18, len = 4 + (hash(i, j, 81) * 7 | 0);
      if (!plate(p[0], p[1], b, P, bi, big)) continue; visit(bi, p[0], p[1], run);
      const c0x = _cc[0], c0z = _cc[1], L0 = _cc[2];
      for (const sd of [1, -1]){ let qx = p[0], qz = p[1], dx = c0x * sd, dz = c0z * sd, L = L0;
        for (let k = 0; k < Math.ceil(len / 2) && STATS.plates < MAXP; k++){
          const st = L * rr(0.62, 0.78), nq = snapBand(qx + dx * st, qz + dz * st, by); if (!nq) break;   // 조금씩 겹쳐서 끊김 없는 띠
          if (slope(nq[0], nq[1]) < P.s * 0.8 || visited(bi, nq[0], nq[1], run)) break;
          const nv = tnorm(nq[0], nq[1]); let cx = -nv[2], cz = nv[0]; const cl = Math.hypot(cx, cz) || 1; cx /= cl; cz /= cl; if (cx * dx + cz * dz < 0){ cx = -cx; cz = -cz; }
          qx = nq[0]; qz = nq[1]; dx = cx; dz = cz;
          if (!plate(qx, qz, b, P, bi, big)){ if (R() < 0.5) break; continue; }   // 가끔 끊긴 턱
          visit(bi, qx, qz, run); L = _cc[2]; } }
    } else {
      // ── 바위 비늘: 한 장 + (가끔) 위로 한 장 · 옆으로 한 장 ──
      const run = ++RUN; if (visited(-1, x, z, run)) continue;
      srand(hashS('pl:' + i + ',' + j)); const big = hash(i, j, 80) < 0.22;
      if (!plate(x, z, b, P, null, big)) continue; visit(-1, x, z, run);
      const c0x = _cc[0], c0z = _cc[1], L0 = _cc[2], nv = tnorm(x, z), gx = -nv[0] / nv[1], gz = -nv[2] / nv[1], gl = Math.hypot(gx, gz) || 1;
      if (hash(i, j, 82) < 0.5){ const d = L0 * rr(0.55, 0.75), px = x + gx / gl * d, pz = z + gz / gl * d; if (slope(px, pz) > P.s * 0.85 && plate(px, pz, b, P, null, big)) visit(-1, px, pz, run); }
      if (hash(i, j, 81) < 0.35){ const sd = hash(i, j, 83) < 0.5 ? 1 : -1, d = L0 * rr(0.7, 0.95) * sd, px = x + c0x * d, pz = z + c0z * d; if (slope(px, pz) > P.s * 0.85 && plate(px, pz, b, P, null, big)) visit(-1, px, pz, run); }
    }
  }
  const kT = Math.min(1, MAXT / 2 / Math.max(1, TC.length / 4));
  for (let q = 0; q < TC.length; q += 4){
    const x = TC[q], z = TC[q + 1], i = TC[q + 2], j = TC[q + 3]; if (hash(i, j, 78) > kT || STATS.talus >= MAXT) continue;
    if (!clearAt(x, z, 3, { nopg: true }) || placed(x, z, 1)) continue;
    const b = BIOME(x, z), pal = PP[b] || PP.meadow, cell = cellOf(x, z), m = 1 + (hash(i, j, 76) * 3 | 0);
    srand(hashS('tal:' + i + ',' + j));
    for (let k = 0; k < m; k++){ const px = x + rr(-1.8, 1.8), pz = z + rr(-1.8, 1.8), rs = k ? rr(0.35, 0.9) : rr(0.6, 1.7); if (vegD(px, pz) < rs) continue;
      gBegin('talus', px, pz);
      stone(cell, { kind: 'talus', x: px, z: pz, gy: H(px, pz), r: rs, h: rs * rr(0.9, 1.5), tpl: 'dod', pal, mat: b === 'blight' ? 'obs' : 'rock', ry: R() * TAU, lean: rr(0, 0.5), dir: R() * TAU, cuts: 1, sink: 0.3, seam: 0.04, tipGlow: 0 });
      if (rs > 1) circleCol(px, pz, rs * 0.8); const gg = gEnd(); if (gg && !gg.dead){ STATS.talus++; cnt('talus', b); } }
  }
  STATS.phase.plate = Math.round(performance.now() - tP);
}

// ═════════════════════════ 양보 (나무 · 나중 모듈 것) ═════════════════════════
// items = [x, z, pad, y(NaN = 그 자리 땅)] … — 무리 발자국 안(+pad)이고 무리 높이 범위에 걸치면 무리째 지워요
function sweep(items, why){ let n = 0;
  for (let q = 0; q < items.length; q += 4){ const x = items[q], z = items[q + 1], pad = items[q + 2], yy = items[q + 3], gy = yy === yy ? yy : H(x, z);
    gEach(x, z, pad, g => { if (g.dead || gy < g.y0 - 1.5 || gy > g.y1 + 0.3) return; if (hullDist(g.hull, x, z) < pad){ if (g.keep){ (STATS.blocked || (STATS.blocked = [])).length < 20 && STATS.blocked.push([why, Math.round(x), Math.round(z), g.kind]); return; } kill(g, why); n++; } }); }
  return n; }
// world 나무 · 큰 바위 줄기: 줄기 가운데가 바위 발자국 안 (+줄기 반지름의 75%) 이면
{ const tV = performance.now(), items = []; for (const L of VG.values()) for (let q = 0; q < L.length; q += 4) items.push(L[q], L[q + 1], L[q + 2] * 0.75, L[q + 3]);
  sweep(items, 'veg'); STATS.phase.veg = Math.round(performance.now() - tV); }
// 나중 모듈이 fieldReady 까지 놓는 충돌체 · 상호작용을 적어 둬요 (landmarks 처럼 감싸고, 끝나면 되돌려요)
const FOREIGN = [], _aC = F.addCollider, _aI = F.addInteract; let recOn = true;
const wC = c => { if (recOn && c){ if (c.t === 'c') FOREIGN.push(c.x, c.z, Math.min(c.r, 1.5) * 0.6 + 0.15, NaN); else if (c.t === 'b') FOREIGN.push(c.x, c.z, Math.min(c.hw, c.hd, 1.5) * 0.6 + 0.15, NaN); } return _aC(c); };
const wI = it => { if (recOn && it && it.x != null) FOREIGN.push(it.x, it.z, 1.0, NaN); return _aI(it); };
F.addCollider = wC; F.addInteract = wI;

// ═════════════════════════ 메시 · 재질 ═════════════════════════
const NEAR = LOW ? 130 : 190, FARV = LOW ? 640 : 900;
const TU = { value: 0 }, FU = { uP: { value: new THREE.Vector2(1e6, 1e6) }, uNear: { value: NEAR }, uFar: { value: FARV } };
const GRAIN = '\t{ float cg = fract(sin(dot(floor(vCW * 1.6), vec3(12.9898, 78.233, 37.719))) * 43758.5453); diffuseColor.rgb *= 0.955 + 0.07 * cg; }';
function mkMat(name, o, emis, far){
  const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 }, o));
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = TU; if (far){ sh.uniforms.uP = FU.uP; sh.uniforms.uNear = FU.uNear; sh.uniforms.uFar = FU.uFar; }
    sh.vertexShader = 'varying vec3 vCW;\n' + (far ? 'attribute vec2 aCell;\nuniform vec2 uP;\nuniform float uNear, uFar;\n' : '') + sh.vertexShader
      .replace('#include <color_vertex>', '#include <color_vertex>\n\tvColor.rgb = pow(vColor.rgb, vec3(2.2));')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvCW = position;')
      .replace('#include <project_vertex>', '#include <project_vertex>' + (far ? `\n\t{ vec2 dd = max(abs(uP - aCell) - ${CHF.toFixed(1)}, 0.0); if (length(dd) < uNear || length(aCell - uP) > uFar) gl_Position = vec4(0.0, 0.0, -2.0, 1.0); }` : ''));
    sh.fragmentShader = 'varying vec3 vCW;\nuniform float uTime;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + (far ? '' : GRAIN))
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + (emis || ''));
  };
  m.customProgramCacheKey = () => 'crags_' + name;
  return m;
}
const MATS = {
  rock: mkMat('rock', {}),
  ice: mkMat('ice', { roughness: 0.16, metalness: 0.12 }, '\ttotalEmissiveRadiance += vColor * 0.3;'),
  obs: mkMat('obs', { roughness: 0.26, metalness: 0.28 }, '\ttotalEmissiveRadiance += max(vColor - vec3(0.035), vec3(0.0)) * 1.05 * (0.7 + 0.3 * sin(uTime * 1.5 + vCW.x * 0.09 + vCW.z * 0.07));'),
};
const FARM = mkMat('far', { roughness: 0.95 }, '', true);
const CL = []; let FARMESH = null, built = false, compiled = false;
// 칸마다: 그림자 안 드리우는 재질별 메시 (판석 · 너덜 · 잔돌 · 얼음) + 큰 것의 100m 조각 메시 (castShadow, 경계 구가 작아요)
function buildMeshes(){
  if (built) return; built = true; const tB = performance.now(); let tris = 0;
  for (const c of CELLS){ if (!c) continue; const g = new THREE.Group(); g.name = `crags_${c.i}_${c.j}`; let any = false;
    const add = (B, k, cast) => { const geo = B.geo(); if (!geo) return; const m = new THREE.Mesh(geo, MATS[k]); m.castShadow = cast; m.receiveShadow = true; m.matrixAutoUpdate = false; m.name = 'crags_' + k + (cast ? '_sh' : '');
      g.add(m); const t = geo.index.count / 3; tris += t; if (cast){ STATS.casters++; STATS.casterTris += t; } any = true; };
    for (const k of ['rock', 'ice', 'obs']) if (c.B[k]) add(c.B[k], k, false);
    for (const key in c.T) add(c.T[key], key.slice(0, key.indexOf(':')), true);
    c.B = c.T = null;
    if (!any) continue; g.visible = false; g.matrixAutoUpdate = false; FW.add(g); CL.push({ g, cx: c.cx, cz: c.cz, i: c.i, j: c.j }); STATS.cells++; }
  { const geo = FB.geo(); if (geo){ FARMESH = new THREE.Mesh(geo, FARM); FARMESH.frustumCulled = false; FARMESH.matrixAutoUpdate = false; FARMESH.castShadow = false; FARMESH.receiveShadow = false; FARMESH.name = 'crags_far'; FW.add(FARMESH); STATS.farTris = geo.index.count / 3; } }
  STATS.tris = Math.round(tris); STATS.farTris = Math.round(STATS.farTris); STATS.casterTris = Math.round(STATS.casterTris); API._dbg.FARMESH = FARMESH;
  for (const g of GRP) g.parts = null; FB.P = FB.N = FB.C = FB.A = FB.I = FB.drop = null;   // 빌더 배열은 이제 GPU 쪽에 — 발자국(껍질)만 남겨요 (at 용)
  STATS.phase.build = Math.round(performance.now() - tB);
  if (F.inField && !compiled){ compiled = true; prewarm(); }
}
// fieldReady 뒤 (다른 fieldReady 처리 — raid 입구 등 — 가 끝난 다음): 기록을 멈추고 양보 → 메시
function finish(){
  if (built) return; recOn = false; if (F.addCollider === wC) F.addCollider = _aC; if (F.addInteract === wI) F.addInteract = _aI;
  const tY = performance.now(), items = FOREIGN.slice(), rpg = F.modules && F.modules.rpg;
  if (rpg && typeof rpg === 'object'){
    for (const s of rpg.SPIRITS || []) items.push(s.x, s.z, 0.9, NaN);
    for (const c of rpg.CHESTS || []) items.push(c.x, c.z, 1.2, NaN);
    for (const nd of rpg.NODES || []) items.push(nd.x, nd.z, 1.0, NaN); }
  STATS.foreign = items.length / 4; STATS.yielded = sweep(items, 'yield'); STATS.phase.yield = Math.round(performance.now() - tY);
  buildMeshes();
  const K = STATS.killed; console.log(`[crags] 양보 ${STATS.yielded} (기록 ${STATS.foreign}) · 지운 무리 ${JSON.stringify(K)} · 칸 ${STATS.cells} · ${Math.round(STATS.tris / 1000)}k 삼각형 (그림자 조각 ${STATS.casters}개 ${Math.round(STATS.casterTris / 1000)}k · 먼 ${Math.round(STATS.farTris / 1000)}k) · 충돌체 ${STATS.colliders} · 만들기 ${STATS.phase.build}ms`);
}
BUS.on('fieldReady', () => setTimeout(finish, 0));

// ═════════════════════════ 거리로 켜고 끄기 ═════════════════════════
// 칸 사각형까지 거리 < NEAR → 자세한 칸 켬. 먼 메시는 같은 uP · uNear 로 그 칸 것을 지워요.
function cull(px, pz){
  for (const c of CL){ const dx = Math.max(Math.abs(px - c.cx) - CHF, 0), dz = Math.max(Math.abs(pz - c.cz) - CHF, 0); c.g.visible = Math.hypot(dx, dz) < NEAR; }
  FU.uP.value.set(px, pz);
}
let cullT = 0;
G.hooks.push((dt, rdt) => {
  if (!F.inField) return;
  TU.value += dt;
  cullT -= rdt; if (cullT <= 0){ cullT = 0.25; cull(X.player.pos.x, X.player.pos.z); }
});
// 처음 필드에 들어올 때 (순간이동 화면 뒤에서) 셰이더를 미리 컴파일 — 가까이 가서 끊기지 않게
function prewarm(){ try { for (const c of CL) c.g.visible = true; G.renderer.compile(FW, G.camera, G.scene); } catch (e){ console.warn('[crags] 미리 컴파일 실패', e); }
  cull(X.player.pos.x, X.player.pos.z); }
BUS.on('enterField', () => { cullT = 0; if (!built && F.ready) finish(); if (!built || compiled) return; compiled = true; prewarm(); });

// ═════════════════════════ API ═════════════════════════
// at: 무리 발자국(볼록 껍질)이 (x, z) 에서 pad 안이면 그 무리 (지워진 것은 빼고)
const at = (x, z, pad = 0) => { let best = null, bd = 1e9;
  gEach(x, z, pad, g => { if (g.dead) return; const d = hullDist(g.hull, x, z) - pad; if (d < 0 && d < bd){ bd = d; best = g; } });
  return best ? { kind: best.kind, x: Math.round(best.cx * 10) / 10, z: Math.round(best.cz * 10) / 10, r: Math.round(best.r * 10) / 10, y0: Math.round(best.y0 * 10) / 10, y1: Math.round(best.y1 * 10) / 10 } : null; };
const ms = Math.round(performance.now() - T0); STATS.ms = ms;
const API = { list: LIST, stats: STATS, at, names: ARCHES.filter(a => a.slot.name).map(a => ({ name: a.slot.name, x: Math.round(a.cx), z: Math.round(a.cz), y: Math.round(a.top), span: Math.round(a.span), gap: Math.round(a.gap) })),
  _dbg: { CL, FARMESH, MATS, FARM, FU, NEAR, cull, GRP } };
F.crags = API;
console.log(`[crags] 왕관 ${STATS.crowns} · 능선 ${STATS.ridges} · 첨탑 ${STATS.spires} (후두 ${STATS.hoodoos} · 균형 ${STATS.balanced} · 기둥 ${STATS.pillars} · 거석 ${STATS.monoliths} · 얼음 ${STATS.ice} · 흑요석 ${STATS.obsidian} · 바다 기둥 ${STATS.stacks}) · 아치 ${STATS.arches} · 표석 ${STATS.erratics} · 판석 ${STATS.plates} (층리 ${STATS.strata}) · 너덜 ${STATS.talus} · 무리 ${STATS.groups} · 충돌체 ${STATS.colliders} · ${ms}ms ${JSON.stringify(STATS.phase)} (메시는 fieldReady 뒤)`);
return API;
}
