// Good - organized by purpose
const userSchema = s
  .define("user", {
    // Identity
    id: s.string().key().identity(),

    // Required fields
    name: s.string().required(),
    email: s.string().email().required(),

    // Optional fields
    avatar: s.string().url().optional(),

    // Computed fields
    displayName: s
      .string()
      .computed((user) => (user.avatar ? user.name : user.name)),
  })
  .compile();