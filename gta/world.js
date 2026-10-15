// =====================================================================
//  도시: 도로 · 건물 · 소품 · 충돌 · 신호등
//  좌표: x 동쪽, z 남쪽, 1 = 1m.  도로는 100m 격자, 4차선(우측통행)
// =====================================================================
'use strict';
(function(){
const U = G.U;
const W = G.world = {};
const CELL = 100, N = 14, HALF = 700, RW = 7, SWK = 4, CURB = .15;
const X = i=>-HALF + i*CELL;
Object.assign(W, { CELL, N, HALF, RW, SWK, CURB, X, LAND:790 });

// ---------------------------------------------------------------------
//  지구 · 특수 건물
// ---------------------------------------------------------------------
function district(ci, cj){
  if (ci >= 1 && ci <= 2 && cj >= 6 && cj <= 8) return 'park';
  if (ci >= 12) return 'ind';
  if (cj === 13) return 'beach';
  if (ci >= 5 && ci <= 8 && cj >= 5 && cj <= 8) return 'down';
  if (ci <= 4 && cj <= 5) return 'res';
  if (ci >= 9 && cj <= 3) return 'rich';
  return 'mid';
}
W.district = (x, z)=>{ const ci = Math.floor((x + HALF)/CELL), cj = Math.floor((z + HALF)/CELL); if (ci < 0 || cj < 0 || ci >= N || cj >= N) return z > HALF ? 'beach' : x > HALF ? 'ind' : 'hills'; return district(ci, cj); };
const DNAME = { park:'루나 공원', ind:'항만 공업지구', beach:'선셋 비치', down:'다운타운', res:'메이플 주택가', rich:'바인우드 언덕', mid:'미드타운', hills:'북부 언덕' };
W.areaName = (x, z)=>DNAME[W.district(x, z)] || '산 루나';
const SPECIAL = { '9,9':'police', '3,4':'hospital', '10,6':'gunshop', '6,9':'clothes', '6,6':'bank', '2,11':'gas', '11,1':'gas', '10,11':'spray', '4,10':'safe', '8,10':'diner', '3,2':'gunshop2', '11,8':'garage' };
W.specials = [];

// ---------------------------------------------------------------------
//  도로망
// ---------------------------------------------------------------------
const removed = new Set();
const ek = (a, b, c, d)=>a + ',' + b + '-' + c + ',' + d;
// 공원 안쪽 도로 없앰
for (let j = 6; j <= 8; j++) removed.add(ek(2, j, 2, j + 1));
for (const j of [7, 8]) for (let i = 1; i <= 2; i++) removed.add(ek(i, j, i + 1, j));
W.hasEdge = (i, j, i2, j2)=>{ if (i < 0 || j < 0 || i2 > N || j2 > N) return false; if (i2 < i || j2 < j) return !removed.has(ek(i2, j2, i, j)); return !removed.has(ek(i, j, i2, j2)); };
// 교차로 (도로 2개 이상 연결)
W.nodes = []; W.nodeAt = {};
for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++){
  const nb = [];
  if (W.hasEdge(i, j, i + 1, j)) nb.push([i + 1, j]); if (W.hasEdge(i - 1, j, i, j)) nb.push([i - 1, j]);
  if (W.hasEdge(i, j, i, j + 1)) nb.push([i, j + 1]); if (W.hasEdge(i, j - 1, i, j)) nb.push([i, j - 1]);
  if (!nb.length) continue;
  const n = { i, j, x:X(i), z:X(j), nb, sig:nb.length >= 3, off:((i*7 + j*13)%5)*4 }; W.nodes.push(n); W.nodeAt[i + ',' + j] = n;
}
// 도로 위인가?
W.onRoad = (x, z)=>{
  const fi = (x + HALF)/CELL, fj = (z + HALF)/CELL; const i = Math.round(fi), j = Math.round(fj);
  const dx = Math.abs(x - X(i)), dz = Math.abs(z - X(j));
  if (dx < RW && i >= 0 && i <= N){ const jj = Math.floor(fj); if (W.hasEdge(i, jj, i, jj + 1) || (dz < RW && W.nodeAt[i + ',' + j])) return true; }
  if (dz < RW && j >= 0 && j <= N){ const ii = Math.floor(fi); if (W.hasEdge(ii, j, ii + 1, j) || (dx < RW && W.nodeAt[i + ',' + j])) return true; }
  return false;
};
W.inWater = (x, z)=>x > W.LAND + 2 || z > W.LAND + 2 || x < -1500 || z < -1500;
W.groundY = (x, z)=>{ if (W.inWater(x, z)) return -1.2; if (W.onRoad(x, z)) return 0; const r = W.rampY(x, z); return Math.max(r, z > 760 ? CURB - (z - 760)*.04 : CURB); };
// 신호등: 0 = 동서 초록, 1 = 동서 노랑, 2 = 남북 초록, 3 = 남북 노랑
W.sigState = (n, t)=>{ const c = (t + n.off)%24; return c < 10 ? 0 : c < 12 ? 1 : c < 22 ? 2 : 3; };
// 방향(ax: 'x' 동서 / 'z' 남북)이 지금 지나가도 되나
W.canGo = (n, ax, t)=>{ if (!n || !n.sig) return 2; const s = W.sigState(n, t); return ax === 'x' ? (s === 0 ? 2 : s === 1 ? 1 : 0) : (s === 2 ? 2 : s === 3 ? 1 : 0); };

// ---------------------------------------------------------------------
//  충돌: 상자 + 기둥(원)
// ---------------------------------------------------------------------
const HC = 20, HASH = new Map(), PHASH = new Map();
W.boxes = []; W.posts = [];
const hk = (a, b)=>a*10007 + b;
W.addBox = (x0, z0, x1, z1, y1, o)=>{ const b = Object.assign({ x0:Math.min(x0, x1), x1:Math.max(x0, x1), z0:Math.min(z0, z1), z1:Math.max(z0, z1), y0:0, y1 }, o || {}); W.boxes.push(b);
  for (let a = Math.floor(b.x0/HC); a <= Math.floor(b.x1/HC); a++) for (let c = Math.floor(b.z0/HC); c <= Math.floor(b.z1/HC); c++){ const k = hk(a, c); let l = HASH.get(k); if (!l) HASH.set(k, l = []); l.push(b); } return b; };
W.addPost = (x, z, r, o)=>{ const p = Object.assign({ x, z, r, h:3, alive:true }, o || {}); W.posts.push(p); const k = hk(Math.floor(x/HC), Math.floor(z/HC)); let l = PHASH.get(k); if (!l) PHASH.set(k, l = []); l.push(p); return p; };
W.nearBoxes = (x, z, r)=>{ const out = new Set(); for (let a = Math.floor((x - r)/HC); a <= Math.floor((x + r)/HC); a++) for (let c = Math.floor((z - r)/HC); c <= Math.floor((z + r)/HC); c++){ const l = HASH.get(hk(a, c)); if (l) for (const b of l) out.add(b); } return out; };
W.nearPosts = (x, z, r)=>{ const out = []; for (let a = Math.floor((x - r)/HC); a <= Math.floor((x + r)/HC); a++) for (let c = Math.floor((z - r)/HC); c <= Math.floor((z + r)/HC); c++){ const l = PHASH.get(hk(a, c)); if (l) for (const p of l) if (p.alive) out.push(p); } return out; };
// 원(x,z,r)을 건물 밖으로 밀어냄. y 는 발 높이 (낮은 담 위로는 지나감)
W.pushCircle = (x, z, r, y)=>{ y = y || 0; let px = 0, pz = 0, hit = null;
  for (const b of W.nearBoxes(x, z, r + 1)){ if (y > b.y1 - .3 || y + 1.6 < b.y0) continue;
    const cx = U.clamp(x + px, b.x0, b.x1), cz = U.clamp(z + pz, b.z0, b.z1); let dx = x + px - cx, dz = z + pz - cz; const d2 = dx*dx + dz*dz;
    if (d2 < r*r){ if (d2 < 1e-8){ // 중심이 안에 들어감 → 가장 가까운 면으로
        const l = x + px - b.x0, rr = b.x1 - x - px, t = z + pz - b.z0, bb = b.z1 - z - pz, m = Math.min(l, rr, t, bb);
        if (m === l) px -= l + r; else if (m === rr) px += rr + r; else if (m === t) pz -= t + r; else pz += bb + r; }
      else { const d = Math.sqrt(d2); px += dx/d*(r - d); pz += dz/d*(r - d); } hit = b; } }
  return hit ? { x:px, z:pz, box:hit } : null; };
W.pushPosts = (x, z, r)=>{ let px = 0, pz = 0, hit = null; for (const p of W.nearPosts(x, z, r + 1)){ const dx = x + px - p.x, dz = z + pz - p.z, d = Math.hypot(dx, dz), m = r + p.r; if (d < m && d > 1e-6){ px += dx/d*(m - d); pz += dz/d*(m - d); hit = p; } } return hit ? { x:px, z:pz, post:hit } : null; };
// 광선: 건물 상자에 맞는 거리 (없으면 Infinity)
W.raycast = (o, d, maxD)=>{ let best = maxD, nrm = null, bb = null; const seen = new Set();
  const steps = Math.ceil(maxD/(HC*.5)); for (let s = 0; s <= steps; s++){ const t = Math.min(maxD, s*HC*.5); const px = o.x + d.x*t, pz = o.z + d.z*t;
    const l = HASH.get(hk(Math.floor(px/HC), Math.floor(pz/HC))); if (!l) continue;
    for (const b of l){ if (seen.has(b)) continue; seen.add(b);
      let t0 = 0, t1 = best, n = 0;
      for (let ax = 0; ax < 3; ax++){ const oo = ax === 0 ? o.x : ax === 1 ? o.y : o.z, dd = ax === 0 ? d.x : ax === 1 ? d.y : d.z, lo = ax === 0 ? b.x0 : ax === 1 ? b.y0 : b.z0, hi = ax === 0 ? b.x1 : ax === 1 ? b.y1 : b.z1;
        if (Math.abs(dd) < 1e-9){ if (oo < lo || oo > hi){ t0 = Infinity; break; } continue; }
        let ta = (lo - oo)/dd, tb = (hi - oo)/dd, na = -(ax + 1); if (ta > tb){ const q = ta; ta = tb; tb = q; na = ax + 1; } if (ta > t0){ t0 = ta; n = na; } if (tb < t1) t1 = tb; if (t0 > t1){ t0 = Infinity; break; } }
      if (t0 < best && t0 >= 0 && t0 !== Infinity){ best = t0; nrm = n; bb = b; } }
    if (bb && best < t) break; }
  // 땅
  if (d.y < -1e-6){ const tg = (W.groundY(o.x, o.z) - o.y)/d.y; if (tg > 0 && tg < best){ best = tg; nrm = 2; bb = null; } }
  return best < maxD ? { t:best, n:nrm, box:bb } : null; };

// ---------------------------------------------------------------------
//  점프대
// ---------------------------------------------------------------------
W.ramps = [];
function addRamp(x, z, ang, len, wid, h, name){ W.ramps.push({ x, z, ang, len, wid, h, c:Math.cos(ang), s:Math.sin(ang), name }); }
W.rampY = (x, z)=>{ for (const r of W.ramps){ const dx = x - r.x, dz = z - r.z; if (dx*dx + dz*dz > (r.len + r.wid)*(r.len + r.wid)) continue;
  const f = dx*r.s + dz*r.c, sd = dx*r.c - dz*r.s; if (f >= 0 && f <= r.len && Math.abs(sd) <= r.wid/2) return CURB*0 + f/r.len*r.h; } return 0; };

// =====================================================================
//  텍스처 (캔버스로 그림)
// =====================================================================
const TX = {};
function cv(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function noiseFill(x, w, h, base, amp, n){ x.fillStyle = base; x.fillRect(0, 0, w, h); for (let i = 0; i < (n || w*h/6); i++){ const v = Math.random(); x.fillStyle = 'rgba(' + (v < .5 ? '0,0,0' : '255,255,255') + ',' + (Math.random()*amp).toFixed(3) + ')'; const s = Math.random() < .9 ? 1 : 2; x.fillRect(Math.random()*w, Math.random()*h, s, s); } }
function grime(x, w, h, k){ for (let i = 0; i < 30*k; i++){ const gx = Math.random()*w, gy = Math.random()*h, r = 10 + Math.random()*60; const g = x.createRadialGradient(gx, gy, 0, gx, gy, r); g.addColorStop(0, 'rgba(40,35,30,' + (.05*k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(40,35,30,0)'); x.fillStyle = g; x.fillRect(gx - r, gy - r, r*2, r*2); }
  for (let i = 0; i < 40*k; i++){ x.fillStyle = 'rgba(30,25,20,' + (Math.random()*.06*k).toFixed(3) + ')'; x.fillRect(Math.random()*w, Math.random()*h, 1 + Math.random()*2, 20 + Math.random()*80); } }
function mkTex(c, rep, srgb){ const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = rep === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; if (srgb !== false) t.encoding = THREE.sRGBEncoding; t.anisotropy = G.LOW ? 2 : 8; return t; }
// 색 + 창문 마스크(알파)를 합친 텍스처
function withMask(color, mask){ const w = color.width, h = color.height; const a = color.getContext('2d').getImageData(0, 0, w, h), m = mask.getContext('2d').getImageData(0, 0, w, h); for (let i = 0; i < a.data.length; i += 4) a.data[i + 3] = 200 + Math.round(m.data[i]*55/255); /* 알파 0 이면 캔버스가 색을 지워서 200~255 로 */ const [c, x] = cv(w, h); x.putImageData(a, 0, 0); return c; }

// 파사드: 한 장 = 4칸 × 4층
function facade(kind){
  const S = 512, B = 4, F = 4, cw = S/B, ch = S/F; const [c, x] = cv(S, S), [mc, mx] = cv(S, S); mx.fillStyle = '#000'; mx.fillRect(0, 0, S, S);
  const win = (wx, wy, ww, wh, frame, frameCol)=>{ // 유리 + 마스크
    const g = x.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, '#5a6a7a'); g.addColorStop(.5, '#2a3540'); g.addColorStop(1, '#1a2028'); x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
    x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.moveTo(wx, wy + wh*.7); x.lineTo(wx + ww*.6, wy); x.lineTo(wx + ww, wy); x.lineTo(wx + ww, wy + wh*.1); x.lineTo(wx + ww*.15, wy + wh); x.lineTo(wx, wy + wh); x.fill();
    mx.fillStyle = '#fff'; mx.fillRect(wx, wy, ww, wh);
    if (frame){ x.strokeStyle = frameCol || '#ddd'; x.lineWidth = frame; x.strokeRect(wx + frame/2, wy + frame/2, ww - frame, wh - frame); x.beginPath(); x.moveTo(wx + ww/2, wy); x.lineTo(wx + ww/2, wy + wh); x.stroke(); mx.strokeStyle = '#000'; mx.lineWidth = frame; mx.strokeRect(wx + frame/2, wy + frame/2, ww - frame, wh - frame); mx.beginPath(); mx.moveTo(wx + ww/2, wy); mx.lineTo(wx + ww/2, wy + wh); mx.stroke(); } };
  if (kind === 'glass' || kind === 'glass2'){
    for (let f = 0; f < F; f++) for (let b = 0; b < B; b++){ const gx = b*cw, gy = f*ch; const g = x.createLinearGradient(gx, gy, gx + cw, gy + ch);
      if (kind === 'glass'){ g.addColorStop(0, '#46708e'); g.addColorStop(1, '#1d3346'); } else { g.addColorStop(0, '#3a4a40'); g.addColorStop(1, '#141c1a'); }
      x.fillStyle = g; x.fillRect(gx, gy, cw, ch); mx.fillStyle = '#fff'; mx.fillRect(gx, gy, cw, ch);
      x.fillStyle = kind === 'glass' ? '#2a3a48' : '#222826'; x.fillRect(gx, gy + ch*.82, cw, ch*.18); mx.fillStyle = '#000'; mx.fillRect(gx, gy + ch*.82, cw, ch*.18); // 층 사이 띠
      x.fillStyle = '#8a96a0'; x.fillRect(gx, gy, 3, ch); x.fillRect(gx + cw/2 - 1, gy, 2, ch*.82); mx.fillRect(gx, gy, 3, ch); mx.fillRect(gx + cw/2 - 1, gy, 2, ch*.82); }
  } else if (kind === 'office'){
    noiseFill(x, S, S, '#b8b4aa', .08); for (let f = 0; f < F; f++){ x.fillStyle = '#a8a49a'; x.fillRect(0, f*ch + ch*.78, S, ch*.22); for (let b = 0; b < B; b++) win(b*cw + cw*.08, f*ch + ch*.12, cw*.84, ch*.6, 4, '#555'); } grime(x, S, S, 1);
  } else if (kind === 'brick'){
    x.fillStyle = '#7a4434'; x.fillRect(0, 0, S, S); for (let r = 0; r < S/8; r++) for (let k = 0; k < S/24 + 1; k++){ const v = 80 + Math.random()*40; x.fillStyle = 'rgb(' + (v + 50 | 0) + ',' + (v*.5 | 0) + ',' + (v*.38 | 0) + ')'; x.fillRect(k*24 - (r%2)*12 + 1, r*8 + 1, 22, 6); }
    for (let f = 0; f < F; f++) for (let b = 0; b < B; b++){ const wx = b*cw + cw*.25, wy = f*ch + ch*.18; x.fillStyle = '#c8c0b0'; x.fillRect(wx - 6, wy + ch*.56, cw*.5 + 12, 8); x.fillStyle = '#6a3a2c'; x.fillRect(wx - 4, wy - 10, cw*.5 + 8, 10); win(wx, wy, cw*.5, ch*.56, 5, '#e8e4dc'); } grime(x, S, S, 1.4);
  } else if (kind === 'stucco'){
    noiseFill(x, S, S, '#eae4d8', .06); for (let f = 0; f < F; f++) for (let b = 0; b < B; b++){ const wx = b*cw + cw*.22, wy = f*ch + ch*.2; x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(wx - 5, wy - 5, cw*.56 + 10, ch*.56 + 12); win(wx, wy, cw*.56, ch*.52, 4, '#fafafa');
      if ((f + b)%3 === 0){ x.fillStyle = '#4a3a30'; x.fillRect(wx - 3, wy + ch*.52, cw*.56 + 6, 5); for (let k = 0; k < 6; k++) x.fillRect(wx + k*cw*.1, wy + ch*.52, 3, 14); } } grime(x, S, S, .8);
  } else if (kind === 'hotel'){
    noiseFill(x, S, S, '#f0ece4', .05); for (let f = 0; f < F; f++){ for (let b = 0; b < B; b++) win(b*cw + cw*.12, f*ch + ch*.08, cw*.76, ch*.7, 3, '#ccc'); x.fillStyle = '#d8d4cc'; x.fillRect(0, f*ch + ch*.78, S, ch*.06); x.fillStyle = 'rgba(200,220,230,.55)'; x.fillRect(0, f*ch + ch*.5, S, ch*.28); x.fillStyle = '#ccc'; for (let k = 0; k < S; k += 8) x.fillRect(k, f*ch + ch*.5, 2, ch*.28); x.fillRect(0, f*ch + ch*.5, S, 3); } grime(x, S, S, .5);
  } else if (kind === 'ware'){
    for (let k = 0; k < S; k += 8){ const v = 120 + (k%16 ? 20 : -10) + Math.random()*10; x.fillStyle = 'rgb(' + (v*.9 | 0) + ',' + (v*.95 | 0) + ',' + v + ')'; x.fillRect(k, 0, 8, S); }
    x.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < S; k += 8) x.fillRect(k, 0, 1, S); for (let b = 0; b < B; b++) win(b*cw + 10, 10, cw - 20, 30, 2, '#888'); grime(x, S, S, 2);
    x.fillStyle = 'rgba(120,60,20,.15)'; for (let i = 0; i < 40; i++) x.fillRect(Math.random()*S, Math.random()*S, 2, 30 + Math.random()*90);
  } else if (kind === 'house'){
    noiseFill(x, S, S, '#f4f2ee', .04); for (let k = 0; k < S; k += 12){ x.fillStyle = 'rgba(0,0,0,.09)'; x.fillRect(0, k, S, 2); }
    for (let f = 0; f < F; f++) for (let b = 0; b < B; b++){ if ((b + f)%4 === 3) continue; const wx = b*cw + cw*.22, wy = f*ch + ch*.22; x.fillStyle = '#3a4a5a'; x.fillRect(wx - 16, wy, 12, ch*.5); x.fillRect(wx + cw*.56 + 4, wy, 12, ch*.5); win(wx, wy, cw*.56, ch*.5, 5, '#fff'); }
  }
  return mkTex(withMask(c, mc));
}
function plainTex(kind){
  if (TX[kind]) return TX[kind]; let c, x;
  if (kind === 'asphalt'){ [c, x] = cv(512, 512); noiseFill(x, 512, 512, '#3c3d3f', .12, 60000); for (let i = 0; i < 25; i++){ x.strokeStyle = 'rgba(20,20,20,.35)'; x.lineWidth = 1 + Math.random()*2; x.beginPath(); let px = Math.random()*512, py = Math.random()*512; x.moveTo(px, py); for (let k = 0; k < 6; k++){ px += (Math.random() - .5)*60; py += (Math.random() - .5)*60; x.lineTo(px, py); } x.stroke(); } for (let i = 0; i < 12; i++){ const gx = Math.random()*512, gy = Math.random()*512, r = 20 + Math.random()*50; const g = x.createRadialGradient(gx, gy, 0, gx, gy, r); g.addColorStop(0, 'rgba(15,15,15,.25)'); g.addColorStop(1, 'rgba(15,15,15,0)'); x.fillStyle = g; x.fillRect(gx - r, gy - r, 2*r, 2*r); } }
  else if (kind === 'road'){ // 가로 = 도로 폭 14m, 세로 = 28m
    [c, x] = cv(256, 512); x.drawImage(plainTex('asphalt').image, 0, 0, 256, 512); const m = 256/14;
    const paint = (fn)=>{ x.save(); fn(); x.restore(); };
    paint(()=>{ x.fillStyle = 'rgba(230,180,40,.9)'; x.fillRect(128 - .32*m, 0, .13*m, 512); x.fillRect(128 + .19*m, 0, .13*m, 512); x.fillStyle = 'rgba(235,235,235,.85)'; for (const u of [3.5, 10.5]) for (let v = 0; v < 512; v += 512/4) x.fillRect(u*m - .07*m, v, .14*m, 512/8); x.fillRect(.35*m, 0, .15*m, 512); x.fillRect(14*m - .5*m, 0, .15*m, 512); });
    x.globalCompositeOperation = 'multiply'; noiseFill(x, 256, 512, 'rgba(255,255,255,0)', .2, 9000); x.globalCompositeOperation = 'source-over'; }
  else if (kind === 'walk'){ [c, x] = cv(256, 256); noiseFill(x, 256, 256, '#8e8b85', .1, 12000); x.strokeStyle = 'rgba(60,58,52,.5)'; x.lineWidth = 2; for (let k = 0; k <= 256; k += 64){ x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 256); x.stroke(); x.beginPath(); x.moveTo(0, k); x.lineTo(256, k); x.stroke(); } grime(x, 256, 256, .6); }
  else if (kind === 'plaza'){ [c, x] = cv(256, 256); noiseFill(x, 256, 256, '#8c877e', .08, 8000); for (let r = 0; r < 8; r++) for (let k = 0; k < 8; k++){ x.fillStyle = 'rgba(' + ((r + k)%2 ? '0,0,0,.05' : '255,255,255,.05') + ')'; x.fillRect(k*32, r*32, 32, 32); x.strokeStyle = 'rgba(70,65,60,.4)'; x.strokeRect(k*32, r*32, 32, 32); } }
  else if (kind === 'grass'){ [c, x] = cv(256, 256); noiseFill(x, 256, 256, '#4a6a2c', .18, 30000); for (let i = 0; i < 3000; i++){ x.fillStyle = 'rgba(' + (60 + Math.random()*60 | 0) + ',' + (100 + Math.random()*60 | 0) + ',' + (30 + Math.random()*30 | 0) + ',.5)'; x.fillRect(Math.random()*256, Math.random()*256, 1, 3); } }
  else if (kind === 'sand'){ [c, x] = cv(256, 256); noiseFill(x, 256, 256, '#d8c49a', .12, 30000); }
  else if (kind === 'roof'){ [c, x] = cv(256, 256); noiseFill(x, 256, 256, '#77736c', .18, 25000); grime(x, 256, 256, 1.5); }
  else if (kind === 'shingle'){ [c, x] = cv(256, 256); for (let r = 0; r < 16; r++) for (let k = 0; k < 9; k++){ const v = 60 + Math.random()*30; x.fillStyle = 'rgb(' + (v + 20 | 0) + ',' + (v*.75 | 0) + ',' + (v*.7 | 0) + ')'; x.fillRect(k*32 - (r%2)*16, r*16, 31, 15); } x.fillStyle = 'rgba(0,0,0,.25)'; for (let r = 0; r < 16; r++) x.fillRect(0, r*16 + 13, 256, 3); }
  else if (kind === 'awning'){ [c, x] = cv(128, 64); for (let k = 0; k < 8; k++){ x.fillStyle = k%2 ? '#ffffff' : '#c8c8c8'; x.fillRect(k*16, 0, 16, 64); } x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 54, 128, 10); }
  else if (kind === 'concrete'){ [c, x] = cv(256, 256); noiseFill(x, 256, 256, '#9c9890', .1, 15000); grime(x, 256, 256, 1); x.strokeStyle = 'rgba(0,0,0,.2)'; x.strokeRect(0, 0, 256, 256); }
  else if (kind === 'xwalk'){ [c, x] = cv(256, 64); x.clearRect(0, 0, 256, 64); x.fillStyle = 'rgba(240,240,240,.9)'; for (let k = 8; k < 256; k += 32) x.fillRect(k, 0, 18, 64); x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 1500; i++){ x.fillStyle = 'rgba(0,0,0,' + Math.random()*.6 + ')'; x.fillRect(Math.random()*256, Math.random()*64, 2, 2); } }
  else if (kind === 'store'){ // 1층 상가: 4칸 × 1층(4.5m)
    [c, x] = cv(512, 160); const [mc, mx] = cv(512, 160); mx.fillStyle = '#000'; mx.fillRect(0, 0, 512, 160); noiseFill(x, 512, 160, '#2a2826', .08);
    for (let b = 0; b < 4; b++){ const wx = b*128 + 8, wy = 30, ww = 112, wh = 118; const g = x.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, '#6a7884'); g.addColorStop(1, '#2a3036'); x.fillStyle = g; x.fillRect(wx, wy, ww, wh); mx.fillStyle = '#fff'; mx.fillRect(wx, wy, ww, wh);
      x.fillStyle = '#888'; x.fillRect(wx, wy, ww, 3); x.fillRect(wx + ww/2, wy, 3, wh); if (b === 1){ x.fillStyle = '#4a4440'; x.fillRect(wx + 30, wy + 20, 52, wh - 20); mx.fillStyle = '#000'; mx.fillRect(wx + 30, wy + 20, 52, wh - 20); } }
    x.fillStyle = '#1a1816'; x.fillRect(0, 0, 512, 26); c = withMask(c, mc); }
  TX[kind] = mkTex(c); return TX[kind];
}
// 간판 묶음 (4×4)
const SIGNS = ['LUNA MART', 'BURGER BOLT', 'PIZZA 24', 'CAFE NOIR', 'PHARMACY', 'GYM+', 'TATTOO', 'LIQUOR', 'DONUTS', 'SUSHI GO', 'LAUNDRY', 'BARBER', 'NOODLE', 'PAWN', 'FLOWERS', 'ARCADE'];
const SIGNCOL = ['#ff3a5a', '#ffb02a', '#3ad0ff', '#7aff6a', '#ff6ad8', '#ffe84a', '#ffffff', '#ff7a3a'];
function signAtlas(){ if (TX.signs) return TX.signs; const [c, x] = cv(1024, 512); x.fillStyle = '#000'; x.fillRect(0, 0, 1024, 512);
  SIGNS.forEach((s, i)=>{ const gx = (i%4)*256, gy = Math.floor(i/4)*128; x.fillStyle = '#0c0c10'; x.fillRect(gx + 4, gy + 4, 248, 120); const col = SIGNCOL[i%SIGNCOL.length]; x.font = '900 46px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = col; x.shadowBlur = 18; x.fillStyle = col; let fs = 46; while (x.measureText(s).width > 230 && fs > 20){ fs -= 2; x.font = '900 ' + fs + 'px Arial Black, Arial, sans-serif'; } x.fillText(s, gx + 128, gy + 66); x.shadowBlur = 0; x.strokeStyle = col; x.lineWidth = 3; x.strokeRect(gx + 10, gy + 10, 236, 108); });
  TX.signs = mkTex(c, false); return TX.signs; }
// 특수 건물 간판
function textTex(text, bg, fg, w, h){ const [c, x] = cv(w || 512, h || 128); x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); x.fillStyle = fg; let fs = c.height*.6; x.font = '900 ' + fs + 'px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; while (x.measureText(text).width > c.width*.9){ fs -= 2; x.font = '900 ' + fs + 'px Arial Black, Arial, sans-serif'; } x.fillText(text, c.width/2, c.height*.54); return mkTex(c, false); }
// 광고판
const ADS = [['SPRUNK', 'Taste the fizz', '#16a34a', '#fff'], ['LUNA AIR', 'Fly cheaper', '#1d4ed8', '#fff'], ['BOLT BURGER', 'Bigger. Hotter.', '#dc2626', '#ffd23a'], ['VORTEX', 'Phones that think', '#111', '#3ad0ff'], ['MAZE BANK', 'Your money, safe', '#7c2d12', '#fff'], ['WEAZEL TV', 'Tonight at 9', '#f59e0b', '#111'], ['PISSWASSER', 'The beer', '#fde047', '#7f1d1d'], ['DINKY CARS', '0% financing', '#e11d48', '#fff']];
function adTex(i){ const k = 'ad' + i; if (TX[k]) return TX[k]; const a = ADS[i%ADS.length]; const [c, x] = cv(512, 256); const g = x.createLinearGradient(0, 0, 512, 256); g.addColorStop(0, a[2]); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  x.fillStyle = 'rgba(255,255,255,.08)'; for (let r = 0; r < 6; r++){ x.beginPath(); x.arc(400, 120, 40 + r*30, 0, 7); x.fill(); }
  x.fillStyle = a[3]; x.font = '900 72px Arial Black, Arial'; x.textAlign = 'left'; x.fillText(a[0], 28, 130); x.font = 'italic 700 30px Arial'; x.fillStyle = '#fff'; x.fillText(a[1], 32, 190); TX[k] = mkTex(c, false); return TX[k]; }

// =====================================================================
//  재질 (밤에 창문 불 켜짐 · 유리 반사)
// =====================================================================
W.U = { uNight:{ value:0 }, uWet:{ value:0 }, uT:{ value:0 } };
const MAT = {};
function facadeMat(kind){
  if (MAT[kind]) return MAT[kind];
  const glass = /glass/.test(kind);
  const m = new THREE.MeshStandardMaterial({ map:facade(kind), vertexColors:true, roughness:.85, metalness:0, envMapIntensity:1 });
  m.onBeforeCompile = sh=>{ sh.uniforms.uNight = W.U.uNight; sh.uniforms.uWet = W.U.uWet;
    sh.vertexShader = 'attribute float aSeed; varying float vSeed; varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSeed = aSeed;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWP = (modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = 'uniform float uNight, uWet; varying float vSeed; varying vec3 vWP;\nfloat wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `vec4 texel = texture2D(map, vUv); texel = mapTexelToLinear(texel); float win = smoothstep(.86, .97, texel.a);
        diffuseColor.rgb = mix(texel.rgb*vColor, texel.rgb, win);
        vec2 cell = mod(floor(vUv*4.), 64.); float sd = mod(floor(vSeed + .5)*7., 53.); float wr1 = wh(cell + sd), wr2 = wh(cell*1.7 + sd*1.3);`)
      .replace('#include <color_fragment>', '')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, ${glass ? '.12' : '.18'}, win); roughnessFactor = mix(roughnessFactor, roughnessFactor*.35, uWet*(1. - win));`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, ${glass ? '.75' : '.45'}, win);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float lit = (wr1 < ${glass ? '.28' : '.34'}*uNight) ? win : 0.;
          vec3 lc = mix(vec3(1., .78, .5), vec3(.78, .86, 1.), step(.6, wr2)) * (.7 + .5*wr2);
          float blind = step(.8, wh(cell + 3.3 + sd));
          totalEmissiveRadiance += lc * lit * mix(.85, .35, blind); }`);
  };
  m.customProgramCacheKey = ()=>'fac-' + glass;
  MAT[kind] = m; return m;
}
function simpleMat(key, opts){ if (MAT[key]) return MAT[key]; opts = Object.assign({}, opts); const wet = opts.wet; delete opts.wet; for (const k of ['color', 'emissive']) if (typeof opts[k] === 'number') opts[k] = LC(opts[k]); const m = new THREE.MeshStandardMaterial(opts); MAT[key] = m; opts.wet = wet;
  if (opts.wet){ m.onBeforeCompile = sh=>{ sh.uniforms.uWet = W.U.uWet; sh.fragmentShader = 'uniform float uWet;\n' + sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, .12, uWet); ').replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= 1. - uWet*.35;'); }; m.customProgramCacheKey = ()=>'wet'; }
  return m; }
