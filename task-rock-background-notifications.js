// Task Rock Background Notification System
// Handles both foreground and true background notifications

class TaskRockBackgroundNotifications {
    constructor() {
        this.serviceWorker = null;
        this.notificationPermission = 'default';
        this.isInitialized = false;
        this.activeNotifications = new Map();
        this.settings = {
            enabled: true,
            backgroundEnabled: true,
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
        
        this.loadSettings();
        this.handleServiceWorkerMessage = this.handleServiceWorkerMessage.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    }
    
    // Initialize the background notification system
    async initialize() {
        try {
            console.log('Task Rock Background Notifications: Initializing...');
            
            // Register service worker
            await this.registerServiceWorker();
            
            // Request notification permission
            await this.requestPermission();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize notification UI
            this.initializeNotificationUI();
            
            this.isInitialized = true;
            console.log('Task Rock Background Notifications: Initialization complete');
            
            return true;
        } catch (error) {
            console.error('Task Rock Background Notifications: Initialization failed:', error);
            return false;
        }
    }
    
    // Register service worker for background notifications
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('./task-rock-background-notifications-sw.js');
                console.log('Task Rock Background Notifications: Service worker registered');
                
                // Wait for service worker to be ready
                this.serviceWorker = await navigator.serviceWorker.ready;
                
                return registration;
            } catch (error) {
                console.error('Task Rock Background Notifications: Service worker registration failed:', error);
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
            console.log('Task Rock Background Notifications: Permission status:', this.notificationPermission);
            
            if (this.notificationPermission === 'granted') {
                console.log('Task Rock Background Notifications: Permission granted - background notifications enabled');
            } else {
                console.warn('Task Rock Background Notifications: Permission denied - only in-app notifications available');
            }
            
            return this.notificationPermission;
        } else {
            console.warn('Task Rock Background Notifications: Notifications not supported');
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
        
        // URL parameter handling (for notification clicks)
        this.handleURLParameters();
    }
    
    // Handle service worker messages
    handleServiceWorkerMessage(event) {
        const { type, taskId, notificationId, snoozeMinutes } = event.data || {};
        
        console.log('Task Rock Background Notifications: Service worker message:', event.data);
        
        switch (type) {
            case 'COMPLETE_TASK_FROM_BACKGROUND_NOTIFICATION':
                this.handleTaskCompletionFromBackgroundNotification(taskId, notificationId);
                break;
                
            case 'SNOOZE_TASK_FROM_BACKGROUND_NOTIFICATION':
                this.handleTaskSnoozeFromBackgroundNotification(taskId, notificationId, snoozeMinutes);
                break;
                
            case 'VIEW_TASK_FROM_BACKGROUND_NOTIFICATION':
                this.handleViewTaskFromBackgroundNotification(taskId, notificationId);
                break;
        }
    }
    
    // Handle task completion from background notification
    handleTaskCompletionFromBackgroundNotification(taskId, notificationId) {
        try {
            // Find and complete the task
            const task = this.findTaskById(taskId);
            if (task) {
                // Complete the task using existing game logic
                if (window.completeTask) {
                    window.completeTask(taskId);
                    console.log('Task Rock Background Notifications: Task completed from background notification:', task.title);
                    
                    // Show success feedback
                    this.showCompletionFeedback(task);
                } else {
                    console.error('Task Rock Background Notifications: completeTask function not available');
                }
            } else {
                console.error('Task Rock Background Notifications: Task not found:', taskId);
            }
        } catch (error) {
            console.error('Task Rock Background Notifications: Error completing task from background:', error);
        }
    }
    
