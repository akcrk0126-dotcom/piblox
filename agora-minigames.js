// 룬 아고라 — 모험의 대지: minigames (agora-minigames.js)
// 낚시: 필드 낚시터 10곳 + 광장 분수 · 캐스팅 → 입질 → 챔질 → 줄다리기(세로 막대) → 잡은 카드 · 물고기 26종(지역 · 시간 · 등급) · 도감 · 바구니
//       낚시 레벨 · 낚싯대 5단계 · 낚시꾼 노아(매입 · 강화 · 칭호)
// 광장 🎲 미니 게임: 룬 리듬(4레인 · 합성 음악 3곡 · 보통/어려움) · 과녁 맞히기(45초 사격) · 룬 메아리(기억력)
// 계약서: docs/agora-modules.md — 필드 물체는 F.FW 에 절대 y (= F.H), 광장 물체는 G.world
// F 에 올리는 것: F.startFishing(spotId) · F.stopFishing() · F.openMinigames() · F.openFishLog(tab) · F.fishing (낚시 중?)
// BUS 로 쏘는 것: 'fish' { id, name, rarity(0~4), size(cm), spot, perfect } · 'minigame' { id, score }
// 저장: S.fish (도감 · 바구니 · 낚싯대 · 낚시 레벨) · S.mini (미니 게임 최고 기록 · 일일 보너스)
export async function init(G, X, F){
const { THREE, V3, BUS, TAU } = X;
const W = F.WORLD, S = X.S, byId = F.byId;
const LOW = G.gfxMode === 'low' || G.IS_TOUCH;
const R = Math.random, rr = (a, b) => a + (b - a) * R(), ri = (a, b) => a + Math.floor(R() * (b - a + 1)), pick = a => a[(R() * a.length) | 0];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
const fmt = n => Math.round(n).toLocaleString();
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const pp = X.player.pos;

// ───────────────────────── 저장 ─────────────────────────
S.fish = Object.assign({ log: {}, keep: [], rod: 0, lv: 1, xp: 0, total: 0, perfect: 0, earned: 0, sold: 0, met: 0, gave: {}, big: null }, S.fish || {});
S.mini = Object.assign({ best: {}, plays: {}, day: '', daily: {}, off: 0, seen: 0 }, S.mini || {});
if (!Array.isArray(S.fish.keep)) S.fish.keep = [];

// ───────────────────────── 골드 · 칭호 (rpg 가 있으면 그쪽으로) ─────────────────────────
function addGold(n){ n = Math.round(n); if (!n) return; if (F.gold) F.gold(n); else { S.gold = Math.max(0, (S.gold || 0) + n); X.save(); X.refreshHud(); } }
const gold = () => S.gold || 0;
const MG_TITLES = {
  mg_fish5: { n: '물가의 견습생', d: '낚시 Lv.5 달성', b: { regen: 0.5 } },
  mg_fish10: { n: '노련한 강태공', d: '낚시 Lv.10 달성', b: { hp: 30, regen: 0.5 } },
  mg_dex: { n: '물고기 박사', d: '물고기 도감 15종', b: { rune: 4, mp: 15 } },
  mg_lord: { n: '호수의 주인을 낚은 자', d: '전설의 물고기 「호수의 주인」 낚기', b: { atk: 4, crit: 0.01 } },
  mg_master: { n: '아르카디아 강태공', d: '물고기 도감 완성', b: { hp: 80, def: 3, regen: 1 } },
  mg_rhythm: { n: '룬의 리듬', d: '룬 리듬 S 랭크', b: { aspd: 0.04 } },
  mg_archer: { n: '백발백중', d: '과녁 맞히기 4,000점', b: { crit: 0.015 } },
  mg_echo: { n: '룬의 기억', d: '룬 메아리 12단계', b: { mp: 20 } },
};
function grant(id){
  const t = MG_TITLES[id]; if (!t) return false;
  if (F.title && F.title.grant) return F.title.grant(id, t);
  S.mini.titles = S.mini.titles || {}; if (S.mini.titles[id]) return false; S.mini.titles[id] = 1; X.save();
  X.banner('NEW TITLE', `「${t.n}」`, t.d, false, 3); X.sfx('level'); return true;
}

// ───────────────────────── 사운드 (자체 AudioContext — 음악 · 효과음) ─────────────────────────
let AC = null, NB = null, SFXO = null;
function ac(){
  if (!AC){ try { AC = new (window.AudioContext || window.webkitAudioContext)(); const n = AC.sampleRate; NB = AC.createBuffer(1, n, n); const d = NB.getChannelData(0); for (let i = 0; i < n; i++) d[i] = R() * 2 - 1;
    SFXO = AC.createGain(); SFXO.gain.value = 0.9; SFXO.connect(AC.destination); } catch (e){ return null; } }
  if (AC.state === 'suspended' && !AC._paused) AC.resume(); return AC;
}
function tone(type, f0, f1, dur, vol, delay = 0, out){
  const a = ac(); if (!a) return; const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out || SFXO); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol, f0, f1, q = 1, type = 'bandpass', delay = 0, out){
  const a = ac(); if (!a) return; const t = a.currentTime + delay, s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
  s.buffer = NB; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(out || SFXO); s.start(t, R() * 0.5); s.stop(t + dur + 0.05);
}
function sfx(k){
  switch (k){
    case 'whoosh': noise(0.32, 0.18, 500, 2600, 1.4); tone('sine', 900, 1500, 0.25, 0.02); break;
    case 'plop': tone('sine', 620, 160, 0.14, 0.2); noise(0.18, 0.12, 1800, 400, 1, 'lowpass'); break;
    case 'nibble': tone('sine', 340, 240, 0.06, 0.08); break;
    case 'bite': noise(0.4, 0.3, 2400, 300, 0.8, 'lowpass'); tone('triangle', 880, 880, 0.09, 0.12); tone('triangle', 1320, 1320, 0.14, 0.12, 0.08); break;
    case 'hook': tone('sawtooth', 220, 520, 0.12, 0.05); noise(0.15, 0.2, 3000, 800, 1); break;
    case 'tick': tone('square', 2200 + R() * 300, 1800, 0.018, 0.022); break;
    case 'splash': noise(0.55, 0.28, 1600, 250, 0.7, 'lowpass'); tone('sine', 300, 120, 0.25, 0.08); break;
    case 'snap': tone('sawtooth', 1100, 70, 0.22, 0.08); noise(0.2, 0.25, 4000, 600, 1.5); break;
    case 'coin': tone('sine', 1320, 1320, 0.12, 0.1); tone('sine', 1760, 1760, 0.25, 0.09, 0.07); break;
    case 'chest': [784, 988, 1319].forEach((f, i) => tone('triangle', f, f, 0.22, 0.08, i * 0.06)); break;
    case 'early': tone('square', 330, 180, 0.18, 0.05); break;
    case 'catch0': [659, 784, 988].forEach((f, i) => tone('triangle', f, f, 0.25, 0.1, i * 0.07)); break;
    case 'catch1': [659, 784, 988, 1319].forEach((f, i) => tone('triangle', f, f, 0.3, 0.1, i * 0.07)); break;
    case 'catch2': [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.35, 0.11, i * 0.07)); noise(0.6, 0.06, 6000, 9000, 2, 'bandpass', 0.3); break;
    case 'catch3': [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone('triangle', f, f, 0.4, 0.11, i * 0.065)); tone('sine', 196, 196, 1.2, 0.12); break;
    case 'catch4': [262, 330, 392, 523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone(i % 2 ? 'triangle' : 'square', f, f, 0.5, 0.06 + (i % 2) * 0.05, i * 0.07)); tone('sine', 131, 131, 2, 0.16); noise(1.4, 0.08, 7000, 10000, 2, 'bandpass', 0.5); break;
    case 'lose': tone('triangle', 440, 330, 0.25, 0.08); tone('triangle', 330, 220, 0.35, 0.08, 0.2); break;
    case 'good': tone('sine', 880, 1100, 0.08, 0.06); break;
    case 'bad': tone('square', 160, 110, 0.18, 0.06); noise(0.12, 0.1, 600, 200); break;
  }
}

// ═════════════════════════ 1. 물고기 ═════════════════════════
// 등급: 0 일반 · 1 고급 · 2 희귀 · 3 영웅 · 4 전설
const RAR = [
  { n: '일반', c: '#c3ccd2', w: 52, xp: 10, dif: 0.05 }, { n: '고급', c: '#7fe08a', w: 28, xp: 22, dif: 0.25 }, { n: '희귀', c: '#5ab8ff', w: 11, xp: 48, dif: 0.45 },
  { n: '영웅', c: '#c07aff', w: 3.6, xp: 130, dif: 0.66 }, { n: '전설', c: '#ffb03a', w: 0.9, xp: 520, dif: 0.95 },
];
// hab: 서식지 · time: any / day / night / dawn(새벽·해 질 녘) · cm: 크기 · g: 기본 값 · mv: 줄다리기 움직임 { s: smooth|dart|sink|float|mixed|boss, sp, dt } · a: 그림
const FISH = [
  { id: 'minnow', n: '피라미', en: 'Pale Chub', r: 0, hab: ['pond', 'river', 'lake'], time: 'any', cm: [5, 12], g: 6, mv: { s: 'smooth', sp: 0.3, dt: 0.2 },
    a: { b: '#a8c4d0', t: '#5a7a90', u: '#eef4f6', f: '#e88aa0', pat: 'band', bc: '#f08aa8', ar: 3.4 }, d: '어디서나 볼 수 있는 작은 물고기. 수컷은 짝짓기 철에 분홍빛 띠를 두른다.' },
  { id: 'crucian', n: '붕어', en: 'Crucian Carp', r: 0, hab: ['pond', 'lake', 'swamp'], time: 'any', cm: [10, 32], g: 9, mv: { s: 'smooth', sp: 0.25, dt: 0.15 },
    a: { b: '#b8a060', t: '#6a5a2a', u: '#ece2b8', f: '#8a7a40', pat: 'scale', ar: 2.2 }, d: '느긋하고 순한 물고기. 초보 낚시꾼의 첫 손맛은 대개 붕어다.' },
  { id: 'loach', n: '진흙 미꾸라지', en: 'Mud Loach', r: 0, hab: ['swamp', 'pond'], time: 'any', cm: [8, 20], g: 8, mv: { s: 'mixed', sp: 0.45, dt: 0.4 },
    a: { b: '#8a7a50', t: '#4a3a20', u: '#c8b888', f: '#6a5a30', pat: 'spot', sc: '#3a2a14', ar: 6.2, wh: 1, tail: 'round' }, d: '진흙 속을 파고드는 미끈한 물고기. 손에서 자꾸 빠져나간다.' },
  { id: 'smelt', n: '얼음 빙어', en: 'Ice Smelt', r: 0, hab: ['ice'], time: 'any', cm: [7, 15], g: 14, mv: { s: 'dart', sp: 0.45, dt: 0.35 },
    a: { b: '#d8eef8', t: '#8ab8d0', u: '#ffffff', f: '#bcdcec', pat: 'band', bc: '#9ad0ff', ar: 4.4, trans: 1 }, d: '몸이 비칠 만큼 투명한 물고기. 얼음 구멍 아래로 떼 지어 다닌다.' },
  { id: 'crayfish', n: '눈물 가재', en: 'Tear Crayfish', r: 0, hab: ['canyon'], time: 'any', cm: [6, 16], g: 12, mv: { s: 'sink', sp: 0.35, dt: 0.3 },
    a: { kind: 'craw', b: '#d04a2a', t: '#8a2a14', u: '#f0a070' }, d: '울음바위에서 떨어지는 물방울 아래 사는 가재. 집게가 꽤 아프다.' },
  { id: 'coinfish', n: '동전 금붕어', en: 'Coin Goldfish', r: 0, hab: ['fountain'], time: 'any', cm: [6, 14], g: 10, mv: { s: 'float', sp: 0.3, dt: 0.25 },
    a: { b: '#ff9a3a', t: '#e0601a', u: '#ffe0a0', f: '#ffb860', pat: 'plain', ar: 2.0, tail: 'fan' }, d: '광장 분수에 던져진 동전을 먹고 자랐다는 소문이 있다. 물론 거짓말이다.' },
  { id: 'trout', n: '은빛 송어', en: 'Silver Trout', r: 1, hab: ['lake', 'river'], time: 'day', cm: [25, 55], g: 32, mv: { s: 'dart', sp: 0.5, dt: 0.4 },
    a: { b: '#c8d8e0', t: '#6a8a9a', u: '#f4f8fa', f: '#9ab0bc', pat: 'trout', bc: '#f0a0b0', sc: '#3a4a5a', ar: 3.2 }, d: '은빛 호수의 이름이 된 물고기. 햇빛 아래에서 비늘이 거울처럼 빛난다.' },
  { id: 'reedbass', n: '갈대 농어', en: 'Reed Bass', r: 1, hab: ['reed', 'river'], time: 'any', cm: [22, 50], g: 30, mv: { s: 'mixed', sp: 0.5, dt: 0.45 },
    a: { b: '#8aa860', t: '#3a5a28', u: '#e0e8c0', f: '#6a8a40', pat: 'bars', sc: '#2a4018', ar: 2.8 }, d: '갈대숲에 숨어 있다가 번개처럼 먹이를 낚아챈다.' },
  { id: 'catfish', n: '늪 메기', en: 'Mire Catfish', r: 1, hab: ['swamp'], time: 'any', night: 2, cm: [40, 110], g: 45, mv: { s: 'sink', sp: 0.45, dt: 0.35 },
    a: { b: '#5a5a48', t: '#2a2a20', u: '#a8a088', f: '#3a3a2a', pat: 'spot', sc: '#1a1a12', ar: 4.0, wh: 2, tail: 'round', flat: 1 }, d: '늪 바닥에 사는 커다란 메기. 밤이면 수염으로 먹이를 더듬으며 올라온다.' },
  { id: 'redcarp', n: '붉은 비늘 잉어', en: 'Redscale Carp', r: 1, hab: ['canyon'], time: 'day', cm: [25, 60], g: 38, mv: { s: 'smooth', sp: 0.45, dt: 0.3 },
    a: { b: '#d86a3a', t: '#8a2a14', u: '#f8c890', f: '#c04a2a', pat: 'scale', ar: 2.5, wh: 1 }, d: '붉은 협곡의 흙빛을 닮은 잉어. 협곡 사람들은 행운의 상징으로 여긴다.' },
  { id: 'mandarin', n: '속삭임 쏘가리', en: 'Whisper Perch', r: 1, hab: ['spring'], time: 'any', cm: [20, 45], g: 36, mv: { s: 'dart', sp: 0.55, dt: 0.45 },
    a: { b: '#c8a050', t: '#6a5020', u: '#f0e0a0', f: '#a07a30', pat: 'leopard', sc: '#4a3010', ar: 2.9 }, d: '샘물 바위틈에 사는 얼룩무늬 물고기. 물소리를 흉내 낸다는 전설이 있다.' },
  { id: 'pike', n: '호수 꼬치고기', en: 'Lake Pike', r: 1, hab: ['lake'], time: 'any', dawnB: 2, cm: [50, 120], g: 48, mv: { s: 'dart', sp: 0.6, dt: 0.5 },
    a: { b: '#7a9a50', t: '#2a4a20', u: '#e0e8b8', f: '#5a7a30', pat: 'spot', sc: '#d8e8a0', ar: 5.0, snout: 1 }, d: '긴 주둥이의 사냥꾼. 새벽과 해 질 녘에 가장 사납다.' },
  { id: 'ayu', n: '개울 은어', en: 'Brook Sweetfish', r: 1, hab: ['river'], time: 'day', cm: [15, 30], g: 34, mv: { s: 'mixed', sp: 0.55, dt: 0.5 },
    a: { b: '#b0b890', t: '#5a6a40', u: '#f0f0d8', f: '#d8c050', pat: 'dot1', sc: '#ffd040', ar: 3.8 }, d: '맑은 개울에서만 사는 물고기. 수박 향이 난다고 한다.' },
  { id: 'rainbow', n: '무지개 송어', en: 'Rainbow Trout', r: 2, hab: ['river', 'spring'], time: 'dawn', cm: [30, 70], g: 95, mv: { s: 'dart', sp: 0.6, dt: 0.55 },
    a: { b: '#b8c8b0', t: '#4a6a5a', u: '#f4f0e8', f: '#9ab09a', pat: 'rainbow', sc: '#2a3a30', ar: 3.2 }, d: '해가 뜨고 질 때만 모습을 드러내는 송어. 옆구리에 무지개가 흐른다.' },
  { id: 'misteel', n: '안개 장어', en: 'Mist Eel', r: 2, hab: ['swamp'], time: 'night', cm: [60, 150], g: 110, mv: { s: 'mixed', sp: 0.7, dt: 0.55 },
    a: { b: '#6a6088', t: '#2a2448', u: '#b8b0d0', f: '#4a4070', pat: 'plain', ar: 9, tail: 'eel', eye: '#c8ff7a', glow: '#9a7aff' }, d: '안개 낀 밤에만 수면 가까이 올라오는 장어. 눈이 반딧불처럼 빛난다.' },
  { id: 'frostsalmon', n: '서리 연어', en: 'Frost Salmon', r: 2, hab: ['ice'], time: 'any', cm: [45, 95], g: 120, mv: { s: 'dart', sp: 0.65, dt: 0.5 },
    a: { b: '#f0a8a0', t: '#5a8ab8', u: '#fff0ea', f: '#8ab0d0', pat: 'frost', sc: '#e8f8ff', ar: 3.3 }, d: '얼음 호수 밑을 헤엄치는 연어. 등에 서리꽃 무늬가 피어 있다.' },
  { id: 'fairyfish', n: '요정 송사리', en: 'Fairy Medaka', r: 2, hab: ['spring'], time: 'night', cm: [3, 6], g: 130, mv: { s: 'dart', sp: 0.85, dt: 0.7 },
    a: { b: '#9ffcff', t: '#3ac8e0', u: '#f0ffff', f: '#c8ffff', pat: 'plain', ar: 3.0, glow: '#7ff8ff', trans: 1 }, d: '밤의 샘에서 반짝이는 손가락만 한 물고기. 요정들이 키운다고 한다.' },
  { id: 'moonjelly', n: '달빛 해파리', en: 'Moonlight Jelly', r: 2, hab: ['deep'], time: 'night', cm: [10, 30], g: 140, mv: { s: 'float', sp: 0.35, dt: 0.3 },
    a: { kind: 'jelly', b: '#c8d8ff', t: '#8a9aff', u: '#ffffff', glow: '#b8c8ff' }, d: '보름달이 뜨면 호수의 정자 아래로 떠오르는 민물 해파리.' },
  { id: 'koi', n: '비단 잉어', en: 'Silk Koi', r: 2, hab: ['pond', 'fountain'], time: 'any', cm: [30, 80], g: 100, mv: { s: 'smooth', sp: 0.55, dt: 0.4 },
    a: { b: '#fff6ee', t: '#f0e0d0', u: '#ffffff', f: '#ffe8d8', pat: 'koi', sc: '#e83a2a', ar: 2.6, wh: 1 }, d: '흰 바탕에 붉은 무늬가 수놓인 잉어. 같은 무늬는 하나도 없다.' },
  { id: 'runegold', n: '룬 비늘 금붕어', en: 'Rune Goldfish', r: 2, hab: ['fountain'], time: 'any', cm: [10, 25], g: 150, mv: { s: 'float', sp: 0.65, dt: 0.55 },
    a: { b: '#ffd060', t: '#e08a20', u: '#fff4c0', f: '#ffe090', pat: 'rune', sc: '#7ff8ff', ar: 2.0, tail: 'fan', glow: '#7ff3ff' }, d: '룬 크리스탈의 빛을 받아 비늘에 룬이 새겨진 금붕어.' },
  { id: 'goldcarp', n: '황금 잉어', en: 'Golden Carp', r: 3, hab: ['pond', 'lake', 'fountain'], time: 'day', cm: [50, 100], g: 380, mv: { s: 'mixed', sp: 0.7, dt: 0.6 },
    a: { b: '#ffd23a', t: '#c08a10', u: '#fff4b0', f: '#ffc020', pat: 'scale', ar: 2.4, wh: 1, glow: '#ffd060', shine: 1 }, d: '천 마리에 한 마리 나온다는 황금빛 잉어. 잡으면 한 해 내내 운이 좋다.' },
  { id: 'crystalchar', n: '수정 곤들매기', en: 'Crystal Char', r: 3, hab: ['ice'], time: 'night', cm: [40, 90], g: 420, mv: { s: 'dart', sp: 0.8, dt: 0.65 },
    a: { b: '#bfe8ff', t: '#5ab0e0', u: '#f4fcff', f: '#9ad8ff', pat: 'crystal', sc: '#ffffff', ar: 3.4, glow: '#9ae0ff', trans: 1 }, d: '얼음 호수 깊은 곳의 수정처럼 투명한 물고기. 별빛을 머금고 산다.' },
  { id: 'sturgeon', n: '협곡 철갑상어', en: 'Canyon Sturgeon', r: 3, hab: ['canyon'], time: 'dawn', cm: [90, 200], g: 450, mv: { s: 'sink', sp: 0.75, dt: 0.6 },
    a: { b: '#8a8478', t: '#4a4438', u: '#d8d0c0', f: '#6a6458', pat: 'plates', sc: '#c8c0a8', ar: 4.6, snout: 1, wh: 1 }, d: '공룡 시대부터 살아온 갑옷 물고기. 붉은 노을에만 웅덩이 위로 올라온다.' },
  { id: 'lakelord', n: '호수의 주인', en: 'Lord of Silvermere', r: 4, hab: ['deep'], time: 'night', rod: 2, cm: [180, 280], g: 3200, mv: { s: 'boss', sp: 0.95, dt: 0.85 },
    a: { b: '#5a7a9a', t: '#1a2a40', u: '#c8d8e8', f: '#3a5070', pat: 'lord', sc: '#e8f4ff', ar: 3.0, wh: 2, crown: 1, glow: '#9ad0ff', scar: 1 }, d: '은빛 호수 밑바닥에 산다는 전설의 물고기. 노아가 평생을 쫓아온 그림자.' },
  { id: 'ancient', n: '늪의 고대어', en: 'Mire Coelacanth', r: 4, hab: ['swamp'], time: 'night', rod: 2, cm: [150, 230], g: 2800, mv: { s: 'boss', sp: 0.9, dt: 0.8 },
    a: { b: '#3a5a8a', t: '#1a2a4a', u: '#8aa0c0', f: '#2a4a7a', pat: 'spot', sc: '#e8f0ff', ar: 3.2, tail: 'lobe', glow: '#7ab0ff', lobe: 1 }, d: '가라앉은 신전보다 오래 살았다는 고대어. 지느러미가 팔다리처럼 생겼다.' },
  { id: 'frostfang', n: '서리 이빨', en: 'Frostfang', r: 4, hab: ['ice'], time: 'any', rod: 3, cm: [160, 240], g: 3600, mv: { s: 'boss', sp: 1, dt: 0.9 },
    a: { b: '#e0f0ff', t: '#7ab0e0', u: '#ffffff', f: '#a8d8ff', pat: 'frost', sc: '#ffffff', ar: 4.8, snout: 1, fang: 1, glow: '#bfe8ff' }, d: '서리 거룡의 비늘을 먹고 자랐다는 거대한 꼬치고기. 이빨이 얼음 송곳 같다.' },
];
const FBY = {}; FISH.forEach((f, i) => { f.i = i; FBY[f.id] = f; });
// 잡동사니 · 보물 (도감에는 없어요)
const JUNK = [
  { id: 'boot', n: '낡은 장화', r: 0, junk: 1, cm: [24, 30], g: 1, a: { kind: 'boot' }, d: '누군가 잃어버린 장화. 안에서 올챙이가 헤엄친다.' },
  { id: 'bottle', n: '룬 병편지', r: 2, junk: 1, cm: [20, 26], g: 0, a: { kind: 'bottle' }, d: '병 속에 쪽지와 골드가 들어 있다! 「이걸 줍는 행운의 모험가에게」' },
  { id: 'coin', n: '반짝이는 동전', r: 1, junk: 1, cm: [2, 3], g: 0, a: { kind: 'coin' }, d: '분수에 던져진 소원의 동전. 소원은 이루어졌을까?' },
];
JUNK.forEach(j => { FBY[j.id] = j; });
const HABN = { pond: '마을 연못', lake: '은빛 호수', deep: '호수 깊은 곳 (정자 · 남쪽)', reed: '갈대 물가', river: '개울 (은빛 · 갈대)', swamp: '안개 늪', spring: '속삭이는 샘', canyon: '울음바위 웅덩이', ice: '얼음 호수', fountain: '룬의 광장 분수' };
const TIMEN = { any: '언제나', day: '☀ 낮', night: '🌙 밤', dawn: '🌅 새벽 · 노을' };
// 낚시터 → 서식지
const SPOT_HAB = { f_pond: ['pond'], f_south: ['lake', 'deep'], f_west: ['lake', 'reed'], f_pavilion: ['lake', 'deep'], f_mane: ['river'], f_reed: ['river', 'reed'], f_swamp: ['swamp'], f_spring: ['spring'], f_weep: ['canyon'], f_ice: ['ice'], plaza: ['fountain'] };
// 낚싯대 5단계
const RODS = [
  { n: '나무 낚싯대', zone: 0.25, bite: 0.95, rare: 1, price: 0, col: 0x8a5a2e, glow: 0, d: '노아가 빌려준 손때 묻은 낚싯대.' },
  { n: '대나무 낚싯대', zone: 0.29, bite: 1.05, rare: 1.2, price: 600, req: { lv: 3 }, col: 0xc8b060, glow: 0, d: '가볍고 잘 휘어서 손맛이 좋다.' },
  { n: '은빛 낚싯대', zone: 0.33, bite: 1.15, rare: 1.45, price: 3000, req: { lv: 6, dex: 6 }, col: 0xd8e4ec, glow: 0, d: '은빛 호수의 물빛을 담금질한 낚싯대. 전설의 물고기가 반응한다.' },
  { n: '룬 낚싯대', zone: 0.37, bite: 1.25, rare: 1.8, price: 12000, req: { lv: 10, dex: 12 }, col: 0x2a3448, glow: 0x7ff3ff, d: '룬이 새겨진 낚싯대. 줄이 끊어지지 않는다고 한다.' },
  { n: '「호수의 노래」', zone: 0.43, bite: 1.4, rare: 2.2, price: 40000, req: { lv: 15, dex: 18 }, col: 0xfff0c8, glow: 0xffd36a, d: '노아의 스승이 남긴 전설의 낚싯대. 물고기가 노래에 이끌려 온다.' },
];
const FMAXLV = 20;
const fneed = lv => Math.round(40 * Math.pow(lv, 1.45));
const dexN = () => FISH.filter(f => S.fish.log[f.id]).length;
const rod = () => RODS[clamp(S.fish.rod | 0, 0, RODS.length - 1)];
const basketCap = () => 30 + (S.fish.rod | 0) * 10;
const fishPrice = (f, cm, pf) => { if (f.junk) return f.g; const k = (cm - f.cm[0]) / Math.max(1, f.cm[1] - f.cm[0]); return Math.max(1, Math.round(f.g * (0.7 + 0.7 * k) * (pf ? 1.3 : 1))); };
const stars = r => '★'.repeat(r + 1) + '<i>' + '★'.repeat(4 - r) + '</i>';
// 지금 시간대 (world 의 낮밤 · 없으면 실제 시계)
function phase(){ const t = F.timeOfDay != null ? F.timeOfDay : ((Date.now() / 60000) % 24) / 24; return t < 0.2 || t > 0.8 ? 'night' : (t < 0.3 || t > 0.7) ? 'dawn' : 'day'; }
const timeOk = (f, ph) => f.time === 'any' || f.time === ph || (f.time === 'dawn' && ph === 'dawn');

