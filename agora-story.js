// 룬 아고라 — 스토리 모드 (제 1 장 · 꺼져가는 룬)
// 전투(3연격 · 구르기 · 룬 마법) / 스탯(힘 · 체력 · 민첩 · 지능) / 웨이브 / 보스 / 저장
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
  #smenu { position:fixed; left:50%; top:50%; transform:translate(-50%,-48%) scale(.97); width:min(560px, 94vw); max-height:92vh; overflow:auto; z-index:27; padding:18px 20px 20px;
    background:linear-gradient(180deg, rgba(16,20,34,.97), rgba(7,9,16,.97)); border:1px solid rgba(233,200,126,.55); border-radius:6px; box-shadow:0 0 0 4px rgba(10,14,24,.5), 0 20px 60px rgba(0,0,0,.7); opacity:0; pointer-events:none; transition:opacity .25s, transform .25s; }
  #smenu.on { opacity:1; pointer-events:auto; transform:translate(-50%,-50%) scale(1); }
  #smenu .hd { display:flex; align-items:baseline; gap:10px; border-bottom:1px solid rgba(233,200,126,.25); padding-bottom:10px; margin-bottom:14px; }
  #smenu .hd span { font:700 11px 'Cinzel'; letter-spacing:.4em; color:#7ff3ff; } #smenu .hd b { font:700 19px 'Gowun Batang'; color:#fff3d6; flex:1; }
  #smenu .hd button { background:none; border:none; color:#e9c87e; font-size:20px; cursor:pointer; }
  #smenu .ch { display:flex; gap:14px; padding:12px; border-radius:6px; border:1px solid rgba(233,200,126,.3); background:rgba(255,255,255,.03); margin-bottom:10px; }
  #smenu .ch .art { flex:0 0 120px; height:150px; border-radius:4px; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center;
    background:radial-gradient(circle at 50% 30%, rgba(127,243,255,.5), transparent 45%), linear-gradient(180deg, #2a1f4a, #0f2a26 60%, #0a120e); box-shadow:inset 0 0 30px rgba(0,0,0,.7); }
  #smenu .ch .art::before { content:''; position:absolute; left:50%; top:30%; width:70px; height:70px; margin:-35px 0 0 -35px; border:2px solid rgba(127,243,255,.7); border-radius:50%; animation:spin 9s linear infinite; box-shadow:0 0 16px rgba(127,243,255,.5); }
  #smenu .ch .art::after { content:''; position:absolute; left:0; right:0; bottom:0; height:46%; background:repeating-linear-gradient(90deg, rgba(10,20,14,.95) 0 9px, transparent 9px 16px), linear-gradient(transparent, #050806); clip-path:polygon(0 40%, 8% 10%, 14% 45%, 22% 0, 30% 40%, 40% 15%, 48% 50%, 58% 5%, 66% 42%, 76% 12%, 84% 48%, 92% 8%, 100% 38%, 100% 100%, 0 100%); }
  #smenu .ch .art i { font-style:normal; font:900 34px 'Cinzel'; color:#eaffff; text-shadow:0 0 16px #7ff3ff; position:relative; top:-22px; z-index:1; }
  #smenu .ch .info { flex:1; display:flex; flex-direction:column; }
  #smenu .ch .no { font:700 11px 'Cinzel'; letter-spacing:.4em; color:#e9c87e; }
  #smenu .ch .tt { font:900 22px 'Gowun Batang'; color:#fff6dc; margin:2px 0 6px; }
  #smenu .ch .ds { font:400 12.5px/1.6 'Noto Sans KR'; color:#c9d6da; flex:1; }
  #smenu .ch .pg { font:500 12px 'Noto Sans KR'; color:#7ff3ff; margin:8px 0; }
  #smenu .ch .go { align-self:flex-start; font:700 15px 'Gowun Batang'; letter-spacing:.25em; color:#10131c; padding:10px 30px; border:none; border-radius:2px; cursor:pointer; background:linear-gradient(180deg,#fff2c9,#e2b964 60%,#b88c3e); box-shadow:0 0 20px rgba(233,200,126,.35); }
  #smenu .ch.lock { opacity:.5; } #smenu .ch.lock .art { filter:grayscale(1); }
  @media (max-width:520px){ #smenu .ch .art { flex-basis:84px; height:120px; } #smenu .ch .tt { font-size:19px; } }
  #tp { position:fixed; inset:0; z-index:40; pointer-events:none; opacity:0; transition:opacity .55s; background:radial-gradient(circle at 50% 50%, rgba(220,255,255,.95), rgba(60,180,220,.6) 30%, rgba(5,10,20,.98) 70%); display:flex; align-items:center; justify-content:center; flex-direction:column; }
  #tp.on { opacity:1; pointer-events:auto; }
  #tp .r { width:min(60vw,320px); height:min(60vw,320px); border-radius:50%; border:2px solid rgba(255,255,255,.85); box-shadow:0 0 40px #7ff3ff, inset 0 0 40px #7ff3ff; position:relative; animation:spin 2.4s linear infinite; }
  #tp .r::before, #tp .r::after { content:''; position:absolute; inset:14%; border:1px solid rgba(255,255,255,.8); transform:rotate(45deg); }
  #tp .r::after { inset:26%; border-radius:50%; border-width:2px; }
  #tp .n { margin-top:22px; font:900 clamp(22px,5vw,36px) 'Gowun Batang'; letter-spacing:.3em; color:#fff; text-shadow:0 0 20px #7ff3ff, 0 2px 10px #000; }
  #tp .a { font:700 11px 'Cinzel'; letter-spacing:.6em; color:#eaffff; margin-top:6px; }
  @keyframes spin { to { transform:rotate(360deg); } }
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
const bossEl = mk('div', 'boss', '<div class="n">공허의 기사 바르노스</div><div class="bar"><s></s><i></i></div>', hud);
const ehp = mk('div', 'ehp', '');
const hurtEl = mk('div', 'hurt', '');
const deadEl = mk('div', 'dead', '<div class="b">쓰러졌다…</div><div class="c">룬의 빛이 아직 너를 붙잡고 있다</div><button>다시 일어서기</button>');
const cb = mk('div', 'cbtns', '<div class="cb" id="cRune"><span>✦</span>룬<i></i></div><div class="cb" id="cRoll"><span>➰</span>구르기</div><div class="cb" id="cAtk"><span>⚔</span>공격</div>', hud);
const modes = mk('div', 'modes', '<button class="story" id="mStory"><span>✦</span>스토리 모드</button><button class="soon" id="mMini"><span>🎲</span>미니 게임</button><button id="mStat"><span>⚔</span>스탯</button>', hud);
const bReturn = mk('button', 'bReturn', '⟲ 광장으로', hud);
const smenu = mk('div', 'smenu', `<div class="hd"><span>STORY MODE</span><b>스토리 모드</b><button class="x">✕</button></div>
  <div class="ch c1"><div class="art"><i>ᚱ</i></div><div class="info"><div class="no">CHAPTER I</div><div class="tt">꺼져가는 룬</div><div class="ds">룬진을 타고 숲속의 「황혼의 룬 성소」로. 꺼져가는 크리스탈을 노리고 공허의 균열이 열린다. 검을 들고, 그림자를 베고, 공허의 기사를 쓰러뜨려라.</div><div class="pg"></div><button class="go">입장</button></div></div>
  <div class="ch lock"><div class="art"><i>Ⅱ</i></div><div class="info"><div class="no">CHAPTER II</div><div class="tt">공허의 숲</div><div class="ds">북쪽 숲 너머에서 같은 어둠이 꿈틀거린다…</div><div class="pg">준비 중</div></div></div>`);
const tpEl = mk('div', 'tp', '<div class="r"></div><div class="n"></div><div class="a"></div>');
const card = $('card');
card.querySelector('.bars').insertAdjacentHTML('beforeend', '<i class="xp"><b></b></i>');
const [hpB, mpB, xpB] = card.querySelectorAll('.bars b');
card.querySelector('.nm').insertAdjacentHTML('beforeend', '<span class="pt">+P</span>');

// ───────────────────────── 저장 / 스탯 ─────────────────────────
const SKEY = 'agora_story_v1';
const S = Object.assign({ lv: 1, exp: 0, pts: 0, str: 1, vit: 1, agi: 1, int: 1, step: 0, sword: false, rune: false, cleared: 0, statTut: false }, (() => { try { return JSON.parse(G.SAVE.get(SKEY, '{}')) || {}; } catch (e){ return {}; } })());
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
  <div class="pts">남은 스탯 포인트<em></em></div>
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
  statw.querySelector('.hd b').textContent = S.cleared ? '룬의 수호자' : '이름 없는 자';
  for (const r of statw.querySelectorAll('.row')){ r.querySelector('.v').textContent = S[r.dataset.k]; r.querySelector('button').disabled = S.pts <= 0; }
  statw.querySelector('.der').innerHTML = `<div>최대 HP<b>${d.maxHp}</b></div><div>최대 MP<b>${d.maxMp}</b></div><div>공격력<b>${Math.round(d.atk)}</b></div><div>치명타<b>${Math.round(d.crit * 100)}%</b></div><div>이동 속도<b>${Math.round(d.spd * 100)}%</b></div><div>공격 속도<b>${Math.round(d.aspd * 100)}%</b></div><div>룬 마법<b>${Math.round(d.rune)}</b></div><div>룬 재사용<b>${d.cd.toFixed(1)}초</b></div>`;
}
function refreshHud(){
  const d = D();
  card.querySelector('.lv').textContent = `Lv.${S.lv} · 스탯 포인트 ${S.pts}`;
  card.querySelector('.nm').firstChild.textContent = S.cleared ? '룬의 수호자' : '이름 없는 자';
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
    case 'type': tone('sine', 1200 + R() * 200, 1100, 0.03, 0.012); break;
  }
}

