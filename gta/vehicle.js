// =====================================================================
//  차량: 모델(옆모습 압출 + 유리 온실) · 물리(아케이드) · 손상 · 교통 AI
// =====================================================================
'use strict';
(function(){
const U = G.U, W = G.world;
const V = G.veh = { list:[], types:{} };
const LC = h=>new THREE.Color(h).convertSRGBToLinear();

// ---------------------------------------------------------------------
//  차종
// ---------------------------------------------------------------------
// len 길이 · wid 폭 · roof 지붕 높이 · belt 벨트라인 · gc 지상고 · wr 바퀴 반지름 · wb 축간거리
// cr/rr/rf/cf: 온실(유리) 뒤끝 · 지붕 뒤 · 지붕 앞 · 앞유리 아래 (길이 비율 -0.5..0.5)
const T = V.types = {
  compact:{ name:'블리스타', len:3.8, wid:1.72, roof:1.48, belt:.95, gc:.16, wr:.31, wb:2.45, cr:-.46, rr:-.28, rf:.12, cf:.27, nose:.7, tail:.86, top:42, acc:9, grip:8.5, mass:1050, hp:900, price:9000, colors:[0xd8d8d8, 0x2a6ac8, 0xc8303a, 0xf2c94c, 0x5ac85a, 0x222222] },
  sedan:{ name:'루나 세단', len:4.7, wid:1.86, roof:1.46, belt:.98, gc:.15, wr:.33, wb:2.8, cr:-.3, rr:-.15, rf:.14, cf:.25, nose:.72, tail:.88, top:48, acc:9.5, grip:8.5, mass:1450, hp:1100, price:16000, colors:[0x1a1a1e, 0xe8e8e8, 0x8a96a4, 0x23304a, 0x6a1a1a, 0x3a4a3a, 0xc8b8a0] },
  taxi:{ base:'sedan', name:'택시', colors:[0xf2c200], taxi:true, price:14000 },
  police:{ base:'sedan', name:'경찰차', colors:[0x101014], police:true, top:58, acc:12, grip:9.5, hp:1500, price:0 },
  sports:{ name:'코멧 R', len:4.45, wid:1.95, roof:1.22, belt:.84, gc:.11, wr:.34, wb:2.6, cr:-.36, rr:-.2, rf:.04, cf:.2, nose:.6, tail:.8, top:66, acc:15, grip:10.5, mass:1300, hp:950, price:85000, colors:[0xc81e1e, 0xf2c200, 0x1d4ed8, 0xe8e8e8, 0x111111, 0xff7a1a] },
  super:{ name:'인페르노 X', len:4.65, wid:2.02, roof:1.12, belt:.76, gc:.1, wr:.35, wb:2.7, cr:-.14, rr:-.04, rf:.12, cf:.3, nose:.5, tail:.74, top:76, acc:18, grip:11.5, mass:1350, hp:900, price:240000, colors:[0x9acd32, 0xff5a1a, 0xffffff, 0x101010, 0xd4af37, 0x7a2ac8] },
  muscle:{ name:'도미네이터', len:4.95, wid:1.92, roof:1.34, belt:.94, gc:.14, wr:.35, wb:2.85, cr:-.28, rr:-.14, rf:.06, cf:.17, nose:.78, tail:.86, top:60, acc:14, grip:8, mass:1600, hp:1300, price:45000, colors:[0x1a1a1a, 0xc81e1e, 0x2a5a9a, 0xe8a020, 0xf0f0f0] },
  suv:{ name:'그레인저', len:4.85, wid:2.0, roof:1.86, belt:1.18, gc:.26, wr:.4, wb:2.9, cr:-.47, rr:-.44, rf:.16, cf:.26, nose:.8, tail:.95, top:46, acc:9.5, grip:8, mass:2200, hp:1600, price:38000, colors:[0x111111, 0xe8e8e8, 0x3a3e44, 0x2a3a2a, 0x5a3a24] },
  pickup:{ name:'밥캣', len:5.3, wid:2.0, roof:1.88, belt:1.14, gc:.28, wr:.41, wb:3.2, cr:-.12, rr:-.08, rf:.18, cf:.27, nose:.82, tail:1.0, top:44, acc:9, grip:7.5, mass:2100, hp:1700, price:22000, bed:true, colors:[0x9a2a1a, 0x2a4a7a, 0xc8c8c8, 0x3a3a3a, 0x6a5a3a] },
  van:{ name:'부리토 밴', len:5.0, wid:2.0, roof:2.15, belt:1.12, gc:.2, wr:.36, wb:3.1, cr:-.5, rr:-.49, rf:.3, cf:.4, nose:.85, tail:2.1, top:40, acc:7.5, grip:7, mass:2400, hp:1700, price:18000, colors:[0xf0f0f0, 0x2a3a6a, 0x6a6a6a, 0xc8a020] },
  bus:{ name:'시내버스', len:11, wid:2.55, roof:3.15, belt:1.25, gc:.3, wr:.5, wb:6.2, cr:-.5, rr:-.5, rf:.49, cf:.5, nose:1.2, tail:3.1, top:30, acc:5, grip:6.5, mass:9000, hp:3000, price:0, bus:true, colors:[0x1a5ac8, 0xd8402a] },
};
for (const k in T){ const t = T[k]; if (t.base) T[k] = Object.assign({}, T[t.base], t, { base:undefined }); T[k].key = k; }
V.TRAFFIC = ['compact', 'compact', 'sedan', 'sedan', 'sedan', 'taxi', 'suv', 'suv', 'pickup', 'van', 'muscle', 'sports', 'bus', 'super'];

// ---------------------------------------------------------------------
//  모델
// ---------------------------------------------------------------------
const MATS = {};
function paint(col){ const k = 'p' + col; if (MATS[k]) return MATS[k]; const m = new THREE.MeshPhysicalMaterial({ color:LC(col), metalness:.55, roughness:.32, clearcoat:1, clearcoatRoughness:.06, envMapIntensity:1.2 }); MATS[k] = m; return m; }
const M = {};
function mats(){ if (M.glass) return M;
  M.glass = new THREE.MeshPhysicalMaterial({ color:LC(0x1a2630), metalness:.85, roughness:.06, transparent:true, opacity:.9, clearcoat:1, envMapIntensity:1.1 });
  M.black = new THREE.MeshStandardMaterial({ color:0x0c0c0d, roughness:.65, metalness:.1 });
  M.trim = new THREE.MeshStandardMaterial({ color:0x18191b, roughness:.45, metalness:.4 });
  M.chrome = new THREE.MeshStandardMaterial({ color:0xd8dce0, roughness:.12, metalness:1 });
  M.tire = new THREE.MeshStandardMaterial({ color:0x111111, roughness:.85 });
  M.rim = new THREE.MeshStandardMaterial({ color:0xb8bcc0, roughness:.25, metalness:.9 });
  M.head = new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xfff4e0, emissiveIntensity:.3, roughness:.1, metalness:.4 });
  M.plate = new THREE.MeshStandardMaterial({ color:0xf0f0e8, roughness:.5 });
  M.burnt = new THREE.MeshStandardMaterial({ color:0x141210, roughness:.95, metalness:.2 });
  M.inner = new THREE.MeshStandardMaterial({ color:0x1e1e22, roughness:.9 });
  M.shadow = new THREE.MeshBasicMaterial({ map:(()=>{ const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 4, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })(), transparent:true, depthWrite:false });
  return M; }
