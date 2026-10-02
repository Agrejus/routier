import { useCallback, useRef, useState } from 'react';
import type { Note, NoteStore } from '../notes';

export type NotesClient = {
  store: NoteStore;
  rows: Note[];
  drafts: Record<string, string>;
  message: string;
  setDraft: (id: string, title: string) => void;
  setMessage: (message: string) => void;
  load: () => Promise<void>;
  save: () => Promise<void>;
  replace: () => void;
};

export const readNotes = (store: NoteStore): Promise<Note[]> => store.notes.sort(note => note.id).toArrayAsync();

const snapshot = (rows: Note[]): Note[] => rows.map(row => ({ id: row.id, title: row.title, version: row.version }));

export const useNotesClient = (create: () => NoteStore): NotesClient => {
  const [store, setStore] = useState(create);
  const tracked = useRef<Note[]>([]);
  const [rows, setRows] = useState<Note[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    tracked.current = await readNotes(store);
    setRows(snapshot(tracked.current));
  }, [store]);

  const save = useCallback(async () => {
    for (const entity of tracked.current) {
      const draft = drafts[entity.id];

      if (draft != null && draft !== entity.title) {
        entity.title = draft;
      }
    }

    setDrafts({});
    await store.saveChangesAsync();
    setRows(snapshot(tracked.current));
  }, [drafts, store]);

  const setDraft = useCallback((id: string, title: string) => setDrafts(current => ({ ...current, [id]: title })), []);

  const replace = useCallback(() => {
    tracked.current = [];
    setStore(create());
    setRows([]);
    setDrafts({});
    setMessage('');
  }, [create]);

  return { store, rows, drafts, message, setDraft, setMessage, load, save, replace };
};
