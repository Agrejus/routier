import { s } from 'routier-core';

export const comment = s.define("comments", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    author: s.object({
        id: s.string(),
        username: s.string()
    }),
    content: s.string(),
    replies: s.object({
        userId: s.string(),
        content: s.string()
    }).array(),
    createdAt: s.date().default(() => new Date())
}).compile();