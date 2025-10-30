import { DataStore } from "@routier/datastore";
import { s } from "@routier/core/schema";
import { MemoryPlugin } from "@routier/memory-plugin";
import { InferType } from "@routier/core/schema";

const productSchema = s.define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    category: s.string(),
    price: s.number(),
    inStock: s.boolean(),
}).compile();

type Product = InferType<typeof productSchema>;

class AppDataStore extends DataStore {
    products = this.collection(productSchema).create();
    constructor() {
        super(new MemoryPlugin("app"));
    }
}

const dataStore = new AppDataStore();

// Building a query dynamically based on logic
// In this example, we build a query by conditionally adding filters

const minPrice = 100;
const categoryFilter = "electronics";

// Convert collection to QueryableAsync for building queries dynamically
let query = dataStore.products.toQueryable();

// Build query conditionally - only add filters that apply
if (categoryFilter) {
    query = query.where(([p, params]) =>
        p.category === params.categoryFilter,
        { categoryFilter }
    );
}

if (minPrice > 0) {
    query = query.where(([p, params]) =>
        p.price >= params.minPrice,
        { minPrice }
    );
}

// Execute the built query
const results = await query.toArrayAsync();

// Pattern: Building queries with arrays using includes()
// When filtering by multiple ID values from an array
const productIds = ["prod-1", "prod-2", "prod-3"];
const productsByIds = await dataStore.products
    .where(([p, params]) =>
        params.ids.includes(p.id),
        { ids: productIds }
    )
    .toArrayAsync();

