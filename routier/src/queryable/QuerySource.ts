import { toExpression, QueryField, CompiledSchema, DbPluginQueryEvent, GenericFunction, QueryOptionsCollection, Filter, ParamsFilter, QueryOrdering, Query, CallbackResult, InferType, Result, SchemaId, IQuery } from "routier-core";
import { DataBridge } from "../data-access/DataBridge";
import { ChangeTracker } from "../change-tracking/ChangeTracker";

export abstract class QuerySource<TRoot extends {}, TShape> {

    protected readonly dataBridge: DataBridge<TRoot>;
    protected readonly changeTracker: ChangeTracker<TRoot>;
    protected readonly queryOptions: QueryOptionsCollection<TShape>;
    protected isSubScribed: boolean = false;
    protected schema: CompiledSchema<TRoot>;
    protected schemas: Map<SchemaId, CompiledSchema<any>>;

    constructor(schema: CompiledSchema<TRoot>, schemas: Map<SchemaId, CompiledSchema<any>>, options: { queryable?: QuerySource<TRoot, TShape>, dataBridge?: DataBridge<TRoot>, changeTracker?: ChangeTracker<TRoot> }) {

        this.schema = schema;
        this.schemas = schemas;

        if (options?.dataBridge != null) {
            this.dataBridge = options.dataBridge;
        }

        if (options?.changeTracker != null) {
            this.changeTracker = options.changeTracker;
        }

        if (options?.queryable != null) {
            this.isSubScribed = options.queryable.isSubScribed;
            this.queryOptions = options.queryable.queryOptions;
            this.dataBridge = options.queryable.dataBridge;
            this.changeTracker = options.queryable.changeTracker;
        } else {
            this.queryOptions = new QueryOptionsCollection<TShape>();
        }
    }

    // Cannot change the root type, it comes from the collection type, only the resulting type (shape)
    protected create<Shape, TInstance extends QuerySource<TRoot, Shape>>(Instance: new (schema: CompiledSchema<TRoot>, schemas: Map<SchemaId, CompiledSchema<any>>, options: { queryable?: QuerySource<TRoot, Shape>, dataBridge?: DataBridge<TRoot>, changeTracker?: ChangeTracker<TRoot> }) => TInstance) {
        return new Instance(this.schema, this.schemas, { queryable: this as any });
    }

    protected _remove<U>(done: CallbackResult<never>) {

        const query = new Query<TRoot, TRoot>(this.queryOptions as any, this.schema, false);

        this.changeTracker.removeByQuery(query, null, done);

        return this.subscribeQuery<TShape[]>(done) as U;
    }

    protected subscribeQuery<U>(done: CallbackResult<U>) {

        if (this.isSubScribed === false) {
            return () => { };
        }

        const event = this.createEvent<U>();
        const tags = this.changeTracker.tags.get();

        this.changeTracker.tags.destroy()

        return this.dataBridge.subscribe<U, unknown>(event, (r) => {

            if (r.ok === Result.ERROR) {
                done(r);
                return;
            }

            if (event.operation.changeTracking === true) {
                const enriched = this.changeTracker.enrich(r.data as InferType<TRoot>[]);
                const resolved = this.changeTracker.resolve(enriched, tags, { merge: true });
                done(Result.success(resolved as U));
                return;
            }

            done(r);
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
                const property = this.schema.getProperty(sourcePathAndName);

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


    protected createEvent<Shape>(): DbPluginQueryEvent<TRoot, Shape> {
        return {
            operation: new Query<TRoot, Shape>(this.queryOptions as any, this.schema),
            schemas: this.schemas,
        }
    }

    protected getData<TShape>(done: CallbackResult<TShape>) {

        const event = this.createEvent<TShape>();

        this.dataBridge.query<TShape>(event, (result) => {

            if (result.ok === Result.ERROR) {
                done(result);
                return;
            }

            const tags = this.changeTracker.tags.get();

            this.changeTracker.tags.destroy();

            // if change tracking is true, we will never be shaping the result from .map()
            if (event.operation.changeTracking === true) {
                const enriched = this.changeTracker.enrich(result as any);
                const resolved = this.changeTracker.resolve(enriched, tags);

                done(resolved as any);
                return;
            }

            done(result);
        });
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