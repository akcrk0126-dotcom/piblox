// =====================================================================
//  경찰 · 수배 레벨(별 1~5) · 추격 · 체포(BUSTED) · 헬기
// =====================================================================
'use strict';
(function(){
const U = G.U, W = G.world, V = G.veh;
const WT = G.wanted = { level:0, seen:false, unseenT:0, last:{ x:0, z:0 }, flash:0, units:[], heli:null, bustT:0 };
const PL = ()=>G.player;
WT.set = (lv, why)=>{ lv = U.clamp(Math.floor(lv), 0, 5); if (PL().cheatNoWanted && lv > 0) return; const up = lv > WT.level; WT.level = lv; if (lv > 0){ WT.seen = true; WT.unseenT = 0; WT.last = { x:PL().x, z:PL().z }; } if (up){ G.emit('wantedUp', lv, why); G.save.stats.maxWanted = Math.max(G.save.stats.maxWanted, lv); } if (lv === 0) clearUnits(); };
WT.add = (n, why)=>WT.set(Math.max(WT.level, 0) + n, why);
WT.atLeast = (n, why)=>{ if (WT.level < n) WT.set(n, why); else { WT.seen = true; WT.unseenT = 0; WT.last = { x:PL().x, z:PL().z }; } };

// 근처에 경찰이 보고 있나
function copNear(x, z, r){ for (const p of G.peds.list) if (p.kind === 'cop' && p.alive && Math.hypot(p.x - x, p.z - z) < r) return true; for (const v of V.list) if (v.t.police && !v.dead && v.driver && Math.hypot(v.x - x, v.z - z) < r) return true; return false; }
WT.copNear = copNear;
// ----- 범죄 -----
G.on('pedDead', (p, by, kind)=>{ if (by !== PL()) return; G.save.stats.kills++; if (p.kind === 'cop'){ WT.atLeast(2, '경찰 살해'); WT.add(1); return; } if (p.mission || p.kind === 'gang'){ if (copNear(p.x, p.z, 35)) WT.atLeast(1, '총격전'); return; } if (copNear(p.x, p.z, 60)) WT.add(1, '살인'); else if (Math.random() < .55) setTimeout(()=>{ if (PL().alive) WT.atLeast(1, '목격자 신고'); }, 2500 + Math.random()*4000); });
G.on('pedHurt', (p, by, kind)=>{ if (by !== PL()) return; if (p.kind === 'cop') WT.atLeast(1, '경찰 폭행'); else if (copNear(p.x, p.z, 30)) WT.atLeast(1, '폭행'); });
G.on('carjack', (v, drv)=>{ if (drv.kind === 'cop' || v.t.police){ WT.atLeast(2, '경찰차 탈취'); return; } if (copNear(v.x, v.z, 40)) WT.atLeast(1, '차량 강탈'); else if (Math.random() < .2) WT.atLeast(1, '차량 강탈 신고'); });
G.on('gunshot', (x, z, by)=>{ if (by !== PL()) return; if (copNear(x, z, 55)) WT.atLeast(1, '총기 발사'); });
G.on('explosion', (x, y, z)=>{ if (Math.hypot(x - PL().x, z - PL().z) < 80 && copNear(x, z, 120)) WT.atLeast(2, '폭발'); });
G.on('carHit', (A, B, imp)=>{ if (imp < 4) return; const pc = A.driver === 'player' ? B : B.driver === 'player' ? A : null; if (pc && pc.t.police && !pc.dead) WT.atLeast(1, '경찰차 충돌'); });
G.on('carDead', v=>{ if (v.lastHitBy === PL() && v.t.police) WT.add(1, '경찰차 파괴'); });
G.on('pedHitByCar', (p, v, sp)=>{ if (v.driver !== 'player' || sp < 6) return; if (p.kind === 'cop') WT.atLeast(2, '경찰 치임'); else if (copNear(p.x, p.z, 40)) WT.atLeast(1, '뺑소니'); });

// ----- 경찰 출동 -----
function clearUnits(){ for (const u of WT.units){ if (u.v && !u.v.dead && u.v.driver && u.v.driver !== 'player'){ u.v.siren = false; if (u.v.ai){ u.v.ai.mode = 'drive'; V.reattach(u.v); } u.v.mission = false; } for (const p of u.cops || []) if (p.alive){ p.hostile = false; p.state = 'walk'; p.threat = null; p.mission = false; } } WT.units = []; if (WT.heli) WT.heli.leave = true; }
function spawnCar(){ const pl = PL(); // 플레이어에서 120~200m 떨어진 도로 노드
  let best = null; for (let k = 0; k < 80; k++){ const n = W.nodes[Math.floor(Math.random()*W.nodes.length)]; const d = Math.hypot(n.x - pl.x, n.z - pl.z); if (d > 110 && d < 220){ best = n; break; } } if (!best) return;
  const swat = WT.level >= 4 && Math.random() < .5; const v = new V.Vehicle(swat ? 'van' : 'police', best.x, best.z, Math.atan2(pl.x - best.x, pl.z - best.z), swat ? 0x15151a : undefined);
  if (swat) v.t = Object.assign({}, v.t, { police:true, top:52, acc:11, hp:2600 });
  v.siren = true; v.isCop = true; v.mission = true; const drv = G.peds.spawnDriver(v, true); v.driver = drv; drv.mission = true; v.ai = { mode:'police', route:null, rt:0, cruise:30 };
  const cops = [drv]; if (WT.level >= 2){ const c2 = new G.peds.Ped(G.human.copLook(), v.x, v.z, 'cop'); G.peds.arm(c2, WT.level >= 3 ? 'smg' : 'pistol'); c2.enterCar(v, 'pass'); v.passengers.push(c2); c2.mission = true; cops.push(c2); }
  if (WT.level >= 3) G.peds.arm(drv, 'smg'); if (WT.level >= 4) for (const c of cops) G.peds.arm(c, 'rifle');
  WT.units.push({ v, cops }); }
// 노드 그래프 최단 경로 (BFS)
function route(fromX, fromZ, toX, toZ){ const nearest = (x, z)=>{ let b = null, bd = 1e12; for (const n of W.nodes){ const d = (n.x - x)**2 + (n.z - z)**2; if (d < bd){ bd = d; b = n; } } return b; };
  const a = nearest(fromX, fromZ), b = nearest(toX, toZ); if (!a || !b) return []; const prev = new Map([[a, null]]); const q = [a];
  while (q.length){ const n = q.shift(); if (n === b) break; for (const [i, j] of n.nb){ const m = W.nodeAt[i + ',' + j]; if (m && !prev.has(m)){ prev.set(m, n); q.push(m); } } }
  const path = []; let n = b; while (n){ path.unshift(n); n = prev.get(n); } return path; }
WT.route = route;
function policeDrive(v, dt){ const pl = PL(); const tx = pl.inCar ? pl.car.x : pl.x, tz = pl.inCar ? pl.car.z : pl.z; const d = Math.hypot(tx - v.x, tz - v.z); const a = v.ai;
  // 경로: 가까우면 바로 추격, 멀면 도로를 따라
  let gx = tx, gz = tz;
  const los = d < 45 && !W.raycast(new THREE.Vector3(v.x, 1.2, v.z), new THREE.Vector3(tx - v.x, 0, tz - v.z).normalize(), d);
  if (!los){ a.rt -= dt; if (a.rt <= 0 || !a.route || !a.route.length){ a.route = route(v.x, v.z, tx, tz); a.rt = 2.5; const r = a.route; if (r.length > 1 && Math.hypot(v.x - r[1].x, v.z - r[1].z) < Math.hypot(r[0].x - r[1].x, r[0].z - r[1].z) + 4) r.shift(); }
    while (a.route.length && Math.hypot(a.route[0].x - v.x, a.route[0].z - v.z) < 10) a.route.shift(); if (a.route.length){ gx = a.route[0].x; gz = a.route[0].z; } }
  else if (pl.inCar){ gx += pl.car.vx*.6; gz += pl.car.vz*.6; }
  const want = Math.atan2(gx - v.x, gz - v.z); const err = U.angDiff(v.h, want); v.steer = U.clamp(err*2.4, -1, 1);
  // 정면이 막혔으면 후진
  a.stuck = (a.stuck || 0) + (v.speed < 1.5 && Math.abs(v.thr) > .5 ? dt : -dt); a.stuck = Math.max(0, a.stuck);
  if (a.rev > 0){ a.rev -= dt; v.thr = -1; v.steer = -v.steer; v.hb = false; return; } if (a.stuck > 1.5){ a.rev = 1.2; a.stuck = 0; }
  const onFoot = !pl.inCar;
  if (onFoot && d < 22){ v.thr = v.fwd > 1 ? -1 : 0; v.hb = v.speed < 2; if (v.speed < 2 && !a.out){ a.out = true; deploy(v); } return; }
  a.out = false; v.hb = Math.abs(err) > 1.2 && v.speed > 12; v.thr = Math.abs(err) > 1.6 && v.speed > 8 ? -.5 : 1; }
// 경찰이 차에서 내림
function deploy(v){ const u = WT.units.find(u=>u.v === v); const all = [v.driver, ...v.passengers].filter(p=>p && p !== 'player' && p.alive);
  for (const p of all){ p.exitCar(); p.hostile = true; p.threat = PL(); p.state = p.weapon ? 'shoot' : 'fight'; p.mission = true; } v.passengers = []; v.driver = null; v.ai = null; if (u) u.cops = all; }
// 다시 차에 태움 (플레이어가 차로 도망가면)
function regroup(u){ const v = u.v; if (!v || v.dead || v.driver) return; const cops = (u.cops || []).filter(p=>p.alive && !p.car); if (!cops.length) return; const dr = cops.find(p=>Math.hypot(p.x - v.x, p.z - v.z) < 12); if (!dr) return;
  dr.enterCar(v); v.driver = dr; v.ai = { mode:'police', route:null, rt:0 }; for (const c of cops) if (c !== dr && Math.hypot(c.x - v.x, c.z - v.z) < 12){ c.enterCar(v, 'pass'); v.passengers.push(c); } }

// ----- 헬기 -----
function heliModel(){ const g = new THREE.Group(); const body = new THREE.MeshPhysicalMaterial({ color:0x13244a, metalness:.4, roughness:.35, clearcoat:1 }); const dark = new THREE.MeshStandardMaterial({ color:0x111111, roughness:.6 }); const glass = new THREE.MeshPhysicalMaterial({ color:0x0a1218, roughness:.05, metalness:.2, transparent:true, opacity:.8 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), body); b.scale.set(1, .9, 1.7); g.add(b); const w = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12, 0, Math.PI*2, 0, Math.PI/2.2), glass); w.scale.set(1, .85, 1.2); w.position.set(0, .1, .9); w.rotation.x = .5; g.add(w);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(.18, .35, 5, 8), body); tail.rotation.x = Math.PI/2; tail.position.set(0, .4, -3.8); g.add(tail); const fin = new THREE.Mesh(new THREE.BoxGeometry(.1, 1.2, .7), body); fin.position.set(0, .9, -6.1); g.add(fin);
  for (const s of [-1, 1]){ const sk = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, 3.2), dark); sk.position.set(s*1, -1.35, 0); g.add(sk); }
  const rot = new THREE.Group(); for (let k = 0; k < 4; k++){ const bl = new THREE.Mesh(new THREE.BoxGeometry(.25, .04, 9), dark); bl.rotation.y = k*Math.PI/4*2; rot.add(bl); } rot.position.y = 1.45; g.add(rot); g.userData.rot = rot;
  const tr = new THREE.Group(); for (let k = 0; k < 2; k++){ const bl = new THREE.Mesh(new THREE.BoxGeometry(.06, 1.6, .15), dark); bl.rotation.x = k*Math.PI/2; tr.add(bl); } tr.position.set(.2, .9, -6.1); g.add(tr); g.userData.tr = tr;
  const txt = G.world.tex.textTex('POLICE', '#13244a', '#fff', 512, 128); for (const s of [-1, 1]){ const d = new THREE.Mesh(new THREE.PlaneGeometry(1.8, .45), new THREE.MeshStandardMaterial({ map:txt })); d.position.set(s*1.42, .1, -.3); d.rotation.y = s*Math.PI/2; g.add(d); }
  const spot = new THREE.SpotLight(0xffffff, 0, 120, .22, .5, 1); spot.position.set(0, -1.4, 1.2); g.add(spot); g.add(spot.target); g.userData.spot = spot;
  g.traverse(o=>{ if (o.isMesh) o.castShadow = true; }); return g; }
