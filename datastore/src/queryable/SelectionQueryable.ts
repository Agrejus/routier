import { CallbackResult, Result, ResultType } from "@routier/core/results";
import { QueryableExecutor } from "./QueryableExecutor";
import { Filter, ParamsFilter, toExpression } from "@routier/core/expressions";
import { GenericFunction } from "@routier/core/types";
import { QueryOptionName } from "@routier/core/plugins";
import { IdType } from "@routier/core/schema";
import { CollectionDependencies, RequestContext } from "../collections/types";
import { Explainable } from "./explained";
export class SelectionQueryable<Root extends {}, Shape, U, E extends boolean = false> extends QueryableExecutor<Root, Shape> {

    constructor(dependencies: CollectionDependencies<Root>, request: RequestContext<Root>) {
        super(dependencies, request);

        this.remove = this.remove.bind(this);
        this.toArray = this.toArray.bind(this);
        this.first = this.first.bind(this);
        this.firstOrUndefined = this.firstOrUndefined.bind(this);
        this.some = this.some.bind(this);
        this.every = this.every.bind(this);
        this.min = this.min.bind(this);
        this.max = this.max.bind(this);
        this.sum = this.sum.bind(this);
        this.count = this.count.bind(this);
        this.distinct = this.distinct.bind(this);
    }

    remove(expression: Filter<Shape>, done: CallbackResult<Explainable<E, Shape[]>>): void;
    remove<P extends {}>(expression: ParamsFilter<Shape, P>, params: P, done: CallbackResult<Explainable<E, Shape[]>>): void;
    remove(done: CallbackResult<Explainable<E, Shape[]>>): void;
    remove<P extends {} = never>(doneOrExpression: Filter<Shape> | ParamsFilter<Shape, P> | CallbackResult<Explainable<E, Shape[]>>, paramsOrDone?: P | CallbackResult<Explainable<E, Shape[]>>, done?: CallbackResult<Explainable<E, Shape[]>>): void {

        const restore = this.request.queryOptions.snapshot();

        if (done != null) {
            // params expression
            const paramsFilter = doneOrExpression as ParamsFilter<Shape, P>;
            const paramsData = paramsOrDone as P;
            this.setFiltersQueryOption(paramsFilter, paramsData);
            this._remove(this.deliver<Shape[]>(done));
            restore();
            return;
        }

        if (paramsOrDone != null) {
            // generic expression
            const d = paramsOrDone as CallbackResult<never>;
            const genericFilter = doneOrExpression as Filter<Shape>;
            this.setFiltersQueryOption(genericFilter);
            this._remove(this.deliver<Shape[]>(d));
            restore();
            return
        }

        // no expression, just remove
        const d = doneOrExpression as CallbackResult<never>;
        this._remove(this.deliver<Shape[]>(d));
        restore();
    }

    toArray(done: CallbackResult<Explainable<E, Shape[]>>): U {
        const d = this.deliver<Shape[]>(done);

        this.getData(d);
        return this.subscribeQuery<Shape[]>(d) as U;
    }

    first(expression: Filter<Shape>, done: CallbackResult<Explainable<E, Shape>>): U;
    first<P extends {}>(expression: ParamsFilter<Shape, P>, params: P, done: CallbackResult<Explainable<E, Shape>>): U;
    first(done: CallbackResult<Explainable<E, Shape>>): U;
    first<P extends {} = never>(doneOrExpression: Filter<Shape> | ParamsFilter<Shape, P> | CallbackResult<Explainable<E, Shape>>, paramsOrDone?: P | CallbackResult<Explainable<E, Shape>>, done?: CallbackResult<Explainable<E, Shape>>): U {

        const restore = this.request.queryOptions.snapshot();

        // Need to set the filter before we take one
        this._setQueryExpression({
            doneOrSelector: doneOrExpression,
            done,
            paramsOrDone
        })

        this.request.queryOptions.add("take", 1); // ensure we only select 1 record

        const shaper = (r: Shape[]) => {
            if (r.length === 0) {
                return undefined
            }

            return r[0];
        }

        this._query<P, Shape>({
            doneOrSelector: doneOrExpression,
            done,
            paramsOrDone
        }, (d, r) => {

            if (r.ok === Result.ERROR) {
                d(r);
                return;
            }

            const result = shaper(r.data);

            if (result == null) {
                d(Result.error(new Error("No items found in data source")));
                return;
            }

            d(Result.success(result));
        });

        const d = this.deliver<Shape>(done != null ? done : paramsOrDone != null ? paramsOrDone as CallbackResult<Shape> : doneOrExpression as CallbackResult<Shape>);
        const subscription = this.subscribeQuery<Shape[]>((r) => {

            if (r.ok === Result.ERROR) {
                d(r);
                return;
            }

            const result = shaper(r.data);

            d(Result.success(result))
        }) as U;

        restore();
        return subscription;
    }

