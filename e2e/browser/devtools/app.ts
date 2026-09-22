import { s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";
import { mountRoutierDevtools } from "@routier/devtools";
import { MemoryPlugin } from "@routier/memory-plugin";

const productSchema = s.define("products", {
    id: s.string().key().identity(),
    name: s.string(),
}).compile();

class ShopStore extends DataStore {
    products = this.collection(productSchema).proxy().create();
}

const store = new ShopStore(new MemoryPlugin("devtools-smoke"));

const addProduct = async (name: string): Promise<void> => {
    await store.products.addAsync({ name });
    await store.saveChangesAsync();
};

declare global {
    interface Window {
        addProduct: (name: string) => Promise<void>;
    }
}

window.addProduct = addProduct;

await addProduct("first");
await addProduct("second");
mountRoutierDevtools(store);
document.body.dataset.ready = "true";
