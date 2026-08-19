import { InferCreateType, InferType, s } from "@routier/core/schema";

const productSchema = s.define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    category: s.string("tool", "material"),
    price: s.number(),
    createdAt: s.date().default(() => new Date()),
}).compile();

// Declare the shape once, in the schema. These read it back off.
export type Product = InferType<typeof productSchema>;
export type NewProduct = InferCreateType<typeof productSchema>;

// Product is the stored entity: every property present, unions preserved.
const stored: Product = {
    id: "p1",
    name: "Hammer",
    category: "tool",
    price: 12,
    createdAt: new Date(),
};

// NewProduct is what you pass to addAsync: `id` is generated and `createdAt` has a
// default, so neither is required here.
const toAdd: NewProduct = {
    name: "Oak plank",
    category: "material",
    price: 4,
};

// Use them anywhere a type is expected — parameters, returns, React props, API payloads.
const priceOf = (product: Product): number => product.price;

// A schema change is a compile error everywhere the type is used, instead of a silent
// mismatch against a hand-written interface.
export { productSchema, stored, toAdd, priceOf };