// ── 물고기 그림 (캔버스 · 종마다 다른 모양 · 무늬) ──
function bodyPath(x, L, H, a){
  const n = a.snout ? 0.56 : 0.5, tb = a.tail === 'eel' ? -0.5 : -0.4, fl = a.flat ? 0.85 : 1;
  x.beginPath(); x.moveTo(L * n, a.flat ? H * 0.05 : 0);
  x.bezierCurveTo(L * (n - 0.06), -H * 0.6 * fl, -L * 0.08, -H * 0.66, L * tb, -H * 0.13);
  x.lineTo(L * tb, H * 0.13);
  x.bezierCurveTo(-L * 0.08, H * 0.6, L * (n - 0.08), H * 0.55, L * n, a.flat ? H * 0.05 : 0); x.closePath();
}
function drawFishArt(x, f, Wd, Hd){
  const a = f.a; x.save(); x.translate(Wd / 2, Hd / 2);
  if (a.kind){ drawSpecial(x, a, Wd, Hd); x.restore(); return; }
  const L = Wd * 0.8, H = L / (a.ar || 2.6) * (a.ar > 6 ? 1.6 : 1), tb = a.tail === 'eel' ? -0.5 : -0.4;
  x.lineJoin = 'round'; x.lineCap = 'round';
  if (a.glow){ x.shadowColor = a.glow; x.shadowBlur = Wd * 0.07; }
  // 꼬리
  x.fillStyle = a.f; x.globalAlpha = a.trans ? 0.8 : 1; x.beginPath();
  const tx = L * tb + 2;
  if (a.tail === 'round'){ x.moveTo(tx, -H * 0.1); x.quadraticCurveTo(tx - L * 0.22, -H * 0.55, tx - L * 0.16, 0); x.quadraticCurveTo(tx - L * 0.22, H * 0.55, tx, H * 0.1); }
  else if (a.tail === 'fan'){ x.moveTo(tx, 0); x.bezierCurveTo(tx - L * 0.3, -H * 1.1, tx - L * 0.42, -H * 0.2, tx - L * 0.26, 0); x.bezierCurveTo(tx - L * 0.42, H * 0.2, tx - L * 0.3, H * 1.1, tx, 0); }
  else if (a.tail === 'eel'){ x.moveTo(tx, -H * 0.14); x.quadraticCurveTo(tx - L * 0.1, 0, tx, H * 0.14); }
  else if (a.tail === 'lobe'){ x.moveTo(tx, -H * 0.12); x.lineTo(tx - L * 0.14, -H * 0.5); x.lineTo(tx - L * 0.12, -H * 0.1); x.lineTo(tx - L * 0.2, 0); x.lineTo(tx - L * 0.12, H * 0.1); x.lineTo(tx - L * 0.14, H * 0.5); x.lineTo(tx, H * 0.12); }
  else { x.moveTo(tx, -H * 0.1); x.lineTo(tx - L * 0.16, -H * 0.6); x.quadraticCurveTo(tx - L * 0.1, 0, tx - L * 0.16, H * 0.6); x.lineTo(tx, H * 0.1); }
  x.closePath(); x.fill();
  // 등 · 배 지느러미
  x.beginPath();
  if (a.tail === 'eel'){ x.moveTo(L * 0.1, -H * 0.45); x.quadraticCurveTo(-L * 0.2, -H * 0.85, tx, -H * 0.15); x.lineTo(tx, H * 0.15); x.quadraticCurveTo(-L * 0.2, H * 0.8, L * 0.0, H * 0.42); }
  else { x.moveTo(L * 0.12, -H * 0.5); x.quadraticCurveTo(-L * 0.02, -H * (a.lobe ? 1.0 : 0.95), -L * 0.18, -H * 0.42); x.closePath(); x.moveTo(-L * 0.06, H * 0.45); x.quadraticCurveTo(-L * 0.16, H * 0.82, -L * 0.24, H * 0.32); x.closePath(); }
  x.fill(); x.globalAlpha = 1;
  // 몸통
  const gr = x.createLinearGradient(0, -H * 0.6, 0, H * 0.6); gr.addColorStop(0, a.t); gr.addColorStop(0.45, a.b); gr.addColorStop(1, a.u);
  bodyPath(x, L, H, a); x.fillStyle = gr; if (a.trans) x.globalAlpha = 0.85; x.fill(); x.globalAlpha = 1; x.shadowBlur = 0;
  // 무늬 (몸통 안에서만)
  x.save(); bodyPath(x, L, H, a); x.clip(); pattern(x, a, L, H, f.i * 7 + 3); x.restore();
  // 윤곽
  bodyPath(x, L, H, a); x.strokeStyle = 'rgba(10,16,24,.55)'; x.lineWidth = Math.max(1.2, Wd * 0.008); x.stroke();
  // 아가미 · 가슴지느러미
  x.strokeStyle = 'rgba(10,16,24,.35)'; x.beginPath(); x.arc(L * 0.3, 0, H * 0.34, -1.1, 1.1); x.stroke();
  x.fillStyle = a.f; x.globalAlpha = 0.85; x.beginPath(); x.ellipse(L * 0.16, H * 0.18, L * 0.08, H * 0.1, 0.5, 0, TAU); x.fill(); x.globalAlpha = 1;
  if (a.lobe){ x.fillStyle = a.f; for (const s of [-1, 1]){ x.beginPath(); x.ellipse(-L * 0.05, s * H * 0.5, L * 0.07, H * 0.12, s * 0.6, 0, TAU); x.fill(); } }
  // 눈
  const ex = L * (a.snout ? 0.42 : 0.36), ey = -H * (a.flat ? 0.02 : 0.1), er = Math.max(2.5, H * (a.ar > 6 ? 0.1 : 0.12));
  x.fillStyle = '#fff'; x.beginPath(); x.arc(ex, ey, er, 0, TAU); x.fill();
  x.fillStyle = a.eye || '#10141c'; if (a.eye){ x.shadowColor = a.eye; x.shadowBlur = er * 3; } x.beginPath(); x.arc(ex + er * 0.15, ey, er * 0.62, 0, TAU); x.fill(); x.shadowBlur = 0;
  x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(ex + er * 0.35, ey - er * 0.3, er * 0.22, 0, TAU); x.fill();
  // 수염 · 이빨 · 왕관 · 흉터
  const sn = L * (a.snout ? 0.56 : 0.5);
  if (a.wh){ x.strokeStyle = a.t; x.lineWidth = Math.max(1, Wd * 0.006); x.beginPath(); for (let k = 0; k < a.wh; k++){ x.moveTo(sn - 3, H * 0.06); x.quadraticCurveTo(sn + L * 0.05, H * (0.3 + k * 0.2), sn - L * 0.02, H * (0.5 + k * 0.25)); } x.stroke(); }
  if (a.fang){ x.fillStyle = '#fff'; for (let k = 0; k < 3; k++){ x.beginPath(); x.moveTo(sn - 6 - k * 7, 1); x.lineTo(sn - 3 - k * 7, H * 0.16); x.lineTo(sn - k * 7, 1); x.fill(); } }
  if (a.scar){ x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = Math.max(1.5, Wd * 0.007); x.beginPath(); x.moveTo(L * 0.05, -H * 0.4); x.lineTo(-L * 0.08, H * 0.05); x.moveTo(-L * 0.02, -H * 0.4); x.lineTo(-L * 0.14, H * 0.02); x.stroke(); }
  if (a.crown){ x.fillStyle = '#ffd36a'; x.shadowColor = '#ffb03a'; x.shadowBlur = Wd * 0.04; const cx = L * 0.3, cy = -H * 0.5, s = H * 0.28;
    x.beginPath(); x.moveTo(cx - s, cy); x.lineTo(cx - s, cy - s * 0.9); x.lineTo(cx - s * 0.5, cy - s * 0.45); x.lineTo(cx, cy - s * 1.15); x.lineTo(cx + s * 0.5, cy - s * 0.45); x.lineTo(cx + s, cy - s * 0.9); x.lineTo(cx + s, cy); x.closePath(); x.fill(); x.shadowBlur = 0; }
  if (a.shine){ const sg = x.createLinearGradient(-L * 0.3, -H, L * 0.2, H); sg.addColorStop(0.35, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,.55)'); sg.addColorStop(0.65, 'rgba(255,255,255,0)'); x.save(); bodyPath(x, L, H, a); x.clip(); x.fillStyle = sg; x.fillRect(-L, -H, L * 2, H * 2); x.restore(); }
  x.restore();
}
function pattern(x, a, L, H, seed){
  let s = seed; const sr = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const sc = a.sc || a.t;
  switch (a.pat){
    case 'band': x.fillStyle = a.bc; x.globalAlpha = 0.55; x.fillRect(-L, -H * 0.06, L * 2, H * 0.14); x.globalAlpha = 1; break;
    case 'scale': x.strokeStyle = 'rgba(40,24,0,.22)'; x.lineWidth = 1.2; for (let i = -L * 0.45; i < L * 0.45; i += H * 0.2) for (let j = -H * 0.6; j < H * 0.6; j += H * 0.2){ x.beginPath(); x.arc(i + (Math.round(j / (H * 0.2)) % 2) * H * 0.1, j, H * 0.11, -1.3, 1.3); x.stroke(); } break;
    case 'spot': x.fillStyle = sc; for (let i = 0; i < 26; i++){ x.globalAlpha = 0.55 + sr() * 0.4; x.beginPath(); x.arc(-L * 0.4 + sr() * L * 0.75, -H * 0.5 + sr() * H * 0.85, H * (0.03 + sr() * 0.05), 0, TAU); x.fill(); } x.globalAlpha = 1; break;
    case 'trout': x.fillStyle = a.bc; x.globalAlpha = 0.5; x.fillRect(-L, -H * 0.08, L * 2, H * 0.16); x.globalAlpha = 1; x.fillStyle = sc; for (let i = 0; i < 30; i++){ x.beginPath(); x.arc(-L * 0.42 + sr() * L * 0.8, -H * 0.5 + sr() * H * 0.5, H * 0.025, 0, TAU); x.fill(); } break;
    case 'bars': x.fillStyle = sc; x.globalAlpha = 0.45; for (let i = 0; i < 6; i++){ x.beginPath(); x.ellipse(-L * 0.3 + i * L * 0.12, -H * 0.1, L * 0.035, H * 0.45, 0.15, 0, TAU); x.fill(); } x.globalAlpha = 1; break;
    case 'leopard': x.strokeStyle = sc; x.lineWidth = 2; x.globalAlpha = 0.7; for (let i = 0; i < 14; i++){ x.beginPath(); x.ellipse(-L * 0.38 + sr() * L * 0.7, -H * 0.42 + sr() * H * 0.7, H * 0.07, H * 0.05, sr() * 3, 0, TAU); x.stroke(); } x.globalAlpha = 1; break;
    case 'dot1': x.fillStyle = sc; x.shadowColor = sc; x.shadowBlur = 8; x.beginPath(); x.ellipse(L * 0.18, -H * 0.02, H * 0.12, H * 0.08, 0, 0, TAU); x.fill(); x.shadowBlur = 0; break;
    case 'rainbow': { const g = x.createLinearGradient(-L * 0.4, 0, L * 0.4, 0); ['#ff6a8a', '#ffb050', '#fff070', '#7aff9a', '#6ac8ff', '#b07aff'].forEach((c, i) => g.addColorStop(i / 5, c)); x.fillStyle = g; x.globalAlpha = 0.7; x.fillRect(-L, -H * 0.1, L * 2, H * 0.22); x.globalAlpha = 1; x.fillStyle = sc; for (let i = 0; i < 26; i++){ x.beginPath(); x.arc(-L * 0.42 + sr() * L * 0.8, -H * 0.5 + sr() * H * 0.4, H * 0.025, 0, TAU); x.fill(); } break; }
    case 'frost': x.strokeStyle = sc; x.lineWidth = 1.4; x.globalAlpha = 0.8; for (let i = 0; i < 7; i++){ const cx = -L * 0.35 + sr() * L * 0.65, cy = -H * 0.45 + sr() * H * 0.3, r = H * (0.07 + sr() * 0.06); x.beginPath(); for (let k = 0; k < 3; k++){ const an = k * Math.PI / 3; x.moveTo(cx - Math.cos(an) * r, cy - Math.sin(an) * r); x.lineTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r); } x.stroke(); } x.globalAlpha = 1; break;
    case 'koi': x.fillStyle = sc; for (let i = 0; i < 4; i++){ x.beginPath(); x.ellipse(-L * 0.3 + sr() * L * 0.6, -H * 0.3 + sr() * H * 0.4, L * (0.08 + sr() * 0.07), H * (0.18 + sr() * 0.12), sr() * 3, 0, TAU); x.fill(); } x.fillStyle = '#1a1a1a'; for (let i = 0; i < 3; i++){ x.beginPath(); x.ellipse(-L * 0.2 + sr() * L * 0.4, -H * 0.4 + sr() * H * 0.3, L * 0.03, H * 0.07, sr() * 3, 0, TAU); x.fill(); } break;
    case 'rune': x.strokeStyle = sc; x.lineWidth = 2; x.shadowColor = sc; x.shadowBlur = 10; for (let i = 0; i < 3; i++) G.drawRune(x, i * 5 + 2, -L * 0.22 + i * L * 0.2, -H * 0.05, H * 0.42); x.shadowBlur = 0; break;
    case 'crystal': x.strokeStyle = sc; x.lineWidth = 1.3; x.globalAlpha = 0.75; x.beginPath(); for (let i = -4; i < 6; i++){ x.moveTo(i * L * 0.09, -H); x.lineTo(i * L * 0.09 + L * 0.12, H); x.moveTo(i * L * 0.09 + L * 0.12, -H); x.lineTo(i * L * 0.09, H); } x.stroke(); x.globalAlpha = 1; break;
    case 'plates': x.fillStyle = sc; for (let i = 0; i < 8; i++){ const px = -L * 0.38 + i * L * 0.1; for (const yy of [-H * 0.42, 0.02]){ x.beginPath(); x.moveTo(px, yy); x.lineTo(px + L * 0.035, yy - H * 0.08); x.lineTo(px + L * 0.07, yy); x.lineTo(px + L * 0.035, yy + H * 0.07); x.closePath(); x.fill(); } } break;
    case 'lord': { x.fillStyle = 'rgba(200,230,255,.25)'; for (let i = -L * 0.45; i < L * 0.45; i += H * 0.16) for (let j = -H * 0.6; j < H * 0.6; j += H * 0.16){ x.beginPath(); x.arc(i + (Math.round(j / (H * 0.16)) % 2) * H * 0.08, j, H * 0.07, 0, TAU); x.fill(); }
      x.strokeStyle = sc; x.globalAlpha = 0.7; x.lineWidth = 2; x.beginPath(); x.moveTo(-L * 0.4, -H * 0.02); x.bezierCurveTo(-L * 0.1, -H * 0.12, L * 0.1, H * 0.08, L * 0.36, -H * 0.02); x.stroke(); x.globalAlpha = 1; break; }
  }
}
function drawSpecial(x, a, Wd, Hd){
  const s = Wd * 0.5;
  if (a.kind === 'craw'){
    x.rotate(-0.1); x.fillStyle = a.b; x.strokeStyle = 'rgba(40,10,0,.6)'; x.lineWidth = 2;
    for (let i = 0; i < 5; i++){ x.beginPath(); x.ellipse(-s * 0.15 - i * s * 0.13, 0, s * 0.09, s * 0.17 - i * s * 0.015, 0, 0, TAU); x.fill(); x.stroke(); }
    x.beginPath(); x.moveTo(-s * 0.7, 0); x.lineTo(-s * 0.88, -s * 0.16); x.lineTo(-s * 0.9, s * 0.16); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.ellipse(s * 0.12, 0, s * 0.24, s * 0.16, 0, 0, TAU); x.fill(); x.stroke();
    for (const k of [-1, 1]){ x.beginPath(); x.moveTo(s * 0.3, k * s * 0.08); x.quadraticCurveTo(s * 0.5, k * s * 0.3, s * 0.62, k * s * 0.22); x.lineWidth = s * 0.05; x.strokeStyle = a.t; x.stroke();
      x.fillStyle = a.b; x.beginPath(); x.ellipse(s * 0.72, k * s * 0.24, s * 0.14, s * 0.08, k * 0.3, 0, TAU); x.fill(); x.lineWidth = 2; x.strokeStyle = 'rgba(40,10,0,.6)'; x.stroke();
      x.beginPath(); x.moveTo(s * 0.32, k * s * 0.05); x.quadraticCurveTo(s * 0.8, k * s * 0.04, s * 0.98, k * s * 0.42); x.lineWidth = 1.2; x.stroke(); }
    x.fillStyle = '#111'; for (const k of [-1, 1]){ x.beginPath(); x.arc(s * 0.3, k * s * 0.07, s * 0.03, 0, TAU); x.fill(); }
    x.fillStyle = 'rgba(160,220,255,.9)'; x.beginPath(); x.arc(s * 0.36, s * 0.13, s * 0.025, 0, TAU); x.fill();
  } else if (a.kind === 'jelly'){
    x.shadowColor = a.glow; x.shadowBlur = Wd * 0.1;
    const g = x.createRadialGradient(0, -s * 0.15, s * 0.05, 0, -s * 0.05, s * 0.4); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.6, a.b); g.addColorStop(1, 'rgba(140,160,255,.35)');
    x.fillStyle = g; x.beginPath(); x.moveTo(-s * 0.4, 0); x.bezierCurveTo(-s * 0.4, -s * 0.5, s * 0.4, -s * 0.5, s * 0.4, 0); for (let i = 0; i <= 8; i++) x.lineTo(s * 0.4 - i * s * 0.1, (i % 2) * s * 0.06); x.fill(); x.shadowBlur = 0;
    x.strokeStyle = 'rgba(200,215,255,.7)'; x.lineWidth = 2; for (let i = 0; i < 7; i++){ const px = -s * 0.32 + i * s * 0.106; x.beginPath(); x.moveTo(px, s * 0.04); x.bezierCurveTo(px + s * 0.08, s * 0.25, px - s * 0.08, s * 0.4, px + s * 0.04, s * 0.62); x.stroke(); }
    x.strokeStyle = 'rgba(255,240,255,.8)'; x.beginPath(); x.arc(0, -s * 0.12, s * 0.12, 0, TAU); x.moveTo(s * 0.06, -s * 0.12); x.arc(0, -s * 0.12, s * 0.06, 0, TAU); x.stroke();
  } else if (a.kind === 'boot'){
    x.fillStyle = '#6a4a2a'; x.strokeStyle = '#2a1a0a'; x.lineWidth = 3; x.beginPath(); x.moveTo(-s * 0.3, -s * 0.5); x.lineTo(s * 0.05, -s * 0.5); x.lineTo(s * 0.08, s * 0.05); x.quadraticCurveTo(s * 0.55, s * 0.05, s * 0.6, s * 0.28); x.lineTo(s * 0.6, s * 0.36); x.lineTo(-s * 0.34, s * 0.36); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#4a3018'; x.fillRect(-s * 0.36, s * 0.3, s * 0.98, s * 0.1); x.fillStyle = '#8a6a3a'; x.fillRect(-s * 0.33, -s * 0.52, s * 0.4, s * 0.08);
    x.fillStyle = 'rgba(120,200,240,.7)'; x.beginPath(); x.arc(-s * 0.1, -s * 0.62, s * 0.05, 0, TAU); x.arc(s * 0.0, -s * 0.74, s * 0.035, 0, TAU); x.fill();
  } else if (a.kind === 'bottle'){
    x.rotate(-0.35); const g = x.createLinearGradient(0, -s * 0.2, 0, s * 0.2); g.addColorStop(0, 'rgba(160,240,220,.85)'); g.addColorStop(1, 'rgba(60,160,140,.85)');
    x.fillStyle = g; x.strokeStyle = 'rgba(20,60,50,.8)'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(-s * 0.55, -s * 0.2); x.lineTo(s * 0.15, -s * 0.2); x.quadraticCurveTo(s * 0.3, -s * 0.2, s * 0.35, -s * 0.08); x.lineTo(s * 0.6, -s * 0.07); x.lineTo(s * 0.6, s * 0.07); x.lineTo(s * 0.35, s * 0.08); x.quadraticCurveTo(s * 0.3, s * 0.2, s * 0.15, s * 0.2); x.lineTo(-s * 0.55, s * 0.2); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#a8784a'; x.fillRect(s * 0.6, -s * 0.06, s * 0.1, s * 0.12);
    x.fillStyle = '#f4e8c8'; x.save(); x.rotate(0.08); x.fillRect(-s * 0.4, -s * 0.1, s * 0.5, s * 0.18); x.strokeStyle = '#c87a3a'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(-s * 0.15, -s * 0.1); x.lineTo(-s * 0.15, s * 0.08); x.stroke(); x.restore();
    x.strokeStyle = '#7ff3ff'; x.shadowColor = '#7ff3ff'; x.shadowBlur = 8; x.lineWidth = 1.5; G.drawRune(x, 4, -s * 0.3, 0, s * 0.12); x.shadowBlur = 0;
  } else if (a.kind === 'coin'){
    const g = x.createRadialGradient(-s * 0.08, -s * 0.08, s * 0.02, 0, 0, s * 0.34); g.addColorStop(0, '#fff8d0'); g.addColorStop(0.5, '#ffd36a'); g.addColorStop(1, '#b8862a');
    x.fillStyle = g; x.shadowColor = '#ffd36a'; x.shadowBlur = 14; x.beginPath(); x.arc(0, 0, s * 0.34, 0, TAU); x.fill(); x.shadowBlur = 0; x.strokeStyle = '#8a5a1a'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, s * 0.27, 0, TAU); x.stroke();
    x.strokeStyle = '#8a5a1a'; x.lineWidth = 3; G.drawRune(x, 9, 0, 0, s * 0.3);
  }
}
const ART = {};
function fishArt(id, sil){
  const k = id + '_' + (sil | 0); if (ART[k]) return ART[k];
  const f = FBY[id], c = G.cnv(256, 128), x = c.getContext('2d'); drawFishArt(x, f, 256, 128);
  if (sil){ x.globalCompositeOperation = 'source-in'; x.fillStyle = sil === 2 ? '#e4f6ff' : '#0e1a28'; x.fillRect(0, 0, 256, 128); x.globalCompositeOperation = 'source-over'; }
  return ART[k] = c;
}
const URLS = {};
const artURL = (id, sil) => URLS[id + '_' + (sil | 0)] || (URLS[id + '_' + (sil | 0)] = fishArt(id, sil).toDataURL());
const TEXS = {};
const artTex = id => TEXS[id] || (TEXS[id] = G.tex(fishArt(id), true, 1, 1));

// ═════════════════════════ 2. 낚시 도구 (3D) ═════════════════════════
const mStd = (c, o = {}) => G.std(Object.assign({ color: c, roughness: 0.6 }, o));
const M_BOB_R = mStd(0xe8302a, { roughness: 0.35 }), M_BOB_W = mStd(0xf4f0e8, { roughness: 0.35 }), M_CORK = mStd(0xb8875a, { roughness: 0.9 }), M_IRON = mStd(0x8a9098, { metalness: 0.7, roughness: 0.35 });
const M_TIP = new THREE.MeshBasicMaterial({ color: 0xffe08a, toneMapped: false });
const RING_M = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const RING_G = new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2);
function mkBobber(sc = 1){
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 8, 0, TAU, 0, Math.PI / 2), M_BOB_R); g.add(top);
  const bot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 8, 0, TAU, Math.PI / 2, Math.PI / 2), M_BOB_W); g.add(bot);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, 0.2, 5), M_BOB_R); st.position.y = 0.13; g.add(st);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), M_TIP); tip.position.y = 0.24; g.add(tip);
  g.scale.setScalar(sc); return g;
}
// 낚싯대: 세 마디 (휘어져요) · 끝에 줄을 매는 tip
const rodMats = {};
function rodMat(t){ return rodMats[t] || (rodMats[t] = mStd(RODS[t].col, t >= 2 ? { metalness: 0.55, roughness: 0.3 } : { roughness: 0.65 })); }
function mkRod(t){
  const T = RODS[t], g = new THREE.Group(), m = rodMat(t), segs = [];
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.42, 8), M_CORK); handle.position.y = -0.05; g.add(handle);
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 12), M_IRON); reel.rotation.z = Math.PI / 2; reel.position.set(0.05, 0.08, 0); g.add(reel);
  let parent = g, y0 = 0.16; const lens = [0.95, 0.8, 0.72], rad = [[0.024, 0.017], [0.017, 0.011], [0.011, 0.005]];
  for (let i = 0; i < 3; i++){
    const piv = new THREE.Group(); piv.position.y = i === 0 ? y0 : lens[i - 1]; parent.add(piv);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(rad[i][1], rad[i][0], lens[i], 6), m); s.position.y = lens[i] / 2; piv.add(s);
    if (t === 1){ const nd = new THREE.Mesh(new THREE.TorusGeometry(rad[i][0] * 1.05, 0.005, 4, 10), mStd(0x8a7a3a)); nd.rotation.x = Math.PI / 2; nd.position.y = lens[i] * 0.6; piv.add(nd); }
    if (T.glow){ const gl = new THREE.Mesh(new THREE.CylinderGeometry(rad[i][1] * 1.2, rad[i][0] * 1.2, lens[i] * 0.5, 6), new THREE.MeshBasicMaterial({ color: T.glow, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); gl.position.y = lens[i] * 0.5; piv.add(gl); }
    segs.push(piv); parent = piv;
  }
  const tip = new THREE.Object3D(); tip.position.y = lens[2]; parent.add(tip);
  g.userData = { tip, segs }; g.traverse(o => { if (o.isMesh) o.castShadow = false; }); return g;
}
// 줄 (낚싯대 끝 → 찌, 늘어지는 곡선)
const LN = 18, linePos = new Float32Array(LN * 3), lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
const LINE = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.75, toneMapped: false }));
LINE.frustumCulled = false; LINE.visible = false; G.scene.add(LINE);
const BOB = mkBobber(1.25); BOB.visible = false; G.scene.add(BOB);
const BOBGLOW = X.glowSprite(0xffe08a, 0.5, 0.0); BOB.add(BOBGLOW); BOBGLOW.position.y = 0.24;
// 파문 (재사용 풀)
const RIPS = []; for (let i = 0; i < 8; i++){ const m = new THREE.Mesh(RING_G, RING_M()); m.visible = false; m.frustumCulled = false; G.scene.add(m); RIPS.push({ m, t: 1, life: 1, s0: 0.2, s1: 1 }); }
function ripple(x, y, z, s0 = 0.15, s1 = 1.2, life = 0.9, op = 0.6){ let r = RIPS.find(o => o.t >= o.life) || RIPS[0]; r.m.position.set(x, y + 0.02, z); r.t = 0; r.life = life; r.s0 = s0; r.s1 = s1; r.op = op; r.m.visible = true; }
function updRipples(dt){ for (const r of RIPS){ if (r.t >= r.life){ r.m.visible = false; continue; } r.t += dt; const k = Math.min(1, r.t / r.life); r.m.scale.setScalar(lerp(r.s0, r.s1, 1 - (1 - k) * (1 - k))); r.m.material.opacity = r.op * (1 - k); } }
function splash(x, y, z, n = 14, sp = 2.2, col = 0xdff4ff){ for (let i = 0; i < n; i++){ const a = R() * TAU, v = rr(0.4, 1) * sp; X.emit(x, y + 0.05, z, Math.cos(a) * v * 0.5, rr(1.5, 3.2) * sp * 0.6, Math.sin(a) * v * 0.5, i % 3 ? col : 0xffffff, rr(0.07, 0.13), rr(0.45, 0.8), { grav: -9, drag: 0.6 }); } }
// 물 위로 튀어 오르는 물고기 (스프라이트)
const JUMP = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); JUMP.visible = false; G.scene.add(JUMP);
const HELD = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); HELD.visible = false; G.scene.add(HELD);
const HELDGLOW = X.glowSprite(0xffffff, 3, 0); HELDGLOW.visible = false; G.scene.add(HELDGLOW);

// ═════════════════════════ 3. 낚시터 ═════════════════════════
const SPOTS = [];
const surfY = (x, z, ice) => ice ? Math.max(F.H(x, z), F.groundFn(x, z)) + 0.02 : (F.waterY ? F.waterY(x, z) : W.water);
const wmod = () => F.modules && F.modules.world;
const isIce = (x, z) => { const w = wmod(); return !!(w && w.isIce && w.isIce(x, z)); };
const deepOk = (x, z) => F.isWater(x, z) && F.waterDepth(x, z) > 0.45;
// 낚시터 마크: 둥실 떠 있는 찌 + 파문 + 물가 표지판(병합) + 이름표 + 상호작용
const SIGNT = (() => { const c = G.cnv(256, 128), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#9a6a3c'); g.addColorStop(1, '#6a4422'); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = 'rgba(40,20,5,.35)'; x.lineWidth = 2; for (let i = 0; i < 6; i++){ x.beginPath(); x.moveTo(0, 12 + i * 21 + R() * 4); x.bezierCurveTo(80, 8 + i * 21, 170, 18 + i * 21, 256, 12 + i * 21); x.stroke(); }
  x.strokeStyle = '#3a2410'; x.lineWidth = 6; x.strokeRect(4, 4, 248, 120);
  drawFishArt(x, FBY.trout, 150, 80);
  x.font = "900 34px 'Gowun Batang', serif"; x.fillStyle = '#fff3d6'; x.textAlign = 'center'; x.strokeStyle = 'rgba(40,20,5,.8)'; x.lineWidth = 5; x.strokeText('낚시터', 178, 76); x.fillText('낚시터', 178, 76);
  return G.tex(c, true, 1, 1); })();
const M_SIGN = mStd(0xffffff, { map: SIGNT, roughness: 0.85 }), M_WOODD = mStd(0x5a3a1e, { roughness: 0.9 }), M_PAIL = mStd(0x7a8a90, { metalness: 0.5, roughness: 0.45 }), M_WATERP = mStd(0x3a7a9a, { roughness: 0.1 });
// 낚시터 자리 잡기: 서는 자리(물가 땅) · 찌를 던질 깊은 물 · 방향
const landOk = (x, z) => !F.isWater(x, z) && !isIce(x, z) && F.slope(x, z) < 0.75;
function locate(cx, cz){
  const ring = (ox, oz, d0, d1, step, n, ok) => { for (let d = d0; d <= d1; d += step) for (let k = 0; k < n; k++){ const a = k / n * TAU, x = ox + Math.cos(a) * d, z = oz + Math.sin(a) * d; if (ok(x, z, a, d)) return [x, z, a, d]; } return null; };
  // 얼음 낚시: 얼음 위에 서서 구멍을 뚫어요
  const iceSt = isIce(cx, cz) ? [cx, cz] : null, iceNear = iceSt ? null : ring(cx, cz, 1.5, 12, 1, 24, isIce);
  if (iceSt || iceNear){ const ox = cx, oz = cz, h = ring(ox, oz, 2.6, 14, 0.75, 32, (x, z) => isIce(x, z) && isIce(x + (x - ox) * 0.3, z + (z - oz) * 0.3));
    if (h) return { sx: ox, sz: oz, wx: h[0], wz: h[1], dir: h[2], ice: true }; }
  let sx = cx, sz = cz;
  if (!landOk(cx, cz)){ const l = ring(cx, cz, 1, 30, 0.75, 32, landOk); if (l){ sx = l[0]; sz = l[1]; } }
  const w = ring(sx, sz, 1.5, 45, 0.75, 48, (x, z) => deepOk(x, z));
  if (!w) return { sx, sz, wx: sx + 4, wz: sz, dir: 0, ice: false };
  const a = w[2], ca = Math.cos(a), sa = Math.sin(a);
  // 물이 멀면 물가까지 다가가요
  if (w[3] > 5){ let t = 0, lx = sx, lz = sz; for (; t < w[3]; t += 0.5){ const x = sx + ca * t, z = sz + sa * t; if (F.isWater(x, z)) break; lx = x; lz = z; } const back = Math.min(1.6, t * 0.5); sx = lx - ca * back; sz = lz - sa * back; }
  let t = 0; for (; t < 30; t += 0.5) if (deepOk(sx + ca * t, sz + sa * t)) break;
  t += 1.6; if (!F.isWater(sx + ca * t, sz + sa * t)) t -= 1.6;
  return { sx, sz, wx: sx + ca * t, wz: sz + sa * t, dir: a, ice: false };
}
function buildSpots(){
  const B = new G.Builder(), K = new G.Kit(B);
  for (const s of W.fishing){
    const loc = locate(s.c[0], s.c[1]), cx = loc.sx, cz = loc.sz, ice = loc.ice;
    const sp = { id: s.id, name: s.name, region: s.region, c: s.c, sx: cx, sz: cz, wx: loc.wx, wz: loc.wz, dir: loc.dir, ice, hab: SPOT_HAB[s.id] || ['lake'], jumpT: rr(3, 8) };
    sp.wy = surfY(sp.wx, sp.wz, ice);
    // 물가 표지판 (서는 자리 뒤 옆, 물 · 비탈이면 반대쪽)
    const ca = Math.cos(sp.dir), sa = Math.sin(sp.dir); let px = cx, pz = cz;
    for (const [b, sd] of [[1.3, 1.9], [1.3, -1.9], [2.2, 0], [0.4, 2.4]]){ const x = cx - ca * b + sa * sd, z = cz - sa * b - ca * sd; if (!F.isWater(x, z) && F.slope(x, z) < 0.8){ px = x; pz = z; break; } }
    const py = Math.max(F.H(px, pz), F.groundFn(px, pz)), ry = Math.atan2(-Math.cos(sp.dir), -Math.sin(sp.dir));
    K.push(px, py, pz, ry);
    K.box('wood', 0.13, 1.7, 0.13, 0, 0.75, 0); K.box('wood', 1.04, 0.54, 0.05, 0, 1.45, 0.08); K.geo('sign', new THREE.PlaneGeometry(1.0, 0.5), 0, 1.45, 0.106); K.geo('sign', new THREE.PlaneGeometry(1.0, 0.5), 0, 1.45, 0.054, 0, Math.PI); K.box('wood', 1.1, 0.07, 0.09, 0, 1.73, 0.08);
    K.geo('pail', new THREE.CylinderGeometry(0.2, 0.16, 0.32, 12, 1, true), 0.55, 0.16, 0.25); K.geo('water', new THREE.CircleGeometry(0.18, 12), 0.55, 0.27, 0.25, -Math.PI / 2);
    K.geo('wood', new THREE.CylinderGeometry(0.22, 0.24, 0.32, 10), -0.6, 0.16, 0.3); K.geo('wood', new THREE.CylinderGeometry(0.02, 0.02, 2.2, 4), -0.75, 1.0, -0.15, 0.25, 0, 0.35);
    K.pop();
    F.circle(px, pz, 0.25);
    // 물 위 마크 (거리로 켜고 꺼요)
    const g = new THREE.Group(); g.position.set(sp.wx, sp.wy, sp.wz); F.FW.add(g); sp.g = g;
    if (ice){ const hole = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20).rotateX(-Math.PI / 2), mStd(0x0a2a40, { roughness: 0.05 })); hole.position.y = 0.025; g.add(hole);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.09, 6, 20), mStd(0xe8f6ff, { roughness: 0.3 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.04; g.add(rim); }
    const fb = mkBobber(1.6); fb.position.y = 0.02; g.add(fb); sp.fb = fb;
    sp.rings = [0, 1].map(i => { const m = new THREE.Mesh(RING_G, RING_M()); m.position.y = 0.035; g.add(m); return m; });
    g.visible = false;
    sp.label = F.label({ pos: new V3(cx, py + 2.5, cz), text: '🎣 낚시터', sub: s.name, cls: 'place', max: 42 });
    sp.it = F.addInteract({ x: cx, z: cz, r: 5, title: `🎣 낚시하기 · ${s.name}`, action: () => startFishing(s.id) });
    SPOTS.push(sp);
  }
  B.build({ wood: M_WOODD, sign: M_SIGN, pail: M_PAIL, water: M_WATERP }, F.FW, false, true);
}
buildSpots();
// 광장 분수 낚시터 (분수 수반: 반지름 4.0 · 수면 y 0.72)
const PLAZA_A = 1.35, PLAZA = { id: 'plaza', name: '룬의 광장 분수', plaza: true, hab: SPOT_HAB.plaza, x: Math.cos(PLAZA_A) * 5.55, z: Math.sin(PLAZA_A) * 5.55, wy: 0.72 };
{
  const B = new G.Builder(), K = new G.Kit(B), sx = Math.cos(PLAZA_A + 0.3) * 6.2, sz = Math.sin(PLAZA_A + 0.3) * 6.2;
  K.push(sx, 0.04, sz, Math.atan2(sx, sz));
  K.box('wood', 0.1, 1.2, 0.1, -0.35, 0.6, 0); K.box('wood', 0.1, 1.2, 0.1, 0.35, 0.6, 0); K.box('wood', 0.94, 0.49, 0.04, 0, 0.95, 0.06); K.geo('sign', new THREE.PlaneGeometry(0.9, 0.45), 0, 0.95, 0.081); K.geo('sign', new THREE.PlaneGeometry(0.9, 0.45), 0, 0.95, 0.039, 0, Math.PI);
  K.geo('pail', new THREE.CylinderGeometry(0.2, 0.16, 0.32, 12, 1, true), 0.62, 0.16, 0.2); K.geo('water', new THREE.CircleGeometry(0.18, 12), 0.62, 0.27, 0.2, -Math.PI / 2);
  K.pop(); B.build({ wood: M_WOODD, sign: M_SIGN, pail: M_PAIL, water: M_WATERP }, G.world, true, true);
  if (G.addCircle) G.addCircle(sx, sz, 0.45);
  G.INTERACT.push({ x: PLAZA.x, z: PLAZA.z, r: 1.7, title: '🎣 분수 낚시', sub: '', action: () => startFishing('plaza') });
}
const spotById = id => id === 'plaza' ? PLAZA : SPOTS.find(s => s.id === id);

