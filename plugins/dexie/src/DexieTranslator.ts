import { IQuery, JsonTranslator, QueryOption } from "routier-core/plugins";

type DexieTranslatorOptions = {
    useTranslatorDistinct: boolean;
}

export class DexieTranslator<TRoot extends {}, TShape> extends JsonTranslator<TRoot, TShape> {

    options: DexieTranslatorOptions;

    // some operations always need to happen here,
    // others we need to check the target and see if it
    // happened on the database or if it needs to happen in memory

    constructor(query: IQuery<TRoot, TShape>) {
        super(query);
        this.options = {
            useTranslatorDistinct: false
        };
    }

    override skip<TResult>(data: unknown, option: QueryOption<TShape, "skip">): TResult {

        // make sure we still skip if the target is not the database
        if (option.target === "database") {
            return data as TResult;
        }

        return super.skip(data, option);
    }

    override take<TResult>(data: unknown, option: QueryOption<TShape, "take">): TResult {

        // make sure we still take if the target is not the database
        if (option.target === "database") {
            return data as TResult;
        }

        return super.take(data, option);
    }

    override distinct<TResult>(data: unknown, option: QueryOption<TShape, "distinct">): TResult {

        // handle distinct in memory only if the property does not have an index
        if (this.options.useTranslatorDistinct === true) {
            return super.distinct(data, option);
        }

        // handled by dexie
        return data as TResult;
    }
}