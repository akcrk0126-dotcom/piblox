// 플레이 허브 서비스 워커 — 설치(홈 화면 추가) + 오프라인 지원
// · 게임 페이지(HTML): 네트워크 먼저 → 실패하면 저장본 (업데이트가 바로 반영되도록)
// · three.js / firebase 스크립트 / 폰트: 저장본 먼저 (잘 안 바뀌고 무거움)
// · 파이어베이스 실시간 통신(멀티/랭킹)은 건드리지 않는다
const VERSION = 'playhub-v1';
const CORE = [
  './', 'hub.html', 'multiplayer.js', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  'ambo.html', 'tech-obby.html', 'pro-tower.html', 'backrooms.html', 'jumpmap.html',
  'aura-battle-3.html', 'forest-strike.html', 'nightfall.html', 'protocol-range.html',
];
const CDN = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|www\.gstatic\.com\/firebasejs|fonts\.googleapis\.com|fonts\.gstatic\.com)/;

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(VERSION).then(c=>Promise.all(CORE.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k !== VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin){
    const isPage = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('.js') || url.pathname.endsWith('.json');
    if (isPage){
      e.respondWith(fetch(req).then(res=>{ if (res.ok){ const cp = res.clone(); caches.open(VERSION).then(c=>c.put(req, cp)); } return res; })
        .catch(()=>caches.match(req, { ignoreSearch:true }).then(r=>r || (req.mode === 'navigate' ? caches.match('hub.html') : Response.error()))));
    } else {
      e.respondWith(caches.match(req).then(r=>r || fetch(req).then(res=>{ if (res.ok){ const cp = res.clone(); caches.open(VERSION).then(c=>c.put(req, cp)); } return res; })));
    }
    return;
  }
  if (CDN.test(req.url)){
    e.respondWith(caches.match(req).then(r=>r || fetch(req).then(res=>{ if (res.ok || res.type === 'opaque'){ const cp = res.clone(); caches.open(VERSION).then(c=>c.put(req, cp)); } return res; })));
  }
});
