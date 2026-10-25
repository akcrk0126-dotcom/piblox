# 룬 아고라 — 모험의 대지 모듈 계약서

`agora.html`(엔진) → `agora-story.js`(전투 · 스토리 · 직업 · 의상) → `agora-field.js`(필드 코어) → 기능 모듈 9개.
기능 모듈은 각자 **자기 파일 하나만** 고쳐요. 다른 파일에 바꿀 게 있으면 최종 보고의 `NEEDS:` 에 적어요.

| 파일 | 맡는 일 |
|---|---|
| `agora-worlddata.js` | 대륙 설계도 `WORLD` (지역 · 랜드마크 · 길 · 강 · 사냥터 · NPC · 레이드 …). 모두가 읽기만 해요. |
| `agora-field.js` | 코어: `F` 컨텍스트, 지역(area) 등록, 입장/퇴장, 충돌 · 상호작용 공간 격자, 이름표, 알림, 지역 배너, 모듈 로더 |
| `agora-world.js` | 지형(높이장 · 메시 · 물 · 식생 · 바위) · 길 · 강 · 다리 · 룬 비석(빠른 이동) · 월드맵(M) · 미니맵 · 낮밤 · 글라이더 · 헤엄 · 바람 승강 룬 · 절벽 처리 |
| `agora-landmarks.js` | 새싹 마을 건물 · 37개 랜드마크 구조물 · 이정표 · 사냥터 표지판 · 길가 소품 · 발견(discover) 처리 |
| `agora-rpg.js` | 아이템 · 드랍 · 인벤토리/장비(I) · 강화 · 물약(H) · 상점 · 채집 · 상자 · 룬 정령 · 퀘스트(메인/의뢰/일일) 추적 · 퀘스트 로그(L) · 칭호/업적 |
| `agora-life.js` | 사냥터 몬스터 스폰/리스폰 · 새 몬스터(wolf · frostgolem · yeti · wraith) · 필드 보스 · NPC 피규어 · 봇 모험가(가짜 플레이어) · 채팅창 · 감정표현(T) |
| `agora-raid.js` | 레이드 게시판 · 레이드 3종(그롬 · 그라녹 · 크라이오스) 인스턴스 · 보스 AI · 파티원 봇 · 보상 |
| `agora-minigames.js` | 낚시(필드 낚시터 + 광장) · 광장 미니게임 메뉴(🎲 미니 게임) · 룬 리듬 · 과녁 맞히기 |
| `lore/*.js` | 지역별 이야기 데이터 (장 · 정착지 주민 · 읽을거리 · 셋피스 · 수호석 · 이야기 보스 · 퀘스트). `lore/index.js` 의 `LORE` 로 모아요. 형식: docs/agora-story-bible.md §6 · docs/agora-lore-guide.md |
| `agora-towns.js` | 정착지 8곳 건물 · 주민을 `WORLD.npcs` 에 넣기 · 읽을거리 물체 · 룬 수호석 물체 · 정착지 지도 표시 · 정착지 쪽 세상 변화 |
| `agora-props.js` | lore 셋피스(이야기 장면 소품) · 길가 소품 · 빈 땅을 채우는 작은 장면(모닥불 자리 · 폐허 · 돌무덤 …) · 셋피스 쪽 세상 변화 |
| `agora-saga.js` | 장(chapter) 진행 · 장 시작/끝 연출 · 연대기 창(N) · 읽기 창 · 수호석 의식 · 줍기 · 이야기 보스 · 주민 장별 대사(`F.greet`) · 세상 변화 적용 |

각 모듈은 `export async function init(G, X, F)` 하나를 내보내요. 불러오는 순서: world → landmarks → towns → props → life → rpg → saga → raid → minigames.
`agora-field.js` 가 하나씩 `try/catch` 로 불러서, 한 모듈이 깨져도 나머지는 떠요.
테스트할 때 `agora.html?mods=world,life` 처럼 일부만, `?nomods` 로 코어만 띄울 수 있어요.

## 좌표 · 높이 규칙 (중요)

