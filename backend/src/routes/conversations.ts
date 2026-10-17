import { Router, Request, Response, NextFunction } from 'express';
import { Conversation } from '../db/models/Conversation';

const router = Router();

// GET /api/conversations — list all conversations for this session
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.headers['x-session-id'] as string;
  if (!sessionId) return res.status(401).json({ error: 'Session ID required' });

  try {
    const conversations = await Conversation
      .find({ sessionId })
      .select('_id title createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50);

    return res.json({ conversations });
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.headers['x-session-id'] as string;
  if (!sessionId) return res.status(401).json({ error: 'Session ID required' });

  try {
    const conv = await Conversation.findOne({ _id: req.params.id, sessionId });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    return res.json(conv);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/conversations/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.headers['x-session-id'] as string;
  if (!sessionId) return res.status(401).json({ error: 'Session ID required' });

  try {
    const result = await Conversation.deleteOne({ _id: req.params.id, sessionId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Conversation not found' });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
