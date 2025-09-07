const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    role: s.string<"user" | "admin" | "moderator">(),
    priority: s.number<1 | 2 | 3 | 4 | 5>(),
    verified: s.boolean<true>(),
  })
  .compile();