    firstOrUndefined(expression: Filter<Shape>, done: CallbackResult<Explainable<E, Shape | undefined>>): U;
    firstOrUndefined<P extends {}>(expression: ParamsFilter<Shape, P>, params: P, done: CallbackResult<Explainable<E, Shape | undefined>>): U;
    firstOrUndefined(done: CallbackResult<Explainable<E, Shape | undefined>>): U;
    firstOrUndefined<P extends {} = never>(doneOrExpression: Filter<Shape> | ParamsFilter<Shape, P> | CallbackResult<Explainable<E, Shape | undefined>>, paramsOrDone?: P | CallbackResult<Explainable<E, Shape | undefined>>, done?: CallbackResult<Explainable<E, Shape | undefined>>): U {

        const restore = this.request.queryOptions.snapshot();

        // Need to set the filter before we take one
        this._setQueryExpression({
            doneOrSelector: doneOrExpression,
            done,
            paramsOrDone
        })

        this.request.queryOptions.add("take", 1); // ensure we only select 1 record

        this._query<P, Shape>({
            doneOrSelector: doneOrExpression,
            done,
            paramsOrDone
        }, (d, r) => {

            if (r.ok === Result.ERROR) {
                d(r);
                return;
            }

            if (r.data.length === 0) {
                d(Result.success(undefined));
                return;
            }


            d(Result.success(r.data[0]));
        });

        const d = this.deliver<Shape>(done != null ? done : paramsOrDone != null ? paramsOrDone as CallbackResult<Shape> : doneOrExpression as CallbackResult<Shape>);
        const subscription = this.subscribeQuery<Shape[]>((r) => {
            if (r.ok === Result.ERROR) {
                d(r);
                return;
            }

            if (r.data.length === 0) {
                d(Result.success(undefined));
                return;
            }

            d(Result.success(r.data[0]));
        }) as U;

        restore();
        return subscription;
    }

    some(expression: Filter<Shape>, done: CallbackResult<Explainable<E, boolean>>): U;
    some<P extends {}>(expression: ParamsFilter<Shape, P>, params: P, done: CallbackResult<Explainable<E, boolean>>): U;
    some(done: CallbackResult<Explainable<E, boolean>>): U;
    some<P extends {} = never>(doneOrExpression: Filter<Shape> | ParamsFilter<Shape, P> | CallbackResult<Explainable<E, boolean>>, paramsOrDone?: P | CallbackResult<Explainable<E, boolean>>, done?: CallbackResult<Explainable<E, boolean>>): U {

        const restore = this.request.queryOptions.snapshot();

        // Need to set the filter before we take one
        this._setQueryExpression({
            doneOrSelector: doneOrExpression,
            done,
            paramsOrDone
        })

        this.request.queryOptions.add("take", 1); // ensure we only select 1 record

        const shaper = (r: Shape[]) => r.length > 0;

        this._query<P, boolean>({
            doneOrSelector: doneOrExpression,
            done,
            paramsOrDone
        }, (d, r) => {

            if (r.ok === Result.ERROR) {
                d(r);
                return;
            }

            d(Result.success(shaper(r.data)))
        });

        const d = this.deliver<boolean>(done != null ? done : paramsOrDone != null ? paramsOrDone as CallbackResult<boolean> : doneOrExpression as CallbackResult<boolean>);
        const subscription = this.subscribeQuery<boolean>(d) as U;

        restore();
        return subscription;
    }

    every(expression: Filter<Shape>, done: CallbackResult<Explainable<E, boolean>>): U;
    every<P extends {}>(expression: ParamsFilter<Shape, P>, params: P, done: CallbackResult<Explainable<E, boolean>>): U;
    every<P extends {} = never>(expression: Filter<Shape> | ParamsFilter<Shape, P> | CallbackResult<Explainable<E, boolean>>, paramsOrDone?: P | CallbackResult<Explainable<E, boolean>>, done?: CallbackResult<Explainable<E, boolean>>): U {

        // Need to select everything
        const coalescedDone = (done != null ? done : paramsOrDone) as CallbackResult<Explainable<E, boolean>>;

        return this._query<P, boolean>({
            doneOrSelector: coalescedDone
        }, (d, r) => {

            if (r.ok === Result.ERROR) {
                d(r);
                return;
            }

            if (done != null) {
                // params query
                const params = paramsOrDone as P
                const paramsExpression = expression as ParamsFilter<Shape, P>;
                const result = r.data.filter(w => paramsExpression([w, params]));

                d(Result.success(result.length === r.data.length));
                return;
            }

            // regular query
            const regularExpression = expression as Filter<Shape>;
            const result = r.data.filter(regularExpression);

            d(Result.success(result.length === r.data.length));
        }) as U;
    }

    min(selector: GenericFunction<Shape, number>, done: CallbackResult<Explainable<E, number>>): U {
        return this._aggregateFunction(selector, "min", done);
    }

