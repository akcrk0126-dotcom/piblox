// 블록크래프트 "시간의 방 · 시련의 회당" 업데이트 트레일러: 시간의 문 (석영 틀 + 시계) · 시간의 방 (하얀 방 · 신전 · 시간 수정 · 그림자 분신 · 모래시계 · 수련 효과)
// · 시련의 회당 (응회암 · 구리 방 · 시련 생성기 → 시련 열쇠 · 금고 · 브리즈 · 돌풍구 점프 · 철퇴 내려치기)
module.exports = {
  page: 'craft.html',
  loadWait: 9000,
  async prepare(rec) {
    await rec.eval(() => { const B = __BC; B.enterWorld({ id: 'trailer5', name: 'Trailer', seed: 4242, mode: 'creative', type: 'default', gen: 4 }, null); B.hideMenu(); B.startGame(); B.runCmd('/time set 3500'); B.runCmd('/weather clear 99999');
      const st = document.createElement('style'); st.textContent = '#menu{display:none!important}#chat{display:none!important}#bossBar{display:none!important}#waypt{display:none!important}'; document.head.appendChild(st) });
    await rec.wait(12000);
    const T = await rec.eval(() => {
      const B = __BC, p = B.player, T = { px: Math.floor(p.pos.x), pz: Math.floor(p.pos.z) };
      const s = nearestOf(TRIAL, T.px, T.pz); T.tr = { x: s.x, y: s.y, z: s.z };
      // 스폰 북쪽에 석영 마당 + 시간의 문 틀 (아직 안 켜짐)
      const fz = T.pz - 7; let gy = 0; for (let dx = -4; dx <= 6; dx++)for (let dz = -3; dz <= 4; dz++) gy = Math.max(gy, B.terrainH(T.px + dx, fz + dz) + 1);
      for (let dx = -4; dx <= 6; dx++)for (let dz = -3; dz <= 5; dz++) { for (let y = gy - 3; y < gy + 9; y++) setBlock(T.px + dx, y, fz + dz, y < gy - 1 ? STONE : y === gy - 1 ? (Math.abs(dx - 1) + Math.abs(dz) < 3 ? GOLD_BLOCK : QUARTZ_BRICKS) : AIR) }
      for (let y = 0; y < 5; y++)for (let x = 0; x < 4; x++) setBlock(T.px + x, gy + y, fz, (x === 0 || x === 3 || y === 0 || y === 4) ? QUARTZ_BLOCK : AIR);
      T.fr = { x: T.px, y: gy, z: fz };
      return T });
    console.log('targets', JSON.stringify(T));
    await rec.eval(T => { window.__T = T;
      window.__cam = (x, y, z, tx, ty, tz) => { const p = __BC.player; p.fly = true; p.pos.set(x, y - 1.62, z); p.prev.copy(p.pos); p.vel.set(0, 0, 0); const dx = tx - x, dz = tz - z, dy = ty - y; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)) };
      window.__orbit = (o, k) => { const a = o.a0 + (o.a1 - o.a0) * k; __cam(o.cx + Math.cos(a) * o.r, o.cy + o.h, o.cz + Math.sin(a) * o.r, o.cx, o.cy, o.cz) };
      // 땅에 선 채로 (생존 모드) 그 자리에서 바라보기
      window.__stand = (x, y, z, yaw, pitch) => { const p = __BC.player; p.fly = false; p.pos.set(x, y, z); p.prev.copy(p.pos); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch || 0 };
      window.__safe = () => { const p = __BC.player; p.hp = 20; p.food = 20; p.hurtT = Math.max(p.hurtT || 0, .6) };
      hideGui = true }, T);
    rec.T = T;
  },
  async play(rec) {
    const skip = async sec => { for (let i = 0; i < sec * 30; i++) await rec.eval(() => __VT.step(1000 / 30)) };
    const set = (f, a) => rec.eval(f, a);

    // 1) 시작: 석영 마당 위 (아직 꺼진 시간의 문)
    await set(() => { const F = __T.fr; __cam(F.x + 14, F.y + 7, F.z + 14, F.x + 1.5, F.y + 2, F.z) });
    await skip(8);
    await rec.card(`<div class="s">NEW</div><h1>시간의 방 · <b>시련의 회당</b></h1><div class="s">새 차원 Time Chamber · 땅속 Trial Chambers · 브리즈 · 돌풍구 · 철퇴</div>`, 6.4);
    await rec.shoot(7, t => { const F = __T.fr, k = t / 7; __cam(F.x + 14 - k * 5, F.y + 7 - k * 2.5, F.z + 14 - k * 3, F.x + 1.5, F.y + 2, F.z) });

    // 2) 시간의 문 켜기: 석영 틀 + 시계
    await set(() => { const F = __T.fr; hideGui = false; __BC.inv[0] = { id: CLOCK, n: 1, d: 0 }; __BC.selectSlot(0); __cam(F.x + 1.9, F.y + 1.62, F.z + 6.5, F.x + 1.5, F.y + 2.2, F.z) });
    await skip(1);
    await rec.caption('NEW', '시간의 문', '석영 블록으로 네더 차원문처럼 틀을 짓고, 시계를 들고 오른쪽 클릭 (또는 /timechamber)', 5);
    await rec.shoot(5.4, t => { const F = __T.fr, k = Math.min(1, t / 5); __cam(F.x + 1.9 - k * .3, F.y + 1.62, F.z + 6.5 - k * 2.2, F.x + 1.5, F.y + 2.2, F.z);
      if (t > 1.4 && !window.__lit) { window.__lit = 1; doSwing(); tryLightPortal(F.x + 1, F.y + 1, F.z, [QUARTZ_BLOCK, TIME_FRAME], TIME_PORTAL); sfx('portal') } });

    // 3) 시간의 방: 하얀 방 한가운데 신전
    await set(() => { hideGui = true; travelTime() });
    await skip(10);
    const Y = await rec.eval(() => tcY());
    const o1 = { cx: 0, cy: Y + 7, cz: 0, r: 30, h: 7, a0: 1.25, a1: 1.95 };
    await set(o => __orbit(o, 0), o1); await skip(3);
    await rec.caption('NEW', 'Time Chamber · 시간의 방', '끝없는 하얀 방 · 안에서는 시간이 10배 빨리 흘러요 · 혼자 할 땐 바깥 시간이 멈춰요', 5.6);
    await rec.shoot(6, (t, o) => __orbit(o, t / 6), o1);
    // 신전 안
    await set(Y => __cam(5.5, Y + 3.6, 5.5, -3, Y + 3, -4), Y); await skip(1.5);
    await rec.caption('NEW', '신전 안', '침대에서 푹 쉬기 · 음식 상자 · 10배 빠른 화로 · 마법부여대 · 출구 차원문', 4.4);
    await rec.shoot(4.6, (t, Y) => { const k = t / 4.6; __cam(5.5 - k * 2, Y + 3.6, 5.5 - k * .5, -3 + k * 2, Y + 3, -4) }, Y);
    // 시간 수정
    const cr = await rec.eval(() => { for (let r = 50; r < 160; r += 3) for (let a = 0; a < 40; a++) { const x = Math.round(Math.cos(a / 40 * 6.28) * r), z = Math.round(Math.sin(a / 40 * 6.28) * r); const cx = x >> 4, cz = z >> 4, rr = mulberry((Math.imul(cx, 73129) ^ Math.imul(cz, 95471) ^ Math.imul(SEED, 2203)) | 0); if (Math.hypot(cx * 16 + 8, cz * 16 + 8) > 44 && rr() < .07) return { x: cx * 16 + 8, z: cz * 16 + 8 } } return null });
    if (cr) {
      const o2 = { cx: cr.x, cy: Y + 2, cz: cr.z, r: 13, h: 4, a0: 3.6, a1: 4.3 };
      await set(o => __orbit(o, 0), o2); await skip(5);
      await rec.caption('NEW', '시간 수정', '멀리서 금빛으로 반짝여요 · 캐면 시간 조각 → 모래시계를 만들어요', 3.8);
      await rec.shoot(4, (t, o) => __orbit(o, t / 4), o2);
    }
    // 그림자 분신 + 모래시계: 6초 동안 시간이 멈춰요
    await set(Y => { const p = __BC.player; __BC.runCmd('/gamemode survival'); __stand(24.5, Y + 1, 24.5, 0, -.08); __safe(); hideGui = false; __BC.inv[0] = { id: HOURGLASS, n: 1, d: 0 }; __BC.selectSlot(0);
      const m = spawnMob('shadow', 24.5, Y + 1, 12.5); m.keep = 1; m.yaw = 0; window.__sh = m }, Y);
    await skip(.5);
    await rec.caption('NEW', '그림자 분신 · 모래시계', '나를 닮은 그림자가 덤벼요 (맞으면 등 뒤로 순간이동) · 모래시계를 쓰면 6초 동안 시간이 멈춰요', 6, true);
    await rec.shoot(6.4, t => { __safe(); if (t > 1.7 && !window.__hg) { window.__hg = 1; doSwing(); useHourglass(__BC.inv[0]) } });
    await set(() => { tStopT = 0; tStopCD = 0; renderer.domElement.style.filter = ''; if (window.__sh) { window.__sh.dead = true; window.__sh.deadT = 1 } __BC.runCmd('/gamemode creative'); hideGui = true });
    // 나오면 수련 효과
    await set(() => { player.tcStay = 300; travelTime() });
    await skip(9);
    await set(() => { const F = __T.fr; hideGui = false; __BC.inv[1] = null; __BC.selectSlot(1); __cam(F.x + 4.5, F.y + 1.62, F.z + 5.5, F.x + 1.5, F.y + 2.4, F.z) });
    await skip(1);
    await rec.caption('NEW', '수련 효과', '오래 수련하고 나오면 힘 +2 · 빠르기 +15% (최대 10분) · 왼쪽 위에 남은 시간', 4.4, true);
    await rec.shoot(4.6, t => { const F = __T.fr, k = t / 4.6; __cam(F.x + 4.5 - k * 1.5, F.y + 1.62, F.z + 5.5 - k, F.x + 1.5, F.y + 2.4, F.z) });

    // 4) 시련의 회당: 땅속 응회암 · 구리 방
    await set(() => { hideGui = true; const S = __T.tr; __cam(S.x + 6.9, S.y + 5.2, S.z + .5, S.x + .5, S.y + 2, S.z + .5) });
    await skip(9);
    await rec.caption('NEW', 'Trial Chambers · 시련의 회당', '땅속 깊이 숨은 응회암 · 구리 방들 · /locate trial_chambers 로 찾아가요', 5);
    await rec.shoot(5.4, t => { const S = __T.tr, a = -.42 + t / 5.4 * .84, X = S.x + .5, Z = S.z + .5; __cam(X + Math.cos(a) * 6.4, S.y + 5.2 - t * .2, Z + Math.sin(a) * 6.4, X, S.y + 2, Z) });
    // 복도 → 싸움방
    await rec.caption('NEW', '복도 · 싸움방', '구리 전구 · 응회암 벽돌 · 구리 격자 · 보급 상자 · 방마다 다른 몹', 4.2);
    await rec.shoot(4.6, t => { const S = __T.tr, X = S.x + .5, Z = S.z + .5, k = t / 4.6; __cam(X + 6 + k * 15, S.y + 2.7, Z, X + 31, S.y + 2.2, Z - k * 2) });
    // 시련 생성기: 가까이 가면 깨어나요 → 몹을 다 물리치면 시련 열쇠
    await set(() => { const S = __T.tr, X = S.x + .5, Z = S.z + .5; __BC.runCmd('/gamemode survival'); __stand(X + 5.6, S.y + 1, Z + .2, Math.PI / 2, -.12); __safe(); hideGui = false;
      __BC.inv[0] = { id: toolId(3, 3), n: 1, d: 0 }; __BC.selectSlot(0); window.__kills = 0; window.__swing = 0 });
    await rec.caption('NEW', '시련 생성기 (Trial Spawner)', '가까이 가면 깨어나서 몹을 내보내요 · 다 물리치면 시련 열쇠가 튀어나와요!', 9, true);
    await rec.shoot(10, t => { __safe(); const p = __BC.player, S = __T.tr, k = tkey(S.x, S.y + 2, S.z), st = TSTATE.get(k);
      if (st && st.st === 'active' && !window.__lset) { window.__lset = 1; st.left = Math.min(st.left, 3) }
      let near = null, nd = 9; for (const m of mobs) if (m.trial && !m.dead) { if (m.hp > 6) m.hp = 6; const d = m.pos.distanceTo(p.pos); if (d < nd) { nd = d; near = m } }
      if (near) { p.yaw = Math.atan2(-(near.pos.x - p.pos.x), -(near.pos.z - p.pos.z)); if (nd < 2.8 && t - window.__swing > .45) { window.__swing = t; p.atkTicker = 100; attack(near) } }
      else { let a = Math.PI / 2 - p.yaw; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; p.yaw += a * .08 } });
    // 금고: 시련 열쇠로 열어요
    await set(() => { const S = __T.tr, vx = S.x - 2, vy = S.y + 1, vz = S.z + 29; for (const m of mobs) if (m.trial) { m.dead = true; m.deadT = 1 } __stand(vx + .5, vy, vz - 3.7, Math.PI, -.28); __safe(); __BC.inv[0] = { id: TRIAL_KEY, n: 1, d: 0 }; __BC.selectSlot(0) });
    await skip(2);
    await rec.caption('NEW', '금고 (Vault)', '시련 열쇠로 열면 보물이 하나씩 튀어나와요 · 무거운 핵이 나올지도!', 5.4, true);
    await rec.shoot(5.8, t => { __safe(); const S = __T.tr, vx = S.x - 2, vy = S.y + 1, vz = S.z + 29; if (t > 1 && !window.__vo) { window.__vo = 1; useVault({ x: vx, y: vy, z: vz, id: getB(vx, vy, vz) }) } for (const e of ents) e.pick = e.age + 1 });
    // 브리즈: 깡충 뛰며 돌풍구를 쏴요
    await set(() => { const S = __T.tr, X = S.x + .5, Z = S.z + .5; for (const e of ents.slice()) { scene.remove(e.m) } ents.length = 0; __BC.inv[0] = null; __stand(X, S.y + 1, Z - 19.6, 0, -.05); __safe(); __BC.selectSlot(3);
      const m = spawnMob('breeze', X - 2.5, S.y + 1, Z - 23.5); m.keep = 1; window.__bz = m });
    await skip(.4);
    await rec.caption('NEW', 'Breeze · 브리즈', '바람 기둥 몹 · 깡충 뛰며 돌풍구를 쏴서 날려 버려요 · 화살은 그냥 지나가요', 5.6, true);
    await rec.shoot(6, t => { __safe(); const p = __BC.player, m = window.__bz; if (m && !m.dead) { const dx = m.pos.x - p.pos.x, dz = m.pos.z - p.pos.z, dy = m.pos.y + 1.2 - (p.pos.y + 1.62); const ty = Math.atan2(-dx, -dz); let a = ty - p.yaw; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; p.yaw += a * .2; p.pitch += (Math.atan2(dy, Math.hypot(dx, dz)) - p.pitch) * .2 } });
    await set(() => { if (window.__bz) { window.__bz.dead = true; window.__bz.deadT = 1 } for (const m of mobs) if (m.trial) { m.dead = true; m.deadT = 1 } });

    // 5) 돌풍구 점프 (밖에서)
    await set(() => { const F = __T.fr; __stand(F.x + 1.5, F.y, F.z + 3.5, 0, 0); __safe(); __BC.inv[0] = { id: WIND_CHARGE, n: 16, d: 0 }; __BC.inv[1] = { id: MACE, n: 1, d: 0 }; __BC.selectSlot(0); window.__wj = 0 });
    await skip(2.5);
    await rec.caption('NEW', '돌풍구 (Wind Charge)', '발밑에 던지면 높이 뛰어올라요 · 떨어져도 안 다쳐요 · 브리즈 막대 하나로 4개', 5, true);
    await rec.shoot(5.2, t => { __safe(); const p = __BC.player;
      if (t < .9) p.pitch += (-1.42 - p.pitch) * .25; else if (!window.__wj) { window.__wj = 1; throwThing(__BC.inv[0]) } else p.pitch += (-.25 - p.pitch) * .06 });
    // 철퇴: 날아올랐다가 떨어지며 내려치기
    await set(() => { const F = __T.fr, p = __BC.player; __stand(F.x + 1.5, F.y, F.z + 3.5, 0, 0); __safe(); __BC.selectSlot(0); window.__ms = 0; window.__mw = 0; window.__hk = null });
    await skip(1.5);
    await rec.caption('NEW', '철퇴 (Mace)', '높은 데서 떨어지며 내려치면 떨어진 만큼 세져요 · 무거운 핵 + 브리즈 막대', 5.4, true);
    await rec.shoot(5.8, t => { __safe(); const p = __BC.player, m = window.__hk;
      if (t < .8) p.pitch += (-1.42 - p.pitch) * .25;
      else if (!window.__mw) { window.__mw = 1; throwThing(__BC.inv[0]) }
      else { if (t > 1.1 && __BC.inv[1] && window.__ms === 0) { __BC.selectSlot(1); window.__ms = 1; const F = __T.fr, h = spawnMob('husk', p.pos.x, F.y, p.pos.z - 1.1); h.keep = 1; h.yaw = Math.PI; window.__hk = h }
        if (m && !m.dead) { const dx = m.pos.x - p.pos.x, dz = m.pos.z - p.pos.z; p.pitch += (-1.25 - p.pitch) * .1; if (Math.hypot(dx, dz) > .3) p.yaw = Math.atan2(-dx, -dz);
          if (window.__ms === 1 && p.fallDist > 1.5 && !p.onGround && p.pos.y - m.pos.y < 2.4 && Math.hypot(dx, dz) < 2.2) { window.__ms = 2; p.atkTicker = 100; attack(m) } } else p.pitch += (-.3 - p.pitch) * .08 } });

    // 6) 마무리
    await set(() => { hideGui = true; __BC.runCmd('/gamemode creative'); const F = __T.fr; __cam(F.x + 12, F.y + 6, F.z + 12, F.x + 1.5, F.y + 2, F.z) });
    await skip(1);
    await rec.card(`<h1>블록<b>크래프트</b></h1><ul><li>시간의 방: 석영 틀 + 시계 · 시간 10배 · 신전 · 수련 효과</li><li>시간 수정 · 그림자 분신 · 모래시계 (시간 정지)</li><li>시련의 회당: 응회암 · 구리 블록 · 시련 생성기 · 시련 열쇠 · 금고</li><li>새 몹: 브리즈 · 보그드 · 새 아이템: 돌풍구 · 철퇴 · 무거운 핵</li></ul><div class="s">/timechamber · /locate trial_chambers 로 가 보세요!</div>`, 5.4);
    await rec.shoot(5.6, t => { const F = __T.fr, k = t / 5.6; __cam(F.x + 12 - k * 2, F.y + 6, F.z + 12 + k, F.x + 1.5, F.y + 2, F.z) });
  },
};
