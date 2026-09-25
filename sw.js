// 플레이 허브 서비스 워커 — 설치(홈 화면 추가) + 오프라인 지원
// · 내 사이트 파일(HTML/JS/이미지): 항상 서버에서 새로 받음 → 실패(오프라인)할 때만 저장본
//   → GitHub에 올리기만 하면 앱에도 바로 반영. 버전 숫자 바꿀 필요 없음
// · three.js / firebase 스크립트 / 폰트: 저장본 먼저 (잘 안 바뀌고 무거움)
// · 파이어베이스 실시간 통신(멀티/랭킹)은 건드리지 않는다
const VERSION = 'playhub-v1';
const CORE = [
  './', 'hub.html', 'multiplayer.js', 'manifest.json',
  'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-32.png',
  'steal-it.html', 'ambo.html', 'jamboree.html', 'tech-obby.html', 'pro-tower.html', 'backrooms.html', 'jumpmap.html',
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
    // 내 사이트 파일은 전부 '항상 새로 받기' → 올리기만 하면 바로 최신판. 인터넷이 끊겼을 때만 저장본 사용
    e.respondWith(fetch(req, { cache:'no-cache' }).then(res=>{ if (res.ok){ const cp = res.clone(); caches.open(VERSION).then(c=>c.put(req, cp)); } return res; })
      .catch(()=>caches.match(req, { ignoreSearch:true }).then(r=>r || (req.mode === 'navigate' ? caches.match('hub.html') : Response.error()))));
    return;
  }
  if (CDN.test(req.url)){
    e.respondWith(caches.match(req).then(r=>r || fetch(req).then(res=>{ if (res.ok || res.type === 'opaque'){ const cp = res.clone(); caches.open(VERSION).then(c=>c.put(req, cp)); } return res; })));
  }
});
