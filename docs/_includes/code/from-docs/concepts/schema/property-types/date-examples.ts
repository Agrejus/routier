import { s } from "@routier/core/schema";

// Date property types within schemas
const eventSchema = s.define("events", {
    // Basic date
    createdAt: s.date(),

    // Date with modifiers
    updatedAt: s.date().default(() => new Date()),
    publishedAt: s.date().optional().nullable(),
    readonlyDate: s.date().readonly(),

    // Date with serialization
    customDate: s.date().serialize((date) => date.toISOString())
        .deserialize((str) => new Date(str)),
}).compile();
