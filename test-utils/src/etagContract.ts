import { afterAll, describe, expect, it } from "@jest/globals";
import { EtagMode, IDbPlugin } from "@routier/core";
import { BulkPersistChanges, BulkPersistResult, SchemaCollection } from "@routier/core/collections";
import { PluginEventPartialResultType } from "@routier/core/results";
import { etags, InferRoot, InferType, s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";

const numberSchema = s.define("contract_etag_numbers", {
    id: s.string().key().identity(),
    name: s.string(),
    version: s.number().etag(etags.numeric),
}).compile();

const diffSchema = s.define("contract_etag_diff", {
    id: s.string().key().identity(),
    name: s.string(),
    version: s.number().etag(etags.numeric),
}).compile();

const immutableSchema = s.define("contract_etag_immutable", {
    id: s.string().key().identity(),
    name: s.string(),
    version: s.number().etag(etags.numeric),
}).compile();

const tokenSchema = s.define("contract_etag_tokens", {
    id: s.string().key().identity(),
    name: s.string(),
    revision: s.string().etag(etags.lexical),
}).compile();

type NumberRow = InferType<typeof numberSchema>;

class EtagDataStore extends DataStore {
    numbers = this.collection(numberSchema).proxy().create();
    diffNumbers = this.collection(diffSchema).diff().create();
    immutableNumbers = this.collection(immutableSchema).immutable().create();
    tokens = this.collection(tokenSchema).proxy().create();
}

const required = <T>(value: T | undefined): T => {
    if (value == null) {
        throw new Error("expected a value");
    }

    return value;
};

const persistNumbers = (plugin: IDbPlugin, changes: { adds?: NumberRow[], updates?: NumberRow[] }, mode: EtagMode) => {
    const operation = new BulkPersistChanges();
    const schemaChanges = operation.resolve<InferRoot<typeof numberSchema>>(numberSchema.id);
    schemaChanges.adds.push(...(changes.adds ?? []));
    schemaChanges.updates.push(...(changes.updates ?? []).map(entity => ({ entity, changeType: "markedDirty" as const, delta: {} })));

    return new Promise<PluginEventPartialResultType<BulkPersistResult>>(resolve => plugin.bulkPersist({
        id: `etag-contract-${mode}`,
        schemas: new SchemaCollection().set(numberSchema.id, numberSchema),
        operation,
        source: "etagContract",
        action: "persist",
        etags: mode,
    }, resolve));
};

export function describeEtagContract(name: string, factory: () => IDbPlugin) {
    describe(`etag: ${name}`, () => {
        const stores: EtagDataStore[] = [];

        const open = () => {
            const plugin = factory();
            const store = new EtagDataStore(plugin);
            stores.push(store);
            return { plugin, store };
        };

        afterAll(async () => {
            await Promise.all(stores.map(store => store.destroyAsync()));
        });

        it("sets a number etag to 1 on insert and stores it", async () => {
            const { store } = open();
            const [added] = await store.numbers.addAsync({ name: "first" });
            await store.saveChangesAsync();

            const [stored] = await store.numbers.toArrayAsync();

            expect([added?.version, stored?.version]).toEqual([1, 1]);
        });

        it("gives each inserted row its own number etag starting at 1", async () => {
            const { store } = open();
            const added = await store.numbers.addAsync({ name: "a" }, { name: "b" });
            await store.saveChangesAsync();

            expect(added.map(row => row.version)).toEqual([1, 1]);
        });

        it("increments a number etag on every update and stores it", async () => {
            const { store } = open();
            const added = required((await store.numbers.addAsync({ name: "first" }))[0]);
            await store.saveChangesAsync();

            added.name = "second";
            await store.saveChangesAsync();
            added.name = "third";
            await store.saveChangesAsync();

            const [stored] = await store.numbers.toArrayAsync();

            expect([added.version, stored?.version]).toEqual([3, 3]);
        });

        it("increments a number etag in a diff-tracked collection", async () => {
            const { store } = open();
            const added = required((await store.diffNumbers.addAsync({ name: "first" }))[0]);
            await store.saveChangesAsync();

            added.name = "second";
            await store.saveChangesAsync();

            const [stored] = await store.diffNumbers.toArrayAsync();

            expect([added.version, stored?.version]).toEqual([2, 2]);
        });

        it("increments a number etag in an immutable collection", async () => {
            const { store } = open();
            const added = required((await store.immutableNumbers.addAsync({ name: "first" }))[0]);
            await store.saveChangesAsync();

            store.immutableNumbers.update(added, { name: "second" });
            await store.saveChangesAsync();

            const [stored] = await store.immutableNumbers.toArrayAsync();

            expect(stored?.version).toBe(2);
        });

        it("leaves the etag alone when nothing changed", async () => {
            const { store } = open();
            await store.numbers.addAsync({ name: "first" });
            await store.saveChangesAsync();
            await store.saveChangesAsync();

            const [stored] = await store.numbers.toArrayAsync();

            expect(stored?.version).toBe(1);
        });

        it("sets a string etag on insert and replaces it with a newer one on update", async () => {
            const { store } = open();
            const added = required((await store.tokens.addAsync({ name: "first" }))[0]);
            await store.saveChangesAsync();

            const inserted = added.revision;
            added.name = "second";
            await store.saveChangesAsync();

            expect(etags.lexical(inserted, added.revision)).toBe(-1);
        });

        it("keeps the etag an insert carries when told to keep etags", async () => {
            const { plugin, store } = open();
            const result = await persistNumbers(plugin, { adds: [{ id: "kept", name: "first", version: 7 }] }, "keep");

            const [stored] = await store.numbers.toArrayAsync();

            expect([result.ok, stored?.version]).toEqual(["success", 7]);
        });

        it("keeps the etag an update carries when told to keep etags", async () => {
            const { plugin, store } = open();
            await persistNumbers(plugin, { adds: [{ id: "kept", name: "first", version: 7 }] }, "keep");
            await persistNumbers(plugin, { updates: [{ id: "kept", name: "second", version: 4 }] }, "keep");

            const [stored] = await store.numbers.toArrayAsync();

            expect([stored?.name, stored?.version]).toEqual(["second", 4]);
        });

        it("generates the etag when told to generate etags", async () => {
            const { plugin, store } = open();
            await persistNumbers(plugin, { adds: [{ id: "made", name: "first", version: 7 }] }, "generate");

            const [stored] = await store.numbers.toArrayAsync();

            expect(stored?.version).toBe(1);
        });
    });
}
