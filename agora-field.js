// 룬 아고라 — 모험의 대지 (필드) 코어
// 지역(area) 등록 · 입장/퇴장 · 공간 격자(충돌 · 상호작용) · 지역 감지 · 공용 UI(라벨 · 알림) · 모듈 로더
// 기능 모듈: agora-world / agora-landmarks / agora-rpg / agora-life / agora-raid / agora-minigames
// 계약서: docs/agora-modules.md
import { WORLD, byId } from './agora-worlddata.js';

export async function init(G, X){
const { THREE, V3, BUS } = X;
const S = X.S;
S.field = Object.assign({ disc: {}, wps: ['wp_village'], lastWp: 'wp_village', pos: null, glider: false, visits: 0 }, S.field || {});

// ── F: 필드 공용 컨텍스트 ──
const F = { WORLD, byId, G, X, region: null, inField: false, ready: false };
X.F = F; window.__field = F;

// 필드 월드 그룹 (절대 좌표). 전투 레이어(X.SW) 안에 두지만 지면 오프셋은 받지 않아요.
const FW = new THREE.Group(); FW.name = 'field'; FW.visible = false; X.SW.add(FW); X.FW = FW; F.FW = FW;

// ── 높이 함수 (agora-world.js 가 정밀한 지형으로 바꿔요) ──
const HALF = WORLD.half, WL = WORLD.water;
function idwBase(x, z){ let sw = 0, sh = 0; for (const [px, pz, h] of WORLD.elev){ const d2 = (x - px) ** 2 + (z - pz) ** 2 + 400; const w = 1 / (d2 * d2); sw += w; sh += w * h; } return sh / sw; }
function fallbackH(x, z){
  let h = idwBase(x, z);
  for (const L of WORLD.lakes){ const dx = (x - L.c[0]) / L.rx, dz = (z - L.c[1]) / L.rz, d = Math.hypot(dx, dz); if (d < 1.15){ const k = Math.max(0, 1 - d); h = Math.min(h, h * (1 - Math.min(1, (1.15 - d) * 4)) + (WL - L.depth * Math.sqrt(k)) * Math.min(1, (1.15 - d) * 4)); } }
  const e = Math.max(Math.abs(x), Math.abs(z)) / HALF * 800; if (e > WORLD.border.start) h += (e - WORLD.border.start) ** 1.5 * 0.12;
  return h;
}
F.H = fallbackH;                    // 지면 높이 (절대 y)
F.groundFn = (x, z) => F.H(x, z);   // 플레이어가 딛는 높이 (물 위 헤엄 등은 world 가 바꿔요)
F.isWater = (x, z) => F.H(x, z) < WL - 0.25;
F.waterDepth = (x, z) => Math.max(0, WL - F.H(x, z));
F.slope = (x, z) => { const e = 1.5; return Math.hypot(F.H(x + e, z) - F.H(x - e, z), F.H(x, z + e) - F.H(x, z - e)) / (2 * e); };
F.groundPos = (x, z, up = 0) => new V3(x, F.H(x, z) + up, z);

// ── 지역 ──
F.regionAt = (x, z) => { let best = null, bk = 1e9; for (const r of WORLD.regions){ const k = Math.hypot(x - r.c[0], z - r.c[1]) / r.r; if (k < bk){ bk = k; best = r; } } return best; };
F.regionById = id => byId('regions', id);
// 지역 안 땅 위 무작위 지점 (물 · 급경사 · 길 피함)
F.randomPointIn = (reg, opt = {}) => {
  const r0 = typeof reg === 'string' ? F.regionById(reg) : reg, c = opt.c || r0.c, rad = opt.r || r0.r * 0.9;
  for (let t = 0; t < 80; t++){
    const a = X.R() * Math.PI * 2, d = Math.sqrt(X.R()) * rad, x = c[0] + Math.cos(a) * d, z = c[1] + Math.sin(a) * d;
    if (Math.abs(x) > HALF - 120 || Math.abs(z) > HALF - 120) continue;
    if (F.isWater(x, z) || F.slope(x, z) > (opt.maxSlope || 0.6)) continue;
    if (!opt.c && F.regionAt(x, z) !== r0) continue;
    if (opt.avoidRoads !== false && F.roadDist && F.roadDist(x, z) < 5) continue;
    return [x, z];
  }
  return [c[0], c[1]];
};

// ── 공간 격자: 충돌체 · 상호작용 (가까운 것만 지역 목록에 올려요) ──
const CELL = 32, grid = new Map(), igrid = new Map();
const key = (cx, cz) => cx * 4096 + cz;
const cellOf = (x, z) => [Math.floor(x / CELL), Math.floor(z / CELL)];
function gAdd(g, o, x, z, ext = 0){ const [a0, b0] = cellOf(x - ext, z - ext), [a1, b1] = cellOf(x + ext, z + ext); o._cells = []; for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++){ const k = key(a, b); let L = g.get(k); if (!L) g.set(k, L = []); L.push(o); o._cells.push(k); } }
function gDel(g, o){ for (const k of o._cells || []){ const L = g.get(k); if (L){ const i = L.indexOf(o); if (i >= 0) L.splice(i, 1); } } o._cells = null; }
// c = { t:'c', x, z, r } | { t:'b', x, z, hw, hd, c, s } (c = cos(ry), s = sin(ry))
F.addCollider = c => { gAdd(grid, c, c.x, c.z, c.t === 'c' ? c.r : Math.hypot(c.hw, c.hd)); return c; };
F.circle = (x, z, r) => F.addCollider({ t: 'c', x, z, r });
F.box = (x, z, hw, hd, ry = 0) => F.addCollider({ t: 'b', x, z, hw, hd, c: Math.cos(ry), s: Math.sin(ry) });
F.removeCollider = c => gDel(grid, c);
// it = { x, z, r, title, action, hidden? } — r 안에 들어오면 E 키 / 버튼으로 실행
F.addInteract = it => { gAdd(igrid, it, it.x, it.z, it.r); return it; };
F.removeInteract = it => gDel(igrid, it);
const NCOL = [], NINT = [];
function refreshNear(){
  NCOL.length = 0; NINT.length = 0; const seen = new Set(), [cx, cz] = cellOf(X.player.pos.x, X.player.pos.z);
  for (let a = cx - 2; a <= cx + 2; a++) for (let b = cz - 2; b <= cz + 2; b++){
    for (const o of grid.get(key(a, b)) || []) if (!seen.has(o)){ seen.add(o); NCOL.push(o); }
    for (const o of igrid.get(key(a, b)) || []) if (!seen.has(o) && !o.hidden){ seen.add(o); NINT.push(o); }
  }
}
F.bound = null;   // world: 절벽 · 경계 처리 (p === player.pos 일 때 플레이어)
function fieldBound(p){
  const lim = HALF - 30; if (p.x > lim) p.x = lim; if (p.x < -lim) p.x = -lim; if (p.z > lim) p.z = lim; if (p.z < -lim) p.z = -lim;
  if (F.bound) F.bound(p);
}
// 몬스터 이동 제한 (전투 레이어의 arenaClamp 가 불러요)
F.clampEnemy = (p, m) => { const lim = HALF - 40; p.x = Math.max(-lim, Math.min(lim, p.x)); p.z = Math.max(-lim, Math.min(lim, p.z)); if (F.enemyBound) F.enemyBound(p, m); return p; };

