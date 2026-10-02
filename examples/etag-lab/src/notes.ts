import type { IDbPlugin } from '@routier/core/plugins';
import { etags, type InferRoot, type InferType, s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { z } from 'zod';

export const noteSchema = s.define('notes', {
  id: s.string().key(),
  title: s.string(),
  version: s.number().etag(etags.numeric),
}).compile();

export type Note = InferType<typeof noteSchema>;

export type NoteRoot = InferRoot<typeof noteSchema>;

export const noteParser = z.object({ id: z.string(), title: z.string(), version: z.number() });

export const notesParser = z.array(noteParser);

export const seedNotes = [
  { id: 'roadmap', title: 'Q4 roadmap' },
  { id: 'launch', title: 'Launch checklist' },
  { id: 'retro', title: 'Sprint retro' },
];

export class NoteStore extends DataStore {
  notes = this.collection(noteSchema).proxy().create();

  constructor(plugin: IDbPlugin) {
    super(plugin);
  }
}
