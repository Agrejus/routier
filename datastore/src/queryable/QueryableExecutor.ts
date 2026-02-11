import { DbPluginQueryEvent, ITranslatedValue, JsonTranslator, Query, QueryOptionsCollection } from "@routier/core/plugins";
import { InferType } from "@routier/core/schema";
import { CallbackResult, PluginEventCallbackResult, PluginEventResult, PluginEventSuccessType, Result } from "@routier/core/results";
import { logger, uuid } from "@routier/core/utilities";
import { CollectionDependencies, RequestContext } from "../collections/types";
import { QueryBuilderBase } from "./base/QueryBuilderBase";
import { assertIsArray } from "@routier/core";

export abstract class QueryableExecutor<TRoot extends {}, TShape> extends QueryBuilderBase<TRoot, TShape, CollectionDependencies<TRoot>> {

    constructor(dependencies: CollectionDependencies<TRoot>, request: RequestContext<TRoot>) {
        super(dependencies, request)
    }

    // Cannot change the root type, it comes from the collection type, only the resulting type (shape)
    protected create<Shape, TInstance extends QueryableExecutor<TRoot, Shape>>(
        Instance: new (dependencies: CollectionDependencies<TRoot>, request: RequestContext<TRoot>) => TInstance) {
        return new Instance(this.dependencies, this.request);
    }

    private resolveQueryOptions<T>() {
        if (this.dependencies.scopedQueryOptions.items.size === 0) {
            return this.request.queryOptions;
        }

        // Combine scoped options with the built query
        const resolvedQueryOptions = new QueryOptionsCollection<T>();

        // Add scoped items first
        this.dependencies.scopedQueryOptions.forEach(item => {
            resolvedQueryOptions.add(item.name, item.value);
        });

        // Add query options last to ensure we perform scoped operations first
        // in case we have any memory execution targets
        this.request.queryOptions.forEach(item => {
            resolvedQueryOptions.add(item.name, item.value);
        });

        return resolvedQueryOptions;
    }

    protected _remove<U>(done: CallbackResult<TShape[]>) {

        this.getData<TShape[]>(r => {

            if (r.ok === Result.ERROR) {
                return done(r);
            }

            this.dependencies.changeTracker.remove(r.data as InferType<TRoot>[], null, removeResult => {

                if (removeResult.ok === Result.ERROR) {
                    return done(removeResult);
                }

                return done(Result.success(removeResult.data as TShape[]));
            });
        });

        return this.subscribeQuery<TShape[]>(done) as U;
    }

    protected subscribeQuery<U>(done: CallbackResult<U>) {

        if (this.request.isSubScribed === false) {
            return () => { };
        }

        const { databaseEvent, memoryEvent } = this.createQueryPayload<U>();

        return this.dependencies.dataBridge.subscribe<U, unknown>(databaseEvent, (r) => {

            if (r.ok === Result.ERROR) {
                done(r);
                return;
            }

            this.postProcessQuery(r, { databaseEvent, memoryEvent }, done);
        });
    }

    protected createQueryPayload<Shape>(): { memoryEvent: DbPluginQueryEvent<TRoot, Shape>, databaseEvent: DbPluginQueryEvent<TRoot, Shape> } {

        // send over only the database operations, if there are none its a select all
        const splitQueryOptions = this.resolveQueryOptions<Shape>().split();

        return {
            databaseEvent: {
                operation: new Query<TRoot, Shape>(splitQueryOptions.database as any, this.dependencies.schema),
                schemas: this.dependencies.schemas,
                id: uuid(8),
                source: "Collection",
                action: "query"
            },
            memoryEvent: {
                operation: new Query<TRoot, Shape>(splitQueryOptions.memory as any, this.dependencies.schema),
                schemas: this.dependencies.schemas,
                id: uuid(8),
                source: "Collection",
                action: "query"
            }
        }
    }

    protected getData<TShape>(done: PluginEventCallbackResult<TShape>) {

        const { databaseEvent, memoryEvent } = this.createQueryPayload<TShape>();

        this.dependencies.dataBridge.query<TShape>(databaseEvent, (result) => {

            if (result.ok === PluginEventResult.ERROR) {
                done(result);
                return;
            }

            this.postProcessQuery<TShape>(result, { databaseEvent, memoryEvent }, done);
        });
    }

    private postProcessQuery<TShape>(result: PluginEventSuccessType<ITranslatedValue<TShape>>, payload: { databaseEvent: DbPluginQueryEvent<TRoot, TShape>, memoryEvent: DbPluginQueryEvent<TRoot, TShape> }, done: PluginEventCallbackResult<TShape>) {

        const { databaseEvent, memoryEvent } = payload;

        try {

            const tags = this.dependencies.changeTracker.tags.get();

            this.dependencies.changeTracker.tags.destroy();

            if (databaseEvent.operation.changeTracking === true) {
                // Post process the db query results
                result.data.forEach(item => this.dependencies.schema.postprocess(item as InferType<TRoot>, this.request.changeTrackingType));
            }

            // This means we are querying on a computed property that is untracked, need to select
            // all and query in memory
            if (Query.isEmpty(memoryEvent.operation) === false) {

                const enriched = result.data.value as InferType<TRoot>[];

                // We need to execute operations on the result that the plugin will not do
                const translator = new JsonTranslator(memoryEvent.operation);
                const translatedEnrichedData = translator.translate(enriched);

                if (memoryEvent.operation.changeTracking === false) {
                    return done(PluginEventResult.success(memoryEvent.id, translatedEnrichedData.value));
                }

                // Resolve the data with the current attachments - optimized: use for loop instead of forEach
                assertIsArray(translatedEnrichedData.value);

                for (let i = 0, length = translatedEnrichedData.value.length; i < length; i++) {
                    this.dependencies.changeTracker.resolve(translatedEnrichedData.value[i] as InferType<TRoot>, tags, {
                        merge: true
                    });
                }

                return done(PluginEventResult.success(memoryEvent.id, translatedEnrichedData.value));
            }

            // No change tracking on the result, just return it as is
            if (databaseEvent.operation.changeTracking === false) {
                return done(PluginEventResult.success(databaseEvent.id, result.data.value as TShape));
            }

            // Resolve the data with the current attachments
            result.data.forEach(item => this.dependencies.changeTracker.resolve(item as InferType<TRoot>, tags, {
                merge: true
            }));

            done(PluginEventResult.success(databaseEvent.id, result.data.value));
        } catch (e) {
            done(PluginEventResult.error(databaseEvent.id, e));
        }
    }
}   