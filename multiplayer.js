/*
  ================================================================
   multiplayer.js — Firebase 공용 모듈
   (익명/이메일 로그인, 실시간 멀티플레이, 친구/온라인 상태, 리더보드)
  ================================================================
  이 파일은 hub.html / jumpmap.html / aura-battle-3.html 이 함께 씁니다.
  같은 폴더에 꼭 넣어주세요.

  보안 규칙 예시 (Realtime Database > 규칙):
  {
    "rules": {
      "playhub_mp": {
        "rooms": {
          "$room": {
            "players": { ".read": true, ".write": "auth != null" }
          }
        },
        "users": {
          ".read": "auth != null",
          ".indexOn": ["nicknameLower"],
          "$uid": {
            ".write": "auth != null && auth.uid === $uid"
          }
        },
        "presence": {
          ".read": true,
          "$uid": { ".write": "auth != null && auth.uid === $uid" }
        },
        "friends": {
          "$uid": {
            ".read": "auth != null && auth.uid === $uid",
            ".write": "auth != null && auth.uid === $uid"
          }
        },
        "leaderboard": {
          "$category": {
            ".read": true,
            "$uid": { ".write": "auth != null && auth.uid === $uid" }
          }
        }
      }
    }
  }
*/

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBTL7nxEZb3xDcBG-WRIbeg0gujD0CjSk8",
  authDomain: "eraser-gacha.firebaseapp.com",
  databaseURL: "https://eraser-gacha-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "eraser-gacha",
  storageBucket: "eraser-gacha.firebasestorage.app",
  messagingSenderId: "697774293335",
  appId: "1:697774293335:web:296881f403fe26876d7e12"
};

const MP_ROOT = 'playhub_mp'; // 다른 프로젝트와 안 겹치도록 우리 전용 최상위 네임스페이스

// ================= 공용 아바타 카탈로그 & 빌더 (hub/jumpmap/aura-battle 전부 이 코드로 통일된 아바타를 그림) =================
const AVATAR_CATALOG = [
  // ---- 모자 (head) ----
  { id:'crown',      slot:'head', name:'크라운',       icon:'👑', color:0xFFD700 },
  { id:'wizardhat',  slot:'head', name:'마법사 모자',   icon:'🧙', color:0x6C3FD9 },
  { id:'catears',    slot:'head', name:'고양이 귀',     icon:'🐱', color:0xF5A8C8 },
  { id:'helmet',     slot:'head', name:'헬멧',         icon:'🪖', color:0xB0B8C0 },
  // ---- 장신구 (acc) ----
  { id:'sunglasses', slot:'acc',  name:'선글라스',      icon:'🕶️', color:0x1A1A1A },
  { id:'mask',       slot:'acc',  name:'마스크',        icon:'😷', color:0xE8E8E8 },
  { id:'glasses',    slot:'acc',  name:'안경',          icon:'👓', color:0x333333 },
  { id:'headphones', slot:'acc',  name:'헤드폰',        icon:'🎧', color:0xFF4D4D },
  // ---- 상의 (top) ----
  { id:'hoodie',     slot:'top',  name:'기본 후드티',   icon:'👕', color:0x5C6BC0 },
  { id:'leather',    slot:'top',  name:'가죽 자켓',     icon:'🧥', color:0x4A2E1E },
  { id:'checkered',  slot:'top',  name:'체크 셔츠',     icon:'🦺', color:0xC0392B },
  { id:'armortop',   slot:'top',  name:'갑옷 상의',     icon:'🛡️', color:0x8B95A0 },
  // ---- 하의 (bottom) ----
  { id:'jeans',      slot:'bottom', name:'청바지',      icon:'👖', color:0x3A5FA0 },
  { id:'shorts',     slot:'bottom', name:'반바지',      icon:'🩳', color:0xE0A96D },
  // ---- 후면 (back) ----
  { id:'wings',      slot:'back', name:'악마 날개',     icon:'😈', color:0x8B1A1A },
  { id:'backpack',   slot:'back', name:'검은 가방',     icon:'🎒', color:0x1E1E1E },
  // ---- 추가 아이템 ----
  { id:'cap',        slot:'head', name:'야구모자',      icon:'🧢', color:0x2E6DB4, secret:'reward_cap' },
  { id:'beanie',     slot:'head', name:'비니',          icon:'🎿', color:0xB8433A },
  { id:'horns',      slot:'head', name:'뿔',            icon:'🐐', color:0x3A2A22 },
  { id:'halo',       slot:'head', name:'천사 고리',     icon:'😇', color:0xFFE680, secret:'reward_halo' },
  { id:'tophat',     slot:'head', name:'실크햇',        icon:'🎩', color:0x161616, secret:'reward_tophat' },
  { id:'bandana',    slot:'acc',  name:'복면',          icon:'🥷', color:0x2B2B33 },
  { id:'eyepatch',   slot:'acc',  name:'안대',          icon:'🏴‍☠️', color:0x18181A },
  { id:'scarf',      slot:'acc',  name:'목도리',        icon:'🧣', color:0xD1495B, secret:'reward_scarf' },
  { id:'vest',       slot:'top',  name:'전술 조끼',     icon:'🎽', color:0x4A5240, secret:'reward_vest' },
  { id:'labcoat',    slot:'top',  name:'가운',          icon:'🥼', color:0xE4E9EC },
  { id:'stripes',    slot:'top',  name:'줄무늬 티',     icon:'👔', color:0xE8E8E8 },
  { id:'cargo',      slot:'bottom', name:'카고 바지',   icon:'🪖', color:0x6E6B45 },
  { id:'skirt',      slot:'bottom', name:'치마',        icon:'👗', color:0x8E4B87 },
  { id:'track',      slot:'bottom', name:'트랙 팬츠',   icon:'🏃', color:0x22252B },
  { id:'jetpack',    slot:'back', name:'제트팩',        icon:'🚀', color:0x9AA3AA, secret:'reward_jetpack' },
  { id:'cape',       slot:'back', name:'망토',          icon:'🦸', color:0x8A1F3D, secret:'reward_cape' },
  { id:'katana',     slot:'back', name:'등에 멘 검',    icon:'⚔️', color:0x8E959B, secret:'reward_katana' },
  // ---- 마켓플레이스 신규 아이템 ----
  { id:'partyhat',   slot:'head', name:'파티 모자',     icon:'🥳', color:0xFF5FA2 },
  { id:'bunnyears',  slot:'head', name:'토끼 귀',       icon:'🐰', color:0xF4F0F2 },
  { id:'piratehat',  slot:'head', name:'해적 모자',     icon:'🏴', color:0x1E1B1A },
  { id:'chefhat',    slot:'head', name:'셰프 모자',     icon:'👨‍🍳', color:0xF7F7F2 },
  { id:'monocle',    slot:'acc',  name:'외알 안경',     icon:'🧐', color:0xD4AF37 },
  { id:'mustache',   slot:'acc',  name:'콧수염',        icon:'🥸', color:0x3B2416 },
  { id:'goggles',    slot:'acc',  name:'비행 고글',     icon:'🥽', color:0x8A5A2B },
  { id:'tuxedo',     slot:'top',  name:'턱시도',        icon:'🤵', color:0x16161A },
  { id:'sweater',    slot:'top',  name:'니트 스웨터',   icon:'🧶', color:0x2F7D5B },
  { id:'guitar',     slot:'back', name:'일렉 기타',     icon:'🎸', color:0xD2332E },
  { id:'angelwings', slot:'back', name:'천사 날개',     icon:'🪽', color:0xF5F7FF },
  { id:'shield',     slot:'back', name:'기사 방패',     icon:'🛡️', color:0x2F5DA8 },
  // ---- 시크릿 ----
  { id:'dittonubs',  slot:'head', name:'메타몽 뿔',     icon:'🫠', color:0xB79CD4, secret:'ditto' },
  // ---- 개인 전용 (EXCLUSIVE_REWARDS 참고) ----
  { id:'tero_crown', slot:'head', name:'테로의 보이드 크라운', icon:'⚡', color:0x6D28D9, secret:'tero26', rewardLevel:26, exclusive:'테로 전용' },
];
// ---- 특정 계정 전용 레벨 보상 ----
// 계정 이름(가입/첫 접속 때 고정된 이름, 표시 이름 바꿔도 안 변함)이나 uid로만 판별한다.
// 표시 이름으로 판별하면 아무나 이름을 바꿔서 가져갈 수 있어서.
const EXCLUSIVE_REWARDS = [
  { level:26, secret:'tero26', item:'tero_crown', label:'⚡ 테로 전용 · 보이드 크라운', accounts:['플레이어2340'], uids:[] },
];
const AVATAR_SLOTS = ['face','head','acc','top','bottom','back'];

// ---- 몸 색상 팔레트 ----
// 예전 아바타는 피부/상의/하의 색이 코드에 박혀 있어서 전부 똑같이 생겼었다.
// 이제 색도 저장 항목으로 빼서 각자 다르게 꾸밀 수 있다.
const AVATAR_PALETTE = {
  skin:  [
    { id:'skin_classic', name:'클래식',   color:0xF5CD30 },
    { id:'skin_light',   name:'라이트',   color:0xF2C9A0 },
    { id:'skin_tan',     name:'탠',       color:0xD79A63 },
    { id:'skin_brown',   name:'브라운',   color:0x9C6340 },
    { id:'skin_deep',    name:'딥',       color:0x6B4227 },
    { id:'skin_mint',    name:'민트',     color:0x7FD6B5 },
    { id:'skin_lilac',   name:'라일락',   color:0xB79CE0 },
    { id:'skin_ash',     name:'애쉬',     color:0xB9BFC4 },
    { id:'skin_ditto',   name:'메타몽',   color:0xB79CD4, secret:'ditto' }
  ],
  shirt: [
    { id:'shirt_blue',   name:'블루',     color:0x0B62C4 },
    { id:'shirt_red',    name:'레드',     color:0xC0392B },
    { id:'shirt_green',  name:'그린',     color:0x2E8B57 },
    { id:'shirt_purple', name:'퍼플',     color:0x7B4FC4 },
    { id:'shirt_orange', name:'오렌지',   color:0xE07B29 },
    { id:'shirt_black',  name:'블랙',     color:0x23262A },
    { id:'shirt_white',  name:'화이트',   color:0xE8ECEF },
    { id:'shirt_pink',   name:'핑크',     color:0xE884B0 },
    { id:'shirt_ditto',  name:'메타몽',   color:0xB79CD4, secret:'ditto' }
  ],
  pants: [
    { id:'pants_green',  name:'그린',     color:0x287F35 },
    { id:'pants_navy',   name:'네이비',   color:0x27364F },
    { id:'pants_grey',   name:'그레이',   color:0x5A5F63 },
    { id:'pants_brown',  name:'브라운',   color:0x6B4A2E },
    { id:'pants_black',  name:'블랙',     color:0x1E2124 },
    { id:'pants_khaki',  name:'카키',     color:0x8A8759 },
    { id:'pants_ditto',  name:'메타몽',   color:0xB79CD4, secret:'ditto' }
  ]
};
const AVATAR_COLOR_SLOTS = ['skin','shirt','pants'];
// ---- 시크릿 해금 ----
// 특정 아이템/색상은 secret 키가 붙어 있고, 해금 전에는 꾸미기 목록에 아예 안 뜬다.
// 해금 상태는 이 기기에 저장되고, 계정에도 같이 올려서 다른 기기에서도 유지된다.
function mpGetSecrets(){
  try { return JSON.parse(localStorage.getItem('mp_secret_unlocks') || '[]') || []; }
  catch(e){ return []; }
}
function mpHasSecret(key){ return mpGetSecrets().indexOf(key) >= 0; }
function mpUnlockSecret(key){
  const list = mpGetSecrets();
  if (list.indexOf(key) >= 0) return false;   // 이미 갖고 있음
  list.push(key);
  try { localStorage.setItem('mp_secret_unlocks', JSON.stringify(list)); } catch(e){}
  return true;   // 이번에 새로 해금됨
}
// 잠긴 시크릿을 걸러낸 목록을 돌려준다 — 꾸미기 UI는 항상 이걸 쓴다
function mpVisible(list){
  const owned = mpGetSecrets();
  return (list || []).filter(it => !it.secret || owned.indexOf(it.secret) >= 0);
}

function mpDefaultLoadout(){
  return { head:null, acc:null, top:null, bottom:null, back:null,
           face:'face_smile', skin:'skin_classic', shirt:'shirt_blue', pants:'pants_green' };
}
function mpPaletteColor(kind, id){
  const list = AVATAR_PALETTE[kind] || [];
  const found = list.find(c=>c.id===id);
  return found ? found.color : list[0].color;
}

// ---- 얼굴 ----
// 머리가 그냥 노란 상자였다. 얼굴을 캔버스로 그려 머리 앞면에만 붙인다.
const AVATAR_FACES = [
  { id:'face_smile',  name:'스마일',   icon:'🙂' },
  { id:'face_grin',   name:'활짝',     icon:'😄' },
  { id:'face_cool',   name:'시크',     icon:'😎' },
  { id:'face_wink',   name:'윙크',     icon:'😉' },
  { id:'face_angry',  name:'화남',     icon:'😠' },
  { id:'face_sad',    name:'시무룩',   icon:'😢' },
  { id:'face_shock',  name:'놀람',     icon:'😲' },
  { id:'face_dead',   name:'해골',     icon:'💀' },
  { id:'face_robot',  name:'로봇',     icon:'🤖' },
  { id:'face_blank',  name:'무표정',   icon:'😐' },
  { id:'face_ditto',  name:'메타몽',   icon:'🫠', secret:'ditto' }
];
const faceTexCache = {}, faceCanvasCache = {};
function mpFaceTexture(faceId, skinHex){
  const key = faceId + '|' + skinHex;
  if (faceTexCache[key]) return faceTexCache[key];
  const T = window.THREE;
  const tex = new T.CanvasTexture(mpFaceCanvas(faceId, skinHex));
  if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
  faceTexCache[key] = tex;
  return tex;
}
// 얼굴 그림(캔버스) — 3D 머리 텍스처와 프로필 얼굴 사진이 같은 그림을 쓴다
function mpFaceCanvas(faceId, skinHex){
  const key = faceId + '|' + skinHex;
  if (faceCanvasCache[key]) return faceCanvasCache[key];
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#' + skinHex.toString(16).padStart(6,'0');
  x.fillRect(0,0,128,128);
  x.fillStyle = '#1A1A1A';
  x.strokeStyle = '#1A1A1A';
  x.lineWidth = 6;
  x.lineCap = 'round';
  const eye = (cx,cy,r)=>{ x.beginPath(); x.arc(cx,cy,r,0,7); x.fill(); };
  const arc = (cx,cy,r,a0,a1)=>{ x.beginPath(); x.arc(cx,cy,r,a0,a1); x.stroke(); };
  switch(faceId){
    case 'face_grin':
      eye(44,52,9); eye(84,52,9);
      x.beginPath(); x.arc(64,68,26,0.15*Math.PI,0.85*Math.PI); x.fill();
      break;
    case 'face_cool':
      x.fillRect(26,44,76,16);
      x.fillRect(20,46,10,6); x.fillRect(98,46,10,6);
      arc(64,74,16,0.15*Math.PI,0.85*Math.PI);
      break;
    case 'face_wink':
      eye(44,52,9);
      x.beginPath(); x.moveTo(74,52); x.lineTo(94,52); x.stroke();
      arc(64,72,16,0.15*Math.PI,0.85*Math.PI);
      break;
    case 'face_angry':
      eye(44,56,9); eye(84,56,9);
      x.beginPath(); x.moveTo(30,38); x.lineTo(56,48); x.stroke();
      x.beginPath(); x.moveTo(98,38); x.lineTo(72,48); x.stroke();
      arc(64,92,16,1.15*Math.PI,1.85*Math.PI);
      break;
    case 'face_sad':
      eye(44,54,9); eye(84,54,9);
      arc(64,92,16,1.15*Math.PI,1.85*Math.PI);
      break;
    case 'face_shock':
      eye(44,50,11); eye(84,50,11);
      x.beginPath(); x.ellipse(64,84,13,17,0,0,7); x.fill();
      break;
    case 'face_dead':
      x.beginPath(); x.moveTo(32,42); x.lineTo(56,62); x.moveTo(56,42); x.lineTo(32,62); x.stroke();
      x.beginPath(); x.moveTo(72,42); x.lineTo(96,62); x.moveTo(96,42); x.lineTo(72,62); x.stroke();
      x.fillRect(40,84,48,10);
      for (let i=0;i<4;i++) x.fillRect(46+i*12,78,5,22);
      break;
    case 'face_robot':
      x.fillRect(30,44,28,14); x.fillRect(70,44,28,14);
      x.fillStyle = '#5FE0FF'; x.fillRect(34,47,20,8); x.fillRect(74,47,20,8);
      x.fillStyle = '#1A1A1A';
      x.fillRect(40,80,48,8);
      for (let i=0;i<5;i++) x.fillRect(42+i*10,76,4,16);
      break;
    case 'face_ditto':
      // 원본 그대로 — 작고 동그란 점눈 두 개가 가까이 붙어 있고,
      // 그 아래로 얇고 넓은 물결 입이 오른쪽 끝에서 살짝 올라간다.
      eye(53,49,5.5); eye(77,49,5.5);
      x.lineWidth = 5;
      x.lineJoin = 'round';
      x.beginPath();
      x.moveTo(44,69);
      x.quadraticCurveTo(54,74,65,70);   // 왼쪽: 얕게 처졌다가 되돌아옴
      x.quadraticCurveTo(76,66,87,62);   // 오른쪽: 끝이 살짝 올라간 능글맞은 선
      x.stroke();
      break;
    case 'face_blank':
      eye(44,54,8); eye(84,54,8);
      x.beginPath(); x.moveTo(48,86); x.lineTo(80,86); x.stroke();
      break;
    default: // face_smile
      eye(44,52,9); eye(84,52,9);
      arc(64,70,18,0.15*Math.PI,0.85*Math.PI);
  }
  faceCanvasCache[key] = c;
  return c;
}
// 프로필용 아바타 얼굴 사진 (이모지 대신) — 로드아웃으로 머리+얼굴+모자+장신구+어깨를 그려 dataURL로 돌려준다
const headshotCache = {};
function mpHeadshot(loadout){
  const lo = Object.assign(mpDefaultLoadout(), loadout || {});
  const key = [lo.face, lo.skin, lo.shirt, lo.head, lo.acc].join('|');
  if (headshotCache[key]) return headshotCache[key];
  const hex = n => '#' + (n >>> 0).toString(16).padStart(6, '0');
  const skin = mpPaletteColor('skin', lo.skin), shirt = mpPaletteColor('shirt', lo.shirt);
  const item = id => id ? AVATAR_CATALOG.find(i => i.id === id) : null;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const rr = (X, Y, W, H, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); };
  // 배경
  const bg = x.createLinearGradient(0, 0, 0, 128); bg.addColorStop(0, '#3a4046'); bg.addColorStop(1, '#1f2327'); x.fillStyle = bg; x.fillRect(0, 0, 128, 128);
  // 어깨(셔츠) + 목
  x.fillStyle = hex(shirt); rr(8, 104, 112, 40, 16); x.fill();
  x.fillStyle = hex(skin); x.fillRect(54, 94, 20, 14);
  // 머리 + 얼굴
  x.save(); rr(26, 24, 76, 74, 16); x.clip(); x.drawImage(mpFaceCanvas(lo.face, skin), 26, 22, 76, 78);
  const g = x.createLinearGradient(0, 24, 0, 98); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(0,0,0,.18)'); x.fillStyle = g; x.fillRect(26, 24, 76, 74); x.restore();
  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; rr(26, 24, 76, 74, 16); x.stroke();
  // 장신구
  const acc = item(lo.acc);
  if (acc){ const col = hex(acc.color || 0x222222);
    if (acc.id === 'sunglasses'){ x.fillStyle = '#111'; rr(32, 46, 28, 16, 5); x.fill(); rr(68, 46, 28, 16, 5); x.fill(); x.fillRect(58, 50, 12, 4); }
    else if (acc.id === 'glasses'){ x.strokeStyle = '#222'; x.lineWidth = 3; rr(33, 45, 26, 18, 6); x.stroke(); rr(69, 45, 26, 18, 6); x.stroke(); x.beginPath(); x.moveTo(59, 52); x.lineTo(69, 52); x.stroke(); }
    else if (acc.id === 'mask'){ x.fillStyle = '#eee'; rr(36, 66, 56, 26, 8); x.fill(); x.strokeStyle = '#ccc'; x.lineWidth = 2; x.beginPath(); x.moveTo(40, 76); x.lineTo(88, 76); x.stroke(); }
    else if (acc.id === 'headphones'){ x.strokeStyle = '#333'; x.lineWidth = 6; x.beginPath(); x.arc(64, 60, 44, Math.PI*1.05, Math.PI*1.95); x.stroke(); x.fillStyle = col; rr(14, 50, 16, 26, 6); x.fill(); rr(98, 50, 16, 26, 6); x.fill(); }
    else { x.font = '26px serif'; x.textAlign = 'center'; x.fillText(acc.icon || '', 100, 40); } }
  // 모자
  const hat = item(lo.head);
  if (hat){ const col = hex(hat.color || 0x888888);
    if (hat.id === 'crown'){ x.fillStyle = col; x.beginPath(); x.moveTo(34, 30); x.lineTo(34, 8); x.lineTo(47, 20); x.lineTo(64, 4); x.lineTo(81, 20); x.lineTo(94, 8); x.lineTo(94, 30); x.closePath(); x.fill(); x.fillStyle = '#e0303a'; x.beginPath(); x.arc(64, 22, 4, 0, 7); x.fill(); }
    else if (hat.id === 'wizardhat'){ x.fillStyle = col; x.beginPath(); x.moveTo(22, 32); x.lineTo(106, 32); x.lineTo(72, 0); x.closePath(); x.fill(); x.fillStyle = '#ffd84a'; x.font = '14px serif'; x.fillText('★', 62, 24); }
    else if (hat.id === 'catears'){ x.fillStyle = col; for (const sx of [-1, 1]){ x.beginPath(); x.moveTo(64 + sx*14, 28); x.lineTo(64 + sx*36, 28); x.lineTo(64 + sx*32, 4); x.closePath(); x.fill(); } }
    else { x.fillStyle = col; x.beginPath(); x.ellipse(64, 30, 42, 20, 0, Math.PI, 0); x.fill(); x.fillRect(22, 28, 84, 8); } }
  const url = c.toDataURL('image/png'); headshotCache[key] = url; return url;
}
const AVATAR_STUD = 0.62;