// ── 미니맵 바탕 (world 가 지형으로 다시 그려요) ──
const mapCanvas = G.cnv(2048); F.mapCanvas = mapCanvas;
F.drawMapBase = () => {
  const c = mapCanvas.getContext('2d'), k = 1024 / HALF, P = (x, z) => [1024 + x * k, 1024 + z * k];
  c.fillStyle = '#2a3a24'; c.fillRect(0, 0, 2048, 2048);
  for (const r of WORLD.regions){ c.fillStyle = r.color + '88'; c.beginPath(); c.arc(...P(...r.c), r.r * k, 0, 6.283); c.fill(); }
  c.fillStyle = '#3a78a8'; for (const L of WORLD.lakes){ c.beginPath(); c.ellipse(...P(...L.c), L.rx * k, L.rz * k, 0, 0, 6.283); c.fill(); }
  c.strokeStyle = '#3a78a8'; c.lineCap = 'round'; for (const rv of WORLD.rivers){ c.lineWidth = rv.w * k; c.beginPath(); rv.pts.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](...P(...p))); c.stroke(); }
  c.strokeStyle = '#d8c08a'; for (const rd of WORLD.roads){ c.lineWidth = Math.max(3, rd.w * k * 0.8); c.beginPath(); rd.pts.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](...P(...p))); c.stroke(); }
};
F.drawMapBase();

