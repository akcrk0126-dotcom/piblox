// =====================================================================
//  미션 · 부업(택시 · 자경단 · 레이스) · 스턴트 점프 · 숨겨진 상자 · 상점 · 저장 · 치트
// =====================================================================
'use strict';
(function(){
const U = G.U, W = G.world, UI = ()=>G.ui;
const M = G.missions = { cur:null, side:null };
const PL = ()=>G.player;
const spec = t=>W.specials.find(s=>s.type === t);

// ---------------------------------------------------------------------
//  표시 (바닥 원기둥 · 회전 상자)
// ---------------------------------------------------------------------
const markGeo = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
function markMat(col){ return new THREE.ShaderMaterial({ transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, uniforms:{ c:{ value:new THREE.Color(col) }, t:{ value:0 } },
  vertexShader:'varying float vY; void main(){ vY = position.y + .5; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.); }', fragmentShader:'uniform vec3 c; uniform float t; varying float vY; void main(){ float a = (1. - vY)*(1. - vY)*(.45 + .15*sin(t*4.)); gl_FragColor = vec4(c, a*.45); }' }); }
const MARKS = [];
M.marker = (x, z, r, col, h)=>{ const m = new THREE.Mesh(markGeo, markMat(col || 0xf5c518)); m.scale.set(r || 1.5, h || 1.6, r || 1.5); m.position.set(x, W.groundY(x, z) + (h || 1.6)/2, z); G.scene.add(m); MARKS.push(m); return m; };
M.unmark = m=>{ if (!m) return; G.scene.remove(m); const i = MARKS.indexOf(m); if (i >= 0) MARKS.splice(i, 1); };
// 미션 시작 표시 (항상 보이는 것)
let startMark = null;

// ---------------------------------------------------------------------
//  스토리 미션
// ---------------------------------------------------------------------
// 각 미션 = 단계 목록. 단계는 { enter(m), update(m, dt) → true 면 다음 단계 }
const near = (x, z, r)=>{ const P = PL(); const px = P.inCar ? P.car.x : P.x, pz = P.inCar ? P.car.z : P.z; return Math.hypot(px - x, pz - z) < r; };
const say = (who, text, sec)=>UI().sub('<b>' + who + ':</b> ' + text, sec || 5);
const goal = (x, z, label, col)=>{ UI().blips = UI().blips.filter(b=>!b.goal); const b = { x, z, col:col || '#f5c518', label:label || '', route:true, goal:true }; UI().blips.push(b); b._route = []; return b; };
function routeTick(dt){ for (const b of UI().blips){ if (!b.route) continue; b._rt = (b._rt || 0) - dt; if (b._rt <= 0){ b._rt = 1; const P = PL(); b._route = G.wanted.route(P.inCar ? P.car.x : P.x, P.inCar ? P.car.z : P.z, b.x, b.z); } } }
function clearGoals(){ UI().blips = UI().blips.filter(b=>!b.goal); }
function nodeNear(x, z, k){ let b = null, bd = 1e12; for (const n of W.nodes){ const d = (n.x - x)**2 + (n.z - z)**2 + (k ? Math.random()*k : 0); if (d < bd){ bd = d; b = n; } } return b; }
function curbSpot(x, z){ const n = nodeNear(x, z); const nb = W.nodeAt[n.nb[0].join(',')]; const dx = Math.sign(nb.x - n.x), dz = Math.sign(nb.z - n.z); return { x:n.x + dx*30 + (-dz)*5.25, z:n.z + dz*30 + dx*5.25, h:Math.atan2(dx, dz) }; }
M.curbSpot = curbSpot;

const LIST = M.LIST = [
  { title:'산 루나에 온 걸 환영해', desc:'삼촌 레니의 차를 몰고 튜닝샵으로 가자. (운전 연습)', start:()=>spec('safe'), reward:500,
    steps:[
      { enter(m){ const s = spec('safe'); const c = curbSpot(s.x, s.z + 20); m.car = G.veh.spawn('sedan', c.x, c.z, c.h, 0x6a1a1a); m.car.mission = true; m.car.keep = true; goal(m.car.x, m.car.z, '', '#3aa0ff'); say('레니', '드디어 왔구나! 저기 빨간 세단 보이지? 타라. ' + (G.TOUCH ? '[타기]' : '<em>F</em>') + ' 누르면 돼.', 7); UI().obj('차에 타기', '파란 표시의 세단'); },
        update(m){ return PL().inCar && PL().car === m.car; } },
      { enter(m){ const s = spec('modshop'); goal(s.x, s.z); m.mk = M.marker(s.x, s.z, 3); say('레니', '좋아! 내 가게까지 몰고 와. 노란 길을 따라오면 돼. ' + (G.TOUCH ? '' : '<em>W/S</em> 가속·브레이크, <em>Space</em> 핸드브레이크.'), 7); UI().obj('튜닝샵으로 가기', '미니맵의 노란 길을 따라가세요'); },
        update(m){ const s = spec('modshop'); if (!PL().inCar){ UI().obj('차로 돌아가기'); return false; } UI().obj('튜닝샵으로 가기'); return near(s.x, s.z, 5) && PL().car.speed < 3; } },
      { enter(m){ M.unmark(m.mk); say('레니', '운전 실력 괜찮네! 이 차는 네가 가져. 이 도시에서 살아남으려면 돈이 필요할 거야. 연락할게.', 6); }, update(m){ return true; } } ] },
  { title:'택배 아르바이트', desc:'밴을 몰고 3:30 안에 상자 3개를 배달하자.', start:()=>spec('modshop'), reward:1500,
    steps:[
      { enter(m){ const s = spec('modshop'); const c = curbSpot(s.x, s.z); m.car = G.veh.spawn('van', c.x, c.z, c.h, 0xf0f0f0); m.car.mission = true; m.car.keep = true; goal(m.car.x, m.car.z, '', '#3aa0ff'); say('레니', '밴에 상자 3개 실어놨어. 시간 안에 돌려. 늦으면 손님들이 화낸다.', 6); UI().obj('밴에 타기'); },
        update(m){ return PL().inCar && PL().car === m.car; } },
      { enter(m){ m.drops = []; const P = PL(); const rng = U.seeded(77); while (m.drops.length < 3){ const n = W.nodes[Math.floor(rng()*W.nodes.length)]; const d = Math.hypot(n.x - P.car.x, n.z - P.car.z); if (d > 250 && d < 650 && Math.abs(n.x) < 680 && Math.abs(n.z) < 680) m.drops.push(curbSpot(n.x, n.z)); } m.time = 210; m.i = 0; next(m); function next(m){ const d = m.drops[m.i]; goal(d.x, d.z, String(m.i + 1)); M.unmark(m.mk); m.mk = M.marker(d.x, d.z, 2.5); } m.next = next; },
        update(m, dt){ m.time -= dt; UI().timer(m.time); if (m.time <= 0) return M.fail('시간 초과'); if (!PL().inCar || PL().car !== m.car){ UI().obj('밴으로 돌아가기'); if (m.car.dead) return M.fail('밴이 부서졌어요'); return false; }
          UI().obj('배달 ' + (m.i + 1) + ' / 3'); const d = m.drops[m.i]; if (near(d.x, d.z, 4) && m.car.speed < 2){ G.audio.sfx('checkpoint'); G.save.money += 150; m.i++; if (m.i >= 3){ UI().timer(null); M.unmark(m.mk); return true; } m.next(m); } return false; } } ] },
  { title:'빚 받기', desc:'레니에게 돈을 빌리고 도망친 토니를 찾아 혼내 주자.', start:()=>spec('diner'), reward:2000,
    steps:[
      { enter(m){ const s = spec('diner'); m.ped = new G.peds.Ped(Object.assign(G.human.randomLook(U.seeded(5), { sex:'Male' }), { top:'tank', shirt:0xffffff, pants:0x3a3a3a }), s.x + 3, s.z + 6, 'civ'); m.ped.mission = true; m.ped.keep = true; m.ped.state = 'idle'; m.ped.idleT = 999; m.ped.idleAnim = 'talk'; m.ped.brave = false;
          goal(m.ped.x, m.ped.z, '', '#e2342f'); say('레니', '토니가 식당 앞에 있대. 가서 돈 받아와. 말로 안 되면… 알지?', 6); UI().obj('토니 찾기'); },
        update(m){ goal(m.ped.x, m.ped.z, '', '#e2342f'); if (near(m.ped.x, m.ped.z, 9)){ say('토니', '헉, 레니가 보냈냐?! 못 줘!', 3); m.ped.scare(PL().x, PL().z, 1); m.ped.fear = 60; return true; } return false; } },
      { enter(m){ UI().obj('토니를 잡아서 혼내기', '주먹으로 때리면 돼요'); m.hits = 0; m.onHurt = (p, by)=>{ if (p === m.ped && by === PL()){ m.hits++; if (p.hp < 60 && p.alive){ p.hp = 999; p.state = 'idle'; p.idleT = 999; p.idleAnim = 'idle'; m.give = true; } } }; G.on('pedHurt', m.onHurt); },
        update(m){ const p = m.ped; goal(p.x, p.z, '', '#e2342f'); if (!p.alive) return M.fail('토니가 죽었어요'); if (Math.hypot(p.x - PL().x, p.z - PL().z) > 180) return M.fail('토니를 놓쳤어요'); if (m.give){ say('토니', '알았어 알았어! 여기 돈! 때리지 마!', 4); p.fear = 20; p.state = 'flee'; p.hp = 60; p.mission = false; p.keep = false; return true; } return false; } } ] },
  { title:'부두의 녀석들', desc:'항구 창고에 숨어든 그린 갱 6명을 처리하자. 총포상에서 권총부터!', start:()=>spec('gunshop'), reward:3500,
    steps:[
      { enter(m){ if (!PL().has('pistol')) PL().give('pistol', 48); else G.save.ammo.pistol = (G.save.ammo.pistol || 0) + 48; PL().select('pistol'); say('레니', '권총 하나 챙겨놨어. ' + (G.TOUCH ? '[조준] 켜고 [공격]' : '<em>오른쪽 클릭</em>으로 조준, <em>왼쪽 클릭</em>으로 쏴') + '. 부두로 가.', 7);
          m.zone = { x:W.X(12) + 50, z:W.X(5) + 50 }; goal(m.zone.x, m.zone.z, '', '#e2342f'); UI().obj('항구 창고로 가기'); },
        update(m){ return near(m.zone.x, m.zone.z, 60); } },
      { enter(m){ m.enemies = []; const rng = U.seeded(99); for (let i = 0; i < 6; i++){ const x = m.zone.x + (rng() - .5)*50, z = m.zone.z + (rng() - .5)*50; const pos = W.pushCircle(x, z, .5, .3) ? { x:m.zone.x + (rng() - .5)*20, z:W.X(5) + W.RW + 2 + rng()*3 } : { x, z };
          const p = new G.peds.Ped(G.human.gangLook(rng, 'g'), pos.x, pos.z, 'gang'); G.peds.arm(p, i < 2 ? 'smg' : 'pistol'); p.hostile = true; p.threat = PL(); p.state = 'shoot'; p.mission = true; p.keep = true; m.enemies.push(p); }
          UI().blips = UI().blips.filter(b=>!b.goal); say('레니', '저놈들이야! 엄폐하면서 하나씩!', 4); },
        update(m){ const left = m.enemies.filter(p=>p.alive).length; UI().obj('그린 갱 처리', '남은 적 ' + left + '명'); UI().blips = UI().blips.filter(b=>!b.enemy); for (const p of m.enemies) if (p.alive) UI().blips.push({ x:p.x, z:p.z, col:'#e2342f', enemy:true }); if (left === 0){ UI().blips = UI().blips.filter(b=>!b.enemy); for (const p of m.enemies){ p.mission = false; p.keep = false; } return true; } return false; } } ] },
  { title:'스트리트 레이스', desc:'코멧 R 을 몰고 거리 레이스에서 1등 하자.', start:()=>({ x:W.X(9) - 5.25, z:W.X(9) + 30 }), reward:6000,
    steps:[
      { enter(m){ m.cps = raceTrack(); m.start = m.cps[0]; const P = PL(); if (P.inCar) P.exitCar(); const n0 = m.cps[0], n1 = m.cps[1]; const h = Math.atan2(n1.x - n0.x, n1.z - n0.z);
          m.car = G.veh.spawn('sports', n0.x, n0.z, h, 0xf2c200); m.car.mission = true; m.car.keep = true; m.rivals = []; const rx = Math.cos(h), rz = -Math.sin(h);
          for (let i = 0; i < 3; i++){ const off = (i + 1)*-7; const v = G.veh.spawn(U.pick(['sports', 'super', 'muscle']), n0.x + Math.sin(h)*off + rx*(i%2 ? 3.4 : 0), n0.z + Math.cos(h)*off + rz*(i%2 ? 3.4 : 0), h); v.mission = true; v.keep = true; v.driver = G.peds.spawnDriver(v); v.driver.mission = true; v.race = { i:1 }; m.rivals.push(v); }
          PL().enterCar(m.car); say('레니', '출발선이야. 체크포인트 ' + (m.cps.length - 1) + '개, 1등만 기억한다!', 4); m.cd = 3.5; UI().obj('준비…'); },
        update(m, dt){ m.cd -= dt; m.car.thr = 0; m.car.hb = true; for (const v of m.rivals){ v.thr = 0; v.hb = true; } if (m.cd > 0){ const n = Math.ceil(m.cd - .5); if (n !== m.lastN && n > 0){ m.lastN = n; UI().big(String(n), 'gold', '', .8); G.audio.sfx('star'); } return false; } UI().big('GO!', 'gold', '', 1); G.audio.sfx('checkpoint'); return true; } },
      { enter(m){ m.i = 1; m.t = 0; m.mk = M.marker(m.cps[1].x, m.cps[1].z, 6, 0xf5c518, 8); goal(m.cps[1].x, m.cps[1].z, '1'); },
        update(m, dt){ m.t += dt; const cps = m.cps; UI().timer(m.t);
          // 상대 AI: 체크포인트를 따라 달림
          for (const v of m.rivals){ if (v.dead || !v.driver || v.driver === 'player'){ continue; } const c = cps[Math.min(v.race.i, cps.length - 1)]; const want = Math.atan2(c.x - v.x, c.z - v.z); const err = U.angDiff(v.h, want); v.steer = U.clamp(err*2.6, -1, 1); v.thr = Math.abs(err) > 1 && v.speed > 14 ? -.3 : .92 + Math.random()*.08; v.hb = Math.abs(err) > 1.2 && v.speed > 12;
            if (Math.hypot(c.x - v.x, c.z - v.z) < 12) v.race.i++; if (v.race.i >= cps.length && !m.loser) m.loser = true; }
          if (!PL().inCar || PL().car !== m.car){ UI().obj('차로 돌아가기'); if (m.car.dead) return M.fail('차가 부서졌어요'); return false; }
          const place = 1 + m.rivals.filter(v=>v.race.i > m.i || (v.race.i === m.i && Math.hypot(cps[m.i].x - v.x, cps[m.i].z - v.z) < Math.hypot(cps[m.i].x - m.car.x, cps[m.i].z - m.car.z))).length; UI().obj(place + '등', '체크포인트 ' + m.i + ' / ' + (cps.length - 1));
          const c = cps[m.i]; if (Math.hypot(c.x - m.car.x, c.z - m.car.z) < 12){ G.audio.sfx('checkpoint'); m.i++; M.unmark(m.mk); if (m.i >= cps.length){ UI().timer(null); if (m.loser) return M.fail('1등을 놓쳤어요'); for (const v of m.rivals){ v.mission = false; v.keep = false; if (v.driver && v.driver.mission) v.driver.mission = false; v.race = null; v.ai = null; G.veh.reattach(v); } m.car.mission = false; return true; } m.mk = M.marker(cps[m.i].x, cps[m.i].z, 6, 0xf5c518, 8); goal(cps[m.i].x, cps[m.i].z, String(m.i)); }
          return false; } } ] },
  { title:'경찰차 슬쩍하기', desc:'경찰서 앞의 경찰차를 훔쳐서 도색소에서 칠하자. 경찰이 쫓아온다!', start:()=>spec('police'), reward:5000,
    steps:[
      { enter(m){ const s = spec('police'); const c = curbSpot(s.x, s.z + 20); m.car = G.veh.spawn('police', c.x, c.z, c.h); m.car.mission = true; m.car.keep = true; goal(m.car.x, m.car.z, '', '#3aa0ff'); say('레니', '경찰서 앞에 세워둔 경찰차가 있어. 슬쩍해서 도색소로 가져와. 쫓아오면 따돌려!', 6); UI().obj('경찰차 훔치기'); },
        update(m){ if (PL().inCar && PL().car === m.car){ G.wanted.atLeast(2, '경찰차 탈취'); return true; } return false; } },
      { enter(m){ const s = spec('spray'); goal(s.x, s.z); m.mk = M.marker(s.x, s.z, 3, 0x3aa0ff); UI().obj('도색소로 가기', '경찰을 달고 가도 칠하면 지워져요'); },
        update(m){ if (m.car.dead) return M.fail('경찰차가 부서졌어요'); const s = spec('spray'); if (PL().inCar && PL().car === m.car && near(s.x, s.z, 6)){ M.unmark(m.mk); doRespray(m.car, true); m.car.mission = false; m.car.keep = false; return true; } return false; } } ] },
  { title:'루나 은행 털이', desc:'마지막 한탕. 은행을 털고 경찰 4별을 따돌려 집으로 돌아가자.', start:()=>spec('bank'), reward:50000,
    steps:[
      { enter(m){ if (!PL().has('smg')) PL().give('smg', 180); else G.save.ammo.smg += 180; G.save.armor = PL().armor = 100; say('레니', '기관단총이랑 방탄복 챙겼다. 은행 안으로 들어가서 금고가 열릴 때까지 버텨!', 6); const s = spec('bank'); m.zone = { x:s.x, z:s.z - 4 }; m.mk = M.marker(m.zone.x, m.zone.z, 3, 0x3ec46d); goal(m.zone.x, m.zone.z, '$', '#3ec46d'); UI().obj('은행 정문에 서기'); },
        update(m){ return near(m.zone.x, m.zone.z, 3.5) && !PL().inCar; } },
      { enter(m){ m.t = 25; G.wanted.atLeast(3, '은행 강도'); UI().obj('금고가 열릴 때까지 버티기', '표시 안에 있어야 해요'); say('레니', '경보 울렸다! 조금만 버텨!', 3); },
        update(m, dt){ if (near(m.zone.x, m.zone.z, 6)) m.t -= dt; UI().timer(m.t); if (m.t <= 0){ UI().timer(null); M.unmark(m.mk); G.save.money += 15000; G.audio.sfx('cash'); return true; } return false; } },
      { enter(m){ G.wanted.atLeast(4, '은행 강도'); const s = spec('safe'); goal(s.x, s.z, 'S', '#ffffff'); m.mk = M.marker(s.x, s.z, 3, 0xffffff); say('레니', '돈 챙겼으면 튀어! 집까지 가면 끝이야. 경찰부터 따돌리고!', 6); UI().obj('수배를 없애고 집으로', '별이 남아 있으면 집에 못 들어가요'); },
        update(m){ const s = spec('safe'); if (G.wanted.level > 0){ UI().obj('경찰 따돌리기', '수배 ' + G.wanted.level + '별'); return false; } UI().obj('집으로'); if (near(s.x, s.z, 4)){ M.unmark(m.mk); return true; } return false; } } ] },
];
// 레이스 코스: 도시를 한 바퀴
function raceTrack(){ const pts = [[9, 9], [9, 12], [5, 12], [5, 10], [3, 10], [3, 5], [7, 5], [7, 3], [11, 3], [11, 7], [9, 7], [9, 9]]; return pts.map(([i, j], k)=>{ const x = W.X(i), z = W.X(j); return k === 0 ? { x:x - 5.25, z:z + 30 } : { x, z }; }); }
M.raceTrack = raceTrack;

M.startStory = ()=>{ const i = G.save.missions; const m = LIST[i]; if (!m) return; M.cur = { def:m, i, step:0, data:{} }; UI().big(m.title, 'gold', '', 3); G.audio.sfx('star'); M.unmark(startMark); startMark = null; clearGoals(); enterStep(); };
function enterStep(){ const c = M.cur; const st = c.def.steps[c.step]; st.enter(c.data); }
M.fail = why=>{ const c = M.cur; if (!c) return false; cleanup(c); M.cur = null; UI().big('미션 실패', 'red', why || '', 4); G.audio.sfx('fail'); UI().obj(null); UI().timer(null); clearGoals(); return false; };
function cleanup(c){ const d = c.data; for (const k of ['mk']) M.unmark(d[k]); if (d.onHurt){ /* 이벤트는 그대로 두되 무시 */ d.onHurt = null; }
  for (const v of [d.car, ...(d.rivals || [])]) if (v && !v.removed){ v.mission = false; v.keep = false; } for (const p of [d.ped, ...(d.enemies || [])]) if (p && !p.removed){ p.mission = false; p.keep = false; } }
function passStory(){ const c = M.cur; cleanup(c); const m = c.def; G.save.missions = Math.max(G.save.missions, c.i + 1); G.save.money += m.reward; G.writeSave(); M.cur = null; clearGoals(); UI().obj(null); UI().timer(null);
  UI().big('미션 완료', 'gold', m.title + '<br><span style="color:#7ee08a">+' + U.fmtMoney(m.reward) + '</span>', 4.5); G.audio.sfx('mission');
  try { if (window.MP && MP.addXP) MP.addXP(25 + c.i*10); } catch(e){}
  if (G.save.missions >= LIST.length) setTimeout(()=>UI().big('스토리 완료!', 'gold', '산 루나의 전설이 됐어요. 자유롭게 도시를 즐기세요.', 6), 5000); }

// ---------------------------------------------------------------------
//  부업: 택시 · 자경단
// ---------------------------------------------------------------------
function sideStart(kind){ if (M.cur || M.side) return; M.side = { kind, n:0, t:0 }; if (kind === 'taxi') taxiNext(); if (kind === 'vig') vigNext(); UI().big(kind === 'taxi' ? '택시 운전' : '자경단', 'gold', '', 2.5); }
function sideEnd(msg){ const s = M.side; if (!s) return; M.unmark(s.mk); if (s.ped && !s.ped.removed){ if (s.ped.car) s.ped.exitCar(); s.ped.mission = false; s.ped.keep = false; } if (s.crim){ s.crim.mission = false; } M.side = null; clearGoals(); UI().obj(null); UI().timer(null); if (msg) UI().help(msg, 3); }
function taxiNext(){ const s = M.side; const P = PL(); for (let k = 0; k < 20; k++){ const a = Math.random()*6.28, d = 80 + Math.random()*160; const x = P.car.x + Math.cos(a)*d, z = P.car.z + Math.sin(a)*d; if (Math.abs(x) > 680 || Math.abs(z) > 680) continue; const c = curbSpot(x, z);
    const look = G.human.randomLook(); const p = new G.peds.Ped(look, c.x - Math.cos(c.h)*3.6, c.z + Math.sin(c.h)*3.6, "civ"); p.state = 'idle'; p.idleT = 999; p.idleAnim = 'fold'; p.mission = true; p.keep = true; s.ped = p; s.phase = 'pick'; s.mk = M.marker(c.x, c.z, 3, 0x3aa0ff); s.pick = c; goal(c.x, c.z, '', '#3aa0ff'); UI().obj('손님 태우기'); return; } }
function taxiUpdate(dt){ const s = M.side, P = PL(); if (!P.inCar || !P.car.t.taxi){ sideEnd('택시에서 내려서 부업이 끝났어요.'); return; }
  if (s.phase === 'pick'){ if (!s.ped.alive) { M.unmark(s.mk); taxiNext(); return; } if (near(s.pick.x, s.pick.z, 6) && P.car.speed < 2){ s.ped.enterCar(P.car, 'pass'); M.unmark(s.mk); const dests = W.specials.filter(q=>Math.hypot(q.x - P.car.x, q.z - P.car.z) > 250); const d = U.pick(dests.length ? dests : W.specials); s.dest = curbSpot(d.x, d.z); s.destName = d.label; s.mk = M.marker(s.dest.x, s.dest.z, 3); goal(s.dest.x, s.dest.z); s.phase = 'drop'; s.time = 25 + Math.hypot(s.dest.x - P.car.x, s.dest.z - P.car.z)/9; s.fare = 0; UI().sub('<b>손님:</b> ' + U.pick(['', '급해요! ', '천천히 가도 돼요. ']) + U.esc(s.destName) + '(으)로 가 주세요.', 4); } }
  else { s.time -= dt; UI().timer(Math.max(0, s.time)); UI().obj('목적지로', s.destName); if (s.time <= 0){ UI().help('너무 늦어서 손님이 내렸어요.', 3); s.ped.exitCar(); s.ped.mission = false; s.ped.keep = false; M.unmark(s.mk); taxiNext(); return; }
    if (near(s.dest.x, s.dest.z, 7) && P.car.speed < 2){ const fare = Math.round(40 + Math.hypot(s.dest.x - s.pick.x, s.dest.z - s.pick.z)*.35 + s.time*3); G.save.money += fare; G.save.stats.taxi++; s.n++; G.audio.sfx('cash'); UI().help('요금 ' + U.fmtMoney(fare) + (s.time > 15 ? ' (팁 포함)' : '') + ' · 연속 ' + s.n + '명', 3);
      s.ped.exitCar(); s.ped.state = 'walk'; s.ped.mission = false; s.ped.keep = false; M.unmark(s.mk); UI().timer(null); taxiNext(); } } }
function vigNext(){ const s = M.side, P = PL(); let v = null; for (const c of G.veh.list) if (c.ai && c.driver && c.driver !== 'player' && !c.t.police && Math.hypot(c.x - P.car.x, c.z - P.car.z) > 100 && Math.hypot(c.x - P.car.x, c.z - P.car.z) < 260){ v = c; break; }
  if (!v){ s.wait = 2; return; } s.crim = v; v.mission = true; v.ai.mode = 'flee'; v.ai.fleeT = -999; v.t = Object.assign({}, v.t, { top:v.t.top*1.15, acc:v.t.acc*1.2 }); v.criminal = true; UI().sub('<b>무전:</b> 수배 차량 발견! 정지시켜라.', 4); UI().obj('수배 차량 잡기', '차를 부수거나 운전자를 처리'); }
function vigUpdate(dt){ const s = M.side, P = PL(); if (!P.inCar || !P.car.t.police){ sideEnd('경찰차에서 내려서 자경단이 끝났어요.'); return; } if (s.wait > 0){ s.wait -= dt; if (s.wait <= 0) vigNext(); return; }
  const v = s.crim; if (!v || v.removed){ vigNext(); return; } goal(v.x, v.z, '', '#e2342f'); if (Math.hypot(v.x - P.car.x, v.z - P.car.z) > 450){ UI().help('범인을 놓쳤어요.', 3); v.mission = false; s.crim = null; vigNext(); return; }
  if (v.dead || !v.driver || (v.driver.alive === false)){ s.n++; const r = 300 + s.n*150; G.save.money += r; G.audio.sfx('cash'); UI().help('범인 제압! ' + U.fmtMoney(r) + ' · 레벨 ' + s.n, 3); v.mission = false; s.crim = null; s.wait = 3; }
  else if (v.speed < 1 && Math.hypot(v.x - P.car.x, v.z - P.car.z) < 8){ const d = v.driver; d.exitCar(); v.driver = null; d.hostile = true; d.threat = P; if (Math.random() < .5) G.peds.arm(d, 'pistol'); d.state = d.weapon ? 'shoot' : 'fight'; } }

// ---------------------------------------------------------------------
//  스턴트 점프 · 숨겨진 상자
// ---------------------------------------------------------------------
G.on('carLand', (v, airT)=>{ if (v.driver !== 'player' || !v.jumpRamp) return; const r = v.jumpRamp; v.jumpRamp = null; const dist = Math.hypot(v.x - r.sx, v.z - r.sz);
  if (airT > .9 && dist > 18){ const first = !G.save.jumps.includes(r.name); if (first){ G.save.jumps.push(r.name); G.save.stats.jumps++; } const pay = first ? 1000 : 200; G.save.money += pay; G.writeSave(); UI().big('멋진 점프!', 'gold', U.esc(r.name) + ' · ' + dist.toFixed(0) + 'm · ' + airT.toFixed(1) + '초<br><span style="color:#7ee08a">+' + U.fmtMoney(pay) + '</span>' + (first ? '<br>스턴트 점프 ' + G.save.jumps.length + ' / ' + W.ramps.length : ''), 3); G.audio.sfx('mission'); } });
function stuntCheck(){ const P = PL(); if (!P.inCar) return; const v = P.car; if (!v.air || v.jumpRamp || v.airT > .2) return; for (const r of W.ramps){ if (Math.hypot(v.x - r.x, v.z - r.z) < r.len + 8){ v.jumpRamp = { name:r.name, sx:v.x, sz:v.z }; G.slowmoT = .9; break; } } }
const PKG = M.PACKAGES = (()=>{ const rng = U.seeded(2024), out = []; while (out.length < 30){ const x = (rng() - .5)*1500, z = (rng() - .5)*1500; if (x > W.LAND - 5 || z > 780) continue; if (W.onRoad(x, z)) continue; if (W.pushCircle(x, z, .8, .3)) continue; out.push({ x, z, id:out.length }); } return out; })();
let pkgMesh = null;
function buildPackages(){ const geo = new THREE.BoxGeometry(.5, .5, .5); const mat = new THREE.MeshStandardMaterial({ color:0x2a8a3a, emissive:0x1aff5a, emissiveIntensity:.6, roughness:.4 }); pkgMesh = []; for (const p of PKG){ if (G.save.packages.includes(p.id)) continue; const m = new THREE.Mesh(geo, mat); m.position.set(p.x, W.groundY(p.x, p.z) + .7, p.z); m.userData.p = p; G.scene.add(m); pkgMesh.push(m); } }
function pkgUpdate(dt){ if (!pkgMesh) return; const P = PL(); for (let i = pkgMesh.length - 1; i >= 0; i--){ const m = pkgMesh[i]; m.rotation.y += dt*2; m.position.y = W.groundY(m.position.x, m.position.z) + .7 + Math.sin(performance.now()/400 + i)*.12;
  if (!P.inCar && Math.hypot(P.x - m.position.x, P.z - m.position.z) < 1.4){ G.save.packages.push(m.userData.p.id); G.scene.remove(m); pkgMesh.splice(i, 1); G.save.money += 1000; G.audio.sfx('pick'); G.writeSave(); UI().help('숨겨진 상자 ' + G.save.packages.length + ' / ' + PKG.length + ' · <b style="color:#7ee08a">+$1,000</b>', 3); if (G.save.packages.length === PKG.length){ for (const k of ['rifle', 'shotgun', 'sniper', 'rpg']) PL().give(k, 60); UI().big('상자 전부 찾음!', 'gold', '집에 무기 세트가 생겼어요', 5); } } } }

// ---------------------------------------------------------------------
//  상점 · 시설
// ---------------------------------------------------------------------
function gunShop(){ UI().shop('총포상 AMMU', L=>{ const P = PL(), S = G.save; let h = '<h4>무기</h4>';
  for (const k of G.weapons.ORDER){ const w = G.weapons.W[k]; if (!w.price) continue; const own = P.has(k) && k !== 'grenade'; h += '<button class="it' + (own ? ' own' : '') + '" data-k="' + k + '">' + UI().wsvg(k) + '<span><b>' + w.name + '</b><small>' + (w.mag ? '피해 ' + w.dmg*(w.pellets || 1) + ' · 탄창 ' + w.mag : w.thrown ? '3개 묶음' : '근접') + '</small></span><span class="pr' + (S.money < w.price && !own ? ' no' : '') + '">' + (own ? '보유' : U.fmtMoney(w.price)) + '</span></button>'; }
  h += '<h4>탄약</h4>'; for (const k of G.weapons.ORDER){ const w = G.weapons.W[k]; if (!w.ammoPrice || !P.has(k) || k === 'grenade') continue; h += '<button class="it" data-a="' + k + '">' + UI().wsvg(k) + '<span><b>' + w.name + ' 탄약</b><small>' + w.ammoPack + '발 · 지금 ' + (S.ammo[k] || 0) + '</small></span><span class="pr' + (S.money < w.ammoPrice ? ' no' : '') + '">' + U.fmtMoney(w.ammoPrice) + '</span></button>'; }
  h += '<h4>방어구</h4><button class="it" data-armor="1"><svg viewBox="0 0 64 32"><path d="M22 4h20l6 6v18H16V10z" fill="currentColor"/></svg><span><b>방탄복</b><small>방어 100 (지금 ' + Math.round(P.armor) + ')</small></span><span class="pr' + (S.money < 500 ? ' no' : '') + '">$500</span></button>';
  L.innerHTML = h;
  L.querySelectorAll('[data-k]').forEach(b=>b.onclick = ()=>{ const k = b.dataset.k, w = G.weapons.W[k]; if (P.has(k) && k !== 'grenade') { P.select(k); UI().close(); return; } UI().buy(w.price, ()=>{ P.give(k, k === 'grenade' ? 3 : w.mag*3); if (k === 'grenade') G.save.ammo.grenade = (G.save.ammo.grenade || 0); P.select(k); }); });
  L.querySelectorAll('[data-a]').forEach(b=>b.onclick = ()=>{ const k = b.dataset.a, w = G.weapons.W[k]; UI().buy(w.ammoPrice, ()=>{ S.ammo[k] = (S.ammo[k] || 0) + w.ammoPack; }); });
  L.querySelector('[data-armor]').onclick = ()=>UI().buy(500, ()=>{ P.armor = 100; G.save.armor = 100; }); }); }
const CL = { tops:[['tee', '티셔츠'], ['long', '긴팔'], ['tank', '민소매'], ['hoodie', '후드티'], ['jacket', '재킷'], ['suit', '정장'], ['vest', '조끼'], ['dress', '원피스']], legs:[['long', '긴바지'], ['shorts', '반바지'], ['skirt', '치마']], hats:[[null, '없음'], ['cap', '야구모자'], ['beanie', '비니']],
  cols:[0x111111, 0xf0f0f0, 0x8a96a4, 0x2a2e38, 0x1d2b44, 0x3a5aa0, 0x9ac0e0, 0x8a1c1c, 0xe2342f, 0xe07090, 0x5a2a6a, 0x2e5a3a, 0x3ec46d, 0xd06a20, 0xf2d24a, 0xc8a46a, 0x5a4a38],
  skins:[0xffffff, 0xf3d6c0, 0xe0b090, 0xc08a62, 0x8a5a3a, 0x5a3a26], hairs:{ Male:[['Hair_SimpleParted', '가르마'], ['Hair_Buzzed', '짧은 머리'], [null, '민머리']], Female:[['Hair_Long', '긴 머리'], ['Hair_Buns', '똥머리'], ['Hair_BuzzedFemale', '짧은 머리']] } };
function clothesShop(){ let paid = false; const S = G.save; const look = JSON.parse(JSON.stringify(S.look || PL().DEFAULT_LOOK)); const orig = JSON.stringify(look);
  const apply = ()=>{ G.save.look = look; PL().build(); PL().ch.play('idle'); PL().g.position.set(PL().x, PL().y, PL().z); };
  UI().shop('옷가게 LUNA WEAR', L=>{ const sw = (k, list)=>'<div class="sw">' + list.map(c=>'<button data-c="' + k + '" data-v="' + c + '" class="' + (look[k] === c ? 'on' : '') + '" style="background:#' + c.toString(16).padStart(6, '0') + '"></button>').join('') + '</div>';
    const ch = (k, list)=>'<div class="chips">' + list.map(([v, n])=>'<button data-s="' + k + '" data-v="' + v + '" class="' + (String(look[k]) === String(v) ? 'on' : '') + '">' + n + '</button>').join('') + '</div>';
    L.innerHTML = '<h4>성별</h4>' + ch('sex', [['Male', '남자'], ['Female', '여자']]) + '<h4>피부</h4>' + sw('skin', CL.skins) + '<h4>머리</h4>' + ch('hair', CL.hairs[look.sex]) + sw('hairCol', [0x1a120c, 0x4a2c18, 0x7a4a24, 0xc8a060, 0x9a9a9a, 0xe8e0d0, 0x6a1a10, 0x2a3a8a])
      + '<h4>상의</h4>' + ch('top', CL.tops) + sw('shirt', CL.cols) + '<h4>안쪽 · 포인트 색</h4>' + sw('shirt2', CL.cols) + '<h4>하의</h4>' + ch('legs', CL.legs) + sw('pants', CL.cols) + '<h4>신발</h4>' + sw('shoe', [0x111111, 0xeeeeee, 0x4a2e1a, 0x8a1a1a, 0x22344a, 0x777777])
      + '<h4>모자 · 안경</h4>' + ch('hat', CL.hats) + ch('glasses', [['false', '안경 없음'], ['true', '선글라스']]) + '<div style="display:flex;gap:8px;margin-top:16px"><button class="bigbtn" id="clBuy">이대로 사기 ($200)</button><button class="bigbtn ghost" id="clCancel">되돌리기</button></div>';
    L.querySelectorAll('[data-c]').forEach(b=>b.onclick = ()=>{ look[b.dataset.c] = +b.dataset.v; apply(); UI().refreshShop(); });
    L.querySelectorAll('[data-s]').forEach(b=>b.onclick = ()=>{ const k = b.dataset.s; let v = b.dataset.v; v = v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : v; look[k] = v; if (k === 'sex'){ look.hair = CL.hairs[v][0][0]; } if (k === 'top' && v === 'dress') look.legs = 'skirt'; apply(); UI().refreshShop(); });
    L.querySelector('#clBuy').onclick = ()=>{ if (JSON.stringify(look) === orig){ UI().close(); return; } if (!UI().buy(200, ()=>{})) return; paid = true; G.save.look = look; G.writeSave(); UI().close(); UI().help('새 옷이 잘 어울려요!', 2); };
    L.querySelector('#clCancel').onclick = ()=>{ Object.assign(look, JSON.parse(orig)); apply(); UI().refreshShop(); }; });
  // 창을 닫으면 사지 않은 옷은 되돌림
  const chk = setInterval(()=>{ if (UI().open !== 'shop'){ clearInterval(chk); if (!paid){ G.save.look = JSON.parse(orig); PL().build(); PL().g.position.set(PL().x, PL().y, PL().z); } } }, 200); }
function modShop(){ const P = PL(); if (!P.inCar){ UI().help('차를 타고 오면 튜닝할 수 있어요.', 3); return; } const v = P.car;
  UI().shop('튜닝샵', L=>{ const cols = [0x111111, 0xf0f0f0, 0x8a96a4, 0xc81e1e, 0xf2c200, 0x1d4ed8, 0x2a8a3a, 0xff7a1a, 0x7a2ac8, 0xd4af37, 0x23304a, 0xe07090];
    L.innerHTML = '<h4>도색 ($300)</h4><div class="sw">' + cols.map(c=>'<button data-col="' + c + '" style="background:#' + c.toString(16).padStart(6, '0') + '"></button>').join('') + '</div>'
      + '<h4>성능</h4>' + [['eng', '엔진 튜닝', '최고 속도 · 가속 +12%', 2500], ['arm', '차체 강화', '내구도 +50%', 2000], ['fix', '수리', '차를 새것처럼', 400]].map(([k, n, d, p])=>'<button class="it" data-m="' + k + '"><span><b>' + n + '</b><small>' + d + (v.mods && v.mods[k] ? ' · 적용됨' : '') + '</small></span><span class="pr' + (G.save.money < p ? ' no' : '') + '">' + U.fmtMoney(p) + '</span></button>').join('');
    L.querySelectorAll('[data-col]').forEach(b=>b.onclick = ()=>UI().buy(300, ()=>repaint(v, +b.dataset.col)));
    L.querySelectorAll('[data-m]').forEach(b=>b.onclick = ()=>{ const k = b.dataset.m; v.mods = v.mods || {}; if (k !== 'fix' && v.mods[k]) return; UI().buy(k === 'eng' ? 2500 : k === 'arm' ? 2000 : 400, ()=>{ if (k === 'eng'){ v.t = Object.assign({}, v.t, { top:v.t.top*1.12, acc:v.t.acc*1.12 }); v.mods.eng = 1; } if (k === 'arm'){ v.t = Object.assign({}, v.t, { hp:v.t.hp*1.5 }); v.hp = v.t.hp; v.mods.arm = 1; } if (k === 'fix') v.hp = v.t.hp; }); }); }); }
function repaint(v, col){ v.color = col; const m = new THREE.MeshPhysicalMaterial({ color:new THREE.Color(col).convertSRGBToLinear(), metalness:.55, roughness:.32, clearcoat:1, clearcoatRoughness:.06 }); for (const o of v.parts.body) o.material = m; }
function doRespray(v, force){ if (!v) return; if (G.wanted.level > 0 && !force && G.wanted.seen){ UI().help('경찰이 보고 있어서 칠할 수 없어요!', 3); return; } const cost = force ? 0 : 100; if (G.save.money < cost){ UI().help('돈이 부족해요 ($100).', 3); return; } G.save.money -= cost; repaint(v, U.pick([0x111111, 0xf0f0f0, 0xc81e1e, 0x1d4ed8, 0x2a8a3a, 0xf2c200, 0x8a96a4])); v.hp = v.t.hp; G.wanted.set(0); UI().big('새 차 같네!', 'gold', '수배가 지워졌어요', 2.5); G.audio.sfx('cash'); }
M.respray = doRespray;
function interact(s){ const P = PL();
  switch (s.type){
    case 'gunshop': gunShop(); break;
    case 'clothes': clothesShop(); break;
    case 'modshop': modShop(); break;
    case 'hospital': if (P.hp >= P.maxHp){ UI().help('이미 건강해요.', 2); break; } if (G.save.money < 100){ UI().help('치료비 $100 이 필요해요.', 2); break; } G.save.money -= 100; P.hp = P.maxHp; G.audio.sfx('cash'); UI().help('치료 완료 (-$100)', 2); break;
    case 'diner': if (G.save.money < 20){ UI().help('밥값 $20 이 필요해요.', 2); break; } G.save.money -= 20; P.hp = Math.min(P.maxHp, P.hp + 50); P.ch.play('consume', { restart:true }); G.audio.sfx('cash'); UI().help('맛있다! 체력 +50 (-$20)', 2); break;
    case 'gas': if (G.save.money < 8){ break; } G.save.money -= 8; P.hp = Math.min(P.maxHp, P.hp + 15); UI().help('간식을 먹었어요. 체력 +15 (-$8)', 2); break;
    case 'spray': if (!P.inCar){ UI().help('차를 타고 들어오세요.', 2); break; } doRespray(P.car); break;
    case 'safe': G.writeSave(); if (P.inCar && !P.car.dead){ G.save.garage = { type:P.car.type, color:P.car.color }; G.writeSave(); UI().help('저장했어요. 차도 차고에 넣었어요.', 3); } else { G.env.hour = (G.env.hour + 6)%24; P.hp = P.maxHp; UI().big('저장 완료', 'gold', '푹 잤어요. 시간이 6시간 흘렀어요.', 3); } G.audio.sfx('ui'); break;
    case 'police': UI().help('경찰서예요. 수배 중이면 가까이 가지 마세요!', 2); break;
    case 'bank': UI().help('루나 은행. 털 수 있을 것 같은데…', 2); break;
  } }

// ---------------------------------------------------------------------
//  치트 (키보드로 입력)
// ---------------------------------------------------------------------
const CHEATS = {
  HESOYAM:()=>{ PL().hp = PL().maxHp; PL().armor = 100; G.save.money += 250000; if (PL().inCar) PL().car.hp = PL().car.t.hp; return '체력 · 방어 · $250,000'; },
  LXGIWYL:()=>{ for (const k of ['bat', 'pistol', 'smg', 'shotgun', 'rifle', 'sniper', 'rpg', 'grenade']) PL().give(k, k === 'grenade' ? 10 : 300); return '무기 세트'; },
  BAGUVIX:()=>{ PL().god = !PL().god; return '무적 ' + (PL().god ? '켬' : '끔'); },
  ASNAEB:()=>{ G.wanted.set(0); return '수배 해제'; },
  OSRBLHH:()=>{ G.wanted.add(2); return '수배 +2'; },
  AEZAKMI:()=>{ PL().cheatNoWanted = !PL().cheatNoWanted; if (PL().cheatNoWanted) G.wanted.set(0); return '수배 안 됨 ' + (PL().cheatNoWanted ? '켬' : '끔'); },
  AIWPRTON:()=>{ spawnNear('super'); return '슈퍼카 소환'; },
  ROCKETMAN:()=>{ spawnNear('sports'); return '스포츠카 소환'; },
  CPKTNWT:()=>{ for (const v of G.veh.list) if (v.driver !== 'player' && Math.hypot(v.x - PL().x, v.z - PL().z) < 120) v.kill(); return '주변 차 폭파'; },
  AUIFRVQS:()=>{ G.env.setWeather('rain'); return '비'; }, AFZLLQLL:()=>{ G.env.setWeather('clear'); return '맑음'; }, SCOTTISHSUMMER:()=>{ G.env.setWeather('storm'); return '뇌우'; }, CFVFGMJ:()=>{ G.env.setWeather('fog'); return '안개'; },
  YSOHNUL:()=>{ G.env.timeScale = G.env.timeScale > .02 ? 1/60 : 1/6; return '시간 빨리 ' + (G.env.timeScale > .02 ? '켬' : '끔'); },
  FULLCLIP:()=>{ PL().infAmmo = !PL().infAmmo; return '무한 탄약 ' + (PL().infAmmo ? '켬' : '끔'); },
};
function spawnNear(type){ const P = PL(); const h = P.inCar ? P.car.h : P.h; const x = (P.inCar ? P.car.x : P.x) + Math.sin(h)*7, z = (P.inCar ? P.car.z : P.z) + Math.cos(h)*7; const v = G.veh.spawn(type, x, z, h); v.lastSpawned = true; }
function cheatCheck(){ const t = G.input.typed; for (const k in CHEATS){ if (t.endsWith(k)){ G.input.typed = ''; const msg = CHEATS[k](); G.save.cheats++; UI().feed('치트 적용: ' + msg); G.audio.sfx('star'); G.writeSave(); break; } } }

// ---------------------------------------------------------------------
//  죽음 · 체포
// ---------------------------------------------------------------------
G.on('wasted', ()=>{ G.save.stats.wasted++; if (M.cur) M.fail(''); if (M.side) sideEnd(); G.slowmo = .3; document.getElementById('grey').classList.add('on'); G.audio.sfx('wasted'); setTimeout(()=>UI().big('WASTED', 'red', '', 4.5), 900);
  setTimeout(()=>{ const s = spec('hospital'); const fee = Math.min(G.save.money, 100 + Math.floor(G.save.money*.05)); G.save.money -= fee; G.wanted.set(0); G.slowmo = 1; document.getElementById('grey').classList.remove('on'); PL().spawn(s.x, s.z + 2, 0); UI().help('병원비 ' + U.fmtMoney(fee) + ' 를 냈어요.', 4); G.writeSave(); }, 5200); });
G.on('busted', ()=>{ if (!PL().alive || M.busting) return; M.busting = true; G.save.stats.busted++; if (M.cur) M.fail(''); if (M.side) sideEnd(); G.slowmo = .3; document.getElementById('grey').classList.add('on'); G.audio.sfx('wasted'); UI().big('BUSTED', 'blue', '', 4.5);
  setTimeout(()=>{ const s = spec('police'); const fee = Math.min(G.save.money, 100 + Math.floor(G.save.money*.08)); G.save.money -= fee; G.wanted.set(0); G.slowmo = 1; document.getElementById('grey').classList.remove('on'); if (PL().inCar) PL().exitCar(true); for (const k of ['smg', 'shotgun', 'rifle', 'sniper', 'rpg', 'grenade']) delete G.save.weapons[k]; PL().select('fist'); PL().spawn(s.x, s.z + 2, 0); M.busting = false; UI().help('벌금 ' + U.fmtMoney(fee) + ' · 무기를 압수당했어요 (권총 · 방망이 제외).', 5); G.writeSave(); }, 5000); });
G.on('wantedUp', (lv, why)=>{ G.audio.sfx('star'); if (why) UI().feed('수배: ' + why); });
G.on('wantedClear', ()=>{ UI().help('경찰을 따돌렸어요!', 2.5); });
G.on('enterCar', v=>{ UI().pop(v.t.name, v.t.police ? '경찰차 · H: 사이렌, E: 자경단' : v.t.taxi ? '택시 · E: 택시 운전 시작' : ''); if (G.audio.radioStation() < 0 && !v.t.police) G.audio.setStation(Math.floor(Math.random()*G.audio.STATIONS.length)); else G.emit('radio', G.audio.radioStation()); });

// ---------------------------------------------------------------------
//  매 프레임
// ---------------------------------------------------------------------
let promptKey = '';
M.update = dt=>{
  for (const m of MARKS) m.material.uniforms.t.value += dt;
  routeTick(dt); pkgUpdate(dt); stuntCheck(); cheatCheck();
  const P = PL(); if (!P.alive) return;
  // 스토리 진행
  if (M.cur){ const c = M.cur; const st = c.def.steps[c.step]; const r = st.update(c.data, dt); if (M.cur && r){ c.step++; if (c.step >= c.def.steps.length) passStory(); else enterStep(); } }
  else if (G.save.missions < LIST.length){ const s = LIST[G.save.missions].start(); if (s){ if (!startMark){ startMark = M.marker(s.x, s.z, 1.6, 0xf5c518, 2.2); UI().blips = UI().blips.filter(b=>!b.story); UI().blips.push({ x:s.x, z:s.z, col:'#f5c518', label:String(G.save.missions + 1), story:true }); } } }
  if (!M.cur){ UI().blips = UI().blips.filter(b=>!b.story || G.save.missions < LIST.length); }
  // 부업
  if (M.side){ if (M.side.kind === 'taxi') taxiUpdate(dt); else vigUpdate(dt); }
  // 상호작용 안내
  const px = P.inCar ? P.car.x : P.x, pz = P.inCar ? P.car.z : P.z; let prompt = '', act = null;
  if (!M.cur && G.save.missions < LIST.length){ const s = LIST[G.save.missions].start(); if (s && Math.hypot(px - s.x, pz - s.z) < 4){ prompt = '<kbd>E</kbd> 미션 시작: <b>' + U.esc(LIST[G.save.missions].title) + '</b><br><small>' + U.esc(LIST[G.save.missions].desc) + '</small>'; act = ()=>{ if (G.wanted.level > 0){ UI().help('수배 중에는 미션을 시작할 수 없어요.', 2); return; } M.startStory(); }; } }
  if (!act) for (const s of W.specials){ if (Math.hypot(px - s.x, pz - s.z) < (s.type === 'spray' || s.type === 'modshop' || s.type === 'safe' ? 6 : 3.2)){ prompt = '<kbd>E</kbd> ' + U.esc(s.label); act = ()=>interact(s); break; } }
  if (!act && P.inCar && !M.cur){ if (P.car.t.taxi && !M.side){ prompt = '<kbd>E</kbd> 택시 운전 시작'; act = ()=>sideStart('taxi'); } else if (P.car.t.police && !M.side){ prompt = '<kbd>E</kbd> 자경단 시작'; act = ()=>sideStart('vig'); } else if (M.side){ prompt = '<kbd>E</kbd> 부업 그만두기'; act = ()=>sideEnd('부업을 그만뒀어요.'); } }
  if (!act && !P.inCar){ const v = G.veh.nearest(P.x, P.z, 4.5, v=>!v.dead); if (v) prompt = '<kbd>F</kbd> ' + (v.driver && v.driver !== 'player' ? '운전자를 끌어내고 ' : '') + '타기: ' + v.t.name; }
  if (G.TOUCH) prompt = prompt.replace(/<kbd>E<\/kbd>/g, '<kbd>상호작용</kbd>').replace(/<kbd>F<\/kbd>/g, '<kbd>타기</kbd>');
  if (prompt !== promptKey){ promptKey = prompt; if (prompt) UI().help(prompt, 600); else UI().helpOff(); }
  if (act && (G.input.hit('KeyE') || G.input.tbPressed.use)) act();
  // 라디오 · 카메라
  if (P.inCar){ if (G.input.hit('KeyQ') || G.input.tbPressed.radio || G.input.wheel){ const n = G.audio.STATIONS.length; const cur = G.audio.radioStation(); const d = G.input.wheel < 0 ? -1 : 1; let ni = cur + d; if (ni >= n) ni = -1; if (ni < -1) ni = n - 1; G.audio.setStation(ni); }
    if (G.input.hit('KeyC')) P.cam.mode = (P.cam.mode + 1)%3; }
  else if (G.input.wheel) P.cycle(G.input.wheel > 0 ? 1 : -1);
  if (P.infAmmo){ const k = P.weapon; if (G.weapons.W[k].mag) P.clip[k] = G.weapons.W[k].mag; }
  if (G.input.hit('Digit1')) P.select('fist'); for (let i = 2; i <= 9; i++) if (G.input.hit('Digit' + i)){ const k = G.weapons.ORDER[i - 1]; if (P.has(k)) P.select(k); }
};
M.completion = ()=>{ const a = G.save.missions/LIST.length, b = G.save.jumps.length/Math.max(1, W.ramps.length), c = G.save.packages.length/PKG.length; return Math.round((a*.6 + b*.2 + c*.2)*100); };
M.init = ()=>{ buildPackages(); for (const r of W.ramps){ } };
})();
