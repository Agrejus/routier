import { s } from "@routier/core/schema";

// Use computed properties for derived data
const orderSchema = s.define("orders", {
    id: s.string().key().identity(),
    items: s.array(s.object({
        productId: s.string(),
        quantity: s.number(),
        price: s.number(),
    })),
    taxRate: s.number().default(0.08),
}).modify(w => ({
    // Computed properties for derived values
    subtotal: w.computed((entity) =>
        entity.items.reduce((sum, item) => sum + (item.quantity * item.price), 0),
        {}
    ).tracked(),

    tax: w.computed((entity) =>
        entity.subtotal * entity.taxRate,
        {}
    ).tracked(),

    total: w.computed((entity) =>
        entity.subtotal + entity.tax,
        {}
    ).tracked(),
})).compile();

// Computed properties:
// - Automatically calculate derived values
// - Stay in sync with source data
// - Can be cached for performance
// - Reduce data duplication
// - Simplify business logic
