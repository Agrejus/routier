const userSchema = s
  .define("users", {
    // Primary key
    id: s.string().key().identity(),

    // Required fields
    firstName: s.string(),
    lastName: s.string(),
    email: s.string().identity(),

    // Optional fields with defaults
    middleName: s.string().optional(),
    avatar: s.string().url().optional(),
    isActive: s.boolean().default(true),

    // Dates with defaults
    createdAt: s
      .date()
      .default(() => new Date())
      .readonly(),
    updatedAt: s.date().default(() => new Date()),

    // Nested objects
    profile: s
      .object({
        bio: s.string().optional(),
        website: s.string().url().optional(),
        preferences: s
          .object({
            theme: s.string<"light" | "dark">().default("light"),
            language: s.string<"en" | "es" | "fr">().default("en"),
          })
          .default(() => ({ theme: "light", language: "en" })),
      })
      .optional(),

    // Arrays
    tags: s
      .array(s.string())
      .optional()
      .default(() => []),
    roles: s
      .array(s.string<"user" | "admin" | "moderator">())
      .default(() => ["user"]),

    // Indexed fields
    username: s.string().index(),
    status: s
      .string<"active" | "inactive" | "suspended">()
      .index("status_created"),
    createdAt: s.date().index("status_created"),
  })
  .compile();