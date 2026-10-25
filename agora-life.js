// 룬 아고라 — 모험의 대지: life (살아 숨 쉬는 세계)
// 사냥터 스폰 · 리스폰 / 새 몬스터 4종 (얼음 늑대 · 서리 골렘 · 설인 · 가시 망령) / 필드 보스 / NPC 피규어
// 봇 모험가 (가짜 플레이어) / 채팅창 / 감정표현 (T) / 작은 동물들 (나비 · 새 떼 · 토끼 · 개구리 · 물고기 · 독수리 · 반딧불)
// 계약서: docs/agora-modules.md
export async function init(G, X, F){
const { THREE, V3, BUS, R, rr, pick, clamp, ease, TAU, angDiff } = X;
const W = F.WORLD, S = X.S, FW = F.FW, MK = X.MK, P = X.player.pos;
const LOW = G.gfxMode === 'low' || G.IS_TOUCH;
S.life = Object.assign({ fbIdx: 0, fbKills: 0, chatMin: !!G.IS_TOUCH, tab: 'all', emo: 0 }, S.life || {});
let T = 0;                                  // 필드 시계 (필드에 있을 때만 흘러요)
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const dP = (x, z) => Math.hypot(x - P.x, z - P.z);
const gnd = (x, z) => F.groundFn ? F.groundFn(x, z) : F.H(x, z);
const ri = (a, b) => a + ((R() * (b - a + 1)) | 0);
const wpick = list => { let s = 0; for (const o of list) s += o[1]; let r = R() * s; for (const o of list){ r -= o[1]; if (r <= 0) return o[0]; } return list[0][0]; };
const TM = (g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => g.applyMatrix4(G.mat(x, y, z, rx, ry, rz, sx, sy, sz));
const merge = list => G.mergeGeos(list);
const GC = {}; const once = (k, fn) => GC[k] || (GC[k] = fn());
const mesh = (geo, mat, parent, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; if (parent) parent.add(m); return m; };
const ERR = {}; const guard = (k, fn) => { try { fn(); } catch (e){ if (!ERR[k] || ERR[k] < 3){ ERR[k] = (ERR[k] || 0) + 1; console.error('[life]', k, e); } } };
const LATER = []; const later = (s, fn) => LATER.push({ at: T + s, fn });   // X.later 는 텔레포트 때 지워져서 따로 둬요
const hasMod = n => F.modules && F.modules[n];
const jo = (w, a, b) => { const c = String(w).trim().slice(-1).charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? a : b; };   // 받침 따라 조사 (을/를 · 이/가)

// ───────────────────────── 스타일 ─────────────────────────
const css = document.createElement('style');
css.textContent = `
  #flabels .fl.bot { color:#bfe9ff; font:700 11.5px 'Noto Sans KR'; }
  #flabels .fl.bot i { font-style:normal; font:800 10px 'Noto Sans KR'; color:#ffe08a; margin-right:3px; }
  #flabels .fl.bot small { color:#9fd8a8; font:600 9.5px 'Noto Sans KR'; }
  #flabels .fl.bot.afk small { color:#c8c8d8; }
  #flabels .fl.npc { font:800 12.5px 'Gowun Batang'; }
  #flabels .fl.npc small { color:#e8d8a8; font:500 10px 'Noto Sans KR'; }
  #flabels .fl.bub { white-space:normal; width:max-content; max-width:210px; padding:5px 11px 6px; border-radius:13px; background:rgba(255,253,246,.95); color:#2a2418; text-shadow:none;
    font:600 12px/1.35 'Noto Sans KR'; box-shadow:0 3px 10px rgba(0,0,0,.35); border:1px solid rgba(233,200,126,.7); animation:lbub .22s ease-out; }
  #flabels .fl.bub::after { content:''; position:absolute; left:50%; bottom:-6px; margin-left:-6px; border:6px solid transparent; border-bottom:0; border-top-color:rgba(255,253,246,.95); }
  #flabels .fl.bub.me { background:rgba(226,252,255,.96); border-color:rgba(127,243,255,.8); } #flabels .fl.bub.me::after { border-top-color:rgba(226,252,255,.96); }
  #flabels .fl.bub.npcb { background:rgba(255,246,220,.97); border-color:rgba(233,180,90,.9); }
  #flabels .fl.bub.emo { padding:2px 7px; font-size:22px; line-height:1.15; background:rgba(255,253,246,.9); }
  @keyframes lbub { from { transform:translate(-50%,-80%) scale(.6); opacity:0; } }
  #ehp .d.bot { font:800 12px 'Noto Sans KR'; color:#d8e6f2; opacity:.85; }
  #lchat { position:absolute; left:14px; bottom:calc(max(14px, env(safe-area-inset-bottom)) + 36px); width:min(340px, calc(50vw - 268px)); display:none; flex-direction:column; pointer-events:auto; z-index:6;
    font:500 12px/1.42 'Noto Sans KR'; color:#eef0ea; border-radius:12px; background:rgba(8,12,22,0); border:1px solid rgba(233,200,126,0); transition:background .3s, border-color .3s, opacity .4s; }
  body[data-area="field"] #lchat { display:flex; }
  #lchat:hover, #lchat.typing { background:rgba(8,12,22,.72); border-color:rgba(233,200,126,.4); }
  #lchat .tb { display:flex; gap:2px; padding:4px 6px 0; align-items:center; opacity:.0; transition:opacity .3s; }
  #lchat:hover .tb, #lchat.typing .tb, #lchat.min .tb, body.touch #lchat .tb { opacity:1; }
  #lchat .tb button { font:700 11px 'Noto Sans KR'; color:#b8b8a8; background:none; border:0; padding:3px 8px; border-radius:9px; cursor:pointer; }
  #lchat .tb button.on { color:#ffe9b0; background:rgba(233,200,126,.18); }
  #lchat .tb .sp { flex:1; } #lchat .tb .mn { color:#e9c87e; font-size:12px; padding:2px 6px; }
  #lchat .lg { height:132px; overflow:hidden; padding:2px 10px 4px; display:flex; flex-direction:column; justify-content:flex-end; -webkit-mask-image:linear-gradient(transparent, #000 22px); mask-image:linear-gradient(transparent, #000 22px); }
  #lchat .ln { text-shadow:0 1px 2px #000, 0 0 3px rgba(0,0,0,.8); word-break:keep-all; overflow-wrap:anywhere; animation:lcin .25s ease-out; transition:opacity 1.2s; }
  #lchat .ln.old { opacity:.55; } #lchat:hover .ln.old, #lchat.typing .ln.old { opacity:1; }
  @keyframes lcin { from { opacity:0; transform:translateX(-8px); } }
  #lchat .ln i { font-style:normal; font-weight:700; margin-right:3px; } #lchat .ln b { font-weight:800; color:#9fd8ff; }
  #lchat .ln.k-local b { color:#fff; } #lchat .ln.k-me b { color:#7ff3ff; } #lchat .ln.k-npc b { color:#ffe08a; }
  #lchat .ln.k-party i { color:#7affa8; } #lchat .ln.k-trade i { color:#ffc86a; } #lchat .ln.k-world i { color:#8ac8ff; }
  #lchat .ln.k-sys { color:#ffe08a; } #lchat .ln.k-sys i { color:#ffd36a; } #lchat .ln.k-boss { color:#ffb0a0; } #lchat .ln.k-boss i { color:#ff6a5a; }
  #lchat .ln.k-raid { color:#e2ccff; } #lchat .ln.k-raid i { color:#c08aff; } #lchat .ln.k-rare { color:#ffd8a0; } #lchat .ln.k-rare i { color:#ffa63a; }
  #lchat .ln .it { color:#ffb03a; font-weight:800; } #lchat .ln .leg { color:#ffb03a; } #lchat .ln .epi { color:#c07aff; }
  #lchat[data-t="talk"] .ln.k-sys, #lchat[data-t="talk"] .ln.k-boss, #lchat[data-t="talk"] .ln.k-raid, #lchat[data-t="talk"] .ln.k-rare { display:none; }
  #lchat[data-t="sys"] .ln:not(.k-sys):not(.k-boss):not(.k-raid):not(.k-rare) { display:none; }
  #lchat .in { display:none; align-items:center; gap:6px; margin:2px 6px 6px; padding:4px 8px; border-radius:9px; background:rgba(0,0,0,.45); border:1px solid rgba(127,243,255,.45); }
  #lchat.typing .in { display:flex; }
  #lchat .in span { font:700 11px 'Noto Sans KR'; color:#7ff3ff; white-space:nowrap; }
  #lchat .in input { flex:1; min-width:0; background:none; border:0; outline:0; color:#fff; font:500 13px 'Noto Sans KR'; }
  #lchat .tb .hk { font:500 10px 'Noto Sans KR'; font-style:normal; color:rgba(255,255,255,.4); margin-right:4px; white-space:nowrap; }
  #lchat.min .tb .hk, body.touch #lchat .tb .hk { display:none; }
  #lchat.min .tb button:not(.mn), #lchat.min .tb .sp { display:none; } #lchat.min { width:min(300px, 40vw); }
  #lchat.min .lg { height:38px; }
  body:not(.touch) #lchat.min .tb { position:absolute; right:0; top:-22px; }
  body.touch #lchat.min .tb { display:none; }
  body.cine #lchat, body.shopping #lchat { opacity:0; pointer-events:none; }
  body.touch #lchat { bottom:auto; top:calc(max(14px, env(safe-area-inset-top)) + 104px); width:min(300px, 44vw); }
  body.touch #lchat .lg { height:96px; } body.touch #lchat.min .lg { height:36px; }
  @media (max-width:1060px){ body:not(.touch) #lchat { bottom:106px; width:min(300px, 36vw); } }
  @media (max-height:520px){ #lchat .lg { height:104px; } }
  @media (max-width:560px){ #lchat { width:56vw; } body.touch #lchat { width:56vw; } }
  #lparty { position:absolute; left:132px; top:calc(max(14px, env(safe-area-inset-top)) + 64px); display:none; align-items:center; gap:7px; padding:5px 8px 5px 6px; border-radius:18px; pointer-events:auto;
    background:linear-gradient(90deg, rgba(20,60,40,.85), rgba(10,14,24,.75)); border:1px solid rgba(122,255,168,.55); font:700 12px 'Noto Sans KR'; color:#eafff0; box-shadow:0 4px 12px rgba(0,0,0,.35); }
  body[data-area="field"] #lparty.on { display:flex; animation:lpin .3s ease-out; } @keyframes lpin { from { transform:translateX(-14px); opacity:0; } }
  #lparty .ic { width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(122,255,168,.2); font-size:13px; }
  #lparty b { font-weight:800; } #lparty b em { font-style:normal; color:#ffe08a; font-size:10px; margin-right:3px; }
  #lparty i { display:block; width:54px; height:4px; border-radius:2px; background:rgba(255,255,255,.15); overflow:hidden; } #lparty i s { display:block; height:100%; width:100%; background:linear-gradient(90deg,#3ad86a,#9affb0); transition:width .3s; }
  #lparty button { font:700 11px 'Noto Sans KR'; color:#cfe8d8; background:none; border:0; cursor:pointer; padding:0 2px; }
  body.cine #lparty, body.shopping #lparty { opacity:0; pointer-events:none; }
  #loffer { position:absolute; left:50%; top:calc(max(14px, env(safe-area-inset-top)) + 70px); transform:translateX(-50%); display:none; flex-direction:column; align-items:center; gap:5px; padding:10px 16px 12px; min-width:250px; border-radius:12px; pointer-events:auto; z-index:7;
    background:rgba(16,20,34,.94); border:1px solid rgba(233,200,126,.6); box-shadow:0 8px 26px rgba(0,0,0,.5); text-align:center; }
  body[data-area="field"] #loffer.on { display:flex; animation:lpin .3s ease-out; }
  #loffer b { font:800 14px 'Gowun Batang'; color:#ffe9b0; letter-spacing:.06em; } #loffer span { font:500 12px 'Noto Sans KR'; color:#dfe6ea; }
  #loffer div { display:flex; gap:8px; margin-top:3px; } #loffer button { font:700 12px 'Noto Sans KR'; padding:6px 18px; border-radius:16px; cursor:pointer; border:1px solid rgba(233,200,126,.5); color:#fff3d6; background:rgba(255,255,255,.06); }
  #loffer button.y { background:linear-gradient(#3a9a5a,#1f6a3a); border-color:#7affa8; }
  #loffer > i { display:block; width:100%; height:3px; border-radius:2px; background:rgba(255,255,255,.12); overflow:hidden; } #loffer > i s { display:block; height:100%; background:#e9c87e; }
  body.cine #loffer { opacity:0; pointer-events:none; }
  #flabels .fl.bot.pt { color:#8affb0; }
  #emw { position:fixed; inset:0; z-index:27; display:none; background:radial-gradient(circle at 50% 50%, rgba(8,12,22,.0) 0, rgba(8,12,22,.35) 60%); }
  #emw.on { display:block; animation:emin .18s ease-out; } @keyframes emin { from { opacity:0; } }
  #emw .rg { position:absolute; left:50%; top:50%; width:290px; height:290px; margin:-145px 0 0 -145px; border-radius:50%;
    background:radial-gradient(circle, rgba(16,20,34,.55) 0 27%, rgba(233,200,126,.5) 27.4%, rgba(16,20,34,.92) 28.2% 66%, rgba(233,200,126,.45) 66.4%, transparent 67.4%); box-shadow:0 10px 40px rgba(0,0,0,.45); }
  #emw .ct { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); text-align:center; pointer-events:none; }
  #emw .ct b { display:block; font:800 15px 'Gowun Batang'; color:#ffe9b0; letter-spacing:.08em; } #emw .ct small { font:500 10px 'Noto Sans KR'; color:#b8b0a0; }
  #emw button { position:absolute; width:66px; height:66px; margin:-33px 0 0 -33px; border-radius:50%; cursor:pointer; color:#fff3d6; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px;
    background:radial-gradient(circle at 50% 35%, rgba(70,82,110,.9), rgba(16,20,34,.95)); border:1px solid rgba(233,200,126,.55); box-shadow:0 4px 12px rgba(0,0,0,.4); transition:transform .12s, box-shadow .12s; }
  #emw button:hover { transform:scale(1.12); box-shadow:0 0 18px rgba(233,200,126,.55); border-color:#ffe08a; }
  #emw button span { font-size:24px; line-height:1; } #emw button b { font:700 10px 'Noto Sans KR'; } #emw button kbd { position:absolute; top:-3px; right:2px; font:700 9px 'Cinzel'; color:#e9c87e; }
  body.touch #emw button kbd { display:none; }
`;
document.head.appendChild(css);

// ═════════════════════════ 1. 새 몬스터 4종 ═════════════════════════
const sm = MK.sm, face = MK.face;
// 얼음 늑대 — 빠른 돌진 2연타
function mkWolf(){
  const g = new THREE.Group(), body = new THREE.Group(), core = new THREE.Group(); g.add(body); body.add(core); core.scale.setScalar(1.32);
  const fur = sm(0xc6d6ea, { flatShading: true, roughness: 0.75 }), dark = sm(0x34476a, { flatShading: true, roughness: 0.7 }), ice = sm(0xb8f6ff, { emissive: 0x2ab8ff, emissiveIntensity: 0.75, roughness: 0.12, flatShading: true });
  mesh(once('wolfFur', () => merge([TM(new THREE.IcosahedronGeometry(0.42, 1), 0, 0.78, -0.04, 0, 0, 0, 0.95, 0.85, 1.55), TM(new THREE.IcosahedronGeometry(0.33, 1), 0, 0.84, 0.46, 0, 0, 0, 1.15, 1.05, 0.85),
    TM(new THREE.IcosahedronGeometry(0.2, 0), 0, 0.62, 0.62, 0.4, 0, 0, 1, 1, 1)])), fur, core);
  mesh(once('wolfDark', () => merge([TM(new THREE.IcosahedronGeometry(0.4, 1), 0, 0.98, -0.12, 0, 0, 0, 0.78, 0.42, 1.3)])), dark, core);
  mesh(once('wolfIce', () => merge([0.36, 0.08, -0.2, -0.46].map((z, i) => TM(new THREE.OctahedronGeometry(0.1 + (i % 2) * 0.03, 0), (i % 2 ? 0.06 : -0.05), 1.16 - i * 0.02, z, -0.5, 0, (i % 2 ? -0.2 : 0.2), 0.6, 2.3, 0.6)))), ice, core);
  const head = new THREE.Group(); head.position.set(0, 1.02, 0.68); core.add(head);
  mesh(once('wolfHead', () => merge([TM(new THREE.IcosahedronGeometry(0.27, 1), 0, 0, 0, 0, 0, 0, 1, 0.9, 1.05), TM(new THREE.CylinderGeometry(0.1, 0.15, 0.32, 7), 0, -0.07, 0.3, Math.PI / 2, 0, 0, 1, 1, 0.85),
    ...[-1, 1].flatMap(s => [TM(new THREE.ConeGeometry(0.095, 0.26, 4), s * 0.15, 0.25, -0.05, 0, 0, -s * 0.25), TM(new THREE.IcosahedronGeometry(0.11, 0), s * 0.21, -0.1, 0.03, 0, 0, 0, 1, 0.8, 1.2), TM(new THREE.ConeGeometry(0.024, 0.09, 4), s * 0.05, -0.19, 0.4, Math.PI, 0, 0)])])), fur, head);
  mesh(once('wolfHeadD', () => merge([TM(new THREE.SphereGeometry(0.055, 8, 6), 0, -0.03, 0.47), ...[-1, 1].map(s => TM(new THREE.ConeGeometry(0.05, 0.14, 4), s * 0.15, 0.24, -0.02, 0, 0, -s * 0.25)), TM(new THREE.BoxGeometry(0.16, 0.02, 0.02), 0, -0.15, 0.4)])), dark, head);
  face(head, 0.07, 0.25, 0.85, 0.12);
  const legs = [];
  for (const [x, z] of [[-0.2, 0.36], [0.2, 0.36], [-0.2, -0.44], [0.2, -0.44]]){ const pv = new THREE.Group(); pv.position.set(x, 0.64, z); core.add(pv); legs.push(pv);
    mesh(once('wolfLeg', () => merge([TM(new THREE.CylinderGeometry(0.075, 0.06, 0.5, 6), 0, -0.25, 0), TM(new THREE.SphereGeometry(0.085, 8, 6), 0, -0.55, 0.03, 0, 0, 0, 1, 0.7, 1.3)])), fur, pv); }
  const tail = new THREE.Group(); tail.position.set(0, 0.92, -0.7); core.add(tail);
  mesh(once('wolfTail', () => merge([TM(new THREE.ConeGeometry(0.13, 0.7, 6), 0, 0.12, -0.3, -2.05, 0, 0)])), fur, tail);
  mesh(once('wolfTailI', () => TM(new THREE.OctahedronGeometry(0.07, 0), 0, 0.27, -0.62, 0, 0, 0, 0.7, 1.6, 0.7)), ice, tail);
  return { g, body, mats: [fur, dark, ice], legs, head, tail, kind: 'wolf' };
}
// 서리 골렘 — 내려찍기 + 얼음 결정
function mkFrostGolem(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const rock = sm(0x8db2cf, { flatShading: true, roughness: 0.5, metalness: 0.05 }), snow = sm(0xf6fbff, { flatShading: true, roughness: 0.9 }),
    ice = sm(0xc4f6ff, { emissive: 0x2aa8ff, emissiveIntensity: 0.85, roughness: 0.08, flatShading: true });
  mesh(once('fgRock', () => merge([TM(new THREE.IcosahedronGeometry(0.78, 0), 0, 1.08, 0, 0, 0.3, 0, 1.05, 0.95, 0.85), TM(new THREE.IcosahedronGeometry(0.5, 0), 0, 0.55, -0.02, 0, 0, 0, 1.15, 0.8, 0.9),
    ...[-1, 1].map(s => TM(new THREE.DodecahedronGeometry(0.27, 0), s * 0.32, 0.24, 0.04, 0, s, 0, 1, 0.9, 1.1))])), rock, body);
  mesh(once('fgSnow', () => merge([TM(new THREE.IcosahedronGeometry(0.66, 1), 0, 1.62, -0.03, 0, 0, 0, 1.12, 0.36, 1.02), ...[-1, 1].map(s => TM(new THREE.IcosahedronGeometry(0.3, 1), s * 0.64, 1.5, 0, 0, 0, s * 0.3, 1.2, 0.42, 1))])), snow, body);
  mesh(once('fgIce', () => merge([[-0.35, 1.86, -0.24, -0.4, 0.3, 1], [0.08, 1.98, -0.34, -0.5, 0, 1.25], [0.42, 1.82, -0.2, -0.3, -0.35, 0.95], [0.66, 1.72, 0.04, 0.1, -0.7, 0.8], [-0.62, 1.7, 0.06, 0.1, 0.7, 0.75]]
    .map(([x, y, z, rx, rz, s]) => TM(new THREE.OctahedronGeometry(0.18 * s, 0), x, y, z, rx, 0, rz, 0.55, 2.5, 0.55)).concat([TM(new THREE.OctahedronGeometry(0.17, 0), 0, 0.98, 0.66, 0, 0, 0, 1, 1.3, 0.6)]))), ice, body);
  face(body, 1.3, 0.6, 1.05, 0.16);
  const arms = [];
  for (const s of [-1, 1]){ const pv = new THREE.Group(); pv.position.set(s * 0.84, 1.32, 0.05); body.add(pv); arms.push(pv);
    mesh(once('fgArm' + s, () => merge([TM(new THREE.IcosahedronGeometry(0.26, 0), s * 0.1, -0.3, 0), TM(new THREE.IcosahedronGeometry(0.37, 0), s * 0.12, -0.74, 0.08, 0.3, 0, 0.2)])), rock, pv);
    mesh(once('fgArmI' + s, () => merge([TM(new THREE.OctahedronGeometry(0.1, 0), s * 0.2, -0.45, 0.12, 0.3, 0, -s * 0.5, 0.5, 1.9, 0.5), TM(new THREE.OctahedronGeometry(0.09, 0), s * 0.02, -0.46, -0.06, -0.3, 0, s * 0.3, 0.5, 1.7, 0.5)])), ice, pv); }
  return { g, body, mats: [rock, snow, ice], arms, ice, kind: 'frostgolem' };
}
// 설인 — 큰 내려찍기 + 포효
function mkYeti(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const fur = sm(0xf3f5fa, { flatShading: true, roughness: 0.95 }), skin = sm(0x6c82a8, { flatShading: true, roughness: 0.7 }), horn = sm(0xd8cbb0, { flatShading: true, roughness: 0.55 });
  mesh(once('yFur', () => { const L = [TM(new THREE.IcosahedronGeometry(0.85, 1), 0, 1.38, 0, 0, 0, 0, 1.05, 1.0, 0.85), TM(new THREE.IcosahedronGeometry(0.6, 1), 0, 0.82, -0.05, 0, 0, 0, 1.1, 0.75, 0.9)];
    for (let i = 0; i < 9; i++){ const a = i / 9 * TAU + 0.4, y = 1.0 + (i % 3) * 0.32; L.push(TM(new THREE.IcosahedronGeometry(0.26 + (i % 2) * 0.06, 0), Math.cos(a) * 0.82, y, Math.sin(a) * 0.66 - 0.06, i, i * 2, 0)); }
    return merge(L); }), fur, body);
  mesh(once('yBelly', () => TM(new THREE.SphereGeometry(0.5, 10, 8), 0, 1.25, 0.42, 0, 0, 0, 1, 1.15, 0.5)), skin, body);
  const head = new THREE.Group(); head.position.set(0, 2.15, 0.22); body.add(head);
  mesh(once('yHead', () => merge([TM(new THREE.IcosahedronGeometry(0.46, 1), 0, 0, 0, 0, 0, 0, 1, 0.9, 0.95), TM(new THREE.IcosahedronGeometry(0.2, 0), 0, 0.32, -0.12, 0.4, 0, 0),
    ...[-1, 1].map(s => TM(new THREE.ConeGeometry(0.035, 0.1, 4), s * 0.07, -0.13, 0.49, Math.PI, 0, 0))])), fur, head);
  mesh(once('yFace', () => TM(new THREE.SphereGeometry(0.34, 12, 10), 0, -0.05, 0.27, 0, 0, 0, 1, 0.86, 0.5)), skin, head);
  mesh(once('yHorn', () => merge([-1, 1].flatMap(s => [TM(new THREE.ConeGeometry(0.085, 0.36, 6), s * 0.36, 0.26, -0.02, 0, 0, -s * 0.95), TM(new THREE.ConeGeometry(0.05, 0.2, 6), s * 0.5, 0.45, -0.02, 0, 0, -s * 0.2)]))), horn, head);
  mesh(once('yMouth', () => TM(new THREE.SphereGeometry(0.14, 10, 8), 0, -0.2, 0.42, 0, 0, 0, 1.4, 0.5, 0.5)), MK.EYE_M, head);
  face(head, 0.06, 0.42, 1.1, 0.12);
  const arms = [];
  for (const s of [-1, 1]){ const pv = new THREE.Group(); pv.position.set(s * 0.95, 1.78, 0); body.add(pv); arms.push(pv);
    mesh(once('yArm', () => merge([TM(new THREE.IcosahedronGeometry(0.32, 1), 0, -0.45, 0, 0, 0, 0, 0.9, 1.6, 0.9), TM(new THREE.IcosahedronGeometry(0.3, 0), 0, -0.84, 0, 0, 0, 0, 1.1, 0.8, 1.1)])), fur, pv);
    mesh(once('yHand', () => merge([TM(new THREE.SphereGeometry(0.27, 10, 8), 0, -1.08, 0.05, 0, 0, 0, 1, 0.9, 1.1), ...[-0.1, 0, 0.1].map(x => TM(new THREE.ConeGeometry(0.035, 0.12, 4), x, -1.32, 0.16, 0.4, 0, 0))])), skin, pv); }
  const legs = [];
  for (const s of [-1, 1]){ const pv = new THREE.Group(); pv.position.set(s * 0.36, 0.76, 0); body.add(pv); legs.push(pv);
    mesh(once('yLeg', () => merge([TM(new THREE.CylinderGeometry(0.25, 0.21, 0.62, 8), 0, -0.3, 0), TM(new THREE.SphereGeometry(0.25, 10, 6), 0, -0.68, 0.1, 0, 0, 0, 1, 0.5, 1.4)])), fur, pv); }
  return { g, body, mats: [fur, skin, horn], arms, legs, head, kind: 'yeti' };
}
// 가시 망령 — 떠다니는 가시 유령: 어둠의 가시 탄 + 급강하
function mkWraith(){
  const g = new THREE.Group(), body = new THREE.Group(), core = new THREE.Group(); g.add(body); body.add(core); core.scale.setScalar(1.3);
  const shroud = sm(0x2c1a3e, { emissive: 0x4a1278, emissiveIntensity: 0.45, roughness: 0.6, flatShading: true }), thorn = sm(0x160a20, { emissive: 0x8a2aff, emissiveIntensity: 0.65, roughness: 0.35, flatShading: true }),
    mask = sm(0xcabbe8, { emissive: 0x6a4aa0, emissiveIntensity: 0.35, roughness: 0.4 });
  mesh(once('wrShroud', () => { const pts = [[0, 0.78], [0.2, 0.74], [0.34, 0.6], [0.4, 0.4], [0.42, 0.15], [0.46, -0.15], [0.55, -0.42], [0.6, -0.55]].map(p => new THREE.Vector2(p[0], p[1]));
    const lg = new THREE.LatheGeometry(pts, 14), pp = lg.attributes.position;
    for (let i = 0; i < pp.count; i++){ const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i), a = Math.atan2(z, x); if (y < -0.4) pp.setY(i, y - (Math.sin(a * 7) * 0.5 + 0.5) * 0.28); if (y > 0.3 && z > 0.12) pp.setZ(i, z * 0.6); }
    lg.computeVertexNormals(); return lg; }), shroud, core);
  mesh(once('wrMask', () => TM(new THREE.SphereGeometry(0.25, 12, 10), 0, 0.38, 0.17, 0, 0, 0, 1, 1.05, 0.62)), mask, core);
  face(core, 0.42, 0.32, 0.85, 0.1);
  mesh(once('wrThorn', () => { const L = [], up = new V3(0, 1, 0);
    for (let i = 0; i < 9; i++){ const a = i / 9 * TAU, dir = new V3(Math.cos(a) * 0.8, 0.9, Math.sin(a) * 0.8 - 0.25).normalize(), c = new THREE.ConeGeometry(0.05, 0.36, 5); c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir)); c.translate(dir.x * 0.38, 0.62 + dir.y * 0.22, dir.z * 0.38 - 0.04); L.push(c); }
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++){ const c = new THREE.ConeGeometry(0.045, 0.3, 5); TM(c, s * (0.42 + k * 0.03), 0.18 - k * 0.2, -0.05, 0, 0, -s * (1.0 + k * 0.25)); L.push(c); }
    return merge(L); }), thorn, core);
  const tail = new THREE.Group(); tail.position.y = -0.55; core.add(tail);
  mesh(once('wrTail', () => merge([TM(new THREE.ConeGeometry(0.44, 0.95, 8, 1, true), 0, -0.45, 0, Math.PI, 0, 0), TM(new THREE.ConeGeometry(0.2, 0.5, 6), 0, -0.88, -0.05, Math.PI + 0.3, 0, 0)])), shroud, tail);
  const arms = [];
  for (const s of [-1, 1]){ const pv = new THREE.Group(); pv.position.set(s * 0.42, 0.25, 0.05); core.add(pv); arms.push(pv);
    mesh(once('wrArm' + s, () => merge([TM(new THREE.ConeGeometry(0.09, 0.62, 6), s * 0.05, -0.28, 0.05, Math.PI, 0, 0), ...[-1, 0, 1].map(k => TM(new THREE.ConeGeometry(0.03, 0.2, 4), s * 0.05 + k * 0.05, -0.62, 0.12, Math.PI - 0.5, 0, k * 0.3))])), thorn, pv); }
  const gl = X.glowSprite(0x9a4aff, 2.4, 0.38); gl.position.y = 0.2; core.add(gl);
  return { g, body, mats: [shroud, thorn, mask], arms, tail, glow: gl, kind: 'wraith' };
}
Object.assign(X.MON, {
  wolf: { name: '얼음 늑대', icon: '🐺', mk: () => mkWolf(), hp: 68, dmg: 11, spd: 4.6, rad: 0.7, style: 'lunge', combo: 2, range: 2.3, wind: 0.38, exp: 13, top: 1.9 },
  frostgolem: { name: '서리 골렘', icon: '🧊', mk: () => mkFrostGolem(), hp: 175, dmg: 16, spd: 1.5, rad: 0.95, style: 'slam', range: 2.4, wind: 0.95, exp: 22, top: 2.4 },
  yeti: { name: '설인', icon: '🦍', mk: () => mkYeti(), hp: 230, dmg: 18, spd: 2.1, rad: 1.05, style: 'slam', range: 2.7, wind: 1.05, exp: 27, top: 2.85 },
  wraith: { name: '가시 망령', icon: '👻', mk: () => mkWraith(), hp: 62, dmg: 12, spd: 3.2, rad: 0.55, style: 'dive', fly: 2.3, range: 10, wind: 0.75, exp: 15, top: 3.4 },
});
const MYK = { wolf: 1, frostgolem: 1, yeti: 1, wraith: 1 };

