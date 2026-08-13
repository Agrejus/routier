import { s } from "@routier/core/schema";

// String literals within schemas
const orderSchema = s.define("orders", {
    status: s.string("pending", "approved", "rejected"),
    role: s.string("admin", "user", "guest"),
    theme: s.string("light", "dark", "auto"),
}).compile();
