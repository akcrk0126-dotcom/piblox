// 룬 아고라 — 스토리 모드 (월드맵 · 스테이지 로드맵 · 제 1 장 평화로운 숲 1-1 ~ 1-20)
// 전투(3연격 · 구르기 · 룬 마법) / 스탯(힘 · 체력 · 민첩 · 지능) / 난이도(이지 · 미디엄 · 하드) / 별 3개 / 저장
export function init(G){
const { THREE, $, M, FX, TAU, player } = G;
const V3 = THREE.Vector3;
const R = Math.random, rr = (a, b) => a + (b - a) * R(), clamp = (x, a, b) => Math.max(a, Math.min(b, x)), ease = t => t * t * (3 - 2 * t);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const fig = player.fig;

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
  body[data-area="story"] #modes, body[data-area="story"] #back { display:none !important; }
  body:not([data-area="story"]) #bReturn { display:none !important; }
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
const hurtEl = mk('div', 'hurt', '');
const cb = mk('div', 'cbtns', '<div class="cb" id="cRune"><span>✦</span>룬<i></i></div><div class="cb" id="cRoll"><span>➰</span>구르기</div><div class="cb" id="cAtk"><span>⚔</span>공격</div>', hud);
const modes = mk('div', 'modes', '<button class="story" id="mStory"><span>✦</span>스토리 모드</button><button class="soon" id="mMini"><span>🎲</span>미니 게임</button><button id="mStat"><span>⚔</span>스탯</button>', hud);
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
const D = () => ({
  maxHp: Math.round(90 + S.vit * 14 + S.lv * 6), atk: 9 + S.str * 3.2 + S.lv * 0.8,
  spd: Math.min(1.35, 1 + (S.agi - 1) * 0.025), aspd: Math.min(1.7, 1 + (S.agi - 1) * 0.045), crit: Math.min(0.5, 0.06 + (S.agi - 1) * 0.014),
  maxMp: 40 + S.int * 8, rune: 26 + S.int * 7, cd: Math.max(3, 9 - S.int * 0.3), mpRegen: 3 + S.int * 0.4,
});
const need = lv => Math.round(30 * Math.pow(lv, 1.45));
let hp = D().maxHp, mp = D().maxMp;
const ST = [
  ['str', '⚔', '힘', 'STR', '공격력이 오른다'],
  ['vit', '❤', '체력', 'VIT', '최대 HP가 오른다'],
  ['agi', '➶', '민첩', 'AGI', '이동 · 공격 속도, 치명타'],
  ['int', '✦', '지능', 'INT', '룬 마법 위력 · MP · 재사용'],
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
  statw.querySelector('.hd b').textContent = stars(20, 'e') ? '숲의 수호자' : '이름 없는 자'; statw.querySelector('.cpw').textContent = fmt(power());
  for (const r of statw.querySelectorAll('.row')){ r.querySelector('.v').textContent = S[r.dataset.k]; r.querySelector('button').disabled = S.pts <= 0; }
  statw.querySelector('.der').innerHTML = `<div>최대 HP<b>${d.maxHp}</b></div><div>최대 MP<b>${d.maxMp}</b></div><div>공격력<b>${Math.round(d.atk)}</b></div><div>치명타<b>${Math.round(d.crit * 100)}%</b></div><div>이동 속도<b>${Math.round(d.spd * 100)}%</b></div><div>공격 속도<b>${Math.round(d.aspd * 100)}%</b></div><div>룬 마법<b>${Math.round(d.rune)}</b></div><div>룬 재사용<b>${d.cd.toFixed(1)}초</b></div>`;
}
function refreshHud(){
  const d = D();
  card.querySelector('.lv').textContent = `Lv.${S.lv} · ⚔ 전투력 ${fmt(power())}`;
  card.querySelector('.nm').firstChild.textContent = stars(20, 'e') ? '숲의 수호자' : '이름 없는 자';
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
    case 'type': tone('sine', 1200 + R() * 200, 1100, 0.03, 0.012); break;
  }
}


