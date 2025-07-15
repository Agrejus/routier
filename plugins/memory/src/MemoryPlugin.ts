import { IDbPlugin, CompiledSchema, InferCreateType, DeepPartial, JsonTranslator, DbPluginQueryEvent, assertIsArray, TrampolinePipeline, IQuery, CallbackResult, Result, CallbackPartialResult, ResolvedChanges, DbPluginBulkPersistEvent, SchemaId, PartialResultType } from "routier-core";
import { DbCollection } from "./DbCollection";
import { MemoryDatabase } from ".";

const dbs: Record<string, MemoryDatabase> = {}

type ForEachPayload<TEntity extends {}, TShape extends unknown = TEntity> = {
    event: DbPluginQueryEvent<TEntity, TShape>,
    results: TShape,
    error?: any
}

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
            dbs[this.dbName][schema.collectionName] = new DbCollection(schema);
        }

        return dbs[this.dbName][schema.collectionName];
    }

    seed<TEntity extends {}>(schema: CompiledSchema<TEntity>, data: Record<string, unknown>[]) {
        const collection = this.resolveCollection(schema);
        collection.seed(data);
    }

    destroy(done: (error?: any) => void): void {
        dbs[this.dbName] = {};
        done();
    }

    private _persist<TRoot extends {}>(payload: PartialResultType<{ schemaIds: number[], schemas: Map<SchemaId, CompiledSchema<TRoot>>, index: number, resolvedChanges: ResolvedChanges<TRoot> }>, done: CallbackPartialResult<{ schemaIds: number[], schemas: Map<SchemaId, CompiledSchema<TRoot>>, index: number, resolvedChanges: ResolvedChanges<TRoot> }>) {

        try {

            if (payload.ok !== Result.SUCCESS) {
                done(payload);
                return;
            }

            const { index, resolvedChanges, schemaIds, schemas } = payload.data;
            const schemaId = schemaIds[index];
            const schema = schemas.get(schemaId);

            const result = resolvedChanges.toResult();
            const changes = resolvedChanges.changes.get(schemaId);
            const schemaResult = result.result.get(schemaId);
            const { adds, hasChanges, removes, updates } = changes;

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

            for (const removal of removes.entities) {
                collection.remove(removal);
                schemaResult.removed.count += 1;
            }

            this._getRemovalsByQueries(schemas, removes.queries, (r, e) => {

                try {

                    payload.data.index++; // Move Next

                    const removals = [...removes.entities, ...r];

                    for (let i = 0, length = removals.length; i < length; i++) {
                        collection.remove(removals[i]);
                    }

                    schemaResult.removed.count += removals.length;

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
            const pipeline = new TrampolinePipeline<PartialResultType<{ schemaIds: number[], schemas: Map<SchemaId, CompiledSchema<TRoot>>, index: number, resolvedChanges: ResolvedChanges<TRoot> }>>();

            for (let i = 0, length = schemaIds.length; i < length; i++) {
                pipeline.pipe(this._persist.bind(this))
            }

            pipeline.filter<PartialResultType<{ schemaIds: number[], schemas: Map<SchemaId, CompiledSchema<TRoot>>, index: number, resolvedChanges: ResolvedChanges<TRoot> }>>({
                data: {
                    index: 0,
                    resolvedChanges: event.operation as ResolvedChanges<TRoot>, // send in the pending changes and let's add to the map
                    schemaIds,
                    schemas
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

    private _pipelineQuery<TEntity extends {}, TShape extends unknown = TEntity>(payload: ForEachPayload<TEntity, TShape>, done: CallbackResult<TShape>): void {

        const { event, results } = payload;
        this.query(event, (result) => {

            if (result.ok === Result.ERROR) {
                // any error will terminate the pipeline
                done(result);
                return;
            }

            assertIsArray(result.data);
            assertIsArray(results);

            results.push(result);

            done(Result.success(results));
        })
    }

    private _getRemovalsByQueries<T extends {}>(schemas: Map<SchemaId, CompiledSchema<T>>, queries: IQuery<T, T>[], done: (entities: T[], error?: any) => void) {

        if (queries.length === 0) {
            done([]); // Do nothing, handle null here for readability above
            return;
        }

        const pipeline = new TrampolinePipeline<ForEachPayload<T, T>>();

        for (let i = 0, length = queries.length; i < length; i++) {
            const query = queries[i];
            const queryEvent: DbPluginQueryEvent<T, T> = {
                schemas,
                operation: query
            }

            pipeline.pipe((payload, done) => this._pipelineQuery<T, T>({
                event: queryEvent,
                results: payload.results
            }, done));
        }

        pipeline.filter<T[]>({
            event: null,
            results: null
        }, (r, e) => {

            if (e) {
                done([], e);
                return;
            }

            done(r);
        })
    }

    [Symbol.dispose](): void {
        dbs[this.dbName] = {};
    }
}