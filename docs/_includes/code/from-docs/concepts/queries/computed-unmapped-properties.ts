import { DataStore } from "@routier/datastore";
import { s } from "@routier/core/schema";
import { MemoryPlugin } from "@routier/memory-plugin";

const productSchema = s.define("products", {
    _id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    category: s.string(),
    inStock: s.boolean(),
    tags: s.string("computer", "accessory").array(),
    createdDate: s.date().default(() => new Date())
}).modify(x => ({
    // Computed property - not stored in database
    isExpensive: x.computed(p => p.price > 100).tracked(),
    displayName: x.computed(p => `${p.name} (${p.category})`).tracked()
})).compile();

class AppDataStore extends DataStore {
    products = this.collection(productSchema).create();
    constructor() {
        super(new MemoryPlugin("app"));
    }
}

const dataStore = new AppDataStore();

// Best practice: Apply database-backed filters first, then computed/unmapped filters
// This minimizes the number of records that need to be loaded into memory

// Good: Database-backed filter first (category is stored in database)
const expensiveElectronics = await dataStore.products
    .where(p => p.category === "electronics")  // Database-backed filter first
    .where(p => p.isExpensive === true)        // Computed filter second
    .toArrayAsync();

// Good: Database-backed filter first (price is stored in database)
const expensiveProducts = await dataStore.products
    .where(p => p.price > 100)                 // Database-backed filter first
    .where(p => p.displayName.includes("Pro")) // Computed filter second
    .toArrayAsync();

// Less efficient: Starting with computed/unmapped filters
// This will load all records first, then apply filters in memory
const allExpensiveProducts = await dataStore.products
    .where(p => p.isExpensive === true)       // Computed filter first - loads all records
    .where(p => p.category === "electronics") // Database-backed filter second
    .toArrayAsync();

// Complex example with multiple database-backed filters first
const filteredProducts = await dataStore.products
    .where(p => p.category === "electronics") // Database-backed
    .where(p => p.price > 50)                // Database-backed
    .where(p => p.inStock === true)          // Database-backed
    .where(p => p.isExpensive === true)      // Computed filter last
    .sort(p => p.price)
    .toArrayAsync();
