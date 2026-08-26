import { DbPluginQueryEvent, distinctJoinKeys, executeJoin, ExecutedQuery, explainQuery, ITranslatedValue, JoinKind, JsonTranslator, loadJoinInnerSide, Query, QueryExplanation, QueryOptionsCollection, toEntityShape, TupleTranslator, withExecutedQueries } from "@routier/core/plugins";
import { CompiledSchema, InferType } from "@routier/core/schema";
import { CallbackResult, PluginEventCallbackResult, PluginEventResult, PluginEventSuccessType, Result } from "@routier/core/results";
import { UnknownRecord, uuid } from "@routier/core/utilities";
import { GenericFunction } from "@routier/core/types";
import { CollectionDependencies, CollectionRef, JoinTarget, RequestContext } from "../collections/types";
import { QueryBuilderBase } from "./base/QueryBuilderBase";
import { splitTupleFilter } from "./conjuncts";
import { resolveJoinKey } from "./joinKeys";

export abstract class QueryableExecutor<TRoot extends {}, TShape> extends QueryBuilderBase<TRoot, TShape, CollectionDependencies<TRoot>> {

    /** Set by `createQueryPayload`; read by `buildExplanation`. Only used when explaining. */
    private resolvedQueryOptions: QueryOptionsCollection<any> | null = null;
    private executedQueries: ExecutedQuery[] = [];

    constructor(dependencies: CollectionDependencies<TRoot>, request: RequestContext<TRoot>) {
        super(dependencies, request)
    }

    /**
     * The explanation for the query that just ran.
     *
     * Called after the plugin returns, so `executedQueries` holds whatever the backend pushed.
     * A plugin that reports nothing still produces a full explanation — everything except the
     * statements comes from the options.
     */
    protected buildExplanation(): QueryExplanation {
        const options = this.resolvedQueryOptions ?? this.request.queryOptions;
        const explanation = explainQuery(options, {
            collection: this.dependencies.schema.collectionName,
            database: this.dependencies.plugin.databaseName,
            pluginKind: this.dependencies.plugin.constructor.name
        });

        return withExecutedQueries(explanation, this.executedQueries);
    }

    /**
     * Wraps a terminal's callback so its result is delivered with the explanation beside it.
     *
     * Wrapping the CALLBACK rather than each place a terminal calls it: `first`, `some` and the
     * rest shape their result in two separate bodies — one for the initial read, one for a
     * subscription re-delivery — and both go through here.
     */
    protected deliver<T>(done: CallbackResult<any>): CallbackResult<T> {

        if (this.request.isExplained === false) {
            return done as CallbackResult<T>;
        }

        return (result) => {

            if (result.ok === Result.ERROR) {
                done(result);
                return;
            }

            done(Result.success({ data: result.data, explanation: this.buildExplanation() }));
        };
    }

    // Cannot change the root type, it comes from the collection type, only the resulting type (shape)
    protected create<Shape, TInstance extends QueryableExecutor<TRoot, Shape>>(
        Instance: new (dependencies: CollectionDependencies<TRoot>, request: RequestContext<TRoot>) => TInstance) {
        return new Instance(this.dependencies, this.request);
    }

