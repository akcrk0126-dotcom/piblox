// =====================================================================
//  이펙트: 파티클(연기·불·불꽃·피·물) · 탄흔 · 스키드 마크 · 폭발
// =====================================================================
'use strict';
(function(){
const U = G.U;
const F = G.fx = {};
const MAX = 5000;
let geo, pts, P = [], free = [];
const pos = new Float32Array(MAX*3), col = new Float32Array(MAX*4), size = new Float32Array(MAX);
F.init = ()=>{
  geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 4)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  for (let i = 0; i < MAX; i++){ free.push(MAX - 1 - i); size[i] = 0; }
  const tex = (()=>{ const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const mk = blend=>new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:blend, uniforms:{ map:{ value:tex }, scale:{ value:innerHeight }, add:{ value:blend === THREE.AdditiveBlending ? 1 : 0 } },
    vertexShader:'attribute float size; attribute vec4 color; varying vec4 vC; uniform float scale, add; void main(){ vC = color; if ((color.a < 0. ? 1. : 0.) != add) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; } vec4 mv = modelViewMatrix*vec4(position, 1.); gl_PointSize = size*scale/max(.1, -mv.z); gl_Position = projectionMatrix*mv; }',
    fragmentShader:'uniform sampler2D map; varying vec4 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb, abs(vC.a)*t.a); }' });
  pts = new THREE.Points(geo, mk(THREE.NormalBlending)); pts.frustumCulled = false; pts.renderOrder = 5; G.scene.add(pts);
  const pts2 = new THREE.Points(geo, mk(THREE.AdditiveBlending)); pts2.frustumCulled = false; pts2.renderOrder = 6; G.scene.add(pts2);
  addEventListener('resize', ()=>{ pts.material.uniforms.scale.value = pts2.material.uniforms.scale.value = innerHeight; });
  initDecals(); initSkids();
};
// type: smoke · fire · spark · blood · dust · water · flash · debris
const DEF = {
  smoke:{ c:[.35, .35, .36], a:.5, s0:.6, s1:3.2, life:2.2, g:-.8, drag:1.2, add:false },
  dark:{ c:[.08, .08, .08], a:.7, s0:1, s1:5, life:3, g:-1.5, drag:.8, add:false },
  fire:{ c:[1, .5, .12], a:.9, s0:1.2, s1:.3, life:.7, g:-3, drag:1.5, add:true },
  spark:{ c:[1, .8, .35], a:1, s0:.12, s1:.04, life:.45, g:9, drag:.3, add:true },
  blood:{ c:[.45, .02, .02], a:.9, s0:.14, s1:.22, life:.6, g:9, drag:.5, add:false },
  dust:{ c:[.55, .5, .44], a:.35, s0:.4, s1:1.6, life:1, g:-.2, drag:2, add:false },
  water:{ c:[.75, .85, .95], a:.6, s0:.15, s1:.4, life:1.1, g:9, drag:.2, add:false },
  flash:{ c:[1, .85, .5], a:1, s0:.6, s1:.2, life:.06, g:0, drag:0, add:true },
  tire:{ c:[.7, .7, .72], a:.35, s0:.5, s1:2.4, life:1.4, g:-.3, drag:1.5, add:false },
};
F.emit = (type, x, y, z, n, spread, vx, vy, vz, sizeK)=>{ const d = DEF[type]; n = n || 1; spread = spread === undefined ? 1 : spread;
  for (let k = 0; k < n; k++){ const i = free.pop(); if (i === undefined) return;
    P.push({ i, d, x, y, z, vx:(vx || 0) + (Math.random() - .5)*spread*2, vy:(vy || 0) + (Math.random() - .5)*spread*2 + (type === 'spark' || type === 'blood' || type === 'water' ? Math.random()*spread*2 : 0), vz:(vz || 0) + (Math.random() - .5)*spread*2, t:0, life:d.life*(.7 + Math.random()*.6), sk:(sizeK || 1)*(.7 + Math.random()*.6) }); } };
F.update = dt=>{
  for (let k = P.length - 1; k >= 0; k--){ const p = P[k]; p.t += dt; const i = p.i;
    if (p.t >= p.life){ size[i] = 0; col[i*4 + 3] = 0; free.push(i); P[k] = P[P.length - 1]; P.pop(); continue; }
    const d = p.d, f = p.t/p.life; p.vy -= d.g*dt; const dr = Math.exp(-d.drag*dt); p.vx *= dr; p.vy *= d.g > 0 ? 1 : dr; p.vz *= dr; p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt;
    if (p.y < 0 && d.g > 0){ p.y = 0; p.vy *= -.2; p.vx *= .5; p.vz *= .5; }
    pos[i*3] = p.x; pos[i*3 + 1] = p.y; pos[i*3 + 2] = p.z; size[i] = U.lerp(d.s0, d.s1, f)*p.sk;
    let c = d.c; if (d === DEF.fire){ c = [1, .55 - f*.4, .15 - f*.1]; }
    const a = d.a*(f < .1 ? f/.1 : 1 - (f - .1)/.9); col[i*4] = c[0]; col[i*4 + 1] = c[1]; col[i*4 + 2] = c[2]; col[i*4 + 3] = d.add ? -Math.max(a, .001) : a; }
  geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = geo.attributes.size.needsUpdate = true;
  updateLights(dt);
};

// ----- 순간 빛 (총구 · 폭발) -----
const LIGHTS = []; let lightPool = [];
function updateLights(dt){ for (const L of LIGHTS){ if (L.t > 0){ L.t -= dt; L.l.intensity = L.i*Math.max(0, L.t/L.d); if (L.t <= 0) L.l.visible = false; } } }
F.flash = (x, y, z, color, intensity, dist, dur)=>{ if (!lightPool.length){ for (let i = 0; i < 4; i++){ const l = new THREE.PointLight(0xffaa55, 0, 20, 2); l.visible = false; G.scene.add(l); LIGHTS.push({ l, t:0, d:1, i:0 }); } lightPool = LIGHTS; }
  let L = LIGHTS.find(q=>q.t <= 0) || LIGHTS[0]; L.l.position.set(x, y, z); L.l.color.set(color); L.l.distance = dist; L.i = intensity; L.l.intensity = intensity; L.t = L.d = dur; L.l.visible = true; };

// ----- 탄흔 -----
let decal, decalI = 0; const DN = 300;
function initDecals(){ const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(10,10,10,1)'); g.addColorStop(.35, 'rgba(30,28,26,.9)'); g.addColorStop(1, 'rgba(60,55,50,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  decal = new THREE.InstancedMesh(new THREE.PlaneGeometry(.22, .22), new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(c), transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-4 }), DN);
  const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < DN; i++) decal.setMatrixAt(i, z); decal.frustumCulled = false; G.scene.add(decal); }
