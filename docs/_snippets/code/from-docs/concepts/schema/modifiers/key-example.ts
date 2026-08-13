import { s } from "@routier/core/schema";

// Key properties within schemas
const userSchema = s.define("users", {
    // String key
    email: s.string().key(),

    // Number key  
    userId: s.number().key(),

    // Date key
    timestamp: s.date().key(),

    // Key with identity (auto-generated)
    id: s.string().key().identity(),
}).compile();
