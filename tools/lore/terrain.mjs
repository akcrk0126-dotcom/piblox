// 지형 조회 도구 — 좌표가 땅 위인지 · 평평한지 · 어느 지역인지 확인해요 (lore 콘텐츠 작성용)
//   node tools/lore/terrain.mjs at x,z [x,z ...]        각 점의 높이 · 경사 · 물 · 지역 · 가까운 랜드마크/사냥터/길
//   node tools/lore/terrain.mjs flat x,z r [n]           (x,z) 반경 r 안에서 평평하고 마른 땅 n 곳 찾기
//   node tools/lore/terrain.mjs check lore/<file>.js     lore 파일의 모든 좌표 검사 (물 · 급경사 · 지역 밖 · 겹침)
// 무거운 브라우저 없이 agora-world.js 의 지형 계산만 node 에서 돌려요 (처음 3~5초).
import { createRequire } from 'module';
const HARNESS = process.env.HARNESS || new URL('./harness.mjs', import.meta.url).href;
const log = console.log; console.log = () => {};
await import(HARNESS);
console.log = log;
const { F } = globalThis.__h; const W = F.WORLD;
import fs from 'fs';
// 랜드마크 건물 · 소품 충돌체 (브라우저에서 뽑아 둔 것): ['c', x, z, r] | ['b', x, z, hw, hd, ry]
const COLS = JSON.parse(fs.readFileSync(new URL('./lmcolliders.json', import.meta.url), 'utf8'));
const colD = (x, z) => { let best = 1e9; for (const c of COLS){ if (Math.abs(c[1] - x) > 30 || Math.abs(c[2] - z) > 30) continue; let d;
  if (c[0] === 'c') d = Math.hypot(x - c[1], z - c[2]) - c[3]; else { const cs = Math.cos(c[5]), sn = Math.sin(c[5]), dx = x - c[1], dz = z - c[2], lx = Math.abs(dx * cs - dz * sn) - c[3], lz = Math.abs(dx * sn + dz * cs) - c[4]; d = Math.hypot(Math.max(lx, 0), Math.max(lz, 0)) + Math.min(Math.max(lx, lz), 0); }
  if (d < best) best = d; } return best; };
const [cmd, ...args] = process.argv.slice(2);
const P = s => s.split(',').map(Number);
const near = (list, x, z) => { let b = null, bd = 1e9; for (const o of list){ const d = Math.hypot(o.c[0] - x, o.c[1] - z); if (d < bd){ bd = d; b = o; } } return b ? `${b.id}(${b.name || ''}) ${bd.toFixed(0)}m` : '-'; };
const info = (x, z) => { const h = F.H(x, z), sl = F.slope(x, z), w = F.isWater(x, z), r = F.regionAt(x, z);
  return { x, z, h: +h.toFixed(1), slope: +sl.toFixed(2), water: w, depth: +F.waterDepth(x, z).toFixed(1), region: r && r.id, biome: F.biomeAt(x, z), road: +F.roadDist(x, z).toFixed(0), building: +Math.min(99, colD(x, z)).toFixed(1),
    landmark: near(W.landmarks, x, z), camp: near(W.camps, x, z), npc: near(W.npcs, x, z), settlement: W.settlements ? near(W.settlements, x, z) : '-' }; };
// 평평함: 반경 rad 안 높이 차
const flatness = (x, z, rad) => { let lo = 1e9, hi = -1e9; for (let a = 0; a < 8; a++) for (const k of [0.5, 1]){ const h = F.H(x + Math.cos(a * 0.785) * rad * k, z + Math.sin(a * 0.785) * rad * k); lo = Math.min(lo, h); hi = Math.max(hi, h); } return hi - lo; };
if (cmd === 'at'){ for (const a of args){ const [x, z] = P(a); log(JSON.stringify(info(x, z))); } }
else if (cmd === 'flat'){ const [cx, cz] = P(args[0]), R = +args[1] || 30, n = +args[2] || 8, out = [];
  for (let r = 0; r <= R; r += 3) for (let a = 0; a < 24; a++){ const x = Math.round(cx + Math.cos(a / 24 * 6.283) * r), z = Math.round(cz + Math.sin(a / 24 * 6.283) * r);
    if (F.isWater(x, z) || F.slope(x, z) > 0.25 || colD(x, z) < 2.5) continue; const fl = flatness(x, z, 3); if (fl > 0.8) continue; if (out.some(o => Math.hypot(o.x - x, o.z - z) < 5)) continue; out.push({ x, z, flat: +fl.toFixed(2), h: +F.H(x, z).toFixed(1), road: +F.roadDist(x, z).toFixed(0) }); if (out.length >= n) break; }
  for (const o of out.slice(0, n)) log(JSON.stringify(o)); if (!out.length) log('평평한 곳 없음'); }
