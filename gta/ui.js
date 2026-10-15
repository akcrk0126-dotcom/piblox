// =====================================================================
//  화면: HUD · 미니맵 · 큰 지도 · 무기 휠 · 일시정지 메뉴 · 상점 · 알림
// =====================================================================
'use strict';
(function(){
const U = G.U, $ = U.$, W = G.world;
const UI = G.ui = { open:null, waypoint:null, route:[], routeT:0 };

// ----- 무기 아이콘 (실루엣) -----
const WICON = {
  fist:'<path d="M20 10h22a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5H24l-6-4v-8z" fill="currentColor"/><path d="M26 10v16M33 10v16M40 10v16" stroke="#000" stroke-width="1.5"/>',
  bat:'<path d="M4 20l46-10a3 3 0 0 1 2 5L8 24z" fill="currentColor"/>',
  pistol:'<path d="M14 9h34v7H30l-2 4h-6l-2 10h-8l3-14h-3z" fill="currentColor"/>',
  smg:'<path d="M6 9h44v6h-6v3H34l-2 3h-4v9h-6v-9h-3l-2 6h-6l2-8H8z" fill="currentColor"/><rect x="36" y="15" width="5" height="12" fill="currentColor"/>',
  shotgun:'<path d="M2 18l12-4h40v5H32l-4 3H18l-6 5H4z" fill="currentColor"/><rect x="30" y="19" width="18" height="3" fill="currentColor"/>',
  rifle:'<path d="M2 16l10-4h10l2-3h26v4h8v3H44l-2 3h-6l-1 9h-5l1-9h-4l-2 6h-5l1-6h-8l-8 4H4z" fill="currentColor"/>',
  sniper:'<path d="M2 18l12-4h46v3H40l-3 4h-6l-2 3H16l-6 4H4z" fill="currentColor"/><rect x="22" y="8" width="16" height="4" rx="2" fill="currentColor"/>',
  rpg:'<rect x="4" y="12" width="52" height="8" rx="3" fill="currentColor"/><path d="M56 10l8 6-8 6zM22 20h5v8h-5zM34 20h4v6h-4z" fill="currentColor"/>',
  grenade:'<circle cx="32" cy="19" r="9" fill="currentColor"/><rect x="28" y="6" width="8" height="5" fill="currentColor"/><path d="M36 8h6v3" stroke="currentColor" stroke-width="2" fill="none"/>',
};
const wsvg = k=>'<svg viewBox="0 0 64 32">' + (WICON[k] || '') + '</svg>';
UI.wsvg = wsvg;
const STAR = '<svg viewBox="0 0 24 24"><path class="s" d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z"/></svg>';

// ----- 기본 HUD -----
UI.init = ()=>{
  $('stars').innerHTML = STAR.repeat(5);
  buildMinimapBase();
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick = ()=>UI.close());
  document.querySelectorAll('[data-ui]').forEach(b=>b.addEventListener('touchstart', e=>{ e.preventDefault(); const k = b.dataset.ui; if (k === 'map') UI.toggle('map'); else if (k === 'menu') UI.toggle('menu'); else if (k === 'wheel') UI.wheel(!UI.wheelOn); }, { passive:false }));
  setupBigMap(); buildLegend();
};
let lastMoney = -1, moneyT = 0;
UI.update = dt=>{
  const P = G.player, S = G.save;
  // 돈
  if (S.money !== lastMoney){ const diff = S.money - lastMoney; if (lastMoney >= 0 && diff !== 0){ const c = $('cash'); c.textContent = (diff > 0 ? '+' : '−') + U.fmtMoney(Math.abs(diff)).slice(0); c.style.color = diff > 0 ? '#7ee08a' : '#ff6a6a'; c.classList.add('on'); clearTimeout(moneyT); moneyT = setTimeout(()=>c.classList.remove('on'), 1600); } lastMoney = S.money; $('money').textContent = U.fmtMoney(S.money); }
  // 별
  const st = $('stars'); [...st.children].forEach((s, i)=>s.firstChild.classList.toggle('on', i < G.wanted.level)); st.classList.toggle('blink', G.wanted.level > 0 && !G.wanted.seen);
  st.style.opacity = G.wanted.level > 0 ? 1 : .35;
  // 무기
  const wk = P.weapon, w = G.weapons.W[wk]; const key = wk + '|' + (P.clip[wk] || 0) + '|' + (S.ammo[wk] || 0) + '|' + (P.reloadT > 0);
  if (key !== UI._wk){ UI._wk = key; $('wpn').innerHTML = wsvg(wk) + (w.mag ? '<b>' + (P.reloadT > 0 ? '…' : (P.clip[wk] || 0)) + '</b><small>/ ' + (S.ammo[wk] || 0) + '</small>' : w.thrown ? '<b>' + (S.ammo[wk] || 0) + '</b>' : ''); }
  // 체력
  $('hpb').firstChild.style.width = (P.hp/P.maxHp*100) + '%'; $('hpb').classList.toggle('low', P.hp < 30); $('arb').firstChild.style.width = P.armor + '%';
  $('dmgv').style.opacity = P.alive ? Math.max(0, (35 - P.hp)/35)*.8 : 0;
  // 지역 · 시간
  const ax = P.inCar ? P.car.x : P.x, az = P.inCar ? P.car.z : P.z; const area = W.areaName(ax, az) + '<small>' + G.env.clock() + ' · ' + G.env.WNAME[G.env.weather] + '</small>';
  if (area !== UI._area){ UI._area = area; $('area').innerHTML = area; }
  // 속도계
  const sp = $('speedo'); if (P.inCar && P.car){ sp.classList.remove('hide'); sp.firstChild.textContent = Math.round(P.car.speed*3.6); sp.querySelector('.dmg i').style.width = Math.max(0, P.car.hp/P.car.t.hp*100) + '%'; } else sp.classList.add('hide');
  document.body.classList.toggle('car', P.inCar);
  // 조준점
  const showC = P.alive && !P.scope && (P.aimK > .3 || (P.inCar && I_fire())) && !w.melee; const cr = $('cross'); cr.classList.toggle('on', showC); cr.classList.toggle('dot', P.inCar);
  $('scope').classList.toggle('on', !!P.scope);
  drawMinimap(dt);
  if (UI.open === 'map') drawBigMap();
  // 경로
  UI.routeT -= dt; if (UI.waypoint && UI.routeT <= 0){ UI.routeT = 1; UI.route = G.wanted.route(ax, az, UI.waypoint.x, UI.waypoint.z); if (Math.hypot(ax - UI.waypoint.x, az - UI.waypoint.z) < 25){ UI.waypoint = null; UI.route = []; UI.help('목적지에 도착했어요.', 2); } }
};
const I_fire = ()=>G.input.mouseR || G.input.tb.fire;
G.on('hitmark', head=>{ const h = $('hitm'); h.className = ''; void h.offsetWidth; h.className = 'on' + (head ? ' head' : ''); });

// ----- 알림 -----
let helpT = 0; UI.help = (html, sec)=>{ const h = $('help'); h.innerHTML = html; h.classList.add('on'); clearTimeout(helpT); helpT = setTimeout(()=>h.classList.remove('on'), (sec || 5)*1000); };
UI.helpOff = ()=>$('help').classList.remove('on');
let subT = 0; UI.sub = (html, sec)=>{ $('sub').innerHTML = html; clearTimeout(subT); if (sec !== 0) subT = setTimeout(()=>$('sub').innerHTML = '', (sec || 4)*1000); };
let bigT = 0; UI.big = (title, cls, p, sec)=>{ const b = $('big'); b.querySelector('h1').textContent = title; b.querySelector('h1').className = cls || ''; b.querySelector('p').innerHTML = p || ''; b.classList.add('on'); clearTimeout(bigT); bigT = setTimeout(()=>b.classList.remove('on'), (sec || 3)*1000); };
let popT = 0; UI.pop = (title, small)=>{ const p = $('pop'); p.innerHTML = U.esc(title) + (small ? '<small>' + U.esc(small) + '</small>' : ''); p.classList.add('on'); clearTimeout(popT); popT = setTimeout(()=>p.classList.remove('on'), 3000); };
UI.feed = text=>{ const d = document.createElement('div'); d.textContent = text; $('feed').prepend(d); setTimeout(()=>d.remove(), 4000); while ($('feed').children.length > 5) $('feed').lastChild.remove(); };
UI.obj = (t, s)=>{ $('obj').innerHTML = t ? '<div class="t">' + U.esc(t) + '</div>' + (s ? U.esc(s) : '') : ''; };
UI.timer = sec=>{ const t = $('timer'); if (sec == null){ t.classList.add('hide'); return; } t.classList.remove('hide'); const m = Math.floor(sec/60), s = Math.floor(sec%60); t.textContent = m + ':' + (s < 10 ? '0' : '') + s; t.classList.toggle('low', sec < 10); };
let radT = 0; G.on('radio', i=>{ const r = $('radio'); const S = G.audio.STATIONS[i]; r.querySelector('b').textContent = S ? S.name : '라디오 끔'; r.querySelector('small').textContent = S ? S.genre : ''; r.classList.add('on'); clearTimeout(radT); radT = setTimeout(()=>r.classList.remove('on'), 2500); });

// =====================================================================
//  미니맵
// =====================================================================
let base = null; const MS = .5; // 1px = 2m
function buildMinimapBase(){
  const size = 1800; const c = document.createElement('canvas'); c.width = c.height = size*MS; const x = c.getContext('2d'); const o = size/2; const tp = v=>(v + o)*MS;
  x.fillStyle = '#2a4a5e'; x.fillRect(0, 0, c.width, c.height); // 바다
  x.fillStyle = '#3e5a3a'; x.fillRect(0, 0, tp(W.LAND), tp(W.LAND)); // 땅
  x.fillStyle = '#c8b480'; x.fillRect(0, tp(W.HALF + W.RW), tp(W.LAND), tp(W.LAND) - tp(W.HALF + W.RW)); // 모래
  x.fillStyle = '#5a5e64'; x.fillRect(tp(W.HALF + W.RW), 0, tp(W.LAND) - tp(W.HALF + W.RW), tp(W.HALF + W.RW));
  const COL = { down:'#4a4e58', mid:'#555a52', res:'#4a6a40', rich:'#4e7046', park:'#3e7a36', ind:'#5e5a54', beach:'#6a6a5a' };
  for (let ci = 0; ci < W.N; ci++) for (let cj = 0; cj < W.N; cj++){ const d = W.district(W.X(ci) + 50, W.X(cj) + 50); x.fillStyle = COL[d] || '#555'; x.fillRect(tp(W.X(ci)), tp(W.X(cj)), CELLPX, CELLPX); }
  // 건물
  x.fillStyle = 'rgba(30,32,38,.55)'; for (const b of W.boxes){ if (!b.bld) continue; x.fillRect(tp(b.x0), tp(b.z0), (b.x1 - b.x0)*MS, (b.z1 - b.z0)*MS); }
  // 도로
  x.fillStyle = '#c8ccd2'; for (const n of W.nodes){ for (const [i, j] of n.nb){ const m = W.nodeAt[i + ',' + j]; if (!m) continue; const x0 = Math.min(n.x, m.x) - W.RW, z0 = Math.min(n.z, m.z) - W.RW, x1 = Math.max(n.x, m.x) + W.RW, z1 = Math.max(n.z, m.z) + W.RW; x.fillRect(tp(x0), tp(z0), (x1 - x0)*MS, (z1 - z0)*MS); } }
  base = { c, o, size };
}
const CELLPX = W.CELL*MS;
const BLIP = { gunshop:['#e2342f', 'G'], gunshop2:['#e2342f', 'G'], clothes:['#b06ad8', 'C'], hospital:['#ff5a6a', 'H'], police:['#3a7ae8', 'P'], bank:['#3ec46d', '$'], gas:['#f5a518', 'F'], spray:['#3aa0ff', 'R'], safe:['#ffffff', 'S'], diner:['#ff8a3a', 'D'], modshop:['#f5c518', 'M'] };
function blip(x, cx, cy, kind, label, r){ x.beginPath(); x.arc(cx, cy, r || 7, 0, 7); x.fillStyle = '#111'; x.fill(); x.lineWidth = 2; x.strokeStyle = kind; x.stroke(); if (label){ x.fillStyle = kind; x.font = '900 ' + Math.round((r || 7)*1.4) + 'px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, cx, cy + .5); } }
UI.blips = []; // 미션이 넣는 표시 { x, z, col, label, route }
function drawMinimap(dt){
  const cv = $('mm'), x = cv.getContext('2d'); const w = cv.width, h = cv.height; const P = G.player; const px = P.inCar ? P.car.x : P.x, pz = P.inCar ? P.car.z : P.z;
  const sp = P.inCar && P.car ? P.car.speed : 0; UI.mmZoom = U.damp(UI.mmZoom || 2.2, sp > 20 ? 1.2 : sp > 8 ? 1.7 : 2.4, 1.5, dt); const z = UI.mmZoom;
  const rot = G.player.cam.yaw; // 카메라가 보는 방향이 위
  x.save(); x.fillStyle = '#2a4a5e'; x.fillRect(0, 0, w, h); x.translate(w/2, h*.62); x.rotate(rot); x.scale(z, z);
  x.drawImage(base.c, -(px + base.o)*MS, -(pz + base.o)*MS);
  // 경로
  const route = UI.route.length ? UI.route : (UI.blips.find(b=>b.route) || {})._route || [];
  if (route.length){ x.strokeStyle = UI.waypoint ? '#c86ae8' : '#f5c518'; x.lineWidth = 5/z; x.lineJoin = 'round'; x.beginPath(); x.moveTo(0, 0); for (const n of route) x.lineTo((n.x - px)*MS, (n.z - pz)*MS); const end = UI.waypoint || UI.blips.find(b=>b.route); if (end) x.lineTo((end.x - px)*MS, (end.z - pz)*MS); x.stroke(); }
  // 수배 수색 범위
  if (G.wanted.level > 0 && !G.wanted.seen){ x.fillStyle = 'rgba(80,120,255,.18)'; x.strokeStyle = 'rgba(120,160,255,.6)'; x.lineWidth = 2/z; x.beginPath(); x.arc((G.wanted.last.x - px)*MS, (G.wanted.last.z - pz)*MS, (80 + G.wanted.level*30)*MS, 0, 7); x.fill(); x.stroke(); }
  x.restore();
  // 표시들 (회전된 좌표 → 화면)
  const toScr = (bx, bz)=>{ const dx = (bx - px)*MS*z, dz = (bz - pz)*MS*z; const c = Math.cos(rot), s = Math.sin(rot); return [w/2 + dx*c - dz*s, h*.62 + dx*s + dz*c]; };
  const clampE = (p)=>{ const m = 10; const inside = p[0] > m && p[0] < w - m && p[1] > m && p[1] < h - m; if (inside) return [p, false]; const cx = w/2, cy = h*.62; const dx = p[0] - cx, dy = p[1] - cy; const k = Math.min((w/2 - m)/Math.abs(dx || 1e-6), (dy > 0 ? h - m - cy : cy - m)/Math.abs(dy || 1e-6)); return [[cx + dx*k, cy + dy*k], true]; };
  for (const s of W.specials){ const p = toScr(s.x, s.z); if (p[0] < -10 || p[0] > w + 10 || p[1] < -10 || p[1] > h + 10) continue; const b = BLIP[s.type]; if (b) blip(x, p[0], p[1], b[0], b[1], 7); }
  for (const b of UI.blips){ const [p, edge] = clampE(toScr(b.x, b.z)); blip(x, p[0], p[1], b.col || '#f5c518', b.label || '', edge ? 6 : 8); }
  if (UI.waypoint){ const [p] = clampE(toScr(UI.waypoint.x, UI.waypoint.z)); x.fillStyle = '#c86ae8'; x.beginPath(); x.moveTo(p[0], p[1] - 9); x.lineTo(p[0] + 6, p[1]); x.lineTo(p[0], p[1] + 9); x.lineTo(p[0] - 6, p[1]); x.fill(); }
  // 경찰
  const fl = Math.floor(G.wanted.flash*4)%2;
  for (const v of G.veh.list){ if (!v.t.police || v.dead || v.driver === 'player') continue; const p = toScr(v.x, v.z); if (p[0] < 0 || p[0] > w || p[1] < 0 || p[1] > h) continue; x.fillStyle = G.wanted.level > 0 ? (fl ? '#ff3a3a' : '#3a7aff') : '#6a8aff'; x.beginPath(); x.arc(p[0], p[1], 4.5, 0, 7); x.fill(); }
  if (G.wanted.heli){ const p = toScr(G.wanted.heli.x, G.wanted.heli.z); x.fillStyle = fl ? '#ff3a3a' : '#3a7aff'; x.fillRect(p[0] - 5, p[1] - 5, 10, 10); }
  for (const pd of G.peds.list){ if (!pd.alive || !pd.hostile || pd.car) continue; const p = toScr(pd.x, pd.z); if (p[0] < 0 || p[0] > w || p[1] < 0 || p[1] > h) continue; x.fillStyle = pd.kind === 'cop' ? (fl ? '#ff3a3a' : '#3a7aff') : '#e2342f'; x.beginPath(); x.arc(p[0], p[1], 3.5, 0, 7); x.fill(); }
  // 나 (화살표)
  const ph = P.inCar ? P.car.h : P.h; x.save(); x.translate(w/2, h*.62); x.rotate(rot - ph + Math.PI); x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -10); x.lineTo(7, 8); x.lineTo(0, 4); x.lineTo(-7, 8); x.closePath(); x.stroke(); x.fill(); x.restore();
  // 북쪽
  const np = [w/2 + Math.sin(rot)*-0, 0]; const nx = w/2 - Math.sin(-rot)*(h*.55), ny = h*.62 - Math.cos(-rot)*(h*.55); const [nn] = clampE([nx, ny]); x.fillStyle = '#fff'; x.font = '900 13px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('N', nn[0], nn[1]); void np;
}

// =====================================================================
//  큰 지도
// =====================================================================
const BM = { cx:0, cz:0, zoom:1, drag:null };
function setupBigMap(){ const c = $('bigmap');
  const toWorld = (e)=>{ const r = c.getBoundingClientRect(); const sx = (e.clientX - r.left)*(c.width/r.width), sy = (e.clientY - r.top)*(c.height/r.height); const k = BM.k(); return { x:BM.cx + (sx - c.width/2)/k, z:BM.cz + (sy - c.height/2)/k }; };
  BM.k = ()=>Math.min(c.width, c.height)/1700*BM.zoom;
  c.addEventListener('wheel', e=>{ BM.zoom = U.clamp(BM.zoom*(e.deltaY < 0 ? 1.15 : .87), .8, 6); e.preventDefault(); }, { passive:false });
  c.addEventListener('pointerdown', e=>{ BM.drag = { x:e.clientX, y:e.clientY, cx:BM.cx, cz:BM.cz, moved:false }; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', e=>{ const d = BM.drag; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true; const k = BM.k()*(c.getBoundingClientRect().width/c.width); BM.cx = d.cx - dx/k; BM.cz = d.cz - dy/k; });
  c.addEventListener('pointerup', e=>{ const d = BM.drag; BM.drag = null; if (d && !d.moved){ const p = toWorld(e); if (UI.waypoint && Math.hypot(UI.waypoint.x - p.x, UI.waypoint.z - p.z) < 30/BM.k()){ UI.waypoint = null; UI.route = []; } else { UI.waypoint = p; UI.routeT = 0; G.audio.sfx('ui'); } } });
}
function drawBigMap(){ const c = $('bigmap'); const r = c.getBoundingClientRect(); if (c.width !== Math.round(r.width) || c.height !== Math.round(r.height)){ c.width = Math.round(r.width); c.height = Math.round(r.height); }
  const x = c.getContext('2d'), w = c.width, h = c.height, k = BM.k(); x.fillStyle = '#2a4a5e'; x.fillRect(0, 0, w, h);
  x.save(); x.translate(w/2, h/2); x.scale(k, k); x.translate(-BM.cx, -BM.cz); x.imageSmoothingEnabled = true; x.drawImage(base.c, -base.o, -base.o, base.size, base.size);
  if (UI.route.length){ x.strokeStyle = '#c86ae8'; x.lineWidth = 6/k; x.beginPath(); const P = G.player; x.moveTo(P.inCar ? P.car.x : P.x, P.inCar ? P.car.z : P.z); for (const n of UI.route) x.lineTo(n.x, n.z); x.lineTo(UI.waypoint.x, UI.waypoint.z); x.stroke(); }
  x.restore();
  const scr = (wx, wz)=>[w/2 + (wx - BM.cx)*k, h/2 + (wz - BM.cz)*k];
  // 지역 이름
  x.font = '900 13px Noto Sans KR, sans-serif'; x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,.55)';
  for (const [n, wx, wz] of [['다운타운', 0, 0], ['미드타운', 300, -350], ['메이플 주택가', -480, -460], ['바인우드 언덕', 380, -520], ['루나 공원', -500, 50], ['항만 공업지구', 600, 0], ['선셋 비치', 0, 740], ['북부 언덕', -200, -780]]){ const p = scr(wx, wz); x.fillText(n, p[0], p[1]); }
  for (const s of W.specials){ const b = BLIP[s.type]; if (!b) continue; const p = scr(s.x, s.z); blip(x, p[0], p[1], b[0], b[1], 9); }
  for (const b of UI.blips){ const p = scr(b.x, b.z); blip(x, p[0], p[1], b.col || '#f5c518', b.label || '', 10); }
  for (const r of W.ramps){ if (G.save.jumps.includes(r.name)) continue; }
  if (UI.waypoint){ const p = scr(UI.waypoint.x, UI.waypoint.z); x.fillStyle = '#c86ae8'; x.beginPath(); x.moveTo(p[0], p[1] - 12); x.lineTo(p[0] + 8, p[1]); x.lineTo(p[0], p[1] + 12); x.lineTo(p[0] - 8, p[1]); x.fill(); }
  const P = G.player; const p = scr(P.inCar ? P.car.x : P.x, P.inCar ? P.car.z : P.z); const ph = P.inCar ? P.car.h : P.h; x.save(); x.translate(p[0], p[1]); x.rotate(-ph + Math.PI); x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -12); x.lineTo(8, 10); x.lineTo(0, 5); x.lineTo(-8, 10); x.closePath(); x.stroke(); x.fill(); x.restore();
}
function buildLegend(){ const items = [['내 집 · 저장', '#fff'], ['총포상', '#e2342f'], ['옷가게', '#b06ad8'], ['병원', '#ff5a6a'], ['경찰서', '#3a7ae8'], ['은행', '#3ec46d'], ['주유소', '#f5a518'], ['도색소', '#3aa0ff'], ['식당', '#ff8a3a'], ['튜닝샵', '#f5c518'], ['미션', '#f5c518']]; $('legend').innerHTML = items.map(([n, c])=>'<span><i style="background:' + c + '"></i>' + n + '</span>').join(''); }

// =====================================================================
//  창 열기 · 닫기
// =====================================================================
UI.toggle = id=>{ if (UI.open === id) UI.close(); else UI.show(id); };
UI.show = id=>{ UI.close(true); UI.open = id; $(id).classList.add('on'); if (document.pointerLockElement) document.exitPointerLock(); G.paused = true;
  if (id === 'map'){ const P = G.player; BM.cx = P.inCar ? P.car.x : P.x; BM.cz = P.inCar ? P.car.z : P.z; BM.zoom = 1.6; }
  if (id === 'menu') menuTab(UI.mtab || 'map'); G.audio.sfx('ui'); };
UI.close = (silent)=>{ if (!UI.open) return; $(UI.open).classList.remove('on'); UI.open = null; G.paused = false; if (!silent && !G.TOUCH) G.input.lock(); };
addEventListener('keydown', e=>{
  if (!G.started) return;
  if (e.code === 'Escape' || e.code === 'KeyP'){ if (UI.open) UI.close(); else if (!G.input.locked || e.code === 'KeyP') UI.show('menu'); }
  else if (e.code === 'KeyM'){ UI.toggle('map'); }
  else if (e.code === 'Tab'){ e.preventDefault(); if (!UI.open) UI.wheel(true); }
});
addEventListener('keyup', e=>{ if (e.code === 'Tab') UI.wheel(false); });
G.onLockChange = locked=>{ if (!locked && G.started && !UI.open && !G.TOUCH && !UI.wheelOn && !G.cutscene) UI.show('menu'); };

// ----- 무기 휠 -----
UI.wheel = on=>{ UI.wheelOn = on; const el = $('wheel'); el.classList.toggle('on', on); G.slowmo = on ? .25 : 1;
  if (on){ const ring = $('wring'); const ks = G.weapons.ORDER; ring.innerHTML = ks.map((k, i)=>{ const a = i/ks.length*Math.PI*2 - Math.PI/2; const own = k === 'fist' || G.player.has(k); return '<div class="it ' + (own ? 'own' : 'none') + (G.player.weapon === k ? ' sel' : '') + '" data-k="' + k + '" style="left:' + (50 + Math.cos(a)*36) + '%;top:' + (50 + Math.sin(a)*36) + '%">' + wsvg(k) + '<span>' + G.weapons.W[k].name + '</span></div>'; }).join('') + '<div class="mid" id="wmid"></div>';
    ring.querySelectorAll('.it.own').forEach(d=>{ const pick = e=>{ e.preventDefault(); G.player.select(d.dataset.k); if (G.TOUCH) UI.wheel(false); else hl(d.dataset.k); }; d.addEventListener('mouseenter', ()=>{ G.player.select(d.dataset.k); hl(d.dataset.k); }); d.addEventListener('touchstart', pick, { passive:false }); d.addEventListener('click', pick); });
    hl(G.player.weapon); }
  else if (!G.TOUCH && G.started && !UI.open) G.input.lock(); };
function hl(k){ document.querySelectorAll('#wring .it').forEach(d=>d.classList.toggle('sel', d.dataset.k === k)); const w = G.weapons.W[k]; $('wmid').innerHTML = w.name + '<small>' + (w.mag ? (G.player.clip[k] || 0) + ' / ' + (G.save.ammo[k] || 0) : w.thrown ? (G.save.ammo[k] || 0) + '개' : '근접') + '</small>'; }
// 마우스로 휠 고르기 (포인터 잠금 중)
UI.wheelMouse = (dx, dy)=>{ if (!UI.wheelOn) return; UI._wv = UI._wv || { x:0, y:0 }; UI._wv.x = U.clamp(UI._wv.x + dx, -100, 100); UI._wv.y = U.clamp(UI._wv.y + dy, -100, 100); if (Math.hypot(UI._wv.x, UI._wv.y) < 40) return;
  const a = Math.atan2(UI._wv.y, UI._wv.x) + Math.PI/2; const ks = G.weapons.ORDER; let i = Math.round(a/(Math.PI*2)*ks.length); i = ((i%ks.length) + ks.length)%ks.length; const k = ks[i]; if ((k === 'fist' || G.player.has(k)) && k !== G.player.weapon){ G.player.select(k); hl(k); } };

// =====================================================================
//  일시정지 메뉴
// =====================================================================
const TABS = [['map', '지도'], ['missions', '미션'], ['stats', '통계'], ['settings', '설정'], ['keys', '조작법'], ['quit', '나가기']];
function menuTab(t){ UI.mtab = t; $('mtabs').innerHTML = TABS.map(([k, n])=>'<button class="' + (k === t ? 'on' : '') + '" data-t="' + k + '">' + n + '</button>').join(''); $('mtabs').querySelectorAll('button').forEach(b=>b.onclick = ()=>{ G.audio.sfx('ui'); if (b.dataset.t === 'map'){ UI.show('map'); return; } menuTab(b.dataset.t); });
  const C = $('mcontent'); const S = G.save, st = S.stats;
  if (t === 'map'){ UI.show('map'); return; }
  if (t === 'missions'){ C.innerHTML = '<div class="mlist">' + G.missions.LIST.map((m, i)=>'<div class="m' + (i < S.missions ? ' done' : '') + '"><span class="dot">' + (i + 1) + '</span><div><b>' + U.esc(m.title) + (i < S.missions ? ' — 완료' : i === S.missions ? ' — 진행 가능' : '') + '</b><small>' + U.esc(i <= S.missions ? m.desc : '앞 미션을 끝내면 열려요') + '</small></div></div>').join('') + '</div>'
      + '<h3>부업</h3><div class="grid2">' + [['택시 운전', '택시를 타고 H 또는 ' + (G.TOUCH ? '경적' : 'H') + ' 버튼 → 손님 태우기'], ['자경단', '경찰차를 타고 경적 버튼 → 범인 추격'], ['스턴트 점프', '노란 점프대 ' + W.ramps.length + '곳 (' + S.jumps.length + ' 완료)'], ['숨겨진 상자', '도시 곳곳에 숨은 상자 ' + G.missions.PACKAGES.length + '개 (' + S.packages.length + ' 찾음)'], ['스트리트 레이스', '지도에 깃발 표시된 곳에서 시작']].map(([a, b])=>'<div class="stat"><small>' + b + '</small><b>' + a + '</b></div>').join('') + '</div>'; }
  if (t === 'stats'){ const tm = Math.floor(st.time/60); C.innerHTML = '<div class="grid2">' + [['플레이 시간', Math.floor(tm/60) + '시간 ' + tm%60 + '분'], ['가진 돈', U.fmtMoney(S.money)], ['미션 진행', S.missions + ' / ' + G.missions.LIST.length], ['쓰러뜨린 사람', st.kills], ['훔친 차', st.cars], ['운전 거리', (st.dist/1000).toFixed(1) + ' km'], ['최고 수배', st.maxWanted + ' 별'], ['체포', st.busted + '번'], ['사망', st.wasted + '번'], ['택시 손님', st.taxi + '명'], ['스턴트 점프', S.jumps.length + ' / ' + W.ramps.length], ['숨겨진 상자', S.packages.length + ' / ' + G.missions.PACKAGES.length], ['완료율', G.missions.completion() + '%']].map(([a, b])=>'<div class="stat"><small>' + a + '</small><b>' + b + '</b></div>').join('') + '</div>'; }
  if (t === 'settings'){ const c = G.cfg; C.innerHTML = '<div class="row"><label>그래픽</label><div class="seg" data-c="quality"><button data-v="0">빠름</button><button data-v="1">좋음</button></div></div>'
      + '<div class="row"><label>마우스 감도</label><input type="range" min="0.3" max="2.5" step="0.05" data-c="sens"></div><div class="row"><label>시야각</label><input type="range" min="50" max="85" step="1" data-c="fov"></div><div class="row"><label>전체 음량</label><input type="range" min="0" max="1" step="0.05" data-c="vol"></div><div class="row"><label>라디오 음량</label><input type="range" min="0" max="1" step="0.05" data-c="radioVol"></div>'
      + '<div class="row"><label>마우스 상하 반전</label><div class="seg" data-c="invertY"><button data-v="false">끔</button><button data-v="true">켬</button></div></div><p style="color:#aaa;font-size:13px">그래픽 설정은 다시 시작하면 적용돼요.</p>';
    C.querySelectorAll('input[type=range]').forEach(r=>{ r.value = c[r.dataset.c]; r.oninput = ()=>{ c[r.dataset.c] = +r.value; G.saveCfg(); if (r.dataset.c === 'vol') G.audio.setVol(c.vol); }; });
    C.querySelectorAll('.seg').forEach(s=>{ const k = s.dataset.c; s.querySelectorAll('button').forEach(b=>{ b.classList.toggle('on', String(c[k]) === b.dataset.v); b.onclick = ()=>{ c[k] = b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : +b.dataset.v; G.saveCfg(); menuTab('settings'); }; }); }); }
  if (t === 'keys'){ const K = G.TOUCH ? [['왼쪽 조이스틱', '이동 / 운전'], ['화면 오른쪽 드래그', '카메라'], ['공격 · 조준 · 점프 · 달리기', '오른쪽 버튼'], ['타기', '차 타기 · 내리기 (운전자를 끌어냄)'], ['상호작용', '상점 · 미션 시작'], ['위쪽 버튼', '지도 · 무기 휠 · 메뉴']]
      : [['W A S D', '이동 / 운전'], ['마우스', '카메라 (클릭하면 잠김)'], ['Shift', '달리기'], ['Space', '점프 / 핸드브레이크'], ['왼쪽 클릭', '공격 · 사격'], ['오른쪽 클릭', '조준'], ['R', '재장전'], ['휠 · Tab', '무기 바꾸기 (Tab: 무기 휠)'], ['F', '차 타기 · 내리기 (운전자를 끌어냄)'], ['E', '상점 · 미션 시작 · 상호작용'], ['H', '경적 / 경찰차: 사이렌 · 부업'], ['Q / 마우스 휠 (운전 중)', '라디오 바꾸기'], ['C', '운전 카메라 바꾸기'], ['M', '지도'], ['Esc · P', '일시정지']];
    C.innerHTML = '<div class="keys">' + K.map(([a, b])=>'<b><span class="kb">' + a + '</span></b><span>' + b + '</span>').join('') + '</div><p style="color:#aaa;font-size:13px;margin-top:18px">비밀: 게임 중에 알파벳으로 치트를 입력할 수 있다는 소문이…</p>'; }
  if (t === 'quit'){ C.innerHTML = '<p>진행은 내 집(S 표시)에서 저장돼요. 돈 · 무기 · 미션은 자동으로 저장돼요.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="bigbtn" id="qSave">저장하고 허브로</button><button class="bigbtn ghost" id="qReset">처음부터 다시 (기록 삭제)</button></div>';
    $('qSave').onclick = ()=>{ G.writeSave(); location.href = 'hub.html'; };
    $('qReset').onclick = ()=>{ if (confirm('정말 모든 진행을 지울까요?')){ G.resetSave(); location.reload(); } }; }
}

// =====================================================================
//  상점
// =====================================================================
UI.shop = (title, render)=>{ UI.show('shop'); $('shopT').textContent = title; UI._shopR = render; render($('shopL')); $('shopM').textContent = U.fmtMoney(G.save.money); };
UI.refreshShop = ()=>{ if (UI.open === 'shop' && UI._shopR){ UI._shopR($('shopL')); $('shopM').textContent = U.fmtMoney(G.save.money); } };
UI.buy = (price, fn)=>{ if (G.save.money < price){ G.audio.sfx('empty'); UI.help('돈이 부족해요.', 2); return false; } G.save.money -= price; fn(); G.audio.sfx('cash'); G.writeSave(); UI.refreshShop(); return true; };
})();
