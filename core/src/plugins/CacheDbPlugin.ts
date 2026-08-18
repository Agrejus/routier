import { BulkPersistResult } from "../collections";
import { SchemaId } from "../schema";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from "../results";
import { ITranslatedValue } from "./translators";
import { QueryOption, QueryOptionName } from "./query";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin } from "./types";

/**
 * A read-through LRU in front of a slower plugin.
 *
 * ## What it can and cannot promise
 *
 * Invalidation is the whole problem with a cache, and this one solves exactly one version of
 * it: **writes that go through this wrapper**. A save invalidates every cached read for the
 * schemas it touched, so a store that reads and writes through the same instance never sees
 * its own stale data.
 *
 * It cannot see anything else. A write by another process, another tab, or another store over
 * the same database leaves this cache holding rows that no longer exist, until they age out.
 * That is not a defect to fix later — a cache in front of a plugin has no way to learn about a
 * change it did not make — it is the condition for using this at all. Put it in front of data
 * that is slow to fetch and tolerant of being briefly wrong, and nowhere else.
 *
 * Invalidation is per SCHEMA rather than per row, deliberately. Deciding whether a changed row
 * would have matched a cached filter means evaluating every cached query against it, which is
 * the work the cache exists to avoid, and getting it wrong keeps a stale row visible. Dropping
 * a schema's entries is cheap and cannot be subtly wrong.
 *
 * ```ts
 * const store = new MyStore(new CacheDbPlugin(new SomeDbPlugin(...), { max: 100 }));
 * ```
 */

export type CacheDbPluginOptions = {
    /** How many query results to keep. Default 100; the least recently used is evicted. */
    max?: number;
};

type CacheEntry = {
    readonly value: unknown;
    readonly isTransformed: boolean;
    /** The concrete translated-value class, so a hit rebuilds the same shape. */
    readonly construct: new (value: unknown, isTransformed: boolean) => ITranslatedValue<unknown>;
};

/**
 * A stable string for one query.
 *
 * Built from the option VALUES rather than by serialising the expression tree, which holds
 * `PropertyInfo` objects carrying functions and would not survive `JSON.stringify`. A filter is
 * identified by its source text plus its params, which is what the expression is derived from
 * anyway — two queries with the same source and params are the same query.
 */
const describeOption = (option: QueryOption<unknown, QueryOptionName>): string => {
    const value = option.value as Record<string, unknown>;

    switch (option.name) {
        case "filter":
            return `${String(value.filter)}|${JSON.stringify(value.params ?? null)}`;
        case "sort":
            return `${String(value.propertyName)}|${String(value.direction)}`;
        case "nearest":
            return `${String(value.propertyName)}|${(value.vector as number[]).join(",")}|${String(value.count)}`;
        case "map":
        case "group":
            return String(value.selector);
        default:
            // skip, take and the aggregates are plain values.
            return JSON.stringify(option.value ?? null);
    }
};

export class CacheDbPlugin implements IDbPlugin {

    private readonly plugin: IDbPlugin;
    private readonly max: number;
    /**
     * Insertion-ordered, which is what makes this an LRU without a second structure: a hit
     * deletes and re-sets the key to move it to the end, so the oldest is always first.
     */
    private readonly entries = new Map<string, CacheEntry>();

    constructor(plugin: IDbPlugin, options: CacheDbPluginOptions = {}) {
        this.plugin = plugin;
        this.max = Math.max(1, options.max ?? 100);
    }

    get databaseName(): string {
        return this.plugin.databaseName;
    }

    /** `schemaId` first, so invalidating a schema is a prefix match. */
    private keyFor<TRoot extends {}, TShape>(event: DbPluginQueryEvent<TRoot, TShape>): string {
        const parts: string[] = [];

        event.operation.options.forEach(option => {
            parts.push(`${option.name}:${describeOption(option as QueryOption<unknown, QueryOptionName>)}`);
        });

        return `${String(event.operation.schema.id)}\u0000${parts.join("\u0001")}`;
    }