// ───────────────────────── 스토리 맵: 황혼의 룬 성소 ─────────────────────────
// 야영지(남쪽, 룬진 도착) → 숲길 → 쓰러진 기둥과 선돌로 둘러싸인 성소(북쪽)
const SW = new THREE.Group(); SW.visible = false; G.scene.add(SW);
const SCOL = [], SINT = [];
const CAMP = new V3(0, 0, 40), SANC = new V3(0, 0, -22), SANC_R = 19, ARRIVE = new V3(0, 0.04, 50.5);
const PATH = [[0, 40], [0, 31], [7, 20], [-5, 8], [4, -3], [0, -12]];
const SHAPES = [{ c: [CAMP.x, CAMP.z, 13] }, { c: [SANC.x, SANC.z, SANC_R] }];
for (let i = 0; i < PATH.length - 1; i++) SHAPES.push({ s: [...PATH[i], ...PATH[i + 1], 3.4] });
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
  const camp = new THREE.Mesh(meterUV(new THREE.CircleGeometry(9.5, 40).rotateX(-Math.PI / 2)), dirtM); camp.position.set(CAMP.x, 0.03, CAMP.z); camp.receiveShadow = true; SW.add(camp);
  // 성소 바닥 + 테두리 + 룬 고리
  const sf = new THREE.Mesh(meterUV(new THREE.CircleGeometry(16, 64).rotateX(-Math.PI / 2)), mats.flag); sf.position.set(SANC.x, 0.045, SANC.z); sf.receiveShadow = true; SW.add(sf);
  K.geo('moss', G.ringBand(15.9, 16.7, 0, 0.28, 96), SANC.x, 0, SANC.z);
  const rr1 = new THREE.Mesh(polarRing(13.4, 14.5), ADDM(G.tex(G.runeStrip(2048, 128, 36, '#3fe6ff', 0, 7), true, 1, 1), 0.9)); rr1.position.set(SANC.x, 0.06, SANC.z); SW.add(rr1);
  const rr2 = new THREE.Mesh(polarRing(5.0, 5.6, 64), ADDM(G.tex(G.runeStrip(1024, 128, 16, '#ffcf6a', 0, 3), true, 1, 1), 0.85)); rr2.position.set(SANC.x, 0.065, SANC.z); SW.add(rr2);
  // 선돌 (룬이 새겨진)
  const RB = new G.Builder(), runeV = ADDM(G.tex(G.runeColumn(128, 1024, 8, '#3fe6ff', 3), true, 1, 1), 0.95);
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
    const crys = new THREE.Mesh(cg, G.std({ color: 0x9ff4ff, emissive: 0x18c8ff, emissiveIntensity: 2.4, roughness: 0.08, flatShading: true, transparent: true, opacity: 0.92 })); g.add(crys);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.glowT, color: 0x66e8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); halo.scale.set(7, 7, 1); g.add(halo);
    const rt = G.tex(G.runeStrip(2048, 128, 24, '#57ecff', 0, 5), true, 1, 1), rings = [];
    for (const [r, h, tilt, spd] of [[1.9, 0.3, 0.4, 0.6], [2.5, 0.26, -0.6, -0.4]]){
      const piv = new THREE.Group(); piv.rotation.set(tilt, 0, tilt * 0.5);
      const bg = G.ringBand(0, r, -h / 2, h / 2, 96, { o: 1 }), uv = bg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / (TAU * r), (uv.getY(i) + h / 2) / h);
      piv.add(new THREE.Mesh(bg, ADDM(rt, 0.95))); g.add(piv); rings.push({ piv, spd });
    }
    const pl = new THREE.PointLight(0x5ee6ff, 22, 24, 1.6); g.add(pl);
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
  x.fillStyle = '#8f8a7e'; x.beginPath(); x.arc(C + SANC.x * k, C + SANC.z * k, 16.6 * k, 0, TAU); x.fill();
  x.strokeStyle = '#3fe6ff'; x.lineWidth = 2; x.beginPath(); x.arc(C + SANC.x * k, C + SANC.z * k, 14 * k, 0, TAU); x.stroke();
  x.fillStyle = '#7ff3ff'; x.beginPath(); x.arc(C + SANC.x * k, C + SANC.z * k, 4 * k, 0, TAU); x.fill();
  x.fillStyle = '#c99a5a'; for (const [tx, tz] of [[-6.2, 43.5], [6.4, 45]]){ x.beginPath(); x.arc(C + tx * k, C + tz * k, 2.3 * k, 0, TAU); x.fill(); }
  x.fillStyle = '#ff9a40'; x.beginPath(); x.arc(C + FP.x * k, C + FP.z * k, 3, 0, TAU); x.fill();
  x.strokeStyle = '#9ff6ff'; x.lineWidth = 2; x.beginPath(); x.arc(C + ARRIVE.x * k, C + ARRIVE.z * k, 2.3 * k, 0, TAU); x.stroke();
  G.addArea('story', { group: SW, col: SCOL, interact: SINT, ground: () => 0.04, bound: storyBound, mapBase: sm, mapR: 70 });
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
// 룬 지기 엘드라 (분수 앞)
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
  keeper.root.position.set(2.6, 0.04, 43.4); keeper.root.rotation.y = Math.PI * 0.9; SW.add(keeper.root);
}
const keeperCol = { t: 'c', x: 2.6, z: 43.4, r: 0.45 }; SCOL.push(keeperCol);
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

