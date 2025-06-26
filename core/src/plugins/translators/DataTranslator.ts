import { QueryOption, QueryOptionName } from "../query/types";
import { IQuery } from "../types";

export abstract class DataTranslator<TRoot extends {}, TShape> {

    protected query: IQuery<TRoot, TShape>;
    private functionMap: Record<QueryOptionName, (data: unknown, option: QueryOption<any, any>) => TShape> = {
        count: (data: unknown, option: QueryOption<TShape, "count">) => this.count<any>(data, option),
        distinct: (data: unknown, option: QueryOption<TShape, "distinct">) => this.distinct(data, option),
        filter: (data: unknown, option: QueryOption<TShape, "filter">) => this.filter(data, option),
        map: (data: unknown, option: QueryOption<TShape, "map">) => this.map(data, option),
        max: (data: unknown, option: QueryOption<TShape, "max">) => this.max<any>(data, option),
        min: (data: unknown, option: QueryOption<TShape, "min">) => this.min<any>(data, option),
        skip: (data: unknown, option: QueryOption<TShape, "skip">) => this.skip(data, option),
        sort: (data: unknown, option: QueryOption<TShape, "sort">) => this.sort(data, option),
        sum: (data: unknown, option: QueryOption<TShape, "sum">) => this.sum<any>(data, option),
        take: (data: unknown, option: QueryOption<TShape, "take">) => this.take(data, option)
    };

    constructor(query: IQuery<TRoot, TShape>) {
        this.query = query;
    }

    // Terminators
    abstract count<TResult extends number>(data: unknown, option: QueryOption<TShape, "count">): TResult;
    abstract min<TResult extends string | number | Date>(data: unknown, option: QueryOption<TShape, "min">): TResult;
    abstract max<TResult extends string | number | Date>(data: unknown, option: QueryOption<TShape, "max">): TResult;
    abstract sum<TResult extends number>(data: unknown, option: QueryOption<TShape, "sum">): TResult;
    abstract distinct<TResult>(data: unknown, option: QueryOption<TShape, "distinct">): TResult;

    // Shapers
    abstract filter<TResult>(data: unknown, option: QueryOption<TShape, "filter">): TResult;
    abstract skip(data: unknown, option: QueryOption<TShape, "skip">): TShape;
    abstract take(data: unknown, option: QueryOption<TShape, "take">): TShape;
    abstract sort(data: unknown, option: QueryOption<TShape, "sort">): TShape;
    abstract map(data: unknown, option: QueryOption<TShape, "map">): TShape;

    translate(data: unknown): TShape {

        this.query.options.forEach(item => {
            data = this.functionMap[item.name](data, item);
        });

        return data as TShape;
    }
}