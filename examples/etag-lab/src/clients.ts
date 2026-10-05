import { ConcurrencyDbPlugin } from '@routier/core/plugins';
import { uuid } from '@routier/core/utilities';
import { MemoryPlugin } from '@routier/memory-plugin';
import { createRetry, HttpSwrDbPlugin, HttpTransportDbPlugin, OptimisticUpdatesDbPlugin, type SyncEvent } from '@routier/replication-plugin';
import { z } from 'zod';
import { notesParser, NoteStore } from './notes';
import { clientHeader } from './wire';

export type SwrClientName = 'swr' | 'replica';

export type SwrReport = (line: string) => void;

const savedParser = z.object({ saved: notesParser });

const headersFor = (client: string) => () => ({ [clientHeader]: client });

const transport = (client: string) => new HttpTransportDbPlugin({
  url: `${window.location.origin}/routier`,
  databaseName: 'etag-lab',
  getHeaders: headersFor(client),
});

export const createConflictClient = (client: 'alice' | 'bob'): NoteStore => new NoteStore(new ConcurrencyDbPlugin(transport(client)));

export const createOptimisticClient = (): NoteStore => new NoteStore(new OptimisticUpdatesDbPlugin(transport('optimistic')));

const describeEvent = (event: SyncEvent): string[] => {
  if (event.type !== 'changes-rejected') {
    return [];
  }

  const rejected = `${event.changes.length} change(s) rejected. The next read takes the server copy.`;
  return event.conflict ? [`Conflict: ${event.error.message}`, rejected] : [rejected];
};

export const createSwrPlugin = (client: SwrClientName, conditionalRevalidation: boolean, report: SwrReport): HttpSwrDbPlugin =>
  new HttpSwrDbPlugin(new MemoryPlugin(`${client}-cache-${uuid(8)}`), {
    getUrl: collection => `${window.location.origin}/rest/${collection}`,
    getHeaders: headersFor(client),
    unsyncedQueueStore: new MemoryPlugin(`${client}-queue-${uuid(8)}`),
    conditionalRevalidation,
    maxAgeMs: 0,
    postOnPersist: false,
    writeBatchDelayMs: 0,
    translatePersistResponse: (_schema, body) => {
      const parsed = savedParser.safeParse(body);
      return parsed.success ? parsed.data.saved : null;
    },
    onError: createRetry({ maxAttempts: 1 }),
    onEvent: event => describeEvent(event).forEach(report),
  });
