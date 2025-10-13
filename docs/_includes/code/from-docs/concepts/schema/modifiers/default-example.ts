import { s } from "@routier/core/schema";
import { v4 as uuidv4 } from 'uuid';

// Default values within schemas
const postSchema = s.define("posts", {
    id: s.string().key().identity(),
    title: s.string(),
    content: s.string(),

    // Static default value
    status: s.string("draft", "published").default("draft"),

    // Function default value
    createdAt: s.date().default(() => new Date()),

    // Default with injected dependencies
    slug: s.string().default((injected) => injected.uuidv4(), { uuidv4 }),

    // Default with collection name context
    collectionType: s.string().default((injected, collectionName) =>
        `post_${collectionName}`,
        {}
    ),
}).compile();
