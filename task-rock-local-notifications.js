// Task Rock Local Notification System
// Handles foreground notifications and coordinates with service worker

class TaskRockNotifications {
    constructor() {
        this.serviceWorker = null;
        this.notificationPermission = 'default';
        this.isInitialized = false;
        this.activeNotifications = new Map();
        this.notificationQueue = [];
        this.settings = {
            enabled: true,
            soundEnabled: true,
            vibrationEnabled: true,
            showInApp: true,
            intervals: [
                { id: '20min', minutes: 20, enabled: true },
                { id: '10min', minutes: 10, enabled: true },
                { id: '5min', minutes: 5, enabled: true },
                { id: '2min', minutes: 2, enabled: true },
                { id: 'due', minutes: 0, enabled: true }
            ]
        };
        
        // Load settings from localStorage
        this.loadSettings();
        
        // Bind methods
        this.handleServiceWorkerMessage = this.handleServiceWorkerMessage.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
    }
    
    // Initialize the notification system
    async initialize() {
        try {
            console.log('Task Rock Notifications: Initializing...');
            
            // Register service worker
            await this.registerServiceWorker();
            
            // Request notification permission
            await this.requestPermission();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize notification UI
            this.initializeNotificationUI();
            
            this.isInitialized = true;
            console.log('Task Rock Notifications: Initialization complete');
            
            return true;
        } catch (error) {
            console.error('Task Rock Notifications: Initialization failed:', error);
            return false;
        }
    }
    
    // Register service worker
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('./task-rock-notifications-sw.js');
                console.log('Task Rock Notifications: Service worker registered');
                
                // Wait for service worker to be ready
                this.serviceWorker = await navigator.serviceWorker.ready;
                
