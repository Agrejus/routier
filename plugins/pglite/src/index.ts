import { PGlite, type Extensions } from '@electric-sql/pglite';
import { PostgresDbPluginBase } from '@routier/postgres-plugin-core';
import { pgliteDriver, PGliteLike } from './drivers/pglite';

export type { PGliteLike, PGliteDriverOptions } from './drivers/pglite';
export { pgliteDriver } from './drivers/pglite';
export { pgliteDbPlugin } from './shared';

export type PGliteDbPluginOptions = {
    /**
     * Extensions to load into PGlite.
     *
     * Pass `{ vector }` from `@electric-sql/pglite-pgvector` to get a real `vector(n)` column
     * and `<=>` ordering. Without it a `s.vector()` property still works — the embedding is
     * stored as JSONB and the similarity search runs in memory.
     */
    extensions?: Extensions;
};

/**
 * PostgreSQL in WebAssembly, in this process.
 *
 * `databaseName` is PGlite's data directory, and its prefix chooses the storage:
 *
 *   new PGliteDbPlugin('memory://app')     // discarded when the process exits
 *   new PGliteDbPlugin('./data/app')       // a directory on disk
 *
 * There is deliberately no separate `storage` option. The prefix already says where the data
 * lives, and a second way to say it is a second thing that can disagree.
 *
 * This is the Node build. A browser resolves the `browser` condition in this package's
 * manifest and gets the worker-backed OPFS one instead; see `index.browser.ts`.
 */
export class PGliteDbPlugin extends PostgresDbPluginBase {
    constructor(databaseName: string, options: PGliteDbPluginOptions = {}) {
        super(pgliteDriver(
            databaseName,
            PGlite.create(databaseName, { extensions: options.extensions }) as Promise<PGliteLike>,
            { name: 'pglite' }
        ));
    }
}
