// Task Rock Local Notification Service Worker
// Handles background notifications without external dependencies

const CACHE_NAME = 'task-rock-notifications-v1';
const NOTIFICATION_STORE = 'task-rock-notifications';
const DB_NAME = 'TaskRockNotifications';
const DB_VERSION = 1;

// Service Worker Installation
self.addEventListener('install', (event) => {
    console.log('Task Rock Notifications SW: Installing...');
    
    event.waitUntil(
        Promise.all([
            // Initialize notification database
            initializeNotificationDB(),
            // Cache essential assets
            caches.open(CACHE_NAME).then(cache => {
                return cache.addAll([
                    './assets/images/jerry.png',
                    './assets/images/logo.png'
                ]).catch(error => {
                    console.log('Task Rock Notifications SW: Cache preload failed (non-critical):', error);
                });
            })
        ]).then(() => {
            console.log('Task Rock Notifications SW: Installation complete');
            // Force activation of new service worker
            return self.skipWaiting();
        })
    );
});

// Service Worker Activation
self.addEventListener('activate', (event) => {
    console.log('Task Rock Notifications SW: Activating...');
    
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Take control of all clients
            self.clients.claim(),
            // Start notification scheduler
            startNotificationScheduler()
        ]).then(() => {
            console.log('Task Rock Notifications SW: Activation complete');
        })
    );
});

// Initialize IndexedDB for notification storage
async function initializeNotificationDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            console.error('Task Rock Notifications SW: Failed to open database');
            reject(request.error);
        };
        
        request.onsuccess = () => {
            console.log('Task Rock Notifications SW: Database initialized');
            resolve(request.result);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create notifications store
            if (!db.objectStoreNames.contains(NOTIFICATION_STORE)) {
                const store = db.createObjectStore(NOTIFICATION_STORE, { keyPath: 'id' });
                store.createIndex('taskId', 'taskId', { unique: false });
                store.createIndex('scheduledTime', 'scheduledTime', { unique: false });
                store.createIndex('status', 'status', { unique: false });
            }
        };
    });
}

// Get database connection
async function getDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Store notification in database
async function storeNotification(notification) {
    try {
        const db = await getDB();
        const transaction = db.transaction([NOTIFICATION_STORE], 'readwrite');
        const store = transaction.objectStore(NOTIFICATION_STORE);
        
        await new Promise((resolve, reject) => {
            const request = store.put(notification);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        
        console.log('Task Rock Notifications SW: Notification stored:', notification.id);
    } catch (error) {
        console.error('Task Rock Notifications SW: Failed to store notification:', error);
    }
}

// Get scheduled notifications
async function getScheduledNotifications() {
    try {
        const db = await getDB();
        const transaction = db.transaction([NOTIFICATION_STORE], 'readonly');
        const store = transaction.objectStore(NOTIFICATION_STORE);
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const notifications = request.result.filter(n => n.status === 'scheduled');
                resolve(notifications);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Task Rock Notifications SW: Failed to get notifications:', error);
        return [];
    }
}

// Update notification status
async function updateNotificationStatus(id, status) {
    try {
        const db = await getDB();
        const transaction = db.transaction([NOTIFICATION_STORE], 'readwrite');
        const store = transaction.objectStore(NOTIFICATION_STORE);
        
        const getRequest = store.get(id);
        getRequest.onsuccess = () => {
            const notification = getRequest.result;
            if (notification) {
                notification.status = status;
                notification.updatedAt = Date.now();
                store.put(notification);
            }
        };
    } catch (error) {
        console.error('Task Rock Notifications SW: Failed to update notification:', error);
    }
}

// Delete notifications for a task
async function deleteTaskNotifications(taskId) {
    try {
        const db = await getDB();
        const transaction = db.transaction([NOTIFICATION_STORE], 'readwrite');
        const store = transaction.objectStore(NOTIFICATION_STORE);
        const index = store.index('taskId');
        
        const request = index.openCursor(IDBKeyRange.only(taskId));
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };
        
        console.log('Task Rock Notifications SW: Deleted notifications for task:', taskId);
    } catch (error) {
        console.error('Task Rock Notifications SW: Failed to delete task notifications:', error);
    }
}

// Notification scheduler
let schedulerInterval;

function startNotificationScheduler() {
    // Clear existing scheduler
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
    }
    
    // Check for due notifications every 30 seconds
    schedulerInterval = setInterval(checkDueNotifications, 30000);
    
    // Also check immediately
    checkDueNotifications();
    
    console.log('Task Rock Notifications SW: Scheduler started');
}

