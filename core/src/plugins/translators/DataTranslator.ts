import { QueryOption, QueryOptionName } from "../query/types";
import { IQuery } from "../types";

export abstract class DataTranslator<T extends {}, TShape> {

    protected query: IQuery<T>;
    private functionMap: Record<QueryOptionName, (data: unknown, option: QueryOption<any, any>) => T> = {
        count: (data: unknown, option: QueryOption<T, "count">) => this.count<any>(data, option),
        distinct: (data: unknown, option: QueryOption<T, "distinct">) => this.distinct(data, option),
        filter: (data: unknown, option: QueryOption<T, "filter">) => this.filter(data, option),
        map: (data: unknown, option: QueryOption<T, "map">) => this.map(data, option),
        max: (data: unknown, option: QueryOption<T, "max">) => this.max<any>(data, option),
        min: (data: unknown, option: QueryOption<T, "min">) => this.min<any>(data, option),
        skip: (data: unknown, option: QueryOption<T, "skip">) => this.skip(data, option),
        sort: (data: unknown, option: QueryOption<T, "sort">) => this.sort(data, option),
        sum: (data: unknown, option: QueryOption<T, "sum">) => this.sum<any>(data, option),
        take: (data: unknown, option: QueryOption<T, "take">) => this.take(data, option)
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