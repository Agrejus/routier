import { TakeQueryable } from "./TakeQueryable";
import { SelectionQueryable } from "./SelectionQueryable";
import { Filter, ParamsFilter } from "@routier/core/expressions";
import { GenericFunction } from "@routier/core/types";
import { QueryOrdering } from "@routier/core/plugins";

// Cannot perform another skip
export class SkippedQueryable<Root extends {}, Shape, U> extends SelectionQueryable<Root, Shape, U> {

    where(expression: Filter<Shape>): SkippedQueryable<Root, Shape, U>;
    where<P extends {}>(selector: ParamsFilter<Shape, P>, params: P): SkippedQueryable<Root, Shape, U>;
    where<P extends {} = never>(selector: ParamsFilter<Shape, P> | Filter<Shape>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        return this.create(SkippedQueryable<Root, Shape, U>);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<Shape, R>) {
        this.setMapQueryOption(expression);
        return this.create(SkippedQueryable<Root, R, U>);
    }

    // cannot to a skip after a take
    take(amount: number) {
        this.setTakeQueryOption(amount);
        return this.create(TakeQueryable<Root, Shape, U>);
    }

    sort(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(SkippedQueryable<Root, Shape, U>);
    }

    sortDescending(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(SkippedQueryable<Root, Shape, U>);
    }

    subscribe() {
        this.isSubScribed = true;
        return this.create(SkippedQueryable<Root, Shape, () => void>);
    }
}