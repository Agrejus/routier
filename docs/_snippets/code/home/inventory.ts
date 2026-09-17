import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { InferType, s } from "@routier/core/schema";

const productSchema = s
  .define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    category: s.string(),
    price: s.number(),
    stock: s.number(),
  })
  .compile();

export type Product = InferType<typeof productSchema>;

class InventoryStore extends DataStore {
  products = this.collection(productSchema).proxy().create();

  constructor() {
    super(new MemoryPlugin("inventory"));
  }
}

export const store = new InventoryStore();
