// Task Rock Background Notification Service Worker
// Handles true background notifications that work when app is closed

const CACHE_NAME = 'task-rock-bg-notifications-v1';
const NOTIFICATION_STORE = 'task-rock-bg-notifications';
const DB_NAME = 'TaskRockBackgroundNotifications';
const DB_VERSION = 1;

// Global variables
let notificationDB = null;
let schedulerInterval = null;

// Service Worker Installation
self.addEventListener('install', (event) => {
    console.log('Task Rock Background Notifications SW: Installing...');
    
    event.waitUntil(
        Promise.all([
            initializeNotificationDB(),
            caches.open(CACHE_NAME).then(cache => {
                return cache.addAll([
                    './assets/images/jerry.png',
                    './assets/images/logo.png'
                ]).catch(error => {
                    console.log('Task Rock Background Notifications SW: Cache preload failed (non-critical):', error);
                });
            })
        ]).then(() => {
            console.log('Task Rock Background Notifications SW: Installation complete');
            return self.skipWaiting();
        })
    );
});

// Service Worker Activation
self.addEventListener('activate', (event) => {
    console.log('Task Rock Background Notifications SW: Activating...');
    
    event.waitUntil(
        Promise.all([
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            self.clients.claim(),
            startBackgroundNotificationScheduler()
        ]).then(() => {
            console.log('Task Rock Background Notifications SW: Activation complete');
        })
    );
});

// Initialize IndexedDB for notification storage
async function initializeNotificationDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            console.error('Task Rock Background Notifications SW: Failed to open database');
            reject(request.error);
        };
        
        request.onsuccess = () => {
            notificationDB = request.result;
            console.log('Task Rock Background Notifications SW: Database initialized');
            resolve(request.result);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains(NOTIFICATION_STORE)) {
                const store = db.createObjectStore(NOTIFICATION_STORE, { keyPath: 'id' });
                store.createIndex('taskId', 'taskId', { unique: false });
                store.createIndex('scheduledTime', 'scheduledTime', { unique: false });
                store.createIndex('status', 'status', { unique: false });
                store.createIndex('type', 'type', { unique: false });
            }
        };
    });
}

// Get database connection
async function getDB() {
    if (notificationDB) {
        return notificationDB;
    }
    
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = () => {
            notificationDB = request.result;
            resolve(request.result);
        };
        request.onerror = () => reject(request.error);
    });
}

// Start background notification scheduler
function startBackgroundNotificationScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
    }
    
    // Check for due notifications every 10 seconds for better responsiveness
    schedulerInterval = setInterval(checkAndTriggerDueNotifications, 10000);
    
    // Also check immediately
    checkAndTriggerDueNotifications();
    
    console.log('Task Rock Background Notifications SW: Background scheduler started');
}

// Check and trigger due notifications
async function checkAndTriggerDueNotifications() {
    try {
        const db = await getDB();
        const transaction = db.transaction([NOTIFICATION_STORE], 'readonly');
        const store = transaction.objectStore(NOTIFICATION_STORE);
        const index = store.index('scheduledTime');
        
        const now = Date.now();
        const range = IDBKeyRange.upperBound(now);
        
        const request = index.openCursor(range);
        const dueNotifications = [];
        
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const notification = cursor.value;
                if (notification.status === 'scheduled') {
                    dueNotifications.push(notification);
                }
                cursor.continue();
            } else {
                // Process all due notifications
                dueNotifications.forEach(notification => {
                    triggerBackgroundNotification(notification);
                });
            }
        };
        
    } catch (error) {
        console.error('Task Rock Background Notifications SW: Error checking due notifications:', error);
    }
}

