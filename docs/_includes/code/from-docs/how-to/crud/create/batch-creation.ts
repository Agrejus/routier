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

// Batch creation with type safety
async function createProductsBatch(productsData: InferCreateType<typeof productSchema>[]) {
    try {
        // TypeScript ensures all items have correct structure
        const createdProducts = await ctx.products.addAsync(...productsData);

        console.log(`Successfully created ${createdProducts.length} products`);
        return createdProducts;
    } catch (error) {
        console.error("Failed to create products:", error);
        throw error;
    }
}

// Usage with type-safe data
const productsToCreate: InferCreateType<typeof productSchema>[] = [
    { name: "Laptop", price: 999.99, category: "electronics" },
    { name: "Book", price: 29.99, category: "books" },
    { name: "Shirt", price: 19.99, category: "clothing" }
];

const createdProducts = await createProductsBatch(productsToCreate);
await ctx.saveChangesAsync();
