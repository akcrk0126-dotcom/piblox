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
  // ---- 프리미엄 컬렉션 (mpProItem 에서 만든다) ----
  { id:'pro_dominus',   slot:'head',   name:'그림자 군주 후드', icon:'🌑', color:0x7DF9FF, pro:true },
  { id:'pro_valkyrie',  slot:'head',   name:'발키리 헬름',      icon:'🪽', color:0xD7DCE4, pro:true },
  { id:'pro_kabuto',    slot:'head',   name:'사무라이 투구',    icon:'🏯', color:0x8E1520, pro:true },
  { id:'pro_fedora',    slot:'head',   name:'스파클 페도라',    icon:'✨', color:0x2B2F6E, pro:true },
  { id:'pro_snapback',  slot:'head',   name:'스트릿 스냅백',    icon:'🧢', color:0x121216, pro:true },
  { id:'pro_visor',     slot:'acc',    name:'사이버 바이저',    icon:'🥽', color:0x26E6FF, pro:true },
  { id:'pro_kitsune',   slot:'acc',    name:'여우 가면',        icon:'🦊', color:0xF6F2EA, pro:true },
  { id:'pro_oni',       slot:'acc',    name:'오니 마스크',      icon:'👹', color:0x8E1520, pro:true },
  { id:'pro_chain',     slot:'acc',    name:'아이스드 골드 체인', icon:'⛓️', color:0xF2C14E, pro:true },
  { id:'pro_bomber',    slot:'top',    name:'MA-1 봄버 재킷',   icon:'🧥', color:0x1B1D20, pro:true, cloth:true },
  { id:'pro_techwear',  slot:'top',    name:'테크웨어 재킷',    icon:'🦾', color:0x16181C, pro:true, cloth:true },
  { id:'pro_varsity',   slot:'top',    name:'바시티 재킷',      icon:'🏈', color:0x6E0F1E, pro:true, cloth:true },
  { id:'pro_haori',     slot:'top',    name:'청해파 하오리',    icon:'🌊', color:0x1C2142, pro:true, cloth:true },
  { id:'pro_jogger',    slot:'bottom', name:'테크 카고 조거',   icon:'🦿', color:0x1D1F23, pro:true, cloth:true },
  { id:'pro_hakama',    slot:'bottom', name:'하카마',           icon:'🥋', color:0x24242C, pro:true },
  { id:'pro_twinblades', slot:'back',  name:'쌍검',             icon:'⚔️', color:0x0E0E12, pro:true },
  { id:'pro_neonwings', slot:'back',   name:'네온 날개',        icon:'💠', color:0xFF2A6D, pro:true },
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
// 얼굴 이목구비 그리기 (256×256 기준). 배경은 그리지 않는다 — 머리 데칼(투명)과 프로필 사진(피부색 배경)이 같이 쓴다
function mpDrawFace(x, faceId){
  const INK = '#1b1b1f';
  x.lineCap = 'round'; x.lineJoin = 'round';
  const oval = (cx, cy, rx, ry, col)=>{ x.fillStyle = col || INK; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2); x.fill(); };
  const shine = (cx, cy, s)=>{ x.fillStyle = 'rgba(255,255,255,.92)'; x.beginPath(); x.ellipse(cx - 4*s, cy - 7*s, 4.2*s, 5.6*s, -.3, 0, Math.PI*2); x.fill(); x.beginPath(); x.arc(cx + 4*s, cy + 6*s, 2*s, 0, Math.PI*2); x.fill(); };
  const eye = (cx, cy, s)=>{ s = s || 1; oval(cx, cy, 12.5*s, 18*s); shine(cx, cy, s); };
  const stroke = (w, col)=>{ x.lineWidth = w; x.strokeStyle = col || INK; };
  const arc = (cx, cy, r, a0, a1, w)=>{ stroke(w || 10); x.beginPath(); x.arc(cx, cy, r, a0, a1); x.stroke(); };
  const line = (x0, y0, x1, y1, w)=>{ stroke(w || 10); x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); };
  const blush = (a)=>{ for (const cx of [70, 186]){ const g = x.createRadialGradient(cx, 150, 2, cx, 150, 24); g.addColorStop(0, 'rgba(255,110,120,' + a + ')'); g.addColorStop(1, 'rgba(255,110,120,0)'); x.fillStyle = g; x.fillRect(cx - 26, 124, 52, 52); } };
  const brow = (x0, y0, x1, y1)=>line(x0, y0, x1, y1, 8);
  switch (faceId){
    case 'face_grin': {
      eye(92, 100); eye(164, 100); blush(.28);
      // 활짝 웃는 입: 위는 거의 평평, 아래는 둥글게 — 윗니와 혀
      x.save(); x.beginPath(); x.moveTo(78, 136); x.quadraticCurveTo(128, 128, 178, 136); x.quadraticCurveTo(172, 196, 128, 198); x.quadraticCurveTo(84, 196, 78, 136); x.closePath();
      x.fillStyle = '#3a1016'; x.fill(); x.clip();
      x.fillStyle = '#ffffff'; x.fillRect(70, 126, 116, 18);
      x.fillStyle = '#e8616e'; x.beginPath(); x.ellipse(128, 196, 34, 20, 0, 0, Math.PI*2); x.fill(); x.restore();
      stroke(5); x.beginPath(); x.moveTo(78, 136); x.quadraticCurveTo(128, 128, 178, 136); x.quadraticCurveTo(172, 196, 128, 198); x.quadraticCurveTo(84, 196, 78, 136); x.closePath(); x.stroke();
      break; }
    case 'face_cool': {
      // 선글라스: 둥근 사다리꼴 렌즈 두 개 + 다리 + 반사광
      const lens = (cx)=>{ x.beginPath(); x.moveTo(cx - 32, 84); x.lineTo(cx + 32, 84); x.quadraticCurveTo(cx + 34, 120, cx + 8, 122); x.lineTo(cx - 8, 122); x.quadraticCurveTo(cx - 34, 120, cx - 32, 84); x.closePath(); };
      for (const cx of [90, 166]){ lens(cx); const g = x.createLinearGradient(0, 84, 0, 122); g.addColorStop(0, '#2b2f38'); g.addColorStop(1, '#0c0d10'); x.fillStyle = g; x.fill(); stroke(4, '#0a0a0c'); x.stroke();
        x.save(); lens(cx); x.clip(); x.fillStyle = 'rgba(255,255,255,.28)'; x.beginPath(); x.moveTo(cx - 24, 84); x.lineTo(cx - 10, 84); x.lineTo(cx - 28, 122); x.lineTo(cx - 40, 122); x.fill(); x.restore(); }
      line(120, 90, 136, 90, 7); line(56, 88, 34, 84, 7); line(200, 88, 222, 84, 7);
      // 한쪽만 올라간 미소
      stroke(9); x.beginPath(); x.moveTo(98, 160); x.quadraticCurveTo(132, 172, 164, 150); x.stroke();
      break; }
    case 'face_wink': {
      eye(92, 100); blush(.25);
      stroke(9); x.beginPath(); x.moveTo(148, 104); x.quadraticCurveTo(164, 88, 180, 104); x.stroke();   // 감은 눈 ^
      arc(128, 132, 36, .18*Math.PI, .82*Math.PI, 10);
      x.fillStyle = '#e8616e'; x.beginPath(); x.ellipse(146, 166, 10, 12, -.3, 0, Math.PI); x.fill();   // 살짝 내민 혀
      break; }
    case 'face_angry': {
      oval(92, 106, 12, 15); oval(164, 106, 12, 15); shine(92, 106, .8); shine(164, 106, .8);
      brow(66, 72, 112, 90); brow(190, 72, 144, 90);
      stroke(10); x.beginPath(); x.moveTo(94, 176); x.quadraticCurveTo(128, 150, 162, 176); x.stroke();
      line(100, 172, 96, 180, 6); line(156, 172, 160, 180, 6);
      break; }
    case 'face_sad': {
      eye(92, 104, .9); eye(164, 104, .9);
      brow(70, 84, 108, 72); brow(186, 84, 148, 72);
      stroke(10); x.beginPath(); x.moveTo(100, 176); x.quadraticCurveTo(128, 156, 156, 176); x.stroke();
      x.fillStyle = '#6ec6ff'; x.beginPath(); x.moveTo(170, 124); x.quadraticCurveTo(182, 146, 170, 152); x.quadraticCurveTo(158, 146, 170, 124); x.fill();   // 눈물
      break; }
    case 'face_shock': {
      for (const cx of [90, 166]){ oval(cx, 100, 22, 25, '#ffffff'); stroke(5); x.beginPath(); x.ellipse(cx, 100, 22, 25, 0, 0, Math.PI*2); x.stroke(); oval(cx, 102, 9, 10); shine(cx + 2, 104, .55); }
      brow(70, 62, 108, 58); brow(186, 62, 148, 58);
      oval(128, 166, 17, 22, '#3a1016'); x.fillStyle = '#e8616e'; x.beginPath(); x.ellipse(128, 178, 11, 8, 0, 0, Math.PI*2); x.fill(); stroke(5); x.beginPath(); x.ellipse(128, 166, 17, 22, 0, 0, Math.PI*2); x.stroke();
      break; }
    case 'face_dead': {
      for (const cx of [92, 164]){ line(cx - 16, 86, cx + 16, 116, 10); line(cx + 16, 86, cx - 16, 116, 10); }
      line(92, 160, 164, 160, 8); for (let i=0;i<5;i++){ const xx = 98 + i*15; line(xx, 150, xx, 170, 5); }
      break; }
    case 'face_robot': {
      x.fillStyle = '#2a2e35'; x.beginPath(); x.moveTo(58, 80); x.arcTo(198, 80, 198, 126, 18); x.arcTo(198, 126, 58, 126, 18); x.arcTo(58, 126, 58, 80, 18); x.arcTo(58, 80, 198, 80, 18); x.closePath(); x.fill();
      for (const cx of [96, 160]){ const g = x.createRadialGradient(cx, 103, 2, cx, 103, 22); g.addColorStop(0, '#d8fbff'); g.addColorStop(.45, '#38d6ff'); g.addColorStop(1, 'rgba(56,214,255,0)'); x.fillStyle = g; x.fillRect(cx - 24, 81, 48, 44); x.fillStyle = '#9ff0ff'; x.fillRect(cx - 14, 99, 28, 8); }
      x.fillStyle = '#2a2e35'; x.fillRect(90, 152, 76, 26); x.fillStyle = '#7d8691'; for (let i=0;i<6;i++) x.fillRect(96 + i*12, 156, 5, 18);
      x.fillStyle = '#7d8691'; for (const [bx, by] of [[50, 70], [206, 70], [50, 190], [206, 190]]){ x.beginPath(); x.arc(bx, by, 5, 0, Math.PI*2); x.fill(); }
      break; }
    case 'face_ditto': {
      oval(106, 98, 10, 10); oval(150, 98, 10, 10);
      stroke(9); x.beginPath(); x.moveTo(88, 138); x.quadraticCurveTo(108, 148, 130, 140); x.quadraticCurveTo(152, 132, 174, 124); x.stroke();
      break; }
    case 'face_blank': {
      oval(92, 106, 10, 13); oval(164, 106, 10, 13);
      line(102, 166, 154, 166, 9);
      break; }
    default: { // face_smile — 로블록스 기본 웃는 얼굴
      eye(92, 100); eye(164, 100); blush(.2);
      arc(128, 128, 40, .2*Math.PI, .8*Math.PI, 11);
    }
  }
}
// 프로필·2D용: 피부색 배경 + 얼굴 (정사각 256)
function mpFaceCanvas(faceId, skinHex){
  const key = faceId + '|' + skinHex;
  if (faceCanvasCache[key]) return faceCanvasCache[key];
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#' + (skinHex >>> 0).toString(16).padStart(6,'0'); x.fillRect(0, 0, 256, 256);
  mpDrawFace(x, faceId);
  faceCanvasCache[key] = c;
  return c;
}
// 3D 머리용: 투명 배경 데칼 (가로로 넓게 — 둥근 머리 앞쪽 144°를 감싼다)
const faceDecalCache = {};
function mpFaceDecalTexture(faceId){
  if (faceDecalCache[faceId]) return faceDecalCache[faceId];
  const T = window.THREE;
  const c = document.createElement('canvas'); c.width = 440; c.height = 256;
  const x = c.getContext('2d'); x.translate((440 - 256)/2, 0); mpDrawFace(x, faceId);
  const tex = new T.CanvasTexture(c); mpSRGB(tex); tex.anisotropy = 4;
  faceDecalCache[faceId] = tex; return tex;
}
function mpSRGB(tex){ const T = window.THREE; if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace; return tex; }   // 옛 three 는 렌더러 설정을 보고 mpLinearize 가 맞춘다
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
// 모서리가 둥근 상자 (BoxGeometry 와 같은 parameters 를 달아 둔다 — 게임들이 geometry.parameters.height 로 팔다리 피벗을 잡는다)
const mpGeoCache = {};
function mpRoundBox(w, h, d, r){
  const key = 'rb' + [w, h, d, r].map(v=>v.toFixed(3)).join('_'); if (mpGeoCache[key]) return mpGeoCache[key];
  const T = window.THREE; const N = 5; const g = new T.BoxGeometry(1, 1, 1, N, N, N);
  const P = g.attributes.position, NO = g.attributes.normal, H = [w/2, h/2, d/2];
  const remap = (c, hh)=>{ const k = Math.round((c + .5)*N); const tbl = [-hh, -hh + r*.29, -hh + r, hh - r, hh - r*.29, hh]; return tbl[k]; };
  const v = new T.Vector3(), q = new T.Vector3();
  for (let i=0;i<P.count;i++){ v.set(remap(P.getX(i), H[0]), remap(P.getY(i), H[1]), remap(P.getZ(i), H[2]));
    q.set(Math.max(-H[0] + r, Math.min(H[0] - r, v.x)), Math.max(-H[1] + r, Math.min(H[1] - r, v.y)), Math.max(-H[2] + r, Math.min(H[2] - r, v.z)));
    const n = v.clone().sub(q); if (n.lengthSq() > 1e-12){ n.normalize(); v.copy(q).addScaledVector(n, r); NO.setXYZ(i, n.x, n.y, n.z); }
    P.setXYZ(i, v.x, v.y, v.z); }
  // UV 도 옮긴 위치에 맞춰 다시 편다 (안 그러면 면 가운데 20% 만 늘어나 보여서 옷 무늬·글자가 잘린다)
  const UV = g.attributes.uv, per = (N + 1)*(N + 1), F = [[2, 1, -1, -1], [2, 1, 1, -1], [0, 2, 1, 1], [0, 2, 1, -1], [0, 1, 1, -1], [0, 1, -1, -1]];
  for (let i=0;i<P.count;i++){ const f = F[Math.floor(i/per)], c = [P.getX(i), P.getY(i), P.getZ(i)]; UV.setXY(i, (c[f[0]]/f[2] + H[f[0]])/(2*H[f[0]]), 1 - (c[f[1]]/f[3] + H[f[1]])/(2*H[f[1]])); }
  UV.needsUpdate = true;
  P.needsUpdate = true; NO.needsUpdate = true; g.computeBoundingSphere();
  g.parameters = { width:w, height:h, depth:d };
  mpGeoCache[key] = g; return g; }
// 둥근 원기둥 머리 (로블록스 클래식 머리)
function mpHeadGeo(R, H, c){
  const key = 'hd' + R + '_' + H + '_' + c; if (mpGeoCache[key]) return mpGeoCache[key];
  const T = window.THREE; const pts = [new T.Vector2(0, -H/2)];
  for (let i=0;i<=6;i++){ const a = -Math.PI/2 + i/6*Math.PI/2; pts.push(new T.Vector2(R - c + Math.cos(a)*c, -H/2 + c + Math.sin(a)*c)); }
  for (let i=0;i<=6;i++){ const a = i/6*Math.PI/2; pts.push(new T.Vector2(R - c + Math.cos(a)*c, H/2 - c + Math.sin(a)*c)); }
  pts.push(new T.Vector2(0, H/2));
  const g = new T.LatheGeometry(pts, 36); g.computeVertexNormals(); g.scale(1, 1, .96);
  g.parameters = Object.assign({}, g.parameters, { width:R*2, height:H, depth:R*2*.96 });
  mpGeoCache[key] = g; return g; }

