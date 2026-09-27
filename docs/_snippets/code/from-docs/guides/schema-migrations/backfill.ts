import { DataStore } from "@routier/datastore";
import { DexiePlugin } from "@routier/dexie-plugin";
import { s } from "@routier/core/schema";

const productSchema = s
    .define("products", {
        id: s.string().key().identity(),
        name: s.string(),
        category: s.string().index("category").default("general"),
    })
    .compile();

export class ProductStore extends DataStore {
    products = this.collection(productSchema).proxy().create();

    constructor() {
        super(new DexiePlugin("shop", { version: 2 }));
    }
}

export const backfillProducts = async (store: ProductStore) => {
    const stale = await store.products.where((p) => p.category == null).toArrayAsync();

    stale.forEach((product) => store.products.attachments.markDirty(product));

    await store.saveChangesAsync();

    return stale.length;
};