// 옆모습 → 압출 (길이 = shape x, 높이 = shape y) → z 축이 앞이 되게 돌림
function extrude(pts, width, bevel){ const s = new THREE.Shape(); pts.forEach(([x, y], i)=>i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath();
  const b = bevel === undefined ? .05 : bevel; const g = new THREE.ExtrudeGeometry(s, { depth:width - b*2, bevelEnabled:b > 0, bevelThickness:b, bevelSize:b*.8, bevelSegments:2, curveSegments:6, steps:1 });
  g.translate(0, 0, -(width - b*2)/2); g.rotateY(-Math.PI/2); g.computeVertexNormals(); return g; }
// 위로 갈수록 좁아지게 (온실 경사)
function taper(g, y0, y1, k){ const p = g.attributes.position; for (let i = 0; i < p.count; i++){ const y = p.getY(i); const t = U.clamp((y - y0)/(y1 - y0), 0, 1); p.setX(i, p.getX(i)*(1 - k*t)); } g.computeVertexNormals(); return g; }
function arch(pts, cx, cy, r, front){ // 바퀴 아치 (바닥선에서 위로 반원)
  const n = 9; for (let i = 0; i <= n; i++){ const a = Math.PI - i/n*Math.PI; pts.push([cx + Math.cos(a)*r*(front ? -1 : -1)*-1, cy + Math.sin(a)*r]); } }
function buildModel(t, color){
  mats(); const g = new THREE.Group(); const L = t.len, Wd = t.wid, h0 = t.gc, belt = t.belt, roof = t.roof, r = t.wr; const hl = L/2;
  const body = paint(color); const parts = { body:[] };
  // ---- 차체 옆모습 ----
  const wf = t.wb/2, wrr = -t.wb/2; const ar = r + .07, ay = r + .02;
  const P = [];
  P.push([-hl, h0 + .12]); // 뒤 아래
  P.push([-hl, belt*.72]); P.push([-hl + .05, belt - .02]); P.push([-hl + .25, belt]); // 트렁크 끝
  P.push([hl - t.nose, belt]); // 후드 시작
  P.push([hl - .12, belt - .14*(t.nose)]); P.push([hl, belt*.66]); P.push([hl, h0 + .14]); P.push([hl - .1, h0]); // 앞
  // 바닥 + 바퀴 아치 (앞→뒤)
  P.push([wf + ar + .02, h0]); for (let i = 0; i <= 10; i++){ const a = i/10*Math.PI; P.push([wf + Math.cos(a)*ar, Math.max(h0, ay + Math.sin(a)*ar)]); } P.push([wf - ar - .02, h0]);
  P.push([wrr + ar + .02, h0]); for (let i = 0; i <= 10; i++){ const a = i/10*Math.PI; P.push([wrr + Math.cos(a)*ar, Math.max(h0, ay + Math.sin(a)*ar)]); } P.push([wrr - ar - .02, h0]);
  P.push([-hl + .1, h0]);
  const bodyG = extrude(P, Wd, .06); const bm = new THREE.Mesh(bodyG, body); g.add(bm); parts.body.push(bm);
  // 바닥 (어둡게)
  const under = new THREE.Mesh(new THREE.BoxGeometry(Wd*.9, .12, L*.92), M.black); under.position.y = h0 + .06; g.add(under);
  // 바퀴 안쪽 검정
  for (const z of [wf, wrr]) for (const s of [-1, 1]){ const w = new THREE.Mesh(new THREE.CylinderGeometry(ar, ar, .3, 12, 1, true, 0, Math.PI), M.black); w.rotation.z = Math.PI/2; w.rotation.y = Math.PI/2; w.position.set(s*(Wd/2 - .18), ay, z); w.rotation.set(0, 0, Math.PI/2); g.add(w); }
  // ---- 온실 (유리 + 기둥 + 지붕) ----
  const xr = t.cr*L, xrr = t.rr*L, xrf = t.rf*L, xf = t.cf*L; const tk = t.bus || t.key === 'van' ? .04 : .12;
  const C = [[xr, belt - .02], [xrr, roof], [xrf, roof], [xf, belt - .02]];
  const glassG = taper(extrude(C, Wd*.94, .03), belt, roof, tk); g.add(new THREE.Mesh(glassG, M.glass));
  // 지붕 판
  const rw = Wd*.94*(1 - tk) - .02; const roofG = new THREE.Mesh(new THREE.BoxGeometry(rw, .07, Math.max(.2, xrf - xrr + .04)), body); roofG.position.set(0, roof - .02, (xrr + xrf)/2); g.add(roofG); parts.body.push(roofG);
  // 기둥 (A · B · C)
  const pil = (x0, y0, x1, y1, th)=>{ for (const s of [-1, 1]){ const len = Math.hypot(x1 - x0, y1 - y0); const m = new THREE.Mesh(new THREE.BoxGeometry(.07, len, th || .1), body); const ty0 = U.clamp((y0 - belt)/(roof - belt), 0, 1), ty1 = U.clamp((y1 - belt)/(roof - belt), 0, 1); const wx0 = Wd*.47*(1 - tk*ty0), wx1 = Wd*.47*(1 - tk*ty1);
      m.position.set(s*(wx0 + wx1)/2, (y0 + y1)/2, (x0 + x1)/2); m.rotation.x = Math.atan2(x1 - x0, y1 - y0); m.rotation.z = s*Math.atan2(wx0 - wx1, len)*1; g.add(m); parts.body.push(m); } };
  pil(xf, belt, xrf, roof, .09); pil(xr, belt, xrr, roof, t.bus ? .1 : .16);
  if (xrf - xrr > 1.2) pil(U.lerp(xrr, xrf, .45), belt, U.lerp(xrr, xrf, .45), roof, .1);
  if (t.bus){ for (let k = 1; k < 6; k++){ const x = U.lerp(xr, xf, k/6); pil(x, belt, x, roof, .08); } }
  // 앞유리 아래 와이퍼 홈 · 범퍼
  const bumper = (z, d)=>{ const b = new THREE.Mesh(new THREE.BoxGeometry(Wd*.98, .2, .14), t.bus || t.key === 'pickup' || t.key === 'suv' ? M.trim : body); b.position.set(0, h0 + .22, z + d*.04); g.add(b); if (b.material === body) parts.body.push(b);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(Wd*.9, .06, .1), M.black); lip.position.set(0, h0 + .08, z); g.add(lip); };
  bumper(hl - .02, 1); bumper(-hl + .02, -1);
  // 그릴
  const gr = new THREE.Mesh(new THREE.BoxGeometry(Wd*.5, .16, .04), M.trim); gr.position.set(0, belt*.62, hl + .01); g.add(gr);
  // 번호판
  for (const s of [-1, 1]){ const pl = new THREE.Mesh(new THREE.BoxGeometry(.52, .12, .02), M.plate); pl.position.set(0, h0 + .36, s*(hl + .03)); g.add(pl); }
  // 전조등 · 후미등
  const tail = new THREE.MeshStandardMaterial({ color:0x6a0a0a, emissive:0xff1010, emissiveIntensity:.35, roughness:.2 }); parts.tail = tail;
  for (const s of [-1, 1]){
    const hd = new THREE.Mesh(new THREE.BoxGeometry(.38, .1, .05), M.head); hd.position.set(s*(Wd/2 - .3), belt*.74, hl + .005); g.add(hd);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(.36, .12, .05), tail); tl.position.set(s*(Wd/2 - .26), belt*.8, -hl - .005); g.add(tl);
    // 사이드미러
    if (!t.bus){ const mi = new THREE.Mesh(new THREE.BoxGeometry(.16, .1, .1), body); mi.position.set(s*(Wd/2 + .05), belt + .1, xf - .1); g.add(mi); parts.body.push(mi); }
    // 문 손잡이 · 문틈
    const dl = new THREE.Mesh(new THREE.BoxGeometry(.012, belt - h0 - .25, .012), M.black); dl.position.set(s*(Wd/2 + .002), (belt + h0 + .2)/2, xf - .1); if (!t.bus) g.add(dl);
    const dh = new THREE.Mesh(new THREE.BoxGeometry(.02, .03, .14), M.chrome); dh.position.set(s*(Wd/2 + .01), belt - .12, U.lerp(xr, xf, .5)); if (!t.bus) g.add(dh);
  }
  // 픽업 짐칸
  if (t.bed){ const bx = new THREE.Mesh(new THREE.BoxGeometry(Wd*.84, .05, -xr - (-hl) - .25), M.inner); bx.position.set(0, belt - .02, (xr + -hl)/2 + .05); g.add(bx); }
  // 배기구
  if (!t.bus){ const ex = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .14, 8), M.chrome); ex.rotation.x = Math.PI/2; ex.position.set(Wd*.3, h0 + .1, -hl - .03); g.add(ex); }
  // 택시 표시등 · 경찰 경광등
  if (t.taxi){ const sg = new THREE.Mesh(new THREE.BoxGeometry(.6, .18, .25), new THREE.MeshStandardMaterial({ color:0xfff3b0, emissive:0xffd840, emissiveIntensity:.6 })); sg.position.set(0, roof + .1, (xrr + xrf)/2); g.add(sg); parts.taxiSign = sg; }
  if (t.police){ const bar = new THREE.Group(); const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, .1, .28), M.trim); bar.add(base);
    const red = new THREE.MeshStandardMaterial({ color:0x500000, emissive:0xff0000, emissiveIntensity:0 }), blue = new THREE.MeshStandardMaterial({ color:0x000050, emissive:0x1040ff, emissiveIntensity:0 });
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(.5, .12, .24), red); l1.position.set(-.3, .1, 0); const l2 = new THREE.Mesh(new THREE.BoxGeometry(.5, .12, .24), blue); l2.position.set(.3, .1, 0); bar.add(l1, l2);
    bar.position.set(0, roof + .05, (xrr + xrf)/2); g.add(bar); parts.siren = [red, blue];
    // 흰 문짝 + 글씨
    const tx = G.world.tex.textTex('POLICE', '#f2f2f2', '#13244a', 512, 128); const dm = new THREE.MeshStandardMaterial({ map:tx, roughness:.35, metalness:.2 });
    for (const s of [-1, 1]){ const d = new THREE.Mesh(new THREE.PlaneGeometry(1.9, .42), dm); d.position.set(s*(Wd/2 + .012), (belt + h0)/2 + .12, (xr + xf)/2 + .1); d.rotation.y = s*Math.PI/2; g.add(d); } }
  if (t.bus){ const tx = G.world.tex.textTex('LUNA TRANSIT', '#1a5ac8', '#fff', 1024, 128); const dm = new THREE.MeshStandardMaterial({ map:tx, roughness:.4 }); for (const s of [-1, 1]){ const d = new THREE.Mesh(new THREE.PlaneGeometry(6, .5), dm); d.position.set(s*(Wd/2 + .012), .85, 0); d.rotation.y = s*Math.PI/2; g.add(d); } }
  // ---- 바퀴 ----
  parts.wheels = [];
  for (const [z, front] of [[wf, true], [wrr, false]]) for (const s of [-1, 1]){
    const wg = new THREE.Group(); const spin = new THREE.Group(); wg.add(spin);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .24, 18), M.tire); tire.rotation.z = Math.PI/2; spin.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r*.66, r*.66, .25, 12), M.rim); rim.rotation.z = Math.PI/2; spin.add(rim);
    for (let k = 0; k < 5; k++){ const sp = new THREE.Mesh(new THREE.BoxGeometry(.03, r*1.15, .07), M.rim); sp.position.x = s*.13; sp.rotation.x = k/5*Math.PI*2; spin.add(sp); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .27, 8), M.chrome); hub.rotation.z = Math.PI/2; spin.add(hub);
    wg.position.set(s*(Wd/2 - .16), r, z); g.add(wg); parts.wheels.push({ g:wg, spin, front, side:s, z });
  }
  // 그림자
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(Wd*1.35, L*1.12), M.shadow); sh.rotation.x = -Math.PI/2; sh.position.y = .03; sh.renderOrder = 1; g.add(sh); parts.shadow = sh;
  g.traverse(o=>{ if (o.isMesh && o !== sh){ o.castShadow = true; o.receiveShadow = false; } });
  g.userData.parts = parts;
  return g;
}

