// 룬 아고라 — 모험의 대지 「아르카디아」 설계도
// 모든 필드 모듈(지형 · 랜드마크 · 생태계 · RPG · 레이드 · 미니게임)이 이 한 장의 설계도를 같이 봐요.
// 좌표: x = 동(+) / 서(-), z = 남(+) / 북(-), 단위 m. 북쪽으로 갈수록 레벨이 올라가요.
// 높이(h)는 물 높이(water = 2) 기준 실제 지면 높이예요.

export const WORLD = {
  name: '아르카디아', en: 'ARCADIA',
  half: 800,          // 월드는 x, z ∈ [-800, 800]
  water: 2.0,         // 호수 · 강 · 늪 수면 높이
  spawn: { x: 0, z: 592, face: Math.PI },   // 새싹 마을 남문 (룬 관문 앞), 북쪽을 봐요

  // ── 지역 (레벨대) ──────────────────────────────────────────────
  // biome: 지형 색 · 식생 · 소품 팔레트를 고르는 키 / mood: G.setMood 프리셋 (agora-story.js MOOD)
  regions: [
    { id: 'village',   name: '새싹 마을',        en: 'Sprout Village',     lv: [1, 1],   c: [0, 560],     r: 62,  biome: 'village', mood: 'noon',     safe: true,  color: '#c9b27a', desc: '모든 모험가가 처음 발을 딛는 평화로운 마을.' },
    { id: 'greenhill', name: '초록 언덕',        en: 'Greenhill Meadows',  lv: [1, 6],   c: [0, 400],     r: 235, biome: 'meadow',  mood: 'noon',                  color: '#7fbf5a', desc: '바람개비가 도는 완만한 언덕. 초보 사냥터가 모여 있다.' },
    { id: 'woods',     name: '속삭이는 숲',      en: 'Whispering Woods',   lv: [5, 11],  c: [-390, 300],  r: 215, biome: 'forest',  mood: 'morning',               color: '#3f8a4a', desc: '나무 사이로 속삭임이 들리는 숲. 우거졌지만 길은 열려 있다.' },
    { id: 'lake',      name: '은빛 호수',        en: 'Silvermere',         lv: [7, 12],  c: [0, 110],     r: 165, biome: 'lake',    mood: 'golden',                color: '#5aa8c8', desc: '대륙 한가운데의 거울 같은 호수. 낚시꾼들의 성지.' },
    { id: 'swamp',     name: '안개 늪',          en: 'Mistmire',           lv: [11, 16], c: [390, 210],   r: 200, biome: 'swamp',   mood: 'mist',                  color: '#6a7a4a', desc: '발목까지 차오르는 물과 짙은 안개. 가라앉은 신전이 잠들어 있다.' },
    { id: 'canyon',    name: '붉은 협곡',        en: 'Redrock Canyon',     lv: [16, 21], c: [420, -260],  r: 225, biome: 'canyon',  mood: 'sunset',                color: '#c0603a', desc: '붉은 바위 탁자와 절벽이 미로처럼 얽힌 협곡.' },
    { id: 'plateau',   name: '거인의 고원',      en: 'Titan Plateau',      lv: [20, 25], c: [-400, -280], r: 215, biome: 'plateau', mood: 'overcast',              color: '#9a9a7a', desc: '거인의 계단을 올라야 닿는 고원. 옛 왕국의 폐허가 남아 있다.' },
    { id: 'blight',    name: '검은 가시 침식지', en: 'Blackthorn Blight',  lv: [24, 30], c: [0, -330],    r: 175, biome: 'blight',  mood: 'purple',                color: '#5a2a6a', desc: '검은 가시가 땅을 뒤덮은 곳. 숲의 친구들이 미쳐 날뛴다.' },
    { id: 'frost',     name: '서리 봉우리',      en: 'Frostpeak',          lv: [26, 30], c: [0, -610],    r: 265, biome: 'snow',    mood: 'overcast',              color: '#dfe8f0', desc: '용의 등뼈 능선 너머 만년설의 땅. 하늘 끝 봉우리가 솟아 있다.' },
  ],

  // ── 지형 골격 ────────────────────────────────────────────────
  // 기본 높이 조절점 [x, z, h] — 역거리 가중으로 부드럽게 이어요 (+ 작은 노이즈)
  elev: [
    [0, 560, 8], [0, 610, 9], [-200, 560, 16], [220, 560, 14], [0, 440, 12], [-150, 470, 26], [140, 420, 14], [170, 320, 18], [-60, 360, 7], [90, 520, 10],
    [0, 235, 5], [-130, 150, 6], [140, 90, 5], [0, -15, 6], [-140, 40, 7], [120, 0, 7],
    [-380, 300, 14], [-500, 180, 18], [-300, 420, 12], [-560, 420, 22], [-420, 260, 16], [-260, 230, 11], [-480, 100, 16],
    [390, 210, 3], [300, 290, 4], [500, 150, 3], [430, 60, 4], [330, 120, 3.5], [520, 270, 5],
    [420, -260, 14], [300, -150, 12], [560, -200, 18], [450, -380, 15], [300, -60, 10],
    [-200, -60, 12], [-120, -110, 10], [0, -100, 9], [120, -120, 10],
    [0, -330, 24], [-150, -300, 28], [150, -300, 27], [0, -440, 32],
    [0, -470, 40], [0, -580, 46], [-120, -600, 52], [120, -610, 50], [-300, -600, 70], [300, -610, 66], [0, -690, 90],
  ],
  border: { start: 690, peak: 170 },   // 가장자리 산맥: 중심에서 (초타원 거리) start 이후 급하게 솟아요

  // 호수 · 연못: 타원 [cx, cz, rx, rz], depth = 수면 아래 최대 깊이
  lakes: [
    { id: 'silvermere', name: '은빛 호수', c: [0, 110], rx: 122, rz: 96, depth: 9 },
    { id: 'villagepond', name: '마을 연못', c: [22, 604], rx: 11, rz: 8, depth: 1.6 },
    { id: 'swamp1', name: '늪 웅덩이', c: [360, 180], rx: 32, rz: 26, depth: 1.8 },
    { id: 'swamp2', name: '늪 웅덩이', c: [440, 232], rx: 26, rz: 22, depth: 1.6 },
    { id: 'swamp3', name: '늪 웅덩이', c: [412, 118], rx: 22, rz: 18, depth: 1.5 },
    { id: 'swamp4', name: '늪 웅덩이', c: [298, 232], rx: 18, rz: 16, depth: 1.4 },
    { id: 'swamp5', name: '늪 웅덩이', c: [486, 186], rx: 20, rz: 18, depth: 1.5 },
    { id: 'stiltpool', name: '말뚝 마을 물웅덩이', c: [424, 330], rx: 22, rz: 16, depth: 1.5 },
    { id: 'springpool', name: '속삭이는 샘', c: [-482, 160], rx: 14, rz: 12, depth: 2.2 },
    { id: 'weeppool', name: '울음바위 웅덩이', c: [326, -196], rx: 18, rz: 10, depth: 1.8 },
    { id: 'icelake', name: '얼음 호수', c: [20, -612], rx: 26, rz: 18, depth: 2.4, frozen: true },
  ],
  // 섬 (호수 안 솟은 땅): [cx, cz, r, h]
  islands: [{ id: 'pavilion', c: [20, 100], r: 20, h: 5 }],
  // 강: 폭 w, 깊이 depth. 첫 점이 상류.
  rivers: [
    { id: 'mane', name: '은빛 개울', w: 10, depth: 3, pts: [[-82, -282], [-70, -230], [-60, -168], [-56, -110], [-36, -55], [-26, 0], [-16, 32]] },
    { id: 'reed', name: '갈대 개울', w: 8, depth: 2.4, pts: [[108, 132], [190, 152], [262, 172], [330, 188]] },
  ],
  // 고원: 꼭대기 높이 h, 가장자리는 절벽 (edge = 절벽 두께 m). 경사로(ramps) 로만 올라가요.
  plateaus: [
    { id: 'titan', name: '거인의 고원', c: [-405, -285], r: 195, h: 46, edge: 5, noise: 22, cliffName: '거인의 벽' },
    { id: 'weepbench', name: '울음바위 단구', c: [330, -130], r: 48, h: 38, edge: 4, noise: 8, cliffName: '울음바위 절벽' },
  ],
  // 경사로 / 계단: 아래 점(from) → 위 점(to), 폭 w. stairs: true 면 계단처럼 단을 깎아요.
  ramps: [
    { id: 'titanstairs', name: '거인의 계단', from: [-212, -146], to: [-266, -200], w: 16, stairs: true },
    { id: 'weepramp', name: '울음바위 오르막', from: [384, -192], to: [362, -160], w: 9 },
  ],
  // 나선 산길: 봉우리 중심 c 둘레를 돌며 반지름 r0 → r1, 높이 h0 → h1 로 올라가요 (폭 w)
  spirals: [
    { id: 'summitpath', name: '하늘길', c: [-200, -662], r0: 74, r1: 9, h0: 50, h1: 178, turns: 1.6, start: 0.6, w: 6 },
  ],
  // 바람 승강 룬: 아래 룬진에서 상호작용하면 바람을 타고 꼭대기로 날아올라요
  lifts: [
    { id: 'eaglelift', name: '바람 승강 룬', from: [552, -318], to: [532, -332] },
  ],
  // 단층 (한쪽이 솟은 절벽 선): 선 a→b 의 왼쪽(북쪽)이 rise 만큼 높아요. gaps 에서는 완만한 고갯길.
  scarps: [
    { id: 'shadowscarp', name: '그림자 낭떠러지', a: [-215, -150], b: [165, -192], rise: 15, w: 4, gaps: [{ x: 0, w: 22 }] },
  ],
  // 메사 · 첨탑: 원기둥 같은 바위산 [cx, cz, r, h]
  mesas: [
    { id: 'redtable', name: '붉은 탁자 바위', c: [360, -320], r: 46, h: 52 },
    { id: 'twinA', name: '쌍둥이 바위', c: [482, -134], r: 11, h: 40 },
    { id: 'twinB', name: '쌍둥이 바위', c: [503, -116], r: 9, h: 37 },
    { id: 'eagle', name: '독수리 둥지 바위', c: [532, -332], r: 15, h: 92 },
    { id: 'redfinger', name: '붉은 손가락', c: [560, -400], r: 7, h: 46 },
  ],
  // 능선 · 봉우리 (서리 봉우리 지대)
  ridges: [
    { id: 'dragonspine', name: '용의 등뼈 능선', pts: [[-340, -520], [-200, -530], [-70, -516], [70, -518], [200, -530], [340, -518]], h: 112, w: 56, pass: { x: 0, w: 36, h: 52 } },
  ],
  peaks: [
    { id: 'skyreach', name: '하늘 끝 봉우리', c: [-200, -662], r: 78, h: 178 },
    { id: 'frosthorn', name: '서리 뿔', c: [250, -672], r: 62, h: 140 },
  ],
  // 지도 · 표지판에 이름이 붙는 절벽 · 지형 (설명용)
  namedTerrain: [
    { name: '그림자 낭떠러지', c: [-90, -168], kind: 'cliff' },
    { name: '거인의 벽', c: [-236, -250], kind: 'cliff' },
    { name: '울음바위 절벽', c: [328, -176], kind: 'cliff' },
    { name: '매의 절벽', c: [-222, 402], kind: 'cliff' },
    { name: '용의 등뼈 능선', c: [200, -528], kind: 'ridge' },
    { name: '하늘 끝 봉우리', c: [-200, -662], kind: 'peak' },
    { name: '서리 뿔', c: [250, -672], kind: 'peak' },
    { name: '붉은 탁자 바위', c: [360, -320], kind: 'mesa' },
    { name: '은빛 개울', c: [-48, -90], kind: 'river' },
    { name: '갈대 개울', c: [240, 166], kind: 'river' },
  ],
  // 작은 절벽 (언덕의 깎인 면): 원의 한쪽이 낭떠러지 [cx, cz, r, drop, 방향(라디안, 낭떠러지 쪽)]
  bluffs: [{ id: 'hawk', name: '매의 절벽', c: [-205, 402], r: 34, drop: 11, dir: Math.PI }],

  // ── 길 ──────────────────────────────────────────────────────
  roads: [
    { id: 'main', name: '새싹길', w: 7, pts: [[0, 625], [0, 560], [0, 470], [8, 380], [2, 300], [0, 236]] },
    { id: 'west', name: '숲길', w: 6, pts: [[0, 236], [-90, 226], [-170, 232], [-255, 240], [-330, 268], [-410, 290]] },
    { id: 'east', name: '갈대길', w: 6, pts: [[0, 236], [80, 220], [150, 196], [190, 152], [260, 190], [330, 228]] },
    { id: 'shore', name: '호숫가 길', w: 6, pts: [[-90, 226], [-142, 150], [-142, 60], [-96, -14], [-40, -50], [0, -90], [0, -120]] },
    { id: 'northeast', name: '협곡길', w: 6, pts: [[0, -120], [90, -140], [200, -170], [300, -200], [396, -228]] },
    { id: 'northwest', name: '거인의 길', w: 6, pts: [[0, -120], [-110, -128], [-200, -136], [-212, -146], [-266, -200], [-330, -225], [-352, -232]] },
    { id: 'north', name: '가시 고갯길', w: 6, pts: [[0, -120], [0, -186], [0, -250], [0, -320], [24, -432], [0, -490], [0, -540], [10, -580]] },
    { id: 'altar', name: '제단길', w: 5, pts: [[10, -580], [40, -608], [60, -628]] },
    { id: 'swampcanyon', name: '늪지 샛길', w: 5, pts: [[330, 228], [430, 140], [446, 20], [430, -110], [400, -228]] },
    { id: 'windmill', name: '바람개비 오솔길', w: 4, pts: [[0, 470], [-70, 480], [-140, 488]] },
    { id: 'oak', name: '떡갈나무 오솔길', w: 4, pts: [[8, 380], [80, 400], [138, 418]] },
    { id: 'farm', name: '농원길', w: 4, pts: [[-28, 556], [-70, 552], [-112, 548], [-128, 516], [-140, 488]] },
    { id: 'leaf', name: '잎새 오솔길', w: 4, pts: [[-330, 268], [-345, 300], [-332, 350], [-302, 392]] },
    { id: 'stilt', name: '말뚝 판자길', w: 4, pts: [[330, 228], [372, 270], [404, 304]] },
    { id: 'dust', name: '광차길', w: 5, pts: [[396, -228], [424, -212], [452, -186], [466, -176]] },
    { id: 'abbey', name: '수도원 길', w: 4, pts: [[2, -546], [28, -552], [52, -556]] },
  ],
  // 다리 (길이 강을 건너는 곳)
  bridges: [
    { id: 'moon', name: '달빛 다리', c: [-38, -52], ry: 0.95, len: 22, w: 6 },
    { id: 'reedbridge', name: '갈대 다리', c: [190, 152], ry: -0.35, len: 18, w: 6 },
  ],
  // 이정표 (갈림길)
  signposts: [
    { c: [6, 244], to: [['새싹 마을', 'S'], ['속삭이는 숲', 'W'], ['안개 늪', 'E'], ['은빛 호수', 'N']] },
    { c: [8, -112], to: [['붉은 협곡', 'NE'], ['거인의 고원', 'NW'], ['검은 가시 침식지', 'N'], ['은빛 호수', 'S']] },
    { c: [336, 236], to: [['붉은 협곡', 'N'], ['가라앉은 신전', 'E'], ['은빛 호수', 'W']] },
    { c: [-94, 234], to: [['속삭이는 숲', 'W'], ['호숫가 길', 'N'], ['새싹 마을', 'S']] },
    { c: [8, 478], to: [['바람개비 언덕', 'W'], ['새싹 마을', 'S'], ['은빛 호수', 'N']] },
    { c: [-206, -128], to: [['거인의 계단', 'NW'], ['갈림길', 'E']] },
    { c: [18, -584], to: [['얼어붙은 제단', 'NE'], ['하늘 끝 봉우리', 'W'], ['얼음 고개', 'S']] },
  ],

  // ── 룬 비석 (빠른 이동) ────────────────────────────────────────
  waypoints: [
    { id: 'wp_village', name: '새싹 마을', c: [14, 540] },
    { id: 'wp_windmill', name: '바람개비 언덕', c: [-132, 496] },
    { id: 'wp_hunter', name: '사냥꾼 야영지', c: [-248, 246] },
    { id: 'wp_lake', name: '은빛 호수 남쪽', c: [22, 246] },
    { id: 'wp_moon', name: '달빛 다리', c: [-20, -70] },
    { id: 'wp_swamp', name: '안개 늪', c: [330, 240] },
    { id: 'wp_canyon', name: '붉은 협곡', c: [400, -236] },
    { id: 'wp_plateau', name: '거인의 고원', c: [-352, -244] },
    { id: 'wp_blight', name: '침식의 문', c: [12, -252] },
    { id: 'wp_frost', name: '얼음 고개', c: [14, -496] },
    { id: 'wp_basin', name: '서리 분지', c: [-14, -584] },
  ],

  // ── 정착지 (사람이 사는 곳) ────────────────────────────────────
  // agora-towns.js 가 집 · 소품 · 주민을 세워요 (주민 · 이야기는 lore/*.js). flat = 지형을 반경 r 안에서 고르게 다져요.
  // style: farm 농가 · treehouse 나무 위 마을 · fishing 어촌 · stilt 말뚝 마을 · mining 광산촌 · dig 발굴 야영지 · fort 요새 · monastery 수도원
  settlements: [
    { id: 't_farm',  name: '볕드는 농원',      en: 'Sunny Farmstead',   c: [-112, 548], r: 30, region: 'greenhill', style: 'farm',      flat: true },
    { id: 't_leaf',  name: '잎새 마을',        en: 'Leafhollow',        c: [-345, 300], r: 28, region: 'woods',     style: 'treehouse', flat: true },
    { id: 't_mist',  name: '물안개 나루',      en: 'Mistferry',         c: [92, 200],   r: 26, region: 'lake',      style: 'fishing',   flat: true, ground: 4.6, dock: [92, 166] },
    { id: 't_stilt', name: '갈대 말뚝 마을',   en: 'Reedstilt',         c: [410, 315],  r: 28, region: 'swamp',     style: 'stilt',     flat: false },
    { id: 't_dust',  name: '붉은 먼지 광산촌', en: 'Reddust Camp',      c: [424, -212], r: 24, region: 'canyon',    style: 'mining',    flat: true },
    { id: 't_star',  name: '별지기 야영지',    en: 'Starkeepers\' Camp', c: [-318, -216], r: 24, region: 'plateau',  style: 'dig',       flat: true },
    { id: 't_fort',  name: '가시 파수대',      en: 'Thornwatch',        c: [8, -206],   r: 26, region: 'blight',    style: 'fort',      flat: true },
    { id: 't_frost', name: '서리 수도원',      en: 'Frostvigil Abbey',  c: [52, -556],  r: 24, region: 'frost',     style: 'monastery', flat: true },
  ],

  // ── 랜드마크 (이름 붙은 장소) ──────────────────────────────────
  // type = agora-landmarks.js 의 빌더 키. r = 발견 반경. raid = 레이드 입구 id.
  landmarks: [
    { id: 'village',     name: '새싹 마을',          en: 'Sprout Village',     type: 'village',       c: [0, 560],     r: 60, region: 'village',   desc: '모험가의 첫 마을. 촌장, 대장장이, 약초상, 레이드 대장이 있다.' },
    { id: 'runegate',    name: '룬의 관문',          en: 'Rune Gate',          type: 'runegate',      c: [0, 628],     r: 12, region: 'village',   desc: '룬의 광장으로 돌아가는 고대 관문.' },
    { id: 'windmill',    name: '바람개비 언덕',      en: 'Pinwheel Hill',      type: 'windmill_hill', c: [-150, 470],  r: 30, region: 'greenhill', desc: '거대한 풍차가 도는 언덕. 바람 상인 제피가 글라이더를 판다.' },
    { id: 'oldoak',      name: '늙은 떡갈나무',      en: 'The Old Oak',        type: 'giant_tree',    c: [140, 420],   r: 26, region: 'greenhill', desc: '천 년을 산 떡갈나무. 가지 위에 옛 오두막이 걸려 있다.' },
    { id: 'shepherd',    name: '양치기 오두막',      en: "Shepherd's Hut",     type: 'farm',          c: [90, 520],    r: 22, region: 'greenhill', desc: '울타리 안에 양 대신 슬라임이 자라는 수상한 목장.' },
    { id: 'slimepools',  name: '말랑 웅덩이',        en: 'Wobble Pools',       type: 'ponds',         c: [-60, 360],   r: 26, region: 'greenhill', desc: '슬라임이 태어나는 작은 웅덩이들.' },
    { id: 'honeyhill',   name: '벌꿀 언덕',          en: 'Honey Hill',         type: 'apiary',        c: [170, 320],   r: 24, region: 'greenhill', desc: '벌통이 줄지어 선 언덕. 꿀 냄새가 진동한다.' },
    { id: 'hawkcliff',   name: '매의 절벽',          en: 'Hawk Cliff',         type: 'overlook',      c: [-216, 402],  r: 20, region: 'greenhill', desc: '숲을 내려다보는 깎아지른 언덕. 글라이더로 뛰어내리기 좋다.' },
    { id: 'lamprock',    name: '등불 바위',          en: 'Lamp Rock',          type: 'lighthouse',    c: [-112, 72],   r: 20, region: 'lake',      desc: '호숫가 바위 위의 작은 등대. 밤이면 호수를 비춘다.' },
    { id: 'pavilion',    name: '호수의 정자',        en: 'Lake Pavilion',      type: 'island_ruin',   c: [20, 100],    r: 22, region: 'lake',      desc: '호수 한가운데 섬에 남은 정자. 헤엄쳐 가야 한다.' },
    { id: 'moonbridge',  name: '달빛 다리',          en: 'Moonlight Bridge',   type: 'bridge',        c: [-38, -52],   r: 18, region: 'lake',      desc: '은빛 개울을 건너는 하얀 돌다리.' },
    { id: 'reedbridge',  name: '갈대 다리',          en: 'Reed Bridge',        type: 'bridge',        c: [190, 152],   r: 16, region: 'lake',      desc: '갈대숲을 가로지르는 나무 다리.' },
    { id: 'stump',       name: '거인의 그루터기',    en: "Giant's Stump",      type: 'giant_stump',   c: [-420, 262],  r: 30, region: 'woods',     desc: '산만 한 나무가 잘려 나간 자리. 나이테 위로 올라갈 수 있다.' },
    { id: 'fairyring',   name: '요정의 버섯 고리',   en: 'Fairy Ring',         type: 'fairy_ring',    c: [-300, 400],  r: 22, region: 'woods',     desc: '빛나는 버섯이 원을 그린 곳. 밤이면 춤추는 빛이 보인다.' },
    { id: 'huntercamp',  name: '사냥꾼 야영지',      en: "Hunter's Camp",      type: 'camp',          c: [-260, 232],  r: 24, region: 'woods',     desc: '숲 입구의 야영지. 사냥꾼 로완이 의뢰를 준다.' },
    { id: 'spring',      name: '속삭이는 샘',        en: 'Whispering Spring',  type: 'spring',        c: [-482, 160],  r: 22, region: 'woods',     desc: '숲의 이름이 된 샘. 물소리가 말을 거는 것 같다.' },
    { id: 'roottunnel',  name: '고목 뿌리 터널',     en: 'Root Tunnel',        type: 'root_arch',     c: [-545, 362],  r: 22, region: 'woods',     desc: '거대한 뿌리가 만든 터널.' },
    { id: 'sunken',      name: '가라앉은 신전',      en: 'Sunken Temple',      type: 'sunken_temple', c: [442, 120],   r: 30, region: 'swamp',     desc: '늪에 반쯤 잠긴 신전. 늪의 왕 그롬이 깨어났다.', raid: 'grom' },
    { id: 'witchhut',    name: '마녀의 오두막',      en: "Witch's Hut",        type: 'witch_hut',     c: [300, 302],   r: 22, region: 'swamp',     desc: '닭다리처럼 생긴 기둥 위의 오두막.' },
    { id: 'boardwalk',   name: '썩은 판자길',        en: 'Rotten Boardwalk',   type: 'boardwalk',     c: [352, 188],   r: 22, region: 'swamp',     desc: '늪 위에 놓인 낡은 판자길.' },
    { id: 'whitemane',   name: '하얀 갈기 폭포',     en: 'White Mane Falls',   type: 'waterfall',     c: [-60, -166],  r: 26, region: 'lake',      desc: '그림자 낭떠러지를 흘러내리는 하얀 폭포.' },
    { id: 'weeping',     name: '울음바위 절벽',      en: 'Weeping Cliffs',     type: 'seep_cliff',    c: [328, -178],  r: 30, region: 'canyon',    desc: '바위 틈에서 물이 눈물처럼 흐르는 절벽.' },
    { id: 'eagle',       name: '독수리 둥지 바위',   en: "Eagle's Perch",      type: 'spire_nest',    c: [532, -332],  r: 26, region: 'canyon',    desc: '협곡에서 가장 높은 바위. 바람 승강 룬을 타면 꼭대기 둥지에 오른다.' },
    { id: 'mine',        name: '버려진 광산',        en: 'Abandoned Mine',     type: 'mine',          c: [470, -180],  r: 26, region: 'canyon',    desc: '바위 거인 그라녹이 잠든 광산.', raid: 'granok' },
    { id: 'remains',     name: '거인의 유해',        en: "Giant's Remains",    type: 'skeleton',      c: [436, -410],  r: 30, region: 'canyon',    desc: '협곡 바닥에 누운 거인의 뼈. 갈비뼈가 아치를 이룬다.' },
    { id: 'redtable',    name: '붉은 탁자 바위',     en: 'Red Table Mesa',     type: 'mesa_mark',     c: [360, -320],  r: 52, region: 'canyon',    desc: '협곡의 상징인 평평한 바위산.' },
    { id: 'twins',       name: '쌍둥이 바위',        en: 'Twin Rocks',         type: 'mesa_mark',     c: [492, -125],  r: 22, region: 'canyon',    desc: '서로 기대선 두 개의 바위 기둥.' },
    { id: 'titanstairs', name: '거인의 계단',        en: 'Titan Stairs',       type: 'stairs',        c: [-238, -172], r: 26, region: 'plateau',   desc: '거인이 쌓았다는 돌계단. 고원으로 오르는 유일한 길.' },
    { id: 'citadel',     name: '잊힌 왕의 성채',     en: 'Forgotten Citadel',  type: 'citadel_ruin',  c: [-445, -312], r: 40, region: 'plateau',   desc: '무너진 성벽과 탑. 왕좌만이 그대로 남았다.' },
    { id: 'colossus',    name: '부서진 거상',        en: 'Broken Colossus',    type: 'colossus',      c: [-300, -382], r: 30, region: 'plateau',   desc: '하늘을 가리키던 거상. 팔 하나가 땅에 박혀 있다.' },
    { id: 'observatory', name: '별의 관측소',        en: 'Star Observatory',   type: 'tower',         c: [-540, -192], r: 24, region: 'plateau',   desc: '고원 서쪽 끝의 탑. 학자 엘린이 별을 본다.' },
    { id: 'blightgate',  name: '침식의 문',          en: 'Blight Gate',        type: 'thorn_gate',    c: [0, -236],    r: 22, region: 'blight',    desc: '검은 가시에 먹혀 버린 옛 관문.' },
    { id: 'thornheart',  name: '가시 심장',          en: 'Thorn Heart',        type: 'thorn_heart',   c: [0, -392],    r: 34, region: 'blight',    desc: '침식의 근원. 가시 군주가 깨어나는 곳.' },
    { id: 'icepass',     name: '얼음 고개',          en: 'Frost Pass',         type: 'pass_shrine',   c: [0, -518],    r: 24, region: 'frost',     desc: '용의 등뼈 능선을 넘는 유일한 고개.' },
    { id: 'altar',       name: '얼어붙은 제단',      en: 'Frozen Altar',       type: 'frozen_altar',  c: [64, -636],   r: 28, region: 'frost',     desc: '서리 거룡 크라이오스를 봉인한 제단.', raid: 'cryos' },
    { id: 'summit',      name: '하늘 끝 봉우리',     en: 'Skyreach Summit',    type: 'summit',        c: [-200, -662], r: 22, region: 'frost',     desc: '대륙에서 가장 높은 곳. 아르카디아 전체가 내려다보인다.' },
    { id: 'spine',       name: '용의 등뼈 능선',     en: "Dragon's Spine",     type: 'ridge_mark',    c: [200, -500],  r: 40, region: 'frost',     desc: '용의 등뼈처럼 날카로운 능선.' },
  ],

  // ── 사냥터 (몬스터 무리) ─────────────────────────────────────
  // mobs: [몬스터 키, 수]. lv: [최소, 최대]. 새 몬스터 키(wolf · frostgolem · yeti · wraith)는 agora-life.js 가 등록해요.
  camps: [
    { id: 'c_slime',    name: '말랑 웅덩이',       region: 'greenhill', c: [-60, 360],   r: 28, lv: [1, 3],   mobs: [['slime', 8]] },
    { id: 'c_sprout',   name: '새싹 밭',           region: 'greenhill', c: [62, 470],    r: 22, lv: [2, 4],   mobs: [['sprout', 5], ['slime', 3]] },
    { id: 'c_bee',      name: '벌꿀 언덕',         region: 'greenhill', c: [170, 320],   r: 26, lv: [3, 5],   mobs: [['bee', 6]] },
    { id: 'c_ladybug',  name: '무당벌레 풀숲',     region: 'greenhill', c: [-120, 300],  r: 24, lv: [4, 6],   mobs: [['ladybug', 6]] },
    { id: 'c_petal',    name: '꽃잎 들판',         region: 'greenhill', c: [100, 262],   r: 22, lv: [5, 6],   mobs: [['flower', 4], ['bee', 3]] },
    { id: 'c_shroom',   name: '버섯 숲',           region: 'woods',     c: [-300, 380],  r: 30, lv: [5, 7],   mobs: [['shroom', 7]] },
    { id: 'c_squirrel', name: '다람쥐 참나무 숲',  region: 'woods',     c: [-432, 332],  r: 28, lv: [6, 8],   mobs: [['squirrel', 6], ['sprout', 2]] },
    { id: 'c_boar',     name: '멧돼지 사냥터',     region: 'woods',     c: [-480, 222],  r: 30, lv: [8, 10],  mobs: [['boar', 6]] },
    { id: 'c_raccoon',  name: '너구리 소굴',       region: 'woods',     c: [-362, 182],  r: 22, lv: [9, 11],  mobs: [['raccoon', 5]] },
    { id: 'c_frog',     name: '개구리 갈대밭',     region: 'lake',      c: [-132, 122],  r: 24, lv: [7, 9],   mobs: [['frog', 7]] },
    { id: 'c_snail',    name: '달팽이 물가',       region: 'lake',      c: [132, 62],    r: 24, lv: [9, 11],  mobs: [['snail', 5], ['ladybug', 3]] },
    { id: 'c_shore',    name: '호숫가 꽃밭',       region: 'lake',      c: [62, -22],    r: 22, lv: [10, 12], mobs: [['flower', 4], ['frog', 3]] },
    { id: 'c_toad',     name: '늪 두꺼비 웅덩이',  region: 'swamp',     c: [382, 252],   r: 30, lv: [11, 13], mobs: [['frog', 6]] },
    { id: 'c_mole',     name: '두더지 둔덕',       region: 'swamp',     c: [472, 192],   r: 26, lv: [12, 14], mobs: [['mole', 6]] },
    { id: 'c_mossgolem',name: '이끼 골렘 습지',    region: 'swamp',     c: [420, 80],    r: 28, lv: [13, 15], mobs: [['golem', 3], ['snail', 3]] },
    { id: 'c_owl',      name: '부엉이 고목지',     region: 'swamp',     c: [300, 140],   r: 24, lv: [14, 16], mobs: [['owl', 5]] },
    { id: 'c_redboar',  name: '붉은 멧돼지 협곡',  region: 'canyon',    c: [372, -192],  r: 30, lv: [16, 18], mobs: [['boar', 6]] },
    { id: 'c_hedgehog', name: '고슴도치 바위길',   region: 'canyon',    c: [470, -262],  r: 26, lv: [17, 19], mobs: [['hedgehog', 6]] },
    { id: 'c_bandit',   name: '너구리 도적단',     region: 'canyon',    c: [420, -362],  r: 26, lv: [18, 20], mobs: [['raccoon', 6]] },
    { id: 'c_minegate', name: '광산 입구',         region: 'canyon',    c: [458, -150],  r: 22, lv: [19, 21], mobs: [['mole', 4], ['golem', 2]] },
    { id: 'c_ancient',  name: '고대 골렘 회랑',    region: 'plateau',   c: [-430, -262], r: 32, lv: [20, 22], mobs: [['golem', 5]] },
    { id: 'c_garden',   name: '성채 정원',         region: 'plateau',   c: [-472, -334], r: 26, lv: [21, 23], mobs: [['sprout', 4], ['flower', 4]] },
    { id: 'c_starowl',  name: '관측소 부엉이 둥지',region: 'plateau',   c: [-520, -206], r: 26, lv: [22, 24], mobs: [['owl', 6]] },
    { id: 'c_colossus', name: '거상의 그늘',       region: 'plateau',   c: [-312, -362], r: 28, lv: [23, 25], mobs: [['hedgehog', 4], ['golem', 2]] },
    { id: 'c_thorn',    name: '검은 가시 들판',    region: 'blight',    c: [-62, -322],  r: 34, lv: [24, 27], mobs: [['wraith', 5], ['boar', 3], ['shroom', 3]], elite: 0.3 },
    { id: 'c_vine',     name: '가시 덩굴 숲',      region: 'blight',    c: [72, -362],   r: 30, lv: [26, 28], mobs: [['wraith', 4], ['golem', 2], ['owl', 2]], elite: 0.35 },
    { id: 'c_wolf',     name: '얼음 늑대 골짜기',  region: 'frost',     c: [-70, -606],  r: 30, lv: [26, 28], mobs: [['wolf', 6]] },
    { id: 'c_frostgolem',name:'서리 골렘 빙원',    region: 'frost',     c: [150, -604],  r: 30, lv: [27, 30], mobs: [['frostgolem', 4]] },
    { id: 'c_yeti',     name: '설인 동굴',         region: 'frost',     c: [-310, -596], r: 24, lv: [28, 30], mobs: [['yeti', 3], ['wolf', 2]] },
  ],

  // ── 필드 보스 (돌아가며 출현) ───────────────────────────────────
  fieldBosses: [
    { id: 'fb_slime',  key: 'kingSlime', name: '말랑대왕',     title: '거대 왕슬라임', lv: 6,  c: [-60, 360],  region: 'greenhill' },
    { id: 'fb_chief',  key: 'chief',     name: '버섯대공',     title: '포자왕',       lv: 11, c: [-300, 380], region: 'woods' },
    { id: 'fb_queen',  key: 'queen',     name: '꿀단지 여제',  title: '여왕벌',       lv: 15, c: [372, 196],  region: 'swamp' },
    { id: 'fb_tusk',   key: 'tusk',      name: '붉은 엄니',    title: '엄니왕',       lv: 20, c: [412, -262], region: 'canyon' },
    { id: 'fb_treant', key: 'treant',    name: '가시 군주',    title: '검은 가시 트렌트', lv: 28, c: [0, -392], region: 'blight' },
  ],

  // ── 레이드 (전용 인스턴스) ─────────────────────────────────────
  raids: [
    { id: 'grom',   name: '늪의 왕 그롬',       en: 'Grom the Mire King',    lv: 12, rec: 12, entrance: 'sunken', party: 3, desc: '가라앉은 신전 깊은 곳, 독 웅덩이를 뿌리는 거대 두꺼비 왕.' },
    { id: 'granok', name: '바위 거인 그라녹',   en: 'Granok the Stoneborn',  lv: 18, rec: 18, entrance: 'mine',   party: 3, desc: '광산 바닥에서 깨어난 바위 거인. 천장이 무너진다!' },
    { id: 'cryos',  name: '서리 거룡 크라이오스', en: 'Cryos the Frost Wyrm', lv: 26, rec: 26, entrance: 'altar',  party: 4, desc: '제단에 봉인된 서리의 용. 하늘에서 얼음 숨결을 내뿜는다.' },
  ],

  // ── NPC ──────────────────────────────────────────────────────
  // role: 대화를 맡는 모듈 — quest_main · quest (agora-rpg) / smith · shop · inn · board (agora-rpg) / raid (agora-raid) / fish (agora-minigames) / glider (agora-world) / wardrobe (스토리 의상실)
  npcs: [
    { id: 'chief',    name: '촌장 하몬',       title: '새싹 마을 촌장',   role: 'quest_main', c: [-8, 546],    face: 0,          look: { hat: 'straw', body: 'marble' } },
    { id: 'smith',    name: '대장장이 도른',   title: '장비 강화',        role: 'smith',      c: [34, 574],    face: -1.2,       look: { body: 'obsidian' }, job: 'sword' },
    { id: 'herbalist',name: '약초상 미라',     title: '물약 · 잡화',      role: 'shop',       c: [-32, 574],   face: 1.2,        look: { hat: 'wizard', body: 'sakura' } },
    { id: 'raidmaster',name:'레이드 대장 카엘', title: '레이드 모집',     role: 'raid',       c: [42, 544],    face: -0.6,       look: { hat: 'viking', back: 'cape', body: 'silver' }, job: 'sword' },
    { id: 'tailor',   name: '재봉사 루나',     title: '의상실',           role: 'wardrobe',   c: [-42, 544],   face: 0.6,        look: { hat: 'cat', back: 'royal' } },
    { id: 'innkeeper',name: '여관 주인 베티',  title: '휴식 (체력 회복)', role: 'inn',        c: [-18, 594],   face: 0.2,        look: { body: 'sakura' } },
    { id: 'board',    name: '의뢰 게시판',     title: '일일 의뢰',        role: 'board',      c: [12, 554],    object: true },
    { id: 'fisher',   name: '낚시꾼 노아',     title: '낚시 · 물고기 매입', role: 'fish',     c: [28, 232],    face: -2.6,       look: { hat: 'straw' } },
    { id: 'zephy',    name: '바람 상인 제피',  title: '글라이더',         role: 'glider',     c: [-138, 480],  face: 2.4,        look: { hat: 'wizard', back: 'butterfly' } },
    { id: 'rowan',    name: '사냥꾼 로완',     title: '숲의 의뢰',        role: 'quest',      c: [-262, 238],  face: 0.8,        look: { back: 'cape' }, job: 'archer' },
    { id: 'morgana',  name: '늪지 마녀 모르가나', title: '늪의 의뢰',     role: 'quest',      c: [300, 292],   face: -0.6,       look: { hat: 'wizard', body: 'shadow' }, job: 'mage' },
    { id: 'brick',    name: '광부 브릭',       title: '협곡의 의뢰',      role: 'quest',      c: [454, -168],  face: 0.4,        look: { hat: 'viking' } },
    { id: 'elin',     name: '학자 엘린',       title: '고원의 의뢰',      role: 'quest',      c: [-528, -184], face: 1.0,        look: { hat: 'wizard', back: 'royal' }, job: 'mage' },
    { id: 'eldra',    name: '룬 지기 엘드라',  title: '침식의 의뢰',      role: 'quest_main', c: [16, -244],   face: 3.0,        look: { hat: 'halo', back: 'royal' }, job: 'mage' },
    { id: 'hermit',   name: '은둔자 오크',     title: '서리의 의뢰',      role: 'quest',      c: [22, -492],   face: 3.1,        look: { hat: 'viking', back: 'shadowcloak' } },
  ],

  // ── 낚시터 ───────────────────────────────────────────────────
  fishing: [
    { id: 'f_pond',    name: '마을 연못',       c: [22, 596],    region: 'village' },
    { id: 'f_south',   name: '은빛 호수 남쪽',  c: [26, 226],    region: 'lake' },
    { id: 'f_west',    name: '갈대 물가',       c: [-120, 140],  region: 'lake' },
    { id: 'f_pavilion',name: '호수의 정자',     c: [22, 84],     region: 'lake' },
    { id: 'f_mane',    name: '은빛 개울',       c: [-44, -76],   region: 'lake' },
    { id: 'f_reed',    name: '갈대 개울',       c: [214, 160],   region: 'lake' },
    { id: 'f_swamp',   name: '늪 웅덩이',       c: [358, 206],   region: 'swamp' },
    { id: 'f_spring',  name: '속삭이는 샘',     c: [-470, 172],  region: 'woods' },
    { id: 'f_weep',    name: '울음바위 웅덩이', c: [326, -206],  region: 'canyon' },
    { id: 'f_ice',     name: '얼음 호수',       c: [24, -596],   region: 'frost' },
  ],

  // ── 채집 (agora-rpg.js 가 지역 안에 흩뿌려요) ─────────────────────
  gather: [
    { kind: 'herb',    region: 'greenhill', n: 22 }, { kind: 'herb', region: 'woods', n: 26 }, { kind: 'herb', region: 'lake', n: 14 },
    { kind: 'mushroom',region: 'woods',     n: 16 }, { kind: 'mushroom', region: 'swamp', n: 18 },
    { kind: 'ore',     region: 'canyon',    n: 22 }, { kind: 'ore', region: 'plateau', n: 18 }, { kind: 'ore', region: 'frost', n: 14 },
    { kind: 'crystal', region: 'blight',    n: 14 }, { kind: 'crystal', region: 'frost', n: 10 },
  ],
  chests: 46,      // 보물 상자 수 (지역별 난이도에 맞춰 흩어요)
  seeds: 36,       // 숨은 「룬 정령」 수집품 수 (젤다의 코로그 같은 것)
};

// 편의: id → 항목
export const byId = (list, id) => WORLD[list].find(o => o.id === id);
