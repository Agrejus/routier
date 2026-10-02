import { createHash } from 'node:crypto';
import type { Note } from '../src/notes';

export const queryEtag = (rows: Note[]): string => {
  const versions = rows.map(row => [row.id, row.version]).sort(([a], [b]) => String(a).localeCompare(String(b)));
  return `"${createHash('sha256').update(JSON.stringify(versions)).digest('base64url').slice(0, 16)}"`;
};
