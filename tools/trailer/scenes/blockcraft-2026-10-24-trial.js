// 블록크래프트 "시련의 회당 다시 짓기" 트레일러: 마크 원본 조각 · 연결 규칙을 하나하나 대조해 다시 지은 시련의 회당
// 끝방 → 큰 복도 (갈비벽 · 회랑) → 갈림방 (유리 물탱크) → 아트리움 (큰 계단 · 분수) · 싸움방 (조립실 · 분화실 · 받침대실 · 기둥방)
// · 시련 생성기 (몹을 다 물리치면 열쇠 → 30분 쉼) · 금고 · 항아리 · 마크 색으로 다시 그린 블록 그림 · 원본과 대조해 다시 그린 식물 그림
module.exports = {
  page: 'craft.html',
  loadWait: 9000,
  async prepare(rec) {
    await rec.eval(() => { const B = __BC; B.enterWorld({ id: 'trailer6', name: 'Trailer', seed: 555, mode: 'creative', type: 'default', gen: 4 }, null); B.hideMenu(); B.startGame(); B.runCmd('/time set 3500'); B.runCmd('/weather clear 999999');
      const st = document.createElement('style'); st.textContent = '#menu{display:none!important}#chat{display:none!important}#bossBar{display:none!important}#waypt{display:none!important}'; document.head.appendChild(st) });
    await rec.wait(10000);
    const T = await rec.eval(() => {
      const p = __BC.player, s = nearestOf(TRIAL, p.pos.x, p.pos.z), L = trLayout(s), T = { px: Math.floor(p.pos.x), pz: Math.floor(p.pos.z), s: { x: s.x, y: s.y, z: s.z } };
      // 조각 제 좌표 → 세상 좌표
      const W = (p, lx, ly, lz) => { const [u, v] = trOff(p.rot, p.sx, p.sz, lx, lz); return [p.x0 + u + .5, p.y0 + ly, p.z0 + v + .5] };
      T.has = L.map(q => q.t);
      // 싸움 장면: 분화실 도랑의 근접 생성기 · 금고
      const er = L.find(q => q.t === 'eruption') || L.find(q => TR_CHAMBERS.includes(q.t)); trBuf(er, s);
      const sp = er.fe.find(f => f[3] === 'sp' && f[4].startsWith('melee')) || er.fe.find(f => f[3] === 'sp'), va = er.fe.find(f => f[3] === 'vault');
      T.sp = W(er, sp[0], sp[1], sp[2]).map(Math.floor); T.spk = tkey(...T.sp); T.va = W(er, va[0], va[1], va[2]).map(Math.floor);
      const m = getM(...T.va), d = FACES[HDIRS[m & 3]].d; T.vaFront = [T.va[0] + .5 + d[0] * 3.2, T.va[1], T.va[2] + .5 + d[2] * 3.2];
      return T });
    console.log('targets', JSON.stringify(T));
    await rec.eval(T => { window.__T = T;
      const L = trLayout(nearestOf(TRIAL, T.s.x, T.s.z));
      window.__W = (t, lx, ly, lz, k = 0) => { const p = L.filter(q => q.t === t)[k]; if (!p) return null; const [u, v] = trOff(p.rot, p.sx, p.sz, lx, lz); return [p.x0 + u + .5, p.y0 + ly, p.z0 + v + .5] };
      window.__cam = (x, y, z, tx, ty, tz) => { const p = __BC.player; p.fly = true; p.pos.set(x, y - 1.62, z); p.prev.copy(p.pos); p.vel.set(0, 0, 0); const dx = tx - x, dz = tz - z, dy = ty - y; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)) };
      // 조각 안에서 a → b 로 움직이며 c 를 바라봐요 (모두 조각 제 좌표)
      window.__fly = (t, a, b, c, d, k, kk = 0) => { const A = __W(t, ...a, kk), B2 = __W(t, ...b, kk), C = __W(t, ...c, kk), D = __W(t, ...(d || c), kk); if (!A) return; const e = k * k * (3 - 2 * k);
        __cam(A[0] + (B2[0] - A[0]) * e, A[1] + (B2[1] - A[1]) * e, A[2] + (B2[2] - A[2]) * e, C[0] + (D[0] - C[0]) * e, C[1] + (D[1] - C[1]) * e, C[2] + (D[2] - C[2]) * e) };
      window.__stand = (x, y, z, yaw, pitch) => { const p = __BC.player; p.fly = false; p.pos.set(x, y, z); p.prev.copy(p.pos); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch || 0 };
      window.__safe = () => { const p = __BC.player; p.hp = 20; p.food = 20; p.hurtT = Math.max(p.hurtT || 0, .6) };
      hideGui = true }, T);
    rec.T = T;
  },
  async play(rec) {
    const skip = async sec => { for (let i = 0; i < sec * 30; i++) await rec.eval(() => __VT.step(1000 / 30)) };
    const set = (f, a) => rec.eval(f, a);
    const fly = (t, a, b, c, d, dur, k = 0) => rec.shoot(dur, (tt, o) => __fly(o.t, o.a, o.b, o.c, o.d, tt / o.dur, o.k), { t, a, b, c, d, dur, k });

    // 1) 끝방: 북쪽 복도를 바라보며
    await set(() => __fly('end', [9, 10, 16], [9, 9, 13], [9, 5, 1], null, 0)); await skip(9);
    await rec.card(`<div class="s">REMAKE</div><h1>시련의 <b>회당</b></h1><div class="s">마크 원본 조각 · 연결 규칙과 하나하나 대조해 다시 지었어요</div>`, 6.4);
    await fly('end', [9, 10, 16], [9, 8, 9], [9, 5, 1], [9, 6, 0], 6.6);
    await rec.caption('REMAKE', '끝방 (처음 방)', '양옆 계단이 갈비벽 아치를 지나 남쪽 단으로 · 가운데 둑길 끝에 첫 싸움방 문', 4.6);
    await fly('end', [3, 7, 15], [14, 7, 15], [9, 4, 6], [9, 8, 17], 5);

    // 2) 큰 복도: 가운데 큰길 · 양옆 아래 회랑 · 위 회랑 (갈비벽 사이로 탁 트여요)
    await set(() => __fly('cor2', [9, 4, 19], [9, 4, 19], [9, 6, 0], null, 0)); await skip(4);
    await rec.caption('REMAKE', '큰 복도', '갈비벽 아치 · 아래 회랑 · 위 회랑 · 구리 전구 · 항아리 (깨면 에메랄드!) · 옆으로 뻗는 통로', 5.4);
    await fly('cor2', [9, 4, 19], [9, 5, 1], [9, 6, 0], [9, 7, -6], 6);
    await fly('cor2', [15, 11, 18], [4, 12, 2], [3, 10, 0], [14, 9, 0], 4.6);

    // 3) 갈림방: 유리 벽 물탱크 · 구리 테두리 길 · 침대 · 보물 상자
    await set(() => __fly('int1', [18, 12, 18], [18, 12, 18], [6, 4, 5], null, 0)); await skip(5);
    await rec.caption('REMAKE', '갈림방', '유리 벽 물탱크 사이로 복도가 꺾여요 · 탱크 위 구리 테두리 길 · 침대 · 보물 상자', 5);
    await fly('int1', [18, 12, 18], [12, 11, 17], [6, 4, 5], [4, 3, 9], 5.4);

    // 4) 아트리움: 큰 계단 · 분수 · 벽 부조
    await set(() => __fly('atrium', [14, 13, 3], [14, 13, 3], [14, 8, 17], null, 0)); await skip(5);
    await rec.caption('REMAKE', '아트리움', '분수 · 큰 기둥 · 벽 부조 · 큰 계단을 오르면 입구 방', 4.6);
    await fly('atrium', [14, 13, 3], [14, 11, 9], [14, 8, 17], [14, 11, 20], 5);

    // 5) 싸움방 8가지
    const rooms = [['assembly', '조립실', '높은 큰 바닥 · 넓은 다락 · 큰 계단 둘 · 엄폐물 · 매달린 전구'], ['eruption', '분화실', '팔각형 방 · 가운데로 모이는 도랑과 마그마 · 탑 위 브리즈'], ['pedestal', '받침대실', '기둥 숲 · 가운데 구리 틀 받침 위 생성기'], ['ch1', '기둥방', '바닥 받침과 천장에서 내려온 기둥 · 위아래 걷는 길 · 격자 다리'],
      ['slanted', '비탈실', '기둥 숲 사이로 오르는 비탈길 · 탑 위 브리즈'], ['ch2', '기둥방 2', '가운데 탑 위 생성기 · 둘레 길 · 격자 다리'], ['ch8', '높은방', '층층이 걷는 길 · 사다리 · 생성기 넷'], ['ch4', '작은방', '가운데 덩어리 · 격자 다리 · 생성기 둘']];
    let first = true, shown = 0;
    for (const [t, n, d] of rooms) {
      if (shown >= 4) break;
      const sz = await rec.eval(t => { const p = trLayout(nearestOf(TRIAL, __T.s.x, __T.s.z)).find(q => q.t === t); return p ? [p.sx, p.sy, p.sz] : null }, t);
      if (!sz) continue; shown++;
      const a = [sz[0] - 6, sz[1] - 4, sz[2] - 7], b = [sz[0] - 7, sz[1] - 5, 6], c = [Math.floor(sz[0] / 2), 3, Math.floor(sz[2] / 2)];
      await set(o => __fly(o.t, o.a, o.a, o.c, null, 0), { t, a, c }); await skip(5);
      await rec.caption(first ? 'REMAKE · 싸움방 8가지' : 'REMAKE', n, d, 4.2); first = false;
      await fly(t, a, b, c, [c[0] - 2, 2, c[2]], 4.6);
    }

    // 6) 시련 생성기: 가까이 가면 깨어나요 → 다 물리치면 열쇠 또는 먹을거리 → 30분 쉬어요
    await set(() => { const S = __T.sp; __BC.runCmd('/gamemode survival'); const ds = dimState.tsp || (dimState.tsp = {}); for (const k of TRIALSP.keys()) if (k !== __T.spk) { ds[k] = worldTime + 9999; TSTATE.delete(k) }
      let st = null; for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, 2], [2, -2], [-2, -2]]) { const x = S[0] + dx, z = S[2] + dz; for (let dy = -1; dy <= 1; dy++) { const y = S[1] + dy; if (!SOLID[getB(x, y, z)] && !SOLID[getB(x, y + 1, z)] && SOLID[getB(x, y - 1, z)]) { st = [x + .5, y, z + .5]; break } } if (st) break }
      st = st || [S[0] + .5, S[1], S[2] + 3.5]; __stand(st[0], st[1], st[2], Math.atan2(-(S[0] + .5 - st[0]), -(S[2] + .5 - st[2])), -.15); __safe(); hideGui = false;
      __BC.inv[0] = { id: toolId(3, 3), n: 1, d: 0 }; __BC.selectSlot(0); window.__swing = 0 });
    await rec.caption('REMAKE', '시련 생성기', '가까이 가면 깨어나요 · 몹을 다 물리치면 시련 열쇠 (50%) 또는 먹을거리 → 30분 동안 꺼져요', 9.5, true);
    await rec.shoot(10.5, t => { __safe(); const p = __BC.player, S = __T.sp, st = TSTATE.get(__T.spk);
      if (st && st.st === 'active' && !window.__lset) { window.__lset = 1; st.left = Math.min(st.left, 3) }
      let near = null, nd = 9; for (const m of mobs) if (m.trial && !m.dead) { if (m.hp > 6) m.hp = 6; const d = m.pos.distanceTo(p.pos); if (d < nd) { nd = d; near = m } }
      if (near) { p.yaw = Math.atan2(-(near.pos.x - p.pos.x), -(near.pos.z - p.pos.z)); if (nd < 2.8 && t - window.__swing > .45) { window.__swing = t; p.atkTicker = 100; attack(near) } }
      else { const ty = Math.atan2(-(S[0] + .5 - p.pos.x), -(S[2] + .5 - p.pos.z)); let a = ty - p.yaw; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; p.yaw += a * .08 }
      if (st && st.st === 'eject') for (const e of ents) e.pick = e.age + 1 });
    // 7) 금고: 시련 열쇠로 한 번 (마크 보상표: 희귀 80% · 흔한 1~3 · 특별 25%)
    await set(() => { for (const m of mobs) if (m.trial) { m.dead = true; m.deadT = 1 } const V = __T.va, F = __T.vaFront; __stand(F[0], F[1], F[2], Math.atan2(-(V[0] + .5 - F[0]), -(V[2] + .5 - F[2])), -.22); __safe(); __BC.inv[0] = { id: TRIAL_KEY, n: 1, d: 0 }; __BC.selectSlot(0) });
    await skip(2);
    await rec.caption('REMAKE', '금고', '시련 열쇠로 열면 보물이 하나씩 · 마크 보상표 그대로 (희귀 80% · 흔한 것 1~3개 · 특별 25%)', 5.6, true);
    await rec.shoot(6, t => { __safe(); const V = __T.va; if (t > 1 && !window.__vo) { window.__vo = 1; doSwing(); useVault({ x: V[0], y: V[1], z: V[2], id: getB(V[0], V[1], V[2]) }) } for (const e of ents) e.pick = e.age + 1 });

    // 8) 땅 위: 마크 색으로 다시 그린 블록 그림
    await set(() => { for (const e of ents.slice()) scene.remove(e.m); ents.length = 0; __BC.runCmd('/gamemode creative'); hideGui = true; const x = __T.px, z = __T.pz, y = __BC.terrainH(x, z) + 1; __cam(x + 9, y + 6, z + 9, x, y, z) });
    await skip(8);
    await rec.caption('NEW', '블록 그림', '마크 블록 색 분포에 맞춰 다시 그렸어요 · 잔디 · 흙 · 돌 · 광석 · 통나무 · 판자 · 잎', 4.6);
    await rec.shoot(5, t => { const x = __T.px, z = __T.pz, y = __BC.terrainH(x, z) + 1, k = t / 5; __cam(x + 9 - k * 4, y + 6 - k * 2, z + 9 - k * 2, x, y, z) });

    // 9) 식물 그림: 원본 그림과 나란히 놓고 다시 그린 풀 · 꽃 · 작물 · 산호 · 네더 식물 · 늘어진 덩굴
    const G = await rec.eval(() => {
      const TX = __BC.TEX, BB = __BC.B, ft = t => { const ti = TX[t]; for (const k in BB) { const b = BB[k]; if (!b || b.tex == null) continue; const tx = Array.isArray(b.tex) ? b.tex : [b.tex]; if (tx.includes(ti)) return +k } return AIR };
      const gx = __T.px + 4, gz = __T.pz + 14, y0 = __BC.terrainH(gx + 7, gz + 3);
      for (let x = -3; x <= 18; x++) for (let z = -6; z <= 9; z++) { for (let y = y0 - 3; y < y0; y++) setBlock(gx + x, y, gz + z, DIRT, true); setBlock(gx + x, y0, gz + z, GRASS, true); for (let y = y0 + 1; y <= y0 + 12; y++) setBlock(gx + x, y, gz + z, AIR, true) }
      const row = (z, ground, list, y = y0 + 1) => list.forEach((t, i) => { if (ground) setBlock(gx + i, y0, gz + z, ground, true); if (t) setBlock(gx + i, y, gz + z, ft(t), true) });
      row(0, 0, ['tallgrass', 'fern', 'poppy', 'dandelion', 'azure_bluet', 'tulip', 'cornflower', 'allium', 'oxeye', 'lily_valley', 'blue_orchid', 'pink_tulip', 'sweet_berry', 'sapling', 'red_mushroom', 'tallgrass']);
      row(4, FARMLAND, ['wheat0', 'wheat1', 'wheat2', 'wheat3', 'wheat3', 'carrots3', 'carrots3', 'potatoes3', 'potatoes3', 'beets3', 'beets3', 'wheat3', 'wheat3', 'wheat2', 'wheat1', 'wheat0']);
      row(2, SAND, ['dead_bush', 'coral_tube', 'coral_brain', 'coral_bubble', 'coral_fire', 'coral_horn', 'dead_bush']);
      [[7, SOUL_SAND, 'nether_wart1'], [8, SOUL_SAND, 'nether_wart1'], [9, CRIMSON_NYLIUM, 'crimson_roots'], [10, CRIMSON_NYLIUM, 'crimson_roots'], [11, WARPED_NYLIUM, 'warped_roots'], [12, WARPED_NYLIUM, 'nether_sprouts'], [13, AMETHYST_BLOCK, 'amethyst_cluster'], [14, AMETHYST_BLOCK, 'amethyst_cluster']]
        .forEach(([i, g, t]) => { setBlock(gx + i, y0, gz + 2, g, true); setBlock(gx + i, y0 + 1, gz + 2, ft(t), true) });
      // 뒤쪽 돌 선반에서 늘어지는 뿌리 · 이끼 · 동굴 덩굴
      for (let x = 0; x < 16; x++) { setBlock(gx + x, y0 + 4, gz + 6, MOSS_BLOCK, true); const t = ['hanging_roots', 'pale_hanging_moss', 'cave_vines_lit', 'cave_vines'][x % 4]; setBlock(gx + x, y0 + 3, gz + 6, ft(t), true); if (x % 4 > 1) setBlock(gx + x, y0 + 2, gz + 6, ft(t), true) }
      return { gx, gz, y0 } });
    await set(G => { __cam(G.gx - 1, G.y0 + 2.9, G.gz - 3.2, G.gx + 3, G.y0 + .9, G.gz + 2.5) }, G); await skip(4);
    await rec.caption('NEW', '식물 그림', '잔디 · 고사리 · 꽃 · 묘목 · 작물 · 산호 · 네더 식물 · 늘어진 덩굴: 원본 그림과 나란히 놓고 모양 · 빽빽함 · 색까지 맞췄어요', 5.4);
    await rec.shoot(8, (t, G) => { const k = t / 8, e = k * k * (3 - 2 * k); __cam(G.gx - 1 + e * 15, G.y0 + 2.9 - e * .5, G.gz - 3.2 + e * .7, G.gx + 3 + e * 10, G.y0 + .9, G.gz + 2.5) }, G);

    // 10) 마무리
    await set(() => __fly('end', [9, 11, 17], [9, 11, 17], [9, 5, 2], null, 0)); await skip(4);
    await rec.card(`<h1>블록<b>크래프트</b></h1><ul><li>시련의 회당: 마크 원본 조각 · 연결 규칙을 대조해 다시 지었어요</li><li>끝방 · 큰 복도 · 갈림방 · 아트리움 · 입구 · 통로 · 싸움방 8가지</li><li>생성기 · 금고 · 보급 상자 · 항아리: 마크 수치와 보상표</li><li>블록 · 식물 그림을 원본과 대조해 다시 그렸어요 · 따뜻한 바다 산호초</li><li>시간의 방 신전은 없앴어요</li></ul>`, 6);
    await fly('end', [9, 11, 17], [9, 9, 12], [9, 5, 2], [9, 6, 0], 6);
  },
};
