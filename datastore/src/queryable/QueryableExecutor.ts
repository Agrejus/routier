import { DbPluginQueryEvent, ITranslatedValue, JsonTranslator, Query, QueryOptionsCollection } from "@routier/core/plugins";
import { InferType } from "@routier/core/schema";
import { CallbackResult, PluginEventCallbackResult, PluginEventResult, PluginEventSuccessType, Result } from "@routier/core/results";
import { uuid } from "@routier/core/utilities";
import { CollectionDependencies, RequestContext } from "../collections/types";
import { QueryBuilderBase } from "./base/QueryBuilderBase";

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

        // The membership getter is what lets the bridge detect rows LEAVING this
        // subscriber's result set (defect #24) — the filter alone only sees rows entering.
        return this.dependencies.dataBridge.subscribe<U, unknown>(databaseEvent, (r) => {

            if (r.ok === Result.ERROR) {
                done(r);
                return;
            }

            this.postProcessQuery(r, { databaseEvent, memoryEvent }, done);
        }, () => this.lastDeliveredIds);
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

    /**
     * Attaches query results, and for immutable collections hands back frozen values.
     *
     * **The callback's return value matters.** `TranslatedArrayValue.forEach` reassigns each
     * slot to whatever the callback returns — it is a map-in-place, which is how results get
     * normalized to canonical attachment refs. A block body that returns nothing silently
     * leaves the plugin's own objects in the array, so later mutations land on something the
     * change tracker has never seen and the save reports zero changes.
     *
     * Two things differ by mode, and the second depends on the first:
     *
     *  - **adopt, not merge.** The proxy path merges a re-read into the canonical instance so
     *    callers holding it observe fresh data. Merging writes into that object, which cannot
     *    work once it is frozen — so the immutable path adopts the freshly read value as the
     *    new canonical instead. That is also the right semantics for it: an immutable read
     *    produces a new value and there is nothing to merge into. `update()` is unaffected,
     *    because it resolves rows by id rather than by object identity.
     *  - **freeze.** `changeTrackingType === "immutable"` never actually froze anything
     *    (defect #17): the enricher builds a `"freeze"` block that nothing fills. Doing it
     *    here rather than in codegen keeps it off the add path, where `mergeChanges` has to
     *    write assigned identities back into the entity it just persisted.
     *
     * Without freezing, a plain `entity.price = 5` on an immutable collection was silently
     * lost — untracked because there is no proxy, unrejected because nothing was frozen.
     */
    private attachResults(items: { forEach(callback: (item: unknown) => unknown): void }, tags: unknown) {
        const immutable = this.request.changeTrackingType === "immutable";
        const options = immutable ? { adopt: true } : { merge: true };

        // `forEach` rather than for..of: the translated values expose that and are not
        // iterable, and the shape differs between array, group and single results.
        items.forEach(item => {
            const attached = this.dependencies.changeTracker.resolve(item as InferType<TRoot>, tags, options);

            return immutable ? this.dependencies.schema.freeze(attached) : attached;
        });
    }

    /**
     * Ids of the rows this executor last delivered — the subscriber's view of its own
     * result set, kept for leave-detection (defect #24). `null` means membership is
     * unknowable (scalar, aggregate, or projected results), in which case the bridge falls
     * back to filter-only matching.
     */
    private lastDeliveredIds: ReadonlySet<unknown> | null = null;

    /** Records which rows a delivery contained, when the delivered shape allows it. */
    private captureDeliveredMembership(value: unknown) {
        if (this.request.isSubScribed === false) {
            return;
        }

        try {
            if (Array.isArray(value)) {
                const ids = new Set<unknown>();

                for (const item of value) {
                    if (item == null || typeof item !== "object") {
                        this.lastDeliveredIds = null;
                        return;
                    }

                    ids.add(this.dependencies.schema.getId(item as InferType<TRoot>));
                }

                this.lastDeliveredIds = ids;
                return;
            }

            if (value != null && typeof value === "object") {
                this.lastDeliveredIds = new Set([this.dependencies.schema.getId(value as InferType<TRoot>)]);
                return;
            }

            this.lastDeliveredIds = null;
        } catch {
            this.lastDeliveredIds = null;
        }
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
                    this.captureDeliveredMembership(translatedEnrichedData.value);
                    return done(PluginEventResult.success(memoryEvent.id, translatedEnrichedData.value));
                }

                // Normalize to canonical attachment refs regardless of translated value shape.
                this.attachResults(translatedEnrichedData, tags);

                this.captureDeliveredMembership(translatedEnrichedData.value);
                return done(PluginEventResult.success(memoryEvent.id, translatedEnrichedData.value));
            }

            // No change tracking on the result, just return it as is
            if (databaseEvent.operation.changeTracking === false) {
                this.captureDeliveredMembership(result.data.value);
                return done(PluginEventResult.success(databaseEvent.id, result.data.value as TShape));
            }

            // Normalize to canonical attachment refs regardless of translated value shape.
            this.attachResults(result.data, tags);

            this.captureDeliveredMembership(result.data.value);
            done(PluginEventResult.success(databaseEvent.id, result.data.value));
        } catch (e) {
            done(PluginEventResult.error(databaseEvent.id, e));
        }
    }
}   