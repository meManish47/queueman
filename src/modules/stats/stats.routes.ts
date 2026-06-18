import { Router } from 'express';
import { getStats } from './stats.service';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;
