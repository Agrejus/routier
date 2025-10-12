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

// Pagination with take and skip
const pageSize = 10;
const pageNumber = 2; // 0-based

// Get first 10 products
const firstPage = await dataStore.products
    .take(pageSize)
    .toArrayAsync();

// Get second page (skip first 10, take next 10)
const secondPage = await dataStore.products
    .skip(pageSize * pageNumber)
    .take(pageSize)
    .toArrayAsync();

// Pagination with filtering
const expensiveProductsPage = await dataStore.products
    .where(p => p.price > 100)
    .sort(p => p.price)
    .skip(20)
    .take(10)
    .toArrayAsync();

// Pagination with sorting
const sortedProductsPage = await dataStore.products
    .sortDescending(p => p.price)
    .skip(0)
    .take(5)
    .toArrayAsync();

// Complex pagination example
const paginatedResults = await dataStore.products
    .where(p => p.inStock === true)
    .where(p => p.category === "electronics")
    .sortDescending(p => p.price)
    .skip(0)
    .take(20)
    .map(p => ({ name: p.name, price: p.price }))
    .toArrayAsync();
