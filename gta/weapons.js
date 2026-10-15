// =====================================================================
//  무기: 주먹 · 야구방망이 · 권총 · 기관단총 · 샷건 · 돌격소총 · 저격총 · 로켓 · 수류탄
// =====================================================================
'use strict';
(function(){
const U = G.U, W = G.world;
const WP = G.weapons = {};
// dmg 한 발 피해 · rate 초당 발사 · spread 퍼짐(rad) · mag 탄창 · range 사거리 · pellets 산탄 수
const D = WP.W = {
  fist:{ name:'주먹', melee:true, dmg:12, rate:2.2, range:1.6, icon:'fist', slot:0 },
  bat:{ name:'야구방망이', melee:true, dmg:30, rate:1.4, range:2, icon:'bat', slot:1, price:120 },
  pistol:{ name:'권총', dmg:24, rate:4, spread:.012, mag:12, range:90, icon:'pistol', slot:2, price:400, ammoPrice:60, ammoPack:36, snd:'pistol', two:0 },
  smg:{ name:'기관단총', dmg:16, rate:12, spread:.03, mag:30, range:70, auto:true, icon:'smg', slot:3, price:1600, ammoPrice:120, ammoPack:90, snd:'smg', two:.25 },
  shotgun:{ name:'샷건', dmg:14, pellets:8, rate:1.1, spread:.08, mag:8, range:35, icon:'shotgun', slot:4, price:1200, ammoPrice:100, ammoPack:24, snd:'shotgun', two:.35 },
  rifle:{ name:'돌격소총', dmg:30, rate:9, spread:.016, mag:30, range:140, auto:true, icon:'rifle', slot:5, price:3500, ammoPrice:180, ammoPack:90, snd:'rifle', two:.38 },
  sniper:{ name:'저격총', dmg:160, rate:.8, spread:.001, mag:5, range:400, scope:true, icon:'sniper', slot:6, price:6000, ammoPrice:200, ammoPack:15, snd:'sniper', two:.42 },
  rpg:{ name:'로켓 발사기', dmg:0, rate:.7, mag:1, range:300, rocket:true, icon:'rpg', slot:7, price:12000, ammoPrice:600, ammoPack:3, snd:'rpg', two:.3 },
  grenade:{ name:'수류탄', dmg:0, rate:1, mag:1, thrown:true, icon:'grenade', slot:8, price:300, ammoPrice:300, ammoPack:3 },
};
WP.ORDER = ['fist', 'bat', 'pistol', 'smg', 'shotgun', 'rifle', 'sniper', 'rpg', 'grenade'];

// ---------------------------------------------------------------------
//  모델 (손에 쥐는 총)
// ---------------------------------------------------------------------
const MM = {};
function gm(){ if (MM.metal) return MM; MM.metal = new THREE.MeshStandardMaterial({ color:0x222326, roughness:.35, metalness:.85 }); MM.poly = new THREE.MeshStandardMaterial({ color:0x111112, roughness:.7, metalness:.1 }); MM.wood = new THREE.MeshStandardMaterial({ color:0x5a3a1e, roughness:.7 }); MM.olive = new THREE.MeshStandardMaterial({ color:0x3a4a2a, roughness:.7 }); return MM; }
const B = (w, h, d, m, x, y, z)=>{ const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x || 0, y || 0, z || 0); return o; };
const C = (r, l, m, x, y, z)=>{ const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 8), m); o.rotation.x = Math.PI/2; o.position.set(x || 0, y || 0, z || 0); return o; };
WP.model = k=>{ const M = gm(); const g = new THREE.Group();
  // 기준: 손잡이가 원점, 총구가 +z
  switch (k){
    case 'bat': g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(.035, .02, .85, 8), MM.wood), { position:new THREE.Vector3(0, 0, .35) })); g.children[0].rotation.x = Math.PI/2; break;
    case 'pistol': g.add(B(.03, .1, .05, M.poly, 0, -.04, -.01), B(.032, .035, .19, M.metal, 0, .03, .06)); break;
    case 'smg': g.add(B(.04, .1, .05, M.poly, 0, -.05, 0), B(.045, .06, .3, M.metal, 0, .02, .08), B(.03, .14, .04, M.poly, 0, -.07, .1), C(.012, .1, M.metal, 0, .03, .27)); break;
    case 'shotgun': g.add(B(.04, .09, .26, M.wood, 0, -.02, -.18), B(.045, .06, .3, M.metal, 0, .02, .1), C(.016, .45, M.metal, 0, .035, .42), C(.018, .3, M.wood, 0, .0, .38)); break;
    case 'rifle': g.add(B(.04, .1, .05, M.poly, 0, -.05, 0), B(.045, .07, .45, M.olive, 0, .02, .1), B(.035, .08, .22, M.poly, 0, .01, -.18), B(.03, .16, .05, M.metal, 0, -.08, .12), C(.012, .22, M.metal, 0, .035, .43), B(.02, .04, .1, M.metal, 0, .08, .05)); break;
    case 'sniper': g.add(B(.04, .1, .3, M.wood, 0, -.02, -.18), B(.045, .06, .4, M.metal, 0, .02, .12), C(.012, .5, M.metal, 0, .03, .55), C(.025, .28, M.poly, 0, .1, .1)); break;
    case 'rpg': g.add(C(.06, 1.1, M.olive, 0, .08, .15), B(.03, .12, .05, M.poly, 0, -.02, 0), B(.03, .1, .05, M.poly, 0, -.02, .2)); break;
    case 'grenade': g.add(new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), M.olive)); break;
  }
  g.traverse(o=>{ if (o.isMesh) o.castShadow = true; }); return g; };
