import { DataTranslator } from "./DataTranslator";
import { QueryOption } from "../query/types";
import { assertIsArray } from "../../assertions";
import { ParamsFilter } from "../../expressions";

/**
 * The memory half's pass over JOIN TUPLES.
 *
 * `JsonTranslator` cannot do this job, and the reason is one line of it: `map` and `group` walk
 * `option.value.fields` and deserialize each field through its `PropertyInfo`. A tuple has no
 * schema and no fields — `getFields` over `([p, m]) => ({ ... })` extracts nothing meaningful —
 * so that loop would either no-op or write properties onto a two-element array.
 *
 * Everything a join query is allowed to do after the join is expressible as a plain closure
 * over the tuple, and that is all this does. The lambdas the caller wrote (`([p, m]) => ...`)
 * are applied as-is, which is also why the result is identical whichever backend produced the
 * pairs.
 *
 * Both halves are already in entity shape when the tuples arrive here (the wire contract), so
 * there is nothing left to deserialize — the reason the missing field loop costs nothing.
 *
 * The absent operations are absent by design, not by omission: `sum`/`min`/`max`/`distinct` and
 * `group` are not declared on the tuple queryable's type, so reaching them means something
 * built an option this API cannot express, and a throw naming it is the honest answer.
 */
export class TupleTranslator<TRoot extends {}, TShape> extends DataTranslator<TRoot, TShape> {

    override filter<TResult>(data: unknown, option: QueryOption<TShape, "filter">): TResult {

        assertIsArray(data);

        if (option.value.filter == null) {
            return data as TResult;
        }

        if (option.value.params == null) {
            return data.filter(option.value.filter) as TResult;
        }

        const selector = option.value.filter as ParamsFilter<unknown, {}>;
        return data.filter(tuple => selector([tuple, option.value.params])) as TResult;
    }

    override map<TResult>(data: unknown, option: QueryOption<TShape, "map">): TResult {

        assertIsArray(data, this.notAnArray("map"));

        return data.map(tuple => option.value.selector(tuple as TShape)) as TResult;
    }

    override sort<TResult>(data: unknown, option: QueryOption<TShape, "sort">): TResult {

        if (Array.isArray(data) === false) {
            return data as TResult;
        }

        const direction = option.value.direction === "asc" ? 1 : -1;

        // Relational comparison rather than subtraction, and nulls first ascending — the same
        // ordering `JsonTranslator.sort` produces, so a sort means the same thing on either
        // side of a join.
        data.sort((x, y) => {
            const a = option.value.selector(x) as any;
            const b = option.value.selector(y) as any;

            if (a === b) {
                return 0;
            }

            if (a == null) {
                return -1 * direction;
            }

            if (b == null) {
                return 1 * direction;
            }

            return (a < b ? -1 : 1) * direction;
        });

        return data as TResult;
    }

    override skip<TResult>(data: unknown, option: QueryOption<TShape, "skip">): TResult {

        if (Array.isArray(data) === false || option.value <= 0) {
            return data as TResult;
        }

        return data.slice(option.value) as TResult;
    }

    override take<TResult>(data: unknown, option: QueryOption<TShape, "take">): TResult {

        if (Array.isArray(data) === false || option.value <= 0) {
            return data as TResult;
        }

        return data.slice(0, option.value) as TResult;
    }

    override count<TResult extends number>(data: unknown, _: QueryOption<TShape, "count">): TResult {

        assertIsArray(data, this.notAnArray("count"));

        return data.length as TResult;
    }

    /**
     * Already joined by the time anything reaches here.
     *
     * The pairs were produced either by the plugin (its translator's `join`) or by the datastore
     * before this pass ran, so the option is a record of what happened rather than work to do.
     */
    override join(data: unknown, _: QueryOption<TShape, "join">): TShape {
        return data as TShape;
    }

    override group<TResult>(_: unknown, __: QueryOption<TShape, "group">): TResult {
        throw new Error(this.notSupported("toGroup"));
    }

    override sum<TResult extends number>(_: unknown, __: QueryOption<TShape, "sum">): TResult {
        throw new Error(this.notSupported("sum"));
    }

    override min<TResult extends string | number | Date>(_: unknown, __: QueryOption<TShape, "min">): TResult {
        throw new Error(this.notSupported("min"));
    }

    override max<TResult extends string | number | Date>(_: unknown, __: QueryOption<TShape, "max">): TResult {
        throw new Error(this.notSupported("max"));
    }

    override distinct<TResult>(_: unknown, __: QueryOption<TShape, "distinct">): TResult {
        throw new Error(this.notSupported("distinct"));
    }

    override nearest(_: unknown, __: QueryOption<TShape, "nearest">): TShape {
        // A similarity search BEFORE the join stays in the outer side's options and never
        // reaches a tuple. One after it would have to score a pair, which has no vector.
        throw new Error(this.notSupported("nearest"));
    }

    private notSupported(name: string) {
        return `${name}() is not available on a join result.  Project the tuples with .map() first, then run it on the projection.`;
    }

    private notAnArray(name: string) {
        return `Cannot ${name} a join result, it must be an array of tuples.`;
    }
}
