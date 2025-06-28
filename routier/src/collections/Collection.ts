import { CollectionOptions, CollectionPipelines, EntityCallbackMany, EntityMap, QueryResult, SaveChangesContextStepFive, SaveChangesContextStepFour, SaveChangesContextStepOne, SaveChangesContextStepSix, SaveChangesContextStepThree, SaveChangesContextStepTwo } from "../types";
import { IDbPlugin, InferCreateType, InferType, Filter, ParamsFilter, CompiledSchema, Expression, Query, GenericFunction, ICollectionSubscription, SchemaParent, ChangeTrackingType, SubscriptionChanges } from 'routier-core';
import { ChangeTracker } from '../change-tracking/ChangeTracker';
import { DataBridge } from '../data-access/DataBridge';
import { Queryable } from '../queryable/Queryable';
import { QueryableAsync } from '../queryable/QueryableAsync';
import { SelectionQueryable } from "../queryable/SelectionQueryable";
import { SelectionQueryableAsync } from "../queryable/SelectionQueryableAsync";

export class Collection<TEntity extends {}> {

    protected readonly changeTracker: ChangeTracker<TEntity>;
    protected readonly dataBridge: DataBridge<TEntity>;
    readonly schema: CompiledSchema<TEntity>;
    protected unidirecitonalSubscription: ICollectionSubscription<TEntity>;
    private readonly parent: SchemaParent;
    private _tag: unknown;

    constructor(
        dbPlugin: IDbPlugin,
        schema: CompiledSchema<TEntity>,
        options: CollectionOptions,
        pipelines: CollectionPipelines,
        parent: SchemaParent
    ) {

        this.unidirecitonalSubscription = schema.createSubscription(options.signal);
        this.schema = schema;
        this.changeTracker = ChangeTracker.create<TEntity>(schema);
        this.dataBridge = DataBridge.create<TEntity>(dbPlugin, options);
        this.parent = parent;

        pipelines.save.pipe(this.checkForChangesStep.bind(this))
            .pipe(this.prepareAdditions.bind(this))
            .pipe(this.prepareRemovals.bind(this))
            .pipe(this.prepareUpdates.bind(this))
            .pipe(this.persist.bind(this))
            .pipe(this.postOps.bind(this))
            .pipe(this.notifySubscribers.bind(this))
            .pipe(this.cleanup.bind(this));

        pipelines.hasChanges.pipe(this.hasChanges.bind(this))
    }

    protected get changeTrackingType(): ChangeTrackingType {
        return "entity";
    }

    protected hasChanges(payload: { hasChanges: boolean }, done: (payload: { hasChanges: boolean }) => void) {

        if (payload.hasChanges === true) {
            done(payload);
            return;
        }

        done({
            hasChanges: this.changeTracker.hasChanges()
        });
    }

    protected prepareAdditions(data: SaveChangesContextStepTwo, done: (result: SaveChangesContextStepThree<TEntity>, error?: any) => void) {

        if (data.hasChanges === false) {
            done({
                ...data,
                adds: {
                    entities: []
                },
                find: () => undefined as any
            })
            return;
        }

        try {
            const { adds, find } = this.changeTracker.prepareAdditions();

            done({
                ...data,
                adds: {
                    entities: adds
                },
                find
            });
        } catch (e) {
            done(null, e);
        }
    }

    protected checkForChangesStep(data: SaveChangesContextStepOne, done: (result: SaveChangesContextStepTwo) => void) {

        const hasChanges = this.changeTracker.hasChanges();
        debugger;
        // only carry data.count over
        done({
            count: data.count,
            hasChanges
        });
    }

    protected cleanup(data: SaveChangesContextStepSix<TEntity>, done: (result: SaveChangesContextStepOne, error?: any) => void) {

        this.changeTracker.clearAdditions();

        if (data.result == null) {
            done({ count: data.count });
            return;
        }

        data.count += data.result.adds.length + data.result.removedCount + data.result.updates.length;

        done({ count: data.count });
    }

    protected notifySubscribers(data: SaveChangesContextStepSix<TEntity>, done: (result: SaveChangesContextStepSix<TEntity>) => void) {

        if (data.hasChanges === true) {

            // we only want to notify of changes when an item that was saved matches the query
            const updates = [...data.updates.entities].map(w => w[1].doc);
            const removals = data.removes;
            const adds = data.result.adds;

            const changes: SubscriptionChanges<TEntity> = {
                updates,
                adds: adds as InferType<TEntity>[],
                removals: removals.entities,
                removalQueries: removals.queries
            };

            this.unidirecitonalSubscription.send(changes);
        }

        done(data);
    }

