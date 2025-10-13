import { s } from "@routier/core/schema";

// Serialization and persistence example
const settingsSchema = s.define("settings", {
    id: s.string().key().identity(),
    userId: s.string().distinct(),
    preferences: s.object({
        theme: s.string("light", "dark", "auto").default("auto"),
        language: s.string("en", "es", "fr").default("en"),
        notifications: s.boolean().default(true),
    }).serialize(obj => JSON.stringify(obj)) // Custom serialization
        .deserialize(str => JSON.parse(str)),
    lastLogin: s.date().serialize(date => date.toISOString()) // Date serialization
        .deserialize(str => new Date(str)),
    sessionData: s.object({
        token: s.string(),
        expires: s.date(),
    }).optional().serialize(obj => btoa(JSON.stringify(obj))) // Base64 encoding
        .deserialize(str => JSON.parse(atob(str))),
}).compile();

// Schemas handle data transformation automatically:
// - JSON serialization/deserialization
// - Date format conversion
// - Custom encoding (Base64, etc.)
// - Type conversion and validation
// - Default value application
// - Constraint enforcement
// - Cross-platform compatibility
