CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'assigned', 'running', 'retry_waiting', 'completed', 'failed', 'dead')),
  priority INTEGER DEFAULT 0,
  assigned_worker_id UUID, -- Foreign key added in 002
  epoch INTEGER DEFAULT 0,
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_retry_at TIMESTAMP,
  last_heartbeat_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);