// ── 지역(area) 등록 ──
const area = G.addArea('field', { group: FW, col: NCOL, interact: NINT, ground: (x, z) => F.groundFn(x, z), bound: fieldBound, mapBase: mapCanvas, mapR: HALF, mapZoom: 6.5 });
F.area = area;

// ── 공용 UI: 떠 있는 이름표 · 알림 피드 · 지역 배너 ──
const css = document.createElement('style');
css.textContent = `
  #flabels { position:fixed; inset:0; pointer-events:none; z-index:8; }
  #flabels .fl { position:absolute; transform:translate(-50%,-100%); white-space:nowrap; text-align:center; font:700 12px 'Noto Sans KR'; color:#fff; text-shadow:0 1px 2px #000, 0 0 4px rgba(0,0,0,.8); }
  #flabels .fl small { display:block; font:500 10px 'Noto Sans KR'; color:#ffe9b0; }
  #flabels .fl.npc { color:#ffe08a; } #flabels .fl.bot { color:#b8e8ff; } #flabels .fl.place { color:#fff3d6; font:700 13px 'Gowun Batang'; opacity:.9; }
  #flabels .fl .q { display:block; font:900 20px 'Noto Sans KR'; color:#ffd36a; text-shadow:0 0 8px rgba(255,200,60,.9), 0 2px 0 #000; line-height:1; }
  #fnote { position:fixed; right:16px; top:46%; z-index:9; display:flex; flex-direction:column; align-items:flex-end; gap:4px; pointer-events:none; }
  #fnote div { font:700 13px 'Noto Sans KR'; color:#fff; padding:5px 12px; border-radius:14px; background:rgba(10,14,24,.72); border:1px solid rgba(233,200,126,.35); animation:fnin .25s ease-out; transition:opacity .5s; }
  @keyframes fnin { from { transform:translateX(30px); opacity:0; } }
  #fregion { position:fixed; left:50%; top:22%; transform:translateX(-50%); z-index:9; text-align:center; pointer-events:none; opacity:0; transition:opacity .9s; }
  #fregion.on { opacity:1; } #fregion .a { font:700 12px 'Cinzel'; letter-spacing:.5em; color:#e9c87e; }
  #fregion .b { font:900 clamp(30px, 6vw, 54px) 'Gowun Batang'; color:#fff8e6; letter-spacing:.12em; text-shadow:0 2px 12px rgba(0,0,0,.7); }
  #fregion .c { font:500 14px 'Noto Sans KR'; color:#d8e4e8; margin-top:4px; text-shadow:0 1px 4px #000; }
  #fregion .line { width:min(420px, 70vw); height:1px; margin:8px auto; background:linear-gradient(90deg, transparent, #e9c87e, transparent); }
  body.cine #flabels, body.cine #fnote, body.shopping #flabels { opacity:0; }
  #fmenu { position:absolute; right:14px; top:calc(max(14px, env(safe-area-inset-top)) + var(--map) + 52px); display:none; flex-direction:column; gap:7px; pointer-events:auto; align-items:flex-end; z-index:6; }
  body[data-area="field"] #fmenu { display:flex; }
  #fmenu button { position:relative; display:flex; align-items:center; gap:7px; font:700 13px 'Gowun Batang'; color:#fff3d6; padding:7px 13px 7px 9px; border-radius:20px; cursor:pointer; background:linear-gradient(90deg, rgba(10,14,24,.4), rgba(10,14,24,.85)); border:1px solid rgba(233,200,126,.45); box-shadow:0 4px 12px rgba(0,0,0,.35); }
  #fmenu button span { font-size:17px; } #fmenu button kbd { font:700 10px 'Cinzel'; color:#e9c87e; opacity:.8; }
  #fmenu button.dot::after { content:''; position:absolute; right:2px; top:2px; width:9px; height:9px; border-radius:50%; background:#ff4a4a; box-shadow:0 0 6px #ff4a4a; }
  body.touch #fmenu button { padding:8px; } body.touch #fmenu button b, body.touch #fmenu button kbd { display:none; }
  body.cine #fmenu, body.shopping #fmenu { opacity:0; pointer-events:none; }
  #modes button.field { background:linear-gradient(90deg, rgba(40,90,60,.55), rgba(20,50,30,.92)); border-color:rgba(140,255,170,.6); }
  #modes button.field.lock { opacity:.55; }
`;
document.head.appendChild(css);
const labelsEl = X.mk('div', 'flabels', ''), noteEl = X.mk('div', 'fnote', ''), regionEl = X.mk('div', 'fregion', '<div class="a"></div><div class="b"></div><div class="line"></div><div class="c"></div>');
// 이름표: F.label({ obj | pos(V3) | get(): V3, text, sub, cls, max, y }) → 핸들 { el, set(text, sub), remove() }
const LABELS = [];
const _lv = new V3();
F.label = o => { const el = document.createElement('div'); el.className = 'fl ' + (o.cls || ''); labelsEl.appendChild(el); const L = Object.assign({ el, max: 30, y: 2.3 }, o);
  L.set = (t, s, q) => { el.innerHTML = (q ? `<span class="q">${q}</span>` : '') + t + (s ? `<small>${s}</small>` : ''); }; L.set(o.text || '', o.sub, o.q);
  L.remove = () => { el.remove(); const i = LABELS.indexOf(L); if (i >= 0) LABELS.splice(i, 1); }; LABELS.push(L); return L; };
