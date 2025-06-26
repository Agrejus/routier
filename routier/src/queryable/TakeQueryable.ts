import { Filter, ParamsFilter, GenericFunction, QueryOrdering } from "routier-core";
import { SelectionQueryable } from "./SelectionQueryable";

// cannot skip or take here, this class is returned after a take
// and a skip cannot occur after a take
export class TakeQueryable<Root extends {}, Shape, U> extends SelectionQueryable<Root, Shape, U> {

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
        return this.create(TakeQueryable<Root, Shape, () => void>);
    }
}