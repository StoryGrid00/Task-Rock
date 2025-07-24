const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store subscriptions in memory (in production, use a database)
let subscriptions = [];

// VAPID keys file path
const vapidKeysPath = path.join(__dirname, 'vapid-keys.json');

// Generate or load VAPID keys
let vapidKeys;
if (fs.existsSync(vapidKeysPath)) {
    vapidKeys = JSON.parse(fs.readFileSync(vapidKeysPath, 'utf8'));
    console.log('Loaded existing VAPID keys');
} else {
    vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(vapidKeysPath, JSON.stringify(vapidKeys, null, 2));
    console.log('Generated new VAPID keys');
}

// Set VAPID details - correct API usage
webpush.setVapidDetails(
    'mailto:taskrock@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

console.log('VAPID Public Key:', vapidKeys.publicKey);

// Routes

// Get VAPID public key
app.get('/vapid-public-key', (req, res) => {
    res.json({
        publicKey: vapidKeys.publicKey
    });
});

// Subscribe endpoint
app.post('/subscribe', (req, res) => {
    const subscription = req.body;
    
    // Validate subscription
    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription' });
    }
    
    // Check if subscription already exists
    const existingIndex = subscriptions.findIndex(sub => sub.endpoint === subscription.endpoint);
    
    if (existingIndex !== -1) {
        // Update existing subscription
        subscriptions[existingIndex] = subscription;
        console.log('Updated existing subscription');
    } else {
        // Add new subscription
        subscriptions.push(subscription);
        console.log('Added new subscription');
    }
    
    console.log('Total subscriptions:', subscriptions.length);
    
    res.json({ success: true, message: 'Subscription saved' });
});

// Unsubscribe endpoint
app.post('/unsubscribe', (req, res) => {
    const { endpoint } = req.body;
    
    if (!endpoint) {
        return res.status(400).json({ error: 'Endpoint required' });
    }
    
    subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
    console.log('Removed subscription, total subscriptions:', subscriptions.length);
    
    res.json({ success: true, message: 'Subscription removed' });
});

// Send notification to all subscribers
app.post('/send-notification', async (req, res) => {
    const { title, body, icon, badge, tag, data } = req.body;
    
    if (subscriptions.length === 0) {
        return res.status(400).json({ error: 'No subscriptions available' });
    }
    
    const notificationPayload = JSON.stringify({
        title: title || 'Task Rock',
        body: body || 'You have task(s) to complete :)',
        icon: icon || '/assets/images/jerry.png',
        badge: badge || '/assets/images/logo.png',
        tag: tag || 'task-rock-notification',
        data: data || {
            url: '/',
            timestamp: Date.now()
        }
    });
    
    const promises = subscriptions.map(async (subscription) => {
        try {
            await webpush.sendNotification(subscription, notificationPayload);
            console.log('Notification sent successfully to:', subscription.endpoint.substring(0, 50) + '...');
            return { success: true, endpoint: subscription.endpoint };
        } catch (error) {
            console.error('Error sending notification to:', subscription.endpoint.substring(0, 50) + '...', error.message);
            
            // Remove invalid subscriptions
            if (error.statusCode === 410 || error.statusCode === 404) {
                subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
                console.log('Removed invalid subscription');
            }
            
            return { success: false, endpoint: subscription.endpoint, error: error.message };
        }
    });
    
    const results = await Promise.all(promises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    res.json({
        success: true,
        message: `Notifications sent: ${successful} successful, ${failed} failed`,
        results: results
    });
});

// Send test notification
app.post('/send-test', async (req, res) => {
    try {
        const result = await sendTestNotification();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Send test notification endpoint (ENHANCED FOR BACKGROUND)
app.post('/send-test', (req, res) => {
    console.log('📤 Sending test notification to all subscribers...');
    console.log('Request body:', req.body);
    
    if (subscriptions.length === 0) {
        console.log('❌ No active subscriptions');
        return res.status(400).json({ 
            success: false, 
            error: 'No active subscriptions' 
        });
    }
    
    const payload = JSON.stringify({
        title: req.body.title || 'Task Rock Test',
        body: req.body.body || 'Background notification test - app can be closed!',
        icon: '/assets/images/jerry.png',
        badge: '/assets/images/logo.png',
        tag: 'task-rock-test',
        requireInteraction: true,
        data: {
            url: '/',
            test: true,
            timestamp: Date.now(),
            ...req.body.data
        }
    });
    
    console.log('📦 Notification payload:', payload);
    
    const notificationPromises = subscriptions.map(async (subscription, index) => {
        try {
            console.log(`📤 Sending to subscription ${index + 1}/${subscriptions.length}`);
            
            const result = await webpush.sendNotification(subscription, payload);
            console.log(`✅ Notification sent successfully to subscription ${index + 1}`);
            console.log('Response status:', result.statusCode);
            
            return { success: true, subscription: index + 1 };
        } catch (error) {
            console.error(`❌ Failed to send notification to subscription ${index + 1}:`, error);
            
            // Remove invalid subscriptions
            if (error.statusCode === 410 || error.statusCode === 404) {
                console.log(`🗑️ Removing invalid subscription ${index + 1}`);
                subscriptions.splice(index, 1);
            }
            
            return { success: false, subscription: index + 1, error: error.message };
        }
    });
    
    Promise.all(notificationPromises)
        .then(results => {
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            
            console.log(`📊 Notification results: ${successful} successful, ${failed} failed`);
            
            res.json({ 
                success: true, 
                message: `Test notification sent to ${successful} subscribers`,
                results: {
                    successful,
                    failed,
                    total: subscriptions.length
                }
            });
        })
        .catch(error => {
            console.error('❌ Error sending notifications:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to send notifications' 
            });
        });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Push server running on http://0.0.0.0:${PORT}`);
    console.log('Available endpoints:');
    console.log('  GET  /vapid-public-key - Get VAPID public key');
    console.log('  POST /subscribe - Subscribe to notifications');
    console.log('  POST /unsubscribe - Unsubscribe from notifications');
    console.log('  POST /send-notification - Send notification to all subscribers');
    console.log('  POST /send-test - Send test notification');
    console.log('  GET  /subscriptions/count - Get subscription count');
});

module.exports = app;

