// =====================================================================
//  시작 · 불러오기 · 메인 루프
// =====================================================================
'use strict';
(function(){
const U = G.U, $ = U.$;
const TIPS = ['차 앞에서 F 를 누르면 운전자를 끌어내고 탈 수 있어요.', '도색소(RESPRAY)에 차를 넣으면 수배가 지워져요.', '경찰차를 타면 자경단 부업을, 택시를 타면 택시 운전을 할 수 있어요.', '노란 점프대로 날아오르면 스턴트 보너스!', '도시 곳곳에 초록색으로 빛나는 숨겨진 상자가 30개 있어요.', '운전 중 Q 나 마우스 휠로 라디오 방송국을 바꿀 수 있어요.', '수배 중에는 경찰 눈에 안 띄게 숨으면 별이 사라져요.', '내 집(S)에서 저장하고, 타고 온 차를 차고에 넣을 수 있어요.', '치트 코드가 있다는 소문이… HESOYAM?'];

if (G.TOUCH) document.body.classList.add('touch');
let tipI = 0; const tipTimer = setInterval(()=>{ $('ltip').textContent = TIPS[tipI++%TIPS.length]; }, 3500); $('ltip').textContent = TIPS[Math.floor(Math.random()*TIPS.length)];

// ----- 에셋 -----
function load(done){
  const gl = new THREE.GLTFLoader(); gl.setMeshoptDecoder(MeshoptDecoder); G.A = {};
  const jobs = [
    cb=>gl.load('gen-chars.glb', g=>{ G.A.chars = g.scene; cb(); }, undefined, cb),
    cb=>gl.load('gen-anims.glb', g=>{ G.A.anims = g.animations; G.A.animScene = g.scene; cb(); }, undefined, cb),
  ];
  let left = jobs.length; const total = left;
  for (const j of jobs) j(()=>{ left--; $('lbar').style.width = (10 + (1 - left/total)*50) + '%'; if (left === 0) done(); });
}
function step(msg, pct){ $('ltip').textContent = msg; $('lbar').style.width = pct + '%'; return new Promise(r=>setTimeout(r, 30)); }

async function boot(){
  await new Promise(r=>load(r));
  if (!G.A.chars || !G.A.anims){ $('ltip').innerHTML = '3D 모델을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침 해 주세요.'; return; }
  await step('렌더러 준비…', 62); G.env.init();
  await step('도시를 짓는 중…', 68); G.world.build(G.scene);
  await step('사람들을 깨우는 중…', 82); G.human.prep(); G.fx.init();
  await step('거의 다 됐어요…', 92); G.player.build(); G.ui.init(); G.missions.init();
  // 시작 위치: 내 집 앞
  const safe = G.world.specials.find(s=>s.type === 'safe'); G.player.spawn(safe.x, safe.z + 2, Math.PI);
  G.player.armor = G.save.armor || 0;
  G.player.select('fist');
  if (G.save.garage && G.world.safeGarage){ const g = G.world.safeGarage; const v = G.veh.spawn(G.save.garage.type, g.x, g.z, g.ry, G.save.garage.color); v.parked = true; v.keep = true; }
  G.env.hour = 9.5; G.env.setWeather('clear', true);
  // 한 번 그려서 셰이더 미리 컴파일
  G.player.cam.x = safe.x; G.player.cam.y = 3; G.player.cam.z = safe.z + 8; G.env.update(.016, G.camera.position); G.renderer.compile(G.scene, G.camera);
  await step('준비 완료', 100);
  clearInterval(tipTimer); $('ltip').innerHTML = G.TOUCH ? '왼쪽 조이스틱으로 이동, 오른쪽을 끌어서 카메라. 화면 버튼으로 공격 · 타기!' : '<b>WASD</b> 이동 · <b>마우스</b> 카메라 · <b>F</b> 차 타기 · <b>E</b> 상호작용 · <b>M</b> 지도 · <b>Tab</b> 무기 휠';
  // 그래픽 선택
  const qb = q=>'<button class="' + (G.cfg.quality === q ? 'on' : '') + '" data-q="' + q + '">' + (q ? '그래픽: 좋음' : '그래픽: 빠름') + '</button>';
  $('lopts').innerHTML = qb(0) + qb(1); $('lopts').querySelectorAll('button').forEach(b=>b.onclick = ()=>{ const q = +b.dataset.q; if (q !== G.cfg.quality){ G.cfg.quality = q; G.saveCfg(); location.reload(); } });
  $('lgo').classList.remove('hide'); $('lgo').onclick = start;
  window.__GTA_READY = true;
}
function start(){
  $('load').classList.add('hide'); $('hud').classList.remove('hide'); G.started = true;
  G.audio.init(); G.audio.setVol(G.cfg.vol);
  if (G.TOUCH) G.input.setupTouch(); else G.input.lock();
  G.canvas.addEventListener('click', ()=>{ if (!G.input.locked && !G.ui.open && G.started) G.input.lock(); });
  if (G.save.missions === 0) setTimeout(()=>G.ui.help('노란 <b>1</b> 표시가 첫 미션이에요. 가까이 가서 <kbd>' + (G.TOUCH ? '상호작용' : 'E') + '</kbd>를 누르세요.', 8), 1200);
  // PlayHub 연동 (있으면)
  try { if (!window.__mpFail && window.MP && MP.isConfigured && MP.isConfigured()) MP.initAuthOnly(u=>{ if (u) try { MP.setPresence('gta', null); } catch(e){} }); } catch(e){}
  last = performance.now(); requestAnimationFrame(loop);
}
// 소화전 물줄기
const SPRAYS = []; G.on('hydrant', (x, z)=>SPRAYS.push({ x, z, t:12 }));

let last = 0, saveT = 30, fpsT = 0, frames = 0;
G.slowmo = 1;
function loop(now){
  requestAnimationFrame(loop);
  let dt = Math.min(.05, (now - last)/1000); last = now;
  // FPS 가 너무 낮으면 픽셀 비율을 낮춤
  frames++; fpsT += dt; if (fpsT > 3){ const fps = frames/fpsT; frames = 0; fpsT = 0; if (fps < 26 && G.renderer.getPixelRatio() > .6){ G.renderer.setPixelRatio(Math.max(.6, G.renderer.getPixelRatio() - .15)); if (G.env.comp) G.env.comp.setSize(innerWidth, innerHeight); } }
  if (G.slowmoT > 0){ G.slowmoT -= dt; dt *= .35; }
  dt *= G.slowmo || 1;
  const I = G.input;
  if (G.ui.wheelOn){ G.ui.wheelMouse(I.mdx, I.mdy); I.mdx = I.mdy = 0; }
  tick(dt);
  G.ui.update(dt);
  I.endFrame();
  G.env.render();
}
// 게임 한 단계 (렌더 없이도 돌릴 수 있게 분리)
function tick(dt){
  if (!G.paused){
    const P = G.player; const px = P.inCar ? P.car.x : P.x, pz = P.inCar ? P.car.z : P.z;
    const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion);
    const simT = G.env.hour*60;
    // 차 (AI → 물리)
    for (const v of G.veh.list){ if (v.ai) G.veh.updateAI(v, dt, G.time || 0); }
    for (const v of G.veh.list.slice()){ const far = Math.abs(v.x - px) + Math.abs(v.z - pz) > 260; if (far && !v.ai && v.driver !== 'player') continue; v.update(dt); }
    G.veh.collidePairs(dt);
    P.update(dt);
    G.peds.update(dt, px, pz);
    G.wanted.update(dt);
    G.weapons.update(dt);
    G.missions.update(dt);
    G.veh.manage(dt, px, pz, camDir); G.peds.manage(dt, px, pz);
    G.world.updateSignals(G.time = (G.time || 0) + dt);
    for (let i = SPRAYS.length - 1; i >= 0; i--){ const s = SPRAYS[i]; s.t -= dt; if (s.t <= 0){ SPRAYS.splice(i, 1); continue; } if (Math.random() < .8) G.fx.emit('water', s.x, .6, s.z, 3, .8, 0, 9, 0, 1.4); }
    G.fx.update(dt);
    G.env.update(dt, G.camera.position);
    G.audio.update(dt);
    saveT -= dt; if (saveT <= 0){ saveT = 30; G.save.armor = P.armor; G.writeSave(); }
    void simT;
  }
}
G.tick = (n, dt)=>{ for (let i = 0; i < n; i++){ tick(dt || 1/30); G.input.endFrame(); } };
addEventListener('beforeunload', ()=>{ G.save.armor = G.player.armor; G.writeSave(); });
boot().catch(e=>{ console.error(e); $('ltip').textContent = '오류: ' + e.message; });
})();
