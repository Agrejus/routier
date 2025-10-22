import { TakeQueryable } from "./TakeQueryable";
import { SelectionQueryable } from "./SelectionQueryable";
import { Filter, ParamsFilter } from "@routier/core/expressions";
import { GenericFunction } from "@routier/core/types";
import { QueryOptionsCollection, QueryOrdering } from "@routier/core/plugins";
import { SubscribedSkippedQueryable } from "./SubscribedSkippedQueryable";
import { ChangeTrackingType, CompiledSchema } from "@routier/core/schema";
import { SchemaCollection } from "@routier/core/collections";
import { QuerySource } from "./QuerySource";
import { DataBridge } from "../data-access/DataBridge";
import { ChangeTracker } from "../change-tracking/ChangeTracker";

export class SkippedQueryable<Root extends {}, Shape, U> extends SelectionQueryable<Root, Shape, U> {

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
        this.take = this.take.bind(this);
        this.sort = this.sort.bind(this);
        this.sortDescending = this.sortDescending.bind(this);
        this.subscribe = this.subscribe.bind(this);
    }

    where(expression: Filter<Shape>): SkippedQueryable<Root, Shape, U>;
    where<P extends {}>(selector: ParamsFilter<Shape, P>, params: P): SkippedQueryable<Root, Shape, U>;
    where<P extends {} = never>(selector: ParamsFilter<Shape, P> | Filter<Shape>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        return this.create(SkippedQueryable<Root, Shape, U>);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<Shape, R>) {
        this.setMapQueryOption(expression);
        return this.create(SkippedQueryable<Root, R, U>);
    }

    take(amount: number) {
        this.setTakeQueryOption(amount);
        return this.create(TakeQueryable<Root, Shape, U>);
    }

    sort(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(SkippedQueryable<Root, Shape, U>);
    }

    sortDescending(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(SkippedQueryable<Root, Shape, U>);
    }

    subscribe() {
        this.isSubScribed = true;
        return this.create(SubscribedSkippedQueryable<Root, Shape, () => void>);
    }
}