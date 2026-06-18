import { pool } from '../../db/pool';

export async function createJob(payload: any, priority: number = 0) {
  const result = await pool.query(
    `INSERT INTO jobs (payload, status, priority)
     VALUES ($1, 'pending', $2)
     RETURNING *`,
    [JSON.stringify(payload), priority]
  );
  return result.rows[0];
}

export async function getJobs(status?: string, limit: number = 50, offset: number = 0) {
  let query = 'SELECT * FROM jobs';
  const params: any[] = [];
  if (status) {
    query += ' WHERE status = $1';
    params.push(status);
  }
  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);
  
  const result = await pool.query(query, params);
  return result.rows;
}

export async function getJobById(id: string) {
  const result = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
  return result.rows[0];
}

export async function getJobHistory(id: string) {
  const result = await pool.query(
    'SELECT * FROM job_executions WHERE job_id = $1 ORDER BY attempt_number ASC',
    [id]
  );
  return result.rows;
}