function storeMat(){ if (MAT.store) return MAT.store; const m = new THREE.MeshStandardMaterial({ map:plainTex('store'), vertexColors:true, roughness:.6 });
  m.onBeforeCompile = sh=>{ sh.uniforms.uNight = W.U.uNight; sh.fragmentShader = 'uniform float uNight;\n' + sh.fragmentShader.replace('#include <map_fragment>', 'vec4 texel = mapTexelToLinear(texture2D(map, vUv)); float win = smoothstep(.86, .97, texel.a); diffuseColor.rgb = mix(texel.rgb*vColor, texel.rgb, win);').replace('#include <color_fragment>', '')
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, .08, win);').replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor = mix(0., .5, win);')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1., .86, .66) * win * (.06 + 1.3*uNight) * (.6 + .4*vColor.r);'); };
  m.customProgramCacheKey = ()=>'store'; MAT.store = m; return m; }
function signMat(){ if (MAT.sign) return MAT.sign; const t = signAtlas(); const m = new THREE.MeshStandardMaterial({ map:t, emissiveMap:t, emissive:0xffffff, emissiveIntensity:1, roughness:.5 });
  m.onBeforeCompile = sh=>{ sh.uniforms.uNight = W.U.uNight; sh.fragmentShader = 'uniform float uNight;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= .15 + 2.2*uNight;'); }; m.customProgramCacheKey = ()=>'sign'; MAT.sign = m; return m; }
