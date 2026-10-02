import { useCallback, useState } from 'react';
import { createSwrPlugin, type SwrClientName } from '../clients';
import { type Note, NoteStore } from '../notes';
import type { WireEntry } from '../wire';
import { lastGetId, waitForGetAfter } from './revalidate';
import { type NotesClient, useNotesClient } from './useNotesClient';

export type SwrRead = { entry: WireEntry | null; before: Note[] };

export type SwrClient = {
  client: NotesClient;
  events: string[];
  read: () => Promise<SwrRead>;
  saveAndSync: () => Promise<void>;
};

export const useSwrClient = (name: SwrClientName, conditionalRevalidation: boolean): SwrClient => {
  const [events, setEvents] = useState<string[]>([]);
  const push = useCallback((line: string) => setEvents(current => [...current, line]), []);
  const [plugin] = useState(() => createSwrPlugin(name, conditionalRevalidation, {
    onConflict: message => push(`Conflict: ${message}`),
    onDeadLetter: count => push(`${count} change(s) dead-lettered. The next read takes the server copy.`),
  }));
  const create = useCallback(() => new NoteStore(plugin), [plugin]);
  const client = useNotesClient(create);

  const read = async (): Promise<SwrRead> => {
    const before = client.rows;
    const afterId = await lastGetId(name);
    await client.load();
    const entry = await waitForGetAfter(name, afterId);
    await client.load();
    return { entry, before };
  };

  const saveAndSync = async () => {
    setEvents([]);
    await client.save();
    const outcome = await plugin.syncNow();
    await client.load();
    push(`Sync: ${outcome.flushed} sent, ${outcome.deadLettered} rejected.`);
  };

  return { client, events, read, saveAndSync };
};
