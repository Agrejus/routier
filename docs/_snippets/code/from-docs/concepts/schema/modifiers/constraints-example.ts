import { s } from "@routier/core/schema";

// Constraints defined early within schemas
const earlyConstraintsSchema = s.define("earlyConstraints", {
    id: s.string().key().identity(),

    // Define constraints early in the schema
    email: s.string().distinct(), // Unique constraint
    username: s.string().distinct().index("username_idx"), // Unique + indexed
    role: s.string("admin", "user", "guest").default("user"), // Literal constraint

    // Then add behavior modifiers
    isActive: s.boolean().default(true),
    lastLogin: s.date().optional(),
}).compile();
