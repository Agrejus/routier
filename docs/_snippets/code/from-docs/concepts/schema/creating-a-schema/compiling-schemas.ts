import { InferType, s } from "@routier/core/schema";

// Compiling schemas
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
}).compile();

// The compiled schema is ready to use.
//
// To get the ENTITY type, wrap it in InferType. `typeof userSchema` is the type of the
// schema object itself — it has no `id`, `name` or `email` on it.
type User = InferType<typeof userSchema>;

// User is { id: string; name: string; email: string }
const user: User = { id: "1", name: "James", email: "james@example.com" };
