import { describeFullTextSearch } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { SqliteDbPlugin } from '../index';

/**
 * SQLite has FTS5 and this feature deliberately does not use it — see "Why the engine's own
 * search is out" in specs/full-text-search.md. What the engine does provide is the `IN` that
 * narrows index rows, which is the same query path every other filter takes.
 */
describeFullTextSearch('sqlite', () => new SqliteDbPlugin(`fts-${uuidv4()}.sqlite`));
