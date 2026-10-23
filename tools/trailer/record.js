// 업데이트 트레일러 녹화기
// 게임 시간을 프레임 단위로 멈췄다 넘기면서 (가상 시계) 한 장씩 찍어 mp4 로 만들어요.
// 느린 컴퓨터(헤드리스 소프트웨어 렌더링)에서도 영상은 30fps 로 부드러워요.
//
//   node tools/trailer/record.js tools/trailer/scenes/<장면>.js trailers/<이름>.mp4
//
// 결과: <out>.mp4 와 같은 이름의 .webm (새 소식 창이 둘 다 써요)
// 필요한 것: playwright (NODE_PATH), ffmpeg (FFMPEG 환경 변수 또는 PATH), 로컬 서버 (BASE, 기본 http://localhost:8790)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const [sceneFile, outFile] = process.argv.slice(2);
if (!sceneFile || !outFile) { console.error('usage: record.js <scene.js> <out.mp4>'); process.exit(1) }
const BASE = process.env.BASE || 'http://localhost:8790';
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FPS = 30, W = 1280, H = 720;

// 가상 시계: 녹화 중에는 requestAnimationFrame · setTimeout · performance.now · Date.now 가 우리가 넘길 때만 흘러요
const VT = `(() => {
  const rp = performance.now.bind(performance), rD = Date.now, rRAF = requestAnimationFrame.bind(window), rST = setTimeout.bind(window), rCT = clearTimeout.bind(window);
  const VT = window.__VT = { on: false, t: 0, q: [], timers: [], id: 1, dbase: 0 };
  performance.now = () => VT.on ? VT.t : rp();
  Date.now = () => VT.on ? VT.dbase + VT.t : rD();
  window.requestAnimationFrame = cb => { if (VT.on) { VT.q.push(cb); return 0 } return rRAF(cb) };
  window.setTimeout = (f, d, ...a) => { if (VT.on && typeof f === 'function') { const id = 1e7 + VT.id++; VT.timers.push({ id, at: VT.t + (d || 0), f, a }); return id } return rST(f, d, ...a) };
  window.clearTimeout = id => { if (id >= 1e7) { VT.timers = VT.timers.filter(t => t.id !== id); return } rCT(id) };
  VT.start = () => { VT.t = rp(); VT.dbase = rD() - VT.t; VT.on = true };
  VT.step = ms => { VT.t += ms; const due = VT.timers.filter(t => t.at <= VT.t); VT.timers = VT.timers.filter(t => t.at > VT.t); for (const t of due) try { t.f(...t.a) } catch (e) { console.error(e) }
    const q = VT.q; VT.q = []; for (const cb of q) try { cb(VT.t) } catch (e) { console.error(e) } };
})();`;

// 자막 · 타이틀 카드 (가상 시계로 움직여요)
const CAP = `(() => {
  const st = document.createElement('style'); st.textContent = \`
  #trCap{position:fixed;left:56px;bottom:120px;z-index:999;pointer-events:none;font-family:Galmuri11,monospace;color:#fff;max-width:70vw}
  #trCap .k{display:inline-block;background:#ffe14d;color:#2a2a00;font-size:15px;padding:3px 10px;margin-bottom:8px;letter-spacing:1px}
  #trCap .t{font-size:46px;text-shadow:4px 4px 0 #222,0 0 18px rgba(0,0,0,.6);line-height:1.15}
  #trCap .s{font-size:20px;margin-top:8px;color:#e8e8e8;text-shadow:2px 2px 0 #222}
  #trCard{position:fixed;inset:0;z-index:998;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Galmuri11,monospace;color:#fff;text-align:center;background:radial-gradient(ellipse at center,rgba(0,0,0,.35),rgba(0,0,0,.85))}
  #trCard h1{font-size:84px;letter-spacing:3px;color:#e0e0e0;text-shadow:6px 6px 0 #3a3a3a;margin:0}
  #trCard h1 b{color:#ffe14d}
  #trCard .s{font-size:26px;margin-top:14px;color:#ffff55;text-shadow:3px 3px 0 #3f3f00}
  #trCard ul{list-style:none;padding:0;margin:22px 0 0;font-size:24px;line-height:1.75;text-align:left}
  #trCard li::before{content:'▸ ';color:#ffe14d}\`; document.head.appendChild(st);
  const cap = document.createElement('div'); cap.id = 'trCap'; document.body.appendChild(cap);
  const card = document.createElement('div'); card.id = 'trCard'; card.style.opacity = 0; document.body.appendChild(card);
  const TR = window.__TR = { capT: -1, capD: 0, cardT: -1, cardD: 0 };
  TR.caption = (k, t, s, dur, top) => { cap.style.top = top ? '64px' : ''; cap.style.bottom = top ? '' : '120px'; cap.innerHTML = (k ? '<div class="k">' + k + '</div>' : '') + '<div class="t">' + t + '</div>' + (s ? '<div class="s">' + s + '</div>' : ''); TR.capT = __VT.t; TR.capD = dur * 1000 };
  TR.card = (html, dur) => { card.innerHTML = html; TR.cardT = __VT.t; TR.cardD = dur * 1000 };
  TR.tick = () => { const f = (t0, d) => { if (t0 < 0) return 0; const a = __VT.t - t0; if (a > d) return 0; return Math.min(1, a / 350, (d - a) / 350) };
    const c = f(TR.capT, TR.capD); cap.style.opacity = c; cap.style.transform = 'translateX(' + ((1 - c) * -40) + 'px)';
    card.style.opacity = f(TR.cardT, TR.cardD) };
})();`;

