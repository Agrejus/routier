import { IQuery, QueryOption, SqlTranslator } from '@routier/core/plugins';

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

    private readonly nearestPushedDown: boolean;

    /**
     * @param nearestPushedDown Whether the statement that produced these rows carried the
     * `<=>` ordering. Supplied by the plugin because only the query builder knows: pgvector
     * may be missing, or a window may have made the pushdown unsafe.
     */
    constructor(query: IQuery<TRoot, TShape>, nearestPushedDown: boolean = false) {
        super(query);
        this.nearestPushedDown = nearestPushedDown;
    }

    /**
     * Passes through only when PostgreSQL actually did the search.
     *
     * Rescoring pushed-down rows would be wasted work but not wrong; the dangerous direction
     * is the other one, so the default is to score. `nearestPushedDown` says a `<=>` ordering
     * and its `LIMIT` are in the SQL, and nothing else may claim that.
     */
    override nearest(data: unknown, option: QueryOption<TShape, "nearest">): TShape {
        if (this.nearestPushedDown && option.target === "database") {
            return data as TShape;
        }

        return super.nearest(data, option);
    }

    override count<TResult extends number>(data: unknown, option: QueryOption<TShape, "count">): TResult {
        const value = super.count(data, option);

        // Number() rather than parseInt: a count larger than Number.MAX_SAFE_INTEGER should
        // surface as an imprecise number the same way any other oversized value would,
        // rather than being silently truncated at the first non-digit.
        return (typeof value === "string" ? Number(value) : value) as TResult;
    }
}
