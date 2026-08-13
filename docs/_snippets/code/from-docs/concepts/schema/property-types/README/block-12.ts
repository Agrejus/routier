const schema = s.define("users", {
  // Auto-generated UUID
  id: s.string().key().identity(),

  // Auto-generated timestamp
  createdAt: s.date().identity(),

  // Auto-incrementing number
  version: s.number().identity(),

  // Auto-generated boolean
  isVerified: s.boolean().identity(),
});