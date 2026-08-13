import { s } from "@routier/core/schema";

// Modifier chaining within schemas
const complexSchema = s.define("complex", {
    id: s.string().key().identity(),

    // Recommended order: type -> constraints -> behavior -> defaults
    email: s.string().distinct().optional().default(""),

    // Complex chaining
    age: s.number(18, 19, 20, 21).default(18).readonly(),

    // Serialization with other modifiers
    profile: s.object({
        bio: s.string().optional().nullable(),
        avatar: s.string().optional(),
    }).optional().serialize((obj) => JSON.stringify(obj))
        .deserialize((str) => JSON.parse(str)),

    // Indexed with defaults
    status: s.string("active", "inactive").index("status_idx").default("active"),
}).compile();
