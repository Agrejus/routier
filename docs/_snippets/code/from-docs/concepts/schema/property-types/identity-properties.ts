import { s } from "@routier/core/schema";

// Identity properties (auto-generate values) within schemas
const entitySchema = s.define("entities", {
    // String identity
    id: s.string().key().identity(),

    // Number identity
    userId: s.number().key().identity(),

    // Date identity
    timestamp: s.date().key().identity(),
}).compile();
