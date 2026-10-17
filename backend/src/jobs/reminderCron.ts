import cron from 'node-cron';
import { Reminder, IReminder } from '../db/models/Reminder';

/**
 * PawReminder cron scheduler.
 * 
 * On startup: loads all active reminders from MongoDB and schedules them.
 * Provides registerReminderJob and cancelReminderJob for dynamic management.
 */

const activeJobs = new Map<string, cron.ScheduledTask>();

export function registerReminderJob(reminder: IReminder): void {
  const id = reminder._id.toString();

  if (activeJobs.has(id)) {
    activeJobs.get(id)?.stop();
    activeJobs.delete(id);
  }

  if (reminder.status !== 'active') return;

  if (!cron.validate(reminder.cronExpression)) {
    console.warn(`Invalid cron expression for reminder ${id}: ${reminder.cronExpression}`);
    return;
  }

  const task = cron.schedule(
    reminder.cronExpression,
    async () => {
      console.log(`🔔 Reminder triggered: "${reminder.title}" for ${reminder.petName || 'your pet'}`);
      try {
        await deliverNotification(reminder);
        await Reminder.findByIdAndUpdate(id, {
          lastDeliveredAt: new Date(),
          lastDeliveryStatus: 'success',
          $inc: { failureCount: 0 },
        });
      } catch (err) {
        console.error(`Reminder delivery failed for ${id}:`, err);
        const updated = await Reminder.findByIdAndUpdate(
          id,
          { lastDeliveryStatus: 'failed', $inc: { failureCount: 1 } },
          { new: true },
        );
        // Pause after 5 consecutive failures
        if (updated && updated.failureCount >= 5) {
          await Reminder.findByIdAndUpdate(id, { status: 'paused' });
          task.stop();
          activeJobs.delete(id);
          console.warn(`Reminder ${id} paused after 5 failures`);
        }
      }
    },
    { timezone: reminder.timezone || 'Asia/Kolkata' },
  );

  task.start();
  activeJobs.set(id, task);
  console.log(`⏰ Scheduled reminder "${reminder.title}" [${reminder.cronExpression}] tz:${reminder.timezone}`);
}

export function cancelReminderJob(id: string): void {
  if (activeJobs.has(id)) {
    activeJobs.get(id)?.stop();
    activeJobs.delete(id);
    console.log(`🗑️  Cancelled reminder job ${id}`);
  }
}

async function deliverNotification(reminder: IReminder): Promise<void> {
  const channel = process.env.NOTIFICATION_CHANNEL || 'in-app';

  if (channel === 'in-app') {
    // In-app notification: log + update DB (frontend polls or uses SSE in v2)
    console.log(`📲 In-app notification: "${reminder.title}"`);
    return;
  }

  // Email channel (extend with nodemailer or similar if SMTP is configured)
  throw new Error(`Notification channel "${channel}" not configured`);
}

export async function startReminderCron(): Promise<void> {
  try {
    const activeReminders = await Reminder.find({ status: 'active' });
    for (const reminder of activeReminders) {
      registerReminderJob(reminder);
    }
    console.log(`✅ Loaded ${activeReminders.length} active reminders`);
  } catch (err) {
    console.error('Failed to load reminders from MongoDB:', err);
  }
}
