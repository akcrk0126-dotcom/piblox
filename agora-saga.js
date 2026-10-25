// 룬 아고라 — 모험의 대지: saga (agora-saga.js)
// 이야기를 눈에 보이게: 장(chapter) 진행 · 장 시작/끝 연출(검은 띠 · 카메라 비행 · 제목 카드 · 타자기 내레이션) · 세상 변화(풍차 …)
//                      · 읽을거리(양피지 창) · 룬 수호석 의식(E 누르고 있기) · 이야기 물건 줍기 · 이야기 보스 · 주민/NPC 장별 인사(F.greet) · 연대기 창(N)
// 계약서: docs/agora-modules.md · 이야기: docs/agora-story-bible.md §5 · 데이터: lore/*.js (LORE, 장 순서)
// F 에 올리는 것: F.greet(id) → 대사 | null · F.saga = { chapterState(n), openCodex(tab), target(o), playIntro(n), busy(), afterQuest(qid), state } · F.story.done(n)
// BUS 로 쏘는 것: 'read' { id } · 'cleanse' { id } · 'collect' { id } · 'storyBoss' { id, state:'spawn'|'dead' } · 'chapter' { n, state:'start'|'done' }
// 저장: S.saga = { ch: { [n]: { intro, outro, t } }, read: { id: 시각 }, cleansed: {}, picked: {}, sboss: {}, met: {} }
// 다른 모듈은 있으면 써요 — towns(읽을거리 · 수호석 물체 · setGlow/setLit · 세상 변화) · props(셋피스 · 줍기 물체 · 세상 변화) · rpg(퀘스트) · life(NPC 피규어).
//   없으면 간단한 표식(빛 · 팻말 · 비석 · 주민 피규어)을 대신 세워서 이야기가 막히지 않게 해요.
import { LORE } from './lore/index.js';
export async function init(G, X, F){
const { THREE, V3, BUS } = X;
const W = F.WORLD, S = X.S, FW = F.FW, byId = F.byId, WL = W.water;
const LOW = G.gfxMode === 'low' || G.IS_TOUCH;
const R = Math.random, rr = (a, b) => a + (b - a) * R(), pick = a => a[(R() * a.length) | 0];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, sst = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const now = () => performance.now() / 1000;
const pp = X.player.pos;
const fieldOn = () => F.inField && X.mode === 'field';
// 그 자리에 놓일 높이 (물 위면 수면, 절대 y)
const gy = (x, z) => { let y = F.H(x, z); const g = F.groundFn ? F.groundFn(x, z) : y; if (g > y) y = g; if (F.isWater(x, z)) y = Math.max(y, (F.waterY ? F.waterY(x, z) : WL) + 0.05); return y; };
const ERR = {}; const guard = (k, fn) => { try { return fn(); } catch (e){ if (!ERR[k]){ ERR[k] = 1; console.error('[saga] ' + k, e); } return undefined; } };
const T0 = performance.now();
const std = o => G.std ? G.std(o) : new THREE.MeshStandardMaterial(o);

// ───────────────────────── 저장 ─────────────────────────
S.saga = Object.assign({}, S.saga || {});
for (const k of ['ch', 'read', 'cleansed', 'picked', 'sboss', 'met']) if (!S.saga[k] || typeof S.saga[k] !== 'object') S.saga[k] = {};
const SG = S.saga;
const chRec = n => SG.ch[n] || (SG.ch[n] = { intro: false, outro: false, t: 0 });
let saveT = 0; const dirty = () => { saveT = 0.6; };

// ───────────────────────── 이야기 색인 (LORE) ─────────────────────────
// CH: 장 { n, L, c(chapter), mains[], last, set(정착지), ks(수호석) } · RD 읽을거리 · SP 셋피스 · KS 수호석 · SB 이야기 보스 · RES 주민 · NL 기존 NPC 장별 인사
const CH = [], CHN = {}, RD = {}, SP = {}, KS = {}, SB = {}, RES = {}, NL = {}, LQD = {};
for (const L of LORE) guard('index ' + (L && L.region), () => {
  const c = L.chapter || { n: 100 + CH.length, title: L.region }, mains = (L.quests || []).filter(q => q && q.kind === 'main').map(q => q.id);
  if (CHN[c.n]) return;
  const st = L.settlement || null, ws = st && (W.settlements || []).find(s => s.id === st.id);
  const o = { n: c.n, L, c, mains, last: mains[mains.length - 1] || null, set: st ? { id: st.id, name: st.name, c: st.c || (ws && ws.c), r: st.r || (ws && ws.r) || 30 } : null, ks: L.keystone && L.keystone.c ? L.keystone : null };
  CH.push(o); CHN[o.n] = o;
  for (const r of L.readables || []) if (r && r.id && r.c) RD[r.id] = { o: r, ch: o };
  for (const sp of L.setpieces || []) if (sp && sp.id && sp.c) SP[sp.id] = { o: sp, ch: o };
  if (o.ks && o.ks.id) KS[o.ks.id] = { o: o.ks, ch: o };
  for (const b of L.bosses || []) if (b && b.id && b.c && b.key) SB[b.id] = { o: b, ch: o };
  for (const r of (st && st.residents) || []) if (r && r.id) RES[r.id] = { o: r, ch: o };
  for (const id in L.npcLines || {}) (NL[id] = NL[id] || []).push({ lines: L.npcLines[id], ch: o });
  for (const q of L.quests || []) if (q && q.id) LQD[q.id] = q;
});
CH.sort((a, b) => a.n - b.n);
const chNo = n => n === 0 ? '서장' : `제 ${n} 장`, chEn = n => n === 0 ? 'PROLOGUE' : `CHAPTER ${['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || n}`;
const regName = id => (F.regionById(id) || { name: id }).name;
// 셋피스 짧은 이름 (메모의 앞부분 → 종류 이름)
const SPN = { windmill_gear: '풍차 톱니', black_seeds: '검은 씨앗', torn_cloak: '찢긴 망토', lost_toy: '잃어버린 장난감' };
const spName = sp => { const n = String(sp.name || sp.note || '').split(/[(—,·]/)[0].trim(); return sp.name || (n && n.length <= 16 ? n : SPN[sp.kind] || '이야기 물건'); };
// 수호수 (bible §2) — 연대기 표시용
const GUARD = { village: '— 마을이 대대로 지켜 온 돌', greenhill: '풀빛 왕슬라임 「말랑대왕」', woods: '버섯대공 「포자왕」', lake: '호수의 주인', swamp: '늪의 왕 그롬', canyon: '바위 거인 그라녹', plateau: '— 세렌의 기록', blight: '세계수 심장의 뿌리 · 가시 군주', frost: '서리 거룡 크라이오스' };

// ───────────────────────── 퀘스트 · 장 상태 ─────────────────────────
const rpg = () => F.modules.rpg || null;
const getQ = id => { const r = rpg(); return (r && r.getQ && r.getQ(id)) || (r && r.QD && r.QD[id]) || LQD[id] || null; };
const objN = o => o.n || (o.t === 'collect' && Array.isArray(o.id) ? o.id.length : 1);
const ACT = () => (S.q && S.q.act) || {}, DONE = () => (S.q && S.q.done) || {};
// 'before' (아무 메인도 안 받음) · 'during' · 'after' (메인 모두 끝, 또는 뒤 장이 이미 시작됨)
function chapterState(n){
  const c = CHN[n]; if (!c || !c.mains.length) return 'before';
  const D = DONE(), A = ACT();
  if (c.mains.every(id => D[id])) return 'after';
  for (const d of CH) if (d.n > n && d.mains.some(id => D[id] || A[id])) return 'after';
  return c.mains.some(id => D[id] || A[id]) ? 'during' : 'before';
}
const LASTST = {}; for (const c of CH) LASTST[c.n] = chapterState(c.n);
function chapterEvents(){
  for (const c of CH){ const s = chapterState(c.n), p = LASTST[c.n]; if (s === p) continue; LASTST[c.n] = s;
    if (p === 'before') BUS.emit('chapter', { n: c.n, state: 'start' });
    if (s === 'after'){ const r = chRec(c.n); if (!r.t) r.t = Date.now(); dirty(); BUS.emit('chapter', { n: c.n, state: 'done' }); } }
}
// 지금 진행 중인 퀘스트가 필요로 하는 이야기 물체
const HASK = { read: 'read', collect: 'picked', cleanse: 'cleansed', sboss: 'sboss' };
const has = (t, id) => !!SG[HASK[t]][id];
const NEED = { read: new Set(), collect: new Set(), cleanse: new Set(), sboss: new Set() };
let needDirty = true;
function calcNeed(){
  needDirty = false; for (const k in NEED) NEED[k].clear();
  const A = ACT();
  for (const qid in A){ const q = getQ(qid), a = A[qid]; if (!q || !q.o || !a) continue;
    q.o.forEach((o, i) => { const set = NEED[o.t]; if (!set || ((a.p && a.p[i]) || 0) >= objN(o)) return;
      for (const id of (Array.isArray(o.id) ? o.id : [o.id])) if (id && !has(o.t, id)) set.add(id); }); }
  applyNeed();
}

// ───────────────────────── 스타일 ─────────────────────────
const css = document.createElement('style');
css.textContent = `
  #sagaCine { position:fixed; inset:0; z-index:25; display:none; pointer-events:none; user-select:none; -webkit-user-select:none; }
  #sagaCine.on { display:block; pointer-events:auto; cursor:pointer; }
  #sagaCine .fade { position:absolute; inset:0; background:#000; opacity:0; transition:opacity .45s; }
  #sagaCine .fade.on { opacity:1; }
  #sagaCine .card { position:absolute; left:50%; top:31%; width:min(780px, 92vw); transform:translate(-50%,-50%) scale(.96); text-align:center; opacity:0; transition:opacity 1.3s, transform 3s ease-out; text-shadow:0 2px 16px rgba(0,0,0,.9), 0 0 3px #000; }
  #sagaCine .card.on { opacity:1; transform:translate(-50%,-50%) scale(1); }
  #sagaCine .card .no { font:700 clamp(14px, 2.1vw, 19px) 'Gowun Batang'; color:#e9c87e; letter-spacing:.55em; padding-left:.55em; }
  #sagaCine .card .ti { font:900 clamp(30px, 6.6vw, 60px)/1.15 'Gowun Batang'; color:#fff8e6; letter-spacing:.14em; padding-left:.14em; margin:8px 0 2px; }
  #sagaCine .card .ln { width:min(460px, 70vw); height:1px; margin:12px auto; background:linear-gradient(90deg, transparent, #e9c87e, transparent); position:relative; }
  #sagaCine .card .ln::after { content:''; position:absolute; left:50%; top:-4px; width:8px; height:8px; transform:translateX(-50%) rotate(45deg); background:#ffe9b0; box-shadow:0 0 10px #ffd36a; }
  #sagaCine .card .en { font:700 clamp(10px, 1.6vw, 13px) 'Cinzel'; letter-spacing:.55em; padding-left:.55em; color:#d6eef2; }
  #sagaCine .card.sm { top:24%; } #sagaCine .card.sm .ti { font-size:clamp(22px, 4.6vw, 40px); }
  #sagaCine .nar { position:absolute; left:50%; bottom:calc(13vh + 26px); transform:translateX(-50%); width:min(760px, 92vw); text-align:center; }
  #sagaCine .nar p { margin:2px 0; font:400 clamp(15px, 2.3vw, 20px)/1.7 'Gowun Batang'; color:#fbf3df; text-shadow:0 2px 10px rgba(0,0,0,.95), 0 0 3px #000; transition:opacity .9s; min-height:1.7em; }
  #sagaCine .nar p.old { opacity:.5; }
  #sagaCine .skip { position:absolute; right:16px; bottom:calc(13vh + 8px); font:500 11px 'Noto Sans KR'; color:#e8dcc0; opacity:.55; letter-spacing:.06em; }
  body.saga-cine.cine .lb { height:13vh; }
  body.saga-cine #fregion, body.saga-cine #lmfound, body.saga-cine #prompt { opacity:0 !important; } body.saga-intro #banner { opacity:0 !important; }
  .sagw { position:fixed; left:50%; top:50%; transform:translate(-50%,-48%) scale(.97); z-index:27; opacity:0; pointer-events:none; transition:opacity .2s, transform .2s; }
  .sagw.on { opacity:1; pointer-events:auto; transform:translate(-50%,-50%) scale(1); }
  #sagaRead { width:min(560px, 92vw); max-height:min(640px, 84vh); display:flex; flex-direction:column; padding:20px 24px 14px; color:#3a2a16;
    background:radial-gradient(ellipse at 50% 38%, #f8efd8, #ead8ae 68%, #d6be8a); border:1px solid rgba(233,200,126,.8); border-radius:4px;
    box-shadow:0 0 0 4px rgba(60,40,15,.4), inset 0 0 46px rgba(130,90,30,.38), 0 20px 60px rgba(0,0,0,.7); }
  #sagaRead::before, #sagaRead::after { content:''; position:absolute; left:10px; right:10px; height:7px; border-radius:4px; background:linear-gradient(180deg, #b48a4a, #7a5426); box-shadow:0 2px 4px rgba(0,0,0,.4); }
  #sagaRead::before { top:-4px; } #sagaRead::after { bottom:-4px; }
  #sagaRead .kd { font:700 11px 'Cinzel'; letter-spacing:.3em; color:#8a6a3a; text-align:center; }
  #sagaRead h2 { font:900 clamp(18px, 4vw, 23px) 'Gowun Batang'; color:#2a1a08; text-align:center; margin:6px 30px 10px; }
  #sagaRead .tx { overflow:auto; flex:1; min-height:0; font:400 clamp(14px, 3.4vw, 15.5px)/1.9 'Gowun Batang'; padding:6px 6px 2px; overscroll-behavior:contain; border-top:1px solid rgba(120,80,30,.25); }
  #sagaRead .tx p { margin:0 0 12px; }
  #sagaRead .ft { font:700 12px 'Gowun Batang'; color:#8a5a1a; text-align:center; margin-top:6px; letter-spacing:.12em; }
  #sagaRead .ft.new { color:#b06a00; animation:sgnew 1.4s ease-out; } @keyframes sgnew { from { transform:scale(1.25); opacity:0; } }
  #sagaRead .x { position:absolute; right:6px; top:6px; background:none; border:none; font-size:22px; color:#6a4a20; cursor:pointer; padding:4px 10px; }
  #sagaCodex { width:min(880px, 96vw); max-height:min(690px, 92vh); display:flex; flex-direction:column; padding:12px 16px; color:#e8e1cf; font:400 13px 'Noto Sans KR';
    background:linear-gradient(180deg, rgba(16,20,34,.97), rgba(7,9,16,.97)); border:1px solid rgba(233,200,126,.55); border-radius:6px; box-shadow:0 0 0 4px rgba(10,14,24,.5), 0 20px 60px rgba(0,0,0,.7); }
  #sagaCodex::before { content:''; position:absolute; left:18px; right:18px; top:-1px; height:1px; background:linear-gradient(90deg, transparent, #ffe9b0, transparent); }
  #sagaCodex .hd { display:flex; flex-wrap:wrap; align-items:center; gap:8px 10px; padding-bottom:9px; border-bottom:1px solid rgba(233,200,126,.25); }
  #sagaCodex .hd > span { font:700 10px 'Cinzel'; letter-spacing:.4em; color:#7ff3ff; white-space:nowrap; } #sagaCodex .hd > b { font:700 19px 'Gowun Batang'; color:#fff3d6; white-space:nowrap; }
  #sagaCodex .tabs { display:flex; gap:5px; flex-wrap:wrap; order:9; flex:1 1 100%; } @media (min-width:700px){ #sagaCodex .tabs { order:2; flex:0 1 auto; margin-left:4px; } }
  #sagaCodex .tabs button { font:700 12px 'Gowun Batang'; color:#cfc6b0; padding:5px 11px; border-radius:14px; border:1px solid rgba(233,200,126,.22); background:rgba(255,255,255,.03); cursor:pointer; white-space:nowrap; }
  #sagaCodex .tabs button.on { color:#10131c; background:linear-gradient(180deg,#fff2c9,#d9b05a); border-color:#ffd36a; }
  #sagaCodex .x { margin-left:auto; order:5; background:none; border:none; color:#e9c87e; font-size:20px; cursor:pointer; padding:0 4px; }
  #sagaCodex .bd { overflow:auto; flex:1; min-height:0; padding-top:10px; overscroll-behavior:contain; }
  #sagaCodex .note { font:400 12px/1.6 'Noto Sans KR'; color:#9fb6c0; margin:0 0 10px; }
  #sagaCodex .cc { position:relative; padding:12px 14px; margin-bottom:9px; border-radius:6px; background:linear-gradient(90deg, rgba(255,211,106,.07), rgba(255,255,255,.02)); border:1px solid rgba(233,200,126,.18); }
  #sagaCodex .cc.during { border-color:rgba(255,211,106,.6); box-shadow:inset 0 0 18px rgba(255,211,106,.08); } #sagaCodex .cc.before { opacity:.62; }
  #sagaCodex .cc .k { font:700 11px 'Gowun Batang'; color:#e9c87e; letter-spacing:.2em; } #sagaCodex .cc .k em { font:700 10px 'Noto Sans KR'; font-style:normal; letter-spacing:0; margin-left:8px; padding:1px 8px; border-radius:9px; background:rgba(255,255,255,.08); color:#cfd8dc; }
  #sagaCodex .cc.during .k em { background:rgba(255,211,106,.2); color:#ffe08a; } #sagaCodex .cc.after .k em { background:rgba(130,255,150,.15); color:#9aff9a; }
  #sagaCodex .cc h3 { margin:3px 0 0; font:900 18px 'Gowun Batang'; color:#fff3d6; } #sagaCodex .cc .en { font:700 9.5px 'Cinzel'; letter-spacing:.35em; color:#8fd8e6; }
  #sagaCodex .cc .pb { height:4px; border-radius:3px; background:rgba(255,255,255,.08); margin:8px 0 2px; overflow:hidden; } #sagaCodex .cc .pb i { display:block; height:100%; background:linear-gradient(90deg,#d9b05a,#fff2c9); }
  #sagaCodex .cc small { font:500 11px 'Noto Sans KR'; color:#9fb6c0; }
  #sagaCodex .cc .in { margin:8px 0 0; font:400 13.5px/1.75 'Gowun Batang'; color:#e8e1cf; } #sagaCodex .cc .out { margin-top:8px; padding-top:7px; border-top:1px dashed rgba(233,200,126,.3); font:400 13px/1.7 'Gowun Batang'; color:#ffe9b0; }
  #sagaCodex .cc .rp { position:absolute; right:12px; top:12px; }
  #sagaCodex .btn { font:700 12px 'Gowun Batang'; color:#10131c; padding:6px 12px; border:none; border-radius:3px; cursor:pointer; white-space:nowrap; background:linear-gradient(180deg,#fff2c9,#e2b964 60%,#b88c3e); }
  #sagaCodex .grp { font:700 10px 'Cinzel'; letter-spacing:.3em; color:#7ff3ff; margin:12px 0 6px; display:flex; justify-content:space-between; } #sagaCodex .grp b { font:700 13px 'Gowun Batang'; letter-spacing:.05em; color:#fff3d6; }
  #sagaCodex .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:6px; }
  #sagaCodex .rd { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:5px; background:rgba(255,255,255,.04); border:1px solid rgba(233,200,126,.2); color:#f4ecd8; font:700 12.5px 'Gowun Batang'; cursor:pointer; text-align:left; min-width:0; }
  #sagaCodex .rd span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } #sagaCodex .rd:hover { border-color:rgba(233,200,126,.6); }
  #sagaCodex .rd.un { cursor:default; color:#6a7478; border-style:dashed; }
  #sagaCodex .pe { padding:8px 10px; border-radius:5px; background:rgba(255,255,255,.04); border:1px solid rgba(233,200,126,.16); min-width:0; }
  #sagaCodex .pe b { font:700 13.5px 'Gowun Batang'; color:#fff3d6; } #sagaCodex .pe small { display:block; font:500 10.5px 'Noto Sans KR'; color:#ffd36a; } #sagaCodex .pe p { margin:4px 0 0; font:400 12px/1.55 'Gowun Batang'; color:#cfd8dc; }
  #sagaCodex .ksr { display:flex; align-items:center; gap:12px; padding:10px 12px; margin-bottom:7px; border-radius:6px; background:rgba(255,255,255,.035); border:1px solid rgba(233,200,126,.18); }
  #sagaCodex .ksr i { flex:none; width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; font:400 20px serif; font-style:normal; color:#5a6470; background:radial-gradient(circle, #2a3040, #10141c); border:1px solid #3a4250; }
  #sagaCodex .ksr.lit i { color:#fff3c0; background:radial-gradient(circle, #ffe9a0, #b88c3e 70%); border-color:#ffd36a; box-shadow:0 0 14px rgba(255,211,106,.6); text-shadow:0 0 6px #fff; }
  #sagaCodex .ksr b { font:700 14px 'Gowun Batang'; color:#fff3d6; } #sagaCodex .ksr small { display:block; font:500 11px 'Noto Sans KR'; color:#9fb6c0; } #sagaCodex .ksr em { margin-left:auto; font:700 11px 'Noto Sans KR'; font-style:normal; color:#9aa4aa; white-space:nowrap; }
  #sagaCodex .ksr.lit em { color:#ffd36a; } #sagaCodex .ksr.dark em { color:#ff9a8a; }
  @media (max-width:640px){ #sagaCodex { padding:10px; } #sagaCodex .hd > span { display:none; } #sagaCodex .hd > b { font-size:16px; } #sagaCodex .cc .rp { position:static; margin-top:8px; } #sagaCodex .grid { grid-template-columns:1fr 1fr; } }
  #sagaRite { position:fixed; left:50%; bottom:16vh; transform:translateX(-50%); z-index:26; display:none; flex-direction:column; align-items:center; gap:6px; text-align:center; pointer-events:none; }
  #sagaRite.on { display:flex; }
  #sagaRite .ring { width:min(150px, 36vw); height:min(150px, 36vw); position:relative; pointer-events:auto; touch-action:none; cursor:pointer; border-radius:50%; background:radial-gradient(circle, rgba(255,233,170,.16), rgba(10,14,24,.6) 70%); box-shadow:0 0 30px rgba(255,211,106,.22); }
  #sagaRite.hold .ring { box-shadow:0 0 46px rgba(255,211,106,.55); }
  #sagaRite svg { width:100%; height:100%; display:block; }
  #sagaRite .bg { fill:none; stroke:rgba(233,200,126,.25); stroke-width:4; }
  #sagaRite .pg { fill:none; stroke:#ffd36a; stroke-width:5; stroke-linecap:round; transform:rotate(-90deg); transform-origin:60px 60px; stroke-dasharray:326.7; stroke-dashoffset:326.7; }
  #sagaRite text { font:700 11px serif; fill:rgba(233,200,126,.32); text-anchor:middle; dominant-baseline:middle; transition:fill .2s; } #sagaRite text.on { fill:#fff3c0; }
  #sagaRite .ring b { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font:400 44px serif; color:#ffe9b0; text-shadow:0 0 14px #ffd36a; pointer-events:none; }
  #sagaRite .t { font:700 16px 'Gowun Batang'; color:#fff3d6; text-shadow:0 1px 4px #000; } #sagaRite .s { font:500 12px 'Noto Sans KR'; color:#d8e4e8; text-shadow:0 1px 3px #000; }
  #sagaRite.done .ring { animation:sgrite .9s ease-out forwards; } @keyframes sgrite { 40% { transform:scale(1.15); box-shadow:0 0 90px #ffd36a; } 100% { transform:scale(1.3); opacity:0; } }
  body.cine #sagaRite { opacity:0; }
`;
document.head.appendChild(css);

// ───────────────────────── 공용 효과: 빛기둥 (필드 월드, 절대 y) ─────────────────────────
const PIL_G = new THREE.CylinderGeometry(0.5, 1.0, 1, 18, 1, true).translate(0, 0.5, 0), PIL = [];
const PIL_VS = 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const PIL_FS = 'uniform vec3 uC; uniform float uO, uT; varying vec2 vU; void main(){ float y = vU.y; float a = pow(1.0 - y, 1.4) * (0.75 + 0.25 * sin(uT * 7.0 - y * 18.0 + vU.x * 6.283)) * smoothstep(0.0, 0.03, y); gl_FragColor = vec4(uC * (1.2 + (1.0 - y)), a * uO); }';
function pillar(x, z, col = 0xffe9a0, dur = 3.2, h = 70){
  const m = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(col) }, uO: { value: 0 }, uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, vertexShader: PIL_VS, fragmentShader: PIL_FS });
  const me = new THREE.Mesh(PIL_G, m); me.position.set(x, gy(x, z), z); me.scale.set(1, h, 1); me.renderOrder = 3; me.frustumCulled = false; FW.add(me); PIL.push({ me, t: 0, dur });
}
function updFx(rdt){
  for (let i = PIL.length - 1; i >= 0; i--){ const p = PIL[i]; p.t += rdt; const u = p.me.material.uniforms; u.uT.value += rdt;
    u.uO.value = p.t < 0.35 ? p.t / 0.35 : Math.max(0, 1 - (p.t - 0.35) / (p.dur - 0.35)); const w = 1 + p.t * 0.6; p.me.scale.x = p.me.scale.z = w;
    if (p.t >= p.dur){ FW.remove(p.me); p.me.material.dispose(); PIL.splice(i, 1); } }
}
// 룬 불티 (절대 좌표 파티클)
function runeSparks(x, y, z, n, col){ for (let i = 0; i < n; i++){ const a = R() * 6.283, d = rr(0.3, 1.3); X.emit(x + Math.cos(a) * d, y + rr(0.1, 1.6), z + Math.sin(a) * d, -Math.cos(a) * 0.4, rr(1.2, 2.8), -Math.sin(a) * 0.4, col || (R() < 0.6 ? 0xffe08a : 0x9ff6ff), rr(0.08, 0.16), rr(0.6, 1.2), { drag: 1.2, grav: -0.5 }); } }

