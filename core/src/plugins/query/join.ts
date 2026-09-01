import { CompiledSchemaCore, InferType, PropertyInfo } from "../../schema";
import { ComparatorExpression, Expression, ParamsFilter, PropertyExpression, ValueExpression } from "../../expressions";
import { UnknownRecord } from "../../utilities";
import { PluginEventCallbackResult, PluginEventResult } from "../../results";
import type { DbPluginQueryEvent } from "../types";
import type { ITranslatedValue } from "../translators/types";
import { TranslatedArrayValue } from "../translators/TranslatedArrayValue";
import { Query } from "./Query";
import { QueryOptionsCollection } from "./QueryOptionsCollection";
import { QueryOptionValueMap } from "./types";
import { ExecutedQuery } from "./explain";

export type JoinKind = "inner" | "left";

/**
 * One side's join key, as a property path plus the resolved property.
 *
 * The path is what survives serialization; the `PropertyInfo` is the live handle that reads
 * the value and resolves a `from`-renamed storage name. Both, because a key read has to work
 * on either side of the wire.
 */
export type JoinKeyReference = {
    propertyName: string;
    property: PropertyInfo<any> | null;
};

export type JoinQueryOptionValue = QueryOptionValueMap<any>["join"];

/**
 * The inner side of a join, as the PLUGIN sees it.
 *
 * Supplied by the plugin rather than fetched by the translator, because loading rows is the one
 * part of a join that is backend-specific: a memory plugin resolves a collection, Dexie opens a
 * store, Mongo reads a collection. Everything after that — deserializing, applying the inner
 * scopes, pairing — is identical, so it lives here and runs once.
 *
 * Rows arrive in STORAGE shape, exactly as the plugin holds them; the translator deserializes
 * them with `innerSchema`, which the outer query's own deserialization would never do.
 */
export type JoinInnerSide = {
    innerSchema: CompiledSchemaCore<any>;
    innerRows: readonly unknown[];
};

/**
 * `undefined` when the query has no join at all, which is the common case and not an error.
 */
export type JoinInnerSideResult =
    | { ok: "success"; innerSide?: JoinInnerSide }
    | { ok: "error"; error: unknown };

/**
 * A joined pair, each half fully deserialized into its own schema's ENTITY shape.
 *
 * The wire contract for every interpretation of a join: a native SQL join, an in-plugin hash
 * join, and the datastore's cross-plugin join all produce exactly this. Flat combined rows
 * never leave a translator — see `specs/joins.md`.
 */
export type JoinTuple = [UnknownRecord, UnknownRecord | undefined];

/**
 * Turns storage-shape records into entity-shape values, one side of a join at a time.
 *
 * The inner side does NOT pass through the outer query's normal deserialization —
 * `DatabaseDataAccessStrategy.query` transforms against the outer schema only — so each side
 * is deserialized with its own schema here, which is what makes the two halves of a tuple
 * readable by the same property names the caller wrote in the selectors.
 *
 * `"diff"` rather than `"proxy"`: join results are read-only projections and never attach to
 * the change tracker, so there is nothing for a tracking proxy to record.
 */
export const toEntityShape = (schema: CompiledSchemaCore<any>, rows: readonly unknown[]): UnknownRecord[] => {
    const result: UnknownRecord[] = Array.from({ length: rows.length });

    for (let i = 0, length = rows.length; i < length; i++) {
        result[i] = schema.postprocess(rows[i] as InferType<any>, "diff") as UnknownRecord;
    }

    return result;
};

/**
 * Reads a join key off an entity-shape row.
 *
 * Through the `PropertyInfo` when there is one, so a nested path (`a.b.id`) resolves the same
 * way every other option resolves it. The string fallback exists for an option that crossed a
 * wire without its schema; it walks the same path by name.
 */
