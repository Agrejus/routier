import { s } from "@routier/core/schema";

// Start simple - begin with basic schema
const simpleUserSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
}).compile();

// Add complexity gradually as needed:
// - Start with essential properties
// - Add modifiers only when required
// - Introduce computed properties later
// - Add constraints as business rules emerge

// Don't over-engineer from the start!
