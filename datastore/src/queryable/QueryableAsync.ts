import { SelectionQueryableAsync } from "./SelectionQueryableAsync";
import { Queryable } from "./Queryable";
import { SkippedQueryableAsync } from "./SkippedQueryableAsync";
import { TakeQueryableAsync } from "./TakeQueryableAsync";
import { Filter, ParamsFilter } from "@routier/core/expressions";
import { GenericFunction } from "@routier/core/types";
import { QueryOptionsCollection, QueryOrdering } from "@routier/core/plugins";
import { ChangeTrackingType, CompiledSchema } from "@routier/core/schema";
import { SchemaCollection } from "@routier/core/collections";
import { QuerySource } from "./QuerySource";
import { DataBridge } from "../data-access/DataBridge";
import { ChangeTracker } from "../change-tracking/ChangeTracker";

export class QueryableAsync<Root extends {}, Shape> extends SelectionQueryableAsync<Root, Shape> {

    constructor(
        schema: CompiledSchema<Root>,
        schemas: SchemaCollection,
        scopedQueryOptions: QueryOptionsCollection<Root>,
        changeTrackingType: ChangeTrackingType,
        options: {
            queryable?: QuerySource<Root, Shape>,
            dataBridge?: DataBridge<Root>,
            changeTracker?: ChangeTracker<Root>
        }) {
        super(schema, schemas, scopedQueryOptions, changeTrackingType, options);

        this.where = this.where.bind(this);
        this.map = this.map.bind(this);
        this.skip = this.skip.bind(this);
        this.take = this.take.bind(this);
        this.sort = this.sort.bind(this);
        this.sortDescending = this.sortDescending.bind(this);
        this.subscribe = this.subscribe.bind(this);
    }

    where(expression: Filter<Shape>): QueryableAsync<Root, Shape>;
    where<P extends {}>(selector: ParamsFilter<Shape, P>, params: P): QueryableAsync<Root, Shape>;
    where<P extends {} = never>(selector: ParamsFilter<Shape, P> | Filter<Shape>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        // We don't need a params queryable.  Params are localized to the where clause and do not
        // matter to the rest of the query
        return this.create(QueryableAsync<Root, Shape>);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<Shape, R>) {

        this.setMapQueryOption(expression);
        return this.create(QueryableAsync<Root, R>);
    }

    skip(amount: number) {
        this.setSkipQueryOption(amount);
        return this.create(SkippedQueryableAsync<Root, Shape>);
    }

    take(amount: number) {
        this.setTakeQueryOption(amount);
        return this.create(TakeQueryableAsync<Root, Shape>);
    }

    sort(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(QueryableAsync<Root, Shape>);
    }

    sortDescending(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(QueryableAsync<Root, Shape>);
    }

    // does not allow for async functions due to the subscription
    subscribe() {
        this.isSubScribed = true;
        return this.create(Queryable<Root, Shape, () => void>);
    }
}
