import { toExpression, Expression, combineExpressions, QueryField, IQuery, Filterable, Query, CompiledSchema, DbPluginQueryEvent, SchemaParent, InferType, GenericFunction, QueryOptionsCollection, Filter, ParamsFilter, QueryOrdering } from "routier-core";
import { DataBridge } from "../data-access/DataBridge";
import { ChangeTracker } from "../change-tracking/ChangeTracker";

export abstract class QuerySource<T extends {}> {

    protected readonly dataBridge: DataBridge<T>;
    protected readonly changeTracker: ChangeTracker<T>;
    protected readonly queryOptions: QueryOptionsCollection;
    protected isSubScribed: boolean = false;
    private _compiledQuery: IQuery<T> | null = null;
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
        }
    }

    protected create<R extends {}, TInstance extends QuerySource<R>>(Instance: new (schema: CompiledSchema<R>, parent: SchemaParent, options: { queryable?: QuerySource<R>, dataBridge?: DataBridge<R>, changeTracker?: ChangeTracker<R> }) => TInstance) {
        return new Instance(this.schema as any, this.parent, { queryable: this as any });
    }

    protected _remove<U>(done: (error?: any) => void) {
        const expression = this.getExpression();

        // failed to parse expression, fall back to memory filtering
        if (expression.ok === false) {
            this.getData<InferType<T>[]>((dataToRemove, dataToRemoveError) => {

                if (dataToRemoveError != null) {
                    done(dataToRemoveError);
                    return;
                }

                this.changeTracker.remove(dataToRemove, null, (_, error) => {
                    if (error) {
                        done(error);
                        return;
                    }

                    done();
                });
            });
            return;
        }

        this.changeTracker.removeByExpression(expression.result, null, done);
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
                    getter: () => 1 as any
                };
            })
        }

        const field = this._extractPropertyName(body);

        return [{
            destinationName: field,
            sourceName: field,
            getter: () => 1 as any
        }];
    }

    private _extractPropertyName(value: string) {
        const split = value.split(".");

        split.shift();

        return split.join(".")
    }

    private _convertToExpression(filter: Filterable<T>) {

        if (filter.params != null) {
            return toExpression(this.schema, filter.filter, filter.params);
        }

        try {
            return toExpression(this.schema, filter.filter, null);
        } catch (e) {
            return null; // fallback to memory filtering
        }
    }

    protected getExpression(): { ok: boolean, result: Expression } {

        const filters = this.queryOptions.get<Filterable<T, any>[]>("filters");

        if (filters == null || filters.value.length === 0) {
            return {
                ok: true,
                result: Expression.EMPTY
            }; // Select All
        }

        const expressions: Expression[] = [];

        for (let i = 0, length = filters.value.length; i < length; i++) {
            const filter = filters.value[i];
            const expression = this._convertToExpression(filter);

            if (expression == null) {
                return {
                    ok: false,
                    result: Expression.EMPTY
                }; // Select All, fall back to memory filtering for everything
            }

            expressions.push(expression);
        }

        return {
            ok: true,
            result: combineExpressions(...expressions)
        };
    }

    protected getOrCompileQuery() {

        if (this._compiledQuery != null) {
            return this._compiledQuery;
        }

        const expression = this.getExpression();
        const options = this.getQueryOptions();
        const filters = this.queryOptions.get<Filterable<T, any>[]>("filters");

        this._compiledQuery = new Query(
            options,
            filters?.value ?? [],
            expression.result
        );

        return this._compiledQuery;
    }

    protected createEvent<TShape>(): DbPluginQueryEvent<T, TShape> {
        return {
            operation: this.getOrCompileQuery() as any,
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
        if (params == null) {
            this.queryOptions.add("filters", { filter: selector });
            return;
        }

        this.queryOptions.add("filters", { params, filter: selector });
    }

    protected setMapQueryOption<T, R>(expression: GenericFunction<T, R>) {
        const fields = this.getFields(expression);

        this.queryOptions.add("map", { expression, fields });
    }

    protected setSortQueryOption(selector: GenericFunction<T, T[keyof T]>, direction: QueryOrdering) {
        const key = this.getSortPropertyName(selector);

        this.queryOptions.add("sort", { selector, direction, key });
    }

    protected setSkipQueryOption(amount: number) {
        this.queryOptions.add("skip", amount);
    }

    protected setTakeQueryOption(amount: number) {
        this.queryOptions.add("take", amount);
    }
}   