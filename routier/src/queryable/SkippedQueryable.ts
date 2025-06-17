import { Filter, ParamsFilter, GenericFunction, QueryOrdering } from "routier-core";
import { TakeQueryable } from "./TakeQueryable";
import { SelectionQueryable } from "./SelectionQueryable";

// Cannot perform another skip
export class SkippedQueryable<T extends {}, U> extends SelectionQueryable<T, U> {

    where(expression: Filter<T>): SkippedQueryable<T, U>;
    where<P extends {}>(selector: ParamsFilter<T, P>, params: P): SkippedQueryable<T, U>;
    where<P extends {} = never>(selector: ParamsFilter<T, P> | Filter<T>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        return this.create(SkippedQueryable<T, U>);
    }

    map<R extends T[keyof T] | Partial<T>>(expression: GenericFunction<T, R>) {
        this.setMapQueryOption(expression);
        return this.create(SkippedQueryable<R, U>);
    }

    // cannot to a skip after a take
    take(amount: number) {
        this.setTakeQueryOption(amount);
        return this.create(TakeQueryable<T, U>);
    }

    sort(expression: GenericFunction<T, T[keyof T]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(SkippedQueryable<T, U>);
    }

    sortDescending(expression: GenericFunction<T, T[keyof T]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(SkippedQueryable<T, U>);
    }

    subscribe() {
        this.isSubScribed = true;
        return this.create(SkippedQueryable<T, () => void>);
    }
}