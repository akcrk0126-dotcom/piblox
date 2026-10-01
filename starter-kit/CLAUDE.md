# piblox 스타터 키트 — AI(Claude) 작업 안내

이 폴더는 **piblox 플랫폼 위에서 돌아가는 "외부 게임"**을 만들기 위한 출발점이다.
piblox(주인: akcrk0126-dotcom)는 허브, 계정, 아바타 꾸미기, 마켓플레이스, 채팅, 이모트를 제공하는 웹 게임 플랫폼이다.
이 키트를 쓰는 사람은 **플랫폼 주인이 아닌 별도 제작자**다. 자기 게임만 만들고, 플랫폼 코드나 다른 게임은 건드리지 않는다.

사용자는 한국어로 대화한다. 답변과 게임 안 글자는 한국어로 쓴다.

---

## 1. 파일

| 파일 | 역할 |
|---|---|
| `starter.html` | 게임 전체 (HTML + CSS + JS 한 파일, 빌드 없음). 이걸 복사해서 게임을 만든다 |
| `README.md` | 사람(제작자)용 짧은 설명 |
| `CLAUDE.md` | 이 문서 |

- **한 게임 = HTML 파일 하나**가 원칙이다. 이미지·소리도 가능하면 코드로 만든다(캔버스 텍스처, WebAudio).
- 큰 에셋(.glb 등)이 꼭 필요하면 같은 폴더에 두고 상대 경로로 불러온다.

## 2. 불러오는 순서 (starter.html 맨 위 `loadScript`)

1. **three.js r128**
   - cdnjs UMD 버전이라 `window.THREE` 전역으로 쓴다. `import` 아님.
   - r128 API 기준으로 코드를 쓴다. 예: `outputEncoding`, `BufferGeometry`(Geometry 없음).
2. **Firebase v8**: app, auth, database (gstatic).
3. **`multiplayer.js`**
   - `PIBLOX_SITE` 주소에서 받고, 실패하면 `../multiplayer.js`에서 받는다.
   - 성공하면 `window.MP`가 생긴다.
4. **`startGame()`** 실행.
   - `MP`가 없거나 Firebase가 실패하면 **혼자 하기 모드**로 그대로 돌아가야 한다.
   - 이 동작을 깨지 말 것.

`multiplayer.js`는 **플랫폼 주인 소유 파일**이다. 복사해서 고치거나 덮어쓰지 말고, 항상 원격 주소에서 불러 쓴다.

## 3. 설정 상수 (파일 위쪽)

- `GAME_ID`
  - 영어 소문자·숫자만 쓴다.
  - 멀티 방 이름이 `ext_<GAME_ID>_<ROOM>`이 된다. `?room=ABC` 주소로 친구끼리 같은 방에 들어간다.
- `GAME_TITLE`: 화면 제목.
- `PIBLOX_SITE`: piblox 사이트 주소(끝에 `/`). 주인에게 받은 값으로 바꾼다.

## 4. 코드 구조 (`startGame` 안, 위에서 아래로)

1. 렌더러·장면·빛
   - `renderer` 만들자마자 `MP.hookRenderer(renderer)`를 부른다(이모트 표시용).
   - **렌더러를 새로 만들면 그것도 반드시 hook 할 것.**
2. 🧱 **기본 에셋**
   - `mat(color, tex, rep)`
     - Lambert 재질이고 캐시된다.
     - tex: `'stud'` | `'stripe'` | `'wood'` | `null`
   - `block(x, y, z, w, h, d, material, opt)`
     - 상자 메쉬와 충돌 상자를 만든다. **y는 상자 중심**이다. 바닥 윗면이 0이 되게 쌓는다.
     - opt: `{ nocollide, kill, shadow:false }`
     - 반환한 메쉬의 `userData.col`이 충돌 상자다.
   - `removeBlock(mesh)`: 블록 지우기(충돌 포함).
   - `sign(text, x, y, z, ry, bg)`: 글자 간판.
   - `BRICK`: 로블록스 기본 색 팔레트(gray, red, blue, yellow, green, white, black, orange, purple).
   - `colliders`: 충돌 상자 배열 `{minX,maxX,minY,maxY,minZ,maxZ,kill,mesh}`.
     - 움직이는 발판은 메쉬 위치와 이 값을 같이 바꾼다.
