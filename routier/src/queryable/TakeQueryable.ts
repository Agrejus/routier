import { Filter, ParamsFilter, GenericFunction, QueryOrdering } from "routier-core";
import { SelectionQueryable } from "./SelectionQueryable";

// cannot skip or take here, this class is returned after a take
// and a skip cannot occur after a take
export class TakeQueryable<T extends {}, TResult, U> extends SelectionQueryable<T, TResult, U> {

    where(expression: Filter<T>): TakeQueryable<T, TResult, U>;
    where<P extends {}>(selector: ParamsFilter<T, P>, params: P): TakeQueryable<T, TResult, U>;
    where<P extends {} = never>(selector: ParamsFilter<T, P> | Filter<T>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        return this.create(TakeQueryable<T, TResult, U>);
    }

    map<R extends T[keyof T] | Partial<T>>(expression: GenericFunction<T, R>) {
        this.setMapQueryOption(expression);
        return this.create(TakeQueryable<T, R, U>);
    }

    sort(expression: GenericFunction<T, T[keyof T]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(TakeQueryable<T, TResult, U>);
    }

    sortDescending(expression: GenericFunction<T, T[keyof T]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(TakeQueryable<T, TResult, U>);
    }

    subscribe() {
        this.isSubScribed = true;
        return this.create(TakeQueryable<T, TResult, () => void>);
    }
}