function mpBuildR6Avatar(colors){
  const T = window.THREE;
  const group = new T.Group();
  const C = colors || {};
  const skinHex  = mpPaletteColor('skin',  C.skin);
  const shirtHex = mpPaletteColor('shirt', C.shirt);
  const pantsHex = mpPaletteColor('pants', C.pants);
  const legW=1*AVATAR_STUD, legH=2*AVATAR_STUD, legD=1*AVATAR_STUD;
  const torsoW=2*AVATAR_STUD, torsoH=2*AVATAR_STUD, torsoD=1*AVATAR_STUD;
  const headW=2*AVATAR_STUD, headH=1*AVATAR_STUD, headD=1*AVATAR_STUD;
  const armW=1*AVATAR_STUD, armH=2*AVATAR_STUD, armD=1*AVATAR_STUD;
  const legTopY = legH, torsoCenterY = legTopY+torsoH/2, headCenterY = legTopY+torsoH+headH/2;

  const legMat = new T.MeshStandardMaterial({ color:pantsHex });
  const torsoMat = new T.MeshStandardMaterial({ color:shirtHex });
  const armMat = new T.MeshStandardMaterial({ color:skinHex });
  const headMat = new T.MeshStandardMaterial({ color:skinHex });

  const legL = new T.Mesh(new T.BoxGeometry(legW,legH,legD), legMat.clone());
  legL.position.set(-legW/2, legH/2, 0); group.add(legL);
  const legR = new T.Mesh(new T.BoxGeometry(legW,legH,legD), legMat.clone());
  legR.position.set(legW/2, legH/2, 0); group.add(legR);

  const torso = new T.Mesh(new T.BoxGeometry(torsoW,torsoH,torsoD), torsoMat.clone());
  torso.position.set(0, torsoCenterY, 0); group.add(torso);

  const armL = new T.Mesh(new T.BoxGeometry(armW,armH,armD), armMat.clone());
  armL.position.set(-(torsoW/2+armW/2), torsoCenterY+0.05, 0); group.add(armL);
  const armR = new T.Mesh(new T.BoxGeometry(armW,armH,armD), armMat.clone());
  armR.position.set((torsoW/2+armW/2), torsoCenterY+0.05, 0); group.add(armR);

  const head = new T.Mesh(new T.BoxGeometry(headW,headH,headD), headMat.clone());
  head.position.set(0, headCenterY, 0); group.add(head);
  // 얼굴은 머리 앞면에 얇은 판을 덧대는 방식으로 붙인다.
  // (머리 재질을 6면 배열로 바꾸면 head.material.color 로 팀 색을 칠하던 다른 게임들이
  //  전부 깨지므로, 머리 재질은 단일 재질 그대로 두는 게 안전하다)
  if (C.face){
    const faceMat = new T.MeshBasicMaterial({ map:mpFaceTexture(C.face, skinHex) });
    const faceMesh = new T.Mesh(new T.PlaneGeometry(headW*0.98, headH*0.98), faceMat);
    // 머리에 자식으로 붙인다 — 머리를 돌리면 얼굴도 같이 돌고,
    // 그룹의 자식 순서(legL,legR,torso,armL,armR,head)도 그대로 유지된다.
    faceMesh.position.set(0, 0, headD/2 + 0.006);
    faceMesh.userData.isFace = true;
    head.add(faceMesh);
  }

  group.userData = { legTopY, torsoCenterY, headCenterY, torsoW, torsoH, torsoD, headW, headH, headD, legW, legH,
                     skinHex, shirtHex, pantsHex, parts:{ legL, legR, torso, armL, armR, head } };
  return group;
}

