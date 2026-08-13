const schema = s.define("users", {
  id: s.string().key().identity(), // Auto-generated UUID
  createdAt: s.date().identity(), // Auto-generated timestamp
  version: s.number().identity(), // Auto-incrementing number
});