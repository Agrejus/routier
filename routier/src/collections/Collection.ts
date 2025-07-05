import { CollectionOptions, CollectionPipelines, EntityMap, SaveChangesPayload } from "../types";
import { IDbPlugin, InferCreateType, InferType, Filter, ParamsFilter, CompiledSchema, Query, GenericFunction, ICollectionSubscription, SchemaParent, ChangeTrackingType, SubscriptionChanges, EntityChanges, CallbackResult, Result } from 'routier-core';
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
    protected subscription: ICollectionSubscription<TEntity>;
    private readonly parent: SchemaParent;
    private _tag: unknown;

    constructor(
        dbPlugin: IDbPlugin,
        schema: CompiledSchema<TEntity>,
        options: CollectionOptions,
        pipelines: CollectionPipelines,
        parent: SchemaParent
    ) {

        this.subscription = schema.createSubscription(options.signal);
        this.schema = schema;
        this.changeTracker = new ChangeTracker(schema);
        this.dataBridge = DataBridge.create<TEntity>(dbPlugin, options);
        this.parent = parent;

        pipelines.saveChanges
            .check(() => this.changeTracker.hasChanges())
            .pipe(this.resetPipeline.bind(this))
            .pipe(this.prepareAdditions.bind(this))
            .pipe(this.prepareRemovals.bind(this))
            .pipe(this.prepareUpdates.bind(this))
            .pipe(this.persist.bind(this));

        pipelines.previewChanges
            .check(() => this.changeTracker.hasChanges())
            .pipe(this.prepareAdditions.bind(this))
            .pipe(this.prepareUpdates.bind(this))
            .pipe(this.prepareRemovals.bind(this));
    }

    protected get changeTrackingType(): ChangeTrackingType {
        return "entity";
    }

    // We save in the persist operation, we need to reset the items we are sending in so we do not double save
    protected resetPipeline(data: SaveChangesPayload<TEntity>, done: (result: SaveChangesPayload<TEntity>, error?: any) => void) {

        data.adds.entities = [];
        data.updates.changes = []
        data.removes.entities = [];
        data.removes.queries = [];

        done(data);
    }

    protected prepareAdditions(data: { adds: EntityChanges<TEntity>["adds"] }, done: (result: { adds: EntityChanges<TEntity>["adds"] }, error?: any) => void) {

        try {
            const entities = this.changeTracker.prepareAdditions();

            if (entities.length > 0) {
                data.adds.entities.push(...entities);
            }

            done(data);
        } catch (e) {
            done(null, e);
        }
    }

    protected prepareUpdates(data: { updates: EntityChanges<TEntity>["updates"] }, done: (result: { updates: EntityChanges<TEntity>["updates"] }) => void) {

        const changes = this.changeTracker.getAttachmentsChanges();

        if (changes.length > 0) {
            data.updates.changes.push(...changes);
        }

        done(data);
    }

    protected prepareRemovals(data: { removes: EntityChanges<TEntity>["removes"] }, done: (result: { removes: EntityChanges<TEntity>["removes"] }, error?: any) => void) {

        try {
            const removes = this.changeTracker.prepareRemovals();

            if (removes.entities.length > 0) {
                data.removes.entities.push(...removes.entities);
            }

            if (removes.queries.length > 0) {
                data.removes.queries.push(...removes.queries);
            }

            done(data);
        } catch (e) {
            done(null, e);
        }
    }

    protected persist(data: SaveChangesPayload<TEntity>, done: (result: SaveChangesPayload<TEntity>, error?: any) => void) {

        const tags = this.changeTracker.getAndDestroyTags();

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
        }, (result) => {

            this.changeTracker.clearAdditions();

            if (result.ok === false) {
                done(data);
                return;
            }

            // merge only the changes from the collections persist operation
            this.changeTracker.mergeChanges(result.data);

            // we only want to notify of changes when an item that was saved matches the query
            // these get reset each time
            // send in the resulting adds because properties might have been set from the db operation
            const updates = data.updates.changes.map(w => w.entity);
            const removals = data.removes;
            const adds = result.data.adds;

            const changes: SubscriptionChanges<TEntity> = {
                updates,
                adds: adds.entities as InferType<TEntity>[],
                removals: removals.entities,
                removalQueries: removals.queries
            };

            this.subscription.send(changes);

            // build the result
            data.result.adds.entities.push(...result.data.adds.entities);
            data.result.updates.entities.push(...result.data.updates.entities);
            data.result.removed.count += result.data.removed.count;
            data.count = data.result.adds.entities.length + data.result.removed.count + data.result.updates.entities.length;

            done(data);
        });
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

        /** Finds attached entity using a selector function, returning first entity that matches the criteria */
        find: (selector: GenericFunction<InferType<TEntity>, boolean>) => {
            return this.changeTracker.findAttached(selector);
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


    hasChanges() {
        return this.changeTracker.hasChanges();
    }

    /**
     * Adds entities to the collection and persists them to the database.
     * @param entities Array of entities to add to the collection
     * @param done Callback function called with the added entities or error
     */
    add(entities: InferCreateType<TEntity>[], done: CallbackResult<InferType<TEntity>[]>) {
        const tag = this.getAndDestroyTag()
        this.changeTracker.add(entities, tag, done);
    }

    /**
     * Adds entities to the collection asynchronously and returns a Promise.
     * @param entities Entities to add to the collection
     * @returns Promise that resolves with the added entities or rejects with an error
     */
    addAsync(...entities: InferCreateType<TEntity>[]) {
        return new Promise<InferType<TEntity>[]>((resolve, reject) => this.add(entities, (r) => Result.resolve(r, resolve, reject)));
    }

    /**
     * Removes entities from the collection and persists the changes to the database.
     * @param entities Array of entities to remove from the collection
     * @param done Callback function called with the removed entities or error
     */
    remove(entities: InferType<TEntity>[], done: CallbackResult<InferType<TEntity>[]>) {
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
            this.remove(entities, (r) => Result.resolve(r, resolve, reject));
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
        return new Promise<void>((resolve, reject) => this.removeAll((r) => Result.resolve(r, resolve, reject)));
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
    toArray(done: CallbackResult<InferType<TEntity>[]>) {
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
    first(expression: Filter<InferType<TEntity>>, done: CallbackResult<InferType<TEntity>>): void;
    /**
     * Returns the first entity that matches the parameterized filter.
     * @param selector Parameterized filter function
     * @param params Parameters to pass to the filter function
     * @param done Callback function called with the first matching entity or error
     */
    first<P extends {}>(expression: ParamsFilter<TEntity, P>, params: P, done: CallbackResult<InferType<TEntity>>): void;
    /**
     * Returns the first entity in the collection.
     * @param done Callback function called with the first entity or error
     */
    first(done: CallbackResult<InferType<TEntity>>): void;
    first<P extends {} = never>(doneOrExpression: Filter<InferType<TEntity>> | ParamsFilter<TEntity, P> | CallbackResult<InferType<TEntity>>, paramsOrDone?: P | CallbackResult<InferType<TEntity>>, done?: CallbackResult<InferType<TEntity>>) {
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
    firstOrUndefined(expression: Filter<InferType<TEntity>>, done: CallbackResult<InferType<TEntity> | undefined>): void;
    /**
     * Returns the first entity that matches the parameterized filter, or undefined if none found.
     * @param selector Parameterized filter function
     * @param params Parameters to pass to the filter function
     * @param done Callback function called with the first matching entity, undefined, or error
     */
    firstOrUndefined<P extends {}>(expression: ParamsFilter<TEntity, P>, params: P, done: CallbackResult<InferType<TEntity> | undefined>): void;
    /**
     * Returns the first entity in the collection, or undefined if empty.
     * @param done Callback function called with the first entity, undefined, or error
     */
    firstOrUndefined(done: CallbackResult<InferType<TEntity> | undefined>): void;
    firstOrUndefined<P extends {} = never>(doneOrExpression: Filter<InferType<TEntity>> | ParamsFilter<TEntity, P> | CallbackResult<InferType<TEntity> | undefined>, paramsOrDone?: P | CallbackResult<InferType<TEntity> | undefined>, done?: CallbackResult<InferType<TEntity> | undefined>) {
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
    some(expression: Filter<InferType<TEntity>>, done: CallbackResult<boolean>): void;
    /**
     * Checks if any entity matches the parameterized filter.
     * @param selector Parameterized filter function
     * @param params Parameters to pass to the filter function
     * @param done Callback function called with true if any entity matches, false otherwise, or error
     */
    some<P extends {}>(expression: ParamsFilter<TEntity, P>, params: P, done: CallbackResult<boolean>): void;
    /**
     * Checks if the collection has any entities.
     * @param done Callback function called with true if collection has entities, false otherwise, or error
     */
    some(done: CallbackResult<boolean>): void;
    some<P extends {} = never>(doneOrExpression: Filter<InferType<TEntity>> | ParamsFilter<TEntity, P> | CallbackResult<boolean>, paramsOrDone?: P | CallbackResult<boolean>, done?: CallbackResult<boolean>) {
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
    every(expression: Filter<InferType<TEntity>>, done: CallbackResult<boolean>): void;
    /**
     * Checks if all entities match the parameterized filter.
     * @param selector Parameterized filter function
     * @param params Parameters to pass to the filter function
     * @param done Callback function called with true if all entities match, false otherwise, or error
     */
    every<P extends {}>(expression: ParamsFilter<TEntity, P>, params: P, done: CallbackResult<boolean>): void;
    every<P extends {} = never>(expression: Filter<InferType<TEntity>> | ParamsFilter<TEntity, P> | CallbackResult<boolean>, paramsOrDone?: P | CallbackResult<boolean>, done?: CallbackResult<boolean>) {
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
    min(selector: GenericFunction<InferType<TEntity>, number>, done: CallbackResult<number>): void {
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
    max(selector: GenericFunction<InferType<TEntity>, number>, done: CallbackResult<number>): void {
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
    sum(selector: GenericFunction<InferType<TEntity>, number>, done: CallbackResult<number>): void {
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
    count(done: CallbackResult<number>): void {
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
    distinct(done: CallbackResult<InferType<TEntity>[]>): void {
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
}