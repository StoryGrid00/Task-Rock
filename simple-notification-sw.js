// Simple Service Worker for Task Rock System Notifications
// Handles notifications when app is closed

const CACHE_NAME = 'task-rock-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/assets/images/jerry.png',
    '/assets/images/logo.png',
    '/simple-notification-system.js'
];

// Install service worker
self.addEventListener('install', event => {
    console.log('Task Rock SW: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Task Rock SW: Caching files');
                return cache.addAll(urlsToCache);
            })
    );
});

// Activate service worker
self.addEventListener('activate', event => {
    console.log('Task Rock SW: Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Task Rock SW: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Handle fetch requests (offline support)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version or fetch from network
                return response || fetch(event.request);
            })
    );
});

// Handle messages from main app
self.addEventListener('message', event => {
    const { type, title, options } = event.data;
    
    if (type === 'SHOW_NOTIFICATION') {
        console.log('Task Rock SW: Showing notification:', title);
        self.registration.showNotification(title, options);
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    console.log('Task Rock SW: Notification clicked:', event.notification.tag);
    
    event.notification.close();
    
    const { action } = event;
    const { taskId, url } = event.notification.data;
    
    if (action === 'complete') {
        // Open app and mark task complete
        event.waitUntil(
            clients.openWindow(url + '?action=complete&taskId=' + taskId)
        );
    } else if (action === 'snooze') {
        // Open app and snooze task
        event.waitUntil(
            clients.openWindow(url + '?action=snooze&taskId=' + taskId)
        );
    } else {
        // Just open the app
        event.waitUntil(
            clients.openWindow(url)
        );
    }
});

// Handle notification close
self.addEventListener('notificationclose', event => {
    console.log('Task Rock SW: Notification closed:', event.notification.tag);
});

console.log('Task Rock SW: Service worker loaded');

