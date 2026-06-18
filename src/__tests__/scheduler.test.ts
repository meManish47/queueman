import { pool } from '../db/pool';
import { claimJobForWorker, reportJobResult } from '../modules/scheduler/scheduler';
import { runReaper } from '../modules/scheduler/reaper';
import { createJob } from '../modules/jobs/jobs.service';
import { registerWorker } from '../modules/workers/workers.service';

describe('Scheduler and Reliability', () => {
  let worker1: any;
  let worker2: any;

  beforeAll(async () => {
    worker1 = await registerWorker();
    worker2 = await registerWorker();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('prevents race conditions: assigns pending job to only one concurrent caller', async () => {
    const job = await createJob({ test: 'race' }, 10);
    
    const results = await Promise.all([
      claimJobForWorker(worker1.id),
      claimJobForWorker(worker2.id)
    ]);

    const claimedCount = results.filter(r => r !== null).length;
    expect(claimedCount).toBe(1);
    
    const claimedJob = results.find(r => r !== null);
    if (claimedJob) {
       await reportJobResult(claimedJob.assigned_worker_id, claimedJob.id, claimedJob.epoch, 'completed');
    }
  });

  it('rejects stale job_result on epoch mismatch', async () => {
    const job = await createJob({ test: 'epoch' }, 10);
    const claimed = await claimJobForWorker(worker1.id);
    expect(claimed).toBeTruthy();

    await pool.query('UPDATE jobs SET epoch = epoch + 1 WHERE id = $1', [claimed!.id]);

    await reportJobResult(worker1.id, claimed!.id, claimed!.epoch, 'completed');

    const finalJob = await pool.query('SELECT status FROM jobs WHERE id = $1', [claimed!.id]);
    expect(finalJob.rows[0].status).not.toBe('completed');
    
    const execs = await pool.query('SELECT status FROM job_executions WHERE job_id = $1', [claimed!.id]);
    expect(execs.rows.some(e => e.status === 'rejected_stale')).toBe(true);
  });
});
