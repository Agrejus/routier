import { DbPluginEvent, EphemeralDataPlugin } from 'routier-core/plugins';
import { CallbackResult, PluginEventCallbackResult, PluginEventResult, Result } from 'routier-core/results';
import { CompiledSchema } from 'routier-core/schema';
import { BrowserStorageCollection } from './BrowserStorageCollection';
import { AsyncPipeline } from 'routier-core';

export class BrowserStoragePlugin extends EphemeralDataPlugin {

    private readonly storage: Storage;

    constructor(databaseName: string, storage: Storage) {
        super(databaseName);
        this.storage = storage;
    }

    protected override resolveCollection<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        return new BrowserStorageCollection(this.storage, this.databaseName, schema);
    }

    override destroy<TEntity extends {}>(event: DbPluginEvent<TEntity>, done: PluginEventCallbackResult<never>): void {
        try {
            const pipeline = new AsyncPipeline<null, never>();

            for (const [, schema] of event.schemas) {
                const collection = this.resolveCollection(schema);
                pipeline.pipe(null, (_, done) => collection.destroy(done))
            }

            pipeline.filter((result) => {

                if (result.ok === Result.ERROR) {
                    done(PluginEventResult.error(event.id, result.error));
                    return;
                }

                done(PluginEventResult.success(event.id));
            });
        } catch (e: any) {
            done(PluginEventResult.error(event.id, e));
        }
    }
}