function mpAttachAvatarItem(avatarGroup, item){
  const T = window.THREE;
  if (!item) return null;
  const u = avatarGroup.userData;
  const col = new T.Color(item.color);
  const g = new T.Group();
  const mat = (opts) => new T.MeshStandardMaterial(Object.assign({ color:col }, opts||{}));

  if (item.slot === 'head'){
    const baseY = u.headCenterY + u.headH/2;
    if (item.id === 'crown'){
      const ring = new T.Mesh(new T.CylinderGeometry(0.42,0.5,0.28,8), mat({metalness:0.7,roughness:0.25}));
      ring.position.y = baseY + 0.16; g.add(ring);
      for (let i=0;i<5;i++){
        const spike = new T.Mesh(new T.ConeGeometry(0.09,0.22,4), mat({metalness:0.7,roughness:0.25}));
        const a = (i/5)*Math.PI*2;
        spike.position.set(Math.cos(a)*0.4, baseY+0.42, Math.sin(a)*0.4);
        g.add(spike);
      }
    } else if (item.id === 'wizardhat'){
      const cone = new T.Mesh(new T.ConeGeometry(0.32,0.75,10), mat({roughness:0.85}));
      cone.position.y = baseY + 0.42; cone.rotation.z = 0.08; g.add(cone);
      const brim = new T.Mesh(new T.CylinderGeometry(0.5,0.5,0.06,14), mat({roughness:0.85}));
      brim.position.y = baseY + 0.05; g.add(brim);
    } else if (item.id === 'catears'){
      [-1,1].forEach(side=>{
        const ear = new T.Mesh(new T.ConeGeometry(0.14,0.26,4), mat({roughness:0.7}));
        ear.position.set(side*0.28, baseY+0.16, 0.02);
        ear.rotation.z = -side*0.3;
        g.add(ear);
      });
    } else if (item.id === 'helmet'){
      const dome = new T.Mesh(new T.SphereGeometry(0.46,14,10,0,Math.PI*2,0,Math.PI*0.62), mat({metalness:0.5,roughness:0.3}));
      dome.position.y = baseY - 0.02; g.add(dome);
      const visor = new T.Mesh(new T.BoxGeometry(0.66,0.1,0.05), new T.MeshStandardMaterial({ color:0x2a3a4a, metalness:0.6, roughness:0.2 }));
      visor.position.set(0, baseY+0.1, u.headD/2+0.02); g.add(visor);
    } else if (item.id === 'cap'){
      const crown = new T.Mesh(new T.SphereGeometry(0.44,12,8,0,Math.PI*2,0,Math.PI*0.5), mat({roughness:0.85}));
      crown.position.y = baseY - 0.01; g.add(crown);
      const brim = new T.Mesh(new T.BoxGeometry(0.7,0.06,0.42), mat({roughness:0.85}));
      brim.position.set(0, baseY+0.02, u.headD/2+0.14); g.add(brim);
      const btn = new T.Mesh(new T.SphereGeometry(0.05,6,5), mat({roughness:0.7}));
      btn.position.y = baseY + 0.42; g.add(btn);
    } else if (item.id === 'beanie'){
      const cap = new T.Mesh(new T.SphereGeometry(0.45,12,9,0,Math.PI*2,0,Math.PI*0.58), mat({roughness:0.95}));
      cap.position.y = baseY - 0.06; g.add(cap);
      const band = new T.Mesh(new T.CylinderGeometry(0.46,0.46,0.14,14), mat({roughness:0.95}));
      band.position.y = baseY - 0.02; g.add(band);
      const pom = new T.Mesh(new T.SphereGeometry(0.11,8,6), mat({roughness:0.95}));
      pom.position.y = baseY + 0.4; g.add(pom);
    } else if (item.id === 'horns'){
      [-1,1].forEach(side=>{
        const horn = new T.Mesh(new T.ConeGeometry(0.11,0.42,6), mat({roughness:0.6}));
        horn.position.set(side*0.3, baseY+0.2, -0.02);
        horn.rotation.z = -side*0.42; horn.rotation.x = -0.18;
        g.add(horn);
      });
    } else if (item.id === 'tero_crown'){
      // 떠 있는 보라 크라운 + 보랏빛 수정 가시 + 앞면 번개 문양 + 도는 듯한 궤도 고리
      const cg = new T.Group(); cg.position.y = baseY + 0.1; cg.rotation.z = -0.08; g.add(cg);
      const dark = new T.MeshStandardMaterial({ color:0x24103F, metalness:0.85, roughness:0.25 });
      const glow = new T.MeshStandardMaterial({ color:0xB38CFF, emissive:0x8B5CF6, emissiveIntensity:1.1, roughness:0.2, metalness:0.2 });
      const band = new T.Mesh(new T.CylinderGeometry(0.45,0.41,0.22,8), dark); band.position.y = 0.11; cg.add(band);
      const trim = new T.Mesh(new T.TorusGeometry(0.44,0.03,6,24), new T.MeshStandardMaterial({ color:0xE9C46A, metalness:0.9, roughness:0.25 })); trim.rotation.x = Math.PI/2; trim.position.y = 0.22; cg.add(trim);
      for (let i=0;i<6;i++){ const a = (i/6)*Math.PI*2, tall = i % 2 ? 0.26 : 0.4;
        const c = new T.Mesh(new T.OctahedronGeometry(0.1), glow); c.scale.set(0.8, tall/0.1*0.55, 0.8);
        c.position.set(Math.cos(a)*0.4, 0.24 + tall*0.5, Math.sin(a)*0.4); cg.add(c); }
      // 번개 문양 (앞면)
      const bolt = new T.Shape(); bolt.moveTo(0.03,0.16); bolt.lineTo(-0.08,-0.01); bolt.lineTo(0.0,-0.01); bolt.lineTo(-0.04,-0.16); bolt.lineTo(0.09,0.03); bolt.lineTo(0.01,0.03); bolt.lineTo(0.06,0.16); bolt.closePath();
      const bm = new T.Mesh(new T.ExtrudeGeometry(bolt, { depth:0.03, bevelEnabled:false }), new T.MeshStandardMaterial({ color:0xFFE14D, emissive:0xFFC400, emissiveIntensity:1.0 }));
      bm.position.set(0, 0.12, 0.44); cg.add(bm);
      const orbit = new T.Mesh(new T.TorusGeometry(0.66,0.018,6,40), new T.MeshStandardMaterial({ color:0x6EE7FF, emissive:0x22D3EE, emissiveIntensity:1.2 }));
      orbit.rotation.x = Math.PI/2 - 0.35; orbit.rotation.y = 0.3; orbit.position.y = 0.3; cg.add(orbit);
      const top = new T.Mesh(new T.OctahedronGeometry(0.09), new T.MeshStandardMaterial({ color:0xF0ABFC, emissive:0xD946EF, emissiveIntensity:1.2 })); top.position.y = 0.88; cg.add(top);
    } else if (item.id === 'halo'){
      const ring = new T.Mesh(new T.TorusGeometry(0.3,0.055,8,20),
        new T.MeshStandardMaterial({ color:col, emissive:col, emissiveIntensity:0.9, roughness:0.4 }));
      ring.rotation.x = Math.PI/2; ring.position.y = baseY + 0.46; g.add(ring);
    } else if (item.id === 'dittonubs'){
      // 머리 위 물컹한 돌기 두 개
      [-1,1].forEach(side=>{
        const nub = new T.Mesh(new T.SphereGeometry(0.15,10,8), mat({roughness:0.95}));
        nub.scale.set(1,1.5,1);
        nub.position.set(side*0.26, baseY+0.12, -0.04);
        g.add(nub);
      });
      const bump = new T.Mesh(new T.SphereGeometry(0.42,12,9,0,Math.PI*2,0,Math.PI*0.5), mat({roughness:0.95}));
      bump.scale.set(1,0.42,1); bump.position.y = baseY - 0.02; g.add(bump);
    } else if (item.id === 'partyhat'){
      const cone = new T.Mesh(new T.ConeGeometry(0.3,0.7,16), mat({roughness:0.6}));
      cone.position.y = baseY + 0.35; cone.rotation.z = -0.12; g.add(cone);
      [0.12,0.3,0.48].forEach((h,i)=>{ const band = new T.Mesh(new T.TorusGeometry(0.28*(1-h/0.7)+0.01,0.025,6,16), new T.MeshStandardMaterial({ color:[0xFFE14D,0x4DD2FF,0x7CFF6B][i] }));
        band.rotation.x = Math.PI/2; band.position.set(-h*0.12, baseY + h, 0); g.add(band); });
      const pom = new T.Mesh(new T.SphereGeometry(0.08,8,6), new T.MeshStandardMaterial({ color:0xFFE14D })); pom.position.set(-0.085, baseY+0.72, 0); g.add(pom);
    } else if (item.id === 'bunnyears'){
      [-1,1].forEach(side=>{
        const ear = new T.Mesh(new T.SphereGeometry(0.1,10,8), mat({roughness:0.8}));   // r128(허브/점프맵)에는 캡슐 지오메트리가 없어서 늘린 구로 만든다
        ear.scale.set(1,3.2,0.7); ear.position.set(side*0.2, baseY+0.34, -0.02); ear.rotation.z = -side*0.18; g.add(ear);
        const inner = new T.Mesh(new T.BoxGeometry(0.07,0.38,0.02), new T.MeshStandardMaterial({ color:0xF7A8C4 }));
        inner.position.set(side*0.2, baseY+0.34, 0.075); inner.rotation.z = -side*0.18; g.add(inner);
      });
    } else if (item.id === 'piratehat'){
      const crown = new T.Mesh(new T.CylinderGeometry(0.36,0.44,0.34,16), mat({roughness:0.7}));
      crown.position.y = baseY + 0.17; g.add(crown);
      const brim = new T.Mesh(new T.CylinderGeometry(0.62,0.62,0.06,3), mat({roughness:0.7}));   // 삼각 챙
      brim.position.y = baseY + 0.06; brim.rotation.y = Math.PI/2; g.add(brim);
      const trim = new T.Mesh(new T.CylinderGeometry(0.64,0.64,0.03,3), new T.MeshStandardMaterial({ color:0xD4AF37, metalness:0.6, roughness:0.3 }));
      trim.position.y = baseY + 0.1; trim.rotation.y = Math.PI/2; g.add(trim);
      const skull = new T.Mesh(new T.SphereGeometry(0.08,10,8), new T.MeshStandardMaterial({ color:0xF2F2F2 })); skull.position.set(0, baseY+0.2, 0.42); g.add(skull);
      [-1,1].forEach(sd=>{ const bone=new T.Mesh(new T.BoxGeometry(0.2,0.035,0.02), new T.MeshStandardMaterial({ color:0xF2F2F2 })); bone.position.set(0, baseY+0.12, 0.44); bone.rotation.z = sd*0.6; g.add(bone); });
    } else if (item.id === 'chefhat'){
      const band = new T.Mesh(new T.CylinderGeometry(0.4,0.4,0.2,16), mat({roughness:0.9})); band.position.y = baseY + 0.1; g.add(band);
      for (let i=0;i<5;i++){ const a=(i/5)*Math.PI*2; const puff=new T.Mesh(new T.SphereGeometry(0.22,10,8), mat({roughness:0.95}));
        puff.position.set(Math.cos(a)*0.2, baseY+0.38, Math.sin(a)*0.2); g.add(puff); }
      const top = new T.Mesh(new T.SphereGeometry(0.26,10,8), mat({roughness:0.95})); top.position.y = baseY + 0.46; g.add(top);
    } else if (item.id === 'tophat'){
      const brim = new T.Mesh(new T.CylinderGeometry(0.56,0.56,0.06,16), mat({roughness:0.7}));
      brim.position.y = baseY + 0.03; g.add(brim);
      const barrel = new T.Mesh(new T.CylinderGeometry(0.36,0.36,0.62,16), mat({roughness:0.7}));
      barrel.position.y = baseY + 0.36; g.add(barrel);
      const band = new T.Mesh(new T.CylinderGeometry(0.375,0.375,0.12,16),
        new T.MeshStandardMaterial({ color:0x9B2335, roughness:0.7 }));
      band.position.y = baseY + 0.14; g.add(band);
    }
  } else if (item.slot === 'acc'){
    const eyeY = u.headCenterY;
    const eyeZ = u.headD/2 + 0.02;
    if (item.id === 'sunglasses' || item.id === 'glasses'){
      const frameMat = item.id==='sunglasses' ? mat({metalness:0.4,roughness:0.3}) : new T.MeshStandardMaterial({ color:0x333333, metalness:0.4, roughness:0.3 });
      const bar = new T.Mesh(new T.BoxGeometry(0.62,0.16,0.05), frameMat);
      bar.position.set(0, eyeY, eyeZ); g.add(bar);
    } else if (item.id === 'mask'){
      const m = new T.Mesh(new T.BoxGeometry(0.5,0.35,0.12), mat({roughness:0.8}));
      m.position.set(0, eyeY-0.15, eyeZ); g.add(m);
    } else if (item.id === 'headphones'){
      [-1,1].forEach(side=>{
        const cup = new T.Mesh(new T.CylinderGeometry(0.14,0.14,0.1,10), mat({roughness:0.6}));
        cup.rotation.z = Math.PI/2;
        cup.position.set(side*(u.headW/2+0.02), eyeY, 0); g.add(cup);
      });
      const band = new T.Mesh(new T.TorusGeometry(0.34,0.03,6,12,Math.PI), mat({roughness:0.6}));
      band.rotation.z = Math.PI; band.position.y = u.headCenterY + u.headH/2 + 0.15; g.add(band);
    } else if (item.id === 'bandana'){
      const wrap = new T.Mesh(new T.BoxGeometry(u.headW+0.04,0.34,u.headD+0.04), mat({roughness:0.9}));
      wrap.position.set(0, eyeY-0.16, 0); g.add(wrap);
      const knot = new T.Mesh(new T.BoxGeometry(0.16,0.16,0.16), mat({roughness:0.9}));
      knot.position.set(0, eyeY-0.16, -u.headD/2-0.08); g.add(knot);
    } else if (item.id === 'eyepatch'){
      const patch = new T.Mesh(new T.BoxGeometry(0.26,0.22,0.05), mat({roughness:0.85}));
      patch.position.set(-0.16, eyeY+0.02, eyeZ); g.add(patch);
      const strap = new T.Mesh(new T.BoxGeometry(u.headW+0.04,0.05,u.headD+0.04), mat({roughness:0.85}));
      strap.position.set(0, eyeY+0.1, 0); strap.rotation.z = 0.16; g.add(strap);
    } else if (item.id === 'monocle'){
      const ring = new T.Mesh(new T.TorusGeometry(0.11,0.022,8,20), mat({metalness:0.8,roughness:0.25}));
      ring.position.set(0.18, eyeY+0.04, eyeZ+0.01); g.add(ring);
      const lens = new T.Mesh(new T.CircleGeometry(0.1,20), new T.MeshStandardMaterial({ color:0xBFE3FF, transparent:true, opacity:0.45, metalness:0.2, roughness:0.05 }));
      lens.position.set(0.18, eyeY+0.04, eyeZ+0.012); g.add(lens);
      const chain = new T.Mesh(new T.BoxGeometry(0.012,0.34,0.012), mat({metalness:0.8,roughness:0.25}));
      chain.position.set(0.27, eyeY-0.12, eyeZ); chain.rotation.z = 0.35; g.add(chain);
    } else if (item.id === 'mustache'){
      [-1,1].forEach(side=>{ const m = new T.Mesh(new T.SphereGeometry(0.1,10,8), mat({roughness:0.9}));
        m.scale.set(1.5,0.55,0.6); m.position.set(side*0.11, eyeY-0.13, eyeZ+0.01); m.rotation.z = side*0.25; g.add(m); });
    } else if (item.id === 'goggles'){
      const strap = new T.Mesh(new T.BoxGeometry(u.headW+0.05,0.09,u.headD+0.05), mat({roughness:0.8}));
      strap.position.set(0, eyeY+0.2, 0); g.add(strap);
      [-1,1].forEach(side=>{ const lens = new T.Mesh(new T.CylinderGeometry(0.12,0.12,0.08,14), new T.MeshStandardMaterial({ color:0x7FD4FF, metalness:0.5, roughness:0.1, emissive:0x1a4a66, emissiveIntensity:0.4 }));
        lens.rotation.x = Math.PI/2; lens.position.set(side*0.17, eyeY+0.2, eyeZ+0.03); g.add(lens);
        const rim = new T.Mesh(new T.TorusGeometry(0.12,0.025,6,14), new T.MeshStandardMaterial({ color:0xB08D57, metalness:0.7, roughness:0.3 }));
        rim.position.set(side*0.17, eyeY+0.2, eyeZ+0.07); g.add(rim); });
    } else if (item.id === 'scarf'){
      const loop = new T.Mesh(new T.TorusGeometry(0.34,0.11,8,16), mat({roughness:0.95}));
      loop.rotation.x = Math.PI/2;
      loop.position.y = u.torsoCenterY + u.torsoH/2 + 0.04; g.add(loop);
      const tail = new T.Mesh(new T.BoxGeometry(0.18,0.5,0.09), mat({roughness:0.95}));
      tail.position.set(0.2, u.torsoCenterY + u.torsoH/2 - 0.22, u.torsoD/2+0.04);
      tail.rotation.z = 0.12; g.add(tail);
    }
  } else if (item.slot === 'top'){
    const overlay = new T.Mesh(new T.BoxGeometry(u.torsoW+0.06,u.torsoH+0.04,u.torsoD+0.06), mat({roughness:0.85}));
    overlay.position.y = u.torsoCenterY; g.add(overlay);
    if (item.id === 'hoodie'){
      const hood = new T.Mesh(new T.SphereGeometry(0.28,10,8,0,Math.PI*2,0,Math.PI*0.55), mat({roughness:0.9}));
      hood.position.set(0, u.headCenterY-u.headH*0.4, -u.headD/2-0.05);
      hood.rotation.x = Math.PI*0.15; g.add(hood);
    } else if (item.id === 'armortop'){
      [-1,1].forEach(side=>{
        const pad = new T.Mesh(new T.BoxGeometry(0.3,0.16,0.5), mat({metalness:0.6,roughness:0.3}));
        pad.position.set(side*(u.torsoW/2+0.08), u.torsoCenterY+u.torsoH/2-0.1, 0); g.add(pad);
      });
    } else if (item.id === 'leather'){
      const collar = new T.Mesh(new T.BoxGeometry(u.torsoW*0.7,0.12,u.torsoD+0.1), mat({roughness:0.6}));
      collar.position.y = u.torsoCenterY+u.torsoH/2+0.02; g.add(collar);
    } else if (item.id === 'vest'){
      // 전술 조끼 — 가슴 파우치와 어깨끈
      [-1,1].forEach(side=>{
        const strap = new T.Mesh(new T.BoxGeometry(0.16,u.torsoH+0.06,0.1),
          new T.MeshStandardMaterial({ color:0x2C3327, roughness:0.9 }));
        strap.position.set(side*0.3, u.torsoCenterY, u.torsoD/2+0.05); g.add(strap);
      });
      for (let i=0;i<2;i++){
        const pouch = new T.Mesh(new T.BoxGeometry(0.3,0.24,0.14),
          new T.MeshStandardMaterial({ color:0x3B4433, roughness:0.9 }));
        pouch.position.set((i?0.34:-0.34), u.torsoCenterY-0.18, u.torsoD/2+0.09); g.add(pouch);
      }
    } else if (item.id === 'tuxedo'){
      const shirt = new T.Mesh(new T.BoxGeometry(0.34,u.torsoH+0.05,0.02), new T.MeshStandardMaterial({ color:0xF5F5F5, roughness:0.7 }));
      shirt.position.set(0, u.torsoCenterY, u.torsoD/2+0.045); g.add(shirt);
      [-1,1].forEach(side=>{ const lapel = new T.Mesh(new T.BoxGeometry(0.14,0.5,0.02), mat({roughness:0.4}));
        lapel.position.set(side*0.2, u.torsoCenterY+0.3, u.torsoD/2+0.055); lapel.rotation.z = side*0.35; g.add(lapel); });
      const tie = new T.Mesh(new T.BoxGeometry(0.22,0.1,0.05), new T.MeshStandardMaterial({ color:0xB3122E }));
      tie.position.set(0, u.torsoCenterY+u.torsoH/2-0.1, u.torsoD/2+0.07); g.add(tie);
      for (let i=0;i<3;i++){ const b = new T.Mesh(new T.SphereGeometry(0.025,6,5), new T.MeshStandardMaterial({ color:0x111111 })); b.position.set(0, u.torsoCenterY+0.1-i*0.22, u.torsoD/2+0.06); g.add(b); }
    } else if (item.id === 'sweater'){
      const collar = new T.Mesh(new T.TorusGeometry(0.3,0.07,8,18), mat({roughness:0.95}));
      collar.rotation.x = Math.PI/2; collar.position.y = u.torsoCenterY+u.torsoH/2; g.add(collar);
      for (let i=0;i<2;i++){ const band = new T.Mesh(new T.BoxGeometry(u.torsoW+0.08,0.08,u.torsoD+0.08), new T.MeshStandardMaterial({ color:0xF2E6C8, roughness:0.95 }));
        band.position.y = u.torsoCenterY + 0.12 - i*0.2; g.add(band); }
    } else if (item.id === 'labcoat'){
      const skirt = new T.Mesh(new T.BoxGeometry(u.torsoW+0.12,0.7,u.torsoD+0.12), mat({roughness:0.92}));
      skirt.position.y = u.torsoCenterY - u.torsoH/2 - 0.28; g.add(skirt);
      const split = new T.Mesh(new T.BoxGeometry(0.05,0.72,0.04),
        new T.MeshStandardMaterial({ color:0xB9BEC2, roughness:0.9 }));
      split.position.set(0, u.torsoCenterY-u.torsoH/2-0.28, u.torsoD/2+0.09); g.add(split);
    } else if (item.id === 'stripes'){
      for (let i=0;i<3;i++){
        const band = new T.Mesh(new T.BoxGeometry(u.torsoW+0.09,0.17,u.torsoD+0.09),
          new T.MeshStandardMaterial({ color:0x2C3E80, roughness:0.85 }));
        band.position.y = u.torsoCenterY - 0.36 + i*0.36; g.add(band);
      }
    }
  } else if (item.slot === 'bottom'){
    if (item.id === 'skirt'){
      const sk = new T.Mesh(new T.CylinderGeometry(u.legW*0.75, u.legW*1.5, u.legH*0.62, 12), mat({roughness:0.9}));
      sk.position.y = u.legH - u.legH*0.31; g.add(sk);
    } else {
      const isShorts = item.id === 'shorts';
      const h = isShorts ? u.legH*0.55 : u.legH+0.04;
      [-1,1].forEach(side=>{
        const leg = new T.Mesh(new T.BoxGeometry(u.legW+0.05,h,u.legW+0.05), mat({roughness:0.85}));
        leg.position.set(side*u.legW/2, isShorts ? (u.legH-h/2) : u.legH/2, 0); g.add(leg);
      });
      if (item.id === 'cargo'){
        [-1,1].forEach(side=>{
          const pk = new T.Mesh(new T.BoxGeometry(0.16,0.24,0.1),
            new T.MeshStandardMaterial({ color:0x585739, roughness:0.9 }));
          pk.position.set(side*(u.legW+0.05), u.legH*0.5, 0); g.add(pk);
        });
      } else if (item.id === 'track'){
        [-1,1].forEach(side=>{
          const stripe = new T.Mesh(new T.BoxGeometry(0.05,h,0.05),
            new T.MeshStandardMaterial({ color:0xE8E8E8, roughness:0.8 }));
          stripe.position.set(side*(u.legW*0.5+u.legW*0.5+0.03), u.legH/2, 0); g.add(stripe);
        });
      }
    }
  } else if (item.slot === 'back'){
    if (item.id === 'backpack'){
      const bp = new T.Mesh(new T.BoxGeometry(u.torsoW*0.7,u.torsoH*0.65,0.28), mat({roughness:0.8}));
      bp.position.set(0, u.torsoCenterY, -u.torsoD/2-0.16); g.add(bp);
    } else if (item.id === 'wings'){
      [-1,1].forEach(side=>{
        const wing = new T.Mesh(new T.ConeGeometry(0.16,0.7,4), mat({roughness:0.6,metalness:0.15}));
        wing.position.set(side*0.28, u.torsoCenterY+0.15, -u.torsoD/2-0.05);
        wing.rotation.z = side*1.0; wing.rotation.x = 0.3;
        g.add(wing);
      });
    } else if (item.id === 'jetpack'){
      [-1,1].forEach(side=>{
        const tank = new T.Mesh(new T.CylinderGeometry(0.16,0.16,u.torsoH*0.8,10), mat({metalness:0.55,roughness:0.35}));
        tank.position.set(side*0.22, u.torsoCenterY, -u.torsoD/2-0.2); g.add(tank);
        const nozzle = new T.Mesh(new T.ConeGeometry(0.13,0.18,8),
          new T.MeshStandardMaterial({ color:0x3A3F44, metalness:0.6, roughness:0.3 }));
        nozzle.rotation.x = Math.PI;
        nozzle.position.set(side*0.22, u.torsoCenterY-u.torsoH*0.48, -u.torsoD/2-0.2); g.add(nozzle);
      });
    } else if (item.id === 'cape'){
      const cape = new T.Mesh(new T.BoxGeometry(u.torsoW+0.14, u.torsoH+u.legH*0.7, 0.07), mat({roughness:0.95}));
      cape.position.set(0, u.torsoCenterY-u.legH*0.3, -u.torsoD/2-0.1);
      cape.rotation.x = -0.07; g.add(cape);
      const collar = new T.Mesh(new T.BoxGeometry(u.torsoW*0.8,0.13,0.16), mat({roughness:0.9}));
      collar.position.set(0, u.torsoCenterY+u.torsoH/2, -u.torsoD/2-0.06); g.add(collar);
    } else if (item.id === 'guitar'){
      const bodyG = new T.Group(); bodyG.position.set(0, u.torsoCenterY-0.15, -u.torsoD/2-0.14); bodyG.rotation.z = 0.6;
      const b1 = new T.Mesh(new T.CylinderGeometry(0.3,0.3,0.1,16), mat({roughness:0.35})); b1.rotation.x = Math.PI/2; b1.position.y = -0.2; bodyG.add(b1);
      const b2 = new T.Mesh(new T.CylinderGeometry(0.22,0.22,0.1,16), mat({roughness:0.35})); b2.rotation.x = Math.PI/2; b2.position.y = 0.1; bodyG.add(b2);
      const neck = new T.Mesh(new T.BoxGeometry(0.08,0.8,0.05), new T.MeshStandardMaterial({ color:0x5A3A1E })); neck.position.y = 0.6; bodyG.add(neck);
      const headG = new T.Mesh(new T.BoxGeometry(0.12,0.16,0.05), new T.MeshStandardMaterial({ color:0x1E1E1E })); headG.position.y = 1.06; bodyG.add(headG);
      g.add(bodyG);
      const strap = new T.Mesh(new T.BoxGeometry(0.06,u.torsoH*1.3,0.03), new T.MeshStandardMaterial({ color:0x222222 }));
      strap.position.set(0, u.torsoCenterY, u.torsoD/2+0.04); strap.rotation.z = 0.6; g.add(strap);
    } else if (item.id === 'angelwings'){
      [-1,1].forEach(side=>{
        for (let i=0;i<4;i++){ const f = new T.Mesh(new T.SphereGeometry(0.22,10,8), mat({ roughness:0.9, emissive:col, emissiveIntensity:0.15 }));
          f.scale.set(1.9-i*0.3, 0.45, 0.25); f.position.set(side*(0.45+i*0.12), u.torsoCenterY+0.35-i*0.2, -u.torsoD/2-0.12); f.rotation.z = side*(0.5+i*0.12); g.add(f); }
      });
    } else if (item.id === 'shield'){
      const sh = new T.Mesh(new T.CylinderGeometry(0.5,0.5,0.08,20), mat({metalness:0.35,roughness:0.45}));
      sh.rotation.x = Math.PI/2; sh.position.set(0, u.torsoCenterY, -u.torsoD/2-0.1); g.add(sh);
      const rim = new T.Mesh(new T.TorusGeometry(0.5,0.045,8,24), new T.MeshStandardMaterial({ color:0xC9A227, metalness:0.8, roughness:0.3 }));
      rim.position.set(0, u.torsoCenterY, -u.torsoD/2-0.1); g.add(rim);
      const boss = new T.Mesh(new T.SphereGeometry(0.11,10,8), new T.MeshStandardMaterial({ color:0xC9A227, metalness:0.8, roughness:0.3 }));
      boss.position.set(0, u.torsoCenterY, -u.torsoD/2-0.16); g.add(boss);
      const crossV = new T.Mesh(new T.BoxGeometry(0.1,0.8,0.02), new T.MeshStandardMaterial({ color:0xF2F2F2 })); crossV.position.set(0, u.torsoCenterY, -u.torsoD/2-0.145); g.add(crossV);
      const crossH = new T.Mesh(new T.BoxGeometry(0.8,0.1,0.02), new T.MeshStandardMaterial({ color:0xF2F2F2 })); crossH.position.set(0, u.torsoCenterY, -u.torsoD/2-0.145); g.add(crossH);
    } else if (item.id === 'katana'){
      const sheath = new T.Mesh(new T.BoxGeometry(0.09,1.25,0.09),
        new T.MeshStandardMaterial({ color:0x22262A, roughness:0.8 }));
      sheath.position.set(0, u.torsoCenterY, -u.torsoD/2-0.14);
      sheath.rotation.z = 0.5; g.add(sheath);
      const hilt = new T.Mesh(new T.BoxGeometry(0.07,0.3,0.07), mat({metalness:0.5,roughness:0.4}));
      hilt.position.set(-0.33, u.torsoCenterY+0.62, -u.torsoD/2-0.14);
      hilt.rotation.z = 0.5; g.add(hilt);
    }
  }
  g.userData.slot = item.slot;
  avatarGroup.add(g);
  return g;
}

