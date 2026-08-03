import fs from 'node:fs';
import path from 'node:path';
import { DbPluginEvent, EphemeralDataPlugin } from '@routier/core/plugins';
import { PluginEventCallbackResult, PluginEventResult } from '@routier/core/results';
import { CompiledSchema } from '@routier/core/schema';
import { FileSystemDbCollection } from './FileSystemDbCollection';

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
        return path.join(this.path, this.databaseName);
    }

    protected override resolveCollection<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        return new FileSystemDbCollection(this.databaseFilePath, schema);
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

                done(PluginEventResult.success(event.id));
            });
        } catch (e: any) {
            done(PluginEventResult.error(event.id, e));
        }
    }
}