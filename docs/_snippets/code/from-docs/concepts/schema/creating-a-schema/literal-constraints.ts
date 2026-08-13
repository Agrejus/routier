import { s } from "@routier/core/schema";

// Literal type constraints
const statusSchema = s.define("orders", {
    id: s.string().key().identity(),
    status: s.string("pending", "processing", "completed", "cancelled"),
    priority: s.number(1, 2, 3, 4, 5),
    isActive: s.boolean(),
}).compile();