    protected prepareUpdates(data: SaveChangesContextStepFour<TEntity>, done: (result: SaveChangesContextStepFive<TEntity>) => void) {

        if (data.hasChanges === false) {
            done({
                ...data, updates: {
                    entities: new Map()
                }
            });
            return;
        }

        const updates = this.changeTracker.getAttachmentsChanges();

        done({ ...data, updates });
    }

    protected postOps(data: SaveChangesContextStepSix<TEntity>, done: (result: SaveChangesContextStepSix<TEntity>, error?: any) => void) {

        if (data.result == null) {
            done(data)
            return;
        }

        try {
            this.changeTracker.mergeChanges(data.result, { find: data.find, adds: data.adds.entities })

            done(data);
        } catch (e) {
            done(null, e);
        }
    }

    protected persist(data: SaveChangesContextStepFive<TEntity>, done: (result: SaveChangesContextStepSix<TEntity>, error?: any) => void) {

        const tags = this.changeTracker.getAndDestroyTags();

        if (data.hasChanges === false) {
            done({ ...data, result: null });
            return;
        }

        this.dataBridge.bulkOperations({
            operation: {
                // prepare is responsible for creating a new clean object 
                // with only properties that should be saved and run any serializers
                adds: data.adds,
                removes: data.removes,
                updates: data.updates,
                tags
            },
            parent: this.parent,
            schema: this.schema
        }, (result, error) => done({ ...data, result }, error));
    }

    protected prepareRemovals(data: SaveChangesContextStepThree<TEntity>, done: (result: SaveChangesContextStepFour<TEntity>, error?: any) => void) {

        if (data.hasChanges === false) {
            done({
                ...data, removes: {
                    entities: [],
                    queries: []
                }
            });
            return;
        }

        try {
            const removes = this.changeTracker.prepareRemovals();

            done({ ...data, removes });
        } catch (e) {
            done(null, e);
        }
    }

    private getAndDestroyTag() {
        if (this._tag != null) {

            const tag = this._tag;
            this._tag = null;
            return tag;
        }

        return null;
    }

    attachments = {
        /** Detaches entities from change tracking, removing them from the collection's managed set */
        remove: (...entities: InferType<TEntity>[]) => {
            return this.changeTracker.detach(entities);
        },
        /** Attaches entities to change tracking, enabling property change monitoring and dirty state management */
        set: (...entities: InferType<TEntity>[]) => {
            const tag = this.getAndDestroyTag()
            return this.changeTracker.resolve(entities, tag, { merge: true });
        },
        /** Checks if an entity is currently attached to change tracking */
        has: (entity: InferType<TEntity>) => {
            return this.changeTracker.isAttached(entity);
        },
        /** Retrieves an attached entity from change tracking if it exists */
        get: (entity: InferType<TEntity>) => {
            const found = this.changeTracker.getAttached(entity);

            return found?.doc;
        },
        /** Filters attached entities using a selector function, returning entities that match the criteria */
        filter: (selector: GenericFunction<InferType<TEntity>, boolean>) => {
            return this.changeTracker.filterAttached(selector);
        },
        /** Marks entities as dirty, forcing them to be included in the next save operation regardless of actual property changes */
        markDirty: (...entities: InferType<TEntity>[]) => {
            return this.changeTracker.markDirty(entities);
        },
        /** Retrieves the change type for a specific entity. Returns the change type if attached, or undefined if not attached. */
        getChangeType: (entity: InferType<TEntity>) => {
            const found = this.changeTracker.getAttached(entity);

            if (found == null) {
                return undefined
            }

            return found.changeType;
        }
    }

    /**
     * Adds entities to the collection and persists them to the database.
     * @param entities Array of entities to add to the collection
     * @param done Callback function called with the added entities or error
     */
    add(entities: InferCreateType<TEntity>[], done: EntityCallbackMany<TEntity>) {
        const tag = this.getAndDestroyTag()
        this.changeTracker.add(entities, tag, done);
    }