// ---------------------------------------------------------------------
//  차량 객체
// ---------------------------------------------------------------------
let NEXT = 1;
class Vehicle {
  constructor(type, x, z, h, color){
    const t = this.t = T[type]; this.type = type; this.id = NEXT++;
    this.color = color !== undefined ? color : U.pick(t.colors);
    this.g = buildModel(t, this.color); this.parts = this.g.userData.parts; G.scene.add(this.g);
    this.x = x; this.z = z; this.y = W.groundY(x, z); this.h = h || 0; this.vx = 0; this.vz = 0; this.vy = 0; this.w = 0; this.air = false; this.airT = 0;
    this.steer = 0; this.thr = 0; this.brk = 0; this.hb = false; this.rpm = 0; this.gear = 1; this.pitch = 0; this.roll = 0; this.susp = 0; this.suspV = 0;
    this.hp = t.hp; this.dead = false; this.burnT = 0; this.fireT = 0; this.driver = null; this.passengers = []; this.ai = null; this.siren = false; this.sirenT = 0; this.lights = false;
    this.r = t.wid/2 + .05; this.lastGY = this.y; this.vyG = 0; this.wheelRot = 0; this.dirt = 0; this.skidding = 0; this.lastSkid = null; this.locked = false; this.horn = 0;
    this.sync();
    V.list.push(this);
  }
  get speed(){ return Math.hypot(this.vx, this.vz); }
  get fwd(){ return this.vx*Math.sin(this.h) + this.vz*Math.cos(this.h); }
  // 입력 → 물리
  update(dt){
    const t = this.t; const s = Math.sin(this.h), c = Math.cos(this.h);
    let vF = this.vx*s + this.vz*c, vR = this.vx*c - this.vz*s;
    const ground = W.groundY(this.x, this.z);
    const water = W.inWater(this.x, this.z);
    if (this.dead){ this.thr = 0; this.hb = true; }
    // ---- 땅 따라가기 / 공중 ----
    if (!this.air){
      if (ground < this.y - .45 && Math.abs(vF) > 4){ this.air = true; this.vy = this.vyG; this.airT = 0; }
      else { const gy = ground; this.vyG = U.lerp(this.vyG, (gy - this.y)/Math.max(dt, .001), .5); this.y = U.damp(this.y, gy, 25, dt); }
    }
    if (this.air){ this.airT += dt; this.vy -= 22*dt; this.y += this.vy*dt; if (this.y <= ground){ const impact = -this.vy; this.y = ground; this.air = false; this.vy = 0; this.vyG = 0; this.suspV -= impact*.25; if (impact > 6) this.damage((impact - 6)*20, null, 'land'); G.emit('carLand', this, this.airT, impact); } }
    const onG = !this.air;
    // ---- 엔진 · 브레이크 ----
    const top = t.top*(this.hp < t.hp*.25 ? .6 : 1)*(water ? .1 : 1);
    if (onG && !water){
      const thr = this.thr;
      if (thr > 0){ if (vF < -.5) vF += 18*thr*dt; else vF += t.acc*thr*Math.max(0, 1 - vF/top)*dt*(this.hb ? .4 : 1); }
      else if (thr < 0){ if (vF > .5){ vF -= 20*(-thr)*dt; this.braking = true; } else vF -= t.acc*.6*(-thr)*Math.max(0, 1 + vF/(top*.3))*dt; }
      this.braking = thr < 0 && vF > .5;
      // 구름 저항 · 공기 저항
      vF -= vF*(.12 + Math.abs(vF)*.0035)*dt; if (Math.abs(vF) < .3 && thr === 0) vF *= Math.exp(-4*dt);
      if (this.hb){ vF -= Math.sign(vF)*Math.min(Math.abs(vF), 7*dt); }
      // 옆 미끄러짐 (그립)
      let grip = t.grip*(this.hb ? .16 : 1)*(1 - G.world.U.uWet.value*.25);
      if (this.dead) grip = 3;
      const before = vR; vR *= Math.exp(-grip*dt); const slip = Math.abs(before);
      this.skidding = (slip > 3.5 && Math.abs(vF) > 4) || (this.hb && Math.abs(vF) > 6) || (thr > .8 && vF > 0 && vF < 7 && t.acc > 13) ? 1 : 0;
      // 조향
      const sp = Math.abs(vF); const steerK = 1 - Math.min(sp/top, 1)*.62;
      const target = this.steer*.62*steerK; this.steerA = U.damp(this.steerA || 0, target, 8, dt);
      let yr = vF/t.wb*Math.tan(this.steerA);
      if (this.hb && sp > 4) yr *= 1.45;
      this.w = U.damp(this.w, yr, this.hb ? 3.5 : 9, dt);
    } else if (water){ vF *= Math.exp(-2*dt); vR *= Math.exp(-2*dt); this.w *= Math.exp(-2*dt); }
    else { this.w *= Math.exp(-.5*dt); }
    this.h += this.w*dt;
    const s2 = Math.sin(this.h), c2 = Math.cos(this.h);
    this.vx = s2*vF + c2*vR; this.vz = c2*vF - s2*vR;
    this.x += this.vx*dt; this.z += this.vz*dt;
    // ---- 충돌 ----
    this.collide(dt);
    // ---- 물 ----
    if (water){ this.inWaterT = (this.inWaterT || 0) + dt; this.y = Math.max(this.y - dt*.6, -2.4); if (this.inWaterT > 3 && !this.dead){ this.hp = 0; this.kill(true); } }
    // ---- 연출 ----
    const accF = (vF - (this.lastVF || 0))/Math.max(dt, .001); this.lastVF = vF;
    this.pitch = U.damp(this.pitch, onG ? U.clamp(-accF*.006, -.06, .06) : U.clamp(this.vy*.02, -.35, .25), onG ? 6 : 2, dt);
    this.roll = U.damp(this.roll, U.clamp(this.w*vF*.004, -.07, .07), 5, dt);
    this.suspV += (-this.susp*90 - this.suspV*9)*dt; this.susp += this.suspV*dt;
    this.wheelRot += vF*dt/t.wr;
    this.rpm = U.clamp(Math.abs(vF)/top, 0, 1);
    // 연기 · 불
    if (this.hp < t.hp*.35 && !this.dead && Math.random() < dt*12) G.fx.emit(this.hp < t.hp*.15 ? 'dark' : 'smoke', this.x + s2*t.len*.38, this.y + t.belt, this.z + c2*t.len*.38, 1, .4, 0, 1.5, 0);
    if (this.hp < t.hp*.12 && !this.dead){ this.fireT += dt; if (Math.random() < dt*20) G.fx.emit('fire', this.x + s2*t.len*.38, this.y + t.belt + .1, this.z + c2*t.len*.38, 1, .3, 0, 1, 0); if (this.fireT > 6) this.kill(); }
    if (this.dead){ this.burnT += dt; if (this.burnT < 25 && Math.random() < dt*10) G.fx.emit('dark', this.x, this.y + 1.2, this.z, 1, .6, 0, 2, 0, 1.4); if (this.burnT < 12 && Math.random() < dt*14) G.fx.emit('fire', this.x + (Math.random() - .5)*t.wid, this.y + .8, this.z + (Math.random() - .5)*t.len*.6, 1, .3, 0, 1.4, 0, 1.2); }
    // 타이어 자국 · 연기
    if (this.skidding && onG){ for (const wh of this.parts.wheels){ if (wh.front && !this.hb) continue; const wx = this.x + c2*wh.side*(t.wid/2 - .16) + s2*wh.z, wz = this.z - s2*wh.side*(t.wid/2 - .16) + c2*wh.z;
        const k = wh.side + (wh.front ? 'f' : 'r'); const lp = this.lastSkid && this.lastSkid[k]; if (lp) G.fx.skid(lp[0], lp[1], wx, wz, this.y); (this.lastSkid = this.lastSkid || {})[k] = [wx, wz]; if (Math.random() < dt*25) G.fx.emit('tire', wx, this.y + .2, wz, 1, .5, 0, .6, 0); } }
    else this.lastSkid = null;
    if (this.siren){ this.sirenT += dt; }
    this.sync();
  }
  collide(dt){
    const t = this.t; const s = Math.sin(this.h), c = Math.cos(this.h); const n = Math.max(2, Math.round(t.len/1.8)); const r = t.wid/2;
    for (let k = 0; k < n; k++){ const f = (k/(n - 1) - .5)*(t.len - t.wid); const px = this.x + s*f, pz = this.z + c*f;
      const hit = W.pushCircle(px, pz, r, this.y);
      if (hit){ const len = Math.hypot(hit.x, hit.z) || 1, nx = hit.x/len, nz = hit.z/len; this.x += hit.x; this.z += hit.z;
        const vn = this.vx*nx + this.vz*nz; if (vn < 0){ const imp = -vn; this.vx -= nx*vn*1.35; this.vz -= nz*vn*1.35; this.vx *= .8; this.vz *= .8; this.w += (Math.random() - .5)*imp*.05 + f*imp*.02*Math.sign(nx*c - nz*s);
          if (imp > 4){ this.damage(imp*imp*.8, null, 'crash'); G.fx.emit('spark', px + nx*-r, this.y + .5, pz + nz*-r, Math.min(20, imp*2 | 0), 3); G.emit('carCrash', this, imp, px - nx*r, pz - nz*r); } } }
      const hp = W.pushPosts(px, pz, r);
      if (hp){ const sp = this.speed; if (sp > 7 && G.world.knockPost(hp.post, this.vx/sp, this.vz/sp)){ this.vx *= .82; this.vz *= .82; this.damage(30, null, 'post'); G.emit('carCrash', this, 5, hp.post.x, hp.post.z); }
        else { const len = Math.hypot(hp.x, hp.z) || 1, nx = hp.x/len, nz = hp.z/len; this.x += hp.x; this.z += hp.z; const vn = this.vx*nx + this.vz*nz; if (vn < 0){ this.vx -= nx*vn*1.3; this.vz -= nz*vn*1.3; if (-vn > 4){ this.damage(vn*vn*.6, null, 'crash'); G.emit('carCrash', this, -vn, hp.post.x, hp.post.z); } } } }
    }
  }
  damage(amt, by, kind){ if (this.dead || this.god) return; this.hp -= amt; this.lastHitBy = by || this.lastHitBy; if (this.hp <= 0){ this.hp = 0; this.kill(); } }
  kill(silent){ if (this.dead) return; this.dead = true; this.hp = 0; this.burnT = 0; this.siren = false;
    if (!silent){ G.fx.explode(this.x, this.y + .6, this.z, 1.3); this.vy = 7; this.air = true; this.w += (Math.random() - .5)*3; }
    this.g.traverse(o=>{ if (o.isMesh && o.material !== M.shadow && o.material !== M.glass){ if (o.material && o.material.isMeshPhysicalMaterial || o.material === M.rim || o.material === M.chrome) o.material = M.burnt; } if (o.isMesh && o.material === M.glass) o.visible = false; });
    this.parts.tail.emissiveIntensity = 0; G.emit('carDead', this); }
  // 위치 → 모델
  sync(){ const g = this.g; g.position.set(this.x, this.y + this.susp, this.z); g.rotation.set(0, this.h, 0); g.rotateX(this.pitch); g.rotateZ(this.roll);
    const night = G.env.night > .4 || G.env.w.rain > .5;
    this.parts.tail.emissiveIntensity = this.dead ? 0 : this.braking ? 3 : (night || this.lights ? 1 : .15);
    for (const wh of this.parts.wheels){ wh.spin.rotation.x = this.wheelRot; if (wh.front) wh.g.rotation.y = this.steerA || 0; }
    if (this.parts.siren){ const on = this.siren && !this.dead; const ph = Math.floor(this.sirenT*6)%2; this.parts.siren[0].emissiveIntensity = on && ph ? 4 : 0; this.parts.siren[1].emissiveIntensity = on && !ph ? 4 : 0; }
    this.parts.shadow.visible = !this.air || this.y - W.groundY(this.x, this.z) < 3; }
  remove(){ G.scene.remove(this.g); const i = V.list.indexOf(this); if (i >= 0) V.list.splice(i, 1); this.removed = true;
    this.g.traverse(o=>{ if (o.isMesh){ o.geometry.dispose(); if (o.material === this.parts.tail) o.material.dispose(); } }); }
  // 문 위치 (운전석 = 왼쪽)
  door(side){ const t = this.t; const s = Math.sin(this.h), c = Math.cos(this.h); const off = (side || -1)*(t.wid/2 + .6); const f = t.cf*t.len - .5; return { x:this.x + c*off + s*f, z:this.z - s*off + c*f }; }
  seat(){ const t = this.t; const s = Math.sin(this.h), c = Math.cos(this.h); const off = t.bus ? 0 : -.38; const f = (t.cr + t.cf)/2*t.len + (t.bus ? t.len*.4 : .1); return new THREE.Vector3(this.x + c*off + s*f, this.y + t.gc + (t.bus ? .9 : .32), this.z - s*off + c*f); }
}
V.Vehicle = Vehicle;
V.spawn = (type, x, z, h, color)=>new Vehicle(type, x, z, h, color);

