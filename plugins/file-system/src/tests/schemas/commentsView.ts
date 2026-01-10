import { InferType, s } from "@routier/core/schema";

export const commentsViewSchema = s.define("commentsView", {
    id: s.string().key(),
    user: s.object({
        name: s.string()
    }).optional(),
    content: s.string(),
    replies: s.number().default(0),
    createdAt: s.date().default(() => new Date()).deserialize(x => (typeof x === "object" && (x as unknown) instanceof Date) ? x : new Date(x))
}).compile();

export type CommentsView = InferType<typeof commentsViewSchema>;