// ───────────────────────── 대신 세우는 표식 (towns · props 가 없을 때) ─────────────────────────
// 공유 지오메트리 · 재질. 가까울 때만 보여요 (0.5초마다 거리 확인)
const FBK = [];
const M_WOOD = std({ color: 0x7a5434, roughness: 0.85 }), M_PAPER = std({ color: 0xf2e4bc, roughness: 0.9, emissive: 0x2a2010 }), M_STONE = std({ color: 0x8a8a84, roughness: 0.95, flatShading: true });
const M_DARK = std({ color: 0x434856, roughness: 0.8, flatShading: true }), M_SEED = std({ color: 0x2a1a34, roughness: 0.6, emissive: 0x3a0a4a, emissiveIntensity: 0.6, flatShading: true });
const G_POST = new THREE.CylinderGeometry(0.06, 0.07, 1.3, 6).translate(0, 0.65, 0), G_SHEET = new THREE.BoxGeometry(0.5, 0.38, 0.03).translate(0, 1.18, 0.05);
const G_SLAB = new THREE.BoxGeometry(0.8, 1.05, 0.2).translate(0, 0.5, 0), G_OBEL = new THREE.CylinderGeometry(0.32, 0.55, 2.3, 6).translate(0, 1.15, 0), G_BAND = new THREE.TorusGeometry(0.52, 0.06, 6, 22).rotateX(Math.PI / 2).translate(0, 1.0, 0);
const G_SEED = new THREE.IcosahedronGeometry(0.22, 0);
function fbBase(x, z){ const g = new THREE.Group(); g.position.set(x, gy(x, z), z); g.visible = false; FW.add(g); const o = { g, x, z, on: true, k: 0, glow: null, near: false }; FBK.push(o); return o; }
function fbReadable(r){ const [x, z] = r.c, o = fbBase(x, z);
  if (r.kind === 'stone' || r.kind === 'grave'){ o.g.add(new THREE.Mesh(G_SLAB, M_STONE)); } else { o.g.add(new THREE.Mesh(G_POST, M_WOOD)); o.g.add(new THREE.Mesh(G_SHEET, M_PAPER)); }
  o.g.rotation.y = R() * 6.283; o.glow = X.glowSprite(0xffd36a, 1.1, 0.3); o.glow.position.y = 1.3; o.g.add(o.glow); o.pulse = true; return o; }
