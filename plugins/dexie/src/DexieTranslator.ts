import { IQuery, JsonTranslator, QueryOption } from "@routier/core/plugins";

export class DexieTranslator<TRoot extends {}, TShape> extends JsonTranslator<TRoot, TShape> {

    readonly pushedDown = {
        sort: false,
        skip: false,
        take: false,
        distinct: false,
    };

    constructor(query: IQuery<TRoot, TShape>) {
        super(query);
    }

    override filter<TResult>(data: unknown, _: QueryOption<TShape, "filter">): TResult {
        return data as TResult;
    }

    override sort<TResult>(data: unknown, option: QueryOption<TShape, "sort">): TResult {
        if (this.pushedDown.sort) {
            return data as TResult;
        }

        return super.sort(data, option);
    }

    override skip<TResult>(data: unknown, option: QueryOption<TShape, "skip">): TResult {
        if (this.pushedDown.skip && option.target === "database") {
            return data as TResult;
        }

        return super.skip(data, option);
    }

    override take<TResult>(data: unknown, option: QueryOption<TShape, "take">): TResult {
        if (this.pushedDown.take && option.target === "database") {
            return data as TResult;
        }

        return super.take(data, option);
    }

    override distinct<TResult>(data: unknown, option: QueryOption<TShape, "distinct">): TResult {
        if (this.pushedDown.distinct) {
            return data as TResult;
        }

        return super.distinct(data, option);
    }
}
