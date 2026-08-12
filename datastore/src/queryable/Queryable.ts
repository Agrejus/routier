import { SelectionQueryable } from "./SelectionQueryable";
import { Filter, ParamsFilter } from "@routier/core/expressions";
import { GenericFunction } from "@routier/core/types";
import { QueryOrdering } from "@routier/core/plugins";
import { SubscribedQueryable } from './SubscribedQueryable';
import { CollectionDependencies, JoinTarget, RequestContext } from "../collections/types";
import { CompiledSchema, InferType } from "@routier/core/schema";
import { QueryableComposer } from "./composers/QueryableComposer";
import { JoinQueryable, JoinTuple } from "./JoinQueryable";

export class Queryable<Root extends {}, Shape, U, TStore = unknown> extends SelectionQueryable<Root, Shape, U> {

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

    static compose<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        return new QueryableComposer<TEntity, InferType<TEntity>, void>({
            schema
        }, new RequestContext<TEntity>());
    }

    where(expression: Filter<Shape>): Queryable<Root, Shape, U, TStore>;
    where<P extends {}>(selector: ParamsFilter<Shape, P>, params: P): Queryable<Root, Shape, U, TStore>;
    where<P extends {} = never>(selector: ParamsFilter<Shape, P> | Filter<Shape>, params?: P) {
        this.setFiltersQueryOption(selector, params);
        // We don't need a params queryable.  Params are localized to the where clause and do not
        // matter to the rest of the query
        return this.create(Queryable<Root, Shape, U, TStore>);
    }

    map<R extends Shape[keyof Shape] | Partial<Shape>>(expression: GenericFunction<Shape, R>) {

        this.setMapQueryOption(expression);
        return this.create(Queryable<Root, R, U, TStore>);
    }

    skip(amount: number) {
        this.setSkipQueryOption(amount);
        return this.create(Queryable<Root, Shape, U, TStore>);
    }

    take(amount: number) {
        this.setTakeQueryOption(amount);
        return this.create(Queryable<Root, Shape, U, TStore>);
    }

    sort(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Ascending);
        return this.create(Queryable<Root, Shape, U, TStore>);
    }

    sortDescending(expression: GenericFunction<Shape, Shape[keyof Shape]>) {
        this.setSortQueryOption(expression, QueryOrdering.Descending);
        return this.create(Queryable<Root, Shape, U, TStore>);
    }

    /**
     * The `count` rows whose vector is most similar to `vector`, nearest first.
     *
     * An ordering and a limit, not a filter — it returns the closest rows rather than the
     * matching ones, so it is always worth pairing with `.where()` when the search should be
     * scoped. Similarity is cosine distance, and the distance itself is not returned.
     *
     * Works on every backend. One with a native vector index does the search there; the rest
     * read the rows this query selects and score them in memory, which returns the same
     * answer over more data — so a `.where()` in front of it is a real saving, not a
     * formality.
     */
    nearest(expression: GenericFunction<Shape, Shape[keyof Shape]>, vector: number[], count: number) {
        this.setNearestQueryOption(expression, vector, count);
        return this.create(Queryable<Root, Shape, U, TStore>);
    }

    /**
     * Pairs each row with every matching row of `inner` — an inner equi-join. See
     * `QueryableExecutor.setJoinQueryOption`.
     *
     * Subscriptions do not survive a join (v1): a join subscription has to listen to both
     * schemas, and `DataBridge.subscribe` is single-schema. The returned queryable has no
     * `subscribe`.
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

    subscribe() {
        this.request.isSubScribed = true;
        return this.create(SubscribedQueryable<Root, Shape, () => void>);
    }
}
