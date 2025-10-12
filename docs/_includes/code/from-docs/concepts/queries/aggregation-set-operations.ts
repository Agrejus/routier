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

// Aggregation operations
const totalValue = await dataStore.products
    .where(p => p.inStock === true)
    .sumAsync(p => p.price);

const maxPrice = await dataStore.products
    .where(p => p.category === "electronics")
    .maxAsync(p => p.price);

const minPrice = await dataStore.products
    .minAsync(p => p.price);

// Count operations
const totalProducts = await dataStore.products.countAsync();
const inStockCount = await dataStore.products
    .where(p => p.inStock === true)
    .countAsync();

// Distinct operations
const uniqueCategories = await dataStore.products
    .map(p => p.category)
    .distinctAsync();

const uniquePrices = await dataStore.products
    .map(p => p.price)
    .distinctAsync();

// Set operations with filtering
const expensiveCategories = await dataStore.products
    .where(p => p.price > 100)
    .map(p => p.category)
    .distinctAsync();

// Boolean operations
const hasExpensiveProducts = await dataStore.products
    .where(p => p.price > 1000)
    .someAsync();

const allProductsInStock = await dataStore.products
    .where(p => p.category === "electronics")
    .everyAsync(p => p.inStock === true);
