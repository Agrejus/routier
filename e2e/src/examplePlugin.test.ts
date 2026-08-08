import { describe, expect, it } from '@jest/globals';
import { describePluginContract, describeVectorSearch } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { EphemeralDataPlugin } from '@routier/core/plugins';
import type { DbPluginEvent, IDbPlugin, DbPluginQueryEvent, DbPluginBulkPersistEvent, ITranslatedValue } from '@routier/core/plugins';
import { PluginEventResult, type PluginEventCallbackPartialResult, type PluginEventCallbackResult } from '@routier/core/results';
import type { BulkPersistResult } from '@routier/core/collections';
import { MemoryDataCollection } from '@routier/core/collections';
import { Result, type CallbackResult } from '@routier/core/results';
import type { CompiledSchema } from '@routier/core/schema';

/**
 * Two worked examples of writing a plugin, both verified rather than illustrated.
 *
 * `IDbPlugin` is three methods. What varies is how much you have to do yourself, and there are
 * two very different answers:
 *
 * 1. A backend that can hold records in memory extends `EphemeralDataPlugin` and subclasses
 *    `MemoryDataCollection` for the three persistence hooks — `load`, `save`, `destroy`.
 *    Query parsing, filtering, sorting, paging, aggregates and change echoes all come from
 *    the base class. `memory`, `file-system` and `browser-storage` are all this.
 *
 * 2. A wrapper implements `IDbPlugin` and delegates. It sees every operation on its way past
 *    and needs no knowledge of storage at all. `ConcurrencyDbPlugin`, `BlobDbPlugin` and
 *    `EncryptionDbPlugin` are all this.
 *
 * A backend for a real database — SQLite, PostgreSQL, Dexie — implements `IDbPlugin` directly
 * and translates the query into that engine's language. That is a bigger job and those plugins
 * are the examples to read.
 *
 * Both examples below run the same 62-test contract every shipped plugin runs.
 */

// ---------------------------------------------------------------------------------------
// Example 1: a backend, in about twenty lines
// ---------------------------------------------------------------------------------------

/**
 * Stores each collection as a JSON string in whatever key-value store you hand it.
 *
 * The kind of thing you would write for `localStorage`, a Chrome extension's `storage.local`,
 * a Redis hash, or a Cloudflare KV namespace. `resolveCollection` is the only method: return a
 * `MemoryDataCollection` for the schema, and persist it whenever it changes.
 */
type KeyValueStore = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
};

/** The three persistence hooks. Everything else about a collection is inherited. */
class KeyValueCollection extends MemoryDataCollection {

    constructor(private readonly store: KeyValueStore, private readonly key: string, schema: CompiledSchema<any>) {
        super(schema);
    }

    override load(done: CallbackResult<never>) {
        const saved = this.store.getItem(this.key);

        if (saved != null) {
            // `seed`, not `add`: hydrating must not clobber a record already in memory,
            // because `save` runs AFTER pending writes have been applied.
            this.seed(JSON.parse(saved) as Record<string, unknown>[]);
        }

        done(Result.success());
    }

    override save(done: CallbackResult<never>) {
        this.store.setItem(this.key, JSON.stringify(this.records));
        done(Result.success());
    }

    override destroy(done: CallbackResult<never>) {
        this.store.removeItem(this.key);
        super.destroy(done);
    }
}

class KeyValuePlugin extends EphemeralDataPlugin {

    /**
     * One instance per collection, kept.
     *
     * The base class mutates the collection in place, so handing back a fresh one per call
     * would discard every write made since the last read.
     */
    private readonly collections = new Map<string, KeyValueCollection>();

    constructor(private readonly store: KeyValueStore, databaseName: string) {
        super(databaseName);
    }

    /** The only method a record-holding backend has to write. */
    protected override resolveCollection<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        const key = `${this.databaseName}:${schema.collectionName}`;
        let collection = this.collections.get(key);

        if (collection == null) {
            collection = new KeyValueCollection(this.store, key, schema);
            this.collections.set(key, collection);
        }

        return collection;
    }

    override destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        for (const collection of this.collections.values()) {
            collection.destroy(() => undefined);
        }

        this.collections.clear();

        done(PluginEventResult.success(event.id));
    }
}

// ---------------------------------------------------------------------------------------
// Example 2: a wrapper, which needs no knowledge of storage at all
// ---------------------------------------------------------------------------------------

/**
 * Counts every operation that passes through, and changes nothing.
 *
 * The whole shape of a wrapper: implement the three methods, delegate each one, and do
 * whatever you need on the way past. This one only counts. `EncryptionDbPlugin` rewrites
 * values in `bulkPersist` and filters in `query`; `BlobDbPlugin` uploads bytes; the structure
 * is identical.
 */
class CountingDbPlugin implements IDbPlugin {

    readonly counts = { query: 0, persist: 0, destroy: 0 };

    constructor(private readonly plugin: IDbPlugin) { }

    // Passed through so change notifications stay scoped to the same database.
    get identity(): string | undefined {
        return this.plugin.identity;
    }

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        this.counts.query++;
        this.plugin.query(event, done);
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {
        this.counts.persist++;
        this.plugin.bulkPersist(event, done);
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.counts.destroy++;
        this.plugin.destroy(event, done);
    }
}

// ---------------------------------------------------------------------------------------
// Both run the contract every shipped plugin runs
// ---------------------------------------------------------------------------------------

/** A `localStorage` stand-in, so the example needs no browser. */
const inMemoryStore = (): KeyValueStore => {
    const map = new Map<string, string>();

    return {
        getItem: key => map.get(key) ?? null,
        setItem: (key, value) => { map.set(key, value); },
        removeItem: key => { map.delete(key); },
    };
};

describePluginContract(
    'example: key-value backend',
    () => new KeyValuePlugin(inMemoryStore(), `example-${uuidv4()}`),
    { supportsRichTypes: true, knownFailing: [] }
);

describePluginContract(
    'example: counting wrapper',
    () => new CountingDbPlugin(new KeyValuePlugin(inMemoryStore(), `wrapped-${uuidv4()}`)),
    { supportsRichTypes: true, knownFailing: [] }
);

/**
 * A minimal plugin gets vector search without knowing what a vector is.
 *
 * This is the strongest form of the claim: `KeyValuePlugin` below was written before vectors
 * existed and stores whatever it is handed. It passes because the scoring happens above it, in
 * the translator every plugin inherits — nothing was added here to make it work.
 */
describeVectorSearch(
    'example: key-value backend',
    () => new KeyValuePlugin(inMemoryStore(), `example-vector-${uuidv4()}`),
);

describeVectorSearch(
    'example: counting wrapper',
    () => new CountingDbPlugin(new KeyValuePlugin(inMemoryStore(), `wrapped-vector-${uuidv4()}`)),
);

describe('the wrapper really is in the path', () => {
    it('counts the operations it forwards', async () => {
        // Or the contract above would pass just as happily with a wrapper that was never
        // called.
        const plugin = new CountingDbPlugin(new KeyValuePlugin(inMemoryStore(), `count-${uuidv4()}`));

        expect(plugin.counts).toEqual({ query: 0, persist: 0, destroy: 0 });

        await new Promise<void>(resolve => plugin.destroy(
            { id: '1', source: 'test', action: 'destroy', schemas: undefined as never },
            () => resolve()
        ));

        expect(plugin.counts.destroy).toBe(1);
    });
});
