import { QueryOption, QueryOptionName } from "../query/types";
import { IQuery } from "../types";

export abstract class DataTranslator<T extends {}, TShape> {

    protected query: IQuery<T>;
    private functionMap: Record<QueryOptionName, (data: unknown, option: QueryOption<any, any>) => T> = {
        count: this.count<any>,
        distinct: this.distinct,
        filter: this.filter,
        map: this.map,
        max: this.max<any>,
        min: this.min<any>,
        skip: this.skip,
        sort: this.sort,
        sum: this.sum<any>,
        take: this.take
    };

    constructor(query: IQuery<T>) {
        this.query = query;
    }

    // Terminators
    abstract count<TResult extends number>(data: unknown, option: QueryOption<T, "count">): TResult;
    abstract min<TResult extends string | number | Date>(data: unknown, option: QueryOption<T, "min">): TResult;
    abstract max<TResult extends string | number | Date>(data: unknown, option: QueryOption<T, "max">): TResult;
    abstract sum<TResult extends number>(data: unknown, option: QueryOption<T, "sum">): TResult;
    abstract distinct<TResult>(data: unknown, option: QueryOption<T, "distinct">): TResult;

    // Shapers
    abstract filter<TResult>(data: unknown, option: QueryOption<T, "filter">): TResult;
    abstract skip(data: unknown, option: QueryOption<T, "skip">): T;
    abstract take(data: unknown, option: QueryOption<T, "take">): T;
    abstract sort(data: unknown, option: QueryOption<T, "sort">): T;
    abstract map(data: unknown, option: QueryOption<T, "map">): T;

    translate(data: unknown): TShape {

        this.query.options.forEach(item => {
            data = this.functionMap[item.name](data, item);
        });

        return data as TShape;
    }
}