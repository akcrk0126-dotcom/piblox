// 룬 아고라 — 모험의 대지: rpg (agora-rpg.js)
// 성장하는 재미: 아이템 · 드랍(빛기둥) · 가방/장비(I) · 강화(대장간) · 물약(H/G) · 상점 · 여관 · 의뢰 게시판 · 채집 · 보물 상자 · 룬 정령 ·
//               퀘스트(메인 = lore/*.js 의 장 순서 사슬 · 지역 의뢰 · 일일 3) · 추적 HUD · 목표 나침반 · 퀘스트 로그(L) · 칭호/업적
// 계약서: docs/agora-modules.md — 필드 물체는 F.FW 에 절대 y (= F.H), 전투 레이어(X.burst · X.dmgNum …)는 지면 기준 y
// 이야기: lore/index.js 의 LORE (장 · 주민 · 퀘스트 · 칭호). 읽기 · 줍기 · 정화 · 이야기 보스 목표는 agora-saga 가 F.questEvent 로 알려 줘요.
// F 에 올리는 것: F.addItem(id, n, opt) · F.hasItem(id, n) · F.takeItem(id, n) · F.giveLoot(levelOrTable, pos) · F.questEvent(type, data)
//                F.openInventory(tab) · F.openQuests(id) · F.gold(n) · F.title(id?) (+ F.title.grant(id, def)) · F.ITEMS
//                (+ F.openShop · F.openSmith · F.openBoard · F.gearScore() · F.makeGear(opt) · F.RARITY)
// BUS 로 쏘는 것: 'gather' { kind, item } · 'loot' { item, n } · 'quest' { id, state } · 'enhance' { item, ok, lvl } · 'title' { id } · 'ach' { id }
// 저장: S.inv (가방 · 장비 · 상자 · 정령 · 휴식) · S.q (퀘스트) · S.titles · S.ach
import { LORE } from './lore/index.js';
export async function init(G, X, F){
const { THREE, V3, BUS, TAU } = X;
const W = F.WORLD, S = X.S, FW = F.FW, byId = F.byId, WL = W.water, HALF = W.half;
const LOW = G.gfxMode === 'low' || G.IS_TOUCH;
const R = Math.random, rr = (a, b) => a + (b - a) * R(), ri = (a, b) => a + Math.floor(R() * (b - a + 1)), pick = a => a[(R() * a.length) | 0];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
const fmt = n => Math.round(n).toLocaleString(), need = X.need;
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--){ const j = (R() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
// 결정적 난수 — 채집물 · 상자 · 정령 자리는 언제 불러도 같아요
let _s = 1; const srand = s => { _s = (s >>> 0) || 1; };
const SR = () => { _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hashS = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const pp = X.player.pos;
const NPCN = id => (byId('npcs', id) || {}).name || id;
const fieldOn = () => F.inField && X.mode === 'field';
// 그 자리에 놓일 높이 (발판 · 물 위 포함, 절대 y)
const gy = (x, z) => { let y = F.H(x, z); const g = F.groundFn(x, z); if (g > y) y = g; if (F.isWater(x, z)) y = Math.max(y, (F.waterY ? F.waterY(x, z) : WL) + 0.05); return y; };

// ───────────────────────── 저장 ─────────────────────────
S.inv = Object.assign({ bag: [], st: {}, eq: {}, slots: 40, uid: 1, seen: 0, chests: {}, spirits: {}, spUsed: 0, rest: 0 }, S.inv || {});
S.inv.eq = Object.assign({ wpn: null, arm: null, acc: null }, S.inv.eq || {});
S.q = Object.assign({ act: {}, done: {}, track: [], daily: null }, S.q || {});
S.titles = Object.assign({ own: [], cur: '' }, S.titles || {});
S.ach = Object.assign({ c: {}, got: {} }, S.ach || {});
let saveT = 0; const dirty = () => { saveT = 0.8; };
// 큰 배너는 줄 세워서 하나씩 (지역 배너 · 앞 배너와 겹치지 않게)
const BQ = []; let bqT = 0;
const bnr = (a, b, c, red, dur = 2.6) => { if (BQ.length < 6) BQ.push([a, b, c, red, dur]); };
const busyEl = ['fregion', 'lmfound', 'banner'].map(id => () => document.getElementById(id));
function updBanner(rdt){ if (bqT > 0){ bqT -= rdt; return; } if (!BQ.length || (F.saga && F.saga.busy && F.saga.busy())) return; for (const f of busyEl){ const e = f(); if (e && e.classList.contains('on')) return; } const o = BQ.shift(); X.banner(...o); bqT = o[4] + 0.2; }

// ───────────────────────── 등급 · 능력치 ─────────────────────────
const RAR = [
  { n: '일반', en: 'COMMON', c: '#c8d0d4', h: 0xc8d0d4, mul: 1, aff: 0, w: 55 },
  { n: '고급', en: 'UNCOMMON', c: '#72e07e', h: 0x52e060, mul: 1.12, aff: 1, w: 28 },
  { n: '희귀', en: 'RARE', c: '#5ab8ff', h: 0x3a9cff, mul: 1.26, aff: 2, w: 12 },
  { n: '영웅', en: 'EPIC', c: '#c07aff', h: 0xb050ff, mul: 1.44, aff: 3, w: 4.2 },
  { n: '전설', en: 'LEGENDARY', c: '#ffb03a', h: 0xffa020, mul: 1.7, aff: 4, w: 0.8 },
];
const STN = { atk: '공격력', hp: '최대 HP', def: '방어력', crit: '치명타', aspd: '공격 속도', spd: '이동 속도', mp: '최대 MP', regen: 'HP 재생', rune: '룬 마법' };
const PCT = { crit: 1, aspd: 1, spd: 1 };
const fmtStat = (k, v) => PCT[k] ? `+${(v * 100).toFixed(1)}%` : k === 'regen' ? `+${v.toFixed(1)}/초` : `+${Math.round(v)}`;
// 추가 옵션 (무작위) — il = 아이템 레벨
const AFF = {
  atk: il => 1 + il * 0.42, hp: il => 6 + il * 3.2, def: il => 1 + il * 0.45, crit: il => 0.012 + il * 0.0007,
  aspd: il => 0.02 + il * 0.0011, spd: il => 0.015 + il * 0.0008, mp: il => 5 + il * 1.6, regen: il => 0.4 + il * 0.09,
};
const SLOT = { wpn: { n: '무기', icon: '⚔️' }, arm: { n: '갑옷', icon: '🛡️' }, acc: { n: '장신구', icon: '💍' } };
const JOBW = { sword: { n: '검사', icon: '⚔️' }, archer: { n: '궁수', icon: '🏹' }, mage: { n: '마법사', icon: '🪄' }, rogue: { n: '암살자', icon: '🗡️' } };
const myJob = () => S.job || 'sword';
// 티어(아이템 레벨 4 단위)마다 그 지역 이름이 붙어요
const TIER_REG = ['greenhill', 'woods', 'lake', 'swamp', 'canyon', 'plateau', 'blight', 'frost'];
const FLAVOR = { village: '새싹 마을의', greenhill: '초록 언덕의', woods: '속삭이는 숲의', lake: '은빛 호수의', swamp: '안개 늪의', canyon: '붉은 협곡의', plateau: '거인 고원의', blight: '검은 가시의', frost: '서리 봉우리의' };
const BASE = {
  sword: ['훈련용 검', '사냥칼', '떡갈나무 장검', '은빛 롱소드', '광부의 대검', '거인의 양손검', '가시 대검', '빙결 장검'],
  archer: ['나무 활', '사냥 활', '갈대 활', '은빛 장궁', '독수리 깃 활', '별빛 곡궁', '가시 덩굴 활', '서리 장궁'],
  mage: ['견습 지팡이', '떡갈나무 지팡이', '달빛 완드', '마녀의 지팡이', '붉은 수정 지팡이', '별의 지팡이', '가시 마력봉', '서리 결정 지팡이'],
  rogue: ['녹슨 단검', '사냥 단검', '은빛 비수', '독니 단검', '협곡 쌍단검', '거인 뼈 단검', '가시 송곳니', '얼음 쿠나이'],
  arm: ['누빈 조끼', '가죽 갑옷', '비늘 갑옷', '이끼 망토 갑옷', '붉은 바위 판금', '거인의 흉갑', '가시 갑주', '서리 판금 갑옷'],
  acc: ['풀잎 반지', '도토리 목걸이', '진주 귀걸이', '마녀의 부적', '독수리 깃 목걸이', '별빛 반지', '가시 왕관 반지', '서리 결정 목걸이'],
};
const LEGEND = { sword: '용살검', archer: '폭풍의 장궁', mage: '별을 삼킨 지팡이', rogue: '그림자 송곳니', arm: '수호자의 판금갑옷', acc: '아르카디아의 심장' };
const ACC_IC = ['💍', '📿', '🦪', '🧿', '📿', '💍', '💍', '📿'];
const gIcon = it => it.s === 'wpn' ? JOBW[it.j].icon : it.s === 'arm' ? (it.r === 4 || it.t >= 4 ? '🛡️' : '🥋') : it.r === 4 ? '💖' : ACC_IC[it.t];
const lvReq = it => Math.max(1, it.il - 3);
const ENH = e => 1 + e * 0.075;

// ───────────────────────── 쌓이는 아이템 (물약 · 재료) ─────────────────────────
const ITEMS = {
  hp1: { n: '작은 체력 물약', pot: 'hp', v: 90, lv: 1, price: 18 },
  hp2: { n: '체력 물약', pot: 'hp', v: 240, lv: 8, price: 55 },
  hp3: { n: '진한 체력 물약', pot: 'hp', v: 520, lv: 16, price: 140 },
  hp4: { n: '거인의 체력 물약', pot: 'hp', v: 1000, lv: 24, price: 320 },
  mp1: { n: '작은 마나 물약', pot: 'mp', v: 40, lv: 1, price: 18 },
  mp2: { n: '마나 물약', pot: 'mp', v: 90, lv: 8, price: 55 },
  mp3: { n: '진한 마나 물약', pot: 'mp', v: 170, lv: 16, price: 140 },
  mp4: { n: '별빛 마나 물약', pot: 'mp', v: 300, lv: 24, price: 320 },
  herb: { n: '약초', icon: '🌿', c: '#86e070', price: 6, d: '들판과 숲에서 자라는 약초. 약초상 미라가 체력 물약으로 달여 줘요.' },
  mushroom: { n: '빛버섯', icon: '🍄', c: '#6ae6e6', price: 8, d: '숲과 늪의 그늘에서 은은하게 빛나는 버섯. 마나 물약의 재료예요.' },
  ore: { n: '철광석', icon: '🪨', c: '#e0a870', price: 10, d: '협곡과 고원의 바위에서 캔 광석. 대장장이 도른이 강화석으로 제련해 줘요.' },
  crystal: { n: '룬 수정', icon: '💎', c: '#c89aff', price: 30, d: '침식지와 설원에서 자라는 룬 수정. +8 이상 강화에 꼭 필요해요.' },
  stone: { n: '강화석', icon: '💠', c: '#7ad8ff', price: 25, d: '장비 강화의 기본 재료. 장비를 분해하거나 광석을 제련해 얻어요.' },
  sseed: { n: '정령의 씨앗', icon: '🌱', c: '#b0ff8a', price: 90, d: '룬 정령이 남긴 씨앗. 강화에 실패해도 단계가 내려가지 않게 지켜 줘요.' },
};
const POT = { hp: ['hp1', 'hp2', 'hp3', 'hp4'], mp: ['mp1', 'mp2', 'mp3', 'mp4'] };
// 물약 그림 (둥근 플라스크 · 티어가 높을수록 액체가 가득 · 반짝임)
function potSVG(c, t = 0){ const r = 8.6, L = 18.5 - t * 1.6, w = Math.sqrt(r * r - (L - 20) ** 2).toFixed(2);
  return `<svg viewBox="0 0 32 32" width="1em" height="1em" style="display:inline-block;vertical-align:-.15em;overflow:visible"><rect x="12.6" y="4" width="6.8" height="8" rx="1.4" fill="rgba(220,236,255,.5)" stroke="#eaf6ff" stroke-width="1.1"/><rect x="11.4" y="2.2" width="9.2" height="3.2" rx="1.2" fill="#b08458"/>`
    + `<circle cx="16" cy="20" r="9.4" fill="rgba(200,228,255,.22)" stroke="#eaf6ff" stroke-width="1.3"/><path d="M${16 - w} ${L} A${r} ${r} 0 1 0 ${16 + +w} ${L} Z" fill="${c}"/><path d="M${16 - w} ${L} L${16 + +w} ${L}" stroke="#fff" stroke-opacity=".55" stroke-width=".9"/>`
    + `<ellipse cx="12.4" cy="16.6" rx="1.9" ry="3" fill="#fff" opacity=".6"/>${t >= 2 ? `<path d="M24.5 7.5l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9z" fill="#fff4c0"/>` : ''}${t >= 3 ? `<path d="M7 9l.7 1.5 1.5.7-1.5.7L7 13.4l-.7-1.5-1.5-.7 1.5-.7z" fill="#fff4c0"/>` : ''}</svg>`; }
for (const k in ITEMS){ const it = ITEMS[k]; it.id = k; it.k = it.pot ? 'pot' : 'mat';
  if (it.pot){ it.c = it.pot === 'hp' ? '#ff6a78' : '#6aa8ff'; it.icon = potSVG(it.pot === 'hp' ? '#ff3a5a' : '#3a8aff', +k[2] - 1); it.d = `${it.pot === 'hp' ? 'HP' : 'MP'} 를 ${it.v} 회복해요. 단축키 ${it.pot === 'hp' ? 'H' : 'G'} · 재사용 7초`; } }
const ORDER = Object.keys(ITEMS);
const potFor = (lv, kind) => POT[kind][lv >= 24 ? 3 : lv >= 16 ? 2 : lv >= 8 ? 1 : 0];
const regMat = id => ({ village: 'herb', greenhill: 'herb', woods: R() < 0.5 ? 'herb' : 'mushroom', lake: 'herb', swamp: 'mushroom', canyon: 'ore', plateau: 'ore', blight: 'crystal', frost: R() < 0.6 ? 'ore' : 'crystal' })[id] || 'herb';
const regByLv = lv => { let best = W.regions[1]; for (const r of W.regions) if (!r.safe && lv >= r.lv[0]) best = r; return best; };

// ───────────────────────── 장비 만들기 ─────────────────────────
function rollRarity(rb = 0, minR = 0){
  let sum = 0; const w = RAR.map((r, i) => { const v = r.w * Math.pow(1 + rb, i); sum += v; return v; });
  let x = R() * sum, r = 0; for (; r < 4; r++){ x -= w[r]; if (x <= 0) break; }
  return Math.max(minR, Math.min(4, r));
}
function makeGear(o = {}){
  const s = o.s || pick(['wpn', 'wpn', 'arm', 'arm', 'acc']), il = clamp(Math.round(o.il || S.lv), 1, 34), t = clamp(Math.floor((il - 1) / 4), 0, 7);
  const j = s === 'wpn' ? (o.j || (R() < 0.82 ? myJob() : pick(Object.keys(JOBW)))) : null;
  const r = o.r ?? rollRarity(o.rb || 0, o.minR || 0), m = RAR[r].mul, v = () => rr(0.93, 1.07), M = {};
  if (s === 'wpn'){ M.atk = (3 + il * 1.25) * m * v() * (j === 'mage' ? 0.85 : j === 'rogue' ? 0.92 : 1); if (j === 'mage') M.rune = (4 + il * 1.6) * m * v(); }
  else if (s === 'arm'){ M.hp = (14 + il * 7) * m * v(); M.def = (2 + il * 0.9) * m * v(); }
  else { M.hp = (6 + il * 3) * m * v(); M.mp = (6 + il * 1.5) * m * v(); }
  for (const k in M) M[k] = Math.round(M[k] * 10) / 10;
  const keys = shuffle(Object.keys(AFF)).slice(0, RAR[r].aff);
  const a = keys.map(k => { const val = AFF[k](il) * rr(0.72, 1.15) * (r === 4 ? 1.2 : 1); return [k, PCT[k] ? Math.round(val * 1000) / 1000 : Math.round(val * 10) / 10]; });
  const reg = o.reg && FLAVOR[o.reg] ? o.reg : TIER_REG[t], key = s === 'wpn' ? j : s;
  return { u: S.inv.uid++, s, j, il, r, t, n: `${FLAVOR[reg]} ${r === 4 ? LEGEND[key] : BASE[key][t]}`, m: M, a, e: 0 };
}
function gearStats(it){ const o = {}, k = ENH(it.e); for (const key in it.m) o[key] = it.m[key] * k; for (const [key, v] of it.a) o[key] = (o[key] || 0) + v; return o; }
const gScore = it => Math.round(it.il * 10 * RAR[it.r].mul * ENH(it.e) + it.a.length * it.il * 1.5 + 5);
const gearScore = () => ['wpn', 'arm', 'acc'].reduce((s, k) => s + (S.inv.eq[k] ? gScore(S.inv.eq[k]) : 0), 0);
const gName = it => `${it.e ? `+${it.e} ` : ''}${it.n}`;
const sellPrice = it => it.u ? Math.round((8 + it.il * 4) * (1 + it.r * 0.9) * (1 + it.e * 0.12)) : Math.max(1, Math.round(ITEMS[it.id].price * 0.4));
const dismantleGet = it => ({ stone: 1 + it.r + Math.floor(it.il / 10) + Math.floor(it.e / 2), crystal: it.r >= 3 ? it.r - 2 : 0 });

// ───────────────────────── 장비 → 능력치 (X.BONUS 에 내 몫만 더하고 빼요) ─────────────────────────
const MINE = { atk: 0, hp: 0, def: 0, crit: 0, mp: 0, spd: 0, aspd: 0, rune: 0, regen: 0 };
const restLeft = () => Math.max(0, (S.inv.rest || 0) - Date.now());
const wpnOk = it => it && (it.s !== 'wpn' || it.j === myJob());
function applyBonus(){
  const t = { atk: 0, hp: 0, def: 0, crit: 0, mp: 0, spd: 0, aspd: 0, rune: 0, regen: 0 };
  for (const k of ['wpn', 'arm', 'acc']){ const it = S.inv.eq[k]; if (!it || !wpnOk(it)) continue; const st = gearStats(it); for (const s in st) t[s] += st[s]; }
  const ti = TITLES[S.titles.cur]; if (ti && ti.b) for (const s in ti.b) t[s] += ti.b[s];
  if (restLeft() > 0) t.regen += 2 + S.lv * 0.15;
  t.spd = Math.min(t.spd, 0.3); t.aspd = Math.min(t.aspd, 0.45); t.crit = Math.min(t.crit, 0.4);
  const b0 = X.D();
  for (const k in MINE){ X.BONUS[k] = (X.BONUS[k] || 0) + t[k] - MINE[k]; MINE[k] = t[k]; }
  const b1 = X.D();
  if (!X.dead){ X.hp = clamp(X.hp + Math.max(0, b1.maxHp - b0.maxHp), 1, b1.maxHp); X.mp = clamp(X.mp + Math.max(0, b1.maxMp - b0.maxMp), 0, b1.maxMp); }
  X.refreshHud(); if (X.refreshStats) try { X.refreshStats(); } catch (e){}
}

// ───────────────────────── 가방 ─────────────────────────
const stackIds = () => ORDER.filter(k => S.inv.st[k] > 0);
const bagUsed = () => S.inv.bag.length + stackIds().length;
const bagFree = () => S.inv.slots - bagUsed();
const cnt = id => S.inv.st[id] || 0;
let invDirty = true;
function addStack(id, n = 1, force){ if (!ITEMS[id] || n <= 0) return false; if (!S.inv.st[id] && bagFree() <= 0 && !force) return false; S.inv.st[id] = (S.inv.st[id] || 0) + n; invDirty = true; return true; }
function takeStack(id, n = 1){ if (cnt(id) < n) return false; S.inv.st[id] -= n; if (S.inv.st[id] <= 0) delete S.inv.st[id]; invDirty = true; return true; }
function addGear(it, force){ if (bagFree() <= 0 && !force) return false; S.inv.bag.push(it); invDirty = true; if (it.r === 4) achAdd('legend', 1); if (it.r >= 2) markNew(); return true; }
function removeGear(it){ const i = S.inv.bag.indexOf(it); if (i >= 0){ S.inv.bag.splice(i, 1); invDirty = true; return true; } return false; }
// 받은 것 알림 (오른쪽 알림 피드)
function lootNote(d){
  if (d.g){ const rc = RAR[d.g.r]; F.note(`<span style="color:${rc.c}">+ [${rc.n}] ${esc(d.g.n)}</span> <small style="opacity:.7">Lv.${d.g.il}</small>`, 3.8); if (d.g.r >= 2) lootCard(d.g); }
  else { const it = ITEMS[d.id]; F.note(`<span style="color:${it.c}">+ ${it.icon} ${it.n}${d.n > 1 ? ` ×${d.n}` : ''}</span>`, 2.6); }
}
// 바로 받기 (보상 · 레이드 · 상자 열기 없이) — 보상은 가방이 넘쳐도 넣어 줘요
function receive(d, force = true){
  const ok = d.g ? addGear(d.g, force) : addStack(d.id, d.n || 1, force);
  if (!ok) return false;
  lootNote(d); BUS.emit('loot', { item: d.g ? d.g : d.id, n: d.g ? 1 : d.n || 1 }); dirty();
  if (bagFree() < 0 && !fullWarnT){ fullWarnT = 6; X.hint('🎒 가방이 넘쳤어요 — 팔거나 분해해서 자리를 만들어 주세요', 4); }
  return true;
}
let fullWarnT = 0;
function addGold(n, quiet){ n = Math.round(n); if (!n) return; S.gold = Math.max(0, (S.gold || 0) + n); if (n > 0) achAdd('earn', n); dirty(); goldDirty = true; if (!quiet && n > 0) F.note(`<span style="color:#ffd36a">+ 🪙 ${fmt(n)}</span>`, 2.2); }
let goldDirty = true;

// ───────────────────────── 떨어진 전리품: 등급 색 빛기둥 (필드 월드, 절대 y) ─────────────────────────
const UT = { value: 0 };
const BEAM_G = new THREE.CylinderGeometry(0.16, 0.3, 1, 14, 1, true).translate(0, 0.5, 0);
const BEAM_M = new Map(), CORE_M = new Map(), GLOW_M = new Map();
const beamMat = hex => { let m = BEAM_M.get(hex); if (!m){ m = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(hex) }, uT: UT }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 uC; uniform float uT; varying vec2 vU; void main(){ float y = vU.y; float a = pow(1.0 - y, 1.7) * (0.6 + 0.4 * sin(uT * 5.0 - y * 10.0 + vU.x * 6.283)) * smoothstep(0.0, 0.04, y); gl_FragColor = vec4(uC * (1.0 + (1.0 - y) * 1.2), a * 0.8); }' }); BEAM_M.set(hex, m); } return m; };
const coreMat = hex => { let m = CORE_M.get(hex); if (!m){ m = G.std({ color: hex, emissive: hex, emissiveIntensity: 1.1, roughness: 0.25, metalness: 0.3, flatShading: true }); CORE_M.set(hex, m); } return m; };
const GLOW_T = G.tex(G.glowC(255, 255, 255));
const glowMat = hex => { let m = GLOW_M.get(hex); if (!m){ m = new THREE.SpriteMaterial({ map: GLOW_T, color: hex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, fog: false }); GLOW_M.set(hex, m); } return m; };
const CORE_G = { gear: new THREE.OctahedronGeometry(0.2, 0), pot: new THREE.CapsuleGeometry(0.08, 0.14, 4, 8), mat: new THREE.IcosahedronGeometry(0.14, 0) };
const LOOT = [];
function scatterLoot(d, x, z, spread = 1){
  const a = R() * TAU, dd = rr(0.9, 2.1) * spread; let lx = x + Math.cos(a) * dd, lz = z + Math.sin(a) * dd;
  if (F.isWater(lx, lz) && !F.isWater(x, z)){ lx = x; lz = z; }
  const r = d.g ? d.g.r : -1, hex = d.g ? RAR[r].h : new THREE.Color(ITEMS[d.id].c).getHex();
  const h = d.g ? [1.8, 2.8, 4.2, 6.5, 11][r] : 1.1, w = d.g ? [0.75, 0.85, 1, 1.3, 1.7][r] : 0.55;
  const g = new THREE.Group(), beam = new THREE.Mesh(BEAM_G, beamMat(hex)); beam.scale.set(w, 0.01, w); beam.renderOrder = 3; g.add(beam);
  const glow = new THREE.Sprite(glowMat(hex)); glow.scale.setScalar(d.g ? 0.9 + r * 0.22 : 0.7); glow.position.y = 0.3; g.add(glow);
  const core = new THREE.Mesh(d.g ? CORE_G.gear : ITEMS[d.id].pot ? CORE_G.pot : CORE_G.mat, coreMat(hex)); core.position.y = 0.45; if (d.g) core.scale.setScalar(1 + r * 0.12); g.add(core);
  const y0 = gy(x, z); g.position.set(x, y0, z); FW.add(g);
  LOOT.push({ g, beam, core, glow, d, x0: x, z0: z, y0, x: lx, z: lz, y: gy(lx, lz), t: 0, h, w, wait: 0 });
  if (LOOT.length > 70){ const o = LOOT.shift(); FW.remove(o.g); }
  if (r >= 3){ X.sfx('shard'); if (r === 4){ X.sfx('elite'); bnr('LEGENDARY', '전설 장비가 떨어졌다!', '하늘까지 닿는 황금 빛기둥을 찾아 주워요', false, 2.6); } }
}
function updLoot(dt){
  for (let i = LOOT.length - 1; i >= 0; i--){
    const L = LOOT[i]; L.t += dt;
    if (L.t < 0.55){ const k = L.t / 0.55; L.g.position.set(lerp(L.x0, L.x, k), lerp(L.y0, L.y, k) + Math.sin(k * Math.PI) * 1.7, lerp(L.z0, L.z, k)); L.beam.scale.y = L.h * k * k; }
    else { L.g.position.set(L.x, L.y, L.z); L.beam.scale.y = L.h * (0.92 + Math.sin(G.time * 2 + i) * 0.08); }
    L.core.rotation.y += dt * 2.4; L.core.position.y = 0.48 + Math.sin(G.time * 3 + i * 1.7) * 0.09;
    if (L.t > 180){ const k = Math.max(0, 1 - (L.t - 180) / 2); L.g.scale.setScalar(k + 0.001); if (k <= 0){ FW.remove(L.g); LOOT.splice(i, 1); } continue; }
    if (L.t < 0.65 || X.dead || L.wait > G.time) continue;
    const dx = pp.x - L.x, dz = pp.z - L.z, d = Math.hypot(dx, dz);
    if (d > 3.6 || Math.abs(pp.y - L.y) > 3.2) continue;
    if (d < 1.15){
      if (receive(L.d, false)){ X.sfx('pick'); X.emit(L.x, L.y + 0.6, L.z, 0, 2.5, 0, L.d.g ? RAR[L.d.g.r].h : 0xfff0c0, 0.35, 0.5, { grav: -2 }); FW.remove(L.g); LOOT.splice(i, 1); }
      else { L.wait = G.time + 3; if (!fullWarnT){ fullWarnT = 4; X.hint('🎒 가방이 가득 찼어요 — <b>I</b> 가방에서 팔거나 분해하세요', 3.5); } }
    } else { const s = Math.min(d, (5 + L.t) * dt) / d; L.x += dx * s; L.z += dz * s; L.y = gy(L.x, L.z); }
  }
}

// ───────────────────────── 드랍 표 · F.giveLoot ─────────────────────────
const raidLv = id => (byId('raids', id) || {}).lv || S.lv;
const LOOTT = {
  chest_w: lv => ({ lv, gear: 0.55, rb: 0.4, gold: [20 + lv * 8, 40 + lv * 14], mats: 2, pot: 0.6, stone: [0, 1] }),
  chest_s: lv => ({ lv: lv + 1, gear: 1, rb: 1, gold: [40 + lv * 14, 80 + lv * 22], mats: 3, pot: 0.8, stone: [1, 3] }),
  chest_g: lv => ({ lv: lv + 2, gear: 1.6, rb: 2.2, minR: 1, gold: [90 + lv * 25, 160 + lv * 40], mats: 3, seed: 0.6, stone: [2, 4], crystal: lv >= 16 ? [0, 2] : null }),
  fboss: lv => ({ lv: lv + 1, gear: 3, rb: 2.5, minR: 2, gold: [200 + lv * 40, 300 + lv * 60], mats: 3, seed: 0.8, stone: [3, 6] }),
  raid: lv => ({ lv: lv + 2, gear: 3, rb: 3, minR: 2, gold: [300 + lv * 50, 450 + lv * 70], seed: 1, stone: [4, 8], crystal: [1, 3] }),
  daily: lv => ({ lv: lv + 1, gear: 1, rb: 1.2, minR: 1, gold: [60 + lv * 20, 100 + lv * 30], stone: [2, 3], pot: 1 }),
};
const xzOf = p => !p ? null : Array.isArray(p) ? p : p.x != null ? [p.x, p.z] : null;
function rollLoot(o){
  const lv = o.lv || S.lv, out = [], reg = o.reg || regByLv(lv).id;
  const ng = Math.floor(o.gear || 0) + (R() < (o.gear || 0) % 1 ? 1 : 0);
  for (let i = 0; i < ng; i++) out.push({ g: makeGear({ il: lv + ri(-1, 1), rb: o.rb || 0, minR: o.minR || 0, reg, s: o.s }) });
  for (let i = 0; i < (o.mats || 0); i++) if (R() < 0.7) out.push({ id: regMat(reg), n: ri(1, 2) });
  if (o.stone){ const n = ri(o.stone[0], o.stone[1]); if (n) out.push({ id: 'stone', n }); }
  if (o.crystal){ const n = ri(o.crystal[0], o.crystal[1]); if (n) out.push({ id: 'crystal', n }); }
  if (o.seed && R() < o.seed) out.push({ id: 'sseed', n: 1 });
  if (o.pot && R() < o.pot) out.push({ id: potFor(lv, R() < 0.6 ? 'hp' : 'mp'), n: ri(1, 3) });
  for (const [id, n] of o.items || []) out.push(SLOT[id] ? { g: makeGear({ s: id, il: lv }) } : { id, n });
  return { out, gold: o.gold ? (Array.isArray(o.gold) ? ri(o.gold[0], o.gold[1]) : o.gold) : 0 };
}
// spec: 레벨(숫자) | 'chest_w' · 'chest_s' · 'chest_g' · 'fboss' · 'daily' · 'raid_<id>' | { lv, gear, rb, minR, gold:[a,b], mats, stone, crystal, seed, pot, items:[[id,n]], s }
// pos: [x, z] | V3 | { x, z } — 필드 안이면 그 자리에 빛기둥으로 흩뿌리고, 아니면(레이드 등) 바로 가방에 넣어요
F.giveLoot = (spec, pos) => {
  let o;
  if (typeof spec === 'number') o = LOOTT.chest_w(spec);
  else if (typeof spec === 'string') o = spec.startsWith('raid_') ? Object.assign(LOOTT.raid(raidLv(spec.slice(5))), { reg: { grom: 'swamp', granok: 'canyon', cryos: 'frost' }[spec.slice(5)] }) : (LOOTT[spec] || LOOTT.chest_w)(S.lv);
  else o = Object.assign({ lv: S.lv }, spec || {});
  const xz = xzOf(pos); if (xz && !o.reg){ const rg = F.regionAt(xz[0], xz[1]); if (rg && !rg.safe) o.reg = rg.id; }
  const { out, gold } = rollLoot(o);
  if (xz && fieldOn()){
    for (const d of out) scatterLoot(d, xz[0], xz[1], 1.2);
    if (gold){ addGold(gold); X.burst(new V3(xz[0], 0.9, xz[1]), 0xffd36a, 24, 4, 0.18, 0.8, -9, 4); X.sfx('pick'); }
  } else { for (const d of out) receive(d); if (gold) addGold(gold); }
  X.save(); return out.map(d => d.g ? d.g : { id: d.id, n: d.n });
};
// 처치 드랍 (필드에서만)
function dropFromKill(e){
  const lv = e.lv || S.lv, gap = S.lv - lv, pen = gap > 6 ? 0.25 : 1, x = e.pos.x, z = e.pos.z, reg = F.regionAt(x, z);
  const g = Math.round((2 + lv * 1.5) * rr(0.7, 1.3) * (e.elite ? 4 : 1) * (pen < 1 ? 0.4 : 1));
  if (!e.fboss){ addGold(g, true); X.burst(new V3(x, 0.9, z), 0xffd36a, e.elite ? 18 : 7, 3, 0.15, 0.6, -9, 3); X.dmgNum(new V3(x, 1.9, z), `+${g} G`, 'gold'); }
  // 필드 보스: 골드 · 상자 3개는 life 가 주고, 여기선 희귀 이상 장비 하나를 꼭 떨궈요
  if (e.fboss){ scatterLoot({ g: makeGear({ il: lv + 1, rb: 2.5, minR: 2, reg: reg && reg.id }) }, x, z); scatterLoot({ id: 'stone', n: ri(2, 4) }, x, z); if (R() < 0.7) scatterLoot({ id: 'sseed', n: 1 }, x, z); return; }
  if (R() < (e.elite ? 0.65 : 0.08) * pen) scatterLoot({ g: makeGear({ il: lv + ri(-1, 1), rb: e.elite ? 1 : 0, reg: reg && reg.id }) }, x, z);
  if (R() < 0.13 * pen) scatterLoot({ id: R() < 0.25 ? 'stone' : regMat(reg && reg.id), n: 1 }, x, z);
  if (R() < 0.05 * pen) scatterLoot({ id: potFor(lv, R() < 0.6 ? 'hp' : 'mp'), n: 1 }, x, z);
  if (e.elite && R() < 0.06) scatterLoot({ id: 'sseed', n: 1 }, x, z);
  // 휴식 보너스: 처치 경험치 +25%
  if (restLeft() > 0 && e.cfg){ const xp = e.cfg.exp * (e.expMul ?? 1) * (e.elite ? 3 : 1) * 0.25 * (gap > 5 ? Math.max(0.1, 1 - (gap - 5) * 0.15) : 1); if (xp > 0.5) X.gainExp(Math.round(xp * 10) / 10); }
}

// ───────────────────────── 물약 (H / G) ─────────────────────────
const potCd = { hp: 0, mp: 0 }, POTCD = 7;
const potMode = () => (X.mode === 'field' && F.inField) || X.mode === 'raid';
const bestPot = kind => { for (let i = 3; i >= 0; i--) if (cnt(POT[kind][i]) > 0) return POT[kind][i]; return null; };
function usePot(kind, id){
  if (X.dead) return false;
  id = id || bestPot(kind);
  if (!id){ X.hint(`${kind === 'hp' ? '체력' : '마나'} 물약이 없어요 — 새싹 마을 약초상 미라에게서 살 수 있어요`, 2.6); return false; }
  const it = ITEMS[id], d = X.D();
  if (potCd[kind] > 0){ X.hint(`물약 재사용까지 ${potCd[kind].toFixed(1)}초`, 1.2); return false; }
  if (kind === 'hp' ? X.hp >= d.maxHp : X.mp >= d.maxMp){ X.hint(kind === 'hp' ? '체력이 가득해요' : '마나가 가득해요', 1.2); return false; }
  takeStack(id, 1); potCd[kind] = POTCD;
  if (kind === 'hp') X.heal(it.v); else X.restoreMp(it.v);
  const py = X.PY(), col = kind === 'hp' ? 0xff6a7a : 0x6ab0ff;
  X.burst(new V3(pp.x, py + 0.4, pp.z), col, 22, 2.2, 0.2, 0.9, 1, 3); X.dmgNum(new V3(pp.x, py + 2.3, pp.z), `+${it.v}`, kind === 'hp' ? 'heal' : 'mana');
  X.sfx('pick'); dirty(); updPotHud(true); return true;
}

// ───────────────────────── 칭호 · 업적 ─────────────────────────
// b = 칭호 보너스 (단 칭호 하나만 적용)
const TITLES = {
  rookie: { n: '새싹 모험가', d: '메인 「새싹 마을의 새 얼굴」 완료', b: { hp: 20 } },
  slayer: { n: '슬라임 학살자', d: '슬라임 100마리 처치', b: { atk: 3 } },
  veteran: { n: '백전노장', d: '몬스터 1,000마리 처치', b: { atk: 6, hp: 40 } },
  thorn: { n: '가시 사냥꾼', d: '정예 몬스터 30마리 처치', b: { crit: 0.02 } },
  boss: { n: '필드의 지배자', d: '필드 보스 5번 처치', b: { atk: 5, def: 3 } },
  explorer: { n: '탐험가', d: '랜드마크 모두 발견', b: { spd: 0.04 } },
  pilgrim: { n: '룬 비석 순례자', d: '룬 비석 모두 깨우기', b: { mp: 30 } },
  smith: { n: '강화의 신', d: '장비 +12 강화 성공', b: { atk: 8 } },
  raider: { n: '레이드 정복자', d: '레이드 3종 모두 클리어', b: { hp: 120, def: 5 } },
  angler: { n: '낚시왕', d: '물고기 50마리 낚기', b: { regen: 1.5 } },
  gatherer: { n: '채집의 달인', d: '채집 100번', b: { regen: 1 } },
  treasure: { n: '보물 사냥꾼', d: '보물 상자 20개 열기', b: { crit: 0.015 } },
  spirit: { n: '정령의 친구', d: '룬 정령 모두 찾기', b: { mp: 40, spd: 0.03 } },
  rich: { n: '황금 손', d: '골드 100,000 벌기', b: { hp: 60 } },
  legend: { n: '전설을 쥔 자', d: '전설 장비 얻기', b: { atk: 4, crit: 0.01 } },
  grom: { n: '늪을 건넌 자', d: '메인 「늪의 왕 그롬」 완료', b: { hp: 50 } },
  thornbreaker: { n: '가시를 꺾은 자', d: '메인 「가시 군주」 완료', b: { atk: 6 } },
  frost: { n: '서리 방랑자', d: '의뢰 「설인 동굴」 완료', b: { def: 6 } },
  hero: { n: '아르카디아의 영웅', d: '메인 이야기 완결', b: { atk: 10, hp: 100, def: 5 } },
  apex: { n: '정점에 선 자', d: 'Lv.30 달성', b: { atk: 5, hp: 50 } },
  fixer: { n: '해결사', d: '퀘스트 30개 완료', b: { def: 4 } },
};
const ACH = [
  { id: 'slime', n: '말랑말랑 대청소', d: '슬라임 처치', c: 'k_slime', goal: 100, title: 'slayer' },
  { id: 'kill', n: '백전노장', d: '몬스터 처치', c: 'kill', goal: 1000, title: 'veteran' },
  { id: 'elite', n: '가시 사냥꾼', d: '정예 몬스터 처치', c: 'elite', goal: 30, title: 'thorn' },
  { id: 'fboss', n: '필드의 지배자', d: '필드 보스 처치', c: 'fboss', goal: 5, title: 'boss' },
  { id: 'disc', n: '탐험가', d: '랜드마크 발견', c: 'disc', goal: W.landmarks.length, title: 'explorer' },
  { id: 'wps', n: '룬 비석 순례자', d: '룬 비석 깨우기', c: 'wps', goal: W.waypoints.length, title: 'pilgrim' },
  { id: 'enh', n: '강화의 신', d: '최고 강화 단계', c: 'enh', goal: 12, title: 'smith' },
  { id: 'raids', n: '레이드 정복자', d: '레이드 종류별 클리어', c: 'raids', goal: W.raids.length, title: 'raider' },
  { id: 'fish', n: '낚시왕', d: '물고기 낚기', c: 'fish', goal: 50, title: 'angler' },
  { id: 'gather', n: '채집의 달인', d: '채집하기', c: 'gather', goal: 100, title: 'gatherer' },
  { id: 'chest', n: '보물 사냥꾼', d: '보물 상자 열기', c: 'chest', goal: 20, title: 'treasure' },
  { id: 'spirit', n: '정령의 친구', d: '룬 정령 찾기', c: 'spirit', goal: W.seeds, title: 'spirit' },
  { id: 'rich', n: '황금 손', d: '골드 벌기', c: 'earn', goal: 100000, title: 'rich' },
  { id: 'legend', n: '전설의 시작', d: '전설 장비 얻기', c: 'legend', goal: 1, title: 'legend' },
  { id: 'lv30', n: '정점', d: '레벨 달성', c: 'lv', goal: 30, title: 'apex' },
  { id: 'quests', n: '해결사', d: '퀘스트 완료', c: 'quests', goal: 30, title: 'fixer' },
  { id: 'main', n: '아르카디아의 영웅', d: '메인 퀘스트 완료', c: 'main', goal: 21, title: 'hero' },
];
const raidCleared = id => { const c = S.raid && S.raid.clears; return !!(c && (typeof c === 'object' ? c[id] : 0)); };
const getC = c => c === 'disc' ? Object.keys((S.lm && S.lm.disc) || {}).length : c === 'wps' ? ((S.field && S.field.wps) || []).length : c === 'lv' ? S.lv
  : c === 'main' ? MAIN.filter(id => S.q.done[id]).length : c === 'raids' ? W.raids.filter(r => S.ach.c['r_' + r.id] || raidCleared(r.id)).length : c === 'spirit' ? Object.keys(S.inv.spirits).length : (S.ach.c[c] || 0);
let achT = 1;
function achAdd(c, n = 1){ S.ach.c[c] = (S.ach.c[c] || 0) + n; achT = Math.min(achT, 0.4); dirty(); }
function achMax(c, v){ if ((S.ach.c[c] || 0) < v){ S.ach.c[c] = v; achT = Math.min(achT, 0.4); dirty(); } }
function achCheck(){
  for (const a of ACH){ if (S.ach.got[a.id] || getC(a.c) < a.goal) continue;
    S.ach.got[a.id] = Date.now(); BUS.emit('ach', { id: a.id }); X.sfx('shard'); F.note(`<span style="color:#ffd36a">🏆 업적 달성 — ${a.n}</span>`, 4.5);
    if (a.title) grantTitle(a.title); X.save(); }
}
const bonusText = b => b ? Object.entries(b).map(([k, v]) => `${STN[k]} ${fmtStat(k, v)}`).join(' · ') : '';
function grantTitle(id, def){
  if (def && !TITLES[id]) TITLES[id] = def;
  if (def){ S.titles.defs = S.titles.defs || {}; S.titles.defs[id] = { n: def.n, d: def.d, b: def.b, c: def.c, icon: def.icon }; }
  const t = TITLES[id]; if (!t || S.titles.own.includes(id)) return false;
  S.titles.own.push(id); BUS.emit('title', { id }); X.sfx('level');
  bnr('NEW TITLE', `「${t.n}」`, `칭호 획득 · ${bonusText(t.b)} — 가방(I) → 칭호 탭`, false, 3.2);
  if (!S.titles.cur) setTitle(id); X.save(); markNew(); return true;
}
function setTitle(id){ S.titles.cur = id && S.titles.own.includes(id) ? id : ''; applyBonus(); renderCardTitle(); X.save(); }
F.title = id => { if (id !== undefined) setTitle(id); const t = TITLES[S.titles.cur]; return t ? t.n : ''; };
F.title.grant = grantTitle; F.title.list = () => TITLES;

// ───────────────────────── 스타일 ─────────────────────────
const css = document.createElement('style');
css.textContent = `
  .rpgw { position:fixed; left:50%; top:50%; transform:translate(-50%,-48%) scale(.97); z-index:27; width:min(860px, 96vw); max-height:min(660px, 94vh); display:flex; flex-direction:column; padding:12px 16px 12px; color:#e8e1cf; font:400 13px 'Noto Sans KR';
    background:linear-gradient(180deg, rgba(16,20,34,.97), rgba(7,9,16,.97)); border:1px solid rgba(233,200,126,.55); border-radius:6px; box-shadow:0 0 0 4px rgba(10,14,24,.5), 0 20px 60px rgba(0,0,0,.7); opacity:0; pointer-events:none; transition:opacity .2s, transform .2s; }
  .rpgw.on { opacity:1; pointer-events:auto; transform:translate(-50%,-50%) scale(1); }
  .rpgw::before { content:''; position:absolute; left:18px; right:18px; top:-1px; height:1px; background:linear-gradient(90deg, transparent, #ffe9b0, transparent); }
  .rpgw .hd { display:flex; flex-wrap:wrap; align-items:center; gap:8px 10px; padding-bottom:9px; border-bottom:1px solid rgba(233,200,126,.25); }
  .rpgw .hd > span { font:700 10px 'Cinzel'; letter-spacing:.4em; color:#7ff3ff; white-space:nowrap; }
  .rpgw .hd > b { font:700 19px 'Gowun Batang'; color:#fff3d6; white-space:nowrap; }
  .rpgw .hd .tabs { display:flex; gap:5px; flex:1 1 100%; flex-wrap:wrap; order:9; } .rpgw .hd .sp { flex:1; }
  @media (min-width:700px){ .rpgw .hd .tabs { flex:0 1 auto; order:2; margin-left:4px; } .rpgw .hd .sp { order:3; } .rpgw .hd .gold { order:4; } .rpgw .hd .x { order:5; } }
  .rpgw .tabs button { font:700 12px 'Gowun Batang'; color:#cfc6b0; padding:5px 11px; border-radius:14px; border:1px solid rgba(233,200,126,.22); background:rgba(255,255,255,.03); cursor:pointer; white-space:nowrap; }
  .rpgw .tabs button.on { color:#10131c; background:linear-gradient(180deg,#fff2c9,#d9b05a); border-color:#ffd36a; }
  .rpgw .gold { font:700 13px 'Noto Sans KR'; color:#ffe9b0; padding:3px 11px; border-radius:14px; background:rgba(255,211,106,.12); border:1px solid rgba(255,211,106,.4); white-space:nowrap; } .rpgw .gold b { font:900 14px 'Cinzel'; }
  .rpgw .x { background:none; border:none; color:#e9c87e; font-size:20px; cursor:pointer; padding:0 4px; }
  .rpgw .bd { overflow:auto; flex:1; min-height:0; padding-top:10px; overscroll-behavior:contain; }
  .rpgw .btn { font:700 13px 'Gowun Batang'; letter-spacing:.05em; color:#10131c; padding:7px 13px; border:none; border-radius:3px; cursor:pointer; white-space:nowrap; background:linear-gradient(180deg,#fff2c9,#e2b964 60%,#b88c3e); }
  .rpgw .btn.sub { color:#fff3d6; background:rgba(233,200,126,.1); border:1px solid rgba(233,200,126,.45); } .rpgw .btn.red { color:#fff; background:linear-gradient(180deg,#f07a7a,#a83232); }
  .rpgw .btn:disabled { opacity:.32; cursor:default; } .rpgw .btn.big { font-size:16px; padding:11px 18px; width:100%; letter-spacing:.2em; }
  .rpgw .note { font:400 12px/1.6 'Noto Sans KR'; color:#9fb6c0; margin:0 0 8px; }
  @media (max-width:640px){ .rpgw { padding:10px; } .rpgw .hd > span { display:none; } .rpgw .hd > b { font-size:16px; } .rpgw .tabs button { padding:4px 8px; } }
  .rslot { --c:#5a6470; position:relative; flex:none; width:46px; height:46px; border-radius:7px; display:flex; align-items:center; justify-content:center; font-size:23px; cursor:pointer; user-select:none;
    background:radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--c) 22%, rgba(40,48,64,.9)), rgba(6,8,14,.9)); border:1px solid color-mix(in srgb, var(--c) 70%, transparent); box-shadow:inset 0 0 10px color-mix(in srgb, var(--c) 30%, transparent); }
  .rslot i { font-style:normal; line-height:1; }
  .rslot .n { position:absolute; right:3px; bottom:1px; font:900 11px 'Noto Sans KR'; color:#fff; text-shadow:0 1px 2px #000, 0 0 3px #000; }
  .rslot .e { position:absolute; left:3px; top:1px; font:900 10px 'Cinzel'; color:#ffe08a; text-shadow:0 1px 2px #000; }
  .rslot .l { position:absolute; left:3px; bottom:1px; font:700 9px 'Noto Sans KR'; color:#c9d6da; text-shadow:0 1px 2px #000; }
  .rslot.sel { outline:2px solid #fff3d6; outline-offset:1px; } .rslot.empty { cursor:default; background:rgba(255,255,255,.025); border-color:rgba(255,255,255,.07); box-shadow:none; }
  .rslot.bad i { filter:grayscale(.85) brightness(.7); } .rslot.r4 { animation:rleg 2s infinite; } .rslot.new::after { content:''; position:absolute; right:-2px; top:-2px; width:8px; height:8px; border-radius:50%; background:#ff4a4a; box-shadow:0 0 6px #ff4a4a; }
  @keyframes rleg { 50% { box-shadow:inset 0 0 16px rgba(255,176,58,.7), 0 0 12px rgba(255,176,58,.6); } }
  #rpgInv { width:min(730px, 96vw); }
  #rpgInv .inv { display:grid; grid-template-columns:232px 1fr; gap:14px; }
  #rpgInv .eqp { display:flex; flex-direction:column; gap:7px; min-width:0; }
  #rpgInv .who b { font:700 16px 'Gowun Batang'; color:#fff3d6; } #rpgInv .who small { display:block; font:500 11px 'Noto Sans KR'; color:#ffd36a; }
  #rpgInv .who .col { font:500 11px 'Noto Sans KR'; color:#c9d6da; margin-top:2px; } #rpgInv .who .col b { font:700 11px 'Noto Sans KR'; color:#7ff8ff; }
  .req { display:flex; align-items:center; gap:9px; padding:5px; border-radius:6px; background:rgba(255,255,255,.035); cursor:pointer; border:1px solid transparent; min-width:0; }
  .req:hover, .req.sel { border-color:rgba(233,200,126,.5); } .req .nm { font:700 12.5px 'Gowun Batang'; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .req small { display:block; font:400 10.5px 'Noto Sans KR'; color:#9fb6c0; } .req > div { min-width:0; }
  #rpgInv .gs { display:grid; grid-template-columns:auto 1fr; gap:1px 8px; padding:7px 10px; border-radius:6px; background:linear-gradient(90deg, rgba(255,211,106,.13), rgba(255,211,106,.02)); font:500 12px 'Noto Sans KR'; align-items:baseline; }
  #rpgInv .gs b { font:900 17px 'Cinzel'; color:#ffe9b0; text-align:right; }
  #rpgInv .sts { display:grid; grid-template-columns:1fr 1fr; gap:3px 10px; font:500 11.5px 'Noto Sans KR'; color:#c9d6da; }
  #rpgInv .sts div { display:flex; justify-content:space-between; gap:4px; } #rpgInv .sts b { color:#fff; font-weight:700; } #rpgInv .sts em { font-style:normal; color:#8aff9a; font-size:10px; }
  #rpgInv .grid { display:grid; grid-template-columns:repeat(8, 46px); gap:5px; }
  #rpgInv .bar { display:flex; align-items:center; gap:7px; margin:8px 0; font:500 12px 'Noto Sans KR'; color:#c9d6da; } #rpgInv .bar span { flex:1; } #rpgInv .bar b { color:#fff; } #rpgInv .bar .full b { color:#ff8a8a; }
  .rdet { min-height:118px; padding:10px 12px; border-radius:6px; background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.06); display:flex; gap:12px; }
  .rdet .info { flex:1; min-width:0; } .rdet .acts { display:flex; flex-direction:column; gap:6px; }
  .rdet .nm { font:700 16px 'Gowun Batang'; } .rdet .ty { font:500 11px 'Noto Sans KR'; color:#9fb6c0; margin:1px 0 6px; }
  .rdet .m { font:500 13px 'Noto Sans KR'; color:#fff3d6; } .rdet .m b { font-weight:700; } .rdet .a { font:500 12px 'Noto Sans KR'; color:#8ac8ff; }
  .rdet .cmp { margin-top:6px; font:500 11.5px 'Noto Sans KR'; display:flex; flex-wrap:wrap; gap:2px 10px; } .rdet .up { color:#8aff9a; } .rdet .dn { color:#ff8a8a; }
  .rdet .warn { color:#ff8a8a; font:700 11.5px 'Noto Sans KR'; margin-top:4px; } .rdet .ds { font:400 12px/1.55 'Noto Sans KR'; color:#c9d6da; }
  .rdet .empty { margin:auto; color:#7a8a90; font:400 12px/1.7 'Noto Sans KR'; text-align:center; }
  @media (max-width:700px){ #rpgInv .inv { grid-template-columns:1fr; } #rpgInv .eqp { display:grid; grid-template-columns:1fr 1fr 1fr; } #rpgInv .who, #rpgInv .gs, #rpgInv .sts { grid-column:1 / -1; } .req small { display:none; }
    #rpgInv .grid { grid-template-columns:repeat(auto-fill, minmax(40px, 1fr)); } #rpgInv .grid .rslot { width:auto; height:auto; aspect-ratio:1; } .rdet { flex-direction:column; } .rdet .acts { flex-direction:row; flex-wrap:wrap; } }
  @media (max-height:520px) and (min-width:701px){ #rpgInv .grid { grid-template-columns:repeat(8, 38px); gap:4px; } #rpgInv .grid .rslot { width:38px; height:38px; font-size:19px; } .rdet { min-height:92px; padding:7px 10px; } #rpgInv .sts { display:none; } }
  .rtl .ti { display:grid; grid-template-columns:1fr auto auto; align-items:center; gap:10px; padding:8px 10px; border-radius:6px; background:rgba(255,255,255,.03); margin-bottom:5px; border:1px solid transparent; }
  .rtl .ti b { font:700 14px 'Gowun Batang'; color:#fff3d6; } .rtl .ti small { display:block; font:400 11px 'Noto Sans KR'; color:#9fb6c0; } .rtl .ti em { font-style:normal; font:600 11.5px 'Noto Sans KR'; color:#8aff9a; text-align:right; }
  .rtl .ti.lock { opacity:.45; } .rtl .ti.lock b { color:#c9d6da; } .rtl .ti.cur { border-color:#ffd36a; background:linear-gradient(90deg, rgba(255,211,106,.14), rgba(255,255,255,.02)); } .rtl .ti i { font-style:normal; }
  .rtl .ac { display:grid; grid-template-columns:1fr 150px; gap:4px 12px; align-items:center; padding:8px 10px; border-radius:6px; background:rgba(255,255,255,.03); margin-bottom:5px; }
  .rtl .ac b { font:700 14px 'Gowun Batang'; color:#fff3d6; } .rtl .ac small { display:block; font:400 11px 'Noto Sans KR'; color:#9fb6c0; } .rtl .ac.got b { color:#ffd36a; } .rtl .ac.got b::before { content:'🏆 '; }
  .rtl .ac .pb { height:6px; border-radius:3px; background:rgba(255,255,255,.08); overflow:hidden; } .rtl .ac .pb i { display:block; height:100%; background:linear-gradient(90deg,#b88cff,#ffe08a); }
  .rtl .ac .pv { font:700 11px 'Noto Sans KR'; color:#c9d6da; text-align:right; margin-top:2px; }
  #rpgQ { width:min(840px, 96vw); }
  #rpgQ .qw { display:grid; grid-template-columns:262px 1fr; gap:14px; }
  #rpgQ .ql { display:flex; flex-direction:column; gap:4px; min-width:0; }
  .rgrp { font:700 10px 'Cinzel'; letter-spacing:.35em; color:#7ff3ff; margin:8px 0 2px; } .rgrp:first-child { margin-top:0; }
  #rpgQ .qi { --c:#ffd36a; display:flex; align-items:center; gap:8px; padding:7px 9px; border-radius:5px; cursor:pointer; background:rgba(255,255,255,.03); border-left:3px solid var(--c); }
  #rpgQ .qi.on { background:color-mix(in srgb, var(--c) 16%, transparent); } #rpgQ .qi > div { flex:1; min-width:0; } #rpgQ .qi b { display:block; font:700 13px 'Gowun Batang'; color:#fff3d6; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #rpgQ .qi small { font:500 10.5px 'Noto Sans KR'; color:#9fb6c0; } #rpgQ .qi .st { font:900 12px 'Noto Sans KR'; color:#9aff9a; } #rpgQ .qi .tr { color:#ffd36a; font-size:12px; }
  #rpgQ .qi.av { border-left-style:dashed; opacity:.9; } #rpgQ .qi.lk { opacity:.45; }
  #rpgQ .qd { --c:#ffd36a; min-width:0; } #rpgQ .qd .k { font:700 10px 'Cinzel'; letter-spacing:.3em; color:var(--c); } #rpgQ .qd h3 { font:700 21px 'Gowun Batang'; color:#fff3d6; margin:2px 0 3px; }
  #rpgQ .qd .gv { font:500 12px 'Noto Sans KR'; color:#9fb6c0; } #rpgQ .qd .ds { font:400 13px/1.7 'Noto Sans KR'; color:#dfe8ea; margin:10px 0; padding:9px 12px; border-left:3px solid var(--c); background:rgba(255,255,255,.03); }
  #rpgQ .qd h4 { font:700 12px 'Gowun Batang'; color:#ffe9b0; margin:12px 0 5px; letter-spacing:.1em; }
  .rob div { display:flex; gap:8px; padding:3px 0; font:500 13px 'Noto Sans KR'; color:#e8e1cf; } .rob div::before { content:'◇'; color:#ffd36a; } .rob div.ok { color:#9aff9a; } .rob div.ok::before { content:'◆'; color:#9aff9a; } .rob div em { font-style:normal; margin-left:auto; font-weight:700; }
  .rrw { display:flex; flex-wrap:wrap; gap:6px; } .rrw span { padding:4px 10px; border-radius:12px; background:rgba(255,255,255,.05); border:1px solid rgba(233,200,126,.25); font:600 12px 'Noto Sans KR'; }
  #rpgQ .qd .acts { display:flex; gap:8px; margin-top:14px; flex-wrap:wrap; }
  #rpgQ .none { color:#7a8a90; text-align:center; padding:40px 10px; font:400 13px/1.8 'Noto Sans KR'; }
  @media (max-width:700px){ #rpgQ .qw { grid-template-columns:1fr; } }
  .rrow { display:flex; align-items:center; gap:10px; padding:6px 8px; border-radius:6px; background:rgba(255,255,255,.035); margin-bottom:5px; }
  .rrow .tx { flex:1; min-width:0; } .rrow .tx b { font:700 14px 'Gowun Batang'; color:#fff3d6; } .rrow .tx small { display:block; font:400 11px 'Noto Sans KR'; color:#9fb6c0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .rrow .pr { font:700 13px 'Noto Sans KR'; color:#ffe9b0; white-space:nowrap; } .rrow.lock { opacity:.42; } .rrow.on { outline:1px solid #ffd36a; background:rgba(255,211,106,.1); } .rrow .rslot { width:40px; height:40px; font-size:20px; }
  .rrow .need { font:500 11px 'Noto Sans KR'; color:#c9d6da; } .rrow .need .no { color:#ff8a8a; }
  #rpgShop { width:min(600px, 96vw); } #rpgBoard { width:min(680px, 96vw); }
  #rpgSmith { width:min(800px, 96vw); }
  #rpgSmith .sm { display:grid; grid-template-columns:1fr 320px; gap:14px; } #rpgSmith .lst { min-width:0; }
  @media (max-width:700px){ #rpgSmith .sm { grid-template-columns:1fr; } #rpgSmith .sm .side { order:-1; } }
  .anv { --c:#ffd36a; position:relative; height:160px; border-radius:8px; overflow:hidden; display:flex; align-items:center; justify-content:center; background:radial-gradient(ellipse at 50% 92%, rgba(255,120,40,.42), rgba(24,12,8,.95) 68%); border:1px solid rgba(255,160,80,.35); }
  .anv .base { position:absolute; bottom:14px; left:50%; width:150px; height:34px; transform:translateX(-50%); background:linear-gradient(180deg,#4a4f5a,#1c1f26); clip-path:polygon(0 0,100% 0,82% 45%,82% 100%,18% 100%,18% 45%); }
  .anv .it { position:relative; z-index:2; font-size:50px; margin-bottom:22px; filter:drop-shadow(0 0 14px var(--c)); transition:transform .1s; }
  .anv .lv { position:absolute; top:8px; left:0; right:0; text-align:center; font:900 26px 'Cinzel'; color:#ffe9b0; text-shadow:0 0 14px rgba(255,180,60,.8), 0 2px 0 #000; z-index:3; }
  .anv .hm { position:absolute; right:20%; top:20%; font-size:42px; transform-origin:85% 85%; transform:rotate(35deg); transition:transform .1s; z-index:3; }
  .anv.hit .hm { transform:rotate(-40deg); } .anv.hit .it { transform:scale(.9) translateY(3px); }
  .anv .sp { position:absolute; left:50%; top:58%; width:5px; height:5px; border-radius:50%; background:#fff2b0; box-shadow:0 0 8px #ffb030, 0 0 2px #fff; animation:rsp .65s ease-out forwards; z-index:4; pointer-events:none; }
  @keyframes rsp { to { transform:translate(var(--dx), var(--dy)) scale(.3); opacity:0; } }
  .anv .res { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; font:900 30px 'Gowun Batang'; opacity:0; z-index:5; text-shadow:0 2px 12px #000; pointer-events:none; }
  .anv .res small { font:700 13px 'Noto Sans KR'; margin-top:2px; }
  .anv.ok .res { opacity:1; color:#fff3c0; background:radial-gradient(circle, rgba(255,214,110,.6), transparent 66%); animation:rok .7s ease-out; }
  .anv.fail .res { opacity:1; color:#ffb0b0; background:radial-gradient(circle, rgba(255,40,40,.42), transparent 66%); } .anv.fail { animation:rshk .45s; }
  .anv.ok { box-shadow:0 0 30px rgba(255,214,110,.6) inset; }
  @keyframes rok { from { transform:scale(1.8); opacity:0; } } @keyframes rshk { 20% { transform:translateX(-9px); } 40% { transform:translateX(8px); } 60% { transform:translateX(-6px); } 80% { transform:translateX(4px); } }
  .enh { margin-top:10px; } .enh .cost small { font-weight:500; opacity:.7; }
  @media (max-height:560px){ .anv { height:118px; } .anv .it { font-size:38px; margin-bottom:16px; } .anv .hm { font-size:32px; } .anv .lv { font-size:21px; top:4px; } .anv .base { width:110px; height:26px; } .enh .ch { font-size:20px; margin:2px 0; } } .enh .nm { font:700 15px 'Gowun Batang'; text-align:center; } .enh .ch { text-align:center; font:900 24px 'Cinzel'; margin:4px 0; } .enh .ch small { font:600 12px 'Noto Sans KR'; color:#9fb6c0; display:block; }
  .enh .nx { display:grid; grid-template-columns:1fr auto 1fr; gap:2px 8px; font:500 12px 'Noto Sans KR'; color:#c9d6da; align-items:center; } .enh .nx b { color:#fff; } .enh .nx .up { color:#8aff9a; font-weight:700; }
  .enh .cost { display:flex; gap:6px; flex-wrap:wrap; justify-content:center; margin:8px 0; } .enh .cost span { padding:3px 9px; border-radius:12px; background:rgba(255,255,255,.05); font:700 12px 'Noto Sans KR'; } .enh .cost .no { color:#ff8a8a; border:1px solid rgba(255,100,100,.4); }
  .enh label { display:flex; gap:6px; align-items:center; justify-content:center; font:500 12px 'Noto Sans KR'; color:#c9d6da; margin-bottom:8px; cursor:pointer; } .enh .wr { text-align:center; font:500 11.5px 'Noto Sans KR'; color:#ffb070; margin-bottom:6px; }
  .rbq { --c:#9aff7a; display:grid; grid-template-columns:1fr auto; gap:6px 12px; padding:12px 14px; border-radius:8px; margin-bottom:8px; background:linear-gradient(90deg, rgba(255,255,255,.05), rgba(255,255,255,.015)); border-left:3px solid var(--c); }
  .rbq h4 { font:700 16px 'Gowun Batang'; color:#fff3d6; margin:0; } .rbq .ds { font:400 12px 'Noto Sans KR'; color:#c9d6da; } .rbq .act { grid-row:1 / span 3; grid-column:2; align-self:center; }
  .rbq.done { opacity:.55; } .rbq.done h4::after { content:' ✔'; color:#9aff9a; }
  .rbbon { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; border:1px dashed rgba(233,200,126,.45); font:500 12.5px 'Noto Sans KR'; color:#e8e1cf; } .rbbon b { color:#ffd36a; } .rbbon span { flex:1; }
  #rpgTrk { position:absolute; right:14px; top:300px; width:226px; display:none; flex-direction:column; gap:7px; pointer-events:none; z-index:5; transition:opacity .4s; }
  body[data-area="field"] #rpgTrk { display:flex; } body.cine #rpgTrk, body.shopping #rpgTrk { opacity:0; }
  #rpgTrk .t { --c:#ffd36a; pointer-events:auto; padding:6px 10px 7px; border-radius:6px 0 0 6px; text-align:right; cursor:pointer; background:linear-gradient(90deg, rgba(10,14,24,0), rgba(10,14,24,.72) 34%); border-right:2px solid var(--c); }
  #rpgTrk .t .k { font:700 8.5px 'Cinzel'; letter-spacing:.3em; color:var(--c); } #rpgTrk .t .n { font:700 13.5px 'Gowun Batang'; color:#fff3d6; text-shadow:0 1px 3px #000; }
  #rpgTrk .t .o { font:500 11.5px 'Noto Sans KR'; color:#d8e4e8; text-shadow:0 1px 2px #000; line-height:1.45; } #rpgTrk .t .o.ok { color:#9aff9a; opacity:.8; } #rpgTrk .t .o.go { color:#9aff9a; font-weight:700; }
  #rpgTrk .t.flash { animation:rtf .9s 2; } @keyframes rtf { 50% { background:linear-gradient(90deg, rgba(255,211,106,0), rgba(255,211,106,.35) 34%); } }
  @media (max-width:760px){ #rpgTrk { width:180px; } #rpgTrk .t .n { font-size:12.5px; } #rpgTrk .t .o { font-size:10.5px; } }
  #rpgTrk.tch { left:50%; right:auto !important; top:calc(max(8px, env(safe-area-inset-top)) + 2px) !important; transform:translateX(-50%); width:min(380px, 44vw); }
  #rpgTrk.tch .t { text-align:center; border-right:none; border-bottom:2px solid var(--c); border-radius:14px; background:rgba(10,14,24,.66); padding:3px 12px 4px; }
  #rpgTrk.tch .t .k { display:none; } #rpgTrk.tch .t .n { font-size:12.5px; } #rpgTrk.tch .t .o { font-size:11px; }
  body:has(#boss.on) #rpgTrk.tch { opacity:0; pointer-events:none; }
  #rpgNav { --c:#ffd36a; position:fixed; left:0; top:0; z-index:7; pointer-events:none; display:none; text-align:center; transform:translate(-50%,-50%); }
  #rpgNav i { display:block; width:13px; height:13px; margin:0 auto 3px; transform:rotate(45deg); background:var(--c); border:2px solid #fff8e0; box-shadow:0 0 12px var(--c); }
  #rpgNav b { display:block; font:700 11px 'Noto Sans KR'; color:#fff; text-shadow:0 1px 2px #000, 0 0 4px #000; white-space:nowrap; } #rpgNav u { display:block; font:900 16px 'Noto Sans KR'; color:var(--c); text-decoration:none; text-shadow:0 0 6px #000; line-height:1; }
  body.cine #rpgNav, body.shopping #rpgNav { opacity:0; }
  #rpgPot { position:absolute; bottom:49px; left:calc(50% - 238px); display:none; gap:6px; pointer-events:auto; z-index:6; }
  #rpgPot.on { display:flex; } body.cine #rpgPot, body.shopping #rpgPot { opacity:0; pointer-events:none; }
  #rpgPot .pt { position:relative; width:46px; height:46px; border-radius:9px; display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden; user-select:none; -webkit-user-select:none; touch-action:manipulation;
    background:radial-gradient(circle at 50% 30%, rgba(70,82,110,.88), rgba(10,14,24,.92)); border:2px solid rgba(233,200,126,.5); box-shadow:0 4px 14px rgba(0,0,0,.5); }
  #rpgPot .pt i { font-size:28px; font-style:normal; }
  #rpgPot .pt b { position:absolute; right:4px; bottom:1px; font:900 11px 'Noto Sans KR'; color:#fff; text-shadow:0 1px 2px #000; z-index:2; } #rpgPot .pt u { position:absolute; left:4px; top:1px; font:900 10px 'Cinzel'; color:#ffe9b0; text-decoration:none; z-index:2; }
  #rpgPot .pt s { position:absolute; left:0; right:0; bottom:0; height:0; background:rgba(0,0,0,.66); } #rpgPot .pt.none i { filter:grayscale(1) brightness(.5); } #rpgPot .hp { border-color:rgba(255,120,130,.6); } #rpgPot .mp { border-color:rgba(110,170,255,.6); }
  body.touch #rpgPot { left:auto; right:0; bottom:0; width:0; height:0; }
  body.touch #rpgPot .pt { position:absolute; width:44px; height:44px; border-radius:50%; } body.touch #rpgPot u { display:none; }
  body.touch #rpgPot .hp { right:256px; bottom:calc(22px + env(safe-area-inset-bottom)); } body.touch #rpgPot .mp { right:256px; bottom:calc(76px + env(safe-area-inset-bottom)); }
  #rpgCh { position:absolute; left:50%; bottom:calc(30% - 10px); transform:translateX(-50%); width:220px; text-align:center; display:none; pointer-events:none; }
  #rpgCh.on { display:block; } #rpgCh b { font:700 13px 'Gowun Batang'; color:#fff3d6; text-shadow:0 1px 3px #000; }
  #rpgCh div { height:8px; margin-top:5px; border-radius:4px; background:rgba(0,0,0,.6); border:1px solid rgba(233,200,126,.6); overflow:hidden; } #rpgCh div i { display:block; height:100%; width:0; background:linear-gradient(90deg,#8aff7a,#ffe08a); }
  #rpgLoot { --c:#5ab8ff; position:absolute; left:50%; bottom:calc(128px + env(safe-area-inset-bottom)); transform:translate(-50%, 16px); display:flex; gap:10px; align-items:center; padding:8px 18px 8px 10px; border-radius:8px; pointer-events:none;
    background:linear-gradient(90deg, rgba(10,14,24,.94), rgba(10,14,24,.78)); border:1px solid var(--c); box-shadow:0 0 22px color-mix(in srgb, var(--c) 45%, transparent); opacity:0; transition:opacity .3s, transform .3s; white-space:nowrap; }
  #rpgLoot.on { opacity:1; transform:translate(-50%, 0); } #rpgLoot i { font-style:normal; font-size:30px; filter:drop-shadow(0 0 8px var(--c)); }
  #rpgLoot small { display:block; font:700 9px 'Cinzel'; letter-spacing:.3em; color:var(--c); } #rpgLoot b { display:block; font:700 15px 'Gowun Batang'; color:#fff3d6; } #rpgLoot em { font-style:normal; font:500 11px 'Noto Sans KR'; color:#c9d6da; } #rpgLoot u { text-decoration:none; color:#8aff9a; font-weight:700; }
  #rpgBuff { position:absolute; left:14px; top:calc(max(14px, env(safe-area-inset-top)) + 106px); display:none; gap:6px; pointer-events:none; }
  #rpgBuff.on { display:flex; } #rpgBuff span { font:700 11px 'Noto Sans KR'; color:#fff3d6; padding:3px 9px; border-radius:12px; background:rgba(10,14,24,.72); border:1px solid rgba(160,220,255,.45); }
  body:not([data-area="field"]):not([data-area="story"]) #rpgBuff { top:calc(max(14px, env(safe-area-inset-top)) + 66px); } body.cine #rpgBuff, body.shopping #rpgBuff { opacity:0; }
  #card .rpgttl { font:700 10.5px 'Gowun Batang'; color:#ffd36a; letter-spacing:.06em; margin:0 0 1px; text-shadow:0 0 6px rgba(255,200,80,.45), 0 1px 2px #000; white-space:nowrap; } #card .rpgttl:empty { display:none; }
  #rpgRest { position:fixed; inset:0; z-index:29; background:#05070c; opacity:0; pointer-events:none; transition:opacity .8s; display:flex; align-items:center; justify-content:center; font:700 22px 'Gowun Batang'; color:#cfe0ff; letter-spacing:.4em; }
  #rpgRest.on { opacity:1; pointer-events:auto; }
  #ehp .d.gold { color:#ffd36a; font-size:14px; } #ehp .d.mana { color:#8ac8ff; }
  #dlg .ch:has(button:nth-child(4)) { flex-wrap:wrap; } #dlg .ch:has(button:nth-child(4)) button { flex:1 1 calc(50% - 10px); }
`;
document.head.appendChild(css);

// ───────────────────────── HUD 요소 ─────────────────────────
const trkEl = X.mk('div', 'rpgTrk', '', X.hud), navEl = X.mk('div', 'rpgNav', '<u></u><i></i><b></b>'), chEl = X.mk('div', 'rpgCh', '<b></b><div><i></i></div>', X.hud);
const lootEl = X.mk('div', 'rpgLoot', '', X.hud), buffEl = X.mk('div', 'rpgBuff', '', X.hud), restEl = X.mk('div', 'rpgRest', '쉬는 중 · · ·');
const potEl = X.mk('div', 'rpgPot', `<div class="pt hp" data-k="hp"><i>${potSVG('#ff3a5a', 1)}</i><b>0</b><u>H</u><s></s></div><div class="pt mp" data-k="mp"><i>${potSVG('#3a8aff', 1)}</i><b>0</b><u>G</u><s></s></div>`, X.hud);
for (const el of potEl.querySelectorAll('.pt')) el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); usePot(el.dataset.k); });
const cardTtl = document.createElement('div'); cardTtl.className = 'rpgttl'; { const nm = document.querySelector('#card .nm'); if (nm) nm.after(cardTtl); }
function renderCardTitle(){ const t = TITLES[S.titles.cur]; cardTtl.textContent = t ? `「${t.n}」` : ''; }
function lootCard(it){
  const rc = RAR[it.r], cur = S.inv.eq[it.s], better = wpnOk(it) && (!cur || gScore(it) > gScore(cur));
  lootEl.style.setProperty('--c', rc.c);
  lootEl.innerHTML = `<i>${gIcon(it)}</i><div><small>${rc.en} · ${rc.n}</small><b>${esc(it.n)}</b><em>${SLOT[it.s].n} · Lv.${it.il} · 장비 점수 ${gScore(it)}${better ? ' · <u>▲ 지금보다 좋아요</u>' : ''}</em></div>`;
  lootEl.classList.remove('on'); void lootEl.offsetWidth; lootEl.classList.add('on'); clearTimeout(lootEl._t); lootEl._t = setTimeout(() => lootEl.classList.remove('on'), 3400);
}
let potT = 0, potSig = '';
function updPotHud(force){
  const on = potMode(); if (potEl.classList.contains('on') !== on) potEl.classList.toggle('on', on);
  if (!on) return;
  const sig = `${cnt('hp1')}${cnt('hp2')}${cnt('hp3')}${cnt('hp4')}|${cnt('mp1')}${cnt('mp2')}${cnt('mp3')}${cnt('mp4')}`;
  for (const k of ['hp', 'mp']){ const el = potEl.querySelector('.' + k); el.querySelector('s').style.height = (potCd[k] / POTCD * 100) + '%';
    if (force || sig !== potSig){ const n = POT[k].reduce((s, id) => s + cnt(id), 0); el.querySelector('b').textContent = n; el.classList.toggle('none', !n); } }
  potSig = sig;
}
function renderBuff(){ const t = restLeft(); buffEl.classList.toggle('on', t > 0); if (t > 0) buffEl.innerHTML = `<span>🛏 휴식 보너스 ${Math.ceil(t / 60000)}분 · 경험치 +25%</span>`; }

