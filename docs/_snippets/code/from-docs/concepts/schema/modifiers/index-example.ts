import { s } from "@routier/core/schema";

// Indexed properties within schemas
const searchSchema = s.define("search", {
    id: s.string().key().identity(),

    // Single index
    email: s.string().index("email_idx"),

    // Multiple indexes
    category: s.string().index("category_idx", "search_idx"),

    // Distinct index (unique)
    username: s.string().distinct(),

    // Indexed with other modifiers
    status: s.string("active", "inactive").index("status_idx").default("active"),
}).compile();