W.MAT = MAT;

// =====================================================================
//  지오메트리 빌더
// =====================================================================
class GB {
  constructor(){ this.p = []; this.n = []; this.uv = []; this.c = []; this.s = []; this.i = []; this.v = 0; }
  quad(a, b, c, d, n, uv, col, seed){ const v = this.v; for (const q of [a, b, c, d]){ this.p.push(q[0], q[1], q[2]); this.n.push(n[0], n[1], n[2]); this.c.push(col.r, col.g, col.b); this.s.push(seed || 0); }
    this.uv.push(uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]); this.i.push(v, v + 1, v + 2, v, v + 2, v + 3); this.v += 4; }
  // 벽 4면 (+ 위/아래). tw/th: 텍스처 한 장의 m 크기
  box(x0, y0, z0, x1, y1, z1, o){ o = o || {}; const tw = o.tw || 14.4, th = o.th || 14.4, col = o.col || WHITE, s = o.seed || 0, uo = o.uo || 0, vo = o.vo === undefined ? y0 : o.vo;
    const v0 = vo/th, v1 = (vo + y1 - y0)/th;
    if (o.walls !== false){
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [uo, v0, uo + (x1 - x0)/tw, v1], col, s);
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [uo, v0, uo + (x1 - x0)/tw, v1], col, s);
      this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [uo, v0, uo + (z1 - z0)/tw, v1], col, s);
      this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [uo, v0, uo + (z1 - z0)/tw, v1], col, s); }
    if (o.top){ const ts = o.ts || 8; this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [x0/ts, -z1/ts, x1/ts, -z0/ts], o.tcol || col, s); } }
  // 바닥 판 (위쪽만)
  flat(x0, z0, x1, z1, y, ts, col, rot){ const a = [x0, y, z1], b = [x1, y, z1], c = [x1, y, z0], d = [x0, y, z0];
    if (rot){ const v = this.v; for (const q of [a, b, c, d]){ this.p.push(q[0], q[1], q[2]); this.n.push(0, 1, 0); this.c.push(col.r, col.g, col.b); this.s.push(0); } const L = (x1 - x0)/ts[0], Wd = (z1 - z0)/ts[1]; this.uv.push(0, 0, 0, L, Wd, L, Wd, 0); this.i.push(v, v + 1, v + 2, v, v + 2, v + 3); this.v += 4; return; }
    this.quad(a, b, c, d, [0, 1, 0], [x0/ts, -z1/ts, x1/ts, -z0/ts], col || WHITE, 0); }
  tri(a, b, c, uv, col){ const v = this.v; const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const n = [e1[1]*e2[2] - e1[2]*e2[1], e1[2]*e2[0] - e1[0]*e2[2], e1[0]*e2[1] - e1[1]*e2[0]]; const l = Math.hypot(...n) || 1;
    for (const q of [a, b, c]){ this.p.push(q[0], q[1], q[2]); this.n.push(n[0]/l, n[1]/l, n[2]/l); this.c.push(col.r, col.g, col.b); this.s.push(0); } this.uv.push(...uv); this.i.push(v, v + 1, v + 2); this.v += 3; }
  build(){ if (!this.v) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(this.s, 1)); g.setIndex(this.v > 65000 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1)); g.computeBoundingSphere(); return g; }
}
const WHITE = new THREE.Color(1, 1, 1);
const LC = h=>new THREE.Color(h).convertSRGBToLinear();
W.GB = GB;

