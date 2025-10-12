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
}).compile();

class AppDataStore extends DataStore {
    products = this.collection(productSchema).create();
    constructor() {
        super(new MemoryPlugin("app"));
    }
}

const dataStore = new AppDataStore();

// Selecting fields with map - single field
const productNames = await dataStore.products
    .map(p => p.name)
    .toArrayAsync();

const productPrices = await dataStore.products
    .map(p => p.price)
    .toArrayAsync();

// Selecting multiple fields
const productSummaries = await dataStore.products
    .map(p => ({
        id: p._id,
        name: p.name,
        price: p.price
    }))
    .toArrayAsync();

const productDetails = await dataStore.products
    .map(p => ({
        name: p.name,
        category: p.category,
        inStock: p.inStock,
        tags: p.tags
    }))
    .toArrayAsync();

// Computed fields in map
const productWithComputed = await dataStore.products
    .map(p => ({
        name: p.name,
        price: p.price,
        isExpensive: p.price > 100,
        displayName: `${p.name} (${p.category})`
    }))
    .toArrayAsync();

// Combined with filtering and sorting
const expensiveProductNames = await dataStore.products
    .where(p => p.price > 100)
    .sortDescending(p => p.price)
    .map(p => p.name)
    .toArrayAsync();
