// 룬 아고라 — 모험의 대지: world
// 지형(높이장 · 메시 · 물 · 식생 · 바위) · 길 · 강 · 다리 · 룬 비석(빠른 이동) · 월드맵(M) · 미니맵 · 낮밤 · 글라이더 · 헤엄 · 바람 승강 룬 · 절벽 처리
// 계약서: docs/agora-modules.md — 필드 물체는 F.FW 에 절대 y, 전투 레이어 이펙트(X.burst 등)는 지면 기준 y
export async function init(G, X, F){
const { THREE, V3, BUS, TAU } = X;
const W = F.WORLD, S = X.S, HALF = W.half, WL = W.water, byId = F.byId;
const LOW = G.gfxMode === 'low' || G.IS_TOUCH;
S.field = Object.assign({ fog: '', terr: {} }, S.field); if (!S.field.terr) S.field.terr = {};
const idle = () => new Promise(r => setTimeout(r, 0));
const sst = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t, c01 = t => t < 0 ? 0 : t > 1 ? 1 : t;
const T0 = performance.now();

// ───────────────────────── 노이즈 (시드 고정 — 모두에게 같은 대륙) ─────────────────────────
const rng = (a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(77031);
const PM = new Uint8Array(512), GXA = new Float32Array(256), GZA = new Float32Array(256);
{ const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--){ const j = (rng() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; } for (let i = 0; i < 512; i++) PM[i] = p[i & 255]; for (let i = 0; i < 256; i++){ const a = rng() * TAU; GXA[i] = Math.cos(a); GZA[i] = Math.sin(a); } }
// 그레이디언트 노이즈 ≈ -0.7 ~ 0.7
function pn(x, y){
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X0 = xi & 255, Y0 = yi & 255;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const a = PM[PM[X0] + Y0], b = PM[PM[X0 + 1] + Y0], c = PM[PM[X0] + Y0 + 1], d = PM[PM[X0 + 1] + Y0 + 1];
  const ga = GXA[a] * xf + GZA[a] * yf, gb = GXA[b] * (xf - 1) + GZA[b] * yf, gc = GXA[c] * xf + GZA[c] * (yf - 1), gd = GXA[d] * (xf - 1) + GZA[d] * (yf - 1);
  const x1 = ga + (gb - ga) * u; return x1 + (gc + (gd - gc) * u - x1) * v;
}
function fbm(x, y, o){ let s = 0, a = 1, t = 0; for (let i = 0; i < o; i++){ s += pn(x, y) * a; t += a; const nx = x * 1.62 + y * 1.18 + 17.3; y = -x * 1.18 + y * 1.62 - 9.1; x = nx; a *= 0.5; } return s / t * 1.5; }      // ≈ -1 ~ 1
function ridged(x, y, o){ let s = 0, a = 1, t = 0; for (let i = 0; i < o; i++){ const n = 1 - Math.abs(pn(x, y) * 1.45); s += n * n * a; t += a; const nx = x * 1.7 + y * 1.1 + 5.3; y = -x * 1.1 + y * 1.7 + 3.1; x = nx; a *= 0.5; } return s / t; }   // 0 ~ 1 (능선 = 1)
const hash = (i, j, s = 0) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

// ───────────────────────── 꺾은선 (길 · 강 · 능선) ─────────────────────────
function poly(pts){ const seg = []; let cum = 0; for (let i = 0; i < pts.length - 1; i++){ const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az) || 1e-3; seg.push({ ax, az, bx, bz, dx: (bx - ax) / L, dz: (bz - az) / L, L, s0: cum }); cum += L; } return { pts, seg, len: cum }; }
let _ps = 0, _pi = 0;
function pdist(P, x, z){ let best = 1e9; for (let i = 0; i < P.seg.length; i++){ const g = P.seg[i]; let t = (x - g.ax) * g.dx + (z - g.az) * g.dz; t = t < 0 ? 0 : t > g.L ? g.L : t; const d = Math.hypot(x - g.ax - g.dx * t, z - g.az - g.dz * t); if (d < best){ best = d; _ps = g.s0 + t; _pi = i; } } return best; }
function pAt(P, s){ for (const g of P.seg) if (s <= g.s0 + g.L || g === P.seg[P.seg.length - 1]){ const t = Math.max(0, Math.min(g.L, s - g.s0)); return [g.ax + g.dx * t, g.az + g.dz * t, g.dx, g.dz]; } }

// ───────────────────────── 높이 격자 ─────────────────────────
const CS = 2.5, N = Math.round(HALF * 2 / CS) + 1, NN = N * N;     // 641 × 641
const HG = new Float32Array(NN);                // 지면 높이
const WLV = new Float32Array(NN).fill(WL);      // 수면 높이 (윗 은빛 개울만 다름)
const ICE = new Uint8Array(NN);                 // 얼음 호수
const PATHM = new Uint8Array(NN);               // 1 = 하늘길 · 2 = 계단/경사로 (길 색)
const RA = new Uint8Array(NN), RB = new Uint8Array(NN), RT = new Uint8Array(NN);   // 지역 A/B · A 가중치 (0~255)
function box(x0, z0, x1, z1, fn){
  const i0 = Math.max(0, Math.floor((x0 + HALF) / CS)), i1 = Math.min(N - 1, Math.ceil((x1 + HALF) / CS)), j0 = Math.max(0, Math.floor((z0 + HALF) / CS)), j1 = Math.min(N - 1, Math.ceil((z1 + HALF) / CS));
  for (let j = j0; j <= j1; j++){ const z = -HALF + j * CS; for (let i = i0; i <= i1; i++) fn(j * N + i, -HALF + i * CS, z); }
}
// 격자 보간 (메시와 같은 삼각형 분할: b–c 대각선)
function gridH(A, x, z){
  let fx = (x + HALF) / CS, fz = (z + HALF) / CS;
  fx = fx < 0 ? 0 : fx > N - 1.0001 ? N - 1.0001 : fx; fz = fz < 0 ? 0 : fz > N - 1.0001 ? N - 1.0001 : fz;
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * N + i;
  if (u + v <= 1){ const a = A[k]; return a + (A[k + 1] - a) * u + (A[k + N] - a) * v; }
  const d = A[k + N + 1]; return d + (A[k + N] - d) * (1 - u) + (A[k + 1] - d) * (1 - v);
}
const cellK = (x, z) => { const i = Math.round((x + HALF) / CS), j = Math.round((z + HALF) / CS); return (j < 0 ? 0 : j >= N ? N - 1 : j) * N + (i < 0 ? 0 : i >= N ? N - 1 : i); };

// 지역 (바이옴 섞기)
const REG = W.regions, NR = REG.length;
const BIO = { village: 0, meadow: 1, forest: 2, lake: 3, swamp: 4, canyon: 5, plateau: 6, blight: 7, snow: 8 };
const RBIO = REG.map(r => BIO[r.biome] ?? 1);
let rwA = 0, rwB = 0, rwT = 1;
function regW(x, z){
  let q1 = 1e9, q2 = 1e9, a = 0, b = 0;
  for (let r = 0; r < NR; r++){ const R0 = REG[r], q = Math.hypot(x - R0.c[0], z - R0.c[1]) / R0.r; if (q < q1){ q2 = q1; b = a; q1 = q; a = r; } else if (q < q2){ q2 = q; b = r; } }
  let dq = q2 - q1 + pn(x * 0.0055 + 41.2, z * 0.0055 - 3.3) * 0.3 + pn(x * 0.021 - 7, z * 0.021 + 2) * 0.1;
  if (dq < 0){ const t = a; a = b; b = t; dq = -dq; }
  rwA = a; rwB = b; rwT = 0.5 + 0.5 * sst(0, 0.18, dq);
}
// 피해야 할 곳 (지형 장식 · 식생)
const LMS = W.landmarks, CAMPS = W.camps, WPS = W.waypoints;
const TOWNS = W.settlements || [];
function nearList(list, x, z, pad, rk = 'r'){ for (const o of list){ const r = (o[rk] || 0) + pad, dx = x - o.c[0], dz = z - o.c[1]; if (dx * dx + dz * dz < r * r) return o; } return null; }

const ROADS = W.roads.map(r => Object.assign(poly(r.pts), { w: r.w, id: r.id, name: r.name }));
const RIVS = W.rivers.map(r => Object.assign(poly(r.pts), { w: r.w, depth: r.depth, id: r.id, name: r.name }));
const RDD = new Float32Array(NN).fill(1e4), RDI = new Int8Array(NN).fill(-1), RDS = new Float32Array(NN);   // 길 가장자리까지 거리 · 길 번호 · 길 위 위치
const RVD = new Float32Array(NN).fill(1e4), RVI = new Int8Array(NN).fill(-1), RVS = new Float32Array(NN);   // 강 중심까지 거리 · 강 번호 · 강 위 위치
function raster(list, D, I, Sx, pad, half){
  list.forEach((P, r) => { const m = pad + (half ? P.w / 2 : 0);
    for (const g of P.seg) box(Math.min(g.ax, g.bx) - m, Math.min(g.az, g.bz) - m, Math.max(g.ax, g.bx) + m, Math.max(g.az, g.bz) + m, (k, x, z) => {
      let t = (x - g.ax) * g.dx + (z - g.az) * g.dz; t = t < 0 ? 0 : t > g.L ? g.L : t; const d = Math.hypot(x - g.ax - g.dx * t, z - g.az - g.dz * t) - (half ? P.w / 2 : 0);
      if (d < D[k]){ D[k] = d; I[k] = r; Sx[k] = g.s0 + t; } }); });
}
raster(ROADS, RDD, RDI, RDS, 26, true);
raster(RIVS, RVD, RVI, RVS, 60, false);

// 단층 (그림자 낭떠러지): 선 a→b 의 북쪽이 솟아요
const SCARPS = W.scarps.map(s => { const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], L = Math.hypot(dx, dz); return Object.assign({}, s, { ux: dx / L, uz: dz / L, nx: dz / L, nz: -dx / L, L, calm: [] }); });
// 강이 단층을 건너는 곳 = 폭포 (절벽선을 곧게)
for (const s of SCARPS) for (const P of RIVS) for (const g of P.seg){
  const sa = (g.ax - s.a[0]) * s.nx + (g.az - s.a[1]) * s.nz, sb = (g.bx - s.a[0]) * s.nx + (g.bz - s.a[1]) * s.nz;
  if (sa * sb < 0){ const f = sa / (sa - sb), x = g.ax + (g.bx - g.ax) * f, z = g.az + (g.bz - g.az) * f; s.calm.push((x - s.a[0]) * s.ux + (z - s.a[1]) * s.uz); P.fallS = g.s0 + g.L * f; P.scarp = s; }
}
function scarpInfo(s, x, z){
  const px = x - s.a[0], pz = z - s.a[1], t = px * s.ux + pz * s.uz, sd0 = px * s.nx + pz * s.nz;
  if (sd0 < -90 || sd0 > 420 || t < -80 || t > s.L + 80) return null;
  let calm = 1; for (const c of s.calm) calm = Math.min(calm, sst(6, 34, Math.abs(t - c)));
  const lx = s.a[0] + s.ux * t; let gap = 0; for (const g of s.gaps || []) gap = Math.max(gap, 1 - sst(g.w / 2, g.w / 2 + 30, Math.abs(lx - g.x)));
  const wob = (pn(t * 0.017, 3.7) * 12 + pn(t * 0.07, 8.1) * 3.5) * (1 - gap) * calm;
  return { t, sd: sd0 - wob, gap, end: sst(-70, 0, t) * sst(s.L + 70, s.L, t) };
}
function scarpH(s, x, z){ const q = scarpInfo(s, x, z); if (!q) return 0; const tw = lerp(s.w, 64, q.gap); return s.rise * sst(-tw / 2, tw / 2, q.sd) * (1 - sst(160, 420, q.sd)) * q.end; }

// ───────────────────────── 높이장 만들기 ─────────────────────────
const AMP1 = [1.2, 16, 13, 4.5, 1.8, 7, 6, 9, 16], AMP2 = [0.35, 3.2, 3.2, 1.2, 1.5, 2.2, 2.2, 3.4, 5];
async function buildHeights(){
  // 0) 기본 높이: 조절점 역거리 가중 (5m 격자)
  const NC = 321, CC = 5, CG = new Float32Array(NC * NC), EL = W.elev;
  for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++){ const x = -HALF + i * CC, z = -HALF + j * CC; let sw = 0, sh = 0; for (let e = 0; e < EL.length; e++){ const p = EL[e], d2 = (x - p[0]) ** 2 + (z - p[1]) ** 2 + 1800, w = 1 / (d2 * Math.sqrt(d2)); sw += w; sh += w * p[2]; } CG[j * NC + i] = sh / sw; }
  await idle();
  // 1) 지역별 굴곡 + 협곡 지느러미 바위 · 계단 지형 + 가시밭 요철
  for (let j = 0; j < N; j++){
    const z = -HALF + j * CS;
    for (let i = 0; i < N; i++){
      const x = -HALF + i * CS, k = j * N + i;
      const fx = (x + HALF) / CC, fz = (z + HALF) / CC, ci = Math.min(NC - 2, fx | 0), cj = Math.min(NC - 2, fz | 0), u = fx - ci, v = fz - cj, c0 = cj * NC + ci;
      let h = (CG[c0] * (1 - u) + CG[c0 + 1] * u) * (1 - v) + (CG[c0 + NC] * (1 - u) + CG[c0 + NC + 1] * u) * v;
      regW(x, z); RA[k] = rwA; RB[k] = rwB; RT[k] = Math.round(rwT * 255);
      const bA = RBIO[rwA], bB = RBIO[rwB], t = rwT;
      const a1 = AMP1[bA] * t + AMP1[bB] * (1 - t), a2 = AMP2[bA] * t + AMP2[bB] * (1 - t);
      h += fbm(x * 0.0052, z * 0.0052, 3) * a1 * 0.62 + fbm(x * 0.023 + 31, z * 0.023 - 7, 3) * a2 * 0.6 + pn(x * 0.11, z * 0.11) * 0.22;
      const cw = (bA === 5 ? t : 0) + (bB === 5 ? 1 - t : 0);
      if (cw > 0.02){
        let sup = sst(14, 34, RDD[k]);
        if (sup > 0){ const c = nearList(CAMPS, x, z, 12) || nearList(LMS, x, z, 10) || nearList(TOWNS, x, z, 14) || nearList(WPS, x, z, 22, 'none'); if (c) sup = 0; }
        if (sup > 0){
          const rf = ridged(x * 0.0105 + 3.1, z * 0.0105 - 7.7, 3), bl = fbm(x * 0.006 - 11, z * 0.006 + 4, 2);
          h += (sst(0.66, 0.86, rf) * 21 + sst(0.2, 0.34, bl) * 15) * cw * sup;
        }
        const st = 5.5, q = h / st, fq = q - Math.floor(q), ht = (Math.floor(q) + sst(0.68, 0.96, fq)) * st;
        h = lerp(h, ht, cw * 0.85 * (0.4 + 0.6 * sup));
      }
      const sw4 = (bA === 4 ? t : 0) + (bB === 4 ? 1 - t : 0);
      if (sw4 > 0.02) h -= sst(0.05, 0.42, fbm(x * 0.026 + 9, z * 0.026 - 4, 3)) * 2.6 * sw4 * sst(3, 12, RDD[k]);
      const bw = (bA === 7 ? t : 0) + (bB === 7 ? 1 - t : 0);
      if (bw > 0.02) h += Math.pow(ridged(x * 0.045, z * 0.045, 2), 4) * 2.6 * bw;
      HG[k] = h;
    }
    if (j % 64 === 63) await idle();
  }
  // 2) 단층 · 능선 · 봉우리 · 가장자리 산맥
  for (const s of SCARPS){ const m = 460; box(Math.min(s.a[0], s.b[0]) - 90, Math.min(s.a[1], s.b[1]) - m, Math.max(s.a[0], s.b[0]) + 90, Math.max(s.a[1], s.b[1]) + 100, (k, x, z) => { HG[k] += scarpH(s, x, z); }); }
  for (const rg of W.ridges){ const P = poly(rg.pts), m = rg.w * 1.2; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of rg.pts){ x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    box(x0 - m, z0 - m, x1 + m, z1 + m, (k, x, z) => { const d = pdist(P, x, z); if (d > m) return; const pass = rg.pass, hx = pass ? lerp(pass.h, rg.h, sst(pass.w / 2, pass.w / 2 + 70, Math.abs(x - pass.x))) : rg.h;
      const q = d / rg.w, pr = q < 1 ? (1 - q * q) ** 2 : 0, jag = ridged(x * 0.03 + 9, z * 0.03, 3);
      const rh = hx * pr + (jag - 0.5) * 18 * pr * sst(0, 30, hx - 52) + pn(_ps * 0.04, 2.2) * 8 * pr * sst(0, 30, hx - 52);
      if (rh > HG[k]) HG[k] = lerp(HG[k], rh, sst(0, 0.25, pr)); }); }
  for (const p of W.peaks){
    const sp = W.spirals.find(s => Math.hypot(s.c[0] - p.c[0], s.c[1] - p.c[1]) < 5), R = p.r * 1.35;
    box(p.c[0] - R, p.c[1] - R, p.c[0] + R, p.c[1] + R, (k, x, z) => {
      const d = Math.hypot(x - p.c[0], z - p.c[1]); let ph;
      if (sp){ const kk = (sp.h1 - sp.h0) / (sp.r0 - sp.r1); ph = d <= sp.r1 + 2 ? sp.h1 + 1.5 * (1 - d / (sp.r1 + 2)) : sp.h1 - kk * (d - sp.r1); ph += (ridged(x * 0.05, z * 0.05, 3) - 0.55) * 7 * sst(sp.r1, sp.r1 + 12, d); const ca = (x - p.c[0]) / (d || 1), sa = (z - p.c[1]) / (d || 1); ph += (pn(ca * 1.7 + 11, sa * 1.7 + d * 0.012) * 18 + (ridged(ca * 3.2 + 3, sa * 3.2 + d * 0.035, 2) - 0.5) * 12) * sst(sp.r1 + 4, sp.r1 + 26, d); }
      else { const q = d / p.r; ph = p.h * Math.pow(Math.max(0, 1 - q), 1.18) + (ridged(x * 0.045 + 4, z * 0.045, 3) - 0.5) * 16 * Math.max(0, 1 - q); }
      if (ph > HG[k]) HG[k] = ph; }); }
  { const B = W.border; box(-HALF, -HALF, HALF, HALF, (k, x, z) => { const m = Math.max(Math.abs(x), Math.abs(z)); if (m < 600) return; const e = Math.pow(Math.pow(Math.abs(x), 6) + Math.pow(Math.abs(z), 6), 1 / 6); if (e < B.start) return; const q = sst(B.start, HALF + 20, e);
      HG[k] += B.peak * Math.pow(q, 1.4) * (0.7 + 0.55 * ridged(x * 0.009, z * 0.009, 4)) + fbm(x * 0.03, z * 0.03, 2) * 6 * q; }); }
  await idle();
  // 3) 메사 · 첨탑 · 고원 · 절벽 언덕
  for (const m of W.mesas){ const R = m.r * 1.3 + 16, rad = m.r;
    box(m.c[0] - R, m.c[1] - R, m.c[0] + R, m.c[1] + R, (k, x, z) => {
      const a = Math.atan2(z - m.c[1], x - m.c[0]), d = Math.hypot(x - m.c[0], z - m.c[1]) * (1 + pn(Math.cos(a) * 2.4 + m.c[0], Math.sin(a) * 2.4) * 0.16), base = HG[k];
      const top = m.h + pn(x * 0.08, z * 0.08) * 0.7, kk = sst(rad * 1.12 + 1.5, rad - 2, d), tal = sst(rad + 16, rad, d) * 0.16 * Math.max(0, top - base);
      const v = base + tal + (top - base - tal) * kk; if (v > HG[k]) HG[k] = v; }); }
  for (const p of W.plateaus){
    const ramps = W.ramps.map(r => ({ r, a: Math.atan2(r.to[1] - p.c[1], r.to[0] - p.c[0]), dt: Math.hypot(r.to[0] - p.c[0], r.to[1] - p.c[1]), df: Math.hypot(r.from[0] - p.c[0], r.from[1] - p.c[1]) })).filter(o => o.dt < p.r + p.noise + 10);
    p._ramps = ramps; const R = p.r + p.noise + 22;
    p.rAt = a => { let r = p.r + pn(Math.cos(a) * 2.2 + p.c[0] * 0.01, Math.sin(a) * 2.2 + 5) * 1.4 * p.noise; for (const o of ramps){ const da = Math.abs(Math.atan2(Math.sin(a - o.a), Math.cos(a - o.a))), w = 1 - sst(0.06, 0.26, da); r = lerp(r, Math.max(o.dt + 10, Math.min(r, o.df - 8)), w); } return r; };
    box(p.c[0] - R, p.c[1] - R, p.c[0] + R, p.c[1] + R, (k, x, z) => {
      const a = Math.atan2(z - p.c[1], x - p.c[0]), d = Math.hypot(x - p.c[0], z - p.c[1]), rr = p.rAt(a);
      if (d > rr + 22) return;
      const base = HG[k]; let top = p.h + fbm(x * 0.011, z * 0.011, 3) * 4.6 + pn(x * 0.06, z * 0.06) * 0.5;
      if (d < rr - 14){ let sup = sst(6, 18, RDD[k]); if (sup > 0 && (nearList(CAMPS, x, z, 8) || nearList(LMS, x, z, 6) || nearList(TOWNS, x, z, 10) || nearList(WPS, x, z, 14, 'none'))) sup = 0; top += sst(0.64, 0.82, ridged(x * 0.019 + 2, z * 0.019 - 5, 3)) * 8 * sup * sst(rr - 14, rr - 40, d); }
      const kk = sst(rr + p.edge * 0.5, rr - p.edge * 0.5, d), ledge = sst(rr + p.edge * 0.5 + 3, rr + p.edge * 0.5, d) * 0.06;
      const tal = sst(rr + 20, rr + 1, d) * 0.13 * Math.max(0, top - base);
      const v = base + tal + (top - base - tal) * Math.min(1, kk + ledge * kk); if (v > HG[k]) HG[k] = v; }); }
  for (const b of W.bluffs){ const R = b.r + 6, dx0 = Math.cos(b.dir), dz0 = Math.sin(b.dir);
    box(b.c[0] - R, b.c[1] - R, b.c[0] + R, b.c[1] + R, (k, x, z) => {
      const px = x - b.c[0], pz = z - b.c[1], u = px * dx0 + pz * dz0, v = Math.abs(-px * dz0 + pz * dx0), d = Math.hypot(px, pz) * (1 + pn(x * 0.09, z * 0.09) * 0.08);
      const rise = b.drop * sst(-b.r * 1.15, b.r * 0.72, u) * sst(b.r, b.r * 0.4, v), edge = lerp(1, sst(b.r + 1, b.r - 3, d), sst(-0.1 * b.r, 0.25 * b.r, u));
      HG[k] += rise * edge + pn(x * 0.2, z * 0.2) * 0.4 * rise / b.drop; }); }
  await idle();
  // 4) 새싹 마을 평탄화 (≈ y 8) + 룬의 관문 앞
  const VL = byId('regions', 'village'), VY = 8;
  box(VL.c[0] - 100, VL.c[1] - 100, VL.c[0] + 100, VL.c[1] + 100, (k, x, z) => { const d = Math.hypot(x - VL.c[0], (z - VL.c[1]) * (z > VL.c[1] ? 0.8 : 1)); const kk = sst(96, 60, d); if (kk > 0) HG[k] = lerp(HG[k], VY + pn(x * 0.05, z * 0.05) * 0.2, kk); });
  // 5) 호수 · 연못 (울퉁불퉁한 물가) · 섬 · 얼음 호수
  for (const L of W.lakes){
    const R = Math.max(L.rx, L.rz) * 1.35 + 60, mr = (L.rx + L.rz) / 2;
    if (L.frozen){ let sum = 0, n = 0; box(L.c[0] - L.rx, L.c[1] - L.rz, L.c[0] + L.rx, L.c[1] + L.rz, k => { sum += HG[k]; n++; }); const iy = sum / n - 1.2; L.y = iy;
      box(L.c[0] - L.rx * 1.6, L.c[1] - L.rz * 1.6, L.c[0] + L.rx * 1.6, L.c[1] + L.rz * 1.6, (k, x, z) => { const a = Math.atan2(z - L.c[1], x - L.c[0]), q = Math.hypot((x - L.c[0]) / L.rx, (z - L.c[1]) / L.rz) * (1 + pn(Math.cos(a) * 2 + 9, Math.sin(a) * 2) * 0.16);
        if (q < 1){ HG[k] = iy; ICE[k] = 1; } else if (q < 1.45) HG[k] = lerp(iy + 0.25, HG[k], sst(1, 1.45, q)); }); continue; }
    let sum = 0, n = 0; for (let a = 0; a < TAU; a += 0.3){ sum += gridH(HG, L.c[0] + Math.cos(a) * L.rx * 1.3, L.c[1] + Math.sin(a) * L.rz * 1.3); n++; }
    const rim = sum / n, bl = Math.min(8 + Math.max(0, rim - WL) * 2.6, Math.max(14, mr * 1.6)) / mr;
    box(L.c[0] - R, L.c[1] - R, L.c[0] + R, L.c[1] + R, (k, x, z) => {
      const a = Math.atan2(z - L.c[1], x - L.c[0]), q = Math.hypot((x - L.c[0]) / L.rx, (z - L.c[1]) / L.rz) * (1 + pn(Math.cos(a) * 2.6 + L.c[0] * 0.02, Math.sin(a) * 2.6 + L.c[1] * 0.02) * (mr < 40 ? 0.34 : 0.2) + pn(x * 0.05, z * 0.05) * (mr < 40 ? 0.16 : 0.04));
      let v; if (q < 1) v = WL - 0.35 - L.depth * sst(1, 0.3, q) - pn(x * 0.04, z * 0.04) * 0.6 * sst(1, 0.6, q);
      else v = lerp(WL - 0.35, HG[k], Math.pow(sst(1, 1 + bl, q), 0.85));
      if (v < HG[k]) HG[k] = v; }); }
  for (const s of W.islands){ const R = s.r * 2.4; box(s.c[0] - R, s.c[1] - R, s.c[0] + R, s.c[1] + R, (k, x, z) => { const a = Math.atan2(z - s.c[1], x - s.c[0]), q = Math.hypot(x - s.c[0], z - s.c[1]) / s.r * (1 + pn(Math.cos(a) * 2 + 3, Math.sin(a) * 2) * 0.15);
      const v = q < 1 ? WL - 0.3 + (s.h - WL + 0.3) * sst(1.0, 0.42, q) + pn(x * 0.1, z * 0.1) * 0.4 * sst(1, 0.5, q) : WL - 0.3 - (q - 1) * 7.5; if (v > HG[k]) HG[k] = v; }); }
  // 6) 하늘길 (나선 산길) — 봉우리 둘레를 깎은 선반
  for (const sp of W.spirals){ const R = sp.r0 + sp.w + 6;
    box(sp.c[0] - R, sp.c[1] - R, sp.c[0] + R, sp.c[1] + R, (k, x, z) => {
      const d = Math.hypot(x - sp.c[0], z - sp.c[1]); let a = Math.atan2(z - sp.c[1], x - sp.c[0]) - sp.start; a = ((a % TAU) + TAU) % TAU;
      for (let n = 0; n <= Math.ceil(sp.turns); n++){ const s = (a + n * TAU) / (sp.turns * TAU); if (s > 1.02) break; const sc = Math.min(1, s), r = lerp(sp.r0, sp.r1, sc), dr = Math.abs(d - r), hw = sp.w / 2;
        if (dr < hw + 3){ const hp = lerp(sp.h0, sp.h1, sc) + 0.2, kk = 1 - sst(hw, hw + 3, dr); HG[k] = lerp(HG[k], hp, kk); if (dr < hw + 0.6) PATHM[k] = 1; } } }); }
  await idle();
  // 7) 길: 길 위 높이를 부드럽게 (물에 잠기지 않게) → 양옆으로 섞기
  for (const P of ROADS){ const n = Math.ceil(P.len / 2) + 1, raw = new Float32Array(n); for (let i = 0; i < n; i++){ const [x, z] = pAt(P, i * 2); raw[i] = gridH(HG, x, z); }
    P.ys = new Float32Array(n); for (let i = 0; i < n; i++){ let s = 0, w = 0; for (let o = -7; o <= 7; o++){ const q = Math.min(n - 1, Math.max(0, i + o)), ww = 8 - Math.abs(o); s += raw[q] * ww; w += ww; } P.ys[i] = Math.max(WL + 0.9, s / w); } }
  for (let k = 0; k < NN; k++){ const d = RDD[k]; if (d > 22) continue; const P = ROADS[RDI[k]], f = RDS[k] / 2, i = Math.min(P.ys.length - 2, f | 0), ry = lerp(P.ys[i], P.ys[i + 1], f - i), h = HG[k], bw = 3 + Math.min(14, Math.abs(h - ry) * 0.75);
    if (d < bw) HG[k] = lerp(h, ry + pn(k * 0.37, 1.1) * 0.03, 1 - sst(0.4, bw, d)); }
  // 8) 강: 물길 + 비탈 강둑. 단층 위(윗 은빛 개울)는 수면이 높아요 → 하얀 갈기 폭포
  for (const P of RIVS){
    const n = Math.ceil(P.len / 2) + 1; P.lv = new Float32Array(n); const raw = new Float32Array(n);
    for (let i = 0; i < n; i++){ const [x, z] = pAt(P, i * 2); raw[i] = gridH(HG, x, z); }
    let cur = 1e9;
    for (let i = 0; i < n; i++){ const s = i * 2; if (P.fallS != null && s < P.fallS - 6){ let m = 1e9; for (let o = -6; o <= 6; o++){ const q = Math.min(n - 1, Math.max(0, i + o)); if (q * 2 < P.fallS - 5) m = Math.min(m, raw[q]); } cur = Math.min(cur, m - 1.6); P.lv[i] = Math.max(WL, cur); } else P.lv[i] = WL; }
    if (P.fallS != null){ const fi = Math.round(P.fallS / 2); P.fallTop = P.lv[Math.max(0, fi - 4)]; P.upEnd = Math.max(0, fi - 3); }
  }
  for (let k = 0; k < NN; k++){ const d = RVD[k]; if (d > 60) continue; const P = RIVS[RVI[k]], f = RVS[k] / 2, i = Math.min(P.lv.length - 2, f | 0), L = lerp(P.lv[i], P.lv[i + 1], f - i), hw = P.w / 2 * (1 + pn(RVS[k] * 0.05, 7.7) * 0.25) + (RVS[k] < 10 ? 3 : 0), h = HG[k];
    const bank = 3 + Math.min(34, Math.max(0, h - L) * 1.7);
    let v; if (d < hw) v = L - 0.25 - P.depth * (1 - (d / hw) ** 2) * (L > WL + 0.5 ? 0.6 : 1); else v = lerp(L + 0.15, h, sst(hw, hw + bank, d));
    if (v < h){ HG[k] = v; if (L > WL + 0.5 && d < hw + 1.5) WLV[k] = L; } }
  // 폭포 아래 소 (깊은 웅덩이)
  for (const P of RIVS) if (P.fallS != null){ const [fx, fz, dx, dz] = pAt(P, P.fallS + 5); P.pool = [fx, fz]; box(fx - 16, fz - 16, fx + 16, fz + 16, (k, x, z) => { const q = Math.hypot(x - fx, z - fz) / 9.5; if (q < 1.6){ const v = q < 1 ? WL - 0.4 - 3.2 * sst(1, 0.2, q) : lerp(WL - 0.4, HG[k], sst(1, 1.6, q)); if (v < HG[k]) HG[k] = v; } }); P.fallDir = [dx, dz]; }
  // 여울: 다리 없이 길이 강을 건너는 곳은 얕게 (걸어서 건너요)
  FORDS.length = 0;
  for (const R0 of ROADS) for (const g of R0.seg) for (const P of RIVS) for (const h of P.seg){
    const den = g.dx * h.dz - g.dz * h.dx; if (Math.abs(den) < 1e-4) continue;
    const ex = h.ax - g.ax, ez = h.az - g.az, t = (ex * h.dz - ez * h.dx) / den, u = (ex * g.dz - ez * g.dx) / den;
    if (t < 0 || t > g.L || u < 0 || u > h.L) continue; const x = g.ax + g.dx * t, z = g.az + g.dz * t;
    if (W.bridges.some(b => Math.hypot(b.c[0] - x, b.c[1] - z) < 20)) continue;
    FORDS.push({ x, z, road: R0.id, river: P.id });
    box(x - 16, z - 16, x + 16, z + 16, (k, xx, zz) => { const q = Math.hypot(xx - x, zz - z) / (R0.w / 2 + 5); if (q < 1.5){ const v = WL - 0.42 + pn(xx * 0.3, zz * 0.3) * 0.08; HG[k] = lerp(HG[k], Math.max(HG[k], v), 1 - sst(1, 1.5, q)); } });
  }
  await idle();
  // 9) 경사로 · 계단 (거인의 계단: 계단식)
  for (const r of W.ramps){
    const dx = r.to[0] - r.from[0], dz = r.to[1] - r.from[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    const h0 = gridH(HG, r.from[0] - ux * 6, r.from[1] - uz * 6), h1 = gridH(HG, r.to[0] + ux * 8, r.to[1] + uz * 8), nst = Math.max(6, Math.round(L / 4.6));
    r.y0 = h0; r.y1 = h1; r.L = L; r.u = [ux, uz];
    box(Math.min(r.from[0], r.to[0]) - 40, Math.min(r.from[1], r.to[1]) - 40, Math.max(r.from[0], r.to[0]) + 40, Math.max(r.from[1], r.to[1]) + 40, (k, x, z) => {
      const px = x - r.from[0], pz = z - r.from[1], tt = (px * ux + pz * uz) / L, lat = Math.abs(-px * uz + pz * ux);
      if (tt < -0.25 || tt > 1.3 || lat > r.w / 2 + 22) return;
      let t = c01(tt); if (r.stairs){ const q = t * nst, fq = q - Math.floor(q); t = (Math.floor(q) + sst(0.78, 1, fq)) / nst; }
      const hr = lerp(h0, h1, t), h = HG[k], bw = 2 + Math.min(18, Math.abs(h - hr) * 0.85);
      let kk = 1 - sst(r.w / 2, r.w / 2 + bw, lat); kk *= sst(-0.25, -0.02, tt) * (tt > 1 ? sst(1.3, 1.05, tt) : 1);
      if (kk > 0){ HG[k] = lerp(h, hr, kk); if (lat < r.w / 2 + 0.5 && tt > -0.08 && tt < 1.06) PATHM[k] = r.stairs ? 2 : 3; } }); }
  // 10) 작은 평지: 룬 비석 · 바람 승강 룬 · 룬의 관문
  const pad = (x0, z0, r, y) => { const yy = y ?? gridH(HG, x0, z0); box(x0 - r * 2, z0 - r * 2, x0 + r * 2, z0 + r * 2, (k, x, z) => { const d = Math.hypot(x - x0, z - z0); if (d < r * 2) HG[k] = lerp(HG[k], yy, 1 - sst(r, r * 2, d)); }); return yy; };
  for (const w of WPS){ let s = 0; for (let a = 0; a < TAU; a += 0.8) s += gridH(HG, w.c[0] + Math.cos(a) * 3, w.c[1] + Math.sin(a) * 3); w.y = pad(w.c[0], w.c[1], 4.5, Math.max(WL + 0.6, s / 8)); }
  for (const l of W.lifts){ l.y0 = pad(l.from[0], l.from[1], 4); l.y1 = gridH(HG, l.to[0], l.to[1]); }
  { const g = byId('landmarks', 'runegate'); if (g) pad(g.c[0], g.c[1], 10, VY + 0.4); }
  // 정착지: 가운데 반쯤은 고르게, 바깥으로 갈수록 원래 땅으로 (집이 비탈에 뜨지 않게)
  for (const t of TOWNS){ if (!t.flat){ t.y = gridH(HG, t.c[0], t.c[1]); continue; } let s = 0, n = 0; for (let r = 0; r <= t.r * 0.6; r += t.r * 0.2) for (let a = 0; a < TAU; a += 0.5){ s += gridH(HG, t.c[0] + Math.cos(a) * r, t.c[1] + Math.sin(a) * r); n++; }
    const yy = t.ground ?? Math.max(WL + 0.9, s / n), x0 = t.c[0], z0 = t.c[1], R = t.r; t.y = yy;
    box(x0 - R * 1.3, z0 - R * 1.3, x0 + R * 1.3, z0 + R * 1.3, (k, x, z) => { const d = Math.hypot(x - x0, z - z0); if (d < R * 1.3 && !(HG[k] < WL + 0.4 && d > R * 0.62)) HG[k] = lerp(HG[k], yy, (1 - sst(R * 0.62, R * 1.3, d)) * 0.97); }); }
}
const FORDS = [];
const TB = performance.now();
await buildHeights();
const TH = performance.now();