function heliUpdate(dt){ const h = WT.heli; if (!h) return; const pl = PL();
  h.t += dt; const tx = pl.inCar ? pl.car.x : pl.x, tz = pl.inCar ? pl.car.z : pl.z;
  if (h.dead){ h.vy -= 9*dt; h.y += h.vy*dt; h.g.rotation.y += dt*3; G.fx.emit('dark', h.x, h.y, h.z, 1, .5, 0, 1, 0, 1.4); if (h.y <= W.groundY(h.x, h.z) + 1){ G.fx.explode(h.x, h.y, h.z, 2); G.scene.remove(h.g); WT.heli = null; } h.g.position.set(h.x, h.y, h.z); return; }
  let gx, gz, gy; if (h.leave){ gx = h.x + (h.x - tx); gz = h.z + (h.z - tz); gy = 90; if (Math.hypot(h.x - tx, h.z - tz) > 400){ G.scene.remove(h.g); WT.heli = null; return; } }
  else { const a = h.t*.25; gx = tx + Math.cos(a)*30; gz = tz + Math.sin(a)*30; gy = W.groundY(tx, tz) + 38; }
  const k = 1 - Math.exp(-.8*dt); h.vx = U.lerp(h.vx, (gx - h.x)*.6, k); h.vz = U.lerp(h.vz, (gz - h.z)*.6, k); h.x += h.vx*dt; h.z += h.vz*dt; h.y = U.damp(h.y, gy, 1, dt);
  h.g.position.set(h.x, h.y + Math.sin(h.t*1.3)*.4, h.z); h.g.rotation.set(U.clamp(h.vz*.01, -.25, .25)*0 + .08, Math.atan2(tx - h.x, tz - h.z), -U.clamp(h.vx*.008, -.2, .2));
  h.g.userData.rot.rotation.y += dt*28; h.g.userData.tr.rotation.x += dt*40;
  const sp = h.g.userData.spot; sp.intensity = G.env.night > .4 ? 6 : 0; sp.target.position.set(0, -40, 8);
  // 사격
  h.fireT -= dt; if (WT.level >= 4 && h.fireT <= 0 && !h.leave && Math.hypot(h.x - tx, h.z - tz) < 70){ h.fireT = .25 + Math.random()*.5; const o = new THREE.Vector3(h.x, h.y - 1.5, h.z); const d = new THREE.Vector3(tx - o.x, (pl.inCar ? pl.car.y + 1 : pl.y + 1.1) - o.y, tz - o.z).normalize(); d.x += (Math.random() - .5)*.1; d.z += (Math.random() - .5)*.1; d.normalize(); G.weapons.fire(h.shooter, 'rifle', o, d); }
  G.audio && G.audio.heli(h);
}
function spawnHeli(){ const pl = PL(); const g = heliModel(); G.scene.add(g); const a = Math.random()*6.28; WT.heli = { g, x:pl.x + Math.cos(a)*250, z:pl.z + Math.sin(a)*250, y:90, vx:0, vz:0, vy:0, t:0, hp:700, fireT:2, shooter:{ x:0, z:0, kind:'cop', heli:true } }; }
WT.hitHeli = (dmg)=>{ const h = WT.heli; if (!h || h.dead) return; h.hp -= dmg; if (h.hp <= 0){ h.dead = true; h.vy = 0; G.fx.explode(h.x, h.y, h.z, 1.5); WT.add(1, '헬기 격추'); } };