// ───────────────────────── 적 ─────────────────────────
const shadowMat = G.std({ color: 0x16101f, roughness: 0.4, emissive: 0x3a0f66, emissiveIntensity: 0.55, side: THREE.DoubleSide, transparent: true, opacity: 1 });
const TYPES = {
  grunt: { hp: 48, dmg: 9, spd: 3.5, scale: 0.86, range: 1.55, wind: 0.5, rec: 0.6, exp: 12, rad: 0.4 },
  brute: { hp: 160, dmg: 20, spd: 2.4, scale: 1.3, range: 2.2, wind: 0.85, rec: 0.9, exp: 40, rad: 0.6 },
  dummy: { hp: 34, exp: 14, rad: 0.45 },
  boss: { hp: 1150, dmg: 26, spd: 2.7, scale: 2.35, range: 3.2, exp: 260, rad: 1.0 },
};
const ENEMIES = [];
let lastKill = new V3(0, 0, 12);
const hardMul = () => 1 + 0.3 * S.cleared;
function addEyes(f, color = 0xd070ff, big = 1){
  const em = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  for (const s of [-1, 1]){ const e = new THREE.Mesh(new THREE.SphereGeometry(0.035 * big, 8, 6), em); e.position.set(s * 0.075, 0.2, 0.18); e.scale.set(1.3, 0.7, 0.6); f.head.add(e); }
  return em;
}
function spawnEnemy(type, x, z){
  const cfg = TYPES[type], e = { type, cfg, hp: cfg.hp * (type === 'dummy' ? 1 : hardMul()), state: 'spawn', st: 0, vel: new V3(), flash: 0, atkCd: rr(0.3, 1), ph: R() * 6 };
  e.max = e.hp;
  if (type === 'dummy'){
    const g = new THREE.Group(), piv = new THREE.Group(); g.add(piv);
    const add = (geo, mt, px, py, pz, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mt); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.castShadow = true; piv.add(m); return m; };
    add(new THREE.CylinderGeometry(0.06, 0.07, 1.7, 8), M.woodD, 0, 0.85, 0);
    add(new THREE.BoxGeometry(1.1, 0.07, 0.07), M.woodD, 0, 1.32, 0);
    add(new THREE.SphereGeometry(0.4, 14, 10), M.sack, 0, 1.1, 0, 0.95, 1.2, 0.75);
    add(new THREE.SphereGeometry(0.19, 12, 10), M.sack, 0, 1.68, 0);
    add(new THREE.CircleGeometry(0.15, 16), M.pRed, 0, 1.18, 0.31);
    add(new THREE.CircleGeometry(0.07, 12), M.pen1, 0, 1.18, 0.315);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.7, 0.06, 0.1), M.woodD, 0, 0.05, 0, 1, 1, 1).rotation.y = s * 0.8;
    g.position.set(x, 0.04, z); g.rotation.y = Math.atan2(player.pos.x - x, player.pos.z - z);
    SW.add(g); e.g = g; e.piv = piv; e.pos = g.position; e.wob = new V3(); e.state = 'idle';
  } else {
    const m = shadowMat.clone(); e.mat = m;
    e.f = new G.Figure(m, cfg.scale); e.eye = addEyes(e.f, 0xd070ff, type === 'boss' ? 1.4 : 1);
    e.root = e.f.root; e.pos = e.root.position; e.pos.set(x, -1.8, z); e.root.rotation.y = Math.atan2(player.pos.x - x, player.pos.z - z);
    const aura = glowSprite(0x8a30ff, cfg.scale * 2.2, 0.45); aura.position.y = 0.9; e.root.add(aura); e.aura = aura;
    if (type === 'boss'){
      const sw = makeSword(1.0, 0xc060ff); sw.position.set(0, -0.36, 0.02); sw.rotation.x = Math.PI / 2; e.f.elR.add(sw);
      sw.children[0].material = sw.children[1].material = M.iron;
      const crown = new THREE.Group(); crown.position.y = 0.36; e.f.head.add(crown);
      for (let i = 0; i < 7; i++){ const a = i / 7 * TAU, sp = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 5), new THREE.MeshBasicMaterial({ color: 0xc060ff, toneMapped: false })); sp.position.set(Math.cos(a) * 0.16, 0.05, Math.sin(a) * 0.16); sp.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); crown.add(sp); }
      const pl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.22), M.iron); pl.position.set(0, 0.56, 0); e.f.spine.add(pl);
      for (const s of [-1, 1]){ const pd = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8, 0, TAU, 0, Math.PI / 2), M.iron); pd.position.set(s * 0.27, 0.6, 0); e.f.spine.add(pd); }
      e.atkCd = 1.5; e.summoned = 0; e.name = '공허의 기사 바르노스';
    }
    SW.add(e.root);
    burst(new V3(x, 0.3, z), 0xb050ff, 24, 3, 0.35, 0.9, 1, 2);
  }
  e.bar = document.createElement('div'); e.bar.className = 'e'; e.bar.innerHTML = '<i></i>'; e.bar.style.display = 'none'; ehp.appendChild(e.bar);
  if (type === 'boss') e.bar.style.display = 'none';
  ENEMIES.push(e); return e;
}
function hitEnemy(e, dmg, dx, dz, kb, crit){
  if (e.state === 'dying' || e.state === 'spawn') return false;
  e.hp -= dmg; e.flash = 1;
  const hp = e.pos.clone(); hp.y += (e.type === 'boss' ? 4.6 : e.type === 'brute' ? 2.6 : 1.9);
  dmgNum(hp, Math.round(dmg) + (crit ? '!' : ''), crit ? 'crit' : '');
  burst(new V3(e.pos.x, (e.type === 'boss' ? 2.2 : 1.1), e.pos.z), crit ? 0xffe08a : 0xd090ff, crit ? 14 : 8, 4, 0.18, 0.4, -6, 1);
  if (e.type === 'dummy'){ e.wob.x += dz * 0.6; e.wob.z -= dx * 0.6; }
  else {
    const k = e.type === 'boss' ? 0.08 : e.type === 'brute' ? 0.4 : 1;
    e.vel.x += dx * kb * k; e.vel.z += dz * kb * k;
    if (e.type !== 'boss' && (e.state !== 'wind' || e.type === 'grunt')){ e.state = 'stagger'; e.st = 0; }
  }
  if (e.hp <= 0) killEnemy(e);
  return true;
}
function killEnemy(e){
  e.state = 'dying'; e.st = 0; e.bar.remove(); lastKill.copy(e.pos); lastKill.y = 0;
  sfx('die');
  if (e.type === 'dummy'){
    burst(new V3(e.pos.x, 1.1, e.pos.z), 0xe8c070, 30, 4, 0.2, 0.9, -8, 2);
    dummiesDown++; setProgress();
  } else burst(new V3(e.pos.x, 1.0 * e.cfg.scale, e.pos.z), 0xa040ff, e.type === 'boss' ? 120 : 34, e.type === 'boss' ? 8 : 4, e.type === 'boss' ? 0.5 : 0.3, 1.1, 1.5, 2);
  dropOrbs(e.pos, Math.round(e.cfg.exp * (e.type === 'dummy' ? 1 : hardMul())));
}
function updateEnemies(dt){
  const alive = [];
  for (let i = ENEMIES.length - 1; i >= 0; i--){
    const e = ENEMIES[i]; e.st += dt;
    if (e.type === 'dummy'){
      e.wob.multiplyScalar(Math.exp(-3 * dt)); e.piv.rotation.x = Math.sin(e.st * 14) * e.wob.x * 0.4; e.piv.rotation.z = Math.sin(e.st * 14) * e.wob.z * 0.4;
      if (e.state === 'dying'){ e.g.scale.setScalar(Math.max(0.01, 1 - e.st * 3)); if (e.st > 0.35){ SW.remove(e.g); ENEMIES.splice(i, 1); } }
      else alive.push(e);
      continue;
    }
    const f = e.f, cfg = e.cfg, dx = player.pos.x - e.pos.x, dz = player.pos.z - e.pos.z, d = Math.hypot(dx, dz), face = Math.atan2(dx, dz);
    // 피격 섬광
    e.flash = Math.max(0, e.flash - dt * 6); e.mat.emissive.setRGB(0.23 + e.flash * 1.2, 0.06 + e.flash * 1.2, 0.4 + e.flash * 1.2); e.mat.emissiveIntensity = 0.55 + e.flash * 2;
    if (e.state === 'dying'){
      e.mat.opacity = Math.max(0, 1 - e.st / 0.9); e.pos.y -= dt * 0.8; e.aura.material.opacity *= 0.9;
      f.set(G.pose({ sp: 0.9, hd: 0.5, lax: -0.6, rax: -0.6, lk: 1.2, rk: 1.2, hy: 0.6 })); f.blend(dt, 6);
      if (e.st > 0.95){ SW.remove(e.root); ENEMIES.splice(i, 1); }
      continue;
    }
    alive.push(e);
    if (e.type === 'boss'){ updateBoss(e, dt, d, dx, dz, face); }
    else {
      let p;
      if (e.state === 'spawn'){ e.pos.y = -1.8 * (1 - ease(Math.min(1, e.st / 0.9))); p = G.pose({ laz: 1.2, raz: -1.2, sp: 0.4 }); if (e.st > 0.9){ e.state = 'chase'; e.pos.y = 0.04; } }
      else if (e.state === 'chase'){
        turn(e, face, dt * 6);
        if (d > cfg.range * 0.8){ const sp = cfg.spd * (dead ? 0 : 1); e.pos.x += dx / d * sp * dt; e.pos.z += dz / d * sp * dt; e.ph += dt * 8.5 * (cfg.spd / 3.5); }
        e.atkCd -= dt;
        p = f.gait(e.ph, d > cfg.range * 0.8 ? 0.9 : 0, false, 0); p.sp += 0.3; p.lax = -1.0 + Math.sin(e.ph) * 0.2; p.rax = -1.0 - Math.sin(e.ph) * 0.2; p.le = -0.3; p.re = -0.3; p.hd = -0.2;
        if (d < cfg.range && e.atkCd <= 0 && !dead){ e.state = 'wind'; e.st = 0; }
      } else if (e.state === 'wind'){
        turn(e, face, dt * 3);
        const k = Math.min(1, e.st / cfg.wind);
        p = G.pose({ lax: -2.9 * k, rax: -2.9 * k, le: -0.4, re: -0.4, sp: -0.25 * k, hd: -0.2, llx: -0.3 * k, rlx: 0.25 * k, lk: 0.3, rk: 0.1 });
        e.eye.color.setRGB(0.8 + k * 0.2, 0.4 * (1 - k), 1 - k * 0.8);
        if (e.st >= cfg.wind){
          e.state = 'recover'; e.st = 0; e.eye.color.set(0xd070ff);
          const hit = d < cfg.range + 0.5 && Math.abs(angDiff(face, e.root.rotation.y)) < 1.1;
          if (e.type === 'brute'){ shockwave(e.pos.x + Math.sin(e.root.rotation.y) * 1.2, 0.1, e.pos.z + Math.cos(e.root.rotation.y) * 1.2, 2.5, 0xb050ff, 0.4); G.shake = Math.max(G.shake, 0.6); }
          if (hit) hurtPlayer(cfg.dmg * hardMul(), e.pos);
        }
      } else if (e.state === 'recover'){
        p = G.pose({ lax: -0.5, rax: -0.5, sp: 0.55, hd: 0.2, lk: 0.4, rk: 0.4, hy: 0.8 });
        if (e.st > cfg.rec){ e.state = 'chase'; e.atkCd = rr(0.5, 1.4); }
      } else if (e.state === 'stagger'){
        p = G.pose({ sp: -0.45, hd: -0.4, lax: 0.4, rax: 0.4, laz: 0.6, raz: -0.6 });
        if (e.st > 0.32){ e.state = 'chase'; e.atkCd = Math.max(e.atkCd, 0.3); }
      }
      if (p){ f.set(p); f.blend(dt, e.state === 'wind' ? 8 : 14); }
    }
    // 이동 / 충돌
    e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt; e.vel.multiplyScalar(Math.exp(-7 * dt));
    if (e.state !== 'spawn'){ G.collide(e.pos, cfg.rad * 0.9); }
  }
  // 서로 밀어내기 + 플레이어와
  for (let i = 0; i < alive.length; i++){
    const a = alive[i];
    for (let j = i + 1; j < alive.length; j++){ const b = alive[j], dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.cfg.rad + b.cfg.rad; if (d < m && d > 1e-4){ const k = (m - d) / 2 / d; if (a.type !== 'dummy' && a.type !== 'boss'){ a.pos.x -= dx * k; a.pos.z -= dz * k; } if (b.type !== 'dummy' && b.type !== 'boss'){ b.pos.x += dx * k; b.pos.z += dz * k; } } }
    const dx = player.pos.x - a.pos.x, dz = player.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.cfg.rad + 0.36;
    if (d < m && d > 1e-4 && !roll){ player.pos.x = a.pos.x + dx / d * m; player.pos.z = a.pos.z + dz / d * m; }
  }
  G.mapEnemies = alive.filter(e => e.type !== 'dummy').map(e => ({ x: e.pos.x, z: e.pos.z, big: e.type !== 'grunt' }));
  // HP 막대
  for (const e of alive){
    if (e.type === 'boss') continue;
    if (e.hp >= e.max){ e.bar.style.display = 'none'; continue; }
    const hpP = e.pos.clone(); hpP.y += e.type === 'brute' ? 2.55 : e.type === 'dummy' ? 2.05 : 1.85;
    const s = toScreen(hpP); if (!s.vis){ e.bar.style.display = 'none'; continue; }
    e.bar.style.display = 'block'; e.bar.style.left = s.x + 'px'; e.bar.style.top = s.y + 'px'; e.bar.firstChild.style.width = (e.hp / e.max * 100) + '%';
  }
  return alive;
}
function turn(e, want, k){ const a = angDiff(want, e.root.rotation.y); e.root.rotation.y += a * Math.min(1, k); }

