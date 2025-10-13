import { s } from "@routier/core/schema";

// Optional properties within schemas
const profileSchema = s.define("profiles", {
    id: s.string().key().identity(),
    name: s.string(),

    // Optional properties (can be undefined)
    bio: s.string().optional(),
    avatar: s.string().optional(),
    website: s.string().optional(),

    // Optional with default
    theme: s.string("light", "dark").optional().default("light"),
}).compile();
