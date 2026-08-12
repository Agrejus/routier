import fs from 'node:fs';
import path from 'node:path';
import { DbPluginEvent, EphemeralDataPlugin } from '@routier/core/plugins';
import { PluginEventCallbackResult, PluginEventResult } from '@routier/core/results';
import { CompiledSchema } from '@routier/core/schema';
import { FileSystemDbCollection } from './FileSystemDbCollection';

/**
 * One collection instance per (database path, collection name), process-wide — the same
 * registry MemoryPlugin keeps by database name.
 *
 * The registry is what makes concurrent writers converge. A save is a read-modify-write of
 * the whole collection file, and a per-persist collection instance gives every concurrent
 * writer its own view of the "read" step: ten stores over one database each read the empty
 * file, write their own rows, and the last write wins the whole file (defect #18). With one
 * shared in-memory collection per file, every writer mutates the same map and stringifies it
 * after its own mutation, so any later write is a superset of every earlier one.
 *
 * The boundary this creates: a file-system database belongs to ONE process. After the first
 * read the in-memory view is authoritative and the file is write-only, so rows written by
 * another process are never observed. Cross-process sharing needs a real database.
 */
const databases: Record<string, Record<string, FileSystemDbCollection>> = {};

export class FileSystemPlugin extends EphemeralDataPlugin {

    private path: string;

    constructor(path: string, databaseName: string) {
        super(databaseName)
        this.path = path;

        // Create the directory if it doesn't exist
        if (!fs.existsSync(this.path)) {
            fs.mkdirSync(this.path, { recursive: true });
        }
    }

    private get databaseFilePath() {
        return path.join(this.path, this._databaseName);
    }

    /** Registry key: the resolved path, so two spellings of one directory share a database. */
    private get databaseKey() {
        return path.resolve(this.databaseFilePath);
    }

    /**
     * The resolved path, not the bare file name: `orders.json` in two directories is two
     * databases, and scoping subscriptions by the name alone would let them notify each other.
     * Same value as the registry key, which is the same question asked about collections.
     */
    override get databaseName(): string {
        return this.databaseKey;
    }

    protected override resolveCollection<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        const key = this.databaseKey;

        if (databases[key] == null) {
            databases[key] = {};
        }

        if (databases[key][schema.collectionName] == null) {
            databases[key][schema.collectionName] = new FileSystemDbCollection(this.databaseFilePath, schema);
        }

        return databases[key][schema.collectionName];
    }

    /**
     * True when the database path is a direct child of the configured directory.
     *
     * destroy() removes the database recursively, because a database is a directory of
     * per-collection files. That makes an unexpected path destructive in a way the previous
     * non-recursive delete was not: an empty, "." or "..-containing database name collapses
     * under path.join and would target the parent directory, taking every other database
     * with it. Anything that does not resolve to a direct child is refused.
     */
    private get isDatabasePathSafeToRemove() {
        const parent = path.resolve(this.path);
        const target = path.resolve(this.databaseFilePath);

        return path.dirname(target) === parent && target !== parent;
    }

    override destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        try {
            if (this.isDatabasePathSafeToRemove === false) {
                done(PluginEventResult.error(
                    event.id,
                    new Error(
                        `Refusing to destroy database: "${this.databaseFilePath}" is not a direct child of "${this.path}". ` +
                        `A recursive delete outside the configured directory would remove unrelated databases.`
                    )
                ));
                return;
            }

            // databaseFilePath is a directory: resolveCollection writes one JSON file per
            // collection inside it. `unlink` fails on a directory (EPERM on macOS,
            // EISDIR on Linux), so destroy has to remove the tree. `force` additionally
            // makes an already-absent database a success, which is destroy's goal anyway.
            fs.rm(this.databaseFilePath, { recursive: true, force: true }, (e) => {
                if (e) {
                    done(PluginEventResult.error(event.id, e));
                    return;
                }

                // The shared in-memory view goes with the files, or the next store over
                // this database would resurrect every destroyed row from the registry.
                delete databases[this.databaseKey];

                done(PluginEventResult.success(event.id));
            });
        } catch (e: any) {
            done(PluginEventResult.error(event.id, e));
        }
    }
}