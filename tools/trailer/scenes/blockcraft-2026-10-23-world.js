// 블록크래프트 "더 넓은 세계" 업데이트 트레일러: 블록 텍스처 · 오버월드 구조물 8종 · 창백한 정원 · 네더 (거대 균 · 바이옴 안개 · 보루 잔해 · 피글린 물물교환) · 엔드 (엔드 도시 · 엔드 배 · 셜커 · 엔드 관문)
module.exports = {
  page: 'craft.html',
  loadWait: 9000,
  async prepare(rec) {
    // 월드에 미리 들어가서 (실제 시간) 찍을 곳을 다 찾아 둬요
    await rec.eval(() => { const B = __BC; B.enterWorld({ id: 'trailer3', name: 'Trailer', seed: 4242, mode: 'creative', type: 'default', gen: 4 }, null); B.hideMenu(); B.startGame(); B.runCmd('/time set 3500'); B.runCmd('/weather clear 99999');
      const st = document.createElement('style'); st.textContent = '#menu{display:none!important}#chat{display:none!important}#bossBar{display:none!important}#waypt{display:none!important}'; document.head.appendChild(st) });
    await rec.wait(12000);
    await rec.eval(() => { document.getElementById('chatLog').innerHTML = ''; __BC.runCmd('/locate biome pale_garden') });
    for (let i = 0; i < 90; i++) { if (await rec.eval(() => !!WAYPT)) break; await rec.wait(1000) }
    const T = await rec.eval(() => {
      const B = __BC, p = B.player, T = { px: Math.floor(p.pos.x), pz: Math.floor(p.pos.z) };
      for (const k of ['mineshaft', 'jungle_pyramid', 'swamp_hut', 'igloo', 'pillager_outpost', 'shipwreck', 'ocean_ruin', 'ruined_portal']) T[k] = LOCATORS[k].find(T.px, T.pz);
      T.pale = WAYPT ? { x: WAYPT.x, z: WAYPT.z } : null;
      // 네더 (좌표는 씨앗으로 정해져요)
      const nb = (bm, ox, oz) => { for (let r = 0; r < 1600; r += 24) for (let a = 0; a < 24; a++) { const x = Math.floor(ox + Math.cos(a / 24 * 6.283) * r), z = Math.floor(oz + Math.sin(a / 24 * 6.283) * r); if ([[0, 0], [20, 0], [-20, 0], [0, 20], [0, -20]].every(([u, v]) => nBiome(x + u, z + v) === bm)) return { x, z } } return null };
      const nx = Math.floor(T.px / 8), nz = Math.floor(T.pz / 8);
      T.crimson = nb(2, nx, nz); T.warped = nb(3, nx, nz); T.basalt = nb(4, nx, nz); T.soul = nb(1, nx, nz); T.bastion = LOCATORS.bastion_remnant.find(nx, nz);
      // 엔드: 배가 있는 도시
      let best = null, bd = 1e9; for (let a = -12; a <= 12; a++)for (let q = -12; q <= 12; q++) { if (hash2(a, q, SEED + 1401) > .35) continue; const tx = a * 96 + 48, tz = q * 96 + 48; if (Math.hypot(tx, tz) < 220) continue; const t = islandTop(tx, tz); if (!t) continue;
        const r = mulberry((Math.imul(tx, 7919) ^ Math.imul(tz, 104729) ^ Math.imul(SEED, 31337)) | 0); const TH = 16 + Math.floor(r() * 12), dir = CH_D[Math.floor(r() * 4)], BL = 12 + Math.floor(r() * 8); if (r() >= .6) continue; const d = Math.hypot(tx, tz); if (d < bd) { bd = d; best = { x: tx, y: t.top + 1, z: tz, TT: t.top + 11 + TH, dir, BL } } }
      T.city = best;
      // 블록 텍스처 벽 (스폰 북쪽 8칸)
      const w = [[GRASS, DIRT, STONE, COBBLE, MOSSY_COBBLE, GRANITE, DIORITE, ANDESITE, DEEPSLATE, TUFF, CALCITE, SAND, GRAVEL],
        [COAL_ORE, IRON_ORE, COPPER_ORE, GOLD_ORE, REDSTONE_ORE, LAPIS_ORE, DIAMOND_ORE, EMERALD_ORE, CLAY, MUD, MOSS_BLOCK, SNOW, PACKED_ICE],
        [PLANKS, SPRUCE_PLANKS, BIRCH_PLANKS, JUNGLE_PLANKS, ACACIA_PLANKS, DARK_OAK_PLANKS, MANGROVE_PLANKS, CHERRY_PLANKS, PALE_OAK_PLANKS, BAMBOO_PLANKS, CRIMSON_PLANKS, WARPED_PLANKS, BOOKSHELF],
        [LOG, SPRUCE_LOG, BIRCH_LOG, JUNGLE_LOG, ACACIA_LOG, DARK_OAK_LOG, MANGROVE_LOG, CHERRY_LOG, PALE_OAK_LOG, TABLE, FURNACE, PUMPKIN, MELON],
        [BRICKS, STONE_BRICKS, MOSSY_SB, MUD_BRICKS, SANDSTONE, RED_SANDSTONE, PRISMARINE, QUARTZ_BLOCK, OBSIDIAN, NETHERRACK, NETHER_BRICKS, BLACKSTONE, END_STONE],
        [COAL_BLOCK, IRON_BLOCK, COPPER_BLOCK, GOLD_BLOCK, REDSTONE_BLOCK, LAPIS_BLOCK, DIAMOND_BLOCK, EMERALD_BLOCK, AMETHYST_BLOCK, GLOWSTONE, TNT, HAY, PURPUR]];
      const wz = T.pz - 9; let gy = 0; for (let dx = -7; dx <= 7; dx++) gy = Math.max(gy, B.terrainH(T.px + dx, wz) + 1);
      for (let dx = -7; dx <= 7; dx++)for (let dz = -1; dz <= 9; dz++) { for (let y = gy - 1; y < gy + 9; y++) setBlock(T.px + dx, y, wz + dz, y === gy - 1 ? GRASS : AIR) }
      w.forEach((row, ri) => row.forEach((id, ci) => setBlock(T.px - 6 + ci, gy + 5 - ri, wz, id)));
      T.wall = { x: T.px, y: gy, z: wz };
      return T });
    console.log('targets', JSON.stringify(T));
    // 카메라 도우미 (페이지 안): 눈 위치 (x,y,z) 에서 (tx,ty,tz) 를 봐요
    await rec.eval(T => { window.__T = T;
      window.__cam = (x, y, z, tx, ty, tz) => { const p = __BC.player; p.fly = true; p.pos.set(x, y - 1.62, z); p.prev.copy(p.pos); p.vel.set(0, 0, 0); const dx = tx - x, dz = tz - z, dy = ty - y; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)) };
      window.__orbit = (o, k) => { const a = o.a0 + (o.a1 - o.a0) * k; __cam(o.cx + Math.cos(a) * o.r, o.cy + o.h, o.cz + Math.sin(a) * o.r, o.cx, o.cy, o.cz) };
      // 그 칸 위로 빈 바닥 찾기 (주변을 돌며)
      window.__floor = (x, z, R = 14) => { const g = __BC.getB; for (let r = 0; r <= R; r += 2) for (let dx = -r; dx <= r; dx += 2) for (let dz = -r; dz <= r; dz += 2) { if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; for (let y = 26; y < 86; y++) if (SOLID[g(x + dx, y - 1, z + dz)] && [0, 1, 2, 3, 4, 5].every(k => g(x + dx, y + k, z + dz) === AIR)) return { x: x + dx, y, z: z + dz } } return { x, y: 60, z } };
      window.__corr = s => { const g = __BC.getB; let best = null;
        for (let dx = -40; dx <= 40; dx++)for (let dz = -40; dz <= 40; dz++)for (let dy = -12; dy <= 12; dy++) { const x = s.x + dx, y = s.y + dy, z = s.z + dz; if (g(x, y, z) !== RAIL) continue;
          for (const [ax, az] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { let rails = 0, ok = true; for (let n = 0; n < 10 && ok; n++) { const v = g(x + ax * n, y, z + az * n); if (v === RAIL) rails++; else if (v !== AIR) ok = false; if (g(x + ax * n, y + 1, z + az * n) !== AIR) ok = false }
            const d = Math.hypot(dx, dz); if (ok && rails >= 5 && (!best || d < best.d)) best = { x, y, z, ax, az, d } } }
        return best };
      window.__bestDir = (f, h = 2.5) => { const g = __BC.getB; let best = 0, bd = -1; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; let d = 0; for (; d < 30; d += .5) { const x = Math.floor(f.x + .5 + Math.cos(a) * d), z = Math.floor(f.z + .5 + Math.sin(a) * d), y = Math.floor(f.y + h); if (SOLID[g(x, y, z)] || SOLID[g(x, y - 1, z)]) break } if (d > bd) { bd = d; best = a } } return best };
      // 엔드 바깥 섬: 섬이 가장 많이 보이는 쪽
      window.__islandDir = (x, z) => { let best = 0, bc = -1; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; let c = 0; for (let d = 6; d <= 40; d += 2) if (islandTop(Math.round(x + Math.cos(a) * d), Math.round(z + Math.sin(a) * d))) c++; if (c > bc) { bc = c; best = a } } return best };
      hideGui = true }, T);
    rec.T = T;
  },
  async play(rec) {
    const T = rec.T;
    const skip = async sec => { for (let i = 0; i < sec; i++) await rec.eval(() => { for (let k = 0; k < 30; k++) __VT.step(1000 / 30) }) };
    const set = (f, a) => rec.eval(f, a);
    const goTo = async (x, y, z, sec = 6) => { await set(([x, y, z]) => __cam(x, y, z, x + 1, y, z + 1), [x, y, z]); await skip(sec) };

    // 1) 시작: 스폰 위 하늘에서 천천히
    await set(() => { const T = __T; __cam(T.px - 26, T.wall.y + 18, T.pz + 20, T.px, T.wall.y, T.pz - 10) });
    await skip(8);
    await rec.card(`<div class="s">NEW</div><h1>더 넓은 <b>세계</b></h1><div class="s">구조물 · 바이옴 · 네더 · 엔드 · 마인크래프트 느낌 블록 텍스처</div>`, 4);
    await rec.shoot(4, t => { const T = __T; __cam(T.px - 26 + t * 3, T.wall.y + 18 - t * .5, T.pz + 20 - t * 2, T.px, T.wall.y, T.pz - 10) });

    // 2) 블록 텍스처 벽
    await set(() => { const W = __T.wall; __cam(W.x - 3, W.y + 3.4, W.z + 9.5, W.x - 3, W.y + 2.6, W.z) });
    await skip(1);
    await rec.caption('NEW', '블록 텍스처를 새로 그렸어요', '돌 · 광석 · 나무 · 벽돌 … 마인크래프트 느낌 그대로 (게임 안에서 직접 그린 그림이에요)', 6.6);
    await rec.shoot(7, t => { const W = __T.wall, k = t / 7, x = W.x - 3 + k * 6; __cam(x, W.y + 3.4, W.z + 9.5 - Math.sin(k * 3.14) * 1.5, x, W.y + 2.6, W.z) });

    // 3) 오버월드 구조물 8종 (/locate 이름)
    const S = [
      ['mineshaft', 'Mineshaft', '땅속 갱도 · 레일 · 판자 다리 · 상자 수레'],
      ['jungle_pyramid', 'Jungle Pyramid', '덩굴 덮인 정글 사원 · 화살 함정 · 숨은 보물'],
      ['swamp_hut', 'Swamp Hut', '늪 위 마녀의 오두막'],
      ['igloo', 'Igloo', '눈밭 이글루 · 바닥 밑 비밀 방'],
      ['pillager_outpost', 'Pillager Outpost', '약탈자 감시탑 · 철창 우리'],
      ['shipwreck', 'Shipwreck', '바닷속 난파선 · 보물 지도'],
      ['ocean_ruin', 'Ocean Ruins', '바다 밑 돌 폐허'],
      ['ruined_portal', 'Ruined Portal', '부서진 차원문 · 금 보물 상자'],
    ];
    for (const [k, name, sub] of S) {
      const s = T[k]; if (!s) continue;
      const under = k === 'mineshaft', water = k === 'shipwreck' || k === 'ocean_ruin';
      // 구조물마다 가운데 · 거리 · 높이 (SURF_BOX 가운데에 맞춰요)
      const Q = { jungle_pyramid: [6, 2, 7.5, 21, 10], swamp_hut: [3.5, 3, 5, 15, 7], igloo: [0, 1, 1, 15, 8], pillager_outpost: [4, 10, 4, 27, 3], shipwreck: [3, 1, 3, 14, 4], ocean_ruin: [3, 1, 3, 14, 4], ruined_portal: [2, 3, 2, 16, 6] }[k] || [4, 2, 4, 20, 10];
      const o = under ? null : { cx: s.x + Q[0], cy: s.y + Q[1], cz: s.z + Q[2], r: Q[3], h: Q[4], a0: 3.93 - .22, a1: 3.93 + .22 };
      let cr = null;
      if (under) { await set(() => { FULLBRIGHT = true; dimVisual() }); await goTo(s.x + .5, s.y + 2.6, s.z + .5, 7); cr = await rec.eval(s => __corr(s), s); if (cr) { await set(c => __cam(c.x + .5 - c.ax, c.y + 1.62, c.z + .5 - c.az, c.x + .5 + c.ax * 12, c.y + 1.2, c.z + .5 + c.az * 12), cr); await skip(2) } }
      else { if (water) await set(() => { FULLBRIGHT = true; dimVisual() }); await set(o => __orbit(o, 0), o); await skip(7) }
      await rec.caption('NEW', name, sub, 3.4);
      if (under && cr) await rec.shoot(3.6, (t, c) => { const k = t * .7; __cam(c.x + .5 + c.ax * (k - 1), c.y + 1.62, c.z + .5 + c.az * (k - 1), c.x + .5 + c.ax * 12, c.y + 1.2, c.z + .5 + c.az * 12) }, cr);
      else if (under) await rec.shoot(3.6, (t, s) => { __cam(s.x + .5 + t * .5, s.y + 2.6, s.z + .5 + t * .5, s.x + 6 + t, s.y + 2.2, s.z + 6) }, s);
      else await rec.shoot(3.6, (t, o) => __orbit(o, t / 3.6), o);
      if (under || water) await set(() => { FULLBRIGHT = false; dimVisual() });
    }

    // 4) 창백한 정원
    if (T.pale) {
      await set(() => { const P = __T.pale, y = __BC.terrainH(P.x, P.z) + 3; __cam(P.x - 6, y, P.z - 6, P.x + 20, y + 1, P.z + 20) });
      await skip(7);
      await rec.caption('NEW', 'Pale Garden', '창백한 정원 · 매달린 이끼 · 회색 안개 · 밤엔 삐걱이 (Creaking)', 4.6);
      await rec.shoot(5, t => { const P = __T.pale, y = __BC.terrainH(P.x, P.z) + 3; __cam(P.x - 6 + t * 1.2, y, P.z - 6 + t * 1.2, P.x + 20, y + 1, P.z + 20) });
    }

    // 5) 네더
    await set(() => __BC.runCmd('/nether'));
    await skip(9);
    const nether = [['crimson', 'Crimson Forest', '거대 진홍빛 균 · 늘어지는 덩굴 · 버섯불'], ['warped', 'Warped Forest', '뒤틀린 균 · 뒤틀린 덩굴 · 보랏빛 안개'], ['soul', 'Soul Sand Valley', '영혼 모래 골짜기 · 청록 안개 · 네더 화석'], ['basalt', 'Basalt Deltas', '현무암 삼각주 · 용암 웅덩이 · 회색 안개']];
    for (const [k, name, sub] of nether) {
      const n = T[k]; if (!n) continue;
      await set(n => __cam(n.x + .5, 70, n.z + .5, n.x + 5, 70, n.z + 5), n); await skip(7);
      const f = await rec.eval(n => __floor(n.x, n.z), n);
      f.a = await rec.eval(f => __bestDir(f), f);
      await set(f => __cam(f.x + .5, f.y + 2.5, f.z + .5, f.x + .5 + Math.cos(f.a) * 14, f.y + 2, f.z + .5 + Math.sin(f.a) * 14), f); await skip(1.5);
      await rec.caption('NEW', name, sub, 3.4);
      await rec.shoot(3.6, (t, f) => { const a = f.a - .16 + t * .09; __cam(f.x + .5, f.y + 2.5, f.z + .5, f.x + .5 + Math.cos(a) * 14, f.y + 2, f.z + .5 + Math.sin(a) * 14) }, f);
    }
    // 보루 잔해 · 피글린 물물교환
    if (T.bastion) {
      const X = T.bastion.x - 15, Z = T.bastion.z - 15, Y = T.bastion.y - 1, V = { X, Y, Z, cx: T.bastion.x, cz: T.bastion.z };
      await set(V => { FULLBRIGHT = true; dimVisual(); __cam(V.X + 10.5, V.Y + 3.4, V.Z + 10.5, V.X + 18, V.Y + 1.5, V.Z + 18) }, V); await skip(8);
      await set(() => { for (const m of mobs) if (m.type === 'piglin' && m.pos.distanceTo(__BC.player.pos) < 5) m.pos.y -= 80 });
      await rec.caption('NEW', 'Bastion Remnant', '피글린의 흑암 요새 · 금 블록 · 피글린 야수 · 호글린', 3.6);
      await rec.shoot(3.8, (t, V) => __cam(V.X + 10.5 + t * .35, V.Y + 3.4 + t * .25, V.Z + 10.5 + t * .1, V.X + 18, V.Y + 1.5 + t * .4, V.Z + 18), V);
      // 물물교환: 앞에 피글린 한 마리 · 금괴를 건네요
      await set(V => { hideGui = false; const x = V.X + 11.5, z = V.Z + 3.5; __cam(x, V.Y + 2.62, z, x + 3, V.Y + 2.3, z); for (const m of mobs) if (m.pos.distanceTo(__BC.player.pos) < 12) m.pos.y -= 80;
        const m = spawnMob('piglin', x + 3, V.Y + 1, z + .3); m.yaw = -Math.PI / 2 - .55; m.ai.t = 999; m.ai.mv = false; m.keep = 1; window.__pg = m;
        __BC.inv[0] = { id: GOLD, n: 12, d: 0 }; __BC.selectSlot(0) }, V);
      await skip(1);
      await rec.caption('NEW', 'Piglin 물물교환', '금괴를 주면 금을 구경하다가 물건을 바꿔 줘요 · 금 갑옷을 입으면 얌전해요', 5.6);
      await rec.shoot(6, t => { const m = window.__pg; if (!m) return; m.yaw = -Math.PI / 2 - .55; if (t > .6 && !window.__given) { window.__given = 1; piglinUse(m, __BC.inv[0]); m.barter = 3.6 } });
      await set(() => { hideGui = true; FULLBRIGHT = false; dimVisual() });
    }

    // 6) 엔드 (드래곤은 쉬게 하고)
    await set(() => { dimState.dragonDead = true; dimState.gw = 1; __BC.runCmd('/end') });
    await skip(9);
    const C = T.city;
    if (C) {
      const px = -C.dir[1], pz = C.dir[0], E = 7 + C.BL, sx = C.x + C.dir[0] * (E + 3), sz = C.z + C.dir[1] * (E + 3);
      const o = { cx: (C.x + sx) / 2, cy: C.TT - 4, cz: (C.z + sz) / 2, r: 46, h: 16, a0: Math.atan2(C.dir[1] + pz, C.dir[0] + px) - .25, a1: Math.atan2(C.dir[1] + pz, C.dir[0] + px) + .25 };
      await set(o => __orbit(o, 0), o); await skip(9);
      await rec.caption('NEW', 'End City · End Ship', '여러 층 엔드 도시 · 나선 계단 탑 · 다리 끝 엔드 배 (배 안에 겉날개!)', 5.6);
      await rec.shoot(6, (t, o) => __orbit(o, t / 6), o);
      // 셜커: 다리 위에서 탄을 맞고 둥실
      const B2 = { x: C.x + C.dir[0] * 9.5 + .0, z: C.z + C.dir[1] * 9.5, y: C.TT + 1, dx: C.dir[0], dz: C.dir[1] };
      await set(B2 => { hideGui = false; __cam(B2.x + .5, B2.y + 1.62, B2.z + .5, B2.x + .5 + B2.dx * 6, B2.y + .6, B2.z + .5 + B2.dz * 6); for (const m of mobs) if (m.type === 'shulker' && m.pos.distanceTo(__BC.player.pos) < 14) m.pos.y -= 80;
        const m = spawnMob('shulker', B2.x + .5 + B2.dx * 6, B2.y, B2.z + .5 + B2.dz * 6); m.keep = 1; window.__sk = m }, B2);
      await skip(1);
      await set(() => { const p = __BC.player; __BC.inv[0] = { id: toolId(3, 3), n: 1, d: 0 }; __BC.selectSlot(0); __BC.runCmd('/gamemode survival'); p.fly = false; p.hp = 20 });
      await rec.caption('NEW', 'Shulker', '껍데기를 열고 따라오는 탄을 쏴요 · 맞으면 둥실 떠올라요', 4.6);
      await rec.shoot(5, t => { });
      await set(() => { const p = __BC.player; __BC.runCmd('/gamemode creative'); p.hp = 20; levT = 0; clearSbul(); hideGui = true; if (window.__sk) window.__sk.pos.y -= 80 });
    }
    // 엔드 관문: 드래곤을 물리치면 생겨요
    const G = await rec.eval(() => gwRing(1));
    await set(G => __cam(G.x - 9, G.y + 3, G.z - 9, G.x, G.y + 1, G.z), G); await skip(6);
    await set(() => spawnGateway());
    await rec.caption('NEW', 'End Gateway', '드래곤을 물리치면 섬 가장자리에 관문이 열려요 · 들어가면 먼 바깥 섬으로', 4.6);
    await rec.shoot(5, (t, G) => __cam(G.x - 9 + t * .6, G.y + 3, G.z - 9 + t * .2, G.x, G.y + 1 + t * .8, G.z), G);
    // 관문을 지나서 바깥 섬
    await set(G => { const p = __BC.player; p.fly = false; p.pos.set(G.x + 1.8, G.y - 1, G.z + 1.8); p.prev.copy(p.pos); p.vel.set(0, 0, 0) }, G);
    await skip(8);
    const L = await rec.eval(() => { const p = __BC.player; return { x: p.pos.x, y: p.pos.y, z: p.pos.z, a: __islandDir(p.pos.x, p.pos.z) } });
    await set(L => __cam(L.x - Math.cos(L.a) * 4, L.y + 9, L.z - Math.sin(L.a) * 4, L.x + Math.cos(L.a) * 24, L.y, L.z + Math.sin(L.a) * 24), L);
    await skip(1.5);
    await rec.caption('NEW', '바깥 섬', '가지 뻗는 후렴초 숲 · 작은 엔드 섬들', 3.6);
    await rec.shoot(4, (t, L) => { const a = L.a + t * .05; __cam(L.x - Math.cos(a) * 4, L.y + 9, L.z - Math.sin(a) * 4, L.x + Math.cos(a) * 24, L.y, L.z + Math.sin(a) * 24) }, L);

    // 7) 마무리
    await rec.card(`<h1>블록<b>크래프트</b></h1><ul><li>구조물: 폐광 · 정글 사원 · 늪 오두막 · 이글루 · 전초기지 · 난파선 · 바다 폐허 · 폐허 차원문</li><li>바이옴: 창백한 정원 · 무성한 동굴 꾸미기</li><li>네더: 거대 균 · 보루 잔해 · 피글린 · 호글린 · 스트라이더</li><li>엔드: 엔드 도시 · 엔드 배 · 셜커 · 엔드 관문</li><li>마인크래프트 느낌으로 새로 그린 블록 텍스처</li></ul><div class="s">/locate 이름 으로 찾아가 보세요!</div>`, 5);
    await rec.shoot(5, t => { __BC.player.yaw -= .003 });
  },
};
