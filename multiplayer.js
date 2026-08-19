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
];
const AVATAR_SLOTS = ['head','acc','top','bottom','back'];
const AVATAR_STUD = 0.62;

function mpBuildR6Avatar(){
  const T = window.THREE;
  const group = new T.Group();
  const legW=1*AVATAR_STUD, legH=2*AVATAR_STUD, legD=1*AVATAR_STUD;
  const torsoW=2*AVATAR_STUD, torsoH=2*AVATAR_STUD, torsoD=1*AVATAR_STUD;
  const headW=2*AVATAR_STUD, headH=1*AVATAR_STUD, headD=1*AVATAR_STUD;
  const armW=1*AVATAR_STUD, armH=2*AVATAR_STUD, armD=1*AVATAR_STUD;
  const legTopY = legH, torsoCenterY = legTopY+torsoH/2, headCenterY = legTopY+torsoH+headH/2;

  const legMat = new T.MeshStandardMaterial({ color:0x287F35 });
  const torsoMat = new T.MeshStandardMaterial({ color:0x0B62C4 });
  const armMat = new T.MeshStandardMaterial({ color:0xF5CD30 });
  const headMat = new T.MeshStandardMaterial({ color:0xF5CD30 });

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

  group.userData = { legTopY, torsoCenterY, headCenterY, torsoW, torsoH, torsoD, headW, headH, headD, legW, legH };
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
    }
  } else if (item.slot === 'bottom'){
    const isShorts = item.id === 'shorts';
    const h = isShorts ? u.legH*0.55 : u.legH+0.04;
    [-1,1].forEach(side=>{
      const leg = new T.Mesh(new T.BoxGeometry(u.legW+0.05,h,u.legW+0.05), mat({roughness:0.85}));
      leg.position.set(side*u.legW/2, isShorts ? (u.legH-h/2) : u.legH/2, 0); g.add(leg);
    });
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
    }
  }
  avatarGroup.add(g);
  return g;
}

// loadout: { head, acc, top, bottom, back } (각 값은 AVATAR_CATALOG의 id 또는 null)
function mpBuildAvatar(loadout){
  const group = mpBuildR6Avatar();
  const lo = loadout || {};
  AVATAR_SLOTS.forEach(slot=>{
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

  function getNickname() {
    let n = localStorage.getItem('mp_nickname');
    if (!n) {
      n = '플레이어' + Math.floor(1000 + Math.random() * 9000);
      localStorage.setItem('mp_nickname', n);
    }
    return n;
  }
  function setNickname(n) {
    if (!n) return;
    n = n.trim().slice(0, 12);
    if (!n) return;
    localStorage.setItem('mp_nickname', n);
  }
  function getDisplayName() {
    if (auth && auth.currentUser && auth.currentUser.displayName) return auth.currentUser.displayName;
    return getNickname();
  }

  // ---------- 아바타 꾸미기 (로컬 캐시 + 계정에 영구 저장, 방에 있으면 즉시 다른 플레이어에게도 반영) ----------
  function getLocalAvatarLoadout() {
    if (myAvatarLoadout) return myAvatarLoadout;
    try {
      const raw = localStorage.getItem('mp_avatar_loadout');
      if (raw) { myAvatarLoadout = JSON.parse(raw); return myAvatarLoadout; }
    } catch (e) {}
    myAvatarLoadout = { head:null, acc:null, top:null, bottom:null, back:null };
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
        myAvatarLoadout = remote;
        try { localStorage.setItem('mp_avatar_loadout', JSON.stringify(remote)); } catch (e) {}
        cb && cb(remote);
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
    playersRef.on('value', snap => {
      const val = snap.val() || {};
      if (uid) delete val[uid];
      if (onPlayersCb) onPlayersCb(val);
    });
    ready = true;
  }

  function handleAuthChange(user) {
    authReady = true;
    if (user) {
      uid = user.uid;
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
      db.ref(`${MP_ROOT}/users/${user.uid}`).set({
        email: email, nickname: finalNick, nicknameLower: finalNick.toLowerCase(),
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

  function signOutUser(cb) {
    if (!auth) { cb && cb(); return; }
    auth.signOut().then(() => cb && cb()).catch(() => cb && cb());
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
  let presenceRef = null;
  function setPresence(game) {
    if (!isConfigured() || !db || !uid) return;
    if (!presenceRef || presenceRef.key !== uid) {
      presenceRef = db.ref(`${MP_ROOT}/presence/${uid}`);
      presenceRef.onDisconnect().update({ online:false, game:null, ts: firebase.database.ServerValue.TIMESTAMP });
    }
    presenceRef.update({
      online:true, game: game || null, name: getDisplayName(),
      ts: firebase.database.ServerValue.TIMESTAMP
    });
  }

  // ---------- 유저 검색 (닉네임/아이디로 친구 찾기) ----------
  function searchUsers(queryStr, cb) {
    if (!isConfigured() || !db) { cb && cb([]); return; }
    const q = (queryStr || '').trim().toLowerCase();
    if (!q) { cb && cb([]); return; }
    db.ref(`${MP_ROOT}/users`).orderByChild('nicknameLower').startAt(q).endAt(q + '\uf8ff').limitToFirst(20)
      .once('value').then(snap => {
        const arr = [];
        snap.forEach(child => { arr.push(Object.assign({ uid: child.key }, child.val())); });
        cb && cb(arr.filter(u => u.uid !== uid));
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
        db.ref(`${MP_ROOT}/users/${fid}`).once('value').then(uSnap => {
          const uData = uSnap.val() || {};
          result[fid] = {
            uid: fid, type: friends[fid].type || 'friend',
            nickname: uData.nickname || friends[fid].name || '친구',
            online:false, game:null
          };
          emit();
          if (!friendPresenceRefs[fid]) {
            const pRef = db.ref(`${MP_ROOT}/presence/${fid}`);
            friendPresenceRefs[fid] = pRef;
            pRef.on('value', pSnap => {
              const p = pSnap.val() || {};
              if (result[fid]) {
                result[fid].online = !!p.online;
                result[fid].game = p.game || null;
              }
              emit();
            });
          }
        });
      });
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
    colorForUid,
    isLoggedIn,
    currentUser,
    signUp,
    signIn,
    signOutUser,
    submitScore,
    fetchLeaderboard,
    setPresence,
    searchUsers,
    addFriend,
    removeFriend,
    onFriendsUpdate,
    setAvatarLoadout,
    getLocalAvatarLoadout,
    fetchAccountAvatarLoadout,
    buildAvatar: mpBuildAvatar,
    AVATAR_CATALOG,
    AVATAR_SLOTS,
    get uid() { return uid; },
    get room() { return currentRoom; }
  };
})();

// const/let 전역 선언은 window 객체에 자동으로 안 붙기 때문에,
// 다른 <script> 태그에서 window.MP 로 체크하는 코드가 항상 실패하던 문제를 해결.
window.MP = MP;
