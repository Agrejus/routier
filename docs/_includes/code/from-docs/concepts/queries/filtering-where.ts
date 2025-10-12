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

// Filtering with where - simple predicates
const expensiveProducts = await dataStore.products
    .where(p => p.price > 100)
    .toArrayAsync();

const inStockProducts = await dataStore.products
    .where(p => p.inStock === true)
    .toArrayAsync();

const electronicsProducts = await dataStore.products
    .where(p => p.category === "electronics")
    .toArrayAsync();

// Multiple where clauses (AND logic)
const expensiveElectronics = await dataStore.products
    .where(p => p.price > 100)
    .where(p => p.category === "electronics")
    .toArrayAsync();

// Parameterized queries
const minPrice = 50;
const maxPrice = 200;
const filteredProducts = await dataStore.products
    .where(([p, params]) => p.price >= params.minPrice && p.price <= params.maxPrice,
        { minPrice, maxPrice })
    .toArrayAsync();
