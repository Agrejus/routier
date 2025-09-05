import { s } from "@routier/core/schema";

export const productsSchema = s.define("products", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    name: s.string(),
    price: s.number(),
    category: s.string(),
    inStock: s.boolean(),
    tags: s.string("computer", "accessory").array(),
    createdDate: s.date().default(() => new Date()).deserialize(x => (typeof x === "object" && (x as unknown) instanceof Date) ? x : new Date(x))
}).compile();