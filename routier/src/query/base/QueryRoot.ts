import { QueryOptions, toExpression, Expression, combineExpressions, QueryField, IQuery, Filterable, Query, CompiledSchema, DbPluginQueryEvent, SchemaParent, InferType } from "routier-core";
import { EntityMap } from "../../types";
import { QueryOrdering } from "../types";
import { DataBridge } from "../../data-access/DataBridge";
import { ChangeTracker } from "../../change-tracking/ChangeTracker";

export abstract class QueryRoot<T extends {}> {

    protected readonly dataBridge: DataBridge<T>;
    protected readonly changeTracker: ChangeTracker<T>;
    protected filters: Filterable<T, any>[] = [];
    protected mapValue: EntityMap<T, T[keyof T] | {}> | null = null;
    protected takeValue: number | null = null;
    protected skipValue: number | null = null;
    protected sorting: { direction: QueryOrdering, selector: EntityMap<T, T[keyof T]> }[] = [];
    protected minValue: boolean = false
    protected maxValue: boolean = false
    protected countValue: boolean = false
    protected sumValue: boolean = false;
    protected distinctValue: boolean = false;
    protected subscribeValue: boolean = false;
    private _compiledQuery: IQuery<T> | null = null;
    protected schema: CompiledSchema<T>;
    protected parent: SchemaParent;

    constructor(schema: CompiledSchema<T>, parent: SchemaParent, options: { queryable?: QueryRoot<T>, dataBridge?: DataBridge<T>, changeTracker?: ChangeTracker<T> }) {

        this.schema = schema;
        this.parent = parent;

        if (options?.dataBridge != null) {
            this.dataBridge = options.dataBridge;
        }

        if (options?.changeTracker != null) {
            this.changeTracker = options.changeTracker;
        }

        if (options?.queryable != null) {

            this.dataBridge = options.queryable.dataBridge;
            this.changeTracker = options.queryable.changeTracker;

            this.subscribeValue = options.queryable.subscribeValue;
            this.filters = options.queryable.filters;
            this.takeValue = options.queryable.takeValue;
            this.skipValue = options.queryable.skipValue;
            this.mapValue = options.queryable.mapValue;
            this.sorting = options.queryable.sorting;
            this.minValue = options.queryable.minValue;
            this.maxValue = options.queryable.maxValue;
            this.countValue = options.queryable.countValue;
            this.sumValue = options.queryable.sumValue;
            this.distinctValue = options.queryable.distinctValue;
        }
    }

    protected getQueryOptions(): QueryOptions {

        const fields = this._getFields(this.mapValue);
        const sort = this._getSorting(this.sorting);

        return {
            count: this.countValue,
            distinct: this.distinctValue,
            max: this.maxValue,
            min: this.minValue,
            sort,
            skip: this.skipValue,
            sum: this.sumValue,
            take: this.takeValue,
            fields,
            shaper: this.mapValue
        }
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

        if (this.subscribeValue === false) {
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

    private _getSorting(sorting: { direction: QueryOrdering, selector: EntityMap<T, T[keyof T]> }[]) {
        return sorting.map(sort => {
            const propertyName = this._getSortPropertyName(sort.selector);

            return { direction: sort.direction, key: propertyName, selector: sort.selector }
        });
    }

    private _getSortPropertyName(selector: EntityMap<T, T[keyof T]>) {
        const stringified = selector.toString();

        if (stringified.includes("=>") === false) {
            throw new Error("Only arrow functions allowed in .map()")
        }

        const [, body] = stringified.split("=>").map(w => w.trim());

        return this._extractPropertyName(body);
    }

    private _getFields(map: EntityMap<T, T[keyof T] | Partial<T>> | null): QueryField[] {

        if (map == null) {
            return [];
        }

        const stringified = map.toString();

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

        if (this.filters.length === 0) {
            return {
                ok: true,
                result: Expression.EMPTY
            }; // Select All
        }

        const expressions: Expression[] = [];

        for (let i = 0, length = this.filters.length; i < length; i++) {
            const filter = this.filters[i];
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

        this._compiledQuery = new Query(
            options,
            this.filters,
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

    protected bulkOperations() {

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
}   