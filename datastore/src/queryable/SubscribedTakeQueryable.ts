import { Filter, ParamsFilter } from "@routier/core/expressions";
import { SelectionQueryable } from "./SelectionQueryable";
import { GenericFunction } from "@routier/core/types";
import { QueryOrdering } from "@routier/core/plugins";

// cannot skip or take here, this class is returned after a take
// and a skip cannot occur after a take
export class SubscribedTakeQueryable<Root extends {}, Shape, U> extends SelectionQueryable<Root, Shape, U> {

    where(expression: Filter<Shape>): SubscribedTakeQueryable<Root, Shape, U>;
    where<P extends {}>(selector: ParamsFilter<Shape, P>, params: P): SubscribedTakeQueryable<Root, Shape, U>;
    where<P extends {} = never>(selector: ParamsFilter<Shape, P> | Filter<Shape>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        return this.create(SubscribedTakeQueryable<Root, Shape, U>);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<Shape, R>) {
        this.setMapQueryOption(expression);
        return this.create(SubscribedTakeQueryable<Root, R, U>);
    }

    sort(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(SubscribedTakeQueryable<Root, Shape, U>);
    }

    sortDescending(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(SubscribedTakeQueryable<Root, Shape, U>);
    }
}