// ───────────────────────── 다리 (걸어서 건너는 판) ─────────────────────────
// ry 를 몸체 회전으로 보고, 강을 더 곧게 가로지르는 축(로컬 x 또는 z)을 다리 길이 방향으로 써요
const BRIDGES = W.bridges.map(b => {
  const zx = Math.sin(b.ry), zz = Math.cos(b.ry), xx = Math.cos(b.ry), xz = -Math.sin(b.ry);
  let tx = 0, tz = 1, best = 1e9; for (const P of RIVS){ const d = pdist(P, b.c[0], b.c[1]); if (d < best){ best = d; const g = P.seg[_pi]; tx = g.dx; tz = g.dz; } }
  const [ux, uz] = Math.abs(zx * tx + zz * tz) < Math.abs(xx * tx + xz * tz) ? [zx, zz] : [xx, xz];
  // 양 끝이 마른 땅에 닿을 때까지 늘려요
  let e0 = b.len / 2, e1 = b.len / 2; while (e0 < b.len && gridH(HG, b.c[0] - ux * e0, b.c[1] - uz * e0) < WL + 0.7) e0 += 0.5; while (e1 < b.len && gridH(HG, b.c[0] + ux * e1, b.c[1] + uz * e1) < WL + 0.7) e1 += 0.5;
  e0 = e1 = Math.max(e0, e1);
  const ax = b.c[0] - ux * e0, az = b.c[1] - uz * e0, bx = b.c[0] + ux * e1, bz = b.c[1] + uz * e1, len = e0 + e1;
  const y0 = Math.max(WL + 0.7, gridH(HG, ax, az)), y1 = Math.max(WL + 0.7, gridH(HG, bx, bz)), mid = Math.max(WL + 2.4, (y0 + y1) / 2 + 0.6), arch = Math.max(0.6, mid - (y0 + y1) / 2);
  const o = { id: b.id, name: b.name, c: b.c, w: b.w, len, x0: ax, z0: az, x1: bx, z1: bz, ux, uz, y0, y1, arch, ry: Math.atan2(ux, uz) };
  o.yAt = t => lerp(y0, y1, t) + arch * Math.sin(Math.PI * c01(t));
  o.bb = [Math.min(ax, bx) - b.w, Math.min(az, bz) - b.w, Math.max(ax, bx) + b.w, Math.max(az, bz) + b.w];
  return o;
});
function bridgeH(x, z){
  for (const b of BRIDGES){ if (x < b.bb[0] || x > b.bb[2] || z < b.bb[1] || z > b.bb[3]) continue;
    const px = x - b.x0, pz = z - b.z0, t = (px * b.ux + pz * b.uz) / b.len, lat = Math.abs(-px * b.uz + pz * b.ux);
    if (t >= 0 && t <= 1 && lat <= b.w / 2 + 0.15) return b.yAt(t); }
  return -1e9;
}

// ───────────────────────── 높이 · 물 함수 (F) ─────────────────────────
const terrainH = (x, z) => gridH(HG, x, z);
const H = (x, z) => { const h = gridH(HG, x, z), b = bridgeH(x, z); return b > h ? b : h; };
const waterY = (x, z) => WLV[cellK(x, z)];
const isIce = (x, z) => ICE[cellK(x, z)] === 1;
F.H = H; F.terrainH = terrainH; F.waterY = waterY;
F.isWater = (x, z) => H(x, z) < waterY(x, z) - 0.25 && !isIce(x, z);
F.waterDepth = (x, z) => isIce(x, z) ? 0 : Math.max(0, waterY(x, z) - H(x, z));
F.slope = (x, z) => { const e = 1.25; return Math.hypot(H(x + e, z) - H(x - e, z), H(x, z + e) - H(x, z - e)) / (2 * e); };
F.roadDist = (x, z) => Math.max(0, RDD[cellK(x, z)]);
F.groundFn = (x, z) => { const h = H(x, z), w = waterY(x, z); return h < w - 1.05 && !isIce(x, z) ? w - 1.05 : h; };
F.bridges = BRIDGES; F.fords = FORDS; F.gliding = false; F.swimming = false;
F.biomeAt = (x, z) => { const k = cellK(x, z); return REG[RT[k] >= 128 ? RA[k] : RB[k]].biome; };

// 경사 · 법선 격자
const NRM = new Int8Array(NN * 3), SLP = new Float32Array(NN);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){
  const k = j * N + i, hx = (HG[j * N + Math.min(N - 1, i + 1)] - HG[j * N + Math.max(0, i - 1)]) / ((Math.min(N - 1, i + 1) - Math.max(0, i - 1)) * CS), hz = (HG[Math.min(N - 1, j + 1) * N + i] - HG[Math.max(0, j - 1) * N + i]) / ((Math.min(N - 1, j + 1) - Math.max(0, j - 1)) * CS);
  const l = Math.hypot(hx, 1, hz); NRM[k * 3] = Math.round(-hx / l * 127); NRM[k * 3 + 1] = Math.round(1 / l * 127); NRM[k * 3 + 2] = Math.round(-hz / l * 127); SLP[k] = Math.hypot(hx, hz);
}
await idle();

// ───────────────────────── 지형 색 (바이옴 · 바위 · 눈 · 물가 · 길) ─────────────────────────
// [풀 A, 풀 B, 얼룩, 바위] (sRGB)
const PAL = [
  [[0.40, 0.62, 0.27], [0.52, 0.70, 0.31], [0.66, 0.58, 0.40], [0.56, 0.54, 0.49]],
  [[0.33, 0.58, 0.22], [0.52, 0.69, 0.27], [0.72, 0.70, 0.30], [0.55, 0.54, 0.50]],
  [[0.19, 0.36, 0.16], [0.28, 0.45, 0.18], [0.42, 0.33, 0.19], [0.43, 0.42, 0.37]],
  [[0.35, 0.60, 0.27], [0.46, 0.66, 0.30], [0.55, 0.68, 0.36], [0.55, 0.54, 0.50]],
  [[0.27, 0.32, 0.16], [0.37, 0.40, 0.20], [0.26, 0.21, 0.14], [0.37, 0.35, 0.28]],
  [[0.76, 0.54, 0.35], [0.83, 0.62, 0.41], [0.64, 0.42, 0.25], [0.67, 0.35, 0.21]],
  [[0.55, 0.55, 0.35], [0.66, 0.62, 0.40], [0.52, 0.51, 0.46], [0.58, 0.55, 0.49]],
  [[0.23, 0.16, 0.26], [0.31, 0.22, 0.32], [0.14, 0.10, 0.17], [0.25, 0.21, 0.29]],
  [[0.86, 0.90, 0.95], [0.95, 0.97, 0.99], [0.66, 0.72, 0.74], [0.47, 0.51, 0.57]],
];
const GRASSY = [1, 1, 0.85, 0.9, 0.55, 0.12, 0.7, 0.3, 0], SANDY = [0.7, 0.8, 0.5, 1, 0.1, 0.5, 0.45, 0.15, 0];
const SAND = [0.82, 0.73, 0.53], MUD = [0.30, 0.25, 0.17], SNOW = [0.92, 0.95, 0.98], ICEC = [0.70, 0.86, 0.95], DIRT = [0.63, 0.52, 0.36], DIRTE = [0.43, 0.35, 0.24], BED = [0.45, 0.42, 0.33], DEEP = [0.18, 0.22, 0.22];
const COLG = new Uint8Array(NN * 3), ATG = new Uint8Array(NN * 4);
const _c = [0, 0, 0];
function biomeCol(b, x, z, n1, n2, out){
  const P = PAL[b], A = P[0], B = P[1], C = P[2]; let t = c01(n1 * 0.9 + 0.5);
  out[0] = lerp(A[0], B[0], t); out[1] = lerp(A[1], B[1], t); out[2] = lerp(A[2], B[2], t);
  const p = sst(0.32, 0.62, n2) * (b === 5 ? 0.7 : 0.85); out[0] = lerp(out[0], C[0], p); out[1] = lerp(out[1], C[1], p); out[2] = lerp(out[2], C[2], p);
  if (b === 1 || b === 3 || b === 0 || b === 2){ const q = pn(x * 0.011 + 50, z * 0.011 - 20) + pn(x * 0.03, z * 0.03) * 0.25, g = sst(0.16, 0.42, q) * (b === 2 ? 0.25 : 0.5), l = sst(-0.16, -0.42, q) * 0.45;
    out[0] = lerp(out[0], 0.7, g); out[1] = lerp(out[1], 0.66, g); out[2] = lerp(out[2], 0.33, g); out[0] = lerp(out[0], 0.2, l); out[1] = lerp(out[1], 0.44, l); out[2] = lerp(out[2], 0.17, l);
    // 꽃밭 (멀리서도 보이는 색 얼룩 — 가까이 가면 진짜 꽃이 피어 있어요)
    if (b !== 2){ const fp = sst(0.12, 0.34, pn(x * 0.022 + 5, z * 0.022) * 2.2 + 0.1 - 0.35) * 0.42, ci = (pn(x * 0.006 - 30, z * 0.006 + 12) + 0.7) * 2.2 | 0, FC = FLC[Math.max(0, Math.min(3, ci))];
      out[0] = lerp(out[0], FC[0], fp); out[1] = lerp(out[1], FC[1], fp); out[2] = lerp(out[2], FC[2], fp); } }
}
const FLC = [[0.9, 0.84, 0.36], [0.88, 0.62, 0.72], [0.9, 0.92, 0.84], [0.66, 0.56, 0.84]];
const mixc = (o, c, t) => { o[0] += (c[0] - o[0]) * t; o[1] += (c[1] - o[1]) * t; o[2] += (c[2] - o[2]) * t; };
for (let j = 0; j < N; j++){ const z = -HALF + j * CS;
  for (let i = 0; i < N; i++){ const x = -HALF + i * CS, k = j * N + i, h = HG[k], s = SLP[k];
    const a = RA[k], b = RB[k], t = RT[k] / 255, bA = RBIO[a], bB = RBIO[b];
    const n1 = fbm(x * 0.021 + 3, z * 0.021 - 5, 3), n2 = fbm(x * 0.009 - 13, z * 0.009 + 7, 3) * 0.6 + pn(x * 0.05, z * 0.05) * 0.5;
    biomeCol(bA, x, z, n1, n2, _c); const r0 = _c[0], g0 = _c[1], b0 = _c[2]; biomeCol(bB, x, z, n1, n2, _c);
    const o = [lerp(_c[0], r0, t), lerp(_c[1], g0, t), lerp(_c[2], b0, t)];
    const rkA = PAL[bA][3], rkB = PAL[bB][3], rk = [lerp(rkB[0], rkA[0], t), lerp(rkB[1], rkA[1], t), lerp(rkB[2], rkA[2], t)];
    const cw = (bA === 5 ? t : 0) + (bB === 5 ? 1 - t : 0), sw = (bA === 8 ? t : 0) + (bB === 8 ? 1 - t : 0), blw = (bA === 7 ? t : 0) + (bB === 7 ? 1 - t : 0);
    const grassy = lerp(GRASSY[bB], GRASSY[bA], t), sandy = lerp(SANDY[bB], SANDY[bA], t);
    // 바위 (경사) — 협곡은 조금 완만해도 바위
    let rock = sst(lerp(0.78, 0.42, cw), lerp(1.25, 0.82, cw), s + pn(x * 0.07, z * 0.07) * 0.12);
    // 고도 눈 · 서리 지역 눈
    const sn = Math.max(sst(64, 82, h + n1 * 8) * (1 - cw), sw * sst(0.2, 0.6, sw)) * (1 - rock * 0.75);
    mixc(o, SNOW, sn);
    if (sw > 0.3) mixc(rk, [0.55, 0.6, 0.67], 0.4);
    mixc(o, rk, rock);
    // 물가 · 물속
    const wl = WLV[k], dw = h - wl;
    if (dw < 1.8 && !ICE[k]){
      if (dw < 0){ mixc(o, BED, 0.85); mixc(o, DEEP, sst(0, -5, dw)); }
      else { mixc(o, bA === 4 || bB === 4 ? MUD : SAND, sst(1.8, 0.35, dw + n2 * 0.6) * sandy * (1 - rock)); const wet = sst(0.7, 0, dw); o[0] *= 1 - wet * 0.32; o[1] *= 1 - wet * 0.3; o[2] *= 1 - wet * 0.25; }
    }
    if (ICE[k]) { o[0] = ICEC[0]; o[1] = ICEC[1]; o[2] = ICEC[2]; }
    if (PATHM[k]){ const pc = PATHM[k] === 1 ? [0.72, 0.74, 0.79] : PATHM[k] === 2 ? [0.6, 0.58, 0.52] : [0.72, 0.52, 0.36]; mixc(o, pc, 0.85); const ns = 0.9 + pn(x * 0.5, z * 0.5) * 0.25; o[0] *= ns; o[1] *= ns; o[2] *= ns; rock *= 0.25; }
    // 길 (흙길 + 짙은 가장자리)
    const rd = RDD[k];
    if (rd < 2.2){ const core = sst(0.5, -0.6, rd + n1 * 0.4), edge = sst(2.2, 0.5, rd) * (1 - core); mixc(o, DIRTE, edge * 0.55 * (1 - rock)); mixc(o, DIRT, core * (1 - rock * 0.7)); const ns = 0.9 + pn(x * 0.4, z * 0.4) * 0.2; o[0] *= ns; o[1] *= ns; o[2] *= ns; }
    // 강 물길 근처 자갈
    if (RVD[k] < 14 && dw > 0 && dw < 2.5){ mixc(o, [0.55, 0.53, 0.48], sst(14, 6, RVD[k]) * 0.4 * (1 - rock)); }
    COLG[k * 3] = Math.min(255, o[0] * 255); COLG[k * 3 + 1] = Math.min(255, o[1] * 255); COLG[k * 3 + 2] = Math.min(255, o[2] * 255);
    const snw = Math.max(sw, sst(58, 76, h + n1 * 8) * (1 - cw)); ATG[k * 4] = rock * 255; ATG[k * 4 + 1] = blw * 255; ATG[k * 4 + 2] = cw > 0.02 ? cw * 127 : 128 + snw * 127; ATG[k * 4 + 3] = grassy * (1 - rock) * (1 - sn) * (rd < 0.5 || PATHM[k] ? 0.15 : 1) * 255;
  }
  if (j % 80 === 79) await idle();
}
const TC = performance.now();