function fbKeystone(k){ const [x, z] = k.c, o = fbBase(x, z), s = k.small ? 0.7 : 1; o.g.scale.setScalar(s);
  o.g.add(new THREE.Mesh(G_OBEL, M_DARK)); o.band = std({ color: 0x8a7a50, emissive: 0xffd36a, emissiveIntensity: 0.05, roughness: 0.4, metalness: 0.4 }); o.g.add(new THREE.Mesh(G_BAND, o.band));
  o.glow = X.glowSprite(0xffd36a, 3.2, 0); o.glow.position.y = 1.2; o.g.add(o.glow);
  o.lit = v => { o.k = v; o.band.emissiveIntensity = 0.05 + v * 2.4; o.glow.material.opacity = v * 0.85; }; return o; }
function fbPickup(sp){ const [x, z] = sp.c, o = fbBase(x, z); o.on = false;
  for (let i = 0; i < 3; i++){ const m = new THREE.Mesh(G_SEED, M_SEED); m.position.set(Math.cos(i * 2.1) * 0.22, 0.2 + (i === 2 ? 0.18 : 0), Math.sin(i * 2.1) * 0.22); m.rotation.set(R() * 3, R() * 3, 0); o.g.add(m); }
  o.glow = X.glowSprite(0xffe08a, 1.4, 0.7); o.glow.position.y = 0.6; o.g.add(o.glow); return o; }
let fbT = 0;
function updFallback(rdt){
  if ((fbT -= rdt) <= 0){ fbT = 0.5; for (const o of FBK){ const d = Math.hypot(pp.x - o.x, pp.z - o.z); o.near = d < 90; const v = o.on && o.near; if (o.g.visible !== v) o.g.visible = v; } }
  const t = G.time || 0;
  for (const o of FBK){ if (!o.g.visible || !o.pulse) continue; o.glow.material.opacity = o.need ? 0.65 + Math.sin(t * 4) * 0.25 : 0.22; }
  for (const id in PK){ const p = PK[id]; if (p.fb && p.fb.g.visible) p.fb.g.rotation.y += rdt * 0.8; }
  updResidentFigs(rdt);
}

