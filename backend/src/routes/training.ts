import { Router, Request, Response } from 'express';
import { runAutoTraining, getTrainingStatus } from '../services/AutoTrainer';

const router = Router();

/**
 * GET /api/training/status
 * Returns current continuous learning, training status, and indexed document counts.
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json(getTrainingStatus());
});

/**
 * POST /api/training/auto-update
 * Triggers an immediate automated training, indexing, and learning update cycle.
 */
router.post('/auto-update', async (_req: Request, res: Response) => {
  try {
    const result = await runAutoTraining();
    return res.json({
      success: true,
      result,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Auto-update training failed', details: err?.message });
  }
});

export default router;
