import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import { validateWorkerToken } from '../modules/workers/workers.service';
import { handleConnection } from './handlers';

export const wss = new WebSocketServer({ noServer: true });

export async function handleUpgrade(request: IncomingMessage, socket: any, head: Buffer) {
  const { pathname, query } = parse(request.url || '', true);
  
  if (pathname === '/ws/worker') {
    const workerId = query.worker_id as string;
    const token = query.token as string;

    if (!workerId || !token) {
      socket.write('HTTP/1.1 401 Unauthorized\\r\\n\\r\\n');
      socket.destroy();
      return;
    }

    const isValid = await validateWorkerToken(workerId, token);
    if (!isValid) {
      socket.write('HTTP/1.1 401 Unauthorized\\r\\n\\r\\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, workerId);
    });
  } else {
    socket.destroy();
  }
}

wss.on('connection', (ws: WebSocket, request: IncomingMessage, workerId: string) => {
  handleConnection(ws, workerId);
});
