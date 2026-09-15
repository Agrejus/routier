import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

type Log = (message: string, value?: unknown) => void;

// A schema describes the entity once: keys, defaults, and types all flow from it.
const productSchema = s
  .define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    category: s.string(),
    price: s.number(),
    inStock: s.boolean().default(true),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

class ShopStore extends DataStore {
  products = this.collection(productSchema).proxy().create();

  constructor() {
    super(new MemoryPlugin(`playground-crud-${Date.now()}`));
  }
}

export async function run(log: Log) {
  const store = new ShopStore();

  // Create: identity keys and defaults are filled in for you.
  const added = await store.products.addAsync(
    { name: "Mechanical Keyboard", category: "accessories", price: 129 },
    { name: "4K Monitor", category: "displays", price: 399 },
    { name: "USB-C Hub", category: "accessories", price: 49 },
  );
  await store.saveChangesAsync();
  log("Added three products", added);

  // Read: filter and sort with typed lambdas.
  const accessories = await store.products
    .where(p => p.category === "accessories")
    .sortDescending(p => p.price)
    .toArrayAsync();
  log("Accessories, most expensive first", accessories.map(p => `${p.name} ($${p.price})`));

  // Parameterized filters keep values out of the expression.
  const affordable = await store.products.where(([p, params]) => p.price < params.max, { max: 150 }).countAsync();
  log("Products under $150", affordable);

  // Update: entities are change-tracked, so assign and save.
  const monitor = await store.products.firstAsync(p => p.name === "4K Monitor");
  monitor.price = 349;
  await store.saveChangesAsync();
  log("Monitor after price change", await store.products.firstAsync(p => p.name === "4K Monitor"));

  // Delete.
  await store.products.removeAsync(monitor);
  await store.saveChangesAsync();
  log("Products remaining", await store.products.countAsync());
}
