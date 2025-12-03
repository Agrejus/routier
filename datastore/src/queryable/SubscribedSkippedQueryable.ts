import { SelectionQueryable } from "./SelectionQueryable";
import { Filter, ParamsFilter } from "@routier/core/expressions";
import { GenericFunction } from "@routier/core/types";
import { QueryOrdering } from "@routier/core/plugins";
import { SubscribedTakeQueryable } from "./SubscribedTakeQueryable";
import { CollectionDependencies } from "../collections/types";
import { SimpleContainer } from "../ioc/SimpleContainer";
import { InferType } from "@routier/core/schema";

export class SubscribedSkippedQueryable<Root extends {}, Shape, U> extends SelectionQueryable<Root, Shape, U> {

    constructor(container: SimpleContainer<CollectionDependencies<Root>>) {
        super(container);

        this.where = this.where.bind(this);
        this.map = this.map.bind(this);
        this.take = this.take.bind(this);
        this.sort = this.sort.bind(this);
        this.sortDescending = this.sortDescending.bind(this);
    }

    where(expression: Filter<InferType<Shape>>): SubscribedSkippedQueryable<Root, Shape, U>;
    where<P extends {}>(selector: ParamsFilter<InferType<Shape>, P>, params: P): SubscribedSkippedQueryable<Root, Shape, U>;
    where<P extends {} = never>(selector: ParamsFilter<InferType<Shape>, P> | Filter<InferType<Shape>>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        return this.create(SubscribedSkippedQueryable<Root, Shape, U>);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<InferType<Shape>, R>) {
        this.setMapQueryOption(expression);
        return this.create(SubscribedSkippedQueryable<Root, R, U>);
    }

    take(amount: number) {
        this.setTakeQueryOption(amount);
        return this.create(SubscribedTakeQueryable<Root, Shape, U>);
    }

    sort(expression: GenericFunction<InferType<Shape>, InferType<Shape>[keyof InferType<Shape>]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(SubscribedSkippedQueryable<Root, Shape, U>);
    }

    sortDescending(expression: GenericFunction<InferType<Shape>, InferType<Shape>[keyof InferType<Shape>]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(SubscribedSkippedQueryable<Root, Shape, U>);
    }
}