import { s } from "@routier/core/schema";

// Use appropriate types for the data
const productSchema = s.define("products", {
    id: s.string().key().identity(),

    // Use appropriate types for different data
    name: s.string(), // Text data
    price: s.number(), // Numeric data
    isAvailable: s.boolean(), // True/false data
    releaseDate: s.date(), // Date/time data

    // Use arrays for collections
    tags: s.array(s.string()),
    reviews: s.array(s.object({
        rating: s.number(1, 2, 3, 4, 5),
        comment: s.string(),
    })),

    // Use objects for structured data
    metadata: s.object({
        weight: s.number(),
        dimensions: s.string(),
    }),

    // Avoid inappropriate types
    // ❌ Bad: s.string() for numeric IDs
    // ✅ Good: s.number() for numeric IDs
    // ❌ Bad: s.number() for text descriptions  
    // ✅ Good: s.string() for text descriptions
}).compile();
