import { s } from "@routier/core/schema";

// Consistent data handling example
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    email: s.string().distinct(),
    profile: s.object({
        firstName: s.string(),
        lastName: s.string(),
        avatar: s.string().optional(),
    }),
    preferences: s.object({
        theme: s.string("light", "dark").default("light"),
        notifications: s.boolean().default(true),
    }).default({}),
}).compile();

// Schemas ensure all parts of your application handle data the same way:
// - Same structure across frontend, backend, and database
// - Consistent serialization/deserialization
// - Uniform validation and type checking
// - Same default values everywhere
// - Consistent indexing and querying
// - Same computed properties and functions

// Whether you're:
// - Creating a user in the frontend
// - Processing data in the backend  
// - Storing data in the database
// - Syncing between systems
// The schema ensures consistent behavior everywhere
