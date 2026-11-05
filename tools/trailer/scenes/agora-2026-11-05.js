// 룬 아고라 2026-11-05 업데이트 트레일러: 「요란한 대지」 — 날카로운 능선 · 층층 절벽 · 협곡 세 곳 · 바위 아치 · 후두 · 얼음 첨탑 · 흑요석 파편
module.exports = {
  page: 'agora.html',
  loadWait: 6000,
  async prepare(rec) {
    await rec.eval(() => {
      const clr = {}; for (let i = 1; i <= 12; i++) clr[i] = { e: 3 };
      localStorage.setItem('agora_gfx', 'high'); localStorage.setItem('agora_news', 'x');
      localStorage.setItem('agora_story_v1', JSON.stringify({ sword: true, rune: true, lv: 30, str: 30, vit: 26, agi: 16, int: 10, pts: 0, clr, job: 'sword', asc: true, statTut: true, gold: 32000,
        cos: { own: [], eq: { hat: 'crown', back: 'angel', wpn: 'holy', aura: 'stardust' } },
        q: { act: {}, done: { c0_1: 1, c0_2: 1, c0_3: 1 }, track: [] },
        saga: { ch: { 0: { intro: true, outro: true, t: 1 }, 1: { intro: true } }, read: {}, cleansed: { ks_village: 1 }, picked: {}, sboss: {}, met: {} },
        field: { disc: {}, wps: ['wp_village', 'wp_windmill', 'wp_hunter', 'wp_lake', 'wp_moon', 'wp_swamp'], lastWp: 'wp_village', glider: true, visits: 3 } }));
    });
    await rec.page.reload();
    await rec.page.waitForFunction(() => window.__field && window.__field.ready, null, { timeout: 600000 });
    await rec.eval(() => { const st = document.createElement('style'); st.textContent = '#hint,#keys,#lchat,#rpgTrk,#rpgNav,#fregion,#lmfound{display:none!important}'; document.head.appendChild(st); window.__agora.start(); });
    await rec.wait(5000);
    await rec.eval(() => window.__field.enter({ x: 330, z: -230, face: Math.PI }));
    await rec.page.waitForFunction(() => window.__field.inField && !window.__agora.G.lock, null, { timeout: 300000 });
    await rec.wait(20000);   // 지형 · 셰이더 준비 (실제 시간)
  },
  async play(rec) {
    await rec.eval(() => { const st = document.createElement('style'); st.textContent = `#trCap,#trCard{font-family:'Gowun Batang',serif!important}
      #trCap .k{background:linear-gradient(180deg,#fff2c9,#e2b964)!important;color:#20160a!important;font:700 15px 'Cinzel',serif!important;letter-spacing:3px}
      #trCap .t{font-weight:900;text-shadow:0 3px 14px rgba(0,0,0,.8),0 0 2px #000!important} #trCard h1{font-family:'Cinzel',serif!important;color:#fff3d6!important;text-shadow:0 4px 24px rgba(0,0,0,.8)!important}
      #trCard h1 b{color:#e9c87e!important} #trCard .s{color:#7ff3ff!important;text-shadow:0 0 12px rgba(127,243,255,.6)!important;letter-spacing:4px}
      #trCard li::before{color:#e9c87e!important}`; document.head.appendChild(st); document.body.classList.add('cine'); });   // 경치 영상이라 HUD 는 숨겨요
    const step = n => rec.eval(n => { for (let i = 0; i < n; i++) __VT.step(1000 / 30) }, n);
    const camSet = (a, la) => rec.eval(([a, la]) => { const G = window.__agora.G, F = window.__field;
      G.camOverride = { pos: new G.THREE.Vector3(a[0], F.groundFn(a[0], a[2]) + a[1], a[2]), look: new G.THREE.Vector3(la[0], F.groundFn(la[0], la[2]) + la[1], la[2]) }; }, [a, la]);
    // 다음 장면 준비 (녹화 안 함): 플레이어를 근처로 옮기고 (가까운 바위 칸 · 식생이 켜지게) 카메라를 첫 자리에 미리 붙여 둬요
    //   (카메라 덮어쓰기는 부드럽게 따라가서, 미리 붙여 두지 않으면 앞 장면 자리에서 지도를 가로질러 날아와요)
    const go = async (x, z, a, la) => { await rec.eval(([x, z]) => { const F = window.__field, X = window.__story.X; X.cleanupBattle(); X.player.pos.set(x, F.groundFn(x, z) + 0.05, z); X.player.vy = 0; }, [x, z]);
      await camSet(a, la); await step(75); };
    // 카메라 경로: 지면 위 높이(dy)로 a → b, la → lb 를 바라봐요 (TRPREVIEW=1 이면 처음 · 끝 두 장만)
    const PV = !!process.env.TRPREVIEW;
    const fly = async (sec, a, b, la, lb) => { if (PV){ await rec.shoot(1 / 30, () => {}); await camSet(b, lb); await step(75); return rec.shoot(1 / 30, () => {}); }
      return rec.shoot(sec, (t, [a, b, la, lb, sec]) => { const k = t / sec, e = k * k * (3 - 2 * k), L = (u, v) => u + (v - u) * e, G = window.__agora.G, F = window.__field;
      const x = L(a[0], b[0]), z = L(a[2], b[2]), lx = L(la[0], lb[0]), lz = L(la[2], lb[2]);
      G.camOverride = { pos: new G.THREE.Vector3(x, F.groundFn(x, z) + L(a[1], b[1]), z), look: new G.THREE.Vector3(lx, F.groundFn(lx, lz) + L(la[1], lb[1]), lz) }; }, [a, b, la, lb, sec]); };
    const tod = t => rec.eval(t => window.__field.setTimeOfDay && window.__field.setTimeOfDay(t), t);

    // 1) 타이틀 — 협곡의 층층 절벽과 후두
    await tod(0.36);
    await go(330, -230, [300, 40, -170], [380, 20, -260]);
    await rec.card('<h1>RUNE <b>AGORA</b></h1><div class="s">「요란한 대지」 · 2026.11.05</div>', 5.2);
    await fly(7, [300, 40, -170], [330, 30, -205], [380, 20, -260], [380, 16, -280]);

    // 2) 날카로운 능선 · 층층 절벽
    await go(-380, -300, [-300, 70, -240], [-420, 30, -330]);
    await rec.caption('TERRAIN', '깎아지른 능선', '지역마다 날카로운 능선과 층층이 쌓인 절벽 — 고원 · 협곡 · 설원은 계단처럼 깎였어요', 6.6);
    await fly(7.5, [-300, 70, -240], [-360, 60, -260], [-420, 30, -330], [-440, 26, -360]);

    // 3) 바위 아치
    await go(257, -340, [230, 18, -300], [257, 22, -360]);
    await rec.caption('ARCH', '바위 아치 9개', '말발굽 아치 · 하늘 문 · 여우 다리 — 아래로 걸어서 지나갈 수 있어요', 6.4);
    await fly(6.5, [230, 18, -300], [250, 12, -322], [257, 22, -360], [257, 24, -364]);
    await go(-118, 290, [-150, 10, 250], [-118, 8, 271]);
    await fly(5, [-150, 10, 250], [-130, 7, 262], [-118, 8, 271], [-118, 8, 274]);

    // 4) 협곡 세 곳
    await go(220, 492, [176, 14, 590], [206, 2, 520]);
    await rec.caption('GORGE', '협곡 세 곳', '바람골 협곡 · 뿌리 골짜기 · 왕의 골짜기 — 바닥엔 개울이 흘러요', 6.4);
    await fly(7.5, [176, 14, 590], [230, 12, 470], [206, 2, 520], [262, 4, 410]);

    // 5) 바이옴마다 다른 바위
    await tod(0.8);
    await go(10, -250, [-20, 24, -200], [30, 6, -290]);
    await rec.caption('ROCKS', '바위 1만 개', '협곡 후두 · 균형 바위 · 고원 돌기둥 · 호숫가 바다 기둥 · 서리 얼음 첨탑 · 침식지 흑요석 파편', 7);
    await fly(5, [-20, 24, -200], [10, 18, -230], [30, 6, -290], [30, 6, -300]);
    await tod(0.4);
    await go(-200, -510, [-160, 40, -480], [-200, 30, -527]);
    await fly(5.5, [-160, 40, -480], [-180, 34, -500], [-200, 30, -527], [-210, 30, -530]);
    await go(40, 200, [60, 16, 220], [0, 4, 150]);
    await fly(5, [60, 16, 220], [40, 12, 210], [0, 4, 150], [-10, 4, 140]);

    // 6) 마무리 — 높은 곳에서 내려다본 대지
    await go(-330, -230, [-250, 90, -180], [-380, 20, -320]);
    await rec.card('<h1>RUNE <b>AGORA</b></h1><div class="s">땅이 이야기를 해요</div><ul><li>날카로운 능선 · 층층 절벽 · 계단 고원</li><li>협곡 3곳 · 바위 아치 9개 (이름 3곳)</li><li>후두 · 돌기둥 · 얼음 첨탑 · 흑요석 · 바다 기둥</li><li>언덕 꼭대기 바위 왕관 · 절벽 아래 너덜</li></ul>', 6.4);
    await fly(7, [-250, 90, -180], [-280, 110, -200], [-380, 20, -320], [-400, 20, -340]);
  },
};
