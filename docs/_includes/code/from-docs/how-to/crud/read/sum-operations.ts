import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a product schema for sum operations
const productSchema = s.define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    quantity: s.number(),
    category: s.string(),
}).compile();

// Create DataStore with collection
class AppContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("app-db"));
    }

    products = this.collection(productSchema).create();
}

const ctx = new AppContext();

// Sum operations
const totalPrice = await ctx.products.sumAsync(p => p.price);
console.log("Total price of all products:", totalPrice);

const totalQuantity = await ctx.products.sumAsync(p => p.quantity);
console.log("Total quantity:", totalQuantity);

// Sum with filters
const electronicsTotalPrice = await ctx.products
    .where(p => p.category === "electronics")
    .sumAsync(p => p.price);
console.log("Electronics total price:", electronicsTotalPrice);

// Sum with complex calculations
const totalValue = await ctx.products.sumAsync(p => p.price * p.quantity);
console.log("Total inventory value:", totalValue);
