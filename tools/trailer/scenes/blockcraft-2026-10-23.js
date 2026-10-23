// 블록크래프트 2026-10-23 업데이트 트레일러: 보트 · 친구와 PvP · 활 · 명령어 가이드 · 영어 바이옴 이름
module.exports = {
  page: 'craft.html',
  async prepare(rec) {
    await rec.eval(() => { const B = __BC; B.enterWorld({ id: 'trailer', name: 'Trailer', seed: 4242, mode: 'survival', type: 'default', gen: 4 }, null); B.hideMenu(); B.startGame(); B.runCmd('/time set noon') });
    // 녹화 중엔 메뉴 · "화면을 클릭하면 시작해요" 를 숨겨요
    await rec.eval(() => { const st = document.createElement('style'); st.textContent = '#menu{display:none!important}'; document.head.appendChild(st) });
    await rec.wait(9000);
    // 장소 미리 찾기 (실제 시간)
    const find = async q => { await rec.eval(q => __BC.runCmd('/locate biome ' + q), q); await rec.wait(9000); return rec.eval(() => { const w = __BC.WAYPT; return w && { x: w.x, y: w.y, z: w.z } }) };
    rec.cherry = await find('cherry grove');
    rec.ocean = await find('beach');   // 해변 바로 앞 바다에서 타야 움직이는 게 잘 보여요
    rec.spawn = await rec.eval(() => { const p = __BC.player.pos; return { x: p.x, y: p.y, z: p.z } });
    await rec.eval(() => { __BC.runCmd('/locate clear'); __BC.player.hp = 20 });
    // 아이템 ID
    rec.ids = await rec.eval(() => { const I = __BC.ITEM, f = re => +Object.keys(I).find(k => I[k] && re.test(I[k].name || I[k].n || '')); return { sword: f(/다이아몬드 ?검/), bow: 300, boat: 642 } });
    console.log('places', JSON.stringify({ cherry: rec.cherry, ocean: rec.ocean, ids: rec.ids }));
  },
  async play(rec) {
    const { cherry, ocean, ids } = rec;
    await rec.eval(() => __BC.runCmd('/time set noon'));
    const skip = async sec => { for (let i = 0; i < sec * 30; i++) await rec.eval(() => __VT.step(1000 / 30)) };
    const tp = async (p, sec = 3) => { await rec.eval(p => { __BC.runCmd(`/tp ${Math.round(p.x)} ${Math.round(p.z)}`); document.getElementById('chatLog').innerHTML = '' }, p); await skip(sec) };
    const hold = (id, slot = 0) => rec.eval(([id, slot]) => { const B = __BC; B.inv[slot] = id ? { id, n: 1 } : null; B.sel = slot; B.renderHotbar() }, [id, slot]);

    // 1) 인트로: 벚나무 숲을 천천히 둘러봐요
    await tp(cherry, 4);
    await rec.eval(() => { __BC.player.pitch = -.12; __BC.viewMode = 0 });
    await rec.card('<h1>블록<b>크래프트</b></h1><div class="s">새 업데이트 · 2026.10.23</div>', 3.6);
    await rec.shoot(4, t => { __BC.player.yaw += .004 });

    // 2) 보트
    await tp(ocean, 4);
    await rec.eval(() => { const B = __BC, p = B.player, WATER = 19;
      const top = (x, z) => { for (let y = Math.floor(p.pos.y) + 6; y > 20; y--) { const id = B.getB(x, y, z); if (id) return [id, y] } return [0, 0] };
      // 해변에서 가까운 물 (깊이 3칸 이상)
      let x = Math.floor(p.pos.x), z = Math.floor(p.pos.z), y = 0, found = false;
      for (let r = 4; r < 160 && !found; r += 3) for (let a = 0; a < 48 && !found; a++) { const xx = Math.floor(p.pos.x + Math.cos(a / 48 * 6.283) * r), zz = Math.floor(p.pos.z + Math.sin(a / 48 * 6.283) * r), [id, yy] = top(xx, zz);
        if (id === WATER && B.getB(xx, yy - 2, zz) === WATER) { x = xx; z = zz; y = yy; found = true; p.yaw = Math.atan2(-(p.pos.x - xx), -(p.pos.z - zz)) + 1 } }   // 해변을 비스듬히 보면서 달려요
      const bt = B.placeBoat(x + .5, y + .9, z + .5, p.yaw); p.pos.set(x + .5, y + 1.2, z + .5); p.vel.set(0, 0, 0); p.boat = bt; bt.yaw = p.yaw; B.viewMode = 1; p.pitch = -.08 });
    await hold(ids.boat);
    await skip(2);
    await rec.caption('NEW', '보트를 타요', '물에 놓고 오른쪽 클릭 · W A S D 로 노 저어요 · Shift 로 내려요', 6.6);
    await rec.shoot(7, t => { const k = __BC.keys; k.KeyW = true; k.KeyA = t > 2 && t < 3.6; k.KeyD = t > 4.6 && t < 5.6 });
    await rec.eval(() => { const B = __BC, k = B.keys; k.KeyW = k.KeyA = k.KeyD = false; B.player.boat = null; B.viewMode = 0 });

    // 3) 친구와 PvP (칼) — 가짜 친구를 세워서 찍어요
    await tp(rec.spawn, 3);
    await rec.eval(() => {
      const B = __BC, P = Promise.resolve(), me = { child() { return me }, set() { return P }, update() { return P }, remove() { return P }, push() { return { key: 'k' + Math.random() } }, onDisconnect() { return me } };
      B.MPS = { me, uid: 'me', sid: 'trailer', host: true, q: {}, tq: {}, dq: {}, kq: {}, qt: 0, st: 0, ht: -1e12, meta: { name: 'Trailer' }, refs: [], mine: [], count: 2 };
      const p = B.player, fx = p.pos.x - Math.sin(p.yaw) * 2.6, fz = p.pos.z - Math.cos(p.yaw) * 2.6, fy = B.terrainH(Math.floor(fx), Math.floor(fz)) + 1;
      const r = B.addRemote('friend1', { n: '친구', x: fx, y: fy, z: fz, ya: p.yaw, pi: 0 }); r.uid = 'friend1'; B.remotes.set('friend1', r); window.__fr = r; window.__home = { x: fx, y: fy, z: fz };
      p.pitch = -.18;
    });
    await hold(ids.sword);
    await skip(.6);
    await rec.caption('NEW', '친구와 PvP', '멀티플레이에서 친구를 때릴 수 있어요 · 날카로움 · 밀어내기 · 발화도 적용돼요', 5.6);
    await rec.shoot(6, t => {
      const B = __BC, r = window.__fr, h = window.__home, p = B.player; window.__n = window.__n || 0;
      const k = Math.floor(t / .6); if (k > window.__n && t < 5.4) { window.__n = k; r.cd = 0; B.attackRemote(r); const dx = r.d.x - p.pos.x, dz = r.d.z - p.pos.z, l = Math.hypot(dx, dz) || 1; r.d.x += dx / l * .7; r.d.z += dz / l * .7 }
      // 친구가 다시 다가오고 가끔 반격해요
      r.d.x += (h.x - r.d.x) * .05; r.d.z += (h.z - r.d.z) * .05; r.d.sw = (Math.floor(t / .9) % 2 && t % .9 < .1) ? 1 : 0;
      if (r.d.sw && t > 1.5 && p.hp > 12) { p.hurtT = 0; B.hurtPlayer(1, { x: r.d.x, y: r.d.y, z: r.d.z }, 'pvp') }
      const dx = r.d.x - p.pos.x, dz = r.d.z - p.pos.z; p.yaw = Math.atan2(-dx, -dz); r.d.ya = Math.atan2(dx, dz) + Math.PI * 0;
    });

    // 4) 활로 맞히기
    await rec.eval(() => { const B = __BC, r = window.__fr, p = B.player, a = p.yaw; window.__base = { x: p.pos.x - Math.sin(a) * 8, z: p.pos.z - Math.cos(a) * 8 }; window.__n = 0; p.hp = 20 });
    await hold(ids.bow);
    await skip(1);
    await rec.caption('NEW', '활로 친구를 맞혀요', '화살이 닿으면 데미지 · 화염은 불, 밀어내기는 넉백', 5.6);
    await rec.shoot(6, t => {
      const B = __BC, r = window.__fr, p = B.player, b = window.__base, a = p.yaw;
      // 친구가 옆으로 왔다갔다 달려요
      const s = Math.sin(t * 1.3) * 2.5, fx = b.x + Math.cos(a) * s, fz = b.z - Math.sin(a) * s;
      r.d.x = fx; r.d.z = fz; r.d.y = B.terrainH(Math.floor(fx), Math.floor(fz)) + 1; r.d.sw = 0;
      const ex = p.pos.x, ey = p.pos.y + 1.52, ez = p.pos.z, dx = r.d.x - ex, dz = r.d.z - ez, dist = Math.hypot(dx, dz), dy = r.d.y + 1.1 - ey;
      p.yaw += (Math.atan2(-dx, -dz) - p.yaw) * .25; p.pitch += (Math.atan2(dy, dist) + .05 - p.pitch) * .25;
      const k = Math.floor((t - .4) / 1.1); if (t > .4 && k >= window.__n && t < 5.2) { window.__n = k + 1;
        const sp = 42, tt = dist / sp, dir = new THREE.Vector3(dx, dy + 9 * tt * tt, dz).normalize(); B.shootArrow(new THREE.Vector3(ex, ey, ez).addScaledVector(dir, .6), dir, sp, 'player', 6) }
    });
    await rec.eval(() => { const B = __BC; B.remotes.delete('friend1'); const r = window.__fr; r.S.g.parent.remove(r.S.g); r.tag.parent.remove(r.tag); B.MPS = null });

    // 5) 명령어 가이드
    await hold(0);
    await rec.eval(() => { __BC.player.pitch = .05; __BC.openChat('') });
    await skip(.3);
    await rec.caption('NEW', '명령어 가이드', '치는 동안 사용법과 후보가 실시간으로 떠요 · ↑↓ 고르고 Tab', 7.6, true);
    const text = '/locate biome cher';
    await rec.shoot(8, (t, text) => {
      const i = document.getElementById('chatIn'), n = Math.min(text.length, Math.floor(t / .13));
      if (t < 3.2 && i.value !== text.slice(0, n)) { i.value = text.slice(0, n); i.dispatchEvent(new Event('input')) }
      const key = k => i.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k, bubbles: true }));
      if (!window.__tab && t > 3.8) { window.__tab = 1; key('Tab') }
      if (!window.__ent && t > 5) { window.__ent = 1; key('Enter') }
    }, text);

    // 6) 영어 바이옴 이름
    await rec.eval(() => __BC.runCmd('/tp target'));
    await skip(3);
    await rec.eval(() => { __BC.runCmd('/locate clear'); document.getElementById('chatLog').innerHTML = ''; __BC.player.pitch = -.1 });
    await rec.caption('바뀐 점', 'Cherry Grove · Stronghold · Ancient City', '바이옴 · 구조물 이름이 영어로 바뀌었어요 (한글로 찾아도 돼요)', 4.6);
    await rec.eval(() => __BC.toast('Cherry Grove'));
    await rec.shoot(5, t => { __BC.player.yaw -= .005 });

    // 7) 마무리 카드
    await rec.card(`<h1>블록<b>크래프트</b></h1><ul><li>보트 타기</li><li>친구와 PvP · 활 맞히기</li><li>명령어 실시간 가이드</li><li>바이옴 · 구조물 영어 이름</li></ul><div class="s">지금 플레이하세요!</div>`, 5);
    await rec.shoot(5, t => { __BC.player.yaw -= .005 });
  },
};