const _o = new THREE.Object3D();
F.bulletHole = (p, n)=>{ _o.position.copy(p).addScaledVector(n, .01); _o.lookAt(p.x + n.x, p.y + n.y, p.z + n.z); _o.rotateZ(Math.random()*6); _o.scale.setScalar(.7 + Math.random()*.6); _o.updateMatrix(); decal.setMatrixAt(decalI, _o.matrix); decal.instanceMatrix.needsUpdate = true; decalI = (decalI + 1)%DN; };

// ----- 스키드 마크 -----
let skid, skidI = 0; const SN = 1200;
function initSkids(){ skid = new THREE.InstancedMesh(new THREE.PlaneGeometry(.26, 1).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({ color:0x0a0a0a, transparent:true, opacity:.55, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-3 }), SN);
  const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < SN; i++) skid.setMatrixAt(i, z); skid.frustumCulled = false; G.scene.add(skid); }
F.skid = (x0, z0, x1, z1, y)=>{ const L = Math.hypot(x1 - x0, z1 - z0); if (L < .05 || L > 4) return; _o.position.set((x0 + x1)/2, y + .025, (z0 + z1)/2); _o.rotation.set(0, Math.atan2(x1 - x0, z1 - z0), 0); _o.scale.set(1, 1, L); _o.updateMatrix(); skid.setMatrixAt(skidI, _o.matrix); skid.instanceMatrix.needsUpdate = true; skidI = (skidI + 1)%SN; };

// ----- 폭발 -----
F.explode = (x, y, z, power)=>{ power = power || 1;
  F.emit('fire', x, y + .5, z, 40*power, 4*power, 0, 3, 0, 2.5*power); F.emit('dark', x, y + 1, z, 25*power, 3*power, 0, 2, 0, 1.5); F.emit('spark', x, y + .5, z, 50, 9, 0, 6, 0); F.emit('smoke', x, y + 1, z, 20, 2, 0, 1.5, 0, 2);
  F.flash(x, y + 2, z, 0xff8a3a, 30*power, 40*power, .6);
  G.emit('explosion', x, y, z, power); };
})();
