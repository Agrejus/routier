import { s } from "@routier/core/schema";

// Key properties (unique identifiers) within schemas
const recordSchema = s.define("records", {
    // String key
    email: s.string().key(),

    // Number key
    userId: s.number().key(),

    // Date key
    timestamp: s.date().key(),
}).compile();
