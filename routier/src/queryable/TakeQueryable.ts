import { Filter, ParamsFilter, GenericFunction, QueryOrdering } from "routier-core";
import { SelectionQueryable } from "./SelectionQueryable";

// cannot skip or take here, this class is returned after a take
// and a skip cannot occur after a take
export class TakeQueryable<T extends {}, U> extends SelectionQueryable<T, U> {

    where(expression: Filter<T>): TakeQueryable<T, U>;
    where<P extends {}>(selector: ParamsFilter<T, P>, params: P): TakeQueryable<T, U>;
    where<P extends {} = never>(selector: ParamsFilter<T, P> | Filter<T>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        return this.create(TakeQueryable<T, U>);
    }

    map<R extends T[keyof T] | Partial<T>>(expression: GenericFunction<T, R>) {
        this.setMapQueryOption(expression);
        return this.create(TakeQueryable<R, U>);
    }

    sort(expression: GenericFunction<T, T[keyof T]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(TakeQueryable<T, U>);
    }

    sortDescending(expression: GenericFunction<T, T[keyof T]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(TakeQueryable<T, U>);
    }

    subscribe() {
        this.isSubScribed = true;
        return this.create(TakeQueryable<T, () => void>);
    }
}