// Trigger background notification
async function triggerBackgroundNotification(notificationData) {
    try {
        const { task, interval, id } = notificationData;
        
        // Create system notification
        const notificationOptions = {
            body: `"${task.title}" ${interval.minutes > 0 ? 'is due in ' + interval.minutes + ' minutes' : 'is due now'}!`,
            icon: './assets/images/jerry.png',
            badge: './assets/images/logo.png',
            tag: `task-${task.id}-${interval.id}`,
            requireInteraction: true,
            actions: [
                {
                    action: 'complete',
                    title: '✅ Complete',
                    icon: './assets/images/jerry.png'
                },
                {
                    action: 'snooze',
                    title: '⏰ Snooze 5min',
                    icon: './assets/images/jerry.png'
                },
                {
                    action: 'view',
                    title: '👀 View Task',
                    icon: './assets/images/jerry.png'
                }
            ],
            data: {
                taskId: task.id,
                notificationId: id,
                interval: interval,
                task: task
            },
            vibrate: getVibrationPattern(interval.minutes),
            silent: false
        };
        
        // Show the notification
        const title = interval.minutes > 0 ? `${interval.minutes} Minutes Left!` : 'Task Due Now!';
        await self.registration.showNotification(title, notificationOptions);
        
        // Mark notification as sent
        await markNotificationAsSent(id);
        
        console.log('Task Rock Background Notifications SW: Notification triggered for task:', task.title);
        
    } catch (error) {
        console.error('Task Rock Background Notifications SW: Error triggering notification:', error);
    }
}

// Mark notification as sent
async function markNotificationAsSent(notificationId) {
    try {
        const db = await getDB();
        const transaction = db.transaction([NOTIFICATION_STORE], 'readwrite');
        const store = transaction.objectStore(NOTIFICATION_STORE);
        
        const getRequest = store.get(notificationId);
        getRequest.onsuccess = () => {
            const notification = getRequest.result;
            if (notification) {
                notification.status = 'sent';
                notification.sentTime = Date.now();
                store.put(notification);
            }
        };
        
    } catch (error) {
        console.error('Task Rock Background Notifications SW: Error marking notification as sent:', error);
    }
}

// Get vibration pattern based on urgency
function getVibrationPattern(minutesLeft) {
    if (minutesLeft === 0) {
        return [200, 100, 200, 100, 200]; // Due now - urgent
    } else if (minutesLeft <= 2) {
        return [150, 100, 150]; // Very soon
    } else if (minutesLeft <= 5) {
        return [100, 100, 100]; // Soon
    } else {
        return [100]; // Normal reminder
    }
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Task Rock Background Notifications SW: Notification clicked:', event.action);
    
    event.notification.close();
    
    const { taskId, notificationId, task, interval } = event.notification.data;
    
    // Handle different actions
    switch (event.action) {
        case 'complete':
            handleCompleteTaskAction(taskId, notificationId);
            break;
            
        case 'snooze':
            handleSnoozeTaskAction(taskId, notificationId, 5); // 5 minute snooze
            break;
            
        case 'view':
        default:
            handleViewTaskAction(taskId, notificationId);
            break;
    }
});

// Handle complete task action
async function handleCompleteTaskAction(taskId, notificationId) {
    try {
        // Send message to main app
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'COMPLETE_TASK_FROM_BACKGROUND_NOTIFICATION',
                taskId: taskId,
                notificationId: notificationId
            });
        });
        
        // Cancel any remaining notifications for this task
        await cancelNotificationsForTask(taskId);
        
        console.log('Task Rock Background Notifications SW: Task completion requested:', taskId);
        
    } catch (error) {
        console.error('Task Rock Background Notifications SW: Error handling complete action:', error);
    }
}

// Handle snooze task action
async function handleSnoozeTaskAction(taskId, notificationId, snoozeMinutes) {
    try {
        // Send message to main app
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SNOOZE_TASK_FROM_BACKGROUND_NOTIFICATION',
                taskId: taskId,
                notificationId: notificationId,
                snoozeMinutes: snoozeMinutes
            });
        });
        
        console.log('Task Rock Background Notifications SW: Task snooze requested:', taskId, snoozeMinutes);
        
    } catch (error) {
        console.error('Task Rock Background Notifications SW: Error handling snooze action:', error);
    }
}