// ── 전투 레이어 이펙트 (지면 기준 y · SW 직속 자식이어야 지면 높이를 받아요) ──
const ICE_M = sm(0xd4faff, { emissive: 0x3ab8ff, emissiveIntensity: 0.9, roughness: 0.05, transparent: true, opacity: 0.9, flatShading: true });
const SHARD_G = TM(new THREE.OctahedronGeometry(0.32, 0), 0, 0.4, 0, 0, 0, 0, 0.55, 2.2, 0.55);
const BOLT_G = new THREE.OctahedronGeometry(0.17, 0), BOLT_M = new THREE.MeshBasicMaterial({ color: 0xd8a8ff, toneMapped: false });
const SHARDS = [], BOLTS = [];
function shardRing(x, z, n, r0, r1){
  for (let i = 0; i < n; i++){
    let o = SHARDS.find(s => !s.on); if (!o){ if (SHARDS.length > 24) break; o = { m: mesh(SHARD_G, ICE_M, null, false) }; X.SW.add(o.m); SHARDS.push(o); }
    const a = i / n * TAU + R(), r = rr(r0, r1); o.on = true; o.t = -i * 0.03; o.m.visible = true; o.m.position.set(x + Math.cos(a) * r, 0, z + Math.sin(a) * r);
    o.m.rotation.set(rr(-0.35, 0.35), R() * TAU, rr(-0.35, 0.35)); o.s = rr(0.7, 1.25); o.m.scale.setScalar(0.01);
  }
}
function fireBolt(e, ang){
  let o = BOLTS.find(b => !b.on);
  if (!o){ const g = new THREE.Group(); mesh(BOLT_G, BOLT_M, g, false); const gl = X.glowSprite(0x9a3aff, 1.3, 0.85); g.add(gl); X.SW.add(g); o = { g }; BOLTS.push(o); }
  const y0 = e.pos.y + 0.3, py = X.PY() + 1.0, dx = P.x - e.pos.x, dz = P.z - e.pos.z, d = Math.hypot(dx, dz) || 1, sp = 10.5;
  o.on = true; o.t = 0; o.g.visible = true; o.g.position.set(e.pos.x + Math.sin(ang) * 0.5, y0, e.pos.z + Math.cos(ang) * 0.5);
  o.vx = Math.sin(ang) * sp; o.vz = Math.cos(ang) * sp; o.vy = clamp((py - y0) / (d / sp), -6, 6); o.dmg = e.dmg * 0.8;
}
function updEffects(dt){
  for (const o of SHARDS){ if (!o.on) continue; o.t += dt; const t = o.t;
    if (t < 0){ o.m.scale.setScalar(0.01); continue; }
    const k = t < 0.14 ? ease(t / 0.14) : t < 0.75 ? 1 : Math.max(0, 1 - (t - 0.75) / 0.4); o.m.scale.set(o.s * Math.max(0.01, k), o.s * Math.max(0.01, k), o.s * Math.max(0.01, k)); o.m.position.y = -0.5 * (1 - k);
    if (t > 1.2){ o.on = false; o.m.visible = false; } }
  for (const o of BOLTS){ if (!o.on) continue; o.t += dt; const p = o.g.position;
    p.x += o.vx * dt; p.y += o.vy * dt; p.z += o.vz * dt; o.g.rotation.y += dt * 9; o.g.rotation.x += dt * 6;
    if (R() < dt * 30) X.burst(new V3(p.x, p.y, p.z), R() < 0.5 ? 0x9a3aff : 0x2a0a40, 1, 0.6, 0.22, 0.45, 0, 0.3);
    let hit = false;
    if (Math.hypot(P.x - p.x, P.z - p.z) < 0.65 && Math.abs(X.PY() + 1.0 - p.y) < 1.2){ X.hurtPlayer(o.dmg, p.clone(), 3); hit = true; }
    if (hit || o.t > 2.4 || p.y < -0.3){ o.on = false; o.g.visible = false; X.burst(new V3(p.x, Math.max(0.2, p.y), p.z), 0xb46aff, 10, 2.5, 0.2, 0.45, -2, 1); } }
}
function clearEffects(){ for (const o of SHARDS){ o.on = false; o.m.visible = false; } for (const o of BOLTS){ o.on = false; o.g.visible = false; } }

// 새 몬스터 몸짓 · 추가 패턴 (스토리의 animMon 다음에 돌아요)
function augment(e, dt){
  const m = e.m, t = G.time + e.ph, st = e.state, b = m.body;
  const mv = e._px == null ? 0 : Math.hypot(e.pos.x - e._px, e.pos.z - e._pz) / Math.max(dt, 1e-4); e._px = e.pos.x; e._pz = e.pos.z;
  const moving = mv > 0.35, fast = mv > 5, d = dP(e.pos.x, e.pos.z);
  if (e.aggro && !e._ag){ e._ag = true; onAggro(e, d); } else if (!e.aggro) e._ag = false;
  if (e._ps !== st){ if (e._ps === 'wind' && st === 'recover') onSlam(e, d); e._ps = st; }
  if (st === 'dying') return;
  if (m.kind === 'wolf'){
    const rate = fast ? 24 : 13;
    m.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(t * rate + (i < 2 ? 0 : Math.PI * 0.8) + (i % 2) * 0.5) * (fast ? 0.95 : 0.6) : 0; });
    b.position.y = moving ? Math.abs(Math.sin(t * rate)) * (fast ? 0.1 : 0.05) : 0;
    const crouch = st === 'wind' ? Math.min(1, e.st / e.cfg.wind) : 0; b.position.y -= crouch * 0.14; b.rotation.x = st === 'lunge' ? 0.22 : -crouch * 0.12;
    e._how = Math.max(0, (e._how || 0) - dt);
    m.head.rotation.x = e._how > 0 ? -0.75 * Math.sin(Math.min(1, e._how / 0.8) * Math.PI) : crouch * 0.4 + Math.sin(t * 2) * 0.04;
    m.tail.rotation.x = fast ? -0.5 : Math.sin(t * 1.5) * 0.12; m.tail.rotation.y = moving ? Math.sin(t * rate * 0.5) * 0.25 : Math.sin(t * 6) * 0.35;
  } else if (m.kind === 'frostgolem'){
    const up = st === 'wind' ? Math.min(1, e.st / e.cfg.wind) : 0;
    b.rotation.z = moving ? Math.sin(t * 4) * 0.07 : 0; b.position.y = moving ? Math.abs(Math.sin(t * 4)) * 0.05 : 0;
    m.arms.forEach((a, i) => { a.rotation.x = -2.5 * ease(up) + (moving ? Math.sin(t * 4 + i * Math.PI) * 0.3 : Math.sin(t * 1.3 + i) * 0.05); a.rotation.z = (i ? -1 : 1) * up * 0.3; });
    m.ice.emissiveIntensity += 0.25 + Math.sin(t * 2.5) * 0.25 + up * 0.9;
    if (up > 0.3 && R() < dt * 20) X.burst(new V3(e.pos.x + rr(-0.8, 0.8), 2.4, e.pos.z + rr(-0.8, 0.8)), 0xcff6ff, 1, 0.6, 0.2, 0.5, -1, 0.5);
  } else if (m.kind === 'yeti'){
    const up = st === 'wind' ? Math.min(1, e.st / e.cfg.wind) : 0; e._roar = Math.max(0, (e._roar || 0) - dt); const ro = e._roar > 0 ? Math.sin(Math.min(1, e._roar / 0.9) * Math.PI) : 0;
    m.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(t * 7 + i * Math.PI) * 0.5 : 0; });
    b.position.y = moving ? Math.abs(Math.sin(t * 7)) * 0.08 : 0; b.rotation.z = moving ? Math.sin(t * 7) * 0.05 : 0; b.rotation.x = -ro * 0.25 + (st === 'recover' && e.st < 0.3 ? 0.25 : 0);
    m.arms.forEach((a, i) => { const s = i ? -1 : 1; a.rotation.x = -2.8 * ease(up) + (moving ? Math.sin(t * 7 + i * Math.PI) * 0.45 : Math.sin(t * 1.4 + i) * 0.06); a.rotation.z = s * (ro * 1.1 + up * 0.15); });
    m.head.rotation.x = -ro * 0.6 + Math.sin(t * 1.7) * 0.04;
  } else if (m.kind === 'wraith'){
    e._ch = Math.max(0, (e._ch || 0)); const ch = e._ch > 0 ? 1 - e._ch / 0.55 : 0;
    b.position.y = Math.sin(t * 2.2) * 0.1; m.tail.rotation.z = Math.sin(t * 2.6) * 0.18; m.tail.rotation.x = (moving ? 0.35 : 0.1) + Math.sin(t * 1.9) * 0.08;
    b.rotation.x = st === 'dive' ? 0.75 : st === 'wind' ? -0.3 : moving ? 0.15 : 0;
    m.arms.forEach((a, i) => { const s = i ? -1 : 1; a.rotation.z = s * (0.25 + Math.sin(t * 3 + i) * 0.12 + ch * 1.6); a.rotation.x = -ch * 0.9 + Math.sin(t * 2.4 + i) * 0.1; });
    m.glow.scale.setScalar(2.4 + ch * 2.2 + Math.sin(t * 4) * 0.15); m.glow.material.opacity = 0.3 + ch * 0.45;
    if (R() < dt * 6) X.burst(new V3(e.pos.x + rr(-0.3, 0.3), e.pos.y - 0.9, e.pos.z + rr(-0.3, 0.3)), 0x5a1a8a, 1, 0.4, 0.3, 0.9, 0.6, 0.2);
    // 어둠의 가시 탄 (원거리) — 돌진 사이사이에
    if (e.aggro && !X.dead){
      e._bcd = (e._bcd ?? rr(1.2, 2.4)) - dt;
      if (e._ch > 0){ e._ch -= dt; e.atkCd = Math.max(e.atkCd, 0.9); X.turn(e, Math.atan2(P.x - e.pos.x, P.z - e.pos.z), dt * 6);
        if (e._ch <= 0){ e._ch = 0; const a0 = Math.atan2(P.x - e.pos.x, P.z - e.pos.z), n = e.elite ? 5 : 3; for (let i = 0; i < n; i++) fireBolt(e, a0 + (i - (n - 1) / 2) * 0.24); if (d < 30) X.sfx('throw'); e._bcd = rr(3.2, 5.0); } }
      else if (e._bcd <= 0 && st === 'chase' && d > 3.5 && d < 14){ e._ch = 0.55; e.atkCd = Math.max(e.atkCd, 1.3); X.burst(new V3(e.pos.x, e.pos.y + 0.3, e.pos.z), 0xb46aff, 12, 1.5, 0.22, 0.5, 0, 0.5); }
    } else e._ch = 0;
  }
}
function onAggro(e, d){
  if (e.m.kind === 'yeti'){ e._roar = 0.9; e.atkCd = Math.max(e.atkCd, 1.1);
    if (d < 34){ X.sfx('roar'); if (d < 20) G.shake = Math.max(G.shake, 0.55); }
    X.shockwave(e.pos.x, 0.15, e.pos.z, 5.5, 0xeaf8ff, 0.7); X.burst(new V3(e.pos.x, 2.0, e.pos.z), 0xffffff, 30, 6, 0.3, 0.8, -3, 2); }
  else if (e.m.kind === 'wolf'){ e._how = 0.8; X.burst(new V3(e.pos.x, 1.4, e.pos.z), 0xdff6ff, 8, 1.5, 0.2, 0.6, -1, 1); }
}
function onSlam(e, d){
  const k = e.m.kind; if (k !== 'frostgolem' && k !== 'yeti') return;
  const fx = e.pos.x + Math.sin(e.g.rotation.y) * 1.3, fz = e.pos.z + Math.cos(e.g.rotation.y) * 1.3;
  if (k === 'frostgolem'){ shardRing(fx, fz, LOW ? 5 : 7, 0.9, 2.3); X.shockwave(fx, 0.14, fz, 3.0, 0x9ae8ff, 0.5); X.burst(new V3(fx, 0.3, fz), 0xcff6ff, 22, 5, 0.25, 0.7, -6, 2.5); }
  else { X.shockwave(fx, 0.14, fz, 4.3, 0xffffff, 0.6); X.shockwave(fx, 0.5, fz, 2.6, 0xbfe8ff, 0.45); X.burst(new V3(fx, 0.4, fz), 0xffffff, 34, 6.5, 0.3, 0.8, -6, 3); if (d < 18) G.shake = Math.max(G.shake, 0.75);
    const pd = Math.hypot(P.x - fx, P.z - fz); if (pd >= 2.3 && pd < 3.9 && X.PY() < 1.2) X.hurtPlayer(e.dmg * 0.6, new V3(fx, 0, fz), 7); }
}

// ═════════════════════════ 2. 사냥터 (스폰 · 리스폰) ═════════════════════════
const AGG = { slime: 8, sprout: 9, bee: 10, ladybug: 8, flower: 11, shroom: 8, squirrel: 10, boar: 10, raccoon: 10, frog: 8, snail: 8, mole: 9, golem: 9, owl: 11, hedgehog: 9, wolf: 12, frostgolem: 9, yeti: 11, wraith: 12 };
const CAMPS = W.camps.map(c => ({ c, on: false, mem: c.mobs.flatMap(([k, n]) => (X.MON[k] || X.BOSS[k]) ? Array.from({ length: LOW ? Math.max(1, Math.round(n * 0.75)) : n }, () => ({ k, e: null, at: 0 })) : []) }));
const CAMP_BY = Object.fromEntries(CAMPS.map(o => [o.c.id, o]));
let MYSPAWN = false;
const live = e => e && e.state !== 'dying' && X.ENEMIES.includes(e);
function quietRemove(e){
  if (!e || e.state === 'dying') return;
  e.state = 'dying'; e.st = 0.25; e.g.visible = false; if (e.bar) e.bar.remove(); X.rmTele(e); if (e.atk){ X.rmTele(e.atk); e.atk = null; }
}
function spawnMember(o, m){
  const c = o.c, fly = (X.MON[m.k] || {}).fly; let x = 0, z = 0, ok = false;
  for (let t = 0; t < 14 && !ok; t++){ const a = R() * TAU, d = Math.sqrt(R()) * c.r * 0.78; x = c.c[0] + Math.cos(a) * d; z = c.c[1] + Math.sin(a) * d;
    ok = (fly || !F.isWater(x, z)) && F.slope(x, z) < 0.8 && dP(x, z) > 9; }
  if (!ok){ m.at = T + 2; return null; }
  const lv = ri(c.lv[0], c.lv[1]), elite = !!(c.elite && R() < c.elite);
  MYSPAWN = true;
  try { m.e = X.spawnMon(m.k, x, z, elite, { lv, fld: { hx: c.c[0] + rr(-0.3, 0.3) * c.r, hz: c.c[1] + rr(-0.3, 0.3) * c.r, aggro: AGG[m.k] || 9, leash: c.r + 18, wr: c.r * 0.6 }, data: { camp: c.id } }); }
  finally { MYSPAWN = false; }
  return m.e;
}
function campTick(){
  let budget = 3;
  for (const o of CAMPS){
    const d = dP(o.c.c[0], o.c.c[1]);
    if (!o.on && d < 170) o.on = true;
    else if (o.on && d > 205){ o.on = false; for (const m of o.mem){ if (m.e){ if (live(m.e)) quietRemove(m.e); m.e = null; } if (m.at < T + 1) m.at = 0; } continue; }
    if (!o.on) continue;
    for (const m of o.mem){
      if (m.e){ if (m.e.state === 'dying'){ m.e = null; if (m.at < T) m.at = T + rr(20, 40); } else if (!X.ENEMIES.includes(m.e)){ m.e = null; m.at = T + 0.5; } }
      if (!m.e && T >= m.at && budget > 0){ budget--; spawnMember(o, m); }
    }
  }
}
// 사냥터를 바로 채워요 (퀘스트 · 테스트용)
F.spawnCamp = id => { const o = CAMP_BY[id]; if (!o) return 0; o.on = true; let n = 0; for (const m of o.mem){ if (m.e && !live(m.e)) m.e = null; if (!m.e){ m.at = 0; if (spawnMember(o, m)) n++; } } return n; };

// 필드 몬스터 거리 · 시야 정리 (깜빡이는 그림자 · 뒤쪽 그리기 줄이기)
const camDir = new V3();
function cullEnemies(){
  G.camera.getWorldDirection(camDir); const cp = G.camera.position, VIS = LOW ? 62 : 80;
  for (const e of X.ENEMIES){
    if (!e.fld || e.state === 'dying') continue;
    const d = dP(e.pos.x, e.pos.z);
    if (e.g.visible){
      if (d > VIS && !e.aggro && !e.fboss) e.g.visible = false;
      else if (d > 16 && (e.pos.x - cp.x) * camDir.x + (e.pos.z - cp.z) * camDir.z < -8) e.g.visible = false;
    }
    const sh = e.g.visible && d < (LOW ? 24 : 36); if (e._sh !== sh){ e._sh = sh; e.g.traverse(o => { if (o.isMesh) o.castShadow = sh; }); }
  }
}

