import express from 'express';
import cors from 'cors';
import jobsRoutes from './modules/jobs/jobs.routes';
import workersRoutes from './modules/workers/workers.routes';
import statsRoutes from './modules/stats/stats.routes';

export const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/jobs', jobsRoutes);
app.use('/api/workers', workersRoutes);
app.use('/api/stats', statsRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});
