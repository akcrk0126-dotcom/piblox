// =====================================================================
//  렌더러 · 하늘 · 낮밤 · 날씨 · 후처리
// =====================================================================
'use strict';
(function(){
const U = G.U;
const E = G.env = { hour:9.5, timeScale:1/60*1, weather:'clear', w:{ cloud:.2, rain:0, fog:0, storm:0 }, wT:{ cloud:.2, rain:0, fog:0, storm:0 }, wTimer:240, flash:0, night:0, sunDir:new THREE.Vector3() };
// 1 게임 시간 = 60 실제 초 → 하루 24분

E.init = ()=>{
  const q = G.cfg.quality;
  const R = G.renderer = new THREE.WebGLRenderer({ antialias:q > 0, powerPreference:'high-performance', stencil:false, preserveDrawingBuffer:!!window.__PDB });
  R.setPixelRatio(Math.min(devicePixelRatio, q > 0 ? 1.5 : 1)); R.setSize(innerWidth, innerHeight);
  R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1;
  R.shadowMap.enabled = true; R.shadowMap.type = q > 0 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  G.canvas = R.domElement; G.canvas.id = 'gl'; document.body.prepend(G.canvas);
  const S = G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(G.cfg.fov, innerWidth/innerHeight, .1, 3500);
  S.fog = new THREE.FogExp2(0xb8c8d8, .0012);
  // 빛
  E.hemi = new THREE.HemisphereLight(0xcfe0ff, 0x4a4438, .55); S.add(E.hemi);
  E.sun = new THREE.DirectionalLight(0xfff0dd, 2.6); E.sun.castShadow = true;
  const sm = q > 0 ? 2048 : 1024; E.sun.shadow.mapSize.set(sm, sm); const sc = E.sun.shadow.camera; sc.left = sc.bottom = -90; sc.right = sc.top = 90; sc.near = 1; sc.far = 700; E.sun.shadow.bias = -.0004; E.sun.shadow.normalBias = .04;
  S.add(E.sun); S.add(E.sun.target);
  buildSky(); buildRain();
  // 반사용 환경맵
  E.pmrem = new THREE.PMREMGenerator(R); E.envScene = new THREE.Scene(); E.envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), E.skyMat); E.envScene.add(E.envSky); E.envLast = -99;
  // 후처리 (블룸)
  if (q > 0 && THREE.EffectComposer){ const c = E.comp = new THREE.EffectComposer(R); c.addPass(new THREE.RenderPass(S, G.camera)); E.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth/2, innerHeight/2), .5, .5, .86); c.addPass(E.bloom); }
  addEventListener('resize', ()=>{ G.camera.aspect = innerWidth/innerHeight; G.camera.updateProjectionMatrix(); R.setSize(innerWidth, innerHeight); if (E.comp) E.comp.setSize(innerWidth, innerHeight); });
};

