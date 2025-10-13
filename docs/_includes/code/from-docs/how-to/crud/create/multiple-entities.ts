import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferCreateType } from "@routier/core/schema";

// Define a product schema
const productSchema = s.define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    category: s.string("electronics", "books", "clothing"),
    inStock: s.boolean().default(true),
}).compile();

// Create DataStore with collection
class AppContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("app-db"));
    }

    products = this.collection(productSchema).create();
}

const ctx = new AppContext();

// Adding multiple entities at once
const newProducts = await ctx.products.addAsync(
    {
        name: "Laptop",
        price: 999.99,
        category: "electronics"
    },
    {
        name: "JavaScript Book",
        price: 29.99,
        category: "books"
    },
    {
        name: "T-Shirt",
        price: 19.99,
        category: "clothing"
    }
);

console.log("Created products:", newProducts);
// Output: Array of 3 products with generated IDs and default values

// Save all changes
await ctx.saveChangesAsync();
