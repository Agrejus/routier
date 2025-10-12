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

// Terminal methods - execute the query

// toArray / toArrayAsync - return all results
const allProducts = await dataStore.products.toArrayAsync();
const expensiveProducts = await dataStore.products
    .where(p => p.price > 100)
    .toArrayAsync();

// first / firstAsync - first item, throws if none
const firstProduct = await dataStore.products.firstAsync();
const firstExpensive = await dataStore.products
    .where(p => p.price > 100)
    .firstAsync();

// firstOrUndefined / firstOrUndefinedAsync - first item or undefined
const firstOrUndefined = await dataStore.products.firstOrUndefinedAsync();
const firstElectronics = await dataStore.products
    .where(p => p.category === "electronics")
    .firstOrUndefinedAsync();

// some / someAsync - any match
const hasExpensiveProducts = await dataStore.products
    .where(p => p.price > 1000)
    .someAsync();

// every / everyAsync - all match
const allElectronicsInStock = await dataStore.products
    .where(p => p.category === "electronics")
    .everyAsync(p => p.inStock === true);

// count / countAsync - count of items
const totalCount = await dataStore.products.countAsync();
const electronicsCount = await dataStore.products
    .where(p => p.category === "electronics")
    .countAsync();

// min/max/sum (and Async) - numeric aggregations
const minPrice = await dataStore.products.minAsync(p => p.price);
const maxPrice = await dataStore.products.maxAsync(p => p.price);
const totalValue = await dataStore.products.sumAsync(p => p.price);

// distinct / distinctAsync - unique set of current shape
const uniqueCategories = await dataStore.products
    .map(p => p.category)
    .distinctAsync();
