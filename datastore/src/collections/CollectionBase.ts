import { EntityMap } from "../types";
import { Queryable } from '../queryable/Queryable';
import { QueryableAsync } from '../queryable/QueryableAsync';
import { SelectionQueryable } from "../queryable/SelectionQueryable";
import { SelectionQueryableAsync } from "../queryable/SelectionQueryableAsync";
import { ChangeTrackingType, IdType, InferCreateType, InferType, SubscriptionChanges } from "@routier/core/schema";
import { CallbackPartialResult, CallbackResult, PartialResultType, Result, toPromise } from "@routier/core/results";
import { BulkPersistChanges, BulkPersistResult } from "@routier/core/collections";
import { assertIsNotNull } from "@routier/core/assertions";
import { GenericFunction } from "@routier/core/types";
import { Filter, ParamsFilter } from "@routier/core/expressions";
import { CollectionDependencies, RequestContext } from "./types";
import { logger, unsafeCast } from "@routier/core";
import { QueryableBuilder, QueryBuilderContext } from "../queryable/composers/QueryableBuilder";

export class CollectionBase<TEntity extends {}> implements Disposable {

    protected readonly dependencies: CollectionDependencies<TEntity>;
    protected _tag: unknown;

    get schema() {
        return this.dependencies.schema;
    }

    constructor(
        dependencies: CollectionDependencies<TEntity>
    ) {
        this.dependencies = dependencies;

        this.dependencies.pipelines.prepareChanges.pipe(this.prepare.bind(this));
        this.dependencies.pipelines.afterPersist.pipe(this.afterPersist.bind(this));

        // Bind all public methods to ensure 'this' context is preserved
        this.hasChanges = this.hasChanges.bind(this);
        this.instance = this.instance.bind(this);
        this.subscribe = this.subscribe.bind(this);
        this.where = this.where.bind(this);
        this.sort = this.sort.bind(this);
        this.sortDescending = this.sortDescending.bind(this);
        this.skip = this.skip.bind(this);
        this.take = this.take.bind(this);
        this.toArray = this.toArray.bind(this);
        this.toArrayAsync = this.toArrayAsync.bind(this);
        this.first = this.first.bind(this);
        this.firstAsync = this.firstAsync.bind(this);
        this.firstOrUndefined = this.firstOrUndefined.bind(this);
        this.firstOrUndefinedAsync = this.firstOrUndefinedAsync.bind(this);
        this.some = this.some.bind(this);
        this.someAsync = this.someAsync.bind(this);
        this.every = this.every.bind(this);
        this.everyAsync = this.everyAsync.bind(this);
        this.map = this.map.bind(this);
        this.min = this.min.bind(this);
        this.minAsync = this.minAsync.bind(this);
        this.max = this.max.bind(this);
        this.maxAsync = this.maxAsync.bind(this);
        this.sum = this.sum.bind(this);
        this.sumAsync = this.sumAsync.bind(this);
        this.count = this.count.bind(this);
        this.countAsync = this.countAsync.bind(this);
        this.distinct = this.distinct.bind(this);
        this.distinctAsync = this.distinctAsync.bind(this);
        this.toGroup = this.toGroup.bind(this);
        this.toGroupAsync = this.toGroupAsync.bind(this);
    }

    [Symbol.dispose]() {
        this.dispose();
    }

    dispose() {
        // Noop for now
    }

    protected get changeTrackingType(): ChangeTrackingType {
        return "proxy";
    }

    protected cloneMany(items: InferType<TEntity>[]) {

        if (this.changeTrackingType !== "proxy") {
            return items;
        }

        if (items.length === 0) {
            return items;
        }

        const result: InferType<TEntity>[] = new Array(items.length);
        for (let i = 0, length = items.length; i < length; i++) {
            result[i] = this.dependencies.schema.clone(items[i]);
        }
        return result;
    }

