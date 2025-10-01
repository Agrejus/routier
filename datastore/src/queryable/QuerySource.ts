import { DataBridge } from "../data-access/DataBridge";
import { ChangeTracker } from "../change-tracking/ChangeTracker";
import { DbPluginQueryEvent, JsonTranslator, Query, QueryField, QueryOptionsCollection, QueryOrdering } from "@routier/core/plugins";
import { ChangeTrackingType, CompiledSchema, InferType, SchemaId } from "@routier/core/schema";
import { CallbackResult, PluginEventCallbackResult, PluginEventResult, PluginEventSuccessType, Result } from "@routier/core/results";
import { GenericFunction } from "@routier/core/types";
import { Filter, ParamsFilter, toExpression } from "@routier/core/expressions";
import { uuid } from "@routier/core/utilities";
import { SchemaCollection } from "@routier/core";

export abstract class QuerySource<TRoot extends {}, TShape> {

    protected readonly dataBridge: DataBridge<TRoot>;
    protected readonly changeTracker: ChangeTracker<TRoot>;
    protected readonly queryOptions: QueryOptionsCollection<TShape>;
    protected isSubScribed: boolean = false;
    protected skipInitialQuery: boolean = false;
    protected schema: CompiledSchema<TRoot>;
    protected schemas: SchemaCollection;
    protected scopedQueryOptions: QueryOptionsCollection<TRoot>;
    protected readonly changeTrackingType: ChangeTrackingType

    constructor(schema: CompiledSchema<TRoot>, schemas: SchemaCollection, scopedQueryOptions: QueryOptionsCollection<TRoot>, changeTrackingType: ChangeTrackingType, options: { queryable?: QuerySource<TRoot, TShape>, dataBridge?: DataBridge<TRoot>, changeTracker?: ChangeTracker<TRoot> }) {

        this.schema = schema;
        this.schemas = schemas;
        this.scopedQueryOptions = scopedQueryOptions;
        this.changeTrackingType = changeTrackingType;

        if (options?.dataBridge != null) {
            this.dataBridge = options.dataBridge;
        }

        if (options?.changeTracker != null) {
            this.changeTracker = options.changeTracker;
        }

        if (options?.queryable != null) {
            this.isSubScribed = options.queryable.isSubScribed;
            this.skipInitialQuery = options.queryable.skipInitialQuery;
            this.queryOptions = options.queryable.queryOptions;
            this.dataBridge = options.queryable.dataBridge;
            this.changeTracker = options.queryable.changeTracker;
        } else {
            this.queryOptions = new QueryOptionsCollection<TShape>();
        }
    }

    // Cannot change the root type, it comes from the collection type, only the resulting type (shape)
    protected create<Shape, TInstance extends QuerySource<TRoot, Shape>>(
        Instance: new (
            schema: CompiledSchema<TRoot>,
            schemas: SchemaCollection,
            scopedQueryOptions: QueryOptionsCollection<TRoot>,
            changeTrackingType: ChangeTrackingType,
            options: { queryable?: QuerySource<TRoot, Shape>, dataBridge?: DataBridge<TRoot>, changeTracker?: ChangeTracker<TRoot> }
        ) => TInstance) {
        return new Instance(this.schema, this.schemas, this.scopedQueryOptions, this.changeTrackingType, { queryable: this as any });
    }

    private resolveQueryOptions<T>() {
        if (this.scopedQueryOptions.items.size === 0) {
            return this.queryOptions;
        }

        // Combine scoped options with the built query
        const resolvedQueryOptions = new QueryOptionsCollection<T>();

        // Add scoped items first
        this.scopedQueryOptions.forEach(item => {
            resolvedQueryOptions.add(item.name, item.value);
        });

        // Add query options last to ensure we perform scoped operations first
        // in case we have any memory execution targets
        this.queryOptions.forEach(item => {
            resolvedQueryOptions.add(item.name, item.value);
        });

        return resolvedQueryOptions;
    }

    protected _remove<U>(done: CallbackResult<never>) {

        const query = new Query<TRoot, TRoot>(this.resolveQueryOptions<TRoot>() as any, this.schema, false);

        this.changeTracker.removeByQuery(query, null, done);

        return this.subscribeQuery<TShape[]>(done) as U;
    }

    protected subscribeQuery<U>(done: CallbackResult<U>) {

        if (this.isSubScribed === false) {
            return () => { };
        }

        const { databaseEvent, memoryEvent } = this.createQueryPayload<U>();

        return this.dataBridge.subscribe<U, unknown>(databaseEvent, (r) => {

            if (r.ok === Result.ERROR) {
                done(r);
                return;
            }

            this.postProcessQuery(r, { databaseEvent, memoryEvent }, done);
        });
    }

    protected getSortPropertyName(selector: GenericFunction<TShape, TShape[keyof TShape]>) {
        const stringified = selector.toString();

        if (stringified.includes("=>") === false) {
            throw new Error("Only arrow functions allowed in .map()")
        }

        const [, body] = stringified.split("=>").map(w => w.trim());

        return this._extractPropertyName(body);
    }

