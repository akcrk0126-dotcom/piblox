// =====================================================================
//  보행자: 생성 · 인도 걷기 · 길 건너기 · 놀람/도망 · 싸움 · 차에 치임 · 운전자
// =====================================================================
'use strict';
(function(){
const U = G.U, W = G.world, H = G.human;
const P = G.peds = { list:[] };
P.max = G.LOW ? 16 : 32;
let NEXT = 1;

class Ped {
  constructor(look, x, z, kind){
    this.id = NEXT++; this.kind = kind || 'civ'; this.look = look;
    this.ch = H.make(look); this.g = this.ch.g; G.scene.add(this.g);
    this.x = x; this.z = z; this.y = W.groundY(x, z); this.h = Math.random()*6.28; this.vx = 0; this.vz = 0; this.vy = 0;
    this.hp = kind === 'cop' ? 120 : kind === 'gang' ? 110 : 100; this.state = 'walk'; this.t = 0; this.target = null; this.speed = 0; this.want = 0;
    this.fear = 0; this.threat = null; this.weapon = null; this.ammo = 0; this.fireT = 0; this.alive = true; this.deadT = 0; this.car = null; this.hostile = false; this.voiceT = 0;
    this.brave = kind === 'gang' || kind === 'cop' || Math.random() < .12; this.r = .32; this.visible = true;
    P.list.push(this);
  }
  get alive2(){ return this.alive; }
  remove(){ G.scene.remove(this.g); if (this.g.parent) this.g.parent.remove(this.g); this.ch.dispose(); const i = P.list.indexOf(this); if (i >= 0) P.list.splice(i, 1); this.removed = true; }
  damage(amt, by, kind, dir){
    if (!this.alive) return; this.hp -= amt; this.lastHit = by;
    G.fx.emit('blood', this.x, this.y + 1.2, this.z, kind === 'bullet' ? 6 : 3, 1.2, dir ? dir.x*2 : 0, 1, dir ? dir.z*2 : 0);
    this.ch.setBlood(Math.min(1, (this.ch._bl = (this.ch._bl || 0) + amt/120)));
    if (this.hp <= 0){ this.die(by, kind, dir); return; }
    if (kind !== 'car' && this.state !== 'ragdoll'){ this.ch.play(Math.random() < .5 ? 'hit' : 'hitH', { restart:true, fade:.05 }); this.stagger = .45; }
    G.emit('pedHurt', this, by, kind);
    if (this.car) return;
    if (this.kind === 'cop' || this.kind === 'gang' || (this.brave && kind === 'punch')){ this.hostile = true; this.threat = by; this.state = this.weapon ? 'shoot' : 'fight'; }
    else this.scare(by ? by.x : this.x, by ? by.z : this.z, 1);
  }
  die(by, kind, dir){ if (!this.alive) return; this.alive = false; this.hp = 0; this.state = 'dead'; this.deadT = 0;
    if (this.car){ const c = this.car; this.exitCar(true); if (c.driver === this) c.driver = null; }
    this.ch.play('death', { fade:.1 }); if (dir && kind !== 'car'){ this.vx = dir.x*2; this.vz = dir.z*2; }
    G.emit('pedDead', this, by, kind); }
  // 겁먹기: (x,z) 에서 도망
  scare(x, z, k){ if (!this.alive || this.car || this.kind === 'cop' || (this.kind === 'gang' && this.hostile)) return; if (this.brave && k < 1 && Math.random() < .5) return;
    this.fear = Math.max(this.fear, 8 + Math.random()*6); this.threat = { x, z }; if (this.state !== 'ragdoll') this.state = 'flee'; if (this.voiceT <= 0 && Math.random() < .4){ G.emit('scream', this); this.voiceT = 4; } }
  // 차에 치임
  hitByCar(v, sp){ if (!this.alive || this.state === 'ragdoll') return; const dmg = sp < 6 ? sp*4 : sp*sp*.9; const dx = this.x - v.x, dz = this.z - v.z, d = Math.hypot(dx, dz) || 1;
    this.vx = v.vx*.9 + dx/d*2; this.vz = v.vz*.9 + dz/d*2; this.vy = Math.min(9, 2 + sp*.35); this.state = 'ragdoll'; this.t = 0; this.ch.play('knock', { restart:true, fade:.05 });
    this.damage(dmg, v.driver === 'player' ? G.player : v.driver, 'car'); G.emit('pedHitByCar', this, v, sp); if (this.alive) this.scare(v.x, v.z, 1); }
  enterCar(v, seat){ this.car = v; this.state = 'drive'; v.g.add(this.g); const t = v.t; this.g.position.set(seat === 'pass' ? .38 : -.38, t.bus ? t.gc + .85 : Math.min(t.gc + .22, t.roof - 1.12), (t.cr + t.cf)/2*t.len + (t.bus ? t.len*.4 : .05)); this.g.rotation.set(0, 0, 0); this.ch.play('sit', { fade:0 }); }
  exitCar(fast){ const v = this.car; if (!v) return; v.g.remove(this.g); G.scene.add(this.g); const d = v.door(-1); this.x = d.x; this.z = d.z; this.y = W.groundY(d.x, d.z); this.h = v.h - Math.PI/2; this.car = null; this.state = 'walk'; this.ch.play('idle', { fade:.1 }); }
  // 인도 목표
  pickTarget(){
    const ci = Math.floor((this.x + W.HALF)/W.CELL), cj = Math.floor((this.z + W.HALF)/W.CELL);
    const o = W.RW + 2; const x0 = W.X(ci) + o, x1 = W.X(ci + 1) - o, z0 = W.X(cj) + o, z1 = W.X(cj + 1) - o;
    const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    // 가장 가까운 모퉁이 다음 것으로
    let best = 0, bd = 1e9; corners.forEach((c, i)=>{ const d = (c[0] - this.x)**2 + (c[1] - this.z)**2; if (d < bd){ bd = d; best = i; } });
    if (bd < 4){ // 모퉁이에 도착 → 계속 돌거나 길 건너기
      if (Math.random() < .3){ const c = corners[best]; const dirs = [[c[0] < (x0 + x1)/2 ? -1 : 1, 0], [0, c[1] < (z0 + z1)/2 ? -1 : 1]]; const d = U.pick(dirs); const nx = c[0] + d[0]*o*2, nz = c[1] + d[1]*o*2;
        if (Math.abs(nx) < W.HALF && Math.abs(nz) < W.HALF){ this.target = { x:nx, z:nz, cross:true }; return; } }
      this.dirSign = this.dirSign || (Math.random() < .5 ? 1 : -1); const n = corners[(best + this.dirSign + 4)%4]; this.target = { x:n[0], z:n[1] }; return; }
    // 모퉁이까지 가는 중간 지점: 가장 가까운 변 위로
    this.target = { x:corners[best][0], z:corners[best][1] };
  }
  update(dt, near){
    this.t += dt; this.voiceT -= dt; if (this.stagger > 0) this.stagger -= dt;
    if (this.car){ if (near) this.ch.mixer.update(dt); return; }
    if (!this.alive){ this.deadT += dt; this.vx *= Math.exp(-4*dt); this.vz *= Math.exp(-4*dt); this.x += this.vx*dt; this.z += this.vz*dt; if (this.y > W.groundY(this.x, this.z)){ this.vy -= 20*dt; this.y = Math.max(W.groundY(this.x, this.z), this.y + this.vy*dt); } this.sync(); if (near) this.ch.mixer.update(dt); return; }
    let mvx = 0, mvz = 0, sp = 0, anim = 'idle';
    switch (this.state){
      case 'walk':{
        if (!this.target || Math.hypot(this.target.x - this.x, this.target.z - this.z) < 1.2){ if (this.target && !this.target.cross && Math.random() < .08){ this.state = 'idle'; this.idleT = 2 + Math.random()*6; this.idleAnim = U.pick(['idle', 'talk', 'fold', 'idle']); break; } this.pickTarget(); }
        // 길 건널 때 차가 오면 기다림
        const dx = this.target.x - this.x, dz = this.target.z - this.z, d = Math.hypot(dx, dz) || 1;
        sp = this.look.sex === 'Female' ? 1.3 : 1.45; if (this.target.cross && W.onRoad(this.x + dx/d*2, this.z + dz/d*2)){ const car = G.veh.nearest(this.x + dx/d*6, this.z + dz/d*6, 9, v=>v.speed > 2); if (car) sp = 0; else sp = 2.2; }
        mvx = dx/d*sp; mvz = dz/d*sp; anim = sp > 2 ? 'jog' : sp > 0 ? 'walk' : 'idle'; break; }
      case 'idle': this.idleT -= dt; anim = this.idleAnim || 'idle'; if (this.idleT <= 0) this.state = 'walk'; break;
      case 'flee':{ this.fear -= dt; const th = this.threat || { x:this.x - 1, z:this.z };
        let ax = this.x - th.x, az = this.z - th.z; const d = Math.hypot(ax, az) || 1; ax /= d; az /= d;
        // 건물 피하기
        const hb = W.raycast(new THREE.Vector3(this.x, 1, this.z), new THREE.Vector3(ax, 0, az), 4); if (hb){ const s = this.id%2 ? 1 : -1; const nx = -az*s, nz = ax*s; ax = nx; az = nz; }
        sp = 5.6; mvx = ax*sp; mvz = az*sp; anim = 'run'; if (this.fear <= 0){ this.state = 'walk'; this.target = null; } break; }
      case 'fight':{ const t = this.threat && this.threat.alive !== false ? this.threat : null; if (!t || (t === G.player && G.player.inCar)){ this.state = 'walk'; this.hostile = false; break; }
        const dx = t.x - this.x, dz = t.z - this.z, d = Math.hypot(dx, dz) || 1; this.want = Math.atan2(dx, dz);
        if (d > 30){ this.state = 'walk'; this.hostile = false; break; }
        if (d > 1.3){ sp = 4.8; mvx = dx/d*sp; mvz = dz/d*sp; anim = 'jog'; }
        else { anim = 'idle'; this.atkT = (this.atkT || 0) - dt; if (this.atkT <= 0 && (!this.stagger || this.stagger <= 0)){ this.atkT = .9 + Math.random()*.6; this.ch.play(U.pick(['jab', 'cross', 'hook']), { restart:true, fade:.05 }); this.punching = .5;
            setTimeout(()=>{ if (this.alive && Math.hypot(t.x - this.x, t.z - this.z) < 1.6) t.damage && t.damage(7 + Math.random()*6, this, 'punch', { x:dx/d, z:dz/d }); }, 250); } }
        break; }
      case 'shoot':{ const t = this.threat; if (!t || t.alive === false || !this.weapon){ this.state = 'walk'; break; }
        const dx = t.x - this.x, dz = t.z - this.z, d = Math.hypot(dx, dz) || 1; this.want = Math.atan2(dx, dz);
        if (d > 70){ this.state = 'walk'; this.hostile = false; break; }
        if (d > 22){ sp = 5; mvx = dx/d*sp; mvz = dz/d*sp; anim = 'run'; }
        else if (d < 4 && t === G.player && !G.player.inCar && this.kind === 'cop'){ sp = 0; anim = 'idle'; }
        else { anim = 'idle'; this.aiming = true; this.fireT -= dt; if (this.fireT <= 0){ this.fireT = G.weapons.npcFire(this, t); } }
        break; }
      case 'ragdoll':{ this.vy -= 20*dt; this.y += this.vy*dt; this.x += this.vx*dt; this.z += this.vz*dt; const gy = W.groundY(this.x, this.z); if (this.y <= gy){ this.y = gy; this.vy = 0; this.vx *= Math.exp(-6*dt); this.vz *= Math.exp(-6*dt); }
        const hb = W.pushCircle(this.x, this.z, this.r, this.y); if (hb){ this.x += hb.x; this.z += hb.z; this.vx *= -.3; this.vz *= -.3; }
        if (this.t > 1.6 && this.y <= gy + .01){ this.state = this.hostile ? 'fight' : 'flee'; this.fear = 6; this.ch.play('idle'); } this.sync(); if (near) this.ch.mixer.update(dt); return; }
    }
    this.aiming = this.state === 'shoot' && anim === 'idle';
    if (this.stagger > 0){ mvx *= .2; mvz *= .2; }
    if (this.punching > 0){ this.punching -= dt; mvx = mvz = 0; }
    // 다른 사람과 겹치지 않게
    for (const o of near ? P.list : []){ if (o === this || !o.alive || o.car) continue; const ex = this.x - o.x, ez = this.z - o.z, d2 = ex*ex + ez*ez; if (d2 < .5 && d2 > 1e-6){ const d = Math.sqrt(d2); mvx += ex/d*1.2; mvz += ez/d*1.2; } }
    this.vx = U.damp(this.vx, mvx, 8, dt); this.vz = U.damp(this.vz, mvz, 8, dt);
    this.x += this.vx*dt; this.z += this.vz*dt;
    const hb = W.pushCircle(this.x, this.z, this.r, this.y + .2); if (hb){ this.x += hb.x; this.z += hb.z; if (this.state === 'walk' && Math.random() < .1) this.target = null; }
    const hp = W.pushPosts(this.x, this.z, this.r); if (hp){ this.x += hp.x; this.z += hp.z; }
    this.y = U.damp(this.y, W.groundY(this.x, this.z), 20, dt);
    const spd = Math.hypot(this.vx, this.vz);
    if (spd > .3 && !this.aiming) this.want = Math.atan2(this.vx, this.vz);
    this.h = U.dampAng(this.h, this.want, 8, dt);
    if (!this.stagger || this.stagger <= 0){ if (!this.punching || this.punching <= 0) this.ch.play(spd < .2 ? anim === 'walk' || anim === 'jog' || anim === 'run' ? 'idle' : anim : spd < 2 ? 'walk' : spd < 4.5 ? 'jog' : 'run', { speed:spd < 2 && spd > .2 ? spd/1.4 : 1 }); }
    this.sync();
    if (near) this.ch.mixer.update(dt);
    if (this.aiming && near && this.threat){ this.g.updateMatrixWorld(true); H.aimArms(this.ch, new THREE.Vector3(this.threat.x, (this.threat.y || 0) + 1.2, this.threat.z), this.weapon && this.weapon.two ? .3 : 0); }
  }
  sync(){ this.g.position.set(this.x, this.y, this.z); this.g.rotation.y = this.h; }
}
P.Ped = Ped;

// 무기 들려주기
P.arm = (p, wk)=>{ p.weapon = G.weapons.W[wk]; p.ammo = 999; G.weapons.attachModel(p.ch, wk); };
P.near = (x, z, r)=>P.list.filter(p=>p.alive && !p.car && Math.abs(p.x - x) < r && Math.abs(p.z - z) < r);
// 인도 위 무작위 지점 (플레이어 주변)
function sidewalkSpot(px, pz){
  for (let tries = 0; tries < 10; tries++){
    const a = Math.random()*6.28, d = 35 + Math.random()*75; const x = px + Math.cos(a)*d, z = pz + Math.sin(a)*d;
    if (Math.abs(x) > W.HALF - 10 || Math.abs(z) > W.HALF - 10) continue;
    const ci = Math.floor((x + W.HALF)/W.CELL), cj = Math.floor((z + W.HALF)/W.CELL); const o = W.RW + 2; const x0 = W.X(ci) + o, x1 = W.X(ci + 1) - o, z0 = W.X(cj) + o, z1 = W.X(cj + 1) - o;
    // 가장 가까운 변으로 붙이기
    const cand = [[x, z0], [x, z1], [x0, z], [x1, z]].map(([qx, qz])=>[U.clamp(qx, x0, x1), U.clamp(qz, z0, z1)]);
    let best = cand[0], bd = 1e9; for (const c of cand){ const dd = (c[0] - x)**2 + (c[1] - z)**2; if (dd < bd){ bd = dd; best = c; } }
    if (W.pushCircle(best[0], best[1], .5, .3)) continue;
    const dist = Math.hypot(best[0] - px, best[1] - pz); if (dist < 30) continue;
    return { x:best[0], z:best[1] }; }
  return null; }
P.manage = (dt, px, pz)=>{
  for (let i = P.list.length - 1; i >= 0; i--){ const p = P.list[i]; if (p.car || p.keep || p.mission) continue; const d = Math.hypot(p.x - px, p.z - pz); if (d > 150 || (!p.alive && (p.deadT > 45 || d > 90))) p.remove(); }
  const onFoot = P.list.filter(p=>!p.car && p.alive).length;
  const dist = W.district(px, pz); const dens = dist === 'down' || dist === 'beach' ? 1 : dist === 'mid' ? .85 : dist === 'park' ? .7 : dist === 'ind' ? .35 : dist === 'hills' ? .15 : .55;
  if (onFoot < P.max*dens && Math.random() < dt*8){ const s = sidewalkSpot(px, pz); if (s){
      let kind = 'civ', look; const r = Math.random();
      if (r < .05){ kind = 'cop'; look = H.copLook(); } else if (dist === 'ind' && r < .4 || dist === 'mid' && r < .1){ kind = 'gang'; look = H.gangLook(Math.random, dist === 'ind' ? 'g' : 'p'); } else look = H.randomLook();
      const p = new Ped(look, s.x, s.z, kind); if (kind === 'cop') P.arm(p, 'pistol'); if (kind === 'gang' && Math.random() < .5) P.arm(p, Math.random() < .7 ? 'pistol' : 'smg'); p.gang = kind === 'gang' ? (dist === 'ind' ? 'g' : 'p') : null; } }
};
P.spawnDriver = (v, cop)=>{ const look = cop ? H.copLook() : H.randomLook(); const p = new Ped(look, v.x, v.z, cop ? 'cop' : 'civ'); p.enterCar(v); if (cop) P.arm(p, 'pistol'); return p; };
// 매 프레임
P.update = (dt, px, pz)=>{
  for (const p of P.list.slice()){ const d = Math.abs(p.x - px) + Math.abs(p.z - pz); let near = d < 140;
    if (p.car){ const cd = Math.abs(p.car.x - px) + Math.abs(p.car.z - pz); near = cd < 70; p.g.visible = near; if (near) p.ch.mixer.update(dt); continue; }
    p.g.visible = near; p.update(dt, near && d < 90); }
  // 차에 치이기
  for (const v of G.veh.list){ const sp = v.speed; if (sp < 2.5) continue; const s = Math.sin(v.h), c = Math.cos(v.h);
    for (const p of P.list){ if (!p.alive && sp < 8 || p.car || p.state === 'ragdoll') continue; const dx = p.x - v.x, dz = p.z - v.z; if (Math.abs(dx) > 5 || Math.abs(dz) > 5) continue; const f = dx*s + dz*c, l = dx*c - dz*s;
      if (Math.abs(f) < v.t.len/2 + .3 && Math.abs(l) < v.t.wid/2 + .3){ if (!p.alive){ p.vx = v.vx; p.vz = v.vz; continue; } p.hitByCar(v, sp); v.vx *= .93; v.vz *= .93; } } }
};
// 총소리 · 폭발 → 주변 사람 겁먹음
G.on('gunshot', (x, z, by)=>{ for (const p of P.list){ const d = Math.hypot(p.x - x, p.z - z); if (d < 45 && p !== by) p.scare(x, z, .8); if (d < 35 && p.car && p.car.ai && p.car.driver === p && !p.car.isCop && Math.random() < .5){ p.car.ai.mode = 'flee'; } } });
G.on('explosion', (x, y, z, pw)=>{ const R = 8*pw; for (const p of P.list.slice()){ const d = Math.hypot(p.x - x, p.z - z); if (d < R){ const k = 1 - d/R; p.damage(160*k, G.player, 'explosion', { x:(p.x - x)/(d || 1), z:(p.z - z)/(d || 1) }); if (p.alive || true){ p.vx = (p.x - x)/(d || 1)*10*k; p.vz = (p.z - z)/(d || 1)*10*k; p.vy = 6*k; if (p.alive){ p.state = 'ragdoll'; p.t = 0; } } } else if (d < 60) p.scare(x, z, 1); }
  for (const v of G.veh.list){ const d = Math.hypot(v.x - x, v.z - z); if (d < R*1.2 && !v.dead){ v.damage(v.t.hp*1.2*(1 - d/(R*1.2)) + 50, G.player, 'explosion'); const k = 1 - d/(R*1.2); v.vx += (v.x - x)/(d || 1)*8*k; v.vz += (v.z - z)/(d || 1)*8*k; v.vy = 4*k; v.air = k > .3; } } });
})();