// ───────────────────────── 세상 변화 (장이 끝나면) ─────────────────────────
// 키마다 towns · props 의 setChange 를 부르고, 풍차(windmill_spin)는 여기서: F.lmState.windmill 0 → 1 (landmarks 가 회전 속도에 곱해요)
F.lmState = F.lmState || {};
const WM = { has: CH.some(c => (c.c.change || []).includes('windmill_spin')), cur: 1, tgt: 1 };
function setChange(key, on, instant){
  guard('towns.setChange', () => { if (F.towns && F.towns.setChange) F.towns.setChange(key, on, instant); });
  guard('props.setChange', () => { if (F.props && F.props.setChange) F.props.setChange(key, on, instant); });
  if (key === 'windmill_spin'){ WM.tgt = on ? 1 : 0; if (instant){ WM.cur = WM.tgt; F.lmState.windmill = WM.cur; } }
}
function applyChanges(n, on, instant){ const c = CHN[n]; if (!c) return; for (const key of c.c.change || []) setChange(key, on, instant); }
function applyAllChanges(){ for (const c of CH) applyChanges(c.n, chapterState(c.n) === 'after', true); }
function updWindmill(rdt){ if (!WM.has || WM.cur === WM.tgt) return; WM.cur = WM.tgt > WM.cur ? Math.min(WM.tgt, WM.cur + rdt * 0.22) : Math.max(WM.tgt, WM.cur - rdt * 0.6); F.lmState.windmill = sst(WM.cur); }

// ───────────────────────── 읽을거리 (양피지 창) ─────────────────────────
const KIND = { stone: ['🪨', '석판', 'STONE TABLET'], note: ['📝', '쪽지', 'NOTE'], diary: ['📔', '일기', 'DIARY'], letter: ['✉️', '편지', 'LETTER'], poster: ['📋', '벽보', 'POSTER'], book: ['📖', '책', 'BOOK'], grave: ['🪦', '묘비', 'EPITAPH'], song: ['🎵', '동요', 'SONG'] };
const townObj = id => guard('towns.obj', () => F.towns && F.towns.obj ? F.towns.obj(id) : null) || null;
const propObj = id => guard('props.obj', () => F.props && F.props.obj ? F.props.obj(id) : null) || null;
for (const id in RD) guard('readable ' + id, () => { const r = RD[id], [x, z] = r.o.c;
  r.it = F.addInteract({ x, z, r: 2.4, title: `📜 ${r.o.title} 읽기`, action: () => openRead(id) }); r.glow = null;
  if (!townObj(id)) r.fb = fbReadable(r.o); });
function setReadGlow(id, on){ const r = RD[id]; if (!r || r.glow === on) return; r.glow = on;
  const t = townObj(id); if (t && t.setGlow) guard('setGlow', () => t.setGlow(on)); if (r.fb) r.fb.need = on; }
const RW = X.mk('div', 'sagaRead', '<button class="x" title="닫기 (Esc)">✕</button><div class="kd"></div><h2></h2><div class="tx"></div><div class="ft"></div>');
RW.classList.add('sagw');
RW.querySelector('.x').onclick = e => { e.stopPropagation(); closeRead(); };
let readCur = null, readRet = false;
function openRead(id, fromCodex){
  const r = RD[id]; if (!r || CINE || RT) return;
  if (cxOpen) closeCodex(); if (F.closeRpgWindow) guard('closeRpg', () => F.closeRpgWindow());
  readCur = id; readRet = !!fromCodex; const k = KIND[r.o.kind] || KIND.note;
  RW.querySelector('.kd').textContent = `${k[0]} ${k[1]} · ${k[2]}`; RW.querySelector('h2').textContent = r.o.title;
  RW.querySelector('.tx').innerHTML = String(r.o.text || '').split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join(''); RW.querySelector('.tx').scrollTop = 0;
  const first = !SG.read[id], ft = RW.querySelector('.ft');
  if (first){ SG.read[id] = Date.now(); X.save(); ft.textContent = '✦ 연대기에 기록됨 ✦'; ft.className = 'ft new';
    guard('read event', () => { if (F.questEvent) F.questEvent('read', { id }); BUS.emit('read', { id }); });
    X.gainExp(Math.max(1, Math.round(X.need(S.lv) * 0.03))); F.note('📖 연대기에 기록됨', 2.6); codexDot(); setReadGlow(id, false); needDirty = true; }
  else { ft.textContent = `${chNo(r.ch.n)} · ${regName(r.ch.L.region)}의 기록`; ft.className = 'ft'; }
  RW.classList.add('on'); X.sfx('ui');
}
function closeRead(){ if (!readCur) return; readCur = null; RW.classList.remove('on'); X.sfx('ui'); if (readRet){ readRet = false; openCodex(cxTab); } }

// ───────────────────────── 룬 수호석 (의식: E 를 누르고 있기) ─────────────────────────
for (const id in KS) guard('keystone ' + id, () => { const k = KS[id], [x, z] = k.o.c;
  k.it = F.addInteract({ x, z, r: 3.0, title: `💠 ${k.o.small ? k.o.name : '룬 수호석'}`, action: () => touchStone(id) });
  if (!townObj(id)) k.fb = fbKeystone(k.o); setLit(id, SG.cleansed[id] ? 1 : 0); });
function setLit(id, v){ const k = KS[id]; if (!k) return; k.lit = v; const t = townObj(id); if (t && t.setLit) guard('setLit', () => t.setLit(v)); if (k.fb) k.fb.lit(v); }
function touchStone(id){
  if (RT || CINE || X.dead) return; const k = KS[id];
  if (SG.cleansed[id]){ X.hint(`💠 ${esc(k.o.name)} — 새긴 룬이 고요히 빛나고 있다`, 2.6); return; }
  if (!NEED.cleanse.has(id)) calcNeed();
  if (!NEED.cleanse.has(id)){ X.hint('빛을 잃은 룬 비석… 아직은 반응이 없다', 2.8); X.sfx('ui'); return; }
  startRitual(id);
}
const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ';
const RTW = X.mk('div', 'sagaRite', `<div class="ring"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52"/><circle class="pg" cx="60" cy="60" r="52"/>${[...RUNES].map((c, i) => { const a = i / RUNES.length * 6.283 - Math.PI / 2; return `<text x="${(60 + Math.cos(a) * 40).toFixed(1)}" y="${(60 + Math.sin(a) * 40).toFixed(1)}">${c}</text>`; }).join('')}</svg><b>ᛟ</b></div><div class="t"></div><div class="s"></div>`);
const RT_PG = RTW.querySelector('.pg'), RT_TX = [...RTW.querySelectorAll('text')], RT_RING = RTW.querySelector('.ring');
let RT = null;
const holdOn = e => { if (!RT) return; e.preventDefault(); e.stopPropagation(); RT.hold = true; RT.mode = 'btn'; }, holdOff = () => { if (RT && RT.mode === 'btn') RT.hold = false; };
RT_RING.addEventListener('pointerdown', holdOn); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) RT_RING.addEventListener(ev, holdOff);
addEventListener('keyup', e => { if (e.code === 'KeyE' && RT && RT.mode === 'key') RT.hold = false; });
addEventListener('blur', () => { if (RT) RT.hold = false; });
function startRitual(id){
  const k = KS[id], key = !!(G.keys && G.keys.KeyE);
  RT = { id, k: 0, mode: key ? 'key' : 'btn', hold: key, started: false, t0: now(), last: now(), shown: -1 };
  G.lock = true; X.fig.root.rotation.y = Math.atan2(k.o.c[0] - pp.x, k.o.c[1] - pp.z);
  RTW.querySelector('.t').textContent = k.o.name; RTW.querySelector('.s').textContent = key ? 'E 를 누르고 있기 — 손을 떼면 룬이 흩어져요' : '룬 고리를 누르고 있기';
  RTW.classList.remove('done', 'hold'); RTW.classList.add('on'); RT_PG.style.strokeDashoffset = 326.7; for (const t of RT_TX) t.classList.remove('on'); X.sfx('rune');
}
function endRitual(ok, quiet){ const r = RT; if (!r) return; RT = null; G.lock = false; RTW.classList.remove('hold');
  if (!ok){ RTW.classList.remove('on'); setLit(r.id, SG.cleansed[r.id] ? 1 : 0); if (!quiet) X.hint('손을 떼자 룬의 빛이 흩어졌다… 다시 해 보자', 2.6); } }
let ritPT = 0;
function updRitual(){ try { updRitual0(); } catch (e){ console.error('[saga] ritual', e); RT = null; G.lock = false; RTW.classList.remove('on', 'hold'); } }
function updRitual0(){
  const r = RT; if (!r) return; const t = now(), dt = Math.min(0.1, t - r.last); r.last = t; const k = KS[r.id], [x, z] = k.o.c;
  if (!fieldOn() || X.dead || X.dialogOpen || Math.hypot(pp.x - x, pp.z - z) > 5){ endRitual(false, true); return; }
  G.lock = true;
  if (r.mode === 'key' && !(G.keys && G.keys.KeyE)) r.hold = false;
  if (r.hold){ r.started = true; r.k = Math.min(1, r.k + dt / 2.6); }
  else if (r.started){ endRitual(false); return; }
  else if (t - r.t0 > 7){ endRitual(false, true); return; }
  RTW.classList.toggle('hold', r.hold); RT_PG.style.strokeDashoffset = (326.7 * (1 - r.k)).toFixed(1);
  const lit = Math.floor(r.k * RT_TX.length); if (lit !== r.shown){ r.shown = lit; RT_TX.forEach((e, i) => e.classList.toggle('on', i < lit)); if (lit > 0 && r.hold) X.sfx('type'); }
  setLit(r.id, r.k);
  if (r.hold && (ritPT -= dt) <= 0){ ritPT = LOW ? 0.12 : 0.05; runeSparks(x, gy(x, z), z, LOW ? 2 : 3); }
  if (r.k >= 1) finishRitual();
}
function finishRitual(){
  const id = RT.id, k = KS[id], [x, z] = k.o.c; RT = null; G.lock = false;
  RTW.classList.remove('hold'); RTW.classList.add('done'); setTimeout(() => { if (!RT) RTW.classList.remove('on', 'done'); }, 950);
  SG.cleansed[id] = Date.now(); setLit(id, 1); X.save();
  pillar(x, z, 0xffe9a0, 3.4); X.shockwave(x, 0.15, z, 7, 0xffd36a, 0.9); X.shockwave(x, 0.4, z, 4, 0x9ff6ff, 0.7);
  X.burst(new V3(x, 1.4, z), 0xfff0b0, LOW ? 36 : 80, 6, 0.3, 1.2, -1, 4); X.burst(new V3(x, 1, z), 0x7ff3ff, LOW ? 18 : 40, 4, 0.25, 1, -2, 3);
  G.shake = Math.max(G.shake || 0, 0.5); X.sfx('rune'); X.sfx('level'); X.sfx('shard');
  guard('cleanse event', () => { if (F.questEvent) F.questEvent('cleanse', { id }); BUS.emit('cleanse', { id }); });
  X.banner('RUNE RESTORED', k.o.name, '이름 없는 자의 손에 룬이 다시 새겨졌다', false, 3); codexDot(); needDirty = true;
}