- 필드 좌표: x 동(+), z 남(+). 북쪽(-z)으로 갈수록 레벨이 높아요. `WORLD.half = 800`.
- **필드 월드 물체(지형 · 건물 · NPC · 봇 · 채집물)** 는 `F.FW` 에 **절대 y** 로 넣어요. `y = F.H(x, z)` 가 지면이에요.
- **전투 레이어(`X.SW`) 물체(몬스터 · 텔레그래프 · 투사체 · 이펙트)** 는 **지면 기준 y** 예요 (y = 0 이 땅).
  필드에서는 렌더할 때 지형 높이를 자동으로 더해요. 그래서 `X.burst(new V3(x, 0.6, z) …)`, `X.telegraph(x, z, r)`, `X.shockwave(x, 0.15, z …)` 는 그대로 써도 맞는 높이에 그려져요.
  - 플레이어 기준 높이가 필요하면 `X.PY()` (= 플레이어 y − 지면 높이).
  - `X.emit(...)`(의상 파티클)는 **절대 좌표** 예요.
- 레이드 · 스토리 스테이지는 평평한 인스턴스라 지면이 0 이에요.

## X (agora-story.js 가 주는 것)

```
X.G, X.THREE, X.V3, X.R(), X.rr(a,b), X.clamp, X.ease, X.pick, X.angDiff, X.TAU, X.M(재질)
X.BUS.on(ev, fn) / X.BUS.emit(ev, data) / X.BUS.off
X.KEYH.push(code => bool)        // 키 처리기 (true = 처리함). 대화창이 열려 있으면 안 불려요.
X.BONUS { atk, hp, def, crit, mp, spd, aspd, rune, regen }   // 장비 · 버프 합계 — X.D() 에 바로 반영. def: 피해 ×100/(100+def)
X.S (저장 객체) · X.save() · X.D() 최종 능력치 · X.need(lv) · X.power() · X.fmt(n) · X.stars(n, 'e')
X.hp / X.mp (get/set) · X.heal(n) · X.restoreMp(n) · X.dead · X.mode('plaza'|'stage'|'field'|'raid') · X.inStory · X.battle · X.dialogOpen · X.tpBusy · X.anyWindow
X.gainExp(n) · X.dropOrbs(pos, total) · X.refreshHud() · X.hurtPlayer(dmg, fromV3, kb) · X.revive()
X.player (pos, vy, ground, speed) · X.fig (플레이어 피규어) · X.PY()
X.makeAvatar({ job, asc, look:{hat,back,body,wpn,aura}, scale }) → { fig, weapon, offhand, color, upd(dt, moving01, air), setArmed(bool) }
X.makeSword(scale, col) · X.makeBow(col) · X.makeStaff(col) · X.JOBS · X.jobName() · X.jobColor() · X.COS(의상 목록) · X.RAR · X.cosItem
X.ENEMIES · X.MON · X.BOSS (새 몬스터는 X.MON[key] = cfg 로 등록)
X.spawnMon(key, x, z, elite, opt) → e
   opt: { lv, name, scale, hpMul, dmgMul, fld:{hx,hz,aggro,leash,wr,passive}, ai(e,dt,d,dx,dz,face)→moving, fieldBoss, boss, cfg, data }
   - lv 를 주면 레벨 보정: 체력 X.LVHP(lv) · 공격 X.LVDMG(lv) · 경험치 X.LVEXP(lv), 이름표 "Lv.N 이름" (레벨 차이로 색)
   - fld 를 주면 필드 AI: 집 주변 배회 → aggro 반경 안에 들어오면 추격 → leash 넘으면 체력 회복하며 귀환. 110m 밖은 멈추고 숨겨요.
   - ai 를 주면 매 프레임 그 함수가 움직임을 맡아요 (보스 패턴 등)
X.killEnemy(e, silent) · X.hitEnemy(e, dmg, dx, dz, kb, crit) · X.hitFrom(e, x, z, dmg, kb, opt) · X.stunE(e, t) · X.liveE(e) · X.foesIn(x,z,r) · X.nearestEnemy(maxD) · X.turn(e, ang, k) · X.contact(e, extra)
X.bossBar(e | null)   // 화면 위 보스 체력바
X.MK { mkSlime(col), mkShroom(cap, stem), mkBoar(col), mkGolem(), mkTreant(), mkFrog(), mkOwl(), … face(g,y,z,s,spread), addCrown, sm(color,opts), EYE_M }
   몬스터 cfg 형식: { name, icon, mk: () => mkX(), hp, dmg, spd, rad, style:'hop'|'lunge'|'dash'|'charge'|'ranged'|'shooter'|'slam'|'turret'|'burrow'|'dive', range, wind, exp, top, fly? }
   mk() 는 { g, body, mats:[재질…], kind } 를 돌려줘요 (agora-story.js 의 mkSlime 등 참고). kind 가 animMon 에 없으면 기본 몸짓만 해요.
전투 레이어 이펙트 (지면 기준 y): X.SW · X.glowSprite(col, scale, op) · X.burst(p, col, n, sp, size, life, grav, up) · X.shockwave(x,y,z,R,col,life)
   · X.telegraph(x,z,r,ry,span) · X.teleRect(x,z,w,len,ry) · X.teleUpd(t,k,dt) · X.rmTele({tele}) · X.shootLine(x,y,z,ang,sp,dmg,life,kind) · X.throwArc(from,to,T,dmg,r,big)
   · X.explode · X.spike · X.bolt · X.fallObj · X.dmgNum(pos, text, cls) · X.trail
절대 좌표 파티클: X.emit(x,y,z, vx,vy,vz, col, size, life, {grav,drag,sway,grow,a}) · X.zap(a, b, col)
식생 · 소품 재사용: X.treeGeo(type) · X.TREEMAT (정점색) · X.smat(key, opts) · X.TX (노이즈 텍스처) · X.noiseTex · X.MATS2 · X.MOOD (분위기 프리셋) · X.water()
UI: X.mk(tag, id, html, parent) · X.hud · X.banner(a, b, c, red, dur) · X.hint(html, dur) · X.toast(h, s) · X.sfx(key)
   · X.say([[speakerId, text, choices?], …]) → 고른 번호 (X.NAMES[id] = 이름, X.SPK[id] = () => figure 로 카메라가 그 피규어를 봐요)
   · X.later(sec, fn) · X.wait(sec) · X.sleep(ms) · X.teleport(name, sub, fn)
   · X.openStats() · X.openJob() · X.openWardrobe()
모드: X.enterCombat(area) · X.setMode(m) · X.enterInstance(def) · X.leaveToPlaza() · X.cleanupBattle() · X.clearSkillFx()
   X.enterInstance({ shapes:[{c:[x,z,r]} | {s:[ax,az,bx,bz,r]}], entry:[x,z], boss:[x,z], face, mood, build(group, ctx) })
   — 평평한 전용 맵(레이드). ctx = { SCOL, SINT, anims, K, B, M, MATS2, smat, TX, plant, treeGeo, TREEMAT, forest, P, col }
감정표현: `X.emotePose = tp => pose | null` 을 세우면 (공격 · 구르기 · 스킬 중이 아닐 때) 그 포즈를 써요. 끝나면 null.
사망: 필드/레이드에서 쓰러지면 BUS 'death' → (X.deathHandled 가 false 면) 부활 창 → X.onRevive(mode)
sfx 키: swing hit crit hurt roll rune boom die level pick ui portal clang roar shard pop buzz stomp throw boing puff rumble summon type bow zap heart elite
```

