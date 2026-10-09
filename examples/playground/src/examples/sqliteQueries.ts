import { DataStore } from "@routier/datastore";
import { SqliteDbPlugin, wasmDriver } from "@routier/sqlite-plugin";
import { s } from "@routier/core/schema";
import { showInDevtools } from "../devtools";

type Log = (message: string, value?: unknown) => void;

const orderSchema = s
  .define("orders", {
    id: s.string().key().identity(),
    customer: s.string(),
    region: s.string(),
    total: s.number(),
  })
  .compile();

class OrderStore extends DataStore {
  orders = this.collection(orderSchema).proxy().create();

  constructor() {
    super(new SqliteDbPlugin(`playground-orders-${Date.now()}.db`, { driver: wasmDriver({ storage: "memory" }) }));
  }
}

const REGIONS = ["north", "south", "east", "west"];

export async function run(log: Log) {
  const store = new OrderStore();
  showInDevtools(store, "SQLite");

  await store.orders.addAsync(
    ...Array.from({ length: 200 }, (_, i) => ({
      customer: `customer-${i % 37}`,
      region: REGIONS[i % REGIONS.length],
      total: Math.round(((i * 37) % 500) + 10),
    })),
  );
  await store.saveChangesAsync();
  log("Inserted 200 orders into SQLite running in WebAssembly");

  const big = await store.orders
    .where(([o, p]) => o.total > p.min && p.regions.includes(o.region), { min: 400, regions: ["north", "east"] })
    .sortDescending(o => o.total)
    .take(5)
    .toArrayAsync();
  log("Five largest orders over $400 in the north and east", big.map(o => `${o.customer}: $${o.total}`));

  log("Sum of every order", await store.orders.sumAsync(o => o.total));
  log("Open the Routier devtools Queries tab to see the SQL each query ran.");
}
