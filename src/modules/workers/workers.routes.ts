import { Router } from 'express';
import { registerWorker, getWorkers, getWorkerById } from './workers.service';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const worker = await registerWorker();
    res.status(201).json(worker);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const workers = await getWorkers();
    res.json(workers);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const worker = await getWorkerById(req.params.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    res.json(worker);
  } catch (error) {
    next(error);
  }
});

export default router;
