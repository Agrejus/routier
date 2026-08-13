import { s } from "@routier/core/schema";

// Compound indexes within schemas
const orderSchema = s.define("orders", {
    id: s.string().key().identity(),

    // Multiple fields sharing the same index name for compound indexing
    userId: s.string().index("user_orders"),
    orderDate: s.date().index("user_orders"),
    status: s.string().index("user_orders"),

    // Another compound index
    category: s.string().index("category_status"),
    priority: s.string().index("category_status"),
}).compile();
