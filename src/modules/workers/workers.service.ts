import { pool } from '../../db/pool';
import { randomBytes } from 'crypto';

export async function registerWorker() {
  const token = randomBytes(32).toString('hex');
  const result = await pool.query(
    `INSERT INTO workers (token, status)
     VALUES ($1, 'idle')
     RETURNING id, token`,
    [token]
  );
  return result.rows[0]; // { id, token }
}

export async function getWorkers() {
  const result = await pool.query('SELECT id, status, current_job_id, last_heartbeat_at, created_at FROM workers ORDER BY created_at DESC');
  return result.rows;
}

export async function getWorkerById(id: string) {
  const result = await pool.query('SELECT id, status, current_job_id, last_heartbeat_at, created_at FROM workers WHERE id = $1', [id]);
  return result.rows[0];
}

export async function validateWorkerToken(workerId: string, token: string) {
  const result = await pool.query(
    'SELECT 1 FROM workers WHERE id = $1 AND token = $2',
    [workerId, token]
  );
  return (result.rowCount ?? 0) > 0;
}
