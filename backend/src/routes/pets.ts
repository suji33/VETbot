import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Pet } from '../db/models/Pet';

const router = Router();

const PetSchema = z.object({
  name:     z.string().min(1, 'Pet name is required').max(64).trim(),
  species:  z.preprocess(
    (val) => (!val || String(val).trim() === '' ? 'dog' : String(val).trim().toLowerCase()),
    z.string().min(1).max(64).default('dog')
  ),
  breed:    z.preprocess((val) => (!val ? undefined : String(val).trim()), z.string().max(64).optional().nullable()),
  age:      z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : Number(val)), z.number().min(0).max(600).optional().nullable()),
  weightKg: z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : Number(val)), z.number().min(0).max(200).optional().nullable()),
  sex:      z.preprocess(
    (val) => (!val ? 'unknown' : String(val).trim().toLowerCase()),
    z.enum(['male', 'female', 'unknown']).optional().default('unknown')
  ),
  notes:    z.preprocess((val) => (!val ? undefined : String(val).trim()), z.string().max(1000).optional().nullable()),
});

function getSession(req: Request): string {
  const header = (req.headers['x-session-id'] as string) || (req.query.sessionId as string);
  if (header && header !== 'undefined' && header !== 'null' && header.trim()) {
    return header.trim();
  }
  return 'default_pet_owner';
}

// GET /api/pets
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = getSession(req);

  try {
    let pets = await Pet.find({ ownerId: sessionId }).sort({ createdAt: -1 });
    // If no pets found under this exact session ID, retrieve all pets created on this database instance
    if (pets.length === 0) {
      pets = await Pet.find().sort({ createdAt: -1 });
    }
    return res.json({ pets: pets || [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/pets
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = getSession(req);

  const parsed = PetSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => `${i.path.join('.') || 'field'}: ${i.message}`).join(', ');
    return res.status(400).json({ error: errorMsg || 'Invalid pet data', details: parsed.error.issues });
  }

  try {
    const pet = new Pet({
      ownerId: sessionId,
      name: parsed.data.name,
      species: parsed.data.species,
      breed: parsed.data.breed || undefined,
      age: parsed.data.age ?? undefined,
      weightKg: parsed.data.weightKg ?? undefined,
      sex: parsed.data.sex || 'unknown',
      notes: parsed.data.notes || undefined,
    });
    await pet.save();
    return res.status(201).json(pet);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/pets/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = getSession(req);

  const parsed = PetSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid pet data', details: parsed.error.issues });
  }

  try {
    const pet = await Pet.findOneAndUpdate(
      { _id: req.params.id },
      parsed.data,
      { new: true },
    );
    if (!pet) return res.status(404).json({ error: 'Pet not found' });
    return res.json(pet);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/pets/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await Pet.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Pet not found' });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