// loadout: { head, acc, top, bottom, back } (각 값은 AVATAR_CATALOG의 id 또는 null)
function mpBuildAvatar(loadout){
  const lo = loadout || {};
  // 색과 얼굴은 몸을 지을 때 바로 반영한다(부착물이 아니라 몸 자체의 성질이라서).
  const group = mpBuildR6Avatar({ skin:lo.skin, shirt:lo.shirt, pants:lo.pants, face:lo.face });
  AVATAR_SLOTS.forEach(slot=>{
    if (slot === 'face') return;   // 얼굴은 위에서 처리됨
    const equippedId = lo[slot];
    if (equippedId){
      const item = AVATAR_CATALOG.find(it=>it.id===equippedId);
      if (item) mpAttachAvatarItem(group, item);
    }
  });
  try { emoRegister(group, loadout); } catch (e) {}
  return group;
}

// ---- 진짜 3D 아바타 사진 ----
// 게임 속과 똑같은 3D 아바타를 화면 밖에서 한 번 찍어서 사진(dataURL)으로 쓴다.
//   'head' 얼굴 사진(어깨~모자) · 'full' 전신 · 'item:<id>' 아이템만
let snapR = null, snapScene = null, snapCam = null, snapFail = false;
const snapCache = {}; let snapKeys = [];
function mpSnapSetup(){
  const T = window.THREE; if (!T || snapFail) return false; if (snapR) return true;
  try {
    const c = document.createElement('canvas');
    snapR = new T.WebGLRenderer({ canvas:c, antialias:true, alpha:true, preserveDrawingBuffer:true });
    snapR.setPixelRatio(1); if (T.sRGBEncoding !== undefined && 'outputEncoding' in snapR) snapR.outputEncoding = T.sRGBEncoding;
    snapScene = new T.Scene();
    snapScene.add(new T.HemisphereLight(0xffffff, 0x5a5a66, 0.95));
    const key = new T.DirectionalLight(0xffffff, 0.9); key.position.set(3, 6, 6); snapScene.add(key);
    const rim = new T.DirectionalLight(0xcfe0ff, 0.45); rim.position.set(-5, 3, -4); snapScene.add(rim);
    snapCam = new T.PerspectiveCamera(30, 1, 0.1, 60);
    return true;
  } catch (e) { snapFail = true; snapR = null; return false; }
}
function mpDisposeGroup(g){ g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material){ (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map && !m.map.image) m.map.dispose(); m.dispose(); }); } }); }
function mpFrame(box, W, H, pad, yaw){
  const T = window.THREE; const c = new T.Vector3(), sz = new T.Vector3(); box.getCenter(c); box.getSize(sz);
  const fov = T.MathUtils.degToRad(snapCam.fov), aspect = W / H;
  const needH = sz.y * pad, needW = Math.max(sz.x, sz.z) * pad;
  const dist = Math.max(needH / 2 / Math.tan(fov / 2), needW / 2 / (Math.tan(fov / 2) * aspect)) + Math.max(sz.x, sz.z) / 2;
  snapCam.position.set(c.x + Math.sin(yaw) * dist, c.y + sz.y * 0.06, c.z + Math.cos(yaw) * dist); snapCam.lookAt(c);
}
function mpAvatarShot(loadout, mode){
  const lo = Object.assign(mpDefaultLoadout(), loadout || {});
  mode = mode || 'head';
  const key = mode + '|' + JSON.stringify(lo);
  if (snapCache[key]) return snapCache[key];
  if (!mpSnapSetup()) return mode === 'head' ? mpHeadshot(lo) : null;
  const T = window.THREE;
  let url = null, g = null;
  try {
    const isItem = mode.indexOf('item:') === 0;
    const W = mode === 'full' ? 360 : 200, H = mode === 'full' ? 440 : 200;
    snapR.setSize(W, H, false); snapCam.aspect = W / H; snapCam.updateProjectionMatrix();
    if (isItem){
      const item = AVATAR_CATALOG.find(i => i.id === mode.slice(5)); if (!item) return null;
      g = mpBuildR6Avatar({ skin:lo.skin, shirt:lo.shirt, pants:lo.pants });
      const n = g.children.length; mpAttachAvatarItem(g, item);
      g.updateMatrixWorld(true);
      const box = new T.Box3(); g.children.slice(n).forEach(ch => box.expandByObject(ch));
      if (box.isEmpty()) { g.children.slice(0, n).forEach(ch => box.expandByObject(ch)); }
      else g.children.slice(0, n).forEach(ch => { ch.visible = false; });
      snapScene.add(g); mpFrame(box, W, H, 1.25, item.slot === 'back' ? Math.PI + 0.5 : 0.5);
    } else {
      g = mpBuildAvatar(lo); snapScene.add(g); g.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(g); const u = g.userData;
      if (mode === 'head'){
        const bottom = u.legTopY + u.torsoH * 0.45, top = Math.min(box.max.y, u.headCenterY + u.headH * 2.4);
        const hb = new T.Box3(new T.Vector3(-u.torsoW * 0.62, bottom, -u.headD), new T.Vector3(u.torsoW * 0.62, top, u.headD));
        mpFrame(hb, W, H, 1.08, -0.28);
      } else mpFrame(box, W, H, 1.1, -0.38);
    }
    snapR.render(snapScene, snapCam);
    url = snapR.domElement.toDataURL('image/png');
  } catch (e) { url = mode === 'head' ? mpHeadshot(lo) : null; }
  if (g){ snapScene.remove(g); mpDisposeGroup(g); }
  if (url){ snapCache[key] = url; snapKeys.push(key); if (snapKeys.length > 80){ delete snapCache[snapKeys.shift()]; } }
  return url;
}


// ================= 이모트 (마켓플레이스에서 사서 모든 게임에서 사용) =================
// 아바타 그룹(mpBuildAvatar로 만든 것)을 기억해 두었다가, 렌더 직전에 이모트 자세를 입히고 렌더 직후 원래대로 돌려놓는다.
// 그래서 게임마다 따로 애니메이션 코드를 고치지 않아도 모든 게임에서 똑같이 춤춘다.
const EMO_S = Math.sin, EMO_C = Math.cos;
const EMOTES = [
  { id:'emote_wave',   name:'손 흔들기', icon:'👋', price:0, dur:2.6, alias:['wave','hi','손','안녕'], pose:t=>({ armR:[0, 0, 2.7 + EMO_S(t*11)*.35], head:[0, 0, -.12] }) },
  { id:'emote_point',  name:'가리키기', icon:'👉', price:0, dur:2.4, alias:['point','가리키기'], pose:t=>({ armR:[-1.55, 0, 0], head:[.05, 0, 0] }) },
  { id:'emote_cheer',  name:'환호', icon:'🙌', price:0, dur:2.8, alias:['cheer','환호','만세'], pose:t=>{ const k = Math.abs(EMO_S(t*8)); return { armL:[-2.9 - k*.2, 0, -.25], armR:[-2.9 - k*.2, 0, .25], dy:k*.35, head:[-.25, 0, 0] }; } },
  { id:'emote_laugh',  name:'웃기', icon:'😂', price:0, dur:2.8, alias:['laugh','웃기','ㅋㅋ'], pose:t=>({ head:[-.35 + EMO_S(t*26)*.1, 0, 0], armL:[-.5, 0, .45], armR:[-.5, 0, -.45], dy:Math.abs(EMO_S(t*13))*.08, rx:-.12 }) },
  { id:'emote_dance',  name:'기본 춤', icon:'🕺', price:0, dur:0, alias:['dance','dance1','춤','기본춤'], pose:t=>{ const b = t*7; return { armL:[-1.2 + EMO_S(b)*1.2, 0, -.3], armR:[-1.2 - EMO_S(b)*1.2, 0, .3], legL:[EMO_S(b)*.45, 0, 0], legR:[-EMO_S(b)*.45, 0, 0], dy:Math.abs(EMO_S(b))*.25, ry:EMO_S(t*1.75)*.5, head:[0, EMO_S(b)*.2, 0] }; } },
  { id:'emote_clap',   name:'박수', icon:'👏', price:80, rar:'c', dur:2.6, alias:['clap','박수'], pose:t=>{ const k = (EMO_S(t*16) + 1)/2; return { armL:[-1.35, 0, -.1 - k*.45], armR:[-1.35, 0, .1 + k*.45] }; } },
  { id:'emote_salute', name:'경례', icon:'🫡', price:90, rar:'c', dur:2.6, alias:['salute','경례'], pose:t=>({ armR:[-2.35, 0, -.6], head:[-.08, 0, 0] }) },
  { id:'emote_shrug',  name:'으쓱', icon:'🤷', price:70, rar:'c', dur:2.2, alias:['shrug','으쓱'], pose:t=>{ const k = Math.min(1, t*4); return { armL:[-.3*k, 0, -.7*k], armR:[-.3*k, 0, .7*k], head:[0, 0, .2*k], dy:.06*k }; } },
  { id:'emote_sit',    name:'앉기', icon:'🪑', price:60, rar:'c', dur:0, alias:['sit','앉기'], pose:t=>({ legL:[-1.5, 0, -.05], legR:[-1.5, 0, .05], armL:[-.35, 0, -.1], armR:[-.35, 0, .1], sit:true }) },
  { id:'emote_bow',    name:'인사', icon:'🙇', price:90, rar:'c', dur:2.4, alias:['bow','인사'], pose:t=>{ const k = Math.min(1, t*3)*(t > 1.7 ? Math.max(0, 1 - (t - 1.7)*3) : 1); return { rx:.7*k, armL:[.15*k, 0, 0], armR:[.15*k, 0, 0] }; } },
  { id:'emote_spin',   name:'빙글빙글', icon:'🌀', price:200, rar:'r', dur:2.6, alias:['spin','빙글'], pose:t=>({ ry:t*9, armL:[0, 0, -1.55], armR:[0, 0, 1.55], dy:Math.abs(EMO_S(t*5))*.2 }) },
  { id:'emote_jacks',  name:'팔벌려뛰기', icon:'🤸', price:220, rar:'r', dur:0, alias:['jacks','팔벌려뛰기','점핑잭'], pose:t=>{ const k = (1 - EMO_C(t*8))/2; return { armL:[0, 0, -2.9*k], armR:[0, 0, 2.9*k], legL:[0, 0, -.35*k], legR:[0, 0, .35*k], dy:k*.4 }; } },
  { id:'emote_dance2', name:'스윙 춤', icon:'💃', price:250, rar:'r', dur:0, alias:['dance2','스윙'], pose:t=>{ const b = t*5; return { ry:EMO_S(b)*.7, armL:[-.6, 0, -1.1 - EMO_S(b)*.6], armR:[-.6, 0, 1.1 - EMO_S(b)*.6], legL:[0, 0, EMO_S(b)*.2], legR:[0, 0, EMO_S(b)*.2], dy:Math.abs(EMO_C(b))*.15, head:[0, -EMO_S(b)*.4, 0] }; } },
  { id:'emote_tpose',  name:'T 포즈', icon:'✝️', price:300, rar:'r', dur:0, alias:['tpose','t포즈','티포즈'], pose:t=>({ armL:[0, 0, -1.57], armR:[0, 0, 1.57] }) },
  { id:'emote_headbang', name:'헤드뱅잉', icon:'🤘', price:400, rar:'e', dur:0, alias:['headbang','헤드뱅잉','락'], pose:t=>({ head:[.35 + EMO_S(t*18)*.35, 0, 0], armR:[-2.8, 0, .3], armL:[-.8 + EMO_S(t*18)*.15, 0, -.2], rx:.12 + EMO_S(t*18)*.06 }) },
  { id:'emote_robot',  name:'로봇 춤', icon:'🤖', price:500, rar:'e', dur:0, alias:['robot','dance3','로봇'], pose:t=>{ const st = Math.floor(t*2.2) % 4; const P = [[-1.57, 0, 0, 0, 0, 1.57], [0, 0, -1.57, -1.57, 0, 0], [-3, 0, 0, -1.57, 0, 0], [-1.57, 0, -.3, -1.57, 0, .3]][st]; return { armL:P.slice(0, 3), armR:P.slice(3), ry:[0, .5, 0, -.5][st], head:[0, [0, -.4, 0, .4][st], 0] }; } },
  { id:'emote_floss',  name:'플로스', icon:'🧵', price:700, rar:'e', dur:0, alias:['floss','플로스'], pose:t=>{ const k = EMO_S(t*10); return { armL:[k > 0 ? .5 : -.5, 0, -.25 + k*.55], armR:[k > 0 ? -.5 : .5, 0, .25 + k*.55], ry:-k*.15, legL:[0, 0, -k*.12], legR:[0, 0, -k*.12] }; } },
  { id:'emote_break',  name:'브레이크 댄스', icon:'🔥', price:1200, rar:'l', dur:0, alias:['break','breakdance','브레이크'], pose:t=>{ const ph = t % 4;
      if (ph < 1.5) return { ry:ph*10, armL:[0, 0, -1.6], armR:[0, 0, 1.6], legL:[-.5, 0, -.3], legR:[.5, 0, .3], dy:-.35 };
      if (ph < 2.5){ const k = ph - 1.5; return { armL:[-3, 0, 0], armR:[-3, 0, 0], legL:[EMO_S(k*20)*.6, 0, 0], legR:[-EMO_S(k*20)*.6, 0, 0], dy:Math.abs(EMO_S(k*6))*.6 }; }
      return { armL:[-1.2 + EMO_S(t*12), 0, -.3], armR:[-1.2 - EMO_S(t*12), 0, .3], dy:Math.abs(EMO_S(t*12))*.2, ry:EMO_S(t*3) }; } },
];
const EMOTE_MAP = {}; EMOTES.forEach(e=>{ EMOTE_MAP[e.id] = e; });
function emoFind(q){ q = String(q || '').trim().toLowerCase().replace(/\s+/g, ''); if (!q) return null; if (EMOTE_MAP[q]) return EMOTE_MAP[q]; if (EMOTE_MAP['emote_' + q]) return EMOTE_MAP['emote_' + q];
  return EMOTES.find(e=>e.alias.indexOf(q) >= 0 || e.name.replace(/\s+/g, '') === q) || null; }
// 상태: self = 내 이모트, remote[uid] = 남의 이모트 { id, t(서버시각), x, z }
const EMO = { groups:new Set(), loUid:new WeakMap(), self:null, remote:{}, pos:{}, selfPos:null, now:()=>Date.now(), installed:false };
function emoRegister(g, lo){ EMO.groups.add(g); if (lo && typeof lo === 'object' && EMO.loUid.has(lo)) g.userData.uid = EMO.loUid.get(lo); emoInstall(); }
// three.js 의 렌더러는 render 를 인스턴스마다 따로 갖고 있어서, 만들어지는 렌더러를 감싸 준다.
// (모듈 버전 three 처럼 감쌀 수 없는 경우엔 게임이 MP.hookRenderer(renderer) 를 한 번 불러 준다)
function emoHook(r){ if (!r || r.__emo || typeof r.render !== 'function') return r; r.__emo = true; const orig = r.render;
  r.render = function(scene, cam){ let undo = null; try { undo = emoApply(scene); } catch(e){ undo = null; } try { return orig.call(this, scene, cam); } finally { if (undo) emoRestore(undo); } }; return r; }
function emoInstall(){ const T = window.THREE; if (EMO.installed || !T || !T.WebGLRenderer) return; EMO.installed = true;
  try { const Orig = T.WebGLRenderer; if (Orig.__emoWrapped) return; const W = function(params){ return emoHook(new Orig(params)); }; W.prototype = Orig.prototype; W.__emoWrapped = true; Object.keys(Orig).forEach(k=>{ try { W[k] = Orig[k]; } catch(e){} }); T.WebGLRenderer = W; } catch(e){} }
try { emoInstall(); } catch(e){}
function emoRoot(o){ while (o.parent) o = o.parent; return o; }
function emoActive(){ const out = {}; const now = EMO.now();
  if (EMO.self){ const e = EMOTE_MAP[EMO.self.id]; const t = (now - EMO.self.t)/1000; if (e && (!e.dur || t < e.dur)) out.self = { e, t }; else EMO.self = null; }
  for (const u in EMO.remote){ const r = EMO.remote[u]; const e = r && EMOTE_MAP[r.id]; if (!e) continue; const t = (now - r.t)/1000; if (t < -1 || (e.dur && t > e.dur) || t > 300) continue; out[u] = { e, t:Math.max(0, t) }; }
  return out; }