// =====================================================================
//  도시 만들기
// =====================================================================
const CH = 200; // 청크 크기
const chunks = new Map();
function chunk(x, z){ const a = Math.floor(x/CH), b = Math.floor(z/CH), k = a + ',' + b; let c = chunks.get(k); if (!c){ c = { k, gb:{} }; chunks.set(k, c); } return c; }
function gb(x, z, mat){ const c = chunk(x, z); return c.gb[mat] || (c.gb[mat] = new GB()); }
const INST = {}; // 인스턴스 소품: 이름 → [matrix…]
function inst(name, x, y, z, ry, s, extra){ (INST[name] = INST[name] || []).push({ x, y, z, ry:ry || 0, s:s || 1, e:extra }); }

const PALETTE = { stucco:[0xf2e6d0, 0xe8d0b0, 0xd8e0e8, 0xf0d8d0, 0xe0e8d4, 0xfff4e0, 0xd8c8b8, 0xc8d8e0], house:[0xe8e8e4, 0xc8d4dc, 0xe4d8b8, 0xd8c4c4, 0xc4d4c0, 0xb8b8c8, 0xe0d0b0], office:[0xffffff, 0xe8e4dc, 0xd0ccc4, 0xf0ece0], brick:[0xffffff, 0xe0d0c8, 0xd0b8b0, 0xc8b8a8] };
function building(rng, x0, z0, x1, z1, h, kind, o){
  o = o || {}; const cx = (x0 + x1)/2, cz = (z0 + z1)/2; const seed = Math.floor(rng()*1000);
  const tint = LC(U.pick.call(null, PALETTE[kind] || [0xffffff])); if (PALETTE[kind]) tint.copy(LC(PALETTE[kind][Math.floor(rng()*PALETTE[kind].length)]));
  let base = 0;
  if (o.store){ const sh = 4.5; gb(cx, cz, 'store').box(x0, 0, z0, x1, sh, z1, { tw:14.4, th:4.5, col:LC(U.pick([0xffffff, 0xd8c8b0, 0xa8b8c8, 0xc8a8a0])), seed });
    // 간판
    const si = Math.floor(rng()*16), u0 = (si%4)/4, v0 = 1 - (Math.floor(si/4) + 1)/4; const sw = Math.min(10, (x1 - x0)*.6);
    const side = o.front || 's'; const sg = gb(cx, cz, 'sign');
    if (side === 's') sg.quad([cx - sw/2, 3.4, z1 + .12], [cx + sw/2, 3.4, z1 + .12], [cx + sw/2, 4.5, z1 + .12], [cx - sw/2, 4.5, z1 + .12], [0, 0, 1], [u0 + .005, v0 + .005, u0 + .245, v0 + .245], WHITE);
    if (side === 'n') sg.quad([cx + sw/2, 3.4, z0 - .12], [cx - sw/2, 3.4, z0 - .12], [cx - sw/2, 4.5, z0 - .12], [cx + sw/2, 4.5, z0 - .12], [0, 0, -1], [u0 + .005, v0 + .005, u0 + .245, v0 + .245], WHITE);
    if (side === 'e') sg.quad([x1 + .12, 3.4, cz + sw/2], [x1 + .12, 3.4, cz - sw/2], [x1 + .12, 4.5, cz - sw/2], [x1 + .12, 4.5, cz + sw/2], [1, 0, 0], [u0 + .005, v0 + .005, u0 + .245, v0 + .245], WHITE);
    if (side === 'w') sg.quad([x0 - .12, 3.4, cz - sw/2], [x0 - .12, 3.4, cz + sw/2], [x0 - .12, 4.5, cz + sw/2], [x0 - .12, 4.5, cz - sw/2], [-1, 0, 0], [u0 + .005, v0 + .005, u0 + .245, v0 + .245], WHITE);
    base = 4.5; }
  const fk = kind; const th = kind === 'house' ? 12 : 14.4;
  gb(cx, cz, fk).box(x0, base, z0, x1, h, z1, { tw:kind === 'house' ? 12 : 14.4, th, col:tint, seed, uo:Math.floor(rng()*4)/4 });
  // 지붕 + 난간
  const rg = gb(cx, cz, 'roof'); rg.box(x0, h, z0, x1, h + .01, z1, { walls:false, top:true, ts:8 });
  // 처마 장식(코니스) · 1층 위 띠
  if (kind === 'brick' || kind === 'stucco' || kind === 'office' || kind === 'hotel'){ const o = .35, cc = LC(kind === 'brick' ? 0xb8b0a0 : 0xd8d4cc); rg.box(x0 - o, h - .7, z0 - o, x1 + o, h, z1 + o, { tw:8, th:8, col:cc, top:true });
    if (base > 0) rg.box(x0 - .2, base, z0 - .2, x1 + .2, base + .45, z1 + .2, { tw:8, th:8, col:cc, top:true });
    if (h > 30 && kind !== 'office') for (let fy = base + 14.4; fy < h - 4; fy += 14.4) rg.box(x0 - .12, fy - .2, z0 - .12, x1 + .12, fy, z1 + .12, { tw:8, th:8, col:cc }); }
  if (base > 0 && rng() < .6){ // 차양
    const aw = gb(cx, cz, 'awning'); const ac = LC(U.pick([0xb83a2a, 0x2a5a3a, 0x1d3a6a, 0x3a3a3a, 0xd8a020, 0x6a2a5a])); const side = o.front || 's'; const d = 1.6, y0 = 3.2, y1 = 3.9;
    const L = (side === 's' || side === 'n') ? x1 - x0 : z1 - z0; const st = 2, n = Math.max(1, Math.floor((L - 2)/7)); 
    for (let k = 0; k < n; k++){ const a0 = -L/2 + 1 + k*(L - 2)/n + .4, a1 = a0 + (L - 2)/n - .8;
      if (side === 's') aw.quad([cx + a0, y0, z1 + d], [cx + a1, y0, z1 + d], [cx + a1, y1, z1], [cx + a0, y1, z1], [0, .9, .4], [0, 0, (a1 - a0)/2, 1], ac);
      if (side === 'n') aw.quad([cx + a1, y0, z0 - d], [cx + a0, y0, z0 - d], [cx + a0, y1, z0], [cx + a1, y1, z0], [0, .9, -.4], [0, 0, (a1 - a0)/2, 1], ac);
      if (side === 'e') aw.quad([x1 + d, y0, cz - a0], [x1 + d, y0, cz - a1], [x1, y1, cz - a1], [x1, y1, cz - a0], [.4, .9, 0], [0, 0, (a1 - a0)/2, 1], ac);
      if (side === 'w') aw.quad([x0 - d, y0, cz + a0], [x0 - d, y0, cz + a1], [x0, y1, cz + a1], [x0, y1, cz + a0], [-.4, .9, 0], [0, 0, (a1 - a0)/2, 1], ac); } void st; }
  if (kind !== 'house' && kind !== 'ware'){ const p = .35, ph = 1; const pc = LC(0x8a8680);
    rg.box(x0, h, z0, x1, h + ph, z0 + p, { tw:8, th:8, col:pc, top:true }); rg.box(x0, h, z1 - p, x1, h + ph, z1, { tw:8, th:8, col:pc, top:true }); rg.box(x0, h, z0, x0 + p, h + ph, z1, { tw:8, th:8, col:pc, top:true }); rg.box(x1 - p, h, z0, x1, h + ph, z1, { tw:8, th:8, col:pc, top:true });
    // 옥상 설비
    const n = 1 + Math.floor(rng()*4); for (let k = 0; k < n; k++){ const w = 2 + rng()*4, d = 2 + rng()*3, ax = U.lerp(x0 + 2, x1 - 2 - w, rng()), az = U.lerp(z0 + 2, z1 - 2 - d, rng()); rg.box(ax, h, az, ax + w, h + 1.2 + rng()*1.6, az + d, { tw:6, th:6, col:LC(0xb0b0b0), top:true }); }
    if (h > 25 && rng() < .35) inst('tank', U.lerp(x0 + 4, x1 - 4, rng()), h, U.lerp(z0 + 4, z1 - 4, rng()), rng()*6, 1);
    if (h > 60 && rng() < .5) inst('antenna', cx, h, cz, 0, .6 + rng()*.8);
    if (h > 40 && rng() < .3){ const ry = [0, Math.PI/2, Math.PI, -Math.PI/2][Math.floor(rng()*4)]; inst('billboard', cx, h + 1, cz, ry, 1, Math.floor(rng()*ADS.length)); } }
  W.addBox(x0, z0, x1, z1, h + 1, { bld:true });
}
// 집: 박공 지붕
function house(rng, x0, z0, x1, z1, floors, ry){
  const h = floors*3; const cx = (x0 + x1)/2, cz = (z0 + z1)/2; const tint = LC(PALETTE.house[Math.floor(rng()*PALETTE.house.length)]); const seed = Math.floor(rng()*1000);
  gb(cx, cz, 'house').box(x0, CURB, z0, x1, h + CURB, z1, { tw:12, th:12, col:tint, seed, vo:0 });
  const rg = gb(cx, cz, 'shingle'); const rc = LC(U.pick([0x8a4a3a, 0x4a4a52, 0x6a5040, 0x3a4a5a, 0x7a6a5a])); const o = .5, top = h + CURB + (ry ? (x1 - x0) : (z1 - z0))*.35;
  const y = h + CURB;
  if (!ry){ // 용마루가 x 방향
    rg.quad([x0 - o, y, z1 + o], [x1 + o, y, z1 + o], [x1 + o, top, cz], [x0 - o, top, cz], [0, .7, .7], [0, 0, (x1 - x0)/4, (z1 - z0)/5], rc);
    rg.quad([x1 + o, y, z0 - o], [x0 - o, y, z0 - o], [x0 - o, top, cz], [x1 + o, top, cz], [0, .7, -.7], [0, 0, (x1 - x0)/4, (z1 - z0)/5], rc);
    const gw = gb(cx, cz, 'house'); gw.tri([x1, y, z1], [x1, y, z0], [x1, top, cz], [0, 0, (z1 - z0)/12, 0, (z1 - z0)/24, (top - y)/12], tint); gw.tri([x0, y, z0], [x0, y, z1], [x0, top, cz], [0, 0, (z1 - z0)/12, 0, (z1 - z0)/24, (top - y)/12], tint);
  } else {
    rg.quad([x1 + o, y, z1 + o], [x1 + o, y, z0 - o], [cx, top, z0 - o], [cx, top, z1 + o], [.7, .7, 0], [0, 0, (z1 - z0)/4, (x1 - x0)/5], rc);
    rg.quad([x0 - o, y, z0 - o], [x0 - o, y, z1 + o], [cx, top, z1 + o], [cx, top, z0 - o], [-.7, .7, 0], [0, 0, (z1 - z0)/4, (x1 - x0)/5], rc);
    const gw = gb(cx, cz, 'house'); gw.tri([x0, y, z1], [x1, y, z1], [cx, top, z1], [0, 0, (x1 - x0)/12, 0, (x1 - x0)/24, (top - y)/12], tint); gw.tri([x1, y, z0], [x0, y, z0], [cx, top, z0], [0, 0, (x1 - x0)/12, 0, (x1 - x0)/24, (top - y)/12], tint); }
  W.addBox(x0, z0, x1, z1, top, { bld:true });
}

