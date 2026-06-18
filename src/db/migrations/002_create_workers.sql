CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('idle', 'busy', 'dead')),
  current_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  last_heartbeat_at TIMESTAMP NOT NULL DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE jobs 
  ADD CONSTRAINT fk_assigned_worker 
  FOREIGN KEY (assigned_worker_id) 
  REFERENCES workers(id) ON DELETE SET NULL;
