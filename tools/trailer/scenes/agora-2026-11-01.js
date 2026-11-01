// 룬 아고라 2026-11-01 업데이트 트레일러: 「가시와 룬의 노래」 — 지역마다 이야기 · 마을 8곳 · 룬 탑 · 삼각형 언덕 · 세상이 바뀌는 장 연출
module.exports = {
  page: 'agora.html',
  loadWait: 6000,
  async prepare(rec) {
    // 영상용 세이브: 1장 진행 중 · 글라이더 · 룬 비석 몇 개
    await rec.eval(() => {
      const clr = {}; for (let i = 1; i <= 12; i++) clr[i] = { e: 3 };
      localStorage.setItem('agora_gfx', 'high'); localStorage.setItem('agora_news', 'x');
      localStorage.setItem('agora_story_v1', JSON.stringify({ sword: true, rune: true, lv: 16, str: 22, vit: 20, agi: 12, int: 10, pts: 0, clr, job: 'sword', asc: true, statTut: true, gold: 32000,
        cos: { own: [], eq: { hat: 'crown', back: 'angel', wpn: 'holy', aura: 'stardust' } },
        q: { act: {}, done: { c0_1: 1, c0_2: 1, c0_3: 1 }, track: [] },
        saga: { ch: { 0: { intro: true, outro: true, t: 1 }, 1: { intro: true } }, read: {}, cleansed: { ks_village: 1 }, picked: {}, sboss: {}, met: {} },
        field: { disc: {}, wps: ['wp_village', 'wp_windmill', 'wp_hunter', 'wp_lake', 'wp_moon', 'wp_swamp'], lastWp: 'wp_village', glider: true, visits: 3 } }));
    });
    await rec.page.reload();
    await rec.page.waitForFunction(() => window.__field && window.__field.ready, null, { timeout: 600000 });
    await rec.eval(() => { const st = document.createElement('style'); st.textContent = '#hint,#keys,#lchat,#rpgTrk,#rpgNav{display:none!important}'; document.head.appendChild(st); window.__agora.start(); });
    await rec.wait(5000);
    await rec.eval(() => window.__field.enter({ x: 0, z: 600, face: Math.PI }));
    await rec.page.waitForFunction(() => window.__field.inField && !window.__agora.G.lock, null, { timeout: 300000 });
    await rec.wait(20000);   // 지형 · 셰이더 준비 (실제 시간)
  },
  async play(rec) {
    await rec.eval(() => { const st = document.createElement('style'); st.textContent = `#trCap,#trCard{font-family:'Gowun Batang',serif!important}
      #trCap .k{background:linear-gradient(180deg,#fff2c9,#e2b964)!important;color:#20160a!important;font:700 15px 'Cinzel',serif!important;letter-spacing:3px}
      #trCap .t{font-weight:900;text-shadow:0 3px 14px rgba(0,0,0,.8),0 0 2px #000!important} #trCard h1{font-family:'Cinzel',serif!important;color:#fff3d6!important;text-shadow:0 4px 24px rgba(0,0,0,.8)!important}
      #trCard h1 b{color:#e9c87e!important} #trCard .s{color:#7ff3ff!important;text-shadow:0 0 12px rgba(127,243,255,.6)!important;letter-spacing:4px}
      #trCard li::before{color:#e9c87e!important} #fregion,#lmfound{display:none!important}`; document.head.appendChild(st); });
    const skip = async sec => { for (let i = 0; i < sec * 30; i++) await rec.eval(() => __VT.step(1000 / 30)) };
    const tp = async (x, z, face, sec = 2.5) => { await rec.eval(([x, z, face]) => { const F = window.__field, X = window.__story.X; X.cleanupBattle(); X.player.pos.set(x, F.groundFn(x, z) + 0.05, z); X.player.vy = 0; X.fig.root.rotation.y = face; window.__agora.G.setCam(face + Math.PI, 0.26, 8.5); }, [x, z, face]); await skip(sec) };
    // 카메라 경로: 지면 위 높이(dy)로 a → b, la → lb 를 바라봐요
    const fly = (sec, a, b, la, lb) => rec.shoot(sec, (t, [a, b, la, lb, sec]) => { const k = t / sec, e = k * k * (3 - 2 * k), L = (u, v) => u + (v - u) * e, G = window.__agora.G, F = window.__field;
      const x = L(a[0], b[0]), z = L(a[2], b[2]), lx = L(la[0], lb[0]), lz = L(la[2], lb[2]);
      G.camOverride = { pos: new G.THREE.Vector3(x, F.groundFn(x, z) + L(a[1], b[1]), z), look: new G.THREE.Vector3(lx, F.groundFn(lx, lz) + L(la[1], lb[1]), lz) }; }, [a, b, la, lb, sec]);
    const free = () => rec.eval(() => { window.__agora.G.camOverride = null });
    const tod = t => rec.eval(t => window.__field.setTimeOfDay && window.__field.setTimeOfDay(t), t);

    // 1) 타이틀 — 삼각형 언덕 너머로 룬 탑과 먼 산맥
    await tod(0.38);
    await rec.card('<h1>RUNE <b>AGORA</b></h1><div class="s">「가시와 룬의 노래」 · 2026.11.01</div>', 5.4);
    await fly(7, [40, 26, 470], [60, 34, 410], [72, 30, 352], [70, 40, 280]);

    // 2) 땅이 넓어 보이게: 언덕 · 탑 · 구름 그림자 · 먼 산맥
    await rec.caption('WORLD', '넘으면 보이는 땅', '크고 작은 언덕 393개가 너머를 가려요 · 멀리서도 보이는 룬 탑 8개 · 흘러가는 구름 그림자 · 지평선 너머 산맥', 7.2);
    await fly(8, [-60, 60, 520], [-20, 70, 300], [80, 20, 340], [0, 10, 120]);

    // 3) 지역마다 이야기 — 장 시작 연출
    await free(); await tp(-345, 316, Math.PI, 2);
    await rec.eval(() => window.__field.saga.playIntro(2));
    await rec.caption('STORY', '지역마다 이야기', '서장 + 8장 + 에필로그 · 메인 퀘스트 59개 — 사라진 소녀, 멈춘 풍차, 가라앉은 신전, 거인의 아이 …', 6.8, true);
    await rec.shoot(13, () => {});
    await rec.eval(() => { const M = window.__field.modules.saga; if (M && M.cine) document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' })); });
    await skip(2); await free();

    // 4) 사람이 사는 마을 8곳
    await rec.caption('TOWNS', '사람이 사는 마을 8곳', '볕드는 농원 · 잎새 마을 · 물안개 나루 · 갈대 말뚝 마을 · 붉은 먼지 광산촌 · 별지기 야영지 · 가시 파수대 · 서리 수도원', 14.5);
    await fly(4.6, [-150, 30, 590], [-80, 26, 580], [-112, 4, 548], [-112, 4, 540]);
    await fly(4.6, [-300, 34, 340], [-380, 30, 330], [-345, 8, 300], [-345, 8, 296]);
    await fly(4.6, [140, 26, 240], [60, 24, 230], [92, 2, 196], [92, 2, 186]);
    await tod(0.88);
    await fly(4.6, [360, 24, 360], [380, 22, 270], [415, 2, 318], [418, 2, 322]);
    await tod(0.4);
    await fly(4.6, [380, 30, -160], [470, 28, -170], [424, 4, -212], [424, 4, -214]);
    await fly(4.6, [60, 36, -150], [-40, 34, -160], [8, 4, -206], [8, 4, -210]);

    // 5) 주민들 — 장에 따라 바뀌는 대사
    await free(); await tp(-104, 551, Math.PI * 1.3, 1);
    await rec.caption('PEOPLE', '주민 42명', '밭일하고 비질하고 기도하고 — 이야기가 진행되면 하는 말이 바뀌어요', 6.4);
    await rec.shoot(7, t => { if (Math.abs(t - 0.5) < 0.02 && window.__field.saga) { const G = window.__agora.G; G.setCam(Math.PI * 0.3, 0.22, 7); } });

    // 6) 읽을거리 · 수호석 의식 · 세상이 바뀌는 순간 (1장 끝: 풍차가 다시 돌아요)
    await tp(-156, 470, Math.PI, 1.5);
    await rec.eval(() => { const M = window.__field.modules.saga; M && M.openRead('r_gh_windstone'); });
    await rec.caption('LORE', '읽을거리 65개', '석판 · 일기 · 편지 · 묘비 · 동요 — 모으면 연대기에 기록돼요', 5.2);
    await rec.shoot(5.4, () => {});
    await rec.eval(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' })));
    await tp(-160, 466, Math.PI * 1.1, 1);
    await rec.eval(() => { const G = window.__agora.G, M = window.__field.modules.saga; G.keys.KeyE = true; M && M.startRitual('ks_greenhill'); });
    await rec.caption('RUNE', '수호석에 룬을 새기면', '여섯 수호석과 하늘 끝의 마지막 룬 — 장이 끝나면 세상이 바뀌어요', 6.2);
    await rec.shoot(3.6, () => {});
    await rec.eval(() => { window.__agora.G.keys.KeyE = false; const M = window.__field.modules.saga; M && M.playOutro(1); });
    await rec.shoot(13, () => {});
    await free();

    // 7) 룬 탑: 깨우면 지도가 열리고 바람을 타고 꼭대기로
    await tp(72, 360, Math.PI, 1.5);
    await rec.eval(() => { const F = window.__field, t = (F.towers || [])[0]; if (!t) return; const P = window.__story.X.player.pos; P.set(t.x, F.groundFn(t.x, t.z + 6.5) + 0.05, t.z + 6.5); F.wakeTower(t.id); });
    await rec.caption('TOWER', '룬 탑', '깨우면 둘레 지도가 열리고 · 탑을 감싼 바람을 타면 꼭대기까지 날아올라요', 7);
    await rec.shoot(2.5, () => {});
    await rec.shoot(9, t => { const k = window.__agora.G.keys, X = window.__story.X, F = window.__field, tw = F.towers[0];
      if (t < 0.1){ X.player.pos.x = tw.x + 7; X.player.pos.z = tw.z; X.player.vy = 7.6; X.player.ground = false; }
      k.Space = t > 0.25; k.KeyW = t > 6.2; window.__agora.G.setCam(Math.PI * 0.5 + t * 0.25, 0.32, 10); });
    await rec.eval(() => { const k = window.__agora.G.keys; k.KeyW = k.Space = false });

    // 8) 연대기
    await tp(-112, 548, Math.PI, 1);
    await rec.eval(() => window.__field.saga.openCodex('ch'));
    await rec.caption('CODEX', '연대기 (N)', '장 진행 · 모은 기록 · 만난 사람 · 수호석', 4.6);
    await rec.shoot(5, () => {});
    await rec.eval(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' })));

    // 9) 에필로그: 새싹 마을 축제의 밤
    await tod(0.9);
    await rec.eval(() => { const T = window.__field.towns; T && T.setChange('festival', true, true); });
    await rec.caption('EPILOGUE', '바람개비 노래', '하늘 끝에 별 하나 꺼지지 말아라 — 마지막 룬을 새기면 마을에 축제가 열려요', 6.6);
    await fly(7.5, [60, 22, 620], [-40, 18, 600], [0, 6, 556], [0, 6, 546]);

    // 10) 마무리
    await tod(0.4); await free();
    await rec.card('<h1>RUNE <b>AGORA</b></h1><div class="s">아르카디아에 이야기가 생겼어요</div><ul><li>서장 + 8장 + 에필로그 · 메인 59 · 의뢰 30</li><li>마을 8곳 · 주민 42명 · 읽을거리 65 · 이야기 소품 139</li><li>삼각형 언덕 · 룬 탑 8개 · 구름 그림자 · 먼 산맥</li><li>장 연출 · 연대기 · 수호석 의식 · 이야기 보스</li></ul>', 6);
    await fly(6.5, [72, 40, 420], [72, 70, 470], [72, 50, 352], [72, 60, 352]);
  },
};