    private resolveQueryOptions<T>() {
        if (this.dependencies.scopedQueryOptions.items.size === 0) {
            return this.splitPostJoinConjuncts(this.request.queryOptions as unknown as QueryOptionsCollection<T>);
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

        return this.splitPostJoinConjuncts(resolvedQueryOptions);
    }

    /**
     * Pushes the single-side halves of a post-join `where` down to the side they belong to.
     *
     * `.where(([p, m]) => p.region === "east" && m.rank > 10)` is correct as written and reads both
     * collections whole. Each conjunct mentions one side only, so each can narrow its own read —
     * the outer one as an ordinary filter ahead of the join, the inner one inside `innerOptions`.
     *
     * **The caller's filter is left exactly where it is.** These are added, not moved, so the
     * original predicate still re-checks every surviving pair. That is what makes the whole
     * optimization safe: a conjunct this classifies wrongly, or fails to classify, costs speed and
     * cannot cost rows. See `conjuncts.ts`.
     *
     * Runs at dispatch rather than at `.where()` because an outer conjunct has to be ordered BEFORE
     * the join option, and options are recorded in call order — by the time the `where` arrives, the
     * join is already behind it.
     */
    private splitPostJoinConjuncts<T>(options: QueryOptionsCollection<T>): QueryOptionsCollection<T> {
        const joinSide = this.request.joinSide;

        if (joinSide == null || options.has("join") === false) {
            return options;
        }

        const { before, at, after } = options.splitAt("join");

        if (at == null) {
            return options;
        }

        const split = after.get("filter").flatMap(({ option }) => splitTupleFilter({
            filter: option.value.filter,
            outerSchema: this.dependencies.schema,
            innerSchema: joinSide.schema
        }));

        if (split.length === 0) {
            return options;
        }

        const rebuilt = new QueryOptionsCollection<T>();

        before.forEach(item => rebuilt.add(item.name, item.value));

        for (const conjunct of split) {
            if (conjunct.side === "outer") {
                rebuilt.add("filter", conjunct.filter as never);
            }
        }

        // A FRESH inner collection: the join option's own belongs to a live collection's scoped
        // options and this query must not append to something the next one will read.
        const innerOptions = new QueryOptionsCollection<unknown>();
        at.value.innerOptions.forEach(item => innerOptions.add(item.name, item.value));

        for (const conjunct of split) {
            if (conjunct.side === "inner") {
                innerOptions.add("filter", conjunct.filter as never);
            }
        }

        rebuilt.add("join", { ...at.value, innerOptions } as never);

        after.forEach(item => rebuilt.add(item.name, item.value));

        return rebuilt;
    }

    /**
     * Records a join — the whole of the API's contribution to the feature.
     *
     * Protected rather than public so it is inherited WITHOUT being offered: `JoinQueryable`
     * extends this class, and a public method here would make chained joins (3+ collections) part
     * of the API before anything supports them.
     *
     * ```ts
     * store.players
     *     .join(s => s.playerMatches, p => p._id, m => m.playerId)
     *     .where(([p, m]) => p.rank > 10 && m.won === true)
     *     .sort(([p, m]) => p.rank)
     *     .map(([p, m]) => ({ name: p.name, matchId: m._id }))
     *     .toArrayAsync();
     * ```
     *
     * The inner side is named by a selector over the STORE, because a store can see its own
     * collections and naming it twice to reach a sibling is noise. A collection on a DIFFERENT
     * store is passed directly instead — see `JoinTarget`, and note that a cross-store join is the
     * one case a selector cannot express.
     *
     * Both key selectors must be a SINGLE property path of type string or number; a shared `TKey`
     * on the public signatures makes a mismatched pair a compile error, and everything else is
     * checked here at build time. Any other condition goes in `.where()` after the join, where it
     * runs over the tuples.
     *
     * A NULLABLE key is accepted — the public signatures take `TKey | null | undefined`, so `TKey`
     * still infers as the underlying `string`/`number` and a mismatched pair still fails to
     * compile. That has to work: a nullable foreign key is the ordinary case, and the semantics
     * are already defined for it (a null key matches nothing, and survives a `leftJoin` paired
     * with `undefined`).
     *
     * Works on every backend, and which one did the work is invisible in the results: a SQL
     * backend emits a real `JOIN`, the rest read the rows they need and pair them in memory. A
     * `.where()` recorded BEFORE the join is an ordinary outer-side filter and still pushes down,
     * so it is a real saving rather than a formality.
     *
     * Results are read-only projections — tuples never attach to the change tracker.
     *
     * Everything decided here is decided ONCE, at build time, so nothing downstream has to
     * negotiate: the keys are resolved and type-checked, the inner side's scopes are captured,
     * and whether any plugin can even receive the option is settled by comparing plugin
     * instances. What follows is an ordinary query option travelling in an ordinary query event.
     *
     * The inner side's scoped options are COPIED. They belong to a live collection that outlives
     * this query, and an option collection is mutable.
     */
    protected setJoinQueryOption<TInner extends {}>(
        kind: JoinKind,
        inner: JoinTarget<any, TInner>,
        outerKeySelector: GenericFunction<any, any>,
        innerKeySelector: GenericFunction<any, any>
    ) {
        const side = this.resolveJoinTarget(inner).joinSide();

        const innerOptions = new QueryOptionsCollection<TInner>();
        side.scopedQueryOptions.forEach(item => innerOptions.add(item.name, item.value));

        this.request.queryOptions.add("join", {
            kind,
            innerSchemaId: side.schema.id,
            outerKey: resolveJoinKey("outer", this.dependencies.schema, outerKeySelector),
            innerKey: resolveJoinKey("inner", side.schema, innerKeySelector),
            innerOptions,
            crossPlugin: this.dependencies.plugin !== side.plugin,
            semiJoinKeyThreshold: this.dependencies.storeOptions.semiJoinKeyThreshold
        });

        this.request.joinSide = { plugin: side.plugin, schema: side.schema };
    }

    /**
     * Turns either form of join target into the collection itself.
     *
     * A `CollectionRef` is an object and a selector is a function, so telling them apart needs no
     * marker. The selector is applied HERE, while the query is being built, which is what makes a
     * store that has no such collection a compile error rather than an empty result.
     */
    private resolveJoinTarget<TInner extends {}>(inner: JoinTarget<any, TInner>): CollectionRef<TInner> {
        if (typeof inner !== "function") {
            return inner;
        }

        if (this.dependencies.store == null) {
            throw new Error(
                "Cannot resolve a join target from a selector: this collection was built without a store reference.  " +
                "Pass the inner collection directly — join(otherCollection, ...) — or create the collection through DataStore.collection()."
            );
        }

        return inner(this.dependencies.store);
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
        const resolvedQueryOptions = this.resolveQueryOptions<Shape>();
        const splitQueryOptions = resolvedQueryOptions.split();

        // Held for `buildExplanation`, which needs the options as resolved: `split()` re-derives
        // each half's execution targets without the options that caused them.
        this.resolvedQueryOptions = resolvedQueryOptions;

        return {
            databaseEvent: {
                operation: new Query<TRoot, Shape>(splitQueryOptions.database as any, this.dependencies.schema),
                schemas: this.dependencies.schemas,
                id: uuid(8),
                source: "Collection",
                action: "query",
                explain: this.request.isExplained,
                // Always handed over, whether or not explaining, so a plugin that reports
                // unconditionally has somewhere to push. Whether anyone sees it is decided
                // here, in `deliver`.
                executedQueries: this.executedQueries = []
            },
            memoryEvent: {
                operation: new Query<TRoot, Shape>(splitQueryOptions.memory as any, this.dependencies.schema),
                schemas: this.dependencies.schemas,
                id: uuid(8),
                source: "Collection",
                // The memory half never reaches a plugin; the fields are required by the shared
                // event type, so they get values nothing reads.
                action: "query",
                explain: false,
                executedQueries: []
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

    /**
     * Runs a set of options over rows or tuples as plain closures.
     *
     * The one pass that works on either shape, which is what a join needs: the options recorded
     * BEFORE it operate on entities and the ones AFTER it on tuples, and both are just the
     * caller's lambdas. See `TupleTranslator`.
     */
    private applyTupleOptions<TShape>(options: QueryOptionsCollection<TShape>, schema: CompiledSchema<TRoot>, data: unknown) {
        return new TupleTranslator<TRoot, TShape>(new Query<TRoot, TShape>(options, schema, false)).translate(data);
    }

    /**
     * Finishes a join query, whoever executed the join.
     *
     * Two cases, told apart by where the `join` option ended up:
     *
     *  - **The plugin interpreted it.** The option is in the database half, so tuples came back
     *    and only the post-join options are left to run.
     *  - **Nothing could interpret it.** The option ratcheted into the memory half — the two
     *    sides live on different plugins, or an earlier option had already forced memory
     *    execution — so the datastore is the interpreter. It reads the inner side as an ordinary
     *    query through the inner plugin and calls the SAME hash join a translator would.
     *
     * Change tracking is off either way (`Query.changeTracking` is false for any query holding a
     * join), so there is no attach, no freeze, and no delivered-membership capture: a tuple has
     * no id to record.
     */
    private postProcessJoinQuery<TShape>(result: PluginEventSuccessType<ITranslatedValue<TShape>>, payload: { databaseEvent: DbPluginQueryEvent<TRoot, TShape>, memoryEvent: DbPluginQueryEvent<TRoot, TShape> }, done: PluginEventCallbackResult<TShape>) {

        const { databaseEvent, memoryEvent } = payload;
        const schema = this.dependencies.schema;
        const { before, at, after } = memoryEvent.operation.options.splitAt("join");

        if (at == null) {
            // The plugin joined. `result.data.value` is already an array of tuples.
            const translated = this.applyTupleOptions(memoryEvent.operation.options, schema, result.data.value);
            done(PluginEventResult.success(memoryEvent.id, translated.value));
            return;
        }

        const joinSide = this.request.joinSide;

        if (joinSide == null) {
            done(PluginEventResult.error(databaseEvent.id, new Error("Cannot join: the inner side was not recorded on the request.")));
            return;
        }

        // The outer rows arrive in storage shape — change tracking is off, so nothing
        // deserialized them on the way here. Doing it BEFORE the pre-join options run is what
        // makes those options mean the same thing they would have meant in the plugin: the
        // caller's closures are written against entity property names.
        const outerRows = toEntityShape(schema, result.data.value as unknown[]);
        const preJoined = this.applyTupleOptions(before, schema, outerRows).value as UnknownRecord[];

        /**
         * The semi-join prefilter: the inner read is narrowed to keys the outer side actually has.
         *
         * This is the case it pays for most — the two sides are on different plugins, so the inner
         * read is a whole separate round trip, possibly over a network. `null` above the threshold
         * means read the inner side under its own scopes and let the hash join discard the surplus.
         * Cost only, never the answer.
         *
         * The outer rows are already in ENTITY shape here, so the keys are read by property name.
         */
        const outerKeys = distinctJoinKeys(preJoined, at.value.outerKey, at.value.semiJoinKeyThreshold);

        // The inner side's own filters travel with it and are re-applied by `executeJoin`
        // regardless — filters are pure, so the second pass over the survivors costs a walk and
        // guarantees the scopes are honoured even if the plugin ignored them.
        loadJoinInnerSide(
            memoryEvent as unknown as DbPluginQueryEvent<UnknownRecord, UnknownRecord>,
            (innerEvent, innerDone) => joinSide.plugin.query<UnknownRecord, UnknownRecord>(innerEvent, innerDone),
            innerResult => {
                try {
                    if (innerResult.ok === "error") {
                        done(PluginEventResult.error(memoryEvent.id, innerResult.error));
                        return;
                    }

                    const tuples = executeJoin({
                        option: at.value,
                        outerRows: preJoined,
                        innerRows: toEntityShape(joinSide.schema, innerResult.innerSide?.innerRows ?? [])
                    });

                    const translated = this.applyTupleOptions(after, schema, tuples);
                    done(PluginEventResult.success(memoryEvent.id, translated.value));
                } catch (e) {
                    done(PluginEventResult.error(memoryEvent.id, e));
                }
            },
            outerKeys
        );
    }

    /**
     * Moves options the plugin declined into the memory pass, in front of what was already there.
     *
     * In front, because they came first in the chain the caller wrote: a filter the database refused
     * has to run before a `skip` that was always going to run in memory.
     */
    private absorbHandedBackOptions<TShape>(
        databaseEvent: DbPluginQueryEvent<TRoot, TShape>,
        memoryEvent: DbPluginQueryEvent<TRoot, TShape>
    ) {
        const handedBack = databaseEvent.operation.options.handedBack();

        if (handedBack.length === 0) {
            return;
        }

        const combined = new QueryOptionsCollection<TRoot>();

        for (const item of handedBack) {
            combined.add(item.option.name, item.option.value);
        }

        memoryEvent.operation.options.forEach(option => {
            combined.add(option.name, option.value);
        });

        memoryEvent.operation = new Query<TRoot, TShape>(combined as any, this.dependencies.schema);
    }

    private postProcessQuery<TShape>(result: PluginEventSuccessType<ITranslatedValue<TShape>>, payload: { databaseEvent: DbPluginQueryEvent<TRoot, TShape>, memoryEvent: DbPluginQueryEvent<TRoot, TShape> }, done: PluginEventCallbackResult<TShape>) {

        const { databaseEvent, memoryEvent } = payload;

        // The plugin may have handed options back — its engine could not express them — and those
        // run here, over the rows it did return, ahead of anything already bound for memory.
        this.absorbHandedBackOptions(databaseEvent, memoryEvent);

        try {
            // Before the tags and change-tracking work below, all of which is about entities of
            // the root schema. A join produces tuples, which have none of it.
            if (databaseEvent.operation.options.has("join") || memoryEvent.operation.options.has("join")) {
                this.postProcessJoinQuery(result, payload, done);
                return;
            }


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