// 차 ↔ 차 충돌
V.collidePairs = dt=>{
  const L = V.list;
  for (let a = 0; a < L.length; a++){ const A = L[a]; for (let b = a + 1; b < L.length; b++){ const B = L[b];
    const dx = B.x - A.x, dz = B.z - A.z; const lim = (A.t.len + B.t.len)/2 + .5; if (dx*dx + dz*dz > lim*lim) continue;
    // 원 여러 개로 근사
    const ca = circles(A), cb = circles(B); let best = null;
    for (const p of ca) for (const q of cb){ const ex = q[0] - p[0], ez = q[1] - p[1], d = Math.hypot(ex, ez), m = p[2] + q[2]; if (d < m && (!best || m - d > best.pen)) best = { pen:m - d, nx:ex/(d || 1), nz:ez/(d || 1), x:(p[0] + q[0])/2, z:(p[1] + q[1])/2 }; }
    if (!best) continue;
    const ma = A.t.mass, mb = B.t.mass, tot = ma + mb;
    A.x -= best.nx*best.pen*mb/tot; A.z -= best.nz*best.pen*mb/tot; B.x += best.nx*best.pen*ma/tot; B.z += best.nz*best.pen*ma/tot;
    const rv = (B.vx - A.vx)*best.nx + (B.vz - A.vz)*best.nz;
    if (rv < 0){ const j = -(1.3)*rv/(1/ma + 1/mb); A.vx -= j*best.nx/ma; A.vz -= j*best.nz/ma; B.vx += j*best.nx/mb; B.vz += j*best.nz/mb;
      A.w += (Math.random() - .5)*-rv*.06; B.w += (Math.random() - .5)*-rv*.06;
      const imp = -rv; if (imp > 3){ A.damage(imp*imp*.7*mb/tot*2, B.driver, 'car'); B.damage(imp*imp*.7*ma/tot*2, A.driver, 'car'); G.fx.emit('spark', best.x, A.y + .6, best.z, Math.min(25, imp*2 | 0), 3); G.emit('carHit', A, B, imp, best.x, best.z); }
      if (A.ai) A.ai.bumped = 2; if (B.ai) B.ai.bumped = 2; } } }
};
function circles(v){ const t = v.t, s = Math.sin(v.h), c = Math.cos(v.h), n = Math.max(2, Math.round(t.len/1.8)), r = t.wid/2, out = []; for (let k = 0; k < n; k++){ const f = (k/(n - 1) - .5)*(t.len - t.wid); out.push([v.x + s*f, v.z + c*f, r]); } return out; }
V.circles = circles;