function buildCity(){
  const rngC = U.seeded(4242);
  // ----- 도로 -----
  const roadG = new GB(), interG = new GB(), xwG = new GB();
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++){
    if (W.nodeAt[i + ',' + j]){ const x = X(i), z = X(j); interG.flat(x - RW, z - RW, x + RW, z + RW, 0, 14, WHITE); }
    if (W.hasEdge(i, j, i + 1, j) && W.nodeAt[i + ',' + j]){ const x0 = X(i) + RW, x1 = X(i + 1) - RW, z = X(j); // 가로 도로: 텍스처를 90도 돌림
      const v = roadG.v; for (const q of [[x0, 0, z + RW], [x1, 0, z + RW], [x1, 0, z - RW], [x0, 0, z - RW]]){ roadG.p.push(...q); roadG.n.push(0, 1, 0); roadG.c.push(1, 1, 1); roadG.s.push(0); } const L = (x1 - x0)/28; roadG.uv.push(0, 0, 0, L, 1, L, 1, 0); roadG.i.push(v, v + 1, v + 2, v, v + 2, v + 3); roadG.v += 4;
      for (const xx of [x0 + .2, x1 - 3.2]) xwG.quad([xx, .02, z + RW - .3], [xx + 3, .02, z + RW - .3], [xx + 3, .02, z - RW + .3], [xx, .02, z - RW + .3], [0, 1, 0], [1, 0, 0, 1], WHITE); }
    if (W.hasEdge(i, j, i, j + 1)){ const z0 = X(j) + RW, z1 = X(j + 1) - RW, x = X(i);
      const v = roadG.v; for (const q of [[x - RW, 0, z1], [x + RW, 0, z1], [x + RW, 0, z0], [x - RW, 0, z0]]){ roadG.p.push(...q); roadG.n.push(0, 1, 0); roadG.c.push(1, 1, 1); roadG.s.push(0); } const L = (z1 - z0)/28; roadG.uv.push(0, 0, 1, 0, 1, L, 0, L); roadG.i.push(v, v + 1, v + 2, v, v + 2, v + 3); roadG.v += 4;
      for (const zz of [z0 + .2, z1 - 3.2]) xwG.quad([x - RW + .3, .02, zz + 3], [x + RW - .3, .02, zz + 3], [x + RW - .3, .02, zz], [x - RW + .3, .02, zz], [0, 1, 0], [0, 0, 1, 1], WHITE); }
  }
  const rt = plainTex('road'); const roadMat = simpleMat('road', { map:rt, roughness:.88, wet:true });
  const asph = plainTex('asphalt'); const interMat = simpleMat('inter', { map:asph, roughness:.9, wet:true });
  const xwMat = simpleMat('xw', { map:plainTex('xwalk'), transparent:true, roughness:.7, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2 });
  for (const [g, m] of [[roadG, roadMat], [interG, interMat], [xwG, xwMat]]){ const me = new THREE.Mesh(g.build(), m); me.receiveShadow = true; me.matrixAutoUpdate = false; me.updateMatrix(); W.root.add(me); }

  // ----- 블록 (보도 + 부지) -----
  const done = new Set();
  for (let ci = 0; ci < N; ci++) for (let cj = 0; cj < N; cj++){
    const d = district(ci, cj); let x0 = X(ci) + RW, z0 = X(cj) + RW, x1 = X(ci + 1) - RW, z1 = X(cj + 1) - RW;
    if (d === 'park'){ if (done.has('park')) continue; done.add('park'); x0 = X(1) + RW; z0 = X(6) + RW; x1 = X(3) - RW; z1 = X(9) - RW; }
    blockSlab(x0, z0, x1, z1, SPECIAL[ci + ',' + cj] === 'safe' ? 'res' : d);
    const rng = U.seeded(ci*131 + cj*977 + 7);
    const sp = SPECIAL[ci + ',' + cj];
    if (d === 'park') park(rng, x0 + SWK, z0 + SWK, x1 - SWK, z1 - SWK);
    else lot(rng, x0 + SWK, z0 + SWK, x1 - SWK, z1 - SWK, d, sp, ci, cj);
    // 보도 소품: 가로등 · 나무 · 소화전
    sidewalkProps(rng, x0, z0, x1, z1, d);
  }
  outskirts();
  // 청크 → 메시
  const matOf = k=>k === 'awning' ? simpleMat('awning', { map:plainTex('awning'), vertexColors:true, roughness:.8, side:THREE.DoubleSide }) : k === 'store' ? storeMat() : k === 'sign' ? signMat() : k === 'roof' ? simpleMat('roof', { map:plainTex('roof'), vertexColors:true, roughness:.95, wet:true }) : k === 'shingle' ? simpleMat('shingle', { map:plainTex('shingle'), vertexColors:true, roughness:.85, wet:true })
    : k === 'walk' ? simpleMat('walk', { map:plainTex('walk'), vertexColors:true, roughness:.85, wet:true }) : k === 'plaza' ? simpleMat('plaza', { map:plainTex('plaza'), vertexColors:true, roughness:.8, wet:true }) : k === 'grass' ? simpleMat('grass', { map:plainTex('grass'), vertexColors:true, roughness:1 })
    : k === 'sand' ? simpleMat('sand', { map:plainTex('sand'), vertexColors:true, roughness:1 }) : k === 'concrete' ? simpleMat('concrete', { map:plainTex('concrete'), vertexColors:true, roughness:.9, wet:true }) : facadeMat(k);
  W.chunkMeshes = [];
  for (const c of chunks.values()) for (const k in c.gb){ const g = c.gb[k].build(); if (!g) continue; const me = new THREE.Mesh(g, matOf(k)); me.castShadow = !/grass|sand|walk|plaza|sign|concrete/.test(k); me.receiveShadow = true; me.matrixAutoUpdate = false; me.updateMatrix(); W.root.add(me); W.chunkMeshes.push(me); }
  buildInstances();
  buildSignals();
}
function blockSlab(x0, z0, x1, z1, d){
  const cx = (x0 + x1)/2, cz = (z0 + z1)/2;
  // 보도 테두리 + 연석
  const g = gb(cx, cz, 'walk'); g.box(x0, -.5, z0, x1, CURB, z1, { tw:4, th:4, col:LC(0x9a968e), top:false });
  const s = SWK; g.flat(x0, z0, x1, z0 + s, CURB, 2); g.flat(x0, z1 - s, x1, z1, CURB, 2); g.flat(x0, z0 + s, x0 + s, z1 - s, CURB, 2); g.flat(x1 - s, z0 + s, x1, z1 - s, CURB, 2);
  const inner = d === 'res' || d === 'rich' || d === 'park' ? 'grass' : d === 'ind' ? 'concrete' : d === 'beach' ? 'plaza' : 'plaza';
  gb(cx, cz, inner).flat(x0 + s, z0 + s, x1 - s, z1 - s, CURB + .005, inner === 'grass' ? 6 : 4);
}
// 블록 안 건물 배치
function lot(rng, x0, z0, x1, z1, d, sp, ci, cj){
  if (sp){ special(rng, sp, x0, z0, x1, z1, ci, cj); return; }
  const w = x1 - x0, dd = z1 - z0;
  if (d === 'down'){
    const split = rng() < .5 ? 2 : rng() < .5 ? 1 : 3; const parts = [];
    if (split === 1) parts.push([x0 + 4, z0 + 4, x1 - 4, z1 - 4]);
    else if (split === 2){ const mz = (z0 + z1)/2; parts.push([x0 + 3, z0 + 3, x1 - 3, mz - 2], [x0 + 3, mz + 2, x1 - 3, z1 - 3]); }
    else { const mx = (x0 + x1)/2, mz = (z0 + z1)/2; parts.push([x0 + 3, z0 + 3, mx - 2, mz - 2], [mx + 2, z0 + 3, x1 - 3, mz - 2], [x0 + 3, mz + 2, mx - 2, z1 - 3], [mx + 2, mz + 2, x1 - 3, z1 - 3]); }
    for (const [a, b, c, e] of parts){ const h = 45 + rng()*150*(split === 1 ? 1 : .8); const k = rng() < .55 ? 'glass' : rng() < .5 ? 'glass2' : 'office';
      // 기단 + 탑 (후퇴)
      if (rng() < .6 && h > 70){ building(rng, a, b, c, e, 14 + rng()*10, 'office', { store:true, front:'s' }); const ins = 4 + rng()*5; building(rng, a + ins, b + ins, c - ins, e - ins, h, k);
        if (rng() < .5){ const i2 = ins + 4 + rng()*4; if (c - a - i2*2 > 8 && e - b - i2*2 > 8) building(rng, a + i2, b + i2, c - i2, e - i2, h + 15 + rng()*40, k); } }
      else building(rng, a, b, c, e, h, k, { store:k === 'office', front:'s' }); }
    plazaProps(rng, x0, z0, x1, z1);
  } else if (d === 'mid' || d === 'beach'){
    // 둘레를 따라 건물
    const kinds = d === 'beach' ? ['hotel', 'stucco', 'hotel'] : ['brick', 'stucco', 'office', 'brick', 'stucco'];
    const depth = 18 + rng()*6;
    const row = (ax0, ax1, fn)=>{ let p = ax0; while (p < ax1 - 10){ const wl = Math.min(ax1 - p, 14.4 + Math.floor(rng()*3)*7.2); fn(p, p + wl - .5); p += wl; } };
    const hmax = d === 'beach' ? 40 : 34;
    row(x0, x1, (a, b)=>building(rng, a, z1 - depth, b, z1, 10 + rng()*hmax, U.pick(kinds), { store:rng() < .75, front:'s' }));
    row(x0, x1, (a, b)=>building(rng, a, z0, b, z0 + depth, 10 + rng()*hmax, U.pick(kinds), { store:rng() < .6, front:'n' }));
    row(z0 + depth + 1, z1 - depth - 1, (a, b)=>building(rng, x0, a, x0 + depth*.9, b, 10 + rng()*hmax*.7, U.pick(kinds), { store:rng() < .5, front:'w' }));
    row(z0 + depth + 1, z1 - depth - 1, (a, b)=>building(rng, x1 - depth*.9, a, x1, b, 10 + rng()*hmax*.7, U.pick(kinds), { store:rng() < .5, front:'e' }));
    // 가운데: 주차장
    parking(rng, x0 + depth + 2, z0 + depth + 2, x1 - depth - 2, z1 - depth - 2);
    if (d === 'beach') for (let k = 0; k < 6; k++) inst('palm', U.lerp(x0, x1, rng()), CURB, z1 + 1, rng()*6, .9 + rng()*.4);
  } else if (d === 'res' || d === 'rich'){
    const big = d === 'rich'; const nx = big ? 2 : 3, nz = big ? 2 : 3; const pw = (x1 - x0)/nx, pd = (z1 - z0)/nz;
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++){ if (!big && a === 1 && b === 1){ // 가운데는 작은 놀이터/나무
        for (let k = 0; k < 4; k++) inst('tree', x0 + pw*(1 + rng()), CURB, z0 + pd*(1 + rng()), rng()*6, .8 + rng()*.5); continue; }
      const hx0 = x0 + a*pw, hz0 = z0 + b*pd; const hw = big ? 18 + rng()*6 : 10 + rng()*4, hd = big ? 14 + rng()*4 : 9 + rng()*3;
      const fx = hx0 + (pw - hw)/2, fz = hz0 + (pd - hd)/2; house(rng, fx, fz, fx + hw, fz + hd, big ? 2 : (rng() < .5 ? 1 : 2), rng() < .5);
      // 마당 나무 · 울타리
      if (rng() < .8) inst('tree', hx0 + 3 + rng()*3, CURB, hz0 + 3 + rng()*3, rng()*6, .7 + rng()*.5);
      if (rng() < .5) inst('bush', fx - 1.5, CURB, fz + hd/2, 0, 1);
      if (big && rng() < .7){ const pz = fz + hd + 2; inst('pool', fx + hw/2, CURB, Math.min(pz + 3, hz0 + pd - 4), 0, 1); }
    }
  } else if (d === 'ind'){
    const n = 2 + Math.floor(rng()*2);
    for (let k = 0; k < n; k++){ const a = x0 + 4 + k*(w - 8)/n, b = a + (w - 8)/n - 6; const zz0 = z0 + 6 + rng()*8, zz1 = z1 - 8 - rng()*10; building(rng, a, zz0, b, zz1, 9 + rng()*6, 'ware'); }
    for (let k = 0; k < 10; k++) inst('container', U.lerp(x0 + 4, x1 - 4, rng()), CURB + (rng() < .3 ? 2.6 : 0), z1 - 4, Math.PI/2*(rng() < .5 ? 0 : 1)*0, 1, Math.floor(rng()*6));
  }
}
function parking(rng, x0, z0, x1, z1){ if (x1 - x0 < 12 || z1 - z0 < 12) return; const cx = (x0 + x1)/2, cz = (z0 + z1)/2;
  const g = gb(cx, cz, 'concrete'); g.flat(x0, z0, x1, z1, CURB + .01, 6);
  for (let z = z0 + 3; z < z1 - 3; z += 6) if (rng() < .35) W.parkSpots.push({ x:x0 + 4, z, ry:Math.PI/2 }); for (let z = z0 + 3; z < z1 - 3; z += 6) if (rng() < .35) W.parkSpots.push({ x:x1 - 4, z, ry:-Math.PI/2 }); }
