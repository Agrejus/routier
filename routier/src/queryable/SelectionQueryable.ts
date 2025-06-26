import { Filter, GenericFunction, ParamsFilter, QueryOptionName, toExpression } from "routier-core";
import { QuerySource } from "./QuerySource";
import { QueryResult } from "../types";

export class SelectionQueryable<Root extends {}, Shape, U> extends QuerySource<Root, Shape> {

    remove(expression: Filter<Shape>, done: (error?: any) => void): void;
    remove<P extends {}>(expression: ParamsFilter<Shape, P>, params: P, done: (error?: any) => void): void;
    remove(done: (error?: any) => void): void;
    remove<P extends {} = never>(doneOrExpression: Filter<Shape> | ParamsFilter<Shape, P> | ((error?: any) => void), paramsOrDone?: P | ((error?: any) => void), done?: (error?: any) => void): void {

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
            const d = paramsOrDone as (error?: any) => void
            const genericFilter = doneOrExpression as Filter<Shape>;
            this.setFiltersQueryOption(genericFilter);
            this._remove(d);
            return
        }

        // no expression, just remove
        const d = doneOrExpression as (error?: any) => void;
        this._remove(d);
    }

    toArray(done: QueryResult<Shape[]>): U {
        this.getData(done);
        return this.subscribeQuery<Shape[]>(done) as U;
    }

    first(expression: Filter<Shape>, done: QueryResult<Shape>): U;
    first<P extends {}>(expression: ParamsFilter<Shape, P>, params: P, done: QueryResult<Shape>): U;
    first(done: QueryResult<Shape>): U;
    first<P extends {} = never>(doneOrExpression: Filter<Shape> | ParamsFilter<Shape, P> | QueryResult<Shape>, paramsOrDone?: P | QueryResult<Shape>, done?: QueryResult<Shape>): U {

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
        }, (d, r, e) => {
            const result = shaper(r);

            if (result == null) {
                d(undefined as unknown as Shape, new Error("Could not find entity in query"))
                return;
            }

            d(result, e)
        });

        const d = done != null ? done : paramsOrDone != null ? paramsOrDone as QueryResult<Shape> : doneOrExpression as QueryResult<Shape>;
        return this.subscribeQuery<Shape>((r, e) => {
            if (r == null) {
                d(undefined as unknown as Shape, new Error("Could not find entity in query"))
                return;
            }

            d(r, e);
        }) as U;
    }

    firstOrUndefined(expression: Filter<Shape>, done: QueryResult<Shape | undefined>): U;
    firstOrUndefined<P extends {}>(expression: ParamsFilter<Shape, P>, params: P, done: QueryResult<Shape | undefined>): U;
    firstOrUndefined(done: QueryResult<Shape | undefined>): U;
    firstOrUndefined<P extends {} = never>(doneOrExpression: Filter<Shape> | ParamsFilter<Shape, P> | QueryResult<Shape | undefined>, paramsOrDone?: P | QueryResult<Shape | undefined>, done?: QueryResult<Shape | undefined>): U {

        this.queryOptions.add("take", 1); // ensure we only select 1 record

        this._query<P, Shape>({
            doneOrSelector: doneOrExpression,
            done,
            paramsOrDone
        }, (d, r, e) => {

            if (r.length === 0) {
                d(undefined as unknown as Shape, e)
                return;
            }

            d(r[0], e)
        });

        const d = done != null ? done : paramsOrDone != null ? paramsOrDone as QueryResult<Shape> : doneOrExpression as QueryResult<Shape>;
        return this.subscribeQuery<Shape>((r, e) => {
            if (r == null) {
                d(undefined as unknown as Shape, e)
                return;
            }

            d(r, e);
        }) as U;
    }

    some(expression: Filter<Shape>, done: QueryResult<boolean>): U;
    some<P extends {}>(expression: ParamsFilter<Shape, P>, params: P, done: QueryResult<boolean>): U;
    some(done: QueryResult<boolean>): U;
    some<P extends {} = never>(doneOrExpression: Filter<Shape> | ParamsFilter<Shape, P> | QueryResult<boolean>, paramsOrDone?: P | QueryResult<boolean>, done?: QueryResult<boolean>): U {
        this.queryOptions.add("take", 1); // ensure we only select 1 record

        const shaper = (r: Shape[]) => r.length > 0;

        this._query({
            doneOrSelector: doneOrExpression,
            done,
            paramsOrDone
        }, (d, r, e) => d(shaper(r), e));

        const d = done != null ? done : paramsOrDone != null ? paramsOrDone as QueryResult<boolean> : doneOrExpression as QueryResult<boolean>;
        return this.subscribeQuery<boolean>(d) as U;
    }

    every(expression: Filter<Shape>, done: QueryResult<boolean>): U;
    every<P extends {}>(expression: ParamsFilter<Shape, P>, params: P, done: QueryResult<boolean>): U;
    every<P extends {} = never>(expression: Filter<Shape> | ParamsFilter<Shape, P> | QueryResult<boolean>, paramsOrDone?: P | QueryResult<boolean>, done?: QueryResult<boolean>): U {

        // Need to select everything
        const coalescedDone = done != null ? done : (paramsOrDone as QueryResult<boolean>);
        return this._query({
            doneOrSelector: coalescedDone
        }, (d, r, e) => {

            if (done != null) {
                // params query
                const params = paramsOrDone as P
                const paramsExpression = expression as ParamsFilter<Shape, P>;
                const result = r.filter(w => paramsExpression([w, params]));

                d(result.length === r.length, e);
                return;
            }

            // regular query
            const regularExpression = expression as Filter<Shape>;
            const result = r.filter(regularExpression);

            d(result.length === r.length, e);
        }) as U;
    }

    min(selector: GenericFunction<Shape, number>, done: QueryResult<number>): U {
        return this._aggregateFunction(selector, "min", done);
    }

    max(selector: GenericFunction<Shape, number>, done: QueryResult<number>): U {
        return this._aggregateFunction(selector, "max", done);
    }

    sum(selector: GenericFunction<Shape, number>, done: QueryResult<number>): U {
        return this._aggregateFunction(selector, "sum", done);
    }

    // we will want to handle this better with SQL, that will return just a number, not items
    count(done: QueryResult<number>): U {
        this.queryOptions.add("count", true);

        this.getData<number>((r, e) => {
            if (e) {
                done(undefined as unknown as any, e);
                return;
            };

            done(r)
        });

        return this.subscribeQuery<number>((r, e) => {
            if (r == null) {
                done(undefined as unknown as any, new Error("Could not find entity in query"))
                return;
            }

            done(r, e);
        }) as U;
    }

    distinct(done: QueryResult<Shape[]>): U {
        this.queryOptions.add("distinct", true);

        this.getData<Shape[]>((r, e) => {
            if (e) {
                done(undefined as unknown as Shape[], e);
                return;
            };

            done(r)
        });

        return this.subscribeQuery<Shape[]>((r, e) => {
            if (r == null) {
                done(undefined as unknown as Shape[], new Error("Could not find entity in query"))
                return;
            }

            done(r, e);
        }) as U;
    }

    private _query<P extends {}, R extends {}>(options: {
        doneOrSelector: Filter<Shape> | ParamsFilter<Shape, P> | QueryResult<R>,
        paramsOrDone?: P | QueryResult<R>,
        done?: QueryResult<R>
    }, resolve: (done: QueryResult<R>, data: Shape[], error?: any) => void) {

        const { doneOrSelector: doneOrExpression, done, paramsOrDone } = options;

        if (done == null && paramsOrDone == null) {
            // empty query
            const d = doneOrExpression as QueryResult<R>;
            this.getData<Shape[]>((r, e) => {
                if (!e) {
                    resolve(d, r, e);
                    return;
                }
                resolve(d, [], e);
            });
            return;
        }

        if (done != null) {
            // params query
            const selector = doneOrExpression as Filter<Shape> | ParamsFilter<Shape, {}>;
            const params = paramsOrDone as P;
            const expression = toExpression(this.schema, selector, params);

            this.queryOptions.add("filter", { filter: selector, expression, params });

            this.getData<Shape[]>((r, e) => {
                if (!e) {
                    resolve(done, r, e);
                    return;
                }
                resolve(done, [], e);
            });
            return;
        }

        // regular query
        const d = paramsOrDone as QueryResult<R>;
        const selector = doneOrExpression as Filter<Shape>;
        const expression = toExpression(this.schema, selector);

        this.queryOptions.add("filter", { filter: selector, expression });
        this.getData<Shape[]>((r, e) => {
            if (!e) {
                resolve(d, r, e);
                return;
            }
            resolve(d, [], e);
        });
    }

    private _aggregateFunction(selector: GenericFunction<Shape, number>, name: QueryOptionName, done: QueryResult<number>) {
        const fields = this.getFields(selector);
        this.queryOptions.add("map", { selector, fields });
        this.queryOptions.add(name, true);

        this.getData<number>((r, e) => {
            if (e) {
                done(undefined as unknown as any, e);
                return;
            };

            done(r)
        });

        return this.subscribeQuery<number>((r, e) => {
            if (r == null) {
                done(undefined as unknown as any, new Error("Could not find entity in query"))
                return;
            }

            done(r, e);
        }) as U;
    }
}