// ═════════════════════════ 3. 필드 보스 ═════════════════════════
const FB = { list: W.fieldBosses || [], cur: null, next: Infinity, e: null, hpK: 1, bar: false, minions: [], marker: null };
F.worldBoss = null;
const fbName = fb => `${fb.title} 「${fb.name}」`;
function fbStart(){
  if (!FB.list.length) return;
  const fb = FB.list[S.life.fbIdx % FB.list.length]; S.life.fbIdx = (S.life.fbIdx + 1) % FB.list.length; X.save();
  const reg = F.regionById(fb.region) || { name: '' };
  FB.cur = { fb, until: T + 300, botKill: R() < 0.45 ? T + rr(170, 270) : Infinity }; FB.hpK = 1; FB.next = T + 360;
  FB.marker = { x: fb.c[0], z: fb.c[1], c: '#ff4a5a', fboss: fb.id }; G.mapMarkers.push(FB.marker);
  F.worldBoss = { id: fb.id, key: fb.key, name: fb.name, title: fb.title, lv: fb.lv, x: fb.c[0], z: fb.c[1], region: fb.region, until: FB.cur.until, alive: true, e: null };
  BUS.emit('worldBoss', { id: fb.id, state: 'spawn' });
  sysLine(`<i>[필드 보스]</i> ${esc(reg.name)}에 <span class="it">Lv.${fb.lv} ${esc(fbName(fb))}</span> 출현! (5분)`, 'boss');
  const d = dP(fb.c[0], fb.c[1]);
  if (d < 320) X.banner('FIELD BOSS', `${fb.name} 출현!`, `${fb.title} · ${reg.name} · Lv.${fb.lv} — 지도에 빨간 표식`, true, 3.4); else F.note(`⚔ 필드 보스 <b>${esc(fbName(fb))}</b> 출현 — ${esc(reg.name)}`, 5);
  X.sfx('elite');
  later(rr(3, 7), () => { if (FB.cur && FB.cur.fb === fb) botSay(pickBot(b => b.lv >= fb.lv - 6), pick([`${fb.name} 떴다!! ${reg.name} ㄱㄱ`, `필보 ${fb.name} 같이 잡으실 분~`, `${reg.name} 필드보스 출현! 달려요`, `오 ${fb.name} 드디어 나왔다`]), 'world'); });
}
function fbSpawnPhysical(){
  const fb = FB.cur.fb, [x, z] = fb.c;
  MYSPAWN = true;
  try { FB.e = X.spawnMon(fb.key, x, z, false, { lv: fb.lv, name: fbName(fb), scale: 1.25, hpMul: 2.2, fld: { aggro: 18, leash: 45, wr: 5 }, fieldBoss: true, data: { fbId: fb.id } }); }
  finally { MYSPAWN = false; }
  FB.e.hp = FB.e.max * FB.hpK; F.worldBoss.e = FB.e;
  X.burst(new V3(x, 1.2, z), 0xff4a5a, 50, 7, 0.35, 1.0, -2, 2.5); X.shockwave(x, 0.15, z, 7, 0xff6a5a, 0.8);
}
function fbEnd(state, by){
  const fb = FB.cur && FB.cur.fb; if (!fb) return;
  if (FB.e && live(FB.e) && (state !== 'dead' || by === 'bot' || !FB.e._won)) quietRemove(FB.e);
  if (FB.bar){ X.bossBar(null); FB.bar = false; }
  for (const m of FB.minions) if (live(m)) later(state === 'dead' ? 4 : 0, () => quietRemove(m));
  FB.minions = []; FB.e = null; FB.cur = null;
  const i = G.mapMarkers.indexOf(FB.marker); if (i >= 0) G.mapMarkers.splice(i, 1); FB.marker = null;
  if (F.worldBoss){ F.worldBoss.alive = false; F.worldBoss.e = null; }
  F.worldBoss = null;
  BUS.emit('worldBoss', { id: fb.id, state: state === 'dead' ? 'dead' : 'gone', by });
  if (state === 'gone') sysLine(`<i>[필드 보스]</i> ${esc(fbName(fb))}${jo(fb.name, '이', '가')} 모습을 감췄다…`, 'boss');
}
function fbTick(){
  if (!FB.cur){ if (T >= FB.next) fbStart(); return; }
  const fb = FB.cur.fb, d = dP(fb.c[0], fb.c[1]);
  if (FB.e && !X.ENEMIES.includes(FB.e)){ FB.hpK = Math.max(0.05, FB.e.hp / FB.e.max); FB.e = null; if (F.worldBoss) F.worldBoss.e = null; }   // 텔레포트로 지워짐
  if (FB.e && FB.e.state === 'dying' && !FB.e._won){ FB.e = null; }
  if (!FB.e && d < 170 && T < FB.cur.until) fbSpawnPhysical();
  else if (FB.e && d > 215 && !FB.e.aggro){ FB.hpK = Math.max(0.05, FB.e.hp / FB.e.max); quietRemove(FB.e); FB.e = null; if (F.worldBoss) F.worldBoss.e = null; }
  if (FB.e){ const near = d < 45 || (FB.e.aggro && dP(FB.e.pos.x, FB.e.pos.z) < 60); if (near && !FB.bar){ X.bossBar(FB.e); FB.bar = true; } else if (!near && FB.bar){ X.bossBar(null); FB.bar = false; } }
  else if (FB.bar){ X.bossBar(null); FB.bar = false; }
  if (T >= FB.cur.botKill && (!FB.e || (!FB.e.aggro && dP(FB.e.pos.x, FB.e.pos.z) > 120))){
    const lead = pickBot(b => b.lv >= fb.lv - 3) || pickBot(); fbEnd('dead', 'bot');
    if (lead){ sysLine(`<i>[필드 보스]</i> 「${esc(lead.name)}」 님의 파티가 ${esc(fbName(fb))}${jo(fb.name, '을', '를')} 쓰러뜨렸다!`, 'boss'); later(rr(2, 4), () => botSay(lead, pick(['필보 잡았다 ㅎㅎ 다들 수고!', 'GG 수고하셨습니다~', '보스 막타 개꿀', '와 아슬아슬했다']), 'world')); }
    return;
  }
  if (T >= FB.cur.until && (!FB.e || !FB.e.aggro)) fbEnd('gone');
}
function fbReward(e){
  const fb = FB.cur.fb; e._won = true;
  // 보너스: rpg 의 필드 보스 상자 (빛기둥으로 흩뿌려요) + 추가 골드
  const loot = !!F.giveLoot, gold = Math.round((loot ? 60 : 120) + fb.lv * (loot ? 15 : 30));
  if (loot) guard('giveLoot', () => F.giveLoot('fboss', [e.pos.x, e.pos.z]));
  if (F.gold) F.gold(gold); else { S.gold = (S.gold || 0) + gold; X.save(); X.refreshHud(); }
  S.life.fbKills++; X.save();
  X.banner('FIELD BOSS DOWN', `${fb.name} 처치!`, `${fb.title} · 보너스 보상 💰 ${gold} 골드`, false, 3.4); F.note(`💰 <b>+${gold}</b> 골드 (필드 보스 보너스)`, 4);
  sysLine(`<i>[필드 보스]</i> <span class="it">모험가님</span>이 ${esc(fbName(fb))}${jo(fb.name, '을', '를')} 쓰러뜨렸다!`, 'boss');
  fbEnd('dead', 'player');
  const fans = BOTS.filter(b => b.d < 60); for (const b of fans.slice(0, 5)) later(rr(0.4, 1.6), () => { botEmote(b, pick(['cheer', 'clap', 'cheer'])); });
  later(rr(1.5, 3), () => botSay(pickBot(b => b.d < 80) || pickBot(), pick(['GG!! 수고하셨어요', '와 보스 순삭 ㄷㄷ', '덕분에 잡았네요 감사합니다!', '굿굿 다음 필보도 같이 해요']), 'world'));
}

// ═════════════════════════ 4. NPC 피규어 ═════════════════════════
F.npcs = {};
const NPCL = [];
const M_IRON = sm(0x3a3c44, { metalness: 0.6, roughness: 0.45 }), M_WOOD = sm(0x7a5434, { roughness: 0.85 }), M_GOLD = sm(0xe8c060, { metalness: 0.8, roughness: 0.3 });
function handProp(f, obj, side = 'R'){ obj.position.set(0, -0.36, 0.02); obj.rotation.x = Math.PI / 2; (side === 'R' ? f.elR : f.elL).add(obj); return obj; }
function mkHammer(){ const g = new THREE.Group(); mesh(TM(new THREE.CylinderGeometry(0.025, 0.03, 0.62, 6), 0, 0.22, 0), M_WOOD, g); mesh(TM(new THREE.BoxGeometry(0.22, 0.12, 0.12), 0, 0.52, 0), M_IRON, g); return g; }
function mkRod(){ const g = new THREE.Group(); mesh(TM(new THREE.CylinderGeometry(0.012, 0.025, 2.4, 5), 0, 1.0, 0), M_WOOD, g); mesh(TM(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 10), 0.05, 0.05, 0, 0, 0, Math.PI / 2), M_IRON, g); const tip = new THREE.Object3D(); tip.position.y = 2.2; g.add(tip); g.userData.tip = tip; return g; }
function mkLadle(){ const g = new THREE.Group(); mesh(TM(new THREE.CylinderGeometry(0.015, 0.02, 0.9, 5), 0, 0.15, 0), M_WOOD, g); mesh(TM(new THREE.SphereGeometry(0.07, 8, 5, 0, TAU, 0, Math.PI / 2), 0, -0.3, 0, Math.PI, 0, 0), M_WOOD, g); return g; }
function mkPick(){ const g = new THREE.Group(); mesh(TM(new THREE.CylinderGeometry(0.025, 0.03, 0.8, 6), 0, 0.28, 0), M_WOOD, g); mesh(TM(new THREE.CylinderGeometry(0.03, 0.04, 0.6, 6), 0, 0.66, 0, 0, 0, Math.PI / 2), M_IRON, g); return g; }
function mkStick(){ const g = new THREE.Group(); mesh(TM(new THREE.CylinderGeometry(0.03, 0.04, 1.5, 6), 0, 0.2, 0, 0.05, 0, 0), M_WOOD, g); mesh(TM(new THREE.SphereGeometry(0.06, 8, 6), 0, 0.95, 0), M_WOOD, g); return g; }
function mkMug(){ const g = new THREE.Group(); mesh(TM(new THREE.CylinderGeometry(0.06, 0.055, 0.14, 10), 0, 0.02, 0.04, -Math.PI / 2, 0, 0), M_WOOD, g); mesh(TM(new THREE.CylinderGeometry(0.058, 0.058, 0.02, 10), 0, 0.02, 0.115, -Math.PI / 2, 0, 0), sm(0xf8f0d8), g); return g; }
function mkBook(){ const g = new THREE.Group(); mesh(TM(new THREE.BoxGeometry(0.26, 0.04, 0.2), 0.02, 0, 0.05), sm(0x7a2a3a), g); mesh(TM(new THREE.BoxGeometry(0.24, 0.045, 0.19), 0.02, 0.005, 0.05), sm(0xf4ecd4), g); return g; }
function mkPinwheel(){ const g = new THREE.Group(); mesh(TM(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 5), 0, 0.2, 0), M_WOOD, g);
  const w = new THREE.Group(); w.position.set(0, 0.55, 0.03); g.add(w); ['#ff6a8a', '#ffd36a', '#6ad8ff', '#8aff9a'].forEach((c, i) => { const m = mesh(TM(new THREE.ConeGeometry(0.1, 0.2, 3), 0, 0.09, 0, 0, 0, 0, 1, 1, 0.15), sm(new THREE.Color(c).getHex(), { emissive: new THREE.Color(c).getHex(), emissiveIntensity: 0.25 }), w); m.rotation.z = i * Math.PI / 2; }); g.userData.w = w; return g; }
function mkHoe(){ const g = new THREE.Group(); mesh(TM(new THREE.CylinderGeometry(0.022, 0.028, 1.5, 6), 0, 0.3, 0), M_WOOD, g); mesh(TM(new THREE.BoxGeometry(0.2, 0.04, 0.16), 0, 1.04, 0.07, 0.3, 0, 0), M_IRON, g); return g; }
function mkBroom(){ const g = new THREE.Group(); mesh(TM(new THREE.CylinderGeometry(0.02, 0.025, 1.3, 6), 0, 0.25, 0), M_WOOD, g); mesh(TM(new THREE.ConeGeometry(0.16, 0.42, 8), 0, 1.02, 0, Math.PI, 0, 0, 1, 1, 0.45), sm(0xc8a050, { roughness: 0.95 }), g); return g; }
function mkSpear(){ const g = new THREE.Group(); mesh(TM(new THREE.CylinderGeometry(0.022, 0.026, 2.3, 6), 0, 0.55, 0), M_WOOD, g); mesh(TM(new THREE.ConeGeometry(0.05, 0.28, 6), 0, 1.84, 0), M_IRON, g); return g; }
function mkLantern(){ const g = new THREE.Group(); mesh(TM(new THREE.BoxGeometry(0.14, 0.18, 0.14), 0, -0.12, 0), sm(0xffd27a, { emissive: 0xffb040, emissiveIntensity: 0.9 }), g); mesh(TM(new THREE.ConeGeometry(0.11, 0.08, 4), 0, -0.01, 0, 0, Math.PI / 4, 0), M_IRON, g); return g; }
function mkBeard(){ const g = new THREE.Group(); mesh(TM(new THREE.ConeGeometry(0.12, 0.3, 8), 0, -0.07, 0.15, Math.PI + 0.25, 0, 0, 1, 1, 0.6), sm(0xf4f0e8, { roughness: 0.9 }), g); return g; }
function anvilAt(x, z, ry){ const g = new THREE.Group(); g.position.set(x, F.H(x, z), z); g.rotation.y = ry; mesh(once('anvil', () => merge([TM(new THREE.BoxGeometry(0.5, 0.5, 0.5), 0, 0.25, 0), TM(new THREE.BoxGeometry(0.3, 0.2, 0.62), 0, 0.6, 0), TM(new THREE.BoxGeometry(0.42, 0.14, 0.78), 0, 0.77, 0), TM(new THREE.ConeGeometry(0.09, 0.32, 6), 0, 0.77, 0.52, Math.PI / 2, 0, 0)])), M_IRON, g);
  const hot = mesh(TM(new THREE.BoxGeometry(0.1, 0.04, 0.3), 0, 0.86, 0), new THREE.MeshBasicMaterial({ color: 0xff7a2a, toneMapped: false }), g, false); FW.add(g); return { g, hot }; }
function cauldronAt(x, z){ const g = new THREE.Group(); g.position.set(x, F.H(x, z), z); mesh(once('cauldron', () => merge([new THREE.LatheGeometry([[0, 0.05], [0.36, 0.08], [0.46, 0.32], [0.42, 0.58], [0.36, 0.62], [0.34, 0.56], [0, 0.56]].map(p => new THREE.Vector2(p[0], p[1])), 14), ...[0, 1, 2].map(i => TM(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 5), Math.cos(i * 2.1) * 0.3, 0.1, Math.sin(i * 2.1) * 0.3))])), M_IRON, g);
  const liq = mesh(TM(new THREE.CircleGeometry(0.34, 16), 0, 0.57, 0, -Math.PI / 2, 0, 0), new THREE.MeshBasicMaterial({ color: 0x7aff6a, toneMapped: false, transparent: true, opacity: 0.9 }), g, false);
  const gl = X.glowSprite(0x8aff6a, 1.6, 0.4); gl.position.y = 0.75; g.add(gl); FW.add(g); return { g, liq, gl }; }
// 역할별 대사 (가까이 오면 말풍선)
const NPC_HI = {
  chief: ['어서 오게, 젊은 모험가여.', '아르카디아는 넓다네. 길을 잃으면 룬 비석을 찾게.', '요즘 북쪽 가시가 심상치 않아…'],
  smith: ['칼날이 무뎌졌으면 들고 오게!', '강화는 운이 아니라 기술이지. …대부분은.', '불꽃이 좋은 날이군!'],
  herbalist: ['물약 필요하지 않아요?', '이 냄새? 달팽이 점액 물약이에요♪', '약초 캐 오면 좋은 값 쳐 줄게요!'],
  raidmaster: ['레이드 파티 모집 중이다! 용기 있는 자 앞으로!', '그롬부터 시작해라. 신전 독 웅덩이를 조심하고.', '함께라면 용도 잡는다!'],
  tailor: ['오늘 패션 너무 무난한데요?', '날개 하나 달면 인생이 달라져요~', '반짝이는 건 다 여기 있어요!'],
  innkeeper: ['따뜻한 수프 있어요~', '쉬어 가요. 모험은 내일도 있으니까!', '어젯밤 손님이 설인을 봤대요!'],
  fisher: ['쉿… 물고기가 놀라요.', '오늘은 은빛 송어가 잘 무는군.', '낚시는 기다림의 예술이지.'],
  zephy: ['바람이 좋네요! 날기 딱 좋은 날!', '매의 절벽에서 뛰어내려 봐요~', '글라이더 하나면 세상이 달라 보여요!'],
  rowan: ['숲이 수상해. 멧돼지들이 날뛰고 있어.', '활시위는 늘 팽팽하게.', '사냥감 냄새가 나는군.'],
  morgana: ['히히… 늪에 온 걸 환영해.', '두꺼비 눈알 좀 구해다 줄래?', '안개 속에서 길을 잃지 마렴~'],
  brick: ['광산 깊은 곳에서 쿵쿵 소리가 난다니까!', '곡괭이질 한 번이면 금이 나와… 가끔.', '협곡 고슴도치 조심해, 굴러온다!'],
  elin: ['별들의 배열이 이상해요…', '고원의 옛 왕국 기록을 모으는 중이에요.', '관측소에서 보는 밤하늘, 최고예요.'],
  eldra: ['룬이 떨고 있어요. 침식이 가까워졌어요.', '가시 심장을 막아야 해요.', '빛을 잃지 마세요, 모험가님.'],
  hermit: ['…춥지? 불 좀 쬐다 가게.', '설인은 화나면 포효부터 하지. 그때 피하게.', '고개 너머엔 용이 잠들어 있다네.'],
};
function buildNpcs(){
  for (const n of W.npcs){
    if (n.object) continue;
    guard('npc ' + n.id, () => {
      const [x, z] = n.c, av = X.makeAvatar({ job: n.job, look: n.look || {}, scale: 0.9 }), f = av.fig;
      f.root.position.set(x, gnd(x, z), z); f.root.rotation.y = n.face || 0; f.root.visible = false;
      const o = { n, av, f, x, z, face0: n.face || 0, t: R() * 10, near: false, hiT: 0, props: {} };
      const role = n.role, pr = o.props;
      if (n.id === 'smith'){ av.setArmed(false); pr.hammer = handProp(f, mkHammer()); const ax = x + Math.sin(o.face0) * 0.95, az = z + Math.cos(o.face0) * 0.95; pr.anvil = anvilAt(ax, az, o.face0 + Math.PI / 2); }
      else if (n.id === 'herbalist'){ pr.ladle = handProp(f, mkLadle()); pr.pot = cauldronAt(x + Math.sin(o.face0) * 0.9, z + Math.cos(o.face0) * 0.9); }
      else if (n.id === 'fisher' || role === 'fish' || n.idle === 'fish'){ pr.rod = handProp(f, mkRod()); pr.rod.rotation.x = Math.PI / 2 + 0.35;
        const bob = new THREE.Mesh(once('bobG', () => merge([TM(new THREE.SphereGeometry(0.07, 8, 6), 0, 0.04, 0), TM(new THREE.SphereGeometry(0.072, 8, 4, 0, TAU, 0, Math.PI / 2), 0, 0.045, 0)])), sm(0xff4a3a, { emissive: 0x401010 }));
        FW.add(bob); pr.bob = bob; const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); pr.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xf0f0f0, transparent: true, opacity: 0.6 })); pr.line.frustumCulled = false; FW.add(pr.line);
        let spot = null; for (let r = 4; r <= 16 && !spot; r += 1.5) for (const da of [0, 0.3, -0.3, 0.6, -0.6]){ const a = o.face0 + da, bx = x + Math.sin(a) * r, bz = z + Math.cos(a) * r; if (F.isWater(bx, bz)){ spot = [bx, bz]; break; } }
        pr.bobXZ = spot; if (!spot){ bob.visible = false; pr.line.visible = false; } }
      else if (n.id === 'zephy'){ pr.pin = handProp(f, mkPinwheel(), 'L'); pr.pin.rotation.x = 0.3; }
      else if (n.id === 'brick'){ pr.pick = handProp(f, mkPick()); }
      else if (n.id === 'elin'){ av.setArmed(false); pr.book = handProp(f, mkBook(), 'L'); pr.book.rotation.set(0.2, 0, 0); pr.book.position.set(0.02, -0.38, 0.12); }
      else if (n.id === 'hermit'){ pr.stick = handProp(f, mkStick()); pr.stick.rotation.x = 0.25; }
      else if (n.id === 'innkeeper'){ pr.mug = handProp(f, mkMug()); pr.mug.rotation.x = 0; }
      else if (n.id === 'chief'){ const b = mkBeard(); f.head.add(b); }
      else if (n.resident){ const id = n.idle;
        if (id === 'farm'){ av.setArmed(false); pr.tool = handProp(f, mkHoe()); }
        else if (id === 'sweep'){ av.setArmed(false); pr.tool = handProp(f, mkBroom()); }
        else if (id === 'hammer'){ av.setArmed(false); pr.hammer = handProp(f, mkHammer()); }
        else if (id === 'read'){ av.setArmed(false); pr.book = handProp(f, mkBook(), 'L'); pr.book.rotation.set(0.2, 0, 0); pr.book.position.set(0.02, -0.38, 0.12); }
        else if (id === 'cook'){ av.setArmed(false); pr.ladle = handProp(f, mkLadle()); pr.pot = cauldronAt(x + Math.sin(o.face0) * 0.9, z + Math.cos(o.face0) * 0.9); }
        else if (id === 'guard' && !n.job){ pr.tool = handProp(f, mkSpear()); pr.tool.rotation.x = Math.PI / 2 - 0.05; }
        else if (id === 'pray' || id === 'sit' || id === 'play' || id === 'stand') { if (!n.job) av.setArmed(false); if (id === 'pray' && R() < 0.5) pr.lamp = handProp(f, mkLantern(), 'L'); } }
      FW.add(f.root);
      o.label = F.label({ obj: f.root, text: n.name, sub: n.title, cls: 'npc', max: 34, y: 2.45 });
      o.it = F.addInteract({ x, z, r: 2.8, title: `${n.name} · 대화`, action: () => F.talk(n.id) });
      o.col = F.circle(x, z, 0.5);
      X.NAMES[n.id] = n.name; X.SPK[n.id] = () => f;
      F.npcs[n.id] = { fig: f, pos: f.root.position, label: o.label, av, n, props: pr };
      NPCL.push(o);
    });
  }
  BUS.emit('npcsReady', F.npcs);
}
// 이야기에 따라 NPC 가 자리를 옮겨요 (예: 리나가 뿌리 터널에서 잎새 마을 집으로) — saga 가 불러요
F.moveNpc = (id, x, z, face) => {
  const o = NPCL.find(q => q.n.id === id); if (!o) return false;
  o.x = x; o.z = z; o.gy = null; if (face != null) o.face0 = face;
  o.f.root.position.set(x, gnd(x, z), z); o.f.root.rotation.y = o.face0;
  o.n.c = [x, z]; if (o.props.pot) o.props.pot.g.visible = false;
  F.removeInteract(o.it); o.it = F.addInteract({ x, z, r: 2.8, title: `${o.n.name} · 대화`, action: () => F.talk(o.n.id) });
  if (o.col){ F.removeCollider(o.col); o.col = F.circle(x, z, 0.5); }
  o.vis = null; return true;
};
const PZ = G.pose;
function npcPose(o, dt){
  const n = o.n, t = o.t, s = Math.sin, br = s(t * 1.8) * 0.006, look = s(t * 0.33) * 0.35 + s(t * 0.71) * 0.15, pr = o.props;
  switch (n.id){
    case 'smith': { const cyc = (t % 1.25) / 1.25, up = cyc < 0.68 ? ease(cyc / 0.68) : 1 - ease((cyc - 0.68) / 0.32);
      if (cyc < o.c0 && o.vis){ const p = pr.anvil.hot.getWorldPosition(new V3()); for (let i = 0; i < 6; i++) X.emit(p.x, p.y + 0.05, p.z, rr(-1.5, 1.5), rr(1, 2.6), rr(-1.5, 1.5), R() < 0.5 ? 0xffc040 : 0xff7a20, rr(0.06, 0.12), rr(0.3, 0.6), { grav: -9 }); if (o.d < 14) X.sfx('clang'); }
      o.c0 = cyc; return PZ({ rax: -0.6 - 1.9 * up, re: -0.5 - 0.7 * up, raz: -0.1, lax: -0.65, le: -0.8, laz: 0.1, sp: 0.25 + 0.05 * up, hd: 0.35, llx: -0.2, rlx: 0.2, hy: 0.86 + br }); }
    case 'herbalist': { const a = t * 2.4; if (o.vis && R() < dt * 5){ const p = pr.pot.g.position; X.emit(p.x + rr(-0.2, 0.2), p.y + 0.62, p.z + rr(-0.2, 0.2), 0, rr(0.3, 0.7), 0, R() < 0.5 ? 0x8aff6a : 0xd0ffb0, rr(0.08, 0.16), rr(0.6, 1.1), { grow: 0.5 }); }
      pr.pot.liq.material.color.setHSL(0.3 + s(t * 0.5) * 0.04, 1, 0.6); return PZ({ rax: -0.85 + s(a) * 0.18, raz: -0.15 + Math.cos(a) * 0.2, re: -0.9, lax: -0.2, laz: 0.3, le: -0.6, sp: 0.28, hd: 0.3, hdy: s(t * 0.4) * 0.2, hy: 0.86 + br }); }
    case 'fisher': { const tug = Math.pow(Math.max(0, s(t * 0.21)), 30); return PZ({ rax: -0.55 - tug * 1.0, raz: -0.08, re: -0.95, lax: -0.55, laz: 0.25, le: -1.05, sp: 0.05 - tug * 0.1, hd: 0.15, hdy: s(t * 0.27) * 0.12, hy: 0.86 + br }); }
    case 'raidmaster': { const k = Math.pow(Math.max(0, s(t * 0.4)), 10); return PZ({ rax: -0.25 - 2.45 * k, raz: -0.12 - 0.2 * k, re: -0.95 + 0.9 * k, lax: -0.35, le: -1.1, laz: 0.25 - k * 0.2, sp: -0.05 * k, hd: -0.25 * k, hdy: look * (1 - k), hy: 0.86 + br }); }
    case 'chief': return PZ({ lax: 0.45, laz: 0.2, le: -1.0, rax: 0.45, raz: -0.2, re: -1.0, sp: 0.06, hd: 0.05 + Math.max(0, s(t * 0.9)) * 0.1, hdy: look, hy: 0.86 + br });
    case 'tailor': { const g = Math.pow(Math.max(0, s(t * 0.7)), 4); return PZ({ laz: 0.6, lax: 0.2, le: -1.4, rax: -0.6 - g * 0.6, raz: -0.3 - g * 0.5, re: -0.8, sp: 0.02, sz: 0.06, hd: -0.05, hdy: look, hy: 0.86 + br }); }
    case 'innkeeper': { const w = Math.max(0, s(t * 0.5)); return PZ({ rax: -0.4 - w * 0.6, re: -1.2 - w * 0.5, lax: -0.6, laz: 0.15 + Math.cos(t * 4) * 0.12 * w, le: -1.0 + s(t * 4) * 0.15 * w, sp: 0.05, hdy: look, hy: 0.86 + br }); }
    case 'zephy': { if (pr.pin) pr.pin.userData.w.rotation.z += dt * 9; return PZ({ lax: -2.2, laz: 0.4, le: -0.35, rax: -0.1, raz: -0.25, re: -0.4, hd: -0.35 + s(t * 0.6) * 0.1, hdy: s(t * 0.4) * 0.4, sp: -0.06, sz: s(t * 0.9) * 0.05, hy: 0.86 + br }); }
    case 'rowan': { const k = Math.max(0, s(t * 0.35)); if (k > 0.2){ const u = Math.min(1, (k - 0.2) * 2); return PZ({ lax: -1.55, laz: 0.05, le: 0, rax: -1.45, raz: 0.15, re: -0.5 - 1.6 * u, sp: 0.1, llx: -0.25, rlx: 0.25, hy: 0.86 + br }); }
      return PZ({ lax: -0.35, le: -0.5, raz: -0.12, hdy: look, hy: 0.86 + br }); }
    case 'morgana': { const c = Math.pow(Math.max(0, s(t * 0.6)), 6); if (o.vis && R() < dt * 4){ const p = f2w(o.f.elR, 0, -0.9, 0); X.emit(p.x, p.y, p.z, rr(-0.2, 0.2), rr(0.2, 0.6), rr(-0.2, 0.2), R() < 0.5 ? 0xb46aff : 0x6aff9a, 0.14, 1.0, { sway: 0.5 }); }
      return PZ({ rax: -0.7, re: -0.8, lax: -0.4 - c * 0.8, laz: 0.4, le: -1.2, sp: 0.3 + c * 0.1, sz: s(t * 18) * 0.04 * c, hd: 0.15, hdy: look * 0.6, hy: 0.84 + br }); }
    case 'brick': { const k = Math.pow(Math.max(0, s(t * 0.5)), 3); return PZ({ rax: -0.4 - k * 2.2, re: -0.4 - k * 0.4, raz: -0.1, lax: -0.4 - k * 1.8, le: -0.6, sp: 0.15 + k * 0.4, hd: 0.2, llx: -0.15, rlx: 0.15, lk: k * 0.3, rk: k * 0.3, hy: 0.86 - k * 0.04 }); }
    case 'elin': { const pg = Math.pow(Math.max(0, s(t * 0.45)), 20); return PZ({ lax: -1.2, laz: 0.05, le: -1.25, rax: -0.7 - pg * 0.6, raz: 0.3, re: -1.1, sp: 0.1, hd: 0.45 - pg * 0.3, hdy: -0.15, hy: 0.86 + br }); }
    case 'eldra': { o.f.root.position.y = o.gy + 0.25 + s(t * 1.3) * 0.08; if (o.vis && R() < dt * 6){ const a = t * 2 + R(); X.emit(o.x + Math.cos(a) * 0.9, o.f.root.position.y + rr(0.4, 1.6), o.z + Math.sin(a) * 0.9, 0, 0.3, 0, R() < 0.6 ? 0x7ff3ff : 0xffe08a, 0.13, 1.2, { sway: 0.4 }); }
      return PZ({ laz: 0.75, raz: -0.75, le: -0.5, re: -0.5, lax: -0.35, rax: -0.35, llx: -0.15, rlx: 0.1, lk: 0.35, rk: 0.25, hd: 0.1, hy: 0.86 + br }); }
    case 'hermit': return PZ({ rax: -0.55, re: -0.4, raz: -0.15, lax: 0.2, le: -0.4, sp: 0.38, hd: -0.1 + s(t * 0.5) * 0.06, hdy: look * 0.5, hy: 0.82 + br, lk: 0.15, rk: 0.15 });
  }
  if (n.idle) return idlePose2(o, n.idle, t, br, look);
  return PZ({ hy: 0.86 + br, hdy: look, laz: 0.1, raz: -0.1 });
}
// 이야기 주민의 하는 일 (lore 의 idle) — 밭일 · 비질 · 망치질 · 책 · 요리 · 보초 · 기도 · 앉기 · 놀기 · 낚시
function idlePose2(o, id, t, br, look){
  const s = Math.sin, ph = (o.ph = o.ph ?? R() * 6), tt = t + ph;
  switch (id){
    case 'farm': { const cyc = (tt % 1.6) / 1.6, up = cyc < 0.6 ? ease(cyc / 0.6) : 1 - ease((cyc - 0.6) / 0.4); return PZ({ rax: -0.5 - 1.5 * up, re: -0.6 - 0.4 * up, lax: -0.6 - 1.3 * up, le: -0.7, laz: 0.15, sp: 0.35 - 0.15 * up, hd: 0.4, llx: -0.25, rlx: 0.2, hy: 0.84 + br }); }
    case 'sweep': { const w = s(tt * 2.2); return PZ({ rax: -0.7, raz: -0.1 + w * 0.3, re: -0.4, lax: -0.9, laz: 0.2 + w * 0.3, le: -0.9, sp: 0.3, sz: w * 0.08, hd: 0.35, hdy: w * 0.2, hy: 0.85 + br }); }
    case 'hammer': { const cyc = (tt % 1.1) / 1.1, up = cyc < 0.65 ? ease(cyc / 0.65) : 1 - ease((cyc - 0.65) / 0.35); if (cyc < (o.c0 ?? 1) && o.d < 12) X.sfx('clang'); o.c0 = cyc; return PZ({ rax: -0.6 - 1.8 * up, re: -0.5 - 0.7 * up, raz: -0.1, lax: -0.6, le: -0.9, sp: 0.3, hd: 0.4, hy: 0.85 + br }); }
    case 'read': { const pg = Math.pow(Math.max(0, s(tt * 0.4)), 20); return PZ({ lax: -1.2, laz: 0.05, le: -1.25, rax: -0.7 - pg * 0.6, raz: 0.3, re: -1.1, sp: 0.1, hd: 0.45 - pg * 0.3, hdy: -0.15, hy: 0.86 + br }); }
    case 'cook': { const a = tt * 2.4; return PZ({ rax: -0.85 + s(a) * 0.18, raz: -0.15 + Math.cos(a) * 0.2, re: -0.9, lax: -0.2, laz: 0.3, le: -0.6, sp: 0.28, hd: 0.3, hdy: s(tt * 0.4) * 0.2, hy: 0.86 + br }); }
    case 'guard': return PZ({ rax: -0.25, re: -1.35, raz: -0.08, lax: 0.05, laz: 0.12, le: -0.15, sp: -0.04, hd: -0.05, hdy: look * 0.7, hy: 0.87 + br });
    case 'pray': return PZ({ lax: -1.05, rax: -1.05, laz: -0.42, raz: 0.42, le: -1.35, re: -1.35, sp: 0.18, hd: 0.42 + s(tt * 0.5) * 0.04, hdy: 0, hy: 0.85 + br });
    case 'sit': return PZ({ hy: 0.3, llx: -1.45, rlx: -1.4, lk: 1.05, rk: 1.15, llz: 0.12, rlz: -0.12, lax: -0.65, rax: -0.6, laz: 0.12, raz: -0.12, le: -0.75, re: -0.8, sp: 0.16, hd: 0.06 + s(tt * 0.7) * 0.03, hdy: look });
    case 'play': { const k = Math.abs(s(tt * 4.2)), hop = Math.max(0, s(tt * 4.2)); return PZ({ laz: 0.6 + k * 0.9, raz: -0.6 - k * 0.9, le: -0.4, re: -0.4, llx: -0.3 * hop, rlx: 0.3 * hop, lk: hop * 0.5, rk: hop * 0.5, sp: -0.05, hd: -0.15, hdy: s(tt * 0.9) * 0.3, hy: 0.86 + hop * 0.12 + br }); }
    case 'fish': { const tug = Math.pow(Math.max(0, s(tt * 0.21)), 30); return PZ({ rax: -0.55 - tug * 1.0, raz: -0.08, re: -0.95, lax: -0.55, laz: 0.25, le: -1.05, sp: 0.05 - tug * 0.1, hd: 0.15, hdy: s(tt * 0.27) * 0.12, hy: 0.86 + br }); }
  }
  return PZ({ hy: 0.86 + br, hdy: look, laz: 0.1, raz: -0.1 });
}
const BUSYIDLE = { farm: 1, sweep: 1, hammer: 1, cook: 1, fish: 1, sit: 1 };
const _w = new V3();
const f2w = (bone, x, y, z) => _w.set(x, y, z).applyMatrix4(bone.matrixWorld);
function updNpcs(dt){
  for (const o of NPCL){
    const d = o.d = dP(o.x, o.z), vis = d < 85;
    if (vis !== o.vis){ o.vis = vis; o.f.root.visible = vis; if (o.props.bob) o.props.bob.visible = o.props.line.visible = vis && !!o.props.bobXZ; if (o.props.anvil) o.props.anvil.g.visible = vis; if (o.props.pot) o.props.pot.g.visible = vis; }
    if (!vis) continue;
    o.t += dt; o.gy = o.gy ?? gnd(o.x, o.z);
    o.f.mesh.castShadow = d < 40;
    // 가까이 오면 모험가를 바라봐요
    const want = d < 7 && !X.dialogOpen ? Math.atan2(P.x - o.x, P.z - o.z) : X.dialogOpen && d < 7 ? o.f.root.rotation.y : o.face0;
    o.f.root.rotation.y += angDiff(want, o.f.root.rotation.y) * Math.min(1, dt * 3);
    let tp = npcPose(o, dt);
    if (d < 7 && !['smith', 'herbalist', 'fisher', 'brick'].includes(o.n.id) && !BUSYIDLE[o.n.idle]) tp.hdy = 0;
    if (o.wave > 0){ o.wave -= dt; tp = emoPose('wave', 1.2 - o.wave, tp); }
    o.f.set(tp); o.f.blend(dt, 7);
    if (d < 30) o.av.upd(dt, 0, false);
    // 낚싯줄
    if (o.props.line && o.props.bobXZ){ const tip = o.props.rod.userData.tip.getWorldPosition(_w), [bx, bz] = o.props.bobXZ, wy = Math.max(F.H(bx, bz), F.waterY ? F.waterY(bx, bz) : W.water), bob = o.props.bob;
      const tug = Math.pow(Math.max(0, Math.sin(o.t * 0.21)), 30); bob.position.set(bx, wy - 0.02 + Math.sin(o.t * 2.3) * 0.03 - tug * 0.12, bz);
      const a = o.props.line.geometry.attributes.position; a.setXYZ(0, tip.x, tip.y, tip.z); a.setXYZ(1, bx, bob.position.y + 0.08, bz); a.needsUpdate = true; }
    // 인사 말풍선
    o.hiT -= dt;
    if (d < 9 && !o.near && o.hiT <= 0 && !X.dialogOpen){ o.hiT = 45; let g = null; try { g = F.greet && F.greet(o.n.id); } catch (e){} bubble(o.f.root, g || pick(NPC_HI[o.n.id] || ['좋은 하루예요!']), 4.5, 'npcb', o.n.idle === 'sit' ? 2.2 : 2.95); if (R() < 0.5) o.wave = 1.2; }
    o.near = d < 9;
  }
}