// ----- 매 프레임 -----
WT.update = dt=>{
  const pl = PL(); WT.flash += dt;
  if (!pl.alive){ return; }
  if (WT.level > 0){
    // 경찰이 보고 있나
    const px = pl.inCar ? pl.car.x : pl.x, pz = pl.inCar ? pl.car.z : pl.z; const R = 55 + WT.level*18; let seen = false;
    for (const u of WT.units){ const obs = u.v && u.v.driver && u.v.driver !== 'player' ? [u.v] : (u.cops || []).filter(p=>p.alive); for (const o of obs){ const d = Math.hypot(o.x - px, o.z - pz); if (d < R){ if (d < 25 || !W.raycast(new THREE.Vector3(o.x, 1.5, o.z), new THREE.Vector3(px - o.x, 0, pz - o.z).normalize(), d)){ seen = true; break; } } } if (seen) break; }
    for (const p of G.peds.list){ if (seen) break; if (p.kind === 'cop' && p.alive && Math.hypot(p.x - px, p.z - pz) < 35){ seen = true; if (!p.hostile){ p.hostile = true; p.threat = pl; p.state = p.weapon ? 'shoot' : 'fight'; } } }
    if (WT.heli && !WT.heli.dead && Math.hypot(WT.heli.x - px, WT.heli.z - pz) < 70) seen = true;
    if (seen){ WT.seen = true; WT.unseenT = 0; WT.last = { x:px, z:pz }; } else { WT.seen = false; WT.unseenT += dt; }
    // 수색 반경을 벗어나 일정 시간 숨으면 해제
    const searchR = 80 + WT.level*30; const far = Math.hypot(px - WT.last.x, pz - WT.last.z) > searchR;
    if (!WT.seen && (WT.unseenT > 6 + WT.level*5 || (far && WT.unseenT > 3))){ WT.set(0); G.emit('wantedClear'); }
    // 출동
    WT.units = WT.units.filter(u=>{ const alive = (u.v && !u.v.dead && !u.v.removed) || (u.cops || []).some(p=>p.alive && !p.removed); if (!alive) return false; if (u.v && Math.hypot(u.v.x - px, u.v.z - pz) > 400){ if (u.v.driver && u.v.driver.remove) u.v.driver.remove(); for (const c of u.v.passengers) c.remove(); u.v.remove(); return false; } return true; });
    const want = [0, 1, 2, 3, 4, 5][WT.level];
    WT.spawnT = (WT.spawnT || 0) - dt; if (WT.units.length < want && WT.spawnT <= 0){ WT.spawnT = 2.5; spawnCar(); }
    if (WT.level >= 3 && !WT.heli) spawnHeli();
    for (const u of WT.units){ if (u.v && u.v.ai && u.v.ai.mode === 'police' && u.v.driver && u.v.driver !== 'player') policeDrive(u.v, dt); else if (pl.inCar) regroup(u); }
    // 체포: 걸어서 붙잡힘
    if (!pl.inCar){ let close = false; for (const p of G.peds.list) if (p.kind === 'cop' && p.alive && !p.car && Math.hypot(p.x - pl.x, p.z - pl.z) < 1.8) close = true;
      if (close && Math.hypot(pl.vx, pl.vz) < 2.5 && WT.level <= 2){ WT.bustT += dt; if (WT.bustT > 1.4){ WT.bustT = 0; G.emit('busted'); } } else WT.bustT = Math.max(0, WT.bustT - dt); }
    else if (pl.car.speed < 1){ let close = 0; for (const p of G.peds.list) if (p.kind === 'cop' && p.alive && !p.car && Math.hypot(p.x - pl.car.x, p.z - pl.car.z) < 3.4) close++; if (close && WT.level <= 2){ WT.bustT += dt; if (WT.bustT > 2.2){ WT.bustT = 0; G.emit('busted'); } } }
  }
  heliUpdate(dt);
};
})();