export const readJoinKey = (row: UnknownRecord | undefined, reference: JoinKeyReference): unknown => {
    if (row == null) {
        return null;
    }

    if (reference.property != null) {
        return reference.property.getValue(row);
    }

    const path = reference.propertyName.split(".");
    let current: unknown = row;

    for (let i = 0, length = path.length; i < length; i++) {
        if (current == null) {
            return null;
        }

        current = (current as UnknownRecord)[path[i]];
    }

    return current;
};

/**
 * Whether a key value can participate in a match at all.
 *
 * `null`/`undefined` never match anything (semantics table in `specs/joins.md`), and `NaN` is
 * excluded for a subtler reason: a `Map` compares keys by SameValueZero, under which `NaN`
 * equals itself, while the specified comparison is strict `===`, under which it does not. A
 * `NaN` key that matched here would be the one value where the in-memory hash join and a SQL
 * join disagree.
 */
const isMatchableKey = (value: unknown): boolean => {
    if (value == null) {
        return false;
    }

    return typeof value !== "number" || Number.isNaN(value) === false;
};

/**
 * Applies an inner side's own filters to its rows.
 *
 * **This is the correctness trap of the whole feature.** Every interpretation of a join
 * bypasses the inner collection's normal datastore read path, so the inner side's soft-delete
 * scope and `.scope()` filters exist ONLY because `innerOptions` carries them. An interpreter
 * that skips this returns soft-deleted rows.
 *
 * Filters only. Nothing else reaches `innerOptions` today — scopes are filters — and applying
 * a `skip`/`take` recorded against the inner collection to the rows feeding a join would
 * change which pairs exist rather than which rows are visible.
 */
export const applyInnerOptions = (rows: UnknownRecord[], innerOptions: QueryOptionsCollection<any>): UnknownRecord[] => {
    let filtered = rows;

    for (const { option } of innerOptions.get("filter")) {
        const { filter, params } = option.value;

        if (filter == null) {
            continue;
        }

        if (params == null) {
            filtered = filtered.filter(filter as (row: unknown) => boolean);
            continue;
        }

        const selector = filter as ParamsFilter<unknown, {}>;
        filtered = filtered.filter(row => selector([row, params]));
    }

    return filtered;
};

/**
 * The join itself: one hash join, written once, called from every interpreter.
 *
 * O(n + m) rather than a nested loop, which is the whole reason the API takes explicit key
 * selectors instead of a free-form predicate. Both key properties are `string` or `number` by
 * a build-time rule, so the keys are hashable and compare the same way in JS and in SQL.
 *
 * Semantics, exactly as `specs/joins.md` states them:
 *
 *  - **Null keys** never match. Under `left` the outer row still appears, paired with
 *    `undefined`.
 *  - **Duplicates** produce every pair: the full cross product per key group.
 *  - **Ordering** is outer order, then inner order within a key group. Undefined by contract —
 *    a caller who cares sorts.
 */
export const hashJoin = (options: {
    kind: JoinKind;
    outerRows: UnknownRecord[];
    innerRows: UnknownRecord[];
    outerKey: JoinKeyReference;
    innerKey: JoinKeyReference;
}): JoinTuple[] => {
    const { kind, outerRows, innerRows, outerKey, innerKey } = options;
    const isLeft = kind === "left";

    const buckets = new Map<unknown, UnknownRecord[]>();

    for (let i = 0, length = innerRows.length; i < length; i++) {
        const row = innerRows[i];
        const key = readJoinKey(row, innerKey);

        if (isMatchableKey(key) === false) {
            continue;
        }

        const bucket = buckets.get(key);

        if (bucket == null) {
            buckets.set(key, [row]);
            continue;
        }

        bucket.push(row);
    }

    const tuples: JoinTuple[] = [];

    for (let i = 0, length = outerRows.length; i < length; i++) {
        const outer = outerRows[i];
        const key = readJoinKey(outer, outerKey);
        const matches = isMatchableKey(key) ? buckets.get(key) : undefined;

        if (matches == null) {
            if (isLeft) {
                tuples.push([outer, undefined]);
            }

            continue;
        }

        for (let j = 0, matchLength = matches.length; j < matchLength; j++) {
            tuples.push([outer, matches[j]]);
        }
    }

    return tuples;
};

