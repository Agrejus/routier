import { Filter, ParamsFilter, GenericFunction, QueryOrdering } from "routier-core";
import { SelectionQueryableAsync } from "./SelectionQueryableAsync";
import { TakeQueryable } from "./TakeQueryable";

// cannot skip or take here, this class is returned after a take
// and a skip cannot occur after a take
export class TakeQueryableAsync<Root extends {}, Shape> extends SelectionQueryableAsync<Root, Shape> {

    where(expression: Filter<Shape>): TakeQueryableAsync<Root, Shape>;
    where<P extends {}>(selector: ParamsFilter<Shape, P>, params: P): TakeQueryableAsync<Root, Shape>;
    where<P extends {} = never>(selector: ParamsFilter<Shape, P> | Filter<Shape>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        return this.create(TakeQueryableAsync<Root, Shape>);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<Shape, R>) {
        this.setMapQueryOption(expression);
        return this.create(TakeQueryableAsync<Root, R>);
    }

    sort(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(TakeQueryableAsync<Root, Shape>);
    }

    sortDescending(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(TakeQueryableAsync<Root, Shape>);
    }

    subscribe() {
        this.isSubScribed = true;
        return this.create(TakeQueryable<Root, Shape, () => void>);
    }
}