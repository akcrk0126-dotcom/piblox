// 로켓 카트 공용 코드: 트랙 만들기 + 차 물리 (서버와 브라우저가 똑같이 씀)
(function (root) {
  'use strict';

  const DT = 1 / 60;
  const C = {
    MAXV: 60, ACC: 30, BRAKE: 48, REVMAX: 14, DRAG: 8,
    TURN_LO: 2.2, TURN_HI: 1.3, BOOSTV: 1.4, BOOSTA: 55,
    GRAV: 34, JUMPV: 13, LAPS: 3, CAR_R: 1.1
  };
  const TIER = [0, 0.8, 1.6, 2.6];          // 드리프트 충전 단계
  const TIER_T = [0, 0.7, 1.2, 1.8];        // 단계별 부스트 시간

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const mod = (a, n) => ((a % n) + n) % n;
  const smooth = t => t * t * (3 - 2 * t);

  // ── 트랙 정의 ─────────────────────────────────────────────
  // pts: [x, y, z, 폭, 기울기(도), 다음 점까지 회전 바퀴수]
  // 위치 f: 한 바퀴 중 비율 (0~1)
  const TRACKS = [
    {
      id: 'neon', name: '네온 시티', theme: 'city', sky: [0x05061a, 0x2a0b4a],
      pts: [
        [0, 0, 0, 20], [0, 0, -140, 20], [18, 2, -250, 20], [90, 6, -315, 20], [190, 12, -305, 20],
        [250, 16, -240, 18, 0, 1], [250, 16, -140, 18], [205, 12, -85, 18], [150, 6, -60, 18],
        [130, 0, 10, 20], [175, -4, 85, 20], [255, 0, 120, 20], [300, 10, 200, 20],
        [265, 18, 285, 20], [165, 20, 305, 20], [65, 12, 262, 20], [12, 4, 182, 20], [0, 0, 90, 20]
      ],
      boost: [[0.07, 0], [0.33, -4], [0.33, 4], [0.62, 0], [0.86, -5]],
      jumps: [[0.465, 18]],
      items: [0.17, 0.5, 0.75, 0.93]
    },
    {
      id: 'ring', name: '토성 링 웨이', theme: 'space', sky: [0x000005, 0x0b1440],
      pts: [
        [0, 0, 0, 22], [0, 10, -160, 22], [60, 30, -270, 22], [180, 46, -300, 22], [290, 40, -230, 20],
        [320, 22, -120, 20, 0, -1], [300, 0, 0, 20], [330, -16, 110, 22], [270, -30, 220, 22],
        [150, -36, 250, 22], [60, -24, 200, 20], [80, -10, 110, 20], [180, 0, 60, 20],
        [190, 6, -40, 20], [110, 10, -110, 20], [40, 15, -60, 20], [-40, 13, 60, 22], [-30, 6, 150, 22],
        [-60, 0, 250, 22], [-140, 4, 250, 22], [-150, 2, 120, 22], [-60, 0, 80, 22]
      ],
      boost: [[0.04, 0], [0.24, 0], [0.42, -5], [0.42, 5], [0.7, 0], [0.9, 0]],
      jumps: [[0.585, 20]],
      items: [0.13, 0.36, 0.55, 0.8]
    },
    {
      id: 'lava', name: '용암 협곡', theme: 'lava', sky: [0x1a0402, 0x5a1a08],
      pts: [
        [0, 0, 0, 18], [0, 2, -120, 18], [-40, 6, -200, 17], [-130, 10, -220, 16], [-190, 8, -160, 16],
        [-150, 4, -90, 16], [-200, 2, -20, 16], [-260, 6, 50, 17], [-210, 12, 130, 17], [-120, 18, 120, 17],
        [-80, 20, 40, 16, 0, 1], [-20, 20, -20, 16], [70, 14, -40, 17], [150, 8, 10, 17], [140, 4, 110, 18],
        [80, 2, 180, 18], [0, 0, 190, 18], [-30, 0, 120, 18], [0, 0, 60, 18]
      ],
      boost: [[0.05, 0], [0.3, 0], [0.55, -4], [0.55, 4], [0.84, 0]],
      jumps: [[0.73, 16]],
      items: [0.15, 0.42, 0.66, 0.92],
      hazards: [['meteor', 0.35, 60, 4.5], ['meteor', 0.62, 50, 5.5]]
    },
    {
      id: 'jungle', name: '정글 폭포 유적', theme: 'jungle', sky: [0x0b2a1a, 0x7fd0a8],
      pts: [
        [0, 0, 0, 18], [0, 0, -130, 18], [-30, -4, -230, 17], [-110, -10, -280, 16], [-200, -14, -250, 16], [-240, -20, -160, 16],
        [-200, -34, -70, 18], [-120, -40, -40, 18], [-40, -36, -70, 17], [40, -30, -120, 16], [120, -22, -100, 16], [160, -14, -20, 17],
        [130, -6, 70, 17], [60, -2, 110, 18], [0, 0, 90, 18]
      ],
      boost: [[0.06, 0], [0.24, -4], [0.24, 4], [0.5, 0], [0.71, 0], [0.9, -3]],
      jumps: [[0.43, 20]],
      items: [0.14, 0.36, 0.6, 0.82],
      hazards: [['roll', 0.3, 1.3], ['roll', 0.66, 1.7], ['roll', 0.88, 1.1]]
    },
    {
      id: 'ice', name: '빙하 크레바스', theme: 'ice', sky: [0x0a1a3a, 0x9fd8ff], grip: 0.55,
      pts: [
        [0, 0, 0, 22], [0, 2, -150, 22], [50, 6, -250, 22], [160, 10, -280, 20], [260, 6, -220, 20], [280, 0, -100, 20], [220, -6, -20, 22],
        [120, -8, 10, 22], [60, -4, 90, 20], [100, 4, 180, 20], [200, 10, 200, 20], [250, 6, 290, 20], [160, 0, 350, 22], [40, -2, 320, 22],
        [-30, 0, 220, 22], [-20, 0, 110, 22]
      ],
      boost: [[0.05, 0], [0.2, 0], [0.4, -5], [0.4, 5], [0.62, 0], [0.88, 0]],
      jumps: [[0.27, 18], [0.71, 22]],
      items: [0.12, 0.34, 0.55, 0.8],
      hazards: [['meteor', 0.48, 50, 4], ['meteor', 0.92, 40, 5]]
    },
    {
      id: 'cyber', name: '사이버 하이퍼튜브', theme: 'cyber', sky: [0x02020a, 0x14063a],
      pts: [
        [0, 0, 0, 20], [0, 0, -180, 20], [0, 8, -320, 18, 0, 1], [0, 16, -460, 18], [60, 20, -560, 18], [180, 22, -580, 18], [280, 18, -520, 18],
        [300, 10, -400, 18, 0, -1], [300, 4, -260, 18], [260, 0, -150, 20], [180, -6, -90, 20], [120, -12, -20, 20], [140, -16, 80, 20],
        [90, -12, 170, 20], [0, -6, 180, 20], [-50, -2, 90, 20]
      ],
      boost: [[0.04, 0], [0.13, -4], [0.13, 4], [0.36, 0], [0.47, 0], [0.62, -4], [0.62, 4], [0.84, 0]],
      jumps: [[0.73, 16]],
      items: [0.09, 0.3, 0.55, 0.78],
      hazards: [['laser', 0.2, 2.4, 1.0], ['laser', 0.52, 2.0, 0.9], ['laser', 0.88, 2.8, 1.2], ['roll', 0.4, 2.2]]
    },
    {
      id: 'desert', name: '사막 메가 점프', theme: 'desert', sky: [0x5a3a1a, 0xffd59a],
      pts: [
        [0, 0, 0, 24], [0, 0, -200, 24], [40, 6, -330, 24], [150, 14, -380, 22], [280, 10, -340, 22], [340, 0, -230, 22], [330, -6, -100, 24],
        [260, -8, 0, 24], [300, -4, 120, 22], [250, 4, 230, 22], [130, 8, 260, 22], [20, 4, 220, 24], [-20, 0, 120, 24]
      ],
      boost: [[0.04, 0], [0.1, 0], [0.34, -6], [0.34, 6], [0.44, 0], [0.66, 0], [0.76, 0]],
      jumps: [[0.12, 24], [0.46, 28], [0.78, 22]],
      items: [0.2, 0.38, 0.6, 0.9],
      hazards: [['roll', 0.28, 1.0], ['roll', 0.56, 1.4], ['meteor', 0.68, 60, 6]]
    },
    {
      id: 'rainbow', name: '레인보우 은하', theme: 'rainbow', sky: [0x02000a, 0x1a0a40], nowall: true,
      pts: [
        [0, 0, 0, 16], [0, 10, -140, 16], [50, 26, -240, 15], [150, 34, -260, 15, 0, 1], [240, 30, -200, 15], [260, 16, -90, 16], [200, 0, -20, 16],
        [110, -12, -40, 15], [40, -20, 40, 15], [70, -26, 140, 15], [170, -20, 190, 16], [230, -8, 280, 16], [150, 0, 350, 16], [40, 6, 320, 16],
        [-20, 4, 200, 16], [-20, 0, 100, 16]
      ],
      boost: [[0.05, 0], [0.18, 0], [0.32, 0], [0.5, -3], [0.5, 3], [0.68, 0], [0.86, 0]],
      jumps: [[0.6, 18]],
      items: [0.11, 0.42, 0.63, 0.92],
      hazards: [['meteor', 0.25, 50, 4], ['meteor', 0.75, 50, 4.5], ['laser', 0.45, 3, 1]]
    }
  ];

  // ── 함정: 서버와 화면이 같은 시간(t)으로 똑같이 계산해요 ──
  const hh = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
  // 돌아오는 값: { k, s, lat, r(반지름), on(맞으면 다침), warn(경고 0~1) }
  function hazardState(T, idx, t, o) {
    const hz = T.hazards[idx]; o = o || {};
    o.k = hz.k; o.s = hz.s; o.on = false; o.warn = 0; o.lat = 0; o.r = 0;
    const half = widthAt(T, hz.s) / 2;
    if (hz.k === 'roll') { o.lat = Math.sin(t * hz.a + idx * 1.7) * (half - 2.6); o.r = 2.4; o.on = true; }
    else if (hz.k === 'laser') { const ph = mod(t + idx * 0.37, hz.a); o.on = ph < hz.b; o.warn = o.on ? 1 : Math.max(0, (ph - (hz.a - 0.7)) / 0.7); o.r = half + 1; }
    else if (hz.k === 'meteor') {
      const cyc = Math.floor(t / hz.b), ph = (t - cyc * hz.b) / hz.b;
      o.s = hz.s + (hh(cyc, idx * 7 + 1) - 0.5) * hz.a; o.lat = (hh(cyc, idx * 7 + 3) - 0.5) * (widthAt(T, o.s) - 6);
      o.warn = ph > 0.45 && ph < 0.85 ? (ph - 0.45) / 0.4 : 0; o.on = ph >= 0.85 && ph < 0.9; o.ph = ph; o.r = 4.5;
    }
    return o;
  }

  function cr(a, b, c, d, t) {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  }

  function buildTrack(def) {
    const P = def.pts, n = P.length, SUB = 32;
    const dense = [];
    for (let i = 0; i < n; i++) {
      const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n], d = P[(i + 2) % n];
      for (let k = 0; k < SUB; k++) {
        const t = k / SUB, st = smooth(t);
        dense.push({
          x: cr(a[0], b[0], c[0], d[0], t), y: cr(a[1], b[1], c[1], d[1], t), z: cr(a[2], b[2], c[2], d[2], t),
          w: b[3] + (c[3] - b[3]) * st,
          roll: ((b[4] || 0) + ((c[4] || 0) - (b[4] || 0)) * st + (b[5] || 0) * 360 * st) * Math.PI / 180
        });
      }
    }
    // 길이 재기
    const m = dense.length, cum = new Float64Array(m + 1);
    for (let i = 0; i < m; i++) {
      const a = dense[i], b = dense[(i + 1) % m];
      cum[i + 1] = cum[i] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    }
    const L0 = cum[m], N = Math.round(L0), ds = L0 / N;
    const T = {
      def, id: def.id, name: def.name, N, ds, L: L0,
      px: new Float64Array(N), py: new Float64Array(N), pz: new Float64Array(N),
      tx: new Float64Array(N), ty: new Float64Array(N), tz: new Float64Array(N),
      ux: new Float64Array(N), uy: new Float64Array(N), uz: new Float64Array(N),
      rx: new Float64Array(N), ry: new Float64Array(N), rz: new Float64Array(N),
      w: new Float64Array(N), k: new Float64Array(N), roll: new Float64Array(N)
    };
    let j = 0;
    for (let i = 0; i < N; i++) {
      const s = i * ds;
      while (cum[j + 1] < s) j++;
      const f = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
      const a = dense[j], b = dense[(j + 1) % m];
      T.px[i] = a.x + (b.x - a.x) * f; T.py[i] = a.y + (b.y - a.y) * f; T.pz[i] = a.z + (b.z - a.z) * f;
      T.w[i] = a.w + (b.w - a.w) * f;
      let dr = b.roll - a.roll; if (Math.abs(dr) > Math.PI) dr = 0;   // 바퀴 경계
      T.roll[i] = a.roll + dr * f;
    }
    // 방향 · 휘어짐
    const th = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const a = (i - 1 + N) % N, b = (i + 1) % N;
      let x = T.px[b] - T.px[a], y = T.py[b] - T.py[a], z = T.pz[b] - T.pz[a];
      const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
      T.tx[i] = x; T.ty[i] = y; T.tz[i] = z;
      th[i] = Math.atan2(x, -z);
    }
    const kr = new Float64Array(N);
    for (let i = 0; i < N; i++) kr[i] = wrapA(th[(i + 1) % N] - th[(i - 1 + N) % N]) / (2 * ds);
    const W = 9;
    for (let i = 0; i < N; i++) { let s = 0; for (let o = -W; o <= W; o++) s += kr[mod(i + o, N)]; T.k[i] = s / (2 * W + 1); }
    // 위 · 오른쪽 벡터 (커브에서 저절로 기울어짐)
    for (let i = 0; i < N; i++) {
      const tx = T.tx[i], ty = T.ty[i], tz = T.tz[i];
      let ux = -ty * tx, uy = 1 - ty * ty, uz = -ty * tz;
      const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
      let rx = ty * uz - tz * uy, ry = tz * ux - tx * uz, rz = tx * uy - ty * ux;
      const bank = clamp(Math.atan(T.k[i] * 900 / 9.8), -0.55, 0.55) + T.roll[i];
      const cb = Math.cos(bank), sb = Math.sin(bank);
      T.ux[i] = ux * cb + rx * sb; T.uy[i] = uy * cb + ry * sb; T.uz[i] = uz * cb + rz * sb;
      T.rx[i] = rx * cb - ux * sb; T.ry[i] = ry * cb - uy * sb; T.rz[i] = rz * cb - uz * sb;
    }
    // 부스트 판 · 점프대 · 아이템 상자
    const L = T.L;
    T.boost = def.boost.map(([f, lat]) => ({ s: f * L, lat, len: 9, wd: 5 }));
    T.jumps = def.jumps.map(([f, gap]) => ({ s: f * L, len: 5, gs: f * L + 12, ge: f * L + 12 + gap }));
    T.hazards = (def.hazards || []).map(([k, f, a, b]) => ({ k, s: f * L, a, b }));
    T.grip = def.grip || 1; T.nowall = !!def.nowall;
    T.boxes = [];
    def.items.forEach(f => {
      const s = f * L, hw = T.w[Math.floor(s / ds) % N] / 2 - 3;
      [-1, -0.5, 0, 0.5, 1].forEach(o => T.boxes.push({ s, lat: o * hw }));
    });
    return T;
  }

  // 트랙 위의 점: s(거리), lat(옆), h(높이) → 월드 좌표와 방향
  function frame(T, s, o) {
    s = mod(s, T.L);
    const fi = s / T.ds, i = Math.floor(fi) % T.N, j = (i + 1) % T.N, f = fi - Math.floor(fi);
    const L = (a) => a[i] + (a[j] - a[i]) * f;
    o.px = L(T.px); o.py = L(T.py); o.pz = L(T.pz);
    o.tx = L(T.tx); o.ty = L(T.ty); o.tz = L(T.tz);
    o.ux = L(T.ux); o.uy = L(T.uy); o.uz = L(T.uz);
    o.rx = L(T.rx); o.ry = L(T.ry); o.rz = L(T.rz);
    o.w = L(T.w); o.k = L(T.k);
    return o;
  }
  const _f = {};
  function widthAt(T, s) { return T.w[Math.floor(mod(s, T.L) / T.ds) % T.N]; }
  function curvAt(T, s) { return T.k[Math.floor(mod(s, T.L) / T.ds) % T.N]; }

  // ── 차 ──────────────────────────────────────────────────
  function newCar(p, lat) {
    return { p, lat, h: 0, vh: 0, v: 0, yaw: 0, dr: 0, dc: 0, pd: 0, dl: 0, tr: 0, boost: 0, spin: 0, fall: 0, ma: 0, wall: 0, mx: 1, off: 0 };
  }
  const STATE_KEYS = ['p', 'lat', 'h', 'vh', 'v', 'yaw', 'dr', 'dc', 'pd', 'dl', 'tr', 'boost', 'spin', 'fall', 'ma'];
  function copyCar(a, b) { for (const k of STATE_KEYS) b[k] = a[k]; return b; }

  // inp: { s: 조향 -1~1, a: 가속, b: 브레이크, d: 드리프트 }
  function stepCar(c, inp, T, dt) {
    dt = dt || DT;
    const L = T.L;
    c.wall = 0;
    if (c.fall > 0) { c.fall -= dt; if (c.fall <= 0) { c.fall = 0; } return; }
    if (c.spin > 0) c.spin = Math.max(0, c.spin - dt);
    if (c.boost > 0) c.boost = Math.max(0, c.boost - dt);
    const spin = c.spin > 0, air = c.h > 0 || c.vh > 0;
    const steer = clamp(+inp.s || 0, -1, 1), gas = !!inp.a, brk = !!inp.b, dbtn = !!inp.d;
    const maxv = C.MAXV * c.mx * (c.boost > 0 ? C.BOOSTV : 1);

    // 속도
    if (spin) c.v *= Math.exp(-2.6 * dt);
    else if (c.boost > 0) c.v = Math.min(maxv, c.v + C.BOOSTA * dt);
    else if (brk) c.v = c.v > 0 ? Math.max(0, c.v - C.BRAKE * dt) : Math.max(-C.REVMAX, c.v - 14 * dt);
    else if (gas) { if (c.v < maxv) c.v = Math.min(maxv, c.v + C.ACC * (1 - Math.max(0, c.v) / maxv * 0.85) * dt); }
    else c.v = c.v > 0 ? Math.max(0, c.v - C.DRAG * dt) : Math.min(0, c.v + C.DRAG * dt);
    if (c.v > maxv) c.v = Math.max(maxv, c.v - 18 * dt);

    // 조향 · 드리프트
    const sp = Math.abs(c.v);
    const turn = C.TURN_LO + (C.TURN_HI - C.TURN_LO) * clamp(sp / C.MAXV, 0, 1);
    let yr;
    if (!dbtn) c.dl = 0;
    if (c.dr !== 0) {
      const s2 = steer * c.dr;
      yr = c.dr * turn * (0.72 + 0.5 * s2) * 1.12;
      c.dc += dt * (1 + 0.8 * Math.max(0, s2));
      if (!dbtn || c.v < 12 || spin) {
        const tier = c.dc >= TIER[3] ? 3 : c.dc >= TIER[2] ? 2 : c.dc >= TIER[1] ? 1 : 0;
        if (tier && !spin) c.boost = Math.max(c.boost, TIER_T[tier]);
        c.dr = 0; c.dc = 0; c.dl = dbtn ? 1 : 0;
      }
    } else {
      yr = steer * turn * Math.min(1, sp / 10) * (air ? 0.5 : 1) * (c.v < 0 ? -1 : 1);
      if (dbtn && !c.dl && !air && !spin && Math.abs(steer) > 0.35 && c.v > 15) { c.dr = steer > 0 ? 1 : -1; c.dc = 0; }
    }
    // 공중 묘기 (드리프트 버튼)
    if (air && dbtn && !c.pd && c.tr === 0) c.tr = 1;
    c.pd = dbtn ? 1 : 0;
    if (spin) yr = 0;

    c.yaw = wrapA(c.yaw + yr * dt);
    // 미끄러운 길(얼음): 차가 보는 방향과 실제로 가는 방향이 늦게 맞춰져요
    let mv = c.yaw - c.dr * 0.3;
    if (T.grip < 1) { c.ma = wrapA(c.ma + wrapA(mv - c.ma) * Math.min(1, dt * 16 * T.grip * T.grip)); mv = c.ma; } else c.ma = mv;
    const dsx = c.v * Math.cos(mv) * dt, dlat = c.v * Math.sin(mv) * dt;
    c.yaw = wrapA(c.yaw - curvAt(T, c.p) * dsx);
    c.p += dsx; c.lat += dlat;
    c.yaw = wrapA(c.yaw), c.ma = wrapA(c.ma - curvAt(T, c.p) * dsx * (T.grip < 1 ? 1 : 0));

    // 벽 없는 길(레인보우): 끝 밖으로 나가면 떨어져요
    if (T.nowall) {
      if (Math.abs(c.lat) > widthAt(T, c.p) / 2 + 0.4 && c.h < 0.5) {
        c.fall = 1.4; c.off = 1; c.p -= 4; c.lat = 0; c.v = 16; c.yaw = 0; c.ma = 0; c.dr = 0; c.dc = 0; c.boost = 0; c.h = 0; c.vh = 0;
        return;
      }
    } else
    {
    const half = widthAt(T, c.p) / 2 - C.CAR_R;
    if (Math.abs(c.lat) > half) {
      const sg = Math.sign(c.lat);
      c.lat = sg * half;
      if (Math.sin(c.yaw) * sg > 0) {
        c.yaw = Math.atan2(-Math.sin(c.yaw) * 0.25, Math.cos(c.yaw));
        c.v *= 0.86; c.wall = 1;
      }
    }
    }

    // 공중 · 착지
    const s = mod(c.p, L);
    if (air) {
      c.vh -= C.GRAV * dt; c.h += c.vh * dt;
      if (c.h <= 0) {
        c.h = 0; c.vh = 0;
        if (c.tr === 1) c.boost = Math.max(c.boost, 0.9);
        c.tr = 0;
      }
    } else {
      for (const j of T.jumps) {
        const d = mod(s - j.s, L);
        if (d < j.len && c.v > 5) { c.vh = C.JUMPV; c.h = 0.001; c.dr = 0; c.dc = 0; break; }
        if (d >= j.gs - j.s && d < j.ge - j.s) {   // 구멍에 빠짐
          c.fall = 1.0; c.p += (j.ge - j.s) - d + 2; c.v = 12; c.yaw = 0; c.lat *= 0.5; c.dr = 0; c.dc = 0; c.boost = 0;
          return;
        }
      }
      for (const b of T.boost) {
        if (mod(s - b.s, L) < b.len && Math.abs(c.lat - b.lat) < b.wd / 2 + 0.6) { c.boost = Math.max(c.boost, 1.1); break; }
      }
    }
  }

  // 차 → 월드 위치 · 방향
  function carPose(T, c, o) {
    const f = frame(T, c.p, _f);
    const hov = 0.55 + c.h;
    o.x = f.px + f.rx * c.lat + f.ux * hov;
    o.y = f.py + f.ry * c.lat + f.uy * hov;
    o.z = f.pz + f.rz * c.lat + f.uz * hov;
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    o.fx = f.tx * cy + f.rx * sy; o.fy = f.ty * cy + f.ry * sy; o.fz = f.tz * cy + f.rz * sy;
    o.ux = f.ux; o.uy = f.uy; o.uz = f.uz;
    return o;
  }

  // ── 아이템 ───────────────────────────────────────────────
  const ITEMS = [null,
    { id: 1, name: '로켓 부스트', icon: '🚀' },
    { id: 2, name: '유도 미사일', icon: '🎯' },
    { id: 3, name: '지뢰', icon: '💣' },
    { id: 4, name: '실드', icon: '🛡️' },
    { id: 5, name: 'EMP 쇼크', icon: '⚡' },
    { id: 6, name: '트리플 부스트', icon: '🔥' },
    { id: 7, name: '번개', icon: '🌩️' },
    { id: 8, name: '1등 저격 로켓', icon: '☄️' }
  ];

  const RK = { DT, C, TIER, TIER_T, TRACKS, ITEMS, STATE_KEYS, buildTrack, frame, widthAt, curvAt, newCar, copyCar, stepCar, carPose, hazardState, clamp, wrapA, mod };
  if (typeof module !== 'undefined' && module.exports) module.exports = RK; else root.RK = RK;
})(typeof self !== 'undefined' ? self : this);