// ───────────────────────── 창 공통 ─────────────────────────
let OPEN = null;
function mkWin(id, en, title, tabs, onTab){
  const w = X.mk('div', id, `<div class="hd"><span>${en}</span><b>${title}</b><div class="sp"></div><div class="gold">🪙 <b>0</b></div><button class="x" title="닫기 (Esc)">✕</button>${tabs ? `<div class="tabs">${tabs.map(t => `<button data-t="${t[0]}">${t[1]}</button>`).join('')}</div>` : ''}</div><div class="bd"></div>`);
  w.classList.add('rpgw'); w.querySelector('.x').onclick = () => closeWin();
  if (tabs) w.querySelector('.tabs').onclick = e => { const b = e.target.closest('button'); if (b){ X.sfx('ui'); onTab(b.dataset.t); } };
  return w;
}
const setTabs = (w, t) => { for (const b of w.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.t === t); };
function openWin(w, render){ if (OPEN && OPEN !== w) OPEN.classList.remove('on'); OPEN = w; w.classList.add('on'); goldDirty = true; render(); X.sfx('ui'); }
function closeWin(){ if (!OPEN) return; const w = OPEN; OPEN = null; w.classList.remove('on'); if (w === INV){ S.inv.seen = S.inv.uid; hov = null; } }
function renderGold(){ if (!goldDirty) return; goldDirty = false; for (const b of document.querySelectorAll('.rpgw .gold b')) b.textContent = fmt(S.gold || 0); }
const slotHTML = (d, extra = '') => {
  if (!d) return `<div class="rslot empty ${extra}"></div>`;
  if (d.g){ const g = d.g; return `<div class="rslot r${g.r} ${!wpnOk(g) || S.lv < lvReq(g) ? 'bad' : ''} ${extra}" style="--c:${RAR[g.r].c}"><i>${gIcon(g)}</i>${g.e ? `<span class="e">+${g.e}</span>` : ''}<span class="l">${g.il}</span></div>`; }
  const it = ITEMS[d.id]; return `<div class="rslot ${it.pot === 'mp' ? 'mp' : ''} ${extra}" style="--c:${it.c}"><i>${it.icon}</i><span class="n">${d.n ?? cnt(d.id)}</span></div>`;
};

