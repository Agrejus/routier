import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRuntime, type LabRuntime } from '../server/runtime';

export type LabServer = { origin: string; runtime: LabRuntime; stop: () => Promise<void> };

export const startLabServer = async (): Promise<LabServer> => {
  const directory = mkdtempSync(path.join(tmpdir(), 'etag-lab-'));
  const runtime = await createRuntime(path.join(directory, 'lab.sqlite'));
  const server = runtime.app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();
  const port = address != null && typeof address === 'object' ? address.port : 0;

  return {
    origin: `http://127.0.0.1:${port}`,
    runtime,
    stop: async () => {
      await new Promise(resolve => server.close(resolve));
      rmSync(directory, { recursive: true, force: true });
    },
  };
};
