import { fastHash, HashType, s } from '@routier/core';

export const blogPostsSchema = s.define("blogPosts", {
    title: s.string(),
    authorId: s.string(),
    content: s.string(),
    tags: s.string().array(),
    isPublished: s.boolean(),
    publishedAt: s.date()
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked(),
    id: x.computed((entity, _, deps) => deps.fastHash(JSON.stringify(entity)), {
        fastHash
    }).tracked().key()
})).compile();