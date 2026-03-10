import { assertIsNotNull } from '../assertions';
import { BulkPersistResult } from '../collections';
import { WorkPipeline } from '../pipeline';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, JsonTranslator } from '.';
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
            const bulkPersistResult = event.operation.toResult();
            const schemas = event.schemas;
            const pipeline = new WorkPipeline();
            let hasWork = false;

            for (const [schemaId, changes] of event.operation) {
                const { adds, hasItems, removes, updates } = changes;

                if (!hasItems) {
                    continue;
                }

                hasWork = true;
                const result = bulkPersistResult.get(schemaId);
                const schema = schemas.get(schemaId);
                assertIsNotNull(schema);

                pipeline.pipe((d) => {
                    try {
                        const collection = this.resolveCollection(schema);
                        const addsLength = adds.length;
                        const updatesLength = updates.length;
                        const removesLength = removes.length;

                        // Only need to load if we have updates or removes (need existing data)
                        // For adds-only operations, we can skip load for better performance
                        const needsLoad = updatesLength > 0 || removesLength > 0;

                        const processChanges = () => {
                            result.adds = Array.from({ length: addsLength });
                            result.updates = Array.from({ length: updatesLength });
                            result.removes = Array.from({ length: removesLength });

                            for (let j = 0; j < addsLength; j++) {
                                const item = adds[j];
                                collection.add(item);
                                result.adds[j] = item as DeepPartial<InferCreateType<UnknownRecord>>;
                            }

                            for (let j = 0; j < updatesLength; j++) {
                                const item = updates[j].entity;
                                collection.update(item);
                                result.updates[j] = item;
                            }

                            for (let j = 0; j < removesLength; j++) {
                                collection.remove(removes[j]);
                                result.removes[j] = removes[j];
                            }

                            collection.save(saveResult => {
                                if (saveResult.ok === Result.ERROR) {
                                    d(saveResult);
                                    return;
                                }
                                d(Result.success());
                            });
                        };

                        if (needsLoad) {
                            collection.load(readResult => {
                                if (readResult.ok === Result.ERROR) {
                                    d(readResult);
                                    return;
                                }
                                processChanges();
                            });
                        } else {
                            // Skip load for adds-only operations
                            processChanges();
                        }
                    } catch (e) {
                        d(Result.error(e));
                    }
                });
            }

            // If there is no work, just return the result
            if (!hasWork) {
                done(PluginEventResult.success(event.id, bulkPersistResult));
                return;
            }

            pipeline.filter((result) => {
                if (result.ok === Result.ERROR) {
                    done(PluginEventResult.error(event.id, result.error));
                    return;
                }
                done(PluginEventResult.success(event.id, bulkPersistResult));
            });
        } catch (e: any) {
            done(PluginEventResult.error(event.id, e));
        }
    }

    query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        try {
            const operation = event.operation;
            const schema = operation.schema;
            const translator = new JsonTranslator<TEntity, TShape>(operation);
            const collection = this.resolveCollection(schema);

            collection.load(r => {
                if (r.ok === Result.ERROR) {
                    done(PluginEventResult.error(event.id, r.error));
                    return;
                }

                const records = collection.records;
                const length = records.length;
                const cloned: Record<string, unknown>[] = Array.from({ length });

                for (let i = 0; i < length; i++) {
                    cloned[i] = schema.clone(records[i] as InferType<TEntity>);
                }

                done(PluginEventResult.success(event.id, translator.translate(cloned)));
            });
        } catch (e) {
            done(PluginEventResult.error(event.id, e));
        }
    }

    abstract destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void;
}