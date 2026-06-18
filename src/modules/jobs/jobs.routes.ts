import { Router } from 'express';
import { createJob, getJobs, getJobById, getJobHistory } from './jobs.service';
import { CreateJobSchema } from './jobs.schema';
import { validate } from '../../middleware/validate';

const router = Router();

router.post('/', validate(CreateJobSchema), async (req, res, next) => {
  try {
    const job = await createJob(req.body.payload, req.body.priority);
    res.status(201).json(job);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const status = req.query.status as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const jobs = await getJobs(status, limit, offset);
    res.json(jobs);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const job = await getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const history = await getJobHistory(req.params.id);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

export default router;