// ───────────────────────── 디테일 텍스처 (반복 · 기울기 포함) ─────────────────────────
function detailTex(){
  const S0 = 256, d = new Uint8Array(S0 * S0 * 4), hv = new Float32Array(S0 * S0);
  // 주기적 노이즈 (주기 = 격자 수)
  const per = (u, v, P, s) => { const xi = Math.floor(u), yi = Math.floor(v), xf = u - xi, yf = v - yi, a = hash(((xi % P) + P) % P, ((yi % P) + P) % P, s), b = hash(((xi + 1) % P + P) % P, ((yi % P) + P) % P, s), cc = hash(((xi % P) + P) % P, ((yi + 1) % P + P) % P, s), dd = hash(((xi + 1) % P + P) % P, ((yi + 1) % P + P) % P, s); const uu = xf * xf * (3 - 2 * xf), vv = yf * yf * (3 - 2 * yf); return a + (b - a) * uu + (cc - a) * vv + (a - b - cc + dd) * uu * vv; };
  for (let j = 0; j < S0; j++) for (let i = 0; i < S0; i++){ let h = 0, a = 0.5; for (let o = 0, P = 8; o < 5; o++, P *= 2, a *= 0.5) h += per(i / S0 * P, j / S0 * P, P, o + 3) * a; hv[j * S0 + i] = h; }
  for (let j = 0; j < S0; j++) for (let i = 0; i < S0; i++){
    const k = j * S0 + i, gx = hv[j * S0 + (i + 1) % S0] - hv[j * S0 + (i + S0 - 1) % S0], gz = hv[((j + 1) % S0) * S0 + i] - hv[((j + S0 - 1) % S0) * S0 + i];
    let vein = 0; for (const [P, wgt, sd] of [[5, 1, 41], [11, 0.75, 43], [23, 0.45, 47]]){ const u = i / S0 * P, v = j / S0 * P, ci = Math.floor(u), cj = Math.floor(v); let f1 = 9, f2 = 9;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++){ const qi = ci + a, qj = cj + b, wi = ((qi % P) + P) % P, wj = ((qj % P) + P) % P, fx = qi + 0.15 + 0.7 * hash(wi, wj, sd), fy = qj + 0.15 + 0.7 * hash(wi, wj, sd + 1), dd = Math.hypot(u - fx, v - fy); if (dd < f1){ f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd; }
      vein = Math.max(vein, (1 - sst(0, 0.075, f2 - f1)) * wgt); }
    d[k * 4] = Math.min(255, hv[k] * 255); d[k * 4 + 1] = Math.max(0, Math.min(255, 128 + gx * 900)); d[k * 4 + 2] = Math.max(0, Math.min(255, 128 + gz * 900)); d[k * 4 + 3] = Math.max(0, Math.min(255, vein * 255));
  }
  return dataTex(d, S0);
}
// 알파 채널도 데이터로 쓰니 캔버스(미리 곱한 알파) 대신 DataTexture
function dataTex(d, S0){ const t = new THREE.DataTexture(d, S0, S0, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4; t.needsUpdate = true; return t; }
const DET = detailTex();
const TIMEU = { value: 0 }, DAYU = { value: 1 };

// ───────────────────────── 지형 재질 (월드 좌표 삼면 투영 디테일 + 지층 + 가시 결맥) ─────────────────────────
const TMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 });
TMAT.onBeforeCompile = sh => {
  sh.uniforms.tDet = { value: DET }; sh.uniforms.uTime = TIMEU;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aT; varying vec4 vT; varying vec3 vWP; varying vec3 vWN;')
    .replace('#include <color_vertex>', '#include <color_vertex>\n vColor.rgb = pow(vColor.rgb, vec3(2.2)); vT = aT;')
    .replace('#include <project_vertex>', '#include <project_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
  sh.fragmentShader = (LOW ? '#define TLOW\n' : '') + sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D tDet; uniform float uTime; varying vec4 vT; varying vec3 vWP; varying vec3 vWN;
vec4 dX, dZ, dA, dB; vec3 tBw;`)
    .replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec3 wn = normalize(vWN); tBw = pow(abs(wn), vec3(5.0)); tBw /= (tBw.x + tBw.y + tBw.z);
    dA = texture2D(tDet, vWP.xz * 0.043);
    float macro = texture2D(tDet, vWP.xz * 0.0041 + 0.5).r;
    dX = dA; dZ = dA;
    #ifdef TLOW
    dB = vec4(fract(dA.r * 3.7), 0.5, 0.5, 0.0);
    #else
    dB = texture2D(tDet, vWP.xz * 0.19 + 0.37);
    if (tBw.y < 0.96){ dX = texture2D(tDet, vWP.zy * vec2(0.05, 0.11)); dZ = texture2D(tDet, vWP.xy * vec2(0.05, 0.11)); }
    #endif
    float rock = vT.x, bl = vT.y, grass = vT.w, can = vT.z < 0.5 ? clamp(vT.z * 2.0, 0.0, 1.0) : 0.0, snw = clamp(vT.z * 2.0 - 1.0, 0.0, 1.0);
    float sp = mix(dB.r, dA.r, 0.45);
    diffuseColor.rgb *= mix(0.86 + 0.28 * sp, 0.72 + 0.56 * sp, grass);
    diffuseColor.rgb *= 0.88 + 0.26 * macro;
    // 지층 (바위 · 절벽)
    float sR = dX.r * tBw.x + dZ.r * tBw.z + dA.r * tBw.y;
    float b1 = sin(vWP.y * 1.35 + sR * 6.0) * 0.5 + 0.5, b2 = sin(vWP.y * 0.36 + sR * 2.4 + 1.3) * 0.5 + 0.5;
    float sc = 1.0 - 0.55 * snw;
    vec3 rk = diffuseColor.rgb * (1.0 - sc * 0.26 + sc * 0.36 * b2) * (1.0 - sc * 0.14 + sc * 0.22 * b1) * (0.8 + 0.4 * sR);
    rk = mix(rk, rk * mix(vec3(1.0), vec3(1.22, 0.86, 0.72), b2) * (0.8 + 0.35 * b1), can);
    float ledge = smoothstep(0.38, 0.62, wn.y + (sR - 0.5) * 0.45) * snw;
    rk = mix(rk, vec3(0.74, 0.8, 0.9), ledge);
    diffuseColor.rgb = mix(diffuseColor.rgb, rk, rock);
  }`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    vec2 gT = (dA.gb - 0.5) * 1.5 + (dB.gb - 0.5) * 0.7;
    vec2 gX = (dX.gb - 0.5) * 2.2, gZ = (dZ.gb - 0.5) * 2.2;
    float st = 0.35 + 0.9 * vT.x;
    vec3 bw = tBw.y * vec3(-gT.x, 0.0, -gT.y) + tBw.x * vec3(0.0, -gX.y, -gX.x) + tBw.z * vec3(-gZ.x, -gZ.y, 0.0);
    normal = normalize(normal + (viewMatrix * vec4(bw * st, 0.0)).xyz);
  }`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  {
    float vm = smoothstep(0.46, 0.68, texture2D(tDet, vWP.xz * 0.009 + 0.21).r);
    float vein = smoothstep(0.62, 0.95, dA.a) * vT.y * (1.0 - vT.x * 0.6) * vm;
    vein = max(vein, smoothstep(0.8, 1.0, dB.a) * vT.y * vm * 0.35);
    totalEmissiveRadiance += vec3(0.5, 0.1, 1.0) * vein * (0.5 + 0.35 * sin(uTime * 1.6 + vWP.x * 0.07 + vWP.z * 0.05));
    diffuseColor.rgb *= 1.0 - vein * 0.5;
    float lum = dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1));
    float spk = step(0.996, fract(sin(dot(floor(vWP.xz * 7.0), vec2(12.9898, 78.233))) * 43758.5453));
    totalEmissiveRadiance += vec3(0.9, 0.95, 1.0) * spk * smoothstep(0.6, 0.8, lum) * 0.8;
  }`);
};

// ───────────────────────── 지형 메시 (200m 조각 × 64, 원근 단계 2개 + 치마) ─────────────────────────
const CHM = 200, CHC = Math.round(CHM / CS), CHN = Math.round(HALF * 2 / CHM);   // 80칸, 8×8
const TER = new THREE.Group(); TER.name = 'terrain'; F.FW.add(TER);
const CHUNKS = [];
function chunkIndex(step){
  const n = CHC + 1, I = [];
  for (let j = 0; j < CHC; j += step) for (let i = 0; i < CHC; i += step){ const a = j * n + i, b = a + step, c = a + step * n, d = c + step; I.push(a, c, b, b, c, d); }
  // 치마 (조각 사이 틈 가리기)
  const sk = n * n; const edge = []; for (let i = 0; i <= CHC; i += step) edge.push([i, 0]); for (let j = 0; j <= CHC; j += step) edge.push([CHC, j]); for (let i = CHC; i >= 0; i -= step) edge.push([i, CHC]); for (let j = CHC; j >= 0; j -= step) edge.push([0, j]);
  const sid = (i, j) => sk + (j === 0 ? i : i === CHC ? n + j : j === CHC ? 2 * n + i : 3 * n + j);
  for (let e = 0; e < edge.length - 1; e++){ const [i0, j0] = edge[e], [i1, j1] = edge[e + 1]; if (i0 === i1 && j0 === j1) continue; const a = j0 * n + i0, b = j1 * n + i1, c = sid(i0, j0), d = sid(i1, j1); I.push(a, b, c, b, d, c, a, c, b, b, c, d); }
  return I;
}
const IDX0 = new THREE.Uint16BufferAttribute(chunkIndex(1), 1), IDX1 = new THREE.Uint16BufferAttribute(chunkIndex(2), 1), IDX2 = new THREE.Uint16BufferAttribute(chunkIndex(4), 1);
for (let cj = 0; cj < CHN; cj++) for (let ci = 0; ci < CHN; ci++){
  const n = CHC + 1, nv = n * n + 4 * n, P = new Float32Array(nv * 3), Nm = new Int8Array(nv * 3), C = new Uint8Array(nv * 3), A = new Uint8Array(nv * 4);
  const put = (v, k, dy) => { P[v * 3] = -HALF + (k % N) * CS; P[v * 3 + 1] = HG[k] + dy; P[v * 3 + 2] = -HALF + ((k / N) | 0) * CS; for (let q = 0; q < 3; q++){ Nm[v * 3 + q] = NRM[k * 3 + q]; C[v * 3 + q] = COLG[k * 3 + q]; } for (let q = 0; q < 4; q++) A[v * 4 + q] = ATG[k * 4 + q]; };
  const gk = (i, j) => (cj * CHC + j) * N + ci * CHC + i;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) put(j * n + i, gk(i, j), 0);
  const sk = n * n; for (let i = 0; i < n; i++){ put(sk + i, gk(i, 0), -7); put(sk + n + i, gk(CHC, i), -7); put(sk + 2 * n + i, gk(i, CHC), -7); put(sk + 3 * n + i, gk(0, i), -7); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(Nm, 3, true)); geo.setAttribute('color', new THREE.BufferAttribute(C, 3, true)); geo.setAttribute('aT', new THREE.BufferAttribute(A, 4, true));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  const lods = [IDX0, IDX1, IDX2].map(I => { const g = new THREE.BufferGeometry(); for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]); g.setIndex(I); g.boundingSphere = geo.boundingSphere; return g; });
  const mesh = new THREE.Mesh(lods[0], TMAT); mesh.receiveShadow = true; mesh.castShadow = false; mesh.matrixAutoUpdate = false; TER.add(mesh);
  const bb = geo.boundingBox;
  CHUNKS.push({ mesh, lods, cx: (bb.min.x + bb.max.x) / 2, cz: (bb.min.z + bb.max.z) / 2, lod: 0, ymax: bb.max.y });
  if ((cj * CHN + ci) % 16 === 15) await idle();
}
const TMS = performance.now();
console.log(`[world] heights ${Math.round(TH - TB)}ms · colors ${Math.round(TC - TH)}ms · mesh ${Math.round(TMS - TC)}ms`);

// ───────────────────────── 물 (호수 · 강 · 늪 · 폭포 · 얼음) ─────────────────────────
function waterTex(){
  const S0 = 256, d = new Uint8Array(S0 * S0 * 4), hv = new Float32Array(S0 * S0), fv = new Float32Array(S0 * S0);
  const per = (u, v, P, s) => { const xi = Math.floor(u), yi = Math.floor(v), xf = u - xi, yf = v - yi, m = q => ((q % P) + P) % P, a = hash(m(xi), m(yi), s), b = hash(m(xi + 1), m(yi), s), cc = hash(m(xi), m(yi + 1), s), dd = hash(m(xi + 1), m(yi + 1), s), uu = xf * xf * (3 - 2 * xf), vv = yf * yf * (3 - 2 * yf); return a + (b - a) * uu + (cc - a) * vv + (a - b - cc + dd) * uu * vv; };
  for (let j = 0; j < S0; j++) for (let i = 0; i < S0; i++){ const u = i / S0, v = j / S0; let h = 0, a = 0.5; for (let o = 0, P = 4; o < 5; o++, P *= 2, a *= 0.55) h += (1 - Math.abs(per(u * P, v * P, P, 60 + o) * 2 - 1)) * a; hv[j * S0 + i] = h; let f = 0; a = 0.5; for (let o = 0, P = 8; o < 4; o++, P *= 2, a *= 0.5) f += per(u * P, v * P, P, 80 + o) * a; fv[j * S0 + i] = f; }
  for (let j = 0; j < S0; j++) for (let i = 0; i < S0; i++){ const k = j * S0 + i, gx = hv[j * S0 + (i + 1) % S0] - hv[j * S0 + (i + S0 - 1) % S0], gz = hv[((j + 1) % S0) * S0 + i] - hv[((j + S0 - 1) % S0) * S0 + i];
    d[k * 4] = Math.max(0, Math.min(255, 128 + gx * 600)); d[k * 4 + 1] = Math.max(0, Math.min(255, 128 + gz * 600)); d[k * 4 + 2] = fv[k] * 255; d[k * 4 + 3] = Math.min(255, Math.pow(hv[k], 3) * 255); }
  return dataTex(d, S0);
}
const WTX = waterTex();
const WU = { uTime: TIMEU, tN: { value: WTX }, uSun: { value: G.SUN }, uSunC: { value: new THREE.Color(1, 0.9, 0.75) }, uHor: { value: new THREE.Color(0.55, 0.65, 0.78) }, uZen: { value: new THREE.Color(0.18, 0.34, 0.62) },
  uDeep: { value: new THREE.Color(0x0e3a4c) }, uShal: { value: new THREE.Color(0x3a9ab0) }, uFoam: { value: new THREE.Color(0xf4fbff) }, uLight: { value: 1 } };
