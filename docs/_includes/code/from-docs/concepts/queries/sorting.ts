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

// Sorting - ascending order
const productsByPrice = await dataStore.products
    .sort(p => p.price)
    .toArrayAsync();

const productsByName = await dataStore.products
    .sort(p => p.name)
    .toArrayAsync();

// Sorting - descending order
const productsByPriceDesc = await dataStore.products
    .sortDescending(p => p.price)
    .toArrayAsync();

const productsByNameDesc = await dataStore.products
    .sortDescending(p => p.name)
    .toArrayAsync();

// Combined filtering and sorting
const expensiveProductsSorted = await dataStore.products
    .where(p => p.price > 100)
    .sortDescending(p => p.price)
    .toArrayAsync();

// Sorting with multiple criteria (by category, then by price)
const productsByCategoryAndPrice = await dataStore.products
    .sort(p => p.category)
    .sort(p => p.price)
    .toArrayAsync();
