// =====================================================================
//  사람: 모델 · 옷(셰이더로 그림) · 애니메이션
//  몸은 Quaternius Universal Base Characters (CC0), 동작은 Universal Animation Library (CC0)
// =====================================================================
'use strict';
(function(){
const U = G.U;
const H = G.human = {};
let ANIM = {}, BONESET = new Set(), BASE = {};

H.prep = ()=>{
  for (const c of G.A.anims){ c.tracks = c.tracks.filter(t=>!/^root\.position/.test(t.name)); ANIM[c.name] = c; }
  // 제자리에서 걷도록 골반의 앞뒤 이동을 없앤다
  for (const c of G.A.anims) for (const t of c.tracks){ if (t.name === 'pelvis.position'){ const v = t.values; for (let i = 0; i < v.length; i += 3){ v[i + 2] = v[2]; } } }
  G.A.animScene.traverse(o=>{ if (o.name) BONESET.add(o.name); });
  for (const sex of ['Male', 'Female']) BASE[sex] = calib(sex);
};
function fixName(n){ if (BONESET.has(n)) return n; const m = n.match(/^(.*)_\d+$/); return m && BONESET.has(m[1]) ? m[1] : n; }

// 기본 몸의 뼈 위치(바인드 포즈)로 옷 경계를 잡는다
function calib(sex){
  const src = G.A.chars.getObjectByName('B_' + sex); const r = THREE.SkeletonUtils.clone(src); r.traverse(o=>{ if (o !== r) o.name = fixName(o.name); }); r.position.set(0, 0, 0); r.updateMatrixWorld(true);
  const P = n=>{ const o = r.getObjectByName(n); return o ? o.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(); };
  let body = null; r.traverse(o=>{ if (o.isSkinnedMesh && /Superhero/i.test(o.material.name)) body = o; });
  // 바인드 포즈의 정점 = (뼈 world × 역바인드) × bindMatrix × position  — 바인드 포즈에서는 모든 뼈가 같은 값
  const sk = body.skeleton; sk.bones[0].updateMatrixWorld(true);
  const dq = new THREE.Matrix4().multiplyMatrices(sk.bones[0].matrixWorld, sk.boneInverses[0]).multiply(body.bindMatrix);
  const c = { sex, dq, foot:P('foot_l').y, ball:P('ball_l'), knee:P('calf_l').y, pelvis:P('pelvis').y, neck:P('neck_01').y, head:P('Head').y,
    sh:Math.abs(P('upperarm_l').x), el:Math.abs(P('lowerarm_l').x), wr:Math.abs(P('hand_l').x), armY:P('upperarm_l').y, chest:P('spine_03').y };
  return c;
}

// ----- 옷 셰이더 -----
// look: { sex, skin, hair, hairCol, beard, top:'tee'|'long'|'tank'|'jacket'|'suit'|'dress'|'hoodie'|'uniform'|'vest', shirt, shirt2, pants, legs:'long'|'shorts'|'skirt', shoe, print }
const STYLE = { tee:0, long:1, tank:2, jacket:3, suit:4, dress:5, hoodie:6, uniform:7, vest:8 };
const LC = h=>new THREE.Color(h).convertSRGBToLinear();
function clothMaterial(src, look, cal){
  const m = new THREE.MeshStandardMaterial({ map:src.map, color:new THREE.Color(look.skin || 0xffffff), roughness:.62, metalness:0 });
  m.skinning = true;
  const st = STYLE[look.top] || 0;
  const sleeve = ({ tee:.36, long:.97, tank:-.05, jacket:.97, suit:.97, dress:.2, hoodie:.97, uniform:.4, vest:-.05 })[look.top || 'tee'];
  const legEnd = look.legs === 'shorts' ? cal.knee + .1 : look.legs === 'skirt' ? cal.knee + .06 : cal.foot + .045;
  const u = m.userData.U = {
    uDQ:{ value:cal.dq }, cShirt:{ value:LC(look.shirt) }, cShirt2:{ value:LC(look.shirt2 || look.shirt) }, cPants:{ value:LC(look.pants) }, cShoe:{ value:LC(look.shoe || 0x222222) },
    uY:{ value:new THREE.Vector4(cal.foot + .045, legEnd, cal.pelvis + .075, cal.neck - .035) }, // 신발 끝, 바지 끝, 허리, 목
    uX:{ value:new THREE.Vector4(cal.sh + .015, cal.sh + (cal.wr - cal.sh)*sleeve, cal.wr - .02, cal.chest) },
    uSt:{ value:st }, uLeg:{ value:look.legs === 'skirt' ? 1 : 0 }, uPrint:{ value:look.print || 0 }, uBlood:{ value:0 } };
  m.onBeforeCompile = sh=>{
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'uniform mat4 uDQ; uniform vec4 uY, uX; uniform float uSt; varying vec3 vBP;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vBP = (uDQ * vec4(position, 1.0)).xyz;
      { float ax = abs(vBP.x); float y = vBP.y; float inf = 0.;
        if (ax < uX.x && y > uY.y && y < uY.w) inf = y < uY.z ? .010 : (uSt > 2.5 && uSt < 4.5 || uSt > 5.5 && uSt < 6.5 ? .016 : .008);
        if (ax >= uX.x && ax < uX.y && y > uY.z) inf = uSt > 2.5 && uSt < 4.5 || uSt > 5.5 && uSt < 6.5 ? .014 : .007;
        if (y < uY.x && ax < uX.x) inf = .006;
        transformed += normalize(objectNormal) * inf / max(length(uDQ[0].xyz), 1e-6); }`);
    sh.fragmentShader = `uniform vec3 cShirt, cShirt2, cPants, cShoe; uniform vec4 uY, uX; uniform float uSt, uLeg, uPrint, uBlood; varying vec3 vBP;
      float hh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719)))*43758.5453); }
      float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f); float a = mix(mix(hh(i), hh(i + vec3(1,0,0)), f.x), mix(hh(i + vec3(0,1,0)), hh(i + vec3(1,1,0)), f.x), f.y); float b = mix(mix(hh(i + vec3(0,0,1)), hh(i + vec3(1,0,1)), f.x), mix(hh(i + vec3(0,1,1)), hh(i + vec3(1,1,1)), f.x), f.y); return mix(a, b, f.z); }
      ` + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        float cloth = 0.; float shoeK = 0.;
        { vec3 p = vBP; float ax = abs(p.x); float y = p.y;
          bool arm = ax > uX.x && y > uY.z;
          float fabric = .9 + .1*vn(p*180.) + .06*vn(p*23.);
          vec3 col = diffuseColor.rgb;
          // 신발
          if (y < uY.x && !arm){ col = cShoe*(.85 + .15*vn(p*90.)); if (y < uY.x - .1) col = mix(col, vec3(.85), .6); cloth = 1.; shoeK = 1.; }
          // 바지 / 치마
          else if (y < uY.z && y > uY.y && !arm){ col = cPants*fabric; if (uLeg > .5) col = cPants*(.9 + .1*vn(p*40.)); if (y < uY.y + .012) col *= .8; cloth = 1.; }
          // 상의 몸통
          else if (y >= uY.z - .005 && y < uY.w && !arm){
            float neckDip = (p.z > 0.) ? smoothstep(.09, 0., ax)*.06 : 0.;
            if (uSt > 1.5 && uSt < 2.5) neckDip = (p.z > 0.) ? smoothstep(.11, .02, ax)*.12 : smoothstep(.1, .0, ax)*.05; // 민소매는 목이 더 파임
            float top = uY.w + .02 + smoothstep(.035, .1, ax)*.16 - neckDip;
            if (uSt > 1.5 && uSt < 2.5 || uSt > 7.5) top = uY.w + .02 - neckDip - smoothstep(.1, .16, ax)*.08; // 민소매 · 조끼: 어깨 드러남
            if (y < top){ col = cShirt*fabric; cloth = 1.;
              // 겉옷 열림 (재킷 · 정장 · 조끼)
              if ((uSt > 2.5 && uSt < 4.5 || uSt > 7.5) && p.z > 0. && ax < .03 + (y - uY.z)*.06) col = cShirt2*fabric;
              if (uSt > 3.5 && uSt < 4.5 && p.z > 0. && ax < .012 && y > uX.w - .25) col = vec3(.5, .08, .1); // 넥타이
              if (uSt > 6.5 && uSt < 7.5){ if (p.z > 0. && abs(p.x - .09) < .03 && abs(y - uX.w) < .03) col = vec3(.85, .7, .2); } // 배지
              if (uSt > 5.5 && uSt < 6.5 && p.z > 0. && y < uY.z + .16 && ax < .11) col *= .82; // 후드 주머니
              if (uPrint > .5 && p.z > 0. && uSt < 1.5){ vec2 q = vec2(p.x, y - uX.w + .03); if (uPrint < 1.5 && length(q) < .06) col = cShirt2; if (uPrint > 1.5 && abs(q.y) < .018) col = cShirt2; if (uPrint > 2.5 && abs(q.y + .05) < .012) col = cShirt2; }
              if (y < uY.z + .018 && uSt < 5.) col *= .55; // 벨트
            }
            if (uSt > 4.5 && uSt < 5.5){ col = cShirt*fabric; cloth = 1.; } // 원피스는 몸통 전체
          }
          // 소매
          else if (arm && ax < uX.y){ col = (uSt > 2.5 && uSt < 4.5 ? cShirt : cShirt)*fabric; if (ax > uX.y - .015) col *= .82; cloth = 1.; }
          // 원피스 아랫단
          if (uSt > 4.5 && uSt < 5.5 && !arm && y < uY.z && y > uY.y - .02){ col = cShirt*fabric; cloth = 1.; }
          // 후드: 목 뒤
          if (uSt > 5.5 && uSt < 6.5 && !arm && y >= uY.w - .01 && y < uY.w + .06 && p.z < .0){ col = cShirt*fabric; cloth = 1.; }
          diffuseColor.rgb = cloth > .5 ? col : diffuseColor.rgb;
          if (uBlood > 0.){ float b = smoothstep(.55, .75, vn(p*14.) + uBlood*.3)*uBlood; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.28, .02, .02), b*.85); }
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = cloth > .5 ? (shoeK > .5 ? .45 : .9) : .55;');
  };
  m.customProgramCacheKey = ()=>'sl-cloth';
  return m;
}

// ----- 머리 · 액세서리 -----
const HAIRS = { Male:['Hair_SimpleParted', 'Hair_Buzzed', 'Hair_SimpleParted', null], Female:['Hair_Long', 'Hair_Buns', 'Hair_BuzzedFemale', 'Hair_Long'] };
const SKINS = [0xffffff, 0xf3d6c0, 0xe0b090, 0xc08a62, 0x8a5a3a, 0x5a3a26];
const HAIRC = [0x1a120c, 0x2a1a10, 0x4a2c18, 0x7a4a24, 0xc8a060, 0x9a9a9a, 0xe8e0d0, 0x6a1a10];
const CLOTH = [0x1d2b44, 0x23262b, 0xe8e8e8, 0x8a1c1c, 0x2e5a3a, 0x3a5aa0, 0xc8a46a, 0x6a6a6a, 0x5a2a6a, 0xd06a20, 0xf2d24a, 0x9ac0e0, 0x101010, 0xb0b0b0, 0xe07090];
const PANTS = [0x2a3a5a, 0x1c2638, 0x161616, 0x5a4a38, 0x7a7a72, 0x3a4a3a, 0xc8b898, 0x34405e];
const SHOES = [0x111111, 0xeeeeee, 0x4a2e1a, 0x8a1a1a, 0x22344a, 0x777777];
H.randomLook = (rng, opts)=>{ rng = rng || Math.random; opts = opts || {}; const R = a=>a[Math.floor(rng()*a.length)];
  const sex = opts.sex || (rng() < .5 ? 'Male' : 'Female');
  const tops = sex === 'Male' ? ['tee', 'tee', 'long', 'jacket', 'hoodie', 'suit', 'tank', 'vest'] : ['tee', 'long', 'tank', 'jacket', 'dress', 'dress', 'hoodie', 'tee'];
  const top = R(tops);
  const look = { sex, skin:R(SKINS), hair:R(HAIRS[sex]), hairCol:R(HAIRC), beard:sex === 'Male' && rng() < .25, top, shirt:R(CLOTH), shirt2:R(CLOTH), pants:R(PANTS), shoe:R(SHOES), legs:'long', print:rng() < .35 ? 1 + Math.floor(rng()*3) : 0 };
  if (top === 'suit'){ look.shirt = R([0x1a1a22, 0x2a2e38, 0x3a3a3a, 0x1c2438]); look.shirt2 = 0xf0f0f0; look.pants = look.shirt; look.shoe = 0x111111; }
  if (top === 'jacket' || top === 'vest') look.shirt2 = R([0xeeeeee, 0x222222, 0x8a1c1c, 0x3a5aa0]);
  if (top === 'dress'){ look.legs = 'skirt'; look.pants = look.skin; }
  else if (sex === 'Female' && rng() < .25){ look.legs = 'skirt'; }
  else if (rng() < .2 && top !== 'suit') look.legs = 'shorts';
  if (look.legs === 'shorts' || look.legs === 'skirt'){ /* 다리는 피부 */ }
  if (rng() < .12) look.hat = R(['cap', 'beanie']); if (rng() < .15) look.glasses = true;
  return look;
};
H.copLook = rng=>{ rng = rng || Math.random; const sex = rng() < .75 ? 'Male' : 'Female'; return { sex, skin:SKINS[Math.floor(rng()*SKINS.length)], hair:sex === 'Male' ? 'Hair_Buzzed' : 'Hair_Buns', hairCol:HAIRC[Math.floor(rng()*4)], top:'uniform', shirt:0x1b2a4a, shirt2:0x1b2a4a, pants:0x141c30, shoe:0x0c0c0c, legs:'long', hat:'police' }; };
H.gangLook = (rng, gang)=>{ rng = rng || Math.random; const c = gang === 'g' ? [0x2e8a3a, 0x1f5a28] : [0x7a2a9a, 0x4a1a6a];
  return { sex:'Male', skin:SKINS[2 + Math.floor(rng()*4)], hair:rng() < .5 ? 'Hair_Buzzed' : null, hairCol:0x120c08, beard:rng() < .4, top:rng() < .5 ? 'tank' : 'tee', shirt:c[Math.floor(rng()*2)], shirt2:0x111111, pants:rng() < .5 ? 0x1c2638 : 0x7a6a50, shoe:0xeeeeee, legs:rng() < .3 ? 'shorts' : 'long', hat:rng() < .5 ? 'bandana' : 'cap', hatCol:c[0] }; };

// 모자 · 선글라스 (머리 뼈에 붙임)
function addHat(head, look, scl){
  const g = new THREE.Group(); const k = look.hat; const col = look.hatCol || (k === 'police' ? 0x141c30 : look.shirt2 || 0x222222);
  const m = new THREE.MeshStandardMaterial({ color:LC(col), roughness:.8 });
  if (k === 'cap' || k === 'police'){
    const top = new THREE.Mesh(new THREE.SphereGeometry(.112, 16, 10, 0, Math.PI*2, 0, Math.PI/2), m); top.scale.set(1, .75, 1.08); g.add(top);
    const bill = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .012, 16, 1, false, -Math.PI/2.4, Math.PI/1.2), m); bill.position.set(0, .0, .07); bill.scale.set(1, 1, 1.1); g.add(bill);
    if (k === 'police'){ const b = new THREE.Mesh(new THREE.BoxGeometry(.04, .03, .01), new THREE.MeshStandardMaterial({ color:0xd8b040, metalness:.8, roughness:.3 })); b.position.set(0, .045, .11); g.add(b); top.scale.y = .9; }
  } else if (k === 'beanie'){ const top = new THREE.Mesh(new THREE.SphereGeometry(.118, 16, 10, 0, Math.PI*2, 0, Math.PI/1.8), m); top.scale.set(1, .95, 1.06); g.add(top); }
  else if (k === 'bandana'){ const top = new THREE.Mesh(new THREE.SphereGeometry(.114, 16, 8, 0, Math.PI*2, 0, Math.PI/2.2), m); top.scale.set(1, .7, 1.06); g.add(top); }
  g.position.set(0, .115, .005); g.traverse(o=>{ if (o.isMesh) o.castShadow = true; });
  head.add(g); g.scale.setScalar(scl);
}
function addGlasses(head, scl){ const m = new THREE.MeshStandardMaterial({ color:0x050505, roughness:.1, metalness:.6 }); const g = new THREE.Group();
  for (const s of [-1, 1]){ const l = new THREE.Mesh(new THREE.BoxGeometry(.045, .024, .006), m); l.position.set(s*.032, 0, 0); g.add(l); }
  const br = new THREE.Mesh(new THREE.BoxGeometry(.11, .006, .006), m); g.add(br); g.position.set(0, .075, .094); head.add(g); g.scale.setScalar(scl); }

// ----- 사람 만들기 -----
const AN = { idle:'Idle_Loop', walk:'Walk_Loop', jog:'Jog_Fwd_Loop', run:'Sprint_Loop', jumpS:'Jump_Start', jump:'Jump_Loop', land:'Jump_Land', jab:'Punch_Jab', cross:'Punch_Cross', hook:'Melee_Hook',
  death:'Death01', hit:'Hit_Chest', hitH:'Hit_Head', knock:'Hit_Knockback', sit:'Sitting_Idle_Loop', talk:'Idle_Talking_Loop', fold:'Idle_FoldArms_Loop', dance:'Dance_Loop', roll:'Roll', swim:'Swim_Fwd_Loop', swimIdle:'Swim_Idle_Loop',
  swing:'Sword_Attack', throw:'OverhandThrow', interact:'Interact', yes:'Yes', walkF:'Walk_Formal_Loop', zombie:'Zombie_Walk_Fwd_Loop', consume:'Consume' };
const ONCE = new Set(['jumpS', 'land', 'jab', 'cross', 'hook', 'death', 'hit', 'hitH', 'knock', 'roll', 'swing', 'throw', 'interact', 'yes', 'consume']);
H.make = (look, opts)=>{
  opts = opts || {};
  const g = new THREE.Group();
  const sex = look.sex || 'Male', cal = BASE[sex];
  const root = THREE.SkeletonUtils.clone(G.A.chars.getObjectByName('B_' + sex)); root.position.set(0, 0, 0); root.traverse(o=>{ if (o !== root) o.name = fixName(o.name); });
  g.add(root); root.updateMatrixWorld(true);
  let skel = null; root.traverse(o=>{ if (o.isSkinnedMesh && !skel) skel = o.skeleton; });
  const byName = {}; for (const b of skel.bones) byName[b.name] = b;
  const attach = (nodeName, col)=>{ const src = G.A.chars.getObjectByName(nodeName); if (!src) return; const c = THREE.SkeletonUtils.clone(src); c.updateMatrixWorld(true); const ms = []; c.traverse(o=>{ if (o.isSkinnedMesh) ms.push(o); });
    for (const m of ms){ const bones = m.skeleton.bones.map(b=>byName[fixName(b.name)] || b); m.bind(new THREE.Skeleton(bones, m.skeleton.boneInverses), m.bindMatrix); m.material = m.material.clone(); if (col !== undefined){ m.material.color = new THREE.Color(col).convertSRGBToLinear().multiplyScalar(1.6); } m.material.roughness = .7; m.frustumCulled = false; m.castShadow = true; root.add(m); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1); } };
  if (look.hair) attach('H_' + look.hair, look.hairCol);
  if (look.beard) attach('H_Hair_Beard', look.hairCol);
  const mats = [];
  root.traverse(o=>{ if (!o.isMesh) return; o.frustumCulled = false; o.castShadow = true; o.receiveShadow = !G.LOW;
    const n = (o.material && o.material.name) || '';
    if (/Superhero/.test(n)){ o.material = clothMaterial(o.material, look, cal); mats.push(o.material); }
    else if (/Eyebrow|Hair_1|Hair_2/.test(n) && !/H_/.test(o.parent && o.parent.name)){ o.material = o.material.clone(); o.material.color = new THREE.Color(look.hairCol || 0x222222).convertSRGBToLinear().multiplyScalar(1.6); }
  });
  const head = byName.Head; const hs = 1/(head.getWorldScale(new THREE.Vector3()).x || 1);
  if (look.hat) addHat(head, look, hs); if (look.glasses) addGlasses(head, hs);
  const ch = { g, root, look, mixer:new THREE.AnimationMixer(root), acts:{}, cur:'', curA:null, bones:byName, mats, oneShot:null, speedScale:1 };
  ch.play = (name, o)=>playAnim(ch, name, o || {});
  ch.setBlood = v=>{ for (const m of ch.mats) if (m.userData.U) m.userData.U.uBlood.value = v; };
  ch.dispose = ()=>{ ch.mixer.stopAllAction(); ch.g.traverse(o=>{ if (o.isMesh && o.material){ if (o.material.userData && o.material.userData.U) o.material.dispose(); } }); };
  ch.play('idle', { fade:0 });
  return ch;
};
function playAnim(ch, name, o){
  const clipName = AN[name] || name; const clip = ANIM[clipName]; if (!clip) return null;
  let a = ch.acts[name];
  if (!a){ a = ch.mixer.clipAction(clip); ch.acts[name] = a; if (ONCE.has(name)){ a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } }
  if (ch.cur === name && !o.restart){ if (o.speed) a.timeScale = o.speed; return a; }
  const fade = o.fade === undefined ? .2 : o.fade;
  a.reset(); a.timeScale = o.speed || 1; a.setEffectiveWeight(1); a.play();
  if (ch.curA && ch.curA !== a){ if (fade > 0) ch.curA.crossFadeTo(a, fade, false); else ch.curA.stop(); }
  ch.cur = name; ch.curA = a; return a;
}
H.clipLen = name=>{ const c = ANIM[AN[name] || name]; return c ? c.duration : 1; };

// ----- 팔 조준 (애니메이션 위에 덮어쓰기) -----
// 뼈 B 를 world 방향 dir 으로 향하게 회전
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
function pointBone(b, child, dir, k){
  b.updateMatrixWorld(true);
  const p0 = b.getWorldPosition(_v1), p1 = child.getWorldPosition(_v2); const d0 = p1.sub(p0).normalize();
  _q1.setFromUnitVectors(d0, dir); if (k < 1) _q1.slerp(_q3.identity(), 1 - k);
  b.getWorldQuaternion(_q2); _q2.premultiply(_q1);
  const pq = b.parent.getWorldQuaternion(_q3); b.quaternion.copy(pq.invert().multiply(_q2));
  b.updateMatrixWorld(true);
}
H.aimArms = (ch, target, twoHand, k)=>{
  const B = ch.bones; if (!B.upperarm_r) return; k = k === undefined ? 1 : k;
  const sh = B.upperarm_r.getWorldPosition(new THREE.Vector3());
  const dir = target.clone().sub(sh).normalize();
  // 몸통을 조금 비틀어 조준 방향으로
  pointBone(B.upperarm_r, B.lowerarm_r, dir, k); pointBone(B.lowerarm_r, B.hand_r, dir, k);
  if (twoHand && B.upperarm_l){ const hr = B.hand_r.getWorldPosition(new THREE.Vector3()).addScaledVector(dir, twoHand); const shl = B.upperarm_l.getWorldPosition(new THREE.Vector3());
    // 왼손이 총 앞쪽(받침)으로 가도록: 팔꿈치를 약간 아래로
    const mid = shl.clone().lerp(hr, .5); mid.y -= .12; pointBone(B.upperarm_l, B.lowerarm_l, mid.sub(shl).normalize(), k); pointBone(B.lowerarm_l, B.hand_l, hr.sub(B.lowerarm_l.getWorldPosition(new THREE.Vector3())).normalize(), k); }
};
H.lookAt = (ch, target, k)=>{ const B = ch.bones; if (!B.neck_01) return; const p = B.Head.getWorldPosition(new THREE.Vector3()); const d = target.clone().sub(p); d.y *= .6; if (d.lengthSq() < 1e-4) return; d.normalize();
  const fw = new THREE.Vector3(0, 0, 1).applyQuaternion(ch.g.quaternion); if (fw.dot(d) < .1) return; const q = new THREE.Quaternion().setFromUnitVectors(fw, d); q.slerp(new THREE.Quaternion(), 1 - (k || .5));
  const wq = B.neck_01.getWorldQuaternion(new THREE.Quaternion()).premultiply(q); B.neck_01.quaternion.copy(B.neck_01.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wq)); };
H.AN = AN;
})();