// ── 보스 ──
const ORBS = [];   // 공허 구체 (보스 투사체)
function updateBoss(e, dt, d, dx, dz, face){
  const f = e.f; let p;
  bossEl.querySelector('i').style.width = (e.hp / e.max * 100) + '%'; bossEl.querySelector('s').style.width = (e.hp / e.max * 100) + '%';
  if (e.state === 'spawn'){
    e.pos.y = 0.04; p = G.pose({ hy: 0.86, laz: 0.4, raz: -0.4, hd: -0.2 });
    if (e.st > 0.4){ e.state = 'chase'; e.atkCd = 1.2; }
  } else if (e.state === 'chase'){
    turn(e, face, dt * 3);
    if (d > 3.0 && !dead){ e.pos.x += dx / d * e.cfg.spd * dt; e.pos.z += dz / d * e.cfg.spd * dt; e.ph += dt * 5; }
    p = f.gait(e.ph, d > 3.0 ? 0.8 : 0, false, 0); p.rax = -0.5; p.re = -0.9;
    e.atkCd -= dt;
    const frac = e.hp / e.max;
    if (!dead && e.summoned < 1 && frac < 0.66 || !dead && e.summoned < 2 && frac < 0.33){ e.summoned++; e.state = 'summon'; e.st = 0; }
    else if (e.atkCd <= 0 && !dead){
      const r = R();
      if (d < 4.2 && r < 0.6){ e.state = 'slash'; e.st = 0; e.combo = 0; e.tele = telegraph(e.pos.x, e.pos.z, 4.4, e.root.rotation.y, 2.2); }
      else if (d > 6 && r < 0.5 || r < 0.3){ e.state = 'orbs'; e.st = 0; e.fired = 0; }
      else { e.state = 'leap'; e.st = 0; e.from = e.pos.clone(); e.to = new V3(player.pos.x, 0.04, player.pos.z); e.tele = telegraph(e.to.x, e.to.z, 3.8); }
    }
  } else if (e.state === 'slash'){
    const W = 0.75;
    if (e.st < W){ const k = e.st / W; p = G.pose({ rax: -2.6 * k, raz: -1.2 * k, re: -0.5, sp: -0.2 * k, lax: -0.3 }); turn(e, face, dt * 2); if (e.tele){ e.tele.material.uniforms.uP.value = k; e.tele.material.uniforms.uTime.value += dt; e.tele.rotation.y = e.root.rotation.y; e.tele.position.set(e.pos.x, 0.08, e.pos.z); } }
    else {
      if (!e.hit){ e.hit = true; if (e.tele){ SW.remove(e.tele); e.tele = null; }
        trail(e.root.rotation.y, 1.6, 0, false, 0xc060ff); sfx('swing'); G.shake = Math.max(G.shake, 0.5);
        if (d < 4.6 && Math.abs(angDiff(face, e.root.rotation.y)) < 1.15) hurtPlayer(e.cfg.dmg * hardMul(), e.pos); }
      p = G.pose({ rax: -0.6, raz: 1.0, re: -0.2, sp: 0.35, lax: -0.3 });
      if (e.st > W + 0.45){ e.hit = false; e.combo++; if (e.combo < 2){ e.st = 0; e.tele = telegraph(e.pos.x, e.pos.z, 4.4, e.root.rotation.y, 2.2); } else { e.state = 'chase'; e.atkCd = rr(1.0, 1.8); } }
    }
  } else if (e.state === 'leap'){
    const T = 1.05, k = Math.min(1, e.st / T);
    if (e.tele){ e.tele.material.uniforms.uP.value = k; e.tele.material.uniforms.uTime.value += dt; }
    if (k < 0.25){ p = G.pose({ hy: 0.6, lk: 1.4, rk: 1.4, llx: -0.6, rlx: -0.6, sp: 0.4, lax: 0.6, rax: 0.6 }); }
    else {
      const kk = (k - 0.25) / 0.75; e.pos.x = e.from.x + (e.to.x - e.from.x) * ease(kk); e.pos.z = e.from.z + (e.to.z - e.from.z) * ease(kk); e.pos.y = 0.04 + Math.sin(kk * Math.PI) * 5;
      p = G.pose({ rax: -2.8, lax: -2.8, re: -0.3, le: -0.3, llx: -0.9, lk: 1.2, rlx: 0.3, rk: 0.5 });
      turn(e, Math.atan2(e.to.x - e.from.x, e.to.z - e.from.z), dt * 5);
    }
    if (k >= 1 && !e.landed){
      e.landed = true; e.pos.y = 0.04; if (e.tele){ SW.remove(e.tele); e.tele = null; }
      shockwave(e.pos.x, 0.12, e.pos.z, 4.4, 0xb050ff, 0.6); burst(new V3(e.pos.x, 0.3, e.pos.z), 0xb050ff, 50, 7, 0.35, 0.8, -6, 2); sfx('boom'); G.shake = 1.4;
      const dd = Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z); if (dd < 3.9) hurtPlayer(34 * hardMul(), e.pos, 9);
    }
    if (e.landed) p = G.pose({ rax: -0.4, lax: -0.4, sp: 0.9, hd: 0.3, hy: 0.62, lk: 1.0, rk: 1.0 });
    if (e.st > T + 0.7){ e.landed = false; e.state = 'chase'; e.atkCd = rr(0.8, 1.6); }
  } else if (e.state === 'orbs'){
    turn(e, face, dt * 4);
    p = G.pose({ lax: -1.6, laz: 0.3, le: -0.2, rax: -0.4, re: -0.9, sp: -0.15 });
    if (e.st > 0.5 + e.fired * 0.22 && e.fired < 5){
      e.fired++; const a = e.root.rotation.y + (e.fired - 3) * 0.22;
      const s = glowSprite(0xb040ff, 1.3, 1); s.position.set(e.pos.x + Math.sin(a) * 1.5, 2.6, e.pos.z + Math.cos(a) * 1.5); SW.add(s);
      const core = glowSprite(0xffffff, 0.45, 1); s.add(core);
      ORBS.push({ s, vx: Math.sin(a) * 9, vz: Math.cos(a) * 9, t: 0 }); sfx('swing');
    }
    if (e.st > 2.0){ e.state = 'chase'; e.atkCd = rr(0.8, 1.5); }
  } else if (e.state === 'summon'){
    p = G.pose({ laz: 2.6, raz: -2.6, le: 0, re: 0, sp: -0.35, hd: -0.6 });
    if (e.st > 0.1 && !e.roared){ e.roared = true; sfx('roar'); G.shake = 1.0; banner('VOID', '그림자들이 몰려온다', '', true, 2.2); openPortals(3); }
    if (e.st > 1.6){ e.roared = false; for (let i = 0; i < 3; i++){ const pp = PORTALS[i]; spawnEnemy(i === 2 && e.summoned > 1 ? 'brute' : 'grunt', pp.pos.x, pp.pos.z); } e.state = 'chase'; e.atkCd = 1.5; }
  }
  if (p){ f.set(p); f.blend(dt, 10); }
}
function updateOrbs(dt){
  for (let i = ORBS.length - 1; i >= 0; i--){
    const o = ORBS[i]; o.t += dt; o.s.position.x += o.vx * dt; o.s.position.z += o.vz * dt; o.s.position.y = Math.max(1.2, o.s.position.y - dt * 1.4);
    const dd = Math.hypot(player.pos.x - o.s.position.x, player.pos.z - o.s.position.z);
    if (dd < 0.8 && Math.abs(player.pos.y + 1 - o.s.position.y) < 1.4){ hurtPlayer(15 * hardMul(), o.s.position, 4); o.t = 99; burst(o.s.position, 0xb040ff, 14, 3, 0.25, 0.5); }
    if (o.t > 3.2){ SW.remove(o.s); ORBS.splice(i, 1); }
  }
}

