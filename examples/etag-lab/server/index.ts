import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { createRuntime } from './runtime';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDirectory = path.join(root, '.data');
mkdirSync(dataDirectory, { recursive: true });

const { app } = await createRuntime(process.env.ETAG_LAB_DB ?? path.join(dataDirectory, 'etag-lab.sqlite'));
const server = createServer(app);
const vite = await createViteServer({ root, configFile: path.join(root, 'vite.config.ts'), server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
app.use(vite.middlewares);

const port = Number(process.env.PORT ?? 5199);
server.listen(port, '127.0.0.1', () => console.log(`etag lab running at http://127.0.0.1:${port}`));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void vite.close();
    server.close(() => process.exit(0));
  });
}
