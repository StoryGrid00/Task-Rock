// Task Rock Caching Service Worker - GitHub Pages Compatible
const CACHE_NAME = 'task-rock-v1.0.0';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './assets/images/logo.png',
  './assets/images/jerry.png',
  './assets/images/jerry-black-hat.png',
  './assets/images/jerry-blue-hat.png',
  './assets/images/jerry-army-helmet.png',
  './assets/images/jerry-wizard-hat.png',
  './assets/images/jerry-mustache.png',
  './assets/images/jerry-reading-glasses.png',
  './assets/images/jerry-buddy-paint.png',
  './assets/images/jerry-rock-star-paint.png',
  './assets/images/jerry-paint-makeup.png',
  './assets/images/buddy-paint-thumbnail.png',
  './assets/images/jerry-rock-star-paint-thumbnail.png',
  './assets/images/jerry-paint-makeup-thumbnail.png',
  './assets/images/mustache-thumbnail.png',
  './assets/images/wizard-hat-thumbnail.png',
  './assets/images/Group51.png',
  './assets/images/Group55.png',
  './assets/images/Group57.png',
  './assets/images/Group60.png',
  './assets/images/Group62.png',
  './assets/images/Group63.png',
  './assets/images/Group64.png',
  './assets/images/Group73.png',
  './assets/images/Group78.png',
  './assets/images/Group79.png',
  './assets/images/Group80.png',
  './assets/images/Group81.png',
  './assets/images/Group83.png',
  './assets/images/Group84.png',
  './assets/images/Group85.png'
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('Task Rock Cache SW: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Task Rock Cache SW: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Task Rock Cache SW: Installation complete');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Task Rock Cache SW: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Task Rock Cache SW: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Task Rock Cache SW: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Task Rock Cache SW: Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Skip OneSignal requests to avoid interference
  if (event.request.url.includes('onesignal.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version if available
        if (response) {
          console.log('Task Rock Cache SW: Serving from cache', event.request.url);
          return response;
        }

        // Otherwise fetch from network
        console.log('Task Rock Cache SW: Fetching from network', event.request.url);
        return fetch(event.request).then(response => {
          // Don't cache if not a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Add to cache for future use
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch(error => {
        console.error('Task Rock Cache SW: Fetch failed', error);
        
        // Return offline page for navigation requests
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
        
        // For other requests, just fail
        throw error;
      })
  );
});

// Background sync for task data (non-notification related)
self.addEventListener('sync', event => {
  if (event.tag === 'task-sync') {
    console.log('Task Rock Cache SW: Background sync triggered');
    event.waitUntil(syncTaskData());
  }
});

// Sync task data function
async function syncTaskData() {
  try {
    // Get pending tasks from IndexedDB or localStorage
    // This would sync with a backend if you had one
    console.log('Task Rock Cache SW: Syncing task data...');
    
    // For now, just log since we're using localStorage
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        message: 'Task data synced successfully'
      });
    });
  } catch (error) {
    console.error('Task Rock Cache SW: Sync failed', error);
  }
}

// Storage helper functions for service worker
async function getStorageData(key) {
  return new Promise((resolve) => {
    // Try to get data from clients first
    self.clients.matchAll().then(clients => {
      if (clients.length > 0) {
        // Ask main app for data
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data);
        };
        
        clients[0].postMessage({
          type: 'GET_STORAGE_DATA',
          key: key
        }, [messageChannel.port2]);
        
        // Timeout after 5 seconds
        setTimeout(() => resolve(null), 5000);
      } else {
        resolve(null);
      }
    });
  });
}

async function setStorageData(key, data) {
  return new Promise((resolve) => {
    self.clients.matchAll().then(clients => {
      if (clients.length > 0) {
        clients[0].postMessage({
          type: 'SET_STORAGE_DATA',
          key: key,
          data: data
        });
      }
      resolve();
    });
  });
}

// Message handler for communication with main app
self.addEventListener('message', event => {
  console.log('Task Rock Cache SW: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      type: 'VERSION',
      version: CACHE_NAME
    });
  }
});