// ═════════════════════════ 4. 낚시 상태 ═════════════════════════
// FS.st: cast → wait → bite → reel → land → ready (→ 다시 cast)
let FS = null;
const css = document.createElement('style');
css.textContent = `
  #mgFishHud { position:absolute; left:50%; bottom:calc(118px + env(safe-area-inset-bottom)); transform:translateX(-50%); display:none; flex-direction:column; align-items:center; gap:4px; pointer-events:none; text-align:center; z-index:7; }
  body.mgfish #mgFishHud { display:flex; }
  body.mgfish #skbar, body.mgfish #cbtns, body.mgfish #bJump { opacity:0 !important; pointer-events:none !important; }
  body.cine #mgFishHud, body.cine #mgFishBtn, body.cine #mgFishX { opacity:0; pointer-events:none; }
  #mgFishHud .sp { font:700 10px 'Cinzel'; letter-spacing:.35em; color:#7ff3ff; text-shadow:0 0 8px rgba(127,243,255,.5); }
  #mgFishHud .st { font:700 17px 'Gowun Batang'; color:#fff3d6; text-shadow:0 1px 3px #000, 0 0 12px rgba(0,0,0,.6); }
  #mgFishHud .ky { font:500 12px 'Noto Sans KR'; color:#d8e8ee; padding:4px 12px; border-radius:14px; background:rgba(10,14,24,.6); border:1px solid rgba(233,200,126,.3); }
  #mgFishHud .ky b { color:#ffd36a; border:1px solid rgba(233,200,126,.6); border-radius:4px; padding:0 5px; margin:0 2px; font-weight:700; }
  #mgFishHud .lvb { display:flex; align-items:center; gap:6px; font:700 11px 'Noto Sans KR'; color:#bfe9ef; }
  #mgFishHud .lvb i { display:block; width:110px; height:4px; border-radius:2px; background:rgba(255,255,255,.12); overflow:hidden; } #mgFishHud .lvb i b { display:block; height:100%; background:linear-gradient(90deg,#5ab8ff,#9ffcff); }
  body.touch #mgFishHud .ky { display:none; }
  @media (max-height:560px){ #mgFishHud { bottom:calc(84px + env(safe-area-inset-bottom)); } #mgFishHud .sp, #mgFishHud .lvb { display:none; } #mgCatch { padding:10px 14px 10px; top:50%; } #mgCatch .art { max-width:210px; } #mgCatch .ds { display:none; } #mgCatch .nm { font-size:22px; } }
  #mgFishBtn, #mgFishX { position:fixed; display:none; align-items:center; justify-content:center; border-radius:50%; pointer-events:auto; z-index:7; user-select:none; -webkit-user-select:none; touch-action:none; }
  #mgFishBtn { right:24px; bottom:calc(34px + env(safe-area-inset-bottom)); width:86px; height:86px; font:700 13px 'Gowun Batang'; color:#2a1a00; flex-direction:column; background:radial-gradient(circle at 50% 35%, #fff2c9, #d9a43c); border:2px solid #fff3d6; box-shadow:0 0 18px rgba(255,211,106,.6), 0 6px 16px rgba(0,0,0,.4); }
  #mgFishBtn span { font-size:28px; line-height:1; } #mgFishBtn.hot { animation:mgHot .35s infinite alternate; }
  @keyframes mgHot { to { transform:scale(1.12); box-shadow:0 0 34px rgba(255,120,60,.9); } }
  #mgFishX { right:122px; bottom:calc(44px + env(safe-area-inset-bottom)); width:48px; height:48px; font:700 18px 'Noto Sans KR'; color:#fff3d6; background:radial-gradient(circle at 50% 35%, rgba(60,72,96,.85), rgba(10,14,24,.85)); border:1px solid rgba(233,200,126,.55); }
  body.touch.mgfish #mgFishBtn, body.touch.mgfish #mgFishX { display:flex; }
  #mgBang { position:fixed; z-index:9; pointer-events:none; transform:translate(-50%,-100%); font:900 54px 'Noto Sans KR'; color:#ffd36a; text-shadow:0 0 18px rgba(255,160,40,.95), 0 3px 0 #6a3a00, 0 0 4px #000; display:none; animation:mgBang .3s ease-out; }
  #mgBang.big { color:#ff7a5a; font-size:64px; letter-spacing:-.05em; }
  @keyframes mgBang { from { transform:translate(-50%,-60%) scale(.3); opacity:0; } 70% { transform:translate(-50%,-110%) scale(1.25); opacity:1; } }
  #mgHold { position:fixed; inset:0; z-index:8; display:none; touch-action:none; cursor:pointer; }
  #mgReel { position:fixed; left:calc(50% + clamp(60px, 9vw, 150px)); top:48%; transform:translate(0,-50%); z-index:9; display:none; gap:10px; align-items:stretch; pointer-events:none; --h:min(320px, 56vh); }
  body.mgreel #modes, body.mgreel #fmenu, body.mgfish #prompt { opacity:0 !important; pointer-events:none !important; }
  #mgReel.on { display:flex; animation:mgIn .25s ease-out; } @keyframes mgIn { from { opacity:0; transform:translate(20px,-50%); } }
  #mgReel .bar { position:relative; width:54px; height:var(--h); border-radius:10px; overflow:hidden; background:linear-gradient(180deg, #1a5a7a, #0a2a44 60%, #061a2c); border:2px solid rgba(233,200,126,.75); box-shadow:0 0 0 3px rgba(10,14,24,.55), 0 10px 30px rgba(0,0,0,.6), inset 0 0 18px rgba(0,0,0,.6); }
  #mgReel .bar::before { content:''; position:absolute; inset:0; background:repeating-linear-gradient(0deg, transparent 0 22px, rgba(255,255,255,.05) 22px 23px); }
  #mgReel .zone { position:absolute; left:3px; right:3px; bottom:0; border-radius:7px; background:linear-gradient(180deg, rgba(140,255,170,.55), rgba(60,200,110,.4)); border:2px solid rgba(190,255,200,.95); box-shadow:0 0 14px rgba(120,255,160,.6); transition:background .15s; }
  #mgReel .zone.off { background:linear-gradient(180deg, rgba(255,160,120,.35), rgba(200,90,60,.3)); border-color:rgba(255,190,160,.8); box-shadow:none; }
  #mgReel .fish { position:absolute; left:50%; width:58px; height:29px; margin:-14px 0 0 -29px; filter:drop-shadow(0 0 1px #000) drop-shadow(0 0 5px rgba(127,243,255,.8)); }
  #mgReel .fish.boss { filter:drop-shadow(0 0 1px #000) drop-shadow(0 0 9px rgba(255,190,60,.95)); }
  #mgReel .chest { position:absolute; left:50%; width:30px; height:30px; margin:-15px 0 0 -15px; font-size:22px; line-height:30px; text-align:center; display:none; filter:drop-shadow(0 0 6px #ffd36a); }
  #mgReel .chest i { position:absolute; left:2px; right:2px; bottom:-5px; height:3px; background:rgba(0,0,0,.5); border-radius:2px; overflow:hidden; } #mgReel .chest i b { display:block; height:100%; background:#ffd36a; }
  #mgReel .prog { width:14px; height:var(--h); border-radius:7px; background:rgba(0,0,0,.55); border:1px solid rgba(233,200,126,.6); position:relative; overflow:hidden; }
  #mgReel .prog i { position:absolute; left:0; right:0; bottom:0; background:linear-gradient(0deg,#ff6a3a,#ffd36a 50%,#8aff9a); box-shadow:0 0 10px rgba(255,211,106,.8); }
  #mgReel .side { display:flex; flex-direction:column; justify-content:space-between; width:96px; }
  #mgReel .side .nm { font:700 13px 'Gowun Batang'; color:#fff3d6; text-shadow:0 1px 3px #000; } #mgReel .side .nm small { display:block; font:700 9px 'Cinzel'; letter-spacing:.25em; color:#7ff3ff; }
  #mgReel .side .tip { font:500 11px/1.5 'Noto Sans KR'; color:#d8e8ee; text-shadow:0 1px 2px #000; }
  #mgReel .side .pf { font:900 11px 'Cinzel'; letter-spacing:.15em; color:#8aff9a; text-shadow:0 0 8px rgba(120,255,160,.8); } #mgReel .side .pf.x { opacity:.25; text-decoration:line-through; }
  @media (max-width:600px){ #mgReel .side { width:70px; } #mgReel .side .tip { display:none; } }
  #mgCatch { position:fixed; left:50%; top:46%; z-index:26; width:min(400px, 92vw); transform:translate(-50%,-50%) scale(.85); opacity:0; pointer-events:none; transition:opacity .25s, transform .3s cubic-bezier(.2,1.5,.4,1); text-align:center; padding:16px 18px 14px; --rc:#c3ccd2;
    background:radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--rc) 22%, rgba(16,20,34,.97)), rgba(7,9,16,.97) 70%); border:1px solid var(--rc); border-radius:8px; box-shadow:0 0 0 4px rgba(10,14,24,.5), 0 0 40px color-mix(in srgb, var(--rc) 45%, transparent), 0 20px 60px rgba(0,0,0,.7); }
  #mgCatch.on { opacity:1; transform:translate(-50%,-50%) scale(1); pointer-events:auto; }
  #mgCatch .k { font:700 10px 'Cinzel'; letter-spacing:.5em; color:var(--rc); }
  #mgCatch .nm { font:900 26px 'Gowun Batang'; color:#fff8e6; margin-top:2px; text-shadow:0 0 16px color-mix(in srgb, var(--rc) 60%, transparent); } #mgCatch .en { font:700 10px 'Cinzel'; letter-spacing:.2em; color:#9fb6c0; }
  #mgCatch .st { font-size:16px; color:var(--rc); letter-spacing:.1em; margin-top:2px; } #mgCatch .st i { font-style:normal; color:rgba(255,255,255,.15); }
  #mgCatch .art { width:100%; max-width:300px; aspect-ratio:2/1; margin:2px auto 0; display:block; animation:mgSwim 2.4s ease-in-out infinite; }
  @keyframes mgSwim { 50% { transform:translateY(-5px) rotate(-2deg); } }
  #mgCatch .sz { font:500 14px 'Noto Sans KR'; color:#d8e4e8; } #mgCatch .sz b { font:900 30px 'Cinzel'; color:#fff; margin-right:3px; }
  #mgCatch .rec { display:inline-block; margin-left:6px; padding:1px 8px; border-radius:10px; font:900 11px 'Noto Sans KR'; color:#2a1a00; background:linear-gradient(180deg,#fff2c9,#ffb03a); animation:mgPulse .8s infinite alternate; vertical-align:middle; }
  @keyframes mgPulse { to { box-shadow:0 0 14px rgba(255,190,60,.9); } }
  #mgCatch .meta { display:flex; justify-content:center; flex-wrap:wrap; gap:6px; margin:8px 0 4px; font:700 12px 'Noto Sans KR'; }
  #mgCatch .meta span { padding:3px 9px; border-radius:12px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); color:#e8e1cf; } #mgCatch .meta .g { color:#ffe9b0; border-color:rgba(255,211,106,.4); } #mgCatch .meta .pf { color:#8aff9a; border-color:rgba(120,255,160,.45); } #mgCatch .meta .x { color:#d6b8ff; }
  #mgCatch .ds { font:400 12px/1.6 'Noto Sans KR'; color:#9fb6c0; margin:4px 4px 10px; }
  #mgCatch .new { position:absolute; left:-8px; top:12px; padding:3px 14px 3px 12px; font:900 13px 'Cinzel'; letter-spacing:.15em; color:#fff; background:linear-gradient(90deg,#ff4a6a,#ff8a3a); box-shadow:0 4px 12px rgba(0,0,0,.4); transform:rotate(-8deg); display:none; }
  #mgCatch.isnew .new { display:block; }
  #mgCatch button { font:700 14px 'Gowun Batang'; letter-spacing:.2em; color:#10131c; padding:9px 30px; border:none; border-radius:3px; cursor:pointer; background:linear-gradient(180deg,#fff2c9,#e2b964 60%,#b88c3e); }
  #mgCatch button kbd { font:700 10px 'Cinzel'; opacity:.6; margin-left:6px; } body.touch #mgCatch button kbd { display:none; }
  #mgFlash { position:fixed; inset:0; z-index:25; pointer-events:none; background:radial-gradient(circle at 50% 45%, rgba(255,240,200,.9), rgba(255,190,80,.4) 40%, transparent 70%); opacity:0; transition:opacity .6s; }
  .mgw { position:fixed; left:50%; top:50%; transform:translate(-50%,-48%) scale(.97); z-index:27; width:min(820px, 96vw); max-height:min(640px, 94vh); display:flex; flex-direction:column; padding:12px 16px; color:#e8e1cf; font:400 13px 'Noto Sans KR';
    background:linear-gradient(180deg, rgba(16,20,34,.97), rgba(7,9,16,.97)); border:1px solid rgba(233,200,126,.55); border-radius:6px; box-shadow:0 0 0 4px rgba(10,14,24,.5), 0 20px 60px rgba(0,0,0,.7); opacity:0; pointer-events:none; transition:opacity .2s, transform .2s; }
  .mgw.on { opacity:1; pointer-events:auto; transform:translate(-50%,-50%) scale(1); }
  .mgw::before { content:''; position:absolute; left:18px; right:18px; top:-1px; height:1px; background:linear-gradient(90deg, transparent, #ffe9b0, transparent); }
  .mgw .hd { display:flex; flex-wrap:wrap; align-items:center; gap:8px 10px; padding-bottom:9px; border-bottom:1px solid rgba(233,200,126,.25); }
  .mgw .hd > span { font:700 10px 'Cinzel'; letter-spacing:.4em; color:#7ff3ff; white-space:nowrap; } .mgw .hd > b { font:700 19px 'Gowun Batang'; color:#fff3d6; white-space:nowrap; } .mgw .hd .sp { flex:1; }
  .mgw .tabs { display:flex; gap:5px; flex-wrap:wrap; } .mgw .tabs button { font:700 12px 'Gowun Batang'; color:#cfc6b0; padding:5px 11px; border-radius:14px; border:1px solid rgba(233,200,126,.22); background:rgba(255,255,255,.03); cursor:pointer; white-space:nowrap; }
  .mgw .tabs button.on { color:#10131c; background:linear-gradient(180deg,#fff2c9,#d9b05a); border-color:#ffd36a; }
  .mgw .gold { font:700 13px 'Noto Sans KR'; color:#ffe9b0; padding:3px 11px; border-radius:14px; background:rgba(255,211,106,.12); border:1px solid rgba(255,211,106,.4); white-space:nowrap; } .mgw .gold b { font:900 14px 'Cinzel'; }
  .mgw .x { background:none; border:none; color:#e9c87e; font-size:20px; cursor:pointer; padding:0 4px; }
  .mgw .bd { overflow:auto; flex:1; min-height:0; padding-top:10px; overscroll-behavior:contain; }
  .mgw .btn { font:700 13px 'Gowun Batang'; letter-spacing:.05em; color:#10131c; padding:7px 13px; border:none; border-radius:3px; cursor:pointer; white-space:nowrap; background:linear-gradient(180deg,#fff2c9,#e2b964 60%,#b88c3e); }
  .mgw .btn.sub { color:#fff3d6; background:rgba(233,200,126,.1); border:1px solid rgba(233,200,126,.45); } .mgw .btn:disabled { opacity:.32; cursor:default; }
  .mgw .note { font:400 12px/1.6 'Noto Sans KR'; color:#9fb6c0; margin:0 0 8px; } .mgw .note b { color:#ffd36a; }
  @media (max-width:640px){ .mgw { padding:10px; } .mgw .hd > span { display:none; } .mgw .hd > b { font-size:16px; } .mgw .tabs { flex:1 1 100%; order:9; } }
  #mgFishW .dexh { display:flex; align-items:center; gap:12px; margin-bottom:10px; } #mgFishW .dexh .pb { flex:1; height:8px; border-radius:4px; background:rgba(255,255,255,.08); overflow:hidden; } #mgFishW .dexh .pb i { display:block; height:100%; background:linear-gradient(90deg,#5ab8ff,#9ffcff,#ffd36a); }
  #mgFishW .dexh b { font:900 18px 'Cinzel'; color:#ffe9b0; white-space:nowrap; } #mgFishW .dexh small { font:500 11px 'Noto Sans KR'; color:#9fb6c0; }
  #mgFishW .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:8px; }
  #mgFishW .fc { --rc:#c3ccd2; position:relative; padding:6px 8px 7px; border-radius:7px; background:radial-gradient(ellipse at 50% 20%, color-mix(in srgb, var(--rc) 14%, rgba(30,38,56,.9)), rgba(8,10,18,.9)); border:1px solid color-mix(in srgb, var(--rc) 55%, transparent); cursor:pointer; min-width:0; }
  #mgFishW .fc.no { --rc:#4a5462; cursor:default; } #mgFishW .fc img { width:100%; aspect-ratio:2/1; display:block; } #mgFishW .fc.no img { opacity:.55; }
  #mgFishW .fc .n { font:700 13px 'Gowun Batang'; color:#fff3d6; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } #mgFishW .fc.no .n { color:#7a8694; }
  #mgFishW .fc .s { font-size:10px; color:var(--rc); letter-spacing:.05em; } #mgFishW .fc .s i { font-style:normal; color:rgba(255,255,255,.12); }
  #mgFishW .fc .h { font:400 10px/1.45 'Noto Sans KR'; color:#9fb6c0; margin-top:2px; } #mgFishW .fc .c { position:absolute; right:7px; top:5px; font:700 10px 'Noto Sans KR'; color:#c9d6da; }
  #mgFishW .fc.r4:not(.no) { animation:mgLeg 2s infinite; } @keyframes mgLeg { 50% { box-shadow:0 0 16px rgba(255,176,58,.6); } }
  #mgFishW .det { display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); gap:14px; align-items:center; padding:10px; margin-bottom:10px; border-radius:8px; background:rgba(255,255,255,.035); border:1px solid rgba(233,200,126,.25); }
  #mgFishW .det img { width:100%; } #mgFishW .det .nm { font:900 22px 'Gowun Batang'; color:#fff3d6; } #mgFishW .det .en { font:700 10px 'Cinzel'; letter-spacing:.2em; color:#9fb6c0; }
  #mgFishW .det p { font:400 12px/1.65 'Noto Sans KR'; color:#c9d6da; margin:6px 0; } #mgFishW .det .kv { display:grid; grid-template-columns:auto 1fr; gap:2px 10px; font:500 12px 'Noto Sans KR'; color:#9fb6c0; } #mgFishW .det .kv b { color:#fff; font-weight:700; }
  @media (max-width:560px){ #mgFishW .det { grid-template-columns:1fr; } #mgFishW .grid { grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); } }
  #mgFishW .bk { display:flex; flex-direction:column; gap:6px; } #mgFishW .bk .row { display:grid; grid-template-columns:96px minmax(0,1fr) auto; gap:10px; align-items:center; padding:6px 8px; border-radius:6px; background:rgba(255,255,255,.035); }
  #mgFishW .bk img { width:96px; } #mgFishW .bk .n { font:700 14px 'Gowun Batang'; color:#fff3d6; } #mgFishW .bk small { display:block; font:400 11px 'Noto Sans KR'; color:#9fb6c0; } #mgFishW .bk .v { font:900 14px 'Cinzel'; color:#ffe9b0; text-align:right; }
  #mgFishW .sell { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; margin-bottom:10px; border-radius:8px; background:linear-gradient(90deg, rgba(255,211,106,.14), rgba(255,211,106,.02)); border:1px solid rgba(255,211,106,.35); }
  #mgFishW .sell > div > b, #mgFishW .sell small > b { font:900 20px 'Cinzel'; color:#ffe9b0; } #mgFishW .sell .np { font:700 13px 'Gowun Batang'; color:#ffd36a; }
  #mgFishW .rods { display:flex; flex-direction:column; gap:7px; } #mgFishW .rd { display:grid; grid-template-columns:44px minmax(0,1fr) auto; gap:10px; align-items:center; padding:8px 10px; border-radius:7px; background:rgba(255,255,255,.035); border:1px solid transparent; }
  #mgFishW .rd.cur { border-color:rgba(127,243,255,.6); box-shadow:inset 0 0 14px rgba(127,243,255,.12); } #mgFishW .rd.own { opacity:.6; }
  #mgFishW .rd .ic { width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:22px; border:1px solid rgba(233,200,126,.45); background:radial-gradient(circle at 50% 35%, rgba(255,255,255,.12), rgba(0,0,0,.25)); }
  #mgFishW .rd .n { font:700 14px 'Gowun Batang'; color:#fff3d6; } #mgFishW .rd small { display:block; font:400 11px 'Noto Sans KR'; color:#9fb6c0; } #mgFishW .rd .st { font:500 11px 'Noto Sans KR'; color:#bfe9ef; } #mgFishW .rd .rq { font:500 11px 'Noto Sans KR'; color:#ff9a8a; }
  #mgFishW .stat { display:grid; grid-template-columns:repeat(auto-fill, minmax(170px, 1fr)); gap:8px; } #mgFishW .stat div { padding:10px 12px; border-radius:7px; background:rgba(255,255,255,.035); font:500 12px 'Noto Sans KR'; color:#9fb6c0; } #mgFishW .stat b { display:block; font:900 20px 'Cinzel'; color:#fff3d6; margin-top:2px; } #mgFishW .stat b small { font:700 12px 'Noto Sans KR'; color:#c9d6da; }
  #mgFishW .flv { display:flex; align-items:center; gap:10px; padding:10px 12px; margin-bottom:10px; border-radius:8px; background:linear-gradient(90deg, rgba(90,184,255,.14), rgba(90,184,255,.02)); border:1px solid rgba(127,243,255,.3); }
  #mgFishW .flv .l { font:900 24px 'Cinzel'; color:#9ffcff; } #mgFishW .flv .b { flex:1; } #mgFishW .flv .b i { display:block; height:6px; border-radius:3px; background:rgba(255,255,255,.1); overflow:hidden; margin-top:4px; } #mgFishW .flv .b i b { display:block; height:100%; background:linear-gradient(90deg,#5ab8ff,#9ffcff); }
`;
document.head.appendChild(css);
const hud = X.mk('div', 'mgFishHud', '<div class="sp"></div><div class="st"></div><div class="lvb"></div><div class="ky"></div>', X.hud);
const fbtn = X.mk('div', 'mgFishBtn', '<span>🎣</span><b>던지기</b>', X.hud), fx = X.mk('div', 'mgFishX', '✕', X.hud);
const bang = X.mk('div', 'mgBang', '!'), holdL = X.mk('div', 'mgHold', '');
const reelEl = X.mk('div', 'mgReel', `<div class="bar"><div class="zone"></div><div class="chest">💎<i><b></b></i></div><img class="fish"></div><div class="prog"><i></i></div>
  <div class="side"><div class="nm"><small>REELING</small><span></span></div><div class="pf">PERFECT</div><div class="tip">누르고 있으면 초록 범위가 올라가요<br><b style="color:#ffd36a">Space · 클릭 · 터치</b></div></div>`);
const catchEl = X.mk('div', 'mgCatch', ''), flashEl = X.mk('div', 'mgFlash', '');
const RE = { bar: reelEl.querySelector('.bar'), zone: reelEl.querySelector('.zone'), fish: reelEl.querySelector('.fish'), chest: reelEl.querySelector('.chest'), chestB: reelEl.querySelector('.chest b'), prog: reelEl.querySelector('.prog i'), nm: reelEl.querySelector('.side .nm span'), pf: reelEl.querySelector('.side .pf') };

function hudSet(st, ky, btn, hot){
  hud.querySelector('.st').innerHTML = st; hud.querySelector('.ky').innerHTML = ky || '';
  if (btn !== undefined){ fbtn.querySelector('b').textContent = btn; fbtn.style.visibility = btn ? '' : 'hidden'; }
  fbtn.classList.toggle('hot', !!hot);
}
function hudLv(){ const lv = S.fish.lv, nd = fneed(lv); hud.querySelector('.lvb').innerHTML = `🎣 낚시 Lv.${lv}${lv < FMAXLV ? `<i><b style="width:${Math.min(100, S.fish.xp / nd * 100)}%"></b></i>` : ' · MAX'}`; }

// 지금 낚시가 가능한가 (전투 · 대화 · 수영 중이 아닐 때)
function canFish(sp, quiet){
  const no = m => { if (!quiet) X.hint(m, 2.2); return false; };
  if (!sp) return false;
  if (X.dead || X.dialogOpen || X.tpBusy) return false;
  if (sp.plaza ? X.mode !== 'plaza' : !(F.inField && X.mode === 'field')) return false;
  if (F.swimming || (wmod() && wmod().swimming)) return no('🏊 헤엄치는 중에는 낚시를 할 수 없어요');
  if (!sp.plaza && X.foesIn(pp.x, pp.z, 9).length) return no('⚔ 근처에 몬스터가 있어요! 먼저 정리하세요');
  if (arcOpen) return false;
  return true;
}
// 물고기 고르기 (서식지 · 시간대 · 낚싯대 · 낚시 레벨)
function rollFish(sp){
  const ph = sp.plaza ? 'day' : phase(), T = rod(), L = [], lvk = 1 + (S.fish.lv - 1) * 0.03;
  for (const f of FISH){
    if (!f.hab.some(h => sp.hab.includes(h))) continue;
    if (f.time !== 'any' && !timeOk(f, ph)) continue;
    if (f.rod && (S.fish.rod | 0) < f.rod) continue;
    let w = RAR[f.r].w * (f.r >= 2 ? T.rare * lvk : 1) * (f.time !== 'any' ? 1.5 : 1);
    if (f.night && ph === 'night') w *= f.night; if (f.dawnB && ph === 'dawn') w *= f.dawnB;
    L.push([f, w]);
  }
  // 잡동사니 · 보물
  const jw = sp.plaza ? [['coin', 7], ['boot', 2]] : [['boot', 4], ['bottle', 1.4]];
  for (const [id, w] of jw) L.push([FBY[id], w]);
  let sum = 0; for (const o of L) sum += o[1]; let r = R() * sum;
  for (const o of L){ r -= o[1]; if (r <= 0) return o[0]; }
  return L[0][0];
}
function rollSize(f){ const k = Math.pow(R(), 1.6 - Math.min(0.6, S.fish.lv * 0.02)); return Math.round(lerp(f.cm[0], f.cm[1], k) * 10) / 10; }