/**
 * How many distinct outer keys are still worth turning into an `IN (...)` prefilter.
 *
 * A cost decision, never a correctness one: above the threshold the inner side is read under its
 * own scopes and the hash join discards the surplus, which is the same answer by a slower route.
 * 500 because a bound-parameter list is cheap in the hundreds and starts costing more than the
 * scan it saves in the thousands — and some engines refuse a list that long outright.
 */
export const DEFAULT_SEMI_JOIN_KEY_THRESHOLD = 500;

/**
 * The distinct join keys of the outer rows, or `null` when there are too many to be worth sending.
 *
 * `null` means "do not prefilter", not "no keys" — an empty SET is a real answer meaning the inner
 * side cannot match anything.
 *
 * @param column The key's STORAGE column name when `rows` are storage-shaped, or its property name
 * when they are entity-shaped. The caller knows which it holds.
 */
export const distinctJoinKeys = (
    rows: readonly UnknownRecord[],
    reference: JoinKeyReference,
    threshold: number = DEFAULT_SEMI_JOIN_KEY_THRESHOLD,
    options?: { storageShape?: boolean }
): Set<unknown> | null => {
    const keys = new Set<unknown>();

    const read = options?.storageShape === true
        ? (row: UnknownRecord) => row[reference.property?.getResolvedName() ?? reference.propertyName]
        : (row: UnknownRecord) => readJoinKey(row, reference);

    for (const row of rows) {
        const key = read(row);

        // A null key matches nothing, so it never belongs in the prefilter — and including it
        // would widen the inner read to rows that cannot pair.
        if (isMatchableKey(key) === false) {
            continue;
        }

        keys.add(key);

        if (keys.size > threshold) {
            return null;
        }
    }

    return keys;
};

/**
 * A filter restricting the inner side to rows whose key is one the outer side actually has.
 *
 * Built as an expression tree by hand rather than parsed from generated source, for the reason
 * `softDeleteScope` gives: generating source needs `new Function`, which a Content-Security-Policy
 * blocks, and the shape is known here so there is nothing to parse. An `includes` comparator over
 * an array value is what every translator already turns into `IN (...)` or `$in`, so this pushes
 * down on the backends that can take it and runs as the closure on the ones that cannot.
 *
 * Cost only. Every pair it removes from the inner read is one the hash join would have discarded.
 */
export const semiJoinFilter = (
    reference: JoinKeyReference,
    keys: ReadonlySet<unknown>
): QueryOptionValueMap<any>["filter"] => {
    const values = [...keys];
    const propertyName = reference.propertyName;

    const expression = reference.property == null
        ? Expression.NOT_PARSABLE
        : new ComparatorExpression({
            comparator: "includes",
            negated: false,
            strict: true,
            left: new ValueExpression({ value: values }),
            right: new PropertyExpression({ property: reference.property }),
        });

    // Read through the PropertyInfo when there is one so a nested path resolves; the Set is closed
    // over rather than rebuilt per row.
    const read = reference.property != null
        ? (row: UnknownRecord) => reference.property!.getValue(row)
        : (row: UnknownRecord) => readJoinKey(row, { propertyName, property: null });

    return {
        filter: ((row: UnknownRecord) => keys.has(read(row))) as never,
        expression,
        params: undefined
    };
};

/**
 * Loads a join's inner side by asking the plugin to run an ORDINARY query for it.
 *
 * The generic way for a plugin to interpret a join — one call, no join-specific reading code.
 * The inner side is just "this collection, under these filters", which is a query every plugin
 * already knows how to answer, through whatever indexes and scoping it normally applies.
 *
 * Only the DATABASE half of `innerOptions` is sent. The memory half would mean nothing to the
 * plugin, and `executeJoin` re-applies every filter regardless — filters are pure, so the second
 * pass costs a walk over the survivors and guarantees the inner scopes are honoured even if the
 * plugin silently ignored them.
 *
 * The inner query carries no `join` option of its own, so this cannot recurse.
 *
 * @param query How this plugin runs a query. **Not necessarily `plugin.query`**: a plugin that
 * serializes queries through a work queue must pass its UN-QUEUED path, or this call waits behind
 * the outer query that is still holding the queue and the plugin deadlocks.
 */
