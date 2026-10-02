import { labApi } from '../labApi';
import type { WireEntry } from '../wire';

const POLL_MS = 100;
const ATTEMPTS = 40;
const SETTLE_MS = 150;

const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

const latestGet = (entries: WireEntry[], client: string): WireEntry | undefined =>
  entries.filter(entry => entry.client === client && entry.method === 'GET').at(-1);

export const lastGetId = async (client: string): Promise<number> => latestGet(await labApi.log(), client)?.id ?? 0;

export const waitForGetAfter = async (client: string, afterId: number): Promise<WireEntry | null> => {
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const entry = latestGet(await labApi.log(), client);

    if (entry != null && entry.id > afterId) {
      await sleep(SETTLE_MS);
      return entry;
    }

    await sleep(POLL_MS);
  }

  return null;
};

export const waitUntil = async (condition: () => Promise<boolean>): Promise<boolean> => {
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    if (await condition()) {
      return true;
    }

    await sleep(POLL_MS);
  }

  return false;
};
