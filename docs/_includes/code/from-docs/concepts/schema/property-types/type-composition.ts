import { s } from "@routier/core/schema";

// Type composition examples within schemas
const userSchema = s.define("users", {
    // Combining different types
    id: s.string().key().identity(),
    name: s.string(),
    age: s.number(),
    isActive: s.boolean().default(true),
    createdAt: s.date().default(() => new Date()),
    tags: s.array(s.string()).default([]),
}).compile();

const postSchema = s.define("posts", {
    // Nested objects with arrays
    title: s.string(),
    content: s.string(),
    metadata: s.object({
        views: s.number().default(0),
        tags: s.array(s.string()),
    }),
}).compile();