const WMAT = new THREE.ShaderMaterial({
  uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), WU), fog: true, transparent: true, depthWrite: false,
  vertexShader: `attribute float aDepth; attribute vec2 aFlow; uniform float uTime; varying vec3 vWP; varying float vDepth; varying vec2 vFlow;
    #include <fog_pars_vertex>
    void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); float dk = clamp(aDepth * 0.5, 0.0, 1.0);
      wp.y += (sin(wp.x * 0.23 + uTime * 1.3) * cos(wp.z * 0.19 + uTime * 1.05) * 0.07 + sin(wp.x * 0.07 - wp.z * 0.05 + uTime * 0.7) * 0.05) * dk;
      vWP = wp.xyz; vDepth = aDepth; vFlow = aFlow; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: `uniform float uTime, uLight; uniform sampler2D tN; uniform vec3 uSun, uSunC, uHor, uZen, uDeep, uShal, uFoam; varying vec3 vWP; varying float vDepth; varying vec2 vFlow;
    #include <common>
    #include <fog_pars_fragment>
    void main(){
      vec2 p = vWP.xz; float fl = length(vFlow);
      float ph0 = fract(uTime * 0.22), ph1 = fract(uTime * 0.22 + 0.5), fw = abs(ph0 * 2.0 - 1.0);
      vec4 fA = texture2D(tN, p * 0.09 - vFlow * ph0 * 1.6), fB = texture2D(tN, p * 0.09 - vFlow * ph1 * 1.6 + 0.5), fF = mix(fA, fB, fw);
      vec4 n1 = texture2D(tN, p * 0.031 + vec2(uTime * 0.011, uTime * 0.007)), n2 = texture2D(tN, p * 0.083 - vec2(uTime * 0.017, -uTime * 0.013));
      vec2 g = (n1.rg - 0.5) * 0.9 + (n2.rg - 0.5) * 0.7; g = mix(g, (fF.rg - 0.5) * 1.6, clamp(fl, 0.0, 1.0));
      vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
      vec3 V = normalize(cameraPosition - vWP); float ndv = max(dot(n, V), 0.0);
      float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
      vec3 R = reflect(-V, n); vec3 sky = mix(uHor, uZen, clamp(R.y * 1.6, 0.0, 1.0));
      float dk = 1.0 - exp(-max(vDepth, 0.0) * 0.42);
      vec3 body = mix(uShal, uDeep, dk) * uLight;
      vec3 col = mix(body, sky, clamp(fres * 1.15, 0.0, 0.9));
      vec3 Hh = normalize(uSun + V); float nh = max(dot(n, Hh), 0.0);
      col += uSunC * (pow(nh, 260.0) * 5.0 + pow(nh, 36.0) * 0.18) * step(0.0, uSun.y);
      float fn = texture2D(tN, p * 0.21 + vec2(uTime * 0.025, -uTime * 0.018)).b;
      float shore = smoothstep(0.42, 0.0, vDepth + (fn - 0.5) * 0.4);
      float lap = smoothstep(0.35, 1.0, 0.5 + 0.5 * sin(uTime * 1.8 - vDepth * 14.0 + fn * 6.0));
      float foam = shore * (0.35 + 0.65 * lap) * 0.8 + fl * smoothstep(0.72, 0.95, fF.a + fn * 0.25) * 0.9 + smoothstep(1.2, 2.2, fl) * (0.4 + 0.5 * fF.b);
      foam = clamp(foam, 0.0, 1.0);
      col = mix(col, uFoam * (0.1 + 0.9 * uLight), foam * 0.8);
      float a = mix(0.5, 0.93, dk) + fres * 0.12; a = max(a, foam * 0.9);
      a *= smoothstep(-0.04, 0.1, vDepth);
      gl_FragColor = vec4(col, a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
});
for (const k in WU) WMAT.uniforms[k] = WU[k];
const WATER = new THREE.Group(); WATER.name = 'water'; F.FW.add(WATER);
function flowAt(k){ const d = RVD[k]; if (d > 12) return [0, 0]; const P = RIVS[RVI[k]], s = RVS[k]; let [, , dx, dz] = pAt(P, s); let m = 1 - sst(P.w / 2, P.w / 2 + 8, d); if (P.pool && Math.hypot(-HALF + (k % N) * CS - P.pool[0], -HALF + ((k / N) | 0) * CS - P.pool[1]) < 10) m = 2.2; return [dx * m, dz * m]; }
const WCH = [];
for (let cj = 0; cj < CHN; cj++) for (let ci = 0; ci < CHN; ci++){
  const map = new Map(), P = [], D = [], FL = [], I = [];
  const vid = (i, j) => { const k = j * N + i; let v = map.get(k); if (v === undefined){ v = P.length / 3; map.set(k, v); P.push(-HALF + i * CS, WL, -HALF + j * CS); D.push(WL - HG[k]); const f = flowAt(k); FL.push(f[0], f[1]); } return v; };
  for (let j = cj * CHC; j < (cj + 1) * CHC; j++) for (let i = ci * CHC; i < (ci + 1) * CHC; i++){
    const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
    if (Math.min(HG[a], HG[b], HG[c], HG[d]) > WL + 0.05) continue;
    if (WLV[a] !== WL || WLV[b] !== WL || WLV[c] !== WL || WLV[d] !== WL || ICE[a] || ICE[d]) continue;
    const va = vid(i, j), vb = vid(i + 1, j), vc = vid(i, j + 1), vd = vid(i + 1, j + 1); I.push(va, vc, vb, vb, vc, vd);
  }
  if (!I.length) continue;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aDepth', new THREE.Float32BufferAttribute(D, 1)); g.setAttribute('aFlow', new THREE.Float32BufferAttribute(FL, 2)); g.setIndex(I); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, WMAT); m.renderOrder = 2; m.matrixAutoUpdate = false; WATER.add(m); WCH.push({ mesh: m, cx: (ci + 0.5) * CHM - HALF, cz: (cj + 0.5) * CHM - HALF });
}
// 윗 은빛 개울 (단층 위 높은 물길)
for (const P of RIVS){ if (P.fallS == null) continue;
  const n = P.upEnd + 1, Pp = [], D = [], FL = [], I = [], cols = 7;
  for (let i = 0; i < n; i++){ const s = i * 2, [x, z, dx, dz] = pAt(P, s), L = P.lv[i], hw = P.w / 2 + 2.5 + (s < 10 ? 3 : 0);
    for (let c = 0; c < cols; c++){ const o = (c / (cols - 1) * 2 - 1) * hw, px = x - dz * o, pz = z + dx * o; Pp.push(px, L, pz); D.push(L - terrainH(px, pz)); FL.push(dx * 1.3, dz * 1.3); }
    if (i) for (let c = 0; c < cols - 1; c++){ const a = (i - 1) * cols + c, b = a + 1, cc = a + cols, d = cc + 1; I.push(a, b, cc, b, d, cc); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3)); g.setAttribute('aDepth', new THREE.Float32BufferAttribute(D, 1)); g.setAttribute('aFlow', new THREE.Float32BufferAttribute(FL, 2)); g.setIndex(I); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, WMAT); m.renderOrder = 2; WATER.add(m); WCH.push({ mesh: m, cx: g.boundingSphere.center.x, cz: g.boundingSphere.center.z, big: g.boundingSphere.radius });
}
// 폭포 재질 (흘러내리는 줄무늬 + 아래 거품)
const FALLMAT = new THREE.ShaderMaterial({
  uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { uTime: TIMEU, uLight: WU.uLight, tN: { value: WTX } }), fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: `varying vec2 vU; varying float vH;
    #include <fog_pars_vertex>
    void main(){ vU = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: `uniform float uTime, uLight; uniform sampler2D tN; varying vec2 vU;
    #include <common>
    #include <fog_pars_fragment>
    void main(){
      float u = vU.x, v = vU.y;
      float s1 = texture2D(tN, vec2(u * 1.7, v * 0.9 + uTime * 0.85)).b, s2 = texture2D(tN, vec2(u * 3.1 + 0.3, v * 1.6 + uTime * 1.45)).a;
      float streak = smoothstep(0.35, 0.8, s1 * 0.8 + s2 * 0.6);
      float edge = smoothstep(0.0, 0.12, u) * smoothstep(1.0, 0.88, u);
      float foamB = smoothstep(0.25, 0.0, v) * (0.6 + 0.4 * s2), lip = smoothstep(0.93, 1.0, v);
      vec3 c = mix(vec3(0.42, 0.66, 0.78), vec3(0.95, 0.98, 1.0), clamp(streak * 0.75 + foamB + lip * 0.5, 0.0, 1.0)) * (0.35 + 0.65 * uLight);
      float a = (0.55 + 0.4 * streak + foamB * 0.4) * edge;
      gl_FragColor = vec4(c, a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
});
for (const k of ['uTime', 'uLight']) FALLMAT.uniforms[k] = k === 'uTime' ? TIMEU : WU.uLight;
const FALLS = [];
function fallSheet(x0, z0, dx, dz, top, bot, w, out = 6, cols = 10, rows = 18){
  const P = [], U = [], I = [], px = -dz, pz = dx;
  // 절벽 면을 따라가요: 그 높이에서 지면보다 조금 바깥
  const face = y => { for (let o = 0; o < 40; o += 0.25) if (terrainH(x0 + dx * o, z0 + dz * o) < y - 0.15) return o + 0.45; return 40; };
  for (let r = 0; r <= rows; r++){ const v = r / rows, y = top - (top - bot) * v, o = Math.max(out * Math.pow(v, 0.55), face(y)), ww = w * (1 + 0.25 * v);
    for (let c = 0; c <= cols; c++){ const u = c / cols, l = (u - 0.5) * ww; P.push(x0 + dx * o + px * l, y, z0 + dz * o + pz * l); U.push(u * w / 4, 1 - v); }
    if (r) for (let c = 0; c < cols; c++){ const a = (r - 1) * (cols + 1) + c, b = a + 1, cc = a + cols + 1, d = cc + 1; I.push(a, cc, b, b, cc, d); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeBoundingSphere(); g.computeVertexNormals();
  // u 를 0~1 로 (가장자리 투명)
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (i % (cols + 1)) / cols); uv.needsUpdate = true;
  const m = new THREE.Mesh(g, FALLMAT); m.renderOrder = 3; WATER.add(m); return m;
}
// 하얀 갈기 폭포
for (const P of RIVS){ if (P.fallS == null) continue;
  const [x0, z0, dx, dz] = pAt(P, P.fallS - 4), top = P.fallTop + 0.05;
  const m = fallSheet(x0, z0, dx, dz, top, WL - 0.3, P.w * 1.05, 6.5, 12, 22);
  FALLS.push({ x: x0 + dx * 6, z: z0 + dz * 6, top, bot: WL, w: P.w, mesh: m, big: true, name: '하얀 갈기 폭포', dx, dz });
}
// 울음바위 절벽: 바위 틈에서 흐르는 가는 물줄기들
{ const wp = byId('lakes', 'weeppool'), bench = byId('plateaus', 'weepbench');
  if (wp && bench){ const ax = bench.c[0] - wp.c[0], az = bench.c[1] - wp.c[1], al = Math.hypot(ax, az), ux = ax / al, uz = az / al;
    for (const off of [-13, -6, 1, 9, 15]){
      const sx = wp.c[0] - uz * off, sz = wp.c[1] + ux * off; let lx = sx, lz = sz, ly = 0;
      for (let s = 0; s < 70; s += 0.5){ const x = sx + ux * s, z = sz + uz * s, h = terrainH(x, z); if (h > bench.h - 2.5){ lx = x - ux * 0.6; lz = z - uz * 0.6; ly = h; break; } }
      if (!ly) continue;
      const m = fallSheet(lx, lz, -ux, -uz, ly - 0.3, WL - 0.2, 1.2 + hash(off + 50, 3) * 1.1, 1.6, 4, 16);
      FALLS.push({ x: lx - ux * 1.5, z: lz - uz * 1.5, top: ly, bot: WL, w: 1.5, mesh: m, dx: -ux, dz: -uz });
    } } }
// 얼음 호수 (반짝이는 얼음판)
{ const ic = G.cnv(512), x = ic.getContext('2d'); x.fillStyle = '#cfe6f2'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26; i++){ x.strokeStyle = `rgba(255,255,255,${0.25 + rng() * 0.5})`; x.lineWidth = 0.6 + rng() * 1.6; x.beginPath(); let px = rng() * 512, py = rng() * 512; x.moveTo(px, py); for (let s = 0; s < 8; s++){ px += (rng() - 0.5) * 90; py += (rng() - 0.5) * 90; x.lineTo(px, py); } x.stroke(); }
  for (let i = 0; i < 400; i++){ x.fillStyle = `rgba(${rng() < 0.5 ? '160,200,225' : '240,250,255'},${rng() * 0.25})`; x.beginPath(); x.ellipse(rng() * 512, rng() * 512, 4 + rng() * 30, 2 + rng() * 10, rng() * 3, 0, TAU); x.fill(); }
  const it = G.tex(ic, true, 1 / 24);
  const imat = G.std({ map: it, color: 0xe6f6ff, roughness: 0.08, metalness: 0.05, envMapIntensity: 1.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const L of W.lakes){ if (!L.frozen) continue; const Pp = [], U = [], I = [], seg = 64;
    Pp.push(L.c[0], L.y + 0.03, L.c[1]); U.push(L.c[0], L.c[1]);
    for (let s = 0; s <= seg; s++){ const a = s / seg * TAU; let r = 1.05; for (let q = 1.05; q > 0.3; q -= 0.02){ const xx = L.c[0] + Math.cos(a) * L.rx * q, zz = L.c[1] + Math.sin(a) * L.rz * q; if (ICE[cellK(xx, zz)]){ r = q; break; } } const xx = L.c[0] + Math.cos(a) * L.rx * r, zz = L.c[1] + Math.sin(a) * L.rz * r; Pp.push(xx, L.y + 0.03, zz); U.push(xx, zz); if (s) I.push(0, s + 1, s); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
    const m = new THREE.Mesh(g, imat); m.receiveShadow = true; WATER.add(m); }
}
await idle();
const TW = performance.now();

// ───────────────────────── 식생 · 바위 (인스턴스 · 거리별 단계) ─────────────────────────
function colored(parts){
  const P = [], Nn = [], C = [], c = new THREE.Color();
  for (const [g0, hex, m] of parts){ const g = g0.index ? g0.toNonIndexed() : g0; if (m) g.applyMatrix4(m); c.setHex(hex); const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++){ P.push(p.getX(i), p.getY(i), p.getZ(i)); Nn.push(n.getX(i), n.getY(i), n.getZ(i)); C.push(c.r, c.g, c.b); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeBoundingSphere(); return g;
}
const TM = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => G.mat(x, y, z, rx, ry, rz, sx, sy, sz);
const cyl = (r0, r1, h, s = 7) => new THREE.CylinderGeometry(r1, r0, h, s), ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d), cone = (r, h, s = 7) => new THREE.ConeGeometry(r, h, s);
const GEO = {
  snowpine: () => colored([[cyl(0.26, 0.17, 2.2), 0x4a3424, TM(0, 1.1, 0)], ...[[1.9, 3.0, 2.4], [1.5, 2.7, 3.9], [1.05, 2.3, 5.3], [0.6, 1.6, 6.5]].flatMap(([r, h, y]) => [[cone(r, h, 8), 0x274235, TM(0, y, 0)], [cone(r * 0.78, h * 0.42, 8), 0xf2f6fb, TM(0, y + h * 0.33, 0)]])]),
  cypress: () => colored([[cyl(0.22, 0.14, 1.4), 0x4a3424, TM(0, 0.7, 0)], [ico(1.05, 1), 0x2c5a2c, TM(0, 3.6, 0, 1, 2.9, 1)], [ico(0.8, 1), 0x356a32, TM(0.2, 5.4, 0.1, 1, 2.2, 1)]]),
  cactus: () => colored([[cyl(0.42, 0.36, 4.2, 9), 0x4f8a3a, TM(0, 2.1, 0)], [new THREE.SphereGeometry(0.36, 9, 5, 0, TAU, 0, Math.PI / 2), 0x5a9a42, TM(0, 4.2, 0)],
    [cyl(0.24, 0.24, 1.3, 7), 0x4f8a3a, TM(0.6, 2.0, 0, 1, 1, 1, 0, 0, Math.PI / 2)], [cyl(0.24, 0.22, 1.6, 7), 0x4f8a3a, TM(1.2, 2.7, 0)], [cyl(0.22, 0.22, 1.0, 7), 0x4f8a3a, TM(-0.5, 2.9, 0, 1, 1, 1, 0, 0, Math.PI / 2)], [cyl(0.2, 0.18, 1.1, 7), 0x4f8a3a, TM(-0.95, 3.4, 0)],
    [ico(0.14, 0), 0xff6a9a, TM(0, 4.4, 0)], [ico(0.11, 0), 0xffd04a, TM(1.2, 3.55, 0)]]),
  deadtree: () => colored([[cyl(0.36, 0.16, 4.2, 6), 0x241a2a, TM(0, 2.1, 0, 1, 1, 1, 0.08, 0, 0.06)], ...[[0.9, 2.9, 0.4, 0.9], [-0.8, 3.3, -0.3, -1.0], [0.3, 3.9, -0.8, 0.6], [-0.4, 2.3, 0.8, -0.7]].flatMap(([a, y, b, t]) => [[cyl(0.1, 0.03, 1.9, 5), 0x2a1e30, TM(a * 0.55, y + 0.5, b * 0.55, 1, 1, 1, b * 0.9, 0, -a * 0.9)], [ico(0.13, 0), 0xb860ff, TM(a * 1.15, y + 1.15, b * 1.15)]])]),
  thorn: () => colored([0, 1, 2, 3, 4, 5].flatMap(i => { const a = i * 1.1 + 0.3, t = 0.35 + (i % 3) * 0.12, h = 2.2 + (i % 4) * 0.7; return [[cone(0.26, h, 5), 0x1c1022, TM(Math.cos(a) * 0.3 + Math.sin(a) * t * h * 0.5, h / 2 * Math.cos(t), Math.sin(a) * 0.3 - Math.cos(a) * t * h * 0.5, 1, 1, 1, -Math.cos(a) * t, 0, -Math.sin(a) * t)], [cone(0.07, 0.4, 4), 0xc070ff, TM(Math.cos(a) * 0.3 + Math.sin(a) * t * h, h * Math.cos(t), Math.sin(a) * 0.3 - Math.cos(a) * t * h, 1, 1, 1, -Math.cos(a) * t, 0, -Math.sin(a) * t)]]; })),
  crystal: () => colored([0, 1, 2, 3, 4].map(i => { const a = i * 1.3, t = i ? 0.45 : 0, s = i ? 0.55 + (i % 2) * 0.25 : 1; return [new THREE.OctahedronGeometry(0.5, 0), 0x9ae8ff, TM(Math.cos(a) * 0.35 * (i ? 1 : 0), 0.9 * s, Math.sin(a) * 0.35 * (i ? 1 : 0), 0.5 * s, 2.0 * s, 0.5 * s, -Math.sin(a) * t, 0, Math.cos(a) * t)]; })),
  crystalP: () => colored([0, 1, 2, 3].map(i => { const a = i * 1.6, t = i ? 0.5 : 0, s = i ? 0.6 : 1; return [new THREE.OctahedronGeometry(0.5, 0), 0xc87aff, TM(Math.cos(a) * 0.3 * (i ? 1 : 0), 0.9 * s, Math.sin(a) * 0.3 * (i ? 1 : 0), 0.5 * s, 2.0 * s, 0.5 * s, -Math.sin(a) * t, 0, Math.cos(a) * t)]; })),
  stump: () => colored([[cyl(0.62, 0.5, 0.7, 10), 0x5a3e28, TM(0, 0.35, 0)], [new THREE.CircleGeometry(0.5, 10), 0xc8a070, TM(0, 0.71, 0, 1, 1, 1, -Math.PI / 2)], ...[0, 1, 2].map(i => [cyl(0.12, 0.05, 0.9, 5), 0x5a3e28, TM(Math.cos(i * 2.1) * 0.55, 0.12, Math.sin(i * 2.1) * 0.55, 1, 1, 1, Math.sin(i * 2.1) * 1.2, 0, -Math.cos(i * 2.1) * 1.2)])]),
  log: () => colored([[cyl(0.38, 0.34, 4.6, 9), 0x5e4230, TM(0, 0.36, 0, 1, 1, 1, 0, 0, Math.PI / 2)], [new THREE.CircleGeometry(0.36, 9), 0xc8a070, TM(2.31, 0.36, 0, 1, 1, 1, 0, Math.PI / 2, 0)], [ico(0.3, 0), 0x4a7a32, TM(0.6, 0.66, 0.05, 1.8, 0.4, 1)], [ico(0.25, 0), 0x5a8a3a, TM(-1.2, 0.62, -0.1, 1.5, 0.4, 1)]]),
  fern: () => colored([0, 1, 2, 3, 4, 5, 6].map(i => { const a = i / 7 * TAU; return [cone(0.18, 1.3, 4), i % 2 ? 0x3e7a2e : 0x4a8a36, TM(Math.cos(a) * 0.42, 0.42, Math.sin(a) * 0.42, 1, 1, 0.3, Math.sin(a) * 1.0, -a, -Math.cos(a) * 1.0)]; })),
  mushroom: () => colored([[0, 0, 0xd8402e], [0.35, 0.2, 0xe8a040], [-0.25, 0.3, 0xd8402e]].flatMap(([x, z, c], i) => [[cyl(0.05, 0.04, 0.3 - i * 0.06, 5), 0xf0e6d0, TM(x, 0.15, z)], [new THREE.SphereGeometry(0.17 - i * 0.03, 8, 5, 0, TAU, 0, Math.PI / 2), c, TM(x, 0.29 - i * 0.06, z, 1, 0.7, 1)], [ico(0.03, 0), 0xffffff, TM(x + 0.06, 0.38 - i * 0.07, z)]])),
  flowerbush: () => colored([[ico(0.85, 1), 0x3f7a30, TM(0, 0.55, 0)], [ico(0.6, 1), 0x4a8a38, TM(0.6, 0.42, 0.2)], ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => [ico(0.1, 0), [0xff8ab8, 0xfff0f4, 0xffd04a][i % 3], TM(Math.cos(i * 0.7) * 0.75, 0.55 + Math.sin(i * 1.9) * 0.4, Math.sin(i * 0.7) * 0.75)])]),
  rockflat: () => colored([[ico(1, 1), 0x8a8780, TM(0, 0.12, 0, 1.6, 0.42, 1.2)], [ico(0.6, 0), 0x7d7a72, TM(0.9, 0.18, 0.5, 1, 0.5, 1)]]),
  lily: () => colored([[new THREE.CircleGeometry(0.42, 9, 0.35, TAU - 0.7), 0x3f7a30, TM(0, 0, 0, 1, 1, 1, -Math.PI / 2)], [new THREE.CircleGeometry(0.3, 8, 0.3, TAU - 0.6), 0x4a8a36, TM(0.7, 0.01, 0.3, 1, 1, 1, -Math.PI / 2, 0.8)], [ico(0.11, 0), 0xffb0cc, TM(0.05, 0.08, 0.05, 1, 0.6, 1)], [ico(0.05, 0), 0xffe070, TM(0.05, 0.13, 0.05)]]),
  // 멀리 보이는 단순한 모양
  pineLo: () => colored([[cyl(0.3, 0.2, 2, 4), 0x4a3424, TM(0, 1, 0)], [cone(1.9, 5.4, 6), 0x2b4a2a, TM(0, 4.3, 0)]]),
  snowLo: () => colored([[cyl(0.3, 0.2, 2, 4), 0x4a3424, TM(0, 1, 0)], [cone(1.9, 5.4, 6), 0x274235, TM(0, 4.3, 0)], [cone(1.2, 2.2, 6), 0xf2f6fb, TM(0, 5.8, 0)]]),
  blobLo: () => colored([[cyl(0.38, 0.26, 2.6, 4), 0x5a3e28, TM(0, 1.3, 0)], [ico(2.3, 0), 0x3f7a30, TM(0, 4.1, 0, 1, 0.85, 1)]]),
  willowLo: () => colored([[cyl(0.42, 0.3, 2.8, 4), 0x5a3e28, TM(0, 1.4, 0)], [ico(2.2, 0), 0x6a9a48, TM(0, 3.6, 0, 1, 0.9, 1)]]),
  tintLo: () => colored([[cyl(0.32, 0.22, 2.4, 4), 0x6a4a30, TM(0, 1.2, 0)], [ico(2.1, 0), 0xffffff, TM(0, 3.9, 0, 1, 0.85, 1)]]),
  birchLo: () => colored([[cyl(0.2, 0.13, 4, 4), 0xeeeae0, TM(0, 2, 0)], [ico(1.25, 0), 0x8ac050, TM(0, 4.3, 0, 1, 1.1, 1)]]),
  cypLo: () => colored([[cyl(0.22, 0.14, 1.4, 4), 0x4a3424, TM(0, 0.7, 0)], [ico(1.05, 0), 0x2c5a2c, TM(0, 3.9, 0, 1, 3.2, 1)]]),
  bareLo: () => colored([[cyl(0.3, 0.12, 3.6, 4), 0x4a3a2e, TM(0, 1.8, 0)], [cyl(0.07, 0.04, 1.6, 3), 0x4a3a2e, TM(0.4, 2.8, 0, 1, 1, 1, 0, 0, -0.8)], [cyl(0.07, 0.04, 1.6, 3), 0x4a3a2e, TM(-0.35, 3.1, 0.2, 1, 1, 1, 0.4, 0, 0.8)]]),
  deadLo: () => colored([[cyl(0.36, 0.14, 4.2, 4), 0x241a2a, TM(0, 2.1, 0)], [cyl(0.08, 0.03, 1.8, 3), 0x241a2a, TM(0.5, 3.3, 0, 1, 1, 1, 0, 0, -0.9)], [cyl(0.08, 0.03, 1.8, 3), 0x241a2a, TM(-0.45, 3.6, 0.2, 1, 1, 1, 0.5, 0, 0.9)]]),
  shroomLo: () => colored([[cyl(0.5, 0.35, 3.2, 5), 0xf4ead8, TM(0, 1.6, 0)], [cone(2.0, 1.4, 7), 0xffffff, TM(0, 3.6, 0)]]),
  cactusLo: () => colored([[cyl(0.4, 0.36, 4.2, 5), 0x4f8a3a, TM(0, 2.1, 0)], [cyl(0.22, 0.2, 1.6, 4), 0x4f8a3a, TM(1.0, 2.7, 0)]]),
};
const geoOf = k => GEO[k] ? GEO[k]() : X.treeGeo(k);
const VEGMAT = G.std({ vertexColors: true, flatShading: true, roughness: 0.86, side: THREE.DoubleSide });
VEGMAT.onBeforeCompile = sh => { sh.uniforms.uTime = TIMEU; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
  #ifdef USE_INSTANCING
  { vec4 ip = instanceMatrix[3]; float hh = max(0.0, transformed.y - 1.3); float w = sin(uTime * 1.5 + ip.x * 0.17 + ip.z * 0.13) * 0.6 + sin(uTime * 2.6 + ip.x * 0.31 - ip.z * 0.2) * 0.3;
    transformed.x += w * hh * hh * 0.012; transformed.z += w * hh * hh * 0.008; }
  #endif`); };
const GLOWMAT = G.std({ vertexColors: true, flatShading: true, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 });
GLOWMAT.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 1.1;'); };
GLOWMAT.userData.noCast = true;

// 종류: lo = 먼 단계, tr = 줄기 충돌 반지름, sh = 그림자, R = 보이는 거리 (가까움/멂), dot = 아주 먼 점 색
const NEAR = LOW ? 55 : 80, FAR = LOW ? 150 : 240, SMALL = LOW ? 55 : 95, DOTR = LOW ? 0 : 900;
const VT = {
  pine: { lo: 'pineLo', tr: 0.3, dot: [0x2b4a2a, 1.9, 7.3, 1] }, snowpine: { lo: 'snowLo', tr: 0.3, dot: [0xc8d4dc, 1.9, 7.3, 1] }, oak: { lo: 'blobLo', tr: 0.4, dot: [0x3f7a30, 2.4, 5.6, 0] },
  birch: { lo: 'birchLo', tr: 0.22, dot: [0x8ac050, 1.3, 5.4, 0] }, willow: { lo: 'willowLo', tr: 0.45, dot: [0x6a9a48, 2.2, 5.4, 0] }, tint: { lo: 'tintLo', tr: 0.34, dot: [null, 2.1, 5.4, 0] },
  cypress: { lo: 'cypLo', tr: 0.24, dot: [0x2c5a2c, 1.0, 7, 1] }, bare: { lo: 'bareLo', tr: 0.3 }, deadtree: { lo: 'deadLo', tr: 0.36 }, shroomT: { lo: 'shroomLo', tr: 0.5, dot: [null, 2.0, 4, 0] }, cactus: { lo: 'cactusLo', tr: 0.45 },
  redrock: { lo: 'self', tr: 1.25, big: 1 }, boulder: { lo: 'self', tr: 1.0, big: 1 }, icerock: { geo: 'boulder', lo: 'self', tr: 1.0, big: 1 }, thorn: { lo: 'self', tr: 0.55 }, crystal: { lo: 'self', tr: 0.5, glow: 1 }, crystalP: { lo: 'self', tr: 0.45, glow: 1 },
  rockflat: { tr: 1.1, small: 1 }, stump: { tr: 0.6, small: 1 }, log: { small: 1, log: 1 }, bush: { small: 1, nosh: 1 }, berry: { small: 1, nosh: 1 }, flowerbush: { small: 1, nosh: 1 }, fern: { small: 1, nosh: 1 },
  mushroom: { small: 1, nosh: 1 }, bramble: { small: 1, nosh: 1 }, reed: { small: 1, nosh: 1 }, sunflower: { small: 1, nosh: 1 }, lily: { small: 1, nosh: 1, flat: 1 },
};
for (const k in VT) Object.assign(VT[k], { key: k, n: 0, cap: 2048, D: new Float32Array(2048 * 8), bk: new Map() });
function addVeg(k, x, z, s, rot, col, sy = 1, y){
  const T = VT[k]; if (T.n >= T.cap){ const D = new Float32Array(T.cap * 2 * 8); D.set(T.D); T.D = D; T.cap *= 2; }
  const o = T.n * 8, c = new THREE.Color(col ?? 0xffffff);
  T.D[o] = x; T.D[o + 1] = y ?? terrainH(x, z) - 0.12 * s; T.D[o + 2] = z; T.D[o + 3] = rot; T.D[o + 4] = s; T.D[o + 5] = sy; T.D[o + 6] = c.r; T.D[o + 7] = (Math.round(c.g * 255) << 8) | Math.round(c.b * 255);
  const bk = Math.floor((x + HALF) / 50) * 64 + Math.floor((z + HALF) / 50); let L = T.bk.get(bk); if (!L) T.bk.set(bk, L = []); L.push(T.n);
  if (T.tr) F.circle(x, z, T.tr * s + 0.12); else if (T.log) F.box(x, z, 2.2 * s, 0.4 * s, rot);
  T.n++;
}
// 바이옴별 식생 표: t = 나무 밀도(7m 칸당), s = 작은 것 밀도(5m 칸당)
const FLORA = [
  { t: 0.03, tm: [['oak', 3], ['cypress', 2], ['tint', 1.2]], s: 0.08, sm: [['flowerbush', 3], ['bush', 2], ['stump', 0.6]] },
  { t: 0.14, tm: [['oak', 5], ['birch', 2], ['cypress', 1.3], ['tint', 1.2]], s: 0.48, sm: [['bush', 3], ['flowerbush', 2.6], ['berry', 1], ['boulder', 1.3], ['sunflower', 1.1], ['rockflat', 1], ['stump', 0.4]] },
  { t: 0.74, tm: [['pine', 5], ['oak', 3], ['birch', 1.6], ['tint', 0.8], ['shroomT', 0.12]], s: 0.42, sm: [['fern', 4], ['bush', 2.4], ['mushroom', 1.6], ['boulder', 1.1], ['log', 0.7], ['stump', 0.8], ['berry', 0.8]] },
  { t: 0.11, tm: [['willow', 3], ['birch', 2], ['oak', 1.4], ['tint', 0.5]], s: 0.32, sm: [['bush', 2], ['flowerbush', 1.6], ['boulder', 1], ['rockflat', 1.2]] },
  { t: 0.26, tm: [['willow', 3], ['bare', 3], ['shroomT', 0.5]], s: 0.42, sm: [['mushroom', 2], ['log', 1.2], ['bramble', 0.9], ['stump', 1.1], ['fern', 1.2], ['bush', 0.8]] },
  { t: 0.06, tm: [['cactus', 3], ['redrock', 3], ['bare', 0.7]], s: 0.23, sm: [['redrock', 1.4], ['boulder', 2], ['rockflat', 1.6], ['bush', 0.5]] },
  { t: 0.105, tm: [['pine', 2.4], ['cypress', 1], ['bare', 0.8], ['oak', 0.6]], s: 0.38, sm: [['boulder', 3], ['rockflat', 2.2], ['bush', 1.6], ['flowerbush', 0.6], ['stump', 0.3]] },
  { t: 0.13, tm: [['deadtree', 4], ['bare', 1.4]], s: 0.4, sm: [['thorn', 3], ['bramble', 3], ['crystalP', 0.5], ['boulder', 0.6]] },
  { t: 0.14, tm: [['snowpine', 6], ['bare', 0.3]], s: 0.22, sm: [['icerock', 3], ['crystal', 0.6], ['rockflat', 1]] },
];
const pickW = (mix, r) => { let tot = 0; for (const m of mix) tot += m[1]; r *= tot; for (const m of mix){ r -= m[1]; if (r <= 0) return m[0]; } return mix[mix.length - 1][0]; };
const TINTS = { 1: [0xffb8d0, 0xfff0f4, 0xffc8e0], 2: [0xe8803a, 0xd04a2a, 0xe8c040, 0xf0a040], 3: [0xffd8e8, 0xfff4b0], 0: [0xffb8d0, 0xfff0f4] };
const RAMPS = W.ramps, LIFTS = W.lifts, SPIR = W.spirals;
const UPDRAFTS = [{ x: -168, z: 452, r: 9, top: 52, name: '바람개비 언덕' }];
{ const e = byId('mesas', 'eagle'); if (e) UPDRAFTS.push({ x: e.c[0] - e.r - 11, z: e.c[1] + 6, r: 10, top: e.h + 36, name: '독수리 둥지 바위' }); }
for (const u of UPDRAFTS){ u.y = terrainH(u.x, u.z); u.top = Math.max(u.top, u.y + 30); }
F.updrafts = UPDRAFTS;
function blocked(x, z, pad){
  for (const t of TOWNS) if ((x - t.c[0]) ** 2 + (z - t.c[1]) ** 2 < (t.r * 0.86 + pad) ** 2) return true;
  for (const l of LMS){ const r = l.r * (l.type === 'village' ? 0.72 : l.type === 'mesa_mark' ? 0.3 : 0.62) + pad; if ((x - l.c[0]) ** 2 + (z - l.c[1]) ** 2 < r * r) return true; }
  for (const w of WPS) if ((x - w.c[0]) ** 2 + (z - w.c[1]) ** 2 < (9 + pad) ** 2) return true;
  for (const n of W.npcs) if ((x - n.c[0]) ** 2 + (z - n.c[1]) ** 2 < (5 + pad) ** 2) return true;
  for (const f of W.fishing) if ((x - f.c[0]) ** 2 + (z - f.c[1]) ** 2 < (6 + pad) ** 2) return true;
  for (const s of W.signposts) if ((x - s.c[0]) ** 2 + (z - s.c[1]) ** 2 < (3 + pad) ** 2) return true;
  for (const u of UPDRAFTS) if ((x - u.x) ** 2 + (z - u.z) ** 2 < (u.r + 3 + pad) ** 2) return true;
  for (const l of LIFTS) if ((x - l.from[0]) ** 2 + (z - l.from[1]) ** 2 < (7 + pad) ** 2) return true;
  for (const b of BRIDGES) if ((x - b.c[0]) ** 2 + (z - b.c[1]) ** 2 < (b.len / 2 + 4 + pad) ** 2) return true;
  for (const r of RAMPS){ const px = x - r.from[0], pz = z - r.from[1], t = (px * r.u[0] + pz * r.u[1]) / r.L, lat = Math.abs(-px * r.u[1] + pz * r.u[0]); if (t > -0.15 && t < 1.15 && lat < r.w / 2 + 4 + pad) return true; }
  for (const sp of SPIR){ const d = Math.hypot(x - sp.c[0], z - sp.c[1]); if (d < sp.r0 + 6) return true; }
  return false;
}
function campK(x, z){ for (const c of CAMPS){ const d2 = (x - c.c[0]) ** 2 + (z - c.c[1]) ** 2; if (d2 < (c.r * 0.7) ** 2) return 0.15; } return 1; }
// 나무 (7m 칸)
{ const TCs = 7, n = Math.floor(HALF * 2 / TCs);
  for (let j = 0; j < n; j++){ for (let i = 0; i < n; i++){
    const r0 = hash(i, j, 1); const x = -HALF + (i + 0.15 + 0.7 * hash(i, j, 2)) * TCs, z = -HALF + (j + 0.15 + 0.7 * hash(i, j, 3)) * TCs;
    const k = cellK(x, z); if (RDD[k] < 3.5 || SLP[k] > 0.62 || ICE[k]) continue;
    const h = HG[k]; if (h < WLV[k] + 0.35) continue;
    const bi = RT[k] >= 128 ? RA[k] : RB[k], b = RBIO[bi], FL = FLORA[b];
    const g = fbm(x * 0.0072 + 100, z * 0.0072, 3);
    let dens = FL.t * (b === 2 ? c01(0.62 + g * 1.25) : b === 4 ? c01(0.5 + g) : c01((g - 0.02) * 2.6) * 2.4 + 0.1);
    dens *= campK(x, z); if (RDD[k] < 9) dens *= 0.35;
    const e = Math.max(Math.abs(x), Math.abs(z)); if (e > 700){ if (b !== 8 && b !== 2) continue; dens *= 0.7; }
    if (h > 95) continue;
    if (r0 > dens) continue;
    if (blocked(x, z, 2)) continue;
    const tn = pn(x * 0.013 + 7, z * 0.013 - 2);
    let type = pickW(FL.tm, c01(hash(i, j, 4) * 0.75 + (tn + 0.6) * 0.3));
    if (b === 8 && h < 50 && hash(i, j, 9) < 0.3) type = 'pine';
    const s = (b === 2 ? 1.05 : 0.95) * (0.8 + hash(i, j, 5) * 0.75) * (type === 'redrock' ? 1.3 : 1);
    const T0 = TINTS[b] || TINTS[1], col = type === 'tint' ? T0[(hash(i, j, 6) * T0.length) | 0] : type === 'shroomT' ? [0xff6a5a, 0xffa040, 0x9a7aff, 0x5ad0c0][(hash(i, j, 6) * 4) | 0] : b === 7 && type === 'bare' ? 0x6a5a7a : null;
    addVeg(type, x, z, s, hash(i, j, 7) * TAU, col, type === 'cypress' ? 0.85 + hash(i, j, 8) * 0.4 : 1);
  } if (j % 40 === 39) await idle(); } }
// 작은 것 · 바위 · 갈대 · 연잎 (5m 칸)
{ const SCs = 5, n = Math.floor(HALF * 2 / SCs);
  for (let j = 0; j < n; j++){ for (let i = 0; i < n; i++){
    const x = -HALF + (i + 0.1 + 0.8 * hash(i, j, 12)) * SCs, z = -HALF + (j + 0.1 + 0.8 * hash(i, j, 13)) * SCs, k = cellK(x, z), h = HG[k], wl = WLV[k], dw = h - wl;
    const bi = RT[k] >= 128 ? RA[k] : RB[k], b = RBIO[bi], r0 = hash(i, j, 11);
    if (ICE[k]) continue;
    // 물가 갈대 · 연잎
    if (dw < 0.5 && dw > -0.9 && b !== 5 && b !== 7 && b !== 8 && RDD[k] > 2){ if (r0 < (b === 4 ? 0.55 : 0.35) && !blocked(x, z, -2)) addVeg('reed', x, z, 0.9 + hash(i, j, 14) * 0.6, hash(i, j, 15) * TAU, null, 1, h - 0.05); continue; }
    if (dw < -0.35 && dw > -1.8 && (b === 3 || b === 4 || b === 0) && RVD[k] > 10){ if (r0 < 0.16) addVeg('lily', x, z, 0.8 + hash(i, j, 16) * 0.7, hash(i, j, 17) * TAU, null, 1, wl + 0.03); continue; }
    if (dw < 0.3 || RDD[k] < 1.2 || h > 110) continue;
    const FL = FLORA[b], sl = SLP[k];
    let dens = FL.s * campK(x, z) * (RDD[k] < 6 ? 0.5 : 1);
    if (r0 > dens) continue;
    let type = pickW(FL.sm, hash(i, j, 18));
    const rocky = type === 'boulder' || type === 'icerock' || type === 'redrock' || type === 'rockflat';
    if (sl > (rocky ? 1.1 : 0.55)) continue;
    if (blocked(x, z, rocky ? 1 : 0)) continue;
    const s = (rocky ? 0.7 + hash(i, j, 19) * 1.1 : 0.75 + hash(i, j, 19) * 0.6) * (type === 'redrock' ? 0.9 : 1);
    const rt = b === 5 ? 0xd8a080 : b === 7 ? 0x8a7a9a : b === 8 ? 0xd8eaff : b === 6 ? 0xd8d0b8 : null;
    addVeg(type, x, z, s, hash(i, j, 20) * TAU, type === 'icerock' ? 0xd8eaff : type === 'boulder' || type === 'rockflat' ? rt : null, 1);
  } if (j % 60 === 59) await idle(); } }
// 절벽 아래 굴러떨어진 바위 (절벽이 이어지는 곳에 너덜)
{ const n = Math.floor(HALF * 2 / 9);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++){ const x = -HALF + (i + hash(i, j, 31)) * 9, z = -HALF + (j + hash(i, j, 32)) * 9, k = cellK(x, z);
    if (SLP[k] > 0.5 || HG[k] < WLV[k] + 0.3 || RDD[k] < 3) continue;
    const s2 = SLP[cellK(x + 4, z)] + SLP[cellK(x - 4, z)] + SLP[cellK(x, z + 4)] + SLP[cellK(x, z - 4)]; if (s2 < 3.2 || hash(i, j, 33) > 0.55) continue;
    if (blocked(x, z, 0)) continue; const b = RBIO[RT[k] >= 128 ? RA[k] : RB[k]];
    addVeg(b === 5 ? 'redrock' : b === 8 ? 'icerock' : 'boulder', x, z, 0.6 + hash(i, j, 34) * 1.2, hash(i, j, 35) * TAU, b === 8 ? 0xd8eaff : b === 7 ? 0x8a7a9a : null); } }
const TV = performance.now();
// 인스턴스 메시
const VEG = new THREE.Group(); VEG.name = 'veg'; F.FW.add(VEG);
const mkIM = (geo, mat, cap, sh) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.count = 0; m.frustumCulled = false; m.castShadow = sh; m.receiveShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage); VEG.add(m); return m; };
for (const k in VT){ const T = VT[k]; if (!T.n) continue; const geo = geoOf(T.geo || k), mat = T.glow ? GLOWMAT : VEGMAT;
  T.near = mkIM(geo, mat, Math.min(T.n, T.small ? 2400 : 3200), !T.nosh && !T.glow);
  if (T.lo) T.far = mkIM(T.lo === 'self' ? geo : geoOf(T.lo), mat, Math.min(T.n, 6000), false);
  T.near.name = 'veg_' + k; }