let emoLastClean = 0;
function emoApply(scene){ if (!scene || !EMO.groups.size) return null; const now = Date.now();
  if (now - emoLastClean > 3000){ emoLastClean = now; for (const g of EMO.groups){ if (!emoRoot(g).isScene){ g.userData._off = (g.userData._off || 0) + 1; if (g.userData._off > 3) EMO.groups.delete(g); } else g.userData._off = 0; } }
  const act = emoActive(); const keys = Object.keys(act); let any = keys.length > 0;
  const gs = []; for (const g of EMO.groups){ if (g.userData.emote) any = true; } if (!any) return null;
  for (const g of EMO.groups) if (g.visible !== false && emoRoot(g) === scene) gs.push(g); if (!gs.length) return null;
  const undo = [], used = new Set();
  // 1) 미리보기(허브 마켓) 그룹
  for (const g of gs){ const pv = g.userData.emote; if (!pv) continue; const e = EMOTE_MAP[pv.id]; if (!e) continue; let t = (now - pv.t0)/1000; if (e.dur) t = t % (e.dur + .6); emoPose(g, e, t, undo); used.add(g); }
  // 2) uid로 표시된 그룹 → 없으면 가까운 위치의 표시 안 된 그룹
  for (const u of keys){ let hit = gs.filter(g=>!used.has(g) && g.userData.uid === u);
    if (!hit.length){ const p = u === 'self' ? EMO.selfPos : EMO.pos[u]; if (p){ let best = null, bd = 1.3; const v = new window.THREE.Vector3();
        for (const g of gs){ if (used.has(g) || g.userData.uid) continue; g.getWorldPosition(v); const d = Math.hypot(v.x - p[0], v.z - p[1]); if (d < bd){ bd = d; best = g; } } if (best) hit = [best]; } }
    if (u === 'self' && hit.length && EMO.self){ const v = new window.THREE.Vector3(); hit[0].getWorldPosition(v); if (!EMO.self.gp) EMO.self.gp = [v.x, v.z]; else if (Math.hypot(v.x - EMO.self.gp[0], v.z - EMO.self.gp[1]) > .9){ if (EMO.onSelfStop) EMO.onSelfStop(); continue; } }
    for (const g of hit){ emoPose(g, act[u].e, act[u].t, undo); used.add(g); } }
  return undo.length ? undo : null; }
function emoRestore(undo){ for (let i = undo.length - 1; i >= 0; i--){ const [o, rx, ry, rz, pos, ord] = undo[i]; if (ord) o.rotation.order = ord; o.rotation.set(rx, ry, rz); if (pos) o.position.copy(pos); } }
function emoPose(g, e, t, undo){ const P = g.userData.parts, u = g.userData; if (!P) return; const q = e.pose(t) || {}; const T = window.THREE;
  const save = (o, withPos)=>undo.push([o, o.rotation.x, o.rotation.y, o.rotation.z, withPos ? o.position.clone() : null, o.rotation.order]);
  // 팔다리: 피벗(게임이 감싼 그룹)이 있으면 그걸 돌리고, 없으면 윗부분을 축으로 메쉬를 직접 돌린다
  const limb = (m, rot, hTop)=>{ if (!m || !rot) return; const piv = (m.parent && m.parent !== g) ? m.parent : null;
    if (piv){ save(piv, false); piv.rotation.set(rot[0], rot[1], rot[2]); return; }
    save(m, true); const top = new T.Vector3(m.position.x, m.position.y + hTop, m.position.z); m.rotation.set(rot[0], rot[1], rot[2]); const off = new T.Vector3(0, -hTop, 0).applyEuler(m.rotation); m.position.copy(top).add(off); };
  const lh = (u.legH || 1.24)/2;
  limb(P.armL, q.armL, lh); limb(P.armR, q.armR, lh); limb(P.legL, q.legL, lh); limb(P.legR, q.legR, lh);
  if (q.head && P.head){ const hh = (u.headH || .62)/2, neck = new T.Vector3(0, P.head.position.y - hh, 0); const eu = new T.Euler(q.head[0], q.head[1], q.head[2]);
    const turn = o=>{ save(o, true); const base = o === P.head ? new T.Vector3(o.position.x, o.position.y, o.position.z) : o.position.clone(); const rel = base.clone().sub(neck); o.rotation.set(o.rotation.x + eu.x, o.rotation.y + eu.y, o.rotation.z + eu.z); if (o === P.head){ o.position.copy(neck).add(new T.Vector3(0, hh, 0).applyEuler(eu)); } else { o.position.copy(neck).add(rel.applyEuler(eu)).sub(new T.Vector3(0, 0, 0)); } };
    turn(P.head); for (const c of g.children) if (c.userData && (c.userData.slot === 'head' || c.userData.slot === 'acc')) turn(c); }
  const sc = g.scale.y || 1; let dy = q.dy || 0; if (q.sit) dy -= (u.legH || 1.24)*.92;
  if (dy || q.ry || q.rx){ save(g, true); g.position.y += dy*sc; if (q.rx){ g.rotation.order = 'YXZ'; g.rotation.x += q.rx; } if (q.ry) g.rotation.y += q.ry; } }