export const loadJoinInnerSide = <TRoot extends {}, TShape>(
    event: DbPluginQueryEvent<TRoot, TShape>,
    query: (innerEvent: DbPluginQueryEvent<UnknownRecord, UnknownRecord>, done: PluginEventCallbackResult<ITranslatedValue<UnknownRecord>>) => void,
    done: (result: JoinInnerSideResult) => void,
    /**
     * The outer side's distinct keys, when the caller already has them.
     *
     * Only a plugin that runs its outer query FIRST can supply these, and most run this loader
     * before anything else — so it is optional, and its absence costs a wider inner read rather
     * than a wrong one.
     */
    outerKeys?: ReadonlySet<unknown> | null,
    /** Where the inner read reports what it executed. Defaults to the outer read's own list. */
    innerExecutedQueries?: ExecutedQuery[]
): void => {

    const joinOption = event.operation.options.getLast("join");

    if (joinOption == null) {
        done({ ok: "success" });
        return;
    }

    const innerSchema = event.schemas.get(joinOption.value.innerSchemaId);

    if (innerSchema == null) {
        done({
            ok: "error",
            error: new Error(`Cannot join: the inner collection's schema is not registered in this store.  SchemaId: ${joinOption.value.innerSchemaId}`)
        });
        return;
    }

    const innerOptions = joinOption.value.innerOptions.split().database;

    if (outerKeys != null) {
        innerOptions.add("filter", semiJoinFilter(joinOption.value.innerKey, outerKeys));
    }

    const innerEvent: DbPluginQueryEvent<UnknownRecord, UnknownRecord> = {
        operation: new Query(innerOptions, innerSchema) as unknown as DbPluginQueryEvent<UnknownRecord, UnknownRecord>["operation"],
        schemas: event.schemas,
        id: `${event.id}-inner`,
        source: event.source,
        action: "query",
        reason: "join inner side",
        explain: event.explain,
        // The caller decides where the inner read reports, because only it knows whether the inner
        // side is the SAME plugin — where both reads belong in one explanation — or a different one,
        // where a PouchDB scan filed under SqliteDbPlugin is a lie.
        executedQueries: innerExecutedQueries ?? event.executedQueries
    };

    query(innerEvent, result => {
        if (result.ok === PluginEventResult.ERROR) {
            done({ ok: "error", error: result.error });
            return;
        }

        done({ ok: "success", innerSide: { innerSchema, innerRows: result.data.value as unknown as unknown[] } });
    });
};

/**
 * Interprets a join by running TWO ordinary queries through the plugin's own read path.
 *
 * The whole of interpretation 2 for a plugin that has no reason to do anything cleverer, and the
 * shape every non-SQL backend should prefer:
 *
 * ```ts
 * query(event, done) {
 *     if (event.operation.options.has("join")) {
 *         joinInPlugin(event, (e, d) => this.query(e, d), done);
 *         return;
 *     }
 *     // ...the ordinary single-collection path
 * }
 * ```
 *
 * **The outer side runs FIRST, and that ordering is the optimization.** Its keys are what narrow
 * the inner read to rows that can actually pair — and they do not exist until the outer filters
 * have run. Loading the inner side first, which is what a naive implementation does, means reading
 * and materializing a whole collection to pair it with three rows.
 *
 * Neither query carries the join option, so both take the plugin's normal path: its indexes, its
 * pushdown decisions, its retries. Nothing recurses, because the option is stripped before either
 * goes out.
 *
 * @param query How this plugin runs a query. NOT necessarily `plugin.query` — a plugin that
 * serializes queries through a work queue must pass its UN-QUEUED path, or the two reads below
 * wait on the slot this one is holding.
 */
