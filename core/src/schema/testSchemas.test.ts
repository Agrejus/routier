import { s } from "./builder";
import { InferType } from "./types";

export const productsSchema = s.define("products", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    name: s.string(),
    price: s.number(),
    category: s.string().optional(),
    inStock: s.boolean(),
    location: s.object({
        id: s.string(),
        name: s.string()
    }).array(),
    tags: s.string("computer", "accessory").array(),
    stores: s.object({
        id: s.string(),
        name: s.string()
    }).array(),
    user: s.object({
        name: s.string()
    }).optional(),
    createdDate: s.date().default(() => new Date()).deserialize(x => (typeof x === "object" && (x as unknown) instanceof Date) ? x : new Date(x))
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();