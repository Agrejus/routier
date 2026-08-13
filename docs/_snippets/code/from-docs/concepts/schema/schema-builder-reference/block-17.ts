const userSchema = s
  .define("users", {
    // Primary key
    id: s.string().key().identity(),

    // Required fields
    firstName: s.string(),
    lastName: s.string(),
    email: s.string().distinct(),

    // Optional fields
    middleName: s.string().optional(),
    avatar: s.string().optional(),

    // Fields with defaults
    isActive: s.boolean().default(true),
    createdAt: s.date().default(() => new Date()),

    // Readonly fields
    version: s.number().identity().readonly(),

    // Indexed fields
    username: s.string().index(),
    status: s.string<"active" | "inactive">().index("status_created"),
    createdAt: s.date().index("status_created"),
  })
  .compile();