    // Handle task snooze from background notification
    handleTaskSnoozeFromBackgroundNotification(taskId, notificationId, snoozeMinutes) {
        try {
            const task = this.findTaskById(taskId);
            if (task) {
                // Create new due date with snooze time
                const currentDueDate = new Date(task.dueDate);
                const newDueDate = new Date(currentDueDate.getTime() + (snoozeMinutes * 60 * 1000));
                
                // Update task due date
                task.dueDate = newDueDate.toISOString();
                
                // Save updated task
                if (window.saveGameState) {
                    window.saveGameState();
                }
                
                // Schedule new notifications for snoozed task
                this.scheduleNotificationsForTask(task);
                
                console.log('Task Rock Background Notifications: Task snoozed for', snoozeMinutes, 'minutes:', task.title);
                
                // Show snooze feedback
                this.showSnoozeFeedback(task, snoozeMinutes);
            } else {
                console.error('Task Rock Background Notifications: Task not found for snooze:', taskId);
            }
        } catch (error) {
            console.error('Task Rock Background Notifications: Error snoozing task from background:', error);
        }
    }
    
    // Handle view task from background notification
    handleViewTaskFromBackgroundNotification(taskId, notificationId) {
        try {
            // Focus the app and navigate to the task
            window.focus();
            
            // Open tasks section if available
            if (window.openTasksSection) {
                window.openTasksSection();
            }
            
            // Highlight the specific task
            this.highlightTask(taskId);
            
            console.log('Task Rock Background Notifications: Task viewed from background notification:', taskId);
            
        } catch (error) {
            console.error('Task Rock Background Notifications: Error viewing task from background:', error);
        }
    }
    
    // Find task by ID
    findTaskById(taskId) {
        if (window.gameState && window.gameState.tasks) {
            return window.gameState.tasks.find(task => task.id === taskId);
        }
        return null;
    }
    
    // Schedule notifications for a task
    async scheduleNotificationsForTask(task) {
        if (!this.isInitialized || !task.dueDate) {
            return false;
        }
        
        try {
            const dueTime = new Date(task.dueDate).getTime();
            const now = Date.now();
            
            if (dueTime <= now) {
                console.log('Task Rock Background Notifications: Task is already due, not scheduling notifications');
                return false;
            }
            
            // Get enabled intervals
            const enabledIntervals = this.settings.intervals.filter(interval => interval.enabled);
            
            // Cancel any existing notifications for this task
            await this.cancelNotificationsForTask(task.id);
            
            // Schedule background notifications via service worker
            if (this.notificationPermission === 'granted' && this.settings.backgroundEnabled) {
                await this.scheduleBackgroundNotifications(task, enabledIntervals);
            }
            
            // Schedule foreground notifications as backup
            if (this.settings.showInApp) {
                this.scheduleForegroundNotifications(task, enabledIntervals);
            }
            
            console.log('Task Rock Background Notifications: Notifications scheduled for task:', task.title);
            return true;
            
        } catch (error) {
            console.error('Task Rock Background Notifications: Error scheduling notifications:', error);
            return false;
        }
    }
    
    // Schedule background notifications via service worker
    async scheduleBackgroundNotifications(task, intervals) {
        try {
            if (this.serviceWorker && this.serviceWorker.active) {
                this.serviceWorker.active.postMessage({
                    type: 'SCHEDULE_BACKGROUND_NOTIFICATIONS',
                    data: {
                        task: task,
                        intervals: intervals
                    }
                });
                
                console.log('Task Rock Background Notifications: Background notifications scheduled via service worker');
            } else {
                console.warn('Task Rock Background Notifications: Service worker not available for background scheduling');
            }
        } catch (error) {
            console.error('Task Rock Background Notifications: Error scheduling background notifications:', error);
        }
    }
    
    // Schedule foreground notifications (backup for when app is open)
    scheduleForegroundNotifications(task, intervals) {
        const dueTime = new Date(task.dueDate).getTime();
        const now = Date.now();
        
        intervals.forEach(interval => {
            const notificationTime = dueTime - (interval.minutes * 60 * 1000);
            const delay = notificationTime - now;
            
            if (delay > 0) {
                setTimeout(() => {
                    // Only show foreground notification if page is visible and background notifications are disabled
                    if (document.visibilityState === 'visible' && 
                        (this.notificationPermission !== 'granted' || !this.settings.backgroundEnabled)) {
                        this.showForegroundNotification(task, interval);
                    }
                }, delay);
            }
        });
    }
    
    // Show foreground notification (in-app)
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
    
