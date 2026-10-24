// 룬 아고라 — 스토리 모드 (월드맵 · 스테이지 로드맵 · 제 1 장 평화로운 숲 1-1 ~ 1-20)
// 전투(3연격 · 구르기 · 룬 마법) / 스탯(힘 · 체력 · 민첩 · 지능) / 난이도(이지 · 미디엄 · 하드) / 별 3개 / 저장
export function init(G){
const { THREE, $, M, FX, TAU, player } = G;
const V3 = THREE.Vector3;
const R = Math.random, rr = (a, b) => a + (b - a) * R(), clamp = (x, a, b) => Math.max(a, Math.min(b, x)), ease = t => t * t * (3 - 2 * t);
const pick = a => a[(R() * a.length) | 0];
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const fig = player.fig;
// 전투 레이어(SW)의 y 는 "지면 기준" 이에요. 필드에서는 지형 높이(GYF)를 렌더할 때 더해요.
let MODE = 'plaza';            // 'plaza' | 'stage' | 'field' | 'raid'
let GYF = null, CLAMP = null;  // 필드가 채워요: 지형 높이 함수 / 몬스터 이동 제한
const GY = (x, z) => MODE === 'field' && GYF ? GYF(x, z) : 0;
const PY = () => player.pos.y - GY(player.pos.x, player.pos.z);
const BONUS = { atk: 0, hp: 0, def: 0, crit: 0, mp: 0, spd: 0, aspd: 0, rune: 0, regen: 0 };   // 장비 · 버프 (agora-rpg.js)
const BUS = { h: {}, on(ev, fn){ (this.h[ev] = this.h[ev] || []).push(fn); }, off(ev, fn){ const a = this.h[ev]; if (a){ const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }, emit(ev, d){ for (const fn of (this.h[ev] || []).slice()) try { fn(d); } catch (e){ console.error('bus', ev, e); } } };
const KEYH = [];               // 모듈 키 처리기: code => true(처리함)

// ───────────────────────── 스타일 / DOM ─────────────────────────
const css = document.createElement('style');
css.textContent = `
  .lb { position:fixed; left:0; right:0; height:0; background:#000; z-index:24; transition:height .7s ease; pointer-events:none; }
  #lbT { top:0; } #lbB { bottom:0; }
  body.cine .lb { height:10vh; }
  body.cine #card, body.cine #map, body.cine #gfx, body.cine #back, body.cine #obj, body.cine #cbtns, body.cine #keys, body.cine #prompt, body.cine #joy, body.cine .tbtn, body.cine #hint { opacity:0 !important; pointer-events:none !important; }
  #card { cursor:pointer; transition:opacity .4s; }
  #card .bars i.xp { height:3px; } #card .bars i.xp b { background:linear-gradient(90deg,#b88cff,#ffe08a); }
  #card .pt { display:none; margin-left:6px; padding:0 6px; border-radius:8px; background:#ffd36a; color:#2a1a00; font:900 10px 'Noto Sans KR'; animation:ptb 1s infinite alternate; }
  #card.haspt .pt { display:inline-block; }
  @keyframes ptb { from { box-shadow:0 0 0 rgba(255,211,106,0); } to { box-shadow:0 0 12px rgba(255,211,106,.9); } }
  #dlg { position:fixed; left:50%; bottom:calc(11vh + env(safe-area-inset-bottom)); transform:translate(-50%, 10px); width:min(780px, 92vw); padding:18px 26px 22px; z-index:26;
    background:linear-gradient(180deg, rgba(14,18,30,.95), rgba(6,8,14,.95)); border:1px solid rgba(233,200,126,.55); border-radius:4px;
    box-shadow:0 0 0 4px rgba(10,14,24,.5), 0 14px 40px rgba(0,0,0,.6); opacity:0; pointer-events:none; transition:opacity .35s, transform .35s; cursor:pointer; }
  #dlg.on { opacity:1; transform:translate(-50%, 0); pointer-events:auto; }
  #dlg::before { content:''; position:absolute; left:18px; right:18px; top:-1px; height:1px; background:linear-gradient(90deg, transparent, #ffe9b0, transparent); }
  #dlg .who { display:inline-block; font:700 14px 'Gowun Batang'; letter-spacing:.25em; color:#10131c; background:linear-gradient(180deg,#fff2c9,#d9b05a); padding:4px 14px 4px 16px; margin:-32px 0 10px -6px; border-radius:2px; box-shadow:0 4px 14px rgba(0,0,0,.5); }
  #dlg .who.enemy { background:linear-gradient(180deg,#e9b8ff,#7a2ab8); color:#fff; }
  #dlg .txt { font:500 clamp(14px, 2.2vw, 17px)/1.75 'Noto Sans KR'; color:#f4efe3; min-height:3.5em; text-shadow:0 1px 2px #000; }
  #dlg .nx { position:absolute; right:16px; bottom:8px; font:700 11px 'Noto Sans KR'; color:rgba(233,200,126,.8); animation:nxb .9s infinite alternate; }
  @keyframes nxb { from { opacity:.3; transform:translateY(0); } to { opacity:1; transform:translateY(2px); } }
  #dlg .ch { display:flex; gap:10px; margin-top:12px; }
  #dlg .ch button { flex:1; font:700 14px 'Gowun Batang'; letter-spacing:.1em; padding:10px; color:#fff3d6; background:rgba(233,200,126,.12); border:1px solid rgba(233,200,126,.5); border-radius:3px; cursor:pointer; }
  #dlg .ch button:hover { background:rgba(233,200,126,.28); }
  #obj { position:absolute; top:calc(max(14px, env(safe-area-inset-top)) + var(--map) + 56px); right:14px; width:240px; text-align:right; pointer-events:none; opacity:0; transition:opacity .5s; }
  #obj.on { opacity:1; }
  #obj .t { font:700 10px 'Cinzel'; letter-spacing:.35em; color:#7ff3ff; text-shadow:0 0 8px rgba(127,243,255,.6); }
  #obj .q { font:700 15px 'Gowun Batang'; color:#fff3d6; margin-top:3px; text-shadow:0 1px 3px #000, 0 0 10px rgba(0,0,0,.6); }
  #obj .q::before { content:'◆ '; color:#ffd36a; }
  #obj .p { font:500 12px 'Noto Sans KR'; color:#bfe9ef; margin-top:2px; text-shadow:0 1px 2px #000; }
  #obj.flash .q { animation:objf .8s 2; }
  @keyframes objf { 50% { color:#ffd36a; text-shadow:0 0 14px rgba(255,211,106,.9); } }
  #hint { position:absolute; left:50%; bottom:calc(64px + env(safe-area-inset-bottom)); transform:translateX(-50%); padding:9px 18px; border-radius:22px; background:rgba(10,14,24,.78); border:1px solid rgba(127,243,255,.45); font:500 13px 'Noto Sans KR'; color:#eafcff; white-space:nowrap; opacity:0; transition:opacity .4s; }
  #hint.on { opacity:1; }
  #hint b { color:#ffd36a; border:1px solid rgba(233,200,126,.6); border-radius:4px; padding:0 5px; margin:0 2px; }
  #banner { position:fixed; left:0; right:0; top:26%; text-align:center; z-index:22; pointer-events:none; opacity:0; transition:opacity .5s; }
  #banner.on { opacity:1; }
  #banner .a { font:700 12px 'Cinzel'; letter-spacing:.6em; color:#7ff3ff; text-shadow:0 0 10px rgba(127,243,255,.7); }
  #banner .b { font:900 clamp(28px, 6vw, 54px) 'Gowun Batang'; letter-spacing:.12em; margin-top:4px; background:linear-gradient(180deg,#fff7df 10%,#e9c87e 60%,#a07a38); -webkit-background-clip:text; background-clip:text; color:transparent; filter:drop-shadow(0 3px 10px rgba(0,0,0,.8)); }
  #banner .c { font:500 14px 'Noto Sans KR'; color:#f0e6cf; margin-top:6px; text-shadow:0 1px 3px #000; }
  #banner.red .a { color:#ff7a9a; text-shadow:0 0 10px rgba(255,80,120,.8); }
  #banner.red .b { background:linear-gradient(180deg,#ffe0f0 10%,#d070ff 60%,#5a1a8a); -webkit-background-clip:text; background-clip:text; }
  #chap { position:fixed; inset:0; z-index:28; display:flex; flex-direction:column; align-items:center; justify-content:center; background:radial-gradient(ellipse at center, rgba(5,8,16,.55), rgba(0,0,0,.92)); opacity:0; pointer-events:none; transition:opacity 1s; }
  #chap.on { opacity:1; }
  #chap .a { font:700 14px 'Cinzel'; letter-spacing:.8em; color:#e9c87e; }
  #chap .b { font:900 clamp(34px, 8vw, 78px) 'Gowun Batang'; letter-spacing:.15em; color:#fff6dc; margin:12px 0 8px; text-shadow:0 0 30px rgba(233,200,126,.45), 0 4px 20px #000; }
  #chap .l { width:min(380px,60vw); height:1px; background:linear-gradient(90deg,transparent,#e9c87e,transparent); }
  #chap .c { font:400 14px 'Gowun Batang'; color:#cfe9ee; letter-spacing:.3em; margin-top:14px; }
  #chap .r { margin-top:22px; font:500 14px/2 'Noto Sans KR'; color:#fff3d6; text-align:center; }
  #chap .r em { font-style:normal; color:#ffd36a; font-weight:900; }
  #chap button { margin-top:26px; pointer-events:auto; font:700 15px 'Gowun Batang'; letter-spacing:.3em; color:#10131c; padding:12px 38px; border:none; border-radius:2px; cursor:pointer; background:linear-gradient(180deg,#fff2c9,#e2b964 60%,#b88c3e); box-shadow:0 0 30px rgba(233,200,126,.35); }
  #statw { position:fixed; left:50%; top:50%; transform:translate(-50%,-48%) scale(.97); width:min(420px, 92vw); z-index:27; padding:18px 20px 16px;
    background:linear-gradient(180deg, rgba(16,20,34,.97), rgba(7,9,16,.97)); border:1px solid rgba(233,200,126,.55); border-radius:6px; box-shadow:0 0 0 4px rgba(10,14,24,.5), 0 20px 60px rgba(0,0,0,.7); opacity:0; pointer-events:none; transition:opacity .25s, transform .25s; max-height:94vh; overflow:auto; }
  @media (max-height:520px){ #statw { padding:10px 14px; } #statw .lvr { margin:6px 0 2px; } #statw .row { padding:4px 6px; } #statw .row .ic, #statw .row button { width:28px; height:28px; } #statw .row .ds { display:none; } #statw .der { margin-top:6px; padding-top:6px; } }
  #statw.on { opacity:1; pointer-events:auto; transform:translate(-50%,-50%) scale(1); }
  #statw .hd { display:flex; align-items:baseline; gap:10px; border-bottom:1px solid rgba(233,200,126,.25); padding-bottom:10px; }
  #statw .hd span { font:700 11px 'Cinzel'; letter-spacing:.4em; color:#7ff3ff; }
  #statw .hd b { font:700 18px 'Gowun Batang'; color:#fff3d6; flex:1; }
  #statw .hd button { background:none; border:none; color:#e9c87e; font-size:20px; cursor:pointer; }
  #statw .lvr { display:flex; align-items:center; gap:10px; margin:12px 0 6px; }
  #statw .lvr .lv { font:900 26px 'Cinzel'; color:#ffe9b0; }
  #statw .lvr .xb { flex:1; height:6px; background:rgba(255,255,255,.1); border-radius:3px; overflow:hidden; }
  #statw .lvr .xb i { display:block; height:100%; background:linear-gradient(90deg,#b88cff,#ffe08a); }
  #statw .lvr .xt { font:500 11px 'Noto Sans KR'; color:#c8bfe8; }
  #statw .pts { font:500 13px 'Noto Sans KR'; color:#e8e1cf; margin-bottom:8px; }
  #statw .pts em { font-style:normal; font:900 18px 'Cinzel'; color:#ffd36a; margin-left:4px; }
  #statw .row { display:grid; grid-template-columns:34px 1fr 46px 40px; align-items:center; gap:8px; padding:9px 6px; border-radius:4px; }
  #statw .row:nth-child(odd) { background:rgba(255,255,255,.03); }
  #statw .row .ic { width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:16px; border:1px solid rgba(233,200,126,.4); background:radial-gradient(circle at 50% 35%, rgba(255,255,255,.12), rgba(0,0,0,.2)); }
  #statw .row .nm { font:700 15px 'Gowun Batang'; color:#fff3d6; } #statw .row .nm small { font:700 10px 'Cinzel'; color:#9fb6c0; margin-left:4px; letter-spacing:.15em; }
  #statw .row .ds { font:400 11px 'Noto Sans KR'; color:#9fb6c0; margin-top:1px; }
  #statw .row .v { font:900 20px 'Cinzel'; color:#fff; text-align:center; }
  #statw .row button { width:36px; height:36px; border-radius:50%; border:1px solid rgba(255,211,106,.8); background:radial-gradient(circle at 50% 35%, #fff2c9, #d9a43c); color:#2a1a00; font:900 20px 'Noto Sans KR'; cursor:pointer; box-shadow:0 0 10px rgba(255,211,106,.5); }
  #statw .row button:disabled { opacity:.2; box-shadow:none; cursor:default; }
  #statw .der { display:grid; grid-template-columns:1fr 1fr; gap:4px 14px; margin-top:12px; padding-top:12px; border-top:1px solid rgba(233,200,126,.2); font:500 12px 'Noto Sans KR'; color:#c9d6da; }
  #statw .der b { float:right; color:#fff; font-weight:700; }
  #boss { position:absolute; top:calc(max(14px, env(safe-area-inset-top)) + 8px); left:50%; transform:translateX(-50%); width:min(520px, 56vw); text-align:center; opacity:0; transition:opacity .6s; }
  #boss.on { opacity:1; }
  #boss .n { font:700 14px 'Gowun Batang'; letter-spacing:.3em; color:#f0d6ff; text-shadow:0 0 10px rgba(180,80,255,.8), 0 1px 2px #000; }
  #boss .bar { height:12px; margin-top:6px; border:1px solid rgba(220,160,255,.6); background:rgba(0,0,0,.6); border-radius:2px; overflow:hidden; position:relative; box-shadow:0 0 14px rgba(160,60,255,.4); }
  #boss .bar i { position:absolute; inset:0; width:100%; background:linear-gradient(90deg,#5a1a9a,#c050ff); transition:width .15s; }
  #boss .bar s { position:absolute; inset:0; width:100%; background:rgba(255,255,255,.5); transition:width .8s .25s; }
  @media (max-width:560px){ #boss { top:calc(max(14px, env(safe-area-inset-top)) + 120px); width:86vw; } }
  #ehp { position:fixed; inset:0; pointer-events:none; z-index:9; }
  #ehp .e { position:absolute; width:54px; height:5px; transform:translate(-50%,-50%); background:rgba(0,0,0,.65); border:1px solid rgba(0,0,0,.9); border-radius:2px; overflow:hidden; }
  #ehp .e i { display:block; height:100%; background:linear-gradient(#e070ff,#7a20c0); }
  #ehp .d { position:absolute; transform:translate(-50%,-50%); font:900 20px 'Noto Sans KR'; color:#fff; text-shadow:0 2px 0 rgba(0,0,0,.7), 0 0 6px rgba(0,0,0,.6); white-space:nowrap; animation:dmg .9s ease-out forwards; }
  #ehp .d.crit { color:#ffd36a; font-size:28px; animation:dmgc 1s ease-out forwards; }
  #ehp .d.me { color:#ff5a5a; } #ehp .d.heal { color:#7fffa8; } #ehp .d.xp { color:#d6b8ff; font-size:14px; }
  @keyframes dmg { 0% { opacity:0; transform:translate(-50%,-30%) scale(.6); } 15% { opacity:1; transform:translate(-50%,-70%) scale(1.15); } 100% { opacity:0; transform:translate(-50%,-240%) scale(.9); } }
  @keyframes dmgc { 0% { opacity:0; transform:translate(-50%,-30%) scale(.4) rotate(-8deg); } 18% { opacity:1; transform:translate(-50%,-80%) scale(1.35) rotate(3deg); } 100% { opacity:0; transform:translate(-50%,-250%) scale(1); } }
  #hurt { position:fixed; inset:0; pointer-events:none; z-index:8; background:radial-gradient(ellipse at center, transparent 50%, rgba(200,0,30,.55) 100%); opacity:0; transition:opacity .4s; }
  #dead { position:fixed; inset:0; z-index:29; display:flex; flex-direction:column; align-items:center; justify-content:center; background:radial-gradient(ellipse at center, rgba(40,0,20,.6), rgba(0,0,0,.92)); opacity:0; pointer-events:none; transition:opacity 1.2s; }
  #dead.on { opacity:1; pointer-events:auto; }
  #dead .b { font:900 clamp(30px,7vw,60px) 'Gowun Batang'; letter-spacing:.25em; color:#e8c0c8; text-shadow:0 0 24px rgba(200,40,80,.6); }
  #dead .c { font:400 14px 'Noto Sans KR'; color:#c8b0b8; margin-top:10px; }
  #dead button { margin-top:26px; font:700 15px 'Gowun Batang'; letter-spacing:.3em; color:#10131c; padding:12px 34px; border:none; border-radius:2px; cursor:pointer; background:linear-gradient(180deg,#fff2c9,#e2b964 60%,#b88c3e); }
  #skbar { position:absolute; left:50%; bottom:44px; transform:translateX(-50%); display:none; gap:8px; pointer-events:auto; z-index:6; }
  body.combat.hasjob[data-area="story"] #skbar, body.combat.hasjob[data-area="field"] #skbar { display:flex; }
  body.cine #skbar, body.cine #combo { opacity:0 !important; pointer-events:none !important; }
  #skbar .sk { position:relative; width:56px; height:56px; border-radius:10px; background:radial-gradient(circle at 50% 30%, rgba(70,82,110,.88), rgba(10,14,24,.92)); border:2px solid rgba(233,200,126,.55); display:flex; align-items:center; justify-content:center; overflow:hidden; cursor:pointer; box-shadow:0 4px 14px rgba(0,0,0,.5); user-select:none; -webkit-user-select:none; }
  #skbar .sk .ic { font-size:27px; line-height:1; }
  #skbar .sk .ky { position:absolute; left:5px; top:2px; font:900 11px 'Cinzel'; color:#ffe9b0; text-shadow:0 1px 2px #000; z-index:2; }
  #skbar .sk .cd { position:absolute; left:0; right:0; bottom:0; height:0; background:rgba(0,0,0,.68); }
  #skbar .sk .t { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font:900 18px 'Noto Sans KR'; color:#fff; font-style:normal; text-shadow:0 1px 3px #000; }
  #skbar .sk .mp { position:absolute; right:4px; bottom:2px; font:700 10px 'Noto Sans KR'; color:#8ad0ff; text-shadow:0 1px 2px #000; }
  #skbar .sk.ult { border-color:#ffd36a; }
  #skbar .sk.rdy.ult { animation:ultp 1.4s infinite; }
  #skbar .sk.lock { opacity:.4; }
  #skbar .sk.dis .ic { filter:grayscale(1) brightness(.55); }
  @keyframes ultp { 50% { box-shadow:0 0 22px rgba(255,211,106,.95), inset 0 0 12px rgba(255,211,106,.5); } }
  body.touch #skbar { left:auto; right:0; bottom:0; transform:none; width:0; height:0; }
  body.touch #skbar .sk { position:absolute; width:52px; height:52px; border-radius:50%; }
  body.touch #skbar .sk .ky { display:none; }
  body.touch #cS1 { right:192px; bottom:calc(88px + env(safe-area-inset-bottom)); } body.touch #cS2 { right:170px; bottom:calc(156px + env(safe-area-inset-bottom)); }
  body.touch #cS3 { right:108px; bottom:calc(200px + env(safe-area-inset-bottom)); } body.touch #cS4 { right:34px; bottom:calc(204px + env(safe-area-inset-bottom)); }
  #combo { position:absolute; right:24px; top:42%; text-align:right; opacity:0; transition:opacity .4s; pointer-events:none; }
  #combo.on { opacity:1; }
  #combo b { display:inline-block; font:900 46px 'Cinzel'; color:#fff0c8; text-shadow:0 0 14px rgba(255,140,40,.9), 0 3px 0 #000; }
  #combo span { font:700 14px 'Cinzel'; color:#ffb070; letter-spacing:.3em; margin-left:4px; text-shadow:0 1px 3px #000; }
  #combo.pop b { animation:cpop .22s ease-out; }
  @keyframes cpop { from { transform:scale(1.6); } }
  body.touch #combo { top:28%; right:16px; } body.touch #combo b { font-size:34px; }
  #lowhp { position:fixed; inset:0; pointer-events:none; z-index:8; background:radial-gradient(ellipse at center, transparent 42%, rgba(170,0,20,.65) 100%); opacity:0; transition:opacity .5s; }
  #lowhp.on { animation:lowp .85s infinite; }
  @keyframes lowp { 0%,100% { opacity:.25; } 14% { opacity:.9; } 30% { opacity:.4; } 45% { opacity:.75; } }
  #ehp .e.elite { width:72px; height:6px; overflow:visible; border-color:#ff3a7a; box-shadow:0 0 8px rgba(255,40,120,.75); }
  #ehp .e.elite i { background:linear-gradient(#ff6a9a,#9a0838); }
  #ehp .e.elite u { position:absolute; left:50%; bottom:8px; transform:translateX(-50%); font:900 11px 'Noto Sans KR'; color:#ffa0c8; text-decoration:none; white-space:nowrap; text-shadow:0 1px 2px #000, 0 0 6px rgba(255,40,120,.8); }
  #ehp .d.dot { font-size:14px; color:#c8ff9a; }
  #ehp .d.aggro { font-size:26px; color:#ff4a3a; text-shadow:0 2px 0 #000, 0 0 10px rgba(255,60,40,.8); }
  #ehp .e.named { overflow:visible; } #ehp .e.named u.lv { position:absolute; left:50%; bottom:8px; transform:translateX(-50%); font:700 11px 'Noto Sans KR'; text-decoration:none; white-space:nowrap; text-shadow:0 1px 2px #000, 0 0 4px #000; }
  #ehp .e.fboss { width:96px; height:7px; border-color:#ffb03a; box-shadow:0 0 10px rgba(255,160,40,.8); } #ehp .e.fboss i { background:linear-gradient(#ffd36a,#c8501a); } #ehp .e.fboss u.lv { color:#ffd36a !important; font-size:12px; }
  #fdead { position:fixed; inset:0; z-index:29; display:flex; flex-direction:column; align-items:center; justify-content:center; background:radial-gradient(ellipse at center, rgba(40,0,20,.55), rgba(0,0,0,.9)); opacity:0; pointer-events:none; transition:opacity 1s; }
  #fdead.on { opacity:1; pointer-events:auto; } #fdead .b { font:900 clamp(30px,7vw,56px) 'Gowun Batang'; letter-spacing:.25em; color:#e8c0c8; text-shadow:0 0 24px rgba(200,40,80,.6); }
  #fdead .c { font:400 14px 'Noto Sans KR'; color:#c8b0b8; margin-top:10px; text-align:center; line-height:1.7; }
  #fdead button { margin-top:24px; font:700 15px 'Gowun Batang'; letter-spacing:.2em; color:#10131c; padding:12px 30px; border:none; border-radius:2px; cursor:pointer; background:linear-gradient(180deg,#fff2c9,#e2b964 60%,#b88c3e); }
  #jobw { position:fixed; left:50%; top:50%; transform:translate(-50%,-48%) scale(.97); width:min(560px, 94vw); z-index:27; padding:18px 20px 16px;
    background:linear-gradient(180deg, rgba(16,20,34,.97), rgba(7,9,16,.97)); border:1px solid rgba(233,200,126,.55); border-radius:6px; box-shadow:0 0 0 4px rgba(10,14,24,.5), 0 20px 60px rgba(0,0,0,.7); opacity:0; pointer-events:none; transition:opacity .25s, transform .25s; max-height:92vh; overflow:auto; color:#e8e1cf; }
  #jobw.on { opacity:1; pointer-events:auto; transform:translate(-50%,-50%) scale(1); }
  #jobw .hd { display:flex; align-items:baseline; gap:10px; border-bottom:1px solid rgba(233,200,126,.25); padding-bottom:10px; margin-bottom:12px; }
  #jobw .hd span { font:700 11px 'Cinzel'; letter-spacing:.4em; color:#7ff3ff; }
  #jobw .hd b { font:700 20px 'Gowun Batang'; color:#fff3d6; } #jobw .hd small { font:700 11px 'Cinzel'; letter-spacing:.2em; flex:1; }
  #jobw .hd button { background:none; border:none; color:#e9c87e; font-size:20px; cursor:pointer; margin-left:auto; }
  #jobw .lockm, #jobw .pickm { text-align:center; font:400 14px 'Noto Sans KR'; color:#c9d6da; padding:22px 8px; line-height:1.8; } #jobw .lockm { font-size:15px; }
  #jobw .jgrid { display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; }
  @media (max-width:520px){ #jobw .jgrid { grid-template-columns:repeat(2, 1fr); } }
  #jobw .jc { --c:#fff; padding:12px 4px 10px; border-radius:6px; cursor:pointer; background:radial-gradient(circle at 50% 20%, rgba(255,255,255,.08), rgba(0,0,0,.25)); border:1px solid rgba(255,255,255,.12); color:#fff; transition:transform .15s, border-color .15s, box-shadow .15s; }
  #jobw .jc:hover { transform:translateY(-2px); }
  #jobw .jc.on { border-color:var(--c); box-shadow:0 0 16px color-mix(in srgb, var(--c) 55%, transparent), inset 0 0 18px color-mix(in srgb, var(--c) 25%, transparent); }
  #jobw .jc.cur::after { content:'현재'; display:block; font:700 10px 'Noto Sans KR'; color:var(--c); margin-top:4px; }
  #jobw .ji { font-size:30px; } #jobw .jn { font:700 16px 'Gowun Batang'; margin-top:4px; } #jobw .je { font:700 9px 'Cinzel'; letter-spacing:.2em; color:var(--c); } #jobw .jr { font:400 11px 'Noto Sans KR'; color:#9fb6c0; margin-top:3px; }
  #jobw .jd { --c:#fff; margin-top:12px; }
  #jobw .jdesc { font:400 13px 'Noto Sans KR'; color:#dfe8ea; line-height:1.6; padding:10px 12px; border-left:3px solid var(--c); background:rgba(255,255,255,.03); }
  #jobw .sec { font:700 13px 'Gowun Batang'; color:#ffe9b0; margin:14px 0 6px; } #jobw .sec small { font:400 11px 'Noto Sans KR'; color:#9fb6c0; margin-left:6px; } #jobw .sec b { color:var(--c); }
  #jobw .adesc { font:400 12px 'Noto Sans KR'; color:#c9d6da; margin-bottom:6px; }
  #jobw .sr { display:grid; grid-template-columns:42px 1fr 52px; gap:10px; align-items:center; padding:8px; border-radius:5px; background:rgba(255,255,255,.035); margin-bottom:5px; }
  #jobw .sr.ul { background:linear-gradient(90deg, rgba(255,211,106,.12), rgba(255,255,255,.03)); }
  #jobw .sr.lk { opacity:.5; }
  #jobw .si { width:42px; height:42px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:22px; border:1px solid color-mix(in srgb, var(--c) 60%, transparent); background:rgba(0,0,0,.3); }
  #jobw .sn { font:700 14px 'Gowun Batang'; color:#fff3d6; } #jobw .sn em { font:900 9px 'Cinzel'; font-style:normal; color:#2a1a00; background:#ffd36a; border-radius:3px; padding:1px 4px; margin-left:6px; vertical-align:2px; } #jobw .sn em.a { background:var(--c); }
  #jobw .sd { font:400 11.5px 'Noto Sans KR'; color:#a9bcc4; margin-top:2px; line-height:1.45; }
  #jobw .sc { font:500 11px 'Noto Sans KR'; color:#c9d6da; text-align:right; line-height:1.6; }
  #jobw .go, #jobw .asb { display:block; width:100%; margin-top:14px; font:700 15px 'Gowun Batang'; letter-spacing:.15em; color:#10131c; padding:12px; border:none; border-radius:3px; cursor:pointer; background:linear-gradient(180deg,#fff2c9,#e2b964 60%,#b88c3e); }
  #jobw .go:disabled, #jobw .asb:disabled { opacity:.35; cursor:default; }
  #jobw .back, #jobw .chg { display:block; margin:10px auto 0; background:none; border:none; color:#9fb6c0; font:400 12px 'Noto Sans KR'; cursor:pointer; text-decoration:underline; }
  #jobw .asc { margin-top:14px; padding:12px; border-radius:6px; border:1px dashed rgba(233,200,126,.4); }
  #jobw .asc.rdy { border-style:solid; border-color:#ffd36a; box-shadow:0 0 18px rgba(255,211,106,.35); }
  #jobw .asc .at { font:700 16px 'Gowun Batang'; color:#ffe9b0; } #jobw .asc .at small { font:700 10px 'Cinzel'; letter-spacing:.2em; color:var(--c); }
  #jobw .req { display:flex; flex-direction:column; gap:3px; font:500 12px 'Noto Sans KR'; color:#ff9a9a; margin-top:6px; } #jobw .req .ok { color:#9aff9a; }
  #jobw .ascd { margin-top:14px; text-align:center; font:700 15px 'Gowun Batang'; color:#ffe9b0; padding:12px; border-radius:6px; background:linear-gradient(90deg, transparent, rgba(255,211,106,.14), transparent); } #jobw .ascd small { font:400 12px 'Noto Sans KR'; color:#c9d6da; }
  #shop { position:fixed; right:16px; top:50%; transform:translate(20px,-50%); width:min(410px, 46vw); max-height:92vh; z-index:27; display:flex; flex-direction:column; padding:14px 14px 10px;
    background:linear-gradient(180deg, rgba(16,20,34,.95), rgba(7,9,16,.96)); border:1px solid rgba(233,200,126,.55); border-radius:8px; box-shadow:0 0 0 4px rgba(10,14,24,.45), 0 20px 60px rgba(0,0,0,.7); opacity:0; pointer-events:none; transition:opacity .25s, transform .25s; color:#e8e1cf; }
  #shop.on { opacity:1; pointer-events:auto; transform:translate(0,-50%); }
  @media (max-width:760px){ #shop { left:0; right:0; top:auto; bottom:0; width:auto; max-height:56vh; transform:translateY(30px); border-radius:14px 14px 0 0; padding:10px 10px 6px; } #shop.on { transform:none; } }
  body.shopping #card, body.shopping #map, body.shopping #gfx, body.shopping #back, body.shopping #obj, body.shopping #cbtns, body.shopping #keys, body.shopping #prompt, body.shopping #joy, body.shopping .tbtn, body.shopping #hint, body.shopping #modes, body.shopping #skbar, body.shopping #bReturn, body.shopping #combo { opacity:0 !important; pointer-events:none !important; }
  #shop .hd { display:flex; align-items:center; gap:10px; padding-bottom:8px; border-bottom:1px solid rgba(233,200,126,.25); }
  #shop .hd span { font:700 10px 'Cinzel'; letter-spacing:.4em; color:#7ff3ff; } #shop .hd > b { font:700 19px 'Gowun Batang'; color:#fff3d6; flex:1; }
  #shop .gold { font:700 14px 'Noto Sans KR'; color:#ffe9b0; padding:4px 12px; border-radius:14px; background:rgba(255,211,106,.12); border:1px solid rgba(255,211,106,.4); } #shop .gold b { font:900 15px 'Cinzel'; }
  #shop .hd button { background:none; border:none; color:#e9c87e; font-size:20px; cursor:pointer; }
  #shop .tabs { display:flex; gap:4px; margin:10px 0 8px; }
  #shop .tabs button { flex:1; padding:7px 2px 6px; border-radius:6px; cursor:pointer; font-size:18px; color:#cfd8dc; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); display:flex; flex-direction:column; align-items:center; gap:1px; }
  #shop .tabs button span { font:700 11px 'Noto Sans KR'; } #shop .tabs button.on { background:rgba(233,200,126,.16); border-color:rgba(233,200,126,.7); color:#fff3d6; }
  #shop .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:7px; overflow:auto; padding:2px; min-height:120px; }
  @media (max-width:760px){ #shop .grid { grid-template-columns:repeat(4, 1fr); } #shop .tabs button { font-size:15px; padding:5px 1px; } #shop .it .ic { font-size:22px !important; } #shop .it .nm { font-size:10.5px !important; } }
  #shop .it { position:relative; padding:9px 4px 7px; border-radius:7px; cursor:pointer; color:#fff; background:radial-gradient(circle at 50% 20%, rgba(255,255,255,.08), rgba(0,0,0,.3)); border:1px solid rgba(255,255,255,.1); transition:transform .12s, box-shadow .12s; }
  #shop .it:hover { transform:translateY(-2px); }
  #shop .it.r1 { border-color:rgba(90,184,255,.5); } #shop .it.r2 { border-color:rgba(192,122,255,.6); background:radial-gradient(circle at 50% 20%, rgba(192,122,255,.16), rgba(0,0,0,.3)); }
  #shop .it.r3 { border-color:rgba(255,176,58,.85); background:radial-gradient(circle at 50% 20%, rgba(255,176,58,.2), rgba(0,0,0,.3)); animation:leg 2.4s infinite; }
  @keyframes leg { 50% { box-shadow:0 0 14px rgba(255,176,58,.55), inset 0 0 10px rgba(255,176,58,.25); } }
  #shop .it.sel { outline:2px solid #fff3d6; outline-offset:1px; } #shop .it.wear::after { content:'✔'; position:absolute; top:4px; right:6px; font:900 12px 'Noto Sans KR'; color:#7fffa8; }
  #shop .it .ic { font-size:26px; line-height:1.1; } #shop .it .nm { font:700 11.5px 'Gowun Batang'; margin-top:4px; line-height:1.25; min-height:2.5em; display:flex; align-items:center; justify-content:center; }
  #shop .it .rr { font:700 9.5px 'Noto Sans KR'; } #shop .it .pr i { font:700 11px 'Noto Sans KR'; font-style:normal; color:#ffe9b0; } #shop .it .pr i.eq { color:#7fffa8; } #shop .it .pr i.ow { color:#9fb6c0; }
  #shop .act { margin-top:8px; padding-top:8px; border-top:1px solid rgba(233,200,126,.2); }
  #shop .sela { display:flex; gap:10px; align-items:center; } #shop .sela .si { font-size:30px; width:46px; height:46px; display:flex; align-items:center; justify-content:center; border-radius:8px; background:rgba(0,0,0,.3); }
  #shop .sela .sn { font:700 16px 'Gowun Batang'; color:#fff3d6; } #shop .sela .sr { font:700 12px 'Noto Sans KR'; }
  #shop .buy { display:block; width:100%; margin-top:8px; font:700 15px 'Gowun Batang'; letter-spacing:.08em; color:#10131c; padding:11px; border:none; border-radius:4px; cursor:pointer; background:linear-gradient(180deg,#fff2c9,#e2b964 60%,#b88c3e); }
  #shop .buy.on { background:linear-gradient(180deg,#c8fff0,#5ad8b8); } #shop .buy.off { background:linear-gradient(180deg,#e8e8f0,#9aa0b0); } #shop .buy:disabled { opacity:.45; cursor:default; }
  #shop .hintm { text-align:center; font:400 12px 'Noto Sans KR'; color:#9fb6c0; padding:8px; }
  #shop .ft { display:flex; align-items:center; gap:6px; margin-top:8px; } #shop .ft small { flex:1; text-align:right; font:400 10.5px 'Noto Sans KR'; color:#7f939b; }
  #shop .rot { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.15); color:#e8e1cf; border-radius:14px; padding:4px 10px; font:700 12px 'Noto Sans KR'; cursor:pointer; } #shop .rot.on { border-color:#7ff3ff; color:#7ff3ff; }
  @media (max-width:760px){ #shop .ft small { display:none; } }
  #cbtns { position:absolute; inset:0; pointer-events:none; display:none; }
  body.touch.combat #cbtns { display:block; }
  #cbtns .cb { position:absolute; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:auto; font:700 12px 'Gowun Batang'; color:#fff4d8; background:radial-gradient(circle at 50% 35%, rgba(70,82,110,.8), rgba(10,14,24,.8)); border:2px solid rgba(233,200,126,.6); box-shadow:0 0 14px rgba(0,0,0,.5); overflow:hidden; }
  #cbtns .cb span { font-size:22px; line-height:1; }
  #cbtns .cb.dis { opacity:.35; }
  #cbtns .cb i { position:absolute; left:0; right:0; bottom:0; background:rgba(0,0,0,.55); }
  #cAtk { right:22px; bottom:calc(26px + env(safe-area-inset-bottom)); width:86px; height:86px; border-color:#ffd36a !important; }
  #cRoll { right:120px; bottom:calc(18px + env(safe-area-inset-bottom)); width:60px; height:60px; }
  #cRune { right:34px; bottom:calc(128px + env(safe-area-inset-bottom)); width:62px; height:62px; border-color:#7ff3ff !important; }
  body.touch.combat #bJump { right:118px; bottom:calc(98px + env(safe-area-inset-bottom)); width:56px; height:56px; }
  body.touch.combat #bRun { right:190px; bottom:calc(18px + env(safe-area-inset-bottom)); }
  body[data-area="plaza"] #obj, body[data-area="plaza"] #cbtns, body[data-area="plaza"] #boss { display:none !important; }
  body[data-area="story"] #modes, body[data-area="story"] #back, body[data-area="field"] #modes, body[data-area="field"] #back { display:none !important; }
  body:not([data-area="story"]):not([data-area="field"]) #bReturn { display:none !important; }
  body[data-area="field"] #obj { top:auto; }
  #modes { position:absolute; right:14px; top:calc(max(14px, env(safe-area-inset-top)) + var(--map) + 58px); display:flex; flex-direction:column; gap:8px; pointer-events:auto; align-items:flex-end; }
  #modes button { display:flex; align-items:center; gap:8px; font:700 14px 'Gowun Batang'; letter-spacing:.08em; color:#fff3d6; padding:10px 16px 10px 12px; border-radius:24px; cursor:pointer;
    background:linear-gradient(90deg, rgba(10,14,24,.4), rgba(10,14,24,.85)); border:1px solid rgba(233,200,126,.45); box-shadow:0 6px 18px rgba(0,0,0,.4); transition:transform .15s, box-shadow .15s; }
  #modes button:hover { transform:translateX(-3px); box-shadow:0 6px 22px rgba(0,0,0,.5), 0 0 18px rgba(233,200,126,.3); }
  #modes button span { width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:15px; background:radial-gradient(circle at 50% 35%, #fff2c9, #c8963c); color:#2a1a00; box-shadow:0 0 10px rgba(255,211,106,.5); }
  #modes button.story { border-color:rgba(127,243,255,.7); box-shadow:0 0 18px rgba(127,243,255,.25), 0 6px 18px rgba(0,0,0,.4); animation:mglow 2.2s infinite alternate; }
  #modes button.story span { background:radial-gradient(circle at 50% 35%, #eaffff, #3fb8d8); }
  @keyframes mglow { to { box-shadow:0 0 26px rgba(127,243,255,.5), 0 6px 18px rgba(0,0,0,.4); } }
  #modes button.soon { opacity:.55; }
  #modes button.soon::after { content:'준비 중'; font:500 10px 'Noto Sans KR'; color:#bbb; margin-left:2px; }
  #bReturn { position:absolute; left:14px; top:calc(max(14px, env(safe-area-inset-top)) + 64px); pointer-events:auto; font:700 13px 'Gowun Batang'; color:#eafcff; background:rgba(10,14,24,.7); border:1px solid rgba(127,243,255,.5); border-radius:20px; padding:7px 14px; cursor:pointer; }
  #tp { position:fixed; inset:0; z-index:40; pointer-events:none; opacity:0; transition:opacity .55s; background:radial-gradient(circle at 50% 50%, rgba(220,255,255,.95), rgba(60,180,220,.6) 30%, rgba(5,10,20,.98) 70%); display:flex; align-items:center; justify-content:center; flex-direction:column; }
  #tp.on { opacity:1; pointer-events:auto; }
  #tp .r { width:min(60vw,320px); height:min(60vw,320px); border-radius:50%; border:2px solid rgba(255,255,255,.85); box-shadow:0 0 40px #7ff3ff, inset 0 0 40px #7ff3ff; position:relative; animation:spin 2.4s linear infinite; }
  #tp .r::before, #tp .r::after { content:''; position:absolute; inset:14%; border:1px solid rgba(255,255,255,.8); transform:rotate(45deg); }
  #tp .r::after { inset:26%; border-radius:50%; border-width:2px; }
  #tp .n { margin-top:22px; font:900 clamp(22px,5vw,36px) 'Gowun Batang'; letter-spacing:.3em; color:#fff; text-shadow:0 0 20px #7ff3ff, 0 2px 10px #000; }
  #tp .a { font:700 11px 'Cinzel'; letter-spacing:.6em; color:#eaffff; margin-top:6px; }
  @keyframes spin { to { transform:rotate(360deg); } }
  #wmap { position:fixed; inset:0; z-index:30; display:none; flex-direction:column; background:#1d140c; }
  #wmap.on { display:flex; animation:wmin .35s ease-out; }
  @keyframes wmin { from { opacity:0; transform:scale(1.03); } to { opacity:1; transform:none; } }
  #wmap .wtop { flex:0 0 auto; display:flex; align-items:center; gap:10px; padding:calc(8px + env(safe-area-inset-top)) 12px 8px; background:linear-gradient(180deg,#3a2614,#24170c); border-bottom:2px solid #8a6a3a; box-shadow:0 4px 14px rgba(0,0,0,.5); z-index:2; flex-wrap:wrap; }
  #wmap .wtop .bk { font:700 13px 'Gowun Batang'; color:#fff3d6; background:rgba(0,0,0,.3); border:1px solid #c9a056; border-radius:18px; padding:6px 12px; cursor:pointer; }
  #wmap .wtop .tt { font:900 17px 'Gowun Batang'; color:#ffe9b0; letter-spacing:.08em; text-shadow:0 2px 4px #000; flex:1; min-width:120px; }
  #wmap .tabs { display:flex; gap:6px; }
  #wmap .tabs button { font:900 13px 'Noto Sans KR'; padding:6px 14px; border-radius:10px; cursor:pointer; color:#fff; border:2px solid rgba(255,255,255,.3); opacity:.6; transition:opacity .15s, transform .15s; }
  #wmap .tabs button.on { opacity:1; transform:translateY(-1px); box-shadow:0 0 12px rgba(255,255,255,.35); border-color:#fff; }
  #wmap .tabs .e { background:linear-gradient(#78c050,#3f7a26); } #wmap .tabs .m { background:linear-gradient(#a070e0,#5a2aa0); } #wmap .tabs .h { background:linear-gradient(#ff7a6a,#b0281e); }
  #wmap .res { display:flex; gap:8px; font:700 13px 'Noto Sans KR'; color:#fff3d6; }
  #wmap .res span { background:rgba(0,0,0,.35); border:1px solid rgba(201,160,86,.6); border-radius:14px; padding:4px 10px; white-space:nowrap; }
  #wmap .x { font-size:20px; width:36px; height:36px; border-radius:50%; border:2px solid #fff; background:linear-gradient(#5ab0f0,#2a6ab8); color:#fff; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,.5); }
  #wmap .wv { flex:1; position:relative; overflow:auto; -webkit-overflow-scrolling:touch; }
  #wmap .wv canvas { position:absolute; left:0; top:0; width:100%; height:100%; display:block; }
  #wmap .chv { position:absolute; inset:0; min-width:720px; min-height:420px; }
  #wmap .isl { position:absolute; transform:translate(-50%,-50%); cursor:pointer; text-align:center; filter:drop-shadow(0 4px 6px rgba(0,0,0,.5)); transition:transform .15s; }
  #wmap .isl:hover { transform:translate(-50%,-50%) scale(1.05); }
  #wmap .isl .rb { font:900 15px 'Gowun Batang'; color:#4a2a08; padding:6px 22px; background:linear-gradient(#ffe59a,#e8b84a); border:2px solid #8a5a18; border-radius:3px; position:relative; white-space:nowrap; }
  #wmap .isl .rb::before, #wmap .isl .rb::after { content:''; position:absolute; top:6px; width:14px; height:100%; background:#c8902e; z-index:-1; }
  #wmap .isl .rb::before { left:-10px; clip-path:polygon(0 0,100% 0,100% 100%,0 100%,40% 50%); } #wmap .isl .rb::after { right:-10px; clip-path:polygon(0 0,100% 0,60% 50%,100% 100%,0 100%); }
  #wmap .isl .pc { margin-top:6px; display:inline-grid; grid-template-columns:auto auto auto; gap:2px 6px; font:700 12px 'Noto Sans KR'; color:#fff; text-shadow:0 1px 2px #000, 0 0 4px #000; text-align:left; }
  #wmap .isl.lock { cursor:default; filter:grayscale(.7) drop-shadow(0 4px 6px rgba(0,0,0,.5)); }
  #wmap .isl.lock .rb { background:linear-gradient(#ddd,#999); color:#333; border-color:#555; }
  #wmap .rm { position:relative; width:max(100%, 980px); aspect-ratio:1000/560; }
  #wmap .nd { position:absolute; transform:translate(-50%,-50%); display:flex; flex-direction:column; align-items:center; cursor:pointer; z-index:1; }
  #wmap .nd .c { width:46px; height:46px; border-radius:50%; display:flex; align-items:center; justify-content:center; font:900 13px 'Noto Sans KR'; color:#fff; text-shadow:0 1px 2px #000;
    background:radial-gradient(circle at 50% 30%, #fff8d0, #e8b84a 45%, #8a5a18); border:3px solid #fff4c8; box-shadow:0 4px 10px rgba(0,0,0,.55), inset 0 -4px 6px rgba(0,0,0,.25); }
  #wmap.dm .nd .c { background:radial-gradient(circle at 50% 30%, #f0e0ff, #a070e0 45%, #4a1a8a); }
  #wmap.dh .nd .c { background:radial-gradient(circle at 50% 30%, #ffe0d8, #ff6a5a 45%, #8a1a12); }
  #wmap .nd.boss .c { width:66px; height:66px; font-size:30px; border-color:#ffd36a; box-shadow:0 0 0 3px rgba(120,40,10,.6), 0 6px 14px rgba(0,0,0,.6), 0 0 22px rgba(255,200,80,.5); }
  #wmap .nd .s { margin-top:2px; font-size:13px; letter-spacing:-2px; text-shadow:0 1px 2px #000; color:#555; }
  #wmap .nd .s b { color:#ffd84a; font-weight:400; }
  #wmap .nd .l { margin-top:1px; font:900 12px 'Noto Sans KR'; color:#fff; text-shadow:0 1px 2px #000, 0 0 5px #000; white-space:nowrap; }
  #wmap .nd.lock { cursor:default; } #wmap .nd.lock .c { filter:grayscale(1) brightness(.6); } #wmap .nd.lock .l { opacity:.6; }
  #wmap .nd.next .c { animation:ndp 1.1s infinite alternate; }
  @keyframes ndp { from { box-shadow:0 0 0 0 rgba(255,255,255,.8), 0 4px 10px rgba(0,0,0,.55); } to { box-shadow:0 0 0 10px rgba(255,255,255,0), 0 4px 10px rgba(0,0,0,.55); } }
  #wmap .pin { position:absolute; transform:translate(-50%,-100%); z-index:2; pointer-events:none; animation:pinb 1s infinite alternate; }
  #wmap .pin div { width:34px; height:34px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); background:#fff; border:3px solid #7ff3ff; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 8px rgba(0,0,0,.5); }
  #wmap .pin div i { transform:rotate(45deg); font-style:normal; font-size:16px; }
  @keyframes pinb { to { margin-top:-6px; } }
  #wmap .cp { position:absolute; left:12px; bottom:12px; z-index:3; background:rgba(20,12,4,.8); border:1px solid #c9a056; border-radius:10px; padding:8px 12px; font:700 12px 'Noto Sans KR'; color:#fff3d6; min-width:200px; }
  #wmap .cp .bar { height:8px; border-radius:4px; background:rgba(255,255,255,.15); margin-top:5px; overflow:hidden; } #wmap .cp .bar i { display:block; height:100%; background:linear-gradient(90deg,#b88cff,#ffe08a); }
  #spop { position:fixed; left:50%; top:50%; transform:translate(-50%,-48%) scale(.96); width:min(440px, 94vw); max-height:94vh; overflow:auto; z-index:31; opacity:0; pointer-events:none; transition:opacity .2s, transform .2s;
    background:linear-gradient(180deg,#4a3018,#2a1a0c); border:3px solid #c9a056; border-radius:12px; box-shadow:0 0 0 4px rgba(0,0,0,.35), 0 20px 60px rgba(0,0,0,.8); padding:16px 18px 18px; color:#fff3d6; }
  #spop.on { opacity:1; pointer-events:auto; transform:translate(-50%,-50%) scale(1); }
  #spop .hd { display:flex; align-items:center; gap:10px; }
  #spop .hd .no { font:900 22px 'Cinzel'; color:#ffd36a; text-shadow:0 2px 4px #000; } #spop .hd .nm { font:900 18px 'Gowun Batang'; flex:1; }
  #spop .hd .bt { font:900 11px 'Noto Sans KR'; color:#fff; background:#c0281e; padding:2px 8px; border-radius:6px; }
  #spop .hd .x { background:none; border:none; color:#e9c87e; font-size:20px; cursor:pointer; }
  #spop .ds { font:400 13px/1.6 'Noto Sans KR'; color:#e8dcc0; margin:6px 0 10px; }
  #spop .df { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
  #spop .df button { padding:8px 4px; border-radius:8px; cursor:pointer; font:900 13px 'Noto Sans KR'; color:#fff; border:2px solid rgba(255,255,255,.25); opacity:.55; }
  #spop .df button small { display:block; font:400 11px 'Noto Sans KR'; color:#ffe58a; margin-top:2px; letter-spacing:-1px; }
  #spop .df button.on { opacity:1; border-color:#fff; box-shadow:0 0 12px rgba(255,255,255,.4); }
  #spop .df button:disabled { filter:grayscale(1); cursor:default; }
  #spop .df .e { background:linear-gradient(#78c050,#3f7a26); } #spop .df .m { background:linear-gradient(#a070e0,#5a2aa0); } #spop .df .h { background:linear-gradient(#ff7a6a,#b0281e); }
  #spop .pw { display:flex; justify-content:space-between; align-items:center; margin:12px 0 8px; padding:10px 12px; border-radius:8px; background:rgba(0,0,0,.3); border:1px solid rgba(201,160,86,.4); font:700 13px 'Noto Sans KR'; }
  #spop .pw b { font:900 20px 'Cinzel'; color:#ffe9b0; } #spop .pw .me b.low { color:#ff6a5a; } #spop .pw .me b.ok { color:#8aff9a; }
  #spop .sec { font:700 12px 'Noto Sans KR'; color:#c9a056; margin:8px 0 4px; letter-spacing:.1em; }
  #spop .mons { display:flex; flex-wrap:wrap; gap:6px; }
  #spop .mons span { display:flex; align-items:center; gap:4px; padding:4px 8px; border-radius:14px; background:rgba(255,255,255,.08); font:500 12px 'Noto Sans KR'; }
  #spop .mons span.bs { background:rgba(200,40,30,.35); border:1px solid #ff7a6a; }
  #spop .rw { font:500 12.5px/1.7 'Noto Sans KR'; color:#fff3d6; } #spop .rw em { font-style:normal; color:#ffd36a; font-weight:900; }
  #spop .go { width:100%; margin-top:14px; font:900 17px 'Gowun Batang'; letter-spacing:.3em; color:#2a1400; padding:12px; border:none; border-radius:10px; cursor:pointer; background:linear-gradient(180deg,#fff2a0,#f0b030 60%,#c07a10); box-shadow:0 4px 0 #7a4a08, 0 0 20px rgba(255,200,80,.4); }
  #spop .go:active { transform:translateY(2px); box-shadow:0 2px 0 #7a4a08; }
  #res { position:fixed; inset:0; z-index:29; display:flex; flex-direction:column; align-items:center; justify-content:center; background:radial-gradient(ellipse at center, rgba(20,30,10,.55), rgba(0,0,0,.88)); opacity:0; pointer-events:none; transition:opacity .5s; padding:20px; }
  #res.on { opacity:1; pointer-events:auto; }
  #res .a { font:900 clamp(30px,7vw,56px) 'Cinzel'; letter-spacing:.12em; background:linear-gradient(180deg,#fff7df 10%,#ffd36a 60%,#b8862a); -webkit-background-clip:text; background-clip:text; color:transparent; filter:drop-shadow(0 4px 10px rgba(0,0,0,.8)); }
  #res.fail .a { background:linear-gradient(180deg,#ffe0e0 10%,#ff8a7a 60%,#9a2a20); -webkit-background-clip:text; background-clip:text; }
  #res .b { font:700 16px 'Gowun Batang'; color:#fff3d6; margin-top:4px; letter-spacing:.15em; }
  #res .st { display:flex; gap:10px; margin:16px 0 8px; font-size:54px; line-height:1; }
  #res .st span { color:#3a3a3a; text-shadow:0 2px 6px #000; transform:scale(.3); opacity:0; animation:stin .5s forwards; }
  #res .st span.on { color:#ffd84a; text-shadow:0 0 18px rgba(255,210,80,.9), 0 2px 6px #000; }
  @keyframes stin { to { transform:scale(1); opacity:1; } }
  #res .cr { font:500 13px/1.9 'Noto Sans KR'; color:#e8e1cf; text-align:center; }
  #res .cr i { font-style:normal; color:#9aff9a; } #res .cr s { text-decoration:none; color:#888; }
  #res .rw { margin-top:10px; font:700 15px 'Noto Sans KR'; color:#fff3d6; text-align:center; } #res .rw em { font-style:normal; color:#ffd36a; }
  #res .bt { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-top:20px; }
  #res .bt button { font:900 14px 'Gowun Batang'; letter-spacing:.1em; padding:11px 18px; border-radius:10px; cursor:pointer; border:2px solid #c9a056; color:#fff3d6; background:rgba(40,26,10,.85); }
  #res .bt button.pri { color:#2a1400; border:none; background:linear-gradient(180deg,#fff2a0,#f0b030 60%,#c07a10); box-shadow:0 4px 0 #7a4a08; }
`;
document.head.appendChild(css);
const mk = (tag, id, html, parent = document.body) => { const e = document.createElement(tag); if (id) e.id = id; if (html) e.innerHTML = html; parent.appendChild(e); return e; };
mk('div', 'lbT').className = 'lb'; mk('div', 'lbB').className = 'lb';
const dlg = mk('div', 'dlg', '<div class="who"></div><div class="txt"></div><div class="ch"></div><div class="nx">▼</div>');
const hud = $('hud');
const objEl = mk('div', 'obj', '<div class="t">QUEST</div><div class="q"></div><div class="p"></div>', hud);
const hintEl = mk('div', 'hint', '', hud);
const bannerEl = mk('div', 'banner', '<div class="a"></div><div class="b"></div><div class="c"></div>');
const chap = mk('div', 'chap', '');
const statw = mk('div', 'statw', '');
const bossEl = mk('div', 'boss', '<div class="n"></div><div class="bar"><s></s><i></i></div>', hud);
const ehp = mk('div', 'ehp', '');
const hurtEl = mk('div', 'hurt', ''), lowEl = mk('div', 'lowhp', '');
const cb = mk('div', 'cbtns', '<div class="cb" id="cRune"><span>✦</span>룬<i></i></div><div class="cb" id="cRoll"><span>➰</span>구르기</div><div class="cb" id="cAtk"><span>⚔</span>공격</div>', hud);
const modes = mk('div', 'modes', '<button class="story" id="mStory"><span>✦</span>스토리 모드</button><button class="soon" id="mMini"><span>🎲</span>미니 게임</button><button id="mShop"><span>👑</span>외형</button><button id="mJob"><span>⚜</span>직업</button><button id="mStat"><span>⚔</span>스탯</button>', hud);
const bReturn = mk('button', 'bReturn', '⟲ 광장으로', hud);
const tpEl = mk('div', 'tp', '<div class="r"></div><div class="n"></div><div class="a"></div>');
const card = $('card');
card.querySelector('.bars').insertAdjacentHTML('beforeend', '<i class="xp"><b></b></i>');
const [hpB, mpB, xpB] = card.querySelectorAll('.bars b');
card.querySelector('.nm').insertAdjacentHTML('beforeend', '<span class="pt">+P</span>');


// ───────────────────────── 저장 / 스탯 ─────────────────────────
const SKEY = 'agora_story_v1';
const S = Object.assign({ lv: 1, exp: 0, pts: 0, str: 1, vit: 1, agi: 1, int: 1, sword: false, rune: false, statTut: false, gold: 0, clr: {} }, (() => { try { return JSON.parse(G.SAVE.get(SKEY, '{}')) || {}; } catch (e){ return {}; } })());
const save = () => G.SAVE.set(SKEY, JSON.stringify(S));
const JM = () => { const j = S.job, a = S.asc ? 1 : 0; return { hp: (j === 'sword' ? 1.25 : 1) * (1 + a * 0.15), atk: (j === 'mage' ? 0.9 : j === 'sword' ? 1 : j ? 0.95 : 1) * (1 + a * 0.2), crit: j === 'rogue' ? 0.15 : j === 'archer' ? 0.08 : 0, aspd: j === 'rogue' ? 1.3 : 1, spd: j === 'archer' ? 0.08 : 0, mp: j === 'mage' ? 1.5 : 1, reg: j === 'mage' ? 1.6 : 1, rune: (j === 'mage' ? 1.35 : 1) * (1 + a * 0.2) }; };
const D = () => { const m = JM(); return {
  maxHp: Math.round((90 + S.vit * 14 + S.lv * 6 + BONUS.hp) * m.hp), atk: (9 + S.str * 3.2 + S.lv * 0.8 + BONUS.atk) * m.atk,
  spd: Math.min(1.35, 1 + (S.agi - 1) * 0.025) + m.spd + BONUS.spd, aspd: Math.min(1.7, 1 + (S.agi - 1) * 0.045) * m.aspd + BONUS.aspd, crit: Math.min(0.75, 0.06 + (S.agi - 1) * 0.014 + m.crit + BONUS.crit),
  maxMp: Math.round((40 + S.int * 8 + BONUS.mp) * m.mp), rune: (26 + S.int * 7 + BONUS.rune) * m.rune, cd: Math.max(3, 9 - S.int * 0.3), mpRegen: (3 + S.int * 0.4) * m.reg, def: BONUS.def, regen: BONUS.regen,
}; };
const need = lv => Math.round(30 * Math.pow(lv, 1.45));
let hp = D().maxHp, mp = D().maxMp;
const ST = [
  ['str', '⚔', '힘', 'STR', '공격력이 오른다'],
  ['vit', '❤', '체력', 'VIT', '최대 HP가 오른다'],
  ['agi', '➶', '민첩', 'AGI', '이동 · 공격 속도, 치명타'],
  ['int', '✦', '지능', 'INT', '룬 마법 · 마법사 스킬 위력 · MP · 스킬 재사용'],
];
statw.innerHTML = `<div class="hd"><span>STATUS</span><b>이름 없는 자</b><button class="x">✕</button></div>
  <div class="lvr"><div class="lv">Lv.<em></em></div><div class="xb"><i></i></div><div class="xt"></div></div>
  <div class="pts">남은 스탯 포인트<em></em><span style="float:right;font:700 13px 'Noto Sans KR';color:#ffe9b0">⚔ 전투력 <b class="cpw" style="font:900 18px Cinzel"></b></span></div>
  <div class="rows">${ST.map(s => `<div class="row" data-k="${s[0]}"><div class="ic">${s[1]}</div><div><div class="nm">${s[2]}<small>${s[3]}</small></div><div class="ds">${s[4]}</div></div><div class="v"></div><button>+</button></div>`).join('')}</div>
  <div class="der"></div>`;
statw.querySelector('.x').onclick = () => toggleStats(false);
statw.querySelectorAll('.row button').forEach(b => b.onclick = e => {
  e.stopPropagation(); const k = b.closest('.row').dataset.k; if (S.pts <= 0) return;
  const before = D(); S[k]++; S.pts--; const after = D();
  hp += after.maxHp - before.maxHp; mp += after.maxMp - before.maxMp; sfx('pick'); save(); refreshStats(); refreshHud();
});
let statOpen = false;
function toggleStats(on = !statOpen){ statOpen = on; statw.classList.toggle('on', on); if (on){ refreshStats(); sfx('ui'); } }
function refreshStats(){
  const d = D();
  statw.querySelector('.lv em').textContent = S.lv;
  statw.querySelector('.xb i').style.width = (S.exp / need(S.lv) * 100) + '%';
  statw.querySelector('.xt').textContent = `${S.exp} / ${need(S.lv)}`;
  statw.querySelector('.pts em').textContent = S.pts;
  statw.querySelector('.hd b').textContent = jobName() + (stars(20, 'e') ? ' · 숲의 수호자' : ''); statw.querySelector('.cpw').textContent = fmt(power());
  for (const r of statw.querySelectorAll('.row')){ r.querySelector('.v').textContent = S[r.dataset.k]; r.querySelector('button').disabled = S.pts <= 0; }
  statw.querySelector('.der').innerHTML = `<div>최대 HP<b>${d.maxHp}</b></div><div>최대 MP<b>${d.maxMp}</b></div><div>공격력<b>${Math.round(d.atk)}</b></div><div>치명타<b>${Math.round(d.crit * 100)}%</b></div><div>이동 속도<b>${Math.round(d.spd * 100)}%</b></div><div>공격 속도<b>${Math.round(d.aspd * 100)}%</b></div><div>룬 마법<b>${Math.round(d.rune)}</b></div><div>룬 재사용<b>${d.cd.toFixed(1)}초</b></div>`;
}
function refreshHud(){
  const d = D();
  card.querySelector('.lv').textContent = `Lv.${S.lv} · ⚔ 전투력 ${fmt(power())}`;
  card.querySelector('.nm').firstChild.textContent = S.job ? jobName() : stars(20, 'e') ? '숲의 수호자' : '이름 없는 자';
  card.classList.toggle('haspt', S.pts > 0);
  hpB.style.width = clamp(hp / d.maxHp * 100, 0, 100) + '%';
  mpB.style.width = clamp(mp / d.maxMp * 100, 0, 100) + '%';
  xpB.style.width = (S.exp / need(S.lv) * 100) + '%';
}
card.addEventListener('click', () => toggleStats());


// ───────────────────────── 사운드 (합성) ─────────────────────────
let AC = null, NB = null;
function ac(){
  if (!AC){ try { AC = new (window.AudioContext || window.webkitAudioContext)(); const n = AC.sampleRate; NB = AC.createBuffer(1, n, n); const d = NB.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; } catch (e){ return null; } }
  if (AC.state === 'suspended') AC.resume(); return AC;
}
addEventListener('pointerdown', () => ac(), { once: true }); addEventListener('keydown', () => ac(), { once: true });
function tone(type, f0, f1, dur, vol, delay = 0){
  const a = ac(); if (!a) return; const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol, f0, f1, q = 1, type = 'bandpass', delay = 0){
  const a = ac(); if (!a) return; const t = a.currentTime + delay, s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
  s.buffer = NB; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(a.destination); s.start(t, R() * 0.5); s.stop(t + dur + 0.05);
}
function sfx(k){
  switch (k){
    case 'swing': noise(0.16, 0.22, 900, 3200, 1.2); break;
    case 'hit': tone('sine', 160, 50, 0.16, 0.35); noise(0.08, 0.3, 2500, 600, 0.8); break;
    case 'crit': tone('sine', 200, 45, 0.22, 0.45); noise(0.12, 0.4, 4000, 500, 0.7); tone('triangle', 1400, 900, 0.15, 0.08); break;
    case 'hurt': tone('square', 220, 70, 0.2, 0.12); noise(0.12, 0.2, 800, 200); break;
    case 'roll': noise(0.25, 0.12, 400, 1500, 0.7); break;
    case 'rune': tone('sine', 180, 900, 0.35, 0.22); noise(0.5, 0.25, 300, 3000, 0.6); tone('triangle', 660, 1320, 0.4, 0.08, 0.05); break;
    case 'boom': noise(0.9, 0.5, 600, 60, 0.5, 'lowpass'); tone('sine', 90, 30, 0.8, 0.45); break;
    case 'die': tone('sawtooth', 300, 60, 0.35, 0.06); noise(0.4, 0.15, 1200, 200); break;
    case 'level': [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.35, 0.12, i * 0.08)); break;
    case 'pick': tone('sine', 880, 880, 0.12, 0.12); tone('sine', 1320, 1320, 0.2, 0.1, 0.07); break;
    case 'ui': tone('sine', 660, 760, 0.07, 0.06); break;
    case 'portal': tone('sawtooth', 70, 40, 1.5, 0.08); noise(1.4, 0.15, 200, 800, 2); break;
    case 'clang': tone('triangle', 1800, 1700, 0.25, 0.04); tone('sine', 900, 880, 0.3, 0.03); break;
    case 'roar': tone('sawtooth', 110, 55, 1.2, 0.12); noise(1.1, 0.3, 300, 120, 1.5); break;
    case 'shard': [784, 988, 1175, 1568].forEach((f, i) => tone('sine', f, f, 0.5, 0.09, i * 0.06)); break;
    case 'pop': tone('sine', 520, 1040, 0.12, 0.12); tone('triangle', 1560, 1800, 0.1, 0.05, 0.05); break;
    case 'buzz': tone('sawtooth', 220, 260, 0.35, 0.04); tone('sawtooth', 225, 255, 0.35, 0.03); break;
    case 'stomp': tone('sine', 110, 45, 0.3, 0.3); noise(0.25, 0.25, 500, 120, 0.8, 'lowpass'); break;
    case 'throw': noise(0.18, 0.12, 600, 1800, 1); break;
    case 'boing': tone('sine', 180, 520, 0.3, 0.18); break;
    case 'puff': noise(0.6, 0.25, 1500, 300, 0.6); tone('sine', 300, 200, 0.4, 0.06); break;
    case 'rumble': noise(0.8, 0.3, 200, 60, 1, 'lowpass'); tone('sine', 60, 40, 0.8, 0.2); break;
    case 'summon': [660, 880, 1100].forEach((f, i) => tone('triangle', f, f * 1.2, 0.18, 0.06, i * 0.07)); break;
    case 'bow': noise(0.12, 0.2, 2000, 500, 1.5); tone('triangle', 520, 180, 0.12, 0.06); break;
    case 'zap': tone('sawtooth', 900, 200, 0.14, 0.05); noise(0.1, 0.12, 5000, 1500, 1); break;
    case 'heart': tone('sine', 60, 40, 0.14, 0.4); tone('sine', 58, 38, 0.12, 0.3, 0.18); break;
    case 'elite': tone('sawtooth', 90, 45, 0.9, 0.1); tone('square', 140, 70, 0.6, 0.04, 0.1); noise(0.8, 0.2, 400, 100, 1.2); break;
    case 'type': tone('sine', 1200 + R() * 200, 1100, 0.03, 0.012); break;
  }
}


// ───────────────────────── 스테이지 맵 생성기 (스테이지마다 다른 지형) ─────────────────────────
const SW = new THREE.Group(); SW.visible = false; G.scene.add(SW);
const SCOL = [], SINT = [];
let SHAPES = [{ c: [0, 0, 12] }];
function shapeOut(px, pz, sh, m = 0){
  if (sh.c){ const [cx, cz] = sh.c, r = Math.max(0.3, sh.c[2] - m), dx = px - cx, dz = pz - cz, d = Math.hypot(dx, dz); return d <= r ? [0, px, pz] : [d - r, cx + dx / d * r, cz + dz / d * r]; }
  const [ax, az, bx, bz] = sh.s, r = Math.max(0.3, sh.s[4] - m), ex = bx - ax, ez = bz - az, t = clamp(((px - ax) * ex + (pz - az) * ez) / (ex * ex + ez * ez), 0, 1), sx = ax + ex * t, sz = az + ez * t, dx = px - sx, dz = pz - sz, d = Math.hypot(dx, dz);
  return d <= r ? [0, px, pz] : [d - r, sx + dx / d * r, sz + dz / d * r];
}
function outDist(px, pz, m = 0){ let best = 1e9; for (const sh of SHAPES){ const o = shapeOut(px, pz, sh, m)[0]; if (o < best) best = o; if (best === 0) break; } return best; }
function clampShapes(p, m = 0){ let best = null; for (const sh of SHAPES){ const r = shapeOut(p.x, p.z, sh, m); if (r[0] === 0) return p; if (!best || r[0] < best[0]) best = r; } p.x = best[1]; p.z = best[2]; return p; }
function storyBound(p){ clampShapes(p, 0.35); }
G.camFn = (w, t) => { if (G.area !== 'story') return; const dx = w.x - t.x, dy = w.y - t.y, dz = w.z - t.z;
  for (let k = 1; k <= 16; k++){ const f = k / 16; if (outDist(t.x + dx * f, t.z + dz * f) > 2.5){ const g = Math.max(0.3, (k - 1) / 16); w.set(t.x + dx * g, t.y + dy * g + (1 - g) * 1.2, t.z + dz * g); return; } } };
const ADDM = (map, op = 1) => new THREE.MeshBasicMaterial({ map, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
const polarRing = (r0, r1, seg = 128) => {
  const P = [], U = [], I = [];
  for (let i = 0; i <= seg; i++){ const a = i / seg * TAU; for (const [r, v] of [[r0, 0], [r1, 1]]){ P.push(Math.cos(a) * r, 0, Math.sin(a) * r); U.push(i / seg, v); } }
  for (let i = 0; i < seg; i++){ const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); return g;
};
const meterUV = g => { const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), p.getZ(i)); return g; };
const storyArea = G.addArea('story', { group: SW, col: SCOL, interact: SINT, ground: () => 0.04, bound: p => storyBound(p), mapBase: G.cnv(512), mapR: 42 });

// ── 텍스처 / 재질 ──
function noiseTex(base, specks, rep = 1 / 3, n = 2400){
  const c = G.cnv(256), x = c.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < n; i++){ x.globalAlpha = 0.2 + R() * 0.5; x.fillStyle = specks[i % specks.length]; const s = R() * 5 + 1; x.beginPath(); x.ellipse(R() * 256, R() * 256, s, s * rr(0.5, 1), R() * 3, 0, TAU); x.fill(); }
  x.globalAlpha = 1; return G.tex(c, true, rep);
}
const TX = {
  dirt: noiseTex('#6a563f', ['#8a7050', '#5a4632', '#a08a68']), sand: noiseTex('#c8ac7c', ['#e0c898', '#a88c60', '#d8bc8a']),
  mud: noiseTex('#4a3a2a', ['#5a4834', '#3a2c20', '#6a5440']), leaves: noiseTex('#a8562a', ['#d8802a', '#8a3a1a', '#e8a840', '#c04020', '#6a4a22'], 1 / 3, 4000),
  petals: noiseTex('#7a8a5a', ['#ffc0d0', '#ff9ab8', '#fff0f4', '#e8a0c0'], 1 / 3, 3000), moss: noiseTex('#45603a', ['#5a7a44', '#3a5030', '#6a8a50']),
  heather: noiseTex('#6a5a5a', ['#9a6a9a', '#7a5a7a', '#b08ab0', '#5a6a4a'], 1 / 3, 3200), redrock: noiseTex('#a8643e', ['#c87a4a', '#8a4a2a', '#d89a6a']),
  darksoil: noiseTex('#33291f', ['#43362a', '#251d16', '#4a3a28']), meadow: noiseTex('#6aa04a', ['#7ab858', '#5a9040', '#8ac868', '#fff27a', '#ffffff'], 1 / 3, 3000),
};
const MC = {};
const smat = (key, o) => MC[key] || (MC[key] = G.std(Object.assign({ roughness: 0.85, side: THREE.DoubleSide }, o)));
const water = () => MC.water || (MC.water = G.std({ color: 0x3a90b8, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.82, emissive: 0x0a3040, emissiveIntensity: 0.4 }));
const TREEMAT = G.std({ vertexColors: true, flatShading: true, roughness: 0.85, side: THREE.DoubleSide });

// ── 나무 / 식물 지오메트리 (정점 색) ──
function colored(parts){
  const P = [], N = [], C = [], c = new THREE.Color();
  for (const [g0, hex, m] of parts){
    const g = (g0.index ? g0.toNonIndexed() : g0); if (m) g.applyMatrix4(m); c.set(hex);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++){ P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); C.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeBoundingSphere(); return g;
}
const TM = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => G.mat(x, y, z, rx, ry, rz, sx, sy, sz);
const TG = {};
const treeGeo = type => TG[type] || (TG[type] = (() => {
  const trunk = (h, r0, r1, col = 0x5a3e28) => [new THREE.CylinderGeometry(r1, r0, h, 7), col, TM(0, h / 2, 0)];
  const blob = (r, x, y, z, col, det = 1, sy = 1) => [new THREE.IcosahedronGeometry(r, det), col, TM(x, y, z, 1, sy, 1)];
  switch (type){
    case 'pine': return colored([trunk(2.2, 0.26, 0.17), ...[[1.9, 3.0, 2.4], [1.5, 2.7, 3.9], [1.05, 2.3, 5.3], [0.6, 1.6, 6.5]].map(([r, h, y]) => [new THREE.ConeGeometry(r, h, 8), 0x2b4a2a, TM(0, y, 0)])]);
    case 'oak': return colored([trunk(2.6, 0.38, 0.26), blob(1.7, 0, 3.9, 0, 0x3f7a30), blob(1.2, 1.1, 3.4, 0.4, 0x4a8a38), blob(1.2, -1.0, 3.5, -0.5, 0x3a7030), blob(1.1, 0.2, 4.9, -0.2, 0x56963e)]);
    case 'birch': return colored([trunk(4.2, 0.2, 0.13, 0xeeeae0), [new THREE.BoxGeometry(0.2, 0.06, 0.06), 0x2a2a2a, TM(0, 1.4, 0.15)], [new THREE.BoxGeometry(0.2, 0.06, 0.06), 0x2a2a2a, TM(0.05, 2.5, -0.13)], blob(1.0, 0, 4.4, 0, 0x8ac050), blob(0.8, 0.5, 3.8, 0.2, 0x9ad060), blob(0.75, -0.4, 4.0, -0.3, 0x7ab048)]);
    case 'tint': return colored([trunk(2.4, 0.32, 0.22, 0x6a4a30), blob(1.6, 0, 3.6, 0, 0xffffff), blob(1.15, 1.0, 3.2, 0.4, 0xf0f0f0), blob(1.1, -1.0, 3.3, -0.4, 0xe8e8e8), blob(1.0, 0.1, 4.6, -0.1, 0xffffff)]);
    case 'shroomT': return colored([[new THREE.CylinderGeometry(0.35, 0.55, 3.2, 10), 0xf4ead8, TM(0, 1.6, 0)], [new THREE.SphereGeometry(2.0, 16, 10, 0, TAU, 0, Math.PI / 2), 0xffffff, TM(0, 3.0, 0, 1, 0.65, 1)], [new THREE.CircleGeometry(2.0, 16), 0xe8dcc8, TM(0, 3.0, 0, 1, 1, 1, Math.PI / 2)],
      ...[0, 1, 2, 3, 4, 5].map(i => [new THREE.SphereGeometry(0.26, 8, 6), 0xfff8f0, TM(Math.cos(i * 1.05) * 1.3, 3.0 + 0.8, Math.sin(i * 1.05) * 1.3, 1, 0.5, 1)])]);
    case 'willow': return colored([trunk(2.8, 0.42, 0.3), blob(1.9, 0, 4.0, 0, 0x6a9a48, 1, 0.8), ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => [new THREE.ConeGeometry(0.5, 2.6, 6), 0x7aaa52, TM(Math.cos(i * 0.785) * 1.6, 2.8, Math.sin(i * 0.785) * 1.6, 1, 1, 1, Math.PI)])]);
    case 'bush': return colored([blob(0.9, 0, 0.6, 0, 0x3f7a30), blob(0.65, 0.6, 0.45, 0.2, 0x4a8a38), blob(0.6, -0.55, 0.45, -0.1, 0x36702c)]);
    case 'berry': return colored([blob(0.9, 0, 0.6, 0, 0x2f6a2c), blob(0.6, 0.6, 0.45, 0.2, 0x3a7a32), ...[0, 1, 2, 3, 4, 5, 6].map(i => [new THREE.SphereGeometry(0.1, 6, 4), 0xd02a4a, TM(Math.cos(i) * 0.75, 0.6 + Math.sin(i * 2) * 0.35, Math.sin(i) * 0.75)])]);
    case 'sunflower': return colored([[new THREE.CylinderGeometry(0.06, 0.08, 2.4, 5), 0x4a8a2a, TM(0, 1.2, 0)], [new THREE.CylinderGeometry(0.32, 0.32, 0.1, 14), 0x5a3a1a, TM(0, 2.45, 0.08, 1, 1, 1, 1.3)], [new THREE.CylinderGeometry(0.62, 0.62, 0.05, 14), 0xffcf20, TM(0, 2.45, 0.04, 1, 1, 1, 1.3)], [new THREE.SphereGeometry(0.3, 6, 4), 0x4a8a2a, TM(0.25, 1.2, 0, 1, 0.2, 0.6, 0, 0, 0.4)]]);
    case 'reed': return colored([0, 1, 2, 3, 4].flatMap(i => [[new THREE.CylinderGeometry(0.025, 0.035, 1.8, 4), 0x6a8a3a, TM(Math.cos(i * 1.3) * 0.25, 0.9, Math.sin(i * 1.3) * 0.25)], [new THREE.CapsuleGeometry(0.06, 0.25, 2, 5), 0x6a4022, TM(Math.cos(i * 1.3) * 0.25, 1.85, Math.sin(i * 1.3) * 0.25)]]));
    case 'bare': return colored([trunk(3.4, 0.3, 0.18, 0x4a3a2e), ...[[0.8, 2.4, 0.7], [-0.7, 2.8, -0.9], [0.4, 3.2, -0.6], [-0.3, 2.0, 1.0]].map(([a, y, b]) => [new THREE.CylinderGeometry(0.05, 0.1, 1.5, 5), 0x4a3a2e, TM(a * 0.5, y + 0.4, b * 0.5, 1, 1, 1, b, 0, -a)])]);
    case 'bramble': return colored([blob(0.9, 0, 0.6, 0, 0x2a3a24), blob(0.7, 0.6, 0.5, 0.3, 0x34402a), ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => [new THREE.ConeGeometry(0.07, 0.5, 4), 0x5a2a3a, TM(Math.cos(i * 0.7) * 0.85, 0.6 + Math.sin(i * 1.7) * 0.4, Math.sin(i * 0.7) * 0.85, 1, 1, 1, Math.sin(i * 0.7) * 1.4, 0, -Math.cos(i * 0.7) * 1.4)])]);
    case 'boulder': return colored([[new THREE.IcosahedronGeometry(1, 0), 0x8a8880, TM(0, 0.5, 0, 1.3, 0.85, 1.1)], [new THREE.IcosahedronGeometry(0.6, 0), 0x7a7a72, TM(0.9, 0.3, 0.4)]]);
    case 'redrock': return colored([[new THREE.IcosahedronGeometry(1.4, 0), 0xb06a40, TM(0, 1.6, 0, 1, 1.6, 1)], [new THREE.IcosahedronGeometry(1.1, 0), 0xc87a4a, TM(0.8, 3.3, 0.2, 0.9, 1.0, 0.9)], [new THREE.IcosahedronGeometry(0.9, 0), 0x9a5a36, TM(-0.6, 0.6, 0.6)]]);
  }
})());
function plant(list, type){
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(treeGeo(type), TREEMAT, list.length), c = new THREE.Color();
  list.forEach((t, i) => { im.setMatrixAt(i, G.mat(t[0], 0, t[1], 0, t[3] ?? R() * TAU, 0, t[2], t[2] * (t[5] || 1), t[2])); c.set(t[4] ?? 0xffffff); im.setColorAt(i, c); });
  im.castShadow = true; im.receiveShadow = true; stageG.add(im); return im;
}
function forest(mix, opt = {}){
  const dens = opt.dens || 1, out = {}, pts = [];
  for (const k in mix) out[k] = [];
  const tot = Object.values(mix).reduce((a, b) => a + b, 0);
  for (let t = 0; t < 4200 * dens && pts.length < 460 * dens; t++){
    const x = rr(-62, 62), z = rr(-62, 62), od = outDist(x, z);
    if (od < (opt.gap ?? 1.6)) continue;
    if (stageL && Math.hypot(x - stageL.entry[0], z - stageL.entry[1]) < 11) continue;
    if (od > 8 && R() < Math.min(0.85, (od - 8) / 30)) continue;
    let q = R() * tot, k; for (k in mix){ q -= mix[k]; if (q <= 0) break; }
    const s = (opt.scale || 1) * rr(0.75, 1.35);
    out[k].push([x, z, s, R() * TAU, opt.tint ? opt.tint(k) : undefined]); pts.push([x, z, s]);
  }
  for (const k in out) plant(out[k], k);
  return pts;
}
function randIn(margin = 1.5, avoid = []){
  for (let t = 0; t < 400; t++){
    const sh = SHAPES[(R() * SHAPES.length) | 0]; let x, z;
    if (sh.c){ const a = R() * TAU, r = Math.sqrt(R()) * sh.c[2]; x = sh.c[0] + Math.cos(a) * r; z = sh.c[1] + Math.sin(a) * r; }
    else { const k = R(), a = R() * TAU, r = Math.sqrt(R()) * sh.s[4]; x = sh.s[0] + (sh.s[2] - sh.s[0]) * k + Math.cos(a) * r; z = sh.s[1] + (sh.s[3] - sh.s[1]) * k + Math.sin(a) * r; }
    if (outDist(x, z, margin) > 0) continue;
    if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
    if (stageL && Math.hypot(x - stageL.entry[0], z - stageL.entry[1]) < 4) continue;
    return [x, z];
  }
  return null;
}
// ── 소품 ──
let K = null, B = null;
const col = (x, z, r) => SCOL.push({ t: 'c', x, z, r });
const P = {
  tent(x, z, ry, key){ K.push(x, 0, z, ry); K.geo(key, new THREE.ConeGeometry(2.2, 2.8, 6, 1, true), 0, 1.4, 0); K.geo('woodD', new THREE.CylinderGeometry(0.05, 0.05, 3.3, 5), 0, 1.65, 0); K.geo('dark', new THREE.PlaneGeometry(1.0, 1.5), 0, 0.75, 1.55, -0.3, 0, 0); K.pop(); col(x, z, 2.2); },
  campfire(x, z){
    for (let i = 0; i < 10; i++){ const a = i / 10 * TAU; K.geo('rock', new THREE.IcosahedronGeometry(0.24, 0), x + Math.cos(a) * 0.78, 0.12, z + Math.sin(a) * 0.78, R(), R(), R()); }
    for (let i = 0; i < 4; i++){ const a = i / 4 * TAU + 0.4; K.geo('woodD', new THREE.CylinderGeometry(0.08, 0.09, 1.1, 6), x + Math.cos(a) * 0.28, 0.4, z + Math.sin(a) * 0.28, Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55); }
    K.geo('ember', new THREE.CircleGeometry(0.5, 16).rotateX(-Math.PI / 2), x, 0.07, z); col(x, z, 1.05);
    G.particles(48, [new V3(x, 0.25, z)], { parent: stageG,
      vert: `float life = fract(uTime * (0.9 + 0.5 * fract(aSeed * 7.13)) + aSeed); vL = life; vS = aSeed; float an = aSeed * 81.0, rad = (0.32 * (1.0 - life) + 0.04) * fract(aSeed * 3.7);
        vec3 p = position + vec3(cos(an) * rad + sin(uTime * 3.0 + aSeed * 20.0) * 0.08 * life, life * 1.5, sin(an) * rad); float sz = 0.7 * (1.0 - life * 0.65);`,
      frag: `float a = smoothstep(0.5, 0.0, d) * (1.0 - vL) * smoothstep(0.0, 0.08, vL); vec3 c = mix(vec3(1.0, 0.85, 0.45), vec3(1.0, 0.28, 0.04), smoothstep(0.05, 0.55, vL)); gl_FragColor = vec4(c * a * 1.6, a);` });
    const l = new THREE.PointLight(0xff8a3a, 16, 16, 1.6); l.position.set(x, 1.3, z); stageG.add(l); stageAnims.push(() => { l.intensity = 14 + Math.sin(G.time * 13) * 2.5 + Math.sin(G.time * 29) * 1.5; });
    const g = glowSprite(0xff9a40, 4, 0.8); g.material.map = FX.glowTW; g.position.set(x, 0.9, z); stageG.add(g);
  },
  log(x, z, ry, len = 2, r = 0.25){ K.geo('wood', new THREE.CylinderGeometry(r, r * 1.05, len, 10), x, r, z, 0, ry, Math.PI / 2); SCOL.push({ t: 'b', x, z, hw: len / 2, hd: r + 0.05, c: Math.cos(ry), s: Math.sin(ry) }); },
  stump(x, z, r = 0.5){ K.geo('woodD', new THREE.CylinderGeometry(r, r * 1.15, 0.5, 12), x, 0.25, z); K.geo('sack', new THREE.CircleGeometry(r, 12).rotateX(-Math.PI / 2), x, 0.51, z); col(x, z, r + 0.15); },
  crate(x, z, s = 0.7){ K.box('crate', s, s, s, x, s / 2, z, 0, R(), 0); col(x, z, s * 0.75); },
  lantern(x, z, c = 0xffa040){ K.geo('woodD', new THREE.CylinderGeometry(0.06, 0.08, 2.6, 6), x, 1.3, z); K.box('woodD', 0.5, 0.06, 0.06, x + 0.2, 2.55, z); K.box('lamp', 0.22, 0.3, 0.22, x + 0.42, 2.3, z); const g = glowSprite(c, 2.2, 0.7); g.material.map = FX.glowTW; g.position.set(x + 0.42, 2.3, z); stageG.add(g); col(x, z, 0.25); },
  stoneLantern(x, z, c = 0xffd080){ K.box('stone', 0.7, 0.2, 0.7, x, 0.1, z); K.geo('stone', new THREE.CylinderGeometry(0.14, 0.18, 0.9, 6), x, 0.65, z); K.box('stone', 0.6, 0.45, 0.6, x, 1.32, z); K.geo('stone', new THREE.ConeGeometry(0.55, 0.4, 4), x, 1.75, z, 0, Math.PI / 4, 0); K.box('lamp', 0.3, 0.25, 0.62, x, 1.32, z); const g = glowSprite(c, 1.8, 0.75); g.material.map = FX.glowTW; g.position.set(x, 1.32, z); stageG.add(g); col(x, z, 0.5); },
  fence(x0, z0, x1, z1){ const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 1.6)), ry = Math.atan2(x1 - x0, z1 - z0); for (let i = 0; i <= n; i++){ const t = i / n; K.box('wood', 0.12, 1.0, 0.12, x0 + (x1 - x0) * t, 0.5, z0 + (z1 - z0) * t, 0, ry, rr(-0.08, 0.08)); } for (const h of [0.4, 0.8]) K.box('wood', 0.06, 0.1, L, (x0 + x1) / 2, h, (z0 + z1) / 2, 0, ry, 0); },
  haystack(x, z){ K.geo('hay', new THREE.CylinderGeometry(0.8, 0.9, 1.0, 12), x, 0.5, z); K.geo('hay', new THREE.ConeGeometry(0.85, 0.7, 12), x, 1.35, z); col(x, z, 0.95); },
  skep(x, z){ K.geo('woodD', new THREE.CylinderGeometry(0.06, 0.06, 1.0, 5), x, 0.5, z); K.box('wood', 0.9, 0.06, 0.9, x, 1.0, z); K.geo('hay', G.latheG([[0, 0], [0.42, 0], [0.45, 0.25], [0.38, 0.55], [0.22, 0.75], [0, 0.82]], 14, 0.4), x, 1.03, z); K.geo('dark', new THREE.CircleGeometry(0.09, 8), x, 1.15, z + 0.43); col(x, z, 0.6); },
  hiveBox(x, z, ry = 0){ K.push(x, 0, z, ry); for (let i = 0; i < 3; i++) K.box(i % 2 ? 'plaster2' : 'plaster', 0.9, 0.32, 0.7, 0, 0.35 + i * 0.33, 0); K.box('roof2', 1.05, 0.08, 0.85, 0, 1.38, 0); K.box('dark', 0.4, 0.05, 0.02, 0, 0.22, 0.36); K.pop(); col(x, z, 0.65); },
  pond(x, z, r, lily = true){
    const w = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), water()); w.position.set(x, 0.05, z); stageG.add(w);
    for (let i = 0; i < Math.round(r * 5); i++){ const a = i / Math.round(r * 5) * TAU; K.geo('rock', new THREE.IcosahedronGeometry(rr(0.2, 0.4), 0), x + Math.cos(a) * (r + 0.1), 0.08, z + Math.sin(a) * (r + 0.1), R(), R(), R(), 1, 0.6, 1); }
    if (lily) for (let i = 0; i < Math.round(r * 1.6); i++){ const a = R() * TAU, rd = Math.sqrt(R()) * r * 0.8; K.geo('leaf', new THREE.CircleGeometry(rr(0.25, 0.4), 10, 0.3, TAU - 0.6).rotateX(-Math.PI / 2), x + Math.cos(a) * rd, 0.07, z + Math.sin(a) * rd, 0, R() * TAU, 0); if (R() < 0.5) K.geo('flower', new THREE.IcosahedronGeometry(0.09, 0), x + Math.cos(a) * rd, 0.12, z + Math.sin(a) * rd); }
    col(x, z, r + 0.2);
  },
  river(x0, z0, x1, z1, w){ const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), g = new THREE.PlaneGeometry(w, L, 1, 20).rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, water()); m.position.set((x0 + x1) / 2, 0.05, (z0 + z1) / 2); m.rotation.y = ry; stageG.add(m);
    for (let i = 0; i < L / 1.2; i++){ for (const sgn of [-1, 1]){ const t = i / (L / 1.2), px = x0 + (x1 - x0) * t + Math.cos(ry) * sgn * (w / 2 + 0.2), pz = z0 + (z1 - z0) * t - Math.sin(ry) * sgn * (w / 2 + 0.2); if (R() < 0.6) K.geo('rock', new THREE.IcosahedronGeometry(rr(0.18, 0.38), 0), px, 0.08, pz, R(), R(), R(), 1, 0.6, 1); } }
    const fl = G.particles(80, [new V3((x0 + x1) / 2, 0.08, (z0 + z1) / 2)], { parent: stageG,
      vert: `float life = fract(uTime * 0.25 + aSeed); vL = life; vec3 p = position + vec3(${(Math.sin(ry)).toFixed(3)} * (life - 0.5) * ${L.toFixed(1)} + ${Math.cos(ry).toFixed(3)} * (fract(aSeed * 7.3) - 0.5) * ${w.toFixed(1)}, 0.0, ${Math.cos(ry).toFixed(3)} * (life - 0.5) * ${L.toFixed(1)} - ${Math.sin(ry).toFixed(3)} * (fract(aSeed * 7.3) - 0.5) * ${w.toFixed(1)}); float sz = 0.18;`,
      frag: `float a = smoothstep(0.5, 0.0, d) * 0.5 * sin(vL * 3.14); gl_FragColor = vec4(vec3(0.85, 0.95, 1.0) * a, a);` });
  },
  bridge(x0, z0, x1, z1, w){ const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), n = Math.round(L / 0.35); K.push((x0 + x1) / 2, 0, (z0 + z1) / 2, ry);
    for (let i = 0; i < n; i++){ const t = i / (n - 1) - 0.5; K.box('wood', w, 0.1, 0.3, 0, 0.25 + Math.cos(t * Math.PI) * 0.35, t * L, -Math.sin(t * Math.PI) * 0.35 * 0.6); }
    for (const s of [-1, 1]){ for (let i = 0; i <= 4; i++){ const t = i / 4 - 0.5; K.box('woodD', 0.1, 0.9, 0.1, s * (w / 2), 0.7 + Math.cos(t * Math.PI) * 0.35, t * L); } K.box('woodD', 0.08, 0.08, L, s * (w / 2), 1.15 + 0.25, 0); }
    K.pop(); },
  puddle(x, z, r){ const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20).rotateX(-Math.PI / 2), smat('puddle', { color: 0x3a2e22, roughness: 0.05, metalness: 0.2 })); m.position.set(x, 0.045, z); m.scale.set(1, 1, rr(0.6, 1)); m.rotation.y = R() * 3; stageG.add(m); },
  giantOak(x, z, s = 1){ const g = colored([[new THREE.CylinderGeometry(1.1, 1.8, 6, 10), 0x5a3e28, TM(0, 3, 0)], [new THREE.IcosahedronGeometry(4.2, 1), 0x3f7a30, TM(0, 8.5, 0, 1, 0.75, 1)], [new THREE.IcosahedronGeometry(3, 1), 0x4a8a38, TM(3, 7.2, 1, 1, 0.8, 1)], [new THREE.IcosahedronGeometry(3, 1), 0x36702c, TM(-3, 7.4, -1, 1, 0.8, 1)], ...[0, 1, 2, 3, 4].map(i => [new THREE.CylinderGeometry(0.2, 0.55, 2.6, 6), 0x5a3e28, TM(Math.cos(i * 1.26) * 1.7, 0.4, Math.sin(i * 1.26) * 1.7, 1, 1, 1, Math.sin(i * 1.26) * 1.1, 0, -Math.cos(i * 1.26) * 1.1)])]);
    const m = new THREE.Mesh(g, TREEMAT); m.position.set(x, 0, z); m.scale.setScalar(s); m.castShadow = m.receiveShadow = true; stageG.add(m); col(x, z, 2.0 * s); },
  menhir(x, z, h, a, glow = '#7dffb0'){ K.push(x, 0, z, -a + Math.PI / 2, rr(-0.06, 0.06), rr(-0.06, 0.06)); const g = new THREE.CylinderGeometry(0.48, 0.78, h, 4, 1); g.rotateY(Math.PI / 4); K.geo('basalt', g, 0, h / 2, 0);
    if (glow){ const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.34, h * 0.7), ADDM(runeTex(glow), 0.95)); pl.applyMatrix4(K.top().clone().multiply(G.mat(0, h * 0.5, -0.47, 0, Math.PI, 0))); stageG.add(pl); }
    K.pop(); col(x, z, 0.95); },
  column(x, z, h){ K.box('moss', 1.4, 0.3, 1.4, x, 0.15, z); K.geo('marble', new THREE.CylinderGeometry(0.46, 0.52, h, 16), x, 0.3 + h / 2, z); K.geo('marble', new THREE.ConeGeometry(0.47, 0.5, 7), x + 0.05, 0.3 + h + 0.1, z, rr(-0.3, 0.3), 0, rr(-0.4, 0.4)); col(x, z, 0.85); },
  fallenColumn(x, z, ry){ K.geo('marble', new THREE.CylinderGeometry(0.47, 0.5, 4.2, 16), x, 0.5, z, 0, ry, Math.PI / 2 + 0.06); SCOL.push({ t: 'b', x, z, hw: 2.1, hd: 0.5, c: Math.cos(ry), s: Math.sin(ry) }); },
  rock(x, z, s){ K.geo('rock', new THREE.IcosahedronGeometry(s, 0), x, s * 0.45, z, R(), R(), R(), 1, 0.75, 1); col(x, z, s * 0.9); },
  hedge(x0, z0, x1, z1, h = 1.6){ const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0); K.box('hedge', 1.0, h, L, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, 0, ry, 0); for (let i = 0; i < L / 0.8; i++){ const t = i / (L / 0.8); if (R() < 0.4) K.geo(R() < 0.5 ? 'flower' : 'rose', new THREE.IcosahedronGeometry(0.1, 0), x0 + (x1 - x0) * t + rr(-0.5, 0.5), h * rr(0.3, 1.0), z0 + (z1 - z0) * t + rr(-0.1, 0.1)); } },
  arch(x, z, ry, w = 3){ K.push(x, 0, z, ry); K.geo('woodD', new THREE.TorusGeometry(w / 2, 0.08, 6, 20, Math.PI), 0, 2.0, 0); for (const s of [-1, 1]) K.geo('woodD', new THREE.CylinderGeometry(0.08, 0.08, 2.0, 6), s * w / 2, 1.0, 0); for (let i = 0; i < 14; i++){ const a = i / 13 * Math.PI; K.geo(i % 3 ? 'flower' : 'rose', new THREE.IcosahedronGeometry(0.16, 0), Math.cos(a) * w / 2, 2.0 + Math.sin(a) * w / 2, rr(-0.1, 0.1)); K.geo('leaf', new THREE.IcosahedronGeometry(0.14, 0), Math.cos(a + 0.1) * w / 2, 2.0 + Math.sin(a + 0.1) * w / 2, 0.1); } K.pop(); },
  honeycomb(x, z, s = 1){ K.push(x, 0, z, 0); for (let i = 0; i < 7; i++){ const a = i / 6 * TAU, r = i === 6 ? 0 : 1.6; for (let lv = 0; lv < 3 + (i === 6 ? 2 : 0); lv++) K.geo(lv % 2 ? 'honey' : 'honey2', new THREE.CylinderGeometry(0.95, 0.95, 1.6, 6), (Math.cos(a) * r) * s, (0.8 + lv * 1.62) * s, (Math.sin(a) * r) * s, 0, Math.PI / 6, 0, s, s, s); } K.pop(); col(x, z, 2.6 * s); },
  windmill(x, z){ K.push(x, 0, z, 0); K.geo('plaster', new THREE.CylinderGeometry(1.4, 2.0, 8, 10), 0, 4, 0); K.geo('roof2', new THREE.ConeGeometry(1.8, 2.2, 10), 0, 9.1, 0); K.pop();
    const hub = new THREE.Group(); hub.position.set(x, 7.6, z + 1.6); stageG.add(hub); for (let i = 0; i < 4; i++){ const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.2, 0.08), smat('sail', { color: 0xf4ecd8 })); b.position.y = 2.6; const pv = new THREE.Group(); pv.rotation.z = i * Math.PI / 2; pv.add(b); hub.add(pv); } stageAnims.push(dt => { hub.rotation.z += dt * 0.6; }); },
  rootArch(x, z, ry, r = 4){ K.push(x, 0, z, ry); K.geo('bark', new THREE.TorusGeometry(r, 0.45, 8, 18, Math.PI), 0, 0, 0, 0, 0, 0, 1, 1.1, 1); for (let i = 0; i < 5; i++){ const a = i / 4 * Math.PI; K.geo('leaf', new THREE.ConeGeometry(0.12, 1.4, 4), Math.cos(a) * r, Math.sin(a) * r * 1.1 - 0.8, 0, Math.PI, 0, 0); } K.pop(); for (const s of [-1, 1]){ const px = x + Math.cos(ry) * s * r, pz = z - Math.sin(ry) * s * r; col(px, pz, 0.6); } },
  pumpkin(x, z, s = 0.5){ K.geo('pumpkin', new THREE.SphereGeometry(s, 12, 8), x, s * 0.7, z, 0, R() * 3, 0, 1.15, 0.8, 1.15); K.geo('leaf', new THREE.CylinderGeometry(0.05, 0.06, 0.25, 5), x, s * 1.35, z); col(x, z, s); },
  gate(x, z, ry){ K.push(x, 0, z, ry); for (const s of [-1, 1]) K.geo('lacquer', new THREE.CylinderGeometry(0.18, 0.2, 4, 10), s * 2.2, 2, 0); K.box('lacquer', 5.6, 0.3, 0.4, 0, 3.7, 0); K.box('dark', 6.4, 0.25, 0.5, 0, 4.1, 0, 0, 0, 0); K.box('lacquer', 4.8, 0.2, 0.3, 0, 3.1, 0); K.pop(); for (const s of [-1, 1]) col(x + Math.cos(ry) * s * 2.2, z - Math.sin(ry) * s * 2.2, 0.3); },
  glowShroom(x, z, c){ const m = new THREE.Group(); m.position.set(x, 0, z); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.35, 6), smat('gstem', { color: 0xe8e0d0 })); st.position.y = 0.17; m.add(st); const cp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 6, 0, TAU, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); cp.position.y = 0.33; cp.scale.y = 0.6; m.add(cp); const g = glowSprite(c, 1.1, 0.5); g.position.y = 0.4; m.add(g); stageG.add(m); },
  picnic(x, z){ const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8).rotateX(-Math.PI / 2), smat('picnic', { map: checkTex(), roughness: 0.9 })); m.position.set(x, 0.06, z); m.rotation.y = 0.3; stageG.add(m); K.geo('wicker', G.latheG([[0, 0], [0.32, 0.02], [0.36, 0.3], [0, 0.3]], 12, 0.4), x + 0.5, 0.06, z); K.geo('fruitR', new THREE.SphereGeometry(0.1, 8, 6), x - 0.4, 0.15, z + 0.2); K.geo('bread', new THREE.CapsuleGeometry(0.08, 0.25, 4, 8), x - 0.2, 0.12, z - 0.3, 0, 0.5, Math.PI / 2); },
  altar(x, z){
    K.push(x, 0, z); K.geo('moss', new THREE.CylinderGeometry(3.8, 4.0, 0.45, 40), 0, 0.225, 0); K.geo('marble', new THREE.CylinderGeometry(2.7, 2.9, 0.45, 40), 0, 0.675, 0);
    K.geo('marble', G.latheG([[1.3, 0.9], [1.0, 1.1], [0.7, 1.3], [0.62, 2.0], [0.95, 2.25], [1.0, 2.4], [0, 2.4]], 32, 0.4)); K.geo('gold', new THREE.TorusGeometry(1.0, 0.04, 6, 40), 0, 2.4, 0, Math.PI / 2); K.pop(); col(x, z, 4.0);
    const g = new THREE.Group(); g.position.set(x, 4.3, z); stageG.add(g);
    const cg = new THREE.OctahedronGeometry(1, 0); cg.scale(0.55, 1.3, 0.55);
    const crys = new THREE.Mesh(cg, G.std({ color: 0xb8ffc8, emissive: 0x30e070, emissiveIntensity: 2.4, roughness: 0.08, flatShading: true, transparent: true, opacity: 0.92 })); g.add(crys);
    g.add(glowSprite(0x8aff9a, 7, 0.8)); const pl = new THREE.PointLight(0x7aff9a, 14, 22, 1.6); g.add(pl);
    stageAnims.push(dt => { crys.rotation.y += dt * 0.6; g.position.y = 4.3 + Math.sin(G.time * 1.1) * 0.2; });
    const rr1 = new THREE.Mesh(polarRing(5.0, 5.6, 64), ADDM(G.tex(G.runeStrip(1024, 128, 16, '#ffcf6a', 0, 3), true, 1, 1), 0.85)); rr1.position.set(x, 0.065, z); stageG.add(rr1);
  },
  waterfall(x, z, ry, w = 6, h = 7){
    K.push(x, 0, z, ry); for (let i = 0; i < 9; i++) K.geo('rock', new THREE.IcosahedronGeometry(rr(1.6, 2.6), 0), (i - 4) * 1.6 + rr(-0.4, 0.4), rr(1, h), -1.2 + rr(-0.5, 0.5), R(), R(), R()); K.pop();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.45, h), new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false,
      vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime; varying vec2 vU; float h(float x){ return fract(sin(x * 91.7) * 43758.5); } void main(){ float u = vU.x * 30.0, id = floor(u); float s = 0.55 + 0.45 * fract(vU.y * 3.0 + uTime * (1.5 + h(id)) + h(id) * 5.0); float edge = smoothstep(0.0, 0.12, vU.x) * smoothstep(1.0, 0.88, vU.x); gl_FragColor = vec4(mix(vec3(0.55, 0.8, 0.95), vec3(1.0), s * 0.6), 0.85 * edge); }` }));
    m.position.set(x, h / 2, z); m.rotation.y = ry; stageG.add(m); stageAnims.push(dt => { m.material.uniforms.uTime.value += dt; });
    P.pond(x + Math.sin(ry) * 2.2, z + Math.cos(ry) * 2.2, 2.4, false);
  },
};
let RUNETEX = {};
const runeTex = c => RUNETEX[c] || (RUNETEX[c] = G.tex(G.runeColumn(128, 1024, 8, c, 3), true, 1, 1));
let CHECK = null; const checkTex = () => CHECK || (CHECK = (() => { const c = G.cnv(64), x = c.getContext('2d'); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++){ x.fillStyle = (i + j) % 2 ? '#d83a3a' : '#f4ecd8'; x.fillRect(i * 8, j * 8, 8, 8); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t; })());
// 떠다니는 이펙트
function ambient(kind, n = 160, area = 26){
  const bases = []; for (let i = 0; i < n; i++) bases.push(new V3(rr(-area, area), rr(0.2, 4), rr(-area, area)));
  const V = {
    pollen: [`vec3 p = position + vec3(sin(uTime * 0.4 + aSeed * 50.0) * 1.5, sin(uTime * 0.6 + aSeed * 31.0) * 0.5, cos(uTime * 0.3 + aSeed * 70.0) * 1.5); vL = 0.6 + 0.4 * sin(uTime * 2.0 + aSeed * 40.0); float sz = 0.07;`, `vec3(1.0, 0.92, 0.5)`],
    spores: [`vec3 p = position + vec3(sin(uTime * 0.3 + aSeed * 50.0) * 2.0, fract(uTime * 0.04 + aSeed) * 5.0 - 2.0, cos(uTime * 0.25 + aSeed * 70.0) * 2.0); vL = 0.5 + 0.5 * sin(uTime * 1.5 + aSeed * 40.0); float sz = 0.12;`, `vec3(0.8, 0.55, 1.0)`],
    teal: [`vec3 p = position + vec3(sin(uTime * 0.3 + aSeed * 50.0) * 2.0, fract(uTime * 0.04 + aSeed) * 5.0 - 2.0, cos(uTime * 0.25 + aSeed * 70.0) * 2.0); vL = 0.5 + 0.5 * sin(uTime * 1.5 + aSeed * 40.0); float sz = 0.1;`, `vec3(0.45, 1.0, 0.9)`],
    fireflies: [`vec3 p = position + vec3(sin(uTime * 0.5 + aSeed * 50.0) * 1.5, sin(uTime * 0.8 + aSeed * 31.0) * 0.6, cos(uTime * 0.4 + aSeed * 70.0) * 1.5); vL = pow(0.5 + 0.5 * sin(uTime * (1.5 + fract(aSeed * 4.0) * 2.0) + aSeed * 90.0), 2.0); float sz = 0.12;`, `vec3(0.75, 1.0, 0.45)`],
    petals: [`float f = fract(uTime * 0.06 + aSeed); vec3 p = vec3(position.x + sin(uTime + aSeed * 30.0) * 1.5 + f * 4.0, 9.0 - f * 9.5, position.z + cos(uTime * 0.7 + aSeed * 20.0) * 1.5); vL = 1.0 - smoothstep(0.85, 1.0, f); float sz = 0.16;`, `vec3(1.0, 0.72, 0.82)`],
    leaves: [`float f = fract(uTime * 0.05 + aSeed); vec3 p = vec3(position.x + sin(uTime * 1.3 + aSeed * 30.0) * 1.2 + f * 3.0, 9.0 - f * 9.5, position.z + cos(uTime + aSeed * 20.0) * 1.2); vL = 1.0 - smoothstep(0.85, 1.0, f); float sz = 0.2;`, `mix(vec3(1.0, 0.45, 0.1), vec3(1.0, 0.8, 0.2), fract(vS * 7.0))`],
    rain: [`float f = fract(uTime * 0.9 + aSeed); vec3 p = vec3(position.x, 10.0 - f * 10.5, position.z); vL = 0.6; float sz = 0.09;`, `vec3(0.7, 0.8, 0.95)`],
    dust: [`vec3 p = position + vec3(uTime * 0.6 + sin(aSeed * 40.0) * 3.0, sin(uTime * 0.5 + aSeed * 31.0) * 0.4, cos(uTime * 0.2 + aSeed * 70.0) * 2.0); p.x = mod(p.x + 30.0, 60.0) - 30.0; vL = 0.4; float sz = 0.12;`, `vec3(0.95, 0.75, 0.55)`],
    wisps: [`vec3 p = position + vec3(sin(uTime * 0.3 + aSeed * 50.0) * 2.5, 1.0 + sin(uTime * 0.6 + aSeed * 31.0) * 0.8, cos(uTime * 0.25 + aSeed * 70.0) * 2.5); vL = 0.6 + 0.4 * sin(uTime * 2.0 + aSeed * 40.0); float sz = 0.3;`, `vec3(0.7, 0.95, 1.0)`],
    butter: [`vec3 p = position + vec3(sin(uTime * 0.7 + aSeed * 50.0) * 3.0, 0.5 + abs(sin(uTime * 6.0 + aSeed * 31.0)) * 0.3, cos(uTime * 0.5 + aSeed * 70.0) * 3.0); vL = 1.0; float sz = 0.2;`, `mix(vec3(1.0, 0.6, 0.9), vec3(0.6, 0.85, 1.0), fract(vS * 9.0))`],
  }[kind];
  G.particles(n, bases, { parent: stageG, vert: `vS = aSeed; ${V[0]}`, frag: `float a = smoothstep(0.5, 0.0, d) * vL; gl_FragColor = vec4(${V[1]} * a * 1.3, a);`, blend: kind === 'rain' || kind === 'petals' || kind === 'leaves' || kind === 'butter' ? THREE.NormalBlending : undefined });
}
// ── 지형 모양 ──
const LAYOUT = {
  circle: r => ({ shapes: [{ c: [0, 0, r] }], entry: [0, r - 2], boss: [0, -r * 0.45] }),
  oval: (a, r) => ({ shapes: [{ s: [-a, 0, a, 0, r] }], entry: [-a - r + 2.5, 0], boss: [a * 0.7, 0] }),
  lane: (a, r) => ({ shapes: [{ s: [-a, 0, a, 0, r] }], entry: [-a - r + 2, 0], boss: [a, 0] }),
  path: (pts, r) => { const sh = []; for (let i = 0; i < pts.length - 1; i++) sh.push({ s: [...pts[i], ...pts[i + 1], r] }); return { shapes: sh, entry: pts[0], boss: pts[pts.length - 1] }; },
  twin: (d, r, vert) => { const A = vert ? [0, d] : [-d, 0], Bp = vert ? [0, -d] : [d, 0]; return { shapes: [{ c: [...A, r] }, { c: [...Bp, r] }, { s: [...A, ...Bp, 3.4] }], entry: vert ? [0, d + r - 2] : [-d - r + 2, 0], boss: Bp }; },
  islands: (d, r) => ({ shapes: [{ c: [-d, 0, r] }, { c: [d, 0, r] }, { s: [-d + r - 1, -3.5, d - r + 1, -3.5, 1.6] }, { s: [-d + r - 1, 4, d - r + 1, 4, 1.6] }], entry: [-d - r + 2, 0], boss: [d, 0] }),
  clover: (d, r) => ({ shapes: [{ c: [0, 0, r] }, { c: [d, 0, r] }, { c: [-d, 0, r] }, { c: [0, d, r] }, { c: [0, -d, r] }], entry: [0, d + r - 2], boss: [0, -d] }),
  cross: (a, w) => ({ shapes: [{ s: [-a, 0, a, 0, w] }, { s: [0, -a, 0, a, w] }, { c: [0, 0, w + 2] }], entry: [0, a + w - 2], boss: [0, -a] }),
};
// ── 분위기 ──
const MOOD = {
  morning: { k: 0.5, mul: [1.05, 0.97, 0.92], add: [0.02, 0.015, 0], sun: [1, 0.86, 0.72], sunI: 2.8, fog: [0.55, 0.6, 0.66], fogD: 0.009, exp: 0.95, dir: [-0.6, 0.32, 0.7] },
  noon: { k: 0, fogD: 0.006, dir: [-0.4, 0.75, 0.3], sunI: 3.3 },
  golden: { k: 0.6, mul: [1.2, 0.92, 0.65], add: [0.04, 0.02, 0], sun: [1, 0.76, 0.48], sunI: 3.0, fog: [0.62, 0.52, 0.42], fogD: 0.008, dir: [-0.8, 0.24, 0.5] },
  sunset: { k: 0.85, mul: [1.35, 0.72, 0.52], add: [0.06, 0.012, 0], sun: [1, 0.56, 0.32], sunI: 2.6, hemiC: 0xffb890, fog: [0.55, 0.36, 0.3], fogD: 0.009, exp: 0.9, dir: [-0.9, 0.13, 0.3] },
  dusk: { k: 0.7, mul: [0.62, 0.56, 0.86], add: [0.03, 0.01, 0.06], sun: [0.72, 0.62, 1], sunI: 1.4, hemi: 0.32, hemiC: 0x9a8ad0, fog: [0.2, 0.2, 0.32], fogD: 0.012, exp: 0.86, dir: [-0.7, 0.2, -0.5] },
  mist: { k: 0.45, mul: [1, 1, 1.04], add: [0.08, 0.08, 0.09], sun: [0.92, 0.92, 0.96], sunI: 1.7, fog: [0.62, 0.66, 0.7], fogD: 0.028, exp: 0.95 },
  purple: { k: 0.65, mul: [0.86, 0.7, 1.0], add: [0.05, 0.02, 0.08], sun: [0.9, 0.75, 1], sunI: 1.7, hemiC: 0xc8a0ff, fog: [0.36, 0.28, 0.44], fogD: 0.022, exp: 0.9 },
  night: { k: 1, mul: [0.15, 0.18, 0.36], add: [0.004, 0.01, 0.03], sun: [0.5, 0.62, 1], sunI: 0.75, hemi: 0.28, hemiC: 0x6a8ad0, fog: [0.03, 0.05, 0.09], fogD: 0.02, exp: 0.82, dir: [0.4, 0.5, -0.6], env: 0.35 },
  overcast: { k: 0.55, mul: [0.8, 0.82, 0.86], add: [0.06, 0.06, 0.065], sun: [0.85, 0.88, 0.92], sunI: 1.5, fog: [0.5, 0.52, 0.55], fogD: 0.014, exp: 0.95 },
  pink: { k: 0.6, mul: [1.2, 0.85, 1.0], add: [0.05, 0.02, 0.04], sun: [1, 0.78, 0.82], sunI: 2.3, hemiC: 0xffc0d8, fog: [0.62, 0.5, 0.56], fogD: 0.01, dir: [-0.7, 0.28, 0.4] },
  teal: { k: 0.6, mul: [0.72, 0.95, 1.0], add: [0, 0.04, 0.05], sun: [0.75, 0.95, 1], sunI: 1.6, hemiC: 0x8ad8e0, fog: [0.24, 0.4, 0.42], fogD: 0.016, exp: 0.9 },
};
// ── 20개 스테이지 맵 ──
const GROUND = (tex, color) => G.std({ map: tex, color, roughness: 1 });
const MAPS = [
  { name: '야영지 숲', mood: 'morning', L: () => LAYOUT.circle(12), ground: () => GROUND(G.T.grass, 0x74885c), floor: () => GROUND(TX.dirt, 0xffffff),
    build(L){ forest({ pine: 7, bush: 2, oak: 1 }); P.tent(-6, -3, 0.5, 'tentA'); P.tent(6.2, -4.5, -0.6, 'tentB'); P.campfire(0, -1.5); P.log(-2.7, 0.2, 0.3); P.log(2.7, 0.4, -0.3); P.log(0, -4.3, 1.57);
      P.crate(-7.5, 3.5); P.crate(-6.8, 4.4, 0.55); P.stump(7.5, 3.5); for (const [x, z] of [[-10, -2], [10, -1], [-8, 7], [8, 7.5]]) P.lantern(x, z); ambient('pollen', 80); } },
  { name: '꽃 풀밭과 연못', mood: 'noon', L: () => LAYOUT.oval(8, 9), ground: () => GROUND(TX.meadow, 0xffffff), floor: () => GROUND(G.T.grass, 0xb0d890),
    build(){ forest({ oak: 5, bush: 3, birch: 2 }); P.pond(9, -5.5, 2.6); P.haystack(-9, -5); P.haystack(-11, 4); P.fence(-16, 8.5, -6, 9.5); P.fence(6, 9.5, 15, 8);
      for (let i = 0; i < 160; i++){ const p = randIn(0.5); if (p) K.geo(['flower', 'flowerY', 'rose'][i % 3], new THREE.IcosahedronGeometry(rr(0.07, 0.12), 0), p[0], 0.08, p[1]); } ambient('butter', 40); ambient('pollen', 60); } },
  { name: '거대 버섯 숲길', mood: 'teal', L: () => LAYOUT.path([[-17, 7], [-7, -2], [3, 5], [15, -4]], 4.3), ground: () => GROUND(TX.moss, 0xb0c0b0), floor: () => GROUND(TX.moss, 0xd8e8c0),
    build(){ forest({ shroomT: 6, pine: 2, bush: 2 }, { tint: k => k === 'shroomT' ? pick([0xff6a5a, 0xffa040, 0x9a7aff, 0x5ad0c0, 0xff8ad0]) : undefined });
      for (let i = 0; i < 40; i++){ const p = randIn(-0.5); if (p && outDist(p[0], p[1], 3) > 0) P.glowShroom(p[0], p[1], pick([0x7affd0, 0x9affff, 0xc08aff])); } ambient('teal', 160); } },
  { name: '꿀벌 마을 꽃밭', mood: 'golden', L: () => LAYOUT.twin(9, 8), ground: () => GROUND(TX.meadow, 0xfff0c0), floor: () => GROUND(TX.sand, 0xffffff),
    build(){ forest({ sunflower: 5, oak: 3, bush: 2 }, { gap: 0.8 }); for (const [x, z] of [[-13, -5], [-14, 3], [12, 6], [14, -3], [-6, 6.5], [6, -6.5]]) P.skep(x, z); P.hiveBox(-4, -6, 0.3); P.hiveBox(4.5, 6.5, -0.2);
      P.fence(-16, -8, -6, -9); P.fence(6, 9, 16, 8); for (let i = 0; i < 120; i++){ const p = randIn(0.6); if (p) K.geo(['flowerY', 'flower'][i % 2], new THREE.IcosahedronGeometry(rr(0.08, 0.13), 0), p[0], 0.08, p[1]); } ambient('pollen', 140); } },
  { name: '보라 포자 숲', mood: 'purple', L: () => LAYOUT.circle(14), ground: () => GROUND(TX.moss, 0x9a80b0), floor: () => GROUND(TX.moss, 0xc0a0d0),
    build(){ forest({ shroomT: 8, pine: 2 }, { scale: 1.2, tint: k => k === 'shroomT' ? pick([0xb05ae0, 0x8a4ad0, 0xe07ad8, 0x6a3ab0]) : undefined });
      for (let i = 0; i < 10; i++){ const a = i / 10 * TAU; plant([[Math.cos(a) * 11, Math.sin(a) * 11, 0.55, R() * 3, pick([0xc06aff, 0xff7ae0])]], 'shroomT'); col(Math.cos(a) * 11, Math.sin(a) * 11, 0.5); }
      for (let i = 0; i < 30; i++){ const p = randIn(1); if (p) P.glowShroom(p[0], p[1], pick([0xd08aff, 0xff9af0])); } ambient('spores', 260); } },
  { name: '도토리 언덕의 큰 참나무', mood: 'golden', L: () => LAYOUT.circle(13), ground: () => GROUND(G.T.grass, 0x8aa060), floor: () => GROUND(TX.dirt, 0xd8c8a0),
    build(){ forest({ oak: 7, bush: 3 }); P.giantOak(0, 0, 1.0); for (const [x, z] of [[-8, 6], [8, -6], [-9, -5]]) P.stump(x, z, 0.6); for (let i = 0; i < 40; i++){ const p = randIn(0.5); if (p) K.geo('acorn', new THREE.SphereGeometry(0.12, 6, 5), p[0], 0.1, p[1], 0, 0, 0, 1, 1.2, 1); } ambient('pollen', 60); } },
  { name: '진흙탕 숲길', mood: 'overcast', L: () => LAYOUT.lane(14, 6), ground: () => GROUND(G.T.grass, 0x6a7a50), floor: () => GROUND(TX.mud, 0xffffff),
    build(){ forest({ birch: 5, berry: 3, oak: 2 }); for (let i = 0; i < 9; i++){ const p = randIn(1); if (p) P.puddle(p[0], p[1], rr(0.8, 1.8)); } P.fence(-18, 7.5, -8, 6.8); P.fence(-3, 7.2, 4, 7.6); P.fence(8, -7.4, 17, -6.8); P.log(-4, -4, 0.4, 2.6); P.log(9, 3.5, -0.2, 2.2); ambient('rain', 400, 22); } },
  { name: '끝없는 꽃바다와 풍차', mood: 'noon', L: () => LAYOUT.oval(7, 12), ground: () => GROUND(TX.meadow, 0xffffff), floor: () => GROUND(TX.meadow, 0xe8ffd8),
    build(){ forest({ oak: 3, bush: 4, birch: 1 }, { dens: 0.6 }); P.windmill(0, -24);
      const fl = []; for (let i = 0; i < 900; i++){ const x = rr(-30, 30), z = rr(-30, 30); fl.push([x, z]); } const ims = {}; for (const [x, z] of fl){ const k = pick(['flower', 'flowerY', 'rose', 'flowerW']); (ims[k] = ims[k] || []).push([x, z]); }
      const fg = new THREE.IcosahedronGeometry(0.12, 0); for (const k in ims){ const im = new THREE.InstancedMesh(fg, MC[k] || M[k] || MATS2[k], ims[k].length); ims[k].forEach(([x, z], i) => im.setMatrixAt(i, G.mat(x, 0.12, z))); stageG.add(im); } ambient('butter', 80, 20); } },
  { name: '이끼 바위 협곡과 폭포', mood: 'mist', L: () => LAYOUT.cross(14, 4), ground: () => GROUND(TX.moss, 0x9aa890), floor: () => GROUND(G.T.stone, 0xb8c0b0),
    build(){ forest({ boulder: 5, pine: 5 }, { gap: 0.6, scale: 1.3 }); P.waterfall(0, -22, 0, 6, 8); for (let i = 0; i < 8; i++){ const p = randIn(2, [[0, 0, 4]]); if (p) P.rock(p[0], p[1], rr(0.6, 1.1)); } ambient('teal', 80); } },
  { name: '여왕벌의 황금 정원', mood: 'golden', L: () => LAYOUT.circle(15), ground: () => GROUND(G.T.grass, 0x8aa858), floor: () => GROUND(G.T.cobble, 0xf0e0b0),
    build(){ forest({ oak: 4, sunflower: 4, bush: 2 }); for (let i = 0; i < 8; i++){ const a0 = i / 8 * TAU + 0.15, a1 = a0 + 0.55; P.hedge(Math.cos(a0) * 16.2, Math.sin(a0) * 16.2, Math.cos(a1) * 16.2, Math.sin(a1) * 16.2); }
      P.honeycomb(0, -21, 1.3); for (const a of [0.8, 2.35, 3.9, 5.5]) P.arch(Math.cos(a) * 9, Math.sin(a) * 9, -a + Math.PI / 2, 2.6); for (let i = 0; i < 6; i++){ const a = i / 6 * TAU; plant([[Math.cos(a) * 12.5, Math.sin(a) * 12.5, 0.8]], 'sunflower'); } ambient('pollen', 200); } },
  { name: '개울가 소풍', mood: 'noon', L: () => LAYOUT.islands(10, 8), ground: () => GROUND(G.T.grass, 0x86a868), floor: () => GROUND(G.T.grass, 0xc8e0a0),
    build(){ forest({ willow: 4, oak: 3, reed: 3 }); P.river(0, -34, 0, 34, 4.6); P.bridge(-3.2, -3.5, 3.2, -3.5, 2.4); P.bridge(-3.2, 4, 3.2, 4, 2.4); for (let i = 0; i < 18; i++) plant([[rr(-3.5, -2.6) * (R() < 0.5 ? 1 : -1), rr(-14, 14), rr(0.7, 1.1)]], 'reed');
      P.picnic(-12, 3); for (let i = 0; i < 40; i++){ const p = randIn(0.5); if (p) K.geo('flowerY', new THREE.IcosahedronGeometry(0.08, 0), p[0], 0.08, p[1]); } ambient('butter', 30); } },
  { name: '자작나무 정령 숲', mood: 'teal', L: () => LAYOUT.clover(8.5, 6.2), ground: () => GROUND(TX.moss, 0xa8c8c0), floor: () => GROUND(TX.moss, 0xd0f0e0),
    build(){ forest({ birch: 8, bush: 2 }, { gap: 0.8 }); for (const [x, z] of [[4.5, 4.5], [-4.5, 4.5], [4.5, -4.5], [-4.5, -4.5]]) P.stoneLantern(x, z, 0x9affea); ambient('wisps', 40, 14); ambient('teal', 80); } },
  { name: '가시덤불 미로', mood: 'overcast', L: () => LAYOUT.path([[-16, -8], [-6, 5], [3, -6], [15, 6]], 4.6), ground: () => GROUND(TX.darksoil, 0xffffff), floor: () => GROUND(TX.dirt, 0x9a8a70),
    build(){ forest({ bramble: 6, bare: 4 }, { gap: 0.4 }); for (let i = 0; i < 6; i++){ const p = randIn(2); if (p) P.rock(p[0], p[1], rr(0.5, 0.8)); } ambient('leaves', 80); } },
  { name: '노을 진 선돌 들판', mood: 'sunset', L: () => LAYOUT.circle(14), ground: () => GROUND(TX.heather, 0xffffff), floor: () => GROUND(TX.heather, 0xd8c8c8),
    build(){ forest({ pine: 5, boulder: 3, bush: 2 }); for (let i = 0; i < 8; i++){ const a = i / 8 * TAU + 0.2; P.menhir(Math.cos(a) * 8.5, Math.sin(a) * 8.5, rr(3, 5), a, '#ffb070'); } P.rock(0, 0, 1.2); ambient('dust', 60); } },
  { name: '붉은 바위 협곡', mood: 'sunset', L: () => LAYOUT.lane(16, 7), ground: () => GROUND(TX.redrock, 0xffffff), floor: () => GROUND(TX.sand, 0xe8b890),
    build(){ forest({ redrock: 8, bare: 2 }, { gap: 0.3, scale: 1.4 }); for (let i = 0; i < 6; i++){ const p = randIn(2.5, [[-14, 0, 4], [16, 0, 5]]); if (p) P.rock(p[0], p[1], rr(0.5, 0.9)); } ambient('dust', 160, 30); } },
  { name: '고목의 거대한 뿌리', mood: 'dusk', L: () => LAYOUT.circle(13), ground: () => GROUND(TX.darksoil, 0xffffff), floor: () => GROUND(TX.leaves, 0x8a7a60),
    build(){ forest({ oak: 5, pine: 3, bare: 2 }, { scale: 1.3, tint: k => k === 'oak' ? 0x2a5a24 : undefined }); for (let i = 0; i < 5; i++){ const a = i / 5 * TAU + 0.4; P.rootArch(Math.cos(a) * 7, Math.sin(a) * 7, -a, 3.2); }
      for (let i = 0; i < 20; i++){ const p = randIn(0.5); if (p) P.glowShroom(p[0], p[1], 0xaaff7a); } ambient('fireflies', 80); } },
  { name: '반딧불 연못의 밤', mood: 'night', L: () => LAYOUT.circle(14), ground: () => GROUND(G.T.grass, 0x3a5040), floor: () => GROUND(G.T.grass, 0x5a7058),
    build(){ forest({ pine: 5, oak: 4, reed: 1 }); P.pond(0, 0, 5); for (let i = 0; i < 12; i++) plant([[Math.cos(i * 0.52) * 5.6, Math.sin(i * 0.52) * 5.6, 0.8]], 'reed'); for (let i = 0; i < 40; i++){ const p = randIn(0.5, [[0, 0, 6]]); if (p) P.glowShroom(p[0], p[1], pick([0x7affd0, 0xaaff7a, 0x9ad0ff])); }
      for (const a of [0.5, 2.1, 3.7, 5.3]) P.stoneLantern(Math.cos(a) * 12, Math.sin(a) * 12, 0xffd080); ambient('fireflies', 300, 22); } },
  { name: '단풍 숲의 수확제', mood: 'golden', L: () => LAYOUT.twin(9, 9, true), ground: () => GROUND(TX.leaves, 0xffffff), floor: () => GROUND(TX.leaves, 0xffe0c0),
    build(){ forest({ tint: 8, bare: 1, bush: 1 }, { tint: k => k === 'tint' ? pick([0xff6a20, 0xe8401a, 0xffb020, 0xd02a1a, 0xffd040]) : undefined }); for (let i = 0; i < 14; i++){ const p = randIn(1.5); if (p) P.pumpkin(p[0], p[1], rr(0.35, 0.6)); } P.haystack(-6, 12); P.haystack(6, -12); ambient('leaves', 220); } },
  { name: '벚꽃 신사', mood: 'pink', L: () => LAYOUT.circle(14), ground: () => GROUND(TX.petals, 0xffffff), floor: () => GROUND(G.T.cobble, 0xf0d8e0),
    build(){ forest({ tint: 8, pine: 2 }, { tint: k => k === 'tint' ? pick([0xffb8d0, 0xff9ac0, 0xffe0ec, 0xf8a8c8]) : undefined }); P.gate(0, 12.5, 0); for (const a of [0.5, 1.5, 2.6, 3.7, 4.7, 5.7]) P.stoneLantern(Math.cos(a) * 11.5, Math.sin(a) * 11.5, 0xffc0d0); ambient('petals', 300); } },
  { name: '천년 고목의 성소', mood: 'golden', L: () => LAYOUT.circle(17), ground: () => GROUND(G.T.grass, 0x74885c), floor: () => GROUND(G.T.cobble, 0xa29c8e),
    build(){ forest({ pine: 4, oak: 6 }, { scale: 1.4 }); P.altar(0, 0); for (let i = 0; i < 14; i++){ const a = i / 14 * TAU + 0.11; if (Math.abs(angDiff(a, Math.PI / 2)) < 0.3) continue; P.menhir(Math.cos(a) * 18.2, Math.sin(a) * 18.2, rr(3.4, 5.8), a); }
      for (let i = 0; i < 8; i++){ const a = i / 8 * TAU + 0.35; if (Math.abs(angDiff(a, Math.PI / 2)) < 0.35) continue; if (i % 3 === 1) P.fallenColumn(Math.cos(a) * 11, Math.sin(a) * 11, -a + 0.5); else P.column(Math.cos(a) * 10.6, Math.sin(a) * 10.6, rr(1.8, 5)); }
      const rr1 = new THREE.Mesh(polarRing(13.4, 14.5), ADDM(G.tex(G.runeStrip(2048, 128, 36, '#7dffb0', 0, 7), true, 1, 1), 0.9)); rr1.position.y = 0.06; stageG.add(rr1); ambient('fireflies', 120); } },
];
// 맵 이름 순서 = 스테이지 1 ~ 20 (아래 STAGES 의 map 인덱스로 연결)
let stageG = null, stageAnims = [], stageL = null;
function disposeStage(){ if (!stageG) return; SW.remove(stageG); stageG.traverse(o => { if (o.geometry && !Object.values(TG).includes(o.geometry)) o.geometry.dispose(); }); stageG = null; }
function buildStage(idx){
  disposeStage(); stageAnims = []; SCOL.length = 0;
  const def = MAPS[idx];
  stageG = new THREE.Group(); SW.add(stageG);
  stageL = def.L(); SHAPES = stageL.shapes;
  B = new G.Builder(); K = new G.Kit(B);
  const ground = new THREE.Mesh(meterUV(new THREE.PlaneGeometry(300, 300).rotateX(-Math.PI / 2)), def.ground()); ground.receiveShadow = true; stageG.add(ground);
  const fm = def.floor(), fl = [];
  SHAPES.forEach((sh, i) => { const y = 0.02 + i * 0.002;
    if (sh.c){ const m = new THREE.Mesh(meterUV(new THREE.CircleGeometry(sh.c[2] + 0.6, 48).rotateX(-Math.PI / 2)), fm); m.position.set(sh.c[0], y, sh.c[1]); stageG.add(m); fl.push(m); }
    else { const [ax, az, bx, bz, r] = sh.s, L0 = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az); const pl = new THREE.Mesh(new THREE.PlaneGeometry((r + 0.6) * 2, L0).rotateX(-Math.PI / 2), fm); pl.position.set((ax + bx) / 2, y, (az + bz) / 2); pl.rotation.y = ry; meterUV(pl.geometry); stageG.add(pl); fl.push(pl);
      for (const [cx, cz] of [[ax, az], [bx, bz]]){ const m = new THREE.Mesh(meterUV(new THREE.CircleGeometry(r + 0.6, 36).rotateX(-Math.PI / 2)), fm); m.position.set(cx, y + 0.001, cz); stageG.add(m); fl.push(m); } } });
  for (const m of fl) m.receiveShadow = true;
  // 경계: 돌 · 덤불
  for (let i = 0; i < 70; i++){ const x = rr(-40, 40), z = rr(-40, 40), od = outDist(x, z); if (od < 0.3 || od > 1.6) continue; if (R() < 0.5) K.geo('rock', new THREE.IcosahedronGeometry(rr(0.25, 0.6), 0), x, 0.1, z, R(), R(), R(), 1, 0.7, 1); else plant([[x, z, rr(0.5, 0.9)]], 'bush'); }
  def.build(stageL);
  B.build(Object.assign({}, M, MATS2), stageG);
  G.setMood(MOOD[def.mood]);
  drawStageMap();
  G.resize();
}
function drawStageMap(){
  const c = storyArea.mapBase, x = c.getContext('2d'), k = 256 / storyArea.mapR, C0 = 256;
  x.fillStyle = '#1a2a18'; x.fillRect(0, 0, 512, 512); x.fillStyle = '#7a6a50';
  for (const sh of SHAPES){ x.beginPath(); if (sh.c) x.arc(C0 + sh.c[0] * k, C0 + sh.c[1] * k, sh.c[2] * k, 0, TAU); else { x.lineCap = 'round'; x.lineWidth = sh.s[4] * 2 * k; x.strokeStyle = '#7a6a50'; x.moveTo(C0 + sh.s[0] * k, C0 + sh.s[1] * k); x.lineTo(C0 + sh.s[2] * k, C0 + sh.s[3] * k); x.stroke(); continue; } x.fill(); }
  x.fillStyle = '#3a3a34'; for (const o of SCOL) if (o.t === 'c'){ x.beginPath(); x.arc(C0 + o.x * k, C0 + o.z * k, Math.max(2, o.r * k), 0, TAU); x.fill(); }
  G.resize();
}
const MATS2 = {
  moss: G.std({ map: G.T.stone, color: 0x8e9a80, roughness: 0.95, side: THREE.DoubleSide }),
  tentA: G.std({ map: G.T.plaster, color: 0xc9b48a, roughness: 0.95, side: THREE.DoubleSide }), tentB: G.std({ map: G.T.plaster, color: 0x8a4a3a, roughness: 0.95, side: THREE.DoubleSide }),
  rock: G.std({ color: 0x7a7870, roughness: 0.95, flatShading: true, side: THREE.DoubleSide }), hedge: G.std({ color: 0x2f6a2a, roughness: 0.95, flatShading: true }),
  rose: G.std({ color: 0xd02a4a, roughness: 0.6 }), flowerW: G.std({ color: 0xffffff, roughness: 0.6 }), honey: G.std({ color: 0xf0b030, roughness: 0.35, emissive: 0x6a3a00, emissiveIntensity: 0.3 }), honey2: G.std({ color: 0xd89020, roughness: 0.4 }),
  bark: G.std({ map: G.T.wood, color: 0x6a4a30, roughness: 0.95, side: THREE.DoubleSide }), pumpkin: G.std({ color: 0xe8781a, roughness: 0.6 }), acorn: G.std({ color: 0x9a6a2e, roughness: 0.6 }),
  lacquer: G.std({ color: 0xc8301e, roughness: 0.4 }),
};

// ───────────────────────── 파티클 (CPU) ─────────────────────────
const PN = 700, pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pSz = new Float32Array(PN), pAl = new Float32Array(PN), PL = [];
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('aCol', new THREE.BufferAttribute(pCol, 3)); pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSz, 1)); pGeo.setAttribute('aAlpha', new THREE.BufferAttribute(pAl, 1));
const pMat = new THREE.ShaderMaterial({
  uniforms: { uScale: { value: 400 } },
  vertexShader: `attribute vec3 aCol; attribute float aSize, aAlpha; uniform float uScale; varying vec3 vC; varying float vA;
    void main(){ vC = aCol; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / -mv.z; }`,
  fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vC * a * 1.6, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const pts = new THREE.Points(pGeo, pMat); pts.frustumCulled = false; SW.add(pts);
for (let i = 0; i < PN; i++) pAl[i] = 0;
const _c = new THREE.Color();
function burst(p, color, n, sp = 4, size = 0.25, life = 0.7, grav = -4, up = 1.5){
  _c.set(color); const gy = GY(p.x, p.z);
  for (let k = 0; k < n; k++){
    if (PL.length >= PN) PL.shift();
    const a = R() * TAU, e = rr(-0.3, 1), s = sp * rr(0.3, 1);
    PL.push({ x: p.x, y: p.y + gy, z: p.z, vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s + up * rr(0.5, 1), vz: Math.sin(a) * Math.cos(e) * s, life: life * rr(0.6, 1.2), t: 0, size: size * rr(0.6, 1.3), r: _c.r, g: _c.g, b: _c.b, grav });
  }
}
function updateParticles(dt){
  for (let i = PL.length - 1; i >= 0; i--){ const p = PL[i]; p.t += dt; if (p.t >= p.life){ PL.splice(i, 1); continue; } p.vy += p.grav * dt; const dr = Math.exp(-2.2 * dt); p.vx *= dr; p.vz *= dr; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0.05){ p.y = 0.05; p.vy *= -0.3; } }
  for (let i = 0; i < PN; i++){
    const p = PL[i];
    if (!p){ pAl[i] = 0; continue; }
    pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z; pCol[i * 3] = p.r; pCol[i * 3 + 1] = p.g; pCol[i * 3 + 2] = p.b;
    const k = p.t / p.life; pSz[i] = p.size * (1 - k * 0.5); pAl[i] = (1 - k) * Math.min(1, p.t * 20);
  }
  for (const a of ['position', 'aCol', 'aSize', 'aAlpha']) pGeo.attributes[a].needsUpdate = true;
  pMat.uniforms.uScale.value = innerHeight * G.renderer.getPixelRatio() * 0.5 / Math.tan(G.camera.fov * Math.PI / 360);
}

// ───────────────────────── 공용 이펙트 ─────────────────────────
const _p = new V3();
function toScreen(v){ _p.set(v.x, v.y + GY(v.x, v.z), v.z).project(G.camera); return { x: (_p.x * 0.5 + 0.5) * innerWidth, y: (-_p.y * 0.5 + 0.5) * innerHeight, vis: _p.z < 1 && _p.z > -1 }; }
function dmgNum(pos, text, cls){
  const s = toScreen(pos); if (!s.vis) return;
  const d = document.createElement('div'); d.className = 'd ' + (cls || ''); d.textContent = text; d.style.left = s.x + 'px'; d.style.top = s.y + 'px'; ehp.appendChild(d); setTimeout(() => d.remove(), 1000);
}
const glowSprite = (color, scale, op = 0.8) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.glowT, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op })); s.scale.set(scale, scale, 1); return s; };
// 검기 궤적
const trailMat = () => new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(0x9ff6ff) } },
  vertexShader: `attribute vec2 aUV; varying vec2 vU; void main(){ vU = aUV; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uT; uniform vec3 uC; varying vec2 vU; void main(){ float a = pow(vU.y, 3.0) * smoothstep(0.0, 0.25, vU.x) * smoothstep(1.0, 0.75, vU.x) * (1.0 - uT); gl_FragColor = vec4(mix(uC, vec3(1.0), vU.y * vU.y) * a * 1.6, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
function arcGeo(r0, r1, span){
  const n = 28, P = [], U = [], I = [];
  for (let i = 0; i <= n; i++){ const f = i / n, a = -span / 2 + span * f; for (const [r, v] of [[r0, 0], [r1, 1]]){ P.push(Math.sin(a) * r, 0, Math.cos(a) * r); U.push(f, v); } }
  for (let i = 0; i < n; i++){ const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aUV', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); return g;
}
const ARC = arcGeo(0.5, 2.3, 2.4), ARC360 = arcGeo(0.5, 2.5, TAU * 0.98);
const FXL = [];   // {obj, t, life, upd}
function trail(ry, y, tilt, full, color){
  const m = new THREE.Mesh(full ? ARC360 : ARC, trailMat()); m.material.uniforms.uC.value.set(color || 0x9ff6ff);
  m.position.set(player.pos.x, PY() + y, player.pos.z); m.rotation.set(0, ry, 0); m.rotateZ(tilt); SW.add(m);
  FXL.push({ obj: m, t: 0, life: 0.22, upd(k){ m.material.uniforms.uT.value = k; m.scale.setScalar(0.9 + k * 0.25); } });
}
// 지면 텔레그래프 (빨간 경고)
const teleMat = () => new THREE.ShaderMaterial({
  uniforms: { uP: { value: 0 }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uP, uTime; varying vec2 vU; void main(){ float r = length(vU - 0.5) * 2.0; float edge = smoothstep(0.9, 0.97, r) * smoothstep(1.01, 0.97, r); float fill = step(r, uP) * 0.35; float a = (edge * 0.9 + fill + 0.12) * (0.75 + 0.25 * sin(uTime * 20.0)); gl_FragColor = vec4(vec3(1.0, 0.15, 0.25) * a, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
function telegraph(x, z, r, ry = 0, span = TAU){
  const g = new THREE.CircleGeometry(r, 48, -span / 2 - Math.PI / 2, span); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, teleMat()); m.position.set(x, 0.08, z); m.rotation.y = ry; m.renderOrder = 3; SW.add(m); return m;
}
// 충격파 고리
const ringMat = color => new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(color) } },
  vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uT; uniform vec3 uC; varying vec2 vU; void main(){ float r = length(vU - 0.5) * 2.0; float a = smoothstep(0.55, 0.95, r) * smoothstep(1.0, 0.95, r) * (1.0 - uT); float rays = 0.6 + 0.4 * sin(atan(vU.y - 0.5, vU.x - 0.5) * 24.0); gl_FragColor = vec4(mix(uC, vec3(1.0), 0.3) * a * rays * 2.0, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
function shockwave(x, y, z, R0, color, life = 0.55){
  const g = new THREE.PlaneGeometry(2, 2); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, ringMat(color)); m.position.set(x, y, z); SW.add(m);
  FXL.push({ obj: m, t: 0, life, upd(k){ m.material.uniforms.uT.value = k; m.scale.setScalar(0.3 + R0 * ease(Math.min(1, k * 1.4))); } });
}
function updateFXL(dt){
  for (let i = FXL.length - 1; i >= 0; i--){ const f = FXL[i]; f.t += dt; const k = Math.min(1, f.t / f.life); f.upd(k); if (k >= 1){ SW.remove(f.obj); f.obj.geometry !== ARC && f.obj.geometry !== ARC360 && f.obj.geometry.dispose(); f.obj.material.dispose(); FXL.splice(i, 1); } }
}


// ───────────────────────── 검 ─────────────────────────
function makeSword(scale = 1, color = 0x8ff4ff){
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.0, 0.018), M.steel); blade.position.y = 0.62; g.add(blade);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.053, 0.16, 4), M.steel); tip.scale.z = 0.25; tip.position.y = 1.2; tip.rotation.y = Math.PI / 4; g.add(tip);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.028, 0.92), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  glow.position.set(0, 0.62, 0.011); g.add(glow); const glow2 = glow.clone(); glow2.position.z = -0.011; g.add(glow2);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.08), M.gold); guard.position.y = 0.11; g.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.22, 8), M.woodD); grip.position.y = -0.01; g.add(grip);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), M.gold); pom.position.y = -0.13; g.add(pom);
  g.scale.setScalar(scale);
  g.traverse(o => { if (o.isMesh && o.material !== glow.material) o.castShadow = true; });
  g.userData.glow = glow.material;
  return g;
}
let sword = null;
function giveSword(){
  if (!sword){ equipJob(); refreshSkbar(); }
  document.body.classList.add('combat');
  $('keys').innerHTML = '<b>WASD</b> 이동 &nbsp; <b>J</b>/클릭 공격 &nbsp; <b>K</b>/우클릭 구르기 &nbsp; <b>1~4</b> 스킬 &nbsp; <b>R</b> 룬 &nbsp; <b>V</b> 직업 &nbsp; <b>C</b> 스탯 &nbsp; <b>Space</b> 점프';
  $('keys').style.opacity = 1;
}


// ───────────────────────── 스토리 NPC ─────────────────────────
// 룬 지기 엘드라 (숲 입구 야영지)
const keeper = new G.Figure(G.CLAY, 0.9);
{
  const robe = new THREE.Mesh(new THREE.LatheGeometry([[0.0, 0.06], [0.24, 0.05], [0.29, -0.2], [0.37, -0.6], [0.43, -0.82], [0.0, -0.82]].map(p => new THREE.Vector2(p[0], p[1])), 24), M.cloth2);
  robe.material = M.cloth2; robe.castShadow = true; keeper.hips.add(robe);
  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 6, 24), M.gold); sash.rotation.x = Math.PI / 2; sash.position.y = 0.06; keeper.hips.add(sash);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.245, 20, 12, 0, TAU, 0, Math.PI * 0.6), M.cloth2); hood.position.set(0, 0.19, -0.02); hood.castShadow = true; keeper.head.add(hood);
  const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.36, 0.7, 16, 1, true, Math.PI * 0.55, Math.PI * 0.9), M.cloth2); cape.position.y = 0.32; keeper.spine.add(cape);
  const staff = new THREE.Group(); staff.position.set(0, -0.36, 0.02); staff.rotation.x = 1.15; keeper.elR.add(staff);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 2.2, 6), M.woodD); sh.position.y = 0.45; staff.add(sh);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshBasicMaterial({ color: 0x9ff6ff, toneMapped: false })); gem.position.y = 1.65; gem.scale.y = 1.5; staff.add(gem);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.015, 6, 20), M.gold); ring.position.y = 1.65; staff.add(ring);
  const gl = glowSprite(0x66e8ff, 1.3, 0.8); gl.position.y = 1.65; staff.add(gl);
  keeper.root.position.set(4.5, 0.04, 51.5); keeper.root.rotation.y = Math.PI * 1.1; SW.add(keeper.root);
}
const keeperCol = { t: 'c', x: 4.5, z: 51.5, r: 0.45 }; SCOL.push(keeperCol);
const KEEPER_POSE = G.pose({ rax: -0.2, re: -0.95, raz: -0.12, lax: -0.15, laz: 0.12, le: -0.3, hd: 0.05 });
// 대장장이 브론
let smith = null, anvilTop = null;
if (FX.smithy){
  const { x, z, ry } = FX.smithy, L = (lx, lz) => new V3(x + lx * Math.cos(ry) + lz * Math.sin(ry), 0.04, z - lx * Math.sin(ry) + lz * Math.cos(ry));
  smith = new G.Figure(G.CLAY_B, 0.95);
  const p = L(1.35, 2.85); anvilTop = L(0.25, 3.2); anvilTop.y = 1.3;
  smith.root.position.copy(p); smith.root.rotation.y = Math.atan2(anvilTop.x - p.x, anvilTop.z - p.z);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.04), M.woodD); apron.position.set(0, 0.28, 0.17); smith.spine.add(apron);
  const ham = new THREE.Group(); ham.position.set(0, -0.36, 0.02); ham.rotation.x = Math.PI / 2; smith.elR.add(ham);
  const hh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6), M.wood); hh.position.y = 0.15; ham.add(hh);
  const hd = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.11), M.iron); hd.position.y = 0.38; ham.add(hd);
  G.world.add(smith.root);
}
const SMITH_IDLE = G.pose({ rax: -0.6, re: -0.9, lax: -0.6, le: -0.9, sp: 0.2 });

// 마커 (머리 위 ◆)
const markerTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.shadowColor = '#ffcf5a'; x.shadowBlur = 24; x.fillStyle = '#ffe08a'; x.beginPath(); x.moveTo(64, 14); x.lineTo(100, 64); x.lineTo(64, 114); x.lineTo(28, 64); x.closePath(); x.fill(); x.fillStyle = '#fff8e0'; x.beginPath(); x.moveTo(64, 34); x.lineTo(84, 64); x.lineTo(64, 94); x.lineTo(44, 64); x.closePath(); x.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex, depthTest: false, transparent: true, toneMapped: false })); marker.scale.set(0.7, 0.7, 1); marker.renderOrder = 10; marker.visible = false; SW.add(marker);
let markerTarget = null;   // () => V3


// ───────────────────────── 경험치 구슬 ─────────────────────────
const XPO = [];
function dropOrbs(pos, total){
  const n = Math.min(10, Math.max(2, Math.round(total / 8)));
  for (let i = 0; i < n; i++){
    const s = glowSprite(i % 3 ? 0xc89aff : 0xffe08a, 0.55, 1); s.position.set(pos.x, 1.0, pos.z); SW.add(s);
    const a = R() * TAU; XPO.push({ s, v: new V3(Math.cos(a) * rr(2, 4), rr(3, 6), Math.sin(a) * rr(2, 4)), t: 0, val: total / n });
  }
}
function updateXPO(dt){
  const tgt = new V3(player.pos.x, PY() + 1.1, player.pos.z);
  for (let i = XPO.length - 1; i >= 0; i--){
    const o = XPO[i]; o.t += dt;
    if (o.t < 0.45){ o.v.y -= 12 * dt; o.s.position.addScaledVector(o.v, dt); if (o.s.position.y < 0.3){ o.s.position.y = 0.3; o.v.y *= -0.4; } }
    else { const dir = tgt.clone().sub(o.s.position), d = dir.length(); o.s.position.addScaledVector(dir.normalize(), Math.min(d, (6 + o.t * 14) * dt)); if (d < 0.35){ SW.remove(o.s); XPO.splice(i, 1); gainExp(o.val); } }
  }
}
let expAcc = 0, expT = 0;
function gainExp(v){
  S.exp += v; expAcc += v; expT = 0.25;
  while (S.exp >= need(S.lv)){ S.exp -= need(S.lv); S.lv++; S.pts += 3; levelUp(); BUS.emit('levelUp', { lv: S.lv }); }
  S.exp = Math.round(S.exp * 10) / 10; save(); refreshHud(); if (statOpen) refreshStats();
}
function levelUp(){
  const d = D(); hp = d.maxHp; mp = d.maxMp;
  sfx('level'); banner('LEVEL UP', `Lv. ${S.lv}`, '스탯 포인트 +3 — C 키 또는 왼쪽 위 카드를 눌러 찍어보세요', false, 2.8);
  burst(new V3(player.pos.x, 0.3, player.pos.z), 0xffe08a, 60, 3, 0.3, 1.4, 4, 4);
  shockwave(player.pos.x, 0.15, player.pos.z, 3, 0xffe08a, 0.7);
  if (!S.statTut){ S.statTut = true; save(); setTimeout(() => { if (!dialogOpen && !(battle && !battle.ended)) { toggleStats(true); hint('스탯을 찍어 강해지세요! <b>+</b> 버튼을 누르고 <b>C</b> 로 닫기', 6); } }, 1600); }
}
// ───────────────────────── 숲의 몬스터 (귀여운 로우폴리) ─────────────────────────
const EYE_M = new THREE.MeshBasicMaterial({ color: 0x1a1210 }), WHITE_M = new THREE.MeshBasicMaterial({ color: 0xffffff }), BLUSH_M = new THREE.MeshBasicMaterial({ color: 0xff8aa0, transparent: true, opacity: 0.55, depthWrite: false });
const sm = (c, o = {}) => G.std(Object.assign({ color: c, roughness: 0.55, side: THREE.DoubleSide }, o));
const RED_EYE_M = new THREE.MeshBasicMaterial({ color: 0xff2a3a, toneMapped: false }), BROW_G = new THREE.BoxGeometry(0.13, 0.03, 0.03);
function face(g, y, z, s = 1, spread = 0.12, blush = false){
  for (const sx of [-1, 1]){
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 12, 8), EYE_M); e.position.set(sx * spread * s, y, z); e.scale.set(1, 1.25, 0.6); e.userData.eye = true; g.add(e);
    const br = new THREE.Mesh(BROW_G, EYE_M); br.scale.setScalar(s); br.position.set(sx * spread * s * 1.05, y + 0.095 * s, z + 0.012 * s); br.rotation.z = sx * 0.5; g.add(br);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.02 * s, 6, 4), WHITE_M); h.position.set(sx * spread * s + 0.018 * s, y + 0.03 * s, z + 0.035 * s); g.add(h);
    if (blush){ const b = new THREE.Mesh(new THREE.CircleGeometry(0.045 * s, 12), BLUSH_M); b.position.set(sx * (spread + 0.075) * s, y - 0.075 * s, z + 0.01); g.add(b); }
  }
}
function addCrown(parent, y, r, h = 0.14){
  const c = new THREE.Group(); c.position.y = y; parent.add(c);
  c.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.95, h, 18, 1, true), M.gold));
  for (let i = 0; i < 6; i++){ const a = i / 6 * TAU, t = new THREE.Mesh(new THREE.ConeGeometry(r * 0.22, h * 1.3, 5), M.gold); t.position.set(Math.cos(a) * r * 0.92, h * 1.1, Math.sin(a) * r * 0.92); c.add(t);
    const gm = new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 8, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff4a6a : 0x4ae0ff, toneMapped: false })); gm.position.set(Math.cos(a) * r * 1.0, 0, Math.sin(a) * r * 1.0); c.add(gm); }
  return c;
}
function mkSlime(color = 0x72d86a){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const m = sm(color, { roughness: 0.18, transparent: true, opacity: 0.9, emissive: color, emissiveIntensity: 0.14 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 18), m); b.scale.set(1, 0.85, 1); b.position.y = 0.42; body.add(b);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), sm(0xffffff, { transparent: true, opacity: 0.25 })); core.position.set(0, 0.36, 0); body.add(core);
  face(body, 0.5, 0.43, 1.1, 0.13);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 12, Math.PI), EYE_M); mouth.position.set(0, 0.41, 0.465); mouth.rotation.z = Math.PI; body.add(mouth);
  const sh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), sm(0xffffff, { transparent: true, opacity: 0.8, emissive: 0xffffff, emissiveIntensity: 0.4 })); sh.position.set(-0.2, 0.68, 0.28); sh.scale.set(1, 0.6, 0.6); body.add(sh);
  return { g, body, mats: [m], kind: 'slime' };
}
function mkShroom(cap = 0xd8402e, stemC = 0xf2e4c4){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const ms = sm(stemC), mc = sm(cap, { roughness: 0.45 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.55, 16), ms); stem.position.y = 0.33; body.add(stem);
  const cp = new THREE.Mesh(new THREE.SphereGeometry(0.52, 22, 12, 0, TAU, 0, Math.PI / 2), mc); cp.scale.set(1, 0.72, 1); cp.position.y = 0.56; body.add(cp);
  const under = new THREE.Mesh(new THREE.CircleGeometry(0.52, 22).rotateX(Math.PI / 2), sm(0xe8d2a8)); under.position.y = 0.56; body.add(under);
  for (let i = 0; i < 8; i++){ const a = i / 7 * TAU + 0.3, el = i === 7 ? 1.5 : 0.4 + (i % 2) * 0.45; const d = new THREE.Mesh(new THREE.SphereGeometry(0.065 + (i % 3) * 0.015, 8, 6), sm(0xfff6e6)); d.position.set(Math.cos(a) * Math.cos(el) * 0.52, 0.56 + Math.sin(el) * 0.37, Math.sin(a) * Math.cos(el) * 0.52); d.scale.y = 0.5; body.add(d); }
  face(body, 0.37, 0.27, 0.85, 0.09);
  const feet = [];
  for (const s of [-1, 1]){ const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), sm(0xc8b08a)); f.position.set(s * 0.13, 0.06, 0.04); f.scale.set(1, 0.6, 1.3); body.add(f); feet.push(f); }
  return { g, body, mats: [ms, mc], feet, cap: cp, kind: 'shroom' };
}
const beeTex = (() => { const c = G.cnv(64, 128), x = c.getContext('2d'); for (let i = 0; i < 8; i++){ x.fillStyle = i % 2 ? '#2a1e14' : '#ffcf2a'; x.fillRect(0, i * 16, 64, 16); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
function mkBee(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mb = G.std({ map: beeTex, roughness: 0.5, side: THREE.DoubleSide }), mh = sm(0xffd23a);
  const ab = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14).rotateX(Math.PI / 2), mb); ab.scale.set(1, 1, 1.25); ab.position.z = -0.08; body.add(ab);
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), mh); hd.position.set(0, 0.06, 0.3); body.add(hd);
  face(body, 0.1, 0.5, 0.75, 0.09);
  const st = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 8).rotateX(-Math.PI / 2), EYE_M); st.position.z = -0.5; body.add(st);
  for (const s of [-1, 1]){ const an = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.22, 4), EYE_M); an.position.set(s * 0.08, 0.32, 0.36); an.rotation.set(0.4, 0, -s * 0.3); body.add(an); const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), EYE_M); tip.position.set(s * 0.12, 0.42, 0.4); body.add(tip); }
  const wm = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const wings = [];
  for (const s of [-1, 1]){ const pv = new THREE.Group(); pv.position.set(s * 0.12, 0.22, 0.02); const w = new THREE.Mesh(new THREE.CircleGeometry(0.22, 14), wm); w.scale.set(1.4, 0.8, 1); w.rotation.x = -Math.PI / 2; w.position.x = s * 0.24; pv.add(w); body.add(pv); wings.push(pv); }
  return { g, body, mats: [mb, mh], wings, kind: 'bee' };
}
function mkBoar(c = 0x9a6a44){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mb = sm(c), mp = sm(0xeba2a2), md = sm(0x5a3a24);
  const bd = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), mb); bd.scale.set(0.95, 0.78, 1.3); bd.position.y = 0.66; body.add(bd);
  const head = new THREE.Group(); head.position.set(0, 0.74, 0.66); body.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), mb));
  const sn = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.18, 14).rotateX(Math.PI / 2), mp); sn.position.set(0, -0.08, 0.33); head.add(sn);
  for (const s of [-1, 1]){ const n = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), EYE_M); n.position.set(s * 0.05, -0.08, 0.42); head.add(n);
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 8), sm(0xfff8e8)); t.position.set(s * 0.14, -0.13, 0.3); t.rotation.x = 0.6; head.add(t);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 4), mb); ear.position.set(s * 0.2, 0.28, -0.05); ear.rotation.z = -s * 0.4; head.add(ear); }
  face(head, 0.08, 0.29, 0.8, 0.14, true);
  const legs = [];
  for (const [x, z] of [[-0.26, 0.38], [0.26, 0.38], [-0.26, -0.38], [0.26, -0.38]]){ const pv = new THREE.Group(); pv.position.set(x, 0.42, z); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.42, 8), md); l.position.y = -0.21; pv.add(l); body.add(pv); legs.push(pv); }
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 10), md); tail.position.set(0, 0.8, -0.72); body.add(tail);
  return { g, body, mats: [mb, mp], legs, head, kind: 'boar' };
}
function mkSprout(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mw = G.std({ map: G.T.wood, color: 0xa07044, roughness: 0.9, side: THREE.DoubleSide }), ml = sm(0x5ec04a, { roughness: 0.6 });
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.6, 12), mw); st.position.y = 0.36; body.add(st);
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12).rotateX(-Math.PI / 2), sm(0xd8b080)); top.position.y = 0.665; body.add(top);
  const crown = new THREE.Group(); crown.position.y = 0.68; body.add(crown);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.2, 5), ml); stem.position.y = 0.1; crown.add(stem);
  for (let i = 0; i < 3; i++){ const lf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6), ml); lf.scale.set(0.5, 0.16, 1); lf.position.set(Math.cos(i * 2.1) * 0.14, 0.2 + i * 0.02, Math.sin(i * 2.1) * 0.14); lf.rotation.y = -i * 2.1; lf.rotation.x = 0.35; crown.add(lf); }
  const acorn = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), sm(0x9a6a2e)); acorn.position.set(0.18, 0.12, 0.1); crown.add(acorn);
  face(body, 0.43, 0.33, 0.9, 0.1);
  const arms = [];
  for (const s of [-1, 1]){ const pv = new THREE.Group(); pv.position.set(s * 0.3, 0.42, 0); const a = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.32, 5), mw); a.position.set(s * 0.12, 0.05, 0); a.rotation.z = -s * 1.1; pv.add(a); body.add(pv); arms.push(pv); }
  for (let i = 0; i < 4; i++){ const a = i / 4 * TAU + 0.4, r = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5), mw); r.position.set(Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3); r.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8); body.add(r); }
  return { g, body, mats: [mw, ml], arms, crown, kind: 'sprout' };
}
function mkGolem(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mr = sm(0x8c8a80, { flatShading: true, roughness: 0.9 }), mm = sm(0x5a9a3a, { flatShading: true, roughness: 0.9 });
  const bd = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 0), mr); bd.scale.set(1, 0.9, 0.85); bd.position.y = 0.95; body.add(bd);
  const ms = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), mm); ms.scale.set(1.08, 0.42, 1); ms.position.y = 1.42; body.add(ms);
  for (let i = 0; i < 5; i++){ const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), sm(i % 2 ? 0xff8ab0 : 0xfff07a)); f.position.set(Math.cos(i * 1.3) * 0.4, 1.62, Math.sin(i * 1.3) * 0.35); body.add(f); }
  const em = new THREE.MeshBasicMaterial({ color: 0xd8ff7a, toneMapped: false });
  for (const s of [-1, 1]){ const e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), em); e.position.set(s * 0.2, 1.05, 0.6); body.add(e); }
  const arms = [];
  for (const s of [-1, 1]){ const pv = new THREE.Group(); pv.position.set(s * 0.72, 1.15, 0.05); const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), mr); a.position.set(s * 0.14, -0.35, 0.05); pv.add(a); body.add(pv); arms.push(pv);
    const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), mr); l.position.set(s * 0.34, 0.24, 0); body.add(l); }
  return { g, body, mats: [mr, mm], arms, kind: 'golem' };
}
function mkTreant(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const bark = G.std({ map: G.T.wood, color: 0x7a5434, roughness: 0.95, side: THREE.DoubleSide }), leaf = sm(0x4e9a3a, { flatShading: true, roughness: 0.8 }), leaf2 = sm(0x6ab84a, { flatShading: true, roughness: 0.8 });
  const tg = new THREE.CylinderGeometry(0.85, 1.25, 3.6, 14, 6), p = tg.attributes.position;
  for (let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.08 * Math.sin(a * 5 + y * 2) + 0.05 * Math.sin(a * 11); p.setXYZ(i, x * k, y, z * k); }
  tg.computeVertexNormals();
  const tr = new THREE.Mesh(tg, bark); tr.position.y = 2.0; body.add(tr);
  const glow = new THREE.MeshBasicMaterial({ color: 0xffc84a, toneMapped: false });
  for (const s of [-1, 1]){
    const sk = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), EYE_M); sk.position.set(s * 0.34, 2.9, 0.82); sk.scale.set(1, 0.8, 0.5); body.add(sk);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), glow); pu.position.set(s * 0.34, 2.9, 0.92); body.add(pu);
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.16), bark); br.position.set(s * 0.34, 3.15, 0.86); br.rotation.z = s * 0.25; body.add(br);
  }
  const mo = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), EYE_M); mo.position.set(0, 2.35, 0.9); mo.scale.set(1.2, 0.35, 0.4); body.add(mo);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 6).rotateX(Math.PI / 2), bark); nose.position.set(0, 2.65, 1.0); body.add(nose);
  const canopy = new THREE.Group(); canopy.position.y = 4.4; body.add(canopy);
  for (let i = 0; i < 8; i++){ const a = i / 7 * TAU, r = i === 7 ? 0 : 1.1; const c = new THREE.Mesh(new THREE.IcosahedronGeometry(i === 7 ? 1.5 : 1.15, 1), i % 2 ? leaf : leaf2); c.position.set(Math.cos(a) * r, (i === 7 ? 0.9 : rr(-0.2, 0.5)), Math.sin(a) * r); canopy.add(c); }
  for (let i = 0; i < 10; i++){ const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), sm(i % 2 ? 0xff9ac0 : 0xfff07a)); const a = i * 0.7; f.position.set(Math.cos(a) * 1.6, rr(0, 1.6), Math.sin(a) * 1.6); canopy.add(f); }
  const arms = [];
  for (const s of [-1, 1]){
    const pv = new THREE.Group(); pv.position.set(s * 0.9, 3.1, 0.1); body.add(pv);
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 2.2, 8), bark); br.position.set(s * 0.9, -0.5, 0.2); br.rotation.z = s * 1.0; pv.add(br);
    const lc = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), leaf2); lc.position.set(s * 1.85, -1.1, 0.35); pv.add(lc);
    arms.push(pv);
  }
  for (let i = 0; i < 6; i++){ const a = i / 6 * TAU + 0.3, r = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 1.6, 6), bark); r.position.set(Math.cos(a) * 1.25, 0.35, Math.sin(a) * 1.25); r.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); body.add(r); }
  return { g, body, mats: [bark, leaf, leaf2], arms, canopy, kind: 'treant' };
}
function mkSquirrel(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mb = sm(0xc8783a), mw = sm(0xf4e0c8);
  const bd = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), mb); bd.scale.set(0.85, 1, 0.9); bd.position.y = 0.38; body.add(bd);
  const bl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mw); bl.position.set(0, 0.34, 0.14); bl.scale.set(0.9, 1.1, 0.6); body.add(bl);
  const hd = new THREE.Group(); hd.position.set(0, 0.78, 0.06); body.add(hd);
  hd.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), mb));
  for (const s of [-1, 1]){ const e = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 6), mb); e.position.set(s * 0.13, 0.24, -0.02); hd.add(e); const ch = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mw); ch.position.set(s * 0.1, -0.06, 0.16); hd.add(ch); }
  face(hd, 0.04, 0.21, 0.85, 0.11);
  const tail = new THREE.Group(); tail.position.set(0, 0.3, -0.25); body.add(tail);
  for (let i = 0; i < 4; i++){ const t = new THREE.Mesh(new THREE.SphereGeometry(0.17 + i * 0.03, 10, 8), mb); t.position.set(0, 0.15 + i * 0.2, -0.12 - Math.sin(i * 0.8) * 0.12); tail.add(t); }
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), sm(0x8a5a2a)); nut.position.set(0, 0.45, 0.3); body.add(nut);
  return { g, body, mats: [mb, mw], tail, kind: 'squirrel' };
}
function mkFrog(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mg = sm(0x5ac04a, { roughness: 0.35 }), mw = sm(0xe8f0a0);
  const bd = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), mg); bd.scale.set(1.1, 0.7, 1); bd.position.y = 0.34; body.add(bd);
  const bl = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8), mw); bl.scale.set(1.1, 0.55, 0.8); bl.position.set(0, 0.26, 0.16); body.add(bl);
  for (const s of [-1, 1]){
    const eb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), mg); eb.position.set(s * 0.22, 0.62, 0.18); body.add(eb);
    const ew = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), WHITE_M); ew.position.set(s * 0.22, 0.65, 0.27); body.add(ew);
    const ep = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), EYE_M); ep.position.set(s * 0.22, 0.65, 0.36); body.add(ep);
    const lg = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), mg); lg.scale.set(0.7, 0.5, 1.4); lg.position.set(s * 0.42, 0.15, -0.15); body.add(lg);
  }
  const mo = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.015, 6, 14, Math.PI), EYE_M); mo.position.set(0, 0.38, 0.43); mo.rotation.z = Math.PI; body.add(mo);
  const tongue = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5), sm(0xff7a9a)); tongue.position.set(0, 0.36, 0.4); tongue.scale.set(1, 1, 0.01); body.add(tongue);
  return { g, body, mats: [mg, mw], tongue, kind: 'frog' };
}
function mkLadybug(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mr = sm(0xe02a2a, { roughness: 0.3 }), mk = sm(0x1a1a1a);
  const sh = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 10, 0, TAU, 0, Math.PI / 2), mr); sh.scale.set(1, 0.8, 1.15); sh.position.y = 0.12; body.add(sh);
  const ln = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.7), mk); ln.position.set(0, 0.39, 0); body.add(ln);
  for (let i = 0; i < 6; i++){ const a = i / 6 * TAU + 0.4, d = new THREE.Mesh(new THREE.CircleGeometry(0.06, 10), mk); d.position.set(Math.cos(a) * 0.2, 0.33, Math.sin(a) * 0.24); d.lookAt(d.position.x * 3, 2, d.position.z * 3); body.add(d); }
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), mk); hd.position.set(0, 0.17, 0.36); body.add(hd);
  face(body, 0.22, 0.48, 0.55, 0.12, false);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++){ const l = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 4), mk); l.position.set(s * 0.32, 0.06, -0.15 + i * 0.15); l.rotation.z = s * 1.0; body.add(l); }
  return { g, body, mats: [mr], kind: 'ladybug' };
}
function mkSnail(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const ms = sm(0xe8c8a0, { roughness: 0.3 }), mh = sm(0xb06a3a), mh2 = sm(0xe8a050);
  const ft = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.8, 6, 12).rotateX(Math.PI / 2), ms); ft.scale.set(1.1, 0.7, 1); ft.position.set(0, 0.16, 0.05); body.add(ft);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), ms); head.position.set(0, 0.36, 0.52); body.add(head);
  for (const s of [-1, 1]){ const st = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.32, 5), ms); st.position.set(s * 0.09, 0.62, 0.55); st.rotation.z = -s * 0.25; body.add(st); const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), WHITE_M); e.position.set(s * 0.13, 0.79, 0.56); body.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), EYE_M); p.position.set(s * 0.13, 0.8, 0.61); body.add(p); }
  const shell = new THREE.Group(); shell.position.set(0, 0.62, -0.15); body.add(shell);
  for (let i = 0; i < 5; i++){ const t = new THREE.Mesh(new THREE.TorusGeometry(0.42 - i * 0.08, 0.1 - i * 0.012, 8, 20), i % 2 ? mh2 : mh); t.rotation.y = Math.PI / 2; t.position.x = (i - 2) * 0.04; shell.add(t); }
  shell.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mh));
  return { g, body, mats: [ms, mh, mh2], shell, kind: 'snail' };
}
function mkFlower(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mst = sm(0x4a9a3a), mp = sm(0xff7ab0, { roughness: 0.5 }), mc = sm(0xffd84a);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.9, 6), mst); st.position.y = 0.45; body.add(st);
  for (const s of [-1, 1]){ const lf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mst); lf.scale.set(1, 0.15, 0.5); lf.position.set(s * 0.22, 0.35, 0); lf.rotation.z = s * 0.4; body.add(lf); }
  const head = new THREE.Group(); head.position.set(0, 1.05, 0); body.add(head);
  for (let i = 0; i < 8; i++){ const a = i / 8 * TAU, p = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6), mp); p.scale.set(0.55, 0.18, 1); p.position.set(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0); p.rotation.set(Math.PI / 2, 0, a + Math.PI / 2); p.rotation.order = 'ZXY'; head.add(p); }
  const ctr = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mc); ctr.scale.z = 0.5; head.add(ctr);
  face(head, 0.02, 0.1, 0.8, 0.09);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.3, 10), sm(0x8a5a3a)); pot.position.y = 0.15; body.add(pot);
  return { g, body, mats: [mp, mc], head, kind: 'flower' };
}
function mkRaccoon(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mg = sm(0x8a8a90), md = sm(0x2a2a30), mw = sm(0xf0f0f0);
  const bd = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), mg); bd.scale.set(0.9, 1, 1); bd.position.y = 0.48; body.add(bd);
  const hd = new THREE.Group(); hd.position.set(0, 0.95, 0.05); body.add(hd);
  hd.add(new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10), mg));
  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.275, 14, 6, 0, TAU, Math.PI * 0.38, Math.PI * 0.18), md); mask.rotation.x = 0.15; hd.add(mask);
  const sn = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mw); sn.position.set(0, -0.09, 0.22); hd.add(sn);
  const ns = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), EYE_M); ns.position.set(0, -0.06, 0.32); hd.add(ns);
  for (const s of [-1, 1]){ const e = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 5), mg); e.position.set(s * 0.17, 0.24, 0); hd.add(e); const ey = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), WHITE_M); ey.position.set(s * 0.1, 0.03, 0.235); hd.add(ey); const p = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), EYE_M); p.position.set(s * 0.1, 0.03, 0.27); hd.add(p); }
  const tail = new THREE.Group(); tail.position.set(0, 0.35, -0.3); body.add(tail);
  for (let i = 0; i < 5; i++){ const t = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), i % 2 ? md : mg); t.position.set(0, i * 0.08, -i * 0.14); tail.add(t); }
  const arms = [];
  for (const s of [-1, 1]){ const pv = new THREE.Group(); pv.position.set(s * 0.3, 0.62, 0.05); const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.2, 4, 6), md); a.position.y = -0.14; pv.add(a); body.add(pv); arms.push(pv); }
  return { g, body, mats: [mg], arms, tail, kind: 'raccoon' };
}
function mkMole(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mb = sm(0x6a4a3a), mp = sm(0xffa0b0), mc = sm(0xf0e0d0);
  const bd = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mb); bd.scale.set(1, 0.95, 1.05); bd.position.y = 0.42; body.add(bd);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mp); nose.position.set(0, 0.45, 0.43); body.add(nose);
  for (const s of [-1, 1]){ const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), EYE_M); e.position.set(s * 0.12, 0.6, 0.36); body.add(e);
    const cl = new THREE.Group(); cl.position.set(s * 0.36, 0.32, 0.25); body.add(cl); for (let i = 0; i < 3; i++){ const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 4), mc); c.position.set((i - 1) * 0.06, -0.05, 0.08); c.rotation.x = 1.2; cl.add(c); } const pw = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mp); pw.scale.set(1, 0.6, 1); cl.add(pw); }
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.1, 10), sm(0xffc030)); hat.position.y = 0.86; body.add(hat); const hl = glowSprite(0xfff0a0, 0.4, 0.8); hl.position.set(0, 0.88, 0.2); body.add(hl);
  return { g, body, mats: [mb, mp], kind: 'mole' };
}
function mkOwl(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mb = sm(0x8a6a4a), mw = sm(0xf0e4d0), my = sm(0xffd040);
  const bd = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), mb); bd.scale.set(1, 1.1, 0.9); body.add(bd);
  const bl = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), mw); bl.position.set(0, -0.05, 0.16); bl.scale.set(1, 1.1, 0.6); body.add(bl);
  for (const s of [-1, 1]){ const ring = new THREE.Mesh(new THREE.CircleGeometry(0.13, 14), mw); ring.position.set(s * 0.14, 0.15, 0.36); body.add(ring); const ey = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), my); ey.position.set(s * 0.14, 0.15, 0.365); body.add(ey); const p = new THREE.Mesh(new THREE.CircleGeometry(0.045, 10), EYE_M); p.position.set(s * 0.14, 0.15, 0.37); body.add(p);
    const tf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), mb); tf.position.set(s * 0.2, 0.46, 0.05); tf.rotation.z = -s * 0.3; body.add(tf); }
  const bk = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 4).rotateX(Math.PI / 2 + 0.5), sm(0xe8a030)); bk.position.set(0, 0.05, 0.4); body.add(bk);
  const wings = [];
  for (const s of [-1, 1]){ const pv = new THREE.Group(); pv.position.set(s * 0.33, 0.1, 0); const w = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 6), mb); w.scale.set(0.9, 0.18, 0.55); w.position.x = s * 0.25; pv.add(w); body.add(pv); wings.push(pv); }
  return { g, body, mats: [mb, mw], wings, kind: 'owl' };
}
function mkHedgehog(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const ms = sm(0x6a5040, { flatShading: true }), mf = sm(0xe8c8a0);
  const core = new THREE.Group(); core.position.y = 0.4; body.add(core);
  const bd = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 10), ms); core.add(bd);
  for (let i = 0; i < 26; i++){ const u = R() * TAU, v = rr(-0.2, 1.2), dir = new V3(Math.cos(u) * Math.cos(v), Math.sin(v), Math.sin(u) * Math.cos(v) - 0.25).normalize(); if (dir.z > 0.6 && dir.y < 0.4) continue; const c = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.32, 4), ms); c.position.copy(dir.clone().multiplyScalar(0.4)); c.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir); core.add(c); }
  const fc = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mf); fc.position.set(0, -0.06, 0.28); fc.scale.set(1, 0.9, 1.1); core.add(fc);
  const ns = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), EYE_M); ns.position.set(0, -0.06, 0.5); core.add(ns);
  face(core, 0.02, 0.4, 0.6, 0.1);
  return { g, body, mats: [ms, mf], core, kind: 'hedgehog' };
}
const MON = {
  slime: { name: '말랑 슬라임', icon: '🟢', mk: () => mkSlime(), hp: 30, dmg: 6, spd: 2.8, rad: 0.5, style: 'hop', range: 2.4, wind: 0.45, exp: 6, top: 1.0 },
  shroom: { name: '버섯돌이', icon: '🍄', mk: () => mkShroom(), hp: 46, dmg: 8, spd: 2.3, rad: 0.5, style: 'lunge', range: 1.7, wind: 0.5, exp: 8, top: 1.1 },
  bee: { name: '윙윙 꿀벌', icon: '🐝', mk: () => mkBee(), hp: 26, dmg: 7, spd: 4.0, rad: 0.45, style: 'dash', range: 5.5, wind: 0.6, exp: 8, fly: 1.3, top: 1.9 },
  boar: { name: '꿀꿀 멧돼지', icon: '🐗', mk: () => mkBoar(), hp: 70, dmg: 11, spd: 2.6, rad: 0.7, style: 'charge', range: 8, wind: 0.8, exp: 12, top: 1.4 },
  sprout: { name: '도토리 묘목', icon: '🌱', mk: () => mkSprout(), hp: 36, dmg: 7, spd: 2.0, rad: 0.45, style: 'ranged', range: 9, wind: 0.6, exp: 9, top: 1.2 },
  golem: { name: '이끼 골렘', icon: '🪨', mk: () => mkGolem(), hp: 150, dmg: 15, spd: 1.5, rad: 0.85, style: 'slam', range: 2.3, wind: 0.9, exp: 20, top: 2.0 },
  squirrel: { name: '날쌘 다람쥐', icon: '🐿️', mk: () => mkSquirrel(), hp: 28, dmg: 6, spd: 3.6, rad: 0.4, style: 'shooter', range: 9, wind: 0.45, exp: 8, top: 1.3 },
  frog: { name: '폴짝 개구리', icon: '🐸', mk: () => mkFrog(), hp: 40, dmg: 8, spd: 3.0, rad: 0.5, style: 'hop', tongue: true, range: 4, wind: 0.5, exp: 9, top: 1.0 },
  ladybug: { name: '꼬마 무당벌레', icon: '🐞', mk: () => mkLadybug(), hp: 20, dmg: 5, spd: 3.2, rad: 0.4, style: 'charge', clen: 6, cw: 0.9, cspd: 10, range: 6, wind: 0.55, exp: 5, top: 0.8 },
  snail: { name: '단단 달팽이', icon: '🐌', mk: () => mkSnail(), hp: 120, dmg: 10, spd: 1.0, rad: 0.6, style: 'lunge', range: 1.9, wind: 0.75, exp: 14, top: 1.3 },
  flower: { name: '꽃잎 정령', icon: '🌸', mk: () => mkFlower(), hp: 44, dmg: 7, spd: 0, rad: 0.5, style: 'turret', range: 13, wind: 0.8, exp: 10, top: 1.6 },
  raccoon: { name: '장난꾸러기 너구리', icon: '🦝', mk: () => mkRaccoon(), hp: 55, dmg: 8, spd: 3.4, rad: 0.5, style: 'lunge', combo: 2, range: 1.9, wind: 0.35, exp: 11, top: 1.4 },
  mole: { name: '광부 두더지', icon: '⛏️', mk: () => mkMole(), hp: 50, dmg: 10, spd: 4.5, rad: 0.5, style: 'burrow', range: 1.4, wind: 0.8, exp: 11, top: 1.1 },
  owl: { name: '밤눈 부엉이', icon: '🦉', mk: () => mkOwl(), hp: 40, dmg: 9, spd: 3.5, rad: 0.5, style: 'dive', fly: 3, range: 10, wind: 0.8, exp: 11, top: 3.6 },
  hedgehog: { name: '데굴 고슴도치', icon: '🦔', mk: () => mkHedgehog(), hp: 60, dmg: 10, spd: 2.4, rad: 0.55, style: 'charge', roll: true, clen: 8, cw: 1.2, cspd: 12, range: 7, wind: 0.7, exp: 11, top: 1.0 },
};
const BOSS = {
  kingSlime: { name: '말랑대왕', title: '왕슬라임', icon: '👑', scale: 2.8, hp: 200, dmg: 9, spd: 1.8, rad: 1.3, exp: 60, top: 3.0,
    mk: () => { const m = mkSlime(0x5fd05a); addCrown(m.body, 0.82, 0.16, 0.12); return m; },
    atks: [['leap', 3.2], ['leap', 3.2], ['summon', 'slime', 2]], line: '말랑말랑~! 여긴 내 풀밭이다 말랑! 썩 나가라 말랑!' },
  chief: { name: '포자왕', title: '버섯 대장', icon: '🍄', scale: 2.6, hp: 600, dmg: 12, spd: 2.0, rad: 1.2, exp: 120, top: 3.1,
    mk: () => { const m = mkShroom(0xb03aa0, 0xf6e8cc); for (const s of [-1, 1]){ const mu = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.12, 4, 8), EYE_M); mu.position.set(s * 0.07, 0.28, 0.29); mu.rotation.z = s * 1.2; m.body.add(mu); } addCrown(m.body, 0.92, 0.12, 0.1); return m; },
    atks: [['aoe', 4.4], ['charge', 9, 1.6, 11], ['leap', 3.2], ['summon', 'shroom', 3]], line: '포자포자! 감히 내 버섯 왕국에 발을 들이다니! 포자 맛 좀 봐라!' },
  queen: { name: '꿀단지 여왕', title: '여왕벌', icon: '🐝', scale: 2.4, hp: 950, dmg: 12, spd: 3.0, rad: 1.0, exp: 180, fly: 2.4, top: 3.6,
    mk: () => { const m = mkBee(); addCrown(m.body, 0.3, 0.12, 0.1).position.z = 0.28; return m; },
    atks: [['charge', 12, 1.6, 15], ['barrage', 7, 0.9, 11, 'sting'], ['summon', 'bee', 3], ['charge', 12, 1.6, 15]], line: '윙— 내 꽃밭의 꿀은 한 방울도 못 준다! 얘들아, 침 준비!' },
  tusk: { name: '쿵쾅 엄니왕', title: '우두머리 멧돼지', icon: '🐗', scale: 2.4, hp: 1400, dmg: 17, spd: 2.3, rad: 1.5, exp: 260, top: 3.3,
    mk: () => { const m = mkBoar(0x7a4a2c); const mane = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 6).rotateX(-1.2), sm(0x3a2416)); mane.position.set(0, 1.12, 0.2); mane.scale.set(1, 1, 1.6); m.body.add(mane); addCrown(m.head, 0.33, 0.12, 0.1); return m; },
    atks: [['charge3', 13, 2.3, 16], ['aoe', 4.6], ['charge', 13, 2.3, 16], ['summon', 'boar', 2]], line: '쿵! 쾅! 이 엄니왕님의 길을 막는 꼬맹이는 누구냐아!' },
  treant: { name: '그루터기 할배', title: '천년 고목', icon: '🌳', scale: 1.15, hp: 2300, dmg: 16, spd: 0.9, rad: 2.0, exp: 400, top: 7.2, big: true,
    mk: () => mkTreant(),
    atks: [['roots', 5, 1.6], ['barrage', 9, 1.2, 9, 'acorn'], ['sweep', 5.6, 2.1], ['summon', 'sprout', 3], ['roots', 6, 1.6]], line: '…흐으음. 천 년 낮잠을 깨운 꼬마가 너로구나. 어디, 실력 좀 보여 보거라.' },
};

// ───────────────────────── 적 로직 ─────────────────────────
const ENEMIES = [], PROJ = [], ROOTS = [];
const THORN_G = new THREE.ConeGeometry(0.07, 0.42, 5), THORN_M = G.std({ color: 0x1a0a20, emissive: 0x7a1aff, emissiveIntensity: 0.6, roughness: 0.4, flatShading: true });
// 레벨 보정 (필드 · 레이드)
const LVHP = lv => 1 + (lv - 1) * 0.16 + Math.pow(lv / 10, 2) * 0.45, LVDMG = lv => 1 + (lv - 1) * 0.09, LVEXP = lv => 1 + (lv - 1) * 0.24;
function spawnMon(key, x, z, elite, opt = {}){
  const isBoss = !!BOSS[key] || !!opt.boss, cfg = opt.cfg || BOSS[key] || MON[key], m = cfg.mk(opt);
  const mul = opt.lv ? { hp: LVHP(opt.lv) * (opt.hpMul || 1), bhp: LVHP(opt.lv) * (opt.hpMul || 1), dmg: LVDMG(opt.lv) * (opt.dmgMul || 1), exp: LVEXP(opt.lv) } : battle ? battle.mul : { hp: 1, bhp: 1, dmg: 1, exp: 1 };
  const e = { key, cfg, boss: isBoss, m, g: m.g, pos: m.g.position, hp: cfg.hp * (isBoss ? mul.bhp : mul.hp), dmg: cfg.dmg * mul.dmg, state: 'spawn', st: 0, vel: new V3(), flash: 0, atkCd: rr(0.8, 1.8), ph: R() * 6, fly: cfg.fly || 0, summons: 0, hopT: rr(0.2, 0.8) };
  e.max = e.hp; e.base = m.mats.map(mt => [mt.emissive.clone(), mt.emissiveIntensity]);
  m.g.scale.setScalar((isBoss ? cfg.scale || 1 : 1) * (opt.scale || 1));
  e.pos.set(x, 0, z); e.g.rotation.y = Math.atan2(player.pos.x - x, player.pos.z - z);
  m.body.scale.setScalar(0.01);
  m.g.traverse(o => { if (o.isMesh && o.material !== BLUSH_M) o.castShadow = true; });
  SW.add(m.g);
  e.bar = document.createElement('div'); e.bar.className = 'e'; e.bar.innerHTML = '<i></i>'; e.bar.style.display = 'none'; ehp.appendChild(e.bar);
  burst(new V3(x, 0.4, z), 0x7ad84a, 16, 3, 0.25, 0.8, -3, 2); burst(new V3(x, 0.5, z), 0xffe07a, 6, 2, 0.15, 0.7, -2, 2);
  e.eyes = []; m.g.traverse(o => { if (o.userData.eye) e.eyes.push(o); });
  e.spdMul = battle && battle.n > 1 ? 1.12 : opt.lv ? 1.08 : 1;
  e.expMul = mul.exp; if (opt.lv) e.lv = opt.lv; if (opt.ai) e.ai = opt.ai; if (opt.data) Object.assign(e, opt.data);
  if (opt.fld){ e.fld = Object.assign({ hx: x, hz: z, aggro: 9, leash: 30, wr: 7 }, opt.fld); e.aggro = false; e.wt = rr(0.5, 3); }
  if (opt.name || opt.lv){ e.label = opt.name || cfg.name; e.bar.insertAdjacentHTML('beforeend', `<u class="lv">${opt.lv ? 'Lv.' + opt.lv + ' ' : ''}${e.label}</u>`); e.bar.classList.add('named'); }
  if (opt.fieldBoss){ e.fboss = true; e.bar.classList.add('fboss'); }
  if (elite && !isBoss) makeElite(e);
  if (e.lv) e.bar.querySelector('u.lv').style.color = e.lv - S.lv >= 5 ? '#ff5a5a' : e.lv - S.lv >= 2 ? '#ffb05a' : S.lv - e.lv >= 6 ? '#9aa4aa' : '#f2f2e8';
  ENEMIES.push(e); BUS.emit('spawn', e); return e;
}
function makeElite(e){
  e.elite = true; e.hp *= 3; e.max = e.hp; e.dmg *= 1.4; e.spdMul = 1.32; e.m.g.scale.setScalar(1.35);
  const up = new V3(0, 1, 0), r = e.cfg.rad * 0.8, h = Math.min(1.6, e.cfg.top * 0.5);
  for (let i = 0; i < 8; i++){ const a = i / 8 * TAU + 0.3, c = new THREE.Mesh(THORN_G, THORN_M), dir = new V3(Math.cos(a), 0.7 + (i % 2) * 0.5, Math.sin(a)).normalize(); c.quaternion.setFromUnitVectors(up, dir); c.position.set(Math.cos(a) * r, h + (i % 2) * 0.15, Math.sin(a) * r); e.m.body.add(c); }
  const au = glowSprite(0x9a1aff, e.cfg.rad * 6, 0.5); au.position.y = 0.3; e.g.add(au); e.aura = au;
  e.bar.classList.add('elite'); const lu = e.bar.querySelector('u.lv'); if (lu) lu.textContent = `☠ ${lu.textContent}`; else e.bar.insertAdjacentHTML('beforeend', `<u>☠ 검은 가시 · ${e.cfg.name}</u>`);
  burst(new V3(e.pos.x, 0.6, e.pos.z), 0x9a1aff, 40, 5, 0.35, 0.9, -1, 2.5); sfx('elite');
  if (battle && !battle.eliteSeen){ battle.eliteSeen = true; banner('ELITE', `검은 가시에 물든 ${e.cfg.name}`, '체력 3배 · 공격 강화 — 조심해!', true, 2.4); }
}
function hitEnemy(e, dmg, dx, dz, kb, crit){
  if (e.state === 'dying' || e.state === 'spawn' || e.state === 'intro' || e.under) return false;
  e.hp -= dmg; e.flash = 1; if (e.fld && !e.ret){ e.aggro = true; } BUS.emit('hit', { e, dmg, crit });
  const tp = e.pos.clone(); tp.y = e.boss ? e.cfg.top : e.cfg.top + 0.3;
  dmgNum(tp, Math.round(dmg) + (crit ? '!' : ''), crit ? 'crit' : '');
  burst(new V3(e.pos.x, (e.boss ? e.cfg.top * 0.45 : 0.6) + (e.boss ? 0 : e.fly), e.pos.z), crit ? 0xffe08a : 0xffffff, crit ? 14 : 8, 4, 0.16, 0.4, -6, 1);
  const k = e.boss ? 0.05 : e.key === 'golem' ? 0.3 : 1;
  e.vel.x += dx * kb * k; e.vel.z += dz * kb * k;
  if (!e.boss && e.key !== 'golem' && e.key !== 'snail' && !['charge', 'dash', 'leap', 'dive'].includes(e.state)){ e.state = 'stagger'; e.st = 0; e.hop = null; rmTele(e); }
  if (e.hp <= 0) killEnemy(e);
  return true;
}
function killEnemy(e, silent){
  if (e.state === 'dying') return;
  e.state = 'dying'; e.st = 0; e.bar.remove(); if (e.tele){ SW.remove(e.tele); e.tele = null; }
  if (!silent){
    sfx('pop');
    burst(new V3(e.pos.x, 0.6 + e.fly, e.pos.z), 0xfff3a0, e.boss ? 90 : 18, e.boss ? 7 : 3.5, e.boss ? 0.45 : 0.22, 0.9, -2, 2.5);
    burst(new V3(e.pos.x, 0.5 + e.fly, e.pos.z), 0x8aff7a, e.boss ? 60 : 12, e.boss ? 6 : 3, 0.3, 0.9, -4, 2);
    const gap = e.lv ? S.lv - e.lv : 0, pen = gap > 5 ? Math.max(0.1, 1 - (gap - 5) * 0.15) : 1;
    dropOrbs(e.pos, Math.round(e.cfg.exp * (e.expMul ?? 1) * (e.elite ? 3 : 1) * (e.fboss ? 6 : 1) * pen));
    if (e.elite){ burst(new V3(e.pos.x, 0.8, e.pos.z), 0x9a1aff, 50, 6, 0.4, 1.0, -1, 2.5); G.hitStop = Math.max(G.hitStop, 0.12); G.shake = Math.max(G.shake, 0.8); }
  }
  if (battle) battle.kills = (battle.kills || 0) + 1;
  if (!silent) BUS.emit('kill', e);
  if (e.boss && battle && battle.boss === e){ for (const o of ENEMIES) if (o !== e) killEnemy(o); bossEl.classList.remove('on'); G.shake = 1.2; G.hitStop = 0.25; later(1.0, () => win()); }
  else if (e.boss){ G.shake = 1.0; G.hitStop = 0.2; if (bossTarget === e) bossBar(null); }
}
function turn(e, want, k){ const a = angDiff(want, e.g.rotation.y); e.g.rotation.y += a * Math.min(1, k); }
function contact(e, extra = 0.55){
  if (e.hitDone) return;
  if (Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z) < (e.boss ? e.cfg.rad : e.cfg.rad) + extra){ e.hitDone = true; hurtPlayer(e.dmg, e.pos, e.boss ? 8 : 5); }
}
// 지면 사각 경고 (돌진)
const rectMat = () => new THREE.ShaderMaterial({
  uniforms: { uP: { value: 0 }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uP, uTime; varying vec2 vU; void main(){ float along = 1.0 - vU.y; float edge = smoothstep(0.06, 0.0, min(vU.x, 1.0 - vU.x)) + smoothstep(0.02, 0.0, min(vU.y, 1.0 - vU.y)); float fill = step(along, uP) * 0.35; float a = (min(edge, 1.0) * 0.9 + fill + 0.12) * (0.75 + 0.25 * sin(uTime * 20.0)); gl_FragColor = vec4(vec3(1.0, 0.15, 0.25) * a, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
function teleRect(x, z, w, len, ry){ const g = new THREE.PlaneGeometry(w, len); g.rotateX(-Math.PI / 2); g.translate(0, 0, len / 2); const m = new THREE.Mesh(g, rectMat()); m.position.set(x, 0.09, z); m.rotation.y = ry; m.renderOrder = 3; SW.add(m); return m; }
function teleUpd(t, k, dt){ if (!t) return; t.material.uniforms.uP.value = k; t.material.uniforms.uTime.value += dt; }
function rmTele(o){ if (o && o.tele){ SW.remove(o.tele); o.tele.geometry.dispose(); o.tele.material.dispose(); o.tele = null; } }
// 투사체 (도토리 · 벌침)
function mkAcorn(){ const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), sm(0xb07a3a)); b.scale.y = 1.2; g.add(b); const c = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 6, 0, TAU, 0, Math.PI / 2), sm(0x6a4420)); c.position.y = 0.06; g.add(c); return g; }
function mkSting(){ const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 8).rotateX(Math.PI / 2), sm(0xffd23a, { emissive: 0xffa000, emissiveIntensity: 0.6 })); g.add(c); const gl = glowSprite(0xffd060, 0.7, 0.8); g.add(gl); return g; }
function throwArc(from, to, T, dmg, r, big){
  const mesh = mkAcorn(); if (big) mesh.scale.setScalar(1.8); mesh.position.copy(from); SW.add(mesh);
  const o = { kind: 'arc', mesh, from: from.clone(), to: to.clone(), t: 0, T, dmg, r }; o.tele = telegraph(to.x, to.z, r); PROJ.push(o);
}
function mkPetal(){ const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), sm(0xff8ac0, { emissive: 0xff4a90, emissiveIntensity: 0.6 })); p.scale.set(1, 0.3, 0.6); g.add(p); g.add(glowSprite(0xff9ad0, 0.7, 0.7)); return g; }
function shootLine(x, y, z, ang, speed, dmg, life, kind){
  const mesh = kind === 'acorn' || kind === 'nut' ? mkAcorn() : kind === 'petal' ? mkPetal() : mkSting(); if (kind === 'acorn') mesh.scale.setScalar(1.6);
  mesh.position.set(x, y, z); mesh.rotation.y = ang; SW.add(mesh);
  PROJ.push({ kind: 'line', mesh, vx: Math.sin(ang) * speed, vz: Math.cos(ang) * speed, t: 0, life, dmg });
}
function updateProj(dt){
  for (let i = PROJ.length - 1; i >= 0; i--){
    const o = PROJ[i]; o.t += dt; let done = false;
    if (o.kind === 'arc'){
      const k = Math.min(1, o.t / o.T); o.mesh.position.lerpVectors(o.from, o.to, k); o.mesh.position.y += Math.sin(k * Math.PI) * 3; o.mesh.rotation.x += dt * 10;
      teleUpd(o.tele, k, dt);
      if (k >= 1){ done = true; burst(o.to, 0xc89a5a, 10, 3, 0.18, 0.5, -8, 2); if (Math.hypot(player.pos.x - o.to.x, player.pos.z - o.to.z) < o.r + 0.3) hurtPlayer(o.dmg, o.to, 4); }
    } else {
      o.mesh.position.x += o.vx * dt; o.mesh.position.z += o.vz * dt;
      if (Math.hypot(player.pos.x - o.mesh.position.x, player.pos.z - o.mesh.position.z) < 0.6 && Math.abs(PY() + 1 - o.mesh.position.y) < 1.3){ hurtPlayer(o.dmg, o.mesh.position, 3); done = true; burst(o.mesh.position, 0xffd060, 8, 2, 0.15, 0.4); }
      if (o.t > o.life) done = true;
    }
    if (done){ SW.remove(o.mesh); rmTele(o); PROJ.splice(i, 1); }
  }
  for (let i = ROOTS.length - 1; i >= 0; i--){
    const r = ROOTS[i]; r.t += dt;
    if (!r.sp){ teleUpd(r.tele, Math.min(1, r.t / r.T), dt);
      if (r.t >= r.T){ rmTele(r); r.sp = new THREE.Group(); r.sp.position.set(r.x, 0, r.z); for (let k = 0; k < 5; k++){ const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.6, 6), sm(0x6a4a2e, { flatShading: true })); const a = k / 5 * TAU; c.position.set(Math.cos(a) * r.r * 0.45, 0.6, Math.sin(a) * r.r * 0.45); c.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); r.sp.add(c); } const c0 = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.2, 6), sm(0x5a3a22, { flatShading: true })); c0.position.y = 0.9; r.sp.add(c0); SW.add(r.sp); r.sp.scale.y = 0.01;
        burst(new V3(r.x, 0.3, r.z), 0x8a6a3a, 14, 3, 0.2, 0.6, -6, 2); G.shake = Math.max(G.shake, 0.4);
        if (Math.hypot(player.pos.x - r.x, player.pos.z - r.z) < r.r + 0.3) hurtPlayer(r.dmg, new V3(r.x, 0, r.z), 6); } }
    else { const k = r.t - r.T; r.sp.scale.y = k < 0.15 ? k / 0.15 : k > 0.8 ? Math.max(0.01, 1 - (k - 0.8) / 0.3) : 1; if (k > 1.1){ SW.remove(r.sp); ROOTS.splice(i, 1); } }
  }
}
// 몬스터 애니메이션
const ICE_C = new THREE.Color(0.35, 0.75, 1), WHITE_C = new THREE.Color(1, 1, 1);
function animMon(e, dt, moving){
  const m = e.m, t = G.time + e.ph, b = m.body;
  const pop = e.state === 'spawn' || e.state === 'intro' ? ease(Math.min(1, e.st / 0.5)) : 1;
  let sx = 1, sy = 1, sz = 1;
  if (m.kind === 'slime'){
    sx = sz = 1 + Math.sin(t * 5) * 0.04; sy = 1 - Math.sin(t * 5) * 0.05;
    if (e.state === 'wind' || (e.atk && e.atk.phase === 0 && e.atk.type === 'leap')){ const k = Math.min(1, e.st / 0.45); sy = 1 - 0.35 * k; sx = sz = 1 + 0.25 * k; }
    if (e.hop || e.state === 'leap' || (e.atk && e.atk.phase === 1)){ sy = 1.15; sx = sz = 0.9; }
  } else if (m.kind === 'shroom'){
    b.rotation.z = moving ? Math.sin(t * 10) * 0.14 : Math.sin(t * 2) * 0.03;
    m.feet[0].position.z = 0.04 + (moving ? Math.sin(t * 10) * 0.08 : 0); m.feet[1].position.z = 0.04 - (moving ? Math.sin(t * 10) * 0.08 : 0);
    b.rotation.x = e.state === 'wind' ? -0.35 * Math.min(1, e.st / 0.5) : e.state === 'lunge' || (e.atk && e.atk.type === 'charge' && e.atk.phase === 1) ? 0.45 : 0;
    if (e.atk && e.atk.type === 'aoe' && e.atk.phase === 0){ sy = 1 - 0.2 * Math.min(1, e.atk.t); sx = sz = 1 + 0.12 * Math.min(1, e.atk.t); }
  } else if (m.kind === 'bee'){
    for (const [i, w] of m.wings.entries()) w.rotation.z = (i ? -1 : 1) * Math.sin(t * 45) * 0.7;
    b.position.y = Math.sin(t * 3) * 0.08;
    b.rotation.x = e.state === 'dash' || (e.atk && e.atk.type === 'charge' && e.atk.phase === 1) ? 0.6 : e.state === 'wind' ? -0.4 : 0.1;
  } else if (m.kind === 'boar'){
    const rate = e.state === 'charge' || (e.atk && e.atk.phase === 1 && (e.atk.type === 'charge' || e.atk.type === 'charge3')) ? 24 : 12;
    m.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(t * rate + (i % 2 ? 0 : Math.PI) + (i > 1 ? Math.PI : 0)) * 0.6 : 0; });
    b.position.y = moving ? Math.abs(Math.sin(t * rate)) * 0.05 : 0;
    m.head.rotation.x = e.state === 'wind' || (e.atk && e.atk.phase === 0) ? 0.35 + Math.sin(t * 20) * 0.05 : 0;
  } else if (m.kind === 'sprout'){
    b.position.y = moving ? Math.abs(Math.sin(t * 9)) * 0.08 : 0; m.crown.rotation.z = Math.sin(t * 3) * 0.15;
    m.arms[0].rotation.z = e.state === 'wind' ? 1.6 * Math.min(1, e.st / 0.6) : Math.sin(t * 9) * 0.3; m.arms[1].rotation.z = -Math.sin(t * 9) * 0.3;
  } else if (m.kind === 'golem'){
    b.rotation.z = moving ? Math.sin(t * 4) * 0.08 : 0;
    const up = e.state === 'wind' ? Math.min(1, e.st / e.cfg.wind) : 0;
    for (const [i, a] of m.arms.entries()) a.rotation.x = -2.4 * up + (moving ? Math.sin(t * 4 + i * Math.PI) * 0.3 : 0);
  } else if (m.kind === 'squirrel'){
    b.position.y = moving ? Math.abs(Math.sin(t * 12)) * 0.15 : 0; m.tail.rotation.x = Math.sin(t * 3) * 0.2 - (e.state === 'wind' ? 0.4 : 0);
  } else if (m.kind === 'frog'){
    sy = 1 + Math.sin(t * 3) * 0.04; if (e.state === 'wind'){ sy = 0.8; sx = sz = 1.12; } if (e.hop || e.state === 'leap'){ sy = 1.2; sx = sz = 0.9; }
    e.tongueT = Math.max(0, (e.tongueT || 0) - dt); m.tongue.scale.z = e.tongueT > 0 ? Math.sin(e.tongueT / 0.35 * Math.PI) * 4.2 : 0.01;
  } else if (m.kind === 'ladybug'){
    b.position.y = moving ? Math.abs(Math.sin(t * 18)) * 0.04 : 0; b.rotation.x = e.state === 'wind' ? -0.25 : 0;
  } else if (m.kind === 'snail'){
    sz = 1 + (moving ? Math.sin(t * 3) * 0.08 : 0); m.shell.rotation.z = Math.sin(t * 1.5) * 0.08; b.rotation.x = e.state === 'wind' ? -0.2 : e.state === 'lunge' ? 0.25 : 0;
  } else if (m.kind === 'flower'){
    m.head.rotation.z = Math.sin(t * 1.5) * 0.2; if (e.state === 'wind'){ const k = Math.min(1, e.st / e.cfg.wind); m.head.scale.setScalar(1 + k * 0.3); } else m.head.scale.setScalar(1);
  } else if (m.kind === 'raccoon'){
    m.tail.rotation.y = Math.sin(t * 6) * 0.4; b.position.y = moving ? Math.abs(Math.sin(t * 12)) * 0.06 : 0;
    const sw = e.state === 'lunge' ? -2.2 : e.state === 'wind' ? -0.5 : Math.sin(t * 12) * (moving ? 0.5 : 0.1); m.arms[0].rotation.x = sw; m.arms[1].rotation.x = e.state === 'lunge' ? -1.6 : -sw;
  } else if (m.kind === 'mole'){
    const target = e.under && e.state !== 'surface' ? -0.75 : 0; b.position.y += (target - b.position.y) * Math.min(1, dt * 10); b.rotation.z = moving && !e.under ? Math.sin(t * 10) * 0.1 : 0;
  } else if (m.kind === 'owl'){
    for (const [i, w] of m.wings.entries()) w.rotation.z = (i ? -1 : 1) * Math.sin(t * (e.state === 'dive' ? 8 : 14)) * 0.6;
    b.rotation.x = e.state === 'dive' ? 0.6 : e.state === 'wind' ? -0.35 : 0;
  } else if (m.kind === 'hedgehog'){
    const rolling = e.state === 'charge'; m.core.rotation.x = rolling ? m.core.rotation.x + dt * 18 : m.core.rotation.x * Math.max(0, 1 - dt * 8);
    b.position.y = moving && !rolling ? Math.abs(Math.sin(t * 10)) * 0.05 : 0; if (e.state === 'wind'){ const k = Math.min(1, e.st / e.cfg.wind); sx = sz = 1 - k * 0.15; sy = 1 - k * 0.15; }
  } else if (m.kind === 'treant'){
    m.canopy.rotation.z = Math.sin(t * 0.8) * 0.05; b.rotation.z = Math.sin(t * 0.7) * 0.03;
    let ar = Math.sin(t * 1.2) * 0.1;
    if (e.atk && e.atk.type === 'sweep') ar = e.atk.phase === 0 ? -0.9 * Math.min(1, e.atk.t / 0.9) : 0.9;
    if (e.atk && e.atk.type === 'roots') ar = e.atk.t < 0.4 ? -1.2 * e.atk.t / 0.4 : 0.6;
    m.arms[0].rotation.x = ar; m.arms[1].rotation.x = ar;
  }
  b.scale.set(sx * pop, sy * pop, sz * pop);
  // 피격 섬광
  e.flash = Math.max(0, e.flash - dt * 6);
  const fz = e.frz > 0 ? 1 : 0;
  m.mats.forEach((mt, i) => { const [c, k] = e.base[i]; mt.emissive.copy(c).lerp(ICE_C, fz * 0.8).lerp(WHITE_C, e.flash); mt.emissiveIntensity = k + e.flash * 1.2 + fz * 0.6; });
  const angry = e.elite || e.enraged || e.state === 'wind' || e.state === 'charge' || e.state === 'lunge' || e.state === 'dash' || e.state === 'dive' || (e.atk && e.atk.phase <= 1);
  for (const ey of e.eyes) ey.material = angry ? RED_EYE_M : EYE_M;
}
function updateMon(e, dt, d, dx, dz, face){
  const c = e.cfg; let moving = false;
  if (e.state === 'chase'){
    e.atkCd -= dt;
    if (c.style === 'turret'){
      turn(e, face, dt * 3);
      if (e.atkCd <= 0 && d < c.range && !dead){ e.state = 'wind'; e.st = 0; }
    } else if (c.style === 'burrow'){
      e.under = true; turn(e, face, dt * 8);
      if (d > 0.6){ e.pos.x += dx / d * c.spd * dt; e.pos.z += dz / d * c.spd * dt; moving = true; }
      if (R() < dt * 14) burst(new V3(e.pos.x, 0.1, e.pos.z), 0x8a6a40, 2, 1.5, 0.22, 0.5, -6, 1.5);
      if (d < 1.4 && e.atkCd <= 0 && !dead){ e.state = 'wind'; e.st = 0; e.tx = player.pos.x; e.tz = player.pos.z; e.tele = telegraph(e.tx, e.tz, 1.4); }
    } else if (c.style === 'dive'){
      turn(e, face, dt * 4);
      const want = d < 5 ? -1 : d > 8 ? 1 : 0;
      if (want){ e.pos.x += dx / d * c.spd * want * dt; e.pos.z += dz / d * c.spd * want * dt; moving = true; }
      if (e.atkCd <= 0 && d < c.range && !dead){ e.state = 'wind'; e.st = 0; e.dir = face; e.tele = teleRect(e.pos.x, e.pos.z, 1.2, 11, face); }
    } else if (c.style === 'ranged' || c.style === 'shooter'){
      turn(e, face, dt * 6);
      const want = d < 5 ? -1 : d > 7.5 ? 1 : 0;
      if (want){ e.pos.x += dx / d * c.spd * want * dt; e.pos.z += dz / d * c.spd * want * dt; moving = true; }
      if (e.atkCd <= 0 && d < 11 && !dead){ e.state = 'wind'; e.st = 0; }
    } else if (c.style === 'hop'){
      if (e.hop){ e.hop.t += dt; const k = Math.min(1, e.hop.t / e.hop.T); e.pos.x = e.hop.fx + (e.hop.tx - e.hop.fx) * k; e.pos.z = e.hop.fz + (e.hop.tz - e.hop.fz) * k; e.pos.y = Math.sin(k * Math.PI) * 0.6; if (k >= 1){ e.hop = null; e.pos.y = 0; e.hopT = rr(0.25, 0.6); } }
      else { e.hopT -= dt; turn(e, face, dt * 8);
        if (d < c.range && e.atkCd <= 0 && !dead){ e.state = 'wind'; e.st = 0; if (c.tongue){ e.dir = face; e.tele = teleRect(e.pos.x, e.pos.z, 0.8, 4.2, face); } }
        else if (e.hopT <= 0 && d > 1.2){ const s = Math.min(d - 1.0, 1.7); e.hop = { t: 0, T: 0.42, fx: e.pos.x, fz: e.pos.z, tx: e.pos.x + dx / d * s, tz: e.pos.z + dz / d * s }; } }
    } else {
      turn(e, face, dt * 6);
      if (d > c.range * 0.8){ const sp = c.spd; e.pos.x += dx / d * sp * dt; e.pos.z += dz / d * sp * dt; moving = true; }
      if (d < c.range && e.atkCd <= 0 && !dead){ e.state = 'wind'; e.st = 0; e.cn = e.cn || 0; if (c.style === 'charge'){ e.dir = face; e.tele = teleRect(e.pos.x, e.pos.z, c.cw || 1.4, c.clen || 9, face); } }
    }
  } else if (e.state === 'wind'){
    const k = Math.min(1, e.st / c.wind);
    if (c.style === 'charge' || c.style === 'dive' || c.tongue){ if (k < 0.65){ turn(e, face, dt * 4); e.dir = e.g.rotation.y; } if (e.tele){ e.tele.position.set(e.pos.x, 0.09, e.pos.z); e.tele.rotation.y = e.dir; teleUpd(e.tele, k, dt); } }
    else if (c.style === 'burrow'){ teleUpd(e.tele, k, dt); e.pos.x += (e.tx - e.pos.x) * Math.min(1, dt * 6); e.pos.z += (e.tz - e.pos.z) * Math.min(1, dt * 6); if (R() < dt * 20) burst(new V3(e.tx + rr(-0.8, 0.8), 0.1, e.tz + rr(-0.8, 0.8)), 0x8a6a40, 2, 2, 0.2, 0.5, -6, 2); }
    else turn(e, face, dt * 3);
    if (e.st >= c.wind){
      e.st = 0; e.hitDone = false;
      if (c.tongue){ e.state = 'recover'; rmTele(e); e.tongueT = 0.35; sfx('throw'); const lx = player.pos.x - e.pos.x, lz = player.pos.z - e.pos.z, along = lx * Math.sin(e.dir) + lz * Math.cos(e.dir), side = Math.abs(lx * Math.cos(e.dir) - lz * Math.sin(e.dir)); if (along > 0 && along < 4.4 && side < 0.75) hurtPlayer(e.dmg, e.pos, 4); }
      else if (c.style === 'burrow'){ e.state = 'surface'; rmTele(e); e.under = false; e.pos.x = e.tx; e.pos.z = e.tz; sfx('boing'); burst(new V3(e.tx, 0.3, e.tz), 0x8a6a40, 20, 4, 0.3, 0.7, -8, 3); G.shake = Math.max(G.shake, 0.35); if (Math.hypot(player.pos.x - e.tx, player.pos.z - e.tz) < 1.5) hurtPlayer(e.dmg, e.pos, 6); }
      else if (c.style === 'dive'){ e.state = 'dive'; rmTele(e); sfx('buzz'); }
      else if (c.style === 'turret'){ e.state = 'recover'; sfx('throw'); for (let i = 0; i < 5; i++){ const a = e.g.rotation.y + (i - 2) * 0.3; shootLine(e.pos.x, 1.05, e.pos.z, a, 7.5, e.dmg, 2.4, 'petal'); } }
      else if (c.style === 'shooter'){ e.state = 'recover'; sfx('throw'); shootLine(e.pos.x, 0.8, e.pos.z, face, 13, e.dmg, 1.4, 'nut'); }
      else if (c.style === 'hop'){ e.state = 'leap'; const s = Math.min(d, 3); e.L = { fx: e.pos.x, fz: e.pos.z, tx: e.pos.x + dx / (d || 1) * s, tz: e.pos.z + dz / (d || 1) * s }; }
      else if (c.style === 'lunge'){ e.state = 'lunge'; e.dir = e.g.rotation.y; }
      else if (c.style === 'dash'){ e.state = 'dash'; e.dir = e.g.rotation.y; sfx('buzz'); }
      else if (c.style === 'charge'){ e.state = 'charge'; rmTele(e); sfx('stomp'); }
      else if (c.style === 'ranged'){ e.state = 'recover'; throwArc(new V3(e.pos.x, 1.0, e.pos.z), new V3(player.pos.x + rr(-0.6, 0.6), 0.1, player.pos.z + rr(-0.6, 0.6)), 1.0, e.dmg, 0.9); sfx('throw'); }
      else if (c.style === 'slam'){ e.state = 'recover'; const fx = e.pos.x + Math.sin(e.g.rotation.y) * 1.3, fz = e.pos.z + Math.cos(e.g.rotation.y) * 1.3; shockwave(fx, 0.12, fz, 2.4, 0x9acc6a, 0.4); burst(new V3(fx, 0.2, fz), 0x8a8a7a, 16, 4, 0.22, 0.6, -8, 2); G.shake = Math.max(G.shake, 0.5); sfx('stomp'); if (Math.hypot(player.pos.x - fx, player.pos.z - fz) < 2.3) hurtPlayer(e.dmg, new V3(fx, 0, fz), 7); }
    }
  } else if (e.state === 'leap'){
    const k = Math.min(1, e.st / 0.5); e.pos.x = e.L.fx + (e.L.tx - e.L.fx) * k; e.pos.z = e.L.fz + (e.L.tz - e.L.fz) * k; e.pos.y = Math.sin(k * Math.PI) * 1.3;
    if (k >= 1){ e.pos.y = 0; e.state = 'recover'; e.st = 0; burst(new V3(e.pos.x, 0.2, e.pos.z), 0x8aff7a, 10, 2.5, 0.2, 0.5, -6, 1); if (Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z) < 1.35) hurtPlayer(e.dmg, e.pos, 5); }
  } else if (e.state === 'surface'){
    if (e.st > 1.7){ e.state = 'chase'; e.atkCd = rr(0.8, 1.6); }
  } else if (e.state === 'lunge' || e.state === 'dash' || e.state === 'charge' || e.state === 'dive'){
    const sp = e.state === 'lunge' ? (c.spd < 1.5 ? 5 : 7) : e.state === 'dash' ? 13 : e.state === 'dive' ? 14 : (c.cspd || 12), T = e.state === 'lunge' ? 0.28 : e.state === 'dash' ? 0.42 : e.state === 'dive' ? 0.75 : (c.clen || 9.6) / (c.cspd || 12);
    e.pos.x += Math.sin(e.dir) * sp * dt; e.pos.z += Math.cos(e.dir) * sp * dt; moving = true; contact(e);
    if (e.st >= T){ if (e.state === 'lunge' && c.combo && (e.cn = (e.cn || 0) + 1) < c.combo){ e.state = 'wind'; e.st = c.wind * 0.5; e.hitDone = false; } else { e.cn = 0; e.state = 'recover'; e.st = 0; } }
  } else if (e.state === 'recover'){
    if (e.st > (c.style === 'charge' ? 0.8 : c.style === 'turret' ? 1.1 : 0.5)){ e.state = 'chase'; e.atkCd = rr(0.55, 1.4) * (c.style === 'turret' ? 1.4 : 1); }
  } else if (e.state === 'stagger'){
    if (e.st > 0.3){ e.state = 'chase'; e.atkCd = Math.max(e.atkCd, 0.4); rmTele(e); }
  }
  return moving;
}
// 보스 공격 패턴
function startAtk(e){
  const c = e.cfg, frac = e.hp / e.max;
  let opts = c.atks.filter(a => a[0] !== 'summon' || (e.summons < 2 && frac < 1 - 0.34 * (e.summons + 1)));
  if (opts.length > 1 && e.lastAtk) opts = opts.filter(a => a !== e.lastAtk) .length ? opts.filter(a => a !== e.lastAtk) : opts;
  const pick = opts.find(a => a[0] === 'summon') || opts[(R() * opts.length) | 0];
  e.lastAtk = pick; e.atk = { type: pick[0], a: pick, t: 0, phase: 0, n: 0 };
}
function arenaClamp(p, m = 1){ return CLAMP ? CLAMP(p, m) : clampShapes(p, m); }
function updateBoss(e, dt, d, dx, dz, face){
  const c = e.cfg; let moving = false;
  const A = e.atk;
  if (!A){
    turn(e, face, dt * 3);
    if (d > c.rad + 1.8 && !dead){ e.pos.x += dx / d * c.spd * dt; e.pos.z += dz / d * c.spd * dt; moving = true; }
    e.atkCd -= dt;
    if (e.atkCd <= 0 && !dead) startAtk(e);
    return moving;
  }
  A.t += dt;
  const end = (cd = rr(0.9, 1.6)) => { rmTele(A); e.atk = null; e.atkCd = cd; e.pos.y = e.fly ? 0 : 0; };
  switch (A.type){
    case 'leap': {
      const r = A.a[1];
      if (A.phase === 0){ turn(e, face, dt * 4); if (A.t > 0.5){ A.phase = 1; A.t = 0; A.from = e.pos.clone(); A.to = arenaClamp(new V3(player.pos.x, 0, player.pos.z), 1.5); A.tele = telegraph(A.to.x, A.to.z, r); sfx('boing'); } }
      else if (A.phase === 1){ const k = Math.min(1, A.t / 0.95); e.pos.x = A.from.x + (A.to.x - A.from.x) * ease(k); e.pos.z = A.from.z + (A.to.z - A.from.z) * ease(k); e.pos.y = Math.sin(k * Math.PI) * 5; teleUpd(A.tele, k, dt);
        if (k >= 1){ e.pos.y = 0; rmTele(A); A.phase = 2; A.t = 0; shockwave(e.pos.x, 0.12, e.pos.z, r + 1, 0x8aff7a, 0.55); burst(new V3(e.pos.x, 0.3, e.pos.z), 0x8aff7a, 40, 6, 0.3, 0.7, -6, 2); sfx('boom'); G.shake = 1.1;
          if (Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z) < r + 0.3) hurtPlayer(e.dmg * 1.3, e.pos, 9); } }
      else if (A.t > 0.7) end();
      break;
    }
    case 'aoe': {
      const r = A.a[1];
      if (A.phase === 0){ if (!A.tele) A.tele = telegraph(e.pos.x, e.pos.z, r); A.tele.position.set(e.pos.x, 0.08, e.pos.z); teleUpd(A.tele, Math.min(1, A.t / 1.1), dt);
        if (A.t > 1.1){ rmTele(A); A.phase = 1; A.t = 0; const col = e.key === 'chief' ? 0xc8a0ff : 0xc8a070; shockwave(e.pos.x, 0.15, e.pos.z, r + 0.5, col, 0.6); burst(new V3(e.pos.x, 1, e.pos.z), col, 60, r * 1.4, 0.4, 1.2, -1, 1.5); sfx(e.key === 'chief' ? 'puff' : 'boom'); G.shake = 0.9;
          if (d < r + 0.3) hurtPlayer(e.dmg * 1.1, e.pos, 8); } }
      else if (A.t > 0.6) end();
      break;
    }
    case 'charge': case 'charge3': {
      const [, len, w, sp] = A.a;
      if (A.phase === 0){
        if (!A.tele){ A.dir = face; A.tele = teleRect(e.pos.x, e.pos.z, w, len, face); }
        if (A.t < 0.6){ turn(e, face, dt * 5); A.dir = e.g.rotation.y; }
        A.tele.position.set(e.pos.x, 0.09, e.pos.z); A.tele.rotation.y = A.dir; teleUpd(A.tele, Math.min(1, A.t / 0.9), dt);
        if (A.t > 0.9){ rmTele(A); A.phase = 1; A.t = 0; e.hitDone = false; sfx(e.key === 'queen' ? 'buzz' : 'stomp'); }
      } else if (A.phase === 1){
        e.pos.x += Math.sin(A.dir) * sp * dt; e.pos.z += Math.cos(A.dir) * sp * dt; moving = true; contact(e, 0.8);
        if (R() < dt * 30) burst(new V3(e.pos.x, 0.2, e.pos.z), 0xb89a6a, 2, 2, 0.25, 0.5, -2, 1);
        if (A.t > len / sp){ A.phase = 2; A.t = 0; }
      } else if (A.t > 0.45){
        A.n++; if (A.type === 'charge3' && A.n < 3){ A.phase = 0; A.t = 0; } else end();
      }
      break;
    }
    case 'barrage': {
      const [, n, spread, sp, kind] = A.a;
      turn(e, face, dt * 4);
      if (A.phase === 0 && A.t > 0.7){ A.phase = 1; sfx('throw');
        for (let i = 0; i < n; i++){ const ang = e.g.rotation.y + (i - (n - 1) / 2) * spread / Math.max(1, n - 1) * 2; shootLine(e.pos.x + Math.sin(ang) * c.rad, 1.1 + e.fly * 0.6, e.pos.z + Math.cos(ang) * c.rad, ang, sp, e.dmg * 0.8, 2.6, kind); } }
      if (A.t > 1.3) end();
      break;
    }
    case 'roots': {
      const [, n, r] = A.a;
      if (A.phase === 0 && A.t > 0.4){ A.phase = 1; sfx('rumble');
        for (let i = 0; i < n; i++){ const p = i === 0 ? new V3(player.pos.x, 0, player.pos.z) : arenaClamp(new V3(player.pos.x + rr(-4.5, 4.5), 0, player.pos.z + rr(-4.5, 4.5)), 1); const o = { x: p.x, z: p.z, r, t: -i * 0.12, T: 1.1, dmg: e.dmg }; o.tele = telegraph(p.x, p.z, r); ROOTS.push(o); } }
      if (A.t > 2.0) end();
      break;
    }
    case 'sweep': {
      const [, r, span] = A.a;
      if (A.phase === 0){ if (!A.tele){ A.tele = telegraph(e.pos.x, e.pos.z, r, e.g.rotation.y, span); } if (A.t < 0.5) turn(e, face, dt * 3); A.tele.rotation.y = e.g.rotation.y; teleUpd(A.tele, Math.min(1, A.t / 0.95), dt);
        if (A.t > 0.95){ rmTele(A); A.phase = 1; A.t = 0; trail(e.g.rotation.y, 2.0, 0, false, 0x9aff6a); sfx('swing'); G.shake = 0.8;
          if (d < r + 0.2 && Math.abs(angDiff(face, e.g.rotation.y)) < span / 2 + 0.1) hurtPlayer(e.dmg * 1.2, e.pos, 9); } }
      else if (A.t > 0.7) end();
      break;
    }
    case 'summon': {
      const [, kind, n] = A.a;
      if (A.phase === 0 && A.t > 0.7){ A.phase = 1; e.summons++; sfx('summon'); banner('', `${c.title}가 친구들을 불렀다!`, '', false, 1.6);
        for (let i = 0; i < n; i++){ const a = e.g.rotation.y + Math.PI + (i - (n - 1) / 2) * 0.9, p = arenaClamp(new V3(e.pos.x + Math.sin(a) * (c.rad + 2), 0, e.pos.z + Math.cos(a) * (c.rad + 2)), 1); const sm2 = spawnMon(kind, p.x, p.z, false, e.lv ? { lv: Math.max(1, e.lv - 2), fld: e.fld ? { hx: e.fld.hx, hz: e.fld.hz, leash: e.fld.leash } : null } : {}); if (sm2.fld) sm2.aggro = true; } }
      if (A.t > 1.3) end(1.0);
      break;
    }
  }
  return moving;
}
let bossTarget = null;
function bossBar(e){ bossTarget = e; if (!e){ bossEl.classList.remove('on'); return; } bossEl.querySelector('.n').textContent = e.label ? `${e.lv ? 'Lv.' + e.lv + ' ' : ''}${e.label}` : `${e.cfg.title || ''} · ${e.cfg.name}`; bossEl.classList.add('on'); }
const GOFF_SKIP = new Set();
function gOffB(){ const r = this._gyR; this._gyO = MODE === 'field' && GYF ? GYF(r.position.x, r.position.z) : 0; this.matrixWorld.elements[13] += this._gyO; }
function gOffA(){ this.matrixWorld.elements[13] -= this._gyO || 0; this._gyO = 0; }
function gOffBS(rn, o, cam, scam){ gOffB.call(this); this.modelViewMatrix.multiplyMatrices(scam.matrixWorldInverse, this.matrixWorld); }
function gOffInstall(){
  for (const c of SW.children){ if (GOFF_SKIP.has(c)) continue;
    c.traverse(o => { if (o._gyR || !(o.isMesh || o.isSprite || o.isLine || o.isPoints)) return; o._gyR = c; o.frustumCulled = false; o.onBeforeRender = gOffB; o.onAfterRender = gOffA; o.onBeforeShadow = gOffBS; o.onAfterShadow = gOffA; }); }
}
function updateEnemies(dt){
  const alive = [];
  for (let i = ENEMIES.length - 1; i >= 0; i--){
    const e = ENEMIES[i]; e.st += dt;
    if (e.state === 'dying'){
      const k = Math.min(1, e.st / 0.45); e.m.body.scale.setScalar(Math.max(0.01, (1 - k) * (1 + k * 0.4))); e.g.rotation.y += dt * 10; e.pos.y += dt * (e.boss ? 0.5 : 1.5);
      if (e.st > 0.5){ SW.remove(e.g); ENEMIES.splice(i, 1); }
      continue;
    }
    alive.push(e);
    const dx = player.pos.x - e.pos.x, dz = player.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 0.001, face = Math.atan2(dx, dz);
    let moving = false;
    // ── 필드 몬스터: 배회 → 어그로 → 귀환 ──
    if (e.fld && e.state !== 'spawn'){
      const f = e.fld, hx = e.pos.x - f.hx, hz = e.pos.z - f.hz, hd = Math.hypot(hx, hz);
      e.far = d > 110 && !e.aggro; e.g.visible = !e.far;
      if (e.far){ e.bar.style.display = 'none'; continue; }
      if (e.aggro && (dead || hd > f.leash || d > Math.max(f.aggro * 3, 22))){ e.aggro = false; e.ret = true; rmTele(e); if (e.atk){ rmTele(e.atk); e.atk = null; } e.state = 'chase'; e.hop = null; e.under = false; }
      if (!e.aggro){
        if (e.ret){ const sp = (e.cfg.spd || 2.5) * 1.6; e.hp = Math.min(e.max, e.hp + e.max * 0.5 * dt); if (hd > 1){ e.pos.x -= hx / hd * sp * dt; e.pos.z -= hz / hd * sp * dt; turn(e, Math.atan2(-hx, -hz), dt * 8); moving = true; } else e.ret = false; }
        else if (!dead && d < f.aggro && !f.passive){ e.aggro = true; e.atkCd = Math.max(e.atkCd, rr(0.4, 1.0)); dmgNum(new V3(e.pos.x, e.cfg.top + 0.5, e.pos.z), '!', 'aggro'); }
        else { e.wt -= dt;
          if (e.wp){ const wx = e.wp[0] - e.pos.x, wz = e.wp[1] - e.pos.z, wd = Math.hypot(wx, wz); if (wd < 0.5 || e.wt < -6){ e.wp = null; e.wt = rr(1.5, 5); } else if (e.cfg.spd > 0){ const sp = e.cfg.spd * 0.4; e.pos.x += wx / wd * sp * dt; e.pos.z += wz / wd * sp * dt; turn(e, Math.atan2(wx, wz), dt * 5); moving = true; } }
          else if (e.wt <= 0){ const a = R() * TAU, r = Math.sqrt(R()) * f.wr; e.wp = [f.hx + Math.cos(a) * r, f.hz + Math.sin(a) * r]; e.wt = 0; } }
        if (e.state !== 'chase'){ rmTele(e); e.state = 'chase'; }
        animMon(e, dt, moving);
        if (!e.fly) e.pos.y = 0; else e.pos.y = e.fly + Math.sin(G.time * 2 + e.ph) * 0.12;
        G.collide(e.pos, e.cfg.rad * 0.9); arenaClamp(e.pos, e.cfg.rad * 0.6);
        continue;
      }
    }
    if (e.ai && e.state !== 'spawn' && e.state !== 'intro' && !(e.stun > 0)) moving = e.ai(e, dt * (e.spdMul || 1), d, dx, dz, face) || false;
    else if (e.state === 'spawn'){ if (e.st > 0.55){ e.state = e.boss ? 'chase' : 'chase'; } }
    else if (e.state === 'intro'){ turn(e, face, dt * 2); }
    else if (e.stun > 0){ e.stun -= dt; e.frz = Math.max(0, (e.frz || 0) - dt);
      if (e.boss){ if (e.atk){ rmTele(e.atk); e.atk = null; e.atkCd = 0.7; } }
      else if (e.state !== 'chase'){ rmTele(e); e.hop = null; e.state = 'chase'; e.atkCd = Math.max(e.atkCd, 0.5); }
      if (!e.frz && R() < dt * 5) burst(new V3(e.pos.x + rr(-0.3, 0.3), e.cfg.top + 0.2, e.pos.z + rr(-0.3, 0.3)), 0xffe060, 1, 0.5, 0.25, 0.5, 0, 0.3); }
    else if (e.boss) moving = updateBoss(e, dt * (e.spdMul || 1), d, dx, dz, face);
    else moving = updateMon(e, dt * (e.spdMul || 1), d, dx, dz, face);
    if (e.dot){ e.dot.t -= dt; e.dot.k -= dt; if (e.dot.k <= 0){ e.dot.k = 0.5; const v = e.dot.dps * 0.5; e.hp -= v; e.flash = Math.max(e.flash, 0.3); dmgNum(new V3(e.pos.x, e.cfg.top + 0.2, e.pos.z), Math.round(v), 'dot'); burst(new V3(e.pos.x, 0.6 + e.fly, e.pos.z), e.dot.col, 4, 1.5, 0.2, 0.5, 1, 1); if (e.hp <= 0){ killEnemy(e); continue; } } if (e.dot && e.dot.t <= 0) e.dot = null; }
    if (e.boss && !e.enraged && e.hp < e.max * 0.5 && e.state !== 'intro'){ e.enraged = true; e.spdMul = 1.38; sfx('roar'); G.shake = 1.0; banner('ENRAGE', `${e.cfg.name} 광폭화!`, '공격이 훨씬 빨라졌다', true, 2.2);
      e.base = e.base.map(([c, k]) => [new THREE.Color(0.7, 0.04, 0.08), Math.max(k, 0.55)]); const au = glowSprite(0xff2a3a, e.cfg.rad * 5, 0.45); au.position.y = 0.5; e.g.add(au); e.aura = au; burst(new V3(e.pos.x, e.cfg.top * 0.5, e.pos.z), 0xff2a3a, 80, 8, 0.4, 1, -1, 2); }
    if (e.aura){ e.aura.material.opacity = 0.35 + Math.sin(G.time * 5 + e.ph) * 0.15; if (R() < dt * 10) burst(new V3(e.pos.x + rr(-0.5, 0.5), 0.3, e.pos.z + rr(-0.5, 0.5)), e.enraged ? 0xff3a2a : 0x8a1aff, 1, 0.6, 0.3, 0.8, 2, 1.2); }
    animMon(e, dt, moving);
    e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt; e.vel.multiplyScalar(Math.exp(-7 * dt));
    if (e.state !== 'spawn'){ G.collide(e.pos, e.cfg.rad * 0.9); arenaClamp(e.pos, e.cfg.rad * 0.6); }
    const hov = e.fly ? e.fly + Math.sin(G.time * 2 + e.ph) * 0.12 : 0;
    if (e.fly) e.pos.y = hov + (e.boss && e.atk && e.atk.type === 'charge' && e.atk.phase === 1 ? -1.2 : 0) - (e.state === 'dive' ? Math.sin(Math.min(1, e.st / 0.75) * Math.PI) * 2.3 : 0);
  }
  for (let i = 0; i < alive.length; i++){
    const a = alive[i];
    for (let j = i + 1; j < alive.length; j++){ const b = alive[j], dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.cfg.rad + b.cfg.rad; if (d < m && d > 1e-4){ const k = (m - d) / 2 / d; if (!a.boss){ a.pos.x -= dx * k; a.pos.z -= dz * k; } if (!b.boss){ b.pos.x += dx * k; b.pos.z += dz * k; } } }
    if ((a.fly && !a.boss) || a.under) continue;
    const dx = player.pos.x - a.pos.x, dz = player.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.cfg.rad + 0.36;
    if (d < m && d > 1e-4 && !roll){ player.pos.x = a.pos.x + dx / d * m; player.pos.z = a.pos.z + dz / d * m; }
  }
  G.mapEnemies = alive.map(e => ({ x: e.pos.x, z: e.pos.z, big: e.boss }));
  for (const e of alive){
    if (e.far) continue;
    if (e.boss && (!e.fld || bossTarget === e)){ bossEl.querySelector('i').style.width = (e.hp / e.max * 100) + '%'; bossEl.querySelector('s').style.width = (e.hp / e.max * 100) + '%'; continue; }
    if ((e.hp >= e.max && !e.elite && !(e.label && e.fld && Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z) < 16)) || e.under){ e.bar.style.display = 'none'; continue; }
    const hp = e.pos.clone(); hp.y = e.cfg.top + 0.15 + (e.fly ? e.pos.y - e.fly : 0);
    const s = toScreen(hp); if (!s.vis){ e.bar.style.display = 'none'; continue; }
    e.bar.style.display = 'block'; e.bar.style.left = s.x + 'px'; e.bar.style.top = s.y + 'px'; e.bar.firstChild.style.width = (e.hp / e.max * 100) + '%';
  }
  return alive;
}

// ───────────────────────── 대화 ─────────────────────────
let dialogOpen = false, dlgAdvance = null, dlgFull = false;
const NAMES = { k: '룬 지기 엘드라', s: '대장장이 브론', q: '???' };
const SPK = { k: () => keeper, b: () => battle && battle.boss && { root: battle.boss.g, big: true } };
Object.defineProperty(NAMES, 'b', { get: () => battle && battle.boss ? `${battle.boss.cfg.title} 「${battle.boss.cfg.name}」` : '???' });
function camFor(fg){
  const pp = player.pos, sp = fg ? fg.root.position : pp;
  const mid = new V3((pp.x + sp.x) / 2, Math.max(pp.y, sp.y) + 1.35, (pp.z + sp.z) / 2);
  let dx = sp.x - pp.x, dz = sp.z - pp.z, d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
  const side = new V3(dz, 0, -dx), big = fg && (fg.big || fg.root.scale.x > 1.5);
  const pos = mid.clone().addScaledVector(side, (big ? 7 : 2.6) + d * 0.5).addScaledVector(new V3(-dx, 0, -dz), big ? 2 : 0.8); pos.y += big ? 1.2 : 0.35;
  const look = mid.clone(); if (big) look.y += 1.5;
  return { pos, look };
}
async function say(lines){
  dialogOpen = true; G.lock = true; document.body.classList.add('cine'); dlg.classList.add('on'); hint('', 0);
  let res = 0;
  for (const L of lines){
    const who = L[0], text = L[1], choices = L[2];
    const f = SPK[who] && SPK[who]();
    if (f && who !== 'b'){ const a = Math.atan2(player.pos.x - f.root.position.x, player.pos.z - f.root.position.z); f.root.rotation.y = a; }
    if (f){ player.fig.root.rotation.y = Math.atan2(f.root.position.x - player.pos.x, f.root.position.z - player.pos.z); }
    G.camOverride = camFor(f || null);
    const w = dlg.querySelector('.who'); w.textContent = NAMES[who] || who; w.classList.toggle('enemy', who === 'b' || who === 'q');
    const tx = dlg.querySelector('.txt'), ch = dlg.querySelector('.ch'); ch.innerHTML = ''; dlg.querySelector('.nx').style.display = 'none';
    tx.textContent = ''; dlgFull = false;
    let i = 0; const chars = [...text];
    await new Promise(done => {
      let iv = setInterval(() => { if (dlgFull){ tx.textContent = text; clearInterval(iv); done(); return; } tx.textContent += chars[i++] || ''; if (i % 3 === 0) sfx('type'); if (i >= chars.length){ clearInterval(iv); done(); } }, 28);
      dlgAdvance = () => { dlgFull = true; };
    });
    dlgFull = true;
    if (choices){
      res = await new Promise(done => { choices.forEach((c, k) => { const b = document.createElement('button'); b.textContent = c; b.onclick = ev => { ev.stopPropagation(); sfx('ui'); done(k); }; ch.appendChild(b); }); dlgAdvance = null; });
    } else {
      dlg.querySelector('.nx').style.display = '';
      await new Promise(done => { dlgAdvance = () => { sfx('ui'); done(); }; });
    }
  }
  dlg.classList.remove('on'); document.body.classList.remove('cine'); G.camOverride = null; G.lock = false; dialogOpen = false; dlgAdvance = null;
  return res;
}
dlg.addEventListener('click', () => dlgAdvance && dlgAdvance());

// ───────────────────────── UI 헬퍼 ─────────────────────────
let bannerT = 0, hintT = 0;
function banner(a, b, c, red, dur = 2.5){ banner_.a.textContent = a; banner_.b.textContent = b; banner_.c.textContent = c || ''; bannerEl.classList.toggle('red', !!red); bannerEl.classList.add('on'); bannerT = dur; }
const banner_ = { a: bannerEl.querySelector('.a'), b: bannerEl.querySelector('.b'), c: bannerEl.querySelector('.c') };
function hint(html, dur){ if (!html){ hintEl.classList.remove('on'); hintT = 0; return; } hintEl.innerHTML = html; hintEl.classList.add('on'); hintT = dur; }
function setObj(q, p, target){
  objEl.querySelector('.q').textContent = q; objEl.querySelector('.p').textContent = p || ''; objEl.classList.add('on');
  objEl.classList.remove('flash'); void objEl.offsetWidth; objEl.classList.add('flash');
  markerTarget = target || null;
}
function clearObj(){ objEl.classList.remove('on'); markerTarget = null; }
const TIMERS = [];
const later = (s, fn) => TIMERS.push({ t: s, fn });
const wait = s => new Promise(r => later(s, r));
async function chapterCard(a, b, c, r, btn){
  chap.innerHTML = `<div class="a">${a}</div><div class="b">${b}</div><div class="l"></div><div class="c">${c || ''}</div>${r ? `<div class="r">${r}</div>` : ''}${btn ? `<button>${btn}</button>` : ''}`;
  chap.classList.add('on'); G.lock = true;
  if (btn) await new Promise(done => { chap.querySelector('button').onclick = () => { sfx('ui'); done(); }; });
  else await wait(3.2);
  chap.classList.remove('on'); await wait(0.6); G.lock = false;
}


// ───────────────────────── 플레이어 전투 ─────────────────────────
let atk = null, roll = null, cast = null, runeCd = 0, inv = 0, rollCd = 0, dead = false, combatT = 0;
const COMBO = [{ dur: 0.42, mul: 1.0, range: 2.4 }, { dur: 0.42, mul: 1.15, range: 2.4 }, { dur: 0.6, mul: 1.65, range: 2.7 }];
function nearestEnemy(maxD){
  let best = null, bd = maxD;
  for (const e of ENEMIES){ if (e.state === 'dying') continue; const d = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) - e.cfg.rad; if (d < bd){ bd = d; best = e; } }
  return best;
}
function attack(){
  if (!S.sword || G.lock || dead || roll || cast || sk) return;
  if (atk && atk.t < atk.dur * 0.6){ atk.queued = true; return; }
  const i = atk && atk.t < atk.dur + 0.4 ? (atk.i + 1) % 3 : 0;
  const d = D(), c = COMBO[i];
  atk = { i, t: 0, dur: c.dur / d.aspd, hit: false, queued: false, ry: fig.root.rotation.y };
  const tg = nearestEnemy(isRanged() ? 16 : 4.5); if (tg) atk.ry = Math.atan2(tg.pos.x - player.pos.x, tg.pos.z - player.pos.z);
  fig.root.rotation.y = atk.ry; if (!isRanged()) sfx('swing');
}
function doRoll(){
  if (!S.sword || G.lock || dead || roll || rollCd > 0 || !player.ground || (sk && !sk.d.free)) return;
  if (sk) sk = null;
  let dir = fig.root.rotation.y;
  const k = G.keys; let ix = 0, iz = 0;
  if (k.KeyW || k.ArrowUp) iz += 1; if (k.KeyS || k.ArrowDown) iz -= 1; if (k.KeyA || k.ArrowLeft) ix -= 1; if (k.KeyD || k.ArrowRight) ix += 1;
  if (ix || iz){ const y = G.camYaw, dx = -Math.sin(y) * iz + Math.cos(y) * ix, dz = -Math.cos(y) * iz - Math.sin(y) * ix; dir = Math.atan2(dx, dz); }
  roll = { t: 0, dur: 0.42, dir }; inv = 0.42; rollCd = 0.55; atk = null; fig.root.rotation.y = dir; sfx('roll');
}
function doRune(){
  if (!S.rune || G.lock || dead || cast || roll || sk) return;
  if (runeCd > 0){ hint(`룬 마법 재사용까지 <b>${runeCd.toFixed(1)}</b>초`, 1.2); return; }
  if (mp < 20){ hint('MP가 부족하다', 1.2); return; }
  mp -= 20; runeCd = D().cd; cast = { t: 0, dur: 0.75, fired: false }; atk = null;
}
function hurtPlayer(dmg, from, kb = 5){
  if (inv > 0 || dead || !G.playing) return;
  dmg = Math.round(dmg * rr(0.9, 1.1) * (S.job === 'sword' ? 0.85 : 1) * 100 / (100 + Math.max(0, BONUS.def))); hp -= dmg; BUS.emit('hurt', dmg); comboT = 0; comboEl.classList.remove('on'); inv = 0.55; combatT = 4;
  dmgNum(new V3(player.pos.x, PY() + 2.0, player.pos.z), '-' + dmg, 'me');
  hurtEl.style.transition = 'none'; hurtEl.style.opacity = 1; requestAnimationFrame(() => { hurtEl.style.transition = 'opacity .6s'; hurtEl.style.opacity = 0; });
  sfx('hurt'); G.shake = Math.max(G.shake, 0.7);
  if (from){ const dx = player.pos.x - from.x, dz = player.pos.z - from.z, d = Math.hypot(dx, dz) || 1; knock.x += dx / d * kb; knock.z += dz / d * kb; }
  if (hp <= 0){ hp = 0; die(); }
  refreshHud();
}
const knock = new V3();
function die(){
  dead = true; atk = roll = cast = null; G.lock = true;
  fig.set(G.pose({ hy: 0.21, hrx: -Math.PI / 2, laz: 0.6, raz: -0.6, hd: 0.3 }));
}
function hitSweep(range, arc, mul, kb){
  const d = D(); let any = false, crit = false;
  for (const e of ENEMIES){
    if (e.state === 'dying' || e.state === 'spawn') continue;
    const dx = e.pos.x - player.pos.x, dz = e.pos.z - player.pos.z, dd = Math.hypot(dx, dz);
    if (dd > range + e.cfg.rad) continue;
    if (arc < Math.PI && Math.abs(angDiff(Math.atan2(dx, dz), fig.root.rotation.y)) > arc) continue;
    const c = R() < d.crit; crit = crit || c;
    if (hitEnemy(e, d.atk * mul * (c ? 1.8 : 1) * rr(0.9, 1.1), dx / (dd || 1), dz / (dd || 1), kb, c)){ any = true; comboHit(); mp = Math.min(d.maxMp, mp + 1.2); }
  }
  if (any){ sfx(crit ? 'crit' : 'hit'); G.hitStop = crit ? 0.09 : 0.055; G.shake = Math.max(G.shake, crit ? 0.6 : 0.35); combatT = 4; }
}
function updateCombat(dt){
  const d = D();
  G.speedMul = d.spd; G.moveMul = 1; G.faceLock = false; G.noJump = false; G.poseK = 0;
  runeCd = Math.max(0, runeCd - dt); inv = Math.max(0, inv - dt); rollCd = Math.max(0, rollCd - dt); combatT = Math.max(0, combatT - dt);
  mp = Math.min(d.maxMp, mp + d.mpRegen * dt);
  if (!dead && combatT <= 0 && hp < d.maxHp) hp = Math.min(d.maxHp, hp + d.maxHp * (battle && !battle.ended ? 0.02 : MODE === 'field' ? 0.04 : 0.1) * dt);
  if (!dead && d.regen && hp < d.maxHp) hp = Math.min(d.maxHp, hp + d.regen * dt);
  // 넉백
  if (knock.lengthSq() > 0.01){ player.pos.x += knock.x * dt; player.pos.z += knock.z * dt; knock.multiplyScalar(Math.exp(-8 * dt)); G.collide(player.pos, 0.36); }
  if (dead){ G.poseMod = () => G.pose({ hy: 0.21, hrx: -Math.PI / 2, laz: 0.6, raz: -0.6, hd: 0.3 }); G.poseK = 6; return; }
  if (atk){
    atk.t += dt; G.moveMul = 0.15; G.faceLock = true; G.noJump = true;
    const c = COMBO[atk.i], k = atk.t / atk.dur;
    if (k < 0.45 && !isRanged()){ player.pos.x += Math.sin(atk.ry) * 3.2 * dt; player.pos.z += Math.cos(atk.ry) * 3.2 * dt; G.collide(player.pos, 0.36); }
    if (atk.i === 2 && !isRanged()) fig.root.rotation.y = atk.ry + ease(Math.min(1, k * 1.15)) * TAU;
    if (!atk.hit && k >= (atk.i === 2 ? 0.35 : 0.42)){
      atk.hit = true;
      if (isRanged()){ const tg = nearestEnemy(16); if (tg){ atk.ry = Math.atan2(tg.pos.x - player.pos.x, tg.pos.z - player.pos.z); fig.root.rotation.y = atk.ry; } }
      basicHit(atk, c);
    }
    if (atk.t >= atk.dur){ const q = atk.queued; if (q){ atk.t = atk.dur; attack(); } else if (atk.t > atk.dur + 0.4) atk = null; }
  }
  updateSkill(dt);
  if (roll){
    roll.t += dt; const k = roll.t / roll.dur; G.moveMul = 0; G.faceLock = true; G.noJump = true;
    const sp = 12 * (1 - k * 0.6); player.pos.x += Math.sin(roll.dir) * sp * dt; player.pos.z += Math.cos(roll.dir) * sp * dt; G.collide(player.pos, 0.36);
    if (k >= 1) roll = null;
  }
  if (cast){
    cast.t += dt; const k = cast.t / cast.dur; G.moveMul = 0; G.faceLock = true; G.noJump = true;
    if (!cast.fired && k > 0.5){
      cast.fired = true; sfx('rune'); G.shake = 0.9; G.hitStop = 0.08;
      shockwave(player.pos.x, 0.14, player.pos.z, 6.2, 0x7ff3ff, 0.65); shockwave(player.pos.x, 1.0, player.pos.z, 4.5, 0xffe08a, 0.45);
      burst(new V3(player.pos.x, 0.4, player.pos.z), 0x7ff3ff, 70, 9, 0.35, 0.8, -2, 1.5);
      if (sword && sword.userData.glow) sword.userData.glow.color.set(0xffffff);
      for (const e of ENEMIES){
        if (e.state === 'dying' || e.state === 'spawn') continue;
        const dx = e.pos.x - player.pos.x, dz = e.pos.z - player.pos.z, dd = Math.hypot(dx, dz);
        if (dd < 6 + e.cfg.rad){ const c = R() < d.crit; hitEnemy(e, d.rune * (c ? 1.8 : 1) * rr(0.95, 1.1), dx / (dd || 1), dz / (dd || 1), 14, c); }
      }
      combatT = 4;
    }
    if (k >= 1){ cast = null; if (sword && sword.userData.glow) sword.userData.glow.color.set(jobColor()); }
  }
  // 포즈 덮어쓰기
  G.poseMod = (tp) => {
    if (cerPose) return cerPose;
    if (X.emotePose && !atk && !roll && !cast && !sk && !dead){ const ep = X.emotePose(tp); if (ep){ G.poseK = 10; return ep; } }
    if (sk && sk.d.pose){ G.poseK = 26; return sk.d.pose(Math.min(1, sk.t / sk.dur), sk); }
    if (cast){
      const k = cast.t / cast.dur;
      if (k < 0.5){ const u = ease(k / 0.5); return G.pose({ lax: -2.9 * u, rax: -2.9 * u, le: -0.3, re: -0.3, sp: -0.3 * u, hd: -0.4 * u, llx: -0.2, rlx: 0.2 }); }
      const u = ease(Math.min(1, (k - 0.5) / 0.2)); return G.pose({ lax: -2.9 + 2.0 * u, rax: -2.9 + 2.0 * u, sp: 0.7 * u, hy: 0.86 - 0.3 * u, lk: 0.9 * u, rk: 0.9 * u, llx: -0.7 * u, rlx: 0.3 * u, hd: 0.2 });
    }
    if (roll){ const k = roll.t / roll.dur; G.poseK = 30; return G.pose({ hrx: ease(k) * TAU, hy: 0.86 - Math.sin(k * Math.PI) * 0.45, llx: -2.2, rlx: -2.2, lk: 2.4, rk: 2.4, lax: -1.4, rax: -1.4, le: -1.4, re: -1.4, sp: 0.6, hd: 0.5 }); }
    if (atk && S.job === 'archer'){ const k = Math.min(1, atk.t / atk.dur); G.poseK = 30; return bowPose(k < 0.42 ? k / 0.42 : Math.max(0, 1 - (k - 0.42) * 3)); }
    if (atk && S.job === 'mage'){ const k = Math.min(1, atk.t / atk.dur); G.poseK = 28; return staffPose(k); }
    if (atk){
      const k = Math.min(1, atk.t / atk.dur), u = ease(Math.min(1, k / 0.55)); G.poseK = 28;
      if (atk.i === 0) return G.pose({ rax: -1.5 - 0.5 * (1 - u), raz: -1.5 + 2.2 * u, re: -0.25, lax: -0.4, laz: 0.4, sp: 0.15, llx: -0.5, rlx: 0.3, lk: 0.3, hd: 0.1 });
      if (atk.i === 1) return G.pose({ rax: -1.3, raz: 0.8 - 2.4 * u, re: -0.2, lax: -0.2, laz: 0.5, sp: 0.2, llx: 0.3, rlx: -0.5, rk: 0.3, hd: 0.1 });
      return G.pose({ rax: -1.4, raz: -1.55, re: 0, lax: -0.2, laz: 1.4, sp: 0.25, hy: 0.74, lk: 0.6, rk: 0.6, llx: -0.4, rlx: 0.3, llz: 0.3, rlz: -0.3 });
    }
    if (sword && !G.lock){ if (S.job === 'archer'){ tp.lax += -0.25; tp.le += -0.4; } else { tp.rax += -0.35; tp.re += -0.55; } }
    return tp;
  };
  fig.mesh.visible = !(inv > 0 && inv < 0.5 && !roll && Math.floor(inv * 20) % 2);
}


// ───────────────────────── 직업 / 스킬 ─────────────────────────
const JOBS = {
  sword: { n: '검사', en: 'SWORDSMAN', icon: '⚔️', col: '#8ff4ff', c: 0x8ff4ff, role: '근접 · 돌격', desc: '넓은 베기와 돌진으로 전장을 휘젓는 전사. 최대 HP +25%, 받는 피해 -15%.',
    asc: { n: '검성', en: 'SWORD SAINT', icon: '🗡️', c: 0xffd36a, desc: '검기로 대지를 가르고, 하늘에서 천 개의 검을 내리꽂는다.' }, skills: ['dash', 'whirl', 'cleave', 'blades'] },
  archer: { n: '궁수', en: 'RANGER', icon: '🏹', col: '#b8ff8a', c: 0x9aff6a, role: '원거리 · 기동', desc: '멀리서 화살을 퍼붓고 재빠르게 빠지는 사냥꾼. 이동 속도 +8%, 치명타 +8%.',
    asc: { n: '바람의 사수', en: 'WIND RANGER', icon: '🌪️', c: 0x7affd8, desc: '폭풍을 실은 관통 화살과 하늘을 뒤덮는 화살비.' }, skills: ['fan', 'flip', 'storm', 'rain'] },
  mage: { n: '마법사', en: 'MAGE', icon: '🔮', col: '#ffb07a', c: 0xff8a4a, role: '원거리 · 광역', desc: '유도 마탄과 원소 마법으로 적을 쓸어버린다. 최대 MP +50%, MP 회복 +60%, 룬 마법 +35%.',
    asc: { n: '대마법사', en: 'ARCHMAGE', icon: '☄️', c: 0xc89aff, desc: '적을 꿰뚫는 연쇄 번개, 그리고 하늘을 가르는 메테오.' }, skills: ['fireball', 'nova', 'chain', 'meteor'] },
  rogue: { n: '암살자', en: 'ASSASSIN', icon: '🗡', col: '#d08aff', c: 0xb46aff, role: '근접 · 치명타', desc: '그림자를 타고 순간이동해 급소를 찌른다. 공격 속도 +30%, 치명타 +15%.',
    asc: { n: '그림자 군주', en: 'SHADOW LORD', icon: '🌑', c: 0xff4a8a, desc: '그림자 분신을 부리고, 사신의 춤으로 전장을 지운다.' }, skills: ['step', 'daggers', 'clones', 'lotus'] },
};
const ASC_LV = 10, ASC_STAGE = 10, JOB_STAGE = 1;
const jobUnlocked = () => stars(JOB_STAGE, 'e') > 0;
const ascReady = () => S.job && !S.asc && S.lv >= ASC_LV && stars(ASC_STAGE, 'e') > 0;
const jobName = () => !S.job ? '모험가' : S.asc ? JOBS[S.job].asc.n : JOBS[S.job].n;
const jobColor = () => cosWpnCol() ?? (!S.job ? 0x8ff4ff : S.asc ? JOBS[S.job].asc.c : JOBS[S.job].c);

// ── 전투 헬퍼 ──
const liveE = e => e.state !== 'dying' && e.state !== 'spawn' && e.state !== 'intro' && !e.under;
function foesIn(x, z, r){ const o = []; for (const e of ENEMIES) if (liveE(e) && Math.hypot(e.pos.x - x, e.pos.z - z) < r + e.cfg.rad) o.push(e); return o; }
function aimAng(maxD = 14){ const t = nearestEnemy(maxD); return t ? Math.atan2(t.pos.x - player.pos.x, t.pos.z - player.pos.z) : fig.root.rotation.y; }
function dmgE(e, base, fx, fz, kb = 4, opt = {}){
  const d = D(), c = opt.crit || R() < d.crit + (opt.critAdd || 0);
  const ok = hitEnemy(e, base * (c ? 1.8 : 1) * rr(0.92, 1.08), fx, fz, kb, c);
  if (ok){ mp = Math.min(d.maxMp, mp + (opt.mpGain ?? 0.8)); combatT = 4; comboHit(); if (opt.stun) stunE(e, opt.stun, opt.frz); if (opt.dot) dotE(e, opt.dot[0], opt.dot[1], opt.dot[2]); }
  return ok;
}
function hitFrom(e, x, z, base, kb, opt){ const dx = e.pos.x - x, dz = e.pos.z - z, dd = Math.hypot(dx, dz) || 1; return dmgE(e, base, dx / dd, dz / dd, kb, opt); }
function stunE(e, t, frz){ if (e.state === 'dying') return; t = e.boss ? t * 0.35 : t; e.stun = Math.max(e.stun || 0, t); if (frz) e.frz = Math.max(e.frz || 0, t); }
function dotE(e, dps, t, col){ e.dot = { dps, t, col, k: 0 }; }
const pAtk = () => D().atk, pMag = () => D().rune * 0.5 + D().atk * 0.3;

// ── 콤보 카운터 ──
let comboN = 0, comboT = 0;
const comboEl = mk('div', 'combo', '<b></b><span>HIT</span>', hud);
function comboHit(){ comboN = comboT > 0 ? comboN + 1 : 1; comboT = 2.4; if (comboN >= 3){ comboEl.querySelector('b').textContent = comboN; comboEl.classList.add('on'); comboEl.classList.remove('pop'); void comboEl.offsetWidth; comboEl.classList.add('pop'); } }

// ── 플레이어 투사체 ──
const PP = [];
const ADD = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const PG = { shaft: new THREE.CylinderGeometry(0.025, 0.025, 0.9, 5).rotateX(Math.PI / 2), tip: new THREE.ConeGeometry(0.06, 0.18, 6).rotateX(Math.PI / 2), orb: new THREE.SphereGeometry(0.2, 12, 10), blade: new THREE.BoxGeometry(0.06, 0.02, 0.42) };
function pMesh(kind, col){
  const g = new THREE.Group();
  if (kind === 'arrow' || kind === 'storm'){ const s = new THREE.Mesh(PG.shaft, M.woodD); g.add(s); const t = new THREE.Mesh(PG.tip, ADD(col)); t.position.z = 0.5; g.add(t); g.add(glowSprite(col, kind === 'storm' ? 4 : 0.9, 0.8)); if (kind === 'storm') g.scale.setScalar(2.4); }
  else if (kind === 'dagger'){ const b = new THREE.Mesh(PG.blade, M.steel); g.add(b); g.add(glowSprite(col, 0.8, 0.7)); g.userData.spin = true; }
  else { const o = new THREE.Mesh(PG.orb, ADD(col)); g.add(o); g.add(glowSprite(col, kind === 'fire' ? 2.6 : kind === 'orb' ? 2.0 : 1.3, 0.9)); if (kind === 'fire') o.scale.setScalar(1.6); if (kind === 'bolt') o.scale.setScalar(0.7); }
  return g;
}
function pShot(o){
  const ang = o.ang, mesh = pMesh(o.kind, o.col || 0xffffff);
  mesh.position.set(player.pos.x + Math.sin(ang) * 0.6, o.y ?? PY() + 1.15, player.pos.z + Math.cos(ang) * 0.6); mesh.rotation.y = ang; SW.add(mesh);
  PP.push(Object.assign({ mesh, t: 0, hit: new Set(), vx: Math.sin(ang) * o.sp, vz: Math.cos(ang) * o.sp, r: 0.35, kb: 3, pierce: 0 }, o));
}
function updatePP(dt){
  for (let i = PP.length - 1; i >= 0; i--){
    const o = PP[i], p = o.mesh.position; o.t += dt;
    if (o.homing){ let best = null, bd = 9; for (const e of ENEMIES){ if (!liveE(e) || o.hit.has(e)) continue; const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z); if (d < bd){ bd = d; best = e; } }
      if (best){ const sp = Math.hypot(o.vx, o.vz), a0 = Math.atan2(o.vx, o.vz), a1 = Math.atan2(best.pos.x - p.x, best.pos.z - p.z), a = a0 + clamp(angDiff(a1, a0), -o.homing * dt, o.homing * dt); o.vx = Math.sin(a) * sp; o.vz = Math.cos(a) * sp; } }
    p.x += o.vx * dt; p.z += o.vz * dt; o.mesh.rotation.y = Math.atan2(o.vx, o.vz); if (o.mesh.userData.spin) o.mesh.rotation.x += dt * 30;
    if (o.trailC && R() < dt * 50) burst(p.clone(), o.trailC, 1, 0.6, o.kind === 'storm' ? 0.5 : 0.2, 0.35, 0, 0.2);
    let end = o.t > o.life || outDist(p.x, p.z) > 4;
    for (const e of ENEMIES){
      if (!liveE(e) || o.hit.has(e)) continue;
      const dx = e.pos.x - p.x, dz = e.pos.z - p.z; if (Math.hypot(dx, dz) > e.cfg.rad + o.r) continue;
      o.hit.add(e); const sp = Math.hypot(o.vx, o.vz) || 1;
      dmgE(e, o.dmg, o.vx / sp, o.vz / sp, o.kb, o.opt || {}); if (o.onHit) o.onHit(o, e);
      burst(new V3(p.x, p.y, p.z), o.col || 0xffffff, 6, 3, 0.18, 0.35, -4, 1);
      if (o.pierce-- <= 0){ end = true; break; }
    }
    if (end){ if (o.onEnd) o.onEnd(o); SW.remove(o.mesh); PP.splice(i, 1); }
  }
}
// 폭발
function explode(x, z, r, base, col, kb = 8, opt = {}){
  shockwave(x, 0.15, z, r + 0.6, col, 0.5); burst(new V3(x, 0.6, z), col, 30 + r * 8, r * 1.6, 0.35, 0.7, -3, 2); burst(new V3(x, 0.4, z), 0xffffff, 10, r, 0.2, 0.4, -6, 2);
  sfx('boom'); G.shake = Math.max(G.shake, 0.4 + r * 0.08);
  let any = false; for (const e of foesIn(x, z, r)) any = hitFrom(e, x, z, base, kb, opt) || any;
  if (any) G.hitStop = Math.max(G.hitStop, 0.06);
}
// 땅에서 솟는 가시 (검성)
const SPK_G = new THREE.ConeGeometry(0.42, 2.4, 5);
function spike(x, z, col){
  const g = new THREE.Group(); g.position.set(x, 0, z); SW.add(g);
  for (let k = 0; k < 4; k++){ const c = new THREE.Mesh(SPK_G, sm(0x4a4a58, { flatShading: true, emissive: col, emissiveIntensity: 0.25 })); c.position.set(rr(-0.5, 0.5), 0.9, rr(-0.5, 0.5)); c.rotation.set(rr(-0.35, 0.35), R() * 6, rr(-0.35, 0.35)); c.scale.setScalar(rr(0.6, 1.1)); g.add(c); }
  burst(new V3(x, 0.3, z), 0x8a7a6a, 12, 4, 0.25, 0.6, -8, 3); burst(new V3(x, 0.5, z), col, 8, 3, 0.25, 0.5, -2, 2);
  FXL.push({ obj: g, t: 0, life: 1.0, upd(k){ g.scale.y = k < 0.12 ? k / 0.12 : k > 0.7 ? Math.max(0.01, 1 - (k - 0.7) / 0.3) : 1; } });
  g.geometry = { dispose(){} }; g.material = { dispose(){} };
}
// 번개 선
function bolt(a, b, col){
  const pts = [], n = 8; for (let i = 0; i <= n; i++){ const f = i / n, j = i === 0 || i === n ? 0 : 0.35; pts.push(new V3(a.x + (b.x - a.x) * f + rr(-j, j), a.y + (b.y - a.y) * f + rr(-j, j), a.z + (b.z - a.z) * f + rr(-j, j))); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false, linewidth: 2 })); SW.add(l);
  FXL.push({ obj: l, t: 0, life: 0.28, upd(k){ l.material.opacity = 1 - k; } });
}
// 떨어지는 물체 (메테오 / 천검 / 화살비)
const FALL = [];
function fallObj(obj, from, to, T, onLand, stay){ obj.position.copy(from); SW.add(obj); FALL.push({ obj, from, to, T, t: 0, onLand, stay }); }
function updateFall(dt){
  for (let i = FALL.length - 1; i >= 0; i--){ const f = FALL[i]; f.t += dt; const k = Math.min(1, f.t / f.T); f.obj.position.lerpVectors(f.from, f.to, k * k);
    if (k >= 1){ FALL.splice(i, 1); if (f.onLand) f.onLand(f); if (!f.stay) SW.remove(f.obj); } }
}
// 지속 장판 (화살비 등)
const FIELDS = [];
function updateFields(dt){ for (let i = FIELDS.length - 1; i >= 0; i--){ const f = FIELDS[i]; f.t += dt; f.tick(f, dt); if (f.t >= f.T){ if (f.end) f.end(f); FIELDS.splice(i, 1); } } }
// 그림자 분신
const CLONES = [], CLONE_M = G.std({ color: 0x241436, emissive: 0x6a2aff, emissiveIntensity: 0.55, roughness: 0.4, transparent: true, opacity: 0.85 });
function spawnClone(x, z){
  const f = new G.Figure(CLONE_M, 0.86); f.root.position.set(x, 0.04, z); SW.add(f.root);
  const dg = makeSword(0.55, 0xff4a8a); dg.position.set(0, -0.36, 0.02); dg.rotation.x = Math.PI / 2; f.elR.add(dg);
  const dg2 = makeSword(0.55, 0xff4a8a); dg2.position.set(0, -0.36, 0.02); dg2.rotation.x = Math.PI / 2; f.elL.add(dg2);
  burst(new V3(x, 0.8, z), 0x9a4aff, 30, 4, 0.35, 0.8, -1, 2);
  CLONES.push({ f, t: 0, T: 9, cd: 0.3, swing: 0, ph: R() * 6 });
}
function updateClones(dt){
  for (let i = CLONES.length - 1; i >= 0; i--){
    const c = CLONES[i], p = c.f.root.position; c.t += dt; c.cd -= dt; c.swing = Math.max(0, c.swing - dt * 3);
    let tg = null, bd = 30; for (const e of ENEMIES){ if (!liveE(e)) continue; const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z) - e.cfg.rad; if (d < bd){ bd = d; tg = e; } }
    let moving = false;
    if (tg){ const a = Math.atan2(tg.pos.x - p.x, tg.pos.z - p.z); c.f.root.rotation.y = a;
      if (bd > 1.3){ p.x += Math.sin(a) * 8 * dt; p.z += Math.cos(a) * 8 * dt; moving = true; }
      else if (c.cd <= 0){ c.cd = 0.42; c.swing = 1; hitFrom(tg, p.x, p.z, pAtk() * 0.7, 3, { mpGain: 0.3 }); burst(new V3(tg.pos.x, 0.8, tg.pos.z), 0xb46aff, 6, 3, 0.2, 0.35, -4, 1); } }
    else { const dx = player.pos.x - p.x, dz = player.pos.z - p.z, d = Math.hypot(dx, dz); if (d > 2.5){ p.x += dx / d * 7 * dt; p.z += dz / d * 7 * dt; moving = true; c.f.root.rotation.y = Math.atan2(dx, dz); } }
    clampShapes(p, 0.4);
    c.ph += dt * (moving ? 14 : 2);
    const g = c.f.gait(c.ph, moving ? 1 : 0, true, 0);
    if (c.swing > 0){ const u = 1 - c.swing; g.rax = -1.4; g.raz = -1.5 + 2.4 * u; g.lax = -1.2; g.laz = 1.2 - 2.0 * u; }
    c.f.set(g); c.f.blend(dt, 18);
    if (c.t > c.T){ burst(new V3(p.x, 0.8, p.z), 0x9a4aff, 24, 3, 0.3, 0.7, -1, 2); SW.remove(c.f.root); CLONES.splice(i, 1); }
  }
}
function clearSkillFx(){
  for (const o of PP) SW.remove(o.mesh); PP.length = 0;
  for (const f of FALL) SW.remove(f.obj); FALL.length = 0; FIELDS.length = 0;
  for (const c of CLONES) SW.remove(c.f.root); CLONES.length = 0;
  sk = null;
}

// ── 스킬 정의 ──
// t: 진행 시간, k: 0~1. start(s) → tick(s, dt, k) → end(s)
const SKL = {
  // ── 검사 ──
  dash: { n: '돌진 베기', icon: '💨', cd: 5, mp: 12, dur: 0.34, mv: 0, desc: '조준한 방향으로 7m 돌진하며 경로의 모든 적을 벤다. 돌진 중 무적.',
    start(s){ s.dir = aimAng(10); fig.root.rotation.y = s.dir; inv = Math.max(inv, 0.45); s.hit = new Set(); sfx('roll'); sfx('swing'); },
    tick(s, dt){ player.pos.x += Math.sin(s.dir) * 21 * dt; player.pos.z += Math.cos(s.dir) * 21 * dt; G.collide(player.pos, 0.36);
      if (R() < dt * 60) burst(new V3(player.pos.x, 0.9, player.pos.z), 0x8ff4ff, 2, 1, 0.3, 0.3, 0, 0.5);
      for (const e of foesIn(player.pos.x, player.pos.z, 1.8)) if (!s.hit.has(e)){ s.hit.add(e); hitFrom(e, player.pos.x, player.pos.z, pAtk() * 2.3, 7); G.hitStop = 0.05; sfx('hit'); } },
    end(s){ trail(s.dir, 1.05, 0, true, 0x8ff4ff); },
    pose(k){ return G.pose({ rax: -1.6, raz: -0.2, re: 0, lax: 0.6, laz: 0.5, sp: 0.55, hy: 0.7, llx: -1.0, rlx: 0.9, lk: 0.8, rk: 0.3, hd: -0.3 }); } },
  whirl: { n: '회오리 베기', icon: '🌀', cd: 9, mp: 20, dur: 1.7, mv: 0.65, desc: '1.7초 동안 회전하며 주변 3m의 적을 계속 벤다. 이동 가능.',
    start(s){ s.nt = 0; sfx('swing'); },
    tick(s, dt){ fig.root.rotation.y += dt * 19; s.nt -= dt;
      if (s.nt <= 0){ s.nt = 0.18; trail(fig.root.rotation.y, 1.0, 0, true, 0x8ff4ff); sfx('swing'); let any = false; for (const e of foesIn(player.pos.x, player.pos.z, 3.1)) any = hitFrom(e, player.pos.x, player.pos.z, pAtk() * 0.75, 3, { mpGain: 0.3 }) || any; if (any){ sfx('hit'); G.hitStop = 0.03; } } },
    pose(){ return G.pose({ rax: -1.5, raz: -1.55, re: 0, lax: -0.3, laz: 1.4, sp: 0.2, hy: 0.78, lk: 0.5, rk: 0.5, llz: 0.3, rlz: -0.3 }); }, free: true },
  cleave: { n: '대지 가르기', icon: '⛰️', cd: 10, mp: 25, dur: 0.95, mv: 0, asc: true, desc: '뛰어올라 내리찍어 전방 13m에 바위 가시를 연달아 솟구치게 한다. 적중 시 기절.',
    start(s){ s.dir = aimAng(14); fig.root.rotation.y = s.dir; player.vy = 7; player.ground = false; sfx('roll'); },
    tick(s, dt, k){ if (!s.f && k > 0.5){ s.f = true; sfx('boom'); G.shake = 1.0; G.hitStop = 0.08; shockwave(player.pos.x, 0.12, player.pos.z, 4, 0xffd36a, 0.5);
      const x0 = player.pos.x, z0 = player.pos.z, dir = s.dir, hit = new Set();
      for (let i = 0; i < 9; i++) later(i * 0.055, () => { const x = x0 + Math.sin(dir) * (1.6 + i * 1.45), z = z0 + Math.cos(dir) * (1.6 + i * 1.45); if (outDist(x, z) > 0.5) return; spike(x, z, 0xffd36a); G.shake = Math.max(G.shake, 0.35);
        for (const e of foesIn(x, z, 1.8)) if (!hit.has(e)){ hit.add(e); hitFrom(e, x, z, pAtk() * 3.6, 6, { stun: 1.4 }); } }); } },
    pose(k){ if (k < 0.5){ const u = ease(k / 0.5); return G.pose({ rax: -3.0 * u, raz: -0.2, re: -0.4, lax: -2.8 * u, laz: 0.2, le: -0.4, sp: -0.3 * u, llx: -0.8, lk: 1.4, rlx: 0.3, rk: 1.0 }); }
      return G.pose({ rax: -0.9, raz: -0.2, re: 0, lax: -0.9, laz: 0.2, sp: 0.8, hy: 0.62, lk: 1.0, rk: 1.0, llx: -0.9, rlx: 0.4, hd: 0.3 }); } },
  blades: { n: '천검 강림', icon: '✨', cd: 26, mp: 40, dur: 1.3, mv: 0, asc: true, ult: true, desc: '하늘에서 거대한 빛의 검 14자루를 내리꽂는다. 적이 있는 곳을 노린다. (궁극기)',
    start(s){ sfx('shard'); sfx('rune'); inv = Math.max(inv, 1.3); banner('', '천검 강림', '', false, 1.2);
      const tg = foesIn(player.pos.x, player.pos.z, 11).sort(() => R() - 0.5), pts = [];
      for (let i = 0; i < 14; i++){ const e = tg[i % Math.max(1, tg.length)]; let x, z; if (e && i < tg.length * 2){ x = e.pos.x + rr(-1, 1); z = e.pos.z + rr(-1, 1); } else { const a = R() * TAU, r = rr(2, 7.5); x = player.pos.x + Math.cos(a) * r; z = player.pos.z + Math.sin(a) * r; } pts.push(clampShapes(new V3(x, 0, z), 0.5)); }
      pts.forEach((p, i) => later(0.35 + i * 0.065, () => { const sw = makeSword(3.4, 0xffd36a); sw.rotation.x = Math.PI; sw.add(glowSprite(0xffe08a, 3, 0.8));
        fallObj(sw, new V3(p.x, 16, p.z), new V3(p.x, 3.6, p.z), 0.28, () => { shockwave(p.x, 0.12, p.z, 3.0, 0xffd36a, 0.45); burst(new V3(p.x, 0.4, p.z), 0xffe08a, 22, 5, 0.3, 0.6, -6, 2); sfx('clang'); G.shake = Math.max(G.shake, 0.6);
          for (const e of foesIn(p.x, p.z, 2.4)) hitFrom(e, p.x, p.z, pAtk() * 2.9, 5, { stun: 0.6 }); later(0.7, () => SW.remove(sw)); }, true); })); },
    pose(k){ const u = ease(Math.min(1, k * 3)); return G.pose({ rax: -3.0 * u, raz: 0, re: 0, lax: -0.4, laz: 0.6, sp: -0.2 * u, hd: -0.5 * u, llx: -0.15, rlx: 0.15 }); } },
  // ── 궁수 ──
  fan: { n: '산탄 사격', icon: '🎯', cd: 4, mp: 10, dur: 0.38, mv: 0.2, desc: '부채꼴로 화살 7발을 동시에 쏜다.',
    start(s){ s.dir = aimAng(16); fig.root.rotation.y = s.dir; },
    tick(s, dt, k){ if (!s.f && k > 0.45){ s.f = true; sfx('bow'); for (let i = 0; i < 7; i++) pShot({ kind: 'arrow', ang: s.dir + (i - 3) * 0.13, sp: 28, life: 0.55, dmg: pAtk() * 1.05, col: 0xb8ff8a, kb: 4 }); } },
    pose(k){ return bowPose(k > 0.45 ? 1 : k / 0.45); } },
  flip: { n: '후방 도약 · 폭발 덫', icon: '🦘', cd: 7, mp: 14, dur: 0.5, mv: 0, desc: '뒤로 크게 도약하며(무적) 화살 3발을 쏘고, 제자리에 폭발 덫을 남긴다.',
    start(s){ s.dir = aimAng(16); fig.root.rotation.y = s.dir; inv = Math.max(inv, 0.55); player.vy = 6; player.ground = false; sfx('roll');
      const x = player.pos.x, z = player.pos.z, trap = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16).rotateX(-Math.PI / 2), ADD(0xffa040)); trap.position.set(x, 0.08, z); SW.add(trap); const tl = telegraph(x, z, 3.2); tl.material.uniforms.uP.value = 0;
      FIELDS.push({ t: 0, T: 0.75, tick(f, dt){ teleUpd(tl, f.t / 0.75, dt); trap.scale.setScalar(1 + Math.sin(f.t * 30) * 0.15); }, end(){ SW.remove(trap); SW.remove(tl); explode(x, z, 3.3, pAtk() * 2.7, 0xffa040, 10, { stun: 0.9 }); } }); },
    tick(s, dt, k){ const sp = 13 * (1 - k * 0.5); player.pos.x -= Math.sin(s.dir) * sp * dt; player.pos.z -= Math.cos(s.dir) * sp * dt; G.collide(player.pos, 0.36);
      if (!s.f && k > 0.35){ s.f = true; sfx('bow'); for (let i = -1; i <= 1; i++) pShot({ kind: 'arrow', ang: s.dir + i * 0.12, sp: 28, life: 0.6, dmg: pAtk() * 0.9, col: 0xb8ff8a }); } },
    pose(k){ return G.pose({ hrx: -ease(k) * TAU * 0.9, hy: 0.86 + Math.sin(k * Math.PI) * 0.2, lax: -1.5, le: 0, rax: -1.4, re: -1.9, llx: -1.2, lk: 1.6, rlx: -0.6, rk: 1.4, sp: 0.4 }); } },
  storm: { n: '폭풍 관통 화살', icon: '🌪️', cd: 10, mp: 24, dur: 0.95, mv: 0, asc: true, desc: '힘을 모아 일직선의 모든 적을 꿰뚫는 거대한 폭풍 화살을 쏜다.',
    start(s){ s.dir = aimAng(20); fig.root.rotation.y = s.dir; sfx('rune'); },
    tick(s, dt, k){ s.dir = aimAng(20); fig.root.rotation.y = s.dir;
      if (k < 0.6 && R() < dt * 40){ const a = R() * TAU, r = rr(1.5, 3); burst(new V3(player.pos.x + Math.cos(a) * r, 1.2, player.pos.z + Math.sin(a) * r), 0x7affd8, 1, 0.3, 0.3, 0.3, 0, 0); }
      if (!s.f && k > 0.6){ s.f = true; sfx('boom'); sfx('bow'); G.shake = 0.7; shockwave(player.pos.x, 1.2, player.pos.z, 3, 0x7affd8, 0.4); knock.x -= Math.sin(s.dir) * 6; knock.z -= Math.cos(s.dir) * 6;
        pShot({ kind: 'storm', ang: s.dir, sp: 34, life: 0.9, dmg: pAtk() * 4.6, col: 0x7affd8, trailC: 0x7affd8, r: 1.3, pierce: 99, kb: 12, opt: { stun: 0.6 } }); } },
    pose(k){ return bowPose(k > 0.6 ? 1 : k / 0.6 * 0.95); } },
  rain: { n: '화살비', icon: '🌧️', cd: 24, mp: 40, dur: 0.6, mv: 0, asc: true, ult: true, desc: '적이 모인 곳에 3.5초간 화살비를 퍼붓는다. 반경 6m. (궁극기)',
    start(s){ const t = nearestEnemy(18); s.p = t ? t.pos.clone() : new V3(player.pos.x + Math.sin(fig.root.rotation.y) * 7, 0, player.pos.z + Math.cos(fig.root.rotation.y) * 7); clampShapes(s.p, 1); sfx('bow'); banner('', '화살비', '', false, 1.0);
      for (let i = 0; i < 6; i++) later(i * 0.05, () => pShot({ kind: 'arrow', ang: fig.root.rotation.y + (i - 2.5) * 0.08, sp: 30, life: 0.25, dmg: 0, col: 0x7affd8, y: PY() + 1.6, r: -99 })); },
    tick(s, dt, k){ if (!s.f && k > 0.5){ s.f = true; const P = s.p, ring = new THREE.Mesh(new THREE.RingGeometry(5.8, 6.1, 64).rotateX(-Math.PI / 2), ADD(0x7affd8)); ring.position.set(P.x, 0.09, P.z); SW.add(ring);
      FIELDS.push({ t: 0, T: 3.5, nt: 0, tick(f, dt){ f.nt -= dt; ring.material.opacity = 0.7 + Math.sin(f.t * 10) * 0.2;
          for (let i = 0; i < 3; i++) if (R() < dt * 30){ const a = R() * TAU, r = Math.sqrt(R()) * 6, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r, ar = pMesh('arrow', 0x7affd8); ar.rotation.x = Math.PI / 2; fallObj(ar, new V3(x - 1, 9, z - 1), new V3(x, 0.2, z), 0.25, () => burst(new V3(x, 0.2, z), 0x7affd8, 3, 2, 0.15, 0.3, -6, 1)); }
          if (f.nt <= 0){ f.nt = 0.22; let any = false; for (const e of foesIn(P.x, P.z, 6)) any = hitFrom(e, P.x, P.z, pAtk() * 0.62, 0.5, { mpGain: 0.2 }) || any; if (any) sfx('hit'); } },
        end(){ SW.remove(ring); } }); } },
    pose(k){ return G.pose({ lax: -2.6, le: 0, laz: 0.2, rax: -2.5, re: -1.8, sp: -0.3, hd: -0.6 }); } },
  // ── 마법사 ──
  fireball: { n: '화염구', icon: '🔥', cd: 4, mp: 14, dur: 0.45, mv: 0.2, desc: '폭발하는 화염구를 날린다. 반경 3m 폭발 + 화상.',
    start(s){ s.dir = aimAng(18); fig.root.rotation.y = s.dir; },
    tick(s, dt, k){ if (!s.f && k > 0.4){ s.f = true; sfx('throw'); sfx('rune');
      pShot({ kind: 'fire', ang: s.dir, sp: 17, life: 1.1, dmg: pMag() * 1.2, col: 0xff7a2a, trailC: 0xff9a3a, r: 0.6, homing: 1.5, onEnd: o => explode(o.mesh.position.x, o.mesh.position.z, 3.2, pMag() * 2.6, 0xff7a2a, 8, { dot: [pMag() * 0.3, 3, 0xff6a2a] }) }); } },
    pose(k){ return staffPose(k); } },
  nova: { n: '서리 고리', icon: '❄️', cd: 10, mp: 22, dur: 0.6, mv: 0, desc: '주변 6.5m에 냉기를 폭발시켜 적을 2.6초간 얼린다.',
    start(s){ sfx('rune'); },
    tick(s, dt, k){ if (!s.f && k > 0.4){ s.f = true; sfx('boom'); G.shake = 0.8; G.hitStop = 0.08; shockwave(player.pos.x, 0.15, player.pos.z, 7.2, 0x9ae8ff, 0.6); shockwave(player.pos.x, 1.0, player.pos.z, 5, 0xffffff, 0.4); burst(new V3(player.pos.x, 0.5, player.pos.z), 0xbff4ff, 80, 10, 0.3, 0.8, -2, 1.2);
      for (const e of foesIn(player.pos.x, player.pos.z, 6.5)) hitFrom(e, player.pos.x, player.pos.z, pMag() * 1.5, 2, { stun: 2.6, frz: true }); } },
    pose(k){ return k < 0.4 ? G.pose({ lax: -2.4, rax: -2.4, le: -0.6, re: -0.6, sp: -0.2 }) : G.pose({ lax: -0.6, laz: 1.3, rax: -0.6, raz: -1.3, sp: 0.4, hy: 0.76, lk: 0.6, rk: 0.6 }); } },
  chain: { n: '연쇄 번개', icon: '⚡', cd: 7, mp: 22, dur: 0.5, mv: 0, asc: true, desc: '적에서 적으로 튀는 번개. 최대 8명까지 연쇄되며 감전(경직)시킨다.',
    start(s){ s.dir = aimAng(14); fig.root.rotation.y = s.dir; },
    tick(s, dt, k){ if (!s.f && k > 0.35){ s.f = true; sfx('zap');
      let from = new V3(player.pos.x + Math.sin(s.dir) * 0.6, PY() + 1.4, player.pos.z + Math.cos(s.dir) * 0.6), cur = nearestEnemy(14), done = new Set(), mul = 2.3;
      for (let i = 0; i < 8 && cur; i++){ const to = new V3(cur.pos.x, (cur.boss ? cur.cfg.top * 0.5 : 0.7) + cur.fly, cur.pos.z); bolt(from, to, 0xc8b0ff); bolt(from, to, 0xffffff); burst(to, 0xc8b0ff, 10, 3, 0.2, 0.35, -2, 1);
        hitFrom(cur, from.x, from.z, pMag() * mul, 2, { stun: 0.5 }); done.add(cur); mul *= 0.92; from = to;
        let nb = null, bd = 7.5; for (const e of ENEMIES){ if (!liveE(e) || done.has(e)) continue; const d = Math.hypot(e.pos.x - to.x, e.pos.z - to.z); if (d < bd){ bd = d; nb = e; } } cur = nb; }
      G.hitStop = 0.06; } },
    pose(k){ return G.pose({ rax: -1.6, re: 0, raz: 0.2, lax: -1.4, laz: 0.6, le: -0.3, sp: 0.2, llx: -0.4, rlx: 0.3 }); } },
  meteor: { n: '메테오', icon: '☄️', cd: 28, mp: 45, dur: 0.9, mv: 0, asc: true, ult: true, desc: '하늘에서 거대한 운석을 떨어뜨린다. 반경 7m 대폭발 + 화상. (궁극기)',
    start(s){ const t = nearestEnemy(18); s.p = t ? t.pos.clone() : new V3(player.pos.x + Math.sin(fig.root.rotation.y) * 8, 0, player.pos.z + Math.cos(fig.root.rotation.y) * 8); clampShapes(s.p, 1); sfx('rune'); banner('', '메 테 오', '', true, 1.2);
      const P = s.p, ring = new THREE.Mesh(new THREE.RingGeometry(6.7, 7.0, 64).rotateX(-Math.PI / 2), ADD(0xffa040)); ring.position.set(P.x, 0.09, P.z); SW.add(ring);
      const mt = new THREE.Group(), core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), sm(0x3a2a20, { flatShading: true, emissive: 0xff5a1a, emissiveIntensity: 1.2 })); mt.add(core); mt.add(glowSprite(0xff7a2a, 9, 0.9));
      later(0.35, () => { sfx('portal'); fallObj(mt, new V3(P.x - 10, 30, P.z - 10), new V3(P.x, 0.6, P.z), 1.0, () => { SW.remove(ring); G.hitStop = 0.14; G.shake = 1.8;
        shockwave(P.x, 0.2, P.z, 9, 0xffa040, 0.8); shockwave(P.x, 2, P.z, 6, 0xffffff, 0.5); burst(new V3(P.x, 1, P.z), 0xff7a2a, 160, 14, 0.5, 1.2, -4, 3); burst(new V3(P.x, 0.5, P.z), 0x4a3a30, 60, 9, 0.4, 1.4, -8, 4);
        explode(P.x, P.z, 7, pMag() * 7.5, 0xff7a2a, 16, { dot: [pMag() * 0.4, 4, 0xff6a2a] }); }); });
      FIELDS.push({ t: 0, T: 1.35, tick(f){ ring.material.opacity = 0.5 + Math.sin(f.t * 18) * 0.4; } }); },
    pose(k){ const u = ease(Math.min(1, k * 2)); return G.pose({ rax: -3.0 * u, re: 0, lax: -3.0 * u, le: 0, sp: -0.35 * u, hd: -0.6 * u, llx: -0.2, rlx: 0.2 }); } },
  // ── 암살자 ──
  step: { n: '그림자 습격', icon: '👤', cd: 5, mp: 12, dur: 0.36, mv: 0, desc: '가장 가까운 적의 등 뒤로 순간이동해 급소를 찌른다. 무조건 치명타.',
    start(s){ const t = nearestEnemy(13); burst(new V3(player.pos.x, 0.9, player.pos.z), 0x6a2aff, 26, 3, 0.35, 0.6, 0, 1.5); sfx('puff'); inv = Math.max(inv, 0.4);
      if (t){ const a = Math.atan2(t.pos.x - player.pos.x, t.pos.z - player.pos.z), r = t.cfg.rad * (t.boss ? t.cfg.scale || 1 : 1) + 0.8; player.pos.set(t.pos.x + Math.sin(a) * r, 0.04, t.pos.z + Math.cos(a) * r); clampShapes(player.pos, 0.4); G.collide(player.pos, 0.36); s.tg = t; fig.root.rotation.y = a + Math.PI; }
      else { const a = fig.root.rotation.y; player.pos.x += Math.sin(a) * 6; player.pos.z += Math.cos(a) * 6; clampShapes(player.pos, 0.4); }
      burst(new V3(player.pos.x, 0.9, player.pos.z), 0x6a2aff, 26, 3, 0.35, 0.6, 0, 1.5); },
    tick(s, dt, k){ if (!s.f && k > 0.4){ s.f = true; trail(fig.root.rotation.y, 1.0, 0.3, false, 0xb46aff); sfx('crit');
      if (s.tg && liveE(s.tg)){ hitFrom(s.tg, player.pos.x, player.pos.z, pAtk() * 2.7, 5, { crit: true }); G.hitStop = 0.09; G.shake = 0.6; } } },
    pose(k){ return G.pose({ rax: -1.7, raz: 0.3, re: -0.1, lax: -1.2, laz: -0.3, le: -0.4, sp: 0.5, hy: 0.72, llx: -0.9, rlx: 0.6, lk: 0.9, rk: 0.4, hd: 0.1 }); } },
  daggers: { n: '독 단검 난무', icon: '🗡️', cd: 6, mp: 14, dur: 0.36, mv: 0.3, desc: '독을 바른 단검 5자루를 던진다. 맞은 적은 4초간 중독.',
    start(s){ s.dir = aimAng(16); fig.root.rotation.y = s.dir; },
    tick(s, dt, k){ if (!s.f && k > 0.35){ s.f = true; sfx('throw'); for (let i = 0; i < 5; i++) pShot({ kind: 'dagger', ang: s.dir + (i - 2) * 0.15, sp: 24, life: 0.6, dmg: pAtk() * 0.95, col: 0x9aff6a, trailC: 0x7aff4a, pierce: 1, opt: { dot: [pAtk() * 0.35, 4, 0x8aff4a] } }); } },
    pose(k){ return G.pose({ rax: -1.4, raz: k < 0.35 ? -1.0 : 0.9, re: -0.1, lax: -1.4, laz: k < 0.35 ? 1.0 : -0.9, le: -0.1, sp: 0.3 }); } },
  clones: { n: '그림자 분신', icon: '👥', cd: 18, mp: 28, dur: 0.5, mv: 0, asc: true, desc: '9초 동안 함께 싸우는 그림자 분신 2명을 불러낸다.',
    start(s){ sfx('summon'); sfx('puff'); const a = fig.root.rotation.y; for (const sd of [-1, 1]) spawnClone(player.pos.x + Math.cos(a) * sd * 1.6, player.pos.z - Math.sin(a) * sd * 1.6); },
    pose(k){ return G.pose({ rax: -0.6, raz: -1.2, lax: -0.6, laz: 1.2, sp: -0.1, hd: -0.2 }); } },
  lotus: { n: '사신의 춤', icon: '🌑', cd: 26, mp: 40, dur: 1.6, mv: 0, asc: true, ult: true, desc: '그림자가 되어 주변 적 최대 10명을 순식간에 베어 나간다. 체력 25% 이하의 일반 몬스터는 즉사. (궁극기)',
    start(s){ s.tg = foesIn(player.pos.x, player.pos.z, 15).sort((a, b) => Math.hypot(a.pos.x - player.pos.x, a.pos.z - player.pos.z) - Math.hypot(b.pos.x - player.pos.x, b.pos.z - player.pos.z)).slice(0, 10); s.i = 0; s.nt = 0.1; inv = Math.max(inv, 2); banner('', '사신의 춤', '', true, 1.0); sfx('roar'); s.o = player.pos.clone(); },
    tick(s, dt, k){ s.nt -= dt; inv = Math.max(inv, 0.3);
      if (s.nt <= 0 && s.i < s.tg.length){ s.nt = 0.12; const t = s.tg[s.i++]; if (!liveE(t)) return; const a = R() * TAU, r = t.cfg.rad * (t.boss ? t.cfg.scale || 1 : 1) + 0.9;
        const from = player.pos.clone(); player.pos.set(t.pos.x + Math.sin(a) * r, 0.04, t.pos.z + Math.cos(a) * r); clampShapes(player.pos, 0.4); fig.root.rotation.y = a + Math.PI;
        bolt(new V3(from.x, 1, from.z), new V3(player.pos.x, 1, player.pos.z), 0xb46aff); trail(fig.root.rotation.y, 1.0, rr(-0.5, 0.5), false, 0xff4a8a); sfx('crit'); G.hitStop = 0.04;
        if (!t.boss && t.hp < t.max * 0.25){ dmgNum(new V3(t.pos.x, t.cfg.top + 0.6, t.pos.z), '처형', 'crit'); killEnemy(t); comboHit(); } else hitFrom(t, player.pos.x, player.pos.z, pAtk() * 2.6, 3, { critAdd: 0.3 }); }
      if (!s.f && (s.i >= s.tg.length && s.nt <= 0 || k > 0.92)){ s.f = true; shockwave(player.pos.x, 0.15, player.pos.z, 5, 0xff4a8a, 0.5); burst(new V3(player.pos.x, 0.8, player.pos.z), 0xb46aff, 60, 7, 0.35, 0.8, -1, 2); sfx('boom'); G.shake = 1.0;
        for (const e of foesIn(player.pos.x, player.pos.z, 4.5)) hitFrom(e, player.pos.x, player.pos.z, pAtk() * 2, 10); s.t = s.dur; } },
    pose(k){ return G.pose({ rax: -1.5, raz: -1.3, lax: -1.5, laz: 1.3, sp: 0.6, hy: 0.7, llx: -0.8, rlx: 0.6, lk: 0.8, rk: 0.6 }); } },
};
function bowPose(u){ return G.pose({ lax: -1.55, laz: 0.05, le: 0, rax: -1.45, raz: 0.15, re: -0.5 - 1.6 * u, sp: 0.1, sz: 0, hd: 0, llx: -0.25, rlx: 0.25 }); }
function staffPose(k){ const u = ease(Math.min(1, k / 0.4)); return G.pose({ rax: -0.6 - 1.0 * u, re: -0.9 + 0.8 * u, raz: 0.1, lax: -0.9 * u, laz: 0.4, le: -0.6, sp: 0.15 * u, llx: -0.3, rlx: 0.2 }); }

// ── 스킬 사용 ──
let sk = null;
const SKCD = {};
const slotSkill = i => S.job ? JOBS[S.job].skills[i] : null;
const slotOpen = i => !!S.job && (i < 2 || S.asc);
const skCd = id => SKL[id].cd * Math.max(0.7, 1 - (S.int - 1) * 0.006);
function useSkill(i){
  if (!inStory || !S.sword || G.lock || dead || sk) return;
  if (!S.job){ hint(jobUnlocked() ? '광장의 <b>⚜ 직업</b>에서 직업을 선택하면 스킬을 쓸 수 있다 (<b>V</b>)' : '1-1을 클리어하면 직업을 선택할 수 있다', 2.2); return; }
  if (!slotOpen(i)){ hint(`<b>각성</b> 후 해금 · Lv.${ASC_LV} + 1-${ASC_STAGE} 클리어`, 1.8); return; }
  const id = slotSkill(i), d = SKL[id];
  if ((SKCD[id] || 0) > 0){ hint(`${d.n} 재사용까지 <b>${SKCD[id].toFixed(1)}</b>초`, 1); return; }
  if (mp < d.mp){ hint('MP가 부족하다', 1); return; }
  mp -= d.mp; SKCD[id] = skCd(id); atk = null; roll = null; cast = null;
  sk = { id, d, t: 0, dur: d.dur }; d.start && d.start(sk); refreshHud();
}
function updateSkill(dt){
  for (const k in SKCD) SKCD[k] = Math.max(0, SKCD[k] - dt);
  if (!sk) return;
  sk.t += dt; const k = Math.min(1, sk.t / sk.dur);
  G.moveMul = sk.d.mv ?? 0; G.faceLock = true; G.noJump = true;
  sk.d.tick && sk.d.tick(sk, dt, k);
  if (sk && sk.t >= sk.dur){ sk.d.end && sk.d.end(sk); sk = null; }
}
// 기본 공격 (직업별)
function basicHit(a, c){
  const j = S.job;
  if (j === 'archer'){ const n = a.i === 2 ? 3 : 1; sfx('bow'); for (let k = 0; k < n; k++) pShot({ kind: 'arrow', ang: a.ry + (k - (n - 1) / 2) * 0.14, sp: 30, life: 0.55, dmg: pAtk() * (a.i === 2 ? 0.85 : 1.0), col: jobColor(), pierce: a.i === 2 ? 1 : 0, kb: 3, opt: { mpGain: 1.2 } }); return; }
  if (j === 'mage'){ sfx('zap'); const big = a.i === 2;
    pShot({ kind: big ? 'orb' : 'bolt', ang: a.ry, sp: big ? 15 : 22, life: 0.8, dmg: pMag() * (big ? 0.9 : 0.75), col: jobColor(), trailC: jobColor(), homing: 5, r: big ? 0.5 : 0.35, opt: { mpGain: 1.5 },
      onEnd: big ? o => explode(o.mesh.position.x, o.mesh.position.z, 2.2, pMag() * 0.9, jobColor(), 5) : null }); return; }
  trail(a.ry, 1.05, a.i === 0 ? 0.25 : a.i === 1 ? -0.25 : 0, a.i === 2, jobColor());
  hitSweep(c.range * (j === 'sword' ? 1.15 : 1), a.i === 2 ? Math.PI : 1.25, c.mul * (j === 'rogue' ? 0.85 : 1), a.i === 2 ? 9 : 5);
}
const isRanged = () => S.job === 'archer' || S.job === 'mage';

// ── 무기 ──
function makeBow(col){
  const g = new THREE.Group(), b = new THREE.Group(); b.position.x = 0.62; g.add(b);   // 손잡이(활 중앙)가 손 위치
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 6, 28, Math.PI * 0.9), M.woodD); arc.rotation.z = Math.PI * 0.55; b.add(arc);
  for (const sy of [1, -1]){ const t = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), ADD(col)); t.position.set(-0.097, sy * 0.612, 0); b.add(t); }
  const str = new THREE.Mesh(new THREE.BoxGeometry(0.008, 1.22, 0.008), new THREE.MeshBasicMaterial({ color: col, toneMapped: false })); str.position.x = -0.097; b.add(str);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 8), M.gold); grip.position.x = -0.62; b.add(grip);
  arc.castShadow = true; g.userData.glow = str.material; return g;
}
function makeStaff(col){
  const g = new THREE.Group();
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.9, 8), M.woodD); sh.position.y = 0.35; g.add(sh);
  const cr = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 16), M.gold); cr.position.y = 1.36; g.add(cr);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), ADD(col)); orb.position.y = 1.36; g.add(orb);
  const gl = glowSprite(col, 0.9, 0.9); gl.position.y = 1.36; g.add(gl);
  g.userData.glow = orb.material; return g;
}
let offhand = null, aura = null;
function equipJob(){
  if (sword){ sword.parent && sword.parent.remove(sword); sword = null; }
  if (offhand){ offhand.parent && offhand.parent.remove(offhand); offhand = null; }
  if (aura){ fig.root.remove(aura); aura = null; }
  const j = S.job, col = jobColor(), a = S.asc;
  if (j === 'archer'){ sword = makeBow(col); sword.position.set(0, -0.36, 0); sword.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V3(0, 1, 0), new V3(0, 0, 1), new V3(1, 0, 0))); fig.elL.add(sword); if (a) sword.scale.setScalar(1.15); }
  else if (j === 'mage'){ sword = makeStaff(col); sword.position.set(0, -0.36, 0.02); sword.rotation.x = Math.PI / 2; fig.elR.add(sword); if (a) sword.scale.setScalar(1.15); }
  else if (j === 'rogue'){ sword = makeSword(0.62, col); sword.position.set(0, -0.36, 0.02); sword.rotation.x = Math.PI / 2; fig.elR.add(sword); offhand = makeSword(0.62, col); offhand.position.set(0, -0.36, 0.02); offhand.rotation.x = Math.PI / 2; fig.elL.add(offhand); }
  else { sword = makeSword(j === 'sword' ? (a ? 1.3 : 1.12) : 1, col); sword.position.set(0, -0.36, 0.02); sword.rotation.x = Math.PI / 2; fig.elR.add(sword); }
  if (a){ aura = new THREE.Group(); const r = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.82, 48).rotateX(-Math.PI / 2), ADD(col)); r.position.y = 0.05; aura.add(r);
    const r2 = new THREE.Mesh(polarRing(0.5, 0.95, 48), ADDM(G.tex(G.runeStrip(512, 64, 8, '#' + new THREE.Color(col).getHexString(), 0, 5), true, 1, 1), 0.6)); r2.position.y = 0.04; aura.add(r2); aura.userData.r = r2;
    const gl = glowSprite(col, 2.2, 0.25); gl.position.y = 0.9; aura.add(gl); fig.root.add(aura); }
  if (sword) sword.visible = inStory;
}

// ───────────────────────── 외형 꾸미기 (의상실) ─────────────────────────
S.cos = Object.assign({ own: [], eq: {} }, S.cos || {});
const RAR = [{ n: '일반', c: '#b8c4cc' }, { n: '희귀', c: '#5ab8ff' }, { n: '영웅', c: '#c07aff' }, { n: '전설', c: '#ffb03a' }];
const SLOTS = [['hat', '머리', '👑'], ['back', '등', '🪽'], ['body', '몸', '🧍'], ['wpn', '무기 효과', '⚔️'], ['aura', '오라', '✨']];

// ── 월드 파티클 (광장 · 숲 공용) ──
const AN = 520, aPos = new Float32Array(AN * 3), aCol = new Float32Array(AN * 3), aSz = new Float32Array(AN), aAl = new Float32Array(AN), AL = [];
const aGeo = new THREE.BufferGeometry();
aGeo.setAttribute('position', new THREE.BufferAttribute(aPos, 3)); aGeo.setAttribute('aCol', new THREE.BufferAttribute(aCol, 3)); aGeo.setAttribute('aSize', new THREE.BufferAttribute(aSz, 1)); aGeo.setAttribute('aAlpha', new THREE.BufferAttribute(aAl, 1));
const aPts = new THREE.Points(aGeo, pMat); aPts.frustumCulled = false; G.scene.add(aPts);
const _ac = new THREE.Color();
function emit(x, y, z, vx, vy, vz, col, size, life, o = {}){
  if (AL.length >= AN) AL.shift(); _ac.set(col);
  AL.push({ x, y, z, vx, vy, vz, r: _ac.r, g: _ac.g, b: _ac.b, s: size, t: 0, life, grav: o.grav || 0, drag: o.drag ?? 1, sway: o.sway || 0, ph: R() * 6, grow: o.grow || 0, a: o.a ?? 1 });
}
function updateAP(dt){
  for (let i = AL.length - 1; i >= 0; i--){ const p = AL[i]; p.t += dt; if (p.t >= p.life){ AL.splice(i, 1); continue; }
    p.vy += p.grav * dt; const dr = Math.exp(-p.drag * dt); p.vx *= dr; p.vz *= dr; if (p.drag) p.vy *= dr;
    p.x += (p.vx + Math.sin(p.t * 3 + p.ph) * p.sway) * dt; p.y += p.vy * dt; p.z += (p.vz + Math.cos(p.t * 2.6 + p.ph) * p.sway) * dt; }
  for (let i = 0; i < AN; i++){ const p = AL[i];
    if (!p){ aAl[i] = 0; continue; }
    const k = p.t / p.life; aPos[i * 3] = p.x; aPos[i * 3 + 1] = p.y; aPos[i * 3 + 2] = p.z; aCol[i * 3] = p.r; aCol[i * 3 + 1] = p.g; aCol[i * 3 + 2] = p.b;
    aSz[i] = p.s * (1 + p.grow * k); aAl[i] = p.a * Math.min(1, k * 6) * (1 - k); }
  aGeo.attributes.position.needsUpdate = aGeo.attributes.aCol.needsUpdate = aGeo.attributes.aSize.needsUpdate = aGeo.attributes.aAlpha.needsUpdate = true;
}
// 번개 잔선
const ZAPS = [];
function zap(a, b, col){
  const pts = [], n = 6; for (let i = 0; i <= n; i++){ const f = i / n, j = i === 0 || i === n ? 0 : 0.12; pts.push(new V3(a.x + (b.x - a.x) * f + rr(-j, j), a.y + (b.y - a.y) * f + rr(-j, j), a.z + (b.z - a.z) * f + rr(-j, j))); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false })); G.scene.add(l); ZAPS.push({ l, t: 0 });
}
function updateZaps(dt){ for (let i = ZAPS.length - 1; i >= 0; i--){ const z = ZAPS[i]; z.t += dt; z.l.material.opacity = 1 - z.t / 0.12; if (z.t > 0.12){ G.scene.remove(z.l); z.l.geometry.dispose(); z.l.material.dispose(); ZAPS.splice(i, 1); } } }

// ── 재질 ──
const cm = (c, o = {}) => G.std(Object.assign({ color: c, roughness: 0.5, side: THREE.DoubleSide }, o));
const GLOW = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
const COS_T = { value: 0 };
// 피부 셰이더 확장: 림라이트 + 패턴 (용암 균열 · 은하)
function skin(base, o = {}){
  const m = G.std(Object.assign({ side: THREE.DoubleSide }, base));
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = COS_T; sh.uniforms.uRim = { value: new THREE.Color(o.rim || 0) }; sh.uniforms.uRimK = { value: o.rimK || 0 };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vOP; uniform float uT, uRimK; uniform vec3 uRim;
      float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y), mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float fres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.5);
      totalEmissiveRadiance += uRim * fres * uRimK;
      ${o.lava ? `float cr = abs(n3(vOP * 7.0 + vec3(0.0, uT * 0.25, 0.0)) * 2.0 - 1.0); float lv = smoothstep(0.12, 0.0, cr) * (0.7 + 0.3 * sin(uT * 3.0 + vOP.y * 9.0));
        diffuseColor.rgb *= 1.0 - lv * 0.8; totalEmissiveRadiance += vec3(1.0, 0.35, 0.05) * lv * 2.6;` : ''}
      ${o.galaxy ? `vec3 q = vOP * 9.0; float st = step(0.985, h3(floor(q * 3.0))) * (0.6 + 0.4 * sin(uT * 4.0 + h3(floor(q * 3.0)) * 40.0));
        float neb = n3(vOP * 3.0 + vec3(uT * 0.05)); totalEmissiveRadiance += mix(vec3(0.15, 0.05, 0.4), vec3(0.05, 0.4, 0.7), neb) * neb * 0.9 + vec3(1.0) * st * 2.5;` : ''}
      ${o.crystal ? `totalEmissiveRadiance += vec3(0.3, 0.9, 1.0) * (0.15 + 0.25 * n3(vOP * 5.0 + vec3(uT * 0.3)));` : ''}`);
  };
  m.customProgramCacheKey = () => 'skin' + JSON.stringify(o);
  return m;
}
const DEF_SKIN = G.CLAY;

// ── 날개 텍스처 (캔버스) ──
const wingTex = {};
function wingT(kind){
  if (wingTex[kind]) return wingTex[kind];
  const c = G.cnv(512), x = c.getContext('2d'), O = [30, 90];
  if (kind === 'angel'){
    for (let layer = 0; layer < 3; layer++){ const n = [13, 11, 8][layer], L0 = [470, 330, 200][layer], L1 = [250, 190, 120][layer], w = [26, 30, 34][layer];
      for (let i = 0; i < n; i++){ const f = i / (n - 1), a = -0.15 + f * 1.45, L = L0 + (L1 - L0) * f;
        x.save(); x.translate(O[0], O[1]); x.rotate(a); const gr = x.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, '#fffdf6'); gr.addColorStop(0.8, layer ? '#f6f3ea' : '#e9e6dc'); gr.addColorStop(1, layer ? '#ece8dc' : '#cfcabd');
        x.fillStyle = gr; x.strokeStyle = 'rgba(150,140,120,.45)'; x.lineWidth = 2; x.beginPath(); x.ellipse(L * 0.55, 0, L * 0.5, w, 0, 0, TAU); x.fill(); x.stroke();
        x.strokeStyle = 'rgba(170,160,140,.4)'; x.beginPath(); x.moveTo(L * 0.1, 0); x.lineTo(L * 0.98, 0); x.stroke(); x.restore(); } }
  } else if (kind === 'dragon'){
    const tips = [[490, 70], [470, 250], [380, 400], [250, 470], [120, 440]];
    x.fillStyle = (() => { const g = x.createLinearGradient(0, 0, 512, 512); g.addColorStop(0, '#5a0a14'); g.addColorStop(1, '#1a0408'); return g; })();
    x.beginPath(); x.moveTo(O[0], O[1]); x.lineTo(...tips[0]); for (let i = 1; i < tips.length; i++){ const [ax, ay] = tips[i - 1], [bx, by] = tips[i]; x.quadraticCurveTo((ax + bx) / 2 - (by - ay) * 0.12 - 40, (ay + by) / 2 - 30, bx, by); } x.quadraticCurveTo(60, 300, O[0], O[1] + 40); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(255,60,40,.35)'; x.lineWidth = 3; x.stroke();
    x.strokeStyle = '#2a1a14'; x.lineCap = 'round'; for (const [tx, ty] of tips){ x.lineWidth = 12; x.beginPath(); x.moveTo(O[0], O[1]); x.lineTo(tx, ty); x.stroke(); }
    x.fillStyle = '#d8c8a8'; x.beginPath(); x.moveTo(490, 70); x.lineTo(510, 40); x.lineTo(478, 62); x.fill();
  } else if (kind === 'butterfly'){
    const lobe = (cx, cy, rx, ry, rot, c1, c2) => { x.save(); x.translate(cx, cy); x.rotate(rot); const g = x.createRadialGradient(-rx * 0.6, 0, 10, 0, 0, rx); g.addColorStop(0, c1); g.addColorStop(0.75, c2); g.addColorStop(1, '#0a0418'); x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, TAU); x.fill(); x.strokeStyle = '#120820'; x.lineWidth = 8; x.stroke();
      x.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 5; i++){ x.beginPath(); x.arc(rx * 0.55 + Math.cos(i) * rx * 0.25, Math.sin(i * 1.7) * ry * 0.5, 7 + (i % 2) * 4, 0, TAU); x.fill(); } x.restore(); };
    lobe(230, 170, 210, 140, -0.35, '#7af6ff', '#7a3aff'); lobe(190, 360, 150, 110, 0.5, '#ff8ae0', '#5a2aff');
  } else if (kind === 'rune'){
    x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++){ const a = -0.25 + i * 0.27, L = 470 - i * 45; x.save(); x.translate(O[0], O[1]); x.rotate(a);
      const g = x.createLinearGradient(0, 0, L, 0); g.addColorStop(0, 'rgba(120,240,255,.9)'); g.addColorStop(0.7, 'rgba(80,180,255,.55)'); g.addColorStop(1, 'rgba(255,220,120,0)');
      x.fillStyle = g; x.beginPath(); x.moveTo(0, -6); x.quadraticCurveTo(L * 0.5, -32, L, 0); x.quadraticCurveTo(L * 0.5, 22, 0, 6); x.fill();
      x.strokeStyle = 'rgba(220,255,255,.9)'; x.lineWidth = 2; x.beginPath(); x.moveTo(10, 0); x.lineTo(L * 0.9, 0); x.stroke();
      x.fillStyle = 'rgba(255,230,140,.95)'; for (let k = 1; k < 5; k++){ x.fillRect(L * k / 5.5 - 4, -4, 8, 8); } x.restore(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return wingTex[kind] = t;
}
function wings(kind, span, opt = {}){
  const g = new THREE.Group(); g.position.set(0, 0.48, -0.17);
  const add = opt.add, mat = add ? new THREE.MeshBasicMaterial({ map: wingT(kind), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
    : G.std({ map: wingT(kind), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7, emissive: opt.em || 0, emissiveMap: opt.em ? wingT(kind) : null, emissiveIntensity: opt.emI || 0.6 });
  const geo = new THREE.PlaneGeometry(span, span); geo.translate(span / 2 - span * 0.06, -span / 2 + span * 0.18, 0);
  const piv = [];
  for (const s of [1, -1]){ const p = new THREE.Group(); p.position.x = s * 0.07; p.scale.x = s; const m = new THREE.Mesh(geo, mat); m.castShadow = !add; p.add(m); g.add(p); piv.push(p); }
  g.rotation.x = 0.12;
  return { obj: g, bone: 'spine', upd(dt, t, mv, air){ const base = opt.fold ?? 0.45, f = air ? Math.sin(t * 11) * 0.7 : Math.sin(t * (opt.rate || 2.2)) * (opt.amp || 0.12) + mv * 0.25; piv[0].rotation.y = base + f; piv[1].rotation.y = -(base + f); } };
}
// 망토
function cape(c1, opt = {}){
  const g = new THREE.Group(); g.position.set(0, 0.6, -0.19);
  const W = 0.62, H = opt.h || 1.12, geo = new THREE.PlaneGeometry(W, H, 6, 12); geo.translate(0, -H / 2, 0);
  const base = geo.attributes.position.array.slice();
  if (opt.tatter) for (let i = 0; i < base.length; i += 3){ const t = -base[i + 1] / H; if (t > 0.75) base[i + 1] -= (R() * 0.22) * (t - 0.75) * 4; }
  const m = new THREE.Mesh(geo, cm(c1, { roughness: 0.85 })); m.castShadow = true; g.add(m);
  if (opt.trim){ const tr = new THREE.Mesh(geo, cm(opt.trim, { metalness: 0.8, roughness: 0.3 })); tr.scale.set(1.06, 1.025, 1); tr.position.z = -0.008; g.add(tr); }
  if (opt.fur){ const fr = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 20), cm(opt.fur, { roughness: 1 })); fr.rotation.x = Math.PI / 2 - 0.2; fr.position.set(0, -0.02, 0.17); fr.scale.set(1.2, 1, 0.8); g.add(fr); }
  g.rotation.x = 0.16;
  const P = geo.attributes.position;
  return { obj: g, bone: 'spine', upd(dt, t, mv){ for (let i = 0; i < P.count; i++){ const bx = base[i * 3], by = base[i * 3 + 1], k = -by / H;
      P.setXYZ(i, bx, by, -k * k * (0.08 + mv * 0.55) + Math.sin(t * (4 + mv * 6) + k * 4 + bx * 4) * 0.035 * k); }
    P.needsUpdate = true; geo.computeVertexNormals();
    if (opt.smoke && R() < dt * 18){ const v = m.localToWorld(new V3(rr(-0.3, 0.3), -H, 0)); emit(v.x, v.y, v.z, rr(-0.2, 0.2), rr(0.2, 0.6), rr(-0.2, 0.2), 0x6a2aaa, 0.45, 1.2, { grow: 1.5, a: 0.5 }); } } };
}
const _w = new V3();
const gsAt = (x, y, z, c, sc, op) => { const g = glowSprite(c, sc, op); g.position.set(x, y, z); return g; };

// ── 아이템 목록 ──
const COS = {
  hat: [
    { id: 'cat', n: '고양이 귀', icon: '🐱', r: 0, p: 900, mk(){ const g = new THREE.Group(); for (const s of [1, -1]){ const e = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.17, 4), cm(0xf4f1ea)); e.position.set(s * 0.12, 0.37, 0); e.rotation.z = -s * 0.32; g.add(e); const i = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.11, 4), cm(0xffa0b8)); i.position.set(s * 0.115, 0.36, 0.03); i.rotation.z = -s * 0.32; g.add(i); } return { obj: g }; } },
    { id: 'straw', n: '여름 밀짚모자', icon: '👒', r: 0, p: 1200, mk(){ const g = new THREE.Group(), st = cm(0xe8c878, { roughness: 0.9 }); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.02, 28), st); b.position.y = 0.31; g.add(b); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.205, 0.17, 24), st); c.position.y = 0.4; g.add(c); const bd = new THREE.Mesh(new THREE.CylinderGeometry(0.207, 0.207, 0.045, 24, 1, true), cm(0xc8302a)); bd.position.y = 0.345; g.add(bd); g.rotation.x = -0.1; return { obj: g }; } },
    { id: 'crown', n: '황금 왕관', icon: '👑', r: 1, p: 4000, mk(){ const g = new THREE.Group(); addCrown(g, 0.33, 0.15, 0.13); g.add(gsAt(0, 0.42, 0, 0xffd36a, 0.6, 0.35)); return { obj: g }; } },
    { id: 'viking', n: '바이킹 뿔투구', icon: '🪖', r: 1, p: 4500, mk(){ const g = new THREE.Group(); const d = new THREE.Mesh(new THREE.SphereGeometry(0.23, 22, 12, 0, TAU, 0, Math.PI / 2), M.steel); d.position.y = 0.19; g.add(d); const br = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.025, 6, 28), M.bronze); br.rotation.x = Math.PI / 2; br.position.y = 0.19; g.add(br);
      const nb = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.03), M.bronze); nb.position.set(0, 0.2, 0.225); g.add(nb);
      for (const s of [1, -1]){ const h1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.2, 10), cm(0xf2ead2)); h1.position.set(s * 0.28, 0.3, 0); h1.rotation.z = -s * 1.1; g.add(h1); const h2 = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.2, 10), cm(0xf2ead2)); h2.position.set(s * 0.38, 0.43, 0); h2.rotation.z = -s * 0.25; g.add(h2); } return { obj: g }; } },
    { id: 'wizard', n: '별빛 마법사 모자', icon: '🧙', r: 1, p: 5000, mk(){ const g = new THREE.Group(), pm = cm(0x3a2a8a, { roughness: 0.8 }); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.02, 28), pm); b.position.y = 0.3; g.add(b);
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 24), pm); c.position.set(0, 0.6, -0.04); c.rotation.x = -0.18; g.add(c); const bd = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.215, 0.05, 24, 1, true), M.gold); bd.position.y = 0.33; g.add(bd);
      for (let i = 0; i < 6; i++){ const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), GLOW(0xffe08a)); const a = i * 1.7, h = 0.4 + i * 0.07, r = 0.2 * (1 - (h - 0.3) / 0.6) + 0.01; s.position.set(Math.cos(a) * r, h, Math.sin(a) * r - 0.04); g.add(s); }
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), GLOW(0xffe08a)); tip.position.set(0, 0.9, -0.1); g.add(tip); g.add(gsAt(0, 0.9, -0.1, 0xffe08a, 0.3, 0.8)); return { obj: g }; } },
    { id: 'devil', n: '악마의 뿔', icon: '😈', r: 2, p: 9000, mk(){ const g = new THREE.Group(), hm = cm(0x3a0a10, { emissive: 0xff2a1a, emissiveIntensity: 0.5, roughness: 0.3 });
      for (const s of [1, -1]){ const a = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.055, 0.16, 10), hm); a.position.set(s * 0.13, 0.36, 0.04); a.rotation.z = -s * 0.5; g.add(a); const b = new THREE.Mesh(new THREE.ConeGeometry(0.031, 0.18, 10), hm); b.position.set(s * 0.19, 0.5, 0.0); b.rotation.set(-0.3, 0, s * 0.35); g.add(b); }
      return { obj: g, upd(dt, t){ hm.emissiveIntensity = 0.5 + Math.sin(t * 3) * 0.3; } }; } },
    { id: 'samurai', n: '무사의 투구', icon: '⛩️', r: 2, p: 11000, mk(){ const g = new THREE.Group(), lq = cm(0x16161c, { roughness: 0.25, metalness: 0.3 }); const d = new THREE.Mesh(new THREE.SphereGeometry(0.235, 22, 12, 0, TAU, 0, Math.PI / 2), lq); d.position.y = 0.19; g.add(d);
      const ng = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.13, 24, 1, true, Math.PI * 0.25, Math.PI * 1.5), lq); ng.position.set(0, 0.15, -0.02); ng.rotation.y = Math.PI; g.add(ng);
      const cr = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 6, 28, Math.PI), M.gold); cr.position.set(0, 0.38, 0.17); cr.rotation.x = -0.25; g.add(cr); const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 16), cm(0xc8202a)); pl.rotation.x = Math.PI / 2; pl.position.set(0, 0.31, 0.225); g.add(pl);
      for (const s of [1, -1]){ const f = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.14), lq); f.position.set(s * 0.25, 0.2, 0.08); f.rotation.y = s * 0.5; f.rotation.z = -s * 0.3; g.add(f); } return { obj: g }; } },
    { id: 'halo', n: '천사의 고리', icon: '😇', r: 2, p: 12000, mk(){ const g = new THREE.Group(), h = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 8, 40), GLOW(0xffe8a0)); h.rotation.x = Math.PI / 2; g.add(h); const gl = glowSprite(0xffe08a, 0.9, 0.5); g.add(gl);
      return { obj: g, upd(dt, t){ g.position.y = 0.55 + Math.sin(t * 2) * 0.025; h.rotation.z += dt * 0.6; gl.material.opacity = 0.4 + Math.sin(t * 3) * 0.1; } }; } },
    { id: 'flame', n: '불꽃 군주의 관', icon: '🔥', r: 3, p: 26000, mk(){ const g = new THREE.Group(); const ci = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 6, 32), M.gold); ci.rotation.x = Math.PI / 2; ci.position.y = 0.3; g.add(ci);
      const pts = []; for (let i = 0; i < 7; i++){ const a = i / 7 * TAU, s = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.09, 6), M.gold); s.position.set(Math.cos(a) * 0.2, 0.35, Math.sin(a) * 0.2); g.add(s); pts.push(s); }
      const gl = glowSprite(0xff7a2a, 1.0, 0.45); gl.position.y = 0.45; g.add(gl);
      return { obj: g, upd(dt, t){ for (const s of pts) if (R() < dt * 9){ s.getWorldPosition(_w); emit(_w.x, _w.y + 0.03, _w.z, rr(-0.15, 0.15), rr(0.8, 1.4), rr(-0.15, 0.15), R() < 0.3 ? 0xffe060 : 0xff5a1a, rr(0.12, 0.22), rr(0.35, 0.6), { drag: 2, grow: -0.6 }); } gl.material.opacity = 0.4 + Math.sin(t * 13) * 0.08; } }; } },
    { id: 'voidcrown', n: '공허왕의 왕관', icon: '🌌', r: 3, p: 32000, mk(){ const g = new THREE.Group(), sh = [], cmV = cm(0x0a0412, { emissive: 0x8a2aff, emissiveIntensity: 0.8, roughness: 0.15, metalness: 0.6, flatShading: true });
      for (let i = 0; i < 7; i++){ const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), cmV); c.scale.set(0.7, 2.2, 0.7); g.add(c); sh.push(c); }
      const gl = glowSprite(0xa04aff, 1.2, 0.45); gl.position.y = 0.45; g.add(gl);
      return { obj: g, upd(dt, t){ sh.forEach((c, i) => { const a = t * 0.8 + i / sh.length * TAU; c.position.set(Math.cos(a) * 0.27, 0.46 + Math.sin(t * 2 + i) * 0.03, Math.sin(a) * 0.27); c.rotation.y = -a; });
        if (R() < dt * 6){ const c = pick(sh); c.getWorldPosition(_w); emit(_w.x, _w.y, _w.z, 0, rr(0.2, 0.5), 0, 0xb46aff, 0.15, 0.8); } } }; } },
  ],
  back: [
    { id: 'cape', n: '기사의 붉은 망토', icon: '🧣', r: 0, p: 1500, mk: () => cape(0xa8202a) },
    { id: 'royal', n: '왕실 망토', icon: '🤴', r: 1, p: 5500, mk: () => cape(0x4a1a7a, { trim: 0xd8a83a, fur: 0xf8f4ec, h: 1.2 }) },
    { id: 'shadowcloak', n: '그림자 망토', icon: '🦇', r: 2, p: 10000, mk: () => cape(0x120a18, { tatter: true, smoke: true, h: 1.25 }) },
    { id: 'butterfly', n: '요정 나비 날개', icon: '🦋', r: 2, p: 12000, mk(){ const w = wings('butterfly', 1.05, { em: 0x7a5aff, emI: 0.9, fold: 0.35, amp: 0.25, rate: 3.2 }); const u = w.upd; w.upd = (dt, t, mv, air) => { u(dt, t, mv, air); if (R() < dt * 6){ w.obj.getWorldPosition(_w); emit(_w.x + rr(-0.6, 0.6), _w.y + rr(-0.4, 0.3), _w.z + rr(-0.6, 0.6), 0, rr(-0.1, 0.2), 0, R() < 0.5 ? 0x7af6ff : 0xff8ae0, 0.1, 1.2, { sway: 0.3 }); } }; return w; } },
    { id: 'angel', n: '대천사의 날개', icon: '🪽', r: 3, p: 28000, mk(){ const w = wings('angel', 1.5, { em: 0xfff4d0, emI: 0.25, fold: 0.5 }); w.obj.add(gsAt(0, 0, -0.1, 0xfff0c0, 1.6, 0.18)); return w; } },
    { id: 'dragon', n: '흑룡의 날개', icon: '🐉', r: 3, p: 30000, mk(){ const w = wings('dragon', 1.6, { em: 0xff2a1a, emI: 0.25, fold: 0.55, amp: 0.15, rate: 1.6 }); const u = w.upd; w.upd = (dt, t, mv, air) => { u(dt, t, mv, air); if (R() < dt * 4){ w.obj.getWorldPosition(_w); emit(_w.x + rr(-0.5, 0.5), _w.y + rr(-0.5, 0.2), _w.z + rr(-0.5, 0.5), 0, rr(0.3, 0.7), 0, 0xff4a1a, 0.1, 0.9); } }; return w; } },
    { id: 'runewing', n: '룬 에너지 날개', icon: '💠', r: 3, p: 35000, mk(){ const w = wings('rune', 1.7, { add: true, fold: 0.3, amp: 0.2, rate: 1.8 }); const gl = glowSprite(0x7ff3ff, 1.4, 0.3); w.obj.add(gl); const u = w.upd; w.upd = (dt, t, mv, air) => { u(dt, t, mv, air); w.obj.children.forEach(p => { if (p.children[0] && p.children[0].material) p.children[0].material.opacity = 0.75 + Math.sin(t * 4) * 0.2; }); if (R() < dt * 10){ w.obj.getWorldPosition(_w); emit(_w.x + rr(-0.8, 0.8), _w.y + rr(-0.6, 0.4), _w.z + rr(-0.8, 0.8), 0, rr(0.1, 0.4), 0, R() < 0.3 ? 0xffe08a : 0x7ff3ff, 0.09, 1.0); } }; return w; } },
  ],
  body: [
    { id: 'clay', n: '기본 점토', icon: '⚪', r: 0, p: 0, mat: () => DEF_SKIN },
    { id: 'marble', n: '신전 대리석', icon: '🏛️', r: 0, p: 1000, mat: () => skin({ color: 0xf6f3ec, roughness: 0.18 }) },
    { id: 'sakura', n: '벚꽃 핑크', icon: '🌸', r: 0, p: 1200, mat: () => skin({ color: 0xffc0d4, roughness: 0.45 }, { rim: 0xffe0ea, rimK: 0.4 }) },
    { id: 'shadow', n: '그림자 피부', icon: '🌑', r: 1, p: 3500, mat: () => skin({ color: 0x14121c, roughness: 0.5 }, { rim: 0x9a5aff, rimK: 1.4 }) },
    { id: 'obsidian', n: '흑요석', icon: '🖤', r: 1, p: 4500, mat: () => skin({ color: 0x0c0c10, roughness: 0.08, metalness: 0.4 }, { rim: 0x4a6aff, rimK: 0.5 }) },
    { id: 'silver', n: '은빛 기사', icon: '🛡️', r: 2, p: 9000, mat: () => skin({ color: 0xdde4ee, roughness: 0.16, metalness: 1 }) },
    { id: 'gold', n: '순금', icon: '🏆', r: 2, p: 11000, mat: () => skin({ color: 0xffc860, roughness: 0.22, metalness: 1 }, { rim: 0xffa030, rimK: 0.3 }) },
    { id: 'crystal', n: '수정 몸', icon: '💎', r: 3, p: 25000, mat: () => skin({ color: 0x9ae8ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.62 }, { rim: 0xcff8ff, rimK: 1.6, crystal: true }) },
    { id: 'lava', n: '용암 거인', icon: '🌋', r: 3, p: 28000, mat: () => skin({ color: 0x2a2220, roughness: 0.85, emissive: 0x000000 }, { lava: true, rim: 0xff4a1a, rimK: 0.5 }) },
    { id: 'galaxy', n: '은하', icon: '🌠', r: 3, p: 32000, mat: () => skin({ color: 0x080a1a, roughness: 0.3 }, { galaxy: true, rim: 0x6a8aff, rimK: 1.1 }) },
  ],
  wpn: [
    { id: 'none', n: '기본 (직업 색)', icon: '⚪', r: 0, p: 0 },
    { id: 'fire', n: '화염 부여', icon: '🔥', r: 1, p: 3000, col: 0xff6a1a, fx: 0xff8a2a },
    { id: 'frost', n: '서리 부여', icon: '❄️', r: 1, p: 3000, col: 0x8ae8ff, fx: 0xcff8ff },
    { id: 'holy', n: '성스러운 빛', icon: '✝️', r: 2, p: 8000, col: 0xffd36a, fx: 0xfff0b0 },
    { id: 'void', n: '공허 부여', icon: '🟣', r: 2, p: 8000, col: 0xd040ff, fx: 0xb46aff },
    { id: 'rainbow', n: '무지개 프리즘', icon: '🌈', r: 3, p: 20000, col: 'rainbow', fx: 'rainbow' },
  ],
  aura: [
    { id: 'none', n: '없음', icon: '⚪', r: 0, p: 0 },
    { id: 'firefly', n: '반딧불이', icon: '✨', r: 0, p: 1500, upd(dt, t, p){ if (R() < dt * 5) emit(p.x + rr(-1.3, 1.3), p.y + rr(0.3, 1.9), p.z + rr(-1.3, 1.3), 0, rr(-0.05, 0.1), 0, 0xd8ff6a, 0.14, 2.2, { sway: 0.4 }); } },
    { id: 'runering', n: '룬 서클', icon: '🔯', r: 1, p: 3500, mk(){ const g = new THREE.Group(), r = new THREE.Mesh(polarRing(0.55, 1.0, 48), ADDM(G.tex(G.runeStrip(512, 64, 8, '#7ff3ff', 0, 7), true, 1, 1), 0.7)); r.position.y = 0.05; g.add(r); const r2 = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.1, 48).rotateX(-Math.PI / 2), ADD(0x7ff3ff)); r2.position.y = 0.05; g.add(r2); return { obj: g, upd(dt){ r.rotation.y += dt * 0.7; } }; } },
    { id: 'sakura', n: '벚꽃 바람', icon: '🌸', r: 1, p: 4000, upd(dt, t, p){ if (R() < dt * 14) emit(p.x + rr(-1.6, 1.6), p.y + rr(2.0, 2.6), p.z + rr(-1.6, 1.6), rr(-0.3, 0.3), rr(-0.6, -0.35), rr(-0.3, 0.3), R() < 0.5 ? 0xffb0c8 : 0xffd8e4, 0.13, 3.0, { sway: 0.6, drag: 0 }); } },
    { id: 'flame', n: '지옥불', icon: '🔥', r: 2, p: 9000, upd(dt, t, p){ for (let i = 0; i < 2; i++) if (R() < dt * 30){ const a = R() * TAU, r = rr(0.3, 0.6); emit(p.x + Math.cos(a) * r, p.y + 0.1, p.z + Math.sin(a) * r, 0, rr(1.2, 2.2), 0, R() < 0.25 ? 0xffd040 : 0xff4a10, rr(0.2, 0.32), rr(0.4, 0.7), { drag: 1.5, grow: -0.5 }); } } },
    { id: 'shadowsmoke', n: '어둠의 기운', icon: '🌫️', r: 2, p: 9000, upd(dt, t, p){ if (R() < dt * 16){ const a = R() * TAU, r = rr(0.2, 0.7); emit(p.x + Math.cos(a) * r, p.y + rr(0, 0.6), p.z + Math.sin(a) * r, 0, rr(0.3, 0.7), 0, R() < 0.5 ? 0x6a1aaa : 0x3a0a6a, rr(0.4, 0.6), 1.4, { grow: 1.2, a: 0.6, sway: 0.2 }); } } },
    { id: 'lightning', n: '뇌신의 가호', icon: '⚡', r: 2, p: 10000, mk(){ const g = new THREE.Group(), gl = glowSprite(0x7ab8ff, 2.2, 0.2); gl.position.y = 0.9; g.add(gl); return { obj: g, upd(dt, t, p){ gl.material.opacity = 0.15 + (R() < 0.08 ? 0.25 : 0); if (R() < dt * 9){ const a = R() * TAU, b = a + rr(0.6, 1.6), y0 = rr(0.2, 1.6); zap(new V3(p.x + Math.cos(a) * 0.55, p.y + y0, p.z + Math.sin(a) * 0.55), new V3(p.x + Math.cos(b) * 0.55, p.y + y0 + rr(-0.5, 0.5), p.z + Math.sin(b) * 0.55), R() < 0.5 ? 0x9ad8ff : 0xffffff); } } }; } },
    { id: 'stardust', n: '별가루 소용돌이', icon: '🌟', r: 3, p: 22000, mk(){ const g = new THREE.Group(), gl = glowSprite(0xffe08a, 2.4, 0.18); gl.position.y = 0.9; g.add(gl); return { obj: g, upd(dt, t, p){ for (let k = 0; k < 2; k++){ const a = t * 3.2 + k * Math.PI, y = ((t * 0.9 + k * 0.5) % 2.0); if (R() < dt * 40) emit(p.x + Math.cos(a) * 0.75, p.y + y, p.z + Math.sin(a) * 0.75, 0, 0.3, 0, R() < 0.3 ? 0xffffff : 0xffd36a, rr(0.08, 0.14), 0.9); } } }; } },
  ],
};
const cosItem = (slot, id) => COS[slot].find(i => i.id === id);
const owned = (slot, id) => !id || cosItem(slot, id).p === 0 || S.cos.own.includes(slot + ':' + id);
let rainbowCol = new THREE.Color();
const cosWpnCol = () => { const id = LOOK.wpn, it = id && id !== 'none' && cosItem('wpn', id); return it && it.col ? (it.col === 'rainbow' ? rainbowCol.getHex() : it.col) : null; };

// ── 착용 (미리보기 포함) ──
const LOOK = {}, BUILT = {}, worn = [];
let skinMat = null;
function applyLook(set){
  for (const w of worn) w.obj && w.obj.parent && w.obj.parent.remove(w.obj); worn.length = 0;
  Object.assign(LOOK, { hat: null, back: null, body: null, wpn: null, aura: null }, set);
  for (const slot of ['hat', 'back', 'aura']){ const id = LOOK[slot]; if (!id || id === 'none') continue; const it = cosItem(slot, id); if (!it) continue;
    const key = slot + ':' + id, b = BUILT[key] || (BUILT[key] = it.mk ? it.mk() : { upd: it.upd });
    if (b.obj){ (slot === 'aura' ? fig.root : slot === 'hat' ? fig.head : fig.spine).add(b.obj); }
    worn.push(Object.assign({ slot }, b)); }
  const bi = cosItem('body', LOOK.body || 'clay') || COS.body[0];
  skinMat = BUILT['body:' + bi.id] || (BUILT['body:' + bi.id] = bi.mat()); fig.mesh.material = skinMat;
  const wc = LOOK.wpn && LOOK.wpn !== 'none' ? cosItem('wpn', LOOK.wpn) : null;
  for (const w of [sword, offhand]) if (w && w.userData.glow) w.userData.glow.color.set(wc && wc.col !== 'rainbow' ? wc.col : jobColor());
}
const mvAmt = () => clamp((player.speed || 0) / 6, 0, 1);
function updateLook(dt){
  COS_T.value += dt; const t = G.time, p = player.pos, mv = mvAmt(), air = !player.ground;
  rainbowCol.setHSL((t * 0.25) % 1, 0.9, 0.6);
  for (const w of worn) if (w.upd) w.upd(dt, t, w.slot === 'aura' ? p : mv, air);
  const wid = LOOK.wpn; if (wid && wid !== 'none' && sword && sword.visible){ const it = cosItem('wpn', wid);
    if (it.col === 'rainbow') for (const w of [sword, offhand]) if (w && w.userData.glow) w.userData.glow.color.copy(rainbowCol);
    if (R() < dt * 14){ sword.getWorldPosition(_w); const c = it.fx === 'rainbow' ? rainbowCol.getHex() : it.fx; const up = new V3(0, 1, 0).applyQuaternion(sword.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(rr(0.2, 0.9));
      emit(_w.x + up.x, _w.y + up.y, _w.z + up.z, rr(-0.2, 0.2), it.id === 'frost' ? -0.2 : rr(0.3, 0.8), rr(-0.2, 0.2), c, 0.12, 0.5, { drag: 2 }); } }
  updateAP(dt); updateZaps(dt);
}
applyLook(S.cos.eq);

// ───────────────────────── 스테이지 ─────────────────────────
const DIFF = {
  e: { n: '이지', hp: 1, bhp: 1, dmg: 1, rew: 1, rec: 1 },
  m: { n: '미디엄', hp: 1.9, bhp: 1.8, dmg: 1.55, rew: 1.8, rec: 1.55 },
  h: { n: '하드', hp: 3.2, bhp: 3.0, dmg: 2.2, rew: 3, rec: 2.3 },
};
const STAGES = [
  { name: '숲의 입구', desc: '엘드라에게 검을 받고 말랑한 슬라임들로 몸을 풀자. 끝에는 커다란 왕슬라임이 기다린다.', waves: [[['slime', 3]]], boss: 'kingSlime', tut: true },
  { name: '말랑말랑 풀밭', desc: '연못가 꽃밭에 슬라임과 무당벌레가 몰려왔다. 무당벌레는 붉은 길로 돌진!', waves: [[['slime', 4]], [['slime', 3], ['ladybug', 3]]] },
  { name: '버섯 오솔길', desc: '거대 버섯 숲길. 껍질이 단단한 달팽이는 휘청이지 않으니 조심.', waves: [[['shroom', 3], ['slime', 2]], [['shroom', 3], ['snail', 1]]] },
  { name: '꿀벌 소동', desc: '꿀벌 마을 꽃밭. 꽃잎 정령은 움직이지 않지만 꽃잎을 부채꼴로 흩뿌린다.', waves: [[['bee', 3]], [['bee', 3], ['flower', 2]]] },
  { name: '포자 가득한 공터', desc: '버섯 대장 「포자왕」이 자기 왕국을 선포했다.', waves: [[['shroom', 4], ['snail', 1]]], boss: 'chief' },
  { name: '도토리 언덕', desc: '도토리 언덕의 큰 참나무. 다람쥐는 멀리서 도토리를 똑바로 쏜다.', waves: [[['sprout', 3], ['squirrel', 2]], [['squirrel', 3], ['slime', 3]]] },
  { name: '멧돼지 발자국', desc: '진흙탕 숲길. 고슴도치는 몸을 말아 데굴데굴 굴러온다.', waves: [[['boar', 2], ['ladybug', 3]], [['boar', 2], ['hedgehog', 2]]] },
  { name: '윙윙 꽃밭', desc: '끝없는 꽃바다와 풍차. 꽃가루를 잔뜩 묻힌 녀석들이 몰려온다.', waves: [[['bee', 4], ['flower', 2]], [['ladybug', 4], ['bee', 3]]] },
  { name: '이끼 바위길', desc: '이끼 바위 협곡. 땅이 들썩이면 두더지가 튀어나온다!', waves: [[['golem', 1], ['mole', 2]], [['golem', 1], ['snail', 2], ['mole', 1]]] },
  { name: '여왕벌의 정원', desc: '꿀단지 여왕이 황금 정원을 지키고 있다. 날아다니며 침을 쏜다!', waves: [[['bee', 5], ['flower', 2]]], boss: 'queen' },
  { name: '개울가 소풍', desc: '개울가 소풍 자리에 개구리가 혀를 쭉 내민다.', waves: [[['frog', 4]], [['frog', 3], ['raccoon', 2]]] },
  { name: '작은 정령들', desc: '자작나무 정령 숲. 부엉이는 하늘에서 직선으로 내리꽂힌다.', waves: [[['sprout', 4], ['owl', 1]], [['owl', 2], ['flower', 3], ['squirrel', 2]]] },
  { name: '들쭉날쭉 숲길', desc: '가시덤불 미로. 돌진, 돌진, 또 돌진!', waves: [[['hedgehog', 3], ['raccoon', 2]], [['boar', 2], ['mole', 2]], [['golem', 2], ['ladybug', 3]]] },
  { name: '선돌의 그늘', desc: '노을 진 선돌 들판에 숲의 주민들이 모여든다.', waves: [[['snail', 2], ['shroom', 4]], [['owl', 2], ['golem', 1], ['squirrel', 3]]] },
  { name: '엄니왕의 돌진', desc: '붉은 바위 협곡의 지배자 「쿵쾅 엄니왕」. 세 번 연속 돌진을 조심!', waves: [[['boar', 3], ['hedgehog', 2]]], boss: 'tusk' },
  { name: '고목의 뿌리', desc: '거대한 뿌리 사이로 땅속 친구들이 꿈틀댄다.', waves: [[['mole', 3], ['sprout', 3]], [['golem', 2], ['raccoon', 3], ['frog', 2]]] },
  { name: '반딧불 성소', desc: '반딧불 연못의 밤. 어둠 속 부엉이를 조심하자.', waves: [[['owl', 3], ['bee', 3]], [['flower', 4], ['snail', 2], ['ladybug', 4]]] },
  { name: '숲의 시련', desc: '단풍 숲의 수확제. 숲이 세 번의 습격을 준비했다.', waves: [[['slime', 5], ['frog', 3]], [['raccoon', 3], ['squirrel', 3], ['owl', 2]], [['golem', 2], ['hedgehog', 3]]] },
  { name: '고요한 숲의 전야', desc: '벚꽃 신사. 고목이 깨어나기 직전, 숲 전체가 술렁인다.', waves: [[['boar', 3], ['mole', 3], ['owl', 2]], [['golem', 3], ['flower', 3]], [['raccoon', 4], ['hedgehog', 3], ['frog', 2]]] },
  { name: '천년 고목', desc: '천년 고목의 성소. 「그루터기 할배」가 깨어났다. 뿌리와 도토리 폭격을 피하며 맞서라!', waves: [[['sprout', 4], ['golem', 1], ['flower', 2]]], boss: 'treant' },
];
const fmt = n => Math.round(n).toLocaleString();
const recPower = (n, d) => Math.round((330 + (n - 1) * 55) * DIFF[d].rec / 10) * 10;
function power(){ const d = D(); return Math.round((S.job ? 1.12 : 1) * (S.asc ? 1.2 : 1) * (d.atk * 12 + d.maxHp * 1.3 + (S.rune ? d.rune * 2 : 0) + d.crit * 800 + (d.aspd - 1) * 500 + (d.spd - 1) * 400)); }
const stars = (n, d) => ((S.clr || {})[n] || {})[d] || 0;
const unlocked = (n, d) => d === 'e' ? (n === 1 || stars(n - 1, 'e') > 0) : stars(n, 'e') > 0;
const chapterPct = d => { let s = 0; for (let n = 1; n <= 20; n++) s += stars(n, d); return Math.round(s / 60 * 100); };
const rewardOf = (n, d) => { const b = STAGES[n - 1].boss ? 2 : 1, r = DIFF[d].rew; return { exp: Math.round((30 + n * 12) * b * r), gold: Math.round((80 + n * 25) * b * r) }; };
const parTime = st => 35 + st.waves.length * 25 + (st.boss ? 70 : 0);

let battle = null;
function spawnPoint(){
  let best = null, bd = -1;
  for (let k = 0; k < 40; k++){ const sh = pick(SHAPES); let x, z;
    if (sh.c){ const a = R() * TAU, r = Math.sqrt(R()) * (sh.c[2] - 1.5); x = sh.c[0] + Math.cos(a) * r; z = sh.c[1] + Math.sin(a) * r; }
    else { const t = R(), [ax, az, bx, bz, w] = sh.s; x = ax + (bx - ax) * t + rr(-1, 1) * (w - 1.2); z = az + (bz - az) * t + rr(-1, 1) * (w - 1.2); }
    if (outDist(x, z, 1.2) > 0) continue;
    const p = new V3(x, 0, z); G.collide(p, 0.6); const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
    if (d > 6 && d < 22) return p; if (d > bd){ bd = d; best = p; } }
  return best || new V3(stageL.boss[0], 0, stageL.boss[1]);
}
// 귀환 룬진 · 엘드라 (스테이지마다 재배치)
const retRing = new THREE.Group(); SW.add(retRing);
{ const ar = new THREE.Mesh(polarRing(1.6, 2.2, 64), ADDM(G.tex(G.runeStrip(1024, 128, 12, '#7ff3ff', 0, 9), true, 1, 1), 0.95)); ar.position.y = 0.06; retRing.add(ar); retRing.userData.ring = ar;
  const ar2 = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.42, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9ff6ff, toneMapped: false, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); ar2.position.y = 0.07; retRing.add(ar2); }
const RET_IT = { x: 0, z: 0, r: 2.4, title: '귀환의 룬진 · 광장으로', action: () => askReturn() };
const KEEP_IT = { x: 0, z: 0, r: 2.6, title: '룬 지기 엘드라', action: async () => { if (battle && !battle.ended) return; await say([['k', '숲의 친구들이 또 장난을 칠지도 모르겠구나. 월드맵에서 가고 싶은 곳을 골라 보거라.']]); openMap('road'); } };
function placeStage(n){
  buildStage(n - 1);
  const [ex, ez] = stageL.entry, [bx, bz] = stageL.boss, a = Math.atan2(bx - ex, bz - ez);
  retRing.position.set(ex, 0, ez); RET_IT.x = ex; RET_IT.z = ez;
  SINT.length = 0; SINT.push(RET_IT);
  keeper.root.visible = n === 1;
  if (n === 1){ const kx = ex + Math.cos(a) * 3.6 + Math.sin(a) * 2.2, kz = ez - Math.sin(a) * 3.6 + Math.cos(a) * 2.2; const kp = clampShapes(new V3(kx, 0.04, kz), 1); keeper.root.position.set(kp.x, 0.04, kp.z); keeperCol.x = kp.x; keeperCol.z = kp.z; SCOL.push(keeperCol); KEEP_IT.x = kp.x; KEEP_IT.z = kp.z; SINT.push(KEEP_IT); }
  return a;
}
async function startStage(n, d){
  if (tpBusy) return;
  closeMap(); resEl.classList.remove('on');
  const st = STAGES[n - 1];
  await teleport(`1-${n} ${st.name}`, `${DIFF[d].n} · ${MAPS[n - 1].name}`, () => {
    enterForest(); cleanupBattle();
    const a = placeStage(n);
    player.pos.set(stageL.entry[0], 0.04, stageL.entry[1]); player.vy = 0;
    player.fig.root.rotation.y = a; G.setCam(a + Math.PI, 0.32, 8);
    const dd = D(); hp = dd.maxHp; mp = dd.maxMp; refreshHud();
    const sm = 1 + (n - 1) * 0.11;
    battle = { n, d, st, wi: -1, t: 0, q: [], kills: 0, ended: false, boss: null, waitNext: false,
      mul: { hp: sm * DIFF[d].hp, bhp: DIFF[d].bhp, dmg: (1 + (n - 1) * 0.07) * DIFF[d].dmg, exp: (1 + (n - 1) * 0.08) * DIFF[d].rew } };
    setObj(`1-${n} ${st.name}`, `${DIFF[d].n} · 준비`, null);
    bReturn.textContent = '⟲ 포기';
  });
  if (st.tut && !S.sword) await tutorialIntro();
  if (!S.sword){ S.sword = true; save(); }
  giveSword();
  banner(`STAGE 1-${n} · ${DIFF[d].n}`, st.name, `권장 전투력 ${fmt(recPower(n, d))} · 내 전투력 ${fmt(power())}`, false, 2.4);
  later(2.0, nextWave);
}
async function tutorialIntro(){
  await chapterCard('CHAPTER 1', '평화로운 숲', '제 1 장');
  await say([
    ['k', '어서 오너라, 룬진을 타고 온 이름 없는 자여. 나는 이 숲을 돌보는 룬 지기, 엘드라다.'],
    ['k', '평화로운 숲이지만, 요즘 숲의 친구들이 잔뜩 들떠서 장난이 심해졌구나.'],
    ['k', '살살 혼내주면 금세 얌전해질 게다. 자, 받거라 — 광장의 대장장이 브론이 벼려 둔 「견습 룬검」이다.'],
  ]);
  S.sword = true; save(); giveSword(); sfx('shard');
  banner('NEW WEAPON', '견습 룬검 획득', '검에 새겨진 룬이 희미하게 빛난다', false, 2.4);
  await wait(2.2);
  await say([['k', '슬라임들이 온다! 연타하면 3연격, 세 번째는 회전베기다. 큰 녀석이 나오면 붉은 범위를 굴러서 피하거라!']]);
  hint(G.IS_TOUCH ? '<b>⚔ 공격</b> 연타로 3연격 · <b>구르기</b>로 회피' : '<b>J</b> / <b>클릭</b> 연타로 3연격 · <b>K</b> / <b>우클릭</b> 구르기', 9);
}
function nextWave(){
  if (!battle || battle.ended) return;
  battle.wi++;
  const st = battle.st;
  if (battle.wi < st.waves.length){
    if (st.waves.length > 1) banner(`WAVE ${battle.wi + 1} / ${st.waves.length}`, battle.wi === st.waves.length - 1 && !st.boss ? '마지막 웨이브' : '몬스터 출현', '', false, 1.8);
    let k = 0, el = 0; const ch = battle.n < 2 ? 0 : 0.05 + battle.n * 0.012 + (battle.d === 'm' ? 0.06 : battle.d === 'h' ? 0.12 : 0), maxEl = battle.d === 'h' ? 3 : 2;
    for (const [type, c] of st.waves[battle.wi]){ const cnt = battle.n === 1 ? c : Math.round(c * 1.35); for (let i = 0; i < cnt; i++){ const elite = el < maxEl && R() < ch; if (elite) el++; battle.q.push({ type, elite, t: battle.t + 0.4 + (k++) * 0.32 }); } }
    battle.wt = 0;
  } else if (st.boss && !battle.boss) bossIntro();
}
async function bossIntro(){
  const c = BOSS[battle.st.boss];
  const p = clampShapes(new V3(stageL.boss[0], 0, stageL.boss[1]), c.rad + 0.5);
  let dx = p.x - player.pos.x, dz = p.z - player.pos.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  battle.waitNext = true;
  const e = spawnMon(battle.st.boss, p.x, p.z); e.state = 'intro'; battle.boss = e;
  e.g.rotation.y = Math.atan2(player.pos.x - p.x, player.pos.z - p.z);
  G.lock = true; document.body.classList.add('cine'); sfx('roar');
  const hgt = c.top;
  G.camOverride = { pos: new V3(p.x - dx * (5 + hgt * 1.3), hgt * 0.7 + 1, p.z - dz * (5 + hgt * 1.3)), look: new V3(p.x, hgt * 0.55, p.z) };
  banner('BOSS', `${c.title} 「${c.name}」`, '', true, 2.6);
  await wait(2.4);
  document.body.classList.remove('cine'); G.lock = false;
  await say([['b', c.line]]);
  G.camOverride = null;
  e.state = 'chase'; e.atkCd = 1.2; battle.waitNext = false;
  bossEl.querySelector('.n').textContent = `${c.title} · ${c.name}`; bossEl.classList.add('on');
  if (battle.n === 1) hint(G.IS_TOUCH ? '붉은 범위가 보이면 <b>구르기</b>!' : '붉은 범위가 보이면 <b>K</b> / <b>우클릭</b> 으로 구르기!', 6);
}
const REINF = 22;
function updateBattle(dt, alive){
  if (!battle || battle.ended) return;
  battle.t += dt;
  for (const q of battle.q){ if (!q.done && battle.t >= q.t){ q.done = true; const p = spawnPoint(); spawnMon(q.type, p.x, p.z, q.elite); } }
  const pend = battle.q.filter(q => !q.done).length, left = pend + alive.length;
  const st = battle.st;
  const canReinf = !battle.boss && battle.wi >= 0 && battle.wi < st.waves.length - 1 && !battle.waitNext;
  if (canReinf){ battle.wt = (battle.wt || 0) + dt; if (battle.wt > REINF && left > 0){ banner('WARNING', '증원 도착!', '다음 웨이브가 몰려온다', true, 1.6); sfx('elite'); G.shake = Math.max(G.shake, 0.5); nextWave(); } }
  objEl.querySelector('.p').textContent = battle.boss ? `보스전 · ${DIFF[battle.d].n}${battle.boss.enraged ? ' · 광폭화' : ''}` : `${DIFF[battle.d].n} · 웨이브 ${Math.max(1, battle.wi + 1)} / ${st.waves.length} · 남은 몬스터 ${left}${canReinf && battle.wt > REINF - 8 ? ` · ⚠ 증원 ${Math.ceil(REINF - battle.wt)}초` : ''}`;
  if (left === 0 && battle.wi >= 0 && !battle.waitNext && !battle.boss){ battle.waitNext = true; later(1.2, () => { if (battle){ battle.waitNext = false; battle.q = []; if (battle.wi + 1 >= st.waves.length && !st.boss) win(); else nextWave(); } }); }
}
function win(){
  if (!battle || battle.ended) return;
  battle.ended = true;
  const { n, d, st } = battle, dd = D(), hpPct = hp / dd.maxHp, fast = battle.t <= parTime(st);
  const star = 1 + (hpPct >= 0.5 ? 1 : 0) + (fast ? 1 : 0);
  S.clr = S.clr || {}; S.clr[n] = S.clr[n] || {};
  const first = !S.clr[n][d], prev = S.clr[n][d] || 0;
  S.clr[n][d] = Math.max(prev, star);
  const rw = rewardOf(n, d), gold = rw.gold * (first ? 2 : 1);
  S.gold = (S.gold || 0) + gold;
  let extra = '';
  if (first && st.boss){ S.pts += 2; extra += ' · <em>스탯 포인트 +2</em>'; }
  if (first && n === 5 && d === 'e' && !S.rune){ S.rune = true; extra += ' · <em>룬 마법 습득!</em>'; }
  save(); gainExp(rw.exp);
  if (first && n === JOB_STAGE && !S.job) later(4.2, () => G.toast('⚜ 직업 해금!', '광장의 ⚜ 직업 버튼(V)에서 전직하고 스킬을 얻자'));
  if (ascReady()) later(4.6, () => G.toast('✦ 각성 가능!', `⚜ 직업 창(V)에서 ${JOBS[S.job].asc.n}(으)로 각성할 수 있다`));
  sfx('level'); burst(new V3(player.pos.x, 0.5, player.pos.z), 0xffe08a, 60, 4, 0.3, 1.4, 3, 4);
  bossEl.classList.remove('on'); bReturn.textContent = '⟲ 광장으로';
  setObj(`1-${n} ${st.name}`, '스테이지 클리어!', null);
  const chapterClear = first && n === 20 && d === 'e';
  later(1.6, () => showResult(true, { star, hpPct, fast, rw, gold, first, extra, chapterClear }));
}
function lose(){
  if (!battle || battle.ended) return;
  battle.ended = true; bossEl.classList.remove('on');
  later(1.6, () => showResult(false, {}));
}
const resEl = mk('div', 'res', '');
function showResult(ok, r){
  const { n, d, st } = battle;
  resEl.classList.toggle('fail', !ok);
  if (ok){
    resEl.innerHTML = `<div class="a">STAGE CLEAR</div><div class="b">1-${n} ${st.name} · ${DIFF[d].n}</div>
      <div class="st">${[0, 1, 2].map(i => `<span class="${i < r.star ? 'on' : ''}" style="animation-delay:${0.25 + i * 0.25}s">★</span>`).join('')}</div>
      <div class="cr">클리어 <i>✔</i> &nbsp; · &nbsp; HP 50% 이상 ${r.hpPct >= 0.5 ? '<i>✔</i>' : '<s>✘</s>'} &nbsp; · &nbsp; ${parTime(st)}초 안에 클리어 ${r.fast ? '<i>✔</i>' : '<s>✘</s>'} (${Math.round(battle.t)}초)</div>
      <div class="rw">보상 &nbsp; <em>EXP +${r.rw.exp}</em> · <em>🪙 ${r.gold}</em>${r.first ? ' (첫 클리어 2배)' : ''}${r.extra}</div>
      ${r.chapterClear ? '<div class="rw" style="margin-top:12px;font-size:17px">🎉 <em>제 1 장 「평화로운 숲」 클리어!</em><br><span style="opacity:.75;font-size:13px">제 2 장 「안개 늪」 — 준비 중 · 미디엄/하드로 별을 모아보세요</span></div>' : ''}
      <div class="bt">${n < 20 ? '<button class="pri" data-a="next">다음 스테이지 ▶</button>' : ''}<button data-a="retry">다시 하기</button><button data-a="map">🗺 월드맵</button><button data-a="home">광장으로</button></div>`;
    [0, 1, 2].forEach(i => { if (i < r.star) setTimeout(() => sfx('pick'), 300 + i * 250); });
  } else {
    resEl.innerHTML = `<div class="a">STAGE FAILED</div><div class="b">1-${n} ${st.name} · ${DIFF[d].n}</div>
      <div class="cr" style="margin-top:14px">권장 전투력 <b>${fmt(recPower(n, d))}</b> · 내 전투력 <b>${fmt(power())}</b><br>스탯을 찍거나, 낮은 난이도에서 경험치를 모아 다시 도전해 보세요.</div>
      <div class="bt"><button class="pri" data-a="retry">다시 도전</button><button data-a="stat">⚔ 스탯</button><button data-a="map">🗺 월드맵</button><button data-a="home">광장으로</button></div>`;
  }
  resEl.classList.add('on');
  resEl.querySelectorAll('button').forEach(b => b.onclick = () => {
    const a = b.dataset.a; sfx('ui');
    if (a === 'stat'){ toggleStats(true); return; }
    resEl.classList.remove('on'); revive();
    if (a === 'next') startStage(n + 1, unlocked(n + 1, d) ? d : 'e');
    else if (a === 'retry') startStage(n, d);
    else if (a === 'map') openMap('road');
    else leaveForest();
  });
}
function revive(){ if (dead){ dead = false; G.lock = false; const d = D(); hp = d.maxHp; mp = d.maxMp; inv = 1; fig.set(G.pose({})); refreshHud(); } }
function cleanupBattle(){
  for (const e of ENEMIES){ SW.remove(e.g); e.bar.remove(); rmTele(e); if (e.atk) rmTele(e.atk); }
  ENEMIES.length = 0;
  for (const o of PROJ){ SW.remove(o.mesh); rmTele(o); } PROJ.length = 0;
  for (const r of ROOTS){ rmTele(r); if (r.sp) SW.remove(r.sp); } ROOTS.length = 0;
  for (const o of XPO){ SW.remove(o.s); gainExp(o.val); } XPO.length = 0;
  TIMERS.length = 0; G.camOverride = null; atk = roll = cast = null; knock.set(0, 0, 0); clearSkillFx(); comboT = 0; comboEl.classList.remove('on');
  battle = null; bossEl.classList.remove('on'); G.mapEnemies = []; hint('', 0);
}

// ───────────────────────── 월드맵 / 스테이지 로드맵 UI ─────────────────────────
const wmap = mk('div', 'wmap', `<div class="wtop"><button class="bk">← 월드맵</button><div class="tt">월드맵</div>
  <div class="tabs"><button class="e" data-d="e">이지</button><button class="m" data-d="m">미디엄</button><button class="h" data-d="h">하드</button></div>
  <div class="res"><span class="pw"></span><span class="gd"></span></div><button class="x">✕</button></div><div class="wv"></div>`);
const spop = mk('div', 'spop', '');
const wv = wmap.querySelector('.wv');
let mapDiff = 'e', mapView = 'world';
wmap.querySelector('.x').onclick = () => { sfx('ui'); closeMap(); };
wmap.querySelector('.bk').onclick = () => { sfx('ui'); mapView = 'world'; renderMap(); };
wmap.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { mapDiff = b.dataset.d; sfx('ui'); renderMap(); });
function openMap(view = 'world'){ if (battle && !battle.ended) return; mapView = view; wmap.classList.add('on'); renderMap(); sfx('ui'); hint('', 0); }
function closeMap(){ wmap.classList.remove('on'); spop.classList.remove('on'); }
function renderMap(){
  wmap.querySelector('.tt').textContent = mapView === 'world' ? '월드맵' : '제 1 장 · 평화로운 숲';
  wmap.querySelector('.bk').style.display = mapView === 'world' ? 'none' : '';
  wmap.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.d === mapDiff));
  wmap.classList.toggle('dm', mapDiff === 'm'); wmap.classList.toggle('dh', mapDiff === 'h');
  wmap.querySelector('.pw').textContent = '⚔ 전투력 ' + fmt(power()); wmap.querySelector('.gd').textContent = '🪙 ' + fmt(S.gold || 0);
  if (mapView === 'world') renderWorld(); else renderRoad();
}
const rng = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
function blobPath(x, cx, cy, R0, seed){
  x.beginPath();
  for (let i = 0; i <= 72; i++){ const a = i / 72 * TAU, r = R0 * (1 + 0.16 * Math.sin(a * 3 + seed) + 0.09 * Math.sin(a * 5 + seed * 2) + 0.05 * Math.sin(a * 11 + seed * 3)); const px = cx + Math.cos(a) * r * 1.25, py = cy + Math.sin(a) * r * 0.85; i ? x.lineTo(px, py) : x.moveTo(px, py); }
  x.closePath();
}
const ISL = [
  { x: 0.25, y: 0.56, r: 0.19, c1: '#8ad060', c2: '#3f8a2e', seed: 1, n: 1, name: '평화로운 숲' },
  { x: 0.52, y: 0.30, r: 0.13, c1: '#7aa89a', c2: '#3f6a5e', seed: 2.3, n: 2, name: '안개 늪', lock: true },
  { x: 0.72, y: 0.66, r: 0.14, c1: '#f0b878', c2: '#b06a2e', seed: 4.1, n: 3, name: '황금 협곡', lock: true },
  { x: 0.88, y: 0.30, r: 0.11, c1: '#eef2fa', c2: '#8aa0c8', seed: 5.7, n: 4, name: '구름 성채', lock: true },
];
function renderWorld(){
  wv.innerHTML = '<div class="chv"><canvas></canvas></div>';
  const box = wv.firstChild, cv = box.firstChild, dpr = Math.min(2, devicePixelRatio || 1), W = box.clientWidth * dpr, H = box.clientHeight * dpr;
  cv.width = W; cv.height = H; const x = cv.getContext('2d'), base = Math.min(W, H * 1.5), rd = rng(7);
  const g = x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, '#f2dfb2'); g.addColorStop(1, '#a8804a'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(70,130,160,.2)'; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(90,64,30,.18)'; x.lineWidth = 2 * dpr; for (let i = 0; i < 90; i++){ const px = rd() * W, py = rd() * H, s = (8 + rd() * 10) * dpr; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + s / 2, py - s / 3, px + s, py); x.quadraticCurveTo(px + s * 1.5, py + s / 3, px + s * 2, py); x.stroke(); }
  x.setLineDash([10 * dpr, 10 * dpr]); x.strokeStyle = 'rgba(110,70,30,.5)'; x.lineWidth = 3 * dpr; x.beginPath();
  ISL.forEach((s, i) => { const px = s.x * W, py = s.y * H; i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); x.setLineDash([]);
  for (const s of ISL){
    const cx = s.x * W, cy = s.y * H, R0 = s.r * base;
    x.save(); x.translate(8 * dpr, 12 * dpr); blobPath(x, cx, cy, R0, s.seed); x.fillStyle = 'rgba(40,24,8,.35)'; x.fill(); x.restore();
    blobPath(x, cx, cy, R0 * 1.06, s.seed); x.fillStyle = '#ead8a0'; x.fill();
    blobPath(x, cx, cy, R0, s.seed); const ig = x.createRadialGradient(cx - R0 * 0.3, cy - R0 * 0.3, 0, cx, cy, R0 * 1.3); ig.addColorStop(0, s.c1); ig.addColorStop(1, s.c2); x.fillStyle = ig; x.fill();
    x.save(); blobPath(x, cx, cy, R0 * 0.96, s.seed); x.clip();
    const rr2 = rng(s.n * 31);
    if (s.n === 1){
      x.strokeStyle = '#6ab4e0'; x.lineWidth = 6 * dpr; x.beginPath(); x.moveTo(cx - R0 * 1.3, cy - R0 * 0.2); x.bezierCurveTo(cx - R0 * 0.3, cy - R0 * 0.6, cx + R0 * 0.1, cy + R0 * 0.5, cx + R0 * 1.2, cy + R0 * 0.2); x.stroke();
      for (let i = 0; i < 70; i++){ const a = rr2() * TAU, r = Math.sqrt(rr2()) * R0 * 1.1, tx = cx + Math.cos(a) * r * 1.2, ty = cy + Math.sin(a) * r * 0.8, ts = (6 + rr2() * 8) * dpr * (base / 900); x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(tx + ts * 0.3, ty + ts * 0.5, ts, ts * 0.6, 0, 0, TAU); x.fill(); x.fillStyle = rr2() < 0.5 ? '#2f6e2a' : '#3d8a32'; x.beginPath(); x.arc(tx, ty, ts, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.arc(tx - ts * 0.3, ty - ts * 0.3, ts * 0.45, 0, TAU); x.fill(); }
      const tt = (px, py, c) => { const s2 = 10 * dpr * (base / 900); x.fillStyle = c; x.beginPath(); x.moveTo(px, py - s2 * 1.4); x.lineTo(px + s2, py + s2 * 0.4); x.lineTo(px - s2, py + s2 * 0.4); x.closePath(); x.fill(); };
      tt(cx - R0 * 0.55, cy + R0 * 0.35, '#e8d2a0'); tt(cx - R0 * 0.42, cy + R0 * 0.42, '#b0503a');
      x.fillStyle = '#3a6a2a'; x.beginPath(); x.arc(cx + R0 * 0.55, cy - R0 * 0.35, R0 * 0.18, 0, TAU); x.fill(); x.fillStyle = '#6a4a2a'; x.fillRect(cx + R0 * 0.53, cy - R0 * 0.3, R0 * 0.05, R0 * 0.2);
    } else {
      for (let i = 0; i < 30; i++){ const a = rr2() * TAU, r = Math.sqrt(rr2()) * R0, tx = cx + Math.cos(a) * r * 1.2, ty = cy + Math.sin(a) * r * 0.8; x.fillStyle = 'rgba(0,0,0,.12)'; x.beginPath(); x.arc(tx, ty, (4 + rr2() * 7) * dpr, 0, TAU); x.fill(); }
      x.fillStyle = 'rgba(120,120,120,.45)'; x.fillRect(cx - R0 * 1.5, cy - R0, R0 * 3, R0 * 2);
    }
    x.restore();
    if (s.lock){ for (let i = 0; i < 6; i++){ x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.ellipse(cx + (rr2() - 0.5) * R0 * 1.8, cy + (rr2() - 0.5) * R0, R0 * (0.35 + rr2() * 0.3), R0 * 0.18, 0, 0, TAU); x.fill(); } }
  }
  // 나침반 + 테두리
  const cx = W * 0.07, cy = H * 0.86, cr = Math.min(W, H) * 0.07; x.strokeStyle = 'rgba(80,50,20,.7)'; x.lineWidth = 2 * dpr; x.beginPath(); x.arc(cx, cy, cr, 0, TAU); x.stroke();
  x.fillStyle = 'rgba(80,50,20,.7)'; for (let i = 0; i < 4; i++){ const a = i * Math.PI / 2; x.beginPath(); x.moveTo(cx + Math.cos(a) * cr * 1.2, cy + Math.sin(a) * cr * 1.2); x.lineTo(cx + Math.cos(a + 0.5) * cr * 0.25, cy + Math.sin(a + 0.5) * cr * 0.25); x.lineTo(cx + Math.cos(a - 0.5) * cr * 0.25, cy + Math.sin(a - 0.5) * cr * 0.25); x.fill(); }
  x.strokeStyle = '#5a3a14'; x.lineWidth = 10 * dpr; x.strokeRect(5 * dpr, 5 * dpr, W - 10 * dpr, H - 10 * dpr); x.strokeStyle = '#c9a056'; x.lineWidth = 2 * dpr; x.strokeRect(14 * dpr, 14 * dpr, W - 28 * dpr, H - 28 * dpr);
  for (const s of ISL){
    const el = document.createElement('div'); el.className = 'isl' + (s.lock ? ' lock' : ''); el.style.left = (s.x * 100) + '%'; el.style.top = (s.y * 100 + s.r * 100 * 0.62 + 6) + '%';
    el.innerHTML = s.lock ? `<div class="rb">${s.n}. ${s.name} 🔒</div><div class="pc"><span>준비 중</span></div>`
      : `<div class="rb">${s.n}. ${s.name}</div><div class="pc"><span>이지</span><span>⭐</span><span>${chapterPct('e')}%</span><span>미디엄</span><span>💜</span><span>${chapterPct('m')}%</span><span>하드</span><span>❤️‍🔥</span><span>${chapterPct('h')}%</span></div>`;
    el.onclick = () => { if (s.lock){ G.toast(`${s.n}장 · ${s.name}`, '곧 열립니다'); return; } sfx('ui'); mapView = 'road'; renderMap(); };
    box.appendChild(el);
  }
}
const NODE = [[80, 480], [190, 505], [300, 470], [410, 500], [530, 462], [650, 495], [770, 470], [880, 420], [860, 318], [740, 298], [620, 330], [500, 300], [380, 330], [260, 300], [140, 250], [170, 150], [300, 120], [440, 150], [590, 120], [770, 108]];
function renderRoad(){
  wv.innerHTML = '<div class="rm"><canvas></canvas></div><div class="cp"></div>';
  const box = wv.firstChild, cv = box.firstChild, dpr = Math.min(2, devicePixelRatio || 1), W = box.clientWidth * dpr, H = box.clientHeight * dpr;
  cv.width = W; cv.height = H; const x = cv.getContext('2d'), sx = W / 1000, sy = H / 560, rd = rng(11);
  const P = NODE.map(([a, b]) => [a * sx, b * sy]);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5aa848'); g.addColorStop(1, '#7cc05a'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++){ x.fillStyle = rd() < 0.5 ? 'rgba(255,255,200,.07)' : 'rgba(0,60,0,.08)'; x.beginPath(); x.ellipse(rd() * W, rd() * H, (20 + rd() * 60) * sx, (10 + rd() * 30) * sy, rd() * 3, 0, TAU); x.fill(); }
  // 개울
  x.lineCap = 'round'; x.strokeStyle = '#3f8ac0'; x.lineWidth = 34 * sx; x.beginPath(); x.moveTo(-20 * sx, 215 * sy); x.bezierCurveTo(250 * sx, 170 * sy, 550 * sx, 260 * sy, 1020 * sx, 205 * sy); x.stroke();
  x.strokeStyle = '#6ac0e8'; x.lineWidth = 22 * sx; x.stroke(); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 3 * sx; x.setLineDash([14 * sx, 22 * sx]); x.stroke(); x.setLineDash([]);
  // 길
  const pathTrace = () => { x.beginPath(); x.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++){ const mx = (P[i - 1][0] + P[i][0]) / 2, my = (P[i - 1][1] + P[i][1]) / 2; x.quadraticCurveTo(P[i - 1][0], P[i - 1][1], mx, my); } x.lineTo(P[P.length - 1][0], P[P.length - 1][1]); };
  pathTrace(); x.strokeStyle = '#7a5a30'; x.lineWidth = 30 * sx; x.lineJoin = 'round'; x.stroke(); pathTrace(); x.strokeStyle = '#d8b878'; x.lineWidth = 22 * sx; x.stroke();
  pathTrace(); x.strokeStyle = 'rgba(255,240,200,.6)'; x.lineWidth = 3 * sx; x.setLineDash([8 * sx, 14 * sx]); x.stroke(); x.setLineDash([]);
  // 다리
  x.fillStyle = '#8a5a2a'; x.save(); x.translate(152 * sx, 196 * sy); x.rotate(-0.3); x.fillRect(-26 * sx, -20 * sy, 52 * sx, 40 * sy); x.fillStyle = '#b07a3a'; for (let i = 0; i < 6; i++) x.fillRect(-24 * sx + i * 9 * sx, -20 * sy, 6 * sx, 40 * sy); x.restore();
  // 나무 (길에서 떨어진 곳)
  const distPath = (px, py) => { let m = 1e9; for (let i = 1; i < P.length; i++){ const [ax, ay] = P[i - 1], [bx, by] = P[i], ex = bx - ax, ey = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey))); m = Math.min(m, Math.hypot(px - ax - ex * t, py - ay - ey * t)); } return m; };
  const trees = [];
  for (let i = 0; i < 520; i++){ const px = rd() * W, py = rd() * H; if (distPath(px, py) < 46 * sx) continue; if (Math.abs(py - (205 + Math.sin(px / W * 3) * 25) * sy) < 30 * sy) continue; trees.push([px, py, (10 + rd() * 12) * sx]); }
  trees.sort((a, b) => a[1] - b[1]);
  for (const [px, py, s] of trees){ x.fillStyle = 'rgba(0,30,0,.3)'; x.beginPath(); x.ellipse(px + s * 0.3, py + s * 0.6, s, s * 0.5, 0, 0, TAU); x.fill(); x.fillStyle = rd() < 0.5 ? '#2c6a28' : '#3a8030'; x.beginPath(); x.arc(px, py, s, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,220,.16)'; x.beginPath(); x.arc(px - s * 0.3, py - s * 0.35, s * 0.45, 0, TAU); x.fill(); }
  // 꽃밭 (여왕벌), 바위 (엄니왕), 야영지, 천년 고목
  for (let i = 0; i < 90; i++){ const a = rd() * TAU, r = rd() * 55; x.fillStyle = ['#ff8ab0', '#ffe070', '#fff', '#c88aff'][i % 4]; x.beginPath(); x.arc((740 + Math.cos(a) * r * 1.4) * sx, (298 + Math.sin(a) * r) * sy, 3 * sx, 0, TAU); x.fill(); }
  for (let i = 0; i < 8; i++){ x.fillStyle = '#8a8a80'; x.beginPath(); x.ellipse((110 + rd() * 70) * sx, (230 + rd() * 50) * sy, (8 + rd() * 8) * sx, (6 + rd() * 5) * sy, 0, 0, TAU); x.fill(); }
  const tent = (px, py, c) => { x.fillStyle = c; x.beginPath(); x.moveTo(px * sx, (py - 22) * sy); x.lineTo((px + 18) * sx, (py + 8) * sy); x.lineTo((px - 18) * sx, (py + 8) * sy); x.closePath(); x.fill(); };
  tent(45, 520, '#e8d2a0'); tent(120, 535, '#b0503a');
  x.fillStyle = '#5a3a1e'; x.fillRect(868 * sx, 60 * sy, 26 * sx, 70 * sy);
  for (const [ox, oy, r] of [[0, 0, 52], [-40, 18, 36], [40, 20, 38], [0, -30, 40]]){ x.fillStyle = '#2a6a26'; x.beginPath(); x.arc((880 + ox) * sx, (52 + oy) * sy, r * sx, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,220,.14)'; x.beginPath(); x.arc((870 + ox) * sx, (42 + oy) * sy, r * 0.5 * sx, 0, TAU); x.fill(); }
  const vg = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,30,0,.45)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
  // 노드
  let next = 0;
  for (let n = 1; n <= 20; n++){ if (unlocked(n, mapDiff)) next = n; if (unlocked(n, mapDiff) && !stars(n, mapDiff)) break; }
  STAGES.forEach((st, i) => {
    const n = i + 1, el = document.createElement('div'), lk = !unlocked(n, mapDiff), s = stars(n, mapDiff);
    el.className = 'nd' + (st.boss ? ' boss' : '') + (lk ? ' lock' : '') + (n === next && !s ? ' next' : '');
    el.style.left = (NODE[i][0] / 10) + '%'; el.style.top = (NODE[i][1] / 5.6) + '%';
    el.innerHTML = `<div class="c">${st.boss ? BOSS[st.boss].icon : (lk ? '🔒' : n)}</div><div class="s">${[0, 1, 2].map(k => k < s ? '<b>★</b>' : '☆').join('')}</div><div class="l">1-${n}${st.boss ? ' ' + BOSS[st.boss].title : ''}</div>`;
    el.onclick = () => { if (lk){ G.toast(`1-${n} ${st.name}`, mapDiff === 'e' ? '이전 스테이지를 먼저 클리어하세요' : '이지 모드를 먼저 클리어하세요'); return; } sfx('ui'); openStage(n); };
    box.appendChild(el);
  });
  const pin = document.createElement('div'); pin.className = 'pin'; pin.innerHTML = '<div><i>🧍</i></div>';
  pin.style.left = (NODE[next - 1][0] / 10) + '%'; pin.style.top = `calc(${NODE[next - 1][1] / 5.6}% - ${STAGES[next - 1].boss ? 40 : 30}px)`; box.appendChild(pin);
  const cp = wv.querySelector('.cp'), pct = chapterPct(mapDiff);
  cp.innerHTML = `제 1 장 · ${DIFF[mapDiff].n} 진행도 <b>${pct}%</b><div class="bar"><i style="width:${pct}%"></i></div>`;
  requestAnimationFrame(() => { wv.scrollLeft = Math.max(0, NODE[next - 1][0] / 1000 * box.clientWidth - wv.clientWidth / 2); wv.scrollTop = Math.max(0, NODE[next - 1][1] / 560 * box.clientHeight - wv.clientHeight / 2); });
}
function openStage(n, d){
  const st = STAGES[n - 1];
  d = d || (unlocked(n, mapDiff) ? mapDiff : 'e');
  const mons = []; for (const w of st.waves) for (const [k] of w) if (!mons.includes(k)) mons.push(k);
  const rp = recPower(n, d), mp2 = power(), rw = rewardOf(n, d), first = !stars(n, d);
  spop.innerHTML = `<div class="hd"><span class="no">1-${n}</span><span class="nm">${st.name}</span>${st.boss ? '<span class="bt">BOSS</span>' : ''}<button class="x">✕</button></div>
    <div class="ds">${st.desc}<br><small style="opacity:.75">🌄 지형: ${MAPS[n - 1].name}</small></div>
    <div class="df">${['e', 'm', 'h'].map(k => `<button class="${k}${k === d ? ' on' : ''}" data-d="${k}" ${unlocked(n, k) ? '' : 'disabled'}>${DIFF[k].n}<small>${unlocked(n, k) ? [0, 1, 2].map(i => i < stars(n, k) ? '★' : '☆').join('') : '🔒 이지 클리어 필요'}</small></button>`).join('')}</div>
    <div class="pw"><div>권장 전투력<br><b>${fmt(rp)}</b></div><div class="me" style="text-align:right">내 전투력<br><b class="${mp2 >= rp ? 'ok' : 'low'}">${fmt(mp2)}</b></div></div>
    <div class="sec">출현 몬스터</div><div class="mons">${mons.map(k => `<span>${MON[k].icon} ${MON[k].name}</span>`).join('')}${st.boss ? `<span class="bs">${BOSS[st.boss].icon} ${BOSS[st.boss].title} 「${BOSS[st.boss].name}」</span>` : ''}</div>
    <div class="sec">보상</div><div class="rw">EXP <em>${rw.exp}</em> · 골드 <em>🪙 ${rw.gold}</em>${first ? ' · 첫 클리어 골드 <em>2배</em>' : ''}${first && st.boss ? ' · <em>스탯 포인트 +2</em>' : ''}${n === 5 && !S.rune ? ' · <em>룬 마법 습득</em>' : ''}<br>별 조건: 클리어 · HP 50% 이상 · ${parTime(st)}초 안에 클리어</div>
    <button class="go">⚔ 전투 시작</button>`;
  spop.querySelector('.x').onclick = () => { sfx('ui'); spop.classList.remove('on'); };
  spop.querySelectorAll('.df button').forEach(b => b.onclick = () => { sfx('ui'); openStage(n, b.dataset.d); });
  spop.querySelector('.go').onclick = () => { sfx('ui'); startStage(n, d); };
  spop.classList.add('on');
}

// ───────────────────────── 광장 ↔ 숲 (텔레포트) ─────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
let tpBusy = false, inStory = false;
async function teleport(name, sub, fn){
  if (tpBusy) return; tpBusy = true;
  tpEl.querySelector('.n').textContent = name; tpEl.querySelector('.a').textContent = sub;
  sfx('rune'); G.lock = true; tpEl.classList.add('on');
  await sleep(900);
  fn();
  await sleep(700);
  tpEl.classList.remove('on'); G.lock = false; tpBusy = false;
}
function setMode(m){
  MODE = m; if (fieldFW) fieldFW.visible = m === 'field';
  G.sunFollow = m === 'field'; BUS.emit('mode', m);
}
let fieldFW = null;
function enterCombat(area){
  if (G.area !== area) G.setArea(area);
  SW.visible = true; inStory = true;
  if (S.sword) giveSword(); if (sword) sword.visible = true; if (offhand) offhand.visible = true;
  document.body.classList.toggle('combat', !!S.sword);
}
function enterForest(){
  setMode('stage'); keeper.root.visible = true; retRing.visible = true;
  if (G.area !== 'story'){ G.setArea('story'); }
  inStory = true;
  if (S.sword) giveSword(); if (sword) sword.visible = true; if (offhand) offhand.visible = true;
  document.body.classList.toggle('combat', !!S.sword);
}
function leaveForest(){
  teleport('룬의 광장', 'THE RUNE AGORA', () => {
    revive(); cleanupBattle(); closeMap(); resEl.classList.remove('on'); fdeadEl.classList.remove('on');
    if (MODE === 'field' || MODE === 'raid') BUS.emit('leave', MODE);
    setMode('plaza'); disposeStage(); GYF = null; CLAMP = null;
    G.setArea('plaza'); inStory = false;
    player.pos.set(0, 0.04, 9); player.vy = 0; player.fig.root.rotation.y = 0; G.setCam(Math.PI, 0.3);
    G.setMood(null); G.setNight(0);
    if (sword) sword.visible = false; if (offhand) offhand.visible = false; document.body.classList.remove('combat'); lowEl.classList.remove('on');
    $('keys').innerHTML = '<b>W</b><b>A</b><b>S</b><b>D</b> 이동 &nbsp; <b>Shift</b> 달리기 &nbsp; <b>Space</b> 점프 &nbsp; <b>M</b> 월드맵 &nbsp; <b>C</b> 스탯 &nbsp; <b>E</b> 상호작용';
    G.mapEnemies = []; G.mapMarkers = []; clearObj(); bReturn.textContent = '⟲ 광장으로';
    const d = D(); hp = d.maxHp; mp = d.maxMp; refreshHud();
  });
}
// 레이드 같은 전용 인스턴스: def = { name, sub, shapes, entry:[x,z], face, mood, build(group, ctx) }
function enterInstance(def){
  enterCombat('story'); setMode('raid'); cleanupBattle(); clearSkillFx();
  disposeStage(); stageAnims = []; SCOL.length = 0; SINT.length = 0; keeper.root.visible = false; retRing.visible = false;
  stageG = new THREE.Group(); SW.add(stageG); SHAPES = def.shapes; stageL = { shapes: def.shapes, entry: def.entry, boss: def.boss || def.entry };
  CLAMP = null; GYF = null;
  B = new G.Builder(); K = new G.Kit(B);
  def.build && def.build(stageG, { SCOL, SINT, anims: stageAnims, K, B, M, MATS2, smat, TX, plant, treeGeo, TREEMAT, forest, P, col });
  B.build(Object.assign({}, M, MATS2), stageG);
  drawStageMap();
  G.setMood(def.mood || MOOD.noon);
  player.pos.set(def.entry[0], 0.04, def.entry[1]); player.vy = 0; const a = def.face ?? 0; player.fig.root.rotation.y = a; G.setCam(a + Math.PI, 0.32, 8);
  const d = D(); hp = d.maxHp; mp = d.maxMp; refreshHud();
}
async function askReturn(){
  if (MODE === 'field' && X.fieldReturn){ X.fieldReturn(); return; }
  if (dialogOpen || tpBusy) return;
  const inB = battle && !battle.ended;
  const r = await say([['sys', inB ? '전투를 포기하고 광장으로 돌아갈까요? (보상 없음)' : '광장으로 돌아갈까요?', ['돌아간다', '머무른다']]]);
  if (r === 0) leaveForest();
}
NAMES.sys = '귀환의 룬진';
$('mStory').innerHTML = '<span>🗺</span>월드맵';
$('mStory').onclick = () => openMap('world');
$('mMini').onclick = () => G.toast('미니 게임', '곧 열립니다');
$('mStat').onclick = () => toggleStats();
$('mJob').onclick = () => toggleJob();
$('mShop').onclick = () => toggleShop();
bReturn.onclick = () => askReturn();
const crystalIt = G.INTERACT.find(i => i.title === '룬 크리스탈');
if (crystalIt){ crystalIt.title = '룬 크리스탈 · 월드맵'; crystalIt.r = 6.2; crystalIt.action = () => openMap('world'); }

// ───────────────────────── 직업 UI / 스킬 바 / 각성 ─────────────────────────
const skbar = mk('div', 'skbar', [0, 1, 2, 3].map(i => `<div class="sk" id="cS${i + 1}" data-i="${i}"><span class="ic"></span><b class="ky">${i + 1}</b><i class="cd"></i><em class="t"></em><small class="mp"></small></div>`).join(''), hud);
skbar.querySelectorAll('.sk').forEach(el => { const i = +el.dataset.i; el.addEventListener('click', e => { e.stopPropagation(); useSkill(i); }); el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); useSkill(i); }, { passive: false }); });
function refreshSkbar(){
  document.body.classList.toggle('hasjob', !!S.job);
  skbar.querySelectorAll('.sk').forEach(el => { const i = +el.dataset.i, id = slotSkill(i), open = slotOpen(i);
    el.classList.toggle('lock', !open); el.classList.toggle('ult', !!(id && SKL[id].ult));
    el.querySelector('.ic').textContent = !id ? '' : open ? SKL[id].icon : '🔒'; el.querySelector('.mp').textContent = id && open ? SKL[id].mp : '';
    el.title = id ? `${SKL[id].n} — ${SKL[id].desc}` : ''; });
}
function tickSkbar(){
  if (!S.job) return;
  skbar.querySelectorAll('.sk').forEach(el => { const i = +el.dataset.i, id = slotSkill(i); if (!id || !slotOpen(i)) return; const cd = SKCD[id] || 0, tot = skCd(id);
    el.querySelector('.cd').style.height = (cd / tot * 100) + '%'; el.querySelector('.t').textContent = cd > 0 ? (cd < 10 ? cd.toFixed(1) : Math.ceil(cd)) : ''; el.classList.toggle('dis', mp < SKL[id].mp && cd <= 0); el.classList.toggle('rdy', cd <= 0 && mp >= SKL[id].mp); });
}

const jobw = mk('div', 'jobw', '');
let jobOpen = false, jobSel = null;
function toggleJob(on = !jobOpen){ jobOpen = on; jobw.classList.toggle('on', on); if (on){ jobSel = S.job; renderJob(); sfx('ui'); } }
function skillRow(id, locked){ const d = SKL[id]; return `<div class="sr${locked ? ' lk' : ''}${d.ult ? ' ul' : ''}"><div class="si">${locked ? '🔒' : d.icon}</div><div><div class="sn">${d.n}${d.ult ? '<em>ULT</em>' : ''}${d.asc ? '<em class="a">각성</em>' : ''}</div><div class="sd">${d.desc}</div></div><div class="sc">⏱ ${d.cd}s<br>💧 ${d.mp}</div></div>`; }
function renderJob(){
  const inB = battle && !battle.ended;
  if (!jobUnlocked()){
    jobw.innerHTML = `<div class="hd"><span>CLASS</span><b>직업</b><button class="x">✕</button></div><div class="lockm">🔒<br><b>1-1 「숲의 입구」</b>를 클리어하면<br>직업을 선택할 수 있다.</div>`;
  } else if (!S.job || jobSel !== S.job){
    const k = jobSel;
    jobw.innerHTML = `<div class="hd"><span>CLASS</span><b>${S.job ? '직업 변경' : '직업 선택'}</b><button class="x">✕</button></div>
      <div class="jgrid">${Object.entries(JOBS).map(([key, j]) => `<button class="jc${key === k ? ' on' : ''}${key === S.job ? ' cur' : ''}" data-k="${key}" style="--c:${j.col}"><div class="ji">${j.icon}</div><div class="jn">${j.n}</div><div class="je">${j.en}</div><div class="jr">${j.role}</div></button>`).join('')}</div>
      ${k ? `<div class="jd" style="--c:${JOBS[k].col}"><div class="jdesc">${JOBS[k].desc}</div>
        <div class="sec">기본 스킬</div>${JOBS[k].skills.slice(0, 2).map(id => skillRow(id)).join('')}
        <div class="sec">각성 → <b>${JOBS[k].asc.n}</b> <small>${JOBS[k].asc.en}</small></div><div class="adesc">${JOBS[k].asc.desc}</div>${JOBS[k].skills.slice(2).map(id => skillRow(id, !(S.asc))).join('')}
        <button class="go" ${inB ? 'disabled' : ''}>${inB ? '전투 중에는 바꿀 수 없다' : S.job ? `${JOBS[k].n}(으)로 직업 변경 · 🪙 300` : `${JOBS[k].n}(으)로 전직하기`}</button>
        ${S.job ? '<button class="back">← 현재 직업으로</button>' : ''}</div>` : '<div class="pickm">직업을 골라 보자. 직업마다 전용 무기와 스킬이 있다.</div>'}`;
  } else {
    const j = JOBS[S.job], a = S.asc, ready = ascReady();
    jobw.innerHTML = `<div class="hd"><span>CLASS</span><b>${a ? j.asc.n : j.n}</b><small style="color:${j.col}">${a ? j.asc.en : j.en}</small><button class="x">✕</button></div>
      <div class="jd" style="--c:${j.col}"><div class="jdesc">${j.desc}</div>
      <div class="sec">스킬 <small>키보드 1 · 2 · 3 · 4</small></div>${j.skills.map((id, i) => skillRow(id, !slotOpen(i))).join('')}
      ${a ? `<div class="ascd">✦ 각성 완료 — <b>${j.asc.n}</b> ✦<br><small>${j.asc.desc}</small></div>`
        : `<div class="asc${ready ? ' rdy' : ''}"><div class="at">각성 · ${j.asc.n} <small>${j.asc.en}</small></div><div class="adesc">${j.asc.desc}</div>
          <div class="req"><span class="${S.lv >= ASC_LV ? 'ok' : ''}">${S.lv >= ASC_LV ? '✔' : '✖'} 레벨 ${ASC_LV} 이상 (현재 ${S.lv})</span><span class="${stars(ASC_STAGE, 'e') ? 'ok' : ''}">${stars(ASC_STAGE, 'e') ? '✔' : '✖'} 1-${ASC_STAGE} 「${STAGES[ASC_STAGE - 1].name}」 클리어</span></div>
          <button class="asb" ${ready && !inB ? '' : 'disabled'}>✦ 각성하기</button></div>`}
      <button class="chg">직업 변경…</button></div>`;
  }
  jobw.querySelector('.x').onclick = () => toggleJob(false);
  jobw.querySelectorAll('.jc').forEach(b => b.onclick = () => { jobSel = b.dataset.k; sfx('ui'); renderJob(); });
  const go = jobw.querySelector('.go'); if (go) go.onclick = () => { if (S.job){ if ((S.gold || 0) < 300){ G.toast('골드 부족', '직업 변경에는 🪙 300 골드가 필요하다'); return; } S.gold -= 300; } chooseJob(jobSel); };
  const bk = jobw.querySelector('.back'); if (bk) bk.onclick = () => { jobSel = S.job; renderJob(); };
  const ch = jobw.querySelector('.chg'); if (ch) ch.onclick = () => { jobSel = null; renderJob(); jobSel = S.job; jobw.querySelectorAll('.jc').forEach(b => b.onclick = () => { jobSel = b.dataset.k; sfx('ui'); renderJob(); }); };
  const ab = jobw.querySelector('.asb'); if (ab) ab.onclick = () => ascend();
}
async function chooseJob(k){
  const first = !S.job; S.job = k; save(); toggleJob(false); for (const id in SKCD) SKCD[id] = 0;
  await ceremony(JOBS[k].c, first ? '전직 완료' : '직업 변경', `${JOBS[k].icon} ${JOBS[k].n}`, JOBS[k].en);
  equipJob(); refreshSkbar(); refreshHud();
  hint(`새 스킬: <b>1</b> ${SKL[JOBS[k].skills[0]].n} · <b>2</b> ${SKL[JOBS[k].skills[1]].n}`, 6);
}
async function ascend(){
  if (!ascReady()) return; S.asc = true; save(); toggleJob(false);
  const j = JOBS[S.job];
  await ceremony(j.asc.c, '각 성', `${j.asc.icon} ${j.asc.n}`, j.asc.en, true);
  equipJob(); refreshSkbar(); refreshHud();
  hint(`각성 스킬: <b>3</b> ${SKL[j.skills[2]].n} · <b>4</b> ${SKL[j.skills[3]].n} (궁극기)`, 7);
}
// 전직 / 각성 연출 (광장 · 숲 어디서든)
let cerPose = null;
async function ceremony(col, title, name, en, big){
  G.lock = true; document.body.classList.add('cine'); sfx('rune');
  const p = player.pos.clone(), grp = new THREE.Group(); grp.position.copy(p); G.scene.add(grp);
  const beamM = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(big ? 1.6 : 1.1, big ? 2.2 : 1.5, 60, 32, 1, true), beamM); beam.position.y = 30; grp.add(beam);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); core.position.y = 30; grp.add(core);
  const rings = [0, 1, 2].map(i => { const r = new THREE.Mesh(polarRing(1.2 + i * 0.9, 1.6 + i * 0.9, 64), ADDM(G.tex(G.runeStrip(1024, 128, 12, '#' + new THREE.Color(col).getHexString(), 0, 9 + i), true, 1, 1), 0)); r.position.y = 0.06 + i * 0.6; grp.add(r); return r; });
  const yaw = G.camYaw; fig.root.rotation.y = yaw; G.faceLock = true; G.camOverride = { pos: new V3(p.x + Math.sin(yaw) * 4.6, p.y + 1.7, p.z + Math.cos(yaw) * 4.6), look: new V3(p.x, p.y + (big ? 2.6 : 2.2), p.z) };
  const t0 = performance.now(), T = big ? 3.4 : 2.6;
  await new Promise(res => { const step = () => { const t = (performance.now() - t0) / 1000, k = Math.min(1, t / T);
      beamM.opacity = Math.sin(Math.min(1, k * 1.3) * Math.PI) * 0.55; core.material.opacity = beamM.opacity * 1.2; beam.rotation.y += 0.05;
      rings.forEach((r, i) => { r.material.opacity = Math.sin(k * Math.PI) * 0.9; r.rotation.y += 0.02 * (i % 2 ? -1 : 1) * (1 + i); r.position.y = 0.06 + i * 0.6 + ease(k) * (i * 0.8); });
      cerPose = G.pose({ lax: -2.6 * Math.min(1, k * 3), rax: -2.6 * Math.min(1, k * 3), laz: 0.4, raz: -0.4, hd: -0.5, sp: -0.25, llx: 0.2, rlx: -0.1, lk: 0.4, hy: 0.86 + Math.sin(Math.min(1, k * 1.2) * Math.PI) * (big ? 0.5 : 0.3) });
      if (k < 1) requestAnimationFrame(step); else res(); };
    later(T * 0.45, () => { sfx('level'); sfx('shard'); G.shake = big ? 1.2 : 0.7; banner(title, name, en, false, 3.2); }); step(); });
  cerPose = null; G.scene.remove(grp); grp.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  G.camOverride = null; G.faceLock = false; document.body.classList.remove('cine'); G.lock = false; G.setCam(yaw, 0.32);
}

// ───────────────────────── 외형 상점 UI ─────────────────────────
const shop = mk('div', 'shop', '');
let shopOpen = false, shopTab = 'hat', shopSel = null, shopYaw = 0, shopYaw0 = 0, shopAuto = true, shopSwordVis = null;
function toggleShop(on = !shopOpen){
  if (on && battle && !battle.ended){ G.toast('외형 상점', '전투 중에는 열 수 없다'); return; }
  if (on && (G.lock || tpBusy)) return;
  shopOpen = on; shop.classList.toggle('on', on); document.body.classList.toggle('shopping', on);
  if (on){
    if (statOpen) toggleStats(false); if (jobOpen) toggleJob(false);
    G.lock = true; shopYaw0 = shopYaw = fig.root.rotation.y + Math.PI * 0.15; shopAuto = true; shopSel = S.cos.eq[shopTab] || null;
    if (S.sword){ if (!sword) equipJob(); shopSwordVis = [sword && sword.visible, offhand && offhand.visible]; if (sword) sword.visible = true; if (offhand) offhand.visible = true; }
    renderShop(); sfx('ui');
  } else {
    applyLook(S.cos.eq); G.lock = false; G.camOverride = null;
    if (shopSwordVis){ if (sword) sword.visible = shopSwordVis[0]; if (offhand) offhand.visible = !!shopSwordVis[1]; shopSwordVis = null; }
  }
}
function previewSel(){ applyLook(Object.assign({}, S.cos.eq, shopSel ? { [shopTab]: shopSel } : {})); }
function renderShop(){
  const gold = S.gold || 0, eq = S.cos.eq[shopTab] || (shopTab === 'body' ? 'clay' : shopTab === 'wpn' || shopTab === 'aura' ? 'none' : null);
  const sel = shopSel && cosItem(shopTab, shopSel);
  const state = it => (eq === it.id) ? '<i class="eq">착용 중</i>' : owned(shopTab, it.id) ? '<i class="ow">보유</i>' : `<i>🪙 ${fmt(it.p)}</i>`;
  let act = '<div class="hintm">아이템을 눌러 미리 입어 보세요</div>';
  if (sel){
    const own = owned(shopTab, sel.id), isEq = eq === sel.id, short = sel.p - gold;
    act = `<div class="sela r${sel.r}"><div class="si">${sel.icon}</div><div><div class="sn">${sel.n}</div><div class="sr" style="color:${RAR[sel.r].c}">${RAR[sel.r].n}${sel.p ? ` · 🪙 ${fmt(sel.p)}` : ''}</div></div></div>
      ${!own ? `<button class="buy" ${short > 0 ? 'disabled' : ''}>${short > 0 ? `골드 부족 · 🪙 ${fmt(short)} 더 필요` : `🪙 ${fmt(sel.p)} 구매하고 착용`}</button>`
        : isEq ? (sel.p === 0 ? '<button class="buy" disabled>착용 중</button>' : '<button class="buy off">벗기</button>') : '<button class="buy on">착용하기</button>'}`;
  }
  shop.innerHTML = `<div class="hd"><span>WARDROBE</span><b>외형 상점</b><div class="gold">🪙 <b>${fmt(gold)}</b></div><button class="x">✕</button></div>
    <div class="tabs">${SLOTS.map(([k, n, ic]) => `<button data-t="${k}" class="${k === shopTab ? 'on' : ''}">${ic}<span>${n}</span></button>`).join('')}</div>
    <div class="grid">${COS[shopTab].map(it => `<button class="it r${it.r}${shopSel === it.id ? ' sel' : ''}${eq === it.id ? ' wear' : ''}" data-id="${it.id}"><div class="ic">${it.icon}</div><div class="nm">${it.n}</div><div class="rr" style="color:${RAR[it.r].c}">${RAR[it.r].n}</div><div class="pr">${state(it)}</div></button>`).join('')}</div>
    <div class="act">${act}</div>
    <div class="ft"><button class="rot" data-d="-1">⟲</button><button class="rot auto${shopAuto ? ' on' : ''}">자동 회전</button><button class="rot" data-d="1">⟳</button><small>골드는 스테이지 클리어 · 높은 난이도에서 더 많이!</small></div>`;
  shop.querySelector('.x').onclick = () => toggleShop(false);
  shop.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { shopTab = b.dataset.t; shopSel = S.cos.eq[shopTab] || null; applyLook(S.cos.eq); sfx('ui'); renderShop(); });
  shop.querySelectorAll('.it').forEach(b => b.onclick = () => { shopSel = b.dataset.id; previewSel(); sfx('pick'); renderShop(); });
  shop.querySelectorAll('.rot[data-d]').forEach(b => b.onclick = () => { shopAuto = false; shopYaw += +b.dataset.d * 0.8; renderShop(); });
  shop.querySelector('.rot.auto').onclick = () => { shopAuto = !shopAuto; renderShop(); };
  const bb = shop.querySelector('.buy:not([disabled])');
  if (bb) bb.onclick = () => {
    const it = sel, key = shopTab + ':' + it.id;
    if (!owned(shopTab, it.id)){ if ((S.gold || 0) < it.p) return; S.gold -= it.p; S.cos.own.push(key); sfx('level'); sfx('shard'); G.toast(`${RAR[it.r].n} 획득!`, `${it.icon} ${it.n}`);
      for (let i = 0; i < 40; i++){ const a = R() * TAU; emit(player.pos.x + Math.cos(a) * 0.6, player.pos.y + rr(0.1, 1.9), player.pos.z + Math.sin(a) * 0.6, Math.cos(a) * rr(0.5, 1.5), rr(0.5, 2), Math.sin(a) * rr(0.5, 1.5), it.r === 3 ? 0xffc040 : it.r === 2 ? 0xc07aff : 0x7ad8ff, 0.14, rr(0.6, 1.1), { drag: 1.5 }); }
      S.cos.eq[shopTab] = it.id; }
    else if (bb.classList.contains('off')){ S.cos.eq[shopTab] = null; shopSel = null; sfx('ui'); }
    else { S.cos.eq[shopTab] = it.id; sfx('pick'); }
    save(); applyLook(S.cos.eq); refreshHud(); renderShop();
  };
}
// 마우스 드래그로 돌려보기
G.renderer.domElement.addEventListener('pointermove', e => { if (shopOpen && e.buttons){ shopAuto = false; shopYaw += e.movementX * 0.012; } });
const _cr = new V3();
function updateShopCam(dt){
  if (!shopOpen) return;
  if (shopAuto) shopYaw += dt * 0.45;
  fig.root.rotation.y = shopYaw;
  const p = player.pos, fx = Math.sin(shopYaw0), fz = Math.cos(shopYaw0), narrow = innerWidth < 760;
  _cr.set(fz, 0, -fx);   // 카메라 기준 오른쪽
  const d = narrow ? 5.4 : 3.6, side = narrow ? 0 : 0.95;
  G.camOverride = { pos: new V3(p.x + fx * d, p.y + 1.5, p.z + fz * d), look: new V3(p.x + _cr.x * side, p.y + (narrow ? -0.55 : 1.05), p.z + _cr.z * side) };
}

// ───────────────────────── 입력 ─────────────────────────
G.onKey = (code) => {
  if (dialogOpen){ if (code === 'KeyE' || code === 'Space' || code === 'Enter' || code === 'KeyJ'){ dlgAdvance && dlgAdvance(); return true; } return code !== 'KeyC'; }
  for (const h of KEYH){ try { if (h(code)) return true; } catch (e){ console.error(e); } }
  if (code === 'Escape' && spop.classList.contains('on')){ spop.classList.remove('on'); return true; }
  if (code === 'Escape' && wmap.classList.contains('on')){ closeMap(); return true; }
  if (code === 'KeyM' && MODE !== 'field' && MODE !== 'raid'){ if (wmap.classList.contains('on')) closeMap(); else openMap(G.area === 'story' ? 'road' : 'world'); return true; }
  if (code === 'KeyC' || (code === 'Escape' && statOpen)){ toggleStats(); return true; }
  if (code === 'KeyB' || (code === 'Escape' && shopOpen)){ toggleShop(); return true; }
  if (shopOpen) return true;
  if (code === 'KeyV' || (code === 'Escape' && jobOpen)){ if (G.lock && !jobOpen) return true; toggleJob(); return true; }
  const si = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[code];
  if (si !== undefined && inStory && !G.lock){ useSkill(si); return true; }
  if (G.lock || wmap.classList.contains('on')) return true;
  if (!inStory) return false;
  if (code === 'KeyJ' || code === 'KeyF'){ attack(); return true; }
  if (code === 'KeyK'){ doRoll(); return true; }
  if (code === 'KeyR' || code === 'KeyQ'){ doRune(); return true; }
  return false;
};
G.onClick = (b) => { if (dialogOpen){ dlgAdvance && dlgAdvance(); return; } if (!inStory) return; if (b === 2) doRoll(); else if (b === 0) attack(); };
const tap = (id, fn) => $(id).addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false });
tap('cAtk', attack); tap('cRoll', doRoll); tap('cRune', doRune);

// ───────────────────────── 메인 업데이트 ─────────────────────────
let smithT = 0, smithT0 = 0, heartT = 0, fdeadT = 0;
const fdeadEl = mk('div', 'fdead', '<div class="b">쓰러졌다</div><div class="c"></div><button>부활하기</button>');
function fieldDeath(){
  const lost = MODE === 'field' ? Math.round(S.exp * 0.05) : 0; if (lost){ S.exp = Math.max(0, S.exp - lost); save(); }
  fdeadEl.querySelector('.c').innerHTML = MODE === 'field' ? `마지막으로 들른 룬 비석에서 깨어난다.<br><small>경험치 -${lost}</small>` : '도전에 실패했다.';
  fdeadEl.classList.add('on');
  fdeadEl.querySelector('button').onclick = () => { fdeadEl.classList.remove('on'); revive(); if (X.onRevive) X.onRevive(MODE); };
}
G.hooks.push((dt, rdt) => {
  for (let i = TIMERS.length - 1; i >= 0; i--){ const t = TIMERS[i]; t.t -= rdt; if (t.t <= 0){ TIMERS.splice(i, 1); t.fn(); } }
  if (inStory){
    updateCombat(dt);
    if (MODE === 'field') gOffInstall();
    const alive = updateEnemies(dt);
    updateProj(dt); updateXPO(dt); updateBattle(dt, alive); updateParticles(dt); updateFXL(dt);
    updatePP(dt); updateFall(dt); updateFields(dt); updateClones(dt); tickSkbar();
    if (comboT > 0){ comboT -= dt; if (comboT <= 0) comboEl.classList.remove('on'); }
    const low = ((battle && !battle.ended) || MODE === 'field' || MODE === 'raid') && !dead && hp / D().maxHp < 0.3; lowEl.classList.toggle('on', !!low);
    if (low){ heartT -= dt; if (heartT <= 0){ heartT = 0.85; sfx('heart'); } }
    if (battle && !battle.ended && dead) lose();
    if (MODE !== 'stage' && dead && !fdeadEl.classList.contains('on') && !X.deathHandled){ fdeadT += dt; if (fdeadT > 1.6){ fdeadT = 0; BUS.emit('death', MODE); if (!X.deathHandled) fieldDeath(); } }
    // 엘드라 / 제단 / 모닥불
    const kp = keeper.root.position, kd = Math.hypot(player.pos.x - kp.x, player.pos.z - kp.z);
    if (keeper.root.visible && !dialogOpen && kd < 9){ const a = Math.atan2(player.pos.x - kp.x, player.pos.z - kp.z); keeper.root.rotation.y += angDiff(a, keeper.root.rotation.y) * Math.min(1, dt * 2); }
    const kpz = Object.assign({}, KEEPER_POSE); kpz.hy += Math.sin(G.time * 1.6) * 0.006; keeper.set(kpz); keeper.blend(dt, 4);
    for (const f of stageAnims) f(dt);
    const inB = battle && !battle.ended; RET_IT.r = inB ? 0 : 2.4; retRing.userData.ring.rotation.y += dt * 0.3; retRing.userData.ring.material.opacity = inB ? 0.25 : 0.95;
  } else {
    G.poseMod = cerPose ? () => cerPose : X.emotePose ? (tp => X.emotePose(tp)) : null; G.poseK = cerPose ? 8 : X.emotePose ? 10 : 0; G.speedMul = D().spd; G.moveMul = 1; G.faceLock = false; G.noJump = false;
  }
  if (smith && !inStory){
    smithT += dt;
    const sd = Math.hypot(player.pos.x - smith.root.position.x, player.pos.z - smith.root.position.z);
    const cyc = (smithT % 1.1) / 1.1, up = cyc < 0.7 ? ease(cyc / 0.7) : 1 - ease((cyc - 0.7) / 0.3);
    smith.set(G.pose({ rax: -0.7 - 1.8 * up, re: -0.6 - 0.6 * up, lax: -0.7, le: -0.8, sp: 0.25, hd: 0.3, llx: -0.2, rlx: 0.2 })); smith.blend(dt, 18);
    if (cyc < smithT0 && anvilTop && sd < 18) sfx('clang');
    smithT0 = cyc;
  }
  marker.visible = false;
  if (bannerT > 0){ bannerT -= rdt; if (bannerT <= 0) bannerEl.classList.remove('on'); }
  updateLook(rdt); updateShopCam(rdt);
  if (aura){ aura.userData.r.rotation.y += dt * 0.8; aura.children[2].material.opacity = 0.2 + Math.sin(G.time * 3) * 0.08; }
  if (hintT > 0){ hintT -= rdt; if (hintT <= 0) hintEl.classList.remove('on'); }
  if (expT > 0){ expT -= rdt; if (expT <= 0 && expAcc > 0){ dmgNum(new V3(player.pos.x, PY() + 2.3, player.pos.z), '+' + Math.round(expAcc) + ' EXP', 'xp'); expAcc = 0; } }
  const d = D();
  hpB.style.width = clamp(hp / d.maxHp * 100, 0, 100) + '%'; mpB.style.width = clamp(mp / d.maxMp * 100, 0, 100) + '%';
  const rb = $('cRune'); rb.classList.toggle('dis', !S.rune); rb.querySelector('i').style.height = (S.rune ? runeCd / d.cd * 100 : 0) + '%';
});

// ───────────────────────── 시작 ─────────────────────────
refreshHud(); refreshSkbar(); if (S.job && S.sword){ equipJob(); sword.visible = false; if (offhand) offhand.visible = false; }
const waitStart = setInterval(() => { if (G.playing){ clearInterval(waitStart); setTimeout(() => { if (G.area === 'plaza') hint('오른쪽 <b>🗺 월드맵</b> 버튼(또는 <b>M</b>)으로 모험을 시작하세요', 7); }, 5500); } }, 300);
// ───────────────────────── 아바타 (봇 · NPC 용) ─────────────────────────
// o = { job, asc, look: { hat, back, body, wpn, aura }, scale, mat } → { fig, weapon, offhand, upd(dt, moving, air), setArmed(bool) }
function makeAvatar(o = {}){
  const f = new G.Figure(o.mat || G.CLAY, o.scale || 0.86), look = o.look || {}, ups = [];
  const wi = look.wpn && look.wpn !== 'none' && cosItem('wpn', look.wpn), j = o.job;
  const col = wi && wi.col && wi.col !== 'rainbow' ? wi.col : !j ? 0x8ff4ff : o.asc ? JOBS[j].asc.c : JOBS[j].c;
  let weapon = null, off = null;
  if (j === 'archer'){ weapon = makeBow(col); weapon.position.set(0, -0.36, 0); weapon.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V3(0, 1, 0), new V3(0, 0, 1), new V3(1, 0, 0))); f.elL.add(weapon); }
  else if (j === 'mage'){ weapon = makeStaff(col); weapon.position.set(0, -0.36, 0.02); weapon.rotation.x = Math.PI / 2; f.elR.add(weapon); }
  else if (j === 'rogue'){ weapon = makeSword(0.62, col); weapon.position.set(0, -0.36, 0.02); weapon.rotation.x = Math.PI / 2; f.elR.add(weapon); off = makeSword(0.62, col); off.position.set(0, -0.36, 0.02); off.rotation.x = Math.PI / 2; f.elL.add(off); }
  else if (j){ weapon = makeSword(j === 'sword' ? 1.12 : 1, col); weapon.position.set(0, -0.36, 0.02); weapon.rotation.x = Math.PI / 2; f.elR.add(weapon); }
  for (const slot of ['hat', 'back', 'aura']){ const id = look[slot]; if (!id || id === 'none') continue; const it = cosItem(slot, id); if (!it) continue;
    const b = it.mk ? it.mk() : { upd: it.upd }; if (b.obj) (slot === 'aura' ? f.root : slot === 'hat' ? f.head : f.spine).add(b.obj); if (b.upd) ups.push([slot, b.upd]); }
  if (look.body && look.body !== 'clay'){ const bi = cosItem('body', look.body); if (bi) f.mesh.material = bi.mat(); }
  f.mesh.castShadow = true;
  return { fig: f, weapon, offhand: off, color: col,
    upd(dt, moving = 0, air = false){ const t = G.time; for (const [slot, u] of ups) u(dt, t, slot === 'aura' ? f.root.position : moving, air); },
    setArmed(v){ if (weapon) weapon.visible = v; if (off) off.visible = v; } };
}

// ───────────────────────── 모듈용 컨텍스트 (agora-field.js 등) ─────────────────────────
// 문서: docs/agora-modules.md
var X = {
  G, THREE, V3, R, rr, clamp, ease, pick, angDiff, TAU, M, BUS, KEYH, BONUS,
  // 저장 · 상태
  S, save, D, need, power, fmt, stars, get hp(){ return hp; }, set hp(v){ hp = v; }, get mp(){ return mp; }, set mp(v){ mp = v; },
  get dead(){ return dead; }, get mode(){ return MODE; }, get inStory(){ return inStory; }, get battle(){ return battle; }, get dialogOpen(){ return dialogOpen; }, get tpBusy(){ return tpBusy; },
  heal(n){ if (dead) return; const d = D(); hp = Math.min(d.maxHp, hp + n); refreshHud(); }, restoreMp(n){ const d = D(); mp = Math.min(d.maxMp, mp + n); refreshHud(); },
  gainExp, dropOrbs, refreshHud, refreshStats, hurtPlayer, revive, die,
  // 플레이어 · 아바타
  player, fig, PY, makeAvatar, makeSword, makeBow, makeStaff, JOBS, jobName, jobColor, COS, RAR, cosItem, applyLook, get sword(){ return sword; },
  // 적
  ENEMIES, MON, BOSS, spawnMon, killEnemy, hitEnemy, hitFrom, dmgE, stunE, liveE, foesIn, nearestEnemy, bossBar, turn, contact, LVHP, LVDMG, LVEXP,
  MK: { mkSlime, mkShroom, mkBee, mkBoar, mkSprout, mkGolem, mkTreant, mkSquirrel, mkFrog, mkLadybug, mkSnail, mkFlower, mkRaccoon, mkMole, mkOwl, mkHedgehog, face, addCrown, sm, EYE_M, WHITE_M },
  // 전투 레이어 이펙트 (y 는 지면 기준)
  SW, GOFF_SKIP, glowSprite, burst, shockwave, telegraph, teleRect, teleUpd, rmTele, trail, shootLine, throwArc, explode, spike, bolt, fallObj, dmgNum, toScreen, emit, zap, ADD, ADDM, polarRing,
  // 지형 · 소품 재사용
  treeGeo, plant, TREEMAT, smat, TX, noiseTex, MATS2, MOOD, water,
  // UI
  mk, hud, banner, hint, toast: (h, s2) => G.toast(h, s2), say, NAMES, SPK, setObj, clearObj, sfx, later, wait, sleep, teleport, closeMap,
  openStats: () => toggleStats(true), openJob: () => toggleJob(true), openWardrobe: () => toggleShop(true), get anyWindow(){ return statOpen || jobOpen || shopOpen || wmap.classList.contains('on') || dialogOpen; },
  // 모드 전환
  setMode, enterCombat, enterInstance, leaveToPlaza: () => leaveForest(), disposeStage, cleanupBattle, clearSkillFx,
  set GYF(f){ GYF = f; }, get GYF(){ return GYF; }, set CLAMP(f){ CLAMP = f; }, set FW(g){ fieldFW = g; if (g) GOFF_SKIP.add(g); },
  deathHandled: false, onRevive: null, fieldReturn: null, emotePose: null,   // emotePose(tp) → 포즈 | null (감정표현)
};
GOFF_SKIP.add(pts); GOFF_SKIP.add(keeper.root); GOFF_SKIP.add(retRing);
G.X = X;
import('./agora-field.js').then(m => m.init(G, X)).catch(e => console.error('field load failed', e));
window.__story = { S, X, toggleShop, applyLook, COS, get shopOpen(){ return shopOpen; }, useSkill, chooseJob, ascend, toggleJob, SKL, JOBS, get sk(){ return sk; }, get mp(){ return mp; }, set mp(v){ mp = v; }, SKCD, ENEMIES, spawnMon, startStage, openMap, openStage, leaveForest, D, power, get hp(){ return hp; }, get battle(){ return battle; }, STAGES };
}