// 사람 손에 붙이기 (손 뼈 기준 방향 보정)
WP.attachModel = (ch, k)=>{ const hand = ch.bones.hand_r; if (!hand) return; if (ch.gun){ ch.gun.parent && ch.gun.parent.remove(ch.gun); ch.gun = null; } if (!k || k === 'fist') return;
  const m = WP.model(k); const holder = new THREE.Group(); holder.add(m); hand.add(holder); const inv = 1/(hand.getWorldScale(new THREE.Vector3()).x || 1); holder.scale.setScalar(inv);
  // 손 뼈 축 → 총구 방향: 손가락 방향(middle_01 - hand) 이 총구
  ch.g.updateMatrixWorld(true); const hp = hand.getWorldPosition(new THREE.Vector3()), mp = ch.bones.middle_01_r.getWorldPosition(new THREE.Vector3()), ip = ch.bones.index_01_r.getWorldPosition(new THREE.Vector3()), pp = ch.bones.pinky_01_r.getWorldPosition(new THREE.Vector3());
  const fin = mp.clone().sub(hp).normalize(); const up = ip.clone().sub(pp); up.addScaledVector(fin, -up.dot(fin)).normalize(); const side = new THREE.Vector3().crossVectors(up, fin);
  // 총구 = 손가락 방향과 수직인 손바닥 앞쪽 (주먹 쥔 방향): 검지→새끼 축을 위로, 손가락 방향을 아래로 쥐는 형태
  const Z = up.clone().negate().lerp(fin, .15).normalize(); const Y = fin.clone().negate(); const X = new THREE.Vector3().crossVectors(Y, Z).normalize(); Y.crossVectors(Z, X);
  const qW = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); const hq = hand.getWorldQuaternion(new THREE.Quaternion());
  holder.quaternion.copy(hq.invert().multiply(qW)); holder.position.copy(hand.worldToLocal(hp.clone().lerp(mp, .55)));
  ch.gun = holder; ch.gunKey = k; };

