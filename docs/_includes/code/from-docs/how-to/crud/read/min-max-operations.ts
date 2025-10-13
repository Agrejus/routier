import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a product schema for min/max operations
const productSchema = s.define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    quantity: s.number(),
    createdAt: s.date().default(() => new Date()),
}).compile();

// Create DataStore with collection
class AppContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("app-db"));
    }

    products = this.collection(productSchema).create();
}

const ctx = new AppContext();

// Min operations
const minPrice = await ctx.products.minAsync(p => p.price);
console.log("Minimum price:", minPrice);

const minQuantity = await ctx.products.minAsync(p => p.quantity);
console.log("Minimum quantity:", minQuantity);

// Max operations
const maxPrice = await ctx.products.maxAsync(p => p.price);
console.log("Maximum price:", maxPrice);

const maxQuantity = await ctx.products.maxAsync(p => p.quantity);
console.log("Maximum quantity:", maxQuantity);

// Min/Max with filters
const electronicsMinPrice = await ctx.products
    .where(p => p.price > 100)
    .minAsync(p => p.price);
console.log("Minimum price for expensive products:", electronicsMinPrice);

const recentMaxPrice = await ctx.products
    .where(p => p.createdAt > new Date("2023-01-01"))
    .maxAsync(p => p.price);
console.log("Maximum price for recent products:", recentMaxPrice);
