import { s } from "@routier/core/schema";

// String property types within schemas
const userSchema = s.define("users", {
    // Basic string
    name: s.string(),

    // String with literals
    status: s.string("active", "inactive", "pending"),

    // String with modifiers
    email: s.string().distinct().optional(),
    description: s.string().nullable().default(""),
    readonlyField: s.string().readonly(),

    // String with serialization
    jsonData: s.string().serialize((obj) => JSON.stringify(obj))
        .deserialize((str) => JSON.parse(str)),
}).compile();
