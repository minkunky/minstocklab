/**
 * sw.js — MyStock Lab Service Worker
 * - 정적 자산: Cache First (오프라인에서도 앱 셸 로드)
 * - /api/* 요청: Network First (항상 최신 데이터 우선, 실패 시 캐시 폴백)
 */

const CACHE_NAME    = 'mystocklab-v1'
const SHELL_ASSETS  = ['/', '/src/main.tsx']   // Vite 빌드 후 실제 경로로 대체됨

// ── 설치: 앱 셸 사전 캐시 ────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

// ── 활성화: 오래된 캐시 정리 ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch: 전략 분기 ─────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // /api/* → Network First (실시간 데이터)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request))
    return
  }

  // 정적 자산 → Cache First
  if (request.method === 'GET') {
    event.respondWith(cacheFirst(request))
  }
})

// ── 전략 구현 ────────────────────────────────────────────────────────────────

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    // 성공 응답은 캐시에 저장 (GET만)
    if (request.method === 'GET' && response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // 네트워크 실패 → 캐시에서 반환
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response(JSON.stringify({ error: '오프라인 상태입니다.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('오프라인 상태입니다.', { status: 503 })
  }
}
