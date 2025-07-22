// Test script to send push notifications
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

// Load VAPID keys
const vapidKeysPath = path.join(__dirname, 'push-server', 'vapid-keys.json');
const vapidKeys = JSON.parse(fs.readFileSync(vapidKeysPath, 'utf8'));

// Set VAPID details
webpush.setVapidDetails(
    'mailto:taskrock@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// Test subscription (you would get this from your app)
const testSubscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test',
    keys: {
        p256dh: 'test-key',
        auth: 'test-auth'
    }
};

// Test notification payload
const payload = JSON.stringify({
    title: 'Task Rock Test',
    body: 'This is a test notification from Task Rock!',
    icon: '/assets/images/jerry.png',
    badge: '/assets/images/logo.png',
    data: {
        url: '/',
        timestamp: Date.now()
    }
});

console.log('VAPID Public Key:', vapidKeys.publicKey);
console.log('Test payload:', payload);

// Function to send test notification
async function sendTestNotification(subscription) {
    try {
        const result = await webpush.sendNotification(subscription, payload);
        console.log('Test notification sent successfully:', result);
    } catch (error) {
        console.error('Error sending test notification:', error);
    }
}

// Export for use in other scripts
module.exports = {
    sendTestNotification,
    vapidKeys,
    payload
};

console.log('Test script loaded. Use sendTestNotification(subscription) to test.');