else if (cmd === 'check'){ const path = new URL('file://' + (args[0].startsWith('/') ? args[0] : process.cwd() + '/' + args[0])).href;
  const L = (await import(path)).default; const bad = [], pts = [];
  const reg = L.region; const add = (what, c, rad = 1.5, allowWater = false) => { if (!c) return; const [x, z] = c, i = info(x, z); pts.push({ what, x, z, rad });
    if (i.water && !allowWater) bad.push(`💧 물 위: ${what} [${x}, ${z}] depth ${i.depth}`);
    if (i.slope > 0.45) bad.push(`⛰ 급경사 ${i.slope}: ${what} [${x}, ${z}]`);
    if (i.building < rad) bad.push(`🧱 건물/소품과 겹침 (${i.building}m): ${what} [${x}, ${z}]`);
    if (reg !== 'village' && i.region !== reg) bad.push(`🗺 다른 지역(${i.region}): ${what} [${x}, ${z}]`); };
  const s = L.settlement; if (s){ if (s.c) add('settlement ' + s.id, s.c, 0); for (const r of s.residents || []){ add('resident ' + r.id, r.c, 1); if (s.c && !r.away && Math.hypot(r.c[0] - s.c[0], r.c[1] - s.c[1]) > s.r) bad.push(`🏠 정착지 밖 주민 (밖이 맞으면 away: true): ${r.id}`); } }
  for (const r of L.readables || []) add('readable ' + r.id, r.c, 1);
  for (const sp of L.setpieces || []) add('setpiece ' + sp.id + ' (' + sp.kind + ')', sp.c, 2.5, ['sunken_boat', 'dock', 'drowned_house', 'nets', 'dark_spring', 'lantern_post', 'offering'].includes(sp.kind));
  if (L.keystone) add('keystone ' + L.keystone.id, L.keystone.c, 2);
  for (const b of L.bosses || []) add('boss ' + b.id, b.c, 3);
  for (const q of L.quests || []) for (const o of q.o || []) if (o.t === 'reach') add(`quest ${q.id} reach`, o.c, 2);
  // 서로 너무 가까운 것 (3m 안)
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++){ const a = pts[i], b = pts[j]; if (Math.hypot(a.x - b.x, a.z - b.z) < 2.5 && !a.what.startsWith('settlement') && !b.what.startsWith('settlement')) bad.push(`↔ 겹침: ${a.what} · ${b.what}`); }
  // 기존 NPC · 룬 비석 · 낚시터와 겹침
  for (const p of pts){ if (p.what.startsWith('settlement')) continue; for (const n of W.npcs) if (Math.hypot(n.c[0] - p.x, n.c[1] - p.z) < 3) bad.push(`↔ NPC ${n.id} 와 겹침: ${p.what}`); for (const w of W.waypoints) if (Math.hypot(w.c[0] - p.x, w.c[1] - p.z) < 6) bad.push(`↔ 룬 비석 ${w.id} 와 겹침: ${p.what}`); }
  // 참조 검사: 퀘스트가 가리키는 것들이 실제로 있는지
  const ALL = []; for (const id of ['village', 'greenhill', 'woods', 'lake', 'swamp', 'canyon', 'plateau', 'blight', 'frost']){ try { ALL.push((await import(new URL('../../lore/' + id + '.js', import.meta.url).href)).default); } catch (e){} }
  if (!ALL.some(x => x.region === L.region)) ALL.push(L);
  const npcIds = new Set(W.npcs.map(n => n.id)); for (const x of ALL) for (const r of (x.settlement && x.settlement.residents) || []) npcIds.add(r.id);
  const rdIds = new Set(), spIds = new Map(), ksIds = new Set(), sbIds = new Set(), qIds = new Map();
  for (const x of ALL){ for (const r of x.readables || []) rdIds.add(r.id); for (const sp of x.setpieces || []) spIds.set(sp.id, sp); if (x.keystone) ksIds.add(x.keystone.id); for (const b of x.bosses || []) sbIds.add(b.id); for (const q of x.quests || []){ if (qIds.has(q.id) && qIds.get(q.id) !== x.region) bad.push(`🆔 퀘스트 id 겹침: ${q.id} (${qIds.get(q.id)} · ${x.region})`); qIds.set(q.id, x.region); } }
  const MONK = new Set(['slime', 'shroom', 'bee', 'boar', 'sprout', 'golem', 'squirrel', 'frog', 'ladybug', 'snail', 'flower', 'raccoon', 'mole', 'owl', 'hedgehog', 'wolf', 'frostgolem', 'yeti', 'wraith', '*']);
  const BOSSK = new Set(['kingSlime', 'chief', 'queen', 'tusk', 'treant']);
  for (const b of L.bosses || []) if (!MONK.has(b.key) && !BOSSK.has(b.key)) bad.push(`👹 모르는 보스 key: ${b.id} → ${b.key}`);
  const ITEMS = new Set(['hp1', 'hp2', 'hp3', 'hp4', 'mp1', 'mp2', 'mp3', 'mp4', 'herb', 'mushroom', 'ore', 'crystal', 'stone', 'sseed']);
  const npcOk = (id, w) => { if (!npcIds.has(id)) bad.push(`👤 없는 NPC '${id}': ${w}`); };
  for (const r of (L.settlement && L.settlement.residents) || []) if (W.npcs.some(n => n.id === r.id)) bad.push(`👤 주민 id 가 기존 NPC 와 겹침: ${r.id}`);
  for (const q of L.quests || []){ const w = `퀘스트 ${q.id}`; if (!['main', 'side'].includes(q.kind)) bad.push(`❓ ${w} kind`); npcOk(q.giver, w + ' giver'); if (q.to) npcOk(q.to, w + ' to');
    for (const [who] of [...(q.intro || []), ...(q.end || []), ...(q.mid ? [q.mid] : [])]) npcOk(who, w + ' 대사 화자');
    for (const it of (q.rw && q.rw.items) || []) if (!ITEMS.has(it[0])) bad.push(`🎁 ${w} 모르는 아이템 ${it[0]}`);
    if (q.rw && q.rw.title && !(L.titles && L.titles[q.rw.title]) && !['rookie', 'grom', 'thornbreaker', 'hero', 'frost', 'raider'].includes(q.rw.title)) bad.push(`🎖 ${w} 칭호 '${q.rw.title}' 가 titles 에 없음`);
    for (const o of q.o || []){ const ow = `${w} 목표 ${o.t}`;
      if (o.t === 'talk'){ npcOk(o.npc, ow); for (const [who] of o.say || []) npcOk(who, ow + ' 대사 화자'); }
      else if (o.t === 'kill'){ if (!MONK.has(o.key)) bad.push(`🐾 ${ow} 모르는 몬스터 ${o.key}`); if (o.at){ const c = W.camps.find(c => c.id === o.at); if (!c) bad.push(`🏕 ${ow} 없는 사냥터 ${o.at}`); else if (!c.mobs.some(m => m[0] === o.key)) bad.push(`🏕 ${ow} 사냥터 ${o.at} 에 ${o.key} 가 없음 (${c.mobs.map(m => m[0])})`); } }
      else if (o.t === 'discover'){ if (!W.landmarks.some(l => l.id === o.id)) bad.push(`🗺 ${ow} 없는 랜드마크 ${o.id}`); }
      else if (o.t === 'read'){ if (!rdIds.has(o.id)) bad.push(`📜 ${ow} 없는 읽을거리 ${o.id}`); }
      else if (o.t === 'collect'){ const ids = Array.isArray(o.id) ? o.id : [o.id]; for (const id of ids){ const sp = spIds.get(id); if (!sp) bad.push(`✋ ${ow} 없는 셋피스 ${id}`); else if (!sp.pickup) bad.push(`✋ ${ow} ${id} 에 pickup: true 가 없음`); } if ((o.n || 1) > ids.length) bad.push(`✋ ${ow} n(${o.n}) > id 수`); }
      else if (o.t === 'cleanse'){ if (!ksIds.has(o.id)) bad.push(`💠 ${ow} 없는 수호석 ${o.id}`); }
      else if (o.t === 'sboss'){ if (!sbIds.has(o.id)) bad.push(`👹 ${ow} 없는 이야기 보스 ${o.id}`); }
      else if (o.t === 'raid'){ if (!W.raids.some(r => r.id === o.id)) bad.push(`⚔ ${ow} 없는 레이드 ${o.id}`); }
      else if (o.t === 'gather'){ if (!['herb', 'mushroom', 'ore', 'crystal'].includes(o.item)) bad.push(`🌿 ${ow} 모르는 재료 ${o.item}`); }
      else if (!['fish', 'glider', 'reach', 'fboss', 'level'].includes(o.t)) bad.push(`❓ ${ow} 모르는 목표 종류`); } }
  // 메인 사슬: 장 첫 퀘스트의 giver = 앞 장 마지막 메인의 to
  const prevL = ALL.filter(x => x.chapter.n === L.chapter.n - 1)[0], mm = (L.quests || []).filter(q => q.kind === 'main');
  if (prevL && mm.length){ const pm = (prevL.quests || []).filter(q => q.kind === 'main'), last = pm[pm.length - 1]; if (last && (last.to || last.giver) !== mm[0].giver) bad.push(`🔗 첫 메인 ${mm[0].id} giver '${mm[0].giver}' ≠ 앞 장 마지막 ${last.id} 의 to '${last.to || last.giver}'`); }
  log(`${args[0]}: 좌표 ${pts.length}개 · 퀘스트 ${(L.quests || []).length}개 검사`); log(bad.length ? bad.join('\n') : '✔ 문제 없음'); }
else log('사용법: at x,z … | flat x,z r [n] | check lore/<file>.js');
process.exit(0);
