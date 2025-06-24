import { toExpression, QueryField, CompiledSchema, DbPluginQueryEvent, SchemaParent, InferType, GenericFunction, QueryOptionsCollection, Filter, ParamsFilter, QueryOrdering, Query, combineExpressions, Expression, IQuery } from "routier-core";
import { DataBridge } from "../data-access/DataBridge";
import { ChangeTracker } from "../change-tracking/ChangeTracker";

export abstract class QuerySource<T extends {}> {

    protected readonly dataBridge: DataBridge<T>;
    protected readonly changeTracker: ChangeTracker<T>;
    protected readonly queryOptions: QueryOptionsCollection<T>;
    protected isSubScribed: boolean = false;
    protected schema: CompiledSchema<T>;
    protected parent: SchemaParent;

    constructor(schema: CompiledSchema<T>, parent: SchemaParent, options: { queryable?: QuerySource<T>, dataBridge?: DataBridge<T>, changeTracker?: ChangeTracker<T> }) {

        this.schema = schema;
        this.parent = parent;

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
            this.queryOptions = new QueryOptionsCollection<T>();
        }
    }

    protected create<R extends {}, TInstance extends QuerySource<R>>(Instance: new (schema: CompiledSchema<R>, parent: SchemaParent, options: { queryable?: QuerySource<R>, dataBridge?: DataBridge<R>, changeTracker?: ChangeTracker<R> }) => TInstance) {
        return new Instance(this.schema as any, this.parent, { queryable: this as any });
    }

    protected _remove<U>(done: (error?: any) => void) {

        const query = new Query<T>(this.queryOptions, false);

        this.changeTracker.removeByQuery(query, null, done);

        return this.subscribeQuery<T[]>(done) as U;
    }

    protected subscribeQuery<U>(done: (result: U, error?: any) => void) {

        if (this.isSubScribed === false) {
            return () => { };
        }

        const event = this.createEvent();
        const tags = this.changeTracker.getAndDestroyTags();

        return this.dataBridge.subscribe<U, unknown>(event, (r, e) => {

            if (event.operation.changeTracking === true) {
                const enriched = this.changeTracker.enrich(r as any);
                const resolved = this.changeTracker.resolve(enriched, tags, { merge: true });
                done(resolved as U, e);
                return;
            }

            done(r, e);
        });
    }

    protected getSortPropertyName(selector: GenericFunction<T, T[keyof T]>) {
        const stringified = selector.toString();

        if (stringified.includes("=>") === false) {
            throw new Error("Only arrow functions allowed in .map()")
        }

        const [, body] = stringified.split("=>").map(w => w.trim());

        return this._extractPropertyName(body);
    }

    protected getFields<T, R>(selector: GenericFunction<T, R>): QueryField[] {

        const stringified = selector.toString();

        if (stringified.includes("=>") === false) {
            throw new Error("Only arrow functions allowed in .map()")
        }

        const [, body] = stringified.split("=>").map(w => w.trim());

        if (body.includes("{")) {
            const properties = body.replace(/{|}|\(|\)/g, "").split(",").map(w => w.trim());
            return properties.map(property => {
                const [destinationName, sourcePathAndName] = property.split(":").map(w => w.trim());
                const sourceName = this._extractPropertyName(sourcePathAndName);

                return {
                    sourceName,
                    destinationName,
                    isRename: sourceName === destinationName,
                    getter: () => { throw new Error('Not implemented') }
                } as QueryField;
            })
        }

        const field = this._extractPropertyName(body);

        return [{
            destinationName: field,
            sourceName: field,
            isRename: false,
            getter: () => { throw new Error('Not implemented') }
        } as QueryField];
    }

    private _extractPropertyName(value: string) {
        const split = value.split(".");

        split.shift();

        return split.join(".")
    }


    protected createEvent(): DbPluginQueryEvent<T> {
        return {
            operation: new Query(this.queryOptions),
            parent: this.parent,
            schema: this.schema
        }
    }

    protected getData<TShape>(done: (result: TShape, error?: any) => void) {

        const event = this.createEvent();

        this.dataBridge.query<TShape>(event, (result, error) => {

            if (error != null) {
                done(result, error)
                return;
            }

            const tags = this.changeTracker.getAndDestroyTags();

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

    protected setFiltersQueryOption<P extends {}>(selector: ParamsFilter<T, P> | Filter<T>, params?: P) {

        const expression = toExpression(this.schema, selector, params);

        this.queryOptions.add("filter", { filter: selector as Filter<T> | ParamsFilter<T, {}>, expression, params });
    }

    protected setMapQueryOption<K, R>(selector: GenericFunction<K, R>) {
        const fields = this.getFields(selector);

        this.queryOptions.add("map", { selector: selector as GenericFunction<any, any>, fields });
    }

    protected setSortQueryOption(selector: GenericFunction<T, T[keyof T]>, direction: QueryOrdering) {
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