// ═════════════════════════ 5. 말풍선 · 채팅창 ═════════════════════════
const BUBS = [];
function bubble(obj, text, dur = 4, cls = '', y = 2.95){
  const old = BUBS.find(b => b.obj === obj); if (old){ old.L.remove(); BUBS.splice(BUBS.indexOf(old), 1); }
  const L = F.label({ obj, text: esc(text), cls: 'bub ' + cls, max: 34, y }); L.always = obj === X.fig.root;
  BUBS.push({ obj, L, at: T + dur, rt: performance.now() + dur * 1000 }); return L;
}
function updBubbles(){ const now = performance.now(); for (let i = BUBS.length - 1; i >= 0; i--){ const b = BUBS[i]; if (now > b.rt || !b.obj.parent){ b.L.remove(); BUBS.splice(i, 1); } } }
F.say = (text, dur = 4.5) => { if (!text) return; bubble(X.fig.root, String(text).slice(0, 80), dur, 'me', 2.55); };

const chatEl = X.mk('div', 'lchat', `<div class="tb"><button data-t="all">전체</button><button data-t="talk">대화</button><button data-t="sys">시스템</button><span class="sp"></span><em class="hk">Enter 대화 · T 감정표현</em><button class="mn" title="접기">▾</button></div>
  <div class="lg"></div><div class="in"><span>전체</span><input maxlength="70" placeholder="메시지 입력 · /춤 /인사 /앉기 …" enterkeyhint="send" autocomplete="off"></div>`, X.hud);
const logEl = chatEl.querySelector('.lg'), inp = chatEl.querySelector('input'), mnB = chatEl.querySelector('.mn');
function setTab(t){ S.life.tab = t; chatEl.dataset.t = t; chatEl.querySelectorAll('.tb button[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t)); }
function setMin(v){ S.life.chatMin = v; chatEl.classList.toggle('min', v); mnB.textContent = v ? '▴' : '▾'; mnB.title = v ? '펼치기' : '접기'; }
setTab(S.life.tab); setMin(S.life.chatMin);
chatEl.querySelectorAll('.tb button[data-t]').forEach(b => b.onclick = e => { e.stopPropagation(); setTab(b.dataset.t); X.save(); });
mnB.onclick = e => { e.stopPropagation(); setMin(!S.life.chatMin); X.save(); };
chatEl.querySelector('.lg').onclick = e => { e.stopPropagation(); if (S.life.chatMin) setMin(false); else openChat(); };
const TAG = { world: '[월드]', party: '[파티]', trade: '[거래]', sys: '[시스템]', boss: '', raid: '', rare: '', local: '', me: '', npc: '' };
const LINES = [];
function addLine(html, kind){
  const d = document.createElement('div'); d.className = 'ln k-' + kind; d.innerHTML = html; logEl.appendChild(d);
  LINES.push({ d, t: performance.now() }); while (LINES.length > 60){ LINES.shift().d.remove(); }
}
function chatLine(from, text, kind = 'world', raw = false){
  const tg = TAG[kind] ? `<i>${TAG[kind]}</i>` : '';
  addLine(`${tg}${from ? `<b>${esc(from)}</b>: ` : ''}${raw ? text : esc(text)}`, kind);
}
const sysLine = (html, kind = 'sys') => addLine(html.startsWith('<i>') ? html : `<i>${TAG[kind] || ''}</i>${html}`, kind);
// 다른 모듈용: F.chat(text, from, kind) — kind: sys(기본) · world · party · trade · local · npc · boss · raid · rare
F.chat = (text, from = '', kind = 'sys') => { if (from) addLine(`${TAG[kind] ? `<i>${TAG[kind]}</i>` : ''}<b>${esc(from)}</b>: ${text}`, kind); else sysLine(String(text), kind); };
function openChat(prefix = ''){
  if (!F.inField) return;
  if (S.life.chatMin) setMin(false);
  for (const k in G.keys) G.keys[k] = false;
  chatEl.classList.add('typing'); inp.value = prefix; inp.focus();   // 키다운 중에 옮긴 포커스로 '/' 글자가 그대로 들어와요 · 터치에선 제스처 안에서 바로 포커스해야 키보드가 떠요
}
function closeChat(){ chatEl.classList.remove('typing'); inp.value = ''; inp.blur(); }
inp.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter' && !e.isComposing){ e.preventDefault(); const v = inp.value.trim(); closeChat(); if (v) playerSays(v); }
  else if (e.key === 'Escape'){ e.preventDefault(); closeChat(); }
});
inp.addEventListener('keyup', e => e.stopPropagation());
inp.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== inp) chatEl.classList.remove('typing'); }, 50));
chatEl.addEventListener('pointerdown', e => e.stopPropagation());
chatEl.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
function ageLines(){ const now = performance.now(); for (const l of LINES) if (!l.old && now - l.t > 25000){ l.old = true; l.d.classList.add('old'); } }

// ═════════════════════════ 6. 감정표현 ═════════════════════════
const EMOTES = [
  { id: 'wave', n: '손 흔들기', icon: '👋', dur: 2.2 }, { id: 'bow', n: '인사', icon: '🙇', dur: 1.6 }, { id: 'dance', n: '춤', icon: '💃', dur: 9, loop: true }, { id: 'sit', n: '앉기', icon: '🪑', dur: 999, loop: true },
  { id: 'cheer', n: '환호', icon: '🎉', dur: 2.0 }, { id: 'clap', n: '박수', icon: '👏', dur: 2.2 }, { id: 'think', n: '생각', icon: '🤔', dur: 3.0 }, { id: 'point', n: '손가락질', icon: '👉', dur: 2.0 },
];
const EMO_BY = Object.create(null); for (const e of EMOTES){ EMO_BY[e.id] = e; EMO_BY[e.n] = e; EMO_BY[e.n.replace(/ /g, '')] = e; }
function emoPose(id, t, tp){
  const s = Math.sin, p = Object.assign({}, tp || PZ({}));
  switch (id){
    case 'wave': return Object.assign(p, { raz: -2.55 + s(t * 9) * 0.35, re: -0.45 + s(t * 9 + 1) * 0.25, rax: -0.1, hd: -0.08, hdy: 0 });
    case 'bow': { const k = t < 0.35 ? ease(t / 0.35) : t < 1.05 ? 1 : Math.max(0, 1 - (t - 1.05) / 0.45); return Object.assign(p, { sp: 0.95 * k, hd: 0.35 * k, lax: -0.12 * k, rax: -0.12 * k, laz: 0.1, raz: -0.1, le: -0.15, re: -0.15, hdy: 0 }); }
    case 'dance': { const b = t * 7.5, a = s(b), c = s(b * 0.5); return Object.assign(p, { hy: 0.84 + Math.abs(a) * 0.05, sz: c * 0.2, sp: 0.04, laz: 1.3 + c * 1.1, raz: -1.3 + c * 1.1, le: -0.7 - a * 0.4, re: -0.7 + a * 0.4, lax: -0.3, rax: -0.3,
      llx: a * 0.3, rlx: -a * 0.3, lk: Math.max(0, a) * 0.6, rk: Math.max(0, -a) * 0.6, llz: 0.05, rlz: -0.05, hd: s(b * 2) * 0.07, hdy: c * 0.3 }); }
    case 'sit': return Object.assign(PZ({}), { hy: 0.3, llx: -1.45, rlx: -1.4, lk: 1.05, rk: 1.15, llz: 0.12, rlz: -0.12, lax: -0.65, rax: -0.6, laz: 0.12, raz: -0.12, le: -0.75, re: -0.8, sp: 0.16, hd: 0.06 + s(t * 0.7) * 0.03, hdy: s(t * 0.3) * 0.35 });
    case 'cheer': { const k = Math.abs(s(t * 8)); return Object.assign(p, { laz: 2.45 + k * 0.4, raz: -2.45 - k * 0.4, lax: -0.2, rax: -0.2, le: -0.25 - k * 0.3, re: -0.25 - k * 0.3, sp: -0.15, hd: -0.3, hdy: 0 }); }
    case 'clap': { const c = s(t * 15); return Object.assign(p, { lax: -1.25, rax: -1.25, laz: -0.28 + c * 0.24, raz: 0.28 - c * 0.24, le: -0.95, re: -0.95, sp: 0.05, hd: 0.05, hdy: 0 }); }
    case 'think': return Object.assign(p, { rax: -0.9, raz: 0.32, re: -2.35, lax: -0.45, laz: -0.25, le: -1.5, hd: 0.12, hdy: 0.25 + s(t * 0.8) * 0.1, sz: 0.04 });
    case 'point': { const j = Math.max(0, s(t * 6)) * 0.12; return Object.assign(p, { rax: -1.55 - j, raz: -0.05, re: 0, lax: 0.1, laz: 0.25, le: -0.4, hd: -0.05, sp: -0.05 + j * 0.3, hdy: 0 }); }
  }
  return p;
}
function emoFx(id, x, y, z){
  if (id === 'cheer') for (let i = 0; i < 26; i++) X.emit(x + rr(-0.3, 0.3), y + 2.0, z + rr(-0.3, 0.3), rr(-2.5, 2.5), rr(3, 6), rr(-2.5, 2.5), pick([0xff5a7a, 0xffd36a, 0x6ad8ff, 0x8aff9a, 0xc08aff]), rr(0.12, 0.2), rr(0.9, 1.5), { grav: -7, drag: 1.2 });
  else if (id === 'clap') for (let i = 0; i < 6; i++) X.emit(x + rr(-0.4, 0.4), y + 1.4, z + rr(-0.4, 0.4), rr(-0.6, 0.6), rr(0.5, 1.2), rr(-0.6, 0.6), 0xffe08a, 0.1, 0.6);
  else if (id === 'dance') for (let i = 0; i < 8; i++) X.emit(x + rr(-1, 1), y + rr(0.2, 2), z + rr(-1, 1), 0, rr(0.3, 0.8), 0, pick([0xff8ad0, 0x8ad8ff, 0xffe08a]), 0.14, 1.4, { sway: 0.6 });
}
let EMO = null;   // 플레이어 감정표현 { id, t, seen }
X.emotePose = tp => { if (!EMO) return null; EMO.seen = T; return emoPose(EMO.id, EMO.t, tp); };
F.emote = name => {
  const em = EMO_BY[name] || EMO_BY[String(name || '').replace(/^\//, '')]; if (!em || X.dead || !F.inField) return false;
  closeWheel();
  EMO = { id: em.id, t: 0, seen: T }; S.life.emo++;
  bubble(X.fig.root, em.icon, Math.min(em.dur, 3), 'emo', 2.5);
  if (em.id === 'cheer' && X.player.ground) X.player.vy = 5.6;
  emoFx(em.id, P.x, P.y, P.z); X.sfx(em.id === 'cheer' ? 'level' : 'ui');
  BUS.emit('emote', { id: em.id });
  // 근처 봇이 따라 하거나 답해요
  const nb = BOTS.filter(b => b.d < 14 && b.vis && !b.busy()).sort((a, b) => a.d - b.d).slice(0, 3);
  nb.forEach((b, i) => later(rr(0.5, 1.3) + i * 0.35, () => botReact(b, em.id)));
  return true;
};
function updPlayerEmote(dt){
  if (!EMO) return;
  EMO.t += dt; const em = EMO_BY[EMO.id];
  if ((X.player.speed > 1.0 && EMO.t > 0.3) || X.dead || T - EMO.seen > 0.3 || (!em.loop && EMO.t > em.dur) || EMO.t > em.dur){ EMO = null; return; }
  if (EMO.id === 'dance' && X.player.speed < 0.3) X.fig.root.rotation.y += dt * Math.sin(EMO.t * 1.4) * 1.6;
  if (EMO.id === 'dance' && R() < dt * 3) emoFx('dance', P.x, P.y, P.z);
}
// 감정표현 휠 (T)
const wheel = X.mk('div', 'emw', `<div class="rg"></div><div class="ct"><b>감정표현</b><small>${G.IS_TOUCH ? '눌러서 선택' : '1~8 · T / Esc 닫기'}</small></div>`);
EMOTES.forEach((em, i) => { const a = i / EMOTES.length * TAU - Math.PI / 2, b = document.createElement('button');
  b.style.left = `calc(50% + ${Math.cos(a) * 107}px)`; b.style.top = `calc(50% + ${Math.sin(a) * 107}px)`;
  b.innerHTML = `<span>${em.icon}</span><b>${em.n}</b><kbd>${i + 1}</kbd>`; b.onclick = e => { e.stopPropagation(); F.emote(em.id); }; wheel.appendChild(b); });
wheel.addEventListener('click', () => closeWheel());
let wheelOpen = false;
function openWheel(){ if (!F.inField || X.dialogOpen) return; wheelOpen = true; wheel.classList.add('on'); X.sfx('ui'); }
function closeWheel(){ if (!wheelOpen) return; wheelOpen = false; wheel.classList.remove('on'); }
const emoBtn = F.menu ? F.menu.add('😀', '감정표현', () => wheelOpen ? closeWheel() : openWheel(), 'T') : null;
X.KEYH.push(code => {
  if (!F.inField) return false;
  if (wheelOpen){
    if (code === 'Escape' || code === 'KeyT'){ closeWheel(); return true; }
    const n = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5, Digit6: 6, Digit7: 7, Digit8: 8, Numpad1: 1, Numpad2: 2, Numpad3: 3, Numpad4: 4, Numpad5: 5, Numpad6: 6, Numpad7: 7, Numpad8: 8 }[code];
    if (n){ F.emote(EMOTES[n - 1].id); return true; }
    return false;
  }
  if (code === 'KeyT'){ openWheel(); return true; }
  if (code === 'Enter' || code === 'NumpadEnter'){ openChat(); return true; }
  if (code === 'Slash'){ openChat(''); return true; }
  return false;
});

// ═════════════════════════ 7. 봇 모험가 (가짜 플레이어) ═════════════════════════
// ── 길 그래프 (WORLD.roads) ──
const NODES = [], ADJ = [];
const nodeAt = (x, z) => { for (let i = 0; i < NODES.length; i++) if (Math.hypot(NODES[i][0] - x, NODES[i][1] - z) < 6) return i; NODES.push([x, z]); ADJ.push([]); return NODES.length - 1; };
for (const rd of W.roads){ let prev = -1; for (const [x, z] of rd.pts){ const i = nodeAt(x, z); if (prev >= 0 && prev !== i && !ADJ[prev].includes(i)){ ADJ[prev].push(i); ADJ[i].push(prev); } prev = i; } }
const nearestNode = (x, z) => { let b = 0, bd = 1e9; for (let i = 0; i < NODES.length; i++){ const d = Math.hypot(NODES[i][0] - x, NODES[i][1] - z); if (d < bd){ bd = d; b = i; } } return b; };
function roadPath(a, b){
  const n = NODES.length, dist = new Float64Array(n).fill(1e12), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n); dist[a] = 0;
  for (;;){ let u = -1, ud = 1e12; for (let i = 0; i < n; i++) if (!done[i] && dist[i] < ud){ ud = dist[i]; u = i; } if (u < 0 || u === b) break; done[u] = 1;
    for (const v of ADJ[u]){ const w = ud + Math.hypot(NODES[u][0] - NODES[v][0], NODES[u][1] - NODES[v][1]); if (w < dist[v]){ dist[v] = w; prev[v] = u; } } }
  const out = []; for (let u = b; u >= 0; u = prev[u]) out.unshift(u); return out[0] === a ? out : [a, b];
}
function planPath(x0, z0, x1, z1, lane){
  const direct = Math.hypot(x1 - x0, z1 - z0);
  const a = nearestNode(x0, z0), b = nearestNode(x1, z1);
  if (direct < 75 || a === b) return [[x1, z1]];
  const ids = roadPath(a, b), out = [];
  for (let i = 0; i < ids.length; i++){ const [x, z] = NODES[ids[i]], nx = NODES[ids[Math.min(ids.length - 1, i + 1)]], px = NODES[ids[Math.max(0, i - 1)]];
    const dx = nx[0] - px[0], dz = nx[1] - px[1], dl = Math.hypot(dx, dz) || 1; out.push([x - dz / dl * lane, z + dx / dl * lane]); }
  // 첫 노드가 뒤쪽이면 건너뛰어요
  if (out.length > 1){ const [ax, az] = out[0], [bx, bz] = out[1]; if ((bx - ax) * (bx - x0) + (bz - az) * (bz - z0) > 0 && Math.hypot(bx - x0, bz - z0) < Math.hypot(bx - ax, bz - az)) out.shift(); }
  const [lx, lz] = out[out.length - 1]; if (Math.hypot(lx - x1, lz - z1) > 2) out.push([x1, z1]); else out[out.length - 1] = [x1, z1];
  return out;
}

