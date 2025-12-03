import { Filter, ParamsFilter } from "@routier/core/expressions";
import { SelectionQueryable } from "./SelectionQueryable";
import { GenericFunction } from "@routier/core/types";
import { QueryOrdering } from "@routier/core/plugins";
import { CollectionDependencies } from "../collections/types";
import { SimpleContainer } from "../ioc/SimpleContainer";
import { InferType } from "@routier/core/schema";

export class SubscribedTakeQueryable<Root extends {}, Shape, U> extends SelectionQueryable<Root, Shape, U> {

    constructor(container: SimpleContainer<CollectionDependencies<Root>>) {
        super(container);

        this.where = this.where.bind(this);
        this.map = this.map.bind(this);
        this.sort = this.sort.bind(this);
        this.sortDescending = this.sortDescending.bind(this);
    }

    where(expression: Filter<InferType<Shape>>): SubscribedTakeQueryable<Root, Shape, U>;
    where<P extends {}>(selector: ParamsFilter<InferType<Shape>, P>, params: P): SubscribedTakeQueryable<Root, Shape, U>;
    where<P extends {} = never>(selector: ParamsFilter<InferType<Shape>, P> | Filter<InferType<Shape>>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        return this.create(SubscribedTakeQueryable<Root, Shape, U>);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<Shape, R>) {
        this.setMapQueryOption(expression);
        return this.create(SubscribedTakeQueryable<Root, R, U>);
    }

    sort(expression: GenericFunction<InferType<Shape>, InferType<Shape>[keyof InferType<Shape>]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(SubscribedTakeQueryable<Root, Shape, U>);
    }

    sortDescending(expression: GenericFunction<InferType<Shape>, InferType<Shape>[keyof InferType<Shape>]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(SubscribedTakeQueryable<Root, Shape, U>);
    }
}