// ───────────────────────── 가방 · 장비 창 (I) ─────────────────────────
const INV = mkWin('rpgInv', 'INVENTORY', '가방', [['bag', '🎒 가방'], ['title', '🎖 칭호'], ['ach', '🏆 업적']], t => { invTab = t; sel = null; renderInv(); });
let invTab = 'bag', sel = null, hov = null, DET = null, CELLS = [], confirmK = '', confirmT = 0;
const bagBtn = F.menu.add('🎒', '가방', () => toggleInv(), 'I');
function markNew(){ if (!(OPEN === INV)) bagBtn.classList.add('dot'); }
function toggleInv(tab){ if (OPEN === INV && !tab){ closeWin(); return; } if (tab) invTab = tab; bagBtn.classList.remove('dot'); sel = null; openWin(INV, renderInv); }
F.openInventory = tab => toggleInv(tab || 'bag');
const selRef = () => !sel ? null : sel.eq ? (S.inv.eq[sel.eq] ? { g: S.inv.eq[sel.eq], eq: sel.eq } : null) : sel.g ? (S.inv.bag.includes(sel.g) ? { g: sel.g } : null) : cnt(sel.id) ? { id: sel.id, n: cnt(sel.id) } : null;
function statLines(){
  const d = X.D(), m = MINE, e = v => v ? `<em>(${v > 0 ? '+' : ''}${v})</em>` : '';
  return [['공격력', Math.round(d.atk), e(Math.round(m.atk))], ['최대 HP', d.maxHp, e(Math.round(m.hp))], ['방어력', Math.round(d.def), e(Math.round(m.def))], ['치명타', Math.round(d.crit * 100) + '%', ''],
    ['공격 속도', Math.round(d.aspd * 100) + '%', ''], ['이동 속도', Math.round(d.spd * 100) + '%', ''], ['최대 MP', d.maxMp, e(Math.round(m.mp))], ['HP 재생', (d.regen || 0).toFixed(1) + '/초', '']]
    .map(([a, b, c]) => `<div><span>${a}</span><span><b>${b}</b>${c}</span></div>`).join('');
}
function gearInfo(g, eqd){
  const rc = RAR[g.r], k = ENH(g.e), cur = !eqd ? S.inv.eq[g.s] : null;
  let h = `<div class="nm" style="color:${rc.c}">${esc(gName(g))}</div><div class="ty">${rc.n} ${SLOT[g.s].n}${g.s === 'wpn' ? ` · ${JOBW[g.j].n} 전용` : ''} · 아이템 Lv.${g.il} · 장비 점수 ${gScore(g)}</div>`;
  for (const key in g.m) h += `<div class="m">${STN[key]} <b>${fmtStat(key, g.m[key] * k)}</b>${g.e ? ` <small style="color:#ffd36a">(강화 +${Math.round((k - 1) * 100)}%)</small>` : ''}</div>`;
  for (const [key, v] of g.a) h += `<div class="a">◆ ${STN[key]} ${fmtStat(key, v)}</div>`;
  if (cur && cur !== g){ const a = gearStats(g), b = gearStats(cur), keys = new Set([...Object.keys(a), ...Object.keys(b)]); let c = '';
    for (const key of keys){ const df = (a[key] || 0) - (b[key] || 0); if (Math.abs(df) < (PCT[key] ? 0.0005 : 0.05)) continue; c += `<span class="${df > 0 ? 'up' : 'dn'}">${df > 0 ? '▲' : '▼'} ${STN[key]} ${fmtStat(key, Math.abs(df)).slice(1)}</span>`; }
    const ds = gScore(g) - gScore(cur); h += `<div class="cmp"><span style="color:#9fb6c0">착용 중과 비교:</span>${c || '<span>차이 없음</span>'}<span class="${ds >= 0 ? 'up' : 'dn'}">점수 ${ds >= 0 ? '+' : ''}${ds}</span></div>`; }
  if (g.s === 'wpn' && g.j !== myJob()) h += `<div class="warn">⚠ ${JOBW[g.j].n} 전용 — 지금 직업으로는 능력치가 적용되지 않아요</div>`;
  if (S.lv < lvReq(g)) h += `<div class="warn">⚠ 착용 레벨 ${lvReq(g)} 필요</div>`;
  return h;
}
function detHTML(d){
  DET = d;
  if (!d) return `<div class="empty">아이템을 누르면 자세히 볼 수 있어요<br><small>더블클릭: 장착 / 사용 · 장비는 대장간에서 강화</small></div>`;
  if (d.g){ const g = d.g, dis = dismantleGet(g), ck = confirmK === 'dis' + g.u && confirmT > G.time;
    return `<div class="info">${gearInfo(g, d.eq)}</div><div class="acts">${d.eq ? '<button class="btn" data-a="unequip">해제</button>' : `<button class="btn" data-a="equip" ${S.lv < lvReq(g) ? 'disabled' : ''}>장착</button><button class="btn ${ck ? 'red' : 'sub'}" data-a="dis">${ck ? '정말 분해?' : `분해 💠${dis.stone}${dis.crystal ? ` 💎${dis.crystal}` : ''}`}</button>`}</div>`; }
  const it = ITEMS[d.id];
  return `<div class="info"><div class="nm" style="color:${it.c}">${it.icon} ${it.n} <small style="color:#c9d6da">×${cnt(d.id)}</small></div><div class="ty">${it.pot ? '물약' : '재료'} · 판매가 🪙${sellPrice(d)}</div><div class="ds">${it.d}</div></div>${it.pot ? '<div class="acts"><button class="btn" data-a="use">사용</button></div>' : ''}`;
}
function renderInv(){
  if (OPEN !== INV) return;
  setTabs(INV, invTab); renderGold(); const bd = INV.querySelector('.bd');
  if (invTab === 'title'){ bd.innerHTML = `<div class="rtl"><p class="note">칭호를 달면 이름 아래에 빛나고, 칭호마다 작은 능력치 보너스가 붙어요. (한 번에 하나만)</p>${Object.entries(TITLES).sort((a, b) => (S.titles.cur === b[0]) - (S.titles.cur === a[0]) || S.titles.own.includes(b[0]) - S.titles.own.includes(a[0])).map(([id, t]) => { const own = S.titles.own.includes(id), cur = S.titles.cur === id;
    return `<div class="ti ${own ? 'own' : 'lock'} ${cur ? 'cur' : ''}"><div><b>「${t.n}」</b><small>${t.d}</small></div><em>${bonusText(t.b)}</em>${own ? `<button class="btn ${cur ? 'sub' : ''}" data-ti="${cur ? '-' : id}">${cur ? '떼기' : '달기'}</button>` : '<i>🔒</i>'}</div>`; }).join('')}</div>`; return; }
  if (invTab === 'ach'){ bd.innerHTML = `<div class="rtl"><p class="note">업적을 이루면 칭호를 얻어요. 진행도는 자동으로 기록돼요.</p>${ACH.map(a => { const v = Math.min(getC(a.c), a.goal), got = !!S.ach.got[a.id];
    return `<div class="ac ${got ? 'got' : ''}"><div><b>${a.n}</b><small>${a.d} ${fmt(a.goal)} · 보상 칭호 「${TITLES[a.title].n}」</small></div><div><div class="pb"><i style="width:${v / a.goal * 100}%"></i></div><div class="pv">${fmt(v)} / ${fmt(a.goal)}</div></div></div>`; }).join('')}</div>`; return; }
  CELLS = [...S.inv.bag.map(g => ({ g })), ...stackIds().map(id => ({ id }))];
  const sr = selRef(), cells = [];
  for (let i = 0; i < Math.max(S.inv.slots, CELLS.length); i++){ const d = CELLS[i]; cells.push(d ? slotHTML(d, (sr && !sr.eq && ((d.g && d.g === sr.g) || (d.id && d.id === sr.id)) ? 'sel' : '') + (d.g && d.g.u > S.inv.seen ? ' new' : '')).replace('<div class="rslot', `<div data-c="${i}" class="rslot`) : slotHTML(null)); }
  const t = TITLES[S.titles.cur];
  bd.innerHTML = `<div class="inv"><div class="eqp"><div class="who"><b>${esc(X.jobName ? X.jobName() : '모험가')} · Lv.${S.lv}</b><small>${t ? `「${t.n}」` : '칭호 없음'}</small><div class="col">✨ 룬 정령 <b>${Object.keys(S.inv.spirits).length}</b>/${W.seeds} · 📦 보물 상자 <b>${Object.keys(S.inv.chests).length}</b>/${CHESTS.length || W.chests}</div></div>
    ${['wpn', 'arm', 'acc'].map(k => { const g = S.inv.eq[k]; return `<div class="req ${sr && sr.eq === k ? 'sel' : ''}" data-eq="${k}">${g ? slotHTML({ g }) : `<div class="rslot empty"><i style="opacity:.35">${SLOT[k].icon}</i></div>`}<div><div class="nm" style="color:${g ? RAR[g.r].c : '#7a8a90'}">${g ? esc(gName(g)) : SLOT[k].n + ' — 비어 있음'}</div><small>${g ? `${RAR[g.r].n} · Lv.${g.il} · 점수 ${gScore(g)}` : '가방에서 골라 장착하세요'}</small></div></div>`; }).join('')}
    <div class="gs"><span>장비 점수</span><b>${fmt(gearScore())}</b><span>⚔ 전투력</span><b>${fmt(X.power())}</b></div><div class="sts">${statLines()}</div></div>
    <div><div class="grid">${cells.join('')}</div>
    <div class="bar ${bagFree() <= 0 ? 'full' : ''}"><span>칸 <b>${bagUsed()}</b> / ${S.inv.slots}</span><button class="btn sub" data-a="sort">정렬</button><button class="btn sub" data-a="dis0">일반 장비 모두 분해</button></div>
    <div class="rdet">${detHTML(hov || sr)}</div></div></div>`;
  invDirty = false;
}
function updDet(){ const el = INV.querySelector('.rdet'); if (el) el.innerHTML = detHTML(hov || selRef()); }
function equip(g){
  if (g.s === 'wpn' && g.j !== myJob()){ X.toast('장착할 수 없어요', `${JOBW[g.j].n} 전용 무기예요`); return; }
  if (S.lv < lvReq(g)){ X.toast('레벨이 부족해요', `착용 레벨 ${lvReq(g)} 필요`); return; }
  const old = S.inv.eq[g.s]; removeGear(g); S.inv.eq[g.s] = g; if (old) S.inv.bag.push(old);
  sel = { eq: g.s }; hov = null; applyBonus(); X.sfx('clang'); X.save(); renderInv();
  F.note(`<span style="color:${RAR[g.r].c}">장착 — ${esc(gName(g))}</span>`, 2.2);
}
function unequip(k){ const g = S.inv.eq[k]; if (!g) return; if (bagFree() <= 0){ X.toast('가방이 가득 찼어요', '자리를 비운 뒤 해제하세요'); return; } S.inv.eq[k] = null; S.inv.bag.push(g); sel = { g }; applyBonus(); X.sfx('ui'); X.save(); renderInv(); }
function dismantle(g, quiet){ const d = dismantleGet(g); removeGear(g); addStack('stone', d.stone, true); if (d.crystal) addStack('crystal', d.crystal, true); if (!quiet){ X.sfx('clang'); F.note(`분해 — 💠 강화석 ×${d.stone}${d.crystal ? ` · 💎 룬 수정 ×${d.crystal}` : ''}`, 2.6); } return d; }
INV.querySelector('.bd').addEventListener('click', e => {
  const c = e.target.closest('[data-c]'), q = e.target.closest('[data-eq]'), a = e.target.closest('[data-a]'), ti = e.target.closest('[data-ti]');
  if (ti){ setTitle(ti.dataset.ti === '-' ? '' : ti.dataset.ti); X.sfx('pick'); renderInv(); return; }
  if (a){ const act = a.dataset.a, r = DET && (DET.eq ? (S.inv.eq[DET.eq] === DET.g ? DET : null) : DET.g ? (S.inv.bag.includes(DET.g) ? DET : null) : cnt(DET.id) ? DET : null);
    if (act === 'sort'){ const O = { wpn: 0, arm: 1, acc: 2 }; S.inv.bag.sort((x, y) => O[x.s] - O[y.s] || y.r - x.r || y.il - x.il || y.e - x.e); X.sfx('ui'); X.save(); renderInv(); return; }
    if (act === 'dis0'){ const L = S.inv.bag.filter(g => g.r === 0 && !g.e); if (!L.length){ X.hint('분해할 일반 장비가 없어요', 1.6); return; } let s = 0; for (const g of L) s += dismantle(g, true).stone; X.sfx('clang'); F.note(`일반 장비 ${L.length}개 분해 — 💠 ×${s}`, 3); sel = null; X.save(); renderInv(); return; }
    if (!r) return;
    if (act === 'equip') equip(r.g); else if (act === 'unequip') unequip(r.eq);
    else if (act === 'use'){ usePot(ITEMS[r.id].pot, r.id); renderInv(); }
    else if (act === 'dis'){ if (r.g.r >= 2 || r.g.e){ if (confirmK !== 'dis' + r.g.u || confirmT < G.time){ confirmK = 'dis' + r.g.u; confirmT = G.time + 3; updDet(); return; } } dismantle(r.g); sel = null; hov = null; X.save(); renderInv(); }
    return; }
  if (c){ const d = CELLS[+c.dataset.c]; if (!d) return; sel = d.g ? { g: d.g } : { id: d.id }; hov = null; X.sfx('ui'); if (d.g && d.g.u > S.inv.seen) S.inv.seen = Math.max(S.inv.seen, d.g.u); renderInv(); return; }
  if (q){ if (S.inv.eq[q.dataset.eq]){ sel = { eq: q.dataset.eq }; hov = null; X.sfx('ui'); renderInv(); } }
});
INV.querySelector('.bd').addEventListener('dblclick', e => { const c = e.target.closest('[data-c]'), q = e.target.closest('[data-eq]');
  if (c){ const d = CELLS[+c.dataset.c]; if (d && d.g) equip(d.g); else if (d && ITEMS[d.id].pot){ usePot(ITEMS[d.id].pot, d.id); renderInv(); } } else if (q) unequip(q.dataset.eq); });
