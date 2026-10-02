import { ConcurrencyDbPlugin } from '@routier/core/plugins';
import { uuid } from '@routier/core/utilities';
import { MemoryPlugin } from '@routier/memory-plugin';
import { HttpSwrDbPlugin, HttpTransportDbPlugin, OptimisticUpdatesDbPlugin } from '@routier/replication-plugin';
import { z } from 'zod';
import { notesParser, NoteStore } from './notes';
import { clientHeader } from './wire';

export type SwrClientName = 'swr' | 'replica';

export type SwrEvents = { onConflict: (message: string) => void; onDeadLetter: (count: number) => void };

const savedParser = z.object({ saved: notesParser });

const headersFor = (client: string) => () => ({ [clientHeader]: client });

const transport = (client: string) => new HttpTransportDbPlugin({
  url: `${window.location.origin}/routier`,
  databaseName: 'etag-lab',
  getHeaders: headersFor(client),
});

export const createConflictClient = (client: 'alice' | 'bob'): NoteStore => new NoteStore(new ConcurrencyDbPlugin(transport(client)));

export const createOptimisticClient = (): NoteStore => new NoteStore(new OptimisticUpdatesDbPlugin(transport('optimistic')));

export const createSwrPlugin = (client: SwrClientName, conditionalRevalidation: boolean, events: SwrEvents): HttpSwrDbPlugin =>
  new HttpSwrDbPlugin(new MemoryPlugin(`${client}-cache-${uuid(8)}`), {
    getUrl: collection => `${window.location.origin}/rest/${collection}`,
    getHeaders: headersFor(client),
    unsyncedQueueStore: new MemoryPlugin(`${client}-queue-${uuid(8)}`),
    conditionalRevalidation,
    maxAgeMs: 0,
    autoSync: false,
    postOnPersist: false,
    writeBatchDelayMs: 0,
    bulkPersistRetryMaxAttempts: 1,
    translatePersistResponse: (_schema, body) => {
      const parsed = savedParser.safeParse(body);
      return parsed.success ? parsed.data.saved : null;
    },
    onConflict: ({ error }) => events.onConflict(error.message),
    onSyncDeadLetter: changes => events.onDeadLetter(changes.length),
  });