// ----- 하늘 -----
function buildSky(){
  E.skyMat = new THREE.ShaderMaterial({ side:THREE.BackSide, depthWrite:false, depthTest:false, fog:false,
    uniforms:{ sunDir:{ value:E.sunDir }, uT:{ value:0 }, dayK:{ value:1 }, cloud:{ value:.2 }, rain:{ value:0 }, flash:{ value:0 } },
    vertexShader:'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader:`uniform vec3 sunDir; uniform float uT, dayK, cloud, rain, flash; varying vec3 vD;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += n2(p)*a; p = p*2.03 + vec2(1.7, 9.2); a *= .5; } return s; }
      void main(){ vec3 d = normalize(vD); float y = d.y; float sunH = sunDir.y;
        vec3 zenD = vec3(.16, .38, .78), horD = vec3(.62, .78, .92), zenN = vec3(.008, .016, .05), horN = vec3(.04, .06, .12);
        vec3 zen = mix(zenN, zenD, dayK), hor = mix(horN, horD, dayK);
        float sunset = smoothstep(.35, .0, abs(sunH - .02))*smoothstep(-.25, .05, sunH);
        float toward = max(dot(normalize(d.xz + 1e-4), normalize(sunDir.xz + 1e-4)), 0.);
        hor = mix(hor, vec3(1.0, .45, .2), sunset*.9*(.35 + .65*toward)); zen = mix(zen, vec3(.3, .25, .5), sunset*.35);
        vec3 col = mix(hor, zen, pow(clamp(y, 0., 1.), .45)); col = mix(col, hor*.7, smoothstep(.0, -.3, y));
        vec3 grey = mix(vec3(.05, .055, .07), vec3(.55, .58, .62), dayK); col = mix(col, grey, rain*.75);
        // 해 · 달
        float sd = dot(d, sunDir); col += vec3(1., .85, .6)*pow(max(sd, 0.), 600.)*18.*(1. - rain)*step(-.05, sunH); col += vec3(1., .7, .4)*pow(max(sd, 0.), 8.)*.25*(1. - rain)*smoothstep(-.1, .2, sunH);
        float md = dot(d, -sunDir); col += vec3(.75, .8, .95)*smoothstep(.9994, .9997, md)*(1. - dayK)*(1. - rain);
        // 별
        if (y > 0.){ vec2 sp = d.xz/(y + .25)*90.; float st = step(.997, h2(floor(sp)))*(1. - dayK)*(1. - cloud)*(1. - rain); col += vec3(st)*(.6 + .4*sin(uT*3. + h2(floor(sp))*40.)); }
        // 구름
        if (y > -.02){ vec2 cp = d.xz/(y + .12)*1.6 + vec2(uT*.008, uT*.004); float c = fbm(cp); float cov = mix(.62, .25, max(cloud, rain));
          float cm = smoothstep(cov, cov + .25, c)*smoothstep(-.02, .12, y);
          vec3 cc = mix(vec3(.08, .09, .12), vec3(1., .98, .95), dayK); cc = mix(cc, vec3(1., .6, .4), sunset*.6); cc = mix(cc, grey*.8, rain*.7);
          cc *= .75 + .35*smoothstep(.3, .9, c);
          col = mix(col, cc, cm*.92); }
        col += vec3(.8, .85, 1.)*flash*.8;
        gl_FragColor = vec4(col, 1.); }` });
  E.sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), E.skyMat); E.sky.frustumCulled = false; E.sky.renderOrder = -1; G.scene.add(E.sky);
}
// ----- 비 -----
function buildRain(){
  const n = G.cfg.quality > 0 ? 9000 : 3500; const geo = new THREE.BufferGeometry(); const p = new Float32Array(n*6);
  for (let i = 0; i < n; i++){ const x = U.rnd(-40, 40), y = U.rnd(0, 40), z = U.rnd(-40, 40); p.set([x, y, z, x + .05, y - .9, z], i*6); }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  E.rainMat = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, uniforms:{ uT:{ value:0 }, uOp:{ value:0 }, uC:{ value:new THREE.Vector3() } },
    vertexShader:'uniform float uT; uniform vec3 uC; varying float vA; void main(){ vec3 p = position; p.y = mod(p.y - uT*28., 40.) - 8.; p.x = uC.x + mod(position.x - uC.x + 40., 80.) - 40.; p.z = uC.z + mod(position.z - uC.z + 40., 80.) - 40.; p.y += uC.y; vA = .5; gl_Position = projectionMatrix*viewMatrix*vec4(p, 1.); }',
    fragmentShader:'uniform float uOp; varying float vA; void main(){ gl_FragColor = vec4(.75, .8, .9, uOp*.35); }' });
  E.rain = new THREE.LineSegments(geo, E.rainMat); E.rain.frustumCulled = false; G.scene.add(E.rain);
}

const WEATHERS = { clear:{ cloud:.15, rain:0, fog:0, storm:0 }, cloudy:{ cloud:.75, rain:0, fog:.15, storm:0 }, rain:{ cloud:1, rain:.8, fog:.35, storm:0 }, storm:{ cloud:1, rain:1, fog:.45, storm:1 }, fog:{ cloud:.5, rain:0, fog:1, storm:0 } };
E.WNAME = { clear:'맑음', cloudy:'흐림', rain:'비', storm:'뇌우', fog:'안개' };
E.setWeather = (k, instant)=>{ E.weather = k; Object.assign(E.wT, WEATHERS[k]); if (instant) Object.assign(E.w, WEATHERS[k]); };

const FOGD = new THREE.Color(0xb6c6d6), FOGN = new THREE.Color(0x0a0e18), FOGS = new THREE.Color(0xd89a70), FOGR = new THREE.Color(0x7a8088);
E.update = (dt, camPos)=>{
  E.hour = (E.hour + dt*E.timeScale)%24;
  // 날씨 바꾸기
  E.wTimer -= dt; if (E.wTimer <= 0){ E.wTimer = U.rnd(180, 420); const r = Math.random(); E.setWeather(r < .5 ? 'clear' : r < .7 ? 'cloudy' : r < .85 ? 'rain' : r < .93 ? 'storm' : 'fog'); }
  for (const k in E.w) E.w[k] = U.damp(E.w[k], E.wT[k], .08, dt);
  // 해 위치: 6시 해돋이, 18시 해넘이
  const a = (E.hour - 6)/12*Math.PI; const sy = Math.sin(a); E.sunDir.set(Math.cos(a)*.8, sy, .45).normalize();
  const dayK = U.clamp((sy + .12)/.35, 0, 1); E.night = 1 - dayK; E.dayK = dayK;
  const lightDir = sy > -.05 ? E.sunDir.clone() : E.sunDir.clone().negate(); // 밤에는 달
  const cloudDim = 1 - E.w.cloud*.45 - E.w.rain*.25;
  const sunset = U.clamp(1 - Math.abs(sy - .05)/.3, 0, 1)*(sy > -.1 ? 1 : 0);
  E.sun.intensity = (sy > -.05 ? 2.05*U.smooth(U.clamp(sy/.25, 0, 1)) : .35*U.clamp(-sy/.3, 0, 1))*cloudDim;
  E.sun.color.setRGB(1, .93 - sunset*.3, .85 - sunset*.5); if (sy <= -.05) E.sun.color.setRGB(.6, .7, 1);
  E.hemi.intensity = (.2 + .42*dayK)*(1 - E.w.rain*.2); E.hemi.color.setRGB(.55 + .25*dayK, .62 + .25*dayK, .85 + .1*dayK);
  if (E.dayK < .01) E.hemi.intensity = .2;
  G.renderer.toneMappingExposure = .88 + E.night*.5;
  // 그림자 카메라를 플레이어 주변으로
  E.sun.position.copy(camPos).addScaledVector(lightDir, 300); E.sun.target.position.copy(camPos); E.sun.target.updateMatrixWorld();
  const sc = E.sun.shadow.camera; // 텍셀 단위로 맞춰 떨림 방지
  // 안개
  const fc = FOGD.clone().lerp(FOGS, sunset*.5).lerp(FOGN, E.night).lerp(FOGR.clone().multiplyScalar(.3 + .7*dayK), E.w.rain*.7);
  G.scene.fog.color.copy(fc); G.scene.fog.density = .0009 + E.w.fog*.0045 + E.w.rain*.0012 + E.night*.0002;
  // 하늘
  const su = E.skyMat.uniforms; su.uT.value += dt; su.dayK.value = dayK; su.cloud.value = E.w.cloud; su.rain.value = E.w.rain; E.sky.position.copy(camPos);
  // 번개
  if (E.w.storm > .5 && Math.random() < dt*.08){ E.flash = 1; setTimeout(()=>G.emit('thunder'), 300 + Math.random()*2000); }
  E.flash = Math.max(0, E.flash - dt*3); su.flash.value = E.flash*(Math.random() < .5 ? 1 : .3); if (E.flash > 0) E.hemi.intensity += E.flash*1.5;
  // 비
  E.rainMat.uniforms.uT.value += dt; E.rainMat.uniforms.uOp.value = E.w.rain; E.rainMat.uniforms.uC.value.copy(camPos); E.rain.visible = E.w.rain > .02;
  // 도시 재질
  G.world.setNight(U.clamp(E.night*1.3 - .1, 0, 1) + E.w.rain*.15*dayK, U.clamp(E.w.rain*1.2, 0, 1)); G.world.U.uT.value += dt;
  if (E.bloom){ E.bloom.strength = .25 + E.night*.55; E.bloom.threshold = .9 - E.night*.25; }
  // 환경맵 (반사) — 가끔만 다시 굽기
  const key = Math.round(E.hour*4) + Math.round(E.w.rain*4)*100;
  if (key !== E.envLast){ E.envLast = key; const old = E.envRT; E.envRT = E.pmrem.fromEquirectangular(envTex(dayK, sunset, E.w.rain)); G.scene.environment = E.envRT.texture; if (old) setTimeout(()=>old.dispose(), 100); }
};
// 반사용 하늘 그림 (정거리 원통 투영)
let envCv = null, envT = null;
function envTex(dayK, sunset, rain){
  if (!envCv){ envCv = document.createElement('canvas'); envCv.width = 256; envCv.height = 128; envT = new THREE.CanvasTexture(envCv); envT.mapping = THREE.EquirectangularReflectionMapping; envT.encoding = THREE.sRGBEncoding; }
  const x = envCv.getContext('2d'); const mix = (a, b, t)=>a.map((v, i)=>Math.round(v + (b[i] - v)*t)); const css = c=>'rgb(' + c.join(',') + ')';
  let zen = mix([6, 10, 26], [70, 130, 210], dayK), hor = mix([18, 22, 40], [190, 215, 235], dayK), gnd = mix([8, 8, 10], [70, 68, 62], dayK);
  hor = mix(hor, [255, 150, 90], sunset*.6); const grey = mix([20, 22, 26], [150, 155, 162], dayK); zen = mix(zen, grey, rain*.8); hor = mix(hor, grey, rain*.8);
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, css(zen)); g.addColorStop(.48, css(hor)); g.addColorStop(.52, css(mix(hor, gnd, .5))); g.addColorStop(1, css(gnd)); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  // 건물 실루엣 느낌 (반사가 너무 하늘만 보이지 않게)

  envT.needsUpdate = true; return envT; }
E.render = ()=>{ if (E.comp) E.comp.render(); else G.renderer.render(G.scene, G.camera); };
E.clock = ()=>{ const h = Math.floor(E.hour), m = Math.floor((E.hour - h)*60); return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; };
})();
