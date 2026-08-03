import { IQuery, JsonTranslator, QueryOption } from "@routier/core/plugins";

type DexieTranslatorOptions = {
    useTranslatorDistinct: boolean;
    /**
     * Apply skip/take here instead of trusting Dexie's offset/limit.
     *
     * Set by the plugin when the window cannot be pushed down safely — see
     * DexiePlugin.query for the conditions.
     */
    useTranslatorSkip: boolean;
    useTranslatorTake: boolean;
}

export class DexieTranslator<TRoot extends {}, TShape> extends JsonTranslator<TRoot, TShape> {

    options: DexieTranslatorOptions;

    // some operations always need to happen here,
    // others we need to check the target and see if it
    // happened on the database or if it needs to happen in memory

    constructor(query: IQuery<TRoot, TShape>) {
        super(query);
        this.options = {
            useTranslatorDistinct: false,
            useTranslatorSkip: false,
            useTranslatorTake: false
        };
    }

    override skip<TResult>(data: unknown, option: QueryOption<TShape, "skip">): TResult {

        // The plugin could not push the window down, so it never reached Dexie.
        if (this.options.useTranslatorSkip === true) {
            return super.skip(data, option);
        }

        // Dexie will skip for us, we do not need to actually skip
        if (option.target === "database") {
            return data as TResult;
        }

        return super.skip(data, option);
    }

    override take<TResult>(data: unknown, option: QueryOption<TShape, "take">): TResult {

        // The plugin could not push the window down, so it never reached Dexie.
        if (this.options.useTranslatorTake === true) {
            return super.take(data, option);
        }

        // Dexie will take for us, we do not need to actually take
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