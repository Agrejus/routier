type UUID = string & { __brand: "UUID" };

const schema = s
  .define("users", {
    id: s.string().constrain<UUID>().key().identity(),
    name: s.string(),
  })
  .compile();