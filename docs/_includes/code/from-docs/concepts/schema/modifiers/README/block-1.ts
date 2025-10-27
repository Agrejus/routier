const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    // Optional on insert; will use the default if omitted
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

// OK: createdAt omitted; default will be applied
await ctx.users.addAsync({ id: crypto.randomUUID() });