import { QueryOrdering } from "@routier/core/plugins";
import { Expression, Filter, ParamsFilter } from "@routier/core/expressions";
import { GenericFunction } from "@routier/core/types";
import { CallbackResult, Result, toPromise } from "@routier/core/results";
import { CollectionDependencies, RequestContext } from "../collections/types";
import { Explainable } from "./explained";
import { QueryableExecutor } from "./QueryableExecutor";

/**
 * A query over JOINED TUPLES.
 *
 * A typed API surface and nothing more: every method records an option into the same
 * `QueryOptionsCollection` an unjoined query uses, and execution goes through the same path.
 * There is no separate join executor.
 *
 * **What is missing is missing on purpose.** `sum`/`min`/`max`/`distinct`, `toGroup`,
 * `subscribe` and `remove` are absent from this type rather than throwing at runtime:
 *
 *  - the aggregates need one mapped numeric field, which a tuple is not — project with `.map()`
 *    first and they are available on the projection;
 *  - a join subscription would have to listen to BOTH schemas and re-run, and
 *    `DataBridge.subscribe` is single-schema;
 *  - a tuple is not a row, so there is nothing to remove.
 *
 * `Shape` is the tuple — `[outer, inner]`, or `[outer, inner | undefined]` after `leftJoin` —
 * until `.map()` replaces it with a projection.
 */
export type JoinTuple<TOuter, TInner> = [TOuter, TInner];

export class JoinQueryable<TOuter extends {}, Shape, E extends boolean = false> extends QueryableExecutor<TOuter, Shape> {

    constructor(dependencies: CollectionDependencies<TOuter>, request: RequestContext<TOuter>) {
        super(dependencies, request);

        this.where = this.where.bind(this);
        this.map = this.map.bind(this);
        this.sort = this.sort.bind(this);
        this.sortDescending = this.sortDescending.bind(this);
        this.skip = this.skip.bind(this);
        this.take = this.take.bind(this);
        this.toArray = this.toArray.bind(this);
        this.toArrayAsync = this.toArrayAsync.bind(this);
        this.first = this.first.bind(this);
        this.firstAsync = this.firstAsync.bind(this);
        this.firstOrUndefined = this.firstOrUndefined.bind(this);
        this.firstOrUndefinedAsync = this.firstOrUndefinedAsync.bind(this);
        this.count = this.count.bind(this);
        this.countAsync = this.countAsync.bind(this);
    }

    /**
     * Filters the pairs.
     *
     * Runs AFTER the join, over the tuples, so a condition spanning both sides
     * (`([p, m]) => p.rank > m.rank`) is expressible here and nowhere else. Correct on every
     * backend; accelerated only where the query builder can split a single-side conjunct off and
     * push it down.
     */
    where(expression: Filter<Shape>): JoinQueryable<TOuter, Shape, E>;
    where<P extends {}>(selector: ParamsFilter<Shape, P>, params: P): JoinQueryable<TOuter, Shape, E>;
    where<P extends {} = never>(selector: ParamsFilter<Shape, P> | Filter<Shape>, params?: P) {
        // Recorded as NOT PARSABLE rather than parsed, and this is a correctness point, not a
        // shortcut. `([p, m]) => ...` is indistinguishable from a params filter's
        // `([entity, params]) => ...`, so the parser would happily build a tree reading `p` as
        // the outer entity and `m` as a params bag — a tree that describes a different query.
        // Two things could then go wrong with it: a tree that came out `empty` would be DROPPED
        // as a tautology, and a tree that looked pushable would misdescribe the filter to any
        // consumer that reads expressions (cache keys, change-match probes).
        //
        // Nothing is lost. Everything after a join runs in the memory half, where the option is
        // executed as the closure the caller wrote. Pushing a single-side conjunct down is the
        // query builder's separate job, and it splits the conjunct BEFORE the join is recorded.
        this.request.queryOptions.add("filter", {
            filter: selector as any,
            expression: Expression.NOT_PARSABLE,
            params
        });

        return this.create(JoinQueryable<TOuter, Shape, E>);
    }

