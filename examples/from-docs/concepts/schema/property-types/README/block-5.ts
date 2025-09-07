const schema = s.define("users", {
  // Nested object
  address: s.object({
    street: s.string(),
    city: s.string(),
    state: s.string(),
    zipCode: s.string(),
  }),

  // Object with modifiers
  profile: s
    .object({
      bio: s.string().optional(),
      avatar: s.string().optional(),
      preferences: s
        .object({
          theme: s.string<"light" | "dark">().default("light"),
          notifications: s.boolean().default(true),
        })
        .default(() => ({ theme: "light", notifications: true })),
    })
    .optional(),

  // Object with identity
  metadata: s
    .object({
      source: s.string(),
      version: s.string(),
    })
    .identity(),
});