// ───────────────────────── 스토리 맵: 평화로운 숲 ─────────────────────────
// 야영지(남쪽, 룬진 도착) → 숲길 → 도토리 공터 → 선돌과 고대 기둥이 둘러선 고목의 성소(북쪽)
const SW = new THREE.Group(); SW.visible = false; G.scene.add(SW);
const SCOL = [], SINT = [];
const CAMP = new V3(0, 0, 40), SANC = new V3(0, 0, -22), SANC_R = 19, ARRIVE = new V3(0, 0.04, 50.5);
const PATH = [[0, 40], [0, 31], [7, 20], [-5, 8], [4, -3], [0, -12]];
const SHAPES = [{ c: [CAMP.x, CAMP.z, 13] }, { c: [SANC.x, SANC.z, SANC_R] }];
for (let i = 0; i < PATH.length - 1; i++) SHAPES.push({ s: [...PATH[i], ...PATH[i + 1], 3.4] });
SHAPES.push({ c: [-3, 9, 11.6] });
function shapeOut(px, pz, sh){
  if (sh.c){ const [cx, cz, r] = sh.c, dx = px - cx, dz = pz - cz, d = Math.hypot(dx, dz); return d <= r ? [0, px, pz] : [d - r, cx + dx / d * r, cz + dz / d * r]; }
  const [ax, az, bx, bz, r] = sh.s, ex = bx - ax, ez = bz - az, t = clamp(((px - ax) * ex + (pz - az) * ez) / (ex * ex + ez * ez), 0, 1), sx = ax + ex * t, sz = az + ez * t, dx = px - sx, dz = pz - sz, d = Math.hypot(dx, dz);
  return d <= r ? [0, px, pz] : [d - r, sx + dx / d * r, sz + dz / d * r];
}
function outDist(px, pz){ let m = 1e9; for (const sh of SHAPES){ const o = shapeOut(px, pz, sh)[0]; if (o < m) m = o; if (m === 0) break; } return m; }
function storyBound(p){ let best = null; for (const sh of SHAPES){ const r = shapeOut(p.x, p.z, sh); if (r[0] === 0) return; if (!best || r[0] < best[0]) best = r; } p.x = best[1]; p.z = best[2]; }
const ADDM = (map, op = 1) => new THREE.MeshBasicMaterial({ map, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
const polarRing = (r0, r1, seg = 128) => {
  const P = [], U = [], I = [];
  for (let i = 0; i <= seg; i++){ const a = i / seg * TAU; for (const [r, v] of [[r0, 0], [r1, 1]]){ P.push(Math.cos(a) * r, 0, Math.sin(a) * r); U.push(i / seg, v); } }
  for (let i = 0; i < seg; i++){ const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); return g;
};
const meterUV = g => { const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), p.getZ(i)); return g; };
let altar = null, campLight = null;
{
  const B = new G.Builder(), K = new G.Kit(B);
  const mats = Object.assign({}, M, {
    moss: G.std({ map: G.T.stone, color: 0x8e9a80, roughness: 0.95, side: THREE.DoubleSide }),
    flag: G.std({ map: G.T.cobble, color: 0xa29c8e, roughness: 0.9, side: THREE.DoubleSide }),
    tentA: G.std({ map: G.T.plaster, color: 0xc9b48a, roughness: 0.95, side: THREE.DoubleSide }),
    tentB: G.std({ map: G.T.plaster, color: 0x8a4a3a, roughness: 0.95, side: THREE.DoubleSide }),
    rock: G.std({ color: 0x6f6e68, roughness: 0.95, flatShading: true, side: THREE.DoubleSide }),
  });
  // 바닥
  const gg = meterUV(new THREE.PlaneGeometry(560, 560).rotateX(-Math.PI / 2));
  const ground = new THREE.Mesh(gg, G.std({ map: G.T.grass, color: 0x74885c, roughness: 1 })); ground.receiveShadow = true; SW.add(ground);
  const dirtT = (() => { const c = G.cnv(256), x = c.getContext('2d'); x.fillStyle = '#6a563f'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++){ const v = 70 + R() * 70; x.fillStyle = `rgba(${v + 30 | 0},${v + 10 | 0},${v - 20 | 0},${0.15 + R() * 0.3})`; const s = R() * 4 + 1; x.fillRect(R() * 256, R() * 256, s, s); }
    for (let i = 0; i < 70; i++){ const v = 110 + R() * 60; x.fillStyle = `rgb(${v | 0},${v - 6 | 0},${v - 16 | 0})`; x.beginPath(); x.ellipse(R() * 256, R() * 256, 2 + R() * 4, 2 + R() * 3, R() * 3, 0, TAU); x.fill(); }
    return G.tex(c, true, 1 / 3); })();
  const dirtM = G.std({ map: dirtT, roughness: 1 });
  // 숲길 (리본)
  {
    const curve = new THREE.CatmullRomCurve3([[0, 53], ...PATH, [0, -20]].map(p => new V3(p[0], 0, p[1])));
    const N = 180, P = [], U = [], I = []; let len = 0, prev = null;
    for (let i = 0; i <= N; i++){
      const t = i / N, c = curve.getPointAt(t), tg = curve.getTangentAt(t), nx = tg.z, nz = -tg.x;
      if (prev) len += c.distanceTo(prev); prev = c;
      const w = 2.3 + Math.sin(t * 37) * 0.25 + Math.sin(t * 13) * 0.2;
      P.push(c.x + nx * w, 0.025, c.z + nz * w, c.x - nx * w, 0.025, c.z - nz * w); U.push(-w, len, w, len);
    }
    for (let i = 0; i < N; i++){ const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
    const m = new THREE.Mesh(g, dirtM); m.receiveShadow = true; SW.add(m);
  }
  // 도토리 공터 (꽃밭)
  { const gl = new THREE.Mesh(meterUV(new THREE.CircleGeometry(11, 48).rotateX(-Math.PI / 2)), G.std({ map: G.T.grass, color: 0xa8c87a, roughness: 1 })); gl.position.set(-3, 0.028, 9); gl.receiveShadow = true; SW.add(gl);
    for (let i = 0; i < 160; i++){ const a = R() * TAU, r = Math.sqrt(R()) * 10.5; K.geo(['flower', 'flowerY', 'leaf'][i % 3], new THREE.IcosahedronGeometry(rr(0.06, 0.11), 0), -3 + Math.cos(a) * r, 0.08, 9 + Math.sin(a) * r); }
    for (const [x, z] of [[-9, 4], [2.5, 3.5], [-8.5, 14.5]]){ K.geo('woodD', new THREE.CylinderGeometry(0.55, 0.65, 0.5, 12), x, 0.25, z); K.geo('crate', new THREE.CircleGeometry(0.55, 12).rotateX(-Math.PI / 2), x, 0.51, z); SCOL.push({ t: 'c', x, z, r: 0.7 }); } }
  const camp = new THREE.Mesh(meterUV(new THREE.CircleGeometry(9.5, 40).rotateX(-Math.PI / 2)), dirtM); camp.position.set(CAMP.x, 0.03, CAMP.z); camp.receiveShadow = true; SW.add(camp);
  // 성소 바닥 + 테두리 + 룬 고리
  const sf = new THREE.Mesh(meterUV(new THREE.CircleGeometry(16, 64).rotateX(-Math.PI / 2)), mats.flag); sf.position.set(SANC.x, 0.045, SANC.z); sf.receiveShadow = true; SW.add(sf);
  K.geo('moss', G.ringBand(15.9, 16.7, 0, 0.28, 96), SANC.x, 0, SANC.z);
  const rr1 = new THREE.Mesh(polarRing(13.4, 14.5), ADDM(G.tex(G.runeStrip(2048, 128, 36, '#7dffb0', 0, 7), true, 1, 1), 0.9)); rr1.position.set(SANC.x, 0.06, SANC.z); SW.add(rr1);
  const rr2 = new THREE.Mesh(polarRing(5.0, 5.6, 64), ADDM(G.tex(G.runeStrip(1024, 128, 16, '#ffcf6a', 0, 3), true, 1, 1), 0.85)); rr2.position.set(SANC.x, 0.065, SANC.z); SW.add(rr2);
  // 선돌 (룬이 새겨진)
  const RB = new G.Builder(), runeV = ADDM(G.tex(G.runeColumn(128, 1024, 8, '#7dffb0', 3), true, 1, 1), 0.95);
  for (let i = 0; i < 14; i++){
    const a = i / 14 * TAU + 0.11; if (Math.abs(angDiff(a, Math.PI / 2)) < 0.3) continue;
    const r = 17.7, x = SANC.x + Math.cos(a) * r, z = SANC.z + Math.sin(a) * r, h = rr(3.4, 5.8);
    K.push(x, 0, z, -a + Math.PI / 2, rr(-0.06, 0.06), rr(-0.06, 0.06));
    const g = new THREE.CylinderGeometry(0.48, 0.78, h, 4, 1); g.rotateY(Math.PI / 4);
    K.geo(i % 3 ? 'basalt' : 'moss', g, 0, h / 2, 0);
    RB.add('r', new THREE.PlaneGeometry(0.34, h * 0.7), K.top().clone().multiply(G.mat(0, h * 0.5, -0.47, 0, Math.PI, 0)));
    K.pop(); SCOL.push({ t: 'c', x, z, r: 0.95 });
  }
  RB.build({ r: runeV }, SW, false, false);
  // 무너진 고대 기둥
  for (let i = 0; i < 8; i++){
    const a = i / 8 * TAU + 0.35; if (Math.abs(angDiff(a, Math.PI / 2)) < 0.35) continue;
    const r = 10.6, x = SANC.x + Math.cos(a) * r, z = SANC.z + Math.sin(a) * r;
    K.push(x, 0, z, -a);
    K.box('moss', 1.4, 0.3, 1.4, 0, 0.15, 0);
    if (i % 3 === 1){
      K.geo('marble', new THREE.CylinderGeometry(0.5, 0.52, 1.0, 16), 0, 0.8, 0);
      K.geo('marble', new THREE.CylinderGeometry(0.47, 0.5, 4.2, 16), 2.4, 0.5, 0.6, 0, 0.5, Math.PI / 2 + 0.06);
      SCOL.push({ t: 'c', x, z, r: 0.9 });
      const w = new V3(2.4, 0, 0.6).applyAxisAngle(new V3(0, 1, 0), -a); SCOL.push({ t: 'b', x: x + w.x, z: z + w.z, hw: 2.1, hd: 0.5, c: Math.cos(-a + 0.5), s: Math.sin(-a + 0.5) });
    } else {
      const h = rr(1.8, 5.4);
      K.geo('marble', new THREE.CylinderGeometry(0.46, 0.52, h, 16), 0, 0.3 + h / 2, 0);
      K.geo('marble', new THREE.ConeGeometry(0.47, 0.5, 7), 0.05, 0.3 + h + 0.1, 0, rr(-0.3, 0.3), 0, rr(-0.4, 0.4));
      if (h > 4) K.box('marble', 1.5, 0.35, 1.5, 0, 0.3 + h + 0.2, 0, 0, 0.3, 0.1);
      SCOL.push({ t: 'c', x, z, r: 0.85 });
    }
    for (let j = 0; j < 3; j++) K.geo('rock', new THREE.IcosahedronGeometry(rr(0.15, 0.32), 0), rr(-1.4, 1.4), 0.1, rr(-1.4, 1.4));
    K.pop();
  }
  // 제단
  K.push(SANC.x, 0, SANC.z);
  K.geo('moss', new THREE.CylinderGeometry(3.8, 4.0, 0.45, 40), 0, 0.225, 0);
  K.geo('marble', new THREE.CylinderGeometry(2.7, 2.9, 0.45, 40), 0, 0.675, 0);
  K.geo('marble', G.latheG([[1.3, 0.9], [1.0, 1.1], [0.7, 1.3], [0.62, 2.0], [0.95, 2.25], [1.0, 2.4], [0, 2.4]], 32, 0.4));
  K.geo('gold', new THREE.TorusGeometry(1.0, 0.04, 6, 40), 0, 2.4, 0, Math.PI / 2);
  K.geo('gold', new THREE.TorusGeometry(2.8, 0.04, 6, 64), 0, 0.9, 0, Math.PI / 2);
  K.pop();
  SCOL.push({ t: 'c', x: SANC.x, z: SANC.z, r: 4.0 });
  {
    const g = new THREE.Group(); g.position.set(SANC.x, 4.3, SANC.z); SW.add(g);
    const cg = new THREE.OctahedronGeometry(1, 0); cg.scale(0.55, 1.3, 0.55);
    const crys = new THREE.Mesh(cg, G.std({ color: 0xb8ffc8, emissive: 0x30e070, emissiveIntensity: 2.4, roughness: 0.08, flatShading: true, transparent: true, opacity: 0.92 })); g.add(crys);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.glowT, color: 0x8aff9a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); halo.scale.set(7, 7, 1); g.add(halo);
    const rt = G.tex(G.runeStrip(2048, 128, 24, '#9aff7a', 0, 5), true, 1, 1), rings = [];
    for (const [r, h, tilt, spd] of [[1.9, 0.3, 0.4, 0.6], [2.5, 0.26, -0.6, -0.4]]){
      const piv = new THREE.Group(); piv.rotation.set(tilt, 0, tilt * 0.5);
      const bg = G.ringBand(0, r, -h / 2, h / 2, 96, { o: 1 }), uv = bg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / (TAU * r), (uv.getY(i) + h / 2) / h);
      piv.add(new THREE.Mesh(bg, ADDM(rt, 0.95))); g.add(piv); rings.push({ piv, spd });
    }
    const pl = new THREE.PointLight(0x7aff9a, 16, 22, 1.6); g.add(pl);
    altar = { g, crys, halo, rings, pl };
  }
  // ── 야영지 ──
  const tent = (x, z, ry, mt) => {
    K.push(x, 0, z, ry);
    const tg = new THREE.ConeGeometry(2.3, 2.9, 6, 1, true); K.geo(mt, tg, 0, 1.45, 0);
    K.geo('woodD', new THREE.CylinderGeometry(0.05, 0.05, 3.4, 5), 0, 1.7, 0);
    K.geo('dark', new THREE.PlaneGeometry(1.0, 1.5), 0, 0.75, 1.62, -0.3, 0, 0);
    for (let i = 0; i < 6; i++){ const a = i / 6 * TAU; K.geo('woodD', new THREE.CylinderGeometry(0.03, 0.03, 0.4, 4), Math.cos(a) * 2.5, 0.12, Math.sin(a) * 2.5, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
    K.pop(); SCOL.push({ t: 'c', x, z, r: 2.35 });
  };
  tent(-6.2, 43.5, 0.5, 'tentA'); tent(6.4, 45, -0.6, 'tentB');
  const FP = new V3(0, 0, 41.2);
  for (let i = 0; i < 10; i++){ const a = i / 10 * TAU; K.geo('rock', new THREE.IcosahedronGeometry(0.24, 0), FP.x + Math.cos(a) * 0.78, 0.12, FP.z + Math.sin(a) * 0.78, R(), R(), R()); }
  for (let i = 0; i < 4; i++){ const a = i / 4 * TAU + 0.4; K.geo('woodD', new THREE.CylinderGeometry(0.08, 0.09, 1.1, 6), FP.x + Math.cos(a) * 0.28, 0.4, FP.z + Math.sin(a) * 0.28, Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55); }
  K.geo('ember', new THREE.CircleGeometry(0.5, 16).rotateX(-Math.PI / 2), FP.x, 0.07, FP.z);
  SCOL.push({ t: 'c', x: FP.x, z: FP.z, r: 1.05 });
  for (const [a, rot] of [[0.3, 0], [2.4, 0], [4.3, 0]]){ const x = FP.x + Math.cos(a) * 2.7, z = FP.z + Math.sin(a) * 2.7, ry = -a + Math.PI / 2; K.geo('wood', new THREE.CylinderGeometry(0.24, 0.26, 2.0, 10), x, 0.24, z, 0, ry, Math.PI / 2); SCOL.push({ t: 'b', x, z, hw: 1.0, hd: 0.3, c: Math.cos(ry), s: Math.sin(ry) }); }
  // 무기 거치대 / 상자 / 깃대 / 등불
  K.push(4.6, 0, 37.2, -0.5); K.box('woodD', 1.8, 0.1, 0.3, 0, 1.75, 0); K.box('woodD', 1.8, 0.1, 0.3, 0, 0.35, 0.15); for (const s2 of [-1, 1]) K.box('woodD', 0.1, 1.9, 0.1, s2 * 0.85, 0.95, 0.05);
  for (let i = 0; i < 3; i++){ K.box('steel', 0.08, 1.1, 0.02, -0.5 + i * 0.5, 1.1, 0.1, -0.12); K.box('gold', 0.3, 0.05, 0.06, -0.5 + i * 0.5, 1.68, 0.03, -0.12); } K.pop();
  SCOL.push({ t: 'c', x: 4.6, z: 37.2, r: 1.0 });
  for (const [x, z] of [[-6, 35.5], [-5.2, 34.8], [-6.6, 34.6]]){ K.box('crate', 0.7, 0.7, 0.7, x, 0.35, z, 0, R(), 0); } K.box('crate', 0.55, 0.55, 0.55, -5.9, 0.98, 35.1, 0, 0.4, 0); SCOL.push({ t: 'c', x: -5.9, z: 35, r: 1.1 });
  K.geo('woodD', new THREE.CylinderGeometry(0.07, 0.08, 6, 6), -2.5, 3, 47.5); SCOL.push({ t: 'c', x: -2.5, z: 47.5, r: 0.3 });
  const lanterns = [[-9, 38], [9, 38], [-8.5, 47], [8.5, 46]];
  for (const [x, z] of lanterns){ K.geo('woodD', new THREE.CylinderGeometry(0.06, 0.08, 2.6, 6), x, 1.3, z); K.box('woodD', 0.5, 0.06, 0.06, x + 0.2, 2.55, z); K.box('lamp', 0.22, 0.3, 0.22, x + 0.42, 2.3, z); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.glowTW, color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 })); gl.scale.set(2.2, 2.2, 1); gl.position.set(x + 0.42, 2.3, z); SW.add(gl); SCOL.push({ t: 'c', x, z, r: 0.25 }); }
  // 도착 룬진
  const ar = new THREE.Mesh(polarRing(1.6, 2.2, 64), ADDM(G.tex(G.runeStrip(1024, 128, 12, '#7ff3ff', 0, 9), true, 1, 1), 0.95)); ar.position.set(ARRIVE.x, 0.05, ARRIVE.z); SW.add(ar);
  const ar2 = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.42, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9ff6ff, toneMapped: false, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); ar2.position.set(ARRIVE.x, 0.06, ARRIVE.z); SW.add(ar2);
  FX.arriveRing = ar;
  // 모닥불 불꽃 + 반딧불
  G.particles(48, [new V3(FP.x, 0.25, FP.z)], { parent: SW,
    vert: `float life = fract(uTime * (0.9 + 0.5 * fract(aSeed * 7.13)) + aSeed); vL = life; vS = aSeed;
      float an = aSeed * 81.0, rad = (0.32 * (1.0 - life) + 0.04) * fract(aSeed * 3.7);
      vec3 p = position + vec3(cos(an) * rad + sin(uTime * 3.0 + aSeed * 20.0) * 0.08 * life, life * 1.5, sin(an) * rad);
      float sz = 0.7 * (1.0 - life * 0.65);`,
    frag: `float a = smoothstep(0.5, 0.0, d) * (1.0 - vL) * smoothstep(0.0, 0.08, vL); vec3 c = mix(vec3(1.0, 0.85, 0.45), vec3(1.0, 0.28, 0.04), smoothstep(0.05, 0.55, vL)); gl_FragColor = vec4(c * a * 1.6, a);` });
  const ffb = []; for (let i = 0; i < 160; i++){ const sh = SHAPES[(R() * SHAPES.length) | 0]; const p = sh.c ? new V3(sh.c[0] + rr(-1, 1) * sh.c[2] * 0.8, rr(0.4, 3), sh.c[1] + rr(-1, 1) * sh.c[2] * 0.8) : new V3(sh.s[0] + (sh.s[2] - sh.s[0]) * R() + rr(-4, 4), rr(0.4, 3), sh.s[1] + (sh.s[3] - sh.s[1]) * R() + rr(-4, 4)); ffb.push(p); }
  G.particles(160, ffb, { parent: SW,
    vert: `vec3 p = position + vec3(sin(uTime * 0.5 + aSeed * 50.0) * 1.5, sin(uTime * 0.8 + aSeed * 31.0) * 0.6, cos(uTime * 0.4 + aSeed * 70.0) * 1.5); vL = 0.5 + 0.5 * sin(uTime * (1.5 + fract(aSeed * 4.0) * 2.0) + aSeed * 90.0); vS = aSeed; float sz = 0.1;`,
    frag: `float a = smoothstep(0.5, 0.0, d) * pow(vL, 2.0); gl_FragColor = vec4(vec3(0.75, 1.0, 0.45) * a * 1.6, a);` });
  campLight = new THREE.PointLight(0xff8a3a, 18, 16, 1.6); campLight.position.set(FP.x, 1.3, FP.z); SW.add(campLight);
  const fg = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.glowTW, color: 0xff9a40, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); fg.scale.set(4, 4, 1); fg.position.set(FP.x, 0.9, FP.z); SW.add(fg);
  // 숲 (침엽수) + 바위 + 덤불
  const pine = (() => { const parts = []; for (const [r, h, y] of [[1.9, 3.0, 2.4], [1.5, 2.7, 3.9], [1.05, 2.3, 5.3], [0.6, 1.6, 6.5]]){ const c = new THREE.ConeGeometry(r, h, 8); c.translate(0, y, 0); parts.push(c); } return G.mergeGeos(parts); })();
  const trunk = new THREE.CylinderGeometry(0.17, 0.26, 2.2, 6); trunk.translate(0, 1.1, 0);
  const pos = [];
  for (let t = 0; t < 9000 && pos.length < 520; t++){
    const x = rr(-120, 120), z = rr(-120, 140), od = outDist(x, z);
    if (od < 2.4) continue;
    if (od > 40 && R() < 0.55) continue;
    pos.push([x, z, rr(0.8, 1.6) * (od < 8 ? rr(0.9, 1.15) : 1)]);
  }
  const pm = new THREE.InstancedMesh(pine, G.std({ color: 0x2b4528, roughness: 0.9, flatShading: true }), pos.length);
  const tm = new THREE.InstancedMesh(trunk, G.std({ color: 0x4a3626, roughness: 0.95 }), pos.length);
  pos.forEach((p, i) => { const s = p[2]; pm.setMatrixAt(i, G.mat(p[0], 0, p[1], 0, R() * TAU, 0, s, s * rr(0.9, 1.2), s)); tm.setMatrixAt(i, G.mat(p[0], 0, p[1], 0, 0, 0, s, s, s)); });
  for (const im of [pm, tm]){ im.castShadow = true; im.receiveShadow = true; SW.add(im); }
  for (let i = 0; i < 70; i++){
    let x, z, od; do { x = rr(-60, 60); z = rr(-50, 65); od = outDist(x, z); } while (od < 0.6 || od > 8);
    if (R() < 0.5) K.geo('rock', new THREE.IcosahedronGeometry(rr(0.3, 1.1), 0), x, 0.1, z, R(), R(), R(), 1, rr(0.5, 0.9), 1);
    else K.geo('leaf', new THREE.IcosahedronGeometry(rr(0.4, 0.8), 1), x, 0.3, z, 0, R() * 3, 0, 1.3, 0.75, 1.3);
  }
  B.build(mats, SW);
  // 미니맵
  const sm = G.cnv(512), x = sm.getContext('2d'), k = 256 / 70, C = 256;
  x.fillStyle = '#16231a'; x.fillRect(0, 0, 512, 512);
  x.fillStyle = '#21331f'; for (const p of pos){ if (Math.abs(p[0]) < 75 && Math.abs(p[1]) < 75){ x.beginPath(); x.arc(C + p[0] * k, C + p[1] * k, 3.2 * p[2], 0, TAU); x.fill(); } }
  x.strokeStyle = '#6a563f'; x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = 4.6 * k; x.beginPath(); [[0, 52], ...PATH, [0, -20]].forEach((p, i) => i ? x.lineTo(C + p[0] * k, C + p[1] * k) : x.moveTo(C + p[0] * k, C + p[1] * k)); x.stroke();
  x.fillStyle = '#6a563f'; x.beginPath(); x.arc(C + CAMP.x * k, C + CAMP.z * k, 9.5 * k, 0, TAU); x.fill();
  x.fillStyle = '#7a9a5a'; x.beginPath(); x.arc(C - 3 * k, C + 9 * k, 11 * k, 0, TAU); x.fill();
  x.fillStyle = '#8f8a7e'; x.beginPath(); x.arc(C + SANC.x * k, C + SANC.z * k, 16.6 * k, 0, TAU); x.fill();
  x.strokeStyle = '#3fe6ff'; x.lineWidth = 2; x.beginPath(); x.arc(C + SANC.x * k, C + SANC.z * k, 14 * k, 0, TAU); x.stroke();
  x.fillStyle = '#7ff3ff'; x.beginPath(); x.arc(C + SANC.x * k, C + SANC.z * k, 4 * k, 0, TAU); x.fill();
  x.fillStyle = '#c99a5a'; for (const [tx, tz] of [[-6.2, 43.5], [6.4, 45]]){ x.beginPath(); x.arc(C + tx * k, C + tz * k, 2.3 * k, 0, TAU); x.fill(); }
  x.fillStyle = '#ff9a40'; x.beginPath(); x.arc(C + FP.x * k, C + FP.z * k, 3, 0, TAU); x.fill();
  x.strokeStyle = '#9ff6ff'; x.lineWidth = 2; x.beginPath(); x.arc(C + ARRIVE.x * k, C + ARRIVE.z * k, 2.3 * k, 0, TAU); x.stroke();
  G.addArea('story', { group: SW, col: SCOL, interact: SINT, ground: () => 0.04, bound: p => (curBound || storyBound)(p), mapBase: sm, mapR: 70 });
  G.resize();
}


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
  _c.set(color);
  for (let k = 0; k < n; k++){
    if (PL.length >= PN) PL.shift();
    const a = R() * TAU, e = rr(-0.3, 1), s = sp * rr(0.3, 1);
    PL.push({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s + up * rr(0.5, 1), vz: Math.sin(a) * Math.cos(e) * s, life: life * rr(0.6, 1.2), t: 0, size: size * rr(0.6, 1.3), r: _c.r, g: _c.g, b: _c.b, grav });
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
function toScreen(v){ _p.copy(v).project(G.camera); return { x: (_p.x * 0.5 + 0.5) * innerWidth, y: (-_p.y * 0.5 + 0.5) * innerHeight, vis: _p.z < 1 && _p.z > -1 }; }
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
  m.position.set(player.pos.x, player.pos.y + y, player.pos.z); m.rotation.set(0, ry, 0); m.rotateZ(tilt); SW.add(m);
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
  if (sword) return;
  sword = makeSword(); sword.position.set(0, -0.36, 0.02); sword.rotation.x = Math.PI / 2; fig.elR.add(sword);
  document.body.classList.add('combat');
  $('keys').innerHTML = '<b>WASD</b> 이동 &nbsp; <b>J</b>/클릭 공격 &nbsp; <b>K</b>/우클릭 구르기 &nbsp; <b>R</b> 룬 마법 &nbsp; <b>C</b> 스탯 &nbsp; <b>E</b> 대화 &nbsp; <b>Space</b> 점프';
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
  const tgt = new V3(player.pos.x, player.pos.y + 1.1, player.pos.z);
  for (let i = XPO.length - 1; i >= 0; i--){
    const o = XPO[i]; o.t += dt;
    if (o.t < 0.45){ o.v.y -= 12 * dt; o.s.position.addScaledVector(o.v, dt); if (o.s.position.y < 0.3){ o.s.position.y = 0.3; o.v.y *= -0.4; } }
    else { const dir = tgt.clone().sub(o.s.position), d = dir.length(); o.s.position.addScaledVector(dir.normalize(), Math.min(d, (6 + o.t * 14) * dt)); if (d < 0.35){ SW.remove(o.s); XPO.splice(i, 1); gainExp(o.val); } }
  }
}
let expAcc = 0, expT = 0;
function gainExp(v){
  S.exp += v; expAcc += v; expT = 0.25;
  while (S.exp >= need(S.lv)){ S.exp -= need(S.lv); S.lv++; S.pts += 3; levelUp(); }
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
function face(g, y, z, s = 1, spread = 0.12, blush = true){
  for (const sx of [-1, 1]){
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 12, 8), EYE_M); e.position.set(sx * spread * s, y, z); e.scale.set(1, 1.25, 0.6); g.add(e);
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
const MON = {
  slime: { name: '말랑 슬라임', icon: '🟢', mk: () => mkSlime(), hp: 30, dmg: 6, spd: 2.8, rad: 0.5, style: 'hop', range: 2.4, wind: 0.45, exp: 6, top: 1.0 },
  shroom: { name: '버섯돌이', icon: '🍄', mk: () => mkShroom(), hp: 46, dmg: 8, spd: 2.3, rad: 0.5, style: 'lunge', range: 1.7, wind: 0.5, exp: 8, top: 1.1 },
  bee: { name: '윙윙 꿀벌', icon: '🐝', mk: () => mkBee(), hp: 26, dmg: 7, spd: 4.0, rad: 0.45, style: 'dash', range: 5.5, wind: 0.6, exp: 8, fly: 1.3, top: 1.9 },
  boar: { name: '꿀꿀 멧돼지', icon: '🐗', mk: () => mkBoar(), hp: 70, dmg: 11, spd: 2.6, rad: 0.7, style: 'charge', range: 8, wind: 0.8, exp: 12, top: 1.4 },
  sprout: { name: '도토리 묘목', icon: '🌱', mk: () => mkSprout(), hp: 36, dmg: 7, spd: 2.0, rad: 0.45, style: 'ranged', range: 9, wind: 0.6, exp: 9, top: 1.2 },
  golem: { name: '이끼 골렘', icon: '🪨', mk: () => mkGolem(), hp: 150, dmg: 15, spd: 1.5, rad: 0.85, style: 'slam', range: 2.3, wind: 0.9, exp: 20, top: 2.0 },
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
function spawnMon(key, x, z){
  const isBoss = !!BOSS[key], cfg = isBoss ? BOSS[key] : MON[key], m = cfg.mk();
  const mul = battle ? battle.mul : { hp: 1, bhp: 1, dmg: 1, exp: 1 };
  const e = { key, cfg, boss: isBoss, m, g: m.g, pos: m.g.position, hp: cfg.hp * (isBoss ? mul.bhp : mul.hp), dmg: cfg.dmg * mul.dmg, state: 'spawn', st: 0, vel: new V3(), flash: 0, atkCd: rr(0.8, 1.8), ph: R() * 6, fly: cfg.fly || 0, summons: 0, hopT: rr(0.2, 0.8) };
  e.max = e.hp; e.base = m.mats.map(mt => [mt.emissive.clone(), mt.emissiveIntensity]);
  m.g.scale.setScalar(isBoss ? cfg.scale : 1);
  e.pos.set(x, 0, z); e.g.rotation.y = Math.atan2(player.pos.x - x, player.pos.z - z);
  m.body.scale.setScalar(0.01);
  m.g.traverse(o => { if (o.isMesh && o.material !== BLUSH_M) o.castShadow = true; });
  SW.add(m.g);
  e.bar = document.createElement('div'); e.bar.className = 'e'; e.bar.innerHTML = '<i></i>'; e.bar.style.display = 'none'; ehp.appendChild(e.bar);
  burst(new V3(x, 0.4, z), 0x7ad84a, 16, 3, 0.25, 0.8, -3, 2); burst(new V3(x, 0.5, z), 0xffe07a, 6, 2, 0.15, 0.7, -2, 2);
  ENEMIES.push(e); return e;
}
function hitEnemy(e, dmg, dx, dz, kb, crit){
  if (e.state === 'dying' || e.state === 'spawn' || e.state === 'intro') return false;
  e.hp -= dmg; e.flash = 1;
  const tp = e.pos.clone(); tp.y = e.boss ? e.cfg.top : e.cfg.top + 0.3;
  dmgNum(tp, Math.round(dmg) + (crit ? '!' : ''), crit ? 'crit' : '');
  burst(new V3(e.pos.x, (e.boss ? e.cfg.top * 0.45 : 0.6) + (e.boss ? 0 : e.fly), e.pos.z), crit ? 0xffe08a : 0xffffff, crit ? 14 : 8, 4, 0.16, 0.4, -6, 1);
  const k = e.boss ? 0.05 : e.key === 'golem' ? 0.3 : 1;
  e.vel.x += dx * kb * k; e.vel.z += dz * kb * k;
  if (!e.boss && e.key !== 'golem' && !['charge', 'dash', 'leap'].includes(e.state)){ e.state = 'stagger'; e.st = 0; e.hop = null; }
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
    dropOrbs(e.pos, Math.round(e.cfg.exp * (battle ? battle.mul.exp : 1)));
  }
  if (battle) battle.kills = (battle.kills || 0) + 1;
  if (e.boss){ for (const o of ENEMIES) if (o !== e) killEnemy(o); bossEl.classList.remove('on'); G.shake = 1.2; G.hitStop = 0.25; if (battle) later(1.0, () => win()); }
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
function shootLine(x, y, z, ang, speed, dmg, life, kind){
  const mesh = kind === 'acorn' ? mkAcorn() : mkSting(); if (kind === 'acorn') mesh.scale.setScalar(1.6);
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
      if (Math.hypot(player.pos.x - o.mesh.position.x, player.pos.z - o.mesh.position.z) < 0.6 && Math.abs(player.pos.y + 1 - o.mesh.position.y) < 1.3){ hurtPlayer(o.dmg, o.mesh.position, 3); done = true; burst(o.mesh.position, 0xffd060, 8, 2, 0.15, 0.4); }
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
  m.mats.forEach((mt, i) => { const [c, k] = e.base[i]; mt.emissive.copy(c).lerp(new THREE.Color(1, 1, 1), e.flash); mt.emissiveIntensity = k + e.flash * 1.2; });
}
function updateMon(e, dt, d, dx, dz, face){
  const c = e.cfg; let moving = false;
  if (e.state === 'chase'){
    e.atkCd -= dt;
    if (c.style === 'ranged'){
      turn(e, face, dt * 6);
      const want = d < 5 ? -1 : d > 7.5 ? 1 : 0;
      if (want){ e.pos.x += dx / d * c.spd * want * dt; e.pos.z += dz / d * c.spd * want * dt; moving = true; }
      if (e.atkCd <= 0 && d < 11 && !dead){ e.state = 'wind'; e.st = 0; }
    } else if (c.style === 'hop'){
      if (e.hop){ e.hop.t += dt; const k = Math.min(1, e.hop.t / e.hop.T); e.pos.x = e.hop.fx + (e.hop.tx - e.hop.fx) * k; e.pos.z = e.hop.fz + (e.hop.tz - e.hop.fz) * k; e.pos.y = Math.sin(k * Math.PI) * 0.6; if (k >= 1){ e.hop = null; e.pos.y = 0; e.hopT = rr(0.25, 0.6); } }
      else { e.hopT -= dt; turn(e, face, dt * 8);
        if (d < c.range && e.atkCd <= 0 && !dead){ e.state = 'wind'; e.st = 0; }
        else if (e.hopT <= 0 && d > 1.2){ const s = Math.min(d - 1.0, 1.7); e.hop = { t: 0, T: 0.42, fx: e.pos.x, fz: e.pos.z, tx: e.pos.x + dx / d * s, tz: e.pos.z + dz / d * s }; } }
    } else {
      turn(e, face, dt * 6);
      if (d > c.range * 0.8){ const sp = c.spd; e.pos.x += dx / d * sp * dt; e.pos.z += dz / d * sp * dt; moving = true; }
      if (d < c.range && e.atkCd <= 0 && !dead){ e.state = 'wind'; e.st = 0; if (c.style === 'charge'){ e.dir = face; e.tele = teleRect(e.pos.x, e.pos.z, 1.4, 9, face); } }
    }
  } else if (e.state === 'wind'){
    const k = Math.min(1, e.st / c.wind);
    if (c.style === 'charge'){ if (k < 0.65){ turn(e, face, dt * 4); e.dir = e.g.rotation.y; } e.tele.position.set(e.pos.x, 0.09, e.pos.z); e.tele.rotation.y = e.dir; teleUpd(e.tele, k, dt); }
    else turn(e, face, dt * 3);
    if (e.st >= c.wind){
      e.st = 0; e.hitDone = false;
      if (c.style === 'hop'){ e.state = 'leap'; const s = Math.min(d, 3); e.L = { fx: e.pos.x, fz: e.pos.z, tx: e.pos.x + dx / (d || 1) * s, tz: e.pos.z + dz / (d || 1) * s }; }
      else if (c.style === 'lunge'){ e.state = 'lunge'; e.dir = e.g.rotation.y; }
      else if (c.style === 'dash'){ e.state = 'dash'; e.dir = e.g.rotation.y; sfx('buzz'); }
      else if (c.style === 'charge'){ e.state = 'charge'; rmTele(e); sfx('stomp'); }
      else if (c.style === 'ranged'){ e.state = 'recover'; throwArc(new V3(e.pos.x, 1.0, e.pos.z), new V3(player.pos.x + rr(-0.6, 0.6), 0.1, player.pos.z + rr(-0.6, 0.6)), 1.0, e.dmg, 0.9); sfx('throw'); }
      else if (c.style === 'slam'){ e.state = 'recover'; const fx = e.pos.x + Math.sin(e.g.rotation.y) * 1.3, fz = e.pos.z + Math.cos(e.g.rotation.y) * 1.3; shockwave(fx, 0.12, fz, 2.4, 0x9acc6a, 0.4); burst(new V3(fx, 0.2, fz), 0x8a8a7a, 16, 4, 0.22, 0.6, -8, 2); G.shake = Math.max(G.shake, 0.5); sfx('stomp'); if (Math.hypot(player.pos.x - fx, player.pos.z - fz) < 2.3) hurtPlayer(e.dmg, new V3(fx, 0, fz), 7); }
    }
  } else if (e.state === 'leap'){
    const k = Math.min(1, e.st / 0.5); e.pos.x = e.L.fx + (e.L.tx - e.L.fx) * k; e.pos.z = e.L.fz + (e.L.tz - e.L.fz) * k; e.pos.y = Math.sin(k * Math.PI) * 1.3;
    if (k >= 1){ e.pos.y = 0; e.state = 'recover'; e.st = 0; burst(new V3(e.pos.x, 0.2, e.pos.z), 0x8aff7a, 10, 2.5, 0.2, 0.5, -6, 1); if (Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z) < 1.35) hurtPlayer(e.dmg, e.pos, 5); }
  } else if (e.state === 'lunge' || e.state === 'dash' || e.state === 'charge'){
    const sp = e.state === 'lunge' ? 7 : e.state === 'dash' ? 13 : 12, T = e.state === 'lunge' ? 0.28 : e.state === 'dash' ? 0.42 : 0.8;
    e.pos.x += Math.sin(e.dir) * sp * dt; e.pos.z += Math.cos(e.dir) * sp * dt; moving = true; contact(e);
    if (e.st >= T){ e.state = 'recover'; e.st = 0; }
  } else if (e.state === 'recover'){
    if (e.st > (c.style === 'charge' ? 0.9 : 0.6)){ e.state = 'chase'; e.atkCd = rr(0.9, 2.0); }
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
function arenaClamp(p, m = 1){ if (!battle) return p; const ar = battle.ar, dx = p.x - ar.c.x, dz = p.z - ar.c.z, d = Math.hypot(dx, dz), R0 = ar.r - m; if (d > R0){ p.x = ar.c.x + dx / d * R0; p.z = ar.c.z + dz / d * R0; } return p; }
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
        for (let i = 0; i < n; i++){ const a = e.g.rotation.y + Math.PI + (i - (n - 1) / 2) * 0.9, p = arenaClamp(new V3(e.pos.x + Math.sin(a) * (c.rad + 2), 0, e.pos.z + Math.cos(a) * (c.rad + 2)), 1); spawnMon(kind, p.x, p.z); } }
      if (A.t > 1.3) end(1.0);
      break;
    }
  }
  return moving;
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
    if (e.state === 'spawn'){ if (e.st > 0.55){ e.state = e.boss ? 'chase' : 'chase'; } }
    else if (e.state === 'intro'){ turn(e, face, dt * 2); }
    else if (e.boss) moving = updateBoss(e, dt, d, dx, dz, face);
    else moving = updateMon(e, dt, d, dx, dz, face);
    animMon(e, dt, moving);
    e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt; e.vel.multiplyScalar(Math.exp(-7 * dt));
    if (e.state !== 'spawn'){ G.collide(e.pos, e.cfg.rad * 0.9); arenaClamp(e.pos, e.cfg.rad * 0.6); }
    const hov = e.fly ? e.fly + Math.sin(G.time * 2 + e.ph) * 0.12 : 0;
    if (e.fly) e.pos.y = hov + (e.boss && e.atk && e.atk.type === 'charge' && e.atk.phase === 1 ? -1.2 : 0);
  }
  for (let i = 0; i < alive.length; i++){
    const a = alive[i];
    for (let j = i + 1; j < alive.length; j++){ const b = alive[j], dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.cfg.rad + b.cfg.rad; if (d < m && d > 1e-4){ const k = (m - d) / 2 / d; if (!a.boss){ a.pos.x -= dx * k; a.pos.z -= dz * k; } if (!b.boss){ b.pos.x += dx * k; b.pos.z += dz * k; } } }
    if (a.fly && !a.boss) continue;
    const dx = player.pos.x - a.pos.x, dz = player.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.cfg.rad + 0.36;
    if (d < m && d > 1e-4 && !roll){ player.pos.x = a.pos.x + dx / d * m; player.pos.z = a.pos.z + dz / d * m; }
  }
  G.mapEnemies = alive.map(e => ({ x: e.pos.x, z: e.pos.z, big: e.boss }));
  for (const e of alive){
    if (e.boss){ bossEl.querySelector('i').style.width = (e.hp / e.max * 100) + '%'; bossEl.querySelector('s').style.width = (e.hp / e.max * 100) + '%'; continue; }
    if (e.hp >= e.max){ e.bar.style.display = 'none'; continue; }
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
  if (!S.sword || G.lock || dead || roll || cast) return;
  if (atk && atk.t < atk.dur * 0.6){ atk.queued = true; return; }
  const i = atk && atk.t < atk.dur + 0.4 ? (atk.i + 1) % 3 : 0;
  const d = D(), c = COMBO[i];
  atk = { i, t: 0, dur: c.dur / d.aspd, hit: false, queued: false, ry: fig.root.rotation.y };
  const tg = nearestEnemy(4.5); if (tg) atk.ry = Math.atan2(tg.pos.x - player.pos.x, tg.pos.z - player.pos.z);
  fig.root.rotation.y = atk.ry; sfx('swing');
}
function doRoll(){
  if (!S.sword || G.lock || dead || roll || rollCd > 0 || !player.ground) return;
  let dir = fig.root.rotation.y;
  const k = G.keys; let ix = 0, iz = 0;
  if (k.KeyW || k.ArrowUp) iz += 1; if (k.KeyS || k.ArrowDown) iz -= 1; if (k.KeyA || k.ArrowLeft) ix -= 1; if (k.KeyD || k.ArrowRight) ix += 1;
  if (ix || iz){ const y = G.camYaw, dx = -Math.sin(y) * iz + Math.cos(y) * ix, dz = -Math.cos(y) * iz - Math.sin(y) * ix; dir = Math.atan2(dx, dz); }
  roll = { t: 0, dur: 0.42, dir }; inv = 0.42; rollCd = 0.55; atk = null; fig.root.rotation.y = dir; sfx('roll');
}
function doRune(){
  if (!S.rune || G.lock || dead || cast || roll) return;
  if (runeCd > 0){ hint(`룬 마법 재사용까지 <b>${runeCd.toFixed(1)}</b>초`, 1.2); return; }
  if (mp < 20){ hint('MP가 부족하다', 1.2); return; }
  mp -= 20; runeCd = D().cd; cast = { t: 0, dur: 0.75, fired: false }; atk = null;
}
function hurtPlayer(dmg, from, kb = 5){
  if (inv > 0 || dead || !G.playing) return;
  dmg = Math.round(dmg * rr(0.9, 1.1)); hp -= dmg; inv = 0.55; combatT = 4;
  dmgNum(new V3(player.pos.x, player.pos.y + 2.0, player.pos.z), '-' + dmg, 'me');
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
    if (hitEnemy(e, d.atk * mul * (c ? 1.8 : 1) * rr(0.9, 1.1), dx / (dd || 1), dz / (dd || 1), kb, c)) any = true;
  }
  if (any){ sfx(crit ? 'crit' : 'hit'); G.hitStop = crit ? 0.09 : 0.055; G.shake = Math.max(G.shake, crit ? 0.6 : 0.35); combatT = 4; }
}
function updateCombat(dt){
  const d = D();
  G.speedMul = d.spd; G.moveMul = 1; G.faceLock = false; G.noJump = false; G.poseK = 0;
  runeCd = Math.max(0, runeCd - dt); inv = Math.max(0, inv - dt); rollCd = Math.max(0, rollCd - dt); combatT = Math.max(0, combatT - dt);
  mp = Math.min(d.maxMp, mp + d.mpRegen * dt);
  if (!dead && combatT <= 0 && hp < d.maxHp) hp = Math.min(d.maxHp, hp + d.maxHp * (battle && !battle.ended ? 0.02 : 0.1) * dt);
  // 넉백
  if (knock.lengthSq() > 0.01){ player.pos.x += knock.x * dt; player.pos.z += knock.z * dt; knock.multiplyScalar(Math.exp(-8 * dt)); G.collide(player.pos, 0.36); }
  if (dead){ G.poseMod = () => G.pose({ hy: 0.21, hrx: -Math.PI / 2, laz: 0.6, raz: -0.6, hd: 0.3 }); G.poseK = 6; return; }
  if (atk){
    atk.t += dt; G.moveMul = 0.15; G.faceLock = true; G.noJump = true;
    const c = COMBO[atk.i], k = atk.t / atk.dur;
    if (k < 0.45){ player.pos.x += Math.sin(atk.ry) * 3.2 * dt; player.pos.z += Math.cos(atk.ry) * 3.2 * dt; G.collide(player.pos, 0.36); }
    if (atk.i === 2) fig.root.rotation.y = atk.ry + ease(Math.min(1, k * 1.15)) * TAU;
    if (!atk.hit && k >= (atk.i === 2 ? 0.35 : 0.42)){
      atk.hit = true;
      trail(atk.i === 2 ? atk.ry : atk.ry, 1.05, atk.i === 0 ? 0.25 : atk.i === 1 ? -0.25 : 0, atk.i === 2);
      hitSweep(c.range, atk.i === 2 ? Math.PI : 1.25, c.mul, atk.i === 2 ? 9 : 5);
    }
    if (atk.t >= atk.dur){ const q = atk.queued; if (q){ atk.t = atk.dur; attack(); } else if (atk.t > atk.dur + 0.4) atk = null; }
  }
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
      if (sword) sword.userData.glow.color.set(0xffffff);
      for (const e of ENEMIES){
        if (e.state === 'dying' || e.state === 'spawn') continue;
        const dx = e.pos.x - player.pos.x, dz = e.pos.z - player.pos.z, dd = Math.hypot(dx, dz);
        if (dd < 6 + e.cfg.rad){ const c = R() < d.crit; hitEnemy(e, d.rune * (c ? 1.8 : 1) * rr(0.95, 1.1), dx / (dd || 1), dz / (dd || 1), 14, c); }
      }
      combatT = 4;
    }
    if (k >= 1){ cast = null; if (sword) sword.userData.glow.color.set(0x8ff4ff); }
  }
  // 포즈 덮어쓰기
  G.poseMod = (tp) => {
    if (cast){
      const k = cast.t / cast.dur;
      if (k < 0.5){ const u = ease(k / 0.5); return G.pose({ lax: -2.9 * u, rax: -2.9 * u, le: -0.3, re: -0.3, sp: -0.3 * u, hd: -0.4 * u, llx: -0.2, rlx: 0.2 }); }
      const u = ease(Math.min(1, (k - 0.5) / 0.2)); return G.pose({ lax: -2.9 + 2.0 * u, rax: -2.9 + 2.0 * u, sp: 0.7 * u, hy: 0.86 - 0.3 * u, lk: 0.9 * u, rk: 0.9 * u, llx: -0.7 * u, rlx: 0.3 * u, hd: 0.2 });
    }
    if (roll){ const k = roll.t / roll.dur; G.poseK = 30; return G.pose({ hrx: ease(k) * TAU, hy: 0.86 - Math.sin(k * Math.PI) * 0.45, llx: -2.2, rlx: -2.2, lk: 2.4, rk: 2.4, lax: -1.4, rax: -1.4, le: -1.4, re: -1.4, sp: 0.6, hd: 0.5 }); }
    if (atk){
      const k = Math.min(1, atk.t / atk.dur), u = ease(Math.min(1, k / 0.55)); G.poseK = 28;
      if (atk.i === 0) return G.pose({ rax: -1.5 - 0.5 * (1 - u), raz: -1.5 + 2.2 * u, re: -0.25, lax: -0.4, laz: 0.4, sp: 0.15, llx: -0.5, rlx: 0.3, lk: 0.3, hd: 0.1 });
      if (atk.i === 1) return G.pose({ rax: -1.3, raz: 0.8 - 2.4 * u, re: -0.2, lax: -0.2, laz: 0.5, sp: 0.2, llx: 0.3, rlx: -0.5, rk: 0.3, hd: 0.1 });
      return G.pose({ rax: -1.4, raz: -1.55, re: 0, lax: -0.2, laz: 1.4, sp: 0.25, hy: 0.74, lk: 0.6, rk: 0.6, llx: -0.4, rlx: 0.3, llz: 0.3, rlz: -0.3 });
    }
    if (sword && !G.lock){ tp.rax += -0.35; tp.re += -0.55; }
    return tp;
  };
  fig.mesh.visible = !(inv > 0 && inv < 0.5 && !roll && Math.floor(inv * 20) % 2);
}