INV.querySelector('.bd').addEventListener('mouseover', e => { if (G.IS_TOUCH || e.target.closest('.rdet')) return; const c = e.target.closest('[data-c]'), q = e.target.closest('[data-eq]'); const d = c ? CELLS[+c.dataset.c] : q && S.inv.eq[q.dataset.eq] ? { g: S.inv.eq[q.dataset.eq], eq: q.dataset.eq } : null;
  const nh = d ? (d.g ? d : { id: d.id }) : null; if ((nh && nh.g) !== (hov && hov.g) || (nh && nh.id) !== (hov && hov.id)){ hov = nh; updDet(); } });
INV.querySelector('.bd').addEventListener('mouseleave', () => { if (hov){ hov = null; updDet(); } });

// ───────────────────────── 퀘스트 로그 창 (L) ─────────────────────────
const QW = mkWin('rpgQ', 'QUEST LOG', '퀘스트', null);
const qBtn = F.menu.add('📜', '퀘스트', () => toggleQuests(), 'L');
let qSel = null;
function toggleQuests(id){ if (OPEN === QW && !id){ closeWin(); return; } if (id) qSel = id; qBtn.classList.remove('dot'); openWin(QW, renderQ); }
F.openQuests = id => toggleQuests(id);
const chLabel = q => q.ch == null ? '' : q.ch === 0 ? ' · 서장' : ` · 제 ${q.ch} 장`;
const KC = { main: '#ffd36a', side: '#7ff3ff', daily: '#9aff7a' }, KN = { main: '메인', side: '지역 의뢰', daily: '일일 의뢰' }, KE = { main: 'MAIN QUEST', side: 'SIDE QUEST', daily: 'DAILY QUEST' };
const sortQ = (a, b) => { const A = getQ(a), B = getQ(b), o = { main: 0, side: 1, daily: 2 }; return o[A.kind] - o[B.kind] || A.lv - B.lv; };
function availForLog(){
  const out = [], nm = nextMain();
  if (nm && !S.q.act[nm] && QD[nm].giver !== 'auto') out.push({ id: nm, lock: !qLvOk(QD[nm]) });
  for (const id in QD){ const q = QD[id]; if (q.kind !== 'side' || !qAvail(id)) continue; if (S.lv >= q.lv - 2) out.push({ id, lock: !qLvOk(q) }); }
  return out.sort((a, b) => (a.lock - b.lock) || QD[a.id].lv - QD[b.id].lv).slice(0, 10);
}
function rwHTML(q){
  const r = q.rw || {}, s = [`<span>✨ 경험치 ${fmt(qXP(q))}</span>`, `<span>🪙 ${fmt(qGold(q))}</span>`];
  for (const [id, n] of r.items || []) if (ITEMS[id]) s.push(`<span style="color:${ITEMS[id].c}">${ITEMS[id].icon} ${ITEMS[id].n} ×${n}</span>`);
  if (r.gear && RAR[r.gear.r] && SLOT[r.gear.s]) s.push(`<span style="color:${RAR[r.gear.r].c}">${r.gear.s === 'wpn' ? JOBW[myJob()].icon : SLOT[r.gear.s].icon} ${RAR[r.gear.r].n} ${SLOT[r.gear.s].n} (Lv.${r.gear.il})</span>`);
  if (r.title && TITLES[r.title]) s.push(`<span style="color:#ffd36a">🎖 칭호 「${TITLES[r.title].n}」</span>`);
  if (r.loot) s.push('<span style="color:#ffd36a">🎁 보너스 상자</span>');
  return `<div class="rrw">${s.join('')}</div>`;
}
const objHTML = (q, a) => `<div class="rob">${q.o.map((o, i) => { const n = objN(o), p = a ? Math.min(a.p[i] || 0, n) : 0, ok = a && p >= n; return `<div class="${ok ? 'ok' : ''}">${esc(objText(o))}${n > 1 ? `<em>${p} / ${n}</em>` : ok ? '<em>완료</em>' : ''}</div>`; }).join('')}</div>`;
function renderQ(){
  if (OPEN !== QW) return; renderGold();
  const act = Object.keys(S.q.act).filter(getQ).sort(sortQ), av = availForLog(), bd = QW.querySelector('.bd');
  if (!qSel || (!S.q.act[qSel] && !av.some(x => x.id === qSel))) qSel = act[0] || (av[0] && av[0].id) || null;
  const item = (id, cls, extra) => { const q = getQ(id); return `<div class="qi ${cls} ${qSel === id ? 'on' : ''}" style="--c:${KC[q.kind]}" data-q="${id}"><div><b>${esc(q.name)}</b><small>${KN[q.kind]} · Lv.${q.lv}${extra || ''}</small></div>${S.q.act[id] && qReady(id) ? '<span class="st">✔</span>' : ''}${S.q.track.includes(id) ? '<span class="tr">★</span>' : ''}</div>`; };
  let list = '';
  for (const k of ['main', 'side', 'daily']){ const L = act.filter(id => getQ(id).kind === k); if (L.length) list += `<div class="rgrp">${KE[k]}</div>` + L.map(id => item(id, '')).join(''); }
  if (av.length) list += '<div class="rgrp">AVAILABLE · 받을 수 있음</div>' + av.map(x => item(x.id, 'av' + (x.lock ? ' lk' : ''), ` · ${NPCN(QD[x.id].giver)}`)).join('');
  if (!list) list = '<div class="none">진행 중인 퀘스트가 없어요.<br>머리 위에 <b style="color:#ffd36a">!</b> 가 뜬 사람에게 말을 걸어 보세요.</div>';
  let det = '<div class="none">왼쪽에서 퀘스트를 골라 주세요.</div>';
  const q = qSel && getQ(qSel);
  if (q){ const a = S.q.act[qSel], tr = S.q.track.includes(qSel), reg = q.giver !== 'auto' && byId('npcs', q.giver) ? F.regionAt(...byId('npcs', q.giver).c) : null;
    det = `<div class="qd" style="--c:${KC[q.kind]}"><div class="k">${KE[q.kind]}${chLabel(q)} · LV.${q.lv}</div><h3>${esc(q.name)}</h3>
      <div class="gv">${q.kind === 'daily' ? '의뢰 게시판 (새싹 마을)' : `의뢰인 ${q.giver === 'auto' ? '— 이야기 흐름' : NPCN(q.giver)}${reg ? ` (${reg.name})` : ''}`} · ${q.auto ? '목표를 이루면 바로 완료' : `보고: ${q.kind === 'daily' ? '의뢰 게시판' : NPCN(q.to)}`}</div>
      <div class="ds">${esc(q.desc)}</div><h4>목표</h4>${objHTML(q, a)}<h4>보상</h4>${rwHTML(q)}
      ${!a && !qLvOk(q) ? `<p class="note" style="color:#ff9a8a;margin-top:10px">Lv.${q.lv} 부터 받을 수 있어요.</p>` : ''}
      ${!a ? `<p class="note" style="margin-top:10px">${q.kind === 'main' && q.giver === 'auto' ? '이전 이야기를 마치면 자동으로 시작돼요.' : `${NPCN(q.giver)}에게 말을 걸면 받을 수 있어요.`}</p>` : ''}
      <div class="acts">${a ? `<button class="btn ${tr ? 'sub' : ''}" data-qa="track">${tr ? '☆ 추적 해제' : '★ 추적하기'}</button>` : ''}${F.openWorldMap ? '<button class="btn sub" data-qa="map">🗺 지도 보기</button>' : ''}${a && q.kind !== 'main' ? '<button class="btn red" data-qa="drop">포기</button>' : ''}</div></div>`; }
  bd.innerHTML = `<div class="qw"><div class="ql">${list}</div>${det}</div>`;
}
QW.querySelector('.bd').addEventListener('click', e => {
  const qi = e.target.closest('[data-q]'), b = e.target.closest('[data-qa]');
  if (qi){ qSel = qi.dataset.q; X.sfx('ui'); renderQ(); return; }
  if (!b || !qSel) return;
  if (b.dataset.qa === 'track'){ const i = S.q.track.indexOf(qSel); if (i >= 0) S.q.track.splice(i, 1); else { S.q.track.unshift(qSel); S.q.track = S.q.track.slice(0, 3); } X.save(); trkDirty = true; renderQ(); }
  else if (b.dataset.qa === 'drop'){ if (b.dataset.cf){ abandonQuest(qSel); renderQ(); } else { b.dataset.cf = 1; b.textContent = '정말 포기?'; } }
  else if (b.dataset.qa === 'map'){ const t = qTarget(qSel); closeWin(); F.openWorldMap(); if (t) X.hint(`◆ 목표: ${t.label}`, 3); }
});

// ───────────────────────── 약초상 (상점) ─────────────────────────
const SHW = mkWin('rpgShop', 'HERB SHOP', '미라의 약초 가게', [['buy', '🧪 구매'], ['sell', '💰 판매'], ['craft', '⚗ 조합']], t => { shopTab = t; renderShop(); });
let shopTab = 'buy';
F.openShop = tab => { shopTab = tab || 'buy'; openWin(SHW, renderShop); };
const CRAFT = [
  { out: 'hp1', n: 2, need: [['herb', 2]], gold: 4 }, { out: 'mp1', n: 2, need: [['mushroom', 2]], gold: 4 },
  { out: 'hp2', n: 2, need: [['herb', 3], ['mushroom', 1]], gold: 14, lv: 8 }, { out: 'mp2', n: 2, need: [['mushroom', 3], ['herb', 1]], gold: 14, lv: 8 },
  { out: 'hp3', n: 2, need: [['herb', 5], ['ore', 1]], gold: 36, lv: 16 }, { out: 'mp3', n: 2, need: [['mushroom', 5], ['ore', 1]], gold: 36, lv: 16 },
  { out: 'hp4', n: 2, need: [['herb', 6], ['crystal', 1]], gold: 80, lv: 24 }, { out: 'mp4', n: 2, need: [['mushroom', 6], ['crystal', 1]], gold: 80, lv: 24 },
];
function renderShop(){
  if (OPEN !== SHW) return; setTabs(SHW, shopTab); renderGold(); const bd = SHW.querySelector('.bd'), g = S.gold || 0;
  if (shopTab === 'buy') bd.innerHTML = `<p class="note">「물약은 넉넉히! 모험가의 기본이죠~」 · 물약은 H / G 키로 마셔요.</p>` + [...POT.hp, ...POT.mp].map(id => { const it = ITEMS[id], lk = S.lv < it.lv;
    return `<div class="rrow ${lk ? 'lock' : ''}">${slotHTML({ id, n: cnt(id) })}<div class="tx"><b style="color:${it.c}">${it.n}</b><small>${lk ? `Lv.${it.lv} 부터 살 수 있어요` : it.d}</small></div><span class="pr">🪙 ${it.price}</span><button class="btn" data-buy="${id}:1" ${lk || g < it.price ? 'disabled' : ''}>1개</button><button class="btn sub" data-buy="${id}:5" ${lk || g < it.price * 5 ? 'disabled' : ''}>5개</button></div>`; }).join('');
  else if (shopTab === 'sell'){ const gear = S.inv.bag.slice().sort((a, b) => a.r - b.r || a.il - b.il), st = stackIds();
    bd.innerHTML = `<p class="note">착용 중인 장비는 팔 수 없어요. 강화한 장비는 더 비싸게 쳐 드려요!</p><div style="display:flex;gap:6px;margin-bottom:8px"><button class="btn sub" data-bulk="0">일반 장비 모두 팔기</button><button class="btn sub" data-bulk="1">고급 이하 모두 팔기</button></div>` +
      (gear.length + st.length ? gear.map(it => `<div class="rrow">${slotHTML({ g: it })}<div class="tx"><b style="color:${RAR[it.r].c}">${esc(gName(it))}</b><small>${RAR[it.r].n} ${SLOT[it.s].n} · Lv.${it.il} · 점수 ${gScore(it)}</small></div><span class="pr">🪙 ${fmt(sellPrice(it))}</span><button class="btn" data-sell="g:${it.u}">판매</button></div>`).join('') +
      st.map(id => `<div class="rrow">${slotHTML({ id })}<div class="tx"><b style="color:${ITEMS[id].c}">${ITEMS[id].n}</b><small>개당 🪙 ${sellPrice({ id })}</small></div><button class="btn" data-sell="s:${id}:1">1개</button><button class="btn sub" data-sell="s:${id}:${cnt(id)}">모두</button></div>`).join('') : '<div class="rdet"><div class="empty">팔 물건이 없어요</div></div>'); }
  else bd.innerHTML = `<p class="note">채집한 약초 · 빛버섯으로 물약을 달여요. 사는 것보다 훨씬 싸요!</p>` + CRAFT.map((c, i) => { const lk = S.lv < (c.lv || 1), ok = !lk && g >= c.gold && c.need.every(([id, n]) => cnt(id) >= n), it = ITEMS[c.out];
    return `<div class="rrow ${lk ? 'lock' : ''}">${slotHTML({ id: c.out, n: c.n })}<div class="tx"><b style="color:${it.c}">${it.n} ×${c.n}</b><small class="need">${lk ? `Lv.${c.lv} 부터` : c.need.map(([id, n]) => `<span class="${cnt(id) >= n ? '' : 'no'}">${ITEMS[id].icon} ${ITEMS[id].n} ${cnt(id)}/${n}</span>`).join(' · ')}</small></div><span class="pr">🪙 ${c.gold}</span><button class="btn" data-craft="${i}" ${ok ? '' : 'disabled'}>달이기</button></div>`; }).join('');
}
SHW.querySelector('.bd').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.buy){ const [id, n] = b.dataset.buy.split(':'), it = ITEMS[id], cost = it.price * +n; if ((S.gold || 0) < cost) return; if (!cnt(id) && bagFree() <= 0){ X.toast('가방이 가득 찼어요', '자리를 비워 주세요'); return; }
    addGold(-cost, true); addStack(id, +n, true); X.sfx('pick'); F.note(`구매 — ${it.n} ×${n}`, 2); }
  else if (b.dataset.sell){ const [k, a, n] = b.dataset.sell.split(':');
    if (k === 'g'){ const it = S.inv.bag.find(x => x.u === +a); if (!it) return; if ((it.r >= 3 || it.e >= 5) && !b.dataset.cf){ b.dataset.cf = 1; b.textContent = '정말?'; b.classList.add('red'); return; } removeGear(it); addGold(sellPrice(it), true); X.sfx('pick'); F.note(`판매 — ${esc(gName(it))} 🪙${fmt(sellPrice(it))}`, 2.2); }
    else { const q = Math.min(+n, cnt(a)); if (!q) return; takeStack(a, q); addGold(sellPrice({ id: a }) * q, true); X.sfx('pick'); } }
  else if (b.dataset.bulk){ const L = S.inv.bag.filter(it => it.r <= +b.dataset.bulk && !it.e); if (!L.length){ X.hint('팔 장비가 없어요', 1.5); return; } let s = 0; for (const it of L){ s += sellPrice(it); removeGear(it); } addGold(s, true); X.sfx('pick'); F.note(`장비 ${L.length}개 판매 — 🪙 ${fmt(s)}`, 3); }
  else if (b.dataset.craft){ const c = CRAFT[+b.dataset.craft]; if (!c.need.every(([id, n]) => cnt(id) >= n) || (S.gold || 0) < c.gold) return; for (const [id, n] of c.need) takeStack(id, n); addGold(-c.gold, true); addStack(c.out, c.n, true); X.sfx('shard'); F.note(`<span style="color:${ITEMS[c.out].c}">조합 — ${ITEMS[c.out].n} ×${c.n}</span>`, 2.4); }
  X.save(); renderShop();
});

// ───────────────────────── 대장간 (강화 · 제련 · 분해) ─────────────────────────
const SMW = mkWin('rpgSmith', 'FORGE', '도른의 대장간', [['enh', '⚒ 강화'], ['smelt', '🔥 제련'], ['dis', '🔨 분해']], t => { smTab = t; renderSmith(); });
let smTab = 'enh', smSel = null, smithBusy = false, smProt = false;
F.openSmith = tab => { smTab = tab || 'enh'; openWin(SMW, renderSmith); };
const ENH_P = [1, 1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.33, 0.27, 0.22, 0.17, 0.12, 0.08];   // 지금 단계 → 다음 단계 성공 확률
const enhCost = g => ({ gold: Math.round(40 * Math.pow(g.e + 1, 1.55) * (1 + g.il / 12)), stone: 1 + Math.floor(g.e / 3), crystal: g.e >= 7 ? g.e - 6 : 0 });
const allGear = () => [...['wpn', 'arm', 'acc'].map(k => S.inv.eq[k]).filter(Boolean), ...S.inv.bag.slice().sort((a, b) => gScore(b) - gScore(a))];
const isEq = g => ['wpn', 'arm', 'acc'].some(k => S.inv.eq[k] === g);
function enhPanel(g){
  if (!g) return '<div class="rdet"><div class="empty">강화할 장비를 골라 주세요</div></div>';
  const rc = RAR[g.r], k0 = ENH(g.e), k1 = ENH(g.e + 1), max = g.e >= 15;
  let h = `<div class="anv" style="--c:${rc.c}"><div class="lv">+${g.e}</div><div class="base"></div><div class="it">${gIcon(g)}</div><div class="hm">🔨</div><div class="res"></div></div><div class="enh"><div class="nm" style="color:${rc.c}">${esc(gName(g))}</div>`;
  if (max) return h + '<div class="ch" style="color:#ffd36a">MAX<small>더 이상 강화할 수 없어요. 전설이 되었군요.</small></div></div>';
  const p = ENH_P[g.e], c = enhCost(g), pc = p >= 0.9 ? '#8aff9a' : p >= 0.5 ? '#ffe08a' : p >= 0.25 ? '#ffb070' : '#ff7a7a';
  h += `<div class="ch" style="color:${pc}">${Math.round(p * 100)}%<small>+${g.e} → +${g.e + 1} 성공 확률</small></div><div class="nx">`;
  for (const key in g.m) h += `<span>${STN[key]}</span><b>${fmtStat(key, g.m[key] * k0)}</b><span class="up">→ ${fmtStat(key, g.m[key] * k1)}</span>`;
  h += `</div><div class="cost"><span class="${(S.gold || 0) < c.gold ? 'no' : ''}">🪙 ${fmt(c.gold)}</span><span class="${cnt('stone') < c.stone ? 'no' : ''}">💠 강화석 ×${c.stone} <small>(보유 ${cnt('stone')})</small></span>${c.crystal ? `<span class="${cnt('crystal') < c.crystal ? 'no' : ''}">💎 룬 수정 ×${c.crystal} <small>(보유 ${cnt('crystal')})</small></span>` : ''}</div>`;
  if (g.e >= 7) h += `<div class="wr">⚠ 실패하면 50% 확률로 단계가 1 내려가요</div><label><input type="checkbox" data-prot ${smProt && cnt('sseed') ? 'checked' : ''} ${cnt('sseed') ? '' : 'disabled'}> 🌱 정령의 씨앗으로 하락 방지 (보유 ${cnt('sseed')})</label>`;
  const can = (S.gold || 0) >= c.gold && cnt('stone') >= c.stone && cnt('crystal') >= c.crystal;
  return h + `<button class="btn big" data-enh ${can && !smithBusy ? '' : 'disabled'}>⚒ 강화하기</button></div>`;
}
function renderSmith(){
  if (OPEN !== SMW || smithBusy) return; setTabs(SMW, smTab); renderGold(); const bd = SMW.querySelector('.bd');
  if (smTab === 'enh'){ const L = allGear(); if (!smSel || !L.includes(smSel)) smSel = L[0] || null;
    bd.innerHTML = `<div class="sm"><div class="lst"><p class="note">「불은 거짓말 안 해. 쇠도.」 · +3 까지는 반드시 성공 · +8 부터 룬 수정 필요</p>${L.length ? L.map(g => `<div class="rrow ${g === smSel ? 'on' : ''}" data-g="${g.u}" style="cursor:pointer">${slotHTML({ g })}<div class="tx"><b style="color:${RAR[g.r].c}">${esc(gName(g))}</b><small>${isEq(g) ? '착용 중 · ' : ''}${RAR[g.r].n} ${SLOT[g.s].n} · Lv.${g.il} · 점수 ${gScore(g)}</small></div><span class="pr">+${g.e}</span></div>`).join('') : '<div class="rdet"><div class="empty">장비가 없어요. 사냥터에서 장비를 주워 오세요!</div></div>'}</div><div class="side">${enhPanel(smSel)}</div></div>`; }
  else if (smTab === 'smelt'){ const n3 = Math.floor(cnt('ore') / 3);
    bd.innerHTML = `<p class="note">광석은 녹여서 강화석으로. 모자라면 사 가도 돼. 비싸지만.</p>
      <div class="rrow">${slotHTML({ id: 'ore' })}<div class="tx"><b>철광석 3 → 💠 강화석 1</b><small>보유 철광석 ${cnt('ore')}개 · 수수료 🪙 5</small></div><button class="btn" data-sm="1" ${n3 && (S.gold || 0) >= 5 ? '' : 'disabled'}>1회</button><button class="btn sub" data-sm="${n3}" ${n3 && (S.gold || 0) >= 5 * n3 ? '' : 'disabled'}>모두 (${n3})</button></div>
      <div class="rrow">${slotHTML({ id: 'crystal' })}<div class="tx"><b>룬 수정 1 → 💠 강화석 3</b><small>보유 룬 수정 ${cnt('crystal')}개</small></div><button class="btn sub" data-cr="1" ${cnt('crystal') ? '' : 'disabled'}>1회</button></div>
      <div class="rrow">${slotHTML({ id: 'stone' })}<div class="tx"><b>강화석 사기</b><small>개당 🪙 60 · 보유 ${cnt('stone')}개</small></div><button class="btn" data-bs="1" ${(S.gold || 0) >= 60 ? '' : 'disabled'}>1개</button><button class="btn sub" data-bs="5" ${(S.gold || 0) >= 300 ? '' : 'disabled'}>5개</button></div>
      <div class="rrow">${slotHTML({ id: 'crystal' })}<div class="tx"><b>룬 수정 사기</b><small>개당 🪙 260 · 침식지 · 설원에서 캐면 공짜</small></div><button class="btn sub" data-bc="1" ${(S.gold || 0) >= 260 ? '' : 'disabled'}>1개</button></div>`; }
  else { const L = S.inv.bag.slice().sort((a, b) => a.r - b.r || a.il - b.il);
    bd.innerHTML = `<p class="note">안 쓰는 장비는 부숴서 강화석으로. 등급이 높을수록, 강화했을수록 많이 나와.</p><div style="display:flex;gap:6px;margin-bottom:8px"><button class="btn sub" data-dall="0">일반 모두 분해</button><button class="btn sub" data-dall="1">고급 이하 모두 분해</button></div>` +
      (L.length ? L.map(g => { const d = dismantleGet(g); return `<div class="rrow">${slotHTML({ g })}<div class="tx"><b style="color:${RAR[g.r].c}">${esc(gName(g))}</b><small>${RAR[g.r].n} ${SLOT[g.s].n} · Lv.${g.il}</small></div><span class="pr">💠 ${d.stone}${d.crystal ? ` 💎 ${d.crystal}` : ''}</span><button class="btn" data-dis="${g.u}">분해</button></div>`; }).join('') : '<div class="rdet"><div class="empty">가방에 장비가 없어요</div></div>'); }
}
function sparks(el, n, gold){ for (let i = 0; i < n; i++){ const s = document.createElement('i'); s.className = 'sp'; const a = rr(-Math.PI * 0.95, -Math.PI * 0.05), d = rr(40, gold ? 140 : 95); s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d * 0.9 + rr(-10, 30) + 'px'); if (gold) s.style.background = pick(['#fff2b0', '#ffd36a', '#ffffff']); s.style.animationDuration = rr(0.4, 0.8) + 's'; el.appendChild(s); setTimeout(() => s.remove(), 850); } }
async function doEnhance(g){
  if (smithBusy || !g || g.e >= 15) return; const c = enhCost(g);
  if ((S.gold || 0) < c.gold || cnt('stone') < c.stone || cnt('crystal') < c.crystal) return;
  const prot = smProt && g.e >= 7 && cnt('sseed') > 0;
  smithBusy = true; addGold(-c.gold, true); takeStack('stone', c.stone); if (c.crystal) takeStack('crystal', c.crystal); if (prot) takeStack('sseed', 1);
  const anv = SMW.querySelector('.anv'), btn = SMW.querySelector('[data-enh]'); if (btn) btn.disabled = true; goldDirty = true; renderGold();
  for (let i = 0; i < 3; i++){ await X.sleep(i ? 330 : 120); if (!anv.isConnected) break; anv.classList.add('hit'); X.sfx('clang'); sparks(anv, 8 + i * 6); setTimeout(() => anv.classList.remove('hit'), 110); }
  await X.sleep(380);
  const from = g.e, ok = R() < ENH_P[g.e]; let drop = false;
  if (ok) g.e++; else if (from >= 7 && !prot && R() < 0.5){ g.e--; drop = true; }
  const res = anv.querySelector('.res'), lv = anv.querySelector('.lv'); lv.textContent = `+${g.e}`;
  if (ok){ res.innerHTML = `+${g.e} 강화 성공!<small>${esc(g.n)}</small>`; anv.classList.add('ok'); X.sfx('level'); X.sfx('shard'); sparks(anv, 46, true);
    if (g.e >= 10){ const who = F.title() ? `「${F.title()}」 모험가` : '한 모험가'; F.chat(`⚒ ${who}님이 「+${g.e} ${g.n}」 강화에 성공했습니다!`, '대장간', 'sys'); bnr('ENHANCE', `+${g.e} 강화 성공!`, `${g.n} — 온 대륙에 소식이 퍼졌다`, false, 2.6); } }
  else { res.innerHTML = drop ? `강화 실패…<small>+${from} → +${g.e} 단계가 내려갔어요</small>` : `강화 실패…<small>${prot ? '🌱 정령의 씨앗이 단계를 지켜 줬어요' : '단계는 그대로예요'}</small>`; anv.classList.add('fail'); X.sfx('hurt'); X.sfx('die'); }
  BUS.emit('enhance', { item: g, ok, lvl: g.e }); qProgress('enhtry', {}); if (ok){ qProgress('enh', { lvl: g.e }); achMax('enh', g.e); }
  if (isEq(g)) applyBonus(); X.save();
  await X.sleep(1500);
  smithBusy = false; if (OPEN === SMW) renderSmith();
}
SMW.querySelector('.bd').addEventListener('click', e => {
  const row = e.target.closest('[data-g]'), b = e.target.closest('button');
  if (e.target.matches('[data-prot]')){ smProt = e.target.checked; return; }
  if (smithBusy) return;
  if (row && !b){ smSel = allGear().find(g => g.u === +row.dataset.g) || null; X.sfx('ui'); renderSmith(); return; }
  if (!b || b.disabled) return;
  if (b.hasAttribute('data-enh')){ doEnhance(smSel); return; }
  if (b.dataset.sm){ const n = +b.dataset.sm; for (let i = 0; i < n; i++){ if (cnt('ore') < 3 || (S.gold || 0) < 5) break; takeStack('ore', 3); addGold(-5, true); addStack('stone', 1, true); } X.sfx('clang'); F.note(`제련 — 💠 강화석 ×${n}`, 2.2); }
  else if (b.dataset.cr){ if (!takeStack('crystal', 1)) return; addStack('stone', 3, true); X.sfx('clang'); }
  else if (b.dataset.bs){ const n = +b.dataset.bs; if ((S.gold || 0) < 60 * n) return; addGold(-60 * n, true); addStack('stone', n, true); X.sfx('pick'); }
  else if (b.dataset.bc){ if ((S.gold || 0) < 260) return; addGold(-260, true); addStack('crystal', 1, true); X.sfx('pick'); }
  else if (b.dataset.dis){ const g = S.inv.bag.find(x => x.u === +b.dataset.dis); if (!g) return; if ((g.r >= 3 || g.e >= 5) && !b.dataset.cf){ b.dataset.cf = 1; b.textContent = '정말?'; b.classList.add('red'); return; } dismantle(g); }
  else if (b.dataset.dall){ const L = S.inv.bag.filter(g => g.r <= +b.dataset.dall && !g.e); if (!L.length){ X.hint('분해할 장비가 없어요', 1.5); return; } let s = 0; for (const g of L) s += dismantle(g, true).stone; X.sfx('clang'); F.note(`장비 ${L.length}개 분해 — 💠 ×${s}`, 3); }
  X.save(); renderSmith();
});

