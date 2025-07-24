import { IDbPlugin, CompiledSchema, InferCreateType, DeepPartial, JsonTranslator, DbPluginQueryEvent, assertIsArray, TrampolinePipeline, IQuery, CallbackResult, Result, CallbackPartialResult, ResolvedChanges, DbPluginBulkPersistEvent, SchemaId, PartialResultType, DbPluginHelper } from "routier-core";
import { DbCollection } from "./DbCollection";
import { MemoryDatabase } from ".";

const dbs: Record<string, MemoryDatabase> = {}

export class MemoryPlugin implements IDbPlugin, Disposable {

    private readonly dbName: string;
    private readonly helpers: DbPluginHelper;

    constructor(dbName?: string) {
        this.dbName = dbName ?? "__routier-memory-plugin-db__";

        if (dbs[this.dbName] == null) {
            dbs[this.dbName] = {}
        }

        this.helpers = new DbPluginHelper(this);
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
            dbs[this.dbName][schema.collectionName] = new DbCollection(schema);
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

    private _persist<TRoot extends {}>(payload: PartialResultType<{ schema: CompiledSchema<TRoot>, schemas: Map<SchemaId, CompiledSchema<TRoot>>, resolvedChanges: ResolvedChanges<TRoot> }>, done: CallbackPartialResult<{ schema: CompiledSchema<TRoot>, schemas: Map<SchemaId, CompiledSchema<TRoot>>, resolvedChanges: ResolvedChanges<TRoot> }>) {

        try {

            if (payload.ok !== Result.SUCCESS) {
                done(payload);
                return;
            }

            const { resolvedChanges, schema, schemas } = payload.data;

            const schemaChanges = resolvedChanges.changes.get(schema.id);
            const schemaResult = resolvedChanges.result.get(schema.id);
            const { adds, hasChanges, removes, updates } = schemaChanges;

            if (hasChanges === false) {
                done(payload);
                return;
            }

            const collection = this.resolveCollection(schema);

            for (let i = 0, length = adds.entities.length; i < length; i++) {
                collection.add(adds.entities[i]);
                schemaResult.adds.entities.push(adds.entities[i] as DeepPartial<InferCreateType<TRoot>>);
            }

            for (const change of updates.changes) {
                collection.update(change.entity);
                schemaResult.updates.entities.push(change.entity);
            }

            this.helpers.resolveRemovalQueries(schemas, removes.queries, (r) => {

                try {

                    if (r.ok === Result.ERROR) {
                        done(Result.error(r.error))
                        return;
                    }

                    const removals = [...removes.entities, ...r.data];

                    for (let i = 0, length = removals.length; i < length; i++) {
                        collection.remove(removals[i]);
                    }

                    schemaResult.removes.count += removals.length;

                    done(payload);
                } catch (e) {
                    done(Result.error(e));
                }
            });
        } catch (e) {
            done(Result.error(e));
        }
    }

    bulkPersist<TRoot extends {}>(event: DbPluginBulkPersistEvent<TRoot>, done: CallbackPartialResult<ResolvedChanges<TRoot>>) {

        const { schemas } = event;

        try {
            const schemaIds = [...event.operation.changes.entries()].map(x => x[0])
            const pipeline = new TrampolinePipeline<PartialResultType<{ schema: CompiledSchema<TRoot>, schemas: Map<SchemaId, CompiledSchema<TRoot>>, resolvedChanges: ResolvedChanges<TRoot> }>>();

            for (let i = 0, length = schemaIds.length; i < length; i++) {
                // Need an easier way to do this!
                pipeline.pipe((payload, done) => this._persist({
                    ...payload,
                    schema: 
                }, done))
            }

            pipeline.filter<PartialResultType<{ schema: CompiledSchema<TRoot>, schemas: Map<SchemaId, CompiledSchema<TRoot>>, resolvedChanges: ResolvedChanges<TRoot> }>>({
                data: {
                    resolvedChanges: event.operation.toResult(), // send in the pending changes and let's add to the map
                    schemas,
                    schema: null as any // we send this in above
                },
                ok: Result.SUCCESS
            }, (r, e) => {
                if (e != null) {
                    done(Result.error(e));
                    return;
                }

                if (r.ok === Result.ERROR) {
                    done(Result.error(r.error));
                    return;
                }

                if (r.ok === Result.PARTIAL) {
                    done(Result.partial(r.data.resolvedChanges, r.error));
                    return;
                }

                done(Result.success(r.data.resolvedChanges))
            })

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