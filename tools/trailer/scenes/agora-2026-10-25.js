// 룬 아고라 2026-10-25 업데이트 트레일러: 모험의 대지 아르카디아 (오픈 월드 · 사냥터 · 글라이더 · 레이드 · 낚시)
module.exports = {
  page: 'agora.html',
  loadWait: 6000,
  async prepare(rec) {
    // 영상용 세이브: 각성한 검성 · 의상 · 글라이더 · 룬 비석 몇 개 · 레이드 열림
    await rec.eval(() => {
      const clr = {}; for (let i = 1; i <= 12; i++) clr[i] = { e: 3 };
      localStorage.setItem('agora_gfx', 'high'); localStorage.setItem('agora_news', 'x');
      localStorage.setItem('agora_story_v1', JSON.stringify({ sword: true, rune: true, lv: 19, str: 26, vit: 22, agi: 14, int: 12, pts: 0, clr, job: 'sword', asc: true, statTut: true, gold: 42000,
        cos: { own: [], eq: { hat: 'crown', back: 'angel', wpn: 'holy', aura: 'stardust' } },
        field: { disc: {}, wps: ['wp_village', 'wp_windmill', 'wp_hunter', 'wp_lake', 'wp_moon', 'wp_swamp'], lastWp: 'wp_village', glider: true, visits: 3 } }));
    });
    await rec.page.reload();
    await rec.page.waitForFunction(() => window.__field && window.__field.ready, null, { timeout: 600000 });
    await rec.eval(() => { const st = document.createElement('style'); st.textContent = '#hint,#keys{display:none!important}'; document.head.appendChild(st); window.__agora.start(); });
    await rec.wait(5000);
    await rec.eval(() => window.__field.enter({ x: 0, z: 600, face: Math.PI }));
    await rec.page.waitForFunction(() => window.__field.inField && !window.__agora.G.lock, null, { timeout: 300000 });
    await rec.wait(20000);   // 지형 · 셰이더 준비 (실제 시간)
  },
  async play(rec) {
    // 자막 글꼴을 게임 분위기로
    await rec.eval(() => { const st = document.createElement('style'); st.textContent = `#trCap,#trCard{font-family:'Gowun Batang',serif!important}
      #trCap .k{background:linear-gradient(180deg,#fff2c9,#e2b964)!important;color:#20160a!important;font:700 15px 'Cinzel',serif!important;letter-spacing:3px}
      #trCap .t{font-weight:900;text-shadow:0 3px 14px rgba(0,0,0,.8),0 0 2px #000!important} #trCard h1{font-family:'Cinzel',serif!important;color:#fff3d6!important;text-shadow:0 4px 24px rgba(0,0,0,.8)!important}
      #trCard h1 b{color:#e9c87e!important} #trCard .s{color:#7ff3ff!important;text-shadow:0 0 12px rgba(127,243,255,.6)!important;letter-spacing:4px}
      #trCard li::before{color:#e9c87e!important}`; document.head.appendChild(st); });
    const skip = async sec => { for (let i = 0; i < sec * 30; i++) await rec.eval(() => __VT.step(1000 / 30)) };
    const tp = async (x, z, face, sec = 2.5) => { await rec.eval(([x, z, face]) => { const F = window.__field, X = window.__story.X; X.cleanupBattle(); X.player.pos.set(x, F.groundFn(x, z) + 0.05, z); X.player.vy = 0; X.fig.root.rotation.y = face; window.__agora.G.setCam(face + Math.PI, 0.26, 8.5); }, [x, z, face]); await skip(sec) };
    // 카메라 경로: t(0~1) 로 a → b 를 지나며 바라봐요 (절대 좌표, 지형 위로)
    const fly = (sec, a, b, la, lb) => rec.shoot(sec, (t, [a, b, la, lb, sec]) => { const k = t / sec, e = k * k * (3 - 2 * k), L = (u, v) => u + (v - u) * e, G = window.__agora.G;
      G.camOverride = { pos: new G.THREE.Vector3(L(a[0], b[0]), L(a[1], b[1]), L(a[2], b[2])), look: new G.THREE.Vector3(L(la[0], lb[0]), L(la[1], lb[1]), L(la[2], lb[2])) }; }, [a, b, la, lb, sec]);
    const free = () => rec.eval(() => { window.__agora.G.camOverride = null });

    // 1) 타이틀: 새싹 마을 위를 천천히 돈다
    await rec.eval(() => window.__field.setTimeOfDay && window.__field.setTimeOfDay(0.42));
    await rec.card('<h1>RUNE <b>AGORA</b></h1><div class="s">모험의 대지 「아르카디아」 · 2026.10.25</div>', 5.4);
    await fly(6, [70, 60, 640], [-60, 48, 620], [0, 10, 555], [0, 10, 545]);

    // 2) 끝없이 넓은 대륙
    await rec.caption('NEW', '거대한 대륙 아르카디아', '1.6km × 1.6km · 9개 지역 · Lv.1 ~ 30 · 마을에서 북쪽으로 갈수록 강해져요', 7.4);
    await fly(8, [0, 70, 520], [-30, 95, 300], [0, 20, 380], [-10, 8, 110]);

    // 3) 이름 붙은 절벽 · 폭포 · 랜드마크
    await rec.caption('NEW', '이름이 있는 땅', '하얀 갈기 폭포 · 그림자 낭떠러지 · 울음바위 절벽 · 부서진 거상 … 37곳의 랜드마크', 6.4);
    await fly(7, [-10, 22, -60], [-90, 30, -100], [-60, 18, -170], [-60, 24, -168]);

    // 4) 레벨별 사냥터 · 전투
    await free(); await tp(-36, 384, Math.PI * 1.25, 3);
    await rec.caption('NEW', '레벨별 사냥터 29곳', '몬스터마다 레벨 · 이름표 · 배회 → 추격 → 귀환. 필드 보스도 돌아가며 나타나요', 6.4);
    await rec.shoot(7, t => { const s = window.__story, X = s.X; const k = window.__agora.G.keys; const e = X.nearestEnemy(14);
      if (e){ const a = Math.atan2(e.pos.x - X.player.pos.x, e.pos.z - X.player.pos.z); X.fig.root.rotation.y = a; window.__agora.G.setCam(a + Math.PI * 0.85, 0.3, 7.5); }
      if (Math.floor(t * 30) % 9 === 0) document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' }));
      if (Math.abs(t - 2.5) < 0.02) s.useSkill(1); if (Math.abs(t - 5) < 0.02) s.useSkill(0); });

    // 5) 글라이더: 매의 절벽에서 뛰어내리기
    await tp(-196, 402, Math.PI * 1.5, 2);
    await rec.caption('NEW', '글라이더', '높은 곳에서 Space 를 길게 — 바람개비 언덕 · 독수리 둥지 · 하늘 끝 봉우리에서 날아올라요', 6.6);
    await rec.shoot(7, t => { const k = window.__agora.G.keys; k.KeyW = true; k.Space = t > 0.2; if (t > 0.05 && t < 0.15){ window.__story.X.player.vy = 7.6; window.__story.X.player.ground = false; } });
    await rec.eval(() => { const k = window.__agora.G.keys; k.KeyW = k.Space = false });

    // 6) 다른 모험가들 · 채팅 · 마을
    await tp(6, 566, Math.PI * 0.2, 3);
    await rec.caption('MMO', '함께 사는 세계', '모험가들이 사냥하고 수다 떨고 · 채팅 (Enter) · 감정표현 (T) · 의상실', 6.4);
    await rec.shoot(7, t => { if (Math.abs(t - 1) < 0.02 && window.__field.emote) window.__field.emote('dance'); if (Math.abs(t - 2) < 0.02 && window.__field.say) window.__field.say('같이 레이드 가실 분~!'); });

    // 7) 성장: 장비 · 강화 · 퀘스트
    await rec.eval(() => { const F = window.__field; if (F.addItem){ F.addItem('wpn', 1, { il: 21, r: 4 }); F.addItem('arm', 1, { il: 20, r: 3 }); F.addItem('acc', 1, { il: 19, r: 3 }); F.addItem('wpn', 1, { il: 18, r: 2 }); } F.openInventory && F.openInventory('bag'); });
    await rec.caption('GROW', '장비 · 강화 · 퀘스트', '희귀 ~ 전설 장비, +15 강화, 메인 · 지역 · 일일 퀘스트, 칭호와 업적', 5.4);
    await rec.shoot(5.6, () => {});
    await rec.eval(() => { window.__field.closeRpgWindow && window.__field.closeRpgWindow() });

    // 8) 레이드
    await rec.eval(() => window.__field.enterRaid && window.__field.enterRaid('grom'));
    await skip(2.5);
    await rec.page.waitForFunction(() => window.__story.X.mode === 'raid', null, { timeout: 120000 }).catch(() => {});
    await skip(9);
    await rec.caption('RAID', '레이드 3종', '늪의 왕 그롬 · 바위 거인 그라녹 · 서리 거룡 크라이오스 — 파티원과 함께', 7.4);
    await rec.shoot(8, t => { const X = window.__story.X; if (Math.floor(t * 30) % 10 === 0) document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' })); if (Math.abs(t - 3) < 0.02) window.__story.useSkill(2); if (Math.abs(t - 6) < 0.02) window.__story.useSkill(3); X.heal(999); });

    // 9) 낚시 · 미니게임
    await rec.eval(() => window.__field.enter({ x: 26, z: 236, face: Math.PI }));
    await skip(3); await rec.page.waitForFunction(() => window.__field.inField, null, { timeout: 120000 }).catch(() => {});
    await skip(3);
    await rec.eval(() => window.__field.startFishing && window.__field.startFishing('f_south'));
    await rec.caption('PLAY', '낚시 · 미니 게임', '물고기 24종 도감 · 룬 리듬 · 과녁 맞히기', 6.4);
    await rec.shoot(7, () => {});

    // 10) 마무리
    await rec.card('<h1>RUNE <b>AGORA</b></h1><div class="s">모험의 대지가 열렸어요</div><ul><li>9개 지역 · 랜드마크 37곳 · 사냥터 29곳</li><li>글라이더 · 룬 비석 빠른 이동 · 월드맵</li><li>장비 · 강화 · 퀘스트 · 칭호</li><li>레이드 3종 · 필드 보스 · 낚시 · 미니 게임</li></ul>', 6);
    await rec.shoot(6, () => {});
  },
};
