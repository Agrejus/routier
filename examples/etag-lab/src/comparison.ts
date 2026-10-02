import type { Note } from './notes';
import type { RowVersion } from './wire';

export type RowOutcome = { id: string; served: number; local: number; verdict: 'kept-local' | 'took-server' | 'same' };

const verdictOf = (served: number, local: number): RowOutcome['verdict'] => {
  if (served < local) {
    return 'kept-local';
  }

  return served > local ? 'took-server' : 'same';
};

export const compareServed = (served: RowVersion[], before: Note[]): RowOutcome[] =>
  served.flatMap(row => {
    const local = before.find(note => note.id === row.id);
    return local == null ? [] : [{ id: row.id, served: row.version, local: local.version, verdict: verdictOf(row.version, local.version) }];
  });

export const describeOutcome = (outcome: RowOutcome): string => {
  switch (outcome.verdict) {
    case 'kept-local':
      return `${outcome.id}: server sent v${outcome.served}, kept the newer local v${outcome.local}`;
    case 'took-server':
      return `${outcome.id}: server sent v${outcome.served}, replaced local v${outcome.local}`;
    case 'same':
      return `${outcome.id}: both at v${outcome.local}`;
  }
};
