// Good - use literal types for constrained values
status: s.string<"active" | "inactive" | "suspended">();

// Avoid - generic types when specific ones exist
status: s.string(); // No type safety