
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { self.clients.claim(); });
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(_) { data = { body: event.data && event.data.text() }; }
  const title = data.title || 'Task Rock';
  const body = data.body || 'Task reminder';
  const tag = data.tag || 'task-rock';
  const icon = data.icon || '/assets/images/browser-window-tab-thumbnail.png';
  const badge = data.badge || icon;
  event.waitUntil(self.registration.showNotification(title, { body, tag, icon, badge, data }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(list => {
    for (const c of list) { if ('focus' in c) { c.focus(); return; } }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
