import { s } from "@routier/core/schema";

// Structure complex data with nested objects and arrays
const blogPostSchema = s.define("blogPosts", {
    id: s.string().key().identity(),
    title: s.string(),
    content: s.string(),

    // Structure complex nested data
    author: s.object({
        id: s.string(),
        name: s.string(),
        email: s.string(),
        bio: s.string().optional(),
    }),

    // Use arrays for collections
    tags: s.array(s.string()).default([]),
    categories: s.array(s.string("tech", "business", "lifestyle")),

    // Nested arrays and objects
    comments: s.array(s.object({
        id: s.string().identity(),
        author: s.string(),
        content: s.string(),
        createdAt: s.date().default(() => new Date()),
        replies: s.array(s.object({
            id: s.string().identity(),
            author: s.string(),
            content: s.string(),
            createdAt: s.date().default(() => new Date()),
        })).default([]),
    })).default([]),

    // Metadata as structured object
    metadata: s.object({
        views: s.number().default(0),
        likes: s.number().default(0),
        publishedAt: s.date().optional(),
        lastModified: s.date().default(() => new Date()),
    }),
}).compile();