// ───────────────────────── 이야기 물건 줍기 (셋피스 pickup) ─────────────────────────
const PK = {};
for (const id in SP){ const s = SP[id]; if (!s.o.pickup) continue; guard('pickup ' + id, () => { const [x, z] = s.o.c, name = spName(s.o);
  PK[id] = { s, name, on: null, it: F.addInteract({ x, z, r: 2.2, title: `✋ ${name} 줍기`, action: () => pickUp(id), hidden: true }), fb: propObj(id) ? null : fbPickup(s.o) };
  showPick(id, false); }); }
function showPick(id, on){ const p = PK[id]; if (!p || p.on === on) return; p.on = on; p.it.hidden = !on;
  guard('props.show', () => { if (F.props && F.props.show) F.props.show(id, on); }); if (p.fb){ p.fb.on = on; if (!on) p.fb.g.visible = false; } }
function pickUp(id){
  const p = PK[id]; if (!p || !p.on || SG.picked[id] || CINE || RT) return;
  SG.picked[id] = Date.now(); X.save(); showPick(id, false);
  const [x, z] = p.s.o.c, y = gy(x, z); for (let i = 0; i < (LOW ? 12 : 24); i++) X.emit(x, y + 0.4, z, rr(-1.5, 1.5), rr(1.5, 3.5), rr(-1.5, 1.5), pick([0xffe08a, 0xfff6d0, 0x9ff6ff]), 0.12, rr(0.5, 0.9), { grav: -3, drag: 1 });
  X.sfx('pick'); X.sfx('shard'); F.note(`✋ ${esc(p.name)} — 주웠다`, 2.4);
  guard('collect event', () => { if (F.questEvent) F.questEvent('collect', { id }); BUS.emit('collect', { id }); }); needDirty = true;
}
// 필요한 것만 켜요 (읽을거리 빛 · 줍기 물건 · 수호석 빛)
function applyNeed(){
  for (const id in RD) setReadGlow(id, NEED.read.has(id) && !SG.read[id]);
  for (const id in PK) showPick(id, NEED.collect.has(id) && !SG.picked[id]);
  for (const id in KS){ const k = KS[id], need = NEED.cleanse.has(id) && !SG.cleansed[id]; if (k.need !== need){ k.need = need; const t = townObj(id); if (t && t.setGlow) guard('ks setGlow', () => t.setGlow(need)); if (k.fb){ k.fb.need = need; if (!SG.cleansed[id] && !(RT && RT.id === id)) k.fb.lit(need ? 0.18 : 0); } } }
}

// ───────────────────────── 이야기 보스 ─────────────────────────
// 그 퀘스트가 진행 중이고 70m 안에 오면 한 번 나타나요. 멀어지거나(140m) 쓰러지거나 퀘스트가 끝나면 조용히 사라졌다가 다음에 체력이 꽉 차서 다시 나와요.
// life 의 돌아가는 필드 보스와 같은 녀석(같은 key · 같은 자리)이 떠 있으면 새로 만들지 않고 그 녀석을 이야기 보스로 삼아요 (겹치지 않게).
const SBS = {}; for (const id in SB) SBS[id] = { id, b: SB[id].o, e: null, cd: 0, bar: false, barT: 0, adopt: false, introT: -1e9 };
let T = 0;
const liveE = e => !!e && e.state !== 'dying' && X.ENEMIES.includes(e);
function quietRemove(e){ if (!e || e.state === 'dying') return; e.state = 'dying'; e.st = 0.25; e.g.visible = false; if (e.bar) e.bar.remove(); X.rmTele(e); if (e.atk){ X.rmTele(e.atk); e.atk = null; } }
function dropSB(st, cd){ if (st.e && !st.adopt) quietRemove(st.e); st.e = null; st.adopt = false; if (st.bar){ X.bossBar(null); st.bar = false; } st.cd = T + (cd || 0); }
function spawnSB(st){
  const b = st.b; if (!(X.MON[b.key] || X.BOSS[b.key])) return; const [x, z] = b.c;
  st.e = X.spawnMon(b.key, x, z, false, { lv: b.lv, name: b.name, scale: b.scale || 1, hpMul: b.hpMul || 2, fld: { aggro: 16, leash: 40, wr: 4 }, fieldBoss: true, data: { sbId: b.id } });
  st.adopt = false; X.burst(new V3(x, 1.2, z), 0x6a2a8a, LOW ? 30 : 60, 7, 0.35, 1.0, -2, 2.5); X.shockwave(x, 0.15, z, 7, 0x9a4aff, 0.8); X.sfx('elite');
  if (T - st.introT > 90){ st.introT = T; X.banner('STORY BOSS', b.name, `${regName(SB[b.id].ch.L.region)} · Lv.${b.lv} — 가시에 물든 수호수`, true, 3.2); }
  BUS.emit('storyBoss', { id: b.id, state: 'spawn' });
}
function sbTick(){
  for (const id in SBS){ const st = SBS[id], b = st.b, want = NEED.sboss.has(id) && !SG.sboss[id];
    if (st.e && !liveE(st.e)){ st.e = null; st.adopt = false; if (st.bar){ X.bossBar(null); st.bar = false; } }
    if (!want || !fieldOn() || X.dead){ if (st.e || st.bar) dropSB(st, 2); continue; }
    const d = Math.hypot(pp.x - b.c[0], pp.z - b.c[1]);
    if (st.e){
      if (st.adopt) continue;   // life 의 필드 보스 — 체력바 · 정리는 life 가 맡아요
      const de = Math.hypot(pp.x - st.e.pos.x, pp.z - st.e.pos.z);
      if (d > 140 && de > 60){ dropSB(st, 3); continue; }
      const near = d < 45 || (st.e.aggro && de < 60);
      if (near && (!st.bar || T - st.barT > 1)){ X.bossBar(st.e); st.bar = true; st.barT = T; } else if (!near && st.bar){ X.bossBar(null); st.bar = false; }
      continue; }
    if (d > 70 || T < st.cd) continue;
    const wb = F.worldBoss;
    if (wb && wb.alive && wb.key === b.key && Math.hypot(wb.x - b.c[0], wb.z - b.c[1]) < 60){ if (wb.e && liveE(wb.e)) adoptSB(st, wb.e); continue; }
    spawnSB(st);
  }
}
function adoptSB(st, e){ if (st.e && !st.adopt) quietRemove(st.e); if (st.bar){ X.bossBar(null); st.bar = false; } e.sbId = st.id; st.e = e; st.adopt = true; }
BUS.on('spawn', e => guard('sb adopt', () => { if (!e || !e.fbId || e.sbId) return;
  for (const id in SBS){ const st = SBS[id], b = st.b; if (b.key !== e.key || !NEED.sboss.has(id) || SG.sboss[id] || Math.hypot(e.pos.x - b.c[0], e.pos.z - b.c[1]) > 60) continue; adoptSB(st, e); break; } }));
BUS.on('kill', e => guard('sb kill', () => { if (!e || !e.sbId) return; const id = e.sbId, st = SBS[id]; if (!st) return;
  if (st.e === e){ st.e = null; st.adopt = false; } if (st.bar){ X.bossBar(null); st.bar = false; }
  if (SG.sboss[id]) return; SG.sboss[id] = Date.now(); X.save();
  const x = e.pos.x, z = e.pos.z; X.burst(new V3(x, 1.4, z), 0x2a0a3a, LOW ? 24 : 50, 6, 0.3, 1.1, -6, 3); pillar(x, z, 0xd8c0ff, 2.6, 40);
  guard('sboss event', () => { if (F.questEvent) F.questEvent('sboss', { id }); BUS.emit('storyBoss', { id, state: 'dead' }); });
  X.later(1.2, () => X.banner('VICTORY', st.b.name, '검은 가시가 떨어져 나갔다 — 수호수가 제정신을 찾는다', false, 3.4)); codexDot(); needDirty = true; }));