    /**
     * Adds entities to the collection asynchronously and returns a Promise.
     * @param entities Entities to add to the collection
     * @returns Promise that resolves with the added entities or rejects with an error
     */
    addAsync(...entities: InferCreateType<TEntity>[]) {
        return new Promise<InferType<TEntity>[]>((resolve, reject) => {
            this.add(entities as any, (r, e) => this._resolvePromise({
                data: r,
                error: e
            }, resolve as any, reject));
        });
    }

    /**
     * Removes entities from the collection and persists the changes to the database.
     * @param entities Array of entities to remove from the collection
     * @param done Callback function called with the removed entities or error
     */
    remove(entities: InferType<TEntity>[], done: EntityCallbackMany<TEntity>) {
        const tag = this.getAndDestroyTag()
        this.changeTracker.remove(entities, tag, done);
    }

    /**
     * Removes entities from the collection asynchronously and returns a Promise.
     * @param entities Entities to remove from the collection
     * @returns Promise that resolves with the removed entities or rejects with an error
     */
    removeAsync(...entities: InferType<TEntity>[]) {
        return new Promise<InferType<TEntity>[]>((resolve, reject) => {
            this.remove(entities, (r, e) => this._resolvePromise({
                data: r,
                error: e
            }, resolve, reject));
        });
    }

    /**
     * Removes all entities from the collection and persists the changes to the database.
     * @param done Callback function called when the operation completes or with an error
     */
    removeAll(done: (error?: any) => void) {
        const tag = this.getAndDestroyTag()
        this.changeTracker.removeByQuery(Query.EMPTY<TEntity, TEntity>(), tag, done);
    }

    /**
     * Removes all entities from the collection asynchronously and returns a Promise.
     * @returns Promise that resolves when the operation completes or rejects with an error
     */
    removeAllAsync() {
        return new Promise<void>((resolve, reject) => {
            this.removeAll((e) => this._resolvePromise({
                error: e
            }, resolve, reject));
        });
    }

    /**
     * Sets a tag for the next operation. The tag will be used to group related operations.
     * @param tag The tag to associate with the next operation
     * @returns The collection instance for method chaining
     */
    tag(tag: unknown) {
        this._tag = tag;
        return this;
    }

    /**
     * Creates change-tracked instances of entities without adding them to the collection.
     * @param entities Entities to create change-tracked instances for
     * @returns Array of change-tracked entity instances
     */
    instance(...entities: InferCreateType<TEntity>[]) {

        const result: InferType<TEntity>[] = [];

        for (const entity of this.changeTracker.instance(entities, this.changeTrackingType)) {
            result.push(entity);
        }

        return result;
    }

