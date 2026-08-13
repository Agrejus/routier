import { s } from "@routier/core/schema";

// Identity properties within schemas
const entitySchema = s.define("entities", {
    // String identity (datastore generates UUID)
    id: s.string().key().identity(),

    // Number identity (datastore generates auto-incrementing value)
    userId: s.number().key().identity(),

    // Date identity (datastore generates current timestamp)
    createdAt: s.date().key().identity(),

    // Boolean identity (datastore generates true/false)
    isActive: s.boolean().identity(),
}).compile();