const MP = (function () {
  let app = null, auth = null, db = null;
  let uid = null;
  let myRef = null, playersRef = null;
  let presenceStaleTimer = null;
  let onPlayersCb = null;
  let onAuthCb = null;
  let ready = false;          // 멀티플레이(방 접속)까지 준비됐는지
  let authReady = false;      // 로그인 상태 파악이 됐는지 (익명 포함)
  let currentRoom = null;
  let roomMode = false;       // init()으로 방 접속 모드까지 켰는지
  let firstCallback = null;
  let firstCallbackFired = false;
  let myAvatarLoadout = null; // 캐시 (로컬스토리지와 동기화됨)

  function isConfigured() {
    return FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY";
  }

  function ensureApp() {
    if (app) return;
    app = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.database();
    // 기기 시계가 틀려도(몇 분씩 어긋난 PC/폰 흔함) 모두 같은 시간을 보게 서버 시계 기준으로 맞춘다
    try { db.ref('.info/serverTimeOffset').on('value', snap => { serverOffset = snap.val() || 0; }); } catch (e) {}
    // 연결이 잠깐 끊겼다 붙으면(폰에서 흔함) 서버가 onDisconnect를 이미 써버려서, 그 뒤로는
    // 진짜로 나가도 아무것도 안 지워진다 → "나갔는데 들어와 있다" 유령이 생김.
    // 다시 연결될 때마다 onDisconnect를 새로 걸고, 내 상태도 다시 써 준다.
    try {
      db.ref('.info/connected').on('value', snap => {
        if (snap.val() !== true) return;
        if (myRef) { try { myRef.onDisconnect().remove(); } catch (e) {} }
        if (presenceRef) {
          try {
            presenceRef.onDisconnect().update({ online:false, game:null, room:null, ts: firebase.database.ServerValue.TIMESTAMP });
            if (!document.hidden) presenceRef.update({ online:true, game: presenceGame, room: presenceRoom, ts: firebase.database.ServerValue.TIMESTAMP });
          } catch (e) {}
        }
      });
    } catch (e) {}
    // 탭 닫기/뒤로가기/다른 게임으로 이동: 서버가 끊김을 알아챌 때까지 기다리지 말고 바로 지운다
    const leaveNow = () => {
      try { if (myRef) myRef.remove(); } catch (e) {}
      try { if (presenceRef) presenceRef.update({ online:false, game:null, room:null, ts: firebase.database.ServerValue.TIMESTAMP }); } catch (e) {}
    };
    window.addEventListener('pagehide', leaveNow);
    // 뒤로가기 캐시에서 되살아나면 다시 들어온 것으로
    window.addEventListener('pageshow', e => {
      if (!e.persisted) return;
      try { if (presenceRef) presenceRef.update({ online:true, game: presenceGame, room: presenceRoom, ts: firebase.database.ServerValue.TIMESTAMP }); } catch (e2) {}
    });
  }
  let serverOffset = 0;
  function serverNow() { return Date.now() + serverOffset; }
  EMO.now = serverNow;

  function getRoomFromURL() {
    try {
      const p = new URLSearchParams(window.location.search);
      return (p.get('room') || 'public').trim().toUpperCase().slice(0, 12) || 'PUBLIC';
    } catch (e) {
      return 'PUBLIC';
    }
  }

  let accountName = null;
  function getNickname() {
    let n = localStorage.getItem('mp_nickname');
    if (!n) {
      n = '플레이어' + Math.floor(1000 + Math.random() * 9000);
      localStorage.setItem('mp_nickname', n);
    }
    return n;
  }
  // 표시 이름(닉네임)을 바꾼다. 계정 이름(가입할 때 정한 이름)은 절대 건드리지 않는다.
  // 예전엔 localStorage에만 저장해서 DB의 검색용 필드가 갱신되지 않았고,
  // 그 결과 이름을 바꾸면 친구 검색에 안 잡히는 문제가 있었다.
  function setNickname(n, cb) {
    if (!n) { cb && cb(false); return; }
    n = n.trim().slice(0, 12);
    if (!n) { cb && cb(false); return; }
    const prevName = getDisplayName();
    localStorage.setItem('mp_nickname', n);
    // 로그인 프로필에도 반영(다른 기기에서도 같은 표시 이름이 보이도록)
    if (auth && auth.currentUser) { try { auth.currentUser.updateProfile({ displayName: n }); } catch (e) {} }
    // 방에 접속 중이면 즉시 다른 플레이어에게도 반영
    if (myRef) { try { myRef.update({ name: n }); } catch (e) {} }
    // DB의 검색용 필드까지 갱신해야 바뀐 이름으로도 친구 검색이 된다
    if (isConfigured() && db && uid) {
      const uref = db.ref(`${MP_ROOT}/users/${uid}`);
      // 바꾸기 전 이름은 프로필에 "이전 이름"으로 남긴다 (최근 5개)
      uref.child('nameHistory').once('value').then(hs => {
        let h = hs.val(); h = Array.isArray(h) ? h : [];
        if (prevName && prevName !== n) h = [prevName].concat(h.filter(v => v !== prevName && v !== n)).slice(0, 5);
        return uref.update({ displayName: n, displayNameLower: n.toLowerCase(), nameHistory: h });
      }).then(() => cb && cb(true)).catch(() => cb && cb(false));
    } else cb && cb(true);
  }
  // 계정 이름 — 가입할 때 정한 이름. 변경 불가(신원 식별용).
  function getAccountName() { return accountName || null; }
  function getDisplayName() {
    const local = localStorage.getItem('mp_nickname');
    if (local) return local;
    if (auth && auth.currentUser && auth.currentUser.displayName) return auth.currentUser.displayName;
    return getNickname();
  }
  // 로그인/익명 로그인 직후 users 레코드를 보장한다.
  // 예전엔 회원가입할 때만 이 레코드를 만들어서, 그 외 경로로 들어온 계정은
  // 친구 검색에 아예 안 잡혔다.
  function ensureUserRecord() {
    if (!isConfigured() || !db || !uid) return;
    const ref = db.ref(`${MP_ROOT}/users/${uid}`);
    ref.once('value').then(snap => {
      const cur = snap.val() || {};
      accountName = cur.nickname || null;
      // 계정에 이미 표시 이름이 있으면 그게 맞다(이름을 바꿀 땐 setNickname이 DB에 바로 쓴다).
      // 예전엔 이 기기의 이름(새 기기면 무작위 '플레이어1234')으로 계정 이름을 덮어써서
      // 다른 기기에서 로그인하면 계정이 '초기화'된 것처럼 보였다.
      if (cur.displayName) { try { localStorage.setItem('mp_nickname', cur.displayName); } catch (e) {} }
      const disp = cur.displayName || getDisplayName();
      const patch = { displayName: disp, displayNameLower: (disp || '').toLowerCase() };
      // 계정 이름이 아직 없으면(=이 계정의 최초 기록) 지금 이름으로 한 번만 고정한다
      if (!cur.nickname) {
        patch.nickname = disp;
        patch.nicknameLower = (disp || '').toLowerCase();
        accountName = disp;
      }
      if (!cur.createdAt) patch.createdAt = firebase.database.ServerValue.TIMESTAMP;
      ref.update(patch).catch(() => {});
      // 랭킹: 접속할 때 내 계정 레벨 기록을 한 번 올려둔다 (기존 유저도 순위표에 뜨게)
      try { const xp = getLocalXP() || 0; if (xp > 0) submitScore('level', xp, 'desc', { level: levelFromXP(xp).level }); } catch (e) {}
      try { window.dispatchEvent(new Event('mp-account-ready')); } catch (e) {}
    }).catch(() => {});
  }

  // ---------- 보유 아이템 (마켓플레이스에서 산 것들) ----------
  // 로컬에 바로 저장하고, 로그인 상태면 계정(users/{uid}/ownedItems)에도 올려서 다른 기기에서도 유지된다.
  function getOwnedItems() {
    try { return JSON.parse(localStorage.getItem('mp_owned_items') || '[]') || []; } catch (e) { return []; }
  }
  function isOwned(id) { return getOwnedItems().indexOf(id) >= 0; }
  function addOwnedItem(id) {
    const list = getOwnedItems();
    if (list.indexOf(id) < 0) { list.push(id); try { localStorage.setItem('mp_owned_items', JSON.stringify(list)); } catch (e) {} }
    if (isConfigured() && db && uid) { db.ref(`${MP_ROOT}/users/${uid}/ownedItems/${id}`).set(true).catch(() => {}); }
    return list;
  }
  function fetchAccountOwnedItems(cb) {
    if (!isConfigured() || !db || !uid) { cb && cb(getOwnedItems()); return; }
    db.ref(`${MP_ROOT}/users/${uid}/ownedItems`).once('value').then(snap => {
      const remote = Object.keys(snap.val() || {});
      const local = getOwnedItems();
      const merged = local.slice(); remote.forEach(id => { if (merged.indexOf(id) < 0) merged.push(id); });
      try { localStorage.setItem('mp_owned_items', JSON.stringify(merged)); } catch (e) {}
      // 이 기기에만 있던 것도 계정으로 올린다
      local.forEach(id => { if (remote.indexOf(id) < 0) db.ref(`${MP_ROOT}/users/${uid}/ownedItems/${id}`).set(true).catch(() => {}); });
      cb && cb(merged);
    }).catch(() => cb && cb(getOwnedItems()));
  }

  // ---------- 아바타 꾸미기 (로컬 캐시 + 계정에 영구 저장, 방에 있으면 즉시 다른 플레이어에게도 반영) ----------
  function getLocalAvatarLoadout() {
    if (myAvatarLoadout){ EMO.loUid.set(myAvatarLoadout, 'self'); return myAvatarLoadout; }
    try {
      const raw = localStorage.getItem('mp_avatar_loadout');
      // 예전 저장본에는 face/색상 항목이 없다 — 기본값과 합쳐서 올려준다
      if (raw) { myAvatarLoadout = Object.assign(mpDefaultLoadout(), JSON.parse(raw)); EMO.loUid.set(myAvatarLoadout, 'self'); return myAvatarLoadout; }
    } catch (e) {}
    myAvatarLoadout = mpDefaultLoadout(); EMO.loUid.set(myAvatarLoadout, 'self');
    return myAvatarLoadout;
  }
  function setAvatarLoadout(loadout, cb) {
    myAvatarLoadout = loadout; if (loadout && typeof loadout === 'object') EMO.loUid.set(loadout, 'self');
    try { localStorage.setItem('mp_avatar_loadout', JSON.stringify(loadout)); } catch (e) {}
    // 방에 접속 중이면 다른 플레이어에게 바로 보이도록 즉시 반영
    if (myRef) { try { myRef.update({ avatarLoadout: loadout }); } catch (e) {} }
    // 계정에도 영구 저장(로그인/익명 uid 공통) - 다음 접속/다른 게임에서도 유지됨
    if (isConfigured() && db && uid) {
      db.ref(`${MP_ROOT}/users/${uid}/avatarLoadout`).set(loadout).then(() => cb && cb(true)).catch(() => cb && cb(false));
    } else {
      cb && cb(false);
    }
  }
  function fetchAccountAvatarLoadout(cb) {
    if (!isConfigured() || !db || !uid) { cb && cb(getLocalAvatarLoadout()); return; }
    db.ref(`${MP_ROOT}/users/${uid}/avatarLoadout`).once('value').then(snap => {
      const remote = snap.val();
      if (remote) {
        // 이 업데이트 이전에 저장된 계정에는 face/색상이 없다 — 기본값과 합쳐 올려준다
        myAvatarLoadout = Object.assign(mpDefaultLoadout(), remote); EMO.loUid.set(myAvatarLoadout, 'self');
        try { localStorage.setItem('mp_avatar_loadout', JSON.stringify(myAvatarLoadout)); } catch (e) {}
        cb && cb(myAvatarLoadout);
      } else {
        cb && cb(getLocalAvatarLoadout());
      }
    }).catch(() => cb && cb(getLocalAvatarLoadout()));
  }

  const PALETTE = [0xff5f6d, 0x00c2ff, 0xffb020, 0x8b5cf6, 0x2ed573, 0xff7edb, 0x54a0ff, 0xffa07a];
  function colorForUid(id) {
    if (!id) return PALETTE[0];
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }

  function isLoggedIn() {
    return !!(auth && auth.currentUser && !auth.currentUser.isAnonymous);
  }
  function currentUser() {
    return auth ? auth.currentUser : null;
  }

  function joinRoom(newUid) {
    uid = newUid;
    if (myRef) { try { myRef.onDisconnect().cancel(); } catch (e) {} }
    myRef = db.ref(`${MP_ROOT}/rooms/${currentRoom}/players/${uid}`);
    myRef.onDisconnect().remove();
    // 방에 들어갈 때 계정에 저장된 아바타 꾸밈을 불러와서 같이 뿌려줌
    fetchAccountAvatarLoadout((loadout) => {
      myRef.set({
        name: getDisplayName(),
        color: colorForUid(uid),
        avatarLoadout: loadout || getLocalAvatarLoadout(),
        x: 0, y: 0, z: 0, ry: 0,
        ts: firebase.database.ServerValue.TIMESTAMP
      });
    });

    if (playersRef) playersRef.off();
    playersRef = db.ref(`${MP_ROOT}/rooms/${currentRoom}/players`);
    const PRESENCE_STALE_MS = 20000; // 15초 넘게 위치 갱신이 없으면 유령 접속자로 간주하고 목록에서 제외
    let lastPlayersSnapshot = {};
    function emitFilteredPlayers(){
      const val = Object.assign({}, lastPlayersSnapshot);
      if (uid) delete val[uid];
      const now = serverNow();
      Object.keys(val).forEach(k=>{
        const p = val[k];
        if (!p || !p.ts || (now - p.ts) > PRESENCE_STALE_MS) delete val[k];
      });
      emoScanPlayers(val);
      mpChatPresence(val);
      if (onPlayersCb) onPlayersCb(val);
    }
    playersRef.on('value', snap => {
      lastPlayersSnapshot = snap.val() || {};
      mpChatScan(lastPlayersSnapshot);
      emitFilteredPlayers();
    });
    // 다른 사람이 아무도 움직이지 않으면(=파이어베이스에 새 쓰기가 없으면) 위 'value' 리스너가
    // 다시 안 불려서 낡은 유령이 그대로 남아있을 수 있음 - 5초마다 타이머로 강제 재검사해서 걸러냄
    if (presenceStaleTimer) clearInterval(presenceStaleTimer);
    presenceStaleTimer = setInterval(emitFilteredPlayers, 5000);
    ready = true;
    mpChatMount(); if (CHAT.el) CHAT.el.classList.remove('offline');
  }


  // =====================================================================
  //  공용 채팅 (로블록스처럼 왼쪽 위) — 방에 들어간 모든 게임에서 자동으로 뜬다.
  //  메시지는 각자 플레이어 기록의 chat 필드에 {i, m, t} 로 쓰고, 다른 사람은 i가 바뀌면 읽는다.
  // =====================================================================
  const CHAT = { el:null, list:null, input:null, n:0, last:{}, seen:{}, names:{}, sentAt:0, idleT:null, collapsed:false, baseline:false, members:{} };
  const CHAT_BAD = /(시발|씨발|ㅅㅂ|ㅆㅂ|병신|ㅂㅅ|개새끼|좆|존나|ㅈㄴ|미친놈|fuck|shit)/gi;
  function chatClean(t){ return String(t || '').replace(/[\u0000-\u001f]/g, '').slice(0, 120).replace(CHAT_BAD, m=>'#'.repeat(m.length)); }
  function chatEsc(t){ return String(t).replace(/[&<>"']/g, c=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
  function mpChatMount(){
    if (CHAT.el || typeof document === 'undefined' || !document.body) return;
    try { CHAT.collapsed = localStorage.getItem('mp_chat_collapsed') === '1'; } catch(e){}
    const st = document.createElement('style');
    st.textContent = `
      #mpChat{position:fixed;left:10px;top:54px;width:min(360px,62vw);z-index:45;font-family:'Pretendard','Noto Sans KR','Malgun Gothic',sans-serif;pointer-events:none;transition:opacity .4s}
      #mpChat.idle{opacity:.72}
      #mpChat .bar{display:flex;align-items:center;gap:6px;pointer-events:auto}
      #mpChat .tg{width:34px;height:30px;border:none;border-radius:8px;background:rgba(20,20,24,.62);color:#fff;font-size:15px;cursor:pointer}
      #mpChat .ttl{font:800 11px sans-serif;color:rgba(255,255,255,.7);text-shadow:0 1px 2px #000;letter-spacing:.05em}
      #mpChat .box{margin-top:4px;border-radius:10px;background:rgba(18,18,22,.42);padding:6px 8px 6px;transition:background .4s}
      #mpChat.idle .box{background:rgba(18,18,22,.18)}
      #mpChat.collapsed .box{display:none}
      #mpChat .list{max-height:min(24vh,170px);overflow-y:auto;display:flex;flex-direction:column;gap:2px;scrollbar-width:none;pointer-events:none}
      #mpChat .list::-webkit-scrollbar{display:none}
      #mpChat .ln{font-size:13.5px;line-height:1.35;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 3px rgba(0,0,0,.8);word-break:break-all}
      #mpChat .ln b{font-weight:800} #mpChat .ln.sys{color:#ffe38a;font-size:12.5px} #mpChat .ln.me b{text-decoration:underline}
      #mpChat input{margin-top:5px;width:100%;height:30px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(10,10,12,.55);color:#fff;padding:0 9px;font-size:13.5px;outline:none;pointer-events:auto;font-family:inherit}
      #mpChat input:focus{background:rgba(10,10,12,.85);border-color:rgba(255,255,255,.55)}
      #mpChat input::placeholder{color:rgba(255,255,255,.55)}
      #mpChat .emo{display:none;margin-top:4px;padding:6px;border-radius:10px;background:rgba(18,18,22,.86);grid-template-columns:repeat(6,1fr);gap:4px;pointer-events:auto;max-width:360px}
      #mpChat .emo.on{display:grid}
      #mpChat .emo button{border:none;border-radius:8px;background:rgba(255,255,255,.08);color:#fff;padding:4px 2px 3px;cursor:pointer;font-family:inherit}
      #mpChat .emo button:hover{background:rgba(255,255,255,.2)} #mpChat .emo button.lk{opacity:.45}
      #mpChat .emo span{display:block;font-size:20px;line-height:1.1} #mpChat .emo small{display:block;font-size:9.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #mpChat .emo .hint{grid-column:1/-1;font-size:10.5px;color:rgba(255,255,255,.6);text-align:center;padding-top:2px}
      #mpChat.offline .box,#mpChat.offline .ttl,#mpChat.offline .tg:not(.em){display:none}
      @media (max-width:640px){#mpChat{top:50px;width:min(300px,70vw)} #mpChat .ln{font-size:12.5px} #mpChat .list{max-height:18vh} #mpChat .emo{grid-template-columns:repeat(5,1fr)}}`;
    document.head.appendChild(st);
    const el = document.createElement('div'); el.id = 'mpChat';
    el.innerHTML = '<div class="bar"><button class="tg" type="button" title="채팅 접기/펴기">💬</button><button class="tg em" type="button" title="이모트 (. 키)">💃</button><span class="ttl">채팅</span></div><div class="emo"></div><div class="box"><div class="list"></div><input type="text" maxlength="120" placeholder="채팅하려면 여기를 누르거나 / 키" enterkeyhint="send" autocomplete="off"></div>';
    document.body.appendChild(el); CHAT.el = el; CHAT.list = el.querySelector('.list'); CHAT.input = el.querySelector('input');
    if (CHAT.collapsed) el.classList.add('collapsed');
    const emBtn = el.querySelector('.em'), emBox = el.querySelector('.emo');
    ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach(t=>{ emBtn.addEventListener(t, ev=>ev.stopPropagation()); emBox.addEventListener(t, ev=>ev.stopPropagation()); });
    emBtn.addEventListener('click', ()=>emoMenu());
    emBox.addEventListener('click', ev=>{ const b = ev.target.closest('[data-e]'); if (!b) return; playEmote(b.dataset.e); });
    window.addEventListener('keydown', ev=>{ const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      if (ev.key === '.'){ ev.preventDefault(); ev.stopPropagation(); emoMenu(); } else if (ev.key === 'Escape' && emBox.classList.contains('on')){ emoMenu(false); } }, true);
    el.querySelector('.tg').addEventListener('click', ev=>{ ev.stopPropagation(); CHAT.collapsed = !CHAT.collapsed; el.classList.toggle('collapsed', CHAT.collapsed); try { localStorage.setItem('mp_chat_collapsed', CHAT.collapsed ? '1' : '0'); } catch(e){} });
    const inp = CHAT.input; const stop = ev=>ev.stopPropagation();
    ['keyup', 'keypress', 'mousedown', 'pointerdown', 'touchstart', 'click', 'wheel'].forEach(t=>inp.addEventListener(t, stop));
    inp.addEventListener('keydown', ev=>{ ev.stopPropagation(); if (ev.key === 'Enter'){ ev.preventDefault(); const m = inp.value; inp.value = ''; if (m.trim()) chatSend(m); inp.blur(); } else if (ev.key === 'Escape'){ inp.value = ''; inp.blur(); } });
    inp.addEventListener('focus', ()=>{ window.MPChatOpen = true; chatWake(); try { if (document.pointerLockElement) document.exitPointerLock(); } catch(e){} });
    inp.addEventListener('blur', ()=>{ setTimeout(()=>{ window.MPChatOpen = false; }, 120); chatWake(); });
    ['pointerdown', 'touchstart', 'mousedown', 'click'].forEach(t=>CHAT.list.addEventListener(t, stop));
    // "/" 키로 바로 채팅
    window.addEventListener('keydown', ev=>{ if (ev.key !== '/' || document.activeElement === inp || el.classList.contains('offline')) return; const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      ev.preventDefault(); ev.stopPropagation(); if (CHAT.collapsed){ CHAT.collapsed = false; el.classList.remove('collapsed'); } inp.focus(); }, true);
    chatSys('채팅에 들어왔어요 · / 키로 말하기 · . 키(또는 💃)로 이모트');
    chatWake(); chatPlace(); setInterval(chatPlace, 1500); addEventListener('resize', chatPlace); }
  // 게임마다 왼쪽 위에 이미 있는 UI(생존 수 · 버튼 · 돈 등)를 피해서 그 아래로 내려간다
  function chatPlace(){ const el = CHAT.el; if (!el) return; const W = el.offsetWidth;
    const all = [...document.body.querySelectorAll('body > *, body > * > *, body > * > * > *')].filter(e=>{ if (e === el || el.contains(e) || e.tagName === 'CANVAS' || e.tagName === 'SCRIPT' || e.tagName === 'STYLE') return false; const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.top > 320 || r.bottom < 40) return false; if (r.width > innerWidth*.6 || r.height > innerHeight*.45) return false;
      const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; return !!((e.textContent || '').trim() || e.tagName === 'BUTTON' || e.tagName === 'A'); }).map(e=>e.getBoundingClientRect());
    const topFor = L=>{ let b = 0; for (const r of all){ if (r.top > 200 || r.left > L + W || r.right < L) continue; b = Math.max(b, r.bottom); } return Math.max(54, Math.round(b + 8)); };
    let L = 10, top = topFor(10);
    if (top > 140){ let right = 0; for (const r of all) if (r.left < 120 && r.top < 320) right = Math.max(right, r.right); const L2 = Math.min(220, Math.round(right + 8)), t2 = topFor(L2); if (t2 <= 140){ L = L2; top = t2; } }
    top = Math.min(Math.round(innerHeight*.4), top);
    if (Math.abs(top - (CHAT.top || 0)) > 2 || L !== CHAT.left){ CHAT.top = top; CHAT.left = L; el.style.top = top + 'px'; el.style.left = L + 'px'; } }
  function chatWake(){ if (!CHAT.el) return; CHAT.el.classList.remove('idle'); clearTimeout(CHAT.idleT); CHAT.idleT = setTimeout(()=>{ if (document.activeElement !== CHAT.input) CHAT.el.classList.add('idle'); }, 9000); }
  function chatLine(html, cls){ if (!CHAT.list) return; const d = document.createElement('div'); d.className = 'ln' + (cls ? ' ' + cls : ''); d.innerHTML = html; CHAT.list.appendChild(d);
    while (CHAT.list.children.length > 60) CHAT.list.removeChild(CHAT.list.firstChild); CHAT.list.scrollTop = CHAT.list.scrollHeight; chatWake(); }
  function chatSys(t){ chatLine(chatEsc(t), 'sys'); }
  function chatName(u, name){ const c = '#' + ('000000' + (colorForUid(u) >>> 0).toString(16)).slice(-6); return '<b style="color:' + c + '">' + chatEsc(String(name || '플레이어').slice(0, 16)) + '</b>'; }
  function chatSend(raw){ const m = chatClean(raw).trim(); if (!m || !ready || !myRef) return;
    if (/^\/(e|emote|이모트)(\s|$)/i.test(m)){ const q = m.replace(/^\/\S+\s*/, ''); if (!q){ emoMenu(true); return; } if (!playEmote(q)) chatSys('그런 이모트는 없어요 — 💃 버튼을 눌러 보세요'); return; } const now = Date.now(); if (now - CHAT.sentAt < 700){ chatSys('너무 빨라요! 잠깐만요'); return; } CHAT.sentAt = now;
    CHAT.n = (CHAT.n || 0) + 1; const i = Date.now().toString(36) + CHAT.n; try { myRef.update({ chat:{ i, m, t:firebase.database.ServerValue.TIMESTAMP } }); } catch(e){}
    chatLine(chatName(uid, getDisplayName()) + ': ' + chatEsc(m), 'me'); }
  function mpChatScan(all){ if (!CHAT.el) return; const now = serverNow();
    Object.keys(all || {}).forEach(u=>{ if (u === uid) return; const p = all[u]; if (!p) return; if (p.name) CHAT.names[u] = p.name; const c = p.chat; if (!c || !c.i || CHAT.last[u] === c.i) return; const first = !(u in CHAT.last); CHAT.last[u] = c.i;
      if (first && c.t && now - c.t > 20000) return; chatLine(chatName(u, p.name) + ': ' + chatEsc(chatClean(c.m))); }); }
  function mpChatPresence(val){ if (!CHAT.el) return; const cur = {}; Object.keys(val || {}).forEach(u=>{ cur[u] = (val[u] && val[u].name) || CHAT.names[u] || '플레이어'; });
    if (CHAT.baseline){ Object.keys(cur).forEach(u=>{ if (!CHAT.members[u]) chatSys(cur[u] + '님이 들어왔어요'); }); Object.keys(CHAT.members).forEach(u=>{ if (!cur[u]) chatSys(CHAT.members[u] + '님이 나갔어요'); }); }
    CHAT.members = cur; CHAT.baseline = true; }
  function chatOpen(){ return !!window.MPChatOpen; }

  // ---------- 이모트: 상태 동기화 · 재생 · 메뉴 ----------
  function emoScanPlayers(val){ const seen = {};
    Object.keys(val || {}).forEach(k=>{ const p = val[k]; if (!p) return; seen[k] = 1; if (p.avatarLoadout && typeof p.avatarLoadout === 'object') EMO.loUid.set(p.avatarLoadout, k);
      const x = +p.x, z = +p.z; if (isFinite(x) && isFinite(z)) EMO.pos[k] = [x, z];
      const em = p.emote, cur = EMO.remote[k];
      if (!em || !em.id || !EMOTE_MAP[em.id]){ delete EMO.remote[k]; return; }
      const t = +em.t || serverNow(); if (EMO.dead && EMO.dead[k] === t) return;
      if (!cur || cur.t !== t || cur.id !== em.id){ EMO.remote[k] = { id:em.id, t, x, z }; return; }
      if (isFinite(x) && isFinite(cur.x) && Math.hypot(x - cur.x, z - cur.z) > .9){ EMO.dead = EMO.dead || {}; EMO.dead[k] = t; delete EMO.remote[k]; } });
    Object.keys(EMO.remote).forEach(k=>{ if (!seen[k]) delete EMO.remote[k]; }); }
  function ownsEmote(id){ const e = EMOTE_MAP[id]; if (!e) return false; return !e.price || isOwned(id); }
  function playEmote(q){ const e = emoFind(q); if (!e) return false;
    if (!ownsEmote(e.id)){ chatSys('🔒 ' + e.icon + ' ' + e.name + ' — 허브 → 아바타 → 마켓플레이스에서 살 수 있어요 (🔷' + e.price + ')'); return true; }
    EMO.self = { id:e.id, t:serverNow(), x:EMO.selfPos ? EMO.selfPos[0] : null, z:EMO.selfPos ? EMO.selfPos[1] : null, g:null };
    if (ready && myRef){ try { myRef.update({ emote:{ id:e.id, t:firebase.database.ServerValue.TIMESTAMP } }); } catch (err) {} }
    emoInstall(); emoMenu(false); return true; }
  function stopEmote(){ if (!EMO.self) return; EMO.self = null; if (ready && myRef){ try { myRef.update({ emote:null }); } catch (err) {} } }
  EMO.onSelfStop = stopEmote;
  // 방에 안 들어간(혼자 하는) 게임에서도 아바타가 보이면 💃 버튼만 띄운다
  if (typeof window !== 'undefined') setInterval(()=>{ try { if (CHAT.el || document.getElementById('avatarOverlay') || !document.body) return; let vis = false; for (const g of EMO.groups) if (emoRoot(g).isScene){ vis = true; break; } if (!vis) return; mpChatMount(); if (CHAT.el && !ready) CHAT.el.classList.add('offline'); } catch (e) {} }, 3000);
  function previewEmote(group, id){ if (!group) return; group.userData.emote = id && EMOTE_MAP[id] ? { id, t0:Date.now() } : null; EMO.groups.add(group); emoInstall(); }
  function emoMenu(open){ const el = CHAT.el; if (!el) return; const box = el.querySelector('.emo'); if (!box) return; if (open === undefined) open = !box.classList.contains('on');
    box.classList.toggle('on', open); window.MPChatOpen = open || document.activeElement === CHAT.input;
    if (!open) return; try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
    box.innerHTML = EMOTES.map(e=>{ const own = ownsEmote(e.id); return '<button type="button" data-e="' + e.id + '" class="' + (own ? '' : 'lk') + '" title="/e ' + e.alias[0] + '"><span>' + e.icon + '</span><small>' + (own ? e.name : '🔒 🔷' + e.price) + '</small></button>'; }).join('') + '<div class="hint">/e 이름 으로도 쓸 수 있어요 · 움직이면 멈춰요 · 더 많은 이모트는 허브 마켓플레이스</div>'; }

  function handleAuthChange(user) {
    authReady = true;
    if (user) {
      uid = user.uid;
      ensureUserRecord();
      if (roomMode && currentRoom) joinRoom(user.uid);
      if (!firstCallbackFired && firstCallback) { firstCallback(user.uid, null); firstCallbackFired = true; }
      if (onAuthCb) onAuthCb(user);
    } else {
      // 로그인 상태가 아니면 자동으로 익명 로그인 시도 (게스트 플레이)
      auth.signInAnonymously().catch(err => {
        console.error('[MP] 익명 로그인 실패:', err);
        if (!firstCallbackFired && firstCallback) { firstCallback(null, err); firstCallbackFired = true; }
      });
    }
  }

  /**
   * init(roomCode, callback) — 실시간 멀티플레이(방 접속)까지 시작.
   * jumpmap.html / aura-battle-3.html 에서 사용.
   */
  function init(roomCode, callback) {
    if (!isConfigured()) {
      console.warn('[MP] Firebase 설정이 비어있어 멀티플레이를 건너뜁니다. multiplayer.js의 FIREBASE_CONFIG를 채워주세요.');
      if (callback) callback(null, 'no-config');
      return;
    }
    roomMode = true;
    currentRoom = roomCode || getRoomFromURL();
    firstCallback = callback;
    firstCallbackFired = false;
    try {
      ensureApp();
      auth.onAuthStateChanged(handleAuthChange);
    } catch (err) {
      console.error('[MP] Firebase 초기화 실패:', err);
      if (callback) callback(null, err);
    }
  }

  /**
   * initAuthOnly(callback) — 방 접속 없이 로그인 상태만 추적.
   * hub.html (로그인/회원가입 + 리더보드)에서 사용.
   * callback(user)은 로그인 상태가 바뀔 때마다(익명 로그인 포함) 호출됨.
   */
  function initAuthOnly(callback) {
    if (!isConfigured()) {
      if (callback) callback(null, 'no-config');
      return;
    }
    onAuthCb = callback;
    try {
      ensureApp();
      auth.onAuthStateChanged(handleAuthChange);
    } catch (err) {
      console.error('[MP] Firebase 초기화 실패:', err);
      if (callback) callback(null, err);
    }
  }

  function onAuthStateChange(cb) { onAuthCb = cb; }

  function update(state) {
    if (state && isFinite(+state.x) && isFinite(+state.z)){ EMO.selfPos = [+state.x, +state.z];
      if (EMO.self){ if (EMO.self.x == null){ EMO.self.x = +state.x; EMO.self.z = +state.z; } else if (Math.hypot(+state.x - EMO.self.x, +state.z - EMO.self.z) > .9) stopEmote(); } }
    if (!ready || !myRef) return;
    myRef.update(Object.assign({ ts: firebase.database.ServerValue.TIMESTAMP }, state));
  }

  function onPlayersUpdate(cb) { onPlayersCb = cb; }

  function leave() {
    if (myRef) myRef.remove();
    if (playersRef) playersRef.off();
  }

  // ---------- 이메일/비밀번호 로그인·회원가입 ----------
  // 이 Firebase 프로젝트는 "이메일 열거 보호"가 켜져 있어서, 비밀번호가 틀리거나 가입 안 된 이메일이면
  // 서버가 INVALID_LOGIN_CREDENTIALS 를 돌려준다. 옛 SDK(8.10.1)는 이 코드를 몰라서 'auth/internal-error'
  // 로 바꿔 버리므로(화면에 이상한 오류가 뜸), 알아들을 수 있는 코드로 고쳐서 넘긴다.
  function fixAuthErr(err) {
    if (!err) return err;
    const raw = String(err.message || '') + ' ' + String(err.code || '');
    let code = err.code;
    if (/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(raw)) code = 'auth/invalid-credential';
    else if (/TOO_MANY_ATTEMPTS/.test(raw)) code = 'auth/too-many-requests';
    else if (/USER_DISABLED/.test(raw)) code = 'auth/user-disabled';
    else if (/EMAIL_EXISTS/.test(raw)) code = 'auth/email-already-in-use';
    else if (/INVALID_EMAIL/.test(raw)) code = 'auth/invalid-email';
    else if (/WEAK_PASSWORD/.test(raw)) code = 'auth/weak-password';
    if (code === err.code) return err;
    return { code, message: err.message, original: err };
  }
  const cleanEmail = e => String(e || '').trim().toLowerCase();
  function signUp(email, password, nickname, cb0) {
    if (!isConfigured()) { cb0 && cb0(null, 'no-config'); return; }
    ensureApp(); email = cleanEmail(email);
    const cb = (u, e) => cb0 && cb0(u, fixAuthErr(e));
    const finalNick = (nickname || getNickname()).trim().slice(0,12);
    const finish = (user) => {
      setNickname(finalNick);
      accountName = finalNick;
      db.ref(`${MP_ROOT}/users/${user.uid}`).update({
        email: email,
        nickname: finalNick, nicknameLower: finalNick.toLowerCase(),          // 계정 이름(고정)
        displayName: finalNick, displayNameLower: finalNick.toLowerCase(),    // 표시 이름(변경 가능)
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
      if (finalNick) user.updateProfile({ displayName: finalNick }).catch(()=>{});
      cb && cb(user, null);
    };
    const cur = auth.currentUser;
    const cred = firebase.auth.EmailAuthProvider.credential(email, password);
    if (cur && cur.isAnonymous) {
      // 게스트로 플레이하던 uid를 그대로 이어받아 계정으로 승격
      cur.linkWithCredential(cred).then(res => finish(res.user)).catch(err => {
        if (err && err.code === 'auth/email-already-in-use') {
          auth.createUserWithEmailAndPassword(email, password).then(res => finish(res.user)).catch(e2 => cb && cb(null, e2));
        } else {
          cb && cb(null, err);
        }
      });
    } else {
      auth.createUserWithEmailAndPassword(email, password).then(res => finish(res.user)).catch(err => cb && cb(null, err));
    }
  }

  function signIn(email, password, cb0) {
    if (!isConfigured()) { cb0 && cb0(null, 'no-config'); return; }
    ensureApp(); email = cleanEmail(email);
    const cb = (u, e, info) => cb0 && cb0(u, fixAuthErr(e), info);
    auth.signInWithEmailAndPassword(email, password).then(res => {
      // 게스트로 쌓인 이 기기의 캐시가 계정 데이터에 섞이지 않게 비우고, 계정 데이터를 다시 받는다
      clearLocalCaches();
      uid = res.user.uid;
      restoreAccountData(info => cb && cb(res.user, null, info));
    }).catch(err => cb && cb(null, err));
  }
  function clearLocalCaches() {
    myAvatarLoadout = null; myXP = null;
    try { ['mp_xp', 'mp_avatar_loadout', 'mp_owned_items', 'mp_nickname', 'mp_account_name'].forEach(k => localStorage.removeItem(k)); } catch (e) {}
  }
  // 계정(users/{uid})에 저장된 이름·아바타·레벨·아이템을 이 기기로 다시 받아온다
  function restoreAccountData(cb) {
    if (!isConfigured() || !db || !uid) { cb && cb(null); return; }
    db.ref(`${MP_ROOT}/users/${uid}`).once('value').then(snap => {
      const u = snap.val() || {};
      try {
        const name = u.displayName || u.nickname || (auth.currentUser && auth.currentUser.displayName);
        if (name) localStorage.setItem('mp_nickname', name);
        accountName = u.nickname || accountName;
        if (u.avatarLoadout) { myAvatarLoadout = Object.assign(mpDefaultLoadout(), u.avatarLoadout); localStorage.setItem('mp_avatar_loadout', JSON.stringify(myAvatarLoadout)); }
        if (typeof u.xp === 'number') { myXP = Math.max(u.xp, getLocalXP()); localStorage.setItem('mp_xp', String(myXP)); }
        const owned = Object.keys(u.ownedItems || {}); if (owned.length) { const loc = getOwnedItems(); owned.forEach(id => { if (loc.indexOf(id) < 0) loc.push(id); }); localStorage.setItem('mp_owned_items', JSON.stringify(loc)); }
        localStorage.setItem('mp_nickname_set', '1');
      } catch (e) {}
      cb && cb({ name: u.displayName || u.nickname || null, accountName: u.nickname || null, level: typeof u.xp === 'number' ? levelFromXP(u.xp).level : (u.level || 1), items: Object.keys(u.ownedItems || {}).length, avatar: u.avatarLoadout || null, email: u.email || (auth.currentUser && auth.currentUser.email) || null });
    }).catch(err => { console.error('[MP] 계정 데이터 불러오기 실패', err && err.code || err); cb && cb(null, err); });
  }
  function resetPassword(email, cb0) {
    if (!isConfigured()) { cb0 && cb0(false, 'no-config'); return; }
    ensureApp(); email = cleanEmail(email);
    const cb = (ok, e) => cb0 && cb0(ok, fixAuthErr(e));
    auth.sendPasswordResetEmail(email).then(() => cb && cb(true)).catch(err => cb && cb(false, err));
  }

  // 로그아웃 — 계정에서 나온 뒤 반드시 익명으로 다시 붙는다.
  // 그냥 signOut만 하면 uid가 사라져서 접속상태·친구·아바타 저장이 전부 멈춰버린다.
  // 이전 계정의 닉네임/아바타가 다음 계정으로 새어나가지 않게 캐시도 비운다.
  function signOutUser(cb) {
    if (!auth) { cb && cb(); return; }
    const cleanup = clearLocalCaches;
    auth.signOut().then(() => {
      cleanup();
      // 게스트로 되돌아가기 — 실패해도 콜백은 반드시 부른다
      auth.signInAnonymously().then(() => cb && cb(true)).catch(() => cb && cb(true));
    }).catch(() => { cleanup(); cb && cb(false); });
  }

  // ---------- 리더보드 ----------
  /**
   * submitScore(category, score, direction, extra, cb)
   * direction: 'asc'(작을수록 좋음, 예: 기록 시간) | 'desc'(클수록 좋음, 예: 등급/점수)
   */
  function submitScore(category, score, direction, extra, cb) {
    if (!isConfigured() || !db || !uid) { cb && cb(false); return; }
    const ref = db.ref(`${MP_ROOT}/leaderboard/${category}/${uid}`);
    ref.once('value').then(snap => {
      const cur = snap.val();
      const better = !cur || (direction === 'asc' ? score < cur.score : score > cur.score);
      if (better) {
        const payload = Object.assign({
          name: getDisplayName(), score: score,
          ts: firebase.database.ServerValue.TIMESTAMP
        }, extra || {});
        ref.set(payload).then(() => cb && cb(true)).catch(() => cb && cb(false));
      } else {
        cb && cb(false);
      }
    }).catch(() => cb && cb(false));
  }

  function fetchLeaderboard(category, opts, cb) {
    if (!isConfigured() || !db) { cb && cb([]); return; }
    opts = opts || {};
    const limit = opts.limit || 10;
    const direction = opts.direction || 'desc';
    const base = db.ref(`${MP_ROOT}/leaderboard/${category}`).orderByChild('score');
    const q = direction === 'asc' ? base.limitToFirst(limit) : base.limitToLast(limit);
    q.once('value').then(snap => {
      const arr = [];
      snap.forEach(child => { arr.push(Object.assign({ uid: child.key }, child.val())); });
      if (direction === 'desc') arr.reverse();
      cb && cb(arr);
    }).catch(err => { console.error('[MP] 리더보드 조회 실패', err); cb && cb([]); });
  }

  // 내 기록 하나만 (순위표 밖일 때 표시용)
  function fetchMyScore(category, cb) {
    if (!isConfigured() || !db || !uid) { cb && cb(null); return; }
    db.ref(`${MP_ROOT}/leaderboard/${category}/${uid}`).once('value').then(s => cb && cb(s.val())).catch(() => cb && cb(null));
  }

  // ---------- 접속 상태(온라인/플레이 중인 게임) ----------
  // ---- 전체 접속 현황 ----
  // 지금까지는 "들어가 봐야" 사람이 있는지 알 수 있었다. 그래서 빈 로비를 본 사람은
  // 그냥 나가고, 그 직후에 들어온 사람도 또 빈 로비를 보는 엇갈림이 계속됐다.
  // 게임별 접속자 수와 방 코드를 밖에서 미리 볼 수 있게 한다.
  let allPresenceRef = null;
  function onGamePresence(cb) {
    if (!isConfigured() || !db) { cb && cb({ total:0, games:{}, rooms:{} }); return; }
    if (allPresenceRef) allPresenceRef.off();
    allPresenceRef = db.ref(`${MP_ROOT}/presence`);
    let lastAll = {};
    // 아무도 새로 안 쓰면 'value'가 다시 안 불려서, 나간 사람이 계속 남아 보였다 → 10초마다 다시 계산
    if (presenceTimer) clearInterval(presenceTimer);
    presenceTimer = setInterval(() => emit(lastAll), 10000);
    allPresenceRef.on('value', snap => { lastAll = snap.val() || {}; emit(lastAll); }, () => cb && cb({ total:0, games:{}, rooms:{} }));
    function emit(all) {
      const now = serverNow();
      const games = {}, rooms = {};
      let total = 0;
      Object.keys(all).forEach(id => {
        const p = all[id];
        if (!p || !p.online) return;
        // 브라우저가 그냥 죽으면 online이 true로 남을 수 있다 — 하트비트(15초)를 3번 놓치면 뺀다
        if (!p.ts || now - p.ts > PRESENCE_TTL) return;
        total++;
        const g = p.game || 'hub';
        games[g] = (games[g] || 0) + 1;
        if (p.game && p.room) {
          const key = p.game + '|' + p.room;
          rooms[key] = rooms[key] || { game:p.game, room:p.room, count:0, names:[] };
          rooms[key].count++;
          if (p.name && rooms[key].names.length < 4) rooms[key].names.push(p.name);
        }
      });
      cb && cb({ total, games, rooms });
    }
  }
  let presenceTimer = null;
  const PRESENCE_TTL = 50000;

  // ---- 계정 통합 레벨 ----
  // 지금까지 레벨은 포레스트 스트라이크 안에만 있었고, 그 기기 localStorage에만 저장돼서
  // 허브에도 안 뜨고 친구도 볼 수 없었다. 계정에 붙는 하나의 레벨로 합쳐서
  // 어느 게임에서 얻든 같이 쌓이고, 어디서나 보이게 한다.
  let myXP = null;                 // 캐시
  const XP_BASE = 500, XP_GROW = 1.18;
  function xpNeededFor(level){ return Math.round(XP_BASE * Math.pow(XP_GROW, Math.max(0, level - 1))); }
  function levelFromXP(totalXP){
    let lv = 1, left = Math.max(0, totalXP || 0);
    while (left >= xpNeededFor(lv) && lv < 200){ left -= xpNeededFor(lv); lv++; }
    return { level: lv, into: left, need: xpNeededFor(lv), total: totalXP || 0 };
  }
  function getLocalXP(){
    if (myXP !== null) return myXP;
    try { myXP = parseInt(localStorage.getItem('mp_xp') || '0', 10) || 0; }
    catch (e) { myXP = 0; }
    return myXP;
  }
  function getLevel(){ return levelFromXP(getLocalXP()); }
  // 경험치를 더한다. 레벨이 올랐으면 결과에 leveledTo가 담긴다.
  function addXP(amount, cb){
    const before = levelFromXP(getLocalXP()).level;
    myXP = getLocalXP() + Math.max(0, Math.round(amount || 0));
    try { localStorage.setItem('mp_xp', String(myXP)); } catch (e) {}
    const after = levelFromXP(myXP);
    if (isConfigured() && db && uid){
      db.ref(`${MP_ROOT}/users/${uid}`).update({ xp: myXP, level: after.level }).catch(()=>{});
      if (after.level > before) submitScore('level', myXP, 'desc', { level: after.level });
    }
    const res = Object.assign({}, after, { leveledTo: after.level > before ? after.level : null });
    cb && cb(res);
    return res;
  }
  // ---- 레벨 보상 ----
  // 레벨만 오르고 아무것도 안 주면 숫자에 불과하다. 레벨마다 샤드를 주고,
  // 특정 레벨에서 아바타 아이템을 풀어준다. 받은 레벨은 기록해서 중복 지급을 막는다.
  const LEVEL_REWARDS = {
    3:  { shards: 30,  unlock:null,      label:'샤드 30' },
    5:  { shards: 50,  unlock:'cap',     label:'샤드 50 + 야구모자' },
    8:  { shards: 60,  unlock:'scarf',   label:'샤드 60 + 목도리' },
    10: { shards: 100, unlock:'vest',    label:'샤드 100 + 전술 조끼' },
    13: { shards: 90,  unlock:'jetpack', label:'샤드 90 + 제트팩' },
    15: { shards: 150, unlock:'cape',    label:'샤드 150 + 망토' },
    18: { shards: 120, unlock:'katana',  label:'샤드 120 + 등에 멘 검' },
    20: { shards: 250, unlock:'halo',    label:'샤드 250 + 천사 고리' },
    25: { shards: 400, unlock:'tophat',  label:'샤드 400 + 실크햇' }
  };
  function claimedLevels(){
    try { return JSON.parse(localStorage.getItem('mp_lv_claimed') || '[]') || []; }
    catch(e){ return []; }
  }
  function claimLevelRewards(){
    const lv = getLevel().level;
    const done = claimedLevels();
    const got = [];
    Object.keys(LEVEL_REWARDS).map(Number).sort((a,b)=>a-b).forEach(need=>{
      if (lv < need || done.indexOf(need) >= 0) return;
      const r = LEVEL_REWARDS[need];
      done.push(need);
      if (r.shards){
        try {
          const cur = parseInt(localStorage.getItem('shard_balance') || '0', 10) || 0;
          localStorage.setItem('shard_balance', String(cur + r.shards));
        } catch(e){}
      }
      if (r.unlock) mpUnlockSecret('reward_' + r.unlock);
      got.push({ level:need, label:r.label, shards:r.shards, unlock:r.unlock });
    });
    // 이 계정 전용 보상
    EXCLUSIVE_REWARDS.forEach(ex=>{
      if (lv < ex.level || !isExclusiveFor(ex) || mpHasSecret(ex.secret)) return;
      mpUnlockSecret(ex.secret);
      if (done.indexOf(ex.level) < 0) done.push(ex.level);
      got.push({ level:ex.level, label:ex.label, shards:0, unlock:ex.item });
    });
    if (got.length){ try { localStorage.setItem('mp_lv_claimed', JSON.stringify(done)); } catch(e){} }
    return got;
  }
  const normName = n => String(n || '').replace(/\s+/g, '').toLowerCase();
  function isExclusiveFor(ex){
    if (uid && ex.uids && ex.uids.indexOf(uid) >= 0) return true;
    const acc = normName(accountName);
    return !!acc && (ex.accounts || []).some(a => normName(a) === acc);
  }
  // 목록: 모두 공통 보상 + (해당 계정이면) 전용 보상
  function levelRewardTable(){
    const t = Object.assign({}, LEVEL_REWARDS);
    EXCLUSIVE_REWARDS.forEach(ex=>{ if (isExclusiveFor(ex)) t[ex.level] = { shards:0, unlock:ex.item, label:ex.label, exclusive:true }; });
    return t;
  }

  // 로그인 시 계정에 저장된 값을 가져와 기기 값과 합친다(둘 중 큰 쪽을 쓴다)
  function fetchAccountXP(cb){
    if (!isConfigured() || !db || !uid){ cb && cb(getLevel()); return; }
    db.ref(`${MP_ROOT}/users/${uid}/xp`).once('value').then(snap=>{
      const remote = snap.val();
      if (typeof remote === 'number' && remote > getLocalXP()){
        myXP = remote;
        try { localStorage.setItem('mp_xp', String(myXP)); } catch(e){}
      } else if (typeof remote !== 'number' && getLocalXP() > 0){
        db.ref(`${MP_ROOT}/users/${uid}`).update({ xp: getLocalXP(), level: getLevel().level }).catch(()=>{});
      }
      cb && cb(getLevel());
    }).catch(()=> cb && cb(getLevel()));
  }

  let presenceRef = null;
  function setPresence(game, room) {
    if (!isConfigured() || !db || !uid) return;
    if (!presenceRef || presenceRef.key !== uid) {
      presenceRef = db.ref(`${MP_ROOT}/presence/${uid}`);
      presenceRef.onDisconnect().update({ online:false, game:null, room:null, ts: firebase.database.ServerValue.TIMESTAMP });
    }
    presenceRef.update({
      online:true, game: game || null, room: room || null, name: getDisplayName(),
      ts: firebase.database.ServerValue.TIMESTAMP
    });
    // 허브는 50초 넘게 갱신 없는 접속을 지운다 → 게임 안에 있는 동안 계속 살아있다고 알린다 (숨겨진 탭은 안 보냄)
    presenceGame = game || null; presenceRoom = room || null;
    if (game && !playCounted[game]) {
      playCounted[game] = true;
      try { db.ref(`${MP_ROOT}/users/${uid}/plays/${game}`).transaction(v => (typeof v === 'number' ? v : 0) + 1); } catch (e) {}
    }
    if (!presenceBeat) {
      presenceBeat = setInterval(() => {
        if (!presenceRef || document.hidden) return;
        presenceRef.update({ online:true, game: presenceGame, room: presenceRoom, ts: firebase.database.ServerValue.TIMESTAMP });
      }, 15000);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && presenceRef) presenceRef.update({ online:true, game: presenceGame, room: presenceRoom, ts: firebase.database.ServerValue.TIMESTAMP });
      });
    }
  }
  let presenceBeat = null, presenceGame = null, presenceRoom = null; const playCounted = {};

  // ---------- 유저 검색 (닉네임/아이디로 친구 찾기) ----------
  // 계정 이름(nicknameLower)과 표시 이름(displayNameLower) 양쪽으로 검색해서 합친다.
  // 예전엔 계정 이름만 뒤져서, 이름을 바꾼 사람은 새 이름으로 검색해도 안 나왔다.
  function searchUsers(queryStr, cb) {
    if (!isConfigured() || !db) { cb && cb([]); return; }
    const q = (queryStr || '').trim().toLowerCase();
    if (!q) { cb && cb([]); return; }
    const byField = (field) => db.ref(`${MP_ROOT}/users`)
      .orderByChild(field).startAt(q).endAt(q + '\uf8ff').limitToFirst(20).once('value')
      .then(snap => { const a = []; snap.forEach(ch => { a.push(Object.assign({ uid: ch.key }, ch.val())); }); return a; })
      .catch(() => []);
    Promise.all([byField('nicknameLower'), byField('displayNameLower')]).then(([a, b]) => {
      const merged = {};
      a.concat(b).forEach(u => { if (u.uid !== uid) merged[u.uid] = u; });
      cb && cb(Object.values(merged));
    }).catch(err => { console.error('[MP] 유저 검색 실패', err); cb && cb([]); });
  }

  // ---------- 친구 (요청 → 상대가 수락해야 친구) ----------
  // friends/{uid} 는 본인만 쓸 수 있어서 상대 목록에 직접 넣을 수 없다.
  // 그래서 사람마다 "우편함"(rooms/fr_{uid}/players)을 두고, 보내는 사람은 그 우편함의 자기 칸에만 쓴다.
  //   k: 'req' 요청 · 'acc' 수락 · 'dec' 거절 · 'unf' 친구 끊기   (칸 하나라 마지막 상태만 남는다)
  // 내 friends/{uid}/{상대} 의 type: 'pending'(보냄) · 'friend' · 'declined'(거절함)
  const TS = () => firebase.database.ServerValue.TIMESTAMP;
  const mpOn = () => isConfigured() && db && uid;
  function mail(target, k) {
    return db.ref(`${MP_ROOT}/rooms/fr_${target}/players/${uid}`).set({ k, name: getDisplayName(), ts: TS() });
  }
  function setFriendEntry(fid, name, type) {
    return db.ref(`${MP_ROOT}/friends/${uid}/${fid}`).set({ name: name || '친구', type, ts: TS() });
  }
  let myFriendsCache = {}, inboxCache = {}, inboxRef = null, onReqCb = null, inboxReady = false;
  const ackSent = {};
  function friendState(fid) {
    const mine = myFriendsCache[fid];
    if (mine && (mine.type === 'friend' || mine.type === 'follow')) return 'friend';
    if (mine && mine.type === 'pending') return 'pending';
    if (incomingList().some(r => r.uid === fid)) return 'incoming';
    return null;
  }
  function incomingList() {
    const out = [];
    Object.keys(inboxCache).forEach(from => {
      const m = inboxCache[from], mine = myFriendsCache[from];
      if (!m || m.k !== 'req' || from === uid) return;
      if (mine && (mine.type === 'friend' || mine.type === 'follow' || mine.type === 'pending')) return;
      if (mine && mine.type === 'declined' && (mine.ts || 0) >= (m.ts || 0)) return;
      out.push({ uid: from, name: m.name || '누군가', ts: m.ts || 0 });
    });
    return out.sort((a, b) => b.ts - a.ts);
  }
  // 우편함과 내 친구 목록을 맞춰 본다 (수락/거절/끊기 반영, 서로 동시에 요청하면 바로 친구)
  function processInbox() {
    if (!mpOn() || !inboxReady) return;
    Object.keys(inboxCache).forEach(from => {
      const m = inboxCache[from], mine = myFriendsCache[from]; if (!m || from === uid) return;
      const newer = !mine || (mine.ts || 0) < (m.ts || 0);
      if (m.k === 'req') {
        if (mine && mine.type === 'pending') { setFriendEntry(from, m.name || mine.name, 'friend').catch(() => {}); mail(from, 'acc').catch(() => {}); }
        // 예전 방식(한쪽만 추가)으로 이미 친구로 넣어둔 사람이 요청하면 수락으로 답해 준다
        else if (mine && (mine.type === 'friend' || mine.type === 'follow') && newer && !ackSent[from]) { ackSent[from] = true; mail(from, 'acc').catch(() => {}); }
      } else if (m.k === 'acc') {
        if (mine && mine.type === 'pending') setFriendEntry(from, m.name || mine.name, 'friend').catch(() => {});
      } else if (m.k === 'dec' || m.k === 'unf') {
        if (mine && mine.type !== 'declined' && newer) db.ref(`${MP_ROOT}/friends/${uid}/${from}`).remove().catch(() => {});
      }
    });
    if (onReqCb) onReqCb(incomingList());
  }
  function startInbox() {
    if (!mpOn() || (inboxRef && inboxRef.key === 'players' && inboxRef.__uid === uid)) return;
    if (inboxRef) inboxRef.off();
    inboxRef = db.ref(`${MP_ROOT}/rooms/fr_${uid}/players`); inboxRef.__uid = uid;
    inboxRef.on('value', snap => { inboxCache = snap.val() || {}; inboxReady = true; processInbox(); },
      err => console.error('[MP] 친구 요청함 조회 실패:', err && err.code || err));
  }
  function onFriendRequests(cb) { onReqCb = cb; startInbox(); cb && cb(incomingList()); }
  function sendFriendRequest(target, name, cb) {
    if (!mpOn() || !target || target === uid) { cb && cb(false); return; }
    if (friendState(target) === 'incoming') { acceptFriend(target, name, cb); return; }
    Promise.all([setFriendEntry(target, name, 'pending'), mail(target, 'req')])
      .then(() => cb && cb(true)).catch(() => cb && cb(false));
  }
  function acceptFriend(from, name, cb) {
    if (!mpOn()) { cb && cb(false); return; }
    const m = inboxCache[from];
    Promise.all([setFriendEntry(from, name || (m && m.name), 'friend'), mail(from, 'acc')])
      .then(() => cb && cb(true)).catch(() => cb && cb(false));
  }
  function declineFriend(from, cb) {
    if (!mpOn()) { cb && cb(false); return; }
    const m = inboxCache[from];
    Promise.all([setFriendEntry(from, m && m.name, 'declined'), mail(from, 'dec')])
      .then(() => { if (onReqCb) onReqCb(incomingList()); cb && cb(true); }).catch(() => cb && cb(false));
  }
  // 예전 코드 호환: 이제 "추가"는 곧 "요청 보내기"
  function addFriend(targetUid, targetName, type, cb) { sendFriendRequest(targetUid, targetName, cb); }
  function removeFriend(targetUid, cb) {
    if (!mpOn()) { cb && cb(false); return; }
    Promise.all([db.ref(`${MP_ROOT}/friends/${uid}/${targetUid}`).remove(), mail(targetUid, 'unf')])
      .then(() => cb && cb(true)).catch(() => cb && cb(false));
  }

  // ---------- 프로필 (아바타 · 이름 · 이전 이름 · 좋아하는 게임 · 많이 한 게임) ----------
  function getFavGames() { try { const a = JSON.parse(localStorage.getItem('mp_fav_games') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function setFavGames(list, cb) {
    list = (list || []).filter(x => typeof x === 'string').slice(0, 5);
    try { localStorage.setItem('mp_fav_games', JSON.stringify(list)); } catch (e) {}
    if (!mpOn()) { cb && cb(false); return; }
    db.ref(`${MP_ROOT}/users/${uid}/favGames`).set(list).then(() => cb && cb(true)).catch(() => cb && cb(false));
  }
  function fetchFavGames(cb) {
    if (!mpOn()) { cb && cb(getFavGames()); return; }
    db.ref(`${MP_ROOT}/users/${uid}/favGames`).once('value').then(s => {
      const v = s.val(); if (Array.isArray(v)) { try { localStorage.setItem('mp_fav_games', JSON.stringify(v)); } catch (e) {} cb && cb(v); }
      else { const loc = getFavGames(); if (loc.length) setFavGames(loc); cb && cb(loc); }
    }).catch(() => cb && cb(getFavGames()));
  }
  function fetchProfile(pid, cb) {
    if (!isConfigured() || !db || !pid) { cb && cb(null); return; }
    db.ref(`${MP_ROOT}/users/${pid}`).once('value').then(s => {
      const u = s.val() || {};
      const plays = u.plays || {};
      cb && cb({
        uid: pid,
        displayName: u.displayName || u.nickname || '이름없음',
        accountName: u.nickname || null,
        nameHistory: Array.isArray(u.nameHistory) ? u.nameHistory : [],
        avatarLoadout: u.avatarLoadout || null,
        favGames: Array.isArray(u.favGames) ? u.favGames : [],
        topPlayed: Object.keys(plays).sort((a, b) => plays[b] - plays[a]).slice(0, 3).map(g => ({ game: g, count: plays[g] })),
        level: (typeof u.level === 'number') ? u.level : (typeof u.xp === 'number' ? levelFromXP(u.xp).level : null),
        createdAt: u.createdAt || null
      });
    }).catch(err => { console.error('[MP] 프로필 조회 실패', err && err.code || err); cb && cb(null); });
  }

  let friendsListRef = null;
  let friendPresenceRefs = {};
  let onFriendsCb = null;
  function onFriendsUpdate(cb) {
    onFriendsCb = cb;
    if (!isConfigured() || !db || !uid) { cb && cb([]); return; }
    if (friendsListRef) friendsListRef.off();
    friendsListRef = db.ref(`${MP_ROOT}/friends/${uid}`);
    startInbox();
    friendsListRef.on('value', snap => {
      const all = snap.val() || {};
      myFriendsCache = all; processInbox();
      // 목록에는 서로 수락한 친구만 (보낸 요청·거절은 안 보임)
      const friends = {}; Object.keys(all).forEach(k => { const t = all[k] && all[k].type; if (t === 'friend' || t === 'follow') friends[k] = all[k]; });
      const fUids = Object.keys(friends);
      Object.keys(friendPresenceRefs).forEach(fid => {
        if (!fUids.includes(fid)) { friendPresenceRefs[fid].off(); delete friendPresenceRefs[fid]; }
      });
      const result = {};
      function emit() { if (onFriendsCb) onFriendsCb(fUids.map(id => result[id]).filter(Boolean)); }
      if (fUids.length === 0) { emit(); return; }
      fUids.forEach(fid => {
        // 친구 목록 자체에 이미 이름이 저장돼 있으니(추가할 때 기록해둠), 프로필 조회가
        // 실패해도(권한 문제 등) 이 이름으로 일단 목록에 뜨게 한다.
        // 예전엔 이 fetch가 실패하면 result[fid]가 끝까지 안 채워져서 그 친구가 아무 에러도
        // 없이 통째로 목록에서 사라졌었다 — "친구가 안 보이는" 버그의 실제 원인 중 하나.
        result[fid] = {
          uid: fid, type: friends[fid].type || 'friend',
          nickname: friends[fid].name || '친구', accountName: null,
          online:false, game:null, level:null
        };
        emit();
        db.ref(`${MP_ROOT}/users/${fid}`).once('value').then(uSnap => {
          const uData = uSnap.val() || {};
          if (result[fid]) {
            result[fid].nickname = uData.displayName || uData.nickname || friends[fid].name || '친구';
            result[fid].accountName = uData.nickname || null;
            result[fid].avatar = uData.avatarLoadout || null;
            result[fid].level = (typeof uData.level === 'number') ? uData.level
                              : (typeof uData.xp === 'number' ? levelFromXP(uData.xp).level : null);
          }
          emit();
        }).catch(err => {
          console.error('[MP] 친구 프로필 조회 실패 (' + fid + '):', err && err.code || err);
          // 실패해도 위에서 이미 넣어둔 이름으로 계속 보인다 — 그냥 조용히 넘어간다
        });
        if (!friendPresenceRefs[fid]) {
          const pRef = db.ref(`${MP_ROOT}/presence/${fid}`);
          friendPresenceRefs[fid] = pRef;
          pRef.on('value', pSnap => {
            const p = pSnap.val() || {};
            if (result[fid]) {
              result[fid].online = !!p.online;
              result[fid].game = p.game || null;
              result[fid].room = p.room || null;
            }
            emit();
          }, err => {
            console.error('[MP] 친구 접속 상태 조회 실패 (' + fid + '):', err && err.code || err);
          });
        }
      });
    }, err => {
      console.error('[MP] 친구 목록 조회 실패:', err && err.code || err);
      if (onFriendsCb) onFriendsCb([], err);
    });
  }

  return {
    init,
    initAuthOnly,
    onAuthStateChange,
    update,
    onPlayersUpdate,
    leave,
    isConfigured,
    getRoomFromURL,
    getNickname,
    setNickname,
    getDisplayName,
    getAccountName,
    colorForUid,
    isLoggedIn,
    currentUser,
    signUp,
    signIn,
    signOutUser,
    submitScore,
    fetchLeaderboard,
    fetchMyScore,
    setPresence,
    chatSend, chatSys, chatOpen,
    EMOTES, playEmote, stopEmote, previewEmote, ownsEmote, hookRenderer:emoHook,
    serverNow,
    onGamePresence,
    addXP,
    getLevel,
    exclusiveEligible: (secret) => EXCLUSIVE_REWARDS.some(ex => ex.secret === secret && isExclusiveFor(ex)),
    fetchAccountXP,
    levelFromXP,
    claimLevelRewards,
    levelRewardTable,
    claimedLevels,
    searchUsers,
    addFriend,
    removeFriend,
    restoreAccountData,
    resetPassword,
    sendFriendRequest,
    acceptFriend,
    declineFriend,
    onFriendRequests,
    friendState,
    fetchProfile,
    getFavGames,
    setFavGames,
    fetchFavGames,
    headshot: (lo) => mpAvatarShot(lo, 'head'),
    headshot2D: mpHeadshot,
    avatarShot: mpAvatarShot,
    onFriendsUpdate,
    setAvatarLoadout,
    getLocalAvatarLoadout,
    getOwnedItems,
    isOwned,
    addOwnedItem,
    fetchAccountOwnedItems,
    fetchAccountAvatarLoadout,
    buildAvatar: mpBuildAvatar,
    attachAvatarItem: mpAttachAvatarItem,
    AVATAR_CATALOG,
    AVATAR_SLOTS,
    AVATAR_PALETTE,
    AVATAR_COLOR_SLOTS,
    AVATAR_FACES,
    faceTexture: mpFaceTexture,
    defaultAvatarLoadout: mpDefaultLoadout,
    getSecrets: mpGetSecrets,
    hasSecret: mpHasSecret,
    unlockSecret: mpUnlockSecret,
    visibleItems: mpVisible,
    get uid() { return uid; },
    get room() { return currentRoom; }
  };
})();

// const/let 전역 선언은 window 객체에 자동으로 안 붙기 때문에,
// 다른 <script> 태그에서 window.MP 로 체크하는 코드가 항상 실패하던 문제를 해결.
window.MP = MP;