                return registration;
            } catch (error) {
                console.error('Task Rock Notifications: Service worker registration failed:', error);
                throw error;
            }
        } else {
            throw new Error('Service workers not supported');
        }
    }
    
    // Request notification permission
    async requestPermission() {
        if ('Notification' in window) {
            this.notificationPermission = await Notification.requestPermission();
            console.log('Task Rock Notifications: Permission status:', this.notificationPermission);
            return this.notificationPermission;
        } else {
            console.warn('Task Rock Notifications: Notifications not supported');
            return 'denied';
        }
    }
    
    // Set up event listeners
    setupEventListeners() {
        // Service worker messages
        if (navigator.serviceWorker) {
            navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage);
        }
        
        // Page visibility changes
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Before page unload
        window.addEventListener('beforeunload', this.handleBeforeUnload);
        
        // URL parameter handling (for notification clicks)
        this.handleURLParameters();
    }
    
    // Handle service worker messages
    handleServiceWorkerMessage(event) {
        const { type, taskId, action, source } = event.data || {};
        
        console.log('Task Rock Notifications: Service worker message:', event.data);
        
        switch (type) {
            case 'COMPLETE_TASK_FROM_NOTIFICATION':
                this.handleTaskCompletionFromNotification(taskId);
                break;
                
            case 'SNOOZE_TASK_FROM_NOTIFICATION':
                this.handleTaskSnoozeFromNotification(taskId, event.data.minutes);
                break;
                
            case 'NOTIFICATION_CLICKED':
                this.handleNotificationClick(taskId, action);
                break;
                
            case 'NOTIFICATION_SHOWN':
                this.handleNotificationShown(taskId, event.data.type, event.data.urgency);
                break;
        }
    }
    
    // Handle page visibility changes
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // Page became visible, process any queued notifications
            this.processNotificationQueue();
        }
    }
    
    // Handle before page unload
    handleBeforeUnload() {
        // Save any pending state
        this.saveSettings();
    }
    
    // Handle URL parameters (from notification clicks)
    handleURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const taskId = urlParams.get('taskId');
        
        if (action && taskId) {
            setTimeout(() => {
                this.handleNotificationClick(taskId, action);
                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }, 1000);
        }
    }
    
    // Schedule notifications for a task
    async scheduleTaskNotifications(task) {
        if (!this.isInitialized || !this.settings.enabled) {
            return false;
        }
        
        try {
            const dueTime = new Date(task.dueDate).getTime();
            const now = Date.now();
            
            // Only schedule for future tasks
            if (dueTime <= now) {
                console.log('Task Rock Notifications: Task is already due, not scheduling');
                return false;
            }
            
            // Get enabled intervals
            const enabledIntervals = this.settings.intervals.filter(interval => interval.enabled);
            
            // Send to service worker for background scheduling
            if (this.serviceWorker) {
                this.serviceWorker.postMessage({
                    type: 'SCHEDULE_TASK_NOTIFICATIONS',
                    data: {
                        task: task,
                        intervals: enabledIntervals
                    }
                });
            }
            
            // Schedule foreground notifications for when app is active
            this.scheduleForegroundNotifications(task, enabledIntervals);
            
            console.log('Task Rock Notifications: Scheduled notifications for task:', task.title);
            return true;
            
        } catch (error) {
            console.error('Task Rock Notifications: Error scheduling notifications:', error);
            return false;
        }
    }
    
    // Schedule foreground notifications
    scheduleForegroundNotifications(task, intervals) {
        const dueTime = new Date(task.dueDate).getTime();
        const now = Date.now();
        
        intervals.forEach(interval => {
            const notificationTime = dueTime - (interval.minutes * 60 * 1000);
            const delay = notificationTime - now;
            
            if (delay > 0) {
                setTimeout(() => {
                    if (document.visibilityState === 'visible') {
                        this.showForegroundNotification(task, interval);
                    }
                }, delay);
            }
        });
    }
    
    // Show foreground notification
    showForegroundNotification(task, interval) {
        if (!this.settings.showInApp) {
            return;
        }
        
        const notification = {
            id: `fg-${task.id}-${interval.id}-${Date.now()}`,
            taskId: task.id,
            title: `${interval.minutes > 0 ? interval.minutes + ' Minutes Left!' : 'Task Due Now!'}`,
            body: `"${task.title}" ${interval.minutes > 0 ? 'is due in ' + interval.minutes + ' minutes' : 'is due now'}!`,
            type: `task_due_${interval.id}`,
            urgency: this.getUrgencyLevel(interval.minutes),
            minutesLeft: interval.minutes,
            task: task
        };
        
        // Show in-app notification
        this.displayInAppNotification(notification);
        
        // Play sound if enabled
        if (this.settings.soundEnabled) {
            this.playNotificationSound(notification.urgency);
        }
        
        // Vibrate if enabled and supported
        if (this.settings.vibrationEnabled && 'vibrate' in navigator) {
            navigator.vibrate(this.getVibrationPattern(notification.urgency));
        }
        
        // Trigger Jerry's response
        if (window.triggerJerryResponse) {
            setTimeout(() => {
                window.triggerJerryResponse('task_reminder', {
                    task: task,
                    minutesLeft: interval.minutes,
                    urgency: notification.urgency
                });
            }, 500);
        }
    }
    
    // Display in-app notification
    displayInAppNotification(notification) {
        const container = this.getNotificationContainer();
        
        const notificationElement = document.createElement('div');
        notificationElement.className = 'task-rock-notification';
        notificationElement.dataset.notificationId = notification.id;
        
        notificationElement.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">
                    <img src="./assets/images/jerry.png" alt="Jerry" />
                </div>
                <div class="notification-text">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-body">${notification.body}</div>
                </div>
                <div class="notification-actions">
                    <button class="notification-action complete" data-action="complete">
                        ✅ Complete
                    </button>
                    ${notification.minutesLeft > 0 ? `
                        <button class="notification-action snooze" data-action="snooze">
                            ⏰ Snooze 5min
                        </button>
                    ` : ''}
                    <button class="notification-action view" data-action="view">
                        👀 View
                    </button>
                    <button class="notification-close" data-action="close">
                        ×
                    </button>
                </div>
            </div>
        `;
        
        // Add event listeners
        notificationElement.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action) {
                this.handleInAppNotificationAction(notification, action);
            }
        });
        
        // Add to container
        container.appendChild(notificationElement);
        
        // Store reference
        this.activeNotifications.set(notification.id, {
            element: notificationElement,
            notification: notification,
            timestamp: Date.now()
        });
        
        // Auto-remove after delay
        setTimeout(() => {
            this.removeInAppNotification(notification.id);
        }, this.getNotificationDisplayTime(notification.urgency));
        
        // Animate in
        requestAnimationFrame(() => {
            notificationElement.classList.add('show');
        });
    }
    
    // Handle in-app notification actions
    handleInAppNotificationAction(notification, action) {
        switch (action) {
            case 'complete':
                this.completeTaskFromNotification(notification.taskId);
                break;
                
            case 'snooze':
                this.snoozeTaskFromNotification(notification.taskId, 5);
                break;
                
            case 'view':
                this.viewTaskFromNotification(notification.taskId);
                break;
                
            case 'close':
                this.removeInAppNotification(notification.id);
                break;
        }
    }
    
    // Remove in-app notification
    removeInAppNotification(notificationId) {
        const notificationData = this.activeNotifications.get(notificationId);
        if (notificationData) {
            const element = notificationData.element;
            element.classList.add('hide');
            
            setTimeout(() => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                this.activeNotifications.delete(notificationId);
            }, 300);
        }
    }
    
    // Get or create notification container
    getNotificationContainer() {
        let container = document.getElementById('task-rock-notifications');
        if (!container) {
            container = document.createElement('div');
            container.id = 'task-rock-notifications';
            document.body.appendChild(container);
        }
        return container;
    }
    
    // Initialize notification UI styles
    initializeNotificationUI() {
        if (document.getElementById('task-rock-notification-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'task-rock-notification-styles';
        style.textContent = `
            #task-rock-notifications {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
            }
            
            .task-rock-notification {
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                margin-bottom: 12px;
                max-width: 350px;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease-out;
                pointer-events: auto;
                border-left: 4px solid #9AE34A;
            }
            
            .task-rock-notification.show {
                opacity: 1;
                transform: translateX(0);
            }
            
            .task-rock-notification.hide {
                opacity: 0;
                transform: translateX(100%);
            }
            
            .notification-content {
                padding: 16px;
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }
            
            .notification-icon img {
                width: 40px;
                height: 40px;
                border-radius: 50%;
            }
            
            .notification-text {
                flex: 1;
                min-width: 0;
            }
            
            .notification-title {
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 4px;
                color: #333;
            }
            
            .notification-body {
                font-size: 13px;
                color: #666;
                line-height: 1.4;
                margin-bottom: 12px;
            }
            
            .notification-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            
            .notification-action {
                background: #9AE34A;
                border: none;
                border-radius: 6px;
                padding: 6px 12px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            
            .notification-action:hover {
                background: #8BD63F;
            }
            
            .notification-action.complete {
                background: #4CAF50;
                color: white;
            }
            
            .notification-action.complete:hover {
                background: #45a049;
            }
            
            .notification-action.snooze {
                background: #FF9800;
                color: white;
            }
            
            .notification-action.snooze:hover {
                background: #F57C00;
            }
            
            .notification-close {
                position: absolute;
                top: 8px;
                right: 8px;
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #999;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background-color 0.2s;
            }
            
            .notification-close:hover {
                background: #f0f0f0;
                color: #666;
            }
            
            /* Responsive design */
            @media (max-width: 480px) {
                #task-rock-notifications {
                    left: 10px;
                    right: 10px;
                    top: 10px;
                }
                
                .task-rock-notification {
                    max-width: none;
                    transform: translateY(-100%);
                }
                
                .task-rock-notification.show {
                    transform: translateY(0);
                }
                
                .task-rock-notification.hide {
                    transform: translateY(-100%);
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Cancel notifications for a task
    async cancelTaskNotifications(taskId) {
        try {
            // Cancel service worker notifications
            if (this.serviceWorker) {
                this.serviceWorker.postMessage({
                    type: 'CANCEL_TASK_NOTIFICATIONS',
                    data: { taskId: taskId }
                });
            }
            
            // Remove any active in-app notifications for this task
            for (const [notificationId, notificationData] of this.activeNotifications) {
                if (notificationData.notification.taskId === taskId) {
                    this.removeInAppNotification(notificationId);
                }
            }
            
            console.log('Task Rock Notifications: Cancelled notifications for task:', taskId);
            return true;
            
        } catch (error) {
            console.error('Task Rock Notifications: Error cancelling notifications:', error);
            return false;
        }
    }
    
    // Update notifications for a task
    async updateTaskNotifications(task) {
        try {
            // Cancel existing notifications
            await this.cancelTaskNotifications(task.id);
            
            // Schedule new notifications
            await this.scheduleTaskNotifications(task);
            
            console.log('Task Rock Notifications: Updated notifications for task:', task.title);
            return true;
            
        } catch (error) {
            console.error('Task Rock Notifications: Error updating notifications:', error);
            return false;
        }
    }
    
    // Handle task completion from notification
    handleTaskCompletionFromNotification(taskId) {
        if (window.completeTask && typeof window.completeTask === 'function') {
            window.completeTask(taskId);
            
            // Show Jerry's celebration
            if (window.showJerryDialog) {
                const task = window.gameState?.tasks?.find(t => t.id === taskId);
                const taskTitle = task ? task.title : 'the task';
                window.showJerryDialog(`Awesome! You completed "${taskTitle}" from the notification! 🎉`);
            }
        }
    }
    
    // Handle task snooze from notification
    handleTaskSnoozeFromNotification(taskId, minutes) {
        // For now, just show a message - could implement actual snooze logic
        if (window.showJerryDialog) {
            window.showJerryDialog(`Task snoozed for ${minutes} minutes. I'll remind you again soon! 😴`);
        }
    }
    
    // Handle notification click
    handleNotificationClick(taskId, action) {
        switch (action) {
            case 'complete':
                this.completeTaskFromNotification(taskId);
                break;
            case 'view':
                this.viewTaskFromNotification(taskId);
                break;
            default:
                this.viewTaskFromNotification(taskId);
        }
    }
    
    // Handle notification shown
    handleNotificationShown(taskId, type, urgency) {
        // Could trigger Jerry reactions or other UI updates
        console.log('Task Rock Notifications: Notification shown for task:', taskId);
    }
    
    // Complete task from notification
    completeTaskFromNotification(taskId) {
        this.handleTaskCompletionFromNotification(taskId);
        
        // Remove related notifications
        this.cancelTaskNotifications(taskId);
    }
    
    // Snooze task from notification
    snoozeTaskFromNotification(taskId, minutes) {
        this.handleTaskSnoozeFromNotification(taskId, minutes);
        
        // Could implement actual snooze logic here
    }
    
    // View task from notification
    viewTaskFromNotification(taskId) {
        // Focus on the task in the UI
        if (window.focusTask && typeof window.focusTask === 'function') {
            window.focusTask(taskId);
        } else {
            // Fallback: show tasks section
            const tasksSection = document.querySelector('[data-section="tasks"]');
            if (tasksSection) {
                tasksSection.click();
            }
        }
        
        // Show Jerry's message
        if (window.showJerryDialog) {
            window.showJerryDialog("Here's your task! Let's get it done! 💪");
        }
    }
    
    // Process notification queue
    processNotificationQueue() {
        while (this.notificationQueue.length > 0) {
            const notification = this.notificationQueue.shift();
            this.displayInAppNotification(notification);
        }
    }
    
    // Utility methods
    getUrgencyLevel(minutes) {
        if (minutes <= 2) return 'urgent';
        if (minutes <= 5) return 'high';
        if (minutes <= 10) return 'medium';
        return 'low';
    }
    
    getVibrationPattern(urgency) {
        switch (urgency) {
            case 'urgent': return [200, 100, 200, 100, 200];
            case 'high': return [200, 100, 200];
            case 'medium': return [200];
            default: return [100];
        }
    }
    
    getNotificationDisplayTime(urgency) {
        switch (urgency) {
            case 'urgent': return 10000; // 10 seconds
            case 'high': return 8000;    // 8 seconds
            case 'medium': return 6000;  // 6 seconds
            default: return 5000;        // 5 seconds
        }
    }
    
    playNotificationSound(urgency) {
        // Simple beep sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Different frequencies for different urgencies
            const frequency = urgency === 'urgent' ? 800 : 
                            urgency === 'high' ? 600 : 400;
            
            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (error) {
            console.log('Task Rock Notifications: Could not play sound:', error);
        }
    }
    
    // Settings management
    loadSettings() {
        try {
            const saved = localStorage.getItem('taskRockNotificationSettings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.error('Task Rock Notifications: Error loading settings:', error);
        }
    }
    
    saveSettings() {
        try {
            localStorage.setItem('taskRockNotificationSettings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Task Rock Notifications: Error saving settings:', error);
        }
    }
    
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
    }
    
    // Get notification status
    async getNotificationStatus() {
        if (!this.serviceWorker) {
            return { error: 'Service worker not available' };
        }
        
        return new Promise((resolve) => {
            const channel = new MessageChannel();
            
            channel.port1.onmessage = (event) => {
                resolve(event.data);
            };
            
            this.serviceWorker.postMessage({
                type: 'GET_NOTIFICATION_STATUS'
            }, [channel.port2]);
            
            // Timeout after 5 seconds
            setTimeout(() => {
                resolve({ error: 'Timeout' });
            }, 5000);
        });
    }
    
    // Check if notifications are supported and enabled
    isSupported() {
        return 'Notification' in window && 'serviceWorker' in navigator;
    }
    
    isEnabled() {
        return this.settings.enabled && this.notificationPermission === 'granted';
    }
    
    // Get permission status
    getPermissionStatus() {
        return this.notificationPermission;
    }
}

// Create global instance
window.TaskRockNotifications = new TaskRockNotifications();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.TaskRockNotifications.initialize();
    });
} else {
    window.TaskRockNotifications.initialize();
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskRockNotifications;
}

