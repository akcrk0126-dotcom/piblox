// 블록크래프트 "마크 느낌" 대업데이트 트레일러: 타이틀 · 움직임 · 손 · 부수기 · 공격 쿨타임 · 먹기 · 구름 · 노을 · 비 · 번개 · 인벤토리
module.exports = {
  page: 'craft.html',
  loadWait: 9000,
  async prepare(rec) {
    // 타이틀 화면에서 시작해요 (월드는 녹화 중에 들어가요)
    rec.ids = await rec.eval(() => { const I = __BC.ITEM, f = re => +Object.keys(I).find(k => I[k] && re.test(I[k].n || '')); return { sword: f(/^다이아몬드 검$/), pick: f(/^다이아몬드 곡괭이$/), apple: 262, cobble: 4, dirt: 2, bread: 305 } });
    console.log('ids', JSON.stringify(rec.ids));
  },
  async play(rec) {
    const ids = rec.ids;
    const skip = async sec => { for (let i = 0; i < sec * 30; i++) await rec.eval(() => __VT.step(1000 / 30)) };
    const set = (f, a) => rec.eval(f, a);

    // 1) 새 타이틀 화면 (돌 로고 · 노란 문구 · 마크 버튼)
    await rec.card(`<div class="s">NEW</div><h1>마크 느낌 <b>대업데이트</b></h1><div class="s">움직임 · 손 · 화면 · 소리 · 날씨까지 마인크래프트 자바 에디션 그대로</div>`, 3);
    await rec.shoot(3, t => { __BC.player.yaw += .0025 });
    await rec.shoot(3, t => { __BC.player.yaw += .0025 });

    // 월드에 들어가기 (녹화 안 하고 시간만 넘겨요)
    await set(() => { const B = __BC; B.enterWorld({ id: 'trailer2', name: 'Trailer', seed: 4242, mode: 'survival', type: 'default', gen: 4 }, null); B.hideMenu(); B.startGame(); B.runCmd('/time set 5000');
      const st = document.createElement('style'); st.textContent = '#menu{display:none!important}'; document.head.appendChild(st) });
    await skip(12);
    await set(ids => { const B = __BC; document.getElementById('chatLog').innerHTML = ''; B.inv[0] = { id: ids.sword, n: 1 }; B.inv[1] = { id: ids.pick, n: 1 }; B.inv[2] = { id: ids.apple, n: 12 }; B.inv[3] = { id: ids.cobble, n: 64 }; B.inv[4] = { id: ids.bread, n: 5 };
      B.sel = 1; B.renderHotbar(); B.player.food = 14; B.player.pitch = -.05; B.player.xp = 40 }, ids);
    await skip(1.5);

    // 2) 걷기 · 달리기 (20틱 물리 · 화면 흔들림 · 달리면 시야가 넓어져요)
    await rec.caption('NEW', '마크와 똑같이 움직여요', '1초에 20틱 · 걷기 4.3칸/초 · 달리기 5.6칸/초 · 걸을 때 화면 흔들림', 6.6);
    await rec.shoot(7, t => { const k = __BC.keys; k.KeyW = t < 6.5; k.ControlLeft = t > 2.5 && t < 6.5; k.Space = t > 4.2 && t < 4.35; __BC.player.yaw += Math.sin(t * 1.3) * .002 });
    await set(() => { const k = __BC.keys; k.KeyW = k.ControlLeft = k.Space = false });

    // 3) 블록 부수기 (금 10단계 · 부스러기 64조각 · 떨어진 블록은 빙글 · 그림자)
    await set(() => { __BC.player.pitch = -.95 });
    await skip(.5);
    await rec.caption('NEW', '블록 부수기', '금이 10단계로 가고 · 부스러기가 튀고 · 떨어진 블록이 빙글빙글 돌아요', 6.6);
    await rec.shoot(7, t => { __BC.setMouseL(t < 6) });
    await set(() => __BC.setMouseL(false));

    // 4) 바꿔 들기 (손이 내려갔다 올라와요 · 이름이 핫바 위에 떠요)
    await set(() => { __BC.player.pitch = -.12 });
    await rec.caption('NEW', '손에 든 물건', '마크 위치 · 각도 그대로 · 바꿔 들면 손이 쑥 내려갔다 올라와요', 5.6);
    await rec.shoot(6, t => { const s = Math.floor(t / 1.2) % 5; if (__BC.sel !== s) __BC.selectSlot(s) });

    // 5) 공격 쿨타임 · 쓰러지는 몹
    await set(ids => { const B = __BC, p = B.player; B.selectSlot(0); const fx = p.pos.x - Math.sin(p.yaw) * 2.2, fz = p.pos.z - Math.cos(p.yaw) * 2.2; const m = B.spawnMob('zombie', fx, B.terrainH(Math.floor(fx), Math.floor(fz)) + 1, fz); if (m) { m.noAI = true; m.hp = 20; m.yaw = p.yaw; m.D = Object.assign({}, m.D, { burn: 0 }); window.__z = m } }, ids);
    await skip(1.2);
    await rec.caption('NEW', '공격 쿨타임', '휘두른 뒤 차오르는 막대 · 꽉 찼을 때 때려야 아파요 · 쓰러진 몹은 연기로', 6.6);
    await rec.shoot(7, t => { const B = __BC, m = window.__z; if (!m) return; m.vel.set(0, m.vel.y, 0); const k = Math.floor(t / .9); if (k !== window.__k && t > .3 && !m.dead) { window.__k = k; B.attack(m) } });

    // 6) 해 아래 좀비는 불타요 (진짜 불꽃 · 비가 오면 꺼져요)
    await set(() => { const B = __BC, p = B.player; B.selectSlot(0); p.pitch = -.08; const fx = p.pos.x - Math.sin(p.yaw) * 3.2, fz = p.pos.z - Math.cos(p.yaw) * 3.2; const m = B.spawnMob('zombie', fx, B.terrainH(Math.floor(fx), Math.floor(fz)) + 1, fz); if (m) { m.noAI = true; m.hp = 200; m.yaw = p.yaw; window.__z2 = m } });
    await skip(.5);
    await rec.caption('NEW', '해가 뜨면 좀비가 불타요', '몸에 붙은 불꽃 · 비나 물에 닿으면 꺼져요', 4.6);
    await rec.shoot(5, t => { const m = window.__z2; if (m) { m.vel.set(0, m.vel.y, 0); m.hurtT = 0 } });
    await set(() => { const m = window.__z2; if (m) { m.hp = 0; m.dead = true; m.deadT = 2 } });

    // 7) 먹기
    await set(() => { __BC.selectSlot(2); __BC.player.pitch = -.05 });
    await skip(.8);
    await rec.caption('NEW', '먹기', '입으로 가져가서 오물오물 · 1.6초', 3.6);
    await rec.shoot(4, t => { if (t < .05) __BC.setMouseR(true) });
    await set(() => __BC.setMouseR(false));

    // 8) 하늘: 입체 구름 → 노을 (시간을 빨리 돌려요)
    await set(() => { const p = __BC.player; p.pitch = .55 });
    await rec.caption('NEW', '입체 구름 · 노을', '높이 192 의 구름이 서쪽으로 흘러가요 · 해 질 녘 하늘이 붉게', 7.6);
    await rec.shoot(8, t => { const B = __BC, p = B.player; if (t > 2.5) { p.pitch += (.02 - p.pitch) * .06; p.yaw += ((Math.PI / 2) - p.yaw) * .05; B.worldTime = B.DAYLEN * (.465 + (t - 2.5) / 5.5 * .05) } });

    // 9) 비 → 천둥번개 (하늘이 회색으로 · 빗줄기 · 빗방울 · 번개가 번쩍)
    await set(() => { const B = __BC, p = B.player; B.runCmd('/time set 6000'); B.runCmd('/weather thunder 900'); B.setWx(.35, 0); p.pitch = .06; p.yaw = Math.PI / 2 + .6; document.getElementById('chatLog').innerHTML = '' });
    await skip(.3);
    await rec.caption('NEW', '비 · 눈 · 천둥번개', '하늘이 어두워지고 · 빗방울이 튀고 · 번개가 번쩍 · /weather 로 바꿀 수 있어요', 7.6);
    await rec.shoot(8, t => { const B = __BC, p = B.player; const [r, th] = B.wx; if (t < 3) B.setWx(Math.min(1, .35 + t * .25), Math.min(1, t * .4)); p.yaw -= .0012;
      if ((t > 3.4 && t < 3.44) || (t > 6.2 && t < 6.24)) B.lightning(Math.floor(p.pos.x - Math.sin(p.yaw) * 26 + (t > 5 ? 8 : -6)), Math.floor(p.pos.z - Math.cos(p.yaw) * 26)) });
    await set(() => { const B = __BC; B.runCmd('/weather clear 900'); B.setWx(0, 0); document.getElementById('chatLog').innerHTML = '' });

    // 10) 인벤토리 · HUD
    await set(() => { const B = __BC; B.runCmd('/time set 6000'); document.getElementById('chatLog').innerHTML = ''; B.openScreen('inv') });
    await skip(.4);
    await rec.caption('NEW', '인벤토리 · HUD', '마크와 같은 크기 · 같은 자리 (자동 GUI 크기)', 4.6, true);
    await rec.shoot(5, t => { });
    await set(() => __BC.closeScreen());

    // 11) 마무리
    await rec.card(`<h1>블록<b>크래프트</b></h1><ul><li>20틱 물리 · 화면 흔들림 · 손 위치</li><li>공격 쿨타임 · 치명타 · 휩쓸기</li><li>부스러기 · 그림자 · 입체 구름 · 노을</li><li>비 · 눈 · 천둥번개 · 불꽃 · 경험치 구슬</li><li>마크 크기 HUD · 메뉴 · 인벤토리</li><li>재질 소리 · 잔잔한 피아노 음악</li></ul><div class="s">지금 플레이하세요!</div>`, 5);
    await rec.shoot(5, t => { __BC.player.yaw -= .004 });
  },
};