// ---------------------------------------------------------------------
//  교통 AI
// ---------------------------------------------------------------------
const NA = n=>G.world.nodeAt[n[0] + ',' + n[1]];
// 차선 위치: from 노드 → to 노드, 오른쪽으로 off
function laneP(from, to, f, off){ const dx = Math.sign(to.x - from.x), dz = Math.sign(to.z - from.z); const rx = -dz, rz = dx; // 진행 방향의 오른쪽 (x 동, z 남 기준: 동쪽 진행 → 오른쪽 = 남(+z))
  return { x:from.x + dx*f + rx*off, z:from.z + dz*f + rz*off }; }
// 오른쪽: 진행 (dx,dz) → 오른쪽 = (-dz, dx) 가 맞는지: 동쪽(1,0) → (0,1) = 남쪽. 우측통행이면 동쪽으로 갈 때 남쪽 차선. OK
V.newAI = (veh, from, to, lane)=>{ veh.ai = { from, to, lane:lane || (Math.random() < .5 ? 1.75 : 5.25), path:null, pi:0, cruise:U.rnd(11, 15)*(veh.t.bus ? .7 : 1), stopT:0, bumped:0, honk:0, mode:'drive', stuck:0 }; planEdge(veh); };
function planEdge(v){ const a = v.ai; const from = a.from, to = a.to; const L = Math.hypot(to.x - from.x, to.z - from.z);
  // 현재 차선 끝(정지선)까지
  const pts = []; const d0 = Math.max(0, projF(v, from, to)); for (let f = d0 + 6; f < L - W.RW - 2; f += 8) pts.push(laneP(from, to, f, a.lane)); pts.push(laneP(from, to, L - W.RW - 1.5, a.lane));
  a.path = pts; a.pi = 0; a.phase = 'edge'; a.stopP = laneP(from, to, L - W.RW - 2.5, a.lane); }
