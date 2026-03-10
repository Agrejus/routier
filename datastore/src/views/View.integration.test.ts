import { afterEach, describe, expect, it } from "@jest/globals";
import { DataStore } from "../DataStore";
import { s } from "@routier/core/schema";
import { MemoryPlugin } from "@routier/memory-plugin";

const sourceSchema = s.define("viewSourceProducts", {
    id: s.number().key(),
    name: s.string(),
    active: s.boolean(),
}).compile();

const viewSchema = s.define("activeProductView", {
    id: s.number().key(),
    name: s.string(),
    label: s.string(),
}).compile();

class ViewStore extends DataStore {
    products = this.collection(sourceSchema).create();

    activeProducts = this.view(viewSchema)
        .derive((cb) => {
            const recompute = () => {
                this.products
                    .where((x) => x.active === true)
                    .toArray((result) => {
                        if (result.ok === "error") {
                            throw result.error;
                        }

                        cb(result.data.map((item) => ({
                            id: item.id,
                            name: item.name,
                            label: `${item.name}:active`,
                        })) as any[]);
                    });
            };

            recompute();
            return this.products.subscribe().toArray((result) => {
                if (result.ok === "error") {
                    throw result.error;
                }

                recompute();
            });
        })
        .create();
}

const stores: ViewStore[] = [];
let storeId = 0;

const createStore = () => {
    storeId++;
    const store = new ViewStore(new MemoryPlugin(`view-store-${storeId}`));
    stores.push(store);
    return store;
};

const waitFor = async (assertion: () => Promise<void>) => {
    let lastError: unknown;

    for (let i = 0; i < 20; i++) {
        try {
            await assertion();
            return;
        } catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }

    throw lastError;
};

describe("View integration", () => {
    afterEach(() => {
        for (const store of stores.splice(0)) {
            store[Symbol.dispose]();
        }
    });

    it("populates derived rows from source collection changes", async () => {
        const store = createStore();

        await store.products.addAsync(
            { id: 1, name: "Desk", active: true },
            { id: 2, name: "Chair", active: false },
        );
        await store.saveChangesAsync();

        await waitFor(async () => {
            const result = await store.activeProducts.toArrayAsync();
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                id: 1,
                name: "Desk",
                label: "Desk:active",
            });
        });
    });

    it("updates derived rows when a qualifying source entity changes", async () => {
        const store = createStore();
        const [product] = await store.products.addAsync({ id: 3, name: "Lamp", active: true });
        await store.saveChangesAsync();

        product.name = "Updated Lamp";
        await store.saveChangesAsync();

        await waitFor(async () => {
            const result = await store.activeProducts.toArrayAsync();
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("Updated Lamp");
            expect(result[0].label).toBe("Updated Lamp:active");
        });
    });

    it("removes derived rows when a source entity no longer qualifies", async () => {
        const store = createStore();
        const [product] = await store.products.addAsync({ id: 4, name: "Monitor", active: true });
        await store.saveChangesAsync();

        product.active = false;
        await store.saveChangesAsync();

        await waitFor(async () => {
            const result = await store.activeProducts.toArrayAsync();
            expect(result).toHaveLength(0);
        });
    });

    it("stops recomputing after the view is disposed", async () => {
        const store = createStore();
        const [product] = await store.products.addAsync({ id: 5, name: "Keyboard", active: true });
        await store.saveChangesAsync();

        await waitFor(async () => {
            const result = await store.activeProducts.toArrayAsync();
            expect(result).toHaveLength(1);
        });

        store.activeProducts.dispose();
        product.name = "Disposed Keyboard";
        await store.saveChangesAsync();

        await new Promise((resolve) => setTimeout(resolve, 0));

        const result = await store.activeProducts.toArrayAsync();
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("Keyboard");
    });
});
