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

// Example removal using terminal method
const removedCount = await dataStore.products
    .where(p => p.price < 10)
    .removeAsync();

// Remove specific products
const cheapProducts = await dataStore.products
    .where(p => p.price < 50)
    .toArrayAsync();

if (cheapProducts.length > 0) {
    await dataStore.products.removeAsync(...cheapProducts);
}

// Remove all products in a category
const electronicsRemoved = await dataStore.products
    .where(p => p.category === "electronics")
    .removeAsync();

// Remove products with specific tags
const accessoryProductsRemoved = await dataStore.products
    .where(p => p.tags.includes("accessory"))
    .removeAsync();