export const joinInPlugin = <TRoot extends {}, TShape>(
    event: DbPluginQueryEvent<TRoot, TShape>,
    query: (innerEvent: DbPluginQueryEvent<UnknownRecord, UnknownRecord>, done: PluginEventCallbackResult<ITranslatedValue<UnknownRecord>>) => void,
    done: PluginEventCallbackResult<ITranslatedValue<TShape>>
): void => {

    const { before, at } = event.operation.options.splitAt("join");

    if (at == null) {
        done(PluginEventResult.error(event.id, new Error("joinInPlugin was called for a query with no join option.")));
        return;
    }

    const innerSchema = event.schemas.get(at.value.innerSchemaId);

    if (innerSchema == null) {
        done(PluginEventResult.error(event.id, new Error(
            `Cannot join: the inner collection's schema is not registered in this store.  SchemaId: ${at.value.innerSchemaId}`
        )));
        return;
    }

    /**
     * The outer side, as the ordinary query it would have been without the join.
     *
     * `before` is everything recorded ahead of the join — the outer filters, and any sort or
     * window. Those belong to the outer ROWS, and running them here rather than around a joined
     * result is what makes `.take(2).join(...)` pair the first two rows on every backend.
     */
    const outerEvent = {
        ...event,
        id: `${event.id}-outer`,
        reason: "join outer side",
        operation: new Query(before, event.operation.schema)
    } as unknown as DbPluginQueryEvent<UnknownRecord, UnknownRecord>;

    query(outerEvent, outerResult => {
        try {
            if (outerResult.ok === PluginEventResult.ERROR) {
                done(PluginEventResult.error(event.id, outerResult.error));
                return;
            }

            const outerRows = (outerResult.data.value ?? []) as unknown as UnknownRecord[];

            if (at.reason !== "executed") {
                // The outer read reported something, so the database phase stopped before the join.
                // The datastore's own join branch pairs these rows.
                done(PluginEventResult.success(event.id, new TranslatedArrayValue<TShape>(outerRows as never[], false)));
                return;
            }

            // Storage shape: the plugin returns rows as it holds them, and deserialization is what
            // `executeJoin` does per side below.
            const outerKeys = distinctJoinKeys(outerRows, at.value.outerKey, at.value.semiJoinKeyThreshold, { storageShape: true });

            loadJoinInnerSide(event, query, innerResult => {
                try {
                    if (innerResult.ok === "error") {
                        done(PluginEventResult.error(event.id, innerResult.error));
                        return;
                    }

                    const tuples = executeJoin({
                        option: at.value,
                        outerRows: toEntityShape(event.operation.schema, outerRows),
                        innerRows: toEntityShape(innerSchema, innerResult.innerSide?.innerRows ?? [])
                    });

                    // Nothing else can be in the database half — everything after a join ratchets
                    // to memory — so these tuples are the whole of this plugin's answer.
                    done(PluginEventResult.success(event.id, new TranslatedArrayValue<TShape>(tuples as never[], false)));
                } catch (e) {
                    done(PluginEventResult.error(event.id, e));
                }
            }, outerKeys);
        } catch (e) {
            done(PluginEventResult.error(event.id, e));
        }
    });
};

/**
 * A join over rows both sides have already deserialized, with the inner side's scopes applied.
 *
 * The one entry point every interpreter uses: `JsonTranslator.join` inside a plugin, and the
 * datastore's own memory half for a cross-plugin join. Callers hand over ENTITY-shape rows —
 * `toEntityShape` is separate because a caller may already have paid for it.
 */
export const executeJoin = (options: {
    option: JoinQueryOptionValue;
    outerRows: UnknownRecord[];
    innerRows: UnknownRecord[];
}): JoinTuple[] => {
    const { option, outerRows, innerRows } = options;

    return hashJoin({
        kind: option.kind,
        outerRows,
        innerRows: applyInnerOptions(innerRows, option.innerOptions),
        outerKey: option.outerKey,
        innerKey: option.innerKey
    });
};
