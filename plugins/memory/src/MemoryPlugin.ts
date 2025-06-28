import { IDbPlugin, CompiledSchema, EntityModificationResult, InferCreateType, DeepPartial, InferType, JsonTranslator, DbPluginBulkOperationsEvent, DbPluginQueryEvent, EntityChanges, assertIsArray, DbPluginEvent, TrampolinePipeline, IQuery } from "routier-core";
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

    bulkOperations<TEntity extends {}>(
        event: DbPluginBulkOperationsEvent<TEntity>,
        done: (result: EntityModificationResult<TEntity>, error?: any) => void) {

        const { operation, } = event;
        const { adds, removes, updates } = operation;

        try {
            const processedAdditions = this._processAdds(event, adds);
            const processUpdates = this._processUpdates(event, updates);
            this._processRemovals(event, removes, (r, e) => {

                if (e != null) {
                    done({
                        adds: processedAdditions,
                        removedCount: 0,
                        updates: processUpdates
                    }, e)
                    return;
                }

                done({
                    adds: processedAdditions,
                    removedCount: r,
                    updates: processUpdates

                });
            });
        } catch (e: any) {
            done({
                adds: [],
                removedCount: 0,
                updates: []
            }, e)
        }
    }

    private _processAdds<TEntity extends {}>(event: DbPluginBulkOperationsEvent<TEntity>, adds: EntityChanges<TEntity>["adds"]) {
        const result: DeepPartial<InferCreateType<TEntity>>[] = [];
        const collection = this.resolveCollection(event.schema);

        for (let i = 0, length = adds.entities.length; i < length; i++) {
            collection.add(adds.entities[i]);
            result.push(adds.entities[i] as DeepPartial<InferCreateType<TEntity>>);
        }

        return result;
    }

    private _processUpdates<TEntity extends {}>(event: DbPluginBulkOperationsEvent<TEntity>, updates: EntityChanges<TEntity>["updates"]) {
        const result: InferType<TEntity>[] = [];
        const collection = this.resolveCollection(event.schema);

        for (const [, { doc }] of updates.entities) {
            collection.update(doc);
            result.push(doc);
        }

        return result;
    }

    private _processRemovals<TEntity extends {}>(event: DbPluginBulkOperationsEvent<TEntity>, removes: EntityChanges<TEntity>["removes"], done: (removed: number, error?: any) => void) {
        const collection = this.resolveCollection(event.schema);

        this._getRemovalsByQueries(event, removes.queries, (r, e) => {

            try {
                const removals = [...removes.entities, ...r];

                for (let i = 0, length = removals.length; i < length; i++) {
                    collection.remove(removals[i]);
                }

                done(removals.length);
            } catch (e) {
                done(0, e);
            }
        })
    }

    query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: (result: TShape, error?: any) => void): void {

        try {
            const { operation, schema } = event;
            const translator = new JsonTranslator<TEntity, TShape>(operation);
            const collection = this.resolveCollection(schema);
            // translate if we are doing any operations like count/sum/min/max/skip/take
            const translated = translator.translate(collection.records);

            done(translated);

        } catch (e) {
            done(null, e);
        }
    }

    private _pipelineQuery<TEntity extends {}, TShape extends unknown = TEntity>(payload: ForEachPayload<TEntity, TShape>, done: (results: TShape, error?: any) => void): void {

        const { event, results } = payload;
        this.query(event, (result, error) => {

            if (error) {
                // any error will terminate the pipeline
                done(results, error);
                return;
            }

            assertIsArray(result);
            assertIsArray(results);

            results.push(result);

            done(results);
        })
    }

    // we need a plugin base!
    private _getRemovalsByQueries<T extends {}>(event: DbPluginEvent<T>, queries: IQuery<T, T>[], done: (entities: T[], error?: any) => void) {

        if (queries.length === 0) {
            done([]); // Do nothing, handle null here for readability above
            return;
        }

        const pipeline = new TrampolinePipeline<ForEachPayload<T, T>>();

        for (let i = 0, length = queries.length; i < length; i++) {
            const query = queries[i];
            const queryEvent: DbPluginQueryEvent<T, T> = {
                parent: event.parent,
                schema: event.schema,
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