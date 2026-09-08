// 플레이 허브 서비스 워커
//
// 전략: 네트워크 우선(network-first). 최신 상태를 항상 먼저 시도하고,
// 오프라인이거나 요청이 실패할 때만 캐시로 대체한다.
// 게임 파일들을 한창 고치는 중이라 "일단 다 캐싱해서 오래 쓰기"보다
// "최신판을 우선하되 인터넷이 끊겨도 완전히 먹통은 안 되게"가 더 맞는 선택.
//
// ⚠️ 새 버전을 배포할 때마다 아래 CACHE_NAME의 버전 숫자를 올려주세요.
// 안 올리면 브라우저가 예전 서비스 워커를 계속 쓸 수 있어요(강제 새로고침으로도
// 안 풀리면 브라우저 개발자도구 > Application > Service Workers에서 Unregister).
const CACHE_VERSION = 'v1';
const CACHE_NAME = 'playhub-' + CACHE_VERSION;

// 앱이 처음 켜질 때 반드시 있어야 하는 최소한의 뼈대만 미리 캐싱한다.
// (여기 목록에 없는 파일이라도 방문하는 순간 자동으로 캐시에 추가된다 — 아래 fetch 핸들러 참고)
const PRECACHE_URLS = [
  './hub.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .catch(err => console.warn('[SW] 초기 캐싱 중 일부 실패(무시하고 계속):', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;   // POST 등은 캐싱 대상이 아니다(파이어베이스 통신 등)

  event.respondWith(
    fetch(req)
      .then(res => {
        // 성공적으로 받아온 최신 응답은 다음 오프라인 상황을 위해 캐시에 저장해둔다
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(()=>{});
        }
        return res;
      })
      .catch(() =>
        // 네트워크 실패(오프라인) — 캐시에 있으면 그거라도 보여준다
        caches.match(req).then(cached => cached || caches.match('./hub.html'))
      )
  );
});
