import { Filter, GenericFunction, ParamsFilter, QueryOrdering } from "routier-core";
import { TakeQueryable } from "./TakeQueryable";
import { SkippedQueryable } from "./SkippedQueryable";
import { SelectionQueryable } from "./SelectionQueryable";

export class Queryable<T extends {}, U> extends SelectionQueryable<T, U> {

    where(expression: Filter<T>): Queryable<T, U>;
    where<P extends {}>(selector: ParamsFilter<T, P>, params: P): Queryable<T, U>;
    where<P extends {} = never>(selector: ParamsFilter<T, P> | Filter<T>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        // We don't need a params queryable.  Params are localized to the where clause and do not
        // matter to the rest of the query
        return this.create(Queryable<T, U>);
    }

    map<R extends T[keyof T] | Partial<T>>(expression: GenericFunction<T, R>) {

        this.setMapQueryOption(expression);
        return this.create(Queryable<R, U>);
    }

    skip(amount: number) {
        this.setSkipQueryOption(amount);
        return this.create(SkippedQueryable<T, U>);
    }

    // cannot to a skip after a take
    take(amount: number) {
        this.setTakeQueryOption(amount);
        return this.create(TakeQueryable<T, U>);
    }

    sort(expression: GenericFunction<T, T[keyof T]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(Queryable<T, U>);
    }

    sortDescending(expression: GenericFunction<T, T[keyof T]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(Queryable<T, U>);
    }

    subscribe() {
        this.isSubScribed = true;
        return this.create(Queryable<T, () => void>);
    }
}