// ───────────────────────── 경험치 구슬 / 룬 조각 ─────────────────────────
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
  if (!S.statTut){ S.statTut = true; save(); setTimeout(() => { if (!dialogOpen) { toggleStats(true); hint('스탯을 찍어 강해지세요! <b>+</b> 버튼을 누르고 <b>C</b> 로 닫기', 6); } }, 1600); }
}
let shard = null;
function dropShard(pos){
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), G.std({ color: 0x9ff4ff, emissive: 0x30d8ff, emissiveIntensity: 2.6, roughness: 0.1, flatShading: true }));
  c.scale.y = 1.6; g.add(c); const gl = glowSprite(0x66e8ff, 2.6, 0.9); g.add(gl);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.4, 8, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x66e8ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 4; g.add(beam);
  const p = pos.clone().sub(SANC); p.y = 0; const r = Math.hypot(p.x, p.z); if (r < 5.2){ if (r < 0.01) p.set(0, 0, 6); else p.multiplyScalar(5.8 / r); } if (r > 14) p.multiplyScalar(13 / r); p.add(SANC);
  g.position.set(p.x, 1.2, p.z); SW.add(g); shard = { g, c, t: 0 };
  burst(g.position, 0x66e8ff, 40, 4, 0.3, 1.0, -3, 3); sfx('shard');
  setObj('룬 조각 줍기', '균열의 핵이 떨어졌다', () => g.position);
}
function updateShard(dt){
  if (!shard) return;
  shard.t += dt; shard.c.rotation.y += dt * 2; shard.g.position.y = 1.2 + Math.sin(shard.t * 2.4) * 0.15;
  if (Math.hypot(player.pos.x - shard.g.position.x, player.pos.z - shard.g.position.z) < 1.4){
    SW.remove(shard.g); shard = null; sfx('shard'); burst(new V3(player.pos.x, 1.2, player.pos.z), 0x66e8ff, 40, 3, 0.3, 1.0, 3, 2);
    S.step++; save();
    const n = S.step - 6;
    banner('RUNE SHARD', `룬 조각 ${n} / 3`, n < 3 ? '크리스탈의 빛이 조금 돌아왔다' : '세 조각이 모였다!', false, 2.6);
    altarPower = 0.25 + n * 0.2;
    if (n < 3) later(3.2, () => startWave(n + 1));
    else later(2.0, () => { closePortals(); keeperShout(); });
  }
}

// ───────────────────────── 균열 (포탈) ─────────────────────────
const portalMat = () => new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uO: { value: 0 } },
  vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uTime, uO; varying vec2 vU;
    void main(){ vec2 p = (vU - 0.5) * 2.0; float r = length(p), a = atan(p.y, p.x);
      float sw = sin(a * 5.0 + r * 9.0 - uTime * 4.0) * 0.5 + 0.5; float core = smoothstep(1.0, 0.0, r);
      float rim = smoothstep(0.75, 0.95, r) * smoothstep(1.0, 0.95, r);
      vec3 c = mix(vec3(0.05, 0.0, 0.1), vec3(0.6, 0.15, 1.0), sw * core) + vec3(0.9, 0.5, 1.0) * rim * 2.0;
      float al = (core * (0.55 + 0.45 * sw) + rim) * uO * step(r, 1.0);
      gl_FragColor = vec4(c * al, al); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
const PORTALS = [[0, 12.4], [Math.PI, 12.4], [Math.PI * 1.5, 12.4], [Math.PI * 1.75, 12.6]].map(([a, r]) => {
  const g = new THREE.Group(); g.position.set(SANC.x + Math.cos(a) * r, 0, SANC.z + Math.sin(a) * r); g.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); g.visible = false;
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), portalMat()); disc.position.y = 1.9; g.add(disc);
  const gr = new THREE.Mesh(new THREE.CircleGeometry(2.4, 40).rotateX(-Math.PI / 2), portalMat()); gr.position.y = 0.09; g.add(gr);
  const gl = glowSprite(0x9030ff, 6, 0.6); gl.position.y = 1.9; g.add(gl);
  SW.add(g); return { g, disc, gr, gl, pos: g.position, o: 0, tgt: 0 };
});
function openPortals(n){ PORTALS.forEach((p, i) => { if (i < n){ if (!p.tgt) sfx('portal'); p.tgt = 1; p.g.visible = true; } }); }
function closePortals(){ PORTALS.forEach(p => p.tgt = 0); }
function updatePortals(dt){
  for (const p of PORTALS){
    p.o += (p.tgt - p.o) * Math.min(1, dt * 2.5); if (p.o < 0.01 && !p.tgt){ p.g.visible = false; continue; }
    p.disc.material.uniforms.uTime.value += dt; p.disc.material.uniforms.uO.value = p.o; p.gr.material.uniforms.uTime.value += dt; p.gr.material.uniforms.uO.value = p.o * 0.6;
    p.disc.scale.setScalar(0.2 + 0.8 * p.o); p.gl.material.opacity = 0.6 * p.o;
    if (R() < dt * 10 * p.o) burst(new V3(p.pos.x + rr(-1, 1), rr(0.5, 3.2), p.pos.z + rr(-1, 1)), 0x9030ff, 1, 0.6, 0.25, 1.0, 0.5, 0.8);
  }
}

// ───────────────────────── 웨이브 ─────────────────────────
let wave = null;
const WAVES = {
  1: [['grunt', 0, 0], ['grunt', 1, 0.3], ['grunt', 0, 2.5], ['grunt', 1, 2.8]],
  2: [['grunt', 0, 0], ['grunt', 1, 0], ['grunt', 2, 0.4], ['brute', 2, 3.0], ['grunt', 0, 3.4], ['grunt', 1, 3.6], ['grunt', 2, 6]],
  3: [['grunt', 0, 0], ['grunt', 1, 0], ['grunt', 2, 0], ['grunt', 3, 0.5], ['brute', 0, 3], ['grunt', 2, 3.5], ['grunt', 3, 3.8], ['brute', 1, 7], ['grunt', 2, 7.5]],
};
function startWave(n){
  S.step = 5 + n; save();
  openPortals(n === 1 ? 2 : n === 2 ? 3 : 4);
  wave = { n, q: WAVES[n].map(w => ({ type: w[0], p: w[1], t: w[2] + 1.6 })), t: 0, done: false };
  banner('WAVE ' + n + ' / 3', n === 3 ? '마지막 습격' : '그림자의 습격', '균열에서 그림자가 쏟아져 나온다', true, 2.4);
  setObj('그림자를 물리쳐라', '', null);
}
function updateWave(dt, alive){
  if (!wave) return;
  wave.t += dt;
  for (const q of wave.q){ if (!q.done && wave.t >= q.t){ q.done = true; const p = PORTALS[q.p].pos; spawnEnemy(q.type, p.x + rr(-0.8, 0.8), p.z + rr(-0.8, 0.8)); } }
  const left = wave.q.filter(q => !q.done).length + alive.filter(e => e.type !== 'dummy').length;
  objEl.querySelector('.p').textContent = `웨이브 ${wave.n} / 3 · 남은 그림자 ${left}`;
  if (left === 0 && !wave.done){ wave.done = true; const n = wave.n; wave = null; later(0.8, () => dropShard(lastKill)); }
}

// ───────────────────────── 대화 ─────────────────────────
let dialogOpen = false, dlgAdvance = null, dlgFull = false;
const NAMES = { k: '룬 지기 엘드라', s: '대장장이 브론', b: '공허의 기사 바르노스', q: '???' };
const SPK = { k: () => keeper, s: () => smith, b: () => boss && boss.f };
function camFor(fg){
  const pp = player.pos, sp = fg ? fg.root.position : pp;
  const mid = new V3((pp.x + sp.x) / 2, Math.max(pp.y, sp.y) + 1.35, (pp.z + sp.z) / 2);
  let dx = sp.x - pp.x, dz = sp.z - pp.z, d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
  const side = new V3(dz, 0, -dx), big = fg && fg.root.scale.x > 1.5;
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
  setTimeout(() => deadEl.classList.add('on'), 900);
}
deadEl.querySelector('button').onclick = () => {
  deadEl.classList.remove('on'); sfx('ui');
  const d = D(); hp = d.maxHp; mp = d.maxMp; dead = false; G.lock = false; inv = 1.5;
  for (const e of ENEMIES.slice()){ if (e.type === 'dummy') continue; e.bar.remove(); SW.remove(e.root); ENEMIES.splice(ENEMIES.indexOf(e), 1); }
  for (const o of ORBS){ SW.remove(o.s); } ORBS.length = 0;
  if (S.step >= 6 && S.step <= 10) player.pos.set(SANC.x, 0.04, SANC.z + 11); else player.pos.set(ARRIVE.x, 0.04, ARRIVE.z - 3); player.vy = 0;
  if (S.step >= 6 && S.step <= 8) later(1.5, () => startWave(S.step - 5));
  if (S.step === 10){ boss = null; bossEl.classList.remove('on'); later(1.0, () => startBoss(true)); }
  refreshHud();
};
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
  if (!dead && combatT <= 0 && hp < d.maxHp) hp = Math.min(d.maxHp, hp + d.maxHp * 0.05 * dt);
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

