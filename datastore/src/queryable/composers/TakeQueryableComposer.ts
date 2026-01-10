import { Filter, ParamsFilter } from "@routier/core/expressions";
import { GenericFunction } from "@routier/core/types";
import { QueryOrdering } from "@routier/core/plugins";
import { QueryableBuilder } from "./QueryableBuilder";
import { ComposerDependencies, RequestContext } from "../../collections/types";
import { SubscribedTakeQueryableComposer } from "./SubscribedTakeQueryableComposer";

export class TakeQueryableComposer<Root extends {}, Shape, U> extends QueryableBuilder<Root, Shape, U> {

    constructor(dependencies: ComposerDependencies<Root>, request: RequestContext<Root>) {
        super(dependencies, request);

        this.where = this.where.bind(this);
        this.map = this.map.bind(this);
        this.sort = this.sort.bind(this);
        this.sortDescending = this.sortDescending.bind(this);
        this.subscribe = this.subscribe.bind(this);
    }

    where(expression: Filter<Shape>): TakeQueryableComposer<Root, Shape, U>;
    where<P extends {}>(selector: ParamsFilter<Shape, P>, params: P): TakeQueryableComposer<Root, Shape, U>;
    where<P extends {} = never>(selector: ParamsFilter<Shape, P> | Filter<Shape>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        return this.create(TakeQueryableComposer<Root, Shape, U>);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<Shape, R>) {
        this.setMapQueryOption(expression);
        return this.create(TakeQueryableComposer<Root, R, U>);
    }

    sort(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(TakeQueryableComposer<Root, Shape, U>);
    }

    sortDescending(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(TakeQueryableComposer<Root, Shape, U>);
    }

    subscribe() {
        this.request.isSubScribed = true;
        return this.create(SubscribedTakeQueryableComposer<Root, Shape, () => void>);
    }
}