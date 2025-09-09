
const express = require('express');
const bodyParser = require('body-parser');
const webpush = require('web-push');
const cors = require('cors');
const schedule = require('node-schedule');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@taskrock.local';

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.warn('VAPID keys missing. Run: npx web-push generate-vapid-keys');
}
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const subscriptions = new Map();
const schedules = new Map();

app.get('/api/vapidPublicKey', (req, res) => res.json({ key: VAPID_PUBLIC_KEY }));

app.post('/api/subscribe', (req, res) => {
  const sub = req.body.subscription;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  subscriptions.set(sub.endpoint, sub);
  res.json({ ok: true });
});

app.post('/api/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) subscriptions.delete(endpoint);
  res.json({ ok: true });
});

app.post('/api/schedule', async (req, res) => {
  try {
    const { title, taskId, dueDate, offsets, subscription } = req.body;
    const sub = (subscription && subscription.endpoint) ? subscription : [...subscriptions.values()][0];
    if (!sub) return res.status(400).json({ error: 'No subscription registered' });
    if (subscription && subscription.endpoint) subscriptions.set(subscription.endpoint, subscription);

    if (schedules.has(taskId)) { for (const j of schedules.get(taskId)) j.cancel(); schedules.delete(taskId); }
    const due = new Date(dueDate);
    const mins = Array.isArray(offsets) ? offsets : [20,15,10,5,2];
    const jobs = [];
    for (const m of mins) {
      const when = new Date(due.getTime() - m*60000);
      if (when > new Date()) {
        const job = schedule.scheduleJob(when, () => {
          webpush.sendNotification(sub, JSON.stringify({
            title: 'Task due soon',
            body: `${title} in ${m} minutes`,
            tag: `task-${taskId}-${m}`,
            data: { taskId }
          })).catch(err => console.error('push failed', err));
        });
        jobs.push(job);
      }
    }
    schedules.set(taskId, jobs);
    res.json({ ok: true, scheduled: jobs.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Schedule failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Push server running on', PORT));
