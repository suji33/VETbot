import { Router, Request, Response, NextFunction } from 'express';
import { Conversation } from '../db/models/Conversation';

const router = Router();

function getSession(req: Request): string {
  const header = (req.headers['x-session-id'] as string) || (req.query.sessionId as string);
  if (header && header !== 'undefined' && header !== 'null' && header.trim()) {
    return header.trim();
  }
  return 'default_pet_owner';
}

// GET /api/conversations — list all conversations for this session
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = getSession(req);

  try {
    let conversations = await Conversation
      .find({ sessionId })
      .select('_id title createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50);

    if (conversations.length === 0) {
      conversations = await Conversation
        .find()
        .select('_id title createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .limit(20);
    }

    return res.json({ conversations: conversations || [] });
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = getSession(req);

  try {
    const conv = await Conversation.findOne({ _id: req.params.id, sessionId });
    if (!conv) {
      const fallbackConv = await Conversation.findById(req.params.id);
      if (!fallbackConv) return res.status(404).json({ error: 'Conversation not found' });
      return res.json(fallbackConv);
    }
    return res.json(conv);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/conversations/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await Conversation.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Conversation not found' });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
