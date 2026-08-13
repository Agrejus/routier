import { QueryOption, QueryOptionName } from "../query/types";
import { IQuery } from "../types";
import { TranslatedArrayValue } from "./TranslatedArrayValue";
import { TranslatedGroupValue } from "./TranslatedGroupValue";
import { TranslatedSingleValue } from "./TranslatedSingleValue";
import { ITranslatedValue } from "./types";

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
        take: (data: unknown, option: QueryOption<TShape, "take">) => this.take(data, option),
        group: (data: unknown, option: QueryOption<TShape, "group">) => this.group(data, option),
        nearest: (data: unknown, option: QueryOption<TShape, "nearest">) => this.nearest(data, option),
        join: (data: unknown, option: QueryOption<TShape, "join">) => this.join(data, option)
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
    abstract group(data: unknown, option: QueryOption<TShape, "group">): TShape;
    /**
     * Abstract on purpose, unlike the pass-throughs a storage translator can usually inherit.
     *
     * Every other shaper degrades safely when a backend ignores it — an unsorted result is
     * still the right rows. A similarity search is not: it is the only option whose value is
     * ENTIRELY in the ordering and the limit, so a translator that quietly passes the data
     * through returns every row in insertion order and calls it the ten nearest.
     *
     * Requiring an answer here means a new translator cannot be written without deciding
     * whether its backend performed the search, and the compiler asks the question.
     */
    abstract nearest(data: unknown, option: QueryOption<TShape, "nearest">): TShape;

    /**
     * Abstract for the same reason as `nearest`, one step further.
     *
     * A translator that quietly passed a join through would not return an unsorted or unlimited
     * result — it would return the OUTER rows, one object each where the contract says tuples,
     * and every `([outer, inner]) => ...` lambda downstream would destructure the outer entity
     * instead. Nothing errors; the answer is simply a different query's answer.
     *
     * So the compiler asks the question. Every translator must state how its backend joins:
     * natively (pass through the rows the SQL already paired), in memory (the shared hash join
     * over rows the plugin supplies), or not at all (throw, loudly, naming the backend).
     *
     * The output contract, whichever answer: an array of `[outer, inner]` tuples, each half
     * fully deserialized into its OWN schema's entity shape.
     */
    abstract join(data: unknown, option: QueryOption<TShape, "join">): TShape;

    translate(data: unknown): ITranslatedValue<TShape> {

        const isTransformed = this.query.options.hasTransformations();

        this.query.options.forEach(item => {
            data = this.functionMap[item.name](data, item);
        });

        if (Array.isArray(data)) {
            return new TranslatedArrayValue<TShape>(data, isTransformed);
        }

        if (this.query.options.has("group")) {
            return new TranslatedGroupValue<TShape>(data, isTransformed);
        }

        return new TranslatedSingleValue<TShape>(data, isTransformed);
    }
}