// ── 장소 ──
const VC = (F.regionById('village') || { c: [0, 560] }).c;
const AVOID = [...W.npcs.map(n => [n.c[0], n.c[1], 3.4]), [-24, 553, 7.5], [26, 559, 3], [-52, 536, 6], [47.5, 541, 3.5], [55, 533, 4.5], [58, 554, 1.5], [51, 554, 1.6]];
const TOWNS = W.settlements || [];
function villageSpot(b){
  // 정착지에 놀러 온 봇: 광장(반경의 35%) 안에서, 주민 자리는 비켜서
  const tw = b && b.town; if (tw){ for (let t = 0; t < 20; t++){ const a = R() * TAU, r = tw.r * (0.12 + R() * 0.26), x = tw.c[0] + Math.cos(a) * r, z = tw.c[1] + Math.sin(a) * r; if (W.npcs.some(n => Math.hypot(n.c[0] - x, n.c[1] - z) < 2.6) || F.isWater(x, z)) continue; return [x, z]; } return [tw.c[0] + rr(-3, 3), tw.c[1] + rr(-3, 3)]; }
  for (let t = 0; t < 30; t++){ const x = VC[0] + rr(-42, 42), z = 551 + rr(-11, 11); if (((x - VC[0]) / 46) ** 2 + ((z - 551) / 14) ** 2 > 1) continue; if (AVOID.some(([ax, az, r]) => Math.hypot(x - ax, z - az) < r)) continue; return [x, z]; }
  return [VC[0] + rr(-8, 8), 549];
}
const fireSpots = [];
function addFire(x, z, own){ fireSpots.push({ x, z, own, seats: 0 }); }
addFire(-264, 226, false);   // 사냥꾼 야영지 모닥불 (landmarks)
const LMK = W.landmarks || [];
const SIGHTS = LMK.filter(l => !['village', 'runegate'].includes(l.id)).map(l => ({ id: l.id, name: l.name, x: l.c[0], z: l.c[1], r: Math.min(l.r * 0.5, 14) }));
const FISHS = [];
function prepFish(){ for (const f of W.fishing){ if (f.id === 'f_pond') continue; let best = null;
  for (let k = 0; k < 10 && !best; k++){ const a = R() * TAU, r = rr(3.5, 7), x = f.c[0] + Math.cos(a) * r, z = f.c[1] + Math.sin(a) * r; if (F.isWater(x, z) || F.slope(x, z) > 0.5) continue;
    for (let j = 0; j < 12; j++){ const b = j / 12 * TAU; if (F.isWater(x + Math.sin(b) * 4.5, z + Math.cos(b) * 4.5) && F.isWater(x + Math.sin(b) * 3, z + Math.cos(b) * 3)){ best = { x, z, ry: b, id: f.id, used: 0 }; break; } } }
  if (best) FISHS.push(best); } }
const HAWK = (W.bluffs || []).find(b => b.id === 'hawk') || { c: [-205, 402], r: 34, dir: Math.PI };

// ── 이름 · 외형 ──
const NA = ['별빛', '달빛', '새벽', '노을', '은빛', '검은', '하얀', '불꽃', '서리', '바람', '천둥', '무지개', '초코', '딸기', '말랑', '꿀벌', '버섯', '고양이', '냥냥', '멍멍', '졸린', '배고픈', '행복한', '수상한', '용감한', '꼬마', '대왕', '전설의', '귀여운', '무적', '번개', '푸른'];
const NB = ['기사', '검사', '궁수', '마법사', '사냥꾼', '킬러', '전사', '요정', '용사', '수호자', '탐험가', '방랑자', '장인', '공주', '왕자', '대장', '헌터', '도적', '러버', '주먹', '집사', '농부', '낚시꾼'];
const NU = ['쪼렙탈출', '레이드중독', '오늘만산다', '퇴근하고싶다', '엄마나렙업', '치킨먹고싶다', '강화실패장인', '골드거지', '사과맛젤리', '감자도리', '김치볶음밥', '눈팅만함', '슬라임킬러', '꿀벌사냥꾼', '룬덕후', '글라이더장인',
  '낚시왕', '버섯맛집', 'xX암살자Xx', '갓겜아르카디아', '민트초코러버', '새벽감성', '폭풍성장중', '무과금전사', '방구석용사', '말랑대왕팬', '설인무서워', '도토리부자', '야근하는용사', '귤까먹는중'];
const GUILDS = ['룬의기사단', '새싹길드', '늪지탐험대', '치킨클럽', '별빛여단', '고양이연합', '밤샘원정대', '말랑말랑', '하늘끝등반대', '용사협회'];
const USED = new Set(W.npcs.map(n => n.name));
function makeName(){
  for (let t = 0; t < 40; t++){ let n = R() < 0.55 ? pick(NA) + pick(NB) : pick(NU); if (R() < (n.length > 5 ? 0.25 : 0.4)) n += pick(['99', '7', '77', '123', '1004', '2', '3', 'z', '_']); if (!USED.has(n)){ USED.add(n); return n; } }
  return '모험가' + ri(100, 999);
}
const JOBK = Object.keys(X.JOBS || { sword: 1, archer: 1, mage: 1, rogue: 1 });
function cosPick(slot, tier, chance){ const L = (X.COS[slot] || []).filter(it => it.id !== 'none' && it.id !== 'clay' && it.r <= tier); if (!L.length || R() > chance) return null; const w = L.map(it => [it.id, 1 + it.r * (tier >= 2 ? 1.5 : 0.3)]); return wpick(w); }
function makeLook(lv){ const tier = lv < 6 ? 0 : lv < 13 ? 1 : lv < 21 ? 2 : 3, k = lv / 30;
  return { hat: cosPick('hat', tier, 0.25 + k * 0.6), back: cosPick('back', tier, 0.15 + k * 0.7), body: cosPick('body', tier, 0.25 + k * 0.5), wpn: lv >= 8 ? cosPick('wpn', tier, 0.35) : null, aura: lv >= 12 ? cosPick('aura', tier, 0.3) : null }; }
const BOTS = [];
F.bots = BOTS;
const BAND = [[1, 5, 9], [4, 9, 6], [7, 12, 5], [11, 16, 4], [16, 21, 3], [20, 25, 3], [24, 30, 4]];
function newBot(i, floater){
  let lv; if (floater) lv = clamp(S.lv + ri(-2, 3), 1, 30); else { const b = wpick(BAND.map(b => [b, b[2]])); lv = ri(b[0], b[1]); }
  const job = lv < 3 && R() < 0.5 ? null : pick(JOBK), asc = !!job && lv >= 12 && R() < (lv - 10) / 14;
  const b = { i, name: makeName(), lv, job, asc, look: makeLook(lv), guild: R() < 0.45 ? pick(GUILDS) : null, floater, ph: R() * 10, lane: rr(-1.8, 1.8),
    x: 0, z: 0, y: 0, ry: R() * TAU, want: 0, d: 1e9, vis: false, act: null, st: '', actT: 0, path: null, pi: 0, sp: 0, mv: 0, combo: 0, atkCd: 0, skillCd: rr(4, 10), chatCd: rr(5, 30), sub: null, subT: 0 };
  b.ranged = job === 'archer' || job === 'mage';
  b.busy = () => !!(b.atk || b.roll || b.gl || b.skill || b.act === 'glide');
  return b;
}
const BOT_N = LOW ? 22 : 36;
for (let i = 0; i < BOT_N; i++) BOTS.push(newBot(i, i < (LOW ? 4 : 7)));
const pickBot = (fn = () => true) => { const L = BOTS.filter(fn); return L.length ? pick(L) : null; };
const botLabelText = b => `<i>Lv.${b.lv}</i>${b.name}`;
const botSub = b => b.afk ? '💤 자리비움' : b.guild ? `〈${b.guild}〉` : b.job ? (b.asc ? X.JOBS[b.job].asc.n : X.JOBS[b.job].n) : '모험가';
const SUBD = 14;   // 길드 · 직업 줄은 가까울 때만
function refreshLabel(b){ if (b.label){ b.label.set(botLabelText(b), b.d < SUBD || b.afk ? botSub(b) : ''); b.label.el.classList.toggle('afk', !!b.afk); b._sub = b.d < SUBD || b.afk; } }
// 글라이더 · 낚싯대 (봇용)
const GLIDER_G = once('glider', () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.05, 0.8, -1.6, -0.15, -0.4, 0, 0.12, -0.25, 0, 0.05, 0.8, 0, 0.12, -0.25, 1.6, -0.15, -0.4], 3)); g.computeVertexNormals(); return g; });
const GLIDER_T = once('gliderT', () => merge([TM(new THREE.CylinderGeometry(0.018, 0.018, 1.8, 4), -0.8, -0.05, 0.2, 0, -1.1, Math.PI / 2 - 0.12), TM(new THREE.CylinderGeometry(0.018, 0.018, 1.8, 4), 0.8, -0.05, 0.2, 0, 1.1, -Math.PI / 2 + 0.12), TM(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 4), 0, 0.08, 0.28, Math.PI / 2, 0, 0)]));
const GLM = {};
const gliderMat = c => GLM[c] || (GLM[c] = sm(c, { emissive: c, emissiveIntensity: 0.25, roughness: 0.6 }));
function ensureFig(b){
  if (b.av) return;
  let av; try { av = X.makeAvatar({ job: b.job, asc: b.asc, look: b.look, scale: rr(0.83, 0.9) }); } catch (e){ console.warn('[life] 봇 외형', b.look, e); b.look = {}; av = X.makeAvatar({ job: b.job, asc: b.asc, look: {}, scale: 0.86 }); }
  b.av = av; b.fig = av.fig; b.root = av.fig.root; b.root.visible = false;
  b.label = F.label({ obj: b.root, text: botLabelText(b), sub: '', cls: 'bot', max: 28, y: 2.42 });
  const gl = new THREE.Group(); gl.position.set(0, 2.25, -0.05); mesh(GLIDER_G, gliderMat(av.color || 0x8ff4ff), gl, true); mesh(GLIDER_T, M_GOLD, gl, false); mesh(TM(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 5), 0, -0.45, 0.2, 0, 0, Math.PI / 2), M_WOOD, gl, false);
  gl.visible = false; b.root.add(gl); b.glider = gl;
}
function showBot(b, v){
  if (v){ ensureFig(b); if (!b.root.parent) FW.add(b.root); b.root.visible = true; }
  else if (b.root){ b.root.visible = false; if (b.root.parent) FW.remove(b.root); if (b.rod){ b.rod.visible = false; } }
  b.vis = v;
}

// ── 활동 고르기 ──
function campFor(b){
  const L = CAMPS.filter(o => b.lv >= o.c.lv[0] - 2 && b.lv <= o.c.lv[1] + 2 && BOTS.filter(q => q !== b && q.act === 'hunt' && q.camp === o.c.id).length < 2);
  if (!L.length) return null;
  return wpick(L.map(o => { const d = Math.hypot(o.c.c[0] - b.x, o.c.c[1] - b.z), dp = dP(o.c.c[0], o.c.c[1]); return [o, 1 / (60 + d) + (b.floater ? 4 / (40 + dp) : 0)]; }));
}
function setAct(b, act, x, z, dur, extra = {}){
  b.act = act; b.st = 'go'; b.actT = dur; b.tx = x; b.tz = z; Object.assign(b, { atk: null, skill: null, roll: null, camp: null, fire: null, fish: null, sight: null, tgt: null, sub: null, subT: rr(2, 5), loot: 0, town: null }, extra);
  b.path = planPath(b.x, b.z, x, z, b.lane); b.pi = 0;
  if (b.afk){ b.afk = false; refreshLabel(b); }
}
function nextAct(b){
  if (b.fish){ b.fish.used = Math.max(0, b.fish.used - 1); }
  if (b.fire){ b.fire.seats = Math.max(0, b.fire.seats - 1); }
  // 필드 보스!
  if (FB.cur && b.lv >= FB.cur.fb.lv - 5 && R() < 0.6 && Math.hypot(FB.cur.fb.c[0] - b.x, FB.cur.fb.c[1] - b.z) < 420 && BOTS.filter(o => o.act === 'boss').length < (LOW ? 5 : 8)){ const [x, z] = FB.cur.fb.c; return setAct(b, 'boss', x + rr(-6, 6), z + rr(-6, 6), 400); }
  const vill = BOTS.filter(o => o.act === 'village' && !o.town).length;
  const a = wpick([['hunt', 46], ['village', vill < 6 ? 30 : b.lv < 8 ? 14 : 8], ['town', TOWNS.length ? 13 : 0], ['rest', 9], ['fish', FISHS.length ? 8 : 0], ['sight', 7], ['glide', b.lv >= 3 && b.lv <= 16 ? 6 : 1], ['afk', 3]]);
  if (a === 'town'){ // 레벨에 맞는 정착지 (가까운 것 먼저)에 들러 쉬고 수다 떨어요
    const L = TOWNS.filter(t => { const r = F.regionById(t.region); return r && b.lv >= r.lv[0] - 3 && b.lv <= r.lv[1] + 3 && BOTS.filter(o => o.town === t).length < 5; }).sort((p, q) => Math.hypot(p.c[0] - b.x, p.c[1] - b.z) - Math.hypot(q.c[0] - b.x, q.c[1] - b.z));
    const t = L[R() < 0.7 ? 0 : ri(0, Math.max(0, L.length - 1))]; if (t){ b.town = t; const [x, z] = villageSpot(b); return setAct(b, 'village', x, z, rr(50, 130), { town: t }); } }
  if (a === 'hunt'){ const o = campFor(b); if (o){ const a2 = R() * TAU, r = o.c.r * 0.4; return setAct(b, 'hunt', o.c.c[0] + Math.cos(a2) * r, o.c.c[1] + Math.sin(a2) * r, rr(70, 200), { camp: o.c.id }); } }
  if (a === 'rest' && fireSpots.length){ const f = fireSpots.slice().sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z)).slice(0, 3).filter(f => f.seats < 5)[0];
    if (f){ f.seats++; const k = f.seats * 1.25 + R() * 0.4, sx = f.x + Math.sin(k) * 2.0, sz = f.z + Math.cos(k) * 2.0; return setAct(b, 'rest', sx, sz, rr(40, 90), { fire: f }); } }
  if (a === 'fish'){ const f = FISHS.filter(f => !f.used).sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z))[0]; if (f){ f.used = 1; return setAct(b, 'fish', f.x, f.z, rr(50, 130), { fish: f }); } }
  if (a === 'sight' && SIGHTS.length){ const L = SIGHTS.filter(s => Math.hypot(s.x - b.x, s.z - b.z) < 380); const s = pick(L.length ? L : SIGHTS); const a2 = R() * TAU; return setAct(b, 'sight', s.x + Math.cos(a2) * s.r, s.z + Math.sin(a2) * s.r, rr(14, 28), { sight: s }); }
  if (a === 'glide'){ const [hx, hz] = HAWK.c; return setAct(b, 'glide', hx + 4 + rr(-3, 3), hz + rr(-8, 8), 60); }
  if (a === 'afk' && W.waypoints.length){ const w = W.waypoints.slice().sort((p, q) => Math.hypot(p.c[0] - b.x, p.c[1] - b.z) - Math.hypot(q.c[0] - b.x, q.c[1] - b.z))[ri(0, 1)] || W.waypoints[0]; const a2 = R() * TAU; return setAct(b, 'afk', w.c[0] + Math.cos(a2) * 4, w.c[1] + Math.sin(a2) * 4, rr(60, 160)); }
  const [x, z] = villageSpot(); setAct(b, 'village', x, z, rr(40, 110));
}
// 인구 감독: 플레이어 주변이 비면 먼 곳의 봇을 (안 보이는 곳에서) 이쪽으로 걸어오게 해요
function director(){
  const near = BOTS.filter(b => b.d < 150).length, MIN = LOW ? 7 : 11;
  if (near >= MIN) return;
  const cand = BOTS.filter(b => b.d > 260 && !b.gl && !b.busy() && b.act !== 'party'); if (!cand.length) return;
  const b = pick(cand), reg = F.regionAt(P.x, P.z);
  if (reg && !reg.safe && (b.lv < reg.lv[0] - 3 || b.lv > reg.lv[1] + 4)){ b.lv = clamp(ri(reg.lv[0], reg.lv[1] + 1), 1, 30); refreshLabel(b); }
  const spots = NODES.filter(n => { const d = dP(n[0], n[1]); return d > 125 && d < 210; });
  if (spots.length){ const n = pick(spots); b.x = n[0] + rr(-2, 2); b.z = n[1] + rr(-2, 2); }
  else { for (let t = 0; t < 10; t++){ const a = R() * TAU, x = P.x + Math.cos(a) * 140, z = P.z + Math.sin(a) * 140; if (Math.abs(x) < W.half - 130 && Math.abs(z) < W.half - 130 && !F.isWater(x, z)){ b.x = x; b.z = z; break; } } }
  b.y = gnd(b.x, b.z); b.floater = true; b.actT = 0; b.atk = b.skill = b.roll = null; b.emote = null;
  if (b.fish){ b.fish.used = 0; b.fish = null; } if (b.fire){ b.fire.seats = Math.max(0, b.fire.seats - 1); b.fire = null; }
  if (reg && reg.safe && R() < 0.6){ const [x, z] = villageSpot(); return setAct(b, 'village', x, z, rr(40, 110)); }
  const o = R() < 0.75 ? campFor(b) : null;
  if (o){ const a2 = R() * TAU, r = o.c.r * 0.4; setAct(b, 'hunt', o.c.c[0] + Math.cos(a2) * r, o.c.c[1] + Math.sin(a2) * r, rr(80, 200), { camp: o.c.id }); }
  else nextAct(b);
}
// 처음 배치: 이미 각자 할 일을 하는 중
function placeInitial(){
  for (const b of BOTS){
    const r = R();
    if (r < 0.3){ const [x, z] = villageSpot(); b.x = x; b.z = z; setAct(b, 'village', x, z, rr(20, 100)); }
    else { b.x = VC[0]; b.z = VC[1]; nextAct(b); const L = b.path; if (L && L.length){ const k = R() < 0.65 ? L.length - 1 : ri(0, L.length - 1); [b.x, b.z] = L[k]; b.pi = k; if (k === L.length - 1){ b.st = 'at'; b.pi = L.length; } } }
    b.y = gnd(b.x, b.z); b.actT *= rr(0.3, 1);
  }
}

// ── 봇 이동 · 포즈 ──
function stepPath(b, dt, sp){
  if (!b.path || b.pi >= b.path.length) return true;
  const [tx, tz] = b.path[b.pi], dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
  if (d <= Math.max(0.3, sp * dt)){ b.x = tx; b.z = tz; b.pi++; return b.pi >= b.path.length; }
  b.x += dx / d * sp * dt; b.z += dz / d * sp * dt; b.want = Math.atan2(dx, dz); b.mv = sp; return false;
}
function moveTo(b, tx, tz, dt, sp){ const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz); if (d < 0.25) return true; const s = Math.min(d, sp * dt); b.x += dx / d * s; b.z += dz / d * s; b.want = Math.atan2(dx, dz); b.mv = sp; return false; }
const runSp = b => 7.8 + (b.i % 5) * 0.35;
function bowPose(u){ return PZ({ lax: -1.55, laz: 0.05, le: 0, rax: -1.45, raz: 0.15, re: -0.5 - 1.6 * u, sp: 0.1, llx: -0.25, rlx: 0.25 }); }
function staffPose(k){ const u = ease(Math.min(1, k / 0.4)); return PZ({ rax: -0.6 - 1.0 * u, re: -0.9 + 0.8 * u, raz: 0.1, lax: -0.9 * u, laz: 0.4, le: -0.6, sp: 0.15 * u, llx: -0.3, rlx: 0.2 }); }
function atkPose(b){
  const a = b.atk, k = Math.min(1, a.t / a.dur);
  if (b.job === 'archer') return bowPose(k < 0.42 ? k / 0.42 : Math.max(0, 1 - (k - 0.42) * 3));
  if (b.job === 'mage') return staffPose(k);
  const u = ease(Math.min(1, k / 0.55));
  if (a.i === 0) return PZ({ rax: -1.5 - 0.5 * (1 - u), raz: -1.5 + 2.2 * u, re: -0.25, lax: -0.4, laz: 0.4, sp: 0.15, llx: -0.5, rlx: 0.3, lk: 0.3, hd: 0.1 });
  if (a.i === 1) return PZ({ rax: -1.3, raz: 0.8 - 2.4 * u, re: -0.2, lax: -0.2, laz: 0.5, sp: 0.2, llx: 0.3, rlx: -0.5, rk: 0.3, hd: 0.1 });
  return PZ({ rax: -1.4, raz: -1.55, re: 0, lax: -0.2, laz: 1.4, sp: 0.25, hy: 0.74, lk: 0.6, rk: 0.6, llx: -0.4, rlx: 0.3, llz: 0.3, rlz: -0.3 });
}
function idlePose(b, t){
  const p = PZ({ hy: 0.86 + Math.sin(t * 2 + b.ph) * 0.004, sp: Math.sin(t * 2 + b.ph) * 0.015, laz: 0.1, raz: -0.1, hdy: Math.sin(t * 0.37 + b.ph) * 0.4 });
  if (b.job && b.act !== 'village' && b.act !== 'afk'){ if (b.job === 'archer'){ p.lax -= 0.25; p.le -= 0.4; } else { p.rax -= 0.35; p.re -= 0.55; } }
  return p;
}
function botPose(b, dt, t){
  const f = b.fig; let tp, k = 10;
  if (b.gl) tp = PZ({ laz: 2.75, raz: -2.75, le: -0.35, re: -0.35, lax: -0.15, rax: -0.15, llx: 0.25 + Math.sin(t * 3) * 0.12, rlx: -0.15 - Math.sin(t * 3) * 0.12, lk: 0.5, rk: 0.25, sp: -0.05 });
  else if (b.roll){ const q = b.roll.t / 0.42; tp = PZ({ hrx: ease(Math.min(1, q)) * TAU, hy: 0.86 - Math.sin(Math.min(1, q) * Math.PI) * 0.45, llx: -2.2, rlx: -2.2, lk: 2.4, rk: 2.4, lax: -1.4, rax: -1.4, le: -1.4, re: -1.4, sp: 0.6, hd: 0.5 }); k = 30; }
  else if (b.skill){ const q = b.skill.t / b.skill.dur; tp = b.job === 'mage' ? PZ({ lax: -2.8, rax: -2.8, le: -0.2, re: -0.2, sp: -0.25, hd: -0.35, hy: 0.86 - q * 0.05 }) : b.job === 'archer' ? PZ({ lax: -2.2, laz: 0.1, rax: -2.0, re: -1.6, sp: -0.25, hd: -0.4 }) : PZ({ rax: -1.4, raz: -1.55, lax: -0.2, laz: 1.4, sp: 0.25, hy: 0.74, lk: 0.6, rk: 0.6, llz: 0.3, rlz: -0.3 }); k = 24; }
  else if (b.atk){ tp = atkPose(b); k = 28; }
  else if (b.loot > 0){ const q = Math.sin(t * 6 + b.ph); tp = PZ({ hy: 0.62, sp: 0.7, hd: 0.3, lk: 1.1, rk: 0.9, llx: -0.9, rlx: -0.5, rax: -1.1 + q * 0.2, re: -0.4, lax: -0.6, le: -0.5 }); k = 12; }
  else if (b.mv > 0.2){ b.gph = (b.gph || 0) + dt * (b.mv > 6 ? 13.5 : 9.2) * Math.min(1.4, 0.45 + b.mv / 5.5); tp = f.gait(b.gph, Math.min(1, b.mv / 4.6), b.mv > 6, t); k = 16; }
  else if (b.emote){ tp = emoPose(b.emote.id, b.emote.t, idlePose(b, t)); }
  else if (b.act === 'fish' && b.st === 'at'){ const j = b.catchT > 0 ? Math.sin(Math.min(1, b.catchT / 0.6) * Math.PI) : 0; tp = PZ({ rax: -0.55 - j * 1.4, raz: -0.08, re: -0.95, lax: -0.55, laz: 0.25, le: -1.05, sp: 0.05 - j * 0.15, hd: 0.15 - j * 0.3, hy: 0.86 }); }
  else if ((b.act === 'rest' || (b.act === 'afk' && b.sit)) && b.st === 'at'){ tp = emoPose('sit', t + b.ph, null); if (b.act === 'rest'){ const w = Math.max(0, Math.sin(t * 0.4 + b.ph)); tp.lax -= w * 0.4; tp.rax -= w * 0.4; tp.le += w * 0.3; tp.re += w * 0.3; } else tp.hd = 0.5; }
  else if (b.act === 'afk' && b.st === 'at'){ tp = idlePose(b, t); tp.hd = 0.42; tp.sp = 0.1; tp.hdy = 0; }
  else if (b.talk > 0){ tp = idlePose(b, t); const g = Math.sin(t * 5 + b.ph); tp.rax = -0.5 + g * 0.25; tp.re = -1.1; tp.raz = -0.25; tp.hd = Math.sin(t * 3) * 0.05; tp.hdy = 0; }
  else tp = idlePose(b, t);
  if (b.hurt > 0){ tp.sp -= 0.22; tp.hd -= 0.25; tp.lax += 0.3; tp.rax += 0.3; }
  f.set(tp); f.blend(dt, k);
}

