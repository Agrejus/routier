import { s } from "@routier/core/schema";

// Boolean literals within schemas (boolean type doesn't need literals)
const configSchema = s.define("config", {
    // Boolean is already constrained to true/false
    isActive: s.boolean(),
    isEnabled: s.boolean(),
    isVisible: s.boolean(),
}).compile();
