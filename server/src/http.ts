import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { health, readiness } from './health.ts';
export function createApp() {
  return createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'GET' && req.url === '/api/health') {
      res.writeHead(200); res.end(JSON.stringify(health()));
    } else if (req.method === 'GET' && req.url === '/api/ready') {
      // Never report readiness until persistent storage and application services are connected.
      res.writeHead(503); res.end(JSON.stringify(readiness()));
    } else {
      res.writeHead(404); res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Endpoint not available.' } }));
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  const app = createApp();
  app.listen(port, '127.0.0.1', () => console.log(`Fendor backend foundation: http://127.0.0.1:${port}/api/health`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.close());
}
