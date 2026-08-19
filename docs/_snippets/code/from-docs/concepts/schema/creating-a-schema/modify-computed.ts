import { InferType, s } from "@routier/core/schema";

const orderSchema = s.define("orders", {
    id: s.string().key().identity(),
    quantity: s.number(),
    unitPrice: s.number(),
}).modify(x => ({
    // Derived on read, never stored. The database has no `total` column.
    total: x.computed(order => order.quantity * order.unitPrice),

    // Derived AND stored, so the backend can filter and index on it.
    storedTotal: x.computed(order => order.quantity * order.unitPrice).tracked(),

    // The collection name, which `.modify()` passes as the second argument. A common way to
    // tag rows when several collections share one physical store.
    documentType: x.computed((_order, collectionName) => collectionName).tracked(),

    // Behavior rather than data: the outer function receives the entity, and whatever it
    // RETURNS becomes the property. Return a function and you get a method on the entity.
    describe: x.function(order => () => `${order.quantity} x ${order.unitPrice}`),
})).compile();

// All of it is part of the inferred type, so nothing needs restating by hand.
type Order = InferType<typeof orderSchema>;

const report = (order: Order) => ({
    total: order.total,             // number, computed on read
    stored: order.storedTotal,      // number, read back from storage
    kind: order.documentType,       // "orders"
    text: order.describe(),         // "2 x 9.99"
});

export { orderSchema, report };
export type { Order };