// ───────────────────────── 장 연출 (시작 · 끝) ─────────────────────────
// 실제 시간(performance.now)으로 흘러요 — 느린 기기에서도 글이 제 속도로 나와요. 클릭 · E · Esc · Space 로 건너뛰기.
const CE = X.mk('div', 'sagaCine', '<div class="fade"></div><div class="card"><div class="no"></div><div class="ti"></div><div class="ln"></div><div class="en"></div></div><div class="nar"></div><div class="skip">클릭 · E · Esc — 건너뛰기</div>');
const CE_FADE = CE.querySelector('.fade'), CE_CARD = CE.querySelector('.card'), CE_NAR = CE.querySelector('.nar');
CE.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (CINE && now() - CINE.t0 > 0.8) skipCine(); });
const OV = { pos: new V3(), look: new V3() }, _a = new V3(), _b = new V3();
const CPS = 0.05, HOLD = 1.05;   // 글자당 초 · 줄 사이 쉼
let CINE = null;
const busy = () => !!CINE;
function fade(on, sec){ CE_FADE.style.transitionDuration = (sec || 0.45) + 's'; CE_FADE.classList.toggle('on', on); }
function narPlan(lines, t0){ let t = t0; const out = []; for (const s of lines){ const str = String(s); out.push({ s: str, t, n: -1, p: null }); t += [...str].length * CPS + HOLD; } return { L: out, end: t }; }
function narUpd(C, t){
  for (const l of C.nar.L){ if (t < l.t) break; if (!l.p){ for (const q of CE_NAR.children) q.classList.add('old'); l.p = document.createElement('p'); CE_NAR.appendChild(l.p); while (CE_NAR.children.length > 5) CE_NAR.firstChild.remove(); l.ch = [...l.s]; }
    const n = Math.min(l.ch.length, Math.floor((t - l.t) / CPS)); if (n !== l.n){ l.n = n; l.p.textContent = l.ch.slice(0, n).join(''); if (n % 4 === 1 && n < l.ch.length) X.sfx('type'); } }
}
function cineStart(kind, n){
  document.body.classList.add('cine', 'saga-cine'); document.body.classList.toggle('saga-intro', kind === 'intro');
  CE.classList.add('on'); CE_NAR.innerHTML = ''; CE_CARD.classList.remove('on', 'sm'); fade(true, 0.45); G.lock = true; X.hint('', 0);
  if (readCur) closeRead(); if (cxOpen) closeCodex(); if (F.closeRpgWindow) guard('closeRpg', () => F.closeRpgWindow());
  const c = CHN[n]; CE_CARD.querySelector('.no').textContent = kind === 'outro' ? `「${chNo(n)}」 · 끝` : `「${chNo(n)}」`;
  CE_CARD.querySelector('.ti').textContent = c.c.title || ''; CE_CARD.querySelector('.en').textContent = kind === 'outro' ? `${chEn(n)} · COMPLETE` : (c.c.en || chEn(n)).toUpperCase();
}
function cineEnd(){ const C = CINE; if (!C) return; CINE = null;
  CE.classList.remove('on'); fade(false, 0.01); CE_CARD.classList.remove('on'); document.body.classList.remove('cine', 'saga-cine', 'saga-intro');
  if (G.camOverride === OV) G.camOverride = null; if (!RT) G.lock = false; guard('cine done', () => C.done && C.done()); C.res(true); }
function skipCine(){ const C = CINE; if (!C || C.out) return; const t = now() - C.t0; if (C.kind === 'outro' && !C.changed) outroChange(C); C.tEnd = Math.min(C.tEnd, t); }
// 카메라 (절대 좌표). 땅 밑으로 안 들어가게
function camAt(x, y, z, lx, ly, lz){ y = Math.max(y, gy(x, z) + 2.5); OV.pos.set(x, y, z); OV.look.set(lx, ly, lz); G.camOverride = OV; }
function panAt(c, k){ const P = c.pan; if (!P || !P[0]) return; const a = P[0], b = P[1] || P[0], e = sst(k); camAt(lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e), lerp(a[3], b[3], e), lerp(a[4], b[4], e), lerp(a[5], b[5], e)); }
// pan 이 없는 장: 지역 가운데를 둘러봐요
function defPan(c){ const rg = F.regionById(c.L.region) || { c: [0, 0] }, [x, z] = c.set && c.set.c ? c.set.c : rg.c, y = gy(x, z); return [[x + 70, y + 45, z + 60, x, y + 6, z], [x - 60, y + 38, z + 50, x, y + 4, z]]; }
function playIntro(n, replay){
  const c = CHN[n]; if (!c || CINE || RT || !fieldOn()) return Promise.resolve(false);
  return new Promise(res => {
    const lines = (c.c.intro || []).slice(0, 6), nar = narPlan(lines, 2.7), D = Math.max(7, nar.end + 1.8 - 1.3);
    CINE = { kind: 'intro', n, c, t0: now(), res, nar, D, tEnd: Math.max(1.3 + D, nar.end + 1.8), pan: c.c.pan && c.c.pan[0] ? c.c.pan : defPan(c), ph: 0, replay };
    cineStart('intro', n); const r = chRec(n); if (!r.intro){ r.intro = true; X.save(); }
    X.sfx('summon');
    CINE.done = () => { if (!replay) X.later(0.6, () => nextHint(n)); };
  });
}
function updIntro(C, t){
  if (t >= 0.5) panAt(C, clamp((t - 1.3) / C.D, 0, 1));
  if (C.ph === 0 && t >= 1.3){ C.ph = 1; fade(false, 0.9); }
  if (C.ph === 1 && t >= 1.8){ C.ph = 2; CE_CARD.classList.add('on'); X.sfx('rune'); }
  if (!C.out) narUpd(C, t);
  if (!C.out && t >= C.tEnd){ C.out = t; fade(true, 0.45); CE_CARD.classList.remove('on'); }
  if (C.out && t >= C.out + 0.5 && G.camOverride === OV) G.camOverride = null;
  if (C.out && t >= C.out + 1.25) cineEnd();
}
// 장 끝: 수호석(없으면 정착지)을 비추며 내레이션 → 세상이 바뀌는 순간 → 「제 N 장 완료」
function playOutro(n){
  const c = CHN[n]; if (!c) return Promise.resolve(false);
  const r = chRec(n); r.outro = true; if (!r.t) r.t = Date.now(); X.save(); if (pendOutro === n) pendOutro = null;
  if (CINE || !fieldOn()){ applyChanges(n, true, !fieldOn()); outroBanner(n); return Promise.resolve(false); }
  return new Promise(res => {
    const lines = (c.c.outro || []).slice(0, 5), nar = narPlan(lines, 1.9), tc = nar.end + 0.3;
    const f = c.ks ? c.ks.c : c.set && c.set.c ? c.set.c : (F.regionById(c.L.region) || { c: [pp.x, pp.z] }).c;
    const sv = c.set && c.set.c && Math.hypot(c.set.c[0] - f[0], c.set.c[1] - f[1]) > 40 && Math.hypot(c.set.c[0] - f[0], c.set.c[1] - f[1]) < 320 ? c.set.c : null;
    CINE = { kind: 'outro', n, c, t0: now(), res, nar, tc, f, sv, a0: Math.atan2(pp.x - f[0], pp.z - f[1]) || 0.7, changed: false, tEnd: tc + (sv ? 4.6 : 3.4) };
    cineStart('outro', n); CE_CARD.classList.add('sm');
    CINE.done = () => outroBanner(n);
  });
}
function outroChange(C){ if (C.changed) return; C.changed = true; applyChanges(C.n, true, false);
  const [x, z] = C.f; pillar(x, z, 0xfff0b8, 3.6); X.shockwave(x, 0.2, z, 12, 0xffd36a, 1.2); X.burst(new V3(x, 2, z), 0xfff0b0, LOW ? 30 : 70, 7, 0.3, 1.4, -1, 5); X.sfx('rune'); X.sfx('shard'); }
function updOutro(C, t){
  const [fx, fz] = C.f, fy = gy(fx, fz);
  if (t >= 0.5){
    if (C.sv && C.changed && t > C.tc + 0.9){ const [sx, sz] = C.sv, sy = gy(sx, sz), a = Math.atan2(fx - sx, fz - sz) + 0.5 + (t - C.tc) * 0.03; camAt(sx + Math.sin(a) * 34, sy + 20, sz + Math.cos(a) * 34, sx, sy + 2, sz); }
    else { const a = C.a0 + t * 0.045, d = C.c.ks && C.c.ks.small ? 9 : 12; camAt(fx + Math.sin(a) * d, fy + 5.2, fz + Math.cos(a) * d, fx, fy + 1.6, fz); } }
  if (C.ph === undefined && t >= 1.3){ C.ph = 1; fade(false, 0.9); CE_CARD.classList.add('on'); }
  if (!C.out) narUpd(C, t);
  if (!C.changed && t >= C.tc) outroChange(C);
  if (!C.out && t >= C.tEnd){ C.out = t; fade(true, 0.45); CE_CARD.classList.remove('on'); }
  if (C.out && t >= C.out + 0.5 && G.camOverride === OV) G.camOverride = null;
  if (C.out && t >= C.out + 1.25) cineEnd();
}
function outroBanner(n){ const c = CHN[n]; X.banner(n === 0 ? 'PROLOGUE COMPLETE' : `CHAPTER ${n} COMPLETE`, `${chNo(n)} 완료 — ${c.c.title || ''}`, c.c.en || '', false, 3.6); X.sfx('level'); codexDot(); }
function updCine(){ const C = CINE; if (!C) return;
  if (!F.inField || X.mode !== 'field' || X.dead){ if (C.kind === 'outro' && !C.changed){ C.changed = true; guard('apply', () => applyChanges(C.n, true, true)); } cineEnd(); return; }
  const t = now() - C.t0; if (!document.body.classList.contains('cine')) document.body.classList.add('cine'); G.lock = true;
  // 무엇이 깨져도 화면 · 조작이 묶이지 않게: 오류나 너무 길면 바로 끝내요
  try { if (C.kind === 'intro') updIntro(C, t); else updOutro(C, t); } catch (e){ console.error('[saga] cine', e); cineEnd(); return; }
  if (CINE === C && t > Math.max(45, C.tEnd + 8)) cineEnd();
}
// 연출이 끝나면 다음 할 일을 알려 줘요
function nextHint(n){ const c = CHN[n]; if (!c) return; const D = DONE(), A = ACT(), id = c.mains.find(q => !D[q]); if (!id) return; const q = getQ(id); if (!q) return;
  if (!A[id]){ const g = byId('npcs', q.giver); if (g) X.hint(`❗ <b>${esc(g.name)}</b>에게 말을 걸어 보세요 — 「${esc(q.name)}」`, 5.5); }
  else X.hint(`📜 ${esc(q.name)} — <b>L</b> 퀘스트 · <b>N</b> 연대기`, 4.5); }
// 연출을 띄워도 되는 때 (필드 · 싸우는 중 아님 · 창 · 대화 없음)
function inCombat(){ for (const e of X.ENEMIES){ if (e.state === 'dying' || !e.g || !e.g.visible) continue; const d = Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z); if (d < 14 || (e.aggro && d < 32)) return true; } return false; }
let enterT = -1;
const canCine = () => fieldOn() && enterT >= 0 && T - enterT > 1.4 && !CINE && !RT && !X.dead && !X.dialogOpen && !X.tpBusy && !G.lock && !X.anyWindow && !readCur && !cxOpen
  && !(F.rpgWindowOpen && F.rpgWindowOpen()) && !F.gliding && X.player.ground !== false && !(F.modules.minigames && F.modules.minigames.state) && !document.body.classList.contains('shopping') && !inCombat();
