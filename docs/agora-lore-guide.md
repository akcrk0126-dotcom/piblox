# 지역 이야기 쓰기 지침 (lore/*.js)

먼저 읽을 것: `docs/agora-story-bible.md` (세계관 · 장 구성 · 데이터 형식) → 본보기 `lore/village.js` · `lore/greenhill.js` (이 두 파일의 밀도 · 문체 · 퀘스트 흐름을 그대로 따라 주세요).

## 한 지역 파일이 담는 것

| 키 | 개수 | 설명 |
|---|---|---|
| `chapter` | 1 | `{ n, title, en, lv:[a,b], intro:[3~5줄], outro:[2~3줄], pan:[[x,y,z,lx,ly,lz],[...]], change:[키...] }` — pan 은 절대 좌표, y 는 지면 높이 + 25~60 |
| `settlement` | 1 | `agora-worlddata.js` 의 `settlements` 에 있는 그 지역 정착지 (id · c · r · style 그대로). 주민 4~6명 |
| `npcLines` | 0~3 | 그 지역에 원래 있던 NPC(`WORLD.npcs`)의 장별 인사 `{ before, during, after }` — 하나만 있어도 돼요 |
| `readables` | 6~8 | 석판 · 일기 · 편지 · 수배지 · 책 · 묘비 · 동요. 본문 3~8줄, 이야기 조각이 되게 |
| `setpieces` | 12~18 | 이야기가 보이는 장면 소품. 퀘스트로 줍는 것은 `pickup: true` |
| `keystone` | 1 | `{ id: 'ks_<region>', name, c }` (침식지는 수호석 대신 `ks_blight` = 세계수 심장의 뿌리) |
| `bosses` | 0~1 | 이야기 보스 (레이드가 클라이맥스인 장은 0) |
| `quests` | 메인 5~7 + 곁가지 3~4 | agora-rpg.js 형식 |
| `titles` | 1 | 장 완료 칭호 `{ id: { n, d, b } }` (b: atk · hp · def · crit · spd · mp · regen 중 1~2개, 작게) |

## 규칙

- **id 접두사**: 지역마다 정해진 두 글자 — village `vl` · greenhill `gh` · woods `wd` · lake `lk` · swamp `sw` · canyon `cn` · plateau `pl` · blight `bl` · frost `fr`.
  readables `r_<xx>_…` · setpieces `sp_<xx>_…` · bosses `sb_…` · 메인 퀘스트 `c<장>_<번호>` · 곁가지 `s_<xx>_…` · 주민 id 는 짧은 영어 소문자 (다른 지역과 겹치면 안 돼요: 이미 쓴 것 popo pin odi teo bori mut hani).
- **좌표는 반드시 도구로 확인**: `node tools/lore/terrain.mjs flat x,z 반경 개수` 로 빈 평지를 찾고, 다 쓰면 `node tools/lore/terrain.mjs check lore/<region>.js` 가 `✔ 문제 없음` 이 될 때까지 고쳐요.
  - 주민은 정착지 반경 안 (밖이면 `away: true`). 정착지 가운데 반경의 0.35 안쪽은 광장이라 비워 두면 좋아요.
  - 셋피스는 랜드마크 · 사냥터 둘레에 흩어서, 지역 전체가 고르게 채워지게 (한곳에 몰지 말고 60~100m 간격으로 지역 곳곳에).
  - 물 위에 놓아도 되는 셋피스: `sunken_boat dock drowned_house nets dark_spring lantern_post offering`.
- **퀘스트 흐름** (메인은 한 줄로 이어져요):
  - 장의 첫 메인 퀘스트는 **앞 장 마지막 퀘스트를 보고받은 NPC** 가 주고(`giver`), 이 지역 사람에게 보내요(`to`). 앞 장 마지막 대사에서 다음 장 사건을 예고해요 (본보기: c1_6 의 마지막 대사 → 로완의 여동생).
    앞 장의 마지막 보고 NPC — 1장 `teo` · 2장~8장은 앞 지역 작가가 정해요 (아래 표).
  - 장 안에서는: 정착지 도착 → 이상한 일 → 단서(읽을거리 · 줍기 · 사냥) → 수호수와 대결 → 수호석에 룬 새기기 → 보고. 목표는 한 퀘스트에 1~3개.
  - `lv` 는 장의 레벨대 안에서 천천히 올라가요. 보상 `rw.xp` 메인 0.6~1.2 / 곁가지는 생략(기본값). 장비 보상은 장마다 2~3번, `il` ≈ 퀘스트 lv + 1, `r` 1~3.
  - 마지막 메인 퀘스트 보상에 `title` (이 파일의 `titles` id).
