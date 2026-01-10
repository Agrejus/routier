import { Filter, ParamsFilter } from "@routier/core/expressions";
import { GenericFunction } from "@routier/core/types";
import { QueryOrdering } from "@routier/core/plugins";
import { QueryableBuilder } from "./QueryableBuilder";
import { ComposerDependencies, RequestContext } from "../../collections/types";
import { SubscribedSkippedQueryableComposer } from "./SubscribedSkippedQueryableComposer";
import { SubscribedTakeQueryableComposer } from "./SubscribedTakeQueryableComposer";

export class SubscribedQueryableComposer<Root extends {}, Shape, U> extends QueryableBuilder<Root, Shape, U> {

    constructor(dependencies: ComposerDependencies<Root>, request: RequestContext<Root>) {
        super(dependencies, request);

        this.where = this.where.bind(this);
        this.map = this.map.bind(this);
        this.take = this.take.bind(this);
        this.sort = this.sort.bind(this);
        this.sortDescending = this.sortDescending.bind(this);
    }

    where(expression: Filter<Shape>): SubscribedQueryableComposer<Root, Shape, U>;
    where<P extends {}>(selector: ParamsFilter<Shape, P>, params: P): SubscribedQueryableComposer<Root, Shape, U>;
    where<P extends {} = never>(selector: ParamsFilter<Shape, P> | Filter<Shape>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        // We don't need a params queryable.  Params are localized to the where clause and do not
        // matter to the rest of the query
        return this.create(SubscribedQueryableComposer<Root, Shape, U>);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<Shape, R>) {

        this.setMapQueryOption(expression);
        return this.create(SubscribedQueryableComposer<Root, R, U>);
    }

    skip(amount: number) {
        this.setSkipQueryOption(amount);
        return this.create(SubscribedSkippedQueryableComposer<Root, Shape, U>);
    }

    // cannot to a skip after a take
    take(amount: number) {
        this.setTakeQueryOption(amount);
        return this.create(SubscribedTakeQueryableComposer<Root, Shape, U>);
    }

    sort(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(SubscribedQueryableComposer<Root, Shape, U>);
    }

    sortDescending(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(SubscribedQueryableComposer<Root, Shape, U>);
    }
}