// ── 시작 / 끝 ──
const _v = new V3(), _w = new V3(), _q = new THREE.Vector3();
let heldWeapons = [], prevEmote = null, myCam = null;
function startFishing(id){
  if (FS){ if (FS.st === 'ready') cast(); return true; }
  const sp = spotById(id || nearestSpotId()); if (!canFish(sp)) return false;
  ac();
  const tier = S.fish.rod | 0, rodG = mkRod(tier);
  rodG.position.set(0, -0.36, 0.02); rodG.rotation.x = Math.PI / 2 + 0.3; X.fig.elR.add(rodG);
  heldWeapons = []; for (const b of [X.fig.elR, X.fig.elL]) for (const c of b.children) if (c !== rodG){ heldWeapons.push([c, c.visible]); c.visible = false; }
  FS = { sp, st: 'idle', t: 0, rod: rodG, x0: pp.x, z0: pp.z, tx: 0, tz: 0, ty: 0, yaw: 0, bob: new V3(), fish: null, nib: [], nibT: -9, idleT: 0, strike: 0 };
  prevEmote = X.emotePose; X.emotePose = fishPose;
  document.body.classList.add('mgfish'); hud.querySelector('.sp').textContent = (sp.plaza ? 'RUNE PLAZA' : (F.regionById(sp.region) || {}).en || 'FISHING').toUpperCase() + ' · ' + sp.name;
  hudLv(); BOB.visible = false; LINE.visible = false;
  if (!S.fish.total && !S.fish.tut){ S.fish.tut = 1; X.later(1.2, () => X.hint('찌가 <b>쑥!</b> 잠기면 바로 <b>Space</b> (터치: 🎣 버튼) — 그다음 줄다리기!', 5)); }
  cast(); return true;
}
function stopFishing(msg){
  if (!FS) return; const s = FS; FS = null;
  if (s.rod.parent) s.rod.parent.remove(s.rod);
  for (const [c, v] of heldWeapons) c.visible = v; heldWeapons = [];
  // 스토리의 광장 poseMod 는 X.emotePose 를 감싸 부르므로, 빈 자리로 두지 않고 null 을 돌려주는 함수로 되돌려요
  if (X.emotePose === fishPose) X.emotePose = prevEmote || NOPOSE; prevEmote = null;
  document.body.classList.remove('mgfish'); BOB.visible = LINE.visible = JUMP.visible = HELD.visible = HELDGLOW.visible = false; bang.style.display = 'none';
  reelEnd(); if (myCam && G.camOverride === myCam) G.camOverride = null; myCam = null;
  if (catchEl.classList.contains('on')) closeCatch(true);
  if (msg) X.hint(msg, 2.2);
}
function nearestSpotId(){ if (X.mode === 'plaza') return 'plaza'; let b = null, bd = 1e9; for (const s of SPOTS){ const d = Math.hypot(pp.x - s.sx, pp.z - s.sz); if (d < bd){ bd = d; b = s; } } return b && bd < 8 ? b.id : null; }
// 던질 곳: 낚시터 물 위 마크 근처 (광장은 분수 수반 안)
function castTarget(sp){
  if (sp.plaza){ const a = Math.atan2(pp.z, pp.x) + rr(-0.25, 0.25), r = rr(2.1, 3.0); return [Math.cos(a) * r, sp.wy, Math.sin(a) * r]; }
  for (let k = 0; k < 10; k++){ const a = R() * TAU, d = sp.ice ? rr(0, 0.25) : rr(0.2, 1.8), x = sp.wx + Math.cos(a) * d, z = sp.wz + Math.sin(a) * d; if (sp.ice || F.isWater(x, z)) return [x, surfY(x, z, sp.ice), z]; }
  return [sp.wx, sp.wy, sp.wz];
}
function cast(){
  const s = FS; if (!s) return;
  const [tx, ty, tz] = castTarget(s.sp); s.tx = tx; s.ty = ty; s.tz = tz;
  s.yaw = Math.atan2(tx - pp.x, tz - pp.z); X.fig.root.rotation.y = s.yaw; s.x0 = pp.x; s.z0 = pp.z;
  s.st = 'cast'; s.t = 0; s.fish = null; s.idleT = 0; BOB.visible = false; LINE.visible = true; bang.style.display = 'none';
  hudSet('찌를 던지는 중…', '', '', false);
}
// 기다리는 시간: 낚싯대 · 시간대 · 레벨
function waitTime(sp){ const ph = sp.plaza ? 'day' : phase(); return rr(3.5, 9.5) / (rod().bite * 0.85 + 0.15) * (ph === 'dawn' ? 0.8 : 1) * (1 - Math.min(0.25, S.fish.lv * 0.012)); }
function beginWait(){
  const s = FS; s.st = 'wait'; s.t = 0; s.wait = waitTime(s.sp); s.nib = [];
  const nn = ri(0, 3); for (let i = 0; i < nn; i++) s.nib.push(rr(0.8, s.wait - 0.6));
  s.nib.sort((a, b) => a - b); s.nibT = -9;
  hudSet('입질을 기다리는 중…', '찌가 <b>쑥</b> 잠기면 <b>Space</b> / <b>클릭</b> · <b>E</b> 그만', '챔질', false);
}
function bite(){
  const s = FS; s.fish = rollFish(s.sp); s.st = 'bite'; s.t = 0;
  const leg = s.fish.r >= 4; s.win = (leg ? 0.75 : 0.95) * rod().bite * (s.fish.junk ? 1.3 : 1);
  sfx('bite'); splash(s.bob.x, s.ty, s.bob.z, leg ? 40 : 18, leg ? 3.5 : 2.4); ripple(s.bob.x, s.ty, s.bob.z, 0.2, leg ? 3 : 1.6, 0.8, 0.8);
  bang.textContent = leg ? '!!!' : '!'; bang.classList.toggle('big', leg); bang.style.display = 'block'; bang.style.animation = 'none'; void bang.offsetWidth; bang.style.animation = '';
  if (leg){ G.shake = Math.max(G.shake, 0.9); X.sfx('roar'); }
  hudSet(leg ? '<span style="color:#ff9a5a">거대한 무언가가 물었다!!</span>' : '<span style="color:#ffd36a">입질이다!</span>', '<b>Space</b> / <b>클릭</b> 지금!', '챔질!', true);
  if (navigator.vibrate) try { navigator.vibrate(leg ? [80, 40, 120] : 60); } catch (e){}
}
// Space · 클릭 · 버튼
function press(){
  const s = FS; if (!s) return false;
  if (catchEl.classList.contains('on')){ closeCatch(); return true; }
  if (s.st === 'ready'){ cast(); return true; }
  if (s.st === 'wait'){
    if (s.t - s.nibT < 0.4){ sfx('early'); X.hint('🐟 너무 일찍 챘어요! 물고기가 놀라 달아났어요', 2); s.wait = s.t + rr(2.5, 5); s.nib = []; s.strike = 0.3; return true; }
    s.st = 'ready'; s.idleT = 0; BOB.visible = false; LINE.visible = false; sfx('whoosh'); hudSet('줄을 거뒀어요', '<b>Space</b> 다시 던지기 · <b>E</b> 그만', '던지기', false); return true;
  }
  if (s.st === 'bite'){ bang.style.display = 'none'; s.strike = 0.35; sfx('hook'); if (s.fish.junk) landJunk(); else reelStart(); return true; }
  return s.st === 'cast' || s.st === 'reel' || s.st === 'land';
}
function missBite(){
  const s = FS; s.st = 'ready'; s.idleT = 0; bang.style.display = 'none'; BOB.visible = false; LINE.visible = false; sfx('lose');
  hudSet('놓쳤다… 미끼만 먹고 달아났어요', '<b>Space</b> 다시 던지기 · <b>E</b> 그만', '던지기', false);
}
fbtn.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); press(); }, { passive: false });
fbtn.addEventListener('click', e => { e.stopPropagation(); press(); });
fx.addEventListener('click', e => { e.stopPropagation(); stopFishing(); });
fx.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); stopFishing(); }, { passive: false });
// 클릭 (전투 공격 대신 챔질)
const prevClick = G.onClick;
G.onClick = b => { if (FS && b === 0){ press(); return; } if (FS && b === 2) return; if (prevClick) prevClick(b); };

// ── 줄다리기 ──
const RL = { on: false };
function reelStart(){
  const s = FS, f = s.fish, T = rod();
  s.st = 'reel'; s.t = 0;
  Object.assign(RL, { on: true, f: 0.35, fv: 0, ft: 0.5, tT: 0.6, z: 0.18, zv: 0, zh: clamp(T.zone + (S.fish.lv - 1) * 0.004 - (f.r >= 4 ? 0.04 : 0), 0.16, 0.5), prog: 0.3, perfect: true, t: 0, tick: 0, hold: !!RL.hold, H: 300, chest: R() < 0.22 + (S.fish.rod | 0) * 0.03 ? { at: rr(1.2, 3.5), on: false, p: rr(0.15, 0.85), k: 0, got: false } : null,
    dif: clamp(RAR[f.r].dif + (f.mv.sp - 0.5) * 0.3, 0, 1.1) });
  RE.fish.src = artURL(f.id, 2); RE.fish.classList.toggle('boss', f.r >= 3); RE.nm.textContent = f.r >= 4 ? '??? (전설)' : f.r >= 3 ? '??? (대어)' : '???';
  RE.zone.style.height = (RL.zh * 100) + '%'; RE.chest.style.display = 'none'; RE.pf.classList.remove('x');
  reelEl.classList.add('on'); document.body.classList.add('mgreel'); holdL.style.display = 'block'; RL.H = RE.bar.clientHeight || 300;
  hudSet('', '', '', false); hud.style.opacity = 0;
  // 카메라: 옆에서 물고기와 씨름하는 모습
  if (!G.camOverride){ const fx0 = Math.sin(s.yaw), fz0 = Math.cos(s.yaw), sx = fz0, sz = -fx0, d = Math.hypot(s.tx - pp.x, s.tz - pp.z);
    myCam = { pos: new V3(pp.x - fx0 * 3.2 + sx * 4.6, pp.y + 2.6, pp.z - fz0 * 3.2 + sz * 4.6), look: new V3(pp.x + fx0 * d * 0.45, pp.y + 0.5, pp.z + fz0 * d * 0.45) }; G.camOverride = myCam; }
}
function reelEnd(){ RL.on = false; reelEl.classList.remove('on'); document.body.classList.remove('mgreel'); holdL.style.display = 'none'; hud.style.opacity = ''; }
function reelTick(dt){
  const s = FS, f = s.fish, mv = f.mv; RL.t += dt;
  // 잡기 범위: 누르면 위로, 떼면 아래로
  RL.zv += (RL.hold ? 2.9 : -2.5) * dt; RL.zv = clamp(RL.zv, -1.5, 1.5); RL.z += RL.zv * dt;
  if (RL.z < 0){ RL.z = 0; RL.zv = RL.zv < -0.45 ? -RL.zv * 0.32 : 0; }
  if (RL.z > 1 - RL.zh){ RL.z = 1 - RL.zh; RL.zv = Math.min(0, RL.zv); }
  // 물고기 움직임
  if ((RL.tT -= dt) <= 0){
    const st = mv.s === 'mixed' ? pick(['smooth', 'dart', 'sink', 'float']) : mv.s, big = R() < mv.dt;
    if (st === 'smooth') RL.ft = clamp(RL.f + rr(-0.28, 0.28), 0.05, 0.95);
    else if (st === 'dart') RL.ft = big ? rr(0.05, 0.95) : clamp(RL.f + rr(-0.15, 0.15), 0.05, 0.95);
    else if (st === 'sink') RL.ft = big ? rr(0.4, 0.9) : rr(0.04, 0.38);
    else if (st === 'float') RL.ft = big ? rr(0.1, 0.5) : rr(0.6, 0.96);
    else RL.ft = big ? (RL.f > 0.5 ? rr(0.03, 0.25) : rr(0.75, 0.97)) : clamp(RL.f + rr(-0.3, 0.3), 0.04, 0.96);
    RL.tT = rr(0.3, 1.2) / (0.55 + mv.dt * 0.8);
    if (big && Math.abs(RL.ft - RL.f) > 0.3){ splash(s.bob.x, s.ty, s.bob.z, 8, 1.8); if (R() < 0.5) sfx('splash'); }
  }
  const k = 5 + mv.sp * 16; RL.fv += (RL.ft - RL.f) * k * dt; RL.fv *= Math.exp(-dt * (4.2 - mv.sp * 1.6)); RL.f = clamp(RL.f + RL.fv * dt + Math.sin(RL.t * 23) * 0.0016 * mv.sp, 0.02, 0.98);
  const inside = RL.f >= RL.z - 0.01 && RL.f <= RL.z + RL.zh + 0.01;
  const fill = 0.3 + (S.fish.rod | 0) * 0.025 + S.fish.lv * 0.004, drain = 0.14 + RL.dif * 0.24;
  RL.prog += (inside ? fill : -drain) * dt; if (!inside && RL.t > 0.4) RL.perfect = false;
  // 보물 상자
  const c = RL.chest;
  if (c && !c.got){ if (!c.on && RL.t > c.at){ c.on = true; RE.chest.style.display = 'block'; RE.chest.style.bottom = ''; sfx('pick'); }
    if (c.on){ const ins = c.p >= RL.z && c.p <= RL.z + RL.zh; c.k += ins ? dt : -dt * 0.4; c.k = Math.max(0, c.k); RE.chestB.style.width = Math.min(100, c.k / 1.3 * 100) + '%';
      if (c.k >= 1.3){ c.got = true; RE.chest.style.display = 'none'; sfx('chest'); const gg = ri(40, 120) * (1 + f.r); addGold(gg); S.fish.chests = (S.fish.chests || 0) + 1; F.note(`<span style="color:#ffd36a">💎 물속 보물 상자! 🪙 +${fmt(gg)}</span>`, 3); } } }
  // 효과음 · 진동
  if (RL.hold && (RL.tick -= dt) <= 0){ RL.tick = 0.07; sfx('tick'); }
  if (RL.prog >= 1){ reelEnd(); landFish(); return; }
  if (RL.prog <= 0){ reelEnd(); lostFish(); return; }
  // 그리기
  const H = RL.H;
  RE.zone.style.transform = `translateY(${-RL.z * H}px)`; RE.zone.classList.toggle('off', !inside);
  RE.fish.style.top = ((1 - RL.f) * H) + 'px'; RE.fish.style.transform = `rotate(${clamp(-RL.fv * 40, -35, 35)}deg)`;
  if (c && c.on && !c.got) RE.chest.style.top = ((1 - c.p) * H) + 'px';
  RE.prog.style.height = (clamp(RL.prog, 0, 1) * 100) + '%'; RE.pf.classList.toggle('x', !RL.perfect);
}
holdL.addEventListener('pointerdown', e => { RL.hold = true; e.preventDefault(); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) holdL.addEventListener(ev, () => { RL.hold = false; });
addEventListener('keyup', e => { if (e.code === 'Space') RL.hold = false; });
addEventListener('blur', () => { RL.hold = false; });

// ── 낚아 올리기 · 놓침 ──
function lostFish(){
  const s = FS; s.st = 'ready'; s.idleT = 0; BOB.visible = LINE.visible = false; sfx('snap'); splash(s.bob.x, s.ty, s.bob.z, 16, 2.4);
  if (myCam && G.camOverride === myCam) G.camOverride = null; myCam = null;
  const big = s.fish.r >= 3; X.hint(big ? '💢 줄이 끊어졌다… 엄청난 녀석이었는데!' : '🐟 놓쳤다… 물고기가 줄을 끊고 달아났어요', 2.6);
  hudSet('놓쳤다…', '<b>Space</b> 다시 던지기 · <b>E</b> 그만', '던지기', false);
}
function landJunk(){ const s = FS; s.st = 'land'; s.t = 0; s.cm = rollSize(s.fish); s.perfect = false; startJump(); }
function landFish(){ const s = FS; s.st = 'land'; s.t = 0; s.cm = rollSize(s.fish); s.perfect = RL.perfect; startJump(); }
function startJump(){
  const s = FS, f = s.fish, m = JUMP.material; m.map = artTex(f.id); m.needsUpdate = true;
  const len = f.junk ? 0.6 : clamp(f.cm / 100 * 1.25, 0.45, 3.4); JUMP.scale.set(len, len / 2, 1); JUMP.visible = true; s.jl = len;
  splash(s.bob.x, s.ty, s.bob.z, f.r >= 3 ? 46 : 22, f.r >= 3 ? 3.6 : 2.6); ripple(s.bob.x, s.ty, s.bob.z, 0.3, 2.2, 1, 0.8); sfx('splash');
  BOB.visible = false; if (f.r >= 3) G.shake = Math.max(G.shake, 0.7);
}
function finishLand(){
  const s = FS, f = s.fish, cm = s.cm;
  JUMP.visible = false; LINE.visible = false;
  // 머리 위로 들어 올리기
  const m = HELD.material; m.map = artTex(f.id); m.needsUpdate = true; HELD.scale.set(s.jl, s.jl / 2, 1); HELD.visible = true;
  HELDGLOW.material.color.set(RAR[f.r].c); HELDGLOW.material.opacity = f.r >= 2 ? 0.6 : 0.3; HELDGLOW.scale.setScalar(s.jl * 1.5 + 0.6); HELDGLOW.visible = true;
  if (myCam && G.camOverride === myCam){ const fx0 = Math.sin(s.yaw), fz0 = Math.cos(s.yaw); myCam.pos.set(pp.x + fx0 * 4.2 + fz0 * 1.2, pp.y + 2.2, pp.z + fz0 * 4.2 - fx0 * 1.2); myCam.look.set(pp.x, pp.y + 1.9, pp.z); }
  s.st = 'show'; s.t = 0; record(f, cm, s.perfect, s.sp);
}
// 기록 · 보상 · 카드
function record(f, cm, pf, sp){
  let isNew = false, rec = false, gold0 = 0, xp = 0, kept = false;
  if (f.junk){
    if (f.id === 'bottle'){ gold0 = ri(80, 420); addGold(gold0); }
    else if (f.id === 'coin'){ gold0 = ri(5, 40); addGold(gold0); }
    xp = 4;
  } else {
    const L = S.fish.log[f.id] || (S.fish.log[f.id] = { n: 0, best: 0, t: Date.now() }); isNew = !L.n; rec = !isNew && cm > L.best; L.n++; L.best = Math.max(L.best, cm);
    S.fish.total++; if (pf) S.fish.perfect++;
    if (!S.fish.big || cm > S.fish.big[1]) S.fish.big = [f.id, cm];
    if (S.fish.keep.length < basketCap()){ S.fish.keep.push([f.id, cm, pf ? 1 : 0]); kept = true; }
    gold0 = fishPrice(f, cm, pf); xp = Math.round(RAR[f.r].xp * (pf ? 1.25 : 1) * (isNew ? 1.5 : 1));
    BUS.emit('fish', { id: f.id, name: f.n, rarity: f.r, size: cm, spot: sp.id, perfect: !!pf });
    if (X.LVEXP) X.gainExp(Math.round(X.LVEXP(X.S.lv) * [0.25, 0.5, 1.1, 3, 10][f.r]));
    if (f.r >= 3){ F.chat(`🎣 누군가 「${f.n}」 (${cm}cm) 을 낚았습니다!`, '낚시', 'sys'); }
    if (f.r >= 4){ X.banner('LEGENDARY CATCH', f.n, `${cm}cm — 아르카디아에 전설이 하나 더 생겼다`, false, 4); flash(); if (f.id === 'lakelord') grant('mg_lord'); }
    else if (isNew && f.r >= 2) X.banner('NEW SPECIES', f.n, `${RAR[f.r].n} 물고기 · 도감 ${dexN()} / ${FISH.length}`, false, 2.6);
    if (dexN() === FISH.length) grant('mg_master');
  }
  fishXp(xp);
  sfx('catch' + Math.min(4, f.r)); if (f.r >= 2) X.sfx('shard');
  X.save();
  showCatch(f, cm, { isNew, rec, kept, gold: f.junk ? gold0 : fishPrice(f, cm, pf), got: f.junk ? gold0 : 0, xp, pf });
}
function fishXp(n){
  if (S.fish.lv >= FMAXLV) return; S.fish.xp += n;
  while (S.fish.lv < FMAXLV && S.fish.xp >= fneed(S.fish.lv)){ S.fish.xp -= fneed(S.fish.lv); S.fish.lv++;
    X.later(1.2, () => { X.banner('FISHING LEVEL UP', `낚시 Lv.${S.fish.lv}`, '잡기 범위 · 희귀 물고기 확률 · 입질 속도가 올랐어요', false, 2.6); X.sfx('level'); });
    if (S.fish.lv === 3 || S.fish.lv === 6 || S.fish.lv === 10 || S.fish.lv === 15) X.later(4, () => F.note(`🎣 <b>낚시꾼 노아</b>에게 가면 더 좋은 낚싯대를 살 수 있어요`, 5)); }
  hudLv();
}
function flash(){ flashEl.style.transition = 'none'; flashEl.style.opacity = 1; void flashEl.offsetWidth; flashEl.style.transition = ''; flashEl.style.opacity = 0; }
let catchT = 0;
function showCatch(f, cm, o){
  catchEl.style.setProperty('--rc', RAR[f.r].c); catchEl.classList.toggle('isnew', !!o.isNew);
  catchEl.innerHTML = `<div class="new">NEW!</div><div class="k">${f.junk ? 'FOUND' : f.r >= 4 ? 'LEGENDARY CATCH' : 'CATCH'}</div><div class="nm">${esc(f.n)}</div>${f.en ? `<div class="en">${esc(f.en)}</div>` : ''}
    ${f.junk ? '' : `<div class="st">${stars(f.r)} <small style="font:700 11px 'Noto Sans KR'">${RAR[f.r].n}</small></div>`}
    <img class="art" src="${artURL(f.id)}">
    ${f.junk ? '' : `<div class="sz"><b>${cm.toFixed(1)}</b>cm${o.rec ? '<span class="rec">최대 기록!</span>' : ''}</div>`}
    <div class="meta">${f.junk ? (o.got ? `<span class="g">🪙 +${fmt(o.got)}</span>` : '<span>쓸모없어 보인다…</span>') : `<span class="g">🪙 ${fmt(o.gold)}</span>`}<span class="x">낚시 EXP +${o.xp}</span>${o.pf ? '<span class="pf">✦ 완벽한 낚시 ×1.3</span>' : ''}${!f.junk && !o.kept ? '<span style="color:#ff9a8a">바구니가 가득 차 놓아줬어요</span>' : ''}</div>
    <p class="ds">${esc(f.d)}</p><button>확인<kbd>Space</kbd></button>`;
  catchEl.querySelector('button').onclick = e => { e.stopPropagation(); closeCatch(); };
  catchEl.classList.add('on'); catchT = f.r >= 4 ? 1e9 : f.r >= 2 ? 6 : 4.2;
  if (!f.junk && !o.kept) X.later(0.6, () => X.hint('🧺 바구니가 가득 찼어요 — <b>낚시꾼 노아</b>에게 팔아요', 3.5));
}
function closeCatch(silent){
  catchEl.classList.remove('on'); catchT = 0; HELD.visible = HELDGLOW.visible = false;
  if (silent || !FS) return;
  const s = FS; s.st = 'ready'; s.idleT = 0; BOB.visible = false; LINE.visible = false;
  if (myCam && G.camOverride === myCam) G.camOverride = null; myCam = null;
  for (let i = 0; i < 14; i++) X.emit(pp.x + rr(-0.4, 0.4), pp.y + rr(1.6, 2.4), pp.z + rr(-0.4, 0.4), rr(-1, 1), rr(0.5, 2), rr(-1, 1), 0xbfe9ff, 0.1, 0.7, { drag: 1.5 });
  hudSet('다시 던져 볼까?', '<b>Space</b> / <b>클릭</b> 던지기 · <b>E</b> 그만', '던지기', false);
}

// ── 포즈 (낚싯대를 든 자세) ──
const FP = {}, NOPOSE = () => null;
function fishPose(tp){
  const s = FS; if (!s) return null; const t = G.time;
  const base = { hy: 0.86, rax: -0.78, raz: -0.12, re: -0.7, lax: -0.62, laz: 0.28, le: -1.1, sp: 0.05 + Math.sin(t * 1.6) * 0.01, hd: 0.16, hdy: 0, llx: 0, rlx: 0, lk: 0, rk: 0, llz: 0.02, rlz: -0.02, sz: 0, hrx: 0 };
  Object.assign(FP, G.pose ? G.pose(base) : base);
  if (s.st === 'cast'){ const k = s.t / 0.75;
    if (k < 0.45){ const u = X.ease(k / 0.45); FP.rax = lerp(-0.78, -2.75, u); FP.re = lerp(-0.7, -0.25, u); FP.lax = lerp(-0.62, -1.6, u); FP.sp = -0.12 * u; FP.hd = -0.15 * u; }
    else { const u = X.ease(Math.min(1, (k - 0.45) / 0.3)); FP.rax = lerp(-2.75, -0.55, u); FP.re = lerp(-0.25, -0.6, u); FP.lax = lerp(-1.6, -0.6, u); FP.sp = lerp(-0.12, 0.2, u); FP.hd = lerp(-0.15, 0.25, u); FP.llx = -0.25 * u; FP.rk = 0.2 * u; } }
  else if (s.st === 'reel'){ const c = Math.sin(t * 15); FP.rax = -1.25 + Math.sin(t * 3.3) * 0.08 - RL.fv * 0.2; FP.re = -0.95; FP.lax = -0.95 + c * 0.18; FP.le = -1.5 + c * 0.25; FP.sp = -0.14; FP.hd = 0.05; FP.llx = 0.28; FP.rlx = -0.38; FP.lk = 0.25; FP.rk = 0.35; FP.hy = 0.82; FP.sz = Math.sin(t * 2.7) * 0.06; }
  else if (s.st === 'land'){ FP.rax = -2.1; FP.re = -0.4; FP.lax = -1.2; FP.sp = -0.2; FP.hd = -0.2; }
  else if (s.st === 'show'){ FP.rax = -2.75; FP.raz = -0.35; FP.re = -0.3; FP.lax = -2.85; FP.laz = 0.25; FP.le = -0.25; FP.sp = -0.08; FP.hd = -0.3; FP.hy = 0.86 + Math.abs(Math.sin(t * 5)) * 0.03; }
  else if (s.st === 'ready'){ FP.rax = -0.45; FP.re = -0.85; FP.lax = -0.3; FP.le = -0.6; }
  if (s.strike > 0){ const u = s.strike / 0.35; FP.rax -= 1.0 * u; FP.sp -= 0.18 * u; FP.hd -= 0.15 * u; }
  return FP;
}

// ── 매 프레임: 낚싯대 · 찌 · 줄 · 물고기 ──
const _tip = new V3(), _a = new V3(), _b = new V3(), _hd = new V3();
function tickFishing(dt, rdt){
  const s = FS;
  if (X.dialogOpen) return;   // 대화 중에는 멈춰요
  // 자동 중단: 이동 · 모드 · 죽음 · 대화
  const moved = Math.hypot(pp.x - s.x0, pp.z - s.z0) > 0.7;
  if (X.dead || (s.sp.plaza ? X.mode !== 'plaza' : !F.inField) || arcOpen){ stopFishing(); return; }
  if (moved && s.st !== 'reel' && s.st !== 'land' && s.st !== 'show'){ stopFishing('🎣 자리를 떠나 낚싯대를 거뒀어요'); return; }
  if (s.st !== 'wait' && s.st !== 'ready') G.moveMul = 0;
  G.noJump = true; G.faceLock = true; X.fig.root.rotation.y += X.angDiff(s.yaw, X.fig.root.rotation.y) * Math.min(1, rdt * 10);
  s.t += rdt; if (s.strike > 0) s.strike = Math.max(0, s.strike - rdt);
  // 낚싯대 휘기
  const bend = s.st === 'reel' ? 0.35 + Math.abs(RL.fv) * 0.4 + (RL.hold ? 0.15 : 0) : s.st === 'bite' ? 0.3 + Math.sin(s.t * 30) * 0.1 : s.st === 'land' ? 0.5 : 0.06;
  const sg = s.rod.userData.segs; sg[1].rotation.x += (bend * 0.35 - sg[1].rotation.x) * Math.min(1, rdt * 12); sg[2].rotation.x += (bend * 0.6 - sg[2].rotation.x) * Math.min(1, rdt * 12);
  s.rod.userData.tip.getWorldPosition(_tip);
  // 찌 위치
  const ty = s.ty;
  if (s.st === 'cast'){
    if (s.t >= 0.32 && !s.flew){ s.flew = true; sfx('whoosh'); s.from = _tip.clone(); }
    if (s.t < 0.32){ s.flew = false; BOB.visible = false; LINE.visible = false; }
    else { const k = Math.min(1, (s.t - 0.32) / 0.45), e = k; s.bob.set(lerp(s.from.x, s.tx, e), lerp(s.from.y, ty, e) + Math.sin(k * Math.PI) * (1.6 + Math.hypot(s.tx - pp.x, s.tz - pp.z) * 0.18), lerp(s.from.z, s.tz, e));
      BOB.visible = true; LINE.visible = true; BOB.rotation.set(0, 0, (1 - k) * 1.2);
      if (k >= 1){ s.flew = false; sfx('plop'); splash(s.tx, ty, s.tz, 10, 1.6); ripple(s.tx, ty, s.tz, 0.1, 1.3, 1, 0.7); BOB.rotation.set(0, 0, 0); beginWait(); } }
  } else if (s.st === 'wait'){
    s.bob.set(s.tx, ty + Math.sin(s.t * 2.4) * 0.025, s.tz);
    if (s.nib.length && s.t >= s.nib[0]){ s.nib.shift(); s.nibT = s.t; sfx('nibble'); ripple(s.tx, ty, s.tz, 0.1, 0.6, 0.6, 0.5); }
    if (s.t - s.nibT < 0.3) s.bob.y -= Math.sin((s.t - s.nibT) / 0.3 * Math.PI) * 0.09;
    if ((s.ripT = (s.ripT || 0) - rdt) <= 0){ s.ripT = rr(1.4, 2.6); ripple(s.tx, ty, s.tz, 0.1, 0.8, 1.6, 0.3); }
    if (s.t >= s.wait) bite();
  } else if (s.st === 'bite'){
    s.bob.set(s.tx + Math.sin(s.t * 40) * 0.04, ty - 0.18 - Math.sin(s.t * 18) * 0.06, s.tz);
    if (R() < rdt * 20) X.emit(s.tx + rr(-0.2, 0.2), ty + 0.05, s.tz + rr(-0.2, 0.2), rr(-0.6, 0.6), rr(1, 2.2), rr(-0.6, 0.6), 0xdff4ff, 0.08, 0.45, { grav: -8 });
    if (s.t > s.win) missBite();
  } else if (s.st === 'reel'){
    const fx0 = Math.sin(s.yaw), fz0 = Math.cos(s.yaw), lat = (RL.f - 0.5) * 3.4, pull = 1 - clamp(RL.prog, 0, 1) * 0.55, d = Math.hypot(s.tx - s.x0, s.tz - s.z0);
    const bx = s.x0 + fx0 * d * pull + fz0 * lat, bz = s.z0 + fz0 * d * pull - fx0 * lat;
    s.bob.x += (bx - s.bob.x) * Math.min(1, rdt * 4); s.bob.z += (bz - s.bob.z) * Math.min(1, rdt * 4); s.bob.y = ty - 0.12;
    if (R() < rdt * (6 + Math.abs(RL.fv) * 30)) X.emit(s.bob.x + rr(-0.3, 0.3), ty + 0.05, s.bob.z + rr(-0.3, 0.3), rr(-1, 1), rr(1, 2.6), rr(-1, 1), 0xdff4ff, 0.09, 0.5, { grav: -8 });
    if ((s.ripT = (s.ripT || 0) - rdt) <= 0){ s.ripT = 0.25; ripple(s.bob.x, ty, s.bob.z, 0.2, 1.1, 0.7, 0.45); }
    reelTick(rdt);
  } else if (s.st === 'land'){
    const k = Math.min(1, s.t / 0.85), sx = s.bob.x, sz = s.bob.z, hx = pp.x + Math.sin(s.yaw) * 0.3, hz = pp.z + Math.cos(s.yaw) * 0.3, hy = pp.y + 2.3 + s.jl * 0.15;
    JUMP.position.set(lerp(sx, hx, k), lerp(ty, hy, k) + Math.sin(k * Math.PI) * (2 + s.jl * 0.6), lerp(sz, hz, k));
    JUMP.material.rotation = Math.sin(s.t * 14) * 0.5 * (1 - k);
    if (R() < rdt * 30) X.emit(JUMP.position.x, JUMP.position.y, JUMP.position.z, rr(-0.5, 0.5), rr(-1, 0.5), rr(-0.5, 0.5), 0xdff4ff, 0.07, 0.5, { grav: -9 });
    _b.copy(JUMP.position); s.bob.copy(_b);
    if (k >= 1) finishLand();
  } else if (s.st === 'show'){
    HELD.position.set(pp.x + Math.sin(s.yaw) * 0.2, pp.y + 2.35 + s.jl * 0.18 + Math.sin(s.t * 3) * 0.04, pp.z + Math.cos(s.yaw) * 0.2); HELD.material.rotation = Math.sin(s.t * 2.2) * 0.08;
    if (s.fish.r >= 2 && R() < rdt * 10) X.emit(HELD.position.x + rr(-s.jl / 2, s.jl / 2), HELD.position.y + rr(-0.2, 0.2), HELD.position.z, rr(-0.3, 0.3), rr(0.3, 1), rr(-0.3, 0.3), new THREE.Color(RAR[s.fish.r].c).getHex(), 0.1, 0.9, { drag: 1 });
    s.bob.set(HELD.position.x, HELD.position.y, HELD.position.z); HELDGLOW.position.copy(HELD.position);
    if (catchT > 0 && (catchT -= rdt) <= 0) closeCatch();
  } else if (s.st === 'ready'){
    if ((s.idleT += rdt) > 30) stopFishing('🎣 낚싯대를 거뒀어요');
  }
  // 찌 · 줄 그리기
  if (BOB.visible){ BOB.position.copy(s.bob); BOBGLOW.material.opacity = phase() === 'night' && !s.sp.plaza ? 0.75 : 0; }
  if (LINE.visible){
    const end = s.st === 'land' ? JUMP.position : s.bob, sag = s.st === 'wait' || s.st === 'cast' ? 0.5 : s.st === 'bite' ? 0.15 : 0.02;
    for (let i = 0; i < LN; i++){ const k = i / (LN - 1); _a.lerpVectors(_tip, end, k); _a.y -= Math.sin(k * Math.PI) * sag * Math.min(1, _tip.distanceTo(end) / 4); linePos[i * 3] = _a.x; linePos[i * 3 + 1] = _a.y; linePos[i * 3 + 2] = _a.z; }
    lineGeo.attributes.position.needsUpdate = true;
  }
  // '!' 말풍선
  if (bang.style.display === 'block'){ _hd.set(pp.x, pp.y + 2.1, pp.z).project(G.camera); bang.style.left = ((_hd.x * 0.5 + 0.5) * innerWidth) + 'px'; bang.style.top = ((-_hd.y * 0.5 + 0.5) * innerHeight) + 'px'; }
}

// ── 필드 낚시터 마크 애니메이션 · 물고기 점프 (주변 분위기) ──
let markT = 0;
function tickSpots(dt){
  if (!F.inField) return;
  markT += dt; const t = G.time;
  for (const s of SPOTS){
    const d = Math.hypot(pp.x - s.wx, pp.z - s.wz), on = d < 130 && !(FS && FS.sp === s);
    if (s.g.visible !== on) s.g.visible = on; if (!on) continue;
    s.fb.position.y = 0.02 + Math.sin(t * 2 + s.wx) * 0.03; s.fb.rotation.z = Math.sin(t * 1.3 + s.wz) * 0.12;
    for (let i = 0; i < 2; i++){ const k = ((t * 0.45 + i * 0.5 + s.wx * 0.01) % 1 + 1) % 1; s.rings[i].scale.setScalar(0.2 + k * (s.ice ? 0.9 : 1.6)); s.rings[i].material.opacity = (1 - k) * 0.45; }
    if (d < 60 && !s.ice && (s.jumpT -= dt) <= 0){ s.jumpT = rr(4, 10); const a = R() * TAU, r = rr(1.5, 5), jx = s.wx + Math.cos(a) * r, jz = s.wz + Math.sin(a) * r; if (F.isWater(jx, jz)) ambientJump(jx, s.wy, jz, s); }
  }
}
const AJ = { on: false, t: 0 };
function ambientJump(x, y, z, sp){
  if (AJ.on || JUMP.visible) return; const pool = FISH.filter(f => f.hab.some(h => sp.hab.includes(h)) && f.r <= 1 && !f.a.kind); if (!pool.length) return;
  const f = pick(pool), m = JUMP.material; m.map = artTex(f.id); m.needsUpdate = true; const sc = rr(0.35, 0.6); JUMP.scale.set(sc, sc / 2, 1);
  Object.assign(AJ, { on: true, t: 0, x, y, z, a: R() * TAU, dir: R() < 0.5 ? 1 : -1 }); JUMP.visible = true; splash(x, y, z, 6, 1.2); ripple(x, y, z, 0.1, 0.9, 0.9, 0.5);
}
function tickAJ(dt){
  if (!AJ.on) return; AJ.t += dt; const k = AJ.t / 0.7;
  if (k >= 1 || FS){ AJ.on = false; if (!FS || FS.st !== 'land') JUMP.visible = false; if (k >= 1){ const ex = AJ.x + Math.cos(AJ.a) * 1.1, ez = AJ.z + Math.sin(AJ.a) * 1.1; splash(ex, AJ.y, ez, 8, 1.3); ripple(ex, AJ.y, ez, 0.1, 1, 0.9, 0.55); } return; }
  JUMP.position.set(AJ.x + Math.cos(AJ.a) * 1.1 * k, AJ.y + Math.sin(k * Math.PI) * 0.9, AJ.z + Math.sin(AJ.a) * 1.1 * k); JUMP.material.rotation = (0.5 - k) * 1.6 * AJ.dir;
}

// ═════════════════════════ 5. 낚시 창 (도감 · 바구니 · 낚싯대 · 기록) ═════════════════════════
const fw = X.mk('div', 'mgFishW', ''); fw.className = 'mgw';
let fwOpen = false, fwTab = 'dex', fwShop = false, fwSel = null;
const nearNoah = () => { const o = F.npcs && F.npcs.fisher, n = byId('npcs', 'fisher'); const p = o && o.pos ? o.pos : n ? { x: n.c[0], z: n.c[1] } : null; return !!(p && F.inField && Math.hypot(pp.x - p.x, pp.z - p.z) < 9); };
function openFishLog(tab = 'dex', shop = false){ if (arcOpen) return; closeMenu(); fwTab = tab; fwShop = shop; fwSel = null; fwOpen = true; renderFishW(); fw.classList.add('on'); X.sfx('ui'); }
function closeFishW(){ if (!fwOpen) return; fwOpen = false; fw.classList.remove('on'); }
function keepValue(){ let s = 0; for (const [id, cm, pf] of S.fish.keep){ const f = FBY[id]; if (f) s += fishPrice(f, cm, pf); } return s; }
function renderFishW(){
  const shop = fwShop && nearNoah(), dn = dexN();
  let h = `<div class="hd"><span>ANGLER'S LOG</span><b>🎣 낚시 수첩</b><div class="tabs">${[['dex', '📖 도감'], ['keep', `🧺 바구니 ${S.fish.keep.length}`], ['rod', '🎣 낚싯대'], ['rec', '🏆 기록']].map(([k, n]) => `<button data-t="${k}" class="${fwTab === k ? 'on' : ''}">${n}</button>`).join('')}</div><div class="sp"></div><div class="gold">🪙 <b>${fmt(gold())}</b></div><button class="x">✕</button></div><div class="bd">`;
  if (fwTab === 'dex'){
    h += `<div class="dexh"><b>${dn} / ${FISH.length}</b><div class="pb"><i style="width:${dn / FISH.length * 100}%"></i></div><small>6종 은빛 · 12종 룬 낚싯대 · 15종 칭호 · 26종 「아르카디아 강태공」</small></div>`;
    const sel = fwSel && FBY[fwSel];
    if (sel){ const L = S.fish.log[sel.id]; h += `<div class="det"><img src="${artURL(sel.id, !L)}"><div><div class="nm" style="color:${RAR[sel.r].c}">${L ? esc(sel.n) : '???'}</div><div class="en">${L ? esc(sel.en) : 'UNKNOWN'}</div>
      <div style="color:${RAR[sel.r].c};font-size:13px">${stars(sel.r).replace('<i>', '<i style="font-style:normal;color:rgba(255,255,255,.15)">')} ${RAR[sel.r].n}</div><p>${L ? esc(sel.d) : '아직 낚아 본 적 없는 물고기. 서식지와 시간대를 노려 보자.'}</p>
      <div class="kv"><span>서식지</span><b>${sel.hab.map(x => HABN[x]).join(' · ')}</b><span>시간</span><b>${TIMEN[sel.time]}</b>${sel.rod ? `<span>조건</span><b>${RODS[sel.rod].n} 이상</b>` : ''}<span>크기</span><b>${sel.cm[0]} ~ ${sel.cm[1]} cm</b>${L ? `<span>잡은 수</span><b>${L.n}마리 · 최대 ${L.best.toFixed(1)}cm</b>` : ''}</div></div></div>`; }
    h += `<div class="grid">${FISH.map(f => { const L = S.fish.log[f.id]; return `<div class="fc r${f.r} ${L ? '' : 'no'}" data-f="${f.id}" style="--rc:${RAR[f.r].c}">${L ? `<div class="c">×${L.n}</div>` : ''}<img src="${artURL(f.id, !L)}" loading="lazy"><div class="n">${L ? esc(f.n) : '???'}</div><div class="s">${stars(f.r)}</div><div class="h">📍 ${f.hab.map(x => HABN[x].split(' (')[0]).join(' · ')}<br>${TIMEN[f.time]}${L ? ` · 최대 ${L.best.toFixed(1)}cm` : ''}</div></div>`; }).join('')}</div>`;
  } else if (fwTab === 'keep'){
    const v = keepValue(), grp = {};
    for (const [id, cm, pf] of S.fish.keep){ const g = grp[id] || (grp[id] = { n: 0, v: 0, best: 0, pf: 0 }); g.n++; g.v += fishPrice(FBY[id], cm, pf); g.best = Math.max(g.best, cm); g.pf += pf ? 1 : 0; }
    h += `<div class="sell"><div>바구니 <b style="font-size:16px">${S.fish.keep.length} / ${basketCap()}</b><small style="display:block;color:#9fb6c0">모두 팔면 🪙 <b style="font-size:16px">${fmt(v)}</b></small></div>${shop ? `<button class="btn" data-sell="all" ${S.fish.keep.length ? '' : 'disabled'}>모두 팔기</button>` : `<small style="color:#9fb6c0;text-align:right">물고기는 <span class="np">낚시꾼 노아</span><br>(은빛 호수 남쪽)에게 팔 수 있어요</small>`}</div>`;
    const ids = Object.keys(grp).sort((a, b) => FBY[b].r - FBY[a].r || grp[b].v - grp[a].v);
    h += ids.length ? `<div class="bk">${ids.map(id => { const f = FBY[id], g = grp[id]; return `<div class="row"><img src="${artURL(id)}"><div><div class="n" style="color:${RAR[f.r].c}">${esc(f.n)} <small style="display:inline">×${g.n}</small></div><small>최대 ${g.best.toFixed(1)}cm${g.pf ? ` · ✦ 완벽 ${g.pf}` : ''} · ${RAR[f.r].n}</small></div><div><div class="v">🪙 ${fmt(g.v)}</div>${shop ? `<button class="btn sub" data-sell="${id}" style="margin-top:3px">팔기</button>` : ''}</div></div>`; }).join('')}</div>` : `<p class="note">바구니가 비었어요. 낚시터(지도의 🎣)나 광장 분수에서 낚시를 해 보세요.</p>`;
  } else if (fwTab === 'rod'){
    const cur = S.fish.rod | 0;
    h += `<div class="flv"><div class="l">Lv.${S.fish.lv}</div><div class="b"><b style="font:700 14px 'Gowun Batang';color:#fff3d6">낚시 레벨</b> <small style="color:#9fb6c0">${S.fish.lv < FMAXLV ? `${fmt(S.fish.xp)} / ${fmt(fneed(S.fish.lv))} EXP` : 'MAX'} · 레벨마다 잡기 범위 · 희귀 확률 · 입질 속도 ↑</small><i><b style="width:${S.fish.lv < FMAXLV ? S.fish.xp / fneed(S.fish.lv) * 100 : 100}%"></b></i></div></div>`;
    h += `${shop ? '' : '<p class="note">낚싯대 강화는 <b>낚시꾼 노아</b>에게서 할 수 있어요.</p>'}<div class="rods">${RODS.map((T, i) => { const own = i <= cur, nx = i === cur + 1, rq = T.req || {}, ok = S.fish.lv >= (rq.lv || 0) && dexN() >= (rq.dex || 0);
      return `<div class="rd ${i === cur ? 'cur' : own ? 'own' : ''}"><div class="ic">${['🪵', '🎋', '🥈', '🔮', '🌟'][i]}</div><div><div class="n">${esc(T.n)}${i === cur ? ' <small style="display:inline;color:#7ff3ff">· 사용 중</small>' : ''}</div><small>${esc(T.d)}</small><div class="st">잡기 범위 ${Math.round(T.zone * 100)}% · 입질 ${T.bite.toFixed(2)}× · 희귀 ${T.rare.toFixed(2)}×${i >= 2 ? ' · 전설 반응' : ''}</div>${!own && (rq.lv || rq.dex) ? `<div class="rq" style="${ok ? 'color:#8aff9a' : ''}">조건: 낚시 Lv.${rq.lv || 1}${rq.dex ? ` · 도감 ${rq.dex}종` : ''}</div>` : ''}</div>
        <div>${own ? '' : `<button class="btn" data-rod="${i}" ${shop && nx && ok && gold() >= T.price ? '' : 'disabled'}>🪙 ${fmt(T.price)}</button>`}</div></div>`; }).join('')}</div>`;
  } else {
    const big = S.fish.big, bf = big && FBY[big[0]], legs = FISH.filter(f => f.r === 4 && S.fish.log[f.id]);
    h += `<div class="stat"><div>낚은 물고기<b>${fmt(S.fish.total)}<small> 마리</small></b></div><div>완벽한 낚시<b>${fmt(S.fish.perfect)}<small> 번</small></b></div><div>도감<b>${dexN()}<small> / ${FISH.length}</small></b></div>
      <div>판매 수익<b>🪙 ${fmt(S.fish.earned)}</b></div><div>물속 보물 상자<b>${fmt(S.fish.chests || 0)}<small> 개</small></b></div><div>낚시 레벨<b>${S.fish.lv}<small> / ${FMAXLV}</small></b></div>
      <div style="grid-column:1/-1">가장 큰 물고기<b>${bf ? `${esc(bf.n)} <small>${big[1].toFixed(1)}cm</small>` : '—'}</b></div>
      <div style="grid-column:1/-1">전설의 물고기<b>${legs.length ? legs.map(f => esc(f.n)).join(' · ') : '<small>아직 아무도… 밤의 호수를 노려 보세요</small>'}</b></div></div>`;
  }
  fw.innerHTML = h + '</div>';
  fw.querySelector('.x').onclick = closeFishW;
  fw.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { fwTab = b.dataset.t; fwSel = null; X.sfx('ui'); renderFishW(); });
  fw.querySelectorAll('.fc').forEach(b => b.onclick = () => { fwSel = fwSel === b.dataset.f ? null : b.dataset.f; X.sfx('pick'); renderFishW(); fw.querySelector('.bd').scrollTop = 0; });
  fw.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => sellFish(b.dataset.sell));
  fw.querySelectorAll('[data-rod]').forEach(b => b.onclick = () => buyRod(+b.dataset.rod));
}
function sellFish(which){
  if (!nearNoah()){ X.hint('낚시꾼 노아 곁에서만 팔 수 있어요', 2); return; }
  let sum = 0, n = 0; const left = [];
  for (const k of S.fish.keep){ if (which === 'all' || k[0] === which){ sum += fishPrice(FBY[k[0]], k[1], k[2]); n++; } else left.push(k); }
  if (!n) return; S.fish.keep = left; S.fish.earned += sum; S.fish.sold += n;
  addGold(sum); sfx('coin'); X.sfx('pick'); F.note(`<span style="color:#ffd36a">🐟 물고기 ${n}마리 판매 · 🪙 +${fmt(sum)}</span>`, 3);
  for (let i = 0; i < Math.min(30, 6 + n); i++) X.emit(pp.x + rr(-0.5, 0.5), pp.y + rr(0.8, 1.8), pp.z + rr(-0.5, 0.5), rr(-1.2, 1.2), rr(1, 3), rr(-1.2, 1.2), 0xffd36a, 0.12, 0.9, { grav: -5, drag: 1 });
  X.save(); renderFishW();
}
function buyRod(i){
  const T = RODS[i], rq = T.req || {};
  if (!nearNoah() || i !== (S.fish.rod | 0) + 1 || S.fish.lv < (rq.lv || 0) || dexN() < (rq.dex || 0) || gold() < T.price) return;
  addGold(-T.price); S.fish.rod = i; X.save(); sfx('chest'); X.sfx('level');
  X.banner('NEW ROD', T.n, `잡기 범위 ${Math.round(T.zone * 100)}% · 희귀 ${T.rare.toFixed(2)}×`, false, 2.8);
  for (let k = 0; k < 40; k++){ const a = R() * TAU; X.emit(pp.x + Math.cos(a) * 0.6, pp.y + rr(0.2, 2), pp.z + Math.sin(a) * 0.6, Math.cos(a) * rr(0.5, 1.5), rr(0.5, 2), Math.sin(a) * rr(0.5, 1.5), i >= 3 ? 0x7ff3ff : 0xffd36a, 0.13, rr(0.6, 1.1), { drag: 1.5 }); }
  renderFishW();
}

