import { CallbackResult, Result, ResultType } from "@routier/core/results";
import { QuerySource } from "./QuerySource";
import { Filter, ParamsFilter, toExpression } from "@routier/core/expressions";
import { GenericFunction } from "@routier/core/types";
import { QueryOptionName } from "@routier/core/plugins";
import { IdType, InferType } from "@routier/core/schema";
import { CollectionDependencies } from "../collections/types";
import { SimpleContainer } from "../ioc/SimpleContainer";
export class SelectionQueryable<Root extends {}, Shape, U> extends QuerySource<Root, Shape> {

    constructor(container: SimpleContainer<CollectionDependencies<Root>>) {
        super(container);

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

    remove(expression: Filter<InferType<Shape>>, done: CallbackResult<never>): void;
    remove<P extends {}>(expression: ParamsFilter<InferType<Shape>, P>, params: P, done: CallbackResult<never>): void;
    remove(done: CallbackResult<never>): void;
    remove<P extends {} = never>(doneOrExpression: Filter<InferType<Shape>> | ParamsFilter<InferType<Shape>, P> | CallbackResult<never>, paramsOrDone?: P | CallbackResult<never>, done?: CallbackResult<never>): void {

        if (done != null) {
            // params expression
            const paramsFilter = doneOrExpression as ParamsFilter<InferType<Shape>, P>;
            const paramsData = paramsOrDone as P;
            this.setFiltersQueryOption(paramsFilter, paramsData);
            this._remove(done);
            return;
        }

        if (paramsOrDone != null) {
            // generic expression
            const d = paramsOrDone as CallbackResult<never>;
            const genericFilter = doneOrExpression as Filter<InferType<Shape>>;
            this.setFiltersQueryOption(genericFilter);
            this._remove(d);
            return
        }

        // no expression, just remove
        const d = doneOrExpression as CallbackResult<never>;
        this._remove(d);
    }

    toArray(done: CallbackResult<InferType<Shape>[]>): U {
        this.getData(done);
        return this.subscribeQuery<InferType<Shape>[]>(done) as U;
    }

    first(expression: Filter<InferType<Shape>>, done: CallbackResult<InferType<Shape>>): U;
    first<P extends {}>(expression: ParamsFilter<InferType<Shape>, P>, params: P, done: CallbackResult<InferType<Shape>>): U;
    first(done: CallbackResult<InferType<Shape>>): U;
    first<P extends {} = never>(doneOrExpression: Filter<InferType<Shape>> | ParamsFilter<InferType<Shape>, P> | CallbackResult<InferType<Shape>>, paramsOrDone?: P | CallbackResult<InferType<Shape>>, done?: CallbackResult<InferType<Shape>>): U {

        // Need to set the filter before we take one
        this._setQueryExpression({
            doneOrSelector: doneOrExpression,
            done,
            paramsOrDone
        })

        this.request.queryOptions.add("take", 1); // ensure we only select 1 record

        const shaper = (r: InferType<Shape>[]) => {
            if (r.length === 0) {
                return undefined
            }

            return r[0];
        }

        this._query({
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

        const d = done != null ? done : paramsOrDone != null ? paramsOrDone as CallbackResult<InferType<Shape>> : doneOrExpression as CallbackResult<InferType<Shape>>;
        return this.subscribeQuery<InferType<Shape>[]>((r) => {

            if (r.ok === Result.ERROR) {
                d(r);
                return;
            }

            const result = shaper(r.data);

            d(Result.success(result))
        }) as U;
    }

    firstOrUndefined(expression: Filter<InferType<Shape>>, done: CallbackResult<InferType<Shape> | undefined>): U;
    firstOrUndefined<P extends {}>(expression: ParamsFilter<InferType<Shape>, P>, params: P, done: CallbackResult<InferType<Shape> | undefined>): U;
    firstOrUndefined(done: CallbackResult<InferType<Shape> | undefined>): U;
    firstOrUndefined<P extends {} = never>(doneOrExpression: Filter<InferType<Shape>> | ParamsFilter<InferType<Shape>, P> | CallbackResult<InferType<Shape> | undefined>, paramsOrDone?: P | CallbackResult<InferType<Shape> | undefined>, done?: CallbackResult<InferType<Shape> | undefined>): U {

        // Need to set the filter before we take one
        this._setQueryExpression({
            doneOrSelector: doneOrExpression,
            done,
            paramsOrDone
        })

        this.request.queryOptions.add("take", 1); // ensure we only select 1 record

        this._query<P, InferType<Shape>>({
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

        const d = done != null ? done : paramsOrDone != null ? paramsOrDone as CallbackResult<InferType<Shape>> : doneOrExpression as CallbackResult<InferType<Shape>>;
        return this.subscribeQuery<InferType<Shape>[]>((r) => {
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
    }

    some(expression: Filter<InferType<Shape>>, done: CallbackResult<boolean>): U;
    some<P extends {}>(expression: ParamsFilter<InferType<Shape>, P>, params: P, done: CallbackResult<boolean>): U;
    some(done: CallbackResult<boolean>): U;
    some<P extends {} = never>(doneOrExpression: Filter<InferType<Shape>> | ParamsFilter<InferType<Shape>, P> | CallbackResult<boolean>, paramsOrDone?: P | CallbackResult<boolean>, done?: CallbackResult<boolean>): U {

        // Need to set the filter before we take one
        this._setQueryExpression({
            doneOrSelector: doneOrExpression,
            done,
            paramsOrDone
        })

        this.request.queryOptions.add("take", 1); // ensure we only select 1 record

        const shaper = (r: InferType<Shape>[]) => r.length > 0;

        this._query({
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

        const d = done != null ? done : paramsOrDone != null ? paramsOrDone as CallbackResult<boolean> : doneOrExpression as CallbackResult<boolean>;
        return this.subscribeQuery<boolean>(d) as U;
    }

    every(expression: Filter<InferType<Shape>>, done: CallbackResult<boolean>): U;
    every<P extends {}>(expression: ParamsFilter<InferType<Shape>, P>, params: P, done: CallbackResult<boolean>): U;
    every<P extends {} = never>(expression: Filter<InferType<Shape>> | ParamsFilter<InferType<Shape>, P> | CallbackResult<boolean>, paramsOrDone?: P | CallbackResult<boolean>, done?: CallbackResult<boolean>): U {

        // Need to select everything
        const coalescedDone = done != null ? done : (paramsOrDone as CallbackResult<boolean>);

        return this._query({
            doneOrSelector: coalescedDone
        }, (d, r) => {

            if (r.ok === Result.ERROR) {
                d(r);
                return;
            }

            if (done != null) {
                // params query
                const params = paramsOrDone as P
                const paramsExpression = expression as ParamsFilter<InferType<Shape>, P>;
                const result = r.data.filter(w => paramsExpression([w, params]));

                d(Result.success(result.length === r.data.length));
                return;
            }

            // regular query
            const regularExpression = expression as Filter<InferType<Shape>>;
            const result = r.data.filter(regularExpression);

            d(Result.success(result.length === r.data.length));
        }) as U;
    }

    min(selector: GenericFunction<InferType<Shape>, number>, done: CallbackResult<number>): U {
        return this._aggregateFunction(selector, "min", done);
    }

    max(selector: GenericFunction<InferType<Shape>, number>, done: CallbackResult<number>): U {
        return this._aggregateFunction(selector, "max", done);
    }

    sum(selector: GenericFunction<InferType<Shape>, number>, done: CallbackResult<number>): U {
        return this._aggregateFunction(selector, "sum", done);
    }

    count(done: CallbackResult<number>): U {
        this.request.queryOptions.add("count", true);

        this.getData<number>(done);

        return this.subscribeQuery<number>(done) as U;
    }

    distinct(done: CallbackResult<InferType<Shape>[]>): U {

        this.request.queryOptions.add("distinct", true);

        this.getData<InferType<Shape>[]>(done);

        return this.subscribeQuery<InferType<Shape>[]>(done) as U;
    }

    toGroup<R extends InferType<Shape>[keyof InferType<Shape>] & IdType>(selector: GenericFunction<InferType<Shape>, R>, done: CallbackResult<Record<R, InferType<Shape>[]>>): U {

        this.setGroupQueryOption(selector);

        this.getData<Record<R, InferType<Shape>[]>>(done);

        return this.subscribeQuery<Record<R, InferType<Shape>[]>>(done) as U;
    }

    private _setQueryExpression<P extends {}, R extends {}>(options: {
        doneOrSelector: Filter<InferType<Shape>> | ParamsFilter<InferType<Shape>, P> | CallbackResult<R>,
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
            const expression = toExpression(this.schema, selector, params);

            this.request.queryOptions.add("filter", { filter: selector as any, expression, params });
            return;
        }

        // regular query
        const selector = doneOrExpression as Filter<Shape>;
        const expression = toExpression(this.schema, selector);

        this.request.queryOptions.add("filter", { filter: selector as any, expression });
    }

    private _query<P extends {}, R extends {}>(options: {
        doneOrSelector: Filter<InferType<Shape>> | ParamsFilter<InferType<Shape>, P> | CallbackResult<R>,
        paramsOrDone?: P | CallbackResult<R>,
        done?: CallbackResult<R>
    }, resolve: (done: CallbackResult<R>, data: ResultType<InferType<Shape>[]>, error?: any) => void) {

        const { doneOrSelector: doneOrExpression, done, paramsOrDone } = options;

        if (done == null && paramsOrDone == null) {
            // empty query
            const d = doneOrExpression as CallbackResult<R>;
            this.getData<InferType<Shape>[]>((r) => resolve(d, r));
            return;
        }

        if (done != null) {
            // params query
            this.getData<InferType<Shape>[]>((r) => resolve(done, r));
            return;
        }

        // regular query
        const d = paramsOrDone as CallbackResult<R>;
        this.getData<InferType<Shape>[]>((r) => resolve(d, r));
    }

    private _aggregateFunction(selector: GenericFunction<InferType<Shape>, number>, name: QueryOptionName, done: CallbackResult<number>) {

        const fields = this.getFields(selector);
        this.request.queryOptions.add("map", { selector: selector as any, fields });
        this.request.queryOptions.add(name, true);

        this.getData<number>((result) => {

            if (result.ok === "error") {
                return done(result);
            }

            if (result.data == null) {
                return done(Result.error(new Error("No items found in data source")));
            }

            return done(result);
        });

        return this.subscribeQuery<number>(done) as U;
    }
}
