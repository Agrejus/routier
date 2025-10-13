import { InferType, s } from "@routier/core/schema";

// Example schema with computed property
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    firstName: s.string(),
    lastName: s.string(),
    email: s.string(),
    // Computed property - calculated on save
    fullName: s.computed((entity) => `${entity.firstName} ${entity.lastName}`),
}).compile();

type User = InferType<typeof userSchema>;

// Instead of runtime reflection like this (SLOW):
function slowSerialize(entity: any) {
    const result: any = {};
    // Creates new objects, uses Object.keys(), property enumeration
    for (const key in entity) {
        if (entity.hasOwnProperty(key)) {
            result[key] = entity[key];
        }
    }
    return result;
}

// Routier generates optimized code like this (FAST):
function fastSerialize(entity: User) {
    const result: any = {};

    // Direct property access - no loops, no Object.keys()
    if (Object.hasOwn(entity, "id")) result.id = entity.id;
    if (Object.hasOwn(entity, "firstName")) result.firstName = entity.firstName;
    if (Object.hasOwn(entity, "lastName")) result.lastName = entity.lastName;
    if (Object.hasOwn(entity, "email")) result.email = entity.email;

    // Computed properties are calculated inline
    if (result.firstName != null && result.lastName != null) {
        result.fullName = `${result.firstName} ${result.lastName}`;
    }

    return result;
}

// Memory efficiency benefits:
// 1. No temporary arrays from Object.keys()
// 2. No for...in loop iterations
// 3. Direct property access (entity.firstName vs entity[key])
// 4. Inline computations instead of function calls
// 5. Pre-compiled property paths instead of string concatenation