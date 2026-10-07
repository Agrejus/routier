import { describe, it, expect } from '@jest/globals';
import { ConcurrencyDbPlugin } from './ConcurrencyDbPlugin';
import { EphemeralDataPlugin } from './EphemeralDataPlugin';
import { CompiledSchema, etags, InferType, s } from '../schema';
import { BulkPersistChanges, MemoryDataCollection, SchemaCollection } from '../collections';
import { PluginEventCallbackResult, PluginEventResult } from '../results';
import { DbPluginBulkPersistEvent, DbPluginEvent } from './types';

const accounts = s.define("concurrency_accounts", {
    id: s.string().key(),
    balance: s.number(),
}).compile();

const versioned = s.define("concurrency_versioned", {
    id: s.string().key(),
    balance: s.number(),
    version: s.number().etag(etags.numeric),
}).compile();

type Account = InferType<typeof accounts>;
type Versioned = InferType<typeof versioned>;

class SharedMemoryPlugin extends EphemeralDataPlugin {
    private readonly collections = new Map<CompiledSchema<{}>["id"], MemoryDataCollection>();

    constructor() {
        super("concurrency-test-db");
    }

    protected resolveCollection<TEntity extends {}>(schema: CompiledSchema<TEntity>): MemoryDataCollection {
        const found = this.collections.get(schema.id);

        if (found != null) {
            return found;
        }

        const created = new MemoryDataCollection(schema);
        this.collections.set(schema.id, created);

        return created;
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        done(PluginEventResult.success(event.id));
    }
}

const schemas = new SchemaCollection();
schemas.set(accounts.id, accounts);
schemas.set(versioned.id, versioned);

type Changes = ReturnType<BulkPersistChanges["resolve"]>;

const persist = (plugin: ConcurrencyDbPlugin, build: (changes: Changes) => void, schema: CompiledSchema<{}> = accounts) => {
    const operation = new BulkPersistChanges();
    build(operation.resolve(schema.id));

    const event: DbPluginBulkPersistEvent = { id: "persist", operation, schemas, source: "test", action: "persist" };

    return new Promise<string>(resolve => plugin.bulkPersist(event, result => resolve(result.ok)));
};

const add = (entity: Account) => (changes: Changes) => changes.adds.push(entity as never);
const update = (entity: Account) => (changes: Changes) => changes.updates.push({ entity, delta: { balance: entity.balance } } as never);
const remove = (entity: Account) => (changes: Changes) => changes.removes.push(entity as never);

describe("ConcurrencyDbPlugin", () => {

    it("forgets the version of a row it removed, so a row re-added elsewhere is not judged by it", async () => {
        const inner = new SharedMemoryPlugin();
        const writerA = new ConcurrencyDbPlugin(inner);
        const writerB = new ConcurrencyDbPlugin(inner);

        expect(await persist(writerA, add({ id: "a", balance: 1 }))).toBe("success");
        expect(await persist(writerA, update({ id: "a", balance: 2 }))).toBe("success");
        expect(await persist(writerA, remove({ id: "a", balance: 2 }))).toBe("success");
        expect(await persist(writerB, add({ id: "a", balance: 3 }))).toBe("success");

        expect(await persist(writerA, update({ id: "a", balance: 4 }))).toBe("success");
    });

    it("still judges a row it updated by the version it wrote", async () => {
        const inner = new SharedMemoryPlugin();
        const writerA = new ConcurrencyDbPlugin(inner);
        const writerB = new ConcurrencyDbPlugin(inner);

        expect(await persist(writerA, add({ id: "a", balance: 1 }))).toBe("success");
        expect(await persist(writerA, update({ id: "a", balance: 2 }))).toBe("success");
        expect(await persist(writerB, update({ id: "a", balance: 3 }))).toBe("success");

        expect(await persist(writerA, update({ id: "a", balance: 5 }))).toBe("error");
    });

    it("rejects an update whose declared etag no longer matches the stored row", async () => {
        const writer = new ConcurrencyDbPlugin(new SharedMemoryPlugin());
        const stored: Versioned = { id: "a", balance: 1, version: 1 };

        expect(await persist(writer, (changes) => changes.adds.push(stored as never), versioned)).toBe("success");

        const stale = (changes: Changes) => changes.updates.push({ entity: { ...stored, version: stored.version + 1 }, delta: { balance: 2 } } as never);

        expect(await persist(writer, stale, versioned)).toBe("error");
    });

    it("accepts an update whose declared etag matches the stored row", async () => {
        const writer = new ConcurrencyDbPlugin(new SharedMemoryPlugin());
        const stored: Versioned = { id: "a", balance: 1, version: 1 };

        expect(await persist(writer, (changes) => changes.adds.push(stored as never), versioned)).toBe("success");

        const current = (changes: Changes) => changes.updates.push({ entity: { ...stored }, delta: { balance: 2 } } as never);

        expect(await persist(writer, current, versioned)).toBe("success");
    });
});
