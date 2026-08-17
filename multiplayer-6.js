/*
  ================================================================
   multiplayer.js — Firebase 공용 모듈
   (익명/이메일 로그인, 실시간 멀티플레이, 리더보드)
  ================================================================
  이 파일은 hub.html / jumpmap.html / aura-battle-3.html 이 함께 씁니다.
  같은 폴더에 꼭 넣어주세요.

  ★★★ 설정 방법 (필수) ★★★
  1) https://console.firebase.google.com 에서 새 프로젝트를 만듭니다.
     (기존 프로젝트를 같이 써도 됩니다 — 아래처럼 전용 네임스페이스를
      쓰기 때문에 다른 앱의 데이터와 섞이지 않습니다)
  2) "빌드 > Realtime Database" 메뉴에서 데이터베이스를 만듭니다.
  3) "빌드 > Authentication > Sign-in method" 에서
     "익명"과 "이메일/비밀번호" 두 가지를 모두 사용 설정합니다.
  4) 프로젝트 설정(⚙) > "내 앱" > 웹 앱 추가(</>) 후 나오는
     firebaseConfig 객체를 아래 FIREBASE_CONFIG 에 그대로 붙여넣으세요.

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
          "$uid": {
            ".read": "auth != null",
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

  ★ 참고: 모든 데이터는 최상위 "playhub_mp" 노드 아래에만 저장되어
  다른 프로젝트(예: 기존 가챠 게임 DB)와 절대 겹치지 않습니다.
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
    myRef.set({
      name: getDisplayName(),
      color: colorForUid(uid),
      x: 0, y: 0, z: 0, ry: 0,
      ts: firebase.database.ServerValue.TIMESTAMP
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
    const finish = (user) => {
      setNickname(nickname || getNickname());
      db.ref(`${MP_ROOT}/users/${user.uid}`).set({
        email: email, nickname: nickname || getNickname(),
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
      if (nickname) user.updateProfile({ displayName: nickname }).catch(()=>{});
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
    get uid() { return uid; },
    get room() { return currentRoom; }
  };
})();

// 클래식 <script> 안의 최상위 const/let은 window에 자동으로 붙지 않으므로,
// 다른 파일에서 `window.MP` 로 안전하게 체크할 수 있도록 명시적으로 등록합니다.
window.MP = MP;