3. 🧍 **아바타**
   - `makeAvatar(loadout)` → `{ g, limbs }`.
     - `MP.buildAvatar`로 허브에서 꾸민 아바타를 만들고, 팔다리를 어깨·엉덩이 피벗으로 감싼다.
   - `animLimbs(actor, dt, moving, air)`: 걷기·점프 동작.
   - `nameTag(text)`: 이름표 스프라이트.
4. 🏃 **물리** (플레이어 `me`)
   - 상수: `RAD .62`, 키 `CHAR_H 3.4`, `WALK 16`, `JUMP 34`, `GRAVITY -110`, `STEP .8`(자동으로 올라가는 턱 높이).
   - 최대 점프 높이는 약 **5.2**다. 맵을 설계할 때 이 값을 넘는 단차는 점프로 못 올라간다.
   - `groundAt`, `collide`, `touching(p)`(닿은 충돌 상자), `stepPlayer`, `respawn()`, `spawnPoint`.
   - 좌표: y가 위. `me.facing`(rotation.y)=0이면 +z를 본다.
5. 🎮 **입력**
   - WASD, Space, 오른쪽 드래그 시점, 휠 줌, 모바일 조이스틱·점프 버튼.
   - **`window.MPChatOpen`이 true면(채팅·이모트 메뉴 열림) 게임 키 입력을 무시한다.**
   - `/`(채팅)와 `.`(이모트) 키는 플랫폼이 쓰므로 게임 키로 쓰지 말 것.
6. 🌐 **멀티**
   - `others`: Map, `uid → { a:{g,limbs}, x,y,z,ry, tx,ty,tz,try, an, name, data }`.
   - `netSend(dt, extra)`가 0.1초마다 `MP.update({x,y,z,ry,an,d:extra})`를 보낸다.
   - 상대가 보낸 `extra`는 `others.get(uid).data`로 받는다.
   - **작은 값만** 보낸다(숫자 몇 개). 큰 배열을 매번 보내지 말 것.
7. 🛠 **"여기서부터 내 게임"** — 보통 이 부분만 고친다.
   - `buildWorld()`: 맵 만들기, `spawnPoint` 정하기.
   - `gameTick(dt, t)`: 매 프레임 규칙.
   - `onOthersChanged()`: 사람이 들어오거나 나갈 때.
   - `myExtraData()`: 남에게 보낼 내 정보.
8. 메인 루프와 `window.__GAME`(콘솔·테스트용 핸들).

## 5. 여러 명이 같은 상태를 써야 할 때 (라운드, 타이머, 몬스터 등)

- 각 클라이언트는 **자기 기록만** 쓴다(`MP.update`). 공용 상태가 필요하면 **호스트 한 명**을 정해서 그 사람만 계산한다.
- 호스트 정하기: 방에 있는 uid 중(`MP.uid`와 `others`의 키) **문자열이 가장 작은 사람**이 호스트다.
- 호스트는 공용 상태를 `myExtraData()`에 같이 넣어 보낸다(예: `{ c:coins, g:{ phase, t0 } }`).
- 다른 사람은 호스트의 `others.get(hostUid).data.g`를 읽는다.
- 시간은 `MP.serverNow()`(서버 기준 시각)를 쓴다. 기기 시계는 틀릴 수 있다.
- 호스트가 나가면 다음으로 작은 uid가 이어받게 만든다.

## 6. 써도 되는 `MP` 함수

| 함수 | 용도 |
|---|---|
| `MP.init(room, cb)` / `MP.onPlayersUpdate(cb)` / `MP.update(obj)` / `MP.leave()` | 방 접속·동기화 (키트에 이미 들어 있음) |
| `MP.uid`, `MP.room`, `MP.serverNow()` | 내 id, 방 이름, 서버 시각 |
| `MP.getDisplayName()` | 내 표시 이름 |
| `MP.getLocalAvatarLoadout()`, `MP.fetchAccountAvatarLoadout(cb)` | 내 아바타 꾸밈 읽기 |
| `MP.buildAvatar(loadout)`, `MP.AVATAR_CATALOG`, `MP.defaultAvatarLoadout()` | 아바타 만들기 (NPC는 `defaultAvatarLoadout()`을 조금 바꿔 쓰면 됨) |
| `MP.hookRenderer(renderer)` | 렌더러에 이모트 표시 연결 |
| `MP.playEmote(name)`, `MP.stopEmote()`, `MP.EMOTES` | 이모트 (예: 우승 때 자동으로 `MP.playEmote('cheer')`) |
| `MP.chatSys(text)` | 채팅창에 시스템 안내 한 줄 |
| `MP.setPresence(GAME_ID, room)` | 친구 목록에 "○○ 게임 중" 표시 (키트에 이미 들어 있음) |
| `MP.submitScore('ext_<GAME_ID>_<이름>', score, 'desc'\|'asc')`, `MP.fetchLeaderboard(같은 이름, {limit, direction}, cb)` | **내 게임 전용** 랭킹. 카테고리 이름은 반드시 `ext_<GAME_ID>_`로 시작 |

