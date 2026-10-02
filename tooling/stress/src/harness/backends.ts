import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { MemoryPlugin } from '@routier/memory-plugin';
import { FileSystemPlugin } from '@routier/file-system-plugin';
import { SqliteDbPlugin } from '@routier/sqlite-plugin';

/**
 * Plugin factories and their scale budgets.
 *
 * Scenarios are written once and run across backends, but "the same load" is not the same
 * cost. Two constraints force per-backend scaling, and both are properties of the storage
 * engine rather than of Routier:
 *
 *  - FileSystemPlugin rewrites one JSON file per collection on every save. A run of B
 *    batches over N entities therefore writes O(B x N) bytes — quadratic in the entity
 *    count, not linear. At 100k entities in 1k batches that is on the order of a terabyte
 *    of file writes, which no 5-minute budget survives.
 *  - SqliteDbPlugin is synchronous against a real file, so every batch pays fsync.
 *
 * Reducing the load rather than the backend list is the right trade: the invariants under
 * test (no silent drops, correct aggregates, no id collisions) are not volume-specific,
 * and dropping a backend would lose them entirely. `volumeBudget` is what each backend
 * gets, and it is printed in the scale banner so a failure is never read at the wrong
 * scale.
 */

export type BackendName = 'memory' | 'file-system' | 'sqlite';

export type Backend = {
    readonly name: BackendName;
    /** Rich types: booleans, dates, arrays, nested objects held natively. */
    readonly supportsRichTypes: boolean;
    /** Entity count this backend is exercised at in the volume scenarios. */
    readonly volumeBudget: number;
    /** A plugin against a fresh, uniquely named database. */
    create(): IDbPlugin;
    /** A second plugin against the SAME database as `create`'s most recent call. */
    createShared(databaseName: string): IDbPlugin;
    /** A database name usable with `createShared`. */
    newDatabaseName(): string;
};

/** Directories and files created by the factories, removed by `cleanupBackendArtifacts`. */
const artifacts: string[] = [];

const tempDirectory = () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-stress-'));
    artifacts.push(directory);
    return directory;
};

export const memoryBackend: Backend = {
    name: 'memory',
    supportsRichTypes: true,
    volumeBudget: 100_000,
    newDatabaseName: () => `stress-memory-${uuidv4()}`,
    // MemoryPlugin's `dbs` registry is process-global by name, so an unnamed or reused
    // database silently shares state with every other scenario in the same worker.
    create: () => new MemoryPlugin(memoryBackend.newDatabaseName()),
    createShared: databaseName => new MemoryPlugin(databaseName),
};

export const fileSystemBackend: Backend = {
    name: 'file-system',
    supportsRichTypes: true,
    // See the header: whole-file rewrites make this quadratic in the entity count.
    volumeBudget: 5_000,
    newDatabaseName: () => `stress-fs-${uuidv4()}`,
    create: () => fileSystemBackend.createShared(fileSystemBackend.newDatabaseName()),
    createShared: databaseName => new FileSystemPlugin(sharedFileSystemRoot(), databaseName),
};

/**
 * One directory per process, so `createShared` can hand two plugins the same database.
 * FileSystemPlugin resolves a database to `<root>/<databaseName>`; a per-call temp root
 * would make the same name two different databases.
 */
let fileSystemRoot: string | null = null;
const sharedFileSystemRoot = () => {
    if (fileSystemRoot == null) {
        fileSystemRoot = tempDirectory();
    }
    return fileSystemRoot;
};

export const sqliteBackend: Backend = {
    name: 'sqlite',
    // SQLite has no boolean, date, array, or object column type, and the plugin declines
    // rich types in its own contract run (plugins/sqlite/src/tests/contract.test.ts).
    supportsRichTypes: false,
    volumeBudget: 20_000,
    newDatabaseName: () => path.join(tempDirectory(), `${uuidv4()}.sqlite`),
    create: () => new SqliteDbPlugin(sqliteBackend.newDatabaseName()),
    createShared: databaseName => new SqliteDbPlugin(databaseName),
};

export const ALL_BACKENDS: readonly Backend[] = [memoryBackend, fileSystemBackend, sqliteBackend];

/** Backends that can hold booleans, dates, arrays, and nested objects. */
export const RICH_BACKENDS = ALL_BACKENDS.filter(b => b.supportsRichTypes);

/**
 * Removes every temp directory a factory created.
 *
 * Call from `afterAll`. Leaving them behind fills the temp volume across a full stress
 * run — the SQLite files alone reach hundreds of megabytes.
 */
export function cleanupBackendArtifacts() {
    for (const artifact of artifacts.splice(0)) {
        fs.rmSync(artifact, { recursive: true, force: true });
    }
    fileSystemRoot = null;
}
