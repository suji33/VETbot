import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { connectDB } from './db/connection';
import chatRoutes from './routes/chat';
import conversationRoutes from './routes/conversations';
import petRoutes from './routes/pets';
import reminderRoutes from './routes/reminders';
import webhookRoutes from './routes/webhooks';
import assessmentRoutes from './routes/assessment';
import trainingRoutes from './routes/training';
import { errorHandler } from './middleware/errorHandler';
import { startReminderCron } from './jobs/reminderCron';
import { runAutoTraining } from './services/AutoTrainer';

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
]
  .filter(Boolean)
  .map((o) => (o as string).trim().replace(/\/+$/, ''));

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. server-to-server, curl, health probes)
    if (!origin) return callback(null, true);

    // Allow local development on localhost or 127.0.0.1
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/+$/, '');
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // Allow Vercel preview and production deployments (*.vercel.app)
    if (/^https:\/\/[a-zA-Z0-9_.-]+\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }

    // If in development mode and no specific origin matched, permit gracefully
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    callback(new Error(`Origin ${origin} not allowed by CORS policy`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'X-Session-Id', 'x-api-key'],
}));

// ── Body parsing ─────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Rate limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests. Please wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'PetCare AI Backend', timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'PetCare AI Backend', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/chat', chatRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/training', trainingRoutes);

// ── Error handler (must be last) ─────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
async function start() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected');
  } catch (err: any) {
    console.warn('\n⚠️ MongoDB Atlas connection notice:');
    console.warn('   ' + (err?.message || err));
    console.warn('👉 To resolve: In MongoDB Atlas dashboard -> Network Access -> Add IP Address -> Allow Access from Anywhere (0.0.0.0/0) or Add Current IP.\n');
  }

  // Reminders option disabled per configuration
  // startReminderCron();

  // Trigger continuous learning and auto-training cycle on boot
  runAutoTraining().catch((e) => console.warn('AutoTrainer deferred:', e?.message));

  app.listen(Number(PORT), HOST, () => {
    console.log(`\n🐾 PetCare AI Backend running on http://${HOST}:${PORT}`);
    console.log(`   Health check: http://${HOST}:${PORT}/health`);
    console.log(`   Environment: ${process.env.NODE_ENV}`);
  });
}

start();

export default app;
export { app, start };
