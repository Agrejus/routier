import { Filter, ParamsFilter } from "routier-core";
import { QueryableBaseAsync } from "./base/QueryableBaseAsync";
import { ParamsQueryableAsync } from "./ParamsQueryableAsync";
import { Queryable } from "./Queryable";

export class QueryableAsync<T extends {}> extends QueryableBaseAsync<T> {

    where(expression: Filter<T>): QueryableAsync<T>;
    where<P extends {}>(selector: ParamsFilter<T, P>, params: P): ParamsQueryableAsync<T>;
    where<P extends {} = never>(selector: ParamsFilter<T, P> | Filter<T>, params?: P) {
        if (params == null) {
            this.filters.push({ filter: selector as Filter<T> });
            return new QueryableAsync<T>(this.schema as any, this.parent, { queryable: this });
        }

        this.filters.push({ filter: selector as ParamsFilter<T, P>, params });

        return new ParamsQueryableAsync<T>(this.schema as any, this.parent, { queryable: this });
    }

    subscribe() {
        this.subscribeValue = true;
        return new Queryable<T, () => void>(this.schema as any, this.parent, { queryable: this });
    }
}