## 7. 하면 안 되는 것 (플랫폼 규칙)

- **`multiplayer.js`를 수정·복사·대체하지 않는다.**
- **다른 게임의 방이나 데이터에 쓰지 않는다.**
  - 방 이름은 항상 `ext_<GAME_ID>_…`.
  - 랭킹 카테고리도 `ext_<GAME_ID>_…`.
- **플랫폼 재화와 소유물은 건드리지 않는다.** 아래 함수는 부르지 않는다:
  - `addXP`, `claimLevelRewards`, `addOwnedItem`, `unlockSecret`
  - `setAvatarLoadout`, `restoreAccountData`
  - 친구 관련 함수들
  - 샤드는 `localStorage.shard_balance`인데, 이것도 건드리지 않는다.
  - 게임 안 보상은 **게임 안 점수·코인**으로 따로 만든다.
- 로그인·회원가입 화면을 따로 만들지 않는다. 계정은 허브에서 관리한다.
- 다른 piblox 게임의 코드나 에셋을 그대로 가져오지 않는다. 키트에 있는 기본 에셋과 직접 만든 것만 쓴다.

## 8. 스타일

- **분위기:** 로블록스 느낌의 블록, 스터드 무늬, 깔끔하고 차분한 색을 쓴다. 촌스러운 파스텔 남발은 하지 않는다.
- **글자:** UI 글자는 한국어로, 짧게 쓴다. 화면 위쪽 가운데 제목, 오른쪽 위 정보 칸 형식은 그대로 둔다.
- **왼쪽 위 공간:** 플랫폼 채팅창과 💃 버튼이 쓴다. 게임 UI를 왼쪽 위에 크게 두지 말 것. 채팅창이 자동으로 피하긴 한다.
- **모바일:** 조이스틱과 점프 버튼이 있어야 한다. 새 동작 키를 추가하면 모바일 버튼도 같이 만든다.

## 9. 테스트

- **로컬 실행**
  - `python3 -m http.server`를 켜고 `http://localhost:8000/starter.html`로 연다. `file://`은 일부 기능이 막힌다.
  - 멀티는 같은 주소를 탭 두 개로 열면 된다. `?room=TEST`를 붙이면 같은 방이다.
- **혼자 하기 모드:** 인터넷이 끊겨도 에러 없이 혼자 하기 모드로 떠야 한다.
- **콘솔 핸들:** `window.__GAME`(me, others, colliders, block, respawn …)으로 상태를 확인하고 조작할 수 있다.
- **배포한 주소에서 로그인이 안 될 때:** 배포한 주소에서 로그인이나 익명 접속이 실패하면, 플랫폼 주인에게 Firebase 콘솔 → Authentication → 설정 → **승인된 도메인**에 그 주소를 추가해 달라고 한다.
- **다른 도메인일 때:** 게임을 piblox와 다른 주소(예: 친구의 GitHub Pages)에 올리면, 브라우저 저장소가 따로라서 처음엔 게스트다. 허브와 같은 계정으로 로그인해야 아바타와 이모트가 그대로 따라온다. 이건 정상이다.

## 10. 체크리스트 (게임을 넘기기 전에)

- [ ] `GAME_ID`, `GAME_TITLE`, `PIBLOX_SITE`를 설정했다
- [ ] 혼자 하기 모드에서 에러가 없다
- [ ] 두 탭 멀티에서 서로 보이고, 채팅과 이모트(`.` 키)가 된다
- [ ] 모바일 화면(작은 창)에서 조작할 수 있다
- [ ] 7장 금지 목록에 있는 함수를 부르지 않았다