    /**
     * Creates a subscription to the collection that will be notified of changes.
     * @returns A subscription object that can be used to listen for collection changes
     */
    subscribe() {
        const queryable = new Queryable<InferType<TEntity>, InferType<TEntity>, () => void>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });
        return queryable.subscribe();
    }

    /**
     * Creates a query with a filter expression to filter entities in the collection.
     * @param expression Filter expression to apply to the collection
     * @returns QueryableAsync instance for chaining additional query operations
     */
    where(expression: Filter<InferType<TEntity>>): QueryableAsync<InferType<TEntity>, InferType<TEntity>>;
    /**
     * Creates a query with a parameterized filter to filter entities in the collection.
     * @param selector Parameterized filter function
     * @param params Parameters to pass to the filter function
     * @returns QueryableAsync instance for chaining additional query operations
     */
    where<P extends {}>(selector: ParamsFilter<InferType<TEntity>, P>, params: P): QueryableAsync<InferType<TEntity>, InferType<TEntity>>;
    where<P extends {} = never>(selector: ParamsFilter<InferType<TEntity>, P> | Filter<InferType<TEntity>>, params?: P) {

        if (params == null) {
            const queryable = new QueryableAsync<InferType<TEntity>, InferType<TEntity>>(this.schema as any, this.parent, {
                dataBridge: this.dataBridge as any,
                changeTracker: this.changeTracker as any
            });
            return queryable.where(selector as Filter<InferType<TEntity>>);
        }

        const queryable = new QueryableAsync<InferType<TEntity>, InferType<TEntity>>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return queryable.where(selector as ParamsFilter<InferType<TEntity>, P>, params);
    }

    /**
     * Sorts the collection by the specified property in ascending order.
     * @param selector Function that selects the property to sort by
     * @returns QueryableAsync instance for chaining additional query operations
     */
    sort(selector: EntityMap<InferType<TEntity>, InferType<TEntity>[keyof InferType<TEntity>]>) {
        const result = new QueryableAsync<InferType<TEntity>, InferType<TEntity>>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });
        return result.sort(selector);
    }

    /**
     * Sorts the collection by the specified property in descending order.
     * @param selector Function that selects the property to sort by
     * @returns QueryableAsync instance for chaining additional query operations
     */
    sortDescending(selector: EntityMap<InferType<TEntity>, InferType<TEntity>[keyof InferType<TEntity>]>) {
        const result = new QueryableAsync<InferType<TEntity>, InferType<TEntity>>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.sortDescending(selector);
    }

    /**
     * Maps the collection to a new shape using the specified transformation function.
     * @param expression Function that transforms each entity to the new shape
     * @returns QueryableAsync instance for chaining additional query operations
     */
    map<R extends InferType<TEntity>[keyof InferType<TEntity>] | {}>(expression: EntityMap<InferType<TEntity>, R>) {
        const result = new QueryableAsync<InferType<TEntity>, InferType<TEntity>>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });
        return result.map(expression);
    }

    /**
     * Skips the specified number of entities in the collection.
     * @param amount Number of entities to skip
     * @returns QueryableAsync instance for chaining additional query operations
     */
    skip(amount: number) {
        const result = new QueryableAsync<InferType<TEntity>, InferType<TEntity>>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });
        return result.skip(amount);
    }

    /**
     * Takes the specified number of entities from the collection.
     * @param amount Number of entities to take
     * @returns QueryableAsync instance for chaining additional query operations
     */
    take(amount: number) {
        const result = new QueryableAsync<InferType<TEntity>, InferType<TEntity>>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });
        return result.take(amount);
    }

    /**
     * Executes the query and returns all results as an array.
     * @param done Callback function called with the array of entities or error
     */
    toArray(done: QueryResult<InferType<TEntity>[]>) {
        const result = new SelectionQueryable<InferType<TEntity>, InferType<TEntity>, void>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });
        return result.toArray(done);
    }

    /**
     * Executes the query asynchronously and returns all results as an array.
     * @returns Promise that resolves with the array of entities or rejects with an error
     */
    toArrayAsync(): Promise<InferType<TEntity>[]> {
        const result = new SelectionQueryableAsync<InferType<TEntity>, InferType<TEntity>>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });
        return result.toArrayAsync();
    }

    /**
     * Returns the first entity that matches the filter expression.
     * @param expression Filter expression to apply
     * @param done Callback function called with the first matching entity or error
     */
    first(expression: Filter<InferType<TEntity>>, done: QueryResult<InferType<TEntity>>): void;
    /**
     * Returns the first entity that matches the parameterized filter.
     * @param selector Parameterized filter function
     * @param params Parameters to pass to the filter function
     * @param done Callback function called with the first matching entity or error
     */
    first<P extends {}>(expression: ParamsFilter<TEntity, P>, params: P, done: QueryResult<InferType<TEntity>>): void;
    /**
     * Returns the first entity in the collection.
     * @param done Callback function called with the first entity or error
     */
    first(done: QueryResult<InferType<TEntity>>): void;
    first<P extends {} = never>(doneOrExpression: Filter<InferType<TEntity>> | ParamsFilter<TEntity, P> | QueryResult<InferType<TEntity>>, paramsOrDone?: P | QueryResult<InferType<TEntity>>, done?: QueryResult<InferType<TEntity>>) {
        const result = new SelectionQueryable<InferType<TEntity>, InferType<TEntity>, void>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.first(doneOrExpression as any, paramsOrDone, done);
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
        const result = new SelectionQueryableAsync<InferType<TEntity>, InferType<TEntity>>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.firstAsync(expression as any, params);
    }

    /**
     * Returns the first entity that matches the filter expression, or undefined if none found.
     * @param expression Filter expression to apply
     * @param done Callback function called with the first matching entity, undefined, or error
     */
    firstOrUndefined(expression: Filter<InferType<TEntity>>, done: QueryResult<InferType<TEntity> | undefined>): void;
    /**
     * Returns the first entity that matches the parameterized filter, or undefined if none found.
     * @param selector Parameterized filter function
     * @param params Parameters to pass to the filter function
     * @param done Callback function called with the first matching entity, undefined, or error
     */
    firstOrUndefined<P extends {}>(expression: ParamsFilter<TEntity, P>, params: P, done: QueryResult<InferType<TEntity> | undefined>): void;
    /**
     * Returns the first entity in the collection, or undefined if empty.
     * @param done Callback function called with the first entity, undefined, or error
     */
    firstOrUndefined(done: QueryResult<InferType<TEntity> | undefined>): void;
    firstOrUndefined<P extends {} = never>(doneOrExpression: Filter<InferType<TEntity>> | ParamsFilter<TEntity, P> | QueryResult<InferType<TEntity> | undefined>, paramsOrDone?: P | QueryResult<InferType<TEntity> | undefined>, done?: QueryResult<InferType<TEntity> | undefined>) {
        const result = new SelectionQueryable<InferType<TEntity>, InferType<TEntity>, void>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.firstOrUndefined(doneOrExpression as any, paramsOrDone, done);
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
    firstOrUndefinedAsync<P extends {}>(expression: ParamsFilter<TEntity, P>, params: P): Promise<InferType<TEntity> | undefined>;
    /**
     * Returns the first entity in the collection asynchronously, or undefined if empty.
     * @returns Promise that resolves with the first entity, undefined, or rejects with an error
     */
    firstOrUndefinedAsync(): Promise<InferType<TEntity> | undefined>;
    firstOrUndefinedAsync<P extends {} = never>(expression?: Filter<InferType<TEntity>> | ParamsFilter<TEntity, P>, params?: P): Promise<InferType<TEntity> | undefined> {
        const result = new SelectionQueryableAsync<InferType<TEntity>, InferType<TEntity>>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.firstOrUndefinedAsync(expression as any, params);
    }

    /**
     * Checks if any entity matches the filter expression.
     * @param expression Filter expression to apply
     * @param done Callback function called with true if any entity matches, false otherwise, or error
     */
    some(expression: Filter<InferType<TEntity>>, done: QueryResult<boolean>): void;
    /**
     * Checks if any entity matches the parameterized filter.
     * @param selector Parameterized filter function
     * @param params Parameters to pass to the filter function
     * @param done Callback function called with true if any entity matches, false otherwise, or error
     */
    some<P extends {}>(expression: ParamsFilter<TEntity, P>, params: P, done: QueryResult<boolean>): void;
    /**
     * Checks if the collection has any entities.
     * @param done Callback function called with true if collection has entities, false otherwise, or error
     */
    some(done: QueryResult<boolean>): void;
    some<P extends {} = never>(doneOrExpression: Filter<InferType<TEntity>> | ParamsFilter<TEntity, P> | QueryResult<boolean>, paramsOrDone?: P | QueryResult<boolean>, done?: QueryResult<boolean>) {
        const result = new SelectionQueryable<InferType<TEntity>, InferType<TEntity>, void>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.some(doneOrExpression as any, paramsOrDone, done);
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
        const result = new SelectionQueryableAsync<InferType<TEntity>, InferType<TEntity>>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.someAsync(expression as any, params);
    }

    /**
     * Checks if all entities match the filter expression.
     * @param expression Filter expression to apply
     * @param done Callback function called with true if all entities match, false otherwise, or error
     */
    every(expression: Filter<InferType<TEntity>>, done: QueryResult<boolean>): void;
    /**
     * Checks if all entities match the parameterized filter.
     * @param selector Parameterized filter function
     * @param params Parameters to pass to the filter function
     * @param done Callback function called with true if all entities match, false otherwise, or error
     */
    every<P extends {}>(expression: ParamsFilter<TEntity, P>, params: P, done: QueryResult<boolean>): void;
    every<P extends {} = never>(expression: Filter<InferType<TEntity>> | ParamsFilter<TEntity, P> | QueryResult<boolean>, paramsOrDone?: P | QueryResult<boolean>, done?: QueryResult<boolean>) {
        const result = new SelectionQueryable<InferType<TEntity>, InferType<TEntity>, void>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.every(expression as any, paramsOrDone, done);
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
    everyAsync<P extends {}>(expression: ParamsFilter<InferType<TEntity>, P>, params: P): Promise<boolean>;
    everyAsync<P extends {} = never>(expression?: Filter<InferType<TEntity>> | ParamsFilter<InferType<TEntity>, P>, params?: P): Promise<boolean> {
        const result = new SelectionQueryableAsync<InferType<TEntity>, InferType<TEntity>>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.everyAsync(expression as any, params);
    }

    /**
     * Finds the minimum value of the specified numeric property across all entities.
     * @param selector Function that selects the numeric property to find the minimum of
     * @param done Callback function called with the minimum value or error
     */
    min(selector: GenericFunction<InferType<TEntity>, number>, done: QueryResult<number>): void {
        const result = new SelectionQueryable<InferType<TEntity>, InferType<TEntity>, void>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.min(selector as any, done);
    }

    /**
     * Finds the minimum value of the specified numeric property across all entities asynchronously.
     * @param selector Function that selects the numeric property to find the minimum of
     * @returns Promise that resolves with the minimum value or rejects with an error
     */
    minAsync(selector: GenericFunction<InferType<TEntity>, number>): Promise<number> {
        const result = new SelectionQueryableAsync<InferType<TEntity>, InferType<TEntity>>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.minAsync(selector as any);
    }

    /**
     * Finds the maximum value of the specified numeric property across all entities.
     * @param selector Function that selects the numeric property to find the maximum of
     * @param done Callback function called with the maximum value or error
     */
    max(selector: GenericFunction<InferType<TEntity>, number>, done: QueryResult<number>): void {
        const result = new SelectionQueryable<InferType<TEntity>, InferType<TEntity>, void>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.max(selector as any, done);
    }

    /**
     * Finds the maximum value of the specified numeric property across all entities asynchronously.
     * @param selector Function that selects the numeric property to find the maximum of
     * @returns Promise that resolves with the maximum value or rejects with an error
     */
    maxAsync(selector: GenericFunction<InferType<TEntity>, number>): Promise<number> {
        const result = new SelectionQueryableAsync<InferType<TEntity>, InferType<TEntity>>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.maxAsync(selector as any);
    }

    /**
     * Calculates the sum of the specified numeric property across all entities.
     * @param selector Function that selects the numeric property to sum
     * @param done Callback function called with the sum or error
     */
    sum(selector: GenericFunction<InferType<TEntity>, number>, done: QueryResult<number>): void {
        const result = new SelectionQueryable<InferType<TEntity>, InferType<TEntity>, void>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.sum(selector as any, done);
    }

    /**
     * Calculates the sum of the specified numeric property across all entities asynchronously.
     * @param selector Function that selects the numeric property to sum
     * @returns Promise that resolves with the sum or rejects with an error
     */
    sumAsync(selector: GenericFunction<InferType<TEntity>, number>): Promise<number> {
        const result = new SelectionQueryableAsync<InferType<TEntity>, InferType<TEntity>>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.sumAsync(selector as any);
    }

    /**
     * Counts the number of entities in the collection.
     * @param done Callback function called with the count or error
     */
    count(done: QueryResult<number>): void {
        const result = new SelectionQueryable<InferType<TEntity>, InferType<TEntity>, void>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.count(done);
    }

    /**
     * Counts the number of entities in the collection asynchronously.
     * @returns Promise that resolves with the count or rejects with an error
     */
    countAsync(): Promise<number> {
        const result = new SelectionQueryableAsync<InferType<TEntity>, InferType<TEntity>>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.countAsync();
    }

    /**
     * Returns distinct entities from the collection, removing duplicates.
     * @param done Callback function called with the distinct entities or error
     */
    distinct(done: QueryResult<InferType<TEntity>[]>): void {
        const result = new SelectionQueryable<InferType<TEntity>, InferType<TEntity>, void>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.distinct(done);
    }

    /**
     * Returns distinct entities from the collection asynchronously, removing duplicates.
     * @returns Promise that resolves with the distinct entities or rejects with an error
     */
    distinctAsync(): Promise<InferType<TEntity>[]> {
        const result = new SelectionQueryableAsync<InferType<TEntity>, InferType<TEntity>>(this.schema as any, this.parent, {
            dataBridge: this.dataBridge as any,
            changeTracker: this.changeTracker as any
        });

        return result.distinctAsync();
    }

    private _resolvePromise<R>(options: {
        data?: R,
        error?: any
    }, resolve: (data?: R) => void, reject: (error?: any) => void) {

        const { data, error } = options;

        if (error != null) {
            reject(error);
            return
        }

        if (data == null) {
            resolve();
            return;
        }

        resolve(data);
    }
}