function mpBuildR6Avatar(colors){
  const T = window.THREE;
  const group = new T.Group();
  const C = colors || {};
  const S = AVATAR_STUD;
  const skinHex  = mpPaletteColor('skin',  C.skin);
  const shirtHex = mpPaletteColor('shirt', C.shirt);
  const pantsHex = mpPaletteColor('pants', C.pants);
  const legW=1*S, legH=2*S, legD=1*S;
  const torsoW=2*S, torsoH=2*S, torsoD=1*S;
  const armW=1*S, armH=2*S, armD=1*S;
  // 머리: 납작한 벽돌 대신 둥근 원기둥 (지름 1.26스터드)
  const headR = 0.39, headH = 0.74, headW = headR*2, headD = headR*2*.96;
  const legTopY = legH, torsoCenterY = legTopY+torsoH/2, headCenterY = legTopY+torsoH+headH/2 - 0.02;
  const std = (hex)=>new T.MeshStandardMaterial({ color:hex, roughness:.62, metalness:0 });

  const legL = new T.Mesh(mpRoundBox(legW,legH,legD,.05), std(pantsHex));
  legL.position.set(-legW/2, legH/2, 0); group.add(legL);
  const legR = new T.Mesh(mpRoundBox(legW,legH,legD,.05), std(pantsHex));
  legR.position.set(legW/2, legH/2, 0); group.add(legR);
  const torso = new T.Mesh(mpRoundBox(torsoW,torsoH,torsoD,.06), std(shirtHex));
  torso.position.set(0, torsoCenterY, 0); group.add(torso);
  const armL = new T.Mesh(mpRoundBox(armW,armH,armD,.07), std(skinHex));
  armL.position.set(-(torsoW/2+armW/2), torsoCenterY+0.05, 0); group.add(armL);
  const armR = new T.Mesh(mpRoundBox(armW,armH,armD,.07), std(skinHex));
  armR.position.set((torsoW/2+armW/2), torsoCenterY+0.05, 0); group.add(armR);
  const head = new T.Mesh(mpHeadGeo(headR, headH, .13), std(skinHex));
  head.position.set(0, headCenterY, 0); group.add(head);
  // 얼굴: 머리 앞쪽을 감싸는 투명 데칼 (머리 재질은 단일 재질 그대로 — 게임들이 head.material.color 로 팀 색을 칠한다)
  if (C.face){
    const th = 1.08, decalH = headR*2*th*256/440;
    const fg = new T.CylinderGeometry(headR + .006, headR + .006, decalH, 40, 1, true, -th, th*2); fg.scale(1, 1, .96);
    const faceMat = new T.MeshStandardMaterial({ map:mpFaceDecalTexture(C.face), transparent:true, alphaTest:.04, roughness:.55, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2 });
    const faceMesh = new T.Mesh(fg, faceMat);
    faceMesh.position.y = .01; faceMesh.renderOrder = 1;
    faceMesh.userData.isFace = true;
    head.add(faceMesh);
  }

  group.userData = { legTopY, torsoCenterY, headCenterY, torsoW, torsoH, torsoD, headW, headH, headD, headR, legW, legH, armW, armH,
                     skinHex, shirtHex, pantsHex, parts:{ legL, legR, torso, armL, armR, head } };
  return group;
}

// ---------------------------------------------------------------------
//  아바타 아이템 (모자 · 장신구 · 상의 · 하의 · 후면)
//  가능하면 해당 신체 부위(머리·몸통·팔·다리)에 자식으로 붙인다 → 게임이 팔다리를 흔들거나 머리를 돌려도 같이 움직인다.
//  부위 정보(userData.parts)가 없는 캐릭터(직접 만든 캐릭터)는 예전처럼 아이템 그룹에 절대 위치로 붙인다.
// ---------------------------------------------------------------------
const mpTexCache = {};
function mpCanvasTex(key, w, h, draw){ if (mpTexCache[key]) return mpTexCache[key]; const T = window.THREE; const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); mpSRGB(t); t.anisotropy = 4; mpTexCache[key] = t; return t; }
const mpHex = n => '#' + (n >>> 0).toString(16).padStart(6, '0');
function mpShade(hex, k){ const r = Math.min(255, Math.max(0, ((hex >> 16) & 255)*k))|0, g = Math.min(255, Math.max(0, ((hex >> 8) & 255)*k))|0, b = Math.min(255, Math.max(0, (hex & 255)*k))|0; return (r << 16) | (g << 8) | b; }
// 옷 무늬 텍스처 (앞면 / 옆·뒤 / 소매)
function mpClothTex(id, part, hex){
  return mpCanvasTex('cl_' + id + '_' + part + '_' + hex, 256, 256, (x, w, h)=>{ x.scale(2, 2); w = 128; h = 128;
    const base = mpHex(hex), dark = mpHex(mpShade(hex, .72)), light = mpHex(mpShade(hex, 1.18));
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    // 천 질감
    for (let i=0;i<260;i++){ x.fillStyle = 'rgba(' + (Math.random() < .5 ? '0,0,0' : '255,255,255') + ',' + (.015 + Math.random()*.025) + ')'; x.fillRect(Math.random()*w, Math.random()*h, 1.5, 1.5); }
    const seam = (x0, y0, x1, y1)=>{ x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 2; x.setLineDash([4, 3]); x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); x.setLineDash([]); };
    if (id === 'checkered'){ for (let i=0;i<8;i++){ x.fillStyle = 'rgba(20,20,30,.28)'; x.fillRect(i*16, 0, 7, h); x.fillRect(0, i*16, w, 7); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(i*16 + 11, 0, 2, h); x.fillRect(0, i*16 + 11, w, 2); } }
    if (id === 'stripes'){ for (let i=0;i<6;i++){ x.fillStyle = '#2C3E80'; x.fillRect(0, 8 + i*22, w, 10); } }
    if (id === 'sweater'){ x.strokeStyle = dark; x.lineWidth = 2; for (let yy=0; yy<h; yy+=8) for (let xx=0; xx<w; xx+=8){ x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + 4, yy + 6); x.lineTo(xx + 8, yy); x.stroke(); }
      if (part === 'front'){ x.fillStyle = '#F2E6C8'; x.fillRect(0, 46, w, 12); x.fillRect(0, 70, w, 12); x.fillStyle = '#C0392B'; for (let i=0;i<8;i++){ x.beginPath(); x.moveTo(i*16 + 8, 58); x.lineTo(i*16 + 14, 64); x.lineTo(i*16 + 8, 70); x.lineTo(i*16 + 2, 64); x.fill(); } } }
    if (id === 'hoodie' && part === 'front'){ x.fillStyle = dark; x.beginPath(); x.moveTo(26, 84); x.lineTo(102, 84); x.lineTo(110, 124); x.lineTo(18, 124); x.closePath(); x.fill(); seam(26, 86, 102, 86);
      x.strokeStyle = '#eeeeee'; x.lineWidth = 3; x.beginPath(); x.moveTo(54, 0); x.lineTo(50, 40); x.moveTo(74, 0); x.lineTo(78, 40); x.stroke(); x.fillStyle = '#ddd'; x.fillRect(48, 38, 5, 7); x.fillRect(76, 38, 5, 7); }
    if (id === 'leather'){ x.fillStyle = 'rgba(255,255,255,.08)'; for (let i=0;i<10;i++) x.fillRect(Math.random()*w, Math.random()*h, 30, 1);
      if (part === 'front'){ x.fillStyle = '#c7c9cc'; x.fillRect(62, 0, 4, h); x.fillStyle = light; x.beginPath(); x.moveTo(30, 0); x.lineTo(62, 0); x.lineTo(48, 46); x.closePath(); x.fill(); x.beginPath(); x.moveTo(98, 0); x.lineTo(66, 0); x.lineTo(80, 46); x.closePath(); x.fill(); seam(14, 80, 46, 80); seam(82, 80, 114, 80); } }
    if (id === 'labcoat'){ if (part === 'front'){ x.fillStyle = '#c9d0d4'; x.fillRect(62, 0, 4, h); x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(36, 0); x.lineTo(62, 0); x.lineTo(54, 50); x.closePath(); x.fill(); x.beginPath(); x.moveTo(92, 0); x.lineTo(66, 0); x.lineTo(74, 50); x.closePath(); x.fill();
        x.strokeStyle = '#b6bec3'; x.lineWidth = 2; x.strokeRect(80, 30, 22, 18); x.fillStyle = '#2E6DB4'; x.fillRect(84, 24, 3, 14); x.fillStyle = '#9aa3aa'; for (let i=0;i<3;i++){ x.beginPath(); x.arc(56, 66 + i*20, 3, 0, 7); x.fill(); } } }
    if (id === 'armortop'){ x.fillStyle = 'rgba(0,0,0,.25)'; for (let i=1;i<4;i++) x.fillRect(0, i*32 - 2, w, 3); x.fillStyle = 'rgba(255,255,255,.18)'; for (let i=0;i<4;i++) x.fillRect(0, i*32 + 2, w, 3); x.fillStyle = '#5b636c'; for (let i=0;i<4;i++) for (let j=0;j<6;j++){ x.beginPath(); x.arc(10 + j*22, i*32 + 16, 2.5, 0, 7); x.fill(); } }
    if (id === 'vest'){ if (part === 'front'){ x.fillStyle = '#2C3327'; x.fillRect(26, 0, 18, h); x.fillRect(84, 0, 18, h); x.fillStyle = '#3B4433'; for (const px of [10, 46, 82]){ x.fillRect(px, 70, 34, 34); x.strokeStyle = 'rgba(0,0,0,.4)'; x.strokeRect(px, 70, 34, 34); x.fillStyle = '#2C3327'; x.fillRect(px, 70, 34, 9); x.fillStyle = '#3B4433'; } } else { x.fillStyle = 'rgba(0,0,0,.18)'; for (let i=0;i<6;i++) x.fillRect(0, i*22 + 6, w, 4); } }
    if (id === 'tuxedo'){ if (part === 'front'){ x.fillStyle = '#f5f5f5'; x.beginPath(); x.moveTo(40, 0); x.lineTo(88, 0); x.lineTo(64, 110); x.closePath(); x.fill(); x.fillStyle = '#2a2a30'; x.beginPath(); x.moveTo(40, 0); x.lineTo(56, 0); x.lineTo(64, 70); x.lineTo(46, 30); x.closePath(); x.fill(); x.beginPath(); x.moveTo(88, 0); x.lineTo(72, 0); x.lineTo(64, 70); x.lineTo(82, 30); x.closePath(); x.fill();
        x.fillStyle = '#111'; for (let i=0;i<3;i++){ x.beginPath(); x.arc(64, 40 + i*20, 3, 0, 7); x.fill(); } x.fillStyle = '#f5f5f5'; x.fillRect(22, 30, 14, 4); } }
    // ---- 프리미엄 옷 무늬 ----
    if (id === 'pro_bomber'){ // 누빈 나일론 + 가운데 지퍼 + 왼가슴 패치
      for (let yy=8; yy<h; yy+=20){ const gr = x.createLinearGradient(0, yy - 8, 0, yy + 12); gr.addColorStop(0, 'rgba(255,255,255,.07)'); gr.addColorStop(.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.18)'); x.fillStyle = gr; x.fillRect(0, yy - 8, w, 20); }
      if (part === 'front'){ x.fillStyle = '#FF6A13'; x.fillRect(84, 26, 22, 14); x.fillStyle = '#fff'; x.font = '700 7px sans-serif'; x.fillText('MA-1', 86, 36); x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 1; x.strokeRect(84, 26, 22, 14);
        seam(18, 70, 40, 110); seam(110, 70, 88, 110); }
      if (part === 'back'){ x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '900 14px Arial Black, sans-serif'; x.textAlign = 'center'; x.fillText('FLIGHT CREW', 64, 40); x.fillStyle = '#FF6A13'; x.fillRect(34, 46, 60, 3); } }
    if (id === 'pro_techwear'){ // 매트한 쉘 + 비대칭 지퍼 + 작은 글자
      x.fillStyle = 'rgba(255,255,255,.035)'; for (let i=0;i<w;i+=6) x.fillRect(i, 0, 1, h);
      if (part === 'front'){ x.strokeStyle = '#3a3e45'; x.lineWidth = 3; x.beginPath(); x.moveTo(78, 0); x.lineTo(70, 50); x.lineTo(70, h); x.stroke(); x.fillStyle = '#9aa0a8'; x.fillRect(66, 6, 6, 9);
        seam(8, 92, 120, 92); x.fillStyle = 'rgba(255,255,255,.7)'; x.font = '700 6px monospace'; x.fillText('PB-07 // SYSTEMS', 10, 118); x.fillStyle = '#FF4A1C'; x.fillRect(10, 104, 18, 4); }
      if (part === 'back'){ x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '700 9px monospace'; x.fillText('[ RL ] / 07', 36, 30); x.fillStyle = 'rgba(255,255,255,.18)'; for (let i=0;i<5;i++) x.fillRect(20, 50 + i*12, 88, 2); }
      if (part === 'pant' || part === 'sleeve'){ seam(w*.3, 0, w*.3, h); } }
    if (id === 'pro_varsity'){ // 울 몸판 + 크림 가죽 소매 + 등 아치 글자
      if (part === 'sleeve'){ x.fillStyle = '#EDE3D0'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(120,90,50,.08)'; for (let i=0;i<180;i++) x.fillRect(Math.random()*w, Math.random()*h, 2, 2); seam(0, 4, w, 4); }
      else { x.fillStyle = 'rgba(255,255,255,.04)'; for (let i=0;i<400;i++) x.fillRect(Math.random()*w, Math.random()*h, 1, 1); }
      if (part === 'back'){ x.fillStyle = '#EDE3D0'; x.strokeStyle = '#E2B13C'; x.lineWidth = 3; x.font = '900 15px Georgia, serif'; x.textAlign = 'center';
        const s = 'PIBLOX'; for (let i=0;i<s.length;i++){ const a = -.6 + i*.24; x.save(); x.translate(64 + Math.sin(a)*70, 92 - Math.cos(a)*70); x.rotate(a); x.strokeText(s[i], 0, 0); x.fillText(s[i], 0, 0); x.restore(); }
        x.font = '900 40px Georgia, serif'; x.lineWidth = 5; x.strokeText('07', 64, 100); x.fillText('07', 64, 100); }
      if (part === 'front'){ x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(63, 0, 2, h); } }
    if (id === 'pro_haori'){ // 남색 바탕에 청해파(물결) 무늬 + 흰 옷깃 + 가문 문장
      x.strokeStyle = 'rgba(255,255,255,.32)'; x.lineWidth = 1.4; const R = 12;
      for (let row=-1; row<12; row++) for (let col=-1; col<7; col++){ const cx = col*R*2 + (row%2 ? R : 0), cy = row*R*.9 + R; for (let k=3;k>=1;k--){ x.beginPath(); x.arc(cx, cy, R*k/3, Math.PI, 0); x.stroke(); } }
      if (part === 'front'){ // 트인 앞섶 사이로 보이는 안쪽 기모노 + 흰 옷깃 + 짙은 깃 단
        x.fillStyle = '#26262c'; x.beginPath(); x.moveTo(34, 0); x.lineTo(94, 0); x.lineTo(76, h); x.lineTo(52, h); x.closePath(); x.fill();
        x.lineCap = 'butt'; x.strokeStyle = '#F2EEE4'; x.lineWidth = 9; x.beginPath(); x.moveTo(44, 0); x.lineTo(66, 70); x.moveTo(84, 0); x.lineTo(62, 70); x.stroke();
        x.strokeStyle = '#0b0b12'; x.lineWidth = 12; x.beginPath(); x.moveTo(30, 0); x.lineTo(50, h); x.moveTo(98, 0); x.lineTo(78, h); x.stroke(); }
      if (part === 'back'){ x.fillStyle = '#F2EEE4'; x.beginPath(); x.arc(64, 34, 14, 0, 7); x.fill(); x.fillStyle = mpHex(hex); for (let k=0;k<3;k++){ const a = k/3*Math.PI*2; x.beginPath(); x.arc(64 + Math.sin(a)*5, 34 - Math.cos(a)*5, 6, 0, 7); x.fill(); } } }
    if (id === 'pro_jogger' && part === 'pant'){ x.fillStyle = 'rgba(255,255,255,.035)'; for (let i=0;i<w;i+=6) x.fillRect(i, 0, 1, h); seam(10, 54, 50, 62); seam(78, 54, 118, 62); }
    if (part === 'sleeve' && id !== 'armortop' && id !== 'pro_varsity' && id !== 'pro_haori'){ x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, h - 14, w, 14); if (id === 'tuxedo' || id === 'labcoat'){ x.fillStyle = '#f5f5f5'; x.fillRect(0, h - 10, w, 10); } }
    // 바지
    if (part === 'pant'){ seam(w*.5, 0, w*.5, h); x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(0, 0, w, 10);
      if (id === 'jeans'){ x.fillStyle = 'rgba(255,255,255,.07)'; for (let i=0;i<40;i++) x.fillRect(Math.random()*w, Math.random()*h, 1, 18); seam(10, 16, 40, 30); x.strokeStyle = '#d4a03a'; x.lineWidth = 1.5; x.setLineDash([3, 3]); x.beginPath(); x.moveTo(6, 0); x.lineTo(6, h); x.moveTo(w - 6, 0); x.lineTo(w - 6, h); x.stroke(); x.setLineDash([]); }
      if (id === 'track'){ x.fillStyle = '#E8E8E8'; x.fillRect(w - 18, 0, 8, h); x.fillRect(10, 0, 8, h); }
      if (id === 'cargo'){ x.fillStyle = mpHex(mpShade(hex, .85)); x.fillRect(20, 56, 40, 40); x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; x.strokeRect(20, 56, 40, 40); x.fillRect(20, 56, 40, 10); } }
  }); }
// 텍스처를 앞/옆/뒤로 나눠 입힌 옷 판 (부위 메쉬를 살짝 감싸는 크기)
function mpClothMesh(id, hex, w, h, d, r, kind){
  const T = window.THREE; const geo = mpRoundBox(w, h, d, r);
  const mk = (part)=>new T.MeshStandardMaterial({ color:0xffffff, map:mpClothTex(id, part, hex), roughness: id === 'leather' ? .38 : id === 'armortop' ? .3 : .8, metalness: id === 'armortop' ? .6 : 0 });
  const side = mk(kind === 'pant' ? 'pant' : kind === 'sleeve' ? 'sleeve' : 'side'), front = kind === 'top' ? mk('front') : side, back = kind === 'top' ? mk('back') : side;
  return new T.Mesh(geo, [side, side, side, side, front, back]); }

