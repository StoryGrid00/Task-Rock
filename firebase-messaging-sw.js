importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBLGmPRuqGou8cB_A9QDQ-QF7b8QI",
  authDomain: "task-rock.firebaseapp.com",
  projectId: "task-rock",
  storageBucket: "task-rock.firebasestorage.app",
  messagingSenderId: "359134310",
  appId: "1:359134310:web:8edf84d7b9334e4c6e83",
  measurementId: "G-W4CTN7PJ"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);
  
  const notificationTitle = 'Task Rock';
  const notificationBody = 'You have task(s) to complete :)';
  
  const notificationOptions = {
    body: notificationBody,
    icon: '/assets/images/jerry.png',
    badge: '/assets/images/icon-192x192.png',
    tag: 'task-rock-notification',
    silent: false,
    data: {
      url: '/',
      timestamp: Date.now()
    }
  };

  console.log('[firebase-messaging-sw.js] Showing notification:', notificationTitle);
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);
  
  event.notification.close();
  
  if (event.action === 'view' || !event.action) {
    // Open or focus the Task Rock app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            console.log('[firebase-messaging-sw.js] Focusing existing window');
            return client.focus();
          }
        }
        // Open new window if app is not open
        if (clients.openWindow) {
          console.log('[firebase-messaging-sw.js] Opening new window');
          return clients.openWindow('/');
        }
      })
    );
  } else if (event.action === 'dismiss') {
    console.log('[firebase-messaging-sw.js] Notification dismissed');
  }
});

// Handle service worker installation
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service worker installing');
  self.skipWaiting();
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service worker activating');
  event.waitUntil(self.clients.claim());
});

