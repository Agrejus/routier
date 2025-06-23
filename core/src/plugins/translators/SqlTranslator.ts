import { QueryOption } from "../query/types";
import { DataTranslator } from "./DataTranslator";

export class SqlTranslator<TEntity extends {}, TShape> extends DataTranslator<TEntity, TShape> {

    count<TResult extends number>(data: unknown, _: QueryOption<TEntity, "count">): TResult {
        return data as TResult;
    }

    min<TResult extends string | number | Date>(data: unknown, _: QueryOption<TEntity, "min">): TResult {
        return data as TResult;
    }

    max<TResult extends string | number | Date>(data: unknown, _: QueryOption<TEntity, "max">): TResult {
        return data as TResult;
    }

    sum<TResult extends number>(data: unknown, _: QueryOption<TEntity, "sum">): TResult {
        return data as TResult;
    }

    distinct<TResult>(data: unknown, _: QueryOption<TEntity, "distinct">): TResult {
        return data as TResult;
    }

    filter<TResult>(data: unknown, _: QueryOption<TEntity, "filter">): TResult {
        return data as TResult;
    }

    skip(data: unknown, _: QueryOption<TEntity, "skip">): TEntity {
        return data as TEntity;
    }

    take(data: unknown, _: QueryOption<TEntity, "take">): TEntity {
        return data as TEntity;
    }

    sort(data: unknown, _: QueryOption<TEntity, "sort">): TEntity {
        return data as TEntity;
    }

    map(data: unknown, _: QueryOption<TEntity, "map">): TEntity {
        return data as TEntity;
    }
}