function mpAttachAvatarItem(avatarGroup, item){
  const T = window.THREE;
  if (!item) return null;
  const u = avatarGroup.userData || {};
  const P = u.parts || null;
  const col = new T.Color(item.color);
  const g = new T.Group();
  const mat = (opts) => new T.MeshStandardMaterial(Object.assign({ color:col, roughness:.6 }, opts||{}));
  const M = (hex, o) => new T.MeshStandardMaterial(Object.assign({ color:hex, roughness:.6 }, o||{}));
  const gold = () => M(0xE2B13C, { metalness:.85, roughness:.25 });
  const mesh = (geo, m, x, y, z, parent) => { const o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); (parent || g).add(o); return o; };
  // 부위 기준점: parts 가 있으면 그 부위 메쉬에 붙이고(로컬 0,0,0 = 부위 중심), 없으면 아이템 그룹의 절대 위치
  const anchor = (part, cx, cy, cz) => { const a = new T.Group(); if (P && P[part]){ P[part].add(a); a.userData.mpItem = item.id; (g.userData.attached = g.userData.attached || []).push(a); } else { a.position.set(cx || 0, cy || 0, cz || 0); g.add(a); } return a; };
  const headR = u.headR || Math.max(u.headW || 1.24, u.headD || .62)*.5, headH = u.headH || .62, HT = headH/2;   // 머리 반지름 · 머리 꼭대기(머리 중심 기준)
  const FZ = u.headR ? headR*.96 : (u.headD || .62)/2;   // 얼굴 앞면 z
  const lathe = (pts, seg) => new T.LatheGeometry(pts.map(p=>new T.Vector2(p[0], p[1])), seg || 32);

  const proCtx = { T, item, u, anchor, mesh, M, mat, gold, lathe, headR, HT, FZ, P, g };
  if (item.pro && !item.cloth){ mpProItem(proCtx); }
  else if (item.slot === 'head'){
    const H = anchor('head', 0, u.headCenterY || 0, 0);
    const top = HT;
    if (item.id === 'crown'){
      const band = mesh(lathe([[headR*.86, 0], [headR*.9, .02], [headR*.92, .2], [headR*.96, .24], [headR*.9, .24], [headR*.86, .04]]), gold(), 0, top - .06, 0, H);
      for (let i=0;i<5;i++){ const a = i/5*Math.PI*2; const sp = mesh(new T.ConeGeometry(.075, .26, 4), gold(), Math.sin(a)*headR*.9, top + .28, Math.cos(a)*headR*.9, H); sp.rotation.y = a + Math.PI/4;
        mesh(new T.SphereGeometry(.035, 10, 8), gold(), Math.sin(a)*headR*.9, top + .42, Math.cos(a)*headR*.9, H);
        mesh(new T.OctahedronGeometry(.045), M(i%2 ? 0x2F6BFF : 0xE0303A, { metalness:.2, roughness:.1, emissive:i%2 ? 0x0a1a55 : 0x550a0e }), Math.sin(a + Math.PI/5)*headR*.95, top + .06, Math.cos(a + Math.PI/5)*headR*.95, H); }
      mesh(new T.CylinderGeometry(headR*.86, headR*.86, .03, 32), M(0x8B1A2A, { roughness:.9 }), 0, top - .02, 0, H);
    } else if (item.id === 'wizardhat'){
      mesh(lathe([[0, .01], [.56, 0], [.6, .02], [.5, .05], [.3, .07], [0, .07]]), mat({ roughness:.85 }), 0, top - .04, 0, H);
      let y = top + .03, r0 = .3, tilt = 0; const cone = new T.Group(); cone.position.y = y; H.add(cone); let cur = cone;
      for (let i=0;i<4;i++){ const h = .2, r1 = r0*.68; const seg = mesh(new T.CylinderGeometry(r1, r0, h, 24, 1, i === 3), mat({ roughness:.85 }), 0, h/2, 0, cur); const nx = new T.Group(); nx.position.y = h; nx.rotation.z = -.16 - i*.06; cur.add(nx); cur = nx; r0 = r1; }
      mesh(new T.ConeGeometry(r0, .12, 16), mat({ roughness:.85 }), 0, .06, 0, cur);
      mesh(new T.CylinderGeometry(.305, .305, .06, 24, 1, true), M(0xE2B13C, { roughness:.4, metalness:.5, side:T.DoubleSide }), 0, top + .06, 0, H);
      const star = new T.Shape(); for (let i=0;i<10;i++){ const a = i/10*Math.PI*2, rr = i%2 ? .028 : .06; star[i ? 'lineTo' : 'moveTo'](Math.sin(a)*rr, Math.cos(a)*rr); }
      for (const [sx, sy] of [[.08, .18], [-.1, .32]]){ const s = mesh(new T.ExtrudeGeometry(star, { depth:.01, bevelEnabled:false }), M(0xFFE14D, { emissive:0x806000 }), sx, top + sy, .24 - sy*.25, H); s.rotation.x = -.35; }
    } else if (item.id === 'catears' || item.id === 'bunnyears'){
      const bunny = item.id === 'bunnyears';
      mesh(new T.TorusGeometry(headR*1.02, .022, 8, 32, Math.PI), M(bunny ? 0xEDE7EA : 0x2a2a2e, { roughness:.5 }), 0, top - headR*1.02 + .02, -.03, H);
      [-1, 1].forEach(s=>{ const ear = new T.Group(); ear.position.set(s*headR*.62, top - .02, -.02); ear.rotation.z = -s*(bunny ? .14 : .32); if (bunny) ear.scale.setScalar(1.2); H.add(ear);
        if (bunny){ const e = mesh(lathe([[0, 0], [.06, .02], [.085, .14], [.08, .3], [.05, .42], [0, .46]], 20), mat({ roughness:.85 }), 0, 0, 0, ear); e.scale.z = .55; const tip = new T.Group(); ear.rotation.x = -.1;
          const inner = mesh(lathe([[0, .04], [.045, .06], [.055, .16], [.048, .3], [0, .4]], 16), M(0xF7A8C4, { roughness:.9 }), 0, 0, .02, ear); inner.scale.z = .3; }
        else { const sh = new T.Shape(); sh.moveTo(-.13, 0); sh.quadraticCurveTo(-.08, .2, 0, .27); sh.quadraticCurveTo(.08, .2, .13, 0); sh.closePath();
          const e = mesh(new T.ExtrudeGeometry(sh, { depth:.05, bevelEnabled:true, bevelThickness:.02, bevelSize:.02, bevelSegments:3, curveSegments:10 }), mat({ roughness:.75 }), 0, 0, -.025, ear);
          const sh2 = new T.Shape(); sh2.moveTo(-.07, .03); sh2.quadraticCurveTo(-.04, .15, 0, .19); sh2.quadraticCurveTo(.04, .15, .07, .03); sh2.closePath();
          mesh(new T.ShapeGeometry(sh2, 10), M(0xF7A8C4, { roughness:.9 }), 0, 0, .05, ear); } });
    } else if (item.id === 'helmet'){
      mesh(new T.SphereGeometry(headR*1.12, 32, 16, 0, Math.PI*2, 0, Math.PI*.5), mat({ metalness:.45, roughness:.45 }), 0, top - .22, 0, H);
      const rim = mesh(new T.TorusGeometry(headR*1.13, .035, 8, 40), mat({ metalness:.45, roughness:.45 }), 0, top - .22, 0, H); rim.rotation.x = Math.PI/2; rim.scale.set(1, 1.08, 1);
      mesh(new T.BoxGeometry(.05, .3, .02), M(0x2a2a20), headR*1.0, top - .36, .06, H).rotation.z = .1; mesh(new T.BoxGeometry(.05, .3, .02), M(0x2a2a20), -headR*1.0, top - .36, .06, H).rotation.z = -.1;
    } else if (item.id === 'cap'){
      mesh(new T.SphereGeometry(headR*1.04, 32, 14, 0, Math.PI*2, 0, Math.PI*.5), mat({ roughness:.8 }), 0, top - .16, 0, H);
      for (let i=0;i<6;i++){ const s = mesh(new T.TorusGeometry(headR*1.045, .006, 4, 24, Math.PI/2), M(mpShade(item.color, .7)), 0, top - .16, 0, H); s.rotation.set(0, i/6*Math.PI*2, Math.PI/2); }
      const brim = mesh(new T.CylinderGeometry(headR*.95, headR*.95, .03, 32, 1, false, -1.05, 2.1), mat({ roughness:.8 }), 0, top - .15, .2, H); brim.scale.z = 1.05; brim.rotation.x = .12;
      mesh(new T.SphereGeometry(.035, 10, 8), mat({ roughness:.7 }), 0, top - .16 + headR*1.04, 0, H);
      const logo = mesh(new T.CircleGeometry(.07, 20), M(0xffffff, { roughness:.8 }), 0, top - .02, headR*.98, H); logo.rotation.x = -.5;
    } else if (item.id === 'beanie'){
      const pts = []; for (let i=0;i<=14;i++){ const a = i/14*Math.PI/2; pts.push([Math.cos(a)*headR*1.08 + (i < 5 ? Math.sin(i*2.4)*.004 : 0), Math.sin(a)*(headR*1.25) ]); } pts.push([0, headR*1.25]);
      mesh(lathe(pts), mat({ roughness:.95 }), 0, top - .16, 0, H);
      const ribs = []; for (let i=0;i<=8;i++) ribs.push([headR*1.1 + (i%2 ? .014 : 0), i*.018]); mesh(lathe(ribs, 48), mat({ roughness:.95 }), 0, top - .2, 0, H);
      const pom = mesh(new T.IcosahedronGeometry(.11, 2), M(0xF2F2F2, { roughness:1, flatShading:true }), 0, top - .16 + headR*1.25 + .06, 0, H);
    } else if (item.id === 'horns'){
      [-1, 1].forEach(s=>{ const pts = []; for (let i=0;i<=10;i++){ const t = i/10; pts.push(new T.Vector3(s*(.05 + Math.sin(t*1.6)*.22), t*.34 - Math.max(0, t - .6)*.12, -Math.sin(t*2.4)*.06)); }
        const curve = new T.CatmullRomCurve3(pts); const tube = new T.TubeGeometry(curve, 20, .055, 10, false); const p = tube.attributes.position;
        // 끝으로 갈수록 가늘게
        for (let i=0;i<p.count;i++){ const ring = Math.floor(i/11), t = ring/20; const c = curve.getPoint(t); const k = 1 - t*.85; p.setXYZ(i, c.x + (p.getX(i) - c.x)*k, c.y + (p.getY(i) - c.y)*k, c.z + (p.getZ(i) - c.z)*k); } tube.computeVertexNormals();
        mesh(tube, mat({ roughness:.55 }), s*headR*.45, top - .04, 0, H); });
    } else if (item.id === 'halo'){
      const ring = mesh(new T.TorusGeometry(.3, .035, 12, 48), new T.MeshStandardMaterial({ color:col, emissive:col, emissiveIntensity:1.1, roughness:.3 }), 0, top + .3, 0, H); ring.rotation.x = Math.PI/2 - .12;
      const glow = mesh(new T.TorusGeometry(.3, .08, 8, 40), new T.MeshBasicMaterial({ color:col, transparent:true, opacity:.22, depthWrite:false }), 0, top + .3, 0, H); glow.rotation.x = ring.rotation.x;
    } else if (item.id === 'tophat'){
      mesh(lathe([[0, 0], [headR*1.45, -.01], [headR*1.5, .02], [headR*1.4, .04], [headR*.98, .05], [headR*.96, .1], [headR*1.0, .55], [headR*1.03, .6], [0, .6]], 40), mat({ roughness:.55 }), 0, top - .08, 0, H);
      mesh(new T.CylinderGeometry(headR*.995, headR*.975, .1, 40, 1, true), M(0x9B2335, { roughness:.6 }), 0, top + .04, 0, H);
    } else if (item.id === 'dittonubs'){
      [-1,1].forEach(side=>{ const nub = mesh(new T.SphereGeometry(.15, 16, 12), mat({ roughness:.95 }), side*.24, top + .05, -.04, H); nub.scale.set(1, 1.5, 1); });
      const bump = mesh(new T.SphereGeometry(headR*1.02, 24, 10, 0, Math.PI*2, 0, Math.PI*.5), mat({ roughness:.95 }), 0, top - .1, 0, H); bump.scale.set(1, .45, 1);
    } else if (item.id === 'partyhat'){
      const tex = mpCanvasTex('party', 128, 128, (x, w, h)=>{ x.fillStyle = '#FF5FA2'; x.fillRect(0, 0, w, h); const cs = ['#FFE14D', '#4DD2FF', '#7CFF6B']; for (let i=0;i<10;i++){ x.fillStyle = cs[i%3]; x.save(); x.translate(0, i*14); x.rotate(-.35); x.fillRect(-20, 0, 200, 6); x.restore(); } for (let i=0;i<30;i++){ x.fillStyle = cs[i%3]; x.beginPath(); x.arc(Math.random()*w, Math.random()*h, 2.5, 0, 7); x.fill(); } });
      const cone = mesh(new T.ConeGeometry(.27, .62, 32, 1, true), new T.MeshStandardMaterial({ map:tex, roughness:.55, side:T.DoubleSide }), 0, top + .26, 0, H); cone.rotation.z = -.1;
      const pom = mesh(new T.IcosahedronGeometry(.075, 2), M(0xFFE14D, { roughness:1, flatShading:true }), -.06, top + .58, 0, H);
      const ruffle = mesh(new T.TorusGeometry(.27, .03, 8, 32), M(0xFFE14D, { roughness:.9 }), 0, top - .04, 0, H); ruffle.rotation.x = Math.PI/2;
    } else if (item.id === 'piratehat'){
      mesh(lathe([[0, 0], [headR*1.05, 0], [headR*1.0, .18], [headR*.8, .3], [0, .32]], 32), mat({ roughness:.75 }), 0, top - .1, 0, H);
      for (let i=0;i<3;i++){ const a = i/3*Math.PI*2; const lobe = mesh(new T.SphereGeometry(.34, 20, 10, 0, Math.PI*2, 0, Math.PI*.5), mat({ roughness:.75, side:T.DoubleSide }), Math.sin(a)*.18, top - .12, Math.cos(a)*.18, H); lobe.scale.set(1.15, .55, .5); lobe.rotation.set(-.2, a, 0); }
      const trim = mesh(new T.TorusGeometry(headR*1.06, .018, 6, 36), gold(), 0, top - .08, 0, H); trim.rotation.x = Math.PI/2;
      const skull = mpCanvasTex('skull', 64, 64, (x)=>{ x.fillStyle = '#f2f2f2'; x.beginPath(); x.arc(32, 26, 16, 0, 7); x.fill(); x.fillRect(22, 34, 20, 10); x.fillStyle = '#1e1b1a'; x.beginPath(); x.arc(26, 26, 5, 0, 7); x.arc(38, 26, 5, 0, 7); x.fill(); x.strokeStyle = '#f2f2f2'; x.lineWidth = 5; x.beginPath(); x.moveTo(8, 48); x.lineTo(56, 60); x.moveTo(56, 48); x.lineTo(8, 60); x.stroke(); });
      mesh(new T.PlaneGeometry(.2, .2), new T.MeshBasicMaterial({ map:skull, transparent:true }), 0, top + .06, headR*1.02 + .02, H);
    } else if (item.id === 'chefhat'){
      mesh(new T.CylinderGeometry(headR*1.02, headR*1.0, .2, 40), mat({ roughness:.9 }), 0, top + .02, 0, H);
      const pts = [[0, 0], [headR*1.0, 0], [headR*1.25, .12], [headR*1.38, .26], [headR*1.3, .38], [headR*.9, .45], [0, .46]];
      const puff = mesh(lathe(pts, 48), mat({ roughness:.95 }), 0, top + .1, 0, H); const pp = puff.geometry.attributes.position;
      for (let i=0;i<pp.count;i++){ const a = Math.atan2(pp.getX(i), pp.getZ(i)), k = 1 + Math.sin(a*8)*.05*Math.min(1, pp.getY(i)/.2); pp.setX(i, pp.getX(i)*k); pp.setZ(i, pp.getZ(i)*k); } puff.geometry.computeVertexNormals();
    } else if (item.id === 'tero_crown'){
      const cg = new T.Group(); cg.position.y = top + .02; cg.rotation.z = -0.08; H.add(cg);
      const dark = new T.MeshStandardMaterial({ color:0x24103F, metalness:0.85, roughness:0.25 });
      const glow = new T.MeshStandardMaterial({ color:0xB38CFF, emissive:0x8B5CF6, emissiveIntensity:1.1, roughness:0.2, metalness:0.2 });
      const band = new T.Mesh(new T.CylinderGeometry(0.45,0.41,0.22,8), dark); band.position.y = 0.11; cg.add(band);
      const trim = new T.Mesh(new T.TorusGeometry(0.44,0.03,6,24), new T.MeshStandardMaterial({ color:0xE9C46A, metalness:0.9, roughness:0.25 })); trim.rotation.x = Math.PI/2; trim.position.y = 0.22; cg.add(trim);
      for (let i=0;i<6;i++){ const a = (i/6)*Math.PI*2, tall = i % 2 ? 0.26 : 0.4;
        const c = new T.Mesh(new T.OctahedronGeometry(0.1), glow); c.scale.set(0.8, tall/0.1*0.55, 0.8);
        c.position.set(Math.cos(a)*0.4, 0.24 + tall*0.5, Math.sin(a)*0.4); cg.add(c); }
      const bolt = new T.Shape(); bolt.moveTo(0.03,0.16); bolt.lineTo(-0.08,-0.01); bolt.lineTo(0.0,-0.01); bolt.lineTo(-0.04,-0.16); bolt.lineTo(0.09,0.03); bolt.lineTo(0.01,0.03); bolt.lineTo(0.06,0.16); bolt.closePath();
      const bm = new T.Mesh(new T.ExtrudeGeometry(bolt, { depth:0.03, bevelEnabled:false }), new T.MeshStandardMaterial({ color:0xFFE14D, emissive:0xFFC400, emissiveIntensity:1.0 }));
      bm.position.set(0, 0.12, 0.44); cg.add(bm);
      const orbit = new T.Mesh(new T.TorusGeometry(0.66,0.018,6,40), new T.MeshStandardMaterial({ color:0x6EE7FF, emissive:0x22D3EE, emissiveIntensity:1.2 }));
      orbit.rotation.x = Math.PI/2 - 0.35; orbit.rotation.y = 0.3; orbit.position.y = 0.3; cg.add(orbit);
      const tp = new T.Mesh(new T.OctahedronGeometry(0.09), new T.MeshStandardMaterial({ color:0xF0ABFC, emissive:0xD946EF, emissiveIntensity:1.2 })); tp.position.y = 0.88; cg.add(tp);
    }
  } else if (item.slot === 'acc'){
    const H = anchor('head', 0, u.headCenterY || 0, 0);
    const ey = .04;   // 눈 높이 (머리 중심 기준)
    // 머리 앞면 곡면을 따라가는 띠 (안경테·마스크 등)
    const wrapBand = (h, y, arcA, m, extra) => { const geo = new T.CylinderGeometry(headR + (extra || .02), headR + (extra || .02), h, 40, 1, true, -arcA, arcA*2); geo.scale(1, 1, .96); const o = mesh(geo, m, 0, y, 0, H); return o; };
    if (item.id === 'sunglasses' || item.id === 'glasses'){
      const sun = item.id === 'sunglasses'; const frameM = sun ? M(0x111114, { metalness:.5, roughness:.25 }) : M(0x2a2a2e, { metalness:.6, roughness:.3 });
      const lensM = sun ? new T.MeshStandardMaterial({ color:0x0c0e14, metalness:.9, roughness:.05, envMapIntensity:1 }) : new T.MeshStandardMaterial({ color:0xd8ecff, transparent:true, opacity:.28, roughness:.05, metalness:.1, depthWrite:false });
      [-1, 1].forEach(s=>{ const lx = s*.135, lz = FZ + .035;
        if (sun){ const sh = new T.Shape(); sh.moveTo(-.1, .05); sh.lineTo(.1, .05); sh.quadraticCurveTo(.11, -.07, .02, -.075); sh.lineTo(-.04, -.075); sh.quadraticCurveTo(-.11, -.06, -.1, .05);
          const l = mesh(new T.ExtrudeGeometry(sh, { depth:.015, bevelEnabled:true, bevelThickness:.008, bevelSize:.01, bevelSegments:2, curveSegments:8 }), lensM, lx, ey, lz - .01, H); l.rotation.y = s*.22; if (s < 0) l.scale.x = -1; }
        else { const rim = mesh(new T.TorusGeometry(.075, .012, 8, 28), frameM, lx, ey, lz, H); rim.rotation.y = s*.22; const ln = mesh(new T.CircleGeometry(.072, 24), lensM, lx, ey, lz - .002, H); ln.rotation.y = s*.22; } });
      mesh(new T.TorusGeometry(.045, .01, 6, 12, Math.PI), frameM, 0, ey + .01, FZ + .04, H);
      wrapBand(.022, ey + .03, 1.5, frameM, .015).scale.set(1, 1, 1);
    } else if (item.id === 'mask'){
      const m = wrapBand(.26, -.14, 1.15, mat({ roughness:.9, side:T.DoubleSide }), .025);
      for (let i=0;i<3;i++) wrapBand(.008, -.2 + i*.06, 1.1, M(mpShade(item.color, .8), { roughness:.9 }), .03);
      [-1, 1].forEach(s=>{ const loop = mesh(new T.TorusGeometry(.08, .008, 6, 16), M(0xdddddd), s*headR*.95, -.08, -.02, H); loop.rotation.y = Math.PI/2; });
    } else if (item.id === 'headphones'){
      const band = mesh(new T.TorusGeometry(headR + .07, .035, 10, 40, Math.PI), mat({ roughness:.45 }), 0, ey, 0, H); band.scale.y = 1.15;
      [-1, 1].forEach(s=>{ const cup = mesh(lathe([[0, -.05], [.13, -.05], [.15, -.02], [.15, .03], [.12, .055], [0, .055]], 28), mat({ roughness:.35, metalness:.2 }), s*(headR + .06), ey, 0, H); cup.rotation.z = s*Math.PI/2;
        const cush = mesh(new T.TorusGeometry(.1, .035, 10, 24), M(0x222226, { roughness:.95 }), s*(headR + .01), ey, 0, H); cush.rotation.y = Math.PI/2; });
    } else if (item.id === 'bandana'){
      wrapBand(.3, -.13, Math.PI, mat({ roughness:.92, side:T.DoubleSide }), .025);
      const tri = mesh(new T.ConeGeometry(.2, .22, 3), mat({ roughness:.92 }), 0, -.3, FZ - .06, H); tri.rotation.set(Math.PI, 0, 0); tri.scale.z = .25;
      mesh(new T.SphereGeometry(.06, 10, 8), mat({ roughness:.92 }), 0, -.1, -headR - .02, H);
      [-1, 1].forEach(s=>{ const t = mesh(new T.BoxGeometry(.06, .2, .015), mat({ roughness:.92 }), s*.05, -.2, -headR - .04, H); t.rotation.z = s*.35; });
    } else if (item.id === 'eyepatch'){
      const sh = new T.Shape(); sh.absellipse(0, 0, .085, .07, 0, Math.PI*2); const p = mesh(new T.ExtrudeGeometry(sh, { depth:.015, bevelEnabled:true, bevelThickness:.008, bevelSize:.008, bevelSegments:2, curveSegments:16 }), mat({ roughness:.8 }), -.135, ey, FZ + .01, H); p.rotation.y = -.22;
      const strap = mesh(new T.TorusGeometry(headR + .012, .01, 6, 48), mat({ roughness:.8 }), 0, ey + .06, 0, H); strap.rotation.set(Math.PI/2, 0, .3); strap.scale.set(1, .96, 1);
    } else if (item.id === 'monocle'){
      const ring = mesh(new T.TorusGeometry(.08, .014, 10, 28), gold(), .135, ey, FZ + .03, H); ring.rotation.y = .22;
      const lens = mesh(new T.CircleGeometry(.074, 24), new T.MeshStandardMaterial({ color:0xBFE3FF, transparent:true, opacity:.4, metalness:.2, roughness:.05, depthWrite:false }), .135, ey, FZ + .028, H); lens.rotation.y = .22;
      const pts = []; for (let i=0;i<=12;i++){ const t = i/12; pts.push(new T.Vector3(.2 + t*.08, ey - .06 - t*.3 + Math.sin(t*Math.PI)*.04, FZ + .02 - t*.08)); }
      mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 16, .006, 5, false), gold(), 0, 0, 0, H);
    } else if (item.id === 'mustache'){
      [-1, 1].forEach(s=>{ const pts = []; for (let i=0;i<=8;i++){ const t = i/8; pts.push(new T.Vector3(s*(.01 + t*.16), -.07 - Math.sin(t*Math.PI)*.025 + Math.max(0, t - .75)*.18, FZ + .02 - t*t*.06)); }
        const tube = new T.TubeGeometry(new T.CatmullRomCurve3(pts), 16, .028, 8, false); const p = tube.attributes.position, cv = new T.CatmullRomCurve3(pts);
        for (let i=0;i<p.count;i++){ const ring = Math.floor(i/9), t = ring/16; const c = cv.getPoint(t), k = .5 + Math.sin(Math.min(1, t*1.2)*Math.PI)*.7; p.setXYZ(i, c.x + (p.getX(i) - c.x)*k, c.y + (p.getY(i) - c.y)*k*.7, c.z + (p.getZ(i) - c.z)*k*.7); } tube.computeVertexNormals();
        mesh(tube, mat({ roughness:.95 }), 0, 0, 0, H); });
    } else if (item.id === 'goggles'){
      const gy = ey + .2;
      const strap = mesh(new T.CylinderGeometry(headR + .015, headR + .015, .07, 40, 1, true), M(0x3a2a1e, { roughness:.85, side:T.DoubleSide }), 0, gy, 0, H); strap.scale.z = .96;
      [-1, 1].forEach(s=>{ const cup = mesh(lathe([[.0, 0], [.085, 0], [.095, .03], [.09, .06], [0, .06]], 24), mat({ roughness:.5, metalness:.4 }), s*.13, gy, FZ - .01, H); cup.rotation.x = Math.PI/2;
        const lens = mesh(new T.CircleGeometry(.07, 24), new T.MeshStandardMaterial({ color:0x7FD4FF, metalness:.6, roughness:.05, emissive:0x1a4a66, emissiveIntensity:.5 }), s*.13, gy, FZ + .055, H);
        const rim = mesh(new T.TorusGeometry(.08, .016, 8, 24), M(0xB08D57, { metalness:.8, roughness:.25 }), s*.13, gy, FZ + .055, H); });
    } else if (item.id === 'scarf'){
      const T2 = anchor('torso', 0, u.torsoCenterY || 0, 0); const tH = (u.torsoH || 1.24)/2, tD = (u.torsoD || .62)/2;
      const loop = mesh(new T.TorusGeometry(.36, .1, 12, 32), mat({ roughness:.95 }), 0, tH + .02, 0, T2); loop.rotation.x = Math.PI/2; loop.scale.set(1, .85, 1);
      const tail = mesh(mpRoundBox(.2, .55, .06, .025), mat({ roughness:.95 }), .2, tH - .28, tD + .06, T2); tail.rotation.z = .1;
      for (let i=0;i<5;i++) mesh(new T.BoxGeometry(.02, .07, .02), mat({ roughness:.95 }), .13 + i*.035 + .02, tH - .59, tD + .06, T2);
      for (let i=0;i<4;i++) mesh(new T.BoxGeometry(.2, .025, .065), M(0xF2E6C8, { roughness:.95 }), .2, tH - .1 - i*.12, tD + .062, T2).rotation.z = .1;
    }
  } else if (item.slot === 'top'){
    const TW = u.torsoW || 1.24, TH = u.torsoH || 1.24, TD = u.torsoD || .62, AW = u.armW || .62, AH = u.armH || 1.24;
    const Tt = anchor('torso', 0, u.torsoCenterY || 0, 0);
    const shirt = mpClothMesh(item.id, item.color, TW + .05, TH + .03, TD + .05, .07, 'top'); Tt.add(shirt);
    // 소매: 팔 메쉬에 붙인다 (팔을 흔들면 같이 움직임)
    const longSleeve = ['hoodie', 'leather', 'checkered', 'labcoat', 'sweater', 'tuxedo', 'armortop', 'pro_bomber', 'pro_techwear', 'pro_varsity', 'pro_haori'].indexOf(item.id) >= 0;
    if (P && P.armL){ ['armL', 'armR'].forEach(k=>{ const A = anchor(k); const sh = longSleeve ? AH*.8 : AH*.38; const sl = mpClothMesh(item.id, item.color, AW + .04, sh, AW + .04, .07, 'sleeve'); sl.position.y = AH/2 - sh/2 + .015; A.add(sl); }); }
    if (item.id === 'hoodie'){
      const hood = mesh(lathe([[.0, -.02], [.3, 0], [.4, .1], [.42, .2], [.38, .3], [.25, .36], [0, .38]], 28), mat({ roughness:.92, side:T.DoubleSide }), 0, TH/2 - .02, -TD/2 - .02, Tt); hood.scale.set(.9, .75, .5); hood.rotation.x = .5;
    } else if (item.id === 'armortop'){
      [-1, 1].forEach(s=>{ const pad = mesh(new T.SphereGeometry(.3, 20, 10, 0, Math.PI*2, 0, Math.PI*.5), mat({ metalness:.7, roughness:.3 }), s*(TW/2 + .2), TH/2 - .06, 0, Tt); pad.scale.set(1.1, .7, 1.05);
        for (let i=0;i<2;i++){ const p2 = mesh(new T.CylinderGeometry(.33 - i*.03, .33 - i*.03, .05, 20, 1, true, 0, Math.PI*2), mat({ metalness:.7, roughness:.3, side:T.DoubleSide }), s*(TW/2 + .2), TH/2 - .14 - i*.08, 0, Tt); p2.scale.set(1.05, 1, .95); } });
      const plate = mesh(new T.SphereGeometry(.7, 24, 12, -Math.PI/2.6, Math.PI/1.3, Math.PI*.3, Math.PI*.4), mat({ metalness:.7, roughness:.28, side:T.DoubleSide }), 0, 0, -.45, Tt); plate.scale.set(.95, 1.25, .5);
      mesh(new T.CircleGeometry(.12, 6), M(0xE2B13C, { metalness:.8, roughness:.25 }), 0, .15, TD/2 + .08, Tt);
    } else if (item.id === 'leather'){
      const collar = mesh(new T.TorusGeometry(.32, .06, 8, 24, Math.PI*1.3), mat({ roughness:.4 }), 0, TH/2 + .01, -.02, Tt); collar.rotation.set(Math.PI/2, 0, Math.PI*.85);
    } else if (item.id === 'vest'){
      [-1, 1].forEach(s=>{ const st = mesh(mpRoundBox(.17, .12, TD + .14, .03), M(0x2C3327, { roughness:.9 }), s*.32, TH/2 + .02, 0, Tt); });
      const radio = mesh(mpRoundBox(.1, .2, .06, .02), M(0x1e1e1e, { roughness:.6 }), -.42, .25, TD/2 + .07, Tt); mesh(new T.CylinderGeometry(.01, .01, .16), M(0x111111), -.44, .43, TD/2 + .07, Tt);
    } else if (item.id === 'tuxedo'){
      const bow = new T.Shape(); bow.moveTo(0, 0); bow.lineTo(-.12, .06); bow.quadraticCurveTo(-.14, 0, -.12, -.06); bow.closePath(); bow.moveTo(0, 0);
      const bg = new T.ExtrudeGeometry(bow, { depth:.03, bevelEnabled:true, bevelThickness:.01, bevelSize:.01, bevelSegments:2 }); const b1 = mesh(bg, M(0x111114, { roughness:.4 }), 0, TH/2 - .07, TD/2 + .03, Tt); const b2 = mesh(bg, M(0x111114, { roughness:.4 }), 0, TH/2 - .07, TD/2 + .03, Tt); b2.scale.x = -1;
      mesh(new T.SphereGeometry(.03, 10, 8), M(0x111114), 0, TH/2 - .07, TD/2 + .05, Tt);
      mesh(new T.ConeGeometry(.04, .07, 4), M(0xB3122E, { roughness:.5 }), -.3, TH/2 - .3, TD/2 + .04, Tt).rotation.x = Math.PI;   // 행커치프
    } else if (item.id === 'sweater'){
      const collar = mesh(new T.TorusGeometry(.3, .055, 10, 28), mat({ roughness:.95 }), 0, TH/2 + .01, 0, Tt); collar.rotation.x = Math.PI/2;
    } else if (item.id === 'labcoat'){
      const skirt = mpClothMesh('labcoat', item.color, TW + .1, .62, TD + .1, .05, 'side'); skirt.position.y = -TH/2 - .27; Tt.add(skirt);
      mesh(new T.BoxGeometry(.03, .62, .01), M(0xB9BEC2), 0, -TH/2 - .27, TD/2 + .056, Tt);
      const collar = mesh(new T.TorusGeometry(.33, .05, 8, 24, Math.PI*1.4), mat({ roughness:.9 }), 0, TH/2 + .01, -.02, Tt); collar.rotation.set(Math.PI/2, 0, Math.PI*.8);
    }
    if (item.pro) mpProItem(proCtx);
  } else if (item.slot === 'bottom'){
    const LW = u.legW || .62, LH = u.legH || 1.24;
    if (item.id === 'skirt'){
      const Tt = anchor('torso', 0, u.torsoCenterY || 0, 0); const TH = u.torsoH || 1.24;
      const pts = [[LW*1.05, 0], [LW*1.15, -.1], [LW*1.55, -.66], [LW*1.6, -.7]]; const sk = mesh(lathe(pts, 40), mat({ roughness:.85, side:T.DoubleSide }), 0, -TH/2 + .02, 0, Tt); const pp = sk.geometry.attributes.position;
      for (let i=0;i<pp.count;i++){ const a = Math.atan2(pp.getX(i), pp.getZ(i)), dy = -pp.getY(i); const k = 1 + Math.sin(a*12)*.06*Math.min(1, dy/.3); pp.setX(i, pp.getX(i)*k); pp.setZ(i, pp.getZ(i)*k*.62); } sk.geometry.computeVertexNormals();
      const belt = mesh(new T.CylinderGeometry(LW*1.08, LW*1.08, .06, 40, 1, true), M(mpShade(item.color, .6), { roughness:.6, side:T.DoubleSide }), 0, -TH/2 + .03, 0, Tt); belt.scale.z = .62;
    } else {
      const shorts = item.id === 'shorts'; const ph = shorts ? LH*.5 : LH + .02;
      if (P && P.legL){ ['legL', 'legR'].forEach(k=>{ const L = anchor(k); const pm = mpClothMesh(item.id, item.color, LW + .045, ph, LW + .045, .06, 'pant'); pm.position.y = LH/2 - ph/2 + .01; L.add(pm);
          if (item.id === 'shorts') { const cuff = mpRoundBox(LW + .07, .05, LW + .07, .02); mesh(cuff, M(mpShade(item.color, .8), { roughness:.85 }), 0, LH/2 - ph + .03, 0, L); }
          if (item.id === 'cargo'){ const s = k === 'legL' ? -1 : 1; mesh(mpRoundBox(.06, .26, .26, .03), M(mpShade(item.color, .85), { roughness:.9 }), s*(LW/2 + .045), 0, 0, L); } }); }
      else { [-1, 1].forEach(s=>{ const pm = mpClothMesh(item.id, item.color, LW + .05, ph, LW + .05, .06, 'pant'); pm.position.set(s*LW/2, shorts ? (LH - ph/2) : LH/2, 0); g.add(pm); }); }
      const belt = anchor('torso', 0, u.torsoCenterY || 0, 0); const TH = u.torsoH || 1.24, TW = u.torsoW || 1.24, TD = u.torsoD || .62;
      mesh(mpRoundBox(TW + .06, .09, TD + .06, .03), M(0x2a2420, { roughness:.5 }), 0, -TH/2 + .05, 0, belt);
      mesh(mpRoundBox(.12, .08, .03, .01), M(0xC9C9C9, { metalness:.8, roughness:.25 }), 0, -TH/2 + .05, TD/2 + .04, belt);
      if (item.pro) mpProItem(proCtx);
    }
  } else if (item.slot === 'back'){
    const TH = u.torsoH || 1.24, TW = u.torsoW || 1.24, TD = u.torsoD || .62;
    const B = anchor('torso', 0, u.torsoCenterY || 0, 0); const bz = -TD/2;
    if (item.id === 'backpack'){
      const bp = mesh(mpRoundBox(TW*.72, TH*.72, .3, .09), mat({ roughness:.75 }), 0, -.02, bz - .16, B);
      mesh(mpRoundBox(TW*.6, TH*.3, .1, .05), M(mpShade(item.color, 1.35), { roughness:.75 }), 0, -.2, bz - .33, B);
      const flap = mesh(new T.SphereGeometry(.45, 24, 8, 0, Math.PI*2, 0, Math.PI*.3), mat({ roughness:.75 }), 0, TH*.36 - .38, bz - .16, B); flap.scale.set(1, .5, .4);
      mesh(new T.BoxGeometry(.4, .025, .02), M(0xC9C9C9, { metalness:.7 }), 0, -.05, bz - .385, B);
      [-1, 1].forEach(s=>{ mesh(mpRoundBox(.1, TH + .02, .04, .02), M(0x111111, { roughness:.6 }), s*.3, 0, TD/2 + .035, B); });
    } else if (item.id === 'wings' || item.id === 'angelwings'){
      const angel = item.id === 'angelwings';
      [-1, 1].forEach(s=>{ const w = new T.Group(); w.position.set(s*.22, .2, bz - .08); w.rotation.set(.25, s*.35, 0); w.scale.setScalar(angel ? 1.5 : 1.65); B.add(w);
        if (angel){ for (let r=0;r<3;r++) for (let i=0;i<6;i++){ const f = new T.Shape(); f.moveTo(0, 0); f.quadraticCurveTo(.07, .05, .26 - r*.04, 0); f.quadraticCurveTo(.07, -.05, 0, 0);
            const fe = mesh(new T.ExtrudeGeometry(f, { depth:.015, bevelEnabled:true, bevelThickness:.008, bevelSize:.012, bevelSegments:2, curveSegments:8 }), mat({ roughness:.9, emissive:col, emissiveIntensity:.12 }), s*(.05 + i*.11 + r*.04), .25 - i*.04 - r*.1, r*.01, w);
            fe.rotation.z = s > 0 ? -.7 - i*.12 - r*.1 : Math.PI + .7 + i*.12 + r*.1; } }
        else { const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(.18, .42); sh.lineTo(.62, .55); sh.quadraticCurveTo(.56, .32, .62, .1); sh.quadraticCurveTo(.48, .16, .42, -.06); sh.quadraticCurveTo(.3, .06, .24, -.18); sh.quadraticCurveTo(.14, -.02, 0, 0);
          const mem = mesh(new T.ExtrudeGeometry(sh, { depth:.015, bevelEnabled:true, bevelThickness:.006, bevelSize:.008, bevelSegments:1, curveSegments:12 }), mat({ roughness:.55, metalness:.1, side:T.DoubleSide }), 0, 0, 0, w); if (s < 0) mem.scale.x = -1;
          for (const [ex, ey2] of [[.62, .55], [.62, .1], [.42, -.06], [.24, -.18]]){ const len = Math.hypot(ex - .18, ey2 - .42); const bone = mesh(new T.CylinderGeometry(.012, .02, len, 6), M(mpShade(item.color, .55), { roughness:.6 }), s*(ex + .18)/2, (ey2 + .42)/2, .01, w); bone.rotation.z = Math.atan2(ex - .18, ey2 - .42)*-s; }
          mesh(new T.ConeGeometry(.025, .08, 6), M(0x111111), s*.64, .6, .01, w); } });
    } else if (item.id === 'jetpack'){
      [-1, 1].forEach(s=>{ mesh(lathe([[0, -.42], [.13, -.42], [.16, -.36], [.16, .3], [.12, .4], [0, .42]], 24), mat({ metalness:.65, roughness:.3 }), s*.2, 0, bz - .2, B);
        const nz = mesh(lathe([[.06, 0], [.1, -.04], [.13, -.16], [.11, -.17], [.08, -.06], [.05, -.02]], 20), M(0x3A3F44, { metalness:.7, roughness:.3, side:T.DoubleSide }), s*.2, -.44, bz - .2, B);
        const fl = mesh(new T.ConeGeometry(.07, .26, 12, 1, true), new T.MeshBasicMaterial({ color:0xffa040, transparent:true, opacity:.65, depthWrite:false }), s*.2, -.72, bz - .2, B); fl.rotation.x = Math.PI;
        mesh(new T.TorusGeometry(.162, .015, 6, 24), M(0xE0303A, { roughness:.5 }), s*.2, .2, bz - .2, B).rotation.x = Math.PI/2; });
      mesh(mpRoundBox(.32, .5, .14, .04), M(0x30353a, { metalness:.5, roughness:.4 }), 0, 0, bz - .1, B);
    } else if (item.id === 'cape'){
      const W = TW + .2, L = TH + (u.legH || 1.24)*.75; const geo = new T.PlaneGeometry(W, L, 12, 16); const p = geo.attributes.position;
      for (let i=0;i<p.count;i++){ const x = p.getX(i), y = p.getY(i), t = (L/2 - y)/L; p.setZ(i, -Math.cos(x/W*Math.PI)*.08 - t*.18 + Math.sin(x*14)*.025*t); p.setX(i, x*(1 + t*.25)); } geo.computeVertexNormals();
      const cape = mesh(geo, mat({ roughness:.8, side:T.DoubleSide }), 0, TH/2 - L/2 + .02, bz - .05, B);
      mesh(new T.TorusGeometry(.36, .05, 8, 24, Math.PI), mat({ roughness:.8 }), 0, TH/2, 0, B).rotation.x = Math.PI/2;
      [-1, 1].forEach(s=>mesh(new T.SphereGeometry(.05, 12, 8), gold(), s*.32, TH/2 - .04, TD/2 + .02, B));
    } else if (item.id === 'guitar'){
      const gg = new T.Group(); gg.position.set(0, -.1, bz - .14); gg.rotation.z = .6; B.add(gg);
      const body = new T.Shape(); body.moveTo(0, -.42); body.bezierCurveTo(.36, -.42, .38, -.12, .22, -.02); body.bezierCurveTo(.3, .1, .3, .3, .12, .3); body.lineTo(.05, .22); body.lineTo(-.05, .22); body.lineTo(-.12, .32); body.bezierCurveTo(-.32, .3, -.3, .1, -.22, -.02); body.bezierCurveTo(-.38, -.12, -.36, -.42, 0, -.42);
      mesh(new T.ExtrudeGeometry(body, { depth:.08, bevelEnabled:true, bevelThickness:.02, bevelSize:.02, bevelSegments:3, curveSegments:24 }), mat({ roughness:.18, metalness:.1 }), 0, 0, -.04, gg);
      mesh(new T.CircleGeometry(.12, 20), M(0xF2F2F2, { roughness:.4 }), .02, -.12, .062, gg);
      mesh(new T.BoxGeometry(.075, .78, .04), M(0x5A3A1E, { roughness:.6 }), 0, .6, .02, gg);
      const hd = new T.Shape(); hd.moveTo(-.05, 0); hd.lineTo(.05, 0); hd.lineTo(.08, .18); hd.lineTo(-.03, .2); hd.closePath(); mesh(new T.ExtrudeGeometry(hd, { depth:.04, bevelEnabled:false }), M(0x1E1E1E, { roughness:.3 }), 0, .98, 0, gg);
      for (let i=0;i<6;i++) mesh(new T.BoxGeometry(.003, 1.1, .003), M(0xdddddd, { metalness:1, roughness:.2 }), -.025 + i*.01, .42, .07, gg);
      for (let i=0;i<2;i++) mesh(new T.BoxGeometry(.1, .025, .02), M(0x111111), 0, -.27 + i*.1, .07, gg);
      const strap = mesh(mpRoundBox(.07, TH*1.35, .025, .01), M(0x222222, { roughness:.7 }), 0, 0, TD/2 + .035, B); strap.rotation.z = .6;
    } else if (item.id === 'shield'){
      const sh = new T.Shape(); sh.moveTo(-.4, .42); sh.lineTo(.4, .42); sh.lineTo(.4, .05); sh.quadraticCurveTo(.36, -.35, 0, -.55); sh.quadraticCurveTo(-.36, -.35, -.4, .05); sh.closePath();
      const sg = new T.Group(); sg.position.set(0, -.02, bz - .12); sg.rotation.y = Math.PI; B.add(sg);
      mesh(new T.ExtrudeGeometry(sh, { depth:.06, bevelEnabled:true, bevelThickness:.03, bevelSize:.035, bevelSegments:3, curveSegments:16 }), mat({ metalness:.35, roughness:.45 }), 0, 0, 0, sg);
      const cross = new T.Shape(); cross.moveTo(-.05, .32); cross.lineTo(.05, .32); cross.lineTo(.05, .08); cross.lineTo(.28, .08); cross.lineTo(.28, -.02); cross.lineTo(.05, -.02); cross.lineTo(.05, -.4); cross.lineTo(-.05, -.4); cross.lineTo(-.05, -.02); cross.lineTo(-.28, -.02); cross.lineTo(-.28, .08); cross.lineTo(-.05, .08); cross.closePath();
      mesh(new T.ExtrudeGeometry(cross, { depth:.02, bevelEnabled:false }), M(0xF2F2F2, { roughness:.4 }), 0, 0, .1, sg);
      const rimPts = sh.getPoints(40).map(p=>new T.Vector3(p.x, p.y, .08)); mesh(new T.TubeGeometry(new T.CatmullRomCurve3(rimPts, true), 80, .025, 6, true), M(0xC9A227, { metalness:.85, roughness:.25 }), 0, 0, 0, sg);
    } else if (item.id === 'katana'){
      const kg = new T.Group(); kg.position.set(0, .05, bz - .1); kg.rotation.z = .55; B.add(kg);
      mesh(lathe([[0, -.62], [.04, -.6], [.045, .5], [0, .52]], 12), M(0x22262A, { roughness:.5, metalness:.2 }), 0, 0, 0, kg).scale.z = .55;
      for (let i=0;i<4;i++) mesh(new T.TorusGeometry(.046, .006, 4, 12), M(0xC9A227, { metalness:.8 }), 0, -.5 + i*.3, 0, kg).rotation.x = Math.PI/2;
      mesh(new T.CylinderGeometry(.09, .09, .02, 16), M(0xC9A227, { metalness:.85, roughness:.3 }), 0, .53, 0, kg);
      const hilt = mesh(new T.CylinderGeometry(.032, .034, .3, 10), M(0x1a1a1e, { roughness:.8 }), 0, .7, 0, kg);
      for (let i=0;i<6;i++){ const d = mesh(new T.BoxGeometry(.07, .015, .072), M(0xD8D2C0, { roughness:.9 }), 0, .58 + i*.045, 0, kg); d.rotation.y = i%2 ? .6 : -.6; }
      mesh(new T.SphereGeometry(.036, 10, 8), M(0xC9A227, { metalness:.8 }), 0, .86, 0, kg);
    }
  }
  g.userData.slot = item.slot;
  g.traverse(o=>{ if (o.isMesh) o.castShadow = true; }); for (const a of g.userData.attached || []) a.traverse(o=>{ if (o.isMesh) o.castShadow = true; });
  avatarGroup.add(g);
  return g;
}

