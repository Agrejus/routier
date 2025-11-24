import { DataBridge } from "../data-access/DataBridge";
import { DbPluginQueryEvent, EntityUpdateInfo, IQuery, ITranslatedValue, JsonTranslator, Query, QueryField, QueryOptionsCollection, QueryOrdering } from "@routier/core/plugins";
import { ChangeTrackingType, CompiledSchema, InferType } from "@routier/core/schema";
import { CallbackResult, PluginEventCallbackResult, PluginEventResult, PluginEventSuccessType, Result } from "@routier/core/results";
import { GenericFunction } from "@routier/core/types";
import { Filter, ParamsFilter, toExpression } from "@routier/core/expressions";
import { uuid } from "@routier/core/utilities";
import { SchemaCollection, TagCollection } from "@routier/core";
import { IChangeTracker } from "../change-tracking/types";
import { QueryableContainer } from '../queryable/IoC/QueryableContainer';

export abstract class QuerySource<TRoot extends {}, TShape> {

    protected readonly container: QueryableContainer<TRoot>;

    protected get dataBridge(): DataBridge<TRoot> {
        return this.container.resolve("dataBridge");
    }

    protected get removeQueryChangeTracker(): IChangeTracker<IQuery<TRoot, TRoot>> {
        return this.container.resolve("removeQueryChangeTracker");
    }

    protected get updateChangeTracker(): IChangeTracker<TRoot, EntityUpdateInfo<TRoot>> {
        return this.container.resolve("updateChangeTracker");
    }

    protected get queryOptions(): QueryOptionsCollection<TShape> {
        return this.container.resolve("queryOptions");
    }

    protected get isSubScribed(): boolean {
        return this.container.resolve("isSubScribed");
    }

    protected get skipInitialQuery(): boolean {
        return this.container.resolve("skipInitialQuery");
    }

    protected get schema(): CompiledSchema<TRoot> {
        return this.container.resolve("schema");
    }

    protected get schemas(): SchemaCollection {
        return this.container.resolve("schemas");
    }

    protected get scopedQueryOptions(): QueryOptionsCollection<TRoot> {
        return this.container.resolve("scopedQueryOptions");
    }

    protected get changeTrackingType(): ChangeTrackingType {
        return this.container.resolve("changeTrackingType");
    }

    protected get tags(): TagCollection {
        return this.container.resolve("tags");
    }

    constructor(container: QueryableContainer<TRoot>) {
        this.container = container;

        // if (options?.removeQueryChangeTracker != null) {
        //     this.removeQueryChangeTracker = options.removeQueryChangeTracker;
        // }

        // if (options?.updateChangeTracker != null) {
        //     this.updateChangeTracker = options.updateChangeTracker;
        // }

        // if (options?.queryable != null) {
        //     this.isSubScribed = options.queryable.isSubScribed;
        //     this.skipInitialQuery = options.queryable.skipInitialQuery;
        //     this.queryOptions = options.queryable.queryOptions;
        //     this.dataBridge = options.queryable.dataBridge;
        //     this.removeQueryChangeTracker = options.queryable.removeQueryChangeTracker;
        //     this.updateChangeTracker = options.queryable.updateChangeTracker;
        // } else {
        //     this.queryOptions = new QueryOptionsCollection<TShape>();
        // }
    }

    // // Cannot change the root type, it comes from the collection type, only the resulting type (shape)
    // protected create<Shape, TInstance extends QuerySource<TRoot, Shape>>(
    //     Instance: new (container: QueryableContainer<TRoot>) => TInstance) {
    //     return new Instance(this.container);
    // }

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

        this.removeQueryChangeTracker.track(query, null);

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

            this.postProcessQuery<TShape>(result, { databaseEvent, memoryEvent }, done);

        });
    }

    private postProcessQuery<TShape>(result: PluginEventSuccessType<ITranslatedValue<TShape>>, payload: { databaseEvent: DbPluginQueryEvent<TRoot, TShape>, memoryEvent: DbPluginQueryEvent<TRoot, TShape> }, done: PluginEventCallbackResult<TShape>) {

        const { databaseEvent, memoryEvent } = payload;

        try {

            // FIX TAGS
            const tags = TagCollection.from(this.tags);

            this.tags.clear();

            if (databaseEvent.operation.changeTracking === true) {
                // Post process the db query results
                result.data.forEach(item => this.schema.postprocess(item as InferType<TRoot>, this.changeTrackingType));
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

                // Resolve the data with the current attachments
                result.data.forEach(item => this.updateChangeTracker.track(item as TRoot, tags));

                return done(PluginEventResult.success(memoryEvent.id, result.data.value as TShape));
            }

            // No change tracking on the result, just return it as is
            if (databaseEvent.operation.changeTracking === false) {
                return done(PluginEventResult.success(databaseEvent.id, result.data.value as TShape));
            }

            // Resolve the data with the current attachments
            result.data.forEach(item => this.updateChangeTracker.track(item as TRoot, tags));

            done(PluginEventResult.success(databaseEvent.id, result.data.value));
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

    protected setGroupQueryOption<K, R>(selector: GenericFunction<K, R>) {

        const [key] = this.getFields(selector);
        let fields = this.schema.properties.map(x => ({
            destinationName: x.name,
            getter: x.getValue,
            isRename: false,
            sourceName: x.name,
            property: x
        } as QueryField));
        const map = this.queryOptions.getLast("map");

        // If we remapped, grab those fields
        if (map != null) {
            fields = map.value.fields;
        }

        this.queryOptions.add("group", { selector: selector as GenericFunction<any, any>, key, fields });
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