// ---------------------------------------------------------------------
//  사격
// ---------------------------------------------------------------------
// 광선이 맞는 첫 대상: 사람(캡슐) · 차(OBB) · 건물
const _o = new THREE.Vector3(), _d = new THREE.Vector3();
WP.trace = (o, d, range, ignore)=>{
  let best = range, hit = null;
  const bh = W.raycast(o, d, range); if (bh){ best = bh.t; hit = { type:'world', t:bh.t, n:bh.n }; }
  // 사람
  const peds = G.peds.list; const tgts = peds.concat(G.player.alive && !G.player.inCar ? [G.player] : []);
  for (const p of tgts){ if (p === ignore || p.car) continue; const px = p.x - o.x, pz = p.z - o.z; const tc = px*d.x + pz*d.z; if (tc < 0 || tc > best + 1) continue;
    // 세로 캡슐: 가장 가까운 점
    const cx = o.x + d.x*tc - p.x, cz = o.z + d.z*tc - p.z; const lat2 = cx*cx + cz*cz; const rr = p.alive === false || (p.alive2 === false) ? .45 : .38; if (lat2 > rr*rr) continue;
    const tt = tc - Math.sqrt(Math.max(0, rr*rr - lat2)); const y = o.y + d.y*tt - (p.y || 0); const top = p.alive === false ? .5 : 1.8; if (y < 0 || y > top) continue;
    if (tt < best){ best = tt; hit = { type:'ped', t:tt, p, head:y > 1.5 && p.alive !== false }; } }
  // 차
  for (const v of G.veh.list){ if (v === ignore) continue; const dx = v.x - o.x, dz = v.z - o.z; if (dx*dx + dz*dz > (best + 6)*(best + 6)) continue;
    const s = Math.sin(v.h), c = Math.cos(v.h); // 차 좌표계로
    const lo = { x:(o.x - v.x)*c - (o.z - v.z)*s, y:o.y - v.y, z:(o.x - v.x)*s + (o.z - v.z)*c }, ld = { x:d.x*c - d.z*s, y:d.y, z:d.x*s + d.z*c };
    const hx = v.t.wid/2, hz = v.t.len/2; let t0 = 0, t1 = best; let ok = true;
    for (const [oo, dd, lo2, hi] of [[lo.x, ld.x, -hx, hx], [lo.y, ld.y, v.t.gc, v.t.roof], [lo.z, ld.z, -hz, hz]]){ if (Math.abs(dd) < 1e-9){ if (oo < lo2 || oo > hi){ ok = false; break; } continue; } let a = (lo2 - oo)/dd, b = (hi - oo)/dd; if (a > b){ const q = a; a = b; b = q; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1){ ok = false; break; } }
    if (ok && t0 < best){ best = t0; hit = { type:'car', t:t0, v }; } }
  // 경찰 헬기 (구)
  const hl = G.wanted && G.wanted.heli; if (hl && !hl.dead){ const cx = hl.x - o.x, cy = hl.y - o.y, cz = hl.z - o.z; const tc = cx*d.x + cy*d.y + cz*d.z; if (tc > 0 && tc < best){ const l2 = cx*cx + cy*cy + cz*cz - tc*tc; if (l2 < 6.5) { best = tc - Math.sqrt(6.5 - l2); hit = { type:'heli', t:best }; } } }
  return hit;
};
// 트레이서 (총알 궤적)
let tracers; const TR = [];
function tracer(a, b){ if (!tracers){ tracers = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color:0xffe8a0, transparent:true, opacity:.8, blending:THREE.AdditiveBlending, depthWrite:false })); tracers.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60*6), 3)); tracers.frustumCulled = false; G.scene.add(tracers); }
  TR.push({ a:a.clone(), b:b.clone(), t:.06 }); }
WP.update = dt=>{ if (!tracers) return; const p = tracers.geometry.attributes.position; let n = 0; for (let i = TR.length - 1; i >= 0; i--){ TR[i].t -= dt; if (TR[i].t <= 0){ TR.splice(i, 1); continue; } if (n < 60){ const q = TR[i]; const m = q.a.clone().lerp(q.b, .35); p.setXYZ(n*2, m.x, m.y, m.z); p.setXYZ(n*2 + 1, q.b.x, q.b.y, q.b.z); n++; } }
  tracers.geometry.setDrawRange(0, n*2); p.needsUpdate = true; updateProj(dt); };
