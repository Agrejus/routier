// Good - type-safe constrained values
s.string<"active" | "inactive" | "suspended">();

// Avoid - generic types when specific ones exist
s.string(); // No type safety