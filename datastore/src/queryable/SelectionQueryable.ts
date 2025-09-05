import { CallbackResult, Result, ResultType } from "@routier/core/results";
import { QuerySource } from "./QuerySource";
import { Filter, ParamsFilter, toExpression } from "@routier/core/expressions";
import { GenericFunction } from "@routier/core/types";
import { QueryOptionName } from "@routier/core/plugins";
export class SelectionQueryable<Root extends {}, Shape, U> extends QuerySource<Root, Shape> {

    remove(expression: Filter<Shape>, done: CallbackResult<never>): void;
    remove<P extends {}>(expression: ParamsFilter<Shape, P>, params: P, done: CallbackResult<never>): void;
    remove(done: CallbackResult<never>): void;
    remove<P extends {} = never>(doneOrExpression: Filter<Shape> | ParamsFilter<Shape, P> | CallbackResult<never>, paramsOrDone?: P | CallbackResult<never>, done?: CallbackResult<never>): void {

        if (done != null) {
            // params expression
            const paramsFilter = doneOrExpression as ParamsFilter<Shape, P>;
            const paramsData = paramsOrDone as P;
            this.setFiltersQueryOption(paramsFilter, paramsData);
            this._remove(done);
            return;
        }

        if (paramsOrDone != null) {
            // generic expression
            const d = paramsOrDone as CallbackResult<never>;
            const genericFilter = doneOrExpression as Filter<Shape>;
            this.setFiltersQueryOption(genericFilter);
            this._remove(d);
            return
        }

        // no expression, just remove
        const d = doneOrExpression as CallbackResult<never>;
        this._remove(d);
    }

    toArray(done: CallbackResult<Shape[]>): U {
        this.getData(done);
        return this.subscribeQuery<Shape[]>(done) as U;
    }

    first(expression: Filter<Shape>, done: CallbackResult<Shape>): U;
    first<P extends {}>(expression: ParamsFilter<Shape, P>, params: P, done: CallbackResult<Shape>): U;
    first(done: CallbackResult<Shape>): U;
    first<P extends {} = never>(doneOrExpression: Filter<Shape> | ParamsFilter<Shape, P> | CallbackResult<Shape>, paramsOrDone?: P | CallbackResult<Shape>, done?: CallbackResult<Shape>): U {

        this.queryOptions.add("take", 1); // ensure we only select 1 record

        const shaper = (r: Shape[]) => {
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

        const d = done != null ? done : paramsOrDone != null ? paramsOrDone as CallbackResult<Shape> : doneOrExpression as CallbackResult<Shape>;
        return this.subscribeQuery<Shape[]>((r) => {

            if (r.ok === Result.ERROR) {
                d(r);
                return;
            }

            const result = shaper(r.data);

            d(Result.success(result))
        }) as U;
    }

    firstOrUndefined(expression: Filter<Shape>, done: CallbackResult<Shape | undefined>): U;
    firstOrUndefined<P extends {}>(expression: ParamsFilter<Shape, P>, params: P, done: CallbackResult<Shape | undefined>): U;
    firstOrUndefined(done: CallbackResult<Shape | undefined>): U;
    firstOrUndefined<P extends {} = never>(doneOrExpression: Filter<Shape> | ParamsFilter<Shape, P> | CallbackResult<Shape | undefined>, paramsOrDone?: P | CallbackResult<Shape | undefined>, done?: CallbackResult<Shape | undefined>): U {

        this.queryOptions.add("take", 1); // ensure we only select 1 record

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

        const d = done != null ? done : paramsOrDone != null ? paramsOrDone as CallbackResult<Shape> : doneOrExpression as CallbackResult<Shape>;
        return this.subscribeQuery<Shape[]>((r) => {
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

    some(expression: Filter<Shape>, done: CallbackResult<boolean>): U;
    some<P extends {}>(expression: ParamsFilter<Shape, P>, params: P, done: CallbackResult<boolean>): U;
    some(done: CallbackResult<boolean>): U;
    some<P extends {} = never>(doneOrExpression: Filter<Shape> | ParamsFilter<Shape, P> | CallbackResult<boolean>, paramsOrDone?: P | CallbackResult<boolean>, done?: CallbackResult<boolean>): U {
        this.queryOptions.add("take", 1); // ensure we only select 1 record

        const shaper = (r: Shape[]) => r.length > 0;

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

    every(expression: Filter<Shape>, done: CallbackResult<boolean>): U;
    every<P extends {}>(expression: ParamsFilter<Shape, P>, params: P, done: CallbackResult<boolean>): U;
    every<P extends {} = never>(expression: Filter<Shape> | ParamsFilter<Shape, P> | CallbackResult<boolean>, paramsOrDone?: P | CallbackResult<boolean>, done?: CallbackResult<boolean>): U {

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

    min(selector: GenericFunction<Shape, number>, done: CallbackResult<number>): U {
        return this._aggregateFunction(selector, "min", done);
    }

    max(selector: GenericFunction<Shape, number>, done: CallbackResult<number>): U {
        return this._aggregateFunction(selector, "max", done);
    }

    sum(selector: GenericFunction<Shape, number>, done: CallbackResult<number>): U {
        return this._aggregateFunction(selector, "sum", done);
    }

    // we will want to handle this better with SQL, that will return just a number, not items
    count(done: CallbackResult<number>): U {
        this.queryOptions.add("count", true);

        this.getData<number>(done);

        return this.subscribeQuery<number>(done) as U;
    }

    distinct(done: CallbackResult<Shape[]>): U {
        this.queryOptions.add("distinct", true);

        this.getData<Shape[]>(done);

        return this.subscribeQuery<Shape[]>(done) as U;
    }

    private _query<P extends {}, R extends {}>(options: {
        doneOrSelector: Filter<Shape> | ParamsFilter<Shape, P> | CallbackResult<R>,
        paramsOrDone?: P | CallbackResult<R>,
        done?: CallbackResult<R>
    }, resolve: (done: CallbackResult<R>, data: ResultType<Shape[]>, error?: any) => void) {

        const { doneOrSelector: doneOrExpression, done, paramsOrDone } = options;

        if (done == null && paramsOrDone == null) {
            // empty query
            const d = doneOrExpression as CallbackResult<R>;
            this.getData<Shape[]>((r) => resolve(d, r));
            return;
        }

        if (done != null) {
            // params query
            const selector = doneOrExpression as Filter<Shape> | ParamsFilter<Shape, {}>;
            const params = paramsOrDone as P;
            const expression = toExpression(this.schema, selector, params);

            this.queryOptions.add("filter", { filter: selector, expression, params });

            this.getData<Shape[]>((r) => resolve(done, r));
            return;
        }

        // regular query
        const d = paramsOrDone as CallbackResult<R>;
        const selector = doneOrExpression as Filter<Shape>;
        const expression = toExpression(this.schema, selector);

        this.queryOptions.add("filter", { filter: selector, expression });
        this.getData<Shape[]>((r) => resolve(d, r));
    }

    private _aggregateFunction(selector: GenericFunction<Shape, number>, name: QueryOptionName, done: CallbackResult<number>) {
        const fields = this.getFields(selector);
        this.queryOptions.add("map", { selector, fields });
        this.queryOptions.add(name, true);

        this.getData<number>(done);

        return this.subscribeQuery<number>(done) as U;
    }
}