(async () => {
  const scene = require(path.resolve(sceneFile));
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'trailer-'));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: W, height: H } });
  await ctx.addInitScript(VT);
  await ctx.route(/fonts\.googleapis|fonts\.gstatic/, r => r.abort());
  // 녹화할 땐 혼자 하는 게임이라 서버 연결 (multiplayer.js) 대신 오프라인 대역을 써요
  const MP_STUB = `window.MP={isConfigured:()=>false,serverNow:()=>Date.now(),getDisplayName:()=>'Steve',getNickname:()=>'Steve',setPresence(){},initAuthOnly(){},get(k,d){return d},set(){},has(){return false},clear(){}};`;
  await ctx.route(/multiplayer\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: MP_STUB }));
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto(BASE + '/' + scene.page);
  await page.waitForTimeout(scene.loadWait || 6000);

  let n = 0;
  const rec = {
    page,
    // 녹화 없이 실제 시간으로 기다리기 (청크 로딩 등 준비용)
    wait: ms => page.waitForTimeout(ms),
    eval: (fn, arg) => page.evaluate(fn, arg),
    // 녹화: sec 초 동안 매 프레임 each(t) 를 실행하고 찍어요
    async shoot(sec, each, arg) {
      const frames = Math.round(sec * FPS);
      for (let i = 0; i < frames; i++) {
        await page.evaluate(([src, t, a]) => { if (src) (0, eval)('(' + src + ')')(t, a); __VT.step(1000 / 30); __TR.tick() }, [each ? each.toString() : null, i / FPS, arg]);
        await page.screenshot({ path: path.join(tmp, String(n++).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 90 });
        if (n % 60 === 0) process.stdout.write(`\r${(n / FPS).toFixed(1)}s`);
      }
    },
    caption: (k, t, s, dur, top) => page.evaluate(a => __TR.caption(...a), [k, t, s, dur, !!top]),
    card: (html, dur) => page.evaluate(a => __TR.card(...a), [html, dur]),
  };
  await scene.prepare(rec);
  await page.evaluate(CAP);
  await page.evaluate(() => __VT.start());
  await scene.play(rec);
  await b.close();
  console.log(`\n${n} frames → ${outFile}`);
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  // 10MB 를 넘으면 crf 를 올려서 다시 만들어요 (비 · 눈처럼 잔무늬가 많으면 커져요)
  const LIMIT = 9.5e6, fit = (file, crf0, step, max, args) => { let crf = crf0; for (;;) { execFileSync(FFMPEG, args(crf), { stdio: 'inherit' }); const sz = fs.statSync(file).size; if (sz <= LIMIT || crf >= max) return; crf += step; console.log(`${path.basename(file)} ${(sz / 1e6).toFixed(1)}MB → crf ${crf}`) } };
  fit(outFile, +(process.env.CRF || 27), 2, 41, crf => ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(tmp, '%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', String(crf), '-preset', 'slow', '-movflags', '+faststart', outFile]);
  // 브라우저마다 되는 형식이 달라서 webm 도 같이 만들어요 (mp4 를 못 트는 브라우저용)
  const webm = outFile.replace(/\.mp4$/, '.webm');
  fit(webm, +(process.env.WEBM_CRF || 40), 3, 58, crf => ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(tmp, '%05d.jpg'), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(crf), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', webm]);
  fs.copyFileSync(path.join(tmp, String(Math.min(n - 1, 6 * FPS)).padStart(5, '0') + '.jpg'), outFile.replace(/\.mp4$/, '.jpg'));   // 영상 표지
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('done', (fs.statSync(outFile).size / 1e6).toFixed(1) + 'MB', '· webm', (fs.statSync(webm).size / 1e6).toFixed(1) + 'MB');
})();
