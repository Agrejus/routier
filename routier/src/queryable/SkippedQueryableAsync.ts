import { Filter, ParamsFilter, GenericFunction, QueryOrdering } from "routier-core";
import { SelectionQueryableAsync } from "./SelectionQueryableAsync";
import { SkippedQueryable } from "./SkippedQueryable";
import { TakeQueryableAsync } from "./TakeQueryableAsync";

export class SkippedQueryableAsync<T extends {}, U> extends SelectionQueryableAsync<T, U> {

    where(expression: Filter<T>): SkippedQueryableAsync<T, U>;
    where<P extends {}>(selector: ParamsFilter<T, P>, params: P): SkippedQueryableAsync<T, U>;
    where<P extends {} = never>(selector: ParamsFilter<T, P> | Filter<T>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        return this.create(SkippedQueryableAsync<T, U>);
    }

    map<R extends T[keyof T] | Partial<T>>(expression: GenericFunction<T, R>) {
        this.setMapQueryOption(expression);
        return this.create(SkippedQueryableAsync<R, U>);
    }

    // cannot to a skip after a take
    take(amount: number) {
        this.setTakeQueryOption(amount);
        return this.create(TakeQueryableAsync<T, U>);
    }

    sort(expression: GenericFunction<T, T[keyof T]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(SkippedQueryableAsync<T, U>);
    }

    sortDescending(expression: GenericFunction<T, T[keyof T]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(SkippedQueryableAsync<T, U>);
    }

    subscribe() {
        this.isSubScribed = true;
        return this.create(SkippedQueryable<T, () => void>);
    }
}