import { SelectionQueryableAsync } from "./SelectionQueryableAsync";
import { Queryable } from "./Queryable";
import { Filter, ParamsFilter } from "@routier/core/expressions";
import { GenericFunction } from "@routier/core/types";
import { QueryOrdering } from "@routier/core/plugins";
import { InferType } from "@routier/core/schema";
import { CollectionDependencies, JoinTarget, RequestContext } from "../collections/types";
import { JoinQueryable, JoinTuple } from "./JoinQueryable";

export class QueryableAsync<Root extends {}, Shape, TStore = unknown> extends SelectionQueryableAsync<Root, Shape> {

    constructor(dependencies: CollectionDependencies<Root>, request: RequestContext<Root>) {
        super(dependencies, request);

        this.where = this.where.bind(this);
        this.map = this.map.bind(this);
        this.skip = this.skip.bind(this);
        this.take = this.take.bind(this);
        this.sort = this.sort.bind(this);
        this.sortDescending = this.sortDescending.bind(this);
        this.subscribe = this.subscribe.bind(this);
    }

    where(expression: Filter<Shape>): QueryableAsync<Root, Shape, TStore>;
    where<P extends {}>(selector: ParamsFilter<Shape, P>, params: P): QueryableAsync<Root, Shape, TStore>;
    where<P extends {} = never>(selector: ParamsFilter<Shape, P> | Filter<Shape>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        // We don't need a params queryable.  Params are localized to the where clause and do not
        // matter to the rest of the query
        return this.create(QueryableAsync<Root, Shape, TStore>);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<Shape, R>) {
        this.setMapQueryOption(expression);
        return this.create(QueryableAsync<Root, R, TStore>);
    }

    skip(amount: number) {
        this.setSkipQueryOption(amount);
        return this.create(QueryableAsync<Root, Shape, TStore>);
    }

    take(amount: number) {
        this.setTakeQueryOption(amount);
        return this.create(QueryableAsync<Root, Shape, TStore>);
    }

    sort(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(QueryableAsync<Root, Shape, TStore>);
    }

    sortDescending(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(QueryableAsync<Root, Shape, TStore>);
    }

    /** The `count` rows nearest `vector` by cosine distance — see `Queryable.nearest`. */
    nearest(expression: GenericFunction<Shape, Shape[keyof Shape]>, vector: number[], count: number) {
        this.setNearestQueryOption(expression, vector, count);
        return this.create(QueryableAsync<Root, Shape, TStore>);
    }

    /**
     * Pairs each row with every matching row of `inner` — an inner equi-join. See
     * `QueryableExecutor.setJoinQueryOption`.
     */
    join<TInner extends {}, TKey extends string | number>(
        inner: JoinTarget<TStore, TInner>,
        outerKey: (outer: Shape) => TKey | null | undefined,
        innerKey: (inner: InferType<TInner>) => TKey | null | undefined
    ) {
        this.setJoinQueryOption("inner", inner, outerKey, innerKey);

        return new JoinQueryable<Root, JoinTuple<Shape, InferType<TInner>>>(this.dependencies, this.request);
    }

    /** Like `join`, but unmatched rows appear paired with `undefined`. */
    leftJoin<TInner extends {}, TKey extends string | number>(
        inner: JoinTarget<TStore, TInner>,
        outerKey: (outer: Shape) => TKey | null | undefined,
        innerKey: (inner: InferType<TInner>) => TKey | null | undefined
    ) {
        this.setJoinQueryOption("left", inner, outerKey, innerKey);

        return new JoinQueryable<Root, JoinTuple<Shape, InferType<TInner> | undefined>>(this.dependencies, this.request);
    }

    // does not allow for async functions due to the subscription
    subscribe() {
        this.request.isSubScribed = true;
        return this.create(Queryable<Root, Shape, () => void>);
    }
}
