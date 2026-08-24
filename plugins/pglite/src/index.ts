import { rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite, type Extensions } from '@electric-sql/pglite';
import type { PostgresDriver } from '@routier/postgres-plugin-core';
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
 *
 * `destroy` closes the database and deletes its data directory, like every other embedded
 * plugin here. It does not behave like `@routier/postgresql-plugin`, which disconnects from a
 * server it does not own.
 */
export class PGliteDbPlugin extends PostgresDbPluginBase {
    constructor(databaseName: string, options: PGliteDbPluginOptions = {}) {
        super(resolveDriver(databaseName, options.extensions));
    }
}

type Registered = { driver: PostgresDriver; extensions: string };

/**
 * One engine per data directory, shared by every store over it.
 *
 * Two PGlite instances over one directory is worse than the wasted boot it saves — they are two
 * writers over one set of files, and the driver's serialisation only covers the instance it was
 * given. Entries are never evicted: `destroy` closes the engine, deletes the directory and
 * leaves the entry cold, and a store that shares it opens a fresh one on its next operation.
 */
const drivers = new Map<string, Registered>();

/** Extension *names*, not the object: callers pass a fresh literal for the same set. */
const signature = (extensions?: Extensions): string => Object.keys(extensions ?? {}).sort().join(',');

const resolveDriver = (databaseName: string, extensions?: Extensions): PostgresDriver => {
    const requested = signature(extensions);
    const registered = drivers.get(databaseName);

    if (registered != null) {
        if (registered.extensions !== requested) {
            throw new Error(
                `'${databaseName}' is already open with a different set of extensions ` +
                `('${registered.extensions || 'none'}'). One engine serves a data directory, so the second set ` +
                `would be ignored; open a different directory instead.`
            );
        }

        return registered.driver;
    }

    const driver = pgliteDriver(
        databaseName,
        () => PGlite.create(databaseName, { extensions }) as Promise<PGliteLike>,
        {
            name: 'pglite',
            deleteStorage: () => deleteDataDirectory(databaseName),
        }
    );

    drivers.set(databaseName, { driver, extensions: requested });

    return driver;
};

/** `memory://` has nothing on disk. Everything else is a directory PGlite created. */
const deleteDataDirectory = async (dataDir: string): Promise<void> => {
    if (dataDir.startsWith('memory://') || dataDir === '') {
        return;
    }

    const path = resolve(dataDir.startsWith('file://') ? fileURLToPath(dataDir) : dataDir);

    refuseUnsafeDelete(path);

    // Not `force`: a directory that is already gone should be visible, not indistinguishable
    // from one that was deleted.
    await rm(path, { recursive: true }).catch(error => {
        if ((error as { code?: string }).code !== 'ENOENT') {
            throw error;
        }
    });
};

/**
 * `destroy` deletes recursively, so a data directory that is really the working directory or the
 * root would take everything with it. PGlite would not have created either.
 */
const refuseUnsafeDelete = (path: string): void => {
    const forbidden = [resolve('.'), resolve(process.cwd()), parseRoot(path)];

    if (forbidden.includes(path)) {
        throw new Error(
            `Refusing to delete '${path}' on destroy: it is the working directory or a filesystem root, ` +
            `not a data directory PGlite created. Give the plugin a directory of its own.`
        );
    }
};

const parseRoot = (path: string): string => path.split(sep)[0] + sep;