## F (agora-field.js 코어가 주는 것 + 모듈이 채우는 것)

```
F.WORLD (설계도) · F.byId(list, id) · F.FW (필드 그룹) · F.G · F.X
F.H(x,z) 지면 높이 (world 가 정밀 지형으로 교체) · F.groundFn(x,z) 플레이어가 딛는 높이 (world: 헤엄)
F.isWater(x,z) · F.waterDepth(x,z) · F.slope(x,z) · F.groundPos(x,z,up)
F.regionAt(x,z) · F.regionById(id) · F.region (현재) · F.randomPointIn(regionOrId, { c, r, maxSlope, avoidRoads })
F.addCollider(c) / F.circle(x,z,r) / F.box(x,z,hw,hd,ry) / F.removeCollider(c)     — 공간 격자, 플레이어 주변만 검사해요
F.addInteract({ x, z, r, title, action, hidden }) / F.removeInteract(it)         — E 키 / 터치 버튼 상호작용
F.bound(p)       (world 가 채움) 플레이어 절벽 · 경계 처리. p === X.player.pos 일 때만 플레이어예요.
F.enemyBound(p, m) (world 가 채움) 몬스터가 물 · 절벽 밖으로 못 나가게
F.roadDist(x,z)  (world 가 채움) 가장 가까운 길까지 거리
F.label({ obj | pos | get, text, sub, q, cls:'npc'|'bot'|'place', max, y }) → { set(text, sub, q), remove(), hidden }   — 떠 있는 이름표
F.menu.add(icon, label, fn, key) 메뉴줄 버튼 · F.note(html, dur) 오른쪽 알림 피드 · F.regionBanner(a, b, c, dur) · F.chat(text, from, kind) (life 가 채팅창으로 교체)
F.talk(npcId) → F.talkers[npcId] 또는 F.roleTalkers[role] (없으면 기본 인사)
F.enter({ wp, x, z, face, resume }) · F.teleportTo(x, z, name, sub) · F.leave() · F.inField · F.unlocked()
F.mapCanvas (2048² 미니맵 바탕) · F.drawMapBase() (world 가 지형 색으로 다시 그려요) · F.area (G 의 area: mapZoom, mapDraw(ctx, k) 추가 가능)
F.modules[name]  — 각 모듈 init 의 반환값 (모듈 API). 다른 모듈은 이것만 보고 써요.
```

