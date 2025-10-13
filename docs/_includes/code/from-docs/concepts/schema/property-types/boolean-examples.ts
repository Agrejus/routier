import { s } from "@routier/core/schema";

// Boolean property types within schemas
const settingsSchema = s.define("settings", {
    // Basic boolean
    isActive: s.boolean(),

    // Boolean with modifiers
    isEnabled: s.boolean().default(true),
    isOptional: s.boolean().optional().nullable(),
    isReadonly: s.boolean().readonly(),

    // Boolean with serialization
    flag: s.boolean().serialize((bool) => bool ? "1" : "0")
        .deserialize((str) => str === "1"),
}).compile();