// ───────────────────────── 스토리 진행 ─────────────────────────
let dummiesDown = 0, boss = null, nightT = 0, nightK = 0, busy = false, sancTrigger = null, altarPower = 0.6, inStory = false;
const DUSK = 0.28;
const keeperPos = () => keeper.root.position;
const sancPos = () => new V3(SANC.x, 0, SANC.z + 8);
const keeperIt = { x: 2.6, z: 43.4, r: 2.4, title: '룬 지기 엘드라', action: () => talkKeeper() };
SINT.push(keeperIt);
SINT.push({ x: ARRIVE.x, z: ARRIVE.z, r: 2.4, title: '귀환의 룬진 · 광장으로', action: () => askReturn() });
const altarIt = { x: SANC.x, z: SANC.z, r: 6.2, title: '성소의 크리스탈', action: () => { if (S.step === 9) deliverShards(); else G.toast('성소의 크리스탈', S.step === 11 ? '크리스탈이 맑게 노래하고 있다' : '빛이 위태롭게 흔들린다…'); } };
SINT.push(altarIt);
function keeperAt(where){
  const p = where === 'sanc' ? new V3(SANC.x + 4.6, 0.04, SANC.z + 7.0) : new V3(2.6, 0.04, 43.4);
  keeper.root.position.copy(p); keeperCol.x = keeperIt.x = p.x; keeperCol.z = keeperIt.z = p.z;
}
function setProgress(){
  if (S.step === 3){
    objEl.querySelector('.p').textContent = `쓰러뜨린 허수아비 ${dummiesDown} / 3`;
    if (dummiesDown >= 3){ S.step = 4; save(); later(1.2, () => { setObj('엘드라에게 돌아가기', '검술을 익혔다', keeperPos); banner('TRAINING', '검술 훈련 완료', '엘드라에게 돌아가자', false, 2.4); }); }
  }
}
function spawnDummies(){ for (const e of ENEMIES.filter(e => e.type === 'dummy')){ SW.remove(e.g); e.bar.remove(); ENEMIES.splice(ENEMIES.indexOf(e), 1); } dummiesDown = 0; [[-4.2, 33.6], [0, 32.2], [4.2, 33.6]].forEach(([x, z]) => spawnEnemy('dummy', x, z)); }
async function intro(){
  busy = true;
  await chapterCard('CHAPTER I', '꺼져가는 룬', '제 1 장 · 황혼의 룬 성소');
  S.step = 1; save();
  await say([
    ['k', '…왔구나. 룬진을 타고 온 이름 없는 자여.'],
    ['k', '나는 엘드라. 이 숲 깊은 곳, 황혼의 룬 성소를 지켜온 룬 지기다.'],
    ['k', '성소의 크리스탈이 꺼져가고 있다. 어젯밤, 하늘에 금이 갔지.'],
    ['k', '공허의 균열… 그 틈으로 그림자가 쏟아지면, 광장의 크리스탈마저 무사하지 못할 게다.'],
    ['k', '빈손으로는 아무것도 지킬 수 없지. 받아라 — 광장의 대장장이 브론이 벼려 맡겨둔 「견습 룬검」이다.'],
  ]);
  S.sword = true; S.step = 3; save(); giveSword(); sfx('shard');
  banner('NEW WEAPON', '견습 룬검 획득', '검에 새겨진 룬이 희미하게 빛난다', false, 2.6);
  await wait(2.2);
  await say([['k', '야영지에 허수아비를 세워뒀다. 휘두르는 법부터 몸에 익혀라. 세 번 이어 베면 회전베기가 나간다.']]);
  spawnDummies();
  setObj('허수아비로 검술 연습', '쓰러뜨린 허수아비 0 / 3', () => new V3(0, 0, 33));
  hint(G.IS_TOUCH ? '<b>⚔ 공격</b> 버튼 연타로 3연격 · <b>구르기</b>로 회피' : '<b>J</b> 또는 <b>클릭</b> 연타로 3연격 · <b>K</b> / <b>우클릭</b> 구르기', 9);
  busy = false;
}
async function keeperRune(){
  busy = true;
  await say([
    ['k', '검이 손에 익었구나. 눈빛이 달라졌어.'],
    ['k', '이제 마지막 가르침이다. 크리스탈의 힘을 빌려 쓰는 법 — 룬 마법이다.'],
    ['k', '손끝에 룬을 그리고, 땅을 내리쳐라. 주위의 모든 어둠이 밀려날 게다.'],
  ]);
  S.rune = true; S.step = 5; save();
  banner('NEW SKILL', '룬 마법 · 룬의 진동', G.IS_TOUCH ? '✦ 룬 버튼 — 주위의 적을 날려버린다 (MP 20)' : 'R 키 — 주위의 적을 날려버린다 (MP 20)', false, 3);
  await wait(3.0);
  await say([['k', '이제 성소로 가자. 숲길을 따라 북쪽, 선돌이 둘러선 곳이다. 먼저 가 있으마.']]);
  burst(new V3(keeper.root.position.x, 1, keeper.root.position.z), 0x7ff3ff, 40, 3, 0.3, 0.9, 1, 2); sfx('rune');
  keeperAt('sanc');
  goSanctuary();
  busy = false;
}
function goSanctuary(){
  setObj('황혼의 룬 성소로 가기', '숲길을 따라 북쪽으로', sancPos);
  sancTrigger = () => {
    if (S.step <= 5) invasion();
    else if (S.step <= 8) startWave(S.step - 5);
    else if (S.step === 9) keeperShout();
    else if (S.step === 10) startBoss(true);
  };
}
async function invasion(){
  busy = true; clearObj();
  G.lock = true; document.body.classList.add('cine');
  sfx('roar'); G.shake = 1.2; altarPower = 0.2; nightT = 1;
  G.camOverride = { pos: new V3(SANC.x, 9, SANC.z + 22), look: new V3(SANC.x, 4, SANC.z) };
  await wait(1.8);
  openPortals(4);
  G.camOverride = { pos: new V3(SANC.x + 8, 5, SANC.z + 6), look: new V3(SANC.x - 10, 2, SANC.z - 6) };
  await wait(2.2);
  document.body.classList.remove('cine'); G.camOverride = null; G.lock = false;
  await say([
    ['k', '…!? 이 기운은— 균열이 열렸다!'],
    ['k', '그림자들이 크리스탈을 노린다! 나는 크리스탈을 붙잡고 있겠다. 너는 놈들을 막아라!'],
    ['k', '놈들을 모두 쓰러뜨리면 균열의 핵, 룬 조각이 떨어질 게다. 세 개를 모아 크리스탈에 바쳐라!'],
  ]);
  closePortals();
  startWave(1);
  busy = false;
}
function keeperShout(){
  S.step = 9; save();
  setObj('룬 조각을 크리스탈에 바치기', '룬 조각 3 / 3 — 제단에서 E', () => new V3(SANC.x, 0, SANC.z));
  hint('제단 앞에서 <b>E</b> — 크리스탈에 조각을 바치자', 6);
}
async function deliverShards(){
  if (busy) return; busy = true; clearObj();
  G.lock = true; document.body.classList.add('cine');
  G.camOverride = { pos: new V3(SANC.x + 2, 3.5, SANC.z + 12), look: new V3(SANC.x, 4, SANC.z) };
  const ss = [];
  for (let i = 0; i < 3; i++){ const s = glowSprite(0x66e8ff, 1.4, 1); s.position.set(player.pos.x, 1.5, player.pos.z); SW.add(s); ss.push(s); }
  for (let t = 0; t < 1.6; t += 0.016){
    await wait(0.016);
    ss.forEach((s, i) => { const a = t * 4 + i * TAU / 3, k = ease(Math.min(1, t / 1.5)); s.position.set(player.pos.x + (SANC.x - player.pos.x) * k + Math.cos(a) * 1.2 * (1 - k * 0.7), 1.5 + k * 2.8, player.pos.z + (SANC.z - player.pos.z) * k + Math.sin(a) * 1.2 * (1 - k * 0.7)); });
  }
  ss.forEach(s => SW.remove(s)); sfx('shard'); altarPower = 2.2; burst(new V3(SANC.x, 4.3, SANC.z), 0x9ff6ff, 80, 6, 0.4, 1.2, 0, 0); G.shake = 0.6;
  await wait(1.4);
  sfx('roar'); G.shake = 1.4; altarPower = 0.4; rift.visible = true; riftK = 0.01;
  G.camOverride = { pos: new V3(SANC.x, 4, SANC.z + 16), look: new V3(SANC.x, 12, SANC.z - 8) };
  await wait(2.0);
  S.step = 10; save();
  document.body.classList.remove('cine'); G.camOverride = null; G.lock = false;
  await startBoss(false);
  busy = false;
}
// 하늘의 균열 (보스 등장)
const rift = new THREE.Mesh(new THREE.PlaneGeometry(10, 16), portalMat()); rift.position.set(SANC.x, 16, SANC.z - 9); rift.visible = false; SW.add(rift);
let riftK = 0;
async function startBoss(retry){
  if (!retry){
    G.lock = true;
    boss = spawnEnemy('boss', SANC.x, SANC.z - 9); boss.pos.y = 14; boss.state = 'intro';
    G.camOverride = { pos: new V3(SANC.x, 3.2, SANC.z + 3), look: new V3(SANC.x, 6, SANC.z - 9) };
    for (let t = 0; t < 1.2; t += 0.016){ await wait(0.016); boss.pos.y = 14 * (1 - ease(t / 1.2)) + 0.04; boss.f.set(G.pose({ llx: -0.5, lk: 1.0, rlx: 0.2, rk: 0.4, laz: 0.8, raz: -0.8 })); boss.f.blend(0.016, 8); }
    boss.pos.y = 0.04; sfx('boom'); G.shake = 1.6; shockwave(SANC.x, 0.12, SANC.z - 9, 6, 0xb050ff, 0.8); burst(new V3(SANC.x, 0.4, SANC.z - 9), 0xb050ff, 80, 8, 0.4, 1, -4, 2);
    await wait(0.8);
    await say([
      ['b', '……작은 빛이 발버둥 치는군.'],
      ['b', '나는 공허의 기사 바르노스. 이 크리스탈은 오늘 밤, 공허의 것이 된다.'],
      ['k', '물러서지 마라, 이름 없는 자여! 네 안의 룬을 믿어라!'],
    ]);
    boss.state = 'spawn'; boss.st = 0;
  } else {
    rift.visible = true; riftK = 1;
    boss = spawnEnemy('boss', SANC.x, SANC.z - 9); boss.st = 0;
  }
  bossEl.classList.add('on');
  setObj('공허의 기사 바르노스 처치', '붉은 경고 범위를 피해 공격하라', null);
  hint(G.IS_TOUCH ? '붉은 범위가 보이면 <b>구르기</b>로 피하라!' : '붉은 범위가 보이면 <b>K</b> / <b>우클릭</b> 으로 굴러 피하라!', 6);
}
async function bossDefeated(){
  busy = true; bossEl.classList.remove('on'); clearObj();
  for (const e of ENEMIES.slice()){ if (e !== boss && e.state !== 'dying') killEnemy(e); }
  G.lock = true; document.body.classList.add('cine');
  G.camOverride = { pos: new V3((player.pos.x + boss.pos.x) / 2 + 5, 3, (player.pos.z + boss.pos.z) / 2 + 5), look: new V3(boss.pos.x, 2.5, boss.pos.z) };
  await wait(1.2);
  document.body.classList.remove('cine'); G.lock = false;
  await say([['b', '이… 빛은…… 기억해 두마, 이름 없는 자……']]);
  G.lock = true; document.body.classList.add('cine');
  G.camOverride = { pos: new V3(SANC.x + 3, 4, SANC.z + 15), look: new V3(SANC.x, 4.5, SANC.z) };
  altarPower = 2.6; sfx('level'); burst(new V3(SANC.x, 4.3, SANC.z), 0xffffff, 120, 9, 0.5, 1.6, 0, 0); G.shake = 0.8;
  nightT = DUSK; riftK = -1;
  await wait(3.2);
  altarPower = 1.25;
  document.body.classList.remove('cine'); G.camOverride = null; G.lock = false;
  await say([
    ['k', '해냈구나… 들리느냐? 크리스탈이 다시 노래하고 있다.'],
    ['k', '허나 균열은 이것 하나가 아니다. 북쪽 숲 너머에서도 같은 어둠이 꿈틀거리고 있어.'],
    ['k', '오늘부터 너는 「룬의 수호자」다. 광장으로 돌아가 쉬어라. 다음 여정이 널 기다린다.'],
  ]);
  const first = !S.cleared;
  S.cleared++; S.step = 11; S.pts += 5; save();
  gainExp(first ? 250 : 120);
  refreshHud();
  await chapterCard('CHAPTER I · CLEAR', '꺼져가는 룬', '제 1 장 완료',
    `보상 &nbsp; <em>EXP +${first ? 250 : 120}</em> · <em>스탯 포인트 +5</em>${first ? ' · 칭호 <em>「룬의 수호자」</em>' : ''}<br><span style="opacity:.7">다음 이야기 · 제 2 장 「공허의 숲」 — 준비 중</span>`, '광장으로 귀환');
  busy = false;
  leaveStory();
}
async function talkKeeper(){
  if (busy || dead) return;
  if (S.step <= 2) return intro();
  if (S.step === 3) return say([['k', '허수아비 셋을 모두 쓰러뜨려 보거라. 세 번 이어 베면 회전베기가 나간다.']]);
  if (S.step === 4) return keeperRune();
  if (S.step >= 5 && S.step <= 10){ if (!wave && !boss) return say([['k', '서둘러라. 크리스탈의 빛이 얼마 남지 않았다.']]); return; }
  if (S.step === 11){
    busy = true;
    const r = await say([['k', '균열의 잔재가 아직 꿈틀거린다. 다시 맞서 보겠느냐? (적이 더 강해진다)', ['맞선다', '다음에']]]);
    busy = false;
    if (r === 0){ S.step = 5; save(); keeperAt('sanc'); goSanctuary(); }
  }
}
async function askReturn(){
  if (busy || dead) return;
  const r = await say([['sys', '광장으로 돌아가겠습니까? 진행 상황은 저장되고, 싸우던 웨이브는 다음에 처음부터 다시 시작합니다.', ['돌아간다', '머무른다']]]);
  if (r === 0) leaveStory();
}
NAMES.sys = '귀환의 룬진';