// ───────────────────────── 의뢰 게시판 (일일 의뢰) ─────────────────────────
const BDW = mkWin('rpgBoard', 'QUEST BOARD', '의뢰 게시판', null);
F.openBoard = () => { ensureDaily(); openWin(BDW, renderBoard); };
function renderBoard(){
  if (OPEN !== BDW) return; renderGold(); ensureDaily(); const dl = S.q.daily, bd = BDW.querySelector('.bd');
  const nDone = dl.list.filter(q => dl.done[q.id]).length;
  bd.innerHTML = `<p class="note">오늘의 의뢰 ${dl.list.length}개 · 매일 자정에 새로 붙어요. 셋 다 해결하면 보너스 상자를 드려요!</p>` + dl.list.map(q => { const a = S.q.act[q.id], done = dl.done[q.id], rdy = a && qReady(q.id);
    return `<div class="rbq ${done ? 'done' : ''}"><h4>${esc(q.name)}</h4><div class="ds">${esc(q.desc)}</div>${objHTML(q, a)}${rwHTML(q)}<div class="act">${done ? '<span style="color:#9aff9a;font:700 13px Noto Sans KR">완료</span>' : rdy ? `<button class="btn" data-bq="turn:${q.id}">보고하기</button>` : a ? '<button class="btn sub" disabled>진행 중</button>' : `<button class="btn" data-bq="take:${q.id}">수락</button>`}</div></div>`; }).join('') +
    `<div class="rbbon"><span>🎁 보너스 상자 — 오늘의 의뢰 <b>${nDone} / ${dl.list.length}</b></span>${dl.bonus ? '<span style="flex:none;color:#9aff9a">받음 ✔</span>' : `<button class="btn" data-bq="bonus" ${nDone >= dl.list.length ? '' : 'disabled'}>받기</button>`}</div>`;
}
BDW.querySelector('.bd').addEventListener('click', e => {
  const b = e.target.closest('[data-bq]'); if (!b || b.disabled) return; const [k, id] = b.dataset.bq.split(':');
  if (k === 'take') acceptQuest(id); else if (k === 'turn') completeQuest(id);
  else if (k === 'bonus' && !S.q.daily.bonus){ S.q.daily.bonus = true; F.giveLoot('daily'); X.sfx('level'); bnr('DAILY BONUS', '오늘의 의뢰 완수!', '보너스 상자를 열었다', false, 2.4); }
  X.save(); renderBoard();
});

// ───────────────────────── 퀘스트 데이터 ─────────────────────────
// o (목표) 종류: kill{key,n,reg,at} · elite{n,reg} · fboss{key} · gather{item,n,reg} · discover{id} · talk{npc,say} · raid{id} · fish{n} · glider · enh{lvl} · enhtry{n} · seed{n} · chest{n} · level{lvl} · custom{id}
//   + 이야기(saga): read{id} 읽을거리 · collect{id | [ids], n} 이야기 물건 줍기 · cleanse{id} 수호석에 룬 새기기 · sboss{id} 이야기 보스 · reach{c:[x,z], r} 그 자리에 가기
// giver 'auto' = 앞 퀘스트가 끝나면 저절로 시작 / auto: true = 목표를 이루면 바로 완료 / rw.xp = 그 레벨 필요 경험치의 몇 배
// 메인 사슬 = LORE 의 장 순서(chapter.n) → 파일 안 순서. 곁가지는 그 장이 시작돼야(첫 메인을 받아야) 받을 수 있어요 (gate).
const QD = {}, MAIN = [];
const kill = (key, n, reg, at, d) => ({ t: 'kill', key, n, reg, at, d }), gat = (item, n, reg, d) => ({ t: 'gather', item, n, reg, d }), disc = (id, d) => ({ t: 'discover', id, d });
const talk = (npc, d, say) => ({ t: 'talk', npc, d, say }), raid = (id, d) => ({ t: 'raid', id, d }), fboss = (key, d) => ({ t: 'fboss', key, d });
function defQ(kind, list){ for (const q of list){ q.kind = kind; q.to = q.to || q.giver; q.rw = q.rw || {}; if (kind === 'main'){ q.prev = MAIN[MAIN.length - 1] || null; if (q.prev) QD[q.prev].next = q.id; MAIN.push(q.id); } QD[q.id] = q; } }
// 정착지 주민: agora-towns 가 WORLD.npcs 에 넣어요. towns 가 없거나 빠뜨린 주민은 여기서 채워 퀘스트가 막히지 않게 (피규어는 saga 가 대신 세워요)
for (const L of LORE){ try { const st = L.settlement; for (const r of (st && st.residents) || []){ if (!r || !r.id || byId('npcs', r.id)) continue;
  W.npcs.push({ id: r.id, name: r.name, title: r.title, role: 'resident', resident: true, region: L.region, settlement: st.id, c: r.c, face: r.face || 0, look: r.look || {}, job: r.job, idle: r.idle, lines: r.lines, away: r.away }); } } catch (e){ console.error('[rpg] lore residents', L && L.region, e); } }
// 이야기 퀘스트 (lore/*.js) — 메인은 장 순서대로 한 줄, 곁가지는 따로. 칭호도 합쳐요.
const LQ = { main: [], side: [] };
for (const L of LORE){ try { const ch = L.chapter ? L.chapter.n : null, mains = (L.quests || []).filter(q => q && q.kind === 'main'), gate = mains[0] ? mains[0].id : null;
  for (const q of L.quests || []){ if (!q || !q.id || !LQ[q.kind] || QD[q.id] || LQ.main.some(x => x.id === q.id) || LQ.side.some(x => x.id === q.id)) continue;
    LQ[q.kind].push(Object.assign({}, q, { ch, reg: L.region, o: (q.o || []).slice() }, q.kind === 'side' && gate ? { gate } : {})); }
  if (L.titles) for (const id in L.titles) if (!TITLES[id]) TITLES[id] = L.titles[id]; } catch (e){ console.error('[rpg] lore quests', L && L.region, e); } }
