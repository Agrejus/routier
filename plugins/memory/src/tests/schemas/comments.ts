import { s } from "@routier/core/schema";

export const commentsSchema = s.define("comments", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    author: s.string(),
    content: s.string(),
    replies: s.number().default(0),
    createdAt: s.date().default(() => new Date()).deserialize(x => (typeof x === "object" && (x as unknown) instanceof Date) ? x : new Date(x))
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();
