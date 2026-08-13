// Basic combinations
s.string().optional().nullable();
s.string().default("value").readonly();
s.string().distinct().index();

// Complex combinations
s.string()
  .distinct()
  .optional()
  .default("user@example.com")
  .deserialize((str) => str.toLowerCase())
  .serialize((str) => str.trim())
  .index("email");