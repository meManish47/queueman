import axios from 'axios';
import WebSocket from 'ws';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const WS_URL = process.env.WS_URL || 'ws://localhost:3000/ws/worker';

const args = process.argv.slice(2);
const HANG = args.includes('--hang');
const DELAY_REPORT = args.includes('--delay-report');
const ALWAYS_FAIL = args.includes('--always-fail');

async function start() {
  try {
    const res = await axios.post(`${API_URL}/workers/register`);
    const { id: workerId, token } = res.data;
    console.log(`Worker registered: ${workerId}`);

    const ws = new WebSocket(`${WS_URL}?worker_id=${workerId}&token=${token}`);
    let currentJobId: string | null = null;

    ws.on('open', () => {
      console.log('WebSocket connected');
      ws.send(JSON.stringify({ type: 'idle' }));

      setInterval(() => {
        if (!currentJobId) {
          ws.send(JSON.stringify({ type: 'idle' }));
        }

        if (currentJobId && HANG) {
          // Send global heartbeat but NOT job-level heartbeat
          ws.send(JSON.stringify({ type: 'heartbeat' }));
        } else {
          const payload = { type: 'heartbeat', jobId: currentJobId };
          console.log(`Sending heartbeat:`, payload);
          ws.send(JSON.stringify(payload));
        }
      }, 5000);
    });

    ws.on('message', async (data: any) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'job_assigned') {
        const { job } = msg;
        currentJobId = job.id;
        console.log(`Received job ${job.id} (epoch ${job.epoch})`);
        
        ws.send(JSON.stringify({ type: 'job_started', jobId: job.id }));

        const isPartition = args.includes('--partition');
        if (isPartition) {
          console.log(`[PARTITION] Worker partitioned. Stopping job heartbeats and delaying result by 20s...`);
          currentJobId = null; // stop heartbeats
        }

        if (HANG) {
          console.log(`[HANG] Worker is hanging. Keeping connection alive but stopping job heartbeats...`);
          return; // never finish the job
        }

        let delay = Math.floor(Math.random() * 3000) + 2000;
        if (DELAY_REPORT || isPartition) {
          delay = 35000; // wait 35s to simulate partition / stale result
          console.log(`[DELAY_REPORT] Delaying result by 35s...`);
        }
        await new Promise(r => setTimeout(r, delay));

        const isSuccess = ALWAYS_FAIL ? false : Math.random() > 0.3;

        console.log(`Finished job ${job.id}: ${isSuccess ? 'completed' : 'failed'}`);
        ws.send(JSON.stringify({
          type: 'job_result',
          jobId: job.id,
          epoch: job.epoch,
          status: isSuccess ? 'completed' : 'failed',
          errorMessage: isSuccess ? undefined : 'Simulated failure',
          resultData: isSuccess ? { success: true } : undefined
        }));

        currentJobId = null;
        setTimeout(() => {
          ws.send(JSON.stringify({ type: 'idle' }));
        }, 1000);
      }
    });

    ws.on('close', () => console.log('WebSocket closed'));
    ws.on('error', (err: any) => console.error('WebSocket error:', err));
  } catch (err) {
    console.error('Simulator error:', err);
  }
}

start();