// ───────────────────────── 광장 ↔ 스토리 (텔레포트) ─────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
let tpBusy = false;
async function teleport(name, sub, fn){
  if (tpBusy) return; tpBusy = true;
  tpEl.querySelector('.n').textContent = name; tpEl.querySelector('.a').textContent = sub;
  sfx('rune'); G.lock = true; tpEl.classList.add('on');
  await sleep(900);
  fn();
  await sleep(700);
  tpEl.classList.remove('on'); G.lock = false; tpBusy = false;
}
function stepText(){
  const st = S.step;
  if (st === 0) return '처음 시작';
  if (st <= 3) return '진행 중 · 야영지에서 검술 훈련';
  if (st === 4) return '진행 중 · 엘드라에게 돌아가기';
  if (st === 5) return '진행 중 · 성소로 향하는 길';
  if (st <= 8) return `진행 중 · 균열 방어 웨이브 ${st - 5} / 3`;
  if (st === 9) return '진행 중 · 크리스탈에 조각 바치기';
  if (st === 10) return '진행 중 · 공허의 기사와의 결전';
  return `클리어 ${S.cleared}회 · 다시 도전하면 적이 강해진다`;
}
function openMenu(){
  if (G.area !== 'plaza' || tpBusy) return;
  smenu.querySelector('.c1 .pg').textContent = stepText();
  smenu.querySelector('.c1 .go').textContent = S.step === 0 ? '입장' : S.step === 11 ? '다시 입장' : '이어하기';
  smenu.classList.add('on'); sfx('ui');
}
smenu.querySelector('.x').onclick = () => smenu.classList.remove('on');
smenu.querySelector('.c1 .go').onclick = () => { smenu.classList.remove('on'); enterStory(); };
$('mStory').onclick = openMenu;
$('mMini').onclick = () => G.toast('미니 게임', '곧 열립니다');
$('mStat').onclick = () => toggleStats();
bReturn.onclick = () => askReturn();
const crystalIt = G.INTERACT.find(i => i.title === '룬 크리스탈');
if (crystalIt){ crystalIt.title = '룬 크리스탈 · 스토리 모드'; crystalIt.r = 6.2; crystalIt.action = openMenu; }
function enterStory(){
  teleport('황혼의 룬 성소', 'CHAPTER I · TWILIGHT SANCTUARY', () => {
    G.setArea('story'); inStory = true; hint('', 0); smenu.classList.remove('on');
    player.pos.copy(ARRIVE); player.vy = 0; player.fig.root.rotation.y = Math.PI; G.setCam(0, 0.3);
    G.scene.fog.density = 0.011;
    nightT = DUSK; nightK = DUSK; G.setNight(nightK);
    if (S.sword) giveSword(); if (sword) sword.visible = true;
    document.body.classList.toggle('combat', !!S.sword);
    const d = D(); hp = d.maxHp; mp = d.maxMp; refreshHud();
    burst(new V3(ARRIVE.x, 0.5, ARRIVE.z), 0x7ff3ff, 50, 4, 0.3, 1.0, 2, 3);
    setTimeout(resumeStory, 600);
  });
}
function cleanupStory(){
  wave = null; sancTrigger = null; boss = null; bossEl.classList.remove('on'); closePortals(); rift.visible = false; riftK = 0;
  for (const e of ENEMIES.slice()){ if (e.root) SW.remove(e.root); if (e.g) SW.remove(e.g); e.bar.remove(); }
  ENEMIES.length = 0; for (const o of ORBS) SW.remove(o.s); ORBS.length = 0;
  for (const o of XPO){ SW.remove(o.s); gainExp(o.val); } XPO.length = 0;
  if (shard){ SW.remove(shard.g); shard = null; }
  TIMERS.length = 0; clearObj(); hint('', 0); G.camOverride = null; atk = roll = cast = null;
}
function leaveStory(){
  teleport('룬의 광장', 'THE RUNE AGORA', () => {
    cleanupStory();
    G.setArea('plaza'); inStory = false;
    player.pos.set(0, 0.04, 9); player.vy = 0; player.fig.root.rotation.y = 0; G.setCam(Math.PI, 0.3);
    G.scene.fog.density = 0.0034; nightT = 0; nightK = 0; G.setNight(0);
    if (sword) sword.visible = false; document.body.classList.remove('combat');
    $('keys').innerHTML = '<b>W</b><b>A</b><b>S</b><b>D</b> 이동 &nbsp; <b>Shift</b> 달리기 &nbsp; <b>Space</b> 점프 &nbsp; 드래그 시점 &nbsp; <b>C</b> 스탯 &nbsp; <b>E</b> 상호작용';
    G.mapEnemies = []; G.mapMarkers = [];
    const d = D(); hp = d.maxHp; mp = d.maxMp; refreshHud();
  });
}
function resumeStory(){
  const st = S.step;
  keeperAt(st >= 5 && st <= 10 ? 'sanc' : 'camp');
  if (st <= 2){ intro(); return; }
  if (st === 3){ spawnDummies(); setObj('허수아비로 검술 연습', '쓰러뜨린 허수아비 0 / 3', () => new V3(0, 0, 33)); altarPower = 0.6; return; }
  if (st === 4){ setObj('엘드라에게 돌아가기', '검술을 익혔다', keeperPos); return; }
  if (st >= 5 && st <= 10){
    if (st >= 6){ nightT = 1; altarPower = st === 9 ? 0.85 : st === 10 ? 0.4 : 0.25 + (st - 6) * 0.2; }
    goSanctuary(); return;
  }
  setObj('엘드라와 대화해 다시 도전', `1장 클리어 ${S.cleared}회 · 다시 도전할수록 적이 강해진다`, keeperPos); altarPower = 1.25;
}

