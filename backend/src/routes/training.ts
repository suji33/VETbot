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
  const result = await runAutoTraining();
  res.json({
    success: true,
    result,
  });
});

export default router;
