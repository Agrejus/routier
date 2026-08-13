import { s } from "@routier/core/schema";

// Array conversion within schemas
const itemSchema = s.define("items", {
    id: s.string().key().identity(),
    name: s.string(),

    // Convert single values to arrays
    singleTag: s.string().array(),
    singleNumber: s.number().array(),
    singleObject: s.object({ name: s.string() }).array(),

    // Arrays with defaults
    tags: s.array(s.string()).default([]),
    scores: s.array(s.number()).default([]),
}).compile();
