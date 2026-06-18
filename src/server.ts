import http from 'http';
import { app } from './app';
import { waitForDatabase } from './db/pool';
import { runMigrations } from './db/migrate';
import { handleUpgrade } from './ws/connection-manager';
import { startReaper } from './modules/scheduler/reaper';

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

server.on('upgrade', handleUpgrade);

async function startServer() {
  try {
    await waitForDatabase();
    await runMigrations();
    
    startReaper();

    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
