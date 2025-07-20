// Firebase Configuration for Task Rock
// This file contains the Firebase configuration and initialization

// Import Firebase modules
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Firebase configuration object
// Your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyCVgC9WK1aurAOwWSsdT0cgg4PMJlhC_ms",
  authDomain: "taskrock-8a79f.firebaseapp.com",
  projectId: "taskrock-8a79f",
  storageBucket: "taskrock-8a79f.firebasestorage.app",
  messagingSenderId: "658045532672",
  appId: "1:658045532672:web:eccfd961a83669179eb6e5",
  measurementId: "G-1KPM30D893"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging and get a reference to the service
const messaging = getMessaging(app);

// VAPID key for web push notifications
// Your actual VAPID key from Firebase Console
const vapidKey = "BNG-BEKcNnw28UVOCxs22MZas2_R0iw5PVxBYAi57329eYJYzSG3iHO4rJRwIE-OOZmpE8YtbcmrRAiO5S0fUzk";

// Function to request notification permission and get FCM token
export async function initializeFirebaseMessaging() {
  try {
    console.log('Task Rock: Initializing Firebase messaging...');
    
    // Request notification permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('Task Rock: Notification permission granted');
      
      // Get FCM token
      const token = await getToken(messaging, { vapidKey });
      
      if (token) {
        console.log('Task Rock: FCM token received:', token);
        
        // Store token in localStorage for later use
        localStorage.setItem('fcm_token', token);
        
        // Send token to your server (if you have one)
        // await sendTokenToServer(token);
        
        return token;
      } else {
        console.log('Task Rock: No registration token available');
        return null;
      }
    } else {
      console.log('Task Rock: Notification permission denied');
      return null;
    }
  } catch (error) {
    console.error('Task Rock: Error initializing Firebase messaging:', error);
    return null;
  }
}

// Function to handle foreground messages
export function setupForegroundMessageHandler() {
  onMessage(messaging, (payload) => {
    console.log('Task Rock: Foreground message received:', payload);
    
    // Extract notification data
    const { title, body, icon } = payload.notification || {};
    const data = payload.data || {};
    
    // Show custom notification or update UI
    if (title && body) {
      showCustomNotification(title, body, icon, data);
    }
    
    // Trigger Jerry's response to the notification
    if (window.triggerJerryResponse) {
      setTimeout(() => {
        window.triggerJerryResponse('notification', { title, body, data });
      }, 1000);
    }
  });
}

// Function to show custom notification in the app
function showCustomNotification(title, body, icon, data) {
  // Create a custom notification element
  const notification = document.createElement('div');
  notification.className = 'firebase-notification';
  notification.innerHTML = `
    <div class="notification-content">
      <div class="notification-icon">
        <img src="${icon || './assets/images/jerry.png'}" alt="Notification" />
      </div>
      <div class="notification-text">
        <div class="notification-title">${title}</div>
        <div class="notification-body">${body}</div>
      </div>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;
  
  // Add styles
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 16px;
    max-width: 300px;
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;
  
  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .firebase-notification .notification-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .firebase-notification .notification-icon img {
      width: 40px;
      height: 40px;
      border-radius: 50%;
    }
    .firebase-notification .notification-text {
      flex: 1;
    }
    .firebase-notification .notification-title {
      font-weight: 600;
      margin-bottom: 4px;
    }
    .firebase-notification .notification-body {
      font-size: 14px;
      color: #666;
    }
    .firebase-notification .notification-close {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #999;
    }
  `;
  
  if (!document.querySelector('#firebase-notification-styles')) {
    style.id = 'firebase-notification-styles';
    document.head.appendChild(style);
  }
  
  // Add to page
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

// Function to send token to server (placeholder)
async function sendTokenToServer(token) {
  try {
    // Replace with your server endpoint
    const response = await fetch('/api/fcm-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
    
    if (response.ok) {
      console.log('Task Rock: FCM token sent to server successfully');
    } else {
      console.error('Task Rock: Failed to send FCM token to server');
    }
  } catch (error) {
    console.error('Task Rock: Error sending FCM token to server:', error);
  }
}

// Function to schedule notifications for tasks
export function scheduleTaskNotifications(tasks) {
  // This function would typically send task data to your server
  // which would then schedule Firebase notifications
  
  console.log('Task Rock: Scheduling notifications for tasks:', tasks);
  
  // For now, we'll use local scheduling with enhanced timing
  tasks.forEach(task => {
    if (task.dueDate) {
      scheduleLocalNotifications(task);
    }
  });
}

// Function to schedule local notifications with Firebase integration
function scheduleLocalNotifications(task) {
  const dueTime = new Date(task.dueDate).getTime();
  const now = Date.now();
  
  // Notification intervals: 20, 15, 10, 5, 2 minutes before due time
  const intervals = [
    { minutes: 20, id: '20min' },
    { minutes: 15, id: '15min' },
    { minutes: 10, id: '10min' },
    { minutes: 5, id: '5min' },
    { minutes: 2, id: '2min' }
  ];
  
  intervals.forEach(interval => {
    const notificationTime = dueTime - (interval.minutes * 60 * 1000);
    const timeUntilNotification = notificationTime - now;
    
    if (timeUntilNotification > 0) {
      setTimeout(() => {
        sendLocalTaskNotification(task, interval);
      }, timeUntilNotification);
    }
  });
}

// Function to send local task notification
function sendLocalTaskNotification(task, interval) {
  const title = `Task Rock - ${interval.minutes} Minutes Left!`;
  const body = `"${task.title}" is due in ${interval.minutes} minutes! ${getMotivationalMessage(interval.minutes)}`;
  
  // Send via service worker for better reliability
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, {
        body: body,
        icon: './assets/images/jerry.png',
        badge: './assets/images/logo.png',
        tag: `task_${task.id}_${interval.id}`,
        requireInteraction: interval.minutes <= 5, // Require interaction for urgent notifications
        vibrate: getVibrationPattern(interval.minutes),
        data: {
          taskId: task.id,
          type: `task_due_${interval.id}`,
          dueTime: task.dueDate,
          interval: interval.id,
          timestamp: Date.now()
        },
        actions: [
          {
            action: 'complete',
            title: 'Mark Complete',
            icon: './assets/images/jerry.png'
          },
          {
            action: 'snooze',
            title: 'Snooze 5min',
            icon: './assets/images/logo.png'
          }
        ]
      });
    });
  }
}

// Function to get motivational message based on time remaining
function getMotivationalMessage(minutes) {
  if (minutes >= 15) {
    return "Time to get started! 🗿";
  } else if (minutes >= 10) {
    return "Let's make progress! 💪";
  } else if (minutes >= 5) {
    return "Crunch time! You've got this! 🔥";
  } else {
    return "Final push! Jerry believes in you! 🚨";
  }
}

// Function to get vibration pattern based on urgency
function getVibrationPattern(minutes) {
  if (minutes <= 2) {
    return [200, 100, 200, 100, 200]; // Urgent pattern
  } else if (minutes <= 5) {
    return [200, 100, 200]; // Important pattern
  } else {
    return [200]; // Standard pattern
  }
}

// Export messaging instance for use in other files
export { messaging };

