// Simple System-Only Notification System for Task Rock with Firebase Integration
// Based on PWA best practices - works when app is closed

class TaskRockSystemNotifications {
    constructor() {
        this.isEnabled = false;
        this.firebaseEnabled = false;
        this.serviceWorker = null;
        this.scheduledNotifications = new Map();
    }

    // Initialize simple notification system
    async initialize() {
        try {
            console.log('Task Rock: Initializing system notifications...');
            
            // Register service worker
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.register('./simple-notification-sw.js');
                this.serviceWorker = registration;
                console.log('Task Rock: Service worker registered');
            }

            // Request permission
            if ('Notification' in window) {
                const permission = await Notification.requestPermission();
                this.isEnabled = permission === 'granted';
                console.log('Task Rock: Notification permission:', permission);
            }

            return this.isEnabled;
        } catch (error) {
            console.error('Task Rock: Notification initialization failed:', error);
            return false;
        }
    }

    // Initialize Firebase notifications
    async initializeFirebase() {
        try {
            if (window.initializeFirebaseMessaging) {
                const token = await window.initializeFirebaseMessaging();
                this.firebaseEnabled = !!token;
                console.log('Task Rock: Firebase notifications initialized:', this.firebaseEnabled);
                return this.firebaseEnabled;
            }
            return false;
        } catch (error) {
            console.error('Task Rock: Firebase initialization failed:', error);
            return false;
        }
    }

    // Schedule a simple notification for a task
    scheduleTaskNotification(task) {
        if ((!this.isEnabled && !this.firebaseEnabled) || !task.dueDate) return;

        const dueTime = new Date(task.dueDate).getTime();
        const now = Date.now();
        
        // Only schedule if task is in the future
        if (dueTime <= now) return;

        // Schedule notification 5 minutes before due time
        const notificationTime = dueTime - (5 * 60 * 1000); // 5 minutes before
        const delay = notificationTime - now;

        if (delay > 0) {
            const timeoutId = setTimeout(() => {
                this.showSystemNotification(task);
            }, delay);

            this.scheduledNotifications.set(task.id, timeoutId);
            console.log(`Task Rock: Scheduled notification for "${task.title}" in ${Math.round(delay / 60000)} minutes`);
        }
    }

    // Show system notification (works when app is closed)
    showSystemNotification(task) {
        if (!this.isEnabled && !this.firebaseEnabled) return;

        const options = {
            body: `Task "${task.title}" is due in 5 minutes!`,
            icon: './assets/images/jerry.png',
            badge: './assets/images/logo.png',
            tag: `task-${task.id}`,
            requireInteraction: true,
            actions: [
                { action: 'complete', title: 'Mark Complete' },
                { action: 'snooze', title: 'Snooze 10min' }
            ],
            data: {
                taskId: task.id,
                taskTitle: task.title,
                url: window.location.origin
            }
        };

        // Use service worker to show notification (works when app is closed)
        if (this.serviceWorker && this.serviceWorker.active) {
            this.serviceWorker.active.postMessage({
                type: 'SHOW_NOTIFICATION',
                title: '🗿 Task Rock Reminder',
                options: options
            });
        } else if (this.isEnabled) {
            // Fallback to direct notification (only works when app is open)
            new Notification('🗿 Task Rock Reminder', options);
        }
    }

    // Cancel scheduled notification
    cancelTaskNotification(taskId) {
        const timeoutId = this.scheduledNotifications.get(taskId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.scheduledNotifications.delete(taskId);
            console.log(`Task Rock: Cancelled notification for task ${taskId}`);
        }
    }

    // Enable/disable local notifications
    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (!enabled) {
            // Cancel all scheduled notifications if both are disabled
            if (!this.firebaseEnabled) {
                this.scheduledNotifications.forEach(timeoutId => clearTimeout(timeoutId));
                this.scheduledNotifications.clear();
            }
        }
    }

    // Enable/disable Firebase notifications
    setFirebaseEnabled(enabled) {
        this.firebaseEnabled = enabled;
        if (!enabled) {
            // Cancel all scheduled notifications if both are disabled
            if (!this.isEnabled) {
                this.scheduledNotifications.forEach(timeoutId => clearTimeout(timeoutId));
                this.scheduledNotifications.clear();
            }
        }
    }

    // Get notification status
    getStatus() {
        return {
            enabled: this.isEnabled,
            firebaseEnabled: this.firebaseEnabled,
            permission: Notification.permission,
            scheduled: this.scheduledNotifications.size
        };
    }
}

// Global instance
window.taskRockNotifications = new TaskRockSystemNotifications();