async function checkDueNotifications() {
    try {
        const notifications = await getScheduledNotifications();
        const now = Date.now();
        
        for (const notification of notifications) {
            if (notification.scheduledTime <= now) {
                await showNotification(notification);
                await updateNotificationStatus(notification.id, 'sent');
            }
        }
    } catch (error) {
        console.error('Task Rock Notifications SW: Error checking due notifications:', error);
    }
}

// Show notification
async function showNotification(notificationData) {
    try {
        const { taskId, title, body, type, urgency, minutesLeft } = notificationData;
        
        const options = {
            body: body,
            icon: './assets/images/jerry.png',
            badge: './assets/images/logo.png',
            tag: `task-${taskId}-${type}`,
            requireInteraction: urgency === 'urgent' || minutesLeft <= 5,
            silent: false,
            vibrate: getVibrationPattern(urgency),
            data: {
                taskId: taskId,
                type: type,
                urgency: urgency,
                minutesLeft: minutesLeft,
                timestamp: Date.now(),
                source: 'local'
            },
            actions: getNotificationActions(urgency, minutesLeft)
        };
        
        await self.registration.showNotification(title, options);
        console.log('Task Rock Notifications SW: Notification shown:', title);
        
        // Notify main app if available
        notifyMainApp('NOTIFICATION_SHOWN', { taskId, type, urgency });
        
    } catch (error) {
        console.error('Task Rock Notifications SW: Failed to show notification:', error);
    }
}

// Get vibration pattern based on urgency
function getVibrationPattern(urgency) {
    switch (urgency) {
        case 'urgent':
            return [200, 100, 200, 100, 200, 100, 200]; // Very urgent
        case 'high':
            return [200, 100, 200, 100, 200]; // High priority
        case 'medium':
            return [200, 100, 200]; // Medium priority
        case 'low':
            return [200]; // Low priority
        default:
            return [200, 100, 200]; // Default pattern
    }
}

// Get notification actions based on context
function getNotificationActions(urgency, minutesLeft) {
    const actions = [
        {
            action: 'complete',
            title: '✅ Complete',
            icon: './assets/images/jerry.png'
        }
    ];
    
    // Add snooze for non-overdue tasks
    if (minutesLeft > 0) {
        actions.push({
            action: 'snooze',
            title: '⏰ Snooze 5min',
            icon: './assets/images/logo.png'
        });
    }
    
    // Always add view option
    actions.push({
        action: 'view',
        title: '👀 View Task',
        icon: './assets/images/logo.png'
    });
    
    return actions;
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Task Rock Notifications SW: Notification clicked:', event.action);
    
    event.notification.close();
    
    const { taskId, type, urgency } = event.notification.data || {};
    const action = event.action;
    
    event.waitUntil(
        handleNotificationAction(action, taskId, type, urgency)
    );
});

// Handle notification actions
async function handleNotificationAction(action, taskId, type, urgency) {
    try {
        switch (action) {
            case 'complete':
                await handleTaskCompletion(taskId);
                break;
                
            case 'snooze':
                await handleTaskSnooze(taskId, 5); // 5 minutes
                break;
                
            case 'view':
            default:
                await openTaskRockApp(taskId);
                break;
        }
    } catch (error) {
        console.error('Task Rock Notifications SW: Error handling notification action:', error);
    }
}

