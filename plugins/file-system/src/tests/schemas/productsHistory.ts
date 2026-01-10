import { s } from "@routier/core/schema";
import { fastHash } from "@routier/core/utilities";

export const productsHistorySchema = s.define("productsHistory", {
    productId: s.string(),
    name: s.string(),
    price: s.number(),
    category: s.string(),
    inStock: s.boolean(),
    tags: s.string("computer", "accessory").array(),
    createdDate: s.date().default(() => new Date()).deserialize(x => (typeof x === "object" && (x as unknown) instanceof Date) ? x : new Date(x))
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked(),
    // Hash the object so we can compare if anything has changed.  This will ensure a new record is inserted when anything changes
    id: x.computed((entity, _, deps) => deps.fastHash(JSON.stringify(entity)), {
        fastHash
    }).tracked().key()
})).compile();