const inArea = c => { const rg = F.regionAt(pp.x, pp.z); if (rg && rg.id === c.L.region) return true; const s = c.set; return !!(s && s.c && Math.hypot(pp.x - s.c[0], pp.z - s.c[1]) < s.r); };
let pendOutro = null;
function storyTick(){
  if (CINE || !canCine()) return;
  if (pendOutro != null){ const n = pendOutro; if (chRec(n).outro) pendOutro = null; else { playOutro(n); return; } }
  for (const c of CH){ const r = chRec(c.n); if (r.intro) continue; const s = chapterState(c.n);
    if (c.n === CH[0].n ? s !== 'after' : s === 'during' && inArea(c)){ playIntro(c.n); return; } }
}
// rpg 가 보고를 받은 직후 불러요 — 장의 마지막 이야기면 장 끝 연출을 보여 주고 끝나면 이어가요
async function afterQuest(qid){ const c = CH.find(x => x.last === qid); if (!c || chRec(c.n).outro || chapterState(c.n) !== 'after') return false; return playOutro(c.n); }

// ───────────────────────── 인사 (F.greet) ─────────────────────────
// 주민: 자기 지역 장의 상태(전 · 중 · 후) 대사 / 기존 NPC: 그 NPC 의 대사를 가진 lore 중 진행 중인 장 → 끝난 장(나중 장 먼저) → 사는 지역 장의 'before'
const lineOf = (lines, s) => { if (!lines) return null; for (const k of [s, 'during', 'before', 'after']){ const l = lines[k]; if (l && l.length) return pick(l); } return null; };
F.greet = id => guard('greet', () => {
  const r = RES[id]; if (r) return lineOf(r.o.lines, chapterState(r.ch.n));
  const L = NL[id]; if (!L) return null;
  const cand = L.map(x => ({ x, s: chapterState(x.ch.n) })).sort((a, b) => b.x.ch.n - a.x.ch.n);
  for (const want of ['during', 'after']) for (const c of cand){ if (c.s !== want) continue; const ln = c.x.lines && c.x.lines[want]; if (ln && ln.length) return pick(ln); }
  const n = byId('npcs', id), rg = n && n.c ? F.regionAt(n.c[0], n.c[1]) : null, home = cand.find(c => c.x.ch.L.region === (rg && rg.id)) || cand[cand.length - 1];
  const ln = home && home.x.lines && home.x.lines.before; return ln && ln.length ? pick(ln) : null;
}) || null;
BUS.on('talk', d => guard('met', () => { const id = d && d.npc; if (!id || SG.met[id] || !byId('npcs', id)) return; const n = byId('npcs', id); if (n.object) return; SG.met[id] = Date.now(); dirty(); codexDot(); }));

// ───────────────────────── 주민 피규어 (towns 가 못 세운 주민 · life 가 있을 때만) ─────────────────────────
const RFIG = [];
function buildResidentFigs(){
  if (!F.modules.life || !F.npcs) return;
  const P_IDLE = G.pose ? G.pose({ hy: 0.86, laz: 0.1, raz: -0.1 }) : null;
  for (const id in RES){ if (F.npcs[id]) continue; const n = byId('npcs', id); if (!n || !n.c) continue;
    guard('resident ' + id, () => { const [x, z] = n.c, av = X.makeAvatar({ job: n.job, look: n.look || {}, scale: 0.9 }), f = av.fig;
      f.root.position.set(x, gy(x, z), z); f.root.rotation.y = n.face || 0; f.root.visible = false; FW.add(f.root); if (!n.job && av.setArmed) av.setArmed(false);
      const label = F.label({ obj: f.root, text: n.name, sub: n.title, cls: 'npc', max: 34, y: 2.45 });
      F.addInteract({ x, z, r: 2.8, title: `${n.name} · 대화`, action: () => F.talk(id) }); F.circle(x, z, 0.5);
      X.NAMES[id] = n.name; X.SPK[id] = () => f; F.npcs[id] = { fig: f, pos: f.root.position, label, av, n, props: {} };
      if (P_IDLE && f.set){ f.set(P_IDLE); if (f.blend) f.blend(1, 7); }
      RFIG.push({ f, av, x, z, y0: f.root.position.y, face: n.face || 0, t: R() * 10, vis: false }); }); }
  if (RFIG.length) console.log(`[saga] towns 대신 주민 피규어 ${RFIG.length}`);
}
let rfT = 0;
function updResidentFigs(rdt){
  if (!RFIG.length) return; const chk = (rfT -= rdt) <= 0; if (chk) rfT = 0.5;
  for (const o of RFIG){ if (chk){ const v = Math.hypot(pp.x - o.x, pp.z - o.z) < 85; if (v !== o.vis){ o.vis = v; o.f.root.visible = v; } } if (!o.vis) continue;
    o.t += rdt; const d = Math.hypot(pp.x - o.x, pp.z - o.z), want = d < 7 ? Math.atan2(pp.x - o.x, pp.z - o.z) : o.face;
    let da = want - o.f.root.rotation.y; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283; o.f.root.rotation.y += da * Math.min(1, rdt * 3);
    o.f.root.position.y = o.y0 + Math.sin(o.t * 1.8) * 0.01; if (o.f.blend) o.f.blend(rdt, 7); if (d < 30 && o.av.upd) o.av.upd(rdt, 0, false); }
}

// ───────────────────────── 연대기 창 (N) ─────────────────────────
const CW = X.mk('div', 'sagaCodex', '<div class="hd"><span>CHRONICLE</span><b>📖 아르카디아 연대기</b><div class="tabs"><button data-t="ch">장</button><button data-t="rec">기록</button><button data-t="ppl">인물</button><button data-t="ks">수호석</button></div><button class="x" title="닫기 (Esc)">✕</button></div><div class="bd"></div>');
CW.classList.add('sagw');
let cxOpen = false, cxTab = 'ch';
const cxBtn = F.menu ? F.menu.add('📖', '연대기', () => toggleCodex(), 'N') : null;
function codexDot(){ if (cxBtn && !cxOpen) cxBtn.classList.add('dot'); }
function openCodex(tab){ if (CINE || RT) return; if (tab) cxTab = tab; if (readCur){ readRet = false; closeRead(); } if (F.closeRpgWindow) guard('closeRpg', () => F.closeRpgWindow());
  cxOpen = true; CW.classList.add('on'); if (cxBtn) cxBtn.classList.remove('dot'); renderCodex(); X.sfx('ui'); }
