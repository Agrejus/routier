import { Filter, ParamsFilter } from "routier-core/expressions";
import { SelectionQueryableAsync } from "./SelectionQueryableAsync";
import { SkippedQueryable } from "./SkippedQueryable";
import { TakeQueryableAsync } from "./TakeQueryableAsync";
import { GenericFunction } from "routier-core/types";
import { QueryOrdering } from "routier-core/plugins";

export class SkippedQueryableAsync<Root extends {}, Shape> extends SelectionQueryableAsync<Root, Shape> {

    where(expression: Filter<Shape>): SkippedQueryableAsync<Root, Shape>;
    where<P extends {}>(selector: ParamsFilter<Shape, P>, params: P): SkippedQueryableAsync<Root, Shape>;
    where<P extends {} = never>(selector: ParamsFilter<Shape, P> | Filter<Shape>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        return this.create(SkippedQueryableAsync<Root, Shape>);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<Shape, R>) {
        this.setMapQueryOption(expression);
        return this.create(SkippedQueryableAsync<Root, R>);
    }

    // cannot to a skip after a take
    take(amount: number) {
        this.setTakeQueryOption(amount);
        return this.create(TakeQueryableAsync<Root, Shape>);
    }

    sort(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(SkippedQueryableAsync<Root, Shape>);
    }

    sortDescending(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(SkippedQueryableAsync<Root, Shape>);
    }

    subscribe() {
        this.isSubScribed = true;
        return this.create(SkippedQueryable<Root, Shape, () => void>);
    }
}