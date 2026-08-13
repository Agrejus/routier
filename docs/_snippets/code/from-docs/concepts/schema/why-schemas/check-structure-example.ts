import { s } from "@routier/core/schema";

// Check structure early - validate your schema design
const productSchema = s.define("products", {
    // Essential properties first
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),

    // Add constraints early to catch issues
    category: s.string("electronics", "books", "clothing"), // Constrain early
    sku: s.string().distinct(), // Ensure uniqueness

    // Optional properties
    description: s.string().optional(),
    tags: s.array(s.string()).default([]),
}).compile();

// Test your schema with real data early:
// - Create sample entities
// - Verify constraints work
// - Check computed properties
// - Validate serialization
// - Test edge cases