    protected afterPersist(result: PartialResultType<{ changes: BulkPersistChanges, result: BulkPersistResult }>, done: CallbackPartialResult<{ changes: BulkPersistChanges, result: BulkPersistResult }>) {

        try {
            if (result.ok === Result.ERROR) {
                this.dependencies.changeTracker.clearChanges();
                done(result);
                return;
            }

            // merge only the changes from the collections persist operation
            const resolvedChanges = result.data.result.get<TEntity>(this.dependencies.schema.id);
            const changes = result.data.changes.get<TEntity>(this.dependencies.schema.id);

            // If there are no changes for this schema, we're done
            if (!changes || changes.hasItems === false) {
                done(result);
                return;
            }

            // destroy tags and let go of the references
            changes.tags[Symbol.dispose]();

            assertIsNotNull(resolvedChanges, "Could not find resolved changes during afterPersist operation");

            // Merge changes will unpause any change tracking that was paused previously
            // We should be more declarative about this 
            const { updates, adds, removals } = this.dependencies.changeTracker.mergeChanges(resolvedChanges);

            // clear after we merge changes
            this.dependencies.changeTracker.clearChanges();

            // Only create and send if there are actual changes
            if (updates.length > 0 || adds.length > 0 || removals.length > 0) {
                const subscriptionChanges: SubscriptionChanges<TEntity> = {
                    updates,
                    adds,
                    removals,
                    unknown: []
                };

                this.dependencies.subscription.send(subscriptionChanges);
            }

            done(result);
        } catch (e) {
            done(Result.error(e));
        }
    }

    private normalizeDetachedUpdates(changes: BulkPersistChanges, tags: unknown) {
        const schemaChanges = changes.resolve(this.dependencies.schema.id);

        for (const update of schemaChanges.updates) {
            const trackedEntity = update.entity as InferType<TEntity> & { __tracking__?: unknown };

            // Guard for callers/plugins that might pass detached tracked references into updates.
            if (trackedEntity.__tracking__ == null) {
                continue;
            }

            const attached = this.dependencies.changeTracker.getAttached(update.entity as InferType<TEntity>);
            if (attached == null || attached.doc === update.entity) {
                continue;
            }

            this.dependencies.changeTracker.resolve(trackedEntity, tags, { merge: true });

            const resolved = this.dependencies.changeTracker.getAttached(update.entity as InferType<TEntity>);
            if (resolved == null) {
                continue;
            }

            update.entity = this.dependencies.schema.preprocess(resolved.doc as InferCreateType<TEntity>);
        }
    }


    // Somehow, when we make an update, the wrong record is showing as updated and the correct one as unchanged
    // add an event, go to pending approval and try to approve.
    // if we refresh the page it will work
    protected prepare(result: PartialResultType<BulkPersistChanges>, done: CallbackPartialResult<BulkPersistChanges>) {

        try {
            if (result.ok === Result.ERROR) {
                return done(result);
            }

            if (this.dependencies.changeTracker.hasChanges() === false) {
                return done(result);
            }

            const tags = this.dependencies.changeTracker.tags.get();
            const changes = result.data.resolve(this.dependencies.schema.id);

            assertIsNotNull(tags, "Could not find tag collection during prepare operation");

            changes.tags = tags;
            changes.adds = this.dependencies.changeTracker.prepareAdditions();
            changes.updates = this.dependencies.changeTracker.getAttachmentsChanges();
            changes.removes = this.dependencies.changeTracker.prepareRemovals();
            this.normalizeDetachedUpdates(result.data, tags);

            done(result);
        } catch (e) {
            done(Result.error(e));
        }
    }

    protected getAndDestroyTag() {
        if (this._tag != null) {

            const tag = this._tag;
            this._tag = null;
            return tag;
        }

        return null;
    }

    hasChanges() {
        return this.dependencies.changeTracker.hasChanges();
    }

    /**
     * Creates change-tracked instances of entities without adding them to the collection.
     * @param entities Entities to create change-tracked instances for
     * @returns Array of change-tracked entity instances
     */
    instance(...entities: InferCreateType<TEntity>[]) {

        const result: InferCreateType<TEntity>[] = [];

        for (const entity of this.dependencies.changeTracker.instance(entities, this.changeTrackingType)) {
            result.push(entity);
        }

        return result;
    }

    /**
     * Creates a subscription to the collection that will be notified of changes.
     * @returns A subscription object that can be used to listen for collection changes
     */
    subscribe() {
        const request = new RequestContext<TEntity>();
        const queryable = new Queryable<TEntity, InferType<TEntity>, () => void>(this.dependencies, request);
        return queryable.subscribe();
    }

