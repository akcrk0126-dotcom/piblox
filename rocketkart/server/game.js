// 레이스 방: 모든 판정은 여기(서버)에서만 해요. 플레이어는 입력만 보낼 수 있어요.
'use strict';
(function (root) {
const RK = typeof module !== 'undefined' && module.exports ? require('../shared/rk.js') : root.RK;
const { DT, C, stepCar, newCar, clamp, mod, wrapA, curvAt, widthAt } = RK;

const TRACKS = RK.TRACKS.map(RK.buildTrack);
const MAX_CARS = 8;
const FILL_CARS = 6;               // 사람이 모자라면 봇으로 이만큼까지만 채워요
const COLORS = RK.PALETTE.slice(0, 8);
const BOT_NAMES = ['블레이즈', '코멧', '노바', '터보', '제트', '스파크', '오비트', '네뷸라', '퀘이사', '플럭스', '볼트', '레이'];
const SNAP_EVERY = 3;              // 60틱 중 3틱마다 = 초당 20번
const LOBBY_T = 12, COUNT_T = 4, DONE_T = 12, FINISH_WAIT = 25;

const r2 = v => Math.round(v * 100) / 100;
const r4 = v => Math.round(v * 10000) / 10000;

let nextId = 1;

class Room {
  constructor(code, priv, trackIdx, lb) {
    this.code = code; this.priv = priv; this.lb = lb;
    this.bots = !priv;            // 방을 만들면 기본은 봇 없이 우리끼리 (방장이 켤 수 있어요)
    this.track = trackIdx % TRACKS.length; this.T = TRACKS[this.track];
    this.players = new Map();
    this.state = 'lobby'; this.timer = priv ? 90 : LOBBY_T; this.tick = 0;
    this.proj = []; this.boxes = []; this.events = []; this.raceT = 0; this.firstFin = 0;
    this.hostId = 0; this.projId = 1; this.results = null;
  }
  humans() { let n = 0; for (const p of this.players.values()) if (!p.bot && p.conn) n++; return n; }

  addHuman(conn, name, kart) {
    if (this.players.size >= MAX_CARS && !this.dropBot()) return null;
    const p = this.mkPlayer(name, false, kart);
    p.conn = conn;
    if (!this.hostId) this.hostId = p.id;
    if (this.state === 'race' || this.state === 'count') { p.spect = true; }
    this.players.set(p.id, p);
    this.sendRoom();
    return p;
  }
  dropBot() {
    if (this.state !== 'lobby') return false;
    for (const [id, p] of this.players) if (p.bot) { this.players.delete(id); return true; }
    return false;
  }
  mkPlayer(name, bot, kart) {
    const used = new Set([...this.players.values()].map(p => p.color));
    let color = COLORS.find(c => !used.has(c)) || COLORS[0];
    // 사람은 꾸민 색, 봇은 남는 색으로 아무렇게나 꾸며요
    if (bot) kart = RK.randKart(RK.PALETTE.indexOf(color)); else { kart = RK.cleanKart(kart); color = RK.PALETTE[kart.c]; }
    return {
      id: nextId++, name, bot, color, kart, conn: null, car: newCar(0, 0), mag: 0, ghost: 0, mega: 0,
      q: [], last: { s: 0, a: 0, b: 0, d: 0, i: 0 }, ack: 0, lastSeq: 0,
      item: 0, uses: 0, roul: 0, ib: 0, shield: 0, lapMax: 0, lapStart: 0, best: 0,
      fin: 0, finT: 0, place: 1, spect: false, gasAt: -1, nitro: 0, nb: 0, draft: 0, near: new Map(), combo: 0,
      ai: bot ? { lane: (Math.random() - 0.5) * 0.6, skill: 0.92 + Math.random() * 0.07, hold: 0, dr: 0 } : null
    };
  }
  remove(id) {
    this.players.delete(id);
    if (this.hostId === id) { this.hostId = 0; for (const p of this.players.values()) if (!p.bot) { this.hostId = p.id; break; } }
    this.sendRoom();
  }

  setBots(v) { if (this.state === 'lobby') { this.bots = !!v; this.sendRoom(); } }
  setTrack(i) { if (this.state === 'lobby') { this.track = mod(i | 0, TRACKS.length); this.T = TRACKS[this.track]; this.sendRoom(); } }

  startCountdown() {
    // 봇 채우기
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    while (this.bots && this.players.size < FILL_CARS) { const b = this.mkPlayer(names.pop() || 'BOT', true); this.players.set(b.id, b); }
    const list = [...this.players.values()].sort(() => Math.random() - 0.5);
    list.sort((a, b) => (a.bot - b.bot));          // 사람은 뒤쪽 출발 대신 섞어서
    list.forEach((p, i) => {
      const row = Math.floor(i / 2), side = i % 2 ? 1 : -1;
      p.car = newCar(-8 - row * 9, side * 3.2);
      if (p.bot) p.car.mx = p.ai.skill;
      Object.assign(p, { q: [], item: 0, uses: 0, roul: 0, ib: 0, shield: 0, lapMax: 0, best: 0, fin: 0, finT: 0, spect: false, gasAt: -1, nitro: 0, nb: 0, draft: 0, near: new Map(), mag: 0, ghost: 0, mega: 0 });
      p.last = { s: 0, a: 0, b: 0, d: 0, i: 0, n: 0 };
    });
    this.boxes = this.T.boxes.map(() => 0);
    this.proj = []; this.state = 'count'; this.timer = COUNT_T; this.raceT = 0; this.firstFin = 0; this.results = null;
    this.sendRoom();
  }

  // ── 매 틱 ──
  step() {
    this.tick++;
    if (this.state === 'lobby') {
      if (this.humans() > 0) this.timer -= DT;
      if (this.timer <= 0) this.startCountdown();
    } else if (this.state === 'count') {
      this.timer -= DT;
      for (const p of this.players.values()) {
        if (p.bot) continue;
        while (p.q.length) { const i = p.q.shift(); p.ack = i.q; if (i.a && p.gasAt < 0) p.gasAt = this.timer; if (!i.a) p.gasAt = -1; p.last = i; }
      }
      if (this.timer <= 0) {
        this.state = 'race'; this.raceT = 0;
        for (const p of this.players.values()) {
          if (p.bot) { if (Math.random() < 0.5) p.car.boost = 1.0; }
          else if (p.gasAt >= 0 && p.gasAt < 0.7) { p.car.boost = 1.2; this.ev('start', p.id); }
          p.lapStart = 0;
        }
        this.sendRoom();
      }
    } else if (this.state === 'race') {
      this.raceT += DT;
      this.stepRace();
      if (this.firstFin && this.raceT - this.firstFin > FINISH_WAIT) this.finish();
      else if ([...this.players.values()].every(p => p.fin || p.bot || !p.conn) && this.humans() > 0) this.finish();
    } else if (this.state === 'done') {
      this.timer -= DT;
      this.stepRace();
      if (this.timer <= 0) {
        this.state = 'lobby'; this.timer = this.priv ? 90 : LOBBY_T;
        for (const [id, p] of this.players) if (p.bot || !p.conn) this.players.delete(id);
        if (!this.priv) this.setTrack(this.track + 1);
        this.sendRoom();
      }
    }
    if (this.tick % SNAP_EVERY === 0 && this.state !== 'lobby') this.snapshot();
  }

  stepRace() {
    const T = this.T, L = T.L;
    const list = [...this.players.values()];
    this.rubber(list);
    for (const p of list) {
      let inp;
      if (p.bot || p.fin || !p.conn) inp = this.botInput(p);
      else {
        // 1틱에 입력 1개만 써요 (속도 핵 방지). 밀린 입력은 버려요
        if (p.q.length > 8) p.q.splice(0, p.q.length - 8);
        inp = p.q.shift();
        if (inp) { p.last = inp; p.ack = inp.q; } else inp = p.last;
      }
      const c = p.car, wasAir = c.h > 0, fb = c.boost, wasDr = c.dr, dcB = c.dc, trB = c.tr, wasFall = c.fall, wasSc = c.sc;
      stepCar(c, inp, T, DT);
      if (c.sc && !wasSc) this.ev('cut', p.id);
      // 니트로 게이지: 드리프트 · 공중 묘기 · 슬립스트림 · 아슬아슬하게 피하기로 채워요
      if (wasDr && !c.dr && c.boost > fb) { const tier = dcB >= RK.TIER[3] ? 3 : dcB >= RK.TIER[2] ? 2 : 1; this.addNitro(p, [0, 10, 18, 28][tier]); if (tier === 3) this.ev('perfect', p.id); }
      if (wasAir && c.h === 0 && trB === 1) { this.addNitro(p, 15); this.ev('trick', p.id); }
      if (c.off && !wasFall) { c.off = 0; this.ev('falloff', p.id); }
      if (inp.n && !p.nb && p.nitro >= 100 && !c.fall) { p.nitro = 0; c.boost = Math.max(c.boost, 2.8); c.spin = 0; this.ev('nitro', p.id); this.shockwave(p); }
      p.nb = inp.n ? 1 : 0;
      if (c.wall && Math.abs(c.v) > 25) this.ev('wall', p.id);
      if (wasAir && c.h === 0) this.ev('land', p.id);
      // 아이템 버튼
      if (inp.i && !p.ib) this.useItem(p);
      p.ib = inp.i ? 1 : 0;
      if (p.shield > 0) p.shield = Math.max(0, p.shield - DT);
      if (c.mxT > 0) { c.mxT -= DT; c.mx = Math.min(c.mx, 0.8); if (c.mxT <= 0) c.mx = p.bot ? p.ai.skill : 1; }
      if (p.roul > 0) { p.roul -= DT; if (p.roul <= 0) { p.roul = 0; this.rollItem(p); } }
      if (p.ghost > 0) p.ghost = Math.max(0, p.ghost - DT);
      if (p.mega > 0) { p.mega = Math.max(0, p.mega - DT); if (!c.fall) c.boost = Math.max(c.boost, 0.05); }
      if (p.mag > 0) {
        // 자석: 바로 앞 차에 끌려가요
        p.mag = Math.max(0, p.mag - DT);
        let tgt = null, best = 95;
        for (const o of list) { if (o === p || o.car.fall || o.car.sc) continue; let dp = o.car.p - c.p; dp -= Math.round(dp / L) * L; if (dp > 5 && dp < best) { best = dp; tgt = o; } }
        if (tgt && !c.sc && !c.fall) { c.boost = Math.max(c.boost, 0.25); c.lat += clamp(tgt.car.lat - c.lat, -9 * DT, 9 * DT); }
      }
      // 바퀴
      const lap = Math.floor(c.p / L);
      if (lap > p.lapMax) {
        p.lapMax = lap;
        const lt = this.raceT - p.lapStart; p.lapStart = this.raceT;
        if (!p.best || lt < p.best) p.best = lt;
        if (lap >= C.LAPS && !p.fin) {
          p.fin = 1; p.finT = this.raceT; if (!this.firstFin) this.firstFin = this.raceT;
          this.ev('fin', p.id);
        } else this.ev('lap', p.id, lap + 1);
      }
    }
    this.collide(list);
    this.drafting(list);
    this.hazards(list);
    this.stepProj(list);
    this.stepBoxes(list);
    // 순위
    list.sort((a, b) => (b.fin - a.fin) || (a.fin ? a.finT - b.finT : b.car.p - a.car.p));
    list.forEach((p, i) => p.place = i + 1);
    this.order = list;
  }

  // 고무줄: 봇이 사람과 너무 멀어지지 않게 (앞서면 살짝 느려지고, 뒤처지면 빨라져요)
  rubber(list) {
    const hum = list.filter(p => !p.bot && p.conn && !p.fin && !p.spect);
    if (!hum.length) return;
    for (const p of list) {
      if (!p.bot || p.car.mxT > 0) continue;
      let best = Infinity;
      for (const h of hum) { const d = p.car.p - h.car.p; if (Math.abs(d) < Math.abs(best)) best = d; }
      const k = clamp(best / 150, -1, 1);
      p.car.mx = p.ai.skill * (k > 0 ? 1 - k * 0.24 : 1 - k * 0.14);
    }
  }

  addNitro(p, n) { const was = p.nitro; p.nitro = Math.min(100, p.nitro + n); if (was < 100 && p.nitro >= 100) this.ev('nitrofull', p.id); }

  // 니트로 폭발: 가까운 차를 옆으로 밀어내요
  shockwave(p) {
    const L = this.T.L, c = p.car;
    for (const o of this.players.values()) {
      if (o === p || o.car.fall) continue;
      let dp = o.car.p - c.p; dp -= Math.round(dp / L) * L;
      const dl = o.car.lat - c.lat;
      if (Math.abs(dp) < 9 && Math.abs(dl) < 6) { o.car.lat += Math.sign(dl || 1) * 3.5; o.car.v *= 0.8; this.ev('bump', o.id); }
    }
  }

  // 슬립스트림(바로 뒤에 붙어 달리면 공기 저항이 줄어 부스트) · 아슬아슬하게 추월
  drafting(list) {
    const L = this.T.L;
    for (const p of list) {
      const c = p.car; if (c.fall || c.v < 30) { p.draft = Math.max(0, p.draft - DT); continue; }
      let behind = false;
      for (const o of list) {
        if (o === p || o.car.fall) continue;
        let dp = o.car.p - c.p; dp -= Math.round(dp / L) * L;
        const dl = Math.abs(o.car.lat - c.lat);
        if (dp > 3.5 && dp < 16 && dl < 2.2) behind = true;
        // 아슬아슬: 옆으로 1.9~3.4 거리에서 상대를 앞질렀을 때
        const prev = p.near.get(o.id);
        if (prev !== undefined && prev > 0 && dp <= 0 && dl > 1.9 && dl < 3.4 && c.v - o.car.v > 4) { this.addNitro(p, 8); this.ev('near', p.id); }
        if (Math.abs(dp) < 30) p.near.set(o.id, dp); else p.near.delete(o.id);
      }
      if (behind) { p.draft += DT; if (p.draft > 1.1) { p.draft = -1.5; c.boost = Math.max(c.boost, 0.9); this.addNitro(p, 12); this.ev('draft', p.id); } }
      else if (p.draft > 0) p.draft = Math.max(0, p.draft - DT * 2); else if (p.draft < 0) p.draft = Math.min(0, p.draft + DT);
    }
  }

  // 함정 (구르는 바위 · 레이저 문 · 운석)
  hazards(list) {
    const T = this.T, L = T.L; if (!T.hazards.length) return;
    const o = this._hz || (this._hz = {});
    for (let k = 0; k < T.hazards.length; k++) {
      RK.hazardState(T, k, this.raceT, o);
      if (!o.on) continue;
      for (const p of list) {
        const c = p.car; if (c.fall || c.spin > 0 || c.sc) continue;
        let dp = c.p - o.s; dp -= Math.round(dp / L) * L;
        if (o.k === 'laser') { if (Math.abs(dp) < 1.2 && c.h < 1.6) this.hit(p, 0.9, 0.5, 'laser'); }
        else if (o.k === 'roll') { if (Math.abs(dp) < 2.6 && Math.abs(c.lat - o.lat) < o.r + 0.9 && c.h < 2) this.hit(p, 1.1, 0.35, 'rock'); }
        else if (o.k === 'meteor') { if (Math.hypot(dp, c.lat - o.lat) < o.r && c.h < 3) { this.hit(p, 1.3, 0.3, 'meteor'); c.vh = 9; c.h = 0.01; } }
      }
      if (o.k === 'meteor' && o.ph < 0.85 + DT / T.hazards[k].b) this.ev('meteor', k);
    }
  }

  collide(list) {
    const L = this.T.L;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i].car, b = list[j].car;
      if (a.fall || b.fall || Math.abs(a.h - b.h) > 1.5 || list[i].ghost > 0 || list[j].ghost > 0 || a.sc || b.sc) continue;
      let dp = b.p - a.p; dp = dp - Math.round(dp / L) * L;
      const dl = b.lat - a.lat;
      if (Math.abs(dp) < 3.2 && Math.abs(dl) < 2.1) {
        const push = (2.1 - Math.abs(dl)) / 2 * (dl >= 0 ? 1 : -1);
        a.lat -= push; b.lat += push;
        if (Math.abs(dp) < 2.4) {
          const back = dp > 0 ? a : b, front = dp > 0 ? b : a;
          if (back.v > front.v) { const m = (back.v + front.v) / 2; back.v = m - 1; front.v = m + 1; }
        }
        if (Math.abs(a.v - b.v) > 6 || Math.abs(dl) < 1.2) this.ev('bump', list[i].id);
        // 거대화한 차에 부딪히면 튕겨 나가요
        if (list[i].mega > 0 && !(list[j].mega > 0)) this.hit(list[j], 0.8, 0.6); else if (list[j].mega > 0 && !(list[i].mega > 0)) this.hit(list[i], 0.8, 0.6);
      }
    }
  }

  stepBoxes(list) {
    const T = this.T, L = T.L;
    this.boxes.forEach((t, k) => { if (t > 0) this.boxes[k] = Math.max(0, t - DT); });
    for (const p of list) {
      if (p.item || p.roul || p.car.h > 2 || p.car.fall) continue;
      const s = mod(p.car.p, L);
      for (let k = 0; k < T.boxes.length; k++) {
        if (this.boxes[k] > 0) continue;
        const b = T.boxes[k];
        let d = s - b.s; d -= Math.round(d / L) * L;
        if (Math.abs(d) < 2.2 && Math.abs(p.car.lat - b.lat) < 2.0) {
          this.boxes[k] = 2.5; p.roul = 1.1; this.ev('box', p.id, k); break;
        }
      }
    }
  }

  rollItem(p) {
    const n = this.players.size, f = n > 1 ? (p.place - 1) / (n - 1) : 0;
    // 1부스트 2미사일 3지뢰 4실드 5EMP 6트리플 7번개 8저격로켓 9기름 10자석 11유령 12거대화 13블랙홀 14먹물
    const W = f < 0.25 ? [22, 8, 22, 20, 0, 0, 0, 0, 20, 0, 4, 0, 4, 0]
      : f < 0.7 ? [16, 20, 10, 8, 3, 10, 1, 4, 8, 8, 6, 4, 6, 6]
      : [8, 14, 2, 3, 10, 16, 8, 9, 2, 10, 6, 12, 4, 8];
    let r = Math.random() * W.reduce((a, b) => a + b, 0), k = 0;
    while (r >= W[k]) { r -= W[k]; k++; }
    p.item = k + 1; p.uses = p.item === 6 ? 3 : 1;
  }

  useItem(p) {
    if (!p.item || p.car.fall) return;
    const c = p.car, it = p.item;
    if (--p.uses <= 0) { p.item = 0; p.uses = 0; }
    if (it === 1 || it === 6) { c.boost = Math.max(c.boost, it === 1 ? 1.6 : 1.1); this.ev('boost', p.id); }
    else if (it === 4) { p.shield = 10; this.ev('shield', p.id); }
    else if (it === 3) { this.proj.push({ id: this.projId++, k: 3, p: c.p - 3.5, lat: c.lat, h: 0, v: 0, own: p.id, t: 0, life: 45 }); this.ev('drop', p.id); }
    else if (it === 2) {
      const tgt = (this.order || []).find(o => o.place === p.place - 1);
      this.proj.push({ id: this.projId++, k: 2, p: c.p + 3, lat: c.lat, h: 0.6, v: Math.max(78, c.v + 25), own: p.id, tgt: tgt ? tgt.id : 0, t: 0, life: 9 });
      this.ev('fire', p.id);
    } else if (it === 5) {
      for (const o of this.players.values()) if (o.place < p.place && !o.fin) this.hit(o, 1.0, 0.45);
      this.ev('emp', p.id);
    } else if (it === 7) {
      for (const o of this.players.values()) if (o !== p && !o.fin) { this.hit(o, 0.8, 0.55); o.car.mxT = 4; }
      this.ev('zap', p.id);
    } else if (it === 8) {
      const lead = (this.order || []).find(o => o.place === 1 && o !== p && !o.fin);
      this.proj.push({ id: this.projId++, k: 8, p: c.p + 3, lat: c.lat, h: 3, v: Math.max(110, c.v + 40), own: p.id, tgt: lead ? lead.id : 0, t: 0, life: 14 });
      this.ev('fire', p.id);
    }
    else if (it === 9) { this.proj.push({ id: this.projId++, k: 9, p: c.p - 4, lat: c.lat, h: 0, v: 0, own: p.id, t: 0, life: 35 }); this.ev('drop', p.id); }
    else if (it === 10) { p.mag = 3.2; this.ev('magnet', p.id); }
    else if (it === 11) {
      // 유령: 4초 동안 안 맞고, 앞쪽 누군가의 아이템을 훔쳐요
      p.ghost = 4;
      const vs = [...this.players.values()].filter(o => o !== p && o.item && !o.fin).sort((a, b) => a.place - b.place);
      const v = vs[0];
      if (v) { p.item = v.item; p.uses = v.uses; v.item = 0; v.uses = 0; this.ev('ghost', p.id, v.id); } else this.ev('ghost', p.id, 0);
    }
    else if (it === 12) { p.mega = 6; this.ev('mega', p.id); }
    else if (it === 13) { this.proj.push({ id: this.projId++, k: 13, p: c.p + 45, lat: clamp(c.lat, -3, 3), h: 0, v: 0, own: p.id, t: 0, life: 10, hits: [] }); this.ev('hole', p.id); }
    else if (it === 14) {
      const ids = [];
      for (const o of this.players.values()) if (o.place < p.place && !o.fin && !(o.ghost > 0)) { ids.push(o.id); o.car.mxT = Math.max(o.car.mxT || 0, 1.5); }
      this.ev('ink', p.id, ...ids);
    }
    if (this.proj.length > 40) this.proj.splice(0, this.proj.length - 40);
  }

  hit(o, spin, keep, why) {
    if (o.ghost > 0 || o.mega > 0) return;
    if (o.shield > 0) { o.shield = 0; this.ev('pop', o.id); return; }
    if (why) this.ev('hz', o.id, why);
    const c = o.car; c.spin = spin || 1.3; c.v *= keep == null ? 0.3 : keep; c.dr = 0; c.dc = 0; c.boost = 0;
    this.ev('hit', o.id);
  }

  stepProj(list) {
    const L = this.T.L;
    for (const pr of this.proj) {
      pr.t += DT;
      if (pr.k === 2 || pr.k === 8) {
        const tg = pr.tgt && this.players.get(pr.tgt);
        if (tg) {
          let dp = tg.car.p - pr.p; dp -= Math.round(dp / L) * L;
          if (dp < 25) pr.lat += clamp(tg.car.lat - pr.lat, -24 * DT, 24 * DT);
          if (pr.k === 8) pr.h = dp < 20 ? Math.max(0.6, pr.h - DT * 8) : 3;
          if (dp < -5) pr.tgt = 0;
        }
        pr.p += pr.v * DT;
        const half = widthAt(this.T, pr.p) / 2 - 0.8; pr.lat = clamp(pr.lat, -half, half);
      }
      if (pr.k === 13) {
        // 블랙홀: 가까운 차를 빨아들이고, 가운데에 닿으면 빙글
        for (const o of list) {
          const c = o.car; if (c.fall || c.sc || o.ghost > 0 || (o.id === pr.own && pr.t < 1.5)) continue;
          let dp = c.p - pr.p; dp -= Math.round(dp / L) * L;
          if (Math.abs(dp) < 16 && Math.abs(c.lat - pr.lat) < 9) { c.lat += clamp(pr.lat - c.lat, -7 * DT, 7 * DT); c.v *= 1 - 0.6 * DT; }
          if (Math.abs(dp) < 2.6 && Math.abs(c.lat - pr.lat) < 2.6 && !pr.hits.includes(o.id)) { pr.hits.push(o.id); this.hit(o, 1.2, 0.4); }
        }
        continue;
      }
      for (const o of list) {
        if (o.car.fall || o.car.h > 2.5 || o.ghost > 0) continue;
        if (o.id === pr.own && pr.t < (pr.k === 3 || pr.k === 9 ? 1.2 : 0.5)) continue;
        if (pr.k === 9) {
          let dp = o.car.p - pr.p; dp -= Math.round(dp / L) * L;
          if (Math.abs(dp) < 2.4 && Math.abs(o.car.lat - pr.lat) < 2.6) { this.hit(o, 0.9, 0.65); pr.life = 0; this.ev('slip', o.id); break; }
          continue;
        }
        if (pr.k === 8 && pr.tgt && o.id !== pr.tgt) continue;
        let dp = o.car.p - pr.p; dp -= Math.round(dp / L) * L;
        if (Math.abs(dp) < (pr.k === 2 ? 2.6 : 1.9) && Math.abs(o.car.lat - pr.lat) < 1.8) {
          this.hit(o); pr.life = 0; this.ev('boom', pr.k, r2(pr.p), r2(pr.lat)); break;
        }
      }
    }
    this.proj = this.proj.filter(pr => pr.t < pr.life);
  }

  // ── 봇 ──
  botInput(p) {
    const ai = p.ai || (p.ai = { lane: 0, skill: 1, hold: 0, dr: 0 });
    const MT = this.T, K = p.car.sc && MT.cuts[p.car.sc - 1];
    // 지름길 위에서는 지름길 좌표로 운전해요
    const c = K ? Object.assign({}, p.car, { p: p.car.sp, lat: p.car.sl }) : p.car, T = K ? K.T : MT;
    const v = Math.max(8, c.v), look = 10 + v * 0.45;
    // 앞쪽 휘어짐
    let kmax = 0, kav = 0;
    for (let d = 6; d <= 70; d += 8) { const k = curvAt(T, c.p + d); if (Math.abs(k) > Math.abs(kmax)) kmax = k; if (d <= look + 10) kav += k; }
    kav /= Math.max(1, Math.floor((look + 10) / 8));
    const half = widthAt(T, c.p) / 2 - 2;
    let tl = clamp(-Math.sign(kav) * Math.min(1, Math.abs(kav) * 45) * 0.6 + ai.lane, -0.85, 0.85) * half;
    // 지름길 앞: 정해 둔 봇은 갈라지는 차선으로 붙어요
    let cutting = false;
    if (!K && MT.cuts) for (let k = 0; k < MT.cuts.length; k++) {
      const Q = MT.cuts[k], d = mod(Q.s0 - c.p, MT.L);
      if (d < 70) { if (ai.cutLap !== Math.floor(c.p / MT.L) * 10 + k) { ai.cutLap = Math.floor(c.p / MT.L) * 10 + k; ai.cut = Math.random() < 0.35 + ai.skill * 0.2; } if (ai.cut) { tl = Q.side * Q.o0; cutting = true; } }
    }
    // 앞 차 · 지뢰 피하기
    const L = T.L;
    if (!K) for (const pr of this.proj) if (pr.k === 3) {
      let dp = pr.p - c.p; dp -= Math.round(dp / L) * L;
      if (dp > 0 && dp < 35 && Math.abs(pr.lat - tl) < 2.5) tl = pr.lat + (pr.lat > 0 ? -3.5 : 3.5);
    }
    const desired = Math.atan2(tl - c.lat, look);
    const turn = C.TURN_LO + (C.TURN_HI - C.TURN_LO) * clamp(v / C.MAXV, 0, 1);
    const ff = curvAt(T, c.p + 4) * v / turn * (c.dr ? 1 : 0.45);
    let s = clamp(ff + wrapA(desired - c.yaw) * 2.6, -1, 1);
    const vsafe = 1.55 / Math.max(0.004, Math.abs(kmax)) * (ai.skill + 0.05);
    let a = 1, b = 0, d = 0;
    if (c.v > vsafe + 6) { a = 0; b = c.v > vsafe + 14 ? 1 : 0; }
    // 드리프트
    if (ai.dr) { d = 1; if (Math.abs(kav) < 0.006 || c.dr === 0 && ai.dr > 1) ai.dr = 0; else ai.dr++; s = clamp(s, -1, 1); }
    else if (Math.abs(kav) > 0.016 && c.v > 30 && Math.abs(s) > 0.4) { ai.dr = 1; d = 1; }
    if (c.dr && Math.sign(kav) !== c.dr) d = 0;
    if (cutting) { d = 0; ai.dr = 0; }
    // 거꾸로 가면 돌기
    if (Math.abs(c.yaw) > 1.6) { s = -Math.sign(c.yaw); a = 1; d = 0; }
    // 아이템
    let i = 0;
    if (p.item) {
      ai.hold += DT;
      if (ai.hold > 1.2 + Math.random() * 3) {
        const it = p.item;
        if (it === 3) { const bh = (this.order || []).find(o => o.place === p.place + 1); if (!bh || ai.hold > 6 || mod(c.p - bh.car.p, L) < 40) i = 1; }
        else i = 1;
        if (i) ai.hold = 0;
      }
    }
    if (p.ib) i = 0;
    const n = p.nitro >= 100 && Math.abs(kmax) < 0.01 && !p.nb ? 1 : 0;
    return { s, a, b, d, i, n };
  }

  ev(...e) { this.events.push(e); }

  finish() {
    this.state = 'done'; this.timer = DONE_T;
    const list = this.order || [...this.players.values()];
    this.results = list.map(p => ({ id: p.id, name: p.name, bot: p.bot, color: p.color, place: p.place, time: p.fin ? r2(p.finT) : 0, best: r2(p.best) }));
    for (const r of this.results) if (!r.bot) this.lb.add(this.T.id, r.name, r.time, r.best);
    this.broadcast({ t: 'res', list: this.results, lb: this.lb.get(this.T.id) });
    this.sendRoom();
  }

  // ── 보내기 ──
  snapshot() {
    const cars = [];
    for (const p of this.players.values()) {
      if (p.spect) continue;
      const c = p.car;
      const tier = c.dr ? (c.dc >= RK.TIER[3] ? 3 : c.dc >= RK.TIER[2] ? 2 : c.dc >= RK.TIER[1] ? 1 : 0) : 0;
      cars.push([p.id, r2(c.p), r2(c.lat), r2(c.h), r2(c.v), r4(c.yaw), c.dr, tier, r2(c.boost), r2(c.spin), p.shield > 0 ? 1 : 0, r2(c.fall), p.place, p.fin, Math.min(C.LAPS, p.lapMax + 1), c.sc, r2(c.sp), r2(c.sl), (p.mega > 0 ? 1 : 0) | (p.ghost > 0 ? 2 : 0) | (p.mag > 0 ? 4 : 0)]);
    }
    const proj = this.proj.map(pr => [pr.id, pr.k, r2(pr.p), r2(pr.lat), pr.h]);
    const boxes = this.boxes.map(t => t > 0 ? 0 : 1).join('');
    const ev = this.events; this.events = [];
    const base = { t: 's', k: this.tick, st: this.state, tm: r2(this.state === 'race' ? this.raceT : this.timer), c: cars, pr: proj, bx: boxes, ev };
    const baseStr = JSON.stringify(base).slice(0, -1);
    for (const p of this.players.values()) {
      if (p.bot || !p.conn) continue;
      const c = p.car;
      const me = { a: p.ack, i: p.item, u: p.uses, r: p.roul > 0 ? 1 : 0, b: r2(p.best), f: p.fin, ft: r2(p.finT), n: Math.round(p.nitro), df: p.draft > 0 ? r2(p.draft) : 0,
        s: [r4(c.p), r4(c.lat), r4(c.h), r4(c.vh), r4(c.v), r4(c.yaw), c.dr, r4(c.dc), c.pd, c.dl, c.tr, r4(c.boost), r4(c.spin), r4(c.fall), r4(c.ma), c.sc, r4(c.sp), r4(c.sl), r4(c.pe)] };
      p.conn.sendRaw(baseStr + ',"me":' + JSON.stringify(me) + '}');
    }
  }
  sendRoom() {
    const players = [...this.players.values()].map(p => ({ id: p.id, name: p.name, bot: p.bot, color: p.color, kart: p.kart, spect: p.spect }));
    this.broadcast({ t: 'room', code: this.priv ? this.code : '', priv: this.priv, track: this.track, st: this.state, tm: r2(this.timer), host: this.hostId, players, bots: this.bots ? 1 : 0, laps: C.LAPS, lb: this.lb.get(this.T.id) });
  }
  broadcast(m) { const s = JSON.stringify(m); for (const p of this.players.values()) if (p.conn) p.conn.sendRaw(s); }

  // 플레이어 입력 받기 (검사 후 줄 세우기)
  pushInputs(p, list) {
    if (!Array.isArray(list)) return;
    for (const e of list.slice(0, 12)) {
      if (!Array.isArray(e) || e.length < 6) continue;
      const q = e[0] | 0; if (q <= p.lastSeq) continue;
      p.lastSeq = q;
      const s = Number(e[1]);
      p.q.push({ q, s: Number.isFinite(s) ? clamp(Math.round(s * 100) / 100, -1, 1) : 0, a: e[2] ? 1 : 0, b: e[3] ? 1 : 0, d: e[4] ? 1 : 0, i: e[5] ? 1 : 0, n: e[6] ? 1 : 0 });
    }
    if (p.q.length > 20) p.q.splice(0, p.q.length - 20);
  }
}

const API = { Room, TRACKS, MAX_CARS };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.RKGame = API;
})(typeof self !== 'undefined' ? self : this);