// Handle task completion from notification
async function handleTaskCompletion(taskId) {
    try {
        // Notify main app to complete the task
        const success = await notifyMainApp('COMPLETE_TASK_FROM_NOTIFICATION', { taskId });
        
        if (success) {
            // Delete all notifications for this task
            await deleteTaskNotifications(taskId);
            
            // Show success notification
            await self.registration.showNotification('Task Completed! 🎉', {
                body: 'Great job! Jerry is proud of you!',
                icon: './assets/images/jerry.png',
                badge: './assets/images/logo.png',
                tag: 'task-completed',
                requireInteraction: false,
                vibrate: [200, 100, 200],
                data: {
                    type: 'completion_success',
                    timestamp: Date.now()
                }
            });
        } else {
            // Open app to complete task
            await openTaskRockApp(taskId, 'complete');
        }
    } catch (error) {
        console.error('Task Rock Notifications SW: Error completing task:', error);
        // Fallback: open app
        await openTaskRockApp(taskId, 'complete');
    }
}

// Handle task snooze from notification
async function handleTaskSnooze(taskId, minutes) {
    try {
        // Notify main app to snooze the task
        await notifyMainApp('SNOOZE_TASK_FROM_NOTIFICATION', { taskId, minutes });
        
        // Schedule a new notification after snooze period
        const snoozeNotification = {
            id: `snooze-${taskId}-${Date.now()}`,
            taskId: taskId,
            title: 'Snooze Time Over! ⏰',
            body: 'Your snoozed task is ready for attention!',
            type: 'snooze_reminder',
            urgency: 'high',
            minutesLeft: 0,
            scheduledTime: Date.now() + (minutes * 60 * 1000),
            status: 'scheduled',
            createdAt: Date.now()
        };
        
        await storeNotification(snoozeNotification);
        
        // Show snooze confirmation
        await self.registration.showNotification('Task Snoozed 😴', {
            body: `Reminder set for ${minutes} minutes. Rest easy!`,
            icon: './assets/images/jerry.png',
            badge: './assets/images/logo.png',
            tag: 'task-snoozed',
            requireInteraction: false,
            vibrate: [100],
            data: {
                type: 'snooze_confirmation',
                timestamp: Date.now()
            }
        });
        
    } catch (error) {
        console.error('Task Rock Notifications SW: Error snoozing task:', error);
    }
}

// Open Task Rock app
async function openTaskRockApp(taskId = null, action = null) {
    try {
        // Check if app is already open
        const clients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        });
        
        for (let client of clients) {
            if (client.url.includes(self.location.origin)) {
                // App is already open, focus it and send data
                client.focus();
                client.postMessage({
                    type: 'NOTIFICATION_CLICKED',
                    taskId: taskId,
                    action: action,
                    source: 'local'
                });
                return client;
            }
        }
        
        // App is not open, open new window
        let url = './index.html';
        if (taskId && action) {
            url += `?action=${action}&taskId=${taskId}`;
        } else if (taskId) {
            url += `?taskId=${taskId}`;
        }
        
        return await self.clients.openWindow(url);
        
    } catch (error) {
        console.error('Task Rock Notifications SW: Error opening app:', error);
    }
}

// Notify main app
async function notifyMainApp(type, data) {
    try {
        const clients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        });
        
        if (clients.length > 0) {
            clients[0].postMessage({
                type: type,
                ...data,
                source: 'local'
            });
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Task Rock Notifications SW: Error notifying main app:', error);
        return false;
    }
}

// Handle messages from main app
self.addEventListener('message', (event) => {
    console.log('Task Rock Notifications SW: Message received:', event.data);
    
    const { type, data } = event.data || {};
    
    switch (type) {
        case 'SCHEDULE_TASK_NOTIFICATIONS':
            handleScheduleTaskNotifications(data);
            break;
            
        case 'CANCEL_TASK_NOTIFICATIONS':
            handleCancelTaskNotifications(data.taskId);
            break;
            
        case 'UPDATE_TASK_NOTIFICATIONS':
            handleUpdateTaskNotifications(data);
            break;
            
        case 'GET_NOTIFICATION_STATUS':
            handleGetNotificationStatus(event);
            break;
            
        default:
            console.log('Task Rock Notifications SW: Unknown message type:', type);
    }
});

