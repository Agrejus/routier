import { s } from "@routier/core/schema";

// Automatic features example
const blogPostSchema = s.define("blogPosts", {
    id: s.string().key().identity(),
    title: s.string(),
    content: s.string(),
    author: s.string(),
    publishedAt: s.date().optional(),
}).modify(w => ({
    // Computed properties - automatically calculated
    slug: w.computed((entity) =>
        entity.title.toLowerCase().replace(/\s+/g, '-'),
        {}
    ).tracked(),

    // Function properties - non-persisted methods
    isPublished: w.function((entity) => entity.publishedAt != null),
})).compile();

// Schemas enable powerful features without additional code:
// - Automatic ID generation (identity)
// - Computed properties (slug from title)
// - Indexing for fast queries (distinct, index)
// - Change tracking and persistence
// - Serialization/deserialization
// - Type inference and safety
