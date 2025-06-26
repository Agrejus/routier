
import { IQuery } from '../types';
import { QueryOptionsCollection } from './QueryOptionsCollection';

export class Query<TRoot extends {}, TShape> implements IQuery<TRoot, TShape> {

    readonly options: QueryOptionsCollection<TShape>;
    private enableChangeTrackingOverride?: boolean

    constructor(
        options: QueryOptionsCollection<TShape>,
        enableChangeTrackingOverride?: boolean
    ) {
        this.options = options;
        this.enableChangeTrackingOverride = enableChangeTrackingOverride;
    }

    // boolean value whether or not change tracking can be enabled on the query result
    get changeTracking(): boolean {

        if (this.enableChangeTrackingOverride != null) {
            return this.enableChangeTrackingOverride;
        }

        const map = this.options.getValues("map");
        const count = this.options.has("count");
        const max = this.options.has("max");
        const min = this.options.has("min");
        const sum = this.options.has("sum");

        if (map.some(x => x.fields.length > 0)) {
            return false
        }

        if (count === true ||
            max === true ||
            min === true ||
            sum === true) {
            return false
        }

        return true;
    }

    static EMPTY<T extends {}, S>() {
        return new Query<T, S>(QueryOptionsCollection.EMPTY<S>());
    }

    static isEmpty<T extends {}, S>(query: IQuery<T, S>) {
        return QueryOptionsCollection.isEmpty(query.options);
    }
}