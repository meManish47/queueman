import { pool } from '../../db/pool';

export async function claimJobForWorker(workerId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const claimResult = await client.query(`
      SELECT * FROM jobs
      WHERE (status = 'pending')
         OR (status = 'retry_waiting' AND next_retry_at <= now())
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED;
    `);

    if (claimResult.rowCount === 0) {
      await client.query('COMMIT');
      return null;
    }

    const job = claimResult.rows[0];
    const isFirstAttempt = job.attempt_count === 0;

    const updateResult = await client.query(`
      UPDATE jobs
      SET 
        status = 'assigned',
        assigned_worker_id = $1,
        epoch = epoch + 1,
        started_at = COALESCE(started_at, CASE WHEN $2 THEN now() ELSE started_at END),
        last_heartbeat_at = now()
      WHERE id = $3
      RETURNING *;
    `, [workerId, isFirstAttempt, job.id]);

    await client.query(`
      UPDATE workers
      SET status = 'busy', current_job_id = $1, last_heartbeat_at = now()
      WHERE id = $2
    `, [job.id, workerId]);

    await client.query('COMMIT');
    return updateResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error claiming job:', error);
    return null;
  } finally {
    client.release();
  }
}

export async function reportJobResult(
  workerId: string, 
  jobId: string, 
  epoch: number, 
  status: 'completed' | 'failed', 
  errorMessage?: string, 
  resultData?: any
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const jobResult = await client.query('SELECT * FROM jobs WHERE id = $1 FOR UPDATE', [jobId]);
    if (jobResult.rowCount === 0) {
      await client.query('COMMIT');
      return;
    }
    const job = jobResult.rows[0];

    // Check epoch
    if (job.epoch !== epoch) {
      await client.query(`
        INSERT INTO job_executions (job_id, worker_id, attempt_number, epoch, status, started_at, ended_at, error_message, result)
        VALUES ($1, $2, $3, $4, 'rejected_stale', now(), now(), $5, $6)
      `, [jobId, workerId, job.attempt_count + 1, epoch, errorMessage || null, resultData ? JSON.stringify(resultData) : null]);
      await client.query('COMMIT');
      return;
    }

    const newAttemptCount = job.attempt_count + 1;
    let nextStatus = status;

    if (status === 'failed') {
      if (newAttemptCount >= job.max_attempts) {
        nextStatus = 'dead' as any;
      } else {
        nextStatus = 'retry_waiting' as any;
        const delaySeconds = Math.pow(2, newAttemptCount);
        const jitter = Math.random(); // 0 to 1
        await client.query(`
          UPDATE jobs SET next_retry_at = now() + interval '${delaySeconds + jitter} seconds'
          WHERE id = $1
        `, [jobId]);
      }
    } else {
      await client.query(`UPDATE jobs SET completed_at = now() WHERE id = $1`, [jobId]);
    }

    await client.query(`
      UPDATE jobs
      SET status = $1, attempt_count = $2, assigned_worker_id = NULL
      WHERE id = $3
    `, [nextStatus, newAttemptCount, jobId]);

    await client.query(`
      UPDATE workers
      SET status = 'idle', current_job_id = NULL
      WHERE id = $1
    `, [workerId]);

    await client.query(`
      INSERT INTO job_executions (job_id, worker_id, attempt_number, epoch, status, started_at, ended_at, error_message, result)
      VALUES ($1, $2, $3, $4, $5, now(), now(), $6, $7)
    `, [jobId, workerId, newAttemptCount, epoch, status, errorMessage || null, resultData ? JSON.stringify(resultData) : null]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reporting job result:', error);
  } finally {
    client.release();
  }
}
