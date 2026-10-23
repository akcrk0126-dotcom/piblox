// 로켓 카트 서버: 웹페이지 + 실시간 레이스 (판정은 전부 서버)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { Room, TRACKS, MAX_CARS } = require('./game.js');
const RK = require('../shared/rk.js');

const PORT = process.env.PORT || 8080;
const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const MAX_CONN_PER_IP = 6;
const THREE_DIR = path.dirname(path.dirname(require.resolve('three')));

// ── 기록판 (서버만 씀) ──
const lb = {
  file: path.join(DATA, 'leaderboard.json'), d: {},
  load() { try { this.d = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (e) { this.d = {}; } },
  save() { try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.d)); } catch (e) {} },
  add(track, name, time, best) {
    const t = this.d[track] || (this.d[track] = { race: [], lap: [] });
    const put = (arr, v) => {
      if (!v || v < 5) return;
      const i = arr.findIndex(e => e.n === name);
      if (i >= 0) { if (arr[i].v <= v) return; arr.splice(i, 1); }
      arr.push({ n: name, v }); arr.sort((a, b) => a.v - b.v); arr.length = Math.min(arr.length, 10);
    };
    put(t.race, time); put(t.lap, best); this.save();
  },
  get(track) { return this.d[track] || { race: [], lap: [] }; }
};
lb.load();

// ── 파일 ──
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u === '/health') { res.writeHead(200); return res.end('ok'); }
  if (u === '/') u = '/index.html';
  let file;
  const safe = path.normalize(u).replace(/^(\.\.[/\\])+/, '');
  if (u === '/room.js') file = path.join(ROOT, 'server', 'game.js');
  else if (u.startsWith('/shared/')) file = path.join(ROOT, 'shared', path.basename(u));
  else if (u.startsWith('/vendor/three/')) file = path.join(THREE_DIR, safe.slice('/vendor/three/'.length));
  else file = path.join(ROOT, 'public', safe);
  if (![path.join(ROOT, 'public'), path.join(ROOT, 'shared'), path.join(ROOT, 'server'), path.join(THREE_DIR, 'build'), path.join(THREE_DIR, 'examples', 'jsm')].some(d => file.startsWith(d + path.sep))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('없는 페이지예요'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': path.extname(file) === '.html' ? 'no-cache' : file.startsWith(THREE_DIR) ? 'public, max-age=604800, immutable' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(buf);
  });
});

// ── 방 ──
const rooms = new Map();
function makeCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c; do { c = ''; for (let i = 0; i < 5; i++) c += A[Math.random() * A.length | 0]; } while (rooms.has(c)); return c; }
function quickRoom() {
  for (const r of rooms.values()) if (!r.priv && r.state === 'lobby' && r.humans() < MAX_CARS) return r;
  const code = makeCode(); const r = new Room(code, false, Math.random() * TRACKS.length | 0, lb); rooms.set(code, r); return r;
}

const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12) || ('레이서' + (Math.random() * 900 + 100 | 0));

// ── 실시간 연결 ──
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048, perMessageDeflate: false });
const perIp = new Map();
wss.on('connection', (ws, req) => {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const n = (perIp.get(ip) || 0) + 1;
  if (n > MAX_CONN_PER_IP) { ws.close(1008, 'too many'); return; }
  perIp.set(ip, n);
  const conn = { sendRaw: s => { if (ws.readyState === 1 && ws.bufferedAmount < 1 << 20) ws.send(s); } };
  let room = null, me = null, bad = 0, msgs = 0, win = Date.now();

  ws.on('message', raw => {
    const now = Date.now();
    if (now - win > 1000) { win = now; msgs = 0; }
    if (++msgs > 150) { if (++bad > 20) ws.close(1008, 'flood'); return; }   // 초당 150개 넘으면 무시
    let m; try { m = JSON.parse(raw); } catch (e) { if (++bad > 20) ws.close(1008, 'bad'); return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'i') { if (me && room) room.pushInputs(me, m.l); return; }
    if (m.t === 'join' && !room) {
      const name = cleanName(m.name);
      if (m.mode === 'create') { const code = makeCode(); room = new Room(code, true, m.track | 0, lb); rooms.set(code, room); }
      else if (m.mode === 'code') {
        room = rooms.get(String(m.code || '').toUpperCase().slice(0, 5));
        if (!room) { conn.sendRaw(JSON.stringify({ t: 'err', msg: '그런 방이 없어요' })); return; }
      } else room = quickRoom();
      me = room.addHuman(conn, name, m.kart);
      if (!me) { conn.sendRaw(JSON.stringify({ t: 'err', msg: '방이 꽉 찼어요' })); room = null; return; }
      conn.sendRaw(JSON.stringify({ t: 'hi', id: me.id, code: room.code }));
      room.sendRoom();
      return;
    }
    if (!room || !me) return;
    if (m.t === 'start' && room.priv && room.hostId === me.id && room.state === 'lobby') room.startCountdown();
    else if (m.t === 'track' && room.priv && room.hostId === me.id) room.setTrack(m.v);
    else if (m.t === 'bots' && room.priv && room.hostId === me.id) room.setBots(m.v);
    else if (m.t === 'leave') { room.remove(me.id); room = null; me = null; }
    else if (m.t === 'ping') conn.sendRaw(JSON.stringify({ t: 'pong', c: m.c, k: room.tick }));
  });
  ws.on('close', () => {
    perIp.set(ip, (perIp.get(ip) || 1) - 1); if (perIp.get(ip) <= 0) perIp.delete(ip);
    if (room && me) {
      if (room.state === 'race') { me.conn = null; me.name += ' (나감)'; }   // 레이스 중에는 봇이 대신 달려요
      else room.remove(me.id);
    }
  });
});

// ── 게임 시계 (초당 60틱) ──
let acc = 0, lastT = process.hrtime.bigint();
setInterval(() => {
  const now = process.hrtime.bigint();
  acc += Number(now - lastT) / 1e9; lastT = now;
  if (acc > 0.25) acc = 0.25;
  while (acc >= RK.DT) {
    acc -= RK.DT;
    for (const [code, r] of rooms) {
      if (r.humans() === 0) { rooms.delete(code); continue; }
      r.step();
    }
  }
}, 4);

server.listen(PORT, () => console.log('로켓 카트 서버 켜짐 :' + PORT));
