const userSchema = s.object({
  id: s.string().key().identity(),
  createdAt: s
    .date()
    .serialize((date) => date.toISOString()) // To string for storage
    .deserialize((str) => new Date(str)), // From string to Date
  settings: s
    .object({
      theme: s.string(),
      language: s.string(),
    })
    .serialize((settings) => JSON.stringify(settings)) // To JSON string
    .deserialize((str) => JSON.parse(str)), // From JSON string
});

// Automatic handling of:
// - Date serialization/deserialization
// - Complex object persistence
// - Data format conversions
// - Storage optimization