W.parkSpots = [];
function plazaProps(rng, x0, z0, x1, z1){ for (let k = 0; k < 3; k++) inst('bench', U.lerp(x0 + 6, x1 - 6, rng()), CURB, z1 - 1.5, Math.PI, 1); }
function park(rng, x0, z0, x1, z1){
  for (let k = 0; k < 130; k++){ const x = U.lerp(x0 + 3, x1 - 3, rng()), z = U.lerp(z0 + 3, z1 - 3, rng()); if (Math.hypot(x - (x0 + x1)/2, z - (z0 + z1)/2) < 38) continue; inst(rng() < .2 ? 'pine' : 'tree', x, CURB, z, rng()*6, .8 + rng()*.7); }
  for (let k = 0; k < 40; k++) inst('bush', U.lerp(x0, x1, rng()), CURB, U.lerp(z0, z1, rng()), rng()*6, .8 + rng()*.6);
  // 연못
  inst('pond', (x0 + x1)/2, CURB, (z0 + z1)/2, 0, 1);
  // 산책로
  const cx = (x0 + x1)/2, cz = (z0 + z1)/2; const g = gb(cx, cz, 'plaza'); g.flat(cx - 2, z0, cx + 2, cz - 30, CURB + .01, 4); g.flat(cx - 2, cz + 30, cx + 2, z1, CURB + .01, 4); g.flat(x0, cz - 2, cx - 30, cz + 2, CURB + .01, 4); g.flat(cx + 30, cz - 2, x1, cz + 2, CURB + .01, 4);
  for (let k = 0; k < 10; k++){ const a = k/10*Math.PI*2; inst('bench', cx + Math.cos(a)*34, CURB, cz + Math.sin(a)*34, -a - Math.PI/2, 1); }
  addRamp(cx, z0 + 40, 0, 10, 6, 2.6, '공원 점프');
}
function sidewalkProps(rng, x0, z0, x1, z1, d){
  const lampGap = 33; const off = .8;
  // 네 변을 따라: 가로등(도로 쪽 가장자리), 나무(안쪽)
  const edges = [[x0, z0, x1, z0, 0], [x1, z1, x0, z1, Math.PI], [x0, z1, x0, z0, -Math.PI/2], [x1, z0, x1, z1, Math.PI/2]];
  for (const [ax, az, bx, bz, ry] of edges){ const L = Math.hypot(bx - ax, bz - az), dx = (bx - ax)/L, dz = (bz - az)/L; const nx = dz, nz = -dx; // 도로 쪽(바깥) 법선
    for (let s = 12; s < L - 8; s += lampGap){ const px = ax + dx*s + nx*off, pz = az + dz*s + nz*off; inst('lamp', px, CURB, pz, Math.atan2(nx, nz), 1); W.addPost(px, pz, .18, { kind:'lamp', idx:INST.lamp.length - 1 }); }
    if (d === 'down' || d === 'mid' || d === 'beach' || d === 'res' || d === 'rich') for (let s = 28; s < L - 12; s += d === 'res' || d === 'rich' ? 22 : 33){ if (rng() < .25) continue; const px = ax + dx*s + nx*2.2 - nx*0, pz = az + dz*s + nz*2.2;
      const k = d === 'beach' ? 'palm' : 'tree'; inst(k, px - nx*.2, CURB, pz - nz*.2, rng()*6, d === 'beach' ? .9 + rng()*.3 : .55 + rng()*.25); W.addPost(px, pz, .3, { kind:'tree' }); }
    if (rng() < .5){ const s = 20 + rng()*(L - 40); const px = ax + dx*s + nx*1.2, pz = az + dz*s + nz*1.2; inst('hydrant', px, CURB, pz, 0, 1); W.addPost(px, pz, .2, { kind:'hydrant', idx:INST.hydrant.length - 1 }); }
    if ((d === 'down' || d === 'mid') && rng() < .25){ const s = 30 + rng()*(L - 60); const px = ax + dx*s - nx*1.6, pz = az + dz*s - nz*1.6; inst('busstop', px, CURB, pz, Math.atan2(nx, nz), 1); W.addPost(px, pz, .6, { kind:'stop' }); }
    if (rng() < .4){ const s = 15 + rng()*(L - 30); inst('bin', ax + dx*s + nx*1.6, CURB, az + dz*s + nz*1.6, 0, 1); }
  }
}
// 특수 건물
function special(rng, sp, x0, z0, x1, z1, ci, cj){
  const cx = (x0 + x1)/2, cz = (z0 + z1)/2;
  const add = (type, label, door, col)=>{ const o = { type, label, x:door[0], z:door[1], col, ci, cj }; W.specials.push(o); return o; };
  const sign = (text, bg, fg, x, y, z, w, h, ry)=>{ const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map:textTex(text, bg, fg), emissive:0xffffff, emissiveMap:textTex(text, bg, fg), emissiveIntensity:.5, roughness:.5 })); m.position.set(x, y, z); m.rotation.y = ry || 0; W.root.add(m); };
  if (sp === 'police'){ building(rng, x0 + 4, z0 + 4, x1 - 20, z1 - 26, 16, 'office'); sign('POLICE', '#13244a', '#fff', cx - 8, 11, z1 - 25.9, 18, 3.5);
    add('police', '산 루나 경찰서', [cx - 8, z1 + 1]); parking(rng, x0 + 4, z1 - 22, x1 - 4, z1 - 4); W.copSpawn = { x:cx, z:z1 - 12 }; }
  else if (sp === 'hospital'){ building(rng, x0 + 6, z0 + 4, x1 - 6, z1 - 24, 28, 'stucco'); sign('HOSPITAL', '#fff', '#c81e1e', cx, 24, z1 - 23.9, 24, 4); add('hospital', '세인트 루나 병원', [cx, z1 + 1]); parking(rng, x0 + 4, z1 - 20, x1 - 4, z1 - 4); }
  else if (sp === 'gunshop' || sp === 'gunshop2'){ building(rng, x0 + 20, z1 - 22, x1 - 20, z1, 7, 'brick', {}); sign('AMMU', '#1a1a1a', '#e33', cx, 5.5, z1 + .2, 12, 2.6); add('gunshop', '총포상 AMMU', [cx, z1 + 1.5]);
    lot(rng, x0, z0, x1, z1 - 26, 'mid'); }
  else if (sp === 'clothes'){ building(rng, x0 + 18, z1 - 24, x1 - 18, z1, 9, 'stucco', {}); sign('LUNA WEAR', '#f0f0f0', '#222', cx, 7, z1 + .2, 16, 2.6); add('clothes', '옷가게 LUNA WEAR', [cx, z1 + 1.5]); lot(rng, x0, z0, x1, z1 - 28, 'mid'); }
  else if (sp === 'bank'){ building(rng, x0 + 6, z0 + 6, x1 - 6, z1 - 18, 120, 'glass2'); building(rng, x0 + 14, z1 - 18, x1 - 14, z1 - 4, 12, 'office'); sign('BANK OF LUNA', '#0b2a20', '#e8c56a', cx, 9, z1 - 3.9, 22, 3); add('bank', '루나 은행', [cx, z1 + 1]); }
  else if (sp === 'gas'){ // 주유소 캐노피
    const g = gb(cx, cz, 'concrete'); g.flat(x0, z0, x1, z1, CURB + .01, 6); gb(cx, cz, 'office').box(cx - 14, CURB, z0 + 6, cx + 14, 5, z0 + 18, { col:LC(0xffffff), seed:3 }); W.addBox(cx - 14, z0 + 6, cx + 14, z0 + 18, 5);
    inst('canopy', cx, CURB, cz + 8, 0, 1); for (const dx of [-8, 0, 8]){ inst('pump', cx + dx, CURB, cz + 8, 0, 1); W.addPost(cx + dx, cz + 8, .5, { kind:'pump' }); }
    sign('GAS', '#c81e1e', '#fff', cx, 7.5, cz + 8 + 6.05, 8, 1.6); add('gas', '주유소', [cx, cz + 14]); }
  else if (sp === 'spray'){ building(rng, x0 + 22, z1 - 26, x1 - 22, z1, 8, 'ware'); sign('RESPRAY', '#1d4ed8', '#fff', cx, 7, z1 + .2, 14, 2.4); add('spray', '도색소 RESPRAY', [cx, z1 + 2]); lot(rng, x0, z0, x1, z1 - 30, 'mid'); }
  else if (sp === 'safe'){ house(rng, cx - 12, cz - 6, cx + 12, cz + 8, 2, false); add('safe', '내 집 (저장)', [cx, cz + 11]); for (const [hx, hz] of [[x0 + 4, z0 + 4], [x1 - 18, z0 + 4], [x0 + 4, z1 - 16], [x0 + 21, z1 - 13]]) house(rng, hx, hz, hx + 13, hz + 11, rng() < .5 ? 1 : 2, rng() < .5); const g = gb(cx, cz, 'concrete'); g.flat(cx + 14, cz - 2, cx + 26, z1, CURB + .01, 6); W.safeGarage = { x:cx + 20, z:cz + 14, ry:0 }; for (let k = 0; k < 6; k++) inst('tree', U.lerp(x0, x1, rng()), CURB, z0 + 4 + rng()*10, rng()*6, .8); }
  else if (sp === 'diner'){ building(rng, x0 + 24, z1 - 20, x1 - 24, z1, 6, 'stucco', {}); sign('DINER 50', '#ff3a5a', '#fff', cx, 5, z1 + .2, 12, 2.2); add('diner', '식당 (체력 회복)', [cx, z1 + 1.5]); lot(rng, x0, z0, x1, z1 - 24, 'mid'); }
  else if (sp === 'garage'){ building(rng, x0 + 10, z0 + 10, x1 - 10, z1 - 30, 10, 'ware'); sign('MOD SHOP', '#111', '#ffb02a', cx, 8, z1 - 29.9, 14, 2.4); add('modshop', '튜닝샵', [cx, z1 - 24]); parking(rng, x0 + 4, z1 - 26, x1 - 4, z1 - 4); }
}
// 도시 밖: 해변 · 항구 · 언덕 · 바다 · 먼 산
function outskirts(){
  const E = HALF + RW, L = W.LAND;
  // 남쪽 해변
  const sg = gb(0, L, 'sand'); sg.flat(-1500, E, L, 760, CURB, 8);
  { const v = sg.v; const col = WHITE; for (const q of [[-1500, CURB, 760], [L, CURB, 760], [L, -1.8, 830], [-1500, -1.8, 830]]){ sg.p.push(...q); sg.n.push(0, 1, 0); sg.c.push(col.r, col.g, col.b); sg.s.push(0); } sg.uv.push(-1500/8, 760/8, L/8, 760/8, L/8, 830/8, -1500/8, 830/8); sg.i.push(v, v + 2, v + 1, v, v + 3, v + 2); sg.v += 4; }
  for (let x = -680; x < 760; x += 26) if (Math.random() < .7) inst('palm', x + Math.random()*10, CURB, E + 6 + Math.random()*30, Math.random()*6, .9 + Math.random()*.5);
  for (let k = 0; k < 14; k++) inst('umbrella', -600 + Math.random()*1300, CURB, 735 + Math.random()*20, Math.random()*6, 1, Math.floor(Math.random()*4));
  // 부두 (동쪽)
  const dg = gb(L, 0, 'concrete'); dg.box(E, -2, -1500, L, CURB, E, { tw:8, th:8, top:true, ts:8 });
  for (let z = -650; z < 650; z += 90){ inst('crane', L - 8, CURB, z, Math.PI/2, 1); W.addBox(L - 12, z - 6, L - 4, z + 6, 8); }
  for (let z = -620; z < 640; z += 22) for (let k = 0; k < 2; k++) if (Math.random() < .6) inst('container', E + 20 + k*14, CURB + (Math.random() < .3 ? 2.6 : 0), z, Math.PI/2, 1, Math.floor(Math.random()*6));
  // 북 · 서 언덕
  const hg = gb(-E, -E, 'grass'); hg.box(-1500, -2, -1500, L + 50, CURB, -E, { tw:8, th:8, top:true, ts:6 }); hg.box(-1500, -2, -E, -E, CURB, E, { tw:8, th:8, top:true, ts:6 });
  for (let k = 0; k < 420; k++){ const side = Math.random() < .5; const x = side ? -E - 10 - Math.random()*600 : -E + Math.random()*(L + E), z = side ? -E + Math.random()*(2*E) : -E - 10 - Math.random()*600; inst(Math.random() < .4 ? 'pine' : 'tree', x, CURB, z, Math.random()*6, .9 + Math.random()*.8); }
  addRamp(0, -E - 60, Math.PI, 12, 7, 3.5, '언덕 점프');
  // 도시 안 점프대
  addRamp(X(10), X(4) + 30, 0, 9, 5, 2.2, '바인우드 점프'); addRamp(X(13) + 3.5, X(10) - 30, Math.PI, 10, 6, 2.6, '부두 점프'); addRamp(X(4) - 3.5, X(12), Math.PI/2, 9, 5, 2.4, '미드타운 점프');
  addRamp(X(7) + 3.5, X(2) + 30, 0, 10, 5, 3, '다운타운 북쪽 점프'); addRamp(-400, 745, Math.PI/2, 10, 6, 2.8, '해변 점프'); addRamp(X(11) - 3.5, X(13) - 40, Math.PI, 9, 5, 2.4, '항구 점프');
  for (const r of W.ramps) rampMesh(r);
}
function rampMesh(r){ const geo = new THREE.BufferGeometry(); const l = r.len, w = r.wid/2, h = r.h;
  const P = [[-w, 0, 0], [w, 0, 0], [w, h, l], [-w, h, l], [-w, 0, l], [w, 0, l]];
  const idx = [0, 2, 1, 0, 3, 2, 1, 2, 5, 0, 4, 3, 4, 5, 2, 4, 2, 3];
  const pos = []; for (const i of idx) pos.push(...P[i]); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
  const uv = []; for (let i = 0; i < idx.length; i++) uv.push(P[idx[i]][0]/2, P[idx[i]][2]/2); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const m = new THREE.Mesh(geo, simpleMat('ramp', { map:plainTex('concrete'), color:0xc8b070, roughness:.7 })); m.position.set(r.x, W.onRoad(r.x, r.z) ? 0 : CURB, r.z); m.rotation.y = r.ang; m.castShadow = m.receiveShadow = true; W.root.add(m);
  // 줄무늬
  const st = new THREE.Mesh(new THREE.PlaneGeometry(r.wid*.96, Math.hypot(l, h)*.98), simpleMat('rampS', { color:0xffc800, roughness:.6, map:plainTex('xwalk'), transparent:true }));
  st.position.set(0, h/2 + .03, l/2); st.rotation.x = -Math.PI/2 + Math.atan2(h, l); m.add(st); }

