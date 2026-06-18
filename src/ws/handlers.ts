import { WebSocket } from 'ws';
import { pool } from '../db/pool';
import { claimJobForWorker, reportJobResult } from '../modules/scheduler/scheduler';

export function handleConnection(ws: WebSocket, workerId: string) {
  ws.on('message', async (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'idle') {
        const job = await claimJobForWorker(workerId);
        if (job) {
          ws.send(JSON.stringify({
            type: 'job_assigned',
            job: {
              id: job.id,
              payload: job.payload,
              epoch: job.epoch
            }
          }));
        }
      } else if (msg.type === 'heartbeat') {
        await pool.query('UPDATE workers SET last_heartbeat_at = now() WHERE id = $1', [workerId]);
        
        if (msg.jobId) {
          await pool.query(`
            UPDATE jobs SET last_heartbeat_at = now() 
            WHERE id = $1 AND status IN ('assigned', 'running') AND assigned_worker_id = $2
          `, [msg.jobId, workerId]);
        }
      } else if (msg.type === 'job_result') {
        await reportJobResult(workerId, msg.jobId, msg.epoch, msg.status, msg.errorMessage, msg.resultData);
      } else if (msg.type === 'job_started') {
        await pool.query(`UPDATE jobs SET status = 'running' WHERE id = $1`, [msg.jobId]);
      }
    } catch (err) {
      console.error('WS message error:', err);
    }
  });
}
