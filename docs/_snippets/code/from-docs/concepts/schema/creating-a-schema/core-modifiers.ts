import { s } from "@routier/core/schema";

// Core modifiers
const productSchema = s.define("products", {
    id: s.string().key().identity(),
    name: s.string().optional().nullable(),
    price: s.number().default(0),
    description: s.string().readonly(),
    category: s.string().distinct(),
    createdAt: s.date().default(() => new Date()),
}).compile();