// ── 봇 이펙트: 검기 · 화살 · 마탄 (필드 월드 · 절대 좌표) ──
function arcG(r0, r1, span, seg = 20){
  const P2 = [], C = [], a0 = -span / 2;
  for (let i = 0; i < seg; i++){ const a = a0 + i / seg * span, b2 = a0 + (i + 1) / seg * span, k0 = i / seg, k1 = (i + 1) / seg;
    const p = (r, a) => [Math.sin(a) * r, 0, Math.cos(a) * r];
    const v = [p(r0, a), p(r1, a), p(r1, b2), p(r0, a), p(r1, b2), p(r0, b2)], kk = [k0 * 0.4, k0, k1, k0 * 0.4, k1, k1 * 0.4];
    v.forEach((q, j) => { P2.push(...q); C.push(kk[j], kk[j], kk[j]); }); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); return g;
}
const ARC_G = arcG(0.5, 2.1, 2.4), ARC_FULL = arcG(0.6, 3.0, TAU * 0.98, 40);
const TRAILS = [], SHOTS = [];
function swingFx(b, full){
  let o = TRAILS.find(t => !t.on);
  if (!o){ if (TRAILS.length > 10) return; const m = new THREE.Mesh(ARC_G, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); m.frustumCulled = false; FW.add(m); o = { m }; TRAILS.push(o); }
  o.on = true; o.t = 0; o.m.visible = true; o.m.geometry = full ? ARC_FULL : ARC_G; o.m.material.color.set(b.av ? b.av.color : 0x9ff6ff);
  o.m.position.set(b.x, b.y + (full ? 0.7 : 1.05), b.z); o.m.rotation.set(0, b.ry, 0); o.m.rotateZ(full ? 0 : (b.atk && b.atk.i === 1 ? -0.5 : 0.4)); o.life = full ? 0.35 : 0.2;
}
const ARROW_G = once('arrow', () => merge([TM(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4), 0, 0, 0, Math.PI / 2, 0, 0), TM(new THREE.ConeGeometry(0.05, 0.16, 5), 0, 0, 0.45, Math.PI / 2, 0, 0)]));
function shotFx(b, e, kind, onHit){
  let o = SHOTS.find(s => !s.on && s.kind === kind);
  if (!o){ if (SHOTS.length > 16) return onHit(); const g = new THREE.Group(); if (kind === 'arrow') mesh(ARROW_G, new THREE.MeshBasicMaterial({ color: 0xeaffd8, toneMapped: false }), g, false); const gl = X.glowSprite(0xffffff, kind === 'orb' ? 1.1 : 0.6, 0.85); g.add(gl); FW.add(g); o = { g, gl, kind }; SHOTS.push(o); }
  const col = b.av ? b.av.color : 0xffffff; o.gl.material.color.set(col); o.on = true; o.t = 0; o.g.visible = true;
  o.from = new V3(b.x + Math.sin(b.ry) * 0.5, b.y + 1.35, b.z + Math.cos(b.ry) * 0.5); o.e = e; o.T = Math.max(0.12, Math.hypot(e.pos.x - b.x, e.pos.z - b.z) / (kind === 'orb' ? 22 : 34)); o.onHit = onHit; o.col = col;
}
const _to = new V3();
function updBotFx(dt){
  for (const o of TRAILS){ if (!o.on) continue; o.t += dt; const k = o.t / o.life; o.m.material.opacity = Math.max(0, 1 - k); o.m.scale.setScalar(0.9 + k * 0.3); if (k >= 1){ o.on = false; o.m.visible = false; } }
  for (const o of SHOTS){ if (!o.on) continue; o.t += dt; const e = o.e, k = Math.min(1, o.t / o.T);
    _to.set(e.pos.x, F.H(e.pos.x, e.pos.z) + e.pos.y + (e.cfg.top || 1) * 0.45, e.pos.z);
    o.g.position.lerpVectors(o.from, _to, k); o.g.position.y += Math.sin(k * Math.PI) * (o.kind === 'arrow' ? 0.3 : 0.6); o.g.lookAt(_to);
    if (o.kind === 'orb' && R() < dt * 40) X.emit(o.g.position.x, o.g.position.y, o.g.position.z, 0, 0, 0, o.col, 0.16, 0.25);
    if (k >= 1){ o.on = false; o.g.visible = false; o.onHit(); } }
}

// ── 봇 전투: 봇은 몬스터만 때리고, 몬스터는 플레이어만 노려요 ──
function botHit(b, e, mul = 1){
  if (!e || e.state === 'dying' || e.state === 'spawn' || !X.ENEMIES.includes(e)) return;
  const lvk = clamp(1 + (b.lv - (e.lv || b.lv)) * 0.06, 0.6, 1.5), crit = R() < 0.15;
  let dmg = e.max * (e.fboss ? 0.0045 : e.boss ? 0.012 : rr(0.035, 0.055)) * mul * lvk * (crit ? 1.7 : 1);
  const dx = e.pos.x - b.x, dz = e.pos.z - b.z, dd = Math.hypot(dx, dz) || 1, d = dP(e.pos.x, e.pos.z);
  e._bot = b; e._botT = T;
  if (e.aggro){ X.hitEnemy(e, dmg, dx / dd, dz / dd, 1.5, crit); return; }   // 플레이어와 싸우는 중이면 파티 지원 (막타 보상은 플레이어에게)
  if (e.fboss || e.boss){ const floor = e.max * 0.35; dmg = Math.min(dmg, Math.max(0, e.hp - floor)); if (dmg <= 0) dmg = 0; }
  e.hp -= dmg; e.flash = 1; if (!e.boss){ e.pos.x += dx / dd * 0.12; e.pos.z += dz / dd * 0.12; }
  if (d < 32){ X.dmgNum(new V3(e.pos.x + rr(-0.3, 0.3), (e.cfg.top || 1) + 0.2 + (e.fly ? e.pos.y - e.fly : 0), e.pos.z), Math.round(dmg) + (crit ? '!' : ''), 'bot'); X.burst(new V3(e.pos.x, (e.boss ? (e.cfg.top || 2) * 0.45 : 0.6) + (e.boss ? 0 : e.fly), e.pos.z), crit ? 0xffe08a : 0xffffff, crit ? 9 : 5, 3, 0.14, 0.35, -5, 1); if (d < 9 && R() < 0.2) X.sfx('hit'); }
  if (e.hp <= 0){ X.killEnemy(e, true); if (d < 60){ X.burst(new V3(e.pos.x, 0.6 + e.fly, e.pos.z), 0xfff3a0, 16, 3.5, 0.22, 0.9, -2, 2.5); X.burst(new V3(e.pos.x, 0.5 + e.fly, e.pos.z), 0x8aff7a, 10, 3, 0.3, 0.9, -4, 2); if (d < 22) X.sfx('pop'); }
    b.kills = (b.kills || 0) + 1; b.loot = rr(2, 4.5); b.tgt = null; if (R() < 0.25) later(0.4, () => botEmote(b, pick(['cheer', 'point', 'clap']))); }
}
function targetsFor(b){
  if (b.act === 'boss') return FB.e && live(FB.e) ? [FB.e] : [];
  if (b.act === 'party'){ const L = []; for (const e of X.ENEMIES) if (e.aggro && e.state !== 'dying' && e.state !== 'spawn' && !e.under && dP(e.pos.x, e.pos.z) < 20) L.push(e); return L; }
  const L = []; for (const e of X.ENEMIES) if (e.camp === b.camp && e.state !== 'dying' && e.state !== 'spawn' && !e.under) L.push(e); return L;
}
function pickTarget(b){
  const L = targetsFor(b); if (!L.length) return null;
  let best = null, bs = 1e9; for (const e of L){ if (!e.boss && !e.aggro && dP(e.pos.x, e.pos.z) < 14) continue; const n = BOTS.reduce((s, o) => s + (o.tgt === e ? 1 : 0), 0); const s = Math.hypot(e.pos.x - b.x, e.pos.z - b.z) + n * 9 + (e.aggro ? 6 : 0); if (s < bs && (n < 2 || e.boss)){ bs = s; best = e; } }
  if (best) b.slotA = Math.atan2(b.x - best.pos.x, b.z - best.pos.z) + rr(-0.7, 0.7);
  return best;
}
function fight(b, dt, detail){
  if (!detail){ b.mv = 0; return; }
  b.retT = (b.retT || 0) - dt;
  if (b.loot > 0){ b.loot -= dt; b.mv = 0; return; }   // 전리품 줍는 중
  if (b.tgt && (b.tgt.state === 'dying' || !X.ENEMIES.includes(b.tgt))) b.tgt = null;
  if (!b.tgt && b.retT <= 0){ b.tgt = pickTarget(b); b.retT = 0.6; }
  const e = b.tgt;
  if (!e){ // 사냥감 기다리기: 캠프 안을 어슬렁
    b.atk = b.skill = b.roll = null;
    b.subT -= dt; if (b.subT <= 0 || !b.wp){ b.subT = rr(3, 7); const a = R() * TAU, r = rr(2, 9); b.wp = [b.tx + Math.cos(a) * r, b.tz + Math.sin(a) * r]; }
    if (!b.atk) moveTo(b, b.wp[0], b.wp[1], dt, 2.6); return;
  }
  const rad = e.cfg.rad * (e.fboss ? 1.25 : 1), rng = (b.ranged ? 7.5 : 1.25) + rad, tx = e.pos.x + Math.sin(b.slotA) * rng, tz = e.pos.z + Math.cos(b.slotA) * rng;
  const dd = Math.hypot(tx - b.x, tz - b.z), fa = Math.atan2(e.pos.x - b.x, e.pos.z - b.z);
  b.atkCd -= dt; b.skillCd -= dt;
  if (b.roll){ b.roll.t += dt; const q = b.roll.t / 0.42; b.x += Math.sin(b.roll.dir) * 11 * (1 - q * 0.6) * dt; b.z += Math.cos(b.roll.dir) * 11 * (1 - q * 0.6) * dt; if (q >= 1) b.roll = null; b.mv = 0; return; }
  if (b.skill){ updSkill(b, e, dt); b.mv = 0; return; }
  if (dd > 0.6 && !b.atk){ moveTo(b, tx, tz, dt, dd > 4 ? runSp(b) : 3.5); return; }
  b.mv = 0; b.want = fa;
  if (!b.atk && b.atkCd <= 0){
    if (b.skillCd <= 0 && Math.hypot(e.pos.x - b.x, e.pos.z - b.z) < rng + 1.5){ startSkill(b, e); return; }
    if (R() < 0.04){ b.roll = { t: 0, dir: fa + (R() < 0.5 ? 1.6 : -1.6) }; b.slotA += rr(-0.8, 0.8); return; }
    b.atk = { i: b.combo, t: 0, dur: b.job === 'rogue' ? 0.34 : b.ranged ? 0.55 : 0.46, hit: false }; b.combo = (b.combo + 1) % 3; b.atkCd = b.combo === 0 ? rr(0.8, 1.6) : rr(0.05, 0.25);
  }
  if (b.atk){ const a = b.atk; a.t += dt; const k = a.t / a.dur;
    if (!a.hit && k >= (a.i === 2 && !b.ranged ? 0.35 : 0.42)){ a.hit = true;
      if (b.job === 'archer') shotFx(b, e, 'arrow', () => botHit(b, e, 0.9));
      else if (b.job === 'mage') shotFx(b, e, 'orb', () => { botHit(b, e, 1.0); if (b.d < 50) X.burst(new V3(e.pos.x, 0.8 + e.fly, e.pos.z), b.av ? b.av.color : 0xff8a4a, 8, 2.5, 0.2, 0.4, -2, 1); });
      else { if (b.vis) swingFx(b, false); botHit(b, e, a.i === 2 ? 1.5 : 1); } }
    if (!b.ranged && a.i === 2) b.ry = fa + ease(Math.min(1, k * 1.15)) * TAU;
    if (a.t >= a.dur) b.atk = null; }
}
function startSkill(b, e){ b.skill = { t: 0, dur: b.job === 'mage' ? 0.9 : 0.7, fired: false, e }; b.skillCd = rr(10, 16); b.atk = null; }
function updSkill(b, e, dt){
  const s = b.skill; s.t += dt; const k = s.t / s.dur;
  if (!b.ranged && b.job !== 'rogue') b.ry += dt * 18;
  if (!s.fired && k > 0.5){ s.fired = true; const col = b.av ? b.av.color : 0x9ff6ff, ex = e.pos.x, ez = e.pos.z;
    if (b.job === 'mage'){ if (b.d < 70){ X.shockwave(ex, 0.15, ez, 3.4, col, 0.6); X.burst(new V3(ex, 0.8, ez), col, 30, 6, 0.3, 0.7, -3, 2); } for (const o of targetsFor(b)) if (Math.hypot(o.pos.x - ex, o.pos.z - ez) < 3.4) botHit(b, o, 1.3); }
    else if (b.job === 'archer'){ for (let i = 0; i < 3; i++) later(i * 0.08, () => shotFx(b, e, 'arrow', () => botHit(b, e, 0.8))); }
    else if (b.job === 'rogue'){ const a = Math.atan2(b.x - ex, b.z - ez) + Math.PI; if (b.d < 70) X.burst(new V3(b.x, 1, b.z), 0x6a2aaa, 18, 2.5, 0.3, 0.6, 1, 1); b.x = ex + Math.sin(a) * 1.4; b.z = ez + Math.cos(a) * 1.4; b.ry = a + Math.PI; botHit(b, e, 2.0); if (b.d < 70) X.burst(new V3(ex, 1, ez), 0xd08aff, 14, 3, 0.2, 0.5, -2, 1); }
    else { if (b.vis) swingFx(b, true); if (b.d < 70) X.shockwave(b.x, 0.12, b.z, 3.2, col, 0.45); for (const o of targetsFor(b)) if (Math.hypot(o.pos.x - b.x, o.pos.z - b.z) < 3.4) botHit(b, o, 1.2); } }
  if (k >= 1) b.skill = null;
}
// 봇 감정표현 · 반응
function botEmote(b, id, dur){ if (!b || b.busy() || b.mv > 0.5) return; const em = EMO_BY[id]; b.emote = { id, t: 0, dur: dur || Math.min(em.dur, 4) }; if (b.vis && b.d < 34){ bubble(b.root, em.icon, 2.2, 'emo', 2.95); if (b.d < 40) emoFx(id, b.x, b.y, b.z); } }
function botReact(b, id){
  if (!b || b.busy()) return; b.want = Math.atan2(P.x - b.x, P.z - b.z); b.faceP = 2.5;
  const map = { wave: ['wave', '안녕하세요~', 'ㅎㅇㅎㅇ', '반가워요!'], bow: ['bow', '안녕하세요!', '반갑습니다 :)'], dance: ['dance', '춤 배틀 ㄱㄱ', '같이 춰요~', 'ㅋㅋㅋㅋ 신난다'], cheer: ['cheer', '와아아!', '오예!'],
    clap: ['clap', '짝짝짝', '👍'], sit: ['sit', '쉬었다 가요~', '다리 아프다 ㅠ'], think: ['think', '?', '뭐 고민 있어요?'], point: ['point', '어디요??', '엥 저요?'] };
  const m = map[id] || map.wave; botEmote(b, R() < 0.8 ? m[0] : 'wave', id === 'dance' ? 6 : id === 'sit' ? 8 : 0);
  if (R() < 0.55) later(rr(0.3, 1.0), () => botSay(b, pick(m.slice(1)), 'local'));
}
// 봇 말하기: 근처면 말풍선 + [근처], 아니면 월드 채팅
function botSay(b, text, kind = 'world'){
  if (!b || !text) return;
  if (kind === 'local'){ if (b.vis && b.d < 34){ bubble(b.root, text, 4.2); if (b.d < 28) chatLine(b.name, text, 'local'); b.talk = 3; } return; }
  chatLine(b.name, text, kind); if (b.vis && b.d < 30) bubble(b.root, text, 4.2);
}

// ── 봇 활동 갱신 ──
function updBot(b, dt, detail, t){
  b.mv = 0; b.hurt = Math.max(0, (b.hurt || 0) - dt); b.talk = Math.max(0, (b.talk || 0) - dt); b.faceP = Math.max(0, (b.faceP || 0) - dt);
  if (b.emote){ b.emote.t += dt; if (b.emote.t > b.emote.dur) b.emote = null; }
  b.actT -= dt;
  const at = b.st === 'at';
  if (b.st === 'go'){
    if (b.act === 'boss' && FB.e && live(FB.e) && Math.hypot(FB.e.pos.x - b.x, FB.e.pos.z - b.z) < 30){ b.st = 'at'; b.path = null; }
    else if (stepPath(b, dt, b.act === 'village' && Math.hypot(b.tx - b.x, b.tz - b.z) < 25 ? 3.2 : runSp(b))){ b.st = 'at'; b.subT = rr(1, 4); if (b.act === 'afk'){ b.afk = true; b.sit = R() < 0.5; refreshLabel(b); } }
    if (b.act === 'boss' && !FB.cur){ b.actT = 0; }
  }
  else if (b.act === 'hunt' || b.act === 'boss'){
    if (b.act === 'boss' && !FB.cur){ b.actT = 0; }
    fight(b, dt, detail);
  }
  else if (b.act === 'village'){
    b.subT -= dt;
    if (b.sub === 'walk'){ if (moveTo(b, b.wp[0], b.wp[1], dt, 2.2)) { b.sub = null; b.subT = rr(3, 8); } }
    else if (b.subT <= 0){ b.subT = rr(4, 11); const r = R();
      if (r < 0.28){ b.wp = villageSpot(b); if (Math.hypot(b.wp[0] - b.x, b.wp[1] - b.z) < 30) b.sub = 'walk'; }
      else if (r < 0.48 && detail) botEmote(b, pick(['wave', 'dance', 'cheer', 'clap', 'think', 'bow', 'sit', 'point']), rr(2, 6));
      else if (r < 0.72){ const o = BOTS.find(o => o !== b && o.act === 'village' && o.st === 'at' && !o.sub && Math.hypot(o.x - b.x, o.z - b.z) < 9); if (o){ b.want = Math.atan2(o.x - b.x, o.z - b.z); o.want = Math.atan2(b.x - o.x, b.z - o.z); b.faceP = o.faceP = 0; b.talk = o.talk = 5; o.subT = Math.max(o.subT, 6); if (detail && b.d < 30 && R() < 0.6) convo(b, o); } }
      else b.want += rr(-1.2, 1.2); }
    // 지나가는 모험가에게 인사
    if (detail && b.d < 4.5 && !b.greet && X.player.speed > 0.5 && R() < 0.12){ b.greet = true; b.want = Math.atan2(P.x - b.x, P.z - b.z); b.faceP = 2; botEmote(b, 'wave'); later(0.4, () => botSay(b, pick(['안녕하세요~', '좋은 사냥 되세요!', 'ㅎㅇ', '오 장비 멋지다']), 'local')); }
    if (b.d > 12) b.greet = false;
  }
  else if (b.act === 'rest'){ if (b.fire) b.want = Math.atan2(b.fire.x - b.x, b.fire.z - b.z); b.subT -= dt; if (b.subT <= 0){ b.subT = rr(8, 18); if (detail && b.d < 30 && R() < 0.4) botSay(b, pick(CHAT.camp)(), 'local'); } }
  else if (b.act === 'fish'){ if (b.fish) b.want = b.fish.ry; b.catchT = Math.max(0, (b.catchT || 0) - dt); b.subT -= dt;
    if (b.subT <= 0){ b.subT = rr(10, 26); b.catchT = 0.6; if (detail && b.d < 60){ const bx = b.x + Math.sin(b.ry) * 4, bz = b.z + Math.cos(b.ry) * 4, wy = F.waterY ? F.waterY(bx, bz) : W.water; for (let i = 0; i < 14; i++) X.emit(bx, wy + 0.1, bz, rr(-1.5, 1.5), rr(1.5, 3.5), rr(-1.5, 1.5), 0xcff4ff, 0.12, 0.6, { grav: -9 });
        if (b.d < 30 && R() < 0.5) later(0.6, () => botSay(b, pick(['잡았다!', '월척이다!!', '에이 피라미네', '오 은빛 송어!', '장화 낚음 ㅋㅋ']), 'local')); } } }
  else if (b.act === 'sight'){ b.subT -= dt; if (b.subT <= 0){ b.subT = rr(5, 9); if (detail) botEmote(b, pick(['point', 'think', 'cheer', 'wave'])); if (detail && b.d < 30 && R() < 0.4) botSay(b, pick(['와 경치 미쳤다', '여기 스샷 각', `${b.sight ? b.sight.name : '여기'} 처음 와 봄`, '오오오']), 'local'); } }
  else if (b.act === 'glide') updGlide(b, dt, detail);
  else if (b.act === 'party') updParty(b, dt, detail);
  if (b.actT <= 0 && !b.atk && !b.skill && !b.roll && !b.gl && b.act !== 'party') nextAct(b);
  // 방향 · 높이
  if (b.faceP > 0 && b.mv < 0.2 && !b.atk && !b.gl) b.want = Math.atan2(P.x - b.x, P.z - b.z);
  if (!(b.atk && !b.ranged && b.atk.i === 2) && !b.skill) b.ry += angDiff(b.want, b.ry) * Math.min(1, dt * 9);
  if (!b.gl) b.y = gnd(b.x, b.z);
}
function updGlide(b, dt, detail){
  const [hx, hz] = HAWK.c, ex = hx + Math.cos(HAWK.dir) * (HAWK.r - 1.5);
  if (!b.gl && b.sub !== 'edge'){ b.sub = 'edge'; b.wp = [ex, b.z]; }
  if (!b.gl){ if (moveTo(b, b.wp[0], b.wp[1], dt, 6)){ // 뛰어내려요!
      b.gl = { vx: Math.cos(HAWK.dir + rr(-0.35, 0.35)), vz: Math.sin(HAWK.dir + rr(-0.35, 0.35)), t: 0 }; b.want = Math.atan2(b.gl.vx, b.gl.vz); if (b.glider) b.glider.visible = true;
      if (detail && b.d < 40 && R() < 0.5) botSay(b, pick(['날아라~!', '야호오오', '글라이더 최고!', '간다아아']), 'local'); } return; }
  const g = b.gl; g.t += dt;
  if (!detail){ b.x += g.vx * 40; b.z += g.vz * 40; b.y = gnd(b.x, b.z); }
  else { b.x += g.vx * 8.5 * dt; b.z += g.vz * 8.5 * dt; b.y -= (g.t < 0.5 ? -1.5 : 1.35) * dt; b.ry = b.want; }
  const gy = gnd(b.x, b.z);
  if (!detail || b.y <= gy + 0.05 || g.t > 22){ b.y = gy; b.gl = null; if (b.glider) b.glider.visible = false; b.actT = 0; b.sub = null; }
}
// ── 임시 파티: 근처 봇이 같이 사냥하자고 해요 ──
let PARTY = null, OFFER = null, partyT = rr(70, 130);
const partyEl = X.mk('div', 'lparty', '<span class="ic">⚔</span><b></b><i><s></s></i><button title="파티 나가기">✕</button>', X.hud);
const offerEl = X.mk('div', 'loffer', '<b>⚔ 파티 초대</b><span></span><div><button class="y">수락</button><button class="n">거절</button></div><i><s></s></i>', X.hud);
offerEl.querySelector('.y').onclick = e => { e.stopPropagation(); answerOffer(true); };
offerEl.querySelector('.n').onclick = e => { e.stopPropagation(); answerOffer(false); };
partyEl.querySelector('button').onclick = e => { e.stopPropagation(); endParty('leave'); };
const PARTY_TALK = ['물약 넉넉해요?', '오 방금 크리 터졌다', '레벨 몇이세요?', '이 근처 경험치 좋네요', '조금만 더 하고 쉬어요~', '앞장서세요! 따라갈게요', '저 이 동네 처음이에요 ㅎㅎ', '버프 받으세요~ (없음)', '보스 뜨면 같이 가요!'];
function offerParty(gap = 5){
  const L = BOTS.filter(b => b.vis && b.d < 22 && Math.abs(b.lv - S.lv) <= gap && !b.busy() && !b.afk && ['hunt', 'village', 'rest', 'sight'].includes(b.act) && b.st === 'at');
  if (!L.length) return false;
  const b = L.sort((a, c) => a.d - c.d)[0];
  b.want = Math.atan2(P.x - b.x, P.z - b.z); b.faceP = 4; botEmote(b, 'wave');
  later(0.4, () => botSay(b, pick(['혹시 같이 사냥하실래요? 🙂', '파티 하실래요? 혼자 하기 심심해서요', '같이 다녀요! 제가 도와드릴게요']), 'local'));
  OFFER = { b, until: T + 12 };
  offerEl.querySelector('span').innerHTML = `「<b style="font:800 12px 'Noto Sans KR';color:#bfe9ff">${esc(b.name)}</b>」 Lv.${b.lv} ${esc(b.job ? X.JOBS[b.job].n : '모험가')} 님이 같이 사냥하자고 해요`;
  offerEl.classList.add('on'); X.sfx('ui'); return true;
}
function answerOffer(yes){
  if (!OFFER) return; const b = OFFER.b; OFFER = null; offerEl.classList.remove('on');
  if (!yes){ later(0.6, () => botSay(b, pick(['아 넵! 좋은 사냥 되세요~', '넹 다음에 같이 해요!', 'ㅎㅎ 수고하세요']), 'local')); partyT = rr(200, 320); return; }
  PARTY = { b, until: T + rr(200, 320), talkT: rr(15, 25), warpT: 0 };
  b.act = 'party'; b.st = 'at'; b.path = null; b.tgt = null; b.actT = 1e9; b.afk = false; b.floater = true; b.camp = null;
  if (b.label) b.label.el.classList.add('pt');
  partyEl.querySelector('b').innerHTML = `<em>Lv.${b.lv}</em>${esc(b.name)}`; partyEl.classList.add('on');
  sysLine(`<i>[파티]</i> 「${esc(b.name)}」 님이 파티에 들어왔다!`); X.sfx('level');
  later(0.8, () => { botEmote(b, 'cheer'); botSay(b, pick(['잘 부탁드려요!', '가즈아~', '좋아요! 출발!']), 'party'); });
  BUS.emit('party', { state: 'join', name: b.name, lv: b.lv });
}
function endParty(why){
  if (!PARTY) return; const b = PARTY.b; PARTY = null; partyEl.classList.remove('on'); partyT = rr(240, 420);
  if (b.label) b.label.el.classList.remove('pt');
  if (why === 'time'){ botEmote(b, 'wave'); botSay(b, pick(['오늘 즐거웠어요! 다음에 또 같이 해요 👋', '저 이제 가 볼게요~ 수고하셨어요!', '덕분에 렙업 많이 했어요 감사합니다!']), 'party'); }
  else if (why === 'leave') later(0.5, () => botSay(b, pick(['수고하셨어요~', '넵 다음에 봬요!', '즐거웠어요 :)']), 'party'));
  if (why !== 'quiet') sysLine(`<i>[파티]</i> 「${esc(b.name)}」 님이 파티를 떠났다.`);
  b.actT = 0; b.act = null; nextAct(b);
  BUS.emit('party', { state: 'leave', name: b.name });
}
function updParty(b, dt, detail){
  const p = PARTY; if (!p || p.b !== b){ b.actT = 0; b.act = null; return; }
  if (b.d > 70){ p.warpT += dt; if (p.warpT > 2.5){ p.warpT = 0; const a = X.fig.root.rotation.y + Math.PI + rr(-0.6, 0.6); b.x = P.x + Math.sin(a) * 4; b.z = P.z + Math.cos(a) * 4; b.y = gnd(b.x, b.z); b.tgt = null; b.atk = b.skill = b.roll = null;
      later(0.3, () => { if (b.vis) X.emit(b.x, b.y + 1, b.z, 0, 1, 0, 0x7ff3ff, 0.5, 0.6, { grow: 2 }); botSay(b, pick(['저도 왔어요!', '룬 비석 타고 따라옴 ㅎㅎ', '같이 가요~']), 'party'); }); } return; }
  p.warpT = 0;
  if (!detail) return;
  const tg = targetsFor(b);
  if (tg.length || b.tgt || b.atk || b.skill || b.roll || b.loot > 0){ b.camp = null; fight(b, dt, true); return; }
  // 따라다니기: 플레이어 뒤쪽 오른편
  const yaw = X.fig.root.rotation.y, ox = P.x + Math.sin(yaw + 2.5) * 3.0, oz = P.z + Math.cos(yaw + 2.5) * 3.0, dd = Math.hypot(ox - b.x, oz - b.z);
  if (dd > 1.2) moveTo(b, ox, oz, dt, dd > 7 ? Math.max(runSp(b), X.player.speed * 1.1) : dd > 3 ? 5 : 2.4);
  else if (X.player.speed < 0.4) b.want = Math.atan2(P.x - b.x, P.z - b.z);
  p.talkT -= dt; if (p.talkT <= 0){ p.talkT = rr(25, 45); const lowHp = X.hp < X.D().maxHp * 0.35; botSay(b, lowHp ? '체력 낮아요! 물약 드세요!!' : pick(PARTY_TALK), 'party'); }
  if (T > p.until && !tg.length) endParty('time');
}
function partyTick(dt){
  if (OFFER){ const k = (OFFER.until - T) / 12; offerEl.querySelector('i s').style.width = Math.max(0, k * 100) + '%'; if (T > OFFER.until || OFFER.b.d > 40) answerOffer(false); }
  if (PARTY){ const s2 = partyEl.querySelector('i s'); s2.style.width = (PARTY.b.hurt > 0 ? 82 + R() * 8 : 100) + '%'; return; }
  partyT -= dt; if (partyT > 0 || OFFER) return;
  const reg = F.regionAt(P.x, P.z); if (!reg || reg.safe || FB.bar || X.dialogOpen || X.dead){ partyT = 15; return; }
  if (!offerParty()) partyT = rr(20, 40);
}
// 봇끼리 수다 (근처일 때만)
const CONVO = [[['오늘 뭐 잡으러 가요?', '멧돼지요! 가죽 모아야 해서'], ['저도 같이 가도 돼요?', '당연하죠 ㄱㄱ']], [['그 날개 어디서 샀어요?', '재봉사 루나한테요! 비싸요 ㅠ'], ['예쁘다…', '고마워요 ㅎㅎ']],
  [['레이드 가실래요?', '저 아직 렙이 낮아서…'], ['괜찮아요 버스 태워 드림', '오 감사합니다!!']], [['강화 성공함?', '+7에서 터짐 ㅋㅋ…'], ['ㅠㅠ 힘내요', '내일 다시 도전한다']],
  [['필보 언제 떠요?', '곧 뜰 듯? 채팅 잘 봐요'], ['알림 오면 같이 가요', 'ㅇㅋㅇㅋ']], [['배고프다', '여관에서 수프 먹어요 ㅋㅋ'], ['게임 속 수프로 배가 차나', 'ㅋㅋㅋㅋ']]];
