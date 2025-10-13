import { s } from "@routier/core/schema";

// Complete example with all features
const blogPostSchema = s.define("blogPosts", {
    id: s.string().key().identity(),
    title: s.string().distinct(),
    content: s.string(),
    author: s.string(),
    tags: s.array(s.string()).default([]),
    status: s.string("draft", "published", "archived").default("draft"),
    publishedAt: s.date().optional(),
    metadata: s.object({
        views: s.number().default(0),
        likes: s.number().default(0),
        comments: s.array(s.object({
            author: s.string(),
            content: s.string(),
            createdAt: s.date().default(() => new Date()),
        })).default([]),
    }).default({}),
    createdAt: s.date().default(() => new Date()),
    updatedAt: s.date().default(() => new Date()),
}).compile();
