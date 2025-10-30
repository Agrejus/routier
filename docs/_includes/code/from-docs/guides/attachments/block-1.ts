import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

const productSchema = s
    .define("products", {
        id: s.string().key().identity(),
        name: s.string(),
        category: s.string(),
        price: s.number(),
        inStock: s.boolean(),
    })
    .compile();

class Ctx extends DataStore {
    products = this.collection(productSchema).create();
    constructor(dbName: string) {
        super(new MemoryPlugin(dbName));
    }
}

// Two contexts pointing at the same database
const ctx1 = new Ctx("app-db");
const ctx2 = new Ctx("app-db");

// Seed and save
const [created] = await ctx1.products.addAsync({
    name: "Mouse",
    category: "accessory",
    price: 49.99,
    inStock: true,
});
await ctx1.saveChangesAsync();

// Force-mark an entity as dirty without changing fields
const first = await ctx1.products.firstAsync();
ctx1.products.attachments.markDirty(first);

// Save will include the entity even if no field changed
await ctx1.saveChangesAsync();

// Transfer attachments between contexts
// Attach in ctx2 so it can manage/save this entity's changes
ctx2.products.attachments.set(first);

// Change and save from ctx2
first.price = 44.99;
await ctx2.saveChangesAsync();

// Inspect attachment state
const changeType = ctx2.products.attachments.getChangeType(first);
// changeType could be: "notModified", "propertiesChanged", "markedDirty", etc.

