import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vite = await createServer({ root, configFile: path.join(root, 'vite.config.ts'), server: { middlewareMode: true, hmr: { port: 24679 } }, appType: 'custom' });
try {
  const { smoke, smokeLocal } = await vite.ssrLoadModule('/server/smoke.ts') as { smoke: (url: string) => Promise<unknown>; smokeLocal: () => Promise<unknown> };
  console.log(JSON.stringify({
    local: await smokeLocal(),
    remote: await smoke(process.env.RELAYOPS_URL ?? 'http://127.0.0.1:5198'),
  }, null, 2));
} finally { await vite.close(); }
