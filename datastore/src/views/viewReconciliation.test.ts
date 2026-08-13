import { afterEach, describe, expect, it } from "@jest/globals";
import { DataStore } from "../DataStore";
import { s } from "@routier/core/schema";
import { MemoryPlugin } from "@routier/memory-plugin";

/**
 * A view has to track its derivation in BOTH directions.
 *
 * The adds and updates were already covered by View.integration.test.ts. What was missing is
 * the half that makes a view usable as a sync subset: rows leaving it. A view that can be
 * joined but never left grows towards the full table, which is exactly the cost it exists to
 * avoid — and until it gets there it keeps returning rows that do not satisfy its own
 * definition.
 */

const sourceSchema = s.define("reconcileSource", {
    id: s.number().key(),
    name: s.string(),
    active: s.boolean(),
}).compile();

const viewSchema = s.define("reconcileView", {
    id: s.number().key(),
    name: s.string(),
}).compile();

/** A composite key, to pin that reconciliation uses the WHOLE key. */
const compositeSourceSchema = s.define("reconcileCompositeSource", {
    tenant: s.string().key(),
    sku: s.string().key(),
    active: s.boolean(),
}).compile();

const compositeViewSchema = s.define("reconcileCompositeView", {
    tenant: s.string().key(),
    sku: s.string().key(),
    label: s.string(),
}).compile();

class Store extends DataStore {
    products = this.collection(sourceSchema).proxy().create();

    activeProducts = this.view(viewSchema)
        .derive((cb) => {
            const recompute = () => {
                this.products.where(x => x.active === true).toArray(r => {
                    if (r.ok === "error") throw r.error;
                    cb(r.data.map(i => ({ id: i.id, name: i.name })) as any[]);
                });
            };

            recompute();
            return this.products.subscribe().toArray(r => {
                if (r.ok === "error") throw r.error;
                recompute();
            });
        })
        .create();
}

class CompositeStore extends DataStore {
    items = this.collection(compositeSourceSchema).proxy().create();

    activeItems = this.view(compositeViewSchema)
        .derive((cb) => {
            const recompute = () => {
                this.items.where(x => x.active === true).toArray(r => {
                    if (r.ok === "error") throw r.error;
                    cb(r.data.map(i => ({ tenant: i.tenant, sku: i.sku, label: `${i.tenant}/${i.sku}` })) as any[]);
                });
            };

            recompute();
            return this.items.subscribe().toArray(r => {
                if (r.ok === "error") throw r.error;
                recompute();
            });
        })
        .create();
}

/**
 * A history, declared the way a history is declared: the key is COMPUTED from the row, so
 * every version gets its own key. Nothing else marks it as accumulating.
 */
const historySchema = s.define("reconcileHistory", {
    name: s.string(),
    active: s.boolean(),
}).modify(x => ({
    id: x.computed(entity => JSON.stringify(entity)).tracked().key(),
})).compile();

class HistoryStore extends DataStore {
    products = this.collection(sourceSchema).proxy().create();

    history = this.view(historySchema)
        .derive((cb) => {
            const recompute = () => {
                this.products.toArray(r => {
                    if (r.ok === "error") throw r.error;
                    cb(r.data.map(i => ({ name: i.name, active: i.active })) as any[]);
                });
            };

            recompute();
            return this.products.subscribe().toArray(r => {
                if (r.ok === "error") throw r.error;
                recompute();
            });
        })
        .create();
}

const stores: DataStore[] = [];

const open = <T extends DataStore>(Ctor: new (plugin: MemoryPlugin) => T): T => {
    const store = new Ctor(new MemoryPlugin());
    stores.push(store);
    return store;
};

/** The view recomputes off a subscription, so it settles a tick after the save. */
const settle = () => new Promise(resolve => setTimeout(resolve, 60));

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

describe("view reconciliation", () => {

    it("drops a row that leaves the derived set", async () => {
        const store = open(Store);

        const [a] = await store.products.addAsync(
            { id: 1, name: "a", active: true } as any,
            { id: 2, name: "b", active: true } as any,
        );
        await store.saveChangesAsync();
        await settle();

        expect(await store.activeProducts.countAsync()).toBe(2);

        a.active = false;
        await store.saveChangesAsync();
        await settle();

        expect((await store.activeProducts.toArrayAsync()).map(x => x.name)).toEqual(["b"]);
    });

    it("empties the view when the derivation produces nothing", async () => {
        const store = open(Store);

        const [a] = await store.products.addAsync({ id: 1, name: "a", active: true } as any);
        await store.saveChangesAsync();
        await settle();

        expect(await store.activeProducts.countAsync()).toBe(1);

        a.active = false;
        await store.saveChangesAsync();
        await settle();

        // The old code returned early on an empty derivation, so the view kept every row it
        // had ever held — the most extreme form of only-ever-growing.
        expect(await store.activeProducts.countAsync()).toBe(0);
    });

    it("drops a row whose source was deleted outright", async () => {
        const store = open(Store);

        const [a] = await store.products.addAsync(
            { id: 1, name: "a", active: true } as any,
            { id: 2, name: "b", active: true } as any,
        );
        await store.saveChangesAsync();
        await settle();

        await store.products.removeAsync(a);
        await store.saveChangesAsync();
        await settle();

        expect((await store.activeProducts.toArrayAsync()).map(x => x.name)).toEqual(["b"]);
    });

    it("still adds and updates", async () => {
        const store = open(Store);

        const [a] = await store.products.addAsync({ id: 1, name: "a", active: true } as any);
        await store.saveChangesAsync();
        await settle();

        a.name = "renamed";
        await store.saveChangesAsync();
        await settle();

        const rows = await store.activeProducts.toArrayAsync();

        expect(rows).toHaveLength(1);
        expect(rows[0].name).toBe("renamed");
    });

    it("re-adds a row that comes back", async () => {
        const store = open(Store);

        const [a] = await store.products.addAsync({ id: 1, name: "a", active: true } as any);
        await store.saveChangesAsync();
        await settle();

        a.active = false;
        await store.saveChangesAsync();
        await settle();

        expect(await store.activeProducts.countAsync()).toBe(0);

        a.active = true;
        await store.saveChangesAsync();
        await settle();

        expect(await store.activeProducts.countAsync()).toBe(1);
    });

    it("keeps superseded rows when the key is computed", async () => {
        const store = open(HistoryStore);

        const [a] = await store.products.addAsync({ id: 1, name: "a", active: true } as any);
        await store.saveChangesAsync();
        await settle();

        expect(await store.history.countAsync()).toBe(1);

        a.active = false;
        await store.saveChangesAsync();
        await settle();

        // A computed key makes the changed row a NEW row, so the old one is not a row that
        // left the set — it is the previous version, and removing it would delete the history.
        // The schema is the only thing that says so; there is no setting.
        expect(await store.history.countAsync()).toBe(2);
    });

    it("reconciles on the whole composite key", async () => {
        const store = open(CompositeStore);

        const [a] = await store.items.addAsync(
            { tenant: "t1", sku: "s1", active: true } as any,
            { tenant: "t2", sku: "s1", active: true } as any,
        );
        await store.saveChangesAsync();
        await settle();

        expect(await store.activeItems.countAsync()).toBe(2);

        // The two rows share their second key part. Reconciling on that part alone — which is
        // what the previous per-property loop did, because it reassigned rather than chained —
        // cannot tell them apart.
        a.active = false;
        await store.saveChangesAsync();
        await settle();

        const remaining = await store.activeItems.toArrayAsync();

        expect(remaining.map(x => x.tenant)).toEqual(["t2"]);
    });
});
