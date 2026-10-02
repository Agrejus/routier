import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const chromePath = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';

export type LabProcess = { origin: string; stop: () => Promise<void> };

const freePort = () => new Promise<number>((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    probe.close(() => (address != null && typeof address === 'object' ? resolve(address.port) : reject(new Error('no port'))));
  });
});

const waitForStart = (child: ChildProcess) => new Promise<void>((resolve, reject) => {
  let output = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    output += String(chunk);

    if (output.includes('etag lab running')) {
      resolve();
    }
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    output += String(chunk);
  });
  child.once('exit', code => reject(new Error(`the lab server exited with ${code}: ${output}`)));
});

export const startLabProcess = async (): Promise<LabProcess> => {
  const directory = mkdtempSync(path.join(tmpdir(), 'etag-lab-ui-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'tsx', path.join(root, 'server/index.ts')], {
    cwd: root,
    env: { ...process.env, PORT: String(port), ETAG_LAB_DB: path.join(directory, 'lab.sqlite') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForStart(child);

  return {
    origin: `http://127.0.0.1:${port}`,
    stop: async () => {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill('SIGTERM');
      await exited;
      rmSync(directory, { recursive: true, force: true });
    },
  };
};

export const launchChrome = (): Promise<Browser> =>
  chromium.launch(existsSync(chromePath) ? { executablePath: chromePath, headless: true } : { headless: true });
