// 8번 출구 아저씨: Ready Player Me 아바타(three.js 예제 모델 readyplayer.me.glb)를 회사원 차림으로 바꾸고, 걷기는 직접 만든다
// 쓰는 법: OJI.build(gltf) → O,  매 프레임 OJI.pose(O, 걷기위상, 걷는정도, {headYaw, headPitch}),  표정 OJI.face(O, 'mouthSmile', 0~1)
window.OJI = (function(){
  // 텍스처를 원래 명암(주름)은 살리고 색만 바꾼다
  function recolor(tex, base, dark, cut){ const img = tex.image; const w = img.width, h = img.height; const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, h), a = d.data; let sum = 0, n = 0; for (let i=0;i<a.length;i+=4){ if (a[i+3] < 10) continue; sum += (a[i]*.3 + a[i+1]*.59 + a[i+2]*.11); n++; } const mean = sum/Math.max(1, n);
    for (let i=0;i<a.length;i+=4){ const L = (a[i]*.3 + a[i+1]*.59 + a[i+2]*.11); const useDark = cut !== undefined && L < cut; const col = useDark ? dark : base; const k = Math.max(.55, Math.min(1.25, .9 + (L - mean)/255*.9));
      a[i] = Math.min(255, col[0]*k); a[i+1] = Math.min(255, col[1]*k); a[i+2] = Math.min(255, col[2]*k); }
    g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.encoding = THREE.sRGBEncoding; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; return t; }
  // 몸 각도 (캐릭터 기준 축으로 돌림)
  const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _ax = new THREE.Vector3();
  // 정장 텍스처: 흰 셔츠는 두고, 꽃(빨강·초록)은 투명, 나머지(자켓·조끼·나비넥타이)는 짙은 회색
  function suitTex(tex){ const img = tex.image, w = img.width, h = img.height; const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, w, h), a = d.data;
    const cls = new Uint8Array(w*h);   // 0 정장, 1 셔츠, 2 지우기(꽃)
    for (let p=0, i=0;p<w*h;p++, i+=4){ const r = a[i], gg = a[i+1], b = a[i+2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx ? (mx - mn)/mx : 0, L = r*.3 + gg*.59 + b*.11;
      if (sat > .45 && ((r > gg*1.6 && r > b*1.3) || (gg > r*1.3 && gg > b*1.2))) cls[p] = 2; else if (sat < .2 && L > 110) cls[p] = 1; }
    // 잡티 정리: 주변 다수결 2번
    for (let pass=0; pass<2; pass++){ const src = cls.slice(); for (let y=2;y<h-2;y++) for (let x=2;x<w-2;x++){ const p = y*w + x; if (src[p] === 2) continue; let n1 = 0, n = 0; for (let dy=-2;dy<=2;dy++) for (let dx=-2;dx<=2;dx++){ const q = src[p + dy*w + dx]; if (q === 2) continue; n++; if (q === 1) n1++; } cls[p] = n1*2 > n ? 1 : 0; } }
    // 작은 흰 점(옷깃 반사) 지우기: 셔츠를 깎았다가 다시 불리기 (열림 연산)
    const morph = (keepIfAll, r, C)=>{ C = C || 1; const src = cls.slice(), tmp = new Uint8Array(w*h); for (let y=0;y<h;y++) for (let x=0;x<w;x++){ let all = 1, any = 0; for (let k=-r;k<=r;k++){ const xx = Math.min(w - 1, Math.max(0, x + k)), v = src[y*w + xx] === C; all &= v; any |= v; } tmp[y*w + x] = keepIfAll ? all : any; }
      for (let y=0;y<h;y++) for (let x=0;x<w;x++){ const p = y*w + x; if (C === 1 && src[p] === 2) continue; if (C === 2 && src[p] === 1) continue; let all = 1, any = 0; for (let k=-r;k<=r;k++){ const yy = Math.min(h - 1, Math.max(0, y + k)), v = tmp[yy*w + x]; all &= v; any |= v; } cls[p] = (keepIfAll ? all : any) ? C : 0; } };
    const rr = Math.max(2, Math.round(w/256)); morph(1, rr); morph(0, rr); morph(1, rr*2, 2); morph(0, rr*2, 2);
    for (let p=0, i=0;p<w*h;p++, i+=4){ const L = a[i]*.3 + a[i+1]*.59 + a[i+2]*.11;
      if (cls[p] === 2){ a[i+3] = 0; continue; }
      if (cls[p] === 1){ const k = Math.max(.82, Math.min(1.04, .9 + (L - 200)/700)); a[i] = 232*k; a[i+1] = 234*k; a[i+2] = 237*k; continue; }
      const k = Math.max(.6, Math.min(1.35, .75 + L/400)); a[i] = 44*k; a[i+1] = 47*k; a[i+2] = 53*k; }
    g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.encoding = THREE.sRGBEncoding; return t; }
  // 머리 텍스처의 두피 부분을 머리카락 색으로 칠한다 (UV 공간에서 삼각형마다 3D 위치를 보간 → 머리선이 매끈)
  function paintScalp(head, hvP){ const mat = head.material = head.material.clone(), img = mat.map.image, W = img.width, H = img.height; const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, W, H), a = d.data;
    const geo = head.geometry, P = geo.attributes.position, U = geo.attributes.uv, I = geo.index; const flip = mat.map.flipY;
    for (let t=0;t<I.count;t+=3){ const ids = [I.getX(t), I.getX(t+1), I.getX(t+2)]; const hs = ids.map(i=>hvP(P.getX(i), P.getY(i), P.getZ(i))); if (Math.max(...hs) < -.012) continue;
      const u = ids.map(i=>U.getX(i)*W), v = ids.map(i=>(flip ? 1 - U.getY(i) : U.getY(i))*H);
      const x0 = Math.max(0, Math.floor(Math.min(...u)) - 1), x1 = Math.min(W - 1, Math.ceil(Math.max(...u)) + 1), y0 = Math.max(0, Math.floor(Math.min(...v)) - 1), y1 = Math.min(H - 1, Math.ceil(Math.max(...v)) + 1);
      const den = (v[1] - v[2])*(u[0] - u[2]) + (u[2] - u[1])*(v[0] - v[2]); if (Math.abs(den) < 1e-9) continue;
      for (let py=y0; py<=y1; py++) for (let px=x0; px<=x1; px++){ const X = px + .5, Y = py + .5; let l0 = ((v[1] - v[2])*(X - u[2]) + (u[2] - u[1])*(Y - v[2]))/den, l1 = ((v[2] - v[0])*(X - u[2]) + (u[0] - u[2])*(Y - v[2]))/den, l2 = 1 - l0 - l1;
        const e = -1.5/Math.max(Math.abs(den), 1)*0 - .02; if (l0 < e || l1 < e || l2 < e) continue;   // 경계 1~2픽셀 넉넉히
        const ps = [0, 1, 2].map(k=>new THREE.Vector3(P.getX(ids[k]), P.getY(ids[k]), P.getZ(ids[k])));
        const X3 = ps[0].x*l0 + ps[1].x*l1 + ps[2].x*l2, Y3 = ps[0].y*l0 + ps[1].y*l1 + ps[2].y*l2, Z3 = ps[0].z*l0 + ps[1].z*l1 + ps[2].z*l2;
        const h = hvP(X3, Y3, Z3), A = Math.max(0, Math.min(1, (h + .004)/.006)); if (A <= 0) continue;
        const q = (py*W + px)*4, n = (Math.sin(px*12.9898 + py*78.233)*43758.5453)%1, dk = 26 + Math.abs(n)*14;
        a[q] = a[q]*(1 - A) + dk*A; a[q+1] = a[q+1]*(1 - A) + dk*.93*A; a[q+2] = a[q+2]*(1 - A) + dk*.86*A; } }
    g.putImageData(d, 0, 0); const tx = new THREE.CanvasTexture(c); tx.flipY = mat.map.flipY; tx.encoding = THREE.sRGBEncoding; mat.map = tx; }
  // 짧은 머리: 머리 메쉬에서 두피 부분만 복사해 살짝 부풀린 껍데기 (눈 위치 기준으로 머리선)
  function hairShell(head, eyeL, eyeR){ const g0 = head.geometry, pos = g0.attributes.position, nor = g0.attributes.normal, idx = g0.index;
    const eL = new THREE.Vector3(), eR = new THREE.Vector3(); eyeL.getWorldPosition(eL); eyeR.getWorldPosition(eR); const ey = (eL.y + eR.y)/2, ex = (eL.x + eR.x)/2, ez = (eL.z + eR.z)/2, cz = ez - .085;
    // 머리선까지의 높이 차이(+면 머리카락)
    const sm = (a, b, t)=>{ t = Math.max(0, Math.min(1, (t - a)/(b - a))); return t*t*(3 - 2*t); };
    const lineAt = (x, f)=>{ const ax = Math.abs(x); const front = .058 - ax*.15 + Math.max(0, ax - .04)*.6;
      const mid = f > 0 ? .03 : -.075 + Math.max(0, f + .3)*.05; const center = mid + (front - mid)*sm(.38, .5, f);
      const side0 = -.07 + (.004 + .07)*sm(-.42, -.3, f), side = side0 + (.025 - side0)*sm(.15, .3, f), sideF = side + (front - side)*sm(.4, .5, f);
      return center + (sideF - center)*sm(.04, .062, ax); };
    const hvP = (X, Y, Z)=>(Y - ey) - lineAt(X - ex, (Z - cz)/.1);
    const hv = i=>hvP(pos.getX(i), pos.getY(i), pos.getZ(i));
    paintScalp(head, hvP);
    const al = i=>Math.max(0, Math.min(1, (hv(i) - .004)/.02));
    const keep = []; for (let i=0;i<idx.count;i+=3){ const a = idx.getX(i), b = idx.getX(i+1), c = idx.getX(i+2); if (al(a) + al(b) + al(c) > 0) keep.push(a, b, c); }
    const g = g0.clone(); g.setIndex(keep); const p2 = g.attributes.position, C = new THREE.Vector3(ex, ey - .015, cz), v = new THREE.Vector3(); const col = new Float32Array(p2.count*4);
    for (let i=0;i<p2.count;i++){ v.set(p2.getX(i), p2.getY(i), p2.getZ(i)); const y = v.y - ey, A = al(i), k = (.002 + Math.max(0, y)*.05)*A + .0015; const dir = v.clone().sub(C).normalize(); v.addScaledVector(dir, k); p2.setXYZ(i, v.x, v.y, v.z); col[i*4] = col[i*4+1] = col[i*4+2] = 1; col[i*4+3] = A; }
    p2.needsUpdate = true; g.setAttribute('color', new THREE.BufferAttribute(col, 4)); g.computeVertexNormals();
    g.morphAttributes = {};
    const tex = (()=>{ const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#151311'; x.fillRect(0, 0, 256, 256); for (let i=0;i<6000;i++){ const v = 8 + Math.random()*34; x.fillStyle = 'rgba(' + v + ',' + (v*.93) + ',' + (v*.86) + ',.55)'; x.fillRect(Math.random()*256, Math.random()*256, 1, 2 + Math.random()*4); } const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
    const m = new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial({ map:tex, roughness:.72, vertexColors:true, transparent:true, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-4 })); m.renderOrder = 1; m.bind(head.skeleton, head.bindMatrix); m.frustumCulled = false; m.castShadow = true; head.parent.add(m); return m; }
  function build(gltf){ const root = gltf.scene; const bones = {}; root.traverse(o=>{ if (o.isBone) bones[o.name] = o; if (o.isMesh){ o.frustumCulled = false; o.castShadow = true; } });
    const mesh = n=>root.getObjectByName(n);
    const top = mesh('Wolf3D_Outfit_Top'), bot = mesh('Wolf3D_Outfit_Bottom'), shoe = mesh('Wolf3D_Outfit_Footwear'), head = mesh('Wolf3D_Head');
    for (const n of ['Wolf3D_Headwear', 'Wolf3D_Beard', 'Wolf3D_Hair']){ const m = mesh(n); if (m) m.visible = false; }
    if (top){ top.material = top.material.clone(); top.material.map = suitTex(top.material.map); top.material.alphaTest = .5; top.material.roughness = .8; top.material.metalness = 0; }
    if (bot){ bot.material = bot.material.clone(); bot.material.map = recolor(bot.material.map, [46, 49, 55]); bot.material.roughness = .8; bot.material.metalness = 0; }
    if (shoe){ shoe.material = shoe.material.clone(); shoe.material.map = recolor(shoe.material.map, [24, 22, 21]); shoe.material.roughness = .3; shoe.material.metalness = .05; }
    root.updateMatrixWorld(true); const hair = head && bones.LeftEye ? hairShell(head, bones.LeftEye, bones.RightEye) : null;
    // 가방 (왼손)
    const bag = new THREE.Group(); const bm = new THREE.MeshStandardMaterial({ color:0x121315, roughness:.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(.40, .29, .085), bm); body.position.y = -.17; body.castShadow = true; bag.add(body);
    const hd = new THREE.Mesh(new THREE.TorusGeometry(.045, .009, 6, 14, Math.PI), bm); hd.position.y = -.025; bag.add(hd);
    const lk = new THREE.Mesh(new THREE.BoxGeometry(.035, .02, .09), new THREE.MeshStandardMaterial({ color:0xb8a060, metalness:.8, roughness:.3 })); lk.position.y = -.045; bag.add(lk);
    root.add(bag);
    const rest = {}; for (const n in bones) rest[n] = bones[n].quaternion.clone(); const hipsY = bones.Hips ? bones.Hips.position.y : 1;
    const morph = []; root.traverse(o=>{ if (o.isMesh && o.morphTargetDictionary) morph.push(o); });
    return { root, bones, rest, bag, morph, hair, phase:0, hipsY }; }
  // 캐릭터 공간 축(axis)으로 각도만큼 돌리기 — 뼈마다 축 방향을 몰라도 된다
  function turn(O, name, axis, ang){ const b = O.bones[name]; if (!b || !ang) return; b.parent.getWorldQuaternion(_qp); O.root.getWorldQuaternion(_qr);
    _ax.copy(axis).applyQuaternion(_qr); _q.setFromAxisAngle(_ax, ang); _qi.copy(_qp).invert(); b.quaternion.premultiply(_qp).premultiply(_q).premultiply(_qi); }
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  // pose(O, 걷기 위상, 걷는 정도 0~1, 옵션)
  function pose(O, ph, walk, opt){ opt = opt || {}; const B = O.bones; for (const n in O.rest) B[n].quaternion.copy(O.rest[n]);
    const s = Math.sin(ph), c2 = Math.cos(ph*2), w = walk;
    B.Hips.position.y = O.hipsY - (1 - c2)*.012*w;
    turn(O, 'Hips', Y, s*.07*w); turn(O, 'Hips', Z, Math.sin(ph + Math.PI/2)*.03*w);
    turn(O, 'Spine', Y, -s*.06*w); turn(O, 'Spine1', X, .03);
    // 팔: A자 자세 → 몸 옆으로 내리고, 다리와 반대로 흔들기
    turn(O, 'LeftArm', Z, -.42); turn(O, 'RightArm', Z, .42);
    turn(O, 'RightArm', X, -s*.32*w); turn(O, 'LeftArm', X, s*.12*w + .05);
    turn(O, 'RightForeArm', X, -.18 - Math.max(0, -s)*.2*w); turn(O, 'LeftForeArm', X, -.32);
    // 다리
    const L = s, Rr = -s; const thigh = a=> a*.4*w, knee = (a, b)=> (.06 + Math.pow(Math.max(0, Math.cos(b + .55)), 1.6)*.75 + Math.pow(Math.max(0, Math.cos(b - 2.0)), 6)*.14)*w;
    turn(O, 'LeftUpLeg', X, -thigh(L)); turn(O, 'RightUpLeg', X, -thigh(Rr));
    turn(O, 'LeftLeg', X, knee(L, ph)); turn(O, 'RightLeg', X, knee(Rr, ph + Math.PI));
    turn(O, 'LeftFoot', X, (-.12 + Math.max(0, L)*.25)*w); turn(O, 'RightFoot', X, (-.12 + Math.max(0, Rr)*.25)*w);
    turn(O, 'LeftHand', Y, .15); turn(O, 'RightHand', Y, -.1);
    for (const sd of ['Left', 'Right']) for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) for (let k=1;k<=3;k++) turn(O, sd + 'Hand' + f + k, X, sd === 'Left' ? -.75 : -.55);
    turn(O, 'LeftHandThumb1', X, -.3); turn(O, 'RightHandThumb1', X, -.2);
    if (opt.headYaw) turn(O, 'Head', Y, opt.headYaw); if (opt.headPitch) turn(O, 'Head', X, opt.headPitch);
    // 가방은 왼손에
    const hand = B.LeftHand; if (hand){ O.root.updateMatrixWorld(true); hand.getWorldPosition(_ax); O.root.worldToLocal(_ax); O.bag.position.copy(_ax); O.bag.position.y += .0; O.bag.position.x += .02; O.bag.rotation.set(s*.1*w, Math.PI/2, 0); } }
  function face(O, name, v){ for (const m of O.morph){ const i = m.morphTargetDictionary[name]; if (i !== undefined) m.morphTargetInfluences[i] = v; } }
  return { build, pose, face, turn };
})();
