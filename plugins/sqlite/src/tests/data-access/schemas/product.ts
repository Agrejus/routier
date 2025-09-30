import { s } from "@routier/core/schema";

export const productsSchema = s.define("products", {
    _id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    category: s.string(),
    inStock: s.boolean().serialize(x => x === true ? 1 : 0).deserialize(x => x === 1 ? true : false),
    tags: s.string("computer", "accessory").array().serialize(x => JSON.stringify(x)).deserialize(x => JSON.parse(String(x))),
    createdDate: s.date()
        .default(() => new Date())
        .deserialize(x => (typeof x === "object" && (x as unknown) instanceof Date) ? x : new Date(Number(x)))
        .serialize(x => x.getTime())
}).compile();