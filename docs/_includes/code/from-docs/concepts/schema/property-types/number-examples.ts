import { s } from "@routier/core/schema";

// Number property types within schemas
const productSchema = s.define("products", {
    // Basic number
    age: s.number(),

    // Number with literals
    priority: s.number(1, 2, 3, 4, 5),

    // Number with modifiers
    score: s.number().default(0),
    rating: s.number().nullable().optional(),
    readonlyCount: s.number().readonly(),

    // Number with serialization
    price: s.number().serialize((num) => num.toString())
        .deserialize((str) => parseFloat(str)),
}).compile();
