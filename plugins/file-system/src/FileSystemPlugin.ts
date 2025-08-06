import fs from 'node:fs';
import path from 'node:path';
import { assertIsNotNull } from 'routier-core';
import { CollectionChanges, CollectionChangesResult, ResolvedChanges } from 'routier-core/collections';
import { AsyncPipeline } from 'routier-core/pipeline';
import { DbPluginBulkPersistEvent, DbPluginQueryEvent, IDbPlugin, JsonTranslator } from 'routier-core/plugins';
import { CallbackPartialResult, CallbackResult, Result, toPromise } from 'routier-core/results';
import { CompiledSchema, InferCreateType, SchemaId } from 'routier-core/schema';
import { DeepPartial } from 'routier-core/types';
import { FileSystemDbCollection } from './FileSystemDbCollection';

export class FileSystemPlugin implements IDbPlugin, AsyncDisposable {

    private path: string;
    private databaseName: string;

    constructor(path: string, databaseName: string) {
        this.path = path;
        this.databaseName = databaseName;
    }

    private get databaseFilePath() {
        return path.join(this.path, this.databaseName);
    }

    private resolveCollection<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        return new FileSystemDbCollection(this.databaseFilePath, schema);
    }

    bulkPersist<TRoot extends {}>(event: DbPluginBulkPersistEvent<TRoot>, done: CallbackPartialResult<ResolvedChanges<TRoot>>) {
        try {
            const pipeline = new AsyncPipeline<CollectionChanges<TRoot>, [SchemaId, CollectionChangesResult<TRoot>]>();

            for (const schemaId of event.operation.changes.schemaIds) {
                const changes = event.operation.changes.get(schemaId);

                assertIsNotNull(changes);

                pipeline.pipe(changes, (r, d) => {
                    try {

                        const { adds, hasChanges, removes, updates } = r;
                        const result = CollectionChangesResult.EMPTY<TRoot>();

                        if (hasChanges === false) {
                            d(Result.success([schemaId, result]));
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

                                d(Result.success([schemaId, result]));
                            });
                        })

                    } catch (e) {
                        d(Result.error(e));
                    }
                });
            }

            pipeline.filter((asyncResult) => {

                if (asyncResult.ok !== Result.SUCCESS) {
                    done(Result.error(asyncResult.error))
                    return;
                }

                const result = event.operation.toResult();

                for (const [schemaId, item] of asyncResult.data) {
                    result.result.set(schemaId, item)
                }

                done(Result.success(result));
            });
        } catch (e: any) {
            done(Result.error(e))
        }
    }

    query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: CallbackResult<TShape>): void {

        try {
            const { operation } = event;
            const translator = new JsonTranslator<TEntity, TShape>(operation);
            const collection = this.resolveCollection(operation.schema);
            // translate if we are doing any operations like count/sum/min/max/skip/take
            collection.load(r => {

                if (r.ok === Result.ERROR) {
                    done(r);
                    return;
                }

                const translated = translator.translate(collection.records);

                done(Result.success(translated));
            })
        } catch (e) {
            done(Result.error(e));
        }
    }

    destroy(done: CallbackResult<never>): void {
        try {
            fs.unlink(this.databaseFilePath, (e) => {
                if (e) {
                    done(Result.error(e));
                    return;
                }

                done(Result.success());
            });
        } catch (e: any) {
            done(Result.error(e));
        }
    }

    async [Symbol.asyncDispose]() {
        return toPromise(this.destroy);
    }
}