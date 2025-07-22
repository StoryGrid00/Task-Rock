// Task Rock PWA - Native Web Push Service Worker
// Replaces firebase-messaging-sw.js with native Web Push API implementation

const CACHE_NAME = 'task-rock-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/images/jerry.png',
    '/assets/images/logo.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    console.log('[SW] Service worker installing');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('[SW] Skip waiting');
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Service worker activating');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Claiming clients');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version or fetch from network
                return response || fetch(event.request);
            })
    );
});

// Push event - handle incoming push messages
self.addEventListener('push', (event) => {
    console.log('[SW] Push event received:', event);
    
    let notificationData = {
        title: 'Task Rock',
        body: 'You have task(s) to complete :)',
        icon: '/assets/images/jerry.png',
        badge: '/assets/images/logo.png',
        tag: 'task-rock-notification',
        data: {
            url: '/',
            timestamp: Date.now()
        }
    };
    
    // Parse push data if available
    if (event.data) {
        try {
            const pushData = event.data.json();
            notificationData = { ...notificationData, ...pushData };
            console.log('[SW] Push data received:', pushData);
        } catch (error) {
            console.log('[SW] Error parsing push data:', error);
            // Use text data if JSON parsing fails
            if (event.data.text()) {
                notificationData.body = event.data.text();
            }
        }
    }
    
    const notificationOptions = {
        body: notificationData.body,
        icon: notificationData.icon,
        badge: notificationData.badge,
        tag: notificationData.tag,
        data: notificationData.data,
        requireInteraction: false,
        silent: false,
        actions: [
            {
                action: 'view',
                title: 'View Tasks',
                icon: '/assets/images/logo.png'
            },
            {
                action: 'dismiss',
                title: 'Dismiss',
                icon: '/assets/images/logo.png'
            }
        ]
    };
    
    console.log('[SW] Showing notification:', notificationData.title, notificationOptions);
    
    event.waitUntil(
        self.registration.showNotification(notificationData.title, notificationOptions)
    );
});

// Notification click event - handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event);
    
    event.notification.close();
    
    const action = event.action;
    const notificationData = event.notification.data || {};
    
    if (action === 'dismiss') {
        console.log('[SW] Notification dismissed');
        return;
    }
    
    // Default action or 'view' action
    const urlToOpen = notificationData.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if app is already open
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        console.log('[SW] Focusing existing window');
                        
                        // Send message to client about notification click
                        client.postMessage({
                            type: 'notification_click',
                            action: action,
                            data: notificationData
                        });
                        
                        return client.focus();
                    }
                }
                
                // Open new window if app is not open
                if (clients.openWindow) {
                    console.log('[SW] Opening new window');
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Notification close event - handle notification close
self.addEventListener('notificationclose', (event) => {
    console.log('[SW] Notification closed:', event);
    
    // Optional: Track notification close events
    // Could send analytics data here
});

// Background sync event - for checking due tasks
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync event:', event.tag);
    
    if (event.tag === 'check-due-tasks') {
        event.waitUntil(checkDueTasks());
    }
});

// Helper function to check due tasks (simplified version)
async function checkDueTasks() {
    try {
        console.log('[SW] Checking due tasks in background');
        
        // In a real implementation, you would:
        // 1. Get tasks from IndexedDB or local storage
        // 2. Check which tasks are due
        // 3. Send notifications for due tasks
        
        // For now, we'll just log that the check happened
        console.log('[SW] Due tasks check completed');
        
    } catch (error) {
        console.error('[SW] Error checking due tasks:', error);
    }
}

// Message event - handle messages from main thread
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    // Handle other message types as needed
    if (event.data && event.data.type === 'CHECK_DUE_TASKS') {
        checkDueTasks();
    }
});

// Push subscription change event - handle subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('[SW] Push subscription changed:', event);
    
    event.waitUntil(
        // Re-subscribe with new subscription
        self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: event.oldSubscription ? 
                event.oldSubscription.options.applicationServerKey : null
        }).then((newSubscription) => {
            console.log('[SW] New subscription created:', newSubscription);
            
            // Send new subscription to server
            return fetch('/push-server/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newSubscription)
            });
        }).catch((error) => {
            console.error('[SW] Error handling subscription change:', error);
        })
    );
});

console.log('[SW] Task Rock Service Worker loaded');