function convo(a, b){ const c = pick(CONVO); let dl = 0; for (const [q, r] of c){ later(dl, () => botSay(a, q, 'local')); later(dl + rr(1.6, 2.4), () => botSay(b, r, 'local')); dl += rr(4, 5.5); } }

// ── 모닥불 (봇 야영지 · 절대 좌표) ──
const FIRE_MAT = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
const FIRES3D = [];
function buildFire(x, z){
  const y = F.H(x, z), g = new THREE.Group(); g.position.set(x, y, z);
  mesh(once('fireStones', () => merge(Array.from({ length: 9 }, (_, i) => TM(new THREE.DodecahedronGeometry(0.17, 0), Math.cos(i / 9 * TAU) * 0.62, 0.08, Math.sin(i / 9 * TAU) * 0.62, i, i, 0, 1, 0.7, 1)))), sm(0x8a8a86, { flatShading: true, roughness: 0.95 }), g);
  mesh(once('fireLogs', () => merge([0, 1, 2].map(i => TM(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 6), 0, 0.2, 0, 0.0, i * 2.1, 1.25)).concat([TM(new THREE.CylinderGeometry(0.22, 0.22, 2.2, 8), 0, 0.22, -2.1, 0, 0, Math.PI / 2), TM(new THREE.CylinderGeometry(0.22, 0.22, 2.0, 8), 1.9, 0.22, 0.9, 0, 1.1, Math.PI / 2)]))), M_WOOD, g);
  mesh(once('bedroll', () => merge([TM(new THREE.CylinderGeometry(0.25, 0.25, 1.7, 8), -1.9, 0.2, 1.0, 0, -0.6, Math.PI / 2), TM(new THREE.BoxGeometry(1.0, 0.08, 1.9), -2.3, 0.04, -0.6, 0, 0.5, 0)])), sm(0x3a6aa8, { roughness: 0.9 }), g);
  const fl = new THREE.Group(); fl.position.y = 0.25; g.add(fl);
  for (let i = 0; i < 2; i++){ const m = mesh(once('flame', () => TM(new THREE.ConeGeometry(0.3, 0.9, 6, 1, true), 0, 0.45, 0)), FIRE_MAT, fl, false); m.rotation.y = i * 0.8; m.scale.setScalar(i ? 0.7 : 1); }
  const gl = X.glowSprite(0xff9a3a, 3.4, 0.55); gl.position.y = 0.8; g.add(gl);
  FW.add(g); const o = { g, fl, gl, x, z, y }; FIRES3D.push(o); return o;
}
function prepFires(){
  const anchors = ['wp_windmill', 'wp_moon', 'wp_swamp', 'wp_canyon', 'wp_plateau', 'wp_blight', 'wp_frost', 'wp_basin', 'wp_lake'].map(id => F.byId('waypoints', id)).filter(Boolean).map(w => w.c).concat([[-176, 300], [300, -40], [-330, -470]]);
  for (const [ax, az] of anchors){
    for (let t = 0; t < 40; t++){ const a = R() * TAU, r = rr(11, 24), x = ax + Math.cos(a) * r, z = az + Math.sin(a) * r;
      if (F.isWater(x, z) || F.slope(x, z) > 0.22 || (F.roadDist && F.roadDist(x, z) < 6) || (F.landmarkAt && F.landmarkAt(x, z)) || W.camps.some(c => Math.hypot(c.c[0] - x, c.c[1] - z) < c.r + 10)) continue;
      if (W.waypoints.some(w => Math.hypot(w.c[0] - x, w.c[1] - z) < 7) || W.npcs.some(n => Math.hypot(n.c[0] - x, n.c[1] - z) < 6) || fireSpots.some(f => Math.hypot(f.x - x, f.z - z) < 30)) continue;
      buildFire(x, z); addFire(x, z, true); break; }
  }
  if (!hasMod('landmarks')){ buildFire(-264, 226); }
}
function updFires(dt){ const t = G.time; for (const o of FIRES3D){ const d = dP(o.x, o.z), v = d < 160; o.g.visible = v; if (!v) continue;
  o.fl.scale.set(1 + Math.sin(t * 13 + o.x) * 0.08, 1 + Math.sin(t * 9 + o.z) * 0.18, 1 + Math.cos(t * 11) * 0.08); o.fl.rotation.y += dt * 1.5; o.gl.material.opacity = 0.45 + Math.sin(t * 17 + o.x) * 0.08;
  if (d < 45 && R() < dt * 7) X.emit(o.x + rr(-0.2, 0.2), o.y + 0.7, o.z + rr(-0.2, 0.2), rr(-0.2, 0.2), rr(1, 2), rr(-0.2, 0.2), R() < 0.5 ? 0xffc040 : 0xff6a1a, rr(0.06, 0.11), rr(0.6, 1.2), { sway: 0.4 }); } }

// ── 봇 전체 갱신 ──
let farI = 0;
function updBots(dt){
  const t = G.time;
  for (const b of BOTS){ b.d = dP(b.x, b.z); }
  // 먼 봇: 몇 명씩 돌아가며 듬성듬성
  const FAR = 140;
  for (let k = 0; k < 6; k++){ farI = (farI + 1) % BOTS.length; const b = BOTS[farI]; if (b.d >= FAR){ const ddt = Math.min(3, T - (b._lt ?? T)) || dt; b._lt = T; updBot(b, ddt, false, t); if (b.vis) showBot(b, false); } }
  for (const b of BOTS){
    if (b.d >= FAR){ continue; }
    b._lt = T;
    updBot(b, dt, true, t);
    const want = b.d < (LOW ? 70 : 84);
    if (want !== b.vis) showBot(b, want);
    if (!b.vis) continue;
    b.root.position.set(b.x, b.y, b.z); b.root.rotation.y = b.ry;
    if ((b.d < SUBD || !!b.afk) !== !!b._sub) refreshLabel(b);
    botPose(b, dt, t);
    b.fig.mesh.castShadow = b.d < (LOW ? 22 : 36);
    if (b.d < 26) b.av.upd(dt, Math.min(1, b.mv / 6), !!b.gl);
    b.av.setArmed(b.act !== 'village' && b.act !== 'afk' && b.act !== 'rest' && !(b.act === 'fish' && b.st === 'at'));
    if (b.act === 'fish' && b.st === 'at'){ if (!b.rod){ b.rod = handProp(b.fig, mkRod()); b.rod.rotation.x = Math.PI / 2 + 0.35; } b.rod.visible = true; } else if (b.rod) b.rod.visible = false;
  }
}

// ═════════════════════════ 8. 채팅 내용 (봇 수다 · 시스템 소식) ═════════════════════════
const rRaid = () => pick(W.raids || [{ name: '레이드', party: 3, rec: 12 }]);
const rItem = () => { const slot = pick(['hat', 'back', 'body', 'aura', 'wpn']), L = (X.COS[slot] || []).filter(i => i.r >= 2); return L.length ? pick(L) : { n: '빛나는 룬석', r: 2 }; };
const rCampName = () => pick(W.camps).name, rPlace = () => pick(LMK.length ? LMK : [{ name: '은빛 호수' }]).name;
const nextFbText = () => { if (FB.cur) return `${(F.regionById(FB.cur.fb.region) || {}).name || '어딘가'}에 ${FB.cur.fb.name} 떠 있어요!`; const m = Math.max(1, Math.round((FB.next - T) / 60)); return FB.next < Infinity ? `다음 필보 ${m}분쯤 남았대요` : '곧 뜰 거예요 채팅 잘 보세요'; };
const CHAT = {
  party: [() => { const r = rRaid(); return `${r.name} 파티 구해요 (${ri(1, r.party - 1)}/${r.party}) 딜러 구함~`; }, () => { const r = rRaid(); return `${r.name} 가실 분!! 숙련자 우대, 초보도 환영`; },
    () => `${rCampName()}에서 같이 사냥하실 분~ 경험치 2배 꿀`, () => { const r = rRaid(); return `${r.name} 버스 태워 드림 Lv.${r.rec - 2}↑ 귓 주세요`; }, () => '힐러 없나요… 마법사라도 구합니다 ㅠ', () => '레이드 대장 카엘 앞에서 모여요!'],
  trade: [() => '슬라임 젤리 삽니다 개당 5골', () => `${rItem().n} 팝니다 쿨거래 시 할인`, () => '강화석 삽니다 넉넉히 드려요', () => '버섯 포자 50개 팔아요~', () => '꿀단지 교환하실 분?', () => '멧돼지 가죽 대량 구매합니다'],
  joke: [() => '슬라임한테 맞아 죽은 사람 손 ㅋㅋ', () => '말랑대왕 너무 말랑해서 칼이 튕김', () => '버섯돌이 귀엽다고 다가갔다가 포자 맞음…', () => '고슴도치 굴러오는 거 피하다가 절벽 떨어짐 ㅠ',
    () => '방금 글라이더 타다 호수에 빠짐 ㅋㅋㅋ', () => '설인 포효 듣고 키보드 놓쳤다', () => '너구리 도적단한테 골드 털림', () => '꿀벌한테 쏘여서 얼굴 빨개짐 ㅋㅋ'],
  ask: [['필드 보스 언제 나와요?', () => nextFbText()], ['글라이더 어디서 사요?', () => '바람개비 언덕 제피한테서 사요!'], ['하늘 끝 봉우리 어떻게 올라가요?', () => '하늘길 따라 빙빙 돌면 돼요'],
    ['빠른 이동 어떻게 해요?', () => 'M 눌러서 지도에서 룬 비석 클릭!'], ['레이드 입장 어디서 해요?', () => '마을 카엘 게시판이나 입구로 가면 돼요'], ['강화 어디서 해요?', () => '대장장이 도른이요 마을 동쪽!'],
    ['독수리 둥지 바위 꼭대기 어떻게 가요?', () => '바닥에 바람 승강 룬 있어요'], ['물고기 어디서 팔아요?', () => '낚시꾼 노아한테요 호수 남쪽'], ['Lv.10 사냥터 추천 좀요', () => '너구리 소굴이나 달팽이 물가요!']],
  flavor: [() => '은빛 호수 노을 미쳤다 진짜', () => '매의 절벽에서 글라이더 타면 개꿀잼', () => '밤에 요정 버섯 고리 가 보세요 빛나요', () => `${rPlace()} 처음 가 봤는데 분위기 대박`,
    () => '거인의 유해 갈비뼈 밑에서 스샷 찍음', () => '룬 정령 하나 더 찾았다!!', () => '서리 봉우리 너무 추워요 (기분상)', () => '오늘 접속자 많네요 ㅎㅎ'],
  social: [() => '다들 좋은 저녁~', () => 'ㅎㅇㅎㅇ', () => '오늘도 렙업하러 왔습니다', () => '길드원 구해요 〈별빛여단〉 매너 유저 환영', () => '아 잠수 탔었네', () => '퇴근 후 아르카디아가 국룰'],
  camp: [() => '불 따뜻하다~', () => '잠깐 쉬었다 가요', () => '물약 다 떨어졌다 ㅠ', () => '다음엔 어디 가지', () => '모닥불 소리 좋다'],
};
function worldChatter(){
  const kind = wpick([['party', 20], ['trade', 14], ['ask', 15], ['joke', 12], ['flavor', 15], ['social', 10]]);
  if (kind === 'ask'){ const [q, a] = pick(CHAT.ask), b1 = pickBot(), b2 = pickBot(o => o !== b1 && o.lv >= 8); botSay(b1, q, 'world'); if (b2 && R() < 0.85) later(rr(3, 6), () => botSay(b2, a(), 'world')); return; }
  const b = kind === 'party' ? pickBot(o => o.lv >= 10) : pickBot(); botSay(b, pick(CHAT[kind])(), kind === 'party' ? 'party' : kind === 'trade' ? 'trade' : 'world');
}
function sysEvent(){
  const k = wpick([['level', 35], ['raid', 30], ['rare', 35]]);   // 강화 소식은 rpg 가 따로 띄워요
  if (k === 'level'){ const b = pickBot(o => o.lv < 30); if (!b) return; b.lv++; refreshLabel(b); sysLine(`<i>[시스템]</i> 「${esc(b.name)}」 님이 <span class="it">Lv.${b.lv}</span> 달성!`);
    if (b.vis && b.d < 40){ for (let i = 0; i < 20; i++) X.emit(b.x + rr(-0.5, 0.5), b.y + rr(0.2, 2), b.z + rr(-0.5, 0.5), 0, rr(1, 2.5), 0, 0xffe08a, 0.16, 1.0); }
    for (let i = 0; i < ri(1, 3); i++) later(rr(1.5, 5), () => botSay(pickBot(o => o !== b), pick(['ㅊㅊ', '축하해요!', 'ㅊㅋㅊㅋ', `${b.lv}렙 축하드려요~`, '🎉']), 'world')); }
  else if (k === 'raid'){ const r = rRaid(), b = pickBot(o => o.lv >= r.rec - 3) || pickBot(), m = ri(2, 7), s = ri(0, 59); sysLine(`<i>[레이드]</i> 「${esc(b.name)}」 님의 파티가 <span class="it">${esc(r.name)}</span>${jo(r.name, '을', '를')} ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} 만에 처치!`, 'raid'); if (R() < 0.5) later(rr(2, 4), () => botSay(b, pick(['클리어!! 다들 수고 ㅎㅎ', '첫 클리어다 ㅠㅠ 감동', '보상 별로네 ㅋㅋ 한 판 더?']), 'party')); }
  else if (k === 'rare'){ const it = rItem(), b = pickBot(), cls = it.r >= 3 ? 'leg' : 'epi'; sysLine(`<i>[획득]</i> 「${esc(b.name)}」 님이 <span class="${cls}">${it.r >= 3 ? '전설' : '영웅'} · ${esc(it.n)}</span>${jo(it.n, '을', '를')} 획득했다!`, 'rare'); if (R() < 0.6) later(rr(1.5, 4), () => botSay(pickBot(o => o !== b), pick(['와 부럽다…', '대박 ㄷㄷ', '나눔 해 주세요 ㅋㅋ', '운 좋다!']), 'world')); }
}
// 플레이어 채팅 → 봇들이 대답해요
const REPLY = [
  [/안녕|하이|ㅎㅇ|반가|hello|hi\b/i, ['안녕하세요~', 'ㅎㅇㅎㅇ', '반가워요!', '어서 오세요 :)', '하이하이']],
  [/파티|같이|팟|레이드/, ['저 갈래요!', '몇 렙이세요?', '마을 카엘한테 가면 모집할 수 있어요', '저도 끼워 주세요 ㅎㅎ', () => `${rRaid().name} 어때요?`]],
  [/보스|필보|필드보스/, [() => nextFbText(), '필보 뜨면 채팅에 알림 와요!', '보스 같이 잡아요!']],
  [/어디|위치|가는\s*법|길/, ['M 누르면 지도 나와요', '이정표 보고 가면 돼요', '룬 비석으로 빠른 이동 추천!']],
  [/ㅋㅋ|ㅎㅎ|lol/i, ['ㅋㅋㅋㅋ', 'ㅋㅋㅋ', 'ㅎㅎ']],
  [/도와|살려|help|구해/i, ['어디세요? 갈게요!', '물약 꼭 챙기세요!', '구르기(K)로 피해요!']],
  [/글라이더|날개|날/, ['바람개비 언덕 제피!', '매의 절벽에서 뛰어 보세요 ㅋㅋ']],
  [/렙|레벨|lv/i, [b => `저 ${b.lv}렙이에요`, '렙업 화이팅!', '사냥터 표지판에 권장 레벨 있어요']],
  [/강화|대장|무기/, ['도른한테 가요! 마을 동쪽', '강화는 운빨…', '+10 가즈아']],
  [/낚시|물고기/, ['노아 아저씨한테 배워요!', '은빛 호수가 잘 잡혀요']],
  [/고마|감사|ㄳ|땡큐/, ['천만에요~', 'ㅎㅎ 별말씀을', '👍']],
  [/\?$/, ['음.. 잘 모르겠어요 ㅠ', '저도 궁금', '그거 위키에 있을걸요?']],
];
function playerSays(text){
  if (text.startsWith('/')){ const cmd = text.slice(1).trim(); if (F.emote(cmd)) return; sysLine(`<i>[도움말]</i> 감정표현: ${EMOTES.map(e => '/' + e.n.replace(/ /g, '')).join(' ')}`); return; }
  chatLine('나', text, 'me'); F.say(text);
  BUS.emit('chat', { text });
  const rule = REPLY.find(([re]) => re.test(text));
  const n = rule ? (R() < 0.85 ? ri(1, 2) : 0) : (R() < 0.35 ? 1 : 0);
  const pool = BOTS.slice().sort((a, b) => a.d - b.d).slice(0, 8);
  for (let i = 0; i < n; i++){ const b = pick(pool); if (!b) break; const opts = rule ? rule[1] : ['ㅇㅇ', '오호', '그쵸', '맞아요', 'ㅋㅋ', '오…']; const ln = pick(opts); later(rr(1.5, 4) + i * 1.6, () => botSay(b, typeof ln === 'function' ? ln(b) : ln, b.d < 25 ? 'local' : 'world')); }
  // "같이 사냥하실 분?" → 근처 봇이 진짜로 파티 초대를 보내요
  if (rule && rule[0].test('파티') && /파티|같이|팟/.test(text) && !PARTY && !OFFER) later(rr(1.8, 3), () => { if (!PARTY && !OFFER) offerParty(9); });
}

// ═════════════════════════ 9. 작은 동물들 (전투 없음 · 가까운 곳만) ═════════════════════════
const biomeAt = (x, z) => F.biomeAt ? F.biomeAt(x, z) : (F.regionAt(x, z) || {}).biome || 'meadow';
const night = () => F.isNight ? F.isNight() : false;
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(), _p = new V3();
const setI = (im, i, x, y, z, rx, ry, rz, sx, sy, sz) => { _q.setFromEuler(_e.set(rx, ry, rz)); _m4.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)); im.setMatrixAt(i, _m4); };
function spotNear(r0, r1, ok){ for (let t = 0; t < 12; t++){ const a = R() * TAU, r = rr(r0, r1), x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r; if (ok(x, z)) return [x, z]; } return null; }
// 나비
const BFN = LOW ? 12 : 24;
const bfTex = (() => { const c = G.cnv(128, 64), x = c.getContext('2d');
  for (const s of [-1, 1]){ x.save(); x.translate(64, 32); x.scale(s, 1);
    for (const [cx, cy, rx, ry, r] of [[26, -10, 26, 18, -0.3], [20, 14, 16, 12, 0.5]]){ const g = x.createRadialGradient(4, 0, 2, cx, cy, rx * 1.1); g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#e8e8e8'); g.addColorStop(1, '#5a4a40');
      x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, rx, ry, r, 0, TAU); x.fill(); x.strokeStyle = 'rgba(30,20,20,.85)'; x.lineWidth = 2.5; x.stroke(); }
    x.fillStyle = '#fff'; for (const [px, py, pr] of [[40, -16, 4], [30, -22, 3], [26, 18, 3]]){ x.beginPath(); x.arc(px, py, pr, 0, TAU); x.fill(); }
    x.restore(); }
  x.fillStyle = '#2a2018'; x.fillRect(62, 14, 4, 36); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const bfIM = new THREE.InstancedMesh(TM(new THREE.PlaneGeometry(0.62, 0.31), 0, 0, 0, -Math.PI / 2, 0, 0), new THREE.MeshBasicMaterial({ map: bfTex, alphaTest: 0.5, side: THREE.DoubleSide }), BFN);
bfIM.frustumCulled = false; FW.add(bfIM);
const BF = Array.from({ length: BFN }, (_, i) => { bfIM.setColorAt(i, new THREE.Color().setHSL(pick([0.95, 0.12, 0.56, 0.76, 0.06, 0.62, 0.86]), 1, 0.56)); return { x: 0, z: 0, ax: 0, az: 0, on: false, ph: R() * 10, h: rr(0.45, 1.4) }; });
// 새 떼 · 독수리
const BIRDN = (LOW ? 2 : 3) * 6, EAGLEN = 2;
const birdG = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.3, -0.9, 0.25, -0.1, 0, 0, -0.2, 0, 0, 0.3, 0, 0, -0.2, 0.9, 0.25, -0.1, 0, 0, 0.32, 0, -0.06, -0.35, 0.07, 0, 0, 0, 0, 0.32, -0.07, 0, 0, 0, -0.06, -0.35], 3)); g.computeVertexNormals(); return g; })();
const birdIM = new THREE.InstancedMesh(birdG, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), BIRDN + EAGLEN);
birdIM.frustumCulled = false; FW.add(birdIM);
for (let i = 0; i < BIRDN + EAGLEN; i++) birdIM.setColorAt(i, new THREE.Color(i >= BIRDN ? 0x3a2a1e : pick([0x22262e, 0x2c2a28, 0xf2f2ee])));
const FLOCKS = Array.from({ length: BIRDN / 6 }, () => ({ cx: 0, cz: 0, h: 30, r: 14, sp: rr(0.25, 0.4) * (R() < 0.5 ? 1 : -1), on: false, t: R() * 10 }));
const EAG = (() => { const m = (W.mesas || []).find(o => o.id === 'eagle'); return m ? { x: m.c[0], z: m.c[1], h: m.h } : { x: 532, z: -332, h: 92 }; })();
// 토끼
const RBN = LOW ? 5 : 9;
const rbIM = new THREE.InstancedMesh(once('rabbit', () => merge([TM(new THREE.SphereGeometry(0.16, 8, 6), 0, 0.15, 0, 0, 0, 0, 1, 0.9, 1.25), TM(new THREE.SphereGeometry(0.11, 8, 6), 0, 0.3, 0.16), ...[-1, 1].map(s => TM(new THREE.CapsuleGeometry(0.03, 0.16, 2, 5), s * 0.045, 0.45, 0.13, -0.2, 0, s * 0.15)), TM(new THREE.SphereGeometry(0.06, 6, 4), 0, 0.18, -0.2)])),
  sm(0xffffff, { roughness: 0.9 }), RBN);
