import { s } from "@routier/core/schema";

// Serialization modifiers
const configSchema = s.define("config", {
    id: s.string().key().identity(),
    settings: s.object({
        theme: s.string(),
        notifications: s.boolean(),
    }).serialize((obj) => JSON.stringify(obj))
        .deserialize((str) => JSON.parse(str)),
    metadata: s.array(s.string()).serialize((arr) => arr.join(","))
        .deserialize((str) => str.split(",")),
}).compile();