// =====================================================================
//  인스턴스 소품 모델
// =====================================================================
function mergeParts(parts){ // [[geometry, color, emissive?]] → 재질별 그룹
  const byMat = new Map(); for (const [geo, mat] of parts){ if (!byMat.has(mat)) byMat.set(mat, []); byMat.get(mat).push(geo); }
  return [...byMat].map(([mat, geos])=>[mergeGeos(geos), mat]); }
function mergeGeos(geos){ const g = new THREE.BufferGeometry(); let pos = [], nor = [], uv = [], idx = [], off = 0;
  for (let geo of geos){ geo = geo.index ? geo.toNonIndexed() : geo; const p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv; for (let i = 0; i < p.count; i++){ pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); idx.push(off + i); } off += p.count; }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g; }
const T = (geo, x, y, z, rx, ry, rz, sx, sy, sz)=>{ const m = new THREE.Matrix4().compose(new THREE.Vector3(x || 0, y || 0, z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx || 1, sy || sx || 1, sz || sx || 1)); geo.applyMatrix4(m); return geo; };
W.T = T; W.mergeGeos = mergeGeos;
function protoParts(name){
  const metal = simpleMat('pmetal', { color:0x5a5e62, roughness:.5, metalness:.6 }), dark = simpleMat('pdark', { color:0x2a2c2e, roughness:.6, metalness:.4 });
  const glow = simpleMat('pglow', { color:0xfff2d0, emissive:0xffe2a0, emissiveIntensity:0, roughness:.3 }); W.lampGlow = glow;
  const cyl = (r1, r2, h, s)=>new THREE.CylinderGeometry(r1, r2, h, s || 8);
  switch (name){
    case 'lamp': return [[T(cyl(.09, .13, 8.5), 0, 4.25, 0), metal], [T(cyl(.06, .06, 2.4), 0, 8.4, .9, Math.PI/2.3), metal], [T(new THREE.BoxGeometry(.5, .16, .9), 0, 8.75, 2), dark], [T(new THREE.BoxGeometry(.4, .04, .7), 0, 8.66, 2), glow]];
    case 'hydrant': { const r = simpleMat('pred', { color:0xb81c1c, roughness:.5, metalness:.3 }); return [[T(cyl(.16, .18, .7), 0, .35, 0), r], [T(new THREE.SphereGeometry(.17, 8, 6), 0, .72, 0), r], [T(cyl(.07, .07, .5), 0, .45, 0, 0, 0, Math.PI/2), r]]; }
    case 'bin': { const g = simpleMat('pbin', { color:0x2e4a34, roughness:.7, metalness:.2 }); return [[T(cyl(.3, .26, .95, 10), 0, .48, 0), g]]; }
    case 'bench': { const w = simpleMat('pwood', { color:0x6a4a2a, roughness:.8 }); return [[T(new THREE.BoxGeometry(1.8, .06, .45), 0, .45, 0), w], [T(new THREE.BoxGeometry(1.8, .4, .05), 0, .75, -.22, -.15), w], [T(new THREE.BoxGeometry(.06, .45, .45), -.8, .22, 0), metal], [T(new THREE.BoxGeometry(.06, .45, .45), .8, .22, 0), metal]]; }
    case 'busstop': { const gl = simpleMat('pglass', { color:0x88aacc, roughness:.05, metalness:.3, transparent:true, opacity:.35 }); return [[T(new THREE.BoxGeometry(4, .1, 1.6), 0, 2.6, 0), metal], [T(new THREE.BoxGeometry(4, 2.4, .05), 0, 1.3, -.75), gl], [T(new THREE.BoxGeometry(.08, 2.6, .08), -1.95, 1.3, -.75), metal], [T(new THREE.BoxGeometry(.08, 2.6, .08), 1.95, 1.3, -.75), metal], [T(new THREE.BoxGeometry(3.4, .06, .4), 0, .5, -.5), metal]]; }
    case 'tank': { const w = simpleMat('pwood2', { color:0x5a4030, roughness:.9 }); return [[T(cyl(1.6, 1.6, 3.2, 14), 0, 4.6, 0), w], [T(new THREE.ConeGeometry(1.75, 1.2, 14), 0, 6.8, 0), dark], ...[-1, 1].flatMap(a=>[-1, 1].map(b=>[T(cyl(.1, .1, 3), a*1.1, 1.5, b*1.1), metal]))]; }
    case 'antenna': return [[T(cyl(.12, .3, 18, 6), 0, 9, 0), metal], [T(new THREE.SphereGeometry(.3, 6, 4), 0, 18.2, 0), simpleMat('pred2', { color:0xff2020, emissive:0xff0000, emissiveIntensity:2 })]];
    case 'canopy': return [[T(new THREE.BoxGeometry(28, .8, 12), 0, 6.2, 0), simpleMat('pcan', { color:0xf0f0f0, roughness:.5 })], [T(new THREE.BoxGeometry(28.2, .5, 12.2), 0, 6.5, 0), simpleMat('pcanr', { color:0xc81e1e, roughness:.5 })], ...[-12, 12].flatMap(a=>[-4, 4].map(b=>[T(cyl(.25, .25, 6), a, 3, b), metal])), [T(new THREE.BoxGeometry(27, .05, 11), 0, 5.78, 0), glow]];
    case 'pump': return [[T(new THREE.BoxGeometry(.8, 1.8, .5), 0, .9, 0), simpleMat('pcan', { color:0xf0f0f0, roughness:.5 })], [T(new THREE.BoxGeometry(.82, .4, .52), 0, 1.6, 0), simpleMat('pcanr', { color:0xc81e1e, roughness:.5 })]];
    case 'crane': { const y = simpleMat('pcrane', { color:0xe8a020, roughness:.6, metalness:.3 }); return [[T(new THREE.BoxGeometry(1.2, 30, 1.2), -4, 15, -4), y], [T(new THREE.BoxGeometry(1.2, 30, 1.2), 4, 15, -4), y], [T(new THREE.BoxGeometry(1.2, 30, 1.2), -4, 15, 4), y], [T(new THREE.BoxGeometry(1.2, 30, 1.2), 4, 15, 4), y], [T(new THREE.BoxGeometry(10, 3, 10), 0, 30, 0), y], [T(new THREE.BoxGeometry(2, 2, 60), 0, 32, 14), y], [T(new THREE.BoxGeometry(4, 4, 4), 0, 33, -14), dark]]; }
    case 'pool': return [[T(new THREE.BoxGeometry(8, .06, 4), 0, .04, 0), simpleMat('pwater', { color:0x2aa8d8, roughness:.05, metalness:.1, emissive:0x062a3a })], [T(new THREE.BoxGeometry(8.6, .1, 4.6), 0, .01, 0), simpleMat('pcan', { color:0xf0f0f0, roughness:.5 })]];
    case 'pond': return [[T(new THREE.CylinderGeometry(26, 26, .08, 40), 0, .02, 0), simpleMat('ppond', { color:0x2a5a6a, roughness:.04, metalness:.2 })], [T(new THREE.CylinderGeometry(27, 27, .1, 40), 0, .0, 0), simpleMat('pstone', { color:0x8a857a, roughness:.9 })], [T(cyl(1.2, 1.6, 1.2, 14), 0, .6, 0), simpleMat('pstone', { color:0x8a857a, roughness:.9 })]];
    case 'umbrella': return [[T(cyl(.04, .04, 2.4, 6), 0, 1.2, 0), metal], [T(new THREE.ConeGeometry(1.6, .6, 10), 0, 2.4, 0), 'tint']];
    case 'billboard': return [[T(cyl(.25, .25, 4, 6), -3, 2, 0), metal], [T(cyl(.25, .25, 4, 6), 3, 2, 0), metal], [T(new THREE.BoxGeometry(12.4, 6.4, .3), 0, 7, -.2), dark]];
    case 'container': return [[T(new THREE.BoxGeometry(2.44, 2.6, 12.2), 0, 1.3, 0), 'tint']];
  }
  return [];
}
// 나무 (gltf) → 인스턴스 부품
function gltfParts(nodeName, scale){ const src = G.A.nature && G.A.nature.getObjectByName(nodeName); if (!src) return []; const out = []; src.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(src.matrixWorld).invert();
  src.traverse(o=>{ if (!o.isMesh) return; const g = o.geometry.clone(); const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); g.applyMatrix4(m); if (scale) g.scale(scale, scale, scale);
    // 양자화된 속성을 일반 float 로
    for (const k of ['position', 'normal', 'uv']){ const a = g.attributes[k]; if (a && (a.normalized || !(a.array instanceof Float32Array))){ const arr = new Float32Array(a.count*a.itemSize); for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++){ let v = c === 0 ? a.getX(i) : c === 1 ? a.getY(i) : c === 2 ? a.getZ(i) : a.getW(i); if (a.normalized){ const A = a.array; v = A instanceof Int16Array ? Math.max(v/32767, -1) : A instanceof Uint16Array ? v/65535 : A instanceof Int8Array ? Math.max(v/127, -1) : A instanceof Uint8Array ? v/255 : v; } arr[i*a.itemSize + c] = v; } g.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize)); } }
    const mat = o.material.clone(); mat.roughness = .9; if (/Leaf|Leaves|Foliage/i.test(mat.name)) mat.side = THREE.DoubleSide; out.push([g, mat]); }); return out; }
function palmParts(){ const trunk = simpleMat('palmT', { color:0x8a7050, roughness:.95 }); const leaf = simpleMat('palmL', { color:0x3a7a2a, roughness:.8, side:THREE.DoubleSide });
  const parts = []; let x = 0, y = 0; for (let k = 0; k < 8; k++){ const g = new THREE.CylinderGeometry(.18 - k*.01, .22 - k*.01, 1.3, 7); T(g, x, y + .65, 0, 0, 0, -.04*k); parts.push([g, trunk]); x += .04*k; y += 1.25; }
  for (let k = 0; k < 9; k++){ const a = k/9*Math.PI*2; const g = new THREE.PlaneGeometry(.9, 4.2, 1, 4); const p = g.attributes.position; for (let i = 0; i < p.count; i++){ const v = p.getY(i) + 2.1; p.setZ(i, -v*v*.07); p.setX(i, p.getX(i)*(1 - v/5)); p.setY(i, v); } g.computeVertexNormals(); T(g, 0, 0, 0, -1.1, 0, 0); T(g, x, y, 0, 0, a, 0); parts.push([g, leaf]); }
  return parts; }
const CONT_COL = [0xb83a2a, 0x2a5aa8, 0x2a8a4a, 0xd89a2a, 0x6a6a72, 0x8a2a6a];
// 가벼운 나무 (인스턴스 수천 개라 삼각형을 아낀다)
function blob(r, seed){ const g = new THREE.IcosahedronGeometry(r, 1); const p = g.attributes.position; const rng = U.seeded(seed); const map = new Map();
  for (let i = 0; i < p.count; i++){ const k = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3); let f = map.get(k); if (f === undefined){ f = .8 + rng()*.4; map.set(k, f); } p.setXYZ(i, p.getX(i)*f, p.getY(i)*f*.85, p.getZ(i)*f); } g.computeVertexNormals(); return g; }
function treeParts(kind){
  const bark = simpleMat('bark', { color:0x5a4430, roughness:.95 });
  if (kind === 'pine'){ const lf = simpleMat('pineL', { color:0x2e4a2a, roughness:.9, flatShading:true }); return [[T(new THREE.CylinderGeometry(.18, .28, 3, 6), 0, 1.5, 0), bark], [T(new THREE.ConeGeometry(2.6, 4, 8), 0, 4, 0), lf], [T(new THREE.ConeGeometry(2, 3.4, 8), 0, 6.2, 0), lf], [T(new THREE.ConeGeometry(1.3, 2.8, 8), 0, 8.2, 0), lf]]; }
  if (kind === 'bush'){ const lf = simpleMat('bushL', { color:0x3e6a2a, roughness:.9, flatShading:true }); return [[T(blob(1, 3), 0, .6, 0, 0, 0, 0, 1.2, .8, 1.2), lf], [T(blob(.8, 4), .7, .5, .3), lf]]; }
  const lf = simpleMat('treeL', { color:0x4a7a30, roughness:.85, flatShading:true });
  return [[T(new THREE.CylinderGeometry(.2, .32, 4.2, 6), 0, 2.1, 0), bark], [T(new THREE.CylinderGeometry(.08, .14, 2, 5), .5, 4, 0, 0, 0, -.6), bark],
    [T(blob(2.4, 1), 0, 5.6, 0), lf], [T(blob(1.8, 2), 1.4, 4.9, .4), lf], [T(blob(1.7, 5), -1.2, 5, -.5), lf], [T(blob(1.5, 6), .2, 7, -.2), lf]]; }
