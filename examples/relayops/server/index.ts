import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const vite = await createViteServer({ root, configFile: path.join(root, 'vite.config.ts'), server: { middlewareMode: true }, appType: 'spa' });
const { createRuntime } = await vite.ssrLoadModule('/server/runtime.ts') as { createRuntime: (root: string) => Promise<any> };
const runtime = await createRuntime(root);

const app = express();
app.use(express.json({ limit: '2mb' }));
app.post('/routier', async (request, response) => {
  const tenant = String(request.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const result = await runtime.handle(request.body, tenant);
  response.status(result.ok ? 200 : 403).json(result);
});
app.get('/api/status', async (_request, response) => response.json(await runtime.status()));
app.use(vite.middlewares);

const port = Number(process.env.PORT ?? 5198);
const server = app.listen(port, '127.0.0.1', () => console.log(`RelayOps running at http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => { runtime.store[Symbol.dispose](); process.exit(0); }));
