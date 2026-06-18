import { pool } from '../../db/pool';
import { claimJobForWorker, reportJobResult } from './scheduler';
import { runReaper } from './reaper';
import { randomUUID } from 'crypto';
import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';

describe('Scheduler System Tests', () => {
  beforeEach(async () => {
    // Clean up DB before each test
    await pool.query('TRUNCATE jobs, job_executions, workers CASCADE');
  });

  afterAll(async () => {
    await pool.end();
  });

  async function createJob(payload: any = { test: true }) {
    const res = await pool.query(`
      INSERT INTO jobs (payload, status, priority, max_attempts) 
      VALUES ($1, 'pending', 0, 5) RETURNING *
    `, [payload]);
    return res.rows[0];
  }

  async function createWorker() {
    const id = randomUUID();
    const res = await pool.query(`
      INSERT INTO workers (id, token, status) 
      VALUES ($1, $2, 'idle') RETURNING *
    `, [id, id]);
    return res.rows[0];
  }

  it('Concurrent claiming prevents multiple workers from getting the same job', async () => {
    await createJob(); // Create 1 job
    
    const worker1 = await createWorker();
    const worker2 = await createWorker();
    const worker3 = await createWorker();

    // Fire 3 claims concurrently
    const [claim1, claim2, claim3] = await Promise.all([
      claimJobForWorker(worker1.id),
      claimJobForWorker(worker2.id),
      claimJobForWorker(worker3.id)
    ]);

    // Only one should succeed, the others should return null because FOR UPDATE SKIP LOCKED
    const claims = [claim1, claim2, claim3].filter(c => c !== null);
    
    expect(claims.length).toBe(1);
    expect(claims[0]).toHaveProperty('id');
    expect(claims[0].status).toBe('assigned');
  });

  it('Epoch rejection correctly fences stale results', async () => {
    const job = await createJob();
    const worker1 = await createWorker();
    
    // Worker 1 claims the job
    const claim = await claimJobForWorker(worker1.id);
    expect(claim).toBeDefined();
    
    const worker1Epoch = claim.epoch;

    // Simulate reaper reclaiming the job and another worker taking it, bumping epoch
    await pool.query('UPDATE jobs SET epoch = epoch + 1, status = \'pending\', assigned_worker_id = NULL WHERE id = $1', [job.id]);
    
    // Worker 2 claims it
    const worker2 = await createWorker();
    const claim2 = await claimJobForWorker(worker2.id);
    expect(claim2.epoch).toBe(worker1Epoch + 2);

    // Now Worker 1 (stale) tries to report success
    await reportJobResult(worker1.id, job.id, worker1Epoch, 'completed');

    // Job should still be running/assigned to worker 2
    const currentJob = await pool.query('SELECT * FROM jobs WHERE id = $1', [job.id]);
    expect(currentJob.rows[0].status).toBe('assigned');
    expect(currentJob.rows[0].assigned_worker_id).toBe(worker2.id);

    // It should have logged a rejected_stale execution
    const executions = await pool.query('SELECT * FROM job_executions WHERE job_id = $1 AND status = $2', [job.id, 'rejected_stale']);
    expect(executions.rows.length).toBe(1);
    expect(executions.rows[0].worker_id).toBe(worker1.id);
  });

  it('Reaper times out dead workers and stuck jobs', async () => {
    const job1 = await createJob(); // For dead worker
    const job2 = await createJob(); // For stuck job

    const worker1 = await createWorker();
    const worker2 = await createWorker();

    await claimJobForWorker(worker1.id);
    await claimJobForWorker(worker2.id);
    
    // Set worker 2 to running status for job 2
    await pool.query('UPDATE jobs SET status = \'running\' WHERE id = $1', [job2.id]);

    // Fast-forward last_heartbeat_at beyond 15 seconds for worker 1 and job 2
    await pool.query('UPDATE workers SET last_heartbeat_at = now() - interval \'20 seconds\' WHERE id = $1', [worker1.id]);
    await pool.query('UPDATE jobs SET last_heartbeat_at = now() - interval \'20 seconds\' WHERE id = $1', [job2.id]);

    // Run reaper
    await runReaper();

    // Worker 1 should be dead, its job pending
    const w1 = await pool.query('SELECT status FROM workers WHERE id = $1', [worker1.id]);
    expect(w1.rows[0].status).toBe('dead');

    const j1 = await pool.query('SELECT status, assigned_worker_id FROM jobs WHERE id = $1', [job1.id]);
    expect(j1.rows[0].status).toBe('pending');
    expect(j1.rows[0].assigned_worker_id).toBeNull();

    // Job 2 should be pending (reclaimed because job heartbeat stalled, even if worker heartbeat didn't)
    const j2 = await pool.query('SELECT status, assigned_worker_id FROM jobs WHERE id = $1', [job2.id]);
    expect(j2.rows[0].status).toBe('pending');
    expect(j2.rows[0].assigned_worker_id).toBeNull();
  });

  it('Backoff calculation correctly updates next_retry_at on failure', async () => {
    const job = await createJob();
    const worker = await createWorker();

    const claim = await claimJobForWorker(worker.id);
    
    // Record current time to verify backoff
    const preFailTime = new Date();
    
    // Report failure
    await reportJobResult(worker.id, job.id, claim.epoch, 'failed');

    const updatedJob = await pool.query('SELECT status, attempt_count, next_retry_at FROM jobs WHERE id = $1', [job.id]);
    
    expect(updatedJob.rows[0].status).toBe('retry_waiting');
    expect(updatedJob.rows[0].attempt_count).toBe(1);
    
    // Backoff for attempt 1 is 2^1 + jitter = 2 to 3 seconds from now
    const nextRetry = new Date(updatedJob.rows[0].next_retry_at);
    const diffSeconds = (nextRetry.getTime() - preFailTime.getTime()) / 1000;
    
    // diffSeconds should be roughly 2 to 3 seconds
    expect(diffSeconds).toBeGreaterThanOrEqual(1.9);
    expect(diffSeconds).toBeLessThanOrEqual(4.0);
  });
});