defQ('main', LQ.main);
// 이야기 물체 색인 (목표 글 · 위치의 기본값 — saga 가 있으면 F.saga.target 이 먼저예요)
const LIDX = {};
const spName = sp => { const n = String(sp.note || '').split(/[(—,·]/)[0].trim(); return n && n.length <= 16 ? n : ({ windmill_gear: '풍차 톱니', black_seeds: '검은 씨앗', torn_cloak: '찢긴 망토', lost_toy: '잃어버린 장난감' })[sp.kind] || '이야기 물건'; };
for (const L of LORE){ try { for (const r of L.readables || []) LIDX[r.id] = { name: r.title, c: r.c }; for (const sp of L.setpieces || []) LIDX[sp.id] = { name: spName(sp), c: sp.c };
  if (L.keystone) LIDX[L.keystone.id] = { name: L.keystone.name, c: L.keystone.c }; for (const b of L.bosses || []) LIDX[b.id] = { name: b.name, c: b.c }; } catch (e){} }
const SAGA_K = { read: 'read', collect: 'picked', cleanse: 'cleansed', sboss: 'sboss' };
const sagaHas = (t, id) => !!(S.saga && S.saga[SAGA_K[t]] && S.saga[SAGA_K[t]][id]);
defQ('side', [
  { id: 's_fish', giver: 'chief', lv: 3, name: '낚시 입문', desc: '모험만 하다 보면 마음이 메마른다. 연못이나 호수에서 낚시를 해 보자.', o: [{ t: 'fish', n: 1, d: '물고기 한 마리 낚기' }],
    intro: [['chief', '모험만 하다 보면 마음이 메마르지. 마을 연못에서 낚시나 한번 해 보게.'], ['chief', '한 마리만 낚아 와도 대단한 거야! 낚시는 기다림의 예술이거든.']], end: [['chief', '허허, 손맛을 봤구먼! 그 표정이면 충분하네.']], rw: { items: [['hp1', 3]] } },
  { id: 's_temper', giver: 'smith', lv: 2, name: '첫 담금질', desc: '도른은 장비를 직접 강화해 보라고 한다. +3 까지는 반드시 성공한다.', o: [{ t: 'enh', lvl: 3, d: '아무 장비나 +3 까지 강화하기' }],
    intro: [['smith', '…장비는 두드릴수록 강해져. 너도 그렇고.'], ['smith', '아무 장비나 +3 까지 강화해 와. +3 까진 실패 안 해. 겁먹지 말고.']], mid: ['smith', '강화석이 모자라면 장비를 분해하거나 광석을 가져와.'], end: [['smith', '흠. 불꽃 보는 눈이 있군. 강화석 몇 개 챙겨 가. 다음부턴 확률 싸움이다.']], rw: { xp: 0.6, items: [['stone', 5]] } },
  { id: 's_herbs', giver: 'herbalist', lv: 2, name: '약초 심부름', desc: '미라는 초록 언덕의 약초를 캐다 달라고 한다. 반짝이는 풀이 약초다.', o: [gat('herb', 5, null, '약초 채집')],
    intro: [['herbalist', '손님~ 부탁 하나만 해도 될까요? 초록 언덕에서 약초 다섯 개만 캐다 주세요!'], ['herbalist', '반짝반짝 빛나는 풀이 약초예요. 가까이 가서 E 키! 쉽죠?']], end: [['herbalist', '와아, 싱싱해라! 약초는 제 가게 「조합」에서 물약으로 바꿀 수 있어요. 이건 수고비랑 시음용 물약!']], rw: { xp: 0.6, items: [['hp1', 5], ['mp1', 3]] } },
  { id: 's_boar', giver: 'rowan', lv: 8, name: '멧돼지 사냥', desc: '멧돼지 사냥터의 멧돼지들이 야영지 식량을 노린다.', o: [kill('boar', 8, 'woods', 'c_boar', '멧돼지 사냥터의 멧돼지 처치')],
    intro: [['rowan', '멧돼지 사냥터 녀석들이 야영지 식량을 노려. 여덟 마리.'], ['rowan', '돌진하기 전에 앞발로 땅을 긁어. 그때 옆으로 굴러.']], end: [['rowan', '깔끔하군. 오늘 저녁은 멧돼지 구이다.']], rw: { items: [['hp2', 3]] } },
  { id: 's_raccoon', giver: 'rowan', lv: 9, name: '너구리 소굴 소탕', desc: '너구리 소굴의 장난꾸러기들이 로완의 화살통을 훔쳐 갔다.', o: [kill('raccoon', 8, 'woods', 'c_raccoon', '너구리 소굴의 너구리 처치')],
    intro: [['rowan', '너구리 소굴 녀석들이 내 화살통을 훔쳐 갔어. …웃지 마.'], ['rowan', '여덟 마리쯤 혼내 주면 돌려주겠지.']], end: [['rowan', '화살통… 찾았다. 고맙다. 정말로.']], rw: { gear: { s: 'acc', il: 9, r: 1 } } },
  { id: 's_spore', giver: 'rowan', lv: 11, name: '버섯대공', desc: '버섯 숲 깊은 곳에서 포자왕 「버섯대공」이 깨어날 때가 있다.', o: [fboss('chief', '필드 보스: 버섯대공 처치')],
    intro: [['rowan', '버섯 숲 깊은 곳에서 「버섯대공」이 깨어날 때가 있어. 포자 왕이지.'], ['rowan', '나타났다는 소식이 들리면 바로 가. 혼자선 무리야.']], end: [['rowan', '버섯대공을…? 하. 너, 진짜 사냥꾼이구나.']], rw: { gear: { s: 'wpn', il: 12, r: 2 } } },
  { id: 's_mole', giver: 'morgana', lv: 12, name: '두더지 둔덕', desc: '두더지 둔덕의 두더지들이 모르가나의 약초밭 밑을 다 파헤쳤다.', o: [kill('mole', 8, 'swamp', 'c_mole', '두더지 둔덕의 두더지 처치')],
    intro: [['morgana', '두더지 둔덕 녀석들이 내 약초밭 밑을 다 파헤쳤어! 이히… 이히히… 화나서 웃음이 나네.'], ['morgana', '여덟 마리! 혼쭐을 내 주렴.']], end: [['morgana', '이히히! 이제 내 맨드레이크들이 편히 자겠구나.']], rw: { items: [['mp2', 4]] } },
  { id: 's_owl', giver: 'morgana', lv: 14, name: '마녀의 재료', desc: '모르가나는 새 물약 연구에 부엉이 깃털과 빛버섯이 필요하다고 한다.', o: [kill('owl', 6, 'swamp', 'c_owl', '부엉이 고목지의 부엉이 처치'), gat('mushroom', 6, 'swamp', '늪의 빛버섯 채집')],
    intro: [['morgana', '새 물약을 연구 중이야~ 부엉이 깃털 여섯이랑 빛버섯 여섯이 필요해.'], ['morgana', '부엉이 고목지의 녀석들은 밤눈이 밝으니 조심해. 위에서 덮친다고!']], end: [['morgana', '좋아, 좋아! 이걸로 뭘 만들지는… 비밀이야. 이히히.']], rw: { items: [['hp2', 3], ['sseed', 1]] } },
  { id: 's_queen', giver: 'morgana', lv: 15, name: '꿀단지 여제', desc: '늪 한가운데에 거대한 여왕벌 「꿀단지 여제」가 날아든다는 소문이다.', o: [fboss('queen', '필드 보스: 꿀단지 여제 처치')],
    intro: [['morgana', '늪 한가운데에 거대한 여왕벌이 날아든다는 소문 들었니? 「꿀단지 여제」 말이야.'], ['morgana', '그 꿀 한 방울이면 물약 백 병을 만들 수 있지! 잡아 오렴~']], end: [['morgana', '여제의 꿀! 황금빛이야! 이히히히, 부자가 됐어!']], rw: { gear: { s: 'arm', il: 16, r: 2 } } },
  { id: 's_hedge', giver: 'brick', lv: 17, name: '고슴도치 바위길', desc: '고슴도치들이 바위길을 데굴데굴 굴러다녀 광산 수레가 지나가지 못한다.', o: [kill('hedgehog', 8, 'canyon', 'c_hedgehog', '고슴도치 바위길의 고슴도치 처치')],
    intro: [['brick', '고슴도치 놈들이 바위길을 데굴데굴 굴러다녀서 수레가 못 지나가! 여덟 마리!'], ['brick', '굴러오면 옆으로 피해! 정면으로 받으면 쾅이야!']], end: [['brick', '길이 뚫렸다! 쾅! 수레야 달려라!']], rw: { items: [['stone', 3], ['hp3', 2]] } },
  { id: 's_bandit', giver: 'brick', lv: 19, name: '너구리 도적단', desc: '너구리 도적단이 브릭의 금괴를 털어 갔다.', o: [kill('raccoon', 10, 'canyon', 'c_bandit', '너구리 도적단 처치')],
    intro: [['brick', '너구리 도적단이 내 금괴를 털어 갔어! 열 마리! 아니, 다 잡아도 좋아!']], end: [['brick', '금괴가… 반은 먹었네? 너구리가 금을 먹나? …아무튼 고마워!']], rw: { gold: 900 } },
  { id: 's_tusk', giver: 'brick', lv: 20, name: '붉은 엄니', desc: '협곡 바닥에 멧돼지 왕 「붉은 엄니」가 나타난다.', o: [fboss('tusk', '필드 보스: 붉은 엄니 처치')],
    intro: [['brick', '협곡 바닥에 「붉은 엄니」라는 멧돼지 왕이 나타나! 그 녀석 엄니면 곡괭이 백 개는 만들 수 있다고!']], end: [['brick', '엄니다! 진짜 엄니야! 쾅쾅쾅!']], rw: { gear: { s: 'wpn', il: 21, r: 3 } } },
  { id: 's_starowl', giver: 'elin', lv: 22, name: '관측소의 불청객', desc: '관측소 지붕에 부엉이들이 둥지를 틀어 엘린이 망원경을 쓰지 못한다.', o: [kill('owl', 8, 'plateau', 'c_starowl', '관측소 부엉이 둥지의 부엉이 처치')],
    intro: [['elin', '관측소 지붕에 부엉이들이 둥지를 틀어서 망원경을 못 쓰고 있어요…'], ['elin', '여덟 마리만 쫓아내 주세요. 별이 안 보이면 연구도 못 해요!']], end: [['elin', '오늘 밤엔 별이 잘 보이겠어요! 정말 고마워요!']], rw: { items: [['mp3', 4]] } },
  { id: 's_spirits', giver: 'elin', lv: 20, name: '룬 정령의 노래', desc: '바위 꼭대기나 폭포 뒤, 다리 밑 같은 곳에 숨어 키득거리는 작은 빛 — 룬 정령을 찾아보자.', o: [{ t: 'seed', n: 3, d: '숨어 있는 룬 정령 찾기' }],
    intro: [['elin', '혹시 「룬 정령」을 아세요? 바위 꼭대기나 폭포 뒤, 다리 밑 같은 데 숨어서 키득키득 웃는 작은 빛이에요.'], ['elin', '세 마리만 찾아 주세요! 정령들은 옛 왕국의 노래를 기억하고 있대요.']], end: [['elin', '세 마리나! 정령을 셋 모을 때마다 저나 촌장님께 오세요. 특별한 보답을 드릴게요.']], rw: { items: [['sseed', 2]] } },
  { id: 's_shadow', giver: 'elin', lv: 23, name: '거상의 그늘', desc: '부서진 거상 그늘에 고슴도치와 골렘이 모여들어 엘린이 비문 탁본을 뜨지 못한다.', o: [kill('hedgehog', 6, 'plateau', 'c_colossus', '거상의 그늘의 고슴도치 처치'), kill('golem', 3, 'plateau', 'c_colossus', '거상의 그늘의 골렘 처치')],
    intro: [['elin', '부서진 거상 그늘에 고슴도치와 골렘이 모여들어요. 비문 탁본을 떠야 하는데…'], ['elin', '조금만 길을 열어 주세요!']], end: [['elin', '탁본 성공! 이 문양… 크라이오스? 서리의 용 이름이에요.']], rw: { gear: { s: 'acc', il: 24, r: 2 } } },
  { id: 's_purge', giver: 'eldra', lv: 25, name: '가시 정화', desc: '가시에 깊이 물든 정예들이 결계를 갉아먹는다.', o: [{ t: 'elite', n: 5, reg: 'blight', d: '침식지의 정예 몬스터 처치' }],
    intro: [['eldra', '가시에 깊이 물든 정예들은 결계를 갉아먹어요. 다섯을 정화해 주세요.']], end: [['eldra', '결계가 한층 단단해졌어요. 고맙습니다, 룬의 용사여.']], rw: { items: [['crystal', 3], ['sseed', 1]] } },
  { id: 's_yeti', giver: 'hermit', lv: 28, name: '설인 동굴', desc: '설인들이 오크의 장작을 훔쳐 간다.', o: [kill('yeti', 4, 'frost', 'c_yeti', '설인 동굴의 설인 처치')],
    intro: [['hermit', '설인. 넷. 내 장작을 훔친다.']], end: [['hermit', '…장작, 돌아왔다. 고맙다.'], ['hermit', '너는 이제 서리 방랑자다.']], rw: { gear: { s: 'arm', il: 29, r: 3 }, title: 'frost' } },
  { id: 's_spine', giver: 'hermit', lv: 26, name: '용의 등뼈', desc: '오크는 용의 등뼈 능선에 올라 바람을 읽어 보라고 한다.', o: [disc('spine', '용의 등뼈 능선에 오르기')],
    intro: [['hermit', '능선에 올라라. 용의 등뼈. 바람을 읽어라.']], end: [['hermit', '…바람이 뭐라던가. 됐다. 말 안 해도 안다.']], rw: { items: [['hp4', 2], ['stone', 4]] } },
  { id: 's_icefish', giver: 'hermit', lv: 26, name: '얼음 호수의 물고기', desc: '오크의 저녁거리를 낚아 오자.', o: [{ t: 'fish', n: 3, d: '물고기 세 마리 낚기' }],
    intro: [['hermit', '얼음 호수. 구멍 뚫고 낚아라. 셋.'], ['hermit', '…저녁거리다.']], end: [['hermit', '좋은 생선이다. (오크가 생선 하나를 건넨다… 아니, 다시 가져간다)']], rw: { items: [['mp4', 3]] } },
]);
defQ('side', LQ.side.filter(q => !QD[q.id]));
// 옛 저장: 없어진 퀘스트(옛 메인 m1~m21 · s_bee · s_king)는 진행 목록에서 걷어요 (완료 기록 S.q.done 은 그대로)
for (const id of Object.keys(S.q.act)) if (!QD[id] && !id.startsWith('d_')) delete S.q.act[id];
S.q.track = S.q.track.filter(id => QD[id] || id.startsWith('d_'));
{ const a = ACH.find(x => x.id === 'main'); if (a) a.goal = Math.max(1, MAIN.length); }
// NPC 인사말 (성격)
const GREET = {
  chief: ['허허, 오늘도 바람이 좋구먼.', '모험은 순조로운가? 무리하지 말게나.', '이 마을 슬라임들도 원래는 착했다네. 허허.'],
  smith: ['…흠. 뭘 두드려 줄까.', '불은 거짓말 안 해. 쇠도.', '강화석 챙겨 왔나?'],
  herbalist: ['어서 오세요~ 오늘은 뭐가 필요하세요?', '물약은 넉넉히! 모험가의 기본이죠!', '약초 캐 오시면 물약으로 달여 드려요~'],
  innkeeper: ['어서 와요, 지친 모험가님! 따끈한 수프랑 푹신한 침대가 있어요.', '얼굴이 반쪽이네요. 좀 쉬다 가요!', '오늘 수프는 버섯 수프예요. 빛버섯 말고 진짜 버섯!'],
  rowan: ['…쉿.', '숲이 시끄럽군.', '바람이 바뀌었어.'], morgana: ['이히히! 또 왔니?', '내 오두막 다리 귀엽지? 이히히.', '늪 냄새 좋지 않니?'],
  brick: ['쾅! 어서 와!', '오늘도 곡괭이가 신났어!', '하하하! 광부는 목소리가 커야 해!'], elin: ['별은 거짓말을 안 해요.', '아, 오셨어요? 잠깐만요, 이 책만…', '오늘 밤 하늘은 맑을 거예요!'],
  eldra: ['룬의 빛이 당신과 함께하길.', '문은 아직 굳건합니다.', '…바람에서 가시 냄새가 나요.'], hermit: ['…', '불 쬐라.', '…추우면 움직여라.'],
};
const LATER = { chief: '허허, 마음이 바뀌면 언제든 오게.', smith: '…그래.', herbalist: '네~ 언제든지요!', rowan: '…알았다.', morgana: '이히히, 겁쟁이~', brick: '쾅! 생각나면 와!', elin: '네, 천천히 생각해 보세요!', eldra: '기다리겠습니다.', hermit: '…' };

// ───────────────────────── 퀘스트 엔진 ─────────────────────────
const getQ = id => QD[id] || (S.q.daily && S.q.daily.list.find(q => q.id === id)) || null;
const objN = o => o.n || (o.t === 'collect' && Array.isArray(o.id) ? o.id.length : 1);
const objDone = (q, a, i) => (a.p[i] || 0) >= objN(q.o[i]);
const qReady = id => { const q = getQ(id), a = S.q.act[id]; return !!(q && a && q.o.every((o, i) => objDone(q, a, i))); };
const qAvail = id => { const q = QD[id]; return !!q && !S.q.act[id] && !S.q.done[id] && (!q.prev || !!S.q.done[q.prev]) && (!q.gate || !!S.q.act[q.gate] || !!S.q.done[q.gate]); };
const qLvOk = q => S.lv >= q.lv;
const nextMain = () => MAIN.find(id => !S.q.done[id]) || null;
const qXP = q => Math.round(need(Math.max(1, q.lv)) * (q.rw.xp ?? (q.kind === 'main' ? 0.55 : q.kind === 'side' ? 0.4 : 0.2)));
const qGold = q => q.rw.gold ?? Math.round((30 + q.lv * 20) * (q.kind === 'main' ? 1.3 : q.kind === 'daily' ? 0.8 : 1));
const monName = k => k === '*' ? '몬스터' : (X.MON[k] && X.MON[k].name) || (X.BOSS[k] && X.BOSS[k].name) || ({ wolf: '얼음 늑대', frostgolem: '서리 골렘', yeti: '설인', wraith: '가시 망령' })[k] || k;
function objText(o){
  if (o.d) return o.d;
  switch (o.t){
    case 'kill': return `${o.at && byId('camps', o.at) ? byId('camps', o.at).name + '의 ' : ''}${monName(o.key)} 처치`; case 'elite': return '정예 몬스터 처치'; case 'gather': return `${(ITEMS[o.item] || { n: '재료' }).n} 채집`;
    case 'discover': return `${(byId('landmarks', o.id) || {}).name} 찾아가기`; case 'talk': return `${NPCN(o.npc)}와 이야기하기`; case 'fish': return '물고기 낚기'; case 'seed': return '룬 정령 찾기';
    case 'chest': return '보물 상자 열기'; case 'enhtry': return '대장간에서 장비 강화하기'; case 'enh': return `장비를 +${o.lvl} 까지 강화하기`; case 'level': return `Lv.${o.lvl} 달성`;
    case 'raid': return `레이드 클리어`; case 'fboss': return '필드 보스 처치'; case 'glider': return '글라이더 얻기';
    // 이야기 목표 (d 가 없을 때) — 이름은 lore 에서
    case 'read': { const t = LIDX[o.id]; return t ? `「${t.name}」 읽기` : '기록 읽기'; } case 'collect': return '이야기 물건 줍기';
    case 'cleanse': { const t = LIDX[o.id]; return t ? `${t.name}에 룬 새기기` : '수호석에 룬 새기기'; } case 'sboss': { const t = LIDX[o.id]; return t ? `${t.name} 진정시키기` : '이야기 보스 처치'; }
    case 'reach': return '목적지에 가기';
  }
  return '목표';
}
let trkDirty = true, marksDirty = true, navT = null, flashQ = null;
function acceptQuest(id, quiet){
  const q = getQ(id); if (!q || S.q.act[id]) return;
  S.q.act[id] = { p: q.o.map(() => 0), t: Date.now() };
  S.q.track = [id, ...S.q.track.filter(x => x !== id)].slice(0, 3);
  BUS.emit('quest', { id, state: 'accept' });
  if (!quiet){ bnr(q.kind === 'main' ? 'MAIN QUEST' : q.kind === 'daily' ? 'DAILY QUEST' : 'NEW QUEST', q.name, objText(q.o[0]) + (q.o.length > 1 ? ` 외 ${q.o.length - 1}가지` : ''), false, 2.8); X.sfx('summon'); }
  flashQ = id; trkDirty = marksDirty = true; checkInstant(); X.save();
  if (OPEN === QW) renderQ(); if (OPEN === BDW) renderBoard();
}
function abandonQuest(id){ const q = getQ(id); if (!q || q.kind === 'main') return; delete S.q.act[id]; S.q.track = S.q.track.filter(x => x !== id); BUS.emit('quest', { id, state: 'abandon' }); trkDirty = marksDirty = true; X.save(); F.note(`퀘스트 포기 — ${esc(q.name)}`, 2.4); }
function completeQuest(id){
  const q = getQ(id); if (!q || !S.q.act[id]) return;
  delete S.q.act[id]; S.q.track = S.q.track.filter(x => x !== id);
  if (q.kind === 'daily') S.q.daily.done[id] = 1; else S.q.done[id] = Date.now();
  const xp = qXP(q), gold = qGold(q), r = q.rw;
  addGold(gold, true);
  for (const [iid, n] of r.items || []) receive({ id: iid, n });
  if (r.gear) receive({ g: makeGear(Object.assign({ j: myJob() }, r.gear)) });
  achAdd('quests', 1); BUS.emit('quest', { id, state: 'done' });
  bnr('QUEST COMPLETE', q.name, `✨ 경험치 +${fmt(xp)} · 🪙 +${fmt(gold)}`, false, 2.8); X.sfx('level'); X.sfx('shard');
  const py = X.mode === 'field' ? X.PY() : pp.y; X.burst(new V3(pp.x, py + 0.3, pp.z), 0xffe08a, 50, 3.5, 0.24, 1.2, 2, 4); X.shockwave(pp.x, py + 0.12, pp.z, 3.2, 0xffd36a, 0.7);
  X.later(2.9, () => { X.gainExp(xp); if (r.title) X.later(3, () => grantTitle(r.title)); });
  trkDirty = marksDirty = true; X.save();
  if (q.next && QD[q.next] && QD[q.next].giver === 'auto') X.later(3.6, checkAutoMain);
  else if (q.kind === 'main' && q.next) X.later(3.4, () => { const nq = QD[q.next]; if (nq && qLvOk(nq)) X.hint(`📜 다음 이야기: <b>${nq.name}</b> — ${NPCN(nq.giver)}에게 말을 걸어 보세요`, 5); });
  if (OPEN === QW) renderQ(); if (OPEN === BDW) renderBoard();
}
function checkAutoMain(){ const nm = nextMain(); if (!nm) return; const q = QD[nm]; if (q.giver === 'auto' && !S.q.act[nm] && qLvOk(q) && (!q.prev || S.q.done[q.prev])) acceptQuest(nm); }
function onReady(id, silent){
  const q = getQ(id); if (!q) return;
  if (q.auto){ X.later(0.6, () => completeQuest(id)); return; }
  if (!silent){ X.sfx('shard'); F.note(`<span style="color:#9aff9a">✔ ${esc(q.name)} — ${q.kind === 'daily' ? '의뢰 게시판' : NPCN(q.to)}에게 보고하세요</span>`, 4); X.hint(`✔ 퀘스트 목표 달성! <b>${q.kind === 'daily' ? '의뢰 게시판' : NPCN(q.to)}</b>에게 보고하세요`, 3.5); }
  flashQ = id; qBtn.classList.add('dot');
}
function match(o, d){
  const e = d.e, inReg = () => { if (!o.reg) return true; if (X.mode !== 'field' || !e) return false; const r = F.regionAt(e.pos.x, e.pos.z); return !!r && r.id === o.reg; };
  switch (o.t){
    case 'kill': return !!e && (o.key === '*' || (Array.isArray(o.key) ? o.key.includes(e.key) : o.key === e.key)) && inReg();
    case 'elite': return !!e && !!e.elite && inReg();
    case 'fboss': return o.key === '*' || d.key === o.key;
    case 'gather': return (o.item === '*' || o.item === d.item) && (!o.reg || d.reg === o.reg);
    case 'discover': return d.id === o.id; case 'talk': return d.npc === o.npc; case 'raid': return d.id === o.id; case 'custom': return d.id === o.id;
    case 'read': case 'cleanse': case 'sboss': return d.id === o.id;
    case 'collect': return Array.isArray(o.id) ? o.id.includes(d.id) : d.id === o.id;
    case 'enh': return (d.lvl || 0) >= o.lvl;
    case 'fish': case 'seed': case 'chest': case 'enhtry': return true;
  }
  return false;
}
function qProgress(type, d = {}){
  let ch = false;
  for (const id of Object.keys(S.q.act)){ const q = getQ(id), a = S.q.act[id]; if (!q) continue;
    q.o.forEach((o, i) => { const n = objN(o); if (o.t !== type || (a.p[i] || 0) >= n || !match(o, d)) return;
      const was = qReady(id); a.p[i] = Math.min(n, (a.p[i] || 0) + (d.n || 1)); ch = true;
      F.note(`<span style="color:${KC[q.kind]}">${esc(objText(o))} ${n > 1 ? `${a.p[i]}/${n}` : '✔'}</span>`, 2.2); BUS.emit('quest', { id, state: 'progress' });
      if (!was && qReady(id)) onReady(id); }); }
  if (ch){ trkDirty = marksDirty = true; dirty(); }
}
F.questEvent = (type, data) => qProgress(type, data || {});
// 한 번만 확인하면 되는 목표 (발견 · 레벨 · 글라이더 · 강화 · 이미 깬 레이드) — 모듈이 없으면 막히지 않게 통과
const modGone = k => F.ready && !F.modules[k];
function checkInstant(){
  const maxE = Math.max(0, ...allGear().map(g => g.e));
  for (const id of Object.keys(S.q.act)){ const q = getQ(id), a = S.q.act[id]; if (!q) continue;
    q.o.forEach((o, i) => { if (objDone(q, a, i)) return; let ok = false;
      if (o.t === 'discover'){ const l = byId('landmarks', o.id); ok = (F.discovered && F.discovered(o.id)) || (fieldOn() && l && Math.hypot(pp.x - l.c[0], pp.z - l.c[1]) < l.r); }
      else if (o.t === 'glider') ok = !!(S.field && S.field.glider) || modGone('world');
      else if (o.t === 'level') ok = S.lv >= o.lvl; else if (o.t === 'enh') ok = maxE >= o.lvl;
      else if (o.t === 'raid') ok = !!S.ach.c['r_' + o.id] || raidCleared(o.id) || modGone('raid');
      else if (o.t === 'fish') ok = modGone('minigames'); else if (o.t === 'fboss') ok = modGone('life');
      else if (o.t === 'reach') ok = fieldOn() && !!o.c && Math.hypot(pp.x - o.c[0], pp.z - o.c[1]) < (o.r || 8);
      else if (SAGA_K[o.t]){ // 이야기 목표: saga 가 이미 기록해 둔 것 (퀘스트 받기 전에 읽은 비석 등) — 줍기는 주운 개수만큼
        if (o.t === 'collect'){ const ids = Array.isArray(o.id) ? o.id : [o.id], n = Math.min(objN(o), ids.filter(x => sagaHas('collect', x)).length); if (n > (a.p[i] || 0)){ const was = qReady(id); a.p[i] = n; trkDirty = marksDirty = true; dirty(); if (!was && qReady(id)) onReady(id); } return; }
        ok = sagaHas(o.t, o.id); }
      if (!ok) return; const was = qReady(id); a.p[i] = objN(o); trkDirty = marksDirty = true; dirty();
      F.note(`<span style="color:${KC[q.kind]}">${esc(objText(o))} ✔</span>`, 2.2); if (!was && qReady(id)) onReady(id); }); }
}
// 퀘스트 목표 위치 (지도 표시 · 나침반)
function objTarget(o){
  if (SAGA_K[o.t]){ try { const t = F.saga && F.saga.target && F.saga.target(o); if (t) return t; } catch (e){}
    const ids = Array.isArray(o.id) ? o.id : [o.id]; for (const id of ids){ const t = LIDX[id]; if (t && t.c && !(o.t === 'collect' && sagaHas('collect', id))) return { x: t.c[0], z: t.c[1], label: t.name }; } return null; }
  switch (o.t){
    case 'reach': return o.c ? { x: o.c[0], z: o.c[1], label: o.d || '목적지' } : null;
    case 'kill': case 'elite': { let c = o.at && byId('camps', o.at);
      if (!c){ let bd = 1e9; for (const cp of W.camps){ if (o.reg && cp.region !== o.reg) continue; if (o.t === 'kill' && o.key !== '*' && !cp.mobs.some(m => m[0] === o.key)) continue; const d = Math.hypot(cp.c[0] - pp.x, cp.c[1] - pp.z); if (d < bd){ bd = d; c = cp; } } }
      if (c) return { x: c.c[0], z: c.c[1], label: c.name }; if (o.reg){ const r = F.regionById(o.reg); return { x: r.c[0], z: r.c[1], label: r.name }; } return null; }
    case 'gather': { let best = null, bd = 1e9; for (const nd of NODES){ if (!nd.live || GKIND[nd.k].item !== o.item || (o.reg && nd.reg !== o.reg)) continue; const d = Math.hypot(nd.x - pp.x, nd.z - pp.z); if (d < bd){ bd = d; best = nd; } } return best ? { x: best.x, z: best.z, label: GKIND[best.k].n } : null; }
    case 'discover': { const l = byId('landmarks', o.id); return l ? { x: l.c[0], z: l.c[1], label: l.name } : null; }
    case 'talk': { const n = byId('npcs', o.npc); return n ? { x: n.c[0], z: n.c[1], label: n.name } : null; }
    case 'fboss': { const b = W.fieldBosses.find(f => f.key === o.key); return b ? { x: b.c[0], z: b.c[1], label: b.name } : null; }
    case 'raid': { const r = byId('raids', o.id), l = r && byId('landmarks', r.entrance); return l ? { x: l.c[0], z: l.c[1], label: `${l.name} · 레이드` } : null; }
    case 'fish': { let best = null, bd = 1e9; for (const f of W.fishing){ const d = Math.hypot(f.c[0] - pp.x, f.c[1] - pp.z); if (d < bd){ bd = d; best = f; } } return best ? { x: best.c[0], z: best.c[1], label: '🎣 ' + best.name } : null; }
    case 'glider': { const n = byId('npcs', 'zephy'); return n ? { x: n.c[0], z: n.c[1], label: n.name } : null; }
    case 'enh': case 'enhtry': { const n = byId('npcs', 'smith'); return { x: n.c[0], z: n.c[1], label: n.name }; }
  }
  return null;
}
function qTarget(id){
  const q = getQ(id), a = S.q.act[id]; if (!q) return null;
  if (!a){ const n = byId('npcs', q.giver); return n ? { x: n.c[0], z: n.c[1], label: n.name } : null; }
  if (qReady(id) && !q.auto){ const n = byId('npcs', q.kind === 'daily' ? 'board' : q.to); return n ? { x: n.c[0], z: n.c[1], label: `${n.name} · 보고` } : null; }
  for (let i = 0; i < q.o.length; i++){ if (objDone(q, a, i)) continue; const t = objTarget(q.o[i]); if (t) return t; }
  return null;
}
// 일일 의뢰 (날짜마다 3개)
function ensureDaily(){
  const d = today(); if (S.q.daily && S.q.daily.day === d && S.q.daily.list) return;
  for (const id of Object.keys(S.q.act)) if (id.startsWith('d_')) delete S.q.act[id];
  S.q.track = S.q.track.filter(id => !id.startsWith('d_'));
  srand(hashS(d + '|' + S.lv)); const lv = S.lv, P = a => a[(SR() * a.length) | 0];
  const camps = W.camps.filter(c => c.lv[0] <= lv + 2 && c.lv[1] >= lv - 4), cp = camps.length ? P(camps) : W.camps[0], cp2 = camps.filter(c => c !== cp);
  const list = [{ name: `${cp.name} 토벌`, desc: `${cp.name}의 몬스터가 부쩍 늘어 길손들이 불안해한다. 수를 줄여 달라는 의뢰.`, o: [kill(cp.mobs[0][0], 10 + ((SR() * 6) | 0), cp.region, cp.id)] }];
  const reg = regByLv(lv), mat = { greenhill: 'herb', woods: 'herb', lake: 'herb', swamp: 'mushroom', canyon: 'ore', plateau: 'ore', blight: 'crystal', frost: 'crystal' }[reg.id] || 'herb';
  const pool = [{ name: `${ITEMS[mat].n} 납품`, desc: `새싹 마을 ${mat === 'herb' || mat === 'mushroom' ? '약초 가게' : '대장간'}에서 ${ITEMS[mat].n}이 급히 필요하다고 한다.`, o: [gat(mat, mat === 'crystal' ? 3 : 5)] },
    { name: '사냥터 순찰', desc: '어느 사냥터든 좋으니 몬스터를 물리쳐 길을 안전하게 지켜 달라는 의뢰.', o: [kill('*', 25, null, null, '아무 몬스터나 처치')] }];
  if (cp2.length){ const c = P(cp2); pool.push({ name: `${c.name} 정리`, desc: `${c.name} 근처를 지나던 상인이 습격을 받았다. 주변을 정리해 달라는 의뢰.`, o: [kill(c.mobs[0][0], 12, c.region, c.id)] }); }
  if (S.inv.bag.length || S.inv.eq.wpn) pool.push({ name: '대장간 단골', desc: '도른이 새 숫돌을 시험해 보고 싶어 한다. 장비 강화를 두 번 맡겨 보자.', o: [{ t: 'enhtry', n: 2 }] });
  if (lv >= 3 && F.modules.minigames) pool.push({ name: '오늘의 생선', desc: '여관 주인 베티가 저녁 수프에 넣을 생선을 찾는다.', o: [{ t: 'fish', n: 2 }] });
  if (lv >= 22) pool.push({ name: '정예 사냥', desc: '검은 가시에 물든 정예 몬스터를 쓰러뜨려 달라는 의뢰.', o: [{ t: 'elite', n: 2 }] });
  for (let i = pool.length - 1; i > 0; i--){ const j = (SR() * (i + 1)) | 0; const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
  list.push(...pool.slice(0, 2));
  S.q.daily = { day: d, done: {}, bonus: false, list: list.map((q, i) => Object.assign(q, { id: `d_${d}_${i}`, kind: 'daily', lv, giver: 'board', to: 'board', rw: { xp: 0.22, items: [['stone', 2]] } })) };
  marksDirty = true; X.save();
}

// ───────────────────────── NPC 대화 (퀘스트 · 대장간 · 상점 · 여관) ─────────────────────────
// 인사말: 이야기(saga)의 장별 대사 → 성격 인사 → 기본
const greetOf = (id, def) => { let g = null; try { g = F.greet && F.greet(id); } catch (e){} return g || pick(GREET[id] || [def || '좋은 하루예요, 모험가님.']); };
// svc = 다른 모듈이 맡은 NPC(글라이더 · 낚시 · 레이드 · 의상실)의 본래 대화 { label, fn } — 퀘스트 일이 없으면 그 대화로 바로 넘겨요
async function npcTalk(n, svc){
  const id = n.id; spk(id); let did = false;
  // ① 이 사람과 이야기하기 목표
  for (const qid of Object.keys(S.q.act)){ const q = getQ(qid), a = S.q.act[qid]; if (!q) continue;
    for (let i = 0; i < q.o.length; i++){ const o = q.o[i]; if (o.t !== 'talk' || o.npc !== id || a.p[i]) continue;
      if (o.say) await X.say(o.say); did = true; const was = qReady(qid); a.p[i] = 1; trkDirty = marksDirty = true; F.note(`<span style="color:${KC[q.kind]}">${esc(objText(o))} ✔</span>`, 2.2); BUS.emit('quest', { id: qid, state: 'progress' }); if (!was && qReady(qid)) onReady(qid, q.to === id); } }
  // ② 보고 (장의 마지막 이야기면 saga 가 장 끝 연출을 보여 준 뒤에 이어가요)
  for (const qid of Object.keys(S.q.act)){ const q = getQ(qid); if (!q || q.kind === 'daily' || q.auto || q.to !== id || !qReady(qid)) continue; if (q.end) await X.say(q.end); completeQuest(qid); did = true;
    if (F.saga && F.saga.afterQuest){ try { await F.saga.afterQuest(qid); } catch (e){ console.error('[rpg] saga afterQuest', e); } } await X.sleep(350); }
  // ③ 새 퀘스트 · 진행 중 대화 · 서비스
  const nm = nextMain(), opts = [];
  const avail = Object.keys(QD).filter(qid => QD[qid].giver === id && qAvail(qid) && (QD[qid].kind !== 'main' || qid === nm));
  for (const qid of avail.filter(x => qLvOk(QD[x])).slice(0, 2)) opts.push([`❗ ${QD[qid].name}`, () => offerQuest(qid)]);
  const prog = Object.keys(S.q.act).find(qid => { const q = getQ(qid); return q && q.giver === id && q.mid && !qReady(qid); });
  if (prog) opts.push([`💬 ${getQ(prog).name}`, () => X.say([getQ(prog).mid])]);
  const locked = avail.filter(x => !qLvOk(QD[x])).sort((a, b) => QD[a].lv - QD[b].lv)[0];
  if (svc){ if (!opts.length){ if (!did) await svc.fn(); else marksDirty = true; if (locked) X.hint(`📜 ${n.name}의 다음 이야기는 <b>Lv.${QD[locked].lv}</b> 부터`, 3.5); return; } opts.push([svc.label, svc.fn]); }
  if (n.role === 'smith') opts.push(['⚒ 장비 강화', () => F.openSmith('enh')], ['🔥 제련 · 분해', () => F.openSmith('smelt')]);
  if (n.role === 'shop') opts.push(['🧪 물약 사고팔기', () => F.openShop('buy')], ['⚗ 물약 조합', () => F.openShop('craft')]);
  if (n.role === 'inn') opts.push([`🛏 쉬어 가기 (🪙 ${restCost()})`, () => innRest(n)]);
  if ((id === 'chief' || id === 'elin') && spiritPts() > 0) opts.push(['✨ 룬 정령 보답', () => spiritExchange(id)]);
  if (!opts.length){ if (!did) await X.say([[id, greetOf(id)]]); if (locked) X.hint(`📜 ${n.name}의 다음 이야기는 <b>Lv.${QD[locked].lv}</b> 부터`, 3.5); marksDirty = true; return; }
  opts.push(['잘 있어요', null]);
  const r = await X.say([[id, greetOf(id, '무엇을 도와 드릴까요?'), opts.map(o => o[0])]]);
  if (opts[r] && opts[r][1]) await opts[r][1]();
  marksDirty = true;
}
async function offerQuest(qid){
  const q = QD[qid], L = (q.intro || [[q.giver, q.desc]]).map(l => l.slice(0, 2)); L[L.length - 1] = [L[L.length - 1][0], L[L.length - 1][1], ['수락한다', '나중에']];
  const r = await X.say(L);
  if (r === 0){ acceptQuest(qid);
    // 글라이더 목표를 바람 상인이 직접 주는 이야기면 받는 순간 건네줘요
    const gv = byId('npcs', q.giver); if (gv && gv.role === 'glider' && q.o.some(o => o.t === 'glider') && F.unlockGlider && !(S.field && S.field.glider)) X.later(0.4, () => F.unlockGlider()); }
  else await X.say([[q.giver, LATER[q.giver] || '알겠어요. 마음이 바뀌면 언제든 다시 와요.']]);
}
const restCost = () => 15 + S.lv * 6;
async function innRest(n){
  if ((S.gold || 0) < restCost()){ await X.say([[n.id, '어머, 지갑이 가볍네요. 외상은 안 돼요~ 사냥 좀 하고 와요!']]); return; }
  addGold(-restCost(), true); restEl.classList.add('on'); X.sfx('puff'); await X.sleep(1500);
  X.heal(1e9); X.restoreMp(1e9); S.inv.rest = Date.now() + 20 * 60000; applyBonus(); X.save(); restEl.classList.remove('on'); await X.sleep(500);
  bnr('RESTED', '푹 쉬었다!', '20분 동안 처치 경험치 +25% · HP 재생 증가', false, 3); X.sfx('level'); renderBuff();
}
const spiritPts = () => Math.floor(Object.keys(S.inv.spirits).length / 3) - (S.inv.spUsed || 0);
async function spiritExchange(id){
  const found = Object.keys(S.inv.spirits).length, pts = spiritPts(), ch = [];
  if (S.inv.slots < 80) ch.push('🎒 가방 +4칸'); ch.push('✦ 스탯 포인트 +1', '다음에');
  const r = await X.say([[id, id === 'chief' ? `허허, 룬 정령을 ${found}마리나 찾았다고? 정령 셋마다 마을의 보물을 하나씩 나눠 주지. (남은 보답 ${pts}번)` : `정령을 ${found}마리나! 셋마다 옛 왕국의 축복을 나눠 드릴게요. (남은 보답 ${pts}번)`, ch]]);
  const c = ch[r]; if (!c || c === '다음에') return;
  if (c.startsWith('🎒')){ S.inv.slots += 4; bnr('RUNE SPIRIT', '가방이 넓어졌다!', `가방 ${S.inv.slots}칸`, false, 2.4); }
  else { S.pts = (S.pts || 0) + 1; bnr('RUNE SPIRIT', '스탯 포인트 +1', 'C 키로 스탯을 올려 보세요', false, 2.4); X.refreshHud(); }
  S.inv.spUsed = (S.inv.spUsed || 0) + 1; X.sfx('level'); X.sfx('shard'); X.save();
}

// ───────────────────────── 필드 물체 공용: 정점색 병합 · 인스턴스 · 반짝이 ─────────────────────────
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new V3(), _sv = new V3();
const mat4 = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1, sy = s, sz = s) => new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(s, sy, sz));
// parts: [[geometry, color, Matrix4]] → 정점색이 든 지오메트리 하나 (각진 로우폴리 법선)
function cgeo(parts){
  let n = 0; const gs = parts.map(([g, c, m]) => { const q = g.index ? g.toNonIndexed() : g.clone(); q.applyMatrix4(m); q.computeVertexNormals(); n += q.attributes.position.count; return [q, new THREE.Color(c)]; });
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
  for (const [q, c] of gs){ const k = q.attributes.position.count; P.set(q.attributes.position.array, o * 3); N.set(q.attributes.normal.array, o * 3); for (let i = 0; i < k; i++){ C[(o + i) * 3] = c.r; C[(o + i) * 3 + 1] = c.g; C[(o + i) * 3 + 2] = c.b; } o += k; q.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 3)); out.computeBoundingSphere(); return out;
}
function setInst(mesh, i, x, y, z, ry, s, sy = s){ _e.set(0, ry, 0); _q.setFromEuler(_e); _v.set(x, y, z); _sv.set(s, sy, s); _m4.compose(_v, _q, _sv); mesh.setMatrixAt(i, _m4); }
const BASE_M = G.std({ vertexColors: true, roughness: 0.82, flatShading: true });
const GLOW_VM = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
function instMesh(geo, mat, n){ const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); m.count = n; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; FW.add(m); return m; }
// 반짝이 점 (채집물 · 상자 · 정령 오라) — 한 번에 그려요
function sparkles(n, size, soft){
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), on = new Float32Array(n), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) ph[i] = R() * 50;
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); g.setAttribute('aOn', new THREE.BufferAttribute(on, 1)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({ uniforms: { uT: UT, uS: { value: size * G.renderer.getPixelRatio() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `attribute vec3 aCol; attribute float aOn; attribute float aPh; uniform float uT; uniform float uS; varying vec3 vC; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position + vec3(0.0, sin(uT * 1.7 + aPh) * 0.12, 0.0), 1.0); float d = -mv.z; float tw = 0.5 + 0.5 * sin(uT * 3.3 + aPh * 7.0);
        vA = aOn * smoothstep(75.0, 45.0, d) * (0.4 + 0.6 * tw); vC = aCol; gl_PointSize = uS * (0.8 + 0.5 * tw) / max(d, 1.5); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 p = gl_PointCoord - 0.5; float r = length(p); float a = smoothstep(0.5, 0.0, r);
      float st = max(0.0, 1.0 - abs(p.x) * 16.0) * max(0.0, 1.0 - abs(p.y) * 2.2) + max(0.0, 1.0 - abs(p.y) * 16.0) * max(0.0, 1.0 - abs(p.x) * 2.2);
      gl_FragColor = ${soft ? 'vec4(vC * (a * 1.4 + st * 0.6), (a * a * 0.85 + st * 0.5) * vA)' : 'vec4(vC * (a * a * 0.9 + st), (a * a * 0.6 + st) * vA)'}; }` });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 4; FW.add(pts);
  return { pts, pos, col, on, set(i, x, y, z, c, o){ pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; if (c != null){ _c.setHex(c); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; } if (o != null) on[i] = o; },
    dirty(){ g.attributes.position.needsUpdate = true; g.attributes.aOn.needsUpdate = true; g.attributes.aCol.needsUpdate = true; } };
}
const _c = new THREE.Color();
const KEEP = [...W.npcs.map(n => n.c), ...W.waypoints.map(w => w.c), ...W.fishing.map(f => f.c)];
function okSpot(x, z, regId, maxSl, gap, list){
  if (Math.abs(x) > HALF - 110 || Math.abs(z) > HALF - 110) return false;
  const r = F.regionAt(x, z); if (!r || r.id !== regId) return false;
  if (F.isWater(x, z) || F.slope(x, z) > maxSl) return false;
  if (F.roadDist && F.roadDist(x, z) < 3.5) return false;
  for (const l of W.landmarks) if (Math.hypot(x - l.c[0], z - l.c[1]) < l.r * 0.75) return false;
  for (const c of KEEP) if (Math.hypot(x - c[0], z - c[1]) < 7) return false;
  for (const o of list) if (Math.hypot(x - o.x, z - o.z) < gap) return false;
  return true;
}

// 건물 · 바위 충돌체 안에 박힌 물체를 처음 가까이 갔을 때 밖으로 밀어내요 (충돌 격자는 플레이어 주변만 들고 있어서 그때 확인해요)
function unstick(o, rad){
  if (G.area !== 'field' || o.y - F.H(o.x, o.z) > 1.4) return false;   // 발판 위(그루터기 · 판자길)는 그대로
  const L = F.area && F.area.col; if (!L) return false; let x = o.x, z = o.z;
  for (let k = 0; k < 3; k++) for (const c of L){ if (c === o.col) continue; const dx = x - c.x, dz = z - c.z;
    if (c.t === 'c'){ const d = Math.hypot(dx, dz), m = c.r + rad; if (d < m && d > 1e-5){ x = c.x + dx / d * m; z = c.z + dz / d * m; } continue; }
    const lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c; if (Math.abs(lx) > c.hw + rad || Math.abs(lz) > c.hd + rad) continue;
    const px = c.hw + rad - Math.abs(lx), pz = c.hd + rad - Math.abs(lz), nx = px < pz ? Math.sign(lx || 1) * (c.hw + rad) : lx, nz = px < pz ? lz : Math.sign(lz || 1) * (c.hd + rad);
    x = c.x + nx * c.c + nz * c.s; z = c.z - nx * c.s + nz * c.c; }
  if (Math.hypot(x - o.x, z - o.z) < 0.02) return false; o.x = x; o.z = z; return true;
}

// ───────────────────────── 채집물 (약초 · 빛버섯 · 광맥 · 룬 수정) ─────────────────────────
const GKIND = {
  herb: { n: '약초', item: 'herb', title: '🌿 약초 캐기', t: 1.1, col: 0xc8ff9a, up: 0.75, sl: 0.5 },
  mushroom: { n: '빛버섯', item: 'mushroom', title: '🍄 빛버섯 따기', t: 1.1, col: 0x8af4ff, up: 0.6, sl: 0.6 },
  ore: { n: '광맥', item: 'ore', title: '⛏️ 광석 캐기', t: 1.6, col: 0xffc070, up: 1.0, sl: 0.95 },
  crystal: { n: '룬 수정', item: 'crystal', title: '💎 룬 수정 캐기', t: 1.8, col: 0xd8a8ff, up: 1.25, sl: 0.85 },
};
// 모양 (원점 = 땅) — [밑동(빛 안 남) parts, 빛나는 parts]
function nodeModel(k){
  const B = [], L = [], cyl = (a, b, h, s = 6) => new THREE.CylinderGeometry(a, b, h, s), sph = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
  if (k === 'herb'){
    for (let i = 0; i < 7; i++){ const a = i / 7 * TAU + 0.3, m = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationZ(0.55 + (i % 2) * 0.2)).multiply(new THREE.Matrix4().makeTranslation(0, 0.26, 0)).multiply(new THREE.Matrix4().makeScale(1, 1, 0.35));
      B.push([new THREE.ConeGeometry(0.09, 0.55, 4), [0x4fae3a, 0x67c44a, 0x3f9a34][i % 3], m]); }
    for (let i = 0; i < 3; i++){ const a = i / 3 * TAU, x = Math.cos(a) * 0.07, z = Math.sin(a) * 0.07, h = 0.5 + i * 0.08;
      B.push([cyl(0.012, 0.016, h, 4), 0x3a8a2a, mat4(x, h / 2, z, Math.sin(a) * 0.15, 0, Math.cos(a) * 0.15)]); L.push([sph(0.06), [0xfff6c8, 0xd8f0ff, 0xffd0f0][i], mat4(x + Math.cos(a) * 0.04, h, z + Math.sin(a) * 0.04)]); }
  } else if (k === 'mushroom'){
    for (const [x, z, h, r, c] of [[0, 0, 0.34, 0.18, 0x5ff0e0], [0.17, 0.06, 0.22, 0.12, 0x7ad8ff], [-0.13, 0.1, 0.17, 0.09, 0xb08aff], [0.04, -0.16, 0.13, 0.07, 0x5ff0e0]]){
      B.push([cyl(r * 0.32, r * 0.42, h, 6), 0xeee0c8, mat4(x, h / 2, z)]); L.push([new THREE.SphereGeometry(r, 9, 5, 0, TAU, 0, Math.PI / 2), c, mat4(x, h - r * 0.15, z, 0, 0, 0, 1, 0.75, 1)]); }
  } else if (k === 'ore'){
    B.push([new THREE.IcosahedronGeometry(0.55, 0), 0x9a8a76, mat4(0, 0.28, 0, 0.2, 0.4, 0.1, 1.15, 0.72, 1)], [new THREE.IcosahedronGeometry(0.32, 0), 0x86786a, mat4(0.5, 0.15, 0.2, 0.5, 1, 0)], [new THREE.IcosahedronGeometry(0.22, 0), 0x8e806e, mat4(-0.45, 0.1, -0.3, 0.3, 2, 0)]);
    for (let i = 0; i < 9; i++){ const a = i / 9 * TAU + 0.2, rx = Math.cos(a), rz = Math.sin(a), top = i % 3 === 0, rad = top ? 0.2 : 0.46;
      L.push([new THREE.OctahedronGeometry(top ? 0.13 : 0.11, 0), [0xffb040, 0xffe07a, 0xffc860][i % 3], mat4(rx * rad, top ? 0.52 : 0.26 + (i % 2) * 0.1, rz * rad * 0.85, rz * (top ? 0.25 : 0.7), 0, -rx * (top ? 0.25 : 0.7), 0.75, 1.9, 0.75)]); }
  } else {
    B.push([new THREE.IcosahedronGeometry(0.38, 0), 0x3a3448, mat4(0, 0.12, 0, 0, 0, 0, 1.2, 0.5, 1.1)]);
    for (let i = 0; i < 6; i++){ const a = i / 6 * TAU, h = i ? 0.45 + (i % 3) * 0.16 : 1.0, tilt = i ? 0.42 : 0, rx = i ? Math.cos(a) * 0.18 : 0, rz = i ? Math.sin(a) * 0.18 : 0, c = [0xc89aff, 0x8ad8ff, 0xe0b0ff][i % 3];
      const m = new THREE.Matrix4().makeTranslation(rx, 0.12, rz).multiply(new THREE.Matrix4().makeRotationY(-a)).multiply(new THREE.Matrix4().makeRotationZ(-tilt));
      L.push([cyl(0.075, 0.09, h, 6), c, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, h / 2, 0))], [new THREE.ConeGeometry(0.075, 0.16, 6), c, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, h + 0.08, 0))]); }
  }
  return [cgeo(B), cgeo(L)];
}
const NODES = [], NMESH = {}, NIDX = {};
function buildNodes(){
  for (const g of W.gather){ const reg = F.regionById(g.region); if (!reg || !GKIND[g.kind]) continue; srand(hashS(`gather:${g.kind}:${g.region}`));
    let n = 0, tries = 0; while (n < g.n && tries++ < g.n * 80){ const a = SR() * TAU, d = Math.sqrt(SR()) * reg.r * 0.95, x = reg.c[0] + Math.cos(a) * d, z = reg.c[1] + Math.sin(a) * d;
      if (!okSpot(x, z, g.region, GKIND[g.kind].sl, 13, NODES)) continue; NODES.push({ k: g.kind, reg: g.region, x, z, y: F.H(x, z) - Math.min(0.5, F.slope(x, z) * 0.45), ry: SR() * TAU, s: 0.9 + SR() * 0.45, live: true, rt: 0, grow: 1 }); n++; } }
  const SPK = sparkles(NODES.length + W.chests + 4, 120); NMESH.spk = SPK;
  for (const k in GKIND){ const L = NODES.filter(nd => nd.k === k); if (!L.length) continue; const [bg, lg] = nodeModel(k); NMESH[k] = { b: instMesh(bg, BASE_M, L.length), l: instMesh(lg, GLOW_VM, L.length) }; NIDX[k] = 0; }
  NODES.forEach((nd, i) => { nd.idx = NIDX[nd.k]++; nd.si = i; drawNode(nd);
    SPK.set(i, nd.x, nd.y + GKIND[nd.k].up, nd.z, GKIND[nd.k].col, 1);
    nd.it = F.addInteract({ x: nd.x, z: nd.z, r: 2.2, title: GKIND[nd.k].title, action: () => startGather(nd) }); });
  for (const k in NMESH) if (NMESH[k].b){ NMESH[k].b.instanceMatrix.needsUpdate = true; NMESH[k].l.instanceMatrix.needsUpdate = true; }
  SPK.dirty();
}
function drawNode(nd){ const M = NMESH[nd.k], s = nd.live ? nd.s * nd.grow : 0.0001; setInst(M.b, nd.idx, nd.x, nd.y, nd.z, nd.ry, s); setInst(M.l, nd.idx, nd.x, nd.y, nd.z, nd.ry, s); M.b.instanceMatrix.needsUpdate = M.l.instanceMatrix.needsUpdate = true; }
let CH = null, prevPose = null; const GP = Object.assign({}, G.POSES ? G.POSES.kneel : {});
function gatherPose(){ const t = G.time, dig = CH && (CH.nd.k === 'ore' || CH.nd.k === 'crystal'), k = Math.max(0, Math.sin(t * 9));
  Object.assign(GP, G.POSES.kneel, dig ? { hy: 0.74, lk: 0.6, rk: 0.6, sp: 0.4, rax: -2.4 + k * 1.8, re: -0.25, lax: -2.0 + k * 1.5, le: -0.35 } : { sp: 0.35, rax: -0.95 + Math.sin(t * 8) * 0.35, re: -0.55, lax: -0.85 + Math.cos(t * 8) * 0.3, le: -0.55 }); return GP; }
