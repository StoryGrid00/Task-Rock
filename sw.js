// Task Rock Service Worker - GitHub Pages Compatible
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
  console.log('Task Rock SW: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Task Rock SW: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Task Rock SW: Installation complete');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Task Rock SW: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Task Rock SW: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Task Rock SW: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Task Rock SW: Activation complete');
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

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version if available
        if (response) {
          console.log('Task Rock SW: Serving from cache', event.request.url);
          return response;
        }

        // Otherwise fetch from network
        console.log('Task Rock SW: Fetching from network', event.request.url);
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
        console.error('Task Rock SW: Fetch failed', error);
        
        // Return offline page for navigation requests
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
        
        // For other requests, just fail
        throw error;
      })
  );
});

// Background sync for task data
self.addEventListener('sync', event => {
  if (event.tag === 'task-sync') {
    console.log('Task Rock SW: Background sync triggered');
    event.waitUntil(syncTaskData());
  }
});

// Sync task data function
async function syncTaskData() {
  try {
    // Get pending tasks from IndexedDB or localStorage
    // This would sync with a backend if you had one
    console.log('Task Rock SW: Syncing task data...');
    
    // For now, just log since we're using localStorage
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        message: 'Task data synced successfully'
      });
    });
  } catch (error) {
    console.error('Task Rock SW: Sync failed', error);
  }
}

// Push notification handler (for future use)
self.addEventListener('push', event => {
  console.log('Task Rock SW: Push received');
  
  const options = {
    body: event.data ? event.data.text() : 'Jerry needs your attention!',
    icon: './assets/images/jerry.png',
    badge: './assets/images/logo.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Check on Jerry',
        icon: './assets/images/jerry.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: './assets/images/logo.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Task Rock', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  console.log('Task Rock SW: Notification clicked', event);
  event.notification.close();

  // Handle different actions
  if (event.action === 'complete') {
    // Send message to main app to complete task
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        if (clients.length > 0) {
          clients[0].postMessage({
            type: 'notification_click',
            action: 'complete',
            taskId: event.notification.data ? event.notification.data.taskId : null
          });
        }
        return self.clients.openWindow('./');
      })
    );
  } else if (event.action === 'view' || !event.action) {
    // Open the app or bring it to focus
    event.waitUntil(
      self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then(clients => {
        // Check if app is already open
        for (let client of clients) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            return client;
          }
        }
        // If not open, open new window
        return self.clients.openWindow('./');
      })
    );
  }
});

// Message handler for communication with main app
self.addEventListener('message', event => {
  console.log('Task Rock SW: Message received', event.data);
  
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

