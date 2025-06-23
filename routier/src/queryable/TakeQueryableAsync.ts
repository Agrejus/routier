import { Filter, ParamsFilter, GenericFunction, QueryOrdering } from "routier-core";
import { SelectionQueryableAsync } from "./SelectionQueryableAsync";
import { TakeQueryable } from "./TakeQueryable";

// cannot skip or take here, this class is returned after a take
// and a skip cannot occur after a take
export class TakeQueryableAsync<T extends {}, TResult> extends SelectionQueryableAsync<T, TResult> {

    where(expression: Filter<T>): TakeQueryableAsync<T, TResult>;
    where<P extends {}>(selector: ParamsFilter<T, P>, params: P): TakeQueryableAsync<T, TResult>;
    where<P extends {} = never>(selector: ParamsFilter<T, P> | Filter<T>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        return this.create(TakeQueryableAsync<T, TResult>);
    }

    map<R extends T[keyof T] | Partial<T>>(expression: GenericFunction<T, R>) {
        this.setMapQueryOption(expression);
        return this.create(TakeQueryableAsync<T, R>);
    }

    sort(expression: GenericFunction<T, T[keyof T]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(TakeQueryableAsync<T, TResult>);
    }

    sortDescending(expression: GenericFunction<T, T[keyof T]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(TakeQueryableAsync<T, TResult>);
    }

    subscribe() {
        this.isSubScribed = true;
        return this.create(TakeQueryable<T, TResult, () => void>);
    }
}