function startGather(nd){
  if (CH || !nd.live || X.dead || X.dialogOpen || !fieldOn()) return;
  const K = GKIND[nd.k]; if (!cnt(K.item) && bagFree() <= 0){ X.hint('🎒 가방이 가득 찼어요', 2); return; }
  CH = { nd, t: 0, T: K.t, x: pp.x, z: pp.z, fx: 0 }; chEl.querySelector('b').textContent = `${K.n} ${nd.k === 'ore' || nd.k === 'crystal' ? '캐는' : '따는'} 중…`; chEl.classList.add('on');
  X.fig.root.rotation.y = Math.atan2(nd.x - pp.x, nd.z - pp.z);
  if (G.POSES){ prevPose = X.emotePose; X.emotePose = gatherPose; }
}
function endGather(){ if (!CH) return; CH = null; chEl.classList.remove('on'); if (X.emotePose === gatherPose) X.emotePose = prevPose; prevPose = null; }
function updGather(dt){
  if (!CH) return; const nd = CH.nd; CH.t += dt;
  if (Math.hypot(pp.x - CH.x, pp.z - CH.z) > 0.5 || X.dead || X.dialogOpen || !fieldOn()){ endGather(); return; }
  chEl.querySelector('i').style.width = Math.min(100, CH.t / CH.T * 100) + '%';
  if ((CH.fx -= dt) <= 0){ CH.fx = 0.3; const dig = nd.k === 'ore' || nd.k === 'crystal'; X.sfx(dig ? 'clang' : 'roll');
    for (let i = 0; i < 6; i++) X.emit(nd.x + rr(-0.3, 0.3), nd.y + 0.4, nd.z + rr(-0.3, 0.3), rr(-1.5, 1.5), rr(1.5, 3.5), rr(-1.5, 1.5), dig ? (i % 2 ? 0xffd27a : 0xa89a8a) : GKIND[nd.k].col, 0.12, 0.6, { grav: -8 }); }
  if (CH.t < CH.T) return;
  const K = GKIND[nd.k], n = nd.k === 'crystal' ? ri(1, 2) : ri(1, 3); endGather();
  receive({ id: K.item, n }, true); X.sfx('pick');
  if (nd.k === 'ore' && R() < 0.18) receive({ id: 'stone', n: 1 }, true);
  if (R() < 0.025) receive({ id: 'sseed', n: 1 }, true);
  BUS.emit('gather', { kind: nd.k, item: K.item }); achAdd('gather', 1); qProgress('gather', { item: K.item, reg: nd.reg, n });
  for (let i = 0; i < 16; i++) X.emit(nd.x, nd.y + 0.5, nd.z, rr(-2, 2), rr(2, 5), rr(-2, 2), K.col, 0.16, 0.8, { grav: -6 });
  nd.live = false; nd.rt = G.time + rr(150, 260); nd.it.hidden = true; drawNode(nd); NMESH.spk.set(nd.si, nd.x, nd.y + K.up, nd.z, null, 0); NMESH.spk.dirty();
}
function updNodes(dt){
  for (const nd of NODES){
    if (!nd.live && nd.rt && G.time > nd.rt){ nd.live = true; nd.rt = 0; nd.grow = 0.01; nd.it.hidden = false; NMESH.spk.set(nd.si, nd.x, nd.y + GKIND[nd.k].up, nd.z, null, 1); NMESH.spk.dirty(); }
    if (nd.live && nd.grow < 1){ nd.grow = Math.min(1, nd.grow + dt * 1.6); drawNode(nd); }
  }
}

// ───────────────────────── 보물 상자 (나무 · 은(지키는 몬스터) · 황금(숨김)) ─────────────────────────
// 랜드마크마다 하나 + 이름 붙은 지형의 꼭대기 · 밑 · 섬에 숨긴 황금 상자
const SPECIAL = [
  ['g_redtable', '붉은 탁자 바위 꼭대기', 360, -320, 'top'], ['g_redfinger', '붉은 손가락 꼭대기', 560, -400, 'top'], ['g_twin', '쌍둥이 바위 위', 482, -134, 'top'], ['g_weep', '울음바위 단구', 336, -116, 'g'],
  ['g_hawk', '매의 절벽 아래', -248, 404, 'g'], ['g_scarp', '그림자 낭떠러지 위', 110, -206, 'g'], ['g_frosthorn', '서리 뿔 정상', 250, -672, 'top'], ['g_spine', '용의 등뼈 능선', -200, -528, 'top'],
  ['g_isle', '호수의 정자 섬 남쪽 바위', 26, 84, 'g'], ['g_edge', '세상의 끝 언덕', -640, 640, 'g'], ['g_icelake', '얼음 호수 한가운데', 20, -612, 'g'],
];
const CHESTS = [], CMESH = [], TIERN = ['나무 상자', '은 상자', '황금 상자'], TIERI = ['📦', '🧰', '👑'];
const topAt = (x, z, r = 6) => { let bx = x, bz = z, by = gy(x, z); for (let i = -r; i <= r; i += 1.5) for (let j = -r; j <= r; j += 1.5){ const y = gy(x + i, z + j); if (y > by){ by = y; bx = x + i; bz = z + j; } } return [bx, bz]; };
function chestModel(t){
  const wood = [0x8a5a32, 0x4a3a44, 0x9a3a22][t], band = [0x55585e, 0xd0d8e4, 0xffc850][t], gem = [0x3a2a1a, 0x5ac8ff, 0xff4a6a][t], box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const body = cgeo([[box(0.9, 0.46, 0.58), wood, mat4(0, 0.26, 0)], [box(0.94, 0.07, 0.62), band, mat4(0, 0.035, 0)], [box(0.08, 0.47, 0.6), band, mat4(-0.3, 0.27, 0)], [box(0.08, 0.47, 0.6), band, mat4(0.3, 0.27, 0)],
    [box(0.17, 0.2, 0.04), band, mat4(0, 0.37, 0.3)], [new THREE.OctahedronGeometry(0.05, 0), gem, mat4(0, 0.38, 0.33)]]);
  const half = (r, l) => new THREE.CylinderGeometry(r, r, l, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2);
  const lid = cgeo([[half(0.29, 0.9), wood, mat4(0, 0, 0.29)], [half(0.3, 0.08), band, mat4(-0.3, 0, 0.29)], [half(0.3, 0.08), band, mat4(0.3, 0, 0.29)], [box(0.94, 0.05, 0.05), band, mat4(0, 0.01, 0.58)]]);
  return [body, lid];
}
function buildChests(){
  const out = [];
  // 랜드마크 가장자리에서 평평하고 길 · NPC 와 떨어진 자리 (없으면 조건을 풀어 한 번 더)
  const trySpot = (l, r0, r1, sl, strict) => { for (let t = 0; t < 40; t++){ const a = SR() * TAU, d = r0 + SR() * (r1 - r0), x = l.c[0] + Math.cos(a) * d, z = l.c[1] + Math.sin(a) * d;
      if (Math.abs(x) > HALF - 110 || Math.abs(z) > HALF - 110 || F.isWater(x, z) || F.slope(x, z) > sl || (F.roadDist && F.roadDist(x, z) < 2.5) || KEEP.some(c => Math.hypot(x - c[0], z - c[1]) < 6)) continue;
      if (strict && W.landmarks.some(o => o !== l && Math.hypot(x - o.c[0], z - o.c[1]) < o.r * 0.6)) continue;
      if (SPECIAL.some(sp => Math.hypot(x - sp[2], z - sp[3]) < 12) || out.some(c => Math.hypot(x - c.x, z - c.z) < 10)) continue; return [x, z]; } return null; };
  for (const l of W.landmarks){ if (l.id === 'village' || l.id === 'runegate') continue; srand(hashS('chest:' + l.id));
    const spot = trySpot(l, l.r * 0.8, l.r * 1.15, 0.4, true) || trySpot(l, l.r * 0.5, l.r * 1.7, 0.7, false);
    if (!spot) continue;
    const reg = F.regionById(l.region), guarded = !!l.raid || (!reg.safe && reg.id !== 'greenhill' && hashS(l.id) % 3 === 0);
    out.push({ id: 'c_' + l.id, name: l.name, x: spot[0], z: spot[1], tier: guarded ? 1 : 0, lv: reg.lv[1], reg: reg.id }); }
  // 모자라면 이름 붙은 절벽 · 능선 밑에 나무 상자를 더 숨겨요
  for (const nt of W.namedTerrain){ if (out.length + SPECIAL.length >= W.chests) break; srand(hashS('chestT:' + nt.name)); const sp = trySpot({ c: nt.c }, 8, 26, 0.5, true); if (!sp) continue; const reg = F.regionAt(sp[0], sp[1]); out.push({ id: 'c_t_' + hashS(nt.name), name: nt.name, x: sp[0], z: sp[1], tier: 0, lv: reg.lv[1], reg: reg.id }); }
  for (const [id, name, x0, z0, mode] of SPECIAL){ const [x, z] = mode === 'top' ? topAt(x0, z0) : [x0, z0], reg = F.regionAt(x, z); out.push({ id, name, x, z, tier: 2, hidden: true, lv: Math.min(30, reg.lv[1] + 1), reg: reg.id }); }
  out.length = Math.min(out.length, W.chests);
  for (const c of out){ c.y = gy(c.x, c.z); c.ry = (hashS(c.id) % 628) / 100; c.opened = !!S.inv.chests[c.id]; c.open = c.opened ? 1 : 0; CHESTS.push(c);
    if (c.tier === 1){ const camps = W.camps.filter(cp => cp.region === c.reg).sort((a, b) => Math.hypot(a.c[0] - c.x, a.c[1] - c.z) - Math.hypot(b.c[0] - c.x, b.c[1] - c.z)), cp = camps[0];
      c.guard = { key: cp ? cp.mobs[0][0] : 'golem', lv: cp ? cp.lv[1] : c.lv, n: 3 }; } }
  for (let t = 0; t < 3; t++){ const L = CHESTS.filter(c => c.tier === t); if (!L.length) continue; const [bg, lg] = chestModel(t); const mb = G.std({ vertexColors: true, roughness: 0.55, metalness: t ? 0.35 : 0.1, flatShading: true });
    CMESH[t] = { b: instMesh(bg, mb, L.length), l: instMesh(lg, mb, L.length) }; L.forEach((c, i) => { c.idx = i; drawChest(c); }); }
  const SPK = NMESH.spk;
  CHESTS.forEach((c, i) => { c.si = NODES.length + i; if (SPK) SPK.set(c.si, c.x, c.y + 1.0, c.z, [0xffe0a0, 0xbfe8ff, 0xffd36a][c.tier], c.opened || c.hidden ? 0 : 0.8);
    if (!c.opened) c.it = F.addInteract({ x: c.x, z: c.z, r: 2.1, title: `${TIERI[c.tier]} ${TIERN[c.tier]} 열기`, action: () => openChest(c) }); });
  for (const c of CHESTS) c.col = F.circle(c.x, c.z, 0.5);
  if (SPK) SPK.dirty();
}
const _cm = new THREE.Matrix4(), _lm = new THREE.Matrix4(), _rx = new THREE.Matrix4(), _cg = new THREE.Color();
function drawChest(c){ const M = CMESH[c.tier]; _e.set(0, c.ry, 0); _q.setFromEuler(_e); _v.set(c.x, c.y, c.z); _sv.set(1.15, 1.15, 1.15); _cm.compose(_v, _q, _sv);
  M.b.setMatrixAt(c.idx, _cm); _lm.copy(_cm).multiply(_rx.makeTranslation(0, 0.49, -0.29)).multiply(_rx.makeRotationX(-c.open * 1.95)); M.l.setMatrixAt(c.idx, _lm);
  _cg.setScalar(c.opened && c.open >= 1 ? 0.5 : 1); M.b.setColorAt(c.idx, _cg); M.l.setColorAt(c.idx, _cg);
  M.b.instanceMatrix.needsUpdate = M.l.instanceMatrix.needsUpdate = true; if (M.b.instanceColor) M.b.instanceColor.needsUpdate = M.l.instanceColor.needsUpdate = true; }
const RING_M = new THREE.MeshBasicMaterial({ color: 0xff3a5a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
const RING_G = new THREE.RingGeometry(1.15, 1.45, 40).rotateX(-Math.PI / 2);
function openChest(c){
  if (c.opened || X.dialogOpen) return;
  if (c.guard && !c.cleared){ X.hint(`☠ 상자를 지키는 몬스터를 모두 쓰러뜨리세요${c.gs ? ` (${c.gs.filter(e => e.state !== 'dying').length} 남음)` : ''}`, 2.4); X.sfx('buzz'); return; }
  c.opened = true; c.anim = 0; S.inv.chests[c.id] = Date.now(); if (c.it){ F.removeInteract(c.it); c.it = null; }
  if (NMESH.spk){ NMESH.spk.set(c.si, c.x, c.y + 1, c.z, null, 0); NMESH.spk.dirty(); }
  X.sfx('shard'); if (c.tier === 2){ X.sfx('level'); bnr('TREASURE', `${TIERN[2]} 발견!`, `${c.name} — 숨겨진 보물`, false, 2.4); }
  X.later(0.45, () => { F.giveLoot(LOOTT[['chest_w', 'chest_s', 'chest_g'][c.tier]](c.lv), [c.x, c.z]);
    for (let i = 0; i < 40; i++) X.emit(c.x, c.y + 0.6, c.z, rr(-2.5, 2.5), rr(3, 7), rr(-2.5, 2.5), [0xffe08a, 0xffffff, 0xfff0c0][i % 3], 0.18, 1.1, { grav: -7 }); });
  achAdd('chest', 1); qProgress('chest', {}); BUS.emit('loot', { item: 'chest', n: 1 }); X.save();
}
function spawnGuards(c){
  const g = c.guard, key = X.MON[g.key] ? g.key : 'golem'; c.gs = []; c.killed = 0;
  for (let i = 0; i < g.n; i++){ const a = i / g.n * TAU + c.ry, x = c.x + Math.cos(a) * 4, z = c.z + Math.sin(a) * 4;
    try { const e = X.spawnMon(key, x, z, i === 0 && g.lv >= 16, { lv: g.lv + (i === 0 ? 1 : 0), fld: { hx: c.x, hz: c.z, aggro: 13, leash: 24, wr: 3 }, data: { chestGuard: c.id } }); c.gs.push(e); } catch (err){ console.warn('[rpg] guard', err); } }
  c.need = c.gs.length; if (!c.need){ c.cleared = true; return; }
  if (!c.ring){ c.ring = new THREE.Mesh(RING_G, RING_M); c.ring.position.set(c.x, c.y + 0.08, c.z); FW.add(c.ring); } c.ring.visible = true;
  X.hint(`☠ 「${c.name}」의 ${TIERN[1]}를 지키는 몬스터가 나타났다!`, 3); X.sfx('elite');
}
function updChests(dt){
  for (const c of CHESTS){
    if (c.opened && c.open < 1){ c.open = Math.min(1, c.open + dt * 2.2); drawChest(c); continue; }
    if (!c.chk && Math.abs(pp.x - c.x) < 40 && Math.abs(pp.z - c.z) < 40){ c.chk = true; if (c.col) F.removeCollider(c.col); const moved = unstick(c, 0.75); c.col = F.circle(c.x, c.z, 0.5); if (moved){ c.y = gy(c.x, c.z); drawChest(c); if (c.it){ F.removeInteract(c.it); c.it = F.addInteract({ x: c.x, z: c.z, r: 2.1, title: c.it.title, action: c.it.action }); } if (NMESH.spk){ NMESH.spk.set(c.si, c.x, c.y + 1, c.z); NMESH.spk.dirty(); } } }
    if (c.opened) continue;
    const d = Math.hypot(pp.x - c.x, pp.z - c.z);
    if (c.hidden && NMESH.spk){ const near = d < 14; if (near !== !!c.near){ c.near = near; NMESH.spk.set(c.si, c.x, c.y + 1, c.z, null, near ? 1 : 0); NMESH.spk.dirty(); if (near) X.sfx('shard'); } }   // 숨은 황금 상자: 가까이 오면 반짝
    if (!c.guard || c.cleared) continue;
    if (!c.gs){ if (d < 26 && fieldOn() && !X.dead) spawnGuards(c); continue; }
    c.gs = c.gs.filter(e => e.state !== 'dying' && X.ENEMIES.includes(e));
    if (c.ring) c.ring.scale.setScalar(1 + Math.sin(G.time * 4) * 0.06);
    if (!c.gs.length){ if (c.killed >= c.need){ c.cleared = true; if (c.ring) c.ring.visible = false; X.sfx('shard'); X.hint(`🔓 봉인이 풀렸다! ${TIERN[1]}를 열 수 있어요`, 3); for (let i = 0; i < 30; i++) X.emit(c.x, c.y + 0.4, c.z, rr(-3, 3), rr(2, 5), rr(-3, 3), 0xbfe8ff, 0.16, 0.9, { grav: -5 }); }
      else { c.gs = null; if (c.ring) c.ring.visible = false; } }
  }
}

// ───────────────────────── 룬 정령 (숨은 수집품 36) ─────────────────────────
// mode: g = 땅/발판 위 · h = 지형 바로 위(다리 · 오두막 밑) · w = 물 위에 둥실 · top = 근처에서 가장 높은 곳 / 다섯째 = 밤에만 나타나요
const SPIRIT_SPOTS = [
  ['마을 연못 위', 22, 604, 'w'], ['룬의 관문 뒤', 0, 644, 'g'], ['바람개비 언덕 꼭대기', -164, 460, 'g'], ['늙은 떡갈나무 뿌리', 126, 408, 'g'],
  ['양치기 오두막 뒤뜰', 102, 532, 'g'], ['말랑 웅덩이', -50, 350, 'g'], ['벌꿀 언덕 벌통 사이', 184, 332, 'g'], ['매의 절벽 아래', -250, 396, 'h'],
  ['매의 절벽 끝', -212, 410, 'g'], ['은빛 호수 한가운데', -40, 150, 'w'], ['호수의 정자 섬', 6, 92, 'g'], ['등불 바위 아래', -98, 62, 'g'],
  ['달빛 다리 그늘 물 위', -39, -57.5, 'w'], ['갈대 다리 그늘 물 위', 185, 150.5, 'w'], ['하얀 갈기 폭포 물보라 속', -60, -160, 'w'], ['거인의 그루터기 위', -420, 262, 'g'],
  ['요정의 버섯 고리', -300, 400, 'g', 1], ['고목 뿌리 터널 속', -545, 362, 'h'], ['속삭이는 샘 위', -482, 160, 'w'], ['깊은 숲 끝', -560, 450, 'g'],
  ['마녀의 오두막 밑', 300, 302, 'h'], ['썩은 판자길 끝', 352, 188, 'g'], ['가라앉은 신전 앞', 458, 104, 'g'], ['늪 웅덩이 위', 440, 232, 'w'],
  ['울음바위 단구 위', 326, -126, 'g'], ['붉은 탁자 바위 꼭대기', 360, -320, 'top'], ['쌍둥이 바위 사이', 492, -125, 'g'], ['독수리 둥지 꼭대기', 532, -332, 'top'],
  ['붉은 손가락 꼭대기', 560, -400, 'top'], ['거인의 유해 갈비뼈 밑', 436, -410, 'h'], ['잊힌 왕의 성채', -445, -298, 'g'], ['부서진 거상의 그늘', -300, -370, 'g'],
  ['용의 등뼈 능선 위', 200, -528, 'top'], ['서리 뿔 정상', 250, -672, 'top'], ['하늘 끝 봉우리 정상', -200, -662, 'top'], ['얼음 호수 한가운데', 20, -612, 'g'],
];
const SPIRITS = [], SPL = ['히힛! 들켰다!', '키득키득~ 찾았네!', '야호! 숨바꼭질 끝!', '흐흥, 운이 좋았네~', '룬룬~ 반가워!', '헤헤, 여기 숨은 거 어떻게 알았어?', '꺄르르! 또 놀자!', '흥! 다음엔 더 꼭꼭 숨을 거야!'];
let SPM = null;
function spiritModel(){
  const body = cgeo([[new THREE.IcosahedronGeometry(0.21, 2), 0xd8fbff, mat4(0, 0, 0, 0, 0, 0, 1, 1.08, 1)]]);
  { const c = body.attributes.color, p = body.attributes.position; for (let i = 0; i < c.count; i++){ const k = clamp(p.getY(i) / 0.23 * 0.5 + 0.5, 0, 1); c.setXYZ(i, 0.62 + 0.36 * k, 0.93 + 0.07 * k, 1); } }
  const det = cgeo([[new THREE.SphereGeometry(0.034, 8, 6), 0x101820, mat4(-0.075, 0.03, 0.185, 0, 0, 0, 1, 1.3, 0.6)], [new THREE.SphereGeometry(0.034, 8, 6), 0x101820, mat4(0.075, 0.03, 0.185, 0, 0, 0, 1, 1.3, 0.6)],
    [new THREE.SphereGeometry(0.03, 8, 6), 0xff9ab8, mat4(-0.12, -0.04, 0.165, 0, 0, 0, 1, 0.6, 0.4)], [new THREE.SphereGeometry(0.03, 8, 6), 0xff9ab8, mat4(0.12, -0.04, 0.165, 0, 0, 0, 1, 0.6, 0.4)],
    [new THREE.CylinderGeometry(0.008, 0.012, 0.1, 4), 0x4ac84a, mat4(0, 0.25, 0)], [new THREE.SphereGeometry(0.06, 6, 4), 0x7aff6a, mat4(-0.05, 0.31, 0, 0, 0, 0.6, 1, 0.35, 0.6)], [new THREE.SphereGeometry(0.06, 6, 4), 0x9aff7a, mat4(0.05, 0.31, 0, 0, 0, -0.6, 1, 0.35, 0.6)]]);
  return [body, det];
}
function buildSpirits(){
  SPIRIT_SPOTS.slice(0, W.seeds).forEach(([name, x0, z0, mode, night], i) => {
    const id = 'sp' + i; if (S.inv.spirits[id]) return;
    const [x, z] = mode === 'top' ? topAt(x0, z0, 5) : [x0, z0];
    const y = mode === 'w' ? (F.waterY ? F.waterY(x, z) : WL) + 0.65 : mode === 'h' ? F.H(x, z) + 0.55 : gy(x, z) + 0.55;
    SPIRITS.push({ id, name, x, z, y, mode, night: !!night, ph: R() * 6, gig: 0, pop: 0 }); });
  if (!SPIRITS.length) return;
  const [bg, dg] = spiritModel(); SPM = { b: instMesh(bg, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), SPIRITS.length), d: instMesh(dg, GLOW_VM, SPIRITS.length), a: sparkles(SPIRITS.length, 420, true) };
  SPIRITS.forEach((s, i) => { s.idx = i; SPM.a.set(i, s.x, s.y, s.z, 0x7ff8ff, 0); setInst(SPM.b, i, s.x, s.y, s.z, 0, 0.0001); setInst(SPM.d, i, s.x, s.y, s.z, 0, 0.0001); });
  SPM.a.dirty();
}
let AC = null;
const ac = () => { try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; } catch (e){ return null; } };
function giggle(vol = 0.06){ const a = ac(); if (!a) return; const t0 = a.currentTime + 0.01;
  for (let i = 0; i < 4; i++){ const o = a.createOscillator(), g = a.createGain(), t = t0 + i * 0.085, f = 1150 + i * 110 + R() * 90; o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.4, t + 0.05);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.09); } }
