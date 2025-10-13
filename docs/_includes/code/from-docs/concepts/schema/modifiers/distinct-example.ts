import { s } from "@routier/core/schema";

// Distinct properties within schemas
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),

    // Distinct properties (unique values)
    email: s.string().distinct(),
    username: s.string().distinct(),

    // Distinct with other modifiers
    phoneNumber: s.string().distinct().optional(),
    employeeId: s.number().distinct(),
}).compile();