function updateLabels(){
  const cam = G.camera, pp = X.player.pos, W = innerWidth, H = innerHeight;
  for (const L of LABELS){
    if (L.obj){ if (!L.obj.visible && !L.always){ L.el.style.display = 'none'; continue; } L.obj.getWorldPosition(_lv); _lv.y += L.y; } else if (L.get) _lv.copy(L.get()); else _lv.copy(L.pos);
    const d = Math.hypot(_lv.x - pp.x, _lv.z - pp.z);
    if (d > L.max || L.hidden){ L.el.style.display = 'none'; continue; }
    _lv.project(cam); if (_lv.z > 1 || _lv.z < -1){ L.el.style.display = 'none'; continue; }
    L.el.style.display = ''; L.el.style.left = ((_lv.x * 0.5 + 0.5) * W) + 'px'; L.el.style.top = ((-_lv.y * 0.5 + 0.5) * H) + 'px'; L.el.style.opacity = d > L.max * 0.75 ? (L.max - d) / (L.max * 0.25) : 1;
  }
}
F.note = (html, dur = 3.2) => { const d = document.createElement('div'); d.innerHTML = html; noteEl.appendChild(d); while (noteEl.children.length > 6) noteEl.firstChild.remove(); setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 520); }, dur * 1000); };
// 필드 메뉴줄 (오른쪽, 미니맵 아래): F.menu.add(icon, label, fn, key) → button (.dot 클래스로 빨간 점)
const menuEl = X.mk('div', 'fmenu', '', X.hud);
F.menu = { el: menuEl, add(icon, label, fn, key){ const b = document.createElement('button'); b.innerHTML = `<span>${icon}</span><b>${label}</b>${key ? `<kbd>${key}</kbd>` : ''}`; b.onclick = e => { e.stopPropagation(); fn(); }; menuEl.appendChild(b); return b; } };
F.menu.add('🏠', '귀환', () => X.fieldReturn());
let regionT = 0;
F.regionBanner = (a, b, c, dur = 3.6) => { regionEl.querySelector('.a').textContent = a; regionEl.querySelector('.b').textContent = b; regionEl.querySelector('.c').textContent = c || ''; regionEl.classList.add('on'); regionT = dur; };