    /**
     * Projects each pair into a shape of your own.
     *
     * Recorded with NO fields, unlike `Queryable.map`. Fields are property paths on one schema,
     * resolved so a backend can select columns and a translator can deserialize them; a tuple
     * has neither a schema nor columns, and both halves are already deserialized by the time
     * this runs. An invented field list would name properties on a two-element array.
     */
    map<R>(selector: GenericFunction<Shape, R>) {
        this.request.queryOptions.add("map", { selector: selector as GenericFunction<any, any>, fields: [] });

        return this.create(JoinQueryable<TOuter, R, E>);
    }

    /**
     * Orders the pairs.
     *
     * Worth stating plainly: without this, pair ORDER IS UNDEFINED. It differs between a native
     * SQL join and an in-memory hash join, and that is the one difference between
     * interpretations a caller can observe.
     */
    sort(selector: GenericFunction<Shape, unknown>) {
        this.setTupleSortQueryOption(selector, QueryOrdering.Ascending);
        return this.create(JoinQueryable<TOuter, Shape, E>);
    }

    sortDescending(selector: GenericFunction<Shape, unknown>) {
        this.setTupleSortQueryOption(selector, QueryOrdering.Descending);
        return this.create(JoinQueryable<TOuter, Shape, E>);
    }

    /**
     * Recorded with no property, for the same reason `map` is recorded with no fields: the
     * selector reads out of a tuple, so there is no schema property behind it to resolve.
     */
    private setTupleSortQueryOption(selector: GenericFunction<Shape, unknown>, direction: QueryOrdering) {
        this.request.queryOptions.add("sort", {
            selector: selector as any,
            direction,
            propertyName: "",
            property: null
        });
    }

    skip(amount: number) {
        this.request.queryOptions.add("skip", amount);
        return this.create(JoinQueryable<TOuter, Shape, E>);
    }

    take(amount: number) {
        this.request.queryOptions.add("take", amount);
        return this.create(JoinQueryable<TOuter, Shape, E>);
    }

    /** See `QueryableAsync.explain`. Terminals after this deliver `{ data, explanation }`. */
    explain(): JoinQueryable<TOuter, Shape, true> {
        return new JoinQueryable<TOuter, Shape, true>(this.dependencies, this.request.withExplainOn());
    }

    toArray(done: CallbackResult<Explainable<E, Shape[]>>): void {
        this.getData<Shape[]>(this.deliver(done));
    }

    toArrayAsync(): Promise<Explainable<E, Shape[]>> {
        return toPromise<Explainable<E, Shape[]>>(w => this.toArray(w));
    }

    first(done: CallbackResult<Explainable<E, Shape>>): void {
        const d = this.deliver<Shape>(done);

        this._firstOrUndefined(result => {
            if (result.ok === Result.ERROR) {
                d(result);
                return;
            }

            if (result.data == null) {
                d(Result.error(new Error("No items found in data source")));
                return;
            }

            d(Result.success(result.data));
        });
    }

    firstAsync(): Promise<Explainable<E, Shape>> {
        return toPromise<Explainable<E, Shape>>(w => this.first(w));
    }

    firstOrUndefined(done: CallbackResult<Explainable<E, Shape | undefined>>): void {
        this._firstOrUndefined(this.deliver(done));
    }

    /** The raw read, so `first` can reuse it without `deliver` wrapping the result twice. */
    private _firstOrUndefined(done: CallbackResult<Shape | undefined>): void {
        // Restored so this queryable stays re-executable — a terminal option recorded on the
        // shared collection would otherwise stack on a second call.
        const restore = this.request.queryOptions.snapshot();

        this.request.queryOptions.add("take", 1);

        this.getData<Shape[]>(result => {
            if (result.ok === Result.ERROR) {
                done(result);
                return;
            }

            done(Result.success(result.data.length === 0 ? undefined : result.data[0]));
        });

        restore();
    }

    firstOrUndefinedAsync(): Promise<Explainable<E, Shape | undefined>> {
        return toPromise<Explainable<E, Shape | undefined>>(w => this.firstOrUndefined(w));
    }

    count(done: CallbackResult<Explainable<E, number>>): void {
        const restore = this.request.queryOptions.snapshot();

        this.request.queryOptions.add("count", true);
        this.getData<number>(this.deliver(done));

        restore();
    }

    countAsync(): Promise<Explainable<E, number>> {
        return toPromise<Explainable<E, number>>(w => this.count(w));
    }
}