- **목표 종류**: `talk{npc,d,say}` · `kill{key,n,reg,at,d}` · `gather{item,n,reg,d}` · `discover{id,d}` · `fish{n,d}` · `raid{id,d}` · `read{id,d}` · `collect{id 또는 [id...], n,d}` · `cleanse{id,d}` · `sboss{id,d}` · `reach{c:[x,z], r, d}` · `fboss{key,d}`(되도록 쓰지 말고 sboss 로).
  - `kill.key`: slime shroom bee boar sprout golem squirrel frog ladybug snail flower raccoon mole owl hedgehog wolf frostgolem yeti wraith. `at` 은 그 지역 사냥터 id (WORLD.camps). `reg` 는 지역 id.
  - `gather.item`: herb mushroom ore crystal / `discover.id`: WORLD.landmarks id / `raid.id`: grom granok cryos.
  - 이야기 보스 `key`: 몬스터 키 또는 보스 키 kingSlime chief queen tusk treant. `lv` 는 그 퀘스트 lv + 1, `scale` 1~2.4, `hpMul` 2~6.
- **보상 아이템**: hp1~hp4 · mp1~mp4 (레벨대에 맞게: 1~7 → 1, 8~15 → 2, 16~23 → 3, 24~ → 4) · herb mushroom ore crystal stone sseed.
- **look**: hat — straw wizard cat viking crown halo / back — cape royal butterfly angel shadowcloak / body — marble sakura obsidian silver shadow. `job`: sword archer mage rogue (무기를 든 사람만).
- **idle**: farm sit stand fish hammer read guard pray sweep play cook.
- **change 키** (장이 끝나면 세상이 바뀌는 것 — 구현 쪽이 이 이름으로 만들어요. 지역마다 1~3개, 새 이름을 지어도 돼요):
  village_letter · windmill_spin · fields_heal · spore_clear · spirit_lights · lina_home · lake_clear · lake_lord · swamp_lanterns · mist_thin · dust_lively · tears_stop · golems_calm · thorns_recede · north_wind_clear · festival
- 기존 NPC 대사 · 성격: `agora-rpg.js` 의 `GREET` 와 옛 곁가지 퀘스트 (s_boar · s_raccoon · s_spore · s_mole · s_owl · s_queen · s_hedge · s_bandit · s_tusk · s_starowl · s_spirits · s_shadow · s_purge · s_yeti · s_spine · s_icefish 는 그대로 남아요 — 겹치지 않게).
- 몬스터 · 레이드 · 랜드마크가 **왜 거기 있는지** 를 이야기로 이어 주세요 (bible §2, §3). 랜드마크 설명(WORLD.landmarks desc)과 어긋나지 않게.
- 전체 이용가 · 귀엽고 따뜻하게. 슬픈 이야기도 희망으로.

## 장 사이를 잇는 NPC

| 장 | 지역 | 이 장의 마지막 퀘스트를 보고받는 NPC (다음 장 첫 퀘스트의 giver) |
|---|---|---|
| 1 | greenhill | `teo` (정해짐) |
| 2 | woods | woods 작가가 정해서 아래 lake 작가에게 알려 줘요 — 기본값 `rowan` |
| 3 | lake | 기본값 `fisher` (낚시꾼 노아) |
| 4 | swamp | 기본값 `morgana` |
| 5 | canyon | 기본값 `brick` |
| 6 | plateau | 기본값 `elin` |
| 7 | blight | 기본값 `eldra` |
| 8 | frost | `hermit` → 마지막에 `chief` 에게 돌아가는 에필로그 퀘스트 (`c8_<마지막>` 의 to: chief) |

기본값과 다르게 하려면 그 지역 작가끼리 맞춰야 하니, **기본값을 그대로 쓰세요.**