// ── NPC 대화 분배: 모듈이 F.talkers[npcId] 또는 F.roleTalkers[role] 를 채워요 ──
F.talkers = {}; F.roleTalkers = {};
F.talk = async id => {
  const n = byId('npcs', id); if (!n || X.dialogOpen) return;
  const fn = F.talkers[id] || F.roleTalkers[n.role];
  BUS.emit('talk', { npc: id });
  if (fn) return fn(n);
  X.NAMES[id] = n.name; await X.say([[id, '좋은 하루예요, 모험가님.']]);
};
F.roleTalkers.wardrobe = async n => { X.NAMES[n.id] = n.name; const r = await X.say([[n.id, '오늘은 어떤 옷으로 갈아입어 볼까요? 반짝이는 건 다 여기 있답니다.', ['의상실 열기', '다음에요']]]); if (r === 0) X.openWardrobe(); };
// 채팅 · 월드 소식 (agora-life.js 가 진짜 채팅창으로 바꿔요)
F.chat = (text, from = '', kind = 'sys') => F.note(`${from ? `<b>${from}</b> ` : ''}${text}`);

// ── 입장 · 퇴장 ──
F.unlocked = () => X.stars(1, 'e') > 0;
F.enter = (opt = {}) => {
  if (X.tpBusy) return;
  if (!F.unlocked()){ X.toast('모험의 대지', '스토리 1-1 「숲의 입구」 를 먼저 클리어하세요'); return; }
  const wp = opt.wp ? byId('waypoints', opt.wp) : null;
  const tgt = opt.x != null ? [opt.x, opt.z] : wp ? wp.c : (S.field.pos && opt.resume !== false ? S.field.pos : [WORLD.spawn.x, WORLD.spawn.z]);
  const reg = F.regionAt(tgt[0], tgt[1]);
  X.teleport(WORLD.name, `${reg.name} · Lv.${reg.lv[0]}~${reg.lv[1]}`, () => {
    X.closeMap(); X.cleanupBattle(); X.clearSkillFx(); X.disposeStage();
    X.enterCombat('field'); X.setMode('field');
    X.GYF = (x, z) => F.H(x, z); X.CLAMP = F.clampEnemy;
    X.player.pos.set(tgt[0], F.groundFn(tgt[0], tgt[1]) + 0.05, tgt[1]); X.player.vy = 0;
    const face = opt.face ?? (tgt === S.field.pos ? X.fig.root.rotation.y : WORLD.spawn.face);
    X.fig.root.rotation.y = face; G.setCam(face + Math.PI, 0.3, 8.5);
    F.inField = true; F.region = null; S.field.visits++; X.save();
    G.setMood(X.MOOD[reg.mood] || X.MOOD.noon);
    G.scene.fog.density = 0.0026;
    refreshNear();
    BUS.emit('enterField', { x: tgt[0], z: tgt[1] });
  });
};
F.teleportTo = (x, z, name, sub) => {
  if (X.tpBusy) return;
  X.teleport(name || '룬 비석', sub || '', () => {
    X.cleanupBattle(); X.clearSkillFx();
    X.player.pos.set(x, F.groundFn(x, z) + 0.05, z); X.player.vy = 0; refreshNear();
    BUS.emit('enterField', { x, z, warp: true });
  });
};
F.leave = () => X.leaveToPlaza();
BUS.on('leave', m => { if (m !== 'field') return; F.inField = false; S.field.pos = [X.player.pos.x, X.player.pos.z]; X.save(); BUS.emit('leaveField'); });
BUS.on('mode', m => { if (m !== 'field' && F.inField){ F.inField = false; BUS.emit('leaveField'); } });

