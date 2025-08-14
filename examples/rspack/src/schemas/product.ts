import { InferType, s } from 'routier-core';

export const product = s.define("products", {
    id: s.string().key().identity(),
    name: s.string().index(),
    price: s.number().index(),
    category: s.string().index(),
    description: s.string(),
    inStock: s.boolean().index(),
    more: s.object({
        one: s.string(),
        two: s.string()
    }),
    order: s.number().index().default((d) => d.test, { test: 1 }),
    cool: s.string().index("one"),
    two: s.string().index("one")
}).modify(w => ({
    documentType: w.computed((_, t) => t).tracked()
})).compile();

export type Product = InferType<typeof product>;