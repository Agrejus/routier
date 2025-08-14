import { TakeQueryable } from "./TakeQueryable";
import { SkippedQueryable } from "./SkippedQueryable";
import { SelectionQueryable } from "./SelectionQueryable";
import { Filter, ParamsFilter } from "routier-core/expressions";
import { GenericFunction } from "routier-core/types";
import { QueryOrdering } from "routier-core/plugins";

export class Queryable<Root extends {}, Shape, U> extends SelectionQueryable<Root, Shape, U> {

    where(expression: Filter<Shape>): Queryable<Root, Shape, U>;
    where<P extends {}>(selector: ParamsFilter<Shape, P>, params: P): Queryable<Root, Shape, U>;
    where<P extends {} = never>(selector: ParamsFilter<Shape, P> | Filter<Shape>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        // We don't need a params queryable.  Params are localized to the where clause and do not
        // matter to the rest of the query
        return this.create(Queryable<Root, Shape, U>);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<Shape, R>) {

        this.setMapQueryOption(expression);
        return this.create(Queryable<Root, R, U>);
    }

    skip(amount: number) {
        this.setSkipQueryOption(amount);
        return this.create(SkippedQueryable<Root, Shape, U>);
    }

    // cannot to a skip after a take
    take(amount: number) {
        this.setTakeQueryOption(amount);
        return this.create(TakeQueryable<Root, Shape, U>);
    }

    sort(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(Queryable<Root, Shape, U>);
    }

    sortDescending(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(Queryable<Root, Shape, U>);
    }

    subscribe() {
        this.isSubScribed = true;
        return this.create(Queryable<Root, Shape, () => void>);
    }
}