function updSpirits(dt){
  if (!SPM) return; const night = F.isNight ? F.isNight() : false, cam = G.camera.position; let any = false;
  for (const s of SPIRITS){
    if (s.found && s.pop >= 1) continue;
    if (!s.chk && Math.abs(pp.x - s.x) < 40 && Math.abs(pp.z - s.z) < 40){ s.chk = true; if (s.mode !== 'w' && unstick(s, 0.35)) s.y = (s.mode === 'h' ? F.H(s.x, s.z) : gy(s.x, s.z)) + 0.55; }
    const d = Math.hypot(pp.x - s.x, pp.z - s.z), vis = (!s.night || night) && d < 48;
    if (s.found){ s.pop = Math.min(1, s.pop + dt * 3); const k = s.pop < 0.4 ? 1 + s.pop * 2.5 : Math.max(0.0001, (1 - s.pop) / 0.6 * 2); setInst(SPM.b, s.idx, s.x, s.y + s.pop * 1.2, s.z, 0, k); setInst(SPM.d, s.idx, s.x, s.y + s.pop * 1.2, s.z, 0, k); SPM.a.set(s.idx, s.x, s.y + s.pop * 1.2, s.z, null, 1 - s.pop); any = true; continue; }
    if (!vis){ if (s.shown){ s.shown = false; setInst(SPM.b, s.idx, s.x, s.y, s.z, 0, 0.0001); setInst(SPM.d, s.idx, s.x, s.y, s.z, 0, 0.0001); SPM.a.set(s.idx, s.x, s.y, s.z, null, 0); any = true; } continue; }
    s.shown = true; any = true;
    const t = G.time + s.ph, y = s.y + Math.sin(t * 2.2) * 0.12, face = Math.atan2(cam.x - s.x, cam.z - s.z), sq = 1 + Math.sin(t * 6) * 0.05;
    setInst(SPM.b, s.idx, s.x, y, s.z, face, 1, sq); setInst(SPM.d, s.idx, s.x, y, s.z, face, 1, sq); SPM.a.set(s.idx, s.x, y, s.z, null, d < 18 ? 1 : 0.6);
    if (d < 16 && G.time > s.gig){ s.gig = G.time + rr(4, 7); giggle(0.05 * (1 - d / 18)); }
    if (d < 22 && R() < dt * 7) X.emit(s.x + rr(-0.25, 0.25), y + rr(-0.1, 0.2), s.z + rr(-0.25, 0.25), rr(-0.2, 0.2), rr(0.4, 0.9), rr(-0.2, 0.2), R() < 0.7 ? 0x9ffcff : 0xd8ffb0, 0.07, rr(0.8, 1.4), { drag: 0.5, sway: 1 });
    if (d < 1.7 && Math.abs(pp.y - s.y) < 2.2 && fieldOn() && !X.dead) findSpirit(s);
  }
  if (any){ SPM.b.instanceMatrix.needsUpdate = SPM.d.instanceMatrix.needsUpdate = true; SPM.a.dirty(); }
}
function findSpirit(s){
  s.found = true; s.pop = 0; S.inv.spirits[s.id] = Date.now(); const n = Object.keys(S.inv.spirits).length;
  giggle(0.12); X.sfx('pop'); X.sfx('shard');
  for (let i = 0; i < 36; i++) X.emit(s.x, s.y, s.z, rr(-3, 3), rr(1, 5), rr(-3, 3), [0x7ff8ff, 0xffffff, 0x9aff7a, 0xffe08a][i % 4], 0.16, 1.2, { grav: -3, drag: 1.5 });
  bnr('RUNE SPIRIT', `룬 정령 ${n} / ${W.seeds}`, `「${pick(SPL)}」 — ${s.name}`, false, 2.8);
  BUS.emit('loot', { item: 'spirit', n: 1 }); qProgress('seed', {}); achT = Math.min(achT, 0.4);
  if (n % 3 === 0) X.later(3, () => X.hint('✨ 룬 정령 셋을 모았어요! <b>촌장 하몬</b>이나 <b>학자 엘린</b>에게 보답을 받으세요', 5));
  X.save();
}

// ───────────────────────── 의뢰 게시판 상호작용 · NPC 이름 · 퀘스트 표시 ─────────────────────────
const RPG_ROLE = { quest_main: 1, quest: 1, smith: 1, shop: 1, inn: 1, board: 1, resident: 1 };
function spk(id){ const n = byId('npcs', id); if (!n) return; if (!X.NAMES[id]) X.NAMES[id] = n.name;
  if (!X.SPK[id]) X.SPK[id] = () => { const o = F.npcs && F.npcs[id]; if (!o || !o.fig) return null; const f = o.fig.root ? o.fig : o.fig.fig; return f && f.root ? f : null; }; }
for (const n of W.npcs) spk(n.id);
for (const r of ['quest_main', 'quest', 'smith', 'shop', 'inn', 'resident']) F.roleTalkers[r] = n => npcTalk(n);
F.roleTalkers.board = () => F.openBoard();
// 다른 모듈이 대화를 맡은 NPC (글라이더 제피 · 낚시꾼 노아 · 레이드 대장 · 재봉사)도 이야기 퀘스트를 주고받을 수 있게:
// 퀘스트 일(이야기하기 목표 · 보고 · 새 퀘스트)이 있으면 rpg 가 먼저 묻고, 없으면 원래 대화(F.roleTalkers[role])로 그대로 넘겨요
const SVC = { glider: '🪂 바람 이야기 · 글라이더', fish: '🎣 낚시 · 물고기', raid: '⚔ 레이드', wardrobe: '👗 의상실' };
const WRAPPED = {};
for (const n of W.npcs){ if (n.object || RPG_ROLE[n.role] || F.talkers[n.id]) continue; WRAPPED[n.id] = 1;
  F.talkers[n.id] = async nn => { const role = F.roleTalkers[nn.role]; await npcTalk(nn, role ? { label: SVC[nn.role] || '💬 이야기 나누기', fn: () => role(nn) } : null); }; }
const BOARD = byId('npcs', 'board'), FALLBACK = {};
let boardLabel = null;
function npcLabel(id){ if (id === 'board') return boardLabel; const o = F.npcs && F.npcs[id]; return (o && o.label) || (FALLBACK[id] && FALLBACK[id].label) || null; }
function npcMark(id){
  for (const qid in S.q.act){ const q = getQ(qid), a = S.q.act[qid]; if (!q) continue;
    if (q.kind !== 'daily' && !q.auto && q.to === id && qReady(qid)) return '?';
    if (q.o.some((o, i) => o.t === 'talk' && o.npc === id && !a.p[i])) return '?'; }
  if (id === 'board'){ const dl = S.q.daily; if (!dl) return '!'; if (dl.list.some(q => S.q.act[q.id] && qReady(q.id))) return '?'; return dl.list.some(q => !S.q.act[q.id] && !dl.done[q.id]) || (!dl.bonus && dl.list.every(q => dl.done[q.id])) ? '!' : ''; }
  const nm = nextMain();
  for (const qid in QD){ const q = QD[qid]; if (q.giver === id && qAvail(qid) && qLvOk(q) && (q.kind !== 'main' || qid === nm)) return '!'; }
  if ((id === 'chief' || id === 'elin') && spiritPts() > 0) return '✨';
  return '';
}
let markForceT = 0;
function refreshMarks(force){
  marksDirty = false;
  for (const n of W.npcs){ const L = npcLabel(n.id); if (!L || !L.set) continue; const m = npcMark(n.id); if (!force && L._rpgm === m) continue; L._rpgm = m; L.set(L.text || n.name, L.sub ?? n.title, m || undefined); }
}
// 지도 표시 (G.mapMarkers) · 화면 나침반 대상
const MYMK = [];
function updMarks(){
  for (const m of MYMK){ const i = G.mapMarkers.indexOf(m); if (i >= 0) G.mapMarkers.splice(i, 1); } MYMK.length = 0; navT = null;
  const L = trkList(), add = (t, c) => { const m = { x: t.x, z: t.z, c }; MYMK.push(m); G.mapMarkers.push(m); if (!navT) navT = Object.assign({ c }, t); };
  for (const id of L){ const t = qTarget(id); if (t) add(t, KC[getQ(id).kind]); }
  if (!L.length){ const nm = nextMain(); if (nm && qLvOk(QD[nm]) && QD[nm].giver !== 'auto'){ const t = qTarget(nm); if (t) add(t, KC.main); } }
  if (navT && (navT.x !== lastNav.x || navT.z !== lastNav.z)){ lastNav.x = navT.x; lastNav.z = navT.z; lastNav.y = gy(navT.x, navT.z) + 2.6; } if (navT) navT.y = lastNav.y;
}
const lastNav = { x: 1e9, z: 1e9, y: 0 }, _nv = new V3();
let navArrow = '';
function updNav(){
  if (!navT || !fieldOn() || X.dialogOpen || OPEN){ if (navEl.style.display !== 'none') navEl.style.display = 'none'; return; }
  const d = Math.hypot(navT.x - pp.x, navT.z - pp.z); if (d < 9){ navEl.style.display = 'none'; return; }
  _nv.set(navT.x, navT.y, navT.z).project(G.camera); const W2 = innerWidth, H2 = innerHeight;
  let sx = (_nv.x * 0.5 + 0.5) * W2, sy = (-_nv.y * 0.5 + 0.5) * H2; const behind = _nv.z > 1; if (behind){ sx = W2 - sx; sy = H2 - sy; }
  const mx = 60, my = 70, xr = Math.min(W2 - mx, navR > W2 / 2 ? navR : W2 - mx), inside = !behind && sx > mx && sx < xr && sy > my && sy < H2 - my; let arrow = '';
  if (!inside){ const cx = (mx + xr) / 2, cy = H2 / 2; let dx = sx - cx, dy = sy - cy; if (behind && dy < 0) dy = Math.abs(dy) + 1; const k = Math.min((xr - cx) / Math.max(1e-3, Math.abs(dx)), (cy - my) / Math.max(1e-3, Math.abs(dy))); sx = cx + dx * k; sy = cy + dy * k; arrow = Math.atan2(dy, dx).toFixed(2); }
  if (trkR && trkR.height && sx > trkR.left - 24 && sx < trkR.right + 24 && sy > trkR.top - 24 && sy < trkR.bottom + 24) sy = Math.min(H2 - my, trkR.bottom + 30);   // 추적 HUD 와 겹치지 않게
  navEl.style.display = 'block'; navEl.style.left = sx + 'px'; navEl.style.top = sy + 'px'; navEl.style.setProperty('--c', navT.c);
  if (arrow !== navArrow){ navArrow = arrow; const u = navEl.querySelector('u'); u.textContent = arrow ? '➤' : ''; u.style.transform = arrow ? `rotate(${arrow}rad)` : ''; }
  const txt = `${navT.label} · ${d >= 1000 ? (d / 1000).toFixed(1) + 'km' : Math.round(d) + 'm'}`, b = navEl.querySelector('b'); if (b.textContent !== txt) b.textContent = txt;
}
// 추적 HUD
function trkList(){ const act = Object.keys(S.q.act).filter(getQ).sort(sortQ), L = S.q.track.filter(id => act.includes(id)); for (const id of act) if (!L.includes(id)) L.push(id); return L.slice(0, 3); }
const TCH = () => G.IS_TOUCH || document.body.classList.contains('touch');
function renderTracker(){
  trkDirty = false; const tch = TCH(), L = trkList().slice(0, tch ? 1 : 3); trkEl.classList.toggle('tch', tch);
  if (!L.length){ const nm = nextMain(), q = nm && QD[nm];
    trkEl.innerHTML = q ? `<div class="t" data-q="${nm}" style="--c:${KC.main}"><div class="k">NEXT STORY</div><div class="n">${esc(q.name)}</div><div class="o">${!qLvOk(q) ? `Lv.${q.lv} 이 되면 이어져요` : q.giver === 'auto' ? '곧 시작돼요' : `❗ ${NPCN(q.giver)}에게 말 걸기`}</div></div>` : ''; return; }
  trkEl.innerHTML = L.map(id => { const q = getQ(id), a = S.q.act[id], rdy = qReady(id);
    return `<div class="t ${flashQ === id ? 'flash' : ''}" data-q="${id}" style="--c:${KC[q.kind]}"><div class="k">${KE[q.kind]}</div><div class="n">${esc(q.name)}</div>${rdy && !q.auto ? `<div class="o go">✔ ${q.kind === 'daily' ? '의뢰 게시판' : NPCN(q.to)}에게 보고</div>` :
      q.o.map((o, i) => { const n = objN(o), p = Math.min(a.p[i] || 0, n); if (tch && (p >= n || i !== q.o.findIndex((o2, j) => (a.p[j] || 0) < objN(o2)))) return ''; return `<div class="o ${p >= n ? 'ok' : ''}">${esc(objText(o))}${n > 1 ? ` <b>${p}/${n}</b>` : p >= n ? ' ✔' : ''}</div>`; }).join('')}</div>`; }).join('');
  flashQ = null;
}
trkEl.addEventListener('click', e => { const t = e.target.closest('[data-q]'); if (t) toggleQuests(t.dataset.q); });
let navR = 0, trkR = null;
function layoutTrk(){ const r = F.menu.el.getBoundingClientRect(); trkR = trkEl.getBoundingClientRect(); if (!r.height) return; navR = r.left - 34; if (TCH()) return; const room = innerHeight - r.bottom - 150, W2 = innerWidth;
  if (room > 170){ trkEl.style.top = (r.bottom + 12) + 'px'; trkEl.style.right = '14px'; } else { trkEl.style.top = r.top + 'px'; trkEl.style.right = (W2 - r.left + 10) + 'px'; } }

// ───────────────────────── 이벤트 ─────────────────────────
BUS.on('kill', e => {
  if (!e) return; achAdd('kill', 1); achAdd('k_' + e.key, 1); if (e.elite) achAdd('elite', 1);
  if (e.chestGuard){ const c = CHESTS.find(c => c.id === e.chestGuard); if (c) c.killed = (c.killed || 0) + 1; }
  if (X.mode === 'stage') return;   // 스토리(튜토리얼) 스테이지는 퀘스트 · 드랍 없음
  if (e.fboss && (!e.sbId || e.fbId)){ achAdd('fboss', 1); qProgress('fboss', { key: e.key }); }   // 이야기 보스(saga)는 필드 보스 목표 · 업적에 안 쳐요
  qProgress('kill', { e }); if (e.elite) qProgress('elite', { e });
  if (fieldOn()) dropFromKill(e);
});
BUS.on('discover', d => { if (d && d.id) qProgress('discover', d); achT = Math.min(achT, 0.4); marksDirty = true; });
BUS.on('talk', d => { const n = d && byId('npcs', d.npc); if (n && !RPG_ROLE[n.role] && !WRAPPED[n.id]) qProgress('talk', { npc: n.id }); });
BUS.on('glider', () => checkInstant());
BUS.on('fish', () => { achAdd('fish', 1); qProgress('fish', {}); });
BUS.on('raidClear', d => { if (!d) return; S.ach.c['r_' + d.id] = 1; qProgress('raid', { id: d.id }); achT = Math.min(achT, 0.4); X.save(); });
BUS.on('levelUp', () => { const before = new Set(Object.keys(QD).filter(id => qAvail(id) && S.lv - 1 >= QD[id].lv)); checkInstant(); checkAutoMain(); marksDirty = trkDirty = true; achT = Math.min(achT, 0.4);
  const fresh = Object.keys(QD).filter(id => qAvail(id) && qLvOk(QD[id]) && !before.has(id) && QD[id].giver !== 'auto' && (QD[id].kind !== 'main' || id === nextMain()));
  if (fresh.length) X.later(3.2, () => { F.note(`<span style="color:#ffd36a">❗ 새 퀘스트 — ${fresh.slice(0, 2).map(id => `${QD[id].name} (${NPCN(QD[id].giver)})`).join(' · ')}</span>`, 5); qBtn.classList.add('dot'); }); });
BUS.on('hurt', () => { if (CH) endGather(); });
BUS.on('death', () => endGather());
BUS.on('mode', () => { updPotHud(true); if (X.mode !== 'field') endGather(); });
BUS.on('leaveField', () => { endGather(); navEl.style.display = 'none'; });
BUS.on('npcsReady', () => { removeFallback(); marksDirty = true; refreshMarks(true); });
BUS.on('enterField', d => { marksDirty = trkDirty = true; ensureDaily(); checkAutoMain(); updPotHud(true);
  if (!(d && (d.warp || d.revive))) X.later(2.2, () => { const m0 = MAIN[0]; if (F.saga && F.saga.busy && F.saga.busy()) return; if (m0 && !S.q.done[m0] && !S.q.act[m0]) X.hint(`❗ <b>${NPCN(QD[m0].giver)}</b>에게 말을 걸어 보세요 — 머리 위 느낌표가 퀘스트예요`, 6); else { const t = trkList()[0]; if (t) X.hint(`📜 ${getQ(t).name} — <b>L</b> 퀘스트 · <b>I</b> 가방 · <b>H/G</b> 물약`, 4.5); } }); });
X.KEYH.push(code => {
  const ae = document.activeElement; if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return false;
  if (OPEN && code === 'Escape'){ closeWin(); return true; }
  if (document.body.classList.contains('shopping') || X.tpBusy) return false;
  if (code === 'KeyI'){ toggleInv(); return true; }
  if (code === 'KeyL'){ toggleQuests(); return true; }
  if ((code === 'KeyH' || code === 'KeyG') && potMode() && !G.lock){ usePot(code === 'KeyH' ? 'hp' : 'mp'); return true; }
  return false;
});

// ───────────────────────── 매 프레임 ─────────────────────────
const autoPend = {};
let slowT = 0, layT = 0, buffT = 0, restOn = restLeft() > 0, botT = 200 + R() * 200;
G.hooks.push((dt, rdt) => {
  UT.value = G.time; updBanner(rdt);
  for (const k of ['hp', 'mp']) if (potCd[k] > 0) potCd[k] = Math.max(0, potCd[k] - dt);
  if ((potT -= rdt) <= 0){ potT = 0.1; updPotHud(); }
  if (fullWarnT > 0) fullWarnT = Math.max(0, fullWarnT - rdt);
  if (saveT > 0 && (saveT -= rdt) <= 0) X.save();
  if ((achT -= rdt) <= 0){ achT = 2; achCheck(); }
  if ((buffT -= rdt) <= 0){ buffT = 5; renderBuff(); const on = restLeft() > 0; if (on !== restOn){ restOn = on; applyBonus(); if (!on) F.note('🛏 휴식 보너스가 끝났어요', 3); } }
  if (OPEN === INV && invDirty) renderInv();
  if (goldDirty) renderGold();
  if (!F.inField){ if (navEl.style.display !== 'none') navEl.style.display = 'none'; return; }
  updLoot(dt); updGather(dt); updChests(dt); updSpirits(dt); updNodes(dt);
  if ((slowT -= rdt) <= 0){ slowT = 0.5; checkInstant(); updMarks();
    for (const id in S.q.act){ const q = getQ(id); if (q && q.auto && qReady(id) && !autoPend[id]){ autoPend[id] = 1; completeQuest(id); } } if (S.q.daily && S.q.daily.day !== today()) ensureDaily(); }
  if ((markForceT -= rdt) <= 0){ markForceT = 3; refreshMarks(true); } else if (marksDirty) refreshMarks();
  if (trkDirty){ renderTracker(); updMarks(); }
  if ((layT -= rdt) <= 0){ layT = 1; layoutTrk(); }
  // 다른 모험가(봇)의 강화 소식 — 살아 있는 세상
  if ((botT -= rdt) <= 0){ botT = 240 + R() * 300; const bots = (F.bots || []).filter(b => b && (b.name || b.n)); if (bots.length){ const b = pick(bots), e = ri(10, 13), it = makeGear({ il: ri(12, 30), r: ri(2, 4) }); S.inv.uid--; F.chat(`⚒ ${b.name || b.n}님이 「+${e} ${it.n}」 강화에 성공했습니다!`, '대장간', 'sys'); } }
  updNav();
});

// ───────────────────────── 시작 ─────────────────────────
// 의뢰 게시판: 모양은 landmarks, 상호작용 · 이름표는 여기서
if (BOARD){ const [bx, bz] = BOARD.c; boardLabel = F.label({ pos: new V3(bx, gy(bx, bz) + 3.9, bz), text: BOARD.name, sub: BOARD.title, cls: 'npc', max: 32 });
  F.addInteract({ x: bx, z: bz, r: 3.4, title: '📋 의뢰 게시판 보기', action: () => F.talk('board') }); }
// life 의 NPC 가 아직 없을 때(부분 테스트 · 작업 중)도 퀘스트가 막히지 않게 이름표 + 상호작용만 세워요. NPC 가 생기면 걷어요.
const hasNpcs = () => !!(F.npcs && Object.keys(F.npcs).length);
function removeFallback(){ for (const id in FALLBACK){ FALLBACK[id].label.remove(); F.removeInteract(FALLBACK[id].it); delete FALLBACK[id]; } }
function ensureFallback(){ if (hasNpcs()){ removeFallback(); return; } if (Object.keys(FALLBACK).length) return;
  for (const n of W.npcs){ if (n.object || !RPG_ROLE[n.role]) continue; const [x, z] = n.c;
    FALLBACK[n.id] = { label: F.label({ pos: new V3(x, gy(x, z) + 2.3, z), text: n.name, sub: n.title, cls: 'npc', max: 30 }), it: F.addInteract({ x, z, r: 2.6, title: `💬 ${n.name}`, action: () => F.talk(n.id) }) }; }
  marksDirty = true; }
BUS.on('fieldReady', ensureFallback); BUS.on('enterField', () => X.later(1, ensureFallback));
const T0 = performance.now();
try { buildNodes(); } catch (e){ console.error('[rpg] gather nodes', e); }
try { buildChests(); } catch (e){ console.error('[rpg] chests', e); }
try { buildSpirits(); } catch (e){ console.error('[rpg] spirits', e); }
for (const id in (S.titles.defs || {})) if (!TITLES[id]) TITLES[id] = S.titles.defs[id];
applyBonus(); renderCardTitle(); renderBuff(); updPotHud(true);
console.log(`[rpg] 채집물 ${NODES.length} · 상자 ${CHESTS.length} · 룬 정령 ${SPIRITS.length}/${W.seeds} · 퀘스트 메인 ${MAIN.length} · 의뢰 ${Object.keys(QD).length - MAIN.length} · ${Math.round(performance.now() - T0)}ms`);
Object.assign(F, { gearScore, makeGear, RARITY: RAR, ITEMS, itemName: gName, rpgWindowOpen: () => !!OPEN, closeRpgWindow: closeWin });
F.addItem = (id, n = 1, o) => { let ok = true; if (SLOT[id]){ for (let i = 0; i < n; i++) ok = receive({ g: makeGear(Object.assign({ s: id }, o || {})) }) && ok; } else ok = receive({ id, n }); X.save(); return ok; };
F.hasItem = (id, n = 1) => SLOT[id] ? S.inv.bag.filter(g => g.s === id).length >= n : cnt(id) >= n;
F.takeItem = (id, n = 1) => { const ok = takeStack(id, n); if (ok) X.save(); return ok; };
F.gold = (n = 0) => { n = Math.round(n); if (n < 0 && (S.gold || 0) < -n) return false; if (n) { addGold(n, true); X.save(); X.refreshHud(); } return S.gold || 0; };
return { ITEMS, RAR, QD, MAIN, TITLES, ACH, NODES, CHESTS, SPIRITS, LOOT, makeGear, giveLoot: F.giveLoot, questEvent: F.questEvent, openInventory: F.openInventory, openQuests: F.openQuests, acceptQuest, completeQuest, gearScore, applyBonus,
  getQ, objN, qReady, qAvail, nextMain, npcTalk, offerQuest, LIDX };
}
