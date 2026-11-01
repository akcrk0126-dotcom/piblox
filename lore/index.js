// 아르카디아 연대기 — 지역별 이야기 데이터 모음 (형식: docs/agora-story-bible.md §6, 지침: docs/agora-lore-guide.md)
// 파일 하나가 빠지거나 깨져도 나머지는 살아요. LORE 는 장 순서(chapter.n)대로 정렬돼요.
const IDS = ['village', 'greenhill', 'woods', 'lake', 'swamp', 'canyon', 'plateau', 'blight', 'frost'];
const mods = await Promise.all(IDS.map(id => import(`./${id}.js`).then(m => m.default).catch(e => { console.warn(`[lore] ${id}: ${e.message}`); return null; })));
export const LORE = mods.filter(Boolean).sort((a, b) => a.chapter.n - b.chapter.n);
export const loreById = id => LORE.find(L => L.region === id) || null;
