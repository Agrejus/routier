import { s } from "@routier/core/schema";

// Serialization within schemas
const configSchema = s.define("config", {
    id: s.string().key().identity(),
    name: s.string(),

    // Custom serialization
    settings: s.object({}).serialize((obj) => JSON.stringify(obj))
        .deserialize((str) => JSON.parse(str)),

    // Date serialization
    lastModified: s.date().serialize((date) => date.toISOString())
        .deserialize((str) => new Date(str)),

    // Number serialization
    count: s.number().serialize((num) => num.toString())
        .deserialize((str) => parseFloat(str)),
}).compile();
