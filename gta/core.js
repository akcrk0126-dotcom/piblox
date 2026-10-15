// =====================================================================
//  SAN LUNA — 공용 도구 · 입력 · 저장
//  모든 파일은 전역 G 하나를 같이 쓴다
// =====================================================================
'use strict';
window.G = window.G || {};
(function(){
const U = G.U = {};
U.clamp = (v, a, b)=>v < a ? a : v > b ? b : v;
U.lerp = (a, b, t)=>a + (b - a)*t;
U.rnd = (a, b)=>a + Math.random()*(b - a);
U.ri = (a, b)=>a + Math.floor(Math.random()*(b - a + 1));
U.pick = a=>a[Math.floor(Math.random()*a.length)];
U.angDiff = (a, b)=>{ let d = b - a; while (d > Math.PI) d -= Math.PI*2; while (d < -Math.PI) d += Math.PI*2; return d; };
U.damp = (a, b, k, dt)=>a + (b - a)*(1 - Math.exp(-k*dt));
U.dampAng = (a, b, k, dt)=>a + U.angDiff(a, b)*(1 - Math.exp(-k*dt));
U.smooth = t=>t*t*(3 - 2*t);
U.fmtMoney = n=>'$' + Math.floor(n).toLocaleString('en-US');
U.esc = s=>String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
// 결정적 난수 (도시 배치가 매번 같게)
U.seeded = seed=>{ let s = seed >>> 0 || 1; return ()=>{ s = (s*1664525 + 1013904223) >>> 0; return s/4294967296; }; };
U.hash2 = (x, y)=>{ let h = (x*374761393 + y*668265263) | 0; h = (h ^ (h >>> 13))*1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0)/4294967296; };
U.$ = id=>document.getElementById(id);

G.TOUCH = ('ontouchstart' in window) || matchMedia('(pointer:coarse)').matches;
G.LOW = G.TOUCH || (innerWidth*innerHeight < 700000);
const LS = G.LS = { get(k, d){ try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch(e){ return d; } }, set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} } };

// 그래픽 설정
G.cfg = Object.assign({ quality:G.LOW ? 0 : 1, sens:1, invertY:false, vol:.8, radioVol:.6, fov:62 }, LS.get('sl_cfg', {}));
G.saveCfg = ()=>LS.set('sl_cfg', G.cfg);

// =====================================================================
//  입력
// =====================================================================
const I = G.input = { keys:{}, pressed:{}, mdx:0, mdy:0, mouseL:false, mouseR:false, wheel:0, locked:false,
  joy:{ x:0, y:0, on:false }, look:{ dx:0, dy:0 }, tb:{}, tbPressed:{}, typed:'' };
addEventListener('keydown', e=>{
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  const k = e.code; if (!I.keys[k]) I.pressed[k] = true; I.keys[k] = true;
  if (e.key && e.key.length === 1){ I.typed = (I.typed + e.key.toUpperCase()).slice(-16); }
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
});
addEventListener('keyup', e=>{ I.keys[e.code] = false; });
addEventListener('blur', ()=>{ I.keys = {}; I.mouseL = I.mouseR = false; });
addEventListener('mousemove', e=>{ if (I.locked){ I.mdx += e.movementX; I.mdy += e.movementY; } });
addEventListener('mousedown', e=>{ if (!I.locked) return; if (e.button === 0){ I.mouseL = true; I.pressed.Mouse0 = true; } if (e.button === 2){ I.mouseR = true; I.pressed.Mouse2 = true; } });
addEventListener('mouseup', e=>{ if (e.button === 0) I.mouseL = false; if (e.button === 2) I.mouseR = false; });
addEventListener('contextmenu', e=>e.preventDefault());
addEventListener('wheel', e=>{ if (I.locked) I.wheel += Math.sign(e.deltaY); }, { passive:true });
document.addEventListener('pointerlockchange', ()=>{ I.locked = document.pointerLockElement === G.canvas; if (G.onLockChange) G.onLockChange(I.locked); });
I.down = k=>!!I.keys[k] || !!I.tb[k];
I.hit = k=>!!I.pressed[k] || !!I.tbPressed[k];
I.endFrame = ()=>{ I.pressed = {}; I.tbPressed = {}; I.mdx = I.mdy = 0; I.wheel = 0; I.look.dx = I.look.dy = 0; };
I.lock = ()=>{ if (G.TOUCH || !G.canvas) return; try { const p = G.canvas.requestPointerLock(); if (p && p.catch) p.catch(()=>{}); } catch(e){} };

