
import { IQuery } from '../types';
import { QueryOptionsCollection } from './QueryOptionsCollection';

export class Query<TEntity extends {}> implements IQuery<TEntity> {

    readonly options: QueryOptionsCollection<TEntity>;
    private enableChangeTrackingOverride?: boolean

    constructor(
        options: QueryOptionsCollection<TEntity>,
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

    static EMPTY<T extends {}>() {
        return new Query<T>(QueryOptionsCollection.EMPTY<T>());
    }

    static isEmpty<T extends {}>(query: IQuery<T>) {
        return QueryOptionsCollection.isEmpty(query.options);
    }
}