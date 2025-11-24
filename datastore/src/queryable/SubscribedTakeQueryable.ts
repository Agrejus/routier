import { Filter, ParamsFilter } from "@routier/core/expressions";
import { SelectionQueryable } from "./SelectionQueryable";
import { GenericFunction } from "@routier/core/types";
import { QueryOrdering } from "@routier/core/plugins";
import { QueryableContainer } from "./IoC/QueryableContainer";

export class SubscribedTakeQueryable<Root extends {}, Shape, U> extends SelectionQueryable<Root, Shape, U> {

    constructor(container: QueryableContainer<Root>) {
        super(container);

        this.where = this.where.bind(this);
        this.map = this.map.bind(this);
        this.sort = this.sort.bind(this);
        this.sortDescending = this.sortDescending.bind(this);
    }

    where(expression: Filter<Shape>): SubscribedTakeQueryable<Root, Shape, U>;
    where<P extends {}>(selector: ParamsFilter<Shape, P>, params: P): SubscribedTakeQueryable<Root, Shape, U>;
    where<P extends {} = never>(selector: ParamsFilter<Shape, P> | Filter<Shape>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        return new SubscribedTakeQueryable<Root, Shape, U>(this.container);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<Shape, R>) {
        this.setMapQueryOption(expression);
        return new SubscribedTakeQueryable<Root, R, U>(this.container);
    }

    sort(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return new SubscribedTakeQueryable<Root, Shape, U>(this.container);
    }

    sortDescending(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return new SubscribedTakeQueryable<Root, Shape, U>(this.container);
    }
}