// 아주 먼 나무: 점 두 개 (뾰족 · 둥근)
const DOTS = DOTR ? [new THREE.ConeGeometry(1, 2, 5).translate(0, 1, 0), new THREE.IcosahedronGeometry(1, 0).translate(0, 1, 0)].map(g => mkIM(g, G.std({ flatShading: true, roughness: 0.9 }), 14000, false)) : null;
function wm(a, o, x, y, z, rot, s, sy){ const c = Math.cos(rot) * s, sn = Math.sin(rot) * s; a[o] = c; a[o + 1] = 0; a[o + 2] = -sn; a[o + 3] = 0; a[o + 4] = 0; a[o + 5] = s * sy; a[o + 6] = 0; a[o + 7] = 0; a[o + 8] = sn; a[o + 9] = 0; a[o + 10] = c; a[o + 11] = 0; a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1; }
const _dc = new THREE.Color();
function refreshVeg(px, pz){
  const n2 = NEAR * NEAR, f2 = FAR * FAR, s2 = SMALL * SMALL, d2m = DOTR * DOTR;
  let dn0 = 0, dn1 = 0;
  for (const k in VT){ const T = VT[k]; if (!T.near) continue;
    const R = T.small ? SMALL : DOTR && T.dot ? DOTR : FAR, cr = Math.ceil(R / 50), bx = Math.floor((px + HALF) / 50), bz = Math.floor((pz + HALF) / 50);
    let nn = 0, nf = 0; const NA = T.near.instanceMatrix.array, NC = T.near.instanceColor.array, FA = T.far && T.far.instanceMatrix.array, FC = T.far && T.far.instanceColor.array, capN = T.near.instanceMatrix.count, capF = T.far ? T.far.instanceMatrix.count : 0;
    for (let a = bx - cr; a <= bx + cr; a++) for (let b = bz - cr; b <= bz + cr; b++){ const L = T.bk.get(a * 64 + b); if (!L) continue;
      for (const i of L){ const o = i * 8, D = T.D, dx = D[o] - px, dz = D[o + 2] - pz, d2 = dx * dx + dz * dz;
        const r = D[o + 6], g = ((D[o + 7] >> 8) & 255) / 255, bb = (D[o + 7] & 255) / 255;
        if (d2 < (T.small ? s2 : n2)){ if (nn < capN){ wm(NA, nn * 16, D[o], D[o + 1], D[o + 2], D[o + 3], D[o + 4], D[o + 5]); NC[nn * 3] = r; NC[nn * 3 + 1] = g; NC[nn * 3 + 2] = bb; nn++; } }
        else if (T.far && d2 < f2){ if (nf < capF){ wm(FA, nf * 16, D[o], D[o + 1], D[o + 2], D[o + 3], D[o + 4], D[o + 5]); FC[nf * 3] = r; FC[nf * 3 + 1] = g; FC[nf * 3 + 2] = bb; nf++; } }
        else if (DOTS && T.dot && d2 < d2m){ const dt = T.dot, M = DOTS[dt[3] ? 0 : 1], cnt = dt[3] ? dn0 : dn1; if (cnt < 14000){ const s = D[o + 4], A = M.instanceMatrix.array, o2 = cnt * 16; A[o2] = dt[1] * s; A[o2 + 1] = 0; A[o2 + 2] = 0; A[o2 + 3] = 0; A[o2 + 4] = 0; A[o2 + 5] = dt[2] * s * 0.5; A[o2 + 6] = 0; A[o2 + 7] = 0; A[o2 + 8] = 0; A[o2 + 9] = 0; A[o2 + 10] = dt[1] * s; A[o2 + 11] = 0; A[o2 + 12] = D[o]; A[o2 + 13] = D[o + 1] + (dt[3] ? 1.5 : 2.2) * s; A[o2 + 14] = D[o + 2]; A[o2 + 15] = 1;
          if (dt[0] != null) _dc.setHex(dt[0]); else _dc.setRGB(r * 0.5, g * 0.5, bb * 0.5); M.instanceColor.array[cnt * 3] = _dc.r * 0.8; M.instanceColor.array[cnt * 3 + 1] = _dc.g * 0.8; M.instanceColor.array[cnt * 3 + 2] = _dc.b * 0.8; if (dt[3]) dn0++; else dn1++; } }
      } }
    T.near.count = nn; T.near.instanceMatrix.needsUpdate = true; T.near.instanceColor.needsUpdate = true;
    if (T.far){ T.far.count = nf; T.far.instanceMatrix.needsUpdate = true; T.far.instanceColor.needsUpdate = true; }
  }
  if (DOTS){ DOTS[0].count = dn0; DOTS[1].count = dn1; for (const M of DOTS){ M.instanceMatrix.needsUpdate = true; M.instanceColor.needsUpdate = true; } }
}

// ───────────────────────── 풀 · 꽃 (플레이어 주변 고리, 걸음마다 갱신) ─────────────────────────
const GR = LOW ? 24 : 36, GCAP = LOW ? 1400 : 3600, FCAP = LOW ? 260 : 800;
const GRUNI = { uP: { value: new V3() }, uR: { value: GR } };
function bladeGeo(){
  const P = [], Nn = [], A = [];
  for (let b = 0; b < 10; b++){ const a = b / 10 * TAU + hash(b, 1, 70) * 0.8, r = 0.04 + hash(b, 2, 70) * 0.2, h = 0.34 + hash(b, 3, 70) * 0.4, lean = 0.1 + hash(b, 4, 70) * 0.2, cx = Math.cos(a) * r, cz = Math.sin(a) * r, px = -Math.sin(a) * 0.07, pz = Math.cos(a) * 0.07;
    P.push(cx - px, 0, cz - pz, cx + px, 0, cz + pz, cx + Math.cos(a) * lean, h, cz + Math.sin(a) * lean); A.push(0, 0, 1); for (let q = 0; q < 3; q++) Nn.push(0, 1, 0); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3)); g.setAttribute('aH', new THREE.Float32BufferAttribute(A, 1)); return g;
}
function flowerGeo(){
  const g = colored([[cyl(0.015, 0.012, 0.42, 3), 0x5a9a3a, TM(0, 0.21, 0)], ...[0, 1, 2, 3, 4].map(i => [new THREE.CircleGeometry(0.06, 5), 0xffffff, TM(Math.cos(i * 1.257) * 0.06, 0.43, Math.sin(i * 1.257) * 0.06, 1, 1, 1, -Math.PI / 2 + 0.3, 0, 0)]), [ico(0.035, 0), 0xffe070, TM(0, 0.45, 0)]]);
  const n = g.attributes.position.count, A = new Float32Array(n); for (let i = 0; i < n; i++) A[i] = Math.min(1, g.attributes.position.getY(i) / 0.43); g.setAttribute('aH', new THREE.BufferAttribute(A, 1)); return g;
}
const grassMat = (vc) => { const m = G.std({ roughness: 0.92, side: THREE.DoubleSide, vertexColors: vc }); m.onBeforeCompile = sh => {
  sh.uniforms.uTime = TIMEU; sh.uniforms.uP = GRUNI.uP; sh.uniforms.uR = GRUNI.uR;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uR; uniform vec3 uP; attribute float aH; varying float vH;').replace('#include <begin_vertex>', `#include <begin_vertex>
    vH = aH;
    #ifdef USE_INSTANCING
    { vec4 ip = instanceMatrix[3]; float dd = distance(ip.xz, uP.xz); transformed *= 1.0 - smoothstep(uR * 0.6, uR, dd);
      float w = sin(uTime * 2.1 + ip.x * 0.35 + ip.z * 0.27) * 0.6 + sin(uTime * 3.7 + ip.x * 0.8 + ip.z * 0.5) * 0.25;
      transformed.x += w * aH * aH * 0.13; transformed.z += w * aH * aH * 0.09;
      float pl = length(ip.xz - uP.xz); transformed.y *= 1.0 - (1.0 - smoothstep(0.3, 1.3, pl)) * 0.55; }
    #endif`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH;').replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.5, 1.22, vH);'); }; m.userData.noCast = true; return m; };
const GRASS = new THREE.InstancedMesh(bladeGeo(), grassMat(false), GCAP), FLOW = new THREE.InstancedMesh(flowerGeo(), grassMat(true), FCAP);
for (const m of [GRASS, FLOW]){ m.count = 0; m.frustumCulled = false; m.receiveShadow = true; m.castShadow = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.instanceMatrix.count * 3), 3); VEG.add(m); }
const GSC = [0.7, 1.05, 0.9, 1.0, 1.35, 0.75, 0.9, 0.85, 0.5], GDN = [2.2, 3.4, 2.0, 2.8, 2.6, 0.6, 2.2, 1.6, 0.3];
const FCH = [0.12, 0.3, 0.05, 0.18, 0.03, 0.02, 0.1, 0, 0], FPAL = { 1: [0xffffff, 0xffe04a, 0xff7aa8, 0xb48aff, 0xff5a4a, 0x7ab8ff], 0: [0xffffff, 0xffe04a, 0xff9ac0], 2: [0x8aa8ff, 0xffffff, 0xd0b0ff], 3: [0xffffff, 0xffb0d0, 0x8ad0ff], 6: [0xffd04a, 0xffffff], 4: [0xffe080], 5: [0xff7a4a] };
let gcx = 1e9, gcz = 1e9;
function refreshGrass(px, pz){
  gcx = px; gcz = pz; let ng = 0, nf = 0; const GA = GRASS.instanceMatrix.array, GC = GRASS.instanceColor.array, FA = FLOW.instanceMatrix.array, FCc = FLOW.instanceColor.array;
  const i0 = Math.max(0, Math.floor((px - GR + HALF) / CS)), i1 = Math.min(N - 2, Math.ceil((px + GR + HALF) / CS)), j0 = Math.max(0, Math.floor((pz - GR + HALF) / CS)), j1 = Math.min(N - 2, Math.ceil((pz + GR + HALF) / CS));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){
    const k = j * N + i, gr = ATG[k * 4 + 3] / 255; if (gr < 0.08) continue;
    const x0 = -HALF + i * CS, z0 = -HALF + j * CS; if ((x0 - px) ** 2 + (z0 - pz) ** 2 > GR * GR) continue;
    if (HG[k] < WLV[k] + 0.15 || RDD[k] < 0.1 || ICE[k]) continue;
    const b = RBIO[RT[k] >= 128 ? RA[k] : RB[k]], cnt = gr * GDN[b] * (LOW ? 0.55 : 1), n = Math.floor(cnt + hash(i, j, 40));
    const cr = COLG[k * 3] / 255, cg = COLG[k * 3 + 1] / 255, cb = COLG[k * 3 + 2] / 255;
    for (let t = 0; t < n && ng < GCAP; t++){ const x = x0 + hash(i, j, 41 + t) * CS, z = z0 + hash(i, j, 51 + t) * CS, s = GSC[b] * (0.7 + hash(i, j, 61 + t) * 0.7), v = 0.9 + hash(i, j, 71 + t) * 0.35;
      wm(GA, ng * 16, x, terrainH(x, z) - 0.03, z, hash(i, j, 81 + t) * TAU, s, 0.8 + hash(i, j, 91 + t) * 0.6);
      GC[ng * 3] = Math.pow(cr * v, 2.2); GC[ng * 3 + 1] = Math.pow(Math.min(1, cg * v * 1.06), 2.2); GC[ng * 3 + 2] = Math.pow(cb * v * 0.92, 2.2); ng++; }
    if (nf < FCAP && hash(i, j, 44) < (FCH[b] + (b === 1 || b === 0 || b === 3 ? 0.5 * c01(pn(x0 * 0.022 + 5, z0 * 0.022) * 2.2 + 0.1) : 0)) * gr){ const pal = FPAL[b] || FPAL[1], m = 1 + (hash(i, j, 45) * 3 | 0);
      for (let t = 0; t < m && nf < FCAP; t++){ const x = x0 + hash(i, j, 46 + t) * CS, z = z0 + hash(i, j, 56 + t) * CS; wm(FA, nf * 16, x, terrainH(x, z) - 0.02, z, hash(i, j, 66 + t) * TAU, 0.8 + hash(i, j, 76 + t) * 0.6, 1); _dc.setHex(pal[(hash(i, j, 47) * pal.length) | 0]); FCc[nf * 3] = _dc.r; FCc[nf * 3 + 1] = _dc.g; FCc[nf * 3 + 2] = _dc.b; nf++; } }
  }
  GRASS.count = ng; FLOW.count = nf; for (const m of [GRASS, FLOW]){ m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
}

