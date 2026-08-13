const schema = s.define("users", {
  // Complex property with multiple modifiers
  email: s
    .string()
    .default("user@example.com")
    .distinct()
    .optional()
    .deserialize((str) => str.toLowerCase())
    .serialize((str) => str.trim()),

  // Computed property with modifiers
  displayName: s
    .string()
    .optional()
    .default(() => "Anonymous"),

  // Array with complex validation
  scores: s
    .array(s.number())
    .default(() => [])
    .optional(),
});