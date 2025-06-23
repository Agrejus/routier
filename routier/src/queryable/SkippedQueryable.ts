import { Filter, ParamsFilter, GenericFunction, QueryOrdering } from "routier-core";
import { TakeQueryable } from "./TakeQueryable";
import { SelectionQueryable } from "./SelectionQueryable";

// Cannot perform another skip
export class SkippedQueryable<T extends {}, TResult, U> extends SelectionQueryable<T, TResult, U> {

    where(expression: Filter<T>): SkippedQueryable<T, TResult, U>;
    where<P extends {}>(selector: ParamsFilter<T, P>, params: P): SkippedQueryable<T, TResult, U>;
    where<P extends {} = never>(selector: ParamsFilter<T, P> | Filter<T>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        return this.create(SkippedQueryable<T, TResult, U>);
    }

    map<R extends T[keyof T] | Partial<T>>(expression: GenericFunction<T, R>) {
        this.setMapQueryOption(expression);
        return this.create(SkippedQueryable<T, R, U>);
    }

    // cannot to a skip after a take
    take(amount: number) {
        this.setTakeQueryOption(amount);
        return this.create(TakeQueryable<T, TResult, U>);
    }

    sort(expression: GenericFunction<T, T[keyof T]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(SkippedQueryable<T, TResult, U>);
    }

    sortDescending(expression: GenericFunction<T, T[keyof T]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(SkippedQueryable<T, TResult, U>);
    }

    subscribe() {
        this.isSubScribed = true;
        return this.create(SkippedQueryable<T, TResult, () => void>);
    }
}