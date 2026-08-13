import { s } from "@routier/core/schema";

// Modifier order examples within schemas
const orderSchema = s.define("orders", {
    // Recommended order: type -> constraints -> behavior -> defaults
    id: s.string().key().identity(),
    email: s.string().distinct().optional(),
    age: s.number(18, 19, 20, 21).default(18),
    status: s.string("active", "inactive").default("active").readonly(),

    // Complex chaining
    profile: s.object({
        bio: s.string().optional().nullable(),
        avatar: s.string().optional(),
    }).optional().serialize((obj) => JSON.stringify(obj))
        .deserialize((str) => JSON.parse(str)),
}).compile();