    max(selector: GenericFunction<Shape, number>, done: CallbackResult<Explainable<E, number>>): U {
        return this._aggregateFunction(selector, "max", done);
    }

    sum(selector: GenericFunction<Shape, number>, done: CallbackResult<Explainable<E, number>>): U {
        return this._aggregateFunction(selector, "sum", done);
    }

    count(done: CallbackResult<Explainable<E, number>>): U {
        // Terminal options are restored after execution so the queryable stays
        // re-executable (subscribed queryables re-run as data changes)
        const restore = this.request.queryOptions.snapshot();
        this.request.queryOptions.add("count", true);

        const d = this.deliver<number>(done);

        this.getData<number>(d);

        const result = this.subscribeQuery<number>(d) as U;
        restore();
        return result;
    }

    distinct(done: CallbackResult<Explainable<E, Shape[]>>): U {

        const restore = this.request.queryOptions.snapshot();
        this.request.queryOptions.add("distinct", true);

        const d = this.deliver<Shape[]>(done);

        this.getData<Shape[]>(d);

        const result = this.subscribeQuery<Shape[]>(d) as U;
        restore();
        return result;
    }

    toGroup<R extends Shape[keyof Shape] & IdType>(selector: GenericFunction<Shape, R>, done: CallbackResult<Explainable<E, Record<R, Shape[]>>>): U {

        const restore = this.request.queryOptions.snapshot();
        this.setGroupQueryOption(selector);

        const d = this.deliver<Record<R, Shape[]>>(done);

        this.getData<Record<R, Shape[]>>(d);

        const result = this.subscribeQuery<Record<R, Shape[]>>(d) as U;
        restore();
        return result;
    }

    private _setQueryExpression<P extends {}, R extends {}>(options: {
        doneOrSelector: Filter<Shape> | ParamsFilter<Shape, P> | CallbackResult<R>,
        paramsOrDone?: P | CallbackResult<R>,
        done?: CallbackResult<R>
    }) {
        const { doneOrSelector: doneOrExpression, done, paramsOrDone } = options;

        if (done == null && paramsOrDone == null) {
            // empty query
            return;
        }

        if (done != null) {
            // params query
            const selector = doneOrExpression as Filter<Shape> | ParamsFilter<Shape, {}>;
            const params = paramsOrDone as P;
            const expression = toExpression(this.dependencies.schema, selector, params);

            this.request.queryOptions.add("filter", { filter: selector as any, expression, params });
            return;
        }

        // regular query
        const selector = doneOrExpression as Filter<Shape>;
        const expression = toExpression(this.dependencies.schema, selector);

        this.request.queryOptions.add("filter", { filter: selector as any, expression });
    }

    /**
     * Resolves the caller's callback from the overload shapes and runs the query through it.
     *
     * The callback arrives WRAPPED (`Explainable<E, R>`) and reaches `resolve` UNWRAPPED, because
     * `deliver` converts between the two — shapers hand it a bare `R` and it attaches the
     * explanation. Every terminal but `toArray` and `remove` funnels through here, which is why
     * explain needs no per-terminal wiring.
     */
    private _query<P extends {}, R extends {}>(options: {
        doneOrSelector: Filter<Shape> | ParamsFilter<Shape, P> | CallbackResult<Explainable<E, R>>,
        paramsOrDone?: P | CallbackResult<Explainable<E, R>>,
        done?: CallbackResult<Explainable<E, R>>
    }, resolve: (done: CallbackResult<R>, data: ResultType<Shape[]>, error?: any) => void) {

        const { doneOrSelector: doneOrExpression, done, paramsOrDone } = options;

        if (done == null && paramsOrDone == null) {
            // empty query
            const d = this.deliver<R>(doneOrExpression as CallbackResult<R>);
            this.getData<Shape[]>((r) => resolve(d, r));
            return;
        }

        if (done != null) {
            // params query
            const d = this.deliver<R>(done);
            this.getData<Shape[]>((r) => resolve(d, r));
            return;
        }

        // regular query
        const d = this.deliver<R>(paramsOrDone as CallbackResult<R>);
        this.getData<Shape[]>((r) => resolve(d, r));
    }

    private _aggregateFunction(selector: GenericFunction<Shape, number>, name: QueryOptionName, done: CallbackResult<Explainable<E, number>>) {

        const restore = this.request.queryOptions.snapshot();
        const fields = this.getFields(selector);
        this.request.queryOptions.add("map", { selector: selector as any, fields });
        this.request.queryOptions.add(name, true);

        const d = this.deliver<number>(done);

        this.getData<number>((result) => {

            if (result.ok === "error") {
                return d(result);
            }

            if (result.data == null) {
                return d(Result.error(new Error("No items found in data source")));
            }

            return d(result);
        });

        const subscription = this.subscribeQuery<number>(d) as U;

        restore();
        return subscription;
    }
}
