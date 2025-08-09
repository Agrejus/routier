import { MemoryDatabase } from ".";
import { DbPluginBulkPersistEvent, DbPluginQueryEvent, IDbPlugin, JsonTranslator } from "routier-core/plugins";
import { CompiledSchema, InferCreateType } from "routier-core/schema";
import { CallbackPartialResult, CallbackResult, Result } from "routier-core/results";
import { CollectionChanges, MemoryCollection, ResolvedChanges } from "routier-core/collections";
import { AsyncPipeline } from "routier-core/pipeline";
import { DeepPartial } from "routier-core/types";

const dbs: Record<string, MemoryDatabase> = {}

export class MemoryPlugin implements IDbPlugin, Disposable {

    private readonly dbName: string;

    constructor(dbName?: string) {
        this.dbName = dbName ?? "__routier-memory-plugin-db__";

        if (dbs[this.dbName] == null) {
            dbs[this.dbName] = {}
        }
    }

    get size() {
        let count = 0;

        for (const collectionName in this.database) {
            count += this.database[collectionName].size;
        }

        return count;
    }

    private get database() {
        return dbs[this.dbName];
    }

    private resolveCollection<TEntity extends {}>(schema: CompiledSchema<TEntity>) {

        if (dbs[this.dbName][schema.collectionName] == null) {
            dbs[this.dbName][schema.collectionName] = new MemoryCollection(schema);
        }

        return dbs[this.dbName][schema.collectionName];
    }

    seed<TEntity extends {}>(schema: CompiledSchema<TEntity>, data: Record<string, unknown>[]) {
        const collection = this.resolveCollection(schema);
        collection.seed(data);
    }

    destroy(done: CallbackResult<never>): void {
        dbs[this.dbName] = {};
        done(Result.success());
    }

    bulkPersist<TRoot extends {}>(event: DbPluginBulkPersistEvent<TRoot>, done: CallbackPartialResult<ResolvedChanges<TRoot>>) {
        try {
            const pipeline = new AsyncPipeline<CollectionChanges<TRoot>, void>();
            const operationResult = event.operation.toResult();

            for (const schemaId of event.operation.changes.schemaIds) {
                const changes = event.operation.changes.get(schemaId);
                const schemaResult = operationResult.result.get(schemaId);

                pipeline.pipe(changes, (r, d) => {
                    try {

                        const { adds, hasChanges, removes, updates } = r;

                        if (hasChanges === false) {
                            d(Result.success());
                            return;
                        }

                        const schema = event.schemas.get(schemaId);
                        const collection = this.resolveCollection(schema);

                        for (let i = 0, length = adds.entities.length; i < length; i++) {
                            collection.add(adds.entities[i]);
                            schemaResult.adds.entities.push(adds.entities[i] as DeepPartial<InferCreateType<TRoot>>);
                        }

                        for (let i = 0, length = updates.changes.length; i < length; i++) {
                            collection.update(updates.changes[i].entity);
                            schemaResult.updates.entities.push(updates.changes[i].entity);
                        }

                        for (let i = 0, length = removes.entities.length; i < length; i++) {
                            collection.remove(removes.entities[i]);
                            schemaResult.removes.entities.push(removes.entities[i]);
                        }

                        d(Result.success());
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

                done(Result.success(operationResult));
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
            const translated = translator.translate(collection.records);

            done(Result.success(translated));

        } catch (e) {
            done(Result.error(e));
        }
    }

    [Symbol.dispose](): void {
        dbs[this.dbName] = {};
    }
}