// ───────────────────────── 입력 ─────────────────────────
G.onKey = (code) => {
  if (dialogOpen){ if (code === 'KeyE' || code === 'Space' || code === 'Enter' || code === 'KeyJ'){ dlgAdvance && dlgAdvance(); return true; } return code !== 'KeyC'; }
  if (code === 'Escape' && smenu.classList.contains('on')){ smenu.classList.remove('on'); return true; }
  if (code === 'KeyC' || (code === 'Escape' && statOpen)){ toggleStats(); return true; }
  if (G.lock) return true;
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
    nightK += (nightT - nightK) * Math.min(1, rdt * 0.45); if (Math.abs(nightT - nightK) < 0.002) nightK = nightT;
    G.setNight(nightK);
    if (rift.visible){ rift.material.uniforms.uTime.value += rdt; if (riftK > 0) riftK = Math.min(1, riftK + rdt * 0.6); else if (riftK < 0){ riftK = Math.max(-1, riftK - rdt * 0.5); } const o = riftK > 0 ? riftK : 1 + riftK; rift.material.uniforms.uO.value = o; rift.scale.set(0.3 + 0.7 * o, o, 1); if (riftK <= -1){ rift.visible = false; riftK = 0; } }
    updateCombat(dt);
    const alive = updateEnemies(dt);
    updateOrbs(dt); updateXPO(dt); updateShard(dt); updatePortals(dt); updateWave(dt, alive); updateParticles(dt); updateFXL(dt);
    if (boss && boss.state === 'dying' && !boss.handled){ boss.handled = true; later(0.6, bossDefeated); }
    if (sancTrigger && !busy && !G.lock && Math.hypot(player.pos.x - SANC.x, player.pos.z - SANC.z) < SANC_R - 4){ const f = sancTrigger; sancTrigger = null; f(); }
    // 엘드라
    const kp = keeper.root.position, kd = Math.hypot(player.pos.x - kp.x, player.pos.z - kp.z);
    if (!dialogOpen && kd < 8){ const a = Math.atan2(player.pos.x - kp.x, player.pos.z - kp.z); keeper.root.rotation.y += angDiff(a, keeper.root.rotation.y) * Math.min(1, dt * 2); }
    const kpz = Object.assign({}, KEEPER_POSE); kpz.hy += Math.sin(G.time * 1.6) * 0.006; if (nightT > 0.5 && !dialogOpen){ kpz.lax = -2.2; kpz.laz = 0.5; kpz.le = -0.2; }
    keeper.set(kpz); keeper.blend(dt, 4);
    // 제단 크리스탈
    const A = altar, pw = altarPower;
    A.crys.rotation.y += dt * 0.6; A.g.position.y = 4.3 + Math.sin(G.time * 1.1) * 0.2;
    A.crys.material.emissiveIntensity = 2.4 * pw; A.halo.material.opacity = Math.min(1, 0.7 * pw) * (0.85 + 0.15 * Math.sin(G.time * 2.3)); A.halo.scale.setScalar(7 * (0.6 + 0.4 * pw));
    A.pl.intensity = 22 * pw; for (const r of A.rings){ r.piv.rotation.y += dt * r.spd * (0.3 + 0.7 * Math.min(1, pw)); r.piv.visible = pw > 0.25; }
    campLight.intensity = 16 + Math.sin(G.time * 13) * 2.5 + Math.sin(G.time * 29) * 1.5;
    FX.arriveRing.rotation.y += dt * 0.3;
  } else {
    G.poseMod = null; G.poseK = 0; G.speedMul = D().spd; G.moveMul = 1; G.faceLock = false; G.noJump = false;
    updateParticles(dt);
  }
  // 브론 (광장 대장간, 망치질)
  if (smith && !inStory){
    smithT += dt;
    const sd = Math.hypot(player.pos.x - smith.root.position.x, player.pos.z - smith.root.position.z);
    const cyc = (smithT % 1.1) / 1.1, up = cyc < 0.7 ? ease(cyc / 0.7) : 1 - ease((cyc - 0.7) / 0.3);
    smith.set(G.pose({ rax: -0.7 - 1.8 * up, re: -0.6 - 0.6 * up, lax: -0.7, le: -0.8, sp: 0.25, hd: 0.3, llx: -0.2, rlx: 0.2 })); smith.blend(dt, 18);
    if (cyc < smithT0 && anvilTop && sd < 18){ sfx('clang'); }
    smithT0 = cyc;
  }
  // 마커
  if (markerTarget && inStory){ const p = markerTarget(); marker.visible = true; marker.position.set(p.x, (p.y || 0) + 2.9 + Math.sin(G.time * 3) * 0.15, p.z); G.mapMarkers = [{ x: p.x, z: p.z }]; }
  else { marker.visible = false; G.mapMarkers = []; }
  // UI
  if (bannerT > 0){ bannerT -= rdt; if (bannerT <= 0) bannerEl.classList.remove('on'); }
  if (hintT > 0){ hintT -= rdt; if (hintT <= 0) hintEl.classList.remove('on'); }
  if (expT > 0){ expT -= rdt; if (expT <= 0 && expAcc > 0){ dmgNum(new V3(player.pos.x, player.pos.y + 2.3, player.pos.z), '+' + Math.round(expAcc) + ' EXP', 'xp'); expAcc = 0; } }
  const d = D();
  hpB.style.width = clamp(hp / d.maxHp * 100, 0, 100) + '%'; mpB.style.width = clamp(mp / d.maxMp * 100, 0, 100) + '%';
  const rb = $('cRune'); rb.classList.toggle('dis', !S.rune); rb.querySelector('i').style.height = (S.rune ? runeCd / d.cd * 100 : 0) + '%';
});

// ───────────────────────── 시작 ─────────────────────────
refreshHud();
const waitStart = setInterval(() => { if (G.playing){ clearInterval(waitStart); setTimeout(() => { if (G.area === 'plaza') hint('오른쪽 <b>스토리 모드</b> 버튼을 눌러 모험을 시작하세요', 7); }, 5500); } }, 300);
window.__story = { S, ENEMIES, spawnEnemy, startWave, startBoss: () => startBoss(true), giveSword, setStep: s => { S.step = s; save(); }, D, get hp(){ return hp; }, intro, keeperRune, invasion, deliverShards, enterStory, leaveStory, openMenu, SANC, CAMP, ARRIVE };
}
