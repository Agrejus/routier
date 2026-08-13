const schema = s.define("users", {
  // Basic string
  name: s.string(),

  // String with literal constraints
  status: s.string<"active" | "inactive" | "suspended">(),
  role: s.string<"user" | "admin" | "moderator">(),

  // String with modifiers
  email: s.string().distinct(),
  username: s.string().index(),
  bio: s.string().optional(),
});