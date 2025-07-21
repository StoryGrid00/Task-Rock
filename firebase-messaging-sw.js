// Firebase Messaging Service Worker for Task Rock
// This service worker handles background push notifications from Firebase

// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration (same as in firebase-config.js)
const firebaseConfig = {
  apiKey: "AIzaSyCVgC9WK1aurAOwWSsdT0cgg4PMJlhC_ms",
  authDomain: "taskrock-8a79f.firebaseapp.com",
  projectId: "taskrock-8a79f",
  storageBucket: "taskrock-8a79f.firebasestorage.app",
  messagingSenderId: "658045532672",
  appId: "1:658045532672:web:eccfd961a83669179eb6e5",
  measurementId: "G-1KPM30D893"
};

// Initialize Firebase in service worker
firebase.initializeApp(firebaseConfig);

// Get messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Task Rock Firebase SW: Background message received:', payload);

  // Extract notification data
  const notificationTitle = payload.notification?.title || 'Task Rock Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'Jerry needs your attention!',
    icon: payload.notification?.icon || './assets/images/jerry.png',
    badge: './assets/images/logo.png',
    tag: payload.data?.tag || 'task-rock-notification',
    requireInteraction: payload.data?.requireInteraction === 'true',
    vibrate: getVibrationPattern(payload.data?.urgency || 'normal'),
    silent: false,
    data: {
      ...payload.data,
      timestamp: Date.now(),
      source: 'firebase'
    },
    actions: [
      {
        action: 'complete',
        title: 'Mark Complete',
        icon: './assets/images/jerry.png'
      },
      {
        action: 'view',
        title: 'View Task',
        icon: './assets/images/logo.png'
      },
      {
        action: 'snooze',
        title: 'Snooze 5min',
        icon: './assets/images/logo.png'
      }
    ]
  };

  // Show the notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Task Rock Firebase SW: Notification clicked:', event);
  
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  if (action === 'complete' && data.taskId) {
    // Handle task completion
    event.waitUntil(
      handleTaskCompletion(data.taskId)
    );
  } else if (action === 'snooze' && data.taskId) {
    // Handle snooze action
    event.waitUntil(
      handleTaskSnooze(data.taskId, 5) // Snooze for 5 minutes
    );
  } else {
    // Default action - open the app
    event.waitUntil(
      openTaskRockApp(data)
    );
  }
});

// Function to handle task completion from notification
async function handleTaskCompletion(taskId) {
  try {
    // Get all clients (open tabs/windows)
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    // Send message to main app to complete the task
    if (clients.length > 0) {
      clients[0].postMessage({
        type: 'COMPLETE_TASK_FROM_NOTIFICATION',
        taskId: taskId,
        source: 'firebase'
      });
      
      // Focus the existing window
      clients[0].focus();
    } else {
      // Open new window with completion action
      await self.clients.openWindow(`./index.html?action=complete-task&taskId=${taskId}`);
    }

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

  } catch (error) {
    console.error('Task Rock Firebase SW: Error completing task:', error);
  }
}

// Function to handle task snooze from notification
async function handleTaskSnooze(taskId, minutes) {
  try {
    // Get all clients
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    // Send message to main app to snooze the task
    if (clients.length > 0) {
      clients[0].postMessage({
        type: 'SNOOZE_TASK_FROM_NOTIFICATION',
        taskId: taskId,
        minutes: minutes,
        source: 'firebase'
      });
    }

    // Schedule a new notification for after the snooze period
    setTimeout(() => {
      self.registration.showNotification('Snooze Time Over! ⏰', {
        body: 'Your snoozed task is ready for attention!',
        icon: './assets/images/jerry.png',
        badge: './assets/images/logo.png',
        tag: `task-snooze-${taskId}`,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
        data: {
          taskId: taskId,
          type: 'snooze_reminder',
          timestamp: Date.now()
        }
      });
    }, minutes * 60 * 1000);

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
    console.error('Task Rock Firebase SW: Error snoozing task:', error);
  }
}

// Function to open Task Rock app
async function openTaskRockApp(data = {}) {
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
          data: data,
          source: 'firebase'
        });
        return client;
      }
    }

    // App is not open, open new window
    const url = data.taskId ? 
      `./index.html?action=view-task&taskId=${data.taskId}` : 
      './index.html';
    
    return await self.clients.openWindow(url);

  } catch (error) {
    console.error('Task Rock Firebase SW: Error opening app:', error);
  }
}

// Function to get vibration pattern based on urgency
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

// Handle push events (for additional Firebase functionality)
self.addEventListener('push', (event) => {
  console.log('Task Rock Firebase SW: Push event received:', event);
  
  if (event.data) {
    try {
      const data = event.data.json();
      
      // Handle custom push data if needed
      if (data.type === 'task_reminder') {
        event.waitUntil(
          handleTaskReminder(data)
        );
      }
    } catch (error) {
      console.error('Task Rock Firebase SW: Error parsing push data:', error);
    }
  }
});

// Function to handle custom task reminders
async function handleTaskReminder(data) {
  const { taskId, title, body, urgency, minutesLeft } = data;
  
  const notificationOptions = {
    body: body || `Task "${title}" needs attention!`,
    icon: './assets/images/jerry.png',
    badge: './assets/images/logo.png',
    tag: `task-reminder-${taskId}`,
    requireInteraction: urgency === 'urgent' || minutesLeft <= 5,
    vibrate: getVibrationPattern(urgency),
    data: {
      taskId,
      type: 'task_reminder',
      urgency,
      minutesLeft,
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'complete',
        title: 'Mark Complete',
        icon: './assets/images/jerry.png'
      },
      {
        action: 'view',
        title: 'View Task',
        icon: './assets/images/logo.png'
      }
    ]
  };

  return self.registration.showNotification(
    `Task Rock - ${minutesLeft} Minutes Left!`,
    notificationOptions
  );
}

// Message handler for communication with main app
self.addEventListener('message', (event) => {
  console.log('Task Rock Firebase SW: Message received:', event.data);
  
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    // Handle notification scheduling from main app
    const { task, interval } = event.data;
    scheduleTaskNotification(task, interval);
  }
});

// Function to schedule a task notification
function scheduleTaskNotification(task, interval) {
  const dueTime = new Date(task.dueDate).getTime();
  const notificationTime = dueTime - (interval.minutes * 60 * 1000);
  const delay = notificationTime - Date.now();
  
  if (delay > 0) {
    setTimeout(() => {
      const urgency = interval.minutes <= 5 ? 'urgent' : 
                    interval.minutes <= 10 ? 'high' : 'medium';
      
      handleTaskReminder({
        taskId: task.id,
        title: task.title,
        body: `"${task.title}" is due in ${interval.minutes} minutes!`,
        urgency: urgency,
        minutesLeft: interval.minutes
      });
    }, delay);
  }
}

console.log('Task Rock Firebase SW: Firebase messaging service worker loaded');