// ── 낚시꾼 노아 (F.roleTalkers.fish) ──
const NOAH_IDLE = ['오늘은 물빛이 좋군. 은빛 송어가 잘 물 거야.', '밤의 호수엔 다른 녀석들이 올라와. 달빛 해파리 같은 것 말이야.', '얼음 호수에선 구멍 하나로 별을 낚는다더군.', '안개 늪의 메기는 밤에 수염을 세우지.', '새벽 노을엔 무지개 송어가 개울을 거슬러 올라.'];
F.roleTalkers.fish = async n => {
  const id = n.id; X.NAMES[id] = n.name;
  if (FS) stopFishing();
  const L = [];
  if (!S.fish.met){ S.fish.met = 1;
    L.push([id, '쉿… 물고기가 놀라요. 처음 보는 얼굴이군. 난 노아, 이 호수에서만 사십 년을 낚시했지.'],
      [id, '낚시는 쉬워. 낚시터에서 E 로 찌를 던지고, 찌가 쑥 잠기면 그때 Space 로 챔질!'],
      [id, '그다음은 줄다리기야. 물고기가 초록 범위 안에 머물게 붙잡아. 누르면 올라가고, 떼면 내려가지.'],
      [id, '잡은 물고기는 나한테 가져와. 값은 넉넉히 쳐 주지. 그리고… 언젠가 「호수의 주인」 얘기도 해 주마.']); }
  // 칭호 · 보답
  const gives = [];
  if (S.fish.lv >= 5 && !S.fish.gave.f5){ S.fish.gave.f5 = 1; gives.push(['mg_fish5', '벌써 손이 꽤 익었군! 이 칭호를 받아. 물가의 견습생이라면 부끄럽지 않지.']); }
  if (S.fish.lv >= 10 && !S.fish.gave.f10){ S.fish.gave.f10 = 1; gives.push(['mg_fish10', '허허, 이제 나보다 낫겠는걸? 노련한 강태공이라 불러 주지.']); }
  if (dexN() >= 15 && !S.fish.gave.dex){ S.fish.gave.dex = 1; gives.push(['mg_dex', '도감이 열다섯 종이나! 자네는 이제 물고기 박사야.']); }
  for (const [tid, line] of gives){ L.push([id, line]); }
  if (S.fish.log.lakelord && !S.fish.gave.lord){ S.fish.gave.lord = 1; L.push([id, '…자네가 정말 「호수의 주인」을 낚았다고? 사십 년을 쫓던 그림자를…'], [id, '고맙네. 이제야 마음 편히 늙을 수 있겠어. 이건 내 스승의 유품이야. 🪙 5,000 받아 두게.']); }
  const v = keepValue(), dn = dexN(), lord = S.fish.gave.lord && !S.fish.gave.lordPaid;
  const opts = [`물고기 팔기 (${S.fish.keep.length}마리 · 🪙 ${fmt(v)})`, '낚싯대 강화', '물고기 도감', '낚시 이야기', '그만'];
  L.push([id, S.fish.keep.length ? `바구니가 묵직하군! ${S.fish.keep.length}마리면 🪙 ${fmt(v)} 쳐 주지.` : pick(NOAH_IDLE), opts]);
  const r = await X.say(L);
  for (const [tid] of gives) grant(tid);
  if (lord){ S.fish.gave.lordPaid = 1; addGold(5000); X.save(); }
  X.save();
  if (r === 0) openFishLog('keep', true); else if (r === 1) openFishLog('rod', true); else if (r === 2) openFishLog('dex', true);
  else if (r === 3){ const ph = phase(), tips = FISH.filter(f => !S.fish.log[f.id] && f.r <= 3);
    const tip = tips.length ? pick(tips) : null;
    await X.say([[id, tip ? `소문 하나 들려줄까? 「${tip.n}」은 ${tip.hab.map(x => HABN[x].split(' (')[0]).join(', ')}에서 ${TIMEN[tip.time].replace(/^[^ ]+ /, '')}${tip.time === 'any' ? ' 언제든' : '에'} 잡힌다더군.` : '이제 내가 아는 건 다 알려 줬네. 남은 건… 호수의 주인뿐이야.'],
      [id, ph === 'night' ? '지금은 밤이야. 밤에만 올라오는 녀석들이 있지. 은빛 낚싯대 이상이면 전설이 반응할지도 몰라.' : '밤이 되면 호수의 정자 근처를 노려 봐. 은빛 낚싯대가 있다면… 전설을 만날 수도 있어.']]); }
};

// ═════════════════════════ 6. 미니 게임 공용 오버레이 (전체 화면 캔버스) ═════════════════════════
let arcOpen = false, menuOpen = false, GM = null, paused = false, rafId = 0, lastT = 0, CW = 0, CH = 0, DPR = 1, hidScene = false;
const css2 = document.createElement('style');
css2.textContent = `
  #mgArc { position:fixed; inset:0; z-index:30; display:none; background:#05070d; user-select:none; -webkit-user-select:none; touch-action:none; overflow:hidden; font:400 13px 'Noto Sans KR'; color:#e8e1cf; }
  #mgArc.on { display:block; animation:mgFade .35s ease-out; } @keyframes mgFade { from { opacity:0; } }
  #mgArc canvas { position:absolute; inset:0; width:100%; height:100%; display:block; }
  #mgArc.aim canvas { cursor:none; }
  #mgArc .top { position:absolute; left:0; right:0; top:0; display:flex; align-items:flex-start; gap:12px; padding:calc(10px + env(safe-area-inset-top)) 14px 0; pointer-events:none; }
  #mgArc .top .tt { flex:1; min-width:0; } #mgArc .top .tt span { display:block; font:700 10px 'Cinzel'; letter-spacing:.4em; color:#7ff3ff; } #mgArc .top .tt b { font:700 18px 'Gowun Batang'; color:#fff3d6; text-shadow:0 2px 8px #000; white-space:nowrap; }
  #mgArc .top .pr { height:4px; width:min(240px, 40vw); margin-top:5px; border-radius:2px; background:rgba(255,255,255,.12); overflow:hidden; } #mgArc .top .pr i { display:block; height:100%; width:0; background:linear-gradient(90deg,#7ff3ff,#ffd36a); }
  #mgArc .top .sc { text-align:right; } #mgArc .top .sc b { display:block; font:900 26px 'Cinzel'; color:#fff; text-shadow:0 0 12px rgba(127,243,255,.5), 0 2px 6px #000; letter-spacing:.04em; } #mgArc .top .sc small { font:700 11px 'Noto Sans KR'; color:#bfe9ef; }
  #mgArc .top button { pointer-events:auto; width:38px; height:38px; border-radius:50%; border:1px solid rgba(233,200,126,.55); background:rgba(10,14,24,.7); color:#fff3d6; font:700 15px 'Noto Sans KR'; cursor:pointer; flex:none; }
  #mgArc .pan { position:absolute; inset:0; display:none; align-items:center; justify-content:center; padding:56px 12px 12px; background:radial-gradient(ellipse at center, rgba(5,8,16,.55), rgba(0,0,0,.85)); }
  #mgArc .pan.on { display:flex; animation:mgFade .3s; }
  #mgArc .card { width:min(560px, 96vw); max-height:calc(100vh - 70px); overflow:auto; padding:16px 18px; text-align:center; background:linear-gradient(180deg, rgba(16,20,34,.97), rgba(7,9,16,.97)); border:1px solid rgba(233,200,126,.55); border-radius:8px; box-shadow:0 0 0 4px rgba(10,14,24,.5), 0 20px 60px rgba(0,0,0,.7); }
  #mgArc .card h2 { margin:0; font:900 26px 'Gowun Batang'; color:#fff8e6; letter-spacing:.06em; } #mgArc .card .k { font:700 10px 'Cinzel'; letter-spacing:.5em; color:#7ff3ff; }
  #mgArc .card p { font:400 12.5px/1.65 'Noto Sans KR'; color:#a8bcc4; margin:6px 0 12px; } #mgArc .card p b { color:#ffd36a; }
  #mgArc .btn { font:700 14px 'Gowun Batang'; letter-spacing:.12em; color:#10131c; padding:10px 22px; border:none; border-radius:3px; cursor:pointer; background:linear-gradient(180deg,#fff2c9,#e2b964 60%,#b88c3e); margin:3px; }
  #mgArc .btn.sub { color:#fff3d6; background:rgba(233,200,126,.1); border:1px solid rgba(233,200,126,.45); }
  #mgArc .songs { display:flex; flex-direction:column; gap:8px; margin:6px 0 10px; text-align:left; }
  #mgArc .song { --c:#7ff3ff; display:grid; grid-template-columns:52px minmax(0,1fr) auto; gap:12px; align-items:center; padding:10px 12px; border-radius:8px; background:linear-gradient(90deg, color-mix(in srgb, var(--c) 16%, rgba(20,26,40,.9)), rgba(8,10,18,.9)); border:1px solid color-mix(in srgb, var(--c) 50%, transparent); }
  #mgArc .song .ic { width:52px; height:52px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:24px; background:radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--c) 60%, #fff), color-mix(in srgb, var(--c) 40%, #000)); box-shadow:0 0 16px color-mix(in srgb, var(--c) 50%, transparent); }
  #mgArc .song .n { font:700 16px 'Gowun Batang'; color:#fff3d6; } #mgArc .song .n small { font:700 9px 'Cinzel'; letter-spacing:.2em; color:#9fb6c0; margin-left:6px; }
  #mgArc .song .m { font:500 11px 'Noto Sans KR'; color:#9fb6c0; } #mgArc .song .m b { color:#fff; }
  @media (max-height:560px){ #mgArc .card { padding:10px 14px; } #mgArc .card h2 { font-size:21px; } #mgArc .card p { margin:3px 0 8px; font-size:11.5px; } #mgArc .song { padding:6px 10px; grid-template-columns:40px minmax(0,1fr) auto; } #mgArc .song .ic { width:40px; height:40px; font-size:19px; } #mgArc .songs { gap:6px; } #mgArc .grade { font-size:60px; } #mgArc .res { margin:6px 0; } }
  #mgArc .song .bs { display:flex; flex-direction:column; gap:4px; } #mgArc .song .bs button { font:700 12px 'Gowun Batang'; padding:6px 10px; border-radius:4px; cursor:pointer; border:1px solid color-mix(in srgb, var(--c) 70%, transparent); background:rgba(0,0,0,.3); color:#fff3d6; white-space:nowrap; }
  #mgArc .song .bs button.h { border-color:#ff8a8a; } #mgArc .song .bs button em { font-style:normal; color:#ffd36a; margin-left:4px; font-family:'Cinzel'; }
  #mgArc .opts { display:flex; justify-content:center; gap:14px; flex-wrap:wrap; font:500 12px 'Noto Sans KR'; color:#c9d6da; margin:4px 0 10px; } #mgArc .opts span { display:inline-flex; align-items:center; gap:6px; }
  #mgArc .opts button { width:26px; height:26px; border-radius:50%; border:1px solid rgba(233,200,126,.5); background:rgba(255,255,255,.05); color:#fff3d6; cursor:pointer; } #mgArc .opts b { min-width:46px; color:#fff; font-family:'Cinzel'; }
  #mgArc .grade { font:900 84px/1 'Cinzel'; margin:6px 0 2px; background:linear-gradient(180deg,#fff7df 10%,#ffd36a 55%,#b0782a); -webkit-background-clip:text; background-clip:text; color:transparent; filter:drop-shadow(0 4px 16px rgba(255,200,80,.4)); animation:mgGr .6s cubic-bezier(.2,1.6,.4,1); }
  @keyframes mgGr { from { transform:scale(2.2); opacity:0; } }
  #mgArc .res { display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:6px; margin:10px 0; } #mgArc .res div { padding:7px 6px; border-radius:6px; background:rgba(255,255,255,.04); font:500 11px 'Noto Sans KR'; color:#9fb6c0; } #mgArc .res b { display:block; font:900 18px 'Cinzel'; color:#fff3d6; }
  #mgArc .badge { display:inline-block; margin:2px 4px; padding:3px 12px; border-radius:12px; font:900 12px 'Cinzel'; letter-spacing:.12em; color:#2a1a00; background:linear-gradient(180deg,#fff2c9,#ffb03a); }
  #mgArc .badge.b { color:#002a2e; background:linear-gradient(180deg,#eaffff,#3fd8e8); } #mgArc .badge.r { color:#fff; background:linear-gradient(180deg,#ff7a9a,#c0306a); }
  #mgArc .rw { font:700 15px 'Noto Sans KR'; color:#ffe9b0; margin:6px 0 12px; } #mgArc .rw small { display:block; font:500 11px 'Noto Sans KR'; color:#8aff9a; }
  #mgArc .cnt { position:absolute; left:50%; top:42%; transform:translate(-50%,-50%); font:900 clamp(60px, 14vw, 120px) 'Cinzel'; color:#fff8e6; text-shadow:0 0 30px rgba(255,211,106,.7), 0 6px 20px #000; pointer-events:none; display:none; }
  #mgArc .cnt.on { display:block; animation:mgCnt .5s ease-out; } @keyframes mgCnt { from { transform:translate(-50%,-50%) scale(1.8); opacity:0; } }
  #mgArc .help { position:absolute; left:50%; top:calc(58px + env(safe-area-inset-top)); transform:translateX(-50%); transition:opacity 1s; font:500 12px 'Noto Sans KR'; color:rgba(220,235,240,.75); pointer-events:none; white-space:nowrap; text-shadow:0 1px 3px #000; }
  #mgArc .help b { color:#ffd36a; border:1px solid rgba(233,200,126,.6); border-radius:4px; padding:0 5px; margin:0 2px; }
  #mgMenu { width:min(760px, 96vw); }
  #mgMenu .gm { display:grid; grid-template-columns:repeat(auto-fit, minmax(165px, 1fr)); gap:10px; }
  #mgMenu .gc { --c:#7ff3ff; position:relative; display:flex; flex-direction:column; border-radius:9px; overflow:hidden; background:rgba(10,14,24,.85); border:1px solid color-mix(in srgb, var(--c) 55%, transparent); box-shadow:0 6px 20px rgba(0,0,0,.4); transition:transform .15s, box-shadow .15s; }
  #mgMenu .gc:hover { transform:translateY(-3px); box-shadow:0 10px 26px rgba(0,0,0,.5), 0 0 22px color-mix(in srgb, var(--c) 35%, transparent); }
  #mgMenu .gc .art { position:relative; height:92px; display:flex; align-items:center; justify-content:center; font-size:46px; overflow:hidden;
    background:radial-gradient(circle at 50% 120%, color-mix(in srgb, var(--c) 70%, transparent), transparent 70%), repeating-linear-gradient(115deg, rgba(255,255,255,.04) 0 10px, transparent 10px 22px), linear-gradient(180deg, #0c1222, #182238); }
  #mgMenu .gc .art::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg, transparent 55%, rgba(10,14,24,.95)); }
  #mgMenu .gc .art span { position:relative; z-index:1; filter:drop-shadow(0 0 16px color-mix(in srgb, var(--c) 80%, transparent)); animation:mgFloat 3s ease-in-out infinite; } @keyframes mgFloat { 50% { transform:translateY(-6px); } }
  #mgMenu .gc .art em { position:absolute; left:10px; top:8px; z-index:1; font:700 9px 'Cinzel'; letter-spacing:.3em; color:var(--c); font-style:normal; }
  #mgMenu .gc .art .dly { position:absolute; right:8px; top:7px; z-index:1; font:900 10px 'Noto Sans KR'; color:#2a1a00; background:linear-gradient(180deg,#fff2c9,#ffb03a); padding:2px 8px; border-radius:10px; animation:mgPulse .9s infinite alternate; }
  #mgMenu .gc .tx { padding:2px 12px 10px; flex:1; display:flex; flex-direction:column; gap:3px; } #mgMenu .gc .n { font:700 17px 'Gowun Batang'; color:#fff3d6; } #mgMenu .gc .d { font:400 11.5px/1.55 'Noto Sans KR'; color:#9fb6c0; flex:1; }
  #mgMenu .gc .b { font:500 11px 'Noto Sans KR'; color:#c9d6da; } #mgMenu .gc .b b { color:#ffe9b0; font-family:'Cinzel'; } #mgMenu .gc .btn { margin-top:6px; }
  #modes #mMini { position:relative; } #modes #mMini.dot::after { content:''; position:absolute; right:4px; top:4px; width:9px; height:9px; border-radius:50%; background:#ff4a4a; box-shadow:0 0 6px #ff4a4a; margin:0; }
`;
document.head.appendChild(css2);
const arc = X.mk('div', 'mgArc', `<canvas></canvas><div class="top"><div class="tt"><span></span><b></b><div class="pr"><i></i></div></div><div class="sc"><b>0</b><small></small></div><button class="ps" title="일시정지 (Esc)">❚❚</button><button class="cl" title="닫기">✕</button></div><div class="cnt"></div><div class="help"></div><div class="pan"><div class="card"></div></div>`);
const cv = arc.querySelector('canvas'), cx = cv.getContext('2d');
const AU = { tt: arc.querySelector('.tt span'), tb: arc.querySelector('.tt b'), pr: arc.querySelector('.pr i'), sc: arc.querySelector('.sc b'), ss: arc.querySelector('.sc small'), cnt: arc.querySelector('.cnt'), help: arc.querySelector('.help'), pan: arc.querySelector('.pan'), card: arc.querySelector('.card'), top: arc.querySelector('.top') };
function sizeArc(){ DPR = Math.min(devicePixelRatio || 1, G.gfxMode === 'low' ? 1 : G.IS_TOUCH ? 1.5 : 2); CW = innerWidth; CH = innerHeight; cv.width = Math.round(CW * DPR); cv.height = Math.round(CH * DPR); cx.setTransform(DPR, 0, 0, DPR, 0, 0); if (GM && GM.resize) GM.resize(); }
addEventListener('resize', () => { if (arcOpen) sizeArc(); });
function panel(html){ AU.card.innerHTML = html; AU.pan.classList.add('on'); }
function hidePanel(){ AU.pan.classList.remove('on'); }
let cntT = 0;
function countText(t, dur = 0.7){ AU.cnt.textContent = t; AU.cnt.classList.remove('on'); void AU.cnt.offsetWidth; AU.cnt.classList.add('on'); cntT = dur; }
function canPlay(quiet){
  const no = m => { if (!quiet) X.toast('미니 게임', m); return false; };
  if (X.dead || X.dialogOpen || X.tpBusy) return no('지금은 열 수 없어요');
  if (X.mode === 'plaza') return true;
  if (X.mode === 'field' && F.inField){ if (X.foesIn(pp.x, pp.z, 22).length) return no('⚔ 전투 중에는 열 수 없어요'); return true; }
  return no('광장이나 안전한 곳에서 열 수 있어요');
}
function clearKeys(){ if (G.keys) for (const k in G.keys) G.keys[k] = false; }
function arcadeOpen(id){
  if (!canPlay()) return; const g = GAMES[id]; if (!g) return;
  closeMenu(); closeFishW(); if (FS) stopFishing(); ac(); clearKeys();
  arcOpen = true; paused = false; GM = g; arc.classList.add('on'); arc.classList.toggle('aim', !!g.aim); sizeArc(); hidePanel(); AU.cnt.classList.remove('on');
  // 화면을 다 덮는 동안 3D 장면은 그리지 않아요 (모바일 배터리 · 프레임)
  if (G.scene.visible){ G.scene.visible = false; hidScene = true; }
  AU.pr.style.width = '0%'; AU.sc.textContent = '0'; AU.ss.textContent = '';
  g.open(); lastT = performance.now(); cancelAnimationFrame(rafId); rafId = requestAnimationFrame(loop);
}
function arcadeClose(){
  if (!arcOpen) return; try { GM && GM.close(); } catch (e){ console.error(e); }
  GM = null; arcOpen = false; paused = false; arc.classList.remove('on'); cancelAnimationFrame(rafId); clearKeys();
  if (hidScene){ G.scene.visible = true; hidScene = false; }
  musicStop(); if (AC && AC._paused){ AC._paused = false; AC.resume(); }
}
function setPause(v){
  if (!GM || !GM.playing || !GM.playing()) return; paused = v;
  if (AC){ if (v){ AC._paused = true; AC.suspend(); } else { AC._paused = false; AC.resume(); } }
  if (GM.pause) GM.pause(v);
  if (v) panel(`<div class="k">PAUSED</div><h2>일시정지</h2><p>잠깐 쉬어 가요.</p><button class="btn" data-a="go">계속하기</button><button class="btn sub" data-a="re">처음부터</button><button class="btn sub" data-a="q">그만하기</button>`), bindPan({ go: () => setPause(false), re: () => { setPause(false); GM.restart(); }, q: () => { paused = false; if (AC){ AC._paused = false; AC.resume(); } GM.quit ? GM.quit() : arcadeClose(); } });
  else hidePanel();
}
function bindPan(map){ AU.card.querySelectorAll('[data-a]').forEach(b => b.onclick = e => { e.stopPropagation(); X.sfx('ui'); const f = map[b.dataset.a]; if (f) f(b); }); }
function loop(t){
  rafId = requestAnimationFrame(loop); const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000)); lastT = t;
  if (cntT > 0 && (cntT -= dt) <= 0) AU.cnt.classList.remove('on');
  if (!GM) return;
  try { if (!paused) GM.frame(dt); GM.draw(cx, dt); } catch (e){ console.error('[minigames]', e); arcadeClose(); }
}
arc.querySelector('.cl').onclick = e => { e.stopPropagation(); X.sfx('ui'); if (GM && GM.quit) GM.quit(); else arcadeClose(); };
arc.querySelector('.ps').onclick = e => { e.stopPropagation(); setPause(!paused); };
// 키: 열려 있는 동안 엔진으로 안 넘겨요 (WASD 이동 · F/J 공격 방지)
addEventListener('keydown', e => { if (!arcOpen || e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.code)) return; e.preventDefault(); e.stopImmediatePropagation(); if (e.repeat) return;
  if (e.code === 'Escape'){ if (GM && GM.playing && GM.playing()) setPause(!paused); else if (GM && GM.quit) GM.quit(); else arcadeClose(); return; }
  if (!paused && GM && GM.key) GM.key(e.code, true); }, true);
