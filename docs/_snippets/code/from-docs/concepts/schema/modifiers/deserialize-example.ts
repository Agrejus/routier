import { s } from "@routier/core/schema";

// Deserialization within schemas
const dataSchema = s.define("data", {
    id: s.string().key().identity(),
    name: s.string(),

    // Custom deserialization
    metadata: s.object({}).deserialize((str) => JSON.parse(str)),

    // Date deserialization
    timestamp: s.date().deserialize((str) => new Date(str)),

    // Number deserialization
    value: s.number().deserialize((str) => parseFloat(str)),
}).compile();