### 모듈이 F 에 올리는 API (다른 모듈이 기대해요)

- **world**: `F.H` 교체, `F.groundFn`, `F.bound`, `F.enemyBound`, `F.roadDist`, `F.discoverWaypoint(id)`, `F.openWorldMap()`, `F.unlockGlider()`, `F.timeOfDay` (0~1, 0.5 정오), `F.isNight()`, `F.gliding`, `F.swimming`
- **landmarks**: `F.landmarkAt(x,z)`, `F.discovered(id)` (BUS 'discover' 도 쏴요)
- **rpg**: `F.addItem(id, n)`, `F.hasItem(id, n)`, `F.takeItem(id, n)`, `F.giveLoot(tableId | level, pos)`, `F.questEvent(type, data)`, `F.openInventory()`, `F.openQuests()`, `F.gold(n)` (+/-), `F.title`, `F.ITEMS`
- **life**: `F.npcs[id] = { fig, pos, label }` (label 은 F.label 핸들 — rpg 가 `label.set(name, title, '!')` 로 퀘스트 표시), `F.bots[]`, `F.chat(...)` 교체, `F.say(text)` (말풍선), `F.emote(name)`, `F.spawnCamp(id)`, `F.worldBoss`
- **raid**: `F.openRaidBoard()`, `F.enterRaid(id)`, `S.raid.clears`
- **minigames**: `F.startFishing(spotId)`, `F.openMinigames()`
- **towns**: `F.towns = { obj(id), pos(id) → [x, y, z], show(id, on), setChange(key, on, instant), settlementAt(x, z) }` — id 는 정착지 · 읽을거리(r_…) · 수호석(ks_…). 수호석 obj 에는 `setLit(0~1)` 이 있어요. init 맨 처음에 lore 주민을 `WORLD.npcs` 에 `{ role: 'resident', resident: true, region, idle, lines }` 로 넣어요 (그래서 life 가 피규어를, rpg 가 대화를 맡아요).
- **props**: `F.props = { obj(id), pos(id), show(id, on), setChange(key, on, instant) }` — id 는 셋피스(sp_…). `pickup: true` 셋피스는 처음엔 숨겨 두고 saga 가 켜요.
- **saga**: `F.greet(id) → 대사 | null` (주민 · 기존 NPC 의 장별 인사), `F.saga = { chapterState(n) → 'before'|'during'|'after', openCodex(), target(o) → {x, z, label} | null, playIntro(n) }`

## BUS 이벤트

| 이벤트 | 데이터 | 누가 쏴요 |
|---|---|---|
| `kill` | 적 e (e.key, e.lv, e.elite, e.boss, e.fboss, e.camp, e.pos) | story |
| `hit` | { e, dmg, crit } | story |
| `hurt` | 받은 피해 | story |
| `spawn` | e | story |
| `levelUp` | { lv } | story |
| `mode` | 'plaza' / 'stage' / 'field' / 'raid' | story |
| `leave` | 떠나는 모드 | story (광장으로 갈 때) |
| `death` | 모드 | story |
| `enterField` | { x, z, warp?, revive? } | field |
| `leaveField` | — | field |
| `region` | { id, prev } | field |
| `fieldReady` | F | field |
| `talk` | { npc } | field |
| `discover` | { id, name, kind:'landmark'\|'waypoint' } | landmarks / world |
| `gather` | { kind, item } | rpg |
| `loot` | { item, n } | rpg |
| `quest` | { id, state:'accept'\|'progress'\|'done' } | rpg |
| `enhance` | { item, ok, lvl } | rpg |
| `fish` | { id, name, rarity, size } | minigames |
| `minigame` | { id, score } | minigames |
| `raidClear` | { id, time } | raid |
| `worldBoss` | { id, state:'spawn'\|'dead' } | life |
| `glider` | — (글라이더 얻음) | world |
| `npcsReady` | F.npcs | life |
| `read` | { id } (읽을거리를 처음 읽음) | saga |
| `cleanse` | { id } (수호석에 룬을 새김) | saga |
| `collect` | { id } (이야기 물건 주움) | saga |
| `storyBoss` | { id, state:'spawn'\|'dead' } | saga |
| `chapter` | { n, state:'start'\|'done' } | saga |

