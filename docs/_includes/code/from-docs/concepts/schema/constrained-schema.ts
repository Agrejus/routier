import { s } from "@routier/core/schema";

// Schema with constrained values and advanced modifiers
const orderSchema = s
    .define("orders", {
        id: s.string().key().identity(),
        status: s.string("pending", "processing", "shipped", "delivered", "cancelled"),
        priority: s.string("low", "medium", "high").default("medium"),
        customerId: s.string().distinct(),
        total: s.number().default(0),
        items: s.array(s.object({
            productId: s.string(),
            quantity: s.number().default(1),
            price: s.number(),
        })),
        createdAt: s.date().default(() => new Date()),
        updatedAt: s.date().default(() => new Date()),
    })
    .compile();
