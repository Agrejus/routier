type UUID = string & { __brand: "UUID" };

const userSchema = s
  .define("users", {
    id: s.string().constrain<UUID>().key().identity(),
    name: s.string(),
  })
  .compile();

type User = InferType<typeof userSchema>;
// User.id is now typed as UUID, not just string