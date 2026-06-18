# Architecture — Distributed Job Execution Platform

## Overview

This system allows users to submit computational jobs that execute asynchronously across a pool of workers. It handles job scheduling, worker registration, heartbeat-based health monitoring, automatic failure recovery, retries with exponential backoff, priority ordering, and full execution history.

The core design goal was to build the scheduling and coordination logic from scratch rather than relying on a managed queue library like BullMQ, in order to demonstrate an actual understanding of the distributed systems problems involved: race-free job claiming, failure detection, and safe recovery from worker crashes.

## System Components

**API Server** — accepts job submissions from users, exposes job status endpoints, and hosts the WebSocket server that coordinates workers.

**Workers** — long-running processes that connect to the server over WebSocket, report themselves as idle, receive job assignments, execute jobs, and send periodic heartbeats.

**Scheduler** — not a separate service, but a routine inside the API server that runs whenever a worker reports idle. It atomically claims the next eligible job from the database and pushes it to that worker.

**Reaper** — a background routine that periodically scans for workers and jobs whose heartbeats have gone silent, and recovers any orphaned jobs back into the pending pool.

**Database (PostgreSQL)** — the single source of truth for job state, worker state, and execution history. Chosen over a NoSQL store because the `SELECT ... FOR UPDATE SKIP LOCKED` pattern this system depends on for race-free job claiming is a native PostgreSQL feature, and the job lifecycle has strict relational structure (a job has many execution attempts) that benefits from foreign keys and normalization.

## Data Model

### `jobs`
Tracks the current state of every job.

| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| payload | jsonb | the work to be done |
| status | enum | `pending`, `assigned`, `running`, `retry_waiting`, `completed`, `failed`, `dead` |
| priority | integer | higher value = scheduled first |
| assigned_worker_id | uuid, nullable | current owner, if any |
| epoch | integer | incremented every time the job is (re)assigned; used as a fencing token |
| attempt_count | integer | number of attempts so far |
| max_attempts | integer | retry ceiling, default 5 |
| next_retry_at | timestamp, nullable | when this job becomes eligible again after a failure |
| last_heartbeat_at | timestamp, nullable | updated by the worker while the job is running |
| created_at, updated_at, started_at, completed_at | timestamp | lifecycle timestamps |

### `workers`
Tracks every worker's current state.

| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| status | enum | `idle`, `busy`, `dead` |
| current_job_id | uuid, nullable | the job currently assigned, if any |
| last_heartbeat_at | timestamp | updated on every heartbeat over the WebSocket connection |
| created_at | timestamp | |

### `job_executions`
A normalized, append-only log of every attempt made on every job. Kept separate from `jobs` to avoid redundant data and to support aggregation queries (e.g. average attempts to success, per-worker failure rate) without touching the live job state table.

| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| job_id | uuid | foreign key to `jobs` |
| worker_id | uuid | which worker made this attempt |
| attempt_number | integer | |
| epoch | integer | the fencing token value at the time of this attempt |
| status | enum | `running`, `completed`, `failed`, `rejected_stale` |
| started_at, ended_at | timestamp | |
| error_message | text, nullable | populated on failure |
| result | jsonb, nullable | populated on success |

The `rejected_stale` status exists specifically to make the fencing token mechanism visible: when a worker that was incorrectly marked dead comes back and submits a result for a job that has since moved to a new epoch, that submission is logged here instead of silently dropped, so the failure detection trade-off is provable from the data rather than just claimed in this document.

## Core Mechanisms

### Pull-based scheduling over WebSockets

Workers connect to the server via WebSocket on startup and report themselves as idle. Rather than the server pushing work to workers on a fixed schedule, idle workers signal availability and the server responds by attempting to claim a job for them. This was chosen over polling because it reacts to availability the moment it happens, rather than on a fixed interval, and because the same connection doubles as a fast liveness signal — a dropped connection is detected immediately, rather than waiting for a heartbeat timeout window.

### Race-free job claiming

Multiple idle workers reporting availability at the same moment must not be assigned the same job. This is solved with PostgreSQL's row locking:

```sql
SELECT * FROM jobs
WHERE (status = 'pending')
   OR (status = 'retry_waiting' AND next_retry_at <= now())
ORDER BY priority DESC, created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

`FOR UPDATE` locks the selected row for the duration of the transaction. `SKIP LOCKED` means a second concurrent query does not wait for that lock — it simply skips the locked row and finds the next eligible job. This allows many workers to claim jobs in parallel with zero collisions and no blocking, while `ORDER BY priority DESC` ensures urgent jobs are always claimed first. Pessimistic locking was chosen over an optimistic, version-based approach here because, as the worker pool grows, simultaneous claim attempts become frequent rather than rare, and optimistic locking under frequent contention leads to repeated retries instead of a single atomic resolution.

### Failure detection: heartbeats

A worker can never reliably announce its own death — if it is genuinely dead, it has no opportunity to send that message. Failure is therefore detected by absence, from the server's side: a background routine checks whether a worker's `last_heartbeat_at` has exceeded a timeout threshold (15 seconds, with heartbeats expected every 5 seconds), and if so, marks the worker `dead`.

Two independent heartbeat checks exist, because they catch different failure modes:

1. **Worker-level heartbeat** — detects a worker process that has crashed or lost its connection entirely. When this fires, every job currently assigned to that worker is reclaimed.
2. **Job-level heartbeat** — detects a job that is stuck or hung even though its worker is otherwise alive and connected. When this fires, only that specific job is reclaimed; the worker is left free to pick up other work.

This two-tier check exists because a worker can be alive and responsive in general while one specific job it's running has entered an infinite loop or is otherwise hung — relying on worker-level heartbeats alone would never catch that case.

### Fencing tokens for safe recovery

Heartbeat-based failure detection can produce false positives — a worker may be genuinely alive but briefly unresponsive due to a network blip, GC pause, or CPU spike, and gets marked dead incorrectly while its job is reassigned to a new worker. If that "dead" worker later finishes and reports a result, the system must not let it silently overwrite or duplicate the result from whichever worker actually completed the job under the current assignment.

This is solved with an `epoch` counter on each job, incremented every time the job is assigned or reassigned. Every execution attempt is tagged with the epoch active at the time it was claimed. When a worker reports a result, the server checks whether the job's current epoch still matches the epoch the worker was given:

- If it matches, the result is accepted.
- If it doesn't, the job has since moved on to a different worker, and the result is rejected and logged with status `rejected_stale` in `job_executions`.

This prevents the system from recording two completions for the same job. It does not, by itself, guarantee that any real-world side effect the job performs (sending an email, charging a payment) only happens once — see Known Limitations below.

### Retries with exponential backoff and jitter

When a job's execution fails (the worker ran it, but it errored), it is retried up to 5 times. Each retry waits longer than the last:

```
delay = base_delay * (2 ^ attempt_number), plus random jitter
```

Concretely: 2s, 4s, 8s, 16s, 32s, with the actual wait randomized slightly around each value. After 5 failed attempts, the job is marked `dead` and stops retrying.

Immediate retries were deliberately avoided. If a job fails because of an overloaded downstream dependency or a temporary outage, retrying instantly adds more load to an already struggling system and can turn an isolated failure into a cascading one. Backoff gives the system time to recover. Jitter exists so that many jobs that failed at the same moment for the same underlying reason don't all retry in lockstep and recreate the same load spike, just delayed.

A failed job is set to `retry_waiting` with a `next_retry_at` timestamp rather than going back to `pending` immediately, and is picked up by the same claiming query once that timestamp has passed. The worker that experienced the failure does not retry the job itself — it reports idle immediately and is free to pick up other work, since workers are stateless and hold no job-specific resources that would make sticky reassignment beneficial.

## Failure Handling Summary

| Failure | Detection | Recovery |
|---|---|---|
| Worker process crashes | Worker-level heartbeat timeout | All jobs assigned to that worker reclaimed and returned to pending |
| Job hangs, worker otherwise fine | Job-level heartbeat timeout | That specific job reclaimed; worker continues normally |
| Job execution errors | Reported failure from worker | Job moved to `retry_waiting` with exponential backoff, retried up to 5 times, then marked `dead` |
| "Dead" worker reports late | Epoch mismatch on result submission | Result rejected, logged as `rejected_stale`, no impact on the job's actual (already reassigned) outcome |

## Known Limitations and Trade-offs

- **At-least-once, not exactly-once, execution.** The epoch/fencing mechanism guarantees the system never records two completions for the same job, but it does not guarantee a job's external side effects (sending an email, calling a third-party API) only happen once if two workers both genuinely executed it before the fencing check resolved. True exactly-once semantics would require idempotency keys implemented at the individual job-handler level, which was out of scope for this assessment given the time constraint.
- **Heartbeat timeouts are a trade-off, not a solved problem.** A short timeout detects real failures faster but risks false positives under transient slowness; a long timeout reduces false positives but delays recovery from real crashes. The values chosen (5s heartbeat interval, 15s timeout) are a reasonable starting point, not a tuned production value.
- **Single API server instance assumed for the scheduler routine.** The job-claiming query is safe under concurrent workers regardless of how many API server instances are running, since the locking happens at the database level. However, the heartbeat-checking "reaper" routine itself is not currently coordinated across multiple server instances, and running more than one would need a leader-election step or a similar mechanism to avoid duplicate reaping work.
- **No dead-letter queue UI.** Jobs that exhaust their retries are marked `dead` in the database and are visible via the execution history table, but there is no dedicated endpoint or UI for managing or manually replaying dead jobs.