    protected getFields<TRoot, R>(selector: GenericFunction<TRoot, R>): QueryField[] {

        const stringified = selector.toString();

        if (stringified.includes("=>") === false) {
            throw new Error("Only arrow functions allowed in .map()")
        }

        const [, body] = stringified.split("=>").map(w => w.trim());


        if (body.includes("{")) {
            const propertyPaths = body.replace(/{|}|\(|\)/g, "").split(",").map(w => w.trim());
            return propertyPaths.map(propertyPath => {
                const [destinationName, sourcePathAndName] = propertyPath.split(":").map(w => w.trim());
                const sourceName = this._extractPropertyName(sourcePathAndName);
                const property = this.schema.getProperty(sourceName);

                return {
                    sourceName,
                    destinationName,
                    isRename: sourceName === destinationName,
                    property
                } as QueryField;
            })
        }

        const field = this._extractPropertyName(body);
        const property = this.schema.getProperty(field);

        return [{
            destinationName: field,
            sourceName: field,
            isRename: false,
            property
        } as QueryField];
    }

    private _extractPropertyName(value: string) {
        const split = value.split(".");

        split.shift();

        return split.join(".")
    }


    protected createQueryPayload<Shape>(): { memoryEvent: DbPluginQueryEvent<TRoot, Shape>, databaseEvent: DbPluginQueryEvent<TRoot, Shape> } {

        // send over only the database operations, if there are none its a select all
        const splitQueryOptions = this.resolveQueryOptions<Shape>().split();

        return {
            databaseEvent: {
                operation: new Query<TRoot, Shape>(splitQueryOptions.database as any, this.schema),
                schemas: this.schemas,
                id: uuid(8),
                source: "collection"
            },
            memoryEvent: {
                operation: new Query<TRoot, Shape>(splitQueryOptions.memory as any, this.schema),
                schemas: this.schemas,
                id: uuid(8),
                source: "collection"
            }
        }
    }

    protected getData<TShape>(done: PluginEventCallbackResult<TShape>) {

        if (this.skipInitialQuery) {
            return;
        }

        const { databaseEvent, memoryEvent } = this.createQueryPayload<TShape>();

        this.dataBridge.query<TShape>(databaseEvent, (result) => {

            if (result.ok === PluginEventResult.ERROR) {
                done(result);
                return;
            }

            this.postProcessQuery(result, { databaseEvent, memoryEvent }, done);

        });
    }

    private postProcessQuery<TShape>(result: PluginEventSuccessType<TShape>, payload: { databaseEvent: DbPluginQueryEvent<TRoot, TShape>, memoryEvent: DbPluginQueryEvent<TRoot, TShape> }, done: PluginEventCallbackResult<TShape>) {

        const { databaseEvent, memoryEvent } = payload;

        try {
            const tags = this.changeTracker.tags.get();

            this.changeTracker.tags.destroy();

            // if change tracking is true, we will never be shaping the result from .map()
            if (databaseEvent.operation.changeTracking === true) {

                const enriched = this.changeTracker.deserializeAndEnrich(result.data as InferType<TRoot>[], this.changeTrackingType);

                // This means we are querying on a computed property that is untracked, need to select
                // all and query in memory
                if (Query.isEmpty(memoryEvent.operation) === false) {
                    const translator = new JsonTranslator(memoryEvent.operation);
                    const data = translator.translate(enriched);

                    if (memoryEvent.operation.changeTracking === false) {
                        return done(PluginEventResult.success(memoryEvent.id, data));
                    }

                    const resolved = this.changeTracker.resolve(data as InferType<TRoot>[], tags, {
                        merge: true
                    });
                    return done(PluginEventResult.success(memoryEvent.id, resolved as TShape));
                }

                const resolved = this.changeTracker.resolve(enriched, tags, {
                    merge: true
                });

                return done(PluginEventResult.success(databaseEvent.id, resolved as TShape));
            }

            done(result);
        } catch (e) {
            done(PluginEventResult.error(databaseEvent.id, e));
        }
    }

    protected setFiltersQueryOption<P extends {}>(selector: ParamsFilter<TShape, P> | Filter<TShape>, params?: P) {

        const expression = toExpression(this.schema, selector, params);

        this.queryOptions.add("filter", { filter: selector as Filter<TShape> | ParamsFilter<TShape, {}>, expression, params });
    }

    protected setMapQueryOption<K, R>(selector: GenericFunction<K, R>) {

        const fields = this.getFields(selector);

        this.queryOptions.add("map", { selector: selector as GenericFunction<any, any>, fields });
    }

    protected setSortQueryOption(selector: GenericFunction<TShape, TShape[keyof TShape]>, direction: QueryOrdering) {
        const propertyName = this.getSortPropertyName(selector);

        this.queryOptions.add("sort", { selector, direction, propertyName });
    }

    protected setSkipQueryOption(amount: number) {
        this.queryOptions.add("skip", amount);
    }

    protected setTakeQueryOption(amount: number) {
        this.queryOptions.add("take", amount);
    }
}   