// ---------------------------------------------------------------------
//  프리미엄 컬렉션 — 하나하나 손으로 다듬은 아이템들
//  머리·장신구·후면과 하카마는 여기서 통째로 만들고(full),
//  옷(cloth:true)은 기본 옷 판 위에 디테일(지퍼·버클·립 밴드·소매 등)만 덧붙인다.
//  반짝임·네온 같은 움직임은 onBeforeRender 로 돌린다 (게임 쪽에서 따로 할 일 없음).
// ---------------------------------------------------------------------
function mpProItem(c){
  const { T, item, u, anchor, mesh, M, mat, gold, lathe, headR, HT, FZ, P } = c;
  const top = HT, ey = .04;
  const now = ()=>performance.now()/1000;
  const glowM = (hex, k, o)=>new T.MeshStandardMaterial(Object.assign({ color:hex, emissive:hex, emissiveIntensity:k || 1.2, roughness:.3, metalness:.1 }, o || {}));
  const addM = (hex, op)=>new T.MeshBasicMaterial({ color:hex, transparent:true, opacity:op == null ? .5 : op, blending:T.AdditiveBlending, depthWrite:false, side:T.DoubleSide });
  const ext = (sh, d, b)=>new T.ExtrudeGeometry(sh, { depth:d, bevelEnabled:b != null, bevelThickness:b || 0, bevelSize:b || 0, bevelSegments:2, curveSegments:16 });
  const tube = (pts, r, m, parent, taper)=>{ const cv = new T.CatmullRomCurve3(pts); const tg = new T.TubeGeometry(cv, pts.length*4, r, 8, false);
    if (taper){ const p = tg.attributes.position, rs = pts.length*4; for (let i=0;i<p.count;i++){ const t = Math.floor(i/9)/rs, cc = cv.getPoint(Math.min(1, t)), k = 1 - t*taper; p.setXYZ(i, cc.x + (p.getX(i) - cc.x)*k, cc.y + (p.getY(i) - cc.y)*k, cc.z + (p.getZ(i) - cc.z)*k); } tg.computeVertexNormals(); }
    return mesh(tg, m, 0, 0, 0, parent); };
  // 머리 앞쪽을 감싸는 띠 (arc 는 앞쪽 반각)
  const band = (r, h, y, arc, m, parent)=>{ const geo = new T.CylinderGeometry(r, r, h, 48, 1, true, -arc, arc*2); geo.scale(1, 1, .96); return mesh(geo, m, 0, y, 0, parent); };
  const twinkle = (o, sp, base)=>{ const ph = Math.random()*6.3; o.onBeforeRender = ()=>{ const k = .55 + .45*Math.sin(now()*sp + ph); o.scale.setScalar((base || 1)*(.6 + k*.6)); o.rotation.z = now()*.8 + ph; }; };
  const star4 = (r)=>{ const s = new T.Shape(); for (let i=0;i<8;i++){ const a = i/8*Math.PI*2, rr = i%2 ? r*.28 : r; s[i ? 'lineTo' : 'moveTo'](Math.sin(a)*rr, Math.cos(a)*rr); } s.closePath(); return s; };
  const tex = mpCanvasTex;
  const blackGloss = (o)=>M(0x0d0d10, Object.assign({ metalness:.55, roughness:.22 }, o || {}));

  if (item.slot === 'head'){
    const H = anchor('head', 0, u.headCenterY || 0, 0);
    if (item.id === 'pro_dominus'){
      // 그림자 군주 후드: 깊은 후드 + 검은 가면 + 빛나는 눈 + 금빛 뿔 장식
      const cloth = M(0x15121c, { roughness:.92, side:T.DoubleSide });
      const hood = mesh(new T.SphereGeometry(headR*1.3, 40, 24, Math.PI/2 + .78, Math.PI*2 - 1.56, 0, Math.PI*.64), cloth, 0, .06, -.02, H); hood.scale.set(1, 1.18, 1.08);
      mesh(new T.SphereGeometry(headR*1.03, 32, 12, 0, Math.PI*2, 0, Math.PI*.5), M(0x08070a, { roughness:1 }), 0, .1, 0, H).scale.set(1, .9, .98);
      const inner = mesh(new T.SphereGeometry(headR*1.24, 32, 18, Math.PI/2 + .8, Math.PI*2 - 1.6, 0, Math.PI*.62), M(0x070609, { roughness:1, side:T.BackSide }), 0, .06, -.02, H); inner.scale.set(1, 1.18, 1.08);
      // 후드 끝자락이 등 뒤로 늘어진다
      const tail = mesh(new T.ConeGeometry(.2, .55, 20, 1, true), cloth, 0, -.12, -headR*1.25, H); tail.rotation.x = -2.5; tail.scale.z = .55;
      // 얼굴을 덮는 가면 (반짝이는 검정)
      const mask = band(headR + .03, .78, .02, 1.02, blackGloss({ side:T.DoubleSide }), H);
      // 가면 위 금빛 결 무늬
      for (const s of [-1, 1]){ tube([new T.Vector3(s*.05, .25, FZ + .055), new T.Vector3(s*.16, .17, FZ + .04), new T.Vector3(s*.27, .2, FZ - .01), new T.Vector3(s*.33, .29, FZ - .08)], .009, gold(), H, .6);
        tube([new T.Vector3(s*.06, -.2, FZ + .05), new T.Vector3(s*.2, -.12, FZ + .02), new T.Vector3(s*.3, -.18, FZ - .05)], .008, gold(), H, .6); }
      // 눈: 비스듬한 빛 조각 + 번짐
      const eyeCol = item.color;
      for (const s of [-1, 1]){ const sh = new T.Shape(); sh.moveTo(-.075, .018); sh.lineTo(.07, .045); sh.quadraticCurveTo(.085, .005, .05, -.025); sh.lineTo(-.06, -.015); sh.closePath();
        const e = mesh(ext(sh, .006), glowM(eyeCol, 2.4), s*.135, ey + .005, FZ + .056, H); e.rotation.y = s*.24; if (s < 0) e.scale.x = -1;
        const halo = mesh(new T.PlaneGeometry(.3, .16), addM(eyeCol, .35), s*.135, ey + .01, FZ + .07, H); halo.rotation.y = s*.24;
        halo.onBeforeRender = ()=>{ halo.material.opacity = .25 + .12*Math.sin(now()*2.2); }; }
      // 후드 테두리 금장 + 이마 보석
      const trim = mesh(new T.TorusGeometry(headR*1.12, .022, 8, 48, Math.PI*1.12), gold(), 0, .02, FZ*.55, H); trim.rotation.z = Math.PI/2 - Math.PI*.56; trim.scale.set(1.04, 1.25, 1);
      const gem = mesh(new T.OctahedronGeometry(.055, 0), glowM(eyeCol, 1.6, { metalness:.3, roughness:.05 }), 0, .27, FZ + .1, H); gem.scale.set(.8, 1.3, .5);
      mesh(new T.TorusGeometry(.065, .012, 6, 20), gold(), 0, .27, FZ + .095, H);
      // 금빛 뿔 두 쌍 (뒤로 휘어 감긴다)
      for (const s of [-1, 1]){ const pts = []; for (let i=0;i<=12;i++){ const t = i/12; pts.push(new T.Vector3(s*(.36 + Math.sin(t*1.9)*.34), .3 + t*.62 - t*t*.18, .02 - t*.42 + Math.sin(t*3)*.05)); }
        tube(pts, .065, gold(), H, .92);
        const p2 = []; for (let i=0;i<=8;i++){ const t = i/8; p2.push(new T.Vector3(s*(.3 + t*.2), .05 + t*.12, -.2 - t*.25)); } tube(p2, .03, gold(), H, .9); }
    } else if (item.id === 'pro_valkyrie'){
      // 발키리 헬름: 은빛 투구 + 금 테두리 + 거대한 깃털 날개
      const steel = M(0xE6EAF0, { metalness:.55, roughness:.22 }), goldM = gold();
      mesh(new T.SphereGeometry(headR*1.1, 48, 24, 0, Math.PI*2, 0, Math.PI*.56), steel, 0, top - .26, 0, H);
      band(headR*1.11, .08, top - .26, Math.PI, goldM, H);
      // 이마에서 정수리로 이어지는 능선
      const ridge = mesh(new T.TorusGeometry(headR*1.1, .03, 8, 48, Math.PI), goldM, 0, top - .26, 0, H); ridge.rotation.y = Math.PI/2;
      // 코 가리개 · 볼 가리개
      const ns = new T.Shape(); ns.moveTo(-.045, 0); ns.lineTo(.045, 0); ns.lineTo(.03, -.2); ns.lineTo(0, -.24); ns.lineTo(-.03, -.2); ns.closePath();
      mesh(ext(ns, .02, .006), steel, 0, top - .24, FZ + .05, H);
      for (const s of [-1, 1]){ const ch = mesh(new T.CylinderGeometry(headR*1.1, headR*1.06, .34, 16, 1, true, s > 0 ? .55 : -1.25, .7), M(0xD5DAE2, { metalness:.55, roughness:.25, side:T.DoubleSide }), 0, top - .45, 0, H); ch.scale.z = .98;
        mesh(new T.SphereGeometry(.025, 10, 8), goldM, s*headR*1.02, top - .34, headR*.5, H); }
      const gem = mesh(new T.OctahedronGeometry(.05), glowM(0x58A6FF, 1.2, { roughness:.05 }), 0, top - .2, FZ + .08, H); gem.scale.y = 1.4;
      // 날개: 세 줄의 깃털을 부채꼴로
      for (const s of [-1, 1]){ const w = new T.Group(); w.position.set(s*headR*1.02, top - .2, -.02); w.rotation.set(-.15, s*.25, 0); w.scale.setScalar(1.45); H.add(w);
        for (let r=0;r<3;r++) for (let i=0;i<7;i++){ const len = (.48 - r*.1)*(1 - i*.05), wd = .055 - r*.008;
          const f = new T.Shape(); f.moveTo(0, 0); f.quadraticCurveTo(wd, len*.4, wd*.5, len*.9); f.lineTo(0, len); f.lineTo(-wd*.5, len*.9); f.quadraticCurveTo(-wd, len*.4, 0, 0);
          const fe = mesh(ext(f, .01, .006), M(r === 2 ? 0xE9EEF5 : 0xFFFFFF, { roughness:.75, emissive:0x223344, emissiveIntensity:.15 }), 0, 0, -r*.012, w);
          fe.rotation.z = -s*(.1 + i*.2 + r*.08); fe.position.y = r*.03; fe.position.x = s*r*.02;
          // 깃대
          const q = mesh(new T.BoxGeometry(.006, len*.95, .006), M(0xC8CCD4), 0, len*.47, .012, fe); q.rotation.z = 0; } }
    } else if (item.id === 'pro_kabuto'){
      // 사무라이 투구: 옻칠 사발 + 금 선 + 여러 겹의 목 가리개 + 거대한 초승달 장식
      const lac = M(0x17131a, { metalness:.35, roughness:.25 }), red = M(0x8E1520, { metalness:.25, roughness:.32, side:T.DoubleSide }), goldM = gold();
      mesh(new T.SphereGeometry(headR*1.08, 48, 20, 0, Math.PI*2, 0, Math.PI*.52), lac, 0, top - .2, 0, H);
      for (let i=0;i<16;i++){ const rib = mesh(new T.TorusGeometry(headR*1.085, .007, 4, 32, Math.PI/2), goldM, 0, top - .2, 0, H); rib.rotation.set(0, i/16*Math.PI*2, Math.PI/2); }
      mesh(new T.CylinderGeometry(.06, .07, .05, 16), goldM, 0, top - .2 + headR*1.08, 0, H);
      band(headR*1.1, .07, top - .2, Math.PI, goldM, H);
      // 목 가리개 (시코로): 앞이 트인 네 겹
      for (let i=0;i<4;i++){ const r0 = headR*(1.1 + i*.1), r1 = r0 + .1, y = top - .26 - i*.1;
        mesh(new T.CylinderGeometry(r0, r1, .11, 40, 1, true, 1.0, Math.PI*2 - 2.0), red, 0, y, 0, H);
        mesh(new T.CylinderGeometry(r1 + .003, r1 + .003, .018, 40, 1, true, 1.0, Math.PI*2 - 2.0), M(0xE2B13C, { metalness:.85, roughness:.25, side:T.DoubleSide }), 0, y - .05, 0, H); }
      // 끈 매듭 (빨강 · 금) 줄
      for (let i=0;i<9;i++){ const a = 1.2 + i*(Math.PI*2 - 2.4)/8; for (let k=0;k<3;k++) mesh(new T.BoxGeometry(.012, .07, .012), M(0xE8D7A8, { roughness:.8 }), Math.sin(a)*headR*(1.16 + k*.1), top - .3 - k*.1, Math.cos(a)*headR*(1.16 + k*.1), H); }
      // 귀 옆 접힌 날개 (후키가에시) + 금 문장
      for (const s of [-1, 1]){ const fk = new T.Shape(); fk.moveTo(0, 0); fk.lineTo(.2, .02); fk.quadraticCurveTo(.26, -.08, .2, -.2); fk.lineTo(0, -.16); fk.closePath();
        const f = mesh(ext(fk, .02, .008), red, s*headR*.92, top - .2, headR*.62, H); f.rotation.y = s > 0 ? -.5 : Math.PI + .5;
        const mon = mesh(new T.CylinderGeometry(.045, .045, .012, 20), goldM, s*(headR*.92 + .09), top - .29, headR*.62 + .07, H); mon.rotation.x = Math.PI/2; mon.rotation.z = s*.6; }
      // 차양
      const vs = mesh(new T.CylinderGeometry(headR*1.14, headR*1.22, .04, 32, 1, false, -.9, 1.8), lac, 0, top - .22, .03, H); vs.rotation.x = .12;
      // 초승달 장식 (마에다테)
      const cr = new T.Shape(); cr.absarc(0, .62, .62, Math.PI + .42, Math.PI*2 - .42, false); cr.absarc(0, .76, .58, Math.PI*2 - .5, Math.PI + .5, true); cr.closePath();
      const md = mesh(ext(cr, .015, .008), M(0xF2C14E, { metalness:.8, roughness:.18, emissive:0x3a2600, emissiveIntensity:.4 }), 0, top - .22, FZ + .1, H); md.rotation.x = -.2;
      const base = mesh(new T.CylinderGeometry(.06, .05, .08, 6), goldM, 0, top - .18, FZ + .08, H); base.rotation.x = Math.PI/2;
    } else if (item.id === 'pro_fedora'){
      // 스파클 타임 페도라: 접힌 크라운 + 휘어진 챙 + 리본 띠 + 반짝이는 별들
      const felt = mat({ roughness:.7 });
      const brim = mesh(lathe([[headR*1.0, .0], [headR*1.5, -.01], [headR*1.82, .015], [headR*1.86, .04], [headR*1.8, .05], [headR*1.5, .025], [headR*.95, .03]], 64), M(item.color, { roughness:.7, side:T.DoubleSide }), 0, top - .14, 0, H);
      const bp = brim.geometry.attributes.position; for (let i=0;i<bp.count;i++){ const x = bp.getX(i), z = bp.getZ(i), r = Math.hypot(x, z), a = Math.atan2(x, z), k = Math.max(0, (r - headR)/(headR*.9));
        bp.setY(i, bp.getY(i) + k*k*(.09*Math.sin(a)*Math.sin(a) - .07*Math.max(0, Math.cos(a)))); } brim.geometry.computeVertexNormals();
      const crown = mesh(lathe([[headR*1.03, 0], [headR*1.07, .02], [headR*1.06, .32], [headR*.94, .4], [headR*.47, .46], [0, .48]], 48), felt, 0, top - .16, 0, H);
      const cp = crown.geometry.attributes.position; for (let i=0;i<cp.count;i++){ const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i), r = Math.hypot(x, z);
        // 정수리 가운데 골 + 앞쪽을 집은 모양
        let ny = y - Math.max(0, 1 - Math.abs(x)/(headR*.5))*Math.max(0, (y - .3)/.16)*.1*Math.min(1, r/(headR*.2) + .3); let nx = x;
        if (z > 0 && y > .2) nx = x*(1 - .18*(z/headR)*((y - .2)/.26));
        cp.setXYZ(i, nx, ny, z); } crown.geometry.computeVertexNormals();
      mesh(new T.CylinderGeometry(headR*1.075, headR*1.08, .1, 48, 1, true), M(0x0e0e12, { roughness:.4, side:T.DoubleSide }), 0, top - .09, 0, H);
      const bow = new T.Shape(); bow.moveTo(0, 0); bow.lineTo(-.09, .05); bow.quadraticCurveTo(-.11, 0, -.09, -.05); bow.closePath();
      const bw = mesh(ext(bow, .015, .006), M(0x0e0e12, { roughness:.4 }), -headR*1.08, top - .09, -.05, H); bw.rotation.y = -Math.PI/2;
      // 반짝이 (크기 · 회전이 계속 바뀐다)
      for (let i=0;i<14;i++){ const a = i/14*Math.PI*2 + Math.random()*.3, r = headR*(1.2 + Math.random()*.9), y = top - .1 + Math.random()*.7;
        const sp = mesh(new T.ShapeGeometry(star4(.05 + Math.random()*.04)), glowM(i%3 ? 0xFFFFFF : 0x9FE8FF, 2, { side:T.DoubleSide, transparent:true, opacity:.95, depthWrite:false }), Math.sin(a)*r, y, Math.cos(a)*r, H);
        sp.rotation.y = a; twinkle(sp, 2 + Math.random()*3); }
    } else if (item.id === 'pro_snapback'){
      // 스트릿 스냅백: 6쪽 크라운 + 자수 로고 + 평평한 챙 + 금색 스티커 + 뒤 똑딱이 끈
      const cl = M(item.color, { roughness:.85 });
      const cr = mesh(new T.SphereGeometry(headR*1.06, 48, 20, 0, Math.PI*2, 0, Math.PI*.5), cl, 0, top - .19, 0, H); cr.scale.set(1, .98, 1.02);
      for (let i=0;i<6;i++){ const s = mesh(new T.TorusGeometry(headR*1.065, .005, 4, 32, Math.PI/2), M(mpShade(item.color, .55)), 0, top - .19, 0, H); s.rotation.set(0, i/6*Math.PI*2 + Math.PI/6, Math.PI/2); }
      mesh(new T.SphereGeometry(.04, 12, 8), cl, 0, top - .19 + headR*1.04, 0, H);
      const logo = tex('snaplogo', 256, 128, (x, w, h)=>{ x.clearRect(0, 0, w, h); x.font = '900 86px Impact, Arial Black, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.lineWidth = 10; x.strokeStyle = '#ff2a4a'; x.strokeText('PB', w/2, h/2 + 4); x.fillStyle = '#ffffff'; x.fillText('PB', w/2, h/2 + 4);
        x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1; for (let i=0;i<w;i+=3){ x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 20, h); x.stroke(); } });
      const lg = new T.CylinderGeometry(headR*1.075, headR*1.075, .2, 32, 1, true, -.55, 1.1); lg.scale(1, 1, 1.02);
      mesh(lg, new T.MeshStandardMaterial({ map:logo, transparent:true, alphaTest:.05, roughness:.9 }), 0, top - .05, 0, H);
      const bs = new T.Shape(); bs.moveTo(-headR*.95, 0); bs.quadraticCurveTo(-headR*.95, headR*.95, 0, headR*1.08); bs.quadraticCurveTo(headR*.95, headR*.95, headR*.95, 0); bs.closePath();
      const brim = new T.Group(); brim.position.set(0, top - .17, headR*.62); brim.rotation.x = Math.PI/2 + .16; H.add(brim);
      mesh(ext(bs, .028, .008), cl, 0, 0, -.014, brim);
      mesh(new T.ShapeGeometry(bs), M(0x2E6B3A, { roughness:.9, side:T.DoubleSide }), 0, 0, .03, brim);
      const stk = tex('snapsticker', 128, 128, (x)=>{ const gr = x.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(.5, '#e2b13c'); gr.addColorStop(1, '#fff3b0'); x.fillStyle = gr; x.beginPath(); x.arc(64, 64, 62, 0, 7); x.fill();
        x.fillStyle = '#5a4510'; x.font = '900 44px Arial Black, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('7⅜', 64, 60); x.font = '700 14px sans-serif'; x.fillText('AUTHENTIC', 64, 98); });
      const st = mesh(new T.CircleGeometry(.06, 24), new T.MeshStandardMaterial({ map:stk, metalness:.6, roughness:.25 }), headR*.35, headR*.62, -.016, brim); st.rotation.y = Math.PI;
      // 뒤 똑딱이 끈 + 구멍
      mesh(mpRoundBox(.3, .05, .03, .012), M(0x111114, { roughness:.5 }), 0, top - .25, -headR*1.02, H);
      for (let i=0;i<4;i++) mesh(new T.CylinderGeometry(.012, .012, .035, 10), M(0x111114), -.1 + i*.065, top - .25, -headR*1.03, H).rotation.x = Math.PI/2;
    }
  } else if (item.slot === 'acc'){
    const H = anchor('head', 0, u.headCenterY || 0, 0);
    if (item.id === 'pro_visor'){
      // 사이버 바이저: 빛나는 화면 띠 + 검은 테 + 귀 장치 (스캔라인이 흐른다)
      const scr = tex('visorscr', 512, 64, (x, w, h)=>{ const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0a3a4a'); gr.addColorStop(.5, '#26e6ff'); gr.addColorStop(1, '#0a3a4a'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
        x.fillStyle = 'rgba(0,0,0,.35)'; for (let y=0;y<h;y+=4) x.fillRect(0, y, w, 1.5); x.fillStyle = 'rgba(255,255,255,.85)'; for (let i=0;i<14;i++) x.fillRect(40 + i*31, h - 14, 14, 3);
        x.font = '700 13px monospace'; x.fillStyle = 'rgba(255,255,255,.9)'; x.fillText('SYS//ONLINE', 190, 22); x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 2; x.strokeRect(120, 14, 22, 22); x.strokeRect(370, 14, 22, 22); });
      scr.wrapS = T.RepeatWrapping;
      const sm = new T.MeshBasicMaterial({ map:scr, transparent:true, opacity:.92, side:T.DoubleSide });
      const vg = new T.CylinderGeometry(headR + .055, headR + .045, .15, 48, 1, true, -1.25, 2.5); vg.scale(1, 1, .98);
      const vis = mesh(vg, sm, 0, ey + .01, 0, H); vis.onBeforeRender = ()=>{ scr.offset.x = (now()*.15)%1; };
      const glow = mesh(new T.CylinderGeometry(headR + .08, headR + .07, .26, 48, 1, true, -1.2, 2.4), addM(0x26E6FF, .16), 0, ey + .01, 0, H); glow.scale.z = .98;
      const fr = blackGloss();
      band(headR + .065, .022, ey + .09, 1.32, fr, H); band(headR + .062, .02, ey - .07, 1.32, fr, H);
      for (const s of [-1, 1]){ const ear = mesh(new T.CylinderGeometry(.1, .1, .07, 28), fr, s*(headR + .045), ey, -.02, H); ear.rotation.z = Math.PI/2;
        const ring = mesh(new T.TorusGeometry(.07, .012, 8, 28), glowM(0x26E6FF, 2), s*(headR + .085), ey, -.02, H); ring.rotation.y = Math.PI/2;
        const ant = mesh(new T.CylinderGeometry(.008, .012, .22, 8), fr, s*(headR + .07), ey + .14, -.08, H); ant.rotation.z = -s*.25;
        const tip = mesh(new T.SphereGeometry(.018, 10, 8), glowM(0xFF2A6D, 2.5), s*(headR + .1), ey + .25, -.08, H); tip.onBeforeRender = ()=>{ tip.material.emissiveIntensity = Math.sin(now()*4) > .3 ? 3 : .4; }; }
    } else if (item.id === 'pro_kitsune'){
      // 여우 가면: 머리 옆에 비스듬히 걸친 도자기 가면 + 붉은 문양 + 끈 매듭과 술
      const kg = new T.Group(); kg.position.set(headR*.72, .2, .2); kg.rotation.set(-.15, .72, .2); kg.scale.setScalar(1.45); H.add(kg);
      const porcelain = M(0xF6F2EA, { roughness:.28, metalness:.05 }), red = M(0xD62839, { roughness:.35, emissive:0x400006, emissiveIntensity:.4 });
      const face = mesh(new T.SphereGeometry(.23, 32, 20, 0, Math.PI*2, 0, Math.PI*.5), porcelain, 0, 0, 0, kg); face.rotation.x = Math.PI/2; face.scale.set(1, 1, .62); face.scale.y = 1;
      face.scale.set(1, .62, 1.12);
      const snout = mesh(lathe([[0, 0], [.1, 0], [.08, .12], [.04, .2], [0, .21]], 24), porcelain, 0, -.07, .08, kg); snout.rotation.x = Math.PI/2; snout.scale.set(1, 1, .75);
      mesh(new T.SphereGeometry(.028, 12, 10), M(0x111111, { roughness:.2 }), 0, -.065, .3, kg);
      for (const s of [-1, 1]){ const ear = mesh(new T.ConeGeometry(.08, .2, 4), porcelain, s*.14, .2, .02, kg); ear.rotation.set(0, Math.PI/4, -s*.35); ear.scale.z = .5;
        const inn = mesh(new T.ConeGeometry(.05, .13, 4), red, s*.135, .185, .05, kg); inn.rotation.set(0, Math.PI/4, -s*.35); inn.scale.z = .3;
        // 눈: 붉은 테 + 검은 틈
        const es = new T.Shape(); es.moveTo(-.07, -.01); es.quadraticCurveTo(-.01, .05, .07, .035); es.quadraticCurveTo(.02, -.03, -.07, -.01);
        const e1 = mesh(ext(es, .008), red, s*.09, .04, .19, kg); e1.rotation.y = s*.35; if (s < 0) e1.scale.x = -1;
        const e2 = mesh(new T.BoxGeometry(.08, .008, .01), M(0x111111), s*.09, .045, .2, kg); e2.rotation.set(0, s*.35, s*.18);
        // 볼 무늬 · 수염 선
        for (let i=0;i<3;i++){ const wl = mesh(new T.BoxGeometry(.09, .01, .008), red, s*(.12 + i*.01), -.03 - i*.03, .17 - i*.01, kg); wl.rotation.set(0, s*.6, s*(.15 - i*.12)); } }
      const fs = new T.Shape(); fs.moveTo(0, -.03); fs.quadraticCurveTo(.05, .03, 0, .11); fs.quadraticCurveTo(-.05, .03, 0, -.03);
      mesh(ext(fs, .008), red, 0, .1, .2, kg).rotation.x = -.3;
      // 끈: 머리를 한 바퀴 + 매듭 + 술
      const cord = mesh(new T.TorusGeometry(headR + .015, .012, 6, 48), M(0xC1121F, { roughness:.6 }), 0, .14, 0, H); cord.rotation.set(Math.PI/2 - .12, 0, .2);
      mesh(new T.SphereGeometry(.035, 12, 10), M(0xC1121F, { roughness:.6 }), headR*.9, .26, -.2, H);
      const ts = new T.Group(); ts.position.set(headR*.98, .2, -.24); H.add(ts);
      mesh(new T.SphereGeometry(.03, 12, 10), M(0xE2B13C, { metalness:.8, roughness:.25 }), 0, 0, 0, ts);
      for (let i=0;i<7;i++) mesh(new T.CylinderGeometry(.006, .004, .2, 4), M(0xC1121F, { roughness:.7 }), Math.sin(i)*.015, -.12, Math.cos(i)*.015, ts);
      ts.onBeforeRender = ()=>{}; const swing = ts.children[1]; if (swing) swing.onBeforeRender = ()=>{ ts.rotation.z = Math.sin(now()*2.4)*.15; };
    } else if (item.id === 'pro_oni'){
      // 오니 하프 마스크: 옻칠 붉은 턱 가리개 + 엄니 + 금 장식 못
      const lac = M(item.color, { metalness:.3, roughness:.22, side:T.DoubleSide });
      const m = band(headR + .035, .3, -.17, 1.25, lac, H);
      const lip = mesh(new T.TorusGeometry(headR + .04, .022, 8, 48, 2.5), M(0x150708, { metalness:.4, roughness:.3 }), 0, -.03, 0, H); lip.rotation.set(Math.PI/2, 0, Math.PI/2 - 1.25 + Math.PI); lip.rotation.set(Math.PI/2, 0, -Math.PI/2 - 1.25); lip.scale.y = .96;
      const nose = mesh(mpRoundBox(.12, .08, .08, .03), lac, 0, .0, FZ + .06, H); nose.rotation.x = .3;
      for (const s of [-1, 1]) mesh(new T.SphereGeometry(.018, 8, 6), M(0x150708), s*.03, -.02, FZ + .1, H);
      // 이빨: 윗니 줄 + 아래 엄니 두 개가 위로
      for (let i=-3;i<=3;i++){ const a = i*.12; const t = mesh(new T.ConeGeometry(.022, .06, 6), M(0xF4EFE2, { roughness:.35 }), Math.sin(a)*(headR + .045), -.075, Math.cos(a)*(headR + .045)*.96, H); t.rotation.x = Math.PI; }
      for (const s of [-1, 1]){ const f = mesh(new T.ConeGeometry(.035, .16, 8), M(0xF4EFE2, { roughness:.3 }), s*.16, -.16, FZ + .045, H); f.rotation.set(-.15, 0, s*.15);
        // 볼 근육 주름 + 금 못
        tube([new T.Vector3(s*.1, -.1, FZ + .055), new T.Vector3(s*.2, -.15, FZ + .02), new T.Vector3(s*.27, -.24, FZ - .04)], .012, M(0x5a0a10, { roughness:.3 }), H, .5);
        mesh(new T.SphereGeometry(.022, 10, 8), gold(), s*(headR*.82), -.24, headR*.55, H);
        const strap = mesh(new T.TorusGeometry(headR + .02, .014, 6, 40, Math.PI*.7), M(0x1a1a1e, { roughness:.6 }), 0, -.12, 0, H); strap.rotation.set(Math.PI/2, 0, s > 0 ? -Math.PI*.35 + Math.PI*.15 : Math.PI*.85); }
    } else if (item.id === 'pro_chain'){
      // 쿠반 체인 + 아이스드 메달리온 (몸통에 건다)
      const B = anchor('torso', 0, u.torsoCenterY || 0, 0); const tH = (u.torsoH || 1.24)/2, tD = (u.torsoD || .62)/2;
      const path = new T.CatmullRomCurve3([new T.Vector3(-.3, tH + .02, -.12), new T.Vector3(-.3, tH + .01, .1), new T.Vector3(-.2, tH - .2, tD + .03), new T.Vector3(0, tH - .44, tD + .05), new T.Vector3(.2, tH - .2, tD + .03), new T.Vector3(.3, tH + .01, .1), new T.Vector3(.3, tH + .02, -.12), new T.Vector3(0, tH + .04, -.22)], true);
      const goldC = M(0xF2C14E, { metalness:1, roughness:.16 }); const N = 46, lg = new T.TorusGeometry(.026, .011, 6, 14);
      for (let i=0;i<N;i++){ const t = i/N, p = path.getPoint(t), tg = path.getTangent(t); const l = mesh(lg, goldC, p.x, p.y, p.z, B); l.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), tg); l.rotateX(i%2 ? Math.PI/2 : 0); l.scale.set(1.25, 1, 1); }
      const pd = new T.Group(); pd.position.set(0, tH - .56, tD + .07); B.add(pd);
      mesh(new T.TorusGeometry(.03, .01, 6, 12), goldC, 0, .12, 0, pd);
      mesh(new T.CylinderGeometry(.12, .12, .03, 40), goldC, 0, 0, 0, pd).rotation.x = Math.PI/2;
      mesh(new T.TorusGeometry(.12, .014, 8, 40), M(0xFFE7A0, { metalness:1, roughness:.1 }), 0, 0, .012, pd);
      // 다이아(아이스드) 박힌 원 + 가운데 루비
      const ice = new T.MeshStandardMaterial({ color:0xffffff, emissive:0xbfe8ff, emissiveIntensity:.8, metalness:.2, roughness:.02 });
      for (let i=0;i<14;i++){ const a = i/14*Math.PI*2; const d = mesh(new T.OctahedronGeometry(.017), ice, Math.sin(a)*.09, Math.cos(a)*.09, .022, pd); twinkle(d, 3 + Math.random()*3, 1); }
      const rb = mesh(new T.OctahedronGeometry(.045), glowM(0xE0102A, .9, { metalness:.2, roughness:.03 }), 0, 0, .03, pd); rb.scale.z = .6;
      pd.onBeforeRender = ()=>{}; rb.onBeforeRender = ()=>{ pd.rotation.z = Math.sin(now()*1.3)*.06; };
    }
  } else if (item.slot === 'top'){
    // 옷 판은 이미 입혀졌다 — 여기선 입체 디테일
    const TW = u.torsoW || 1.24, TH = u.torsoH || 1.24, TD = u.torsoD || .62, AW = u.armW || .62, AH = u.armH || 1.24;
    const Tt = anchor('torso', 0, u.torsoCenterY || 0, 0);
    const ribTex = (hex, stripe)=>tex('rib_' + hex + '_' + (stripe || 0), 128, 64, (x, w, h)=>{ x.fillStyle = mpHex(hex); x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,.28)'; for (let i=0;i<w;i+=4) x.fillRect(i, 0, 1.6, h);
      if (stripe){ x.fillStyle = mpHex(stripe); x.fillRect(0, h*.3, w, h*.14); x.fillRect(0, h*.56, w, h*.14); } });
    const ribM = (hex, stripe)=>new T.MeshStandardMaterial({ map:ribTex(hex, stripe), roughness:.9 });
    const arms = (fn)=>{ if (P && P.armL) ['armL', 'armR'].forEach(k=>fn(anchor(k), k === 'armL' ? -1 : 1)); };
    if (item.id === 'pro_bomber'){
      mesh(mpRoundBox(TW + .12, .14, TD + .12, .05), ribM(0x141518), 0, -TH/2 + .06, 0, Tt);
      const col = mesh(new T.TorusGeometry(.34, .065, 10, 32), ribM(0x141518), 0, TH/2 + .02, 0, Tt); col.rotation.x = Math.PI/2; col.scale.set(1, .82, 1);
      const lin = mesh(new T.TorusGeometry(.3, .03, 8, 32, Math.PI*.5), M(0xFF6A13, { roughness:.6 }), 0, TH/2 + .03, .2, Tt); lin.rotation.set(Math.PI/2, 0, Math.PI*.25);
      mesh(new T.BoxGeometry(.035, TH - .1, .012), M(0xC9CED6, { metalness:.9, roughness:.25 }), 0, -.02, TD/2 + .06, Tt);
      mesh(mpRoundBox(.035, .08, .02, .008), M(0xC9CED6, { metalness:.9, roughness:.2 }), 0, TH/2 - .14, TD/2 + .08, Tt);
      for (const s of [-1, 1]){ const fl = mesh(mpRoundBox(.08, .3, .03, .012), M(0x1a1c1f, { roughness:.6 }), s*.38, -.25, TD/2 + .065, Tt); fl.rotation.z = s*.25; }
      arms((A, s)=>{ mesh(mpRoundBox(AW + .1, .12, AW + .1, .04), ribM(0x141518), 0, AH/2 - AH*.8 - .02, 0, A);
        if (s < 0){ const pk = mesh(mpRoundBox(.06, .26, .2, .02), M(0x1f2226, { roughness:.6 }), -AW/2 - .05, AH/2 - .45, 0, A); mesh(new T.BoxGeometry(.012, .2, .012), M(0xC9CED6, { metalness:.9 }), -AW/2 - .085, AH/2 - .45, .06, A);
          for (let i=0;i<3;i++) mesh(new T.BoxGeometry(.01, .025, .025), M(0xC9CED6, { metalness:.9 }), -AW/2 - .085, AH/2 - .35 - i*.04, -.05, A); } });
    } else if (item.id === 'pro_techwear'){
      const strapM = M(0x0c0d0f, { roughness:.55 }), metal = M(0x8B9097, { metalness:.9, roughness:.3 }), acc = glowM(0xFF4A1C, .6, { roughness:.5 });
      const coll = mesh(new T.CylinderGeometry(.33, .36, .2, 32, 1, true), M(0x16181c, { roughness:.75, side:T.DoubleSide }), 0, TH/2 + .08, -.02, Tt); coll.scale.z = .85;
      mesh(new T.BoxGeometry(.03, .18, .012), M(0x2a2d33, { metalness:.6 }), .07, TH/2 + .08, .28, Tt).rotation.z = -.1;
      // 대각선 슬링 스트랩 + 버클 + 남은 끈
      const sl = mesh(mpRoundBox(.1, TH*1.25, .03, .012), strapM, 0, -.02, TD/2 + .05, Tt); sl.rotation.z = .72;
      const bk = mesh(mpRoundBox(.16, .12, .04, .015), metal, -.1, .06, TD/2 + .075, Tt); bk.rotation.z = .72;
      mesh(mpRoundBox(.11, .07, .045, .012), strapM, -.1, .06, TD/2 + .09, Tt).rotation.z = .72;
      const dang = mesh(mpRoundBox(.07, .26, .015, .006), strapM, -.2, -.1, TD/2 + .07, Tt); dang.rotation.z = .2;
      mesh(mpRoundBox(.075, .05, .02, .008), metal, -.22, -.24, TD/2 + .075, Tt).rotation.z = .2;
      mesh(mpRoundBox(.06, .03, .02, .008), acc, .32, -.36, TD/2 + .055, Tt);
      // 가슴 주머니 (벨크로 패치)
      mesh(mpRoundBox(.26, .22, .05, .02), M(0x1b1e22, { roughness:.75 }), .28, .2, TD/2 + .04, Tt);
      mesh(mpRoundBox(.2, .06, .01, .005), M(0x2b2f35, { roughness:1 }), .28, .3, TD/2 + .07, Tt);
      arms((A, s)=>{ mesh(mpRoundBox(AW + .08, .1, AW + .08, .03), strapM, 0, AH/2 - AH*.8 - .02, 0, A);
        mesh(mpRoundBox(AW + .07, .04, AW + .07, .02), new T.MeshStandardMaterial({ color:0xd8dde4, metalness:.2, roughness:.15, emissive:0x30343a }), 0, AH/2 - .5, 0, A);
        if (s > 0){ mesh(mpRoundBox(.04, .2, .18, .015), M(0x1b1e22, { roughness:.75 }), AW/2 + .03, AH/2 - .32, 0, A); mesh(mpRoundBox(.012, .05, .12, .004), acc, AW/2 + .055, AH/2 - .25, 0, A); } });
    } else if (item.id === 'pro_varsity'){
      mesh(mpRoundBox(TW + .1, .13, TD + .1, .05), ribM(item.color, 0xEDE3D0), 0, -TH/2 + .06, 0, Tt);
      const col = mesh(new T.TorusGeometry(.33, .06, 10, 32), ribM(item.color, 0xEDE3D0), 0, TH/2 + .02, 0, Tt); col.rotation.x = Math.PI/2; col.scale.set(1, .82, 1);
      for (let i=0;i<5;i++) mesh(new T.CylinderGeometry(.025, .025, .015, 16), M(0xD8DCE2, { metalness:.9, roughness:.2 }), 0, TH/2 - .2 - i*.2, TD/2 + .04, Tt).rotation.x = Math.PI/2;
      const L = tex('varsityP', 128, 128, (x)=>{ x.font = '900 112px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
        x.lineWidth = 16; x.strokeStyle = '#E2B13C'; x.strokeText('P', 64, 70); x.lineWidth = 8; x.strokeStyle = '#EDE3D0'; x.strokeText('P', 64, 70); x.fillStyle = mpHex(item.color); x.fillText('P', 64, 70); });
      mesh(new T.PlaneGeometry(.3, .3), new T.MeshStandardMaterial({ map:L, transparent:true, alphaTest:.05, roughness:.95 }), -.3, .15, TD/2 + .032, Tt);
      arms((A)=>mesh(mpRoundBox(AW + .09, .12, AW + .09, .04), ribM(item.color, 0xEDE3D0), 0, AH/2 - AH*.8 - .02, 0, A));
    } else if (item.id === 'pro_haori'){
      // 하오리: 무릎까지 오는 겉옷 자락 + 넓은 소매 + 하오리 끈
      const LH = u.legH || 1.24; const skirtL = LH*.82;
      const sk = mpClothMesh('pro_haori', item.color, TW + .14, skirtL, TD + .14, .05, 'side'); sk.position.y = -TH/2 - skirtL/2 + .02; Tt.add(sk);
      for (const s of [-1, 1]) mesh(mpRoundBox(.11, TH + skirtL - .02, .02, .01), M(0x0d0e18, { roughness:.6 }), s*.17, -skirtL/2, TD/2 + .08, Tt);
      mesh(new T.BoxGeometry(.1, skirtL, .012), M(0x0b0b10, { roughness:.9 }), 0, -TH/2 - skirtL/2 + .04, TD/2 + .075, Tt);
      const himo = M(0xF2EEE4, { roughness:.85 });
      for (const s of [-1, 1]) mesh(new T.CylinderGeometry(.018, .018, .16, 8), himo, s*.08, .05, TD/2 + .1, Tt).rotation.z = s*1.2;
      mesh(new T.SphereGeometry(.04, 12, 10), himo, 0, .03, TD/2 + .11, Tt);
      for (const s of [-1, 1]){ const t = mesh(new T.CylinderGeometry(.02, .035, .14, 10), himo, s*.025, -.07, TD/2 + .11, Tt); t.rotation.z = s*.15; }
      arms((A, s)=>{ const sl = mpClothMesh('pro_haori', item.color, AW + .26, AH*.82, AW + .34, .06, 'sleeve'); sl.position.set(s*.06, AH/2 - AH*.41 - .02, 0); A.add(sl); });
    }
  } else if (item.slot === 'bottom'){
    const LW = u.legW || .62, LH = u.legH || 1.24, TH = u.torsoH || 1.24, TW = u.torsoW || 1.24, TD = u.torsoD || .62;
    const legs = (fn)=>{ if (P && P.legL) ['legL', 'legR'].forEach(k=>fn(anchor(k), k === 'legL' ? -1 : 1)); };
    if (item.id === 'pro_jogger'){
      const strap = M(0x0c0d0f, { roughness:.55 }), metal = M(0x9AA0A8, { metalness:.9, roughness:.25 });
      legs((L, s)=>{ mesh(mpRoundBox(LW + .08, .12, LW + .08, .04), new T.MeshStandardMaterial({ color:0x111215, roughness:.95 }), 0, -LH/2 + .07, 0, L);
        const pk = mesh(mpRoundBox(.08, .3, .3, .03), M(mpShade(item.color, 1.15), { roughness:.85 }), s*(LW/2 + .05), -.02, 0, L);
        mesh(mpRoundBox(.09, .08, .31, .02), M(mpShade(item.color, .9), { roughness:.85 }), s*(LW/2 + .06), .12, 0, L);
        mesh(mpRoundBox(.02, .06, .04, .008), metal, s*(LW/2 + .105), .1, .05, L);
        if (s > 0){ mesh(mpRoundBox(LW + .1, .07, LW + .1, .02), strap, 0, LH/2 - .3, 0, L); mesh(mpRoundBox(.06, .1, .05, .015), metal, LW/2 + .05, LH/2 - .3, .12, L); }
        mesh(mpRoundBox(.012, LH*.7, .012, .004), new T.MeshStandardMaterial({ color:0xd8dde4, emissive:0x40454c, roughness:.15 }), s*(LW/2 + .028), 0, -.1, L); });
      const B = anchor('torso', 0, u.torsoCenterY || 0, 0);
      const ck = mesh(mpRoundBox(.18, .1, .04, .02), metal, 0, -TH/2 + .05, TD/2 + .07, B); mesh(mpRoundBox(.06, .06, .05, .01), M(0x111111), 0, -TH/2 + .05, TD/2 + .08, B);
      for (const s of [-1, 1]) mesh(mpRoundBox(.02, .14, .02, .008), strap, s*.3, -TH/2 - .04, TD/2 + .05, B);
    } else if (item.id === 'pro_hakama'){
      // 하카마: 다리마다 넓게 퍼지는 주름 바지 + 허리띠 + 등 판
      const cloth = tex('hakama_' + item.color, 128, 256, (x, w, h)=>{ x.fillStyle = mpHex(item.color); x.fillRect(0, 0, w, h); for (let i=0;i<w;i+=16){ x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(i, 0, 3, h); x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(i + 5, 0, 2, h); }
        x.fillStyle = 'rgba(255,255,255,.05)'; for (let i=0;i<300;i++) x.fillRect(Math.random()*w, Math.random()*h, 1, 4); });
      cloth.wrapS = T.RepeatWrapping; cloth.repeat.x = 4;
      const cm = new T.MeshStandardMaterial({ map:cloth, roughness:.9, side:T.DoubleSide });
      // 허리에서 발목까지 한 덩어리로 넓게 퍼지는 주름 치마바지 + 다리에도 같은 천 (다리를 흔들 때 안이 비지 않게)
      const Tt = anchor('torso', 0, u.torsoCenterY || 0, 0), L0 = LH + .04, pts = [];
      for (let i=0;i<=10;i++){ const t = i/10; pts.push([TW*.56 + t*t*.36 + t*.06, -t*L0]); } pts.reverse();
      const gm = lathe(pts, 72); const pp = gm.attributes.position;
      for (let i=0;i<pp.count;i++){ const a = Math.atan2(pp.getX(i), pp.getZ(i)), d = -pp.getY(i)/L0, k = 1 + Math.sin(a*14)*.035*(.3 + d); pp.setX(i, pp.getX(i)*k); pp.setZ(i, pp.getZ(i)*k*.66); } gm.computeVertexNormals();
      mesh(gm, cm, 0, -TH/2 + .02, 0, Tt);
      // 가운데 갈라진 선 (앞 · 뒤)
      for (const z of [1, -1]) mesh(new T.BoxGeometry(.025, L0*.62, .01), M(mpShade(item.color, .55), { roughness:.9 }), 0, -TH/2 - L0*.69, z*(TW*.56 + .3)*.66, Tt);
      if (P && P.legL) legs((L)=>{ const pm = mpClothMesh('pro_hakama', item.color, LW + .05, LH, LW + .05, .06, 'pant'); L.add(pm); });
      const B = Tt;
      const ob = mesh(mpRoundBox(TW + .1, .16, TD + .1, .04), M(0xF2EEE4, { roughness:.85 }), 0, -TH/2 + .08, 0, B);
      mesh(mpRoundBox(TW + .12, .07, TD + .12, .03), M(item.color, { roughness:.85 }), 0, -TH/2 + .02, 0, B);
      mesh(mpRoundBox(.5, .26, .06, .04), M(item.color, { roughness:.85 }), 0, -TH/2 + .12, -TD/2 - .06, B);
      const kn = mesh(new T.TorusGeometry(.05, .025, 8, 16), M(item.color, { roughness:.85 }), 0, -TH/2 + .1, TD/2 + .09, B);
      for (const s of [-1, 1]){ const t = mesh(mpRoundBox(.06, .22, .02, .01), M(item.color, { roughness:.85 }), s*.05, -TH/2 - .04, TD/2 + .09, B); t.rotation.z = s*.25; }
    }
  } else if (item.slot === 'back'){
    const TH = u.torsoH || 1.24, TD = u.torsoD || .62;
    const B = anchor('torso', 0, u.torsoCenterY || 0, 0); const bz = -TD/2;
    if (item.id === 'pro_twinblades'){
      // 쌍검: X 자로 멘 두 자루 — 옻칠 칼집, 붉은 끈, 금 장식, 마름모 손잡이 감개
      const wrapT = tex('tsuka', 64, 256, (x, w, h)=>{ x.fillStyle = '#121214'; x.fillRect(0, 0, w, h); x.fillStyle = '#E9E3D3'; for (let y=-20;y<h;y+=32){ x.beginPath(); x.moveTo(w/2, y); x.lineTo(w, y + 16); x.lineTo(w/2, y + 32); x.lineTo(0, y + 16); x.closePath(); x.fill(); }
        x.fillStyle = '#121214'; for (let y=-20;y<h;y+=32){ x.beginPath(); x.moveTo(w/2, y + 8); x.lineTo(w*.75, y + 16); x.lineTo(w/2, y + 24); x.lineTo(w*.25, y + 16); x.closePath(); x.fill(); } });
      const one = (rz, z, sayaCol)=>{ const kg = new T.Group(); kg.position.set(0, .02, bz - z); kg.rotation.z = rz; B.add(kg);
        const saya = mesh(lathe([[0, -.72], [.03, -.715], [.045, -.68], [.05, .5], [0, .52]], 16), M(sayaCol, { metalness:.4, roughness:.18 }), 0, 0, 0, kg); saya.scale.z = .6;
        mesh(new T.ConeGeometry(.05, .1, 12), M(0xE2B13C, { metalness:.9, roughness:.2 }), 0, -.73, 0, kg).rotation.x = Math.PI;
        for (const y of [.32, .1]){ const r = mesh(new T.TorusGeometry(.052, .012, 6, 16), M(0xC1121F, { roughness:.6 }), 0, y, 0, kg); r.rotation.x = Math.PI/2; r.scale.y = .6; }
        const sg = []; for (let i=0;i<=8;i++){ const t = i/8; sg.push(new T.Vector3(.05 + Math.sin(t*3)*.06, .3 - t*.5, .02 + t*.03)); } tube(sg, .01, M(0xC1121F, { roughness:.6 }), kg);
        const tsuba = mesh(new T.CylinderGeometry(.1, .1, .025, 8), M(0xE2B13C, { metalness:.9, roughness:.22 }), 0, .53, 0, kg); tsuba.scale.z = .8;
        mesh(new T.CylinderGeometry(.038, .042, .34, 12), new T.MeshStandardMaterial({ map:wrapT, roughness:.85 }), 0, .72, 0, kg);
        mesh(new T.CylinderGeometry(.045, .04, .04, 12), M(0xE2B13C, { metalness:.9, roughness:.22 }), 0, .9, 0, kg);
        const tass = new T.Group(); tass.position.set(0, .92, 0); kg.add(tass); for (let i=0;i<5;i++) mesh(new T.CylinderGeometry(.005, .003, .16, 4), M(0xC1121F), Math.sin(i*1.3)*.012, -.08, Math.cos(i*1.3)*.012 + .02, tass);
        tass.rotation.x = .5; return kg; };
      one(.62, .14, 0x0e0e12); one(-.62, .2, 0x3a0a10);
      // 가슴을 가로지르는 멜빵
      const st = mesh(mpRoundBox(.08, TH*1.4, .025, .01), M(0x1b1714, { roughness:.6 }), 0, 0, TD/2 + .035, B); st.rotation.z = -.62;
      mesh(mpRoundBox(.12, .1, .03, .01), M(0xE2B13C, { metalness:.9, roughness:.25 }), -.08, .1, TD/2 + .05, B).rotation.z = -.62;
    } else if (item.id === 'pro_neonwings'){
      // 네온 날개: 빛나는 뼈대 + 육각 무늬 막 — 천천히 펄럭이고 숨 쉬듯 빛난다
      const neon = item.color, mem = tex('hexmem', 256, 256, (x, w, h)=>{ x.clearRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 2; const R = 14;
        for (let row=0; row<14; row++) for (let col=0; col<12; col++){ const cx = col*R*1.73 + (row%2)*R*.86, cy = row*R*1.5; x.beginPath(); for (let k=0;k<6;k++){ const a = k/6*Math.PI*2 + Math.PI/6; x[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a)*R*.9, cy + Math.sin(a)*R*.9); } x.closePath(); x.stroke(); } });
      const memM = new T.MeshBasicMaterial({ map:mem, color:neon, transparent:true, opacity:.55, blending:T.AdditiveBlending, depthWrite:false, side:T.DoubleSide });
      const boneM = glowM(neon, 2.2), fillM = new T.MeshBasicMaterial({ color:neon, transparent:true, opacity:.2, depthWrite:false, side:T.DoubleSide });
      mesh(mpRoundBox(.36, .3, .12, .04), M(0x121318, { metalness:.7, roughness:.3 }), 0, .1, bz - .07, B);
      mesh(new T.CylinderGeometry(.06, .06, .13, 20), glowM(neon, 1.5), 0, .1, bz - .12, B).rotation.x = Math.PI/2;
      for (const s of [-1, 1]){ const w = new T.Group(); w.position.set(s*.14, .16, bz - .12); B.add(w); const wi = new T.Group(); wi.scale.setScalar(1.35); w.add(wi);
        const J = [new T.Vector3(0, 0, 0), new T.Vector3(s*.45, .32, -.08), new T.Vector3(s*1.05, .5, -.14), new T.Vector3(s*1.5, .2, -.18)];
        tube(J, .028, boneM, wi, .5);
        const tips = [[s*1.5, .2], [s*1.38, -.22], [s*1.12, -.5], [s*.8, -.62], [s*.46, -.48]];
        for (const [tx, ty] of tips){ const from = tx === s*1.5 ? J[2] : new T.Vector3(s*Math.min(.95, Math.abs(tx)*.75), .4, -.12); tube([from, new T.Vector3((from.x + tx)/2, (from.y + ty)/2 + .02, -.15), new T.Vector3(tx, ty, -.16)], .014, boneM, wi, .4); }
        // 막: 뼈 끝을 잇는 부채꼴
        const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(s*.45, .32); sh.lineTo(s*1.05, .5); sh.lineTo(s*1.5, .2); for (const [tx, ty] of tips.slice(1)) sh.lineTo(tx, ty); sh.closePath();
        const mg = new T.ShapeGeometry(sh, 12); const uv = mg.attributes.uv, pp = mg.attributes.position; for (let i=0;i<uv.count;i++) uv.setXY(i, pp.getX(i)*.7 + .5, pp.getY(i)*.7 + .5);
        const m = mesh(mg, memM, 0, 0, -.14, wi); mesh(mg, fillM, 0, 0, -.145, wi);
        // 끝 불빛
        for (const [tx, ty] of tips){ const d = mesh(new T.SphereGeometry(.03, 10, 8), glowM(0xffffff, 2), tx, ty, -.16, wi); twinkle(d, 3 + Math.random()*2, 1); }
        w.rotation.y = s*.35;
        m.onBeforeRender = ()=>{ const t = now(); w.rotation.y = s*(.35 + Math.sin(t*1.6)*.12); w.rotation.z = s*Math.sin(t*1.6 + .6)*.05; memM.opacity = .42 + Math.sin(t*2.4)*.14; boneM.emissiveIntensity = 1.8 + Math.sin(t*2.4)*.6; }; }
    }
  }
}

