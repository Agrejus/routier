import { assertIsNotNull } from '../assertions';
import { ResolvedChanges } from '../collections';
import { WorkPipeline } from '../pipeline';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, JsonTranslator } from '.';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from '../results';
import { CompiledSchema, InferCreateType } from '../schema';
import { DeepPartial } from '../types';
import { MemoryDataCollection } from '../collections/MemoryDataCollection';

export abstract class EphemeralDataPlugin implements IDbPlugin {

    protected databaseName: string;

    constructor(databaseName: string) {
        this.databaseName = databaseName;
    }

    protected abstract resolveCollection<TEntity extends {}>(schema: CompiledSchema<TEntity>): MemoryDataCollection;

    bulkPersist<TRoot extends {}>(event: DbPluginBulkPersistEvent<TRoot>, done: PluginEventCallbackPartialResult<ResolvedChanges<TRoot>>) {
        try {
            const pipeline = new WorkPipeline();
            const operationResult = event.operation.toResult();

            for (const schemaId of event.operation.changes.schemaIds) {
                const changes = event.operation.changes.get(schemaId);

                assertIsNotNull(changes);

                pipeline.pipe((d) => {
                    try {

                        const { adds, hasChanges, removes, updates } = changes;

                        if (hasChanges === false) {
                            d(Result.success());
                            return;
                        }

                        const schema = event.schemas.get(schemaId);

                        assertIsNotNull(schema);

                        const collection = this.resolveCollection(schema);
                        collection.load(readResult => {

                            if (readResult.ok === Result.ERROR) {
                                d(readResult);
                                return;
                            }

                            const result = operationResult.result.get(schemaId);

                            for (let i = 0, length = adds.entities.length; i < length; i++) {
                                collection.add(adds.entities[i]);
                                result.adds.entities.push(adds.entities[i] as DeepPartial<InferCreateType<TRoot>>);
                            }

                            for (let i = 0, length = updates.changes.length; i < length; i++) {
                                collection.update(updates.changes[i].entity);
                                result.updates.entities.push(updates.changes[i].entity);
                            }

                            for (let i = 0, length = removes.entities.length; i < length; i++) {
                                collection.remove(removes.entities[i]);
                                result.removes.entities.push(removes.entities[i]);
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

                    done(PluginEventResult.partial(event.id, operationResult, asyncResult.error))
                    return;
                }

                successCount++;

                done(PluginEventResult.success(event.id, operationResult));
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

                const translated = translator.translate(collection.records);

                done(PluginEventResult.success(event.id, translated));
            })
        } catch (e) {
            done(PluginEventResult.error(event.id, e));
        }
    }

    abstract destroy<TEntity extends {}>(event: DbPluginEvent<TEntity>, done: PluginEventCallbackResult<never>): void;
}