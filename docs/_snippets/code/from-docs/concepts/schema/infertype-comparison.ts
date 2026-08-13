import { InferType, InferCreateType, s } from "@routier/core/schema";

const productSchema = s.define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    category: s.string().default("general"),
    isActive: s.boolean().default(true),
}).compile();

type Product = InferType<typeof productSchema>;
type CreateProduct = InferCreateType<typeof productSchema>;

// InferType - Complete entity type
const existingProduct: Product = {
    id: "prod-123",        // Required (identity)
    name: "Widget",        // Required
    price: 29.99,         // Required
    category: "general",  // Required (has default)
    isActive: true,       // Required (has default)
};

// InferCreateType - Creation type (defaults are optional)
const newProduct: CreateProduct = {
    name: "Gadget",       // Required
    price: 19.99,         // Required
    // category and isActive are optional (have defaults)
    // id is optional (auto-generated)
};

// TypeScript will enforce these differences
function updateProduct(product: Product, updates: Partial<Product>) {
    // Can update any property of existing product
    return { ...product, ...updates };
}

function createProduct(data: CreateProduct) {
    // Only requires non-default, non-identity properties
    return data;
}
