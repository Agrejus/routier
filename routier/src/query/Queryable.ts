import { Filter, ParamsFilter } from "routier-core";
import { QueryableBase } from "./base/QueryableBase";
import { ParamsQueryable } from "./ParamsQueryable";

export class Queryable<T extends {}, U = void> extends QueryableBase<T, U> {

    where(expression: Filter<T>): Queryable<T, U>;
    where<P extends {}>(selector: ParamsFilter<T, P>, params: P): ParamsQueryable<T, U>;
    where<P extends {} = never>(selector: ParamsFilter<T, P> | Filter<T>, params?: P) {
        if (params == null) {
            this.filters.push({ filter: selector as Filter<T> });
            return new Queryable<T, U>(this.schema as any, this.parent, { queryable: this });
        }

        this.filters.push({ params, filter: selector as ParamsFilter<T, P> });

        return new ParamsQueryable<T, U>(this.schema as any, this.parent, { queryable: this });
    }

    subscribe() {
        this.subscribeValue = true;
        return new Queryable<T, () => void>(this.schema as any, this.parent, { queryable: this });
    }

    remove(done: (error?: any) => void) {
        return this._remove<U>(done);
    }
}


