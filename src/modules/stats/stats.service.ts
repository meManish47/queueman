import { pool } from '../../db/pool';

export async function getStats() {
  const result = await pool.query(`
    SELECT status, COUNT(*) as count 
    FROM jobs 
    GROUP BY status
  `);
  
  const stats = {
    pending: 0,
    assigned: 0,
    running: 0,
    retry_waiting: 0,
    completed: 0,
    failed: 0,
    dead: 0,
  };

  for (const row of result.rows) {
    if (row.status in stats) {
      stats[row.status as keyof typeof stats] = parseInt(row.count, 10);
    }
  }

  return stats;
}
