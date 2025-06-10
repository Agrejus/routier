import { InferMappedType } from "routier-core";
import { EntityMap } from "../../types";
import { LimitedQueryableAsync } from "../LimitedQueryableAsync";
import { OrderedQueryableAsync } from "../OrderedQueryableAsync";
import { SelectionQueryableAsync } from "../SelectionQueryableAsync";
import { ShapedQueryableAsync } from "../ShapedQueryableAsync";
import { SkippedQueryableAsync } from "../SkippedQueryableAsync";
import { QueryOrdering } from "../types";

export class QueryableBaseAsync<T extends {}> extends SelectionQueryableAsync<T> {

    map<R extends T[keyof T] | {}>(expression: EntityMap<T, R>) {
        this.mapValue = expression;
        return new ShapedQueryableAsync<InferMappedType<R>>(this.schema as any, this.parent, { queryable: this as any });
    }

    skip(amount: number) {
        this.skipValue = amount;
        return new SkippedQueryableAsync<T>(this.schema as any, this.parent, { queryable: this });
    }

    take(amount: number) {
        this.takeValue = amount;
        return new LimitedQueryableAsync<T>(this.schema as any, this.parent, { queryable: this })
    }

    sort(expression: EntityMap<T, T[keyof T]>) {
        this.sorting.push({ selector: expression, direction: QueryOrdering.Ascending });
        return new OrderedQueryableAsync<T>(this.schema as any, this.parent, { queryable: this });
    }

    sortDescending(expression: EntityMap<T, T[keyof T]>) {
        this.sorting.push({ selector: expression, direction: QueryOrdering.Descending });
        return new OrderedQueryableAsync<T>(this.schema as any, this.parent, { queryable: this });
    }
}