function projF(v, from, to){ const dx = Math.sign(to.x - from.x), dz = Math.sign(to.z - from.z); return (v.x - from.x)*dx + (v.z - from.z)*dz; }
function planTurn(v){ const a = v.ai; const node = a.to; let opts = node.nb.map(NA).filter(n=>n && n !== a.from); if (!opts.length) opts = [a.from];
  const next = U.pick(opts); const d1x = Math.sign(node.x - a.from.x), d1z = Math.sign(node.z - a.from.z), d2x = Math.sign(next.x - node.x), d2z = Math.sign(next.z - node.z);
  const cross = d1x*d2z - d1z*d2x; let lane = a.lane; if (cross > 0) lane = 5.25; else if (cross < 0) lane = 1.75; // 우회전은 바깥, 좌회전은 안쪽
  if (next === a.from) lane = 1.75;
  const p0 = laneP(a.from, node, Math.hypot(node.x - a.from.x, node.z - a.from.z) - W.RW - 1.5, a.lane), p2 = laneP(node, next, W.RW + 1.5, lane);
  // 두 선의 교차점을 제어점으로
  let ctl; if (d1x !== 0) ctl = d2x === 0 ? { x:p2.x, z:p0.z } : { x:(p0.x + p2.x)/2, z:(p0.z + p2.z)/2 }; else ctl = d2z === 0 ? { x:p0.x, z:p2.z } : { x:(p0.x + p2.x)/2, z:(p0.z + p2.z)/2 };
  const pts = []; for (let k = 1; k <= 6; k++){ const t = k/6, u = 1 - t; pts.push({ x:u*u*p0.x + 2*u*t*ctl.x + t*t*p2.x, z:u*u*p0.z + 2*u*t*ctl.z + t*t*p2.z }); }
  a.path = pts; a.pi = 0; a.phase = 'turn'; a.next = next; a.nextLane = lane; a.turnSharp = cross !== 0; }
