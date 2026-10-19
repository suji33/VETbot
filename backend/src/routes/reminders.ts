import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Reminder } from '../db/models/Reminder';
import { registerReminderJob, cancelReminderJob } from '../jobs/reminderCron';

const router = Router();

const ReminderSchema = z.object({
  petId:               z.string().optional(),
  petName:             z.string().max(64).optional(),
  type:                z.preprocess((v) => (!v ? 'other' : String(v).toLowerCase()), z.string().default('other')),
  title:               z.string().min(1, 'Title is required').max(128).trim(),
  description:         z.string().max(500).optional(),
  cronExpression:      z.string().min(1),   // validated separately
  timezone:            z.string().default('Asia/Kolkata'),
  isRecurring:         z.boolean().default(true),
  notificationChannel: z.string().default('in-app'),
});

// Basic cron validation (5 fields, numbers/*/,-?)
const CRON_REGEX = /^(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)$/;

function getSession(req: Request): string {
  const header = (req.headers['x-session-id'] as string) || (req.query.sessionId as string);
  if (header && header !== 'undefined' && header !== 'null' && header.trim()) {
    return header.trim();
  }
  return 'default_pet_owner';
}

// GET /api/reminders
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = getSession(req);

  try {
    let reminders = await Reminder.find({ ownerId: sessionId, status: { $ne: 'cancelled' } })
      .sort({ createdAt: -1 });

    if (reminders.length === 0) {
      reminders = await Reminder.find({ status: { $ne: 'cancelled' } })
        .sort({ createdAt: -1 })
        .limit(20);
    }

    return res.json({ reminders: reminders || [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/reminders
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = getSession(req);

  const parsed = ReminderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid reminder data', details: parsed.error.issues });
  }

  if (!CRON_REGEX.test(parsed.data.cronExpression)) {
    return res.status(400).json({ error: 'Invalid cron expression format' });
  }

  // Check for duplicates: same owner + same title + same cron + active
  const existing = await Reminder.findOne({
    ownerId: sessionId,
    title: parsed.data.title,
    cronExpression: parsed.data.cronExpression,
    status: 'active',
  });

  if (existing) {
    return res.status(409).json({
      error: 'A similar reminder already exists.',
      existingId: existing._id,
    });
  }

  try {
    const reminder = new Reminder({ ownerId: sessionId, ...parsed.data });
    await reminder.save();

    // Register the cron job
    registerReminderJob(reminder);

    return res.status(201).json(reminder);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/reminders/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = getSession(req);
  if (!sessionId) return res.status(401).json({ error: 'Session ID required' });

  try {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, ownerId: sessionId },
      req.body,
      { new: true },
    );
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

    // Re-register job if still active
    if (reminder.status === 'active') {
      cancelReminderJob(reminder._id.toString());
      registerReminderJob(reminder);
    } else {
      cancelReminderJob(reminder._id.toString());
    }

    return res.json(reminder);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/reminders/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = getSession(req);
  if (!sessionId) return res.status(401).json({ error: 'Session ID required' });

  try {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, ownerId: sessionId },
      { status: 'cancelled' },
      { new: true },
    );
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
    cancelReminderJob(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