// loadout: { head, acc, top, bottom, back } (각 값은 AVATAR_CATALOG의 id 또는 null)
// 옛 three(r128)는 색 숫자를 그대로 선형값으로 써서 화면에 허옇게 바래 보인다 → sRGB 로 보정 (새 three 는 알아서 함)
// 렌더러가 sRGB 로 내보낼 때만(색 보정을 켠 게임) 한 번 바꾼다 — 보정을 안 켠 게임은 원래 색 그대로가 맞다
function mpLinearize(root){ const T = window.THREE; if (!T || T.SRGBColorSpace) return; root.traverse(o=>{ const ms = !o.material ? [] : Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms){ if (!m || !m.userData || m.userData.mpLin) continue; m.userData.mpLin = true; if (m.color) m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear(); if (m.map && T.sRGBEncoding && m.map.encoding !== T.sRGBEncoding){ m.map.encoding = T.sRGBEncoding; m.map.needsUpdate = true; } m.needsUpdate = true; } }); }
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
      const ig = mpAttachAvatarItem(g, item);
      g.updateMatrixWorld(true);
      // 아이템은 몸 부위에 붙어 있을 수 있다 → 그 부착점들까지 모아서 틀을 잡고, 몸은 재질만 숨긴다(자식인 아이템은 그대로 보이게)
      const roots = ig ? [ig].concat(ig.userData.attached || []) : [], mine = new Set(); roots.forEach(r => r.traverse(o => mine.add(o)));
      const box = new T.Box3(); roots.forEach(r => box.expandByObject(r));
      if (box.isEmpty()) box.setFromObject(g);
      else g.traverse(o => { if (o.isMesh && !mine.has(o)) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.visible = false; }); });
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
  r.render = function(scene, cam){ try { const T = window.THREE; if (T && !T.SRGBColorSpace && T.sRGBEncoding && this.outputEncoding === T.sRGBEncoding) for (const g of EMO.groups){ if (!g.userData.mpLinDone){ g.userData.mpLinDone = true; mpLinearize(g); } } } catch(e){}
    let undo = null; try { undo = emoApply(scene); } catch(e){ undo = null; } try { return orig.call(this, scene, cam); } finally { if (undo) emoRestore(undo); } }; return r; }
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
      // 게임 쪽 콜백에서 오류가 나도 파이어베이스 이벤트 처리가 끊기지 않게 ("Exception was thrown by user callback")
      if (onPlayersCb) { try { onPlayersCb(val); } catch (e) { console.warn('[MP] onPlayersUpdate 콜백 오류', e); } }
    }
    // 사람이 많으면 'value'가 1초에 수십~수백 번 온다(사람 수 × 초당 전송 수). 매번 방 전체를
    // snap.val()로 풀고 게임 콜백까지 돌리면 렉이 걸리므로, 마지막 스냅샷만 기억했다가 최대 초당 20번만 처리한다.
    let pendingSnap = null, emitTimer = null, lastEmitAt = 0;
    const flushPlayers = () => {
      emitTimer = null; if (!pendingSnap) return; const sn = pendingSnap; pendingSnap = null; lastEmitAt = Date.now();
      lastPlayersSnapshot = sn.val() || {};
      try { mpChatScan(lastPlayersSnapshot); } catch (e) { console.warn('[MP] chat', e); }
      emitFilteredPlayers();
    };
    playersRef.on('value', snap => {
      pendingSnap = snap;
      if (!emitTimer) emitTimer = setTimeout(flushPlayers, Math.max(0, 50 - (Date.now() - lastEmitAt)));
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
