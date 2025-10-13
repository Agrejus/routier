import { s } from "@routier/core/schema";

// Object property types within schemas
const companySchema = s.define("companies", {
    // Basic object
    address: s.object({
        street: s.string(),
        city: s.string(),
        zipCode: s.string(),
    }),

    // Object with modifiers
    metadata: s.object({
        version: s.string(),
        author: s.string(),
    }).optional(),

    config: s.object({
        theme: s.string(),
        language: s.string(),
    }).nullable().default({}),

    // Object with serialization
    settings: s.object({
        notifications: s.boolean(),
        privacy: s.string(),
    }).serialize((obj) => JSON.stringify(obj))
        .deserialize((str) => JSON.parse(str)),
}).compile();
