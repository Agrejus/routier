import { Filter, ParamsFilter } from "@routier/core/expressions";
import { SelectionQueryable } from "./SelectionQueryable";
import { GenericFunction } from "@routier/core/types";
import { QueryOptionsCollection, QueryOrdering } from "@routier/core/plugins";
import { SubscribedTakeQueryable } from "./SubscribedTakeQueryable";
import { ChangeTrackingType, CompiledSchema } from "@routier/core/schema";
import { SchemaCollection } from "@routier/core/collections";
import { QuerySource } from "./QuerySource";
import { DataBridge } from "../data-access/DataBridge";
import { ChangeTracker } from "../change-tracking/ChangeTracker";

export class TakeQueryable<Root extends {}, Shape, U> extends SelectionQueryable<Root, Shape, U> {

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
        this.sort = this.sort.bind(this);
        this.sortDescending = this.sortDescending.bind(this);
        this.subscribe = this.subscribe.bind(this);
    }

    where(expression: Filter<Shape>): TakeQueryable<Root, Shape, U>;
    where<P extends {}>(selector: ParamsFilter<Shape, P>, params: P): TakeQueryable<Root, Shape, U>;
    where<P extends {} = never>(selector: ParamsFilter<Shape, P> | Filter<Shape>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        return this.create(TakeQueryable<Root, Shape, U>);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<Shape, R>) {
        this.setMapQueryOption(expression);
        return this.create(TakeQueryable<Root, R, U>);
    }

    sort(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(TakeQueryable<Root, Shape, U>);
    }

    sortDescending(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(TakeQueryable<Root, Shape, U>);
    }

    subscribe() {
        this.isSubScribed = true;
        return this.create(SubscribedTakeQueryable<Root, Shape, () => void>);
    }
}