import { s } from "@routier/core/schema";

// Use literal types for constrained values
const statusSchema = s.define("status", {
    id: s.string().key().identity(),

    // Use literals for constrained values
    orderStatus: s.string("pending", "processing", "shipped", "delivered"),
    userRole: s.string("admin", "user", "guest").default("user"),
    priority: s.number(1, 2, 3, 4, 5).default(1),

    // Instead of free-form strings
    // ❌ Bad: s.string() // Allows any string
    // ✅ Good: s.string("active", "inactive") // Constrains to specific values
}).compile();