// ───────────────────────── 스테이지 ─────────────────────────
const DIFF = {
  e: { n: '이지', hp: 1, bhp: 1, dmg: 1, rew: 1, rec: 1 },
  m: { n: '미디엄', hp: 1.9, bhp: 1.8, dmg: 1.55, rew: 1.8, rec: 1.55 },
  h: { n: '하드', hp: 3.2, bhp: 3.0, dmg: 2.2, rew: 3, rec: 2.3 },
};
const ARENAS = {
  A: { c: new V3(0, 0, 40), r: 11.3, entry: new V3(0.5, 0.04, 46.6), name: '숲 입구 야영지' },
  B: { c: new V3(-3, 0, 9), r: 10.8, entry: new V3(1.5, 0.04, 17.6), name: '도토리 공터' },
  C: { c: new V3(0, 0, -22), r: 16, entry: new V3(0, 0.04, -8.2), name: '고목의 성소' },
};
const STAGES = [
  { name: '숲의 입구', ar: 'A', desc: '엘드라에게 검을 받고 말랑한 슬라임들로 몸을 풀자. 끝에는 커다란 왕슬라임이 기다린다.', waves: [[['slime', 3]]], boss: 'kingSlime', tut: true },
  { name: '말랑말랑 풀밭', ar: 'A', desc: '풀밭 여기저기서 슬라임이 통통 튀어 오른다.', waves: [[['slime', 4]], [['slime', 6]]] },
  { name: '버섯 오솔길', ar: 'A', desc: '비 온 뒤 쑥쑥 자란 버섯돌이들이 길을 막는다.', waves: [[['slime', 3], ['shroom', 2]], [['shroom', 4]]] },
  { name: '꿀벌 소동', ar: 'A', desc: '야영지 꿀단지를 노리는 꿀벌들! 직선으로 돌진하니 옆으로 피하자.', waves: [[['bee', 3]], [['bee', 3], ['slime', 3]]] },
  { name: '포자 가득한 공터', ar: 'A', desc: '버섯 대장 「포자왕」이 자기 왕국을 선포했다.', waves: [[['shroom', 5]]], boss: 'chief' },
  { name: '도토리 언덕', ar: 'B', desc: '묘목 정령들이 도토리를 던진다. 떨어지는 곳의 붉은 원을 피하자.', waves: [[['sprout', 3], ['slime', 3]], [['shroom', 3], ['sprout', 2]]] },
  { name: '멧돼지 발자국', ar: 'B', desc: '꿀꿀 멧돼지는 붉은 길을 따라 똑바로 돌진한다.', waves: [[['boar', 2], ['slime', 3]], [['boar', 3]]] },
  { name: '윙윙 꽃밭', ar: 'B', desc: '꽃가루를 잔뜩 묻힌 꿀벌 떼가 몰려온다.', waves: [[['bee', 5]], [['bee', 3], ['sprout', 3]]] },
  { name: '이끼 바위길', ar: 'B', desc: '느릿느릿, 하지만 묵직한 이끼 골렘이 깨어났다.', waves: [[['golem', 1], ['shroom', 4]], [['golem', 2], ['slime', 4]]] },
  { name: '여왕벌의 정원', ar: 'B', desc: '꿀단지 여왕이 정원을 지키고 있다. 날아다니며 침을 쏜다!', waves: [[['bee', 6]]], boss: 'queen' },
  { name: '개울가 소풍', ar: 'B', desc: '시원한 개울가에도 장난꾸러기들이 가득.', waves: [[['slime', 5], ['boar', 2]], [['sprout', 4], ['bee', 3]]] },
  { name: '작은 정령들', ar: 'B', desc: '숲의 정령들이 한꺼번에 시험을 걸어온다.', waves: [[['sprout', 5]], [['sprout', 3], ['golem', 1], ['shroom', 3]]] },
  { name: '들쭉날쭉 숲길', ar: 'B', desc: '돌진, 돌진, 또 돌진! 정신 바짝 차리자.', waves: [[['boar', 4]], [['bee', 4], ['boar', 2]], [['golem', 2]]] },
  { name: '선돌의 그늘', ar: 'C', desc: '오래된 선돌 사이로 숲의 주민들이 모여든다.', waves: [[['shroom', 5], ['sprout', 3]], [['golem', 2], ['bee', 4]]] },
  { name: '엄니왕의 돌진', ar: 'C', desc: '숲에서 가장 힘센 멧돼지, 「쿵쾅 엄니왕」. 세 번 연속 돌진을 조심!', waves: [[['boar', 5]]], boss: 'tusk' },
  { name: '고목의 뿌리', ar: 'C', desc: '땅속 뿌리가 꿈틀댄다. 성소 깊은 곳이 가까워졌다.', waves: [[['sprout', 6]], [['golem', 2], ['boar', 2], ['slime', 4]]] },
  { name: '반딧불 성소', ar: 'C', desc: '반딧불이 춤추는 성소. 하지만 방심은 금물.', waves: [[['bee', 6], ['shroom', 3]], [['golem', 3]]] },
  { name: '숲의 시련', ar: 'C', desc: '숲이 마지막 시험을 준비했다. 세 번의 습격을 버텨라.', waves: [[['slime', 6], ['boar', 2]], [['sprout', 4], ['bee', 4]], [['golem', 2], ['shroom', 4]]] },
  { name: '고요한 숲의 전야', ar: 'C', desc: '고목이 깨어나기 직전, 숲 전체가 술렁인다.', waves: [[['boar', 4], ['bee', 4]], [['golem', 3], ['sprout', 3]], [['shroom', 6], ['boar', 3]]] },
  { name: '천년 고목', ar: 'C', desc: '성소의 주인, 천년 고목 「그루터기 할배」가 깨어났다. 뿌리와 도토리 폭격을 피하며 맞서라!', waves: [[['sprout', 4], ['golem', 1]]], boss: 'treant' },
];
const fmt = n => Math.round(n).toLocaleString();
const recPower = (n, d) => Math.round((330 + (n - 1) * 55) * DIFF[d].rec / 10) * 10;
function power(){ const d = D(); return Math.round(d.atk * 12 + d.maxHp * 1.3 + (S.rune ? d.rune * 2 : 0) + d.crit * 800 + (d.aspd - 1) * 500 + (d.spd - 1) * 400); }
const stars = (n, d) => ((S.clr || {})[n] || {})[d] || 0;
const unlocked = (n, d) => d === 'e' ? (n === 1 || stars(n - 1, 'e') > 0) : stars(n, 'e') > 0;
const chapterPct = d => { let s = 0; for (let n = 1; n <= 20; n++) s += stars(n, d); return Math.round(s / 60 * 100); };
const rewardOf = (n, d) => { const b = STAGES[n - 1].boss ? 2 : 1, r = DIFF[d].rew; return { exp: Math.round((30 + n * 12) * b * r), gold: Math.round((80 + n * 25) * b * r) }; };
const parTime = st => 35 + st.waves.length * 25 + (st.boss ? 70 : 0);

