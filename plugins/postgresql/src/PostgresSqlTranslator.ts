import { QueryOption, SqlTranslator } from '@routier/core/plugins';

/**
 * `SqlTranslator` with the `pg` driver's quirks applied.
 *
 * `node-postgres` returns `COUNT(*)` as a **string**, because PostgreSQL's `count` is
 * `bigint` and a 64-bit integer does not fit a JS number safely — so the driver refuses to
 * guess and hands back the text. Every other supported driver returns a number.
 *
 * That is a fact about this driver, not about SQL and certainly not about Routier's data
 * model, so the coercion lives here rather than in `@routier/core`. It briefly did live in
 * core's `SqlTranslator.count`, which is exactly how engine-specific knowledge leaks into a
 * storage-agnostic package: not by decision, but one bug fix at a time.
 */
export class PostgresSqlTranslator<TRoot extends {}, TShape> extends SqlTranslator<TRoot, TShape> {

    override count<TResult extends number>(data: unknown, option: QueryOption<TShape, "count">): TResult {
        const value = super.count(data, option);

        // Number() rather than parseInt: a count larger than Number.MAX_SAFE_INTEGER should
        // surface as an imprecise number the same way any other oversized value would,
        // rather than being silently truncated at the first non-digit.
        return (typeof value === "string" ? Number(value) : value) as TResult;
    }
}
