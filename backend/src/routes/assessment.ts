import { Router, Request, Response } from 'express';
import { assessPetHealthRisk, PetHealthRiskInput } from '../modules/PetRiskAssessment';

const router = Router();

/**
 * POST /api/assessment
 * Assesses pet health risk profile without inventing false predictions or overriding emergency rules.
 */
router.post('/', (req: Request, res: Response) => {
  const input: PetHealthRiskInput = req.body;
  const result = assessPetHealthRisk(input);
  res.json(result);
});

export default router;