// Handle scheduling task notifications
async function handleScheduleTaskNotifications(taskData) {
    try {
        const { task, intervals } = taskData;
        const dueTime = new Date(task.dueDate).getTime();
        const now = Date.now();
        
        // Delete existing notifications for this task
        await deleteTaskNotifications(task.id);
        
        // Schedule new notifications
        for (const interval of intervals) {
            const notificationTime = dueTime - (interval.minutes * 60 * 1000);
            
            // Only schedule future notifications
            if (notificationTime > now) {
                const notification = {
                    id: `${task.id}-${interval.id}-${Date.now()}`,
                    taskId: task.id,
                    title: `Task Rock - ${interval.minutes} Minutes Left!`,
                    body: `"${task.title}" is due in ${interval.minutes} minutes! ${getMotivationalMessage(interval.minutes)}`,
                    type: `task_due_${interval.id}`,
                    urgency: getUrgencyLevel(interval.minutes),
                    minutesLeft: interval.minutes,
                    scheduledTime: notificationTime,
                    status: 'scheduled',
                    createdAt: now
                };
                
                await storeNotification(notification);
            }
        }
        
        console.log('Task Rock Notifications SW: Scheduled notifications for task:', task.id);
    } catch (error) {
        console.error('Task Rock Notifications SW: Error scheduling notifications:', error);
    }
}

// Handle canceling task notifications
async function handleCancelTaskNotifications(taskId) {
    try {
        await deleteTaskNotifications(taskId);
        console.log('Task Rock Notifications SW: Cancelled notifications for task:', taskId);
    } catch (error) {
        console.error('Task Rock Notifications SW: Error cancelling notifications:', error);
    }
}

// Handle updating task notifications
async function handleUpdateTaskNotifications(taskData) {
    try {
        // Cancel existing notifications
        await handleCancelTaskNotifications(taskData.task.id);
        
        // Schedule new notifications
        await handleScheduleTaskNotifications(taskData);
        
        console.log('Task Rock Notifications SW: Updated notifications for task:', taskData.task.id);
    } catch (error) {
        console.error('Task Rock Notifications SW: Error updating notifications:', error);
    }
}

// Handle getting notification status
async function handleGetNotificationStatus(event) {
    try {
        const notifications = await getScheduledNotifications();
        
        event.ports[0].postMessage({
            type: 'NOTIFICATION_STATUS_RESPONSE',
            data: {
                scheduledCount: notifications.length,
                notifications: notifications
            }
        });
    } catch (error) {
        console.error('Task Rock Notifications SW: Error getting notification status:', error);
        event.ports[0].postMessage({
            type: 'NOTIFICATION_STATUS_ERROR',
            error: error.message
        });
    }
}

// Get motivational message based on time remaining
function getMotivationalMessage(minutes) {
    if (minutes >= 20) {
        return "Time to get started! 🗿";
    } else if (minutes >= 10) {
        return "Let's make progress! 💪";
    } else if (minutes >= 5) {
        return "Crunch time! You've got this! 🔥";
    } else {
        return "Final push! Jerry believes in you! 🚨";
    }
}

// Get urgency level based on minutes remaining
function getUrgencyLevel(minutes) {
    if (minutes <= 2) {
        return 'urgent';
    } else if (minutes <= 5) {
        return 'high';
    } else if (minutes <= 10) {
        return 'medium';
    } else {
        return 'low';
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
                if (notification.createdAt < cutoffTime && notification.status !== 'scheduled') {
                    cursor.delete();
                }
                cursor.continue();
            }
        };
    } catch (error) {
        console.error('Task Rock Notifications SW: Error cleaning up old notifications:', error);
    }
}, 24 * 60 * 60 * 1000); // Run daily

console.log('Task Rock Notifications SW: Service worker loaded and ready');