const _ahead = [];
V.updateAI = (v, dt, now)=>{
  const a = v.ai; if (!a || v.dead || v.driver === 'player') return;
  if (!v.driver){ v.thr = 0; v.hb = true; v.steer = 0; return; }
  if (a.mode === 'flee'){ fleeDrive(v, dt); return; }
  if (a.mode === 'police') return; // 경찰 AI 는 따로
  // 목표점
  if (!a.path || a.pi >= a.path.length){ if (a.phase === 'edge') planTurn(v); else { a.from = a.to; a.to = a.next; a.lane = a.nextLane; planEdge(v); } }
  let tgt = a.path[a.pi]; const dxT = tgt.x - v.x, dzT = tgt.z - v.z; if (dxT*dxT + dzT*dzT < (a.phase === 'turn' ? 9 : 16)){ a.pi++; if (a.pi >= a.path.length) return; tgt = a.path[a.pi]; }
  const want = Math.atan2(tgt.x - v.x, tgt.z - v.z); const err = U.angDiff(v.h, want);
  v.steer = U.clamp(err*2.2, -1, 1);
  // 속도: 순항 / 회전 / 신호 / 앞차
  let target = a.cruise; if (a.phase === 'turn' && a.turnSharp) target = 7;
  if (a.phase === 'edge'){ const sig = W.canGo(a.to, Math.abs(a.to.x - a.from.x) > 1 ? 'x' : 'z', now); const ds = Math.hypot(a.stopP.x - v.x, a.stopP.z - v.z);
    if (sig === 0 || (sig === 1 && ds > 12)){ if (ds < 40 && a.pi >= a.path.length - 3) target = Math.min(target, Math.max(0, (ds - 1)*.6)); } }
  // 앞 장애물 (차 · 사람 · 플레이어)
  const s = Math.sin(v.h), c = Math.cos(v.h); let block = 99;
  for (const o of V.list){ if (o === v) continue; const ox = o.x - v.x, oz = o.z - v.z; const f = ox*s + oz*c; if (f < 0 || f > 30) continue; const lat = Math.abs(ox*c - oz*s); if (lat < 2.4) block = Math.min(block, f - (o.t.len + v.t.len)/2); }
  if (G.peds) for (const p of G.peds.near(v.x + s*8, v.z + c*8, 10)){ const ox = p.x - v.x, oz = p.z - v.z; const f = ox*s + oz*c; if (f < 0 || f > 16) continue; if (Math.abs(ox*c - oz*s) < 1.8) block = Math.min(block, f - v.t.len/2 - 1); }
  if (block < 99) target = Math.min(target, Math.max(0, (block - 3)*.9));
  const sp = v.fwd;
  if (sp < target - .5) v.thr = U.clamp((target - sp)*.4, .2, 1); else if (sp > target + .5) v.thr = -U.clamp((sp - target)*.3, .1, 1); else v.thr = 0;
  v.hb = target < .5 && sp < 1;
  // 막힘
  if (block < 6 && sp < .5){ a.stuck += dt; if (a.stuck > 3 && Math.random() < dt*.5){ G.emit('horn', v); } if (a.stuck > 12 && block < 4){ a.stuck = 0; } } else a.stuck = Math.max(0, a.stuck - dt);
};
// 도망 운전 (총격 · 강도 후)
function fleeDrive(v, dt){ const a = v.ai; a.fleeT = (a.fleeT || 0) + dt; if (a.fleeT > 25){ a.mode = 'drive'; a.fleeT = 0; reattach(v); return; }
  const P = G.player; const ax = v.x - P.x, az = v.z - P.z; let want = Math.atan2(ax, az);
  // 건물 피하기: 앞쪽 레이
  const s = Math.sin(v.h), c = Math.cos(v.h); const hit = W.raycast(new THREE.Vector3(v.x, 1, v.z), new THREE.Vector3(s, 0, c), 18); if (hit) want = v.h + (Math.random() < .5 ? 1 : -1)*1.2;
  v.steer = U.clamp(U.angDiff(v.h, want)*2, -1, 1); v.thr = 1; v.hb = false; }
