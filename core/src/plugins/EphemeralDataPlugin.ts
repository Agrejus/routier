import { assertIsNotNull } from '../assertions';
import { BulkPersistResult } from '../collections';
import { WorkPipeline } from '../pipeline';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, JsonTranslator } from '.';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from '../results';
import { CompiledSchema, InferCreateType, InferType } from '../schema';
import { DeepPartial } from '../types';
import { MemoryDataCollection } from '../collections/MemoryDataCollection';
import { UnknownRecord } from '../utilities';

export abstract class EphemeralDataPlugin implements IDbPlugin {

    protected databaseName: string;

    constructor(databaseName: string) {
        this.databaseName = databaseName;
    }

    protected abstract resolveCollection<TEntity extends {}>(schema: CompiledSchema<TEntity>): MemoryDataCollection;

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>) {
        try {
            const pipeline = new WorkPipeline();
            const bulkPersistResult = event.operation.toResult();

            for (const [schemaId, changes] of event.operation) {

                pipeline.pipe((d) => {
                    try {

                        const { adds, hasItems, removes, updates } = changes;

                        if (hasItems === false) {
                            d(Result.success());
                            return;
                        }

                        const result = bulkPersistResult.get(schemaId);
                        const schema = event.schemas.get(schemaId);

                        assertIsNotNull(schema);

                        const collection = this.resolveCollection(schema);
                        collection.load(readResult => {

                            if (readResult.ok === Result.ERROR) {
                                d(readResult);
                                return;
                            }

                            for (let i = 0, length = adds.length; i < length; i++) {
                                collection.add(adds[i]);
                                result.adds.push(adds[i] as DeepPartial<InferCreateType<UnknownRecord>>);
                            }

                            for (let i = 0, length = updates.length; i < length; i++) {
                                collection.update(updates[i].entity);
                                result.updates.push(updates[i].entity);
                            }

                            for (let i = 0, length = removes.length; i < length; i++) {
                                collection.remove(removes[i]);
                                result.removes.push(removes[i]);
                            }

                            collection.save(saveResult => {

                                if (saveResult.ok === Result.ERROR) {
                                    d(saveResult);
                                    return;
                                }

                                d(Result.success());
                            });
                        })

                    } catch (e) {
                        d(Result.error(e));
                    }
                });
            }

            let successCount = 0;

            pipeline.filter((asyncResult) => {

                if (asyncResult.ok !== PluginEventResult.SUCCESS) {

                    if (successCount === 0) {
                        done(PluginEventResult.error(event.id, asyncResult.error))
                        return;
                    }

                    done(PluginEventResult.partial(event.id, bulkPersistResult, asyncResult.error))
                    return;
                }

                successCount++;

                done(PluginEventResult.success(event.id, bulkPersistResult));
            });
        } catch (e: any) {
            done(PluginEventResult.error(event.id, e))
        }
    }

    query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: PluginEventCallbackResult<TShape>): void {

        try {
            const { operation } = event;
            const translator = new JsonTranslator<TEntity, TShape>(operation);
            const collection = this.resolveCollection(operation.schema);

            // translate if we are doing any operations like count/sum/min/max/skip/take
            collection.load(r => {

                if (r.ok === Result.ERROR) {
                    done(PluginEventResult.error(event.id, r.error));
                    return;
                }

                debugger;
                const cloned: Record<string, unknown>[] = [];

                for (let i = 0, length = collection.records.length; i < length; i++) {
                    cloned.push(event.operation.schema.clone(collection.records[0] as InferType<TEntity>));
                }

                const translated = translator.translate(JSON.parse(JSON.stringify(collection.records)));

                done(PluginEventResult.success(event.id, translated));
            })
        } catch (e) {
            done(PluginEventResult.error(event.id, e));
        }
    }

    abstract destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void;
}