// ───────────────────────── 룬 비석 (빠른 이동) ─────────────────────────
const STONE = G.std({ map: G.T.stone, color: 0x9aa2b4, roughness: 0.82 }), STONE2 = G.std({ map: G.T.stone, color: 0x6a7080, roughness: 0.9 });
const RUNEC = G.tex(G.runeColumn(128, 1024, 8, '#8ff4ff', 5), true, 1, 1), RUNES = G.tex(G.runeStrip(1024, 128, 14, '#8ff4ff', 0, 11), true, 1, 1);
const beamMat = () => new THREE.ShaderMaterial({ uniforms: { uTime: TIMEU, uOp: { value: 0 }, uC: { value: new THREE.Color(0x7ff3ff) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform float uTime, uOp; uniform vec3 uC; varying vec2 vU; void main(){ float a = pow(1.0 - vU.y, 1.6) * (0.55 + 0.45 * sin(vU.y * 40.0 - uTime * 4.0)) * (0.6 + 0.4 * sin(vU.x * 6.283 * 3.0 + uTime)); gl_FragColor = vec4(uC * a * uOp, a * uOp); }' });
const WPG = new THREE.Group(); WPG.name = 'waypoints'; F.FW.add(WPG);
const WPV = {};
{ const B = new G.Builder(), K = new G.Kit(B);
  for (const w of WPS){ const y = w.y ?? terrainH(w.c[0], w.c[1]); w.y = y;
    K.push(w.c[0], y, w.c[1], hash(w.c[0] | 0, w.c[1] | 0, 5) * TAU);
    K.geo('s2', new THREE.CylinderGeometry(2.4, 2.7, 0.7, 8), 0, 0.05, 0); K.geo('s1', new THREE.CylinderGeometry(1.6, 1.9, 0.55, 8), 0, 0.6, 0); K.geo('s1', new THREE.CylinderGeometry(1.05, 1.25, 0.45, 8), 0, 1.08, 0);
    K.geo('s1', new THREE.CylinderGeometry(0.42, 0.62, 5.2, 4, 1).rotateY(Math.PI / 4), 0, 3.9, 0); K.geo('s2', new THREE.ConeGeometry(0.5, 0.9, 4).rotateY(Math.PI / 4), 0, 6.95, 0);
    for (let q = 0; q < 4; q++){ const a = q * Math.PI / 2 + Math.PI / 4; K.box('s2', 0.5, 0.9, 0.5, Math.cos(a) * 1.85, 0.75, Math.sin(a) * 1.85, 0, a, 0); K.geo('s1', new THREE.ConeGeometry(0.3, 0.45, 4), Math.cos(a) * 1.85, 1.42, Math.sin(a) * 1.85); }
    const v = { w, g: new THREE.Group() }; v.g.position.set(w.c[0], y, w.c[1]); v.g.rotation.y = hash(w.c[0] | 0, w.c[1] | 0, 5) * TAU; WPG.add(v.g);
    const pm = new THREE.MeshBasicMaterial({ map: RUNEC, color: 0x9aa4b4, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const pg = []; for (let q = 0; q < 4; q++){ const a = q * Math.PI / 2, pl = new THREE.PlaneGeometry(0.42, 4.2); pl.applyMatrix4(G.mat(Math.sin(a) * 0.4, 3.9, Math.cos(a) * 0.4, 0, a, 0)); pg.push(pl); }
    v.runes = new THREE.Mesh(G.mergeGeos(pg), pm); v.g.add(v.runes);
    v.ring = new THREE.Mesh(X.polarRing(2.75, 3.35, 64), new THREE.MeshBasicMaterial({ map: RUNES, color: 0x8a94a4, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); v.ring.position.y = 0.45; v.g.add(v.ring);
    v.crys = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0).scale(0.8, 1.35, 0.8), G.std({ color: 0xb8faff, emissive: 0x30d8f0, emissiveIntensity: 2.2, roughness: 0.1, flatShading: true })); v.crys.position.y = 8.2; v.g.add(v.crys);
    v.glow = X.glowSprite(0x7ff3ff, 5, 0.6); v.glow.position.y = 8.2; v.g.add(v.glow);
    v.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.9, 150, 12, 1, true).translate(0, 75, 0), beamMat()); v.beam.position.y = 8; v.beam.renderOrder = 4; v.g.add(v.beam);
    v.label = F.label({ pos: new V3(w.c[0], y + 9.6, w.c[1]), text: w.name, sub: '룬 비석', cls: 'place', max: 70 });
    v.it = F.addInteract({ x: w.c[0], z: w.c[1], r: 3.8, title: '', action: () => touchWp(w.id, true) });
    WPV[w.id] = v; F.circle(w.c[0], w.c[1], 1.3); K.pop(); }
  B.build({ s1: STONE, s2: STONE2 }, WPG);
}
const wpOn = id => S.field.wps.includes(id);
function styleWp(v, k = 1){
  const on = wpOn(v.w.id);
  v.runes.material.color.setHex(on ? 0x8ff4ff : 0x9aa4b4); v.runes.material.opacity = on ? 0.95 : 0.22;
  v.ring.material.color.setHex(on ? 0x8ff4ff : 0x8a94a4); v.ring.material.opacity = on ? 0.85 : 0.25;
  v.crys.visible = v.glow.visible = on; v.beam.visible = on;
  v.it.title = on ? `빠른 이동 · ${v.w.name}` : `룬 비석 깨우기 · ${v.w.name}`;
  v.label.set(v.w.name, on ? (S.field.lastWp === v.w.id ? '룬 비석 · 부활 지점' : '룬 비석') : '잠든 룬 비석');
}
let wakeFx = null;
function touchWp(id, open){
  const v = WPV[id]; if (!v) return;
  if (!wpOn(id)){
    S.field.wps.push(id); S.field.lastWp = id; X.save(); wakeFx = { v, t: 0 };
    const [x, z] = v.w.c; X.sfx('portal'); X.sfx('rune'); G.shake = Math.max(G.shake, 0.4);
    X.shockwave(x, 0.3, z, 10, 0x7ff3ff, 0.9); X.burst(new V3(x, 4, z), 0x8ff4ff, 70, 9, 0.4, 1.3, -2, 3);
    X.banner('RUNE STONE AWAKENED', v.w.name, '룬 비석이 깨어났다 — 지도(M)에서 빠른 이동을 할 수 있어요', false, 3.2);
    BUS.emit('discover', { id, name: v.w.name, kind: 'waypoint' }); if (mapBtn) mapBtn.classList.add('dot');
    styleWp(v); return;
  }
  if (S.field.lastWp !== id){ S.field.lastWp = id; X.save(); F.note(`🔷 부활 지점: <b>${v.w.name}</b>`); for (const k in WPV) styleWp(WPV[k]); }
  if (open) openMap({ travel: true, focus: id });
}
F.discoverWaypoint = id => { if (!WPV[id]) return false; if (!wpOn(id)){ S.field.wps.push(id); X.save(); styleWp(WPV[id]); BUS.emit('discover', { id, name: WPV[id].w.name, kind: 'waypoint' }); } return true; };
for (const k in WPV) styleWp(WPV[k]);
let pendFace = null;
const enemiesNear = (x, z, r = 34) => X.ENEMIES.some(e => e.aggro && X.liveE(e) && Math.hypot(e.pos.x - x, e.pos.z - z) < r);
function travelTo(id){
  if (LIFT) return;
  const v = WPV[id]; if (!v || !wpOn(id)) return false;
  if (enemiesNear(X.player.pos.x, X.player.pos.z)){ X.toast('빠른 이동 불가', '주변에 나를 노리는 적이 있어요'); X.sfx('buzz'); return false; }
  closeMap(); const a = hash(id.length, 3, 9) * TAU, x = v.w.c[0] + Math.cos(a) * 5.5, z = v.w.c[1] + Math.sin(a) * 5.5;
  S.field.lastWp = id; X.save(); pendFace = Math.atan2(v.w.c[0] - x, v.w.c[1] - z) + 0.85; F.teleportTo(x, z, v.w.name, '룬 비석 · 빠른 이동'); return true;
}
F.travelTo = travelTo;

// ───────────────────────── 바람 승강 룬 · 상승 기류 ─────────────────────────
const LIFTV = [];
for (const l of LIFTS){
  const mk = (x, z, y, up) => { const g = new THREE.Group(); g.position.set(x, y + 0.08, z); F.FW.add(g);
    const ring = new THREE.Mesh(X.polarRing(2.2, 3.1, 64), new THREE.MeshBasicMaterial({ map: G.tex(G.runeStrip(1024, 128, 12, '#c8fff0', 0, up ? 21 : 33), true, 1, 1), color: 0xbfffe8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    g.add(ring); const inner = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7affd8, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); inner.position.y = 0.02; g.add(inner);
    G.particles(LOW ? 40 : 80, [new V3(0, 0, 0)], { parent: g, vert: `float life = fract(uTime * 0.5 + aSeed); vL = life; vS = aSeed; float an = aSeed * 71.0 + uTime * 2.2 + life * 4.0, rad = 1.0 + 1.6 * fract(aSeed * 9.1); vec3 p = position + vec3(cos(an) * rad, life * 7.0, sin(an) * rad); float sz = 0.22;`,
      frag: `float a = smoothstep(0.5, 0.0, d) * sin(vL * 3.14) * 0.8; gl_FragColor = vec4(vec3(0.75, 1.0, 0.92) * a, a);` });
    return { g, ring }; };
  const a = mk(l.from[0], l.from[1], l.y0, true), b = mk(l.to[0], l.to[1], l.y1, false);
  const o = { l, a, b }; LIFTV.push(o);
  F.addInteract({ x: l.from[0], z: l.from[1], r: 3.2, title: `${l.name} · 꼭대기로 날아오르기`, action: () => startLift(o, true) });
  F.addInteract({ x: l.to[0], z: l.to[1], r: 3.2, title: `${l.name} · 아래로 내려가기`, action: () => startLift(o, false) });
}
for (const u of UPDRAFTS){
  const g = new THREE.Group(); g.position.set(u.x, u.y, u.z); F.FW.add(g); u.g = g; const H0 = u.top - u.y;
  G.particles(LOW ? 90 : 200, [new V3(0, 0, 0)], { parent: g, vert: `float life = fract(uTime * 0.16 + aSeed); vL = life; vS = aSeed; float an = aSeed * 91.0 + uTime * 1.2 + life * 3.0, rad = ${u.r.toFixed(1)} * sqrt(fract(aSeed * 7.7)); vec3 p = position + vec3(cos(an) * rad, life * ${H0.toFixed(1)}, sin(an) * rad); float sz = 0.6 + 0.8 * fract(aSeed * 3.1);`,
    frag: `float a = smoothstep(0.5, 0.0, d) * sin(vL * 3.14) * 0.6; gl_FragColor = vec4(vec3(0.88, 0.98, 1.0) * a, a);` });
  const wr = new THREE.Mesh(X.polarRing(u.r * 0.92, u.r * 1.1, 64), new THREE.MeshBasicMaterial({ map: G.tex(G.runeStrip(1024, 128, 16, '#e8fbff', 0, 52), true, 1, 1), color: 0xe8fbff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  wr.position.y = 0.25; g.add(wr); u.wr = wr;
  const sw = new THREE.Mesh(new THREE.CylinderGeometry(u.r, u.r * 0.85, H0, 24, 1, true).translate(0, H0 / 2, 0), new THREE.ShaderMaterial({ uniforms: { uTime: TIMEU }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uTime; varying vec2 vU; void main(){ float s = fract(vU.x * 5.0 + vU.y * 2.2 - uTime * 0.35); float a = smoothstep(0.0, 0.08, s) * smoothstep(0.22, 0.08, s) * sin(vU.y * 3.14159) * 0.26; gl_FragColor = vec4(vec3(0.88, 0.98, 1.0) * a, a); }' }));
  g.add(sw); u.sw = sw;
}

// ───────────────────────── 글라이더 (젤다식 패러글라이더) ─────────────────────────
function makeGlider(){
  const c = G.cnv(512, 160), x = c.getContext('2d'); x.fillStyle = '#f2e6cc'; x.fillRect(0, 0, 512, 160);
  for (let i = 0; i < 11; i++){ if (i % 2){ x.fillStyle = i % 4 === 1 ? '#b8392c' : '#1f7f8c'; x.fillRect(i * 512 / 11, 0, 512 / 11, 160); } }
  x.fillStyle = 'rgba(60,30,20,.55)'; x.fillRect(0, 0, 512, 8); x.fillRect(0, 152, 512, 8);
  x.fillStyle = '#e9c87e'; x.beginPath(); x.arc(256, 80, 46, 0, TAU); x.fill(); x.strokeStyle = '#5a3a1a'; x.lineWidth = 5; x.stroke(); x.lineWidth = 7; x.lineCap = 'round'; G.drawRune(x, 4, 256, 80, 66);
  const tex = G.tex(c, true, 1, 1); tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const nu = 22, nv = 6, P = [], U = [], I = [];
  for (let iv = 0; iv <= nv; iv++) for (let iu = 0; iu <= nu; iu++){ const u = iu / nu * 2 - 1, v = iv / nv; P.push(u * 1.8, 0.55 * (Math.cos(u * 1.25) - Math.cos(1.25)) + 0.13 * Math.sin(v * Math.PI), (v - 0.42) * 1.35 * (1 - 0.3 * u * u)); U.push(iu / nu, iv / nv); }
  for (let iv = 0; iv < nv; iv++) for (let iu = 0; iu < nu; iu++){ const a = iv * (nu + 1) + iu, b = a + 1, cc = a + nu + 1, d = cc + 1; I.push(a, cc, b, b, cc, d); }
  const g0 = new THREE.BufferGeometry(); g0.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g0.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g0.setIndex(I); g0.computeVertexNormals();
  const gl = new THREE.Group(), cap = new THREE.Mesh(g0, G.std({ map: tex, side: THREE.DoubleSide, roughness: 0.7 })); cap.position.y = 1.15; cap.castShadow = true; gl.add(cap);
  const dark = G.std({ color: 0x3a2a1c, roughness: 0.6 }), line = G.std({ color: 0x2a2018, roughness: 0.8 });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.95, 6).rotateZ(Math.PI / 2), dark); gl.add(bar);
  const strut = (ax, ay, az, bx, by, bz, r, m) => { const a = new V3(ax, ay, az), b = new V3(bx, by, bz), L = a.distanceTo(b), s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 4), m); s.position.copy(a).add(b).multiplyScalar(0.5); s.quaternion.setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize()); gl.add(s); };
  for (const sx of [-1, 1]){ strut(sx * 0.45, 0, 0, sx * 1.62, 1.18, 0.02, 0.008, line); strut(sx * 0.45, 0, 0, sx * 0.9, 1.58, -0.3, 0.008, line); strut(sx * 0.45, 0, 0, sx * 0.9, 1.6, 0.35, 0.008, line); strut(sx * 0.3, 0, 0, sx * 0.25, 1.68, 0, 0.018, dark); }
  gl.visible = false; return gl;
}
const GLIDER = makeGlider(), GSC0 = 1.18; GLIDER.position.set(0, 2.12, 0.04); X.fig.root.add(GLIDER);
const GLIDE_POSE = G.pose({ lax: -2.95, rax: -2.95, laz: 0.3, raz: -0.3, le: -0.1, re: -0.1, llx: 0.32, rlx: 0.02, lk: 0.6, rk: 0.25, sp: -0.06, hd: -0.3, hrx: 0.16 });
let gliding = false, glideK = 0, glY = 0, gspd = 0, touchHeld = false, glideHint = false;
{ const bj = document.getElementById('bJump'); if (bj){ bj.addEventListener('touchstart', () => { touchHeld = true; }, { passive: true }); bj.addEventListener('touchend', () => { touchHeld = false; }); bj.addEventListener('touchcancel', () => { touchHeld = false; }); } }
const jumpHeld = () => !!(G.keys.Space || touchHeld);
F.unlockGlider = () => { if (S.field.glider) return; S.field.glider = true; X.save(); BUS.emit('glider'); X.sfx('level'); X.banner('NEW GEAR', '룬 글라이더', G.IS_TOUCH ? '공중에서 점프 버튼을 길게 — 하늘을 나는 자유' : '공중에서 Space 를 길게 — 하늘을 나는 자유', false, 3.4); };
F.roleTalkers.glider = async n => {
  X.NAMES[n.id] = n.name; const key = G.IS_TOUCH ? '점프 버튼' : 'Space';
  if (!S.field.glider){
    const r = await X.say([[n.id, '어이, 거기! 바람 냄새가 나는 얼굴인걸. 아르카디아는 두 발로만 다니기엔 너무 넓다고.'], [n.id, '이건 바람 상인 제피의 자랑, 룬 글라이더! 처음 한 장은 공짜야. 하늘을 좋아하는 사람한텐 말이지.', ['받을게요!', '다음에요']]]);
    if (r !== 0){ await X.say([[n.id, '바람이 부르면 다시 와. 난 늘 여기서 바람개비를 보고 있으니까.']]); return; }
    F.unlockGlider();
    await X.say([[n.id, `공중에서 ${key}를 길게 누르면 글라이더가 펼쳐져. 떼면 접히고.`], [n.id, '저기 하얀 바람 기둥 보이지? 상승 기류야. 글라이더를 펴고 들어가면 하늘 높이 솟아오르지!'], [n.id, '높은 데서 그냥 떨어지면 크게 다쳐. 매의 절벽, 독수리 둥지 바위… 높은 곳은 전부 활공장이라고!']]);
    X.hint(`점프 → 공중에서 <b>${key}</b> 길게 = 글라이더 · 하얀 바람 기둥 = 상승 기류`, 9); return;
  }
  const tips = ['붉은 협곡의 바람 승강 룬을 타 봐. 독수리 둥지 바위 꼭대기에서 뛰어내리면… 협곡 전체가 발아래야!', '하늘 끝 봉우리는 하늘길로만 오를 수 있어. 꼭대기에서 활공하면 대륙 절반을 날아갈걸?', '글라이더를 편 채로 바람 기둥에 들어가면 위로 솟구쳐. 바람개비 언덕에도 하나 있지.', '물 위에선 글라이더를 펼 수 없어. 헤엄은 천천히, 침착하게!'];
  await X.say([[n.id, tips[(Math.random() * tips.length) | 0]]]);
};

// ───────────────────────── 움직임 규칙: 절벽 · 헤엄 · 낙하 피해 · 몬스터 경계 ─────────────────────────
const MAXS = 1.2;
let lastX = null, lastZ = null, boundOff = false;
const groundAt = (x, z) => F.groundFn(x, z);
F.bound = p => {
  if (p !== X.player.pos || boundOff || !F.inField) return;
  if (lastX === null){ lastX = p.x; lastZ = p.z; return; }
  let mx = p.x - lastX, mz = p.z - lastZ; const md = Math.hypot(mx, mz);
  if (md < 1e-6) return;
  if (md > 4){ lastX = p.x; lastZ = p.z; return; }
  // 경사는 프레임과 상관없이 "거리당 오르막" 으로 재요. 공중에서는 머리 위 가파른 벽으로 파고들 수 없어요 (점프로 절벽 오르기 막기)
  const steep = (x, z) => { const e = 0.8; return Math.hypot(H(x + e, z) - H(x - e, z), H(x, z + e) - H(x, z - e)) / (2 * e) > MAXS; };
  const ok = (x, z, d) => { const g = groundAt(x, z), ht = H(x, z), g0 = groundAt(lastX, lastZ), gr = X.player.ground;
    if (g > ht + 0.05) return g - (gr ? g0 : Math.max(g0, p.y)) <= 0.7;   // 발판(마루 · 계단 · 물 위)은 한 칸씩 올라서요
    if (gr){ const rise = g - g0; return rise <= 0.12 || rise / Math.max(d, 1e-4) <= MAXS; }
    return g <= p.y - 0.05 || !steep(x, z); };
  if (!ok(p.x, p.z, md)){
    const e = 0.6, gx = groundAt(p.x + e, p.z) - groundAt(p.x - e, p.z), gz = groundAt(p.x, p.z + e) - groundAt(p.x, p.z - e), gl = Math.hypot(gx, gz) || 1, ux = gx / gl, uz = gz / gl, up = mx * ux + mz * uz;
    if (up > 0){ mx -= ux * up; mz -= uz * up; }
    const nx = lastX + mx, nz = lastZ + mz;
    if (Math.hypot(mx, mz) > 1e-4 && ok(nx, nz, Math.hypot(mx, mz))){ p.x = nx; p.z = nz; } else { p.x = lastX; p.z = lastZ; }
  }
  lastX = p.x; lastZ = p.z;
};
const EB = new WeakMap();
F.enemyBound = (p, m) => {
  let r = EB.get(p); if (!r){ let e = null; for (const q of X.ENEMIES) if (q.pos === p){ e = q; break; } EB.set(p, r = { x: p.x, z: p.z, fly: !!(e && (e.fly || (e.cfg && e.cfg.fly))) }); return; }
  const mx = p.x - r.x, mz = p.z - r.z, md = Math.hypot(mx, mz);
  if (md > 6 || md < 1e-6){ r.x = p.x; r.z = p.z; return; }
  const h1 = H(p.x, p.z), h0 = H(r.x, r.z), dh = h1 - h0, d1 = waterY(p.x, p.z) - h1, d0 = waterY(r.x, r.z) - h0;
  let bad = Math.abs(dh) > 0.3 && Math.abs(dh) / md > 1.3;
  if (!r.fly && d1 > 0.95 && d1 > d0 && !isIce(p.x, p.z)) bad = true;
  if (bad){ p.x = r.x; p.z = r.z; } else { r.x = p.x; r.z = p.z; }
};
// 카메라: 지형에 가리면 당기고, 물속으로 안 들어가게
{ const prev = G.camFn; let pull = 1;
  G.camFn = (w, t) => { if (prev) prev(w, t); if (G.area !== 'field' || !F.inField) return;
    let k = 1; for (let i = 2; i <= 8; i++){ const f = i / 8, x = t.x + (w.x - t.x) * f, y = t.y + (w.y - t.y) * f, z = t.z + (w.z - t.z) * f; if (H(x, z) + 0.5 > y){ k = Math.max(0.18, (i - 1.5) / 8); break; } }
    pull = k < pull ? k : pull + (k - pull) * 0.06;
    if (pull < 0.999){ w.x = t.x + (w.x - t.x) * pull; w.y = t.y + (w.y - t.y) * pull + (1 - pull) * 1.2; w.z = t.z + (w.z - t.z) * pull; }
    const wy = waterY(w.x, w.z); if (w.y < wy + 0.45 && H(w.x, w.z) < wy) w.y = wy + 0.45; };
}
// 헤엄 · 물놀이
let swimming = false, wading = false, peakY = null, wasAir = false, LIFT = null, slideT = 0;
const ripG = new THREE.RingGeometry(0.7, 0.86, 32).rotateX(-Math.PI / 2), RIPS = [0, 1, 2].map(i => { const m = new THREE.Mesh(ripG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); m.renderOrder = 5; F.FW.add(m); return { m, t: i / 3 }; });
function swimPose(){
  const t = G.time, mv = Math.min(1, X.player.speed / 2.2);
  if (mv > 0.25){ const ph = t * 5.4; return G.pose({ hrx: 1.0 * mv, hy: 1.02, sp: -0.5 * mv, hd: -0.7 * mv, lax: -1.55 + Math.sin(ph) * 1.55, rax: -1.55 - Math.sin(ph) * 1.55, laz: 0.25, raz: -0.25, le: -0.35, re: -0.35, llx: Math.sin(ph * 2) * 0.4, rlx: -Math.sin(ph * 2) * 0.4, lk: 0.25, rk: 0.25 }); }
  const s = Math.sin(t * 2.6); return G.pose({ hy: 1.0, lax: -0.35, rax: -0.35, laz: 0.95 + s * 0.35, raz: -0.95 - s * 0.35, le: -0.5, re: -0.5, llx: -0.45 + s * 0.4, rlx: -0.45 - s * 0.4, lk: 0.8, rk: 0.8, hd: -0.1 });
}
const LIFT_POSE = G.pose({ hy: 0.86, laz: 1.9, raz: -1.9, le: -0.1, re: -0.1, llx: 0.25, rlx: -0.1, lk: 0.5, rk: 0.3, sp: -0.12, hd: -0.25 });
let baseMod = null;
const myMod = tp => {
  if (LIFT) return LIFT_POSE;
  if (gliding){ G.poseK = 9; const p = Object.assign({}, GLIDE_POSE); p.llx += Math.sin(G.time * 2.3) * 0.1; p.rlx -= Math.sin(G.time * 2.3) * 0.1; return p; }
  const r = baseMod ? baseMod(tp) : tp;
  if (swimming && (r === tp || !r)){ G.poseK = 7; return swimPose(); }
  return r || tp;
};
function startLift(o, up){
  if (LIFT || X.tpBusy || X.dialogOpen || X.dead) return;
  const l = o.l, pp = X.player.pos, tx = up ? l.to[0] : l.from[0] + 2.5, tz = up ? l.to[1] : l.from[1] + 2.5, ty = (up ? l.y1 : l.y0) + 0.05;
  LIFT = { t: 0, T: up ? 3.6 : 2.9, sx: pp.x, sy: pp.y, sz: pp.z, tx, ty, tz, cx: l.to[0], cz: l.to[1], up };
  G.lock = true; boundOff = true; gliding = false; X.sfx('rune'); X.sfx('puff'); X.burst(new V3(pp.x, 0.3, pp.z), 0xc8fff0, 40, 6, 0.35, 0.9, -1, 3);
}
function cancelLift(){ if (!LIFT) return; LIFT = null; boundOff = false; lastX = null; if (!X.dead) G.lock = false; }
function updateLift(dt){
  if (X.dead){ cancelLift(); return; }
  const L = LIFT, p = X.player.pos; L.t += dt; const k = Math.min(1, L.t / L.T), e = k * k * (3 - 2 * k);
  const a0 = Math.atan2(L.sz - L.cz, L.sx - L.cx), r0 = Math.hypot(L.sx - L.cx, L.sz - L.cz), a1 = Math.atan2(L.tz - L.cz, L.tx - L.cx), r1 = Math.hypot(L.tx - L.cx, L.tz - L.cz);
  const da = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)) + (L.up ? TAU : -TAU), a = a0 + da * e, r = lerp(r0, r1, e) + Math.sin(k * Math.PI) * 9;
  const y = L.up ? lerp(L.sy, L.ty, 1 - Math.pow(1 - k, 2.2)) + Math.sin(k * Math.PI) * 6 : lerp(L.sy, L.ty, Math.pow(k, 1.6)) + Math.sin(k * Math.PI) * 5;
  const nx = L.cx + Math.cos(a) * r, nz = L.cz + Math.sin(a) * r; X.fig.root.rotation.y = Math.atan2(nx - p.x, nz - p.z) || X.fig.root.rotation.y;
  p.set(nx, y, nz); X.player.vy = 0; X.player.speed = 0; X.fig.root.position.copy(p);
  if (Math.random() < 0.7) X.emit(nx + (Math.random() - 0.5) * 2, y + Math.random() * 2, nz + (Math.random() - 0.5) * 2, 0, -2 - Math.random() * 3, 0, 0xd8fff4, 0.35, 0.8, { drag: 1 });
  if (k >= 1){ LIFT = null; G.lock = false; boundOff = false; lastX = null; X.player.ground = true; peakY = null; X.sfx('puff');
    if (L.up){ X.banner("EAGLE'S PERCH", '독수리 둥지 바위', '협곡에서 가장 높은 곳', false, 2.6); X.hint(S.field.glider ? `뛰어내려서 <b>${G.IS_TOUCH ? '점프 길게' : 'Space 길게'}</b> — 협곡 위를 날아 보세요!` : '바람 상인 제피(바람개비 언덕)에게 글라이더를 받으면 여기서 날 수 있어요', 6); } }
}

// ───────────────────────── 낮밤 (≈14분) · 지역 분위기 · 하늘 별 · 달 ─────────────────────────
const CYCLE = 840; let todOff = 0;
const todNow = () => ((((Date.now() / 1000 + todOff) / CYCLE) % 1) + 1) % 1;
F.setTimeOfDay = t => { todOff += (t - todNow()) * CYCLE; };
F.timeOfDay = todNow();
F.isNight = () => { const t = F.timeOfDay; return t < 0.19 || t > 0.81; };
const MDEF = { k: 0, mul: [1, 1, 1], add: [0, 0, 0], sun: [1, 0.86, 0.68], sunI: 3.1, hemi: 0.35, hemiC: 0xbcd2ff, fog: [0.44, 0.54, 0.70], fogD: 0.0034, exp: 0.92, env: 1 };
const mvec = m => { m = Object.assign({}, MDEF, m || {}); const h = m.hemiC; return [m.k, ...m.mul, ...m.add, ...m.sun, m.sunI, m.hemi, (h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255, ...m.fog, m.fogD, m.exp, m.env]; };
const MV = {}; const mv = k => MV[k] || (MV[k] = mvec(X.MOOD[k] || X.MOOD.noon));
const FFOG = { noon: 0.0022, morning: 0.0032, golden: 0.0028, mist: 0.0082, sunset: 0.003, overcast: 0.003, purple: 0.0056, dusk: 0.0045, night: 0.0055, pink: 0.0035, teal: 0.004 };
MV.fnight = mvec(Object.assign({}, X.MOOD.night, { mul: [0.17, 0.21, 0.4], add: [0.004, 0.01, 0.03], sunI: 0.85, hemi: 0.3, exp: 0.85, fogD: FFOG.night, fog: [0.03, 0.045, 0.085] }));
MV.fdusk = mvec(Object.assign({}, X.MOOD.dusk, { fogD: FFOG.dusk })); MV.fset = mvec(Object.assign({}, X.MOOD.sunset, { fogD: FFOG.sunset })); MV.fdawn = mvec(Object.assign({}, X.MOOD.pink, { fogD: FFOG.pink })); MV.fgold = mvec(Object.assign({}, X.MOOD.golden, { fogD: FFOG.golden }));
const REGM = REG.map(r => mvec(Object.assign({}, X.MOOD[r.mood] || X.MOOD.noon, { fogD: FFOG[r.mood] || 0.003 })));
const curM = new Float32Array(21), regM = new Float32Array(21), tmpM = new Float32Array(21);
let moodInit = false;
const SUNV = new V3(), MOONV = new V3();
function moodTick(dt, px, py, pz){
  regW(px, pz); const A = REGM[rwA], B = REGM[rwB];
  for (let i = 0; i < 21; i++){ const v = B[i] + (A[i] - B[i]) * rwT; regM[i] = moodInit ? regM[i] + (v - regM[i]) * Math.min(1, dt * 0.9) : v; }
  const t = F.timeOfDay = todNow(), th = (t - 0.25) * TAU, e = Math.sin(th) * 0.9 + 0.2, eve = t > 0.5;   // 낮이 조금 더 길어요
  SUNV.set(Math.cos(th) * 0.8, e, 0.42).normalize(); MOONV.set(-Math.cos(th) * 0.62, -e, -0.48).normalize();
  const wN = 1 - sst(-0.24, -0.03, e), wT = (1 - wN) * (1 - sst(0.03, 0.2, e)), wGd = (1 - wN - wT) * (1 - sst(0.2, 0.42, e)) * 0.8, wD = Math.max(0, 1 - wN - wT - wGd);
  const TW = e < 0 ? MV.fdusk : eve ? MV.fset : MV.fdawn;
  for (let i = 0; i < 21; i++) tmpM[i] = regM[i] * wD + MV.fgold[i] * wGd + TW[i] * wT + MV.fnight[i] * wN;
  // 지역 안개 색을 밤에도 조금 남겨요
  for (let i = 15; i < 18; i++) tmpM[i] = lerp(tmpM[i], regM[i] * 0.18, wN * 0.3);
  for (let i = 0; i < 21; i++) curM[i] = moodInit ? curM[i] + (tmpM[i] - curM[i]) * Math.min(1, dt * 2.5) : tmpM[i]; moodInit = true;
  const dip = sst(0.0, 0.09, Math.abs(e)), useSun = e >= 0, dir = useSun ? SUNV : MOONV;
  const alt = sst(30, 170, py), fogD = Math.min(0.0095, Math.max(0.0012, curM[18])) * lerp(1, 0.5, alt);
  const m = { k: curM[0], mul: [curM[1], curM[2], curM[3]], add: [curM[4], curM[5], curM[6]], sun: [curM[7], curM[8], curM[9]], sunI: curM[10] * dip, hemi: curM[11], hemiC: (Math.round(Math.min(1, curM[12]) * 255) << 16) | (Math.round(Math.min(1, curM[13]) * 255) << 8) | Math.round(Math.min(1, curM[14]) * 255),
    fog: [curM[15], curM[16], curM[17]], fogD, exp: curM[19], env: curM[20], dir: [dir.x, dir.y, dir.z] };
  G.setMood(m);
  const dayL = useSun ? sst(-0.02, 0.25, e) : 0, nightL = useSun ? 0 : sst(0, 0.3, -e);
  WU.uLight.value = 0.22 + 0.78 * dayL + 0.12 * nightL; WU.uSunC.value.setRGB(curM[7], curM[8], curM[9]).multiplyScalar(dip * (useSun ? 1 : 0.35));
  WU.uHor.value.setRGB(curM[15], curM[16], curM[17]).multiplyScalar(1.15); WU.uZen.value.setRGB(lerp(0.02, 0.14, dayL), lerp(0.03, 0.3, dayL), lerp(0.08, 0.62, dayL));
  DAYU.value = dayL; NIGHTK = wN;
}
let NIGHTK = 0;
// 별 · 달
const STARS = (() => { const n = LOW ? 700 : 1600, P = new Float32Array(n * 3), Sd = new Float32Array(n);
  for (let i = 0; i < n; i++){ const u = rng(), v = rng() * 0.92 + 0.08, a = u * TAU, y = v, r = Math.sqrt(1 - y * y); P[i * 3] = Math.cos(a) * r * 1600; P[i * 3 + 1] = y * 1600; P[i * 3 + 2] = Math.sin(a) * r * 1600; Sd[i] = rng(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(Sd, 1));
  const m = new THREE.ShaderMaterial({ uniforms: { uTime: TIMEU, uOp: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'attribute float aSeed; uniform float uTime, uOp; varying float vA; varying vec3 vC; void main(){ vA = uOp * (0.45 + 0.55 * sin(uTime * (1.0 + aSeed * 3.0) + aSeed * 60.0)) * (0.35 + 0.65 * aSeed); vC = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.92, 0.8), fract(aSeed * 13.0)); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 1.2 + aSeed * aSeed * 3.2; }',
    fragmentShader: 'varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vC * a, a); }' });
  const s = new THREE.Points(g, m); s.frustumCulled = false; s.renderOrder = -10; F.FW.add(s); return s; })();
const MOON = (() => { const c = G.cnv(128), x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 20, 64, 64, 64); gr.addColorStop(0, 'rgba(230,238,255,1)'); gr.addColorStop(0.42, 'rgba(230,238,255,1)'); gr.addColorStop(0.47, 'rgba(160,190,255,.45)'); gr.addColorStop(1, 'rgba(120,150,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  x.fillStyle = 'rgba(150,160,190,.35)'; for (const [a, b, r] of [[50, 52, 8], [74, 70, 6], [60, 80, 4], [80, 48, 5], [46, 72, 3]]){ x.beginPath(); x.arc(a, b, r, 0, TAU); x.fill(); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false, toneMapped: false, blending: THREE.AdditiveBlending })); s.scale.set(70, 70, 1); s.renderOrder = -9; F.FW.add(s);
  const h = X.glowSprite(0x9ab8ff, 420, 0.25); h.material.fog = false; h.renderOrder = -9; F.FW.add(h); return { s, h }; })();
// 지역 공기 입자 (카메라 둘레에서 감싸며 반복)
const AMB = [];
function ambient(n, box, blend, col, motion, biomes, night){
  const P = new Float32Array(n * 3), Sd = new Float32Array(n); for (let i = 0; i < n; i++){ P[i * 3] = rng() * box[0]; P[i * 3 + 1] = rng() * box[1]; P[i * 3 + 2] = rng() * box[2]; Sd[i] = rng(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(Sd, 1));
  const m = new THREE.ShaderMaterial({ uniforms: { uTime: TIMEU, uScale: { value: 400 }, uOp: { value: 0 }, uC: { value: new V3() }, uBox: { value: new V3(...box) } }, transparent: true, depthWrite: false, blending: blend ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
    vertexShader: `attribute float aSeed; uniform float uTime, uScale, uOp; uniform vec3 uC, uBox; varying float vA; varying float vS;
      void main(){ vec3 p = position; float t = uTime, s = aSeed; float sz = 0.1; vA = 1.0; vS = s; ${motion}
        p = mod(p - uC + uBox * 0.5, uBox) - uBox * 0.5 + uC; vec3 q = abs(p - uC) / (uBox * 0.5); vA *= (1.0 - smoothstep(0.7, 1.0, max(q.x, max(q.y, q.z)))) * uOp;
        vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = sz * uScale / -mv.z; }`,
    fragmentShader: `varying float vA; varying float vS; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; vec3 c = ${col}; gl_FragColor = vec4(${blend ? 'c * a' : 'c'}, a); }` });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 6; F.FW.add(pts); const o = { pts, m, biomes, night, op: 0 }; AMB.push(o); return o;
}
const AQ = LOW ? 0.5 : 1;
ambient(Math.round(260 * AQ), [60, 16, 60], 1, 'vec3(1.0, 0.92, 0.55) * 1.3', 'p += vec3(sin(t * 0.4 + s * 50.0) * 1.5, sin(t * 0.6 + s * 31.0) * 0.6, cos(t * 0.3 + s * 70.0) * 1.5); sz = 0.09; vA = 0.6 + 0.4 * sin(t * 2.0 + s * 40.0);', { 0: 0.6, 1: 1, 3: 0.5, 6: 0.3 });
ambient(Math.round(170 * AQ), [50, 18, 50], 0, 'mix(vec3(0.95, 0.45, 0.12), vec3(0.95, 0.78, 0.2), fract(vS * 7.0)) * 0.9', 'float f = fract(t * 0.045 + s); p.y = uBox.y * (1.0 - f) + uC.y - uBox.y * 0.5; p.x += sin(t * 1.3 + s * 30.0) * 1.2 + f * 4.0; p.z += cos(t + s * 20.0) * 1.2; sz = 0.2; vA = 0.9;', { 2: 1, 4: 0.25 });
ambient(Math.round(240 * AQ), [55, 14, 55], 1, 'vec3(0.7, 0.95, 0.5) * 1.2', 'p += vec3(sin(t * 0.3 + s * 50.0) * 2.0, fract(t * 0.03 + s) * 6.0, cos(t * 0.25 + s * 70.0) * 2.0); sz = 0.12; vA = 0.5 + 0.5 * sin(t * 1.5 + s * 40.0);', { 4: 1 });
ambient(Math.round(48 * AQ), [100, 7, 100], 0, 'vec3(0.84, 0.88, 0.86)', 'p.x += t * 0.7 + sin(s * 40.0) * 4.0; p.z += cos(t * 0.1 + s * 9.0) * 3.0; p.y -= 2.0; sz = 9.0 + s * 9.0; vA = 0.13;', { 4: 1 });
ambient(Math.round(220 * AQ), [70, 14, 70], 0, 'vec3(0.93, 0.74, 0.55)', 'p.x += t * 1.6 + sin(s * 40.0) * 3.0; p.y += sin(t * 0.5 + s * 31.0) * 0.5; p.z += cos(t * 0.2 + s * 70.0) * 2.0; sz = 0.13; vA = 0.55;', { 5: 1, 6: 0.45 });
ambient(Math.round(230 * AQ), [55, 16, 55], 1, 'vec3(0.75, 0.32, 1.0) * 1.5', 'p += vec3(sin(t * 0.35 + s * 50.0) * 2.2, fract(t * 0.05 + s) * 7.0, cos(t * 0.3 + s * 70.0) * 2.2); sz = 0.16; vA = 0.4 + 0.6 * pow(0.5 + 0.5 * sin(t * 2.0 + s * 60.0), 2.0);', { 7: 1 });
ambient(Math.round(620 * AQ), [60, 30, 60], 0, 'vec3(0.97, 0.98, 1.0)', 'float f = fract(t * 0.055 + s); p.y = uBox.y * (1.0 - f) + uC.y - uBox.y * 0.5; p.x += sin(t * 0.9 + s * 30.0) * 0.8 + f * 3.0; p.z += cos(t * 0.7 + s * 20.0) * 0.8; sz = 0.12 + 0.08 * fract(s * 9.0); vA = 0.85;', { 8: 1 });
ambient(Math.round(130 * AQ), [50, 8, 50], 1, 'vec3(0.75, 1.0, 0.45) * 1.6', 'p += vec3(sin(t * 0.5 + s * 50.0) * 1.5, sin(t * 0.8 + s * 31.0) * 0.6 - 2.0, cos(t * 0.4 + s * 70.0) * 1.5); sz = 0.13; vA = pow(0.5 + 0.5 * sin(t * (1.5 + fract(s * 4.0) * 2.0) + s * 90.0), 2.0);', { 0: 0.6, 1: 1, 2: 1, 3: 0.8, 4: 0.7 }, true);
function ambTick(dt){
  const cam = G.camera.position, sc = innerHeight * G.renderer.getPixelRatio() * 0.5 / Math.tan(G.camera.fov * Math.PI / 360);
  const bA = RBIO[rwA], bB = RBIO[rwB];
  for (const o of AMB){ let w = (o.biomes[bA] || 0) * rwT + (o.biomes[bB] || 0) * (1 - rwT); if (o.night) w *= NIGHTK; else if (o.biomes[1] && !o.biomes[8]) w *= 1 - NIGHTK * 0.6;
    o.op += (w - o.op) * Math.min(1, dt * 1.5); o.pts.visible = o.op > 0.02; if (!o.pts.visible) continue; o.m.uniforms.uOp.value = o.op; o.m.uniforms.uC.value.copy(cam); o.m.uniforms.uScale.value = sc; }
}

// ───────────────────────── 지도: 양피지 지형도 (월드맵 · 미니맵 바탕) ─────────────────────────
const MAPS = F.mapCanvas.width, REL = F.mapCanvas;   // 미니맵 바탕을 그대로 월드맵 지형도로 써요 (캔버스 하나)
const LIGHT = new V3(-0.55, 0.7, -0.45).normalize();
async function drawRelief(){
  const SH = new Float32Array(NN); for (let k = 0; k < NN; k++){ SH[k] = Math.max(0, (NRM[k * 3] * LIGHT.x + NRM[k * 3 + 1] * LIGHT.y + NRM[k * 3 + 2] * LIGHT.z) / 127); }
  const x = REL.getContext('2d'), im = x.createImageData(MAPS, MAPS), d = im.data, sc = (N - 1) / MAPS, PAR = [0.91, 0.86, 0.74];
  for (let py = 0; py < MAPS; py++){
    const fz = (py + 0.5) * sc, j = Math.min(N - 2, fz | 0), v = fz - j;
    for (let px = 0; px < MAPS; px++){
      const fx = (px + 0.5) * sc, i = Math.min(N - 2, fx | 0), u = fx - i, k = j * N + i, k1 = k + 1, k2 = k + N, k3 = k2 + 1;
      const w0 = (1 - u) * (1 - v), w1 = u * (1 - v), w2 = (1 - u) * v, w3 = u * v;
      const h = HG[k] * w0 + HG[k1] * w1 + HG[k2] * w2 + HG[k3] * w3, sh = SH[k] * w0 + SH[k1] * w1 + SH[k2] * w2 + SH[k3] * w3, wl = WLV[k];
      let r = (COLG[k * 3] * w0 + COLG[k1 * 3] * w1 + COLG[k2 * 3] * w2 + COLG[k3 * 3] * w3) / 255, g = (COLG[k * 3 + 1] * w0 + COLG[k1 * 3 + 1] * w1 + COLG[k2 * 3 + 1] * w2 + COLG[k3 * 3 + 1] * w3) / 255, b = (COLG[k * 3 + 2] * w0 + COLG[k1 * 3 + 2] * w1 + COLG[k2 * 3 + 2] * w2 + COLG[k3 * 3 + 2] * w3) / 255;
      r = lerp(r, PAR[0], 0.22); g = lerp(g, PAR[1], 0.22); b = lerp(b, PAR[2], 0.22);
      let L = 0.5 + sh * 0.72;
      if (h < wl - 0.05 && !ICE[k]){ const dd = sst(0, 7, wl - h); r = lerp(0.62, 0.22, dd); g = lerp(0.8, 0.46, dd); b = lerp(0.84, 0.62, dd); L = 1; if (wl - h < 0.45){ r = 0.86; g = 0.93; b = 0.94; } }
      else { const q = h / 10, fq = q - Math.floor(q), cw = 0.06 + (Math.round(q) % 5 === 0 ? 0.04 : 0); if (fq < cw || fq > 1 - cw * 0.3) L *= Math.round(q) % 5 === 0 ? 0.8 : 0.9; }
      const o = (py * MAPS + px) * 4; d[o] = Math.min(255, r * L * 255); d[o + 1] = Math.min(255, g * L * 255); d[o + 2] = Math.min(255, b * L * 255); d[o + 3] = 255;
    }
    if (py % 256 === 255) await idle();
  }
  x.putImageData(im, 0, 0);
  const k = MAPS / (HALF * 2), P = (a, b) => [(a + HALF) * k, (b + HALF) * k];
  x.lineCap = 'round'; x.lineJoin = 'round';
  for (const R0 of RIVS){ x.strokeStyle = 'rgba(60,120,160,.85)'; x.lineWidth = Math.max(2, R0.w * k * 0.75); x.beginPath(); R0.pts.forEach((p, i) => x[i ? 'lineTo' : 'moveTo'](...P(...p))); x.stroke(); }
  for (const R0 of ROADS){ const pts = R0.pts.map(p => P(...p)); x.strokeStyle = 'rgba(92,70,40,.75)'; x.lineWidth = R0.w * k + 3; x.beginPath(); pts.forEach((p, i) => x[i ? 'lineTo' : 'moveTo'](...p)); x.stroke(); x.strokeStyle = '#efdcae'; x.lineWidth = R0.w * k; x.beginPath(); pts.forEach((p, i) => x[i ? 'lineTo' : 'moveTo'](...p)); x.stroke(); }
  for (const b of BRIDGES){ x.strokeStyle = '#5a3a20'; x.lineWidth = b.w * k + 2; x.beginPath(); x.moveTo(...P(b.x0, b.z0)); x.lineTo(...P(b.x1, b.z1)); x.stroke(); x.strokeStyle = '#c8a070'; x.lineWidth = b.w * k - 1; x.stroke(); }
  // 가장자리 바랜 테두리
  const gr = x.createRadialGradient(MAPS / 2, MAPS / 2, MAPS * 0.38, MAPS / 2, MAPS / 2, MAPS * 0.72); gr.addColorStop(0, 'rgba(60,40,20,0)'); gr.addColorStop(1, 'rgba(60,40,20,.38)'); x.fillStyle = gr; x.fillRect(0, 0, MAPS, MAPS);
}
F.drawMapBase = () => {};   // 지형도는 drawRelief 가 미니맵 캔버스에 한 번 그려요
F.area.mapZoom = 5.2;
// 미니맵 위: 룬 비석 · 상승 기류 · 승강 룬
{ const prev = F.area.mapDraw; F.area.mapDraw = (c, k) => { if (prev) prev(c, k); const ms = 1.3 / (F.area.mapZoom || 5);
    for (const w of WPS){ const on = wpOn(w.id); c.save(); c.translate(w.c[0] * k, w.c[1] * k); c.rotate(Math.PI / 4 - G.camYaw); c.scale(ms, ms); c.fillStyle = on ? '#7ff3ff' : '#8a8f9a'; if (on){ c.shadowColor = '#7ff3ff'; c.shadowBlur = 8; } c.fillRect(-4, -4, 8, 8); c.restore(); }
    c.strokeStyle = 'rgba(240,250,255,.8)'; c.lineWidth = 1.2 * ms; for (const u of UPDRAFTS){ c.beginPath(); c.arc(u.x * k, u.z * k, u.r * k, 0, TAU); c.stroke(); } }; }
// 안개 (탐험한 곳만 밝혀요): 128 × 128 칸 (12.5m)
const FOGN = 128, FOG = new Uint8Array(FOGN * FOGN), FOGS = 256, FOGC = G.cnv(FOGS), FOGA = new Float32Array(FOGS * FOGS), FOGT = new Float32Array(FOGS * FOGS);
try { if (S.field.fog){ const b = atob(S.field.fog); for (let i = 0; i < b.length && i * 8 < FOG.length; i++){ const v = b.charCodeAt(i); for (let q = 0; q < 8; q++) FOG[i * 8 + q] = (v >> q) & 1; } } } catch (e){}
let fogDirty = true, fogSaveT = 0, fogChanged = false;
function fogDraw(){
  const n = FOGS, A = FOGA, T = FOGT, f = FOGN / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++){ const u = Math.max(0, Math.min(FOGN - 1.001, (i + 0.5) * f - 0.5)), v = Math.max(0, Math.min(FOGN - 1.001, (j + 0.5) * f - 0.5)), a = u | 0, b = v | 0, fu = u - a, fv = v - b, q = b * FOGN + a;
    A[j * n + i] = (FOG[q] * (1 - fu) + FOG[q + 1] * fu) * (1 - fv) + (FOG[q + FOGN] * (1 - fu) + FOG[q + FOGN + 1] * fu) * fv; }
  for (let pass = 0; pass < 2; pass++){ const r = 3;
    for (let j = 0; j < n; j++){ let acc = 0; for (let i = -r; i <= r; i++) acc += A[j * n + Math.max(0, Math.min(n - 1, i))]; for (let i = 0; i < n; i++){ T[j * n + i] = acc / (2 * r + 1); acc += A[j * n + Math.min(n - 1, i + r + 1)] - A[j * n + Math.max(0, i - r)]; } }
    for (let i = 0; i < n; i++){ let acc = 0; for (let j = -r; j <= r; j++) acc += T[Math.max(0, Math.min(n - 1, j)) * n + i]; for (let j = 0; j < n; j++){ A[j * n + i] = acc / (2 * r + 1); acc += T[Math.min(n - 1, j + r + 1) * n + i] - T[Math.max(0, j - r) * n + i]; } } }
  const x = FOGC.getContext('2d'), im = x.createImageData(n, n);
  for (let i = 0; i < n * n; i++){ const a = 1 - sst(0.15, 0.85, A[i]), gx = i % n, gy = (i / n) | 0, ns = hash(gx >> 2, gy >> 2, 77) * 10; im.data[i * 4] = 58 + ns; im.data[i * 4 + 1] = 47 + ns; im.data[i * 4 + 2] = 32 + ns * 0.6; im.data[i * 4 + 3] = a * 205; }
  x.putImageData(im, 0, 0); fogDirty = false;
}
function fogReveal(px, pz, R = 88){ const cs = HALF * 2 / FOGN, ci = Math.floor((px + HALF) / cs), cj = Math.floor((pz + HALF) / cs), rr = Math.ceil(R / cs);
  for (let j = cj - rr; j <= cj + rr; j++) for (let i = ci - rr; i <= ci + rr; i++){ if (i < 0 || j < 0 || i >= FOGN || j >= FOGN) continue; if (((i - ci) ** 2 + (j - cj) ** 2) * cs * cs > R * R) continue; const q = j * FOGN + i; if (!FOG[q]){ FOG[q] = 1; fogDirty = true; fogChanged = true; } } }
function fogSave(){ let s = ''; for (let i = 0; i < FOG.length; i += 8){ let v = 0; for (let q = 0; q < 8; q++) v |= FOG[i + q] << q; s += String.fromCharCode(v); } S.field.fog = btoa(s); X.save(); fogChanged = false; }
const revealed = (x, z) => { const cs = HALF * 2 / FOGN, i = Math.floor((x + HALF) / cs), j = Math.floor((z + HALF) / cs); return i >= 0 && j >= 0 && i < FOGN && j < FOGN && FOG[j * FOGN + i] === 1; };
F.fogRevealed = revealed;

// ── 월드맵 창 ──
const css = document.createElement('style');
css.textContent = `
  #wwmap { position:fixed; inset:0; z-index:27; display:none; background:radial-gradient(ellipse at center, #3a2e1e 0%, #15100a 100%); touch-action:none; user-select:none; }
  #wwmap.on { display:block; }
  #wwmap canvas { position:absolute; inset:0; width:100%; height:100%; cursor:grab; } #wwmap canvas.drag { cursor:grabbing; } #wwmap canvas.hov { cursor:pointer; }
  #wwmap .hd { position:absolute; left:50%; top:calc(10px + env(safe-area-inset-top)); transform:translateX(-50%); text-align:center; pointer-events:none; text-shadow:0 2px 8px rgba(0,0,0,.8); }
  #wwmap .hd .a { font:700 12px 'Cinzel'; letter-spacing:.55em; color:#e9c87e; } #wwmap .hd .b { font:900 clamp(20px, 3.4vw, 30px) 'Gowun Batang'; color:#fff3d6; letter-spacing:.15em; }
  #wwmap .hd .c { font:500 12px 'Noto Sans KR'; color:#d8e4e8; margin-top:2px; }
  #wwmap .x { position:absolute; right:14px; top:calc(12px + env(safe-area-inset-top)); width:38px; height:38px; border-radius:50%; font:700 18px 'Noto Sans KR'; color:#fff3d6; background:rgba(16,20,34,.85); border:1px solid rgba(233,200,126,.55); cursor:pointer; }
  #wwmap .side { position:absolute; left:12px; top:76px; bottom:60px; width:210px; overflow:auto; padding:10px; border-radius:6px; background:linear-gradient(180deg, rgba(16,20,34,.9), rgba(10,12,22,.92)); border:1px solid rgba(233,200,126,.45); }
  #wwmap .side h4 { margin:0 0 6px; font:700 11px 'Cinzel'; letter-spacing:.3em; color:#7ff3ff; } #wwmap .side small { display:block; font:500 11px 'Noto Sans KR'; color:#b8c4cc; margin-bottom:8px; }
  #wwmap .side button { display:block; width:100%; text-align:left; margin:0 0 5px; padding:7px 9px; border-radius:4px; cursor:pointer; font:700 13px 'Gowun Batang'; color:#fff3d6; background:rgba(127,243,255,.07); border:1px solid rgba(127,243,255,.3); }
  #wwmap .side button:hover, #wwmap .side button.sel { background:rgba(127,243,255,.2); border-color:#7ff3ff; } #wwmap .side button span { display:block; font:500 10px 'Noto Sans KR'; color:#9fd8e0; }
  #wwmap .side button.off { opacity:.4; cursor:default; }
  #wwmap .lg { position:absolute; right:12px; bottom:calc(12px + env(safe-area-inset-bottom)); padding:8px 12px; border-radius:6px; background:rgba(16,20,34,.85); border:1px solid rgba(233,200,126,.4); font:500 11px 'Noto Sans KR'; color:#e8e0cc; line-height:1.75; }
  #wwmap .lg i { display:inline-block; width:14px; text-align:center; font-style:normal; margin-right:4px; }
  #wwmap .zm { position:absolute; right:12px; top:calc(60px + env(safe-area-inset-top)); display:flex; flex-direction:column; gap:6px; }
  #wwmap .zm button { width:34px; height:34px; border-radius:6px; font:700 16px 'Noto Sans KR'; color:#fff3d6; background:rgba(16,20,34,.85); border:1px solid rgba(233,200,126,.45); cursor:pointer; }
  #wwmap .tip { position:absolute; pointer-events:none; padding:7px 11px; border-radius:5px; background:rgba(12,14,24,.94); border:1px solid rgba(233,200,126,.55); font:500 12px 'Noto Sans KR'; color:#eee; max-width:240px; display:none; transform:translate(14px, 10px); }
  #wwmap .tip b { display:block; font:700 14px 'Gowun Batang'; color:#ffe9b0; } #wwmap .tip em { display:block; font-style:normal; color:#7ff3ff; margin-top:3px; font-weight:700; }
  #wwmap .cf { position:absolute; left:50%; bottom:calc(70px + env(safe-area-inset-bottom)); transform:translateX(-50%); padding:14px 20px; border-radius:6px; text-align:center; display:none; background:linear-gradient(180deg, rgba(14,18,30,.97), rgba(6,8,14,.97)); border:1px solid rgba(233,200,126,.6); box-shadow:0 10px 30px rgba(0,0,0,.6); }
  #wwmap .cf.on { display:block; } #wwmap .cf .q { font:700 16px 'Gowun Batang'; color:#fff3d6; margin-bottom:10px; } #wwmap .cf .w { font:500 12px 'Noto Sans KR'; color:#ff9a8a; margin-bottom:8px; }
  #wwmap .cf button { margin:0 5px; padding:8px 18px; font:700 14px 'Gowun Batang'; color:#fff3d6; background:rgba(127,243,255,.14); border:1px solid rgba(127,243,255,.6); border-radius:3px; cursor:pointer; } #wwmap .cf button.n { background:rgba(233,200,126,.1); border-color:rgba(233,200,126,.5); }
  @media (max-width: 760px){ #wwmap .side { top:auto; bottom:0; left:0; right:0; width:auto; height:auto; max-height:none; display:flex; gap:6px; overflow-x:auto; overflow-y:hidden; padding:8px; border-radius:0; } #wwmap .side h4, #wwmap .side small { display:none; } #wwmap .side button { flex:0 0 auto; width:auto; margin:0; } #wwmap .lg { display:none; } #wwmap .cf { bottom:84px; } }
  body.touch #wwmap .lg { display:none; }
`;
document.head.appendChild(css);
const MW = X.mk('div', 'wwmap', `<canvas></canvas><div class="hd"><div class="a">ARCADIA</div><div class="b">아르카디아</div><div class="c"></div></div><div class="side"></div><div class="zm"><button data-z="1">＋</button><button data-z="-1">－</button><button data-z="0">◎</button></div>
  <div class="lg"><div><i style="color:#7ff3ff">◆</i>룬 비석 (빠른 이동)</div><div><i>?</i>미발견 장소</div><div><i style="color:#ff7a5a">⚔</i>사냥터 (권장 레벨)</div><div><i style="color:#ff5a8a">♛</i>레이드</div><div><i style="color:#ffd36a">◆</i>퀘스트</div></div>
  <div class="tip"></div><div class="cf"><div class="q"></div><div class="w"></div><button class="y">이동</button><button class="n">취소</button></div><button class="x">✕</button>`);
const MC = MW.querySelector('canvas'), mctx = MC.getContext('2d'), mTip = MW.querySelector('.tip'), mCf = MW.querySelector('.cf'), mSide = MW.querySelector('.side');
const MV2 = { cx: 0, cz: 0, s: 0.5, travel: false, sel: null, hov: null, open: false, t: 0, pend: null };
const LMI = { village: '🏘', runegate: '⛩', windmill_hill: '🌬', giant_tree: '🌳', farm: '🐑', ponds: '💧', apiary: '🐝', overlook: '🦅', lighthouse: '🗼', island_ruin: '🏛', bridge: '🌉', giant_stump: '🪵', fairy_ring: '🍄', camp: '⛺', spring: '⛲', root_arch: '🌿', sunken_temple: '🏯', witch_hut: '🛖', boardwalk: '🪜', waterfall: '🌊', seep_cliff: '💧', spire_nest: '🪺', mine: '⛏', skeleton: '💀', mesa_mark: '🪨', stairs: '🪜', citadel_ruin: '🏰', colossus: '🗿', tower: '🔭', thorn_gate: '🥀', thorn_heart: '🖤', pass_shrine: '⛩', frozen_altar: '❄', summit: '🏔', ridge_mark: '⛰' };
const NTI = { cliff: '🪨', ridge: '⛰', peak: '🗻', mesa: '🟫', river: '〰' };
const isDisc = id => F.discovered ? !!F.discovered(id) : !!(S.field.disc && S.field.disc[id]);
let mDPR = 1;
function mapResize(){ mDPR = Math.min(1.5, devicePixelRatio || 1); MC.width = Math.round(innerWidth * mDPR); MC.height = Math.round(innerHeight * mDPR); }
const minS = () => Math.min(innerWidth, innerHeight) / (HALF * 2) * 1.02;
const toS = (x, z) => [innerWidth / 2 + (x - MV2.cx) * MV2.s, innerHeight / 2 + (z - MV2.cz) * MV2.s];
const toW = (sx, sy) => [MV2.cx + (sx - innerWidth / 2) / MV2.s, MV2.cz + (sy - innerHeight / 2) / MV2.s];
function clampView(){ MV2.s = Math.max(minS(), Math.min(5, MV2.s)); const hw = innerWidth / 2 / MV2.s, hh = innerHeight / 2 / MV2.s; MV2.cx = Math.max(-HALF + Math.min(hw, HALF), Math.min(HALF - Math.min(hw, HALF), MV2.cx)); MV2.cz = Math.max(-HALF + Math.min(hh, HALF), Math.min(HALF - Math.min(hh, HALF), MV2.cz)); }
function campCol(c){ const lv = S.lv || 1; return c.lv[0] > lv + 3 ? '#ff5a4a' : c.lv[0] > lv + 1 ? '#ffa04a' : c.lv[1] < lv - 4 ? '#9aa4a8' : '#8aff7a'; }
function drawWorldMap(){
  if (fogDirty) fogDraw();
  const W0 = innerWidth, H0 = innerHeight, c = mctx, s = MV2.s, t = G.time;
  c.setTransform(mDPR, 0, 0, mDPR, 0, 0); c.fillStyle = '#1a140c'; c.fillRect(0, 0, W0, H0);
  c.save(); c.translate(W0 / 2 - MV2.cx * s, H0 / 2 - MV2.cz * s); c.scale(s, s); c.imageSmoothingEnabled = true;
  c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 30; c.fillStyle = '#e8dcc0'; c.fillRect(-HALF, -HALF, HALF * 2, HALF * 2); c.shadowBlur = 0;
  c.drawImage(REL, -HALF, -HALF, HALF * 2, HALF * 2); c.drawImage(FOGC, -HALF, -HALF, HALF * 2, HALF * 2);
  c.strokeStyle = 'rgba(80,56,30,.9)'; c.lineWidth = 3 / s; c.strokeRect(-HALF, -HALF, HALF * 2, HALF * 2); c.restore();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const fz = Math.max(0.6, Math.min(1.6, s * 1.4));
  // 지역 이름
  for (const r of REG){ if (r.id === 'village' && s < 1) continue; const [x, y] = toS(r.c[0], r.c[1] - (r.id === 'village' ? 20 : 0)), lit = revealed(r.c[0], r.c[1] - (r.id === 'village' ? 20 : 0));
    c.font = `900 ${Math.round((r.id === 'village' ? 13 : 20) * fz)}px 'Gowun Batang'`; c.fillStyle = lit ? 'rgba(60,36,14,.66)' : 'rgba(236,222,190,.62)'; c.strokeStyle = lit ? 'rgba(240,228,200,.55)' : 'rgba(30,22,12,.5)'; c.lineWidth = 3; c.strokeText(r.name, x, y); c.fillText(r.name, x, y);
    c.font = `700 ${Math.round(10 * fz)}px 'Cinzel'`; c.fillStyle = lit ? 'rgba(90,60,30,.65)' : 'rgba(233,200,126,.6)'; c.fillText(r.safe ? 'SAFE' : `Lv ${r.lv[0]}–${r.lv[1]}`, x, y + 17 * fz); }
  // 이름 붙은 지형
  if (s > 0.55) for (const n of W.namedTerrain){ if (!revealed(n.c[0], n.c[1])) continue; const [x, y] = toS(n.c[0], n.c[1]); c.font = `italic 600 ${Math.round(11 * fz)}px 'Gowun Batang'`; c.fillStyle = n.kind === 'river' ? 'rgba(30,80,120,.85)' : 'rgba(70,44,20,.85)'; c.fillText(`${NTI[n.kind] || ''} ${n.name}`, x, y); }
  // 사냥터
  for (const cp of CAMPS){ if (!revealed(cp.c[0], cp.c[1])) continue; const [x, y] = toS(cp.c[0], cp.c[1]); const col = campCol(cp);
    c.strokeStyle = col; c.globalAlpha = 0.5; c.lineWidth = 1.5; c.setLineDash([4, 4]); c.beginPath(); c.arc(x, y, Math.max(5, cp.r * s), 0, TAU); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    if (s > 0.7){ c.font = `700 ${Math.round(10 * fz)}px 'Noto Sans KR'`; c.fillStyle = 'rgba(20,14,8,.75)'; const tx = `⚔ Lv.${cp.lv[0]}~${cp.lv[1]} ${cp.name}`, tw = c.measureText(tx).width; c.fillRect(x - tw / 2 - 4, y - 8 * fz, tw + 8, 16 * fz); c.fillStyle = col; c.fillText(tx, x, y); } else { c.fillStyle = col; c.font = `700 ${Math.round(11 * fz)}px 'Noto Sans KR'`; c.fillText('⚔', x, y); } }
  // 낚시터
  if (s > 0.9) for (const f of W.fishing){ if (!revealed(f.c[0], f.c[1])) continue; const [x, y] = toS(f.c[0], f.c[1]); c.font = `${Math.round(12 * fz)}px sans-serif`; c.fillText('🎣', x, y); }
  // 랜드마크
  MV2.hits = [];
  for (const l of LMS){ const [x, y] = toS(l.c[0], l.c[1]), dsc = isDisc(l.id), raid = !!l.raid;
    c.beginPath(); c.arc(x, y, 11 * fz, 0, TAU); c.fillStyle = dsc ? (raid ? 'rgba(120,20,40,.9)' : 'rgba(30,22,14,.85)') : 'rgba(30,22,14,.55)'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = raid ? '#ff5a8a' : dsc ? '#e9c87e' : 'rgba(233,200,126,.45)'; c.stroke();
    c.font = `${Math.round(12 * fz)}px sans-serif`; c.fillStyle = '#fff'; c.fillText(dsc ? (raid ? '♛' : LMI[l.type] || '★') : '?', x, y + 1);
    if (dsc && s > 0.6){ c.font = `700 ${Math.round(11 * fz)}px 'Gowun Batang'`; c.lineWidth = 3; c.strokeStyle = 'rgba(20,14,8,.8)'; c.strokeText(l.name, x, y + 19 * fz); c.fillStyle = raid ? '#ffb0c8' : '#fff3d6'; c.fillText(l.name, x, y + 19 * fz); }
    MV2.hits.push({ x, y, r: 13 * fz, kind: 'lm', o: l }); }
  // 룬 비석
  for (const w of WPS){ const on = wpOn(w.id); if (!on && !revealed(w.c[0], w.c[1])) continue; const [x, y] = toS(w.c[0], w.c[1]), hov = MV2.hov && MV2.hov.o === w, sel = MV2.sel === w.id, r = (hov || sel ? 11 : 8) * fz;
    c.save(); c.translate(x, y); c.rotate(Math.PI / 4); if (on){ c.shadowColor = '#7ff3ff'; c.shadowBlur = 12 + Math.sin(t * 3) * 4; } c.fillStyle = on ? '#7ff3ff' : '#8a8f9a'; c.fillRect(-r / 1.4, -r / 1.4, r * 1.41, r * 1.41); c.strokeStyle = on ? '#e8ffff' : '#444'; c.lineWidth = 1.5; c.strokeRect(-r / 1.4, -r / 1.4, r * 1.41, r * 1.41); c.restore();
    if (S.field.lastWp === w.id){ c.strokeStyle = 'rgba(127,243,255,.7)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r * 1.6 + Math.sin(t * 2) * 2, 0, TAU); c.stroke(); }
    if (s > 0.75 || hov || sel){ c.font = `700 ${Math.round(11 * fz)}px 'Noto Sans KR'`; c.lineWidth = 3; c.strokeStyle = 'rgba(8,20,26,.85)'; c.strokeText(w.name, x, y - 16 * fz); c.fillStyle = on ? '#bff8ff' : '#c8ccd2'; c.fillText(w.name, x, y - 16 * fz); }
    MV2.hits.push({ x, y, r: 14 * fz, kind: 'wp', o: w }); }
  // 퀘스트 표시 · 필드 보스
  for (const m of G.mapMarkers || []){ const [x, y] = toS(m.x, m.z), r = 7 + Math.sin(t * 4) * 1.5; c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.shadowColor = '#ffd36a'; c.shadowBlur = 14; c.fillStyle = m.c || '#ffd36a'; c.fillRect(-r / 1.4, -r / 1.4, r * 1.41, r * 1.41); c.restore(); }
  const wb = F.worldBoss; if (wb && wb.alive !== false){ const [x, y] = toS(wb.e ? wb.e.pos.x : wb.x, wb.e ? wb.e.pos.z : wb.z); c.font = `${Math.round(18 * fz)}px sans-serif`; c.fillText('💀', x, y); }
  // 플레이어
  if (F.inField){ const p = X.player.pos, [x, y] = toS(p.x, p.z), a = X.fig.root.rotation.y; c.save(); c.translate(x, y); c.rotate(-a + Math.PI); c.shadowColor = '#7ff3ff'; c.shadowBlur = 14; c.fillStyle = '#7ff3ff'; c.strokeStyle = '#06303a'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, -13); c.lineTo(9, 9); c.lineTo(0, 4); c.lineTo(-9, 9); c.closePath(); c.fill(); c.stroke(); c.restore();
    c.strokeStyle = 'rgba(127,243,255,.5)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 18 + (t * 14) % 14, 0, TAU); c.stroke(); }
  // 나침반 · 축척
  { const x = innerWidth - 70, y = innerHeight - (innerWidth > 760 ? 170 : 130); c.font = "700 13px 'Cinzel'"; c.fillStyle = '#e9c87e'; c.fillText('N', x, y - 26); c.strokeStyle = '#e9c87e'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y - 18); c.lineTo(x + 6, y); c.lineTo(x, y + 18); c.lineTo(x - 6, y); c.closePath(); c.stroke(); c.fillStyle = '#c84a3a'; c.beginPath(); c.moveTo(x, y - 18); c.lineTo(x + 6, y); c.lineTo(x - 6, y); c.closePath(); c.fill();
    const m = s > 1.5 ? 50 : s > 0.6 ? 100 : 200, L = m * s, bx = innerWidth > 760 ? 236 : 16, by = innerHeight - (innerWidth > 760 ? 24 : 80); c.fillStyle = 'rgba(16,20,34,.7)'; c.fillRect(bx - 6, by - 16, L + 12, 24); c.strokeStyle = '#fff3d6'; c.beginPath(); c.moveTo(bx, by - 4); c.lineTo(bx, by); c.lineTo(bx + L, by); c.lineTo(bx + L, by - 4); c.stroke(); c.font = "600 10px 'Noto Sans KR'"; c.fillStyle = '#fff3d6'; c.fillText(m + 'm', bx + L / 2, by - 9); }
}
function sideList(){
  const list = WPS.filter(w => wpOn(w.id));
  mSide.innerHTML = `<h4>FAST TRAVEL</h4><small>깨운 룬 비석 ${list.length} / ${WPS.length}</small>` + WPS.map(w => { const on = wpOn(w.id), r = F.regionAt(w.c[0], w.c[1]); return on || revealed(w.c[0], w.c[1]) ? `<button data-w="${w.id}" class="${on ? '' : 'off'} ${MV2.sel === w.id ? 'sel' : ''}">◆ ${w.name}<span>${on ? `${r.name} · Lv.${r.lv[0]}~${r.lv[1]}` : '아직 잠든 비석'}</span></button>` : ''; }).join('');
}
function askTravel(id){
  const w = byId('waypoints', id); if (!w) return; MV2.sel = id; sideList();
  if (!wpOn(id)){ mCf.querySelector('.q').textContent = `${w.name} — 잠든 룬 비석`; mCf.querySelector('.w').textContent = '직접 찾아가 비석을 깨워야 빠른 이동을 할 수 있어요'; mCf.querySelector('.y').style.display = 'none'; mCf.classList.add('on'); return; }
  const busy = !F.inField ? '모험의 대지 안에서만 이동할 수 있어요' : enemiesNear(X.player.pos.x, X.player.pos.z) ? '주변에 나를 노리는 적이 있어 이동할 수 없어요' : '';
  mCf.querySelector('.q').textContent = `「${w.name}」 룬 비석으로 이동할까요?`; mCf.querySelector('.w').textContent = busy; mCf.querySelector('.y').style.display = busy ? 'none' : '';
  MV2.pend = id; mCf.classList.add('on');
}
mCf.querySelector('.y').onclick = () => { const id = MV2.pend; mCf.classList.remove('on'); if (id) travelTo(id); };
mCf.querySelector('.n').onclick = () => { mCf.classList.remove('on'); MV2.pend = null; };
mSide.onclick = e => { const b = e.target.closest('button'); if (!b) return; const w = byId('waypoints', b.dataset.w); MV2.cx = w.c[0]; MV2.cz = w.c[1]; MV2.s = Math.max(MV2.s, 1); clampView(); askTravel(w.id); drawWorldMap(); };
MW.querySelector('.x').onclick = () => closeMap();
MW.querySelector('.zm').onclick = e => { const z = e.target.dataset && e.target.dataset.z; if (z == null) return; if (z === '0'){ MV2.cx = X.player.pos.x; MV2.cz = X.player.pos.z; MV2.s = Math.max(MV2.s, 0.9); } else MV2.s *= z === '1' ? 1.35 : 1 / 1.35; clampView(); drawWorldMap(); };
const ptrs = new Map(); let pinch = null, dragMoved = 0;
MC.addEventListener('pointerdown', e => { MC.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); dragMoved = 0; if (ptrs.size === 2){ const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: MV2.s }; } MC.classList.add('drag'); });
MC.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId);
  if (p){ const dx = e.clientX - p[0], dy = e.clientY - p[1]; p[0] = e.clientX; p[1] = e.clientY; dragMoved += Math.abs(dx) + Math.abs(dy);
    if (ptrs.size === 2 && pinch){ const [a, b] = [...ptrs.values()]; MV2.s = pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d; } else if (ptrs.size === 1){ MV2.cx -= dx / MV2.s; MV2.cz -= dy / MV2.s; }
    clampView(); drawWorldMap(); return; }
  let best = null, bd = 1e9; for (const h of MV2.hits || []){ const d = Math.hypot(h.x - e.clientX, h.y - e.clientY); if (d < h.r && d < bd){ bd = d; best = h; } }
  MV2.hov = best; MC.classList.toggle('hov', !!best);
  if (best){ const o = best.o; mTip.style.display = 'block'; mTip.style.left = e.clientX + 'px'; mTip.style.top = e.clientY + 'px';
    if (best.kind === 'wp') mTip.innerHTML = `<b>◆ ${o.name}</b>${wpOn(o.id) ? '룬 비석' : '잠든 룬 비석 — 찾아가서 깨우세요'}${wpOn(o.id) ? '<em>클릭: 빠른 이동</em>' : ''}`;
    else { const d = isDisc(o.id); mTip.innerHTML = d ? `<b>${LMI[o.type] || '★'} ${o.name}</b>${o.desc || ''}${o.raid ? '<em>♛ 레이드 입구</em>' : ''}` : '<b>? 미발견 장소</b>가까이 가 보면 무엇이 있는지 알 수 있어요'; } }
  else mTip.style.display = 'none';
});
const ptrUp = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; MC.classList.remove('drag');
  if (dragMoved < 8 && e.type === 'pointerup'){ let best = null, bd = 1e9; for (const h of MV2.hits || []){ const d = Math.hypot(h.x - e.clientX, h.y - e.clientY); if (d < h.r + 4 && d < bd){ bd = d; best = h; } } if (best && best.kind === 'wp') askTravel(best.o.id); } };
MC.addEventListener('pointerup', ptrUp); MC.addEventListener('pointercancel', ptrUp);
MW.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); const [wx, wz] = toW(e.clientX, e.clientY); MV2.s *= Math.exp(-e.deltaY * 0.0016); clampView(); const [nx, nz] = toW(e.clientX, e.clientY); MV2.cx += wx - nx; MV2.cz += wz - nz; clampView(); drawWorldMap(); }, { passive: false });
for (const ev of ['keydown', 'touchstart', 'touchmove']) MW.addEventListener(ev, e => e.stopPropagation(), { passive: true });
addEventListener('resize', () => { if (MV2.open){ mapResize(); clampView(); drawWorldMap(); } });
function openMap(o = {}){
  if (X.dialogOpen) return;
  MV2.open = true; MW.classList.add('on'); mapResize(); mCf.classList.remove('on'); MV2.sel = o.focus || null; MV2.travel = !!o.travel;
  const p = X.player.pos, f = o.focus && byId('waypoints', o.focus); MV2.cx = f ? f.c[0] : F.inField ? p.x : 0; MV2.cz = f ? f.c[1] : F.inField ? p.z : 0; MV2.s = o.focus ? 0.95 : Math.max(minS(), 0.75);
  clampView(); const r = F.inField ? F.regionAt(p.x, p.z) : null;
  const tod = todNow(), hh = Math.floor(tod * 24), mm = Math.floor((tod * 24 - hh) * 60), tIcon = tod < 0.19 || tod > 0.81 ? '🌙' : tod < 0.28 ? '🌅' : tod > 0.72 ? '🌇' : '☀';
  MW.querySelector('.c').textContent = r ? `${r.name} · ${r.safe ? '안전 지대' : `권장 Lv.${r.lv[0]}~${r.lv[1]}`} · 탐험 ${Math.round(FOG.reduce((a, b) => a + b, 0) / FOG.length * 100)}% · ${tIcon} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : '모험의 대지';
  sideList(); drawWorldMap(); X.sfx('ui'); if (mapBtn) mapBtn.classList.remove('dot');
}
function closeMap(){ if (!MV2.open) return; MV2.open = false; MW.classList.remove('on'); mTip.style.display = 'none'; mCf.classList.remove('on'); }
F.openWorldMap = openMap; F.closeWorldMap = closeMap;
const mapBtn = F.menu.add('🗺', '지도', () => MV2.open ? closeMap() : openMap(), 'M');
X.KEYH.push(code => {
  if (MV2.open && (code === 'KeyM' || code === 'Escape')){ closeMap(); return true; }
  if (code === 'KeyM' && F.inField){ openMap(); return true; }
  if (MV2.open && (code === 'Equal' || code === 'NumpadAdd' || code === 'Minus' || code === 'NumpadSubtract')){ MV2.s *= code === 'Equal' || code === 'NumpadAdd' ? 1.3 : 1 / 1.3; clampView(); drawWorldMap(); return true; }
  return false;
});
await drawRelief();

// ───────────────────────── 이름 붙은 지형 (떠 있는 이름 · 처음 다가가면 알림) ─────────────────────────
const TKIND = { cliff: '절벽', ridge: '능선', peak: '봉우리', mesa: '바위산', river: '물길' };
const TERR = W.namedTerrain.map(n => { let top = -1e9; for (let a = 0; a < TAU; a += 0.5) for (const r of [0, 8, 16]) top = Math.max(top, terrainH(n.c[0] + Math.cos(a) * r, n.c[1] + Math.sin(a) * r));
  return { n, label: F.label({ pos: new V3(n.c[0], top + (n.kind === 'river' ? 3 : 9), n.c[1]), text: n.name, sub: TKIND[n.kind] || '', cls: 'place', max: n.kind === 'peak' ? 320 : n.kind === 'river' ? 70 : 150 }) }; });
function terrTick(px, pz){ for (const t of TERR){ const n = t.n; if (S.field.terr[n.name]) continue; if (Math.hypot(px - n.c[0], pz - n.c[1]) < (n.kind === 'peak' || n.kind === 'ridge' ? 110 : 60)){ S.field.terr[n.name] = 1; X.save(); fogReveal(n.c[0], n.c[1], 60); F.note(`${NTI[n.kind] || '📍'} <b>${n.name}</b> · ${TKIND[n.kind] || '지형'}`, 4); } } }

// 광장의 「먼 산」 고리 메시(장면에 바로 붙어 있어요)가 대륙을 가로질러 보이지 않게, 필드에서는 숨겨요
const PLAZA_RING = G.scene.children.filter(o => o.isMesh && o.parent === G.scene && o.material && o.material.vertexColors && o.geometry && (o.geometry.boundingSphere || o.geometry.computeBoundingSphere() || o.geometry.boundingSphere) && o.geometry.boundingSphere.radius > 500);
// ───────────────────────── 매 프레임 ─────────────────────────
let chT = 0, vegX = 1e9, vegZ = 1e9, moodT = 0, fogT = 0, mapT = 0, wasIn = false;
const _tv = new V3();
function updateChunks(cam){
  const view = Math.min(1750, 2.1 / Math.max(0.0012, G.scene.fog.density) + 160);
  for (const c of CHUNKS){ const d = Math.max(0, Math.hypot(c.cx - cam.x, c.cz - cam.z) - 141); const vis = d < view; c.mesh.visible = vis; if (!vis) continue;
    const lod = d < 190 ? 0 : d < 520 ? 1 : 2; if (lod !== c.lod){ c.lod = lod; c.mesh.geometry = c.lods[lod]; } c.mesh.castShadow = d < 30 && !LOW; }
  for (const w of WCH){ const d = Math.max(0, Math.hypot(w.cx - cam.x, w.cz - cam.z) - (w.big || 141)); w.mesh.visible = d < view; }
}
function playerTick(dt){
  const pl = X.player, p = pl.pos;
  if (LIFT){ updateLift(dt); peakY = null; gliding = false; return; }
  const h = H(p.x, p.z), wl = waterY(p.x, p.z), dep = isIce(p.x, p.z) ? 0 : wl - h;
  swimming = dep > 1.05 && p.y < wl - 0.85; wading = !swimming && dep > 0.18 && p.y < wl + 0.1;
  const gy = F.groundFn(p.x, p.z), air = p.y - gy;
  if (!gliding){
    if (S.field.glider && !pl.ground && pl.vy < -1.2 && air > 2.2 && jumpHeld() && !swimming && !G.lock && !X.dead){ gliding = true; glY = p.y; gspd = Math.max(5.5, pl.speed); X.sfx('puff'); }
    else if (!S.field.glider && !pl.ground && air > 6 && pl.vy < -6 && !glideHint && jumpHeld()){ glideHint = true; X.hint('바람개비 언덕의 <b>바람 상인 제피</b>에게 글라이더를 받으면 하늘을 날 수 있어요', 5); }
  } else if (!jumpHeld() || pl.ground || air < 0.25 || swimming || G.lock || X.dead){ gliding = false; }
  glideK += ((gliding ? 1 : 0) - glideK) * Math.min(1, dt * (gliding ? 9 : 12));
  GLIDER.visible = glideK > 0.03; if (GLIDER.visible){ const e = glideK; GLIDER.scale.set(GSC0 * e * (1 + 0.12 * Math.sin(e * Math.PI)), GSC0 * e, GSC0 * e); GLIDER.rotation.z = gliding ? Math.sin(G.time * 1.3) * 0.05 : 0; }
  if (gliding){
    let vy = -2.2, lift = 0;
    for (const u of UPDRAFTS){ const d = Math.hypot(p.x - u.x, p.z - u.z); if (d < u.r * 1.25 && p.y < u.top + 4){ const k = 1 - sst(u.r * 0.85, u.r * 1.25, d); lift = Math.max(lift, k); vy = lerp(vy, 12 * (1 - sst(u.top - 14, u.top + 4, p.y)) + 0.4, k); if (Math.random() < 0.3) X.emit(p.x + (Math.random() - 0.5) * 3, p.y - 1, p.z + (Math.random() - 0.5) * 3, 0, 6, 0, 0xeafcff, 0.22, 0.7, { drag: 0.5 }); } }
    glY += vy * dt; p.y = Math.max(glY, gy); glY = p.y; pl.vy = 0;
    const want = lerp(G.keys.ShiftLeft || G.keys.ShiftRight ? 11.5 : 9, 3.2, lift); gspd += (want - gspd) * Math.min(1, dt * 1.6);
    const yaw = X.fig.root.rotation.y; p.x += Math.sin(yaw) * gspd * dt; p.z += Math.cos(yaw) * gspd * dt; G.collide(p, 0.36);
    G.moveMul = 0; pl.speed = 0; X.fig.root.position.copy(p); peakY = p.y;
    if (Math.random() < 0.55){ for (const sx of [-1.7, 1.7]){ _tv.set(sx, 3.25, -0.2); X.fig.root.localToWorld(_tv); X.emit(_tv.x, _tv.y, _tv.z, -Math.sin(yaw) * 2, 0, -Math.cos(yaw) * 2, 0xf4fbff, 0.12, 0.55, { drag: 2 }); } }
  }
  F.gliding = gliding; F.swimming = swimming;
  { const ft = gliding ? 62 : 55, cam = G.camera; if (Math.abs(cam.fov - ft) > 0.05){ cam.fov += (ft - cam.fov) * Math.min(1, dt * 2.2); cam.updateProjectionMatrix(); } }
  if (swimming){ G.moveMul *= 0.6; G.noJump = true; } else if (wading) G.moveMul *= 0.8;
  // 물결 고리 · 물보라
  const inW = swimming || wading;
  for (const r of RIPS){ r.m.visible = inW; if (!inW) continue; r.t = (r.t + dt * (pl.speed > 0.5 ? 1.1 : 0.6)) % 1; const s = 0.5 + r.t * 2.4; r.m.scale.set(s, 1, s); r.m.position.set(p.x, wl + 0.04, p.z); r.m.material.opacity = (1 - r.t) * (swimming ? 0.45 : 0.3); }
  if (inW && pl.speed > 1.2 && Math.random() < 0.5) X.emit(p.x + (Math.random() - 0.5) * 0.8, wl + 0.1, p.z + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.5, 1.6 + Math.random(), (Math.random() - 0.5) * 1.5, 0xeaf8ff, 0.16, 0.5, { grav: -7, drag: 0.5 });
  // 낙하 피해 (14m 넘게 떨어지면, 글라이더 · 물은 괜찮아요)
  if (!pl.ground && !swimming){ peakY = peakY == null ? p.y : Math.max(peakY, p.y); wasAir = true; }
  else { if (wasAir && peakY != null && !swimming && !X.dead){ const drop = peakY - p.y; if (drop > 14){ const d = X.D(), dmg = d.maxHp * Math.min(0.45, 0.04 + (drop - 14) * 0.022); X.hurtPlayer(dmg, null, 0); F.note(`💥 낙하 피해 · ${Math.round(drop)}m`); X.burst(new V3(p.x, 0.2, p.z), 0xc8b090, 24, 4, 0.3, 0.6, -6, 1); G.shake = Math.max(G.shake, 0.9); } } wasAir = false; peakY = p.y; }
  // 너무 가파른 곳: 미끄러져 내려가요
  if (pl.ground && !swimming && !gliding && gy < h + 0.05){ const e = 0.8, gx = H(p.x + e, p.z) - H(p.x - e, p.z), gz = H(p.x, p.z + e) - H(p.x, p.z - e), s = Math.hypot(gx, gz) / (2 * e);
    if (s > 1.4){ slideT += dt; const k = Math.min(7, 2 + slideT * 6) * dt, gl = Math.hypot(gx, gz); p.x -= gx / gl * k; p.z -= gz / gl * k; G.collide(p, 0.36); lastX = p.x; lastZ = p.z; } else slideT = 0; }
}
G.hooks.push((dt, rdt) => {
  TIMEU.value = G.time;
  if (!F.inField){
    if (wasIn){ wasIn = false; for (const o of PLAZA_RING) o.visible = true; gliding = false; GLIDER.visible = false; glideK = 0; swimming = wading = false; F.gliding = F.swimming = false; for (const r of RIPS) r.m.visible = false; if (LIFT){ LIFT = null; boundOff = false; G.lock = false; } closeMap(); }
    if (MV2.open){ mapT -= rdt; if (mapT <= 0){ mapT = 0.1; drawWorldMap(); } }
    F.timeOfDay = todNow(); return;
  }
  if (!wasIn){ wasIn = true; for (const o of PLAZA_RING) o.visible = false; vegX = 1e9; gcx = 1e9; chT = 0; moodInit = false; lastX = null; peakY = null; regM.fill(0); }
  const p = X.player.pos, cam = G.camera.position;
  chT -= rdt; if (chT <= 0){ chT = 0.25; updateChunks(cam); }
  if (Math.hypot(p.x - vegX, p.z - vegZ) > 10){ vegX = p.x; vegZ = p.z; refreshVeg(p.x, p.z); }
  if (Math.hypot(p.x - gcx, p.z - gcz) > 5) refreshGrass(p.x, p.z);
  GRUNI.uP.value.copy(p);
  moodT -= rdt; if (moodT <= 0){ moodTick(Math.max(0.1, -moodT + 0.1), p.x, p.y, p.z); moodT = 0.1; }
  ambTick(rdt);
  STARS.position.copy(cam); STARS.material.uniforms.uOp.value = NIGHTK * 0.95; STARS.visible = NIGHTK > 0.02;
  MOON.s.visible = MOON.h.visible = NIGHTK > 0.03 && MOONV.y > -0.05; if (MOON.s.visible){ MOON.s.position.copy(cam).addScaledVector(MOONV, 1500); MOON.h.position.copy(MOON.s.position); MOON.s.material.opacity = NIGHTK; MOON.h.material.opacity = NIGHTK * 0.25; }
  playerTick(dt);
  if (G.poseMod !== myMod){ baseMod = G.poseMod; G.poseMod = myMod; }
  fogT -= rdt; if (fogT <= 0){ fogT = 0.4; fogReveal(p.x, p.z); terrTick(p.x, p.z);
    for (const w of WPS) if (w.id !== S.field.lastWp && wpOn(w.id) && Math.hypot(p.x - w.c[0], p.z - w.c[1]) < 5.5){ S.field.lastWp = w.id; X.save(); F.note(`🔷 부활 지점: <b>${w.name}</b>`); for (const k in WPV) styleWp(WPV[k]); } fogSaveT -= 0.4; if (fogChanged && fogSaveT <= 0){ fogSaveT = 8; fogSave(); } }
  // 룬 비석 · 폭포 물보라 · 승강 룬 연출
  for (const id in WPV){ const v = WPV[id]; if (!v.crys.visible) continue; v.crys.rotation.y += dt * 0.9; v.crys.position.y = 8.2 + Math.sin(G.time * 1.3 + v.w.c[0]) * 0.22; v.ring.rotation.y -= dt * 0.15;
    const d = Math.hypot(v.w.c[0] - cam.x, v.w.c[1] - cam.z); v.beam.material.uniforms.uOp.value = Math.max(0.12, Math.min(0.75, (d - 20) / 160)) * (wakeFx && wakeFx.v === v ? Math.min(1, wakeFx.t) : 1); }
  if (wakeFx){ wakeFx.t += dt; const k = Math.min(1, wakeFx.t / 1.2), e = 1 - Math.pow(1 - k, 3); wakeFx.v.crys.scale.setScalar(e); wakeFx.v.glow.material.opacity = 0.6 + (1 - k) * 0.8; wakeFx.v.glow.scale.setScalar(5 + (1 - k) * 10); if (wakeFx.t > 1.6){ wakeFx.v.glow.scale.setScalar(5); wakeFx.v.glow.material.opacity = 0.6; wakeFx = null; } }
  for (const f of FALLS){ if (Math.hypot(f.x - p.x, f.z - p.z) > (f.big ? 160 : 90)) continue; if (Math.random() < (f.big ? 0.9 : 0.25)) X.emit(f.x + (Math.random() - 0.5) * f.w, f.bot + 0.3, f.z + (Math.random() - 0.5) * f.w * 0.6, (Math.random() - 0.5) * 2, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 2, 0xf4fbff, f.big ? 1.6 + Math.random() * 1.6 : 0.6, 1.4, { grow: 1.6, drag: 1, a: 0.5 }); }
  for (const o of LIFTV){ o.a.ring.rotation.y += dt * 0.6; o.b.ring.rotation.y -= dt * 0.6; }
  for (const u of UPDRAFTS){ if (u.sw) u.sw.rotation.y += dt * 0.4; if (u.wr) u.wr.rotation.y -= dt * 0.25; }
  if (MV2.open){ mapT -= rdt; if (mapT <= 0){ mapT = 0.07; drawWorldMap(); } }
});
BUS.on('enterField', d => { if (d && (d.warp || d.revive)) cancelLift(); lastX = null; peakY = null; wasAir = false; vegX = 1e9; gcx = 1e9; chT = 0; if (d && (d.warp || d.revive)){ gliding = false; } if (d && d.warp && pendFace != null){ X.fig.root.rotation.y = pendFace; G.setCam(pendFace + Math.PI, 0.3); } pendFace = null; fogReveal(d ? d.x : X.player.pos.x, d ? d.z : X.player.pos.z); });
BUS.on('leaveField', () => { gliding = false; GLIDER.visible = false; closeMap(); if (fogChanged) fogSave(); if (G.camera.fov !== 55){ G.camera.fov = 55; G.camera.updateProjectionMatrix(); } });
BUS.on('discover', d => { if (d && d.kind === 'landmark'){ const l = byId('landmarks', d.id); if (l) fogReveal(l.c[0], l.c[1], l.r + 50); } });

// ───────────────────────── 모듈 API ─────────────────────────
const spiralAt = (id, s) => { const sp = byId('spirals', id) || SPIR[0], a = sp.start + s * sp.turns * TAU, r = lerp(sp.r0, sp.r1, s), x = sp.c[0] + Math.cos(a) * r, z = sp.c[1] + Math.sin(a) * r; return [x, H(x, z), z]; };
F.spiralAt = spiralAt; F.terrainReady = true;
console.log(`[world] veg ${Math.round(TV - TW)}ms (${Object.values(VT).reduce((a, t) => a + t.n, 0)}) · total ${Math.round(performance.now() - T0)}ms`);
return {
  H, terrainH, waterY, isIce, isWater: F.isWater, waterDepth: F.waterDepth, groundFn: F.groundFn, roadDist: F.roadDist, slope: F.slope, biomeAt: F.biomeAt,
  bridges: BRIDGES, fords: FORDS, updrafts: UPDRAFTS, falls: FALLS.map(f => ({ x: f.x, z: f.z, top: f.top, bot: f.bot, w: f.w, name: f.name })), spiralAt,
  discoverWaypoint: F.discoverWaypoint, travelTo, openWorldMap: openMap, closeWorldMap: closeMap, unlockGlider: F.unlockGlider, setTimeOfDay: F.setTimeOfDay, fogRevealed: revealed,
  get timeOfDay(){ return F.timeOfDay; }, isNight: F.isNight, get gliding(){ return gliding; }, get swimming(){ return swimming; }, get wading(){ return wading; },
  _dbg: { HG, WLV, RDD, CHUNKS, VT, WCH, FALLS, REL, refreshVeg, refreshGrass, drawWorldMap, MV2 },
};
}
