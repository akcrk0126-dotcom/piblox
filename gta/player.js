// =====================================================================
//  플레이어: 걷기 · 달리기 · 점프 · 수영 · 조준 · 사격 · 근접 · 차 타기(강탈) · 운전 · 카메라
// =====================================================================
'use strict';
(function(){
const U = G.U, W = G.world, I = G.input;
const PL = G.player = { x:0, y:0, z:0, h:0, vx:0, vz:0, vy:0, hp:100, maxHp:100, armor:0, alive:true, inCar:false, car:null, weapon:'fist', clip:{}, onGround:true, stamina:1, spreadK:1, aimK:0, lastCar:null, wantedDmg:0 };
const CAM = PL.cam = { yaw:Math.PI, pitch:.18, dist:4.4, x:0, y:2, z:0, shake:0, lastInput:0, behind:true, mode:0, fov:G.cfg.fov };

PL.DEFAULT_LOOK = { sex:'Male', skin:0xe0b090, hair:'Hair_SimpleParted', hairCol:0x1a120c, top:'jacket', shirt:0x2a2e38, shirt2:0xe8e8e8, pants:0x23304a, shoe:0x111111, legs:'long' };
PL.build = ()=>{
  const look = G.save.look || PL.DEFAULT_LOOK;
  if (PL.ch){ G.scene.remove(PL.ch.g); PL.ch.dispose(); }
  PL.ch = G.human.make(look); PL.g = PL.ch.g; G.scene.add(PL.g);
  G.weapons.attachModel(PL.ch, PL.weapon);
};
PL.spawn = (x, z, h)=>{ PL.x = x; PL.z = z; PL.y = W.groundY(x, z); PL.h = h || 0; PL.vx = PL.vz = PL.vy = 0; PL.alive = true; PL.hp = PL.maxHp; PL.inCar = false; PL.car = null; PL.g.visible = true; G.scene.add(PL.g); CAM.yaw = PL.h + Math.PI; PL.ch.play('idle', { fade:0 }); };
PL.has = k=>!!G.save.weapons[k];
PL.ammo = k=>(G.save.ammo[k] || 0) + (PL.clip[k] || 0);
PL.give = (k, ammo)=>{ G.save.weapons[k] = 1; if (G.weapons.W[k].mag){ G.save.ammo[k] = (G.save.ammo[k] || 0) + (ammo || 0); if (!PL.clip[k]) reload(k, true); } };
function reload(k, instant){ const w = G.weapons.W[k]; if (!w.mag) return; const need = w.mag - (PL.clip[k] || 0); const take = Math.min(need, G.save.ammo[k] || 0); if (take <= 0) return; if (instant){ PL.clip[k] = (PL.clip[k] || 0) + take; G.save.ammo[k] -= take; return; }
  PL.reloadT = w.rate < 2 ? 1.4 : 1.1; PL.reloadK = k; G.audio && G.audio.sfx('reload'); }
PL.select = k=>{ if (!PL.has(k) && k !== 'fist') return; PL.weapon = k; PL.reloadT = 0; G.weapons.attachModel(PL.ch, k); if (G.weapons.W[k].mag && !PL.clip[k]) reload(k, true); G.emit('weapon', k); };
PL.cycle = d=>{ const own = G.weapons.ORDER.filter(k=>k === 'fist' || PL.has(k)); let i = own.indexOf(PL.weapon); i = (i + d + own.length)%own.length; PL.select(own[i]); };

PL.damage = (amt, by, kind)=>{
  if (!PL.alive || PL.god) return;
  if (PL.armor > 0 && kind !== 'fall'){ const a = Math.min(PL.armor, amt*.7); PL.armor -= a; amt -= a; }
  PL.hp -= amt; CAM.shake = Math.min(1, CAM.shake + amt*.03); G.emit('playerHurt', amt, by, kind);
  if (kind === 'bullet' || kind === 'punch') G.fx.emit('blood', PL.x, PL.y + 1.2, PL.z, 3, 1);
  if (PL.hp <= 0){ PL.hp = 0; PL.die(kind); }
};
PL.die = kind=>{ if (!PL.alive) return; PL.alive = false; if (PL.inCar) PL.exitCar(true); PL.ch.play('death', { fade:.1 }); G.emit('wasted', kind); };

// ---------------------------------------------------------------------
//  차 타기 · 내리기
// ---------------------------------------------------------------------
PL.tryEnter = ()=>{
  let best = null, bd = 6; for (const v of G.veh.list){ if (v.dead) continue; const d = Math.hypot(v.x - PL.x, v.z - PL.z) - v.t.len*.35; if (d < bd){ bd = d; best = v; } }
  if (!best) return false;
  const v = best; PL.entering = { v, t:0 };
  // 운전자가 있으면 끌어냄
  const drv = v.driver && v.driver !== 'player' ? v.driver : null;
  PL.ch.play('interact', { restart:true }); PL.h = Math.atan2(v.x - PL.x, v.z - PL.z);
  setTimeout(()=>{ if (!PL.entering || PL.entering.v !== v || !PL.alive) return; PL.entering = null;
    if (drv && drv.alive){ drv.exitCar(); v.driver = null; if (drv.kind === 'cop' || drv.brave){ drv.hostile = true; drv.threat = PL; drv.state = drv.weapon ? 'shoot' : 'fight'; } else drv.scare(PL.x, PL.z, 1); G.emit('carjack', v, drv); }
    for (const ps of v.passengers) if (ps.alive){ ps.exitCar(); ps.scare(PL.x, PL.z, 1); } v.passengers = [];
    PL.enterCar(v); }, drv ? 650 : 380);
  return true;
};
PL.enterCar = v=>{ PL.inCar = true; PL.car = v; v.driver = 'player'; if (v.ai) v.ai = null; v.parked = false; PL.lastCar = v; v.keep = false;
  // 앉은 모습 보이기
  v.g.add(PL.g); const t = v.t; PL.g.position.set(t.bus ? 0 : -.38, t.bus ? t.gc + .85 : Math.min(t.gc + .22, t.roof - 1.12), (t.cr + t.cf)/2*t.len + (t.bus ? t.len*.4 : .05)); PL.g.rotation.set(0, 0, 0); PL.ch.play('sit', { fade:.15 });
  CAM.yaw = v.h + Math.PI; G.emit('enterCar', v); G.save.stats.cars++; };
PL.exitCar = (fast)=>{ const v = PL.car; if (!v) return; v.g.remove(PL.g); G.scene.add(PL.g); const d = v.door(-1);
  // 문 쪽이 막혔으면 반대쪽
  let p = d; if (W.pushCircle(d.x, d.z, .4, v.y + .3)) p = v.door(1);
  PL.x = p.x; PL.z = p.z; PL.y = Math.max(W.groundY(p.x, p.z), v.y); PL.h = v.h; v.driver = null; v.thr = 0; v.hb = true; v.steer = 0;
  const sp = v.speed; if (sp > 8 && !fast){ PL.vx = v.vx*.6; PL.vz = v.vz*.6; PL.ch.play('roll', { restart:true }); PL.rolling = .9; PL.damage(Math.min(25, sp*.8), null, 'fall'); } else { PL.vx = PL.vz = 0; }
  PL.inCar = false; PL.car = null; PL.g.position.set(PL.x, PL.y, PL.z); PL.g.rotation.set(0, PL.h, 0); if (!PL.rolling) PL.ch.play('idle'); G.emit('exitCar', v); };

// ---------------------------------------------------------------------
//  매 프레임
// ---------------------------------------------------------------------
PL.update = dt=>{
  if (PL.reloadT > 0){ PL.reloadT -= dt; if (PL.reloadT <= 0) reload(PL.reloadK, true); }
  if (!PL.alive){ PL.ch.mixer.update(dt); updateCam(dt); return; }
  if (PL.inCar) driveUpdate(dt); else footUpdate(dt);
  updateCam(dt);
  // 통계
  G.save.stats.time += dt;
};
let fireCD = 0, punchCombo = 0, comboT = 0;
function footUpdate(dt){
  const ch = PL.ch;
  if (PL.entering){ PL.entering.t += dt; ch.mixer.update(dt); syncFoot(); return; }
  // 입력
  let mx = 0, mz = 0;
  if (I.down('KeyW') || I.down('ArrowUp')) mz += 1; if (I.down('KeyS') || I.down('ArrowDown')) mz -= 1; if (I.down('KeyA') || I.down('ArrowLeft')) mx -= 1; if (I.down('KeyD') || I.down('ArrowRight')) mx += 1;
  if (I.joy.on){ mx = I.joy.x; mz = -I.joy.y; }
  const mag = Math.min(1, Math.hypot(mx, mz));
  const aiming = (I.mouseR || I.tb.aim) && !G.weapons.W[PL.weapon].melee;
  PL.aimK = U.damp(PL.aimK, aiming ? 1 : 0, 12, dt);
  const sprint = (I.down('ShiftLeft') || I.down('ShiftRight') || I.tb.sprint || (I.joy.on && mag > .95)) && !aiming && PL.stamina > .05;
  // 수영
  const water = W.inWater(PL.x, PL.z) && PL.y < -.3;
  const yaw = CAM.yaw + Math.PI; const fs = Math.sin(yaw), fc = Math.cos(yaw);
  let wx = (mz*fs - mx*fc), wz = (mz*fc + mx*fs); // 카메라 기준 → 월드
  const spd = water ? 2.2 : aiming ? 2.2 : sprint ? 7 : mag > .6 || !I.joy.on ? 3.9*(I.down('AltLeft') ? .4 : 1) : 1.6;
  let tx = 0, tz = 0; if (mag > .05){ const l = Math.hypot(wx, wz); tx = wx/l*spd*Math.min(1, mag*1.2); tz = wz/l*spd*Math.min(1, mag*1.2); }
  if (PL.rolling > 0){ PL.rolling -= dt; tx = PL.vx; tz = PL.vz; PL.vx *= Math.exp(-2*dt); PL.vz *= Math.exp(-2*dt); }
  if (PL.punchT > 0){ PL.punchT -= dt; tx *= .1; tz *= .1; }
  const acc = PL.onGround || water ? 12 : 2;
  PL.vx = U.damp(PL.vx, tx, acc, dt); PL.vz = U.damp(PL.vz, tz, acc, dt);
  PL.stamina = U.clamp(PL.stamina + (sprint && mag > .1 ? -dt*.09 : dt*.15), 0, 1);
  // 점프
  if ((I.hit('Space') || I.tbPressed.jump) && PL.onGround && !water && !aiming){ PL.vy = 5.4; PL.onGround = false; ch.play('jumpS', { restart:true, fade:.05 }); }
  PL.vy -= 20*dt; PL.y += PL.vy*dt; PL.x += PL.vx*dt; PL.z += PL.vz*dt;
  const gy = water ? -1.05 : W.groundY(PL.x, PL.z);
  // 낮은 턱(연석)은 그냥 올라감
  if (PL.y <= gy + (PL.onGround ? .35 : 0)){ if (!PL.onGround && PL.vy < -12) PL.damage((-PL.vy - 12)*6, null, 'fall'); if (!PL.onGround) ch.play('land', { restart:true, fade:.05 }); PL.y = PL.onGround ? U.damp(PL.y, gy, 18, dt) : gy; PL.vy = Math.max(0, PL.vy); PL.onGround = true; if (PL.y < gy) PL.y = gy; }
  else if (PL.y > gy + .35) PL.onGround = false;
  // 충돌: 건물 · 기둥 · 차
  const hb = W.pushCircle(PL.x, PL.z, .34, PL.y + .25); if (hb){ PL.x += hb.x; PL.z += hb.z; }
  const hp = W.pushPosts(PL.x, PL.z, .34); if (hp){ PL.x += hp.x; PL.z += hp.z; }
  for (const v of G.veh.list){ const dx = PL.x - v.x, dz = PL.z - v.z; if (Math.abs(dx) > 7 || Math.abs(dz) > 7) continue; const s = Math.sin(v.h), c = Math.cos(v.h); const f = dx*s + dz*c, l = dx*c - dz*s; const hl = v.t.len/2 + .3, hw = v.t.wid/2 + .3;
    if (Math.abs(f) < hl && Math.abs(l) < hw && PL.y < v.y + v.t.roof - .2){
      // 차 위로 올라탐 (점프 중)
      if (PL.vy < 0 && PL.y > v.y + v.t.belt - .3){ PL.y = v.y + v.t.roof - .05; PL.vy = 0; PL.onGround = true; continue; }
      const sp = v.speed; if (sp > 4 && v.driver){ PL.damage(sp*2.5, v.driver, 'car'); PL.vx = v.vx*.8 + (l > 0 ? c : -c)*3; PL.vz = v.vz*.8 + (l > 0 ? -s : s)*3; PL.vy = 4; PL.onGround = false; ch.play('knock', { restart:true }); PL.rolling = .8; G.emit('playerHitByCar', v); }
      const pf = hl - Math.abs(f), pl = hw - Math.abs(l); if (pf < pl){ const k = Math.sign(f)*pf; PL.x += s*k; PL.z += c*k; } else { const k = Math.sign(l)*pl; PL.x += c*k; PL.z -= s*k; } } }
  // 방향
  const moving = Math.hypot(PL.vx, PL.vz);
  if (aiming || PL.firing > 0) PL.h = U.dampAng(PL.h, yaw, 20, dt); else if (moving > .3 && PL.rolling <= 0) PL.h = U.dampAng(PL.h, Math.atan2(PL.vx, PL.vz), 10, dt);
  // 공격
  fireCD -= dt; comboT -= dt; if (PL.firing > 0) PL.firing -= dt;
  const w = G.weapons.W[PL.weapon];
  const trig = (I.mouseL && I.locked) || I.tb.fire; const trigHit = I.hit('Mouse0') || I.tbPressed.fire;
  if (w.melee){ if (trigHit && fireCD <= 0 && !water){ fireCD = 1/w.rate; punchCombo = comboT > 0 ? (punchCombo + 1)%3 : 0; comboT = .9; PL.h = yaw; PL.punchT = .35;
      ch.play(PL.weapon === 'bat' ? 'swing' : ['jab', 'cross', 'hook'][punchCombo], { restart:true, fade:.05, speed:PL.weapon === 'bat' ? 1.6 : 1.3 }); setTimeout(()=>{ if (PL.alive && !PL.inCar) G.weapons.melee(PL, PL.weapon, PL.x, PL.z, PL.h); }, 180); } }
  else if (w.thrown){ if (trigHit && fireCD <= 0 && (G.save.ammo.grenade || 0) > 0){ fireCD = 1; G.save.ammo.grenade--; ch.play('throw', { restart:true, fade:.05 }); PL.h = yaw; PL.punchT = .5;
      setTimeout(()=>{ const d = camDir(); G.weapons.grenade(new THREE.Vector3(PL.x, PL.y + 1.8, PL.z), new THREE.Vector3(d.x*16, 7 + d.y*10, d.z*16), PL); }, 350); if ((G.save.ammo.grenade || 0) <= 0){ delete G.save.weapons.grenade; setTimeout(()=>PL.select('fist'), 600); } } }
  else if ((w.auto ? trig : trigHit) && fireCD <= 0 && PL.reloadT <= 0 && !water){
    if ((PL.clip[PL.weapon] || 0) <= 0){ if ((G.save.ammo[PL.weapon] || 0) > 0) reload(PL.weapon); else { G.audio && G.audio.sfx('empty'); fireCD = .3; } }
    else { fireCD = 1/w.rate; PL.clip[PL.weapon]--; PL.firing = .6; PL.h = yaw;
      const o = muzzle(); const aimP = aimPoint(); const d = aimP.clone().sub(o).normalize();
      PL.spreadK = (aiming ? .6 : 1.6) + moving*.15 + (PL.onGround ? 0 : 1.5);
      if (w.rocket) G.weapons.rocket(o, d, PL); else G.weapons.fire(PL, PL.weapon, o, d);
      CAM.kick = (CAM.kick || 0) + (w.rocket ? .06 : w.dmg > 100 ? .05 : .012*(w.pellets ? 3 : 1)); CAM.shake = Math.min(1, CAM.shake + (w.pellets || w.rocket ? .25 : .06));
      if ((PL.clip[PL.weapon] || 0) <= 0 && (G.save.ammo[PL.weapon] || 0) > 0) setTimeout(()=>reload(PL.weapon), 150); } }
  if (I.hit('KeyR') && w.mag && (PL.clip[PL.weapon] || 0) < w.mag) reload(PL.weapon);
  // 애니메이션
  if (!(PL.punchT > 0) && !(PL.rolling > 0) && ch.cur !== 'land' || (ch.cur === 'land' && ch.curA && !ch.curA.isRunning())){
    let a = 'idle', sp = 1;
    if (water) a = moving > .5 ? 'swim' : 'swimIdle';
    else if (!PL.onGround) a = 'jump';
    else if (moving > 5) a = 'run'; else if (moving > 2.6) a = 'jog'; else if (moving > .2){ a = 'walk'; sp = moving/1.5; }
    if (ch.cur !== 'jumpS' || !ch.curA.isRunning()) ch.play(a, { speed:sp });
  }
  ch.mixer.update(dt);
  syncFoot();
  // 조준 중 팔 들기 (애니메이션 위에)
  if ((PL.aimK > .1 || PL.firing > 0) && !w.melee && !w.thrown){ PL.g.updateMatrixWorld(true); G.human.aimArms(ch, aimPoint(), w.two, Math.max(PL.aimK, PL.firing > 0 ? 1 : 0)); }
  // 차 타기
  if (I.hit('KeyF') || I.tbPressed.enter) PL.tryEnter();
  if (PL.y < -30) PL.damage(999, null, 'fall');
}
function syncFoot(){ PL.g.position.set(PL.x, PL.y, PL.z); PL.g.rotation.set(0, PL.h, 0); }
// 카메라가 보는 방향 / 조준점
function camDir(){ return new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion); }
function muzzle(){ const b = PL.ch.gun; if (b){ const p = new THREE.Vector3(0, .04, .3).applyMatrix4(b.matrixWorld); return p; } return new THREE.Vector3(PL.x + Math.sin(PL.h)*.5, PL.y + 1.4, PL.z + Math.cos(PL.h)*.5); }
function aimPoint(){ const o = G.camera.position.clone(), d = camDir(); const h = G.weapons.trace(o.clone().addScaledVector(d, 2), d, 300, PL.inCar ? PL.car : PL); return o.addScaledVector(d, h ? h.t + 2 : 300); }
PL.aimPoint = aimPoint; PL.camDir = camDir;

// ---------------------------------------------------------------------
//  운전
// ---------------------------------------------------------------------
function driveUpdate(dt){
  const v = PL.car; if (!v || v.removed){ PL.inCar = false; PL.car = null; return; }
  let thr = 0, st = 0;
  if (I.down('KeyW') || I.down('ArrowUp') || I.tb.gas) thr += 1; if (I.down('KeyS') || I.down('ArrowDown') || I.tb.brake) thr -= 1;
  if (I.down('KeyA') || I.down('ArrowLeft')) st += 1; if (I.down('KeyD') || I.down('ArrowRight')) st -= 1;
  if (I.joy.on){ st = -I.joy.x*1.2; if (!I.tb.gas && !I.tb.brake) thr = U.clamp(-I.joy.y*1.4, -1, 1); }
  v.thr = U.clamp(thr, -1, 1); v.steer = U.damp(v.steer, U.clamp(st, -1, 1), Math.abs(st) > .1 ? 7 : 10, dt); v.hb = I.down('Space') || !!I.tb.hb;
  if (I.hit('KeyH') || I.tbPressed.horn){ if (v.t.police) v.siren = !v.siren; else G.emit('horn', v, true); }
  if (v.t.police && I.down('KeyH')) G.audio && G.audio.horn(v);
  // 차에서 총 쏘기 (드라이브바이)
  fireCD -= dt; const w = G.weapons.W[PL.weapon];
  if (!w.melee && !w.thrown && !w.rocket && ((I.mouseL && I.locked) || I.tb.fire) && fireCD <= 0 && (PL.clip[PL.weapon] || 0) > 0){ fireCD = 1/w.rate*1.3; PL.clip[PL.weapon]--;
    const d = camDir(); const o = new THREE.Vector3(v.x, v.y + v.t.belt + .3, v.z).addScaledVector(d, v.t.wid*.7); PL.spreadK = 2.5; G.weapons.fire(PL, PL.weapon, o, aimPoint().sub(o).normalize()); if ((PL.clip[PL.weapon] || 0) <= 0) reload(PL.weapon); }
  if (I.hit('KeyF') || I.tbPressed.enter){ PL.exitCar(); return; }
  PL.ch.mixer.update(dt);
  G.save.stats.dist += v.speed*dt;
}

// ---------------------------------------------------------------------
//  카메라
// ---------------------------------------------------------------------
const _t = new THREE.Vector3();
function updateCam(dt){
  const sens = .0023*G.cfg.sens; let inX = I.mdx*sens + I.look.dx*.006*G.cfg.sens, inY = I.mdy*sens*(G.cfg.invertY ? -1 : 1) + I.look.dy*.005*G.cfg.sens;
  if (PL.aimK > .5){ inX *= .6; inY *= .6; } if (PL.scope){ inX *= .25; inY *= .25; }
  CAM.yaw -= inX; CAM.pitch = U.clamp(CAM.pitch + inY, -1.2, 1.25);
  if (Math.abs(inX) + Math.abs(inY) > .0005) CAM.lastInput = 0; else CAM.lastInput += dt;
  if (CAM.kick > 0){ CAM.pitch += CAM.kick*.5; CAM.kick *= Math.exp(-14*dt); if (CAM.kick < .001) CAM.kick = 0; }
  let target, dist, height, side = 0;
  if (PL.inCar && PL.car){ const v = PL.car;
    // 달리는 중에 손 안 대면 차 뒤로 따라감
    if (CAM.lastInput > 1.2 && v.speed > 3){ const behind = v.fwd >= -1 ? v.h + Math.PI : v.h; CAM.yaw = U.dampAng(CAM.yaw, behind, 2.5, dt); CAM.pitch = U.damp(CAM.pitch, .2, 2, dt); }
    const L = v.t.len; dist = (CAM.mode === 1 ? 1.4 : CAM.mode === 2 ? .01 : 1)*(L*1.25 + 3.2 + v.speed*.035); height = v.t.roof*.85 + .4;
    target = _t.set(v.x, v.y + height, v.z);
    if (CAM.mode === 2){ const s = v.seat(); target.set(s.x, s.y + .95, s.z); dist = .01; }
  } else { const aim = PL.aimK; dist = U.lerp(PL.alive ? 4.2 : 6, 1.7, aim); height = U.lerp(1.6, 1.55, aim); side = U.lerp(.35, .6, aim);
    target = _t.set(PL.x, PL.y + height, PL.z); }
  // 카메라 위치 (구면)
  const cp = Math.cos(CAM.pitch), sp = Math.sin(CAM.pitch);
  const dx = Math.sin(CAM.yaw)*cp, dz = Math.cos(CAM.yaw)*cp, dy = sp;
  const rx = Math.cos(CAM.yaw), rz = -Math.sin(CAM.yaw);
  const base = target.clone(); base.x += rx*side*-1; base.z += rz*side*-1;
  // 벽에 막히면 당겨옴
  const dir = new THREE.Vector3(dx, dy, dz); let d = dist; const h = W.raycast(base, dir, dist + .3); if (h) d = Math.max(.3, h.t - .3);
  const want = base.clone().addScaledVector(dir, d);
  const gy = W.groundY(want.x, want.z) + .3; if (want.y < gy) want.y = gy;
  const k = PL.inCar ? 14 : 30; CAM.x = U.damp(CAM.x, want.x, k, dt); CAM.y = U.damp(CAM.y, want.y, k, dt); CAM.z = U.damp(CAM.z, want.z, k, dt);
  if (Math.hypot(CAM.x - want.x, CAM.z - want.z) > 20){ CAM.x = want.x; CAM.y = want.y; CAM.z = want.z; }
  const cam = G.camera; cam.position.set(CAM.x, CAM.y, CAM.z);
  cam.lookAt(base.x - dx*10, base.y - dy*10 + (PL.inCar ? .3 : 0), base.z - dz*10);
  if (CAM.shake > 0){ cam.rotation.x += (Math.random() - .5)*CAM.shake*.03; cam.rotation.y += (Math.random() - .5)*CAM.shake*.03; CAM.shake = Math.max(0, CAM.shake - dt*2.5); }
  // 시야각: 속도감 · 조준 · 저격 조준경
  let fov = G.cfg.fov; if (PL.inCar && PL.car) fov += Math.min(16, PL.car.speed*.28); fov -= PL.aimK*14; PL.scope = PL.aimK > .8 && G.weapons.W[PL.weapon].scope && !PL.inCar; if (PL.scope) fov = 14;
  CAM.fov = U.damp(CAM.fov, fov, 8, dt); if (Math.abs(cam.fov - CAM.fov) > .05){ cam.fov = CAM.fov; cam.updateProjectionMatrix(); }
  PL.g.visible = !(PL.scope) && !(PL.inCar && CAM.mode === 2);
}
})();
