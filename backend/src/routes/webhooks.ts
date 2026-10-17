import { Router, Request, Response } from 'express';

const router = Router();

// POST /api/webhooks/n8n — authenticated n8n callback
router.post('/n8n', (req: Request, res: Response) => {
  const secret = req.headers['x-webhook-secret'];
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized webhook call' });
  }

  // Process n8n workflow callback (reminder delivery confirmation, etc.)
  const { reminderId, status, message } = req.body;
  console.log(`n8n webhook: reminder ${reminderId} — ${status}: ${message}`);

  return res.json({ received: true });
});

export default router;
