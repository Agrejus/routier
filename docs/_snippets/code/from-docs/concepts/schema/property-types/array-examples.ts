import { s } from "@routier/core/schema";

// Array property types within schemas
const postSchema = s.define("posts", {
    // Basic array
    tags: s.array(s.string()),

    // Array with modifiers
    items: s.array(s.string()).default([]),
    optionalList: s.array(s.number()).optional(),
    nullableArray: s.array(s.boolean()).nullable(),

    // Array with serialization
    serializedArray: s.array(s.string()).serialize((arr) => arr.join(","))
        .deserialize((str) => str.split(",")),

    // Complex array
    users: s.array(s.object({
        name: s.string(),
        email: s.string(),
    })),
}).compile();
