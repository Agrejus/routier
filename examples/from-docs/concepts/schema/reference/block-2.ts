const schema = s
  .define("user", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().email(),
  })
  .compile();