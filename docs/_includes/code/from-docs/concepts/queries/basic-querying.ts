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

// Basic querying - get all products
const allProducts = await dataStore.products.toArrayAsync();

// Get first product
const firstProduct = await dataStore.products.firstAsync();

// Get first product or undefined if none exist
const firstOrUndefined = await dataStore.products.firstOrUndefinedAsync();

// Check if any products exist
const hasProducts = await dataStore.products.someAsync();

// Count total products
const totalCount = await dataStore.products.countAsync();