    /**
     * Creates a query with a filter expression to filter entities in the collection.
     * @param expression Filter expression to apply to the collection
     * @returns QueryableAsync instance for chaining additional query operations
     */
    where(expression: Filter<InferType<TEntity>>): QueryableAsync<TEntity, InferType<TEntity>>;
    /**
     * Creates a query with a parameterized filter to filter entities in the collection.
     * @param selector Parameterized filter function
     * @param params Parameters to pass to the filter function
     * @returns QueryableAsync instance for chaining additional query operations
     */
    where<P extends {}>(selector: ParamsFilter<InferType<TEntity>, P>, params: P): QueryableAsync<TEntity, InferType<TEntity>>;
    where<P extends {} = never>(selector: ParamsFilter<InferType<TEntity>, P> | Filter<InferType<TEntity>>, params?: P) {
        const request = new RequestContext<TEntity>();
        if (params == null) {
            const queryable = new QueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);
            return queryable.where(selector as Filter<InferType<TEntity>>);
        }

        const queryable = new QueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);

        return queryable.where(selector as ParamsFilter<InferType<TEntity>, P>, params);
    }

    /**
     * Sorts the collection by the specified property in ascending order.
     * @param selector Function that selects the property to sort by
     * @returns QueryableAsync instance for chaining additional query operations
     */
    sort(selector: EntityMap<InferType<TEntity>, InferType<TEntity>[keyof InferType<TEntity>]>) {
        const request = new RequestContext<TEntity>();
        const result = new QueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);
        return result.sort(selector);
    }

    /**
     * Sorts the collection by the specified property in descending order.
     * @param selector Function that selects the property to sort by
     * @returns QueryableAsync instance for chaining additional query operations
     */
    sortDescending(selector: EntityMap<InferType<TEntity>, InferType<TEntity>[keyof InferType<TEntity>]>) {
        const request = new RequestContext<TEntity>();
        const result = new QueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);

        return result.sortDescending(selector);
    }

    toGroup<R extends InferType<TEntity>[keyof InferType<TEntity>] & IdType>(selector: GenericFunction<InferType<TEntity>, R>, done: CallbackResult<Record<R, InferType<TEntity>[]>>) {
        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);
        return result.toGroup(selector, done);
    }

    toGroupAsync<R extends InferType<TEntity>[keyof InferType<TEntity>] & IdType>(selector: GenericFunction<InferType<TEntity>, R>) {
        return toPromise<Record<R, InferType<TEntity>[]>>(w => this.toGroup(selector, w));
    }

    /**
     * Maps the collection to a new shape using the specified transformation function.
     * @param expression Function that transforms each entity to the new shape
     * @returns QueryableAsync instance for chaining additional query operations
     */
    map<R extends InferType<TEntity>[keyof InferType<TEntity>] | {}>(expression: EntityMap<InferType<TEntity>, R>) {
        const request = new RequestContext<TEntity>();
        const result = new QueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);
        return result.map(expression);
    }

    /**
     * Skips the specified number of entities in the collection.
     * @param amount Number of entities to skip
     * @returns QueryableAsync instance for chaining additional query operations
     */
    skip(amount: number) {
        const request = new RequestContext<TEntity>();
        const result = new QueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);
        return result.skip(amount);
    }

    /**
     * Takes the specified number of entities from the collection.
     * @param amount Number of entities to take
     * @returns QueryableAsync instance for chaining additional query operations
     */
    take(amount: number) {
        const request = new RequestContext<TEntity>();
        const result = new QueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);
        return result.take(amount);
    }

    /**
     * Converts the collection to a QueryableAsync instance for building queries dynamically.
     * This is useful when you need to conditionally build queries by chaining operations based on logic.
     * @returns QueryableAsync instance for chaining additional query operations
     */
    toQueryable() {
        const request = new RequestContext<TEntity>();
        return new QueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);
    }

    apply<U, Shape>(composer: QueryableBuilder<TEntity, Shape, U>) {
        const props = unsafeCast<QueryBuilderContext<TEntity>>(composer);
        return new QueryableAsync<TEntity, Shape>(this.dependencies, props.request);
    }

    /**
     * Executes the query and returns all results as an array.
     * @param done Callback function called with the array of entities or error
     */
    toArray(done: CallbackResult<InferType<TEntity>[]>) {
        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryable<TEntity, InferType<TEntity>, void>(this.dependencies, request);
        return result.toArray(done);
    }

    /**
     * Executes the query asynchronously and returns all results as an array.
     * @returns Promise that resolves with the array of entities or rejects with an error
     */
    toArrayAsync(): Promise<InferType<TEntity>[]> {
        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);
        return result.toArrayAsync();
    }

    /**
     * Returns the first entity that matches the filter expression.
     * @param expression Filter expression to apply
     * @param done Callback function called with the first matching entity or error
     */
    first(expression: Filter<InferType<TEntity>>, done: CallbackResult<InferType<TEntity>>): void;
    /**
     * Returns the first entity that matches the parameterized filter.
     * @param selector Parameterized filter function
     * @param params Parameters to pass to the filter function
     * @param done Callback function called with the first matching entity or error
     */
    first<P extends {}>(expression: ParamsFilter<InferType<TEntity>, P>, params: P, done: CallbackResult<InferType<TEntity>>): void;
    /**
     * Returns the first entity in the collection.
     * @param done Callback function called with the first entity or error
     */
    first(done: CallbackResult<InferType<TEntity>>): void;
    first<P extends {} = never>(doneOrExpression: Filter<InferType<TEntity>> | ParamsFilter<InferType<TEntity>, P> | CallbackResult<InferType<TEntity>>, paramsOrDone?: P | CallbackResult<InferType<TEntity>>, done?: CallbackResult<InferType<TEntity>>) {
        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryable<TEntity, InferType<TEntity>, void>(this.dependencies, request);

        if (paramsOrDone == null) {
            const d = doneOrExpression as CallbackResult<InferType<TEntity>>;
            return result.first(d);
        }

        if (done == null) {
            const expression = doneOrExpression as Filter<InferType<TEntity>>;
            const d = paramsOrDone as CallbackResult<InferType<TEntity>>;
            return result.first(expression, d);
        }

        const expression = doneOrExpression as ParamsFilter<InferType<TEntity>, P>;
        const p = paramsOrDone as P;
        const d = done as CallbackResult<InferType<TEntity>>;
        return result.first<P>(expression, p, d);
    }

    /**
     * Returns the first entity that matches the filter expression asynchronously.
     * @param expression Filter expression to apply
     * @returns Promise that resolves with the first matching entity or rejects with an error
     */
    firstAsync(expression: Filter<InferType<TEntity>>): Promise<InferType<TEntity>>;
    /**
     * Returns the first entity that matches the parameterized filter asynchronously.
     * @param selector Parameterized filter function
     * @param params Parameters to pass to the filter function
     * @returns Promise that resolves with the first matching entity or rejects with an error
     */
    firstAsync<P extends {}>(expression: ParamsFilter<InferType<TEntity>, P>, params: P): Promise<InferType<TEntity>>;
    /**
     * Returns the first entity in the collection asynchronously.
     * @returns Promise that resolves with the first entity or rejects with an error
     */
    firstAsync(): Promise<InferType<TEntity>>;
    firstAsync<P extends {} = never>(expression?: Filter<InferType<TEntity>> | ParamsFilter<InferType<TEntity>, P>, params?: P): Promise<InferType<TEntity>> {
        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);

        if (params == null && expression == null) {
            return result.firstAsync();
        }

        if (params != null) {
            const e = expression as ParamsFilter<InferType<TEntity>, P>;
            const p = params as P;
            return result.firstAsync(e, p);
        }

        const e = expression as Filter<InferType<TEntity>>;
        return result.firstAsync(e);
    }

    /**
     * Returns the first entity that matches the filter expression, or undefined if none found.
     * @param expression Filter expression to apply
     * @param done Callback function called with the first matching entity, undefined, or error
     */
    firstOrUndefined(expression: Filter<InferType<TEntity>>, done: CallbackResult<InferType<TEntity> | undefined>): void;
    /**
     * Returns the first entity that matches the parameterized filter, or undefined if none found.
     * @param selector Parameterized filter function
     * @param params Parameters to pass to the filter function
     * @param done Callback function called with the first matching entity, undefined, or error
     */
    firstOrUndefined<P extends {}>(expression: ParamsFilter<InferType<TEntity>, P>, params: P, done: CallbackResult<InferType<TEntity> | undefined>): void;
    /**
     * Returns the first entity in the collection, or undefined if empty.
     * @param done Callback function called with the first entity, undefined, or error
     */
    firstOrUndefined(done: CallbackResult<InferType<TEntity> | undefined>): void;
    firstOrUndefined<P extends {} = never>(doneOrExpression: Filter<InferType<TEntity>> | ParamsFilter<InferType<TEntity>, P> | CallbackResult<InferType<TEntity> | undefined>, paramsOrDone?: P | CallbackResult<InferType<TEntity> | undefined>, done?: CallbackResult<InferType<TEntity> | undefined>) {
        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryable<TEntity, InferType<TEntity>, void>(this.dependencies, request);

        if (paramsOrDone == null) {
            const d = doneOrExpression as CallbackResult<InferType<TEntity> | undefined>;
            return result.firstOrUndefined(d);
        }

        if (done == null) {
            const expression = doneOrExpression as Filter<InferType<TEntity>>;
            const d = paramsOrDone as CallbackResult<InferType<TEntity> | undefined>;
            return result.firstOrUndefined(expression, d);
        }

        const expression = doneOrExpression as ParamsFilter<InferType<TEntity>, P>;
        const p = paramsOrDone as P;
        const d = done as CallbackResult<InferType<TEntity> | undefined>;
        return result.firstOrUndefined<P>(expression, p, d);
    }

    /**
     * Returns the first entity that matches the filter expression asynchronously, or undefined if none found.
     * @param expression Filter expression to apply
     * @returns Promise that resolves with the first matching entity, undefined, or rejects with an error
     */
    firstOrUndefinedAsync(expression: Filter<InferType<TEntity>>): Promise<InferType<TEntity> | undefined>;
    /**
     * Returns the first entity that matches the parameterized filter asynchronously, or undefined if none found.
     * @param selector Parameterized filter function
     * @param params Parameters to pass to the filter function
     * @returns Promise that resolves with the first matching entity, undefined, or rejects with an error
     */
    firstOrUndefinedAsync<P extends {}>(expression: ParamsFilter<InferType<TEntity>, P>, params: P): Promise<InferType<TEntity> | undefined>;
    /**
     * Returns the first entity in the collection asynchronously, or undefined if empty.
     * @returns Promise that resolves with the first entity, undefined, or rejects with an error
     */
    firstOrUndefinedAsync(): Promise<InferType<TEntity> | undefined>;
    firstOrUndefinedAsync<P extends {} = never>(expression?: Filter<InferType<TEntity>> | ParamsFilter<InferType<TEntity>, P>, params?: P): Promise<InferType<TEntity> | undefined> {

        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);

        if (params == null && expression == null) {
            return result.firstOrUndefinedAsync();
        }

        if (params != null) {
            const e = expression as ParamsFilter<InferType<TEntity>, P>;
            const p = params as P;
            return result.firstOrUndefinedAsync(e, p);
        }

        const e = expression as Filter<InferType<TEntity>>;
        return result.firstOrUndefinedAsync(e);
    }

    /**
     * Checks if any entity matches the filter expression.
     * @param expression Filter expression to apply
     * @param done Callback function called with true if any entity matches, false otherwise, or error
     */
    some(expression: Filter<InferType<TEntity>>, done: CallbackResult<boolean>): void;
    /**
     * Checks if any entity matches the parameterized filter.
     * @param selector Parameterized filter function
     * @param params Parameters to pass to the filter function
     * @param done Callback function called with true if any entity matches, false otherwise, or error
     */
    some<P extends {}>(expression: ParamsFilter<InferType<TEntity>, P>, params: P, done: CallbackResult<boolean>): void;
    /**
     * Checks if the collection has any entities.
     * @param done Callback function called with true if collection has entities, false otherwise, or error
     */
    some(done: CallbackResult<boolean>): void;
    some<P extends {} = never>(doneOrExpression: Filter<InferType<TEntity>> | ParamsFilter<InferType<TEntity>, P> | CallbackResult<boolean>, paramsOrDone?: P | CallbackResult<boolean>, done?: CallbackResult<boolean>) {

        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryable<TEntity, InferType<TEntity>, void>(this.dependencies, request);

        if (paramsOrDone == null) {
            const d = doneOrExpression as CallbackResult<boolean>;
            return result.some(d);
        }

        if (done == null) {
            const expression = doneOrExpression as Filter<InferType<TEntity>>;
            const d = paramsOrDone as CallbackResult<boolean>;
            return result.some(expression, d);
        }

        const expression = doneOrExpression as ParamsFilter<InferType<TEntity>, P>;
        const p = paramsOrDone as P;
        const d = done as CallbackResult<boolean>;
        return result.some<P>(expression, p, d);
    }

    /**
     * Checks if any entity matches the filter expression asynchronously.
     * @param expression Filter expression to apply
     * @returns Promise that resolves with true if any entity matches, false otherwise, or rejects with an error
     */
    someAsync(expression: Filter<InferType<TEntity>>): Promise<boolean>;
    /**
     * Checks if any entity matches the parameterized filter asynchronously.
     * @param selector Parameterized filter function
     * @param params Parameters to pass to the filter function
     * @returns Promise that resolves with true if any entity matches, false otherwise, or rejects with an error
     */
    someAsync<P extends {}>(expression: ParamsFilter<InferType<TEntity>, P>, params: P): Promise<boolean>;
    /**
     * Checks if the collection has any entities asynchronously.
     * @returns Promise that resolves with true if collection has entities, false otherwise, or rejects with an error
     */
    someAsync(): Promise<boolean>;
    someAsync<P extends {} = never>(expression?: Filter<InferType<TEntity>> | ParamsFilter<InferType<TEntity>, P>, params?: P): Promise<boolean> {

        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);

        if (params == null && expression == null) {
            return result.someAsync();
        }

        if (params != null) {
            const e = expression as ParamsFilter<InferType<TEntity>, P>;
            const p = params as P;
            return result.someAsync(e, p);
        }

        const e = expression as Filter<InferType<TEntity>>;
        return result.someAsync(e);
    }

    /**
     * Checks if all entities match the filter expression.
     * @param expression Filter expression to apply
     * @param done Callback function called with true if all entities match, false otherwise, or error
     */
    every(expression: Filter<InferType<TEntity>>, done: CallbackResult<boolean>): void;
    /**
     * Checks if all entities match the parameterized filter.
     * @param selector Parameterized filter function
     * @param params Parameters to pass to the filter function
     * @param done Callback function called with true if all entities match, false otherwise, or error
     */
    every<P extends {}>(expression: Filter<InferType<TEntity>>, done: CallbackResult<boolean>): void;
    every<P extends {}>(expression: ParamsFilter<InferType<TEntity>, P>, params: P, done: CallbackResult<boolean>): void;
    every<P extends {} = never>(expression: Filter<InferType<TEntity>> | ParamsFilter<InferType<TEntity>, P> | CallbackResult<boolean>, paramsOrDone: P | CallbackResult<boolean>, done?: CallbackResult<boolean>) {

        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryable<TEntity, InferType<TEntity>, void>(this.dependencies, request);

        if (done != null) {
            const d = done as CallbackResult<boolean>;
            const e = expression as ParamsFilter<InferType<TEntity>, P>;
            const p = paramsOrDone as P
            return result.every(e, p, d);
        }

        const e = expression as Filter<InferType<TEntity>>;
        const d = paramsOrDone as CallbackResult<boolean>;
        return result.every(e, d);
    }

    /**
     * Checks if all entities match the filter expression asynchronously.
     * @param expression Filter expression to apply
     * @returns Promise that resolves with true if all entities match, false otherwise, or rejects with an error
     */
    everyAsync(expression: Filter<InferType<TEntity>>): Promise<boolean>;
    /**
     * Checks if all entities match the parameterized filter asynchronously.
     * @param selector Parameterized filter function
     * @param params Parameters to pass to the filter function
     * @returns Promise that resolves with true if all entities match, false otherwise, or rejects with an error
     */
    everyAsync<P extends {}>(expression: Filter<InferType<TEntity>>): Promise<boolean>;
    everyAsync<P extends {}>(expression: ParamsFilter<InferType<TEntity>, P>, params: P): Promise<boolean>;
    everyAsync<P extends {} = never>(expression?: Filter<InferType<TEntity>> | ParamsFilter<InferType<TEntity>, P>, params?: P): Promise<boolean> {

        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);

        if (params != null) {
            const e = expression as ParamsFilter<InferType<TEntity>, P>;
            const p = params as P
            return result.everyAsync(e, p);
        }

        const e = expression as Filter<InferType<TEntity>>;
        return result.everyAsync(e);
    }

    /**
     * Finds the minimum value of the specified numeric property across all entities.
     * @param selector Function that selects the numeric property to find the minimum of
     * @param done Callback function called with the minimum value or error
     */
    min(selector: GenericFunction<InferType<TEntity>, number>, done: CallbackResult<number>): void {

        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryable<TEntity, InferType<TEntity>, void>(this.dependencies, request);

        return result.min(selector, done);
    }

    /**
     * Finds the minimum value of the specified numeric property across all entities asynchronously.
     * @param selector Function that selects the numeric property to find the minimum of
     * @returns Promise that resolves with the minimum value or rejects with an error
     */
    minAsync(selector: GenericFunction<InferType<TEntity>, number>): Promise<number> {

        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);

        return result.minAsync(selector);
    }

    /**
     * Finds the maximum value of the specified numeric property across all entities.
     * @param selector Function that selects the numeric property to find the maximum of
     * @param done Callback function called with the maximum value or error
     */
    max(selector: GenericFunction<InferType<TEntity>, number>, done: CallbackResult<number>): void {

        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryable<TEntity, InferType<TEntity>, void>(this.dependencies, request);

        return result.max(selector, done);
    }

    /**
     * Finds the maximum value of the specified numeric property across all entities asynchronously.
     * @param selector Function that selects the numeric property to find the maximum of
     * @returns Promise that resolves with the maximum value or rejects with an error
     */
    maxAsync(selector: GenericFunction<InferType<TEntity>, number>): Promise<number> {

        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);

        return result.maxAsync(selector);
    }

    /**
     * Calculates the sum of the specified numeric property across all entities.
     * @param selector Function that selects the numeric property to sum
     * @param done Callback function called with the sum or error
     */
    sum(selector: GenericFunction<InferType<TEntity>, number>, done: CallbackResult<number>): void {

        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryable<TEntity, InferType<TEntity>, void>(this.dependencies, request);

        return result.sum(selector, done);
    }

    /**
     * Calculates the sum of the specified numeric property across all entities asynchronously.
     * @param selector Function that selects the numeric property to sum
     * @returns Promise that resolves with the sum or rejects with an error
     */
    sumAsync(selector: GenericFunction<InferType<TEntity>, number>): Promise<number> {

        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);

        return result.sumAsync(selector);
    }

    /**
     * Counts the number of entities in the collection.
     * @param done Callback function called with the count or error
     */
    count(done: CallbackResult<number>): void {

        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryable<TEntity, InferType<TEntity>, void>(this.dependencies, request);

        return result.count(done);
    }

    /**
     * Counts the number of entities in the collection asynchronously.
     * @returns Promise that resolves with the count or rejects with an error
     */
    countAsync(): Promise<number> {

        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);

        return result.countAsync();
    }

    /**
     * Returns distinct entities from the collection, removing duplicates.
     * @param done Callback function called with the distinct entities or error
     */
    distinct(done: CallbackResult<InferType<TEntity>[]>): void {

        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryable<TEntity, InferType<TEntity>, void>(this.dependencies, request);

        return result.distinct(done);
    }

    /**
     * Returns distinct entities from the collection asynchronously, removing duplicates.
     * @returns Promise that resolves with the distinct entities or rejects with an error
     */
    distinctAsync(): Promise<InferType<TEntity>[]> {

        const request = new RequestContext<TEntity>();
        const result = new SelectionQueryableAsync<TEntity, InferType<TEntity>>(this.dependencies, request);

        return result.distinctAsync();
    }
}