import { QueryOption } from "../query/types";
import { DataTranslator } from "./DataTranslator";

export class SqlTranslator<TRoot extends {}, TShape> extends DataTranslator<TRoot, TShape> {

    count<TResult extends number>(data: unknown, _: QueryOption<TShape, "count">): TResult {
        return data as TResult;
    }

    min<TResult extends string | number | Date>(data: unknown, _: QueryOption<TShape, "min">): TResult {
        return data as TResult;
    }

    max<TResult extends string | number | Date>(data: unknown, _: QueryOption<TShape, "max">): TResult {
        return data as TResult;
    }

    sum<TResult extends number>(data: unknown, _: QueryOption<TShape, "sum">): TResult {
        return data as TResult;
    }

    distinct<TResult>(data: unknown, _: QueryOption<TShape, "distinct">): TResult {
        return data as TResult;
    }

    filter<TResult>(data: unknown, _: QueryOption<TShape, "filter">): TResult {
        return data as TResult;
    }

    skip(data: unknown, _: QueryOption<TShape, "skip">): TShape {
        return data as TShape;
    }

    take(data: unknown, _: QueryOption<TShape, "take">): TShape {
        return data as TShape;
    }

    sort(data: unknown, _: QueryOption<TShape, "sort">): TShape {
        return data as TShape;
    }

    map(data: unknown, _: QueryOption<TShape, "map">): TShape {
        return data as TShape;
    }
}