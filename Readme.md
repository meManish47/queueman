# Queueman

A Distributed Job Execution Platform where users can submit computational jobs that execute asynchronously across workers.

## Features
- Job submission & Scheduling
- Pull-based assignment via WebSockets
- Retries with exponential backoff for failed jobs
- Handling of worker crashes via heartbeat monitoring
- Job execution tracking and execution history
- Queue prioritization

## Prerequisites
- Docker and Docker Compose

## Installation & Running the Application

The entire application stack (Database, Backend API, Frontend Dashboard, and a simulated Worker) is containerized and can be started with a single command.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/meManish47/queueman.git
   cd queueman
   ```

2. **Start the application using Docker Compose:**
   ```bash
   docker-compose up --build
   ```
   *This command will automatically build the images, start the PostgreSQL database, run the database migrations, and boot the backend server, frontend dashboard, and a worker simulator.*

3. **Access the application:**
   - **Frontend Dashboard:** [http://localhost:5173](http://localhost:5173)
   - **Backend API:** [http://localhost:3000](http://localhost:3000)

## Environment Configuration
The application relies on environment variables. For convenience with Docker Compose, default configurations are already mapped in `docker-compose.yml`:
- `DATABASE_URL=postgres://user:password@db:5432/abstrabit`
- `PORT=3000`
- `API_URL=http://backend:3000/api`
- `WS_URL=ws://backend:3000/ws/worker`

## Running Tests

To run the unit tests for the backend scheduler and logic locally:
```bash
npm install
npm test
```

## Assumptions Made
1. **Security & Authentication:** This implementation omits user authentication and authorization, assuming it is deployed in a secure internal environment or would be added later via an API gateway.
2. **PostgreSQL Single Instance:** The architecture assumes a single PostgreSQL instance that handles the load. For a truly massive scale, this might need read replicas or partitioning, but for the scope of the assessment, it handles the concurrency and row locking efficiently.
3. **Task Payloads:** It assumes job payloads are relatively small JSON objects that can be stored natively in the `jobs` table without external blob storage (like S3).
4. **Worker Statelessness:** Workers don't persist job states locally. They execute the provided payload and return the result. If a worker dies mid-execution, the result is completely lost and the job will be retried by another worker.
