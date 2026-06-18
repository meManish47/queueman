import { pool } from '../../db/pool';

export async function runReaper() {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Worker-level check
      const deadWorkersResult = await client.query(`
        UPDATE workers
        SET status = 'dead', current_job_id = NULL
        WHERE status != 'dead' AND last_heartbeat_at < now() - interval '15 seconds'
        RETURNING id;
      `);

      for (const row of deadWorkersResult.rows) {
        await client.query(`
          UPDATE jobs
          SET epoch = epoch + 1, status = 'pending', assigned_worker_id = NULL
          WHERE assigned_worker_id = $1 AND status IN ('assigned', 'running')
        `, [row.id]);
      }

      // 2. Job-level check
      await client.query(`
        UPDATE jobs
        SET epoch = epoch + 1, status = 'pending', assigned_worker_id = NULL
        WHERE status = 'running' AND last_heartbeat_at < now() - interval '15 seconds'
      `);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Reaper transaction failed:', err);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Reaper failed to connect to pool:', err);
  }
}

export function startReaper() {
  setInterval(runReaper, 5000);
}
