import type { WireEntry } from '../src/wire';

const CAPACITY = 200;

export class WireLog {
  private entries: WireEntry[] = [];
  private nextId = 1;

  record(entry: Omit<WireEntry, 'id'>): void {
    this.entries = [...this.entries, { ...entry, id: this.nextId }].slice(-CAPACITY);
    this.nextId += 1;
  }

  list(): WireEntry[] {
    return this.entries;
  }

  clear(): void {
    this.entries = [];
  }
}
