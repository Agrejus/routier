// ✅ Good - use schema features effectively
const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    email: s.string().distinct(), // Ensures uniqueness
    status: s.string<"active" | "inactive" | "suspended">().default("active"),
    createdAt: s.date().identity(), // Auto-generated
    updatedAt: s.date().default(() => new Date()),
  })
  .compile();

// The schema handles uniqueness, defaults, and identity generation
const user = await ctx.users.addAsync({
  email: "user@example.com",
  // Other fields get sensible defaults
});