// 한 발 쏘기 (shooter = 플레이어 또는 NPC)
WP.fire = (shooter, k, o, dir)=>{
  const w = D[k]; const n = w.pellets || 1; let anyHit = false;
  for (let i = 0; i < n; i++){
    const d = dir.clone(); const sp = w.spread*(shooter === G.player ? G.player.spreadK : 2.4); d.x += (Math.random() - .5)*sp*2; d.y += (Math.random() - .5)*sp*2; d.z += (Math.random() - .5)*sp*2; d.normalize();
    const h = WP.trace(o, d, w.range, shooter === G.player ? (G.player.car || G.player) : shooter);
    const end = o.clone().addScaledVector(d, h ? h.t : w.range);
    if (i < 2) tracer(o.clone().addScaledVector(d, .6), end);
    if (!h) continue;
    if (h.type === 'world'){ const nrm = h.n === 2 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(Math.abs(h.n) === 1 ? Math.sign(h.n) : 0, Math.abs(h.n) === 2 ? Math.sign(h.n) : 0, Math.abs(h.n) === 3 ? Math.sign(h.n) : 0);
      G.fx.bulletHole(end, nrm); G.fx.emit('dust', end.x, end.y, end.z, 2, .3); G.fx.emit('spark', end.x, end.y, end.z, 2, 1.5); }
    else if (h.type === 'ped'){ const dmg = w.dmg*(h.head ? 2.5 : 1)*(shooter !== G.player ? .35 : 1); h.p.damage(dmg, shooter, 'bullet', d); anyHit = true; if (shooter === G.player) G.emit('hitmark', h.head); }
    else if (h.type === 'heli'){ G.wanted.hitHeli(w.dmg*.8); G.fx.emit('spark', end.x, end.y, end.z, 4, 2); anyHit = true; }
    else if (h.type === 'car'){ h.v.damage(w.dmg*.9, shooter, 'bullet'); G.fx.emit('spark', end.x, end.y, end.z, 3, 2); anyHit = true; if (h.v.driver && h.v.driver !== 'player' && h.v.driver.alive && Math.random() < .08) h.v.driver.damage(w.dmg, shooter, 'bullet', d);
      if (h.v.driver === 'player' && shooter !== G.player) G.player.damage(w.dmg*.25, shooter, 'bullet'); }
  }
  G.emit('gunshot', o.x, o.z, shooter, k);
  G.fx.emit('flash', o.x + dir.x*.3, o.y + dir.y*.3, o.z + dir.z*.3, 1, .05); G.fx.flash(o.x, o.y, o.z, 0xffc070, 4, 8, .05);
  G.audio && G.audio.shot(w.snd || 'pistol', o.x, o.z, shooter === G.player);
  return anyHit;
};
// NPC 사격: 다음 발사까지 시간
WP.npcFire = (p, t)=>{ const w = p.weapon || D.pistol; const o = new THREE.Vector3(p.x + Math.sin(p.h)*.4, p.y + 1.4, p.z + Math.cos(p.h)*.4); const ty = (t.y || 0) + (t.inCar ? .9 : 1.1);
  const dir = new THREE.Vector3(t.x - o.x, ty - o.y, t.z - o.z).normalize();
  // NPC 명중률: 거리 · 이동 중이면 더 빗나감
  const miss = .05 + (t === G.player ? Math.min(.12, Math.hypot(G.player.vx || 0, G.player.vz || 0)*.012) : 0); dir.x += (Math.random() - .5)*miss; dir.y += (Math.random() - .5)*miss*.6; dir.z += (Math.random() - .5)*miss; dir.normalize();
  const k = Object.keys(D).find(k=>D[k] === w) || 'pistol';
  WP.fire(p, k, o, dir); if (p.ch.gun){ G.fx.emit('flash', o.x + dir.x*.5, o.y, o.z + dir.z*.5, 1, .05); }
  return 1/(w.rate*.45) + Math.random()*.6; };
