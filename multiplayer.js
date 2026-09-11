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
  // ---- 시크릿 ----
  { id:'dittonubs',  slot:'head', name:'메타몽 뿔',     icon:'🫠', color:0xB79CD4, secret:'ditto' },
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
const faceTexCache = {};
function mpFaceTexture(faceId, skinHex){
  const key = faceId + '|' + skinHex;
  if (faceTexCache[key]) return faceTexCache[key];
  const T = window.THREE;
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
  const tex = new T.CanvasTexture(c);
  if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
  faceTexCache[key] = tex;
  return tex;
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
                     skinHex, shirtHex, pantsHex };
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
  return group;
}

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
  }

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
    localStorage.setItem('mp_nickname', n);
    // 로그인 프로필에도 반영(다른 기기에서도 같은 표시 이름이 보이도록)
    if (auth && auth.currentUser) { try { auth.currentUser.updateProfile({ displayName: n }); } catch (e) {} }
    // 방에 접속 중이면 즉시 다른 플레이어에게도 반영
    if (myRef) { try { myRef.update({ name: n }); } catch (e) {} }
    // DB의 검색용 필드까지 갱신해야 바뀐 이름으로도 친구 검색이 된다
    if (isConfigured() && db && uid) {
      db.ref(`${MP_ROOT}/users/${uid}`).update({
        displayName: n, displayNameLower: n.toLowerCase()
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
      const disp = getDisplayName();
      const patch = { displayName: disp, displayNameLower: (disp || '').toLowerCase() };
      // 계정 이름이 아직 없으면(=이 계정의 최초 기록) 지금 이름으로 한 번만 고정한다
      if (!cur.nickname) {
        patch.nickname = disp;
        patch.nicknameLower = (disp || '').toLowerCase();
        accountName = disp;
      }
      if (!cur.createdAt) patch.createdAt = firebase.database.ServerValue.TIMESTAMP;
      ref.update(patch).catch(() => {});
    }).catch(() => {});
  }

  // ---------- 아바타 꾸미기 (로컬 캐시 + 계정에 영구 저장, 방에 있으면 즉시 다른 플레이어에게도 반영) ----------
  function getLocalAvatarLoadout() {
    if (myAvatarLoadout) return myAvatarLoadout;
    try {
      const raw = localStorage.getItem('mp_avatar_loadout');
      // 예전 저장본에는 face/색상 항목이 없다 — 기본값과 합쳐서 올려준다
      if (raw) { myAvatarLoadout = Object.assign(mpDefaultLoadout(), JSON.parse(raw)); return myAvatarLoadout; }
    } catch (e) {}
    myAvatarLoadout = mpDefaultLoadout();
    return myAvatarLoadout;
  }
  function setAvatarLoadout(loadout, cb) {
    myAvatarLoadout = loadout;
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
        myAvatarLoadout = Object.assign(mpDefaultLoadout(), remote);
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
    const PRESENCE_STALE_MS = 15000; // 15초 넘게 위치 갱신이 없으면 유령 접속자로 간주하고 목록에서 제외
    let lastPlayersSnapshot = {};
    function emitFilteredPlayers(){
      const val = Object.assign({}, lastPlayersSnapshot);
      if (uid) delete val[uid];
      const now = Date.now();
      Object.keys(val).forEach(k=>{
        const p = val[k];
        if (!p || !p.ts || (now - p.ts) > PRESENCE_STALE_MS) delete val[k];
      });
      if (onPlayersCb) onPlayersCb(val);
    }
    playersRef.on('value', snap => {
      lastPlayersSnapshot = snap.val() || {};
      emitFilteredPlayers();
    });
    // 다른 사람이 아무도 움직이지 않으면(=파이어베이스에 새 쓰기가 없으면) 위 'value' 리스너가
    // 다시 안 불려서 낡은 유령이 그대로 남아있을 수 있음 - 5초마다 타이머로 강제 재검사해서 걸러냄
    if (presenceStaleTimer) clearInterval(presenceStaleTimer);
    presenceStaleTimer = setInterval(emitFilteredPlayers, 5000);
    ready = true;
  }

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
    if (!ready || !myRef) return;
    myRef.update(Object.assign({ ts: firebase.database.ServerValue.TIMESTAMP }, state));
  }

  function onPlayersUpdate(cb) { onPlayersCb = cb; }

  function leave() {
    if (myRef) myRef.remove();
    if (playersRef) playersRef.off();
  }

  // ---------- 이메일/비밀번호 로그인·회원가입 ----------
  function signUp(email, password, nickname, cb) {
    if (!isConfigured()) { cb && cb(null, 'no-config'); return; }
    ensureApp();
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

  function signIn(email, password, cb) {
    if (!isConfigured()) { cb && cb(null, 'no-config'); return; }
    ensureApp();
    auth.signInWithEmailAndPassword(email, password).then(res => {
      if (res.user.displayName) setNickname(res.user.displayName);
      cb && cb(res.user, null);
    }).catch(err => cb && cb(null, err));
  }

  // 로그아웃 — 계정에서 나온 뒤 반드시 익명으로 다시 붙는다.
  // 그냥 signOut만 하면 uid가 사라져서 접속상태·친구·아바타 저장이 전부 멈춰버린다.
  // 이전 계정의 닉네임/아바타가 다음 계정으로 새어나가지 않게 캐시도 비운다.
  function signOutUser(cb) {
    if (!auth) { cb && cb(); return; }
    const cleanup = () => {
      myAvatarLoadout = null;
      myXP = null;
      try {
        localStorage.removeItem('mp_xp');
        localStorage.removeItem('mp_avatar_loadout');
        localStorage.removeItem('mp_nickname');
        localStorage.removeItem('mp_account_name');
      } catch (e) {}
    };
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
    allPresenceRef.on('value', snap => {
      const all = snap.val() || {};
      const now = Date.now();
      const games = {}, rooms = {};
      let total = 0;
      Object.keys(all).forEach(id => {
        const p = all[id];
        if (!p || !p.online) return;
        // 브라우저가 그냥 죽으면 online이 true로 남을 수 있다 — 3분 넘은 건 뺀다
        if (p.ts && now - p.ts > 180000) return;
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
    }, () => cb && cb({ total:0, games:{}, rooms:{} }));
  }

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
    if (got.length){ try { localStorage.setItem('mp_lv_claimed', JSON.stringify(done)); } catch(e){} }
    return got;
  }
  function levelRewardTable(){ return LEVEL_REWARDS; }

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
  }

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

  // ---------- 친구 / 팔로우 ----------
  function addFriend(targetUid, targetName, type, cb) {
    if (!isConfigured() || !db || !uid) { cb && cb(false); return; }
    db.ref(`${MP_ROOT}/friends/${uid}/${targetUid}`).set({
      name: targetName || '친구', type: type || 'friend',
      ts: firebase.database.ServerValue.TIMESTAMP
    }).then(() => cb && cb(true)).catch(() => cb && cb(false));
  }
  function removeFriend(targetUid, cb) {
    if (!isConfigured() || !db || !uid) { cb && cb(false); return; }
    db.ref(`${MP_ROOT}/friends/${uid}/${targetUid}`).remove()
      .then(() => cb && cb(true)).catch(() => cb && cb(false));
  }

  let friendsListRef = null;
  let friendPresenceRefs = {};
  let onFriendsCb = null;
  function onFriendsUpdate(cb) {
    onFriendsCb = cb;
    if (!isConfigured() || !db || !uid) { cb && cb([]); return; }
    if (friendsListRef) friendsListRef.off();
    friendsListRef = db.ref(`${MP_ROOT}/friends/${uid}`);
    friendsListRef.on('value', snap => {
      const friends = snap.val() || {};
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
    setPresence,
    onGamePresence,
    addXP,
    getLevel,
    fetchAccountXP,
    levelFromXP,
    claimLevelRewards,
    levelRewardTable,
    claimedLevels,
    searchUsers,
    addFriend,
    removeFriend,
    onFriendsUpdate,
    setAvatarLoadout,
    getLocalAvatarLoadout,
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
