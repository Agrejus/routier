/**
 * The worker that actually holds the database.
 *
 * The split is forced, not stylistic. `FileSystemFileHandle.createSyncAccessHandle` is
 * undefined on the main thread, and PGlite's OPFS filesystem is built on it, so a main-thread
 * plugin cannot persist anything to OPFS.
 *
 * `worker()` adds leader election on top of that: every tab connects, one is elected leader
 * and is the only one that opens the database, and the rest proxy their queries to it. When
 * the leader's tab closes another election runs. That is why a second tab works here, where
 * the SQLite plugin's SAH pool takes exclusive handles and simply fails to open.
 *
 * No pgvector. It is a separate package (`@electric-sql/pglite-pgvector`) and an optional peer,
 * and a static import here would make every consumer download it. An application that wants a
 * real `vector` column supplies its own worker through `workerUrl`; see the plugin's README.
 * Without it a `s.vector()` property still works — the embedding goes to JSONB and the
 * similarity search runs in memory.
 *
 * ## The second channel
 *
 * `serveCodedReads` answers routier's own read protocol on this worker's `postMessage`, beside
 * PGlite's proxy rather than instead of it — see `codedReads.ts` for why both are needed and why
 * they cannot collide. It only ever answers in the LEADER's worker: a worker that loses the
 * election never reaches `init`, so `database` stays null there and the caller falls back to the
 * proxy, which reaches the leader the ordinary way.
 */
import { PGlite } from '@electric-sql/pglite';
import { worker } from '@electric-sql/pglite/worker';
import { serveCodedReads } from './codedReads';

/** Set only in the worker that won the election; `init` runs nowhere else. */
let database: PGlite | null = null;

worker({
    async init(options: { dataDir?: string }) {
        database = new PGlite({ dataDir: options.dataDir });

        return database;
    },
});

serveCodedReads(() => database);