let battle = null, curBound = null;
function arenaBound(ar){ return p => { const dx = p.x - ar.c.x, dz = p.z - ar.c.z, d = Math.hypot(dx, dz), R0 = ar.r - 0.4; if (d > R0){ p.x = ar.c.x + dx / d * R0; p.z = ar.c.z + dz / d * R0; } }; }
function spawnPoint(ar){
  const pa = Math.atan2(player.pos.z - ar.c.z, player.pos.x - ar.c.x);
  for (let k = 0; k < 20; k++){ const a = R() * TAU; if (Math.abs(angDiff(a, pa)) < 1.1 && k < 15) continue; const r = ar.r - rr(1.2, 2.5); const p = new V3(ar.c.x + Math.cos(a) * r, 0, ar.c.z + Math.sin(a) * r); G.collide(p, 0.6); return p; }
  return ar.c.clone();
}
async function startStage(n, d){
  if (tpBusy) return;
  closeMap(); resEl.classList.remove('on');
  const st = STAGES[n - 1], ar = ARENAS[st.ar];
  await teleport(`1-${n} ${st.name}`, `${DIFF[d].n} · STAGE 1-${n}`, () => {
    enterForest(); cleanupBattle();
    player.pos.copy(ar.entry); player.vy = 0;
    const fx = ar.c.x - ar.entry.x, fz = ar.c.z - ar.entry.z; player.fig.root.rotation.y = Math.atan2(fx, fz); G.setCam(Math.atan2(-fx, -fz), 0.32, 8);
    const dd = D(); hp = dd.maxHp; mp = dd.maxMp; refreshHud();
    const sm = 1 + (n - 1) * 0.11;
    battle = { n, d, st, ar, wi: -1, t: 0, q: [], kills: 0, ended: false, boss: null, waitNext: false,
      mul: { hp: sm * DIFF[d].hp, bhp: DIFF[d].bhp, dmg: (1 + (n - 1) * 0.07) * DIFF[d].dmg, exp: (1 + (n - 1) * 0.08) * DIFF[d].rew } };
    curBound = arenaBound(ar);
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
    let k = 0;
    for (const [type, c] of st.waves[battle.wi]) for (let i = 0; i < c; i++) battle.q.push({ type, t: battle.t + 0.4 + (k++) * 0.4 });
  } else if (st.boss && !battle.boss) bossIntro();
}
async function bossIntro(){
  const c = BOSS[battle.st.boss], ar = battle.ar;
  let dx = ar.c.x - player.pos.x, dz = ar.c.z - player.pos.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  const off = battle.st.ar === 'C' ? 8.5 : ar.r * 0.45, p = new V3(ar.c.x + dx * off, 0, ar.c.z + dz * off);
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
function updateBattle(dt, alive){
  if (!battle || battle.ended) return;
  battle.t += dt;
  for (const q of battle.q){ if (!q.done && battle.t >= q.t){ q.done = true; const p = spawnPoint(battle.ar); spawnMon(q.type, p.x, p.z); } }
  const pend = battle.q.filter(q => !q.done).length, left = pend + alive.length;
  const st = battle.st;
  objEl.querySelector('.p').textContent = battle.boss ? `보스전 · ${DIFF[battle.d].n}` : `${DIFF[battle.d].n} · 웨이브 ${Math.max(1, battle.wi + 1)} / ${st.waves.length} · 남은 몬스터 ${left}`;
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
  sfx('level'); burst(new V3(player.pos.x, 0.5, player.pos.z), 0xffe08a, 60, 4, 0.3, 1.4, 3, 4);
  bossEl.classList.remove('on'); curBound = null; bReturn.textContent = '⟲ 광장으로';
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
  TIMERS.length = 0; G.camOverride = null; atk = roll = cast = null; knock.set(0, 0, 0);
  battle = null; curBound = null; bossEl.classList.remove('on'); G.mapEnemies = []; hint('', 0);
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
    <div class="ds">${st.desc}</div>
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
function enterForest(){
  if (G.area !== 'story'){ G.setArea('story'); }
  inStory = true; G.scene.fog.density = 0.006; G.setNight(0);
  if (S.sword) giveSword(); if (sword) sword.visible = true;
  document.body.classList.toggle('combat', !!S.sword);
}
function leaveForest(){
  teleport('룬의 광장', 'THE RUNE AGORA', () => {
    revive(); cleanupBattle(); closeMap(); resEl.classList.remove('on');
    G.setArea('plaza'); inStory = false;
    player.pos.set(0, 0.04, 9); player.vy = 0; player.fig.root.rotation.y = 0; G.setCam(Math.PI, 0.3);
    G.scene.fog.density = 0.0034; G.setNight(0);
    if (sword) sword.visible = false; document.body.classList.remove('combat');
    $('keys').innerHTML = '<b>W</b><b>A</b><b>S</b><b>D</b> 이동 &nbsp; <b>Shift</b> 달리기 &nbsp; <b>Space</b> 점프 &nbsp; <b>M</b> 월드맵 &nbsp; <b>C</b> 스탯 &nbsp; <b>E</b> 상호작용';
    G.mapEnemies = []; G.mapMarkers = []; clearObj(); bReturn.textContent = '⟲ 광장으로';
    const d = D(); hp = d.maxHp; mp = d.maxMp; refreshHud();
  });
}
async function askReturn(){
  if (dialogOpen || tpBusy) return;
  const inB = battle && !battle.ended;
  const r = await say([['sys', inB ? '전투를 포기하고 광장으로 돌아갈까요? (보상 없음)' : '광장으로 돌아갈까요?', ['돌아간다', '머무른다']]]);
  if (r === 0) leaveForest();
}
NAMES.sys = '귀환의 룬진';
SINT.push({ x: ARRIVE.x, z: ARRIVE.z, r: 2.4, title: '귀환의 룬진 · 광장으로', action: () => askReturn() });
SINT.push({ x: 4.5, z: 51.5, r: 2.6, title: '룬 지기 엘드라', action: async () => { if (battle && !battle.ended) return; await say([['k', '숲의 친구들이 또 장난을 칠지도 모르겠구나. 월드맵에서 가고 싶은 곳을 골라 보거라.']]); openMap('road'); } });
$('mStory').innerHTML = '<span>🗺</span>월드맵';
$('mStory').onclick = () => openMap('world');
$('mMini').onclick = () => G.toast('미니 게임', '곧 열립니다');
$('mStat').onclick = () => toggleStats();
bReturn.onclick = () => askReturn();
const crystalIt = G.INTERACT.find(i => i.title === '룬 크리스탈');
if (crystalIt){ crystalIt.title = '룬 크리스탈 · 월드맵'; crystalIt.r = 6.2; crystalIt.action = () => openMap('world'); }

// ───────────────────────── 입력 ─────────────────────────
G.onKey = (code) => {
  if (dialogOpen){ if (code === 'KeyE' || code === 'Space' || code === 'Enter' || code === 'KeyJ'){ dlgAdvance && dlgAdvance(); return true; } return code !== 'KeyC'; }
  if (code === 'Escape' && spop.classList.contains('on')){ spop.classList.remove('on'); return true; }
  if (code === 'Escape' && wmap.classList.contains('on')){ closeMap(); return true; }
  if (code === 'KeyM'){ if (wmap.classList.contains('on')) closeMap(); else openMap(G.area === 'story' ? 'road' : 'world'); return true; }
  if (code === 'KeyC' || (code === 'Escape' && statOpen)){ toggleStats(); return true; }
  if (G.lock || wmap.classList.contains('on')) return true;
  if (!inStory) return false;
  if (code === 'KeyJ' || code === 'KeyF'){ attack(); return true; }
  if (code === 'KeyK' || code === 'KeyL'){ doRoll(); return true; }
  if (code === 'KeyR' || code === 'KeyQ'){ doRune(); return true; }
  return false;
};
G.onClick = (b) => { if (dialogOpen){ dlgAdvance && dlgAdvance(); return; } if (!inStory) return; if (b === 2) doRoll(); else if (b === 0) attack(); };
const tap = (id, fn) => $(id).addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false });
tap('cAtk', attack); tap('cRoll', doRoll); tap('cRune', doRune);

// ───────────────────────── 메인 업데이트 ─────────────────────────
let smithT = 0, smithT0 = 0;
G.hooks.push((dt, rdt) => {
  for (let i = TIMERS.length - 1; i >= 0; i--){ const t = TIMERS[i]; t.t -= rdt; if (t.t <= 0){ TIMERS.splice(i, 1); t.fn(); } }
  if (inStory){
    updateCombat(dt);
    const alive = updateEnemies(dt);
    updateProj(dt); updateXPO(dt); updateBattle(dt, alive); updateParticles(dt); updateFXL(dt);
    if (battle && !battle.ended && dead) lose();
    // 엘드라 / 제단 / 모닥불
    const kp = keeper.root.position, kd = Math.hypot(player.pos.x - kp.x, player.pos.z - kp.z);
    if (!dialogOpen && kd < 9){ const a = Math.atan2(player.pos.x - kp.x, player.pos.z - kp.z); keeper.root.rotation.y += angDiff(a, keeper.root.rotation.y) * Math.min(1, dt * 2); }
    const kpz = Object.assign({}, KEEPER_POSE); kpz.hy += Math.sin(G.time * 1.6) * 0.006; keeper.set(kpz); keeper.blend(dt, 4);
    const A = altar; A.crys.rotation.y += dt * 0.6; A.g.position.y = 4.3 + Math.sin(G.time * 1.1) * 0.2; for (const r of A.rings) r.piv.rotation.y += dt * r.spd;
    campLight.intensity = 16 + Math.sin(G.time * 13) * 2.5 + Math.sin(G.time * 29) * 1.5;
    FX.arriveRing.rotation.y += dt * 0.3;
  } else {
    G.poseMod = null; G.poseK = 0; G.speedMul = D().spd; G.moveMul = 1; G.faceLock = false; G.noJump = false;
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
  if (hintT > 0){ hintT -= rdt; if (hintT <= 0) hintEl.classList.remove('on'); }
  if (expT > 0){ expT -= rdt; if (expT <= 0 && expAcc > 0){ dmgNum(new V3(player.pos.x, player.pos.y + 2.3, player.pos.z), '+' + Math.round(expAcc) + ' EXP', 'xp'); expAcc = 0; } }
  const d = D();
  hpB.style.width = clamp(hp / d.maxHp * 100, 0, 100) + '%'; mpB.style.width = clamp(mp / d.maxMp * 100, 0, 100) + '%';
  const rb = $('cRune'); rb.classList.toggle('dis', !S.rune); rb.querySelector('i').style.height = (S.rune ? runeCd / d.cd * 100 : 0) + '%';
});

// ───────────────────────── 시작 ─────────────────────────
refreshHud();
const waitStart = setInterval(() => { if (G.playing){ clearInterval(waitStart); setTimeout(() => { if (G.area === 'plaza') hint('오른쪽 <b>🗺 월드맵</b> 버튼(또는 <b>M</b>)으로 모험을 시작하세요', 7); }, 5500); } }, 300);
window.__story = { S, ENEMIES, spawnMon, startStage, openMap, openStage, leaveForest, D, power, get hp(){ return hp; }, get battle(){ return battle; }, STAGES };
}
