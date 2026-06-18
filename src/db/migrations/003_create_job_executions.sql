CREATE TABLE IF NOT EXISTS job_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  epoch INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'rejected_stale')),
  started_at TIMESTAMP NOT NULL DEFAULT now(),
  ended_at TIMESTAMP,
  error_message TEXT,
  result JSONB
);
