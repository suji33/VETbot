import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { orchestrate } from '../orchestrator/PawOrchestrator';

const router = Router();

// Multer — store images in memory (not disk) for safety
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (Number(process.env.MAX_IMAGE_SIZE_MB) || 10) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp').split(',');
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported: ${file.mimetype}`));
    }
  },
});

// ── Validation schemas ────────────────────────────────────────
const ChatSchema = z.object({
  message: z.string().min(1, 'Message is required').max(4000).trim(),
  conversationId: z.preprocess((v) => (!v || String(v).trim() === '' ? undefined : String(v).trim()), z.string().optional()),
  petId: z.preprocess((v) => (!v || String(v).trim() === '' ? undefined : String(v).trim()), z.string().optional()),
  timezone: z.preprocess((v) => (!v || String(v).trim() === '' ? undefined : String(v).trim()), z.string().optional()),
  sessionId: z.string().min(1).max(128).default('default_session'),
});

const ImageChatSchema = z.object({
  message: z.preprocess((v) => (!v ? 'Please analyze this image.' : String(v).trim()), z.string().max(4000).default('Please analyze this image.')),
  conversationId: z.preprocess((v) => (!v || String(v).trim() === '' ? undefined : String(v).trim()), z.string().optional()),
  petId: z.preprocess((v) => (!v || String(v).trim() === '' ? undefined : String(v).trim()), z.string().optional()),
  timezone: z.preprocess((v) => (!v || String(v).trim() === '' ? undefined : String(v).trim()), z.string().optional()),
  sessionId: z.string().min(1).max(128).default('default_session'),
});

// ── POST /api/chat ────────────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const rawBody = req.body || {};
  const headerSessionId = (req.headers['x-session-id'] as string)?.trim();
  const effectiveSessionId = rawBody.sessionId?.trim() || headerSessionId || 'default_session';

  const parsed = ChatSchema.safeParse({ ...rawBody, sessionId: effectiveSessionId });
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      details: parsed.error.issues.map((i) => i.message),
    });
  }

  try {
    const result = await orchestrate({
      sessionId:      parsed.data.sessionId,
      conversationId: parsed.data.conversationId,
      message:        parsed.data.message,
      petId:          parsed.data.petId,
      timezone:       parsed.data.timezone || 'Asia/Kolkata',
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/chat/image ──────────────────────────────────────
router.post(
  '/image',
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided. Please attach an image.' });
    }

    const rawBody = req.body || {};
    const headerSessionId = (req.headers['x-session-id'] as string)?.trim();
    const effectiveSessionId = rawBody.sessionId?.trim() || headerSessionId || 'default_session';

    const parsed = ImageChatSchema.safeParse({ ...rawBody, sessionId: effectiveSessionId });
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues.map((i) => i.message),
      });
    }

    try {
      const result = await orchestrate({
        sessionId:        parsed.data.sessionId,
        conversationId:   parsed.data.conversationId,
        message:          parsed.data.message,
        imageBuffer:      req.file.buffer,
        imageMimeType:    req.file.mimetype,
        imageOriginalName: req.file.originalname,
        petId:            parsed.data.petId,
        timezone:         parsed.data.timezone || 'Asia/Kolkata',
      });

      return res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
