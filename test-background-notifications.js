// Test script to verify background notifications work when app is closed
const fetch = require('node-fetch');

async function testBackgroundNotifications() {
    console.log('🧪 Testing Background Notifications...');
    
    try {
        // Test 1: Send immediate notification
        console.log('📤 Sending immediate test notification...');
        const response1 = await fetch('http://localhost:3001/send-test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: 'Background Test',
                body: 'This notification should appear even when Task Rock is closed!',
                data: {
                    test: true,
                    timestamp: Date.now()
                }
            })
        });
        
        if (response1.ok) {
            console.log('✅ Immediate notification sent successfully');
        } else {
            console.log('❌ Failed to send immediate notification');
        }
        
        // Test 2: Send delayed notification (simulates task due notification)
        console.log('⏰ Sending delayed notification in 10 seconds...');
        setTimeout(async () => {
            try {
                const response2 = await fetch('http://localhost:3001/send-test', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: 'Task Due Soon!',
                        body: '⏰ Your task "Complete project" is due in 15 minutes!',
                        data: {
                            taskId: 'test-task-123',
                            dueTime: Date.now() + (15 * 60 * 1000)
                        }
                    })
                });
                
                if (response2.ok) {
                    console.log('✅ Delayed notification sent successfully');
                } else {
                    console.log('❌ Failed to send delayed notification');
                }
            } catch (error) {
                console.error('❌ Error sending delayed notification:', error);
            }
        }, 10000);
        
        // Test 3: Check subscription count
        const response3 = await fetch('http://localhost:3001/subscriptions/count');
        const countData = await response3.json();
        console.log(`📊 Active subscriptions: ${countData.count}`);
        
        console.log('\n🎯 Background Notification Test Instructions:');
        console.log('1. Open Task Rock in browser');
        console.log('2. Enable notifications in Settings');
        console.log('3. Close the browser tab/window completely');
        console.log('4. Wait for notifications to appear');
        console.log('5. Notifications should appear even when app is closed');
        
    } catch (error) {
        console.error('❌ Error testing background notifications:', error);
    }
}

// Run the test
testBackgroundNotifications();