addEventListener('keyup', e => { if (!arcOpen) return; e.preventDefault(); e.stopImmediatePropagation(); if (GM && GM.key) GM.key(e.code, false); }, true);
const PTR = new Map();
cv.addEventListener('pointerdown', e => { if (!GM || paused) return; e.preventDefault(); cv.setPointerCapture && cv.setPointerCapture(e.pointerId); PTR.set(e.pointerId, 1); GM.ptr && GM.ptr('down', e.clientX, e.clientY, e.pointerId); });
cv.addEventListener('pointermove', e => { if (GM && GM.ptr) GM.ptr('move', e.clientX, e.clientY, e.pointerId); });
for (const ev of ['pointerup', 'pointercancel']) cv.addEventListener(ev, e => { PTR.delete(e.pointerId); if (GM && GM.ptr) GM.ptr('up', e.clientX, e.clientY, e.pointerId); });
document.addEventListener('visibilitychange', () => { if (document.hidden && arcOpen && !paused) setPause(true); });
// 보상: 오늘 첫 판은 골드 ×2
function reward(id, score, g){
  const d = today(); if (S.mini.day !== d){ S.mini.day = d; S.mini.daily = {}; }
  const first = !S.mini.daily[id] && g > 0; if (first) S.mini.daily[id] = 1; const gg = Math.max(0, Math.round(g * (first ? 2 : 1)));
  if (gg) addGold(gg); S.mini.plays[id] = (S.mini.plays[id] || 0) + 1; BUS.emit('minigame', { id, score }); X.save(); return { g: gg, first };
}
const dailyLeft = id => S.mini.day !== today() || !S.mini.daily[id];
function setBest(k, v){ const old = S.mini.best[k] || 0; if (v > old){ S.mini.best[k] = v; return true; } return false; }

// ── 음악 엔진 (WebAudio 합성 · 미리 짠 악보를 앞서서 예약) ──
const MUS = { ev: [], i: 0, t0: 0, out: null, rev: null, nodes: [] };
const NOTE_I = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = s => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(s); return m ? 12 * (+m[3] + 1) + NOTE_I[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) : 60; };
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
const chord = s => { const m = /^([A-G])(#|b)?(m)?(7)?$/.exec(s), r = NOTE_I[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); return { r: 36 + r, t: [0, m[3] ? 3 : 4, 7, m[4] ? 10 : 12] }; };
function musicStart(){
  const a = ac(); if (!a) return;
  const out = a.createGain(); out.gain.value = 0.8; const comp = a.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; out.connect(comp); comp.connect(a.destination);
  // 잔향 (짧은 홀)
  const len = Math.round(a.sampleRate * 1.6), ir = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++){ const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (R() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  const rev = a.createConvolver(); rev.buffer = ir; const rg = a.createGain(); rg.gain.value = 0.28; rev.connect(rg); rg.connect(out);
  MUS.out = out; MUS.rev = rev; MUS.comp = comp;
}
function musicStop(){ if (MUS.out){ const a = AC, o = MUS.out, c = MUS.comp; try { o.gain.setTargetAtTime(0, a.currentTime, 0.03); } catch (e){} setTimeout(() => { try { o.disconnect(); c.disconnect(); } catch (e){} }, 200); } MUS.out = null; MUS.rev = null; MUS.ev = []; MUS.i = 0; }
function vEnv(g, t, a, peak, dur, rel){ g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(peak * 0.55, t + a, dur * 0.4); g.gain.setTargetAtTime(0.0001, t + dur, rel); }
function voice(type, f, t, dur, vol, o = {}){
  const a = AC, g = a.createGain(), fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.cut || 3000, t); if (o.env) fl.frequency.setTargetAtTime(o.cut * 0.35, t, dur * 0.5); fl.Q.value = o.q || 0.7;
  const os = []; for (const dt of (o.det || [0])){ const s = a.createOscillator(); s.type = type; s.frequency.setValueAtTime(f, t); s.detune.value = dt; if (o.vib && dur > 0.3){ const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + 0.25); l.connect(lg); lg.connect(s.frequency); l.start(t); l.stop(t + dur + 0.4); } s.connect(fl); s.start(t); s.stop(t + dur + (o.rel || 0.1) * 5 + 0.05); os.push(s); }
  vEnv(g, t, o.att || 0.008, vol, dur, o.rel || 0.08); fl.connect(g); g.connect(MUS.out); if (o.wet && MUS.rev){ const w = a.createGain(); w.gain.value = o.wet; g.connect(w); w.connect(MUS.rev); }
}
function drum(k, t){
  const a = AC, out = MUS.out;
  const nz = (dur, vol, f0, f1, type, q = 1) => { const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain(); s.buffer = NB; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(out); s.start(t, R() * 0.4); s.stop(t + dur + 0.02); return g; };
  if (k === 'k'){ const o = a.createOscillator(), g = a.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.35); nz(0.02, 0.25, 3000, 1500, 'bandpass'); }
  else if (k === 's'){ nz(0.16, 0.42, 2400, 1200, 'bandpass', 0.8); const o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.14); if (MUS.rev){ const w = a.createGain(); w.gain.value = 0.35; const g2 = nz(0.12, 0.2, 2000, 1000, 'bandpass'); g2.connect(w); w.connect(MUS.rev); } }
  else if (k === 'h') nz(0.045, 0.13, 9000, 7000, 'highpass', 0.6);
  else if (k === 'o') nz(0.22, 0.12, 8000, 6000, 'highpass', 0.6);
  else if (k === 'c'){ const g = nz(1.4, 0.2, 6000, 3000, 'highpass', 0.4); if (MUS.rev){ const w = a.createGain(); w.gain.value = 0.5; g.connect(w); w.connect(MUS.rev); } }
  else if (k === 'p'){ for (let i = 0; i < 3; i++){ const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain(), tt = t + i * 0.011; s.buffer = NB; fl.type = 'bandpass'; fl.frequency.value = 1500; g.gain.setValueAtTime(0.3, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + (i === 2 ? 0.14 : 0.02)); s.connect(fl); fl.connect(g); g.connect(out); s.start(tt, R() * 0.3); s.stop(tt + 0.16); } }
}
function musicTick(now){ // now = AC 시각
  if (!MUS.out) return; const ev = MUS.ev;
  while (MUS.i < ev.length && ev[MUS.i][0] + MUS.t0 < now + 0.22){ const e = ev[MUS.i++], t = Math.max(now, e[0] + MUS.t0), ins = MUS.inst;
    if (e[1] === 'lead') voice(ins.lead, mf(e[2]), t, e[3] * 0.92, ins.lv, { det: ins.ldet, cut: ins.lcut, env: ins.lenv, vib: 1, wet: 0.45, rel: 0.09 });
    else if (e[1] === 'bass') voice(ins.bass, mf(e[2]), t, e[3] * 0.9, ins.bv, { cut: ins.bcut, env: 1, rel: 0.05 });
    else if (e[1] === 'pad'){ for (const n of e[2]) voice('sawtooth', mf(n), t, e[3] * 0.95, ins.pv, { det: [-9, 9], cut: ins.pcut || 900, att: 0.25, rel: 0.3, wet: 0.6 }); }
    else if (e[1] === 'arp') voice('square', mf(e[2]), t, e[3], ins.av, { cut: 2400, env: 1, rel: 0.04, wet: 0.3 });
    else drum(e[1], t); }
}
// 드럼 · 베이스 패턴 (한 마디)
const DRUMS = {
  intro: { k: 'x...x...', h: '..x...x.' }, pop: { k: 'x..xx...', s: '..x...x.', h: 'xxxxxxxx' }, pop2: { k: 'x..xx..x', s: '..x...x.', h: 'xxxxxxxo' },
  march: { k: 'x...x...', s: '..x.x.xx', h: 'x.x.x.x.', p: '......x.' }, march2: { k: 'x.x.x.x.', s: '..x...x.', h: 'xxxxxxxx', p: '..x...x.' }, end: { k: 'x.......', h: 'x.......' },
  build: { k: 'x...x...x...x...', h: '..x...x...x...x.' }, rock: { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  drive: { k: 'x..x..x.x..x..x.', s: '....x.......x..x', h: 'xxxxxxxxxxxxxxxx' }, end4: { k: 'x...............', h: 'x...............' },
};
const BASS = { pop: 'R . R 5 R . O 5', walk: 'R - 5 - O - 5 -', march: 'R . 5 . R . 5 .', drive: 'R . R . O . R . R . R . O . 5 .', hold: 'R - - - - - - -', hold4: 'R - - - - - - - - - - - - - - -' };
// 곡: 섹션(코드 · 멜로디 · 드럼 · 베이스) → 순서
const SONGS = [
  { id: 'sprout', n: '새싹 마을의 아침', en: 'SPROUT MORNING', icon: '🌱', col: '#8aff9a', bpm: 104, div: 2, lv: [2, 5], g: [110, 200],
    inst: { lead: 'triangle', ldet: [0, 7], lv: 0.2, lcut: 4200, bass: 'triangle', bv: 0.32, bcut: 900, pv: 0.022, pcut: 1100, av: 0.03 },
    sec: {
      I: { ch: 'C G', dr: 'intro', bs: 'walk', crash: 0 },
      A: { ch: 'C G Am F C G F G', dr: 'pop', bs: 'pop', crash: 1, lead: `E5 - G5 - A5 G5 E5 - | D5 - - . D5 E5 G5 - | C5 - E5 - A5 - G5 E5 | F5 - - - E5 - D5 - | E5 - G5 - C6 - B5 A5 | G5 - - . G5 A5 B5 - | A5 - G5 - F5 - E5 D5 | D5 - - - G4 A4 B4 -` },
      B: { ch: 'F G Em Am F G C C', dr: 'pop2', bs: 'walk', crash: 1, lead: `A4 - C5 - F5 - E5 - | D5 - B4 - G4 - . . | G4 - B4 - E5 - D5 - | C5 - - - A4 - . . | F5 - E5 - D5 - C5 - | B4 - D5 - G5 - F5 - | E5 - - - G5 - - - | C6 - - - - - . .` },
      Z: { ch: 'C G Am F C G F C', dr: 'pop', bs: 'pop', crash: 1, lead: `E5 - G5 - A5 G5 E5 - | D5 - - . D5 E5 G5 - | C5 - E5 - A5 - G5 E5 | F5 - - - E5 - D5 - | E5 - G5 - C6 - B5 A5 | G5 - - . G5 A5 B5 - | A5 - G5 - F5 - E5 D5 | C5 - - - - - . .` },
      O: { ch: 'F C', dr: 'end', bs: 'hold', crash: 1, lead: `A5 - G5 - E5 - D5 - | C5 - - - - - - .` },
    }, order: ['I', 'A', 'B', 'Z', 'O'] },
  { id: 'march', n: '룬의 광장 행진곡', en: 'RUNE PLAZA MARCH', icon: '🎺', col: '#ffd36a', bpm: 132, div: 2, lv: [4, 7], g: [160, 280],
    inst: { lead: 'square', ldet: [0, -6], lv: 0.11, lcut: 3200, bass: 'sawtooth', bv: 0.16, bcut: 700, pv: 0.016, pcut: 1300, av: 0.03 },
    sec: {
      I: { ch: 'G D', dr: 'march', bs: 'march', crash: 0 },
      A: { ch: 'G D Em C G D C D', dr: 'march', bs: 'march', crash: 1, lead: `G4 B4 D5 - B4 D5 G5 - | F#5 - E5 D5 A4 - D5 - | E5 - G5 - B5 - A5 G5 | E5 - - D5 C5 - B4 - | D5 G5 B5 - A5 G5 D5 - | F#5 - A5 - D6 - C6 A5 | B5 - G5 - A5 - E5 F#5 | G5 - - - D5 - - .` },
      B: { ch: 'Em C G D Em C D D', dr: 'march2', bs: 'pop', crash: 1, lead: `B4 - E5 - G5 - F#5 E5 | G5 - - E5 C5 - E5 - | D5 - G5 - B5 - A5 G5 | A5 - - - F#5 - D5 - | E5 G5 B5 - G5 B5 E6 - | D6 - C6 - B5 - G5 - | A5 - F#5 - A5 - D6 - | C6 - B5 - A5 - F#5 -` },
      Z: { ch: 'G D Em C G D C G', dr: 'march2', bs: 'march', crash: 1, lead: `G4 B4 D5 - B4 D5 G5 - | F#5 - E5 D5 A4 - D5 - | E5 - G5 - B5 - A5 G5 | E5 - - D5 C5 - B4 - | D5 G5 B5 - A5 G5 D5 - | F#5 - A5 - D6 - C6 A5 | B5 - G5 - A5 - F#5 - | G5 - - - - - . .` },
      O: { ch: 'C G', dr: 'end', bs: 'hold', crash: 1, lead: `E5 - D5 - C5 - B4 - | G4 - - - - - - .` },
    }, order: ['I', 'A', 'B', 'A', 'B', 'Z', 'O'] },
  { id: 'cryos', n: '서리 거룡의 분노', en: 'WRATH OF CRYOS', icon: '🐉', col: '#7ab8ff', bpm: 150, div: 4, lv: [6, 9], g: [220, 400],
    inst: { lead: 'sawtooth', ldet: [0, 9], lv: 0.085, lcut: 2600, lenv: 1, bass: 'sawtooth', bv: 0.15, bcut: 520, pv: 0.014, pcut: 800, av: 0.026 },
    sec: {
      I: { ch: 'Am F C E', dr: 'build', bs: 'hold4', arp: 1, crash: 0 },
      A: { ch: 'Am F C G Am F E E', dr: 'rock', bs: 'drive', arp: 1, crash: 1, lead: `A4 - - - C5 - E5 - A5 - - - G5 - E5 - | F5 - - - E5 - D5 - C5 - - - A4 - C5 - | E5 - - - G5 - C6 - B5 - - - G5 - E5 - | D5 - - - G5 - B5 - D6 - - - B5 - G5 - | A5 - - - A5 - B5 - C6 - B5 - A5 - E5 - | F5 - - - A5 - C6 - F5 - - - E5 - C5 - | B4 - - - G#4 - E4 - B4 - - - E5 - G#5 - | B5 - - - - - - - E5 F5 G#5 A5 B5 C6 D6 E6` },
      B: { ch: 'Dm Am E Am Dm Am F E', dr: 'drive', bs: 'drive', arp: 1, crash: 1, lead: `D5 - - - F5 - - - A5 - - - D6 - - - | C6 - - - B5 - A5 - E5 - - - A5 - - - | G#5 - - - B5 - - - E6 - - - D6 - B5 - | C6 - - - - - - - A5 - - - E5 - - - | F5 - E5 - D5 - F5 - A5 - G5 - F5 - A5 - | E6 - D6 - C6 - B5 - A5 - - - E5 - - - | F5 - A5 - C6 - A5 - E6 - C6 - A5 - F5 - | E5 G#5 B5 E6 - - - - B5 G#5 E5 B4 - - - -` },
      Z: { ch: 'Am F C G Am F E Am', dr: 'drive', bs: 'drive', arp: 1, crash: 1, lead: `A4 - - - C5 - E5 - A5 - - - G5 - E5 - | F5 - - - E5 - D5 - C5 - - - A4 - C5 - | E5 - - - G5 - C6 - B5 - - - G5 - E5 - | D5 - - - G5 - B5 - D6 - - - B5 - G5 - | A5 - - - A5 - B5 - C6 - B5 - A5 - E5 - | F5 - - - A5 - C6 - F5 - - - E5 - C5 - | B4 - - - G#4 - E4 - B4 - - - E5 - G#5 - | A5 - - - - - - - - - - - . . . .` },
      O: { ch: 'F Am', dr: 'end4', bs: 'hold4', crash: 1, lead: `A4 - C5 - E5 - A5 - C6 - - - - - - - | . . . . . . . . . . . . . . . .` },
    }, order: ['I', 'A', 'B', 'A', 'B', 'Z', 'O'] },
];
// 악보 → 예약 목록 + 멜로디 (채보용)
function buildSong(song){
  const spb = 60 / song.bpm, step = spb / song.div, per = song.div * 4, bar = step * per, ev = [], lead = [], kicks = [];
  let b = 0, si = 0;
  for (const key of song.order){
    const sec = song.sec[key], chs = sec.ch.split(' '), L = sec.lead ? sec.lead.replace(/\|/g, ' ').trim().split(/\s+/) : null, dr = DRUMS[sec.dr], bp = BASS[sec.bs].split(' ');
    for (let j = 0; j < chs.length; j++){
      const t0 = (b + j) * bar, c = chord(chs[j]);
      for (const k of ['k', 's', 'h', 'o', 'p']){ const p = dr[k]; if (!p) continue; for (let i = 0; i < per; i++) if (p[i % p.length] === 'x'){ ev.push([t0 + i * step, k]); if (k === 'k') kicks.push({ t: t0 + i * step, sec: si, key }); } }
      if (j === 0 && sec.crash) ev.push([t0, 'c']);
      for (let i = 0; i < per; i++){ const tk = bp[i % bp.length]; if (tk === '.' || tk === '-') continue; let len = 1; while (bp[(i + len) % bp.length] === '-' && i + len < per) len++;
        const m = c.r + (tk === '5' ? 7 : tk === '3' ? c.t[1] : tk === 'O' ? 12 : 0); ev.push([t0 + i * step, 'bass', m, len * step]); }
      ev.push([t0, 'pad', c.t.slice(0, 3).map(x => c.r + 24 + x), bar]);
      if (sec.arp) for (let i = 0; i < per; i++){ const seq = [0, 1, 2, 3, 2, 1, 2, 3]; const x = c.t[seq[i % 8]] ; ev.push([t0 + i * step, 'arp', c.r + 36 + x, step * 0.85]); }
      if (L) for (let i = 0; i < per; i++){ const tk = L[j * per + i]; if (!tk || tk === '-' || tk === '.') continue; let len = 1; while (L[j * per + i + len] === '-') len++;
        const m = midi(tk); ev.push([t0 + i * step, 'lead', m, len * step]); lead.push({ t: t0 + i * step, m, len: len * step, sec: si, key }); }
    }
    b += chs.length; si++;
  }
  ev.sort((p, q) => p[0] - q[0]);
  return { ev, lead, kicks, dur: b * bar, step, spb, bar };
}
// 채보: 멜로디 음 높이 → 레인 (높을수록 오른쪽) · 긴 음 = 롱노트 · 어려움은 킥 · 화음 추가
function buildChart(song, M, hard){
  const notes = [], minGap = hard ? 0.1 : song.bpm >= 140 ? 0.27 : 0.2, holdMin = hard ? 0.4 : 0.5, bySec = {};
  for (const n of M.lead) (bySec[n.sec] = bySec[n.sec] || []).push(n);
  // 같은 레인 겹침 · (보통) 롱노트 도중의 다른 노트를 막아요
  const add = (t, l, d) => { for (const n of notes){ if (n.l === l && t > n.t - 0.08 && t < n.t + n.d + 0.08) return false; if (!hard && n.d && t > n.t - 0.05 && t < n.t + n.d + 0.05) return false; if (d && n.l === l && n.t > t && n.t < t + d + 0.08) return false; } notes.push({ t, l, d, j: 0 }); return true; };
  for (const k in bySec){ const g = bySec[k]; let lo = 1e9, hi = -1e9; for (const n of g){ lo = Math.min(lo, n.m); hi = Math.max(hi, n.m); }
    let last = -9, lastL = -1, lastM = 0;
    for (const n of g){ if (n.t - last < minGap) continue;
      let l = clamp(Math.floor((n.m - lo) / (hi - lo + 1) * 4), 0, 3);
      if (l === lastL && n.m !== lastM) l = clamp(l + (n.m > lastM ? 1 : -1), 0, 3);
      if (l === lastL && n.m !== lastM) l = (l + 2) % 4;
      const d = n.len >= holdMin ? n.len - M.step * 0.7 : 0;
      if (add(n.t, l, d)){ last = n.t; lastL = l; lastM = n.m; } } }
  // 전주 (멜로디 없음): 박자 맞추기 연습
  let alt = 1; for (const kk of M.kicks){ if (kk.key !== 'I') continue; const beat = Math.round(kk.t / M.spb * 2) / 2; if (!hard && beat % 1) continue; add(kk.t, alt, 0); alt = alt === 1 ? 2 : 1; }
  if (hard){
    notes.sort((a, b) => a.t - b.t);
    const near = t => notes.some(n => Math.abs(n.t - t) < 0.09);
    for (const kk of M.kicks){ if (kk.key === 'I' || kk.key === 'O' || near(kk.t)) continue; const prev = notes.filter(n => n.t < kk.t).pop(); add(kk.t, prev ? (prev.l + 2) % 4 : 0, 0); }
    // 마디 첫 박 화음 (두 레인 동시)
    for (let t = M.bar * 2; t < M.dur - M.bar; t += M.bar){ const n = notes.find(o => Math.abs(o.t - t) < 0.02 && !o.d); if (n) add(t, (n.l + 2) % 4, 0); }
  }
  notes.sort((a, b) => a.t - b.t || a.l - b.l);
  return notes;
}

// ═════════════════════════ 7. 룬 리듬 ═════════════════════════
const LANEC = ['#7ff3ff', '#ffd36a', '#ff8ad8', '#8aff9a'], LANEK = ['D', 'F', 'J', 'K'];
const JW = [0.045, 0.09, 0.13], JN = ['PERFECT', 'GREAT', 'GOOD', 'MISS'], JC = ['#ffe9a0', '#7ff3ff', '#8aff9a', '#ff6a8a'], JV = [1, 0.7, 0.4, 0];
// 노트 스프라이트 (레인 색 · 룬 문양 · 빛)
const NSPR = LANEC.map((c, i) => { const s = G.cnv(160, 64), x = s.getContext('2d'), w = 160, h = 64;
  x.shadowColor = c; x.shadowBlur = 14; const g = x.createLinearGradient(0, 10, 0, 54); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, c); g.addColorStop(1, 'rgba(10,14,24,1)');
  x.fillStyle = g; x.beginPath(); x.moveTo(14, 32); x.lineTo(34, 12); x.lineTo(126, 12); x.lineTo(146, 32); x.lineTo(126, 52); x.lineTo(34, 52); x.closePath(); x.fill();
  x.shadowBlur = 0; x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 2.5; x.stroke();
  x.strokeStyle = '#10141c'; x.lineWidth = 3.5; x.lineCap = 'round'; G.drawRune(x, i * 4 + 1, 80, 32, 30); return s; });
const RSPR = LANEC.map((c, i) => [0, 1].map(on => { const s = G.cnv(128, 128), x = s.getContext('2d');
  x.shadowColor = c; x.shadowBlur = on ? 26 : 8; x.strokeStyle = on ? '#ffffff' : c; x.lineWidth = on ? 6 : 4; x.globalAlpha = on ? 1 : 0.75; x.beginPath(); x.arc(64, 64, 40, 0, TAU); x.stroke();
  x.fillStyle = on ? c : 'rgba(10,14,24,.6)'; x.globalAlpha = on ? 0.55 : 1; x.beginPath(); x.arc(64, 64, 36, 0, TAU); x.fill(); x.globalAlpha = 1;
  x.strokeStyle = on ? '#fff' : c; x.lineWidth = 3; x.lineCap = 'round'; G.drawRune(x, i * 4 + 1, 64, 64, 30); return s; }));
