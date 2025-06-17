
import { Expression, Filterable } from '../../expressions/types';
import { IQuery } from '../types';
import { QueryOptionsCollection } from './QueryOptionsCollection';

export class Query<TEntity extends {}, TShape extends any = TEntity> implements IQuery<TEntity, TShape> {

    readonly options: QueryOptionsCollection;
    readonly filters: Filterable<TShape, any>[];
    readonly expression?: Expression;

    constructor(
        options: QueryOptionsCollection,
        filters: Filterable<TShape, any>[],
        expression?: Expression
    ) {
        this.options = options;
        this.filters = filters;
        this.expression = expression;
    }

    // boolean value whether or not change tracking can be enabled on the query result
    get changeTracking(): boolean {

        const fields = this.options.getValue<[]>("fields");
        const count = this.options.getValue<boolean>("count");
        const max = this.options.getValue<boolean>("max");
        const min = this.options.getValue<boolean>("min");
        const sum = this.options.getValue<boolean>("sum");

        if (fields?.length != null && fields.length > 0) {
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

    static EMPTY<T extends {}, TShape extends any = T>() {
        return new Query<T, TShape>(QueryOptionsCollection.EMPTY, []);
    }

    static isEmpty<T extends {}, TShape extends any = T>(query: IQuery<T, TShape>) {
        return Object.keys(query.options).length === 0 && query.expression == null && query.filters.length === 0;
    }
}