    // Cancel notifications for a task
    async cancelNotificationsForTask(taskId) {
        try {
            // Cancel background notifications via service worker
            if (this.serviceWorker && this.serviceWorker.active) {
                this.serviceWorker.active.postMessage({
                    type: 'CANCEL_TASK_NOTIFICATIONS',
                    data: { taskId: taskId }
                });
            }
            
            // Cancel any active foreground notifications
            this.activeNotifications.forEach((notification, id) => {
                if (notification.taskId === taskId) {
                    this.dismissNotification(id);
                }
            });
            
            console.log('Task Rock Background Notifications: Notifications cancelled for task:', taskId);
            
        } catch (error) {
            console.error('Task Rock Background Notifications: Error cancelling notifications:', error);
        }
    }
    
    // Display in-app notification
    displayInAppNotification(notification) {
        const container = this.getNotificationContainer();
        
        const notificationElement = document.createElement('div');
        notificationElement.className = 'task-rock-notification background-enabled';
        notificationElement.dataset.notificationId = notification.id;
        
        notificationElement.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">
                    <img src="./assets/images/jerry.png" alt="Jerry" />
                </div>
                <div class="notification-text">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-body">${notification.body}</div>
                    <div class="notification-subtitle">Background notifications are active</div>
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
        this.addNotificationEventListeners(notificationElement, notification);
        
        // Add to container
        container.appendChild(notificationElement);
        
        // Store reference
        this.activeNotifications.set(notification.id, notification);
        
        // Auto-dismiss after delay
        setTimeout(() => {
            this.dismissNotification(notification.id);
        }, 10000); // 10 seconds
        
        // Animate in
        requestAnimationFrame(() => {
            notificationElement.classList.add('show');
        });
    }
    
    // Get notification container
    getNotificationContainer() {
        let container = document.getElementById('task-rock-notifications');
        if (!container) {
            container = document.createElement('div');
            container.id = 'task-rock-notifications';
            container.className = 'task-rock-notifications-container';
            document.body.appendChild(container);
        }
        return container;
    }
    