const STARS = Array.from({ length: 90 }, () => [R(), R() * 0.75, rr(0.4, 1.6), R() * TAU]);
const RHY = {
  aim: false, st: 'menu', song: null, hard: false, M: null, notes: [], t0: 0, p0: 0, pauseAt: 0, first: 0,
  held: [0, 0, 0, 0], flash: [0, 0, 0, 0], fx: [], jd: null, combo: 0, maxC: 0, cnt: [0, 0, 0, 0], sumW: 0, total: 0, pmap: new Map(), lastBeat: -1, pulse: 0,
  playing(){ return this.st === 'play'; },
  open(){ this.st = 'menu'; AU.tt.textContent = 'RUNE RHYTHM'; AU.tb.textContent = '룬 리듬'; AU.help.innerHTML = ''; AU.top.style.display = ''; this.menu(); },
  close(){ musicStop(); this.st = 'menu'; },
  quit(){ if (this.st === 'play'){ musicStop(); this.st = 'menu'; this.menu(); } else arcadeClose(); },
  menu(){
    musicStop(); this.st = 'menu'; AU.sc.textContent = '—'; AU.ss.textContent = ''; AU.pr.style.width = '0%';
    const spd = S.mini.spd || 1.0, off = S.mini.off || 0;
    panel(`<div class="k">RUNE RHYTHM</div><h2>🎵 룬 리듬</h2><p>떨어지는 룬이 선에 닿는 순간 <b>D F J K</b> 를 눌러요 (터치: 레인을 탭). 긴 룬은 끝까지 꾹!<br>점수에 따라 골드 · ${dailyLeft('rhythm') ? '<b>오늘 첫 판 골드 ×2</b>' : '오늘의 보너스는 받았어요'}</p>
      <div class="songs">${SONGS.map(s => { const bn = S.mini.best['rh_' + s.id] || 0, bh = S.mini.best['rh_' + s.id + '_h'] || 0, gn = S.mini.best['rg_' + s.id] || '', gh = S.mini.best['rg_' + s.id + '_h'] || '';
        return `<div class="song" style="--c:${s.col}"><div class="ic">${s.icon}</div><div><div class="n">${s.n}<small>${s.en}</small></div><div class="m">BPM <b>${s.bpm}</b> · ${Math.round(buildSong(s).dur)}초 · 최고 <b>${bn ? fmt(bn) : '—'}</b>${gn ? ` (${gn})` : ''} / 어려움 <b>${bh ? fmt(bh) : '—'}</b>${gh ? ` (${gh})` : ''}</div></div>
          <div class="bs"><button data-d="n" data-s="${s.id}">보통 <em>★${s.lv[0]}</em></button><button class="h" data-d="h" data-s="${s.id}">어려움 <em>★${s.lv[1]}</em></button></div></div>`; }).join('')}</div>
      <div class="opts"><span>노트 속도 <button data-a="s-">−</button><b>${spd.toFixed(1)}×</b><button data-a="s+">+</button></span><span>싱크 <button data-a="o-">−</button><b>${off > 0 ? '+' : ''}${off}ms</b><button data-a="o+">+</button></span></div>
      <button class="btn sub" data-a="back">← 미니 게임 메뉴</button>`);
    AU.card.querySelectorAll('[data-s]').forEach(b => b.onclick = e => { e.stopPropagation(); X.sfx('ui'); this.start(SONGS.find(s => s.id === b.dataset.s), b.dataset.d === 'h'); });
    bindPan({ 's-': () => { S.mini.spd = clamp(Math.round(((S.mini.spd || 1) - 0.1) * 10) / 10, 0.6, 2.5); this.menu(); }, 's+': () => { S.mini.spd = clamp(Math.round(((S.mini.spd || 1) + 0.1) * 10) / 10, 0.6, 2.5); this.menu(); },
      'o-': () => { S.mini.off = clamp((S.mini.off || 0) - 10, -200, 200); this.menu(); }, 'o+': () => { S.mini.off = clamp((S.mini.off || 0) + 10, -200, 200); this.menu(); }, back: () => { arcadeClose(); openMenu(); } });
  },
  start(song, hard){
    this.song = song; this.hard = hard; this.M = buildSong(song); this.notes = buildChart(song, this.M, hard);
    this.combo = this.maxC = 0; this.cnt = [0, 0, 0, 0]; this.sumW = 0; this.total = this.notes.length + this.notes.filter(n => n.d).length; this.fx = []; this.jd = null; this.first = 0; this.held = [0, 0, 0, 0]; this.lastBeat = -1;
    hidePanel(); AU.tt.textContent = song.en + (hard ? ' · HARD' : ''); AU.tb.textContent = song.n; AU.sc.textContent = '0'; AU.ss.textContent = '';
    AU.help.innerHTML = G.IS_TOUCH ? '레인을 탭 · 긴 룬은 누르고 있기' : '<b>D</b><b>F</b><b>J</b><b>K</b> · 긴 룬은 누르고 있기 · <b>Esc</b> 일시정지';
    // 오디오 시계가 돌기 시작하면 출발 (자동 재생 막힘이면 소리 없이 화면 시계로)
    musicStop(); this.st = 'load'; const a = ac(), lead = 2.0, tok = this.tok = (this.tok || 0) + 1;
    const go = () => { if (this.tok !== tok || this.st !== 'load' || !arcOpen) return; this.useAC = !!(a && a.state === 'running');
      if (this.useAC){ musicStart(); MUS.inst = song.inst; MUS.ev = this.M.ev; MUS.i = 0; this.t0 = a.currentTime + lead; MUS.t0 = this.t0; } else this.p0 = performance.now() / 1000 + lead;
      this.st = 'play'; countText('READY', 1.2); setTimeout(() => { if (this.st === 'play' && arcOpen && GM === this) countText('GO!', 0.6); }, 1300); };
    if (a && a.state !== 'running'){ a.resume().then(go, go); setTimeout(go, 700); } else go();
  },
  restart(){ this.start(this.song, this.hard); },
  now(){ const off = (S.mini.off || 0) / 1000; return this.useAC ? AC.currentTime - this.t0 - off : performance.now() / 1000 - this.p0 - off; },
  pause(v){ if (!this.useAC){ if (v) this.pauseAt = performance.now() / 1000; else this.p0 += performance.now() / 1000 - this.pauseAt; } },
  key(code, down){ const l = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 }[code]; if (l === undefined || this.st !== 'play') return; if (down) this.down(l); else this.held[l] = 0; },
  laneAt(x){ const w = this.geo().bw, x0 = CW / 2 - w / 2; if (x < x0 - 40 || x > x0 + w + 40) return clamp(Math.floor(x / CW * 4), 0, 3); return clamp(Math.floor((x - x0) / w * 4), 0, 3); },
  ptr(type, x, y, id){ if (this.st !== 'play') return; if (type === 'down'){ const l = this.laneAt(x); this.pmap.set(id, l); this.down(l); } else if (type === 'up'){ const l = this.pmap.get(id); if (l !== undefined){ this.pmap.delete(id); if (![...this.pmap.values()].includes(l)) this.held[l] = 0; } } },
  down(l){
    this.held[l] = 1; this.flash[l] = 1; const now = this.now(); let best = null, bd = 9;
    for (let i = this.first; i < this.notes.length; i++){ const n = this.notes[i]; if (n.t - now > JW[2]) break; if (n.j || n.l !== l) continue; const d = Math.abs(n.t - now); if (d <= JW[2] && d < bd){ bd = d; best = n; } }
    if (!best){ return; }
    const k = bd <= JW[0] ? 0 : bd <= JW[1] ? 1 : 2; best.j = 1; best.jk = k; this.judge(k, l, now - best.t); if (best.d) best.hold = 1;
  },
  judge(k, l, dt){
    this.cnt[k]++; this.sumW += JV[k];
    if (k < 3){ this.combo++; this.maxC = Math.max(this.maxC, this.combo); this.burst(l, k); } else { if (this.combo >= 10) sfx('bad'); this.combo = 0; }
    this.jd = { k, t: 0, early: dt < -0.02 && k > 0 && k < 3 ? 'FAST' : dt > 0.02 && k > 0 && k < 3 ? 'SLOW' : '' };
    AU.sc.textContent = fmt(this.score()); AU.ss.textContent = `정확도 ${this.acc().toFixed(1)}%`;
  },
  acc(){ const n = this.cnt[0] + this.cnt[1] + this.cnt[2] + this.cnt[3]; return n ? this.sumW / n * 100 : 100; },
  score(){ return Math.round(this.sumW / Math.max(1, this.total) * 950000 + this.maxC / Math.max(1, this.total) * 50000); },
  burst(l, k){ const g = this.geo(), x = CW / 2 + (l - 1.5) * g.bw / 4; for (let i = 0; i < (k === 0 ? 14 : 8); i++){ const a = -Math.PI * rr(0.1, 0.9); this.fx.push({ x, y: g.hy, vx: Math.cos(a) * rr(60, 260), vy: Math.sin(a) * rr(120, 380), t: 0, life: rr(0.3, 0.6), c: LANEC[l], s: rr(2, 4.5) }); } this.fx.push({ ring: 1, x, y: g.hy, t: 0, life: 0.35, c: k === 0 ? '#fff' : LANEC[l] }); },
  geo(){ const bw = Math.min(CW * 0.92, CH * 1.05, 560), hy = CH * (G.IS_TOUCH ? 0.8 : 0.83), top = CH * 0.1; return { bw, tw: bw * 0.26, hy, top, look: 1.55 / (S.mini.spd || 1) * (this.hard ? 0.85 : 1) }; },
  frame(dt){
    if (this.st !== 'play') return;
    const now = this.now(); if (this.useAC) musicTick(AC.currentTime);
    // 지나간 노트 MISS · 롱노트 처리
    for (let i = this.first; i < this.notes.length; i++){ const n = this.notes[i]; if (n.t - now > 0.5) break;
      if (!n.j && now - n.t > JW[2]){ n.j = 1; n.jk = 3; this.judge(3, n.l, 0); if (n.d){ n.hold = 0; n.tail = 1; this.judge(3, n.l, 0); } }
      if (n.hold){ if (now >= n.t + n.d){ n.hold = 0; n.tail = 1; this.judge(0, n.l, 0); } else if (!this.held[n.l] && now < n.t + n.d - 0.12){ n.hold = 0; n.tail = 1; this.judge(3, n.l, 0); } else if (R() < dt * 30) this.burst(n.l, 1); } }
    while (this.first < this.notes.length && this.notes[this.first].j && !this.notes[this.first].hold) this.first++;
    const beat = Math.floor(now / this.M.spb); if (beat !== this.lastBeat && now > 0){ this.lastBeat = beat; this.pulse = 1; }
    this.pulse = Math.max(0, this.pulse - dt * 3.5);
    for (let l = 0; l < 4; l++) this.flash[l] = Math.max(this.held[l] ? 0.6 : 0, this.flash[l] - dt * 5);
    AU.pr.style.width = clamp(now / this.M.dur * 100, 0, 100) + '%';
    if (now > this.M.dur + 1.2 && this.first >= this.notes.length) this.finish();
  },
  finish(){
    this.st = 'result'; musicStop(); const sc = this.score(), acc = this.acc(), s = this.song, hk = s.id + (this.hard ? '_h' : '');
    const gr = sc >= 980000 ? 'SS' : sc >= 940000 ? 'S' : sc >= 880000 ? 'A' : sc >= 780000 ? 'B' : sc >= 650000 ? 'C' : 'D';
    const GR = ['D', 'C', 'B', 'A', 'S', 'SS'], fc = this.cnt[3] === 0, ap = fc && this.cnt[1] === 0 && this.cnt[2] === 0;
    const nb = setBest('rh_' + hk, sc); if (GR.indexOf(gr) > GR.indexOf(S.mini.best['rg_' + hk] || 'D') || !S.mini.best['rg_' + hk]) S.mini.best['rg_' + hk] = gr;
    const mult = { SS: 1.6, S: 1.3, A: 1, B: 0.75, C: 0.5, D: 0.25 }[gr], base = (this.hard ? s.g[1] : s.g[0]) * mult * (fc ? 1.2 : 1);
    const rw = reward('rhythm', sc, base); if (gr === 'S' || gr === 'SS') grant('mg_rhythm');
    sfx(gr === 'SS' || gr === 'S' ? 'catch3' : gr === 'A' || gr === 'B' ? 'catch1' : 'lose');
    panel(`<div class="k">${s.en}${this.hard ? ' · HARD' : ''}</div><h2>${s.n}</h2><div class="grade">${gr}</div>${ap ? '<span class="badge">ALL PERFECT</span>' : fc ? '<span class="badge b">FULL COMBO</span>' : ''}${nb ? '<span class="badge r">NEW BEST</span>' : ''}
      <div class="res"><div>점수<b>${fmt(sc)}</b></div><div>정확도<b>${acc.toFixed(2)}%</b></div><div>최대 콤보<b>${this.maxC}</b></div><div style="color:${JC[0]}">PERFECT<b>${this.cnt[0]}</b></div><div style="color:${JC[1]}">GREAT<b>${this.cnt[1]}</b></div><div style="color:${JC[2]}">GOOD<b>${this.cnt[2]}</b></div><div style="color:${JC[3]}">MISS<b>${this.cnt[3]}</b></div></div>
      <div class="rw">🪙 +${fmt(rw.g)}${rw.first ? '<small>오늘 첫 판 보너스 ×2!</small>' : ''}</div><button class="btn" data-a="re">다시 하기</button><button class="btn sub" data-a="sel">곡 선택</button><button class="btn sub" data-a="q">나가기</button>`);
    bindPan({ re: () => this.restart(), sel: () => this.menu(), q: () => arcadeClose() });
  },
  draw(x, dt){
    const g = this.geo(), now = this.st === 'play' ? this.now() : 0, cx0 = CW / 2, pu = this.pulse, col = this.song ? this.song.col : '#7ff3ff';
    // 배경: 밤하늘 · 오로라 · 별 (박자에 맞춰 숨 쉬어요)
    const bg = x.createLinearGradient(0, 0, 0, CH); bg.addColorStop(0, '#060a18'); bg.addColorStop(0.6, '#0c1430'); bg.addColorStop(1, '#140a24'); x.fillStyle = bg; x.fillRect(0, 0, CW, CH);
    const T = G.time; x.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++){ x.beginPath(); const yb = CH * (0.18 + k * 0.08); x.moveTo(0, yb); for (let i = 0; i <= 24; i++){ const px = i / 24 * CW; x.lineTo(px, yb + Math.sin(i * 0.6 + T * (0.5 + k * 0.2) + k) * CH * 0.04); } x.lineTo(CW, 0); x.lineTo(0, 0); x.closePath();
      x.fillStyle = `rgba(${k === 1 ? '255,120,220' : '90,240,220'},${0.035 + pu * 0.03})`; x.fill(); }
    for (const s of STARS){ x.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.sin(T * s[2] + s[3]) + pu * 0.2})`; x.fillRect(s[0] * CW, s[1] * CH, s[2] * 1.2, s[2] * 1.2); }
    x.globalCompositeOperation = 'source-over';
    // 길 (원근)
    const P = u => { const s = 1 / (1 + 3 * u), k = (s - 0.25) / 0.75; return [g.top + (g.hy - g.top) * k, g.tw + (g.bw - g.tw) * k, k]; };
    const [ty, tw] = P(1), hw = g.bw;
    x.beginPath(); x.moveTo(cx0 - tw / 2, ty); x.lineTo(cx0 + tw / 2, ty); x.lineTo(cx0 + hw / 2 * 1.08, CH); x.lineTo(cx0 - hw / 2 * 1.08, CH); x.closePath();
    const hg = x.createLinearGradient(0, ty, 0, CH); hg.addColorStop(0, 'rgba(20,30,60,.1)'); hg.addColorStop(0.7, 'rgba(14,20,40,.82)'); hg.addColorStop(1, 'rgba(8,10,20,.95)'); x.fillStyle = hg; x.fill();
    x.strokeStyle = `rgba(233,200,126,${0.45 + pu * 0.4})`; x.lineWidth = 2; x.stroke();
    for (let l = 1; l < 4; l++){ x.beginPath(); x.moveTo(cx0 + (l / 4 - 0.5) * tw, ty); x.lineTo(cx0 + (l / 4 - 0.5) * hw * 1.08, CH); x.strokeStyle = 'rgba(255,255,255,.1)'; x.lineWidth = 1; x.stroke(); }
    for (let l = 0; l < 4; l++) if (this.flash[l] > 0){ const a = this.flash[l] * 0.6; x.beginPath(); x.moveTo(cx0 + (l / 4 - 0.5) * tw, ty); x.lineTo(cx0 + ((l + 1) / 4 - 0.5) * tw, ty); x.lineTo(cx0 + ((l + 1) / 4 - 0.5) * hw, g.hy); x.lineTo(cx0 + (l / 4 - 0.5) * hw, g.hy); x.closePath();
      const lg = x.createLinearGradient(0, ty, 0, g.hy); lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, LANEC[l] + Math.round(a * 90).toString(16).padStart(2, '0')); x.fillStyle = lg; x.fill(); }
    // 박자 선
    if (this.M && this.st === 'play'){ const b0 = Math.ceil(now / this.M.spb); for (let b = b0; b < b0 + 8; b++){ const u = (b * this.M.spb - now) / g.look; if (u > 1) break; if (u < 0) continue; const [yy, ww] = P(u); x.strokeStyle = b % 4 ? 'rgba(255,255,255,.07)' : 'rgba(233,200,126,.22)'; x.lineWidth = b % 4 ? 1 : 2; x.beginPath(); x.moveTo(cx0 - ww / 2, yy); x.lineTo(cx0 + ww / 2, yy); x.stroke(); } }
    // 판정선 · 수신 룬
    x.strokeStyle = `rgba(255,243,214,${0.6 + pu * 0.4})`; x.lineWidth = 3; x.shadowColor = col; x.shadowBlur = 12 + pu * 16; x.beginPath(); x.moveTo(cx0 - hw / 2, g.hy); x.lineTo(cx0 + hw / 2, g.hy); x.stroke(); x.shadowBlur = 0;
    const rs = Math.min(hw / 4 * 0.9, 96);
    for (let l = 0; l < 4; l++){ const lx = cx0 + (l - 1.5) * hw / 4; x.drawImage(RSPR[l][this.flash[l] > 0.3 ? 1 : 0], lx - rs / 2, g.hy - rs / 2, rs, rs);
      if (!G.IS_TOUCH){ x.font = "900 13px 'Cinzel'"; x.fillStyle = 'rgba(255,243,214,.7)'; x.textAlign = 'center'; x.fillText(LANEK[l], lx, g.hy + rs / 2 + 16); } }
    // 노트
    if (this.st === 'play'){
      for (let i = this.first; i < this.notes.length; i++){ const n = this.notes[i], u = (n.t - now) / g.look; if (u > 1.02) break;
        if (n.j && !n.hold && !n.d) continue; if (n.tail) continue;
        const lc = (n.l - 1.5) / 4;
        if (n.d){ const u1 = Math.min(1.02, (n.t + n.d - now) / g.look); if (u1 < -0.05) continue; const ua = Math.max(n.hold ? 0 : -0.08, u), [ya, wa] = P(Math.max(0, ua)), [yb, wb] = P(Math.max(0, u1));
          const yA = ua < 0 ? g.hy - ua * g.look * 260 : ya;
          x.beginPath(); x.moveTo(cx0 + lc * wa - wa / 4 * 0.28, yA); x.lineTo(cx0 + lc * wa + wa / 4 * 0.28, yA); x.lineTo(cx0 + lc * wb + wb / 4 * 0.28, yb); x.lineTo(cx0 + lc * wb - wb / 4 * 0.28, yb); x.closePath();
          x.fillStyle = LANEC[n.l] + (n.hold ? 'cc' : n.j ? '33' : '77'); x.fill(); if (n.hold){ x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.stroke(); }
          x.drawImage(NSPR[n.l], cx0 + lc * wb - wb / 4 * 0.35, yb - wb / 4 * 0.11, wb / 4 * 0.7, wb / 4 * 0.24); }
        if (n.j) continue;
        const uu = Math.max(-0.12, u), [yy, ww] = uu >= 0 ? P(uu) : [g.hy - uu * g.look * 260, g.bw], nw = ww / 4 * 0.86, nh = nw * 0.4;
        x.globalAlpha = uu < 0 ? Math.max(0, 1 + uu * 8) : Math.min(1, (1.02 - u) * 6); x.drawImage(NSPR[n.l], cx0 + lc * ww - nw / 2, yy - nh / 2, nw, nh); x.globalAlpha = 1; }
    }
    // 이펙트
    for (let i = this.fx.length - 1; i >= 0; i--){ const f = this.fx[i]; f.t += dt; if (f.t >= f.life){ this.fx.splice(i, 1); continue; } const k = f.t / f.life;
      if (f.ring){ x.strokeStyle = f.c; x.globalAlpha = 1 - k; x.lineWidth = 4 * (1 - k) + 1; x.beginPath(); x.arc(f.x, f.y, rs * 0.4 + k * rs * 0.7, 0, TAU); x.stroke(); x.globalAlpha = 1; continue; }
      f.vy += 900 * dt; f.x += f.vx * dt; f.y += f.vy * dt; x.fillStyle = f.c; x.globalAlpha = 1 - k; x.fillRect(f.x - f.s / 2, f.y - f.s / 2, f.s, f.s); x.globalAlpha = 1; }
    // 판정 · 콤보
    if (this.jd && this.st === 'play'){ const j = this.jd; j.t += dt; if (j.t < 0.6){ const sc = j.t < 0.08 ? 1.3 - j.t * 3 : 1; x.save(); x.translate(cx0, g.hy - CH * 0.16); x.scale(sc, sc); x.globalAlpha = Math.min(1, (0.6 - j.t) * 4);
      x.font = "900 30px 'Cinzel'"; x.textAlign = 'center'; x.fillStyle = JC[j.k]; x.shadowColor = JC[j.k]; x.shadowBlur = 18; x.fillText(JN[j.k], 0, 0); x.shadowBlur = 0;
      if (j.early){ x.font = "700 11px 'Cinzel'"; x.fillStyle = j.early === 'FAST' ? '#7ab8ff' : '#ff9a7a'; x.fillText(j.early, 0, 18); } x.restore(); } }
    if (this.combo >= 3 && this.st === 'play'){ x.textAlign = 'center'; x.font = `900 ${Math.round(Math.min(72, CH * 0.11) * (1 + pu * 0.06))}px 'Cinzel'`; x.fillStyle = 'rgba(255,248,230,.92)'; x.shadowColor = col; x.shadowBlur = 20; x.fillText(this.combo, cx0, CH * 0.4); x.shadowBlur = 0;
      x.font = "700 12px 'Cinzel'"; x.fillStyle = col; x.fillText('C O M B O', cx0, CH * 0.4 + 20); }
  },
};

// ═════════════════════════ 8. 과녁 맞히기 ═════════════════════════
const ARC_T = 45;
const ARCH = {
  aim: true, st: 'menu', t: 0, score: 0, combo: 0, maxC: 0, shots: 0, hits: 0, tg: [], fx: [], bolts: [], spawnT: 0, ax: 0, ay: 0, cd: 0, layers: null, warm: 0,
  playing(){ return this.st === 'play'; },
  open(){ AU.tt.textContent = 'RUNE ARCHERY'; AU.tb.textContent = '과녁 맞히기'; AU.top.style.display = ''; this.ax = CW / 2; this.ay = CH / 2; this.resize(); this.menu(); },
  close(){ this.st = 'menu'; },
  quit(){ if (this.st === 'play'){ this.st = 'menu'; this.menu(); } else arcadeClose(); },
  menu(){ this.st = 'menu'; this.tg = []; this.fx = []; AU.sc.textContent = fmt(S.mini.best.archery || 0); AU.ss.textContent = '최고 점수'; AU.pr.style.width = '100%'; AU.help.innerHTML = '';
    panel(`<div class="k">RUNE ARCHERY</div><h2>🎯 과녁 맞히기</h2><p>${ARC_T}초 동안 룬 화살로 과녁을 맞혀요! <b>클릭 / 탭</b>으로 발사.<br>🟢 슬라임 100 · 🎯 과녁 (가운데일수록 높게) · 🐦 황금 새 500 + 3초 · ⏳ 모래시계 +5초<br>👻 <b>하얀 정령은 쏘면 안 돼요!</b> · 연속으로 맞히면 배율 ×2 ×3 ×4<br>${dailyLeft('archery') ? '<b>오늘 첫 판 골드 ×2</b>' : ''}</p>
      <div class="res"><div>최고 점수<b>${fmt(S.mini.best.archery || 0)}</b></div><div>플레이<b>${S.mini.plays.archery || 0}</b></div></div><button class="btn" data-a="go">시작!</button><button class="btn sub" data-a="back">← 메뉴</button>`);
    bindPan({ go: () => this.start(), back: () => { arcadeClose(); openMenu(); } }); },
  start(){ Object.assign(this, { st: 'play', t: ARC_T, score: 0, combo: 0, maxC: 0, shots: 0, hits: 0, tg: [], fx: [], bolts: [], spawnT: 1.2, cd: 0, warm: 1.0, bonusT: 0 }); hidePanel(); countText('START!', 0.8); sfx('chest');
    AU.help.innerHTML = G.IS_TOUCH ? '탭해서 발사 · 하얀 정령은 피하기' : '<b>클릭</b> 발사 · 하얀 정령은 쏘지 마세요 · <b>Esc</b> 일시정지'; },
  restart(){ this.start(); },
  resize(){
    // 정적인 배경 층을 미리 그려요 (먼 산 · 언덕과 나무 · 울타리)
    const mk = (h, fn) => { const c = G.cnv(Math.max(2, Math.round(CW * 1.2)), Math.max(2, Math.round(h))); fn(c.getContext('2d'), c.width, c.height); return c; };
    const W2 = CW * 1.2;
    this.layers = {
      far: mk(CH * 0.42, (x, w, h) => { x.fillStyle = '#5a6a9a'; x.beginPath(); x.moveTo(0, h); for (let i = 0; i <= 12; i++) x.lineTo(i / 12 * w, h * (0.35 + 0.3 * Math.abs(Math.sin(i * 1.7)) + (i % 3 === 0 ? -0.2 : 0))); x.lineTo(w, h); x.fill();
        x.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i <= 12; i += 3){ const px = i / 12 * w, py = h * (0.35 + 0.3 * Math.abs(Math.sin(i * 1.7)) - 0.2); x.beginPath(); x.moveTo(px, py); x.lineTo(px - w * 0.03, py + h * 0.1); x.lineTo(px + w * 0.03, py + h * 0.1); x.fill(); } }),
      mid: mk(CH * 0.4, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#4a8a4a'); g.addColorStop(1, '#2a5a32'); x.fillStyle = g; x.beginPath(); x.moveTo(0, h); for (let i = 0; i <= 40; i++) x.lineTo(i / 40 * w, h * (0.35 + 0.12 * Math.sin(i * 0.5) + 0.05 * Math.sin(i * 1.7))); x.lineTo(w, h); x.fill();
        for (let i = 0; i < 26; i++){ const px = (i + 0.5) / 26 * w + Math.sin(i * 7) * 14, py = h * (0.35 + 0.12 * Math.sin(px / w * 40 * 0.5)) + 6, s = 18 + (i * 37 % 11) * 2.4; x.fillStyle = '#3a2a1a'; x.fillRect(px - 2, py - s * 0.5, 4, s * 0.6); x.fillStyle = i % 3 ? '#2f6a3a' : '#3a7a40'; x.beginPath(); x.moveTo(px, py - s * 1.7); x.lineTo(px - s * 0.45, py - s * 0.35); x.lineTo(px + s * 0.45, py - s * 0.35); x.fill(); } }),
      awn: mk(Math.max(40, CH * 0.11), (x, w, h) => { const n = Math.ceil(w / 54); for (let i = 0; i < n; i++){ x.fillStyle = i % 2 ? '#f4ead0' : '#c8382a'; x.fillRect(i * 54, 0, 54, h * 0.62); x.beginPath(); x.arc(i * 54 + 27, h * 0.62, 27, 0, Math.PI); x.fill(); }
        x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, h * 0.5, w, h * 0.12); x.fillStyle = '#e9c87e'; x.fillRect(0, 0, w, 5); x.fillStyle = '#5a3a1e'; x.fillRect(0, 0, w, 3); }),
      near: mk(CH * 0.3, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6aa04a'); g.addColorStop(1, '#3a6a2a'); x.fillStyle = g; x.fillRect(0, h * 0.45, w, h); x.fillStyle = '#7ab85a'; for (let i = 0; i < 160; i++){ const px = R() * w, py = h * 0.45 + R() * 6; x.fillRect(px, py - 6, 2, 8); }
        x.fillStyle = '#7a5530'; x.strokeStyle = '#4a3018'; x.lineWidth = 2; for (let px = 10; px < w; px += 46){ x.fillRect(px, h * 0.1, 10, h * 0.5); x.strokeRect(px, h * 0.1, 10, h * 0.5); } x.fillRect(0, h * 0.18, w, 9); x.fillRect(0, h * 0.36, w, 9);
        x.fillStyle = '#8a6438'; x.fillRect(0, h * 0.62, w, h * 0.38); x.fillStyle = '#6a4a28'; for (let px = 0; px < w; px += 60) x.fillRect(px, h * 0.62, 3, h * 0.38); x.fillStyle = 'rgba(255,220,150,.25)'; x.fillRect(0, h * 0.62, w, 4); }),
    };
  },
  spawn(){
    const d = 1 - this.t / ARC_T, r = R(), sp = 1 + d * 0.9, hz = CH * 0.6;
    let o;
    if (r < 0.34) o = { k: 'slime', x: rr(CW * 0.12, CW * 0.88), y: hz, by: hz, r: rr(24, 32) * (CH / 600 + 0.4), life: rr(1.6, 2.4) / sp, c: pick(['#72d86a', '#6ac8ff', '#ff8ac8', '#ffd36a']), pts: 100 };
    else if (r < 0.62){ const dir = R() < 0.5 ? 1 : -1; o = { k: 'rune', x: dir > 0 ? -40 : CW + 40, y: rr(CH * 0.32, CH * 0.52), vx: dir * rr(110, 180) * sp * (CW / 900 + 0.3), r: rr(30, 40) * (CH / 600 + 0.4), life: 99, pts: 250 }; }
    else if (r < 0.7){ const dir = R() < 0.5 ? 1 : -1; o = { k: 'bird', x: dir > 0 ? -30 : CW + 30, y: rr(CH * 0.14, CH * 0.28), vx: dir * rr(260, 360) * sp * (CW / 900 + 0.3), r: 20 * (CH / 600 + 0.4), life: 99, pts: 500, ph: R() * 6 }; }
    else if (r < 0.86) o = { k: 'spirit', x: rr(CW * 0.15, CW * 0.85), y: rr(CH * 0.3, CH * 0.5), r: 26 * (CH / 600 + 0.4), life: rr(2.2, 3.2), pts: -300, ph: R() * 6, vx: rr(-40, 40) };
    else if (r < 0.9 && this.t < ARC_T - 8) o = { k: 'glass', x: rr(CW * 0.2, CW * 0.8), y: rr(CH * 0.25, CH * 0.45), r: 20 * (CH / 600 + 0.4), life: 2.2, pts: 50, ph: R() * 6 };
    else o = { k: 'slime', x: rr(CW * 0.12, CW * 0.88), y: hz, by: hz, r: rr(24, 32) * (CH / 600 + 0.4), life: rr(1.4, 2) / sp, c: '#72d86a', pts: 100 };
    o.t = 0; o.dead = 0; this.tg.push(o);
  },
  mult(){ return this.combo >= 20 ? 4 : this.combo >= 10 ? 3 : this.combo >= 5 ? 2 : 1; },
  ptr(type, x, y){ this.ax = x; this.ay = y; if (type === 'down' && this.st === 'play') this.shoot(x, y); },
  key(code, down){ if (down && code === 'Space' && this.st === 'play') this.shoot(this.ax, this.ay); },
  shoot(x, y){
    if (this.cd > 0 || this.warm > 0) return; this.cd = 0.12; this.shots++; sfx('whoosh');
    const sx = CW / 2, sy = CH + 10; this.bolts.push({ x0: sx, y0: sy, x1: x, y1: y, t: 0 });
    let hit = null; for (let i = this.tg.length - 1; i >= 0; i--){ const o = this.tg[i]; if (o.dead) continue; const d = Math.hypot(x - o.x, y - o.y); if (d <= o.r * 1.08){ hit = o; o.hd = d / o.r; break; } }
    setTimeout(() => this.impact(hit, x, y), 70);
  },
  impact(o, x, y){
    if (this.st !== 'play') return;
    if (!o || o.dead){ this.combo = 0; this.fx.push({ k: 'puff', x, y, t: 0, life: 0.4 }); this.pop(x, y, 'MISS', '#9fb6c0', 14); return; }
    o.dead = 1; o.dt = 0;
    if (o.k === 'spirit'){ this.combo = 0; this.score = Math.max(0, this.score + o.pts); sfx('bad'); this.pop(o.x, o.y, '-300 정령이 울어요!', '#ff8a9a', 16); this.shake = 0.4; AU.sc.textContent = fmt(this.score); return; }
    this.hits++; this.combo++; this.maxC = Math.max(this.maxC, this.combo); const m = this.mult(); let p = o.pts, lab = '';
    if (o.k === 'rune'){ p = o.hd < 0.3 ? 250 : o.hd < 0.62 ? 150 : 80; if (o.hd < 0.3){ lab = 'BULLSEYE! '; sfx('chest'); } }
    if (o.k === 'bird'){ this.t += 3; lab = '+3초 '; sfx('catch2'); }
    if (o.k === 'glass'){ this.t += 5; lab = '+5초 '; sfx('chest'); }
    if (o.k === 'slime') sfx('good'); else if (o.k === 'rune' && o.hd >= 0.3) sfx('good');
    this.score += p * m; AU.sc.textContent = fmt(this.score);
    this.pop(o.x, o.y - o.r, `${lab}+${p * m}${m > 1 ? ` ×${m}` : ''}`, o.k === 'bird' ? '#ffd36a' : m > 1 ? '#ffe9a0' : '#fff', o.k === 'rune' && o.hd < 0.3 ? 22 : 17);
    const c = o.k === 'slime' ? o.c : o.k === 'bird' ? '#ffd36a' : o.k === 'glass' ? '#9ffcff' : '#ff8a5a'; for (let i = 0; i < 18; i++){ const a = R() * TAU, v = rr(80, 320); this.fx.push({ k: 'p', x: o.x, y: o.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, t: 0, life: rr(0.4, 0.8), c, s: rr(3, 6) }); }
    this.fx.push({ k: 'ring', x: o.x, y: o.y, t: 0, life: 0.35, c: '#fff', r: o.r });
    if (this.combo === 5 || this.combo === 10 || this.combo === 20) { countText(`×${this.mult()}`, 0.6); sfx('catch1'); }
  },
  pop(x, y, txt, c, s){ this.fx.push({ k: 'txt', x, y, t: 0, life: 0.9, txt, c, s }); },
  frame(dt){
    if (this.st !== 'play') return;
    if (this.warm > 0){ this.warm -= dt; return; }
    this.t -= dt; this.cd -= dt; if (this.shake) this.shake = Math.max(0, this.shake - dt);
    if ((this.spawnT -= dt) <= 0){ const d = 1 - this.t / ARC_T; this.spawnT = lerp(0.95, 0.42, clamp(d, 0, 1)) * rr(0.7, 1.2); if (this.tg.filter(o => !o.dead).length < 8) this.spawn(); }
    for (let i = this.tg.length - 1; i >= 0; i--){ const o = this.tg[i]; o.t += dt;
      if (o.dead){ o.dt += dt; if (o.dt > 0.25) this.tg.splice(i, 1); continue; }
      if (o.k === 'slime'){ const k = o.t / o.life, up = k < 0.2 ? X.ease(k / 0.2) : k > 0.8 ? 1 - X.ease((k - 0.8) / 0.2) : 1; o.y = o.by - up * CH * 0.17 - Math.abs(Math.sin(o.t * 6)) * 8 * up; }
      else if (o.k === 'rune' || o.k === 'bird'){ o.x += o.vx * dt; if (o.k === 'bird') o.y += Math.sin(o.t * 5 + o.ph) * 60 * dt; if (o.x < -80 || o.x > CW + 80) o.life = 0; }
      else if (o.k === 'spirit'){ o.x += Math.sin(o.t * 1.3 + o.ph) * 30 * dt + o.vx * dt; o.y += Math.sin(o.t * 2.4 + o.ph) * 14 * dt; }
      if (o.t >= o.life){ this.tg.splice(i, 1); } }
    AU.pr.style.width = clamp(this.t / ARC_T * 100, 0, 100) + '%'; AU.ss.textContent = `⏱ ${Math.max(0, this.t).toFixed(1)}초 · ${this.combo > 0 ? `콤보 ${this.combo} · ×${this.mult()}` : '배율 ×1'}`;
    if (this.t <= 5 && Math.floor(this.t * 2) !== this.tk5){ this.tk5 = Math.floor(this.t * 2); if (this.t > 0) sfx('tick'); }
    if (this.t <= 0) this.finish();
  },
  finish(){
    this.st = 'result'; countText('TIME UP!', 1); sfx('catch1');
    const sc = this.score, acc = this.shots ? this.hits / this.shots * 100 : 0, nb = setBest('archery', sc), rw = reward('archery', sc, Math.min(600, sc / 10));
    if (sc >= 4000) grant('mg_archer');
    setTimeout(() => { if (!arcOpen || GM !== this) return; panel(`<div class="k">RUNE ARCHERY</div><h2>🎯 결과</h2><div class="grade" style="font-size:64px">${fmt(sc)}</div>${nb ? '<span class="badge r">NEW BEST</span>' : ''}${sc >= 4000 ? '<span class="badge">백발백중</span>' : ''}
      <div class="res"><div>명중<b>${this.hits} / ${this.shots}</b></div><div>정확도<b>${acc.toFixed(0)}%</b></div><div>최대 콤보<b>${this.maxC}</b></div><div>최고 점수<b>${fmt(S.mini.best.archery || 0)}</b></div></div>
      <div class="rw">🪙 +${fmt(rw.g)}${rw.first ? '<small>오늘 첫 판 보너스 ×2!</small>' : ''}</div><button class="btn" data-a="re">다시 하기</button><button class="btn sub" data-a="q">나가기</button>`); bindPan({ re: () => this.start(), q: () => arcadeClose() }); }, 1100);
  },
  draw(x, dt){
    const T = G.time, px = (this.ax / Math.max(1, CW) - 0.5), py = (this.ay / Math.max(1, CH) - 0.5), L = this.layers, sh = this.shake ? (R() - 0.5) * this.shake * 20 : 0;
    x.save(); x.translate(sh, sh * 0.5);
    const sky = x.createLinearGradient(0, 0, 0, CH * 0.7); sky.addColorStop(0, '#3a5aa8'); sky.addColorStop(0.55, '#e8a070'); sky.addColorStop(1, '#ffd8a0'); x.fillStyle = sky; x.fillRect(-20, -20, CW + 40, CH + 40);
    const sg = x.createRadialGradient(CW * 0.72 - px * 10, CH * 0.36, 4, CW * 0.72 - px * 10, CH * 0.36, CH * 0.3); sg.addColorStop(0, 'rgba(255,250,220,1)'); sg.addColorStop(0.12, 'rgba(255,230,160,.8)'); sg.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = sg; x.fillRect(0, 0, CW, CH);
    x.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 5; i++){ const cxx = ((i * 0.27 + T * 0.012 * (1 + i % 2)) % 1.3 - 0.15) * CW - px * 8, cyy = CH * (0.08 + i * 0.045); x.beginPath(); x.ellipse(cxx, cyy, 60 + i * 10, 12, 0, 0, TAU); x.ellipse(cxx + 30, cyy - 8, 36, 12, 0, 0, TAU); x.fill(); }
    if (L){ x.drawImage(L.far, -CW * 0.1 - px * 14, CH * 0.3 - py * 6, L.far.width, L.far.height); x.drawImage(L.mid, -CW * 0.1 - px * 30, CH * 0.42 - py * 10, L.mid.width, L.mid.height); }
    // 과녁들 (중간 층과 앞 층 사이)
    for (const o of this.tg){ const a = o.dead ? Math.max(0, 1 - o.dt / 0.25) : 1, s = o.dead ? 1 + o.dt * 2 : 1; x.save(); x.globalAlpha = a; x.translate(o.x, o.y); x.scale(s, s); this.drawT(x, o, T); x.restore(); }
    if (L) x.drawImage(L.near, -CW * 0.1 - px * 50, CH * 0.7 - py * 14, L.near.width, L.near.height);
    // 화살
    for (let i = this.bolts.length - 1; i >= 0; i--){ const b = this.bolts[i]; b.t += dt; const k = Math.min(1, b.t / 0.07); if (b.t > 0.2){ this.bolts.splice(i, 1); continue; }
      const hx = lerp(b.x0, b.x1, k), hy = lerp(b.y0, b.y1, k), tx = lerp(b.x0, b.x1, Math.max(0, k - 0.35)), ty2 = lerp(b.y0, b.y1, Math.max(0, k - 0.35));
      x.globalAlpha = b.t > 0.07 ? 1 - (b.t - 0.07) / 0.13 : 1; x.strokeStyle = '#9ffcff'; x.shadowColor = '#7ff3ff'; x.shadowBlur = 14; x.lineWidth = 4; x.beginPath(); x.moveTo(tx, ty2); x.lineTo(hx, hy); x.stroke(); x.strokeStyle = '#fff'; x.lineWidth = 1.6; x.stroke(); x.shadowBlur = 0; x.globalAlpha = 1; }
    // 이펙트
    for (let i = this.fx.length - 1; i >= 0; i--){ const f = this.fx[i]; f.t += dt; if (f.t >= f.life){ this.fx.splice(i, 1); continue; } const k = f.t / f.life; x.globalAlpha = 1 - k;
      if (f.k === 'p'){ f.vy += 700 * dt; f.x += f.vx * dt; f.y += f.vy * dt; x.fillStyle = f.c; x.fillRect(f.x - f.s / 2, f.y - f.s / 2, f.s, f.s); }
      else if (f.k === 'ring'){ x.strokeStyle = f.c; x.lineWidth = 3; x.beginPath(); x.arc(f.x, f.y, f.r * (1 + k * 1.2), 0, TAU); x.stroke(); }
      else if (f.k === 'puff'){ x.fillStyle = 'rgba(220,220,220,.6)'; for (let j = 0; j < 5; j++){ x.beginPath(); x.arc(f.x + Math.cos(j * 1.3) * k * 18, f.y + Math.sin(j * 1.3) * k * 18, 6 * (1 - k) + 2, 0, TAU); x.fill(); } }
      else if (f.k === 'txt'){ x.font = `900 ${f.s}px 'Noto Sans KR'`; x.textAlign = 'center'; x.fillStyle = f.c; x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = 4; const yy = f.y - k * 40; x.strokeText(f.txt, f.x, yy); x.fillText(f.txt, f.x, yy); }
      x.globalAlpha = 1; }
    // 룬 석궁 (화면 아래 가운데에서 조준점을 봐요)
    const bx = CW / 2, by = CH + 6, ang = Math.atan2(this.ay - by, this.ax - bx) + Math.PI / 2;
    x.save(); x.translate(bx, by); x.rotate(clamp(ang, -1.2, 1.2)); const s0 = Math.min(1.2, CH / 600 + 0.3);
    x.fillStyle = '#4a3020'; x.fillRect(-9 * s0, -120 * s0, 18 * s0, 120 * s0); x.strokeStyle = '#c8a050'; x.lineWidth = 7 * s0; x.beginPath(); x.arc(0, -96 * s0, 62 * s0, Math.PI * 1.15, Math.PI * 1.85); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(Math.cos(Math.PI * 1.15) * 62 * s0, -96 * s0 + Math.sin(Math.PI * 1.15) * 62 * s0); x.lineTo(0, -80 * s0 + (this.cd > 0 ? 0 : 14 * s0)); x.lineTo(Math.cos(Math.PI * 1.85) * 62 * s0, -96 * s0 + Math.sin(Math.PI * 1.85) * 62 * s0); x.stroke();
    x.fillStyle = '#7ff3ff'; x.shadowColor = '#7ff3ff'; x.shadowBlur = 18; x.beginPath(); x.arc(0, -126 * s0, 7 * s0, 0, TAU); x.fill(); x.shadowBlur = 0; x.restore();
    // 조준점
    if (!G.IS_TOUCH && this.st === 'play'){ const m = this.mult(), c = m >= 4 ? '#ff8ad8' : m >= 3 ? '#ffd36a' : m >= 2 ? '#8aff9a' : '#ffffff'; x.strokeStyle = c; x.lineWidth = 2; x.shadowColor = c; x.shadowBlur = 8; x.beginPath(); x.arc(this.ax, this.ay, 14, 0, TAU);
      for (let i = 0; i < 4; i++){ const a = i * Math.PI / 2 + T * 1.5; x.moveTo(this.ax + Math.cos(a) * 9, this.ay + Math.sin(a) * 9); x.lineTo(this.ax + Math.cos(a) * 20, this.ay + Math.sin(a) * 20); } x.stroke(); x.shadowBlur = 0; x.fillStyle = c; x.fillRect(this.ax - 1.5, this.ay - 1.5, 3, 3); }
    if (L){ x.drawImage(L.awn, -CW * 0.1 - px * 60, -6, L.awn.width, L.awn.height); x.fillStyle = '#6a4422'; x.fillRect(-4, 0, 14, CH); x.fillRect(CW - 10, 0, 14, CH); }
    // 남은 시간 경고
    if (this.st === 'play' && this.t < 5){ x.fillStyle = `rgba(255,60,80,${0.12 + 0.1 * Math.sin(T * 10)})`; x.fillRect(0, 0, CW, CH); }
    x.restore();
  },
  drawT(x, o, T){
    const r = o.r;
    if (o.k === 'slime'){ const sq = 1 + Math.sin(o.t * 12) * 0.06; x.scale(1 / sq, sq); const g = x.createRadialGradient(-r * 0.3, -r * 0.4, 2, 0, 0, r * 1.1); g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, o.c); g.addColorStop(1, 'rgba(0,0,0,.35)');
      x.fillStyle = g; x.beginPath(); x.moveTo(-r, r * 0.6); x.bezierCurveTo(-r * 1.1, -r * 0.6, -r * 0.4, -r * 1.1, 0, -r * 1.05); x.bezierCurveTo(r * 0.4, -r * 1.1, r * 1.1, -r * 0.6, r, r * 0.6); x.closePath(); x.fill();
      x.fillStyle = '#111'; x.beginPath(); x.ellipse(-r * 0.32, -r * 0.2, r * 0.11, r * 0.16, 0, 0, TAU); x.ellipse(r * 0.32, -r * 0.2, r * 0.11, r * 0.16, 0, 0, TAU); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(-r * 0.28, -r * 0.27, r * 0.04, 0, TAU); x.arc(r * 0.36, -r * 0.27, r * 0.04, 0, TAU); x.fill();
      x.strokeStyle = '#111'; x.lineWidth = 2; x.beginPath(); x.arc(0, r * 0.05, r * 0.14, 0.2, Math.PI - 0.2); x.stroke(); }
    else if (o.k === 'rune'){ x.fillStyle = '#5a3a1e'; x.fillRect(-4, r * 0.8, 8, r * 1.4); x.rotate(Math.sin(o.t * 3) * 0.05);
      [['#f4ead0', 1], ['#c8382a', 0.8], ['#f4ead0', 0.62], ['#c8382a', 0.45], ['#ffd36a', 0.3]].forEach(([c, k]) => { x.fillStyle = c; x.beginPath(); x.arc(0, 0, r * k, 0, TAU); x.fill(); });
      x.strokeStyle = '#4a2a10'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, r, 0, TAU); x.stroke(); x.strokeStyle = '#7a3a00'; x.lineWidth = 2; x.lineCap = 'round'; G.drawRune(x, 3, 0, 0, r * 0.32); }
    else if (o.k === 'bird'){ const dir = Math.sign(o.vx) || 1, f = Math.sin(o.t * 18); x.scale(dir, 1); x.shadowColor = '#ffd36a'; x.shadowBlur = 16;
      x.fillStyle = '#ffd040'; x.beginPath(); x.ellipse(0, 0, r, r * 0.6, 0, 0, TAU); x.fill(); x.shadowBlur = 0;
      x.fillStyle = '#ffe890'; x.beginPath(); x.moveTo(-r * 0.2, -r * 0.1); x.lineTo(-r * 0.9, -r * 0.2 - f * r * 1.1); x.lineTo(r * 0.3, -r * 0.2); x.fill();
      x.fillStyle = '#ff8a2a'; x.beginPath(); x.moveTo(r * 0.9, -r * 0.05); x.lineTo(r * 1.35, r * 0.05); x.lineTo(r * 0.9, r * 0.15); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(r * 0.55, -r * 0.15, r * 0.09, 0, TAU); x.fill();
      x.fillStyle = '#ffb030'; x.beginPath(); x.moveTo(-r * 0.9, 0); x.lineTo(-r * 1.5, -r * 0.3); x.lineTo(-r * 1.4, r * 0.3); x.fill(); }
    else if (o.k === 'spirit'){ x.translate(0, Math.sin(o.t * 3) * 4); x.shadowColor = '#bfffff'; x.shadowBlur = 20; x.fillStyle = 'rgba(245,255,255,.95)';
      x.beginPath(); x.arc(0, -r * 0.2, r * 0.8, Math.PI, 0); for (let i = 0; i <= 4; i++) x.lineTo(r * 0.8 - i * r * 0.4, r * 0.7 + (i % 2 ? -r * 0.18 : 0)); x.closePath(); x.fill(); x.shadowBlur = 0;
      x.fillStyle = '#2a3a4a'; x.beginPath(); x.ellipse(-r * 0.27, -r * 0.2, r * 0.09, r * 0.14, 0, 0, TAU); x.ellipse(r * 0.27, -r * 0.2, r * 0.09, r * 0.14, 0, 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,140,170,.6)'; x.beginPath(); x.arc(-r * 0.45, r * 0.05, r * 0.1, 0, TAU); x.arc(r * 0.45, r * 0.05, r * 0.1, 0, TAU); x.fill();
      x.fillStyle = '#6ac85a'; x.beginPath(); x.ellipse(r * 0.1, -r * 1.05, r * 0.22, r * 0.1, -0.5, 0, TAU); x.fill();
      if (Math.sin(o.t * 2 + o.ph) > 0.3){ x.font = "700 11px 'Noto Sans KR'"; x.textAlign = 'center'; x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 3; x.strokeText('쏘지 마!', 0, -r * 1.35); x.fillText('쏘지 마!', 0, -r * 1.35); } }
    else if (o.k === 'glass'){ x.rotate(Math.sin(o.t * 2) * 0.2); x.shadowColor = '#9ffcff'; x.shadowBlur = 18; x.fillStyle = 'rgba(160,250,255,.25)'; x.beginPath(); x.arc(0, 0, r * 1.2, 0, TAU); x.fill(); x.shadowBlur = 0;
      x.strokeStyle = '#c8a050'; x.lineWidth = 3; x.beginPath(); x.moveTo(-r * 0.5, -r * 0.8); x.lineTo(r * 0.5, -r * 0.8); x.moveTo(-r * 0.5, r * 0.8); x.lineTo(r * 0.5, r * 0.8); x.stroke();
      x.fillStyle = 'rgba(220,250,255,.85)'; x.beginPath(); x.moveTo(-r * 0.4, -r * 0.7); x.lineTo(r * 0.4, -r * 0.7); x.lineTo(0, 0); x.lineTo(r * 0.4, r * 0.7); x.lineTo(-r * 0.4, r * 0.7); x.lineTo(0, 0); x.closePath(); x.fill();
      x.fillStyle = '#ffd36a'; x.beginPath(); x.moveTo(-r * 0.25, r * 0.65); x.lineTo(r * 0.25, r * 0.65); x.lineTo(0, r * 0.3); x.fill(); }
  },
};

// ═════════════════════════ 9. 룬 메아리 (기억력) ═════════════════════════
const ECHO_F = [261.6, 329.6, 392, 523.3];
const ECHO = {
  aim: false, st: 'menu', seq: [], pos: 0, round: 0, showI: 0, showT: 0, lit: [0, 0, 0, 0], fx: [], msgT: 0, msg: '',
  playing(){ return this.st === 'show' || this.st === 'input'; },
  open(){ AU.tt.textContent = 'RUNE ECHO'; AU.tb.textContent = '룬 메아리'; this.menu(); },
  close(){ this.st = 'menu'; },
  quit(){ if (this.playing()){ this.st = 'menu'; this.menu(); } else arcadeClose(); },
  menu(){ this.st = 'menu'; AU.sc.textContent = S.mini.best.echo || 0; AU.ss.textContent = '최고 단계'; AU.pr.style.width = '0%'; AU.help.innerHTML = '';
    panel(`<div class="k">RUNE ECHO</div><h2>🔮 룬 메아리</h2><p>룬 돌이 빛나는 순서를 기억했다가 그대로 따라 눌러요.<br>단계마다 하나씩 늘어나고 점점 빨라져요! <b>D F J K</b> 또는 <b>탭</b>.<br>${dailyLeft('echo') ? '<b>오늘 첫 판 골드 ×2</b>' : ''}</p>
      <div class="res"><div>최고 단계<b>${S.mini.best.echo || 0}</b></div><div>플레이<b>${S.mini.plays.echo || 0}</b></div></div><button class="btn" data-a="go">시작!</button><button class="btn sub" data-a="back">← 메뉴</button>`);
    bindPan({ go: () => this.start(), back: () => { arcadeClose(); openMenu(); } }); },
  start(){ this.seq = [ri(0, 3), ri(0, 3)]; this.round = 0; hidePanel(); AU.help.innerHTML = G.IS_TOUCH ? '룬 돌을 탭' : '<b>D</b><b>F</b><b>J</b><b>K</b> 또는 클릭'; this.next(); },
  restart(){ this.start(); },
  next(){ this.seq.push(ri(0, 3)); this.pos = 0; this.st = 'show'; this.showI = -1; this.showT = 0.9; this.say(`${this.round + 1}단계 — 잘 보세요`); AU.sc.textContent = this.round; AU.ss.textContent = `단계 · 길이 ${this.seq.length}`; },
  say(m){ this.msg = m; this.msgT = 1.6; },
  spd(){ return Math.max(0.24, 0.6 - this.round * 0.028); },
  ring(i, ok = 1){ this.lit[i] = 1; const f = ECHO_F[i]; tone('triangle', f, f, 0.42, 0.13); tone('sine', f * 2, f * 2, 0.3, 0.04); if (ok) for (let k = 0; k < 12; k++){ const a = R() * TAU, v = rr(60, 200), p = this.pos2(i); this.fx.push({ x: p[0], y: p[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rr(0.3, 0.6), c: LANEC[i] }); } },
  pos2(i){ const w = Math.min(CW * 0.9, 640), s = w / 4; return [CW / 2 + (i - 1.5) * s, CH * 0.56 + (i === 1 || i === 2 ? -s * 0.18 : 0)]; },
  press(i){ if (this.st !== 'input') return; this.ring(i);
    if (this.seq[this.pos] !== i){ this.st = 'over'; sfx('bad'); tone('sawtooth', 160, 90, 0.5, 0.08); this.say('틀렸어요!'); setTimeout(() => this.finish(), 900); return; }
    this.pos++; if (this.pos >= this.seq.length){ this.round++; this.st = 'wait'; AU.pr.style.width = Math.min(100, this.round / 15 * 100) + '%';
      if (this.round % 5 === 0){ sfx('catch2'); this.say(`${this.round}단계 돌파! 대단해요`); } else { sfx('good'); this.say('좋아요!'); }
      setTimeout(() => { if (GM === this && this.st === 'wait') this.next(); }, 800); } },
  key(code, down){ const i = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 }[code]; if (down && i !== undefined) this.press(i); },
  ptr(type, x, y){ if (type !== 'down') return; for (let i = 0; i < 4; i++){ const p = this.pos2(i), s = Math.min(CW * 0.9, 640) / 4; if (Math.hypot(x - p[0], y - p[1]) < s * 0.48){ this.press(i); return; } } },
  frame(dt){
    for (let i = 0; i < 4; i++) this.lit[i] = Math.max(0, this.lit[i] - dt * 3.2);
    if (this.st === 'show'){ this.showT -= dt; if (this.showT <= 0){ this.showI++; if (this.showI >= this.seq.length){ this.st = 'input'; this.say('따라 해 보세요!'); } else { this.ring(this.seq[this.showI], 0); this.showT = this.spd(); } } }
    if (this.msgT > 0) this.msgT -= dt;
  },
  finish(){
    if (GM !== this) return; this.st = 'result'; const sc = this.round, nb = setBest('echo', sc), rw = reward('echo', sc, sc * 18 + (sc >= 10 ? 100 : 0)); if (sc >= 12) grant('mg_echo');
    panel(`<div class="k">RUNE ECHO</div><h2>🔮 결과</h2><div class="grade" style="font-size:72px">${sc}<small style="font-size:20px"> 단계</small></div>${nb ? '<span class="badge r">NEW BEST</span>' : ''}
      <div class="res"><div>최고 단계<b>${S.mini.best.echo || 0}</b></div><div>마지막 길이<b>${this.seq.length}</b></div></div><div class="rw">🪙 +${fmt(rw.g)}${rw.first ? '<small>오늘 첫 판 보너스 ×2!</small>' : ''}</div>
      <button class="btn" data-a="re">다시 하기</button><button class="btn sub" data-a="q">나가기</button>`); bindPan({ re: () => this.start(), q: () => arcadeClose() });
  },
  draw(x, dt){
    const T = G.time, bg = x.createRadialGradient(CW / 2, CH * 0.55, 10, CW / 2, CH * 0.55, Math.max(CW, CH) * 0.7); bg.addColorStop(0, '#1a1438'); bg.addColorStop(1, '#05060e'); x.fillStyle = bg; x.fillRect(0, 0, CW, CH);
    x.strokeStyle = 'rgba(180,150,255,.12)'; x.lineWidth = 1.5; for (let k = 0; k < 3; k++){ x.beginPath(); x.arc(CW / 2, CH * 0.56, Math.min(CW, CH) * (0.25 + k * 0.12) + Math.sin(T + k) * 4, 0, TAU); x.stroke(); }
    x.save(); x.translate(CW / 2, CH * 0.56); x.rotate(T * 0.05); x.strokeStyle = 'rgba(200,180,255,.18)'; x.lineWidth = 2; for (let i = 0; i < 12; i++){ x.save(); x.rotate(i / 12 * TAU); G.drawRune(x, i, 0, -Math.min(CW, CH) * 0.42, 18); x.restore(); } x.restore();
    const s = Math.min(CW * 0.9, 640) / 4;
    for (let i = 0; i < 4; i++){ const [px, py] = this.pos2(i), l = this.lit[i], r = s * 0.42;
      x.save(); x.translate(px, py); x.shadowColor = LANEC[i]; x.shadowBlur = 10 + l * 40;
      const g = x.createLinearGradient(0, -r, 0, r); g.addColorStop(0, l > 0.1 ? '#ffffff' : '#3a4258'); g.addColorStop(0.5, l > 0.1 ? LANEC[i] : '#20263a'); g.addColorStop(1, '#0a0c16'); x.fillStyle = g;
      x.beginPath(); for (let k = 0; k < 6; k++){ const a = k / 6 * TAU + Math.PI / 6; x[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r * 1.1); } x.closePath(); x.fill(); x.shadowBlur = 0;
      x.strokeStyle = l > 0.1 ? '#fff' : LANEC[i]; x.lineWidth = 3; x.stroke();
      x.strokeStyle = l > 0.1 ? '#10141c' : LANEC[i]; x.globalAlpha = 0.5 + l * 0.5; x.lineWidth = 4; x.lineCap = 'round'; G.drawRune(x, i * 4 + 1, 0, 0, r * 0.8); x.globalAlpha = 1;
      if (!G.IS_TOUCH){ x.font = "900 14px 'Cinzel'"; x.textAlign = 'center'; x.fillStyle = 'rgba(255,243,214,.7)'; x.fillText(LANEK[i], 0, r * 1.1 + 22); } x.restore(); }
    for (let i = this.fx.length - 1; i >= 0; i--){ const f = this.fx[i]; f.t += dt; if (f.t >= f.life){ this.fx.splice(i, 1); continue; } f.x += f.vx * dt; f.y += f.vy * dt; x.globalAlpha = 1 - f.t / f.life; x.fillStyle = f.c; x.fillRect(f.x - 2, f.y - 2, 4, 4); x.globalAlpha = 1; }
    if (this.msgT > 0 && this.st !== 'menu' && this.st !== 'result'){ x.globalAlpha = Math.min(1, this.msgT * 2); x.font = "700 22px 'Gowun Batang'"; x.textAlign = 'center'; x.fillStyle = '#fff3d6'; x.shadowColor = '#b8a0ff'; x.shadowBlur = 14; x.fillText(this.msg, CW / 2, CH * 0.24); x.shadowBlur = 0; x.globalAlpha = 1; }
    if (this.st === 'input'){ x.font = "700 13px 'Noto Sans KR'"; x.textAlign = 'center'; x.fillStyle = '#bfe9ef'; x.fillText(`${this.pos} / ${this.seq.length}`, CW / 2, CH * 0.56 + s * 0.75); }
  },
};
const GAMES = { rhythm: RHY, archery: ARCH, echo: ECHO };

// ═════════════════════════ 10. 미니 게임 메뉴 (🎲) ═════════════════════════
const menuEl = X.mk('div', 'mgMenu', ''); menuEl.className = 'mgw';
function openMenu(){
  if (arcOpen) return; if (!canPlay()) return; closeFishW();
  menuOpen = true; S.mini.seen = 1; X.save(); const mb = document.getElementById('mMini'); if (mb) mb.classList.remove('dot');
  const rb = SONGS.map(s => S.mini.best['rg_' + s.id + '_h'] || S.mini.best['rg_' + s.id] || '—').join(' · '), dn = dexN();
  const card = (id, c, ic, en, n, d, b, dly, btn) => `<div class="gc" style="--c:${c}"><div class="art"><em>${en}</em>${dly ? '<div class="dly">오늘 골드 ×2</div>' : ''}<span>${ic}</span></div><div class="tx"><div class="n">${n}</div><div class="d">${d}</div><div class="b">${b}</div>${btn || `<button class="btn" data-g="${id}">플레이</button>`}</div></div>`;
  menuEl.innerHTML = `<div class="hd"><span>RUNE ARCADE</span><b>🎲 미니 게임</b><div class="sp"></div><div class="gold">🪙 <b>${fmt(gold())}</b></div><button class="x">✕</button></div><div class="bd"><p class="note">룬의 광장 오락실! 점수만큼 <b>골드</b>를 받고, 날마다 게임별 <b>첫 판은 골드 ×2</b>. 높은 기록을 내면 특별한 칭호도 있어요.</p><div class="gm">
    ${card('rhythm', '#ff8ad8', '🎵', 'RUNE RHYTHM', '룬 리듬', '떨어지는 룬에 맞춰 D F J K! 합성 음악 3곡 · 보통/어려움.', `곡별 최고 랭크 <b>${rb}</b>`, dailyLeft('rhythm'))}
    ${card('archery', '#ffd36a', '🎯', 'RUNE ARCHERY', '과녁 맞히기', '45초 사격장. 슬라임 · 과녁 · 황금 새를 맞히고 정령은 피해요.', `최고 점수 <b>${fmt(S.mini.best.archery || 0)}</b>`, dailyLeft('archery'))}
    ${card('echo', '#b8a0ff', '🔮', 'RUNE ECHO', '룬 메아리', '빛나는 룬 돌의 순서를 기억해 따라 눌러요. 점점 길고 빨라져요.', `최고 단계 <b>${S.mini.best.echo || 0}</b>`, dailyLeft('echo'))}
    ${card('fish', '#5ab8ff', '🎣', 'FISHING', '낚시', '광장 분수 (분수 앞 표지판) 와 모험의 대지 낚시터 10곳. 물고기 26종 · 낚시꾼 노아.', `도감 <b>${dn} / ${FISH.length}</b> · 낚시 Lv.<b>${S.fish.lv}</b>`, false,
      `<div style="display:flex;gap:6px"><button class="btn" data-f="go" style="flex:1">${X.mode === 'plaza' ? '분수로 가기' : '낚시하기'}</button><button class="btn sub" data-f="log">수첩</button></div>`)}
  </div></div>`;
  menuEl.querySelector('.x').onclick = closeMenu;
  menuEl.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { X.sfx('ui'); arcadeOpen(b.dataset.g); });
  menuEl.querySelector('[data-f="log"]').onclick = () => openFishLog('dex');
  menuEl.querySelector('[data-f="go"]').onclick = () => { closeMenu(); X.sfx('ui');
    if (X.mode === 'plaza'){ const d = Math.hypot(pp.x - PLAZA.x, pp.z - PLAZA.z); if (d < 2) startFishing('plaza'); else { G.mapMarkers.push({ x: PLAZA.x, z: PLAZA.z, c: '#7ff3ff', fish: 1 }); setTimeout(() => { const i = G.mapMarkers.findIndex(m => m.fish); if (i >= 0) G.mapMarkers.splice(i, 1); }, 30000); X.hint('🎣 분수 앞 <b>낚시터 표지판</b>으로 가서 <b>E</b> (미니맵 ◆)', 4); } }
    else { const id = nearestSpotId(); if (id) startFishing(id); else X.hint('🎣 지도(M)의 <b>🎣 낚시터</b>로 가 보세요', 3); } };
  menuEl.classList.add('on'); X.sfx('ui');
}
function closeMenu(){ if (!menuOpen) return; menuOpen = false; menuEl.classList.remove('on'); }
// 광장 🎲 버튼 (스토리가 만든 #mMini)
{ const mb = document.getElementById('mMini'); if (mb){ mb.classList.remove('soon'); mb.onclick = () => menuOpen ? closeMenu() : openMenu(); if (!S.mini.seen) mb.classList.add('dot'); } }

// ═════════════════════════ 매 프레임 · 키 · 이벤트 ═════════════════════════
G.hooks.push((dt, rdt) => {
  updRipples(rdt); tickAJ(rdt); tickSpots(rdt);
  if (FS) tickFishing(dt, rdt);
});
X.KEYH.push(code => {
  if (arcOpen) return true;
  if (catchEl.classList.contains('on') && (code === 'Space' || code === 'Enter' || code === 'Escape')){ if (FS) closeCatch(); else closeCatch(true); return true; }
  if (FS){
    if (code === 'Space'){ RL.hold = true; if (FS.st !== 'reel') press(); return true; }
    if (code === 'KeyE' || code === 'Escape'){ stopFishing(); return true; }
    if (/^(KeyJ|KeyF|KeyK|KeyR|KeyQ|Digit[1-4])$/.test(code)) return true;
    return false;
  }
  if (code === 'Escape' && fwOpen){ closeFishW(); return true; }
  if (code === 'Escape' && menuOpen){ closeMenu(); return true; }
  return false;
});
BUS.on('hurt', () => { if (FS) stopFishing('💢 공격받아 낚싯줄을 거뒀어요'); });
BUS.on('mode', () => { if (FS) stopFishing(); closeFishW(); });
BUS.on('leaveField', () => { if (FS && !FS.sp.plaza) stopFishing(); });
if (F.menu && F.menu.add) F.menu.add('🐟', '낚시 수첩', () => fwOpen ? closeFishW() : openFishLog('dex'));

// ── 모듈 API ──
F.startFishing = id => startFishing(id);
F.stopFishing = () => stopFishing();
F.openMinigames = () => openMenu();
F.openFishLog = (tab, shop) => openFishLog(tab || 'dex', shop);
Object.defineProperty(F, 'fishing', { get: () => !!FS, configurable: true });
console.log(`[minigames] 낚시터 ${SPOTS.length} + 광장 · 물고기 ${FISH.length}종`);
return { startFishing, stopFishing, openMinigames: openMenu, openFishLog, play: arcadeOpen, FISH, RODS, SPOTS, SONGS, fishArt, get state(){ return FS && FS.st; },
  _dbg: { get FS(){ return FS; }, RL, RHY, ARCH, ECHO, rollFish, buildSong, buildChart, get arcOpen(){ return arcOpen; } } };
}