// 가장 가까운 도로에 다시 붙이기
function reattach(v){ let best = null, bd = 1e9; for (const n of W.nodes){ const d = (n.x - v.x)**2 + (n.z - v.z)**2; if (d < bd){ bd = d; best = n; } } if (!best) return; const nb = NA(U.pick(best.nb)); if (nb) V.newAI(v, nb, best); }
V.reattach = reattach;

// ---------------------------------------------------------------------
//  교통 생성 · 제거
// ---------------------------------------------------------------------
V.trafficMax = G.LOW ? 14 : 26;
V.manage = (dt, px, pz, camDir)=>{
  // 멀어진 차 지우기
  for (let i = V.list.length - 1; i >= 0; i--){ const v = V.list[i]; if (v.keep || v.driver === 'player' || v === G.player.lastCar || v.mission) continue; const d = Math.hypot(v.x - px, v.z - pz);
    if (d > 330 || (v.dead && d > 120 && v.burnT > 20)){ if (v.driver && v.driver !== 'player' && v.driver.remove) v.driver.remove(); v.remove(); } }
  const traffic = V.list.filter(v=>v.ai && !v.parked).length;
  if (traffic < V.trafficMax && Math.random() < dt*6) spawnTraffic(px, pz, camDir);
  const parked = V.list.filter(v=>v.parked).length;
  if (parked < (G.LOW ? 8 : 16) && Math.random() < dt*3) spawnParked(px, pz);
};
function spawnTraffic(px, pz, camDir){
  // 화면 뒤쪽 또는 멀리 있는 도로 위
  for (let tries = 0; tries < 8; tries++){
    const n = W.nodes[Math.floor(Math.random()*W.nodes.length)]; const d = Math.hypot(n.x - px, n.z - pz); if (d < 90 || d > 260) continue;
    const to = NA(U.pick(n.nb)); if (!to) continue; const L = Math.hypot(to.x - n.x, to.z - n.z);
    const lane = Math.random() < .5 ? 1.75 : 5.25; const f = W.RW + 4 + Math.random()*(L - 2*W.RW - 20); const p = laneP(n, to, f, lane);
    const dd = Math.hypot(p.x - px, p.z - pz); if (dd < 80) continue;
    const vis = camDir ? ((p.x - px)*camDir.x + (p.z - pz)*camDir.z)/dd : -1; if (vis > .3 && dd < 160) continue; // 바로 보이는 곳엔 안 만듦
    if (V.list.some(o=>Math.hypot(o.x - p.x, o.z - p.z) < 9)) continue;
    let type = U.pick(V.TRAFFIC); if (Math.random() < .07) type = 'police';
    const v = new Vehicle(type, p.x, p.z, Math.atan2(to.x - n.x, to.z - n.z));
    const ped = G.peds.spawnDriver(v, type === 'police'); v.driver = ped; V.newAI(v, n, to, lane); if (type === 'police') v.isCop = true; v.vx = Math.sin(v.h)*8; v.vz = Math.cos(v.h)*8;
    return v; } }
function spawnParked(px, pz){ const S = W.parkSpots; for (let tries = 0; tries < 6; tries++){ const s = S[Math.floor(Math.random()*S.length)]; if (!s) return; const d = Math.hypot(s.x - px, s.z - pz); if (d < 70 || d > 200) continue; if (V.list.some(o=>Math.hypot(o.x - s.x, o.z - s.z) < 5)) continue;
  const v = new Vehicle(U.pick(['compact', 'sedan', 'suv', 'sports', 'muscle', 'pickup', 'sedan', 'super']), s.x, s.z, s.ry + (Math.random() < .5 ? Math.PI : 0)); v.parked = true; v.ai = null; v.y = W.groundY(s.x, s.z); return v; } }
V.nearest = (x, z, maxD, filter)=>{ let best = null, bd = maxD*maxD; for (const v of V.list){ if (filter && !filter(v)) continue; const d = (v.x - x)**2 + (v.z - z)**2; if (d < bd){ bd = d; best = v; } } return best; };
})();