    // Add notification event listeners
    addNotificationEventListeners(element, notification) {
        element.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action) {
                e.preventDefault();
                e.stopPropagation();
                
                switch (action) {
                    case 'complete':
                        this.handleTaskCompletionFromBackgroundNotification(notification.taskId, notification.id);
                        this.dismissNotification(notification.id);
                        break;
                        
                    case 'snooze':
                        this.handleTaskSnoozeFromBackgroundNotification(notification.taskId, notification.id, 5);
                        this.dismissNotification(notification.id);
                        break;
                        
                    case 'view':
                        this.handleViewTaskFromBackgroundNotification(notification.taskId, notification.id);
                        this.dismissNotification(notification.id);
                        break;
                        
                    case 'close':
                        this.dismissNotification(notification.id);
                        break;
                }
            }
        });
    }
    
    // Dismiss notification
    dismissNotification(notificationId) {
        const element = document.querySelector(`[data-notification-id="${notificationId}"]`);
        if (element) {
            element.classList.add('hide');
            setTimeout(() => {
                element.remove();
            }, 300);
        }
        
        this.activeNotifications.delete(notificationId);
    }
    
    // Show completion feedback
    showCompletionFeedback(task) {
        const feedback = {
            id: `completion-${task.id}-${Date.now()}`,
            title: '🎉 Task Completed!',
            body: `Great job completing "${task.title}"!`,
            type: 'success'
        };
        
        this.displayInAppNotification(feedback);
    }
    
    // Show snooze feedback
    showSnoozeFeedback(task, minutes) {
        const feedback = {
            id: `snooze-${task.id}-${Date.now()}`,
            title: '⏰ Task Snoozed',
            body: `"${task.title}" snoozed for ${minutes} minutes`,
            type: 'info'
        };
        
        this.displayInAppNotification(feedback);
    }
    
    // Highlight task in UI
    highlightTask(taskId) {
        // Add visual highlight to the task in the UI
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskElement) {
            taskElement.classList.add('highlighted');
            taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            setTimeout(() => {
                taskElement.classList.remove('highlighted');
            }, 3000);
        }
    }
    
    // Get urgency level
    getUrgencyLevel(minutesLeft) {
        if (minutesLeft === 0) return 'critical';
        if (minutesLeft <= 2) return 'high';
        if (minutesLeft <= 5) return 'medium';
        return 'low';
    }
    
    // Get vibration pattern
    getVibrationPattern(urgency) {
        switch (urgency) {
            case 'critical': return [200, 100, 200, 100, 200];
            case 'high': return [150, 100, 150];
            case 'medium': return [100, 100, 100];
            default: return [100];
        }
    }
    
    // Play notification sound
    playNotificationSound(urgency) {
        // Create audio context for notification sounds
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Different frequencies for different urgencies
            const frequency = urgency === 'critical' ? 800 : urgency === 'high' ? 600 : 400;
            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            
        } catch (error) {
            console.log('Task Rock Background Notifications: Audio not available');
        }
    }
    
    // Handle URL parameters
    handleURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const taskId = urlParams.get('task');
        const notificationId = urlParams.get('notification');
        
        if (taskId && notificationId) {
            // Handle notification click from URL
            setTimeout(() => {
                this.handleViewTaskFromBackgroundNotification(taskId, notificationId);
            }, 1000);
        }
    }
    
    // Handle page visibility changes
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            console.log('Task Rock Background Notifications: Page became visible');
        }
    }
    
    // Initialize notification UI
    initializeNotificationUI() {
        // Add CSS styles for notifications
        this.addNotificationStyles();
    }
    
    // Add notification styles
    addNotificationStyles() {
        if (document.getElementById('task-rock-notification-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'task-rock-notification-styles';
        style.textContent = `
            .task-rock-notifications-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
                pointer-events: none;
            }
            
            .task-rock-notification {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                margin-bottom: 12px;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
                pointer-events: auto;
                border: 2px solid rgba(255,255,255,0.2);
            }
            
            .task-rock-notification.background-enabled {
                border-left: 4px solid #4CAF50;
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
                color: white;
            }
            
            .notification-icon img {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 2px solid rgba(255,255,255,0.3);
            }
            
            .notification-text {
                flex: 1;
                min-width: 0;
            }
            
            .notification-title {
                font-weight: bold;
                font-size: 16px;
                margin-bottom: 4px;
            }
            
            .notification-body {
                font-size: 14px;
                opacity: 0.9;
                margin-bottom: 4px;
            }
            
            .notification-subtitle {
                font-size: 12px;
                opacity: 0.7;
                font-style: italic;
            }
            
            .notification-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 12px;
            }
            
            .notification-action {
                background: rgba(255,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .notification-action:hover {
                background: rgba(255,255,255,0.3);
                transform: translateY(-1px);
            }
            
            .notification-close {
                position: absolute;
                top: 8px;
                right: 8px;
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .notification-close:hover {
                background: rgba(255,255,255,0.3);
            }
            
            @media (max-width: 480px) {
                .task-rock-notifications-container {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }
                
                .notification-actions {
                    flex-direction: column;
                }
                
                .notification-action {
                    text-align: center;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Load settings from localStorage
    loadSettings() {
        try {
            const saved = localStorage.getItem('taskRockBackgroundNotificationSettings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.error('Task Rock Background Notifications: Error loading settings:', error);
        }
    }
    
    // Save settings to localStorage
    saveSettings() {
        try {
            localStorage.setItem('taskRockBackgroundNotificationSettings', JSON.stringify(this.settings));
            
            // Update service worker settings
            if (this.serviceWorker && this.serviceWorker.active) {
                this.serviceWorker.active.postMessage({
                    type: 'UPDATE_NOTIFICATION_SETTINGS',
                    data: { settings: this.settings }
                });
            }
        } catch (error) {
            console.error('Task Rock Background Notifications: Error saving settings:', error);
        }
    }
    
    // Update settings
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
    }
    
    // Get current settings
    getSettings() {
        return { ...this.settings };
    }
}

// Global instance
window.TaskRockBackgroundNotifications = TaskRockBackgroundNotifications;

// Auto-initialize if not already done
if (!window.taskRockBackgroundNotifications) {
    window.taskRockBackgroundNotifications = new TaskRockBackgroundNotifications();
}