rbIM.frustumCulled = false; rbIM.castShadow = true; FW.add(rbIM);
const RB = Array.from({ length: RBN }, (_, i) => { rbIM.setColorAt(i, new THREE.Color(pick([0xf4f0ea, 0xd8c0a0, 0xb08a6a, 0xf4f0ea]))); return { x: 0, z: 0, ry: 0, on: false, hop: null, t: rr(0, 3) }; });
// 개구리 (물가) + 울음주머니
const FRN = LOW ? 4 : 7;
const frIM = new THREE.InstancedMesh(once('frog', () => merge([TM(new THREE.SphereGeometry(0.12, 8, 6), 0, 0.08, 0, 0, 0, 0, 1.1, 0.7, 1.1), ...[-1, 1].map(s => TM(new THREE.SphereGeometry(0.045, 6, 4), s * 0.06, 0.15, 0.06))])), sm(0x4aa84a, { roughness: 0.4 }), FRN);
const sacIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), sm(0xf4f0b0, { roughness: 0.3 }), FRN);
for (const im of [frIM, sacIM]){ im.frustumCulled = false; FW.add(im); }
const FR = Array.from({ length: FRN }, () => ({ x: 0, z: 0, ry: 0, on: false, t: R() * 5, cro: 0, hop: null }));
// 물고기 점프 · 물결
const FISHG = once('fishj', () => merge([TM(new THREE.SphereGeometry(0.14, 8, 6), 0, 0, 0, 0, 0, 0, 0.55, 0.7, 1.4), TM(new THREE.ConeGeometry(0.1, 0.16, 4), 0, 0, -0.24, -Math.PI / 2, 0, 0, 1, 1, 0.4)]));
const FJ = Array.from({ length: 3 }, () => { const m = mesh(FISHG, sm(0xc8d8e8, { metalness: 0.6, roughness: 0.25 }), FW, false); m.visible = false; return { m, on: false, t: 0 }; });
const RIPM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
const RIPS = Array.from({ length: 6 }, () => { const m = mesh(TM(new THREE.RingGeometry(0.85, 1, 24), 0, 0, 0, -Math.PI / 2, 0, 0), RIPM.clone(), FW, false); m.visible = false; return { m, on: false, t: 0 }; });
function ripple(x, y, z, s = 1){ const o = RIPS.find(r => !r.on); if (!o) return; o.on = true; o.t = 0; o.s = s; o.m.visible = true; o.m.position.set(x, y + 0.03, z); }
let fishT = 3;
// 반딧불 (밤)
const FFN = LOW ? 40 : 90;
const ffGeo = new THREE.BufferGeometry(), ffPos = new Float32Array(FFN * 3), ffCol = new Float32Array(FFN * 3);
ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3)); ffGeo.setAttribute('color', new THREE.BufferAttribute(ffCol, 3));
const ffPts = new THREE.Points(ffGeo, new THREE.PointsMaterial({ size: 0.7, map: G.FX.glowT, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, toneMapped: false }));
ffPts.frustumCulled = false; ffPts.visible = false; FW.add(ffPts);
const FF = Array.from({ length: FFN }, () => ({ x: 0, y: 0, z: 0, on: false, ph: R() * 10, sp: rr(0.4, 1) }));
let ffK = 0;
const isMeadow = (x, z) => { const bm = biomeAt(x, z); return (bm === 'meadow' || bm === 'village' || bm === 'lake' || bm === 'forest' || bm === 'plateau') && !F.isWater(x, z); };
function updCritters(dt){
  const t = G.time, nt = night();
  // 나비 (낮)
  let bfOn = 0;
  for (let i = 0; i < BFN; i++){ const o = BF[i];
    if (o.on && (Math.hypot(o.ax - P.x, o.az - P.z) > 30 || (nt && R() < dt))) o.on = false;
    if (!o.on && !nt && R() < dt * 2){ const s = spotNear(3, 18, isMeadow); if (s){ o.on = true; [o.ax, o.az] = s; o.x = o.ax; o.z = o.az; } }
    if (!o.on){ setI(bfIM, i, 0, -999, 0, 0, 0, 0, 0.001, 0.001, 0.001); continue; }
    bfOn++; o.ph += dt; const wx = o.ax + Math.sin(o.ph * 0.7) * 1.8 + Math.sin(o.ph * 1.9) * 0.5, wz = o.az + Math.cos(o.ph * 0.6) * 1.8;
    const dx = wx - o.x, dz = wz - o.z; o.x += dx * Math.min(1, dt * 2); o.z += dz * Math.min(1, dt * 2);
    const y = F.H(o.x, o.z) + o.h + Math.sin(o.ph * 3) * 0.25, fl = 0.25 + Math.abs(Math.cos(o.ph * 22)) * 0.75;
    setI(bfIM, i, o.x, y, o.z, 0, Math.atan2(dx, dz), 0, fl, 1, 1);
  }
  bfIM.instanceMatrix.needsUpdate = true; bfIM.visible = bfOn > 0;
  // 새 떼
  FLOCKS.forEach((f, k) => { f.t += dt;
    if (!f.on || Math.hypot(f.cx - P.x, f.cz - P.z) > 160){ const s = spotNear(30, 110, (x, z) => !F.isWater(x, z) || R() < 0.3); if (s){ f.on = true; [f.cx, f.cz] = s; f.h = rr(22, 42); f.r = rr(10, 20); } }
    const gy = F.H(f.cx, f.cz);
    for (let j = 0; j < 6; j++){ const i = k * 6 + j, a = f.t * f.sp + j * 0.42, r = f.r + Math.sin(j * 1.7 + f.t * 0.3) * 3, x = f.cx + Math.cos(a) * r, z = f.cz + Math.sin(a) * r, y = Math.max(gy, W.water) + f.h + Math.sin(f.t * 0.5 + j) * 2 + j * 0.4;
      const glide = Math.sin(f.t * 0.6 + j) > 0.3, fl = glide ? 0.35 : Math.sin(f.t * 11 + j * 1.3);
      setI(birdIM, i, x, y, z, 0, Math.atan2(-Math.sin(a) * Math.sign(f.sp), Math.cos(a) * Math.sign(f.sp)), -0.3 * Math.sign(f.sp), 1.1, fl, 1.1); } });
  // 독수리 (둥지 바위 위를 빙빙)
  const ed = dP(EAG.x, EAG.z);
  for (let j = 0; j < EAGLEN; j++){ const i = BIRDN + j; if (ed > 420){ setI(birdIM, i, 0, -999, 0, 0, 0, 0, 0.001, 0.001, 0.001); continue; }
    const a = t * (0.22 + j * 0.05) + j * Math.PI, r = 24 + j * 10, x = EAG.x + Math.cos(a) * r, z = EAG.z + Math.sin(a) * r, y = EAG.h + 12 + j * 6 + Math.sin(t * 0.4 + j) * 3;
    setI(birdIM, i, x, y, z, 0, Math.atan2(-Math.sin(a), Math.cos(a)), -0.35, 3.2, Math.sin(t * 2.2 + j) > 0.6 ? Math.sin(t * 9) : 0.3, 3.2); }
  birdIM.instanceMatrix.needsUpdate = true;
  // 토끼 (초원)
  for (let i = 0; i < RBN; i++){ const o = RB[i];
    if (o.on && Math.hypot(o.x - P.x, o.z - P.z) > 36) o.on = false;
    if (!o.on && R() < dt){ const s = spotNear(6, 24, (x, z) => { const bm = biomeAt(x, z); return (bm === 'meadow' || bm === 'village' || bm === 'plateau') && !F.isWater(x, z) && F.slope(x, z) < 0.5; }); if (s){ o.on = true; [o.x, o.z] = s; o.ry = R() * TAU; } }
    if (!o.on){ setI(rbIM, i, 0, -999, 0, 0, 0, 0, 0.001, 0.001, 0.001); continue; }
    o.t -= dt; const pd = Math.hypot(o.x - P.x, o.z - P.z);
    if (!o.hop && (o.t <= 0 || pd < 6)){ const flee = pd < 6, a = flee ? Math.atan2(o.x - P.x, o.z - P.z) + rr(-0.5, 0.5) : o.ry + rr(-1.2, 1.2), L = flee ? rr(1.4, 2.2) : rr(0.4, 0.9); o.hop = { fx: o.x, fz: o.z, tx: o.x + Math.sin(a) * L, tz: o.z + Math.cos(a) * L, k: 0, T: flee ? 0.28 : 0.35 }; o.ry = a; o.t = flee ? 0.05 : rr(0.8, 3.5); }
    let y = 0, nib = 0;
    if (o.hop){ o.hop.k += dt / o.hop.T; const k = Math.min(1, o.hop.k); o.x = o.hop.fx + (o.hop.tx - o.hop.fx) * k; o.z = o.hop.fz + (o.hop.tz - o.hop.fz) * k; y = Math.sin(k * Math.PI) * 0.3; if (k >= 1) o.hop = null; }
    else nib = Math.max(0, Math.sin(t * 7 + i)) * 0.15;
    if (F.isWater(o.x, o.z)){ o.on = false; continue; }
    setI(rbIM, i, o.x, F.H(o.x, o.z) + y, o.z, nib, o.ry, 0, 1, 1, 1); }
  rbIM.instanceMatrix.needsUpdate = true;
  // 개구리 (늪 · 호숫가)
  for (let i = 0; i < FRN; i++){ const o = FR[i];
    if (o.on && Math.hypot(o.x - P.x, o.z - P.z) > 40) o.on = false;
    if (!o.on && R() < dt * 0.8){ const s = spotNear(3, 18, (x, z) => { const bm = biomeAt(x, z); if (bm !== 'swamp' && bm !== 'lake' && bm !== 'forest' && bm !== 'meadow') return false; if (F.isWater(x, z)) return false; for (let j = 0; j < 6; j++){ const a = j / 6 * TAU; if (F.isWater(x + Math.cos(a) * 2.2, z + Math.sin(a) * 2.2)) return true; } return false; });
      if (s){ o.on = true; [o.x, o.z] = s; o.ry = R() * TAU; o.hop = null; } }
    if (!o.on){ setI(frIM, i, 0, -999, 0, 0, 0, 0, 0.001, 0.001, 0.001); setI(sacIM, i, 0, -999, 0, 0, 0, 0, 0.001, 0.001, 0.001); continue; }
    o.t -= dt; o.cro = Math.max(0, o.cro - dt);
    if (o.t <= 0){ o.t = rr(1.5, 5); if (R() < 0.7) o.cro = 0.9; }
    const pd = Math.hypot(o.x - P.x, o.z - P.z);
    if (!o.hop && pd < 3.5){ let a = 0; for (let j = 0; j < 8; j++){ a = j / 8 * TAU; if (F.isWater(o.x + Math.sin(a) * 2, o.z + Math.cos(a) * 2)) break; } o.hop = { fx: o.x, fz: o.z, tx: o.x + Math.sin(a) * 2.2, tz: o.z + Math.cos(a) * 2.2, k: 0 }; o.ry = a; }
    let y = 0;
    if (o.hop){ o.hop.k += dt / 0.4; const k = Math.min(1, o.hop.k); o.x = o.hop.fx + (o.hop.tx - o.hop.fx) * k; o.z = o.hop.fz + (o.hop.tz - o.hop.fz) * k; y = Math.sin(k * Math.PI) * 0.5;
      if (k >= 1){ const wy = F.waterY ? F.waterY(o.x, o.z) : W.water; ripple(o.x, wy, o.z, 0.8); for (let j = 0; j < 6; j++) X.emit(o.x, wy + 0.05, o.z, rr(-0.8, 0.8), rr(1, 2), rr(-0.8, 0.8), 0xd8f4ff, 0.08, 0.4, { grav: -9 }); o.on = false; continue; } }
    const gy = F.H(o.x, o.z) + y, c = o.cro > 0 ? Math.sin(Math.min(1, o.cro / 0.9) * Math.PI * 3) : 0;
    setI(frIM, i, o.x, gy, o.z, 0, o.ry, 0, 1, 1 + c * 0.08, 1);
    const sc = 0.2 + Math.max(0, c) * 1.1; setI(sacIM, i, o.x + Math.sin(o.ry) * 0.1, gy + 0.05, o.z + Math.cos(o.ry) * 0.1, 0, 0, 0, sc, sc, sc); }
  frIM.instanceMatrix.needsUpdate = true; sacIM.instanceMatrix.needsUpdate = true;
  // 물고기 점프
  fishT -= dt;
  if (fishT <= 0){ fishT = rr(2, 5); const s = spotNear(6, 34, (x, z) => F.waterDepth(x, z) > 0.8); const o = FJ.find(f => !f.on); if (s && o){ o.on = true; o.t = 0; o.x = s[0]; o.z = s[1]; o.ry = R() * TAU; o.wy = F.waterY ? F.waterY(o.x, o.z) : W.water; o.m.visible = true; ripple(o.x, o.wy, o.z, 0.6); } }
  for (const o of FJ){ if (!o.on) continue; o.t += dt; const k = o.t / 0.8;
    o.m.position.set(o.x + Math.sin(o.ry) * k * 1.4, o.wy + Math.sin(k * Math.PI) * 0.9 - 0.1, o.z + Math.cos(o.ry) * k * 1.4); o.m.rotation.set(-Math.cos(k * Math.PI) * 1.1, o.ry, Math.sin(o.t * 20) * 0.2);
    if (k >= 1){ o.on = false; o.m.visible = false; const x = o.m.position.x, z = o.m.position.z; ripple(x, o.wy, z, 0.9); for (let j = 0; j < 10; j++) X.emit(x, o.wy + 0.05, z, rr(-1, 1), rr(1.5, 3), rr(-1, 1), 0xe8f8ff, 0.1, 0.5, { grav: -9 }); } }
  for (const o of RIPS){ if (!o.on) continue; o.t += dt; const k = o.t / 1.2; o.m.scale.setScalar(o.s * (0.2 + k * 1.3)); o.m.material.opacity = 0.55 * (1 - k); if (k >= 1){ o.on = false; o.m.visible = false; } }
  // 반딧불
  ffK += ((nt ? 1 : 0) - ffK) * Math.min(1, dt * 0.5); ffPts.visible = ffK > 0.02;
  if (ffPts.visible){ const bmP = biomeAt(P.x, P.z), okB = bmP !== 'snow' && bmP !== 'canyon' && bmP !== 'blight';
    for (let i = 0; i < FFN; i++){ const o = FF[i];
      if (!o.on || Math.hypot(o.x - P.x, o.z - P.z) > 24){ const s = spotNear(2, 22, (x, z) => !F.isWater(x, z)); if (s){ o.on = true; [o.x, o.z] = s; o.y = F.H(o.x, o.z) + rr(0.4, 2.4); } }
      o.ph += dt * o.sp; o.x += Math.sin(o.ph * 1.3) * dt * 0.5; o.z += Math.cos(o.ph * 1.1) * dt * 0.5; o.y += Math.sin(o.ph * 2) * dt * 0.2;
      ffPos[i * 3] = o.x; ffPos[i * 3 + 1] = o.y; ffPos[i * 3 + 2] = o.z;
      const bl = okB ? (0.25 + 0.75 * Math.max(0, Math.sin(o.ph * 3 + i)) ** 2) * ffK : 0; ffCol[i * 3] = 0.9 * bl; ffCol[i * 3 + 1] = 1.0 * bl; ffCol[i * 3 + 2] = 0.4 * bl; }
    ffGeo.attributes.position.needsUpdate = true; ffGeo.attributes.color.needsUpdate = true; }
}

// ═════════════════════════ 10. 미니맵 · 이벤트 · 매 프레임 ═════════════════════════
if (F.area){ const prev = F.area.mapDraw; F.area.mapDraw = (c, k) => { if (prev) prev(c, k); if (!F.inField) return; const ms = 1.3 / (F.area.mapZoom || 6.5);
  c.fillStyle = '#8ae6ff'; for (const b of BOTS){ if (b.d > 150) continue; c.beginPath(); c.arc(b.x * k, b.z * k, 2.3 * ms, 0, TAU); c.fill(); }
  c.fillStyle = '#ffd36a'; for (const o of NPCL){ if (o.d > 200) continue; c.beginPath(); c.arc(o.x * k, o.z * k, 3 * ms, 0, TAU); c.fill(); } }; }

BUS.on('kill', e => {
  if (e.camp){ const o = CAMP_BY[e.camp], m = o && o.mem.find(m => m.e === e); if (m){ m.e = null; m.at = T + rr(20, 40); } }
  if (FB.e && e === FB.e && FB.cur) fbReward(e);
  if (PARTY && R() < 0.22 && dP(e.pos.x, e.pos.z) < 20) later(rr(0.4, 1.2), () => PARTY && botSay(PARTY.b, pick(['나이스!', '굿굿', 'ㅋㅋ 순삭', '깔끔하다', '오 세다']), 'party'));
});
BUS.on('spawn', e => { if (MYSPAWN || !FB.e || e === FB.e) return; if (e.fld && FB.e.fld && Math.hypot(e.fld.hx - FB.e.fld.hx, e.fld.hz - FB.e.fld.hz) < 1){ e.fbMinion = true; FB.minions.push(e); } });
BUS.on('enterField', d => {
  for (const o of CAMPS) for (const m of o.mem){ if (m.e && !X.ENEMIES.includes(m.e)) m.e = null; if (m.at > T + 41) m.at = 0; }
  if (FB.e && !X.ENEMIES.includes(FB.e)){ FB.hpK = Math.max(0.05, FB.e.hp / FB.e.max); FB.e = null; if (FB.bar){ X.bossBar(null); FB.bar = false; } }
  clearEffects(); EMO = null;
  if (!d || (!d.warp && !d.revive)){ if (!FB.cur && FB.next === Infinity) FB.next = T + 120; if (FB.marker && !G.mapMarkers.includes(FB.marker)) G.mapMarkers.push(FB.marker);
    if (!LINES.length) for (let i = 0; i < 5; i++) guard('seed', () => { const k = pick(['party', 'trade', 'flavor', 'social', 'joke']), bb = pickBot(); if (bb) chatLine(bb.name, pick(CHAT[k])(), k === 'party' ? 'party' : k === 'trade' ? 'trade' : 'world'); });
    if (!S.life.welcome){ S.life.welcome = 1; X.save(); later(4, () => sysLine(`<i>[시스템]</i> 아르카디아에 오신 것을 환영합니다! <b>Enter</b> 로 대화, <b>T</b> 로 감정표현을 할 수 있어요.`)); } }
  later(rr(1.5, 3), () => { const b = pickBot(o => o.d < 60) || pickBot(); botSay(b, pick(['어서 오세요~', 'ㅎㅇ 반가워요', '오 새로운 모험가다', '같이 사냥해요!']), b && b.d < 30 ? 'local' : 'world'); });
});
BUS.on('leaveField', () => { closeWheel(); closeChat(); EMO = null; if (OFFER) answerOffer(false); if (PARTY) endParty('quiet'); for (const b of BUBS) b.L.remove(); BUBS.length = 0; if (FB.bar){ X.bossBar(null); FB.bar = false; } if (FB.marker){ const i = G.mapMarkers.indexOf(FB.marker); if (i >= 0) G.mapMarkers.splice(i, 1); } });
BUS.on('levelUp', d => { if (!F.inField) return; const lv = d && d.lv; for (let i = 0; i < ri(2, 3); i++) later(rr(1.2, 4) + i * 0.8, () => botSay(pickBot(), pick(['ㅊㅊ', '레벨업 축하해요!', 'ㅊㅋㅊㅋ', lv ? `${lv}렙 축하드려요~` : '축하해요!', '🎉🎉', '오 렙업 ㄷㄷ']), 'world'));
  for (const b of BOTS.filter(b => b.d < 16 && b.vis).slice(0, 3)) later(rr(0.5, 1.4), () => botEmote(b, pick(['clap', 'cheer']))); for (const o of BOTS) if (o.floater && o.lv < S.lv - 1 && o.d > 150) { o.lv++; refreshLabel(o); } });
BUS.on('raidClear', d => { const r = (W.raids || []).find(o => o.id === (d && d.id)); sysLine(`<i>[레이드]</i> <span class="it">모험가님</span>의 파티가 ${esc(r ? r.name : '레이드')}${jo(r ? r.name : '레이드', '을', '를')} 클리어했다!`, 'raid'); later(rr(1.5, 3), () => botSay(pickBot(), pick(['와 레이드 클리어 축하해요!', 'ㄷㄷ 고수다', '보상 뭐 나왔어요?']), 'world')); });
BUS.on('fish', d => { if (!d || !F.inField) return; const rare = typeof d.rarity === 'number' ? d.rarity >= 2 : /rare|epic|legend|희귀|영웅|전설/.test(String(d.rarity)); if (rare){ const b = pickBot(o => o.d < 30 && o.vis); if (b) later(rr(0.8, 2), () => { botEmote(b, 'clap'); botSay(b, pick([`와 ${d.name || '대어'}!!`, '월척 축하해요!', '부럽다 ㅠㅠ']), 'local'); }); } });
BUS.on('death', m => { if (m !== 'field') return; const b = pickBot(o => o.d < 40 && o.vis); if (b) later(rr(0.8, 2), () => botSay(b, pick(['앗 괜찮으세요?!', 'ㅠㅠ 부활 ㄱㄱ', '조심해요!!']), 'local')); });

let campT = 0, dirT = 2, chatT = rr(5, 10), sysT = rr(30, 60), lineT = 0;
let wasIn = false, emoDot = null;
G.hooks.push((dt, rdt) => {
  if (X.inStory){ guard('augment', () => { for (const e of X.ENEMIES) if (MYK[e.key]) augment(e, dt); }); guard('mon fx', () => updEffects(dt)); }   // 레이드에서도
  const inF = F.inField && X.mode === 'field';
  if (!inF){ if (wasIn){ wasIn = false; for (const b of BOTS) if (b.vis) showBot(b, false); } if (!F.inField && wheelOpen) closeWheel(); return; }
  if (!wasIn){ wasIn = true; for (const o of NPCL) o.vis = null; }
  T += rdt;
  guard('later', () => { for (let i = LATER.length - 1; i >= 0; i--){ if (T >= LATER[i].at){ const o = LATER.splice(i, 1)[0]; guard('later fn', o.fn); } } });
  campT -= rdt; if (campT <= 0){ campT = 0.25; guard('camps', campTick); guard('fboss', fbTick); }
  dirT -= rdt; if (dirT <= 0){ dirT = 3; guard('director', director); }
  guard('cull', cullEnemies);
  guard('npcs', () => updNpcs(rdt));
  guard('bots', () => updBots(rdt));
  guard('bot fx', () => updBotFx(rdt));
  guard('engaged', () => { for (const e of X.ENEMIES){ if (e.aggro || !e._bot || e.state === 'dying' || T - (e._botT || -9) > 1.2) continue; const b = e._bot; e.wp = null; e.wt = Math.max(e.wt || 0, 0.6); X.turn(e, Math.atan2(b.x - e.pos.x, b.z - e.pos.z), dt * 6);
    e._bat = (e._bat ?? rr(1, 2)) - dt; if (e._bat <= 0 && Math.hypot(b.x - e.pos.x, b.z - e.pos.z) < 4 + e.cfg.rad){ e._bat = rr(1.4, 2.4); const dd = Math.hypot(b.x - e.pos.x, b.z - e.pos.z) || 1; e.pos.x += (b.x - e.pos.x) / dd * 0.35; e.pos.z += (b.z - e.pos.z) / dd * 0.35; later(0.18, () => { b.hurt = 0.25; }); } } });
  guard('fires', () => updFires(rdt));
  guard('critters', () => updCritters(rdt));
  guard('emote', () => updPlayerEmote(rdt));
  guard('party', () => partyTick(rdt));
  updBubbles();
  // 채팅 흐름: 6~15초에 한 줄쯤
  chatT -= rdt; sysT -= rdt; lineT -= rdt;
  if (chatT <= 0 && lineT <= 0){ chatT = rr(6, 15); lineT = 3; guard('chatter', worldChatter); }
  if (sysT <= 0 && lineT <= 0){ sysT = rr(40, 90); lineT = 3; guard('sys', sysEvent); }
  ageLines();
  if (emoBtn && emoDot !== (S.life.emo === 0)){ emoDot = S.life.emo === 0; emoBtn.classList.toggle('dot', emoDot); }
});

// ── 시작 ──
guard('fires', prepFires);
guard('fish spots', prepFish);
guard('npcs', buildNpcs);
guard('bots', placeInitial);
console.log(`[life] 사냥터 ${CAMPS.length} · 몬스터 슬롯 ${CAMPS.reduce((s, o) => s + o.mem.length, 0)} · NPC ${NPCL.length} · 봇 ${BOTS.length} · 모닥불 ${FIRES3D.length} · 낚시 자리 ${FISHS.length} · 길 노드 ${NODES.length}`);

return { chat: F.chat, say: F.say, emote: F.emote, spawnCamp: F.spawnCamp, bots: BOTS, npcs: F.npcs, camps: CAMPS, EMOTES, get worldBoss(){ return F.worldBoss; },
  get party(){ return PARTY; }, offerParty, answerOffer, endParty,
  critters: { BF, RB, FR, FLOCKS, FF }, fx: { shardRing, fireBolt, onSlam, onAggro }, fb: FB, forceBoss(){ if (FB.cur) fbEnd('gone'); FB.next = T; }, openChat, openWheel, get T(){ return T; },
  // 시험용: 봇을 특정 활동으로 보내요 (warp = 바로 그 자리로)
  send(b, act, id, warp){ if (typeof b === 'number') b = BOTS[b]; if (!b) return null; nextAct(b);
    if (act === 'hunt'){ const o = CAMP_BY[id]; if (o) setAct(b, 'hunt', o.c.c[0] + rr(-5, 5), o.c.c[1] + rr(-5, 5), 200, { camp: id }); }
    else if (act === 'village'){ const [x, z] = villageSpot(); setAct(b, 'village', x, z, 200); }
    else if (act === 'glide'){ setAct(b, 'glide', HAWK.c[0] + 4, HAWK.c[1] + rr(-6, 6), 60); }
    else if (act === 'fish' && FISHS.length){ const f = FISHS[id || 0]; setAct(b, 'fish', f.x, f.z, 200, { fish: f }); }
    else if (act === 'rest'){ const f = fireSpots[id || 0]; f.seats++; setAct(b, 'rest', f.x + Math.sin(f.seats * 1.25) * 2, f.z + Math.cos(f.seats * 1.25) * 2, 200, { fire: f }); }
    if (warp && b.path && b.path.length){ [b.x, b.z] = b.path[b.path.length - 1]; b.pi = b.path.length; b.st = 'at'; b.y = gnd(b.x, b.z); }
    return b.act; } };
}
