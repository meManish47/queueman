# AI Agent Context

## Development Approach
I heavily utilized AI pair programming to bootstrap the core logic, generate boilerplate code, and implement the frontend interface. The main focus was on architecting a reliable system that solves the core problems of a distributed queue (locking, concurrent claims, heartbeat monitoring, and fencing tokens) and using AI to accelerate the implementation of that architecture.

## AI Tools Used
- Google Gemini (specifically via an Agentic Coding environment called Antigravity IDE)
- AI was used for both planning (generating architecture ideas) and execution (writing the code files, running terminal commands, testing, and debugging).

## Workflows & Prompts
1. **Architecting:** I started by outlining the core requirement: a job execution platform. I prompted the AI to help me design a robust concurrency model using PostgreSQL's `SELECT ... FOR UPDATE SKIP LOCKED` to avoid using a dedicated broker like Redis/BullMQ.
2. **Backend Scaffolding:** Prompted the agent to scaffold a Node.js/TypeScript backend, setting up the `pg` driver, database migrations, and WebSocket endpoints.
3. **Frontend Dashboard:** I provided the agent with my design aesthetic (dark mode, clean, dynamic) and asked it to generate a React/Vite dashboard using Tailwind CSS that reads from the API endpoints.
4. **Testing & Simulation:** Prompts were used to generate a `worker-simulator.ts` script to act as a pool of workers connecting over WebSockets, allowing me to easily test the job assignments and crash recovery visually in the dashboard.

## Agent Autonomy
The AI agent operated in an autonomous loop, where it would read the local file system, suggest architectural decisions, write the code directly into the workspace, and run `npm test` and `git` commands. My role was primarily guiding the high-level architecture constraints and reviewing the output to ensure it met the assessment criteria.
