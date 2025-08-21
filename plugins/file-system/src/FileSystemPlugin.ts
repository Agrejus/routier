import fs from 'node:fs';
import path from 'node:path';
import { DbPluginEvent, EphemeralDataPlugin } from 'routier-core/plugins';
import { CallbackResult, PluginEventCallbackResult, PluginEventResult, Result } from 'routier-core/results';
import { CompiledSchema } from 'routier-core/schema';
import { FileSystemDbCollection } from './FileSystemDbCollection';

export class FileSystemPlugin extends EphemeralDataPlugin {

    private path: string;

    constructor(path: string, databaseName: string) {
        super(databaseName)
        this.path = path;
    }

    private get databaseFilePath() {
        return path.join(this.path, this.databaseName);
    }

    protected override resolveCollection<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        return new FileSystemDbCollection(this.databaseFilePath, schema);
    }

    override destroy<TEntity extends {}>(event: DbPluginEvent<TEntity>, done: PluginEventCallbackResult<never>): void {
        try {
            fs.unlink(this.databaseFilePath, (e) => {
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