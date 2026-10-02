import type { Note } from '../src/notes';

export class Replica {
  private snapshot: Note[] | null = null;

  get lagging(): boolean {
    return this.snapshot != null;
  }

  get rows(): Note[] | null {
    return this.snapshot;
  }

  freeze(rows: Note[]): void {
    this.snapshot = rows.map(row => ({ ...row }));
  }

  release(): void {
    this.snapshot = null;
  }
}
