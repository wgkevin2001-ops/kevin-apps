// ══ 呈貝持股 Service Worker ══
// 版本號：每次更新內容時，改這裡就會強制重新快取
const CACHE_NAME = 'chengbei-v1';

// 需要離線快取的檔案
const ASSETS = [
  '呈貝目前持股.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  // Google Fonts（可能因 CORS 無法快取，但試試）
  'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&family=DM+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap',
  // XLSX 函式庫
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// ── 安裝：快取所有靜態資源 ──
self.addEventListener('install', event => {
  console.log('[SW] 安裝中...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 逐一快取，失敗的跳過（避免單一失敗阻斷整個安裝）
      return Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(err => {
          console.warn('[SW] 無法快取:', url, err);
        }))
      );
    }).then(() => {
      console.log('[SW] 安裝完成');
      // 立即接管頁面，不等舊 SW 結束
      return self.skipWaiting();
    })
  );
});

// ── 啟動：清除舊版快取 ──
self.addEventListener('activate', event => {
  console.log('[SW] 啟動中...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] 刪除舊快取:', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      console.log('[SW] 已接管所有頁面');
      return self.clients.claim();
    })
  );
});

// ── 攔截請求：快取優先，失敗才走網路 ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // GAS API、Yahoo Finance 等即時資料：永遠走網路，不快取
  if (
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('query1.finance.yahoo.com') ||
    url.hostname.includes('query2.finance.yahoo.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') && url.pathname.includes('/v1/')
  ) {
    return; // 讓瀏覽器自己處理，不攔截
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // 有快取：先回傳快取，背景更新
        const fetchUpdate = fetch(event.request).then(response => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {});
        return cached;
      }

      // 沒快取：走網路
      return fetch(event.request).then(response => {
        // 只快取成功的 GET 請求
        if (
          response && 
          response.status === 200 && 
          event.request.method === 'GET' &&
          response.type !== 'opaque'
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // 完全離線：回傳主頁面（讓 SPA 運作）
        if (event.request.destination === 'document') {
          return caches.match('呈貝目前持股.html');
        }
      });
    })
  );
});

// ── 接收主頁面訊息（例如：手動更新快取）──
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data === 'clearCache') {
    caches.delete(CACHE_NAME).then(() => {
      event.source.postMessage('cacheCleared');
    });
  }
});
