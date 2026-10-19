import { Router, Request, Response } from 'express';
import { assessPetHealthRisk, PetHealthRiskInput } from '../modules/PetRiskAssessment';

const router = Router();

/**
 * POST /api/assessment
 * Assesses pet health risk profile without inventing false predictions or overriding emergency rules.
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const input: PetHealthRiskInput = req.body || {};
    const result = assessPetHealthRisk(input);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'Assessment calculation failed', details: err?.message });
  }
});

export default router;
