import { s } from "@routier/core/schema";

// Self-documenting code example
const productSchema = s.define("products", {
    // Clear structure - anyone can understand what a product looks like
    id: s.string().key().identity(),
    name: s.string(),
    description: s.string().optional(),
    price: s.number(),
    category: s.string("electronics", "books", "clothing", "home"),
    inStock: s.boolean().default(true),

    // Metadata that explains business rules
    createdAt: s.date().default(() => new Date()).readonly(),
    updatedAt: s.date().default(() => new Date()),

    // Constraints that document business requirements
    sku: s.string().distinct(), // Must be unique
    tags: s.array(s.string()).default([]),
}).compile();

// The schema serves as living documentation:
// - Shows what properties a product has
// - Documents business rules (unique SKU, required name)
// - Shows data types and constraints
// - Indicates which fields are optional vs required
// - Documents default values and behavior
