import { Filter, ParamsFilter } from "@routier/core/expressions";
import { SelectionQueryableAsync } from "./SelectionQueryableAsync";
import { SubscribedTakeQueryable } from "./SubscribedTakeQueryable";
import { GenericFunction } from "@routier/core/types";
import { QueryOrdering } from "@routier/core/plugins";
import { CollectionDependencies } from "../collections/types";
import { SimpleContainer } from "../ioc/SimpleContainer";
import { InferType } from "@routier/core/schema";

export class TakeQueryableAsync<Root extends {}, Shape> extends SelectionQueryableAsync<Root, Shape> {

    constructor(container: SimpleContainer<CollectionDependencies<Root>>) {
        super(container);

        this.where = this.where.bind(this);
        this.map = this.map.bind(this);
        this.sort = this.sort.bind(this);
        this.sortDescending = this.sortDescending.bind(this);
        this.subscribe = this.subscribe.bind(this);
    }

    where(expression: Filter<InferType<Shape>>): TakeQueryableAsync<Root, Shape>;
    where<P extends {}>(selector: ParamsFilter<InferType<Shape>, P>, params: P): TakeQueryableAsync<Root, Shape>;
    where<P extends {} = never>(selector: ParamsFilter<InferType<Shape>, P> | Filter<InferType<Shape>>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        return this.create(TakeQueryableAsync<Root, Shape>);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<InferType<Shape>, R>) {
        this.setMapQueryOption(expression);
        return this.create(TakeQueryableAsync<Root, R>);
    }

    sort(expression: GenericFunction<InferType<Shape>, InferType<Shape>[keyof InferType<Shape>]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(TakeQueryableAsync<Root, Shape>);
    }

    sortDescending(expression: GenericFunction<InferType<Shape>, InferType<Shape>[keyof InferType<Shape>]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(TakeQueryableAsync<Root, Shape>);
    }

    subscribe() {
        this.request.isSubScribed = true;
        return this.create(SubscribedTakeQueryable<Root, Shape, () => void>);
    }
}