function closeCodex(){ if (!cxOpen) return; cxOpen = false; CW.classList.remove('on'); }
function toggleCodex(tab){ if (cxOpen && !tab) closeCodex(); else openCodex(tab); }
CW.querySelector('.x').onclick = e => { e.stopPropagation(); closeCodex(); X.sfx('ui'); };
CW.querySelector('.tabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; cxTab = b.dataset.t; X.sfx('ui'); renderCodex(); };
CW.querySelector('.bd').addEventListener('click', e => {
  const rp = e.target.closest('[data-intro]'), rd = e.target.closest('[data-rd]');
  if (rp){ const n = +rp.dataset.intro; if (!fieldOn()){ X.hint('모험의 대지에서 다시 볼 수 있어요', 2.4); return; } closeCodex(); playIntro(n, true); return; }
  if (rd){ openRead(rd.dataset.rd, true); }
});
const ST_N = { before: '시작 전', during: '진행 중', after: '완료' };
function renderCodex(){
  if (!cxOpen) return; for (const b of CW.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.t === cxTab);
  const bd = CW.querySelector('.bd'), D = DONE(); let h = '';
  if (cxTab === 'ch'){
    h = '<p class="note">이름 없는 자의 여정. 장을 마칠 때마다 세상이 조금씩 제 모습을 찾아요. 「다시 보기」로 장의 시작을 다시 볼 수 있어요.</p>';
    for (const c of CH){ const s = chapterState(c.n), dn = c.mains.filter(id => D[id]).length, tot = c.mains.length || 1, lv = c.c.lv ? `Lv.${c.c.lv[0]}~${c.c.lv[1]}` : '';
      h += `<div class="cc ${s}"><div class="k">${chNo(c.n)} · ${esc(regName(c.L.region))}<em>${ST_N[s]}</em></div><h3>${s === 'before' && c.n > 0 && chapterState(c.n - 1) === 'before' ? '? ? ?' : esc(c.c.title)}</h3><div class="en">${esc((c.c.en || '').toUpperCase())}</div>
        <div class="pb"><i style="width:${Math.round(dn / tot * 100)}%"></i></div><small>이야기 ${dn} / ${c.mains.length}${lv ? ' · ' + lv : ''}${c.ks ? ` · 💠 ${esc(c.ks.name)} ${SG.cleansed[c.ks.id] ? '✦' : '—'}` : ''}</small>
        ${s === 'before' ? '<p class="in" style="color:#7a8a90">아직 펼쳐지지 않은 장이에요.</p>' : `<p class="in">${(c.c.intro || []).map(esc).join('<br>')}</p>`}
        ${s === 'after' && (c.c.outro || []).length ? `<div class="out">${c.c.outro.map(esc).join('<br>')}</div>` : ''}
        ${s !== 'before' || chRec(c.n).intro ? `<div class="rp"><button class="btn" data-intro="${c.n}">▶ 다시 보기</button></div>` : ''}</div>`; } }
  else if (cxTab === 'rec'){
    const all = Object.keys(RD).length, got = Object.keys(RD).filter(id => SG.read[id]).length;
    h = `<p class="note">석판 · 일기 · 편지 · 동요 — 아르카디아 곳곳에 남은 이야기 조각 <b style="color:#ffd36a">${got} / ${all}</b>. 눌러서 다시 읽어요.</p>`;
    for (const c of CH){ const ids = Object.keys(RD).filter(id => RD[id].ch === c); if (!ids.length) continue; const n = ids.filter(id => SG.read[id]).length;
      h += `<div class="grp"><b>${chNo(c.n)} · ${esc(regName(c.L.region))}</b><span>${n} / ${ids.length}</span></div><div class="grid">${ids.map(id => { const r = RD[id], k = KIND[r.o.kind] || KIND.note;
        return SG.read[id] ? `<button class="rd" data-rd="${id}">${k[0]} <span>${esc(r.o.title)}</span></button>` : `<div class="rd un">${k[0]} <span>? ? ?</span></div>`; }).join('')}</div>`; } }
  else if (cxTab === 'ppl'){
    const ppl = W.npcs.filter(n => !n.object), met = ppl.filter(n => SG.met[n.id]);
    h = `<p class="note">이야기를 나눈 사람들 <b style="color:#ffd36a">${met.length} / ${ppl.length}</b>. 장이 흐르면 사람들의 이야기도 달라져요.</p>`;
    const by = {}; for (const n of met){ const rg = RES[n.id] ? RES[n.id].ch.L.region : (F.regionAt(n.c[0], n.c[1]) || { id: '?' }).id; (by[rg] = by[rg] || []).push(n); }
    const order = [...CH.map(c => c.L.region), ...Object.keys(by)].filter((v, i, a) => a.indexOf(v) === i);
    for (const rg of order){ const L = by[rg]; if (!L) continue;
      h += `<div class="grp"><b>${esc(regName(rg))}</b><span>${L.length}</span></div><div class="grid">${L.map(n => `<div class="pe"><b>${esc(n.name)}</b><small>${esc(n.title || '')}</small><p>${esc(F.greet(n.id) || '…')}</p></div>`).join('')}</div>`; }
    if (!met.length) h += '<p class="note" style="color:#7a8a90">아직 이야기를 나눈 사람이 없어요. 머리 위에 이름이 뜬 사람에게 말을 걸어 보세요.</p>'; }
  else {
    h = '<p class="note">천 년 전 현자 세렌이 대봉인을 위해 박은 룬 수호석. 이름 없는 자의 손이 룬을 다시 새길 수 있어요.</p>';
    for (const id in KS){ const k = KS[id], s = chapterState(k.ch.n), lit = !!SG.cleansed[id], known = lit || s !== 'before';
      h += `<div class="ksr ${lit ? 'lit' : s === 'during' ? 'dark' : ''}"><i>${lit ? 'ᛟ' : known ? 'ᚱ' : '?'}</i><div><b>${known ? esc(k.o.name) : '? ? ?'}</b><small>${chNo(k.ch.n)} · ${esc(regName(k.ch.L.region))}${known ? ` · 수호: ${esc(k.o.guardian || GUARD[k.ch.L.region] || '—')}` : ''}</small></div><em>${lit ? '✦ 룬이 새겨짐' : s === 'during' ? '빛을 잃음 — 정화가 필요해요' : known ? '빛을 잃음' : '아직 모르는 곳'}</em></div>`; } }
  bd.innerHTML = h;
}

// ───────────────────────── 지도 표시 · 목표 위치 ─────────────────────────
const MKS = {};
function setMk(key, x, z, c){ let m = MKS[key]; if (!m) m = MKS[key] = { x, z, c, saga: key }; m.x = x; m.z = z; m.c = c; if (!G.mapMarkers.includes(m)) G.mapMarkers.push(m); }
function clrMk(key){ const m = MKS[key]; if (!m) return; const i = G.mapMarkers.indexOf(m); if (i >= 0) G.mapMarkers.splice(i, 1); delete MKS[key]; }
function clrAllMk(){ for (const k in MKS) clrMk(k); }
function updMarkers(){
  const want = {}, cc = CH.find(c => chapterState(c.n) === 'during' && c.ks && !SG.cleansed[c.ks.id]);
  if (cc) want.ks = [cc.ks.c[0], cc.ks.c[1], '#ffd36a'];
  for (const id in SBS){ if (!NEED.sboss.has(id) || SG.sboss[id]) continue; const st = SBS[id], e = st.e; want['sb_' + id] = e && liveE(e) ? [e.pos.x, e.pos.z, '#ff4a5a'] : [st.b.c[0], st.b.c[1], '#ff4a5a']; }
  for (const k in MKS) if (!want[k]) clrMk(k); for (const k in want) setMk(k, want[k][0], want[k][1], want[k][2]);
}
function target(o){ if (!o) return null;
  switch (o.t){
    case 'read': { const r = RD[o.id]; return r ? { x: r.o.c[0], z: r.o.c[1], label: `📜 ${r.o.title}` } : null; }
    case 'collect': { let best = null, bd = 1e9; for (const id of (Array.isArray(o.id) ? o.id : [o.id])){ const s = SP[id]; if (!s || SG.picked[id]) continue; const d = Math.hypot(s.o.c[0] - pp.x, s.o.c[1] - pp.z); if (d < bd){ bd = d; best = s; } }
      return best ? { x: best.o.c[0], z: best.o.c[1], label: `✋ ${spName(best.o)}` } : null; }
    case 'cleanse': { const k = KS[o.id]; return k ? { x: k.o.c[0], z: k.o.c[1], label: `💠 ${k.o.name}` } : null; }
    case 'sboss': { const s = SBS[o.id]; if (!s) return null; const e = s.e && liveE(s.e) ? s.e : null; return { x: e ? e.pos.x : s.b.c[0], z: e ? e.pos.z : s.b.c[1], label: `☠ ${s.b.name}` }; }
  }
  return null; }

// ───────────────────────── 키 · 이벤트 ─────────────────────────
// 연출 · 의식 중엔 다른 키가 새지 않게 맨 앞에 끼워요
X.KEYH.unshift(code => {
  if (CINE){ if (/^(Escape|KeyE|Space|Enter|NumpadEnter)$/.test(code) && now() - CINE.t0 > 0.6) skipCine(); return true; }
  if (RT){ if (code === 'Escape') endRitual(false, true); return true; }
  const ae = document.activeElement; if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return false;
  if (readCur){ if (code === 'Escape' || code === 'KeyE'){ closeRead(); return true; } if (/^(KeyJ|KeyF|KeyK|KeyR|KeyQ|KeyN)$/.test(code)) return true; }
  if (cxOpen){ if (code === 'Escape' || code === 'KeyN'){ closeCodex(); X.sfx('ui'); return true; } if (/^(KeyJ|KeyF|KeyK|KeyR|KeyQ)$/.test(code)) return true; }
  if (code === 'KeyN' && !G.lock && !X.tpBusy && !document.body.classList.contains('shopping')){ openCodex(); return true; }
  return false;
});
BUS.on('quest', d => guard('quest ev', () => { needDirty = true; chapterEvents();
  if (d && d.state === 'done'){ const c = CH.find(x => x.last === d.id); if (c && !chRec(c.n).outro && chapterState(c.n) === 'after') pendOutro = c.n; } }));
BUS.on('enterField', d => { enterT = T; needDirty = true; if (!d || !d.warp) guard('apply', applyAllChanges); });
BUS.on('leaveField', () => guard('leave', () => { clrAllMk(); for (const id in SBS) dropSB(SBS[id], 0); if (RT) endRitual(false, true); if (readCur) closeRead(); if (CINE) cineEnd(); }));
BUS.on('death', () => guard('death', () => { for (const id in SBS) dropSB(SBS[id], 6); if (RT) endRitual(false, true); }));
BUS.on('hurt', () => { if (CINE) skipCine(); });   // 연출 중에 맞으면 바로 돌려줘요
BUS.on('fieldReady', () => guard('ready', () => { applyAllChanges(); buildResidentFigs(); needDirty = true; }));

// ───────────────────────── 매 프레임 ─────────────────────────
let tickT = 0, mkT = 0, needT = 0;
G.hooks.push((dt, rdt) => {
  guard('cine', updCine); guard('ritual', updRitual); guard('fx', () => updFx(rdt)); guard('windmill', () => updWindmill(rdt));
  if (saveT > 0 && (saveT -= rdt) <= 0) X.save();
  if ((cxOpen || readCur) && F.rpgWindowOpen && F.rpgWindowOpen()){ closeCodex(); if (readCur){ readRet = false; closeRead(); } }
  if (!F.inField) return;
  T += rdt; guard('fallback', () => updFallback(rdt));
  if ((tickT -= rdt) > 0) return; tickT = 0.25;
  needT -= 0.25; if (needDirty || needT <= 0){ needT = 2; guard('need', calcNeed); }
  guard('sboss', sbTick); guard('story', storyTick);
  if ((mkT -= 0.25) <= 0){ mkT = 1; guard('markers', updMarkers); }
  if (readCur && RD[readCur] && Math.hypot(pp.x - RD[readCur].o.c[0], pp.z - RD[readCur].o.c[1]) > 9 && !readRet) closeRead();
});

// ───────────────────────── 시작 ─────────────────────────
for (const c of CH) if (chapterState(c.n) === 'after'){ const r = chRec(c.n); if (!r.t) r.t = Date.now(); r.outro = true; }   // 이미 끝난 장은 연출을 다시 틀지 않아요
if (WM.has){ const c = CH.find(x => (x.c.change || []).includes('windmill_spin')); WM.cur = WM.tgt = c && chapterState(c.n) === 'after' ? 1 : 0; F.lmState.windmill = WM.cur; }
guard('apply', applyAllChanges); guard('need', calcNeed);
if (F.ready) guard('residents', buildResidentFigs);
F.saga = { chapterState, openCodex: tab => openCodex(tab), target, playIntro: n => playIntro(n, true), busy, afterQuest, state: SG, chapters: CH };
F.story = Object.assign(F.story || {}, { done: n => chapterState(n) === 'after' });
console.log(`[saga] 장 ${CH.length} · 읽을거리 ${Object.keys(RD).length} · 수호석 ${Object.keys(KS).length} · 줍기 ${Object.keys(PK).length} · 이야기 보스 ${Object.keys(SB).length} · 주민 ${Object.keys(RES).length} · 대신 세운 표식 ${FBK.length} · ${Math.round(performance.now() - T0)}ms`);
return { CH, RD, SP, KS, SB, RES, NEED, chapterState, playIntro, playOutro, openCodex, closeCodex, openRead, target, calcNeed, setChange, get cine(){ return CINE; }, get ritual(){ return RT; }, sbs: SBS, startRitual, pickUp };
}
