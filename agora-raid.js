// 룬 아고라 — 모험의 대지: 레이드 (agora-raid.js)
// 레이드 대장 카엘의 게시판 · 입구 상호작용 · 레이드 3종 전용 인스턴스 (그롬 · 그라녹 · 크라이오스)
// 손으로 지은 전장 3곳 · 보스 모델 3종 · 패턴 AI (70% · 35% 페이즈, 광폭화 타이머) · 파티원 봇 (탱커 · 힐러 · 딜러)
// 흐름: 입장 → 보스 등장 연출 → 카운트다운 → 전투 → 전멸(재도전 · 나가기) / 승리(슬로 모션 · 보상 상자) → 입구로 귀환
// F 에 올리는 것: F.openRaidBoard(opt) · F.enterRaid(id) · F.raidInfo(id)   저장: S.raid = { clears: { id: { best, count, first } }, met, seen }
// BUS: 'raidClear' { id, time } 를 쏘고, 'hit' · 'mode' · 'leave' · 'fieldReady' 를 들어요.
// 계약서: docs/agora-modules.md
import { WORLD, byId } from './agora-worlddata.js';

export async function init(G, X, F){
const { THREE, V3, BUS, R, rr, clamp, ease, pick, angDiff, TAU } = X;
const S = X.S, PI = Math.PI, HPI = PI / 2;
const LOW = G.gfxMode === 'low' || G.IS_TOUCH;
S.raid = Object.assign({ clears: {}, met: false, seen: [] }, S.raid || {});
if (!S.raid.clears || typeof S.raid.clears !== 'object') S.raid.clears = {};
if (!Array.isArray(S.raid.seen)) S.raid.seen = [];

// ───────────────────────── 레이드 정보 ─────────────────────────
// WORLD.raids (이름 · 레벨 · 입구 · 인원) + 여기서 정하는 연출 · 보스 수치 · 첫 클리어 보상
const META = {
  grom: { icon: '🐸', col: '#8ae05a', glow: 0x8aff5a, place: '가라앉은 신전 · 왕의 대전당', placeEn: 'THRONE HALL OF THE SUNKEN TEMPLE', enrage: 300, blv: 2, hp: 6000, dmg: 24, spd: 2.6, exp: 230, rad: 2.9, top: 4.8,
    title: { id: 'raid_grom', n: '늪의 왕을 쓰러뜨린 자', d: '레이드 「늪의 왕 그롬」 첫 클리어', b: { hp: 60, def: 2 } },
    cos: { slot: 'hat', id: 'gromcrown', n: '늪왕의 이끼 왕관', icon: '👑', r: 2 },
    firstGold: 2500, firstExp: 0.55,
    tips: ['혀가 날아오는 붉은 띠에서는 옆으로 구르세요 (K).', '독 웅덩이는 오래 남아요 — 싸울 자리를 넓게 쓰세요.', '독 해일(초록 고리)은 점프(Space)로 넘거나 구르기로 통과할 수 있어요.'],
    line: '개굴… 개구르르… 감히 짐의 왕좌에 발을 들이느냐. 늪의 맛을 보여 주마!' },
  granok: { icon: '🗿', col: '#ffa14a', glow: 0xff9a3a, place: '버려진 광산 · 거인의 동굴', placeEn: 'THE STONEBORN CAVERN', enrage: 330, blv: 2, hp: 6800, dmg: 30, spd: 2.2, exp: 300, rad: 2.6, top: 7.4,
    title: { id: 'raid_granok', n: '바위를 깨뜨린 자', d: '레이드 「바위 거인 그라녹」 첫 클리어', b: { atk: 4, def: 4 } },
    cos: { slot: 'aura', id: 'granokshards', n: '그라녹의 수정 파편', icon: '🔶', r: 2 },
    firstGold: 4000, firstExp: 0.55,
    tips: ['대지 강타의 충격파 고리는 점프(Space)로 넘으세요.', '수정 첨탑이 살아 있는 동안 그라녹은 다치지 않아요 — 첨탑부터!', '천장이 무너질 땐 붉은 원 밖으로. 떨어진 바위는 잠시 엄폐물이 돼요.'],
    line: '…쿠우우웅. 잠을… 깨운 것은… 너희냐. 돌로… 돌아가라.' },
  cryos: { icon: '🐉', col: '#8ad8ff', glow: 0x8ae8ff, place: '얼어붙은 제단 · 하늘 끝 제단', placeEn: 'THE FROZEN SKY ALTAR', enrage: 360, blv: 2, hp: 6800, dmg: 34, spd: 3.0, exp: 380, rad: 3.0, top: 7.2,
    title: { id: 'raid_cryos', n: '서리 거룡 사냥꾼', d: '레이드 「서리 거룡 크라이오스」 첫 클리어', b: { atk: 8, crit: 0.01 } },
    cos: { slot: 'back', id: 'frostwings', n: '서리 거룡의 날개', icon: '❄️', r: 3 },
    firstGold: 6000, firstExp: 0.6,
    tips: ['얼어붙는 폭풍: 파란 그림자 — 얼음 기둥 뒤에 숨으세요!', '하늘을 가로지르는 숨결은 붉은 띠 밖으로 피하세요.', '꼬리는 뒤쪽 넓은 부채꼴! 옆이나 앞에서 싸우세요.'],
    line: '…천 년의 봉인을 깬 것이 고작 너희인가. 좋다. 이 하늘에서, 얼음이 되어라.' },
};
const RAIDS = WORLD.raids.filter(r => META[r.id]);
const raidOf = id => byId('raids', id);
const entranceOf = id => { const r = raidOf(id), l = r && byId('landmarks', r.entrance); const p = (F.raidPortalPos && F.raidPortalPos[id]) || (l && l.c) || [0, 560]; return { x: p[0], z: p[1], l }; };
const minLv = r => Math.max(1, r.lv - 3);
const fmtT = s => { s = Math.max(0, Math.round(s)); return `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`; };
const clearOf = id => { const c = S.raid.clears[id]; return c && typeof c === 'object' ? c : c ? { best: 0, count: +c || 1 } : null; };

// 파티원 (봇) — 이름 · 직업 · 외형 · 대사
const PARTY = {
  tank: { id: 'leon', name: '강철의 레온', job: 'sword', role: 'tank', look: { hat: 'viking', back: 'cape', body: 'silver' }, hpK: 2.0, solo: 760, ico: '🛡️',
    say: { start: ['내 뒤로 붙어! 어그로는 내가 잡는다.', '방패 들었다. 가자!'], taunt: ['이쪽이다, 덩치!', '도발! 날 봐라!', '네 상대는 나다!'], down: ['크윽… 방패가…', '잠깐만… 일으켜 줘!'], up: ['고맙다! 다시 앞에 선다.', '아직 안 끝났어!'], win: ['하하! 우리가 해냈다!', '역시 최고의 파티야!'], hurt: ['큭, 묵직하군!', '버틸 만해!'] } },
  heal: { id: 'sera', name: '별빛의 세라', job: 'mage', role: 'heal', look: { hat: 'wizard', back: 'royal', body: 'sakura' }, hpK: 1.0, solo: 900, ico: '✨',
    say: { start: ['힐은 맡겨 주세요~ 다치면 제 쪽으로!', '치유의 룬, 준비됐어요!'], heal: ['치유의 룬!', '힐 들어가요~', '버텨요, 금방 낫게 해 줄게요!'], res: ['일어나요! 아직 끝나지 않았어요!', '빛이여, 다시 한 번!'], down: ['꺄악! 저 좀…!', '마나가… 부족해…'], up: ['살았다… 고마워요!', '다시 힐 갈게요!'], win: ['수고했어요! 다친 데 없죠?', '와아~ 우리 진짜 잘했다!'] } },
  archer: { id: 'aria', name: '바람궁수 아리아', job: 'archer', role: 'ranged', look: { hat: 'cat', back: 'butterfly' }, hpK: 0.95, solo: 640, ico: '🏹',
    say: { start: ['거리는 내가 잴게. 넌 앞만 봐!', '화살 백 발 챙겨 왔어.'], adds: ['쫄몹은 내가 정리한다!', '작은 놈들부터!'], down: ['아얏… 방심했다…', '도와줘!'], up: ['고마워! 빚진 걸로 할게.', '좋아, 다시 쏜다!'], win: ['명중! 마지막 한 발이었어.', 'GG! 다음 레이드도 같이 가자.'] } },
  rogue: { id: 'kai', name: '그림자 카이', job: 'rogue', role: 'melee', look: { back: 'shadowcloak', body: 'shadow' }, hpK: 1.05, solo: 620, ico: '🗡️',
    say: { start: ['등 뒤는 내가 맡지.', '…조용히 끝내자.'], adds: ['잔챙이는 맡긴다— 아니, 내가 한다.', '그림자는 놓치지 않아.'], down: ['…쳇.', '실수했군…'], up: ['…신세 졌다.', '다시 그림자로.'], win: ['…나쁘지 않았어.', '훗, 끝났군.'] } },
};
function partyFor(id){
  const n = Math.max(1, (raidOf(id) || {}).party || 3) - 1, list = [PARTY.tank, PARTY.heal];
  if (S.job === 'mage') list[1] = PARTY.archer;
  if (n > 2) list.push(S.job === 'archer' ? PARTY.rogue : S.job === 'rogue' ? PARTY.archer : R() < 0.5 ? PARTY.archer : PARTY.rogue);
  if (n > 3) list.push(list.includes(PARTY.archer) ? PARTY.rogue : PARTY.archer);
  return list.slice(0, n);
}

// ───────────────────────── 공용 도구 ─────────────────────────
const srand = s => { s = (s >>> 0) || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const std = o => G.std(Object.assign({ roughness: 0.8 }, o));
const basic = (c, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ color: c, toneMapped: false }, o));
const addM = (c, op = 1, map = null) => new THREE.MeshBasicMaterial({ color: c, map, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
const MC = {};   // 재질 캐시 (레이드 사이에 다시 써요)
const mat = (k, f) => MC[k] || (MC[k] = f());
const GC = {};   // 지오메트리 캐시
const geo = (k, f) => GC[k] || (GC[k] = f());
const cnvTex = (w, h, draw, srgb = true, rx = 1, ry = rx) => { const c = G.cnv(w, h); draw(c.getContext('2d'), w, h); return G.tex(c, srgb, rx, ry); };
const hexCss = n => '#' + new THREE.Color(n).getHexString();
const mesh = (g, m, parent, x = 0, y = 0, z = 0, cast = true) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = cast; if (parent) parent.add(o); return o; };
// 울퉁불퉁한 덩어리 (사마귀 · 혹)
function blobGeo(r, sx, sy, sz, seg, bumps, amp, seed, wMin = 0.008, wMax = 0.03){
  const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.66)), p = g.attributes.position, rnd = srand(seed), B = [];
  for (let i = 0; i < bumps; i++){ const u = rnd() * 2 - 1, a = rnd() * TAU, s = Math.sqrt(1 - u * u); B.push([s * Math.cos(a), u, s * Math.sin(a), wMin + rnd() * (wMax - wMin), (0.4 + rnd() * 0.6) * amp]); }
  const v = new V3(), n = new V3();
  for (let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i); n.copy(v).normalize(); let h = 0;
    for (const [bx, by, bz, w, a] of B){ const d = 1 - (n.x * bx + n.y * by + n.z * bz); if (d < w) h += a * (1 - d / w) ** 2; }
    v.addScaledVector(n, h); p.setXYZ(i, v.x * sx, v.y * sy, v.z * sz); }
  g.computeVertexNormals(); g.userData.bumps = B; return g;
}
// 각진 바위 (평면 음영) — 같은 위치의 정점은 같은 만큼 움직여서 틈이 안 생겨요
function rockGeo(r, det, jit, seed, sx = 1, sy = 1, sz = 1){
  const g = new THREE.IcosahedronGeometry(r, det), p = g.attributes.position, k = seed * 13.7;
  for (let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i), h = Math.sin(x * 3.1 + k) * Math.cos(y * 2.7 - k * 0.7) * Math.sin(z * 3.3 + k * 1.3) + Math.sin((x + y + z) * 5.3 + k) * 0.5;
    const s = 1 + h * jit; p.setXYZ(i, x * s * sx, y * s * sy, z * s * sz); }
  g.computeVertexNormals(); return g;
}
// 정점 색 칠하기 (fn(x, y, z, nx, ny, nz) → [r, g, b])
function paint(g, fn){
  const p = g.attributes.position, n = g.attributes.normal, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++){ const o = fn(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)); c[i * 3] = o[0]; c[i * 3 + 1] = o[1]; c[i * 3 + 2] = o[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
const C3 = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
// 부드러운 노멀맵 (물결 · 얼음) — 높이 노이즈를 캔버스에서 노멀로 바꿔요
function normalTex(size, waves, rep){
  const c = G.cnv(size), x = c.getContext('2d'), img = x.createImageData(size, size), H = new Float32Array(size * size), rnd = srand(waves * 97 + size);
  const W = []; for (let i = 0; i < waves; i++) W.push([Math.round(rr(1, 7)) * (rnd() < 0.5 ? -1 : 1), Math.round(rr(1, 7)) * (rnd() < 0.5 ? -1 : 1), rnd() * TAU, 0.4 + rnd() * 0.6]);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++){ let h = 0; for (const [a, b, ph, k] of W) h += Math.sin((a * i + b * j) / size * TAU + ph) * k; H[j * size + i] = h; }
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++){
    const dx = H[j * size + (i + 1) % size] - H[j * size + (i - 1 + size) % size], dy = H[((j + 1) % size) * size + i] - H[((j - 1 + size) % size) * size + i];
    const nx = -dx * 0.6, ny = -dy * 0.6, nz = 1, l = Math.hypot(nx, ny, nz), o = (j * size + i) * 4;
    img.data[o] = (nx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[o + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255; }
  x.putImageData(img, 0, 0); return G.tex(c, false, rep);
}
// 세로 그라데이션 (빛기둥 · 벽)
const gradTex = (stops, w = 4, h = 128) => cnvTex(w, h, (x) => { const g = x.createLinearGradient(0, h, 0, 0); for (const [k, c] of stops) g.addColorStop(k, c); x.fillStyle = g; x.fillRect(0, 0, w, h); }, true);

// ───────────────────────── 스타일 · DOM ─────────────────────────
const css = document.createElement('style');
css.textContent = `
  #rdboard { position:fixed; left:50%; top:50%; transform:translate(-50%,-48%) scale(.97); width:min(1000px, 96vw); z-index:27; padding:16px 18px 14px; max-height:92vh; overflow:auto;
    background:linear-gradient(180deg, rgba(16,20,34,.97), rgba(7,9,16,.97)); border:1px solid rgba(233,200,126,.55); border-radius:6px; box-shadow:0 0 0 4px rgba(10,14,24,.5), 0 20px 60px rgba(0,0,0,.7); opacity:0; pointer-events:none; transition:opacity .25s, transform .25s; color:#e8e1cf; }
  #rdboard.on { opacity:1; pointer-events:auto; transform:translate(-50%,-50%) scale(1); }
  #rdboard .hd { display:flex; align-items:baseline; gap:10px; border-bottom:1px solid rgba(233,200,126,.25); padding-bottom:9px; margin-bottom:10px; }
  #rdboard .hd span { font:700 11px 'Cinzel'; letter-spacing:.4em; color:#ff9a7a; } #rdboard .hd b { font:700 20px 'Gowun Batang'; color:#fff3d6; }
  #rdboard .hd small { font:500 12px 'Noto Sans KR'; color:#b8b0a0; flex:1; } #rdboard .hd button { background:none; border:none; color:#e9c87e; font-size:20px; cursor:pointer; }
  #rdboard .cards { display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; }
  #rdboard .rc { position:relative; display:flex; flex-direction:column; border:1px solid rgba(233,200,126,.32); border-radius:6px; overflow:hidden; background:linear-gradient(180deg, rgba(20,24,38,.9), rgba(8,10,18,.95)); box-shadow:0 6px 20px rgba(0,0,0,.4); }
  #rdboard .rc.focus { border-color:rgba(255,220,140,.9); box-shadow:0 0 0 2px rgba(255,200,100,.35), 0 6px 26px rgba(0,0,0,.5); }
  #rdboard .rc .art { position:relative; height:128px; } #rdboard .rc canvas { display:block; width:100%; height:128px; }
  #rdboard .rc .lvb { position:absolute; left:8px; top:8px; font:900 12px 'Cinzel'; letter-spacing:.1em; color:#fff; padding:3px 8px; border-radius:3px; background:rgba(0,0,0,.55); border:1px solid var(--c); }
  #rdboard .rc .clr { position:absolute; right:8px; top:8px; font:800 11px 'Noto Sans KR'; color:#1a1206; padding:3px 8px; border-radius:10px; background:linear-gradient(180deg,#fff2c9,#e2b964); }
  #rdboard .rc .nm { padding:9px 12px 0; font:900 19px 'Gowun Batang'; color:#fff3d6; letter-spacing:.04em; } #rdboard .rc .en { padding:0 12px; font:700 10px 'Cinzel'; letter-spacing:.22em; color:var(--c); }
  #rdboard .rc .ds { padding:6px 12px 0; font:400 12px/1.55 'Noto Sans KR'; color:#c8c0b0; min-height:38px; }
  #rdboard .rc .chips { display:flex; flex-wrap:wrap; gap:5px; padding:8px 12px 0; } #rdboard .rc .chips i { font:700 11px 'Noto Sans KR'; font-style:normal; padding:2px 8px; border-radius:10px; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12); color:#e8e1cf; }
  #rdboard .rc .chips i.low { color:#ff9a8a; border-color:rgba(255,120,100,.5); } #rdboard .rc .chips i.ok { color:#a8f0a0; border-color:rgba(140,240,140,.4); }
  #rdboard .rc .rec { margin:8px 12px 0; padding:6px 8px; border-radius:4px; background:rgba(0,0,0,.3); font:500 11px/1.6 'Noto Sans KR'; color:#c8c0b0; }
  #rdboard .rc .rec b { color:#ffe9b0; font-weight:700; } #rdboard .rc .rec .done { color:#8ae08a; } #rdboard .rc .rec s { opacity:.55; }
  #rdboard .rc .go { margin:10px 12px 12px; padding:10px; font:700 15px 'Gowun Batang'; letter-spacing:.15em; color:#10131c; border:none; border-radius:3px; cursor:pointer; background:linear-gradient(180deg,#fff2c9,#e2b964 60%,#b88c3e); }
  #rdboard .rc .go:disabled { cursor:default; color:#a8a090; background:rgba(255,255,255,.08); letter-spacing:.04em; font-size:13px; }
  #rdboard .rc.lock .art::after { content:'🔒'; position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:38px; background:rgba(0,0,0,.5); }
  #rdboard .rc.lock canvas { filter:grayscale(.7) brightness(.7); }
  #rdboard .ft { margin-top:10px; font:500 12px 'Noto Sans KR'; color:#a8a090; text-align:center; }
  @media (max-width:760px){ #rdboard .cards { grid-template-columns:1fr; } #rdboard .rc .art, #rdboard .rc canvas { height:92px; } #rdboard .rc .ds { min-height:0; } }
  #rdparty { position:absolute; left:14px; top:calc(max(14px, env(safe-area-inset-top)) + 106px); display:none; flex-direction:column; gap:5px; pointer-events:none; }
  body.raid #rdparty { display:flex; }
  #rdparty .pf { position:relative; width:184px; padding:5px 9px 6px 8px; border-radius:4px; background:linear-gradient(90deg, rgba(10,14,24,.88), rgba(10,14,24,.35)); border-left:3px solid var(--c); }
  #rdparty .pf .nm { display:flex; align-items:center; gap:5px; font:700 12px 'Gowun Batang'; color:#fff4d8; white-space:nowrap; }
  #rdparty .pf .nm em { font:700 10px 'Noto Sans KR'; font-style:normal; color:#9fe8f2; margin-left:auto; }
  #rdparty .pf .hb { position:relative; height:6px; margin-top:4px; border-radius:2px; background:rgba(255,255,255,.12); overflow:hidden; }
  #rdparty .pf .hb b { position:absolute; left:0; top:0; bottom:0; width:100%; background:linear-gradient(90deg,#3ac85a,#9aff7a); transition:width .2s; }
  #rdparty .pf.lowhp .hb b { background:linear-gradient(90deg,#d8423a,#ff9a5a); }
  #rdparty .pf .st { font:600 10px 'Noto Sans KR'; color:#ff9a8a; margin-top:2px; display:none; } #rdparty .pf.down { filter:grayscale(.8); } #rdparty .pf.down .st { display:block; }
  #rdparty .pf .rv { position:absolute; left:0; bottom:0; height:2px; background:#ffe08a; width:0; }
  #rdparty .pf.me { border-left-color:#7ff3ff; }
  body.touch #rdparty .pf { width:138px; padding:4px 7px; } body.touch #rdparty .pf .nm { font-size:11px; }
  @media (max-width:560px){ #rdparty { top:calc(max(14px, env(safe-area-inset-top)) + 96px); } #rdparty .pf { width:132px; } }
  #rdhud { position:absolute; left:50%; top:calc(max(14px, env(safe-area-inset-top)) + 60px); transform:translateX(-50%); display:none; gap:14px; align-items:center; font:700 12px 'Noto Sans KR'; color:#f0e6cf; text-shadow:0 1px 3px #000; pointer-events:none; white-space:nowrap; }
  body.raid.rfight #rdhud { display:flex; }
  #rdhud .tm { font:700 14px 'Cinzel'; color:#fff; letter-spacing:.08em; } #rdhud .en { color:#ffb08a; } #rdhud .en.hot { color:#ff5a5a; animation:rdblink .6s infinite alternate; }
  #rdhud .ph { padding:1px 8px; border-radius:9px; background:rgba(0,0,0,.45); border:1px solid rgba(233,200,126,.4); color:#ffe9b0; }
  @keyframes rdblink { to { opacity:.4; } }
  @media (max-width:560px){ #rdhud { top:calc(max(14px, env(safe-area-inset-top)) + 160px); } }
  #boss .bar em.rdtick { position:absolute; top:0; bottom:0; width:2px; background:rgba(255,240,200,.85); box-shadow:0 0 4px #000; z-index:2; }
  body.raid.cine #rdparty, body.raid.cine #bReturn { opacity:0; pointer-events:none; }
  #rdtip { position:absolute; left:50%; top:calc(max(14px, env(safe-area-inset-top)) + 86px); transform:translateX(-50%); max-width:min(560px, 92vw); padding:6px 16px; border-radius:16px; background:rgba(10,14,24,.72); border:1px solid rgba(233,200,126,.4); font:500 13px 'Noto Sans KR'; color:#f0e6cf; text-align:center; pointer-events:none; opacity:0; transition:opacity .4s; }
  #rdtip.on { opacity:1; } #rdtip b { color:#ffd36a; border:1px solid rgba(233,200,126,.6); border-radius:4px; padding:0 5px; margin:0 2px; }
  body.cine #rdtip { opacity:0; }
  @media (max-width:560px){ #rdtip { top:calc(max(14px, env(safe-area-inset-top)) + 186px); } }
  @media (max-height:560px){ #rdboard .rc .art, #rdboard .rc canvas { height:84px; } #rdboard .rc .ds { display:none; } #rdboard .rc .nm { font-size:16px; padding-top:6px; } #rdboard .rc .go { margin:8px 12px 10px; padding:8px; } }
  #rdalert { position:fixed; left:50%; top:30%; transform:translate(-50%,-50%); z-index:21; text-align:center; pointer-events:none; opacity:0; transition:opacity .3s; }
  #rdalert.on { opacity:1; } #rdalert .a { font:900 clamp(20px, 4vw, 34px) 'Gowun Batang'; color:#fff; letter-spacing:.08em; text-shadow:0 0 18px var(--c, #ff4a4a), 0 3px 0 #000; }
  #rdalert .b { font:500 14px 'Noto Sans KR'; color:#f0e6cf; margin-top:4px; text-shadow:0 1px 3px #000; } #rdalert .n { font:900 46px 'Cinzel'; color:var(--c, #ff6a6a); text-shadow:0 0 16px var(--c, #ff6a6a), 0 3px 0 #000; }
  #rdcount { position:fixed; left:50%; top:42%; transform:translate(-50%,-50%); z-index:23; pointer-events:none; font:900 120px 'Cinzel'; color:#fff4d8; text-shadow:0 0 40px rgba(255,180,80,.8), 0 6px 0 #000; opacity:0; }
  #rdcount.pop { animation:rdpop .9s ease-out forwards; } #rdcount.go { font:900 clamp(40px, 9vw, 90px) 'Gowun Batang'; letter-spacing:.2em; color:#ffe08a; }
  @keyframes rdpop { 0% { opacity:0; transform:translate(-50%,-50%) scale(2.2); } 18% { opacity:1; transform:translate(-50%,-50%) scale(1); } 75% { opacity:1; } 100% { opacity:0; transform:translate(-50%,-50%) scale(.85); } }
  #rdtags { position:fixed; inset:0; pointer-events:none; z-index:8; display:none; } body.raid #rdtags { display:block; } body.cine #rdtags { opacity:0; }
  #rdtags .tg { position:absolute; transform:translate(-50%,-100%); text-align:center; white-space:nowrap; }
  #rdtags .tg .n { font:700 11px 'Noto Sans KR'; color:#b8e8ff; text-shadow:0 1px 2px #000, 0 0 4px rgba(0,0,0,.8); }
  #rdtags .tg .h { width:46px; height:4px; margin:2px auto 0; background:rgba(0,0,0,.6); border:1px solid rgba(0,0,0,.8); border-radius:2px; overflow:hidden; } #rdtags .tg .h b { display:block; height:100%; background:#5ae07a; }
  #rdtags .tg.down .n { color:#ff9a8a; } #rdtags .tg .rv { font:800 11px 'Noto Sans KR'; color:#ffe08a; display:none; } #rdtags .tg.down .rv { display:block; }
  #rdtags .bb { position:absolute; transform:translate(-50%,-100%); max-width:220px; padding:5px 10px; border-radius:12px; background:rgba(250,246,236,.95); color:#2a2010; font:700 12px 'Noto Sans KR'; box-shadow:0 3px 10px rgba(0,0,0,.4); white-space:normal; text-align:center; transition:opacity .4s; }
  #rdtags .bb::after { content:''; position:absolute; left:50%; bottom:-6px; margin-left:-6px; border:6px solid transparent; border-top-color:rgba(250,246,236,.95); border-bottom:0; }
  #ehp .d.rbot { font:800 12px 'Noto Sans KR'; color:#d8e6f2; opacity:.85; } #ehp .d.rhurt { font:800 13px 'Noto Sans KR'; color:#ff9a7a; }
  #rdveil { position:fixed; inset:0; pointer-events:none; z-index:7; opacity:0; transition:opacity .5s; }
  #rdveil.poison { opacity:1; background:radial-gradient(ellipse at center, transparent 50%, rgba(80,200,40,.45) 100%); }
  #rdveil.frost { opacity:1; background:radial-gradient(ellipse at center, transparent 35%, rgba(170,220,255,.55) 100%); }
  #rdflash { position:fixed; inset:0; pointer-events:none; z-index:24; background:#fff; opacity:0; }
  #rdflash.on { animation:rdfl 1.1s ease-out forwards; } @keyframes rdfl { 0% { opacity:.9; } 100% { opacity:0; } }
  .rdpanel { position:fixed; inset:0; z-index:29; display:flex; flex-direction:column; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:opacity .6s; padding:16px; }
  .rdpanel.on { opacity:1; pointer-events:auto; }
  #rdwipe { background:radial-gradient(ellipse at center, rgba(40,0,20,.55), rgba(0,0,0,.9)); }
  #rdwipe .a, #rdwin .a { font:700 12px 'Cinzel'; letter-spacing:.6em; color:#ff7a9a; } #rdwin .a { color:#ffd36a; }
  #rdwipe .b { font:900 clamp(34px,7vw,60px) 'Gowun Batang'; letter-spacing:.3em; color:#e8c0c8; text-shadow:0 0 24px rgba(200,40,80,.6); }
  .rdpanel .c { font:400 14px/1.7 'Noto Sans KR'; color:#d8c8c8; margin-top:8px; text-align:center; } .rdpanel .c b { color:#ffe9b0; }
  .rdpanel .bt { display:flex; gap:10px; margin-top:20px; flex-wrap:wrap; justify-content:center; }
  .rdpanel button { font:700 15px 'Gowun Batang'; letter-spacing:.14em; padding:11px 24px; border-radius:2px; cursor:pointer; color:#f0e6cf; background:rgba(255,255,255,.07); border:1px solid rgba(233,200,126,.5); }
  .rdpanel button.pri { color:#10131c; border:none; background:linear-gradient(180deg,#fff2c9,#e2b964 60%,#b88c3e); }
  #rdwin { background:radial-gradient(ellipse at center, rgba(40,30,8,.6), rgba(0,0,0,.88)); }
  #rdwin .b { font:900 clamp(30px,6vw,52px) 'Gowun Batang'; letter-spacing:.14em; background:linear-gradient(180deg,#fff7df 10%,#e9c87e 60%,#a07a38); -webkit-background-clip:text; background-clip:text; color:transparent; filter:drop-shadow(0 3px 10px rgba(0,0,0,.8)); }
  #rdwin .loot { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-top:14px; max-width:min(720px, 94vw); max-height:44vh; overflow:auto; }
  #rdwin .it { min-width:150px; padding:8px 12px; border-radius:4px; background:rgba(10,14,24,.85); border:1px solid var(--c, rgba(233,200,126,.4)); text-align:left; animation:rdin .45s ease-out backwards; }
  #rdwin .it .i { font-size:20px; } #rdwin .it .n { font:700 13px 'Gowun Batang'; color:var(--c, #fff3d6); } #rdwin .it .s { font:500 11px 'Noto Sans KR'; color:#b8b0a0; }
  #rdwin .it.first { border-color:#ffd36a; box-shadow:0 0 14px rgba(255,210,100,.35); }
  @keyframes rdin { from { opacity:0; transform:translateY(12px) scale(.9); } }
  @media (max-height:520px){ #rdwin .loot { max-height:34vh; } .rdpanel .bt { margin-top:10px; } }
`;
document.head.appendChild(css);
const board = X.mk('div', 'rdboard', '');
const partyEl = X.mk('div', 'rdparty', '', X.hud);
const hudEl = X.mk('div', 'rdhud', '<span class="ph"></span><span class="tm">0:00</span><span class="en"></span>', X.hud);
const alertEl = X.mk('div', 'rdalert', '<div class="n"></div><div class="a"></div><div class="b"></div>');
const countEl = X.mk('div', 'rdcount', '');
const tagsEl = X.mk('div', 'rdtags', '');
const veilEl = X.mk('div', 'rdveil', '');
const flashEl = X.mk('div', 'rdflash', '');
const wipeEl = X.mk('div', 'rdwipe', ''); wipeEl.className = 'rdpanel';
const winEl = X.mk('div', 'rdwin', ''); winEl.className = 'rdpanel';
const tipEl = X.mk('div', 'rdtip', '', X.hud);
let alertT = 0, tipT = 0;
function tip(html, dur = 4.5){ tipEl.innerHTML = html; tipEl.classList.add('on'); tipT = dur; }
function alertMsg(a, b, col = '#ff4a4a', dur = 2.4, n = ''){ alertEl.style.setProperty('--c', col); alertEl.querySelector('.a').textContent = a; alertEl.querySelector('.b').textContent = b || ''; alertEl.querySelector('.n').textContent = n; alertEl.classList.add('on'); alertT = dur; }
function countPop(text, go){ countEl.textContent = text; countEl.classList.toggle('go', !!go); countEl.classList.remove('pop'); void countEl.offsetWidth; countEl.classList.add('pop'); }
function flash(){ flashEl.classList.remove('on'); void flashEl.offsetWidth; flashEl.classList.add('on'); }

// ───────────────────────── 레이드 상태 · 타이머 ─────────────────────────
let RS = null;              // 진행 중인 레이드 { id, r, m, phase, t, boss, B, bp, ... }
const TM = [];              // 레이드 타이머 (게임 시간 · 히트스톱에 같이 느려져요)
const after = (s, fn) => { TM.push({ t: s, fn }); };
const live = e => e && X.ENEMIES.includes(e) && e.state !== 'dying';

// ───────────────────────── 위험 지대 (텔레그래프 → 발동) ─────────────────────────
// h = { k: 'c' 원 | 'r' 띠 | 's' 부채꼴 | 'pool' 장판, x, z, r, w, len, ry, span, T, dmg, kb, fire(h), upd(h, dt), life, tick(h, dt), end(h) }
const HZ = [];
let hzN = 0;
function hz(o){
  const h = Object.assign({ t: 0, T: 1, dmg: 0, kb: 6, id: ++hzN, fired: false }, o);
  if (!h.noTele){ if (h.k === 'c') h.tele = X.telegraph(h.x, h.z, h.r); else if (h.k === 'r') h.tele = X.teleRect(h.x, h.z, h.w, h.len, h.ry); else if (h.k === 's') h.tele = X.telegraph(h.x, h.z, h.r, h.ry, h.span); }
  HZ.push(h); if (h.k !== 'pool') botsAlert(h); return h;
}
function inHz(h, x, z, m = 0.3){
  if (h.k === 'c' || h.k === 'pool') return Math.hypot(x - h.x, z - h.z) < h.r + m;
  if (h.k === 'r'){ const dx = x - h.x, dz = z - h.z, s = Math.sin(h.ry), c = Math.cos(h.ry), al = dx * s + dz * c, sd = dx * c - dz * s; return al > -m && al < h.len + m && Math.abs(sd) < h.w / 2 + m; }
  if (h.k === 's'){ const d = Math.hypot(x - h.x, z - h.z); if (d > h.r + m) return false; if (d < 1.2) return true; return Math.abs(angDiff(Math.atan2(x - h.x, z - h.z), h.ry)) < h.span / 2 + m / d; }
  return false;
}
function rmHz(h){ X.rmTele(h); const i = HZ.indexOf(h); if (i >= 0) HZ.splice(i, 1); if (h.end) h.end(h); }
function clearHz(keepPools){ for (let i = HZ.length - 1; i >= 0; i--){ const h = HZ[i]; if (keepPools && h.k === 'pool') continue; X.rmTele(h); if (h.end) h.end(h); HZ.splice(i, 1); } }
function hitIn(h){ for (const u of UNITS) if (alive(u) && inHz(h, u.pos.x, u.pos.z, 0.2)) hurt(u, h.dmg, h.ox ?? h.x, h.oz ?? h.z, h.kb, h); }
function updHZ(dt){
  for (let i = HZ.length - 1; i >= 0; i--){
    const h = HZ[i]; h.t += dt;
    if (h.upd) h.upd(h, dt);
    if (!h.fired){
      if (h.tele){ if (h.k === 'r' || h.k === 's'){ h.tele.position.set(h.x, 0.09, h.z); h.tele.rotation.y = h.ry; } X.teleUpd(h.tele, Math.min(1, h.t / h.T), dt); }
      if (h.t >= h.T){ h.fired = true; X.rmTele(h); if (h.dmg) hitIn(h); if (h.fire) h.fire(h); if (!h.life){ HZ.splice(i, 1); if (h.end) h.end(h); continue; } h.t = 0; }
    } else { if (h.tick) h.tick(h, dt); if (h.t >= h.life){ HZ.splice(i, 1); if (h.end) h.end(h); } }
  }
}
// 장판 (독 · 서리) — 들어가 있으면 0.5초마다 피해
function pool(x, z, r, life, dps, kind = 'poison'){
  const m = new THREE.Mesh(geo('poolG', () => new THREE.CircleGeometry(1, 40).rotateX(-HPI)), poolMat(kind)); m.position.set(x, 0.05 + R() * 0.01, z); m.scale.setScalar(0.01); m.renderOrder = 2; FXG.add(m);
  const h = hz({ k: 'pool', x, z, r, T: 0, life, noTele: true, mesh: m, kind, dps, acc: {},
    tick(h, dt){ const k = Math.min(1, h.t / 0.35), out = h.life - h.t < 1.2 ? Math.max(0, (h.life - h.t) / 1.2) : 1; m.scale.setScalar(h.r * ease(k)); m.material.uniforms.uA.value = out; m.material.uniforms.uT.value += dt;
      if (R() < dt * (kind === 'poison' ? 4 : 2) * h.r) X.burst(new V3(h.x + rr(-h.r, h.r) * 0.7, 0.15, h.z + rr(-h.r, h.r) * 0.7), kind === 'poison' ? 0x9aff4a : 0xcff4ff, 1, 0.4, 0.22, 0.7, kind === 'poison' ? 0.5 : -0.5, 0.6);
      for (const u of UNITS){ if (!alive(u) || Math.hypot(u.pos.x - h.x, u.pos.z - h.z) > h.r * ease(k) || (u.me ? X.PY() > 0.6 : u.y > 0.6)) continue; const a = (h.acc[u.id] = (h.acc[u.id] || 0) + dt); if (a >= 0.5){ h.acc[u.id] = 0; dot(u, h.dps * 0.5, kind); } } },
    end(h){ FXG.remove(m); m.material.dispose(); } });
  h.fired = true; return h;
}
function dot(u, v, kind){
  v = Math.round(v * (RS ? RS.dmgMul : 1));
  if (u.me){ if (X.dead) return; X.hp = Math.max(0, X.hp - v); X.dmgNum(new V3(u.pos.x, X.PY() + 1.9, u.pos.z), '-' + v, 'dot'); veil(kind === 'poison' ? 'poison' : 'frost', 0.6); if (X.hp <= 0) X.die(); X.refreshHud(); }
  else { if (u.down) return; u.hp -= v; X.dmgNum(new V3(u.pos.x, 2.1, u.pos.z), '-' + v, 'rhurt'); if (u.hp <= 0) downBot(u); }
}
let veilT = 0;
function veil(k, t){ veilEl.className = k; veilT = Math.max(veilT, t); }
const poolMat = kind => { const m = mat('pool_' + kind, () => new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uA: { value: 1 }, uC: { value: new THREE.Color(kind === 'poison' ? 0x7aff3a : 0xbfefff) }, uD: { value: kind === 'poison' ? 1 : 0.3 } },
  vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `varying vec2 vU; uniform float uT, uA, uD; uniform vec3 uC;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    void main(){ vec2 p = vU - 0.5; float r = length(p) * 2.0, w = n(p * 6.0 + uT * 0.4 * uD) * 0.6 + n(p * 14.0 - uT * 0.8 * uD) * 0.4;
      float edge = smoothstep(1.0, 0.8 + w * 0.12, r), rim = smoothstep(0.62, 0.95, r) * edge, bub = smoothstep(0.78, 0.86, n(p * 22.0 + vec2(0.0, uT * 0.6 * uD)));
      vec3 c = mix(uC * 0.25, uC * 0.9, w) + rim * uC * 0.7 + bub * uC * 0.6 * uD;
      gl_FragColor = vec4(c, edge * uA * (0.6 + 0.3 * w)); }`,
  transparent: true, depthWrite: false })); const c = m.clone(); c.uniforms.uT = { value: R() * 10 }; c.uniforms.uA = { value: 1 }; return c; };

// ── 충격파 고리 (점프로 넘기 · 구르기로 통과) ──
const RINGS = [];
let ringN = 0;
const ringWallMat = col => mat('rwall' + col, () => addM(col, 0.95, gradTex([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']])));
function ringWave(x, z, o = {}){
  const col = o.col ?? 0xffa040, g = new THREE.Group(); g.position.set(x, 0, z); FXG.add(g);
  const wall = mesh(geo('rwallG', () => new THREE.CylinderGeometry(1, 1, 1, 72, 1, true).translate(0, 0.5, 0)), ringWallMat(col), g, 0, 0, 0, false);
  const fl = mesh(geo('rfloorG', () => new THREE.RingGeometry(0.9, 1, 72).rotateX(-HPI)), addM(col, 0.9), g, 0, 0.06, 0, false);
  const w = { id: ++ringN, g, wall, fl, x, z, r: o.r0 || 1.5, v: o.v || 8.5, R: o.R || 30, h: o.h || 0.8, dmg: o.dmg || 20, col, hit: new Set() };
  wall.scale.set(w.r, w.h, w.r); fl.scale.setScalar(w.r); RINGS.push(w); return w;
}
function updRings(dt){
  for (let i = RINGS.length - 1; i >= 0; i--){
    const w = RINGS[i]; w.r += w.v * dt; const k = w.r / w.R, a = k > 0.8 ? Math.max(0, (1 - k) / 0.2) : 1;
    w.wall.scale.set(w.r, w.h * (0.85 + Math.sin(G.time * 30) * 0.15), w.r); w.fl.scale.setScalar(w.r); w.wall.material.opacity = 0.95 * a; w.fl.material.opacity = 0.9 * a;
    if (R() < dt * 30){ const an = R() * TAU; X.burst(new V3(w.x + Math.cos(an) * w.r, 0.2, w.z + Math.sin(an) * w.r), w.col, 2, 2, 0.28, 0.5, -4, 2.5); }
    for (const u of UNITS){ if (!alive(u) || w.hit.has(u.id)) continue; const d = Math.hypot(u.pos.x - w.x, u.pos.z - w.z);
      if (Math.abs(d - w.r) < 0.5){ const air = u.me ? X.PY() > 0.45 : u.y > 0.45; if (!air && hurt(u, w.dmg, w.x, w.z, 9)) w.hit.add(u.id); } }
    if (k >= 1){ FXG.remove(w.g); w.fl.material.dispose(); RINGS.splice(i, 1); }
  }
}

// ── 날아가는 것 (포물선) · 떨어지는 것 ──
const ARCS = [];
function lob(obj, from, to, T, hgt, land){ obj.position.copy(from); FXG.add(obj); ARCS.push({ obj, from: from.clone(), to: to.clone(), T, t: 0, hgt, land }); }
function updArcs(dt){
  for (let i = ARCS.length - 1; i >= 0; i--){ const a = ARCS[i]; a.t += dt; const k = Math.min(1, a.t / a.T);
    a.obj.position.lerpVectors(a.from, a.to, k); a.obj.position.y += Math.sin(k * PI) * a.hgt; a.obj.rotation.x += dt * 6; a.obj.rotation.z += dt * 4;
    if (k >= 1){ ARCS.splice(i, 1); FXG.remove(a.obj); if (a.land) a.land(a); } }
}
// 바위 · 수정 · 얼음 가시 (공용 지오메트리)
const ROCKM = () => mat('rockfx', () => std({ color: 0x7a6656, flatShading: true, roughness: 0.95 }));
const rockMesh = (s, m = ROCKM()) => { const o = new THREE.Mesh(geo('rockfxG' + (s > 1.2 ? 'b' : ''), () => rockGeo(1, s > 1.2 ? 1 : 0, 0.28, s > 1.2 ? 7 : 3)), m); o.scale.setScalar(s); o.castShadow = true; return o; };
// 잔해 (잠시 엄폐물 · 충돌체)
const RUBBLE = [];
function rubble(x, z, s, life = 14, m){
  if (!RS) return; const o = rockMesh(s, m); o.position.set(x, s * 0.35, z); o.rotation.set(R() * 3, R() * 3, R() * 3); FXG.add(o);
  const c = { t: 'c', x, z, r: s * 0.85 }; RS.ctx.SCOL.push(c); RUBBLE.push({ o, c, t: 0, life, s });
}
function updRubble(dt){
  for (let i = RUBBLE.length - 1; i >= 0; i--){ const r = RUBBLE[i]; r.t += dt; if (r.t > r.life - 1.2) r.o.position.y = r.s * 0.35 - (r.t - (r.life - 1.2)) * r.s * 0.9;
    if (r.t >= r.life){ FXG.remove(r.o); const j = RS ? RS.ctx.SCOL.indexOf(r.c) : -1; if (j >= 0) RS.ctx.SCOL.splice(j, 1); RUBBLE.splice(i, 1); } }
}
function fallRock(x, z, o = {}){
  const s = o.s || rr(0.9, 1.3), rk = rockMesh(s, o.m); rk.position.set(x, 22, z); FXG.add(rk); const T = o.T || 1.5;
  return hz({ k: 'c', x, z, r: o.r || 2.1, T, dmg: o.dmg || 30, kb: 8,
    upd(h){ const k = Math.min(1, h.t / h.T); rk.position.y = 22 - 22 * k * k + s * 0.35 * k; rk.rotation.x += 0.05; },
    fire(h){ FXG.remove(rk); X.shockwave(x, 0.12, z, h.r + 0.6, o.col || 0xc8a070, 0.45); X.burst(new V3(x, 0.4, z), o.dust || 0x9a8a70, 20, 4.5, 0.3, 0.7, -8, 3); G.shake = Math.max(G.shake, 0.45); X.sfx('stomp'); if (o.stay !== false) rubble(x, z, s, o.life || 12, o.m); } });
}
const SPK_M = () => mat('icespk', () => std({ color: 0xcff4ff, emissive: 0x4ab8ff, emissiveIntensity: 0.35, roughness: 0.1, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.92 }));
function iceSpike(x, z, T = 0.9, dmg = 30, r = 1.35){
  return hz({ k: 'c', x, z, r, T, dmg, kb: 5,
    fire(h){ const g = new THREE.Group(); g.position.set(x, 0, z); FXG.add(g);
      for (let i = 0; i < 4; i++){ const c = mesh(geo('spkG', () => new THREE.ConeGeometry(0.42, 2.8, 5).translate(0, 1.4, 0)), SPK_M(), g, rr(-0.5, 0.5), 0, rr(-0.5, 0.5)); c.rotation.set(rr(-0.4, 0.4), R() * 6, rr(-0.4, 0.4)); c.scale.setScalar(rr(0.6, 1.15) * r / 1.35); }
      g.scale.y = 0.01; X.burst(new V3(x, 0.4, z), 0xdff8ff, 14, 4, 0.25, 0.6, -6, 3); X.sfx('shard');
      SPIKES.push({ g, t: 0 }); } });
}
const SPIKES = [];
function updSpikes(dt){ for (let i = SPIKES.length - 1; i >= 0; i--){ const s = SPIKES[i]; s.t += dt; s.g.scale.y = s.t < 0.12 ? Math.max(0.01, s.t / 0.12) : s.t > 1.3 ? Math.max(0.01, 1 - (s.t - 1.3) / 0.4) : 1; if (s.t > 1.7){ FXG.remove(s.g); SPIKES.splice(i, 1); } } }

// ───────────────────────── 파티 (플레이어 + 봇) ─────────────────────────
const ME = { me: true, id: 'me', role: 'me', pos: X.player.pos };
const UNITS = [ME], BOTS = [];
const alive = u => u.me ? !X.dead : !u.down;
let RG = null, FXG = null;
// 파티원 피해 (플레이어는 구르기 무적 · 점프 판정, 봇은 구르기 무적 · 탱커 경감)
function hurt(u, dmg, fx, fz, kb = 6, o = {}){
  dmg *= RS ? RS.dmgMul : 1;
  if (u.me){ if (X.dead || (o.ground && X.PY() > 0.42)) return false; const h0 = X.hp; X.hurtPlayer(dmg, new V3(fx, 0, fz), kb); return X.hp < h0; }
  if (u.down || u.inv > 0 || (o.ground && u.y > 0.42)) return false;
  const v = Math.round(dmg * rr(0.9, 1.1) * (u.role === 'tank' ? 0.62 : 1)); u.hp -= v; u.hurtT = 0.4;
  X.dmgNum(new V3(u.pos.x, 2.1, u.pos.z), '-' + v, 'rhurt');
  const dx = u.pos.x - fx, dz = u.pos.z - fz, d = Math.hypot(dx, dz) || 1; u.kx += dx / d * kb * 0.8; u.kz += dz / d * kb * 0.8;
  if (u.hp <= 0) downBot(u); else if (R() < 0.15) botSay(u, 'hurt');
  return true;
}   // 레이드 그룹 (봇 · 이펙트) — X.SW 안
const PZ = o => G.pose(o);
function bowPose(u){ return PZ({ lax: -1.55, laz: 0.05, le: 0, rax: -1.45, raz: 0.15, re: -0.5 - 1.6 * u, sp: 0.1, llx: -0.25, rlx: 0.25 }); }
function staffPose(k){ const u = ease(Math.min(1, k / 0.4)); return PZ({ rax: -0.6 - 1.0 * u, re: -0.9 + 0.8 * u, raz: 0.1, lax: -0.9 * u, laz: 0.4, le: -0.6, sp: 0.15 * u, llx: -0.3, rlx: 0.2 }); }
function atkPose(u){
  const a = u.atk, k = Math.min(1, a.t / a.dur);
  if (u.job === 'archer') return bowPose(k < 0.45 ? k / 0.45 : Math.max(0, 1 - (k - 0.45) * 3));
  if (u.job === 'mage') return staffPose(k);
  const q = ease(Math.min(1, k / 0.55));
  if (a.i === 0) return PZ({ rax: -1.5 - 0.5 * (1 - q), raz: -1.5 + 2.2 * q, re: -0.25, lax: -0.4, laz: 0.4, sp: 0.15, llx: -0.5, rlx: 0.3, lk: 0.3, hd: 0.1 });
  if (a.i === 1) return PZ({ rax: -1.3, raz: 0.8 - 2.4 * q, re: -0.2, lax: -0.2, laz: 0.5, sp: 0.2, llx: 0.3, rlx: -0.5, rk: 0.3, hd: 0.1 });
  return PZ({ rax: -1.4, raz: -1.55, re: 0, lax: -0.2, laz: 1.4, sp: 0.25, hy: 0.74, lk: 0.6, rk: 0.6, llx: -0.4, rlx: 0.3, llz: 0.3, rlz: -0.3 });
}
const ROLLP = k => PZ({ hrx: ease(k) * TAU, hy: 0.86 - Math.sin(k * PI) * 0.45, llx: -2.2, rlx: -2.2, lk: 2.4, rk: 2.4, lax: -1.4, rax: -1.4, le: -1.4, re: -1.4, sp: 0.6, hd: 0.5 });
const DOWNP = PZ({ hy: 0.21, hrx: -HPI, laz: 0.6, raz: -0.6, hd: 0.3, llz: 0.15, rlz: -0.15 });
function makeBot(def, i){
  let av; try { av = X.makeAvatar({ job: def.job, asc: S.lv >= 14, look: def.look, scale: 0.88 }); } catch (e){ av = X.makeAvatar({ job: def.job, look: {}, scale: 0.88 }); }
  const f = av.fig, lv = (RS ? RS.r.lv : S.lv) + 1, max = Math.round((90 + lv * 26) * def.hpK * (RS ? RS.botHpK : 1));
  RG.add(f.root); f.mesh.castShadow = true;
  const u = { def, id: def.id, name: def.name, job: def.job, role: def.role, av, fig: f, root: f.root, pos: f.root.position, hp: max, max, down: false, inv: 0, y: 0, vy: 0, kx: 0, kz: 0, ry: 0,
    atkT: rr(0.4, 1.2), atk: null, roll: null, cast: null, mv: 0, gph: 0, sayT: rr(3, 6), alerts: [], esc: null, tgt: null, slot: i % 2 ? 0.85 : -0.85, side: i % 2 ? 1 : -1, rv: 0, healT: rr(5, 8), tauntT: rr(2, 5), goal: new V3(), goalT: 0, hurtT: 0, pull: null, cheer: 0, combo: 0, spd: def.role === 'tank' ? 5.4 : 6.0 };
  const tg = document.createElement('div'); tg.className = 'tg'; tg.innerHTML = `<div class="n">${def.name}</div><div class="h"><b></b></div><div class="rv">💀 쓰러짐</div>`; tagsEl.appendChild(tg); u.tag = tg;
  const bb = document.createElement('div'); bb.className = 'bb'; bb.style.opacity = 0; tagsEl.appendChild(bb); u.bub = bb; u.bubT = 0;
  return u;
}
function botSay(u, kind, force){
  if (!u || u.me) return; const L = u.def.say[kind]; if (!L || (!force && u.sayT > 0)) return;
  u.bub.textContent = pick(L); u.bub.style.opacity = 1; u.bubT = 3.2; u.sayT = rr(6, 11);
}
function downBot(u){
  if (u.down) return; u.down = true; u.hp = 0; u.atk = u.roll = u.cast = u.esc = null; u.rv = 0; u.alerts.length = 0; u.y = 0; u.vy = 0;
  X.sfx('die'); X.burst(new V3(u.pos.x, 0.8, u.pos.z), 0xff6a6a, 18, 3, 0.25, 0.7, -3, 2); botSay(u, 'down', true);
  if (!u.ring){ u.ring = new THREE.Mesh(geo('rvRing', () => new THREE.RingGeometry(2.25, 2.45, 48).rotateX(-HPI)), addM(0xffe08a, 0.7)); u.ring.renderOrder = 2; RG.add(u.ring); u.rfill = new THREE.Mesh(geo('rvFill', () => new THREE.CircleGeometry(1, 40).rotateX(-HPI)), addM(0xffe08a, 0.22)); RG.add(u.rfill); }
  u.ring.visible = u.rfill.visible = true; u.rfill.scale.setScalar(0.01);
  if (RS && RS.phase === 'fight' && !RS.downHint){ RS.downHint = true; tip(`쓰러진 파티원 곁(<b>노란 원</b>)에 서 있으면 <b>3초</b> 만에 일으켜요`, 5); }
}
function reviveBot(u, by){
  u.down = false; u.hp = Math.round(u.max * 0.45); u.rv = 0; u.inv = 1.2; if (u.ring){ u.ring.visible = u.rfill.visible = false; }
  X.sfx('level'); X.burst(new V3(u.pos.x, 0.6, u.pos.z), 0xffe08a, 40, 4, 0.3, 1.0, 1, 3); X.shockwave(u.pos.x, 0.12, u.pos.z, 3.2, 0xffe08a, 0.5);
  botSay(u, 'up', true); if (by && by.me && RS) RS.revives = (RS.revives || 0) + 1;
}
// 봇 이펙트: 검기 · 화살 · 마탄 (전투 레이어, 지면 0)
function arcG2(r0, r1, span, seg = 20){
  const P = [], C = [], a0 = -span / 2;
  for (let i = 0; i < seg; i++){ const a = a0 + i / seg * span, b = a0 + (i + 1) / seg * span, k0 = i / seg, k1 = (i + 1) / seg, p = (r, q) => [Math.sin(q) * r, 0, Math.cos(q) * r];
    const v = [p(r0, a), p(r1, a), p(r1, b), p(r0, a), p(r1, b), p(r0, b)], kk = [k0 * 0.4, k0, k1, k0 * 0.4, k1, k1 * 0.4]; v.forEach((q, j) => { P.push(...q); C.push(kk[j], kk[j], kk[j]); }); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); return g;
}
const TRAILS = [], SHOTS = [];
function swingFx(u, big){
  let o = TRAILS.find(t => !t.on);
  if (!o){ if (TRAILS.length > 8) return; const m = new THREE.Mesh(geo('bArc', () => arcG2(0.5, 2.1, 2.4)), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); m.frustumCulled = false; o = { m }; TRAILS.push(o); }
  if (o.m.parent !== RG) RG.add(o.m);
  o.on = true; o.t = 0; o.m.visible = true; o.m.material.color.set(u.av.color || 0x9ff6ff); o.m.position.set(u.pos.x, u.y + (big ? 0.7 : 1.05), u.pos.z); o.m.rotation.set(0, u.ry, 0); o.m.rotateZ(u.atk && u.atk.i === 1 ? -0.5 : 0.4); o.m.scale.setScalar(big ? 1.3 : 1); o.life = 0.2;
}
const ARROW_G = () => geo('arrowG', () => { const a = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4).rotateX(HPI), b = new THREE.ConeGeometry(0.05, 0.16, 5).rotateX(HPI).translate(0, 0, 0.45); return G.mergeGeos([a, b]); });
function shotFx(u, e, kind, onHit){
  let o = SHOTS.find(s => !s.on && s.kind === kind);
  if (!o){ if (SHOTS.length > 14){ onHit(); return; } const g = new THREE.Group(); if (kind === 'arrow') mesh(ARROW_G(), basic(0xeaffd8), g, 0, 0, 0, false); const gl = X.glowSprite(0xffffff, kind === 'orb' ? 1.1 : 0.55, 0.85); g.add(gl); o = { g, gl, kind }; SHOTS.push(o); }
  if (o.g.parent !== RG) RG.add(o.g);
  o.gl.material.color.set(u.av.color || 0xffffff); o.on = true; o.t = 0; o.g.visible = true; o.col = u.av.color || 0xffffff;
  o.from = new V3(u.pos.x + Math.sin(u.ry) * 0.5, u.y + 1.35, u.pos.z + Math.cos(u.ry) * 0.5); o.e = e; o.T = Math.max(0.12, Math.hypot(e.pos.x - u.pos.x, e.pos.z - u.pos.z) / (kind === 'orb' ? 22 : 34)); o.onHit = onHit;
}
const _to = new V3();
function updBotFx(dt){
  for (const o of TRAILS){ if (!o.on) continue; o.t += dt; const k = o.t / o.life; o.m.material.opacity = Math.max(0, 1 - k); o.m.scale.multiplyScalar(1 + dt * 1.5); if (k >= 1){ o.on = false; o.m.visible = false; } }
  for (const o of SHOTS){ if (!o.on) continue; o.t += dt; const e = o.e, k = Math.min(1, o.t / o.T);
    _to.set(e.pos.x, e.pos.y + (e.cfg.top || 1) * (e.boss ? 0.5 : 0.45), e.pos.z); o.g.position.lerpVectors(o.from, _to, k); o.g.position.y += Math.sin(k * PI) * (o.kind === 'arrow' ? 0.3 : 0.6); o.g.lookAt(_to);
    if (k >= 1){ o.on = false; o.g.visible = false; o.onHit(); } }
}
// 봇이 몬스터 · 보스를 때려요 (보스는 페이즈 경계에서 멈춰요)
function botHit(e, dmg, u, crit){
  if (!live(e) || e.state === 'spawn' || e.under) return;
  e.hp -= dmg; e.flash = 1;
  const top = e.boss ? e.cfg.top * 0.72 : e.cfg.top + 0.2;
  X.dmgNum(new V3(e.pos.x + rr(-0.5, 0.5), e.pos.y + top, e.pos.z), Math.round(dmg) + (crit ? '!' : ''), 'rbot');
  X.burst(new V3(e.pos.x, e.pos.y + (e.boss ? e.cfg.top * 0.4 : 0.6) + (e.boss ? 0 : e.fly), e.pos.z), crit ? 0xffe08a : 0xffffff, crit ? 8 : 4, 3, 0.14, 0.35, -5, 1);
  if (RS && e === RS.boss) guardBoss(e); else if (e.hp <= 0) X.killEnemy(e);
}
function botDmgFor(u, e){
  const crit = R() < 0.15, k = crit ? 1.7 : 1;
  if (RS && e === RS.boss) return [e.max / u.def.solo * (u.job === 'rogue' ? 0.75 : u.job === 'mage' ? 1.35 : u.job === 'archer' ? 1.05 : 1.15) * rr(0.85, 1.15) * k, crit];
  return [e.max * rr(0.12, 0.2) * k, crit];
}

// ── 봇 위험 감지: 위험 지대가 생기면 반응 시간 · 실수 확률을 정해요 (대부분 피하지만 가끔 맞아요) ──
function botsAlert(h){
  for (const u of BOTS){ if (u.down || !inHz(h, u.pos.x, u.pos.z, 1.5)) continue;
    u.alerts.push({ h, at: rr(0.12, 0.4) + (u.role === 'tank' ? 0.12 : 0), fail: R() < (h.hard ? 0.3 : u.role === 'tank' ? 0.17 : 0.1) }); }
}
function escapeDir(h, x, z){
  if (h.k === 'c' || h.k === 'pool'){ let dx = x - h.x, dz = z - h.z, d = Math.hypot(dx, dz); if (d < 0.1){ const a = R() * TAU; dx = Math.cos(a); dz = Math.sin(a); d = 1; } if (RS){ const hx = RS.home[0] - x, hz2 = RS.home[1] - z, hd = Math.hypot(hx, hz2); if (hd > RS.rad - 4){ dx = dx / d + hx / hd * 0.8; dz = dz / d + hz2 / hd * 0.8; d = Math.hypot(dx, dz); return [dx / d, dz / d, h.r + 1.4]; } } return [dx / d, dz / d, h.r + 1.3 - Math.hypot(x - h.x, z - h.z)]; }
  if (h.k === 'r'){ const s = Math.sin(h.ry), c = Math.cos(h.ry), dx = x - h.x, dz = z - h.z, sd = dx * c - dz * s, sg = Math.abs(sd) < 0.2 ? (R() < 0.5 ? 1 : -1) : Math.sign(sd); return [c * sg, -s * sg, h.w / 2 + 1.3 - Math.abs(sd)]; }
  if (h.k === 's'){ const dx = x - h.x, dz = z - h.z, d = Math.hypot(dx, dz) || 1, a = Math.atan2(dx, dz), off = angDiff(a, h.ry), sideNeed = (h.span / 2 - Math.abs(off)) * d + 1.2, outNeed = h.r + 1.3 - d;
    if (h.span < PI && sideNeed < outNeed){ const pa = a + (off >= 0 ? 1 : -1) * HPI; return [Math.sin(pa), Math.cos(pa), sideNeed]; } return [dx / d, dz / d, outNeed]; }
  return [0, 0, 0];
}
function dodge(u, h){
  const [dx, dz, need] = escapeDir(h, u.pos.x, u.pos.z); if (need <= 0) return;
  if (need < 4.4 && !u.roll){ u.roll = { t: 0, dir: Math.atan2(dx, dz) }; u.inv = 0.42; u.atk = null; if (u.cast && u.cast.k !== 'res') u.cast = null; }
  else u.esc = { x: u.pos.x + dx * (need + 0.6), z: u.pos.z + dz * (need + 0.6), t: 2.4 };
}
function stepTo(u, x, z, sp, dt){
  const dx = x - u.pos.x, dz = z - u.pos.z, d = Math.hypot(dx, dz); if (d < 0.35){ u.mv = 0; return true; }
  const s = Math.min(d, sp * dt); let nx = u.pos.x + dx / d * s, nz = u.pos.z + dz / d * s;
  for (const h of HZ) if (h.k === 'pool' && Math.hypot(nx - h.x, nz - h.z) < h.r + 0.4 && Math.hypot(u.pos.x - h.x, u.pos.z - h.z) >= h.r + 0.25){ nx = u.pos.x - dz / d * u.side * s; nz = u.pos.z + dx / d * u.side * s; break; }
  u.pos.x = nx; u.pos.z = nz; u.want = Math.atan2(dx, dz); u.mv = sp; return false;
}
const _g = new V3();
function slotPos(u, e, out){
  const b = RS.boss;
  if (e && e !== b){ const dx = u.pos.x - e.pos.x, dz = u.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1, want = u.role === 'ranged' || u.role === 'heal' ? 8.5 : e.cfg.rad + 1.1; return out.set(e.pos.x + dx / d * want, 0, e.pos.z + dz / d * want); }
  if (!live(b) || (b.under && RS.flying)) return out.set(RS.home[0] + Math.sin(u.slot * 2.6 + 0.6) * 7.5, 0, RS.home[1] + Math.cos(u.slot * 2.6 + 0.6) * 7.5);
  const bf = b.g.rotation.y, br = b.cfg.rad, bx = b.pos.x, bz = b.pos.z;
  if (u.role === 'tank') return out.set(bx + Math.sin(bf) * (br + 1.5), 0, bz + Math.cos(bf) * (br + 1.5));
  if (u.role === 'melee'){ const a = bf + (RS.id === 'cryos' ? HPI * 1.2 : PI * 0.78) * u.side; return out.set(bx + Math.sin(a) * (br + 1.3), 0, bz + Math.cos(a) * (br + 1.3)); }
  const toC = Math.atan2(RS.home[0] - bx, RS.home[1] - bz), a = toC + u.slot, dd = u.role === 'heal' ? 11.5 : 10;
  return out.set(bx + Math.sin(a) * dd, 0, bz + Math.cos(a) * dd);
}
function pickTgt(u){
  const b = RS.boss, bossOk = live(b) && !b.under && b.state !== 'spawn';
  let best = null, bd = 1e9;
  for (const e of X.ENEMIES){ if (e === b || !live(e) || e.state === 'spawn' || e.under) continue; const d = Math.hypot(e.pos.x - ME.pos.x, e.pos.z - ME.pos.z) * 0.6 + Math.hypot(e.pos.x - u.pos.x, e.pos.z - u.pos.z) + (e.pylon ? -30 : 0); if (d < bd){ bd = d; best = e; } }
  if (u.role === 'tank') return bossOk ? b : best;
  if (best && (u.role !== 'heal' || !bossOk || best.pylon)){ if (!RS.addSaid && (u.role === 'ranged' || u.role === 'melee')){ RS.addSaid = true; botSay(u, 'adds', true); } return best; }
  return bossOk ? b : best;
}
const needHeal = () => UNITS.some(o => alive(o) && (o.me ? X.hp / X.D().maxHp : o.hp / o.max) < 0.72);
function doHeal(u){
  X.sfx('rune'); const d = X.D();
  for (const o of UNITS){ if (!alive(o)) continue;
    if (o.me){ const v = Math.round(d.maxHp * 0.17); X.heal(v); X.dmgNum(new V3(o.pos.x, X.PY() + 2.2, o.pos.z), '+' + v, 'heal'); }
    else { const v = Math.round(o.max * 0.3); o.hp = Math.min(o.max, o.hp + v); X.dmgNum(new V3(o.pos.x, 2.3, o.pos.z), '+' + v, 'heal'); }
    X.burst(new V3(o.pos.x, 0.5, o.pos.z), 0x7fffa8, 14, 1.6, 0.22, 1.0, 1.5, 2.5); }
  healRing(u.pos.x, u.pos.z);
}
const HRINGS = [];
function healRing(x, z){
  const m = new THREE.Mesh(geo('hrG', () => X.polarRing(1.6, 3.2, 64)), mat('hrM', () => X.ADDM(G.tex(G.runeStrip(1024, 128, 14, '#7fffa8', 0, 4), true, 1, 1), 0.9)).clone()); m.position.set(x, 0.07, z); RG.add(m); HRINGS.push({ m, t: 0 });
}
function taunt(u){
  const b = RS.boss; if (!live(b) || !RS.B) return;
  RS.B.taunt = { u, t: 6.5 }; botSay(u, 'taunt', true); X.sfx('clang');
  X.shockwave(u.pos.x, 0.15, u.pos.z, 4.2, 0xff5a3a, 0.5); X.dmgNum(new V3(b.pos.x, b.pos.y + b.cfg.top + 0.4, b.pos.z), '!', 'aggro');
}
function updBot(u, dt){
  const f = u.fig, t = G.time; let tp = null, k = 10;
  u.inv = Math.max(0, u.inv - dt); u.sayT -= dt; u.hurtT -= dt; u.atkT -= dt; u.healT -= dt; u.tauntT -= dt; u.cheer = Math.max(0, u.cheer - dt);
  if (u.bubT > 0){ u.bubT -= dt; if (u.bubT <= 0) u.bub.style.opacity = 0; }
  if (u.pull){ const p = u.pull; p.t += dt; const q = Math.min(1, p.t / p.T); u.pos.x = p.fx + (p.tx - p.fx) * ease(q); u.pos.z = p.fz + (p.tz - p.fz) * ease(q); if (q >= 1) u.pull = null; }
  if (Math.abs(u.kx) + Math.abs(u.kz) > 0.05){ u.pos.x += u.kx * dt; u.pos.z += u.kz * dt; const dd = Math.exp(-8 * dt); u.kx *= dd; u.kz *= dd; }
  if (u.y > 0 || u.vy > 0){ u.vy -= 24 * dt; u.y = Math.max(0, u.y + u.vy * dt); if (u.y === 0) u.vy = 0; }
  u.mv = 0;
  const ph = RS ? RS.phase : 'done';
  if (u.down){ updDown(u, dt); tp = DOWNP; k = 8; }
  else if (ph === 'intro' || ph === 'count' || ph === 'enter'){
    const fx = Math.sin(RS.face), fz = Math.cos(RS.face), sx = fz, sz = -fx, o = [[-2.2, -0.6], [2.2, -0.6], [-3.6, -2.2], [3.6, -2.2]][BOTS.indexOf(u)] || [0, -3];
    stepTo(u, ME.pos.x + sx * o[0] + fx * o[1], ME.pos.z + sz * o[0] + fz * o[1], 4.5, dt); u.want = RS.face;
  } else if (ph === 'victory' || ph === 'loot' || ph === 'done'){
    if (u.cheer <= 0 && R() < dt * 0.7){ u.cheer = 1.1; u.vy = 5.5; u.y = 0.01; } if (RS && RS.chest) u.want = Math.atan2(RS.chest.x - u.pos.x, RS.chest.z - u.pos.z);
  } else if (ph === 'fight'){
    // 위험 반응
    for (let i = u.alerts.length - 1; i >= 0; i--){ const a = u.alerts[i]; a.at -= dt; if (a.at > 0) continue; u.alerts.splice(i, 1); if (a.fail || a.h.fired || !HZ.includes(a.h)) continue; if (inHz(a.h, u.pos.x, u.pos.z, 0.9)) dodge(u, a.h); }
    if (!u.roll && !u.esc) for (const h of HZ){ if (h.k === 'pool' && inHz(h, u.pos.x, u.pos.z, 0.1)){ const [dx, dz, need] = escapeDir(h, u.pos.x, u.pos.z); u.esc = { x: u.pos.x + dx * (need + 0.4), z: u.pos.z + dz * (need + 0.4), t: 2 }; break; } }
    for (const w of RINGS){ if (u.y > 0 || w.hit.has(u.id)) continue; const gap = Math.hypot(u.pos.x - w.x, u.pos.z - w.z) - w.r; if (gap > 0 && gap < w.v * 0.22 + 0.5){ w.dec = w.dec || {}; if (w.dec[u.id] === undefined) w.dec[u.id] = R() < (u.role === 'tank' ? 0.8 : 0.9); if (w.dec[u.id]){ u.vy = 7.6; u.y = 0.01; } } }
    if (RS.storm && !u.roll){ const sp = RS.storm.spot(u); if (sp && Math.hypot(sp[0] - u.pos.x, sp[1] - u.pos.z) > 0.6 && (u.stormOk ??= R() < 0.9)) u.esc = { x: sp[0], z: sp[1], t: 0.5 }; }
    else u.stormOk = undefined;
    if (u.roll){ const r = u.roll; r.t += dt; const q = r.t / 0.42; u.pos.x += Math.sin(r.dir) * 11.5 * (1 - q * 0.6) * dt; u.pos.z += Math.cos(r.dir) * 11.5 * (1 - q * 0.6) * dt; u.want = r.dir; if (q >= 1) u.roll = null; tp = ROLLP(Math.min(1, q)); k = 30; }
    else if (u.esc){ const e = u.esc; e.t -= dt; if (stepTo(u, e.x, e.z, 7.4, dt) || e.t <= 0) u.esc = null; }
    else if (u.cast){
      const c = u.cast; c.t += dt;
      if (c.k === 'rev' || c.k === 'res'){ const o = c.o, ox = o.pos.x, oz = o.pos.z, d = Math.hypot(ox - u.pos.x, oz - u.pos.z);
        if ((c.k === 'rev' && !o.down) || (c.k === 'res' && !X.dead)){ u.cast = null; if (c.k === 'rev') o.revBy = null; }
        else if (d > 1.9){ stepTo(u, ox, oz, 7, dt); c.t = 0; }
        else { u.want = Math.atan2(ox - u.pos.x, oz - u.pos.z); if (R() < dt * 16) X.burst(new V3(ox + rr(-0.6, 0.6), 0.3, oz + rr(-0.6, 0.6)), 0xffe08a, 1, 0.6, 0.22, 0.9, 2, 1.6);
          if (c.k === 'res'){ RS.resK = Math.min(1, c.t / c.dur); if (c.t >= c.dur){ u.cast = null; resPlayer(u); } }
          else o.revBy = u; } }
      else if (c.t >= c.dur){ u.cast = null; if (c.k === 'heal') doHeal(u); }
    } else {
      // 힐 · 부활 · 도발
      if (u.role === 'heal' && u.healT <= 0 && needHeal()){ u.cast = { k: 'heal', t: 0, dur: 1.0 }; u.healT = rr(9.5, 12.5); botSay(u, 'heal'); u.atk = null; }
      const dn = BOTS.find(o => o.down && o !== u && (!o.revBy || o.revBy === u || o.revBy.down || !o.revBy.cast) && Math.hypot(o.pos.x - ME.pos.x, o.pos.z - ME.pos.z) > 3);
      if (!u.cast && dn && (u.role === 'heal' || !BOTS.some(o => o.role === 'heal' && !o.down)) && !HZ.some(h => !h.fired && inHz(h, dn.pos.x, dn.pos.z, 0.5))){ u.cast = { k: 'rev', o: dn, t: 0, dur: 5 }; dn.revBy = u; }
      if (u.role === 'tank' && u.tauntT <= 0 && live(RS.boss) && !RS.boss.under && Math.hypot(RS.boss.pos.x - u.pos.x, RS.boss.pos.z - u.pos.z) < RS.boss.cfg.rad + 6){ taunt(u); u.tauntT = rr(12, 16); }
      if (!u.cast){
        u.goalT -= dt; const e = u.tgt;
        if (u.goalT <= 0 || !live(e)){ u.goalT = 0.35; u.tgt = pickTgt(u); slotPos(u, u.tgt, u.goal); for (const h of HZ) if (h.k === 'pool' && inHz(h, u.goal.x, u.goal.z, 0.6)){ const [dx, dz, need] = escapeDir(h, u.goal.x, u.goal.z); u.goal.x += dx * (need + 0.6); u.goal.z += dz * (need + 0.6); } }
        const tg = u.tgt; if (!u.atk) stepTo(u, u.goal.x, u.goal.z, u.spd, dt);
        if (live(tg)){ const d = Math.hypot(tg.pos.x - u.pos.x, tg.pos.z - u.pos.z) - tg.cfg.rad, ranged = u.job === 'archer' || u.job === 'mage';
          if (u.mv < 0.2 || u.atk) u.want = Math.atan2(tg.pos.x - u.pos.x, tg.pos.z - u.pos.z);
          if (!u.atk && u.atkT <= 0 && (ranged ? d < 17 : d < 1.9) && !tg.under){ u.atk = { t: 0, dur: ranged ? (u.job === 'mage' ? 0.55 : 0.6) : (u.job === 'rogue' ? 0.36 : 0.45), i: u.combo = (u.combo + 1) % 3, hit: false, e: tg }; u.atkT = u.job === 'rogue' ? 0.58 : u.job === 'mage' ? 1.25 : u.job === 'archer' ? 1.0 : 0.95; } } }
    }
    if (u.atk){ const a = u.atk; a.t += dt;
      if (!a.hit && a.t >= a.dur * 0.42){ a.hit = true; const e = a.e;
        if (live(e) && !e.under){ const [dmg, crit] = botDmgFor(u, e);
          if (u.job === 'archer') shotFx(u, e, 'arrow', () => botHit(e, dmg, u, crit));
          else if (u.job === 'mage') shotFx(u, e, 'orb', () => botHit(e, dmg, u, crit));
          else { swingFx(u, a.i === 2); if (Math.hypot(e.pos.x - u.pos.x, e.pos.z - u.pos.z) - e.cfg.rad < 2.4){ botHit(e, dmg, u, crit); if (R() < 0.3) X.sfx('hit'); } } } }
      if (a.t >= a.dur) u.atk = null; }
  }
  // 이동 마무리 (충돌 · 보스 몸통 · 전장 밖)
  if (!u.down){ G.collide(u.pos, 0.38); const b = RS && RS.boss; if (live(b) && !b.under && b.pos.y < 2){ const dx = u.pos.x - b.pos.x, dz = u.pos.z - b.pos.z, d = Math.hypot(dx, dz), m = b.cfg.rad + 0.4; if (d < m && d > 1e-3){ u.pos.x = b.pos.x + dx / d * m; u.pos.z = b.pos.z + dz / d * m; } } }
  u.ry += angDiff(u.want ?? u.ry, u.ry) * Math.min(1, dt * (u.atk || u.roll ? 22 : 9)); f.root.rotation.y = u.ry; u.pos.y = 0.04 + u.y;
  // 포즈
  if (!tp){
    if (u.cast && (u.cast.k === 'heal' || u.cast.t > 0)) tp = u.cast.k === 'heal' ? PZ({ lax: -2.8, rax: -2.8, le: -0.2, re: -0.2, sp: -0.25, hd: -0.35 }) : PZ({ hy: 0.55, lk: 1.4, rk: 0.3, llx: -0.2, rlx: -1.2, lax: -1.1, rax: -1.1, le: -0.3, re: -0.3, sp: 0.35, hd: 0.3 }), k = 12;
    else if (u.atk){ tp = atkPose(u); k = 28; }
    else if (u.mv > 0.2){ u.gph += dt * (u.mv > 6 ? 13.5 : 10) * Math.min(1.4, 0.45 + u.mv / 5.5); tp = f.gait(u.gph, Math.min(1, u.mv / 4.6), u.mv > 5.5, t); k = 16; }
    else if (u.cheer > 0) tp = PZ({ laz: 2.5, raz: -2.5, le: -0.3, re: -0.3, hd: -0.3, sp: -0.1 });
    else { tp = PZ({ hy: 0.84 + Math.sin(t * 2.2 + u.ph0) * 0.006, sp: 0.06, laz: 0.12, raz: -0.12, llx: -0.15, rlx: 0.15, lk: 0.12, rk: 0.12 }); if (u.job === 'archer'){ tp.lax -= 0.35; tp.le -= 0.5; } else { tp.rax -= 0.45; tp.re -= 0.6; if (u.job === 'sword'){ tp.lax -= 0.3; tp.le -= 0.8; } } }
    if (u.y > 0.05 && !u.roll){ tp.lk = 1.1; tp.rk = 1.1; tp.llx = -0.7; tp.rlx = -0.7; tp.laz = Math.max(tp.laz, 0.9); tp.raz = Math.min(tp.raz, -0.9); }
    if (u.hurtT > 0){ tp.sp -= 0.25; tp.hd -= 0.3; tp.lax += 0.3; tp.rax += 0.3; }
  }
  f.set(tp); f.blend(dt, k); u.av.upd(dt, Math.min(1, u.mv / 6), u.y > 0.05);
}
function updDown(u, dt){
  const near = !X.dead && Math.hypot(ME.pos.x - u.pos.x, ME.pos.z - u.pos.z) < 2.45; let rate = near ? 1 / 3 : 0;
  const rb = u.revBy; if (rb && !rb.down && rb.cast && rb.cast.k === 'rev' && rb.cast.o === u && Math.hypot(rb.pos.x - u.pos.x, rb.pos.z - u.pos.z) < 2) rate += 1 / 5;
  u.rv = rate ? Math.min(1, u.rv + rate * dt) : Math.max(0, u.rv - dt * 0.2);
  u.ring.position.set(u.pos.x, 0.075, u.pos.z); u.rfill.position.set(u.pos.x, 0.07, u.pos.z); u.rfill.scale.setScalar(Math.max(0.01, u.rv * 2.3)); u.ring.material.opacity = 0.5 + Math.sin(G.time * 5) * 0.25;
  if (near && R() < dt * 14) X.burst(new V3(u.pos.x + rr(-1, 1), 0.2, u.pos.z + rr(-1, 1)), 0xffe08a, 1, 0.5, 0.22, 0.9, 2.5, 1.5);
  if (u.rv >= 1){ if (rb && rb.cast && rb.cast.o === u) rb.cast = null; u.revBy = null; reviveBot(u, near ? ME : rb); }
}
// 부활 (플레이어) — 파티 부활의 룬 1회
function resPlayer(by){
  if (!X.dead || !RS) return; RS.res--; RS.resK = 0; X.revive(); const d = X.D(); X.hp = Math.round(d.maxHp * 0.4); X.refreshHud();
  X.sfx('level'); X.burst(new V3(ME.pos.x, 0.6, ME.pos.z), 0xffe08a, 50, 4, 0.3, 1.1, 1, 3); X.shockwave(ME.pos.x, 0.12, ME.pos.z, 3.6, 0xffe08a, 0.6); flash();
  botSay(by, 'res', true); tip('파티원이 <b>부활의 룬</b>으로 일으켜 줬어요! (남은 부활 ' + RS.res + ')', 4);
}
// 이름표 · 말풍선 · 파티 창
const _tp = new V3();
function updTags(){
  const W = innerWidth, H = innerHeight, hide = !RS || RS.phase === 'enter';
  for (const u of BOTS){
    _tp.set(u.pos.x, u.y + (u.down ? 0.9 : 2.4), u.pos.z).project(G.camera); const d = Math.hypot(u.pos.x - ME.pos.x, u.pos.z - ME.pos.z);
    if (hide || _tp.z > 1 || _tp.z < -1 || d > 60){ u.tag.style.display = 'none'; u.bub.style.display = 'none'; continue; }
    const sx = (_tp.x * 0.5 + 0.5) * W, sy = (-_tp.y * 0.5 + 0.5) * H;
    u.tag.style.display = ''; u.tag.style.left = sx + 'px'; u.tag.style.top = sy + 'px'; u.tag.classList.toggle('down', u.down);
    u.tag.querySelector('b').style.width = (u.hp / u.max * 100) + '%'; if (u.down) u.tag.querySelector('.rv').textContent = u.rv > 0.02 ? `부활 ${Math.round(u.rv * 100)}%` : '💀 쓰러짐';
    u.bub.style.display = ''; u.bub.style.left = sx + 'px'; u.bub.style.top = (sy - 34) + 'px';
  }
}
let frameEls = [];
function buildFrames(){
  partyEl.innerHTML = UNITS.map(u => { const c = u.me ? '#7ff3ff' : hexCss(X.JOBS[u.job] ? X.JOBS[u.job].c : 0xffffff), ic = u.me ? (S.job && X.JOBS[S.job] ? X.JOBS[S.job].icon : '⚔️') : u.def.ico;
    const nm = u.me ? `${S.job ? X.jobName() : '모험가'} <small style="opacity:.7">(나)</small>` : u.name, role = u.me ? `Lv.${S.lv}` : { tank: '탱커', heal: '힐러', ranged: '원거리', melee: '근접' }[u.role];
    return `<div class="pf${u.me ? ' me' : ''}" style="--c:${c}"><div class="nm"><span>${ic}</span>${nm}<em>${role}</em></div><div class="hb"><b></b></div><div class="st">💀 쓰러짐 — 곁에 서서 부활</div><i class="rv"></i></div>`; }).join('');
  frameEls = [...partyEl.querySelectorAll('.pf')].map(el => ({ el, b: el.querySelector('.hb b'), st: el.querySelector('.st'), rv: el.querySelector('.rv') }));
}
function updFrames(){
  UNITS.forEach((u, i) => { const f = frameEls[i]; if (!f) return; const k = u.me ? X.hp / X.D().maxHp : u.hp / u.max, dn = !alive(u);
    f.b.style.width = clamp(k * 100, 0, 100) + '%'; f.el.classList.toggle('lowhp', k < 0.3); f.el.classList.toggle('down', dn);
    if (u.me && dn) f.st.textContent = RS && RS.resK > 0 ? `부활 중… ${Math.round(RS.resK * 100)}%` : '💀 쓰러짐';
    f.rv.style.width = ((u.me ? (RS && RS.resK) || 0 : u.rv) * 100) + '%'; });
}

// ───────────────────────── 전장 (손으로 지은 인스턴스 맵) ─────────────────────────
// 모든 전장은 평평한 바닥(y = 0). 정적인 것은 재질별로 병합 (G.Builder), 움직이는 것은 ctx.anims 로 돌려요.
const meterUV = (g, s = 1) => { const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / s, p.getZ(i) / s); return g; };
function flames(grp, pts, col, n = 36, h = 1.4){
  if (!pts.length) return; const c = new THREE.Color(col), c2 = c.clone().lerp(new THREE.Color(0xffffff), 0.6);
  G.particles(pts.length * (LOW ? Math.round(n * 0.6) : n), pts, { parent: grp,
    vert: `float life = fract(uTime * (0.9 + 0.5 * fract(aSeed * 7.13)) + aSeed); vL = life; vS = aSeed; float an = aSeed * 81.0, rad = (0.34 * (1.0 - life) + 0.04) * fract(aSeed * 3.7);
      vec3 p = position + vec3(cos(an) * rad + sin(uTime * 3.0 + aSeed * 20.0) * 0.08 * life, life * ${h.toFixed(2)}, sin(an) * rad); float sz = 0.75 * (1.0 - life * 0.6);`,
    frag: `float a = smoothstep(0.5, 0.0, d) * (1.0 - vL) * smoothstep(0.0, 0.08, vL); vec3 c = mix(vec3(${c2.r.toFixed(3)}, ${c2.g.toFixed(3)}, ${c2.b.toFixed(3)}), vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)}), smoothstep(0.05, 0.5, vL)); gl_FragColor = vec4(c * a * 1.6, a);` });
}
function motes(grp, n, area, y0, y1, col, size = 0.12, cx = 0, cz = 0){
  const bases = []; for (let i = 0; i < n; i++) bases.push(new V3(cx + rr(-area, area), rr(y0, y1), cz + rr(-area, area)));
  const c = new THREE.Color(col);
  return G.particles(n, bases, { parent: grp, vert: `vS = aSeed; vec3 p = position + vec3(sin(uTime * 0.3 + aSeed * 50.0) * 2.0, sin(uTime * 0.5 + aSeed * 31.0) * 0.8, cos(uTime * 0.25 + aSeed * 70.0) * 2.0); vL = 0.45 + 0.55 * sin(uTime * 1.6 + aSeed * 40.0); float sz = ${size.toFixed(3)};`,
    frag: `float a = smoothstep(0.5, 0.0, d) * vL; gl_FragColor = vec4(vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)}) * a * 1.4, a);` });
}
function shaft(grp, x, z, y0, y1, r0, r1, col, op = 0.12, tx = 0, tz = 0){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, 24, 1, true), addM(col, op, mat('shaftT', () => gradTex([[0, 'rgba(255,255,255,0)'], [0.15, 'rgba(255,255,255,.9)'], [0.7, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]))));
  m.position.set(x, (y0 + y1) / 2, z); m.rotation.set(tx, 0, tz); m.renderOrder = 4; grp.add(m); return m;
}
function plight(grp, x, y, z, col, I, D, flick = 0, anims){
  const l = new THREE.PointLight(col, I, D, 1.6); l.position.set(x, y, z); grp.add(l);
  if (flick && anims){ const p = R() * 9; anims.push(() => { l.intensity = I * (1 + Math.sin(G.time * 9 + p) * 0.08 * flick + Math.sin(G.time * 23 + p) * 0.05 * flick); }); }
  return l;
}
const glowAt = (grp, x, y, z, col, s, op = 0.7) => { const g = X.glowSprite(col, s, op); g.position.set(x, y, z); grp.add(g); return g; };

// ── 1) 가라앉은 신전 · 왕의 대전당 (그롬) ──
const GROM_MATS = () => mat('gromMats', () => {
  const floorT = cnvTex(1024, 1024, (x, W) => {
    x.fillStyle = '#3c4a40'; x.fillRect(0, 0, W, W); const rnd = srand(11);
    for (let row = 0; row < 8; row++){ let cx = -rnd() * 60; const h = W / 8;
      while (cx < W){ const w = 90 + rnd() * 110, g = 52 + rnd() * 30 | 0; x.fillStyle = `rgb(${g - 6},${g + 8},${g})`; x.fillRect(cx + 4, row * h + 4, w - 8, h - 8);
        x.fillStyle = `rgba(${40 + rnd() * 30 | 0},${80 + rnd() * 50 | 0},${40 + rnd() * 20 | 0},${0.25 + rnd() * 0.35})`; for (let k = 0; k < 4; k++){ x.beginPath(); x.ellipse(cx + rnd() * w, row * h + rnd() * h, 6 + rnd() * 26, 4 + rnd() * 14, rnd() * 3, 0, TAU); x.fill(); }
        x.strokeStyle = 'rgba(20,26,22,.6)'; x.lineWidth = 1.5; x.beginPath(); let px = cx + rnd() * w, py = row * h + 6; x.moveTo(px, py); for (let k = 0; k < 4; k++){ px += (rnd() - 0.5) * 30; py += h / 5; x.lineTo(px, py); } x.stroke(); cx += w; } }
    x.fillStyle = 'rgba(10,20,14,.25)'; for (let i = 0; i < 300; i++){ x.beginPath(); x.arc(rnd() * W, rnd() * W, 1 + rnd() * 3, 0, TAU); x.fill(); }
  }, true, 1);
  const algT = cnvTex(256, 256, (x, W) => { x.clearRect(0, 0, W, W); const rnd = srand(5); for (let i = 0; i < 70; i++){ const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, 'rgba(160,255,120,.95)'); g.addColorStop(0.5, 'rgba(60,220,120,.5)'); g.addColorStop(1, 'rgba(20,120,80,0)'); x.save(); x.translate(rnd() * W, rnd() * W); x.scale(6 + rnd() * 22, 4 + rnd() * 12); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, TAU); x.fill(); x.restore(); } }, true);
  const wallT = G.T.stone;
  return {
    floor: std({ map: floorT, roughness: 0.75, color: 0xb8c8b8 }),
    water: std({ color: 0x1c4a40, roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.55, normalMap: normalTex(256, 7, 6), normalScale: new THREE.Vector2(0.5, 0.5), depthWrite: false }),
    wall: std({ map: wallT, color: 0x7a8a78, roughness: 0.92 }), wall2: std({ map: wallT, color: 0x5a6a58, roughness: 0.95 }), dark: std({ color: 0x0a100c, roughness: 1 }),
    moss: std({ color: 0x3a5a2a, roughness: 0.95, flatShading: true }), gold: X.M.gold, bronze: X.M.bronze,
    algae: new THREE.MeshStandardMaterial({ map: algT, emissiveMap: algT, emissive: 0x6aff8a, emissiveIntensity: 1.1, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.6 }),
    eye: basic(0xffd84a), eyeG: basic(0x8aff6a), vine: std({ color: 0x2a4a22, roughness: 0.9, flatShading: true }), lily: std({ color: 0x4a8a3a, roughness: 0.6, side: THREE.DoubleSide }), rune: X.ADDM(G.tex(G.runeStrip(2048, 128, 30, '#8aff6a', 0, 11), true, 1, 1), 0.85),
  };
});
function buildGromArena(grp, ctx){
  const M = GROM_MATS(), B = new G.Builder(), K = new G.Kit(B), col = (x, z, r) => ctx.SCOL.push({ t: 'c', x, z, r }), boxc = (x, z, hw, hd, ry) => ctx.SCOL.push({ t: 'b', x, z, hw, hd, c: Math.cos(ry), s: Math.sin(ry) }), A = ctx.anims;
  const RW = 24.6;
  // 바닥 · 얕은 물
  const fl = mesh(meterUV(new THREE.CircleGeometry(RW + 1, 72).rotateX(-HPI), 9), M.floor, grp, 0, 0, 0, false); fl.receiveShadow = true;
  const cf = mesh(meterUV(new THREE.PlaneGeometry(10.4, 14).rotateX(-HPI), 9), M.floor, grp, 0, 0.002, 27, false); cf.receiveShadow = true;
  const wa = mesh(meterUV(new THREE.CircleGeometry(RW + 0.5, 72).rotateX(-HPI), 1), M.water, grp, 0, 0.035, 0, false); wa.renderOrder = 1;
  const wc = mesh(meterUV(new THREE.PlaneGeometry(10.4, 14).rotateX(-HPI), 1), M.water, grp, 0, 0.034, 27, false); wc.renderOrder = 1;
  A.push(dt => { M.water.normalMap.offset.x += dt * 0.012; M.water.normalMap.offset.y += dt * 0.007; });
  // 둥근 벽 (남쪽 통로만 열림) · 벽감 · 기둥 · 아치
  const NW = 28;
  for (let i = 0; i < NW; i++){
    const a = (i + 0.5) / NW * TAU; if (Math.abs(angDiff(a, 0)) < 0.2) continue;
    K.push(Math.sin(a) * (RW + 1.3), 0, Math.cos(a) * (RW + 1.3), a + PI);
    K.box('wall', 5.9, 13, 2.6, 0, 6.5, 0); K.box('wall2', 6.2, 1.2, 3.4, 0, 0.6, 0.2); K.box('wall2', 6.3, 0.9, 3.2, 0, 13.2, 0.1);
    if (i % 2){ K.box('dark', 2.4, 4.4, 0.6, 0, 3.6, 1.15); K.box('wall2', 3.2, 0.5, 1.3, 0, 1.2, 1.25); K.geo('moss', blobGeoC('idol'), 0, 1.75, 1.2, 0, 0, 0, 0.55, 0.55, 0.55); K.geo('eyeG', new THREE.SphereGeometry(0.09, 8, 6), 0.17, 2.18, 1.55); K.geo('eyeG', new THREE.SphereGeometry(0.09, 8, 6), -0.17, 2.18, 1.55); }
    else { K.geo('wall2', new THREE.CylinderGeometry(0.75, 0.85, 12, 14), 2.95, 6.6, 1.25); K.geo('wall2', new THREE.TorusGeometry(2.95, 0.42, 6, 16, PI), 0, 9.3, 1.3); }
    if (R() < 0.6) K.geo('moss', new THREE.IcosahedronGeometry(rr(0.6, 1.2), 0), rr(-2, 2), rr(0.4, 1.5), 1.6, R(), R(), R(), 1.4, 0.5, 1);
    K.pop();
  }
  // 남쪽 통로 (들어온 문)
  for (const s of [-1, 1]){ K.box('wall', 2.2, 12, 14, s * 6.3, 6, 27); K.box('wall2', 2.6, 1.0, 14, s * 6.1, 0.5, 27); for (let j = 0; j < 4; j++) K.geo('wall2', new THREE.CylinderGeometry(0.55, 0.6, 11, 12), s * 5.1, 5.5, 21.5 + j * 3.6); }
  K.box('wall', 13, 12, 2.4, 0, 6, 34.4); K.box('dark', 6, 7.5, 0.4, 0, 3.75, 33.1); K.geo('wall2', new THREE.TorusGeometry(3.1, 0.5, 8, 20, PI), 0, 7.4, 33.0);
  const door = new THREE.Mesh(new THREE.CircleGeometry(1, 32).scale(2.8, 3.6, 1), addM(0x6aff9a, 0.5)); door.position.set(0, 3.7, 32.8); door.rotation.y = PI; grp.add(door); A.push(() => { door.material.opacity = 0.35 + Math.sin(G.time * 2) * 0.12; });
  // 무너진 천장 갈비뼈 (가운데는 뻥 뚫려 하늘이 보여요)
  for (let i = 0; i < 10; i++){
    const a = i / 10 * TAU + 0.31; K.push(0, 0, 0, a); const broken = i % 3 === 1 ? 2 : i % 3 === 2 ? 1 : 0, N = 6 - broken;
    let pz = RW + 0.5, py = 12.8; for (let j = 1; j <= N; j++){ const s = j / 6, z1 = RW + 0.5 - s * 15, y1 = 12.8 + Math.sin(s * HPI) * 5.2, L = Math.hypot(z1 - pz, y1 - py) + 0.35, th = Math.atan2(y1 - py, pz - z1);
      K.box('wall', 1.5, 1.2, L, 0, (py + y1) / 2, (pz + z1) / 2, th, 0, 0); if (R() < 0.5) K.box('moss', 1.55, 0.25, L * 0.6, 0, (py + y1) / 2 + 0.66, (pz + z1) / 2, th, 0, 0); pz = z1; py = y1; }
    K.geo('wall2', new THREE.ConeGeometry(0.9, 1.6, 5), 0, py - 0.3, pz - 0.4, -1.9, 0, 0);
    for (let v = 0; v < 3; v++){ const s = rr(0.15, 0.85) * N / 6, vz = RW + 0.5 - s * 15, vy = 12.8 + Math.sin(s * HPI) * 5.2 - 0.6, L = rr(3, 7); K.geo('vine', new THREE.CylinderGeometry(0.05, 0.09, L, 4), rr(-0.5, 0.5), vy - L / 2, vz); for (let q = 0; q < 4; q++) K.geo('lily', new THREE.CircleGeometry(0.22, 5), rr(-0.3, 0.3), vy - rr(0.3, L), vz + rr(-0.2, 0.2), R() * 3, R() * 3, 0); }
    K.pop();
  }
  // 둥근 천장 (가운데가 무너져 뚫린 구멍으로 빛이 들어와요)
  const vg = new THREE.SphereGeometry(RW + 1.4, 56, 14, 0, TAU, 0.34, HPI - 0.34); { const p = vg.attributes.position, rnd = srand(3); for (let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z); if (r < 10.5){ const k = 1 + (rnd() - 0.3) * 0.18; p.setXYZ(i, x * k, y - rnd() * 1.4, z * k); } } vg.computeVertexNormals(); }
  const vault = mesh(vg, mat('gromVault', () => std({ map: G.T.stone, color: 0x55665a, roughness: 0.95, side: THREE.BackSide })), grp, 0, 12.6, 0, false); vault.scale.y = 0.44; vault.receiveShadow = true;
  for (let i = 0; i < 26; i++){ const a = R() * TAU, r = rr(8.6, 10.4); K.geo('wall2', new THREE.IcosahedronGeometry(rr(0.4, 1.1), 0), Math.sin(a) * r, 21.6 + rr(-0.6, 0.4), Math.cos(a) * r, R(), R(), R()); }
  for (let i = 0; i < 18; i++){ const a = R() * TAU, r = rr(9.5, 18), L = rr(2.5, 6), y = 12.6 + Math.cos(Math.asin(Math.min(1, r / (RW + 1.4)))) * (RW + 1.4) * 0.44 - 0.3; K.geo('vine', new THREE.CylinderGeometry(0.05, 0.09, L, 4), Math.sin(a) * r, y - L / 2, Math.cos(a) * r); }
  // 안쪽 기둥 8개 (온전 · 부러짐) + 빛나는 이끼
  const PIL = [[0.5, 15.4, 13], [1.25, 15.8, 5.5], [1.95, 15.4, 13], [2.62, 15.2, 3.2], [-0.5, 15.4, 13], [-1.25, 15.8, 7], [-1.95, 15.4, 4.4], [-2.62, 15.2, 13]];
  for (const [a, r, h] of PIL){
    const x = Math.sin(a) * r, z = Math.cos(a) * r; K.push(x, 0, z, a);
    K.box('wall2', 2.9, 0.7, 2.9, 0, 0.35, 0); K.geo('wall', new THREE.CylinderGeometry(1.0, 1.12, h, 18, 3), 0, 0.7 + h / 2, 0);
    if (h > 12){ K.box('wall2', 2.6, 0.8, 2.6, 0, h + 0.9, 0); }
    else { K.geo('wall', new THREE.ConeGeometry(1.0, 1.3, 7), 0.1, 0.7 + h + 0.4, 0, rr(-0.4, 0.4), R(), rr(-0.5, 0.5)); for (let q = 0; q < 2; q++){ const fa = R() * TAU, fd = rr(2.5, 3.5); K.geo('wall', new THREE.CylinderGeometry(1.0, 1.0, rr(1.4, 2.2), 16), Math.cos(fa) * fd, 0.95, Math.sin(fa) * fd, HPI + rr(-0.2, 0.2), R() * 3, 0); col(x + Math.cos(fa) * fd, z + Math.sin(fa) * fd, 1.0); } }
    for (let q = 0; q < 2; q++){ const ah = rr(1.2, Math.min(h, 8)), th0 = R() * TAU; K.geo('algae', new THREE.CylinderGeometry(1.14, 1.14, rr(1.4, 2.6), 16, 1, true, th0, rr(1.4, 2.6)), 0, ah, 0); }
    K.geo('moss', new THREE.IcosahedronGeometry(0.9, 0), rr(-0.6, 0.6), 0.6, 1.0, 0, 0, 0, 1.4, 0.4, 1.1); K.pop(); col(x, z, 1.35);
  }
  // 왕좌 (북쪽): 두꺼비 머리 부조 · 이끼 왕좌 · 석상 한 쌍 · 룬 원
  K.push(0, 0, -RW - 0.6, 0);
  K.geo('wall2', blobGeoC('relief'), 0, 7.2, 0.6, 0, 0, 0, 2.6, 1.6, 1.0); for (const s of [-1, 1]){ K.geo('wall2', new THREE.SphereGeometry(1.4, 16, 12), s * 3.0, 9.4, 1.6); K.geo('eye', new THREE.SphereGeometry(0.85, 16, 12), s * 3.0, 9.5, 2.5, 0, 0, 0, 1, 1, 0.6); K.box('dark', 1.1, 0.24, 0.2, s * 3.0, 9.5, 3.05); }
  K.box('dark', 7.5, 0.5, 1.2, 0, 5.8, 2.4); K.geo('gold', new THREE.ConeGeometry(0.7, 1.8, 6), 0, 11.3, 1.2); for (const s of [-1, 1]) K.geo('gold', new THREE.ConeGeometry(0.5, 1.3, 6), s * 1.7, 10.9, 1.3, 0, 0, s * 0.35);
  K.geo('wall2', new THREE.CylinderGeometry(4.2, 4.6, 1.0, 28), 0, 0.5, 2.6); K.geo('moss', new THREE.CylinderGeometry(3.6, 3.8, 0.3, 24), 0, 1.15, 2.6); K.box('wall2', 7.2, 0.5, 1.6, 0, 0.25, 5.4);
  K.pop();
  for (const s of [-1, 1]){ const sx = s * 8.4, sz = -19.6; K.push(sx, 0, sz, -s * 0.5); K.box('wall2', 3.0, 1.2, 3.0, 0, 0.6, 0); K.geo('wall', blobGeoC('toadS'), 0, 2.4, 0, 0, 0, 0, 1.3, 1.1, 1.3); K.geo('eyeG', new THREE.SphereGeometry(0.2, 8, 6), 0.45, 3.35, 0.95); K.geo('eyeG', new THREE.SphereGeometry(0.2, 8, 6), -0.45, 3.35, 0.95); K.geo('moss', new THREE.IcosahedronGeometry(0.8, 0), 0.3, 3.5, -0.3, 0, 0, 0, 1.2, 0.4, 1); K.pop(); col(sx, sz, 1.8); }
  const rn = new THREE.Mesh(X.polarRing(5.6, 6.5, 96), M.rune); rn.position.set(0, 0.045, -10.5); grp.add(rn); A.push(dt => { rn.rotation.y += dt * 0.05; });
  // 화로 (초록 불꽃)
  const BR = [[-15.5, -12], [15.5, -12], [-19.6, 2.5], [19.6, 2.5], [-13.5, 15.5], [13.5, 15.5]], FL = [];
  for (const [x, z] of BR){ K.geo('wall2', new THREE.CylinderGeometry(0.42, 0.6, 2.2, 10), x, 1.1, z); K.geo('bronze', G.latheG([[0, 0], [0.9, 0.1], [1.0, 0.5], [0.85, 0.55], [0, 0.4]], 14, 0.4), x, 2.2, z); col(x, z, 0.8); FL.push(new V3(x, 2.7, z)); glowAt(grp, x, 3.0, z, 0x6aff6a, 4.2, 0.55); }
  flames(grp, FL, 0x3aff5a, 34, 1.6);
  // 쓰러진 석상 머리 · 기둥 조각 · 잔해
  K.geo('wall', blobGeoC('toadS'), -11, 0.9, 8.5, 0.4, 1.2, 0.6, 1.0, 0.85, 1.0); col(-11, 8.5, 1.4);
  K.geo('wall', new THREE.CylinderGeometry(1.0, 1.0, 5.2, 16), 10.5, 0.85, 7.5, HPI, 0.8, 0); boxc(10.5, 7.5, 2.6, 1.0, 0.8 - HPI);
  for (let i = 0; i < 46; i++){ const a = R() * TAU, r = rr(20.5, 23.5); K.geo(R() < 0.5 ? 'wall2' : 'moss', new THREE.IcosahedronGeometry(rr(0.3, 0.8), 0), Math.sin(a) * r, 0.15, Math.cos(a) * r, R(), R(), R(), 1, 0.6, 1); }
  // 수련잎 · 갈대
  const lil = new THREE.CircleGeometry(0.5, 10, 0.3, TAU - 0.6).rotateX(-HPI); for (let i = 0; i < 40; i++){ const a = R() * TAU, r = rr(9, 22); K.geo('lily', lil, Math.sin(a) * r, 0.05, Math.cos(a) * r, 0, R() * TAU, 0, rr(0.7, 1.5), 1, rr(0.7, 1.5)); }
  const reeds = []; for (let i = 0; i < (LOW ? 18 : 34); i++){ const a = R() * TAU, r = rr(21, 23.5); reeds.push([Math.sin(a) * r, Math.cos(a) * r, rr(0.8, 1.4)]); }
  const im = new THREE.InstancedMesh(X.treeGeo('reed'), X.TREEMAT, reeds.length); reeds.forEach(([x, z, s], i) => im.setMatrixAt(i, G.mat(x, 0, z, 0, R() * TAU, 0, s, s, s))); grp.add(im);
  B.build(M, grp);
  // 빛 · 하늘에서 떨어지는 빛줄기 · 포자
  plight(grp, 0, 6, -15, 0x6aff7a, 34, 34, 1, A); plight(grp, 0, 7, 9, 0x5ae0c0, 18, 30, 0, A);
  shaft(grp, -2, 1.5, 0, 19, 4.5, 1.8, 0xc8ffd8, 0.1, 0.06, 0.08); shaft(grp, 4, -4, 0, 19, 3.2, 1.2, 0xc8ffd8, 0.08, -0.05, -0.1); shaft(grp, -5, -7, 0, 19, 2.6, 1.0, 0xd8fff0, 0.07, 0.1, 0.04);
  motes(grp, LOW ? 70 : 150, 20, 0.4, 9, 0x8affb0, 0.13); motes(grp, LOW ? 20 : 40, 22, 0.2, 2, 0xd8ff8a, 0.2);
  // 가장자리의 오래된 독 웅덩이 (들어가면 독 피해)
  for (const [x, z, r] of [[-16.5, -3.5, 2.6], [17.5, -5.5, 2.2], [-6.5, 16.5, 1.8], [12.5, 12.5, 2.0]]) pool(x, z, r, 1e9, 10, 'poison');
}
// 그롬 전장 소품용 덩어리 (두꺼비 석상 · 부조 · 우상)
function blobGeoC(k){ return geo('blob_' + k, () => k === 'toadS' ? blobGeo(1, 1.2, 0.8, 1.1, 20, 18, 0.12, 4) : k === 'relief' ? blobGeo(1.6, 1.1, 0.9, 0.6, 22, 24, 0.12, 9) : blobGeo(0.9, 1.1, 0.85, 1.0, 14, 10, 0.12, 2)); }

// ── 2) 버려진 광산 · 거인의 동굴 (그라녹) ──
const GRANOK_MATS = () => mat('granokMats', () => {
  const floorT = cnvTex(1024, 1024, (x, W) => { x.fillStyle = '#4a3a2c'; x.fillRect(0, 0, W, W); const rnd = srand(21);
    for (let i = 0; i < 1600; i++){ const g = 50 + rnd() * 50 | 0; x.fillStyle = `rgba(${g + 20},${g + 6},${g - 8},${0.25 + rnd() * 0.5})`; x.beginPath(); x.ellipse(rnd() * W, rnd() * W, 2 + rnd() * 9, 1 + rnd() * 6, rnd() * 3, 0, TAU); x.fill(); }
    x.strokeStyle = 'rgba(20,12,6,.7)'; x.lineWidth = 2.5; for (let i = 0; i < 26; i++){ let px = rnd() * W, py = rnd() * W; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 7; k++){ px += (rnd() - 0.5) * 70; py += (rnd() - 0.5) * 70; x.lineTo(px, py); } x.stroke(); } }, true);
  const veinT = cnvTex(512, 512, (x, W) => { x.fillStyle = '#000'; x.fillRect(0, 0, W, W); const rnd = srand(33); x.lineCap = 'round';
    for (let i = 0; i < 14; i++){ let px = rnd() * W, py = rnd() * W; x.strokeStyle = rnd() < 0.7 ? '#ff8a2a' : '#3ad8ff'; x.lineWidth = 1 + rnd() * 2.5; x.shadowColor = x.strokeStyle; x.shadowBlur = 8; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++){ px += (rnd() - 0.5) * 80; py += (rnd() - 0.5) * 80; x.lineTo(px, py); } x.stroke(); } }, true);
  return {
    floor: std({ map: floorT, emissiveMap: veinT, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.95 }),
    cave: std({ vertexColors: true, flatShading: true, roughness: 0.95 }), rock: std({ color: 0x6a5a4c, flatShading: true, roughness: 0.95 }), rock2: std({ color: 0x4a3e34, flatShading: true, roughness: 0.95 }),
    wood: X.M.wood, woodD: X.M.woodD, iron: X.M.iron, steel: X.M.steel, gold: X.M.gold, dark: std({ color: 0x050403, roughness: 1 }), lamp: X.M.lamp,
    amber: std({ color: 0xffb060, emissive: 0xff7a1a, emissiveIntensity: 1.3, roughness: 0.15, flatShading: true, transparent: true, opacity: 0.92 }),
    cyan: std({ color: 0x9af4ff, emissive: 0x2ac0ff, emissiveIntensity: 1.2, roughness: 0.12, flatShading: true, transparent: true, opacity: 0.9 }),
    ore: std({ color: 0xd8a83a, metalness: 0.8, roughness: 0.35, flatShading: true }), rope: std({ color: 0x9a7a4a, roughness: 0.9 }),
  };
});
function crystalCluster(K, key, x, y, z, s, n = 5, tilt = 0.5, ry = 0){
  K.push(x, y, z, ry); for (let i = 0; i < n; i++){ const a = i / n * TAU + R(), h = s * rr(0.8, 1.9), lean = rr(0.15, tilt);
    const g = new THREE.OctahedronGeometry(1, 0); g.scale(0.28 * s, h, 0.28 * s); K.geo(key, g, Math.cos(a) * s * 0.35, h * 0.7, Math.sin(a) * s * 0.35, Math.sin(a) * lean, R(), -Math.cos(a) * lean); } K.pop();
}
function buildGranokArena(grp, ctx){
  const M = GRANOK_MATS(), B = new G.Builder(), K = new G.Kit(B), col = (x, z, r) => ctx.SCOL.push({ t: 'c', x, z, r }), A = ctx.anims;
  const fl = mesh(meterUV(new THREE.CircleGeometry(30, 72).rotateX(-HPI), 10), M.floor, grp, 0, 0, 0, false); fl.receiveShadow = true;
  const cf = mesh(meterUV(new THREE.PlaneGeometry(9, 16).rotateX(-HPI), 10), M.floor, grp, 0, 0.002, 26, false); cf.receiveShadow = true;
  // 동굴 벽 + 돔 천장 (정점 변위 · 정점 색) — 남쪽에 갱도 입구
  const cave = (g, seed, inward) => { const p = g.attributes.position, v = new V3(); for (let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i); const a = Math.atan2(v.x, v.z), h = Math.sin(a * 7 + seed) * 0.9 + Math.sin(a * 17 + v.y * 0.6 + seed) * 0.6 + Math.sin(v.y * 0.9 + a * 3) * 0.7 + (hash3(Math.round(v.x * 2), Math.round(v.y * 2), Math.round(v.z * 2)) - 0.5) * 0.8; const r = Math.hypot(v.x, v.z), k = (r + h * inward) / Math.max(0.01, r); p.setXYZ(i, v.x * k, v.y, v.z * k); } g.computeVertexNormals();
    return paint(g, (x, y, z) => { const n = hash3(Math.round(x), Math.round(y), Math.round(z)); return mix3(mix3(C3(0x3a2e24), C3(0x6a5644), sstep(-4, 10, y)), C3(0x2a221a), n * 0.5); }); };
  const wallG = cave(new THREE.CylinderGeometry(23.5, 26.5, 17, 72, 10, true, 0.2, TAU - 0.4), 1.3, 1); const wl = mesh(wallG, M.cave, grp, 0, 8.4, 0, false); wl.receiveShadow = true;
  const domeG = new THREE.SphereGeometry(24.5, 64, 12, 0, TAU, 0.14, HPI * 0.92); domeG.scale(1, 0.5, 1); const dome = mesh(cave(domeG, 3.1, -0.8), M.cave, grp, 0, 16.6, 0, false); dome.receiveShadow = true;
  // 갱도 (들어온 길) · 동쪽 옆 갱도 입구
  for (const s of [-1, 1]){ K.geo('rock2', rockGeo(1, 1, 0.3, 4 + s, 1.6, 6, 9), s * 5.6, 3, 27); }
  K.box('rock2', 12, 2.5, 14, 0, 7.4, 27); K.box('dark', 7, 6, 0.4, 0, 3, 33.5);
  for (let j = 0; j < 5; j++){ const z = 19.5 + j * 3.2; K.box('woodD', 0.35, 5.4, 0.35, -3.6, 2.7, z); K.box('woodD', 0.35, 5.4, 0.35, 3.6, 2.7, z); K.box('wood', 7.8, 0.4, 0.45, 0, 5.5, z); }
  K.push(22.8, 0, -8.6, -HPI + 0.35); K.box('dark', 5, 5, 0.3, 0, 2.5, -0.4); K.box('woodD', 0.4, 5.8, 0.4, -2.7, 2.9, 0); K.box('woodD', 0.4, 5.8, 0.4, 2.7, 2.9, 0); K.box('wood', 6.4, 0.5, 0.5, 0, 5.9, 0); K.pop();
  // 레일 (갱도 → 동굴 → 동쪽 갱도)
  const curve = new THREE.CatmullRomCurve3([new V3(0, 0, 33), new V3(0, 0, 17), new V3(1.5, 0, 9), new V3(7, 0, 1.5), new V3(14, 0, -4.5), new V3(23, 0, -8.2)]), L = curve.getLength(), n = Math.round(L / 0.75);
  for (let i = 0; i <= n; i++){ const p = curve.getPointAt(i / n), tg = curve.getTangentAt(i / n), ry = Math.atan2(tg.x, tg.z); K.box('woodD', 1.9, 0.12, 0.32, p.x, 0.06, p.z, 0, ry, 0);
    if (i < n){ const q = curve.getPointAt((i + 1) / n), l2 = p.distanceTo(q), mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2, cs = Math.cos(ry), sn = Math.sin(ry); for (const s of [-0.62, 0.62]) K.box('iron', 0.09, 0.12, l2 + 0.02, mx + cs * s, 0.17, mz - sn * s, 0, ry, 0); } }
  // 광차 (하나는 레일 위, 하나는 넘어져 광석을 쏟음)
  const cart = (x, z, ry, tip) => { K.push(x, tip ? 0.85 : 0, z, ry, 0, tip ? 1.25 : 0); K.box('woodD', 1.5, 0.9, 2.2, 0, 0.95, 0); K.box('iron', 1.6, 0.12, 2.3, 0, 1.42, 0); K.box('iron', 1.55, 0.1, 2.25, 0, 0.5, 0);
    for (const sx of [-0.78, 0.78]) for (const sz of [-0.7, 0.7]) K.geo('iron', new THREE.CylinderGeometry(0.3, 0.3, 0.14, 12), sx, 0.32, sz, 0, 0, HPI);
    if (!tip) for (let i = 0; i < 6; i++) K.geo(i % 3 ? 'rock' : 'ore', new THREE.IcosahedronGeometry(rr(0.22, 0.35), 0), rr(-0.4, 0.4), 1.45, rr(-0.7, 0.7), R(), R(), R()); K.pop(); col(x, z, 1.35); };
  cart(1.15, 11.5, 0.12, false); cart(-12.5, 8.2, 2.3, true);
  for (let i = 0; i < 12; i++) K.geo(i % 3 ? 'ore' : 'rock', new THREE.IcosahedronGeometry(rr(0.2, 0.42), 0), -10.8 + rr(-1.2, 1.4), 0.15, 9.6 + rr(-1, 1.4), R(), R(), R());
  crystalCluster(K, 'amber', -10.4, 0, 10.6, 0.5, 4, 0.7);
  // 갱목 (벽을 따라) · 등불
  const LAMPS = [];
  for (let i = 0; i < 9; i++){ const a = i / 9 * TAU + 0.35; if (Math.abs(angDiff(a, 0)) < 0.35 || Math.abs(angDiff(a, 2.05)) < 0.2) continue; const r = 21.6, x = Math.sin(a) * r, z = Math.cos(a) * r;
    K.push(x, 0, z, a + PI); K.box('woodD', 0.42, 6.2, 0.42, -1.9, 3.1, 0); K.box('woodD', 0.42, 6.2, 0.42, 1.9, 3.1, 0); K.box('wood', 4.6, 0.5, 0.55, 0, 6.2, 0); K.box('wood', 0.25, 3.0, 0.25, -1.3, 4.9, 0, 0, 0, -0.75); K.box('wood', 0.25, 3.0, 0.25, 1.3, 4.9, 0, 0, 0, 0.75);
    K.box('lamp', 0.32, 0.42, 0.32, 0, 5.4, 0.45); K.pop(); col(x + Math.sin(a + HPI) * 1.9, z + Math.cos(a + HPI) * 1.9, 0.4); col(x - Math.sin(a + HPI) * 1.9, z - Math.cos(a + HPI) * 1.9, 0.4);
    const lx = x - Math.sin(a) * 0.45, lz = z - Math.cos(a) * 0.45; LAMPS.push(new V3(lx, 5.5, lz)); glowAt(grp, lx, 5.4, lz, 0xffb060, 2.6, 0.75); }
  flames(grp, LAMPS, 0xff9a3a, 12, 0.4);
  // 북쪽 권양기 (큰 바퀴) · 서쪽 비계
  K.push(0, 0, -21.5, 0); for (const s of [-1, 1]){ K.box('woodD', 0.6, 9, 0.6, s * 3.2, 4.5, 0); K.box('wood', 0.3, 6, 0.3, s * 3.2, 3.2, 1.6, -0.5, 0, 0); } K.box('wood', 7, 0.5, 0.6, 0, 9, 0);
  K.pop(); col(-3.2, -21.5, 0.6); col(3.2, -21.5, 0.6);
  const wheel = new THREE.Group(); wheel.position.set(0, 7.2, -21.2); grp.add(wheel);
  mesh(new THREE.TorusGeometry(2.6, 0.18, 8, 32), M.woodD, wheel); for (let i = 0; i < 8; i++){ const sp = mesh(new THREE.BoxGeometry(0.16, 5.2, 0.16), M.wood, wheel); sp.rotation.z = i / 8 * PI; }
  mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 12).rotateX(HPI), M.iron, wheel); A.push(dt => { wheel.rotation.z += dt * 0.15; });
  K.geo('rope', new THREE.CylinderGeometry(0.05, 0.05, 6.5, 5), 2.6, 3.9, -21.2); K.geo('iron', new THREE.BoxGeometry(1.2, 0.9, 1.2), 2.6, 0.9, -21.0); K.geo('dark', new THREE.CircleGeometry(2.2, 24).rotateX(-HPI), -6, 0.02, -19.5);
  for (let j = 0; j < 3; j++){ const y = 3 + j * 3.4; K.push(-20.6, 0, -6 + j * 1.5, HPI - 0.2); K.box('wood', 5.5, 0.25, 2.2, 0, y, 0); K.box('woodD', 0.3, y, 0.3, -2.4, y / 2, 0.9); K.box('woodD', 0.3, y, 0.3, 2.4, y / 2, 0.9); K.pop(); }
  // 수정 무리 (벽 · 바닥 가장자리) · 종유석 · 석순
  const CRY = [[-17, -11, 1.6, 'amber'], [16.5, -13, 1.9, 'cyan'], [-19.5, 4, 1.4, 'cyan'], [18.5, 7, 1.5, 'amber'], [-8, -18, 1.2, 'amber'], [9.5, -18.5, 1.3, 'cyan'], [-14.5, 15.5, 1.1, 'amber'], [14, 16, 1.0, 'cyan']];
  for (const [x, z, s, k] of CRY){ crystalCluster(K, k, x, 0, z, s, 6, 0.6); col(x, z, s * 0.9); glowAt(grp, x, s * 1.4, z, k === 'amber' ? 0xff9a3a : 0x3ad8ff, s * 6, 0.45); }
  for (let i = 0; i < 16; i++){ const a = R() * TAU, r = rr(22.5, 24), y = rr(2, 11); crystalCluster(K, R() < 0.6 ? 'amber' : 'cyan', Math.sin(a) * r, y, Math.cos(a) * r, rr(0.5, 1.0), 4, 1.2, a); }
  const stg = new THREE.ConeGeometry(1, 1, 6), stal = []; for (let i = 0; i < (LOW ? 40 : 70); i++){ const a = R() * TAU, r = rr(3, 23), h = rr(1.2, 4.5); stal.push([Math.sin(a) * r, Math.cos(a) * r, h, rr(0.25, 0.6)]); }
  const sti = new THREE.InstancedMesh(stg, M.rock2, stal.length); stal.forEach(([x, z, h, w], i) => { const r = Math.hypot(x, z), top = 16.6 + Math.sqrt(Math.max(0, 1 - (r / 24.5) ** 2)) * 12.2 * 0.95; sti.setMatrixAt(i, G.mat(x, top - h / 2 - 0.4, z, PI, 0, 0, w, h, w)); }); grp.add(sti);
  for (let i = 0; i < 26; i++){ const a = R() * TAU, r = rr(20.5, 23); if (Math.abs(angDiff(a, 0)) < 0.3) continue; K.geo('rock2', stg, Math.sin(a) * r, 0, Math.cos(a) * r, 0, R(), 0, rr(0.3, 0.8), rr(1.2, 3.5), rr(0.3, 0.8)); }
  for (let i = 0; i < 40; i++){ const a = R() * TAU, r = rr(19.5, 23); K.geo(R() < 0.5 ? 'rock' : 'rock2', new THREE.IcosahedronGeometry(rr(0.4, 1.2), 0), Math.sin(a) * r, 0.2, Math.cos(a) * r, R(), R(), R(), 1, 0.6, 1); }
  // 상자 · 통 · 곡괭이
  for (const [x, z] of [[-6.5, 17.5], [6.2, 17.8], [-17.2, -3.5], [17.8, 1.5]]){ K.box('wood', 1.1, 1.1, 1.1, x, 0.55, z, 0, R(), 0); K.geo('woodD', new THREE.CylinderGeometry(0.45, 0.5, 1.2, 12), x + 1.2, 0.6, z + 0.4); col(x + 0.5, z + 0.2, 1.2); K.geo('woodD', new THREE.CylinderGeometry(0.04, 0.04, 1.4, 5), x - 0.8, 0.65, z, 0, 0, 0.35); K.geo('steel', new THREE.BoxGeometry(0.9, 0.12, 0.1), x - 1.02, 1.3, z, 0, 0, 0.35); }
  B.build(M, grp);
  plight(grp, 0, 6, -10, 0xff9a40, 34, 36, 1, A); plight(grp, -13, 4.5, 6, 0x3ad8ff, 16, 22, 0, A);
  shaft(grp, 0, 0, 0, 29, 6.5, 3.0, 0xffe8c0, 0.09); motes(grp, LOW ? 60 : 130, 20, 0.3, 12, 0xffd8a0, 0.1);
  const sand = G.particles(LOW ? 30 : 60, [new V3(0, 26, 0)], { parent: grp, vert: `float f = fract(uTime * 0.12 + aSeed); vL = 1.0 - f; vec3 p = position + vec3(sin(aSeed * 90.0) * 2.2, -f * 26.0, cos(aSeed * 70.0) * 2.2); float sz = 0.09;`, frag: `float a = smoothstep(0.5, 0.0, d) * vL * 0.7; gl_FragColor = vec4(vec3(1.0, 0.86, 0.6) * a, a);` });
  sand.renderOrder = 4;
}

// ── 3) 얼어붙은 제단 · 하늘 끝 제단 (크라이오스) ──
const CRYOS_MATS = () => mat('cryosMats', () => {
  const iceT = cnvTex(1024, 1024, (x, W) => { const g = x.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W * 0.7); g.addColorStop(0, '#d8eeff'); g.addColorStop(1, '#8ab4d8'); x.fillStyle = g; x.fillRect(0, 0, W, W); const rnd = srand(41);
    for (let i = 0; i < 900; i++){ x.fillStyle = `rgba(255,255,255,${0.08 + rnd() * 0.25})`; x.beginPath(); x.ellipse(rnd() * W, rnd() * W, 3 + rnd() * 26, 2 + rnd() * 10, rnd() * 3, 0, TAU); x.fill(); }
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.4; for (let i = 0; i < 40; i++){ let px = rnd() * W, py = rnd() * W; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 5; k++){ px += (rnd() - 0.5) * 90; py += (rnd() - 0.5) * 90; x.lineTo(px, py); } x.stroke(); }
    x.strokeStyle = 'rgba(60,110,170,.35)'; x.lineWidth = 2; for (let i = 0; i < 24; i++){ let px = rnd() * W, py = rnd() * W; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 4; k++){ px += (rnd() - 0.5) * 60; py += (rnd() - 0.5) * 60; x.lineTo(px, py); } x.stroke(); } }, true);
  const cloudT = cnvTex(512, 512, (x, W) => { x.clearRect(0, 0, W, W); const rnd = srand(8); for (let i = 0; i < 260; i++){ const r = 10 + rnd() * 60, cx = rnd() * W, cy = rnd() * W, g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(230,240,255,.55)'); g.addColorStop(1, 'rgba(230,240,255,0)'); x.fillStyle = g; for (const ox of [-W, 0, W]) for (const oy of [-W, 0, W]){ x.beginPath(); x.arc(cx + ox, cy + oy, r, 0, TAU); x.fill(); } } }, true, 3);
  const memT = cnvTex(256, 256, (x, W) => { const g = x.createLinearGradient(0, 0, W, W); g.addColorStop(0, 'rgba(200,240,255,.95)'); g.addColorStop(1, 'rgba(90,150,230,.75)'); x.fillStyle = g; x.fillRect(0, 0, W, W); x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 2; const rnd = srand(3); for (let i = 0; i < 18; i++){ x.beginPath(); let px = 0, py = rnd() * W; x.moveTo(px, py); for (let k = 0; k < 6; k++){ px += W / 6; py += (rnd() - 0.5) * 40; x.lineTo(px, py); } x.stroke(); } }, true);
  return {
    ice: std({ map: iceT, roughness: 0.22, metalness: 0.12, color: 0xffffff, emissive: 0x0a2a4a, emissiveIntensity: 0.4 }),
    cliff: std({ color: 0x9ac0e0, roughness: 0.4, metalness: 0.1, flatShading: true, emissive: 0x0a1a3a, emissiveIntensity: 0.3 }), rockI: std({ color: 0x4a5a72, roughness: 0.85, flatShading: true }),
    pillar: std({ color: 0xbfe8ff, emissive: 0x3aa8ff, emissiveIntensity: 0.45, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.86, flatShading: true }),
    crys: std({ color: 0xe8fbff, emissive: 0x6ad8ff, emissiveIntensity: 0.9, roughness: 0.05, flatShading: true, transparent: true, opacity: 0.9 }),
    stone: std({ map: G.T.stone, color: 0x9aaac8, roughness: 0.8 }), dark: std({ color: 0x1a2a3a, roughness: 0.6 }), iron: X.M.iron, snow: std({ color: 0xf4f8ff, roughness: 0.9 }),
    cloud: new THREE.MeshBasicMaterial({ map: cloudT, transparent: true, opacity: 0.85, depthWrite: false, fog: true, color: 0xb8c8e8 }), mem: memT,
    rune: X.ADDM(G.tex(G.runeStrip(2048, 128, 30, '#8ae8ff', 0, 17), true, 1, 1), 0.9),
  };
});
const auroraMat = () => mat('aurora', () => new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  vertexShader: `varying vec2 vU; uniform float uT; void main(){ vU = uv; vec3 p = position; p.y += sin(uv.x * 18.0 + uT * 0.4) * 6.0 + sin(uv.x * 7.0 - uT * 0.25) * 9.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
  fragmentShader: `varying vec2 vU; uniform float uT; void main(){ float bands = 0.55 + 0.45 * sin(vU.x * 120.0 + sin(vU.x * 9.0 + uT * 0.6) * 6.0); float a = pow(1.0 - vU.y, 1.6) * smoothstep(0.0, 0.12, vU.y) * smoothstep(0.0, 0.08, vU.x) * smoothstep(1.0, 0.92, vU.x) * bands;
    vec3 c = mix(vec3(0.2, 1.0, 0.6), vec3(0.5, 0.4, 1.0), smoothstep(0.35, 0.9, vU.y)); c = mix(c, vec3(0.3, 0.9, 1.0), 0.5 + 0.5 * sin(vU.x * 6.0 + uT * 0.3)); gl_FragColor = vec4(c * a * 0.75, a * 0.75); }` }));
function buildCryosArena(grp, ctx){
  const M = CRYOS_MATS(), B = new G.Builder(), K = new G.Kit(B), col = (x, z, r) => ctx.SCOL.push({ t: 'c', x, z, r }), A = ctx.anims, RP = 22.6;
  // 떠 있는 얼음 원반 (윗면 · 절벽 · 밑동)
  const top = mesh(meterUV(new THREE.CircleGeometry(RP, 80).rotateX(-HPI), 14), M.ice, grp, 0, 0, 0, false); top.receiveShadow = true;
  const sideG = new THREE.CylinderGeometry(RP, RP - 1.4, 3, 80, 3, true); { const p = sideG.attributes.position; for (let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z), k = 1 + (y < 1.4 ? (Math.sin(a * 23) * 0.012 + Math.sin(a * 7) * 0.01) : 0); p.setXYZ(i, x * k, y, z * k); } sideG.computeVertexNormals(); }
  mesh(sideG, M.cliff, grp, 0, -1.5, 0, false);
  const under = new THREE.ConeGeometry(RP - 1.4, 26, 48, 8, true); { const p = under.attributes.position, v = new V3(); for (let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i); const a = Math.atan2(v.x, v.z), k = 1 + Math.sin(a * 9 + v.y * 0.4) * 0.08 + (hash3(Math.round(v.x), Math.round(v.y), Math.round(v.z)) - 0.5) * 0.16; p.setXYZ(i, v.x * k, v.y, v.z * k); } under.computeVertexNormals(); }
  const um = mesh(under, M.rockI, grp, 0, -16, 0, false); um.rotation.x = PI;
  // 다리 (남쪽 입구) · 얼어붙은 아치
  K.box('cliff', 6.2, 1.2, 9, 0, -0.6, 27); for (const s of [-1, 1]) for (let j = 0; j < 4; j++) K.box('cliff', 0.6, rr(0.5, 1.1), 1.8, s * 2.9, 0.3, 23.5 + j * 2.2);
  K.push(0, 0, 31.4); for (const s of [-1, 1]) K.geo('pillar', new THREE.CylinderGeometry(0.8, 1.0, 7.5, 6), s * 3.4, 3.75, 0); K.geo('pillar', new THREE.TorusGeometry(3.4, 0.6, 6, 16, PI), 0, 7.4, 0); K.pop();
  const gate = new THREE.Mesh(new THREE.CircleGeometry(1, 32).scale(2.8, 3.6, 1), addM(0x8ae8ff, 0.4)); gate.position.set(0, 3.8, 31.4); grp.add(gate); A.push(() => { gate.material.opacity = 0.3 + Math.sin(G.time * 2) * 0.1; });
  // 가장자리 얼음 성가퀴 · 고드름
  for (let i = 0; i < 46; i++){ const a = i / 46 * TAU; if (Math.abs(angDiff(a, 0)) < 0.16 || R() < 0.22) continue; const h = rr(0.5, 1.7); K.push(Math.sin(a) * (RP - 0.6), 0, Math.cos(a) * (RP - 0.6), a); K.box('cliff', rr(1.6, 2.6), h, 0.9, 0, h / 2, 0, rr(-0.08, 0.08), 0, rr(-0.1, 0.1)); if (R() < 0.5) K.box('snow', 1.6, 0.18, 0.95, 0, h + 0.05, 0); K.pop(); }
  const icG = new THREE.ConeGeometry(1, 1, 5), ics = []; for (let i = 0; i < (LOW ? 40 : 80); i++){ const a = R() * TAU, r = RP - rr(0.4, 2.2), h = rr(1, 5); ics.push([Math.sin(a) * r, Math.cos(a) * r, h]); }
  const ici = new THREE.InstancedMesh(icG, M.crys, ics.length); ics.forEach(([x, z, h], i) => ici.setMatrixAt(i, G.mat(x, -3 - h / 2, z, PI, 0, 0, rr(0.2, 0.45), h, rr(0.2, 0.45)))); grp.add(ici);
  // 제단 (가운데): 육각 단 · 깨진 봉인 수정 · 끊어진 사슬 · 룬 원
  K.geo('stone', new THREE.CylinderGeometry(3.4, 3.6, 0.22, 6), 0, 0.11, 0); K.geo('dark', new THREE.CylinderGeometry(2.6, 2.6, 0.06, 6), 0, 0.23, 0);
  for (let i = 0; i < 6; i++){ const a = i / 6 * TAU + 0.3, g = new THREE.OctahedronGeometry(1, 0); g.scale(0.3, rr(0.6, 1.3), 0.3); K.geo('crys', g, Math.sin(a) * rr(0.6, 1.6), 0.5, Math.cos(a) * rr(0.6, 1.6), rr(-1.2, 1.2), R(), rr(-1.2, 1.2)); }
  for (let i = 0; i < 4; i++){ const a = i / 4 * TAU + PI / 4, px = Math.sin(a) * 5.2, pz = Math.cos(a) * 5.2; K.geo('stone', new THREE.CylinderGeometry(0.35, 0.45, 2.2, 8), px, 1.1, pz); K.geo('iron', new THREE.TorusGeometry(0.5, 0.08, 6, 12), px, 2.0, pz, HPI, 0, 0); col(px, pz, 0.55);
    for (let j = 0; j < 7; j++){ const t = j / 7, lx = px * (1 - t * 0.7) + rr(-0.15, 0.15), lz = pz * (1 - t * 0.7) + rr(-0.15, 0.15); K.geo('iron', new THREE.TorusGeometry(0.22, 0.06, 5, 10), lx, 0.08, lz, HPI * (j % 2), a, 0); } }
  const rn = new THREE.Mesh(X.polarRing(5.8, 6.9, 128), M.rune); rn.position.y = 0.04; grp.add(rn); A.push(dt => { rn.rotation.y -= dt * 0.04; });
  // 얼음 기둥 6개 (폭풍 때 숨는 곳)
  ctx.pillars = [];
  for (let i = 0; i < 6; i++){ const a = i / 6 * TAU + PI / 6, x = Math.sin(a) * 12.6, z = Math.cos(a) * 12.6;
    K.push(x, 0, z, a); K.geo('stone', new THREE.CylinderGeometry(1.9, 2.1, 0.5, 6), 0, 0.25, 0); K.geo('pillar', new THREE.CylinderGeometry(1.25, 1.45, 8.8, 6), 0, 4.9, 0); K.geo('pillar', new THREE.ConeGeometry(1.25, 1.6, 6), 0, 10.1, 0);
    for (let j = 0; j < 4; j++){ const g = new THREE.OctahedronGeometry(1, 0); g.scale(0.25, rr(0.7, 1.4), 0.25); K.geo('crys', g, rr(-0.9, 0.9), rr(1.2, 9), rr(-0.9, 0.9), rr(-0.8, 0.8), R(), rr(-0.8, 0.8)); }
    K.box('snow', 1.6, 0.25, 1.6, 0, 0.55, 0, 0, 0.5, 0); K.pop(); col(x, z, 1.55); ctx.pillars.push({ x, z, r: 1.55 }); glowAt(grp, x, 9.6, z, 0x8ad8ff, 4.5, 0.35); }
  // 구름 바다 · 먼 봉우리 · 떠다니는 얼음 조각 · 오로라
  const cl = mesh(new THREE.PlaneGeometry(900, 900).rotateX(-HPI), M.cloud, grp, 0, -36, 0, false); cl.renderOrder = -1; const cl2 = mesh(new THREE.PlaneGeometry(900, 900).rotateX(-HPI), M.cloud.clone(), grp, 0, -58, 0, false); cl2.material.opacity = 0.6; cl2.material.map = M.cloud.map.clone(); cl2.material.map.repeat.set(2, 2);
  A.push(dt => { M.cloud.map.offset.x += dt * 0.0025; cl2.material.map.offset.y += dt * 0.0016; });
  for (let i = 0; i < 9; i++){ const a = i / 9 * TAU + rr(-0.2, 0.2), r = rr(260, 360), h = rr(170, 280); K.geo('snow', new THREE.ConeGeometry(rr(60, 110), h, 7), Math.sin(a) * r, -110 + h / 2, Math.cos(a) * r, 0, R(), 0); K.geo('rockI', new THREE.ConeGeometry(rr(70, 120), h * 0.6, 7), Math.sin(a) * r + 20, -120 + h * 0.3, Math.cos(a) * r, 0, R(), 0); }
  const FLOAT = []; for (let i = 0; i < 10; i++){ const a = i / 10 * TAU + rr(-0.2, 0.2), r = rr(30, 46), o = new THREE.Group(); o.position.set(Math.sin(a) * r, rr(-8, 5), Math.cos(a) * r); grp.add(o);
    mesh(rockGeo(rr(1.4, 3.2), 1, 0.25, i), M.cliff, o).scale.y = 0.6; const sp = mesh(new THREE.ConeGeometry(rr(1, 2), rr(3, 6), 6), M.rockI, o, 0, -2.4, 0); sp.rotation.x = PI; FLOAT.push([o, o.position.y, R() * 6]); }
  A.push(() => { for (const [o, y0, p] of FLOAT){ o.position.y = y0 + Math.sin(G.time * 0.4 + p) * 0.8; o.rotation.y += 0.0012; } });
  for (let i = 0; i < 3; i++){ const g = new THREE.PlaneGeometry(1, 1, 80, 1), p = g.attributes.position, a0 = -1.2 + i * 0.85 + PI, rad = 230 + i * 30;
    for (let j = 0; j < p.count; j++){ const u = p.getX(j) + 0.5, v = p.getY(j) + 0.5, a = a0 + (u - 0.5) * 1.6; p.setXYZ(j, Math.sin(a) * rad, 70 + i * 12 + v * 70, Math.cos(a) * rad); }
    const au = new THREE.Mesh(g, auroraMat()); au.frustumCulled = false; au.renderOrder = -2; grp.add(au); }
  A.push(dt => { auroraMat().uniforms.uT.value += dt; });
  B.build(M, grp);
  plight(grp, 0, 4.5, 0, 0x8ad8ff, 22, 30, 0, A); glowAt(grp, 0, 1.2, 0, 0x8ae8ff, 7, 0.5);
  // 눈보라 (평소) · 폭풍 (얼어붙는 폭풍 때만)
  const snowV = (sp, drift, sz) => `float f = fract(uTime * ${sp} + aSeed); vL = smoothstep(0.0, 0.1, f) * smoothstep(1.0, 0.85, f); vec3 p = vec3(mod(position.x + uTime * ${drift} + sin(uTime + aSeed * 40.0) * 1.5 + 30.0, 60.0) - 30.0, 16.0 - f * 17.0, position.z + cos(uTime * 0.7 + aSeed * 30.0) * 1.5); float sz = ${sz};`;
  const sb = []; for (let i = 0; i < 40; i++) sb.push(new V3(rr(-30, 30), 0, rr(-30, 30)));
  G.particles(LOW ? 220 : 480, sb, { parent: grp, vert: snowV('0.06', '1.5', '0.11'), frag: `float a = smoothstep(0.5, 0.1, d) * vL * 0.9; gl_FragColor = vec4(vec3(0.95, 0.97, 1.0) * a, a);`, blend: THREE.NormalBlending });
  ctx.storm = G.particles(LOW ? 300 : 700, sb, { parent: grp, vert: snowV('0.22', '14.0', '0.16'), frag: `float a = smoothstep(0.5, 0.1, d) * vL * 0.95; gl_FragColor = vec4(vec3(0.9, 0.95, 1.0) * a, a);`, blend: THREE.NormalBlending });
  ctx.storm.visible = false;
}

// ───────────────────────── 보스 · 쫄몹 모델 (직접 만든 모양) ─────────────────────────
// 늪의 왕 그롬 — 사마귀투성이 거대 두꺼비 왕 (왕관 · 망토 · 목주머니 · 혀)
function mkGrom(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const torso = new THREE.Group(); body.add(torso);
  const upG = geo('gromUp', () => { const q = blobGeo(2.3, 1.28, 0.68, 1.12, 56, 90, 0.17, 77, 0.006, 0.024), B = q.userData.bumps, n = new V3();
    return paint(q, (x, y, z) => { n.set(x / 1.28, y / 0.68, z / 1.12).normalize(); let w = 0; for (const [bx, by, bz, ww] of B){ const d = 1 - (n.x * bx + n.y * by + n.z * bz); if (d < ww) w = Math.max(w, 1 - d / ww); }
      const sp = hash3(Math.round(x * 1.4), Math.round(y * 1.4), Math.round(z * 1.4)); let c = mix3(C3(0x3c5a22), C3(0x5e7e2c), sp * 0.7); c = mix3(c, C3(0x24341a), sstep(0.62, 0.9, sp) * 0.8);
      c = mix3(c, C3(0x9ab43e), w * 0.75); return mix3(c, C3(0xc8c070), sstep(0.55, 0.95, n.z - n.y * 1.4) * 0.6); }); });
  const loG = geo('gromLo', () => { const q = blobGeo(2.2, 1.25, 0.57, 1.07, 48, 40, 0.1, 31, 0.006, 0.02), n = new V3();
    return paint(q, (x, y, z) => { n.set(x / 1.25, y / 0.57, z / 1.07).normalize(); const belly = sstep(-0.1, 0.55, n.z * 0.8 - n.y * 0.6 - Math.abs(n.x) * 0.35), sp = hash3(Math.round(x * 2), Math.round(y * 2), Math.round(z * 2));
      return mix3(mix3(C3(0x4a6a26), C3(0x2e4418), sp * 0.5), mix3(C3(0xe0d690), C3(0xc8b870), sp * 0.4), belly); }); });
  const skin = std({ vertexColors: true, roughness: 0.38, metalness: 0.02 }), skin2 = std({ vertexColors: true, roughness: 0.5 }), skinP = std({ color: 0x4e6e2a, roughness: 0.45 }),
    pale = std({ color: 0xd8cc84, roughness: 0.5 }), dark = std({ color: 0x1c2812, roughness: 0.6 }), mawM = std({ color: 0x5a0e1a, roughness: 0.7, emissive: 0x200408, emissiveIntensity: 1 }),
    tongueM = std({ color: 0xff6a8c, roughness: 0.3, emissive: 0x501020, emissiveIntensity: 1 }), capeM = std({ color: 0x4a1a64, roughness: 0.85, side: THREE.DoubleSide }), trimM = X.M.gold;
  const eyeM = std({ color: 0xffd23a, roughness: 0.12, emissive: 0xffa010, emissiveIntensity: 0.25 }), pupM = basic(0x0a0806), pustM = std({ color: 0xa8ff5a, emissive: 0x5aff2a, emissiveIntensity: 0.5, roughness: 0.25 });
  // 머리(윗몸) · 아래턱(배) — 둘이 벌어지면 입이 열려요
  const head = new THREE.Group(); head.position.set(0, 2.05, -1.5); torso.add(head);
  mesh(upG, skin, head, 0, 0.3, 1.3);
  const jaw = new THREE.Group(); jaw.position.set(0, 1.95, -1.5); torso.add(jaw);
  mesh(loG, skin2, jaw, 0, -0.65, 1.75);
  const sac = mesh(new THREE.SphereGeometry(0.85, 22, 16), pale, jaw, 0, -1.0, 3.45); sac.scale.set(1.2, 0.8, 0.75);
  mesh(new THREE.SphereGeometry(1, 28, 16), mawM, torso, 0, 1.72, 0.55).scale.set(2.4, 0.66, 1.72);
  const tongue = new THREE.Group(); tongue.position.set(0, 1.72, 1.4); torso.add(tongue);
  const tStem = mesh(new THREE.CylinderGeometry(0.2, 0.26, 1, 12).rotateX(HPI).translate(0, 0, 0.5), tongueM, tongue); tStem.scale.z = 0.01;
  const tTip = mesh(new THREE.SphereGeometry(0.42, 14, 10), tongueM, tongue); tTip.scale.set(1.1, 0.8, 1); tTip.visible = false;
  // 눈 (튀어나온 둔덕 · 노란 눈알 · 가로 동공 · 눈꺼풀 · 눈썹)
  const eyes = [], lids = [];
  for (const s of [-1, 1]){
    mesh(new THREE.SphereGeometry(0.7, 20, 14), skinP, head, s * 1.08, 1.2, 2.62).scale.set(1, 0.9, 1);
    const eb = mesh(new THREE.SphereGeometry(0.54, 20, 14), eyeM, head, s * 1.08, 1.34, 2.86); eyes.push(eb);
    mesh(new THREE.BoxGeometry(0.62, 0.15, 0.05), pupM, head, s * 1.08, 1.34, 3.39, false);
    const lp = new THREE.Group(); lp.position.set(s * 1.08, 1.34, 2.86); head.add(lp); const lid = mesh(new THREE.SphereGeometry(0.585, 20, 10, 0, TAU, 0, HPI), skinP, lp); lid.rotation.x = -1.2; lids.push(lid);
    const brow = mesh(new THREE.CapsuleGeometry(0.16, 0.8, 4, 8), dark, head, s * 1.1, 1.92, 2.82); brow.rotation.set(0, 0, HPI + s * 0.32);
    mesh(new THREE.SphereGeometry(0.1, 8, 6), dark, head, s * 0.36, 0.62, 3.65);
  }
  // 왕관 (기울어진 금관 · 에메랄드)
  const crown = X.MK.addCrown(head, 0, 0.82, 0.55); crown.position.set(0.15, 1.92, 1.55); crown.rotation.set(-0.12, 0.2, 0.14);
  const gem = mesh(new THREE.OctahedronGeometry(0.24, 0), basic(0x6aff6a), crown, 0, 0.32, 0.82, false); gem.scale.y = 1.4;
  const crownGlow = X.glowSprite(0x8aff6a, 1.8, 0.5); crownGlow.position.set(0, 0.32, 0.85); crown.add(crownGlow);
  // 독 고름 (등) · 이끼 · 갈대
  const pusts = []; { const rnd = srand(5); for (let i = 0; i < 16; i++){ const u = 0.25 + rnd() * 0.7, a = PI * 0.25 + rnd() * PI * 1.5, s = Math.sqrt(1 - u * u), n = new V3(Math.sin(a) * s, u, Math.cos(a) * s); if (n.z > 0.45) continue;
    const p = mesh(new THREE.SphereGeometry(rr(0.11, 0.22), 10, 8), pustM, head, n.x * 2.85, 0.3 + n.y * 1.5, 1.3 + n.z * 2.5); pusts.push(p); } }
  for (const [x, y, z, s] of [[1.1, 1.75, 0.2, 0.55], [-1.3, 1.6, -0.1, 0.5], [0.2, 1.85, -0.6, 0.4]]){ const r = new THREE.Mesh(X.treeGeo('reed'), X.TREEMAT); r.position.set(x, y, z); r.scale.setScalar(s); head.add(r); mesh(new THREE.IcosahedronGeometry(0.5, 0), std({ color: 0x3a5a24, flatShading: true, roughness: 0.9 }), head, x, y - 0.05, z).scale.set(1.5, 0.35, 1.2); }
  // 망토 (등을 감싸는 해진 보라 망토 · 금테)
  const capeG = new THREE.CylinderGeometry(3.05, 3.5, 2.6, 30, 6, true, PI - 1.45, 2.9); { const p = capeG.attributes.position, rnd = srand(9); for (let i = 0; i < p.count; i++){ const y = p.getY(i); if (y < -1.2){ const x = p.getX(i), z = p.getZ(i), cut = rnd() * 0.5; p.setXYZ(i, x * 1.04, y + cut, z * 1.04); } } capeG.computeVertexNormals(); }
  const cape = mesh(capeG, capeM, torso, 0, 2.15, -0.55); cape.rotation.x = -0.12;
  mesh(new THREE.CylinderGeometry(3.08, 3.12, 0.22, 30, 1, true, PI - 1.45, 2.9), trimM, torso, 0, 3.4, -0.55).rotation.x = -0.12;
  mesh(new THREE.SphereGeometry(0.28, 12, 8), trimM, torso, 1.55, 3.3, 1.2); mesh(new THREE.SphereGeometry(0.28, 12, 8), trimM, torso, -1.55, 3.3, 1.2);
  // 앞발 · 뒷다리
  const arms = [];
  for (const s of [-1, 1]){
    const a = new THREE.Group(); a.position.set(s * 2.25, 1.7, 1.15); torso.add(a); arms.push(a);
    const up = mesh(new THREE.CylinderGeometry(0.42, 0.34, 1.5, 12), skinP, a, 0, -0.62, 0.2); up.rotation.x = 0.3;
    mesh(new THREE.SphereGeometry(0.55, 14, 10), skinP, a, 0, -1.42, 0.5).scale.set(1.25, 0.42, 1.35);
    for (let f = -1; f <= 1; f++) mesh(new THREE.SphereGeometry(0.17, 8, 6), pale, a, f * 0.36, -1.45, 1.15);
    const th = mesh(new THREE.SphereGeometry(1, 20, 14), skinP, torso, s * 2.35, 1.1, -1.15); th.scale.set(0.95, 0.85, 1.55); th.rotation.y = s * 0.45;
    mesh(new THREE.SphereGeometry(1, 14, 10), skinP, torso, s * 2.85, 0.2, 0.25).scale.set(0.75, 0.24, 1.25);
    for (let f = -1; f <= 1; f++) mesh(new THREE.SphereGeometry(0.2, 8, 6), pale, torso, s * 2.85 + f * 0.42, 0.18, 1.35);
  }
  return { g, body, mats: [skin, skin2, skinP, pale, dark, capeM], kind: 'rgrom', torso, head, jaw, sac, tongue, tStem, tTip, eyes, lids, eyeM, pustM, pusts, crown, crownGlow, arms, gem };
}
// 바위 거인 그라녹 — 가슴 속 수정 핵 · 바위 주먹 · 등의 수정
function mkGranok(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const rk = std({ vertexColors: true, flatShading: true, roughness: 0.92 }), mossM = std({ color: 0x4a6a2e, flatShading: true, roughness: 0.95 });
  const amber = std({ color: 0xffb060, emissive: 0xff7a1a, emissiveIntensity: 1.2, roughness: 0.12, flatShading: true }), cyan = std({ color: 0x9af4ff, emissive: 0x2ac0ff, emissiveIntensity: 1.1, roughness: 0.12, flatShading: true });
  const coreM = basic(0xffa040), eyeM = basic(0xffb050), veinM = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false });
  const rp = (x, y, z) => { const n = hash3(Math.round(x * 3), Math.round(y * 3), Math.round(z * 3)); return mix3(mix3(C3(0x5a4c40), C3(0x8a7a68), n), C3(0x6a7a4a), sstep(0.7, 1.0, y) * 0.5 * n); };
  let seed = 1; const R1 = (r, det, sx = 1, sy = 1, sz = 1) => paint(rockGeo(r, det, 0.22, seed++, sx, sy, sz), rp);
  const legs = [];
  for (const s of [-1, 1]){ const l = new THREE.Group(); l.position.set(s * 1.05, 2.55, 0); body.add(l); legs.push(l);
    mesh(R1(0.8, 1, 1, 1.25, 1), rk, l, 0, -0.55, 0); mesh(R1(0.72, 1), rk, l, 0, -1.45, 0.12); mesh(R1(0.92, 1, 1.2, 0.5, 1.5), rk, l, 0, -2.25, 0.42); }
  mesh(R1(1.25, 1, 1.35, 0.75, 1.0), rk, body, 0, 2.75, 0);
  const chest = new THREE.Group(); chest.position.set(0, 3.3, 0); body.add(chest);
  mesh(R1(1.95, 1, 1.3, 1.05, 0.95), rk, chest, 0, 1.55, -0.25);
  const core = mesh(new THREE.IcosahedronGeometry(0.62, 0), coreM, chest, 0, 1.5, 1.32, false); const coreGlow = X.glowSprite(0xff9a3a, 5, 0.85); coreGlow.position.set(0, 1.5, 1.6); chest.add(coreGlow);
  for (const [x, y, sx, sy, rz] of [[0, 2.25, 2.2, 0.38, 0.05], [0, 0.78, 2.0, 0.36, -0.06], [0.8, 1.5, 0.38, 1.7, 0.1], [-0.8, 1.5, 0.38, 1.7, -0.1]]) mesh(R1(0.5, 0, sx, sy, 0.55), rk, chest, x, y, 1.42).rotation.z = rz;
  const plates = [];
  for (const [x, y, z, sx, sy, sz, rx, rz] of [[1.55, 2.55, 0.65, 1.3, 0.42, 1.1, 0.3, -0.5], [-1.55, 2.55, 0.65, 1.3, 0.42, 1.1, 0.3, 0.5], [0, 2.95, 0.55, 1.5, 0.4, 1.0, 0.25, 0], [0, 0.35, 0.95, 1.4, 0.45, 0.8, -0.2, 0]]){ const p = mesh(R1(0.8, 0, sx, sy, sz), rk, chest, x, y, z); p.rotation.set(rx, 0, rz); plates.push(p); }
  const shoulders = [];
  for (const s of [-1, 1]){ const sh = mesh(R1(1.08, 1, 1.1, 0.95, 1.05), rk, chest, s * 2.15, 2.35, -0.1); shoulders.push(sh);
    for (let i = 0; i < 4; i++){ const cg = new THREE.OctahedronGeometry(1, 0); cg.scale(0.22, rr(0.6, 1.1), 0.22); const c = mesh(cg, i % 2 ? amber : cyan, chest, s * (2.0 + rr(-0.3, 0.5)), 3.1 + rr(0, 0.3), rr(-0.6, 0.3)); c.rotation.set(rr(-0.5, 0.2), R(), s * rr(0.2, 0.7)); } }
  for (let i = 0; i < 6; i++){ const cg = new THREE.OctahedronGeometry(1, 0); cg.scale(0.32, rr(1.0, 1.9), 0.32); const c = mesh(cg, i % 3 ? amber : cyan, chest, rr(-1.3, 1.3), rr(1.6, 2.9), -1.75); c.rotation.set(-0.7 + rr(-0.3, 0.3), R(), rr(-0.5, 0.5)); }
  const head = new THREE.Group(); head.position.set(0, 3.15, 0.55); chest.add(head);
  mesh(R1(0.72, 1, 1.15, 0.85, 1.05), rk, head, 0, 0, 0); mesh(R1(0.42, 0, 2.2, 0.45, 0.8), rk, head, 0, 0.3, 0.45); mesh(R1(0.45, 0, 1.6, 0.5, 1.1), rk, head, 0, -0.45, 0.3);
  mesh(new THREE.IcosahedronGeometry(0.62, 0), mossM, head, 0, 0.55, -0.05).scale.set(1.3, 0.35, 1.2);
  for (const s of [-1, 1]){ mesh(new THREE.BoxGeometry(0.3, 0.08, 0.06), eyeM, head, s * 0.27, 0.1, 0.7, false); const eg = X.glowSprite(0xffa040, 0.9, 0.8); eg.position.set(s * 0.27, 0.1, 0.78); head.add(eg); }
  const arms = [], elbows = [];
  for (const s of [-1, 1]){ const a = new THREE.Group(); a.position.set(s * 2.3, 2.15, 0); chest.add(a); arms.push(a);
    mesh(R1(0.72, 1, 0.9, 1.55, 0.9), rk, a, s * 0.22, -1.0, 0); const el = new THREE.Group(); el.position.set(s * 0.32, -2.05, 0.1); a.add(el); elbows.push(el);
    mesh(R1(0.78, 1, 1.0, 1.35, 1.0), rk, el, 0, -0.75, 0); mesh(R1(1.02, 1, 1.15, 1.0, 1.2), rk, el, 0, -1.85, 0.15);
    for (let i = 0; i < 3; i++){ const cg = new THREE.OctahedronGeometry(1, 0); cg.scale(0.14, 0.45, 0.14); const c = mesh(cg, cyan, el, (i - 1) * 0.45, -1.4, 1.05); c.rotation.x = 1.1; } }
  const veins = []; { const rnd = srand(17); for (let i = 0; i < 14; i++){ const parent = i < 8 ? chest : i < 11 ? arms[0] : arms[1], v = mesh(new THREE.BoxGeometry(0.07, rr(0.6, 1.4), 0.07), veinM, parent, 0, 0, 0, false);
    if (i < 8) v.position.set(rr(-1.9, 1.9), rr(0.6, 2.6), rr(0.9, 1.5)); else v.position.set(rr(-0.5, 0.5), rr(-1.6, -0.4), rr(0.4, 0.75)); v.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); veins.push(v); } }
  const orbit = new THREE.Group(); orbit.position.set(0, 4.6, 0); orbit.visible = false; body.add(orbit);
  for (let i = 0; i < 7; i++){ const a = i / 7 * TAU, o = mesh(R1(rr(0.3, 0.55), 0), rk, orbit, Math.cos(a) * 3.8, rr(-0.8, 1.2), Math.sin(a) * 3.8); o.userData.a = a; }
  return { g, body, mats: [rk, mossM], kind: 'rgranok', legs, chest, head, arms, elbows, core, coreGlow, coreM, plates, veins, veinM, orbit, eyeM, amber, cyan };
}
// 서리 거룡 크라이오스 — 긴 목 · 얼음 뿔 · 날개 막 · 얼음 칼날 꼬리
function wingGeo(){
  const P = [[0, 0, 0.7], [3.2, 0.45, 0.25], [6.7, 0.6, -0.35], [8.4, 0.1, -2.6], [6.9, -0.05, -3.2], [6.5, 0, -4.6], [4.7, -0.05, -3.7], [4.1, -0.1, -4.9], [2.3, -0.1, -3.9], [1.2, -0.15, -4.1], [0.3, -0.2, -2.6]], C = [3.6, 0, -2.1], pos = [], uv = [];
  for (let i = 0; i < P.length; i++){ for (const q of [C, P[i], P[(i + 1) % P.length]]){ pos.push(q[0], q[1], q[2]); uv.push(q[0] / 8.5, -q[2] / 5); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); g.userData.P = P; return g;
}
function boneBetween(a, b, r, m, parent){ const A = new V3(...a), Bv = new V3(...b), d = Bv.clone().sub(A), L = d.length(), o = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r, L, 7), m); o.position.copy(A).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize()); o.castShadow = true; parent.add(o); return o; }
function mkCryos(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const scaleG = n => geo('cryScale' + n, () => paint(new THREE.SphereGeometry(1, n, Math.round(n * 0.7)), (x, y, z, nx, ny) => mix3(C3(0xe6f2ff), C3(0x5a84c8), sstep(-0.15, 0.75, ny))));
  const sc = std({ vertexColors: true, roughness: 0.32, metalness: 0.12 }), pale = std({ color: 0xeef6ff, roughness: 0.4 }), horn = std({ color: 0xf2f6ff, roughness: 0.3 }), dark = std({ color: 0x1a2438, roughness: 0.5 });
  const crys = std({ color: 0xe8fbff, emissive: 0x6ad8ff, emissiveIntensity: 0.9, roughness: 0.05, flatShading: true, transparent: true, opacity: 0.9 }), eyeM = basic(0x9af8ff);
  const memM = std({ map: CRYOS_MATS().mem, transparent: true, opacity: 0.88, side: THREE.DoubleSide, roughness: 0.3, emissive: 0x2a6aa8, emissiveIntensity: 0.4 });
  const torso = mesh(scaleG(28), sc, body, 0, 3.45, 0); torso.scale.set(1.55, 1.35, 2.35); torso.rotation.x = -0.12;
  mesh(new THREE.SphereGeometry(1, 22, 14), pale, body, 0, 3.0, 0.75).scale.set(1.2, 1.0, 1.55);
  for (let i = 0; i < 6; i++){ const cg = new THREE.OctahedronGeometry(1, 0); cg.scale(0.18, 0.75 - i * 0.06, 0.32); const c = mesh(cg, crys, body, 0, 4.75 - i * 0.05, 1.2 - i * 0.62); c.rotation.x = -0.5; }
  // 목 (7 마디) · 머리
  const neck = []; for (let i = 0; i < 7; i++){ const r = 0.98 - i * 0.06, s = mesh(scaleG(16), sc, body); s.scale.setScalar(r); neck.push(s); if (i % 2){ const cg = new THREE.OctahedronGeometry(1, 0); cg.scale(0.12, 0.42, 0.22); const c = mesh(cg, crys, s, 0, 0.95, 0); c.scale.multiplyScalar(1 / r); } }
  const head = new THREE.Group(); body.add(head);
  mesh(scaleG(18), sc, head, 0, 0, 0).scale.set(0.82, 0.62, 1.05);
  mesh(new THREE.CylinderGeometry(0.3, 0.52, 1.7, 10).rotateX(HPI), sc, head, 0, -0.08, 1.15).scale.set(1, 0.72, 1);
  for (const s of [-1, 1]){ for (let i = 0; i < 4; i++) mesh(new THREE.ConeGeometry(0.05, 0.22, 4), horn, head, s * (0.32 - i * 0.04), -0.32, 0.55 + i * 0.33).rotation.x = PI;
    const h1 = mesh(new THREE.ConeGeometry(0.17, 1.7, 7), horn, head, s * 0.42, 0.42, -0.55); h1.rotation.set(-2.0, 0, s * 0.35);
    const h2 = mesh(new THREE.ConeGeometry(0.1, 0.9, 6), horn, head, s * 0.55, 0.0, -0.45); h2.rotation.set(-1.9, 0, s * 0.9);
    const fin = new THREE.OctahedronGeometry(1, 0); fin.scale(0.06, 0.35, 0.5); const fr = mesh(fin, crys, head, s * 0.62, -0.15, -0.1); fr.rotation.set(0.2, s * 0.5, s * 0.3);
    mesh(new THREE.SphereGeometry(0.12, 10, 8), eyeM, head, s * 0.44, 0.2, 0.5, false); const eg = X.glowSprite(0x8af0ff, 1.0, 0.85); eg.position.set(s * 0.5, 0.2, 0.56); head.add(eg); }
  for (let i = 0; i < 3; i++){ const cg = new THREE.OctahedronGeometry(1, 0); cg.scale(0.1, 0.5 - i * 0.08, 0.3); const c = mesh(cg, crys, head, 0, 0.5, 0.25 - i * 0.4); c.rotation.x = -0.9; }
  const jaw = new THREE.Group(); jaw.position.set(0, -0.32, -0.15); head.add(jaw);
  mesh(new THREE.CylinderGeometry(0.22, 0.42, 1.75, 8).rotateX(HPI), pale, jaw, 0, -0.08, 1.05).scale.set(1, 0.55, 1);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) mesh(new THREE.ConeGeometry(0.045, 0.2, 4), horn, jaw, s * (0.25 - i * 0.035), 0.08, 0.5 + i * 0.33);
  mesh(new THREE.SphereGeometry(1, 14, 10), basic(0x2a6aa8), head, 0, -0.3, 0.9, false).scale.set(0.3, 0.12, 0.8);
  const mouth = new THREE.Object3D(); mouth.position.set(0, -0.32, 2.05); head.add(mouth);
  // 꼬리 (11 마디 + 얼음 칼날)
  const tail = []; for (let i = 0; i < 11; i++){ const r = 0.78 - i * 0.055, s = mesh(scaleG(14), sc, body); s.scale.setScalar(r); tail.push(s); if (i % 2 === 0 && i < 9){ const cg = new THREE.OctahedronGeometry(1, 0); cg.scale(0.12, 0.45, 0.22); const c = mesh(cg, crys, s, 0, 0.9, 0); c.scale.multiplyScalar(1 / r); c.rotation.x = 0.5; } }
  const blade = new THREE.OctahedronGeometry(1, 0); blade.scale(0.12, 0.55, 1.25); const bl = mesh(blade, crys, body); tail.push(bl);
  // 날개 (뼈 + 막) — 땅에서는 접고, 하늘에서는 펄럭여요
  const wgeo = geo('cryWing', wingGeo), wings = [];
  for (const s of [-1, 1]){ const w = new THREE.Group(); w.position.set(s * 1.0, 4.55, 0.85); w.scale.x = s; body.add(w); const P = wgeo.userData.P;
    mesh(wgeo, memM, w); boneBetween(P[0], P[1], 0.2, sc, w); boneBetween(P[1], P[2], 0.16, sc, w); for (const i of [3, 5, 7]) boneBetween(P[2], P[i], 0.08, horn, w); boneBetween(P[1], P[9], 0.07, horn, w);
    mesh(new THREE.ConeGeometry(0.1, 0.5, 5), horn, w, P[2][0], P[2][1] + 0.2, P[2][2]).rotation.z = -0.4; wings.push(w); }
  // 뒷다리
  const legs = [];
  for (const s of [-1, 1]){ const l = new THREE.Group(); l.position.set(s * 1.2, 2.85, -0.45); body.add(l); legs.push(l);
    mesh(scaleG(14), sc, l, 0, -0.4, 0).scale.set(0.72, 1.1, 0.85); mesh(new THREE.CylinderGeometry(0.28, 0.36, 1.7, 8), sc, l, 0, -1.65, 0.35).rotation.x = -0.35;
    mesh(new THREE.SphereGeometry(1, 10, 8), sc, l, 0, -2.6, 0.95).scale.set(0.42, 0.22, 0.65); for (let f = -1; f <= 1; f++){ const c = mesh(new THREE.ConeGeometry(0.08, 0.38, 5), dark, l, f * 0.22, -2.65, 1.5); c.rotation.x = HPI; } }
  return { g, body, mats: [sc, pale, horn], kind: 'rcryos', torso, neck, head, jaw, mouth, tail, wings, legs, memM, crys };
}
// 쫄몹: 독두꺼비 (그롬) · 수정 첨탑 (그라녹) · 서리 정령 (크라이오스)
function mkToad(){ const m = X.MK.mkFrog(); m.mats[0].color.set(0x6a8a2a); m.mats[0].emissive.set(0x1a3a0a); m.mats[1].color.set(0xc8d070); const p = mesh(new THREE.SphereGeometry(0.1, 8, 6), std({ color: 0xa8ff5a, emissive: 0x5aff2a, emissiveIntensity: 0.6 }), m.body, 0.15, 0.62, -0.1); mesh(p.geometry, p.material, m.body, -0.2, 0.58, -0.05); return m; }
function mkPylon(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const rk = std({ color: 0x5a4c40, flatShading: true, roughness: 0.95 }), cr = std({ color: 0xffc070, emissive: 0xff7a1a, emissiveIntensity: 1.4, roughness: 0.1, flatShading: true });
  mesh(rockGeo(1.0, 0, 0.25, 5, 1.2, 0.5, 1.2), rk, body, 0, 0.3, 0);
  const cg = new THREE.OctahedronGeometry(1, 0); cg.scale(0.55, 2.0, 0.55); const main = mesh(cg, cr, body, 0, 2.2, 0);
  for (let i = 0; i < 4; i++){ const q = new THREE.OctahedronGeometry(1, 0); q.scale(0.25, rr(0.6, 1.1), 0.25); const c = mesh(q, cr, body, Math.cos(i * 1.6) * 0.6, 1.0, Math.sin(i * 1.6) * 0.6); c.rotation.set(Math.sin(i * 1.6) * 0.6, 0, -Math.cos(i * 1.6) * 0.6); }
  const gl = X.glowSprite(0xff9a3a, 4.5, 0.7); gl.position.y = 2.4; body.add(gl);
  return { g, body, mats: [rk, cr], kind: 'rpylon', main, gl };
}
function mkWisp(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const cr = std({ color: 0xe8fbff, emissive: 0x5ad0ff, emissiveIntensity: 1.1, roughness: 0.05, flatShading: true, transparent: true, opacity: 0.92 });
  const cg = new THREE.OctahedronGeometry(0.42, 0); cg.scale(1, 1.5, 1); const core = mesh(cg, cr, body, 0, 0.6, 0);
  const ring = new THREE.Group(); ring.position.y = 0.6; body.add(ring); for (let i = 0; i < 3; i++){ const q = new THREE.OctahedronGeometry(0.16, 0); q.scale(1, 2, 1); const s = mesh(q, cr, ring, Math.cos(i * 2.09) * 0.75, 0, Math.sin(i * 2.09) * 0.75); s.rotation.z = 0.4; }
  const gl = X.glowSprite(0x8ae8ff, 2.4, 0.7); gl.position.y = 0.6; body.add(gl);
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.06, 6, 4), basic(0x0a2a4a), body, s * 0.12, 0.72, 0.36, false);
  return { g, body, mats: [cr], kind: 'rwisp', core, ring };
}
X.MON.rd_toad = { name: '독두꺼비', icon: '🐸', mk: () => mkToad(), hp: 70, dmg: 11, spd: 3.2, rad: 0.62, style: 'hop', tongue: true, range: 4.2, wind: 0.5, exp: 12, top: 1.3 };
X.MON.rd_pylon = { name: '수정 첨탑', icon: '💎', mk: () => mkPylon(), hp: 150, dmg: 14, spd: 0, rad: 0.95, style: 'turret', range: 0, wind: 1, exp: 18, top: 4.4 };
X.MON.rd_wisp = { name: '서리 정령', icon: '❄️', mk: () => mkWisp(), hp: 72, dmg: 13, spd: 3.8, rad: 0.55, style: 'dash', range: 6.5, wind: 0.75, exp: 13, top: 2.0, fly: 1.2 };

// ───────────────────────── 보스 공통 ─────────────────────────
const once = (o, k = '_i') => !o[k] && (o[k] = true);   // 처음 한 번만 (프레임이 느려도 확실하게)
const damp = (a, b, r, dt) => a + (b - a) * (1 - Math.exp(-r * dt));
const angTo = (e, x, z) => Math.atan2(x - e.pos.x, z - e.pos.z);
const dst = (e, u) => Math.hypot(u.pos.x - e.pos.x, u.pos.z - e.pos.z);
const aliveUnits = () => UNITS.filter(alive);
function focusUnit(B){
  const tank = BOTS.find(u => u.role === 'tank' && !u.down);
  if (B.taunt && B.taunt.t > 0 && !B.taunt.u.down) return B.taunt.u;
  if (!X.dead && (!tank || B.pref === 'me')) return ME;
  return tank || BOTS.find(u => !u.down) || ME;
}
function randUnit(meW = 0.55){ const L = aliveUnits(); if (!L.length) return ME; if (!X.dead && R() < meW) return ME; const bots = L.filter(u => !u.me); return bots.length ? pick(bots) : L[0]; }
const inArena = (x, z, m = 1.5) => { const p = new V3(x, 0, z); let best = null; for (const s of RS.def.shapes){ if (s.c){ const d = Math.hypot(x - s.c[0], z - s.c[1]); if (d <= s.c[2] - m) return p; const r = Math.max(0.5, s.c[2] - m), k = r / d; const q = [s.c[0] + (x - s.c[0]) * k, s.c[1] + (z - s.c[1]) * k]; if (!best || Math.hypot(q[0] - x, q[1] - z) < best[2]) best = [q[0], q[1], Math.hypot(q[0] - x, q[1] - z)]; } } if (best) p.set(best[0], 0, best[1]); return p; };
let errN = 0;
const guard = (tag, fn) => { try { return fn(); } catch (err){ if (errN++ < 12) console.error(`[raid] ${tag}`, err); return false; } };
function bossAI(e, dt, d, dx, dz, face){ return guard('boss ai', () => bossAI0(e, dt)); }
function bossAI0(e, dt){
  const B = e.B; if (!RS || RS.boss !== e || !B) return false;
  const K = BK[RS.id];
  if (RS.phase !== 'fight' || B.dying) return false;
  B.t += dt; for (const k in B.cds) B.cds[k] -= dt;
  if (B.taunt){ B.taunt.t -= dt; if (B.taunt.t <= 0) B.taunt = null; }
  B.prefT -= dt; if (B.prefT <= 0){ B.prefT = rr(5, 9); B.pref = R() < 0.34 ? 'me' : 'tank'; }
  B.focus = focusUnit(B); B.moving = false;
  if (B.trans){ B.trans.t += dt; if (K.trans(e, B, B.trans, dt)){ B.trans = null; e.under = false; B.cd = 0.9; RS.hudDirty = true; } return false; }
  if (B.act){ const A = B.act; A.t += dt; if (K.acts[A.k](e, B, A, dt)){ B.act = null; B.cd = rr(0.6, 1.2) * (B.bp === 3 ? 0.8 : 1) * (RS.enr ? 0.6 : 1); } return B.moving; }
  B.cd -= dt;
  const f = B.focus, d = dst(e, f);
  if (K.move) K.move(e, B, f, d, dt); else { X.turn(e, angTo(e, f.pos.x, f.pos.z), dt * 3); if (d > e.cfg.rad + 3){ const a = angTo(e, f.pos.x, f.pos.z); e.pos.x += Math.sin(a) * e.cfg.spd * dt; e.pos.z += Math.cos(a) * e.cfg.spd * dt; B.moving = true; } }
  if (B.cd <= 0){ const k = K.pick(e, B, f, d); if (k){ B.act = { k, t: 0, ph: 0 }; B.cds[k] = (K.cd[k] || 5) * (RS.enr ? 0.65 : 1); e.an = { k: 'idle', t: 0 }; } }
  return B.moving;
}
function wpick(list){ let s = 0; for (const [, w] of list) s += Math.max(0, w); let q = R() * s; for (const [k, w] of list){ q -= Math.max(0, w); if (q <= 0) return k; } return list.length ? list[0][0] : null; }
// 페이즈 경계 · 처치 막기 (보스는 내 연출로만 쓰러져요)
function guardBoss(e){
  if (!RS || e !== RS.boss) return;
  if (RS.phase !== 'fight' || !e.B || e.B.dying){ if (e.hp < 1) e.hp = 1; return; }
  const B = e.B, k = e.hp / e.max;
  if (B.bp === 1 && k <= 0.7){ e.hp = e.max * 0.7; startPhase(e, 2); }
  else if (B.bp === 2 && k <= 0.35){ e.hp = e.max * 0.35; startPhase(e, 3); }
  else if (e.hp <= 1){ e.hp = 1; bossDown(e); }
}
function startPhase(e, n){
  const B = e.B; B.bp = n; B.act = null; B.trans = { n, t: 0, ph: 0 }; e.under = true; e.tongueL = 0.01; e.an = { k: 'idle', t: 0 }; RS.hudDirty = true;
  const P = BK[RS.id].phases[n - 1]; X.banner(`PHASE ${n}`, P[0], P[1], true, 3); X.sfx('roar'); G.shake = Math.max(G.shake, 1.0);
  for (const u of BOTS) if (!u.down && R() < 0.5) botSay(u, u.role === 'tank' ? 'taunt' : u.role === 'heal' ? 'heal' : 'adds');
}
const BK = {};

// ───────────────────────── 늪의 왕 그롬 ─────────────────────────
const GLOB_G = () => geo('globG', () => new THREE.SphereGeometry(0.42, 12, 10)), GLOB_M = () => mat('globM', () => std({ color: 0x8aff4a, emissive: 0x4aff1a, emissiveIntensity: 1.0, roughness: 0.2 }));
function glob(from, to, T, land){ const o = new THREE.Group(); mesh(GLOB_G(), GLOB_M(), o, 0, 0, 0, false); o.add(X.glowSprite(0x8aff4a, 1.8, 0.7)); lob(o, from, to, T, Math.hypot(to.x - from.x, to.z - from.z) * 0.32 + 2, land); }
const mouthPos = e => { const a = e.g.rotation.y, r = e.cfg.rad * 0.85; return new V3(e.pos.x + Math.sin(a) * r, 1.7, e.pos.z + Math.cos(a) * r); };
function capPools(max){ const P = HZ.filter(h => h.k === 'pool' && h.life < 1e8); if (P.length > max){ P.sort((a, b) => (b.life - b.t) - (a.life - a.t)); for (let i = max; i < P.length; i++) P[i].life = Math.min(P[i].life, P[i].t + 1.2); } }
BK.grom = {
  phases: [['늪의 왕', '혀 · 독 침 · 배치기'], ['독의 왕', '독 늪이 차오른다! 장판이 오래 남고 배치기가 이어진다'], ['분노한 늪의 왕', '독 해일 — 초록 고리를 점프로 넘어라!']],
  cd: { swipe: 2.6, tongue: 7.5, spit: 8.5, flop: 10, summon: 30, wave: 11 },
  pick(e, B, f, d){
    const near = d < e.cfg.rad + 3.6, p = B.bp, c = k => B.cds[k] > 0 ? 0 : 1;
    if (!B.sum1 && e.hp / e.max < 0.86){ B.sum1 = true; return 'summon'; }
    if (p >= 2 && !B.sum2 && e.hp / e.max < 0.55){ B.sum2 = true; return 'summon'; }
    return wpick([['swipe', (near ? 5 : 0) * c('swipe')], ['tongue', (d > 5 ? 4 : 2) * c('tongue')], ['spit', 3 * c('spit')], ['flop', (p >= 2 ? 3 : 2) * c('flop')], ['wave', (p >= 3 ? 3.5 : 0) * c('wave')], ['hop', 0.6]]);
  },
  move(e, B, f, d, dt){
    X.turn(e, angTo(e, f.pos.x, f.pos.z), dt * 2.6);
    if (B.hop){ const h = B.hop; h.t += dt; const k = Math.min(1, h.t / 0.55); e.pos.x = h.fx + (h.tx - h.fx) * k; e.pos.z = h.fz + (h.tz - h.fz) * k; e.pos.y = Math.sin(k * PI) * 0.9; e.an = { k: k < 1 ? 'air' : 'land', t: 0 };
      if (k >= 1){ B.hop = null; e.pos.y = 0; X.burst(new V3(e.pos.x, 0.2, e.pos.z), 0x8ad8b0, 16, 4, 0.25, 0.5, -8, 2.5); X.shockwave(e.pos.x, 0.08, e.pos.z, e.cfg.rad + 1.5, 0x8ad8b0, 0.4); G.shake = Math.max(G.shake, 0.25); X.sfx('stomp'); } B.moving = true; return; }
    B.hopT = (B.hopT ?? 0) - dt;
    if (d > e.cfg.rad + 3.2 && B.hopT <= 0){ const a = angTo(e, f.pos.x, f.pos.z), s = Math.min(d - e.cfg.rad - 2.2, 3.0); B.hop = { t: 0, fx: e.pos.x, fz: e.pos.z, tx: e.pos.x + Math.sin(a) * s, tz: e.pos.z + Math.cos(a) * s }; B.hopT = rr(0.35, 0.8); }
  },
  acts: {
    hop(e, B, A, dt){ if (!A.init){ A.init = true; const u = pick(aliveUnits()) || ME, a = angTo(e, u.pos.x, u.pos.z) + rr(-0.6, 0.6), p = inArena(e.pos.x + Math.sin(a) * 3.2, e.pos.z + Math.cos(a) * 3.2, 4); B.hop = { t: 0, fx: e.pos.x, fz: e.pos.z, tx: p.x, tz: p.z }; return false; } BK.grom.move(e, B, B.focus, 0, dt); return !B.hop; },
    swipe(e, B, A, dt){
      if (!A.h){ A.tg = B.focus; A.ry = angTo(e, A.tg.pos.x, A.tg.pos.z); A.side = R() < 0.5 ? 1 : -1; e.an = { k: 'swipe', t: 0, side: A.side }; X.sfx('swing');
        A.h = hz({ k: 's', x: e.pos.x, z: e.pos.z, r: e.cfg.rad + 3.3, ry: A.ry, span: 1.9, T: A.tg.me ? 0.8 : 0.62, dmg: e.dmg * 0.9, kb: 9,
          fire(h){ G.shake = Math.max(G.shake, 0.4); X.sfx('stomp'); for (let i = 0; i < 10; i++){ const a = h.ry + rr(-0.9, 0.9), r = rr(2.5, h.r); X.burst(new V3(e.pos.x + Math.sin(a) * r, 0.3, e.pos.z + Math.cos(a) * r), 0x9ad8b0, 3, 3, 0.25, 0.5, -8, 3); } } }); }
      if (A.t < 0.35){ X.turn(e, angTo(e, A.tg.pos.x, A.tg.pos.z), dt * 3); A.h.ry = e.g.rotation.y; } A.h.x = e.pos.x; A.h.z = e.pos.z;
      return A.t > 1.15;
    },
    tongue(e, B, A, dt){
      if (A.ph === 0){
        if (!A.h){ A.tg = R() < 0.6 ? B.focus : randUnit(0.6); e.an = { k: 'open', t: 0 }; X.sfx('boing');
          A.h = hz({ k: 'r', x: e.pos.x, z: e.pos.z, w: 1.8, len: 10, ry: 0, T: 1.05, hard: A.tg.role === 'tank' }); }
        const tg = A.tg, a = angTo(e, tg.pos.x, tg.pos.z); if (A.t < 0.7){ X.turn(e, a, dt * 5); A.len = Math.min(17, dst(e, tg) + 1.5); }
        const mp = mouthPos(e); A.h.x = mp.x; A.h.z = mp.z; A.h.ry = e.g.rotation.y; if (A.h.len !== A.len){ A.h.len = A.len; if (A.h.tele){ A.h.tele.scale.z = A.len / 10; } }
        if (A.h.fired){ A.ph = 1; A.t = 0; e.an = { k: 'tongue', t: 0 }; e.tongueL = A.len - e.cfg.rad * 0.6; e.tongueA = 0; X.sfx('throw'); A.caught = [];
          const s = Math.sin(A.h.ry), c = Math.cos(A.h.ry);
          for (const u of UNITS){ if (!alive(u)) continue; const dx = u.pos.x - mp.x, dz = u.pos.z - mp.z, al = dx * s + dz * c, sd = dx * c - dz * s;
            if (al > -0.5 && al < A.len + 0.4 && Math.abs(sd) < 1.15){ const tx = mp.x + s * 1.6, tz = mp.z + c * 1.6;
              if (u.me){ const h0 = X.hp; X.hurtPlayer(e.dmg * 0.5, new V3(mp.x, 0, mp.z), -Math.max(0, al - 1.6) * 8.5); if (X.hp < h0) A.caught.push(u); }
              else if (!u.down && u.inv <= 0){ hurt(u, e.dmg * 0.5, mp.x, mp.z, 0); u.pull = { t: 0, T: 0.32, fx: u.pos.x, fz: u.pos.z, tx, tz }; u.roll = null; u.esc = null; A.caught.push(u); } } }
          if (A.caught.length) X.dmgNum(new V3(e.pos.x, e.cfg.top + 0.6, e.pos.z), '덥석!', 'aggro'); }
      } else if (A.ph === 1){
        if (A.t > 0.22) e.tongueL = 0.01;
        if (A.t > 0.4){ A.ph = 2; A.t = 0; if (A.caught.length){ const mp = mouthPos(e), a = e.g.rotation.y; e.an = { k: 'chomp', t: 0 }; A.ch = hz({ k: 'c', x: mp.x + Math.sin(a) * 1.2, z: mp.z + Math.cos(a) * 1.2, r: 3.4, T: 0.8, dmg: e.dmg * 1.2, kb: 10, fire(){ X.sfx('crit'); G.shake = Math.max(G.shake, 0.6); } }); } else e.an = { k: 'idle', t: 0 }; }
      } else return A.t > (A.ch ? 1.25 : 0.4);
      return false;
    },
    spit(e, B, A, dt){
      if (once(A)){ e.an = { k: 'spit', t: 0 }; A.n = B.bp >= 2 ? 5 : 3; A.fired = false; }
      if (A.t < 0.45) X.turn(e, angTo(e, B.focus.pos.x, B.focus.pos.z), dt * 3);
      if (!A.fired && A.t > 0.5){ A.fired = true; X.sfx('throw'); const mp = mouthPos(e), L = aliveUnits(), life = B.bp >= 2 ? 34 : 18;
        for (let i = 0; i < A.n; i++){ const u = L[i % L.length], to = inArena(u.pos.x + rr(-2.2, 2.2) * (i < L.length ? 0.4 : 1), u.pos.z + rr(-2.2, 2.2) * (i < L.length ? 0.4 : 1), 1.5);
          const T = 0.85 + i * 0.07; hz({ k: 'c', x: to.x, z: to.z, r: 2.2, T, dmg: e.dmg * 0.55, kb: 4, fire(){ pool(to.x, to.z, 2.3, life, e.dmg * 0.36); X.burst(new V3(to.x, 0.3, to.z), 0x8aff4a, 16, 3, 0.25, 0.6, -6, 2.5); capPools(B.bp >= 3 ? 12 : 9); } });
          glob(mp, new V3(to.x, 0.2, to.z), T); } }
      return A.t > 1.5;
    },
    flop(e, B, A, dt){
      if (A.ph === 0){ if (once(A)){ A.tg = A.tg || (R() < 0.5 ? B.focus : randUnit(0.6)); e.an = { k: 'crouch', t: 0 }; X.sfx('boing'); }
        X.turn(e, angTo(e, A.tg.pos.x, A.tg.pos.z), dt * 4);
        if (A.t > 0.5){ A.ph = 1; A.t = 0; A.from = e.pos.clone(); A.to = inArena(A.tg.pos.x, A.tg.pos.z, e.cfg.rad * 0.7); e.under = true; e.an = { k: 'air', t: 0 };
          A.h = hz({ k: 'c', x: A.to.x, z: A.to.z, r: 6.2, T: 1.0, dmg: e.dmg * 1.35, kb: 13 }); } }
      else if (A.ph === 1){ const k = Math.min(1, A.t / 1.0); e.pos.x = A.from.x + (A.to.x - A.from.x) * ease(k); e.pos.z = A.from.z + (A.to.z - A.from.z) * ease(k); e.pos.y = Math.sin(k * PI) * 7.5; B.moving = true;
        if (k >= 1){ e.pos.y = 0; e.under = false; A.ph = 2; A.t = 0; e.an = { k: 'land', t: 0 }; X.shockwave(e.pos.x, 0.1, e.pos.z, 8, 0x9affb0, 0.6); X.burst(new V3(e.pos.x, 0.5, e.pos.z), 0x9ad8c0, 60, 8, 0.35, 0.9, -9, 5); X.burst(new V3(e.pos.x, 0.3, e.pos.z), 0x7aff4a, 24, 5, 0.3, 0.7, -6, 3); G.shake = 1.2; X.sfx('boom');
          if (B.bp >= 2) for (let i = 0; i < 4; i++){ const a = i / 4 * TAU + R(), p = inArena(e.pos.x + Math.sin(a) * 5, e.pos.z + Math.cos(a) * 5, 1.4); pool(p.x, p.z, 1.7, 26, e.dmg * 0.36); }
          if (B.bp >= 3) ringWave(e.pos.x, e.pos.z, { col: 0x7aff3a, v: 8, R: 24, dmg: e.dmg * 0.75 }); capPools(12); } }
      else if (A.t > 0.75){ if (B.bp >= 2 && !A.chain){ const t2 = randUnit(0.5); Object.assign(A, { ph: 0, t: 0, chain: true, tg: t2, _i: false }); return false; } return true; }
      return false;
    },
    summon(e, B, A){
      if (once(A)){ e.an = { k: 'croak', t: 0 }; X.sfx('summon'); }
      if (!A.done && A.t > 0.65){ A.done = true; const n = B.bp >= 2 ? 4 : 3; alertMsg('독두꺼비가 몰려온다!', '쫄몹은 파티원이 정리해요 — 같이 잡으세요', '#8aff5a', 2.2);
        for (let i = 0; i < n; i++){ const a = R() * TAU, r = rr(14, 18), p = inArena(Math.sin(a) * r, Math.cos(a) * r, 2); X.burst(new V3(p.x, 0.4, p.z), 0x9ad8c0, 20, 4, 0.3, 0.6, -8, 3); X.spawnMon('rd_toad', p.x, p.z, B.bp >= 2 && i === 0, { lv: RS.blv - 3, scale: 1.25 }); } }
      return A.t > 1.4;
    },
    wave(e, B, A, dt){
      if (once(A)){ e.an = { k: 'rear', t: 0 }; A.n = RS.enr ? 4 : 3; A.k = 0; X.sfx('rumble'); if (!RS.waveHint){ RS.waveHint = true; tip('초록 고리는 <b>Space</b> 점프로 넘거나 <b>K</b> 구르기로 통과!', 5); } }
      if (A.t > 0.9 + A.k * 0.85 && A.k < A.n){ A.k++; e.an = { k: 'slam', t: 0 }; ringWave(e.pos.x, e.pos.z, { col: 0x7aff3a, v: 8.5, R: 26, dmg: e.dmg * 0.85, r0: e.cfg.rad }); X.shockwave(e.pos.x, 0.1, e.pos.z, 6, 0x7aff3a, 0.5); X.burst(new V3(e.pos.x, 0.4, e.pos.z), 0x7aff3a, 36, 6, 0.3, 0.7, -6, 3); G.shake = Math.max(G.shake, 0.9); X.sfx('boom'); if (A.k < A.n) after(0.25, () => { if (e.an) e.an = { k: 'rear', t: 0.3 }; }); }
      return A.t > 1.2 + A.n * 0.85;
    },
    rain(e, B, A, dt){ if (once(A)){ e.an = { k: 'roar', t: 0 }; X.sfx('roar'); } A.acc = (A.acc || 0) + dt; if (A.acc > 0.32){ A.acc = 0; toxicDrop(e); } if (A.t > 1.2) e.an = { k: 'idle', t: 0 }; return A.t > 4.5; },
  },
  trans(e, B, T, dt){
    if (T.n === 2){
      if (T.ph === 0){ if (once(T)){ T.from = e.pos.clone(); T.to = new V3(0, 0, -15.5); e.an = { k: 'air', t: 0 }; } const k = Math.min(1, T.t / 1.1); e.pos.x = T.from.x + (T.to.x - T.from.x) * ease(k); e.pos.z = T.from.z + (T.to.z - T.from.z) * ease(k); e.pos.y = Math.sin(k * PI) * 8; X.turn(e, angTo(e, 0, 8), dt * 4);
        if (k >= 1){ e.pos.y = 0; T.ph = 1; T.t = 0; e.an = { k: 'roar', t: 0 }; X.shockwave(e.pos.x, 0.1, e.pos.z, 9, 0x7aff3a, 0.7); G.shake = 1.4; X.sfx('boom'); setToxic(1); } }
      else if (T.ph === 1){ T.acc = (T.acc || 0) + dt; if (T.acc > 0.3){ T.acc = 0; toxicDrop(e); } if (T.t > 1.4 && !T.s){ T.s = true; e.an = { k: 'croak', t: 0 }; BK.grom.acts.summon(e, B, { t: 0.7, done: false }); } if (T.t > 5.5) return true; }
      return false;
    }
    if (T.ph === 0){ if (once(T)){ e.an = { k: 'roar', t: 0 }; e.eyeGlow = 1.6; e.m.eyeM.color.set(0xff4a2a); e.m.eyeM.emissive.set(0xff2a0a); e.m.crownGlow.material.color.set(0xff5a2a); e.m.gem.material.color.set(0xff4a2a); e.spdMul = 1.22; flash(); } if (T.t > 1.8){ T.ph = 1; T.t = 0; } return false; }
    if (!T.w){ T.w = { t: 0, ph: 0 }; } T.w.t += dt; return BK.grom.acts.wave(e, B, T.w, dt);
  },
  intro(e, t, dt, cam){
    const B = e.B;
    if (once(e.B, '_in')){ B.pin = { x: 0, y: 1.25, z: -21, ry: 0 }; e.eyeGlow = 0; e.m.eyeM.emissiveIntensity = 0; }
    if (t < 3.1){ const k = ease(Math.min(1, t / 3)); cam.pos.set(0 + Math.sin(t * 0.3) * 2, 7 - k * 2.5, 14 - k * 16); cam.look.set(0, 3.6, -21); }
    if (t > 1.2 && !B.i1){ B.i1 = true; e.eyeGlow = 1.0; X.sfx('rumble'); }
    if (t > 2.1 && !B.i2){ B.i2 = true; e.an = { k: 'croak', t: 0 }; X.sfx('boing'); after(0.5, () => X.sfx('boing')); }
    if (t > 3.1 && !B.i3){ B.i3 = true; e.an = { k: 'air', t: 0 }; B.ij = { from: new V3(0, 1.25, -21), to: new V3(0, 0, -9) }; }
    if (B.ij && t < 4.1){ const k = Math.min(1, (t - 3.1) / 1.0); B.pin = { x: 0, y: B.ij.from.y * (1 - k) + Math.sin(k * PI) * 8, z: B.ij.from.z + (B.ij.to.z - B.ij.from.z) * ease(k), ry: 0 }; cam.pos.set(9, 4, -1); cam.look.set(0, 3 + Math.sin(k * PI) * 3, B.pin.z); }
    if (t > 4.1 && !B.i4){ B.i4 = true; B.pin = null; e.pos.set(0, 0, -9); e.an = { k: 'land', t: 0 }; X.shockwave(0, 0.1, -9, 10, 0x9affb0, 0.7); X.burst(new V3(0, 0.5, -9), 0x9ad8c0, 80, 9, 0.35, 1, -9, 5); G.shake = 1.5; X.sfx('boom'); }
    if (t > 4.5 && !B.i5){ B.i5 = true; e.an = { k: 'roar', t: 0 }; X.sfx('roar'); X.banner('RAID BOSS', '늪의 왕 그롬', 'GROM THE MIRE KING', true, 3.2); G.shake = 1.0; }
    if (t > 4.1){ cam.pos.set(Math.sin(t * 0.25) * 6, 2.6, -1.5); cam.look.set(0, 3.2, -9); }
    if (t > 7.0){ e.eyeGlow = 0.3; return true; } return false;
  },
  death(e, t, dt){
    const m = e.m;
    if (once(e.B, '_dt')){ e.an = { k: 'roar', t: 0 }; }
    if (t > 0.6){ const k = Math.min(1, (t - 0.6) / 1.3); m.body.rotation.z = ease(k) * 2.6; m.body.position.y = Math.sin(k * PI) * 1.6 - k * 0.6; e.tongueL = k * 3; e.tongueA = 0.6; e.an = { k: 'tongue', t: 0 }; }
    if (R() < dt * 14) X.burst(new V3(e.pos.x + rr(-2, 2), rr(0.5, 3), e.pos.z + rr(-2, 2)), pick([0x8aff4a, 0xffe08a, 0x9ad8c0]), 6, 3, 0.3, 0.8, -3, 2);
    if (t > 1.9 && !e.B.d1){ e.B.d1 = true; X.shockwave(e.pos.x, 0.1, e.pos.z, 10, 0x9affb0, 0.8); X.burst(new V3(e.pos.x, 0.5, e.pos.z), 0x9ad8c0, 90, 9, 0.4, 1.1, -8, 5); G.shake = 1.3; X.sfx('boom'); setToxic(0); }
    return t > 2.6;
  },
  anim(e, dt){
    const m = e.m, B = e.B, an = e.an || (e.an = { k: 'idle', t: 0 }), t = G.time; an.t += dt;
    const st = e.st2 || (e.st2 = { open: 0, crouch: 0, air: 0, sac: 1, tl: 0.01, blink: 0, bt: 2, arm: [0, 0] });
    let open = 0.04, crouch = 0, air = 0, sac = 1 + Math.sin(t * 3.4) * 0.07 * (0.5 + 0.5 * Math.sin(t * 0.6)); const arm = [0, 0];
    switch (an.k){
      case 'open': open = Math.min(1, an.t / 0.4) * 0.75; break;
      case 'tongue': open = 1; break;
      case 'chomp': open = an.t < 0.55 ? 1.15 : Math.max(0, 1.15 - (an.t - 0.55) * 9); break;
      case 'spit': open = an.t < 0.45 ? an.t / 0.45 : an.t < 0.75 ? 1 : Math.max(0.05, 1 - (an.t - 0.75) * 3); break;
      case 'crouch': crouch = Math.min(1, an.t / 0.45); sac = 1.35; break;
      case 'air': air = 1; open = 0.2; break;
      case 'land': crouch = Math.max(0, 1 - an.t / 0.5) * 0.9; break;
      case 'roar': open = Math.min(1.2, an.t / 0.3); sac = 1.65 + Math.sin(t * 22) * 0.08; crouch = -0.35; break;
      case 'croak': sac = 1 + Math.sin(Math.min(1, an.t / 0.6) * PI) * 0.95; open = 0.12; break;
      case 'swipe': { const q = an.t, v = q < 0.5 ? -1.1 * (q / 0.5) : q < 0.68 ? -1.1 + 2.3 * ((q - 0.5) / 0.18) : 1.2 * Math.max(0, 1 - (q - 0.68) / 0.4); arm[(an.side || 1) > 0 ? 1 : 0] = v; open = 0.3; break; }
      case 'rear': crouch = -Math.min(1, an.t / 0.6) * 0.7; sac = 1.45; open = 0.45; break;
      case 'slam': crouch = Math.max(0, 1 - an.t * 2.2); break;
    }
    st.open = damp(st.open, open, 14, dt); st.crouch = damp(st.crouch, crouch, 10, dt); st.air = damp(st.air, air, 8, dt); st.sac = damp(st.sac, sac, 10, dt);
    const br = Math.sin(t * 1.7);
    m.torso.scale.set(1 + br * 0.012 + st.crouch * 0.07, 1 + br * 0.02 - st.crouch * 0.16 + st.air * 0.1, 1 + br * 0.012 + st.crouch * 0.05); m.torso.position.y = -Math.max(0, st.crouch) * 0.25;
    m.head.rotation.x = -0.34 * st.open; m.jaw.rotation.x = 0.13 * st.open; m.sac.scale.set(1.2 * st.sac, 0.8 * st.sac, 0.75 * st.sac);
    for (let i = 0; i < 2; i++){ st.arm[i] = damp(st.arm[i], arm[i], 16, dt); m.arms[i].rotation.x = -st.arm[i] - st.air * 0.7; }
    st.bt -= dt; if (st.bt <= 0){ st.blink = 0.16; st.bt = rr(2.5, 5.5); } st.blink = Math.max(0, st.blink - dt);
    const lid = st.blink > 0 ? 0.25 : B && B.bp === 3 ? -0.5 : -1.15; for (const l of m.lids) l.rotation.x = damp(l.rotation.x, lid, 25, dt);
    const L = e.tongueL || 0.01; st.tl = damp(st.tl, L, L > 0.5 ? 34 : 12, dt); m.tStem.scale.z = st.tl; m.tTip.position.z = st.tl; m.tTip.visible = st.tl > 0.3;
    m.tongue.rotation.y = damp(m.tongue.rotation.y, e.tongueA || 0, 20, dt); m.tongue.rotation.x = st.tl > 0.5 ? Math.atan2(1.3, st.tl) : 0;
    m.pustM.emissiveIntensity = (B && B.bp >= 2 ? 1.3 : 0.45) + Math.sin(t * 3) * 0.25; m.eyeM.emissiveIntensity = damp(m.eyeM.emissiveIntensity, e.eyeGlow ?? 0.3, 4, dt);
    m.crownGlow.material.opacity = 0.35 + Math.sin(t * 2.2) * 0.15;
  },
};
function toxicDrop(e){
  const u = randUnit(0.5), p = inArena(u.pos.x + rr(-4, 4), u.pos.z + rr(-4, 4), 1.2), T = 1.15;
  hz({ k: 'c', x: p.x, z: p.z, r: 1.9, T, dmg: e.dmg * 0.55, kb: 4, fire(){ X.burst(new V3(p.x, 0.3, p.z), 0x8aff4a, 12, 3, 0.22, 0.5, -6, 2); if (R() < 0.25){ pool(p.x, p.z, 1.6, 14, e.dmg * 0.3); capPools(12); } } });
  glob(new V3(p.x + rr(-2, 2), 18, p.z + rr(-2, 2)), new V3(p.x, 0.2, p.z), T);
}
function setToxic(k){ const M = GROM_MATS(); RS && (RS.toxic = { k, t: 0, from: M.water.color.clone() }); }

// ───────────────────────── 바위 거인 그라녹 ─────────────────────────
const rayOut = (x, z, ry, m = 1.8) => { const dx = Math.sin(ry), dz = Math.cos(ry), s = RS.def.shapes[0].c, px = x - s[0], pz = z - s[1], R0 = s[2] - m, b = px * dx + pz * dz, c = px * px + pz * pz - R0 * R0; return Math.max(2, -b + Math.sqrt(Math.max(0, b * b - c))); };
const FALLERS = [];
function updFallers(dt){ for (let i = FALLERS.length - 1; i >= 0; i--){ const f = FALLERS[i]; f.t += dt; if (f.o.position.y > f.floor){ f.v.y -= 18 * dt; f.o.position.addScaledVector(f.v, dt); f.o.rotation.x += f.sp * dt; f.o.rotation.z += f.sp * 0.7 * dt; if (f.o.position.y <= f.floor){ f.o.position.y = f.floor; X.burst(new V3(f.o.position.x, 0.3, f.o.position.z), 0x9a8a70, 10, 3, 0.25, 0.5, -8, 2); if (f.thud) X.sfx('stomp'); } } if (f.t > f.life){ f.o.parent && f.o.parent.remove(f.o); FALLERS.splice(i, 1); } } }
const SHIELD_M = () => mat('shieldM', () => new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uA: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uT, uA; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); float hex = 0.5 + 0.5 * sin(vP.x * 4.0 + uT * 2.0) * sin(vP.y * 4.0 - uT) * sin(vP.z * 4.0 + uT * 1.3); float a = (f * 0.9 + hex * 0.12 + 0.04) * uA; gl_FragColor = vec4(vec3(1.0, 0.62, 0.22) * a * 1.6, a); }` }));
BK.granok = {
  phases: [['바위 거인', '대지 강타 · 바위 던지기 · 낙석'], ['수정의 수호', '수정 첨탑이 그라녹을 지킨다 — 첨탑부터 부숴라!'], ['깨어난 핵', '갑옷이 부서졌다! 돌진 · 연속 강타']],
  cd: { smash: 3.0, slam: 9, throw: 7, rocks: 12, stomp: 6, charge: 11 },
  pick(e, B, f, d){
    if (B.stagger > 0) return null;
    const near = d < e.cfg.rad + 4.2, c = k => B.cds[k] > 0 ? 0 : 1, crowd = aliveUnits().filter(u => dst(e, u) < e.cfg.rad + 3.2).length;
    return wpick([['smash', (near ? 5 : 0) * c('smash')], ['slam', 3 * c('slam')], ['throw', (d > 6 ? 4 : 2) * c('throw')], ['rocks', (B.bp >= 2 ? 3 : 2) * c('rocks')], ['stomp', (crowd >= 2 ? 3 : 0) * c('stomp')], ['charge', (B.bp >= 3 ? 3.5 : 0) * c('charge')]]);
  },
  move(e, B, f, d, dt){
    if (B.stagger > 0){ B.stagger -= dt; e.an = e.an && e.an.k === 'kneel' ? e.an : { k: 'kneel', t: 0 }; if (B.stagger <= 0){ e.an = { k: 'roar', t: 0 }; X.sfx('roar'); B.cd = 1.2; } return; }
    X.turn(e, angTo(e, f.pos.x, f.pos.z), dt * 2.2);
    if (d > e.cfg.rad + 3.2){ const a = e.g.rotation.y; e.pos.x += Math.sin(a) * e.cfg.spd * dt; e.pos.z += Math.cos(a) * e.cfg.spd * dt; B.moving = true; if (!e.an || e.an.k !== 'walk') e.an = { k: 'walk', t: 0 }; }
    else if (e.an && e.an.k === 'walk') e.an = { k: 'idle', t: 0 };
  },
  acts: {
    smash(e, B, A, dt){
      if (!A.h){ A.tg = B.focus; A.side = R() < 0.5 ? 1 : -1; e.an = { k: 'sweep', t: 0, side: A.side };
        A.h = hz({ k: 's', x: e.pos.x, z: e.pos.z, r: e.cfg.rad + 4.4, ry: angTo(e, A.tg.pos.x, A.tg.pos.z), span: 2.3, T: A.tg.me ? 0.95 : 0.8, dmg: e.dmg * 0.95, kb: 12,
          fire(h){ X.sfx('stomp'); G.shake = Math.max(G.shake, 0.7); for (let i = 0; i < 9; i++){ const a = h.ry + rr(-1.1, 1.1), r = rr(3, h.r); X.burst(new V3(e.pos.x + Math.sin(a) * r, 0.3, e.pos.z + Math.cos(a) * r), 0x9a8a70, 4, 3.5, 0.3, 0.6, -8, 2.5); } } }); }
      if (A.t < 0.45){ X.turn(e, angTo(e, A.tg.pos.x, A.tg.pos.z), dt * 3); A.h.ry = e.g.rotation.y; } A.h.x = e.pos.x; A.h.z = e.pos.z;
      return A.t > 1.5;
    },
    slam(e, B, A){
      if (!A.h){ e.an = { k: 'slamUp', t: 0 }; X.sfx('rumble'); A.n = B.bp >= 2 ? 3 : 2; A.k = 0; A.h = hz({ k: 'c', x: e.pos.x, z: e.pos.z, r: e.cfg.rad + 2.9, T: 1.15, dmg: e.dmg * 1.2, kb: 14 });
        if (!RS.ringHint){ RS.ringHint = true; tip('충격파 고리는 <b>Space</b> 점프로 넘거나 <b>K</b> 구르기로 통과!', 5); } }
      if (A.h.fired && !A.hit){ A.hit = true; e.an = { k: 'slamDown', t: 0 }; G.shake = 1.4; X.sfx('boom'); X.shockwave(e.pos.x, 0.12, e.pos.z, e.cfg.rad + 4, 0xffa040, 0.5); X.burst(new V3(e.pos.x, 0.4, e.pos.z), 0x9a8a70, 60, 9, 0.4, 0.9, -8, 4); X.burst(new V3(e.pos.x, 0.4, e.pos.z), 0xffa040, 26, 6, 0.25, 0.6, -4, 3);
        if (B.bp >= 2) for (let i = 0; i < 3; i++){ const u = randUnit(0.5), p = inArena(u.pos.x + rr(-3, 3), u.pos.z + rr(-3, 3), 1.3); fallRock(p.x, p.z, { T: 1.4 + i * 0.25, dmg: e.dmg * 0.8 }); } }
      if (A.hit){ const tt = A.t - 1.15; while (A.k < A.n && tt >= A.k * 0.62){ ringWave(e.pos.x, e.pos.z, { col: 0xffa040, v: B.bp >= 3 ? 10 : 8.5, R: 26, dmg: e.dmg * 0.75, r0: e.cfg.rad + 1, h: 0.85 }); if (A.k){ e.an = { k: 'slamDown', t: 0.15 }; G.shake = Math.max(G.shake, 0.9); X.sfx('boom'); } A.k++; } }
      return A.t > 1.15 + A.n * 0.62 + 0.7;
    },
    throw(e, B, A, dt){
      if (once(A)){ A.tg = randUnit(0.55); A.n = B.bp >= 3 ? 2 : 1; e.an = { k: 'grab', t: 0 }; X.sfx('rumble'); const a = e.g.rotation.y; X.burst(new V3(e.pos.x + Math.sin(a + 0.6) * 2.8, 0.3, e.pos.z + Math.cos(a + 0.6) * 2.8), 0x9a8a70, 24, 4, 0.3, 0.6, -8, 3); }
      if (A.t < 0.85) X.turn(e, angTo(e, A.tg.pos.x, A.tg.pos.z), dt * 3.5);
      if (!A.thrown && A.t > 0.95){ A.thrown = true; e.an = { k: 'throw', t: 0 }; X.sfx('throw'); const a = e.g.rotation.y;
        for (let i = 0; i < A.n; i++){ const u = i === 0 ? A.tg : randUnit(0.4), to = inArena(u.pos.x + rr(-0.8, 0.8), u.pos.z + rr(-0.8, 0.8), 1.5), T = 1.1 + i * 0.18, from = new V3(e.pos.x + Math.sin(a) * 1.6, 6.8, e.pos.z + Math.cos(a) * 1.6);
          lob(rockMesh(1.5), from, new V3(to.x, 0.6, to.z), T, 3.5);
          hz({ k: 'c', x: to.x, z: to.z, r: 3.0, T, dmg: e.dmg * 1.1, kb: 11, fire(){ X.shockwave(to.x, 0.12, to.z, 3.6, 0xc8a070, 0.45); X.burst(new V3(to.x, 0.5, to.z), 0x9a8a70, 30, 6, 0.32, 0.7, -8, 3); G.shake = Math.max(G.shake, 0.8); X.sfx('boom'); rubble(to.x, to.z, 1.35, 11); } }); } }
      return A.t > 1.9;
    },
    rocks(e, B, A){
      if (once(A)){ e.an = { k: 'roar', t: 0 }; X.sfx('roar'); G.shake = 0.9; alertMsg('천장이 무너진다!', '붉은 원 밖으로 — 떨어진 바위는 잠시 엄폐물이 돼요', '#ffb060', 2); A.n = B.bp === 1 ? 6 : B.bp === 2 ? 8 : 11; A.k = 0; A.L = aliveUnits(); }
      if (A.t > 0.6) while (A.k < A.n && A.t > 0.6 + A.k * 0.12){ const u = A.L[A.k]; const p = u ? inArena(u.pos.x + rr(-1, 1), u.pos.z + rr(-1, 1), 1.2) : inArena(rr(-17, 17), rr(-17, 17), 1.5); fallRock(p.x, p.z, { T: 1.5, dmg: e.dmg * 0.9 }); A.k++; }
      return A.t > 2.3;
    },
    stomp(e, B, A){
      if (!A.h){ e.an = { k: 'stomp', t: 0 }; A.h = hz({ k: 'c', x: e.pos.x, z: e.pos.z, r: e.cfg.rad + 3.2, T: 0.8, dmg: e.dmg * 0.8, kb: 13, fire(){ X.sfx('stomp'); G.shake = Math.max(G.shake, 0.8); X.shockwave(e.pos.x, 0.12, e.pos.z, e.cfg.rad + 4, 0xc8a070, 0.4); X.burst(new V3(e.pos.x, 0.3, e.pos.z), 0x9a8a70, 30, 6, 0.3, 0.6, -8, 3); } }); }
      return A.t > 1.3;
    },
    charge(e, B, A, dt){
      if (A.ph === 0){
        if (!A.h){ A.tg = randUnit(0.6); e.an = { k: 'charge', t: 0 }; X.sfx('roar'); A.h = hz({ k: 'r', x: e.pos.x, z: e.pos.z, w: 4.8, len: 30, ry: e.g.rotation.y, T: 1.3, hard: true }); A.hit = new Set(); }
        if (A.t < 0.9) X.turn(e, angTo(e, A.tg.pos.x, A.tg.pos.z), dt * 5);
        A.h.x = e.pos.x; A.h.z = e.pos.z; A.h.ry = e.g.rotation.y; A.len = rayOut(e.pos.x, e.pos.z, A.h.ry, e.cfg.rad); A.h.len = A.len; if (A.h.tele) A.h.tele.scale.z = A.len / 30;
        if (A.h.fired){ A.ph = 1; A.t = 0; A.dir = e.g.rotation.y; A.go = 0; X.sfx('stomp'); }
      } else if (A.ph === 1){
        const sp = 21, s = Math.min(sp * dt, A.len - A.go); A.go += s; e.pos.x += Math.sin(A.dir) * s; e.pos.z += Math.cos(A.dir) * s; B.moving = true;
        if (R() < dt * 40) X.burst(new V3(e.pos.x + rr(-1.5, 1.5), 0.3, e.pos.z + rr(-1.5, 1.5)), 0x9a8a70, 3, 3, 0.3, 0.5, -6, 2);
        for (const u of UNITS){ if (!alive(u) || A.hit.has(u.id)) continue; if (dst(e, u) < e.cfg.rad + 1.0){ A.hit.add(u.id); hurt(u, e.dmg * 1.3, e.pos.x, e.pos.z, 15); } }
        if (A.go >= A.len - 0.01){ A.ph = 2; A.t = 0; e.an = { k: 'slamDown', t: 0 }; G.shake = 1.5; X.sfx('boom'); X.shockwave(e.pos.x, 0.12, e.pos.z, 7, 0xffa040, 0.5);
          for (let i = 0; i < 4; i++){ const p = inArena(e.pos.x + rr(-6, 6), e.pos.z + rr(-6, 6), 1.3); fallRock(p.x, p.z, { T: 1.3 + i * 0.15, dmg: e.dmg * 0.8 }); } }
      } else return A.t > 1.1;
      return false;
    },
  },
  trans(e, B, T, dt){
    const m = e.m;
    if (T.n === 2){
      if (once(T)){ e.an = { k: 'roar', t: 0 }; G.shake = 1.2; }
      if (T.t > 1.0 && !T.s){ T.s = true; e.an = { k: 'slamDown', t: 0 }; X.sfx('boom'); flash(); X.shockwave(e.pos.x, 0.12, e.pos.z, 12, 0xffa040, 0.7);
        const dome = new THREE.Mesh(geo('domeG', () => new THREE.IcosahedronGeometry(1, 3)), SHIELD_M()); dome.scale.set(e.cfg.rad + 2.4, (e.cfg.rad + 2.4) * 1.45, e.cfg.rad + 2.4); dome.position.y = 3.4; dome.renderOrder = 5; e.g.add(dome);
        B.shield = { dome, py: [], beams: [] };
        for (let i = 0; i < 4; i++){ const a = i / 4 * TAU + PI / 4, x = Math.sin(a) * 13, z = Math.cos(a) * 13, p = X.spawnMon('rd_pylon', x, z, false, { lv: RS.blv - 3, ai: pylonAI, data: { pylon: true, home: new V3(x, 0, z) } });
          B.shield.py.push(p); const bm = new THREE.Mesh(geo('beamG', () => new THREE.CylinderGeometry(0.12, 0.12, 1, 6, 1, true).translate(0, 0.5, 0).rotateX(HPI)), addM(0xffa040, 0.7)); bm.frustumCulled = false; FXG.add(bm); B.shield.beams.push(bm);
          X.burst(new V3(x, 0.5, z), 0xffa040, 30, 5, 0.3, 0.8, -6, 3); }
        alertMsg('수정 첨탑을 부숴라!', '첨탑 4개가 그라녹에게 힘을 보내요 — 보호막이 사라질 때까지 무적', '#ffb060', 3.5); }
      return T.t > 2.6;
    }
    if (once(T)){ e.an = { k: 'roar', t: 0 }; }
    if (T.t > 0.8 && !T.s){ T.s = true; flash(); X.sfx('boom'); X.sfx('shard'); G.shake = 1.6; m.veinM.opacity = 0.95; m.coreM.color.set(0xfff0c0); m.orbit.visible = true; e.spdMul = 1.2;
      for (const p of m.plates){ FXG.attach(p); const v = new V3(p.position.x - e.pos.x, 0, p.position.z - e.pos.z).normalize().multiplyScalar(rr(3, 6)); v.y = rr(3, 6); FALLERS.push({ o: p, v, sp: rr(2, 5), floor: 0.35, t: 0, life: 9, thud: true }); }
      X.burst(new V3(e.pos.x, 5, e.pos.z), 0xffa040, 80, 9, 0.35, 1.0, -6, 3);
      for (let i = 0; i < 2; i++){ const a = e.g.rotation.y + (i ? 1.2 : -1.2), p = inArena(e.pos.x + Math.sin(a) * 6, e.pos.z + Math.cos(a) * 6, 2); X.spawnMon('golem', p.x, p.z, false, { lv: RS.blv - 3, scale: 1.2 }); } }
    return T.t > 2.8;
  },
  intro(e, t, dt, cam){
    const B = e.B, m = e.m;
    if (once(e.B, '_in')){ e.an = { k: 'curl', t: 0 }; e.coreK = 0.05; }
    if (t < 3){ const k = ease(t / 3); cam.pos.set(-12 + k * 9, 4.5 + k, 10 - k * 4); cam.look.set(0, 2.5, -9); }
    if (t > 1.5 && !B.i1){ B.i1 = true; e.coreK = 1; X.sfx('rune'); X.burst(new V3(0, 4.6, -7.6), 0xffa040, 40, 4, 0.3, 0.9, 0, 2); }
    if (t > 2.3 && !B.i2){ B.i2 = true; e.an = { k: 'rise', t: 0 }; X.sfx('rumble'); for (let i = 0; i < 6; i++){ const p = inArena(rr(-14, 14), rr(-14, 10), 2); fallRock(p.x, p.z, { T: 1.2 + i * 0.2, dmg: 0, stay: false }); } }
    if (t > 3.8 && !B.i3){ B.i3 = true; e.an = { k: 'roar', t: 0 }; X.sfx('roar'); G.shake = 1.5; X.banner('RAID BOSS', '바위 거인 그라녹', 'GRANOK THE STONEBORN', true, 3.2); X.shockwave(0, 0.12, -9, 12, 0xffa040, 0.7); }
    if (t > 3){ const k = ease(Math.min(1, (t - 3) / 2)); cam.pos.set(-3 + k * 9, 3 - k * 0.6, 3 + k * 1.5); cam.look.set(0, 4.5, -9); }
    return t > 6.6;
  },
  death(e, t, dt){
    const m = e.m;
    if (once(e.B, '_dt')){ e.an = { k: 'roar', t: 0 }; }
    if (t > 0.7 && !e.B.d0){ e.B.d0 = true; e.an = { k: 'kneel', t: 0 }; X.sfx('rumble'); }
    if (t > 1.3 && !e.B.d1){ e.B.d1 = true; flash(); X.sfx('boom'); X.sfx('shard'); G.shake = 1.8; e.coreK = 0; X.burst(new V3(e.pos.x, 4.8, e.pos.z), 0xffd08a, 120, 10, 0.4, 1.2, -4, 3); X.shockwave(e.pos.x, 0.12, e.pos.z, 14, 0xffa040, 0.8); }
    if (t > 1.3){ const k = Math.min(1, (t - 1.3) / 1.0); m.body.rotation.x = ease(k) * 1.2; m.body.position.y = -k * 1.4; }
    if (R() < dt * 16) X.burst(new V3(e.pos.x + rr(-2, 2), rr(1, 5), e.pos.z + rr(-2, 2)), pick([0x9a8a70, 0xffa040, 0x6a5a4c]), 6, 3, 0.35, 0.8, -8, 2);
    return t > 2.6;
  },
  anim(e, dt){
    const m = e.m, B = e.B, an = e.an || (e.an = { k: 'idle', t: 0 }), t = G.time, q = an.t += dt;
    const st = e.st2 || (e.st2 = { hip: 0, lean: 0.05, ax: [-0.15, -0.15], az: [-0.12, 0.12], el: [-0.35, -0.35], lg: [0, 0], hd: 0, core: 1, wph: 0 });
    let hip = 0, lean = 0.06, ax = [-0.15, -0.15], az = [-0.12, 0.12], el = [-0.35, -0.35], lg = [0, 0], hd = Math.sin(t * 0.7) * 0.05, rate = 9;
    switch (an.k){
      case 'walk': { st.wph += dt * 4.2; const s = Math.sin(st.wph); lg = [s * 0.42, -s * 0.42]; ax = [-0.15 - s * 0.3, -0.15 + s * 0.3]; hip = -Math.abs(Math.cos(st.wph)) * 0.18; lean = 0.12; break; }
      case 'slamUp': { const k = Math.min(1, q / 0.9); ax = [-2.9 * k, -2.9 * k]; el = [-0.5, -0.5]; lean = -0.18 * k; hip = -0.25 * k; hd = -0.3 * k; break; }
      case 'slamDown': ax = [-0.5, -0.5]; el = [-0.1, -0.1]; lean = 0.55; hip = -0.95; hd = 0.25; rate = q < 0.15 ? 30 : 6; break;
      case 'sweep': { const s = an.side || 1, i = s > 0 ? 1 : 0, w = Math.min(1, q / 0.75); ax[i] = -1.25; if (q < 0.8) az[i] = s * (0.2 + 1.2 * w); else az[i] = -s * 0.9; el[i] = -0.2; lean = 0.15; hip = -0.3; rate = q > 0.8 ? 26 : 8; break; }
      case 'grab': ax[1] = -0.55; el[1] = -0.15; az[1] = 0.35; lean = 0.55; hip = -0.8; break;
      case 'throw': { const k = Math.min(1, q / 0.25); ax[1] = q < 0.2 ? -2.7 : -1.1; el[1] = -0.2; lean = q < 0.2 ? -0.2 : 0.3; hip = -0.3; rate = 24; break; }
      case 'roar': az = [-1.25, 1.25]; ax = [-0.7, -0.7]; el = [-0.5, -0.5]; hd = -0.55; lean = -0.25; break;
      case 'stomp': lg[1] = q < 0.55 ? -0.9 : 0; hip = q < 0.55 ? 0.1 : -0.3; rate = q < 0.55 ? 8 : 30; break;
      case 'kneel': hip = -1.35; lean = 0.75; lg = [-0.95, 0.3]; ax = [-0.25, -0.25]; el = [0, 0]; hd = 0.45; break;
      case 'curl': hip = -1.6; lean = 1.0; lg = [-1.0, -1.0]; ax = [-0.4, -0.4]; el = [-0.9, -0.9]; hd = 0.6; break;
      case 'rise': { const k = Math.min(1, q / 1.3); hip = -1.6 * (1 - k); lean = 1.0 * (1 - k) + 0.06 * k; lg = [-1.0 * (1 - k), -1.0 * (1 - k)]; hd = 0.6 * (1 - k); rate = 6; break; }
      case 'charge': lean = 0.85; hip = -0.45; ax = [0.7, 0.7]; el = [-0.6, -0.6]; { st.wph += dt * (B && B.act && B.act.ph === 1 ? 12 : 3); const s = Math.sin(st.wph); lg = [s * 0.6, -s * 0.6]; } break;
    }
    st.hip = damp(st.hip, hip, rate, dt); st.lean = damp(st.lean, lean, rate, dt); st.hd = damp(st.hd, hd, 6, dt);
    for (let i = 0; i < 2; i++){ st.ax[i] = damp(st.ax[i], ax[i], rate, dt); st.az[i] = damp(st.az[i], az[i], rate, dt); st.el[i] = damp(st.el[i], el[i], rate, dt); st.lg[i] = damp(st.lg[i], lg[i], rate, dt);
      m.arms[i].rotation.set(st.ax[i], 0, st.az[i]); m.elbows[i].rotation.x = st.el[i]; m.legs[i].rotation.x = st.lg[i]; }
    const br = Math.sin(t * 1.3); m.body.position.y = st.hip; m.chest.rotation.x = st.lean + br * 0.015; m.head.rotation.x = st.hd;
    st.core = damp(st.core, e.coreK ?? 1, 3, dt); const pulse = 0.85 + Math.sin(t * (B && B.bp >= 3 ? 7 : 3)) * 0.15;
    m.coreGlow.material.opacity = st.core * pulse; m.coreGlow.scale.setScalar((B && B.bp >= 3 ? 7 : 5) * (0.8 + 0.2 * pulse)); m.core.scale.setScalar(0.5 + st.core * 0.5); m.core.rotation.y += dt * 1.5; m.eyeM.color.setRGB(st.core, st.core * 0.69, st.core * 0.31);
    if (m.orbit.visible){ m.orbit.rotation.y += dt * 0.9; m.orbit.children.forEach((o, i) => { o.position.y = Math.sin(t * 1.5 + i) * 0.6; o.rotation.x += dt; }); }
    if (B && B.bp >= 2 && m.veinM.opacity < 0.5) m.veinM.opacity = 0.5;
    if (m.veinM.opacity > 0) m.veinM.opacity = Math.max(0.4, m.veinM.opacity) * (0.92 + Math.sin(t * 6) * 0.08);
  },
};
function pylonAI(e, dt){ return guard('pylon', () => pylonAI0(e, dt)); }
function pylonAI0(e, dt){
  e.pos.set(e.home.x, 0, e.home.z); e.vel.set(0, 0, 0); e.g.rotation.y += dt * 0.4;
  e.pt = (e.pt ?? rr(2.5, 4.5)) - dt;
  if (e.pt <= 0 && RS && RS.phase === 'fight'){ e.pt = rr(6, 7.5); const x = e.pos.x, z = e.pos.z, dmg = RS.boss ? RS.boss.dmg * 0.5 : 20;
    hz({ k: 'c', x, z, r: 3.7, T: 1.35, dmg, kb: 10, fire(){ X.shockwave(x, 0.15, z, 4.3, 0xffa040, 0.45); X.burst(new V3(x, 1.5, z), 0xffb060, 26, 5, 0.25, 0.6, -6, 2); X.sfx('shard'); } }); }
  if (e.m.gl) e.m.gl.material.opacity = 0.55 + Math.sin(G.time * 5 + e.ph) * 0.2;
  return false;
}
function shieldUpd(e, dt){
  const S2 = e.B.shield; if (!S2) return;
  e.under = true; SHIELD_M().uniforms.uT.value += dt;
  let n = 0; S2.py.forEach((p, i) => { const bm = S2.beams[i]; if (!live(p)){ if (bm.visible){ bm.visible = false; X.sfx('shard'); X.burst(new V3(p.pos.x, 2.4, p.pos.z), 0xffb060, 40, 6, 0.3, 0.8, -6, 3); } return; } n++;
    const a = new V3(p.pos.x, 3.6, p.pos.z), b = e.m.core.getWorldPosition(new V3()), d = b.clone().sub(a); bm.position.copy(a); bm.scale.set(1 + Math.sin(G.time * 20 + i) * 0.3, 1 + Math.sin(G.time * 17 + i) * 0.3, d.length()); bm.lookAt(b); });
  S2.dome.material.uniforms.uA.value = 0.6 + n * 0.1;
  if (!n){ e.B.shield = null; e.g.remove(S2.dome); for (const bm of S2.beams) FXG.remove(bm); e.under = false; e.B.stagger = 5.5; e.B.act = null; e.an = { k: 'kneel', t: 0 };
    flash(); X.sfx('shard'); X.sfx('boom'); G.shake = 1.4; X.burst(new V3(e.pos.x, 4, e.pos.z), 0xffd08a, 120, 10, 0.3, 1.1, -6, 3); alertMsg('보호막 붕괴!', '그라녹이 무릎을 꿇었다 — 지금 집중 공격!', '#ffd36a', 3); }
}

// ───────────────────────── 서리 거룡 크라이오스 ─────────────────────────
function shadowed(u, ox, oz){ const ux = u.pos.x - ox, uz = u.pos.z - oz, L = Math.hypot(ux, uz) || 1, dx = ux / L, dz = uz / L;
  for (const p of RS.ctx.pillars || []){ const px = p.x - ox, pz = p.z - oz, t = px * dx + pz * dz; if (t <= 0 || t >= L - 0.2) continue; const perp = Math.abs(px * dz - pz * dx); if (perp < p.r + 0.25) return true; } return false; }
function stormSpot(u, ox, oz){ let best = null, bd = 1e9; for (const p of RS.ctx.pillars || []){ const px = p.x - ox, pz = p.z - oz, L = Math.hypot(px, pz) || 1, sx = p.x + px / L * (p.r + 1.5), sz = p.z + pz / L * (p.r + 1.5), d = Math.hypot(sx - u.pos.x, sz - u.pos.z); if (d < bd){ bd = d; best = [sx, sz]; } } return best; }
function breathFx(e, n = 3, spread = 0.35, sp = 16){ const w = e.m.mouth.getWorldPosition(new V3()), a = e.g.rotation.y + (e.m.head.rotation.y || 0), pitch = e.B && e.B.pin ? 0.75 : 0.32;
  for (let i = 0; i < n; i++){ const aa = a + rr(-spread, spread), s = sp * rr(0.7, 1.1); X.emit(w.x, w.y, w.z, Math.sin(aa) * s * Math.cos(pitch), -Math.sin(pitch) * s * rr(0.6, 1.2), Math.cos(aa) * s * Math.cos(pitch), R() < 0.4 ? 0xffffff : 0x9ae8ff, rr(0.35, 0.65), rr(0.5, 0.8), { drag: 1.2, grow: 1.6 }); } }
BK.cryos = {
  phases: [['서리 거룡', '물기 · 꼬리 · 숨결 · 얼음 가시'], ['하늘의 지배자', '크라이오스가 날아올랐다 — 서리 정령을 처치하고 숨결을 피하라'], ['절대 영도', '제단 가장자리가 무너진다! 폭풍이 잦아진다']],
  cd: { bite: 2.8, tail: 6, breath: 8, spikes: 7.5, flyover: 16, storm: 40, wisps: 30 },
  pick(e, B, f, d){
    if (B.next){ const k = B.next; B.next = null; return k; }
    const near = d < e.cfg.rad + 3.8, c = k => B.cds[k] > 0 ? 0 : 1, behind = aliveUnits().some(u => dst(e, u) < 9.5 && Math.abs(angDiff(angTo(e, u.pos.x, u.pos.z), e.g.rotation.y + PI)) < 1.6);
    if (!B.st1 && e.hp / e.max < 0.86){ B.st1 = true; return 'storm'; }
    if (!B.fo1 && e.hp / e.max < 0.93){ B.fo1 = true; return 'flyover'; }
    return wpick([['bite', (near ? 5 : 0) * c('bite')], ['tail', (behind ? 5 : 0.5) * c('tail')], ['breath', 3 * c('breath')], ['spikes', 3 * c('spikes')], ['flyover', (B.bp >= 3 ? 2 : 1) * c('flyover')], ['storm', (B.bp >= 3 ? 4 : 0) * c('storm')], ['wisps', (B.bp >= 3 ? 1.5 : 0) * c('wisps')]]);
  },
  move(e, B, f, d, dt){
    X.turn(e, angTo(e, f.pos.x, f.pos.z), dt * 2.4);
    if (d > e.cfg.rad + 3.6){ const a = e.g.rotation.y; e.pos.x += Math.sin(a) * e.cfg.spd * dt; e.pos.z += Math.cos(a) * e.cfg.spd * dt; B.moving = true; if (!e.an || e.an.k !== 'walk') e.an = { k: 'walk', t: 0 }; }
    else if (e.an && e.an.k === 'walk') e.an = { k: 'idle', t: 0 };
  },
  // 날기: 현재 위치에서 목표(x, y, z)로 T초 동안 (B.pin 으로 위치를 잡아요)
  fly(e, B, A, to, T, dt, face){ if (!A.fl){ A.fl = { from: B.pin ? new V3(B.pin.x, B.pin.y, B.pin.z) : e.pos.clone(), t: 0 }; } const f = A.fl; f.t += dt; const k = Math.min(1, f.t / T), q = ease(k);
    const x = f.from.x + (to.x - f.from.x) * q, z = f.from.z + (to.z - f.from.z) * q, y = f.from.y + (to.y - f.from.y) * q + Math.sin(k * PI) * (to.arc || 0);
    const ry = face ?? (Math.hypot(to.x - f.from.x, to.z - f.from.z) > 0.5 ? Math.atan2(to.x - f.from.x, to.z - f.from.z) : e.g.rotation.y); B.pin = { x, y, z, ry: B.pin && face == null ? B.pin.ry + angDiff(ry, B.pin.ry) * Math.min(1, dt * 5) : ry };
    if (k >= 1){ A.fl = null; return true; } return false; },
  acts: {
    bite(e, B, A, dt){
      if (!A.h){ A.tg = B.focus; e.an = { k: 'bite', t: 0 }; A.h = hz({ k: 's', x: e.pos.x, z: e.pos.z, r: e.cfg.rad + 3.6, ry: angTo(e, A.tg.pos.x, A.tg.pos.z), span: 1.25, T: A.tg.me ? 0.85 : 0.7, dmg: e.dmg * 1.0, kb: 9, fire(){ X.sfx('crit'); G.shake = Math.max(G.shake, 0.5); } }); }
      if (A.t < 0.4){ X.turn(e, angTo(e, A.tg.pos.x, A.tg.pos.z), dt * 4); A.h.ry = e.g.rotation.y; } A.h.x = e.pos.x; A.h.z = e.pos.z; return A.t > 1.3;
    },
    tail(e, B, A){
      if (!A.h){ e.an = { k: 'tail', t: 0 }; X.sfx('swing'); A.h = hz({ k: 's', x: e.pos.x, z: e.pos.z, r: 9.8, ry: e.g.rotation.y + PI, span: 3.5, T: 1.05, dmg: e.dmg * 1.05, kb: 15, fire(h){ X.sfx('stomp'); G.shake = Math.max(G.shake, 0.8); for (let i = 0; i < 10; i++){ const a = h.ry + rr(-1.6, 1.6), r = rr(3, 9); X.burst(new V3(e.pos.x + Math.sin(a) * r, 0.3, e.pos.z + Math.cos(a) * r), 0xdff6ff, 4, 4, 0.3, 0.6, -6, 2); } } });
        if (!RS.tailHint){ RS.tailHint = true; tip('크라이오스 <b>뒤쪽</b>은 꼬리 휘두르기 범위예요 — 옆에서 싸우세요', 4.5); } }
      return A.t > 1.7;
    },
    breath(e, B, A, dt){
      if (!A.h){ A.tg = randUnit(0.6); e.an = { k: 'breath', t: 0 }; X.sfx('rumble'); A.h = hz({ k: 's', x: e.pos.x, z: e.pos.z, r: 14.5, ry: angTo(e, A.tg.pos.x, A.tg.pos.z), span: 0.95, T: 1.25, dmg: e.dmg * 1.25, kb: 6,
        fire(h){ X.sfx('boom'); for (const d of [5, 8.5, 12]){ const x = h.x + Math.sin(h.ry) * d, z = h.z + Math.cos(h.ry) * d, p = inArena(x, z, 1); pool(p.x, p.z, 1.9 + d * 0.06, 8, e.dmg * 0.3, 'frost'); } } }); }
      if (A.t < 0.8){ X.turn(e, angTo(e, A.tg.pos.x, A.tg.pos.z), dt * 3); A.h.ry = e.g.rotation.y; } A.h.x = e.pos.x; A.h.z = e.pos.z;
      if (A.t > 1.2 && A.t < 2.3) breathFx(e, 4, 0.32, 18);
      return A.t > 2.6;
    },
    spikes(e, B, A, dt){
      if (once(A)){ e.an = { k: 'roar', t: 0 }; X.sfx('shard'); A.kind = B.bp >= 2 ? pick(['lines', 'chase', 'rings']) : pick(['lines', 'chase']); A.k = 0; }
      const D = e.dmg * 0.75;
      if (A.kind === 'lines' && A.t > 0.35 && !A.done){ A.done = true; const n = B.bp >= 3 ? 8 : 6, a0 = R() * TAU; for (let r = 0; r < n; r++){ const a = a0 + r / n * TAU; for (let i = 0; i < 8; i++){ const d = e.cfg.rad + 1.6 + i * 2.3, x = e.pos.x + Math.sin(a) * d, z = e.pos.z + Math.cos(a) * d, p = inArena(x, z, 0.5); if (Math.hypot(p.x - x, p.z - z) > 0.6) break; iceSpike(x, z, 0.9 + i * 0.11, D); } } }
      if (A.kind === 'chase') while (A.k < 3 && A.t > 0.35 + A.k * 0.85){ A.k++; for (const u of aliveUnits()){ iceSpike(u.pos.x, u.pos.z, 0.95, D); } const p = inArena(rr(-15, 15), rr(-15, 15), 1); iceSpike(p.x, p.z, 0.95, D); }
      if (A.kind === 'rings' && A.t > 0.35 && !A.done){ A.done = true; [5.5, 10, 14.5].forEach((r, ri) => { const n = Math.round(TAU * r / 2.5), gap = Math.floor(R() * n); for (let i = 0; i < n; i++){ if ((i - gap + n) % n < 2) continue; const a = i / n * TAU, x = Math.sin(a) * r, z = Math.cos(a) * r; iceSpike(x, z, 0.95 + ri * 0.55, D); } }); }
      return A.t > (A.kind === 'chase' ? 3.4 : 2.6);
    },
    wisps(e, B, A){
      if (once(A)){ e.an = { k: 'roar', t: 0 }; X.sfx('summon'); }
      if (!A.done && A.t > 0.7){ A.done = true; const n = B.bp >= 2 ? 4 : 3; for (let i = 0; i < n; i++){ const a = i / n * TAU + R(), p = inArena(Math.sin(a) * 11, Math.cos(a) * 11, 2); X.burst(new V3(p.x, 1, p.z), 0xcff4ff, 26, 4, 0.3, 0.8, -2, 2); X.spawnMon('rd_wisp', p.x, p.z, B.bp >= 3 && i === 0, { lv: RS.blv - 3 }); }
        alertMsg('서리 정령 소환!', '정령을 처치하세요 — 파티원도 도와요', '#8ae8ff', 2.2); }
      return A.t > 1.4;
    },
    flyover(e, B, A, dt){
      if (A.ph === 0){ if (once(A)){ e.under = true; RS.flying = true; e.an = { k: 'fly', t: 0 }; X.sfx('buzz'); A.tg = randUnit(0.6); } if (A.skip || BK.cryos.fly(e, B, A, { x: e.pos.x, y: 9, z: e.pos.z }, 1.0, dt)){ A.ph = 1; A.t = 0; const ca = Math.atan2(A.tg.pos.x, A.tg.pos.z) + PI + rr(-0.45, 0.45); A.S = new V3(Math.sin(ca) * 28, 9, Math.cos(ca) * 28); } }
      else if (A.ph === 1){ if (!A.S){ const tg = A.tg || randUnit(0.6), ca = Math.atan2(tg.pos.x, tg.pos.z) + PI + rr(-0.45, 0.45); A.tg = tg; A.S = new V3(Math.sin(ca) * 28, 9, Math.cos(ca) * 28); } if (BK.cryos.fly(e, B, A, A.S, 1.4, dt, null)){ A.ph = 2; A.t = 0; const tx = A.tg.pos.x, tz = A.tg.pos.z; A.ry = Math.atan2(tx - A.S.x, tz - A.S.z); A.len = 56; A.hit = new Set();
          A.h = hz({ k: 'r', x: A.S.x, z: A.S.z, w: 6.2, len: A.len, ry: A.ry, T: 1.3 + A.len / 26, hard: false }); alertMsg('서리 숨결!', '붉은 띠 밖으로!', '#8ae8ff', 1.6); X.sfx('roar'); } }
      else if (A.ph === 2){ B.pin.ry += angDiff(A.ry, B.pin.ry) * Math.min(1, dt * 6); if (A.t > 1.3){ A.ph = 3; A.t = 0; A.go = 0; e.an = { k: 'flybreath', t: 0 }; X.sfx('boom'); } }
      else if (A.ph === 3){ A.go += 26 * dt; const s = Math.sin(A.ry), c = Math.cos(A.ry); B.pin = { x: A.S.x + s * A.go, y: 8.5, z: A.S.z + c * A.go, ry: A.ry }; breathFx(e, 5, 0.25, 15);
        for (const u of UNITS){ if (!alive(u) || A.hit.has(u.id)) continue; const dx = u.pos.x - A.S.x, dz = u.pos.z - A.S.z, al = dx * s + dz * c, sd = dx * c - dz * s; if (al <= A.go - 2.5 && al > A.go - 9 && Math.abs(sd) < 3.4){ A.hit.add(u.id); hurt(u, e.dmg * 1.25, u.pos.x - c * Math.sign(sd || 1), u.pos.z + s * Math.sign(sd || 1), 6); } }
        if (A.go - 6 > (A.lastP ?? -99) + 9 && A.go > 12 && A.go < A.len - 10){ A.lastP = A.go - 6; const p = inArena(A.S.x + s * (A.go - 6), A.S.z + c * (A.go - 6), 1); pool(p.x, p.z, 2.3, 8, e.dmg * 0.3, 'frost'); }
        if (A.go >= A.len){ if (A.h) rmHz(A.h); A.ph = 4; A.t = 0; if (A.stay) return true; A.L = inArena(rr(-7, 7), rr(-7, 7), 3); A.L.y = 0; A.L.arc = 3; } }
      else if (A.ph === 4){ if (BK.cryos.fly(e, B, A, A.L, 1.5, dt)){ B.pin = null; e.pos.set(A.L.x, 0, A.L.z); e.under = false; RS.flying = false; e.an = { k: 'land', t: 0 }; X.shockwave(e.pos.x, 0.1, e.pos.z, 8, 0xcff4ff, 0.6); X.burst(new V3(e.pos.x, 0.4, e.pos.z), 0xdff6ff, 50, 7, 0.35, 0.8, -6, 3); G.shake = 1.0; X.sfx('stomp'); return true; } }
      return false;
    },
    storm(e, B, A, dt){
      if (A.ph === 0){ if (once(A)){ e.under = true; RS.flying = true; e.an = { k: 'fly', t: 0 }; X.sfx('buzz'); }
        if (BK.cryos.fly(e, B, A, { x: 0, y: 7.5, z: 0, arc: 2 }, 1.5, dt)){ A.ph = 1; A.t = 0; e.an = { k: 'roar', t: 0 }; X.sfx('roar'); G.shake = 1.0;
          RS.storm = { t: 0, T: 5.5, spot: u => stormSpot(u, 0, 0) }; if (RS.ctx.storm) RS.ctx.storm.visible = true; A.zones = [];
          for (const p of RS.ctx.pillars){ const L = Math.hypot(p.x, p.z), th = Math.atan2(p.x, p.z), al = Math.asin(Math.min(0.99, p.r / L)) * 0.92, g = new THREE.RingGeometry(L, RS.rad + 0.5, 12, 1, th - al - HPI, al * 2).rotateX(-HPI), z = new THREE.Mesh(g, addM(0x7ad8ff, 0.45)); z.position.y = 0.07; z.renderOrder = 3; FXG.add(z); A.zones.push(z); } } }
      else if (A.ph === 1){ const left = 5.5 - A.t; RS.storm.t = A.t; for (const z of A.zones) z.material.opacity = 0.32 + Math.sin(G.time * 8) * 0.14; if (Math.ceil(left) !== A.lastN){ A.lastN = Math.ceil(left); alertMsg('얼어붙는 폭풍!', '파란 그림자 — 얼음 기둥 뒤로 숨어라!', '#8ae8ff', 1.2, String(Math.max(1, A.lastN))); X.sfx('ui'); }
        veil('frost', 0.3); if (R() < dt * 30) X.emit(rr(-20, 20), rr(1, 9), rr(-20, 20), rr(-2, 2), rr(-1, 1), rr(-2, 2), 0xffffff, 0.3, 0.8);
        if (A.t >= 5.5){ A.ph = 2; A.t = 0; flash(); G.shake = 1.6; X.sfx('boom'); X.sfx('shard'); veil('frost', 1.6);
          for (const u of UNITS){ if (!alive(u)) continue; if (shadowed(u, 0, 0)){ X.dmgNum(new V3(u.pos.x, 2.4, u.pos.z), '막음!', 'heal'); continue; }
            if (u.me){ X.hurtPlayer(X.D().maxHp * 0.62 * RS.dmgMul, new V3(0, 0, 0), 9); } else hurt(u, u.max * 0.72 / (u.role === 'tank' ? 0.62 : 1), 0, 0, 9); }
          X.burst(new V3(0, 6, 0), 0xdff6ff, 140, 16, 0.4, 1.1, -3, 2); for (const z of A.zones){ FXG.remove(z); z.geometry.dispose(); z.material.dispose(); } A.zones = []; RS.storm = null; after(1.5, () => { if (RS && RS.ctx.storm && !RS.storm) RS.ctx.storm.visible = false; }); } }
      else if (A.ph === 2){ if (A.t > 0.8){ A.ph = 3; A.t = 0; A.L = inArena(rr(-5, 5), rr(-5, 5), 3); A.L.y = 0; A.L.arc = 2; } }
      else if (A.ph === 3){ if (BK.cryos.fly(e, B, A, A.L, 1.3, dt)){ B.pin = null; e.pos.set(A.L.x, 0, A.L.z); e.under = false; RS.flying = false; e.an = { k: 'land', t: 0 }; X.shockwave(e.pos.x, 0.1, e.pos.z, 8, 0xcff4ff, 0.6); G.shake = 0.9; X.sfx('stomp'); return true; } }
      return false;
    },
  },
  trans(e, B, T, dt){
    if (T.n === 2){
      if (T.ph === 0){ if (once(T)){ e.an = { k: 'roar', t: 0 }; } if (T.t > 1.0){ T.ph = 1; T.t = 0; e.an = { k: 'fly', t: 0 }; RS.flying = true; X.sfx('buzz'); } return false; }
      if (T.ph === 1){ if (BK.cryos.fly(e, B, T, { x: 0, y: 12, z: 0, arc: 0 }, 1.5, dt)){ T.ph = 2; T.t = 0; T.ang = Math.atan2(B.pin.x, B.pin.z); T.runT = 2.5; T.runs = 0; T.spkT = 4; BK.cryos.acts.wisps(e, B, { t: 0.8, done: false }); } return false; }
      if (T.ph === 2){
        if (T.run){ T.run.t += dt; if (BK.cryos.acts.flyover(e, B, T.run, dt)){ T.run = null; T.runs++; T.runT = 6.5; T.back = { t: 0 }; T.fl = null; } return false; }
        if (T.back){ const a = T.ang, to = { x: Math.sin(a) * 24, y: 12, z: Math.cos(a) * 24, arc: 0 }; if (BK.cryos.fly(e, B, T, to, 2.0, dt)){ T.back = null; } return false; }
        T.ang += dt * 0.32; B.pin = { x: Math.sin(T.ang) * 24, y: 12 + Math.sin(G.time) * 0.5, z: Math.cos(T.ang) * 24, ry: T.ang + HPI }; e.an = { k: 'fly', t: 0 };
        T.spkT -= dt; if (T.spkT <= 0){ T.spkT = 5; for (const u of aliveUnits()) iceSpike(u.pos.x, u.pos.z, 1.0, e.dmg * 0.7); }
        T.runT -= dt; const adds = X.ENEMIES.some(o => o !== e && live(o));
        if ((!adds && T.runs >= 2) || T.t > 32){ T.ph = 3; T.t = 0; T.L = { x: 0, y: 0, z: -4, arc: 0 }; return false; }
        if (T.runT <= 0){ T.run = { t: 0, ph: 1, stay: true, tg: randUnit(0.6) }; T.ang = Math.atan2(B.pin.x, B.pin.z); if (T.runs === 1) BK.cryos.acts.wisps(e, B, { t: 0.8, done: false }); }
        return false; }
      if (T.ph === 3){ if (BK.cryos.fly(e, B, T, T.L, 1.6, dt)){ B.pin = null; e.pos.set(0, 0, -4); RS.flying = false; e.an = { k: 'land', t: 0 }; X.shockwave(0, 0.1, -4, 10, 0xcff4ff, 0.7); G.shake = 1.3; X.sfx('boom'); B.next = 'storm'; return true; } return false; }
      return false;
    }
    if (once(T)){ e.an = { k: 'roar', t: 0 }; X.sfx('roar'); alertMsg('제단이 무너진다!', '가장자리에서 벗어나세요', '#8ae8ff', 2.6); RS.shrink = { t: 0, from: RS.def.shapes[0].c[2], to: 16.5 }; e.spdMul = 1.18; }
    if (T.t > 3.2){ B.next = 'storm'; B.cds.storm = 0; return true; }
    return false;
  },
  intro(e, t, dt, cam){
    const B = e.B;
    if (once(e.B, '_in')){ B.pin = { x: 0, y: 34, z: -70, ry: 0 }; e.under = true; e.an = { k: 'fly', t: 0 }; B.air = 1; }
    if (t < 3.2){ const k = Math.min(1, t / 3.2), q = ease(k); B.pin = { x: Math.sin(k * 2) * 8 * (1 - k), y: 34 * (1 - q) + 0.0 * q + Math.sin(k * PI) * 6, z: -70 + 62 * q, ry: 0 }; cam.pos.set(6, 3 + k * 2, 14); cam.look.set(B.pin.x * 0.5, B.pin.y * 0.6 + 2, B.pin.z * 0.6); if (!B.i0 && t > 0.4){ B.i0 = true; X.sfx('buzz'); } }
    if (t > 3.2 && !B.i1){ B.i1 = true; B.pin = null; e.pos.set(0, 0, -8); e.an = { k: 'land', t: 0 }; X.shockwave(0, 0.1, -8, 14, 0xcff4ff, 0.8); X.burst(new V3(0, 0.5, -8), 0xdff6ff, 100, 10, 0.4, 1.1, -6, 4); G.shake = 1.7; X.sfx('boom'); }
    if (t > 3.9 && !B.i2){ B.i2 = true; e.an = { k: 'roar', t: 0 }; X.sfx('roar'); X.banner('RAID BOSS', '서리 거룡 크라이오스', 'CRYOS THE FROST WYRM', true, 3.2); G.shake = 1.2; }
    if (t > 3.2){ const k = ease(Math.min(1, (t - 3.2) / 3)); cam.pos.set(-7 + k * 3, 2.2 + k * 1.2, 2 + k * 2); cam.look.set(0, 4.5 + k, -8); if (t > 3.9 && t < 5.6) breathFx(e, 2, 0.5, 10); }
    return t > 6.8;
  },
  death(e, t, dt){
    const m = e.m, B = e.B;
    if (once(e.B, '_dt')){ e.an = { k: 'roar', t: 0 }; if (B.pin){ B.fall = new V3(B.pin.x, B.pin.y, B.pin.z); } }
    if (B.fall){ const k = Math.min(1, t / 0.9); B.pin = { x: B.fall.x * (1 - k * 0.3), y: B.fall.y * (1 - k * k), z: B.fall.z * (1 - k * 0.3), ry: e.g.rotation.y }; if (k >= 1){ e.pos.set(B.pin.x, 0, B.pin.z); B.pin = null; B.fall = null; G.shake = 1.4; X.sfx('boom'); } }
    if (t > 0.9){ const k = Math.min(1, (t - 0.9) / 1.0); m.body.rotation.z = ease(k) * 1.35; m.body.position.y = -k * 1.2; e.an = { k: 'dead', t: 0 }; }
    if (R() < dt * 16) X.burst(new V3(e.pos.x + rr(-3, 3), rr(1, 5), e.pos.z + rr(-3, 3)), pick([0xdff6ff, 0x8ae8ff, 0xffffff]), 6, 3, 0.3, 0.8, -4, 2);
    if (t > 2.1 && !B.d1){ B.d1 = true; flash(); X.sfx('shard'); X.sfx('boom'); G.shake = 1.6; X.burst(new V3(e.pos.x, 3, e.pos.z), 0xcff4ff, 160, 12, 0.45, 1.3, -6, 4); X.shockwave(e.pos.x, 0.1, e.pos.z, 16, 0xcff4ff, 0.9); }
    return t > 2.6;
  },
  anim(e, dt){
    const m = e.m, B = e.B || {}, an = e.an || (e.an = { k: 'idle', t: 0 }), t = G.time, q = an.t += dt;
    const st = e.st2 || (e.st2 = { air: 0, flap: 0, jaw: 0, hx: 0, hy: 6.3, hz: 4.0, pitch: 0, sw: 0, wph: 0, yaw: 0 });
    const flying = an.k === 'fly' || an.k === 'flybreath' || !!B.pin;
    let air = flying ? 1 : 0, jaw = 0.04, hx = 0, hy = 6.3 + Math.sin(t * 1.2) * 0.15, hz = 4.0, pitch = 0.1, sw = 0, spread = 0;
    const f = B.focus; if (f && !flying){ st.yaw = damp(st.yaw, clamp(angDiff(angTo(e, f.pos.x, f.pos.z), e.g.rotation.y), -0.8, 0.8), 4, dt); } else st.yaw = damp(st.yaw, 0, 4, dt);
    hx = Math.sin(st.yaw) * 1.6;
    switch (an.k){
      case 'bite': { const k = q < 0.55 ? q / 0.55 : 1; if (q < 0.55){ hy = 6.6; hz = 3.4; jaw = 0.5 * k; } else if (q < 0.8){ hy = 3.6; hz = 6.8; jaw = q < 0.68 ? 0.7 : 0; } else { hy = 5.2; hz = 4.8; } break; }
      case 'breath': { hy = q < 1.2 ? 6.8 : 4.6; hz = q < 1.2 ? 3.4 : 5.8; pitch = q < 1.2 ? -0.2 : 0.45; jaw = q < 1.2 ? 0.2 : 0.75; break; }
      case 'flybreath': hy = 4.6; hz = 5.6; pitch = 0.8; jaw = 0.75; break;
      case 'roar': hy = 7.4; hz = 3.2; pitch = -0.5; jaw = 0.85; spread = 1; break;
      case 'tail': sw = q < 0.95 ? -0.9 * (q / 0.95) : Math.min(1.8, -0.9 + (q - 0.95) * 14); break;
      case 'land': hy = 5.6; hz = 4.6; break;
      case 'dead': hy = 1.8; hz = 5.6; jaw = 0.5; pitch = 0.6; break;
    }
    st.air = damp(st.air, air, 3, dt); st.jaw = damp(st.jaw, jaw, 14, dt); st.hx = damp(st.hx, hx, 8, dt); st.hy = damp(st.hy, hy, an.k === 'bite' ? 16 : 6, dt); st.hz = damp(st.hz, hz, an.k === 'bite' ? 16 : 6, dt); st.pitch = damp(st.pitch, pitch, 6, dt); st.sw = damp(st.sw, sw, an.k === 'tail' && q > 0.95 ? 18 : 6, dt);
    // 몸통 기울기 · 다리
    m.body.rotation.x = st.air * 0.12; const br = Math.sin(t * 1.4); m.torso.scale.set(1.55 + br * 0.02, 1.35 + br * 0.03, 2.35);
    for (let i = 0; i < 2; i++){ const walk = e.an.k === 'walk' ? Math.sin(t * 5 + i * PI) * 0.4 : 0; m.legs[i].rotation.x = -st.air * 1.1 + walk; }
    // 목 (베지어) · 머리
    const N0x = 0, N0y = 4.55, N0z = 2.2, Hx = st.hx, Hy = st.hy, Hz = st.hz, Cx = Hx * 0.4, Cy = (N0y + Hy) / 2 + 1.0, Cz = (N0z + Hz) / 2 - 0.4;
    for (let i = 0; i < m.neck.length; i++){ const u = (i + 0.6) / (m.neck.length + 0.4), a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u; m.neck[i].position.set(a * N0x + b * Cx + c * Hx, a * N0y + b * Cy + c * Hy, a * N0z + b * Cz + c * Hz); }
    m.head.position.set(Hx, Hy, Hz); m.head.rotation.set(st.pitch, st.yaw * 0.8, 0); m.jaw.rotation.x = st.jaw;
    // 꼬리 (늘어진 사슬 · 휘두르기)
    let px = 0, py = 3.25, pz = -2.3, ang = PI; const L = 0.78;
    for (let i = 0; i < m.tail.length; i++){ const k = i / m.tail.length; ang = PI + st.sw * (0.4 + k) + Math.sin(t * 1.6 - i * 0.45) * 0.16 * k * (1 + st.air); const dy = st.air > 0.5 ? -0.08 : (py > 0.5 ? -0.32 * (1 - k * 0.5) : 0);
      px += Math.sin(ang) * L; pz += Math.cos(ang) * L; py = Math.max(0.35 + (1 - k) * 0.2, py + dy * (1 - st.air) + (st.air * (Math.sin(t * 2 - i * 0.5) * 0.08))); m.tail[i].position.set(px, py, pz); if (i === m.tail.length - 1) m.tail[i].rotation.y = ang; }
    // 날개: 땅에서는 접고 · 하늘에서는 펄럭 · 포효 때 활짝
    st.wph += dt * (st.air > 0.5 ? 5.2 : 1.2); const fold = Math.max(0, 1 - Math.max(st.air, spread)), flap = Math.sin(st.wph) * 0.6 * st.air;
    m.wings.forEach((w, i) => { const s = i ? 1 : -1; w.rotation.z = s * (flap + fold * 1.15 + 0.08); w.rotation.y = -s * fold * 0.75; w.scale.set(s * (1 - fold * 0.45), 1, 1 - fold * 0.2); });
    m.memM.emissiveIntensity = 0.35 + st.air * 0.2 + Math.sin(t * 2) * 0.05;
  },
};

// ───────────────────────── 레이드 정의 (전장 모양 · 분위기) ─────────────────────────
const MOODR = {
  grom: { k: 0.78, mul: [0.72, 0.95, 0.86], add: [0.0, 0.03, 0.025], sun: [0.78, 1.0, 0.86], sunI: 1.6, hemi: 0.34, hemiC: 0x7ad0a0, fog: [0.07, 0.14, 0.12], fogD: 0.022, exp: 1.0, dir: [-0.25, 0.92, 0.3], env: 0.45 },
  granok: { k: 0.8, mul: [0.64, 0.54, 0.47], add: [0.02, 0.012, 0.0], sun: [1, 0.76, 0.52], sunI: 1.2, hemi: 0.3, hemiC: 0xffa060, fog: [0.05, 0.035, 0.025], fogD: 0.026, exp: 1.02, dir: [0.1, 0.95, 0.15], env: 0.3 },
  cryos: { k: 0.92, mul: [0.52, 0.68, 1.0], add: [0.01, 0.02, 0.05], sun: [0.72, 0.86, 1], sunI: 1.8, hemi: 0.42, hemiC: 0x9ac8ff, fog: [0.09, 0.13, 0.22], fogD: 0.0055, exp: 0.98, dir: [-0.5, 0.62, -0.45], env: 0.65 },
};
const DEFS = {
  grom: () => ({ shapes: [{ c: [0, 0, 21] }, { s: [0, 17, 0, 29, 3.9] }], entry: [0, 24], boss: [0, -9], face: PI, home: [0, 0], mood: MOODR.grom, build: buildGromArena }),
  granok: () => ({ shapes: [{ c: [0, 0, 20] }, { s: [0, 16, 0, 28, 3.4] }], entry: [0, 23], boss: [0, -9], face: PI, home: [0, 0], mood: MOODR.granok, build: buildGranokArena }),
  cryos: () => ({ shapes: [{ c: [0, 0, 21] }, { s: [0, 18, 0, 28.5, 2.8] }], entry: [0, 25], boss: [0, -8], face: PI, home: [0, 0], mood: MOODR.cryos, build: buildCryosArena }),
};
const MKBOSS = { grom: mkGrom, granok: mkGranok, cryos: mkCryos };
const envK = (root, k) => root.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (m.isMeshStandardMaterial) m.envMapIntensity = k; });

// ───────────────────────── 흐름: 입장 → 연출 → 카운트다운 → 전투 → 전멸 / 승리 → 귀환 ─────────────────────────
let savedMarkers = null;
const bRet = document.getElementById('bReturn'), bRetTxt = bRet ? bRet.textContent : '';
function enterRaid(id, opt = {}){
  const r = raidOf(id), m = META[id]; if (!r || !m) return false;
  if (X.tpBusy || (X.dialogOpen && !opt.force)) return false;
  if (S.lv < minLv(r)){ X.toast(`레이드 · ${r.name}`, `Lv.${minLv(r)} 이상부터 도전할 수 있어요 (지금 Lv.${S.lv})`); return false; }
  closeBoard(); hidePanels();
  let exit = opt.exit || (RS && RS.exit);
  if (!exit){ const en = entranceOf(id), l = en.l; exit = { x: en.x, z: en.z, face: l ? Math.atan2(en.x - l.c[0], en.z - l.c[1]) : PI }; }
  X.teleport(r.name, `${m.place} · 권장 Lv.${r.rec} · ${r.party}인 파티`, () => setupRaid(id, exit, !!opt.retry));
  return true;
}
function setupRaid(id, exit, retry){
  teardown(); X.revive(); if (X.closeMap) X.closeMap(); X.cleanupBattle(); X.clearSkillFx();
  const r = raidOf(id), m = META[id], def = DEFS[id]();
  RS = { id, r, m, def, exit, retry, phase: 'enter', t: 0, blv: r.lv + m.blv, dmgMul: 1, enr: false, res: 1, resK: 0, home: def.home, rad: def.shapes[0].c[2], face: def.face, botHpK: 1, revives: 0, hudDirty: true, hudT: 0, frT: 0, deadT: 0, cam: { pos: new V3(), look: new V3() } };
  X.deathHandled = true;
  RG = new THREE.Group(); RG.name = 'raid'; FXG = new THREE.Group(); RG.add(FXG);
  X.enterInstance({ shapes: def.shapes, entry: def.entry, boss: def.boss, face: def.face, mood: def.mood, build(grp, ctx){ RS.ctx = ctx; RS.grp = grp; def.build(grp, ctx); envK(grp, def.mood.env); } });
  G.sunFollow = true;   // 해가 플레이어를 따라가요 (그림자) — agora.html 의 타이틀 카메라가 끼어들지 않게도 해요
  if (id === 'grom'){ const W = GROM_MATS().water; W.color.set(0x1c4a40); W.emissive.set(0x000000); }
  X.SW.add(RG);
  // 보스
  const cfg = { name: r.name, title: 'RAID BOSS', icon: m.icon, mk: () => MKBOSS[id](), hp: m.hp, dmg: m.dmg, spd: m.spd, rad: m.rad, top: m.top, exp: m.exp, scale: 1, atks: [], line: m.line };
  const e = X.spawnMon('raid_' + id, def.boss[0], def.boss[1], false, { cfg, boss: true, lv: RS.blv, name: r.name, ai: bossAI, data: { enraged: true, raidBoss: true } });
  e.spdMul = 1; e.under = true; e.g.rotation.y = 0; envK(e.g, def.mood.env);
  for (const k of ['stun', 'frz']) Object.defineProperty(e, k, { get: () => 0, set(){}, configurable: true });
  e.B = { t: 0, bp: 1, cds: {}, cd: 2.2, prefT: 4, pref: 'tank', focus: ME, act: null, trans: null, pin: null, moving: false };
  RS.boss = e;
  // 파티
  UNITS.length = 1; BOTS.length = 0;
  partyFor(id).forEach((d, i) => { const u = makeBot(d, i), fx = Math.sin(def.face), fz = Math.cos(def.face), o = [[-2.2, -0.6], [2.2, -0.6], [-3.6, -2.2], [3.6, -2.2]][i]; u.pos.set(def.entry[0] + fz * o[0] + fx * o[1], 0.04, def.entry[1] - fx * o[0] + fz * o[1]); u.ry = def.face; u.ph0 = R() * 6; BOTS.push(u); UNITS.push(u); });
  buildFrames();
  document.body.classList.add('raid'); if (bRet) bRet.textContent = '⟲ 레이드 나가기';
  savedMarkers = G.mapMarkers; G.mapMarkers = [];
  const bar = document.querySelector('#boss .bar'); if (bar && !bar.querySelector('.rdtick')){ for (const k of [70, 35]){ const t = document.createElement('em'); t.className = 'rdtick'; t.style.left = k + '%'; bar.appendChild(t); } }
}
function teardown(){
  if (RG){ X.SW.remove(RG); RG = null; FXG = null; }
  for (const u of BOTS){ u.tag.remove(); u.bub.remove(); } BOTS.length = 0; UNITS.length = 1;
  for (const h of HZ) X.rmTele(h); HZ.length = 0; RINGS.length = 0; ARCS.length = 0; RUBBLE.length = 0; SPIKES.length = 0; FALLERS.length = 0; HRINGS.length = 0; TM.length = 0; TRAILS.length = 0; SHOTS.length = 0;
  document.body.classList.remove('raid', 'rfight'); if (RS && RS.cine) document.body.classList.remove('cine'); if (RS && G.camOverride === RS.cam) G.camOverride = null;
  if (bRet && bRet.textContent.includes('레이드')) bRet.textContent = bRetTxt;
  partyEl.innerHTML = ''; frameEls = []; alertEl.classList.remove('on'); tipEl.classList.remove('on'); veilEl.className = ''; hidePanels();
  document.querySelectorAll('#boss .rdtick').forEach(t => t.remove());
  if (savedMarkers){ G.mapMarkers = savedMarkers; savedMarkers = null; }
  X.deathHandled = false; RS = null;
}
function hidePanels(){ wipeEl.classList.remove('on'); winEl.classList.remove('on'); }
function startIntro(){
  RS.phase = 'intro'; RS.it = 0; G.lock = true; RS.cine = true; document.body.classList.add('cine'); G.camOverride = RS.cam;
  RS.cam.pos.set(RS.def.entry[0], 5, RS.def.entry[1] + 4); RS.cam.look.set(RS.def.boss[0], 3, RS.def.boss[1]);
  tip('<b>Space</b> 연출 건너뛰기', 3);
}
function skipIntro(){
  if (!RS || RS.phase !== 'intro') return; const e = RS.boss, B = e.B;
  B.pin = null; e.pos.set(RS.def.boss[0], 0, RS.def.boss[1]); e.g.rotation.y = 0; e.an = { k: 'idle', t: 0 }; e.eyeGlow = 0.3; e.coreK = 1; e.st2 = null;
  if (!B.bannered) X.banner('RAID BOSS', RS.r.name, RAIDS.find(o => o.id === RS.id).en.toUpperCase(), true, 2.4);
  startCount();
}
function startCount(){
  RS.phase = 'count'; RS.ct = 0; RS.cn = 0; G.camOverride = null; if (RS.cine){ document.body.classList.remove('cine'); RS.cine = false; } G.lock = true;
  X.player.pos.set(RS.def.entry[0], 0.04, RS.def.entry[1] - 3); X.fig.root.rotation.y = RS.face; G.setCam(RS.face + PI, 0.3, 9);
  X.bossBar(RS.boss); RS.hudDirty = true;
}
function beginFight(){
  RS.phase = 'fight'; RS.t = 0; G.lock = false; RS.boss.under = false; RS.lastHp = X.hp; document.body.classList.add('rfight');
  countPop('전투 시작!', true); X.sfx('roar'); tip(`💡 ${RS.m.tips[0]}`, 6);
  for (const u of BOTS) if (R() < 0.7) after(rr(0.2, 1.4), () => botSay(u, 'start', true));
}
function wipe(){
  if (!RS || RS.phase !== 'fight') return; RS.phase = 'wipe'; clearHz(true); for (const w of RINGS) FXG && FXG.remove(w.g); RINGS.length = 0;
  const e = RS.boss, pct = e ? Math.max(1, Math.round(e.hp / e.max * 100)) : 0;
  X.sfx('die'); document.body.classList.remove('rfight');
  wipeEl.innerHTML = `<div class="a">PARTY WIPED</div><div class="b">전 멸</div><div class="c">${RS.r.name} 남은 체력 <b>${pct}%</b> · 전투 시간 <b>${fmtT(RS.t)}</b>${RS.enr ? ' · <b style="color:#ff8a8a">광폭화</b>' : ''}<br>💡 ${pick(RS.m.tips)}</div>
    <div class="bt"><button class="pri" data-a="retry">⚔ 다시 도전</button><button data-a="leave">입구로 나가기</button></div>`;
  setTimeout(() => wipeEl.classList.add('on'), 1200);
  wipeEl.querySelectorAll('button').forEach(b => b.onclick = () => { X.sfx('ui'); hidePanels(); if (b.dataset.a === 'retry'){ X.revive(); enterRaid(RS.id, { retry: true, force: true }); } else exitRaid(); });
}
function bossDown(e){
  if (!RS || RS.phase !== 'fight') return;
  RS.phase = 'victory'; RS.vt = 0; RS.vgt = 0; RS.time = RS.t; const B = e.B; B.dying = true; B.act = null; B.trans = null; e.under = true; e.tongueL = 0.01;
  clearHz(false); for (const w of RINGS) FXG.remove(w.g); RINGS.length = 0; if (B.shield){ e.g.remove(B.shield.dome); for (const bm of B.shield.beams) FXG.remove(bm); B.shield = null; }
  for (const o of X.ENEMIES.slice()) if (o !== e && live(o)) X.killEnemy(o, true);
  G.hitStop = 0.85; flash(); X.sfx('crit'); X.sfx('boom'); G.shake = 1.6; document.body.classList.remove('rfight');
  RS.cine = true; document.body.classList.add('cine'); G.lock = true; RS.va = e.g.rotation.y + 0.9; G.camOverride = RS.cam; X.bossBar(null);
  const c = clearOf(RS.id) || { best: 0, count: 0 }, first = !c.count, best = !c.best || RS.time < c.best;
  S.raid.clears[RS.id] = { best: best ? Math.round(RS.time * 10) / 10 : c.best, count: (c.count || 0) + 1, first: c.first || Date.now() }; X.save();
  RS.first = first; RS.newBest = best && !first; RS.chestPending = true;
  BUS.emit('raidClear', { id: RS.id, time: RS.time });
  PENDING.push([`<b style="color:#ffd36a">⚔ 레이드 클리어</b> — ${RS.r.name} ${first ? '<b>첫 클리어!</b>' : RS.newBest ? '<b>최고 기록 경신!</b>' : ''} (${fmtT(RS.time)})`, '', 'raid']);
  for (const u of BOTS) PENDING.push([pick(u.def.say.win), u.name, 'party']);
}
function toLoot(){
  RS.phase = 'loot'; G.camOverride = null; if (RS.cine){ document.body.classList.remove('cine'); RS.cine = false; } G.lock = false;
  for (const u of BOTS){ if (u.down) reviveBot(u); after(rr(0.3, 1.6), () => botSay(u, 'win', true)); }
  const e = RS.boss, cx = e ? (e.pos.x * 0.6 + ME.pos.x * 0.4) : 0, cz = e ? (e.pos.z * 0.6 + ME.pos.z * 0.4) : 0, p = inArena(cx, cz, 3);
  spawnChest(p.x, p.z); tip('보상 상자가 떨어졌다! 다가가서 <b>E</b>', 5);
}
const CHEST_M = () => mat('chestM', () => ({ wood: std({ map: G.T.wood, color: 0x8a4a2a, roughness: 0.7 }), gold: X.M.gold, gem: basic(0xff5a8a) }));
function spawnChest(x, z){
  const M2 = CHEST_M(), g = new THREE.Group(); g.position.set(x, 16, z); RG.add(g);
  mesh(new THREE.BoxGeometry(1.7, 0.95, 1.15), M2.wood, g, 0, 0.48, 0); for (const sx of [-0.62, 0.62]) mesh(new THREE.BoxGeometry(0.14, 0.98, 1.2), M2.gold, g, sx, 0.48, 0);
  const lid = new THREE.Group(); lid.position.set(0, 0.95, -0.57); g.add(lid);
  mesh(new THREE.CylinderGeometry(0.57, 0.57, 1.7, 16, 1, false, 0, PI).rotateZ(HPI), M2.wood, lid, 0, 0, 0.57); for (const sx of [-0.62, 0.62]) mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.14, 16, 1, false, 0, PI).rotateZ(HPI), M2.gold, lid, sx, 0, 0.57);
  mesh(new THREE.BoxGeometry(0.3, 0.36, 0.1), M2.gold, g, 0, 0.82, 0.6); mesh(new THREE.OctahedronGeometry(0.1, 0), M2.gem, g, 0, 0.84, 0.67, false);
  const gl = X.glowSprite(0xffd36a, 4, 0.7); gl.position.y = 1.0; g.add(gl);
  const sh = shaft(RG, x, z, 0, 30, 1.2, 1.6, 0xffe08a, 0.0);
  RS.chest = { g, lid, gl, sh, x, z, t: 0, landed: false, open: false };
}
function updChest(dt){
  const c = RS && RS.chest; if (!c) return; c.t += dt;
  if (!c.landed){ const k = Math.min(1, c.t / 0.75); c.g.position.y = 16 * (1 - k * k); c.g.rotation.y += dt * 4; if (k >= 1){ c.landed = true; c.g.position.y = 0; X.shockwave(c.x, 0.1, c.z, 4, 0xffd36a, 0.5); X.burst(new V3(c.x, 0.6, c.z), 0xffd36a, 40, 5, 0.25, 0.8, -4, 3); X.sfx('stomp'); X.sfx('shard');
    c.it = { x: c.x, z: c.z, r: 2.9, title: '보상 상자 열기', action: openChest }; RS.ctx.SINT.push(c.it); } }
  c.sh.material.opacity = c.open ? Math.max(0, c.sh.material.opacity - dt * 0.3) : Math.min(0.22, c.t * 0.2); c.gl.material.opacity = 0.55 + Math.sin(G.time * 4) * 0.2;
  if (c.open){ c.lid.rotation.x = damp(c.lid.rotation.x, -1.9, 8, dt); if (R() < dt * 30) X.emit(c.x + rr(-0.6, 0.6), 1.0, c.z + rr(-0.4, 0.4), rr(-0.6, 0.6), rr(2, 4), rr(-0.6, 0.6), R() < 0.5 ? 0xffd36a : 0xffffff, 0.16, 1.0, { grav: 3 }); }
  else if (c.landed && R() < dt * 6) X.emit(c.x + rr(-0.8, 0.8), rr(0.3, 1.2), c.z + rr(-0.6, 0.6), 0, 0.6, 0, 0xffe08a, 0.12, 1.0);
}
function openChest(){
  const c = RS && RS.chest; if (!c || c.open) return; c.open = true; const i = RS.ctx.SINT.indexOf(c.it); if (i >= 0) RS.ctx.SINT.splice(i, 1);
  X.sfx('level'); X.sfx('shard'); flash(); X.burst(new V3(c.x, 1.2, c.z), 0xffd36a, 70, 6, 0.3, 1.2, -3, 4); G.shake = 0.6;
  setTimeout(() => { if (RS) showWin(grantRewards()); }, 700);
}
const addGold = n => { n = Math.round(n); if (!n) return; if (F.gold) F.gold(n); else { S.gold = (S.gold || 0) + n; X.save(); X.refreshHud(); } };
function grantRewards(){
  if (!RS || !RS.chestPending) return []; RS.chestPending = false;
  const id = RS.id, m = META[id], r = RS.r, out = [], g0 = S.gold || 0, rpg = F.modules && F.modules.rpg;
  let loot = null; try { loot = F.giveLoot ? F.giveLoot('raid_' + id) : null; } catch (err){ console.warn('[raid] loot', err); }
  if (loot && loot.length) for (const it of loot){
    if (it.u != null || it.s){ const RR = rpg && rpg.RAR ? rpg.RAR[it.r] : null; out.push({ i: it.s === 'wpn' ? '⚔️' : it.s === 'arm' ? '🛡️' : '💍', n: it.n, s: `${RR ? RR.n : '장비'} · 아이템 Lv.${it.il}`, c: RR ? RR.c : '#fff3d6' }); }
    else { const d = (F.ITEMS || (rpg && rpg.ITEMS) || {})[it.id] || {}; out.push({ i: d.icon || '📦', n: `${d.n || it.id} ×${it.n}`, s: '재료', c: d.c || '#e8e1cf' }); } }
  if (!F.giveLoot) addGold(300 + r.lv * 60);
  if (RS.first){
    addGold(m.firstGold); const xp = Math.round(X.need(S.lv) * m.firstExp); X.gainExp(xp);
    const t = m.title; let gotT = false; try { if (F.title && F.title.grant) gotT = F.title.grant(t.id, { n: t.n, d: t.d, b: t.b }) !== false; } catch (err){ console.warn(err); }
    if (gotT) out.unshift({ i: '🏅', n: `칭호 「${t.n}」`, s: '첫 클리어 · 가방(I) → 칭호 탭에서 달기', first: true, c: '#ffd36a' });
    if (grantCos(id)) out.unshift({ i: m.cos.icon, n: m.cos.n, s: '첫 클리어 의상 · 의상실(B)에서 착용', first: true, c: '#c07aff' });
    out.unshift({ i: '✨', n: `+${X.fmt(xp)} EXP`, s: '첫 클리어 보너스', first: true, c: '#d6b8ff' });
  } else addGold(Math.round(140 + r.lv * 22));
  const dg = (S.gold || 0) - g0; if (dg > 0) out.unshift({ i: '🪙', n: `+${X.fmt(dg)} 골드`, s: RS.first ? '전리품 + 첫 클리어 보너스' : '전리품', c: '#ffd36a' });
  X.save(); X.refreshHud(); return out;
}
function showWin(out){
  if (!RS) return; const c = clearOf(RS.id) || {};
  winEl.innerHTML = `<div class="a">RAID CLEAR</div><div class="b">${RS.r.name} 격파</div>
    <div class="c">클리어 시간 <b>${fmtT(RS.time)}</b>${RS.newBest ? ' <b style="color:#8aff8a">최고 기록!</b>' : ''} · 최고 기록 <b>${fmtT(c.best || RS.time)}</b> · 클리어 <b>${c.count || 1}</b>회${RS.revives ? ` · 파티원 부활 <b>${RS.revives}</b>회` : ''}</div>
    <div class="loot">${out.map((o, i) => `<div class="it${o.first ? ' first' : ''}" style="--c:${o.c || '#fff3d6'};animation-delay:${0.15 + i * 0.12}s"><span class="i">${o.i}</span> <span class="n">${o.n}</span><div class="s">${o.s}</div></div>`).join('')}</div>
    <div class="bt"><button class="pri" data-a="leave">입구로 돌아가기</button><button data-a="again">⚔ 한 번 더</button></div>`;
  winEl.classList.add('on'); X.sfx('pick');
  winEl.querySelectorAll('button').forEach(b => b.onclick = () => { X.sfx('ui'); hidePanels(); if (b.dataset.a === 'again') enterRaid(RS.id, { retry: true, force: true }); else exitRaid(); });
}
function exitRaid(){
  if (!RS || X.tpBusy) return; if (RS.chestPending && RS.phase !== 'victory') grantRewards();
  hidePanels(); const ex = RS.exit; X.revive();
  if (F.unlocked && F.unlocked()) F.enter({ x: ex.x, z: ex.z, face: ex.face }); else X.leaveToPlaza();
}
async function askLeave(){
  if (!RS || X.dialogOpen || X.tpBusy) return;
  if (RS.phase === 'loot' || RS.phase === 'wipe'){ exitRaid(); return; }
  X.NAMES.raidsys = '레이드';
  const k = await X.say([['raidsys', RS.phase === 'fight' ? '레이드를 포기하고 입구로 나갈까요? (보상 없음)' : '입구로 나갈까요?', ['나간다', '계속한다']]]);
  if (k === 0) exitRaid();
}
// 귀환 버튼: 레이드 중에는 「레이드 나가기」로 바꿔요
document.addEventListener('click', ev => { if (RS && X.mode === 'raid' && ev.target && ev.target.closest && ev.target.closest('#bReturn')){ ev.stopPropagation(); ev.preventDefault(); askLeave(); } }, true);
// 필드로 돌아온 뒤 채팅 소식
const PENDING = [];

// ───────────────────────── 첫 클리어 보상: 칭호 · 의상 ─────────────────────────
const _w = new V3();
const COSDEF = {
  gromcrown: { id: 'gromcrown', n: '늪왕의 이끼 왕관', icon: '👑', r: 2, p: 0, mk(){ const g = new THREE.Group(), cr = X.MK.addCrown(g, 0.33, 0.165, 0.14); cr.rotation.z = 0.12;
    const mossM = std({ color: 0x4a7a2a, roughness: 0.9, flatShading: true }); for (let i = 0; i < 7; i++){ const a = i / 7 * TAU; mesh(new THREE.IcosahedronGeometry(0.045, 0), mossM, cr, Math.cos(a) * 0.17, 0.0, Math.sin(a) * 0.17, false); }
    const gem = mesh(new THREE.OctahedronGeometry(0.05, 0), basic(0x7aff4a), cr, 0, 0.05, 0.175, false); const gl = X.glowSprite(0x8aff4a, 0.5, 0.6); gl.position.copy(gem.position); cr.add(gl);
    return { obj: g, upd(dt, t){ gl.material.opacity = 0.45 + Math.sin(t * 3) * 0.15; if (R() < dt * 2.2){ gem.getWorldPosition(_w); X.emit(_w.x, _w.y - 0.05, _w.z, 0, -0.4, 0, 0x8aff4a, 0.07, 0.9, { grav: 2.5 }); } } }; } },
  granokshards: { id: 'granokshards', n: '그라녹의 수정 파편', icon: '🔶', r: 2, p: 0, mk(){ const g = new THREE.Group(), sh = [], A = std({ color: 0xffb060, emissive: 0xff7a1a, emissiveIntensity: 1.3, roughness: 0.1, flatShading: true }), C = std({ color: 0x9af4ff, emissive: 0x2ac0ff, emissiveIntensity: 1.2, roughness: 0.1, flatShading: true });
    for (let i = 0; i < 5; i++){ const q = new THREE.OctahedronGeometry(0.07, 0); q.scale(1, 2.4, 1); sh.push(mesh(q, i % 2 ? C : A, g, 0, 0, 0, false)); }
    return { obj: g, upd(dt, t, p){ sh.forEach((c, i) => { const a = t * 0.9 + i / sh.length * TAU; c.position.set(Math.cos(a) * 0.82, 0.95 + Math.sin(t * 1.7 + i) * 0.35, Math.sin(a) * 0.82); c.rotation.y += dt * 2; });
      if (R() < dt * 4){ const c = pick(sh); c.getWorldPosition(_w); X.emit(_w.x, _w.y, _w.z, 0, 0.3, 0, R() < 0.5 ? 0xffb060 : 0x8af0ff, 0.09, 0.6); } } }; } },
  frostwings: { id: 'frostwings', n: '서리 거룡의 날개', icon: '❄️', r: 3, p: 0, mk(){ const g = new THREE.Group(); g.position.set(0, 0.48, -0.17); g.rotation.x = 0.12;
    const M3 = std({ color: 0xe8fbff, emissive: 0x5ad0ff, emissiveIntensity: 0.9, roughness: 0.05, flatShading: true, transparent: true, opacity: 0.88 }), piv = [];
    for (const s of [1, -1]){ const p = new THREE.Group(); p.position.x = s * 0.07; p.scale.x = s; g.add(p); piv.push(p);
      for (let i = 0; i < 5; i++){ const q = new THREE.OctahedronGeometry(1, 0); q.scale(0.05, 0.42 - i * 0.04, 0.02); const c = mesh(q, M3, p, 0.2 + i * 0.1, 0.12 - i * 0.07, 0, false); c.rotation.z = -0.5 - i * 0.28; c.position.x += Math.cos(-0.5 - i * 0.28 + HPI) * 0.25; } }
    return { obj: g, upd(dt, t, mv, air){ const f = air ? Math.sin(t * 9) * 0.6 : Math.sin(t * 1.8) * 0.12 + mv * 0.2; piv[0].rotation.y = 0.4 + f; piv[1].rotation.y = -(0.4 + f); if (R() < dt * 5){ g.getWorldPosition(_w); X.emit(_w.x + rr(-0.6, 0.6), _w.y + rr(-0.2, 0.4), _w.z + rr(-0.3, 0.1), 0, rr(-0.2, 0.1), 0, 0xdff8ff, 0.08, 1.2, { sway: 0.3 }); } } }; } },
};
function regCos(){
  if (!X.COS || !S.cos || !S.cos.own) return false; let any = false;
  for (const id in META){ const c = META[id].cos, L = X.COS[c.slot]; if (!L || !S.cos.own.includes(c.slot + ':' + c.id) || L.find(i => i.id === c.id)) continue; L.push(COSDEF[c.id]); any = true; }
  return any;
}
function grantCos(id){
  const c = META[id].cos; if (!X.COS || !S.cos) return false; S.cos.own = S.cos.own || []; const key = c.slot + ':' + c.id; if (S.cos.own.includes(key)) return false;
  S.cos.own.push(key); regCos(); X.save(); return true;
}
function regTitles(){
  if (!F.title || !F.title.list) return; const T = F.title.list(); let cur = false;
  for (const id in META){ const t = META[id].title; if (!T[t.id]){ T[t.id] = { n: t.n, d: t.d, b: t.b }; if (S.titles && S.titles.cur === t.id) cur = true; } }
  if (cur && F.modules && F.modules.rpg && F.modules.rpg.applyBonus) try { F.modules.rpg.applyBonus(); } catch (err){}
}
if (regCos() && S.cos && S.cos.eq) try { X.applyLook(S.cos.eq); } catch (err){ console.warn('[raid] look', err); }
regTitles();

// ───────────────────────── 레이드 게시판 (카드 3장 · 그림 머리) ─────────────────────────
function paintArt(c, id){
  const x = c.getContext('2d'), W = c.width, H = c.height, rnd = srand(id.length * 31 + 7), glowDot = (px, py, r, col) => { const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); };
  if (id === 'grom'){
    let g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#050f0c'); g.addColorStop(0.58, '#1f4a3a'); g.addColorStop(0.6, '#0c2018'); g.addColorStop(1, '#06100c'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    glowDot(W * 0.8, H * 0.24, 70, 'rgba(200,255,210,.55)'); x.fillStyle = '#e8ffe8'; x.beginPath(); x.arc(W * 0.8, H * 0.24, 13, 0, TAU); x.fill();
    x.fillStyle = '#0a1812'; const cx = W * 0.42, base = H * 0.6; for (let i = 0; i < 4; i++){ const w = 200 - i * 44, h = 22; x.fillRect(cx - w / 2, base - (i + 1) * h, w, h + 1); }
    x.beginPath(); x.ellipse(cx, base - 92, 34, 18, 0, 0, TAU); x.fill(); for (const s of [-1, 1]){ x.beginPath(); x.arc(cx + s * 16, base - 106, 9, 0, TAU); x.fill(); glowDot(cx + s * 16, base - 106, 16, 'rgba(255,220,80,.95)'); }
    x.fillStyle = 'rgba(255,220,90,.9)'; x.beginPath(); x.moveTo(cx - 10, base - 118); x.lineTo(cx, base - 132); x.lineTo(cx + 10, base - 118); x.fill();
    for (let i = 0; i < 9; i++){ const px = rnd() * W; x.fillStyle = '#081410'; x.fillRect(px, base - rr(30, 60), rr(6, 12), 70); }
    for (let k = 0; k < 4; k++){ const fy = H * (0.45 + k * 0.08); g = x.createLinearGradient(0, fy - 14, 0, fy + 14); g.addColorStop(0, 'rgba(160,220,190,0)'); g.addColorStop(0.5, `rgba(160,220,190,${0.12 + k * 0.04})`); g.addColorStop(1, 'rgba(160,220,190,0)'); x.fillStyle = g; x.fillRect(0, fy - 14, W, 28); }
    x.strokeStyle = 'rgba(170,255,200,.18)'; x.lineWidth = 1; for (let i = 0; i < 26; i++){ const py = base + 6 + rnd() * (H - base - 10), px = rnd() * W; x.beginPath(); x.moveTo(px, py); x.lineTo(px + rr(20, 60), py); x.stroke(); }
    x.fillStyle = '#123020'; for (let i = 0; i < 6; i++){ x.beginPath(); x.ellipse(rnd() * W, H * 0.82 + rnd() * H * 0.12, 18, 6, 0, 0.3, TAU - 0.3); x.fill(); }
    for (let i = 0; i < 26; i++) glowDot(rnd() * W, H * 0.3 + rnd() * H * 0.55, 5, 'rgba(190,255,120,.85)');
  } else if (id === 'granok'){
    let g = x.createRadialGradient(W * 0.5, H * 0.55, 10, W * 0.5, H * 0.55, W * 0.6); g.addColorStop(0, '#3a2214'); g.addColorStop(1, '#070403'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(120,90,60,.5)'; x.lineWidth = 3; for (const s of [-1, 1]){ x.beginPath(); x.moveTo(W / 2 + s * 30, H * 0.62); x.lineTo(W / 2 + s * 200, H); x.stroke(); } x.lineWidth = 2; for (let i = 0; i < 7; i++){ const t = i / 7, y = H * 0.62 + (H * 0.38) * t * t, w = 30 + 170 * t * t; x.beginPath(); x.moveTo(W / 2 - w, y); x.lineTo(W / 2 + w, y); x.stroke(); }
    const gx = W * 0.5, gy = H * 0.6; x.fillStyle = '#120c08'; x.beginPath(); x.ellipse(gx, gy - 70, 70, 52, 0, 0, TAU); x.fill(); for (const s of [-1, 1]){ x.beginPath(); x.ellipse(gx + s * 74, gy - 92, 34, 28, 0, 0, TAU); x.fill(); x.beginPath(); x.ellipse(gx + s * 96, gy - 40, 22, 46, s * 0.2, 0, TAU); x.fill(); x.beginPath(); x.ellipse(gx + s * 104, gy + 8, 30, 26, 0, 0, TAU); x.fill(); x.fillRect(gx + s * 40 - 18, gy - 30, 36, 40); }
    x.beginPath(); x.ellipse(gx, gy - 128, 24, 20, 0, 0, TAU); x.fill(); glowDot(gx, gy - 72, 46, 'rgba(255,150,50,.95)'); x.fillStyle = '#ffd08a'; x.beginPath(); x.moveTo(gx, gy - 86); x.lineTo(gx + 12, gy - 72); x.lineTo(gx, gy - 58); x.lineTo(gx - 12, gy - 72); x.fill();
    x.fillStyle = '#ffb050'; for (const s of [-1, 1]) x.fillRect(gx + s * 9 - 5, gy - 130, 10, 3);
    const crys = (px, py, s, col1, col2) => { for (let i = 0; i < 4; i++){ const a = -HPI + rr(-0.6, 0.6), h = s * rr(0.7, 1.5), w = s * 0.18; x.save(); x.translate(px + rr(-s * 0.3, s * 0.3), py); x.rotate(a + HPI); const gg = x.createLinearGradient(0, 0, 0, -h); gg.addColorStop(0, col2); gg.addColorStop(1, col1); x.fillStyle = gg; x.beginPath(); x.moveTo(-w, 0); x.lineTo(0, -h); x.lineTo(w, 0); x.fill(); x.restore(); } glowDot(px, py - s * 0.5, s * 1.2, col1.replace('1)', '.35)')); };
    crys(W * 0.1, H * 0.95, 60, 'rgba(255,190,110,1)', 'rgba(140,60,10,1)'); crys(W * 0.9, H * 0.92, 54, 'rgba(150,240,255,1)', 'rgba(20,90,140,1)'); crys(W * 0.24, H * 0.7, 30, 'rgba(150,240,255,1)', 'rgba(20,90,140,1)'); crys(W * 0.78, H * 0.68, 34, 'rgba(255,190,110,1)', 'rgba(140,60,10,1)');
    x.fillStyle = '#050302'; x.beginPath(); x.moveTo(0, 0); x.lineTo(W, 0); x.lineTo(W, H * 0.3); for (let i = 20; i >= 0; i--){ x.lineTo(W * i / 20, H * (0.12 + rnd() * 0.16)); } x.fill();
    for (let i = 0; i < 40; i++) glowDot(rnd() * W, rnd() * H, 3, 'rgba(255,210,150,.6)');
  } else {
    let g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#030616'); g.addColorStop(0.7, '#17305a'); g.addColorStop(1, '#2a4a7a'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++){ x.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`; x.fillRect(rnd() * W, rnd() * H * 0.6, 1.4, 1.4); }
    x.save(); x.globalCompositeOperation = 'lighter'; for (let k = 0; k < 3; k++){ x.strokeStyle = ['rgba(90,255,170,.35)', 'rgba(100,220,255,.3)', 'rgba(170,120,255,.25)'][k]; x.lineWidth = 16 - k * 3; x.shadowColor = x.strokeStyle; x.shadowBlur = 24; x.beginPath(); for (let i = 0; i <= 40; i++){ const px = i / 40 * W, py = H * (0.18 + k * 0.08) + Math.sin(i * 0.4 + k * 2) * 16 + Math.sin(i * 0.13) * 10; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); } x.restore();
    for (let i = 0; i < 7; i++){ const px = i / 6 * W + rr(-30, 30), h = rr(50, 90); g = x.createLinearGradient(0, H * 0.75 - h, 0, H * 0.75); g.addColorStop(0, '#e8f2ff'); g.addColorStop(1, '#4a6a9a'); x.fillStyle = g; x.beginPath(); x.moveTo(px - 60, H * 0.78); x.lineTo(px, H * 0.75 - h); x.lineTo(px + 60, H * 0.78); x.fill(); }
    x.fillStyle = '#0c1630'; x.beginPath(); x.ellipse(W * 0.5, H * 0.92, 150, 18, 0, 0, TAU); x.fill(); for (let i = 0; i < 5; i++){ x.fillRect(W * 0.5 - 120 + i * 60, H * 0.92 - 34, 9, 34); }
    const dx = W * 0.56, dy = H * 0.42; x.fillStyle = '#0a1430'; x.strokeStyle = 'rgba(150,230,255,.45)'; x.lineWidth = 1.5;
    for (const s of [-1, 1]){ x.beginPath(); x.moveTo(dx, dy - 4); x.quadraticCurveTo(dx + s * 60, dy - 70, dx + s * 130, dy - 60); x.quadraticCurveTo(dx + s * 105, dy - 30, dx + s * 112, dy - 6); x.quadraticCurveTo(dx + s * 85, dy - 18, dx + s * 80, dy + 6); x.quadraticCurveTo(dx + s * 55, dy - 6, dx + s * 40, dy + 12); x.closePath(); x.fill(); x.stroke(); }
    x.beginPath(); x.ellipse(dx, dy, 34, 12, -0.15, 0, TAU); x.fill(); x.lineCap = 'round'; x.strokeStyle = '#0a1430'; x.lineWidth = 10; x.beginPath(); x.moveTo(dx + 26, dy - 4); x.quadraticCurveTo(dx + 46, dy - 24, dx + 62, dy - 30); x.stroke(); x.lineWidth = 6; x.beginPath(); x.moveTo(dx - 28, dy + 4); x.quadraticCurveTo(dx - 70, dy + 22, dx - 110, dy + 14); x.stroke();
    x.fillStyle = '#0a1430'; x.beginPath(); x.moveTo(dx + 58, dy - 38); x.lineTo(dx + 82, dy - 30); x.lineTo(dx + 60, dy - 24); x.fill(); glowDot(dx + 66, dy - 32, 8, 'rgba(140,240,255,1)');
    for (let i = 0; i < 70; i++){ x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.arc(rnd() * W, rnd() * H, rnd() * 1.6 + 0.4, 0, TAU); x.fill(); }
  }
  const v = x.createLinearGradient(0, H * 0.55, 0, H); v.addColorStop(0, 'rgba(8,10,18,0)'); v.addColorStop(1, 'rgba(8,10,18,.85)'); x.fillStyle = v; x.fillRect(0, 0, W, H);
}
let boardOpt = {};
function openRaidBoard(opt = {}){
  if (X.mode === 'raid'){ X.toast('레이드', '레이드 중에는 게시판을 볼 수 없어요'); return; }
  boardOpt = opt || {}; renderBoard(); board.classList.add('on'); X.sfx('ui');
  let ch = false; for (const r of RAIDS) if (S.lv >= minLv(r) && !S.raid.seen.includes(r.id)){ S.raid.seen.push(r.id); ch = true; } if (ch) X.save(); refreshDot();
}
function closeBoard(){ board.classList.remove('on'); }
function renderBoard(){
  const can = !!boardOpt.enter;
  board.innerHTML = `<div class="hd"><span>RAID</span><b>레이드 모집 게시판</b><small>${can ? '레이드 대장 카엘이 파티를 꾸려 바로 보내 줘요 — 클리어하면 그 레이드 입구로 돌아와요' : '입장: 새싹 마을의 레이드 대장 카엘 · 또는 각 레이드 입구'}</small><button class="x">✕</button></div>
    <div class="cards">${RAIDS.map(r => card(r, can)).join('')}</div>
    <div class="ft">보스는 체력 70% · 35%에서 패턴이 바뀌고, 시간이 다 되면 광폭화해요 · 붉은 표시는 공격 예고 — 구르기(K) · 점프(Space)로 피하세요</div>`;
  board.querySelectorAll('canvas').forEach(c => paintArt(c, c.dataset.id));
  board.querySelector('.x').onclick = () => { X.sfx('ui'); closeBoard(); };
  board.querySelectorAll('.go').forEach(b => b.onclick = () => { if (b.disabled) return; X.sfx('ui'); enterRaid(b.dataset.id); });
}
function card(r, can){
  const m = META[r.id], c = clearOf(r.id), lock = S.lv < minLv(r), first = !c, l = byId('landmarks', r.entrance), reg = l && F.regionById ? F.regionById(l.region) : null;
  const lvCls = S.lv >= r.rec ? 'ok' : lock ? 'low' : '', team = r.party > 3 ? '탱커 · 힐러 · 딜러' : '탱커 · 힐러';
  return `<div class="rc${lock ? ' lock' : ''}${boardOpt.focus === r.id ? ' focus' : ''}" style="--c:${m.col}">
    <div class="art"><canvas width="480" height="200" data-id="${r.id}"></canvas><div class="lvb">Lv.${r.lv}+</div>${c ? `<div class="clr">✔ 클리어 ${c.count}회</div>` : ''}</div>
    <div class="nm">${m.icon} ${r.name}</div><div class="en">${r.en.toUpperCase()}</div><div class="ds">${r.desc}</div>
    <div class="chips"><i class="${lvCls}">권장 Lv.${r.rec}</i><i>👥 ${r.party}인 (${team})</i><i>📍 ${l ? l.name : ''}${reg ? ' · ' + reg.name : ''}</i><i>⏱ ${c && c.best ? '최고 ' + fmtT(c.best) : '기록 없음'}</i></div>
    <div class="rec">${first ? '<b>첫 클리어 보상</b>' : '<span class="done">✔ 첫 클리어 보상 받음</span>'}<br>${first ? '' : '<s>'}🏅 칭호 「${m.title.n}」 · ${m.cos.icon} ${m.cos.n} · 대량 EXP · 🪙 ${X.fmt(m.firstGold)}${first ? '' : '</s>'}<br>🎁 매번: 희귀 이상 장비 3개 · 강화석 · 룬 수정 · 골드</div>
    <button class="go" data-id="${r.id}" ${lock || !can ? 'disabled' : ''}>${lock ? `🔒 Lv.${minLv(r)} 이상` : can ? '⚔ 입장' : '카엘 · 입구에서 입장'}</button></div>`;
}
const raidInfo = id => { const r = raidOf(id), m = META[id]; return r && m ? { ...r, place: m.place, enrage: m.enrage, clear: clearOf(id), locked: S.lv < minLv(r), minLv: minLv(r) } : null; };

// ── 레이드 대장 카엘 (새싹 마을) ──
F.roleTalkers = F.roleTalkers || {};
F.roleTalkers.raid = async n => {
  X.NAMES[n.id] = n.name;
  if (!S.raid.met){ S.raid.met = true; X.save();
    await X.say([[n.id, '오, 새 얼굴이군! 난 레이드 대장 카엘. 대륙 곳곳에 잠든 괴물들을 사냥할 파티를 꾸리고 있지.'], [n.id, '혼자선 무리야. 믿을 만한 녀석들을 붙여 주지 — 방패의 레온, 치유사 세라, 궁수 아리아, 그림자 카이.'], [n.id, '입구까지 걸어가도 되고, 여기서 바로 보내 줄 수도 있어. 대신 각오는 단단히 하라고!']]); }
  const cleared = RAIDS.filter(r => clearOf(r.id)).length, first = RAIDS[0];
  const line = cleared === RAIDS.length ? '전설의 파티가 돌아왔군! 녀석들이 또 깨어났다는 소식이야. 한 판 더?' : cleared ? `레이드 ${cleared}개를 정복했다니, 소문이 자자하던데? 다음 목표를 골라 봐.` : S.lv < minLv(first) ? `아직은 좀 이르군. Lv.${minLv(first)}이 되면 늪의 그롬 정도는 상대할 만할 거야.` : '어느 놈부터 잡으러 갈까? 게시판을 보라고.';
  const k = await X.say([[n.id, line, ['레이드 게시판 보기', '레이드가 뭐예요?', '다음에요']]]);
  if (k === 0) openRaidBoard({ enter: true });
  else if (k === 1){ const k2 = await X.say([[n.id, '레이드는 강력한 보스와 싸우는 전용 전장이야. 보스는 체력 70%, 35%에서 패턴이 바뀌지.'], [n.id, '바닥의 붉은 표시는 공격 예고야. 굴러서(K) 피하고, 퍼져 나오는 고리는 점프(Space)로 넘어.'], [n.id, '파티원이 쓰러지면 곁에 서서 일으켜 줘. 너무 오래 끌면 보스가 광폭화하니 조심하고!'], [n.id, '이기면 희귀 이상 장비가 든 보상 상자, 첫 클리어 땐 특별한 칭호와 의상까지 준다고.', ['게시판 보기', '알겠어요']]]); if (k2 === 0) openRaidBoard({ enter: true }); }
};
// ── 레이드 입구 (랜드마크 앞) ──
const FLAVOR = { grom: '반쯤 잠긴 신전 안에서 거대한 숨소리와 개구리 울음이 울린다', granok: '갱도 깊은 곳에서 쿵… 쿵… 심장 같은 울림이 전해진다', cryos: '사슬이 끊어진 제단 위로 살을 에는 바람이 휘몰아친다' };
async function entranceTalk(id){
  if (X.dialogOpen || X.tpBusy) return; const r = raidOf(id), c = clearOf(id); X.NAMES.raidgate = `⚔ ${r.name}`;
  if (S.lv < minLv(r)){ await X.say([['raidgate', `${FLAVOR[id]}… 아직은 감당할 수 없는 기운이다. (Lv.${minLv(r)} 이상 · 지금 Lv.${S.lv})`]]); return; }
  const k = await X.say([['raidgate', `${FLAVOR[id]}. 레이드 「${r.name}」 — 권장 Lv.${r.rec} · ${r.party}인 파티${c ? ` · 최고 기록 ${fmtT(c.best)}` : ' · 첫 도전'}`, ['⚔ 입장한다', '레이드 정보', '돌아간다']]]);
  if (k === 0) enterRaid(id, { force: true }); else if (k === 1) openRaidBoard({ enter: true, focus: id });
}
const GATES = {};
function placeEntrances(){
  if (!F.addInteract) return;
  for (const r of RAIDS){ const p = entranceOf(r.id), old = GATES[r.id];
    if (old && Math.hypot(old.x - p.x, old.z - p.z) < 0.5) continue;
    if (old){ F.removeInteract(old.it); if (old.lb) old.lb.remove(); }
    const it = F.addInteract({ x: p.x, z: p.z, r: 4.8, title: `⚔ 레이드 입장 · ${r.name}`, action: () => entranceTalk(r.id) });
    const c = clearOf(r.id), lb = F.label ? F.label({ pos: new V3(p.x, (F.H ? F.H(p.x, p.z) : 0) + 4.8, p.z), text: `⚔ ${r.name}`, sub: `RAID · 권장 Lv.${r.rec}${c ? ' · ✔ 클리어' : ''}`, cls: 'place', max: 60 }) : null;
    GATES[r.id] = { x: p.x, z: p.z, it, lb };
  }
  if (!GATES.board && F.modules && F.modules.landmarks) GATES.board = { it: F.addInteract({ x: 46.4, z: 542.3, r: 2.4, title: '레이드 모집 게시판', action: () => openRaidBoard({ enter: true }) }) };
}
let menuBtn = null; try { if (F.menu) menuBtn = F.menu.add('⚔️', '레이드', () => openRaidBoard({}), ''); } catch (err){ console.warn('[raid] menu', err); }
function refreshDot(){ if (menuBtn) menuBtn.classList.toggle('dot', RAIDS.some(r => S.lv >= minLv(r) && !S.raid.seen.includes(r.id))); }
const skipEl = X.mk('button', 'rdskip', '건너뛰기 ▶▶');
{ const st = document.createElement('style'); st.textContent = `#rdskip { position:fixed; right:18px; bottom:calc(22px + env(safe-area-inset-bottom)); z-index:30; display:none; font:700 13px 'Gowun Batang'; letter-spacing:.1em; color:#f0e6cf; padding:8px 16px; border-radius:18px; background:rgba(10,14,24,.75); border:1px solid rgba(233,200,126,.5); cursor:pointer; } body.raid.rintro #rdskip { display:block; }`; document.head.appendChild(st); }
skipEl.onclick = e => { e.stopPropagation(); skipIntro(); };

// ───────────────────────── 입력 · 이벤트 ─────────────────────────
X.KEYH.push(code => {
  if (board.classList.contains('on') && code === 'Escape'){ closeBoard(); return true; }
  if (RS && RS.phase === 'intro' && (code === 'Space' || code === 'Escape' || code === 'Enter')){ skipIntro(); return true; }
  return false;
});
BUS.on('hit', d => { if (RS && d && d.e === RS.boss) guardBoss(d.e); });
BUS.on('mode', m => { if (RS && m !== 'raid') teardown(); });
BUS.on('enterField', () => { if (PENDING.length) setTimeout(() => { for (const [t, f, k] of PENDING.splice(0)) try { F.chat(t, f, k); } catch (err){} }, 1600); refreshDot();
  for (const r of RAIDS){ const g = GATES[r.id], c = clearOf(r.id); if (g && g.lb) g.lb.set(`⚔ ${r.name}`, `RAID · 권장 Lv.${r.rec}${c ? ' · ✔ 클리어' : ''}`); } });
BUS.on('levelUp', refreshDot);
BUS.on('fieldReady', () => { placeEntrances(); regTitles(); refreshDot(); });
placeEntrances(); refreshDot();

// ───────────────────────── 매 프레임 ─────────────────────────
const TOXC = new THREE.Color(0x3a7a1a), BASEC = new THREE.Color(0x1c4a40);
G.hooks.push((dt, rdt) => guard('update', () => update(dt, rdt)));
function update(dt, rdt){
  if (alertT > 0){ alertT -= rdt; if (alertT <= 0) alertEl.classList.remove('on'); }
  if (tipT > 0){ tipT -= rdt; if (tipT <= 0) tipEl.classList.remove('on'); }
  if (veilT > 0){ veilT -= rdt; if (veilT <= 0) veilEl.className = ''; }
  if (!RS) return;
  if (X.mode !== 'raid'){ if (!X.tpBusy) teardown(); return; }
  G.sunFollow = true;
  document.body.classList.toggle('rintro', RS.phase === 'intro');
  if (RS.phase === 'enter'){ if (X.tpBusy) return; if (RS.retry) startCount(); else startIntro(); }
  const e = RS.boss, B = e && e.B, K = BK[RS.id], fight = RS.phase === 'fight';
  // 패시브 회복 억제 (레이드는 전투 밖 회복이 느려요)
  if (fight && !X.dead){ const d = X.D(); if (RS.lastHp != null){ const delta = X.hp - RS.lastHp, base = (d.regen || 0) * dt; if (delta > base + 1e-4 && delta <= d.maxHp * 0.1 * dt + base + 0.05) X.hp = RS.lastHp + base + (delta - base) * 0.12; } }
  for (let i = TM.length - 1; i >= 0; i--){ const t = TM[i]; t.t -= dt; if (t.t <= 0){ TM.splice(i, 1); try { t.fn(); } catch (err){ console.error('[raid] timer', err); } } }
  // 보스: 고정 위치(비행 · 연출) · 보호막 · 페이즈 경계 · 모델 애니메이션
  if (e && X.ENEMIES.includes(e)){
    if (B.pin){ e.pos.set(B.pin.x, B.pin.y, B.pin.z); if (B.pin.ry != null) e.g.rotation.y = B.pin.ry; }
    if (B.shield) shieldUpd(e, dt);
    if (fight){ if (e.dot && e.hp - e.dot.dps * 0.6 <= e.max * 0.02) e.dot = null; guardBoss(e); }
    K.anim(e, dt);
  }
  if (RS.phase === 'intro'){ RS.it += rdt; if (K.intro(e, RS.it, dt, RS.cam)) startCount(); }
  else if (RS.phase === 'count'){ RS.ct += rdt; const n = Math.floor(RS.ct); if (n !== RS.cn && n <= 2){ RS.cn = n; countPop(String(3 - n)); X.sfx('clang'); } if (RS.ct >= 3) beginFight(); }
  else if (fight){
    RS.t += dt;
    if (!RS.enr && RS.t >= RS.m.enrage){ RS.enr = true; RS.dmgMul = 2.2; e.spdMul = (e.spdMul || 1) * 1.25; RS.enrT = 2; X.banner('ENRAGE', `${RS.r.name} 광폭화!`, '제한 시간 초과 — 모든 공격이 훨씬 강해진다', true, 3); X.sfx('roar'); G.shake = 1.2; const au = X.glowSprite(0xff2a3a, e.cfg.rad * 5, 0.45); au.position.y = 1; e.g.add(au); RS.aura = au; RS.hudDirty = true; }
    if (RS.enr && live(e)){ RS.aura.material.opacity = 0.35 + Math.sin(G.time * 5) * 0.15; RS.enrT -= dt; if (RS.enrT <= 0 && !B.trans){ RS.enrT = 3; const L = aliveUnits();
      if (RS.id === 'grom'){ toxicDrop(e); toxicDrop(e); } else if (RS.id === 'granok'){ for (const u of L.slice(0, 2)){ const p = inArena(u.pos.x + rr(-2, 2), u.pos.z + rr(-2, 2), 1.2); fallRock(p.x, p.z, { T: 1.4, dmg: e.dmg * 0.8 }); } } else for (const u of L) iceSpike(u.pos.x, u.pos.z, 1.0, e.dmg * 0.7); } }
    // 플레이어 쓰러짐 → 파티원 부활 (1회) 또는 전멸
    if (X.dead){ RS.deadT += dt;
      if (!RS.resBy || RS.resBy.down || !RS.resBy.cast){ RS.resBy = null; if (RS.res > 0 && RS.deadT > 0.8){ const cand = BOTS.filter(u => !u.down).sort((a, b) => (b.role === 'heal') - (a.role === 'heal'))[0]; if (cand){ cand.cast = { k: 'res', o: ME, t: 0, dur: 3.2 }; cand.atk = null; RS.resBy = cand; if (!RS.resSaid){ RS.resSaid = true; alertMsg(`${cand.name} — 부활의 룬!`, '파티원이 일으켜 줄 때까지 버티세요', '#ffe08a', 2.4); } } } }
      if ((RS.res <= 0 || !BOTS.some(u => !u.down)) && RS.deadT > 1.6) wipe();
    } else { RS.deadT = 0; RS.resBy = null; RS.resK = 0; RS.resSaid = false; }
  } else if (RS.phase === 'victory'){
    RS.vt += rdt; RS.vgt += dt;
    if (live(e)){ const a = RS.va + RS.vt * 0.32, d = e.cfg.top * 1.5 + 5; RS.cam.pos.set(e.pos.x + Math.sin(a) * d, e.cfg.top * 0.75 + 1.6, e.pos.z + Math.cos(a) * d); RS.cam.look.set(e.pos.x, e.cfg.top * 0.42, e.pos.z);
      if (K.death(e, RS.vgt, dt)){ e.B.pin = null; e.pos.y = 0; X.killEnemy(e); RS.killedAt = RS.vt; } }
    if (RS.vt > 0.7 && !RS.vb){ RS.vb = true; X.banner('RAID CLEAR', `${RS.r.name} 격파!`, `클리어 시간 ${fmtT(RS.time)}${RS.first ? ' · 첫 클리어!' : RS.newBest ? ' · 최고 기록!' : ''}`, false, 4.2); X.sfx('level'); }
    if (RS.killedAt != null && RS.vt > RS.killedAt + 1.4) toLoot();
  }
  if (!RS) return;
  // 그롬: 독물 · 크라이오스: 제단 붕괴
  if (RS.toxic){ const T2 = RS.toxic; T2.t += dt; const k = Math.min(1, T2.t / 2), W = GROM_MATS().water; W.color.lerpColors(T2.from, T2.k ? TOXC : BASEC, k); W.emissive.setRGB(0.06 * T2.k * k, 0.16 * T2.k * k, 0.02 * T2.k * k); if (k >= 1) RS.toxic = null; }
  if (RS.shrink){ const s = RS.shrink; s.t += dt; const k = Math.min(1, s.t / 3); RS.def.shapes[0].c[2] = s.from + (s.to - s.from) * ease(k); RS.rad = RS.def.shapes[0].c[2]; if (RS.def.shapes.length > 1) RS.def.shapes.length = 1;
    if (!s.ring){ s.ring = new THREE.Mesh(new THREE.RingGeometry(s.to + 0.15, 22.8, 96, 1).rotateX(-HPI), new THREE.MeshBasicMaterial({ color: 0x050a18, transparent: true, opacity: 0, depthWrite: false })); s.ring.position.y = 0.03; FXG.add(s.ring); s.edge = new THREE.Mesh(new THREE.RingGeometry(s.to - 0.08, s.to + 0.22, 96).rotateX(-HPI), addM(0x9ae8ff, 0)); s.edge.position.y = 0.045; FXG.add(s.edge); }
    s.ring.material.opacity = 0.82 * k; s.edge.material.opacity = 0.9 * k;
    if (k < 1 && R() < dt * 14){ const a = R() * TAU, r = rr(s.to + 0.6, 22), o = rockMesh(rr(0.5, 1.1), SPK_M()); o.position.set(Math.sin(a) * r, 0.2, Math.cos(a) * r); FXG.add(o); FALLERS.push({ o, v: new V3(0, rr(-1, 1), 0), sp: rr(1, 3), floor: -80, t: 0, life: 4 }); X.burst(new V3(o.position.x, 0.3, o.position.z), 0xdff6ff, 6, 3, 0.25, 0.5, -6, 2); if (R() < 0.3) X.sfx('shard'); }
    if (k >= 1) s.done = true; }
  // 위험 · 이펙트 · 봇
  if (RS.phase !== 'enter'){
    if (fight) updHZ(dt); updRings(dt); updArcs(dt); updRubble(dt); updSpikes(dt); updFallers(dt); updBotFx(dt); updChest(dt);
    for (let i = HRINGS.length - 1; i >= 0; i--){ const h = HRINGS[i]; h.t += dt; h.m.rotation.y += dt; h.m.material.opacity = Math.max(0, 0.9 * (1 - h.t / 1.2)); h.m.scale.setScalar(0.8 + h.t * 0.4); if (h.t > 1.2){ RG.remove(h.m); h.m.material.dispose(); HRINGS.splice(i, 1); } }
    for (const u of BOTS) updBot(u, dt);
    updTags(); RS.frT -= rdt; if (RS.frT <= 0){ RS.frT = 0.1; updFrames(); G.mapMarkers = BOTS.filter(u => !u.down).map(u => ({ x: u.pos.x, z: u.pos.z, c: '#7ad8ff' })); }
  }
  if (RS.hudDirty || (RS.hudT -= rdt) <= 0){ RS.hudT = 0.25; RS.hudDirty = false; const bp = B ? B.bp : 1, left = RS.m.enrage - RS.t, en = hudEl.querySelector('.en');
    hudEl.querySelector('.ph').textContent = `${['Ⅰ', 'Ⅱ', 'Ⅲ'][bp - 1]} · ${K.phases[bp - 1][0]}`; hudEl.querySelector('.tm').textContent = '⏱ ' + fmtT(RS.t); en.textContent = RS.enr ? '🔥 광폭화!' : `광폭화까지 ${fmtT(left)}`; en.classList.toggle('hot', RS.enr || left < 30); }
  if (fight) RS.lastHp = X.hp;
}

// ───────────────────────── 모듈 API ─────────────────────────
F.openRaidBoard = openRaidBoard; F.enterRaid = id => enterRaid(id, { force: true }); F.raidInfo = raidInfo;
return {
  openRaidBoard, enterRaid: F.enterRaid, raidInfo, leave: exitRaid, META, RAIDS,
  get state(){ return RS; }, get bots(){ return BOTS; },
  // 테스트 · 디버그용 (콘솔): 페이즈 넘기기 · 보스 체력 · 강제 승리/전멸
  dbg: { skip: skipIntro, phase(n){ if (RS && RS.boss) RS.boss.hp = RS.boss.max * (n === 2 ? 0.69 : n === 3 ? 0.34 : 1); }, hp(k){ if (RS && RS.boss) RS.boss.hp = RS.boss.max * k; }, win(){ if (RS && RS.boss){ RS.boss.hp = 1; guardBoss(RS.boss); bossDown(RS.boss); } }, wipe(){ if (RS){ RS.res = 0; X.hurtPlayer(1e6, null, 0); } }, act(k){ if (RS && RS.boss && RS.boss.B && !RS.boss.B.trans){ RS.boss.B.act = { k, t: 0, ph: 0 }; } } },
};
}