// 근접 공격
WP.melee = (attacker, k, x, z, h)=>{ const w = D[k]; const fx = Math.sin(h), fz = Math.cos(h); let hit = false;
  for (const p of G.peds.list){ if (!p.alive || p.car || p === attacker) continue; const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz); if (d > w.range) continue; if ((dx*fx + dz*fz)/(d || 1) < .4) continue;
    p.damage(w.dmg*(k === 'bat' ? 1 : 1)*(.85 + Math.random()*.3), attacker, k === 'fist' ? 'punch' : 'melee', { x:fx, z:fz }); hit = true; if (p.alive && k === 'bat' && Math.random() < .35){ p.vx = fx*5; p.vz = fz*5; p.vy = 3; p.state = 'ragdoll'; p.t = 0; p.ch.play('knock', { restart:true }); } }
  for (const v of G.veh.list){ const dx = v.x - x, dz = v.z - z; if (Math.hypot(dx, dz) < v.t.len/2 + w.range*.6 && (dx*fx + dz*fz) > 0){ v.damage(w.dmg*.3, attacker, 'melee'); } }
  G.audio && G.audio.punch(hit); return hit; };

// ---------------------------------------------------------------------
//  투사체: 로켓 · 수류탄
// ---------------------------------------------------------------------
const PROJ = [];
WP.rocket = (o, d, by)=>{ const m = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .5, 6), gm().olive); m.rotation.x = Math.PI/2; const g = new THREE.Group(); g.add(m); g.position.copy(o); g.lookAt(o.clone().add(d)); G.scene.add(g);
  PROJ.push({ type:'rocket', g, p:o.clone(), v:d.clone().multiplyScalar(55), t:0, by }); G.audio && G.audio.shot('rpg', o.x, o.z, by === G.player); G.emit('gunshot', o.x, o.z, by, 'rpg'); };
WP.grenade = (o, v, by)=>{ const g = WP.model('grenade'); g.position.copy(o); G.scene.add(g); PROJ.push({ type:'nade', g, p:o.clone(), v:v.clone(), t:0, by }); };
function updateProj(dt){ for (let i = PROJ.length - 1; i >= 0; i--){ const q = PROJ[i]; q.t += dt;
  if (q.type === 'rocket'){ const step = q.v.clone().multiplyScalar(dt); const dl = step.length(); const h = WP.trace(q.p, step.clone().normalize(), dl + .3, q.by === G.player ? (G.player.car || G.player) : q.by);
    if (h || q.t > 5){ const e = q.p.clone().addScaledVector(step.normalize(), h ? h.t : 0); G.fx.explode(e.x, e.y, e.z, 1.4); if (h && h.type === 'heli') G.wanted.hitHeli(500); G.scene.remove(q.g); PROJ.splice(i, 1); continue; }
    q.p.add(q.v.clone().multiplyScalar(dt)); q.g.position.copy(q.p); G.fx.emit('smoke', q.p.x, q.p.y, q.p.z, 2, .2, 0, 0, 0, .7); G.fx.emit('fire', q.p.x, q.p.y, q.p.z, 1, .1, 0, 0, 0, .5); }
  else { q.v.y -= 18*dt; q.p.addScaledVector(q.v, dt); const gy = W.groundY(q.p.x, q.p.z) + .05; if (q.p.y < gy){ q.p.y = gy; q.v.y *= -.35; q.v.x *= .6; q.v.z *= .6; }
    const hb = W.pushCircle(q.p.x, q.p.z, .1, q.p.y); if (hb){ q.p.x += hb.x; q.p.z += hb.z; q.v.x *= -.4; q.v.z *= -.4; }
    q.g.position.copy(q.p); q.g.rotation.x += dt*8;
    if (q.t > 2.6){ G.fx.explode(q.p.x, q.p.y, q.p.z, 1.1); G.scene.remove(q.g); PROJ.splice(i, 1); } } } }
})();
