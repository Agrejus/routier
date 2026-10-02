import { BulkPersistChanges, SchemaCollection } from '@routier/core/collections';
import { OptimisticConcurrencyError } from '@routier/core/errors';
import { ConcurrencyDbPlugin, type IDbPlugin } from '@routier/core/plugins';
import { Result } from '@routier/core/results';
import { uuid } from '@routier/core/utilities';
import { type Note, type NoteRoot, noteSchema, NoteStore, seedNotes } from '../src/notes';

export type NotePatch = { id: string; version: number; title?: string | undefined };

export type GuardedSave =
  | { kind: 'saved'; rows: Note[] }
  | { kind: 'conflict'; message: string }
  | { kind: 'failed'; message: string };

const schemas = new SchemaCollection().set(noteSchema.id, noteSchema);

export class NotesRepository {
  private readonly store: NoteStore;
  private readonly guarded: ConcurrencyDbPlugin;

  constructor(plugin: IDbPlugin) {
    this.store = new NoteStore(plugin);
    this.guarded = new ConcurrencyDbPlugin(plugin);
  }

  all(): Promise<Note[]> {
    return this.store.notes.sort(note => note.id).toArrayAsync();
  }

  async seed(): Promise<void> {
    if ((await this.all()).length > 0) {
      return;
    }

    await this.store.notes.addAsync(...seedNotes);
    await this.store.saveChangesAsync();
  }

  async reset(): Promise<void> {
    await this.store.notes.removeAllAsync();
    await this.store.saveChangesAsync();
    await this.seed();
  }

  async editOnServer(id: string): Promise<Note | null> {
    const note = await this.store.notes.firstOrUndefinedAsync(([row, params]) => row.id === params.id, { id });

    if (note == null) {
      return null;
    }

    note.title = `${note.title.replace(/ · server edit \d+$/, '')} · server edit ${note.version + 1}`;
    await this.store.saveChangesAsync();
    return note;
  }

  async saveGuarded(patches: NotePatch[]): Promise<GuardedSave> {
    const stored = await this.all();
    const merged = patches.flatMap(patch => {
      const row = stored.find(candidate => candidate.id === patch.id);
      return row == null ? [] : [{ id: row.id, title: patch.title ?? row.title, version: patch.version }];
    });

    if (merged.length !== patches.length) {
      return { kind: 'conflict', message: 'A note in this save no longer exists.' };
    }

    return this.persistGuarded(merged);
  }

  private persistGuarded(updates: Note[]): Promise<GuardedSave> {
    const operation = new BulkPersistChanges();
    operation.resolve<NoteRoot>(noteSchema.id).updates.push(...updates.map(entity => ({ entity, changeType: 'markedDirty' as const, delta: {} })));

    return new Promise(resolve => {
      this.guarded.bulkPersist({ id: uuid(8), schemas, operation, source: 'etag-lab', action: 'persist' }, result => {
        if (result.ok === Result.ERROR) {
          resolve(OptimisticConcurrencyError.is(result.error)
            ? { kind: 'conflict', message: result.error.message }
            : { kind: 'failed', message: String(result.error) });
          return;
        }

        resolve({ kind: 'saved', rows: result.data.get<Note>(noteSchema.id)?.updates ?? [] });
      });
    });
  }
}