function buildInstances(){
  const dummy = new THREE.Object3D(); W.inst = {}; const CK = 400;
  for (const name in INST){
    const list = INST[name]; let parts;
    if (name === 'tree' || name === 'pine' || name === 'bush') parts = treeParts(name);
    else if (name === 'palm') parts = palmParts();
    else parts = protoParts(name);
    if (!parts.length) continue;
    const merged = mergeParts(parts);
    // 청크별로 나눠서 화면 밖은 안 그림
    const groups = new Map(); list.forEach((p, i)=>{ const k = Math.floor(p.x/CK) + ',' + Math.floor(p.z/CK); let g = groups.get(k); if (!g){ g = { idxs:[], cx:(Math.floor(p.x/CK) + .5)*CK, cz:(Math.floor(p.z/CK) + .5)*CK, meshes:[] }; groups.set(k, g); } p.g = g; p.li = g.idxs.length; g.idxs.push(i); });
    let maxY = 0; for (const p of list) maxY = Math.max(maxY, p.y);
    for (const g of groups.values()){
      for (const [geo, mat0] of merged){
        const tint = mat0 === 'tint'; const mat = tint ? simpleMat('tint_' + name, { color:0xffffff, roughness:.6, metalness:name === 'container' ? .3 : 0 }) : mat0;
        const gg = new THREE.BufferGeometry(); for (const k in geo.attributes) gg.setAttribute(k, geo.attributes[k]); if (geo.index) gg.setIndex(geo.index);
        gg.boundingSphere = new THREE.Sphere(new THREE.Vector3(g.cx, maxY/2, g.cz), CK*.75 + maxY/2 + 40);
        const im = new THREE.InstancedMesh(gg, mat, g.idxs.length); im.castShadow = !/hydrant|bin|pool|umbrella/.test(name); im.receiveShadow = true;
        g.idxs.forEach((li, k)=>{ const p = list[li]; dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, p.ry, 0); dummy.scale.setScalar(p.s); dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix);
          if (tint){ const c = name === 'container' ? CONT_COL[(p.e || 0)%CONT_COL.length] : [0xe83a3a, 0x2a7ae8, 0xf2c82a, 0x2ab86a][(p.e || 0)%4]; im.setColorAt(k, LC(c)); } });
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        W.root.add(im); g.meshes.push(im); } }
    W.inst[name] = { list, groups:[...groups.values()] };
    // 광고판 그림
    if (name === 'billboard') list.forEach((p, i)=>{ const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshStandardMaterial({ map:adTex(p.e || i), emissive:0xffffff, emissiveMap:adTex(p.e || i), emissiveIntensity:.35, roughness:.6 })); m.position.set(p.x, p.y + 7, p.z); m.rotation.y = p.ry; m.translateZ(-.04); W.root.add(m); W.billboards = (W.billboards || []).concat(m); });
    if (name === 'container') list.forEach(p=>W.addBox(p.x - 1.3, p.z - 6.1, p.x + 1.3, p.z + 6.1, p.y + 2.6));
  }
  // 가로등 불빛 웅덩이 (밤)
  const lp = INST.lamp || []; const poolGeo = new THREE.PlaneGeometry(14, 14); poolGeo.rotateX(-Math.PI/2);
  const pc = document.createElement('canvas'); pc.width = pc.height = 128; const px = pc.getContext('2d'); const gr = px.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,220,160,1)'); gr.addColorStop(.5, 'rgba(255,200,130,.35)'); gr.addColorStop(1, 'rgba(255,200,130,0)'); px.fillStyle = gr; px.fillRect(0, 0, 128, 128);
  W.poolMat = new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(pc), transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false });
  const pools = new THREE.InstancedMesh(poolGeo, W.poolMat, lp.length); lp.forEach((p, i)=>{ dummy.position.set(p.x + Math.sin(p.ry)*1.2, .2, p.z + Math.cos(p.ry)*1.2); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); pools.setMatrixAt(i, dummy.matrix); }); pools.frustumCulled = false; pools.renderOrder = 2; W.root.add(pools); W.pools = pools;
}
// 부딪힌 가로등 · 소화전 쓰러뜨리기
W.knockPost = (p, dirx, dirz)=>{ if (!p.alive || !/lamp|hydrant/.test(p.kind)) return false; p.alive = false; const I = W.inst[p.kind]; if (!I) return true; const d = I.list[p.idx]; if (!d) return true;
  const m = new THREE.Matrix4(); const o = new THREE.Object3D(); o.position.set(d.x, d.y, d.z); o.rotation.set(0, 0, 0); o.rotateOnWorldAxis(new THREE.Vector3(dirz, 0, -dirx).normalize(), p.kind === 'lamp' ? 1.35 : 1.5); o.rotateY(d.ry); o.updateMatrix();
  if (p.kind === 'hydrant'){ o.position.y -= 10; o.updateMatrix(); G.emit('hydrant', d.x, d.z); }
  for (const im of d.g.meshes){ im.setMatrixAt(d.li, o.matrix); im.instanceMatrix.needsUpdate = true; } if (p.kind === 'lamp' && W.pools){ m.makeScale(0, 0, 0); W.pools.setMatrixAt(p.idx, m); W.pools.instanceMatrix.needsUpdate = true; } return true; };

// =====================================================================
//  신호등
// =====================================================================
W.signals = [];
function buildSignals(){
  const poles = [], heads = [];
  for (const n of W.nodes){ if (!n.sig) continue;
    // 진입 방향 4개: 오는 차의 오른쪽 모퉁이에 기둥, 팔이 차선 위로
    const appr = [[-1, 0, 'x'], [1, 0, 'x'], [0, -1, 'z'], [0, 1, 'z']];
    for (const [ax, az, axis] of appr){ // 차가 (ax,az) 쪽에서 들어옴 → 진행 방향 = -(ax,az)
      const hasIn = n.nb.some(([i, j])=>i - n.i === ax && j - n.j === az); if (!hasIn) continue;
      const dx = -ax, dz = -az; const rx = -dz, rz = dx; // 진행 방향의 오른쪽
      const cx = n.x + ax*(RW + 1.2) + rx*(RW + 1.2), cz = n.z + az*(RW + 1.2) + rz*(RW + 1.2);
      const ry = Math.atan2(-dx, -dz); // 머리가 오는 차를 바라봄
      poles.push({ x:cx, z:cz, ry, rx, rz }); W.addPost(cx, cz, .2, { kind:'signal' });
      const hx = cx - rx*4.2, hz = cz - rz*4.2; heads.push({ x:hx, z:hz, ry, n, axis });
    }
  }
  const dummy = new THREE.Object3D(); const metal = simpleMat('sigm', { color:0x3a3c3e, roughness:.5, metalness:.6 });
  const pg = mergeGeos([T(new THREE.CylinderGeometry(.13, .16, 6.2, 8), 0, 3.1, 0), T(new THREE.CylinderGeometry(.08, .08, 5, 6), -2.5, 5.9, 0, 0, 0, Math.PI/2)]);
  const pm = new THREE.InstancedMesh(pg, metal, poles.length);
  poles.forEach((p, i)=>{ dummy.position.set(p.x, CURB, p.z); dummy.rotation.set(0, Math.atan2(-p.rx, -p.rz) - Math.PI/2, 0); dummy.updateMatrix(); pm.setMatrixAt(i, dummy.matrix); }); pm.castShadow = true; pm.frustumCulled = false; W.root.add(pm);
  const hg = T(new THREE.BoxGeometry(.45, 1.3, .35), 0, 0, 0); const hm = new THREE.InstancedMesh(hg, simpleMat('sigh', { color:0x1a1a1a, roughness:.6 }), heads.length);
  const bg = new THREE.SphereGeometry(.13, 8, 6); const bm = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color:0xffffff }), heads.length*3);
  heads.forEach((h, i)=>{ dummy.position.set(h.x, CURB + 5.4, h.z); dummy.rotation.set(0, h.ry, 0); dummy.updateMatrix(); hm.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < 3; k++){ const o = new THREE.Object3D(); o.position.set(h.x, CURB + 5.8 - k*.4, h.z); o.rotation.set(0, h.ry, 0); o.translateZ(.18); o.updateMatrix(); bm.setMatrixAt(i*3 + k, o.matrix); bm.setColorAt(i*3 + k, new THREE.Color(0x111111)); } });
  hm.frustumCulled = bm.frustumCulled = false; W.root.add(hm); W.root.add(bm); W.sigHeads = heads; W.sigBulbs = bm; W._sigLast = -1;
}
const SC = { r:new THREE.Color(3, .15, .1), y:new THREE.Color(3, 1.8, .1), g:new THREE.Color(.2, 3, .6), off:new THREE.Color(.05, .05, .05) };
W.updateSignals = t=>{ const k = Math.floor(t*2); if (k === W._sigLast || !W.sigBulbs) return; W._sigLast = k; const bm = W.sigBulbs;
  W.sigHeads.forEach((h, i)=>{ const s = W.canGo(h.n, h.axis, t); bm.setColorAt(i*3, s === 0 ? SC.r : SC.off); bm.setColorAt(i*3 + 1, s === 1 ? SC.y : SC.off); bm.setColorAt(i*3 + 2, s === 2 ? SC.g : SC.off); }); bm.instanceColor.needsUpdate = true; };

// =====================================================================
//  바다
// =====================================================================
function buildWater(){
  const L = W.LAND - 5; const geo = mergeGeos([T(new THREE.PlaneGeometry(9000, 4500), 0, 0, L + 2250, -Math.PI/2), T(new THREE.PlaneGeometry(4500, L + 4500), L + 2250, 0, (L - 4500)/2, -Math.PI/2)]);
  const m = new THREE.MeshStandardMaterial({ color:0x0e3a52, roughness:.08, metalness:.2, transparent:true, opacity:.94 });
  m.onBeforeCompile = sh=>{ sh.uniforms.uT = W.U.uT; sh.vertexShader = 'varying vec3 vWPw;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWPw = (modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = 'uniform float uT; varying vec3 vWPw;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { vec2 p = vWPw.xz; float t = uT;
        vec3 n = vec3(0.); n.x += cos(p.x*.05 + t*.7)*.12 + cos(p.x*.23 + p.y*.11 + t*1.6)*.05 + cos(p.x*.9 - p.y*.6 + t*3.)*.02; n.z += cos(p.y*.06 + t*.5)*.12 + cos(p.y*.27 - p.x*.13 + t*1.9)*.05 + cos(p.y*1.1 + p.x*.7 + t*2.7)*.02;
        normal = normalize(normal + (viewMatrix*vec4(n.x, 0., n.z, 0.)).xyz); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        { float sh = smoothstep(${W.LAND + 60}., ${W.LAND}., max(vWPw.x, vWPw.z)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.1, .45, .5), sh*.6); }`); };
  const w = new THREE.Mesh(geo, m); w.position.y = -.35; w.receiveShadow = false; W.root.add(w); W.water = w;
}
// 먼 산
function buildMountains(){ const src = G.A.world && G.A.world.getObjectByName('M_mountain_A_grass_trees'); const mat = simpleMat('mtn', { color:0x4a5a3c, roughness:1, flatShading:true });
  for (let k = 0; k < 18; k++){ const a = Math.PI*.9 + k/18*Math.PI*.95; const r = 1600 + Math.random()*500; const H = 160 + Math.random()*260; const g = new THREE.ConeGeometry(300 + Math.random()*260, H, 18, 8); const p = g.attributes.position; const rng = U.seeded(k*31 + 5);
    for (let i = 0; i < p.count; i++){ const y = p.getY(i), t = (y + H/2)/H; const f = 1 + (rng() - .5)*.35*(1 - t) + Math.sin(Math.atan2(p.getZ(i), p.getX(i))*3 + k)*.12; p.setX(i, p.getX(i)*f); p.setZ(i, p.getZ(i)*f); p.setY(i, y - Math.pow(1 - t, 2)*H*.25*rng()); } g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.position.set(Math.cos(a)*r, 60, Math.sin(a)*r); W.root.add(m); } }

W.build = scene=>{
  W.root = new THREE.Group(); scene.add(W.root);
  buildCity(); buildWater(); buildMountains();
  W.root.traverse(o=>{ if (o.isMesh && !o.isInstancedMesh){ o.matrixAutoUpdate = false; o.updateMatrix(); } });
};
// 밤 · 날씨에 따라 재질 갱신
W.setNight = (k, wet)=>{ W.U.uNight.value = k; W.U.uWet.value = wet; if (W.lampGlow) W.lampGlow.emissiveIntensity = k*4; if (W.poolMat) W.poolMat.opacity = k*.2; };
W.tex = { textTex, plainTex, adTex, LC };
})();