// Handle view task action
async function handleViewTaskAction(taskId, notificationId) {
    try {
        // Focus or open the app
        const clients = await self.clients.matchAll({ type: 'window' });
        
        if (clients.length > 0) {
            // Focus existing window
            const client = clients[0];
            client.focus();
            client.postMessage({
                type: 'VIEW_TASK_FROM_BACKGROUND_NOTIFICATION',
                taskId: taskId,
                notificationId: notificationId
            });
        } else {
            // Open new window
            await self.clients.openWindow(`/?task=${taskId}&notification=${notificationId}`);
        }
        
        console.log('Task Rock Background Notifications SW: Task view requested:', taskId);
        
    } catch (error) {
        console.error('Task Rock Background Notifications SW: Error handling view action:', error);
    }
}

// Cancel notifications for a specific task
async function cancelNotificationsForTask(taskId) {
    try {
        const db = await getDB();
        const transaction = db.transaction([NOTIFICATION_STORE], 'readwrite');
        const store = transaction.objectStore(NOTIFICATION_STORE);
        const index = store.index('taskId');
        
        const request = index.openCursor(IDBKeyRange.only(taskId));
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const notification = cursor.value;
                if (notification.status === 'scheduled') {
                    notification.status = 'cancelled';
                    cursor.update(notification);
                }
                cursor.continue();
            }
        };
        
    } catch (error) {
        console.error('Task Rock Background Notifications SW: Error cancelling notifications:', error);
    }
}

// Handle messages from main app
self.addEventListener('message', (event) => {
    const { type, data } = event.data;
    
    console.log('Task Rock Background Notifications SW: Message received:', type);
    
    switch (type) {
        case 'SCHEDULE_BACKGROUND_NOTIFICATIONS':
            scheduleBackgroundNotifications(data.task, data.intervals);
            break;
            
        case 'CANCEL_TASK_NOTIFICATIONS':
            cancelNotificationsForTask(data.taskId);
            break;
            
        case 'UPDATE_NOTIFICATION_SETTINGS':
            updateNotificationSettings(data.settings);
            break;
    }
});

// Schedule background notifications for a task
async function scheduleBackgroundNotifications(task, intervals) {
    try {
        const db = await getDB();
        const transaction = db.transaction([NOTIFICATION_STORE], 'readwrite');
        const store = transaction.objectStore(NOTIFICATION_STORE);
        
        const dueTime = new Date(task.dueDate).getTime();
        const now = Date.now();
        
        intervals.forEach(interval => {
            const scheduledTime = dueTime - (interval.minutes * 60 * 1000);
            
            if (scheduledTime > now) {
                const notification = {
                    id: `bg-${task.id}-${interval.id}-${Date.now()}`,
                    taskId: task.id,
                    task: task,
                    interval: interval,
                    scheduledTime: scheduledTime,
                    status: 'scheduled',
                    type: 'background',
                    createdTime: now
                };
                
                store.add(notification);
            }
        });
        
        console.log('Task Rock Background Notifications SW: Background notifications scheduled for task:', task.title);
        
    } catch (error) {
        console.error('Task Rock Background Notifications SW: Error scheduling notifications:', error);
    }
}

// Update notification settings
async function updateNotificationSettings(settings) {
    // Store settings for future use
    try {
        const db = await getDB();
        const transaction = db.transaction([NOTIFICATION_STORE], 'readwrite');
        const store = transaction.objectStore(NOTIFICATION_STORE);
        
        const settingsRecord = {
            id: 'settings',
            settings: settings,
            updatedTime: Date.now()
        };
        
        store.put(settingsRecord);
        
        console.log('Task Rock Background Notifications SW: Settings updated');
        
    } catch (error) {
        console.error('Task Rock Background Notifications SW: Error updating settings:', error);
    }
}

// Cleanup old notifications periodically
setInterval(async () => {
    try {
        const db = await getDB();
        const transaction = db.transaction([NOTIFICATION_STORE], 'readwrite');
        const store = transaction.objectStore(NOTIFICATION_STORE);
        
        const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
        
        const request = store.openCursor();
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const notification = cursor.value;
                if (notification.createdTime && notification.createdTime < cutoffTime) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };
        
    } catch (error) {
        console.error('Task Rock Background Notifications SW: Error during cleanup:', error);
    }
}, 24 * 60 * 60 * 1000); // Run daily

