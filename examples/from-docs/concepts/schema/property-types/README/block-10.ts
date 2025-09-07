const schema = s.define("ecommerce", {
  // Complex nested structure
  user: s.object({
    id: s.string().key().identity(),
    profile: s.object({
      personal: s.object({
        firstName: s.string(),
        lastName: s.string(),
        birthDate: s.date().optional(),
      }),
      contact: s.object({
        email: s.string().distinct(),
        phone: s.string().optional(),
      }),
      preferences: s.object({
        theme: s.string<"light" | "dark" | "auto">().default("auto"),
        language: s.string<"en" | "es" | "fr">().default("en"),
        notifications: s.boolean().default(true),
      }),
    }),
    roles: s.array(s.string<"user" | "moderator" | "admin">()),
    metadata: s
      .object({
        source: s.string(),
        version: s.string(),
      })
      .optional(),
  }),
});