import { InferCreateType, s } from "@routier/core/schema";

export const ordersSchema = s.define("orders", {
    orderId: s.string().key().from("_id").identity(),
    customerId: s.string(),
    status: s.string("pending", "processing", "shipped", "delivered", "cancelled"),
    orderDate: s.date().default(() => new Date()),
    shippedDate: s.date().optional(),
    deliveredDate: s.date().optional(),
    notes: s.string().optional(),
    isGift: s.boolean().default(false)
}).compile();

export type CreateOrder = InferCreateType<typeof ordersSchema>;