// ----- 터치 조작 -----
I.setupTouch = ()=>{
  const joyEl = U.$('joy'), knob = U.$('knob'); let jid = null, jx = 0, jy = 0;
  const R = 52;
  joyEl.addEventListener('touchstart', e=>{ e.preventDefault(); const t = e.changedTouches[0]; jid = t.identifier; const r = joyEl.getBoundingClientRect(); jx = r.left + r.width/2; jy = r.top + r.height/2; move(t); }, { passive:false });
  const move = t=>{ let dx = t.clientX - jx, dy = t.clientY - jy; const d = Math.hypot(dx, dy); if (d > R){ dx *= R/d; dy *= R/d; } knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; I.joy.x = dx/R; I.joy.y = dy/R; I.joy.on = true; };
  addEventListener('touchmove', e=>{ for (const t of e.changedTouches){ if (t.identifier === jid) move(t); } }, { passive:true });
  const end = e=>{ for (const t of e.changedTouches){ if (t.identifier === jid){ jid = null; I.joy.x = I.joy.y = 0; I.joy.on = false; knob.style.transform = ''; } } };
  addEventListener('touchend', end); addEventListener('touchcancel', end);
  // 화면 오른쪽 드래그 = 카메라
  const lookId = new Map();
  G.canvas.addEventListener('touchstart', e=>{ for (const t of e.changedTouches){ if (t.clientX > innerWidth*.35) lookId.set(t.identifier, [t.clientX, t.clientY]); } }, { passive:true });
  addEventListener('touchmove', e=>{ for (const t of e.changedTouches){ const p = lookId.get(t.identifier); if (p){ I.look.dx += (t.clientX - p[0]); I.look.dy += (t.clientY - p[1]); p[0] = t.clientX; p[1] = t.clientY; } } }, { passive:true });
  const lend = e=>{ for (const t of e.changedTouches) lookId.delete(t.identifier); };
  addEventListener('touchend', lend); addEventListener('touchcancel', lend);
  // 버튼: data-k 로 가상 키
  document.querySelectorAll('[data-tk]').forEach(b=>{
    const k = b.dataset.tk, tog = b.hasAttribute('data-toggle');
    b.addEventListener('touchstart', e=>{ e.preventDefault(); e.stopPropagation(); if (tog){ I.tb[k] = !I.tb[k]; b.classList.toggle('on', I.tb[k]); } else { I.tb[k] = true; b.classList.add('on'); } I.tbPressed[k] = true; }, { passive:false });
    const up = e=>{ if (tog) return; e.preventDefault(); I.tb[k] = false; b.classList.remove('on'); };
    b.addEventListener('touchend', up, { passive:false }); b.addEventListener('touchcancel', up, { passive:false });
  });
};

// =====================================================================
//  저장
// =====================================================================
const DEF_SAVE = { money:500, weapons:{ fist:1 }, ammo:{}, armor:0, missions:0, packages:[], jumps:[], look:null, stats:{ kills:0, cars:0, dist:0, time:0, maxWanted:0, busted:0, wasted:0, taxi:0, jumps:0 }, garage:null, cheats:0, ver:1 };
G.save = Object.assign({}, DEF_SAVE, LS.get('sl_save', {}));
G.save.stats = Object.assign({}, DEF_SAVE.stats, G.save.stats || {});
G.writeSave = ()=>LS.set('sl_save', G.save);
G.resetSave = ()=>{ G.save = JSON.parse(JSON.stringify(DEF_SAVE)); G.writeSave(); };

// 이벤트 버스
const BUS = {}; G.on = (n, f)=>{ (BUS[n] = BUS[n] || []).push(f); }; G.emit = (n, ...a)=>{ for (const f of BUS[n] || []) try { f(...a); } catch(e){ console.error(e); } };
})();