// 귀환 (← 광장으로 버튼 / 쓰러짐)
X.fieldReturn = async () => {
  if (X.dialogOpen || X.tpBusy) return;
  X.NAMES.sys = '귀환의 룬';
  const r = await X.say([['sys', '어디로 돌아갈까요?', ['룬의 광장으로', '새싹 마을로 (룬 비석)', '그대로 있기']]]);
  if (r === 0) F.leave();
  else if (r === 1){ const w = byId('waypoints', 'wp_village'); F.teleportTo(w.c[0] + 2, w.c[1] + 4, '새싹 마을', '룬 비석'); }
};
X.onRevive = mode => {
  if (mode !== 'field') return;
  const w = byId('waypoints', S.field.lastWp) || byId('waypoints', 'wp_village');
  X.player.pos.set(w.c[0] + 2, F.groundFn(w.c[0] + 2, w.c[1] + 3) + 0.05, w.c[1] + 3);
  X.cleanupBattle(); X.heal(1e9); refreshNear(); BUS.emit('enterField', { x: w.c[0], z: w.c[1], revive: true });
};

// ── 광장 입구 버튼 ──
const modes = document.getElementById('modes');
const btn = document.createElement('button'); btn.id = 'mField'; btn.className = 'field'; btn.innerHTML = '<span>🌍</span>모험의 대지';
modes.insertBefore(btn, modes.firstChild);
btn.onclick = () => F.enter();
const refreshBtn = () => btn.classList.toggle('lock', !F.unlocked());
refreshBtn(); BUS.on('mode', refreshBtn); setInterval(refreshBtn, 3000);
const story = document.getElementById('mStory'); if (story) story.innerHTML = '<span>📖</span>스토리 (튜토리얼)';

// ── 매 프레임 ──
let nearT = 0, regT = 0;
G.hooks.push((dt, rdt) => {
  if (regionT > 0){ regionT -= rdt; if (regionT <= 0) regionEl.classList.remove('on'); }
  if (!F.inField) { if (LABELS.length) for (const L of LABELS) L.el.style.display = 'none'; return; }
  nearT -= rdt; if (nearT <= 0){ nearT = 0.25; refreshNear(); }
  updateLabels();
  regT -= rdt;
  if (regT <= 0){ regT = 0.5; const r = F.regionAt(X.player.pos.x, X.player.pos.z);
    if (r !== F.region){ const prev = F.region; F.region = r; BUS.emit('region', { id: r.id, prev: prev && prev.id });
      if (!F.regionBannerOff) F.regionBanner(r.en.toUpperCase(), r.name, r.safe ? '안전 지대' : `권장 레벨 ${r.lv[0]} ~ ${r.lv[1]}`); } }
});

// ── 기능 모듈 불러오기 ──
// ?mods=world,rpg 로 일부만, ?nomods 로 코어만 띄울 수 있어요 (모듈별 테스트용)
const qs = new URLSearchParams(location.search);
const LIST = ['world', 'landmarks', 'life', 'rpg', 'raid', 'minigames'];
const want = qs.has('nomods') ? [] : qs.get('mods') ? qs.get('mods').split(',') : LIST;
F.modules = {};
for (const name of LIST){
  if (!want.includes(name)) continue;
  try {
    const m = await import(`./agora-${name}.js`);
    const t0 = performance.now();
    F.modules[name] = (await m.init(G, X, F)) || true;
    console.log(`[field] ${name} ready ${Math.round(performance.now() - t0)}ms`);
  } catch (e){ console.error(`[field] ${name} failed`, e); F.modules[name] = false; }
}
F.ready = true; BUS.emit('fieldReady', F);
}
