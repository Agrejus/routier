import { s } from '@routier/core';

export const blogPostsSchema = s.define("blogPosts", {
    id: s.string().key().identity(),
    title: s.string(),
    authorId: s.string(),
    content: s.string(),
    tags: s.string().array(),
    isPublished: s.boolean(),
    publishedAt: s.date()
}).compile();