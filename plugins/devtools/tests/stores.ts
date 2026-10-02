import { s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

const productSchema = s.define("products", {
  id: s.string().key().identity(),
  name: s.string(),
}).compile();

const orderSchema = s.define("orders", {
  id: s.string().key().identity(),
  total: s.number(),
}).compile();

const productNameSchema = s.define("productNames", {
  id: s.string().key(),
  name: s.string(),
}).compile();

export class ShopStore extends DataStore {
  products = this.collection(productSchema).proxy().create();
  orders = this.collection(orderSchema).proxy().create();
  productNames = this.view(productNameSchema)
    .derive(() => () => undefined)
    .create();
}

export class EmptyStore extends DataStore {}

let storeId = 0;
const created: DataStore[] = [];

export function createShopStore(plugin: MemoryPlugin = new MemoryPlugin(`devtools-shop-${++storeId}`)): ShopStore {
  const store = new ShopStore(plugin);
  created.push(store);
  return store;
}

export async function seedProducts(store: ShopStore, count: number, prefix = "product"): Promise<void> {
  const names = Array.from({ length: count }, (_, index) => `${prefix}-${String(index).padStart(3, "0")}`);
  await store.products.addAsync(...names.map((name) => ({ name })));
  await store.saveChangesAsync();
}

export function createEmptyStore(): EmptyStore {
  storeId++;
  const store = new EmptyStore(new MemoryPlugin(`devtools-empty-${storeId}`));
  created.push(store);
  return store;
}

export function disposeStores(): void {
  for (const store of created.splice(0)) store[Symbol.dispose]();
}