## 저장 (X.S 아래 이름 공간)

`S.field`(코어 · world: disc, wps, lastWp, pos, glider) · `S.lm`(landmarks) · `S.saga`(saga: ch, read, cleansed, picked, sboss, met) · `S.inv`, `S.q`, `S.titles`, `S.ach`(rpg) · `S.life`(life) · `S.raid`(raid) · `S.mini`, `S.fish`(minigames).
골드는 `S.gold`, 레벨/경험치는 `S.lv`/`S.exp` (X.gainExp 로만 올려요). 바꾸면 `X.save()`.

## 키 배정 (겹치지 않게)

이미 씀: WASD · Shift · Space · E(상호작용) · J/F/클릭(공격) · K/우클릭(구르기) · R/Q(룬) · 1~4(스킬) · C(스탯) · V(직업) · B(의상실) · M(지도) · Esc
- world: **M**(필드 월드맵) · **Space 공중에서 길게**(글라이더)
- rpg: **I**(인벤토리 · 장비) · **L**(퀘스트 로그) · **H**(체력 물약) · **G**(마나 물약)
- saga: **N**(연대기)
- life: **T**(감정표현) · **Enter**(채팅) · **/**(채팅)
- minigames: 낚시 중 Space/클릭 · 리듬 D F J K
- raid: 없음 (게시판 / NPC)
필드 오른쪽 메뉴줄(미니맵 아래)은 코어가 만들어요: `F.menu.add(icon, label, fn, key)` → 버튼 (`.dot` 클래스 = 빨간 알림 점). 가방 · 퀘스트 · 지도 · 감정표현 등을 각 모듈이 넣어요. 터치에서는 아이콘만 보여요.

## 맡는 NPC · 상호작용 (겹치지 않게)

- NPC 피규어 · 이름표 · E 상호작용(→ `F.talk(id)`)은 **life** 가 만들어요. `object: true` (의뢰 게시판)는 피규어 없이 **landmarks** 가 게시판 모양을, **rpg** 가 상호작용을 만들어요.
- 대화 내용: quest_main · quest · resident · smith · shop · inn · board → **rpg** (인사말은 `F.greet(id)` 가 있으면 그걸 먼저), raid → **raid**, fish → **minigames**, glider → **world**, wardrobe → 코어(의상실 열기).
- 레이드 입구(가라앉은 신전 · 버려진 광산 · 얼어붙은 제단): 모양은 **landmarks**, 입장 상호작용은 **raid**.
- 룬 비석: 모양 · 상호작용 · 빠른 이동 모두 **world**. 룬의 관문(광장 귀환): 모양 **landmarks**, 상호작용도 **landmarks** (→ `F.leave()`).
- 사냥터 표지판(이름 · 레벨): **landmarks**. 사냥터 몬스터: **life**.
- 물고기는 **minigames** 가 `S.fish` 에 따로 보관 · 판매해요 (rpg 가방에 넣지 않아요).

## UI 규칙

- 창(모달): `z-index: 27`, 열린 동안 `G.lock` 은 쓰지 않아요 (전투 중 열 수 있게). Esc 로 닫혀요.
- HUD 요소는 `X.hud` 안에. `body.cine` (대화 · 연출 중) 이면 숨겨요. `body[data-area="field"]` 에서만 보여야 하는 건 그 선택자로.
- 글꼴: 제목 'Gowun Batang', 본문 'Noto Sans KR', 영문 장식 'Cinzel'. 금색 테두리 rgba(233,200,126,.55), 배경 rgba(16,20,34,.95) 계열 (기존 #statw · #jobw · #shop 참고).
- 모바일(`body.touch`, 폭 760 이하)에서도 화면 밖으로 안 나가게.

## 성능 예산 (모바일 고려)

- 필드 전체 드로콜 ≲ 350, 삼각형 ≲ 1.5M. 정적 지오메트리는 `G.Builder`/`G.Kit` 로 재질별 병합, 반복 물체는 `InstancedMesh`.
- 넓은 것은 셀(≈100~200m)로 쪼개 거리로 `visible` 끄기. 매 프레임 할당 줄이기.
- `castShadow` 는 크고 가까운 것만. 그림자 카메라는 플레이어를 따라가요 (±64m).
- `G.gfxMode === 'low'` 또는 `G.IS_TOUCH` 면 식생 · 파티클 밀도를 낮춰요.
