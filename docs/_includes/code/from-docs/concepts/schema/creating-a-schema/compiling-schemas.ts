import { s } from "@routier/core/schema";

// Compiling schemas
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
}).compile();

// The compiled schema is ready to use
// You can now use it with collections, type inference, etc.
type User = typeof userSchema;