    /**
     * A fresh translated value over a copy of the cached data.
     *
     * Never the cached object itself, and never its array. `TranslatedArrayValue.forEach`
     * REASSIGNS its own slots — that is how the change tracker swaps in attached entities —
     * so handing out the cached instance would let the first caller replace the cache's
     * contents with its own tracked proxies. The second caller would then receive entities
     * attached to somebody else's store.
     *
     * It protects a second thing that is easy to miss, so do not replace it with a shallow copy
     * or hand out the entry directly. `ConcurrencyDbPlugin` strips `__version` from result rows
     * IN PLACE after observing them. Stacked as `ConcurrencyDbPlugin(CacheDbPlugin(...))` the
     * strip therefore lands on this copy, and the cached row keeps its token — without that,
     * every hit after the first would carry no version, the observer would record nothing, and
     * the next update would be written UNCHECKED with no error anywhere.
     * Pinned by `datastore/src/collections/wrapperStacking.test.ts`.
     */
    private rebuild(entry: CacheEntry): ITranslatedValue<unknown> {
        return new entry.construct(structuredClone(entry.value), entry.isTransformed);
    }

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        const key = this.keyFor(event);
        const cached = this.entries.get(key);

        if (cached != null) {
            // Re-set to move it to the end of the insertion order: most recently used.
            this.entries.delete(key);
            this.entries.set(key, cached);

            // Said rather than left blank. A hit means no database was touched, which is a fact
            // worth reporting — and an empty report would otherwise read as a plugin that failed
            // to say what it ran.
            event.executedQueries.push({ text: "cache hit — no query was executed" });

            done(PluginEventResult.success(event.id, this.rebuild(cached) as ITranslatedValue<TShape>));
            return;
        }

        this.plugin.query<TRoot, TShape>(event, result => {

            if (result.ok === PluginEventResult.ERROR) {
                done(result);
                return;
            }

            this.store(key, result.data);

            // The caller gets a rebuilt value too, not the one just stored, so that mutating
            // the result of a MISS cannot corrupt what the next hit returns.
            const stored = this.entries.get(key);

            done(PluginEventResult.success(
                event.id,
                (stored == null ? result.data : this.rebuild(stored)) as ITranslatedValue<TShape>
            ));
        });
    }

    private store(key: string, value: ITranslatedValue<unknown>): void {
        let snapshot: unknown;

        try {
            snapshot = structuredClone(value.value);
        } catch {
            // Not every result is structured-cloneable — a projection can carry anything a
            // caller's `.map()` returned, including a function. Declining to cache is the
            // only safe answer; caching a reference would share mutable state.
            return;
        }

        this.entries.set(key, {
            value: snapshot,
            isTransformed: value.isTransformed,
            construct: value.constructor as CacheEntry["construct"],
        });

        if (this.entries.size > this.max) {
            // First key is the least recently used, because every hit re-inserts.
            const oldest = this.entries.keys().next();

            if (oldest.done === false) {
                this.entries.delete(oldest.value);
            }
        }
    }

    /** Drops every cached read for these schemas. */
    private invalidate(schemaIds: Iterable<SchemaId>): void {
        for (const schemaId of schemaIds) {
            const prefix = `${String(schemaId)}\u0000`;

            for (const key of [...this.entries.keys()]) {
                if (key.startsWith(prefix)) {
                    this.entries.delete(key);
                }
            }
        }
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {
        const touched = [...event.operation.keys()];

        // Invalidated BEFORE the write is attempted, not after it succeeds. A failed save can
        // still have applied part of itself on a backend without atomic batches, and a cache
        // that kept its entries because the call reported an error would then serve rows that
        // are wrong. Throwing away a still-valid cache costs one refetch; keeping an invalid
        // one is silent.
        this.invalidate(touched);

        this.plugin.bulkPersist(event, result => {
            this.invalidate(touched);
            done(result);
        });
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.entries.clear();
        this.plugin.destroy(event, done);
    }
}
